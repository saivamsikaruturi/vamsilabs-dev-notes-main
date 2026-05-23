# Ticket Booking System (Ticketmaster / BookMyShow)

---

## 1. Real Incident

!!! danger "Ticketmaster Taylor Swift Eras Tour Presale, November 2022"
    **14 million users** simultaneously flooded Ticketmaster for Taylor Swift's Eras Tour presale — the largest single-event traffic spike in ticketing history. The system catastrophically failed across multiple layers:

    - **Seat-lock mechanism collapsed:** The optimistic locking strategy generated massive retry storms under 6.6:1 contention ratios. Users who "successfully" selected seats received cancellation emails hours later due to double-sold inventory.
    - **Virtual queue overflow:** The waiting room was sized for 1.5M users max. When 14M arrived, the queue infrastructure itself became the bottleneck — users saw infinite spinners, blank seat maps, and phantom "available" seats that were already locked.
    - **Cascading payment failures:** Downstream payment gateways were hammered with duplicate authorization requests from retry logic, triggering circuit breakers that rejected legitimate transactions.
    - **Business impact:** Congressional hearing, $300M+ in lost revenue, 2.4M tickets sold but estimated 10M+ purchase attempts failed. Ticketmaster issued public apology and refunded fees.

    **The lesson:** In flash-sale systems, the queue IS the product. If you cannot control inflow at the edge, every downstream service will collapse under amplified load. Seat locking must be atomic and non-blocking — database row locks are fundamentally incompatible with 333K concurrent writes/second.

---

## 2. System Design Concepts Used

`virtual queue (waiting room)` `Redis SETNX atomic locking` `TTL-based auto-release` `token bucket rate limiting` `state machine` `strong consistency` `optimistic concurrency control` `distributed caching` `circuit breaker` `compensating transactions` `event-driven architecture` `server-sent events (SSE)` `ACID transactions` `idempotent payment processing` `bot protection (WAF + CAPTCHA + device fingerprinting)` `connection pooling` `backpressure` `graceful degradation`

---

## 3. Functional Requirements

1. **Browse Events** — Users can search and view upcoming events with venue details, pricing tiers, and seat maps rendered in real-time showing current availability.
2. **Interactive Seat Selection** — Users select specific seats from a live seat map; the system reflects real-time availability (seats disappear as they are locked by others).
3. **Temporary Seat Hold** — Once a user selects a seat, it is exclusively held for a configurable duration (10 minutes) during which no other user can select it.
4. **Payment Processing** — Integrate with external payment gateways (Stripe, Adyen) supporting pre-authorization, capture, and timeout-based voiding.
5. **Booking Confirmation** — Upon successful payment, generate a confirmed booking with a unique e-ticket (QR code), send confirmation via email and push notification.
6. **Waitlist / Notify Me** — Users can join a waitlist for sold-out events; they receive priority access if seats are released (cancellations, failed payments).
7. **Refund & Cancellation** — Support full and partial refunds with configurable refund windows (e.g., full refund up to 48h before event).
8. **Queue Position Visibility** — During flash sales, users see their real-time queue position via SSE with estimated wait time.
9. **Multi-seat Atomic Booking** — Groups can book multiple adjacent seats atomically (all-or-nothing).
10. **Admin Event Management** — Event organizers can create events, configure pricing tiers, set sale start times, and view real-time analytics.

---

## 4. Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Concurrency** | 10M simultaneous users during flash sales | Taylor Swift-level demand; system must not degrade |
| **Latency (seat lock)** | < 50ms p99 for SETNX operation | Users expect instant feedback on seat selection |
| **Latency (end-to-end)** | < 5s from seat selection to payment page | Longer delays cause user abandonment and retry storms |
| **Consistency** | Zero double-bookings (linearizable for seat state) | Cannot oversell even one seat — financial and legal liability |
| **Availability** | 99.99% during sale windows (< 52s downtime/year) | Revenue directly tied to uptime during concentrated sale periods |
| **Throughput** | 333K seat selection attempts/sec sustained | 10M users / 30s average think time = peak write throughput |
| **Durability** | Zero confirmed booking loss | Financial transactions must survive any single-node failure |
| **Scalability** | Horizontal scaling to 10x baseline within 5 minutes | Flash sale traffic is bursty; auto-scaling must be aggressive |
| **Fairness** | FIFO queue ordering with bot mitigation | Prevent scalpers from monopolizing inventory |
| **Idempotency** | All payment operations must be idempotent | Network retries must not cause double-charges |

---

## 5. Capacity Estimation

```
=== FLASH SALE SCENARIO: TAYLOR SWIFT ERAS TOUR ===

Peak Concurrent Users:          10,000,000 (10M)
Venue Capacity:                 50,000 seats
Sale Window:                    30 minutes (concentrated in first 5 min)

--- TRAFFIC ---
Seat Selection Attempts/sec:    10M users / 30s avg think time = 333,333/sec
Contention Ratio:               333K attempts / 50K seats = 6.6:1
                                (6.6 users competing for each seat simultaneously)

--- QUEUE ---
Queue Admission Rate:           50,000 users per batch (every 30-60s)
Queue Drain Time:               10M / 50K per batch = 200 batches ≈ 100-200 min
SSE Connections (peak):         10M concurrent long-lived connections
SSE Bandwidth:                  10M × 100 bytes/update × 1 update/5s = 200 MB/s

--- REDIS (SEAT LOCKS) ---
SETNX Operations/sec:           333,000 (peak)
Key Count:                      50,000 (one per seat)
Memory per Key:                 ~150 bytes (key + value + TTL metadata)
Total Redis Memory:             50K × 150B = 7.5 MB (trivial)
Redis Cluster:                  3 masters + 3 replicas (for HA, not capacity)

--- PAYMENT ---
Payment TPS:                    ~5,000/sec (funnel narrows: only lock-holders pay)
Avg Payment Latency:            2-5s (external gateway)
Payment Timeout:                10 minutes (matches seat TTL)
Pre-auth Hold Amount:           $50-$500 per ticket

--- DATABASE (PostgreSQL) ---
Confirmed Booking Writes/sec:   ~3,000/sec (successful payments)
Read QPS (event browse):        50,000/sec (cacheable, served from CDN/Redis)
Storage per booking:            ~2 KB
Total storage (1 event):        50K × 2KB = 100 MB

--- NETWORK ---
Inbound Bandwidth (peak):       10M × 2KB avg request = 20 GB/s
CDN Offload:                    95% of reads (seat map tiles, static assets)
Origin Traffic:                 ~1 GB/s after CDN

--- INFRASTRUCTURE ---
API Servers:                    200 pods (50K RPS each)
Redis Nodes:                    6 (3 master + 3 replica)
PostgreSQL:                     Primary + 2 sync replicas
Load Balancers:                 3 (active-active, anycast)
```

---

## 6. "Why X, Not Y?" Tradeoff Analysis

### Decision 1: Why Redis SETNX, Not Database Row Locks for Seat Locking?

| Factor | Redis SETNX | Database Row Locks (SELECT FOR UPDATE) |
|---|---|---|
| **Throughput** | 333K ops/sec on single node | ~5K locks/sec before connection exhaustion |
| **Latency** | < 1ms (in-memory, single-threaded) | 10-50ms (disk I/O, lock wait queues) |
| **Deadlocks** | Impossible (single-key atomic op) | Common under high contention (6.6:1 ratio) |
| **Auto-release** | Built-in TTL (10 min expiry) | Requires explicit ROLLBACK or connection timeout |
| **Connection cost** | Single persistent connection per app server | One DB connection held per locked seat |
| **Failure mode** | Key expires → seat released | Connection leak → seat locked indefinitely |

**Verdict:** At 333K/sec with 6.6:1 contention, database locks cause exponential lock-wait chains and connection pool exhaustion within seconds. Redis SETNX is O(1), atomic, and self-healing via TTL.

---

### Decision 2: Why Virtual Queue, Not Direct Access During Flash Sales?

| Factor | Virtual Queue | Direct Access |
|---|---|---|
| **Load control** | Admit 50K at a time; backpressure at edge | 10M hit all services simultaneously |
| **User experience** | Clear position + ETA; predictable wait | Random timeouts, 502s, blank pages |
| **Fairness** | FIFO ordering; first-come-first-served | Fastest clicker wins; bots dominate |
| **Infrastructure cost** | Size for 50K concurrent; queue is cheap | Size for 10M concurrent; 200x more servers |
| **Bot defense** | CAPTCHA at queue entry; one checkpoint | Must defend every endpoint; larger attack surface |
| **Cascading failure** | Impossible (queue absorbs shock) | One slow service cascades to all |

**Verdict:** Without a queue, 10M simultaneous requests overwhelm every downstream service. The queue converts an uncontrolled thundering herd into a controlled, metered flow. It is architecturally equivalent to a circuit breaker at the system boundary.

---

### Decision 3: Why PostgreSQL for Bookings, Not NoSQL?

| Factor | PostgreSQL (ACID) | NoSQL (DynamoDB/Cassandra) |
|---|---|---|
| **Consistency** | Serializable transactions; guaranteed no anomalies | Eventual consistency; requires application-level conflict resolution |
| **Financial compliance** | ACID required for payment records (PCI-DSS, SOX) | Not inherently compliant; requires additional layers |
| **Complex queries** | JOIN across events, users, bookings, refunds | Denormalized; every query pattern needs a separate table |
| **Refund logic** | Single transaction: update booking + create refund + adjust balance | Multi-step saga with compensation; partial failure is complex |
| **Write volume** | ~3K confirmed bookings/sec (after queue + lock filter) | Designed for 100K+ writes/sec (overkill here) |
| **Schema evolution** | ALTER TABLE with constraints; strong typing | Schema-less; data corruption harder to detect |

**Verdict:** The write volume after the queue + Redis filter is modest (~3K/sec). PostgreSQL provides the ACID guarantees required for financial transactions without the operational complexity of distributed consensus. NoSQL would be appropriate for the event catalog (high-read, low-write), but not for the booking ledger.

---

### Decision 4: Why TTL-Based Auto-Release, Not Manual Unlock?

| Factor | TTL Auto-Release | Manual Unlock |
|---|---|---|
| **Abandoned carts** | Seat auto-releases after 10 min; no intervention needed | Requires "are you still there?" polling + explicit release |
| **Crash recovery** | If user's browser crashes, TTL still fires | Lock held forever if client never sends unlock |
| **Complexity** | Zero application code for release logic | Need heartbeat mechanism, timeout detection, cleanup jobs |
| **Consistency** | Guaranteed: Redis evicts key at TTL | Race conditions: what if unlock message is lost? |
| **Scalability** | Redis handles millions of TTL expirations natively | Manual unlock requires tracking all active holds + sweep |

**Verdict:** Manual unlock introduces a class of bugs (lost unlock messages, zombie locks, crash-before-unlock) that TTL eliminates by design. The 10-minute TTL matches the payment window, creating a self-healing system where abandoned seats automatically return to inventory.

---

## 7. High-Level Architecture

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
      <polygon points="0 0,10 3.5,0 7" fill="#2E7D32"/>
    </marker>
    <filter id="sh">
      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="1100" height="750" fill="#FAFAFA" rx="8"/>

  <!-- Title -->
  <text x="550" y="30" text-anchor="middle" font-size="16" font-weight="800" fill="#212121">Ticket Booking System — High-Level Architecture</text>
  <text x="550" y="50" text-anchor="middle" font-size="11" fill="#757575">10M concurrent users | 333K seat attempts/sec | Zero double-booking | Virtual queue admission control</text>

  <!-- Layer 1: Client Layer -->
  <rect x="30" y="65" width="1040" height="80" rx="8" fill="none" stroke="#90A4AE" stroke-width="1" stroke-dasharray="6,3"/>
  <text x="50" y="82" font-size="9" font-weight="700" fill="#607D8B">CLIENT LAYER</text>

  <!-- Users -->
  <rect x="60" y="95" width="150" height="40" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="135" y="113" text-anchor="middle" font-size="11" font-weight="700" fill="#0D47A1">10M Users</text>
  <text x="135" y="127" text-anchor="middle" font-size="8" fill="#546E7A">Web + Mobile + Bots</text>

  <!-- CDN/WAF -->
  <rect x="280" y="95" width="170" height="40" rx="6" fill="#B2EBF2" stroke="#00838F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="365" y="113" text-anchor="middle" font-size="11" font-weight="600" fill="#006064">CDN + WAF</text>
  <text x="365" y="127" text-anchor="middle" font-size="8" fill="#546E7A">Static assets | Bot filter | DDoS</text>
  <line x1="210" y1="115" x2="280" y2="115" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- CAPTCHA -->
  <rect x="520" y="95" width="140" height="40" rx="6" fill="#F3E5F5" stroke="#7B1FA2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="590" y="113" text-anchor="middle" font-size="10" font-weight="600" fill="#4A148C">CAPTCHA + Fingerprint</text>
  <text x="590" y="127" text-anchor="middle" font-size="8" fill="#546E7A">Bot detection layer</text>
  <line x1="450" y1="115" x2="520" y2="115" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- Layer 2: Queue & Rate Limiting -->
  <rect x="30" y="155" width="1040" height="100" rx="8" fill="none" stroke="#F9A825" stroke-width="1.2" stroke-dasharray="6,3"/>
  <text x="50" y="172" font-size="9" font-weight="700" fill="#F57F17">ADMISSION CONTROL</text>

  <!-- Virtual Queue -->
  <rect x="60" y="185" width="320" height="60" rx="6" fill="#FFF9C4" stroke="#F9A825" stroke-width="2" filter="url(#sh)"/>
  <text x="220" y="205" text-anchor="middle" font-size="13" font-weight="700" fill="#F57F17">Virtual Queue (Waiting Room)</text>
  <text x="220" y="222" text-anchor="middle" font-size="9" fill="#546E7A">10M users → admit 50K at a time | FIFO fair ordering</text>
  <text x="220" y="236" text-anchor="middle" font-size="8" fill="#757575">SSE position updates | Token bucket admission</text>
  <line x1="590" y1="135" x2="220" y2="185" stroke="#546E7A" stroke-width="1" marker-end="url(#a)"/>

  <!-- Rate Limiter -->
  <rect x="440" y="185" width="220" height="60" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="550" y="205" text-anchor="middle" font-size="11" font-weight="600" fill="#311B92">Rate Limiter</text>
  <text x="550" y="222" text-anchor="middle" font-size="9" fill="#546E7A">Per-user: 10 req/s | Per-IP: 50 req/s</text>
  <text x="550" y="236" text-anchor="middle" font-size="8" fill="#757575">Token bucket | Sliding window</text>
  <line x1="380" y1="215" x2="440" y2="215" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- SSE -->
  <rect x="720" y="185" width="180" height="60" rx="6" fill="#E1F5FE" stroke="#0277BD" stroke-width="1.5" filter="url(#sh)"/>
  <text x="810" y="205" text-anchor="middle" font-size="11" font-weight="600" fill="#01579B">SSE Gateway</text>
  <text x="810" y="222" text-anchor="middle" font-size="9" fill="#546E7A">Real-time queue position</text>
  <text x="810" y="236" text-anchor="middle" font-size="8" fill="#757575">10M long-lived connections</text>
  <line x1="380" y1="200" x2="720" y2="200" stroke="#0277BD" stroke-width="1" stroke-dasharray="4,2" marker-end="url(#a)"/>

  <!-- Layer 3: Core Services -->
  <rect x="30" y="270" width="1040" height="160" rx="8" fill="none" stroke="#388E3C" stroke-width="1.2" stroke-dasharray="6,3"/>
  <text x="50" y="287" font-size="9" font-weight="700" fill="#2E7D32">CORE SERVICES</text>

  <!-- Booking Service -->
  <rect x="60" y="300" width="280" height="60" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="200" y="320" text-anchor="middle" font-size="13" font-weight="700" fill="#1B5E20">Booking Service</text>
  <text x="200" y="337" text-anchor="middle" font-size="9" fill="#546E7A">Seat selection | Hold | Confirm | Cancel</text>
  <text x="200" y="351" text-anchor="middle" font-size="8" fill="#757575">State machine: QUEUED→SELECTING→HELD→PAYING→CONFIRMED</text>
  <line x1="550" y1="245" x2="200" y2="300" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- Seat Lock Manager (Redis) -->
  <rect x="400" y="300" width="260" height="60" rx="6" fill="#FFCDD2" stroke="#D32F2F" stroke-width="2" filter="url(#sh)"/>
  <text x="530" y="320" text-anchor="middle" font-size="12" font-weight="700" fill="#B71C1C">Seat Lock Manager (Redis)</text>
  <text x="530" y="337" text-anchor="middle" font-size="9" fill="#546E7A">SETNX per seat | TTL = 10 min | O(1)</text>
  <text x="530" y="351" text-anchor="middle" font-size="8" fill="#757575">Atomic: single-threaded, no race conditions</text>
  <line x1="340" y1="330" x2="400" y2="330" stroke="#D32F2F" stroke-width="1.5" marker-end="url(#ar)"/>
  <text x="370" y="322" font-size="7" fill="#D32F2F" font-weight="600">SETNX</text>

  <!-- Payment Service -->
  <rect x="60" y="380" width="220" height="40" rx="6" fill="#B2DFDB" stroke="#00695C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="170" y="398" text-anchor="middle" font-size="11" font-weight="600" fill="#004D40">Payment Service</text>
  <text x="170" y="412" text-anchor="middle" font-size="8" fill="#546E7A">Pre-auth → Capture | Idempotent | Circuit breaker</text>
  <line x1="200" y1="360" x2="170" y2="380" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- TTL Expiry Worker -->
  <rect x="720" y="300" width="200" height="60" rx="6" fill="#FFE0B2" stroke="#F57C00" stroke-width="1.5" filter="url(#sh)"/>
  <text x="820" y="320" text-anchor="middle" font-size="11" font-weight="700" fill="#E65100">TTL Expiry Worker</text>
  <text x="820" y="337" text-anchor="middle" font-size="9" fill="#546E7A">Redis keyspace notifications</text>
  <text x="820" y="351" text-anchor="middle" font-size="8" fill="#757575">Auto-release expired holds → notify waitlist</text>
  <line x1="660" y1="330" x2="720" y2="330" stroke="#F57C00" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- Notification Service -->
  <rect x="720" y="380" width="200" height="40" rx="6" fill="#E8EAF6" stroke="#3F51B5" stroke-width="1.5" filter="url(#sh)"/>
  <text x="820" y="398" text-anchor="middle" font-size="11" font-weight="600" fill="#1A237E">Notification Service</text>
  <text x="820" y="412" text-anchor="middle" font-size="8" fill="#546E7A">Email | Push | SMS | Queue position SSE</text>
  <line x1="820" y1="360" x2="820" y2="380" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- Layer 4: Data Layer -->
  <rect x="30" y="440" width="1040" height="130" rx="8" fill="none" stroke="#283593" stroke-width="1.2" stroke-dasharray="6,3"/>
  <text x="50" y="457" font-size="9" font-weight="700" fill="#283593">DATA LAYER</text>

  <!-- PostgreSQL -->
  <path d="M80,490 L80,540 C80,555 270,555 270,540 L270,490" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="175" cy="490" rx="95" ry="12" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="175" cy="490" rx="95" ry="12" fill="#283593" opacity="0.08"/>
  <text x="175" y="515" text-anchor="middle" font-size="12" font-weight="700" fill="#1A237E">PostgreSQL</text>
  <text x="175" y="530" text-anchor="middle" font-size="9" fill="#546E7A">Bookings | Events | Users | ACID</text>
  <text x="175" y="543" text-anchor="middle" font-size="8" fill="#757575">Primary + 2 sync replicas</text>
  <line x1="170" y1="420" x2="175" y2="478" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- Redis Cluster -->
  <path d="M350,490 L350,540 C350,555 540,555 540,540 L540,490" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5"/>
  <ellipse cx="445" cy="490" rx="95" ry="12" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5"/>
  <ellipse cx="445" cy="490" rx="95" ry="12" fill="#D32F2F" opacity="0.08"/>
  <text x="445" y="515" text-anchor="middle" font-size="12" font-weight="700" fill="#B71C1C">Redis Cluster</text>
  <text x="445" y="530" text-anchor="middle" font-size="9" fill="#546E7A">Seat locks | Queue state | Rate limits</text>
  <text x="445" y="543" text-anchor="middle" font-size="8" fill="#757575">3 masters + 3 replicas | 7.5 MB total</text>
  <line x1="530" y1="360" x2="445" y2="478" stroke="#D32F2F" stroke-width="1.2" marker-end="url(#ar)"/>

  <!-- External Payment Gateway -->
  <rect x="620" y="470" width="200" height="55" rx="6" fill="#ECEFF1" stroke="#546E7A" stroke-width="1.5" filter="url(#sh)"/>
  <text x="720" y="493" text-anchor="middle" font-size="11" font-weight="600" fill="#37474F">Payment Gateway</text>
  <text x="720" y="508" text-anchor="middle" font-size="9" fill="#546E7A">Stripe / Adyen (External)</text>
  <text x="720" y="520" text-anchor="middle" font-size="8" fill="#757575">2-5s latency | Idempotency keys</text>
  <line x1="280" y1="400" x2="620" y2="490" stroke="#546E7A" stroke-width="1" stroke-dasharray="4,2" marker-end="url(#a)"/>

  <!-- Message Queue -->
  <rect x="870" y="470" width="170" height="55" rx="6" fill="#FFF3E0" stroke="#E65100" stroke-width="1.5" filter="url(#sh)"/>
  <text x="955" y="493" text-anchor="middle" font-size="11" font-weight="600" fill="#BF360C">Kafka / SQS</text>
  <text x="955" y="508" text-anchor="middle" font-size="9" fill="#546E7A">Event bus | Async notifications</text>
  <text x="955" y="520" text-anchor="middle" font-size="8" fill="#757575">Booking events | Audit log</text>
  <line x1="920" y1="420" x2="955" y2="470" stroke="#546E7A" stroke-width="1" marker-end="url(#a)"/>

  <!-- Flow Labels -->
  <text x="550" y="288" font-size="8" fill="#2E7D32" font-weight="600">Admitted users only (50K batch)</text>

  <!-- Legend -->
  <rect x="60" y="590" width="980" height="55" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="80" y="610" font-size="10" font-weight="700" fill="#424242">Legend</text>
  <rect x="80" y="620" width="14" height="10" rx="2" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5"/>
  <text x="98" y="629" font-size="8" fill="#546E7A">Queue / Gate</text>
  <rect x="160" y="620" width="14" height="10" rx="2" fill="#C8E6C9" stroke="#388E3C" stroke-width="1"/>
  <text x="178" y="629" font-size="8" fill="#546E7A">Core Service</text>
  <rect x="240" y="620" width="14" height="10" rx="2" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1"/>
  <text x="258" y="629" font-size="8" fill="#546E7A">Seat Lock (Redis)</text>
  <rect x="340" y="620" width="14" height="10" rx="2" fill="#E8EAF6" stroke="#283593" stroke-width="1"/>
  <text x="358" y="629" font-size="8" fill="#546E7A">Database (ACID)</text>
  <rect x="425" y="620" width="14" height="10" rx="2" fill="#B2DFDB" stroke="#00695C" stroke-width="1"/>
  <text x="443" y="629" font-size="8" fill="#546E7A">Payment</text>
  <rect x="500" y="620" width="14" height="10" rx="2" fill="#FFE0B2" stroke="#F57C00" stroke-width="1"/>
  <text x="518" y="629" font-size="8" fill="#546E7A">Background Worker</text>
  <rect x="605" y="620" width="14" height="10" rx="2" fill="#ECEFF1" stroke="#546E7A" stroke-width="1"/>
  <text x="623" y="629" font-size="8" fill="#546E7A">External System</text>
  <line x1="700" y1="625" x2="740" y2="625" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <text x="745" y="629" font-size="8" fill="#546E7A">Sync call</text>
  <line x1="800" y1="625" x2="840" y2="625" stroke="#546E7A" stroke-width="1" stroke-dasharray="4,2" marker-end="url(#a)"/>
  <text x="845" y="629" font-size="8" fill="#546E7A">Async / External</text>

  <!-- State Machine (bottom) -->
  <rect x="60" y="660" width="980" height="45" rx="6" fill="#FAFAFA" stroke="#B0BEC5" stroke-width="1"/>
  <text x="80" y="678" font-size="9" font-weight="700" fill="#37474F">State Machine:</text>
  <rect x="170" y="668" width="70" height="22" rx="4" fill="#E3F2FD" stroke="#1976D2" stroke-width="1"/>
  <text x="205" y="683" text-anchor="middle" font-size="8" font-weight="600" fill="#1565C0">QUEUED</text>
  <text x="252" y="683" font-size="10" fill="#546E7A">→</text>
  <rect x="265" y="668" width="80" height="22" rx="4" fill="#FFF9C4" stroke="#F9A825" stroke-width="1"/>
  <text x="305" y="683" text-anchor="middle" font-size="8" font-weight="600" fill="#F57F17">SELECTING</text>
  <text x="357" y="683" font-size="10" fill="#546E7A">→</text>
  <rect x="370" y="668" width="60" height="22" rx="4" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1"/>
  <text x="400" y="683" text-anchor="middle" font-size="8" font-weight="600" fill="#C62828">HELD</text>
  <text x="442" y="683" font-size="10" fill="#546E7A">→</text>
  <rect x="455" y="668" width="65" height="22" rx="4" fill="#B2DFDB" stroke="#00695C" stroke-width="1"/>
  <text x="487" y="683" text-anchor="middle" font-size="8" font-weight="600" fill="#004D40">PAYING</text>
  <text x="532" y="683" font-size="10" fill="#546E7A">→</text>
  <rect x="545" y="668" width="85" height="22" rx="4" fill="#C8E6C9" stroke="#2E7D32" stroke-width="1"/>
  <text x="587" y="683" text-anchor="middle" font-size="8" font-weight="600" fill="#1B5E20">CONFIRMED</text>
  <text x="660" y="683" font-size="9" fill="#757575">|</text>
  <rect x="680" y="668" width="75" height="22" rx="4" fill="#FFECB3" stroke="#FF8F00" stroke-width="1"/>
  <text x="717" y="683" text-anchor="middle" font-size="8" font-weight="600" fill="#E65100">EXPIRED</text>
  <text x="768" y="683" font-size="9" fill="#757575">|</text>
  <rect x="785" y="668" width="80" height="22" rx="4" fill="#F5F5F5" stroke="#757575" stroke-width="1"/>
  <text x="825" y="683" text-anchor="middle" font-size="8" font-weight="600" fill="#424242">CANCELLED</text>
  <text x="878" y="683" font-size="9" fill="#757575">|</text>
  <rect x="895" y="668" width="75" height="22" rx="4" fill="#E1F5FE" stroke="#0277BD" stroke-width="1"/>
  <text x="932" y="683" text-anchor="middle" font-size="8" font-weight="600" fill="#01579B">REFUNDED</text>
</svg>
</div>

---

## 8. Backend Services Explained

### Virtual Queue (Waiting Room) Service

The virtual queue is the most critical component for flash-sale scenarios. When a sale goes live, 10M users are not routed directly to the booking service. Instead, they enter a holding area powered by Redis sorted sets (score = arrival timestamp). The queue admits users in FIFO batches of 50,000, throttled by the downstream system's actual capacity. Each admitted user receives a time-limited session token (JWT with 15-minute expiry) that authorizes them to access the seat selection page. The queue broadcasts position updates via Server-Sent Events (SSE), keeping users informed with messages like "Position #45,231 — estimated wait: 12 minutes." This prevents the catastrophic thundering herd pattern that destroyed Ticketmaster in 2022.

### Booking Service

The booking service orchestrates the entire seat selection and confirmation workflow. It is stateless — all state lives in Redis (locks) and PostgreSQL (bookings). It implements a strict state machine: `QUEUED → SELECTING → HELD → PAYING → CONFIRMED | EXPIRED | CANCELLED`. Each state transition is validated server-side; the client cannot skip steps. The service validates the session token (proving the user was admitted from the queue), calls Redis SETNX to lock the requested seat(s), and if successful, initiates the payment flow. It handles multi-seat atomic bookings using Redis pipelines (MULTI/EXEC) to lock all seats in a single round-trip or fail atomically.

### Seat Lock Manager (Redis)

This is not a separate service but a Redis usage pattern. Each seat in an event is represented as a key: `seat:{event_id}:{seat_id}`. The SETNX command atomically sets the key only if it does not exist, with a TTL of 600 seconds (10 minutes). The value contains `{user_id}:{timestamp}:{booking_session_id}`. Because Redis is single-threaded, SETNX is inherently linearizable — there is zero possibility of two users simultaneously acquiring the same lock. The Seat Lock Manager pattern eliminates an entire class of distributed systems problems: no deadlocks, no lock ordering, no distributed consensus needed for a single-key operation.

### Payment Service

The payment service handles the financial transaction after a seat is locked. It implements a two-phase pattern: (1) pre-authorize the full amount immediately when the seat is held, ensuring the user has funds; (2) capture the amount only after confirming the booking in PostgreSQL. If payment fails or times out, the pre-authorization is voided, and the seat lock is explicitly deleted (not waiting for TTL). The service uses idempotency keys derived from the booking session ID, ensuring that network retries never result in double-charges. A circuit breaker (Hystrix/Resilience4j) protects against payment gateway outages — if the gateway is down, users are shown a "retry in 30 seconds" message rather than losing their seat hold.

### TTL Expiry Worker

This background worker subscribes to Redis keyspace notifications (`__keyevent@0__:expired`) to detect when seat locks expire. When a lock expires (user abandoned cart, browser crashed, or payment timed out), the worker: (1) updates the booking status to EXPIRED in PostgreSQL, (2) voids any pending payment pre-authorization, (3) checks the waitlist for that event and sends a notification to the next user in line, (4) publishes a seat-released event to Kafka for analytics. This creates a self-healing inventory system where abandoned seats automatically return to the pool.

### Notification Service

An asynchronous service consuming from Kafka that handles all user communications: booking confirmations (email with QR e-ticket), queue position updates (SSE), payment receipts, refund confirmations, and waitlist notifications. It supports multiple channels (email via SES, push via FCM/APNs, SMS via Twilio) with user preference-based routing. During flash sales, it operates in "batch mode" — queue position updates are aggregated and sent every 5 seconds rather than on every position change, reducing SSE bandwidth from 2 GB/s to 200 MB/s.

---

## 9. Architecture Flow

### The Happy Path: Aisha Gets Taylor Swift Tickets

14 million fans flood the site simultaneously as the Eras Tour presale opens at 10:00 AM EST. Aisha, who received a Verified Fan code, opens her browser at 9:58 AM.

**Phase 1 — Queue Entry (T+0s):**
At 10:00:00, Aisha clicks "Join Queue." The CDN/WAF layer absorbs her request, validates her Verified Fan token, and passes her through the CAPTCHA challenge (device fingerprinting confirms she is human). Her request reaches the Virtual Queue service, which assigns her position **#45,231** in a Redis sorted set (ZADD with timestamp score). An SSE connection is established — her browser begins receiving position updates: "You are #45,231 in line. Estimated wait: 8 minutes."

**Phase 2 — Admission (T+8 min):**
The queue drains 50,000 users per batch. After approximately 8 minutes, Aisha's position falls within the admission window. The queue service generates a time-limited session JWT (15-minute expiry, signed with RS256) and pushes it via SSE. Her browser automatically redirects to the seat selection page. The rate limiter stamps her token: she can make at most 10 requests/second to the booking API.

**Phase 3 — Seat Selection (T+8 min 15s):**
Aisha sees the live seat map. She clicks on Section 112, Row G, Seat 14. The booking service receives her request, validates her session JWT, and executes:

```
SETNX seat:evt_2024_eras_nyc:sec112_G_14 "user:aisha_id:ts:1700000000:session:abc123"
EXPIRE seat:evt_2024_eras_nyc:sec112_G_14 600
```

Redis returns `1` (success). The seat is now exclusively hers for 10 minutes. The seat map broadcasts a WebSocket update to all connected users: seat 112-G-14 turns gray (unavailable). Her booking state transitions: `SELECTING → HELD`.

**Phase 4 — Payment (T+8 min 30s to T+9 min):**
Aisha is shown the payment page. She enters her credit card. The payment service pre-authorizes $450 with Stripe (idempotency key: `booking_abc123_preauth`). Stripe returns `authorized` in 2.3 seconds. The booking service then:

1. Writes the confirmed booking to PostgreSQL (INSERT with status = CONFIRMED)
2. Deletes the Redis seat lock (or lets it persist as a permanent marker)
3. Publishes `BOOKING_CONFIRMED` event to Kafka

State transition: `HELD → PAYING → CONFIRMED`. Total time from queue admission to confirmation: **47 seconds**.

**Phase 5 — Confirmation (T+9 min 10s):**
The notification service consumes the Kafka event and sends Aisha: (1) a confirmation email with QR e-ticket, (2) a push notification, (3) an in-app confirmation screen. She screenshots it and posts to Twitter.

### The Failure Path: Raj's Payment Times Out

Raj, position #12,000, gets admitted early. He selects a front-row seat and the SETNX succeeds. But his bank's 3D-Secure verification gets stuck in an infinite redirect loop. After 10 minutes:

1. **TTL fires:** Redis automatically deletes `seat:evt_2024_eras_nyc:sec1_A_5`. The seat is instantly available again.
2. **Expiry worker triggers:** Receives keyspace notification, updates Raj's booking to `EXPIRED` in PostgreSQL, voids the Stripe pre-authorization.
3. **Waitlist notification:** The next person on the waitlist for front-row seats (Priya, who opted in) receives a push notification: "A front-row seat is now available! You have 5 minutes to claim it."
4. **Raj's browser:** When his 3D-Secure finally resolves, the booking service checks Redis — key is gone. Returns HTTP 410 Gone: "Your seat hold has expired. Please select another seat."

No manual intervention was needed. The system self-healed in under 1 second after TTL expiry.

---

## 10. Failure & Recovery Scenarios

### Scenario 1: Redis Cluster Failure During Flash Sale

**Trigger:** The Redis primary node handling seat locks experiences an OOM kill during peak 333K SETNX/sec.

**Impact:** All seat lock operations fail. Users cannot select seats. If the failure is a network partition, split-brain could theoretically allow double-locks.

**Mitigation:**

- Redis Cluster with 3 masters (hash slots distributed). Single-node failure affects only 1/3 of seats.
- Sentinel performs automatic failover to replica in < 5 seconds.
- Booking service implements circuit breaker: after 3 consecutive Redis failures, returns "System busy, try again in 10 seconds" rather than cascading errors.
- Fencing tokens: each lock includes a monotonically increasing fencing token. PostgreSQL's booking confirmation checks that the token matches — stale locks from a pre-failover primary cannot confirm.
- Recovery: after failover, TTL worker scans PostgreSQL for bookings in HELD state > 10 minutes without confirmation and explicitly releases them.

### Scenario 2: Payment Gateway Timeout (Stripe 5xx)

**Trigger:** Stripe returns HTTP 503 for 2 minutes during peak payment processing.

**Impact:** Users have seats locked but cannot complete payment. If unhandled, all 50K held seats become stuck for 10 minutes.

**Mitigation:**

- Circuit breaker trips after 5 consecutive 503s. New payment attempts receive "Payment temporarily unavailable, your seat is held for 10 minutes. We'll retry automatically."
- Background retry: the payment service enqueues failed payments in a retry queue with exponential backoff (5s, 15s, 45s, 135s).
- Seat hold is NOT released during retry window — the user should not lose their seat due to a third-party outage.
- If retries exhaust the 10-minute window, the user is notified and given a priority re-queue token for the next available slot.
- Idempotency keys ensure that when Stripe recovers, duplicate pre-auth requests are safely deduplicated.

### Scenario 3: Virtual Queue Overflow (14M > Expected 5M)

**Trigger:** Traffic exceeds capacity projections by 3x. The SSE gateway cannot maintain 14M concurrent connections (originally provisioned for 5M).

**Impact:** New users cannot establish SSE connections. Queue position updates stop. Users refresh aggressively, amplifying the problem.

**Mitigation:**

- Graceful degradation: SSE gateway switches to polling mode. Returns `Retry-After: 10` header. Client falls back to polling every 10 seconds.
- Auto-scaling: Kubernetes HPA triggers new SSE pods (scale from 50 to 200 pods in 3 minutes based on connection count).
- Queue partitioning: shard users across multiple Redis instances by `user_id % N`. Each shard handles its own ZADD/ZRANK independently.
- Overflow page: users beyond position #5M see a static "extremely high demand" page served entirely from CDN (zero origin load) with a single polling endpoint.
- Lesson from Ticketmaster: the queue itself must be the simplest, most scalable component. It should survive when everything else fails.

### Scenario 4: Race Condition in Seat Release

**Trigger:** User's TTL expires (seat released) at the exact moment their delayed payment completes. Payment service tries to confirm a booking for a seat that was just re-assigned to another user.

**Impact:** Potential double-booking if not handled.

**Mitigation:**

- Fencing token pattern: the booking service stores the SETNX value (including session ID) at lock time. Before confirming in PostgreSQL, it verifies:
  ```
  GET seat:{event_id}:{seat_id}
  ```
  If the key is absent (expired) or value differs (re-assigned), the confirmation is rejected.
- PostgreSQL unique constraint: `UNIQUE(event_id, seat_id, status='CONFIRMED')` prevents any code path from creating duplicate confirmed bookings.
- Compensating transaction: if the payment was already captured, initiate an automatic refund and notify the user: "Your seat hold expired during payment processing. A full refund has been issued."
- This is a known TOCTOU (time-of-check-time-of-use) problem. The combination of fencing token + database constraint + compensating transaction makes it impossible to result in a double-sold seat.

---

## 11. Data Model

### Events Table (PostgreSQL)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| event_id | BIGINT | PRIMARY KEY | Snowflake ID |
| name | VARCHAR(255) | NOT NULL | "Taylor Swift Eras Tour - NYC" |
| venue_id | BIGINT | FK → venues | |
| event_time | TIMESTAMPTZ | NOT NULL | Event start time |
| total_seats | INTEGER | NOT NULL | 50,000 |
| sale_start | TIMESTAMPTZ | NOT NULL | When queue opens |
| sale_end | TIMESTAMPTZ | | Auto-close if sold out |
| status | ENUM | | draft, on_sale, sold_out, completed, cancelled |
| pricing_tiers | JSONB | | {tier: price} mapping |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### Seat Inventory (Redis Keys)

| Key Pattern | Value | TTL | Notes |
|---|---|---|---|
| `seat:{event_id}:{section}_{row}_{num}` | `{user_id}:{timestamp}:{session_id}:{fence_token}` | 600s (10 min) | SETNX creates; TTL auto-deletes |
| `queue:{event_id}` | Sorted Set (member=user_id, score=timestamp) | None | Virtual queue ordering |
| `admitted:{event_id}:{user_id}` | `{session_jwt_hash}` | 900s (15 min) | Admission proof |
| `rate:{user_id}` | Counter | 1s | Token bucket counter |

### Bookings Table (PostgreSQL)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| booking_id | UUID | PRIMARY KEY | Idempotency anchor |
| user_id | BIGINT | FK → users, NOT NULL | |
| event_id | BIGINT | FK → events, NOT NULL | |
| seat_ids | TEXT[] | NOT NULL | ["sec112_G_14", "sec112_G_15"] |
| amount_cents | INTEGER | NOT NULL | Total price in cents |
| currency | CHAR(3) | DEFAULT 'USD' | |
| status | ENUM | NOT NULL | held, paying, confirmed, expired, cancelled, refunded |
| payment_id | VARCHAR(100) | | Stripe payment intent ID |
| fence_token | BIGINT | NOT NULL | Monotonic; validates lock ownership |
| session_id | UUID | NOT NULL | Links to queue admission |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| confirmed_at | TIMESTAMPTZ | | NULL until confirmed |
| expires_at | TIMESTAMPTZ | NOT NULL | created_at + 10 min |

**Unique constraint:** `UNIQUE(event_id, unnest(seat_ids)) WHERE status = 'confirmed'` — database-level double-booking prevention.

### Queue Position Table (PostgreSQL — for persistence/audit)

| Column | Type | Notes |
|---|---|---|
| queue_id | BIGINT | PRIMARY KEY |
| event_id | BIGINT | FK → events |
| user_id | BIGINT | FK → users |
| position | INTEGER | FIFO order |
| joined_at | TIMESTAMPTZ | |
| admitted_at | TIMESTAMPTZ | NULL until admitted |
| status | ENUM | waiting, admitted, expired, completed |

---

## 12. Algorithms Under the Hood

### Algorithm 1: Atomic Seat Lock (Redis SETNX)

```python
def acquire_seat_lock(event_id: str, seat_id: str, user_id: str, 
                      session_id: str, ttl_seconds: int = 600) -> bool:
    """
    Atomically lock a seat using Redis SETNX.
    Returns True if lock acquired, False if seat already taken.
    
    Why SETNX: Single-threaded Redis guarantees no race condition.
    O(1) time complexity regardless of concurrent users.
    """
    key = f"seat:{event_id}:{seat_id}"
    fence_token = redis.incr("global:fence_token")  # monotonic counter
    value = f"{user_id}:{int(time.time())}:{session_id}:{fence_token}"
    
    # SETNX + EXPIRE in single atomic operation (SET NX EX)
    acquired = redis.set(key, value, nx=True, ex=ttl_seconds)
    
    if acquired:
        # Publish seat-taken event for live seat map updates
        redis.publish(f"seatmap:{event_id}", json.dumps({
            "seat_id": seat_id, "status": "locked", "user": user_id
        }))
        return True, fence_token
    else:
        # Seat already locked by another user
        return False, None


def release_seat_lock(event_id: str, seat_id: str, 
                      user_id: str, session_id: str) -> bool:
    """
    Release a seat lock. Only the lock owner can release.
    Uses Lua script for atomic check-and-delete (no TOCTOU race).
    """
    key = f"seat:{event_id}:{seat_id}"
    
    # Lua script: atomic compare-and-delete
    lua_script = """
    local current = redis.call('GET', KEYS[1])
    if current and string.find(current, ARGV[1]) then
        redis.call('DEL', KEYS[1])
        return 1
    end
    return 0
    """
    result = redis.eval(lua_script, 1, key, f"{user_id}:.*:{session_id}")
    return result == 1
```

### Algorithm 2: Virtual Queue Admission Control (Token Bucket)

```python
class VirtualQueueAdmissionController:
    """
    Admits users from the waiting queue in controlled batches.
    Uses token bucket to meter admission rate based on downstream capacity.
    
    Invariant: admitted_users <= system_capacity at all times
    """
    
    def __init__(self, event_id: str, batch_size: int = 50_000,
                 refill_interval_sec: int = 60):
        self.event_id = event_id
        self.batch_size = batch_size
        self.refill_interval = refill_interval_sec
        self.queue_key = f"queue:{event_id}"
        self.active_key = f"active:{event_id}"
    
    def get_queue_position(self, user_id: str) -> int:
        """O(log N) - Redis ZRANK on sorted set"""
        rank = redis.zrank(self.queue_key, user_id)
        return rank + 1 if rank is not None else -1
    
    def admit_next_batch(self) -> list[str]:
        """
        Called by scheduler every refill_interval seconds.
        Admits up to batch_size users from queue head.
        
        Flow:
        1. Check current active user count
        2. Calculate available slots
        3. Pop users from queue head (ZPOPMIN)
        4. Generate session tokens
        5. Push admission events via SSE
        """
        # How many users are currently active (holding seats / paying)?
        current_active = redis.scard(self.active_key)
        available_slots = max(0, self.batch_size - current_active)
        
        if available_slots == 0:
            return []
        
        # Atomically pop N users from queue head (lowest scores = earliest)
        admitted_users = redis.zpopmin(self.queue_key, available_slots)
        
        tokens = []
        for user_id, join_timestamp in admitted_users:
            # Generate time-limited session JWT
            session_token = jwt.encode({
                "user_id": user_id,
                "event_id": self.event_id,
                "admitted_at": time.time(),
                "expires_at": time.time() + 900,  # 15 min session
                "fence": redis.incr("global:fence_token")
            }, private_key, algorithm="RS256")
            
            # Track active user
            redis.sadd(self.active_key, user_id)
            redis.set(f"admitted:{self.event_id}:{user_id}", 
                     hash(session_token), ex=900)
            
            # Push admission event via SSE
            sse_gateway.send(user_id, {
                "type": "ADMITTED",
                "token": session_token,
                "message": "You're in! Select your seats now."
            })
            tokens.append(session_token)
        
        return tokens
    
    def estimate_wait_time(self, position: int) -> int:
        """Estimate wait in seconds based on admission rate."""
        batches_ahead = position // self.batch_size
        return batches_ahead * self.refill_interval
```

### Algorithm 3: Payment Timeout with Compensating Transaction

```python
class PaymentOrchestrator:
    """
    Handles payment with timeout detection and compensating transactions.
    
    Key invariant: A seat is NEVER double-sold. If payment and TTL expiry
    race, the fencing token determines the winner.
    """
    
    async def process_payment(self, booking: Booking, 
                               payment_method: str) -> PaymentResult:
        """
        Two-phase payment: pre-authorize → confirm booking → capture.
        Compensating transaction on any failure.
        """
        idempotency_key = f"pay_{booking.booking_id}_{booking.fence_token}"
        
        try:
            # Phase 1: Pre-authorize (hold funds, don't capture yet)
            preauth = await stripe.payment_intents.create(
                amount=booking.amount_cents,
                currency=booking.currency,
                payment_method=payment_method,
                capture_method="manual",  # Don't capture yet
                idempotency_key=idempotency_key,
                metadata={"booking_id": str(booking.booking_id)}
            )
            
            if preauth.status != "requires_capture":
                raise PaymentDeclinedException(preauth.last_error)
            
            # Phase 2: Verify seat lock still valid (fencing token check)
            current_lock = redis.get(f"seat:{booking.event_id}:{booking.seat_ids[0]}")
            if current_lock is None:
                # TTL expired while payment was processing!
                await self._compensate_expired_lock(preauth, booking)
                return PaymentResult(status="EXPIRED", 
                    message="Your seat hold expired. Refund issued.")
            
            if not self._validate_fence_token(current_lock, booking.fence_token):
                # Lock was reassigned (split-brain recovery scenario)
                await self._compensate_stale_lock(preauth, booking)
                return PaymentResult(status="CONFLICT",
                    message="Seat was reassigned. Refund issued.")
            
            # Phase 3: Confirm booking in PostgreSQL (ACID)
            async with db.transaction(isolation="SERIALIZABLE"):
                await db.execute("""
                    UPDATE bookings 
                    SET status = 'confirmed', 
                        confirmed_at = NOW(),
                        payment_id = $1
                    WHERE booking_id = $2 
                      AND status = 'held'
                      AND fence_token = $3
                """, preauth.id, booking.booking_id, booking.fence_token)
                
                rows_affected = db.rowcount
                if rows_affected == 0:
                    # Another process already confirmed or expired this booking
                    raise ConflictException("Booking state changed")
            
            # Phase 4: Capture payment (funds transfer)
            await stripe.payment_intents.capture(preauth.id,
                idempotency_key=f"{idempotency_key}_capture")
            
            # Phase 5: Publish confirmation event
            await kafka.produce("booking.confirmed", {
                "booking_id": str(booking.booking_id),
                "user_id": booking.user_id,
                "event_id": booking.event_id,
                "seats": booking.seat_ids
            })
            
            return PaymentResult(status="CONFIRMED")
            
        except PaymentDeclinedException:
            # Card declined — release seat lock immediately (don't wait for TTL)
            await self._release_lock_and_notify(booking)
            return PaymentResult(status="DECLINED",
                message="Payment declined. Seat released.")
            
        except asyncio.TimeoutError:
            # Payment gateway timeout — DO NOT release lock yet
            # Enqueue for retry (user keeps their seat hold)
            await retry_queue.enqueue(booking, max_retries=3, 
                                       backoff="exponential")
            return PaymentResult(status="PENDING",
                message="Payment processing. Your seat is held.")
    
    async def _compensate_expired_lock(self, preauth, booking):
        """Compensating transaction: void pre-auth, update booking status."""
        await stripe.payment_intents.cancel(preauth.id)
        await db.execute(
            "UPDATE bookings SET status = 'expired' WHERE booking_id = $1",
            booking.booking_id)
        await notification_service.send(booking.user_id, 
            "Your seat hold expired during payment. Full refund issued.")
```

### Algorithm 4: Seat Release on TTL Expiry

```python
class TTLExpiryWorker:
    """
    Listens to Redis keyspace notifications for expired seat locks.
    Performs cleanup: update DB, void payments, notify waitlist.
    
    Redis config required: notify-keyspace-events Ex
    """
    
    async def run(self):
        """Subscribe to expired key events and process them."""
        pubsub = redis.pubsub()
        await pubsub.psubscribe("__keyevent@0__:expired")
        
        async for message in pubsub.listen():
            if message["type"] != "pmessage":
                continue
            
            expired_key = message["data"]  # e.g., "seat:evt123:sec1_A_5"
            
            if not expired_key.startswith("seat:"):
                continue
            
            await self._handle_seat_expiry(expired_key)
    
    async def _handle_seat_expiry(self, expired_key: str):
        """
        Handle expired seat lock:
        1. Update booking status
        2. Void any pending payment
        3. Notify waitlist
        4. Update seat map (real-time)
        """
        parts = expired_key.split(":")
        event_id, seat_id = parts[1], parts[2]
        
        # Find the booking associated with this lock
        booking = await db.fetchone("""
            SELECT * FROM bookings 
            WHERE event_id = $1 
              AND $2 = ANY(seat_ids)
              AND status IN ('held', 'paying')
            ORDER BY created_at DESC LIMIT 1
        """, event_id, seat_id)
        
        if not booking:
            return  # No active booking (already confirmed or cancelled)
        
        # Step 1: Update booking status to expired
        await db.execute("""
            UPDATE bookings SET status = 'expired' 
            WHERE booking_id = $1 AND status IN ('held', 'paying')
        """, booking["booking_id"])
        
        # Step 2: Void any pending payment pre-authorization
        if booking["payment_id"]:
            try:
                await stripe.payment_intents.cancel(booking["payment_id"])
            except stripe.InvalidRequestError:
                pass  # Already cancelled or captured
        
        # Step 3: Notify the user
        await notification_service.send(booking["user_id"], {
            "type": "SEAT_EXPIRED",
            "message": "Your seat hold for {event_name} has expired.",
            "action": "You can select another available seat."
        })
        
        # Step 4: Publish seat-available event for live seat map
        redis.publish(f"seatmap:{event_id}", json.dumps({
            "seat_id": seat_id, 
            "status": "available"
        }))
        
        # Step 5: Notify waitlist (next person gets priority)
        waitlist_user = await redis.lpop(f"waitlist:{event_id}:{seat_id}")
        if waitlist_user:
            await notification_service.send(waitlist_user, {
                "type": "SEAT_AVAILABLE",
                "message": f"Seat {seat_id} is now available! Claim within 5 min.",
                "priority_token": generate_priority_token(waitlist_user, seat_id)
            })
```

---

## 13. Scaling Considerations

| Dimension | Strategy | Details |
|---|---|---|
| **Read scaling** | CDN + Redis read replicas | Event pages, seat maps (tiles), pricing served from CDN. Redis replicas handle 100K+ reads/sec for seat status. |
| **Write scaling** | Redis Cluster (hash slots) | 50K seats distributed across 3 Redis masters. Each handles ~111K SETNX/sec. Cluster handles full 333K/sec. |
| **Queue scaling** | Horizontal SSE pods + Redis sharding | 10M SSE connections across 200 pods (50K each). Queue state sharded by event_id. |
| **Database scaling** | Read replicas + connection pooling | Write primary handles 3K confirmed bookings/sec. PgBouncer pools 500 connections across 200 API pods. |
| **API scaling** | Kubernetes HPA + pre-warming | Scale from 50 to 200 pods in < 3 min. Pre-warm pods 30 min before sale start. |
| **Geographic** | Multi-region active-passive | Primary region handles all writes. CDN + read replicas in edge regions. Failover via Route 53 health checks. |
| **Flash sale prep** | Pre-provisioning ritual | 24h before: warm Redis with all seat keys (SET + DEL pattern). Scale API pods. Load-test at 1.5x expected traffic. |
| **Payment scaling** | Queue + rate limiting to gateway | Payment is the bottleneck (2-5s external latency). Buffer with internal queue. Max 5K concurrent requests to Stripe. |
| **Monitoring** | Real-time dashboards | Grafana: seats locked/sec, queue depth, payment success rate, Redis memory, p99 latency. Alert if seat lock rate drops > 20%. |
| **Cost optimization** | Burst to spot instances | Flash sale pods run on spot/preemptible instances (80% cheaper). Acceptable for stateless services behind a queue. |

---

## 14. Quick Recall

| Interview Question | Concise Answer |
|---|---|
| How do you handle 10M concurrent users? | Virtual queue (waiting room) admits 50K at a time via token bucket. Users see real-time position via SSE. Queue converts thundering herd into controlled flow. |
| What prevents double-booking? | Redis SETNX (atomic set-if-not-exists). Single-threaded Redis guarantees only one user can lock a seat. PostgreSQL UNIQUE constraint as second defense layer. |
| Why not database row locks? | At 333K/sec with 6.6:1 contention, row locks cause exponential deadlock chains and connection pool exhaustion. Redis SETNX is O(1), no deadlocks, auto-expires via TTL. |
| What happens if a user abandons checkout? | TTL (10 min) auto-expires the Redis key. Expiry worker voids payment pre-auth, updates booking to EXPIRED, notifies waitlist. Self-healing — no manual cleanup. |
| How do you handle payment gateway failure? | Circuit breaker trips after 5 failures. User keeps seat hold. Payment retried with exponential backoff within the 10-min window. Idempotency keys prevent double-charge. |
| What is the state machine? | QUEUED → SELECTING → HELD → PAYING → CONFIRMED (happy path). Alternative terminal states: EXPIRED, CANCELLED, REFUNDED. |
| How do you prevent bots? | WAF (IP reputation) → CAPTCHA (at queue entry) → Device fingerprinting → Rate limiting (per-user token bucket) → Verified Fan codes (pre-registration). |
| What if Redis fails mid-sale? | Redis Cluster: single-node failure affects 1/3 seats only. Sentinel failover in < 5s. Fencing tokens prevent stale locks from confirming. |
| How do you scale the seat map? | Seat map rendered as pre-computed image tiles (like Google Maps). CDN caches tiles. Real-time updates via Redis Pub/Sub → WebSocket push for changed seats only. |
| What consistency model? | Linearizable for seat locks (Redis single-threaded). Serializable for booking confirmation (PostgreSQL). Eventual consistency acceptable for queue position and seat map visuals. |
| Multi-seat booking (group)? | Redis MULTI/EXEC pipeline: lock all seats atomically. If any SETNX fails, DISCARD all. All-or-nothing semantics without distributed transactions. |
| How do you handle refunds? | Configurable refund window (e.g., 48h before event). Refund service calls Stripe refund API, updates booking to REFUNDED, releases seat back to inventory, notifies waitlist. |
