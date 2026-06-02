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

## Company-Wise: What Gets Asked Where

| Company | Frequently Asked System Design Topics | Focus Area |
|---|---|---|
| **Google** | Search Autocomplete, Web Crawler, YouTube, Google Maps, Google Drive, Distributed File System (GFS), Pub/Sub (Kafka-like) | Scale (billions of users), distributed systems depth, data pipelines |
| **Amazon** | E-commerce Order Processing, Warehouse Management, Recommendation Engine, Delivery Routing, Rate Limiter, DynamoDB-like KV Store | Availability over consistency, event-driven, operational excellence |
| **Meta** | News Feed, Chat/Messenger, Instagram Stories, Live Video, Notification System, Social Graph, Content Moderation | Fan-out at scale, real-time, graph traversal, content ranking |
| **Microsoft** | File Storage (OneDrive), Teams (Chat + Video), Search Engine (Bing), Azure Load Balancer, Distributed Cache, Calendar System | Enterprise-grade reliability, multi-tenant, Windows ecosystem |
| **Apple** | iMessage, iCloud Storage, App Store (Search + Distribution), AirDrop, Find My Device, Media Streaming (Apple Music) | Privacy-first design, end-to-end encryption, device sync |
| **Netflix** | Video Streaming, CDN Design, Recommendation Engine, A/B Testing Platform, Chaos Engineering, Microservices Gateway | Availability, adaptive bitrate, global CDN, fault tolerance |
| **Uber** | Ride Matching, ETA Estimation, Surge Pricing, Driver Location Tracking, Payment System, Food Delivery (Uber Eats) | Geospatial, real-time matching, dynamic pricing, supply-demand |
| **Stripe** | Payment Processing, Idempotency System, API Rate Limiter, Webhook Delivery, Ledger/Accounting, Fraud Detection | Exactly-once processing, financial consistency, API design |
| **Salesforce** | Multi-Tenant Platform, CRM Data Model, Workflow Automation Engine, Real-Time Event Bus, API Gateway (Governor Limits), Metadata-Driven Architecture | Multi-tenancy at scale, metadata-driven, tenant isolation, platform extensibility |
| **Walmart** | Inventory Management, Order Fulfillment (Store Pickup + Ship), Price Matching Engine, Cart/Checkout at Scale, Supply Chain Optimization, Real-Time Stock Updates | High-volume transactions, inventory consistency, omnichannel (online + 4700 stores) |

---

### Key Differences by Company Culture

| Company | What They Optimize For | Red Flag in Your Answer |
|---|---|---|
| **Google** | Scalability + elegance | Not discussing billion-user scale |
| **Amazon** | Availability + operational simplicity | Choosing consistency over availability |
| **Meta** | Move fast, real-time, social graph | Over-engineering for small scale |
| **Microsoft** | Enterprise reliability, backward compat | Ignoring multi-tenant concerns |
| **Apple** | Privacy, UX, device-first | Sending unencrypted user data |
| **Netflix** | Resilience, graceful degradation | Single point of failure in design |
| **Uber** | Real-time, geospatial, supply/demand | Ignoring location-based challenges |
| **Stripe** | Correctness, idempotency, API UX | Allowing double-charges or data loss |
| **Salesforce** | Multi-tenancy, platform thinking | Single-tenant architecture, no governor limits |
| **Walmart** | Inventory accuracy, omnichannel | Ignoring in-store + online integration |

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
