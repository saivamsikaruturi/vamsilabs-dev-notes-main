# SQL vs NoSQL — The Real Guide

## The Core Difference

**SQL databases** store data in **tables with fixed columns**. Every row has the same structure. You define the schema first, then insert data.

**NoSQL databases** store data in **flexible formats** — documents, key-value pairs, graphs, or wide columns. Schema is optional or dynamic.

```
SQL (PostgreSQL)                    NoSQL (MongoDB)
┌──────┬────────┬─────┐            {
│  id  │  name  │ age │              "_id": "u1",
├──────┼────────┼─────┤              "name": "Vamsi",
│  1   │ Vamsi  │  27 │              "age": 27,
│  2   │ Rahul  │  25 │              "skills": ["Java", "K8s"],
│  3   │ Priya  │  30 │              "address": {
└──────┴────────┴─────┘                "city": "Hyderabad"
Every row = same columns              }
Adding "skills" = ALTER TABLE       }
                                    Every doc can have different fields
                                    Adding "skills" = just insert it
```

---

## Head-to-Head Comparison

| Aspect | SQL | NoSQL |
|---|---|---|
| **Data model** | Tables with rows & columns | Documents, key-value, graph, wide-column |
| **Schema** | Fixed — define before insert | Flexible — fields can vary per record |
| **Query language** | SQL (standardized) | Varies — each DB has its own API/query |
| **Scaling** | Vertical (bigger server) | Horizontal (more servers) |
| **Joins** | Built-in, powerful | Usually not supported — denormalize instead |
| **Transactions** | Full ACID support | Varies — some support it, many don't |
| **Best for** | Complex queries, relationships, consistency | High throughput, flexible data, scale-out |

---

## The 4 Types of NoSQL

### 1. Document Store

Stores JSON/BSON documents. Each document can have a different structure.

```json
// MongoDB
{
  "_id": "order_123",
  "customer": "Vamsi",
  "items": [
    { "product": "Laptop", "price": 75000, "qty": 1 },
    { "product": "Mouse", "price": 500, "qty": 2 }
  ],
  "total": 76000,
  "status": "shipped"
}
```

**Examples**: MongoDB, CouchDB, Firestore

**Use when**: Your data is naturally nested/hierarchical (orders, profiles, product catalogs).

### 2. Key-Value Store

Simplest model — a giant hash map. Blazing fast reads/writes.

```
Key                 Value
─────────────────────────────────
session:abc123  →   { userId: "u1", expires: "2025-12-01" }
user:u1:cart    →   ["item1", "item2", "item3"]
config:app      →   { theme: "dark", lang: "en" }
```

**Examples**: Redis, DynamoDB, etcd, Memcached

**Use when**: Caching, session storage, real-time leaderboards, feature flags.

### 3. Wide-Column Store

Like a table, but each row can have **different columns**. Designed for massive scale.

```
Row Key       │ Column Family: profile    │ Column Family: activity
──────────────┼───────────────────────────┼──────────────────────────
user:vamsi    │ name=Vamsi, city=Hyd      │ last_login=2025-06-01
user:rahul    │ name=Rahul                │ last_login=2025-05-28, posts=142
user:priya    │ name=Priya, city=Blr,     │ last_login=2025-06-02
              │ phone=9876543210          │
```

**Examples**: Cassandra, HBase, ScyllaDB

**Use when**: Time-series data, IoT sensor data, event logging at massive scale (Netflix, Discord).

### 4. Graph Database

Stores **nodes** (entities) and **edges** (relationships). Queries traverse relationships naturally.

```
    (Vamsi)──FOLLOWS──▶(Rahul)
       │                   │
    LIKES               POSTED
       │                   │
       ▼                   ▼
    (Java)            ("Hello World")
```

**Examples**: Neo4j, Amazon Neptune, ArangoDB

**Use when**: Social networks, recommendation engines, fraud detection, knowledge graphs.

---

## ACID vs BASE

### ACID (SQL databases)

| Property | Meaning |
|---|---|
| **A**tomicity | All operations succeed or all fail — no partial updates |
| **C**onsistency | Data always moves from one valid state to another |
| **I**solation | Concurrent transactions don't interfere with each other |
| **D**urability | Once committed, data survives crashes |

### BASE (NoSQL databases)

| Property | Meaning |
|---|---|
| **B**asically **A**vailable | System guarantees availability (may serve stale data) |
| **S**oft state | State may change over time without input (due to replication lag) |
| **E**ventual consistency | All replicas will converge to the same value... eventually |

!!! note "Not all NoSQL is BASE"
    MongoDB (since 4.0) supports multi-document ACID transactions. DynamoDB supports transactions. The lines are blurring.

---

## When to Pick What — Real Scenarios

### Choose SQL when

| Scenario | Why SQL | Example DB |
|---|---|---|
| Banking / payments | Need ACID transactions — money can't vanish | PostgreSQL, MySQL |
| E-commerce orders | Complex joins: orders → items → products → inventory | PostgreSQL |
| Reporting / analytics | SQL is unmatched for aggregations, GROUP BY, window functions | PostgreSQL, MySQL |
| Data with strict relationships | Foreign keys enforce integrity automatically | Any RDBMS |
| Your schema is well-defined | You know the structure upfront and it won't change often | PostgreSQL |

### Choose NoSQL when

| Scenario | Why NoSQL | Example DB |
|---|---|---|
| User sessions / caching | Key-value is fastest for simple lookups | Redis |
| Product catalog (Flipkart) | Products have wildly different attributes (phone vs clothing) | MongoDB |
| Real-time chat (WhatsApp) | Massive write throughput, horizontal scaling | Cassandra |
| Social feed (Instagram) | Timeline is denormalized, reads >> writes | Cassandra, DynamoDB |
| Recommendation engine | Relationships between users/products are the data | Neo4j |
| IoT sensor data | Billions of time-series data points | Cassandra, InfluxDB |
| Content management | Nested, variable-structure documents | MongoDB |

### Use Both (Polyglot Persistence)

Most real-world systems use **multiple databases**:

```
┌─────────────────────────────────────────────────────┐
│                    E-Commerce App                     │
├──────────────┬──────────────┬───────────────────────┤
│  PostgreSQL  │    Redis     │       MongoDB          │
│  Orders,     │  Sessions,   │  Product catalog,      │
│  Payments,   │  Cart cache, │  Reviews,              │
│  Inventory   │  Rate limits │  Recommendations       │
└──────────────┴──────────────┴───────────────────────┘
```

Uber uses PostgreSQL + Redis + Cassandra + MySQL.
Netflix uses Cassandra + DynamoDB + MySQL + Redis.
Amazon uses DynamoDB + RDS + ElastiCache + Neptune.

---

## Scaling: Vertical vs Horizontal

### Vertical Scaling (SQL's approach)

```
Before:  [  8 CPU, 32 GB RAM  ]
After:   [ 64 CPU, 512 GB RAM ]  ← same machine, bigger specs
```

**Pros**: Simple, no code changes.
**Cons**: There's a ceiling — you can't buy an infinitely powerful machine. Expensive at the top.

### Horizontal Scaling (NoSQL's approach)

```
Before:  [ Node 1 ]
After:   [ Node 1 ] [ Node 2 ] [ Node 3 ] [ Node 4 ]
         ← data is split (sharded) across nodes →
```

**Pros**: Practically unlimited scale. Add nodes as traffic grows.
**Cons**: Distributed systems complexity — network partitions, consistency challenges, rebalancing.

!!! tip "SQL can scale horizontally too"
    CockroachDB, TiDB, Vitess (YouTube's MySQL sharding), and Citus (PostgreSQL) support horizontal scaling with SQL. The boundary is blurring.

---

## The CAP Connection

The CAP theorem says a distributed database can only guarantee **2 out of 3**:

| Property | Meaning |
|---|---|
| **C**onsistency | Every read returns the latest write |
| **A**vailability | Every request gets a response |
| **P**artition tolerance | System works even if network splits nodes |

In practice, **P** is non-negotiable (networks fail), so you choose between:

- **CP** (Consistency + Partition tolerance): MongoDB, HBase — may reject writes during partition
- **AP** (Availability + Partition tolerance): Cassandra, DynamoDB — always accepts writes, may serve stale reads

SQL databases are typically **CA** in a single-node setup (no partition to worry about).

---

## Interview Questions (Product Company Level)

**Q1: You're designing the backend for a food delivery app like Swiggy. Which databases would you use and why?**

??? note "Answer"
    - **PostgreSQL** for orders, payments, restaurant info — needs ACID for money transactions and joins across orders/items/restaurants
    - **Redis** for real-time driver location cache, session management, restaurant availability — needs sub-millisecond reads
    - **MongoDB** for menus — each restaurant's menu has different structure (pizza toppings vs biryani options)
    - **Cassandra** for order tracking events — append-only, high write throughput, time-series nature

---

**Q2: Instagram stores 2 billion+ photos. Would you use SQL or NoSQL for the photo metadata?**

??? note "Answer"
    **Both**. Instagram actually uses:

    - **PostgreSQL** for user accounts, followers, likes — relational data with integrity constraints
    - **Cassandra** for the feed timeline — denormalized, massively distributed, optimized for reads
    - **Redis** for caching hot data — trending posts, user sessions

    Photo files themselves go to object storage (S3), not a database. Only metadata (URL, timestamp, filters, tags) is in the DB.

---

**Q3: A candidate says "NoSQL is faster than SQL." Is this true?**

??? note "Answer"
    **It depends on the operation.**

    - **Key-value lookups**: Redis at 100K+ ops/sec destroys any SQL query. NoSQL wins.
    - **Complex joins across 5 tables with aggregations**: SQL with proper indexes wins easily. NoSQL can't even do this natively.
    - **Bulk writes of 1 million events/sec**: Cassandra handles this. PostgreSQL would choke.
    - **A single row lookup by primary key**: Both are equally fast with proper indexing.

    There is no universally "faster" database. It depends on access patterns.

---

**Q4: Can MongoDB replace PostgreSQL entirely?**

??? note "Answer"
    **No, not for all use cases.** MongoDB (since 4.0) has ACID transactions, but:

    - Complex joins across collections are slow and cumbersome (you use `$lookup`)
    - No native foreign keys — referential integrity is your responsibility
    - Aggregation pipeline is powerful but harder to write than SQL for complex analytics
    - SQL is a decades-old standard — every BI tool, reporting system, and data analyst knows it

    MongoDB is great for document-heavy workloads. For financial data, relational data, or analytics — PostgreSQL is the better tool.

---

**Q5: What is denormalization and why do NoSQL databases use it?**

??? note "Answer"
    **Normalization** (SQL approach): Store data once, reference via foreign keys. No duplication.

    ```
    orders table:  { order_id, user_id, total }
    users table:   { user_id, name, email }
    → JOIN to get order + user info
    ```

    **Denormalization** (NoSQL approach): Duplicate data to avoid joins. Faster reads, but updates are harder.

    ```json
    {
      "order_id": "o1",
      "total": 5000,
      "user_name": "Vamsi",
      "user_email": "vamsi@example.com"
    }
    ```

    NoSQL databases lack efficient joins, so you embed related data inside the document. The trade-off: if Vamsi changes his email, you must update it in **every** order document (eventual consistency is acceptable for this).

---

**Q6: Your startup has 100 users today but expects 10 million in 2 years. SQL or NoSQL?**

??? note "Answer"
    **Start with PostgreSQL.** Reasons:

    1. At 100 users, any database works. Don't over-engineer.
    2. PostgreSQL handles millions of rows easily with proper indexing.
    3. SQL gives you flexibility for analytics, reporting, and ad-hoc queries you haven't thought of yet.
    4. You can add Redis for caching when needed.
    5. If you hit PostgreSQL's limits at massive scale, migrate the specific bottleneck to NoSQL — not the whole system.

    Premature optimization is the root of all evil. Pick the tool that makes you most productive today.
