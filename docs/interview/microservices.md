# Top 40 Microservices Interview Questions & Answers

A comprehensive set of interview questions covering microservices architecture, patterns, communication, resilience, data management, observability, deployment, and security. Each answer is concise and interview-ready.

---

## Fundamentals

??? question "Q1: What are microservices?"

    **Answer:** Microservices is an architectural style where an application is built as a collection of **small, autonomous services**, each running in its own process, communicating over lightweight protocols (typically HTTP/REST or messaging), and organized around a specific business capability. Each service is independently deployable, scalable, and maintainable by a small team.

    Key characteristics:

    - Single responsibility per service
    - Decentralized data management (each service owns its data)
    - Independent deployment and scaling
    - Polyglot-friendly (different languages/frameworks per service)
    - Fault isolation -- a failure in one service does not cascade to others

??? question "Q2: Monolith vs Microservices -- what are the key differences?"

    **Answer:**

    | Aspect | Monolith | Microservices |
    |---|---|---|
    | Deployment | Single deployable unit | Each service deployed independently |
    | Scaling | Scale entire application | Scale individual services |
    | Technology | Single tech stack | Polyglot (mix of languages/frameworks) |
    | Data | Single shared database | Database per service |
    | Team structure | Large team, one codebase | Small teams per service (2-pizza rule) |
    | Fault isolation | One bug can bring down everything | Failure contained to the service |
    | Communication | In-process method calls | Network calls (HTTP, gRPC, messaging) |

??? question "Q3: What are the advantages of microservices?"

    **Answer:**

    1. **Independent deployment** -- ship features faster without coordinating full releases
    2. **Scalability** -- scale only the services that need it
    3. **Technology freedom** -- choose the best tool per service (Java for business logic, Python for ML)
    4. **Fault isolation** -- a crash in one service does not take down others
    5. **Team autonomy** -- small, focused teams own the full lifecycle of their service
    6. **Faster innovation** -- experiment with new tech in one service without risking the system

??? question "Q4: What are the disadvantages of microservices?"

    **Answer:**

    1. **Distributed system complexity** -- network failures, latency, partial failures
    2. **Data consistency** -- no simple ACID transactions across services; requires eventual consistency or sagas
    3. **Operational overhead** -- monitoring, logging, deployment pipelines per service
    4. **Testing difficulty** -- integration and E2E testing across services is harder
    5. **Debugging** -- tracing a request across 10 services is harder than a single stack trace
    6. **DevOps maturity required** -- needs CI/CD, container orchestration, observability

??? question "Q5: When should you NOT use microservices?"

    **Answer:** Avoid microservices when:

    - The **team is small** (fewer than 5-8 developers) -- the overhead outweighs the benefit
    - The **domain is not well understood** -- you need to discover boundaries first; start monolith, split later
    - **Low complexity** -- a simple CRUD app does not justify the infrastructure cost
    - **Tight latency requirements** on cross-service workflows -- network hops add latency
    - **Lack of DevOps maturity** -- without CI/CD, container orchestration, and observability, microservices become unmanageable

    A common wisdom: *"If you can't build a well-structured monolith, you won't be able to build microservices."*

---

## Decomposition & Domain Design

??? question "Q6: How do you decompose a monolith into microservices?"

    **Answer:** Two widely used strategies:

    **1. Strangler Fig Pattern:** Incrementally replace parts of the monolith. Route new requests to the new microservice while the old code still handles existing flows. Over time, the monolith shrinks until it is fully replaced.

    **2. Domain-Driven Design (DDD):** Identify bounded contexts within the domain. Each bounded context becomes a candidate microservice. Use event storming workshops to discover domain events, aggregates, and service boundaries.

    Practical steps:

    1. Identify seams in the monolith (loosely coupled modules)
    2. Extract the module with the clearest boundary first
    3. Create an anti-corruption layer between the new service and the monolith
    4. Migrate data ownership to the new service
    5. Repeat incrementally

??? question "Q7: What is a Bounded Context in DDD and why does it matter for microservices?"

    **Answer:** A **Bounded Context** is a boundary within which a particular domain model is defined and applicable. Different bounded contexts can have different meanings for the same term (e.g., "Account" means a user profile in the Identity context but a financial ledger in the Billing context).

    It matters for microservices because:

    - Each bounded context maps naturally to **one microservice**
    - It enforces **clear ownership** of data and logic
    - Communication between bounded contexts happens through well-defined interfaces (APIs or events), not shared models
    - It prevents the "distributed monolith" anti-pattern where services are tightly coupled through shared data models

??? question "Q8: Explain the Strangler Fig migration pattern in detail."

    **Answer:** Named after the strangler fig tree that grows around a host tree and eventually replaces it.

    ```
    [Client] --> [API Gateway / Proxy]
                     |            |
               [New Service]  [Monolith]
    ```

    **Steps:**

    1. **Identify** a module to extract (e.g., user authentication)
    2. **Build** the new microservice implementing that functionality
    3. **Intercept** -- place a facade/API gateway that routes traffic
    4. **Redirect** -- route new requests to the microservice; legacy requests still go to the monolith
    5. **Migrate** -- gradually move all traffic to the new service
    6. **Remove** -- delete the old code from the monolith

    **Benefits:** Zero big-bang migration, low risk, rollback is easy (reroute traffic back).

---

## Inter-Service Communication

??? question "Q9: Synchronous vs asynchronous communication -- when to use which?"

    **Answer:**

    | Aspect | Synchronous (Request/Response) | Asynchronous (Event/Message) |
    |---|---|---|
    | Mechanism | HTTP/REST, gRPC | Message broker (Kafka, RabbitMQ) |
    | Coupling | Temporal coupling (caller waits) | Loose coupling (fire and forget) |
    | Latency | Immediate response | Eventually processed |
    | Use when | Query data, real-time response needed | Background tasks, event notifications, long-running workflows |
    | Failure handling | Caller must handle timeout/retry | Broker provides durability, retries |

    **Rule of thumb:** Use synchronous for queries and user-facing requests that need an immediate answer. Use asynchronous for commands, events, and workflows where eventual processing is acceptable.

??? question "Q10: REST vs gRPC vs messaging -- how do you choose?"

    **Answer:**

    - **REST (HTTP/JSON):** Best for public APIs, browser clients, and simplicity. Human-readable, widely supported. Downside: verbose payloads, no built-in streaming.
    - **gRPC (HTTP/2 + Protobuf):** Best for internal service-to-service calls where performance matters. Binary serialization (smaller payloads), bidirectional streaming, code generation from `.proto` files. Downside: not browser-friendly without a proxy.
    - **Messaging (Kafka/RabbitMQ):** Best for event-driven, decoupled communication. Enables pub/sub, replay, and durability. Downside: eventual consistency, harder to debug.

    Many systems use a **combination**: REST for external APIs, gRPC for internal synchronous calls, and Kafka for asynchronous events.

---

## API Gateway & Service Discovery

??? question "Q11: What is the API Gateway pattern and what are its responsibilities?"

    **Answer:** An API Gateway is a single entry point for all client requests. It sits between clients and the microservices.

    **Responsibilities:**

    - **Request routing** -- routes to the correct downstream service
    - **Authentication & authorization** -- validates tokens (JWT/OAuth2) before forwarding
    - **Rate limiting & throttling** -- protects services from overload
    - **Load balancing** -- distributes traffic across service instances
    - **Response aggregation** -- combines responses from multiple services into one
    - **Protocol translation** -- REST to gRPC, for example
    - **SSL termination** -- handles TLS at the edge
    - **Caching** -- caches frequent responses

    **Examples:** Kong, AWS API Gateway, Spring Cloud Gateway, Envoy, NGINX.

??? question "Q12: What is Service Discovery and why is it needed?"

    **Answer:** In a dynamic environment (containers, auto-scaling), service instances come and go. Service Discovery allows services to find each other without hardcoded addresses.

    **Client-side discovery:** The client queries a service registry (e.g., Eureka) and load-balances itself. The client picks an instance from the returned list.

    **Server-side discovery:** The client calls a load balancer (e.g., AWS ALB, Kubernetes Service), which queries the registry and routes the request transparently.

    **Tools:** Netflix Eureka (client-side), Consul, etcd, Kubernetes DNS (server-side).

??? question "Q13: How does load balancing work in microservices?"

    **Answer:** Load balancing distributes requests across multiple instances of a service.

    **Server-side:** A dedicated load balancer (NGINX, HAProxy, AWS ALB) sits in front of service instances. Kubernetes Services do this natively.

    **Client-side:** The client (via a library like Spring Cloud LoadBalancer) maintains a list of instances from the service registry and picks one using an algorithm:

    - **Round Robin** -- cycles through instances sequentially
    - **Weighted Round Robin** -- more requests to higher-capacity instances
    - **Least Connections** -- sends to the instance with fewest active connections
    - **Random** -- simple random selection
    - **Consistent Hashing** -- routes based on a hash of the request key (useful for caching)

---

## Resilience Patterns

??? question "Q14: Explain the Circuit Breaker pattern and its states."

    **Answer:** The Circuit Breaker prevents a service from repeatedly calling a failing downstream service, giving it time to recover.

    **Three states (Resilience4j model):**

    ```
    [CLOSED] --failure threshold exceeded--> [OPEN]
    [OPEN] --wait duration expires--> [HALF_OPEN]
    [HALF_OPEN] --success threshold met--> [CLOSED]
    [HALF_OPEN] --failure occurs--> [OPEN]
    ```

    - **CLOSED:** Requests flow normally. Failures are counted. If the failure rate exceeds the threshold (e.g., 50% in the last 10 calls), it transitions to OPEN.
    - **OPEN:** All requests are immediately rejected with a fallback response. After a configured wait duration (e.g., 30 seconds), it moves to HALF_OPEN.
    - **HALF_OPEN:** A limited number of trial requests are allowed through. If they succeed, the circuit closes. If they fail, it reopens.

    ```java
    @CircuitBreaker(name = "paymentService", fallbackMethod = "paymentFallback")
    public PaymentResponse processPayment(PaymentRequest req) {
        return paymentClient.charge(req);
    }

    public PaymentResponse paymentFallback(PaymentRequest req, Throwable t) {
        return new PaymentResponse("PENDING", "Payment queued for retry");
    }
    ```

??? question "Q15: What are the Retry and Timeout patterns?"

    **Answer:**

    **Retry:** Automatically re-attempt a failed call. Use for transient failures (network blip, temporary 503).

    - Configure max attempts, backoff strategy (fixed, exponential, jitter)
    - **Exponential backoff with jitter** avoids thundering herd: `delay = baseDelay * 2^attempt + random(0, jitter)`
    - Only retry on idempotent operations or specific error codes (503, 429)

    **Timeout:** Set a maximum wait time for a response. Prevents threads from hanging indefinitely.

    - **Connection timeout:** max time to establish a connection (e.g., 2s)
    - **Read/response timeout:** max time to wait for data after connecting (e.g., 5s)
    - Always set timeouts -- a missing timeout is a latency bomb waiting to happen

    Use them together: retry up to 3 times, each with a 3-second timeout.

??? question "Q16: What is the Bulkhead pattern?"

    **Answer:** Named after ship compartments that prevent flooding from sinking the entire vessel. The Bulkhead pattern **isolates resources** so that a failure in one part does not exhaust resources for others.

    **Implementation approaches:**

    - **Thread pool isolation:** Each downstream service gets its own thread pool. If the inventory service is slow, only its 10 threads are blocked; the payment service pool (separate 10 threads) is unaffected.
    - **Semaphore isolation:** Limits concurrent calls to a downstream service using a semaphore (lighter weight than thread pools).

    ```java
    @Bulkhead(name = "inventoryService", fallbackMethod = "inventoryFallback",
              type = Bulkhead.Type.THREADPOOL)
    public InventoryResponse checkStock(String sku) {
        return inventoryClient.getStock(sku);
    }
    ```

    Without bulkheads, a single slow dependency can consume all threads and bring down the entire service.

??? question "Q17: How does rate limiting work in microservices?"

    **Answer:** Rate limiting controls the number of requests a client or service can make within a time window, protecting services from overload and abuse.

    **Common algorithms:**

    - **Token Bucket:** Tokens are added at a fixed rate. Each request consumes a token. If the bucket is empty, the request is rejected (or queued). Allows bursts up to the bucket size.
    - **Sliding Window:** Tracks requests in a rolling time window. More accurate than fixed windows, avoids boundary spikes.
    - **Fixed Window:** Simple counter reset at fixed intervals. Can allow 2x burst at window boundaries.

    **Where to apply:**

    - **API Gateway level** -- per-client rate limits (e.g., 1000 req/min per API key)
    - **Service level** -- protect internal services from noisy neighbors
    - **Distributed rate limiting** -- use Redis to share counters across instances

---

## Distributed Transactions & Data Patterns

??? question "Q18: Explain the Saga pattern -- orchestration vs choreography."

    **Answer:** The Saga pattern manages distributed transactions across multiple services without using two-phase commit. It breaks a transaction into a sequence of local transactions, each with a **compensating action** for rollback.

    **Orchestration:** A central **saga orchestrator** tells each service what to do and when.

    ```
    [Orchestrator] --> [Order Service]: Create order
    [Orchestrator] --> [Payment Service]: Charge payment
    [Orchestrator] --> [Inventory Service]: Reserve stock
    If payment fails:
    [Orchestrator] --> [Order Service]: Cancel order (compensate)
    ```

    **Choreography:** No central coordinator. Each service publishes events and reacts to others.

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

??? question "Q19: Two-Phase Commit vs Saga -- why prefer Saga in microservices?"

    **Answer:**

    **Two-Phase Commit (2PC):**

    - A coordinator asks all participants to **prepare** (Phase 1), then **commit or rollback** (Phase 2)
    - Provides strong consistency (ACID)
    - **Problems:** blocking protocol (all participants locked until commit), single point of failure (coordinator), does not scale across services, high latency

    **Saga:**

    - Each service commits its local transaction independently
    - Compensating transactions undo previous steps on failure
    - Provides **eventual consistency** (not ACID)
    - Non-blocking, scalable, resilient

    **Why Saga wins in microservices:** 2PC requires all participants to be available simultaneously and hold locks, which violates the autonomy and resilience goals of microservices. Sagas embrace eventual consistency and work naturally with distributed, independently deployed services.

??? question "Q20: What is CQRS and when should you use it?"

    **Answer:** **Command Query Responsibility Segregation (CQRS)** separates the write model (commands) from the read model (queries). Each side can have its own data store optimized for its workload.

    ```
    [Client] --Command--> [Write Service] --> [Write DB (normalized)]
                                          --> [Event Bus]
    [Client] --Query--> [Read Service] --> [Read DB (denormalized/materialized views)]
                                       <-- [Event Bus] (keeps read model in sync)
    ```

    **Use when:**

    - Read and write workloads differ significantly (read-heavy systems)
    - You need different data models for reads vs writes
    - Combined with Event Sourcing for audit trails

    **Avoid when:** Simple CRUD with similar read/write patterns -- CQRS adds unnecessary complexity.

??? question "Q21: What is Event Sourcing?"

    **Answer:** Instead of storing only the current state, **Event Sourcing** stores every state change as an immutable event. The current state is derived by replaying the events.

    ```
    Event Store:
    1. AccountCreated { id: 123, owner: "Alice" }
    2. MoneyDeposited { id: 123, amount: 500 }
    3. MoneyWithdrawn { id: 123, amount: 200 }

    Current State: Account 123, owner: Alice, balance: 300
    ```

    **Benefits:**

    - Complete **audit trail** -- every change is recorded
    - **Temporal queries** -- reconstruct state at any point in time
    - Natural fit with CQRS and event-driven architecture
    - Events can be replayed to rebuild projections or fix bugs

    **Challenges:** Event schema evolution, storage growth, complexity of rebuilding state from many events.

??? question "Q22: What is eventual consistency and how do you handle it?"

    **Answer:** Eventual consistency means that after a write, **all replicas will converge to the same value given enough time**, but reads immediately after may return stale data. Each service owns its database, so when Service A publishes an event, Service B processes it asynchronously -- there is a window of inconsistency.

    **How to handle it:**

    - **Idempotent consumers** -- handle duplicate events gracefully
    - **Optimistic UI** -- show the user success immediately, reconcile later
    - **Read-your-own-writes** -- route subsequent reads to the replica that processed the write
    - **Conflict resolution** -- last-write-wins or domain-specific merge logic
    - **Compensation** -- if inconsistency leads to an invalid state, trigger a corrective action

??? question "Q23: What are the challenges of distributed transactions?"

    **Answer:**

    1. **No global ACID** -- cannot wrap calls to 5 databases in one transaction
    2. **Partial failures** -- Service A commits, Service B fails; need compensating actions
    3. **Ordering** -- events may arrive out of order; services must handle reordering
    4. **Idempotency** -- retries are inevitable; operations must be safe to repeat
    5. **Visibility** -- tracking multi-service transaction state requires correlation IDs and tracing
    6. **Latency** -- coordinating across services adds time
    7. **Data ownership** -- cross-service joins require API calls or event-driven projections

---

## Observability & Configuration

??? question "Q24: How does distributed tracing work?"

    **Answer:** Distributed tracing tracks a request as it flows through multiple services, creating a visual timeline of all interactions.

    **Key concepts:**

    - **Trace:** Entire journey of a request (e.g., checkout spanning 6 services)
    - **Span:** A single unit of work within a trace (e.g., "call payment service" = 120ms)
    - **Trace ID:** Unique ID propagated in headers across all services
    - **Parent-Child spans:** Show the call hierarchy

    **How it works:** The first service generates a trace ID. Each subsequent service creates a span, attaches the trace ID, and forwards it. Spans are sent to a collector which assembles the full trace.

    **Tools:** OpenTelemetry (vendor-neutral SDK), Jaeger, Zipkin, AWS X-Ray, Datadog APM.

??? question "Q25: What is centralized logging and why is the ELK stack popular?"

    **Answer:** Each service produces its own logs. Centralized logging aggregates all logs into one searchable system.

    **ELK Stack:** **E**lasticsearch (stores/indexes logs) + **L**ogstash (ingests/transforms) + **K**ibana (visualization). Modern alternative: EFK (Fluentd instead of Logstash -- lighter weight).

    **Best practices:**

    - Use **structured logging** (JSON) so logs are machine-parseable
    - Include **correlation ID** in every log entry for cross-service tracing
    - Use **log shipping agents** (Filebeat, Fluentd) on each service
    - Set **retention policies** to manage storage costs

??? question "Q26: How do health checks and readiness probes work?"

    **Answer:** Kubernetes uses probes to manage service lifecycle:

    - **Liveness probe:** "Is the service alive?" Failure triggers a container restart. Checks: not deadlocked.
    - **Readiness probe:** "Can it handle traffic?" Failure removes it from load balancing (no restart). Checks: DB connection up, caches warm.
    - **Startup probe:** "Has it finished initializing?" Prevents liveness from killing slow-starting services.

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

??? question "Q27: How is configuration managed in microservices?"

    **Answer:** Managing config across dozens of services requires a centralized approach.

    **Approaches:**

    - **Spring Cloud Config Server:** Git-backed central server; services refresh dynamically via `/actuator/refresh`
    - **Consul / etcd:** Distributed key-value stores with watch capabilities
    - **Kubernetes ConfigMaps and Secrets:** Native injection via env vars or mounted volumes
    - **AWS Parameter Store / Secrets Manager:** Cloud-native, encrypted secret storage

    **Best practices:** Never hardcode secrets (use HashiCorp Vault), support dynamic refresh without restarts, use environment-specific profiles (dev/staging/prod), version control config via GitOps.

---

## Service Mesh & Sidecar

??? question "Q28: What is a Service Mesh and why use one?"

    **Answer:** A Service Mesh is a dedicated **infrastructure layer** for service-to-service communication. It moves networking concerns out of application code into sidecar proxies.

    **Components:**

    - **Data plane:** Sidecar proxies (Envoy) intercepting all inbound/outbound traffic
    - **Control plane:** Manages and configures proxies (Istio's `istiod`)

    **What it provides:** mTLS between services (zero-trust), traffic management (canary, splitting), automatic retries/circuit breaking/timeouts, distributed tracing, access control policies.

    **When to use:** 20+ services needing consistent networking policies. **Avoid** for small deployments -- the overhead is not justified.

??? question "Q29: What is the Sidecar pattern?"

    **Answer:** The Sidecar pattern deploys a helper process alongside the main application container in the same pod. The sidecar handles cross-cutting concerns without modifying application code.

    **Common use cases:**

    - **Networking proxy** (Envoy in Istio) -- handles mTLS, retries, load balancing
    - **Log collection** (Fluentd sidecar) -- ships logs to the central system
    - **Config sync** -- watches a config source and updates local files
    - **Security** -- handles authentication/token refresh

    **Benefits:** Language-agnostic, separation of concerns, independent updates without redeploying the app.

---

## Data Management

??? question "Q30: What is the Database per Service pattern?"

    **Answer:** Each microservice owns and manages its **private database**. No other service can access it directly -- only through the service's API.

    **Benefits:**

    - Services are loosely coupled at the data layer
    - Each service can choose the best database for its needs (polyglot persistence): SQL for orders, Redis for sessions, Elasticsearch for search
    - Schema changes in one service do not affect others

    **Challenges:**

    - Cross-service queries require API composition or CQRS projections
    - Distributed transactions are harder (use Saga pattern)
    - Data duplication is common (each service maintains its own view of shared data)

??? question "Q31: Why is a shared database considered an anti-pattern?"

    **Answer:** When multiple services share a single database:

    - **Tight coupling** -- a schema change by one team breaks other services
    - **No independent deployment** -- migrations must be coordinated across teams
    - **Scaling bottleneck** -- all services compete for the same DB resources
    - **No technology freedom** -- locked to one database engine
    - **Unclear ownership** -- who owns the `users` table when 5 services read/write to it?

    It creates a **distributed monolith** -- complexity of multiple services with none of the benefits. Temporarily sharing a DB during monolith migration is acceptable as an intermediate step, but not as the end state.

---

## Event-Driven Architecture & Messaging

??? question "Q32: What is Event-Driven Architecture?"

    **Answer:** Services communicate by producing and consuming **events** -- immutable records of something that happened (e.g., `OrderPlaced`, `PaymentProcessed`).

    **Components:** Event producers (emit events), event broker (Kafka, RabbitMQ, SNS/SQS), event consumers (react to events).

    **Benefits:** Loose coupling (producer does not know consumers), temporal decoupling (process later), easy to add new consumers, natural audit trail.

    **Patterns:** Event notification (thin events), event-carried state transfer (fat events with full data), event sourcing.

??? question "Q33: Kafka vs RabbitMQ -- when to use which?"

    **Answer:**

    | Aspect | Kafka | RabbitMQ |
    |---|---|---|
    | Model | Distributed log (append-only) | Message broker (queue-based) |
    | Retention | Configurable (days/weeks), replay | Deleted after consumption |
    | Throughput | Very high (millions msg/sec) | High (tens of thousands/sec) |
    | Consumer model | Pull-based | Push-based |
    | Best for | Event streaming, sourcing, log aggregation | Task queues, request/reply, routing |

    **Choose Kafka** for high throughput, event replay, multiple consumers. **Choose RabbitMQ** for complex routing, low-latency tasks, request-reply patterns.

---

## API Design & Testing

??? question "Q34: How do you ensure idempotency in microservice APIs?"

    **Answer:** An idempotent operation produces the **same result** regardless of how many times it is called. This is critical because retries and duplicate messages are inevitable in distributed systems.

    **Strategies:**

    - **Idempotency key:** The client sends a unique key (e.g., UUID) in a header (`Idempotency-Key`). The server stores the result keyed by this ID. On duplicate requests, it returns the stored result instead of processing again.
    - **Natural idempotency:** `PUT /orders/123` (replace entire resource) and `DELETE /orders/123` are naturally idempotent.
    - **Database constraints:** Use unique constraints to prevent duplicate inserts (e.g., unique on `payment_id + order_id`).
    - **Deduplication at the consumer:** Track processed message IDs and skip duplicates.

    ```
    POST /payments
    Headers: Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

    Server: Check if key exists in cache/DB
            -> If yes, return stored response
            -> If no, process payment, store result with key, return response
    ```

??? question "Q35: What is the CAP theorem and its implications for microservices?"

    **Answer:** The CAP theorem states that a distributed system can guarantee only **two of three** properties simultaneously:

    - **Consistency (C):** Every read returns the most recent write
    - **Availability (A):** Every request receives a response (not an error)
    - **Partition Tolerance (P):** The system continues to operate despite network partitions

    Since network partitions are **unavoidable** in distributed systems, the real choice is between **CP** (consistency over availability) and **AP** (availability over consistency).

    **Implications for microservices:**

    - Most microservices choose **AP** -- favor availability and accept eventual consistency
    - Financial/banking systems may choose **CP** for critical operations (account balance)
    - Different services can make different trade-offs: the product catalog (AP) vs the payment ledger (CP)
    - Eventual consistency is manageable with sagas, idempotency, and compensation

??? question "Q36: What are the common API versioning strategies?"

    **Answer:**

    1. **URI versioning:** `/api/v1/orders`, `/api/v2/orders` -- simple, visible, widely used
    2. **Header versioning:** `Accept: application/vnd.myapp.v2+json` -- keeps URIs clean
    3. **Query parameter:** `/api/orders?version=2` -- easy to implement, not RESTful
    4. **Content negotiation:** Uses `Accept`/`Content-Type` headers with media type versioning

    **Best practices:** Support at least current and previous versions simultaneously. Deprecate with clear timelines and sunset headers. Use contract testing (Pact) to catch breaking changes. Prefer backward-compatible (additive) changes to avoid versioning entirely.

??? question "Q37: What is contract testing and how does Pact work?"

    **Answer:** Contract testing verifies that a **consumer** and **provider** agree on the API contract (request/response format) without requiring both to be running simultaneously.

    **How Pact works:**

    1. **Consumer side:** The consumer writes a test defining what request it will send and what response it expects. Pact generates a **contract file** (pact file).
    2. **Provider side:** The provider runs the pact file against its actual API. If the API fulfills all consumer expectations, the contract is verified.
    3. **Pact Broker:** A central server stores and shares pact files between consumer and provider teams.

    **Benefits:**

    - Catches breaking changes **before deployment**
    - Faster than end-to-end integration tests
    - Each side tests independently -- no need for both services to be running
    - Supports consumer-driven contract design

---

## Deployment & Feature Management

??? question "Q38: Compare Blue-Green, Canary, and Rolling deployments."

    **Answer:**

    **Blue-Green:** Two identical environments (Blue = current, Green = new). Deploy to Green, verify, then switch traffic. Instant rollback by switching back. Downside: double the infrastructure.

    **Canary:** Route a small percentage (e.g., 5%) of traffic to the new version. Monitor error rates and latency, then gradually increase. Very low risk.

    **Rolling:** Replace instances one at a time (or in batches). Both versions run simultaneously during the rollout. No extra infrastructure, but rollback is slower.

    | Aspect | Blue-Green | Canary | Rolling |
    |---|---|---|---|
    | Downtime | Zero | Zero | Zero |
    | Rollback speed | Instant | Fast | Slower |
    | Infrastructure cost | 2x | 1x + small % | 1x |
    | Risk | Low (full switch) | Very low (gradual) | Medium |

    **Feature flags** complement all strategies: runtime switches that enable/disable features **without redeploying**. Use them for gradual rollouts, kill switches, and A/B testing. Tools: LaunchDarkly, Unleash, Flagsmith.

---

## Security & Best Practices

??? question "Q39: How do you secure microservices (OAuth2, JWT, mTLS)?"

    **Answer:**

    **External (client to API):**

    - **OAuth 2.0:** Authorization framework. The client obtains an access token from an authorization server (Keycloak, Auth0, Okta). The API Gateway validates the token on every request.
    - **JWT (JSON Web Token):** A self-contained token carrying user claims (roles, permissions). Services can validate it locally without calling the auth server on every request. Use short-lived access tokens + refresh tokens.

    **Internal (service to service):**

    - **mTLS (mutual TLS):** Both the client and server present certificates, ensuring both sides are authenticated. A service mesh (Istio) automates mTLS certificate rotation.
    - **Service identity:** Each service has a cryptographic identity (SPIFFE/SPIRE), not just a network address.

    **Best practices:**

    - Validate tokens at the API Gateway **and** at individual services (defense in depth)
    - Use the **principle of least privilege** -- each service has only the permissions it needs
    - Encrypt data in transit (TLS) and at rest
    - Rotate secrets and certificates automatically
    - Use network policies (Kubernetes NetworkPolicy) to restrict which services can communicate

??? question "Q40: What is the 12-Factor App methodology and how does it relate to observability?"

    **Answer:** The **12-Factor App** is a set of principles for cloud-native applications that aligns perfectly with microservices:

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
    | IX. Disposability | Fast startup, graceful shutdown | Handle SIGTERM, start in seconds |
    | X. Dev/Prod Parity | Keep environments similar | Same Docker image across all environments |
    | XI. Logs | Treat logs as event streams | Write to stdout, ship via Fluentd/Filebeat |
    | XII. Admin Processes | One-off admin tasks | DB migrations as Kubernetes Jobs |

    Factor XI connects directly to **observability** -- the ability to understand a system's internal state from its external outputs. The three pillars:

    - **Metrics:** Numeric measurements (request rate, error rate, latency). Tools: Prometheus, Grafana.
    - **Logs:** Timestamped event records. Tools: ELK/EFK stack, Loki.
    - **Traces:** End-to-end request journeys. Tools: Jaeger, Zipkin, OpenTelemetry.

    Correlate all three using a **trace ID/correlation ID** in metrics labels, log entries, and trace spans.
