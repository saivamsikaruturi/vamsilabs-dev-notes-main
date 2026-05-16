# 🗄️ Data Management Patterns

> **Handle data across microservices — each service owns its database, but you still need consistency, queries across services, and data synchronization.**

---

!!! abstract "Real-World Analogy"
    Think of **different government departments**. Each department (Immigration, Tax, Health) keeps its own records. They can't directly access each other's databases. To get a citizen's full picture, they exchange documents through formal channels. Microservices data management works the same way.

```mermaid
flowchart LR
    subgraph Wrong["❌ Shared Database (Anti-Pattern)"]
        SA[["Service A"]] --> SDB[("🗄️ One Big Database")]
        SB[["Service B"]] --> SDB
        SC[["Service C"]] --> SDB
    end
    
    subgraph Right["✅ Database per Service"]
        A[["Order Service"]] --> DA[("🗄️ PostgreSQL")]
        B[["Product Service"]] --> DB2[("🗄️ MongoDB")]
        C[["Search Service"]] --> DC[("🗄️ Elasticsearch")]
    end

    style SDB fill:#FFCDD2,stroke:#C62828,color:#000
    style DA fill:#E8F5E9,stroke:#2E7D32,color:#000
    style DB2 fill:#E8F5E9,stroke:#2E7D32,color:#000
    style DC fill:#E8F5E9,stroke:#2E7D32,color:#000
```

---

## 📐 Pattern 1: API Composition

Query across services by calling multiple APIs and joining in-memory:

```mermaid
flowchart LR
    C[/"📱 Client: Get Order Details"/]
    C --> AC{{"🔧 API Composer / BFF"}}
    AC --> OS[["Order Service<br/>order data"]]
    AC --> US[["User Service<br/>customer info"]]
    AC --> PS[["Product Service<br/>item details"]]
    AC --> SS[["Shipping Service<br/>delivery status"]]
    AC --> Res(["📋 Aggregated Response"])

    style AC fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#000
```

```java
@Service
public class OrderDetailsComposer {

    public OrderDetailsResponse getOrderDetails(String orderId) {
        // Call multiple services in parallel
        CompletableFuture<Order> orderFuture = orderClient.getOrder(orderId);
        CompletableFuture<User> userFuture = orderFuture
            .thenCompose(order -> userClient.getUser(order.getUserId()));
        CompletableFuture<List<Product>> productsFuture = orderFuture
            .thenCompose(order -> productClient.getProducts(order.getItemIds()));
        CompletableFuture<Shipment> shipmentFuture = shippingClient.getByOrderId(orderId);

        // Combine results
        return CompletableFuture.allOf(orderFuture, userFuture, productsFuture, shipmentFuture)
            .thenApply(v -> new OrderDetailsResponse(
                orderFuture.join(),
                userFuture.join(),
                productsFuture.join(),
                shipmentFuture.join()
            )).join();
    }
}
```

---

## 📐 Pattern 2: CQRS (Command Query Responsibility Segregation)

Separate write model (optimized for updates) from read model (optimized for queries):

```mermaid
flowchart LR
    subgraph Write["✏️ Command Side"]
        WC[/"Write Command"/] --> WS{{"Order Service"}}
        WS --> WDB[("🗄️ PostgreSQL<br/>(normalized)")]
        WS --> EV[/"📤 Publish Event"/]
    end
    
    subgraph Read["📖 Query Side"]
        EV --> EP{{"Event Processor"}}
        EP --> RDB[("🗄️ Elasticsearch / Redis<br/>(denormalized, fast reads)")]
        Q[/"Read Query"/] --> RDB
    end

    style WDB fill:#E3F2FD,stroke:#1565C0,color:#000
    style RDB fill:#E8F5E9,stroke:#2E7D32,color:#000
```

```java
// Write side — normalized, transactional
@Service
public class OrderCommandService {

    @Transactional
    public Order createOrder(CreateOrderCommand cmd) {
        Order order = orderRepository.save(new Order(cmd));
        eventPublisher.publish(new OrderCreatedEvent(order));
        return order;
    }
}

// Read side — denormalized, fast queries
@Service
public class OrderQueryService {

    @KafkaListener(topics = "order-events")
    public void handleOrderEvent(OrderCreatedEvent event) {
        // Build a denormalized read model
        OrderView view = new OrderView(
            event.orderId(),
            event.userName(),        // Denormalized — no JOIN needed
            event.productNames(),    // Denormalized
            event.totalAmount(),
            event.status()
        );
        orderViewRepository.save(view);  // Elasticsearch / Redis
    }

    public List<OrderView> searchOrders(String query) {
        return orderViewRepository.search(query);  // Fast!
    }
}
```

---

## 📐 Pattern 3: Event-Driven Data Sync

Services keep local copies of data they need, synced via events:

```mermaid
flowchart LR
    US["👤 User Service"] -->|"UserUpdated event"| K["📫 Kafka"]
    K --> OS["🛒 Order Service<br/>(caches user name/email)"]
    K --> NS["📧 Notification Service<br/>(caches user email/preferences)"]
    K --> BS["📊 Billing Service<br/>(caches user payment method)"]

    style K fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#000
```

```java
// Order Service — maintains a local read-only copy of user data it needs
@Service
public class UserDataSyncConsumer {

    @KafkaListener(topics = "user-events")
    public void syncUserData(UserUpdatedEvent event) {
        localUserCache.save(new LocalUserRecord(
            event.userId(),
            event.name(),
            event.email()
        ));
    }
}
```

---

## 📐 Pattern 4: Saga for Distributed Writes

When a business operation spans multiple services' databases:

```mermaid
sequenceDiagram
    participant O as Order Service
    participant P as Payment Service
    participant I as Inventory Service

    O->>O: Create order (PENDING)
    O->>P: Charge payment
    P->>P: Reserve funds
    P->>I: Reserve stock
    I->>I: Deduct inventory
    I->>O: All steps complete
    O->>O: Mark CONFIRMED
    
    Note over P,I: On failure → compensate (refund, restore stock)
```

---

## 📊 Polyglot Persistence

Use the right database for each service's needs:

| Service | Database | Why |
|---|---|---|
| Order Service | PostgreSQL | Complex relationships, ACID transactions |
| Product Catalog | MongoDB | Flexible schema, nested documents |
| Search Service | Elasticsearch | Full-text search, fast filtering |
| Session Store | Redis | Low-latency key-value, TTL |
| Analytics | ClickHouse | Columnar, aggregation-heavy queries |
| Social Graph | Neo4j | Relationship queries (friends, recommendations) |

---

## ⚠️ Challenges & Solutions

| Challenge | Solution |
|---|---|
| Cross-service queries | API Composition, CQRS read models |
| Data consistency | Sagas, Outbox Pattern, eventual consistency |
| Distributed joins | Denormalize into read models |
| Reporting across services | Event-driven data lake / data warehouse |
| Data duplication | Accept it — trade storage for autonomy |
| Schema evolution | Backward-compatible changes, versioned events |

---

## 🎯 Interview Questions

??? question "1. How do you query data that spans multiple microservices?"
    Two main approaches: **API Composition** — an aggregator service calls multiple APIs and joins data in memory (simple but can be slow). **CQRS** — maintain denormalized read models optimized for specific queries, synced via events (complex but fast reads).

??? question "2. What is CQRS and when to use it?"
    Separate the write model (normalized, transactional) from the read model (denormalized, query-optimized). Use when: read and write patterns differ significantly, you need different data stores for reads vs writes, or you need high-performance search/filtering.

??? question "3. How do you handle data consistency without distributed transactions?"
    Use **eventual consistency** via: Sagas (compensating transactions), Outbox Pattern (reliable event publishing), event-driven data sync. Accept that services may be temporarily inconsistent (usually milliseconds). Design UIs to handle "processing" states.

??? question "4. What is polyglot persistence?"
    Using different database technologies for different services based on their specific needs — PostgreSQL for transactions, MongoDB for flexible documents, Redis for caching, Elasticsearch for search. Each service picks the best tool for its job.

??? question "5. How do you handle reporting across microservices?"
    Build a **read-optimized data store** (data lake or warehouse). Each service publishes events; a pipeline consumes events and builds consolidated reporting tables. Tools: Kafka → Spark/Flink → Data Warehouse, or CDC (Debezium) → Data Lake.

