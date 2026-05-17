# Top 30 System Design Interview Questions & Approaches

Use this page as a rapid-review reference before system design interviews. Each question covers **requirements**, **high-level components**, **key decisions**, and (where helpful) a **mermaid architecture diagram**. Answers are concise on purpose -- they show you know the approach, not a full 45-minute deep dive.

---

??? question "Q1: Design a URL Shortener (like bit.ly)"

    **Answer:**

    A URL shortener maps a long URL to a compact alias and redirects users via a key-value lookup -- it is fundamentally a distributed hash table with an HTTP interface.

    **Why it exists:** Shorten ugly links for sharing, track click analytics, and enforce link expiration policies without touching the target site.

    **How it works internally:**

    - **Write path:** Client POSTs a long URL. The Shortening Service generates a 7-char key (Base62 encoding of a Snowflake ID -- collision-free by design). The key-to-URL mapping is persisted in a KV store (DynamoDB/Cassandra) with Redis as a read-through cache.
    - **Read path:** GET `/abc123` hits the API Gateway, looks up Redis (then DB on miss), and returns a 302 redirect. A Kafka event fires for async analytics.

    **When to use this pattern:** Any system needing stable, compact references to mutable resources -- feature flags, deep-link routing, QR codes.

    **Gotchas:**

    - **301 vs 302:** Use 302 (temporary) if you need analytics; 301 gets cached by browsers and you lose visibility.
    - **Hash collisions:** MD5 truncation causes collisions at scale -- prefer counter-based Base62.
    - **Hot keys:** A viral short link can melt a single cache shard; pre-warm popular keys across CDN PoPs.
    - **Custom aliases:** Need a uniqueness check + reservation system separate from auto-generated keys.

    **Diagram:**
    ```
    Write:  Client ──POST /shorten──▶ API Gateway ──▶ Shortening Service ──▶ Key-Value Store
    Read:   Client ──GET /abc123──▶ API Gateway ──▶ Redirect Service ──▶ Redis Cache ──miss──▶ Key-Value Store
                                                          └──▶ Analytics (Kafka)
    ```

---

??? question "Q2: Design a Twitter/X Feed (Timeline Generation)"

    **Answer:**

    A timeline system pre-computes personalized feeds using a hybrid fan-out model -- push for regular users, pull for celebrities -- to balance write amplification against read latency.

    **Why it exists:** Users expect a fresh, ranked feed in under 200ms. Naive pull-on-read (query all followed accounts at read time) collapses at 500M users.

    **How it works internally:**

    - **Write path:** A tweet is persisted to the Tweet DB. The Fan-out Service pushes the tweet ID into each follower's Timeline Cache (Redis sorted set, capped at ~800 entries). For celebrities (>10K followers), fan-out is skipped to avoid write storms.
    - **Read path:** The Timeline Service fetches the user's pre-built cache, then merges in recent tweets from any followed celebrities (pull model). A Ranking Service applies ML scoring before returning the final feed.
    - **Media:** Images/video go to object storage + CDN; only media references are stored in tweet records.

    **When to use:** Any "personalized aggregation" feed -- LinkedIn updates, Instagram stories, notification inboxes.

    **Gotchas:**

    - **Fan-out storms:** A celebrity with 50M followers posting frequently can overwhelm queue workers -- always cap and defer.
    - **Cache invalidation on unfollow:** Must remove old tweets from the timeline cache or accept stale entries draining naturally.
    - **Sharding mismatch:** Tweet storage is sharded by tweet ID; timeline cache by user ID. Cross-shard joins are expensive -- avoid them on the hot path.
    - **Ranking freshness:** Stale ML features (engagement counts) degrade ranking quality; use a real-time feature store.

    **Diagram:**
    ```
    Write:  User ──Post Tweet──▶ Tweet Service ──▶ Tweet DB
                                      └──▶ Fan-out Service ──push──▶ Timeline Cache (Redis)
    Read:   User ──Read Feed──▶ Timeline Service ──▶ Timeline Cache
                                      ├──pull for celebs──▶ Tweet DB
                                      └──▶ Ranking Service
    ```

---

??? question "Q3: Design a Chat System (WhatsApp / Messenger)"

    **Answer:**

    A chat system delivers messages in real-time over persistent WebSocket connections, with an offline queue and push notifications as the fallback -- it is an ordered, durable, fan-out messaging pipeline with end-to-end encryption.

    **Why it exists:** Users demand instant delivery with receipt confirmation (sent/delivered/read). HTTP request-response is too slow and wasteful for real-time bidirectional communication.

    **How it works internally:**

    - **Connection layer:** Clients maintain a WebSocket to a Gateway server. A session registry (Redis) maps user ID to their gateway instance.
    - **Message routing:** Chat Service receives a message, assigns a monotonic sequence ID per conversation (ensures ordering), writes to an append-only Message Store (Cassandra, partitioned by conversation ID), then routes to the recipient's gateway. If the recipient is offline, the message is queued and a push notification fires (APNs/FCM).
    - **Presence:** Clients send heartbeats every 30s; Presence Service (Redis TTL keys) marks users online/offline and broadcasts typing indicators.

    **When to use:** Any real-time bidirectional system -- live support, collaborative editing, multiplayer game chat.

    **Gotchas:**

    - **Message ordering:** Network reordering can deliver messages out of sequence. Server-assigned sequence IDs per conversation are the fix -- never trust client timestamps.
    - **Group fan-out:** Small groups (<256) can direct-send. Large groups need pub/sub to avoid O(N) writes per message on the gateway.
    - **WebSocket reconnection:** Mobile clients drop connections constantly. Must support session resumption and replay of missed messages from the last seen sequence ID.
    - **E2E encryption key exchange:** Losing device keys means losing message history -- need a secure backup/recovery mechanism.

    **Diagram:**
    ```
    Client A ◀──WebSocket──▶ WS Gateway ◀──▶ Chat Service ◀──▶ WS Gateway ◀──WebSocket──▶ Client B
                                                   ├──▶ Message Store
                                                   ├──▶ Push Notification
                                                   └──▶ Presence Service (Redis)
    ```

---

??? question "Q4: Design a Notification Service (Push, SMS, Email)"

    **Answer:**

    A notification service is a channel-agnostic delivery pipeline that accepts a "notify user X about event Y" request and routes it through the right channel (push, SMS, email) based on user preferences and delivery priority.

    **Why it exists:** Every backend service needs to reach users, but none should own the complexity of provider integrations, preference management, deduplication, or retry logic. Centralizing this prevents notification fatigue and duplicates.

    **How it works internally:**

    - **Ingestion:** Internal services call the Notification API with a payload and idempotency key. The API returns 202 Accepted immediately -- everything downstream is async.
    - **Routing:** The Preference Store determines which channels the user has enabled and whether quiet hours or frequency caps apply. Messages are enqueued into priority-based Kafka topics.
    - **Delivery:** Per-channel Worker Pools consume from queues, render templates via the Template Service, and dispatch through providers (APNs, FCM, Twilio, SendGrid). Failures trigger retry with exponential backoff.
    - **Fallback chain:** If push delivery fails (token expired), the system escalates to SMS, then email.

    **When to use:** Any platform with multiple notification triggers -- e-commerce order updates, social interactions, security alerts.

    **Gotchas:**

    - **Deduplication is critical:** Without idempotency keys, retries from upstream services cause duplicate notifications -- users notice and get annoyed fast.
    - **Token staleness:** Mobile push tokens expire silently. You need a feedback loop (APNs feedback service) to prune dead tokens.
    - **Frequency capping per user AND per channel:** A user getting 20 emails/day will unsubscribe. Cap globally and per-category.
    - **Observability:** Notifications cross many services -- trace each notification end-to-end with a correlation ID or debugging is impossible.

---

??? question "Q5: Design a Rate Limiter"

    **Answer:**

    A rate limiter is middleware that enforces request quotas per client using atomic counters in Redis -- it protects backends from abuse and ensures fair resource allocation across tenants.

    **Why it exists:** Without rate limiting, a single misbehaving client (or a bot) can starve legitimate users of resources. It is also a contractual enforcement mechanism for tiered API plans.

    **How it works internally:**

    - **Placement:** Sits in the API Gateway or as a sidecar. Every inbound request is checked against a rules engine that maps (endpoint, user tier, API key) to a quota.
    - **Counter store:** Redis holds per-key counters. A Lua script atomically increments the counter and checks against the limit -- if exceeded, the request is rejected with 429 and a `Retry-After` header.
    - **Algorithms:** Token bucket (refills at a steady rate, allows bursts up to bucket size) is the industry standard. Sliding window counter is a simpler alternative with good accuracy.

    **When to use:** Public APIs, login endpoints (brute force protection), webhook dispatchers, any multi-tenant system.

    **Gotchas:**

    - **Fixed window boundary burst:** A user can fire 100 requests at 11:59:59 and 100 more at 12:00:00 -- effectively 2x the limit. Sliding window counters fix this.
    - **Distributed race conditions:** Two API servers reading the same counter simultaneously can both allow a request. Redis Lua scripts (or `INCR` returning the new value) eliminate this.
    - **Redis failure mode:** Decide upfront -- fail open (allow all) risks abuse; fail closed (deny all) causes outages. Most production systems fail open with local fallback counters.
    - **Clock skew between nodes** can cause inconsistent enforcement -- always use Redis server time, not local clocks.

---

??? question "Q6: Design a Distributed Cache (Redis-like)"

    **Answer:**

    A distributed cache is an in-memory key-value cluster that uses consistent hashing to partition data across nodes, delivering sub-millisecond reads by eliminating disk I/O from the hot path.

    **Why it exists:** Databases are too slow for repeated hot-path reads. A cache layer absorbs 99% of read traffic, reducing DB load by orders of magnitude and cutting P99 latency from 20ms to <1ms.

    **How it works internally:**

    - **Partitioning:** A consistent hashing ring with virtual nodes maps each key to a primary node. Virtual nodes (150-200 per physical node) ensure even distribution.
    - **Replication:** Each partition has one primary and N replicas (async replication for speed, semi-sync for durability). On primary failure, a replica promotes.
    - **Client library:** Performs key hashing locally, routes directly to the correct node, maintains connection pools, and handles failover/retry.
    - **Eviction:** When memory fills, evict using LRU (default) or LFU (better for power-law access patterns). TTLs provide explicit expiry.

    **When to use:** Session stores, feed caches, leaderboard sorted sets, rate limiter counters -- anywhere read latency matters.

    **Gotchas:**

    - **Cache stampede:** When a hot key expires, hundreds of threads simultaneously hit the DB. Use a distributed lock (single-flight) to let one thread rebuild the cache.
    - **Consistency gap:** Cache-aside means the cache can serve stale data after a DB write. For critical paths, use write-through or explicit invalidation.
    - **Memory fragmentation:** Long-running Redis instances fragment memory. Monitor `mem_fragmentation_ratio` and restart periodically.
    - **Hot key problem:** A viral tweet cached on one node can saturate that node's NIC. Replicate hot keys across multiple nodes or use client-local caching.

    **Diagram:**
    ```
    Application ──▶ Client Library ──hash(key)──▶ Consistent Hash Ring
                                                       ├──▶ Node 1 (Primary) ──▶ Node 1 (Replica)
                                                       ├──▶ Node 2 (Primary) ──▶ Node 2 (Replica)
                                                       └──▶ Node 3 (Primary) ──▶ Node 3 (Replica)
    ```

---

??? question "Q7: Design Search Autocomplete / Typeahead"

    **Answer:**

    Autocomplete serves top-K prefix-matched suggestions from a pre-computed trie in under 100ms -- it is a read-optimized data structure with an offline pipeline that keeps suggestions fresh.

    **Why it exists:** Guiding users to popular queries reduces typos, accelerates search, and increases engagement. Every keystroke is a network round-trip, so latency must be sub-100ms.

    **How it works internally:**

    - **Serving layer:** An in-memory prefix trie stores the top 10-15 suggestions pre-computed at each node. A lookup is O(prefix length) -- no tree traversal needed beyond the prefix.
    - **Data pipeline:** Query logs stream through Kafka to a Data Collection Service that aggregates frequency counts (sampled 1-in-10 to reduce volume). An offline Index Builder rebuilds the trie every 15 minutes from aggregated data and swaps it atomically.
    - **Ranking:** Blends raw popularity, recency decay, and per-user personalization (recent searches from browser cache).

    **When to use:** Search bars, address fields, IDE code completion, command palettes -- anywhere prefix prediction saves user effort.

    **Gotchas:**

    - **Sharding by prefix range** (a-m, n-z) sounds clean but creates hot shards -- "s" and "c" prefixes dominate English. Use load-aware splitting instead.
    - **Trending queries:** The 15-minute rebuild lag means you miss breaking news. Add a real-time "trending" overlay with a separate fast path.
    - **Offensive suggestions:** Pre-compute a blocklist filter on the output. Never serve raw user queries without sanitization.
    - **Browser-side caching:** Cache recent server responses by prefix in localStorage to eliminate redundant calls on the same session.

---

??? question "Q8: Design a Web Crawler"

    **Answer:**

    A web crawler is a distributed fetching pipeline that discovers, downloads, and indexes billions of web pages using a prioritized URL frontier, politeness controls, and content deduplication.

    **Why it exists:** Search engines need fresh copies of the web. You cannot query what you have not crawled. The crawler must balance coverage, freshness, and politeness while operating at enormous scale.

    **How it works internally:**

    - **URL Frontier:** A multi-queue priority system. Front queues prioritize by PageRank/freshness. Back queues enforce per-host politeness (one active request per domain, respecting `Crawl-Delay`).
    - **Fetcher workers:** Distributed HTTP clients pull URLs from the frontier. Consistent hashing assigns domains to specific workers so one site is never hit by multiple workers simultaneously.
    - **Processing pipeline:** Content Parser extracts links (discovered URLs re-enter the frontier) and stores page content. A Bloom filter deduplicates URLs; SimHash detects near-duplicate content.
    - **DNS cache:** A local DNS resolver cache avoids millions of redundant lookups.

    **When to use:** Search engines, price comparison scrapers, archival systems, SEO audit tools.

    **Gotchas:**

    - **Spider traps:** Infinite URL spaces (calendars, session IDs in URLs) will exhaust your frontier. Set max depth and use URL normalization aggressively.
    - **JavaScript-rendered pages:** Many modern sites need headless browser rendering (Puppeteer). This is 10-50x slower -- only use it for high-value domains.
    - **robots.txt compliance:** Not optional. Violating it gets your IP blocked and your company sued.
    - **Checkpoint the frontier:** If you lose the frontier state, you restart from scratch. Periodic disk snapshots are non-negotiable for multi-day crawls.

---

??? question "Q9: Design News Feed Ranking"

    **Answer:**

    News feed ranking is a two-pass ML scoring pipeline -- a lightweight retrieval stage narrows millions of candidates to hundreds, then a heavy neural ranker scores them per-user in real time.

    **Why it exists:** Chronological feeds bury important content under noise. Ranking maximizes user engagement by surfacing the most relevant posts, which directly drives platform retention and ad revenue.

    **How it works internally:**

    - **Candidate generation:** Pull ~2000 recent posts from followed accounts (pre-materialized in a fan-out cache) plus injected posts (ads, recommended content).
    - **Feature extraction:** For each candidate, compute features -- post age, engagement velocity, author affinity score, content type, and user interaction history. Real-time features (likes in the last 5 min) come from a feature store (Redis/Feast).
    - **Scoring:** A two-pass approach -- first pass uses a lightweight model (logistic regression) to cut to top 500, second pass uses a deep neural network for precise scoring.
    - **Re-ranking:** Apply diversity rules (no 3 posts from same author in a row), policy filters (NSFW, misinformation), and business rules (ad spacing).

    **When to use:** Any personalized content surface -- social feeds, email inbox priority, news aggregators, recommendation carousels.

    **Gotchas:**

    - **Filter bubble:** Pure engagement optimization creates echo chambers. Add explicit diversity and serendipity objectives to the loss function.
    - **Feature freshness:** Stale engagement counts (cached 5 min ago) cause the model to under-rank newly viral posts. Balance cache TTL against serving cost.
    - **Position bias:** Users click top-ranked items regardless of quality. Use position-debiased training or inverse propensity weighting.
    - **A/B testing at scale:** Feed ranking changes require interleaving experiments (not just split tests) to detect subtle quality shifts.

---

??? question "Q10: Design a Video Streaming Service (YouTube / Netflix)"

    **Answer:**

    A video streaming platform is a write-heavy transcoding pipeline feeding a read-heavy CDN -- raw uploads become multi-resolution HLS/DASH segments served adaptively based on the viewer's bandwidth.

    **Why it exists:** Raw video files are massive and codec-specific. Streaming demands adaptive bitrate delivery, edge caching for global latency, and efficient storage tiering to manage petabytes economically.

    **How it works internally:**

    - **Upload path:** Creator uploads raw video to the Upload Service, which writes to object storage (S3). A Transcoding Pipeline (DAG-based: split into chunks, encode each in parallel across resolutions/codecs, merge) produces HLS segments at 240p through 4K.
    - **Storage:** Transcoded segments stored in S3 with hot/warm/cold tiering. Rarely-viewed encodes (e.g., 4K for a 10-view video) are deleted after 90 days.
    - **Streaming path:** The client fetches a manifest file listing available qualities. The ABR algorithm on the client switches segment quality dynamically based on measured throughput. CDN edge servers cache popular segments.

    **When to use:** Any media-heavy platform -- live streaming, e-learning, podcast hosting, surveillance playback.

    **Gotchas:**

    - **Transcoding cost:** Encoding all resolutions for every upload is wasteful. Use "just-in-time" transcoding for low-view content -- only produce 720p initially, add 4K if viewership grows.
    - **CDN cache efficiency:** Long-tail content has low cache hit rates. An origin shield layer prevents thundering herd on cache misses.
    - **Live streaming:** Cannot pre-transcode. Need ultra-low-latency encoding pipelines (sub-5s glass-to-glass) with chunked transfer encoding.
    - **DRM integration:** Content protection (Widevine, FairPlay) adds complexity to the manifest and key delivery, and different browsers need different DRM schemes.

    **Diagram:**
    ```
    Upload: Creator ──▶ Upload Service ──▶ Object Storage (S3) ──▶ Transcoding Pipeline ──HLS segments──▶ S3
    Watch:  Viewer ──Stream──▶ CDN Edge Servers ◀── S3
            Viewer ──Search──▶ Metadata Service
    ```

---

??? question "Q11: Design a File Storage System (Google Drive / Dropbox)"

    **Answer:**

    A cloud file storage system splits files into content-addressed blocks, syncs only changed blocks across devices (delta sync), and uses a metadata service to track the file tree, versions, and permissions.

    **Why it exists:** Users need seamless multi-device access to files with automatic sync, versioning, and sharing. Uploading entire files on every change is bandwidth-prohibitive -- block-level delta sync reduces transfer by 90%+.

    **How it works internally:**

    - **Upload:** Files are chunked into 4MB blocks, each hashed (SHA-256). Only blocks with new hashes are uploaded -- this enables both delta sync and cross-user deduplication. Blocks are stored in object storage; the Metadata Service (relational DB) tracks the file tree, block references, versions, and ACLs.
    - **Sync:** When a file changes on one device, the Sync Service pushes a change notification (long-poll or WebSocket) to other connected clients. Clients fetch only the new/changed block hashes and download the diff.
    - **Conflict resolution:** Last-writer-wins for non-overlapping edits. For simultaneous edits to the same file, the system creates a "conflict copy" and notifies the user.

    **When to use:** Any collaborative document platform, backup services, asset management systems, enterprise content management.

    **Gotchas:**

    - **Small file overhead:** A 1KB file still requires metadata writes, block storage overhead, and sync notifications. Batch small files or store inline in metadata.
    - **Resumable uploads are mandatory:** Mobile networks drop connections. Without chunked resumable uploads (like tus protocol), large file uploads will never complete reliably.
    - **Permission propagation delay:** Revoking access must immediately invalidate all cached copies on shared devices -- eventual consistency is not acceptable for security-sensitive shares.
    - **Storage cost explosion:** Versioning without limits means a frequently-edited 1GB file consumes 100GB over time. Implement version limits or tiered retention.

---

??? question "Q12: Design a Ride Sharing System (Uber)"

    **Answer:**

    A ride-sharing system is a real-time geospatial matching engine -- it ingests driver GPS pings every 4 seconds into a spatial index and matches riders to the nearest available drivers within milliseconds.

    **Why it exists:** The core value is reducing the time-to-pickup. This requires a constantly-updated spatial index, efficient proximity queries, and a trip state machine that coordinates two independent mobile actors (rider + driver).

    **How it works internally:**

    - **Location ingestion:** Drivers emit GPS pings every 3-4s. The Location Service upserts their position into a geospatial index (Geohash in Redis or a QuadTree for density-adaptive cells).
    - **Matching:** When a rider requests, the Matching Service queries drivers within an expanding radius (start 1km, expand to 5km). It scores candidates by ETA (not straight-line distance) using real-time routing, then dispatches to the best match.
    - **Trip lifecycle:** A Trip Service state machine (request -> matched -> en-route -> arrived -> in-trip -> completed) with idempotent transitions ensures exactly-once processing even under network retries.
    - **Pricing:** A Pricing Service computes surge multipliers per hex-cell based on realtime supply/demand ratios.

    **When to use:** Any two-sided marketplace with real-time spatial matching -- delivery logistics, ambulance dispatch, field service routing.

    **Gotchas:**

    - **Geohash boundary problem:** A driver 50m away might be in an adjacent geohash cell. Always query neighboring cells (8 surrounding cells) for proximity searches.
    - **GPS drift in urban canyons:** Tall buildings cause 50-100m GPS errors. Use map-matching (snap to nearest road) to correct raw coordinates.
    - **Race condition on dispatch:** Two riders requesting simultaneously might both get matched to the same driver. Use optimistic locking on driver availability with a short hold.
    - **ETA accuracy:** Routing graphs with stale traffic data produce wrong ETAs. Feed live probe data (from other drivers on the road) back into the graph weights.

    **Diagram:**
    ```
    Rider ──Request Ride──▶ API Gateway ──▶ Matching Service ──▶ Geospatial Index ◀── Location Service ◀──GPS ping── Driver
                                                  └──▶ Trip Service ──▶ Pricing Service
                                                                   └──▶ Payment Service
    ```

---

??? question "Q13: Design a Food Delivery System (DoorDash)"

    **Answer:**

    A food delivery system is a three-sided marketplace (customer, restaurant, driver) orchestrated by a dispatch optimizer that batches nearby orders, predicts prep times, and minimizes total delivery time across all active orders.

    **Why it exists:** The key challenge is coordination across three independent actors with competing timelines -- the driver must arrive at the restaurant exactly when food is ready, not 10 minutes early (wasted time) or 10 minutes late (cold food).

    **How it works internally:**

    - **Order placement:** Customer places an order through the Order Service. The restaurant confirms via KDS integration. An ETA Service predicts prep time (ML model trained on historical restaurant speed, order complexity, current queue depth) + travel time.
    - **Dispatch optimization:** The Dispatch Service runs a batching algorithm -- group nearby orders heading in similar directions to the same driver. This is a variant of the vehicle routing problem, solved with heuristics at scale.
    - **Real-time tracking:** Drivers emit GPS pings; a Tracking Service pushes location updates to customers via WebSocket. The ETA is continuously refined using live position.

    **When to use:** Any logistics platform with pickup-and-delivery coordination -- grocery delivery, pharmacy, laundry services.

    **Gotchas:**

    - **Prep time prediction is everything:** If you dispatch a driver before the food is ready, the driver waits (earns nothing, gets frustrated). If too late, food sits and quality drops. Invest heavily in per-restaurant ML models.
    - **Order batching trade-offs:** Batching improves driver utilization but increases delivery time for the second customer. Cap batch size and add fairness constraints.
    - **Idempotent order placement:** Mobile networks retry POSTs. Without idempotency keys, customers get charged twice -- this is a top customer support issue.
    - **Restaurant capacity limits:** A viral promotion can flood a restaurant with 200 simultaneous orders. Implement real-time order throttling per restaurant.

---

??? question "Q14: Design E-commerce Order Processing (Amazon)"

    **Answer:**

    An e-commerce order system uses the saga pattern to coordinate distributed transactions across inventory reservation, payment capture, and fulfillment -- ensuring no overselling while handling millions of concurrent checkouts.

    **Why it exists:** A single checkout touches 5+ services (cart, inventory, payment, fraud, fulfillment). Traditional ACID transactions cannot span these boundaries. Sagas provide eventual consistency with compensating actions on failure.

    **How it works internally:**

    - **Browse path (read-heavy):** Product Catalog Service serves from cache (CDN + Redis). Search uses a denormalized read model (CQRS) optimized for filtering and faceting.
    - **Checkout path (write-heavy):** The Order Service orchestrates a saga: (1) reserve inventory (pessimistic lock on stock row), (2) charge payment, (3) confirm order. If payment fails, a compensating action releases the inventory reservation.
    - **Fulfillment:** Once confirmed, the order routes to the nearest fulfillment center with available stock. Events are published to Kafka for downstream systems (shipping, notifications, analytics).
    - **Event sourcing:** Every state transition is an immutable event -- enables full audit trails and easy rebuilding of order state.

    **When to use:** Any multi-step transaction spanning services -- insurance claims processing, travel booking, subscription management.

    **Gotchas:**

    - **Inventory hot spots:** Flash sales on a single item cause lock contention on one DB row. Pre-shard inventory counters (e.g., 10 counter rows per popular SKU) and aggregate.
    - **Saga compensation timing:** If payment succeeds but fulfillment cannot ship, you need an automated refund path. Partial failures in sagas require well-designed compensating transactions.
    - **Cart abandonment:** Reserved inventory held too long (15 min timeout) during peak means real buyers see "out of stock." Tune reservation TTL aggressively.
    - **Price consistency:** Price shown at browse time may differ from checkout time due to cache staleness. Always re-validate price at order creation.

    **Diagram:**
    ```
    User ──Browse──▶ Product Catalog
    User ──Add to Cart──▶ Cart Service ──Checkout──▶ Order Service ──Reserve──▶ Inventory Service
                                                          ├──Charge──▶ Payment Service
                                                          ├──Ship──▶ Fulfillment Service
                                                          └──Events──▶ Kafka (Event Bus)
    ```

---

??? question "Q15: Design a Payment System (Stripe-like)"

    **Answer:**

    A payment system guarantees exactly-once money movement through idempotency keys, a double-entry ledger, and a two-phase flow (authorize then capture) -- the entire architecture is built around the principle that losing money or charging twice is unacceptable.

    **Why it exists:** Money movement is the hardest distributed systems problem because failures are not retryable without consequence. Every timeout, crash, or network partition can result in either lost revenue or double-charging a customer.

    **How it works internally:**

    - **Ingestion:** Merchant calls Payment API with a payment intent + idempotency key. The Tokenization Service replaces raw card numbers with tokens (reduces PCI scope from the entire system to one isolated service).
    - **Processing:** The Risk Engine scores the transaction for fraud. If approved, the Payment Processing Service authorizes with the card network (Visa/MC), returning an auth code. Capture happens separately (on fulfillment) or immediately.
    - **Recording:** The Ledger Service records every movement as a double-entry (debit merchant acquiring account, credit card network). This ledger is the source of truth -- it must always balance.
    - **Notifications:** State changes publish events; webhooks notify merchants asynchronously.

    **When to use:** Any system handling money -- marketplaces, subscription billing, payroll, lending platforms.

    **Gotchas:**

    - **Timeout ambiguity:** If the auth call to Visa times out, you do not know if the charge succeeded. You MUST query status before retrying, or you double-charge.
    - **Idempotency key scope:** The key must cover the entire request (amount + currency + recipient). A different amount with the same key should be rejected, not processed.
    - **Currency precision:** Never use floating point for money. Use integer cents (or smallest currency unit). JPY has no decimal places; BHD has 3.
    - **Reconciliation drift:** Your ledger and the bank's ledger will diverge. Build a daily reconciliation job that detects and alerts on mismatches.

---

??? question "Q16: Design a Hotel Booking System (Booking.com)"

    **Answer:**

    A hotel booking system separates the eventually-consistent search path (fast, cached, tolerates staleness) from the strongly-consistent booking path (pessimistic locking on inventory to prevent double-booking).

    **Why it exists:** Hotel inventory is inherently limited and time-bound (room X on date Y can only be sold once). The system must handle high search traffic (millions of queries) while guaranteeing that the booking path never oversells beyond configured overbooking limits.

    **How it works internally:**

    - **Search path:** An Elasticsearch index stores hotel metadata, amenities, photos, and pre-aggregated availability. Results are cached aggressively (TTL 30-60s) -- slight staleness is acceptable since booking will revalidate.
    - **Booking path:** When a user confirms, the Booking Service calls the Inventory Service, which uses pessimistic row-level locking (or optimistic versioning with retry) on the availability calendar for those specific dates. If available, it decrements and creates the reservation atomically.
    - **Pricing:** A dynamic Pricing Service computes rates based on season, demand/supply ratio, competitor prices, and hotel-configured rules. Prices in search results may differ from final booking price (always revalidate).

    **When to use:** Any time-slotted inventory system -- co-working spaces, car rentals, appointment scheduling, event venues.

    **Gotchas:**

    - **Intentional overbooking:** Hotels routinely overbook by 5-15% (expecting cancellations). Your inventory model must support overbooking thresholds, not just hard limits.
    - **Search/booking consistency gap:** A user sees "available" in search but gets "sold out" at booking. Minimize this with shorter cache TTLs for low-inventory rooms and real-time availability badges.
    - **Date range locking complexity:** Booking a 5-night stay requires atomically locking inventory across 5 date rows. Use a single transaction or a composite lock.
    - **Cancellation cascade:** Free cancellation policies mean a percentage of bookings will cancel. The system must release inventory and trigger refunds without manual intervention.

---

??? question "Q17: Design a Ticket Booking System (BookMyShow) -- Concurrency Handling"

    **Answer:**

    A ticket booking system uses distributed locks with TTL (Redis `SET NX EX`) to hold seats temporarily during checkout, combined with a virtual waiting room to absorb flash-sale stampedes -- the core challenge is preventing double-booking under extreme concurrency.

    **Why it exists:** When 100K users simultaneously try to book the same 500 seats, naive concurrent access causes overselling. The system must serialize access to each seat while keeping the experience fast and fair.

    **How it works internally:**

    - **Virtual queue:** During high-demand events, users enter a FIFO waiting room (processed in batches of N). This converts unbounded concurrency into controlled throughput.
    - **Seat selection:** The Seat Map Service shows real-time availability. When a user selects seats, the Reservation Service acquires a distributed lock per seat (Redis `SET NX EX 300` -- 5-min TTL). If the lock is already held, the seat appears unavailable.
    - **Checkout:** The user must complete payment within the hold window. On success, the Reservation Service converts the hold to a confirmed booking in the database (optimistic locking with version column). On timeout/failure, the Redis lock auto-expires and seats return to available.

    **When to use:** Any limited-inventory selection system with time-bounded holds -- concert/sports tickets, flash sales, exam slot registration, limited-edition drops.

    **Gotchas:**

    - **Hold expiry race:** If payment completes at second 299 of a 300s hold, the lock might expire before the confirmation write lands. Extend the lock during payment processing.
    - **Seat map staleness:** The visual seat map can show stale state if not pushed via WebSocket. A user selects a seat that was just locked by someone else -- handle gracefully with immediate retry.
    - **Bot prevention:** Flash sales attract bots. CAPTCHA at queue entry, device fingerprinting, and rate limiting are essential -- pure technical solutions are insufficient without anti-bot measures.
    - **Partial booking failure:** User selects 4 seats, payment succeeds for all, but one seat lock expired. Must handle atomically -- all-or-nothing booking with compensating refund if needed.

    **Diagram:**
    ```
    User ──Select Seats──▶ Seat Map Service ──Hold seats──▶ Redis Lock (TTL)
    User ──Pay──▶ Payment Service ──Confirm──▶ Reservation Service ──Release lock──▶ Redis
                                                      ├──▶ Booking DB
                                                      └──▶ Notification Service
    ```

---

??? question "Q18: Design a Social Network Graph"

    **Answer:**

    A social network graph stores billions of relationship edges in a sharded adjacency list and precomputes friend-of-friend connections offline -- real-time multi-hop graph traversals do not scale at billion-edge graphs.

    **Why it exists:** Social features (mutual friends, "people you may know," connection degree) all require graph queries. At Facebook scale (400B+ edges), no single graph database handles this; you need a custom sharded adjacency store with precomputation.

    **How it works internally:**

    - **Storage:** Each user has an adjacency list stored in a sharded KV store (user_id -> list of connected user_ids + edge type). Bidirectional edges for friendships (write to both adjacency lists atomically); unidirectional for follows.
    - **Read path:** Direct friend lookups are O(1) from cache (Redis). Mutual friends = set intersection of two friend lists -- fast for users with <5K friends, precomputed for celebrities.
    - **Recommendation pipeline:** Offline MapReduce jobs compute 2nd-degree connections (friends of friends minus existing friends), ranked by mutual friend count and shared attributes. Results are materialized into a recommendation cache.

    **When to use:** Social networks, professional networks (LinkedIn), trust/reputation systems, knowledge graphs, fraud detection rings.

    **Gotchas:**

    - **Graph partitioning is NP-hard:** Social graphs have high connectivity. Random partitioning causes most traversals to cross shards. Use community detection (Louvain algorithm) to co-locate dense clusters.
    - **Celebrity nodes (supernodes):** A user with 50M followers has a 50M-entry adjacency list. Shard their follower list separately and never materialize it fully in memory.
    - **Edge consistency:** Adding a friendship requires writing to both users' adjacency lists. If one write fails, you have a dangling unidirectional edge. Use async reconciliation.
    - **Real-time traversal depth:** Never allow unbounded traversals in the online path. Cap at 2 hops; deeper analysis goes offline.

---

??? question "Q19: Design a Distributed Message Queue (Kafka-like)"

    **Answer:**

    A distributed message queue is an append-only commit log partitioned across brokers -- it achieves millions of messages/sec by leveraging sequential disk I/O, OS page cache, and partition-level parallelism with consumer groups.

    **Why it exists:** Microservices need decoupled, durable, ordered communication. Unlike traditional queues (RabbitMQ) that delete messages on consumption, a commit log retains messages for replay -- enabling event sourcing, stream processing, and consumer independence.

    **How it works internally:**

    - **Write path:** Producers send messages to a topic partition (determined by key hash or round-robin). The partition leader appends to its log segment on disk (sequential write -- as fast as network). Replicas in the ISR (in-sync replica set) pull and acknowledge.
    - **Read path:** Each consumer group assigns partitions to consumers (one partition per consumer max). Consumers track their own offset -- they can rewind, replay, or skip independently.
    - **Durability:** `acks=all` means the producer waits for all ISR replicas to confirm. The controller (ZooKeeper or KRaft) handles leader election on broker failure.
    - **Retention:** Messages persist for configured duration (default 7 days) or size. Compacted topics retain only the latest value per key (useful for changelogs).

    **When to use:** Event-driven architectures, stream processing (Flink/Spark), CDC pipelines, audit logs, inter-service communication at scale.

    **Gotchas:**

    - **Partition count is (nearly) immutable:** Adding partitions after the fact breaks key-based ordering guarantees. Over-provision initially (2-3x expected parallelism).
    - **Consumer lag death spiral:** If consumers fall behind and retention expires, messages are lost. Monitor consumer lag as a critical metric and autoscale consumers.
    - **Ordering guarantee scope:** Ordering is per-partition only. If you need global order, use a single partition (sacrificing parallelism) or implement sequence-number-based ordering in the consumer.
    - **Rebalancing storms:** Adding/removing consumers triggers partition rebalancing, causing brief processing pauses. Use cooperative rebalancing (incremental) to minimize impact.

    **Diagram:**
    ```
    Producer 1 ──write──▶ Broker 1 (Partition 0 Leader) ──replicate──▶ Broker 3 (P0 Replica)
    Producer 2 ──write──▶ Broker 2 (Partition 1 Leader) ──replicate──▶ Broker 1 (P1 Replica)
    Broker 1 ──consume──▶ Consumer Group A - Consumer 1
    Broker 2 ──consume──▶ Consumer Group A - Consumer 2
    ```

---

??? question "Q20: Design a Key-Value Store (DynamoDB-like)"

    **Answer:**

    A distributed KV store partitions data across nodes using consistent hashing, stores it in LSM trees for write optimization, and uses quorum-based replication with tunable consistency (W + R > N = strong, W=1/R=1 = fast eventual).

    **Why it exists:** Relational databases hit a scaling ceiling. A KV store trades flexible queries for predictable single-digit-ms latency at any scale by constraining access patterns to partition key + optional sort key lookups.

    **How it works internally:**

    - **Routing:** A Request Coordinator hashes the partition key to determine which node group owns the data. Consistent hashing with virtual nodes ensures balanced distribution and minimal data movement on scale events.
    - **Storage engine:** Each node uses an LSM tree -- writes go to an in-memory memtable (fast), which periodically flushes to immutable SSTables on disk. Background compaction merges SSTables to reclaim space and maintain read performance.
    - **Replication:** Data replicates to N nodes (typically 3). Quorum settings control consistency: W=2, R=2 guarantees strong consistency; W=1, R=1 provides low-latency eventual consistency.
    - **Anti-entropy:** Merkle trees detect replica divergence; gossip protocol detects node failures within seconds.

    **When to use:** Session stores, user profiles, IoT telemetry, shopping carts -- any workload with known access patterns and predictable key structure.

    **Gotchas:**

    - **Hot partition (the #1 killer):** A bad partition key (e.g., date, or a celebrity user ID) concentrates all traffic on one node. Design composite keys that distribute evenly.
    - **LSM write amplification:** Compaction rewrites data multiple times. Under sustained write-heavy load, compaction can fall behind and read latency spikes (more SSTables to scan).
    - **Conflict resolution in eventual mode:** Two concurrent writes to the same key on different replicas = conflict. Vector clocks preserve both versions (application resolves); last-writer-wins is simpler but lossy.
    - **Scan operations are expensive:** Full table scans on a distributed KV store touch every partition. Design your access patterns to avoid them entirely.

---

??? question "Q21: Design a Search Engine (Elasticsearch-like)"

    **Answer:**

    A search engine builds inverted indexes (term -> document IDs) sharded across nodes, uses BM25 for relevance scoring, and achieves near-real-time indexing through a segment-based architecture where new documents become searchable within 1 second of ingestion.

    **Why it exists:** Relational databases cannot do full-text search efficiently. An inverted index provides O(1) term lookups with pre-computed relevance scores, enabling sub-100ms search across billions of documents.

    **How it works internally:**

    - **Indexing:** Documents are analyzed (tokenized, lowercased, stemmed) and added to an inverted index -- each term maps to a posting list of (doc_id, term_frequency, positions). New documents land in an in-memory buffer, then flush to an immutable segment on disk (refresh interval, default 1s).
    - **Search (scatter-gather):** A Query Coordinator sends the query to all relevant shards in parallel. Each shard scores local documents using BM25 (term frequency * inverse document frequency, length-normalized), returns top-K results. The coordinator merges and re-ranks globally.
    - **Scaling:** Each index has N primary shards (set at creation, immutable) with R replica shards for HA and read throughput.

    **When to use:** Product search, log analytics, document retrieval, autocomplete backends, any full-text or structured filtering workload.

    **Gotchas:**

    - **Shard count is permanent:** You cannot change the number of primary shards after creation without reindexing. Over-shard initially or use index aliases with rollover.
    - **Deep pagination kills performance:** Requesting page 1000 (offset 10000) requires each shard to return 10000 results to the coordinator. Use `search_after` cursor pagination instead.
    - **Segment merging I/O storms:** Too many small segments degrade read performance. Forced merges during off-peak hours or background merge throttling is essential.
    - **Mapping explosion:** Dynamic mapping with high-cardinality fields (user-generated JSON keys) creates millions of fields in the index, bloating memory and slowing queries. Always define explicit mappings.

---

??? question "Q22: Design a Metrics / Monitoring System (Prometheus-like)"

    **Answer:**

    A monitoring system scrapes time-series metrics from services, stores them in a purpose-built TSDB with Gorilla compression, and evaluates alert rules periodically -- it is the nervous system that makes distributed systems operable.

    **Why it exists:** You cannot fix what you cannot see. Without metrics, debugging production issues is guesswork. The system must handle millions of data points per second, support ad-hoc queries over weeks of data, and fire alerts within seconds of threshold breaches.

    **How it works internally:**

    - **Collection:** Pull-based (Prometheus model) -- a collector scrapes HTTP `/metrics` endpoints at configured intervals. Push-based for ephemeral jobs (batch jobs that die before being scraped).
    - **Storage (TSDB):** Time-series are chunked into 2-hour blocks. Within each chunk, timestamps use delta-of-delta encoding and values use XOR/Gorilla compression -- achieving 1.37 bytes per data point (vs 16 bytes raw). Older blocks downsample to 5m/1h resolution.
    - **Query engine:** PromQL-like language supports rate(), histogram_quantile(), aggregations across label dimensions. Queries scatter across time blocks and merge.
    - **Alerting:** Alert Manager evaluates rules every 15-60s, deduplicates firing alerts, groups related alerts, and routes to PagerDuty/Slack based on severity.

    **When to use:** Every production system needs this. Also: IoT sensor monitoring, business KPI dashboards, SLA tracking.

    **Gotchas:**

    - **Label cardinality explosion:** Adding `user_id` as a label creates millions of unique time series. TSDB performance degrades linearly with series count. Keep labels low-cardinality (service, method, status_code).
    - **Pull model and short-lived processes:** A 30-second batch job may start and die between scrape intervals. Use a push gateway or event-based export for these.
    - **Alert fatigue:** Too many alerts = all alerts ignored. Implement tiered severity, auto-resolving alerts, and alert grouping to keep signal-to-noise ratio high.
    - **Retention cost:** Raw 10-second metrics for 1000 services for 1 year is terabytes. Downsample aggressively after 15 days -- nobody queries second-resolution data from 6 months ago.

    **Diagram:**
    ```
    Service 1 ──scrape──▶ Metric Collector ──▶ Time-Series DB ──▶ Query Engine ──▶ Grafana Dashboard
    Service 2 ──scrape──┘                            └──▶ Alert Manager ──▶ PagerDuty / Slack
    ```

---

??? question "Q23: Design an Online Code Editor / Judge"

    **Answer:**

    An online judge executes untrusted user code in sandboxed containers with strict resource limits (CPU, memory, time), compares output against expected results, and scales horizontally to handle contest-time submission bursts.

    **Why it exists:** Running arbitrary user code is inherently dangerous (fork bombs, infinite loops, file system access). The system must provide strong isolation guarantees while maintaining fast turnaround (<5s per submission) even during contests with 10K concurrent users.

    **How it works internally:**

    - **Submission path:** User submits code via the Web IDE. The Submission Service assigns an ID and enqueues to an Execution Queue (SQS/RabbitMQ) -- this decouples submission rate from execution capacity.
    - **Execution:** Judge Workers pull from the queue, spin up a sandboxed container (gVisor or Docker with seccomp + no network + cgroup limits), compile the code, run it against each test case with strict limits (2s CPU, 256MB RAM), and capture stdout/stderr.
    - **Judging:** The Result Service compares actual output against expected output (exact match or custom checker for floating-point problems). Verdicts: AC, WA, TLE, MLE, RE, CE.

    **When to use:** Competitive programming platforms, coding interviews, educational auto-graders, CI/CD test runners.

    **Gotchas:**

    - **Container cold start:** Spinning up a fresh container per submission adds 1-2s latency. Pre-warm a pool of containers per language to eliminate this.
    - **Fork bomb / resource exhaustion:** Without cgroup PID limits, a fork bomb can crash the host. Set `pids.max=64` in the cgroup and kill the entire process tree on timeout.
    - **Filesystem attacks:** User code can attempt to read `/etc/passwd` or fill disk. Use read-only root filesystem + tiny writable tmpfs with size limits.
    - **Non-deterministic output:** Multithreaded programs may produce different output across runs. Either disallow threads or run multiple times and accept any valid output ordering.

---

??? question "Q24: Design a Location-Based Service (Nearby Friends)"

    **Answer:**

    A nearby-friends service ingests GPS updates into a geospatial index and pushes proximity notifications via pub/sub -- the key insight is to only compute proximity for mutually-opted-in, currently-active friend pairs, not all-pairs.

    **Why it exists:** Users want ambient awareness of nearby friends without actively checking. The system must balance real-time freshness against mobile battery drain and backend compute cost.

    **How it works internally:**

    - **Ingestion:** Mobile clients send GPS updates every 30s (or on significant movement >100m). The Location Ingestion Service writes to a geospatial index (Redis GEOADD or a custom geohash-based index).
    - **Proximity computation:** Rather than brute-force all-pairs, the system subscribes each active user to a pub/sub channel for each of their opted-in friends. When friend A's location updates, the system checks if any subscriber is within radius -- if yes, push a notification via WebSocket.
    - **Privacy layer:** The Privacy Service enforces per-friend sharing permissions, time-limited shares (auto-expire after 1 hour), and ghost mode. All proximity checks pass through this layer.

    **When to use:** Social apps (Snap Map, Find My Friends), safety/check-in apps, location-based games, delivery driver visibility for customers.

    **Gotchas:**

    - **Battery drain is the #1 user complaint:** GPS polling every 30s kills battery. Use significant-change location APIs (iOS/Android), geofencing, and reduce frequency when stationary.
    - **Geohash boundary problem:** Two friends 50m apart can be in adjacent geohash cells. Always query the 8 neighboring cells, not just the current one.
    - **Privacy misconfiguration exposure:** A bug that leaks location to non-authorized friends is a critical privacy incident. Defense in depth -- check permissions at ingestion, at query time, AND at the delivery layer.
    - **Stale locations:** If a user closes the app, their last known location persists. Show a "last seen X minutes ago" indicator and expire locations after an inactivity threshold.

---

??? question "Q25: Design a Content Delivery Network (CDN)"

    **Answer:**

    A CDN is a globally distributed cache that serves static content from edge servers close to users, using GeoDNS for routing and an origin shield to protect backend servers from thundering herd -- it trades storage cost for latency reduction.

    **Why it exists:** Physics is the bottleneck. A user in Tokyo requesting content from a US-East origin adds 150ms of network RTT. Edge caching eliminates this for cacheable content, which is 80%+ of web traffic (images, JS, CSS, video).

    **How it works internally:**

    - **Routing:** User's DNS query hits GeoDNS, which resolves to the IP of the nearest PoP (Point of Presence) based on the resolver's location.
    - **Cache hit (fast path):** Edge server has the content cached. Serve directly with TLS terminated at edge. Response time: 5-20ms.
    - **Cache miss:** Edge requests from the Origin Shield (an intermediate cache layer shared across multiple PoPs). If the shield also misses, it fetches from the origin server. This two-tier hierarchy prevents thundering herd on the origin.
    - **Invalidation:** The Purge API propagates invalidation to all edge PoPs. `stale-while-revalidate` serves stale content while fetching fresh copies in background.

    **When to use:** Any content-heavy platform -- media streaming, e-commerce product images, SPA assets, API responses for read-heavy endpoints.

    **Gotchas:**

    - **Cache key pollution:** Query parameter variations (`?v=1`, `?utm_source=x`) create duplicate cache entries for the same content. Normalize and strip irrelevant params from cache keys.
    - **Purge propagation delay:** Global purge takes 5-30 seconds to reach all PoPs. During this window, users may receive stale content. Use versioned URLs (`/style.abc123.css`) for instant invalidation.
    - **Long-tail cache inefficiency:** Only the top ~20% of content gets good cache hit rates. Long-tail items are fetched from origin on every request -- an origin shield is critical to consolidate these misses.
    - **TLS certificate management:** TLS termination at 200+ PoPs means distributing and rotating certificates globally. Automate with ACME/Let's Encrypt or managed certificates.

    **Diagram:**
    ```
    User ──DNS query──▶ GeoDNS ──nearest PoP──▶ Edge Server ──cache hit──▶ User
                                                      └──cache miss──▶ Origin Shield ──miss──▶ Origin Server
                                                                              └──content──▶ Edge ──▶ User
    ```

---

??? question "Q26: Design a Distributed ID Generator (Snowflake)"

    **Answer:**

    A Snowflake ID generator produces globally unique, time-sortable 64-bit IDs without coordination by encoding timestamp + machine ID + sequence counter into a single integer -- each node generates 4096 IDs per millisecond independently.

    **Why it exists:** Auto-increment IDs require a central database (bottleneck). UUIDs are 128-bit and not sortable. Snowflake gives you the best of both worlds: compact, sortable, distributed, and collision-free by construction.

    **How it works internally:**

    - **Bit layout (64 bits):** `[1 unused][41 bits timestamp][10 bits machine ID][12 bits sequence]`
    - **Timestamp:** Milliseconds since a custom epoch (e.g., 2024-01-01). 41 bits = ~69 years of headroom. Custom epoch maximizes this range.
    - **Machine ID (10 bits):** Supports 1024 machines. Assigned at startup via ZooKeeper, config file, or Kubernetes pod ordinal.
    - **Sequence (12 bits):** Per-millisecond counter (0-4095). If exhausted within 1ms, spin-wait until the next millisecond.
    - **Generation:** Concatenate current_ms | machine_id | next_sequence. No network calls, no locks, pure local computation.

    **When to use:** Primary keys in distributed databases, event ordering in event-sourced systems, trace IDs, anything needing time-sortable unique identifiers.

    **Gotchas:**

    - **Clock skew / NTP jump backward:** If the system clock moves backward, generating an ID with an old timestamp causes collisions. Defense: detect backward jumps, refuse to generate IDs until clock catches up, and alert immediately.
    - **Machine ID reuse after restart:** If a machine restarts and reuses the same machine ID within the same millisecond, collisions occur. Use ZooKeeper lease or wait 1ms before generating.
    - **Bit allocation trade-offs:** More timestamp bits = longer lifespan but fewer machines/throughput. More sequence bits = higher per-node throughput but fewer machines. Tune for your scale.
    - **ID leaks information:** Timestamps in IDs expose creation time and traffic volume. If this is sensitive, obfuscate with a reversible transformation.

---

??? question "Q27: Design an Email System (Gmail-like)"

    **Answer:**

    An email system separates storage into blob (email body + attachments) and structured metadata (subject, labels, thread ID) -- enabling fast search and threading while efficiently storing petabytes of messages with deduplication on shared attachments.

    **Why it exists:** Email is the universal communication protocol. The system must handle SMTP ingestion at scale, spam filtering (>80% of inbound email is spam), full-text search across years of messages, and reliable delivery despite adversarial senders.

    **How it works internally:**

    - **Inbound:** SMTP Gateway receives email, validates SPF/DKIM/DMARC, passes through a Processing Pipeline (spam ML classifier, virus scan, phishing URL detection). If clean, email body is stored as a blob, metadata is indexed, and threading is computed using `In-Reply-To` / `References` headers.
    - **Storage:** Two-tier -- metadata (from, subject, labels, date, thread_id) in a structured store for fast queries and filtering; body + attachments in object storage referenced by content hash (enables deduplication across recipients of the same email).
    - **Search:** Full-text inverted index on subject, body, sender, recipients. Supports operators like `from:boss after:2024-01-01 has:attachment`.
    - **Outbound:** Compose service creates MIME message, SMTP relay delivers with retry, bounce handling, and reputation management.

    **When to use:** Enterprise communication platforms, transactional email services, newsletter systems.

    **Gotchas:**

    - **Spam false positives:** Marking a legitimate email as spam is worse than letting spam through. Use a confidence threshold and quarantine borderline cases rather than silently dropping.
    - **Attachment storage explosion:** A 10MB attachment sent to 1000 recipients should be stored once, not 1000 times. Content-addressable storage with reference counting is essential.
    - **Thread breaking:** Some email clients do not set `In-Reply-To` correctly. Fallback to subject-line matching (Re: prefix stripping) for threading heuristics.
    - **Sender reputation:** Sending too many emails too fast from a new IP gets you blacklisted. Warm up IPs gradually and implement feedback loop processing (RFC 5965).

---

??? question "Q28: Design a Pastebin"

    **Answer:**

    A pastebin is a simple write-once, read-many content store with pre-generated unique keys -- it is essentially a URL shortener where the value is text content instead of a redirect URL, served through a CDN for read scalability.

    **Why it exists:** Quick, frictionless sharing of text snippets (code, logs, configs) without login or file management overhead. The simplicity is the feature -- design complexity should be minimal.

    **How it works internally:**

    - **Write path:** User POSTs content. The API Service grabs a pre-generated 8-char Base62 key from the Key Generation Service (a background process that maintains a pool of unused keys in a database). Content is stored in object storage (S3); metadata (key, user, expiration, visibility, language) goes to a relational DB.
    - **Read path:** GET `/abc12345` hits the CDN/cache first. On miss, the API Service fetches metadata from DB and content from object storage. Popular pastes are cached at the edge with long TTLs.
    - **Cleanup:** A background cron job scans for expired pastes, deletes content from object storage, removes metadata, and recycles keys back to the pool.

    **When to use:** Code sharing, error log sharing, configuration snippets, interview coding pads -- any ephemeral text sharing use case.

    **Gotchas:**

    - **Key exhaustion:** 8-char Base62 = 218 trillion combinations, so exhaustion is unlikely. But key recycling after expiration requires careful handling -- a recycled key serving different content breaks old shared links.
    - **Abuse prevention:** Without rate limiting, pastebins become malware/phishing hosting platforms. Implement per-IP rate limits, content scanning for known malicious patterns, and DMCA takedown APIs.
    - **Private paste security:** A short key (8 chars) is brute-forceable. Private pastes need either longer keys (16+ chars, ~96 bits of entropy) or authentication-gated access.
    - **Large paste handling:** A 10MB paste stored and served directly from the API tier will bottleneck the service. Stream from object storage and enforce size limits at upload time.

---

??? question "Q29: Design an API Rate Limiter (Token Bucket / Sliding Window)"

    **Answer:**

    An API rate limiter uses a token bucket algorithm (industry standard at Stripe, AWS, GitHub) with Redis-backed atomic operations to enforce per-client quotas -- it allows short bursts while maintaining a smooth average rate across distributed API servers.

    **Why it exists:** Rate limiting is both a protection mechanism (prevent abuse, DDoS) and a business mechanism (enforce tier-based API plans). The token bucket specifically was chosen because it models real-world usage better than fixed windows -- users naturally burst.

    **How it works internally:**

    - **Token bucket state:** Each client has a bucket with capacity C (max burst) that refills at rate R tokens/second. Each request consumes 1 token. If the bucket is empty, return 429.
    - **Distributed implementation:** State lives in Redis. A Lua script atomically computes: tokens_available = min(C, last_tokens + refill_since_last_request) - 1. This single atomic operation handles both refill and consumption.
    - **Local-first optimization:** An SDK in the API gateway maintains a local counter synced to Redis periodically. This avoids a Redis RTT on every request while accepting minor over-admission.
    - **Multi-tier enforcement:** Apply multiple limits simultaneously (100/min AND 5000/hour AND 50K/day per API key).

    **Algorithm Comparison:**

    | Algorithm | Pros | Cons |
    |-----------|------|------|
    | **Token Bucket** | Allows bursts, smooth average rate | Slightly complex state |
    | **Sliding Window Log** | Most accurate | High memory (stores each timestamp) |
    | **Sliding Window Counter** | Good accuracy, low memory | Approximate at window edges |
    | **Fixed Window** | Simplest | Burst at window boundaries |
    | **Leaky Bucket** | Smooth output rate | No burst allowance |

    **When to use:** Public APIs, login/auth endpoints, webhook dispatchers, internal service-to-service calls, any shared resource with finite capacity.

    **Gotchas:**

    - **Distributed race condition:** Without atomic operations, two servers can both read "1 token remaining" and both allow -- exceeding the limit. Redis Lua scripts or `DECR` returning negative values are the fix.
    - **Redis failure mode decision:** Fail-open (allow all) risks abuse during outages; fail-closed (deny all) causes self-inflicted outages. Most production systems fail-open with a local in-memory fallback.
    - **Client identification ambiguity:** Rate limit by API key, user ID, or IP? Users behind corporate NATs share one IP -- rate limiting by IP blocks entire companies. Prefer authenticated identity when available.
    - **Header contract:** Always return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After`. Clients that respect these headers reduce unnecessary retries, lowering overall load.

---

??? question "Q30: Design a Parking Lot System"

    **Answer:**

    A parking lot system is an OOP/low-level design question disguised as system design -- the core is a state machine per spot (available/reserved/occupied) with optimistic locking to prevent double-assignment at entry gates.

    **Why it exists (as an interview question):** It tests your ability to model real-world entities cleanly, handle concurrency at physical constraints (gates), and resist the urge to over-engineer. A single parking lot is NOT a distributed systems problem -- keep it proportional.

    **How it works internally:**

    - **Entry flow:** Vehicle arrives at gate. Entry Controller triggers Spot Management Service to find the nearest available spot matching vehicle type (compact/regular/large). Spot status atomically transitions from AVAILABLE to OCCUPIED via optimistic locking (version column). A ticket is issued with entry_time and assigned spot.
    - **Exit flow:** Vehicle arrives at exit gate. The Pricing Engine computes fee based on (exit_time - entry_time) * rate_for_vehicle_type, applying time-of-day multipliers. Payment is processed; spot status reverts to AVAILABLE.
    - **Real-time display:** The Display Service subscribes to spot state changes and pushes updated counts (by floor and type) to LED signs and mobile app.

    **Data model:** `ParkingSpot(id, floor, type, status, version)`, `Ticket(id, spot_id, vehicle_plate, entry_time, exit_time, fee, status)`

    **When to use this pattern:** Any resource allocation system with physical constraints -- warehouse bin assignment, dock scheduling, desk booking in offices.

    **Gotchas:**

    - **Over-engineering trap:** Do NOT propose Kafka, microservices, or distributed databases for a single parking lot. Interviewers want to see you calibrate complexity to the problem scale.
    - **Concurrency at the gate:** Two cars arriving simultaneously at different gates can both be assigned the same "nearest" spot. Optimistic locking with retry (pick next-nearest on conflict) handles this cleanly.
    - **Sensor unreliability:** Physical sensors fail. A car leaves without triggering the exit sensor = ghost-occupied spot. Build a reconciliation process that checks sensor data against payment records.
    - **Multi-lot chain:** Only if the interviewer asks about scaling to 1000 lots should you introduce a central service, per-lot caches, and cross-lot availability aggregation.

    **Diagram:**
    ```
    Vehicle ──Enter──▶ Entry Gate ──▶ Spot Management Service ──Assign spot──▶ Parking DB
                                              └──▶ Availability Display
    Vehicle ──Exit──▶ Exit Gate ──▶ Pricing Engine ──▶ Payment Service ──Release spot──▶ Spot Management
    ```

---

## Quick Reference: Key Concepts Across All Designs

| Concept | Where It Appears |
|---------|-----------------|
| **Consistent Hashing** | Cache (Q6), KV Store (Q20), Web Crawler (Q8) |
| **Fan-out on Write/Read** | Twitter Feed (Q2), News Feed (Q9) |
| **WebSockets** | Chat (Q3), Ride Sharing (Q12), Location (Q24) |
| **Saga Pattern** | E-commerce (Q14), Payment (Q15) |
| **Geospatial Indexing** | Ride Sharing (Q12), Food Delivery (Q13), Location (Q24) |
| **Distributed Locking** | Ticket Booking (Q17), Hotel Booking (Q16) |
| **LSM Trees** | KV Store (Q20), Search Engine (Q21) |
| **Inverted Index** | Search Engine (Q21), Email (Q27) |
| **CDN / Edge Caching** | Video Streaming (Q10), CDN (Q25), URL Shortener (Q1) |
| **Token Bucket / Rate Limiting** | Rate Limiter (Q5, Q29), API Gateway (throughout) |
| **Event Sourcing / CQRS** | E-commerce (Q14), Message Queue (Q19) |
| **Idempotency Keys** | Payment (Q15), Notification (Q4), Ticket Booking (Q17) |
