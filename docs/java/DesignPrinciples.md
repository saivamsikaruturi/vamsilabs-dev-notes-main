# Design Principles

!!! tip "Beyond SOLID"
    While SOLID principles are foundational, FAANG interviewers expect you to articulate a broader set of design principles that guide everyday engineering decisions. These principles help you write code that is maintainable, readable, and resilient to change.

---

## DRY (Don't Repeat Yourself)

> "Every piece of knowledge must have a single, unambiguous, authoritative representation within a system." -- The Pragmatic Programmer

### What It Means

DRY is about eliminating **knowledge duplication**, not just code duplication. If a business rule, algorithm, or configuration exists in multiple places, changing one without the others introduces bugs.

### Examples of Violation

```java
// Violation: validation logic duplicated across service and controller
public class OrderController {
    public void createOrder(OrderRequest req) {
        if (req.getAmount() <= 0) throw new InvalidOrderException();
        if (req.getItems().isEmpty()) throw new InvalidOrderException();
        // ...
    }
}

public class OrderService {
    public void processOrder(Order order) {
        if (order.getAmount() <= 0) throw new InvalidOrderException();
        if (order.getItems().isEmpty()) throw new InvalidOrderException();
        // ...
    }
}
```

### How to Fix

Extract shared logic into a single location:

```java
public class OrderValidator {
    public static void validate(Order order) {
        if (order.getAmount() <= 0) throw new InvalidOrderException("Amount must be positive");
        if (order.getItems().isEmpty()) throw new InvalidOrderException("Order must have items");
    }
}
```

### When DRY Goes Too Far (Premature Abstraction)

Not all code that *looks* similar represents the same knowledge. Two methods with identical code today may evolve independently tomorrow. Forcing them into a shared abstraction creates **coupling** where none should exist.

!!! warning "Rule of Three"
    Wait until you see duplication three times before extracting. Two occurrences may be coincidental; three indicate a real pattern.

---

## KISS (Keep It Simple, Stupid)

> The simplest solution that meets the requirements is usually the best.

### Over-Engineering vs Simple Solutions

```java
// Over-engineered: generic event bus with plugin architecture for a config reader
public class ConfigReader<T extends Serializable & Comparable<T>>
    extends AbstractConfigLoader<T>
    implements EventDriven<ConfigChangeEvent<T>>, Pluggable<ConfigPlugin<T>> {
    // ...
}

// KISS: just read the config
public class ConfigReader {
    private final Properties props;

    public ConfigReader(String filePath) throws IOException {
        this.props = new Properties();
        try (var in = new FileInputStream(filePath)) {
            props.load(in);
        }
    }

    public String get(String key) {
        return props.getProperty(key);
    }
}
```

**Key guideline**: Optimize for reading. Code is read 10x more than it is written. Clever code is the enemy of maintainable code.

---

## YAGNI (You Aren't Gonna Need It)

> Always implement things when you actually need them, never when you just foresee that you need them.

### Building for Now vs Speculative Generality

| Speculative Generality | YAGNI Approach |
|------------------------|----------------|
| Build a plugin system for future integrations | Add the integration you need now |
| Create abstract factory for one implementation | Use a simple constructor |
| Add configuration for every constant | Hard-code until you need flexibility |
| Support multiple databases "just in case" | Target the one database you use |

!!! info "Cost of Speculative Code"
    Unused abstractions still carry maintenance cost: they must be understood, tested, and refactored alongside real code. They also add indirection that slows onboarding.

---

## Composition Over Inheritance

### Why Inheritance Breaks (Fragile Base Class Problem)

Inheritance creates tight coupling between parent and child. Changes to the base class can silently break subclasses:

```java
// Fragile: HashSet counts adds in addAll by calling add() internally
public class CountingHashSet<E> extends HashSet<E> {
    private int addCount = 0;

    @Override
    public boolean add(E e) {
        addCount++;
        return super.add(e);
    }

    @Override
    public boolean addAll(Collection<? extends E> c) {
        addCount += c.size();
        return super.addAll(c); // Bug! super.addAll calls add(), double-counting
    }
}
```

### Composition Example

```java
// Fixed with composition: delegate instead of inherit
public class CountingSet<E> implements Set<E> {
    private final Set<E> delegate;
    private int addCount = 0;

    public CountingSet(Set<E> delegate) {
        this.delegate = delegate;
    }

    @Override
    public boolean add(E e) {
        addCount++;
        return delegate.add(e);
    }

    @Override
    public boolean addAll(Collection<? extends E> c) {
        addCount += c.size();
        return delegate.addAll(c); // No double-counting; we don't override delegate internals
    }

    public int getAddCount() {
        return addCount;
    }

    // Remaining Set methods delegate directly...
}
```

### Decision Guide: Inheritance vs Composition

| Use Inheritance When | Use Composition When |
|---------------------|---------------------|
| True "is-a" relationship exists | "Has-a" or "uses-a" relationship |
| You control both parent and child | You cannot modify the parent class |
| The parent is designed for extension | The parent's internals may change |
| Subclass is a genuine specialization | You need to combine multiple behaviors |
| Liskov Substitution holds cleanly | You want runtime flexibility |

---

## Law of Demeter (Principle of Least Knowledge)

> A method should only talk to its immediate friends, not to strangers.

### Train Wreck Code vs Proper Encapsulation

```java
// Violation: reaching through multiple objects ("train wreck")
String city = order.getCustomer().getAddress().getCity();

// Better: ask the object that owns the data
String city = order.getShippingCity();
```

### The Rules

A method `M` of object `O` may only call methods on:

1. `O` itself
2. Objects passed as parameters to `M`
3. Objects created within `M`
4. `O`'s direct component objects (fields)

!!! note "Fluent APIs Are Not Violations"
    Builder patterns like `Stream.of(1,2,3).filter(x -> x > 1).map(...)` do not violate Demeter because each call returns the *same abstraction type* -- you are not reaching into unrelated objects.

---

## Tell, Don't Ask

> Instead of asking an object for its state and making decisions, tell the object what to do.

### Asking for State vs Telling to Act

```java
// Ask (bad): pulling state out and making decisions externally
if (account.getBalance() >= amount && !account.isFrozen()) {
    account.setBalance(account.getBalance() - amount);
    ledger.record(account, amount);
}

// Tell (good): let the object own its behavior
account.withdraw(amount, ledger);  // Account decides if it can, records internally
```

**Why it matters**: When logic is spread across callers, changes to business rules require finding and updating every caller. Encapsulating behavior keeps the logic in one place.

---

## Separation of Concerns

> Each module, class, or function should address a single concern.

### Layered Architecture (SRP Applied)

```
Controller Layer   -- HTTP handling, request/response mapping
    |
Service Layer      -- Business logic, orchestration
    |
Repository Layer   -- Data access, persistence
    |
Domain Layer       -- Entities, value objects, business rules
```

Each layer has a single reason to change:

- **Controller** changes when API contracts change
- **Service** changes when business rules change
- **Repository** changes when storage technology changes
- **Domain** changes when the business model evolves

### Cross-Cutting Concerns

Use aspects or middleware for logging, security, and transaction management rather than scattering them across business logic.

---

## Principle of Least Astonishment

> A component should behave in a way that most users expect; it should not surprise them.

### API Design Guidelines

```java
// Surprising: sort() returns void, modifying in place
list.sort(comparator);  // Java's choice -- familiar, but mutates

// Less surprising for a functional API: return a new sorted list
List<T> sorted = list.stream().sorted(comparator).collect(toList());
```

### Naming Conventions

| Surprising | Not Surprising |
|-----------|---------------|
| `list.remove(1)` removing by index when you expect by value | Provide `removeByIndex()` and `removeByValue()` |
| `calculateTax()` that also saves to DB | Name it `calculateAndPersistTax()` or split into two methods |
| A `validate()` method that silently fixes data | Name it `sanitize()` or `normalizeAndValidate()` |

### Consistent Behavior

- If `equals()` returns true, `hashCode()` must return the same value
- If one collection method throws on null, all should (or none should)
- If your API uses checked exceptions in one place, do not use unchecked in analogous places

---

## Favor Immutability

> Make objects immutable unless there is a compelling reason not to.

### Benefits

| Benefit | Explanation |
|---------|-------------|
| **Thread safety** | Immutable objects can be shared across threads with no synchronization |
| **Simpler reasoning** | No defensive copies needed; state cannot change after construction |
| **Safe hash keys** | Can be used in HashMaps without risk of corruption |
| **Failure atomicity** | If construction fails, no half-built mutable state leaks |

### Implementation Pattern

```java
public final class Money {
    private final BigDecimal amount;
    private final Currency currency;

    public Money(BigDecimal amount, Currency currency) {
        this.amount = amount;
        this.currency = currency;
    }

    public Money add(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new IllegalArgumentException("Currency mismatch");
        }
        return new Money(this.amount.add(other.amount), this.currency);
    }

    // Getters only, no setters
    public BigDecimal getAmount() { return amount; }
    public Currency getCurrency() { return currency; }
}
```

With Java 16+ Records:

```java
public record Money(BigDecimal amount, Currency currency) {
    public Money add(Money other) {
        if (!this.currency.equals(other.currency))
            throw new IllegalArgumentException("Currency mismatch");
        return new Money(this.amount.add(other.amount), this.currency);
    }
}
```

---

## Program to Interfaces, Not Implementations

> Depend on abstractions. Clients should not know or care about the concrete class behind the interface.

### Why This Matters

```java
// Coupled to implementation
ArrayList<String> names = new ArrayList<>();

// Programmed to interface: can swap to LinkedList, unmodifiable list, etc.
List<String> names = new ArrayList<>();
```

### Dependency Injection Example

```java
public class NotificationService {
    private final MessageSender sender; // Interface

    public NotificationService(MessageSender sender) {
        this.sender = sender;
    }

    public void notifyUser(User user, String message) {
        sender.send(user.getEmail(), message);
    }
}

// Swap implementations without touching NotificationService
MessageSender email = new EmailSender();
MessageSender sms = new SmsSender();
MessageSender slack = new SlackSender();
```

### Benefits

- **Testability**: inject mocks/stubs easily
- **Flexibility**: swap implementations at runtime or configuration time
- **Decoupling**: changes to one implementation do not ripple to clients

---

## Summary Table

| Principle | One-Line Rule | Violation Smell | Fix |
|-----------|--------------|-----------------|-----|
| DRY | Single source of truth for every piece of knowledge | Copy-paste code, shotgun surgery | Extract shared logic to one place |
| KISS | Choose the simplest design that works | Unnecessary generics, deep hierarchies | Remove indirection; flatten |
| YAGNI | Build only what you need today | Unused abstractions, dead code paths | Delete speculative code |
| Composition over Inheritance | Prefer has-a over is-a | Deep inheritance trees, fragile overrides | Delegate to composed objects |
| Law of Demeter | Talk only to your friends | Long method chains crossing objects | Create encapsulating methods |
| Tell, Don't Ask | Command objects, don't query and decide | Getters followed by external logic | Move behavior into the object |
| Separation of Concerns | One reason to change per module | God classes, mixed layers | Split into focused modules |
| Least Astonishment | No surprises in naming or behavior | Misleading method names, side effects | Rename; separate side effects |
| Favor Immutability | Default to final; mutate only when needed | Setters everywhere, thread bugs | Use final fields, return new instances |
| Program to Interfaces | Depend on abstractions | Concrete types in signatures | Use interface types; inject deps |

---

## Interview Questions

??? question "You find the same 20-line validation block in 5 services. How do you refactor, and what risks does DRY introduce here?"
    **Answer**: Extract the validation into a single `Validator` class or utility method. However, the risk is **premature coupling** -- if those 5 services evolve independently, a shared validator becomes a bottleneck that everyone is afraid to change. Mitigate by ensuring the 5 usages truly represent the *same business rule*, not just *similar-looking code*. If they might diverge, keep them separate or use a strategy pattern so each service can override specifics.

??? question "A colleague proposes a plugin architecture for a feature with exactly one implementation. What principle would you cite to push back, and how would you explain it?"
    **Answer**: Cite **YAGNI**. A plugin architecture adds interfaces, service loaders, configuration, and testing overhead -- all for a second implementation that may never arrive. Propose building the simple, direct implementation now. If a second plugin is needed later, the refactoring to introduce an interface is straightforward and will be guided by the *actual* requirements of the second plugin rather than speculation.

??? question "Explain the fragile base class problem and how composition solves it. Give a real-world Java example."
    **Answer**: The fragile base class problem occurs when a subclass depends on implementation details of its parent. Java's `HashSet.addAll()` internally calls `add()` -- if you override both in a subclass, you get unexpected double-counting. Composition solves this by wrapping the base class via delegation: you hold a `Set` field and forward calls. Your wrapper is insulated from internal call patterns because you never override the delegate's methods -- you only intercept at the boundary you control.

??? question "What does the Law of Demeter say, and when is it acceptable to violate it?"
    **Answer**: The Law of Demeter states a method should only invoke methods on (1) itself, (2) its parameters, (3) objects it creates, (4) its fields. Acceptable "violations" include fluent APIs (builders, streams) where chained calls return the *same type*, and navigating data structures (DTOs/value objects) in mapping layers where behavior does not belong on the DTO. The law targets *behavioral* coupling, not data traversal in mapping code.

??? question "How does favoring immutability improve concurrent code? What is the trade-off?"
    **Answer**: Immutable objects are inherently thread-safe -- they cannot be in an inconsistent state because their state never changes after construction. No locks, no volatile, no happens-before reasoning needed. The trade-off is **allocation pressure**: every "modification" creates a new object, increasing GC load. In practice, modern JVMs with generational GC handle short-lived immutable objects efficiently, and the correctness guarantee far outweighs the small performance cost for most applications.

??? question "A method `processOrder()` calls `order.getCustomer().getAddress().getZipCode()` to decide shipping cost. Redesign this using Tell Don't Ask and Law of Demeter."
    **Answer**: Instead of reaching through the object graph, add a method `order.calculateShippingCost(ShippingPolicy policy)`. The `Order` knows its customer, the customer knows its address, and the address knows its zip code -- each object asks only its immediate collaborator. The `ShippingPolicy` (passed as a parameter) encapsulates the rate logic. This way, `processOrder()` simply tells the order to compute its cost, and the internal structure of Customer/Address can change without affecting the caller.
