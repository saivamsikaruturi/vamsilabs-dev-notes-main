# Immutable Classes in Java

An immutable object **cannot be modified after creation**. Immutability is a cornerstone of safe concurrent programming, clean design, and reliable HashMap keys.

---

## Why Immutability Matters

| Benefit | Explanation |
|---|---|
| **Thread-safe** | No synchronization needed — shared freely across threads |
| **Safe HashMap key** | hashCode never changes after insertion |
| **No defensive copies** | Callers can't corrupt your internal state |
| **Simple to reason about** | No unexpected state changes, no side effects |
| **Cacheable** | Can be reused safely (e.g., String Pool, Integer Cache) |

---

## Immutable Classes in Java SDK

| Class | Why immutable |
|---|---|
| `String` | Used as HashMap keys, class names, security tokens |
| `Integer`, `Long`, `Double` (all wrappers) | Cached and shared across threads |
| `LocalDate`, `LocalTime`, `LocalDateTime` | Thread-safe date/time handling |
| `BigDecimal`, `BigInteger` | Financial calculations must be predictable |

---

## Rules for Creating an Immutable Class

| # | Rule | Why |
|---|------|-----|
| 1 | Declare class as **`final`** | Prevents subclasses from breaking immutability |
| 2 | All fields **`private final`** | Cannot be accessed or reassigned after construction |
| 3 | **No setter methods** | No external way to modify state |
| 4 | Initialize all fields via **constructor only** | State is set once at creation time |
| 5 | **Defensive copy IN** (constructor) | Callers can't mutate your internals via their reference |
| 6 | **Defensive copy OUT** (getters) | Callers can't mutate internals via the returned reference |

```java
public final class ImmutablePerson {          // Rule 1: final class
    private final String name;                 // Rule 2: private final
    private final List<String> hobbies;        // Rule 2: private final

    public ImmutablePerson(String name, List<String> hobbies) {
        this.name = name;                      // Rule 4: set via constructor
        this.hobbies = new ArrayList<>(hobbies); // Rule 5: defensive copy IN
    }

    public String getName() { return name; }   // Rule 3: no setters

    public List<String> getHobbies() {
        return Collections.unmodifiableList(hobbies); // Rule 6: defensive copy OUT
    }
}
```

---

## Complete Example

```java
public final class Employee {
    private final String name;
    private final int age;
    private final List<String> skills;
    private final Address address;

    public Employee(String name, int age, List<String> skills, Address address) {
        this.name = name;
        this.age = age;
        this.skills = new ArrayList<>(skills);         // defensive copy IN
        this.address = new Address(address);            // defensive copy IN
    }

    public String getName() { return name; }
    public int getAge() { return age; }

    public List<String> getSkills() {
        return Collections.unmodifiableList(skills);    // defensive copy OUT
    }

    public Address getAddress() {
        return new Address(address);                    // defensive copy OUT
    }
}
```

### Why defensive copies are critical

```java
// WITHOUT defensive copy — broken immutability
public Employee(String name, int age, List<String> skills) {
    this.skills = skills;  // stores the SAME reference
}

List<String> skills = new ArrayList<>(List.of("Java", "Spring"));
Employee emp = new Employee("Vamsi", 27, skills);
skills.add("Kafka");  // MODIFIES the Employee's internal list!
```

```java
// WITH defensive copy — true immutability
public Employee(String name, int age, List<String> skills) {
    this.skills = new ArrayList<>(skills);  // creates a NEW list
}

List<String> skills = new ArrayList<>(List.of("Java", "Spring"));
Employee emp = new Employee("Vamsi", 27, skills);
skills.add("Kafka");  // only modifies the local list, not Employee's
```

---

## Java Records (Java 17+) — Immutable by Default

Records are the simplest way to create immutable data carriers.

```java
public record Employee(String name, int age, List<String> skills) {
    public Employee {
        skills = List.copyOf(skills);  // defensive copy in compact constructor
    }
}

Employee emp = new Employee("Vamsi", 27, List.of("Java", "Spring"));
emp.name();     // "Vamsi"
emp.skills();   // unmodifiable list
```

Records auto-generate `equals()`, `hashCode()`, `toString()`, and accessors. Fields are `private final` by default.

---

## Handling Mutable Fields

| Field type | Strategy |
|---|---|
| `String`, primitives, wrappers | Already immutable — no action needed |
| `Date` | Copy in constructor: `new Date(date.getTime())`. Better: use `LocalDate` |
| `List`, `Set`, `Map` | Copy in: `new ArrayList<>(list)`. Copy out: `Collections.unmodifiableList()` or `List.copyOf()` |
| Custom mutable objects | Provide a copy constructor and use it both in and out |

---

## Unmodifiable vs Immutable

They're **not the same thing**.

```java
List<String> original = new ArrayList<>(List.of("A", "B"));
List<String> unmodifiable = Collections.unmodifiableList(original);

unmodifiable.add("C");  // throws UnsupportedOperationException

original.add("C");      // works!
unmodifiable.size();     // 3 — the "unmodifiable" view changed!
```

`Collections.unmodifiableList()` creates a **view** — it prevents modification through the view, but the underlying list can still be changed. For true immutability, use `List.copyOf()` (Java 10+) which creates an independent copy.

---

## Interview Questions

??? question "1. How do you make a class immutable if it has a Date field?"
    `Date` is mutable, so you must do defensive copies. In the constructor: `this.date = new Date(date.getTime())`. In the getter: `return new Date(date.getTime())`. Better approach: replace `Date` with `LocalDate` (Java 8+) which is already immutable — no defensive copies needed.

??? question "2. Why is String immutable in Java?"
    Five reasons: (1) String Pool would break if strings were mutable — shared references would corrupt each other. (2) hashCode caching — used as HashMap keys, the hash must never change. (3) Security — class names, URLs, file paths can't be tampered with. (4) Thread safety without synchronization. (5) Class loading uses strings internally — mutation could break the JVM.

??? question "3. Can you make an immutable class without `final` on the class?"
    Technically yes, but it's **unsafe**. A subclass could add mutable fields or override methods to break immutability. `final` on the class prevents subclassing, which is the only guaranteed way to enforce immutability. Without `final`, you're relying on trust, not the compiler.

??? question "4. What is the difference between `List.of()`, `List.copyOf()`, and `Collections.unmodifiableList()`?"
    `List.of(a, b, c)` — creates a new immutable list from the given elements. `List.copyOf(list)` — creates a new immutable list from an existing collection (independent copy). `Collections.unmodifiableList(list)` — creates an unmodifiable **view** of the original list (changes to the original are visible through the view). For true immutability, use `List.of()` or `List.copyOf()`.
