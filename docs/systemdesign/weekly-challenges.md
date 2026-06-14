---
description: "Weekly system design challenges with problem statements, constraints, hints, and solution outlines. Practice designing URL shorteners, rate limiters, chat apps, and more."
---

# Weekly System Design Challenges

> **Sharpen your system design skills one challenge at a time.** Each week presents a real interview-caliber problem with constraints, hints (if you get stuck), and a solution outline to compare against.

---

## How to Use This Page

1. **Read the problem and constraints** — spend 5 minutes understanding the scope
2. **Draw your architecture** on paper or whiteboard (aim for 30-40 minutes)
3. **Check the hints** only if stuck after 15 minutes
4. **Compare with the solution outline** — focus on the *decisions* and *trade-offs*, not memorizing diagrams

!!! info "Scoring Yourself"
    A strong answer covers: **functional requirements, non-functional requirements, API design, data model, high-level architecture, deep dive on 1-2 components, and trade-offs.** If you hit all six, you're interview-ready for that topic.

---

## Week 1: Design a URL Shortener

**Problem:** Design a system that takes long URLs and converts them to short, unique URLs. The system should handle 100M URLs/day with a 10:1 read/write ratio.

**Requirements:**

- Generate unique short URLs (7 characters)
- Redirect short URL to original URL with < 100ms latency
- URLs expire after a configurable TTL
- Analytics: track click counts per URL

**Constraints:**

- 100M new URLs/day, 1B redirects/day
- 99.99% availability
- URL length: 7 characters (base62 = 62^7 = 3.5 trillion combinations)

??? tip "Hints"
    - Think about how to generate unique IDs at scale — counter vs hash?
    - Consider the read-heavy nature (10:1) — what caching strategy works?
    - What data store fits best for key-value lookups with TTL?
    - How do you handle hash collisions if using MD5/SHA?

??? success "Solution Approach"
    **Key decisions:**
    
    1. **ID Generation:** Base62 encoding of a distributed auto-increment ID (Snowflake) or MD5 hash (first 43 bits → base62). Auto-increment avoids collisions.
    2. **Storage:** NoSQL (DynamoDB/Cassandra) for key-value lookups — partition key = short URL, value = long URL + metadata + TTL.
    3. **Caching:** Redis cache for hot URLs (80/20 rule — 20% of URLs get 80% of traffic). Cache ~20% of daily redirects.
    4. **Architecture:** Write path → ID generator → DB; Read path → Cache → DB → 301/302 Redirect.
    5. **Analytics:** Async — write click events to Kafka → aggregate in Flink/Spark → store counts.
    
    **Scale math:**
    
    - Writes: 100M/day = 1,157/sec
    - Reads: 1B/day = 11,574/sec
    - Storage: 100M * 500 bytes = 50GB/day → 18TB over 1 year
    
    **Trade-offs:** 301 (permanent redirect, better for SEO, no analytics) vs 302 (temporary, enables click tracking).

---

## Week 2: Design a Rate Limiter

**Problem:** Design a distributed rate limiting service that protects APIs from abuse. It should support multiple limiting strategies and work across a fleet of API servers.

**Requirements:**

- Limit requests per user/IP/API key per time window
- Support multiple algorithms (fixed window, sliding window, token bucket)
- Return `429 Too Many Requests` with `Retry-After` header
- Sub-millisecond decision latency (sits in the hot path)

**Constraints:**

- 1M+ requests/second across all services
- Must work in a distributed environment (multiple API servers)
- False positive rate < 0.1% (don't block legitimate users)
- Configurable rules per endpoint (e.g., `/login` = 5/min, `/search` = 100/min)

??? tip "Hints"
    - Where do you store counters for a distributed system? Think in-memory + shared store.
    - Token bucket is most flexible — how does it work?
    - What happens when Redis (counter store) is unavailable? Fail open or closed?
    - How do you handle race conditions with concurrent counter increments?

??? success "Solution Approach"
    **Key decisions:**
    
    1. **Algorithm:** Token bucket per user/endpoint — allows bursts while enforcing average rate. Each bucket has `tokens` (current count) and `last_refill_timestamp`.
    2. **Storage:** Redis — atomic `INCR` + `EXPIRE` for fixed window, or Lua script for sliding window log. Redis handles ~100K ops/sec per node.
    3. **Architecture:** Rate limiter as middleware/sidecar. Check Redis → allow/deny → forward to upstream.
    4. **Distributed sync:** Redis is the single source of truth. Use Redis Cluster for sharding across users.
    5. **Rules engine:** Store rules in a config service (e.g., `{endpoint: "/login", limit: 5, window: 60s}`). Cache rules locally.
    
    **Failure handling:**
    
    - Redis down → fail open (allow requests) with local in-memory fallback
    - Race conditions → Redis Lua scripts (atomic read-check-increment)
    
    **Headers returned:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`

---

## Week 3: Design a Notification System

**Problem:** Design a system that sends notifications across multiple channels (push, SMS, email) to billions of devices. It must handle priorities, user preferences, and guaranteed delivery.

**Requirements:**

- Multi-channel: push notifications (iOS/Android), SMS, email
- User preferences: opt-in/out per channel, quiet hours
- Priority levels: critical (immediate), high, normal, low (batched)
- Delivery guarantee: at-least-once with deduplication
- Rate limiting per user (no notification spam)

**Constraints:**

- 10B notifications/day (peak: 500K/sec during flash sales)
- Delivery latency: < 2s for critical, < 30s for normal
- 99.9% delivery rate (retry on failure)
- Support 1B+ registered devices

??? tip "Hints"
    - Think about message queues with priority — how do you ensure critical messages jump the queue?
    - How do you handle vendor-specific push (APNs, FCM) failures and retries?
    - Device token management: tokens expire, users reinstall apps
    - How do you batch low-priority notifications without losing them?

??? success "Solution Approach"
    **Key decisions:**
    
    1. **Architecture:** Event-driven pipeline — API → Validation → Priority Queue → Channel Router → Vendor Adapters (APNs, FCM, Twilio, SendGrid).
    2. **Queuing:** Kafka with priority topics (critical, high, normal, low). Critical topic gets more consumer partitions.
    3. **Preference service:** User preferences in Redis (fast lookup). Check before sending: channel enabled? quiet hours? rate limit OK?
    4. **Delivery tracking:** Each notification gets a UUID. Track state machine: `CREATED → QUEUED → SENT → DELIVERED / FAILED`. Store in Cassandra.
    5. **Retry:** Exponential backoff with max 3 retries. DLQ for permanently failed messages.
    6. **Deduplication:** Idempotency key (hash of user_id + template_id + params + time_window) in Redis with 1-hour TTL.
    
    **Scale math:**
    
    - 10B/day = 115K/sec average, 500K/sec peak
    - Kafka handles this easily with 100+ partitions per topic
    - Device token store: 1B devices * 200 bytes = 200GB (fits in sharded DB)

---

## Week 4: Design a Chat Application

**Problem:** Design a real-time messaging system like WhatsApp that supports 1:1 chat, group messaging, read receipts, and offline message delivery.

**Requirements:**

- 1:1 and group chat (up to 256 members)
- Real-time delivery (< 200ms end-to-end for online users)
- Offline message queue (deliver when user comes online)
- Read receipts (sent, delivered, read)
- Message ordering guarantee within a conversation
- Media sharing (images, videos, documents)

**Constraints:**

- 1B active users, 100B messages/day
- 99.99% message delivery guarantee
- End-to-end encryption
- Support 50M concurrent WebSocket connections

??? tip "Hints"
    - How do you maintain millions of persistent connections? Think connection servers + session registry.
    - How do you route a message to the correct server holding the recipient's connection?
    - For group messages, do you fan-out on write or fan-out on read?
    - How do you guarantee ordering? Think per-conversation sequence numbers.

??? success "Solution Approach"
    **Key decisions:**
    
    1. **Connection layer:** WebSocket gateway servers (each handling ~500K connections). Session registry in Redis maps `user_id → gateway_server_id`.
    2. **Message flow:** Sender → Gateway → Message Service → lookup recipient gateway → push to recipient. If offline → store in message queue (Cassandra).
    3. **Storage:** Messages in Cassandra (partition key = conversation_id, clustering key = timestamp). Hot messages cached in Redis.
    4. **Ordering:** Per-conversation monotonic sequence number (atomic counter in Redis or DB sequence).
    5. **Group messaging:** Fan-out on write for small groups (< 256). Each member gets a copy in their inbox. Avoids read-time fan-out latency.
    6. **Read receipts:** Lightweight status updates piggybacked on the WebSocket connection. Batch receipt updates to reduce writes.
    7. **Media:** Upload to S3/CDN → send URL as message payload. Thumbnail generated async.
    
    **Offline delivery:** When user connects → pull all pending messages from their inbox (Cassandra partition scan by user_id + undelivered flag).

---

## Week 5: Design a News Feed

**Problem:** Design a social media news feed (like Facebook/Twitter) that shows a personalized, ranked feed of posts from friends/followed accounts.

**Requirements:**

- Personalized feed: show posts from friends/followed accounts
- Ranked by relevance (not just chronological)
- Support posts, shares, likes, comments
- Near-real-time: new posts appear within 5 seconds
- Pagination with consistent ordering (no duplicates on scroll)

**Constraints:**

- 500M DAU, average user follows 200 accounts
- Celebrity accounts: 100M+ followers
- Feed generation < 500ms latency
- 10B feed requests/day

??? tip "Hints"
    - The classic problem: fan-out on write vs fan-out on read. What about a hybrid?
    - How do you handle celebrities with 100M followers? Writing to 100M feeds is expensive.
    - Ranking requires ML — but how do you make it fast enough for real-time?
    - How do you handle pagination without showing duplicates as new posts arrive?

??? success "Solution Approach"
    **Key decisions:**
    
    1. **Hybrid fan-out:** Fan-out on write for normal users (< 10K followers) — push post ID to each follower's feed cache. Fan-out on read for celebrities — pull their posts at read time and merge.
    2. **Feed cache:** Redis sorted set per user (score = timestamp or ranking score). Store only post IDs (not full content). Limit to last 1000 items.
    3. **Ranking:** Lightweight ML model scores posts at fan-out time (features: recency, engagement, relationship strength). Re-rank at read time with latest signals.
    4. **Feed generation:** Read from feed cache (Redis) → hydrate post IDs from Post Service → apply final ranking → return page.
    5. **Pagination:** Cursor-based (last seen post_id + timestamp) — not offset-based. Guarantees no duplicates.
    6. **Post storage:** Posts in sharded MySQL/PostgreSQL (partition by user_id). Hot posts cached in Redis.
    
    **Scale math:**
    
    - Fan-out: User with 200 followers → 200 Redis writes per post. Celebrity with 100M followers → DON'T fan out, pull at read time.
    - Feed cache: 500M users * 1000 post IDs * 8 bytes = 4TB Redis cluster

---

## Week 6: Design a Video Streaming Platform

**Problem:** Design a video streaming platform like YouTube that handles video upload, processing, storage, and adaptive streaming to millions of concurrent viewers.

**Requirements:**

- Video upload (up to 10GB per file)
- Transcoding to multiple resolutions (240p, 480p, 720p, 1080p, 4K)
- Adaptive bitrate streaming (switch quality based on bandwidth)
- Video recommendations (related videos)
- Live view count and comments

**Constraints:**

- 1B videos stored, 500M videos watched daily
- 500 hours of video uploaded per minute
- 99.99% availability for playback
- Global audience (multi-region CDN)
- < 3 second start time for any video

??? tip "Hints"
    - Video transcoding is compute-intensive — how do you parallelize it?
    - How does adaptive bitrate streaming (HLS/DASH) work at the protocol level?
    - What's the storage cost model? How do you handle long-tail (rarely watched) videos?
    - CDN is critical — how do you decide what to cache at the edge?

??? success "Solution Approach"
    **Key decisions:**
    
    1. **Upload pipeline:** Client → Upload Service (resumable, chunked uploads via tus protocol) → Object Storage (S3) → Transcode Queue.
    2. **Transcoding:** DAG-based pipeline (split video into segments → transcode each segment in parallel → merge). Use FFmpeg on spot instances. Generate HLS manifest (.m3u8) with multiple quality levels.
    3. **Storage tiering:** Hot videos (< 30 days, popular) on SSD-backed CDN origin. Cold videos (long tail) on cheaper storage (S3 Glacier) with on-demand warming.
    4. **Streaming:** HLS/DASH adaptive bitrate. CDN serves segments. Client measures bandwidth → requests appropriate quality segment. Manifest lists all available bitrates.
    5. **CDN strategy:** Multi-tier CDN (edge → regional → origin). Cache popular videos at edge. Use consistent hashing for cache key distribution.
    6. **Recommendations:** Collaborative filtering + content-based. Pre-compute for popular videos, compute in real-time for long-tail using embedding similarity.
    
    **Scale math:**
    
    - Upload: 500 hours/min * 60 min * 3GB avg = 90TB/hour of raw uploads
    - Storage: 1B videos * 5 renditions * 2GB avg = 10EB (exabytes) — need tiered storage
    - Bandwidth: 500M views/day * 500MB avg = 250PB/day egress

---

## Week 7: Design a Ride-Sharing System

**Problem:** Design a ride-sharing platform like Uber that matches riders with nearby drivers in real-time, handles pricing, and tracks rides.

**Requirements:**

- Real-time driver-rider matching (< 10 seconds)
- Dynamic pricing (surge pricing based on demand/supply)
- Real-time location tracking during ride
- ETA estimation for pickup and destination
- Trip history and payment processing

**Constraints:**

- 10M rides/day, 5M concurrent drivers online
- Location updates: every 3 seconds per active driver
- Matching radius: find drivers within 5km
- 99.9% availability (safety-critical system)
- Multi-city, multi-country operation

??? tip "Hints"
    - How do you efficiently find "nearby drivers"? Think spatial indexing (geohash, quadtree, S2 cells).
    - Location updates at 5M drivers * every 3s = 1.7M updates/sec. How do you handle this write throughput?
    - Matching is a real-time optimization problem — how do you balance wait time, driver utilization, and ETA?
    - How do you handle the "thundering herd" problem when multiple riders request in the same area?

??? success "Solution Approach"
    **Key decisions:**
    
    1. **Location service:** Drivers send GPS coordinates every 3 seconds. Store in Redis with geospatial index (`GEOADD`, `GEORADIUS`). Shard by city/region.
    2. **Matching engine:** When rider requests → query nearby available drivers (within expanding radius) → rank by ETA → send request to top-K drivers → first accept wins.
    3. **Spatial indexing:** Geohash-based grid (precision level 6 = ~1.2km cells). Store driver locations in cells. "Nearby" = same cell + 8 adjacent cells.
    4. **Surge pricing:** Supply/demand ratio per geohash cell. Calculate in real-time: `surge_multiplier = demand_count / (supply_count * baseline_ratio)`. Smooth with moving average.
    5. **Trip tracking:** Active trip → location updates published to Kafka → consumed by Trip Service → stored in time-series DB → pushed to rider via WebSocket.
    6. **ETA:** Pre-computed road graph (OSRM/Valhalla) + real-time traffic data. ML model adjusts for historical patterns.
    
    **Scale math:**
    
    - Location writes: 5M drivers / 3s = 1.7M writes/sec to Redis (sharded across cities)
    - Matching: 10M rides/day = 115 matches/sec (bursty — peak 10x during rush hour)
    - Geospatial queries: Redis `GEORADIUS` handles 100K+ queries/sec per shard

---

## Week 8: Design a Distributed Cache

**Problem:** Design a distributed caching system like Redis/Memcached that provides sub-millisecond key-value access across a cluster of machines with high availability.

**Requirements:**

- Sub-millisecond GET/SET operations
- Support for multiple data types (strings, lists, sets, hashes)
- Horizontal scaling (add/remove nodes without downtime)
- Data replication for fault tolerance
- TTL-based expiration
- Eviction policies (LRU, LFU, random)

**Constraints:**

- 10M operations/second across the cluster
- < 1ms P99 latency for GET operations
- Support 100TB+ of cached data across cluster
- Node failure shouldn't cause data loss (replication factor = 3)
- Network partition tolerance

??? tip "Hints"
    - How do you distribute keys across nodes? Think consistent hashing with virtual nodes.
    - What happens when a node fails? How do other nodes detect it and take over?
    - How do you handle hot keys (one key getting millions of reads)?
    - Cache stampede: 1000 requests for the same expired key. How do you prevent all of them from hitting the database?

??? success "Solution Approach"
    **Key decisions:**
    
    1. **Partitioning:** Consistent hashing with virtual nodes (150+ vnodes per physical node). Ensures even distribution and minimal rebalancing on node add/remove.
    2. **Replication:** Each key replicated to N=3 nodes (primary + 2 replicas on the hash ring). Writes go to primary → async replicate to followers. Configurable consistency (W=1 for speed, W=2 for durability).
    3. **Data structures:** In-memory hash table per node. Sub-structures (lists, sets, sorted sets) stored as optimized C data structures. Memory-mapped for persistence snapshots.
    4. **Eviction:** LRU approximation (sample 5 random keys, evict the least recently used among them). More memory-efficient than true LRU (no linked list overhead).
    5. **Failure detection:** Gossip protocol — each node pings random peers every 1s. If no response after 3 attempts, mark as suspected. If majority agree, mark as dead → promote replica.
    6. **Hot keys:** Client-side caching with server-assisted invalidation (tracking which clients cached which keys). Or: replicate hot keys to all nodes.
    7. **Cache stampede prevention:** Probabilistic early expiration (recompute before TTL expires based on `current_time + random() * beta * compute_time > expiry`). Or: single-flight/lock per key.
    
    **Client routing:** Smart client (knows the hash ring topology) routes directly to the correct node. Gossip protocol keeps clients updated on topology changes.
    
    **Scale math:**
    
    - 10M ops/sec / 10 nodes = 1M ops/sec per node (achievable with in-memory store)
    - 100TB / 10 nodes = 10TB per node (need large-memory machines or SSD-backed with memory caching)

---

## What's Next?

Once you're comfortable with these 8 challenges, try combining systems:

- **Design Twitter** = News Feed + Notification System + Rate Limiter
- **Design Uber Eats** = Ride-Sharing + Notification System + Chat
- **Design Netflix** = Video Streaming + Distributed Cache + News Feed (recommendations)

!!! tip "Interview Pro Tip"
    In a real interview, you won't design the entire system in 45 minutes. The interviewer wants to see your **thought process**: how you scope the problem, identify bottlenecks, make trade-offs, and dive deep into one component. Practice talking through your decisions out loud.
