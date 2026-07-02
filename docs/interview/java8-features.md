---
title: "Top 35 Java 8+ Features Interview Questions & Answers (2026)"
description: "Why: Before Java 8, passing behavior required verbose anonymous inner classes. Lambdas enable functional-style programming and make APIs like Streams..."
---

# Top 35 Java 8+ Features Interview Questions & Answers

---

## Java 8 Features

??? question "Q1: What is a lambda expression and how is it written in Java?"

    **Answer:** A lambda is a concise anonymous function that provides an inline implementation of a functional interface's single abstract method.

    **Why:** Before Java 8, passing behavior required verbose anonymous inner classes. Lambdas enable functional-style programming and make APIs like Streams and CompletableFuture practical to use.

    **How:** The compiler desugars lambdas into private synthetic methods and uses `invokedynamic` (via `LambdaMetafactory`) at the call site. Unlike anonymous classes, no extra `.class` file is generated -- the JVM creates the implementation at runtime, which is faster and uses less memory.

    ```java
    // Syntax: (parameters) -> expression  OR  (parameters) -> { statements; }
    Runnable r = () -> System.out.println("Hello");
    Consumer<String> c = s -> System.out.println(s);        // single param
    BiFunction<Integer, Integer, Integer> add = (a, b) -> a + b;
    Comparator<String> comp = (s1, s2) -> {                 // multi-line
        return s1.compareTo(s2);
    };
    ```

    **When to use:** Anywhere a functional interface is expected -- event handlers, stream pipelines, comparators, thread tasks.

    **Gotchas:** Lambdas can only capture *effectively final* local variables. They do not have their own `this` (it refers to the enclosing class). Overuse in deeply nested chains hurts readability -- extract to a named method when logic exceeds 2-3 lines.

??? question "Q2: What is a functional interface and what does @FunctionalInterface do?"

    **Answer:** A functional interface is any interface with exactly one abstract method (SAM), making it a valid lambda target.

    **Why:** The SAM constraint is what allows the compiler to infer which method the lambda implements. `@FunctionalInterface` makes this contract explicit and compiler-enforced -- adding a second abstract method becomes a compile error, protecting downstream lambda users from breaking changes.

    **How:** The annotation is purely a compile-time marker (retained at runtime for documentation). The interface can still have any number of `default` and `static` methods -- only abstract methods count. Methods inherited from `Object` (like `equals`) do not count either.

    ```java
    @FunctionalInterface
    public interface Transformer<T, R> {
        R transform(T input);
        default void log() { System.out.println("transforming"); }
        static void info() { System.out.println("Transformer"); }
    }
    Transformer<String, Integer> len = s -> s.length();
    ```

    **When to use:** Always annotate interfaces you intend as lambda targets. It communicates intent and prevents accidental SAM violation during code evolution.

    **Gotchas:** The annotation is optional -- `Runnable` and `Comparator` are functional interfaces even without it. Extending a functional interface with another abstract method silently breaks it unless annotated. Generic functional interfaces can cause type inference headaches with complex lambda bodies.

??? question "Q3: Explain built-in functional interfaces: Predicate, Function, Consumer, Supplier, BiFunction."

    **Answer:** These are the five core building blocks in `java.util.function` that cover almost every lambda shape you will need.

    **Why:** Before Java 8, every callback required a custom interface. These standardized types let the entire ecosystem (Streams, CompletableFuture, Spring, etc.) share a common functional vocabulary -- reducing interface explosion and improving interoperability.

    **How (signatures):**

    | Interface | Method | Input -> Output |
    |-----------|--------|-----------------|
    | `Predicate<T>` | `test(T)` | T -> boolean |
    | `Function<T,R>` | `apply(T)` | T -> R |
    | `Consumer<T>` | `accept(T)` | T -> void |
    | `Supplier<T>` | `get()` | () -> T |
    | `BiFunction<T,U,R>` | `apply(T,U)` | (T,U) -> R |

    ```java
    Predicate<String> notEmpty = s -> !s.isEmpty();       // true for "hi"
    Function<String, Integer> length = String::length;    // 4 for "Java"
    Consumer<String> printer = System.out::println;
    Supplier<LocalDate> today = LocalDate::now;
    BiFunction<Integer, Integer, String> sum = (a, b) -> "Sum=" + (a + b);
    ```

    **When to use:** `Predicate` for filtering, `Function` for transformation, `Consumer` for side-effects, `Supplier` for lazy/deferred creation, `BiFunction` when you need two inputs.

    They support composition: `predicate.and()`, `function.andThen()`, `function.compose()`.

    **Gotchas:** For primitives, use specialized variants (`IntPredicate`, `LongFunction`) to avoid autoboxing overhead. `Consumer` swallows return values -- do not use it where you need error feedback. Chaining too many `andThen` calls creates hard-to-debug stack traces.

??? question "Q4: What are the four types of method references in Java?"

    **Answer:** Method references are shorthand for lambdas where the lambda simply delegates to an existing method.

    **Why:** They improve readability by replacing `x -> Foo.bar(x)` with `Foo::bar`, making the intent clearer and reducing boilerplate in stream pipelines.

    **How:** The compiler resolves the reference at compile time and generates the same `invokedynamic` bytecode as an equivalent lambda. The four forms:

    ```java
    // 1. Static method:          ClassName::staticMethod
    Function<String, Integer> parse = Integer::parseInt;
    // 2. Bound instance method:  instance::method
    Supplier<Integer> len = "Hello"::length;
    // 3. Unbound instance method: ClassName::instanceMethod
    Function<String, String> upper = String::toUpperCase;
    // 4. Constructor:            ClassName::new
    Supplier<List<String>> factory = ArrayList::new;
    ```

    **When to use:** Prefer method references over lambdas when the lambda body is a single method call with the same argument order. Use constructor references for factory patterns and `Supplier`-based APIs.

    **Gotchas:** Unbound vs. bound confuses people -- `String::toUpperCase` takes a `String` as the *receiver*, so it fits `Function<String,String>`, not `Supplier<String>`. Overloaded methods can cause ambiguity errors. Method references cannot express partial application or argument reordering -- fall back to a lambda in those cases.

??? question "Q5: What is the difference between intermediate and terminal stream operations?"

    **Answer:** Intermediate operations are lazy transformations that build a pipeline; terminal operations trigger execution and produce a final result or side-effect.

    **Why:** Laziness enables *loop fusion* -- the JVM combines multiple intermediate steps into a single pass over the data, avoiding intermediate collections and enabling short-circuit optimizations (`findFirst`, `limit`).

    **How:** Each intermediate call returns a new `Stream` wrapping the previous one (a linked pipeline). Nothing executes until a terminal operation is invoked, which then pulls elements through the chain one at a time (not stage by stage).

    ```java
    List<String> result = List.of("Alice", "Bob", "Anna").stream()
        .filter(n -> n.startsWith("A"))   // intermediate
        .map(String::toUpperCase)          // intermediate
        .sorted()                          // intermediate
        .collect(Collectors.toList());     // terminal -> [ALICE, ANNA]
    ```

    **Intermediate:** `filter`, `map`, `flatMap`, `distinct`, `sorted`, `peek`, `limit`, `skip`
    **Terminal:** `collect`, `forEach`, `reduce`, `count`, `min`, `max`, `anyMatch`, `findFirst`, `toArray`

    **When to use:** Chain intermediates freely for declarative data transformation. Choose short-circuiting terminals (`findFirst`, `anyMatch`) when you do not need to process everything.

    **Gotchas:** A stream can only be consumed once -- reuse throws `IllegalStateException`. `sorted()` is a *stateful* intermediate op that buffers all elements (kills memory on infinite streams). `peek()` is for debugging only -- do not rely on it for side-effects since it may not execute for short-circuited pipelines.

??? question "Q6: What is the difference between map() and flatMap() in streams?"

    **Answer:** `map()` transforms each element 1-to-1; `flatMap()` transforms each element into a stream and flattens all results into a single stream.

    **Why:** Real-world data is often nested (lists of lists, Optional inside Optional, lines to words). `flatMap` eliminates the nesting in one step rather than requiring a `map` followed by manual flattening.

    **How:** `map(f)` applies `f` to each element, producing `Stream<Stream<R>>` if `f` returns a stream. `flatMap(f)` applies `f` and then concatenates all resulting streams into one flat `Stream<R>`. Internally it processes each sub-stream before moving to the next element.

    ```java
    List.of("hello", "world").stream().map(String::length).toList(); // [5, 5]

    List<List<Integer>> nested = List.of(List.of(1,2), List.of(3,4));
    nested.stream().flatMap(Collection::stream).toList(); // [1, 2, 3, 4]
    ```

    **When to use:** Use `map` for simple transformations (object to field, string to uppercase). Use `flatMap` when each element expands into multiple results -- splitting sentences into words, joining related entities, unwrapping Optionals in a stream.

    **Gotchas:** Using `map` when you need `flatMap` gives you `Stream<Stream<T>>` or `Stream<List<T>>` -- a common beginner mistake. `flatMap` with `Optional::stream` (Java 9+) is the idiomatic way to filter empty Optionals. Each sub-stream returned by `flatMap` is consumed and closed before the next, so resource-backed streams work correctly.

??? question "Q7: How does the reduce() operation work?"

    **Answer:** `reduce()` is a terminal operation that folds all stream elements into a single cumulative result using a binary operator.

    **Why:** It provides a general-purpose aggregation mechanism -- anything you can express as "combine two values into one" can be reduced: sum, product, max, string concatenation, merging maps, etc.

    **How:** Three overloads exist. (1) `reduce(BinaryOperator)` returns `Optional` (empty stream = empty result). (2) `reduce(identity, BinaryOperator)` uses an identity seed and returns a concrete value. (3) `reduce(identity, accumulator, combiner)` supports type-changing reductions in parallel streams -- the combiner merges partial results from different threads.

    ```java
    List<Integer> nums = List.of(1, 2, 3, 4, 5);
    int sum = nums.stream().reduce(0, Integer::sum);              // 15
    Optional<Integer> product = nums.stream().reduce((a, b) -> a * b); // 120
    // Third form for parallel: reduce(identity, accumulator, combiner)
    ```

    **When to use:** Use `reduce` for custom aggregations. For common cases (`sum`, `count`, `joining`), prefer specialized collectors or `IntStream.sum()` for clarity and performance.

    **Gotchas:** The **identity** must be a true neutral element (0 for sum, 1 for product, "" for concat) -- a wrong identity gives silently incorrect results in parallel. The combiner in the 3-arg form must be associative and compatible with the accumulator. Mutable reductions (building a list) should use `collect()`, not `reduce()`, to avoid copying on every step.

??? question "Q8: Explain Collectors: toList, groupingBy, partitioningBy, joining."

    **Answer:** Collectors are terminal reduction strategies that accumulate stream elements into containers like lists, maps, or strings.

    **Why:** Raw `reduce()` is awkward for mutable accumulations (building collections). `Collector` encapsulates the supplier-accumulator-combiner-finisher pattern so the stream framework can optimize and parallelize the collection step.

    **How:** `Collectors.groupingBy` hashes elements by a classifier function into a `Map<K, List<V>>`. `partitioningBy` is a special case with exactly two groups (true/false). `joining` uses a `StringJoiner` internally for efficient concatenation with delimiter/prefix/suffix.

    ```java
    List<String> names = List.of("Alice", "Bob", "Anna", "Brian", "Amy");

    // groupingBy
    Map<Character, List<String>> byLetter = names.stream()
        .collect(Collectors.groupingBy(n -> n.charAt(0)));
    // {A=[Alice, Anna, Amy], B=[Bob, Brian]}

    // partitioningBy -- splits into true/false
    Map<Boolean, List<String>> parts = names.stream()
        .collect(Collectors.partitioningBy(n -> n.startsWith("A")));

    // joining
    String csv = names.stream().collect(Collectors.joining(", ", "[", "]"));
    // [Alice, Bob, Anna, Brian, Amy]
    ```

    **When to use:** `toList`/`toSet` for simple collection, `groupingBy` for SQL-style GROUP BY, `partitioningBy` for binary splits, `joining` for CSV/log output. Downstream collectors (`groupingBy(f, counting())`) enable multi-level aggregation.

    **Gotchas:** `toList()` (Java 16+) returns an unmodifiable list; `Collectors.toList()` returns a mutable `ArrayList`. `groupingBy` does not accept null keys -- use `toMap` with merge function instead. `toMap` throws on duplicate keys unless you provide a merge function.

??? question "Q9: When should you use parallel streams and what are the pitfalls?"

    **Answer:** Parallel streams split data across multiple threads using Fork/Join to exploit multi-core CPUs -- but they are rarely the right default.

    **Why:** Sequential streams leave CPU cores idle for compute-heavy work on large datasets. Parallel streams can dramatically cut wall-clock time when the workload is splittable and stateless.

    **How:** Calling `.parallel()` sets a flag; at terminal execution, the `Spliterator` recursively splits the data source. Work is submitted to the common `ForkJoinPool` (default threads = CPU cores - 1). Results are merged via the combiner.

    ```java
    long count = LongStream.rangeClosed(1, 10_000_000)
        .parallel().filter(n -> isPrime(n)).count();

    // Custom pool to avoid starving the common pool
    ForkJoinPool pool = new ForkJoinPool(4);
    pool.submit(() -> data.parallelStream().map(this::transform).toList()).get();
    ```

    **When to use:** Large datasets (10K+ elements), CPU-bound stateless operations, data sources with good split characteristics (arrays, `IntStream.range` -- not `LinkedList` or `Stream.iterate`).

    **Gotchas:** Shared mutable state causes data races. Small datasets are slower due to thread coordination overhead. I/O-bound tasks block pool threads, starving other work. The common ForkJoinPool is JVM-wide -- one slow parallel stream starves every other user. `LinkedList` and `Stream.iterate` split poorly, giving near-zero speedup. Order-sensitive operations (`forEachOrdered`, `limit`) serialize execution, negating parallelism.

??? question "Q10: How do you properly use Optional and what are its anti-patterns?"

    **Answer:** Optional is a container that explicitly represents "a value or nothing," forcing callers to handle absence instead of risking NullPointerException.

    **Why:** Null is ambiguous -- does it mean "not found," "not initialized," or "error"? Optional makes the absence semantically explicit in the type system and provides a fluent API to handle both cases without null checks.

    **How:** Internally, Optional is a simple wrapper holding a nullable reference. `of(val)` throws on null; `ofNullable(val)` wraps or returns `empty()`. The monadic methods (`map`, `flatMap`, `filter`) operate on the value only if present, enabling safe chaining.

    ```java
    Optional<String> opt = Optional.ofNullable(value); // safe for null
    String name = findUser(id).map(User::getName).orElse("Unknown");
    findUser(id).ifPresent(user -> sendEmail(user));
    User u = findUser(id).orElseThrow(() -> new NotFoundException(id));
    ```

    **When to use:** As a method return type to signal that absence is a valid outcome. Ideal for repository lookups, configuration values, and chain transformations.

    **Gotchas:** Never use Optional as a field, method parameter, or in collections -- it adds indirection and is not `Serializable`. Calling `get()` without `isPresent()` throws `NoSuchElementException`. Using `isPresent()`+`get()` is a code smell -- prefer `map`/`orElse`/`orElseThrow`. `orElse()` evaluates eagerly; use `orElseGet()` for expensive defaults.

??? question "Q11: What are default methods in interfaces?"

    **Answer:** Default methods are interface methods with a body, allowing interfaces to evolve without breaking existing implementations.

    **Why:** Before Java 8, adding a method to an interface broke every implementor. Default methods solved this -- the JDK team could add `stream()`, `forEach()`, and `spliterator()` to existing collection interfaces without forcing millions of classes to update.

    **How:** The `default` keyword provides a concrete implementation in the interface. At runtime, if the implementing class does not override it, the JVM dispatches to the interface's bytecode. Resolution order: class method wins over interface default; more-specific interface wins over less-specific (sub-interface over super-interface).

    ```java
    public interface Vehicle {
        void start();
        default void honk() { System.out.println("Beep!"); }
    }
    public class Car implements Vehicle {
        public void start() { System.out.println("Starting"); }
        // honk() inherited; can override if needed
    }
    ```

    **When to use:** API evolution, shared utility behavior across unrelated types, template-method patterns without abstract classes. Useful in frameworks where you want "batteries included" interfaces.

    **Gotchas:** If two interfaces provide the same default method, the implementing class **must override** it -- otherwise compilation fails. Call a specific version via `InterfaceName.super.method()`. Default methods cannot be `final` or `synchronized`. Overusing them blurs the line between interfaces and abstract classes -- prefer composition when behavior gets complex.

??? question "Q12: How do static methods in interfaces work?"

    **Answer:** Static interface methods are utility or factory methods that belong to the interface itself and are not inherited by implementing classes.

    **Why:** Before Java 8, utility methods for an interface required a separate companion class (e.g., `Collections` for `Collection`, `Paths` for `Path`). Static interface methods keep related utilities co-located with the contract they serve.

    **How:** They are invoked via `InterfaceName.staticMethod()` only -- the JVM does not include them in the implementing class's vtable. They cannot be overridden or accessed through an instance reference.

    ```java
    public interface StringUtils {
        static boolean isNullOrEmpty(String s) { return s == null || s.isEmpty(); }
    }
    StringUtils.isNullOrEmpty("");  // true
    ```

    **When to use:** Factory methods (`List.of()`, `Map.entry()`), validators, and converters that are logically coupled to the interface. Great for providing "starting point" implementations.

    **Gotchas:** Not inherited -- calling `MyImpl.staticMethod()` will not compile even if `MyImpl implements MyInterface`. Cannot be used polymorphically. If you need shared behavior that subtypes can override, use `default` methods instead. Over-stuffing static methods into interfaces recreates the "utility class" anti-pattern -- keep them focused on the interface's domain.

??? question "Q13: What does 'effectively final' mean in lambdas?"

    **Answer:** A variable is "effectively final" if it is never reassigned after initialization -- the compiler treats it as if it had the `final` keyword, and lambdas can capture it.

    **Why:** Lambdas may execute on a different thread or at a later time. If they could mutate local variables on the enclosing stack frame, you would get race conditions and dangling references (the frame is gone once the method returns). This restriction ensures thread-safety and predictability.

    **How:** The JVM copies the captured variable's value into the lambda's synthetic class at creation time. It is a snapshot, not a live reference. Since it is a copy, mutation would be invisible to the outer scope anyway -- hence the compiler forbids it entirely.

    ```java
    String prefix = "Hello";  // effectively final
    Function<String, String> greeter = name -> prefix + " " + name; // OK

    int count = 0;
    // list.forEach(item -> count++); // ERROR: count is modified
    AtomicInteger counter = new AtomicInteger(0);
    list.forEach(item -> counter.incrementAndGet()); // OK: reference is final
    ```

    **When to use:** The constraint is automatic -- just avoid reassigning variables you intend to use in lambdas. For mutable state, use `AtomicInteger`, single-element arrays, or encapsulate in an object.

    **Gotchas:** The *reference* must be final, not the *object* -- you can mutate an effectively final list's contents inside a lambda, which is legal but dangerous. Using `AtomicInteger` or arrays as workarounds can mask concurrency bugs. Enhanced for-loop variables are effectively final per iteration, but traditional `for(int i...)` loop variables are not.

??? question "Q14: What are the key classes in the Java 8 Date/Time API?"

    **Answer:** The `java.time` package (JSR-310) provides immutable, thread-safe date/time classes that replace the broken `Date`/`Calendar` API.

    **Why:** `java.util.Date` is mutable, not thread-safe, has confusing month-indexing (0-based), and mixes date, time, and timezone concerns. The new API separates these cleanly and draws on Joda-Time's proven design.

    **How:** Key classes: `LocalDate` (date without time/zone), `LocalTime` (time without date/zone), `LocalDateTime` (both, no zone), `ZonedDateTime` (full instant with zone), `Instant` (machine timestamp). All are value objects -- every operation returns a new instance.

    ```java
    LocalDate date = LocalDate.of(2026, 5, 13);
    LocalTime time = LocalTime.now();
    LocalDateTime dt = LocalDateTime.of(date, time);
    ZonedDateTime zdt = ZonedDateTime.now(ZoneId.of("America/New_York"));

    Duration d = Duration.ofHours(8);              // time-based
    Period p = Period.between(date, date.plusYears(1)); // date-based

    DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd-MMM-yyyy");
    String s = date.format(fmt);                   // "13-May-2026"
    ```

    **When to use:** `LocalDate` for birthdays/deadlines (no timezone needed). `ZonedDateTime` for scheduling across zones. `Instant` for timestamps/logging. `Duration` for machine intervals, `Period` for human calendar differences.

    **Gotchas:** `LocalDateTime` is NOT an instant on the timeline -- it has no timezone and cannot represent a unique moment. Storing `LocalDateTime` for event times across regions causes bugs. `DateTimeFormatter` is thread-safe (unlike `SimpleDateFormat`). Always use `ZoneId` (not raw offsets) to handle DST transitions correctly.

??? question "Q15: How does CompletableFuture improve over Future?"

    **Answer:** `CompletableFuture` is a composable, non-blocking future that supports chaining, error handling, and combining multiple async operations without blocking on `get()`.

    **Why:** `Future` (Java 5) only offers blocking `get()` -- no way to chain callbacks or compose results. `CompletableFuture` brings Promise-style programming to Java, enabling reactive pipelines and efficient I/O-bound concurrency.

    **How:** It implements both `Future` and `CompletionStage`. Internally it maintains a stack of dependent actions (Treiber stack). When a stage completes, it triggers dependent stages. By default, `supplyAsync`/`runAsync` use the common `ForkJoinPool`; you can pass a custom `Executor` for I/O tasks.

    ```java
    CompletableFuture<String> future = CompletableFuture
        .supplyAsync(() -> fetchData())
        .thenApply(data -> parse(data))
        .exceptionally(ex -> "Error: " + ex.getMessage());

    // Combine two independent futures
    CompletableFuture.supplyAsync(() -> fetchUser(id))
        .thenCombine(CompletableFuture.supplyAsync(() -> fetchOrders(id)),
            (user, orders) -> new Profile(user, orders));

    CompletableFuture.allOf(f1, f2, f3).join(); // wait for all
    ```

    **When to use:** Orchestrating multiple independent service calls, fan-out/fan-in patterns, async HTTP calls, timeout-based fallbacks (`completeOnTimeout` in Java 9+).

    **Gotchas:** Exceptions in `thenApply` are wrapped in `CompletionException` -- use `handle()` or `whenComplete()` for comprehensive error handling. `thenApply` vs `thenApplyAsync`: the non-async variant may execute on the completing thread, causing unexpected latency. `allOf` returns `Void` -- you still need to extract individual results. Never forget to handle exceptions; unhandled ones vanish silently.

---

## Java 9 Features

??? question "Q16: What is the Java Platform Module System (JPMS)?"

    **Answer:** JPMS (Project Jigsaw) is a module system that enforces explicit dependencies and strong encapsulation at compile time and runtime -- above what packages and JARs provide.

    **Why:** The classpath is a flat namespace with no visibility rules -- any public class is accessible to everything, and missing JARs only fail at runtime. JPMS solves JAR hell, prevents illegal access to internal APIs (`sun.misc.Unsafe`), and enables custom minimal runtimes via `jlink`.

    **How:** Each module declares a `module-info.java` at the root. `requires` lists compile/runtime dependencies. `exports` makes packages visible to other modules. `opens` allows deep reflection (needed for frameworks like Gson/Hibernate). The module system enforces these boundaries at both compile time (javac) and runtime (JVM).

    ```java
    // module-info.java
    module com.myapp.order {
        requires java.sql;
        requires transitive com.myapp.model;
        exports com.myapp.order.api;
        opens com.myapp.order.internal to com.google.gson;
    }
    ```

    **When to use:** Library authors who want to hide internals, applications targeting custom runtimes (Docker image size reduction via `jlink`), large codebases needing compile-time dependency enforcement.

    **Gotchas:** Most enterprise apps still use the unnamed module (classpath). Reflection-heavy frameworks (Spring, Hibernate) require `opens` directives or `--add-opens` flags. `requires transitive` exposes your dependency to your consumers -- use carefully. Split packages (same package in two modules) are forbidden and break migration of legacy JARs.

??? question "Q17: What is JShell?"

    **Answer:** JShell is Java's Read-Eval-Print Loop (REPL) that lets you execute Java snippets interactively without boilerplate classes or a `main` method.

    **Why:** Java was one of the few major languages without a REPL. JShell removes the friction of creating a class file just to test a one-liner, making it ideal for prototyping, learning, and quick API exploration.

    **How:** JShell wraps snippets in synthetic classes behind the scenes. It supports auto-imports of `java.util.*`, tab completion, multi-line editing, and forward references (use a method before defining it). State persists across statements within a session.

    ```bash
    $ jshell
    jshell> List.of(1,2,3).stream().map(i -> i*2).toList()
    $1 ==> [2, 4, 6]
    jshell> record Point(int x, int y) {}
    jshell> new Point(3, 4)
    $3 ==> Point[x=3, y=4]
    ```

    **When to use:** Quick API experiments, verifying regex patterns, testing date formatting, demonstrating behavior in code reviews, teaching. Not for production code.

    **Gotchas:** Checked exceptions are silently handled (no need for try-catch), which can mislead beginners about real Java error handling. Performance benchmarks in JShell are unreliable (no JIT warmup). You cannot define packages or use module declarations inside JShell.

??? question "Q18: How do collection factory methods work in Java 9?"

    **Answer:** `List.of()`, `Set.of()`, `Map.of()` are factory methods that create compact, immutable collections in a single expression.

    **Why:** Before Java 9, creating a small immutable list required `Collections.unmodifiableList(Arrays.asList(...))` -- verbose and error-prone. These factories are concise, null-hostile, and guaranteed immutable.

    **How:** The returned implementations are special-cased internal classes optimized by size (0, 1, 2, or N elements). They use less memory than `ArrayList` and have O(1) `contains()` for small sets due to field-based storage (no array/hash table for 1-2 elements).

    ```java
    List<String> list = List.of("a", "b", "c");         // immutable
    Set<Integer> set = Set.of(1, 2, 3);                  // no duplicates allowed
    Map<String, Integer> map = Map.of("one", 1, "two", 2);
    Map<String, Integer> big = Map.ofEntries(Map.entry("a", 1), Map.entry("b", 2));
    ```

    **When to use:** Constants, configuration values, test fixtures, any case where you want an unmodifiable snapshot with minimal ceremony.

    **Gotchas:** Null elements/keys/values throw `NullPointerException` immediately. `Set.of()` throws `IllegalArgumentException` on duplicate elements. `Map.of()` is limited to 10 key-value pairs -- use `Map.ofEntries()` beyond that. These are *structurally* immutable but the contained objects can still be mutable. Iteration order for `Set.of()` and `Map.of()` is deliberately randomized across JVM runs to prevent order-dependent bugs.

??? question "Q19: What stream enhancements were added in Java 9?"

    **Answer:** Java 9 added `takeWhile`, `dropWhile`, and `ofNullable` to the Stream API -- filling gaps that made ordered stream processing awkward.

    **Why:** `filter` processes all elements; there was no way to take a prefix or skip a prefix based on a condition (like SQL's window functions or Python's `itertools.takewhile`). `ofNullable` eliminates null-check boilerplate in `flatMap` chains.

    **How:** `takeWhile(predicate)` emits elements from the start until the predicate fails, then short-circuits (stops processing). `dropWhile(predicate)` skips the initial matching prefix and emits everything after. Both are intermediate operations. `ofNullable(val)` returns a single-element stream or an empty stream.

    ```java
    Stream.of(2, 4, 6, 7, 8).takeWhile(n -> n % 2 == 0).toList(); // [2, 4, 6]
    Stream.of(2, 4, 6, 7, 8).dropWhile(n -> n % 2 == 0).toList(); // [7, 8]
    Stream.ofNullable(null);  // empty stream (avoids null checks in flatMap)
    ```

    **When to use:** Processing sorted/ordered data where you want a prefix (paginated results, time-series cutoffs). `ofNullable` shines in `flatMap`: `map.entrySet().stream().flatMap(e -> Stream.ofNullable(e.getValue()))`.

    **Gotchas:** On *unordered* streams (like `HashSet.stream()`), `takeWhile`/`dropWhile` behavior is non-deterministic -- which elements form the "prefix" is undefined. They do NOT behave like `filter` -- once the predicate fails, `takeWhile` stops even if later elements would match. This surprises people coming from `filter`.

??? question "Q20: What Optional enhancements were added in Java 9?"

    **Answer:** Java 9 added `ifPresentOrElse`, `or`, and `stream` to Optional -- closing usability gaps that forced awkward if/else blocks.

    **Why:** Java 8's Optional lacked a clean way to execute an else-branch (`ifPresent` had no "or else do this"), chain fallback Optionals (without unwrapping), or integrate with Stream pipelines directly.

    **How:** `ifPresentOrElse(action, emptyAction)` is a complete if/else in one call. `or(Supplier<Optional>)` lazily provides a fallback Optional (unlike `orElse` which returns the unwrapped value). `stream()` converts Optional to a 0-or-1 element Stream, enabling `flatMap` to elegantly filter absent values.

    ```java
    opt.ifPresentOrElse(val -> use(val), () -> handleAbsent());
    opt.or(() -> fallbackOptional());             // lazy fallback Optional
    // stream() converts Optional to 0-or-1 element Stream
    ids.stream().map(this::findUser).flatMap(Optional::stream).toList();
    ```

    **When to use:** `ifPresentOrElse` for side-effect branching (logging present vs. absent). `or` for fallback chains (check cache, then DB, then default). `stream` is the idiomatic way to filter out empty Optionals from a stream without manual `isPresent` checks.

    **Gotchas:** `or()` returns `Optional<T>`, not `T` -- do not confuse it with `orElse()` or `orElseGet()`. The empty action in `ifPresentOrElse` is a `Runnable`, not a `Supplier` -- it cannot return a value. These methods do not exist in Java 8, so library code targeting Java 8 compatibility cannot use them.

??? question "Q21: What are private interface methods in Java 9?"

    **Answer:** Private interface methods allow default methods to share common logic without exposing helper code to implementors or the public API.

    **Why:** Java 8's default methods often had duplicated code because there was no way to extract shared logic without making it `default` (visible to all). Private methods solve DRY within interfaces while maintaining encapsulation.

    **How:** Declared with `private` (instance) or `private static` in the interface body. They are not inherited, not visible to implementing classes, and cannot be overridden. They compile to regular methods in the interface's bytecode.

    ```java
    public interface Logger {
        default void logInfo(String msg)  { log("INFO", msg); }
        default void logError(String msg) { log("ERROR", msg); }
        private void log(String level, String msg) {
            System.out.println("[" + level + "] " + msg);
        }
    }
    ```

    **When to use:** Whenever two or more default methods share validation logic, formatting, or computation. Also useful for `private static` helpers used by static interface methods.

    **Gotchas:** Cannot be `abstract` (obviously) or `default` (they are purely internal). They do not count toward the SAM requirement for functional interfaces. Only available in Java 9+ -- if your library targets Java 8, you are stuck with code duplication in default methods or extracting to a package-private utility class.

---

## Java 11 Features

??? question "Q22: How does var work in lambda parameters (Java 11)?"

    **Answer:** Java 11 allows `var` in lambda parameters, enabling you to attach annotations to inferred-type parameters without losing conciseness.

    **Why:** Java 10 introduced `var` for local variables but lambdas were excluded. Without `var`, you could not annotate lambda parameters unless you wrote out the full explicit types -- defeating the purpose of inference. Java 11 fills this gap.

    **How:** `var` in lambdas is purely syntactic sugar -- the compiler still infers the types from the target functional interface. It generates identical bytecode whether you use `var`, explicit types, or no types at all.

    ```java
    BiFunction<String, String, String> f = (@NotNull var a, @NotNull var b) -> a + b;
    // Must use var for ALL params or NONE -- mixing is not allowed
    // (var a, String b) -> a + b;  // DOES NOT compile
    ```

    **When to use:** When you need `@Nullable`, `@NotNull`, `@Nonnull`, or custom annotations on lambda parameters for static analysis tools, null-safety frameworks, or documentation.

    **Gotchas:** You cannot mix `var` with explicit types or implicit (no type) in the same lambda -- it is all-or-nothing. `var` does not mean "dynamic" -- it is still compile-time inference. This feature is specific to Java 11; Java 10's `var` only works for local variables, not lambda params.

??? question "Q23: What new String methods were added in Java 11?"

    **Answer:** Java 11 added `isBlank`, `strip`, `stripLeading`, `stripTrailing`, `repeat`, and `lines` -- addressing common string operations that previously required external libraries.

    **Why:** `trim()` only removes ASCII whitespace (chars <= U+0020) and misses Unicode spaces. Checking blank required `str.trim().isEmpty()`. Repeating strings needed loops or `String.join`. Splitting by lines needed regex. These methods make the standard library self-sufficient for everyday string work.

    **How:** `strip()` uses `Character.isWhitespace()` (Unicode-aware) internally. `lines()` returns a lazy `Stream<String>` splitting on `\n`, `\r`, or `\r\n`. `repeat(n)` pre-allocates the exact byte array size for efficiency.

    ```java
    "  ".isBlank();              // true (empty or whitespace-only)
    " hello ".strip();           // "hello" (Unicode-aware, unlike trim())
    " hello ".stripLeading();    // "hello "
    " hello ".stripTrailing();   // " hello"
    "ha".repeat(3);              // "hahaha"
    "a\nb\nc".lines().toList();  // ["a", "b", "c"]
    ```

    **When to use:** `isBlank` for input validation, `strip` over `trim` in any Unicode-aware application, `lines` for processing multi-line text (log parsing, CSV), `repeat` for padding or generating separators.

    **Gotchas:** `strip()` != `trim()` for Unicode whitespace (e.g., U+2003 EM SPACE). `lines()` does not include a trailing empty string if the input ends with a newline. `repeat(0)` returns an empty string, not null. These methods require Java 11+ -- Spring Boot 2.x projects on Java 8 cannot use them.

??? question "Q24: How does the Java 11 HttpClient API work?"

    **Answer:** The `java.net.http.HttpClient` is a modern, immutable HTTP client supporting HTTP/2, WebSocket, async operations, and a fluent builder API -- replacing the legacy `HttpURLConnection`.

    **Why:** `HttpURLConnection` is stateful, hard to configure, has no HTTP/2 support, and requires manual stream management. The new API is thread-safe, supports non-blocking I/O natively, and integrates cleanly with `CompletableFuture`.

    **How:** `HttpClient` is thread-safe and reusable (create once, share across requests). Requests are immutable value objects. `BodyHandlers` define how to process the response body (string, file, stream, etc.). Async calls return `CompletableFuture` backed by an internal selector-based event loop.

    ```java
    HttpClient client = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_2)
        .connectTimeout(Duration.ofSeconds(10)).build();

    HttpRequest req = HttpRequest.newBuilder()
        .uri(URI.create("https://api.example.com/users"))
        .header("Accept", "application/json").GET().build();

    HttpResponse<String> resp = client.send(req, BodyHandlers.ofString());

    // Async
    client.sendAsync(req, BodyHandlers.ofString())
        .thenApply(HttpResponse::body).thenAccept(System.out::println);
    ```

    **When to use:** REST API calls, microservice communication, webhook integrations -- anywhere you previously used Apache HttpClient or OkHttp for basic HTTP. Pairs well with virtual threads (Java 21) for massive concurrency.

    **Gotchas:** No built-in retry or circuit-breaker (use Resilience4j). No JSON deserialization built in -- you still need Jackson/Gson. The client follows redirects only if configured (`.followRedirects(NORMAL)`). Connection pooling is internal and not configurable. For complex use cases (multipart, interceptors), libraries like OkHttp still have an edge.

??? question "Q25: What Files utility methods were added in Java 11?"

    **Answer:** Java 11 added `Files.readString()` and `Files.writeString()` for one-liner file I/O -- reading or writing an entire file as a single String.

    **Why:** Before Java 11, reading a file to a String required `new String(Files.readAllBytes(path))` or buffered reader loops. These convenience methods eliminate boilerplate for the most common file operation pattern.

    **How:** `readString` reads all bytes and decodes with the specified charset (default UTF-8). `writeString` encodes and writes atomically with configurable `OpenOption`s. Both handle resource cleanup internally.

    ```java
    Path path = Path.of("data.txt");
    Files.writeString(path, "Hello, Java 11!");
    String content = Files.readString(path);  // "Hello, Java 11!"
    ```

    **When to use:** Configuration files, templates, test fixtures, small data files -- any file that fits comfortably in memory as a single String.

    **Gotchas:** These load the entire file into memory -- do NOT use for large files (use `BufferedReader` or `lines()` instead). Default charset is UTF-8, not the platform default -- this is intentional but different from older APIs. `writeString` overwrites by default; use `StandardOpenOption.APPEND` for append behavior. No built-in atomic write -- for crash-safe writes, write to a temp file and rename.

---

## Java 14-17 Features

??? question "Q26: How do switch expressions work (Java 14)?"

    **Answer:** Switch expressions (finalized in Java 14) return a value, use arrow syntax to eliminate fall-through, and enforce exhaustiveness at compile time.

    **Why:** Traditional switch statements are verbose, error-prone (forgotten `break` = fall-through bugs), and cannot be used as expressions. The new form is concise, safe, and enables functional-style assignments.

    **How:** Arrow syntax (`->`) replaces colon-based cases and eliminates fall-through entirely. Multiple labels can share a case. Block bodies use `yield` to return a value. The compiler enforces that all possible values are covered (exhaustiveness) -- for enums, no `default` is needed if all constants are handled.

    ```java
    String type = switch (day) {
        case MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY -> "Weekday";
        case SATURDAY, SUNDAY -> "Weekend";
    };
    int val = switch (code) {
        case 200 -> 1;
        case 404 -> {
            log("not found");
            yield -1;   // yield returns from a block
        }
        default -> 0;
    };
    ```

    **When to use:** Any place you would assign a variable based on discrete cases: mapping enums to values, request routing, state machines. Combines powerfully with sealed classes (Java 17) and pattern matching (Java 21).

    **Gotchas:** You can still use the old colon syntax with `yield` if needed, but mixing arrow and colon in one switch is illegal. `yield` is a context-sensitive keyword -- it is only special inside switch expressions (existing methods named `yield` still work). Exhaustiveness errors can surprise when new enum constants are added -- this is a feature, not a bug.

??? question "Q27: What are text blocks (Java 15)?"

    **Answer:** Text blocks are multi-line string literals delimited by `"""` that automatically strip incidental indentation and preserve formatting.

    **Why:** Embedding JSON, SQL, HTML, or XML in Java required ugly concatenation with `\n` and escape sequences. Text blocks make embedded structured text readable and maintainable directly in source code.

    **How:** The compiler applies a two-step process: (1) normalizes line endings to `\n`, (2) strips common leading whitespace (determined by the leftmost non-whitespace character or the closing `"""`). Escape sequences still work. New escape `\` at end of line joins lines (no newline), and `\s` preserves trailing spaces.

    ```java
    String json = """
            {
              "name": "Vamsi",
              "age": 28
            }
            """;
    String html = """
            <h1>Hello, %s!</h1>
            """.formatted("World");
    ```

    **When to use:** SQL queries, JSON templates, HTML fragments, regular expressions, any multi-line string that benefits from preserving visual structure.

    **Gotchas:** Indentation is stripped based on the position of the closing `"""` -- moving it changes the output. A trailing newline is always included unless you end content on the same line as closing quotes. `\` and `\s` escapes are Java 14+ -- not universally known. Text blocks are still `String` objects at runtime; there is no performance difference from concatenated literals (both are interned).

??? question "Q28: What are Records (Java 16)?"

    **Answer:** Records are transparent, immutable data carriers that auto-generate the canonical constructor, accessors, `equals()`, `hashCode()`, and `toString()` from the component declaration.

    **Why:** Java DTOs and value objects required massive boilerplate (getters, constructors, equals/hashCode, toString). Records reduce a 50-line POJO to one line while guaranteeing immutability and correct value semantics.

    **How:** The compiler generates `private final` fields for each component, a canonical constructor, accessor methods named after the components (not `getX()`), and structural `equals`/`hashCode` (all fields compared). The compact constructor syntax lets you validate/normalize without restating assignments.

    ```java
    public record Point(int x, int y) { }
    Point p = new Point(3, 4);
    p.x();          // 3 (not getX)
    p.toString();   // "Point[x=3, y=4]"

    public record Email(String value) {
        public Email {  // compact constructor for validation
            if (!value.contains("@")) throw new IllegalArgumentException();
            value = value.toLowerCase();
        }
    }
    ```

    **When to use:** DTOs, API responses, event payloads, map keys (correct equals/hashCode), multi-return values, pattern matching targets. Combine with sealed interfaces for algebraic data types.

    **Gotchas:** Records cannot extend classes (implicitly extend `Record`), cannot have mutable instance fields, and cannot declare additional instance fields beyond components. They can implement interfaces and have static members. Jackson/JPA support requires specific versions. If a component is a mutable object (e.g., `List`), the record is only shallowly immutable -- defensively copy in the compact constructor.

??? question "Q29: How does pattern matching for instanceof work (Java 16)?"

    **Answer:** Pattern matching for `instanceof` combines the type check and cast into one step by introducing a binding variable scoped to where the pattern matches.

    **Why:** The classic `instanceof` + explicit cast is redundant and error-prone (you can cast to the wrong type and the compiler cannot help). This pattern eliminates that repetition and makes the code more readable.

    **How:** When the pattern matches, the compiler introduces a new variable (pattern variable) that is already cast to the target type. The variable's scope is determined by *flow analysis* -- it is only in scope where the compiler can prove the match succeeded.

    ```java
    // Before                          // After
    if (obj instanceof String) {       if (obj instanceof String s) {
        String s = (String) obj;           System.out.println(s.toUpperCase());
        System.out.println(             }
            s.toUpperCase());
    }
    // Works with conditions and negation
    if (obj instanceof String s && s.length() > 5) { /* ... */ }
    ```

    **When to use:** Replacing type-check-then-cast idioms in equals methods, visitor patterns, polymorphic dispatch, and deserialization logic. Foundation for pattern matching in switch (Java 21).

    **Gotchas:** The variable is only in scope where the match is guaranteed -- `if (!(obj instanceof String s)) return; /* s in scope here */` works due to flow scoping, which surprises people. You cannot use `||` with pattern variables on the left (`obj instanceof String s || s.isEmpty()` is invalid -- `s` is not in scope if the left side is false). Pattern variables cannot shadow local variables in the same scope.

??? question "Q30: What are sealed classes (Java 17)?"

    **Answer:** Sealed classes/interfaces restrict their permitted subtypes to a closed set, enabling the compiler to verify exhaustive pattern matching.

    **Why:** Open inheritance hierarchies make it impossible for the compiler to know all subtypes -- you always need a `default` branch. Sealed types close the hierarchy, turning runtime "unknown subtype" errors into compile-time errors and enabling algebraic data type modeling in Java.

    **How:** The `sealed` modifier + `permits` clause declares the allowed subtypes. Each permitted subtype must be `final` (no further extension), `sealed` (restricts further), or `non-sealed` (reopens). All permitted subtypes must be in the same package (or module).

    ```java
    public sealed interface Shape permits Circle, Rectangle {}
    public record Circle(double r) implements Shape {}
    public record Rectangle(double w, double h) implements Shape {}

    // Compiler knows all subtypes -- no default needed
    double area = switch (shape) {
        case Circle c    -> Math.PI * c.r() * c.r();
        case Rectangle r -> r.w() * r.h();
    };
    ```

    **When to use:** Domain modeling where the set of variants is known and fixed (AST nodes, protocol messages, state machines, Result/Either types). Combines powerfully with records and pattern matching for switch.

    **Gotchas:** Subclasses must be `final`, `sealed`, or `non-sealed`. Adding a new permitted subtype intentionally breaks all non-exhaustive switch expressions -- this is the point, but teams must coordinate. Reflection can still instantiate subtypes unless you also use modules. `non-sealed` reopens the hierarchy, which can be misused to defeat the purpose.

---

## Java 21 Features

??? question "Q31: What are virtual threads in Java 21?"

    **Answer:** Virtual threads (Project Loom) are ultra-lightweight, JVM-managed threads that allow millions of concurrent tasks with the familiar thread-per-request model -- no reactive frameworks needed.

    **Why:** Platform threads map 1:1 to OS threads (~1MB stack each), capping concurrency at thousands. I/O-heavy services (web servers, microservices) waste most threads waiting on network/DB. Virtual threads decouple concurrency from OS thread limits, making blocking code scalable without rewriting to reactive.

    **How:** Virtual threads are scheduled by the JVM on a small pool of *carrier* platform threads (Fork/Join pool). When a virtual thread blocks on I/O, it is *unmounted* from its carrier (stack is saved to heap), freeing the carrier for other virtual threads. When I/O completes, it is remounted and resumes.

    ```java
    Thread.startVirtualThread(() -> System.out.println("Virtual!"));

    try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, 100_000)
            .forEach(i -> exec.submit(() -> fetchUrl(urls.get(i))));
    }
    ```

    | | Platform Threads | Virtual Threads |
    |-|-----------------|-----------------|
    | Memory | ~1 MB stack | ~few KB |
    | Scale | Thousands | Millions |
    | Best for | CPU-bound | I/O-bound |

    **When to use:** I/O-bound services handling many concurrent requests (HTTP servers, DB-heavy APIs, fan-out calls). Spring Boot 3.2+ and Tomcat support virtual threads out of the box.

    **Gotchas:** Do NOT pool virtual threads -- create a new one per task (they are cheap). `synchronized` blocks *pin* the virtual thread to its carrier (cannot unmount) -- use `ReentrantLock` instead. CPU-bound work gains nothing (still limited by carrier count). ThreadLocal works but creates per-virtual-thread copies -- prefer scoped values. Debuggers/profilers may show millions of threads -- tooling support is still maturing.

??? question "Q32: How does pattern matching for switch work (Java 21)?"

    **Answer:** Pattern matching for switch (finalized in Java 21) enables type-based branching, guarded conditions with `when`, and null handling directly in switch expressions.

    **Why:** Before this, dispatching on object type required chains of `if-else instanceof` blocks -- verbose, unoptimizable, and impossible for the compiler to verify as exhaustive. Pattern matching switch is concise, exhaustive (with sealed types), and optimizable by the JVM.

    **How:** The switch evaluates the selector against each case pattern top-to-bottom. Type patterns (`case String s`) combine instanceof + binding. Guard clauses (`when expr`) add boolean refinement. Null is explicitly matchable (historically switch threw NPE on null). Dominance ordering is enforced -- a broader pattern cannot precede a narrower one.

    ```java
    String describe(Object obj) {
        return switch (obj) {
            case Integer i when i > 0 -> "Positive: " + i;
            case Integer i            -> "Non-positive: " + i;
            case String s             -> "String: " + s;
            case null                 -> "null";
            default                   -> obj.getClass().getName();
        };
    }
    ```

    **When to use:** Replacing `instanceof` chains, visitor patterns, JSON/event deserialization dispatch, command handling. Combines with sealed interfaces for compile-time exhaustiveness without `default`.

    **Gotchas:** Specific guarded cases must come **before** general cases (dominance ordering) -- the compiler rejects violations. `case null` only matches at the top level; null inside a nested pattern is not handled. Without sealed types you still need `default`. Performance is good -- the JVM can optimize dispatch via type-check tables.

??? question "Q33: What are record patterns (Java 21)?"

    **Answer:** Record patterns deconstruct record instances directly in `instanceof` and `switch`, extracting components into binding variables in one step.

    **Why:** Without deconstruction, accessing record components after a pattern match still requires explicit accessor calls (`point.x()`, `point.y()`). Record patterns eliminate this boilerplate and enable deep/nested matching -- critical for working with tree-structured data.

    **How:** The pattern `Point(int x, int y)` invokes the record's accessor methods and binds the results to `x` and `y`. Patterns can be nested arbitrarily deep -- the compiler generates the necessary null checks and type checks at each level. Works in both `instanceof` and `switch`.

    ```java
    record Point(int x, int y) {}
    record Line(Point start, Point end) {}

    if (obj instanceof Point(int x, int y)) {
        System.out.println(x + ", " + y);
    }
    // Nested deconstruction
    if (obj instanceof Line(Point(var x1, var y1), Point(var x2, var y2))) {
        double len = Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
    }
    ```

    **When to use:** Processing ASTs, expression trees, geometric shapes, protocol messages, event hierarchies -- any domain modeled with nested records and sealed interfaces.

    **Gotchas:** Only works with records (not arbitrary classes) because records guarantee the accessor-to-component mapping. Null components inside a nested record pattern cause a match failure (not NPE). You can use `var` for inferred types in component positions but cannot use `_` (unnamed patterns) until Java 22+. Order of components must match the record's declaration order.

??? question "Q34: What are sequenced collections (Java 21)?"

    **Answer:** Sequenced collections are new interfaces (`SequencedCollection`, `SequencedSet`, `SequencedMap`) that provide uniform access to first/last elements and reversed views across all ordered collection types.

    **Why:** Before Java 21, getting the first or last element varied wildly: `list.get(0)` vs `deque.getFirst()` vs `sortedSet.first()` vs `linkedHashMap` having no direct API at all. There was no common abstraction for "ordered collection with defined encounter order."

    **How:** These interfaces sit between `Collection` and existing types in the hierarchy. `getFirst()`/`getLast()` provide uniform access. `addFirst()`/`addLast()` provide uniform insertion. `reversed()` returns a lightweight reversed *view* (not a copy) that itself is a `SequencedCollection`.

    ```java
    SequencedCollection<String> list = new ArrayList<>(List.of("a","b","c"));
    list.getFirst();     // "a"
    list.getLast();      // "c"
    list.addFirst("z");
    list.reversed();     // reversed view: [c, b, a]

    SequencedMap<String, Integer> map = new LinkedHashMap<>();
    map.put("one", 1); map.put("two", 2);
    map.firstEntry();    // one=1
    map.lastEntry();     // two=2
    ```

    **When to use:** Writing generic algorithms that need first/last access without knowing the concrete collection type. `reversed()` is great for iterating backward without index arithmetic.

    **Gotchas:** `List`, `Deque` implement `SequencedCollection`. `SortedSet`, `LinkedHashSet` implement `SequencedSet`. Calling `addFirst`/`addLast` on immutable collections (like `List.of()`) throws `UnsupportedOperationException`. `HashSet` and `HashMap` do NOT implement these interfaces (no defined order). The `reversed()` view reflects mutations to the original -- it is not a snapshot.

??? question "Q35: What happened to the Nashorn JavaScript engine?"

    **Answer:** Nashorn, Java's built-in JavaScript engine, was deprecated in Java 11 and removed in Java 15 because it could not keep pace with the rapidly evolving ECMAScript specification.

    **Why:** Nashorn only supported ES 5.1. Modern JavaScript (ES6+ with modules, async/await, classes) evolved too fast for the JDK team to maintain a compliant implementation as part of the platform. Maintaining it delayed JDK releases without delivering modern JS capabilities.

    **How:** Nashorn compiled JavaScript to JVM bytecode at runtime via the `javax.script` API. It was tightly coupled to JDK internals (`jdk.nashorn.*` packages), making it hard to evolve independently.

    ```java
    // Old (Java 8-14): ScriptEngine engine = new ScriptEngineManager()
    //     .getEngineByName("nashorn");
    // Replacement: GraalJS from GraalVM (supports modern ES, standalone library)
    ```

    **When to use (replacements):** **GraalJS** is the recommended drop-in replacement (supports ES2023+, standalone Maven dependency). For heavy JS workloads, use Node.js via `ProcessBuilder` or HTTP. For rule engines, consider pure-Java alternatives (MVEL, SpEL).

    **Gotchas:** GraalJS has different performance characteristics and requires `org.graalvm.js` dependency. Code relying on Nashorn-specific extensions (`Java.type()`, `__noSuchProperty__`) may need migration. The `javax.script.ScriptEngine` API still works with GraalJS, easing migration. If you are on Java 15+ with old Nashorn code, it simply will not compile -- no graceful degradation.
