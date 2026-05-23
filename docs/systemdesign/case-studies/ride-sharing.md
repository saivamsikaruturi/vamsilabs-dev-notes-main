# Ride Sharing (Uber/Lyft)

!!! danger "Real Incident: Uber's New Year's Eve Outage, 2015"
    At midnight on NYE 2015, Uber's matching service received 5x its normal traffic across every major US city simultaneously. The dispatch system — which handled both location ingestion and driver matching in a single monolith — collapsed under the write amplification: 1.7M location updates/sec were contending with matching queries on the same Redis instance. Riders saw "no cars available" despite thousands of idle drivers nearby. The matching algorithm was scanning stale location data (30-60 seconds old), dispatching drivers who had already moved miles away. The outage lasted 25 minutes in NYC and SF. **Post-mortem fix:** Uber decoupled the hot write path (location ingestion) from the hot read path (matching queries) into separate services with independent scaling. They also built the H3 hexagonal spatial index to replace geohash-based lookups, eliminating boundary edge effects that caused 15% of matches to fail at cell borders. The lesson: **never let your highest-throughput write path share infrastructure with your latency-sensitive read path.**

---

## System Design Concepts Used

`Geospatial Indexing (GEOADD/GEORADIUS)` · `WebSocket (Real-Time Tracking)` · `Expanding Radius Search` · `Consistent Hashing` · `City-Based Sharding` · `Event-Driven Architecture (Kafka)` · `State Machine (Trip Lifecycle)` · `Surge Pricing (Supply/Demand)` · `Pre-Authorization (Payments)` · `ETA Estimation (Graph + Traffic)` · `Heartbeat / Liveness Detection` · `CQRS (Location Writes vs. Matching Reads)`

---

## 1. Functional Requirements

1. **Request a ride** — rider specifies pickup and dropoff locations, receives fare estimate and ETA
2. **Match rider with nearest available driver** — system finds optimal driver using geospatial proximity, ETA, and driver rating
3. **Real-time tracking** — both rider and driver see each other's live location on a map (updates every 3-4 seconds)
4. **Dynamic fare calculation** — base fare + distance + time + surge multiplier, calculated at trip completion for accuracy
5. **Payment processing** — pre-authorize estimated fare, hold during trip, capture exact amount on completion
6. **ETA estimation** — predict arrival time using road network graph weighted by real-time traffic data
7. **Trip state management** — full lifecycle: REQUESTED → MATCHED → EN_ROUTE → IN_PROGRESS → COMPLETED/CANCELLED
8. **Driver availability management** — track online/offline status, current trip status, and location in real time

## 2. Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Availability** | 99.99% (< 52 min/year) | Riders stranded without rides is unacceptable |
| **Match latency** | < 30 seconds end-to-end | Rider patience threshold before cancellation |
| **Location freshness** | < 4 seconds stale | Stale locations cause bad matches (driver 2km away, not 200m) |
| **Location throughput** | 1.7M updates/sec | 5M concurrent drivers × 1 update per 3 seconds |
| **ETA accuracy** | +/- 2 minutes | Rider trust depends on accurate predictions |
| **Payment reliability** | Zero double-charges | Financial errors destroy user trust permanently |
| **Global scale** | 20M rides/day across 900+ cities | City-based isolation for fault containment |
| **Consistency model** | Eventual for locations, strong for payments | Location staleness acceptable; payment errors are not |

---

## 3. Capacity Estimation

```text
/* ━━━ NAPKIN MATH: Uber-Scale Ride Sharing ━━━ */

/* ━━━ RIDES ━━━ */
Rides/day:               20M
Rides/sec (avg):         20M / 86,400 ≈ 230 rides/sec
Rides/sec (peak 5x):    230 × 5 = 1,150 rides/sec (Friday night, NYE)
Rides/sec (NYE spike):   230 × 10 = 2,300 rides/sec

/* ━━━ LOCATION UPDATES (Hot Write Path) ━━━ */
Active drivers:          5M concurrent
Update frequency:        1 update every 3 seconds
Location updates/sec:    5M / 3 ≈ 1,700,000 updates/sec  ← THIS dominates
Payload per update:      driver_id(8B) + lat(8B) + lon(8B) + ts(8B) + heading(4B) + speed(4B) = 40 bytes
Ingestion bandwidth:     1.7M × 40 bytes = 68 MB/sec sustained

/* ━━━ MATCHING QUERIES ━━━ */
Matching attempts/sec:   1,150 × 3 (avg retries per ride) = 3,450 geo queries/sec
Each GEORADIUS scans:    ~50-200 drivers per query
Matching decisions/sec:  3,450 queries/sec peak

/* ━━━ GEOSPATIAL INDEX (In-Memory) ━━━ */
Drivers in index:        5M
Per driver entry:        driver_id(8B) + geo_score(8B) + metadata(34B) = 50 bytes
Total index size:        5M × 50 bytes = 250 MB  ← fits in ONE Redis instance
With replication (3x):   750 MB total

/* ━━━ STORAGE ━━━ */
Trip record size:        ~1 KB (locations, fare, metadata, payment ref)
Trip storage/day:        20M × 1 KB = 20 GB/day
Trip storage/year:       7.3 TB/year
Location history/day:    1.7M/sec × 86,400 × 40B = 5.9 TB/day (cold storage only)

/* ━━━ WEBSOCKET CONNECTIONS ━━━ */
Active riders tracking:  ~10M concurrent (rider + driver per trip × 5M active trips)
WebSocket messages/sec:  10M connections × 1 msg/3s = 3.3M messages/sec outbound
```

!!! note "System Nature"
    **Write-heavy on location ingestion, read-heavy on matching.** The architecture must separate these two paths: locations stream in at 1.7M/sec (write-optimized), while matching queries need sub-5ms geospatial lookups (read-optimized). These are fundamentally different access patterns that cannot share infrastructure.

---

## 4. "Why X, Not Y?" — Tradeoff Analysis

### Why Redis GEOADD/GEORADIUS and not PostgreSQL PostGIS?

**Redis wins because 1.7M writes/sec with sub-millisecond read latency is impossible for any disk-based system.** The entire driver location dataset (250 MB for 5M drivers) fits in RAM. Redis GEOADD is O(log N) — updating 1.7M locations/sec is feasible because it's pure memory operations with no disk I/O, no WAL, no MVCC overhead. GEORADIUS returns all drivers within a radius in < 1ms.

PostGIS stores geospatial data on disk with B-tree/GiST indexes. Even with SSDs, you'd get ~50K writes/sec per PostgreSQL instance — 34 shards just to handle ingestion. Reads require disk I/O for cold data. PostGIS is ideal for static geospatial data (zip code boundaries, map tiles), but not for data that changes 1.7M times per second.

*PostGIS advantage:* Complex spatial queries (polygon intersections, route containment), persistent storage, SQL joins with trip data. Use PostGIS for analytics queries on historical location data, not the real-time hot path.

### Why expanding radius search and not fixed radius?

**Expanding radius guarantees a match in dense AND sparse areas without wasting compute.** Start at 1 km — in Manhattan, you'll find 50+ drivers immediately. In rural Kansas, you'll find zero. Fixed radius forces a choice: too small (no matches in sparse areas) or too large (scanning thousands of candidates in dense areas, wasting CPU).

Expanding radius: 1 km → 2 km → 4 km → 8 km → 16 km. In NYC, the first ring (1 km) returns enough candidates — done in one query. In rural areas, you expand 4-5 times but still find a match. The algorithm is self-tuning to density.

*Fixed radius advantage:* Simpler implementation, predictable latency (always one query). Use if your service only operates in uniformly dense areas (e.g., a bike-sharing app in a single city center).

### Why eventual consistency for locations and not strong consistency?

**Strong consistency for 1.7M writes/sec would require distributed consensus (Raft/Paxos) on every update — adding 10-50ms latency per write, reducing throughput by 10x.** A driver's location being 3-4 seconds stale is perfectly acceptable: at 30 mph, a car moves ~40 meters in 3 seconds. The matching algorithm already accounts for ETA, not exact position.

If we required strong consistency (every matching query sees the absolute latest position), we'd need synchronous replication across geo-index replicas before acknowledging writes. At 1.7M writes/sec, this would create a bottleneck that reduces throughput to ~100K writes/sec — requiring 17x more Redis instances.

*Strong consistency advantage:* Guarantees no stale matches. Use for systems where position accuracy is safety-critical (air traffic control, autonomous vehicle coordination).

### Why city-based sharding and not global?

**A driver in NYC will NEVER be matched with a rider in San Francisco — geographic locality is inherent to the domain.** City-based sharding gives us: (1) fault isolation — an outage in the NYC shard doesn't affect SF; (2) data locality — all matching queries stay within one shard, zero cross-shard joins; (3) independent scaling — NYC needs 10x the capacity of Des Moines.

Global sharding (e.g., hash by driver_id) would scatter NYC drivers across all shards, requiring fan-out queries to find nearby drivers. A GEORADIUS for one rider would hit every shard — turning a 1ms query into a 20ms distributed gather operation.

*Global sharding advantage:* Uniform load distribution, simpler capacity planning. Use for systems without inherent geographic locality (e.g., a global chat system where any user can message any other user).

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
    <marker id="ab" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#1976D2"/>
    </marker>
    <filter id="sh" x="-3%" y="-3%" width="106%" height="106%">
      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="1100" height="750" fill="#FAFAFA" rx="8"/>

  <!-- Title -->
  <text x="550" y="28" text-anchor="middle" font-size="18" font-weight="800" fill="#212121">Ride Sharing — System Architecture</text>
  <text x="550" y="48" text-anchor="middle" font-size="11" fill="#757575">20M rides/day | 1.7M location updates/sec | &lt;30s matching | City-based sharding</text>

  <!-- ═══ LAYER 1: Clients ═══ -->
  <rect x="40" y="60" width="1020" height="65" rx="10" fill="#E3F2FD" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="76" font-size="10" font-weight="600" fill="#9E9E9E">Clients</text>

  <rect x="60" y="82" width="220" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="170" y="100" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Rider App (iOS/Android)</text>
  <text x="170" y="112" text-anchor="middle" font-size="8" fill="#757575">Request ride | Track driver | Pay</text>

  <rect x="310" y="82" width="220" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="420" y="100" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Driver App (iOS/Android)</text>
  <text x="420" y="112" text-anchor="middle" font-size="8" fill="#757575">Stream location | Accept rides</text>

  <rect x="560" y="82" width="220" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="670" y="100" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Admin Dashboard</text>
  <text x="670" y="112" text-anchor="middle" font-size="8" fill="#757575">Monitor | Surge control | Analytics</text>

  <rect x="810" y="82" width="220" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="920" y="100" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Third-Party API</text>
  <text x="920" y="112" text-anchor="middle" font-size="8" fill="#757575">Uber for Business | Integrations</text>

  <!-- ═══ LAYER 2: API Gateway + WebSocket ═══ -->
  <line x1="350" y1="125" x2="350" y2="148" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <line x1="550" y1="125" x2="550" y2="148" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="200" y="148" width="700" height="50" rx="8" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5" filter="url(#sh)"/>
  <text x="550" y="168" text-anchor="middle" font-size="13" font-weight="700" fill="#F57F17">API Gateway + WebSocket Proxy</text>
  <text x="550" y="186" text-anchor="middle" font-size="9" fill="#757575">Auth | Rate Limit | Route | Persistent WebSocket for real-time tracking | City-based routing</text>

  <!-- ═══ LAYER 3: Core Services ═══ -->
  <line x1="300" y1="198" x2="200" y2="240" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <line x1="450" y1="198" x2="420" y2="240" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <line x1="650" y1="198" x2="680" y2="240" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <line x1="800" y1="198" x2="900" y2="240" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <rect x="40" y="230" width="1020" height="100" rx="10" fill="#E8F5E9" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="246" font-size="10" font-weight="600" fill="#9E9E9E">Core Services (Stateless, City-Sharded)</text>

  <!-- Trip Service -->
  <rect x="60" y="255" width="200" height="42" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="160" y="272" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Trip Service</text>
  <text x="160" y="289" text-anchor="middle" font-size="9" fill="#757575">State machine | Orchestrator</text>

  <!-- Location Service -->
  <rect x="290" y="255" width="220" height="42" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="400" y="272" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Location Service</text>
  <text x="400" y="289" text-anchor="middle" font-size="9" fill="#757575">Ingest 1.7M/sec | Update geo-index</text>

  <!-- Matching Service -->
  <rect x="540" y="255" width="220" height="42" rx="6" fill="#FFE0B2" stroke="#F57C00" stroke-width="1.5" filter="url(#sh)"/>
  <text x="650" y="272" text-anchor="middle" font-size="12" font-weight="600" fill="#E65100">Matching Service</text>
  <text x="650" y="289" text-anchor="middle" font-size="9" fill="#757575">GEORADIUS | Expanding radius | Score</text>

  <!-- Pricing Service -->
  <rect x="790" y="255" width="200" height="42" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="890" y="272" text-anchor="middle" font-size="12" font-weight="600" fill="#311B92">Pricing Service</text>
  <text x="890" y="289" text-anchor="middle" font-size="9" fill="#757575">Surge | Fare estimate | Final fare</text>

  <!-- Second row of services -->
  <rect x="60" y="300" width="200" height="22" rx="4" fill="#B2DFDB" stroke="#00695C" stroke-width="1" filter="url(#sh)"/>
  <text x="160" y="315" text-anchor="middle" font-size="10" font-weight="600" fill="#004D40">Payment Service</text>

  <rect x="290" y="300" width="220" height="22" rx="4" fill="#B2DFDB" stroke="#00695C" stroke-width="1" filter="url(#sh)"/>
  <text x="400" y="315" text-anchor="middle" font-size="10" font-weight="600" fill="#004D40">ETA Service</text>

  <rect x="540" y="300" width="220" height="22" rx="4" fill="#B2DFDB" stroke="#00695C" stroke-width="1" filter="url(#sh)"/>
  <text x="650" y="315" text-anchor="middle" font-size="10" font-weight="600" fill="#004D40">Notification Service</text>

  <rect x="790" y="300" width="200" height="22" rx="4" fill="#B2DFDB" stroke="#00695C" stroke-width="1" filter="url(#sh)"/>
  <text x="890" y="315" text-anchor="middle" font-size="10" font-weight="600" fill="#004D40">Driver Availability</text>

  <!-- ═══ LAYER 4: Data Stores ═══ -->
  <rect x="40" y="360" width="1020" height="165" rx="10" fill="#E8EAF6" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="376" font-size="10" font-weight="600" fill="#9E9E9E">Data Layer</text>

  <!-- Redis Geo-Index -->
  <line x1="400" y1="297" x2="200" y2="388" stroke="#D32F2F" stroke-width="1.5" marker-end="url(#ar)"/>
  <text x="280" y="345" font-size="8" fill="#D32F2F">write locations</text>
  <rect x="60" y="388" width="280" height="55" rx="8" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="200" y="408" text-anchor="middle" font-size="13" font-weight="700" fill="#B71C1C">Redis Geo-Index</text>
  <text x="200" y="424" text-anchor="middle" font-size="9" fill="#757575">GEOADD / GEORADIUS | 5M drivers | 250 MB</text>
  <text x="200" y="437" text-anchor="middle" font-size="8" fill="#757575">Sharded by city: redis-nyc, redis-sf, redis-lon</text>

  <!-- Arrow from Matching to Redis -->
  <line x1="650" y1="297" x2="340" y2="400" stroke="#D32F2F" stroke-width="1.2" stroke-dasharray="5,3" marker-end="url(#ar)"/>
  <text x="520" y="345" font-size="8" fill="#D32F2F">GEORADIUS query</text>

  <!-- Trip Database -->
  <line x1="160" y1="297" x2="550" y2="455" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <path d="M420,458 L420,498 C420,513 680,513 680,498 L680,458" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="550" cy="458" rx="130" ry="12" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="550" cy="458" rx="130" ry="12" fill="#283593" opacity="0.1"/>
  <text x="550" y="478" text-anchor="middle" font-size="12" font-weight="600" fill="#1A237E">Trip Store (PostgreSQL)</text>
  <text x="550" y="494" text-anchor="middle" font-size="9" fill="#757575">ACID | Sharded by city | Trips, Users, Payments</text>
  <text x="550" y="508" text-anchor="middle" font-size="8" fill="#757575">Strong consistency for financial transactions</text>

  <!-- Road Network / ETA -->
  <rect x="750" y="388" width="260" height="55" rx="8" fill="#B2EBF2" stroke="#00838F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="880" y="408" text-anchor="middle" font-size="12" font-weight="600" fill="#006064">Road Network Graph</text>
  <text x="880" y="424" text-anchor="middle" font-size="9" fill="#757575">Dijkstra + real-time traffic weights</text>
  <text x="880" y="437" text-anchor="middle" font-size="8" fill="#757575">Pre-computed routes | A* optimization</text>
  <line x1="400" y1="322" x2="750" y2="410" stroke="#00838F" stroke-width="1" stroke-dasharray="4,3" marker-end="url(#a)"/>
  <text x="600" y="360" font-size="8" fill="#00838F">ETA lookup</text>

  <!-- ═══ LAYER 5: Event Streaming ═══ -->
  <rect x="40" y="540" width="1020" height="60" rx="10" fill="#37474F" stroke="#263238" stroke-width="1.5" filter="url(#sh)"/>
  <text x="52" y="556" font-size="10" font-weight="600" fill="#B0BEC5">Event Streaming (Kafka)</text>
  <text x="550" y="575" text-anchor="middle" font-size="12" font-weight="600" fill="#ECEFF1">trip-events | location-history | pricing-signals | payment-events | analytics</text>
  <text x="550" y="592" text-anchor="middle" font-size="9" fill="#78909C">Partitioned by city_id | 7-day retention | Consumed by analytics, ML training, audit</text>

  <line x1="160" y1="330" x2="160" y2="540" stroke="#546E7A" stroke-width="1" stroke-dasharray="4,3" marker-end="url(#a)"/>
  <line x1="650" y1="330" x2="650" y2="540" stroke="#546E7A" stroke-width="1" stroke-dasharray="4,3" marker-end="url(#a)"/>
  <line x1="890" y1="297" x2="890" y2="540" stroke="#546E7A" stroke-width="1" stroke-dasharray="4,3" marker-end="url(#a)"/>

  <!-- ═══ LAYER 6: External ═══ -->
  <rect x="60" y="620" width="200" height="40" rx="6" fill="#FFF3E0" stroke="#E65100" stroke-width="1.5" filter="url(#sh)"/>
  <text x="160" y="638" text-anchor="middle" font-size="11" font-weight="600" fill="#BF360C">Payment Gateway</text>
  <text x="160" y="652" text-anchor="middle" font-size="8" fill="#757575">Stripe / Braintree</text>

  <rect x="290" y="620" width="200" height="40" rx="6" fill="#FFF3E0" stroke="#E65100" stroke-width="1.5" filter="url(#sh)"/>
  <text x="390" y="638" text-anchor="middle" font-size="11" font-weight="600" fill="#BF360C">Maps Provider</text>
  <text x="390" y="652" text-anchor="middle" font-size="8" fill="#757575">Google Maps / Mapbox</text>

  <rect x="520" y="620" width="200" height="40" rx="6" fill="#FFF3E0" stroke="#E65100" stroke-width="1.5" filter="url(#sh)"/>
  <text x="620" y="638" text-anchor="middle" font-size="11" font-weight="600" fill="#BF360C">Push Notifications</text>
  <text x="620" y="652" text-anchor="middle" font-size="8" fill="#757575">APNs / FCM</text>

  <rect x="750" y="620" width="260" height="40" rx="6" fill="#FFF3E0" stroke="#E65100" stroke-width="1.5" filter="url(#sh)"/>
  <text x="880" y="638" text-anchor="middle" font-size="11" font-weight="600" fill="#BF360C">ML Platform (Michelangelo)</text>
  <text x="880" y="652" text-anchor="middle" font-size="8" fill="#757575">Demand prediction | Surge | ETA models</text>

  <!-- ═══ LEGEND ═══ -->
  <rect x="40" y="680" width="1020" height="35" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="56" y="702" font-size="10" font-weight="700" fill="#757575">Legend:</text>
  <rect x="110" y="693" width="18" height="12" rx="3" fill="#BBDEFB" stroke="#1976D2" stroke-width="1"/>
  <text x="133" y="703" font-size="9" fill="#757575">Client</text>
  <rect x="175" y="693" width="18" height="12" rx="3" fill="#FFF9C4" stroke="#F9A825" stroke-width="1"/>
  <text x="198" y="703" font-size="9" fill="#757575">Gateway</text>
  <rect x="250" y="693" width="18" height="12" rx="3" fill="#C8E6C9" stroke="#388E3C" stroke-width="1"/>
  <text x="273" y="703" font-size="9" fill="#757575">Service</text>
  <rect x="320" y="693" width="18" height="12" rx="3" fill="#FFE0B2" stroke="#F57C00" stroke-width="1"/>
  <text x="343" y="703" font-size="9" fill="#757575">Matching</text>
  <rect x="398" y="693" width="18" height="12" rx="3" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1"/>
  <text x="421" y="703" font-size="9" fill="#757575">Geo-Index</text>
  <rect x="480" y="693" width="18" height="12" rx="3" fill="#D1C4E9" stroke="#512DA8" stroke-width="1"/>
  <text x="503" y="703" font-size="9" fill="#757575">Pricing</text>
  <ellipse cx="555" cy="699" rx="10" ry="6" fill="#E8EAF6" stroke="#283593" stroke-width="1"/>
  <text x="571" y="703" font-size="9" fill="#757575">Database</text>
  <rect x="625" y="693" width="18" height="12" rx="3" fill="#37474F" stroke="#263238" stroke-width="1"/>
  <text x="648" y="703" font-size="9" fill="#757575">Kafka</text>
  <rect x="690" y="693" width="18" height="12" rx="3" fill="#FFF3E0" stroke="#E65100" stroke-width="1"/>
  <text x="713" y="703" font-size="9" fill="#757575">External</text>
  <line x1="770" y1="699" x2="795" y2="699" stroke="#546E7A" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="802" y="703" font-size="9" fill="#757575">Sync</text>
  <line x1="840" y1="699" x2="865" y2="699" stroke="#D32F2F" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#ar)"/>
  <text x="872" y="703" font-size="9" fill="#757575">Geo query</text>
</svg>
</div>

---

## 6. Backend Services Explained

### Trip Service (Orchestrator)
The brain of the system. Manages the entire ride lifecycle through a state machine: REQUESTED → MATCHED → EN_ROUTE → IN_PROGRESS → COMPLETED. It coordinates between Matching, Pricing, Payment, and Notification services using a saga pattern. Every state transition is persisted to PostgreSQL before side effects are triggered. If the Trip Service crashes mid-transition, it recovers by replaying from the last persisted state. It also handles cancellation logic (who pays the cancellation fee based on timing) and dispute resolution triggers.

### Location Service (Hot Write Path)
The highest-throughput service in the system — ingesting 1.7M GPS updates per second. Each update contains latitude, longitude, heading, speed, and timestamp. The service validates coordinates (rejects GPS drift > 200 km/h implied speed), then writes to the city-specific Redis geo-index via GEOADD. It also publishes to Kafka's `location-history` topic for offline analytics and route reconstruction. This service is completely stateless — any instance can process any driver's update. Scaling is horizontal: add more instances behind the WebSocket proxy.

### Matching Service (Core Algorithm)
Receives a ride request (pickup lat/lon, destination) and finds the optimal driver. Executes an expanding radius GEORADIUS query against the city's Redis geo-index. Candidates are scored by a weighted function: `0.5 * ETA + 0.3 * distance + 0.2 * driver_rating`. The top candidate receives a ride offer via push notification. If the driver doesn't accept within 15 seconds, the next candidate is offered. After 3 rejections or timeouts, the radius expands and a new candidate pool is generated. The service is idempotent — if it crashes mid-matching, the Trip Service detects the timeout and retriggers.

### Pricing Service (Surge)
Calculates fare estimates (before trip) and final fares (after trip). Maintains a real-time supply/demand heatmap using H3 hexagonal cells (resolution 7, ~5 km). Every 30 seconds, it recalculates the surge multiplier per cell: `surge = max(1.0, demand_count / supply_count * scaling_factor)`. Surge is capped at 8x and smoothed (changes by at most 0.5x per interval to avoid price shock). The service exposes both a "current surge" API (for fare estimates) and a "lock surge" API (freezes the multiplier for 5 minutes after a rider confirms).

### Payment Service
Handles the financial lifecycle: pre-authorize estimated fare when ride is confirmed, adjust hold if route deviates significantly, capture exact amount on completion. Uses idempotency keys to prevent double-charges during retries. Integrates with Stripe/Braintree via a circuit breaker pattern — if the payment gateway is down, trips complete normally and charges are retried asynchronously. Maintains a ledger of all transactions for dispute resolution and regulatory compliance.

### ETA Service
Predicts time-of-arrival using a weighted road network graph. Edges represent road segments with weights based on: (1) segment length, (2) speed limit, (3) real-time traffic coefficient (updated every 60 seconds from driver GPS traces), (4) time-of-day patterns (ML model). Uses A* algorithm with traffic-weighted heuristics. Returns both "time to pickup" (driver → rider) and "time to destination" (pickup → dropoff). The graph is city-specific and pre-loaded in memory (~2 GB per major city).

### Notification Service
Manages all push notifications (ride offer to driver, driver arriving, trip completed) and real-time WebSocket updates (live location tracking). Maintains persistent WebSocket connections to all active riders and drivers (~10M concurrent). When a driver's location updates, the Notification Service fans out the new position to the matched rider's WebSocket connection. Uses connection affinity (sticky sessions) to avoid reconnection overhead.

---

## 7. Architecture Flow — Raj Requests a Ride in Bangalore

A rider named **Raj** in Bangalore opens the Uber app at 8:45 AM to request a ride to the airport (Kempegowda International, 35 km away) during morning rush hour.

### Phase 1 — Ride Request and Fare Estimate

**T+0ms:** Raj taps "Request Ride." The Rider App sends his pickup location (12.9716N, 77.5946E) and destination to the API Gateway via HTTPS.

**T+15ms:** API Gateway authenticates Raj's token, applies rate limiting, and routes to the **Trip Service** in the `bangalore` shard.

**T+20ms:** Trip Service calls **Pricing Service**: "What's the fare estimate for this route with current surge?"

**T+25ms:** Pricing Service checks the H3 cell containing Raj's pickup. Current state: 45 ride requests in the last 5 minutes, 30 available drivers → surge multiplier = 1.5x. Estimated fare: base (50 INR) + distance (35 km × 12 INR/km) + time (45 min × 2 INR/min) + surge (1.5x) = **approximately 840 INR**.

**T+30ms:** Trip Service returns fare estimate to Raj. He confirms. Trip state → **REQUESTED**.

```text
Raj (Bangalore) → API Gateway → Trip Service → Pricing Service (surge 1.5x)
                                              → fare estimate: ₹840
                                              → Trip state: REQUESTED
```

### Phase 2 — Driver Matching (Expanding Radius)

**T+50ms:** Trip Service calls **Matching Service** with Raj's pickup coordinates.

**T+52ms:** Matching Service executes `GEORADIUS drivers:bangalore 77.5946 12.9716 1 km` on Redis. Returns 8 available drivers within 1 km.

**T+55ms:** For each candidate, Matching Service calls **ETA Service** to get real pickup time (accounting for one-way streets, traffic). Results: Driver A = 4 min, Driver B = 6 min, Driver C = 3 min (closest by road), Driver D = 8 min.

**T+60ms:** Scoring: Driver C wins (lowest ETA, 4.8 rating). **Matching Service** sends ride offer to Driver C via push notification.

**T+65ms - T+72s:** Driver C (Priya) sees the offer on her app: "Pickup: 3 min away, Destination: Airport (35 km), Est. fare: 840 INR." She taps **Accept** at T+8s.

**T+8.1s:** Trip state → **MATCHED**. Both Raj and Priya receive confirmation. Raj sees Priya's photo, car model (Honda City, KA-01-XX-1234), and live location.

```text
Matching Service → GEORADIUS (1km, 8 candidates) → ETA scoring → offer to Driver C
Driver C accepts → Trip state: MATCHED → notifications to both parties
```

### Phase 3 — Real-Time Tracking (Driver En Route to Pickup)

**T+8s to T+3.5min:** Priya's Driver App streams GPS coordinates every 3 seconds via WebSocket → Location Service → Redis GEOADD.

**Every 3 seconds:** Notification Service reads Priya's latest location from Redis and pushes it to Raj's WebSocket connection. Raj sees her car icon moving on the map in real-time.

**T+3min:** Priya is 200m away. Notification Service sends push: "Your driver is arriving." ETA updates from "3 min" to "1 min" to "Arriving now."

**T+3.5min:** Priya arrives at pickup. She taps "Arrived." Trip state → **EN_ROUTE** (waiting for rider).

```text
Driver App → WebSocket → Location Service → Redis GEOADD (every 3s)
Notification Service → WebSocket → Rider App (live map update)
```

### Phase 4 — Trip In Progress

**T+4min:** Raj gets in. Priya taps "Start Trip." Trip state → **IN_PROGRESS**.

**T+4min to T+49min:** The route to the airport. Location Service continues streaming Priya's coordinates. The Trip Service records the route polyline for fare calculation. ETA Service updates "time to destination" in real-time as traffic conditions change.

**T+35min:** Priya takes an alternate route to avoid a traffic jam detected by the ETA Service. The fare is distance-based, so the detour slightly increases the final fare. Trip Service recalculates continuously.

### Phase 5 — Trip Completion and Payment

**T+49min:** Priya arrives at the airport. She taps "End Trip." Trip state → **COMPLETED**.

**T+49.1s:** Trip Service calculates final fare: base (50) + actual distance (37.2 km × 12) + actual time (45 min × 2) + surge (1.5x) = **893 INR** (slightly more than estimate due to detour).

**T+49.2s:** Trip Service calls **Payment Service**: "Capture 893 INR from Raj's pre-authorized hold."

**T+49.5s:** Payment Service calls Stripe with idempotency key `trip_12345_capture`. Stripe captures from the pre-authorized hold (which was 1000 INR, 15% buffer above estimate). Remaining hold is released.

**T+50s:** Both Raj and Priya receive trip summary: route map, fare breakdown, option to rate each other. Trip event published to Kafka for analytics.

```text
Trip ends → final fare calculated → Payment capture → receipts sent
Trip event → Kafka → analytics, ML training, driver payouts
```

---

## 8. Failure & Recovery Scenarios

### Location Service Lag (Stale Driver Positions)

**Problem:** A Location Service instance becomes slow (GC pause, network issue). Driver positions in Redis become 15-30 seconds stale instead of 3-4 seconds. Matching Service dispatches drivers who've moved 500m+ from their indexed position.

**Detection:** Heartbeat monitor checks timestamp of latest update per driver. If `now - last_update > 10s`, mark driver as "position_uncertain."

**Recovery:** (1) Matching Service excludes "position_uncertain" drivers from initial candidate pool. (2) If all nearby drivers are uncertain, match anyway but add a "driver may be further than shown" warning. (3) Auto-scale Location Service horizontally — K8s HPA triggers on processing lag > 5s. (4) Driver app detects its updates aren't being acknowledged and switches to HTTP fallback (bypassing the slow WebSocket proxy).

### Matching Service Overload (NYE Scenario)

**Problem:** 5x normal ride requests flood the Matching Service. Queue depth grows, match latency exceeds 30 seconds. Riders cancel and re-request, creating a thundering herd.

**Detection:** Match latency p99 > 15s triggers alert. Queue depth > 10,000 triggers emergency scaling.

**Recovery:** (1) **Shed load gracefully** — return "high demand, longer wait times" to riders instead of timing out silently. (2) **Increase batch size** — instead of matching one-at-a-time, batch 50 requests in the same area and run a bipartite matching algorithm (Hungarian method) to optimally assign all at once. (3) **Reduce candidate scoring** — skip ETA Service calls, use straight-line distance as a proxy. Accuracy drops but throughput 10x's. (4) **Auto-scale** — Matching Service is stateless, new pods come up in 15s on pre-warmed nodes.

### Payment Gateway Timeout

**Problem:** Stripe/Braintree returns timeouts during trip completion. Riders complete trips but charges hang in "pending."

**Detection:** Circuit breaker opens after 3 consecutive timeouts (> 5 seconds each).

**Recovery:** (1) **Trip still completes normally** — payment is decoupled from trip state. Rider sees "payment processing" instead of a final receipt. (2) **Async retry with exponential backoff** — Payment Service writes charge intent to a durable queue (Kafka `payment-retries` topic). A consumer retries every 30s, 60s, 120s with the same idempotency key. (3) **Hold protects against loss** — the pre-authorized hold remains until either captured or expired (7 days). Uber never loses money; worst case is delayed settlement. (4) **If gateway is down > 1 hour** — switch to backup payment processor (Braintree → Adyen failover).

### Driver App Disconnects Mid-Trip

**Problem:** Priya's phone loses connectivity in a tunnel. No location updates for 2 minutes. Raj sees the driver icon frozen on the map.

**Detection:** Location Service detects no heartbeat for 30 seconds. Marks trip as "tracking_interrupted."

**Recovery:** (1) **Rider notification** — "Live tracking temporarily unavailable. Your trip is still active." (2) **Trip continues** — the trip state remains IN_PROGRESS. When the driver reconnects, all buffered GPS points from the phone's local storage are uploaded in bulk (the Driver App caches locally during disconnection). (3) **Fare calculation unaffected** — the phone's local GPS log is authoritative for distance. Even if server-side tracking has gaps, the driver's app reconstructs the full route on reconnection. (4) **Safety timeout** — if no reconnection for 10 minutes, Trip Service alerts a safety team and contacts both rider and driver via SMS.

---

## 9. Data Model

```text
/* ═══ PostgreSQL — Trip Store (Sharded by city_id) ═══ */

CREATE TABLE trips (
    trip_id         UUID        PRIMARY KEY,
    city_id         INTEGER     NOT NULL,              -- shard key
    rider_id        BIGINT      NOT NULL,
    driver_id       BIGINT,                            -- NULL until matched
    status          VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
                    -- REQUESTED | MATCHED | EN_ROUTE | IN_PROGRESS | COMPLETED | CANCELLED
    pickup_lat      DECIMAL(9,6) NOT NULL,
    pickup_lon      DECIMAL(9,6) NOT NULL,
    dropoff_lat     DECIMAL(9,6),
    dropoff_lon     DECIMAL(9,6),
    surge_multiplier DECIMAL(3,2) DEFAULT 1.00,        -- locked at request time
    estimated_fare  INTEGER,                           -- cents, shown to rider
    final_fare      INTEGER,                           -- cents, calculated at completion
    distance_meters INTEGER,                           -- actual route distance
    duration_seconds INTEGER,                          -- actual trip time
    route_polyline  TEXT,                              -- encoded polyline for map display
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    matched_at      TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    payment_id      UUID                               -- FK to payment ledger
);

CREATE INDEX idx_trips_rider   ON trips (rider_id, requested_at DESC);
CREATE INDEX idx_trips_driver  ON trips (driver_id, requested_at DESC);
CREATE INDEX idx_trips_status  ON trips (city_id, status) WHERE status IN ('REQUESTED','MATCHED','IN_PROGRESS');


/* ═══ Redis — Geospatial Index (Per City) ═══ */

-- One sorted set per city. Members = driver_id. Score = geohash encoding.
GEOADD drivers:bangalore 77.5946 12.9716 "driver_1001"
GEOADD drivers:bangalore 77.5980 12.9750 "driver_1002"

-- Query: find all drivers within 2km of rider
GEORADIUS drivers:bangalore 77.5946 12.9716 2 km WITHCOORD WITHDIST COUNT 20 ASC

-- Driver metadata (availability, vehicle type)
HSET driver:1001 status "available" vehicle "sedan" rating "4.8" last_update "1716100800"


/* ═══ Trip State Machine ═══ */

    REQUESTED ──→ MATCHED ──→ EN_ROUTE ──→ IN_PROGRESS ──→ COMPLETED
        │              │           │              │
        ▼              ▼           ▼              ▼
    CANCELLED    CANCELLED    CANCELLED     CANCELLED
   (by rider)  (by driver)  (by rider)    (by either - rare)

-- Transitions are atomic: UPDATE trips SET status = $1 WHERE trip_id = $2 AND status = $3
-- If affected_rows = 0, state already changed (concurrent update) → retry or abort
```

---

## 10. Algorithms Under the Hood

### Geospatial Nearest-Driver Search (GEORADIUS)

```text
function find_nearby_drivers(pickup_lat, pickup_lon, city_id, radius_km):
    /*
     * Redis GEORADIUS returns drivers sorted by distance.
     * O(N+log(M)) where N = elements in radius, M = total elements in set.
     * For 5M drivers, log(5M) ≈ 23 comparisons. Sub-millisecond.
     */
    candidates = redis.GEORADIUS(
        key   = "drivers:" + city_id,
        lon   = pickup_lon,
        lat   = pickup_lat,
        radius = radius_km,
        unit  = "km",
        WITHCOORD,           -- return each driver's lat/lon
        WITHDIST,            -- return distance from pickup
        COUNT 50,            -- limit to 50 nearest
        ASC                  -- sort by distance ascending
    )

    // Filter out unavailable drivers
    available = []
    for driver in candidates:
        meta = redis.HGETALL("driver:" + driver.id)
        if meta.status == "available" AND meta.last_update > (now - 30s):
            available.append(driver)

    return available
```

### Expanding Radius Matching

```text
function match_rider_to_driver(trip_id, pickup_lat, pickup_lon, city_id):
    radius = 1.0        // start at 1 km
    max_radius = 16.0   // give up at 16 km
    max_attempts = 3    // per radius level

    while radius <= max_radius:
        candidates = find_nearby_drivers(pickup_lat, pickup_lon, city_id, radius)

        if candidates is empty:
            radius = radius * 2     // expand: 1 → 2 → 4 → 8 → 16
            continue

        // Score candidates: lower is better
        scored = []
        for driver in candidates:
            eta = eta_service.get_eta(driver.lat, driver.lon, pickup_lat, pickup_lon)
            score = 0.5 * normalize(eta) +
                    0.3 * normalize(driver.distance) +
                    0.2 * (1 - normalize(driver.rating))  // higher rating = lower score
            scored.append({driver, score, eta})

        scored.sort_by(score, ASC)

        // Offer to candidates in order
        for i in range(min(max_attempts, len(scored))):
            offer = send_ride_offer(scored[i].driver, trip_id, timeout=15s)
            if offer.accepted:
                update_trip_status(trip_id, "MATCHED", scored[i].driver.id)
                mark_driver_unavailable(scored[i].driver.id)
                return SUCCESS

        // All candidates in this radius rejected/timed out
        radius = radius * 2

    return NO_DRIVERS_AVAILABLE   // trigger "no cars nearby" UX
```

### Surge Pricing Formula

```text
function calculate_surge(city_id, h3_cell_index):
    /*
     * H3 resolution 7 cell ≈ 5 km diameter.
     * Recalculated every 30 seconds.
     */
    time_window = 5 minutes

    // Count ride requests in this cell in last 5 minutes
    demand = count_requests(city_id, h3_cell_index, time_window)

    // Count available drivers currently in this cell
    supply = count_available_drivers(city_id, h3_cell_index)

    if supply == 0:
        return MAX_SURGE    // cap at 8.0x

    raw_ratio = demand / supply

    // Apply scaling function (not linear — gradual ramp)
    if raw_ratio <= 1.0:
        surge = 1.0                              // no surge
    else if raw_ratio <= 2.0:
        surge = 1.0 + (raw_ratio - 1.0) * 0.5   // 1.0x to 1.5x
    else if raw_ratio <= 4.0:
        surge = 1.5 + (raw_ratio - 2.0) * 0.75  // 1.5x to 3.0x
    else:
        surge = 3.0 + (raw_ratio - 4.0) * 0.5   // 3.0x to 8.0x (capped)

    // Smoothing: don't change by more than 0.5x per interval
    previous_surge = get_previous_surge(city_id, h3_cell_index)
    surge = clamp(surge, previous_surge - 0.5, previous_surge + 0.5)

    // Hard cap
    surge = min(surge, 8.0)

    store_surge(city_id, h3_cell_index, surge)
    return surge


function calculate_fare(trip):
    base_fare = city_config[trip.city_id].base_fare          // e.g., $2.50
    per_km    = city_config[trip.city_id].per_km             // e.g., $1.50/km
    per_min   = city_config[trip.city_id].per_minute         // e.g., $0.25/min
    minimum   = city_config[trip.city_id].minimum_fare       // e.g., $7.00

    raw_fare = base_fare +
               (trip.distance_meters / 1000.0) * per_km +
               (trip.duration_seconds / 60.0) * per_min

    surged_fare = raw_fare * trip.surge_multiplier
    return max(surged_fare, minimum)
```

### ETA Calculation (Road Network Graph)

```text
function calculate_eta(origin_lat, origin_lon, dest_lat, dest_lon, city_id):
    /*
     * A* algorithm on a pre-loaded road network graph.
     * Edge weights = segment_length / (speed_limit * traffic_coefficient)
     * Traffic coefficients updated every 60s from driver GPS traces.
     */
    graph = road_networks[city_id]   // pre-loaded in memory (~2 GB per city)

    origin_node = graph.snap_to_nearest_node(origin_lat, origin_lon)
    dest_node   = graph.snap_to_nearest_node(dest_lat, dest_lon)

    // A* with traffic-weighted edges
    path = a_star(
        graph,
        start     = origin_node,
        goal      = dest_node,
        heuristic = haversine_distance,    // admissible heuristic
        weight_fn = function(edge):
            base_time = edge.length_meters / edge.speed_limit_mps
            traffic   = get_traffic_coefficient(edge.id)  // 1.0 = free flow, 3.0 = heavy
            return base_time * traffic
    )

    total_seconds = sum(edge.weight for edge in path.edges)

    // Add buffer for pickup overhead (driver finding exact spot, rider walking out)
    pickup_buffer = 60  // 1 minute

    return total_seconds + pickup_buffer
```

---

## 11. Scaling Considerations

| Challenge | Solution | Numbers |
|---|---|---|
| 1.7M location writes/sec | Location Service horizontally scaled + Redis sharded by city | 50 cities × 34K writes/sec each (manageable per Redis instance) |
| Matching at peak (1,150/sec) | Stateless Matching Service, auto-scaled by queue depth | Each instance handles ~100 matches/sec; 12 instances at peak |
| City isolation | Each city has its own Redis geo-index, Kafka partition, and DB shard | NYC outage doesn't affect SF; independent deployments |
| WebSocket connections (10M) | Connection-oriented proxy layer (Envoy) with sticky sessions | 100 proxy instances × 100K connections each |
| Database growth (7.3 TB/year trips) | Shard by city_id; archive completed trips > 90 days to cold storage | Hot partition: only active + recent trips (~500 GB) |
| Surge accuracy | Recompute every 30s per H3 cell; ML model trained on historical patterns | Demand prediction reduces reactive surge by 40% |
| ETA accuracy in traffic | Road graph weights updated every 60s from real driver GPS traces | 95th percentile ETA error < 3 minutes |
| Global expansion (new city) | Spin up new shard (Redis + Postgres + services); import road graph; start with conservative surge | New city operational in < 48 hours |
| Driver app battery drain | Reduce GPS frequency to every 10s when idle (no active trip); every 3s when matched | 40% battery savings for idle drivers |
| Payment failures | Async retry queue + idempotency keys + backup payment processor | 99.97% charges succeed within 5 minutes |

---

## 12. Quick Recall

| Question | Answer |
|---|---|
| Location update rate? | 1.7M/sec (5M drivers × 1 update per 3 seconds) |
| Why Redis for geo-index? | In-memory, O(log N) GEOADD, sub-ms GEORADIUS, 250 MB fits one instance per city |
| Matching strategy? | Expanding radius (1→2→4→8→16 km), score by ETA + distance + rating |
| Why city-based sharding? | Geographic locality (NYC driver never matches SF rider), fault isolation, independent scaling |
| Trip state machine? | REQUESTED → MATCHED → EN_ROUTE → IN_PROGRESS → COMPLETED (or CANCELLED at any step) |
| Surge pricing formula? | demand/supply ratio per H3 cell, recalculated every 30s, smoothed +/- 0.5x per interval, capped at 8x |
| Why H3 over geohash? | Uniform cell area (no distortion at poles), no edge effects at boundaries, hierarchical k-ring expansion |
| Payment flow? | Pre-authorize estimated fare → hold during trip → capture exact amount on completion |
| Driver goes offline? | No heartbeat for 30s → remove from geo-index. Reconnection re-adds automatically. |
| How does ETA work? | A* on road network graph with traffic-weighted edges (updated every 60s from GPS traces) |
| What if Matching Service is slow? | Batch matching (bipartite assignment), skip ETA calls (use distance proxy), auto-scale stateless pods |
| Why eventual consistency for locations? | Strong consistency at 1.7M writes/sec needs distributed consensus = 10-50ms overhead per write. 3-4s staleness is acceptable (40m drift at 30 mph). |
| How to handle payment gateway down? | Circuit breaker → async retry queue with idempotency key → failover to backup processor. Trip still completes normally. |
| WebSocket vs polling? | 10M connections × update every 3s. Polling = 3.3M HTTP requests/sec overhead. WebSocket = persistent connection, server pushes only when data changes. |
