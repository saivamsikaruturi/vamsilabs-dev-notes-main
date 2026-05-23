# Pattern Matching in Java (16-21+)

> **"Pattern matching transforms Java from an object-oriented language that fights you at every turn into one that flows with your intent — fewer casts, fewer nulls, fewer bugs."**

---

!!! danger "Real Incident: Payment Gateway Validator, 2023"
    A fintech startup had a 400-line `processTransaction()` method with nested `instanceof` checks and manual casts. A developer added a new payment type but forgot to handle it in 3 of 7 switch-like if-else chains. The compiler said nothing. Result: **$2.3M in unprocessed crypto payments** silently dropped for 6 hours. After migrating to sealed classes + pattern matching, the compiler now **refuses to compile** if any payment type is unhandled. Zero silent failures since.

---

## The Big Picture

```mermaid
flowchart LR
    subgraph Evolution["Pattern Matching Evolution"]
        J14["Java 14<br/>preview instanceof"] --> J16["Java 16<br/>instanceof finalized"]
        J16 --> J17["Java 17<br/>sealed classes"]
        J17 --> J21["Java 21<br/>switch + records"]
        J21 --> J22["Java 22+<br/>unnamed patterns"]
    end

    style J14 fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
    style J16 fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style J17 fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style J21 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style J22 fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
```

---

## Pattern Matching for `instanceof` (Java 16)

### Before vs After

```java
// ❌ Before: verbose cast-after-check (Java 15 and earlier)
public String format(Object obj) {
    if (obj instanceof String) {
        String s = (String) obj;           // redundant cast
        return "String[" + s.length() + "]: " + s.toUpperCase();
    } else if (obj instanceof Integer) {
        Integer i = (Integer) obj;         // redundant cast
        return "Integer: " + i.intValue();
    } else if (obj instanceof List) {
        List<?> list = (List<?>) obj;      // redundant cast
        return "List[" + list.size() + "]";
    }
    return "Unknown";
}

// ✅ After: pattern variable bound in the check (Java 16+)
public String format(Object obj) {
    if (obj instanceof String s) {
        return "String[" + s.length() + "]: " + s.toUpperCase();
    } else if (obj instanceof Integer i) {
        return "Integer: " + i.intValue();
    } else if (obj instanceof List<?> list) {
        return "List[" + list.size() + "]";
    }
    return "Unknown";
}
```

### Scoping Rules and Guards

```java
// Pattern variable scope extends to where it's definitely matched
if (obj instanceof String s && s.length() > 5) {
    // s is in scope here — the && guarantees obj IS a String
    System.out.println(s.toUpperCase());
}

// ❌ COMPILE ERROR — || doesn't guarantee the match
if (obj instanceof String s || s.length() > 5) {  // ERROR: s might not exist
}

// Pattern variable in negation — scoped to else
if (!(obj instanceof String s)) {
    return;  // early exit
}
// s is in scope here! compiler knows obj IS a String
System.out.println(s.toUpperCase());
```

---

## Pattern Matching for `switch` (Java 21)

The real power — type patterns, guards, nulls, and exhaustiveness all in one construct.

```mermaid
flowchart LR
    subgraph Switch["Switch Pattern Matching"]
        Input["Input Object"] --> TC{"Type Check"}
        TC -->|"String"| S["String branch"]
        TC -->|"Integer"| I["Integer branch"]
        TC -->|"List"| L["List branch"]
        TC -->|"null"| N["null branch"]
        TC -->|"default"| D["default branch"]
    end

    style Input fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style TC fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style S fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style I fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style L fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style N fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
    style D fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
```

### Basic Type Patterns

```java
public String describe(Object obj) {
    return switch (obj) {
        case Integer i -> "Integer: " + i;
        case Long l    -> "Long: " + l;
        case Double d  -> "Double: " + d;
        case String s  -> "String: " + s;
        case null      -> "null!";
        default        -> "Other: " + obj.getClass().getSimpleName();
    };
}
```

### Exhaustiveness Guarantee

The compiler **forces** you to handle all possibilities. For sealed types, no `default` is needed:

```java
sealed interface Shape permits Circle, Rectangle, Triangle {}
record Circle(double radius) implements Shape {}
record Rectangle(double w, double h) implements Shape {}
record Triangle(double base, double h) implements Shape {}

// Compiler verifies ALL subtypes are covered — no default needed!
public double area(Shape shape) {
    return switch (shape) {
        case Circle c    -> Math.PI * c.radius() * c.radius();
        case Rectangle r -> r.w() * r.h();
        case Triangle t  -> 0.5 * t.base() * t.h();
    };
}
// If you add a new Shape subtype later, this switch WON'T COMPILE until you handle it.
```

---

## Guarded Patterns with `when` Clause

Add conditions to pattern branches without nested if-else:

```java
public String classifyNumber(Object obj) {
    return switch (obj) {
        case Integer i when i < 0    -> "Negative int: " + i;
        case Integer i when i == 0   -> "Zero";
        case Integer i when i <= 100 -> "Small positive: " + i;
        case Integer i               -> "Large positive: " + i;
        case Double d when d.isNaN() -> "Not a number";
        case Double d when d.isInfinite() -> "Infinity";
        case Double d                -> "Double: " + d;
        case null                    -> "null";
        default                      -> "Not a number type";
    };
}
```

!!! tip "Interview Tip"
    `when` replaced the older `&&` guard syntax from preview versions. Always use `when` in Java 21+ switch patterns. The `&&` syntax was dropped before finalization.

---

## Record Patterns and Deconstruction (Java 21)

Destructure records directly in patterns — no manual accessor calls:

```java
record Point(int x, int y) {}
record Line(Point start, Point end) {}

// ❌ Before: manual extraction
public String describeLine(Object obj) {
    if (obj instanceof Line line) {
        Point start = line.start();
        Point end = line.end();
        int x1 = start.x();
        int y1 = start.y();
        int x2 = end.x();
        int y2 = end.y();
        return "Line from (" + x1 + "," + y1 + ") to (" + x2 + "," + y2 + ")";
    }
    return "Not a line";
}

// ✅ After: nested deconstruction in ONE pattern
public String describeLine(Object obj) {
    return switch (obj) {
        case Line(Point(int x1, int y1), Point(int x2, int y2))
            -> "Line from (" + x1 + "," + y1 + ") to (" + x2 + "," + y2 + ")";
        default -> "Not a line";
    };
}
```

### Nested Record Patterns

Deconstruct arbitrarily deep:

```java
record Address(String city, String country) {}
record Company(String name, Address hq) {}
record Employee(String name, Company company) {}

public String getEmployeeCity(Object obj) {
    return switch (obj) {
        // Three levels deep — record inside record inside record
        case Employee(String name, Company(_, Address(String city, String country)))
            when country.equals("US")
            -> name + " is based in " + city + ", USA";
        case Employee(String name, Company(String co, _))
            -> name + " works at " + co;
        default -> "Unknown";
    };
}
```

```mermaid
flowchart LR
    subgraph Deconstruction["Record Pattern Deconstruction"]
        E["Employee"] --> N["name: String"]
        E --> C["Company"]
        C --> CN["name: String"]
        C --> A["Address"]
        A --> CT["city: String"]
        A --> CO["country: String"]
    end

    style E fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style C fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style A fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style N fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
    style CN fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
    style CT fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
    style CO fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
```

---

## Unnamed Patterns `_` (Java 22+)

When you don't need a component, use `_` to ignore it:

```java
record Response(int status, String body, Map<String, String> headers) {}

public String summarize(Response resp) {
    return switch (resp) {
        case Response(int s, _, _) when s >= 500 -> "Server error: " + s;
        case Response(int s, _, _) when s >= 400 -> "Client error: " + s;
        case Response(int s, String body, _) when s == 200 -> "OK: " + body;
        case Response(_, _, _) -> "Other response";
    };
}

// Also works in instanceof
if (obj instanceof Line(Point(int x, _), _)) {
    // only care about the x coordinate of the start point
    System.out.println("Starts at x=" + x);
}
```

!!! info "Unnamed Variables Beyond Patterns"
    The `_` syntax also works in other contexts:
    ```java
    // catch block — don't need the exception
    try { parse(input); } catch (ParseException _) { return fallback; }
    
    // enhanced for — just counting
    for (var _ : collection) { count++; }
    
    // lambda — unused parameter
    map.computeIfAbsent(key, _ -> new ArrayList<>());
    ```

---

## Sealed Classes + Pattern Matching = Exhaustive Switches

The compiler **algebraically knows** all possible types. This is the killer combination:

```mermaid
flowchart LR
    subgraph Sealed["Sealed Hierarchy"]
        E["Event (sealed)"] --> P["PaymentReceived"]
        E --> R["Refunded"]
        E --> D["Disputed"]
        E --> S["Settled"]
    end

    subgraph Compiler["Compiler Guarantee"]
        SW["switch(event)"] --> CHK{"All 4 cases<br/>covered?"}
        CHK -->|"Yes"| OK["Compiles"]
        CHK -->|"No"| ERR["Compile Error!"]
    end

    Sealed --> Compiler

    style E fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style P fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style R fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style D fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
    style S fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style OK fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style ERR fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
```

```java
// Domain model — sealed hierarchy
public sealed interface PaymentEvent permits
    PaymentReceived, Refunded, Disputed, Settled {}

public record PaymentReceived(String txId, Money amount, Instant at) implements PaymentEvent {}
public record Refunded(String txId, Money amount, String reason) implements PaymentEvent {}
public record Disputed(String txId, String customerNote) implements PaymentEvent {}
public record Settled(String txId, Instant settledAt) implements PaymentEvent {}

// Handler — exhaustive, no default, compiler-checked
public Notification handle(PaymentEvent event) {
    return switch (event) {
        case PaymentReceived(String tx, Money amt, _)
            -> new Notification("Payment " + tx + " received: " + amt);
        case Refunded(String tx, Money amt, String reason)
            -> new Notification("Refund " + tx + ": " + amt + " — " + reason);
        case Disputed(String tx, String note)
            -> new Notification("Dispute on " + tx + ": " + note);
        case Settled(String tx, Instant at)
            -> new Notification("Settled " + tx + " at " + at);
    };
}
// Adding a new event type forces EVERY switch to be updated. Zero silent failures.
```

---

## Null Handling in Pattern Switches

Before Java 21, passing `null` to a switch threw `NullPointerException`. Now you can handle it explicitly:

```java
public String process(String input) {
    return switch (input) {
        case null           -> "No input provided";
        case String s when s.isBlank() -> "Empty input";
        case String s       -> "Processing: " + s;
    };
}

// Multiple null-aware patterns
public String describeShape(Shape shape) {
    return switch (shape) {
        case null            -> "No shape provided";
        case Circle c        -> "Circle r=" + c.radius();
        case Rectangle r     -> "Rect " + r.w() + "x" + r.h();
        case Triangle t      -> "Triangle b=" + t.base();
    };
}
```

!!! warning "Null Position Matters"
    The `case null` must be explicitly present — if omitted and `null` is passed, you still get a `NullPointerException`. There is no implicit null handling.

---

## Dominance and Ordering Rules

The compiler enforces that more specific patterns come **before** more general ones:

```java
// ✅ CORRECT — specific before general
return switch (obj) {
    case String s when s.isEmpty() -> "empty string";   // most specific
    case String s                  -> "string: " + s;   // less specific
    case Object o                  -> "other: " + o;    // least specific (dominates all)
};

// ❌ COMPILE ERROR — dominated pattern is unreachable
return switch (obj) {
    case String s                  -> "string: " + s;   // catches all strings
    case String s when s.isEmpty() -> "empty string";   // UNREACHABLE! dominated by above
    default -> "other";
};
```

| Rule | Explanation |
|------|-------------|
| **Subtype before supertype** | `case Integer` must come before `case Number` |
| **Guarded before unguarded** | `case String s when ...` before `case String s` |
| **Specific record before general** | `case Point(0, 0)` before `case Point(int x, int y)` |
| **`default` / total pattern last** | Always at the end |
| **`null` can be anywhere** | But typically first or last for clarity |

---

## Before vs After: Complete Comparison

### Event Processing (50%+ Less Boilerplate)

```java
// ❌ BEFORE: 45 lines, error-prone, no compiler safety
public String processEvent(Object event) {
    if (event == null) {
        return "No event";
    }
    if (event instanceof OrderPlaced) {
        OrderPlaced e = (OrderPlaced) event;
        if (e.total().compareTo(Money.of(1000)) > 0) {
            return "High-value order: " + e.orderId();
        }
        return "Order placed: " + e.orderId();
    } else if (event instanceof OrderShipped) {
        OrderShipped e = (OrderShipped) event;
        return "Shipped: " + e.orderId() + " tracking=" + e.trackingNumber();
    } else if (event instanceof OrderCancelled) {
        OrderCancelled e = (OrderCancelled) event;
        return "Cancelled: " + e.orderId() + " reason=" + e.reason();
    } else if (event instanceof OrderRefunded) {
        OrderRefunded e = (OrderRefunded) event;
        return "Refunded: " + e.orderId() + " amount=" + e.amount();
    } else {
        return "Unknown event: " + event.getClass().getName();
    }
}

// ✅ AFTER: 18 lines, exhaustive, null-safe, compiler-checked
public String processEvent(OrderEvent event) {
    return switch (event) {
        case null -> "No event";
        case OrderPlaced(String id, Money total, _) when total.compareTo(Money.of(1000)) > 0
            -> "High-value order: " + id;
        case OrderPlaced(String id, _, _)
            -> "Order placed: " + id;
        case OrderShipped(String id, String tracking)
            -> "Shipped: " + id + " tracking=" + tracking;
        case OrderCancelled(String id, String reason)
            -> "Cancelled: " + id + " reason=" + reason;
        case OrderRefunded(String id, Money amount)
            -> "Refunded: " + id + " amount=" + amount;
    };
}
```

| Metric | Before (Java 15) | After (Java 21+) | Improvement |
|--------|-------------------|-------------------|-------------|
| Lines of code | 45 | 18 | **60% reduction** |
| Manual casts | 4 | 0 | **Eliminated** |
| Null check | Manual, easy to forget | Built into switch | **Guaranteed** |
| New type added | Silent failure | **Compile error** | **Zero-defect** |
| Readability | Nested if-else soup | Flat, declarative | **Dramatically better** |

---

## Real-World Use Cases

### 1. Event Handler (CQRS/Event Sourcing)

```java
public sealed interface DomainEvent permits
    UserRegistered, UserVerified, UserSuspended, UserDeleted {}

public record UserRegistered(UserId id, Email email, Instant at) implements DomainEvent {}
public record UserVerified(UserId id, Instant at) implements DomainEvent {}
public record UserSuspended(UserId id, String reason, Instant until) implements DomainEvent {}
public record UserDeleted(UserId id, Instant at) implements DomainEvent {}

public UserState apply(UserState state, DomainEvent event) {
    return switch (event) {
        case UserRegistered(UserId id, Email email, _)
            -> new UserState(id, email, Status.PENDING, null);
        case UserVerified(_, Instant at)
            -> state.withStatus(Status.ACTIVE).withVerifiedAt(at);
        case UserSuspended(_, String reason, Instant until)
            -> state.withStatus(Status.SUSPENDED).withSuspensionReason(reason);
        case UserDeleted _
            -> state.withStatus(Status.DELETED);
    };
}
```

### 2. JSON/AST Parser

```java
public sealed interface JsonValue permits JsonString, JsonNumber, JsonBool, JsonNull, JsonArray, JsonObject {}
record JsonString(String value) implements JsonValue {}
record JsonNumber(double value) implements JsonValue {}
record JsonBool(boolean value) implements JsonValue {}
record JsonNull() implements JsonValue {}
record JsonArray(List<JsonValue> elements) implements JsonValue {}
record JsonObject(Map<String, JsonValue> fields) implements JsonValue {}

public String prettyPrint(JsonValue json, int indent) {
    String pad = " ".repeat(indent);
    return switch (json) {
        case JsonString(String v)  -> "\"" + v + "\"";
        case JsonNumber(double v)  -> String.valueOf(v);
        case JsonBool(boolean v)   -> String.valueOf(v);
        case JsonNull()            -> "null";
        case JsonArray(List<JsonValue> elems) ->
            "[\n" + elems.stream()
                .map(e -> pad + "  " + prettyPrint(e, indent + 2))
                .collect(Collectors.joining(",\n")) + "\n" + pad + "]";
        case JsonObject(Map<String, JsonValue> fields) ->
            "{\n" + fields.entrySet().stream()
                .map(e -> pad + "  \"" + e.getKey() + "\": " + prettyPrint(e.getValue(), indent + 2))
                .collect(Collectors.joining(",\n")) + "\n" + pad + "}";
    };
}
```

### 3. Request Validator

```java
public sealed interface ValidationResult permits Valid, Invalid {}
record Valid() implements ValidationResult {}
record Invalid(List<String> errors) implements ValidationResult {}

public ValidationResult validate(CreateUserRequest req) {
    List<String> errors = new ArrayList<>();

    switch (req.email()) {
        case null -> errors.add("Email is required");
        case String e when !e.contains("@") -> errors.add("Invalid email format");
        case String e when e.length() > 255 -> errors.add("Email too long");
        case String _ -> {} // valid
    }

    switch (req.age()) {
        case Integer a when a < 0   -> errors.add("Age cannot be negative");
        case Integer a when a < 13  -> errors.add("Must be at least 13");
        case Integer a when a > 150 -> errors.add("Invalid age");
        case null                   -> errors.add("Age is required");
        case Integer _              -> {} // valid
    }

    return errors.isEmpty() ? new Valid() : new Invalid(errors);
}
```

---

## Interview Questions

??? question "What is pattern matching for instanceof, and why was it introduced?"

    **Answer:** Pattern matching for `instanceof` (Java 16) eliminates the redundant cast-after-check pattern. Instead of testing `obj instanceof String` then casting `(String) obj`, you write `obj instanceof String s` — the variable `s` is bound and scoped automatically. It was introduced to reduce boilerplate, eliminate `ClassCastException` risks, and make the language more expressive. The pattern variable's scope follows **flow analysis** — it's only in scope where the compiler can prove the match succeeded.

??? question "How does switch pattern matching differ from traditional switch?"

    **Answer:** Traditional switch only works on primitives, enums, and strings. Pattern switch (Java 21) matches on **types**, supports **guards** (`when`), handles **null** explicitly, enables **record deconstruction**, and enforces **exhaustiveness** for sealed types. It's an expression (returns a value) and uses arrow syntax. The compiler checks dominance ordering to prevent unreachable patterns.

??? question "What are dominance rules in pattern switches?"

    **Answer:** Dominance rules prevent unreachable code. A pattern P1 *dominates* P2 if every value matching P2 also matches P1. Rules: (1) Unguarded patterns dominate guarded ones of the same type — so guarded must come first. (2) Supertypes dominate subtypes — `case Number` dominates `case Integer`. (3) `default` dominates everything — must be last. Violating dominance order is a compile error.

??? question "Explain how sealed classes and pattern matching work together for exhaustiveness."

    **Answer:** Sealed classes declare a fixed set of permitted subtypes (`sealed interface Shape permits Circle, Rectangle`). When you switch on a sealed type, the compiler knows ALL possible cases. If your switch covers every permitted subtype, no `default` is needed — and critically, if someone adds a new subtype later, every existing switch becomes a **compile error** until updated. This gives you compile-time guarantee of complete handling — something `default` branches silently hide.

??? question "What are record patterns and how do they enable nested deconstruction?"

    **Answer:** Record patterns let you destructure a record's components directly in a pattern: `case Point(int x, int y)`. Since records can contain other records, you can nest: `case Line(Point(int x1, int y1), Point(int x2, int y2))`. This eliminates chains of accessor calls. Combined with `_` for unnamed components, you can extract exactly the data you need from deeply nested structures in a single pattern.

---

## Quick Recall

| Feature | Java Version | Key Syntax | Killer Benefit |
|---------|-------------|------------|----------------|
| **instanceof patterns** | 16 | `obj instanceof String s` | Eliminates redundant casts |
| **Sealed classes** | 17 | `sealed interface X permits A, B` | Fixed type hierarchy |
| **Switch patterns** | 21 | `case Type t ->` | Type-safe branching |
| **Guarded patterns** | 21 | `case Type t when condition` | Conditions without nesting |
| **Record patterns** | 21 | `case Rec(int x, int y)` | Deconstruction in-place |
| **Nested patterns** | 21 | `case Outer(Inner(val))` | Deep extraction, one line |
| **Null in switch** | 21 | `case null ->` | Explicit null handling |
| **Exhaustiveness** | 21 | sealed + switch | Compile-time completeness |
| **Unnamed patterns** | 22+ | `case Rec(int x, _)` | Ignore irrelevant components |
| **Dominance** | 21 | specific before general | Prevents unreachable code |
