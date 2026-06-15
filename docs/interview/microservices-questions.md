---
title: "Microservices Interview Questions — Top 40 with Answers"
description: "Top microservices interview questions and answers. Covers service decomposition, communication patterns, Saga, CQRS, Circuit Breaker, API Gateway, distributed transactions, Kafka, service mesh — asked at FAANG and top product companies."
---

# Microservices Interview Questions

Microservices architecture is tested in every senior Java backend interview. This page covers the 40 most frequently asked questions with concise, interview-ready answers — from decomposition principles to production patterns asked at Amazon, Netflix, Uber, and FAANG companies.

**What interviewers test:** Not whether you can define microservices, but whether you understand *the tradeoffs* — when to decompose, how to handle distributed failures, how to maintain data consistency without distributed transactions, and what you've actually built at scale.

---

## Foundations

**1. What are microservices and how do they differ from a monolith?**

A **monolith** is a single deployable unit — all modules compiled and deployed together. **Microservices** decompose the application into small, independently deployable services, each owning its data and communicating over the network.

| | Monolith | Microservices |
|---|---|---|
| Deployment | One unit | Per service |
| Scaling | Whole app | Per service |
| Data | Shared DB | DB per service |
| Failure | One process | Distributed failures |
| Complexity | Simple at start | Complex (network, consistency) |

**2. What are the principles of good microservice design?**

- **Single Responsibility:** each service owns one bounded context
- **Database per service:** no shared databases — loose coupling
- **API-first:** define contracts before implementation
- **Design for failure:** assume every network call can fail
- **Decentralized governance:** teams choose their own tech stack
- **Observability:** every service must emit logs, metrics, traces

**3. How do you decompose a monolith into microservices?**

Use **Domain-Driven Design (DDD)** — identify **Bounded Contexts** (business domains with clear boundaries). Each bounded context becomes a service candidate. Decompose by:
- **Business capability:** Order Service, Payment Service, Inventory Service
- **Subdomain:** core (competitive advantage), supporting (necessary but generic), generic (commodity — buy or open-source)
- **Strangler Fig pattern:** gradually replace monolith endpoints one at a time

→ Deep dive: [Domain-Driven Design](../microservices/ddd.md) · [Design Principles](../microservices/design-principles.md)

**4. What are the main challenges of microservices?**

- **Distributed transactions:** maintaining consistency across services without 2PC
- **Network latency & failures:** every call can fail, timeout, or be slow
- **Service discovery:** services need to find each other dynamically
- **Data consistency:** eventual consistency is the norm
- **Observability:** debugging distributed calls requires correlation IDs + distributed tracing
- **Testing complexity:** integration testing N services is hard
- **Operational overhead:** N services = N deployments, N log streams, N dashboards

---

## Communication

**5. What is the difference between synchronous and asynchronous communication?**

**Synchronous (REST/gRPC):** caller waits for response — tight coupling, immediate feedback, cascading failures if downstream is slow. Use for: queries where you need the result immediately.

**Asynchronous (Kafka/RabbitMQ):** caller publishes event and moves on — loose coupling, higher resilience, eventual consistency. Use for: commands that trigger workflows, notifications, event sourcing.

**Rule of thumb:** if Service A *needs* Service B's response to complete its work → sync. If A just needs to *notify* B that something happened → async.

**6. When would you use gRPC over REST?**

**gRPC** uses Protocol Buffers (binary, strongly typed) over HTTP/2 — bidirectional streaming, lower latency, smaller payload, auto-generated clients. Choose gRPC for:
- Internal service-to-service communication with high throughput
- Bidirectional streaming (real-time data feeds)
- Polyglot environments (Java calling Go calling Python — all from the same `.proto`)

**REST** for: public APIs, browser clients, simple CRUD, human-readable debugging.

→ Deep dive: [gRPC Communication](../microservices/grpc.md) · [Inter-Service Communication](../microservices/InterServiceCommunication.md)

**7. What is an API Gateway and what does it do?**

A single entry point for all clients. Responsibilities:
- **Request routing** — route to the right microservice
- **Authentication/Authorization** — validate JWT before forwarding
- **Rate limiting** — protect backend from abuse
- **SSL termination** — decrypt HTTPS at the edge
- **Request aggregation** — combine multiple service responses
- **Protocol translation** — REST externally, gRPC internally

Examples: AWS API Gateway, Kong, Spring Cloud Gateway, Nginx.

→ Deep dive: [API Gateway](../microservices/APIGATEWAY.md) · [API Gateway Patterns](../microservices/api-gateway-patterns.md)

**8. What is the Backend for Frontend (BFF) pattern?**

One API Gateway per client type (mobile BFF, web BFF, third-party BFF). Each BFF aggregates and transforms responses optimized for its client — mobile gets a compact response, web gets a richer one. Avoids one-size-fits-all APIs. Teams own their BFF.

---

## Resilience Patterns

**9. What is a Circuit Breaker and how does it work?**

Prevents cascading failures when a downstream service is unhealthy. Three states:
- **Closed:** normal operation, calls go through, failures counted
- **Open:** failure threshold breached — calls immediately rejected with fallback (no actual calls made)
- **Half-Open:** after a timeout, lets a probe request through — if it succeeds, closes; if it fails, reopens

Implemented with Resilience4j (`@CircuitBreaker`). Threshold typically: 50% failure rate over 10 calls.

→ Deep dive: [Circuit Breaker](../microservices/CircuitBreaker.md)

**10. What is the Bulkhead pattern?**

Isolates failures to one partition — like watertight compartments in a ship. Separate thread pools (or connection pools) per downstream dependency. If Service B's thread pool is full/timing out, Service A's calls to Service C are unaffected. Implemented with Resilience4j `@Bulkhead`.

**11. What is the Retry pattern and what are its pitfalls?**

Automatically retry failed requests with exponential backoff + jitter. Pitfalls:
- **Retry storms:** all services retry simultaneously → amplifies load on already-struggling service
- **Non-idempotent operations:** retrying a payment creates duplicate charges — always add idempotency keys
- **Retry budget:** limit total retries to avoid infinite loops

Rule: only retry on transient failures (timeout, 503) — never on client errors (400, 404).

**12. What is the Timeout pattern?**

Every outbound call must have a timeout. Without it, a slow downstream holds threads indefinitely → thread pool exhaustion → the caller service becomes unresponsive. Set timeouts at: HTTP client level, circuit breaker level, and database connection level.

→ Deep dive: [Resilience Patterns](../microservices/resilience-patterns.md)

---

## Data Management

**13. Why "database per service"? What problems does it solve?**

Shared databases create tight coupling — a schema change in Service A breaks Service B. DB per service means:
- Services can use the best DB for their use case (PostgreSQL for orders, Cassandra for timeseries, Redis for sessions)
- Independent schema evolution
- Independent scaling
- Failure isolation

Trade-off: no cross-service joins, no ACID transactions across services.

**14. What is the Saga pattern?**

Manages **distributed transactions** as a sequence of local transactions, each publishing an event/message to trigger the next. If a step fails, compensating transactions roll back previous steps.

**Choreography:** each service listens for events and reacts — no central coordinator. Simple but hard to trace.

**Orchestration:** a central saga orchestrator sends commands to each service and tracks state — easier to monitor, single point of failure risk.

Example: Order Saga → reserve inventory → charge payment → confirm order. If payment fails → release inventory → cancel order.

→ Deep dive: [Saga Pattern](../microservices/SagaDesignPattern.md) · [Distributed Transactions](../microservices/distributed-transactions.md)

**15. What is the Outbox Pattern?**

Solves the dual-write problem: you can't atomically write to your DB *and* publish to Kafka. The Outbox pattern:
1. Write business data + outbox event in **one DB transaction**
2. A separate **message relay** process polls the outbox table and publishes to Kafka
3. Mark outbox record as published

Guarantees at-least-once delivery with no dual-write inconsistency.

**16. What is CQRS?**

**Command Query Responsibility Segregation** — separate models for writes (commands) and reads (queries). Write model optimized for consistency; read model (often a denormalized projection) optimized for query performance. Read models are updated asynchronously from the write model via events. Use when read and write patterns are dramatically different.

→ Deep dive: [CQRS](../CQRS.md) · [Event-Driven Architecture](../microservices/event-driven.md)

**17. What is Event Sourcing?**

Instead of storing current state, store the **full history of events**. Current state is derived by replaying events. Benefits: full audit trail, event replay for debugging, projections from the same event stream. Used with CQRS. Complex — don't use unless you genuinely need the audit trail or replay capability.

---

## Service Discovery & Config

**18. What is service discovery and why do you need it?**

In a dynamic environment (containers, auto-scaling), service instances start/stop — you can't hardcode IPs. Service discovery lets services find each other dynamically:
- **Client-side discovery:** service queries a registry (Eureka, Consul) and load-balances itself (Ribbon/Spring Cloud LoadBalancer)
- **Server-side discovery:** load balancer queries the registry and routes (AWS ALB, Kubernetes `kube-proxy`)

→ Deep dive: [Service Discovery](../microservices/ServiceDiscovery.md)

**19. What is a Service Mesh?**

Handles cross-cutting concerns (mTLS, retries, circuit breaking, distributed tracing) at the **infrastructure level** via sidecar proxies (Envoy) — without changing application code. Control plane (Istio/Linkerd) manages policy; data plane (Envoy sidecar) enforces it. Use when you have 20+ services and don't want to repeat resilience logic in every service.

→ Deep dive: [Service Mesh](../microservices/service-mesh.md)

**20. How do you manage configuration across microservices?**

- **Spring Cloud Config Server:** Git-backed centralized config, push refresh via Spring Cloud Bus
- **HashiCorp Vault:** secrets management (DB passwords, API keys) with rotation
- **Kubernetes ConfigMaps/Secrets:** env vars injected at pod startup
- **Feature flags (LaunchDarkly/Unleash):** runtime toggle without redeployment

→ Deep dive: [Config Management](../microservices/config-management.md)

---

## Observability

**21. What are the three pillars of observability?**

- **Logs:** structured JSON logs with correlation ID, trace ID — searchable in Kibana/Splunk
- **Metrics:** counters/gauges/histograms (request rate, error rate, latency) — visualized in Grafana/Prometheus
- **Traces:** end-to-end request path across services — visualized in Jaeger/Zipkin. Use `traceId` + `spanId` propagated in headers (W3C Trace Context or B3).

**22. What is a correlation ID?**

A unique ID generated at the API Gateway for each incoming request, propagated in HTTP headers (`X-Correlation-ID`) to all downstream services, and logged by each. Lets you trace a single user request across 10 service logs in Kibana with one filter.

→ Deep dive: [Logging & Monitoring](../microservices/logging-monitoring.md) · [Observability](../microservices/Observability.md)

---

## Kafka & Messaging

**23. What is Kafka and why is it used in microservices?**

Apache Kafka is a distributed event streaming platform — a durable, ordered, replayable log. In microservices it enables: event-driven communication, event sourcing, CDC (Change Data Capture), audit trails, real-time analytics. Unlike queues, Kafka retains messages — multiple consumer groups can independently replay the same events.

**24. What is the difference between at-most-once, at-least-once, and exactly-once delivery?**

- **At-most-once:** may lose messages, never duplicates. Fire and forget.
- **At-least-once:** never loses, may duplicate. Consumer must be idempotent.
- **Exactly-once:** never loses, never duplicates. Requires Kafka transactions + idempotent producers. Highest overhead.

In practice: design consumers to be **idempotent** and use at-least-once delivery — simpler and sufficient for most cases.

→ Deep dive: [Async Communication with Kafka](../microservices/AsyncCommunicationUsingKafka.md)

---

## Deployment & Testing

**25. What is a Blue-Green deployment?**

Two identical production environments (blue = current, green = new). Deploy to green, run smoke tests, then flip the load balancer to green. Instant rollback: flip back to blue. Requires double the infrastructure.

**26. What is a Canary deployment?**

Route a small percentage of traffic (1–5%) to the new version. Monitor metrics. Gradually increase percentage. Roll back instantly if metrics degrade. Lower risk than blue-green, no extra infrastructure cost. Supported natively by Kubernetes (Argo Rollouts) and service meshes.

**27. What is the Consumer-Driven Contract Testing pattern?**

Each consumer service defines the contract (API shape) it expects from a provider. The provider's test suite runs these contracts — ensuring it never breaks its consumers. Tools: Pact, Spring Cloud Contract. Faster than full integration tests and catches breaking API changes early.

→ Deep dive: [Deployment Strategies](../microservices/deployment-strategies.md) · [Testing Microservices](../microservices/testing-microservices.md)

---

## Security

**28. How do you handle authentication and authorization in microservices?**

**Authentication** at the API Gateway — validate the JWT, extract claims, pass user identity downstream in a trusted header. **Authorization** in each service — check `roles`/`scopes` from the JWT claims. Services trust each other via mTLS (service mesh) — no re-authentication between internal services.

**29. What is mTLS (Mutual TLS)?**

Both client and server present certificates — both sides authenticate each other. Used for service-to-service communication. In a service mesh (Istio), mTLS is enforced automatically by sidecar proxies — no application code changes needed.

---

## Quick-Fire Questions

**30. What is the Strangler Fig pattern?**
Gradually replace monolith functionality by routing traffic for specific features to new microservices, one at a time. The monolith "strangled" as more features move out.

**31. What is idempotency and why does it matter?**
An operation is idempotent if repeating it produces the same result. Critical for retries — a payment processed twice must not charge twice. Implement with idempotency keys (UUID from client, checked against DB before processing).

**32. What is the difference between Choreography and Orchestration in Saga?**
Choreography: services react to events — no central coordinator, decentralized. Orchestration: a saga coordinator drives the workflow — centralized, easier to monitor.

**33. What is an anti-corruption layer?**
A translation layer that prevents a downstream service's domain model from "corrupting" your model. Maps between contexts — your bounded context stays clean.

**34. What is the 2PC problem?**
Two-Phase Commit requires all participants to lock resources until the coordinator confirms — network failure during commit leaves resources locked indefinitely. Avoid in microservices; use Saga instead.

**35. What is back pressure?**
When consumers can't keep up with producers, back pressure signals producers to slow down. RxJava/Reactor support it; Kafka handles it via consumer lag (producers don't wait for consumers).

**36. What is service versioning?**
Managing API changes without breaking existing consumers. Strategies: URL versioning (`/api/v2/`), header versioning (`Accept: application/vnd.myapp.v2+json`), additive changes only (backward compatible).

**37. What is the Sidecar pattern?**
Deploy a helper container alongside the main service container (same pod in Kubernetes). The sidecar handles cross-cutting concerns: proxying (Envoy), log shipping (Filebeat), secret rotation. Main service code stays clean.

**38. What is a health check endpoint?**
`/actuator/health` — returns UP/DOWN status. Kubernetes liveness probe (is the app alive?) and readiness probe (should it receive traffic?) use this. Readiness probe should check downstream dependencies (DB, cache) before returning UP.

**39. What is circuit breaking vs rate limiting?**
Circuit breaking protects the **caller** — stops calls to a failing downstream. Rate limiting protects the **callee** — limits how many requests it accepts per second.

**40. How do you handle distributed logging across 20 services?**
Structured JSON logs + correlation ID propagation + centralized log aggregation (ELK Stack / Splunk). Each service logs `traceId`, `spanId`, `serviceId`. Filter by `traceId` to see the full request journey.

→ Deep dive: [Observability](../microservices/Observability.md) · [Advanced Patterns](../microservices/advanced-patterns.md)

---

## Go Deeper

- [Microservices Fundamentals](../microservices/microservices.md)
- [Resilience Patterns (Retry, Circuit Breaker, Bulkhead)](../microservices/resilience-patterns.md)
- [Saga Pattern](../microservices/SagaDesignPattern.md)
- [Distributed Transactions & Outbox](../microservices/distributed-transactions.md)
- [Event-Driven Architecture](../microservices/event-driven.md)
- [Service Mesh (Istio/Envoy)](../microservices/service-mesh.md)
- [Testing Microservices](../microservices/testing-microservices.md)
- [Real-World Case Studies](../microservices/case-studies.md)
