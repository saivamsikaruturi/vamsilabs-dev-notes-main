---
title: "LLD Interview Questions for Java Developers — Top 35 with Answers"
description: "Top Low Level Design (LLD) interview questions for Java developers. Covers SOLID principles, design patterns, OOP concepts, and 12 LLD problems with class diagrams — asked at FAANG, Salesforce, Amazon, and top product companies."
---

# LLD Interview Questions for Java Developers

Low Level Design (LLD) interviews test your ability to design **clean, extensible, maintainable object-oriented code**. This page covers the 35 most frequently asked LLD questions with concise answers — from SOLID principles to full design walkthroughs of the problems that come up most at FAANG companies.

**What interviewers test:** Can you identify the right abstractions, apply design patterns without over-engineering, write extensible code that doesn't break when requirements change, and explain *why* you made each design decision?

---

## SOLID Principles

**1. What are the SOLID principles? Give a one-line summary of each.**

| Principle | Summary |
|---|---|
| **S** — Single Responsibility | A class should have one reason to change |
| **O** — Open/Closed | Open for extension, closed for modification |
| **L** — Liskov Substitution | Subtypes must be substitutable for their base types |
| **I** — Interface Segregation | Clients shouldn't depend on interfaces they don't use |
| **D** — Dependency Inversion | Depend on abstractions, not concretions |

**2. Give an example of violating the Single Responsibility Principle.**

```java
// Violation — UserService does too much
class UserService {
    void registerUser(User u) { /* business logic */ }
    void sendWelcomeEmail(User u) { /* email logic */ }
    void saveToDatabase(User u) { /* DB logic */ }
}

// Fixed — separate responsibilities
class UserService { void registerUser(User u) { ... } }
class EmailService { void sendWelcomeEmail(User u) { ... } }
class UserRepository { void save(User u) { ... } }
```

**3. Explain the Open/Closed Principle with a design pattern example.**

A `PaymentProcessor` that has `if (type == "CREDIT") ... else if (type == "PAYPAL") ...` violates OCP — every new payment type requires modifying the class. Fix with **Strategy pattern**:

```java
interface PaymentStrategy { void pay(int amount); }
class CreditCardPayment implements PaymentStrategy { ... }
class PayPalPayment implements PaymentStrategy { ... }

class PaymentProcessor {
    void process(PaymentStrategy strategy, int amount) {
        strategy.pay(amount); // add new types without changing this class
    }
}
```

**4. What is the Liskov Substitution Principle? What's a classic violation?**

Subclasses must behave correctly when used as their parent type — substituting a subtype shouldn't break the program.

Classic violation: `Square extends Rectangle`. `Rectangle` has `setWidth()` and `setHeight()` independently. But a `Square` must keep width == height — overriding `setWidth()` to also set height violates the contract a caller expects. Fix: don't extend `Rectangle`; both `Square` and `Rectangle` implement a `Shape` interface.

**5. What is the Dependency Inversion Principle?**

High-level modules should not depend on low-level modules — both should depend on abstractions.

```java
// Violation — high-level OrderService depends on low-level MySQLDatabase
class OrderService {
    private MySQLDatabase db = new MySQLDatabase();
}

// Fixed — depends on abstraction
class OrderService {
    private final OrderRepository repo; // interface
    OrderService(OrderRepository repo) { this.repo = repo; } // injected
}
```

This is what makes Spring DI and testing possible — inject a mock `OrderRepository` in tests.

→ Deep dive: [SOLID Principles](../solidprinciples/solidprinciples.md)

---

## Design Patterns in LLD

**6. What is the Singleton pattern and how do you implement it thread-safely?**

Ensures exactly one instance of a class. Thread-safe implementations:

```java
// Best: Initialization-on-demand holder (lazy, thread-safe, no sync overhead)
public class Singleton {
    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
    }
    public static Singleton getInstance() { return Holder.INSTANCE; }
    private Singleton() {}
}
```

Enum singleton is also safe and serialization-proof: `public enum Singleton { INSTANCE; }`

**7. What is the Factory pattern vs Abstract Factory?**

**Factory Method:** defines an interface for creating objects, but subclasses decide which class to instantiate. One product family.

**Abstract Factory:** creates *families* of related objects without specifying concrete classes. Multiple product families.

```java
// Factory Method
interface ShapeFactory { Shape create(); }
class CircleFactory implements ShapeFactory { public Shape create() { return new Circle(); } }

// Abstract Factory — creates families (Button + Checkbox per OS)
interface UIFactory { Button createButton(); Checkbox createCheckbox(); }
class WindowsUIFactory implements UIFactory { ... }
class MacUIFactory implements UIFactory { ... }
```

**8. What is the Builder pattern and when do you use it?**

Constructs complex objects step by step. Use when: constructor has many parameters (especially optional ones), object construction requires multiple steps, you want immutable objects.

```java
User user = new User.Builder("vamsi@email.com")
    .name("Vamsi")
    .age(28)
    .role(Role.ADMIN)
    .build();
```

**9. What is the Strategy pattern?**

Defines a family of algorithms, encapsulates each, and makes them interchangeable. The client chooses the algorithm at runtime.

```java
interface SortStrategy { void sort(int[] arr); }
class QuickSort implements SortStrategy { ... }
class MergeSort implements SortStrategy { ... }

class Sorter {
    private SortStrategy strategy;
    void setStrategy(SortStrategy s) { this.strategy = s; }
    void sort(int[] arr) { strategy.sort(arr); }
}
```

**10. What is the Observer pattern?**

Defines a one-to-many dependency — when one object (subject) changes state, all its dependents (observers) are notified automatically. Used in event systems, UI frameworks, pub/sub.

```java
interface Observer { void update(Event event); }
interface Subject { void subscribe(Observer o); void notify(Event e); }
```

Java has `java.util.Observer` (deprecated) — prefer custom implementations or event buses (Guava EventBus, Spring Events).

**11. What is the Decorator pattern vs inheritance for extending behavior?**

Decorator wraps an object and adds behavior dynamically without subclassing. More flexible than inheritance (can stack decorators, combine at runtime).

```java
interface Coffee { double cost(); }
class SimpleCoffee implements Coffee { public double cost() { return 1.0; } }
class MilkDecorator implements Coffee {
    Coffee coffee;
    MilkDecorator(Coffee c) { this.coffee = c; }
    public double cost() { return coffee.cost() + 0.25; }
}
// SimpleCoffee → MilkDecorator → SugarDecorator → cost = 1.5
```

**12. What is the Command pattern?**

Encapsulates a request as an object — enables undo/redo, queuing, logging of operations.

```java
interface Command { void execute(); void undo(); }
class TransferCommand implements Command {
    void execute() { account.debit(amount); }
    void undo() { account.credit(amount); }
}
```

→ Deep dive: [Design Patterns Overview](../designpatterns/dp.md)

---

## OOP & Design Concepts

**13. What is the difference between composition and inheritance? Which do you prefer?**

**Inheritance** ("is-a"): `Dog extends Animal` — tight coupling, fragile base class problem, can only inherit from one class in Java. **Composition** ("has-a"): `Dog has-a Behavior` — flexible, testable, loosely coupled.

**Prefer composition.** "Favor composition over inheritance" (Effective Java, Item 18). Use inheritance only for true "is-a" relationships where the subtype *genuinely* extends the parent's contract.

**14. What is abstraction vs encapsulation?**

**Encapsulation:** hiding internal state — expose only what's needed via public methods (`private` fields + getters/setters). **Abstraction:** hiding implementation details — expose only the *what*, not the *how* (interfaces, abstract classes). Encapsulation is about data hiding; abstraction is about complexity hiding.

**15. What is the difference between an interface and an abstract class? When do you use each?**

| | Interface | Abstract Class |
|---|---|---|
| Multiple inheritance | Yes | No (single) |
| State (fields) | No (constants only) | Yes |
| Constructor | No | Yes |
| Default methods | Yes (Java 8+) | Yes |
| Use when | Defining a contract/capability | Sharing code among related classes |

Rule: use interface when unrelated classes should implement the same behavior (Flyable for Bird and Airplane). Use abstract class when related classes share code (Animal with common behavior).

---

## LLD Problem Walkthroughs

**16. Design a Parking Lot system.**

Key classes: `ParkingLot`, `ParkingFloor`, `ParkingSpot` (Compact/Large/Handicapped), `Vehicle` (Car/Truck/Bike), `Ticket`, `PaymentProcessor`.

Design decisions:
- Use `enum SpotType` and `enum VehicleType`
- `ParkingSpot` is abstract; concrete types extend it
- `ParkingFloor` finds nearest available spot
- `Ticket` records entry time; payment calculates duration-based fee
- Strategy pattern for `PricingStrategy` (hourly, flat, overnight)

**17. Design an LRU Cache.**

Use `LinkedHashMap` with `accessOrder=true` (Java built-in) or implement with `HashMap<K, Node>` + doubly linked list for O(1) get/put.

```java
// Core operations
Node get(K key) — move to front, return value
void put(K key, V value) — add to front, evict tail if capacity exceeded
```

Key insight: doubly linked list gives O(1) move-to-front; HashMap gives O(1) lookup.

→ Deep dive: [LRU Cache LLD](../lld/lru-cache.md)

**18. Design a Rate Limiter.**

Algorithm choice drives the design:
- **Token Bucket** (most common): `tokens` counter, `lastRefillTime`, `refill()` on each request
- For distributed: store tokens in Redis, use Lua script for atomic check-and-decrement

```java
interface RateLimiter { boolean allowRequest(String clientId); }
class TokenBucketRateLimiter implements RateLimiter { ... }
class RedisRateLimiter implements RateLimiter { ... }
```

Strategy pattern: swap algorithms without changing the interface.

→ Deep dive: [Rate Limiter LLD](../lld/rate-limiter.md)

**19. Design a Vending Machine.**

States: `IDLE`, `HAS_MONEY`, `DISPENSING`, `OUT_OF_STOCK`. Use **State pattern**.

```java
interface VendingMachineState { void insertMoney(int); void selectProduct(String); void dispense(); }
class IdleState implements VendingMachineState { ... }
class HasMoneyState implements VendingMachineState { ... }
```

Key classes: `VendingMachine`, `Product`, `Inventory`, `PaymentProcessor`.

→ Deep dive: [Vending Machine LLD](../lld/vending-machine.md)

**20. Design a Splitwise / Expense Sharing app.**

Key classes: `User`, `Group`, `Expense`, `Split` (Equal/Exact/Percentage), `Balance`.

Design decisions:
- `Split` is abstract; `EqualSplit`, `ExactSplit`, `PercentageSplit` extend it
- `Expense` has a list of `Split` objects
- `BalanceSheet` tracks net balance between every pair of users
- Strategy pattern for split calculation

→ Deep dive: [Splitwise LLD](../lld/splitwise.md)

**21. Design a Library Management System.**

Key classes: `Library`, `Book`, `BookItem` (physical copy), `Member`, `Librarian`, `Loan`, `Reservation`, `Fine`.

Design decisions:
- `Book` (metadata) vs `BookItem` (physical copy with barcode) — one Book has many BookItems
- `Reservation` queue per Book (not BookItem)
- Fine calculation strategy (per day, max cap)
- Observer pattern: notify member when reserved book becomes available

→ Deep dive: [Library Management LLD](../lld/library-management.md)

**22. Design an ATM system.**

States: `IDLE`, `CARD_INSERTED`, `AUTHENTICATED`, `TRANSACTION`, `DISPENSING`. Use **State pattern**.

Key classes: `ATM`, `Card`, `Account`, `Transaction` (Withdrawal/Deposit/Transfer), `CashDispenser`, `CardReader`, `Receipt`.

Design decisions:
- Chain of Responsibility for transaction validation (PIN check → balance check → daily limit check)
- Strategy pattern for `CashDispensingStrategy` (minimize notes)

→ Deep dive: [ATM System LLD](../lld/atm-system.md)

---

## Quick-Fire Questions

**23. What is the difference between `new` and Dependency Injection?**
`new` creates tight coupling — you control the lifecycle, can't easily swap implementations, hard to test. DI inverts control — the container/framework injects dependencies, making code testable and loosely coupled.

**24. What is a God Class? Why is it bad?**
A class that knows too much or does too much — violates SRP. Hard to test, hard to modify, creates merge conflicts. Break it into smaller, focused classes.

**25. What is Tell Don't Ask?**
Tell an object what to do rather than asking it for data and deciding yourself. `account.debit(100)` (good) vs `if (account.getBalance() >= 100) account.setBalance(account.getBalance() - 100)` (bad). Preserves encapsulation.

**26. What is the Law of Demeter?**
A method should only call methods on: itself, its parameters, objects it creates, its direct fields. Avoid `order.getCustomer().getAddress().getCity()` — chain calls expose internal structure.

**27. When would you use an Enum vs a class hierarchy?**
Enum for a fixed, known set of values with behavior (`Status.PENDING.isActive()`). Class hierarchy when behavior varies significantly between subtypes and new subtypes are expected.

**28. What is the Template Method pattern?**
Define the skeleton of an algorithm in a base class, let subclasses fill in specific steps without changing the overall structure. Common in frameworks (`JdbcTemplate`, `AbstractList`).

**29. What is the Proxy pattern?**
A proxy controls access to another object — adding lazy initialization, access control, logging, or caching. Spring AOP creates proxies around your beans for `@Transactional`, `@Cacheable`, etc.

**30. What is the Flyweight pattern?**
Share common state among many objects to save memory. Example: a text editor stores one `CharacterStyle` object per font/size/color combination, shared by all characters using that style. `String` interning is flyweight.

**31. What is Cohesion vs Coupling?**
**Cohesion:** how closely related the responsibilities within a class are — high cohesion is good (SRP). **Coupling:** how much classes depend on each other — low coupling is good. Goal: high cohesion, low coupling.

**32. What is the difference between Association, Aggregation, and Composition?**
**Association:** A uses B (loose, either can exist independently). **Aggregation:** A has-a B (B can exist without A — Department has Employees). **Composition:** A owns B (B can't exist without A — House has Rooms; Room destroyed with House).

**33. How do you decide between Composition and Strategy pattern?**
Both inject behavior. Strategy is for **swappable algorithms** at runtime (different sort strategies). Composition is for **structural relationships** (a Car *has* an Engine). If the behavior needs to change at runtime → Strategy. If it's a fixed structural relationship → Composition.

**34. What is an Immutable class? How do you create one?**
An object whose state cannot change after creation. Rules: `final` class, `private final` fields, no setters, deep copy mutable fields in constructor and getters. `String`, `Integer`, `LocalDate` are immutable.

**35. What is Clean Architecture?**
Layered architecture with strict dependency rule: outer layers depend on inner layers, never the reverse. Layers: Entities (domain) → Use Cases (application logic) → Interface Adapters (controllers, gateways) → Frameworks & Drivers. The domain model has zero dependency on Spring, Hibernate, or any framework.

→ Deep dive: [Clean Architecture](../misc/clean-architecture.md) · [LLD Roadmap](../lld/lld-roadmap.md)

---

## Go Deeper

- [LLD Roadmap](../lld/lld-roadmap.md) — complete prep guide + 35 interview questions
- [SOLID Principles](../solidprinciples/solidprinciples.md)
- [Design Patterns Overview](../designpatterns/dp.md)
- [LRU Cache](../lld/lru-cache.md) · [Rate Limiter](../lld/rate-limiter.md) · [ATM System](../lld/atm-system.md)
- [Vending Machine](../lld/vending-machine.md) · [Splitwise](../lld/splitwise.md) · [Library Management](../lld/library-management.md)
- [Clean Architecture](../misc/clean-architecture.md)
