# System Design Case Studies

Each case study combines the building blocks from other pages (partitioning, replication, CDN, message queues, caching, sharding, circuit breakers) into a complete end-to-end system design. Structured as condensed 35-minute interview answers.

---

## Case Studies

| # | System | Key Challenge | Core Pattern |
|---|---|---|---|
| 1 | [URL Shortener](url-shortener.md) | 100:1 read-write ratio at scale | Multi-layer cache (CDN → Redis → DB) + pre-generated IDs |
| 2 | [Chat System](chat-system.md) | 170M concurrent WebSocket connections | Gateway fleet + Redis Pub/Sub + Cassandra |
| 3 | [Notification System](notification-system.md) | 1B/day across push, SMS, email channels | Priority queues + channel isolation + dedup |
| 4 | [News Feed](news-feed.md) | Celebrity fan-out (50M followers) | Hybrid fan-out: push for normal, pull for celebrities |
| 5 | [Ride Sharing](ride-sharing.md) | 1.7M location updates/sec + real-time matching | Geospatial index (Redis) + expanding radius match |
| 6 | [Video Streaming](video-streaming.md) | 170 Tbps peak bandwidth + adaptive quality | CDN + chunked adaptive bitrate (HLS/DASH) |
| 7 | [Ticket Booking](ticket-booking.md) | 333K seat attempts/sec with zero overselling | Virtual queue + Redis SETNX (atomic seat lock) |
| 8 | [Rate Limiter](rate-limiter.md) | 1.7M checks/sec with sub-ms latency | Token bucket in Redis + fail-open |

---

## Quick Recall — System Design Patterns

| If Asked About... | Key Insight |
|---|---|
| URL shortener | Base62 encoding, cache-heavy (power law), async analytics |
| Chat system | WebSocket + Redis Pub/Sub between gateways, partition messages by conversation_id |
| Notification system | Priority queues, deduplication at every layer, rate limit to prevent spam |
| News feed | Hybrid fan-out: push for normal users, pull for celebrities. Redis sorted sets for timeline cache |
| Ride sharing | Geospatial index (Redis GEOADD), location updates every 3s, expanding radius matching |
| Video streaming | Chunked adaptive bitrate (HLS/DASH), async transcoding queue, CDN for delivery |
| Ticket booking | Redis SETNX for atomic seat locking, virtual queue for traffic shaping, strong consistency |
| Rate limiter | Token bucket for bursts, Redis for distributed state, fail-open on Redis failure |

---

## Common Patterns Across All Designs

| Pattern | Where It Appears |
|---|---|
| **Async processing via message queue** | URL shortener (analytics), Chat (storage), Notifications (delivery), Video (transcode) |
| **Redis as hot-path cache/store** | URL shortener (LRU cache), Chat (Pub/Sub), Feed (timeline), Ride (geo-index), Ticket (seat locks), Rate limiter (counters) |
| **Sharding for horizontal scale** | URL shortener (by hash), Chat (by conversation), Feed (by user), Ride (by city) |
| **CDN for read-heavy traffic** | URL shortener (redirects), Video (segments), Ticket (static assets) |
| **Eventual consistency trade-off** | Feed (1-2s stale OK), Notifications (delivery status), Chat (presence) |
| **Strong consistency where money is involved** | Ticket booking (no overselling), Rate limiter (exact counts), Ride (payment) |
