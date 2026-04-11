# Enums in Java

Enums represent a **fixed set of constants**. They're type-safe, can have fields, methods, and constructors, and are one of the most underused features in Java.

---

## Basic Enum

```java
public enum Day {
    MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY
}

Day today = Day.MONDAY;

// Switch works perfectly with enums
switch (today) {
    case MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY -> System.out.println("Weekday");
    case SATURDAY, SUNDAY -> System.out.println("Weekend");
}
```

---

## Enum with Fields, Constructors & Methods

Each enum constant can hold **data and behavior**.

```java
public enum HttpStatus {
    OK(200, "Success"),
    NOT_FOUND(404, "Not Found"),
    INTERNAL_ERROR(500, "Internal Server Error"),
    BAD_REQUEST(400, "Bad Request");

    private final int code;
    private final String message;

    HttpStatus(int code, String message) {  // constructor is always private
        this.code = code;
        this.message = message;
    }

    public int getCode() { return code; }
    public String getMessage() { return message; }

    public boolean isError() { return code >= 400; }
}

HttpStatus status = HttpStatus.NOT_FOUND;
status.getCode();      // 404
status.getMessage();   // "Not Found"
status.isError();      // true
```

---

## Enum with Abstract Methods

Each constant can have **different behavior**.

```java
public enum Operation {
    ADD {
        public double apply(double a, double b) { return a + b; }
    },
    SUBTRACT {
        public double apply(double a, double b) { return a - b; }
    },
    MULTIPLY {
        public double apply(double a, double b) { return a * b; }
    },
    DIVIDE {
        public double apply(double a, double b) {
            if (b == 0) throw new ArithmeticException("Division by zero");
            return a / b;
        }
    };

    public abstract double apply(double a, double b);
}

double result = Operation.ADD.apply(10, 20);  // 30.0
```

---

## Enum Implementing Interfaces

```java
public interface Printable {
    String display();
}

public enum Priority implements Printable {
    LOW("Low priority"),
    MEDIUM("Medium priority"),
    HIGH("High priority"),
    CRITICAL("Critical — immediate action required");

    private final String description;

    Priority(String description) { this.description = description; }

    @Override
    public String display() { return name() + ": " + description; }
}
```

---

## Useful Enum Methods

```java
Day day = Day.MONDAY;

day.name();              // "MONDAY" (String name)
day.ordinal();           // 0 (position index)
Day.valueOf("MONDAY");   // Day.MONDAY (String → enum)
Day.values();            // Day[] {MONDAY, TUESDAY, ...}

// Iterate over all values
for (Day d : Day.values()) {
    System.out.println(d);
}
```

---

## Enum as Singleton (Thread-Safe)

Enums are the **best way to implement Singleton** in Java (Joshua Bloch, Effective Java).

```java
public enum DatabaseConnection {
    INSTANCE;

    private Connection connection;

    DatabaseConnection() {
        connection = createConnection();
    }

    public Connection getConnection() { return connection; }
}

// Usage
DatabaseConnection.INSTANCE.getConnection();
```

**Why enums are the best Singleton**: JVM guarantees exactly one instance, handles serialization automatically (no `readResolve()` needed), and prevents reflection attacks.

---

## EnumSet & EnumMap

Specialized collections for enums — faster than `HashSet`/`HashMap`.

```java
// EnumSet — uses a bit vector internally (extremely fast)
EnumSet<Day> weekend = EnumSet.of(Day.SATURDAY, Day.SUNDAY);
EnumSet<Day> weekdays = EnumSet.complementOf(weekend);
EnumSet<Day> all = EnumSet.allOf(Day.class);

// EnumMap — array-backed map keyed by enum
EnumMap<Day, String> schedule = new EnumMap<>(Day.class);
schedule.put(Day.MONDAY, "Team standup");
schedule.put(Day.FRIDAY, "Retro");
```

---

## Enum vs Constants

| Feature | `enum` | `static final` constants |
|---|---|---|
| Type safety | Yes — compiler enforces | No — any int/String accepted |
| Methods | Can have methods and fields | No |
| Switch | Works cleanly | Works but no type safety |
| Iteration | `values()` | Must maintain manually |
| Serialization | Built-in | Manual |

```java
// BAD — no type safety
public static final int STATUS_ACTIVE = 1;
public static final int STATUS_INACTIVE = 0;
void setStatus(int status) {}  // any int accepted — bugs!

// GOOD — type-safe
public enum Status { ACTIVE, INACTIVE }
void setStatus(Status status) {}  // only valid values accepted
```

---

## Interview Questions

??? question "1. Can an enum extend a class?"
    **No.** Every enum implicitly extends `java.lang.Enum`. Java doesn't support multiple inheritance, so enums can't extend another class. But enums **can implement interfaces**.

??? question "2. Can we create an instance of an enum using `new`?"
    **No.** Enum constructors are implicitly `private`. The JVM creates the instances at class loading time. `new Day()` won't compile.

??? question "3. What happens if you use `==` to compare enums?"
    **It's correct and preferred.** Each enum constant is a singleton — there's only one instance of `Day.MONDAY` in the JVM. So `==` and `.equals()` both work, but `==` is null-safe (won't throw NPE) and faster.

??? question "4. How would you convert a String from a REST API to an enum safely?"
    ```java
    public static <T extends Enum<T>> Optional<T> safeValueOf(Class<T> enumClass, String name) {
        try {
            return Optional.of(Enum.valueOf(enumClass, name.toUpperCase()));
        } catch (IllegalArgumentException | NullPointerException e) {
            return Optional.empty();
        }
    }
    ```
    Never use `Enum.valueOf()` without handling `IllegalArgumentException` — it throws if the name doesn't match any constant.

??? question "5. Why does Joshua Bloch recommend enum Singleton over double-checked locking?"
    Enum Singleton is: thread-safe (JVM guarantees), serialization-safe (no `readResolve()` needed), reflection-safe (can't create new instances via reflection). Double-checked locking needs `volatile`, can be broken by serialization, and is more complex code for the same result.
