---
title: "Circuit Breakers & Bulkheads — System Design Interview (2026)"
description: "Any microservices design has dependencies. Interviewers test:"
---

# Circuit Breakers & Bulkheads

!!! danger "Real Incident: Netflix Bookmark Service, 2012"
    A single bookmark service had a slow dependency. Every request to Netflix's API called the bookmark service. When that dependency went to 30-second timeouts, every API thread blocked waiting for it. 200 threads exhausted in under 60 seconds. The entire Netflix API went down — not because of a critical service, but because of BOOKMARKS. This incident led to building Hystrix. Their insight: "In a complex distributed system, it's not IF a dependency will fail, but WHEN. Every unchecked dependency is a liability that can take down your entire platform."

---

## Why This Comes Up in Interviews

Any microservices design has dependencies. Interviewers test:

- "What happens if your payment service is slow?" → Without circuit breakers, everything dies
- "How do you prevent cascading failures?" → Circuit breaker + bulkhead
- "What's your retry strategy?" → Exponential backoff with jitter
- "How do you handle partial failures gracefully?" → Fallbacks + degraded mode

If you design a system where one slow service can take down everything else, you've failed the interview.

---

## The Cascading Failure Problem

**The chain reaction:**

1. Service B becomes slow (DB overloaded, GC pause, network issue)
2. Service A calls B → threads wait for B's response (30s timeout)
3. A's thread pool fills up (all threads waiting for B)
4. A can't serve ANY requests (not just ones needing B)
5. Services that depend on A also start failing
6. Entire system goes down — from ONE slow dependency

**Back-of-envelope:**

| Parameter | Value |
|---|---|
| A's thread pool | 200 threads |
| Normal response time from B | 100ms |
| A's throughput (normal) | 200 ÷ 0.1s = 2,000 req/sec |
| B goes slow (10s responses) | |
| A's throughput (degraded) | 200 ÷ 10s = 20 req/sec |
| Time to exhaust thread pool | 200 threads ÷ 2000 req/sec incoming = **0.1 seconds** |

**Result:** A goes from 2,000 req/sec to ZERO in under a second. Not because A is broken — because B is slow.

---

## Circuit Breaker Pattern — Three States

| State | Behavior | Transitions |
|---|---|---|
| **CLOSED** | Requests pass through normally. Failures are counted. | → OPEN (when failure threshold exceeded) |
| **OPEN** | Requests fail IMMEDIATELY (no call to downstream). Timer running. | → HALF-OPEN (when timeout expires) |
| **HALF-OPEN** | Limited probe requests allowed through to test recovery. | → CLOSED (if probes succeed) or → OPEN (if probes fail) |

### State Transitions

```
CLOSED ──[failures > threshold]──→ OPEN
                                      │
                                [timeout expires]
                                      │
                                      ▼
                                  HALF-OPEN
                                   /      \
                    [probes succeed]        [probes fail]
                         │                      │
                         ▼                      ▼
                      CLOSED                   OPEN
```

### Configuration Parameters

| Parameter | Typical Value | What It Controls |
|---|---|---|
| **Failure threshold** | 5 failures in 10 seconds | When to trip OPEN |
| **Failure rate threshold** | 50% failures in sliding window | Alternative: rate-based |
| **Timeout duration** | 30-60 seconds | How long OPEN stays before HALF-OPEN |
| **Half-open max requests** | 3-5 requests | How many probes to test recovery |
| **Sliding window size** | 10-100 calls | Window for calculating failure rate |
| **Slow call threshold** | 5 seconds | Response time that counts as "failure" |

---

## Bulkhead Pattern — Isolate the Blast Radius

**Concept:** Like a ship's bulkheads — watertight compartments that prevent one breach from sinking the entire vessel.

**Without bulkhead:** All dependencies share one thread pool. One slow dependency consumes all threads → entire service dies.

**With bulkhead:** Each dependency gets its own isolated resource pool. One slow dependency only exhausts ITS pool → other dependencies unaffected.

### Implementation Patterns

| Pattern | How | Isolation Level | Overhead |
|---|---|---|---|
| **Thread pool bulkhead** | Separate thread pool per downstream service | Strong (OS thread isolation) | Higher (thread context switch) |
| **Semaphore bulkhead** | Limit concurrent requests per service (counter) | Medium (same thread, just limiting) | Lower (no thread overhead) |
| **Connection pool isolation** | Separate connection pool per dependency | Strong (resource isolation) | Medium |

### Thread Pool Sizing

| Dependency | Threads | Reasoning |
|---|---|---|
| Payment Service (critical, slow) | 30 threads | Slow (500ms avg) × 30 = 60 req/sec max |
| User Service (fast, high volume) | 50 threads | Fast (50ms avg) × 50 = 1000 req/sec max |
| Recommendation Service (optional) | 10 threads | Non-critical, can fail gracefully |
| Notification Service (fire-and-forget) | 5 threads | Async, doesn't block user flow |

**Formula:** `threads = peak_requests_per_sec × p99_latency_seconds × safety_factor`

---

## Retry with Exponential Backoff + Jitter

### Why Fixed Retries Kill Systems

**Scenario:** Service B goes down for 1 second. 1,000 requests fail simultaneously. All 1,000 retry at exactly the same time → thundering herd → B gets slammed with 2x normal load the instant it recovers → may go down again.

### The Formula

```
delay = min(base × 2^attempt + random_jitter, max_delay)
```

| Attempt | Base Delay | Exponential | With Jitter (0-1s random) | Actual Wait |
|---|---|---|---|---|
| 1 | 1s | 1s | 0-1s added | 1-2s |
| 2 | 1s | 2s | 0-1s added | 2-3s |
| 3 | 1s | 4s | 0-1s added | 4-5s |
| 4 | 1s | 8s | 0-1s added | 8-9s |
| 5 (max) | 1s | 16s | 0-1s added | 16-17s (or cap at 30s) |

**Why jitter is critical:** Without jitter, all clients retry at exactly t=1s, t=2s, t=4s — still synchronized. With random jitter, retries spread out over the window. The thundering herd becomes a trickle.

**Jitter strategies:**

| Strategy | Formula | Best For |
|---|---|---|
| Full jitter | `random(0, base × 2^attempt)` | Most cases |
| Equal jitter | `base × 2^attempt / 2 + random(0, base × 2^attempt / 2)` | Guaranteed minimum wait |
| Decorrelated jitter | `min(max_delay, random(base, prev_delay × 3))` | AWS SDK default |

---

## Timeout Patterns

| Timeout Type | What It Protects Against | Typical Value |
|---|---|---|
| **Connect timeout** | Network unreachable, server not listening | 1-5 seconds |
| **Read/response timeout** | Slow processing, stuck request | 5-30 seconds |
| **Total request timeout** | Including retries and redirects | 30-60 seconds |
| **Idle timeout** | Connection pool bloat | 60-300 seconds |

**The infinite timeout trap:** Default HTTP clients often have NO timeout. A single stuck request holds a thread forever. Always set explicit timeouts.

**Rule of thumb:** Timeout should be slightly above the p99 latency of the downstream service. If p99 = 2s, set timeout = 3s.

---

## Fallback Strategies

| Strategy | When | Example |
|---|---|---|
| **Cached response** | Data is tolerant of staleness | Show cached product recommendations |
| **Default value** | A neutral answer is acceptable | Show default "popular items" instead of personalized |
| **Degraded service** | Partial functionality is better than none | Show page without reviews when review service is down |
| **Queue for later** | Action can be deferred | Queue the notification, send when service recovers |
| **Fail fast with message** | Nothing useful can be returned | "Recommendations unavailable" with rest of page intact |
| **Alternative service** | Backup dependency exists | Primary payment processor down → secondary |

---

## Real Implementations Compared

| Tool | Type | Language | Status | Key Feature |
|---|---|---|---|---|
| **Netflix Hystrix** | Library | Java | Deprecated (2018) | Pioneered the pattern, thread pool isolation |
| **Resilience4j** | Library | Java | Active | Lightweight, functional, no thread pool overhead by default |
| **Polly** | Library | .NET | Active | Rich policy composition |
| **Envoy** | Proxy | Any (sidecar) | Active | Infrastructure-level, language-agnostic |
| **Istio** | Service mesh | Any | Active | Declarative policies via CRDs |

### Library vs Infrastructure

| Aspect | Library (Resilience4j) | Infrastructure (Envoy/Istio) |
|---|---|---|
| Where it runs | Inside application code | Sidecar proxy or mesh |
| Configuration | Code or config file | Kubernetes CRDs, control plane |
| Language support | One language (Java, .NET, etc.) | Language-agnostic |
| Granularity | Per-method/endpoint | Per-service |
| Observability | Application metrics | Mesh-level metrics (Prometheus) |
| Overhead | None (same process) | Network hop to sidecar (~1ms) |

---

## Combining Patterns — The Full Defense

A production service typically layers all patterns together:

```
Request
  → Timeout (5s max)
    → Circuit Breaker (fail fast if dependency is down)
      → Bulkhead (don't exhaust all threads)
        → Retry (exponential backoff + jitter, max 3 attempts)
          → Actual call to dependency
            → Fallback (if all retries fail or circuit is open)
```

**Order matters:** Circuit breaker OUTSIDE retries (don't retry if circuit is open). Timeout OUTSIDE everything (cap total wait time).

---

## Interview Framework

**When asked "How do you handle failures in your distributed system?":**

> **Step 1 — Identify the risk:** "Any synchronous dependency can fail or become slow. Without protection, a slow [payment/recommendation/search] service will exhaust our thread pool and take down our entire API."
>
> **Step 2 — Circuit breaker:** "I'd wrap calls to [dependency] in a circuit breaker. After [5] failures in [10] seconds, the circuit opens and requests fail immediately — protecting our thread pool. After [30]s, it enters half-open and probes for recovery."
>
> **Step 3 — Bulkhead:** "Each dependency gets its own thread pool / semaphore limit. If [dependency] is slow, only its allocated threads are consumed — other dependencies continue working normally."
>
> **Step 4 — Retry + backoff:** "On transient failures, I'd retry with exponential backoff and jitter: delay = base × 2^attempt + random. Max 3 retries. This prevents thundering herds on recovery."
>
> **Step 5 — Fallback:** "When the circuit is open, I'd serve [cached data / default response / degraded experience] rather than a hard error. The user gets a degraded but functional experience."

---

## Quick Recall

| Question | Answer |
|---|---|
| Cascading failure cause? | Slow dependency → threads blocked → thread pool exhaustion → service dies |
| Circuit breaker states? | CLOSED (normal) → OPEN (fail fast) → HALF-OPEN (probe recovery) |
| Why fail fast? | Waiting 30s for a timeout wastes a thread. Failing in 1ms frees it immediately. |
| Bulkhead purpose? | Isolate dependencies so one slow service only exhausts ITS pool, not ALL threads |
| Why jitter in retries? | Without jitter, all clients retry simultaneously → thundering herd |
| Backoff formula? | `min(base × 2^attempt + random_jitter, max_delay)` |
| Timeout rule? | Slightly above p99 latency. NEVER use infinite/default timeouts. |
| Library vs mesh? | Library (Resilience4j) for app-level control. Mesh (Istio) for infrastructure-level, language-agnostic. |
| Fallback examples? | Cached data, default values, degraded UI, queue for later |
| Thread pool sizing? | `peak_rps × p99_latency × safety_factor` |
