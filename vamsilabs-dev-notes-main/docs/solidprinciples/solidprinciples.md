# SOLID Principles — The FAANG Interview Guide

> "Any fool can write code that a computer can understand. Good programmers write code that humans can understand." — Martin Fowler

SOLID is not academic theory. It's the lens through which FAANG interviewers evaluate whether you can write **production-grade, maintainable, extensible** software. Every design discussion, code review, and system design interview at companies like Amazon, Google, Microsoft, and Salesforce touches these principles.

---

## Quick Reference

| Principle | One-liner | Real-world analogy |
|---|---|---|
| **S** — Single Responsibility | One class, one reason to change | A chef cooks. A waiter serves. Don't make the chef serve tables. |
| **O** — Open/Closed | Open for extension, closed for modification | A power strip — you plug in new devices without rewiring the house. |
| **L** — Liskov Substitution | Subtypes must be substitutable for their base types | If you order a "vehicle" and get a boat when you needed road transport — that's a violation. |
| **I** — Interface Segregation | No client should be forced to depend on methods it doesn't use | A TV remote shouldn't have buttons for a washing machine. |
| **D** — Dependency Inversion | Depend on abstractions, not concretions | You plug any USB device into a USB port. The port doesn't care what device it is. |

---

## S — Single Responsibility Principle (SRP)

> A class should have only **one reason to change**.

This doesn't mean a class should have only one method. It means a class should be responsible for **one actor** or **one business concern**.

### The Violation

```java
public class UserService {
    public void registerUser(User user) {
        // validate
        if (user.getEmail() == null) throw new IllegalArgumentException("Email required");
        // save to database
        jdbcTemplate.update("INSERT INTO users ...", user.getName(), user.getEmail());
        // send welcome email
        emailClient.send(user.getEmail(), "Welcome!", "Thanks for signing up.");
        // log the event
        auditLogger.log("USER_REGISTERED", user.getId());
    }
}
```

**Why this is bad**: This class changes if validation rules change, if you switch databases, if email templates change, or if audit log format changes. That's **4 reasons to change**.

### The Fix

```java
public class UserValidator {
    public void validate(User user) {
        if (user.getEmail() == null) throw new IllegalArgumentException("Email required");
    }
}

public class UserRepository {
    public void save(User user) {
        jdbcTemplate.update("INSERT INTO users ...", user.getName(), user.getEmail());
    }
}

public class WelcomeEmailService {
    public void sendWelcome(User user) {
        emailClient.send(user.getEmail(), "Welcome!", "Thanks for signing up.");
    }
}

public class UserRegistrationService {
    private final UserValidator validator;
    private final UserRepository repository;
    private final WelcomeEmailService emailService;

    public void register(User user) {
        validator.validate(user);
        repository.save(user);
        emailService.sendWelcome(user);
    }
}
```

Now each class has **one reason to change** and can be tested independently.

### Real-world at FAANG

At **Walmart**, our label generation service initially had a single `LabelService` class that validated orders, generated PDF labels, uploaded to blob storage, and sent Kafka events. When blob upload logic needed a retry mechanism, we had to touch the same class that handled PDF generation. After applying SRP, each concern was isolated — the retry fix was a one-class change with zero risk to PDF generation.

### How interviewers test this

!!! question "FAANG interview question"
    *"You have an OrderService that validates orders, calculates pricing, saves to DB, and sends notifications. How would you refactor it?"*

    **What they want to hear**: Extract `OrderValidator`, `PricingEngine`, `OrderRepository`, `NotificationService`. The orchestrator (`OrderService`) delegates to each. Each can be tested, mocked, and changed independently.

---

## O — Open/Closed Principle (OCP)

> Software entities should be **open for extension** but **closed for modification**.

When a new requirement comes in, you should be able to add **new code** without changing **existing tested code**.

### The Violation

```java
public class DiscountCalculator {
    public double calculate(Order order) {
        if (order.getType().equals("REGULAR")) {
            return order.getTotal() * 0.05;
        } else if (order.getType().equals("PREMIUM")) {
            return order.getTotal() * 0.15;
        } else if (order.getType().equals("VIP")) {
            return order.getTotal() * 0.25;
        }
        // Every new customer type = modify this class
        return 0;
    }
}
```

**Why this is bad**: Adding a "STUDENT" discount means modifying a tested, production class. Every `if-else` addition is a regression risk.

### The Fix — Strategy Pattern

```java
public interface DiscountStrategy {
    double calculate(Order order);
}

public class RegularDiscount implements DiscountStrategy {
    public double calculate(Order order) { return order.getTotal() * 0.05; }
}

public class PremiumDiscount implements DiscountStrategy {
    public double calculate(Order order) { return order.getTotal() * 0.15; }
}

public class VipDiscount implements DiscountStrategy {
    public double calculate(Order order) { return order.getTotal() * 0.25; }
}

// Adding StudentDiscount = new file, zero changes to existing code
public class StudentDiscount implements DiscountStrategy {
    public double calculate(Order order) { return order.getTotal() * 0.20; }
}

public class DiscountCalculator {
    private final DiscountStrategy strategy;

    public DiscountCalculator(DiscountStrategy strategy) {
        this.strategy = strategy;
    }

    public double calculate(Order order) {
        return strategy.calculate(order);
    }
}
```

### Where you see OCP in the real world

| Framework / Library | OCP in action |
|---|---|
| **Spring Boot** | `@Configuration` classes extend behavior without modifying framework code |
| **Java I/O** | `BufferedInputStream(new FileInputStream(...))` — Decorator pattern wraps without modifying |
| **Kafka** | Custom `Serializer<T>` and `Deserializer<T>` — you extend serialization without touching Kafka internals |
| **JDBC** | `DriverManager` loads any driver implementing `java.sql.Driver` — new databases, zero code change |

### How interviewers test this

!!! question "FAANG interview question"
    *"Your payment service supports Credit Card and PayPal. The PM now wants to add UPI and Apple Pay. How do you design this so adding future payment methods doesn't require modifying existing code?"*

    **What they want to hear**: `PaymentProcessor` interface → `CreditCardProcessor`, `PayPalProcessor`, `UpiProcessor`. Factory or DI resolves the right implementation. The core checkout flow never changes.

---

## L — Liskov Substitution Principle (LSP)

> If `S` is a subtype of `T`, then objects of type `T` can be replaced with objects of type `S` **without breaking the program**.

This is the most misunderstood principle. It's not just about inheritance compiling — it's about **behavioral compatibility**.

### The Classic Violation — Rectangle & Square

```java
public class Rectangle {
    protected int width, height;

    public void setWidth(int w)  { this.width = w; }
    public void setHeight(int h) { this.height = h; }
    public int area() { return width * height; }
}

public class Square extends Rectangle {
    @Override
    public void setWidth(int w)  { this.width = w; this.height = w; }
    @Override
    public void setHeight(int h) { this.width = h; this.height = h; }
}
```

```java
void testArea(Rectangle r) {
    r.setWidth(5);
    r.setHeight(4);
    assert r.area() == 20; // FAILS for Square! area = 16
}
```

A `Square` **is-a** `Rectangle` in math, but NOT in code because it **breaks the expected behavior** of `Rectangle`.

### The Fix

```java
public interface Shape {
    int area();
}

public class Rectangle implements Shape {
    private final int width, height;
    public Rectangle(int w, int h) { this.width = w; this.height = h; }
    public int area() { return width * height; }
}

public class Square implements Shape {
    private final int side;
    public Square(int s) { this.side = s; }
    public int area() { return side * side; }
}
```

No inheritance. Both implement `Shape`. Neither breaks the other's contract.

### A More Practical Violation

```java
public class Bird {
    public void fly() { System.out.println("Flying..."); }
}

public class Ostrich extends Bird {
    @Override
    public void fly() { throw new UnsupportedOperationException("Can't fly!"); }
}
```

Any code doing `bird.fly()` will blow up if it gets an `Ostrich`. That's an LSP violation.

**Fix**: Split into `FlyingBird` and `NonFlyingBird`, or use a `Flyable` interface that only flying birds implement.

### The LSP checklist

| Rule | Meaning |
|---|---|
| Preconditions cannot be **strengthened** | Subclass can't demand more than parent |
| Postconditions cannot be **weakened** | Subclass must deliver at least what parent promises |
| Invariants must be **preserved** | If parent guarantees X, subclass must too |
| No new **exceptions** | Subclass shouldn't throw exceptions the parent doesn't |

### How interviewers test this

!!! question "FAANG interview question"
    *"You have a `Notification` base class with `send()`. SMS, Email, and Push extend it. But Push notifications require a device token that SMS and Email don't need. How do you handle this without violating LSP?"*

    **What they want to hear**: The `send()` contract should not assume all subclasses have the same prerequisites. Either use a `Notifiable` interface with a `canSend()` check, or pass notification-specific config through a context object rather than forcing all subtypes to accept the same parameters.

---

## I — Interface Segregation Principle (ISP)

> No client should be forced to depend on methods it does not use.

Fat interfaces force implementors to write dummy methods. That's a design smell.

### The Violation

```java
public interface Worker {
    void work();
    void eat();
    void sleep();
}

public class HumanWorker implements Worker {
    public void work()  { /* writes code */ }
    public void eat()   { /* has lunch */ }
    public void sleep() { /* goes home */ }
}

public class RobotWorker implements Worker {
    public void work()  { /* assembles parts */ }
    public void eat()   { /* DOES NOTHING — robots don't eat */ }
    public void sleep() { /* DOES NOTHING — robots don't sleep */ }
}
```

`RobotWorker` is forced to implement `eat()` and `sleep()` — methods it will never use.

### The Fix

```java
public interface Workable {
    void work();
}

public interface Feedable {
    void eat();
}

public interface Restable {
    void sleep();
}

public class HumanWorker implements Workable, Feedable, Restable {
    public void work()  { /* writes code */ }
    public void eat()   { /* has lunch */ }
    public void sleep() { /* goes home */ }
}

public class RobotWorker implements Workable {
    public void work() { /* assembles parts */ }
}
```

Each interface is **cohesive** — it contains only related methods.

### ISP in real frameworks

| Example | What it does |
|---|---|
| **Java** `Serializable` vs `Externalizable` | `Serializable` is a marker — zero methods. `Externalizable` adds `readExternal`/`writeExternal` only when you need custom serialization. |
| **Spring** `InitializingBean` vs `DisposableBean` | Separate interfaces for lifecycle hooks — you implement only what you need. |
| **JDBC** `ResultSet` | Famously violates ISP — 200+ methods. Most code uses 5–10 of them. |

### How interviewers test this

!!! question "FAANG interview question"
    *"You're designing a `Vehicle` interface for a fleet management system. Cars can drive and refuel. Electric cars can drive and charge. Bicycles can only be driven. How do you design the interfaces?"*

    **What they want to hear**: `Drivable` (drive), `Refuelable` (refuel), `Chargeable` (charge). `Car implements Drivable, Refuelable`. `ElectricCar implements Drivable, Chargeable`. `Bicycle implements Drivable`. No dummy methods anywhere.

---

## D — Dependency Inversion Principle (DIP)

> - High-level modules should not depend on low-level modules. Both should depend on **abstractions**.
> - Abstractions should not depend on details. Details should depend on **abstractions**.

This is the foundation of **Dependency Injection** in Spring, Guice, and every modern framework.

### The Violation

```java
public class OrderService {
    private MySqlOrderRepository repository = new MySqlOrderRepository();
    private SmtpEmailService emailService = new SmtpEmailService();

    public void placeOrder(Order order) {
        repository.save(order);
        emailService.sendConfirmation(order);
    }
}
```

**Why this is bad**: `OrderService` is **welded** to MySQL and SMTP. Want to switch to PostgreSQL? Change `OrderService`. Want to use SendGrid instead of SMTP? Change `OrderService`. Want to unit test without a real database? You can't.

### The Fix

```java
public interface OrderRepository {
    void save(Order order);
}

public interface EmailService {
    void sendConfirmation(Order order);
}

public class MySqlOrderRepository implements OrderRepository {
    public void save(Order order) { /* MySQL-specific SQL */ }
}

public class PostgresOrderRepository implements OrderRepository {
    public void save(Order order) { /* Postgres-specific SQL */ }
}

public class OrderService {
    private final OrderRepository repository;
    private final EmailService emailService;

    public OrderService(OrderRepository repository, EmailService emailService) {
        this.repository = repository;
        this.emailService = emailService;
    }

    public void placeOrder(Order order) {
        repository.save(order);
        emailService.sendConfirmation(order);
    }
}
```

Now `OrderService` depends on **abstractions** (`OrderRepository`, `EmailService`). You can swap implementations, mock for tests, and extend without touching the core logic.

### The dependency direction

```
WITHOUT DIP:                          WITH DIP:

OrderService                          OrderService
    │                                     │
    ├──▶ MySqlOrderRepository             ├──▶ OrderRepository (interface)
    │                                     │         ▲
    └──▶ SmtpEmailService                 │    MySqlOrderRepository
                                          │
                                          └──▶ EmailService (interface)
                                                    ▲
                                               SmtpEmailService
```

High-level policy (`OrderService`) no longer depends on low-level details. The **arrows point toward abstractions**.

### DIP in Spring Boot (what you use daily)

```java
@Service
public class OrderService {
    private final OrderRepository repository; // interface

    public OrderService(OrderRepository repository) {
        this.repository = repository; // Spring injects the right impl
    }
}
```

Spring's `@Autowired` / constructor injection **is** DIP in action. You code against interfaces; the container resolves implementations.

### How interviewers test this

!!! question "FAANG interview question"
    *"Your notification service directly instantiates `TwilioSmsClient` and `SendGridEmailClient`. How would you refactor this to support adding WhatsApp notifications without changing the existing service?"*

    **What they want to hear**: Define a `NotificationChannel` interface with `send(Message)`. Twilio, SendGrid, and WhatsApp each implement it. The service receives `List<NotificationChannel>` via constructor injection. Adding WhatsApp = new class + config change, zero modification to the service.

---

## SOLID Violations Cheat Sheet

Use this to quickly spot violations in code reviews or interviews:

| Smell | Principle violated | Fix |
|---|---|---|
| Class has 500+ lines, does 10 things | **SRP** | Extract classes by responsibility |
| Giant `if-else` or `switch` for types | **OCP** | Strategy pattern + polymorphism |
| Subclass throws `UnsupportedOperationException` | **LSP** | Re-think the hierarchy, use composition |
| Implementing interface with empty/dummy methods | **ISP** | Split interface into smaller ones |
| `new ConcreteClass()` inside business logic | **DIP** | Inject via interface + constructor |
| Method takes boolean flag to change behavior | **SRP + OCP** | Split into two methods or use Strategy |
| Changing one class breaks unrelated tests | **SRP** | That class has multiple responsibilities |

---

## SOLID in System Design Interviews

SOLID isn't just for coding rounds. In system design interviews, interviewers look for these signals:

| Principle | System Design application |
|---|---|
| **SRP** | Each microservice owns one bounded context (Order Service doesn't handle Payments) |
| **OCP** | Plugin architectures — adding a new payment provider doesn't modify the checkout flow |
| **LSP** | API versioning — v2 must be backward-compatible with v1 consumers |
| **ISP** | GraphQL over REST — clients query only the fields they need |
| **DIP** | Services communicate via message contracts (Kafka topics, API specs), not direct coupling |

---

## Interview Questions — FAANG Level

??? question "1. You see a 300-line `process()` method in a service class. What's wrong and how do you fix it?"
    **Violation**: SRP — the method likely handles validation, business logic, persistence, and notifications in one place.

    **Fix**: Extract each concern into its own class. The `process()` method becomes an orchestrator that delegates to `Validator`, `BusinessRuleEngine`, `Repository`, and `NotificationService`. Each extracted class is independently testable.

??? question "2. How would you design a file export system that supports CSV, PDF, Excel, and new formats in the future?"
    **Principle**: OCP

    **Design**: `FileExporter` interface with `export(Data data, OutputStream out)`. Each format gets its own class: `CsvExporter`, `PdfExporter`, `ExcelExporter`. A `ExporterFactory` or DI resolves the right implementation. Adding XML export = new class, zero changes to existing code.

??? question "3. A `Bird` class has a `fly()` method. Penguin extends Bird but throws an exception in `fly()`. What's the issue?"
    **Violation**: LSP — Penguin breaks the behavioral contract of Bird.

    **Fix**: Don't model Penguin as a Bird if Bird promises flight. Use `Flyable` interface implemented only by birds that can fly. Penguin implements `Swimmable` instead. Prefer composition over inheritance.

??? question "4. Your team's `Repository` interface has 25 methods but most implementations only use 5. What do you do?"
    **Violation**: ISP — fat interface forces dummy implementations.

    **Fix**: Split into focused interfaces: `ReadRepository` (find, findAll), `WriteRepository` (save, delete), `PaginatedRepository` (findPage). Implementations compose only what they need. Spring Data JPA does exactly this with `CrudRepository`, `JpaRepository`, `PagingAndSortingRepository`.

??? question "5. An interviewer asks: 'Your service directly creates `new AmazonS3Client()` inside business logic. What's the problem?'"
    **Violation**: DIP — high-level business logic is coupled to a specific AWS SDK implementation.

    **Fix**: Define `FileStorage` interface with `upload()` and `download()`. `S3FileStorage implements FileStorage`. Inject via constructor. Now you can swap to GCS, Azure Blob, or a local mock for testing without touching business logic.

??? question "6. When is it acceptable to violate SOLID principles?"
    **Answer**: SOLID is a guideline, not a religion. Acceptable violations:

    - **Prototypes / MVPs**: Speed matters more than extensibility. Refactor later.
    - **Simple scripts**: A 50-line utility doesn't need 5 classes.
    - **Performance-critical code**: Sometimes tight coupling (DIP violation) or a concrete class (OCP violation) is faster. Profile first.
    - **Premature abstraction**: Creating interfaces for things that will never have a second implementation adds complexity for no benefit.

    The key is being **intentional** about violations and documenting the trade-off.

