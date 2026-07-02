---
title: "Payment System — System Design Interview (2026)"
description: "Design a payment system — system design interview walkthrough covering idempotency, double-entry ledger, saga pattern, payment state machines, reconciliation, and scaling to $10B annual volume."
---

# Payment System

!!! danger "Real Incident: Visa Network Outage, June 1 2018"
    At 2:30 PM BST on a Friday, Visa's European payment network went dark for 10 hours. 5.2 million transactions failed across the continent. ATMs stopped dispensing cash, contactless payments at grocery stores returned "DECLINED," and petrol stations turned away customers. The root cause: a single hardware switch failure in one of Visa's two data centers triggered a cascading failure because the system lacked proper failover for its transaction-routing layer. The backup site was online but could not handle the full load without a warm handoff. **A payment system is a zero-tolerance system — a single point of failure in the critical path means millions of failed transactions and front-page news.**

---

## System Design Concepts Used

`Idempotency` · `Double-Entry Ledger` · `Saga Pattern` · `Payment State Machine` · `Reconciliation` · `PCI DSS Compliance` · `Tokenization` · `Exponential Backoff` · `Dead Letter Queue` · `Exactly-Once Semantics` · `Distributed Transactions` · `Event Sourcing` · `Outbox Pattern`

---

## 1. Functional Requirements

1. **Process payments** — charge a customer via credit card, debit card, or digital wallet through a PSP (Stripe, Adyen)
2. **Idempotent execution** — guarantee exactly-once processing regardless of retries or network failures
3. **Refunds** — full and partial refunds with ledger reversal entries
4. **Payment status tracking** — expose real-time state to the client (CREATED, PROCESSING, COMPLETED, FAILED)
5. **Multi-currency** — accept payments in 30+ currencies, settle in merchant's preferred currency
6. **Reconciliation** — daily batch comparison of internal records vs PSP settlement files
7. **Notifications** — email/push on payment success, failure, and refund completion

## 2. Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Availability** | 99.99% (< 52 min/year) | Every failed transaction = lost revenue + customer trust |
| **Consistency** | Strong (ACID) for payment writes | A payment must never be partially committed — either the charge + ledger entries all persist, or none do |
| **Latency** | < 500ms p99 for payment initiation | PSP round-trip dominates; our internal overhead must be < 50ms |
| **Durability** | Zero data loss | Financial records are legally required; losing a transaction record is catastrophic |
| **Idempotency** | 100% — never double-charge | The single most critical correctness requirement |
| **Auditability** | Full append-only audit trail | PCI DSS, SOX compliance, and dispute resolution all require immutable history |

---

## 3. Capacity Estimation

```text
/* ━━━ NAPKIN MATH: Start From Daily Transactions ━━━ */
Transactions/day: 1M
Transactions/sec (avg): 1M / 86,400 ≈ 12 TPS
Transactions/sec (peak 10x): ~120 TPS
Transactions/sec (Black Friday 30x): ~360 TPS

/* ━━━ FINANCIAL VOLUME ━━━ */
Annual volume: $10B
Average transaction: $10B / 365M = ~$27
Median transaction: ~$15 (long tail of large B2B payments)

/* ━━━ STORAGE ━━━ */
Per payment record: payment_id (16B) + idempotency_key (36B) + 
  amount (8B) + currency (3B) + status (10B) + timestamps (16B) + 
  PSP metadata (200B) + indices overhead = ~500 bytes
Per ledger entry: 2-3 entries per payment × 200 bytes = ~500 bytes
Total per transaction: ~1 KB (payment + ledger + events)
5-year storage: 1M/day × 365 × 5 × 1 KB = 1.8 TB

/* ━━━ LEDGER ENTRIES ━━━ */
Entries/day: 1M payments × 3 entries avg = 3M ledger rows/day
5-year ledger: 3M × 365 × 5 = 5.4 billion rows

/* ━━━ MESSAGE QUEUE ━━━ */
Events/day: 1M payments × 4 state transitions avg = 4M events/day
Event size: ~500 bytes (JSON payload with metadata)
Kafka throughput: 4M / 86,400 ≈ 46 events/sec (trivial for Kafka)

/* ━━━ RECONCILIATION ━━━ */
Settlement files/day: 1 per PSP (typically arrives T+1)
Rows to reconcile: 1M comparisons/day (one batch job, ~15 min runtime)
```

!!! note "System Nature"
    **Write-heavy with strict correctness.** Unlike a URL shortener (read-heavy, eventual consistency OK), a payment system is write-dominant and demands strong consistency on the write path. Every write must be durable, idempotent, and auditable. The read path (status checks) is simple and cacheable, but the write path is the entire challenge.

---

## 4. "Why X, Not Y?" — Tradeoff Analysis

### Why Saga Pattern and not Two-Phase Commit (2PC)?

**Saga wins because payment processing spans external systems (PSPs) that do not participate in distributed transactions.** 2PC requires ALL participants to hold locks and vote — but Stripe's API does not support XA transactions. A saga breaks the payment into sequential steps (reserve funds → call PSP → record ledger → notify), each with a compensating action on failure (reverse ledger → void PSP charge → release reservation). This gives you eventual consistency with recovery, rather than a distributed lock that times out.

*2PC advantage:* Stronger atomicity guarantees within systems you control. Use for internal-only operations like transferring between two accounts in the SAME database.

### Why PostgreSQL and not DynamoDB for the ledger?

**PostgreSQL provides ACID transactions essential for double-entry bookkeeping.** Every payment must atomically insert 2-3 ledger entries that sum to zero — if one entry persists without its counterpart, your books are imbalanced. PostgreSQL's multi-row transactions guarantee this atomically. Additionally, financial auditors require complex SQL queries (joins, aggregations, window functions) that relational databases handle natively.

*DynamoDB advantage:* Infinite horizontal scale with zero ops. Use for the event store or status-check read cache — not for the ledger where transactional integrity is non-negotiable.

### Why async settlement and not synchronous end-to-end?

**PSPs settle funds on their own schedule (T+1 to T+3 days) — you cannot make settlement synchronous even if you wanted to.** Your system confirms the payment intent immediately (< 500ms to the user), but actual fund transfer from cardholder's bank to merchant's bank account takes days. Designing for async settlement from the start means you correctly model reality: COMPLETED means "PSP accepted the charge" not "money has arrived."

*Synchronous advantage:* Simpler mental model for developers. Use for wallet-to-wallet transfers within your own platform where you control both sides.

### Why client-generated idempotency keys and not server-generated?

**Client-generated UUIDs allow safe retries without server coordination.** If the client generates the key BEFORE sending the request, a network timeout followed by a retry sends the SAME key — the server detects the duplicate and returns the cached result. If the server generated the key, the client would not know whether the first request succeeded or not, making safe retries impossible.

*Server-generated advantage:* Simpler client implementation, no UUID generation needed. But it fundamentally breaks retry safety — never use it for payment APIs.

---

## 5. High-Level Architecture

<div class="arch-diagram" style="background: #FAFBFE; border: 2px solid #E2E8F0; border-radius: 14px; padding: 20px; margin: 24px 0; overflow-x: auto; text-align: center;">
<svg viewBox="0 0 1100 780" xmlns="http://www.w3.org/2000/svg" font-family="Inter,system-ui,sans-serif">
  <defs>
    <marker id="a" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#546E7A"/>
    </marker>
    <marker id="ar" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#D32F2F"/>
    </marker>
    <filter id="sh" x="-3%" y="-3%" width="106%" height="106%">
      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="1100" height="780" fill="#FAFAFA" rx="8"/>

  <!-- Title -->
  <text x="550" y="28" text-anchor="middle" font-size="18" font-weight="800" fill="#212121">Payment System — Architecture</text>
  <text x="550" y="48" text-anchor="middle" font-size="11" fill="#757575">1M txns/day | $10B annual | exactly-once | ACID ledger | &lt;500ms initiation</text>

  <!-- ═══ LAYER 1: Clients ═══ -->
  <rect x="40" y="65" width="1020" height="60" rx="10" fill="#E3F2FD" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="80" font-size="10" font-weight="600" fill="#9E9E9E">Clients</text>
  <rect x="60" y="85" width="200" height="32" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="160" y="105" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Web Checkout (Browser)</text>
  <rect x="280" y="85" width="200" height="32" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="380" y="105" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Mobile App (iOS/Android)</text>
  <rect x="500" y="85" width="200" height="32" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="600" y="105" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Merchant API (B2B)</text>
  <rect x="720" y="85" width="200" height="32" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="820" y="105" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Subscription Scheduler</text>

  <!-- ═══ LAYER 2: Load Balancer ═══ -->
  <line x1="450" y1="125" x2="450" y2="150" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <polygon points="450,150 520,180 450,210 380,180" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5"/>
  <text x="450" y="184" text-anchor="middle" font-size="11" font-weight="600" fill="#F57F17">API Gateway / LB</text>

  <!-- ═══ LAYER 3: Payment Service ═══ -->
  <line x1="450" y1="210" x2="450" y2="240" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="40" y="240" width="1020" height="80" rx="10" fill="#E8F5E9" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="256" font-size="10" font-weight="600" fill="#9E9E9E">Application Layer (Stateless)</text>

  <rect x="60" y="263" width="250" height="46" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="185" y="282" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Payment Service</text>
  <text x="185" y="300" text-anchor="middle" font-size="9" fill="#757575">Orchestrator | State machine | Idempotency check</text>

  <rect x="340" y="263" width="250" height="46" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="465" y="282" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Ledger Service</text>
  <text x="465" y="300" text-anchor="middle" font-size="9" fill="#757575">Double-entry bookkeeping | Immutable append</text>

  <rect x="620" y="263" width="250" height="46" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="745" y="282" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Reconciliation Service</text>
  <text x="745" y="300" text-anchor="middle" font-size="9" fill="#757575">Daily T+1 batch | PSP comparison | Alerts</text>

  <!-- ═══ LAYER 4: External PSP ═══ -->
  <line x1="185" y1="309" x2="185" y2="350" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="60" y="350" width="250" height="50" rx="8" fill="#FFF3E0" stroke="#E65100" stroke-width="1.5" filter="url(#sh)"/>
  <text x="185" y="372" text-anchor="middle" font-size="13" font-weight="700" fill="#BF360C">PSP (Stripe / Adyen)</text>
  <text x="185" y="390" text-anchor="middle" font-size="9" fill="#757575">Tokenized card charge | Webhooks | Settlement files</text>

  <!-- ═══ LAYER 5: Database ═══ -->
  <line x1="465" y1="309" x2="465" y2="350" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="40" y="430" width="1020" height="100" rx="10" fill="#E8EAF6" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="446" font-size="10" font-weight="600" fill="#9E9E9E">Data Layer</text>

  <path d="M80,465 L80,500 C80,515 220,515 220,500 L220,465" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="150" cy="465" rx="70" ry="10" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <text x="150" y="484" text-anchor="middle" font-size="11" font-weight="600" fill="#1A237E">Payment DB</text>
  <text x="150" y="500" text-anchor="middle" font-size="8" fill="#757575">PostgreSQL (ACID)</text>

  <path d="M280,465 L280,500 C280,515 420,515 420,500 L420,465" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="350" cy="465" rx="70" ry="10" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <text x="350" y="484" text-anchor="middle" font-size="11" font-weight="600" fill="#1A237E">Ledger DB</text>
  <text x="350" y="500" text-anchor="middle" font-size="8" fill="#757575">PostgreSQL (append-only)</text>

  <path d="M480,465 L480,500 C480,515 620,515 620,500 L620,465" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="550" cy="465" rx="70" ry="10" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <text x="550" y="484" text-anchor="middle" font-size="11" font-weight="600" fill="#1A237E">Event Store</text>
  <text x="550" y="500" text-anchor="middle" font-size="8" fill="#757575">All state transitions</text>

  <!-- ═══ Kafka ═══ -->
  <rect x="700" y="360" width="200" height="42" rx="6" fill="#37474F" stroke="#263238" stroke-width="1.5" filter="url(#sh)"/>
  <text x="800" y="377" text-anchor="middle" font-size="12" font-weight="600" fill="#ECEFF1">Kafka</text>
  <text x="800" y="394" text-anchor="middle" font-size="9" fill="#B0BEC5">Payment events | DLQ topic</text>
  <line x1="600" y1="286" x2="700" y2="376" stroke="#546E7A" stroke-width="1.0" stroke-dasharray="5,3" marker-end="url(#a)"/>

  <!-- ═══ Downstream from Kafka ═══ -->
  <line x1="800" y1="402" x2="800" y2="435" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="700" y="465" width="200" height="42" rx="6" fill="#FCE4EC" stroke="#AD1457" stroke-width="1.5" filter="url(#sh)"/>
  <text x="800" y="483" text-anchor="middle" font-size="11" font-weight="600" fill="#880E4F">Notification Service</text>
  <text x="800" y="499" text-anchor="middle" font-size="9" fill="#757575">Email / Push / SMS</text>

  <!-- ═══ Dead Letter Queue ═══ -->
  <rect x="700" y="520" width="200" height="35" rx="6" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="800" y="542" text-anchor="middle" font-size="10" font-weight="600" fill="#B71C1C">Dead Letter Queue (DLQ)</text>
  <line x1="800" y1="507" x2="800" y2="520" stroke="#D32F2F" stroke-width="1.0" marker-end="url(#ar)"/>

  <!-- ═══ LEGEND ═══ -->
  <rect x="40" y="580" width="1020" height="35" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="56" y="602" font-size="10" font-weight="700" fill="#757575">Legend:</text>
  <rect x="110" y="593" width="18" height="12" rx="3" fill="#BBDEFB" stroke="#1976D2" stroke-width="1"/>
  <text x="133" y="603" font-size="9" fill="#757575">Client</text>
  <polygon points="188,593 198,599 188,605 178,599" fill="#FFF9C4" stroke="#F9A825" stroke-width="1"/>
  <text x="206" y="603" font-size="9" fill="#757575">Gateway</text>
  <rect x="260" y="593" width="18" height="12" rx="3" fill="#C8E6C9" stroke="#388E3C" stroke-width="1"/>
  <text x="283" y="603" font-size="9" fill="#757575">Service</text>
  <rect x="330" y="593" width="18" height="12" rx="3" fill="#FFF3E0" stroke="#E65100" stroke-width="1"/>
  <text x="353" y="603" font-size="9" fill="#757575">External PSP</text>
  <ellipse cx="422" cy="599" rx="10" ry="6" fill="#E8EAF6" stroke="#283593" stroke-width="1"/>
  <text x="438" y="603" font-size="9" fill="#757575">Database</text>
  <rect x="500" y="593" width="18" height="12" rx="3" fill="#37474F" stroke="#263238" stroke-width="1"/>
  <text x="523" y="603" font-size="9" fill="#757575">Queue</text>
  <rect x="565" y="593" width="18" height="12" rx="3" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1"/>
  <text x="588" y="603" font-size="9" fill="#757575">DLQ</text>
  <line x1="630" y1="599" x2="660" y2="599" stroke="#546E7A" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="667" y="603" font-size="9" fill="#757575">Sync flow</text>
  <line x1="730" y1="599" x2="760" y2="599" stroke="#546E7A" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#a)"/>
  <text x="767" y="603" font-size="9" fill="#757575">Async flow</text>
</svg>
</div>

---

## 6. Backend Services Explained

### Payment Service (Orchestrator)
The central coordinator. Receives payment requests, enforces idempotency (unique constraint on `idempotency_key`), manages the payment state machine, calls the PSP, and publishes events. **Stateless** — any instance can handle any request because all state lives in PostgreSQL.

### Ledger Service
Maintains the double-entry bookkeeping system. Every payment creates exactly 2-3 ledger entries (debit buyer, credit seller, credit platform fee). The ledger is **append-only** — entries are never updated or deleted. Balance queries aggregate entries. This is the financial source of truth.

### Reconciliation Service
Runs as a daily batch job (T+1). Downloads settlement files from PSPs, compares every transaction against internal records, and flags discrepancies. Produces a daily report for the finance team and pages on-call for critical mismatches (e.g., customer charged but our system says FAILED).

### Notification Service
Consumes payment events from Kafka asynchronously. Sends email/push notifications for payment success, failure, refund completion. Never in the critical payment path — a notification delay is acceptable, a payment delay is not.

### Dead Letter Queue
Failed messages (e.g., notification service down, webhook delivery failures after 5 retries) land here for manual investigation. An alert fires if DLQ depth exceeds threshold. Operations team reviews and replays messages after fixing the underlying issue.

---

## 7. Architecture Flow — Alice Buys a $50 Item

Alice is buying a $50 pair of headphones on an e-commerce marketplace. She clicks "Pay Now" on the checkout page. Here is the complete flow through the system.

### Phase 1 — Payment Initiation

**T+0ms:** Alice's browser generates an idempotency key (`pay_a1b2c3d4-e5f6-7890-abcd-ef1234567890`) and sends:

```text
POST /api/v1/payments
Headers: Idempotency-Key: pay_a1b2c3d4-e5f6-7890-abcd-ef1234567890
Body: {
  "amount": 5000,          // $50.00 in cents
  "currency": "USD",
  "payment_method_token": "tok_visa_4242",
  "merchant_id": "merchant_headphones_inc",
  "order_id": "order_789"
}
```

**T+3ms:** API Gateway validates the auth token, rate-limits (100 req/sec per user), and routes to a Payment Service instance.

### Phase 2 — Idempotency Check & State Creation

**T+5ms:** Payment Service checks: `SELECT * FROM payments WHERE idempotency_key = 'pay_a1b2c3d4...'`. No existing row — this is a fresh request.

**T+8ms:** Insert new payment record with status `CREATED`:

```text
INSERT INTO payments (id, idempotency_key, amount, currency, status, merchant_id, order_id, created_at)
VALUES ('pay_uuid_001', 'pay_a1b2c3d4...', 5000, 'USD', 'CREATED', 'merchant_headphones_inc', 'order_789', NOW())
```

**T+10ms:** Payment transitions to `PROCESSING`. This state transition is persisted atomically.

### Phase 3 — PSP Call (The Dangerous Part)

**T+12ms:** Payment Service calls Stripe:

```text
POST https://api.stripe.com/v1/charges
Body: { amount: 5000, currency: "usd", source: "tok_visa_4242", 
        metadata: { internal_payment_id: "pay_uuid_001" } }
```

**T+380ms:** Stripe responds `200 OK` with `charge_id: "ch_1abc123"`. The PSP has successfully charged Alice's card.

**T+382ms:** Payment Service updates status to `PSP_CALLED` with the external charge ID:

```text
UPDATE payments SET status = 'COMPLETED', psp_charge_id = 'ch_1abc123', 
       completed_at = NOW() WHERE id = 'pay_uuid_001'
```

### Phase 4 — Ledger Entries (Double-Entry Bookkeeping)

**T+385ms:** Within the same database transaction, the Ledger Service inserts:

```text
Entry 1: DEBIT   account="buyer:alice_123"           amount=5000  currency=USD
Entry 2: CREDIT  account="seller:headphones_inc"     amount=4850  currency=USD  (97% to seller)
Entry 3: CREDIT  account="platform:commission"       amount=150   currency=USD  (3% platform fee)
```

Sum of all entries: -5000 + 4850 + 150 = **$0.00 (balanced)**

### Phase 5 — Event Publishing & Response

**T+390ms:** Payment Service publishes `PaymentCompleted` event to Kafka (via the transactional outbox pattern — the event is written to an `outbox` table in the same transaction as the payment update).

**T+392ms:** Returns `200 OK` to Alice's browser:

```text
{ "payment_id": "pay_uuid_001", "status": "COMPLETED", "amount": 5000, "currency": "USD" }
```

**Total end-to-end latency: ~392ms** (dominated by the 370ms Stripe round-trip).

### Phase 6 — Async Downstream (Non-Blocking)

**T+500ms:** Kafka consumer in Notification Service picks up the event, sends Alice an email: "Your payment of $50.00 was successful."

**T+600ms:** Order Service (separate consumer) receives the event and transitions the order to "PAID" — triggering fulfillment.

### What If Alice's Network Drops at T+380ms?

Alice never receives the `200 OK`. She clicks "Pay Now" again. Her browser sends the SAME idempotency key. Payment Service finds the existing COMPLETED payment and returns the cached result — **no second charge**.

---

## 8. Failure & Recovery Scenarios

### PSP Timeout (Stripe Does Not Respond Within 5s)

**Impact:** We do not know if the charge succeeded or not. This is the most dangerous state — we cannot tell Alice "success" or "failure" with certainty.

**Handling:**

1. Transition payment to `REQUIRES_RETRY` state
2. Return `202 Accepted` to Alice with message: "Payment is being processed"
3. Retry worker picks up after exponential backoff (2s, 4s, 8s, 16s)
4. Before retrying the CHARGE, query Stripe: `GET /v1/charges?metadata[internal_payment_id]=pay_uuid_001`
5. If Stripe says it was charged → mark COMPLETED (do NOT charge again)
6. If Stripe says no record → safe to retry the charge
7. After 3 failed retries → move to Dead Letter Queue, alert on-call, notify Alice

### Double-Charge Prevention (Network Partition Mid-Payment)

**Scenario:** Our service calls Stripe, Stripe charges the card, but the response is lost due to a network partition. Our system thinks it failed and retries.

**Mitigation:** Stripe's own idempotency key. We send OUR `payment_id` as Stripe's `Idempotency-Key` header. If Stripe receives the same key twice, it returns the cached result from the first call without charging again. This is defense-in-depth: OUR idempotency key protects against client retries, and STRIPE's idempotency key protects against our retries.

```text
POST https://api.stripe.com/v1/charges
Headers: Idempotency-Key: pay_uuid_001   ← OUR payment ID as Stripe's dedup key
```

### Database Goes Down (Payment DB Unreachable)

**Impact:** No new payments can be processed. In-flight payments that already called Stripe but have not persisted the result are the critical concern.

**Mitigation:**

1. Circuit breaker opens after 5 consecutive failures — return `503` immediately (fail fast)
2. For in-flight payments: the retry worker will reconcile state from Stripe when DB recovers
3. PostgreSQL with synchronous replication to standby — automatic failover in <30s
4. During the 30s gap: ~360 payments at peak could be affected, all recoverable via Stripe state query

### Kafka Goes Down (Events Not Publishing)

**Impact:** Notifications delayed, order fulfillment delayed. Payments still process correctly (Kafka is not in the critical payment path).

**Mitigation:** Transactional outbox pattern. Events are written to a database table in the same transaction as the payment update. A separate poller reads unprocessed outbox rows and publishes to Kafka. If Kafka is down, events accumulate in the outbox table and drain when Kafka recovers. Zero event loss.

---

## 9. Data Model

```text
/* ━━━ Payment DB (PostgreSQL) ━━━ */

CREATE TABLE payments (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key   VARCHAR(64) UNIQUE NOT NULL,
    amount            BIGINT      NOT NULL,              -- in smallest currency unit (cents)
    currency          VARCHAR(3)  NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'CREATED',
    merchant_id       VARCHAR(64) NOT NULL,
    order_id          VARCHAR(64),
    payment_method    VARCHAR(20) NOT NULL,              -- 'card', 'wallet', 'bank_transfer'
    psp_charge_id     VARCHAR(128),                      -- from Stripe/Adyen response
    failure_reason    TEXT,
    retry_count       INT         DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMPTZ,
    
    CONSTRAINT valid_status CHECK (status IN (
        'CREATED', 'PROCESSING', 'PSP_CALLED', 'COMPLETED', 
        'FAILED', 'REQUIRES_RETRY', 'REFUND_PENDING', 'REFUNDED', 'REVERSED'
    ))
);

CREATE INDEX idx_payments_status ON payments (status) WHERE status IN ('REQUIRES_RETRY', 'PROCESSING');
CREATE INDEX idx_payments_merchant ON payments (merchant_id, created_at DESC);
CREATE INDEX idx_payments_order ON payments (order_id);
```

```text
/* ━━━ Ledger DB (PostgreSQL, separate instance) ━━━ */

CREATE TABLE ledger_entries (
    id              BIGSERIAL   PRIMARY KEY,
    payment_id      UUID        NOT NULL,
    account_id      VARCHAR(128) NOT NULL,       -- "buyer:alice_123", "seller:merchant_456", "platform:fees"
    entry_type      VARCHAR(6)  NOT NULL,        -- 'DEBIT' or 'CREDIT'
    amount          BIGINT      NOT NULL,        -- always positive; sign determined by entry_type
    currency        VARCHAR(3)  NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_entry_type CHECK (entry_type IN ('DEBIT', 'CREDIT'))
);

-- Critical: immutable table. No UPDATE or DELETE triggers allowed.
-- REVOKE UPDATE, DELETE ON ledger_entries FROM payment_service_role;

CREATE INDEX idx_ledger_account ON ledger_entries (account_id, created_at DESC);
CREATE INDEX idx_ledger_payment ON ledger_entries (payment_id);
```

```text
/* ━━━ Outbox Table (same DB as payments for transactional guarantee) ━━━ */

CREATE TABLE payment_outbox (
    id              BIGSERIAL   PRIMARY KEY,
    payment_id      UUID        NOT NULL,
    event_type      VARCHAR(50) NOT NULL,       -- 'PaymentCompleted', 'PaymentFailed', etc.
    payload         JSONB       NOT NULL,
    published       BOOLEAN     DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at    TIMESTAMPTZ
);

CREATE INDEX idx_outbox_unpublished ON payment_outbox (created_at) WHERE published = FALSE;
```

```text
/* ━━━ Reconciliation Results ━━━ */

CREATE TABLE reconciliation_results (
    id              BIGSERIAL   PRIMARY KEY,
    reconcile_date  DATE        NOT NULL,
    payment_id      UUID        NOT NULL,
    our_status      VARCHAR(20) NOT NULL,
    psp_status      VARCHAR(20) NOT NULL,
    our_amount      BIGINT,
    psp_amount      BIGINT,
    discrepancy_type VARCHAR(30),    -- 'STATUS_MISMATCH', 'AMOUNT_MISMATCH', 'MISSING_IN_PSP', 'MISSING_IN_US'
    resolved        BOOLEAN     DEFAULT FALSE,
    resolution_note TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 10. Algorithms Under the Hood

### Payment State Machine

```text
                          ┌─────────────────────────────────────────────┐
                          │                                             │
                          ▼                                             │
    ┌─────────┐    ┌────────────┐    ┌───────────┐    ┌───────────┐   │
    │ CREATED │───▶│ PROCESSING │───▶│ PSP_CALLED│───▶│ COMPLETED │   │
    └─────────┘    └────────────┘    └───────────┘    └───────────┘   │
                          │                                  │          │
                          │ timeout                          │ refund   │
                          ▼                                  ▼          │
                   ┌──────────────┐              ┌──────────────────┐  │
                   │REQUIRES_RETRY│──(max 3)───▶ │     FAILED       │──┘
                   └──────────────┘              └──────────────────┘
                          │                              (user can retry
                          │ retry                         with new key)
                          ▼
                   ┌────────────┐
                   │ PROCESSING │  (back to PSP call)
                   └────────────┘

State Transition Rules:
  CREATED → PROCESSING       : Payment accepted, about to call PSP
  PROCESSING → PSP_CALLED    : PSP responded (not yet persisted in ledger)
  PSP_CALLED → COMPLETED     : Ledger entries written, fully committed
  PROCESSING → REQUIRES_RETRY: PSP timeout or 5xx error
  REQUIRES_RETRY → PROCESSING: Retry attempt (after backoff)
  REQUIRES_RETRY → FAILED    : Max retries (3) exceeded
  COMPLETED → REFUND_PENDING : Refund requested
  REFUND_PENDING → REFUNDED  : PSP confirms refund
  COMPLETED → REVERSED       : Late webhook reversal (rare)
```

### Idempotency Key Implementation

```text
function processPayment(idempotencyKey, request):
    // Step 1: Atomic check-and-insert using UNIQUE constraint
    existing = db.query(
        "SELECT * FROM payments WHERE idempotency_key = $1", idempotencyKey
    )
    
    if existing != null:
        if existing.status == 'COMPLETED':
            return existing.toResponse()       // safe to return cached result
        if existing.status == 'PROCESSING':
            return 409("Payment in progress")  // concurrent duplicate request
        if existing.status == 'FAILED':
            return existing.toResponse()       // failed result is also cached
    
    // Step 2: Create new payment
    payment = db.insert(
        "INSERT INTO payments (id, idempotency_key, amount, currency, status)
         VALUES ($1, $2, $3, $4, 'CREATED')",
        newUUID(), idempotencyKey, request.amount, request.currency
    )
    // ON CONFLICT (idempotency_key) DO NOTHING handles race condition
    
    // Step 3: Call PSP
    payment.status = 'PROCESSING'
    db.update(payment)
    
    pspResult = callPSP(payment)              // 200-400ms
    
    // Step 4: Record result atomically with ledger
    BEGIN TRANSACTION
        payment.status = pspResult.success ? 'COMPLETED' : 'FAILED'
        payment.psp_charge_id = pspResult.chargeId
        db.update(payment)
        
        if pspResult.success:
            insertLedgerEntries(payment)
            insertOutboxEvent(payment, 'PaymentCompleted')
    COMMIT
    
    return payment.toResponse()
```

### Exponential Backoff with Jitter

```text
function calculateRetryDelay(retryCount):
    baseDelay = 2000ms        // 2 seconds
    maxDelay = 30000ms        // 30 seconds cap
    
    exponentialDelay = baseDelay * (2 ^ retryCount)
    cappedDelay = min(exponentialDelay, maxDelay)
    
    // Add jitter to prevent thundering herd
    jitter = random(0, cappedDelay * 0.3)
    return cappedDelay + jitter

// Retry schedule: 2s, 4s, 8s (then give up after 3 attempts)
// With jitter:    2.4s, 5.1s, 9.7s (approximate)
```

### Double-Entry Ledger Balance Calculation

```text
function getAccountBalance(accountId, currency):
    result = db.query("""
        SELECT 
            SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) -
            SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) as balance
        FROM ledger_entries
        WHERE account_id = $1 AND currency = $2
    """, accountId, currency)
    return result.balance

// For buyer:alice_123  → balance is negative (she spent money)
// For seller:merchant  → balance is positive (she received money)
// For platform:fees    → balance is positive (commission collected)
// SUM of ALL accounts  → always $0.00 (books are balanced)

function validateLedgerIntegrity():
    result = db.query("""
        SELECT currency, 
            SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) as net
        FROM ledger_entries
        GROUP BY currency
    """)
    for row in result:
        assert row.net == 0, "CRITICAL: Ledger imbalance in " + row.currency
```

### Reconciliation Algorithm

```text
function dailyReconciliation(date):
    // Step 1: Fetch PSP settlement file
    pspRecords = stripe.getSettlement(date)      // { charge_id → {amount, status} }
    
    // Step 2: Fetch our records for that day
    ourRecords = db.query(
        "SELECT * FROM payments WHERE DATE(created_at) = $1 AND status != 'CREATED'",
        date
    )
    
    // Step 3: Compare each record
    exceptions = []
    
    for payment in ourRecords:
        pspRecord = pspRecords.get(payment.psp_charge_id)
        
        if pspRecord == null AND payment.status == 'COMPLETED':
            exceptions.add({type: 'MISSING_IN_PSP', payment: payment})
            // We think it succeeded but PSP has no record — CRITICAL
            
        elif pspRecord != null AND payment.status == 'FAILED':
            exceptions.add({type: 'CHARGED_BUT_MARKED_FAILED', payment: payment})
            // Customer was charged but we told them it failed — CRITICAL
            
        elif pspRecord != null AND abs(payment.amount - pspRecord.amount) > 1:
            exceptions.add({type: 'AMOUNT_MISMATCH', payment: payment})
            // Rounding or currency conversion issue
    
    // Step 4: Check for PSP records we don't have
    for chargeId, pspRecord in pspRecords:
        if not ourRecords.containsChargeId(chargeId):
            exceptions.add({type: 'MISSING_IN_US', chargeId: chargeId})
            // PSP charged someone but we have no record — orphan charge
    
    // Step 5: Alert and report
    if exceptions.hasCritical():
        pagerDuty.alert("CRITICAL reconciliation mismatch", exceptions)
    
    generateFinanceReport(date, exceptions)
    return exceptions
```

---

## 11. Scaling Considerations

| Challenge | Solution | Numbers |
|---|---|---|
| Peak traffic (Black Friday) | Horizontal scaling of stateless Payment Service behind LB | 360 TPS peak handled by 6 instances at 60 TPS each |
| Database write bottleneck | Partition payments table by `created_at` (monthly partitions) | Each partition < 30M rows; old partitions archived to cold storage |
| Ledger query performance | Materialized balance views refreshed every 5 min | Avoids scanning 5.4B rows for balance queries |
| PSP rate limits | Connection pooling + circuit breaker per PSP; multi-PSP failover | If Stripe rate-limits, route to Adyen within 100ms |
| Multi-region deployment | Active-passive with payment state replicated via PostgreSQL streaming | RPO=0 (sync replication), RTO<60s (automatic failover) |
| Reconciliation at scale | Parallel processing by merchant; partition settlement files by date | 1M records reconciled in <15 min with 4 parallel workers |
| Audit trail storage growth | Event sourcing with time-series partitioning; archive to S3 after 1 year | Hot: 1 year in PostgreSQL (~700 GB); Cold: S3 Glacier (pennies/GB) |

---

## 12. Security

| Threat | Mitigation |
|---|---|
| **Card data exposure** | Never store card numbers. Use PSP tokenization (Stripe Elements / Adyen Drop-in). Token `tok_visa_4242` is useless without your Stripe secret key. |
| **PCI DSS compliance** | Hosted payment fields mean card data never touches your servers. Qualify for SAQ-A (simplest level). If you handle raw card data, you need SAQ-D (300+ controls). |
| **Man-in-the-middle** | TLS 1.3 on all connections. Certificate pinning for PSP API calls. HSTS headers on payment pages. |
| **Amount tampering** | Server-side price lookup from order service. Never trust client-submitted amounts. Compare `request.amount` against `orderService.getTotal(orderId)`. |
| **Internal fraud** | Four-eyes principle: refunds > $500 require two approvals. All admin actions logged with user identity. |
| **Replay attacks** | Idempotency key + timestamp validation (reject keys older than 24 hours). Webhook signature verification (HMAC-SHA256). |
| **SQL injection** | Parameterized queries exclusively. ORM with query builder. No raw string concatenation. |
| **DDoS on payment endpoint** | Rate limiting: 10 payment attempts/min per user, 100/min per IP. CAPTCHA after 3 failures. |

---

## 13. What If the Interviewer Pushes Back?

??? question "Why not use 2PC (Two-Phase Commit) instead of the Saga pattern?"
    **Defend:** 2PC requires ALL participants to support the XA protocol and hold locks during the prepare phase. Stripe, Adyen, and PayPal do not participate in distributed transactions — they are external HTTP APIs with their own consistency guarantees. Even internally, 2PC is fragile: if the coordinator crashes after sending PREPARE but before COMMIT, all participants are stuck holding locks indefinitely. The saga pattern with compensating actions (void the charge, reverse the ledger entry) provides the same eventual correctness without distributed locks, and it works across system boundaries.

??? question "What happens if the idempotency key database check and the PSP call are not atomic?"
    **Defend:** They do not need to be atomic — they need to be *idempotent end-to-end*. The flow is: (1) persist CREATED status with idempotency key, (2) call PSP with our payment_id as THEIR idempotency key. If we crash between steps 1 and 2, the retry worker picks it up and calls the PSP. If we crash between PSP response and persisting COMPLETED, the retry worker queries the PSP ("did this charge go through?") before retrying. At every failure point, there is a recovery path that converges to the correct state. This is the *exactly-once delivery via idempotent operations* pattern — you do not need distributed transactions, you need idempotent retries.

??? question "How do you handle a payment that succeeds at the PSP but the database is down when you try to record it?"
    **Defend:** This is the classic "in-doubt" transaction. The payment status is stuck at PROCESSING in whatever state was last persisted. When the database recovers, the retry worker wakes up, sees PROCESSING status, queries Stripe: "Was charge `pay_uuid_001` successful?" Stripe confirms yes, we update to COMPLETED and write ledger entries. The customer may see a brief delay ("Processing...") but is never double-charged because Stripe's idempotency key prevents a second charge. Design principle: the PSP is the source of truth for charge status; our DB is a reflection that can heal itself.

??? question "Why separate Payment DB and Ledger DB? Why not one database?"
    **Defend:** Separation provides: (1) **Independent scaling** — the ledger grows 3x faster than payments (3 entries per payment) and benefits from append-only optimizations. (2) **Access control** — the ledger DB has no UPDATE/DELETE permissions granted to any application role; this is enforced at the database level for audit compliance. (3) **Independent backup/retention** — ledger must be retained for 7+ years (regulatory); payment operational data can be archived after 1 year. In a startup or early-stage system, a single DB is fine — split when you hit compliance or scale boundaries.

??? question "What if Stripe goes down entirely for an hour during peak traffic?"
    **Defend:** Multi-PSP failover. Payment Service maintains a PSP router: if Stripe circuit breaker opens (5 consecutive 5xx responses), route new payments to Adyen automatically. For in-flight Stripe payments, they enter REQUIRES_RETRY state with retry scheduled for when the circuit breaker closes. The router checks Stripe health every 30s with a lightweight ping. Recovery priority: (1) serve new payments via backup PSP, (2) reconcile in-flight payments when primary recovers, (3) alert on-call for manual review of edge cases.

---

## 14. Quick Recall

| Question | Answer |
|---|---|
| How to prevent double-charge? | Client-generated idempotency key + DB unique constraint + PSP-level idempotency key |
| State machine states? | CREATED → PROCESSING → PSP_CALLED → COMPLETED / FAILED / REQUIRES_RETRY |
| Why saga not 2PC? | PSPs are external HTTP APIs that do not support distributed transactions |
| Ledger design? | Double-entry: every payment = debit buyer + credit seller + credit platform. Sum = $0 always. |
| What if PSP times out? | Query PSP for charge status before retrying. Never blind-retry a charge. |
| Reconciliation frequency? | Daily T+1 batch. Settlement files arrive next business day from PSP. |
| Retry strategy? | Exponential backoff with jitter: 2s, 4s, 8s. Max 3 retries then DLQ. |
| Database choice? | PostgreSQL for ACID transactions on payment writes + ledger integrity |
| PCI compliance approach? | Never touch raw card data. Use PSP hosted fields (Stripe Elements). Qualify for SAQ-A. |
| What if DB is down mid-payment? | PSP is source of truth. Retry worker queries PSP on recovery, heals our state. |
| How to handle late webhooks? | Mark internal status as REVERSED, reverse ledger entries, notify customer, trigger compensation. |
| Scale numbers? | 1M txns/day, 12 TPS avg, 360 TPS peak, $10B annual, 1.8 TB storage (5yr) |
