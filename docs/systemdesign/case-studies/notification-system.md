# Notification System

!!! danger "Real Incident: Facebook Duplicate Push Notification Storm, 2019"
    In September 2019, Facebook sent approximately 3x duplicate push notifications to hundreds of millions of users over a 30-minute window. Users received the same notification three times in rapid succession — likes, comments, friend requests, all tripled. The root cause: a deploy to the notification deduplication service introduced a race condition where the bloom filter check and the exact-match check returned conflicting results under high concurrency. The dedup layer "passed" messages it should have suppressed. Because there was no secondary dedup at the channel-worker level, every duplicate sailed through to APNs/FCM unchecked. The incident burned user trust — some disabled notifications entirely, tanking engagement metrics for weeks. Facebook's post-mortem mandated **deduplication at every layer** (ingestion, queue consumer, and provider-level collapse keys) so that no single-layer failure can produce duplicates. **A notification system without layered dedup is a ticking time bomb.**

---

## System Design Concepts Used

`Priority Queues` · `Channel Isolation` · `Bloom Filter Deduplication` · `Rate Limiting (Token Bucket)` · `Dead Letter Queue` · `Exponential Backoff with Jitter` · `Template Engine (i18n)` · `Fan-out on Write` · `User Preference Engine` · `Idempotency Keys` · `Queue Backpressure` · `Circuit Breaker` · `Kafka Consumer Groups` · `Multi-Tenant Rate Limiting` · `Cassandra (Write-Optimized Storage)` · `ClickHouse (OLAP Analytics)`

---

## 1. Functional Requirements

1. **Multi-channel delivery** — send notifications via push (iOS/Android), SMS, email, in-app, and webhook
2. **Priority classification** — route notifications to priority lanes (P0=security/OTP, P1=transactional, P2=social, P3=marketing)
3. **User preference management** — honor quiet hours, channel opt-outs, frequency caps, and language preferences
4. **Template engine with i18n** — render notifications from templates with variable substitution, supporting 50+ locales
5. **Deduplication** — prevent duplicate notifications from reaching users across all channels
6. **Delivery tracking** — track notification lifecycle (queued, sent, delivered, read, failed) with analytics
7. **Scheduling** — support delayed/scheduled notifications (e.g., "send at 9 AM user's local time")
8. **Rate limiting** — enforce per-user and per-channel rate limits to prevent notification fatigue
9. **Retry with fallback** — if push fails, fall back to SMS; if SMS fails, fall back to email

## 2. Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Throughput** | 1B notifications/day (~12K/sec avg, 60K/sec peak) | Supports global consumer apps with flash sales, breaking news |
| **Latency (P0 critical)** | < 3s end-to-end (p99) | OTP/security alerts must arrive before user loses patience |
| **Latency (P1 transactional)** | < 10s end-to-end (p99) | Order confirmations, payment receipts expected quickly |
| **Latency (P2/P3 bulk)** | < 5 minutes (soft real-time) | Social/marketing can tolerate batching for efficiency |
| **Delivery rate** | 99.9% (across all channels combined) | Fallback channels compensate for primary channel failures |
| **Duplicate rate** | < 0.01% | Users notice and are annoyed by duplicates; trust erosion |
| **Availability** | 99.95% (< 4.4 hours/year downtime) | Notifications are revenue-critical (OTPs, order updates) |
| **Data retention** | 90 days hot, 2 years cold | Compliance, debugging, analytics |

---

## 3. Capacity Estimation

```text
/* ━━━ NAPKIN MATH: Start From Daily Volume ━━━ */
Total notifications/day:        1,000,000,000 (1B)
Notifications/sec (avg):        1B / 86,400 ≈ 11,574/sec → ~12K/sec
Peak (5x daily avg):            12K × 5 = 60K/sec (flash sales, breaking news)
Absolute spike (10x):           120K/sec (New Year countdown, election results)

/* ━━━ CHANNEL BREAKDOWN ━━━ */
Push notifications (60%):       600M/day → 7,000/sec avg → 35K/sec peak
Email (25%):                    250M/day → 2,900/sec avg → 14.5K/sec peak
SMS (10%):                      100M/day → 1,150/sec avg → 5,750/sec peak
In-App (5%):                    50M/day  → 580/sec avg  → 2,900/sec peak

/* ━━━ STORAGE ━━━ */
Notification record size:       ~500 bytes (template rendered + metadata)
Delivery log per notification:  ~200 bytes (status, timestamps, provider response)
Daily storage (notifications):  1B × 500B = 500 GB/day
Daily storage (delivery logs):  1B × 200B = 200 GB/day
90-day hot storage:             700 GB × 90 = 63 TB (Cassandra cluster)
2-year cold storage:            700 GB × 730 = 511 TB (S3/compressed)

/* ━━━ QUEUE DEPTH ━━━ */
Kafka partitions per priority:
  P0 (critical):  32 partitions, 4 consumer groups → max 500K in-flight
  P1 (high):      64 partitions, 8 consumer groups → max 2M in-flight
  P2 (normal):    128 partitions, 16 consumer groups → max 10M in-flight
  P3 (low):       128 partitions, 8 consumer groups → max 50M in-flight
Total Kafka retention:          24 hours × 60K/sec × 1KB avg = ~5 TB

/* ━━━ COST AWARENESS ━━━ */
SMS cost (at $0.01/msg):        100M/day × $0.01 = $1M/day (!!)
Push cost (FCM/APNs):           Free (volume-based, no per-message cost)
Email cost (SES at $0.10/1K):   250M/day × $0.0001 = $25K/day
→ SMS rate limiting is a BUSINESS REQUIREMENT, not just UX
```

!!! note "System Nature"
    **Write-heavy, latency-sensitive, cost-constrained.** Unlike a URL shortener (read-heavy), a notification system is write-heavy: every notification is written once and read zero times by the system (it's pushed to users). The architecture optimizes for high-throughput writes, channel isolation, and cost control (especially SMS).

---

## 4. "Why X, Not Y?" — Tradeoff Analysis

### Why priority queues, not a single FIFO?

**Priority queues are mandatory because a single FIFO creates priority inversion — a 10M marketing blast queued at 2 PM blocks an OTP generated at 2:01 PM from reaching the user for minutes.** With priority topics (P0/P1/P2/P3), each priority level has dedicated consumer groups. P0 consumers are always idle (low volume, instant consumption), so an OTP goes from queue to delivery in <100ms regardless of how many P3 marketing messages are backed up.

The cost is operational complexity: 4 topic groups instead of 1, separate monitoring/alerting per priority, and priority assignment logic in the router. But the Uber 2019 incident proved this is non-negotiable — a single queue means your most important messages (security, authentication) are held hostage by your least important (marketing).

*Single FIFO advantage:* Simpler operations, guaranteed ordering, easier capacity planning. Only acceptable for systems with <1M notifications/day where all notifications are equally important.

### Why channel-specific workers, not a unified sender?

**Channel isolation ensures that an APNs outage (Apple push) doesn't cascade to email or SMS delivery.** Each channel has fundamentally different characteristics: push is fire-and-forget over HTTP/2 multiplexed connections, SMS requires serial API calls with per-provider rate limits (Twilio caps at 400 msg/sec per number), email uses SMTP batching with connection pooling. A unified sender would need to handle all protocols, and a bug/outage in one protocol's handling would stall the entire worker pool.

With isolated workers: Push workers maintain persistent HTTP/2 connections to APNs/FCM. SMS workers manage Twilio connection pools with provider-specific retry logic. Email workers batch via SES with 50-email-per-API-call optimization. Each can scale independently based on channel volume.

*Unified sender advantage:* Simpler deployment, single codebase, easier to implement cross-channel dedup. Acceptable for startups sending <10K notifications/day.

### Why deduplication at every layer, not just ingestion?

**A single dedup layer is a single point of failure for duplicates — and duplicate notifications are among the most user-visible failures.** The Facebook 2019 incident proved that ingestion-layer dedup alone is insufficient: if the dedup service has a bug, a cache eviction, or a race condition, duplicates flow through unimpeded to billions of users.

Layered dedup provides defense-in-depth:

- **API layer:** Idempotency key in Redis (24h TTL) — catches duplicate API calls from producers
- **Queue consumer layer:** Check `notification_id` in delivery log before processing — catches messages redelivered by Kafka (at-least-once semantics)
- **Provider layer:** APNs `apns-collapse-id`, FCM `collapse_key`, email `Message-ID` — the provider itself suppresses duplicates

Each layer is cheap (Redis lookup, DB exists check, free header). The combined probability of all three failing simultaneously is negligible.

*Ingestion-only dedup advantage:* Lower latency (single check point), simpler architecture. Acceptable only if your dedup service has 99.999% reliability and you accept the risk.

### Why rate limiting per-user, not just per-channel?

**Per-channel rate limiting (e.g., max 1M push/sec globally) protects infrastructure but doesn't protect user experience.** A user who receives 47 push notifications in an hour will disable notifications entirely — regardless of whether your servers are healthy. Per-user rate limiting (e.g., max 5 push/hour, 2 SMS/day, 10 email/day) prevents notification fatigue.

Implementation uses a sliding window counter per user per channel in Redis: `INCR user:{id}:push:window:{hour}`. When the limit is hit, lower-priority notifications are either dropped (P3 marketing) or queued for the next window (P2 social). P0/P1 are never rate-limited — security alerts and OTPs always go through.

*Per-channel-only advantage:* Much simpler (single global counter), no per-user Redis keys (saves memory). Acceptable for B2B systems where users expect high notification volume (e.g., monitoring dashboards).

---

## 5. High-Level Architecture

<div class="arch-diagram" style="background: #FAFBFE; border: 2px solid #E2E8F0; border-radius: 14px; padding: 20px; margin: 24px 0; overflow-x: auto; text-align: center;">
<svg viewBox="0 0 1100 750" xmlns="http://www.w3.org/2000/svg" font-family="Inter,system-ui,sans-serif">
  <defs>
    <marker id="a" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#546E7A"/>
    </marker>
    <marker id="ar" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#D32F2F"/>
    </marker>
    <marker id="ag" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#388E3C"/>
    </marker>
    <filter id="sh" x="-3%" y="-3%" width="106%" height="106%">
      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="1100" height="750" fill="#FAFAFA" rx="8"/>

  <!-- Title -->
  <text x="550" y="28" text-anchor="middle" font-size="18" font-weight="800" fill="#212121">Notification System — Architecture</text>
  <text x="550" y="48" text-anchor="middle" font-size="11" fill="#757575">1B/day | Push + SMS + Email + In-App | Priority Queues | Channel Isolation | Layered Dedup</text>

  <!-- ═══ LAYER 1: Event Producers ═══ -->
  <rect x="40" y="60" width="1020" height="65" rx="10" fill="#E3F2FD" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="76" font-size="10" font-weight="600" fill="#9E9E9E">Event Producers (Internal Services)</text>
  <rect x="60" y="82" width="160" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="140" y="104" text-anchor="middle" font-size="10" font-weight="600" fill="#0D47A1">Auth Service (OTP)</text>
  <rect x="235" y="82" width="160" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="315" y="104" text-anchor="middle" font-size="10" font-weight="600" fill="#0D47A1">Order Service</text>
  <rect x="410" y="82" width="160" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="490" y="104" text-anchor="middle" font-size="10" font-weight="600" fill="#0D47A1">Payment Service</text>
  <rect x="585" y="82" width="160" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="665" y="104" text-anchor="middle" font-size="10" font-weight="600" fill="#0D47A1">Social Service</text>
  <rect x="760" y="82" width="160" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="840" y="104" text-anchor="middle" font-size="10" font-weight="600" fill="#0D47A1">Marketing Engine</text>

  <!-- Arrow down to Notification API -->
  <line x1="550" y1="125" x2="550" y2="148" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- ═══ LAYER 2: Notification API + Validation ═══ -->
  <rect x="300" y="148" width="500" height="55" rx="8" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="550" y="168" text-anchor="middle" font-size="13" font-weight="700" fill="#1B5E20">Notification API Gateway</text>
  <text x="550" y="186" text-anchor="middle" font-size="9" fill="#757575">Schema Validation | Idempotency Check | Rate Limit (API-level) | Auth | Enrich with User Prefs</text>

  <!-- Side: Redis Dedup + User Prefs -->
  <line x1="800" y1="175" x2="870" y2="175" stroke="#D32F2F" stroke-width="1.2" marker-end="url(#ar)"/>
  <rect x="870" y="148" width="180" height="55" rx="6" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="960" y="168" text-anchor="middle" font-size="10" font-weight="600" fill="#B71C1C">Redis Cluster</text>
  <text x="960" y="182" text-anchor="middle" font-size="8" fill="#757575">Idempotency keys (TTL=24h)</text>
  <text x="960" y="194" text-anchor="middle" font-size="8" fill="#757575">Rate limit counters | User prefs cache</text>

  <!-- Side: Template Service -->
  <line x1="300" y1="175" x2="230" y2="175" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="50" y="148" width="180" height="55" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="140" y="168" text-anchor="middle" font-size="10" font-weight="600" fill="#311B92">Template Engine</text>
  <text x="140" y="182" text-anchor="middle" font-size="8" fill="#757575">i18n (50+ locales)</text>
  <text x="140" y="194" text-anchor="middle" font-size="8" fill="#757575">Variable substitution</text>

  <!-- Arrow down to Priority Router -->
  <line x1="550" y1="203" x2="550" y2="228" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- ═══ LAYER 3: Priority Router ═══ -->
  <rect x="380" y="228" width="340" height="42" rx="6" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5" filter="url(#sh)"/>
  <text x="550" y="248" text-anchor="middle" font-size="12" font-weight="700" fill="#F57F17">Priority Router</text>
  <text x="550" y="262" text-anchor="middle" font-size="9" fill="#757575">Classify priority (P0-P3) | Route to correct Kafka topic | Schedule if deferred</text>

  <!-- Arrow down to Priority Queues -->
  <line x1="550" y1="270" x2="550" y2="295" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- ═══ LAYER 4: Kafka Priority Topics ═══ -->
  <rect x="40" y="295" width="1020" height="70" rx="10" fill="#ECEFF1" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="311" font-size="10" font-weight="600" fill="#9E9E9E">Kafka Priority Topics (Isolated Consumer Groups)</text>
  <rect x="60" y="318" width="220" height="38" rx="5" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.8"/>
  <text x="170" y="335" text-anchor="middle" font-size="10" font-weight="700" fill="#B71C1C">P0: Critical (OTP/Security)</text>
  <text x="170" y="349" text-anchor="middle" font-size="8" fill="#757575">32 partitions | 4 consumers | &lt;100ms drain</text>
  <rect x="295" y="318" width="220" height="38" rx="5" fill="#FFE0B2" stroke="#F57C00" stroke-width="1.8"/>
  <text x="405" y="335" text-anchor="middle" font-size="10" font-weight="700" fill="#E65100">P1: High (Transactional)</text>
  <text x="405" y="349" text-anchor="middle" font-size="8" fill="#757575">64 partitions | 8 consumers | &lt;5s drain</text>
  <rect x="530" y="318" width="220" height="38" rx="5" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.8"/>
  <text x="640" y="335" text-anchor="middle" font-size="10" font-weight="700" fill="#F57F17">P2: Normal (Social)</text>
  <text x="640" y="349" text-anchor="middle" font-size="8" fill="#757575">128 partitions | 16 consumers | &lt;30s drain</text>
  <rect x="765" y="318" width="220" height="38" rx="5" fill="#E8EAF6" stroke="#546E7A" stroke-width="1.8"/>
  <text x="875" y="335" text-anchor="middle" font-size="10" font-weight="700" fill="#37474F">P3: Low (Marketing)</text>
  <text x="875" y="349" text-anchor="middle" font-size="8" fill="#757575">128 partitions | 8 consumers | batched</text>

  <!-- Arrows down to Channel Workers -->
  <line x1="170" y1="365" x2="170" y2="395" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <line x1="405" y1="365" x2="405" y2="395" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <line x1="640" y1="365" x2="640" y2="395" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <line x1="875" y1="365" x2="875" y2="395" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- ═══ LAYER 5: Channel Workers ═══ -->
  <rect x="40" y="395" width="1020" height="80" rx="10" fill="#E8F5E9" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="411" font-size="10" font-weight="600" fill="#9E9E9E">Channel Workers (Independent Pools — Crash Isolation)</text>
  <rect x="60" y="418" width="190" height="48" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="155" y="437" text-anchor="middle" font-size="11" font-weight="600" fill="#1B5E20">Push Worker</text>
  <text x="155" y="455" text-anchor="middle" font-size="8" fill="#757575">HTTP/2 multiplex to APNs/FCM</text>
  <rect x="270" y="418" width="190" height="48" rx="6" fill="#B2EBF2" stroke="#00838F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="365" y="437" text-anchor="middle" font-size="11" font-weight="600" fill="#006064">SMS Worker</text>
  <text x="365" y="455" text-anchor="middle" font-size="8" fill="#757575">Twilio/SNS | Multi-provider failover</text>
  <rect x="480" y="418" width="190" height="48" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="575" y="437" text-anchor="middle" font-size="11" font-weight="600" fill="#311B92">Email Worker</text>
  <text x="575" y="455" text-anchor="middle" font-size="8" fill="#757575">SES/SendGrid | Batch 50/call</text>
  <rect x="690" y="418" width="190" height="48" rx="6" fill="#FFE0B2" stroke="#F57C00" stroke-width="1.5" filter="url(#sh)"/>
  <text x="785" y="437" text-anchor="middle" font-size="11" font-weight="600" fill="#E65100">In-App Worker</text>
  <text x="785" y="455" text-anchor="middle" font-size="8" fill="#757575">WebSocket push | Store if offline</text>
  <rect x="900" y="418" width="140" height="48" rx="6" fill="#B2DFDB" stroke="#00695C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="970" y="437" text-anchor="middle" font-size="10" font-weight="600" fill="#004D40">Webhook</text>
  <text x="970" y="455" text-anchor="middle" font-size="8" fill="#757575">Partner callbacks</text>

  <!-- Arrows down to External Providers -->
  <line x1="155" y1="466" x2="155" y2="498" stroke="#388E3C" stroke-width="1.2" marker-end="url(#ag)"/>
  <line x1="365" y1="466" x2="365" y2="498" stroke="#388E3C" stroke-width="1.2" marker-end="url(#ag)"/>
  <line x1="575" y1="466" x2="575" y2="498" stroke="#388E3C" stroke-width="1.2" marker-end="url(#ag)"/>

  <!-- ═══ LAYER 6: External Providers ═══ -->
  <rect x="40" y="498" width="680" height="60" rx="10" fill="#F3E5F5" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="514" font-size="10" font-weight="600" fill="#9E9E9E">External Delivery Providers</text>
  <rect x="60" y="520" width="180" height="30" rx="5" fill="#E1BEE7" stroke="#7B1FA2" stroke-width="1.2"/>
  <text x="150" y="539" text-anchor="middle" font-size="10" font-weight="600" fill="#4A148C">APNs / FCM</text>
  <rect x="260" y="520" width="180" height="30" rx="5" fill="#E1BEE7" stroke="#7B1FA2" stroke-width="1.2"/>
  <text x="350" y="539" text-anchor="middle" font-size="10" font-weight="600" fill="#4A148C">Twilio / Vonage / SNS</text>
  <rect x="460" y="520" width="180" height="30" rx="5" fill="#E1BEE7" stroke="#7B1FA2" stroke-width="1.2"/>
  <text x="550" y="539" text-anchor="middle" font-size="10" font-weight="600" fill="#4A148C">SES / SendGrid / Mailgun</text>

  <!-- ═══ Delivery Tracker + Storage ═══ -->
  <line x1="550" y1="558" x2="550" y2="590" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <text x="560" y="578" font-size="8" fill="#757575">delivery callbacks</text>

  <rect x="40" y="590" width="1020" height="75" rx="10" fill="#E8EAF6" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="606" font-size="10" font-weight="600" fill="#9E9E9E">Delivery Tracking &amp; Storage</text>

  <!-- Cassandra cylinder -->
  <path d="M80,620 L80,648 C80,660 230,660 230,648 L230,620" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="155" cy="620" rx="75" ry="9" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="155" cy="620" rx="75" ry="9" fill="#283593" opacity="0.1"/>
  <text x="155" y="638" text-anchor="middle" font-size="10" font-weight="600" fill="#1A237E">Cassandra</text>
  <text x="155" y="652" text-anchor="middle" font-size="8" fill="#757575">Delivery log (write-optimized)</text>

  <!-- ClickHouse cylinder -->
  <path d="M280,620 L280,648 C280,660 430,660 430,648 L430,620" fill="#B2DFDB" stroke="#00695C" stroke-width="1.5"/>
  <ellipse cx="355" cy="620" rx="75" ry="9" fill="#B2DFDB" stroke="#00695C" stroke-width="1.5"/>
  <ellipse cx="355" cy="620" rx="75" ry="9" fill="#00695C" opacity="0.1"/>
  <text x="355" y="638" text-anchor="middle" font-size="10" font-weight="600" fill="#004D40">ClickHouse</text>
  <text x="355" y="652" text-anchor="middle" font-size="8" fill="#757575">Analytics (OLAP)</text>

  <!-- DLQ -->
  <rect x="480" y="615" width="200" height="42" rx="6" fill="#37474F" stroke="#263238" stroke-width="1.5" filter="url(#sh)"/>
  <text x="580" y="633" text-anchor="middle" font-size="11" font-weight="600" fill="#ECEFF1">Dead Letter Queue</text>
  <text x="580" y="649" text-anchor="middle" font-size="8" fill="#B0BEC5">Failed after max retries → inspect + replay</text>

  <!-- User Prefs DB -->
  <path d="M730,620 L730,648 C730,660 880,660 880,648 L880,620" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="805" cy="620" rx="75" ry="9" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="805" cy="620" rx="75" ry="9" fill="#283593" opacity="0.1"/>
  <text x="805" y="638" text-anchor="middle" font-size="10" font-weight="600" fill="#1A237E">PostgreSQL</text>
  <text x="805" y="652" text-anchor="middle" font-size="8" fill="#757575">User prefs | Templates | Schedules</text>

  <!-- ═══ LEGEND ═══ -->
  <rect x="40" y="680" width="1020" height="35" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="56" y="702" font-size="10" font-weight="700" fill="#757575">Legend:</text>
  <rect x="110" y="693" width="18" height="12" rx="3" fill="#BBDEFB" stroke="#1976D2" stroke-width="1"/>
  <text x="133" y="703" font-size="9" fill="#757575">Producer</text>
  <rect x="180" y="693" width="18" height="12" rx="3" fill="#C8E6C9" stroke="#388E3C" stroke-width="1"/>
  <text x="203" y="703" font-size="9" fill="#757575">Service</text>
  <rect x="248" y="693" width="18" height="12" rx="3" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1"/>
  <text x="271" y="703" font-size="9" fill="#757575">P0 Queue</text>
  <rect x="320" y="693" width="18" height="12" rx="3" fill="#FFE0B2" stroke="#F57C00" stroke-width="1"/>
  <text x="343" y="703" font-size="9" fill="#757575">P1 Queue</text>
  <rect x="390" y="693" width="18" height="12" rx="3" fill="#FFF9C4" stroke="#F9A825" stroke-width="1"/>
  <text x="413" y="703" font-size="9" fill="#757575">P2 Queue</text>
  <rect x="458" y="693" width="18" height="12" rx="3" fill="#E8EAF6" stroke="#546E7A" stroke-width="1"/>
  <text x="481" y="703" font-size="9" fill="#757575">P3 Queue</text>
  <rect x="528" y="693" width="18" height="12" rx="3" fill="#E1BEE7" stroke="#7B1FA2" stroke-width="1"/>
  <text x="551" y="703" font-size="9" fill="#757575">External</text>
  <ellipse cx="610" cy="699" rx="10" ry="6" fill="#E8EAF6" stroke="#283593" stroke-width="1"/>
  <text x="626" y="703" font-size="9" fill="#757575">Database</text>
  <rect x="680" y="693" width="18" height="12" rx="3" fill="#37474F" stroke="#263238" stroke-width="1"/>
  <text x="703" y="703" font-size="9" fill="#757575">DLQ</text>
  <line x1="740" y1="699" x2="765" y2="699" stroke="#546E7A" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="772" y="703" font-size="9" fill="#757575">Sync flow</text>
  <line x1="830" y1="699" x2="855" y2="699" stroke="#388E3C" stroke-width="1.5" marker-end="url(#ag)"/>
  <text x="862" y="703" font-size="9" fill="#757575">Delivery</text>
  <line x1="910" y1="699" x2="935" y2="699" stroke="#D32F2F" stroke-width="1.5" marker-end="url(#ar)"/>
  <text x="942" y="703" font-size="9" fill="#757575">Cache/Dedup</text>
</svg>
</div>

---

## 6. Backend Services Explained

### Notification API Gateway
The single entry point for all notification requests. Validates the payload schema (channel, recipient, template_id, priority), checks the idempotency key in Redis (reject if seen within 24h), enforces API-level rate limits per producer service (prevents a buggy microservice from flooding the system), enriches the request with user preferences (quiet hours, channel opt-outs), and renders the notification body from the template engine. If the user has push disabled, the API immediately routes to the fallback channel (email/in-app) without hitting the queue. Stateless, horizontally scaled behind an L7 load balancer.

### Template Engine
Maintains a library of notification templates with i18n support (50+ locales). Templates use variable substitution (`{{order_id}}`, `{{driver_name}}`) and channel-specific formatting: push templates are limited to 4KB (APNs limit), email templates include HTML/plaintext variants, SMS templates are capped at 160 characters with URL shortening. Templates are versioned and cached in Redis — a template update propagates to all instances within seconds via pub/sub invalidation. Pre-compilation avoids runtime template parsing overhead.

### Priority Router
Examines the notification type and maps it to a priority level: P0 (OTP, security alerts, 2FA), P1 (order confirmations, payment receipts, delivery updates), P2 (likes, comments, friend requests), P3 (marketing, digests, recommendations). The router also handles scheduling: if a notification is marked "send at 9 AM user's local time," it calculates the delay and publishes to a delayed-execution topic (Kafka with timestamp-based consumption). For immediate notifications, it publishes directly to the appropriate priority topic.

### Channel Workers (Push, SMS, Email, In-App, Webhook)
Each channel has an independent worker pool that subscribes to all four priority topics but with weighted consumption: P0 messages are always consumed first (Kafka consumer priority via separate consumer groups with lag-based autoscaling). Each worker handles the specifics of its channel: the Push Worker maintains persistent HTTP/2 connections to APNs and FCM, batching up to 1,000 notifications per HTTP/2 stream. The SMS Worker manages provider failover (primary: Twilio, fallback: Vonage) with per-provider rate limiting. The Email Worker batches up to 50 recipients per SES API call. Before sending, each worker performs a final dedup check against the delivery log.

### Delivery Tracker
Receives delivery callbacks from external providers (APNs delivery receipts, Twilio status callbacks, SES bounce/complaint notifications) and updates the notification status in Cassandra. Feeds real-time delivery metrics to ClickHouse for analytics dashboards (delivery rate by channel, by provider, by geography). Detects systematic failures (e.g., APNs returning errors for 50%+ of messages) and triggers circuit breakers.

### Dead Letter Queue (DLQ)
Messages that fail after maximum retries (e.g., 5 attempts with exponential backoff) are routed to the DLQ rather than being dropped. An operations team monitors the DLQ, inspects failure reasons, and can replay messages after the root cause is fixed. The DLQ is also used for messages that fail schema validation or reference non-existent users — these are logged for debugging but never retried automatically.

---

## 7. Architecture Flow — Maria's Food Delivery Notification

A food delivery app sends an "order ready for pickup" notification to **Maria** in Sao Paulo, Brazil. Her phone is on Android (FCM), she has push enabled, quiet hours set to 22:00-08:00 (local BRT timezone), and she prefers Portuguese.

### Phase 1 — High-Priority Push Notification (P1 Transactional)

**T+0ms:** The Order Service publishes a notification request to the Notification API:
```text
POST /v1/notifications
{
  "user_id": "u_789012",
  "type": "ORDER_READY",
  "priority": "P1",
  "template_id": "order_ready_v3",
  "variables": {"restaurant": "Burger Palace", "order_id": "ORD-4521"},
  "channels": ["push", "sms"],
  "idempotency_key": "ord-4521-ready-notif"
}
```

**T+2ms:** API Gateway checks Redis for idempotency key `ord-4521-ready-notif` — not found (first attempt). Checks user preferences: push is enabled, current time in BRT is 14:30 (outside quiet hours). Rate limit check: Maria has received 2 push notifications this hour (limit is 10/hour for P1) — allowed.

**T+5ms:** Template Engine renders the Portuguese template: "Seu pedido no Burger Palace esta pronto! Pedido #ORD-4521". Body is 89 bytes — well within APNs/FCM limits.

**T+8ms:** Priority Router publishes to Kafka topic `notifications.p1` with partition key `hash(u_789012) mod 64 = partition 17`. This ensures all of Maria's notifications are processed in order.

**T+12ms:** P1 Push Worker consumes the message (consumer lag for P1 is typically <50ms). Performs final dedup check: queries Cassandra delivery log for `notification_id` — not found. Proceeds.

**T+15ms:** Push Worker sends to FCM via HTTP/2:
```text
POST https://fcm.googleapis.com/v1/projects/foodapp/messages:send
{
  "message": {
    "token": "maria_fcm_device_token_abc123",
    "notification": {"title": "Pedido Pronto!", "body": "Seu pedido no Burger Palace..."},
    "android": {"collapse_key": "order_ready_ORD-4521", "priority": "high"}
  }
}
```

**T+180ms:** FCM returns `200 OK` with message ID. Push Worker writes delivery status to Cassandra: `{notification_id, status: "sent", provider: "fcm", sent_at: now()}`.

**T+2.1s:** FCM delivers to Maria's phone. FCM sends delivery receipt callback. Delivery Tracker updates status to "delivered."

```text
Total: Order Service → Maria's phone = 2.1 seconds (P1, well under 10s SLA)
```

### Phase 2 — Email Batch Delivery (P3 Marketing)

**T+0:** Marketing Engine triggers a campaign: "Weekend special: 30% off orders over R$50" to 5 million users in Brazil.

**T+1ms:** API Gateway receives the batch request. Rate limiter applies: marketing emails are capped at 500K/hour per campaign to avoid overwhelming SES and triggering spam filters. The 5M messages are spread over 10 hours.

**T+10ms:** Priority Router publishes all 5M messages to Kafka topic `notifications.p3`. Because P3 has the lowest consumer priority, these will only be processed when P0/P1/P2 queues are drained.

**T+30s to T+10h:** Email Workers consume from P3 at a controlled rate. Each worker batches 50 recipients per SES API call. SES rate limit: 100 calls/sec = 5,000 emails/sec. Total throughput: 500K/hour as designed.

**Key insight:** Maria's P1 order notification at T+0 was delivered in 2.1 seconds. The 5M marketing emails do NOT interfere because they're in a completely separate priority lane (P3) with separate consumer groups.

### Phase 3 — SMS Fallback When Push Fails

**T+0ms:** Auth Service sends OTP to Maria (P0 critical):
```text
{"user_id": "u_789012", "type": "OTP", "priority": "P0", "template_id": "otp_v2",
 "variables": {"code": "847291"}, "channels": ["push", "sms"], "fallback_chain": true}
```

**T+8ms:** P0 Push Worker sends to FCM. But Maria's phone is turned off (airplane mode for a flight).

**T+5.2s:** FCM returns `200 OK` (accepted) but no delivery receipt arrives within the 5-second timeout. Push Worker marks status as `sent_unconfirmed`.

**T+5.3s:** Fallback logic triggers: since `fallback_chain: true` and push delivery is unconfirmed after 5s, the system escalates to SMS.

**T+5.4s:** SMS Worker sends via Twilio:
```text
POST https://api.twilio.com/2010-04-01/Accounts/.../Messages.json
Body: "847291 e seu codigo de verificacao. Nao compartilhe."
To: +5511987654321
```

**T+6.8s:** Twilio delivers SMS via carrier network. Maria (who has SMS available despite airplane mode in some carriers, or when she lands) receives the OTP.

```text
Total with fallback: 6.8 seconds (still under P0 SLA of <10s including fallback)
```

---

## 8. Failure & Recovery Scenarios

### Push Gateway (APNs/FCM) Down

**Scenario:** FCM returns 503 for all requests for 15 minutes (Google infrastructure issue).

**Detection:** Push Worker circuit breaker trips after 10 consecutive failures in 5 seconds. Metrics alert fires.

**Impact:** All push notifications queue up in Kafka. No data loss — Kafka retains messages for 24 hours.

**Recovery:**
1. Circuit breaker enters half-open state every 30 seconds, sending a single probe request.
2. P0/P1 notifications with `fallback_chain: true` immediately fall back to SMS/email after 3 failed push attempts (no waiting for FCM recovery).
3. P2/P3 notifications accumulate in Kafka. When FCM recovers, consumers drain the backlog at maximum rate.
4. Dedup layer ensures that messages retried during the outage are not sent twice once service resumes.

**Key metric:** During a 15-minute FCM outage, <0.1% of P0 notifications are delayed >10s (they fall back to SMS within 5s).

### SMS Provider Fails (Twilio Outage)

**Scenario:** Twilio API returns 500 errors. Primary SMS path is broken.

**Recovery:**
1. SMS Worker detects Twilio failures (circuit breaker trips after 5 failures in 2 seconds).
2. Automatic failover to secondary provider (Vonage/AWS SNS). Provider selection is configurable per region.
3. If all SMS providers are down, P0 messages (OTP) fall back to email with a disclaimer: "Use this code within 2 minutes."
4. P3 marketing SMS are paused entirely (cost savings during outage — no point sending marketing to a black hole).

### Queue Backpressure (Kafka Consumer Lag Spike)

**Scenario:** A flash sale triggers 10x normal notification volume. P2/P3 consumer lag grows to millions.

**Recovery:**
1. Autoscaler detects consumer lag >100K and spins up additional P2/P3 consumer instances (Kubernetes HPA based on Kafka lag metric).
2. P0/P1 consumers are over-provisioned by 5x — they never experience lag even during spikes.
3. If P3 lag exceeds 50M messages (>4 hours of backlog), the system activates "marketing throttle" — dropping oldest P3 messages that are >2 hours stale (marketing notifications lose value rapidly).
4. Kafka retention guarantees no P0/P1 message is ever dropped.

### Dedup Service Failure (Redis Cluster Partial Failure)

**Scenario:** 2 of 6 Redis nodes in the dedup cluster fail. ~33% of idempotency checks cannot be performed.

**Recovery:**
1. Redis Cluster redistributes slots to surviving nodes (automatic within 15 seconds for Redis Cluster).
2. During the gap, the API layer's dedup check returns "unknown" for affected keys.
3. Fallback dedup: the system proceeds with a warning flag, and the channel worker performs the secondary dedup check against Cassandra delivery log before sending.
4. Post-recovery: no duplicates were sent because the Cassandra-level dedup caught them. The multi-layer approach means Redis failure does not cause duplicate sends.

---

## 9. Data Model

```text
/* ━━━ PostgreSQL: Notification Templates ━━━ */

CREATE TABLE notification_templates (
    template_id     VARCHAR(64)   PRIMARY KEY,
    version         INT           NOT NULL DEFAULT 1,
    channel         VARCHAR(16)   NOT NULL,  -- push, sms, email, in_app
    locale          VARCHAR(10)   NOT NULL,  -- en-US, pt-BR, es-MX, etc.
    title_template  TEXT,                     -- "Your order from {{restaurant}} is ready!"
    body_template   TEXT          NOT NULL,   -- "Order #{{order_id}} is ready for pickup"
    metadata        JSONB,                    -- {max_length: 160, supports_html: false}
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE (template_id, version, channel, locale)
);

/* ━━━ PostgreSQL: User Preferences ━━━ */

CREATE TABLE user_preferences (
    user_id         BIGINT        PRIMARY KEY,
    push_enabled    BOOLEAN       DEFAULT TRUE,
    sms_enabled     BOOLEAN       DEFAULT TRUE,
    email_enabled   BOOLEAN       DEFAULT TRUE,
    quiet_start     TIME,                     -- e.g., 22:00
    quiet_end       TIME,                     -- e.g., 08:00
    timezone        VARCHAR(64)   DEFAULT 'UTC',
    locale          VARCHAR(10)   DEFAULT 'en-US',
    rate_limits     JSONB         DEFAULT '{"push_per_hour": 10, "sms_per_day": 3, "email_per_day": 20}',
    channel_priority JSONB        DEFAULT '["push", "sms", "email"]',  -- fallback order
    unsubscribed    JSONB         DEFAULT '[]',  -- ["marketing", "social"]
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_user_prefs_timezone ON user_preferences (timezone);

/* ━━━ Cassandra: Delivery Log (Write-Optimized, Time-Series) ━━━ */

CREATE TABLE delivery_log (
    user_id         BIGINT,
    notification_id UUID,
    channel         TEXT,           -- push, sms, email
    priority        TEXT,           -- P0, P1, P2, P3
    status          TEXT,           -- queued, sent, delivered, read, failed, bounced
    provider        TEXT,           -- fcm, apns, twilio, ses
    provider_msg_id TEXT,           -- external reference for tracking
    template_id     TEXT,
    created_at      TIMESTAMP,
    sent_at         TIMESTAMP,
    delivered_at    TIMESTAMP,
    failed_reason   TEXT,           -- null if successful
    retry_count     INT,
    PRIMARY KEY ((user_id), created_at, notification_id)
) WITH CLUSTERING ORDER BY (created_at DESC)
  AND default_time_to_live = 7776000;  -- 90-day TTL

CREATE TABLE delivery_dedup (
    notification_id UUID PRIMARY KEY,
    created_at      TIMESTAMP,
) WITH default_time_to_live = 86400;  -- 24h TTL for dedup window

/* ━━━ ClickHouse: Analytics (OLAP, Columnar) ━━━ */

CREATE TABLE notification_analytics (
    notification_id UUID,
    user_id         UInt64,
    channel         LowCardinality(String),
    priority        LowCardinality(String),
    template_id     LowCardinality(String),
    status          LowCardinality(String),
    provider        LowCardinality(String),
    country         LowCardinality(String),
    created_at      DateTime,
    delivered_at    Nullable(DateTime),
    latency_ms      UInt32          -- end-to-end delivery latency
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (channel, priority, created_at);
```

---

## 10. Algorithms Under the Hood

### Deduplication (Bloom Filter + Exact Check)

```text
/* Two-phase dedup: probabilistic fast-path + exact slow-path */

function is_duplicate(notification_id, idempotency_key):
    // Phase 1: Bloom filter (in-memory, O(1), 1% false positive rate)
    if bloom_filter.might_contain(idempotency_key):
        // Phase 2: Exact check in Redis (only when bloom says "maybe")
        if redis.EXISTS("dedup:" + idempotency_key):
            return TRUE   // confirmed duplicate — reject
        // Bloom false positive — not actually a duplicate
    
    // Not a duplicate — record it
    bloom_filter.add(idempotency_key)
    redis.SET("dedup:" + idempotency_key, notification_id, EX=86400)  // 24h TTL
    return FALSE

/* Why bloom filter first?
   - 1B notifications/day = 12K/sec Redis queries for dedup alone
   - Bloom filter eliminates 99% of Redis lookups (only new messages hit Redis)
   - At 1B entries/day with 1% FPR: bloom filter size = ~1.2 GB RAM
   - Rotated daily (swap with fresh filter at midnight UTC)
*/
```

### Priority Queue Scheduling

```text
/* Weighted consumption across priority topics */

function consume_next_batch(worker):
    // P0 always checked first — starvation-free for critical messages
    batch = kafka.poll("notifications.p0", timeout=10ms, max=100)
    if batch.size > 0:
        return batch   // Always serve P0 first
    
    // P1 checked next — weighted 4x over P2
    batch = kafka.poll("notifications.p1", timeout=10ms, max=100)
    if batch.size > 0:
        return batch
    
    // P2 and P3 use weighted round-robin
    if worker.round_robin_counter % 5 < 4:  // 80% of cycles go to P2
        batch = kafka.poll("notifications.p2", timeout=50ms, max=200)
    else:                                     // 20% of cycles go to P3
        batch = kafka.poll("notifications.p3", timeout=50ms, max=500)
    
    worker.round_robin_counter += 1
    return batch

/* Alternative: Separate consumer groups per priority
   P0: 4 dedicated consumers (always idle, instant drain)
   P1: 8 consumers (autoscale 4-16 based on lag)
   P2: 16 consumers (autoscale 8-32)
   P3: 8 consumers (autoscale 4-64, burst during marketing campaigns)
   This is the preferred approach — simpler and truly isolated.
*/
```

### Rate Limiting Per User (Sliding Window Counter)

```text
/* Sliding window rate limiter using Redis sorted sets */

function check_rate_limit(user_id, channel, priority):
    // P0 (critical) is NEVER rate-limited
    if priority == "P0":
        return ALLOW
    
    key = "ratelimit:" + user_id + ":" + channel
    now = current_timestamp_ms()
    window = get_window_duration(channel)  // push=1hour, sms=1day, email=1day
    window_start = now - window
    
    // Remove expired entries
    redis.ZREMRANGEBYSCORE(key, 0, window_start)
    
    // Count entries in current window
    count = redis.ZCARD(key)
    limit = get_user_limit(user_id, channel)  // from user_preferences table
    
    if count >= limit:
        if priority == "P1":
            // Transactional: queue for next window (don't drop)
            schedule_for_next_window(notification)
            return DEFER
        else:
            // P2/P3: drop silently (user won't miss marketing)
            return DROP
    
    // Under limit — allow and record
    redis.ZADD(key, now, notification_id)
    redis.EXPIRE(key, window / 1000)  // TTL = window duration
    return ALLOW

/* Memory calculation:
   Active users/day: 100M
   Keys per user: 3 (push, sms, email)
   Sorted set per key: ~20 entries × 16 bytes = 320 bytes
   Total: 100M × 3 × 320B = ~96 GB Redis
   → Shard across 12 Redis nodes (8 GB per node)
*/
```

### Retry with Exponential Backoff + Jitter

```text
/* Retry strategy for failed deliveries */

MAX_RETRIES = 5
BASE_DELAY_MS = 1000  // 1 second

function send_with_retry(notification, channel_worker):
    for attempt in range(1, MAX_RETRIES + 1):
        result = channel_worker.send(notification)
        
        if result.success:
            update_status(notification.id, "delivered")
            return SUCCESS
        
        if result.error_type == "PERMANENT":
            // Invalid token, unsubscribed, blocked — don't retry
            update_status(notification.id, "failed_permanent", result.error)
            move_to_dlq(notification, reason=result.error)
            return PERMANENT_FAILURE
        
        // Transient error — retry with exponential backoff + jitter
        delay = BASE_DELAY_MS * (2 ^ (attempt - 1))  // 1s, 2s, 4s, 8s, 16s
        jitter = random(0, delay * 0.3)               // ±30% jitter
        actual_delay = delay + jitter
        
        log("Retry {attempt}/{MAX_RETRIES} for {notification.id} in {actual_delay}ms")
        sleep(actual_delay)
    
    // All retries exhausted
    update_status(notification.id, "failed_exhausted")
    move_to_dlq(notification, reason="max_retries_exceeded")
    
    // Trigger fallback channel if configured
    if notification.fallback_chain:
        next_channel = get_next_fallback(notification)
        if next_channel:
            re_enqueue(notification, channel=next_channel)
    
    return FAILURE

/* Retry timeline for a transient FCM error:
   Attempt 1: immediate         → fails
   Attempt 2: +1.0-1.3s delay   → fails
   Attempt 3: +2.0-2.6s delay   → fails  
   Attempt 4: +4.0-5.2s delay   → fails
   Attempt 5: +8.0-10.4s delay  → fails → DLQ + fallback to SMS
   Total time before DLQ: ~15-20 seconds
*/
```

---

## 11. Scaling Considerations

| Challenge | Solution | Numbers |
|---|---|---|
| Flash sale spike (10x traffic) | Kafka absorbs burst; autoscale consumers based on lag | P3 consumers scale 8 to 64 pods in 90 seconds |
| SMS cost explosion | Per-user rate limiting + priority-based throttling | Cap at $200K/day SMS spend; defer P3 SMS to email |
| Global latency (users in 190+ countries) | Regional Kafka clusters + geo-routed workers | Push workers in us-east, eu-west, ap-southeast |
| Provider outage (APNs/FCM/Twilio) | Circuit breaker + multi-provider failover | Failover in <5s; no manual intervention needed |
| Hot partition (celebrity with 100M followers) | Fan-out limiter: batch celebrity notifications, shard by recipient | Max 10K messages per Kafka partition per second |
| Template update propagation | Redis pub/sub invalidation + versioned templates | All workers get new template in <2 seconds |
| Quiet hours across timezones | Scheduler service with per-user timezone offset | Delayed publish to Kafka with timestamp-based consumption |
| Delivery log growth (63 TB/90 days) | Cassandra with TTL + tiered storage (hot/warm/cold) | Auto-expire after 90 days; archive to S3 for compliance |
| Monitoring at 1B/day | ClickHouse real-time dashboards + anomaly detection | Alert if delivery rate drops below 99.5% for any channel |
| Dedup bloom filter memory | Daily rotation + Redis exact-match fallback | 1.2 GB RAM per day; swap at midnight UTC |

---

## 12. Quick Recall

| Question | Answer |
|---|---|
| Why priority queues? | OTP must never wait behind 10M marketing emails. P0 has dedicated consumers that are always idle. |
| Why channel isolation? | APNs down does NOT affect email. Separate worker pools, separate failure domains. |
| Dedup strategy? | 3 layers: bloom filter + Redis at API, Cassandra check at worker, collapse_key at provider. |
| Why rate limit per-user? | SMS costs $0.01/msg. 100M uncontrolled = $1M/day. Also prevents notification fatigue → uninstalls. |
| Why Kafka not RabbitMQ? | 1B/day throughput + replay capability + consumer groups. RabbitMQ struggles above 50K/sec. |
| DLQ purpose? | Failed messages after 5 retries go here. Nothing is lost. Ops can inspect + replay after fix. |
| Retry strategy? | Exponential backoff with 30% jitter. Prevents thundering herd on provider recovery. |
| Why Cassandra for delivery log? | Write-optimized (1B writes/day), time-series partitioning, built-in TTL for auto-expiry. |
| How to handle quiet hours? | Scheduler delays publication until user's quiet hours end. Uses timezone from user_preferences. |
| Fallback chain? | push fails → SMS → email. Each channel independently retried before escalating. |
| Template vs pre-render? | Templates: store O(templates × locales) not O(users × templates). Render at send time. |
| How to prevent fan-out bomb? | Celebrity notifications batched + sharded by recipient. Max 10K/partition/sec enforced. |
