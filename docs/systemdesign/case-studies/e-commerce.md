---
description: "Design an e-commerce platform at Amazon scale — system design interview walkthrough covering inventory management, order state machines, search ranking, cart merging, and scaling to 50K orders/sec on Prime Day."
---

# E-Commerce Platform (Amazon Scale)

!!! danger "Real Incident: Amazon Prime Day 2018 — 75 Minutes of Global Outage"
    At 3:10 PM ET on July 16, 2018, Amazon's Prime Day kicked off — and immediately collapsed. The product catalog service buckled under traffic 3x the projected peak. Add-to-cart buttons returned errors. Search returned empty results. The site displayed dog photos (their custom error page) to millions of shoppers worldwide. Root cause: the product catalog microservice's connection pool to DynamoDB saturated, causing cascading timeouts across Cart, Search, and Recommendation services that all depended on product data. The 75-minute outage cost an estimated $72-99M in lost revenue. Post-mortem changes: pre-provisioned DynamoDB capacity with aggressive headroom, circuit breakers between every service pair, and a "catalog lite" degraded mode that serves cached product data when the primary catalog is unavailable. **An e-commerce platform at scale must assume every dependency will fail — the architecture must degrade gracefully, never catastrophically.**

---

## System Design Concepts Used

`Microservices` . `Event-Driven Architecture (Kafka)` . `Saga Pattern` . `Optimistic Locking` . `Elasticsearch` . `Redis (Cart/Cache)` . `CQRS` . `Database Sharding` . `Circuit Breaker` . `Load Balancer` . `CDN` . `Order State Machine` . `Eventual Consistency` . `Distributed Transactions` . `Rate Limiting`

---

## 1. Functional Requirements

1. **Product Catalog** — browse, search, and view detailed product pages (500M+ SKUs)
2. **Search & Discovery** — full-text search with filters (price, brand, ratings), autocomplete, and ranked results
3. **Shopping Cart** — add/remove/update items; session-based for guests, persistent for logged-in users; merge on login
4. **Checkout & Order Placement** — address selection, payment processing, order confirmation
5. **Inventory Management** — real-time stock tracking; prevent overselling even under concurrent purchases
6. **Payment Processing** — integrate with payment gateways; handle retries, idempotency, refunds
7. **Order Tracking** — state machine from creation through delivery; notifications at each transition
8. **Recommendations** — "frequently bought together," "customers also viewed," personalized homepage

## 2. Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Availability** | 99.99% (< 52 min/year) | Every minute of downtime = $1.3M lost revenue at Amazon scale |
| **Search latency** | < 200ms p99 | Users abandon after 3s; search must feel instant |
| **Checkout latency** | < 500ms p99 | Slow checkout = abandoned carts (7% drop per 100ms) |
| **Order throughput** | 50K orders/sec peak | Prime Day generates 10x normal traffic in first hour |
| **Inventory accuracy** | Zero overselling | A confirmed order MUST have reserved stock |
| **Consistency** | Strong for inventory/orders, Eventual for search/catalog | Users tolerate stale search results, never double-sold items |
| **Durability** | Zero order loss | Payment captured = order must persist (RPO = 0) |

---

## 3. Capacity Estimation

```text
/* ━━━ NAPKIN MATH: Start From Users ━━━ */
Registered users: 300M
DAU: 50M (17% of registered)
DAU on Prime Day: 150M (3x normal)

/* ━━━ SEARCH ━━━ */
Searches/day (normal): 50M users × 5 searches = 250M/day
Search QPS (avg): 250M / 86,400 ≈ 2,900/sec
Search QPS (Prime Day peak): 2,900 × 10 = 29,000/sec

/* ━━━ PRODUCT PAGE VIEWS ━━━ */
Views/day: 50M × 20 pages = 1B/day
Page view QPS (avg): 1B / 86,400 ≈ 11,500/sec
Page view QPS (peak): ~115,000/sec → CDN must absorb 80%+

/* ━━━ ORDERS ━━━ */
Orders/day (normal): 5M
Order QPS (avg): 5M / 86,400 ≈ 58/sec
Order QPS (Prime Day peak): 50,000/sec (burst in first hour)
Orders in first hour of Prime Day: ~50M

/* ━━━ CART ━━━ */
Cart operations/sec (peak): 200K (add/update/remove)
Active carts at any time: ~10M
Cart data per user: ~2 KB (10 items × 200 bytes)
Total hot cart data: 10M × 2 KB = 20 GB → fits in Redis cluster

/* ━━━ INVENTORY ━━━ */
Products in catalog: 500M SKUs
Products with active inventory: ~100M
Inventory updates/sec (peak): 500K (order reservations + restocks)

/* ━━━ STORAGE ━━━ */
Product data: 500M × 5 KB (text) = 2.5 TB
Product images: 500M × 10 images × 500 KB = 2.5 PB (S3 + CDN)
Order history (5yr): 5M/day × 365 × 5 × 2 KB = 18 TB
Search index: ~500 GB (Elasticsearch)

/* ━━━ BANDWIDTH ━━━ */
Peak inbound (API): ~2 GB/sec
Peak outbound (pages + images): ~50 GB/sec → 90% from CDN
```

!!! note "System Nature"
    **Write-heavy for orders and inventory during peak events, read-heavy for browsing and search at all times.** The architecture must handle both patterns: aggressive caching for reads, and strong consistency with optimistic locking for the order/inventory write path. The hardest challenge is the 50K orders/sec burst where each order must atomically reserve inventory without overselling.

---

## 4. "Why X, Not Y?" — Tradeoff Analysis

### Why Microservices and not a Monolith?

**Microservices win because each domain (catalog, cart, order, inventory, payment) has wildly different scaling profiles.** On Prime Day, Search needs 10x more instances while Fulfillment stays flat. A monolith forces you to scale everything together — wasting 80% of the compute budget. Independent deployment also means the Recommendation team can ship daily without risking the checkout flow.

*Monolith advantage:* Simpler local development, no distributed transaction headaches, lower operational overhead. Ideal for early-stage (< $10M revenue) when team size is < 20 engineers.

### Why Event-Driven (Kafka) and not Synchronous REST Calls?

**Kafka decouples services temporally — Order Service publishes "OrderPlaced" and does NOT wait for Inventory, Payment, and Fulfillment to respond.** If Fulfillment is down for 5 minutes, events queue in Kafka and process when it recovers. With synchronous REST, a downstream timeout cascades into user-facing errors. At 50K orders/sec, synchronous fan-out to 5 services means 250K synchronous calls — a single slow service brings everything down.

*Synchronous advantage:* Simpler to reason about, immediate consistency, easier debugging. Use for the critical checkout path where you NEED payment confirmation before showing "Order Confirmed."

### Why Elasticsearch and not a Custom Search Engine?

**Elasticsearch provides inverted indexes, BM25 ranking, faceted filtering, fuzzy matching, and autocomplete out of the box.** Building equivalent functionality from scratch would take 50+ engineers multiple years. At 500M products, an ES cluster of 50 nodes handles 30K searches/sec with < 100ms latency. The trade-off is operational complexity (garbage collection tuning, shard rebalancing) — but this is well-understood at scale.

*Custom search advantage:* Amazon actually uses a custom engine (A9) for deeper integration with ML ranking, real-time personalization, and ad auction placement. Only justified when search IS your core product differentiator and you have 100+ search engineers.

### Why Redis for Cart and not the Database?

**Shopping carts are ephemeral, high-frequency, and latency-sensitive.** A user adding/removing items generates 5-10 writes per session. At 200K cart ops/sec, a relational database would need dozens of write replicas. Redis handles 1M+ ops/sec on a single node with sub-millisecond latency. Cart data is small (< 2 KB per user) and acceptable to lose on Redis failure (user re-adds items — annoying but not catastrophic).

*Database advantage:* Durability — Redis persistence (RDB/AOF) is not zero-loss. For logged-in users, persist the cart to the database asynchronously (write-behind) so it survives across devices and Redis failures. Use Redis as the fast path, DB as the durable backup.

---

## 5. High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS (Web / Mobile / API)                            │
└─────────────────────┬───────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         CDN (CloudFront) + WAF + Rate Limiter                        │
│          Static assets, product images, cached catalog pages (80% hit rate)          │
└─────────────────────┬───────────────────────────────────────────────────────────────┘
                      │ cache miss / API calls
                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            API Gateway / Load Balancer                                │
│         Route: /search → Search, /cart → Cart, /orders → Order, etc.                 │
│         Auth, rate limiting, request logging, circuit breaker                         │
└──┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────────────┘
   │          │          │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼          ▼          ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐ ┌──────┐ ┌──────────┐ ┌────────────────┐
│Search│ │Catalog│ │ Cart │ │  Order   │ │Inven-│ │ Payment  │ │ Recommendation │
│ Svc  │ │ Svc  │ │ Svc  │ │  Svc     │ │tory  │ │   Svc    │ │     Svc        │
└──┬───┘ └──┬───┘ └──┬───┘ └────┬─────┘ └──┬───┘ └────┬─────┘ └───────┬────────┘
   │         │        │          │           │          │                │
   ▼         ▼        ▼          ▼           ▼          ▼                ▼
┌──────┐ ┌───────┐ ┌─────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
│Elast-│ │Product│ │Redis│ │Order DB │ │Inventory│ │ Payment  │ │   ML Model   │
│search│ │  DB   │ │Clust│ │(sharded)│ │   DB    │ │ Gateway  │ │   Store      │
│Clust.│ │(Dynamo│ │er   │ │PostgreSQL│ │PostgreSQL│ │(Stripe/  │ │(Feature DB)  │
└──────┘ │  DB)  │ └─────┘ └─────────┘ └─────────┘ │ internal)│ └──────────────┘
         └───────┘                                   └──────────┘

                    ┌─────────────────────────────────┐
                    │        Kafka Event Bus           │
                    │  Topics: orders, inventory,      │
                    │  payments, notifications         │
                    └──────────┬──────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        ┌────────────┐  ┌────────────┐  ┌────────────┐
        │Fulfillment │  │Notification│  │ Analytics  │
        │  Service   │  │  Service   │  │  Pipeline  │
        └────────────┘  └────────────┘  └────────────┘
```

---

## 6. Architecture Flow — "Wireless Headphones" Purchase

A user named **Priya** in Mumbai searches for "wireless headphones," adds one to her cart, and checks out during Prime Day. Here is the complete trace across all services.

### Phase 1 — Search & Discovery

**T+0ms:** Priya types "wireless headphones" in the search bar. After 3 characters, the frontend fires an autocomplete request.

**T+15ms:** API Gateway routes to **Search Service**. Autocomplete hits a Redis-cached prefix trie: returns top 5 suggestions ("wireless headphones," "wireless headphones bluetooth," "wireless headphones noise cancelling," ...) in < 20ms.

**T+200ms:** Priya presses Enter. Full search request hits **Elasticsearch** cluster.

**T+250ms:** Elasticsearch executes a multi-stage query:

```text
1. Token analysis: "wireless headphones" → ["wireless", "headphones"]
2. Inverted index lookup → 15,000 matching products
3. Filtering: in_stock=true, ships_to=IN, Prime_eligible=true → 8,200 products
4. BM25 text relevance score
5. ML re-ranking: personalization (Priya's history), conversion rate, seller rating
6. Return top 48 results (page 1) with facets (brand, price range, rating)
```

**T+280ms:** Search Service enriches results with real-time data (price, stock badge) from Redis cache. Returns response.

```text
Priya → CDN (miss) → API GW → Search Svc → ES Cluster + Redis enrichment → results (280ms)
```

### Phase 2 — Add to Cart

**T+5sec:** Priya clicks "Add to Cart" on Sony WH-1000XM5 (SKU: `SONY-WH1000XM5-BLK`).

**T+5.002sec:** API Gateway routes to **Cart Service**. Priya is logged in, so Cart Service uses her `user_id` as the cart key.

**T+5.003sec:** Cart Service executes:

```text
1. Redis HSET cart:{user_id} SONY-WH1000XM5-BLK '{"qty":1,"price":29999,"added_at":"..."}'
2. Redis EXPIRE cart:{user_id} 2592000  (30-day TTL)
3. Async: write-behind to Cart DB (PostgreSQL) for durability
4. Async: publish CartUpdated event to Kafka (for recommendation engine)
```

**T+5.005sec:** Response returned — "Added to cart" badge updates. Total latency: **3ms**.

```text
Priya → API GW → Cart Svc → Redis (write) → success (3ms)
                          → async: DB persist + Kafka event
```

### Phase 3 — Checkout & Order Placement (The Critical Path)

**T+30sec:** Priya clicks "Proceed to Checkout." This is where the hard distributed systems problems live.

**Step 1: Cart Validation (T+30.000s)**

Cart Service retrieves all items, validates each is still available by querying Inventory Service:

```text
For each item in cart:
  GET /inventory/{sku}/available → returns {available: 847, reserved: 153}
  If available < requested_qty → mark item as "out of stock" in response
```

**Step 2: Order Creation (T+30.050s)**

Order Service creates the order in `CREATED` state:

```text
INSERT INTO orders (order_id, user_id, status, items, total, created_at)
VALUES ('ORD-7829341', 'USR-PRIYA', 'CREATED', [...], 29999, NOW())
```

**Step 3: Inventory Reservation (T+30.060s) — THE HARDEST PART**

Order Service calls Inventory Service to **reserve** stock (not decrement yet):

```text
BEGIN TRANSACTION
  SELECT quantity, version FROM inventory WHERE sku = 'SONY-WH1000XM5-BLK' FOR UPDATE
  -- quantity = 847, version = 4291
  IF quantity >= 1:
    UPDATE inventory SET quantity = quantity - 1, version = version + 1
      WHERE sku = 'SONY-WH1000XM5-BLK' AND version = 4291
    -- Optimistic lock: if version changed (concurrent update), RETRY
    INSERT INTO reservations (order_id, sku, qty, expires_at)
      VALUES ('ORD-7829341', 'SONY-WH1000XM5-BLK', 1, NOW() + INTERVAL '10 min')
  ELSE:
    ROLLBACK → return "OUT_OF_STOCK"
COMMIT
```

**Step 4: Payment Processing (T+30.100s)**

Order transitions to `PAYMENT_PENDING`. Payment Service calls Stripe:

```text
Order Svc → Payment Svc → Stripe API
  charge_id = stripe.charges.create(amount=29999, currency='INR', idempotency_key='ORD-7829341')
  // Idempotency key prevents double-charging on retry
```

**Step 5: Order Confirmation (T+30.500s)**

Payment succeeds. Order transitions to `CONFIRMED`. Events cascade:

```text
Order Svc publishes to Kafka: "OrderConfirmed" {order_id, items, address, ...}
  → Fulfillment Svc: assigns warehouse, generates shipping label
  → Notification Svc: sends email + push notification to Priya
  → Inventory Svc: converts reservation to permanent decrement
  → Analytics: records conversion event
```

**T+30.600s:** Priya sees "Order Confirmed! Arriving Thursday."

```text
Full checkout trace:
Priya → API GW → Cart Svc (validate) → Order Svc (create)
  → Inventory Svc (reserve, optimistic lock)
  → Payment Svc (charge via Stripe, idempotent)
  → Order Svc (confirm) → Kafka → [Fulfillment, Notification, Analytics]
Total: ~600ms
```

---

## 7. Failure & Recovery Scenarios

### Scenario 1: Payment Succeeds but Order Service Crashes

**The nightmare scenario.** Priya's credit card is charged $299.99, but Order Service dies before persisting `CONFIRMED` status.

**Recovery via Saga Compensating Transaction:**

```text
1. Payment Service publishes "PaymentCaptured" event to Kafka (durable, replicated)
2. Order Service restarts. On boot, it replays unprocessed Kafka events.
3. Finds "PaymentCaptured" for ORD-7829341 with no matching "OrderConfirmed"
4. Reconstructs order state from Kafka event log → marks as CONFIRMED
5. If reconstruction fails after 3 retries:
   → Saga compensation: Payment Service issues automatic refund
   → Notification Service alerts Priya: "Order failed, refund issued"
   → Inventory Service releases the reservation
```

**Key design principle:** The Kafka event log is the **source of truth**. Services are stateless consumers that can replay events to rebuild state. Payment capture ALWAYS publishes to Kafka BEFORE acknowledging to Order Service — so even if Order Service crashes, the event survives.

### Scenario 2: Inventory Service Down During Checkout

**Impact:** Cannot reserve stock. Orders cannot proceed past `CREATED` state.

**Mitigation — Circuit Breaker + Graceful Degradation:**

```text
1. Circuit breaker opens after 5 consecutive Inventory Service timeouts
2. Order Service switches to "optimistic mode":
   - Creates order with status PENDING_INVENTORY_CHECK
   - Responds to user: "Order received! Confirming availability..."
   - Queues reservation request in Kafka
3. When Inventory Service recovers:
   - Processes queued reservations in order
   - If stock available: confirms order normally
   - If out of stock: cancels order, notifies user, triggers refund
```

**Trade-off:** Risk of confirming orders that will be cancelled (bad UX) vs. refusing ALL orders during outage (worse UX + lost revenue).

### Scenario 3: Redis Cart Cluster Fails

**Impact:** 10M active carts become inaccessible.

**Mitigation:**

```text
1. Cart Service falls back to PostgreSQL (cart_backup table)
   - Write-behind ensures carts are persisted with < 5s staleness
   - Latency increases from 3ms to 15ms (acceptable for cart operations)
2. Redis Cluster uses 3 replicas per shard — single node failure is transparent
3. Full cluster failure: serve from DB, queue cart writes in memory + Kafka
4. Recovery: warm Redis from DB using background scan (10M carts × 2KB = 20GB, ~5 min)
```

### Scenario 4: Elasticsearch Cluster Degraded

**Impact:** Search latency spikes from 50ms to 2s+. Users see slow or empty results.

**Mitigation:**

```text
1. Circuit breaker reduces ES queries to "simple mode" (fewer filters, no ML re-ranking)
2. Serve cached "top results" per category from Redis (pre-computed hourly)
3. Autocomplete continues from Redis prefix cache (independent of ES)
4. Product pages still accessible via direct URL (Catalog Service is unaffected)
5. "Browse by category" fallback shows pre-computed product lists
```

### Scenario 5: "Thundering Herd" on Prime Day Launch (T=0)

**Impact:** 150M users hit the site simultaneously. Traffic jumps 100x in < 60 seconds.

**Mitigation:**

```text
1. Pre-warm: 30 min before launch, scale all services to Prime Day capacity
2. CDN pre-cache: push deal pages to all CDN PoPs before launch
3. Queue-based admission: checkout requests enter a virtual queue (like ticket systems)
   - User sees: "You're in line! Estimated wait: 2 minutes"
   - Prevents inventory service from being overwhelmed with 50K concurrent reservations
4. Rate limiting per user: max 5 orders/minute prevents bot abuse
5. Deal inventory: pre-partitioned across inventory shards to avoid hot-key contention
```

---

## 8. Data Model

```text
/* ━━━ PRODUCT CATALOG (DynamoDB) ━━━ */

Table: products
  PK: sku (String)          -- "SONY-WH1000XM5-BLK"
  Attributes:
    title        String     -- "Sony WH-1000XM5 Wireless Headphones"
    description  String     -- Rich text, 2-5 KB
    brand        String     -- "Sony"
    category     List       -- ["Electronics", "Headphones", "Over-Ear"]
    price        Number     -- 29999 (cents, avoids floating point)
    images       List       -- [S3 URLs]
    attributes   Map        -- {"color": "Black", "connectivity": "Bluetooth 5.2", ...}
    rating       Number     -- 4.7
    review_count Number     -- 12847
    seller_id    String     -- "SELLER-SONY-OFFICIAL"
    created_at   String     -- ISO 8601

  GSI: category-price-index (category, price) -- for filtered browsing
  GSI: brand-index (brand, rating)            -- for brand pages
```

```text
/* ━━━ INVENTORY (PostgreSQL — sharded by sku hash) ━━━ */

CREATE TABLE inventory (
    sku           VARCHAR(64)  PRIMARY KEY,
    quantity      INT          NOT NULL CHECK (quantity >= 0),
    reserved      INT          NOT NULL DEFAULT 0,
    warehouse_id  VARCHAR(32)  NOT NULL,
    version       BIGINT       NOT NULL DEFAULT 0,  -- optimistic lock
    updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE reservations (
    reservation_id  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        VARCHAR(32)  NOT NULL,
    sku             VARCHAR(64)  NOT NULL,
    quantity        INT          NOT NULL,
    status          VARCHAR(16)  DEFAULT 'HELD',  -- HELD | CONFIRMED | RELEASED
    expires_at      TIMESTAMPTZ  NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_reservation_expiry ON reservations (expires_at) WHERE status = 'HELD';
CREATE INDEX idx_reservation_order  ON reservations (order_id);
```

```text
/* ━━━ ORDERS (PostgreSQL — sharded by user_id hash) ━━━ */

CREATE TABLE orders (
    order_id     VARCHAR(32)  PRIMARY KEY,
    user_id      VARCHAR(32)  NOT NULL,
    status       VARCHAR(20)  NOT NULL,  -- CREATED|PAYMENT_PENDING|CONFIRMED|SHIPPED|DELIVERED|CANCELLED|RETURNED
    items        JSONB        NOT NULL,  -- [{sku, qty, price, title}]
    subtotal     BIGINT       NOT NULL,  -- cents
    tax          BIGINT       NOT NULL,
    shipping_fee BIGINT       NOT NULL,
    total        BIGINT       NOT NULL,
    address      JSONB        NOT NULL,
    payment_id   VARCHAR(64),
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE order_events (
    event_id    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    VARCHAR(32)   NOT NULL,
    event_type  VARCHAR(32)   NOT NULL,  -- CREATED, PAYMENT_CAPTURED, CONFIRMED, SHIPPED, ...
    payload     JSONB,
    created_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_orders_user   ON orders (user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders (status) WHERE status IN ('CREATED', 'PAYMENT_PENDING');
```

```text
/* ━━━ CART (Redis) ━━━ */

-- Hash per user
HSET cart:USR-PRIYA SONY-WH1000XM5-BLK '{"qty":1,"price":29999,"added_at":"2026-06-07T10:00:00Z"}'
HSET cart:USR-PRIYA KINDLE-PW-2026      '{"qty":1,"price":14999,"added_at":"2026-06-07T10:01:00Z"}'
EXPIRE cart:USR-PRIYA 2592000  -- 30-day TTL

-- Guest cart (session-based)
HSET cart:SESSION-abc123 SONY-WH1000XM5-BLK '{"qty":1,"price":29999,"added_at":"..."}'
EXPIRE cart:SESSION-abc123 86400  -- 24-hour TTL for guests

-- On login: merge guest cart into user cart
-- Conflict resolution: user cart item wins on quantity, guest cart adds new items
```

```text
/* ━━━ SEARCH INDEX (Elasticsearch) ━━━ */

PUT /products
{
  "mappings": {
    "properties": {
      "sku":          {"type": "keyword"},
      "title":        {"type": "text", "analyzer": "standard", "fields": {"keyword": {"type": "keyword"}}},
      "description":  {"type": "text", "analyzer": "standard"},
      "brand":        {"type": "keyword"},
      "category":     {"type": "keyword"},
      "price":        {"type": "integer"},
      "rating":       {"type": "float"},
      "review_count": {"type": "integer"},
      "in_stock":     {"type": "boolean"},
      "prime":        {"type": "boolean"},
      "sales_rank":   {"type": "integer"},
      "embedding":    {"type": "dense_vector", "dims": 768}  -- for semantic search
    }
  }
}
```

---

## 9. Algorithms Under the Hood

### Inventory Reservation with Optimistic Locking

The core challenge: 1000 users trying to buy the last 5 units of a flash-deal item simultaneously. Without proper concurrency control, you oversell.

```text
function reserve_inventory(order_id, sku, requested_qty):
    MAX_RETRIES = 3
    for attempt in range(MAX_RETRIES):
        // Read current state
        row = db.query("SELECT quantity, version FROM inventory WHERE sku = $1", sku)

        if row.quantity < requested_qty:
            return ERROR("OUT_OF_STOCK")

        // Attempt atomic update with version check (optimistic lock)
        affected = db.execute("""
            UPDATE inventory
            SET quantity = quantity - $1, version = version + 1
            WHERE sku = $2 AND version = $3 AND quantity >= $1
        """, requested_qty, sku, row.version)

        if affected == 1:
            // Success — record the reservation
            db.execute("""
                INSERT INTO reservations (order_id, sku, quantity, status, expires_at)
                VALUES ($1, $2, $3, 'HELD', NOW() + INTERVAL '10 minutes')
            """, order_id, sku, requested_qty)
            return SUCCESS(reservation_id)

        // Version conflict — another transaction updated first. Retry.
        sleep(random(5, 50) ms)  // jittered backoff

    return ERROR("CONTENTION_TOO_HIGH")  // after 3 retries, fail gracefully
```

**Why optimistic locking and not pessimistic (SELECT FOR UPDATE)?**

At 50K orders/sec, pessimistic locking means 50K row locks competing for hot SKUs. Lock wait queues grow unbounded, causing timeouts and deadlocks. Optimistic locking allows all 50K reads to proceed immediately — only the actual UPDATE competes, and losers retry (typically 1-2 retries at most for non-flash-deal items).

**Reservation Expiry Daemon:**

```text
// Runs every 30 seconds — releases reservations for abandoned checkouts
function release_expired_reservations():
    expired = db.query("""
        SELECT reservation_id, sku, quantity FROM reservations
        WHERE status = 'HELD' AND expires_at < NOW()
        LIMIT 1000
    """)
    for r in expired:
        db.execute("UPDATE inventory SET quantity = quantity + $1 WHERE sku = $2", r.quantity, r.sku)
        db.execute("UPDATE reservations SET status = 'RELEASED' WHERE reservation_id = $1", r.reservation_id)
```

### Order State Machine

```text
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
┌─────────┐    ┌───────────────┐    ┌───────────┐    ┌─────────┐ │
│ CREATED │───▶│PAYMENT_PENDING│───▶│ CONFIRMED │───▶│ SHIPPED │ │
└─────────┘    └───────────────┘    └───────────┘    └─────────┘ │
     │                │                    │               │       │
     │                │                    │               ▼       │
     │                │                    │          ┌──────────┐ │
     │                │                    │          │DELIVERED │ │
     │                │                    │          └──────────┘ │
     │                │                    │               │       │
     │                ▼                    ▼               ▼       │
     │          ┌──────────┐         ┌──────────┐   ┌──────────┐  │
     └─────────▶│CANCELLED │         │CANCELLED │   │ RETURNED │──┘
                └──────────┘         └──────────┘   └──────────┘
```

```text
VALID_TRANSITIONS = {
    CREATED:         [PAYMENT_PENDING, CANCELLED],
    PAYMENT_PENDING: [CONFIRMED, CANCELLED],      // cancelled if payment fails
    CONFIRMED:       [SHIPPED, CANCELLED],         // cancelled before ship
    SHIPPED:         [DELIVERED],
    DELIVERED:       [RETURNED],                   // return window (30 days)
    CANCELLED:       [],                           // terminal state
    RETURNED:        [CONFIRMED],                  // re-ship if return rejected
}

function transition_order(order_id, new_status, metadata):
    order = db.query("SELECT * FROM orders WHERE order_id = $1 FOR UPDATE", order_id)

    if new_status not in VALID_TRANSITIONS[order.status]:
        return ERROR("Invalid transition: {order.status} → {new_status}")

    db.execute("UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2",
               new_status, order_id)

    // Record event for audit trail and event sourcing
    db.execute("""INSERT INTO order_events (order_id, event_type, payload)
                  VALUES ($1, $2, $3)""", order_id, new_status, metadata)

    // Publish state change to Kafka for downstream services
    kafka.produce("order-events", {
        order_id: order_id,
        previous_status: order.status,
        new_status: new_status,
        timestamp: now(),
        metadata: metadata
    })

    // Trigger side effects based on transition
    match new_status:
        CANCELLED:
            inventory_service.release_reservation(order_id)
            if order.payment_id:
                payment_service.refund(order.payment_id)
            notification_service.send(order.user_id, "Order cancelled")
        SHIPPED:
            notification_service.send(order.user_id, "Order shipped! Track: {metadata.tracking}")
        DELIVERED:
            notification_service.send(order.user_id, "Order delivered!")
        RETURNED:
            inventory_service.restock(order.items)
            payment_service.refund(order.payment_id)
```

### Cart Merge on Login

```text
function merge_carts(user_id, session_id):
    guest_cart = redis.HGETALL("cart:SESSION-{session_id}")
    user_cart  = redis.HGETALL("cart:{user_id}")

    if not guest_cart:
        return  // nothing to merge

    for sku, guest_item in guest_cart:
        if sku in user_cart:
            // Conflict: item exists in both carts
            // Strategy: keep higher quantity (user was likely price-watching)
            user_item = parse(user_cart[sku])
            guest_data = parse(guest_item)
            merged_qty = max(user_item.qty, guest_data.qty)
            redis.HSET("cart:{user_id}", sku,
                       json({qty: merged_qty, price: guest_data.price, added_at: now()}))
        else:
            // New item from guest session — add to user cart
            redis.HSET("cart:{user_id}", sku, guest_item)

    // Clean up guest cart
    redis.DEL("cart:SESSION-{session_id}")

    // Refresh TTL on merged cart
    redis.EXPIRE("cart:{user_id}", 2592000)  // 30 days
```

### Search Ranking Algorithm

```text
function rank_results(query, raw_results, user_context):
    scored_results = []
    for product in raw_results:
        score = 0.0

        // Factor 1: Text relevance (from Elasticsearch BM25)
        score += product.es_score * 0.3

        // Factor 2: Popularity (conversion rate × recency)
        score += product.conversion_rate * 0.2
        score += log(product.order_count_30d + 1) * 0.1

        // Factor 3: User personalization
        if product.category in user_context.purchase_history:
            score += 0.15  // bought from this category before
        if product.brand in user_context.brand_affinity:
            score += 0.10  // frequently buys this brand

        // Factor 4: Product quality signals
        score += (product.rating / 5.0) * 0.1
        score += min(log(product.review_count) / 5, 1.0) * 0.05

        // Factor 5: Business rules
        if product.is_prime:
            score += 0.05  // slight Prime boost for Prime members
        if product.is_sponsored:
            score += product.bid_amount * 0.001  // paid placement

        // Penalty: out of stock items ranked lower
        if not product.in_stock:
            score *= 0.1

        scored_results.append((product, score))

    return sorted(scored_results, key=lambda x: x[1], reverse=True)
```

---

## 10. Scaling Considerations

| Challenge | Solution | Numbers |
|---|---|---|
| 50K orders/sec on Prime Day | Pre-scale Order Service to 500+ pods; partition by user_id hash | Each pod handles ~100 orders/sec |
| Hot SKU inventory contention | Shard inventory by SKU hash across 20 DB nodes; use optimistic locking with jittered retry | Max 2,500 writes/sec per shard |
| 500M products in search | Elasticsearch cluster: 50 data nodes, 100 shards, 1 replica each | ~5M docs per shard, < 100ms query |
| 200K cart ops/sec | Redis Cluster: 10 masters × 3 replicas, hash-slot partitioning | 20K ops/sec per master (well within Redis capacity) |
| Product images (2.5 PB) | S3 + CloudFront CDN with 200+ PoPs globally | 95% cache hit rate, < 50ms image load |
| Global latency (users in 200+ countries) | Multi-region deployment (US, EU, APAC); each region has full read path | Writes route to primary region, async replication |
| Flash deals (1M users competing for 100 items) | Virtual queue + lottery system; pre-partition deal inventory; separate "deals" service with dedicated DB | Queue admits 100 winners, rest get "sold out" |
| Database growth (18 TB orders/5yr) | Time-based partitioning: orders older than 1 year move to cold storage (S3 + Athena) | Hot partition: last 90 days (~1 TB) |
| Recommendation model serving | Pre-compute "frequently bought together" offline; serve from Redis sorted sets | Batch job runs hourly on Spark cluster |
| Payment retry storms | Idempotency keys per order; exponential backoff; circuit breaker on payment gateway | Max 3 retries with 1s/2s/4s delays |

---

## 11. What If the Interviewer Pushes Back?

??? question "How do you handle the 'last item' problem — 1000 users see '1 left in stock' and all click Buy simultaneously?"
    **Solution: Reservation-based checkout with short TTL.** When a user enters checkout, we RESERVE the item for 10 minutes (decrement available quantity). Only 1 of the 1000 users gets the reservation — the rest immediately see "Out of Stock." If the winner doesn't complete payment within 10 minutes, the reservation expires and the item becomes available again. The key insight: the contention window is moved from "payment time" (slow, 5-30 seconds) to "reservation time" (fast, single DB write with optimistic lock, < 5ms). Only one user wins the race at the database level.

??? question "Won't optimistic locking cause massive retry storms on flash deals?"
    **Adapt:** For flash deals specifically, switch to a **queue-based model** instead of optimistic locking. All "Buy" clicks for a deal enter a Kafka topic. A single consumer processes them sequentially — first N buyers get the item, the rest are rejected. This serializes contention at the application layer (fast, no DB retries) rather than the database layer. Trade-off: adds ~50-200ms latency (queue processing), but eliminates all retry storms. Regular (non-deal) purchases continue using optimistic locking since contention is low.

??? question "What if payment takes 30 seconds (3D Secure, bank timeout) — does the inventory reservation hold?"
    **Defend:** Yes. The reservation has a 10-minute TTL — more than enough for even the slowest payment flows. If payment truly times out after 10 minutes, the reservation expires and inventory is released automatically by the expiry daemon. The user sees "Payment timed out, please try again" — and on retry, they may find the item is gone (someone else bought it). This is the correct behavior: holding inventory indefinitely for abandoned checkouts would lock up stock. The 10-minute window balances user patience vs. inventory availability.

??? question "How do you keep Elasticsearch in sync with the product database when prices change?"
    **Defend:** We use **Change Data Capture (CDC)** via Debezium on the product database. Every INSERT/UPDATE is streamed as a Kafka event to an ES indexing consumer. Typical sync delay: 2-5 seconds. This means a price change in DynamoDB takes up to 5 seconds to reflect in search results — acceptable for e-commerce (users rarely notice a 5-second stale price in search, and the product page always shows the authoritative price from the catalog DB). For critical fields (in_stock), we supplement CDC with a direct cache invalidation call.

??? question "Microservices introduce network calls — what about latency? The checkout path calls 4 services sequentially."
    **Adapt:** You're right — serial calls add up. The mitigation is **parallel where possible, sequential only where required:**
    
    - Cart validation + Address validation → **parallel** (no dependency)
    - Inventory reservation → **must follow** cart validation (need confirmed items)
    - Payment → **must follow** reservation (don't charge unless stock is held)
    - Order confirmation → **must follow** payment (only confirm if paid)
    
    Net path: 2 parallel calls + 3 sequential = total ~500ms instead of 5 × 200ms = 1000ms. Additionally, internal service calls use gRPC (not REST) for 2-5x lower serialization overhead, and services are co-located in the same availability zone to minimize network latency (< 1ms per hop).

??? question "What happens if the Kafka cluster goes down? Don't you lose order events?"
    **Defend:** Kafka is deployed with replication factor 3 and `acks=all` — a message is only acknowledged after ALL 3 replicas confirm the write. Losing a single broker is transparent. Losing the entire Kafka cluster (extremely rare, < 1 incident/year at major companies) triggers fallback: Order Service switches to synchronous calls for critical actions (payment, inventory) and buffers non-critical events (analytics, notifications) in a local write-ahead log. When Kafka recovers, the WAL is drained. The critical path (order placement) NEVER blocks on Kafka — it uses Kafka for downstream fanout, not for the primary write path.

??? question "How do you prevent bot abuse during flash sales?"
    **Adapt:** Multi-layer defense:
    
    1. **Device fingerprinting** — flag accounts using known automation tools
    2. **Rate limiting** — max 1 order per item per user per minute
    3. **CAPTCHA** — triggered on suspicious patterns (add-to-cart within 100ms of page load)
    4. **Virtual queue with lottery** — for extreme demand items, admit users randomly rather than first-come-first-served (defeats speed-based bots)
    5. **Purchase history scoring** — new accounts with no history get lower priority in the queue

---

## 12. Quick Recall

| Question | Answer |
|---|---|
| Inventory overselling prevention? | Optimistic locking with version check + reservation with 10-min TTL |
| Order state machine? | CREATED → PAYMENT_PENDING → CONFIRMED → SHIPPED → DELIVERED (or CANCELLED/RETURNED) |
| Cart storage? | Redis hash (user_id key, SKU fields); merge guest cart on login |
| Search architecture? | Elasticsearch cluster (50 nodes, 500M docs); CDC sync from product DB |
| Payment failure handling? | Saga pattern — compensating transaction (refund) if downstream fails |
| Why Kafka? | Decouples services temporally; events survive service crashes; enables replay |
| Why not pessimistic locking? | At 50K orders/sec, row locks cause deadlocks and timeout cascades |
| Cart durability? | Redis (fast) + async write-behind to PostgreSQL (durable backup) |
| Flash deal scaling? | Queue-based admission (Kafka consumer serializes); avoids DB contention |
| How to handle 10x traffic spike? | Pre-scale + CDN + virtual queue + circuit breakers + graceful degradation |
| Global deployment? | Multi-region read path; single primary region for writes; async replication |
| Search latency budget? | < 200ms p99: ES query (80ms) + enrichment (20ms) + network (100ms) |
