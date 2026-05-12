# 🎭 Saga Design Pattern

> **Manage distributed transactions across multiple microservices using a sequence of local transactions with compensating actions for rollback.**

---

!!! abstract "Real-World Analogy"
    Think of **booking a vacation** — you book a flight, then a hotel, then a car rental. If the car rental fails (no cars available), you need to **cancel the hotel** and **cancel the flight** (compensating transactions). Each booking is a separate service, and there's no single "undo all" button. The Saga pattern coordinates this sequence.

```mermaid
flowchart LR
    A["✈️ Book Flight"] --> B["🏨 Book Hotel"]
    B --> C["🚗 Book Car"]
    C -->|"❌ Failed!"| D["↩️ Cancel Hotel"]
    D --> E["↩️ Cancel Flight"]
    
    style A fill:#E8F5E9,stroke:#2E7D32,color:#000
    style B fill:#E8F5E9,stroke:#2E7D32,color:#000
    style C fill:#FFCDD2,stroke:#C62828,color:#000
    style D fill:#FFF3E0,stroke:#E65100,color:#000
    style E fill:#FFF3E0,stroke:#E65100,color:#000
```

---

## ❓ The Problem

In a monolith, you have one database and one transaction:

```java
@Transactional  // One atomic transaction — either ALL succeed or ALL rollback
public void placeOrder(Order order) {
    orderRepository.save(order);         // 1. Save order
    paymentService.charge(order);        // 2. Charge payment
    inventoryService.reserve(order);     // 3. Reserve stock
    deliveryService.schedule(order);     // 4. Schedule delivery
}
```

In microservices, **each service has its own database** — there's no single `@Transactional` that spans multiple services.

```mermaid
flowchart TD
    subgraph Problem["❌ Can't do this in Microservices"]
        T["@Transactional across<br/>multiple services?"] --> X["NOT POSSIBLE!"]
    end
    
    subgraph MS["Microservices Reality"]
        O["Order Service<br/>🗄️ Order DB"] ---|HTTP/Event| P["Payment Service<br/>🗄️ Payment DB"]
        P ---|HTTP/Event| I["Inventory Service<br/>🗄️ Inventory DB"]
        I ---|HTTP/Event| D["Delivery Service<br/>🗄️ Delivery DB"]
    end

    style X fill:#FFCDD2,stroke:#C62828,color:#000
    style O fill:#E3F2FD,stroke:#1565C0,color:#000
    style P fill:#E8F5E9,stroke:#2E7D32,color:#000
    style I fill:#FFF3E0,stroke:#E65100,color:#000
    style D fill:#F3E5F5,stroke:#6A1B9A,color:#000
```

---

## ✅ The Solution: Saga Pattern

A Saga is a sequence of **local transactions**. Each local transaction updates its own database and triggers the next step. If any step fails, **compensating transactions** are executed to undo previous steps.

---

## 📐 Two Implementation Approaches

### 1. Choreography (Event-Based)

Each service listens for events and reacts — no central coordinator.

```mermaid
flowchart LR
    OS["🛒 Order Service<br/>OrderCreated"] -->|event| PS["💳 Payment Service<br/>PaymentCompleted"]
    PS -->|event| IS["📦 Inventory Service<br/>StockReserved"]
    IS -->|event| DS["🚚 Delivery Service<br/>DeliveryScheduled"]
    
    DS -.->|"❌ DeliveryFailed"| IS
    IS -.->|"↩️ StockReleased"| PS
    PS -.->|"↩️ PaymentRefunded"| OS
    OS -.->|"↩️ OrderCancelled"| Done["Done"]

    style OS fill:#E3F2FD,stroke:#1565C0,color:#000
    style PS fill:#E8F5E9,stroke:#2E7D32,color:#000
    style IS fill:#FFF3E0,stroke:#E65100,color:#000
    style DS fill:#F3E5F5,stroke:#6A1B9A,color:#000
```

```java
// Order Service — publishes event
@Service
public class OrderService {
    
    @Autowired private KafkaTemplate<String, OrderEvent> kafkaTemplate;
    
    @Transactional
    public Order createOrder(OrderRequest request) {
        Order order = orderRepository.save(new Order(request));
        kafkaTemplate.send("order-events", new OrderCreatedEvent(order.getId(), order.getAmount()));
        return order;
    }
    
    @KafkaListener(topics = "payment-events")
    public void handlePaymentFailed(PaymentFailedEvent event) {
        // Compensating transaction
        orderRepository.updateStatus(event.getOrderId(), OrderStatus.CANCELLED);
    }
}

// Payment Service — listens and reacts
@Service
public class PaymentService {
    
    @KafkaListener(topics = "order-events")
    public void handleOrderCreated(OrderCreatedEvent event) {
        try {
            Payment payment = processPayment(event.getOrderId(), event.getAmount());
            kafkaTemplate.send("payment-events", new PaymentCompletedEvent(event.getOrderId()));
        } catch (PaymentException e) {
            kafkaTemplate.send("payment-events", new PaymentFailedEvent(event.getOrderId()));
        }
    }
}
```

### 2. Orchestration (Central Coordinator)

A single **Saga Orchestrator** tells each service what to do and handles failures.

```mermaid
flowchart TD
    O["🎯 Saga Orchestrator"]
    O -->|"1. Create Order"| OS["🛒 Order Service"]
    O -->|"2. Process Payment"| PS["💳 Payment Service"]
    O -->|"3. Reserve Stock"| IS["📦 Inventory Service"]
    O -->|"4. Schedule Delivery"| DS["🚚 Delivery Service"]
    
    DS -.->|"❌ Failed"| O
    O -.->|"Compensate 3"| IS
    O -.->|"Compensate 2"| PS
    O -.->|"Compensate 1"| OS

    style O fill:#FEF3C7,stroke:#D97706,stroke-width:3px,color:#000
    style OS fill:#E3F2FD,stroke:#1565C0,color:#000
    style PS fill:#E8F5E9,stroke:#2E7D32,color:#000
    style IS fill:#FFF3E0,stroke:#E65100,color:#000
    style DS fill:#F3E5F5,stroke:#6A1B9A,color:#000
```

```java
// Saga Orchestrator
@Service
public class OrderSagaOrchestrator {

    public void executeSaga(OrderRequest request) {
        String orderId = null;
        String paymentId = null;
        String reservationId = null;
        
        try {
            // Step 1: Create Order
            orderId = orderService.createOrder(request);
            
            // Step 2: Process Payment
            paymentId = paymentService.processPayment(orderId, request.getAmount());
            
            // Step 3: Reserve Inventory
            reservationId = inventoryService.reserveStock(orderId, request.getItems());
            
            // Step 4: Schedule Delivery
            deliveryService.scheduleDelivery(orderId, request.getAddress());
            
        } catch (Exception e) {
            // Compensating transactions (reverse order)
            compensate(orderId, paymentId, reservationId);
        }
    }
    
    private void compensate(String orderId, String paymentId, String reservationId) {
        if (reservationId != null) inventoryService.releaseStock(reservationId);
        if (paymentId != null) paymentService.refundPayment(paymentId);
        if (orderId != null) orderService.cancelOrder(orderId);
    }
}
```

---

## ⚖️ Choreography vs Orchestration

| Aspect | Choreography | Orchestration |
|--------|-------------|---------------|
| **Coordinator** | None — services react to events | Central orchestrator |
| **Coupling** | Loose — services don't know each other | Orchestrator knows all services |
| **Complexity** | Hard to track (distributed logic) | Easy to understand (centralized) |
| **Single point of failure** | No | Yes (orchestrator) |
| **Best for** | Simple workflows (3-4 steps) | Complex workflows (5+ steps) |
| **Debugging** | Harder (trace events) | Easier (single place) |
| **Technology** | Kafka, RabbitMQ events | State machine, workflow engine |

---

## 🍕 Real Example: Swiggy/Zomato Order Flow

```mermaid
flowchart TD
    U["👤 User places order"] --> OS["🛒 Order Service<br/>Creates order"]
    OS --> PS["💳 Payment Service<br/>Deducts money"]
    PS --> RS["🍽️ Restaurant Service<br/>Accepts order"]
    RS --> DS["🚴 Delivery Service<br/>Assigns rider"]
    DS --> Done["✅ Order Delivered!"]
    
    DS -->|"No rider available"| C1["↩️ Refund to Restaurant"]
    C1 --> C2["↩️ Refund Payment"]
    C2 --> C3["↩️ Cancel Order"]
    C3 --> Failed["❌ Order Cancelled<br/>Money Refunded"]

    style Done fill:#E8F5E9,stroke:#2E7D32,color:#000
    style Failed fill:#FFCDD2,stroke:#C62828,color:#000
    style U fill:#E3F2FD,stroke:#1565C0,color:#000
```

---

## 🎯 Interview Questions

??? question "1. What is the Saga pattern and why is it needed?"
    Saga manages distributed transactions in microservices where each service has its own database. Since you can't use a single ACID transaction across services, Saga uses a sequence of local transactions with compensating actions for rollback.

??? question "2. Choreography vs Orchestration — when to use which?"
    **Choreography**: simple flows (2-4 steps), high independence needed, no single point of failure desired. **Orchestration**: complex flows (5+ steps), need clear visibility, complex compensation logic.

??? question "3. What are compensating transactions?"
    Actions that semantically undo the effect of a previous transaction. E.g., if payment was charged, the compensating transaction is a refund. They don't literally "rollback" — they create a new transaction that reverses the business effect.

??? question "4. What happens if a compensating transaction fails?"
    This is a critical edge case. Solutions: retry with exponential backoff, store in a dead letter queue for manual intervention, or use idempotent operations so retries are safe.

??? question "5. How does Saga ensure data consistency?"
    Saga provides **eventual consistency**, not strong consistency. At any point during execution, data across services may be temporarily inconsistent. The system eventually reaches a consistent state when the saga completes (either all steps succeed or all compensations execute).

??? question "6. What frameworks support Saga in Java?"
    Axon Framework, MicroProfile LRA, Eventuate Tram, Temporal.io, and custom implementations using Kafka + state machines.

---

!!! warning "Key Pitfall"
    Sagas do NOT provide isolation (the "I" in ACID). During execution, intermediate results are visible to other transactions. Handle this with semantic locks, commutative updates, or pessimistic views.
