# Distributed Rate Limiter

!!! danger "Real Incident: GitHub API Abuse, 2018"
    A misconfigured CI/CD pipeline at a Fortune 500 company spawned 200 parallel Jenkins jobs, each polling the GitHub API for status checks. Combined traffic: **50,000 requests/minute** from a single organization — 10x their rate limit. GitHub's rate limiter correctly identified and blocked the excess traffic, returning `403 Forbidden` responses. However, the client library had no exponential backoff logic and the responses lacked a `Retry-After` header. Every rejected request was retried immediately with zero delay, creating a **thundering herd of 50K retries/second** — each retry generating its own rejection, which triggered yet another retry. The retry storm consumed **3x more compute resources** than the original traffic: each request required rate-limit lookup, response serialization, and connection handling regardless of outcome. GitHub's post-mortem led to three changes: (1) mandatory `Retry-After` headers on all 429 responses, (2) progressive penalties for clients ignoring backoff (increasing cooldown windows), and (3) connection-level throttling for repeat offenders. **Lesson: A rate limiter that doesn't communicate "when to retry" creates more problems than it solves. The limiter itself becomes a DoS amplifier.**

---

## System Design Concepts Used

`token bucket algorithm` | `sliding window counter` | `distributed state management` | `Redis Lua scripting` | `consistent hashing` | `fail-open vs fail-closed` | `circuit breaker pattern` | `thundering herd mitigation` | `rate limit headers (RFC 6585)` | `atomic operations` | `local cache with eventual consistency` | `hot-reload configuration` | `connection pooling` | `sharded counters` | `backpressure signaling`

---

## Functional Requirements

1. **Per-key rate limiting** — Enforce separate limits per API key (each client has independent quota)
2. **Per-endpoint granularity** — Different endpoints have different limits (e.g., `/search` = 30 req/min, `/users` = 100 req/min)
3. **Multiple algorithm support** — Token bucket (default), sliding window log, sliding window counter, and fixed window counter selectable per rule
4. **Rate limit response headers** — Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` on every response (both allowed and rejected)
5. **Configurable rules with hot-reload** — Operators can update rate limit rules (thresholds, algorithms, windows) without service restart
6. **Whitelist/blacklist support** — Permanently allow internal services (bypass checks) or permanently block known-abusive keys
7. **Tiered rate limiting** — Different limits per subscription tier (free: 100 req/min, pro: 1000 req/min, enterprise: 10000 req/min)
8. **Burst tolerance** — Allow brief bursts above steady-state rate (token bucket capacity > refill rate) for legitimate traffic spikes
9. **Distributed enforcement** — Rate limits enforced consistently across all API gateway nodes (not per-node)
10. **Graceful degradation signaling** — On rejection, provide actionable information (retry timing, remaining quota, limit ceiling)

---

## Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Throughput** | 1.7M rate-limit checks/sec | 1M clients x 100 req/min average = full production load |
| **Latency (p99)** | < 1ms per check | Must not add perceptible delay to API calls; sub-ms for local fast path |
| **Accuracy** | < 0.1% false rejections | Rejecting legitimate traffic directly impacts revenue and user trust |
| **Availability** | 99.99% (52 min downtime/year) | Rate limiter failure path must not block legitimate traffic |
| **Consistency** | Eventually consistent (< 1s lag) | Brief over-limit acceptable vs. rejecting legitimate bursts across nodes |
| **Scalability** | Linear horizontal scaling | Adding Redis shards or gateway nodes should proportionally increase capacity |
| **Failure mode** | Fail-open | On Redis outage, allow all traffic rather than reject everything |
| **Recovery time** | < 5s failover | Redis sentinel/cluster auto-failover must be faster than typical burst duration |
| **State storage** | < 500 MB total | All rate-limit state must fit in memory for sub-ms access |
| **Config propagation** | < 2s rule update | New rules must take effect across all nodes within 2 seconds |

---

## Capacity Estimation

```
=== Napkin Math: Distributed Rate Limiter ===

Traffic Volume:
  Active clients:           1,000,000
  Avg requests per client:  100 req/min
  Total request rate:       1M × 100 / 60 = ~1,700,000 req/sec (1.7M)
  Peak (3x average):        ~5.1M req/sec

State Per Client:
  Token bucket state:       tokens (8B) + last_refill (8B) + key overhead (40B) = ~56 bytes
  Endpoints per client:     10 (average distinct endpoints hit)
  State per client:         56 × 10 = 560 bytes

Total Redis Memory:
  Active keys:              1M clients × 10 endpoints = 10M keys
  Raw state:                10M × 56 bytes = 560 MB
  Redis overhead (2x):      ~1.12 GB (hash encoding, pointers, metadata)
  With TTL metadata:        ~1.3 GB total
  Safety margin (1.5x):     ~2 GB allocated

Redis Cluster Sizing:
  Single Redis throughput:  ~300,000 ops/sec (pipelined, single thread)
  Required throughput:      1.7M ops/sec (each check = 1 EVALSHA call)
  Shards needed:            1.7M / 300K = 6 shards (minimum)
  With headroom (2x):       12 shards (6 primary + 6 replica)
  Memory per shard:         2 GB / 6 = ~333 MB per primary

Network Overhead:
  Request to Redis:         key (50B) + args (30B) + protocol (20B) = ~100 bytes
  Response from Redis:      result (8B) + remaining (8B) + protocol (20B) = ~36 bytes
  Per-second bandwidth:     1.7M × 136 bytes = ~231 MB/sec (Redis network)
  Gateway egress headers:   1.7M × 80 bytes (4 headers) = ~136 MB/sec

Lua Script Execution:
  Script size:              ~400 bytes (cached as SHA after first EVAL)
  Execution time:           ~0.05ms per call (single Redis thread)
  Total script CPU:         1.7M × 0.05ms = 85 sec of CPU / sec → distributed across 6 shards
  Per-shard CPU utilization: 85 / 6 = ~14 sec/sec → ~23% utilization (safe)

Local Counter Fast Path:
  Hot clients (top 1%):     10,000 clients
  Local cache memory:       10K × 56 bytes = ~560 KB per gateway node
  Cache hit rate:           ~40% (Zipfian distribution of API usage)
  Effective Redis load:     1.7M × 0.6 = 1.02M ops/sec (with local cache)
  Shards with cache:        1.02M / 300K = 4 shards sufficient
```

---

## "Why X, Not Y?" Tradeoff Analysis

### Why Token Bucket, Not Fixed Window or Leaky Bucket?

| Criterion | Token Bucket | Fixed Window | Leaky Bucket |
|---|---|---|---|
| **Burst handling** | Allows bursts up to capacity (graceful) | 2x burst at window boundary (vulnerability) | No bursts at all (too strict) |
| **Implementation in Redis** | Single HMGET + HMSET (2 fields) | Single INCR + EXPIRE | Requires ordered queue (complex) |
| **Memory per key** | 16 bytes (tokens + timestamp) | 12 bytes (counter + expiry) | Unbounded (queue of timestamps) |
| **User experience** | Feels fair — saved tokens reward inactivity | Punishes users at boundary | Punishes bursty legitimate usage |
| **Configurability** | Two knobs: capacity + refill rate | One knob: limit per window | Two knobs: bucket size + drain rate |

**Decision:** Token bucket. It handles the real-world pattern of bursty API usage (e.g., a mobile app syncing on wake) while preventing sustained abuse. Fixed window's boundary problem means a client can send 2x the limit in a 1-second span straddling two windows. Leaky bucket's strict uniform output punishes legitimate batch operations.

### Why Redis, Not Local In-Memory Counters?

| Criterion | Redis (Centralized) | Local In-Memory |
|---|---|---|
| **Accuracy** | Exact count across all nodes | Each node sees partial view (10 nodes = 10x over-limit possible) |
| **Latency** | ~0.5ms (network hop) | ~0.01ms (memory access) |
| **Consistency** | Strong (single source of truth) | Eventual (sync lag = over-limit window) |
| **Failure mode** | Redis down = degraded limiting | Node restart = state loss |
| **Scalability** | Add shards (linear) | Add nodes = worse accuracy |

**Decision:** Redis as source of truth with local counters as an optimization layer. Pure local counters fail the core requirement: if you have 10 gateway nodes and a 100 req/min limit, a client sending 10 requests to each node would consume 100 requests while each node thinks "only 10 — well within limit." The hybrid approach (local fast-path for hot keys, async sync to Redis every 100ms) gives sub-ms checks for 40% of traffic while maintaining accuracy.

### Why Fail-Open, Not Fail-Closed on Redis Failure?

| Criterion | Fail-Open (Allow All) | Fail-Closed (Reject All) |
|---|---|---|
| **Revenue impact** | Potential brief over-limit (minor) | All legitimate traffic blocked (catastrophic) |
| **User experience** | Users unaffected during outage | 100% of users get 503/429 errors |
| **Abuse risk** | Temporary abuse window (~seconds) | No abuse but also no service |
| **Recovery** | Seamless when Redis returns | Thundering herd of retries on recovery |
| **Business alignment** | Availability > perfect limiting | Security > availability |

**Decision:** Fail-open. A rate limiter exists to protect services from abuse, not to be a single point of failure. During the ~5 seconds of Redis failover, allowing excess traffic is far less damaging than returning errors to every customer. Exception: for security-critical endpoints (login, password reset), implement a separate fail-closed circuit with local state.

### Why Lua Scripts, Not MULTI/EXEC for Atomicity?

| Criterion | Lua Script (EVALSHA) | MULTI/EXEC (Transaction) |
|---|---|---|
| **Round trips** | 1 (script executes server-side) | 3 minimum (WATCH + MULTI + EXEC) |
| **Atomicity** | Guaranteed (single-threaded execution) | Optimistic (EXEC fails if key changed) |
| **Retry logic** | None needed | Must retry on EXEC failure (contention) |
| **Latency** | ~0.05ms execution | ~0.15ms (3 round trips + potential retry) |
| **Cluster support** | Works with single-key scripts | MULTI limited to same-slot keys |
| **Complexity** | Script handles read + compute + write | Client must handle CAS retry loop |

**Decision:** Lua scripts. The token bucket algorithm requires read-then-write semantics (read current tokens, compute refill, decrement, write back). With MULTI/EXEC, a hot key (popular API) would cause frequent EXEC failures under contention — exactly when low latency matters most. Lua scripts execute atomically in a single Redis thread with zero contention overhead. The script is cached server-side (EVALSHA) so only the SHA hash is transmitted after first load.

---

## High-Level Architecture

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
  <text x="550" y="30" text-anchor="middle" font-size="17" font-weight="800" fill="#212121">Distributed Rate Limiter — System Architecture</text>
  <text x="550" y="50" text-anchor="middle" font-size="11" fill="#757575">1.7M checks/sec | &lt; 1ms decision | Token Bucket + Redis Cluster + Local Fast Path</text>

  <!-- Legend bar -->
  <rect x="30" y="62" width="1040" height="28" rx="4" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <circle cx="60" cy="76" r="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1"/>
  <text x="72" y="80" font-size="9" fill="#546E7A">Client Layer</text>
  <circle cx="180" cy="76" r="6" fill="#FFF9C4" stroke="#F9A825" stroke-width="1"/>
  <text x="192" y="80" font-size="9" fill="#546E7A">Gateway (Rate Limiter)</text>
  <circle cx="340" cy="76" r="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1"/>
  <text x="352" y="80" font-size="9" fill="#546E7A">Backend Services</text>
  <circle cx="480" cy="76" r="6" fill="#E8EAF6" stroke="#283593" stroke-width="1"/>
  <text x="492" y="80" font-size="9" fill="#546E7A">Redis State Store</text>
  <circle cx="620" cy="76" r="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1"/>
  <text x="632" y="80" font-size="9" fill="#546E7A">Config Service</text>
  <circle cx="750" cy="76" r="6" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1"/>
  <text x="762" y="80" font-size="9" fill="#546E7A">Rejected (429)</text>
  <circle cx="870" cy="76" r="6" fill="#B2DFDB" stroke="#00695C" stroke-width="1"/>
  <text x="882" y="80" font-size="9" fill="#546E7A">Local Cache</text>
  <circle cx="990" cy="76" r="6" fill="#FFE0B2" stroke="#E65100" stroke-width="1"/>
  <text x="1002" y="80" font-size="9" fill="#546E7A">Monitoring</text>

  <!-- Client Layer Group -->
  <rect x="30" y="100" width="160" height="230" rx="6" fill="none" stroke="#90CAF9" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="110" y="118" text-anchor="middle" font-size="10" font-weight="600" fill="#1976D2">CLIENTS</text>

  <rect x="50" y="130" width="120" height="40" rx="5" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="110" y="148" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Mobile Apps</text>
  <text x="110" y="162" text-anchor="middle" font-size="8" fill="#757575">Bursty traffic</text>

  <rect x="50" y="180" width="120" height="40" rx="5" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="110" y="198" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Web Clients</text>
  <text x="110" y="212" text-anchor="middle" font-size="8" fill="#757575">Steady stream</text>

  <rect x="50" y="230" width="120" height="40" rx="5" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="110" y="248" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Partner APIs</text>
  <text x="110" y="262" text-anchor="middle" font-size="8" fill="#757575">High-volume batch</text>

  <rect x="50" y="280" width="120" height="40" rx="5" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="110" y="298" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">CI/CD Bots</text>
  <text x="110" y="312" text-anchor="middle" font-size="8" fill="#757575">Spike pattern</text>

  <!-- Arrows from clients to gateway -->
  <line x1="170" y1="150" x2="240" y2="200" stroke="#546E7A" stroke-width="1.5" marker-end="url(#a)"/>
  <line x1="170" y1="200" x2="240" y2="210" stroke="#546E7A" stroke-width="1.5" marker-end="url(#a)"/>
  <line x1="170" y1="250" x2="240" y2="220" stroke="#546E7A" stroke-width="1.5" marker-end="url(#a)"/>
  <line x1="170" y1="300" x2="240" y2="230" stroke="#546E7A" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="205" y="172" font-size="8" fill="#757575" transform="rotate(-15 205 172)">HTTPS</text>

  <!-- API Gateway Group -->
  <rect x="235" y="100" width="290" height="280" rx="6" fill="none" stroke="#F9A825" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="380" y="118" text-anchor="middle" font-size="10" font-weight="600" fill="#F57F17">API GATEWAY (RATE LIMITER MIDDLEWARE)</text>

  <rect x="255" y="135" width="250" height="55" rx="5" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5" filter="url(#sh)"/>
  <text x="380" y="155" text-anchor="middle" font-size="11" font-weight="700" fill="#F57F17">Rate Limit Check</text>
  <text x="380" y="170" text-anchor="middle" font-size="9" fill="#757575">1. Extract API key + endpoint</text>
  <text x="380" y="182" text-anchor="middle" font-size="9" fill="#757575">2. Lookup rule → choose algorithm</text>

  <rect x="255" y="200" width="120" height="45" rx="5" fill="#B2DFDB" stroke="#00695C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="315" y="218" text-anchor="middle" font-size="10" font-weight="600" fill="#004D40">Local Counter</text>
  <text x="315" y="232" text-anchor="middle" font-size="8" fill="#757575">In-memory fast path</text>
  <text x="315" y="242" text-anchor="middle" font-size="8" fill="#757575">~0.01ms check</text>

  <rect x="385" y="200" width="120" height="45" rx="5" fill="#E8EAF6" stroke="#283593" stroke-width="1.5" filter="url(#sh)"/>
  <text x="445" y="218" text-anchor="middle" font-size="10" font-weight="600" fill="#1A237E">Redis Check</text>
  <text x="445" y="232" text-anchor="middle" font-size="8" fill="#757575">EVALSHA Lua script</text>
  <text x="445" y="242" text-anchor="middle" font-size="8" fill="#757575">~0.5ms check</text>

  <rect x="255" y="260" width="250" height="50" rx="5" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5" filter="url(#sh)"/>
  <text x="380" y="278" text-anchor="middle" font-size="10" font-weight="600" fill="#F57F17">Response Builder</text>
  <text x="380" y="292" text-anchor="middle" font-size="9" fill="#757575">Attach X-RateLimit-Limit, Remaining, Reset</text>
  <text x="380" y="304" text-anchor="middle" font-size="9" fill="#757575">On reject: add Retry-After header</text>

  <rect x="255" y="325" width="250" height="40" rx="5" fill="#FFF9C4" stroke="#F9A825" stroke-width="1" filter="url(#sh)"/>
  <text x="380" y="343" text-anchor="middle" font-size="9" font-weight="600" fill="#F57F17">Whitelist/Blacklist Filter</text>
  <text x="380" y="357" text-anchor="middle" font-size="8" fill="#757575">Bypass for internal services | Block known abusers</text>

  <!-- Allowed path to backend -->
  <line x1="525" y1="165" x2="600" y2="165" stroke="#388E3C" stroke-width="2" marker-end="url(#ag)"/>
  <text x="555" y="155" font-size="9" fill="#388E3C" font-weight="700">ALLOW</text>

  <!-- Rejected path -->
  <line x1="380" y1="310" x2="380" y2="420" stroke="#D32F2F" stroke-width="2" marker-end="url(#ar)"/>
  <text x="395" y="370" font-size="9" fill="#D32F2F" font-weight="700">REJECT</text>

  <!-- 429 Response -->
  <rect x="290" y="425" width="180" height="55" rx="5" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="380" y="445" text-anchor="middle" font-size="12" font-weight="700" fill="#B71C1C">429 Too Many Requests</text>
  <text x="380" y="460" text-anchor="middle" font-size="9" fill="#757575">Retry-After: 30</text>
  <text x="380" y="472" text-anchor="middle" font-size="9" fill="#757575">X-RateLimit-Remaining: 0</text>

  <!-- Backend Services Group -->
  <rect x="595" y="100" width="200" height="160" rx="6" fill="none" stroke="#388E3C" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="695" y="118" text-anchor="middle" font-size="10" font-weight="600" fill="#388E3C">BACKEND SERVICES</text>

  <rect x="615" y="130" width="160" height="35" rx="5" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="695" y="152" text-anchor="middle" font-size="10" font-weight="600" fill="#1B5E20">User Service</text>

  <rect x="615" y="175" width="160" height="35" rx="5" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="695" y="197" text-anchor="middle" font-size="10" font-weight="600" fill="#1B5E20">Search Service</text>

  <rect x="615" y="220" width="160" height="35" rx="5" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="695" y="242" text-anchor="middle" font-size="10" font-weight="600" fill="#1B5E20">Payment Service</text>

  <!-- Redis Cluster Group -->
  <rect x="595" y="310" width="470" height="150" rx="6" fill="none" stroke="#283593" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="830" y="328" text-anchor="middle" font-size="10" font-weight="600" fill="#283593">REDIS CLUSTER (6 SHARDS + 6 REPLICAS)</text>

  <rect x="615" y="345" width="100" height="45" rx="5" fill="#E8EAF6" stroke="#283593" stroke-width="1.2" filter="url(#sh)"/>
  <text x="665" y="365" text-anchor="middle" font-size="9" font-weight="600" fill="#1A237E">Shard 1</text>
  <text x="665" y="380" text-anchor="middle" font-size="8" fill="#757575">300K ops/s</text>

  <rect x="725" y="345" width="100" height="45" rx="5" fill="#E8EAF6" stroke="#283593" stroke-width="1.2" filter="url(#sh)"/>
  <text x="775" y="365" text-anchor="middle" font-size="9" font-weight="600" fill="#1A237E">Shard 2</text>
  <text x="775" y="380" text-anchor="middle" font-size="8" fill="#757575">300K ops/s</text>

  <rect x="835" y="345" width="100" height="45" rx="5" fill="#E8EAF6" stroke="#283593" stroke-width="1.2" filter="url(#sh)"/>
  <text x="885" y="365" text-anchor="middle" font-size="9" font-weight="600" fill="#1A237E">Shard 3</text>
  <text x="885" y="380" text-anchor="middle" font-size="8" fill="#757575">300K ops/s</text>

  <rect x="945" y="345" width="100" height="45" rx="5" fill="#E8EAF6" stroke="#283593" stroke-width="1.2" filter="url(#sh)"/>
  <text x="995" y="365" text-anchor="middle" font-size="9" font-weight="600" fill="#1A237E">Shard 4-6</text>
  <text x="995" y="380" text-anchor="middle" font-size="8" fill="#757575">300K ops/s ea</text>

  <text x="830" y="415" text-anchor="middle" font-size="9" fill="#757575">Key: {api_key}:{endpoint}:{window} | Total: ~200MB state | Lua scripts cached (EVALSHA)</text>
  <text x="830" y="435" text-anchor="middle" font-size="9" fill="#757575">Sentinel auto-failover &lt; 5s | Consistent hashing for key distribution</text>

  <!-- Arrow from Gateway to Redis -->
  <line x1="445" y1="245" x2="615" y2="360" stroke="#283593" stroke-width="1.5" stroke-dasharray="5,3" marker-end="url(#a)"/>
  <text x="510" y="295" font-size="8" fill="#283593" transform="rotate(18 510 295)">EVALSHA (atomic)</text>

  <!-- Config Service -->
  <rect x="30" y="420" width="220" height="100" rx="6" fill="none" stroke="#512DA8" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="140" y="438" text-anchor="middle" font-size="10" font-weight="600" fill="#512DA8">CONFIG SERVICE</text>

  <rect x="45" y="450" width="190" height="55" rx="5" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="140" y="468" text-anchor="middle" font-size="10" font-weight="600" fill="#311B92">Rule Engine</text>
  <text x="140" y="482" text-anchor="middle" font-size="9" fill="#757575">YAML/JSON rules per tier</text>
  <text x="140" y="495" text-anchor="middle" font-size="9" fill="#757575">Hot-reload via pub/sub (&lt; 2s)</text>

  <!-- Arrow from Config to Gateway -->
  <line x1="180" y1="420" x2="300" y2="365" stroke="#512DA8" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#a)"/>
  <text x="220" y="388" font-size="8" fill="#512DA8">push rules</text>

  <!-- Monitoring Group -->
  <rect x="595" y="500" width="470" height="120" rx="6" fill="none" stroke="#E65100" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="830" y="518" text-anchor="middle" font-size="10" font-weight="600" fill="#E65100">MONITORING &amp; ALERTING</text>

  <rect x="615" y="535" width="130" height="40" rx="5" fill="#FFE0B2" stroke="#E65100" stroke-width="1.2" filter="url(#sh)"/>
  <text x="680" y="553" text-anchor="middle" font-size="9" font-weight="600" fill="#BF360C">Metrics</text>
  <text x="680" y="567" text-anchor="middle" font-size="8" fill="#757575">Prometheus/Grafana</text>

  <rect x="755" y="535" width="130" height="40" rx="5" fill="#FFE0B2" stroke="#E65100" stroke-width="1.2" filter="url(#sh)"/>
  <text x="820" y="553" text-anchor="middle" font-size="9" font-weight="600" fill="#BF360C">Alerts</text>
  <text x="820" y="567" text-anchor="middle" font-size="8" fill="#757575">PagerDuty/OpsGenie</text>

  <rect x="895" y="535" width="150" height="40" rx="5" fill="#FFE0B2" stroke="#E65100" stroke-width="1.2" filter="url(#sh)"/>
  <text x="970" y="553" text-anchor="middle" font-size="9" font-weight="600" fill="#BF360C">Dashboard</text>
  <text x="970" y="567" text-anchor="middle" font-size="8" fill="#757575">Rejection rate, latency, Redis health</text>

  <text x="830" y="602" text-anchor="middle" font-size="9" fill="#757575">Alert on: rejection rate &gt; 5% | Redis latency &gt; 5ms | fail-open triggered | single key &gt; 10K req/sec</text>

  <!-- Arrow from Gateway to Monitoring -->
  <line x1="505" y1="290" x2="615" y2="550" stroke="#E65100" stroke-width="1" stroke-dasharray="3,3" marker-end="url(#a)"/>
  <text x="540" y="420" font-size="8" fill="#E65100" transform="rotate(60 540 420)">emit metrics</text>

  <!-- Local counter sync arrow -->
  <line x1="315" y1="245" x2="315" y2="260" stroke="#00695C" stroke-width="1" marker-end="url(#a)"/>
  <line x1="315" y1="260" x2="615" y2="380" stroke="#00695C" stroke-width="1" stroke-dasharray="3,3" marker-end="url(#a)"/>
  <text x="440" y="310" font-size="8" fill="#00695C">periodic sync (100ms)</text>

  <!-- Flow numbers -->
  <circle cx="205" cy="185" r="9" fill="#1976D2"/>
  <text x="205" y="189" text-anchor="middle" font-size="8" font-weight="700" fill="white">1</text>

  <circle cx="392" cy="128" r="9" fill="#F9A825"/>
  <text x="392" y="132" text-anchor="middle" font-size="8" font-weight="700" fill="white">2</text>

  <circle cx="565" cy="155" r="9" fill="#388E3C"/>
  <text x="565" y="159" text-anchor="middle" font-size="8" font-weight="700" fill="white">3</text>

  <circle cx="395" cy="408" r="9" fill="#D32F2F"/>
  <text x="395" y="412" text-anchor="middle" font-size="8" font-weight="700" fill="white">4</text>

  <!-- Summary box -->
  <rect x="30" y="640" width="1040" height="85" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="550" y="660" text-anchor="middle" font-size="10" font-weight="700" fill="#212121">Architecture Summary</text>
  <text x="60" y="680" font-size="9" fill="#546E7A">Flow: Client (1) → API Gateway rate-limit middleware (2) → if allowed → Backend (3) | if rejected → 429 + Retry-After (4)</text>
  <text x="60" y="696" font-size="9" fill="#546E7A">State: Redis Cluster (6 shards, 1.8M ops/sec capacity) with Lua scripts for atomic token bucket operations</text>
  <text x="60" y="712" font-size="9" fill="#546E7A">Optimization: Local in-memory counters for hot keys (~40% cache hit) → reduces Redis load to ~1M ops/sec</text>
</svg>
</div>

---

## Backend Services Explained

**API Gateway Rate Limiter Middleware** — This is the core component, implemented as middleware in the API gateway (e.g., Kong, Envoy, or custom Nginx/OpenResty). Every inbound request passes through this layer before reaching any backend. It extracts the API key (from header, query param, or JWT claim) and the normalized endpoint path, constructs the rate-limit key (`{api_key}:{endpoint}:{window}`), and executes the rate-check algorithm. The middleware attaches rate-limit headers to ALL responses (both allowed and rejected) so clients always know their remaining quota. It operates as a pre-request hook with sub-millisecond overhead on cache hit. The middleware also handles whitelist/blacklist lookups from an in-memory set that refreshes every 2 seconds.

**Redis State Store (Cluster)** — Six Redis primary shards with six replicas form the distributed state backend. Each shard handles ~300K operations/sec using pipelined connections. Keys are distributed across shards via consistent hashing on `{api_key}` (using Redis hash tags to ensure all endpoints for a single client land on the same shard, enabling multi-key operations). The Lua token-bucket script is loaded once via `SCRIPT LOAD` and invoked via `EVALSHA` — eliminating script transmission overhead on every call. Keys have a TTL of 2x the rate-limit window (e.g., 2 hours for hourly limits) to auto-expire inactive clients. Redis Sentinel handles automatic failover within 5 seconds; during failover, the gateway falls back to fail-open mode.

**Config Service** — A lightweight service (or etcd/Consul KV store) that holds rate-limit rules as structured configuration. Rules specify: API key or tier pattern, endpoint regex, algorithm choice, window size, limit, and burst capacity. Changes are propagated to all gateway nodes via Redis Pub/Sub within 2 seconds. The config service supports rule inheritance (global defaults < tier overrides < per-key overrides) and validation (prevents deploying rules that would reject 100% of traffic). Operators interact via a REST API or admin UI. Rules are versioned for rollback capability.

**Monitoring and Alerting** — Every rate-limit decision emits a metric (allowed/rejected, latency, algorithm used, Redis response time). These flow to Prometheus via StatsD/OpenTelemetry. Grafana dashboards show: rejection rate per endpoint, per-key usage patterns, Redis cluster health, and fail-open events. Alerts fire on: rejection rate > 5% (potential misconfiguration), Redis latency > 5ms (degradation), fail-open mode triggered (infrastructure issue), or single key exceeding 10K req/sec (potential abuse or misconfigured client). The monitoring pipeline is fire-and-forget — it never blocks the request path.

**Local Counter Cache** — An in-memory hash map on each gateway node that caches token counts for the top ~1% of clients (by request volume). The local counter handles ~40% of all rate-limit checks without a Redis round-trip, achieving 0.01ms decision time. Every 100ms, the local counter syncs its state to Redis (subtracting consumed tokens) and pulls fresh counts. The tradeoff: during the sync interval, a client could exceed their limit by up to `(number_of_gateway_nodes * local_allowance)` requests. For most use cases, this brief over-limit (< 1 second) is acceptable. For strict-enforcement endpoints (payments, auth), the local cache is bypassed and every check goes to Redis.

---

## Architecture Flow

### Scenario: Fintech API Trading Bot Burst

*A fintech API receives a burst of 500 requests in 1 second from a trading bot. The rate limit is 100 req/min (token bucket: capacity=100, refill=1.67 tokens/sec).*

**Normal Request (Allowed):**

The first request arrives at the API gateway. The middleware extracts the API key `tk_bot_9382` from the `Authorization` header and normalizes the endpoint to `/v1/orders`. It constructs the key `tk_bot_9382:/v1/orders:bucket`. The local counter cache does not have this key (cold start), so it invokes the Redis Lua script via `EVALSHA`. The script reads the current bucket: 100 tokens available (full bucket, client hasn't made requests recently). It refills 0 tokens (0 elapsed time since bucket was just initialized), decrements 1 token, writes `{tokens: 99, last_refill: now}` back to the hash, and returns `{1, 99}` (allowed, 99 remaining). The middleware adds headers: `X-RateLimit-Limit: 100`, `X-RateLimit-Remaining: 99`, `X-RateLimit-Reset: 1640000060`. The request is forwarded to the orders backend service. Total added latency: 0.6ms.

**Burst Continues (Requests 2-100):**

The trading bot's burst continues. Requests 2 through 100 each consume one token. The local counter cache is now warm — after the first Redis call, the gateway caches the token count locally. Subsequent requests decrement the local counter (0.01ms each) without Redis round-trips. Every 100ms, the local counter syncs: "I consumed 45 tokens locally" → Redis decrements by 45. After 100 requests total, the bucket is empty. The 100th request gets `X-RateLimit-Remaining: 0`. Total time elapsed: ~200ms (all 100 allowed within the burst capacity).

**Rate-Limited Request (Rejected with Headers):**

Request 101 arrives. The local counter shows 0 tokens. The gateway immediately returns `HTTP 429 Too Many Requests` with body:
```
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit of 100 requests per minute exceeded for /v1/orders",
  "retry_after": 36
}
```
Headers: `Retry-After: 36` (seconds until enough tokens refill), `X-RateLimit-Limit: 100`, `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset: 1640000060`. The remaining 399 requests from the burst all receive 429s. Each rejection takes ~0.01ms (local counter, no Redis needed for rejections). The trading bot's well-implemented SDK reads `Retry-After`, pauses for 36 seconds, then resumes at a sustainable rate.

**Redis Failure (Fail-Open):**

During the burst, Redis shard 3 (which holds this client's key) experiences a network partition. The gateway's Redis client gets a connection timeout after 50ms. The circuit breaker trips. The middleware switches to fail-open mode: all requests from this client are ALLOWED without rate checking. The gateway emits an alert: "fail-open triggered for shard 3, affected keys: ~1.6M". It continues adding headers with stale data: `X-RateLimit-Remaining: -1` (special value indicating degraded mode). After 4.2 seconds, Redis Sentinel promotes the replica to primary. The gateway reconnects, reloads cached script SHA, and resumes normal rate limiting. During the 4.2-second window, the trading bot sent ~50 extra requests above its limit — acceptable vs. rejecting all traffic from 1.6M clients.

**Rule Hot-Reload:**

An operator decides the trading bot's tier should be upgraded: 100 req/min → 500 req/min. They update the config service via REST API: `PUT /rules/tier/pro {"limit": 500, "capacity": 500}`. The config service validates the change, writes to its backing store, and publishes to Redis Pub/Sub channel `rate_limit_rules_v2`. All 20 gateway nodes receive the message within 800ms. Each node updates its in-memory rule cache. The next rate-limit check for any `pro` tier client uses the new limit. No restart, no deploy, no dropped connections. The token bucket's capacity is immediately set to 500 — existing tokens are preserved, new tokens refill at the higher rate.

---

## Failure & Recovery Scenarios

### Redis Cluster Down (Complete Outage)

**Trigger:** All 6 Redis primaries become unreachable (network partition, cloud availability zone failure).

**Detection:** Gateway Redis client pool reports 100% connection failures within 200ms. Circuit breaker trips.

**Response:** ALL gateway nodes switch to fail-open mode simultaneously. Rate limiting is effectively disabled. Local counters continue to operate with last-known state but cannot sync.

**Risk:** Abusive clients can send unlimited traffic. Backend services are unprotected.

**Mitigation:** (1) Local counters still provide approximate limiting for warm keys. (2) Backend services have their own circuit breakers/load shedding. (3) Emergency mode: gateway can enable a hard-coded conservative limit (e.g., 10 req/sec per IP) using local-only state.

**Recovery:** When Redis cluster recovers, all keys will have expired (TTL < outage duration) or contain stale data. Buckets reset to full capacity. Brief burst of previously-limited clients is expected. Gateway nodes detect recovered connections, re-register Lua scripts, and resume normal operation within 1 request cycle.

### Config Service Unreachable

**Trigger:** Config service crashes or is unreachable.

**Detection:** Gateway's periodic config poll (every 10s) fails 3 consecutive times.

**Response:** Gateway continues using last-known-good configuration cached in memory. An operator alert fires.

**Risk:** Rule changes cannot be deployed. If a bad rule was just pushed to some nodes but not others, inconsistent behavior between gateway nodes.

**Mitigation:** Rules are versioned. Gateways compare rule versions on each sync. If a gateway has a newer version than another, the older gateway won't degrade — it just can't upgrade. Config service should be deployed with 3+ replicas and automatic failover.

**Recovery:** When config service returns, gateways pull latest rules on next poll cycle (< 10s). Any queued updates are applied in version order.

### Clock Skew Between Nodes

**Trigger:** Gateway node 7's clock drifts 3 seconds ahead of other nodes due to NTP sync failure.

**Impact on Token Bucket:** The Lua script receives `now` as a parameter from the gateway (not Redis server time). If node 7's clock is 3 seconds ahead, it computes 3 extra seconds of token refill: `3s * 1.67 tokens/sec = 5 extra tokens`. Client requests hitting node 7 get slightly more generous limits.

**Impact on Fixed Window:** Worse. Node 7 might roll over to a new window 3 seconds early, resetting counters while other nodes are still in the old window. Client gets 2x limits during the overlap.

**Mitigation:** (1) Use Redis `TIME` command instead of client-provided timestamps (adds 1 RTT but guarantees consistency). (2) NTP monitoring with alerts on drift > 500ms. (3) Token bucket's continuous refill model is inherently more tolerant of clock skew than window-based algorithms.

### Hot Key (Single API Key: 100K req/sec)

**Trigger:** A viral app's API key generates 100K requests/sec — 100x its limit and 33% of a single Redis shard's capacity.

**Detection:** Monitoring alerts on single-key request rate > 10K/sec.

**Impact:** The single Redis shard handling this key (`{api_key}:{endpoint}:{window}` consistently hashes to shard 4) becomes a hotspot. Lua script executions for this key consume 33% of shard 4's capacity, increasing p99 latency for all other keys on shard 4.

**Response:** (1) Local counter absorbs most checks — after the first Redis call confirms the bucket is empty, the local counter caches "rejected" state and handles all subsequent requests without Redis. (2) Gateway implements request coalescing: batch N concurrent checks for the same key into 1 Redis call, broadcast the result. (3) Connection-level throttling: after 1000 consecutive rejections from the same IP, drop the TCP connection (save response serialization cost).

**Mitigation:** (1) Per-IP connection limits at the load balancer layer (before gateway). (2) Adaptive blacklisting: automatically add the key to the blacklist set after sustained abuse. (3) Shard splitting: if one key dominates, split that key's counter across multiple shards using sub-keys.

---

## Data Model

### Redis Key Structure

```
Key Pattern: {api_key}:{endpoint}:{algorithm_suffix}
Examples:
  sk_prod_abc123:/v1/users:bucket      → Token bucket state
  sk_prod_abc123:/v1/search:bucket     → Separate bucket per endpoint
  sk_prod_abc123:/v1/orders:swlog      → Sliding window log (sorted set)
  sk_prod_abc123:/v1/orders:fwin:1640000  → Fixed window counter

Token Bucket Hash:
  HSET sk_prod_abc123:/v1/users:bucket tokens 73 last_refill 1640000042.123

Sliding Window Log (Sorted Set):
  ZADD sk_prod_abc123:/v1/orders:swlog 1640000042.123 "req_uuid_1"
  ZADD sk_prod_abc123:/v1/orders:swlog 1640000042.456 "req_uuid_2"
  (Score = timestamp, member = unique request ID)

Fixed Window Counter:
  SET sk_prod_abc123:/v1/orders:fwin:1640000 47
  EXPIRE sk_prod_abc123:/v1/orders:fwin:1640000 120

TTL Policy:
  Token bucket keys: EXPIRE = 2 × window_size (auto-cleanup inactive keys)
  Sliding window log: EXPIRE = window_size + 10s buffer
  Fixed window: EXPIRE = window_size + 60s buffer
```

### Config Schema (YAML)

```yaml
# Rate limit rule configuration
rules:
  - id: "rule_001"
    version: 42
    tier: "pro"
    match:
      api_key_pattern: "sk_prod_*"
      endpoint_regex: "^/v1/orders.*"
    algorithm: "token_bucket"
    params:
      capacity: 100          # Maximum tokens (burst size)
      refill_rate: 1.67      # Tokens per second (100/min)
      window: 60             # Window for header calculation (seconds)
    override:
      # Per-key override (higher priority)
      "sk_prod_vip_001":
        capacity: 1000
        refill_rate: 16.67

  - id: "rule_002"
    tier: "free"
    match:
      api_key_pattern: "sk_free_*"
      endpoint_regex: ".*"
    algorithm: "sliding_window_counter"
    params:
      limit: 100
      window: 60

whitelist:
  - "sk_internal_*"         # Internal services bypass all limits
  - "sk_monitoring_*"       # Health check services

blacklist:
  - "sk_revoked_*"          # Permanently blocked keys
  - "sk_abuse_flagged_*"    # Flagged by abuse detection
```

### Rate Limit Response Headers

```
# On EVERY response (both 200 and 429):
X-RateLimit-Limit: 100            # Maximum requests allowed in window
X-RateLimit-Remaining: 73         # Requests remaining in current window
X-RateLimit-Reset: 1640000060     # Unix timestamp when window resets (UTC)

# Only on 429 responses:
Retry-After: 36                   # Seconds until client should retry

# On fail-open (degraded mode):
X-RateLimit-Remaining: -1         # Special value: rate limiting degraded
X-RateLimit-Policy: degraded      # Explicit degraded state indicator

# Full 429 response example:
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 36
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640000060

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit of 100 requests per 60 seconds exceeded",
    "details": {
      "limit": 100,
      "window_seconds": 60,
      "retry_after_seconds": 36,
      "reset_at": "2021-12-20T12:01:00Z"
    }
  }
}
```

---

## Algorithms Under the Hood

### 1. Token Bucket (Primary Algorithm)

The token bucket is a metaphor: imagine a bucket that holds tokens. Tokens are added at a constant rate (refill). Each request consumes one token. If the bucket is empty, the request is rejected. The bucket has a maximum capacity (burst allowance).

**Properties:** Allows bursts up to capacity. Smooths traffic over time. Two tuning knobs (capacity + refill rate). Memory-efficient (2 values per key).

```lua
-- Token Bucket: Redis Lua Script (atomic execution)
-- KEYS[1] = rate limit key
-- ARGV[1] = bucket capacity (max tokens)
-- ARGV[2] = refill rate (tokens per second)
-- ARGV[3] = current timestamp (epoch with ms precision)
-- ARGV[4] = tokens to consume (usually 1)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4]) or 1

-- Fetch current bucket state
local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

-- Initialize if first request (new key)
if tokens == nil then
    tokens = capacity
    last_refill = now
end

-- Calculate token refill since last request
local elapsed = math.max(0, now - last_refill)
local refilled = elapsed * refill_rate
tokens = math.min(capacity, tokens + refilled)

-- Attempt to consume tokens
if tokens >= requested then
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) * 2)
    -- Return: allowed=1, remaining tokens, ms until next token
    return {1, math.floor(tokens), 0}
else
    -- Rejected: calculate wait time until enough tokens available
    local deficit = requested - tokens
    local wait_ms = math.ceil((deficit / refill_rate) * 1000)
    redis.call('HSET', key, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) * 2)
    return {0, 0, wait_ms}
end
```

---

### 2. Sliding Window Log

Stores the timestamp of every request in the current window. Counts requests by checking how many timestamps fall within `[now - window, now]`. Most accurate but highest memory usage.

**Properties:** Perfectly accurate (no boundary issues). Memory scales with request count (not fixed). Expensive for high-volume keys. Best for low-limit, high-accuracy scenarios (login attempts).

```lua
-- Sliding Window Log: Redis Lua Script
-- Uses a Sorted Set where score = timestamp, member = unique request ID
-- KEYS[1] = rate limit key (sorted set)
-- ARGV[1] = window size in seconds
-- ARGV[2] = max requests per window
-- ARGV[3] = current timestamp (epoch ms)
-- ARGV[4] = unique request ID (for dedup)

local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local request_id = ARGV[4]

-- Remove all entries outside the current window
local window_start = now - (window * 1000)
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- Count requests in current window
local count = redis.call('ZCARD', key)

if count < limit then
    -- Add this request to the log
    redis.call('ZADD', key, now, request_id)
    redis.call('EXPIRE', key, window + 10)
    return {1, limit - count - 1, 0}  -- allowed, remaining, wait_ms
else
    -- Rejected: calculate when oldest entry expires
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local wait_ms = 0
    if #oldest > 0 then
        wait_ms = math.ceil((tonumber(oldest[2]) + (window * 1000)) - now)
    end
    return {0, 0, math.max(0, wait_ms)}
end
```

---

### 3. Sliding Window Counter (Hybrid)

Combines fixed window efficiency with sliding window accuracy. Maintains counters for the current and previous windows, then weights them based on the position within the current window.

**Properties:** Approximate but within ~1% accuracy. Fixed memory (2 counters per key). Eliminates the fixed-window boundary problem. Good balance of accuracy and performance.

```lua
-- Sliding Window Counter: Redis Lua Script
-- Weighted average of current and previous window counters
-- KEYS[1] = current window counter key
-- KEYS[2] = previous window counter key
-- ARGV[1] = window size in seconds
-- ARGV[2] = max requests per window
-- ARGV[3] = current timestamp (epoch seconds)

local curr_key = KEYS[1]
local prev_key = KEYS[2]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Determine position within current window (0.0 to 1.0)
local window_start = math.floor(now / window) * window
local elapsed_in_window = now - window_start
local weight_current = elapsed_in_window / window   -- e.g., 0.7 means 70% through window
local weight_previous = 1 - weight_current          -- e.g., 0.3

-- Get counts for current and previous windows
local curr_count = tonumber(redis.call('GET', curr_key) or "0")
local prev_count = tonumber(redis.call('GET', prev_key) or "0")

-- Calculate weighted request count
-- "How many requests would be in a sliding window ending now?"
local estimated_count = (prev_count * weight_previous) + curr_count

if estimated_count < limit then
    -- Allowed: increment current window counter
    redis.call('INCR', curr_key)
    redis.call('EXPIRE', curr_key, window * 2)
    local remaining = math.floor(limit - estimated_count - 1)
    return {1, math.max(0, remaining), 0}
else
    -- Rejected: estimate when capacity frees up
    local wait_ms = math.ceil((1 - weight_current) * window * 1000)
    return {0, 0, wait_ms}
end
```

---

### 4. Fixed Window Counter

The simplest algorithm. Divides time into fixed windows (e.g., per minute). Counts requests in the current window. Resets to zero when the window expires.

**Properties:** Minimal memory (1 counter + TTL). Simple implementation. Vulnerable to boundary bursts (2x limit at window edge). Best for non-critical, high-volume scenarios.

```lua
-- Fixed Window Counter: Redis Lua Script
-- KEYS[1] = window key (includes window ID)
-- ARGV[1] = max requests per window
-- ARGV[2] = window size in seconds (for TTL)

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

-- Atomic increment and check
local count = redis.call('INCR', key)

-- Set TTL on first request of the window
if count == 1 then
    redis.call('EXPIRE', key, window)
end

if count <= limit then
    return {1, limit - count, 0}  -- allowed, remaining, wait_ms
else
    -- Calculate time remaining in current window
    local ttl = redis.call('TTL', key)
    local wait_ms = ttl * 1000
    return {0, 0, wait_ms}
end
```

---

### Algorithm Comparison

| Criterion | Token Bucket | Sliding Window Log | Sliding Window Counter | Fixed Window |
|---|---|---|---|---|
| **Accuracy** | Exact (per-token) | Exact (per-request) | ~99% (weighted estimate) | Exact within window, 2x at boundary |
| **Memory/key** | 16 bytes | O(n) where n=requests | 24 bytes (2 counters) | 12 bytes |
| **Redis ops/check** | 1 (EVALSHA) | 1 (EVALSHA, but heavier) | 1 (EVALSHA, 2 keys) | 1 (INCR + conditional EXPIRE) |
| **Burst tolerance** | Configurable (capacity knob) | None (strict) | Minimal | 2x at boundary (vulnerability) |
| **Best for** | General API limiting | Login/auth (low-limit, high-accuracy) | High-volume APIs | Simple use cases, non-critical |
| **Boundary problem** | No (continuous refill) | No (true sliding) | Minimal (~1% error) | Yes (double-spend at edge) |
| **Clock sensitivity** | Low (relative elapsed) | Medium (absolute timestamps) | Medium (window alignment) | Low (Redis TTL-based) |
| **Recommended for** | Default choice | Security-critical endpoints | High-volume, cost-sensitive | Internal/dev environments |

---

## Scaling Considerations

| Dimension | Current (1.7M req/sec) | 10x Scale (17M req/sec) | Strategy |
|---|---|---|---|
| **Redis shards** | 6 primaries + 6 replicas | 60 primaries + 60 replicas | Horizontal shard scaling, consistent hash ring expansion |
| **Gateway nodes** | 20 nodes | 200 nodes | Stateless, auto-scale on CPU/connection count |
| **Local cache hit rate** | 40% (saves 680K Redis ops/sec) | 60% (Zipfian: more clients = more hot keys) | Increase local cache size, reduce sync interval |
| **Memory (Redis total)** | 2 GB across 6 shards | 20 GB across 60 shards | Linear scaling, add shards |
| **Network bandwidth** | 231 MB/sec (Redis) | 2.3 GB/sec | Dedicated Redis network, RDMA, or Unix sockets |
| **Lua script CPU** | 23% per shard | 23% per shard (distributes) | Constant per-shard with proper sharding |
| **Hot key mitigation** | Single-shard hotspot possible | Must shard hot keys | Sub-key splitting: `{api_key}:{endpoint}:{shard_n}` |
| **Config propagation** | < 2s (20 nodes via Pub/Sub) | < 5s (200 nodes) | Hierarchical pub/sub or gossip protocol |
| **Monitoring volume** | 1.7M metrics/sec | 17M metrics/sec | Sampling (emit 1% of allowed, 100% of rejected) |
| **Cross-region** | Single region | Multi-region | Per-region rate limits with global aggregation (async) |

### Multi-Region Considerations

At 10x+ scale, the system likely spans multiple regions. Two approaches:

1. **Per-region independent limits** — Each region enforces its own rate limit (e.g., 50 req/min per region). Simple, no cross-region coordination. Downside: client can get N * region_count total requests by rotating regions.

2. **Global rate with local enforcement** — Each region gets a "budget" (proportional to its traffic share). A global coordinator periodically rebalances budgets. Allows burst absorption locally while maintaining global limits. Complexity: budget rebalancing lag, split-brain handling.

---

## Quick Recall

| Question | Answer |
|---|---|
| Why token bucket over sliding window? | Token bucket allows configurable bursts (capacity knob). Sliding window log is strictly uniform — punishes legitimate bursty usage. Token bucket uses 16 bytes/key vs O(n) for sliding log. |
| Why fail-open on Redis failure? | Redis down = allow all traffic. False rejects (blocking paying customers) cause more business damage than brief over-limit (temporary abuse window). Backend services have their own protection (circuit breakers). |
| How is distributed counting solved? | Redis Cluster as single source of truth. Local counters as optimization for hot keys (40% hit rate). Hybrid approach: sub-ms local path + eventual consistency (100ms sync) to Redis. |
| What's the key structure? | `{api_key}:{endpoint}:{algorithm_suffix}`. Hash tag on `{api_key}` ensures all endpoints for one client land on same shard (multi-key ops). TTL = 2x window for auto-cleanup. |
| Why is Retry-After critical? | Without it, rejected clients retry immediately → thundering herd → retry storm consumes 3x resources of original traffic. Retry-After + exponential backoff eliminates this amplification. |
| What's Redis cluster capacity? | 6 shards x 300K ops/sec = 1.8M ops/sec capacity. ~200MB raw state (10M keys x 56 bytes). With local cache reducing load by 40%, effective demand is ~1M ops/sec (55% utilization). |
| Why Lua scripts over MULTI/EXEC? | Lua executes atomically in one round-trip (read + compute refill + decrement + write). MULTI/EXEC needs 3 round-trips + CAS retry on contention. Hot keys would cause frequent EXEC failures. |
| How are rules updated without restart? | Config service pushes updates via Redis Pub/Sub. All gateway nodes subscribe. Rule change propagates in < 2s. In-memory rule cache updated atomically. No connection drops, no deploys. |
| What happens during clock skew? | Token bucket is resilient (uses relative elapsed time). Fix: use Redis `TIME` command instead of client clock. Monitor NTP drift > 500ms. Fixed window is most vulnerable (window misalignment). |
| How to handle a hot key (100K req/sec)? | Local counter absorbs most checks (cache "rejected" state). Request coalescing batches concurrent checks. After sustained abuse, auto-blacklist the key. Shard splitting for legitimate hot keys. |
| What's the false rejection budget? | < 0.1%. Primary cause: clock skew between gateway and Redis, or sync lag in local counter. Mitigate: generous capacity (10% buffer), prefer Redis TIME, reduce sync interval for high-value keys. |
| How does the system handle 10x growth? | Linear horizontal scaling: add Redis shards (consistent hashing), add gateway nodes (stateless). Local cache hit rate improves with scale (Zipfian distribution). Per-shard load stays constant. |
