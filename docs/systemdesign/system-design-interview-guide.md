---
title: "System Design Interview Guide 2026 — FAANG Step-by-Step Framework & Patterns"
description: "Master system design interviews for FAANG — complete framework (requirements, capacity, API, data model, architecture), scalability patterns, CAP theorem, load balancing, caching, database sharding. Real interviewer tips from Salesforce Senior Engineer."
---

# System Design Interview Guide — FAANG Framework & Case Studies 2026

> **The systematic approach to system design interviews.** Learn the building blocks, then apply them to real case studies. This guide links 30+ deep-dive topics organized by concept, giving you a structured path from fundamentals to interview-ready confidence.

---

## How to Use This Guide

The system design interview tests your ability to design large-scale distributed systems under time pressure (typically 35-45 minutes). Success requires two things: **mastery of building blocks** and **a repeatable framework** for structuring your answer.

**Study path:**

1. Learn the **framework** (next section) so you never freeze during an interview
2. Study **Sections 1-5** to build your vocabulary of components and trade-offs
3. Practice **Section 6 case studies** to see how components combine into real systems
4. Use the **preparation roadmap** to plan your 4-6 week study schedule

Every link in this guide leads to a dedicated deep-dive page with diagrams, trade-off analysis, and interview-relevant details.

---

## The System Design Interview Framework

Every system design question — from "Design a URL shortener" to "Design YouTube" — can be answered using this five-step framework. Interviewers expect this structure, and deviating from it is one of the most common reasons candidates fail.

### Step 1: Clarify Requirements (3-5 minutes)

Never start drawing boxes immediately. Ask questions to scope the problem.

**Functional requirements** — What does the system do?

- Who are the users? How many?
- What are the core use cases? (List 3-5 max)
- What inputs/outputs does each API need?

**Non-functional requirements** — What qualities must the system have?

- **Scale**: How many DAU? Reads per second? Writes per second?
- **Latency**: What response time is acceptable? (p99 < 200ms?)
- **Availability**: Can we tolerate downtime? (99.9%? 99.99%?)
- **Consistency**: Is eventual consistency acceptable, or do we need strong consistency?
- **Durability**: Can we lose data? What's the retention policy?

### Step 2: Back-of-Envelope Estimation (3-5 minutes)

Estimations show you understand scale and can make rational capacity decisions.

- **Traffic**: QPS for reads and writes
- **Storage**: How much data per record x number of records x retention period
- **Bandwidth**: QPS x average response size
- **Memory**: If caching, what percentage of data fits in RAM?

**Link to:** [Estimation Cheatsheet](estimation-cheatsheet.md) — Reference numbers, formulas, and worked examples.

### Step 3: High-Level Architecture (5-10 minutes)

Draw the major components and how data flows between them. Start simple:

- Client → Load Balancer → Application Servers → Database
- Add caches, queues, and CDNs as needed
- Identify read path vs. write path

### Step 4: Component Deep Dive (10-15 minutes)

The interviewer will ask you to zoom into 1-2 components. Be ready to discuss:

- Database schema and indexing strategy
- API design (REST endpoints or RPC definitions)
- Data partitioning and replication strategy
- Caching layer design and invalidation policy
- How the system handles failures

### Step 5: Trade-offs and Scaling (5-10 minutes)

Demonstrate maturity by discussing what you would do differently at 10x or 100x scale:

- Where are the bottlenecks?
- What are the single points of failure?
- What trade-offs did you make and why?
- How would you monitor and alert on this system?

---

## 1. Networking & Communication

### What You Need to Know

Every distributed system relies on network communication between components. Understanding protocols, load distribution, and content delivery is foundational. You should be able to explain the difference between L4 and L7 load balancing, when to use WebSockets vs. polling, and how a CDN reduces latency for global users.

Key questions interviewers ask:

- How does HTTPS prevent man-in-the-middle attacks?
- When would you use a reverse proxy vs. a load balancer?
- How do you push real-time updates to millions of connected clients?

### Go Deeper

- [HTTPS & TLS](../https.md) — TLS handshake, certificate chains, and how secure communication works end-to-end
- [WebSockets & SSE](websockets-sse.md) — Real-time communication patterns, connection management at scale
- [Load Balancers](../loadbalancer.md) — L4 vs L7 balancing, algorithms (round-robin, least connections, consistent hashing), health checks
- [Proxies](proxies.md) — Forward proxy vs. reverse proxy, use cases, and how they fit into system architecture
- [CDN](cdn.md) — Content delivery networks, push vs. pull invalidation, edge caching strategies
- [API Gateway](../microservices/APIGATEWAY.md) — Request routing, rate limiting, authentication, and protocol translation

---

## 2. Data Storage & Databases

### Core Principles

Database choice is often the most consequential decision in a system design. You need to understand when relational databases excel (ACID transactions, complex joins, strong consistency) vs. when NoSQL is the right fit (flexible schema, horizontal scaling, high write throughput).

Key principles:

- **ACID** guarantees in relational databases (Atomicity, Consistency, Isolation, Durability)
- **BASE** semantics in NoSQL systems (Basically Available, Soft state, Eventually consistent)
- **Indexing** dramatically improves read performance but slows writes
- **Denormalization** trades storage for read speed — common in read-heavy systems
- **Write-ahead logs (WAL)** ensure durability before acknowledging writes

### Further Reading

- [SQL vs NoSQL](../sqlvsnosql.md) — Decision framework for choosing between relational and non-relational databases
- [CAP Theorem](../capTheorem.md) — Why you must choose between consistency and availability during network partitions
- [Database Sharding](database-sharding.md) — Horizontal partitioning strategies, shard key selection, resharding challenges
- [Data Partitioning](data-partitioning.md) — Range partitioning, hash partitioning, list partitioning, and composite approaches
- [Replication](replication.md) — Leader-follower, multi-leader, and leaderless replication with conflict resolution
- [Consistent Hashing](../consistenthashing.md) — Ring-based distribution that minimizes data movement when nodes join or leave

---

## 3. Caching & Performance

### Strategies & Trade-offs

Caching is the single most impactful technique for reducing latency and database load. A well-designed cache can reduce p99 latency from 100ms to under 5ms. However, caching introduces complexity around invalidation, consistency, and memory management.

**Cache strategies you must know:**

- **Cache-aside (Lazy loading)**: Application checks cache first, loads from DB on miss
- **Write-through**: Write to cache and DB simultaneously
- **Write-behind (Write-back)**: Write to cache immediately, asynchronously persist to DB
- **Read-through**: Cache itself loads data from DB on miss

**Invalidation approaches:**

- **TTL-based**: Simple but can serve stale data
- **Event-driven**: Invalidate on write — fresher but more complex
- **Versioning**: Append version to cache key — avoids race conditions

**Cache eviction policies:** LRU (most common), LFU, FIFO, Random

### Reference Pages

- [Distributed Caching](../distributedCaching.md) — Cache topologies, consistency challenges, thundering herd prevention
- [Redis](../redis.md) — Data structures (strings, hashes, sorted sets, streams), clustering, persistence modes
- [Bloom Filters](bloom-filters.md) — Space-efficient probabilistic membership testing, false positive rates
- [Rate Limiting](../ratelimiting.md) — Token bucket, sliding window log, sliding window counter, and distributed rate limiting

---

## 4. Distributed Systems Concepts

### Failure Modes & Guarantees

Distributed systems introduce failure modes that don't exist in single-machine applications. Networks can partition, clocks can drift, nodes can crash silently, and messages can arrive out of order. Understanding these challenges — and the algorithms designed to handle them — separates senior engineers from juniors in interviews.

**Fundamental challenges:**

- **Network partitions**: Nodes cannot communicate; must decide whether to remain available or preserve consistency
- **Clock skew**: Different machines have different clock values; cannot rely on timestamps for ordering
- **Split brain**: Multiple nodes believe they are the leader simultaneously
- **Byzantine failures**: Nodes may behave arbitrarily (though most interview questions assume crash-stop failures)

**Key guarantees to discuss:**

- **Exactly-once delivery**: Extremely hard; most systems achieve at-least-once with idempotency
- **Linearizability**: Strongest consistency — every operation appears to happen at a single point in time
- **Causal consistency**: Operations that are causally related appear in order; concurrent operations may be reordered

### Study These Topics

- [Consensus Algorithms](consensus-algorithms.md) — Paxos and Raft: how distributed nodes agree on a single value despite failures
- [Leader Election](leader-election.md) — Bully algorithm, ring algorithm, ZooKeeper-based election
- [Distributed Transactions](distributed-transactions.md) — Two-phase commit (2PC), three-phase commit, and the Saga pattern
- [Distributed Locks](../distributedlocks.md) — Redlock algorithm, ZooKeeper recipes, fencing tokens for correctness
- [Heartbeat & Gossip](heartbeat-gossip.md) — Failure detection protocols, phi-accrual detector, epidemic protocols
- [Service Discovery](service-discovery.md) — Client-side vs. server-side discovery, DNS-based, registry-based (Consul, etcd)
- [Circuit Breakers](circuit-breakers.md) — Preventing cascading failures, states (closed/open/half-open), timeout tuning

---

## 5. Design Building Blocks

### Essential Components

Beyond the core distributed systems theory, certain components appear in nearly every system design answer. Message queues enable asynchronous processing, decouple producers from consumers, and absorb traffic spikes. Unique ID generation is required whenever you need to identify entities across a distributed system without coordination.

**When to introduce a message queue:**

- Work can be processed asynchronously (email sending, image processing)
- You need to decouple services (order service shouldn't wait for inventory service)
- You need to absorb write spikes (queue buffers requests, workers process at their own pace)
- You need guaranteed delivery with retry semantics

**ID generation requirements in distributed systems:**

- Globally unique without coordination between nodes
- Roughly time-sortable (enables range queries on creation time)
- Compact enough for URLs or database keys
- High throughput (thousands of IDs per second per node)

### Deep Dives

- [Message Queues](message-queues.md) — Kafka vs. RabbitMQ, delivery semantics, partitioning, consumer groups, dead letter queues
- [Unique ID Generation](unique-id-generation.md) — UUID, Twitter Snowflake, ULID, database sequences, and trade-offs between approaches

---

## 6. Case Studies — Practice Problems

These are full system design walkthroughs following the five-step framework. Each page covers requirements, estimation, high-level design, deep dives, and trade-offs for a commonly asked interview question.

| Problem | Difficulty | Key Concepts Tested |
|---------|-----------|---------------------|
| [URL Shortener](case-studies/url-shortener.md) | Medium | Hashing, base62 encoding, read-heavy workload, cache layer |
| [Chat System](case-studies/chat-system.md) | Hard | WebSockets, message ordering, presence, group chat fan-out |
| [News Feed](case-studies/news-feed.md) | Hard | Fan-out on write vs. read, ranking algorithms, cache invalidation |
| [Notification System](case-studies/notification-system.md) | Medium | Message queues, templates, multi-channel delivery, deduplication |
| [Payment System](case-studies/payment-system.md) | Hard | Idempotency, exactly-once semantics, reconciliation, ledger design |
| [Rate Limiter](case-studies/rate-limiter.md) | Medium | Token bucket, sliding window, distributed counters, Redis |
| [Ride Sharing](case-studies/ride-sharing.md) | Hard | Geospatial indexing, real-time matching, ETA calculation, surge pricing |
| [Search Autocomplete](case-studies/search-autocomplete.md) | Medium | Trie data structure, ranking by frequency, caching prefix results |
| [Ticket Booking](case-studies/ticket-booking.md) | Hard | Concurrency control, seat locking, distributed transactions, fairness |
| [Video Streaming](case-studies/video-streaming.md) | Hard | CDN, adaptive bitrate streaming, chunked transfer, transcoding pipeline |

**How to practice:**

1. Set a 35-minute timer
2. Open the problem without looking at the solution
3. Write out your answer following the framework
4. Compare against the walkthrough
5. Identify gaps in your knowledge and revisit the relevant deep-dive page

---

## Interview Preparation Roadmap

A structured 6-week plan for system design interview preparation, assuming 1-2 hours of study per day.

| Week | Focus Area | Topics to Study | Practice |
|------|-----------|-----------------|----------|
| 1 | Fundamentals | Networking (HTTPS, DNS, TCP/UDP), SQL vs NoSQL, CAP theorem, ACID vs BASE | Draw basic client-server architectures |
| 2 | Building Blocks | Caching strategies, message queues, consistent hashing, load balancing algorithms | Design a simple cache layer |
| 3 | Distributed Systems | Consensus (Raft), leader election, distributed transactions (2PC, Saga), distributed locks | Explain how ZooKeeper works |
| 4 | Case Studies (Medium) | URL shortener, rate limiter, notification system, search autocomplete | 35-min timed practice per problem |
| 5 | Case Studies (Hard) | Chat system, news feed, payment system, video streaming, ride sharing | 35-min timed practice per problem |
| 6 | Mock Interviews | Review all concepts, practice articulation, refine trade-off discussions | Mock with a partner or record yourself |

**Tips for each week:**

- **Week 1-3**: Focus on understanding, not memorization. Draw diagrams. Explain concepts out loud.
- **Week 4-5**: Practice under time pressure. You should be able to produce a coherent design in 35 minutes.
- **Week 6**: Focus on communication. The best candidates narrate their thinking process clearly.

---

## Quick Recall — System Design Concepts

Use this table for rapid review before interviews. Each concept is distilled to its essential one-line definition.

| Concept | One-Line Definition |
|---------|-------------------|
| CAP Theorem | During a network partition, a distributed system must choose between consistency and availability |
| Consistent Hashing | Hash ring that minimizes key remapping when nodes are added or removed |
| Sharding | Splitting data across multiple databases by a partition key to scale horizontally |
| Replication | Maintaining copies of data on multiple nodes for fault tolerance and read scaling |
| Leader Election | Process by which distributed nodes choose a single coordinator to avoid conflicts |
| Consensus | Agreement protocol (Paxos, Raft) ensuring all nodes agree on a value despite failures |
| Write-Ahead Log | Append-only log written before data modification, enabling crash recovery |
| Bloom Filter | Space-efficient probabilistic structure that tests set membership with possible false positives |
| Circuit Breaker | Pattern that stops calling a failing service, allowing it time to recover |
| Rate Limiting | Controlling request throughput to protect services from overload |
| Load Balancing | Distributing traffic across multiple servers to improve throughput and availability |
| CDN | Geographically distributed cache that serves static content from the nearest edge server |
| Reverse Proxy | Server-side intermediary that handles SSL termination, caching, and request routing |
| Message Queue | Asynchronous buffer between producers and consumers, enabling decoupling and backpressure |
| Idempotency | Property where repeating an operation produces the same result as executing it once |
| Eventual Consistency | Guarantee that all replicas converge to the same state given enough time without new writes |
| Strong Consistency | Every read returns the most recent write, regardless of which replica serves the request |
| Two-Phase Commit | Distributed transaction protocol: prepare phase + commit/abort phase across participants |
| Saga Pattern | Long-running transaction split into local transactions with compensating actions on failure |
| Fan-out on Write | Push model: precompute results at write time (e.g., distribute posts to follower feeds) |
| Fan-out on Read | Pull model: compute results at read time (e.g., merge posts from followed users on request) |
| Heartbeat | Periodic signal sent between nodes to detect failures via absence of expected messages |
| Gossip Protocol | Epidemic-style protocol where nodes share state with random peers, eventually reaching all nodes |
| Service Discovery | Mechanism for services to find network locations of other services dynamically |
| Distributed Lock | Mutual exclusion primitive that works across multiple nodes (Redlock, ZooKeeper) |
| Back-of-Envelope | Quick order-of-magnitude calculation to validate feasibility of a design |
| Horizontal Scaling | Adding more machines to handle increased load (scale out) |
| Vertical Scaling | Adding more CPU/RAM to an existing machine (scale up) — has hard limits |
| Latency vs Throughput | Latency is time per request; throughput is requests per unit time — optimizing one may hurt the other |
| SLA/SLO/SLI | Service Level Agreement/Objective/Indicator — contractual and measured reliability targets |
| Hot Spot | Uneven load distribution where one shard/node receives disproportionate traffic |
| Snowflake ID | 64-bit ID encoding timestamp + machine ID + sequence, enabling distributed generation without coordination |
| CQRS | Command Query Responsibility Segregation — separate models for read and write operations |
| Event Sourcing | Storing state changes as an immutable sequence of events rather than current state |
| Backpressure | Mechanism for a slow consumer to signal a fast producer to reduce send rate |
| Dead Letter Queue | Queue for messages that cannot be processed after maximum retry attempts |
| Fencing Token | Monotonically increasing token that prevents stale lock holders from making writes |

---

## Common Mistakes in System Design Interviews

Avoid these pitfalls that consistently cause candidates to receive "no hire" decisions:

**1. Diving into details without clarifying requirements.**
Starting to draw databases and caches before understanding the problem scope signals that you cannot manage ambiguity. Always spend 3-5 minutes asking clarifying questions.

**2. Ignoring back-of-envelope estimation.**
If you design a system that stores 100 TB in a single PostgreSQL instance, the interviewer will question your practical experience. Quick math prevents obviously infeasible designs.

**3. Designing for Google scale from the start.**
Not every system needs 10 million QPS. Start with a simple design that works, then scale iteratively. Over-engineering at the start wastes precious interview time.

**4. Not discussing trade-offs.**
Every design decision has a cost. If you choose eventual consistency, acknowledge that users may see stale data. If you add a cache, discuss invalidation complexity. Interviewers reward nuanced thinking.

**5. Using buzzwords without understanding.**
Saying "we'll use Kafka" without explaining why (ordering guarantees, consumer groups, retention) or when a simpler queue would suffice suggests superficial knowledge.

**6. Neglecting failure scenarios.**
What happens when a node crashes? When the network partitions? When the database is unavailable? Production systems must handle failures gracefully, and your design should address this.

**7. Forgetting about data consistency.**
In distributed systems, data can become inconsistent across replicas or services. You must explicitly state your consistency model and explain how you handle conflicts.

**8. Poor time management.**
Spending 20 minutes on database schema leaves no time for the interesting distributed systems discussion. Practice with a timer to develop pacing intuition.

**9. Not considering monitoring and observability.**
Production systems need metrics, logging, and alerting. Mentioning how you'd monitor your system (latency percentiles, error rates, queue depths) demonstrates operational maturity.

**10. Presenting a single solution without alternatives.**
Senior engineers evaluate multiple approaches before choosing one. Briefly mention alternatives you considered and why you rejected them — this demonstrates breadth of knowledge.

---

## Behavioral Tips for System Design Interviews

Beyond technical knowledge, how you communicate matters significantly:

- **Think out loud.** The interviewer is evaluating your thought process, not just the final diagram. Narrate your reasoning as you make decisions.
- **Drive the conversation.** Don't wait for the interviewer to ask "what about caching?" Proactively introduce components and explain why they're needed.
- **Use concrete numbers.** Instead of "this will be fast," say "with a Redis cache, p99 latency drops from 50ms to 2ms for cached queries."
- **Draw clear diagrams.** Label every arrow with the protocol or data flowing through it. Use boxes for services, cylinders for databases, and clouds for external systems.
- **Acknowledge unknowns.** If you're unsure about something, say "I'm not certain about the exact threshold, but my approach would be..." Honesty is valued over bluffing.
- **Summarize periodically.** After completing a section, briefly recap what you've covered. This helps the interviewer follow your design and signals structured thinking.

---

## Recommended Study Resources

- **"Designing Data-Intensive Applications" by Martin Kleppmann** — The definitive book on distributed systems concepts. Chapters 5-9 are especially relevant.
- **"System Design Interview" by Alex Xu (Vol 1 & 2)** — Practical walkthrough of common interview questions with diagrams.
- **MIT 6.824: Distributed Systems** — Lecture videos covering Raft, MapReduce, and fault tolerance with academic rigor.
- **The Google SRE Book (free online)** — Real-world operational concerns: monitoring, incident response, capacity planning.
- **RFC documents** — Reading RFCs for protocols you mention (HTTP/2, gRPC, WebSocket) demonstrates deep understanding.

---

---

## Frequently Asked Questions

??? question "What system design topics are most commonly asked at FAANG companies?"

    The most frequently asked topics are: URL shortener (entry-level), chat/messaging systems, news feed/timeline, notification systems, rate limiter, distributed cache, and video streaming platforms. Senior roles additionally face: payment systems, search autocomplete, ride-sharing, and distributed file storage. All require understanding of scalability, availability, consistency trade-offs, and back-of-envelope estimation.

??? question "How do you estimate scale in a system design interview?"

    Use back-of-envelope estimation: start with DAU (Daily Active Users), derive QPS (queries per second = DAU × actions/day / 86400), calculate storage (users × data per user × retention), and bandwidth (QPS × avg response size). Key numbers to memorize: 1 day = 86,400 seconds, 1 million requests/day ≈ 12 QPS, 1 byte of ASCII = 1 char, and 1 GB of RAM can hold ~250 million integers.

??? question "What is the CAP theorem and how does it affect system design?"

    CAP theorem states that a distributed system can guarantee at most two of three properties: Consistency (all nodes see the same data), Availability (every request gets a response), and Partition tolerance (system works despite network failures). Since network partitions are unavoidable, you choose between CP (consistent but may reject requests) or AP (available but may serve stale data). Real systems use tunable consistency (e.g., Cassandra's quorum reads).

??? question "When should you use SQL vs NoSQL databases?"

    Use SQL (PostgreSQL, MySQL) when you need ACID transactions, complex joins, strong consistency, and structured data with clear relationships. Use NoSQL when you need horizontal scalability, flexible schema, high write throughput, or denormalized data access patterns. Common choices: DynamoDB/Cassandra for key-value at scale, MongoDB for document storage, Redis for caching, and Neo4j for graph relationships.

??? question "How do you design a system for high availability?"

    Key patterns: geographic redundancy (multi-region deployment), load balancing (distribute traffic across healthy nodes), database replication (primary-replica for reads, multi-primary for writes), circuit breakers (fail fast on unhealthy dependencies), graceful degradation (serve cached/partial data during outages), health checks with automatic failover, and chaos engineering to validate resilience. Target: 99.99% availability = ~52 minutes downtime per year.

??? question "What is the difference between horizontal and vertical scaling?"

    Vertical scaling (scale up) means adding more CPU/RAM/disk to a single machine — simpler but has hardware limits and creates a single point of failure. Horizontal scaling (scale out) means adding more machines — supports virtually unlimited growth but adds complexity (data partitioning, consistency, service discovery). Most interview answers should favor horizontal scaling with stateless services, sharded databases, and distributed caches.

---

## Company-Wise Topics: What Gets Asked Where

| Company | Top System Design Questions | What They Care About |
|---|---|---|
| **Google** | Search Autocomplete, Web Crawler, YouTube, Google Maps, Google Drive, GFS, Pub/Sub | Billion-user scale, distributed systems depth, elegant data pipelines |
| **Amazon** | E-commerce Orders, Warehouse Mgmt, Recommendations, Rate Limiter, KV Store | Availability > consistency, event-driven, operational excellence |
| **Meta** | News Feed, Messenger, Instagram Stories, Live Video, Notifications, Social Graph | Fan-out at scale, real-time delivery, content ranking |
| **Microsoft** | OneDrive, Teams (Chat + Video), Bing Search, Azure LB, Distributed Cache | Enterprise reliability, multi-tenant, backward compatibility |
| **Apple** | iMessage, iCloud, App Store, AirDrop, Find My, Apple Music | Privacy-first (E2E encryption), device sync, UX-driven |
| **Netflix** | Video Streaming, CDN Design, Recommendations, A/B Testing, Chaos Engineering | Availability, adaptive bitrate, global CDN, fault tolerance |
| **Uber** | Ride Matching, ETA, Surge Pricing, Location Tracking, Payment, Food Delivery | Geospatial, real-time matching, dynamic pricing |
| **Stripe** | Payment Processing, Idempotency, Rate Limiter, Webhooks, Ledger, Fraud Detection | Exactly-once, financial correctness, API design |
| **Salesforce** | Multi-Tenant Platform, CRM Data Model, Workflow Engine, Event Bus, API Gateway, Metadata-Driven Architecture | Multi-tenancy at scale, governor limits, tenant isolation, platform extensibility |
| **Walmart** | Inventory Mgmt, Order Fulfillment, Price Matching, Cart/Checkout, Supply Chain, Real-Time Stock | Inventory accuracy, omnichannel (online + 4700 stores), high-volume transactions |

!!! tip "How to Adapt Your Answer by Company"
    - **Google/Meta**: Start with scale numbers (DAU, QPS). They expect you to handle billions.
    - **Amazon**: Emphasize availability, event-driven architecture, and operational simplicity.
    - **Stripe/Salesforce**: Focus on correctness, idempotency, and multi-tenant isolation.
    - **Netflix/Uber**: Highlight resilience patterns (circuit breakers, graceful degradation, chaos testing).
    - **Walmart**: Address inventory consistency across online + physical stores.
    - **Apple/Microsoft**: Privacy, encryption, and enterprise-grade reliability.

---

## See Also

- [Microservices Architecture](../microservices/microservices.md) — Decomposition patterns, service communication, and operational concerns
- [API Design](../apidesign/apidesign.md) — REST principles, versioning, pagination, and error handling
- [GraphQL](../graphql/graphql.md) — Query language for APIs, schema design, and when to prefer over REST
- [Spring Boot WebFlux](../springboot/webflux.md) — Reactive programming for high-throughput services
