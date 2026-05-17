# Top 40 Microservices Interview Questions & Answers

A comprehensive set of interview questions covering microservices architecture, patterns, communication, resilience, data management, observability, deployment, and security. Each answer is concise and interview-ready.

---

## Fundamentals

??? question "Q1: What are microservices?"

    **Answer:** Microservices is an architectural style that structures an application as a collection of small, autonomous services organized around business capabilities.

    **Why:** Monoliths become deployment bottlenecks as teams grow. Microservices let teams ship independently without coordinating full releases, enabling organizational scaling through Conway's Law alignment.

    **How:** Each service runs in its own process, owns its data store, communicates over lightweight protocols (REST, gRPC, or messaging), and is deployed independently. Services are bounded by a single business capability -- an Order Service does not know how payments work internally.

    **When to use:** When you have multiple teams needing independent release cadences, different scaling requirements per domain, or polyglot needs (Java for transactions, Python for ML pipelines).

    **Gotchas:**

    - Microservices do not fix bad architecture -- they amplify it. If your module boundaries are wrong, you get a distributed monolith with network calls instead of method calls.
    - The "micro" is about scope of responsibility, not lines of code. A 5000-line service is fine if it owns one bounded context.
    - You trade in-process complexity for operational complexity -- you need CI/CD, observability, and container orchestration as table stakes.

??? question "Q2: Monolith vs Microservices -- what are the key differences?"

    **Answer:** A monolith deploys as one unit with shared memory; microservices deploy as independent processes communicating over the network.

    **Why this matters:** The choice determines your deployment velocity, failure blast radius, and team autonomy. It is fundamentally an organizational decision as much as a technical one.

    **How they differ:**

    | Aspect | Monolith | Microservices |
    |---|---|---|
    | Deployment | Single deployable unit | Each service deployed independently |
    | Scaling | Scale entire application | Scale individual services |
    | Technology | Single tech stack | Polyglot (mix of languages/frameworks) |
    | Data | Single shared database | Database per service |
    | Team structure | Large team, one codebase | Small teams per service (2-pizza rule) |
    | Fault isolation | One bug can bring down everything | Failure contained to the service |
    | Communication | In-process method calls | Network calls (HTTP, gRPC, messaging) |

    **When to pick monolith:** Startups, small teams, unclear domain boundaries, or when you simply need to ship fast. A well-structured monolith (modular monolith) can evolve into microservices later.

    **Gotchas:** Many teams end up with a "distributed monolith" -- they split into services but still deploy them together because of tight coupling. You get the worst of both worlds: network latency plus coordinated releases.

??? question "Q3: What are the advantages of microservices?"

    **Answer:** The core advantage is independent deployability -- teams ship features on their own cadence without coordinating with the rest of the organization.

    **Why it matters:** In a monolith, a single broken test or merge conflict blocks everyone. Microservices remove that coordination tax.

    **How the benefits compound:**

    1. **Independent deployment** -- one team ships 10x/day without waiting on others
    2. **Granular scaling** -- scale the search service to 50 pods while checkout stays at 5
    3. **Technology freedom** -- use Go for high-throughput ingestion, Python for ML inference
    4. **Fault isolation** -- a memory leak in recommendations does not crash the payment flow
    5. **Team autonomy** -- small teams (2-pizza rule) own build, deploy, and on-call for their service
    6. **Faster experimentation** -- try a new database or framework in one service; if it fails, blast radius is contained

    **When these benefits are real:** At scale (50+ engineers, multiple teams), with mature DevOps practices.

    **Gotchas:** These advantages only materialize if service boundaries are correct. Poorly drawn boundaries mean every feature requires coordinated changes across 4 services -- worse than a monolith. Also, "technology freedom" can become "technology chaos" without governance.

??? question "Q4: What are the disadvantages of microservices?"

    **Answer:** You trade code complexity for operational complexity -- every method call becomes a network call that can fail, be slow, or return stale data.

    **Why this bites teams:** Distributed systems are fundamentally harder to reason about. The fallacies of distributed computing (network is reliable, latency is zero) become your daily problems.

    **How the pain shows up:**

    1. **Distributed system complexity** -- partial failures, network partitions, message ordering issues
    2. **Data consistency** -- no ACID across services; you live with eventual consistency and sagas
    3. **Operational overhead** -- each service needs its own CI/CD pipeline, monitoring dashboard, and on-call runbook
    4. **Testing difficulty** -- integration tests require spinning up service dependencies or maintaining stubs
    5. **Debugging** -- a single user request might span 12 services; without distributed tracing, you are blind
    6. **DevOps maturity required** -- without CI/CD, containers, and observability, microservices become unmanageable chaos

    **When to accept the cost:** When the benefits (independent deployment, team autonomy) outweigh the distributed systems tax.

    **Gotchas:** The cost is front-loaded (infra investment) while the benefits are back-loaded (realized at scale). Teams that adopt microservices too early spend more time on plumbing than product.

??? question "Q5: When should you NOT use microservices?"

    **Answer:** Do not use microservices when the coordination cost exceeds the autonomy benefit -- which is most early-stage projects.

    **Why this question matters:** Interviewers ask this to see if you can resist hype. Knowing when NOT to use a tool shows deeper understanding than knowing when to use it.

    **How to decide -- avoid microservices when:**

    - **Team is small** (fewer than 8 developers) -- one team does not need inter-team autonomy
    - **Domain is unclear** -- you cannot draw good service boundaries without understanding the domain; premature splitting creates expensive mistakes
    - **Low complexity** -- a CRUD app with 5 entities does not justify Kubernetes, service mesh, and distributed tracing
    - **Tight latency budgets** -- each network hop adds 1-5ms; a 10-service call chain adds 10-50ms
    - **No DevOps maturity** -- without CI/CD, container orchestration, and observability, you are building on sand

    **When to transition:** Start with a modular monolith (clear module boundaries, separate packages), then extract services when a module needs independent scaling or a different release cadence.

    **Gotchas:** *"If you can't build a well-structured monolith, you won't be able to build microservices."* Teams often split prematurely, then spend 6 months wiring up infrastructure instead of shipping features.

---

## Decomposition & Domain Design

??? question "Q6: How do you decompose a monolith into microservices?"

    **Answer:** Decompose incrementally using domain boundaries as your guide -- never attempt a big-bang rewrite.

    **Why incremental:** Big rewrites fail because you are rebuilding a moving target. Meanwhile the monolith keeps evolving and the new system never catches up (the "second system effect").

    **How -- two proven strategies:**

    **1. Strangler Fig Pattern:** Route traffic through a proxy. New features go to the new service; existing flows stay in the monolith. Over time the monolith shrinks to zero.

    **2. Domain-Driven Design (DDD):** Run event storming workshops to identify bounded contexts. Each bounded context with a distinct data model and team ownership becomes a service candidate.

    **When to extract (practical steps):**

    1. Identify seams -- modules with minimal cross-cutting dependencies
    2. Extract the module with the clearest boundary and highest deployment friction first
    3. Create an anti-corruption layer so the new service does not inherit monolith data models
    4. Migrate data ownership -- the hardest step; dual-write then cut over
    5. Repeat, gaining confidence with each extraction

    **Gotchas:** Data is the hardest part. Extracting code is straightforward; untangling shared database tables with 50 foreign keys is where migrations stall. Start with services that own their own tables cleanly.

??? question "Q7: What is a Bounded Context in DDD and why does it matter for microservices?"

    **Answer:** A Bounded Context is an explicit boundary within which a domain model has a specific, unambiguous meaning -- it is the single best heuristic for drawing service boundaries.

    **Why it matters:** Without bounded contexts, teams share domain models across services, creating invisible coupling. When the Order team changes the `Customer` object, the Shipping service breaks -- you have a distributed monolith.

    **How it works:** Different contexts can use the same term with different meanings. "Account" in the Identity context means a user profile; in Billing it means a financial ledger. Each context owns its own model, and translation happens at the boundary through anti-corruption layers or published events.

    **When to apply:** During domain modeling, especially event storming sessions. Map one bounded context to one service (or a small cluster of tightly related services). Communication between contexts is always through well-defined APIs or events, never shared databases.

    **Gotchas:**

    - Bounded contexts are not technical boundaries (UI, DB, API) -- they are business boundaries. Splitting by layer (service-per-entity) creates chatty services.
    - Getting boundaries wrong is expensive. If two "services" always change together, they are one bounded context and should be merged.
    - Context maps (upstream/downstream relationships) matter as much as the boundaries themselves.

??? question "Q8: Explain the Strangler Fig migration pattern in detail."

    **Answer:** The Strangler Fig incrementally replaces a monolith by routing traffic through a proxy that gradually shifts requests from old code to new services.

    **Why:** Big-bang rewrites are high risk and historically fail. The Strangler Fig lets you ship value continuously while migrating -- the monolith keeps running and you never have a "flag day" cutover.

    **How it works:**

    ```
    [Client] --> [API Gateway / Proxy]
                     |            |
               [New Service]  [Monolith]
    ```

    1. **Identify** a module to extract (pick one with clear API boundaries)
    2. **Build** the new microservice with its own data store
    3. **Intercept** -- place a routing facade (API Gateway or reverse proxy)
    4. **Redirect** -- route specific endpoints to the new service; everything else stays in the monolith
    5. **Migrate** -- shift traffic gradually (canary or percentage-based)
    6. **Remove** -- delete dead code from the monolith once traffic is fully migrated

    **When to use:** Any monolith-to-microservices migration where you cannot afford downtime or a feature freeze.

    **Gotchas:**

    - The proxy becomes a critical path -- make it stateless and highly available
    - Data migration is the hidden complexity; you often need a dual-write phase or CDC (Change Data Capture) during transition
    - Teams sometimes "strangle" the easy parts and leave the gnarly core forever, creating a zombie monolith

---

## Inter-Service Communication

??? question "Q9: Synchronous vs asynchronous communication -- when to use which?"

    **Answer:** Use synchronous when you need an answer right now; use asynchronous when you need reliability and decoupling more than immediacy.

    **Why both exist:** Synchronous is simple to reason about but creates temporal coupling -- if the downstream is down, you are down. Asynchronous decouples availability at the cost of eventual consistency and harder debugging.

    **How they compare:**

    | Aspect | Synchronous (Request/Response) | Asynchronous (Event/Message) |
    |---|---|---|
    | Mechanism | HTTP/REST, gRPC | Message broker (Kafka, RabbitMQ) |
    | Coupling | Temporal coupling (caller waits) | Loose coupling (fire and forget) |
    | Latency | Immediate response | Eventually processed |
    | Use when | Query data, real-time response needed | Background tasks, event notifications, long-running workflows |
    | Failure handling | Caller must handle timeout/retry | Broker provides durability, retries |

    **When to use which:** Synchronous for user-facing queries ("show me my order status"). Asynchronous for commands and events ("process this payment", "order was placed"). Many flows combine both: synchronous acknowledgment ("we received your order") followed by asynchronous processing.

    **Gotchas:**

    - Chains of synchronous calls amplify latency and failure probability multiplicatively (99.9%^10 = 99%)
    - Async does not mean "fire and forget" -- you still need dead-letter queues, retry policies, and poison-message handling
    - Debugging async flows requires correlation IDs and distributed tracing; without them, messages vanish into the void

??? question "Q10: REST vs gRPC vs messaging -- how do you choose?"

    **Answer:** Use REST for external/public APIs, gRPC for internal service-to-service calls where latency matters, and messaging for event-driven decoupled workflows.

    **Why multiple options:** No single protocol optimizes for all dimensions -- human readability, performance, decoupling, and streaming have different winners.

    **How they compare:**

    - **REST (HTTP/JSON):** Human-readable, universally supported, great tooling (Postman, curl). Best for public APIs and browser clients. Downside: verbose payloads (10x larger than Protobuf), no built-in streaming, no code generation.
    - **gRPC (HTTP/2 + Protobuf):** Binary serialization (70% smaller payloads), bidirectional streaming, strict contracts via `.proto` files with code generation. Best for internal high-throughput calls. Downside: not browser-friendly without envoy/grpc-web proxy, harder to debug without tooling.
    - **Messaging (Kafka/RabbitMQ):** Decoupled pub/sub, durable, supports replay (Kafka). Best for event-driven architectures, fan-out to multiple consumers. Downside: eventual consistency, harder to debug, operational overhead of running a broker.

    **When to combine:** Most production systems use all three -- REST at the edge, gRPC between internal services for queries, Kafka for domain events.

    **Gotchas:**

    - gRPC's strict schema is a feature, not a limitation -- it catches breaking changes at compile time
    - REST over-fetching can be solved with GraphQL at the BFF layer, but adds its own complexity
    - Messaging without schema registry (Avro/Protobuf) leads to producer/consumer desync that is painful to debug in production

---

## API Gateway & Service Discovery

??? question "Q11: What is the API Gateway pattern and what are its responsibilities?"

    **Answer:** An API Gateway is a reverse proxy that serves as the single entry point for all client requests, handling cross-cutting concerns before traffic reaches your services.

    **Why:** Without a gateway, every service must independently implement auth, rate limiting, TLS, and CORS. The gateway centralizes these concerns, keeping services focused on business logic.

    **How -- its responsibilities:**

    - **Request routing** -- routes to the correct downstream service based on path/headers
    - **Authentication & authorization** -- validates JWT/OAuth2 tokens before forwarding
    - **Rate limiting & throttling** -- protects services from abuse (per-client, per-endpoint)
    - **Response aggregation** -- combines data from multiple services into one client response (BFF pattern)
    - **Protocol translation** -- REST to gRPC, WebSocket upgrade
    - **SSL termination** -- handles TLS at the edge so internal traffic can be plain HTTP (or mTLS)
    - **Caching** -- short-circuits repeated identical requests

    **When to use:** Any microservices deployment with external clients. For internal service-to-service calls, a service mesh is more appropriate.

    **Gotchas:**

    - The gateway becomes a single point of failure -- it must be horizontally scaled and stateless
    - Avoid putting business logic in the gateway; it should be a thin routing/policy layer
    - Too much aggregation in the gateway creates a "smart pipe" anti-pattern; consider BFF (Backend for Frontend) per client type instead
    - Examples: Kong, AWS API Gateway, Spring Cloud Gateway, Envoy, NGINX

??? question "Q12: What is Service Discovery and why is it needed?"

    **Answer:** Service Discovery is the mechanism by which services locate each other dynamically in an environment where instances are ephemeral and IP addresses constantly change.

    **Why:** In a containerized world, service instances scale up/down, get rescheduled, and receive new IPs. Hardcoded addresses break instantly. You need a registry that tracks what is alive and where.

    **How -- two models:**

    - **Client-side discovery:** The client queries a service registry (Eureka, Consul) and picks an instance from the returned list using client-side load balancing. Gives the client full control but adds library dependency.
    - **Server-side discovery:** The client calls a stable DNS name or load balancer (Kubernetes Service, AWS ALB). The platform resolves to a healthy instance transparently. Simpler for the client but less control.

    **When to use which:** In Kubernetes, server-side discovery is built in (kube-dns + Services). If running outside K8s or needing advanced routing (weighted, canary), client-side with Consul or Eureka gives more flexibility.

    **Gotchas:**

    - Stale registrations cause calls to dead instances -- use health checks with short TTLs and heartbeat intervals
    - DNS-based discovery has TTL caching issues; some HTTP clients cache DNS aggressively and ignore short TTLs
    - In Kubernetes, headless Services give you client-side discovery semantics within the platform

??? question "Q13: How does load balancing work in microservices?"

    **Answer:** Load balancing distributes requests across multiple service instances to maximize throughput, minimize latency, and prevent any single instance from being overwhelmed.

    **Why:** With auto-scaling, you have N instances of a service. Without load balancing, one instance gets hammered while others sit idle. Proper distribution is essential for both performance and fault tolerance.

    **How -- two approaches:**

    - **Server-side (L4/L7):** A dedicated load balancer (NGINX, HAProxy, AWS ALB, Kubernetes Service via kube-proxy/iptables) sits in front of instances. The client talks to one stable endpoint. Simple, transparent to clients.
    - **Client-side:** The client library (Spring Cloud LoadBalancer, gRPC built-in) fetches instance lists from the registry and picks one. More control, fewer network hops, but adds client complexity.

    **Algorithms:** Round Robin (default, simple), Least Connections (best for uneven request durations), Weighted Round Robin (mixed-capacity fleet), Consistent Hashing (session affinity, cache-friendly routing), Random (surprisingly effective with many instances).

    **When to pick which:** Kubernetes gives you server-side for free. Use client-side when you need sticky sessions, zone-aware routing, or custom health-weighted logic.

    **Gotchas:**

    - gRPC over HTTP/2 multiplexes on one connection -- L4 load balancers see one connection and send all traffic to one backend. You need L7 balancing or client-side for gRPC.
    - Health-unaware round robin sends traffic to degraded instances; always combine with active health checks.

---

## Resilience Patterns

??? question "Q14: Explain the Circuit Breaker pattern and its states."

    **Answer:** A Circuit Breaker is a proxy that monitors downstream failures and short-circuits requests when the error rate crosses a threshold, preventing cascade failures and giving the downstream time to recover.

    **Why:** Without a circuit breaker, a failing downstream service causes request threads to pile up waiting for timeouts. This exhausts the thread pool and cascades the failure upstream -- one slow service takes down the entire system.

    **How -- three states (Resilience4j model):**

    ```
    [CLOSED] --failure threshold exceeded--> [OPEN]
    [OPEN] --wait duration expires--> [HALF_OPEN]
    [HALF_OPEN] --success threshold met--> [CLOSED]
    [HALF_OPEN] --failure occurs--> [OPEN]
    ```

    - **CLOSED:** Normal operation. Failures counted in a sliding window. If failure rate exceeds threshold (e.g., 50% of last 10 calls), transitions to OPEN.
    - **OPEN:** All requests fail fast with a fallback response. No calls hit the downstream. After wait duration (e.g., 30s), moves to HALF_OPEN.
    - **HALF_OPEN:** Allows a limited number of probe requests. If they succeed, the circuit closes. If they fail, it reopens.

    ```java
    @CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
    public PaymentResponse processPayment(PaymentRequest req) {
        return paymentClient.charge(req);
    }

    public PaymentResponse paymentFallback(PaymentRequest req, Throwable t) {
        return new PaymentResponse("PENDING", "Payment queued for retry");
    }
    ```

    **When to use:** Any call to an external dependency (databases, third-party APIs, downstream services) that can be slow or unavailable.

    **Gotchas:**

    - Tuning thresholds wrong causes either premature tripping (too sensitive) or no protection (too lenient). Start with 50% failure rate over a 10-call sliding window.
    - The fallback must be meaningful -- returning a cached result or queuing for retry is good; returning null and crashing downstream is not.
    - Monitor circuit state transitions; frequent OPEN states indicate a systemic issue, not a transient blip.

??? question "Q15: What are the Retry and Timeout patterns?"

    **Answer:** Retries handle transient failures by re-attempting failed calls; timeouts prevent threads from blocking indefinitely on unresponsive dependencies. Together, they form the baseline resilience of any distributed system.

    **Why:** Network blips, brief GC pauses, and temporary overloads are inevitable. Without retries, every transient hiccup becomes a user-facing error. Without timeouts, a stalled downstream silently consumes your thread pool until the whole service locks up.

    **How:**

    **Retry:**

    - Configure max attempts (3 is typical), backoff strategy (exponential with jitter)
    - **Exponential backoff with jitter** prevents thundering herd: `delay = baseDelay * 2^attempt + random(0, jitter)`
    - Only retry idempotent operations or specific error codes (503, 429, connection reset)

    **Timeout:**

    - **Connection timeout:** max time to establish TCP connection (e.g., 2s)
    - **Read timeout:** max time to wait for response data after connecting (e.g., 5s)
    - Always set both -- a missing timeout is a latency bomb

    **When to use together:** Retry up to 3 times, each with a 3-second timeout. Total worst-case latency: 3 retries x (3s timeout + backoff) -- make sure this fits within the caller's own timeout budget.

    **Gotchas:**

    - Retrying non-idempotent operations (POST /charge) causes double-charging. Only retry if you have an idempotency key.
    - Retry amplification: if every service in a 5-deep call chain retries 3x, the leaf service sees 3^5 = 243 requests from one user request. Use retry budgets.
    - Timeouts must be set at every layer (HTTP client, connection pool, database) -- one missing timeout negates all others.

??? question "Q16: What is the Bulkhead pattern?"

    **Answer:** The Bulkhead pattern isolates resource pools per dependency so that one slow or failing downstream cannot exhaust resources needed by others -- named after ship compartments that contain flooding.

    **Why:** Without isolation, a single slow dependency (e.g., inventory service with 30s response times) consumes all available threads in your service's pool. Suddenly, even calls to healthy services (payment, shipping) cannot get a thread -- total service failure from one bad dependency.

    **How -- two implementations:**

    - **Thread pool isolation:** Each downstream gets a dedicated thread pool (e.g., 10 threads for inventory, 10 for payment). If inventory's pool is saturated, payment calls are unaffected. More overhead but true isolation.
    - **Semaphore isolation:** Limits concurrent calls via a counter. Lighter weight (no thread context switching) but runs on the caller's thread, so a slow call still holds the calling thread.

    ```java
    @Bulkhead(name = "inventoryService", fallbackMethod = "inventoryFallback",
              type = Bulkhead.Type.THREADPOOL)
    public InventoryResponse checkStock(String sku) {
        return inventoryClient.getStock(sku);
    }
    ```

    **When to use:** Any service calling multiple downstream dependencies, especially if those dependencies have different reliability profiles.

    **Gotchas:**

    - Sizing the pools is an art -- too small and you throttle healthy traffic; too large and you lose the isolation benefit
    - Thread pool isolation adds latency from thread-hop overhead; for latency-sensitive paths, semaphore may be better
    - Combine with circuit breakers -- bulkheads contain the blast radius while the circuit breaker stops the bleeding

??? question "Q17: How does rate limiting work in microservices?"

    **Answer:** Rate limiting caps the number of requests a client or service can make within a time window, protecting backend services from overload, abuse, and noisy neighbors.

    **Why:** Without rate limits, a single misbehaving client (or a retry storm) can saturate your service, causing degradation for all users. Rate limiting enforces fairness and provides a safety valve.

    **How -- common algorithms:**

    - **Token Bucket:** Tokens refill at a steady rate (e.g., 100/sec). Each request consumes one token. Empty bucket = rejected. Allows controlled bursts up to bucket capacity. Most widely used (AWS, Stripe).
    - **Sliding Window Log:** Tracks exact timestamps of each request in a rolling window. Most accurate but memory-intensive.
    - **Sliding Window Counter:** Approximates by weighting the previous window's count. Good balance of accuracy and efficiency.
    - **Fixed Window:** Simple counter reset at interval boundaries. Can allow 2x burst at the boundary edge.

    **Where to apply:**

    - **API Gateway** -- per-client limits (1000 req/min per API key), first line of defense
    - **Service level** -- protect internal services from noisy neighbor services
    - **Distributed rate limiting** -- Redis-backed counters shared across all gateway instances

    **When to use:** Always. Every public API and every internal service should have rate limits, even if generous.

    **Gotchas:**

    - Rate limiting without returning proper `429 Too Many Requests` with `Retry-After` headers causes clients to blindly retry, making things worse
    - Fixed window allows 2x burst at boundaries (999 requests at 0:59, 1000 at 1:00) -- use sliding window for strict enforcement
    - Distributed rate limiting with Redis adds a network round-trip per request; consider local rate limiting with periodic sync for high-throughput paths

---

## Distributed Transactions & Data Patterns

??? question "Q18: Explain the Saga pattern -- orchestration vs choreography."

    **Answer:** The Saga pattern manages distributed transactions by breaking them into a sequence of local transactions with compensating actions for rollback -- no distributed locks, no two-phase commit.

    **Why:** In microservices you cannot wrap calls to 5 databases in one ACID transaction. Sagas give you eventual consistency with explicit failure handling, which is the only practical approach at scale.

    **How -- two coordination styles:**

    **Orchestration:** A central saga orchestrator drives the workflow step by step.

    ```
    [Orchestrator] --> [Order Service]: Create order
    [Orchestrator] --> [Payment Service]: Charge payment
    [Orchestrator] --> [Inventory Service]: Reserve stock
    If payment fails:
    [Orchestrator] --> [Order Service]: Cancel order (compensate)
    ```

    **Choreography:** No coordinator. Each service reacts to events and publishes its own.

    ```
    [Order Service] --OrderCreated--> [Payment Service]
    [Payment Service] --PaymentCharged--> [Inventory Service]
    [Payment Service] --PaymentFailed--> [Order Service] (compensate)
    ```

    | Aspect | Orchestration | Choreography |
    |---|---|---|
    | Control | Centralized (orchestrator) | Decentralized (events) |
    | Coupling | Services coupled to orchestrator | Services coupled to events |
    | Visibility | Easy to track saga state | Harder to trace full flow |
    | Best for | Complex, multi-step workflows | Simple, few-service workflows |

    **When to use which:** Orchestration for workflows with 4+ steps, conditional branching, or where you need clear visibility of saga state. Choreography for simple 2-3 service flows where adding a coordinator is overkill.

    **Gotchas:**

    - Compensating actions are not always possible (you cannot unsend an email). Design for this upfront with "pending" states.
    - Choreography with 6+ services becomes an invisible spaghetti of event chains -- no one can reason about the full flow
    - The orchestrator itself must be resilient (persist saga state) or it becomes a single point of failure

??? question "Q19: Two-Phase Commit vs Saga -- why prefer Saga in microservices?"

    **Answer:** Sagas win in microservices because 2PC requires all participants to hold locks simultaneously, which contradicts the independence and resilience goals of the architecture.

    **Why 2PC fails at scale:**

    - **Blocking protocol** -- all participants lock resources during prepare phase, waiting for the coordinator's decision. One slow participant blocks everyone.
    - **Single point of failure** -- if the coordinator crashes between prepare and commit, all participants are stuck holding locks indefinitely.
    - **Tight coupling** -- requires all services to be available at the exact same moment, which is unrealistic with independent deployment and scaling.
    - **Latency** -- two network round-trips across all participants; does not scale beyond 2-3 participants.

    **How Saga solves this:**

    - Each service commits its local transaction independently (no global locks)
    - Compensating transactions explicitly undo previous steps on failure
    - Non-blocking -- services process at their own pace
    - Provides eventual consistency, which is acceptable for most business workflows

    **When 2PC is still valid:** Within a single service that owns multiple database resources (e.g., writing to a DB and a message outbox atomically). Cross-service? Always Saga.

    **Gotchas:**

    - Sagas trade consistency for availability -- you must design for intermediate states being visible to users (e.g., "order processing" state)
    - Compensating transactions must be idempotent because they may be triggered multiple times
    - 2PC can work across 2 databases in a single JVM (JTA/XA) but never across service boundaries in production microservices

??? question "Q20: What is CQRS and when should you use it?"

    **Answer:** CQRS (Command Query Responsibility Segregation) splits your application into separate write and read models, each with its own data store optimized for its access pattern.

    **Why:** In many systems, reads vastly outnumber writes (100:1) and require different data shapes (denormalized, pre-joined). Forcing both through one normalized model creates either slow reads or complex writes. CQRS lets each side optimize independently.

    **How it works:**

    ```
    [Client] --Command--> [Write Service] --> [Write DB (normalized)]
                                          --> [Event Bus]
    [Client] --Query--> [Read Service] --> [Read DB (denormalized/materialized views)]
                                       <-- [Event Bus] (keeps read model in sync)
    ```

    The write side validates business rules and emits events. The read side consumes events to build materialized views optimized for specific query patterns. They can use completely different databases (Postgres for writes, Elasticsearch for reads).

    **When to use:**

    - Read/write ratio is heavily skewed (dashboards, reporting, search)
    - Read and write models have fundamentally different shapes
    - Combined with Event Sourcing for full audit trails and temporal queries

    **Gotchas:**

    - Adds eventual consistency between write and read sides -- the read model lags by milliseconds to seconds. UI must handle this (optimistic updates, "processing" indicators).
    - Doubles your data storage and operational surface area. For simple CRUD apps, this is pure overhead.
    - Rebuilding read projections from scratch (when you change the read model) can take hours for large event streams -- plan for this operationally.

??? question "Q21: What is Event Sourcing?"

    **Answer:** Event Sourcing persists every state change as an immutable event rather than overwriting current state -- your data is an append-only log of facts, and current state is derived by replaying them.

    **Why:** Traditional CRUD overwrites state, losing history forever. Event Sourcing gives you a complete audit trail, the ability to reconstruct state at any point in time, and the power to replay events to build new projections or fix bugs retroactively.

    **How it works:**

    ```
    Event Store:
    1. AccountCreated { id: 123, owner: "Alice" }
    2. MoneyDeposited { id: 123, amount: 500 }
    3. MoneyWithdrawn { id: 123, amount: 200 }

    Current State: Account 123, owner: Alice, balance: 300
    ```

    Events are immutable and append-only. Current state is rebuilt by replaying events from the beginning (or from a snapshot). Projections (read models) subscribe to the event stream and materialize views for queries.

    **When to use:** Financial systems (audit requirements), collaborative editing, systems where understanding "how we got here" is as important as "where we are." Natural fit with CQRS and event-driven architecture.

    **Gotchas:**

    - **Event schema evolution** is hard -- you cannot just ALTER a column. You need upcasters or versioned event handlers.
    - Replaying millions of events to rebuild state is slow without periodic snapshots.
    - Deleting data for GDPR compliance conflicts with "immutable events" -- you need crypto-shredding or tombstone events.
    - Not every service needs Event Sourcing. Using it for a simple settings service is massive over-engineering.

??? question "Q22: What is eventual consistency and how do you handle it?"

    **Answer:** Eventual consistency means all replicas converge to the same value given sufficient time, but reads immediately after a write may return stale data -- it is the default consistency model in microservices.

    **Why you must accept it:** Each service owns its database. When Service A publishes an event, Service B processes it asynchronously -- there is always a window (milliseconds to seconds) where the systems disagree. Strong consistency across services requires distributed locks, which kills availability and performance.

    **How to handle the inconsistency window:**

    - **Idempotent consumers** -- events may be delivered more than once; dedup by event ID
    - **Optimistic UI** -- show the user success immediately based on the command acceptance, reconcile if the backend rejects later
    - **Read-your-own-writes** -- after a write, route the user's subsequent reads to the primary (not a stale replica)
    - **Conflict resolution** -- last-write-wins (simple), vector clocks (complex), or domain-specific merge (CRDTs)
    - **Compensation** -- if inconsistency causes an invalid state (e.g., oversold inventory), trigger a corrective saga

    **When strong consistency is needed:** Use it within a single service boundary (local ACID transactions). Across services, eventual consistency with explicit handling is the pragmatic choice.

    **Gotchas:**

    - "Eventually" has no upper bound without SLAs -- define and monitor your replication lag
    - Users notice inconsistency more than engineers expect. A user who places an order and immediately sees "no orders" will call support.
    - Testing eventual consistency requires chaos engineering -- inject delays and duplicates in your test environments

??? question "Q23: What are the challenges of distributed transactions?"

    **Answer:** Distributed transactions are hard because you lose the safety net of ACID -- every failure mode that a local database handles transparently now becomes your application's responsibility.

    **Why this is fundamental:** The CAP theorem and network unreliability mean you cannot have atomic cross-service transactions without sacrificing availability. You must design around partial failures explicitly.

    **How the challenges manifest:**

    1. **No global ACID** -- cannot wrap calls to 5 databases in one transaction; must use sagas with compensating actions
    2. **Partial failures** -- Service A commits, Service B fails. The system is now in an inconsistent state that requires explicit resolution.
    3. **Ordering** -- events may arrive out of order over async channels; services must handle reordering or be order-agnostic
    4. **Idempotency** -- retries are inevitable in unreliable networks; every operation must be safe to execute multiple times
    5. **Visibility** -- tracking a multi-service transaction state requires correlation IDs, distributed tracing, and saga state persistence
    6. **Latency** -- each coordination step adds network round-trips; end-to-end latency grows linearly with saga steps
    7. **Data ownership** -- cross-service joins are impossible; you need API composition, CQRS projections, or event-carried state transfer

    **When to push back:** If a workflow truly requires atomicity across multiple data stores, consider whether those stores should be in the same service.

    **Gotchas:**

    - The Outbox pattern (write event to local DB in same transaction, then publish) solves the "write DB + publish event atomically" problem
    - Teams often underestimate compensation logic complexity -- it can be 50% of the business logic
    - Distributed transactions are where most microservice architectures fail in practice; get this right or merge services back together

---

## Observability & Configuration

??? question "Q24: How does distributed tracing work?"

    **Answer:** Distributed tracing propagates a unique trace ID across all service calls in a request's journey, creating a visual timeline that shows exactly where time is spent and where failures occur.

    **Why:** In a monolith, a stack trace shows you everything. In microservices, a single user request might hit 12 services. Without tracing, debugging "why is checkout slow?" is guesswork -- with tracing, you see that the inventory service took 800ms on the third hop.

    **How it works:**

    - **Trace:** The full journey of a request (e.g., checkout spanning 6 services)
    - **Span:** A single unit of work within a trace (e.g., "call payment service" = 120ms)
    - **Trace ID:** Unique identifier generated at the entry point, propagated via HTTP headers (`traceparent` in W3C format) across all services
    - **Parent-Child spans:** Show the call hierarchy and fan-out/fan-in patterns

    The first service (or API gateway) generates the trace ID. Each service creates a span with start/end timestamps, attaches the trace ID, and forwards it downstream. Spans are exported asynchronously to a collector that assembles the full trace.

    **When to use:** Always, in any microservices deployment. It is not optional -- it is your primary debugging tool.

    **Gotchas:**

    - Sampling is necessary at scale (trace 1% of requests) or storage costs explode. But always trace 100% of errors.
    - Async messaging breaks trace propagation unless you explicitly inject trace context into message headers
    - OpenTelemetry is the standard now -- avoid vendor lock-in by using OTel SDKs and exporting to your backend (Jaeger, Datadog, Tempo)
    - Traces without service-level SLO alerts are just archaeology -- combine tracing with latency budgets for proactive detection

??? question "Q25: What is centralized logging and why is the ELK stack popular?"

    **Answer:** Centralized logging aggregates logs from all services into a single searchable system, because grepping logs across 50 containers individually is operationally impossible.

    **Why:** Each service produces its own logs to stdout. Without aggregation, debugging requires SSH-ing into containers (which are ephemeral), correlating timestamps manually, and hoping the relevant container has not been recycled. Centralized logging makes this a single search query.

    **How -- the ELK stack:**

    - **Elasticsearch** -- stores and indexes logs (full-text search, aggregations)
    - **Logstash** (or lighter-weight **Fluentd**) -- ingests, parses, transforms, and routes log data
    - **Kibana** -- visualization, dashboards, and alerting

    Modern alternatives: Grafana Loki (label-based, cheaper storage), Datadog Logs, AWS CloudWatch Logs.

    **When to implement:** Day one. Centralized logging is not optional in microservices -- it is as foundational as a database.

    **Best practices:**

    - **Structured logging** (JSON) -- machine-parseable; never log unstructured text in production
    - **Correlation ID** in every log entry -- links logs across services for a single request
    - **Log levels** -- use them correctly (ERROR for actionable failures, WARN for degradation, INFO for business events, DEBUG off in prod)
    - **Retention policies** -- logs grow fast; tier hot/warm/cold storage and set TTLs

    **Gotchas:**

    - Logging sensitive data (PII, tokens) creates compliance nightmares -- sanitize at the shipping layer
    - High-cardinality fields (user IDs as log labels) can explode Elasticsearch index size and kill query performance
    - Do not log at DEBUG level in production "just in case" -- the volume will overwhelm your pipeline and cost a fortune

??? question "Q26: How do health checks and readiness probes work?"

    **Answer:** Health checks are periodic automated tests that tell the orchestrator whether a service instance is alive, ready for traffic, or still starting up -- they are how Kubernetes decides to restart, route, or wait.

    **Why:** Containers crash, deadlock, or lose database connections silently. Without probes, traffic keeps routing to broken instances and users see errors. Probes automate the detection and recovery that would otherwise require manual intervention.

    **How -- three probe types:**

    - **Liveness probe:** "Is the process alive and not deadlocked?" Failure triggers a container restart. Should be lightweight -- check that the event loop is responsive, not that downstream dependencies are up.
    - **Readiness probe:** "Can it handle traffic right now?" Failure removes it from the Service's endpoint list (no restart). Check: DB connections healthy, caches warmed, dependencies reachable.
    - **Startup probe:** "Has it finished initializing?" Prevents liveness from killing slow-starting services (JVM warmup, large cache loads).

    ```yaml
    livenessProbe:
      httpGet:
        path: /actuator/health/liveness
        port: 8080
      initialDelaySeconds: 15
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /actuator/health/readiness
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 5
    ```

    **When to use:** Every containerized service. No exceptions.

    **Gotchas:**

    - Never check downstream dependencies in liveness probes -- if the database is down, restarting your service does not fix it. You will create a restart loop.
    - Readiness probes that check external dependencies can cause cascading removal from load balancing during partial outages
    - Set `initialDelaySeconds` correctly for JVM apps (Spring Boot can take 30s+); too short triggers premature restarts

??? question "Q27: How is configuration managed in microservices?"

    **Answer:** Configuration in microservices is externalized from code and managed centrally, allowing runtime changes without redeployment across dozens of independently deployed services.

    **Why:** With 50 services across 4 environments, embedding config in code or property files means redeploying to change a timeout value. Externalized config enables dynamic tuning, environment-specific settings, and secret rotation without downtime.

    **How -- common approaches:**

    - **Spring Cloud Config Server:** Git-backed central server; services poll or receive push via `/actuator/refresh` or Spring Cloud Bus
    - **Consul / etcd:** Distributed key-value stores with watch capabilities for real-time updates
    - **Kubernetes ConfigMaps and Secrets:** Native injection via env vars or mounted volumes; changes require pod restart unless using a sidecar watcher
    - **AWS Parameter Store / Secrets Manager:** Cloud-native, encrypted at rest, integrates with IAM for access control

    **When to centralize:** When you have more than 5 services or need to change configuration without a full deployment cycle.

    **Best practices:**

    - Never hardcode secrets -- use Vault or cloud secret managers with automatic rotation
    - Support dynamic refresh without restarts for operational config (timeouts, feature flags, log levels)
    - Version control config via GitOps -- every config change is auditable and reversible
    - Use environment-specific profiles (dev/staging/prod) with a clear promotion path

    **Gotchas:**

    - The config server becomes a critical dependency -- if it is down during service startup, your services cannot boot. Cache last-known-good locally.
    - Kubernetes Secrets are base64-encoded, not encrypted at rest by default -- enable etcd encryption or use external secret operators
    - Dynamic config refresh without proper validation can take down an entire fleet simultaneously (bad timeout value = instant outage)

---

## Service Mesh & Sidecar

??? question "Q28: What is a Service Mesh and why use one?"

    **Answer:** A Service Mesh is a dedicated infrastructure layer that handles service-to-service communication by deploying sidecar proxies alongside every service, moving networking concerns out of application code entirely.

    **Why:** Without a mesh, every service must implement its own mTLS, retries, circuit breaking, and observability. This means duplicating resilience logic in Java, Go, Python, and Node services -- and hoping every team does it correctly. A mesh provides these capabilities uniformly, language-agnostically.

    **How -- two planes:**

    - **Data plane:** Sidecar proxies (Envoy) intercept all inbound/outbound traffic at the network level. Your service talks to localhost; the proxy handles the rest.
    - **Control plane:** Manages proxy configuration, pushes policies, and collects telemetry (Istio's `istiod`, Linkerd's control plane).

    **What it provides:** mTLS everywhere (zero-trust networking), traffic management (canary routing, traffic splitting, fault injection), automatic retries/circuit breaking/timeouts, distributed tracing injection, and fine-grained access control policies.

    **When to use:** 20+ services where consistent security and networking policies are critical, especially in multi-language environments where you cannot rely on a single library.

    **Gotchas:**

    - Adds ~2-5ms latency per hop (proxy processing) and significant memory overhead (one Envoy sidecar per pod, ~50-100MB each)
    - Debugging is harder -- failures can be in your code, the sidecar, or the control plane. Three places to look instead of one.
    - Istio's complexity is legendary; consider Linkerd for simpler use cases or ambient mesh (Istio without sidecars) for reduced overhead
    - Do not adopt a mesh for 5 services -- the operational burden far exceeds the benefit

??? question "Q29: What is the Sidecar pattern?"

    **Answer:** The Sidecar pattern deploys a helper container alongside your application in the same pod, handling cross-cutting infrastructure concerns without touching application code.

    **Why:** Cross-cutting concerns (TLS termination, log shipping, secret injection, health reporting) are identical across all services regardless of language. Implementing them in every service's codebase is duplication; a sidecar provides them once, language-agnostically, and updates independently.

    **How:** The sidecar shares the pod's network namespace (localhost communication) and filesystem (shared volumes). It starts alongside the app container and intercepts or augments traffic/data transparently.

    **Common use cases:**

    - **Networking proxy** (Envoy in Istio) -- handles mTLS, retries, circuit breaking, load balancing
    - **Log collection** (Fluentd/Filebeat sidecar) -- tails log files and ships to central system
    - **Config/Secret sync** (Vault Agent) -- fetches and refreshes secrets, writes to shared volume
    - **Auth** -- handles OAuth token refresh, injects auth headers into outbound requests

    **When to use:** When a concern is truly cross-cutting, identical across languages, and benefits from independent lifecycle management.

    **Gotchas:**

    - Each sidecar consumes memory and CPU -- at scale (1000 pods x 100MB per sidecar = 100GB of overhead). Right-size resource requests.
    - Startup ordering matters -- if the app starts before the Envoy sidecar is ready, outbound calls fail. Use `holdApplicationUntilProxyStarts` or init containers.
    - Debugging is harder: is the 503 from your app, the sidecar, or the remote sidecar? You need to check all three.
    - Kubernetes native sidecar containers (KEP-753, GA in 1.29) solve the startup/shutdown ordering problem that plagued earlier approaches.

---

## Data Management

??? question "Q30: What is the Database per Service pattern?"

    **Answer:** Each microservice owns a private database that no other service can access directly -- all data access goes through the service's API, enforcing encapsulation at the data layer.

    **Why:** A shared database is the fastest way to create a distributed monolith. If Service B reads Service A's tables directly, any schema change in A breaks B. You lose independent deployability, which is the entire point of microservices.

    **How it works:**

    - Each service has its own schema/database instance (separate Postgres databases, or even different engines entirely)
    - Polyglot persistence: use the best store for each workload -- PostgreSQL for orders (ACID), Redis for sessions (speed), Elasticsearch for search (full-text), DynamoDB for high-write event logs
    - Data that other services need is exposed via API or published as events

    **When to apply:** Always in a true microservices architecture. It is not optional -- it is a defining characteristic.

    **Gotchas:**

    - **Cross-service queries** are the main pain point. You cannot JOIN across services. Solutions: API composition (call multiple services and merge), CQRS projections (pre-materialized views), or event-carried state transfer (each service caches what it needs).
    - **Data duplication** is expected and acceptable -- each service maintains its own view of shared concepts (e.g., Order service stores customer name locally, not just customer_id).
    - **Distributed transactions** require the Saga pattern -- you lose the safety of a single-DB transaction.
    - Teams often resist this pattern because "it is wasteful" -- but the coupling cost of a shared DB far exceeds the storage cost of duplication.

??? question "Q31: Why is a shared database considered an anti-pattern?"

    **Answer:** A shared database creates invisible coupling between services -- you get the operational complexity of microservices with none of the independence benefits. It is the textbook distributed monolith.

    **Why it is dangerous:**

    - **Tight coupling** -- a schema change by one team breaks other services at runtime with no compile-time warning
    - **No independent deployment** -- database migrations must be coordinated across all teams that read/write those tables
    - **Scaling bottleneck** -- all services compete for the same connection pool, CPU, and IOPS
    - **No technology freedom** -- locked to one database engine for all workloads (search, transactions, analytics)
    - **Unclear ownership** -- who owns the `users` table when 5 services read and 3 services write to it? Nobody owns it, which means nobody maintains it.

    **How to detect it:** If changing a database column requires coordination across multiple teams, you have a shared database problem.

    **When shared DB is acceptable:** As a temporary intermediate step during monolith migration (Strangler Fig). Also acceptable within a bounded context where multiple deployment units are really one logical service.

    **Gotchas:**

    - Teams often "solve" this by creating a shared "data service" that wraps the DB -- this is just a monolith with extra steps (and network latency)
    - Views and stored procedures that span service boundaries are shared-database coupling in disguise
    - The path out is event-driven replication: publish change events, let each service materialize its own read-optimized copy

---

## Event-Driven Architecture & Messaging

??? question "Q32: What is Event-Driven Architecture?"

    **Answer:** Event-Driven Architecture (EDA) is a design paradigm where services communicate by producing and consuming immutable events -- records of something that happened -- rather than making direct requests to each other.

    **Why:** Direct service-to-service calls create tight coupling: the producer must know about every consumer, and both must be available simultaneously. Events invert this -- the producer publishes a fact ("OrderPlaced"), and any number of consumers can react independently, now or later.

    **How -- the components:**

    - **Event producers** -- emit events when state changes (Order Service publishes `OrderPlaced`)
    - **Event broker** -- durable middleware that routes events (Kafka, RabbitMQ, SNS/SQS)
    - **Event consumers** -- subscribe and react (Notification service sends email, Analytics service updates dashboards)

    **Three event patterns:**

    - **Event notification** -- thin event with just an ID ("OrderPlaced: orderId=123"). Consumer calls back for details.
    - **Event-carried state transfer** -- fat event with full payload. Consumer has all data it needs, no callback required. Reduces coupling but increases event size.
    - **Event sourcing** -- events ARE the source of truth, not just notifications.

    **When to use:** When you need loose coupling, fan-out to multiple consumers, temporal decoupling, or event replay capabilities.

    **Gotchas:**

    - Event-driven systems are harder to reason about -- there is no linear call stack to follow. Invest in tooling (event catalog, schema registry, tracing).
    - "Event spaghetti" happens when every service publishes and consumes dozens of event types with no governance. Maintain an event catalog with ownership.
    - Ordering guarantees vary by broker -- Kafka guarantees order within a partition, RabbitMQ does not guarantee cross-queue ordering.

??? question "Q33: Kafka vs RabbitMQ -- when to use which?"

    **Answer:** Kafka is a distributed log for high-throughput event streaming with replay; RabbitMQ is a traditional message broker optimized for routing, task queues, and request-reply patterns.

    **Why they are different tools:** Kafka treats messages as a persistent log -- consumers read at their own pace and can replay. RabbitMQ treats messages as tasks to be consumed and acknowledged -- once processed, they are gone. This fundamental difference drives all other trade-offs.

    **How they compare:**

    | Aspect | Kafka | RabbitMQ |
    |---|---|---|
    | Model | Distributed log (append-only) | Message broker (queue-based) |
    | Retention | Configurable (days/weeks), replay | Deleted after acknowledgment |
    | Throughput | Very high (millions msg/sec per cluster) | High (tens of thousands/sec) |
    | Consumer model | Pull-based (consumer controls pace) | Push-based (broker delivers) |
    | Ordering | Guaranteed within a partition | Guaranteed within a queue |
    | Best for | Event streaming, sourcing, log aggregation, CDC | Task queues, request/reply, complex routing |

    **When to choose Kafka:** Event-driven architecture, multiple independent consumers for the same events, event replay for rebuilding state, high-throughput ingestion (logs, metrics, clickstreams).

    **When to choose RabbitMQ:** Work queues with exactly-once processing semantics, complex routing logic (topic/header exchanges), low-latency point-to-point messaging, request-reply patterns.

    **Gotchas:**

    - Kafka's partition count is set at topic creation and painful to change -- plan capacity upfront
    - RabbitMQ queues that grow unboundedly (slow consumers) cause memory pressure and broker instability
    - Kafka consumer group rebalancing causes brief processing pauses -- design for idempotent processing
    - Many teams use both: Kafka for event streaming between domains, RabbitMQ for internal task distribution within a service

---

## API Design & Testing

??? question "Q34: How do you ensure idempotency in microservice APIs?"

    **Answer:** An idempotent operation produces the same result regardless of how many times it is called -- this is non-negotiable in distributed systems where retries and duplicate deliveries are inevitable, not exceptional.

    **Why:** Network timeouts do not tell you whether the server processed the request. The client must retry, and the server must handle the duplicate safely. Without idempotency, a retried payment charges the customer twice.

    **How -- implementation strategies:**

    - **Idempotency key:** Client sends a unique key (UUID) in a header. Server stores the result keyed by this ID. On duplicate requests, returns the stored response without re-processing.
    - **Natural idempotency:** `PUT /orders/123` (full replace) and `DELETE /orders/123` are inherently idempotent. `POST` is not -- it needs explicit handling.
    - **Database constraints:** Unique constraints on `(payment_id, order_id)` prevent duplicate inserts at the DB level -- the cheapest safety net.
    - **Consumer deduplication:** Track processed message IDs in a dedup table; skip already-seen messages.

    ```
    POST /payments
    Headers: Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

    Server: Check if key exists in cache/DB
            -> If yes, return stored response
            -> If no, process payment, store result with key, return response
    ```

    **When to implement:** Every write endpoint in a microservice. Every message consumer. No exceptions.

    **Gotchas:**

    - Idempotency key storage needs a TTL (e.g., 24h) or it grows unbounded. But too short a TTL and late retries slip through.
    - The check-and-process must be atomic (use DB transactions or Redis SETNX) or you get race conditions between concurrent duplicate requests.
    - Idempotency is not the same as safety -- an idempotent DELETE is safe to retry, but a non-idempotent `POST /transfer` that moves money twice is catastrophic.

??? question "Q35: What is the CAP theorem and its implications for microservices?"

    **Answer:** The CAP theorem states that during a network partition, a distributed system must choose between consistency (all nodes see the same data) and availability (every request gets a response) -- you cannot have both simultaneously.

    **Why it matters for microservices:** Microservices communicate over the network, and network partitions are not theoretical -- they happen in production. Every service must explicitly decide: do I return stale data (AP) or return an error (CP) when I cannot reach my peers?

    **How to think about it:**

    - **Consistency (C):** Every read returns the most recent write -- or an error
    - **Availability (A):** Every request receives a non-error response -- but it may be stale
    - **Partition Tolerance (P):** System operates despite network splits between nodes

    Since partitions are unavoidable (P is not optional), the real choice is **CP vs AP** per operation.

    **When to choose which:**

    - **AP (most microservices):** Product catalog, search results, recommendations -- showing slightly stale data is better than showing an error
    - **CP (critical operations):** Account balance checks, inventory decrements, payment processing -- showing stale data causes real business harm (double-spending, overselling)
    - **Per-service trade-offs:** Different services in the same system can make different choices

    **Gotchas:**

    - CAP is about behavior during partitions, not during normal operation. During normal operation you can have all three.
    - PACELC extends CAP: even without partition, there is a latency/consistency trade-off. Replicating synchronously gives C but adds latency.
    - "Eventual" consistency has no guaranteed time bound unless you define SLAs -- "eventual" could mean 5ms or 5 minutes.
    - Most real systems are not purely CP or AP -- they are tunable per operation (e.g., Cassandra's configurable consistency levels).

??? question "Q36: What are the common API versioning strategies?"

    **Answer:** API versioning lets you evolve your service contracts without breaking existing clients -- the best strategy is the one your consumers can adopt with the least friction.

    **Why:** In microservices, you cannot force all consumers to upgrade simultaneously. Multiple versions must coexist while clients migrate. Without a versioning strategy, any breaking change causes production outages.

    **How -- four approaches:**

    1. **URI versioning:** `/api/v1/orders`, `/api/v2/orders` -- simple, visible, widely used. Easy to route at the gateway level. Downside: pollutes URL space.
    2. **Header versioning:** `Accept: application/vnd.myapp.v2+json` -- keeps URIs clean, more RESTful. Downside: harder to test in browser, less discoverable.
    3. **Query parameter:** `/api/orders?version=2` -- easy to implement. Downside: not truly RESTful, caching issues.
    4. **Content negotiation:** Media type versioning via `Accept`/`Content-Type`. Most RESTful but least practical.

    **When to version:** Only when you make a breaking change (removing a field, changing a type, altering semantics). Additive changes (new optional fields) do not require a new version.

    **Best practices:**

    - Support N and N-1 simultaneously; provide a deprecation timeline with `Sunset` headers
    - Use contract testing (Pact) to detect breaking changes before deployment
    - Prefer backward-compatible (additive) evolution to avoid versioning entirely

    **Gotchas:**

    - URI versioning is the industry default (Stripe, GitHub, Google) despite being "less RESTful" -- pragmatism wins
    - Supporting 5+ versions simultaneously is an operational nightmare. Aggressively deprecate and communicate sunset dates.
    - Internal APIs between your own services should use schema evolution (Protobuf, Avro) rather than explicit versioning -- it is lighter weight

??? question "Q37: What is contract testing and how does Pact work?"

    **Answer:** Contract testing verifies that a consumer and provider agree on the API contract independently, catching breaking changes at build time without spinning up the entire service graph.

    **Why:** Integration tests are slow, flaky, and require all services running simultaneously. Contract tests give you the confidence of integration tests with the speed of unit tests. They answer: "will my change break any consumer?"

    **How Pact works:**

    1. **Consumer side:** The consumer writes a test defining the request it will send and the response it expects. Pact generates a **contract file** (JSON pact).
    2. **Provider side:** The provider replays the pact file against its actual API in CI. If all consumer expectations are met, the contract is verified.
    3. **Pact Broker:** A central server stores contracts and verification results. It enables "can-i-deploy" checks -- does the latest provider version satisfy all deployed consumers?

    **When to use:** Between any two services with a synchronous API contract (REST, gRPC). Especially valuable when different teams own consumer and provider.

    **Benefits:**

    - Catches breaking changes in CI, before deployment
    - 100x faster than E2E integration tests
    - Each side tests independently -- no shared test environment needed
    - Consumer-driven: providers evolve based on what consumers actually use, not hypothetical completeness

    **Gotchas:**

    - Pact tests the contract (shape), not business logic. You still need functional tests.
    - Consumer tests must be maintained -- if a consumer stops publishing pacts, the provider loses visibility into that dependency
    - Async messaging contracts (Kafka events) need Pact's message support, which is less mature than HTTP support
    - Teams must agree on who updates the contract first -- consumer-driven works best when the provider team is responsive to consumer needs

---

## Deployment & Feature Management

??? question "Q38: Compare Blue-Green, Canary, and Rolling deployments."

    **Answer:** Blue-Green gives instant rollback via environment switching, Canary minimizes risk via gradual traffic shifting, and Rolling minimizes infrastructure cost by replacing instances in-place -- each trades off speed, risk, and cost differently.

    **Why this matters:** Deployment strategy directly determines your blast radius when a bad release ships. In microservices, you deploy frequently (multiple times per day), so the deployment mechanism must be safe, fast, and automated.

    **How each works:**

    - **Blue-Green:** Two identical environments (Blue = current, Green = new). Deploy to Green, run smoke tests, flip the load balancer. Rollback = flip back. Cost: 2x infrastructure.
    - **Canary:** Route 1-5% of traffic to new version. Monitor error rates, latency, and business metrics. Gradually ramp to 100%. Rollback = route back to 0%. Cost: minimal extra.
    - **Rolling:** Replace instances one at a time (or in batches). Kubernetes default (`RollingUpdate`). Both versions coexist during rollout. Cost: no extra infra.

    | Aspect | Blue-Green | Canary | Rolling |
    |---|---|---|---|
    | Downtime | Zero | Zero | Zero |
    | Rollback speed | Instant | Fast | Slower |
    | Infrastructure cost | 2x | 1x + small % | 1x |
    | Risk | Low (full switch) | Very low (gradual) | Medium |

    **When to combine with feature flags:** Runtime switches that enable/disable features without redeploying. Use for gradual rollouts, kill switches, and A/B testing. Tools: LaunchDarkly, Unleash, Flagsmith.

    **Gotchas:**

    - Blue-Green requires database backward compatibility -- both versions hit the same DB during the switch. Schema migrations must be additive.
    - Canary requires good observability -- if you cannot detect increased error rates in the canary cohort, you are flying blind
    - Rolling deployments mean two versions serve traffic simultaneously -- your APIs must handle version skew (old client calling new server and vice versa)
    - None of these help if your deploy pipeline takes 45 minutes. Invest in fast builds first.

---

## Security & Best Practices

??? question "Q39: How do you secure microservices (OAuth2, JWT, mTLS)?"

    **Answer:** Secure the perimeter with OAuth2/JWT for client authentication, and secure internal traffic with mTLS for service-to-service identity -- defense in depth at both layers.

    **Why layered security:** A compromised service or network breach should not give an attacker lateral movement across your entire system. Zero-trust means every service verifies every request, regardless of network origin.

    **How -- two layers:**

    **External (client to API):**

    - **OAuth 2.0:** Client obtains an access token from an authorization server (Keycloak, Auth0, Okta). API Gateway validates the token and extracts claims before forwarding.
    - **JWT (JSON Web Token):** Self-contained token carrying user identity and permissions. Services validate the signature locally (no auth server call per request). Use short-lived access tokens (15 min) + refresh tokens.

    **Internal (service to service):**

    - **mTLS (mutual TLS):** Both sides present certificates -- authenticates the calling service's identity, not just the server. A service mesh automates certificate issuance and rotation (Istio, Linkerd).
    - **Service identity:** SPIFFE/SPIRE provides cryptographic workload identities independent of network location.

    **When to implement each:** JWT validation at the gateway is day one. mTLS is important once you have 10+ services or regulatory requirements. SPIFFE is for organizations with advanced zero-trust mandates.

    **Best practices:**

    - Validate tokens at the gateway AND at individual services (defense in depth)
    - Principle of least privilege -- each service has only the scopes/roles it needs
    - Rotate secrets and certificates automatically (never manually)
    - Use Kubernetes NetworkPolicies to restrict which services can communicate (deny-all default)

    **Gotchas:**

    - JWTs cannot be revoked until they expire -- for sensitive operations, check a revocation list or use short expiry (5-15 min)
    - mTLS certificate rotation failures cause hard outages -- monitor cert expiry with alerts at 7 days, 3 days, 1 day
    - Passing JWTs between internal services leaks user context to services that should not have it -- consider token exchange (RFC 8693) for scoped internal tokens
    - "Secure by default" means network policies deny-all first, then explicitly whitelist required paths

??? question "Q40: What is the 12-Factor App methodology and how does it relate to observability?"

    **Answer:** The 12-Factor App is a methodology for building cloud-native applications that are portable, scalable, and operationally sound -- it is essentially the playbook for building microservices that do not become operational nightmares.

    **Why it matters:** These principles were distilled from operating thousands of apps at Heroku. They solve the problems you hit when deploying microservices at scale: environment drift, secret leakage, non-reproducible builds, and unobservable services.

    **How -- the twelve factors applied to microservices:**

    | Factor | Principle | Microservices Application |
    |---|---|---|
    | I. Codebase | One codebase per app in VCS | One repo (or mono-repo module) per service |
    | II. Dependencies | Explicitly declare dependencies | `pom.xml`, `package.json` -- no implicit deps |
    | III. Config | Store config in environment | Env vars, ConfigMaps, Spring Cloud Config |
    | IV. Backing Services | Treat DBs, queues as attached resources | Connect via URLs/credentials, swappable |
    | V. Build, Release, Run | Strict stage separation | CI/CD: build image, release with config, run container |
    | VI. Processes | Stateless processes | State lives in databases/caches, not in memory |
    | VII. Port Binding | Export services via port binding | Each service binds to a port |
    | VIII. Concurrency | Scale out via processes | Add more container instances |
    | IX. Disposability | Fast startup, graceful shutdown | Handle SIGTERM, drain connections, start in seconds |
    | X. Dev/Prod Parity | Keep environments similar | Same Docker image across all environments |
    | XI. Logs | Treat logs as event streams | Write to stdout, ship via Fluentd/Filebeat |
    | XII. Admin Processes | One-off admin tasks | DB migrations as Kubernetes Jobs |

    **Observability connection (Factor XI and beyond):**

    Factor XI (logs as streams) is one pillar of observability -- the ability to understand a system's internal state from its external outputs. The three pillars:

    - **Metrics:** Numeric time-series (request rate, error rate, p99 latency). Tools: Prometheus + Grafana.
    - **Logs:** Structured event records with correlation IDs. Tools: ELK/EFK, Grafana Loki.
    - **Traces:** End-to-end request journeys across services. Tools: OpenTelemetry, Jaeger, Tempo.

    The key is **correlation**: the same trace ID appears in metrics labels, log entries, and trace spans, letting you pivot from a latency spike (metric) to the specific trace to the relevant log lines in seconds.

    **Gotchas:**

    - Factor VI (stateless processes) is the most commonly violated -- teams stash state in local files or in-memory caches that are lost on restart. Use external stores.
    - Factor IX (disposability) matters for auto-scaling: if your service takes 90 seconds to start, HPA scaling is useless during traffic spikes.
    - Observability without alerting is just data hoarding -- define SLOs (error budget) and alert when you are burning budget too fast, not on individual errors.
