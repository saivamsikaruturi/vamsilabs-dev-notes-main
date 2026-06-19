---
title: "Java 8 Features Interview Questions — Top 40 with Answers"
description: "Top Java 8 features interview questions with answers. Covers lambda expressions, Stream API, Optional, functional interfaces, default methods, CompletableFuture, and the new Date/Time API — asked at FAANG and top Java shops."
---

# Java 8 Features Interview Questions

Java 8 is still the **most-tested Java version in interviews** — its functional programming features, Stream API, and Optional fundamentally changed how Java is written. This page covers the 40 most frequently asked Java 8 questions with concise, interview-ready answers asked at Amazon, Google, Salesforce, and top Java shops.

**What interviewers test:** Not just "what is a lambda" but whether you understand *how* streams work internally, when Optional is misused, and the difference between `map()` and `flatMap()` — the questions that separate senior candidates from juniors.

---

## Lambda Expressions

**1. What is a lambda expression in Java 8?**

A lambda is an **anonymous function** — a concise way to implement a functional interface without creating an anonymous class.

```java
// Before Java 8
Runnable r = new Runnable() {
    public void run() { System.out.println("Hello"); }
};

// Java 8 lambda
Runnable r = () -> System.out.println("Hello");
```

Syntax: `(parameters) -> expression` or `(parameters) -> { statements; }`

**2. What is a functional interface?**

An interface with **exactly one abstract method** — lambdas implement functional interfaces. Annotate with `@FunctionalInterface` (optional but recommended — compiler enforces the one-abstract-method rule).

```java
@FunctionalInterface
interface Transformer<T, R> { R transform(T input); }
```

**3. What are the key built-in functional interfaces in Java 8?**

| Interface | Signature | Use for |
|---|---|---|
| `Predicate<T>` | `boolean test(T t)` | Filtering — `stream.filter()` |
| `Function<T,R>` | `R apply(T t)` | Mapping — `stream.map()` |
| `Consumer<T>` | `void accept(T t)` | Side effects — `stream.forEach()` |
| `Supplier<T>` | `T get()` | Lazy values — `Optional.orElseGet()` |
| `BiFunction<T,U,R>` | `R apply(T t, U u)` | Two-argument mapping |
| `UnaryOperator<T>` | `T apply(T t)` | Same-type transformation |
| `BinaryOperator<T>` | `T apply(T t1, T t2)` | Reduction — `stream.reduce()` |

**4. What is a method reference?**

Shorthand for a lambda that calls an existing method:

```java
// Static method reference
Function<String, Integer> parse = Integer::parseInt;

// Instance method reference (on a specific instance)
String prefix = "Hello";
Predicate<String> startsWith = prefix::startsWith;

// Instance method reference (on arbitrary instance)
Function<String, String> upper = String::toUpperCase;

// Constructor reference
Supplier<List<String>> listFactory = ArrayList::new;
```

**5. What is a closure in Java lambdas? What are the capture rules?**

Lambdas can capture variables from the enclosing scope, but they must be **effectively final** (not reassigned after initialization — even if not declared `final`). This prevents concurrency issues since lambdas may run on different threads.

```java
String greeting = "Hello"; // effectively final
Supplier<String> s = () -> greeting + " World"; // OK

greeting = "Hi"; // compile error — breaks effective finality
```

---

## Stream API

**6. What is the Stream API?**

A sequence of elements supporting sequential and parallel aggregate operations. Streams are **lazy** (intermediate operations don't execute until a terminal operation is called), **single-use** (can't reuse a consumed stream), and **non-mutating** (don't modify the source).

```java
List<String> result = names.stream()
    .filter(n -> n.startsWith("A"))   // intermediate — lazy
    .map(String::toUpperCase)          // intermediate — lazy
    .sorted()                          // intermediate — lazy
    .collect(Collectors.toList());     // terminal — triggers execution
```

**7. What is the difference between intermediate and terminal operations?**

- **Intermediate:** lazy, return a `Stream`, can be chained — `filter()`, `map()`, `flatMap()`, `sorted()`, `distinct()`, `limit()`, `skip()`, `peek()`
- **Terminal:** eager, trigger pipeline execution, return a non-Stream result — `collect()`, `forEach()`, `count()`, `reduce()`, `findFirst()`, `anyMatch()`, `toList()` (Java 16+)

**8. What is the difference between `map()` and `flatMap()`?**

`map()` transforms each element 1-to-1. `flatMap()` transforms each element into a stream and flattens all those streams into one.

```java
// map — List<List<String>> → List<List<String>>
List<List<String>> nested = List.of(List.of("a","b"), List.of("c"));
nested.stream().map(List::stream); // Stream<Stream<String>>

// flatMap — List<List<String>> → List<String>  ← what you want
nested.stream().flatMap(List::stream)
      .collect(Collectors.toList()); // ["a", "b", "c"]
```

**9. What is `reduce()` and how does it work?**

Combines stream elements into a single result using a `BinaryOperator`:

```java
// Sum with identity
int sum = numbers.stream().reduce(0, Integer::sum);

// Without identity — returns Optional (stream may be empty)
Optional<Integer> max = numbers.stream().reduce(Integer::max);
```

**10. What is `collect()` and what are common Collectors?**

Terminal operation that molds stream elements into a container:

```java
// To collections
.collect(Collectors.toList())
.collect(Collectors.toSet())
.collect(Collectors.toUnmodifiableList())  // Java 10+

// Joining strings
.collect(Collectors.joining(", ", "[", "]"))

// Grouping
Map<Dept, List<Employee>> byDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment));

// Counting per group
Map<Dept, Long> countByDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment, Collectors.counting()));

// Partitioning (split into true/false)
Map<Boolean, List<Integer>> evenOdd = numbers.stream()
    .collect(Collectors.partitioningBy(n -> n % 2 == 0));
```

**11. What is a parallel stream? When should you use it?**

`parallelStream()` splits the stream into chunks processed on `ForkJoinPool.commonPool()` threads. Useful for CPU-intensive operations on large collections (100K+ elements). **Avoid for:** I/O operations, small collections (overhead > gain), operations with shared mutable state, or when order matters (use `forEachOrdered()` if needed).

```java
// Good candidate — CPU-heavy, large data, no shared state
long count = bigList.parallelStream()
    .filter(this::expensiveCheck)
    .count();
```

**12. What is `Collectors.toMap()` and what's a common pitfall?**

```java
Map<Integer, String> idToName = employees.stream()
    .collect(Collectors.toMap(Employee::getId, Employee::getName));
```

Pitfall: **duplicate keys throw `IllegalStateException`**. Fix with a merge function:
```java
.collect(Collectors.toMap(Employee::getDept, Employee::getName,
    (existing, replacement) -> existing)); // keep first
```

→ Deep dive: [Stream API](../stream-api/streamapi.md) · [Collectors & Parallel Streams](../java/CollectorsAndParallelStreams.md)

---

## Optional

**13. What is `Optional` and why was it introduced?**

`Optional<T>` is a container that may or may not hold a value — an explicit alternative to returning `null`. Forces callers to handle the absent case, reducing `NullPointerException`.

**14. What is the difference between `orElse()` and `orElseGet()`?**

```java
// orElse — ALWAYS evaluates the argument (even if Optional has value)
String name = optional.orElse(expensiveDefault()); // expensiveDefault() always called

// orElseGet — lazy — only evaluates supplier if Optional is empty
String name = optional.orElseGet(() -> expensiveDefault()); // only called if empty
```

**Always prefer `orElseGet()`** when the default involves computation or object creation.

**15. What is the correct use of Optional? What are anti-patterns?**

✅ **Correct uses:**
- Return type of methods that may not find a result (`repository.findById()`)
- Chain transformations on nullable results without null checks

❌ **Anti-patterns:**
- Optional as a field type (serialization issues, memory overhead)
- Optional as a method parameter (`if (opt.isPresent())` defeats the purpose — just use `@Nullable`)
- `optional.get()` without `isPresent()` — throws `NoSuchElementException`
- Using `Optional.of(null)` — throws `NullPointerException`; use `Optional.ofNullable()`

```java
// Good — chained transformation
Optional.ofNullable(user)
    .map(User::getAddress)
    .map(Address::getCity)
    .orElse("Unknown");

// Bad — back to null-check style
if (optional.isPresent()) { optional.get().doSomething(); }
// Better:
optional.ifPresent(value -> value.doSomething());
```

---

## Default & Static Interface Methods

**16. What are default methods in interfaces?**

Java 8 allows interfaces to have method implementations with the `default` keyword — adds behavior to existing interfaces without breaking implementors (backward compatibility). Used heavily in the Collections API (`List.sort()`, `Collection.removeIf()`, `Iterable.forEach()`).

```java
interface Greeter {
    String name();
    default String greet() { return "Hello, " + name(); } // has implementation
}
```

**17. What happens when a class implements two interfaces with the same default method?**

Compile error — the class must override the conflicting method to resolve ambiguity:
```java
class MyClass implements A, B {
    public void conflictingMethod() { A.super.conflictingMethod(); } // explicitly choose
}
```

**18. What are static methods in interfaces?**

Java 8 interfaces can have `static` utility methods — like `Comparator.comparing()`, `Predicate.not()`. Not inherited by implementing classes — called via the interface name directly.

---

## Date & Time API

**19. What problems did the old `java.util.Date` have?**

- Mutable — not thread-safe
- `Date` represents both a date AND a time — confusing
- Month indexing is 0-based (`Calendar.JANUARY == 0`)
- No timezone support in `Date`
- Poor API design — `getYear()` returns `year - 1900`

**20. What are the key classes in the new Date/Time API (`java.time`)?**

| Class | Represents |
|---|---|
| `LocalDate` | Date without time (`2025-01-15`) |
| `LocalTime` | Time without date (`14:30:00`) |
| `LocalDateTime` | Date + time, no timezone |
| `ZonedDateTime` | Date + time + timezone |
| `Instant` | Point in time (epoch seconds) — for timestamps |
| `Duration` | Time-based amount (`PT5H30M`) |
| `Period` | Date-based amount (`P1Y2M3D`) |

All are **immutable and thread-safe**. Use `Instant` for storing timestamps in databases.

→ Deep dive: [Date & Time API](../java/DateTime.md)

---

## CompletableFuture

**21. What is `CompletableFuture` and how does it improve on `Future`?**

`Future` blocks on `get()` — no callbacks, no composition. `CompletableFuture` enables non-blocking async pipelines:

```java
CompletableFuture.supplyAsync(() -> fetchUser(userId))
    .thenApply(user -> enrichWithOrders(user))
    .thenApply(user -> toDTO(user))
    .exceptionally(ex -> defaultUser())
    .thenAccept(dto -> sendResponse(dto));
```

**22. What is the difference between `thenApply()` and `thenCompose()`?**

`thenApply()` — transform result synchronously (like `map()`). Returns `CompletableFuture<R>`.
`thenCompose()` — chain another async operation (like `flatMap()`). Use when the transformation itself returns a `CompletableFuture` — avoids `CompletableFuture<CompletableFuture<R>>`.

```java
// thenApply — if transform is sync
.thenApply(user -> user.getName()) // returns CF<String>

// thenCompose — if transform is async
.thenCompose(userId -> fetchUserAsync(userId)) // flattens CF<CF<User>> → CF<User>
```

→ Deep dive: [CompletableFuture](../java/CompletableFuture.md)

---

## Miscellaneous Java 8 Features

**23. What are `forEach()` and `removeIf()` on Collections?**

```java
list.forEach(System.out::println);          // iterates
list.removeIf(s -> s.startsWith("x"));     // removes matching elements safely
map.forEach((k, v) -> System.out.println(k + "=" + v));
```

**24. What is `Comparator.comparing()`?**

Builder for multi-key sorting:
```java
employees.sort(
    Comparator.comparing(Employee::getDepartment)
              .thenComparing(Employee::getSalary, Comparator.reverseOrder())
              .thenComparing(Employee::getName)
);
```

**25. What is `String.join()` and `StringJoiner`?**

```java
String.join(", ", "a", "b", "c");  // "a, b, c"
String.join("-", list);             // joins all list elements

StringJoiner sj = new StringJoiner(", ", "[", "]");
sj.add("a"); sj.add("b"); // "[a, b]"
// Collectors.joining() uses StringJoiner internally
```

---

## Quick-Fire Questions

**26. What is the difference between `findFirst()` and `findAny()`?**
`findFirst()` returns the first element of the stream (deterministic). `findAny()` returns any element — faster in parallel streams (no need to coordinate first-element tracking).

**27. What does `peek()` do?**
Intermediate operation for debugging — applies a Consumer without modifying the stream: `.peek(e -> System.out.println("Processing: " + e))`. Doesn't trigger execution alone — needs a terminal operation.

**28. What is `Predicate.and()`, `or()`, `negate()`?**
Compose predicates: `isAdult.and(hasLicense)`, `isStudent.or(isSenior)`, `isActive.negate()`.

**29. What is `mapToInt()` and why use it?**
`mapToInt()` returns an `IntStream` (primitive stream) — avoids boxing overhead of `map()` returning `Stream<Integer>`. Has `sum()`, `average()`, `min()`, `max()` built-in.

**30. What is `distinct()` and how does it work?**
Removes duplicates using `equals()` and `hashCode()`. Stateful operation — maintains a `HashSet` internally. Expensive on parallel streams.

**31. What is `limit()` vs `skip()`?**
`limit(n)` — take at most n elements. `skip(n)` — skip first n elements. Together: pagination — `stream.skip(page * size).limit(size)`.

**32. Can you reuse a Stream?**
No — after a terminal operation, the stream is consumed. Create a new stream from the source for each pipeline.

**33. What is `Collectors.groupingBy()` vs `partitioningBy()`?**
`groupingBy()` groups by any key (returns `Map<K, List<T>>`). `partitioningBy()` is a special case — boolean predicate produces `Map<Boolean, List<T>>` (true/false groups).

**34. What is `Optional.flatMap()`?**
Like `map()` but the mapping function itself returns `Optional` — prevents `Optional<Optional<T>>`:
```java
Optional<String> city = Optional.of(user)
    .flatMap(u -> Optional.ofNullable(u.getAddress()))
    .flatMap(a -> Optional.ofNullable(a.getCity()));
```

**35. What is `Stream.iterate()` vs `Stream.generate()`?**
`iterate(seed, f)` — infinite stream where each element is `f(previous)`: `Stream.iterate(0, n -> n + 2)` produces even numbers. `generate(supplier)` — infinite stream from a supplier: `Stream.generate(Math::random)`.

**36. What is the `@FunctionalInterface` annotation?**
Optional marker annotation — compiler enforces that the interface has exactly one abstract method. Prevents accidental addition of a second abstract method that would break lambda compatibility.

**37. What is a `BiPredicate`?**
`Predicate` taking two arguments: `BiPredicate<String, Integer> hasLength = (s, n) -> s.length() == n;`

**38. What changed in `HashMap` in Java 8?**
When a bucket's linked list exceeds 8 entries and the table has ≥64 buckets, it converts to a Red-Black tree — O(n) → O(log n) worst-case lookup.

**39. What is `Nashorn` in Java 8?**
JavaScript engine built into the JVM — `ScriptEngine engine = new NashornScriptEngineFactory().getScriptEngine()`. Deprecated in Java 11, removed in Java 15.

**40. Name five other Java 8 additions beyond lambda and streams.**
`Optional`, new Date/Time API (`java.time`), `CompletableFuture`, `StringJoiner`, default/static interface methods, `Base64` encoding/decoding, `Arrays.parallelSort()`, `Nashorn`, `@Repeatable` annotations, `PermGen` removed (Metaspace).

---

## Go Deeper

- [Functional Programming in Java](../java/FunctionalProgramming.md)
- [Stream API Deep Dive](../stream-api/streamapi.md)
- [Collectors & Parallel Streams](../java/CollectorsAndParallelStreams.md)
- [Optional Deep Dive](../java/OptionalDeepDive.md)
- [CompletableFuture](../java/CompletableFuture.md)
- [Date & Time API](../java/DateTime.md)
- [Java 8 Overview](../java/Java8.md)
