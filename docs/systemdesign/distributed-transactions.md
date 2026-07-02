---
title: "Distributed Transactions — System Design Interview (2026)"
description: "The moment you say \"microservices\" in a system design interview, the interviewer will probe:"
---

# Distributed Transactions

!!! danger "Real Incident: eBay's 2PC Meltdown, Early 2000s"
    eBay's payment and listing systems used distributed Two-Phase Commit transactions. During peak auction endings (Sunday nights, thousands closing per minute), the coordinator held locks across both databases for 2-3 seconds while waiting for the slowest participant. One slow query created a cascading lock pile-up: thousands of transactions blocked, both systems frozen, and the infamous "eBay is down" pages appeared. They replaced 2PC with event-driven compensating transactions — essentially SAGAs years before the term existed. **Distributed locks don't just slow you down — they create correlated failures across systems that should be independent.**

---

## Why This Comes Up in Interviews

The moment you say "microservices" in a system design interview, the interviewer will probe:

- "What happens if the payment succeeds but inventory fails?"
- "How do you maintain consistency across services?"
- "Can you use a database transaction across services?"
- "What's the trade-off between 2PC and eventual consistency?"

If you can't reason about distributed transactions, your microservice design has a fatal flaw.

---

## The Problem: Transactions Don't Cross Service Boundaries

In a monolith, you wrap five database operations in one transaction. If anything fails, everything rolls back. ACID handles it.

In microservices: Order Service has its own database. Payment Service has its own database. Inventory Service has its own database. There is no single transaction boundary that spans all three.

**The uncomfortable truth:** There is no way to get true ACID transactions across microservices without paying an enormous performance and availability penalty. Every solution is a trade-off.

---

## Two-Phase Commit (2PC) — The Traditional Answer

### How It Works

**Phase 1 (Prepare):** Coordinator sends "prepare" to every participant. Each participant executes locally, acquires locks, writes to WAL — does everything except commit. Votes YES or NO.

**Phase 2 (Commit/Abort):** If ALL voted YES → coordinator sends "commit." If ANY voted NO → sends "abort." Each participant commits or rolls back.

### Why 2PC Fails for Microservices

| Problem | Impact |
|---|---|
| **Blocking protocol** | Between phases, every participant holds DB locks and WAITS. If coordinator takes 5s to collect votes, locks held for 5s. Kills throughput. |
| **Coordinator is SPOF** | Coordinator crashes after Phase 1 but before Phase 2 → all participants stuck in "prepared" state FOREVER, holding locks |
| **Latency multiplier** | Total latency = sum of slowest participant in each phase. p99 = p99 of SLOWEST service, twice. |
| **Heterogeneous services** | Requires all participants to support XA protocol. Good luck getting your Payment API, email service, and third-party shipping API to implement XA. |

**When 2PC is acceptable:** Within a single database cluster (e.g., distributed PostgreSQL). NOT across microservices.

---

## The SAGA Pattern — Local Transactions + Compensations

Instead of one distributed transaction, break it into a **sequence of local transactions**. Each step commits independently. If step 3 fails, run compensating transactions for steps 2 and 1 in reverse order.

**Key insight:** Each compensation is a NEW forward transaction that semantically undoes the previous one — not a database rollback.

---

### Choreography-Based SAGA (Event-Driven)

Each service knows its part. When it completes its local transaction, it publishes an event. The next service subscribes and does its work. On failure, it publishes a failure event triggering upstream compensations.

```
Order Service → publishes "OrderCreated"
  → Inventory Service listens → reserves stock → publishes "InventoryReserved"
    → Payment Service listens → charges card → publishes "PaymentCharged"
      → Shipping Service listens → books courier → publishes "ShippingBooked"
```

| Pros | Cons |
|---|---|
| Loosely coupled (services know events, not each other) | Flow is implicit — no single place shows the full SAGA |
| No single point of failure | Debugging requires distributed tracing across services |
| Natural fit with event-driven architecture | Cyclic dependencies emerge silently |
| Each service fully autonomous | Hard to test end-to-end |

**When to use:** 2-4 services in the chain. Once you hit 5+, the implicit flow becomes a nightmare to debug.

---

### Orchestration-Based SAGA (Central Coordinator)

A central **SAGA orchestrator** directs the entire flow via a state machine. It tells each service what to do, waits for response, decides next step, triggers compensations on failure.

```
Orchestrator state machine:
  CREATED → send ReserveInventory → AWAITING_INVENTORY
  INVENTORY_RESERVED → send ChargePayment → AWAITING_PAYMENT
  PAYMENT_CHARGED → send BookShipping → AWAITING_SHIPPING
  SHIPPING_BOOKED → COMPLETED

  PAYMENT_FAILED → send ReleaseInventory → COMPENSATING
  INVENTORY_RELEASED → send CancelOrder → FAILED
```

| Pros | Cons |
|---|---|
| Entire flow visible in one place (state machine) | Orchestrator is a bottleneck/SPOF |
| Easy to debug ("where is this SAGA right now?") | Risk of becoming a "god service" |
| Centralized error handling and retries | Tighter coupling to orchestrator |
| Easy to add new steps | Must persist orchestrator state for crash recovery |

**When to use:** 4+ services, complex flows, production-critical paths where debuggability matters. Most FAANG-level systems use orchestration.

---

## Comparison: 2PC vs Choreography vs Orchestration

| Aspect | 2PC | Choreography SAGA | Orchestration SAGA |
|---|---|---|---|
| **Consistency** | Strong (ACID) | Eventual | Eventual |
| **Availability** | Low (blocking locks) | High | High (orchestrator must be HA) |
| **Latency** | High (lock duration) | Low (async) | Medium (sequential commands) |
| **Coupling** | Tight (XA protocol) | Loose (events) | Medium (orchestrator knows all services) |
| **Debuggability** | Medium | Hard (distributed tracing) | Easy (state machine) |
| **Rollback** | Perfect (DB rollback) | Semantic (compensations) | Semantic (compensations) |
| **Scalability** | Poor | Excellent | Good |
| **Best for** | Single DB cluster | Simple 2-4 service flows | Complex multi-service workflows |

---

## Compensating Transactions — The Hard Part

A compensating transaction is a semantic undo — a new action that reverses the business effect. NOT the same as a database rollback.

| Action | Compensation | Difficulty |
|---|---|---|
| Reserve inventory | Release inventory | **Easy** — clean reversal |
| Create database record | Delete or mark as cancelled | **Easy** — but others may have read it |
| Charge credit card | Issue a refund | **Medium** — refund has different fees, takes days |
| Send an email | Send "sorry, ignore that" email? | **Hard** — can't unsend |
| Ship a physical package | Recall? Reroute? Hope it hasn't left? | **Hard** — real world has no ROLLBACK |
| Post to social media | Delete post (people already saw it) | **Impossible** to fully undo |

**Design principle:** Order SAGA steps so that irreversible actions (send email, ship package) happen LAST. Reversible actions (reserve, authorize) happen first.

---

## The Outbox Pattern — Solving Dual Writes

**Problem:** Service needs to update its database AND publish an event. If DB write succeeds but event publish fails (or vice versa), you get inconsistency.

**Solution:** Write the event to an "outbox" table in the SAME database transaction as the business data. A separate process reads the outbox and publishes to the message broker.

```
BEGIN TRANSACTION
  INSERT INTO orders (id, user_id, total) VALUES (...)
  INSERT INTO outbox (event_type, payload) VALUES ('OrderCreated', '{...}')
COMMIT

-- Background process (CDC or poller):
-- Read outbox → publish to Kafka → mark as published
```

| Aspect | Without Outbox | With Outbox |
|---|---|---|
| Atomicity | DB + broker not atomic (dual write) | Single DB transaction (atomic) |
| Failure mode | Lost events or phantom events | At-least-once delivery (idempotent consumers) |
| Complexity | Simple code, complex failure | More infrastructure, predictable |
| Used by | — | Debezium (CDC), Transactional outbox |

---

## Idempotency — Critical for SAGAs

With at-least-once delivery and compensations, messages WILL be delivered multiple times. Every service must be idempotent.

**Pattern:**

1. Every message has a unique `idempotency_key`
2. Service checks: "Have I processed this key before?"
3. If yes → ACK, skip. If no → process, record key, ACK.

**Implementation:** Idempotency table in the service's database with the message ID as primary key. Check before processing, insert after.

---

## Real Systems

| System | What It Provides | Pattern |
|---|---|---|
| **Temporal** (ex-Cadence, Uber) | Durable workflow execution, automatic retries, state persistence | Orchestration |
| **AWS Step Functions** | Serverless state machines with built-in error handling | Orchestration |
| **Eventuate** | Event sourcing + SAGA framework for JVM | Both choreography and orchestration |
| **MassTransit** | .NET SAGA framework with state machines | Orchestration |
| **Axon Framework** | Java event sourcing + SAGA support | Both |
| **Kafka + custom** | Build your own with topics and consumer groups | Choreography |

**Uber's choice:** Built Cadence (now Temporal) specifically because debugging choreographed SAGAs across 8+ services for a single trip was impossible at scale. Engineers spent more time tracing event chains than fixing bugs. Switching to orchestration cut incident investigation time by 70%.

---

## Back-of-Envelope: SAGA Timing

**E-commerce order (5 services):**

| Step | Latency | Cumulative |
|---|---|---|
| Create order | 20ms | 20ms |
| Reserve inventory | 50ms | 70ms |
| Charge payment (external API) | 500ms | 570ms |
| Book shipping | 100ms | 670ms |
| Send confirmation | 30ms | 700ms |

**Orchestration (sequential):** ~700ms total. Acceptable for user-facing operations.

**Choreography (async, parallel where possible):** Steps 2+3 in parallel = ~520ms. Faster but harder to coordinate.

**Compensation path (worst case):** Payment charged, shipping fails. Refund = 3-5 business days. Customer sees "order cancelled" immediately, money returns later. This is why SAGAs are **eventually consistent**, not instantly consistent.

---

## Interview Framework

**When asked "How do you maintain consistency across microservices?":**

> **Step 1 — Reject 2PC:** "Two-Phase Commit doesn't work across microservices — it's blocking, the coordinator is a SPOF, and most services don't support XA. We need eventual consistency."
>
> **Step 2 — Choose SAGA:** "I'd use the SAGA pattern — each service does a local transaction and publishes an event. If a downstream step fails, compensating transactions undo prior steps."
>
> **Step 3 — Choreography vs Orchestration:** "For this flow with [N] services, I'd use [orchestration because we need debuggability and the flow is complex / choreography because it's simple 2-3 steps and we want loose coupling]."
>
> **Step 4 — Compensations:** "Each step has a defined compensation. I'd order steps so irreversible actions (send email, ship) happen last. Reversible actions (reserve, authorize) happen first."
>
> **Step 5 — Reliability:** "I'd use the outbox pattern to ensure events are published atomically with DB writes. All consumers are idempotent using message IDs to handle duplicates."

---

## Quick Recall

| Question | Answer |
|---|---|
| Why not 2PC for microservices? | Blocking locks, coordinator SPOF, latency, services can't all implement XA |
| SAGA in one sentence? | Sequence of local transactions + compensating transactions on failure |
| Choreography vs orchestration? | Choreography = events, loose coupling, hard to debug. Orchestration = state machine, debuggable, orchestrator is SPOF. |
| Outbox pattern solves what? | Dual-write problem (DB + event broker atomicity) |
| Why idempotency? | At-least-once delivery means duplicates. Must be safe to replay. |
| Irreversible actions? | Put them LAST in the SAGA sequence |
| Real orchestration tools? | Temporal, AWS Step Functions, Eventuate |
| SAGA consistency model? | Eventually consistent — not ACID across services |
| When choreography? | 2-4 simple steps, want loose coupling |
| When orchestration? | 4+ steps, complex flow, need debuggability |
