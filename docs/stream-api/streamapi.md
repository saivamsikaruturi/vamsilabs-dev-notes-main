# Stream API — Functional Data Processing

The Stream API (introduced in Java 8) provides a **declarative, functional approach** to processing collections of data. Instead of writing imperative loops, you describe *what* you want — filter, transform, aggregate — and the framework handles the *how*. Streams are the most frequently asked Java topic at FAANG interviews because they test functional thinking, API fluency, and understanding of lazy evaluation.

---

## Streams vs Collections

| Aspect | Collection | Stream |
|--------|-----------|--------|
| **Purpose** | Store and manage data | Process and compute results |
| **Storage** | Holds elements in memory | No storage — computes on-the-fly |
| **Consumption** | Can iterate multiple times | **Single-use** — consumed after terminal operation |
| **Evaluation** | Eager — all elements exist | **Lazy** — operations execute only when terminal op is called |
| **Modification** | Can add/remove elements | Cannot modify the source |
| **Size** | Finite | Can be **infinite** (`Stream.generate()`) |

```java
List<String> names = List.of("Alice", "Bob", "Charlie");

// Collection approach — imperative
List<String> result = new ArrayList<>();
for (String name : names) {
    if (name.length() > 3) {
        result.add(name.toUpperCase());
    }
}

// Stream approach — declarative
List<String> result = names.stream()
    .filter(name -> name.length() > 3)
    .map(String::toUpperCase)
    .toList();  // [ALICE, CHARLIE]
```

---

## Stream Pipeline Architecture

Every stream operation follows the pattern: **Source → Intermediate Operations → Terminal Operation**.

```mermaid
graph LR
    A[Source<br/>Collection, Array, Generator] --> B[filter]
    B --> C[map]
    C --> D[sorted]
    D --> E[Terminal Op<br/>collect, reduce, forEach]
    
    style A fill:#4CAF50,color:white
    style B fill:#2196F3,color:white
    style C fill:#2196F3,color:white
    style D fill:#2196F3,color:white
    style E fill:#FF5722,color:white
```

**Key rules:**

1. A pipeline can have **zero or more** intermediate operations
2. A pipeline must have **exactly one** terminal operation
3. Nothing executes until the terminal operation is invoked (lazy evaluation)
4. A stream **cannot be reused** after a terminal operation

---

## Creating Streams

```java
// From a Collection
List<String> list = List.of("a", "b", "c");
Stream<String> s1 = list.stream();

// From an Array
String[] array = {"a", "b", "c"};
Stream<String> s2 = Arrays.stream(array);

// From specific values
Stream<String> s3 = Stream.of("a", "b", "c");

// Empty stream
Stream<String> s4 = Stream.empty();

// Infinite stream with supplier
Stream<Double> randoms = Stream.generate(Math::random);  // infinite!

// Infinite stream with iteration (seed + unary operator)
Stream<Integer> evens = Stream.iterate(0, n -> n + 2);  // 0, 2, 4, 6, ...

// Bounded iterate (Java 9+)
Stream<Integer> bounded = Stream.iterate(0, n -> n < 100, n -> n + 2);

// Primitive streams — avoid boxing overhead
IntStream ints = IntStream.range(1, 10);        // 1 to 9
IntStream inclusive = IntStream.rangeClosed(1, 10);  // 1 to 10
LongStream longs = LongStream.of(1L, 2L, 3L);
DoubleStream doubles = DoubleStream.of(1.0, 2.0);

// From a String's characters
IntStream chars = "hello".chars();

// From file lines
Stream<String> lines = Files.lines(Path.of("data.txt"));
```

---

## Intermediate Operations

Intermediate operations are **lazy** — they return a new stream and do not process elements until a terminal operation triggers the pipeline.

### filter — Select elements matching a predicate

```java
List<Integer> evens = List.of(1, 2, 3, 4, 5, 6).stream()
    .filter(n -> n % 2 == 0)
    .toList();  // [2, 4, 6]
```

### map — Transform each element

```java
List<Integer> lengths = List.of("Java", "Go", "Python").stream()
    .map(String::length)
    .toList();  // [4, 2, 6]
```

### flatMap — Flatten nested structures

```java
List<List<Integer>> nested = List.of(
    List.of(1, 2, 3),
    List.of(4, 5),
    List.of(6, 7, 8, 9)
);

List<Integer> flat = nested.stream()
    .flatMap(Collection::stream)  // Stream<List<Integer>> → Stream<Integer>
    .toList();  // [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

### distinct — Remove duplicates (uses equals/hashCode)

```java
List<Integer> unique = List.of(1, 2, 2, 3, 3, 3).stream()
    .distinct()
    .toList();  // [1, 2, 3]
```

### sorted — Natural or custom order

```java
// Natural order
List<String> sorted = List.of("banana", "apple", "cherry").stream()
    .sorted()
    .toList();  // [apple, banana, cherry]

// Custom comparator
List<String> byLength = List.of("banana", "apple", "cherry").stream()
    .sorted(Comparator.comparingInt(String::length))
    .toList();  // [apple, banana, cherry]

// Reverse order
List<Integer> desc = List.of(3, 1, 4, 1, 5).stream()
    .sorted(Comparator.reverseOrder())
    .toList();  // [5, 4, 3, 1, 1]
```

### peek — Debug without modifying the stream

```java
List<String> result = List.of("one", "two", "three").stream()
    .filter(s -> s.length() > 3)
    .peek(s -> System.out.println("Filtered: " + s))  // side effect for debugging
    .map(String::toUpperCase)
    .toList();
```

### limit and skip — Subsetting

```java
// First 3 elements
List<Integer> first3 = List.of(10, 20, 30, 40, 50).stream()
    .limit(3)
    .toList();  // [10, 20, 30]

// Skip first 2 elements
List<Integer> afterSkip = List.of(10, 20, 30, 40, 50).stream()
    .skip(2)
    .toList();  // [30, 40, 50]

// Pagination: page 3, size 10
List<Item> page3 = items.stream()
    .skip(20)
    .limit(10)
    .toList();
```

### mapToInt / mapToDouble / mapToLong — Primitive specializations

```java
int totalLength = List.of("Java", "Stream", "API").stream()
    .mapToInt(String::length)
    .sum();  // 13

OptionalDouble average = List.of(10, 20, 30).stream()
    .mapToDouble(Integer::doubleValue)
    .average();  // OptionalDouble[20.0]
```

---

## Terminal Operations

Terminal operations **trigger pipeline execution** and produce a result or side effect.

### forEach — Perform action on each element

```java
List.of("Alice", "Bob", "Charlie").stream()
    .forEach(name -> System.out.println("Hello, " + name));
```

### collect — Accumulate into a container

```java
List<String> list = stream.collect(Collectors.toList());
Set<String> set = stream.collect(Collectors.toSet());
```

### reduce — Combine all elements into one

```java
int sum = List.of(1, 2, 3, 4, 5).stream()
    .reduce(0, Integer::sum);  // 15

Optional<Integer> max = List.of(1, 2, 3, 4, 5).stream()
    .reduce(Integer::max);  // Optional[5]
```

### count — Number of elements

```java
long count = List.of("a", "b", "c", "d").stream()
    .filter(s -> s.compareTo("b") > 0)
    .count();  // 2 ("c" and "d")
```

### min / max — Smallest or largest element

```java
Optional<Integer> min = List.of(5, 3, 8, 1, 9).stream()
    .min(Comparator.naturalOrder());  // Optional[1]

Optional<String> longest = List.of("cat", "elephant", "dog").stream()
    .max(Comparator.comparingInt(String::length));  // Optional[elephant]
```

### findFirst / findAny — Short-circuit retrieval

```java
Optional<String> first = List.of("alpha", "beta", "gamma").stream()
    .filter(s -> s.startsWith("b"))
    .findFirst();  // Optional[beta]

// findAny — non-deterministic, faster in parallel streams
Optional<String> any = list.parallelStream()
    .filter(s -> s.length() > 4)
    .findAny();
```

### anyMatch / allMatch / noneMatch — Boolean tests

```java
List<Integer> numbers = List.of(2, 4, 6, 8, 10);

boolean hasOdd = numbers.stream().anyMatch(n -> n % 2 != 0);    // false
boolean allEven = numbers.stream().allMatch(n -> n % 2 == 0);   // true
boolean noneNeg = numbers.stream().noneMatch(n -> n < 0);       // true
```

### toArray — Convert to array

```java
String[] array = List.of("a", "b", "c").stream()
    .toArray(String[]::new);
```

---

## Collectors Deep Dive

The `Collectors` utility class provides powerful reduction operations.

### Basic collectors

```java
// toList, toSet, toUnmodifiableList
List<String> list = stream.collect(Collectors.toList());
List<String> immutable = stream.collect(Collectors.toUnmodifiableList());

// toMap — key mapper, value mapper
Map<String, Integer> nameLengths = List.of("Java", "Go", "Rust").stream()
    .collect(Collectors.toMap(
        Function.identity(),    // key = the string itself
        String::length          // value = its length
    ));  // {Java=4, Go=2, Rust=4}

// toMap with merge function (handle duplicate keys)
Map<Integer, String> byLength = List.of("hi", "go", "hey").stream()
    .collect(Collectors.toMap(
        String::length,
        Function.identity(),
        (existing, replacement) -> existing + ", " + replacement
    ));  // {2=hi, go, 3=hey}
```

### groupingBy — Group elements by a classifier

```java
record Employee(String name, String department, int salary) {}

List<Employee> employees = List.of(
    new Employee("Alice", "Engineering", 120000),
    new Employee("Bob", "Engineering", 110000),
    new Employee("Charlie", "Marketing", 95000),
    new Employee("Diana", "Marketing", 105000)
);

// Simple grouping
Map<String, List<Employee>> byDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::department));

// Group and count
Map<String, Long> countByDept = employees.stream()
    .collect(Collectors.groupingBy(Employee::department, Collectors.counting()));
// {Engineering=2, Marketing=2}

// Group and sum salaries
Map<String, Integer> salaryByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::department,
        Collectors.summingInt(Employee::salary)
    ));
// {Engineering=230000, Marketing=200000}

// Group and find max salary employee per department
Map<String, Optional<Employee>> topEarners = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::department,
        Collectors.maxBy(Comparator.comparingInt(Employee::salary))
    ));
```

### partitioningBy — Split into two groups (true/false)

```java
Map<Boolean, List<Integer>> partition = List.of(1, 2, 3, 4, 5, 6).stream()
    .collect(Collectors.partitioningBy(n -> n % 2 == 0));
// {false=[1, 3, 5], true=[2, 4, 6]}
```

### joining — Concatenate strings

```java
String csv = List.of("Alice", "Bob", "Charlie").stream()
    .collect(Collectors.joining(", ", "[", "]"));
// [Alice, Bob, Charlie]
```

### summarizingInt — Full statistics

```java
IntSummaryStatistics stats = employees.stream()
    .collect(Collectors.summarizingInt(Employee::salary));

stats.getCount();    // 4
stats.getSum();      // 430000
stats.getMin();      // 95000
stats.getMax();      // 120000
stats.getAverage();  // 107500.0
```

### collectingAndThen — Post-process the collector result

```java
// Collect to list then make unmodifiable
List<String> immutable = stream.collect(
    Collectors.collectingAndThen(
        Collectors.toList(),
        Collections::unmodifiableList
    )
);

// Group and then extract from Optional
Map<String, Employee> topByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::department,
        Collectors.collectingAndThen(
            Collectors.maxBy(Comparator.comparingInt(Employee::salary)),
            Optional::orElseThrow
        )
    ));
```

---

## flatMap Explained

`flatMap` solves the problem of **streams within streams**. When `map` produces a `Stream<Stream<T>>`, `flatMap` flattens it to `Stream<T>`.

```mermaid
flowchart LR
    A{{"Stream of Lists<br/>[[1,2], [3,4], [5]]"}} -->|map(List::stream)| B[/"Stream of Streams<br/>[Stream(1,2), Stream(3,4), Stream(5)]"/]
    A -->|flatMap(List::stream)| C(["Flat Stream<br/>[1, 2, 3, 4, 5]"])
    
    style A fill:#9C27B0,color:white
    style B fill:#F44336,color:white
    style C fill:#4CAF50,color:white
```

### Real-world use cases

```java
// Extract all words from sentences
List<String> sentences = List.of("Hello World", "Stream API", "Java Rocks");
List<String> words = sentences.stream()
    .flatMap(sentence -> Arrays.stream(sentence.split(" ")))
    .toList();  // [Hello, World, Stream, API, Java, Rocks]

// Get all orders from all customers
List<Order> allOrders = customers.stream()
    .flatMap(customer -> customer.getOrders().stream())
    .toList();

// Optional flatMap — chain optional operations
Optional<String> city = getUser(id)
    .flatMap(User::getAddress)
    .flatMap(Address::getCity);
```

---

## reduce() Operation

`reduce()` combines all stream elements into a single value using an associative accumulation function.

### Three forms

```java
// 1. With identity — always returns a value
int sum = List.of(1, 2, 3, 4, 5).stream()
    .reduce(0, (a, b) -> a + b);  // 15

// 2. Without identity — returns Optional (stream might be empty)
Optional<Integer> sum = List.of(1, 2, 3, 4, 5).stream()
    .reduce((a, b) -> a + b);  // Optional[15]

// 3. With identity, accumulator, and combiner (for parallel streams)
int sum = List.of(1, 2, 3, 4, 5).parallelStream()
    .reduce(
        0,                   // identity
        Integer::sum,        // accumulator
        Integer::sum         // combiner (merges partial results)
    );
```

### Custom reduce examples

```java
// Find longest string
Optional<String> longest = List.of("Java", "Go", "TypeScript", "Rust").stream()
    .reduce((a, b) -> a.length() >= b.length() ? a : b);
// Optional[TypeScript]

// Concatenate strings
String joined = List.of("a", "b", "c").stream()
    .reduce("", (a, b) -> a + b);  // "abc"

// Reduce with different types (identity + accumulator + combiner)
int totalLength = List.of("Java", "Stream", "API").stream()
    .reduce(
        0,                          // identity (int)
        (len, str) -> len + str.length(),  // accumulator: int + String → int
        Integer::sum                // combiner: int + int → int
    );  // 13
```

---

## Parallel Streams

Parallel streams use the **ForkJoinPool** to split work across multiple threads.

```java
// Create a parallel stream
long count = list.parallelStream()
    .filter(item -> expensiveCheck(item))
    .count();

// Convert existing stream to parallel
long count = list.stream()
    .parallel()
    .filter(item -> expensiveCheck(item))
    .count();
```

### When to use parallel streams

| Use When | Avoid When |
|----------|-----------|
| Large datasets (10,000+ elements) | Small collections (overhead > benefit) |
| CPU-intensive operations per element | I/O-bound operations (use async instead) |
| Independent, stateless operations | Operations with shared mutable state |
| ArrayList, arrays (good splittability) | LinkedList, Stream.iterate (poor splitting) |
| No ordering requirement | Order matters (`forEachOrdered` kills parallelism) |

### Thread safety concerns

```java
// WRONG — shared mutable state, race condition!
List<Integer> results = new ArrayList<>();
list.parallelStream()
    .filter(n -> n > 5)
    .forEach(results::add);  // ConcurrentModificationException or data loss

// CORRECT — use collect (thread-safe accumulation)
List<Integer> results = list.parallelStream()
    .filter(n -> n > 5)
    .collect(Collectors.toList());

// CORRECT — use thread-safe collection if forEach is needed
List<Integer> results = Collections.synchronizedList(new ArrayList<>());
list.parallelStream()
    .filter(n -> n > 5)
    .forEach(results::add);
```

### Custom ForkJoinPool (control thread count)

```java
// Default parallelStream uses ForkJoinPool.commonPool() (shared JVM-wide)
// For isolation, submit to a custom pool:
ForkJoinPool customPool = new ForkJoinPool(4);
List<String> result = customPool.submit(() ->
    list.parallelStream()
        .filter(s -> s.length() > 3)
        .collect(Collectors.toList())
).get();
customPool.shutdown();
```

---

## Common Interview Coding Patterns

### Find duplicates in a list

```java
List<Integer> numbers = List.of(1, 2, 4, 5, 2, 6, 1, 3, 4);

List<Integer> duplicates = numbers.stream()
    .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
    .entrySet().stream()
    .filter(e -> e.getValue() > 1)
    .map(Map.Entry::getKey)
    .toList();  // [1, 2, 4]

// Alternative using Set
Set<Integer> seen = new HashSet<>();
List<Integer> duplicates = numbers.stream()
    .filter(n -> !seen.add(n))
    .toList();  // [2, 1, 4]
```

### First non-repeated character in a string

```java
public static Character firstNonRepeated(String input) {
    return input.chars()
        .mapToObj(c -> (char) c)
        .collect(Collectors.groupingBy(
            Function.identity(),
            LinkedHashMap::new,   // preserve insertion order
            Collectors.counting()
        ))
        .entrySet().stream()
        .filter(e -> e.getValue() == 1)
        .map(Map.Entry::getKey)
        .findFirst()
        .orElse(null);
}
// firstNonRepeated("aabbcde") → 'c'
```

### Group by and count

```java
Map<String, Long> wordFrequency = List.of(
    "java", "stream", "java", "api", "stream", "java"
).stream()
    .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
// {java=3, stream=2, api=1}
```

### Second highest salary

```java
record Employee(String name, String dept, int salary) {}

Optional<Integer> secondHighest = employees.stream()
    .map(Employee::salary)
    .distinct()
    .sorted(Comparator.reverseOrder())
    .skip(1)
    .findFirst();

// Nth highest (generalized)
public static Optional<Integer> nthHighestSalary(List<Employee> employees, int n) {
    return employees.stream()
        .map(Employee::salary)
        .distinct()
        .sorted(Comparator.reverseOrder())
        .skip(n - 1)
        .findFirst();
}
```

### Flatten nested lists

```java
List<List<String>> departments = List.of(
    List.of("Alice", "Bob"),
    List.of("Charlie", "Diana"),
    List.of("Eve")
);

List<String> allEmployees = departments.stream()
    .flatMap(Collection::stream)
    .toList();  // [Alice, Bob, Charlie, Diana, Eve]
```

### Partition into two groups

```java
Map<Boolean, List<Integer>> partition = List.of(1, 2, 3, 4, 5, 6, 7, 8).stream()
    .collect(Collectors.partitioningBy(n -> n % 2 == 0));
// true  → [2, 4, 6, 8]
// false → [1, 3, 5, 7]

// Partition employees by salary threshold
Map<Boolean, List<Employee>> bySalary = employees.stream()
    .collect(Collectors.partitioningBy(e -> e.salary() > 100000));
```

### Custom collector — comma-separated string with prefix/suffix

```java
String result = List.of("Java", "Python", "Go").stream()
    .collect(Collector.of(
        StringBuilder::new,                          // supplier
        (sb, s) -> {                                 // accumulator
            if (!sb.isEmpty()) sb.append(", ");
            sb.append(s);
        },
        (sb1, sb2) -> {                              // combiner (parallel)
            if (!sb1.isEmpty()) sb1.append(", ");
            return sb1.append(sb2);
        },
        sb -> "Languages: [" + sb + "]"              // finisher
    ));
// "Languages: [Java, Python, Go]"
```

### Highest salary per department

```java
Map<String, Employee> topEarners = employees.stream()
    .collect(Collectors.toMap(
        Employee::dept,
        Function.identity(),
        (e1, e2) -> e1.salary() >= e2.salary() ? e1 : e2
    ));

// Alternative with groupingBy + collectingAndThen
Map<String, Employee> topEarners = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::dept,
        Collectors.collectingAndThen(
            Collectors.maxBy(Comparator.comparingInt(Employee::salary)),
            Optional::orElseThrow
        )
    ));
```

---

## Stream vs Collection vs Iterator

| Feature | Iterator | Collection | Stream |
|---------|----------|-----------|--------|
| **Traversal** | One element at a time, pull-based | Random access or iteration | Internal iteration, push-based |
| **Reusability** | Single-use | Reusable | **Single-use** |
| **Lazy** | Yes (pulls on demand) | No (eager storage) | **Yes** (lazy pipeline) |
| **Parallelism** | No | No (unless ConcurrentCollection) | Built-in `.parallel()` |
| **Infinite** | Possible | No | **Yes** (`generate`, `iterate`) |
| **Mutation** | `remove()` supported | Add/remove supported | **No mutation** |
| **Short-circuit** | Manual (`break`) | Manual | Built-in (`findFirst`, `anyMatch`) |

---

## Performance Considerations

### When streams are slower

1. **Small collections** — Stream setup overhead (object creation, lambda indirection) outweighs benefit for < 100 elements
2. **Simple operations** — A basic `for` loop with `list.get(i)` avoids stream infrastructure
3. **Autoboxing** — `Stream<Integer>` boxes/unboxes; use `IntStream` for primitives
4. **LinkedList with parallel** — Poor splittability kills parallel performance
5. **Stateful operations in parallel** — `sorted()`, `distinct()` require buffering, reducing parallelism

### When streams are faster or better

1. **Readability** — Complex multi-step transformations are clearer as pipelines
2. **Parallel processing** — Large datasets with CPU-intensive ops get free parallelism
3. **Short-circuiting** — `findFirst()`, `anyMatch()` avoid processing entire collection
4. **Composition** — Easy to add/remove pipeline stages without restructuring loops

### Tips

```java
// BAD — boxing overhead
int sum = list.stream()
    .map(obj -> obj.getValue())       // Stream<Integer> — boxed
    .reduce(0, Integer::sum);

// GOOD — primitive stream, no boxing
int sum = list.stream()
    .mapToInt(Obj::getValue)          // IntStream — primitive
    .sum();

// BAD — concatenating in reduce (creates new String each time, O(n^2))
String result = list.stream().reduce("", (a, b) -> a + b);

// GOOD — use joining collector (uses StringBuilder internally)
String result = list.stream().collect(Collectors.joining());
```

---

## Interview Questions

??? question "1. What is the difference between intermediate and terminal operations?"
    **Intermediate operations** (filter, map, sorted) are lazy — they return a new Stream and do nothing until a terminal operation is invoked. They can be chained. **Terminal operations** (collect, reduce, forEach) trigger pipeline execution, consume the stream, and produce a result or side effect. A stream can only have one terminal operation.

??? question "2. Explain lazy evaluation in streams. Why does it matter?"
    Lazy evaluation means intermediate operations are not executed when declared — they form a pipeline recipe. Execution happens only when a terminal operation is called. This matters because: (1) short-circuit operations like `findFirst()` can stop early without processing the entire collection, (2) multiple operations are fused into a single pass over the data, (3) infinite streams become possible since you only compute what's needed.

??? question "3. What is the difference between map() and flatMap()?"
    `map()` transforms each element one-to-one: `Stream<T>` → `Stream<R>`. `flatMap()` transforms each element into a stream and then flattens all resulting streams into one: `Stream<T>` → `Stream<R>` (where the mapping function returns `Stream<R>`). Use `flatMap` when each element maps to multiple output elements (e.g., extracting words from sentences, getting all orders from multiple customers).

??? question "4. Can you reuse a stream? What happens if you try?"
    No. A stream can only be consumed once. After a terminal operation is invoked, the stream is considered consumed. Attempting to invoke another terminal operation on the same stream throws `IllegalStateException: stream has already been operated upon or closed`. You must create a new stream from the source.

??? question "5. Explain reduce() with identity, accumulator, and combiner. When is the combiner used?"
    The three-argument `reduce(identity, accumulator, combiner)` is needed when the result type differs from the stream element type. The **identity** is the initial value, the **accumulator** combines a partial result with an element, and the **combiner** merges two partial results. The combiner is only used in **parallel streams** to merge results from different threads. It must be compatible with the accumulator: `combiner(identity, x) == x`.

??? question "6. When should you use parallel streams and when should you avoid them?"
    **Use** when: large dataset (10K+ elements), CPU-intensive per-element processing, stateless operations, source has good splittability (arrays, ArrayList). **Avoid** when: small datasets (overhead exceeds benefit), I/O-bound operations (threads block, use CompletableFuture instead), operations depend on encounter order, shared mutable state exists, source is LinkedList or `Stream.iterate()` (poor splitting). Always measure — parallel is not always faster.

??? question "7. What is the difference between findFirst() and findAny()? When would you prefer one?"
    `findFirst()` returns the first element in encounter order — deterministic, costs extra synchronization in parallel. `findAny()` returns any element — non-deterministic but faster in parallel streams since it takes the first available result from any thread. Use `findFirst()` when you need the first match specifically; use `findAny()` in parallel when you just need any matching element and order doesn't matter.

??? question "8. How does groupingBy work? How do you do multi-level grouping?"
    `groupingBy(classifier)` partitions stream elements into a `Map<K, List<T>>` based on a classification function. You can pass a downstream collector for aggregation: `groupingBy(dept, counting())` counts per group. For multi-level grouping, nest the collectors: `groupingBy(Employee::dept, groupingBy(Employee::city))` produces `Map<String, Map<String, List<Employee>>>`.

??? question "9. How do you find the second highest salary using streams?"
    ```java
    Optional<Integer> secondHighest = employees.stream()
        .map(Employee::salary)
        .distinct()                           // remove duplicate salaries
        .sorted(Comparator.reverseOrder())    // descending order
        .skip(1)                              // skip the highest
        .findFirst();                         // get the second
    ```
    Key points: use `distinct()` to avoid counting the same salary twice, `skip(n-1)` generalizes to nth-highest, and the result is `Optional` to handle edge cases (fewer than 2 distinct salaries).

??? question "10. What is the difference between Collection.stream().forEach() and Collection.forEach()?"
    `Collection.forEach()` iterates directly over the collection using its internal iterator — simpler, less overhead, and can use enhanced for-loop semantics. `stream().forEach()` creates a stream pipeline first — more overhead but allows chaining with other stream operations. For simple iteration without transformations, prefer `Collection.forEach()`. Also, `stream().forEach()` does **not guarantee order** in parallel; use `forEachOrdered()` if order matters.
