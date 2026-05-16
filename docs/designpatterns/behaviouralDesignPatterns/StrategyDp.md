# 🎯 Strategy Design Pattern

> **Define a family of algorithms, encapsulate each one, and make them interchangeable. Strategy lets the algorithm vary independently from the clients that use it.**

---

## 🌍 Real-World Analogy

!!! abstract "Analogy — GPS Navigation"
    Think of a GPS navigation app like Google Maps. You choose a **routing strategy** — fastest route, shortest distance, avoid tolls, or scenic route. The app (context) doesn't change; only the **algorithm** for computing the route changes. You can switch strategies at runtime based on your preference.

```mermaid
flowchart LR
    GPS{{"📱 Google Maps<br/>(Context)<br/>A → B"}}
    GPS -->|Strategy 1| F(["🏎️ Fastest Route<br/>25 min via highway"])
    GPS -->|Strategy 2| S(["📏 Shortest Distance<br/>18 km through city"])
    GPS -->|Strategy 3| T(["💰 No Tolls<br/>35 min, free roads"])
    GPS -->|Strategy 4| SC(["🌅 Scenic Route<br/>45 min, beautiful views"])
    
    style GPS fill:#EDE9FE,stroke:#7C3AED,stroke-width:3px,color:#000
    style F fill:#FFCDD2,stroke:#C62828,color:#000
    style S fill:#BBDEFB,stroke:#1565C0,color:#000
    style T fill:#C8E6C9,stroke:#2E7D32,color:#000
    style SC fill:#FFF9C4,stroke:#F57F17,color:#000
```

---

## 🏗️ Pattern Structure

```mermaid
flowchart LR
    Context(["🎮 Context\n- strategy: Strategy\n+ setStrategy(s)\n+ executeStrategy()"])
    Strategy[["🧠 Strategy\n(Interface)\n+ execute(data)"]]
    ConcreteA{{"⚡ ConcreteStrategyA\n+ execute(data)"}}
    ConcreteB{{"🔥 ConcreteStrategyB\n+ execute(data)"}}
    ConcreteC{{"🌊 ConcreteStrategyC\n+ execute(data)"}}

    Context --> Strategy
    ConcreteA --> Strategy
    ConcreteB --> Strategy
    ConcreteC --> Strategy

    style Context fill:#7c3aed,color:#fff
    style Strategy fill:#6d28d9,color:#fff
    style ConcreteA fill:#a78bfa,color:#fff
    style ConcreteB fill:#a78bfa,color:#fff
    style ConcreteC fill:#a78bfa,color:#fff
```

---

## UML Class Diagram

```mermaid
classDiagram
    class PaymentStrategy {
        <<interface>>
        +pay(BigDecimal amount) boolean
        +getPaymentMethod() String
    }
    class ShoppingCart {
        -items: List~Item~
        -paymentStrategy: PaymentStrategy
        +setPaymentStrategy(PaymentStrategy strategy) void
        +addItem(Item item) void
        +checkout() boolean
    }
    class CreditCardPayment {
        -cardNumber: String
        -cvv: String
        +pay(BigDecimal amount) boolean
        +getPaymentMethod() String
    }
    class PayPalPayment {
        -email: String
        +pay(BigDecimal amount) boolean
        +getPaymentMethod() String
    }
    class CryptoPayment {
        -walletAddress: String
        +pay(BigDecimal amount) boolean
        +getPaymentMethod() String
    }

    ShoppingCart --> PaymentStrategy : uses
    CreditCardPayment ..|> PaymentStrategy
    PayPalPayment ..|> PaymentStrategy
    CryptoPayment ..|> PaymentStrategy
```

---

## ❓ The Problem

You need different variants of an algorithm within an object, and you want to switch between them at runtime. Without Strategy:

- You end up with massive `if-else` or `switch` blocks in your code
- Adding a new algorithm means **modifying** existing classes (violates Open/Closed Principle)
- Testing individual algorithms in isolation becomes difficult
- Client code becomes tightly coupled to specific algorithm implementations

**Example:** A payment system that needs to support credit card, PayPal, cryptocurrency, and bank transfer — each with completely different processing logic.

---

## ✅ The Solution

The Strategy pattern suggests:

1. Extract each algorithm into its own class implementing a common **Strategy interface**
2. The **Context** holds a reference to a strategy and delegates work to it
3. Clients configure the context with the desired strategy at runtime
4. New algorithms are added by creating new strategy classes — **no existing code changes**

---

## 💻 Implementation

=== "Classic Strategy"

    ```java
    // Strategy interface
    public interface PaymentStrategy {
        boolean pay(BigDecimal amount);
        String getPaymentMethod();
    }

    // Concrete Strategies
    public class CreditCardPayment implements PaymentStrategy {
        private final String cardNumber;
        private final String cvv;

        public CreditCardPayment(String cardNumber, String cvv) {
            this.cardNumber = cardNumber;
            this.cvv = cvv;
        }

        @Override
        public boolean pay(BigDecimal amount) {
            System.out.println("💳 Charged $" + amount + " to card ending " +
                cardNumber.substring(cardNumber.length() - 4));
            return true;
        }

        @Override
        public String getPaymentMethod() { return "Credit Card"; }
    }

    public class PayPalPayment implements PaymentStrategy {
        private final String email;

        public PayPalPayment(String email) {
            this.email = email;
        }

        @Override
        public boolean pay(BigDecimal amount) {
            System.out.println("🅿️ PayPal transfer of $" + amount + " from " + email);
            return true;
        }

        @Override
        public String getPaymentMethod() { return "PayPal"; }
    }

    public class CryptoPayment implements PaymentStrategy {
        private final String walletAddress;

        public CryptoPayment(String walletAddress) {
            this.walletAddress = walletAddress;
        }

        @Override
        public boolean pay(BigDecimal amount) {
            System.out.println("₿ Crypto payment of $" + amount + " from wallet " +
                walletAddress.substring(0, 8) + "...");
            return true;
        }

        @Override
        public String getPaymentMethod() { return "Cryptocurrency"; }
    }

    // Context
    public class ShoppingCart {
        private final List<Item> items = new ArrayList<>();
        private PaymentStrategy paymentStrategy;

        public void setPaymentStrategy(PaymentStrategy strategy) {
            this.paymentStrategy = strategy;
        }

        public void addItem(Item item) {
            items.add(item);
        }

        public boolean checkout() {
            BigDecimal total = items.stream()
                .map(Item::getPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            System.out.println("Total: $" + total + " via " + paymentStrategy.getPaymentMethod());
            return paymentStrategy.pay(total);
        }
    }

    // Usage
    public class Main {
        public static void main(String[] args) {
            ShoppingCart cart = new ShoppingCart();
            cart.addItem(new Item("Laptop", new BigDecimal("999.99")));
            cart.addItem(new Item("Mouse", new BigDecimal("29.99")));

            // Customer chooses payment at checkout
            cart.setPaymentStrategy(new CreditCardPayment("4111111111111234", "123"));
            cart.checkout();

            // Or switch strategy
            cart.setPaymentStrategy(new PayPalPayment("user@example.com"));
            cart.checkout();
        }
    }
    ```

=== "Modern Java (Functional)"

    ```java
    // Strategy as functional interface
    @FunctionalInterface
    public interface CompressionStrategy {
        byte[] compress(byte[] data);
    }

    // Context with lambda strategies
    public class FileCompressor {
        private CompressionStrategy strategy;

        public void setStrategy(CompressionStrategy strategy) {
            this.strategy = strategy;
        }

        public byte[] compress(byte[] data) {
            Objects.requireNonNull(strategy, "Compression strategy not set");
            return strategy.compress(data);
        }
    }

    // Usage with lambdas — no separate classes needed!
    public class Main {
        public static void main(String[] args) {
            FileCompressor compressor = new FileCompressor();

            // ZIP strategy
            compressor.setStrategy(data -> {
                // ZIP compression logic
                System.out.println("📦 ZIP compression applied");
                return zipCompress(data);
            });

            // GZIP strategy
            compressor.setStrategy(data -> {
                System.out.println("🗜️ GZIP compression applied");
                return gzipCompress(data);
            });

            // Strategy from method reference
            compressor.setStrategy(CompressionUtils::lz4Compress);
        }
    }
    ```

---

## 🎯 When to Use

- When you have multiple algorithms for a specific task and want to switch between them at runtime
- When you have a lot of `if-else` or `switch` statements selecting behavior — replace with Strategy
- When you want to isolate algorithm logic from the code that uses it
- When different variants of an algorithm are needed and new ones may be added in the future
- When algorithm details should be hidden from clients (encapsulation)

---

## 🏭 Real-World Examples

| Framework/Library | Usage |
|---|---|
| **`java.util.Comparator`** | Sorting strategy passed to `Collections.sort()` |
| **`javax.servlet.Filter`** | Different filtering strategies for HTTP requests |
| **Spring `Resource`** | `ClassPathResource`, `FileSystemResource`, `UrlResource` |
| **Spring Security `AuthenticationProvider`** | Different authentication strategies |
| **`java.util.concurrent.RejectedExecutionHandler`** | Thread pool rejection strategies |
| **Kafka `Partitioner`** | Custom partitioning strategies |
| **Jackson `SerializationFeature`** | Serialization strategies |

---

## ⚠️ Pitfalls

!!! warning "Common Mistakes"
    - **Over-engineering** — If you only have 2 strategies that never change, a simple `if-else` may be clearer.
    - **Strategy explosion** — Too many fine-grained strategies make the codebase harder to navigate.
    - **Client must know strategies** — Client needs to understand the differences to pick the right one.
    - **Increased object count** — Each strategy is a separate object (mitigate with lambdas in Java 8+).
    - **State in strategies** — Strategies should ideally be stateless and reusable; if they hold state, sharing them across contexts becomes risky.

---

## 📝 Key Takeaways

!!! tip "Summary"
    - Strategy eliminates conditional statements by delegating to **polymorphic** algorithm objects
    - Follows **Open/Closed Principle** — add new strategies without modifying existing code
    - In modern Java, use **functional interfaces + lambdas** for lightweight strategies
    - Strategy is selected at **runtime** (vs. Template Method which is fixed at compile time via inheritance)
    - Combined with a **Factory**, clients don't even need to know concrete strategy classes
    - Composition over inheritance — the Context **has-a** strategy rather than **is-a** relationship
