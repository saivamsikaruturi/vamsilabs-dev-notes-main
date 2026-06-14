---
title: "System Design Interview Cheat Sheet 2025 — The Complete Reference"
description: "The complete system design interview cheat sheet. Covers the interview framework, estimation, CAP theorem, caching, databases, messaging, load balancing, and 14 case studies — everything you need in one page."
---

# System Design Interview Cheat Sheet 2025

Everything you need to ace the system design interview on one page. Use this as your **pre-interview reference** — the framework, the components, the numbers, and the tradeoffs that interviewers expect you to know cold.

---

## The Interview Framework (First 5 Minutes)

Never start drawing boxes. Use the first 5 minutes to clarify requirements:

```
1. Clarify requirements
   - Functional: what does the system do? (core features only)
   - Non-functional: scale, latency, consistency, availability

2. Estimate scale
   - DAU → QPS → storage → bandwidth

3. High-level design
   - API design → data model → core components

4. Deep dive
   - Bottlenecks, edge cases, failure modes

5. Wrap up
   - Summarize tradeoffs, what you'd improve
```

**Interviewers penalize:** jumping to solutions, over-engineering, ignoring non-functional requirements.

→ Deep dive: [System Design Interview Guide](system-design-interview-guide.md)

---

## Estimation Cheat Sheet

### Key Numbers to Memorize

| Operation | Latency |
|---|---|
| L1 cache | ~1 ns |
| L2 cache | ~4 ns |
| RAM read | ~100 ns |
| SSD random read | ~100 µs |
| HDD seek | ~10 ms |
| Network round trip (same DC) | ~500 µs |
| Network round trip (cross-region) | ~150 ms |

### Traffic Estimation Formula

```
DAU × actions/day ÷ 86,400 = QPS
Peak QPS ≈ 2–3× average QPS

Storage per year = QPS × object_size × 86,400 × 365
```

**Example:** Twitter-scale (500M DAU, 1 tweet/day average)
- Write QPS: 500M / 86,400 ≈ **5,800 QPS**
- Read QPS (10:1 read/write): **~58,000 QPS**
- Storage: 5,800 × 280 bytes × 86,400 ≈ **140 GB/day**

→ Deep dive: [Estimation Cheat Sheet](estimation-cheatsheet.md)

---

## CAP Theorem

A distributed system can only guarantee **2 of 3**:

| | Consistency | Availability | Partition Tolerance |
|---|---|---|---|
| **CP** (e.g., HBase, Zookeeper) | ✅ | ❌ (returns error) | ✅ |
| **AP** (e.g., Cassandra, DynamoDB) | ❌ (eventual) | ✅ | ✅ |
| **CA** (not possible in distributed systems) | ✅ | ✅ | ❌ |

**P is non-negotiable** in distributed systems — network partitions happen. The real choice is C vs A.

**Interview answer:** "Since partition tolerance is mandatory in distributed systems, the real choice is between CP and AP — whether we prioritize consistency (return errors on partition) or availability (return potentially stale data)."

→ Deep dive: [CAP Theorem](../capTheorem.md)

---

## Caching

### When to cache
- Read-heavy (10:1+ read/write ratio)
- Data doesn't change frequently
- Compute or DB is the bottleneck

### Caching strategies

| Strategy | How it works | Use when |
|---|---|---|
| **Cache-aside** (lazy) | App checks cache first; on miss, loads from DB and populates cache | Most common — good for read-heavy |
| **Write-through** | Every write goes to cache AND DB synchronously | Strong consistency needed |
| **Write-behind** (write-back) | Write to cache immediately; DB written async | Write-heavy, can tolerate small data loss |
| **Read-through** | Cache handles DB reads transparently | Simplifies app code |

### Cache eviction policies
- **LRU** (Least Recently Used) — evict what was accessed least recently
- **LFU** (Least Frequently Used) — evict what is accessed least often
- **TTL-based** — expire after time window

### Cache problems

| Problem | Cause | Fix |
|---|---|---|
| **Cache stampede** | Many threads miss cache simultaneously, all hit DB | Mutex lock on cache population, probabilistic early expiration |
| **Cache penetration** | Request for key that never exists, bypasses cache, always hits DB | Bloom filter to reject non-existent keys; cache null results |
| **Cache avalanche** | Many keys expire simultaneously, flood DB | Jitter on TTL, gradual warm-up |

→ Deep dive: [Distributed Caching](../distributedCaching.md) · [Redis](../redis.md)

---

## Databases

### SQL vs NoSQL

| | SQL (PostgreSQL, MySQL) | NoSQL |
|---|---|---|
| **Structure** | Fixed schema, tables | Flexible schema |
| **Scaling** | Vertical (hard horizontal) | Horizontal (native) |
| **ACID** | Full ACID | Varies (BASE for most) |
| **Joins** | Native | Application-level |
| **Use for** | Financial data, user accounts, reporting | Social graphs, time-series, catalogs, large-scale reads |

**When NoSQL:** schema changes frequently, massive horizontal scale needed, data is document/graph/time-series shaped.

### NoSQL types

| Type | Examples | Best for |
|---|---|---|
| Document | MongoDB, Firestore | User profiles, catalogs, CMS |
| Key-Value | Redis, DynamoDB | Sessions, caches, shopping carts |
| Wide-Column | Cassandra, HBase | Time-series, IoT, write-heavy |
| Graph | Neo4j | Social networks, fraud detection, recommendations |

### Replication types

- **Master-replica (primary-secondary):** Writes to primary; reads can go to replicas. Replicas are async — risk of stale reads. Failover requires promotion.
- **Multi-master:** Writes to any node. Handles write conflicts with last-write-wins or CRDTs. Higher complexity.
- **Synchronous vs async replication:** Sync = strong consistency, higher write latency. Async = better performance, risk of data loss on failover.

→ Deep dive: [Replication](replication.md) · [Database Sharding](database-sharding.md)

### Database sharding

Horizontal partitioning — split data across multiple DB nodes.

- **Hash sharding:** `shard = hash(key) % N` — even distribution, hard to re-shard
- **Range sharding:** key ranges per shard — supports range queries, risk of hotspots
- **Directory sharding:** lookup table maps keys to shards — flexible, lookup is a bottleneck

**Problems:** cross-shard joins, distributed transactions, re-sharding downtime, hotspots.

→ Deep dive: [Consistent Hashing](../consistenthashing.md)

---

## Load Balancing

### Algorithms

| Algorithm | Use when |
|---|---|
| **Round-robin** | Servers are homogeneous |
| **Weighted round-robin** | Servers have different capacities |
| **Least connections** | Requests have variable processing time |
| **IP hash** | Need sticky sessions (user always hits same server) |
| **Consistent hashing** | Distributed caches — minimize re-mapping on scale |

### L4 vs L7

- **L4 (transport layer):** Routes by IP + TCP port. Fast, no content inspection. Can't route by URL path or headers.
- **L7 (application layer):** Routes by HTTP headers, URL, cookies. Enables A/B testing, canary deploys, path-based routing. Slightly more overhead.

→ Deep dive: [Load Balancing](../loadbalancer.md)

---

## Message Queues & Event Streaming

### When to use
- Decouple producer from consumer (async processing)
- Buffer traffic spikes (order processing, email sending)
- Guarantee at-least-once delivery
- Fan-out to multiple consumers

### Queue vs Stream

| | Message Queue (SQS, RabbitMQ) | Event Stream (Kafka) |
|---|---|---|
| **Message lifecycle** | Deleted after consumption | Retained (configurable) |
| **Consumer groups** | Competing consumers (one gets message) | Independent consumer groups (all get it) |
| **Replay** | No | Yes — replay from any offset |
| **Ordering** | Per-queue FIFO | Per-partition ordering |
| **Use for** | Task queues, notifications | Event sourcing, audit logs, CDC, real-time analytics |

### Kafka key concepts
- **Topic:** logical stream of records
- **Partition:** ordered, immutable log — unit of parallelism
- **Consumer group:** each partition consumed by exactly one consumer in the group
- **Offset:** position in partition — commit to track progress
- **Exactly-once:** possible with idempotent producers + transactional consumers

→ Deep dive: [Message Queues](message-queues.md) · [Kafka](../kafka-messaging/kafka.md)

---

## Consistent Hashing

Maps both servers and keys onto a ring (0–2^32). Each key is handled by the first server clockwise. Adding/removing a server only remaps ~K/N keys (K = keys, N = servers). Used in: CDNs, distributed caches (Memcached, Redis Cluster), load balancers.

**Virtual nodes:** each server gets multiple positions on the ring — improves distribution balance.

→ Deep dive: [Consistent Hashing](../consistenthashing.md)

---

## Rate Limiting

### Algorithms

| Algorithm | How it works | Pro/Con |
|---|---|---|
| **Token bucket** | Tokens added at fixed rate; request consumes a token | Allows bursts up to bucket size |
| **Leaky bucket** | Requests queued; processed at fixed rate | Smooth output, no bursts allowed |
| **Fixed window counter** | Count requests per window (e.g., 100/minute) | Edge case: 200 requests in 2 seconds spanning window boundary |
| **Sliding window log** | Log timestamps of each request; count within last N seconds | Accurate; memory-intensive |
| **Sliding window counter** | Hybrid of fixed windows; weighted overlap | Good balance |

→ Deep dive: [Rate Limiting](../ratelimiting.md) · [Rate Limiter Case Study](case-studies/rate-limiter.md)

---

## CDN & Proxies

**CDN (Content Delivery Network):** Cache static assets (images, JS, CSS) at edge nodes close to users. Reduces origin server load and latency. **Push CDN** (pre-populate) vs **Pull CDN** (cache on first request).

**Forward proxy:** sits in front of clients — hides client identity, used for content filtering, VPNs.

**Reverse proxy:** sits in front of servers — hides server identity, used for load balancing, SSL termination, caching (Nginx, Cloudflare).

→ Deep dive: [CDN](cdn.md) · [Proxies](proxies.md)

---

## API Design Patterns

- **REST:** resources + HTTP verbs + stateless. Standard for CRUD operations.
- **gRPC:** Protocol Buffers over HTTP/2. Binary, strongly typed, bidirectional streaming. Preferred for internal microservices.
- **GraphQL:** client specifies exactly what data it needs. Solves over-fetching/under-fetching. Complex to cache, higher server complexity.
- **WebSockets:** persistent bidirectional connection over TCP. Use for real-time: chat, live feeds, collaborative editing.

→ Deep dive: [REST API Design](../apidesign/apidesign.md) · [gRPC](grpc.md) · [WebSockets & SSE](websockets-sse.md)

---

## Key System Design Patterns

| Pattern | Problem it solves | Example |
|---|---|---|
| **CQRS** | Read/write models have different requirements | Orders (write) vs Order history (read) |
| **Event Sourcing** | Need full audit trail, event replay | Bank ledger, inventory |
| **Saga** | Distributed transactions across microservices | Order → Payment → Inventory |
| **Circuit Breaker** | Prevent cascading failures | Service A stops calling failing Service B |
| **Sidecar** | Add cross-cutting concerns without modifying service | Envoy proxy for mTLS, tracing |
| **Outbox Pattern** | Guaranteed event publication with DB transaction | Transactional inbox for messaging |
| **Bulkhead** | Isolate failures to one partition | Separate thread pools per downstream |

→ Deep dive: [Event Sourcing](event-sourcing.md) · [Distributed Transactions](distributed-transactions.md) · [Circuit Breakers](circuit-breakers.md)

---

## Case Studies Quick Reference

| System | Key Design Decisions |
|---|---|
| [URL Shortener](case-studies/url-shortener.md) | Base62 encoding, KV store, consistent hashing for read replicas, bloom filter for custom aliases |
| [Chat System](case-studies/chat-system.md) | WebSockets, message fanout via pub/sub, last-seen with Redis, message ordering via sequence IDs |
| [Notification System](case-studies/notification-system.md) | Push queue per channel, retry with backoff, deduplication, rate limiting per user |
| [News Feed](case-studies/news-feed.md) | Push vs pull fanout, celebrity problem, Redis sorted sets for ranking |
| [Rate Limiter](case-studies/rate-limiter.md) | Token bucket, Redis with Lua script for atomic CAS, distributed vs local limiter |
| [Payment System](case-studies/payment-system.md) | Idempotency keys, outbox pattern, saga for multi-service transactions |
| [Search Autocomplete](case-studies/search-autocomplete.md) | Trie + Redis sorted set, top-K aggregation, batch updates |
| [Distributed Cache](case-studies/distributed-cache.md) | Consistent hashing, eviction policies, replication factor |
| [Web Crawler](case-studies/web-crawler.md) | BFS queue, politeness (robots.txt), deduplication with bloom filter |
| [File Storage (Drive)](case-studies/file-storage.md) | Chunking, deduplication, versioning, S3-compatible object storage |
| [Video Streaming](case-studies/video-streaming.md) | Transcoding pipeline, adaptive bitrate (HLS/DASH), CDN for edge delivery |
| [Ride Sharing](case-studies/ride-sharing.md) | Geohashing for driver matching, WebSocket for location updates, surge pricing |
| [Ticket Booking](case-studies/ticket-booking.md) | Optimistic locking, seat reservation timeout, idempotency |
| [E-Commerce](case-studies/e-commerce.md) | Inventory at scale, cart with TTL, order saga, search with Elasticsearch |

---

## Common Tradeoffs to Articulate

**Consistency vs Availability:** In a partition, do you return an error (CP) or stale data (AP)? Answer depends on domain — banking = CP, social feed = AP.

**Latency vs Throughput:** Caching improves both. Batching improves throughput at cost of latency. Async processing improves throughput; user waits for callback.

**SQL vs NoSQL:** SQL for relational data with complex queries; NoSQL for massive scale, simple access patterns, flexible schemas.

**Push vs Pull fanout:** Push = low read latency, expensive for celebrity users. Pull = simple writes, expensive reads. Hybrid = push for regular users, pull for celebrities (Twitter model).

**Horizontal vs Vertical scaling:** Vertical has hard limits. Horizontal requires stateless services, distributed sessions, consistent hashing.

---

## Go Deeper

- [System Design Interview Guide](system-design-interview-guide.md) — full framework + walkthroughs
- [All 14 Case Studies](case-studies/index.md)
- [Consistent Hashing](../consistenthashing.md)
- [Distributed Transactions](distributed-transactions.md)
- [CAP Theorem](../capTheorem.md)
- [Estimation Cheat Sheet](estimation-cheatsheet.md)
- [Comparisons Quick Reference](comparisons.md)
