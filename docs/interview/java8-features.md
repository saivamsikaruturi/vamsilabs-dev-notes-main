# Top 35 Java 8+ Features Interview Questions & Answers

---

## Java 8 Features

??? question "Q1: What is a lambda expression and how is it written in Java?"

    **Answer:** A lambda is an anonymous function representing a functional interface implementation.

    ```java
    // Syntax: (parameters) -> expression  OR  (parameters) -> { statements; }
    Runnable r = () -> System.out.println("Hello");
    Consumer<String> c = s -> System.out.println(s);        // single param
    BiFunction<Integer, Integer, Integer> add = (a, b) -> a + b;
    Comparator<String> comp = (s1, s2) -> {                 // multi-line
        return s1.compareTo(s2);
    };
    ```

    Lambdas work only where a **functional interface** (single abstract method) is expected and capture effectively final variables from the enclosing scope.

??? question "Q2: What is a functional interface and what does @FunctionalInterface do?"

    **Answer:** A functional interface has exactly **one abstract method** (SAM). It may have default/static methods. `@FunctionalInterface` is optional but triggers a compile error if the contract is violated.

    ```java
    @FunctionalInterface
    public interface Transformer<T, R> {
        R transform(T input);
        default void log() { System.out.println("transforming"); }
        static void info() { System.out.println("Transformer"); }
    }
    Transformer<String, Integer> len = s -> s.length();
    ```

??? question "Q3: Explain built-in functional interfaces: Predicate, Function, Consumer, Supplier, BiFunction."

    **Answer:**

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

    They support composition: `predicate.and()`, `function.andThen()`, `function.compose()`.

??? question "Q4: What are the four types of method references in Java?"

    **Answer:**

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

??? question "Q5: What is the difference between intermediate and terminal stream operations?"

    **Answer:** **Intermediate** operations are lazy and return a new Stream. **Terminal** operations trigger execution and produce a result.

    ```java
    List<String> result = List.of("Alice", "Bob", "Anna").stream()
        .filter(n -> n.startsWith("A"))   // intermediate
        .map(String::toUpperCase)          // intermediate
        .sorted()                          // intermediate
        .collect(Collectors.toList());     // terminal -> [ALICE, ANNA]
    ```

    **Intermediate:** `filter`, `map`, `flatMap`, `distinct`, `sorted`, `peek`, `limit`, `skip`
    **Terminal:** `collect`, `forEach`, `reduce`, `count`, `min`, `max`, `anyMatch`, `findFirst`, `toArray`

??? question "Q6: What is the difference between map() and flatMap() in streams?"

    **Answer:** `map()` is 1-to-1 (each element produces one result). `flatMap()` is 1-to-many and flattens nested structures.

    ```java
    List.of("hello", "world").stream().map(String::length).toList(); // [5, 5]

    List<List<Integer>> nested = List.of(List.of(1,2), List.of(3,4));
    nested.stream().flatMap(Collection::stream).toList(); // [1, 2, 3, 4]
    ```

??? question "Q7: How does the reduce() operation work?"

    **Answer:** `reduce()` combines all elements into a single result using a binary operator.

    ```java
    List<Integer> nums = List.of(1, 2, 3, 4, 5);
    int sum = nums.stream().reduce(0, Integer::sum);              // 15
    Optional<Integer> product = nums.stream().reduce((a, b) -> a * b); // 120
    // Third form for parallel: reduce(identity, accumulator, combiner)
    ```

    The **identity** must be a neutral element (0 for sum, 1 for product, "" for concat).

??? question "Q8: Explain Collectors: toList, groupingBy, partitioningBy, joining."

    **Answer:**

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

??? question "Q9: When should you use parallel streams and what are the pitfalls?"

    **Answer:** Use for **large datasets** with **CPU-intensive**, **stateless** operations. They use the common `ForkJoinPool`.

    ```java
    long count = LongStream.rangeClosed(1, 10_000_000)
        .parallel().filter(n -> isPrime(n)).count();

    // Custom pool to avoid starving the common pool
    ForkJoinPool pool = new ForkJoinPool(4);
    pool.submit(() -> data.parallelStream().map(this::transform).toList()).get();
    ```

    **Pitfalls:** shared mutable state causes races; small datasets are slower due to overhead; I/O-bound tasks block pool threads; the common ForkJoinPool is JVM-wide -- one slow stream starves others.

??? question "Q10: How do you properly use Optional and what are its anti-patterns?"

    **Answer:**

    ```java
    Optional<String> opt = Optional.ofNullable(value); // safe for null
    String name = findUser(id).map(User::getName).orElse("Unknown");
    findUser(id).ifPresent(user -> sendEmail(user));
    User u = findUser(id).orElseThrow(() -> new NotFoundException(id));
    ```

    **Anti-patterns:** using Optional as method parameter or field; calling `get()` without checking; using `isPresent()`+`get()` instead of `orElse`/`map`. Optional should be **return types only**.

??? question "Q11: What are default methods in interfaces?"

    **Answer:** Default methods provide implementations in interfaces using the `default` keyword, enabling backward-compatible API evolution (e.g., adding `forEach` to `Iterable`).

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

    If two interfaces provide the same default method, the implementing class **must override** it. Call a specific version via `InterfaceName.super.method()`.

??? question "Q12: How do static methods in interfaces work?"

    **Answer:** Interfaces can have `static` methods since Java 8. They are called on the interface, **not inherited** by implementing classes. Useful for factory and utility methods.

    ```java
    public interface StringUtils {
        static boolean isNullOrEmpty(String s) { return s == null || s.isEmpty(); }
    }
    StringUtils.isNullOrEmpty("");  // true
    ```

??? question "Q13: What does 'effectively final' mean in lambdas?"

    **Answer:** A variable is effectively final if never modified after initialization. Lambdas can only capture local variables that are final or effectively final.

    ```java
    String prefix = "Hello";  // effectively final
    Function<String, String> greeter = name -> prefix + " " + name; // OK

    int count = 0;
    // list.forEach(item -> count++); // ERROR: count is modified
    AtomicInteger counter = new AtomicInteger(0);
    list.forEach(item -> counter.incrementAndGet()); // OK: reference is final
    ```

??? question "Q14: What are the key classes in the Java 8 Date/Time API?"

    **Answer:** The `java.time` package provides immutable, thread-safe replacements for `Date`/`Calendar`.

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

??? question "Q15: How does CompletableFuture improve over Future?"

    **Answer:** `CompletableFuture` supports non-blocking chaining, error handling, and combining results without calling blocking `get()`.

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

---

## Java 9 Features

??? question "Q16: What is the Java Platform Module System (JPMS)?"

    **Answer:** JPMS provides strong encapsulation and explicit dependencies at the module level.

    ```java
    // module-info.java
    module com.myapp.order {
        requires java.sql;
        requires transitive com.myapp.model;
        exports com.myapp.order.api;
        opens com.myapp.order.internal to com.google.gson;
    }
    ```

    Benefits: eliminates JAR hell, enables smaller runtimes via `jlink`, hides internal APIs like `sun.misc.Unsafe`.

??? question "Q17: What is JShell?"

    **Answer:** JShell is Java's REPL introduced in Java 9 for interactive snippet execution without classes or `main`.

    ```bash
    $ jshell
    jshell> List.of(1,2,3).stream().map(i -> i*2).toList()
    $1 ==> [2, 4, 6]
    jshell> record Point(int x, int y) {}
    jshell> new Point(3, 4)
    $3 ==> Point[x=3, y=4]
    ```

??? question "Q18: How do collection factory methods work in Java 9?"

    **Answer:** `List.of()`, `Set.of()`, `Map.of()` create **immutable** collections that reject nulls and modifications.

    ```java
    List<String> list = List.of("a", "b", "c");         // immutable
    Set<Integer> set = Set.of(1, 2, 3);                  // no duplicates allowed
    Map<String, Integer> map = Map.of("one", 1, "two", 2);
    Map<String, Integer> big = Map.ofEntries(Map.entry("a", 1), Map.entry("b", 2));
    ```

??? question "Q19: What stream enhancements were added in Java 9?"

    **Answer:** `takeWhile`, `dropWhile`, and `ofNullable`.

    ```java
    Stream.of(2, 4, 6, 7, 8).takeWhile(n -> n % 2 == 0).toList(); // [2, 4, 6]
    Stream.of(2, 4, 6, 7, 8).dropWhile(n -> n % 2 == 0).toList(); // [7, 8]
    Stream.ofNullable(null);  // empty stream (avoids null checks in flatMap)
    ```

??? question "Q20: What Optional enhancements were added in Java 9?"

    **Answer:** `ifPresentOrElse`, `or`, and `stream`.

    ```java
    opt.ifPresentOrElse(val -> use(val), () -> handleAbsent());
    opt.or(() -> fallbackOptional());             // lazy fallback Optional
    // stream() converts Optional to 0-or-1 element Stream
    ids.stream().map(this::findUser).flatMap(Optional::stream).toList();
    ```

??? question "Q21: What are private interface methods in Java 9?"

    **Answer:** Private methods in interfaces share code between default methods without exposing it.

    ```java
    public interface Logger {
        default void logInfo(String msg)  { log("INFO", msg); }
        default void logError(String msg) { log("ERROR", msg); }
        private void log(String level, String msg) {
            System.out.println("[" + level + "] " + msg);
        }
    }
    ```

---

## Java 11 Features

??? question "Q22: How does var work in lambda parameters (Java 11)?"

    **Answer:** `var` in lambdas enables adding **annotations** to parameters while keeping type inference.

    ```java
    BiFunction<String, String, String> f = (@NotNull var a, @NotNull var b) -> a + b;
    // Must use var for ALL params or NONE -- mixing is not allowed
    // (var a, String b) -> a + b;  // DOES NOT compile
    ```

??? question "Q23: What new String methods were added in Java 11?"

    **Answer:**

    ```java
    "  ".isBlank();              // true (empty or whitespace-only)
    " hello ".strip();           // "hello" (Unicode-aware, unlike trim())
    " hello ".stripLeading();    // "hello "
    " hello ".stripTrailing();   // " hello"
    "ha".repeat(3);              // "hahaha"
    "a\nb\nc".lines().toList();  // ["a", "b", "c"]
    ```

??? question "Q24: How does the Java 11 HttpClient API work?"

    **Answer:** `java.net.http.HttpClient` replaces `HttpURLConnection` with HTTP/2, async support, and a builder API.

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

??? question "Q25: What Files utility methods were added in Java 11?"

    **Answer:** `Files.readString()` and `Files.writeString()` for single-call file I/O.

    ```java
    Path path = Path.of("data.txt");
    Files.writeString(path, "Hello, Java 11!");
    String content = Files.readString(path);  // "Hello, Java 11!"
    ```

---

## Java 14-17 Features

??? question "Q26: How do switch expressions work (Java 14)?"

    **Answer:** Switch expressions return a value, use arrow syntax (no fall-through), and must be exhaustive.

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

??? question "Q27: What are text blocks (Java 15)?"

    **Answer:** Triple-quoted `"""` strings for multi-line literals with automatic indentation stripping.

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

    Indentation is stripped based on the position of the closing `"""`.

??? question "Q28: What are Records (Java 16)?"

    **Answer:** Records are immutable data carriers that auto-generate constructor, accessors, `equals()`, `hashCode()`, and `toString()`.

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

    Records can implement interfaces and have static members, but cannot extend classes or have mutable fields.

??? question "Q29: How does pattern matching for instanceof work (Java 16)?"

    **Answer:** Eliminates the redundant cast by introducing a pattern variable.

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

??? question "Q30: What are sealed classes (Java 17)?"

    **Answer:** Sealed classes restrict which classes can extend them, enabling exhaustive pattern matching.

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

    Subclasses must be `final`, `sealed`, or `non-sealed`.

---

## Java 21 Features

??? question "Q31: What are virtual threads in Java 21?"

    **Answer:** Virtual threads (Project Loom) are JVM-managed lightweight threads allowing millions of concurrent tasks.

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

    Do not pool virtual threads. Use `ReentrantLock` over `synchronized` to allow unmounting.

??? question "Q32: How does pattern matching for switch work (Java 21)?"

    **Answer:** Matches type patterns, guarded patterns (`when`), and null in switch expressions.

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

    Specific guarded cases must come **before** general cases (dominance ordering).

??? question "Q33: What are record patterns (Java 21)?"

    **Answer:** Record patterns deconstruct records directly in `instanceof` and `switch`.

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

??? question "Q34: What are sequenced collections (Java 21)?"

    **Answer:** `SequencedCollection`, `SequencedSet`, and `SequencedMap` provide uniform first/last access and reversed views.

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

    `List`, `Deque` implement `SequencedCollection`. `SortedSet`, `LinkedHashSet` implement `SequencedSet`.

??? question "Q35: What happened to the Nashorn JavaScript engine?"

    **Answer:** Nashorn was **deprecated in Java 11** and **removed in Java 15**. It could not keep pace with the rapidly evolving ECMAScript specification (stuck at ES 5.1).

    ```java
    // Old (Java 8-14): ScriptEngine engine = new ScriptEngineManager()
    //     .getEngineByName("nashorn");
    // Replacement: GraalJS from GraalVM (supports modern ES, standalone library)
    ```

    Alternatives: **GraalJS** (drop-in replacement), Node.js via `ProcessBuilder`, or native Java solutions.
