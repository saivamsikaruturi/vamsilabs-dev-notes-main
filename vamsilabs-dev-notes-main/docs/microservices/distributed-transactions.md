# 🔄 Distributed Transactions

> **Maintain data consistency across multiple microservices — when one service's database update depends on another service succeeding.**

---

!!! abstract "Real-World Analogy"
    Think of **booking a vacation package**. You need to book a flight, hotel, AND car rental together. If the hotel is full, you need to cancel the flight booking too. In a monolith, one database transaction handles this. In microservices, each service has its own database — you need coordination strategies to keep everything consistent.

```mermaid
flowchart TD
    O["🛒 Place Order"]
    O --> S1["💳 Payment Service<br/>Charge $50"]
    O --> S2["📦 Inventory Service<br/>Reserve items"]
    O --> S3["📧 Notification Service<br/>Send confirmation"]
    
    S1 -->|"❌ Payment fails"| COMP["🔄 Compensate!<br/>Release inventory"]

    style O fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#000
    style COMP fill:#FFCDD2,stroke:#C62828,color:#000
    style S1 fill:#E3F2FD,stroke:#1565C0,color:#000
    style S2 fill:#E8F5E9,stroke:#2E7D32,color:#000
    style S3 fill:#F3E5F5,stroke:#6A1B9A,color:#000
```

---

## ❌ The Problem: No ACID Across Services

In a monolith:
```java
@Transactional  // One DB transaction = automatic rollback
public void placeOrder(OrderRequest req) {
    orderRepo.save(order);
    paymentRepo.charge(order);
    inventoryRepo.reserve(order);
}
```

In microservices: **each service has its own database**. There is no single `@Transactional` that spans multiple services.

```mermaid
flowchart LR
    subgraph MS["Microservices (separate DBs)"]
        OS["Order Service<br/>🗄️ Order DB"] 
        PS["Payment Service<br/>🗄️ Payment DB"]
        IS["Inventory Service<br/>🗄️ Inventory DB"]
    end
    
    OS -.->|"No single transaction!"| PS
    PS -.->|"No single transaction!"| IS

    style OS fill:#E3F2FD,stroke:#1565C0,color:#000
    style PS fill:#E8F5E9,stroke:#2E7D32,color:#000
    style IS fill:#FFF3E0,stroke:#E65100,color:#000
```

---

## 📐 Solution 1: Saga Pattern

Break a distributed transaction into a sequence of **local transactions** + **compensating transactions** (undo actions).

### Choreography-Based Saga

Services communicate via events — no central coordinator:

```mermaid
sequenceDiagram
    participant OS as Order Service
    participant PS as Payment Service
    participant IS as Inventory Service

    OS->>OS: Create Order (PENDING)
    OS->>PS: OrderCreated event
    PS->>PS: Charge payment
    PS->>IS: PaymentCompleted event
    IS->>IS: Reserve stock
    IS->>OS: StockReserved event
    OS->>OS: Mark Order CONFIRMED

    Note over PS,IS: If payment fails:
    PS->>OS: PaymentFailed event
    OS->>OS: Mark Order CANCELLED
```

### Orchestration-Based Saga

A central **orchestrator** coordinates the steps:

```mermaid
flowchart TD
    O["🎯 Saga Orchestrator"]
    O -->|"1. Create order"| OS["Order Service"]
    O -->|"2. Charge payment"| PS["Payment Service"]
    O -->|"3. Reserve stock"| IS["Inventory Service"]
    O -->|"4. Confirm order"| OS

    PS -->|"❌ Failed"| O
    O -->|"Compensate: cancel order"| OS

    style O fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#000
```

```java
@Service
public class OrderSagaOrchestrator {

    public void executeSaga(OrderRequest request) {
        String orderId = null;
        String paymentId = null;

        try {
            // Step 1: Create order
            orderId = orderService.createOrder(request);
            
            // Step 2: Process payment
            paymentId = paymentService.charge(orderId, request.amount());
            
            // Step 3: Reserve inventory
            inventoryService.reserve(orderId, request.items());
            
            // Step 4: Confirm
            orderService.confirmOrder(orderId);

        } catch (PaymentException e) {
            // Compensate: cancel the order
            if (orderId != null) orderService.cancelOrder(orderId);
            throw e;
            
        } catch (InventoryException e) {
            // Compensate: refund payment + cancel order
            if (paymentId != null) paymentService.refund(paymentId);
            if (orderId != null) orderService.cancelOrder(orderId);
            throw e;
        }
    }
}
```

### Choreography vs Orchestration

| | Choreography | Orchestration |
|---|---|---|
| **Coordination** | Decentralized (events) | Centralized (orchestrator) |
| **Coupling** | Loosest | Orchestrator knows all steps |
| **Visibility** | Hard to track flow | Easy to monitor |
| **Complexity** | Grows with more services | Stays in one place |
| **Best for** | Simple flows (2-3 steps) | Complex flows (4+ steps) |

---

## 📐 Solution 2: Transactional Outbox Pattern

Ensure events are published reliably — even if the message broker is temporarily down:

```mermaid
flowchart LR
    subgraph Service["Order Service"]
        BL["Business Logic"]
        BL -->|"single DB transaction"| DB["🗄️ Order DB"]
        BL -->|"same transaction"| OB["📤 Outbox Table"]
    end
    
    CDC["🔄 CDC / Poller"] -->|reads| OB
    CDC -->|publishes| K["📫 Kafka"]

    style OB fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#000
    style CDC fill:#E3F2FD,stroke:#1565C0,color:#000
```

```java
@Service
@Transactional
public class OrderService {

    public Order createOrder(OrderRequest request) {
        // Save order (business data)
        Order order = orderRepository.save(new Order(request));
        
        // Save event to outbox table (same transaction!)
        outboxRepository.save(new OutboxEvent(
            "OrderCreated",
            order.getId(),
            objectMapper.writeValueAsString(new OrderCreatedEvent(order))
        ));
        
        return order;  // Both saved atomically
    }
}

// Separate process polls outbox and publishes to Kafka
@Scheduled(fixedDelay = 1000)
public void publishOutboxEvents() {
    List<OutboxEvent> events = outboxRepository.findUnpublished();
    for (OutboxEvent event : events) {
        kafkaTemplate.send("order-events", event.getAggregateId(), event.getPayload());
        event.markPublished();
        outboxRepository.save(event);
    }
}
```

---

## 📐 Solution 3: Two-Phase Commit (2PC)

A coordinator asks all participants to **prepare**, then **commit**:

```mermaid
sequenceDiagram
    participant C as Coordinator
    participant DB1 as Order DB
    participant DB2 as Payment DB

    Note over C,DB2: Phase 1: Prepare
    C->>DB1: Can you commit?
    DB1->>C: Yes (prepared)
    C->>DB2: Can you commit?
    DB2->>C: Yes (prepared)

    Note over C,DB2: Phase 2: Commit
    C->>DB1: Commit!
    C->>DB2: Commit!
```

!!! warning "2PC in Microservices"
    2PC is rarely used in microservices because it's slow (blocking), doesn't scale well, and creates a single point of failure (the coordinator). Prefer Sagas for microservices.

---

## 📊 Comparison of Approaches

| Approach | Consistency | Performance | Complexity | Use Case |
|---|---|---|---|---|
| **Saga (Choreography)** | Eventual | High | Medium | Simple flows |
| **Saga (Orchestration)** | Eventual | High | Medium-High | Complex flows |
| **Outbox Pattern** | At-least-once delivery | High | Low-Medium | Reliable event publishing |
| **2PC** | Strong | Low (blocking) | High | Rarely in microservices |

---

## 🛡️ Handling Failures

### Idempotency

Every step must be safe to retry:

```java
@Transactional
public void processPayment(String orderId, BigDecimal amount) {
    // Check if already processed (idempotency key)
    if (paymentRepository.existsByOrderId(orderId)) {
        log.info("Payment already processed for order: {}", orderId);
        return;
    }
    // Process payment...
}
```

### Timeout & Dead Letters

```mermaid
flowchart TD
    S["Saga Step"] -->|"timeout"| R["Retry (3x)"]
    R -->|"still fails"| DLQ["💀 Dead Letter Queue"]
    DLQ --> Alert["🚨 Alert + Manual Resolution"]

    style DLQ fill:#FFCDD2,stroke:#C62828,color:#000
```

---

## 🎯 Interview Questions

??? question "1. How do you handle transactions across microservices?"
    Use the **Saga pattern** — break the distributed transaction into a sequence of local transactions, each with a compensating transaction (undo). Coordinate via events (choreography) or a central orchestrator.

??? question "2. What is a compensating transaction?"
    An action that undoes the effect of a previous step. Example: if payment was charged but inventory reservation fails, the compensating transaction is a **refund**. Unlike database rollback, compensating transactions are explicit business logic.

??? question "3. Choreography vs Orchestration — when to use which?"
    **Choreography** (event-driven): simple flows with 2-3 steps, prefer loose coupling. **Orchestration** (central coordinator): complex flows with many steps, need visibility into the process, or conditional logic between steps.

??? question "4. What is the Outbox Pattern?"
    A pattern that writes business data AND the event to publish in a **single database transaction**. A separate process (CDC or poller) reads the outbox table and publishes events to the message broker. Guarantees events are published exactly when the business operation succeeds.

??? question "5. Why not use 2PC (Two-Phase Commit) in microservices?"
    2PC is blocking (participants hold locks during prepare phase), creates a single point of failure (coordinator), doesn't scale across network partitions, and is too slow for high-throughput systems. Sagas with eventual consistency are the industry standard for microservices.

??? question "6. How do you ensure exactly-once execution in a saga?"
    Make every step **idempotent** — store processed request IDs and check before executing. Use unique business keys (orderId) as idempotency keys. Combined with at-least-once delivery from the message broker, this achieves effectively-once semantics.

