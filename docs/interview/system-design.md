# Top 30 System Design Interview Questions & Approaches

Use this page as a rapid-review reference before system design interviews. Each question covers **requirements**, **high-level components**, **key decisions**, and (where helpful) a **mermaid architecture diagram**. Answers are concise on purpose -- they show you know the approach, not a full 45-minute deep dive.

---

??? question "Q1: Design a URL Shortener (like bit.ly)"

    **Answer:**

    **Requirements:**

    - Generate a unique short URL for any long URL
    - Redirect short URL to the original with low latency
    - Handle 100M+ URLs; short links expire optionally
    - Analytics: click count, geo, referrer

    **High-Level Design:**

    - **API Gateway** -- accepts shorten / redirect requests
    - **Shortening Service** -- generates a unique 7-char key (Base62 encoding of auto-increment ID or MD5 hash truncation)
    - **Key-Value Store** (Redis + DynamoDB/Cassandra) -- maps short key to long URL
    - **Analytics Service** -- async click event processing via Kafka

    **Key Decisions:**

    - **Base62 vs hashing:** Base62 on a counter avoids collisions; use a distributed ID generator (Snowflake) for scale
    - **Read-heavy** (~100:1 read-to-write): put a CDN / cache in front of the redirect path
    - **301 vs 302 redirect:** 302 (temporary) lets you capture analytics; 301 is cached by browsers

    **Diagram:**
    ```mermaid
    flowchart LR
        Client -->|POST /shorten| API[API Gateway]
        API --> SS[Shortening Service]
        SS --> DB[(Key-Value Store)]
        Client -->|GET /abc123| API
        API --> RS[Redirect Service]
        RS --> Cache[(Redis Cache)]
        Cache -.->|miss| DB
        RS --> Analytics[Analytics via Kafka]
    ```

---

??? question "Q2: Design a Twitter/X Feed (Timeline Generation)"

    **Answer:**

    **Requirements:**

    - Users post tweets (text, images, video)
    - Home timeline shows tweets from followed users, ranked by relevance/time
    - Support 500M users, 600K tweets/sec read at peak
    - Near real-time timeline updates

    **High-Level Design:**

    - **Tweet Service** -- write path: persist tweet to DB, fan-out to followers
    - **Fan-out Service** -- push model for normal users, pull model for celebrities (hybrid)
    - **Timeline Cache** (Redis sorted sets per user) -- pre-computed home timelines
    - **Ranking Service** -- ML-based scoring before serving
    - **Media Service** -- stores images/video in object storage + CDN

    **Key Decisions:**

    - **Fan-out on write vs read:** hybrid approach -- push for users with < 10K followers, pull on read for celebrities to avoid fan-out storms
    - **Timeline cache size:** keep last 800 tweets per user in Redis
    - **Sharding:** shard tweet storage by tweet ID; timeline cache sharded by user ID

    **Diagram:**
    ```mermaid
    flowchart LR
        User(("User")) -->|Post Tweet| TweetSvc(["Tweet Service"])
        TweetSvc --> DB[(Tweet DB)]
        TweetSvc --> Fanout{{"Fan-out Service"}}
        Fanout -->|push| TLC[(Timeline Cache / Redis)]
        User -->|Read Feed| TimelineSvc[["Timeline Service"]]
        TimelineSvc --> TLC
        TimelineSvc -->|pull for celebs| DB
        TimelineSvc --> Ranker[/"Ranking Service"/]
    ```

---

??? question "Q3: Design a Chat System (WhatsApp / Messenger)"

    **Answer:**

    **Requirements:**

    - 1-to-1 and group messaging with delivery guarantees (sent, delivered, read)
    - Support media (images, video, documents)
    - End-to-end encryption; offline message queue
    - Presence (online/offline/typing indicators)

    **High-Level Design:**

    - **WebSocket Gateway** -- persistent connections for real-time bidirectional messaging
    - **Chat Service** -- routes messages, manages sessions
    - **Message Store** (Cassandra/HBase) -- append-only, partitioned by conversation ID
    - **Presence Service** -- heartbeat-based online status via Redis
    - **Push Notification Service** -- for offline users (APNs / FCM)

    **Key Decisions:**

    - **WebSockets vs long polling:** WebSockets for mobile and web; fall back to long polling if needed
    - **Message ordering:** use server-assigned monotonic sequence IDs per conversation
    - **Group chat fan-out:** small groups (< 256) send directly; large groups use pub/sub

    **Diagram:**
    ```mermaid
    flowchart LR
        ClientA <-->|WebSocket| GW[WS Gateway]
        GW <--> ChatSvc[Chat Service]
        ChatSvc --> MQ[(Message Store)]
        ChatSvc <-->|WebSocket| GW2[WS Gateway]
        GW2 <--> ClientB
        ChatSvc --> Push[Push Notification]
        ChatSvc --> Presence[Presence Service / Redis]
    ```

---

??? question "Q4: Design a Notification Service (Push, SMS, Email)"

    **Answer:**

    **Requirements:**

    - Send push, SMS, and email notifications at scale (millions/day)
    - Pluggable provider support (APNs, FCM, Twilio, SendGrid)
    - User preference management (opt-in, quiet hours, frequency capping)
    - Guaranteed delivery with retry; deduplication

    **High-Level Design:**

    - **Notification API** -- accepts notification requests from internal services
    - **Priority Queue** (Kafka topics by priority) -- buffers and orders outbound messages
    - **Worker Pools** -- per-channel workers (push, SMS, email) consume from queues
    - **Template Service** -- manages notification templates and personalization
    - **Preference Store** -- user channel preferences, rate limits

    **Key Decisions:**

    - **At-least-once delivery** with idempotency keys for deduplication
    - **Rate limiting per user** to prevent notification fatigue
    - **Fallback chain:** push fails -> SMS -> email
    - **Async processing** end-to-end; callers get 202 Accepted

---

??? question "Q5: Design a Rate Limiter"

    **Answer:**

    **Requirements:**

    - Limit API requests per user/IP within a time window
    - Support multiple strategies (fixed window, sliding window, token bucket)
    - Distributed: works across multiple API server instances
    - Low latency overhead (< 1ms per check)

    **High-Level Design:**

    - **Rate Limiter Middleware** -- sits in front of the application layer (or in the API gateway)
    - **Redis** -- centralized counter store; atomic INCR + EXPIRE operations
    - **Rules Engine** -- configurable rules per endpoint, user tier, or API key
    - **Response headers:** `X-RateLimit-Remaining`, `Retry-After`

    **Key Decisions:**

    - **Token bucket** is the most flexible (allows bursts); sliding window log is the most accurate
    - **Fixed window** has boundary burst issues; **sliding window counter** is a good hybrid
    - **Local + distributed:** use a local in-memory cache synced periodically with Redis for ultra-low latency
    - **Race conditions:** use Redis Lua scripts for atomic check-and-decrement

---

??? question "Q6: Design a Distributed Cache (Redis-like)"

    **Answer:**

    **Requirements:**

    - In-memory key-value store with sub-millisecond reads
    - Support TTL, eviction policies (LRU, LFU), and multiple data structures
    - Horizontal scaling across nodes; fault tolerance
    - Replication for high availability

    **High-Level Design:**

    - **Cache Nodes** -- each holds a partition of the keyspace in memory
    - **Consistent Hashing Ring** -- maps keys to nodes; minimizes redistribution on scale events
    - **Replication** -- primary-replica per partition (async or semi-sync)
    - **Client Library** -- handles routing, connection pooling, retry

    **Key Decisions:**

    - **Consistent hashing with virtual nodes** to balance load evenly
    - **Eviction policy:** LRU is default; LFU better for skewed access patterns
    - **Persistence:** optional RDB snapshots + AOF for durability (trade-off: memory vs disk I/O)
    - **Cache aside vs write-through vs write-behind:** cache-aside is simplest; write-behind for write-heavy

    **Diagram:**
    ```mermaid
    flowchart LR
        App[Application] --> CL[Client Library]
        CL -->|hash key| Ring[Consistent Hash Ring]
        Ring --> N1[Node 1 Primary]
        Ring --> N2[Node 2 Primary]
        Ring --> N3[Node 3 Primary]
        N1 --> R1[Node 1 Replica]
        N2 --> R2[Node 2 Replica]
        N3 --> R3[Node 3 Replica]
    ```

---

??? question "Q7: Design Search Autocomplete / Typeahead"

    **Answer:**

    **Requirements:**

    - Return top suggestions as the user types (within 100ms)
    - Rank by popularity, personalization, and recency
    - Handle billions of queries per day
    - Update suggestion index near real-time as trends change

    **High-Level Design:**

    - **Trie Service** -- in-memory prefix trie with top-K suggestions precomputed at each node
    - **Data Collection Service** -- aggregates query logs via Kafka into frequency counts
    - **Index Builder** (offline) -- periodically rebuilds the trie from aggregated data
    - **Ranking Layer** -- blends popularity, recency, and user personalization

    **Key Decisions:**

    - **Trie with top-K cache** at each node avoids traversal at query time
    - **Sharding by prefix range** (a-m on shard 1, n-z on shard 2) distributes load
    - **Sampling queries** (1 in N) to reduce data collection volume
    - **Two-tier:** local browser cache (recent queries) + server-side suggestions

---

??? question "Q8: Design a Web Crawler"

    **Answer:**

    **Requirements:**

    - Crawl billions of web pages; respect robots.txt and politeness policies
    - Deduplicate URLs and content; handle dynamic/JavaScript-rendered pages
    - Prioritize pages by importance (PageRank, freshness)
    - Fault-tolerant and resumable

    **High-Level Design:**

    - **URL Frontier** (priority queue) -- manages URLs to crawl, ordered by priority
    - **Fetcher Workers** -- distributed HTTP fetchers with rate limiting per domain
    - **DNS Resolver Cache** -- avoids repeated DNS lookups
    - **Content Parser** -- extracts links, stores content
    - **Dedup Service** -- URL dedup via Bloom filter; content dedup via SimHash

    **Key Decisions:**

    - **BFS vs DFS:** BFS for breadth coverage; priority-based BFS for quality
    - **Politeness:** per-host crawl delay queue; obey robots.txt and Crawl-Delay
    - **Consistent hashing** assigns URL domains to specific workers (avoids hammering one site from multiple workers)
    - **Checkpointing** the frontier to disk for crash recovery

---

??? question "Q9: Design News Feed Ranking"

    **Answer:**

    **Requirements:**

    - Rank posts from friends/followed accounts by relevance, not just time
    - Handle billions of posts daily; personalized per user
    - Support real-time signals (new likes, comments) updating rank
    - A/B testable for ranking model changes

    **High-Level Design:**

    - **Candidate Generation** -- fetch recent posts from followed users (fan-out on write cache)
    - **Feature Extraction** -- compute features: post age, engagement, author affinity, content type
    - **Ranking Model** -- ML model (gradient boosted trees or neural network) scores each candidate
    - **Re-ranking / Filtering** -- diversity rules, dedup, policy filters (misinformation, NSFW)
    - **Serving Layer** -- returns top-N ranked posts with pagination

    **Key Decisions:**

    - **Two-pass ranking:** lightweight first pass to narrow candidates, heavy ML scoring on top 500
    - **Feature store** (Redis/Feast) for real-time features like recent engagement
    - **Online learning** to adapt to trends quickly vs batch model retraining
    - **Engagement vs well-being:** balance clicks/likes with meaningful interactions

---

??? question "Q10: Design a Video Streaming Service (YouTube / Netflix)"

    **Answer:**

    **Requirements:**

    - Upload, transcode, and stream video at scale (4K, multiple resolutions)
    - Adaptive bitrate streaming based on network conditions
    - Support 100M+ concurrent viewers during peak
    - Content recommendation engine

    **High-Level Design:**

    - **Upload Service** -- accepts video uploads, stores raw files in object storage (S3)
    - **Transcoding Pipeline** -- distributed workers (FFmpeg) encode into multiple resolutions/codecs (HLS/DASH segments)
    - **CDN** -- edge servers cache and serve video segments close to users
    - **Streaming API** -- serves manifest files; client pulls segments adaptively
    - **Metadata & Search Service** -- video catalog, tags, search index

    **Key Decisions:**

    - **Adaptive bitrate streaming (ABR):** HLS or DASH protocols; client switches quality based on bandwidth
    - **Transcoding:** use a DAG-based pipeline (split -> encode -> merge) for parallelism
    - **CDN placement:** pre-populate popular content; long-tail served from origin
    - **Storage cost:** hot/warm/cold tiering; delete low-view encodes after 90 days

    **Diagram:**
    ```mermaid
    flowchart LR
        Creator(("Creator")) -->|Upload| US(["Upload Service"])
        US --> S3[(Object Storage)]
        S3 --> TP{{"Transcoding Pipeline"}}
        TP -->|HLS segments| S3
        S3 --> CDN[["CDN Edge Servers"]]
        Viewer(("Viewer")) -->|Stream| CDN
        Viewer -->|Search| Meta[/"Metadata Service"/]
    ```

---

??? question "Q11: Design a File Storage System (Google Drive / Dropbox)"

    **Answer:**

    **Requirements:**

    - Upload, download, sync files across devices
    - File versioning and conflict resolution
    - Sharing with permissions (view, edit, comment)
    - Efficient sync: only transfer changed blocks (delta sync)

    **High-Level Design:**

    - **API Gateway** -- authentication, routing, rate limiting
    - **Metadata Service** -- file tree, permissions, versions stored in relational DB
    - **Block Storage Service** -- splits files into 4MB blocks, content-addressed (SHA-256), stored in object storage
    - **Sync Service** -- long-polling / WebSocket-based change notification to clients
    - **Dedup Service** -- block-level dedup across users using content hashes

    **Key Decisions:**

    - **Block-level delta sync:** only upload changed blocks, not entire files
    - **Conflict resolution:** last-writer-wins for simple conflicts; create conflict copies for simultaneous edits
    - **Chunked uploads** with resumption for large files
    - **Cold storage tier** for files not accessed in 90+ days

---

??? question "Q12: Design a Ride Sharing System (Uber)"

    **Answer:**

    **Requirements:**

    - Match riders with nearby available drivers in real-time
    - Real-time GPS tracking and ETA computation
    - Surge pricing based on supply-demand
    - Payment processing and trip history

    **High-Level Design:**

    - **Location Service** -- drivers send GPS pings every 4 seconds; stored in a geospatial index
    - **Matching Service** -- finds nearest available drivers using geospatial queries (Geohash / QuadTree)
    - **Trip Service** -- manages trip lifecycle (request -> match -> pickup -> drop-off)
    - **Pricing Service** -- dynamic pricing based on demand/supply ratio per zone
    - **ETA Service** -- graph-based routing (Dijkstra / A*) with live traffic data

    **Key Decisions:**

    - **Geohash vs QuadTree:** Geohash is simpler and maps well to key-value stores; QuadTree adapts to density
    - **Dispatch radius expansion:** start with 1km; expand if no drivers found
    - **Consistency:** trip state machine with idempotent transitions; two-phase commit for payment
    - **Supply positioning:** ML model suggests idle drivers move to high-demand zones

    **Diagram:**
    ```mermaid
    flowchart LR
        Rider -->|Request Ride| API[API Gateway]
        API --> Match[Matching Service]
        Match --> Geo[(Geospatial Index)]
        Driver -->|GPS ping| LocSvc[Location Service]
        LocSvc --> Geo
        Match --> Trip[Trip Service]
        Trip --> Price[Pricing Service]
        Trip --> Pay[Payment Service]
    ```

---

??? question "Q13: Design a Food Delivery System (DoorDash)"

    **Answer:**

    **Requirements:**

    - Users browse restaurants, place orders, track delivery in real-time
    - Match orders with delivery drivers; optimize multi-order batching
    - Restaurant order management (accept, prepare, ready for pickup)
    - ETA prediction for preparation + delivery

    **High-Level Design:**

    - **Restaurant Service** -- menus, availability, hours
    - **Order Service** -- order lifecycle (placed -> confirmed -> preparing -> ready -> picked up -> delivered)
    - **Dispatch Service** -- assigns drivers using optimization algorithms (minimize total delivery time)
    - **Tracking Service** -- real-time GPS tracking via WebSockets
    - **ETA Service** -- ML model predicting prep time + travel time

    **Key Decisions:**

    - **Batching orders:** group nearby orders to the same driver to improve efficiency
    - **Two-sided marketplace:** balance driver supply with order demand per zone
    - **Idempotent order placement** to prevent duplicate charges on network retries
    - **Kitchen display system (KDS) integration** for restaurant-side order management

---

??? question "Q14: Design E-commerce Order Processing (Amazon)"

    **Answer:**

    **Requirements:**

    - Handle millions of concurrent orders during peak (Prime Day)
    - Inventory management with strong consistency (no overselling)
    - Order lifecycle: cart -> checkout -> payment -> fulfillment -> delivery
    - Support multiple fulfillment centers and shipping options

    **High-Level Design:**

    - **Product Catalog Service** -- product info, pricing, images (read-heavy, cached)
    - **Cart Service** -- per-user shopping cart (Redis for active, DB for persistence)
    - **Order Service** -- orchestrates the checkout flow via saga pattern
    - **Inventory Service** -- real-time stock tracking with pessimistic locking on checkout
    - **Payment Service** -- integrates with payment providers; handles refunds

    **Key Decisions:**

    - **Saga pattern** for distributed transactions across inventory, payment, and order services
    - **Inventory reservation:** reserve stock at checkout, release after timeout if payment fails
    - **CQRS:** separate read models (product search) from write models (order processing)
    - **Event sourcing** on order state changes for full audit trail

    **Diagram:**
    ```mermaid
    flowchart LR
        User(("User")) -->|Browse| Catalog[/"Product Catalog"/]
        User -->|Add to Cart| Cart(["Cart Service"])
        Cart -->|Checkout| Order{{"Order Service"}}
        Order -->|Reserve| Inventory[["Inventory Service"]]
        Order -->|Charge| Payment[["Payment Service"]]
        Order -->|Ship| Fulfillment(["Fulfillment Service"])
        Order -.->|Events| Kafka[/"Event Bus / Kafka"/]
    ```

---

??? question "Q15: Design a Payment System (Stripe-like)"

    **Answer:**

    **Requirements:**

    - Process credit card, debit, and bank payments securely
    - Exactly-once payment semantics (idempotency)
    - PCI-DSS compliance; tokenize card data
    - Support refunds, disputes, and multi-currency

    **High-Level Design:**

    - **Payment API** -- accepts payment intents with idempotency keys
    - **Payment Processing Service** -- orchestrates auth, capture, settlement
    - **Tokenization Service** -- replaces card numbers with tokens (PCI scope reduction)
    - **Ledger Service** -- double-entry bookkeeping for every transaction
    - **Risk/Fraud Engine** -- ML-based fraud scoring before authorization

    **Key Decisions:**

    - **Idempotency keys** on every payment request to prevent double charges
    - **Two-phase payment:** authorize first, capture on fulfillment
    - **Double-entry ledger** ensures every credit has a matching debit (audit-proof)
    - **Retry with exponential backoff** for downstream payment processor timeouts
    - **Event-driven architecture** for webhook notifications to merchants

---

??? question "Q16: Design a Hotel Booking System (Booking.com)"

    **Answer:**

    **Requirements:**

    - Search available rooms by location, dates, guests, and price
    - Handle concurrent booking attempts for the same room
    - Support cancellations with refund policies
    - Price variations by season, demand, and room type

    **High-Level Design:**

    - **Search Service** -- Elasticsearch index of hotels with availability filters
    - **Inventory Service** -- room availability calendar; uses pessimistic locking or optimistic concurrency
    - **Booking Service** -- manages reservation lifecycle
    - **Pricing Service** -- dynamic pricing engine with revenue management rules
    - **Review Service** -- user reviews and ratings

    **Key Decisions:**

    - **Overbooking strategy:** some hotels intentionally overbook by a small %; system must support this
    - **Concurrency:** use database-level row locking or optimistic versioning on the availability row
    - **Search vs booking consistency:** search results may show stale availability; booking is strongly consistent
    - **Caching:** aggressive caching on search (TTL 30s-60s); no caching on booking path

---

??? question "Q17: Design a Ticket Booking System (BookMyShow) -- Concurrency Handling"

    **Answer:**

    **Requirements:**

    - Users select seats for events; seats must not be double-booked
    - Handle flash sales (100K+ users trying to book simultaneously)
    - Temporary seat hold during checkout (5-10 min TTL)
    - Waitlist support for sold-out events

    **High-Level Design:**

    - **Seat Map Service** -- real-time seat availability with visual seat selection
    - **Reservation Service** -- temporary hold with TTL; converts to confirmed booking on payment
    - **Queue Service** -- virtual waiting room during high-demand events
    - **Payment Service** -- processes payment within hold window
    - **Notification Service** -- booking confirmation, waitlist alerts

    **Key Decisions:**

    - **Distributed lock per seat** (Redis `SET NX EX`) for temporary holds -- auto-expires if user abandons
    - **Virtual queue** for flash sales: users enter a FIFO queue, processed in batches
    - **Optimistic locking** with version column on seat status to prevent race conditions
    - **Exactly-once booking:** idempotency key tied to user + event + seats

    **Diagram:**
    ```mermaid
    flowchart LR
        User(("User")) -->|Select Seats| SeatMap[["Seat Map Service"]]
        SeatMap -->|Hold seats| Redis[(Redis Lock / TTL)]
        User -->|Pay| Payment{{"Payment Service"}}
        Payment -->|Confirm| Booking(["Reservation Service"])
        Booking -->|Release lock| Redis
        Booking --> DB[(Booking DB)]
        Booking --> Notify[/"Notification Service"/]
    ```

---

??? question "Q18: Design a Social Network Graph"

    **Answer:**

    **Requirements:**

    - Store and query social relationships (follow, friend, block)
    - Efficient friend-of-friend queries (2nd degree connections)
    - Mutual friends computation; "People you may know" suggestions
    - Scale to billions of edges

    **High-Level Design:**

    - **Graph Database** (Neo4j or custom adjacency list on sharded storage) -- stores user nodes and relationship edges
    - **Graph Query Service** -- handles traversals (friends of friends, shortest path)
    - **Recommendation Service** -- suggests connections based on mutual friends, interests, and graph proximity
    - **Cache Layer** -- cache friend lists and follower counts in Redis

    **Key Decisions:**

    - **Adjacency list in a sharded key-value store** scales better than a single graph DB for very large networks
    - **Bidirectional edges** for friendships; unidirectional for follows
    - **Precompute 2nd-degree connections** offline for "people you may know"
    - **Graph partitioning:** minimize cross-shard traversals by co-locating communities

---

??? question "Q19: Design a Distributed Message Queue (Kafka-like)"

    **Answer:**

    **Requirements:**

    - Publish-subscribe with topic-based routing
    - Durable, ordered, and replayable message storage
    - High throughput (millions of messages/sec) with low latency
    - Consumer groups with partition-level parallelism

    **High-Level Design:**

    - **Broker Cluster** -- each broker stores partitions as append-only log segments on disk
    - **ZooKeeper / Raft Controller** -- cluster metadata, leader election, partition assignment
    - **Producer** -- publishes to a topic partition (round-robin, key-based, or custom partitioner)
    - **Consumer Groups** -- each partition consumed by exactly one consumer in a group
    - **Replication** -- each partition has N replicas; ISR (in-sync replicas) for durability guarantees

    **Key Decisions:**

    - **Append-only log** on disk: sequential I/O is fast; use OS page cache for reads
    - **Partition count** determines max parallelism -- choose based on throughput needs
    - **Acks setting:** `acks=all` for durability, `acks=1` for lower latency
    - **Retention:** time-based (7 days) or size-based; compacted topics for changelogs

    **Diagram:**
    ```mermaid
    flowchart LR
        P1[Producer] -->|write| B1[Broker 1 - Partition 0 Leader]
        P2[Producer] -->|write| B2[Broker 2 - Partition 1 Leader]
        B1 -->|replicate| B3[Broker 3 - Partition 0 Replica]
        B2 -->|replicate| B1b[Broker 1 - Partition 1 Replica]
        B1 -->|consume| C1[Consumer Group A - Consumer 1]
        B2 -->|consume| C2[Consumer Group A - Consumer 2]
    ```

---

??? question "Q20: Design a Key-Value Store (DynamoDB-like)"

    **Answer:**

    **Requirements:**

    - Fast reads and writes (single-digit ms latency at P99)
    - Horizontal scaling with automatic partitioning
    - Tunable consistency (strong or eventual)
    - Support range queries on sort key

    **High-Level Design:**

    - **Router / Request Coordinator** -- determines which partition handles the request
    - **Storage Nodes** -- each manages multiple partitions; data stored in LSM trees (memtable + SSTables)
    - **Consistent Hashing Ring** -- maps partition key to a set of nodes
    - **Replication** -- quorum-based (W + R > N for strong consistency)
    - **Anti-entropy** -- Merkle trees for replica synchronization; gossip protocol for failure detection

    **Key Decisions:**

    - **LSM tree** for write-optimized storage; periodic compaction merges SSTables
    - **Quorum reads/writes:** configurable (N=3, W=2, R=2 for strong; W=1, R=1 for fast eventual)
    - **Partition key design** is critical -- avoid hot partitions (e.g., don't use date as partition key)
    - **Vector clocks or last-writer-wins** for conflict resolution in eventually consistent mode

---

??? question "Q21: Design a Search Engine (Elasticsearch-like)"

    **Answer:**

    **Requirements:**

    - Full-text search with relevance ranking across billions of documents
    - Support filters, facets, aggregations, and fuzzy matching
    - Near real-time indexing (< 1 second from write to searchable)
    - Horizontally scalable and fault-tolerant

    **High-Level Design:**

    - **Indexing Pipeline** -- tokenize, analyze, and build inverted index from documents
    - **Inverted Index** -- maps terms to document IDs with positions and frequencies
    - **Shards** -- each index split into N shards distributed across nodes
    - **Query Coordinator** -- scatter query to all relevant shards, gather and merge results
    - **Replica Shards** -- each shard has replicas for HA and read scaling

    **Key Decisions:**

    - **TF-IDF / BM25** for relevance scoring
    - **Segment-based architecture:** immutable segments merged periodically (like LSM trees)
    - **Near real-time:** new documents visible after a "refresh" interval (default 1s)
    - **Shard sizing:** target 10-50GB per shard for optimal performance

---

??? question "Q22: Design a Metrics / Monitoring System (Prometheus-like)"

    **Answer:**

    **Requirements:**

    - Collect and store time-series metrics from thousands of services
    - Support queries like "P99 latency of service X over last 24h"
    - Alerting on threshold breaches
    - Retention: high-res for 15 days, downsampled for 1 year

    **High-Level Design:**

    - **Metric Collectors / Agents** -- scrape or receive metrics from services
    - **Time-Series Database** -- stores metric data points (timestamp, value, labels)
    - **Query Engine** -- PromQL-like language for aggregations, rate calculations
    - **Alert Manager** -- evaluates rules periodically, triggers notifications
    - **Dashboard Service** (Grafana-like) -- visualizes queries

    **Key Decisions:**

    - **Pull vs push model:** pull (Prometheus-style) is simpler for service discovery; push for ephemeral jobs
    - **Storage:** chunked time-series with delta/gorilla compression (10x compression ratio)
    - **Downsampling:** aggregate older data to 5m/1h resolution to save storage
    - **Label cardinality:** high cardinality labels (user IDs) explode storage -- design labels carefully

    **Diagram:**
    ```mermaid
    flowchart LR
        Svc1[Service 1] -->|scrape| Collector[Metric Collector]
        Svc2[Service 2] -->|scrape| Collector
        Collector --> TSDB[(Time-Series DB)]
        TSDB --> Query[Query Engine]
        Query --> Dashboard[Grafana Dashboard]
        TSDB --> Alert[Alert Manager]
        Alert --> PagerDuty[PagerDuty / Slack]
    ```

---

??? question "Q23: Design an Online Code Editor / Judge"

    **Answer:**

    **Requirements:**

    - Users write and submit code in multiple languages (Java, Python, C++)
    - Execute code in a sandboxed environment with CPU/memory/time limits
    - Compare output against expected test cases; return pass/fail/TLE/MLE
    - Support contests with thousands of concurrent submissions

    **High-Level Design:**

    - **Web IDE** -- browser-based code editor with syntax highlighting
    - **Submission Service** -- accepts code, enqueues for execution
    - **Execution Queue** (RabbitMQ / SQS) -- buffers submissions during high load
    - **Judge Workers** -- sandboxed containers (Docker/gVisor) compile and run code with resource limits
    - **Result Service** -- compares stdout with expected output, stores verdict

    **Key Decisions:**

    - **Sandboxing:** use containers with seccomp profiles, no network access, cgroup limits
    - **Resource limits:** 2s CPU time, 256MB RAM per submission; kill on exceed
    - **Autoscaling workers** during contests; pre-warm containers per language
    - **Plagiarism detection:** MOSS-like token comparison on submissions

---

??? question "Q24: Design a Location-Based Service (Nearby Friends)"

    **Answer:**

    **Requirements:**

    - Show friends within a configurable radius who opted in to location sharing
    - Near real-time updates as friends move
    - Privacy controls (share with specific friends, time-limited sharing)
    - Scale to millions of concurrent active users

    **High-Level Design:**

    - **Location Ingestion Service** -- receives GPS updates from mobile clients every 30 seconds
    - **Geospatial Index** (Redis with geospatial commands or custom Geohash index) -- stores current locations
    - **Proximity Service** -- for each user, query friends within radius using geo queries
    - **Pub/Sub Layer** -- subscribe to friend location channels; push updates via WebSocket
    - **Privacy Service** -- enforces sharing permissions and expiry

    **Key Decisions:**

    - **Geohash precision:** use 6-char geohash (~1.2km cells) for nearby queries; adjust for radius
    - **Push vs poll:** push updates via WebSocket when a friend's location changes significantly (> 100m)
    - **Fan-out per user:** only compute proximity for active friends (not all friends)
    - **Battery optimization:** reduce update frequency when user is stationary

---

??? question "Q25: Design a Content Delivery Network (CDN)"

    **Answer:**

    **Requirements:**

    - Cache and serve static content (images, JS, CSS, video) from edge servers close to users
    - Reduce latency and origin server load
    - Support cache invalidation and purging
    - Handle millions of requests per second globally

    **High-Level Design:**

    - **Edge PoPs (Points of Presence)** -- servers in 50+ cities worldwide; serve cached content
    - **Origin Shield** -- intermediate cache layer protecting the origin from thundering herd
    - **DNS-based Routing** -- GeoDNS resolves to the nearest edge PoP
    - **Cache Control** -- respects HTTP cache headers (Cache-Control, ETag, Last-Modified)
    - **Purge API** -- allows origin to invalidate cached content globally

    **Key Decisions:**

    - **Pull vs push CDN:** pull (cache on first request) is simpler; push for pre-populated popular content
    - **Cache key design:** URL + Vary headers; be careful with query parameters
    - **Stale-while-revalidate:** serve stale content while fetching fresh copy in background
    - **TLS termination at edge** to reduce latency (no TLS round-trip to origin)

    **Diagram:**
    ```mermaid
    flowchart LR
        User(("User")) -->|DNS query| GeoDNS{{"GeoDNS"}}
        GeoDNS -->|nearest PoP| Edge(["Edge Server"])
        Edge -->|cache hit| User
        Edge -->|cache miss| Shield[["Origin Shield"]]
        Shield -->|miss| Origin[/"Origin Server"/]
        Origin -->|content| Shield
        Shield -->|content| Edge
    ```

---

??? question "Q26: Design a Distributed ID Generator (Snowflake)"

    **Answer:**

    **Requirements:**

    - Generate globally unique, roughly time-ordered 64-bit IDs
    - High throughput (10K+ IDs/sec per node)
    - No coordination between nodes (no central DB sequence)
    - IDs should be sortable by creation time

    **High-Level Design:**

    - **ID Structure (64 bits):** `[1 bit unused][41 bits timestamp][10 bits machine ID][12 bits sequence]`
    - **Timestamp** -- milliseconds since custom epoch (gives ~69 years of IDs)
    - **Machine ID** -- assigned via ZooKeeper or config (supports 1024 machines)
    - **Sequence** -- per-millisecond counter (4096 IDs per ms per machine)

    **Key Decisions:**

    - **Clock skew:** if system clock goes backward, wait until clock catches up or throw error
    - **No single point of failure:** each machine generates IDs independently
    - **Custom epoch** (e.g., 2024-01-01) maximizes the 41-bit timestamp range
    - **Alternative approaches:** UUID (128-bit, not sortable), DB auto-increment (bottleneck), ULID (string-based, sortable)

---

??? question "Q27: Design an Email System (Gmail-like)"

    **Answer:**

    **Requirements:**

    - Send and receive emails (SMTP inbound/outbound)
    - Store and search emails per user (labels, folders, threads)
    - Spam and phishing detection
    - Support attachments up to 25MB

    **High-Level Design:**

    - **SMTP Gateway** -- inbound: receives emails from the internet; outbound: sends via SMTP relay
    - **Email Processing Pipeline** -- spam filtering, virus scanning, threading, labeling
    - **Email Store** -- per-user email storage (wide-column DB or blob store + metadata index)
    - **Search Service** -- full-text index on email subject, body, sender, recipients
    - **Notification Service** -- push notifications for new emails

    **Key Decisions:**

    - **Storage model:** store email body as a blob; metadata (subject, from, date, labels) in a structured index
    - **Threading:** use `In-Reply-To` and `References` headers to group conversations
    - **Spam detection:** ML classifier on sender reputation, content analysis, SPF/DKIM/DMARC checks
    - **Attachment handling:** store in object storage; reference by ID in email metadata

---

??? question "Q28: Design a Pastebin"

    **Answer:**

    **Requirements:**

    - Users paste text and get a unique shareable URL
    - Support expiration (1 hour, 1 day, never), syntax highlighting, and private pastes
    - Handle high read traffic (read:write ratio ~10:1)
    - Paste size limit (e.g., 10MB)

    **High-Level Design:**

    - **API Service** -- create paste (POST), read paste (GET), delete paste (DELETE)
    - **Key Generation Service** -- generates unique 8-char keys (pre-generated pool using Base62)
    - **Object Storage** -- paste content stored in S3 or similar blob store
    - **Metadata Store** (MySQL/PostgreSQL) -- paste metadata: key, user, expiration, visibility
    - **CDN / Cache** -- cache popular pastes at the edge

    **Key Decisions:**

    - **Pre-generated keys** in a pool (KGS) avoids runtime collision handling
    - **Cleanup job:** background cron deletes expired pastes and reclaims keys
    - **Private pastes:** use longer keys (16 chars) or require authentication
    - **Rate limiting** per IP to prevent abuse

---

??? question "Q29: Design an API Rate Limiter (Token Bucket / Sliding Window)"

    **Answer:**

    **Requirements:**

    - Enforce rate limits per API key, user, or IP across distributed servers
    - Support multiple algorithms (token bucket, sliding window counter, leaky bucket)
    - Return standard rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`)
    - Sub-millisecond decision latency

    **High-Level Design:**

    - **Rate Limiter SDK** -- embedded in API gateway or as a sidecar proxy
    - **Rules Store** -- defines limits per endpoint, plan tier, and client
    - **Redis Backend** -- atomic counter operations per key with TTL
    - **Sync Layer** -- local counters synced to Redis; local-first for speed

    **Algorithm Comparison:**

    | Algorithm | Pros | Cons |
    |-----------|------|------|
    | **Token Bucket** | Allows bursts, smooth average rate | Slightly complex state |
    | **Sliding Window Log** | Most accurate | High memory (stores each timestamp) |
    | **Sliding Window Counter** | Good accuracy, low memory | Approximate at window edges |
    | **Fixed Window** | Simplest | Burst at window boundaries |
    | **Leaky Bucket** | Smooth output rate | No burst allowance |

    **Key Decisions:**

    - **Token bucket** is industry standard (used by Stripe, AWS); allows short bursts while enforcing average rate
    - **Redis Lua scripts** for atomic check-and-decrement to avoid race conditions
    - **Graceful degradation:** if Redis is down, fail open (allow) or fail closed (deny) based on policy
    - **Multi-tier limits:** e.g., 100/min AND 5000/hour per user

---

??? question "Q30: Design a Parking Lot System"

    **Answer:**

    **Requirements:**

    - Track available spots across multiple floors and spot types (compact, regular, large, handicapped)
    - Assign nearest available spot on entry; free spot on exit
    - Calculate parking fee based on duration and vehicle type
    - Display real-time availability on signs and mobile app

    **High-Level Design:**

    - **Entry/Exit Controller** -- sensors or ticket machines at gates; triggers spot assignment/release
    - **Spot Management Service** -- maintains spot state (available/occupied) per floor and type
    - **Pricing Engine** -- calculates fee based on duration, vehicle type, and time of day
    - **Display Service** -- pushes availability counts to floor signs and mobile app
    - **Payment Service** -- accepts cash, card, or mobile payment at exit

    **Key Decisions:**

    - **Spot assignment strategy:** nearest to entrance (for user convenience) or fill by zone (for even distribution)
    - **Data model:** `ParkingSpot(id, floor, type, status)`, `Ticket(id, spot_id, entry_time, exit_time, fee)`
    - **Concurrency:** use optimistic locking on spot status to prevent double-assignment
    - **Scalability:** a single parking lot is not a distributed system problem -- keep it simple; for a chain of lots, use a central service with per-lot caches

    **Diagram:**
    ```mermaid
    flowchart LR
        Vehicle(("Vehicle")) -->|Enter| Gate(["Entry Gate / Sensor"])
        Gate --> SpotMgr{{"Spot Management Service"}}
        SpotMgr -->|Assign spot| DB[(Parking DB)]
        SpotMgr --> Display[/"Availability Display"/]
        Vehicle -->|Exit| ExitGate(["Exit Gate"])
        ExitGate --> Pricing[["Pricing Engine"]]
        Pricing --> Payment[["Payment Service"]]
        Payment -->|Release spot| SpotMgr
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
