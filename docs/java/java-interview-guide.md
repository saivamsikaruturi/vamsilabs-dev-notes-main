# Java Interview Guide — FAANG & Top-Tier

> Every Java interview at a top company follows the same arc: they start with fundamentals to see if you *actually* understand the language, escalate into concurrency and JVM internals to test depth, then finish with design to gauge production instinct. This guide mirrors that arc.

**Difficulty tags:** L1 (phone screen) · L2 (onsite) · L3 (senior/staff deep-dive)

---

## 1. Core Java Fundamentals

The type system, memory semantics, object lifecycle, OOP. Interviewers use these to gauge whether you actually understand the language or just use it mechanically — they show up in nearly every phone screen.

### Core Questions

- **Is Java pass-by-value or pass-by-reference?** Always pass-by-value. When you pass an object, the reference itself is copied — the caller's reference cannot be reassigned by the callee. This is why swapping two objects inside a method has no effect on the caller.

    ```java
    void swap(Object a, Object b) {
        Object temp = a;
        a = b;       // only reassigns local copy
        b = temp;    // caller's references unchanged
    }
    ```

- **What is the contract between equals() and hashCode()?**
    - If two objects are equal via `equals()`, they **must** return the same `hashCode()`
    - Violating this breaks HashMap, HashSet, and any hash-based collection
    - The reverse is not required — unequal objects may share a hash code (collisions)
    - Override both or neither; never override just one

    ```java
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Employee e)) return false;
        return id == e.id && name.equals(e.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name);
    }
    ```

- **Explain the difference between abstract classes and interfaces (post-Java 8).**
    - **Interfaces** — support multiple inheritance, default methods, but cannot hold instance state (fields)
    - **Abstract classes** — can hold state and constructors, but limit you to single inheritance
    - **Rule of thumb** — interfaces for capabilities ("can-do"), abstract classes for shared implementation ("is-a" with common code)

- **Why should you favor immutability?**
    - **Thread safety** — inherently safe without synchronization
    - **Safe map keys** — hashCode never changes
    - **Simplicity** — easier to reason about, no defensive copies needed
    - **Sharing** — instances can be freely shared across threads and caches
    - Trade-off is object creation cost, which modern JVMs handle well via escape analysis and GC

### Study Resources

- [Java Basics Part 1](JavaBasics.md) — Language fundamentals, types, control flow
- [Java Basics Part 2](JavaBasics2.md) — Methods, memory model, strings
- [Pass-by-Value](PassByValue.md) — Why Java is always pass-by-value
- [Static & Final](StaticAndFinal.md) — Keywords and their implications
- [OOP Concepts](oops.md) — Inheritance, polymorphism, encapsulation, abstraction
- [Constructors](Constructors.md) — Construction chaining, copy constructors
- [Access Modifiers](AccessModifiers.md) — Visibility rules
- [equals & hashCode](EqualsHashCode.md) — Contract and implementation
- [Immutable Classes](ImmutableClasses.md) — Design patterns for immutability
- [Exception Handling](ExceptionHandling.md) — Checked vs unchecked, best practices
- [Enums](Enums.md) — Type-safe constants, enum methods
- [Inner Classes](InnerClasses.md) — Static nested, anonymous, local classes
- [Interfaces](Interfaces.md) — Default methods, functional interfaces

---

## 2. Strings & Wrapper Classes

Strings come up disproportionately because they intersect immutability, memory management, the String pool, and API fluency. Wrapper classes test autoboxing pitfalls, caching ranges, and equality semantics. L1 entry point, but follow-ups reach L2 fast.

### Key Questions

- **Why is String immutable in Java?**
    - **Pool sharing** — multiple references point to same literal safely
    - **Thread safety** — no synchronization needed
    - **Security** — class names, URLs, file paths can't be tampered
    - **Performance** — `hashCode()` computed once and cached

- **What is the difference between String, StringBuilder, and StringBuffer?**
    - **String** — immutable; every modification creates a new object
    - **StringBuilder** — mutable, not thread-safe (fast, prefer this)
    - **StringBuffer** — mutable, thread-safe via synchronized methods (legacy, slower)

- **Explain the String pool and `intern()`.**
    - The String pool (in the heap since Java 7) stores unique String literals
    - When you write `"hello"`, the JVM checks the pool first
    - `intern()` explicitly adds a String to the pool and returns the canonical reference
    - Enables `==` comparison for interned strings, but overuse can cause memory issues

    ```java
    String a = "hello";          // pool literal
    String b = new String("hello"); // new heap object
    String c = b.intern();       // returns pool reference

    System.out.println(a == b);  // false — different objects
    System.out.println(a == c);  // true  — same pool reference
    ```

- **What is the Integer cache, and why does `Integer.valueOf(127) == Integer.valueOf(127)` return true?**
    - Java caches Integer values from -128 to 127
    - `valueOf()` returns cached instances in that range, so `==` works
    - Outside that range, new objects are created and `==` returns false
    - **Always use `.equals()` for wrapper comparisons**

    ```java
    Integer x = 127, y = 127;
    System.out.println(x == y);       // true  — cached

    Integer a = 128, b = 128;
    System.out.println(a == b);       // false — new objects
    System.out.println(a.equals(b));  // true  — correct way
    ```

### Go Deeper

- [Strings](Strings.md) — Immutability, pool, methods
- [String Pool Internals](StringPoolInternals.md) — How the pool works internally
- [String Methods](StringMethods.md) — Essential string operations
- [Wrapper Classes](WrapperClasses.md) — Autoboxing, cache, pitfalls

---

## 3. Collections Framework

The most-tested area in Java interviews. They don't just ask *what* each collection does — they want the internals: hash tables, red-black trees, array resizing, iterator fail-fast behavior. Know when to pick what and why.

### Interview Essentials

- **How does HashMap work internally?**
    - Uses an array of buckets (default capacity 16)
    - Key's `hashCode()` determines bucket index via bit manipulation
    - Collisions handled with linked lists that convert to **red-black trees** when a bucket exceeds 8 entries (treeification threshold)
    - Load factor (default 0.75) triggers resizing at `capacity * loadFactor` entries

    ```java
    // Simplified internal structure
    // table[0] -> null
    // table[1] -> Node("key1",val) -> Node("key2",val) -> null
    // table[2] -> TreeNode (when list > 8 nodes)
    // ...
    // table[15] -> null
    Map<String, Integer> map = new HashMap<>(16, 0.75f);
    ```

- **What is the difference between HashMap and ConcurrentHashMap?**
    - **HashMap** — not thread-safe, allows one null key
    - **ConcurrentHashMap** (Java 8+) — uses CAS operations and per-bin synchronization (not full-map locking)
    - Never throws ConcurrentModificationException
    - Supports atomic operations like `computeIfAbsent()`, `merge()`

    ```java
    ConcurrentHashMap<String, Integer> counts = new ConcurrentHashMap<>();
    // Atomic compute — no external synchronization needed
    counts.merge("key", 1, Integer::sum);
    ```

- **When would you use TreeMap vs HashMap vs LinkedHashMap?**
    - **HashMap** — O(1) access, no ordering guarantees
    - **TreeMap** — sorted key order, O(log n) operations, backed by red-black tree
    - **LinkedHashMap** — insertion-order or access-order iteration (useful for LRU caches)

- **Explain fail-fast vs fail-safe iterators.**
    - **Fail-fast** (ArrayList, HashMap) — throw `ConcurrentModificationException` if collection is structurally modified during iteration
    - **Fail-safe** (ConcurrentHashMap, CopyOnWriteArrayList) — work on a snapshot or tolerate concurrent modification without throwing

### Reference Pages

- [Collections Framework](Collections.md) — Overview of List, Set, Map, Queue
- [HashMap Internals](HashMapInternals.md) — Hashing, buckets, tree nodes
- [ConcurrentHashMap](ConcurrentHashMapInternals.md) — Segment locking, lock striping
- [LinkedHashMap & LRU](LinkedHashMapLRU.md) — Insertion/access ordering
- [Comparable vs Comparator](ComparableComparator.md) — Natural vs custom ordering
- [Fail-Fast vs Fail-Safe](FailFastFailSafe.md) — Iterator behaviors
- [PriorityQueue & Heap](PriorityQueueAndHeap.md) — Heap data structure
- [Collections Compared](DiffCollections.md) — When to use what
- [EnumSet & EnumMap](EnumSetAndEnumMap.md) — Specialized enum collections
- [Covariance & PECS](CovarianceAndPECS.md) — Producer Extends, Consumer Super

---

## 4. Concurrency & Multithreading

This is what separates senior from mid. Thread safety, visibility, ordering, liveness — plus practical patterns like thread pools, CompletableFuture pipelines, and Java 21 virtual threads. The Java Memory Model's happens-before rules are L3 territory.

### What Gets Asked

- **What is the difference between `synchronized`, `volatile`, and `Lock`?**
    - **`synchronized`** — mutual exclusion + visibility (happens-before); implicit lock/unlock
    - **`volatile`** — visibility and ordering only; no atomicity for compound operations
    - **`Lock` (ReentrantLock)** — explicit control: try-lock, timed-lock, interruptible, multiple conditions

    ```java
    // volatile: visibility only — NOT safe for count++
    private volatile boolean running = true;

    // synchronized: mutual exclusion + visibility
    synchronized (lock) {
        count++;  // safe compound operation
    }
    ```

- **How do you prevent deadlocks?**
    - **Lock ordering** — always acquire locks in a consistent global order
    - **Try-lock with timeout** — fail gracefully instead of waiting forever
    - **Avoid nested locks** — restructure code to minimize lock scope
    - **Higher-level utilities** — use ConcurrentHashMap, atomic variables to eliminate explicit locking

    ```java
    // Try-lock with timeout — avoids indefinite blocking
    if (lock1.tryLock(100, TimeUnit.MILLISECONDS)) {
        try {
            if (lock2.tryLock(100, TimeUnit.MILLISECONDS)) {
                try { /* critical section */ }
                finally { lock2.unlock(); }
            }
        } finally { lock1.unlock(); }
    }
    ```

- **What are virtual threads and when should you use them?**
    - Lightweight threads managed by the JVM, not the OS (Java 21, JEP 444)
    - Ideal for I/O-bound workloads: HTTP calls, database queries, file I/O
    - Can run millions concurrently — each costs ~1 KB vs ~1 MB for platform threads
    - **NOT suited** for CPU-bound tasks where platform threads with parallelism = core count are better

- **Explain CompletableFuture vs Future.**
    - **`Future`** — can only block with `get()`; no composition or callbacks
    - **`CompletableFuture`** — non-blocking composition (`thenApply`, `thenCompose`, `thenCombine`), exception handling (`exceptionally`, `handle`), async execution on custom executors
    - Enables reactive-style pipelines without blocking threads

### Deep Dive Pages

- [Multithreading](MultiThreading.md) — Threads, synchronization, basics
- [Virtual Threads](VirtualThreads.md) — Java 21 lightweight threads
- [CompletableFuture](CompletableFuture.md) — Async programming
- [Volatile & Atomics](VolatileAtomics.md) — Visibility and atomic operations
- [Locks & Conditions](Locks.md) — ReentrantLock, ReadWriteLock
- [Deadlocks](deadlocks.md) — Detection and prevention
- [ThreadLocal & Sync Aids](ThreadLocalAndSyncAids.md) — CountDownLatch, CyclicBarrier
- [Concurrent Collections](ConcurrentCollections.md) — Thread-safe collections
- [Fork/Join Framework](ForkJoinFramework.md) — Work-stealing parallelism
- [Executors](Executors.md) — Thread pool management
- [Concurrency Patterns](ConcurrencyPatterns.md) — Producer-consumer, read-write lock patterns
- [Scoped Values & Structured Concurrency](ScopedValuesStructuredConcurrency.md) — Java 21 concurrency model

---

## 5. JVM & Memory

What happens beneath your code. Class loading, runtime memory areas (heap, metaspace, stack, code cache), GC algorithms, and production diagnostics — memory leaks, CPU profiling, thread dumps. This is where you prove you can debug systems, not just write them.

### Production Questions

- **Describe the JVM memory areas.**
    - **Heap** — stores objects; divided into Young Gen (Eden + Survivor) and Old Gen
    - **Stack** — one per thread; stores frames with local variables and operand stack
    - **Metaspace** — off-heap; stores class metadata (replaced PermGen in Java 8)
    - **Code Cache** — holds JIT-compiled native code
    - **PC Registers** — track execution position per thread

- **How does G1 garbage collector work?**
    - Divides the heap into equal-sized regions (not fixed generations)
    - Prioritizes collecting regions with the most garbage ("garbage first")
    - Uses concurrent marking, mixed collections (young + some old regions)
    - Aims to meet a pause-time target (`-XX:MaxGCPauseMillis`)
    - Default GC since Java 9

- **How would you diagnose a memory leak in production?**
    - Monitor heap growth over time with metrics/JMX
    - Take a heap dump (`jmap` or automatic on OOM)
    - Analyze with Eclipse MAT or VisualVM — find dominator tree and retained size
    - Identify objects holding unexpected references (static collections, listeners, class loader leaks)

    ```bash
    # Take heap dump from running process
    jmap -dump:live,format=b,file=heap.hprof <pid>

    # Or set JVM flag to dump automatically on OOM
    java -XX:+HeapDumpOnOutOfMemoryError \
         -XX:HeapDumpPath=/tmp/heap.hprof -jar app.jar
    ```

- **What is the happens-before relationship?**
    - A guarantee in the JMM: if action A happens-before action B, then A's effects are visible to B
    - **Program order** — within a thread, each action happens-before the next
    - **Monitor unlock** — happens-before subsequent lock of the same monitor
    - **Volatile write** — happens-before subsequent read of the same variable
    - **Thread start** — `thread.start()` happens-before any action in the started thread

### Further Reading

- [JVM Architecture](Jvm.md) — Class loading, runtime data areas
- [Garbage Collection](GarbageCollection.md) — GC algorithms, tuning
- [Java Memory Model](JavaMemoryModel.md) — Happens-before, visibility
- [JVM Tuning](JVMTuning.md) — Flags, profiling, optimization
- [Memory Leaks](MemoryLeaks.md) — Common causes and detection
- [Class Loaders](ClassLoaders.md) — Delegation model
- [Profiling Tools](ProfilingTools.md) — JFR, VisualVM, async-profiler
- [Reference Types](ReferenceTypes.md) — Strong, soft, weak, phantom references

---

## 6. Java 8+ Features

Lambdas, streams, Optional, records, sealed classes, pattern matching. If you're still writing Java 6-era code, this is where it shows. Senior-level: stream internals (spliterators, characteristics) and when *not* to use streams.

### Modern Java Questions

- **What is the difference between `map()` and `flatMap()` in streams?**
    - **`map()`** — one-to-one transformation (T -> R)
    - **`flatMap()`** — one-to-many transformation, flattened (T -> Stream\<R> -> R)
    - Use `flatMap()` when each element maps to multiple elements — e.g., lines to words, orders to items

    ```java
    // map: one order -> one customer name
    orders.stream().map(Order::getCustomerName)

    // flatMap: one order -> many items
    orders.stream().flatMap(o -> o.getItems().stream())
    ```

- **When should you use Optional vs null?**
    - Use Optional as a **return type** to signal "this method might not have a result"
    - **Never** use for fields, method parameters, or collections (use empty collections instead)
    - Prefer `orElseGet()` over `orElse()` when the default is expensive to compute

- **What are sealed classes and why do they matter?**
    - Restrict which classes can extend them via a `permits` clause (Java 17)
    - Enable exhaustive pattern matching in switch — compiler knows all subtypes
    - Model closed hierarchies: AST nodes, command types, state machines

- **Explain records and when to use them.**
    - Immutable data carriers (Java 16) — compiler generates `equals()`, `hashCode()`, `toString()`, accessors, canonical constructor
    - Use for DTOs, value objects, and identity-by-data classes
    - Cannot extend other classes but can implement interfaces

    ```java
    // Imperative style
    int sum = 0;
    for (Order o : orders) {
        if (o.getTotal() > 100) sum += o.getTotal();
    }

    // Stream style — declarative, composable
    int sum = orders.stream()
        .mapToInt(Order::getTotal)
        .filter(t -> t > 100)
        .sum();
    ```

### Study Materials

- [Java 8 Features](Java8.md) — Lambdas, streams, Optional
- [Functional Programming](FunctionalProgramming.md) — Functional interfaces, method references
- [Stream API](../stream-api/streamapi.md) — Operations, collectors, parallel streams
- [Collectors & Parallel Streams](CollectorsAndParallelStreams.md) — Advanced stream operations
- [Optional Deep Dive](OptionalDeepDive.md) — Best practices
- [Java 11 Features](java11.md) — var, HTTP client, new APIs
- [Java 17 Features](Java17.md) — Sealed classes, pattern matching
- [Java 21 Features](Java21.md) — Virtual threads, record patterns
- [Records & Sealed Classes](RecordsAndSealedClasses.md) — Modern data carriers
- [Pattern Matching](PatternMatching.md) — instanceof, switch expressions
- [Stream Gatherers](StreamGatherers.md) — Custom intermediate operations (Java 22+)
- [Date & Time API](DateTime.md) — java.time package

---

## 7. Design & Architecture

SOLID, generics, Effective Java patterns — the OOD portion of your loop. Senior roles: whiteboard a class hierarchy, defend composition over inheritance, explain how frameworks leverage reflection and proxies.

### Design Questions

- **Explain the Liskov Substitution Principle with an example.**
    - Subtypes must be substitutable for their base types without altering program correctness
    - Classic violation: `Square` extending `Rectangle` where `setWidth()` also changes height — clients expecting independent width/height break
    - Fix: use composition or separate interfaces

- **What is type erasure and why does it matter?**
    - Generics are compile-time only — at runtime, `List<String>` becomes `List` (raw type)
    - **Consequences:**
        - Cannot create generic arrays (`new T[]`)
        - Cannot use `instanceof` with parameterized types
        - Cannot get type parameter at runtime without a `Class<T>` token
        - `List<Integer>` and `List<String>` share the same class at runtime

- **When would you use a dynamic proxy?**
    - Intercept method calls without modifying the target class
    - Use cases: AOP (logging, transactions, security), lazy loading, remote invocation
    - `java.lang.reflect.Proxy` works for interfaces; use CGLIB/ByteBuddy for classes

    ```java
    // Dynamic proxy — intercepts all method calls
    Object proxy = Proxy.newProxyInstance(
        target.getClass().getClassLoader(),
        target.getClass().getInterfaces(),
        (proxyObj, method, args) -> {
            System.out.println("Before: " + method.getName());
            Object result = method.invoke(target, args);
            System.out.println("After: " + method.getName());
            return result;
        }
    );
    ```

### Related Topics

- [Design Principles (SOLID)](DesignPrinciples.md) — SOLID principles explained
- [Effective Java Patterns](EffectiveJavaPatterns.md) — Joshua Bloch's key items
- [Generics](Generics.md) — Type erasure, bounds, wildcards
- [Type Erasure](TypeErasure.md) — How generics work at runtime
- [Annotations](Annotations.md) — Custom annotations, processors
- [Reflection](Reflection.md) — Runtime class inspection
- [Dynamic Proxy](DynamicProxy.md) — Proxy pattern implementation
- [Module System](ModuleSystem.md) — Java Platform Module System (JPMS)
- [Service Loader & SPI](ServiceLoaderSPI.md) — Plugin architectures

---

## 8. I/O & Networking

Less frequent in interviews but proves breadth. Blocking I/O vs NIO vs NIO.2 comes up in system design discussions. Serialization pitfalls (security, versioning) matter for any distributed system role.

### I/O Questions

- **What is the difference between IO and NIO?**
    - **Classic IO** — stream-oriented, blocking; one thread per connection
    - **NIO** — buffer-oriented with channels and selectors; non-blocking multiplexed I/O
    - NIO enables one thread to handle many connections — foundation of Netty, Tomcat NIO connector

    ```java
    // NIO: non-blocking selector pattern (simplified)
    Selector selector = Selector.open();
    channel.configureBlocking(false);
    channel.register(selector, SelectionKey.OP_READ);

    while (selector.select() > 0) {
        for (SelectionKey key : selector.selectedKeys()) {
            if (key.isReadable()) { /* handle read */ }
        }
    }
    ```

- **Why is Java serialization considered dangerous?**
    - Deserialization can trigger arbitrary code execution through gadget chains
    - `readObject()` runs during deserialization, potentially calling dangerous methods
    - **Alternatives:** JSON/Protobuf for data exchange, serialization filters (JEP 290) if you must use native serialization

### Related Pages

- [File Handling](FileHandling.md) — Files, Paths, NIO.2
- [NIO](NIO.md) — Channels, buffers, selectors
- [Serialization](Serialization.md) — Serializable, Externalizable
- [Networking](Networking.md) — Sockets, HTTP
- [JDBC](JDBC.md) — Database connectivity

---

## Interview Preparation Roadmap

A structured 6-week plan for comprehensive preparation:

| Week | Focus Area | Sections | Daily Target |
|------|-----------|----------|--------------|
| 1 | Core Java + OOP | Sections 1-2 | 2-3 pages + 10 questions |
| 2 | Collections Deep Dive | Section 3 | Implement HashMap from scratch |
| 3 | Concurrency | Section 4 | Write concurrent programs daily |
| 4 | JVM + Memory + GC | Section 5 | Profile a real application |
| 5 | Java 8+ Features | Section 6 | Rewrite old code with streams |
| 6 | Design + Mock Interviews | Section 7 | 2 mock interviews per week |

**Tips for each phase:**

- **Weeks 1-2:** Do not just memorize. Write code that demonstrates each concept. Can you explain why `==` fails for Integer 128 but works for 127 without looking it up?
- **Week 3:** Concurrency bugs are hard to reproduce. Use `jcstress` or write tests with CountDownLatch to force interleavings.
- **Week 4:** Take heap dumps of your own applications. Find the largest objects. Understand why they are retained.
- **Week 5:** Convert at least 10 imperative loops to stream pipelines. Then identify 3 cases where streams made the code worse and revert them.
- **Week 6:** Practice explaining your design decisions out loud. The interviewer cares more about your reasoning than the final answer.

---

## Quick Recall — Top 50 Java Interview Questions

One-line answers for rapid review before an interview. For detailed explanations, follow the links in each section above.

| # | Question | Answer |
|---|----------|--------|
| 1 | Is Java pass-by-value or pass-by-reference? | Always pass-by-value; object references are copied, not the objects themselves. |
| 2 | Why is String immutable? | Pool sharing, thread safety, security, and hashCode caching. |
| 3 | Difference between `==` and `.equals()`? | `==` compares references (memory addresses); `.equals()` compares logical content. |
| 4 | What is the String pool? | A cache of String literals in the heap that avoids creating duplicate String objects. |
| 5 | Can you override static methods? | No — static methods are resolved at compile time (method hiding, not overriding). |
| 6 | What is autoboxing? | Automatic conversion between primitives and their wrapper classes by the compiler. |
| 7 | What makes a class immutable? | Final class, private final fields, no setters, defensive copies of mutable fields, no `this` escape in constructor. |
| 8 | Difference between abstract class and interface? | Interfaces allow multiple inheritance and cannot hold state; abstract classes can hold state but limit to single inheritance. |
| 9 | What is the diamond problem? | Ambiguity when a class inherits conflicting default methods from two interfaces; resolved by overriding the method. |
| 10 | What does `final` mean on a variable? | The reference cannot be reassigned; the object it points to can still be mutated. |
| 11 | How does HashMap handle collisions? | Linked list in the bucket, converting to a red-black tree when the list exceeds 8 nodes. |
| 12 | What is the load factor of HashMap? | Default 0.75 — resize triggers when entries exceed capacity times load factor. |
| 13 | Difference between ArrayList and LinkedList? | ArrayList has O(1) random access but O(n) insertion; LinkedList has O(1) insertion at known positions but O(n) traversal. |
| 14 | When should you use TreeMap? | When you need keys sorted in natural or custom order with O(log n) operations. |
| 15 | What is CopyOnWriteArrayList? | A thread-safe list that creates a new array on every write; ideal for read-heavy, write-rare scenarios. |
| 16 | How does ConcurrentHashMap differ from Hashtable? | ConcurrentHashMap uses fine-grained locking (per-bin); Hashtable locks the entire map on every operation. |
| 17 | What is a fail-fast iterator? | An iterator that throws ConcurrentModificationException if the collection is modified during iteration. |
| 18 | Difference between Comparable and Comparator? | Comparable defines natural ordering inside the class; Comparator defines external, reusable ordering strategies. |
| 19 | What is the PriorityQueue backed by? | A binary min-heap (array-based), providing O(log n) insertion and O(1) peek. |
| 20 | What is EnumSet optimized for? | Bit-vector implementation — extremely fast set operations for enum types. |
| 21 | What is `synchronized` in Java? | A keyword providing mutual exclusion and memory visibility via intrinsic locks (monitors). |
| 22 | What does `volatile` guarantee? | Visibility (writes are immediately visible to other threads) and ordering (no reordering around volatile access). |
| 23 | How do you create a thread-safe singleton? | Use an enum (simplest), or double-checked locking with a volatile field, or a static inner holder class. |
| 24 | What is a deadlock? | When two or more threads each hold a lock the other needs, and neither can proceed. |
| 25 | What is a race condition? | When program correctness depends on the relative timing of thread execution. |
| 26 | How does ReentrantLock differ from synchronized? | ReentrantLock supports try-lock, timed lock, interruptible lock acquisition, and multiple condition variables. |
| 27 | What are atomic variables? | Classes (AtomicInteger, AtomicReference) using CAS hardware instructions for lock-free thread-safe operations. |
| 28 | What is a CountDownLatch? | A synchronizer that allows threads to wait until a counter reaches zero (one-shot, non-reusable). |
| 29 | What is the Fork/Join framework? | A framework for parallelizing divide-and-conquer tasks using work-stealing across a pool of threads. |
| 30 | What are virtual threads? | Lightweight JVM-managed threads (Java 21) that enable millions of concurrent threads for I/O-bound workloads. |
| 31 | What areas of memory does the JVM have? | Heap, stack (per thread), metaspace, code cache, and program counter registers. |
| 32 | What triggers garbage collection? | When the JVM cannot allocate memory in the young or old generation, or when System.gc() is called (advisory). |
| 33 | What is the difference between Young Gen and Old Gen? | Young Gen holds short-lived objects (collected frequently via minor GC); Old Gen holds long-lived objects (collected via major/full GC). |
| 34 | What is a memory leak in Java? | Objects that are still referenced but no longer needed, preventing garbage collection — e.g., entries in a static Map never removed. |
| 35 | What is the purpose of `finalize()`? | Deprecated cleanup hook called before GC reclaims an object; replaced by Cleaners and try-with-resources. |
| 36 | What is the class loading delegation model? | Child class loaders delegate to parent first (bootstrap -> extension -> application), ensuring core classes are loaded once. |
| 37 | What is JIT compilation? | The JVM compiles hot bytecode to native machine code at runtime for performance, using C1 (fast) and C2 (optimizing) compilers. |
| 38 | What is escape analysis? | A JIT optimization that determines if an object is confined to a method, enabling stack allocation and lock elimination. |
| 39 | What is a lambda expression? | An anonymous function implementing a functional interface, enabling concise behavior parameterization. |
| 40 | What is a functional interface? | An interface with exactly one abstract method, annotated with @FunctionalInterface (e.g., Predicate, Function, Consumer). |
| 41 | Difference between `map()` and `flatMap()`? | `map()` transforms each element 1:1; `flatMap()` transforms each element to a stream and flattens all streams into one. |
| 42 | What is Optional for? | A container that may or may not hold a value, used as a return type to avoid null and express absence explicitly. |
| 43 | Are streams lazy? | Yes — intermediate operations are not executed until a terminal operation is invoked. |
| 44 | What are sealed classes? | Classes that restrict which other classes can extend them, enabling exhaustive pattern matching (Java 17). |
| 45 | What are records? | Immutable data carriers with auto-generated constructors, accessors, equals, hashCode, and toString (Java 16). |
| 46 | What is the SOLID principle? | Five design principles: Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, Dependency Inversion. |
| 47 | What is type erasure? | Generics exist only at compile time; the JVM sees raw types at runtime, with casts inserted by the compiler. |
| 48 | Why prefer composition over inheritance? | Composition provides flexibility (swap implementations), avoids fragile base class problems, and does not expose internal implementation. |
| 49 | What is the try-with-resources statement? | Automatic resource management that calls `close()` on AutoCloseable resources when the block exits, even on exceptions. |
| 50 | What is the difference between checked and unchecked exceptions? | Checked exceptions must be declared or caught (IOException); unchecked exceptions (RuntimeException subclasses) do not — they signal programming errors. |

---

## Common Mistakes in Java Interviews

Avoid these pitfalls that trip up even experienced candidates:

1. **Confusing `==` with `.equals()` for wrapper types.** Always use `.equals()` for object comparison. The Integer cache only covers -128 to 127.

2. **Forgetting that HashMap keys must be immutable** (or at least their hashCode must not change). Using a mutable object as a key and then modifying it makes the entry unretrievable.

3. **Using `synchronized` on a non-final field.** If the reference changes, threads synchronize on different monitors — no actual mutual exclusion.

4. **Ignoring the Stream API's stateful operations.** `sorted()`, `distinct()`, and `limit()` on parallel streams may negate parallelism benefits or produce incorrect results if the stream source is unordered.

5. **Claiming Java supports multiple inheritance.** Java supports multiple inheritance of type (interfaces) and behavior (default methods), but NOT of state. Be precise.

6. **Over-engineering with design patterns.** Interviewers want clean, simple code first. Apply patterns only when the problem demands it. Name the pattern and explain why — not just how.

---

## Behavioral Tips for Java Interviews at FAANG

- **Think out loud.** Interviewers cannot assess your thought process if you code silently. Narrate your approach.
- **Start with the simplest correct solution.** Optimize only when asked. Premature optimization in interviews wastes time.
- **Ask clarifying questions.** "Should this be thread-safe?" or "Can the input be null?" shows maturity.
- **Know your resume.** If you listed "expert in concurrency," expect deep questions on the JMM and lock-free algorithms.
- **Admit when you do not know.** Guessing wrong is worse than saying "I have not worked with that, but here is how I would approach it."

---

## See Also

- [Spring Boot Notes](../springboot/webflux.md) — Reactive web framework
- [System Design — CAP Theorem](../capTheorem.md) — Distributed systems fundamentals
- [System Design — Consistent Hashing](../consistenthashing.md) — Distributed systems patterns
- [Rate Limiting](../ratelimiting.md) — API design patterns
- [Redis](../redis.md) — Caching and data structures

---

*Last updated: May 2026. Covers Java 8 through Java 21.*
