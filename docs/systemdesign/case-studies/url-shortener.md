# URL Shortener (bit.ly)

!!! danger "Real Incident: bit.ly Global Outage, 2014"
    A single database failover caused bit.ly's URL resolution to go down for 2+ hours. Every shortened link on the internet — in tweets, emails, ads — returned 500 errors. The root cause: their read path had no caching layer, so ALL traffic hit the database directly. After the incident, they added a multi-layer Redis cache that handles 95%+ of reads without touching the database. **A URL shortener is a read-heavy system — the architecture must reflect that or a single DB hiccup takes down billions of links.**

---

## System Design Concepts Used

`Load Balancer` · `CDN` · `Consistent Hashing` · `Base62 Encoding` · `Snowflake ID` · `Cache-Aside (Redis)` · `Database Sharding` · `Async Processing (Kafka)` · `OLAP (ClickHouse)` · `Power Law Distribution` · `301 vs 302 Redirects` · `Horizontal Scaling`

---

## 1. Functional Requirements

1. **Shorten URL** — given a long URL, return a unique short URL (7 characters)
2. **Redirect** — given a short URL, redirect to the original long URL (301/302)
3. **Custom aliases** — user can optionally pick a custom short name (e.g., `/my-promo`)
4. **Expiration** — optional TTL per URL (auto-delete after N days)
5. **Analytics** — click count, geographic distribution, referrer tracking

## 2. Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Availability** | 99.99% (< 52 min/year) | Every link on the internet depends on us |
| **Read latency** | < 50ms p99 | Redirect must feel instant |
| **Write latency** | < 200ms p99 | Acceptable for URL creation |
| **Read-write ratio** | 100:1 | Overwhelmingly read-heavy |
| **Durability** | Zero data loss | A lost URL = permanently broken links |
| **Consistency** | Eventual (1-2s stale OK) | Cache can serve slightly stale data |

---

## 3. Capacity Estimation

```text
/* ━━━ NAPKIN MATH: Start From Monthly URLs ━━━ */
New URLs/month: 100M
New URLs/day: 100M / 30 = 3.3M/day
Write QPS (avg): 3.3M / 86,400 ≈ 40 writes/sec
Write QPS (peak 5x): ~200 writes/sec

/* ━━━ READS (100:1 ratio) ━━━ */
Read QPS (avg): 40 × 100 = 4,000 reads/sec
Read QPS (peak 10x): 40,000 reads/sec
Read QPS (viral spike 50x): 200,000 reads/sec  ← CDN must absorb this

/* ━━━ STORAGE ━━━ */
Per URL: short_url (7B) + long_url (500B avg) + metadata (100B) = ~600 bytes
5-year storage: 100M × 12 × 5 × 600B = 3.6 TB
Total unique URLs (5yr): 6 billion
Base62 with 7 chars: 62^7 = 3.5 TRILLION (sufficient for centuries)

/* ━━━ CACHE ━━━ */
80/20 rule: 20% of URLs get 80% of traffic (power law)
Hot URLs to cache: 3.3M/day × 20% = 660K URLs
Cache memory: 660K × 600 bytes = ~400 MB  (tiny! Redis handles easily)
Generous cache: 10M URLs × 600 bytes = 6 GB Redis

/* ━━━ BANDWIDTH ━━━ */
Incoming (reads): 40K req/sec × 600 bytes = 24 MB/sec
Outgoing (redirects): 40K × 300 bytes (HTTP 301 header) = 12 MB/sec
```

!!! note "System Nature"
    **Extremely read-heavy.** The entire architecture is optimized for the read path. Writes are infrequent and can tolerate slightly more latency. The read path must be sub-50ms with multiple cache layers absorbing traffic before it hits the database.

---

## 4. "Why X, Not Y?" — Tradeoff Analysis

### Why Base62 encoding and not MD5/SHA hash?

**Base62 wins because it guarantees a fixed, short length with no collision risk when paired with a unique counter.** MD5 produces 128 bits — truncating to 7 characters gives you only 62^7 / 2^42 collision probability, which at 6 billion URLs means thousands of collisions requiring DB lookups to resolve. Base62-encoding a unique integer (from a counter or Snowflake ID) produces a guaranteed-unique 7-character string with zero collision checks.

*MD5 advantage:* Same long URL always produces the same short URL (deduplication for free). Use if dedup is a hard requirement.

### Why Redis cache and not Memcached?

**Redis supports data structures (TTL, sorted sets for analytics) and persistence.** If a Redis node restarts, it can reload from an RDB snapshot and resume serving within seconds. Memcached loses all data on restart — during the cold-start window, every request hits the database.

*Memcached advantage:* Multi-threaded, marginally faster for pure key-value gets at extreme scale (Netflix uses it at 30M req/sec). For a URL shortener at 40K reads/sec, Redis is more than enough.

### Why sharded PostgreSQL and not DynamoDB?

**PostgreSQL gives us transactions for the write path (insert URL + check custom alias atomically) and is free from vendor lock-in.** Sharding by `hash(short_url)` distributes reads evenly. At 3.6 TB / 5 years, 6 shards handle ~600 GB each — well within PostgreSQL's comfort zone.

*DynamoDB advantage:* Zero-ops, auto-scaling, single-digit ms reads at any scale. Use if you want managed infra and accept AWS lock-in and higher cost at scale.

### Why 301 redirect and not 302?

**301 (Permanent) lets browsers and CDNs cache the redirect, reducing load on our servers.** Once a browser sees a 301 for `/abc123 → https://example.com/long-page`, it never asks us again — it goes directly. This offloads massive traffic.

*302 advantage:* Every click comes through us, enabling accurate analytics (click count, geo, referrer). Use 302 if analytics is the primary revenue model (bit.ly uses 302).

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
  <text x="550" y="28" text-anchor="middle" font-size="18" font-weight="800" fill="#212121">URL Shortener — System Architecture</text>
  <text x="550" y="48" text-anchor="middle" font-size="11" fill="#757575">100:1 read-write ratio | 40K reads/sec peak | 3.6 TB storage (5yr) | &lt;50ms redirect</text>

  <!-- ═══ LAYER 1: Clients ═══ -->
  <rect x="40" y="60" width="1020" height="65" rx="10" fill="#E3F2FD" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="76" font-size="10" font-weight="600" fill="#9E9E9E">Clients</text>
  <rect x="60" y="82" width="180" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="150" y="104" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Browser (GET /abc123)</text>
  <rect x="260" y="82" width="180" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="350" y="104" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Mobile App</text>
  <rect x="460" y="82" width="180" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="550" y="104" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">API Client (POST /shorten)</text>
  <rect x="660" y="82" width="180" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="750" y="104" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Embedded Links (Email/SMS)</text>

  <!-- ═══ LAYER 2: Edge / CDN ═══ -->
  <line x1="400" y1="125" x2="400" y2="148" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="200" y="148" width="400" height="50" rx="8" fill="#B2EBF2" stroke="#00838F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="400" y="168" text-anchor="middle" font-size="13" font-weight="700" fill="#006064">CDN (CloudFront / Cloudflare)</text>
  <text x="400" y="186" text-anchor="middle" font-size="9" fill="#757575">Cache 301 redirects at edge | ~60% hit rate for popular URLs | Global PoPs</text>

  <!-- ═══ LAYER 3: Load Balancer ═══ -->
  <line x1="400" y1="198" x2="400" y2="225" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <text x="420" y="214" font-size="8" fill="#757575">cache miss</text>
  <polygon points="400,225 460,252 400,279 340,252" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5"/>
  <text x="400" y="256" text-anchor="middle" font-size="11" font-weight="600" fill="#F57F17">L7 Load Balancer</text>

  <!-- ═══ LAYER 4: Application Services ═══ -->
  <line x1="400" y1="279" x2="400" y2="305" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="40" y="305" width="1020" height="75" rx="10" fill="#E8F5E9" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="321" font-size="10" font-weight="600" fill="#9E9E9E">Application Layer (Stateless, Auto-Scaled)</text>

  <rect x="60" y="328" width="280" height="42" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="200" y="345" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Read Service (Redirect)</text>
  <text x="200" y="362" text-anchor="middle" font-size="9" fill="#757575">Lookup short→long | Cache-aside | Return 301</text>

  <rect x="380" y="328" width="280" height="42" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="520" y="345" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Write Service (Shorten)</text>
  <text x="520" y="362" text-anchor="middle" font-size="9" fill="#757575">Generate ID | Base62 encode | Persist | Cache-warm</text>

  <rect x="700" y="328" width="280" height="42" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="840" y="345" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Analytics Service</text>
  <text x="840" y="362" text-anchor="middle" font-size="9" fill="#757575">Async click tracking | Geo | Referrer</text>

  <!-- ═══ LAYER 5: Caching ═══ -->
  <line x1="200" y1="370" x2="200" y2="410" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="80" y="410" width="300" height="52" rx="8" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="230" y="430" text-anchor="middle" font-size="13" font-weight="700" fill="#B71C1C">Redis Cache Cluster</text>
  <text x="230" y="448" text-anchor="middle" font-size="9" fill="#757575">LRU eviction | 95%+ hit rate | 6 GB (10M hot URLs)</text>

  <!-- ═══ ID Service (side) ═══ -->
  <rect x="750" y="410" width="250" height="52" rx="8" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="875" y="430" text-anchor="middle" font-size="12" font-weight="600" fill="#311B92">ID Generation Service</text>
  <text x="875" y="448" text-anchor="middle" font-size="9" fill="#757575">Snowflake-style | Pre-allocated ranges per server</text>
  <line x1="660" y1="349" x2="750" y2="430" stroke="#512DA8" stroke-width="1.2" stroke-dasharray="5,3" marker-end="url(#a)"/>
  <text x="720" y="385" font-size="8" fill="#512DA8">get next ID range</text>

  <!-- ═══ LAYER 6: Data Store ═══ -->
  <line x1="230" y1="462" x2="230" y2="500" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <text x="248" y="485" font-size="8" fill="#757575">miss</text>
  <rect x="40" y="500" width="1020" height="95" rx="10" fill="#E8EAF6" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="516" font-size="10" font-weight="600" fill="#9E9E9E">Data Layer</text>

  <!-- Database cylinders -->
  <path d="M80,535 L80,570 C80,585 240,585 240,570 L240,535" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="160" cy="535" rx="80" ry="10" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="160" cy="535" rx="80" ry="10" fill="#283593" opacity="0.1"/>
  <text x="160" y="554" text-anchor="middle" font-size="11" font-weight="600" fill="#1A237E">Shard 1</text>
  <text x="160" y="570" text-anchor="middle" font-size="8" fill="#757575">PostgreSQL</text>

  <path d="M270,535 L270,570 C270,585 430,585 430,570 L430,535" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="350" cy="535" rx="80" ry="10" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="350" cy="535" rx="80" ry="10" fill="#283593" opacity="0.1"/>
  <text x="350" y="554" text-anchor="middle" font-size="11" font-weight="600" fill="#1A237E">Shard 2</text>
  <text x="350" y="570" text-anchor="middle" font-size="8" fill="#757575">PostgreSQL</text>

  <path d="M460,535 L460,570 C460,585 620,585 620,570 L620,535" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="540" cy="535" rx="80" ry="10" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="540" cy="535" rx="80" ry="10" fill="#283593" opacity="0.1"/>
  <text x="540" y="554" text-anchor="middle" font-size="11" font-weight="600" fill="#1A237E">Shard 3</text>
  <text x="540" y="570" text-anchor="middle" font-size="8" fill="#757575">PostgreSQL</text>

  <text x="350" y="592" text-anchor="middle" font-size="9" fill="#757575">Partitioned by hash(short_url) mod N | 3.6 TB across shards | Read replicas per shard</text>

  <!-- ═══ LAYER 7: Analytics Pipeline ═══ -->
  <line x1="840" y1="370" x2="840" y2="408" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <text x="856" y="392" font-size="8" fill="#757575">async</text>

  <rect x="700" y="500" width="200" height="42" rx="6" fill="#37474F" stroke="#263238" stroke-width="1.5" filter="url(#sh)"/>
  <text x="800" y="517" text-anchor="middle" font-size="12" font-weight="600" fill="#ECEFF1">Kafka</text>
  <text x="800" y="534" text-anchor="middle" font-size="9" fill="#B0BEC5">Click events topic</text>
  <line x1="840" y1="462" x2="800" y2="500" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <line x1="800" y1="542" x2="800" y2="575" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <path d="M720,585 L720,615 C720,628 880,628 880,615 L880,585" fill="#B2DFDB" stroke="#00695C" stroke-width="1.5"/>
  <ellipse cx="800" cy="585" rx="80" ry="10" fill="#B2DFDB" stroke="#00695C" stroke-width="1.5"/>
  <text x="800" y="604" text-anchor="middle" font-size="11" font-weight="600" fill="#004D40">ClickHouse</text>
  <text x="800" y="618" text-anchor="middle" font-size="8" fill="#757575">OLAP analytics</text>

  <!-- ═══ LEGEND ═══ -->
  <rect x="40" y="650" width="1020" height="35" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="56" y="672" font-size="10" font-weight="700" fill="#757575">Legend:</text>
  <rect x="110" y="663" width="18" height="12" rx="3" fill="#BBDEFB" stroke="#1976D2" stroke-width="1"/>
  <text x="133" y="673" font-size="9" fill="#757575">Client</text>
  <rect x="175" y="663" width="18" height="12" rx="3" fill="#B2EBF2" stroke="#00838F" stroke-width="1"/>
  <text x="198" y="673" font-size="9" fill="#757575">CDN</text>
  <polygon points="258,663 268,669 258,675 248,669" fill="#FFF9C4" stroke="#F9A825" stroke-width="1"/>
  <text x="274" y="673" font-size="9" fill="#757575">LB</text>
  <rect x="302" y="663" width="18" height="12" rx="3" fill="#C8E6C9" stroke="#388E3C" stroke-width="1"/>
  <text x="325" y="673" font-size="9" fill="#757575">Service</text>
  <rect x="375" y="663" width="18" height="12" rx="3" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1"/>
  <text x="398" y="673" font-size="9" fill="#757575">Cache</text>
  <rect x="442" y="663" width="18" height="12" rx="3" fill="#D1C4E9" stroke="#512DA8" stroke-width="1"/>
  <text x="465" y="673" font-size="9" fill="#757575">ID Gen</text>
  <ellipse cx="520" cy="669" rx="10" ry="6" fill="#E8EAF6" stroke="#283593" stroke-width="1"/>
  <text x="536" y="673" font-size="9" fill="#757575">Database</text>
  <rect x="596" y="663" width="18" height="12" rx="3" fill="#37474F" stroke="#263238" stroke-width="1"/>
  <text x="619" y="673" font-size="9" fill="#757575">Queue</text>
  <ellipse cx="670" cy="669" rx="10" ry="6" fill="#B2DFDB" stroke="#00695C" stroke-width="1"/>
  <text x="686" y="673" font-size="9" fill="#757575">Analytics DB</text>
  <line x1="750" y1="669" x2="775" y2="669" stroke="#546E7A" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="782" y="673" font-size="9" fill="#757575">Data flow</text>
  <line x1="835" y1="669" x2="860" y2="669" stroke="#512DA8" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#a)"/>
  <text x="867" y="673" font-size="9" fill="#757575">Async/internal</text>
</svg>
</div>

---

## 6. Backend Services Explained

### Read Service (Redirect)
The most critical service — handles 100x more traffic than writes. Completely **stateless** — any instance can serve any request. Implements cache-aside: check Redis first, on miss go to the correct PostgreSQL shard (determined by `hash(short_url) mod num_shards`), then populate the cache before returning.

### Write Service (Shorten)
Consumes the next available ID from its **pre-allocated range** (e.g., IDs 5,000,001 to 5,010,000), Base62-encodes it, writes to PostgreSQL AND proactively warms the Redis cache. If a custom alias is requested, it checks for uniqueness in the database first (atomic `INSERT ... ON CONFLICT`).

### ID Generation Service
Allocates monotonically increasing ID ranges to Write Service instances. Each Write Service gets a block of 10,000 IDs at a time. It locally increments through its block with zero network calls. When exhausted, it requests a new block. The ID service itself is backed by a simple atomic counter in a single-row PostgreSQL table (or ZooKeeper if you need multi-region).

### Analytics Service
Publishes click events to Kafka asynchronously — never in the redirect hot path. A separate consumer writes aggregated analytics to ClickHouse every 10 seconds (batch inserts for OLAP performance).

---

## 7. Architecture Flow — A Click from Brazil

A user named **Carlos** in São Paulo clicks a shortened link `https://short.ly/Kz8mQ4x` in a tweet about a tech conference.

### Phase 1 — Edge Resolution

**T+0ms:** Carlos's browser sends `GET /Kz8mQ4x` to the nearest CDN PoP in São Paulo. The CDN checks its cache: this URL was first clicked 2 minutes ago by someone else in Brazil, and the 301 response was cached with a 24-hour TTL.

**Cache HIT → T+5ms:** CDN returns `301 Moved Permanently` with `Location: https://techconf.io/2026/register`. Carlos's browser follows the redirect. **Total latency: 5ms.** Our origin servers never saw this request.

```text
Carlos (São Paulo) → CDN PoP (São Paulo) → 301 cached → done (5ms)
```

### Phase 2 — Cache Miss (First Click)

Now imagine Carlos is the FIRST person to ever click this link. CDN has no cache entry.

**T+0ms:** CDN cache miss → forwards to origin (Load Balancer in us-east-1).

**T+25ms:** Load Balancer routes to a Read Service instance.

**T+26ms:** Read Service queries Redis: `GET url:Kz8mQ4x`

**T+27ms:** Redis **HIT** (the URL creator's Write Service proactively cached it). Returns `https://techconf.io/2026/register`.

**T+28ms:** Read Service returns `301` to CDN. CDN caches the response. Browser follows redirect.

```text
Carlos → CDN (miss) → LB → Read Service → Redis (hit) → 301 → CDN caches → done (28ms)
```

### Phase 3 — Full Miss (Cold URL, Never Cached)

A 3-year-old URL that hasn't been clicked in months. Redis evicted it (LRU).

**T+0ms:** CDN miss → LB → Read Service.

**T+26ms:** Redis **MISS** (`GET url:Kz8mQ4x` → nil).

**T+27ms:** Read Service computes shard: `hash("Kz8mQ4x") mod 6 = shard 3`. Queries PostgreSQL shard 3: `SELECT long_url FROM urls WHERE short_url = 'Kz8mQ4x'`.

**T+32ms:** PostgreSQL returns the row (index scan, <5ms).

**T+33ms:** Read Service writes to Redis (`SET url:Kz8mQ4x <long_url> EX 86400`) and returns 301.

```text
Carlos → CDN (miss) → LB → Read Service → Redis (miss) → PostgreSQL shard 3 → cache populate → 301 (33ms)
```

### Phase 4 — Analytics (Async, Non-Blocking)

**T+28ms (parallel):** While returning the 301, the Read Service publishes a click event to Kafka:

```text
Kafka.produce("clicks", {
  short_url: "Kz8mQ4x",
  timestamp: "2026-05-19T14:23:07Z",
  geo: "BR-SP",
  referrer: "twitter.com",
  user_agent: "Chrome/126"
})
```

This is fire-and-forget — it does NOT add latency to the redirect. A ClickHouse consumer batch-inserts these events every 10 seconds.

---

## 8. Failure & Recovery Scenarios

### Redis Goes Down

**Impact:** All reads fall through to PostgreSQL. At 40K reads/sec, PostgreSQL (with read replicas) can handle it — but latency increases from 1ms to 5-10ms.

**Mitigation:** Redis Cluster with 3 replicas per shard. If one master dies, a replica promotes in <5s. During the gap, PostgreSQL serves reads. CDN cache absorbs most viral traffic regardless.

### A PostgreSQL Shard Goes Down

**Impact:** 1/6th of URLs become temporarily unresolvable (only the ones not in Redis cache).

**Mitigation:** Each shard has synchronous replication to a standby. Automatic failover in <30s. During failover, Redis serves 95%+ of reads — only cold URLs are affected.

### ID Service Goes Down

**Impact:** No new URLs can be created. Existing redirects are unaffected.

**Mitigation:** Each Write Service holds 10,000 pre-allocated IDs locally. At 200 writes/sec peak, that's 50 seconds of buffer. If the ID service is down for <50s, nobody notices. Beyond that, return `503 Service Unavailable` for writes only — reads continue normally.

---

## 9. Data Model

```text
/* PostgreSQL — Sharded by hash(short_url) */

CREATE TABLE urls (
    short_url   VARCHAR(7)  PRIMARY KEY,
    long_url    TEXT        NOT NULL,
    user_id     BIGINT,                    -- nullable (anonymous creates allowed)
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,               -- NULL = never expires
    click_count BIGINT      DEFAULT 0      -- denormalized, updated async
);

CREATE INDEX idx_long_url ON urls (long_url);  -- for dedup lookups
CREATE INDEX idx_expires  ON urls (expires_at) WHERE expires_at IS NOT NULL;
```

```text
/* Redis — Key structure */

SET url:Kz8mQ4x "https://techconf.io/2026/register" EX 86400
    ^key         ^value                                ^TTL 24h

/* ClickHouse — Analytics (columnar, append-only) */

CREATE TABLE clicks (
    short_url   String,
    clicked_at  DateTime,
    country     LowCardinality(String),
    referrer    String,
    user_agent  String
) ENGINE = MergeTree()
ORDER BY (short_url, clicked_at);
```

---

## 10. Algorithms Under the Hood

### Base62 Encoding

```text
ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

function encode(num):
    result = ""
    while num > 0:
        result = ALPHABET[num % 62] + result
        num = num / 62  (integer division)
    return result.padLeft(7, '0')

encode(1000000000) → "15FTGf"  (6 chars, pad to 7 → "015FTGf")
encode(3500000000000) → max 7 chars used

function decode(str):
    num = 0
    for char in str:
        num = num * 62 + ALPHABET.indexOf(char)
    return num
```

### Cache-Aside Pattern (Read Path)

```text
function redirect(short_url):
    // Step 1: Check cache
    long_url = redis.GET("url:" + short_url)
    if long_url != null:
        return 301(long_url)    // cache hit — 1ms

    // Step 2: Cache miss → database
    shard = hash(short_url) % NUM_SHARDS
    long_url = postgres[shard].query(
        "SELECT long_url FROM urls WHERE short_url = $1", short_url
    )
    if long_url == null:
        return 404("URL not found")

    // Step 3: Populate cache for next time
    redis.SET("url:" + short_url, long_url, EX=86400)

    // Step 4: Async analytics
    kafka.produce("clicks", {short_url, timestamp, geo, referrer})

    return 301(long_url)
```

### ID Range Allocation

```text
/* ID Service (centralized counter) */
function allocate_range(server_id, block_size=10000):
    BEGIN TRANSACTION
    current = SELECT counter FROM id_counter FOR UPDATE
    UPDATE id_counter SET counter = current + block_size
    COMMIT
    return {start: current, end: current + block_size - 1}

/* Write Service (local consumption, no network per ID) */
function next_id():
    if local_counter >= range.end:
        range = id_service.allocate_range(my_server_id)
        local_counter = range.start
    local_counter += 1
    return local_counter
```

---

## 11. Scaling Considerations

| Challenge | Solution | Numbers |
|---|---|---|
| Viral URL (millions of clicks/min) | CDN caches 301 response at edge | CDN absorbs 60%+ before origin sees it |
| Database growth (3.6 TB/5yr) | Hash-based sharding (6 shards × 600 GB) | Add shards via consistent hashing |
| Read replica lag | Reads go to cache first (95% hit rate) | Only cold reads hit replicas |
| Global latency | CDN PoPs in 50+ countries | Edge-cached redirects = 5ms |
| URL expiration | Background job scans `expires_at` index hourly | Deletes expired rows, evicts from Redis |
| Deduplication | Optional: index on `long_url`, return existing short if found | Saves storage, trades write latency |

---

## 12. URL Abuse & Security

URL shorteners are inherently **phishing vectors** — a malicious destination is hidden behind an opaque short link, and users cannot inspect where they'll land before clicking.

| Threat | Mitigation |
|---|---|
| **Malicious destinations** | Check URLs against Google Safe Browsing API at creation time; reject known-bad URLs |
| **Stale abuse** | Periodic re-scanning of stored URLs (destinations can change after shortening) |
| **ID space exhaustion** | Rate limiting on the write path (per IP, per API key) to prevent adversarial ID consumption |
| **Read-path DDoS** | Rate limit per IP at the load balancer (e.g., 1000 req/sec per IP). CDN naturally absorbs volumetric attacks. For application-layer abuse (rotating IPs hitting non-existent short URLs to bypass cache), use a Bloom filter to reject URLs that were never created — zero DB hit for invalid lookups. |
| **User trust** | URL preview/interstitial page for unknown or flagged destinations (e.g., "You are being redirected to X. Continue?") |
| **Enumeration attack** | Attacker iterates through short URLs (aaa0001, aaa0002...) to discover all destinations. Mitigation: Base62 encoding of non-sequential IDs (Snowflake includes timestamp + randomness), making enumeration impractical. |

These measures add minimal write-path latency (Safe Browsing lookup is ~20ms) and protect both end users and the platform's domain reputation.

---

## 13. What If the Interviewer Pushes Back?

Real interviews test your ability to defend and adapt your design. Here are the most common challenges and how to handle them:

??? question "What if I don't want a single point of failure in the ID generation service?"
    **Adapt:** Switch to a **distributed ID scheme** — each server generates its own IDs using a combination of `timestamp + server_id + sequence_number` (like Twitter's Snowflake). No central coordination needed. Trade-off: IDs are no longer strictly sequential, but they're still unique and roughly time-ordered. This eliminates the SPOF at the cost of slightly longer IDs (64-bit vs 43-bit).

??? question "100:1 read-write ratio seems generous. What if it's 1000:1 (like a viral tweet shortener)?"
    **Adapt:** At 1000:1, the CDN becomes your primary serving layer, not Redis. You'd push TTLs to 7 days at the CDN edge, accept slightly stale redirects for expired URLs (serve the redirect, async-check expiry, lazy-delete on next cache miss). Redis becomes a warm fallback, not the primary cache. The DB barely gets touched — maybe 0.1% of reads reach it.

??? question "What if the interviewer says 'DynamoDB, not PostgreSQL' — how does the design change?"
    **Adapt:** DynamoDB simplifies operations (no sharding logic, no replicas to manage) but changes your consistency model. Use `short_url` as the partition key for single-digit ms reads. Custom alias uniqueness check becomes a conditional write (`attribute_not_exists`). You lose transactional multi-row writes — but for a URL shortener, you never need them. The Kafka + ClickHouse analytics pipeline stays identical.

??? question "How do you handle a viral URL that gets 10M clicks in 1 minute?"
    **Defend:** This is exactly why CDN is layer 1. A 301 cached at the CDN edge means the origin never sees 99% of that traffic. If the URL is somehow not cached (just created, 302 mode for analytics), Redis handles 10M reads/minute trivially — that's 166K reads/sec, and a single Redis cluster handles 1M+ ops/sec. The key insight: viral traffic is inherently cacheable because it's the SAME URL being requested.

??? question "What about URL expiration — won't stale cache entries serve expired URLs?"
    **Defend:** Yes, briefly. A URL that expired 5 minutes ago might still be cached at the CDN (24h TTL) or Redis (24h TTL). This is an acceptable trade-off — the alternative (checking expiry on every read) adds a DB lookup to the hot path, defeating the purpose of caching. For strict expiration: reduce cache TTL to 1 hour, or use 302 redirects so every request comes through your service where you can check expiry before redirecting.

??? question "Why not just use a hash (like MD5) and avoid the ID service entirely?"
    **Defend:** You could — and it's simpler. MD5 (truncated to 7 chars of Base62) works if you accept: (1) collision resolution via DB lookup on every write, (2) same long URL always produces same short URL (dedup for free), (3) slightly higher write latency. The counter-based approach is better at scale because writes are zero-coordination — no DB check needed. For < 1M URLs/month, hash-based is simpler and perfectly fine.

---

## 14. Quick Recall

| Question | Answer |
|---|---|
| Encoding? | Base62, 7 chars = 3.5 trillion unique URLs |
| Why not MD5/SHA? | Collision risk at scale, requires DB check on every write |
| ID generation? | Pre-allocated ranges per server. Zero coordination per ID. |
| Read optimization? | CDN → Redis → DB (3 layers). 95%+ served from cache. |
| Write optimization? | Local ID counter (no network per write), async cache warm |
| Why sharded PostgreSQL? | 3.6 TB doesn't fit one machine. hash(short_url) mod N for even distribution |
| Analytics approach? | Async via Kafka → ClickHouse. Never blocks the redirect path. |
| 301 vs 302? | 301 = cacheable (less load). 302 = every click counted (analytics). |
| Failure mode? | Redis down → DB handles reads (slower). DB shard down → Redis serves 95%. |
| Cache eviction? | LRU. Hot URLs stay. Cold URLs fall through to DB. |
