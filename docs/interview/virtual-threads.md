---
title: "Virtual Threads & Project Loom — Java 21 Deep Dive"
description: "Master Java virtual threads and Project Loom for FAANG interviews. Covers platform vs virtual threads, carrier threads, pinning, structured concurrency, scoped values, and 15 real interview Q&As."
tags:
  - java21
  - virtual-threads
  - project-loom
  - concurrency
  - interview
---

# Virtual Threads & Project Loom — Java 21 Deep Dive

Java 21 (September 2023) made virtual threads a production feature after years of incubation under Project Loom. This is the most significant change to the Java concurrency model since `java.util.concurrent` landed in Java 5. For senior engineers, this is not just API knowledge — interviewers expect you to explain the JVM internals, the failure modes, and when virtual threads hurt rather than help.

---

## The Problem Project Loom Solves

### Thread-Per-Request Model and Its Limits

The dominant server-side Java pattern for the last two decades is one OS thread per request. Spring MVC, Tomcat, and JDBC all assume blocking I/O: a thread picks up a request, blocks waiting for the database, blocks waiting for an upstream service, then writes the response.

This model is simple to program and reason about, but it hits a hard ceiling around **10,000–20,000 concurrent requests** on typical hardware. Why?

**Platform thread cost (Java 21 era):**

| Resource | Cost per platform thread |
|---|---|
| Stack memory | 512 KB – 1 MB (default `-Xss`) |
| OS kernel struct | ~8 KB on Linux |
| Context switch overhead | microseconds (non-trivial at scale) |
| Scheduling | OS scheduler, not JVM |

A server with 8 GB heap can sustain roughly 8,000–16,000 platform threads before memory pressure causes GC thrashing and then OOM. This is why Tomcat defaults to a thread pool of 200 and why Netflix and others moved to reactive programming (Reactor, RxJava) — not because they wanted to, but because they had no alternative.

### The Reactive Tax

Reactive programming solves the throughput problem by using event loops and callbacks instead of blocking threads. The `CompletableFuture` / `WebFlux` / `Reactor` stack is highly scalable, but it comes at enormous cost:

- **Non-linear code flow** — logic is scattered across callbacks and lambda chains, making stack traces meaningless
- **Error handling is different** — exceptions do not propagate naturally; you must explicitly call `.onErrorResume()` etc.
- **ThreadLocal breaks** — a reactive pipeline does not run on one thread, so thread-local state is invisible mid-pipeline
- **Debugging is hard** — a stack trace shows `map → flatMap → subscribe` rather than your application logic
- **Library compatibility** — every JDBC driver, every cache client, every legacy utility must have a reactive variant or it blocks the event loop

Project Loom's thesis: **the hardware efficiency of reactive programming, with the programming model of synchronous blocking code.**

---

## Platform Threads vs Virtual Threads

### The Fundamental Difference

A **platform thread** (the old kind) is a thin wrapper around an OS thread. It is scheduled by the OS kernel. Its stack lives in native memory. Creating one requires a syscall. The OS sees it, the JVM sees it, and they are the same thing.

A **virtual thread** is a JVM-managed entity. It has its own stack, but that stack lives on the Java heap. It is scheduled by the JVM, not the OS. The OS has no idea it exists.

```
Platform Thread:         Virtual Thread:
┌─────────────┐          ┌─────────────────────────┐
│  OS Thread  │          │     JVM Scheduler        │
│  (kernel)   │          │                          │
│  ~1MB stack │          │  VT1  VT2  VT3  ... VTn  │
│  (native)   │          │  (heap-allocated stacks) │
└─────────────┘          └──────────┬──────────────┘
                                    │ mounts onto
                          ┌─────────▼──────────┐
                          │  Carrier Threads    │
                          │  (ForkJoinPool)     │
                          │  count = CPU cores  │
                          └────────────────────┘
```

### Carrier Threads

Virtual threads do not run in mid-air — they mount onto **carrier threads** when they have work to do. A carrier thread is just a platform thread. The JVM maintains a pool of carrier threads backed by a `ForkJoinPool`, sized to `Runtime.getRuntime().availableProcessors()` by default (configurable via `jdk.virtualThreadScheduler.parallelism`).

The key mechanics:
1. A virtual thread is scheduled to run → the JVM mounts it onto an available carrier thread
2. The virtual thread runs on the carrier thread's CPU time
3. The virtual thread hits a blocking operation (I/O, `sleep()`, etc.) → the JVM **unmounts** it from the carrier thread, saving its stack to the heap
4. The carrier thread is now free to pick up a different virtual thread
5. When the I/O completes, the JVM reschedules the virtual thread → it mounts onto any available carrier thread and resumes

This mount/unmount cycle is what makes virtual threads scalable. One carrier thread can interleave thousands of virtual threads, each parked while waiting for I/O.

### Continuations and Stackful Coroutines

The mechanism enabling mount/unmount is the **continuation** — a stackful coroutine at the JVM level. When a virtual thread unmounts:

1. The JVM captures the thread's current execution stack (all frames, local variables, program counter) and copies it to the heap
2. The carrier thread's stack is restored to its own state
3. The continuation object on the heap represents "where the virtual thread was"

When the virtual thread remounts:
1. The JVM copies the continuation's saved stack frames back onto the carrier thread's stack
2. Execution resumes from the exact point it was suspended

This is different from OS-level coroutines (like Go goroutines) because it is implemented inside the JVM and requires no special async/await keywords in the source code. A plain `InputStream.read()` call in a virtual thread automatically triggers an unmount if the read would block.

**Key insight for interviews:** The savings are exclusively on blocking time. If a virtual thread is actively computing (sorting, hashing, parsing), it holds the carrier thread for the full duration — no different from a platform thread. Virtual threads are not magic CPU multipliers; they are blocking-I/O multiplexers.

### Side-by-Side Comparison

| Dimension | Platform Thread | Virtual Thread |
|---|---|---|
| OS thread? | Yes — 1:1 mapping | No — M:N mapping (M VTs onto N carriers) |
| Stack location | Native memory | Java heap |
| Stack size | Fixed (default 512KB–1MB) | Dynamic (grows/shrinks, starts small ~1KB) |
| Creation cost | High (~1ms, syscall) | Low (~microseconds, heap alloc) |
| Max concurrent | ~10K–20K (memory-bound) | Millions (heap-bound, but heap is GCed) |
| Scheduler | OS kernel | JVM ForkJoinPool |
| ThreadLocal | Works | Works but anti-pattern (see Scoped Values) |
| Blocking I/O | Holds OS thread | Unmounts carrier thread |
| CPU-bound work | Full throughput | Full throughput (holds carrier) |
| synchronized block | Works | Can pin (see Pinning section) |
| `Thread.sleep()` | Blocks OS thread | Unmounts carrier (JVM intercepts) |

---

## How Virtual Threads Work Internally

### The JVM Scheduler

The carrier thread pool is a `ForkJoinPool` running in FIFO mode (not the work-stealing mode used by the common pool for `parallelStream()`). FIFO matters because virtual threads are I/O-bound and frequently park/unpark — work-stealing would add unnecessary overhead for short tasks.

System property to tune:
```
-Djdk.virtualThreadScheduler.parallelism=32   # number of carrier threads
-Djdk.virtualThreadScheduler.maxPoolSize=256  # max carrier threads for blocking
```

The `maxPoolSize` parameter is relevant for compensating threads (see below).

### Blocking Syscall Interception

The JVM intercepts blocking operations in `java.net`, `java.nio`, `java.io` (channel-based), `Thread.sleep()`, `LockSupport.park()`, and `Object.wait()`. When a virtual thread calls one of these:

1. JVM checks: "is this running on a virtual thread?"
2. If yes: unmount the virtual thread, submit the blocking work to an I/O poller (via `java.nio.channels` event loop), free the carrier thread
3. When the OS notifies the poller that data is available, the virtual thread is resubmitted to the scheduler queue
4. The VT remounts on any available carrier and continues from `read()` returning with the data

For operations that **cannot** be made non-blocking (JNI calls, `synchronized` blocks with blocking code inside — see Pinning), the JVM has a compensation mechanism: it temporarily adds a new carrier thread to prevent full starvation of the pool.

### Stack Growth

Virtual thread stacks start at approximately 1 KB and grow on demand. The JVM allocates additional heap objects to extend the stack as method call depth increases. This means:
- Deep call stacks still work, but cost proportionally more heap
- Stack overflows still happen, just at a much higher threshold
- GC can reclaim stacks of terminated virtual threads

### Thread Identity and Continuations Interplay

Each virtual thread has:
- Its own `Thread` object (returned by `Thread.currentThread()`)
- Its own thread ID (positive, can be very large)
- Its own name (optional)
- Its own continuation (the saved stack)
- Its own set of local variables when mounted

The carrier thread changes between mounts — you should never rely on `Thread.currentThread()` returning the same carrier thread across a blocking call inside a virtual thread.

---

## Creating Virtual Threads

### Thread.ofVirtual()

The `Thread.Builder` API added in Java 21:

```java
// Create and start immediately
Thread vt = Thread.ofVirtual()
    .name("my-vt")
    .start(() -> System.out.println("Running on: " + Thread.currentThread()));

// Create without starting (like Thread.ofPlatform())
Thread vt2 = Thread.ofVirtual()
    .name("fetcher-", 0)   // numbered prefix: fetcher-0, fetcher-1, ...
    .unstarted(() -> doWork());
vt2.start();

// Check if current thread is virtual
boolean isVirtual = Thread.currentThread().isVirtual();
```

### Executors.newVirtualThreadPerTaskExecutor()

The idiomatic replacement for `newCachedThreadPool()` and for most fixed thread pools in I/O-bound services:

```java
try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<String>> futures = new ArrayList<>();
    for (String url : urls) {
        futures.add(executor.submit(() -> fetch(url)));  // each task = one VT
    }
    for (Future<String> f : futures) {
        System.out.println(f.get());
    }
} // executor.close() awaits all submitted tasks and then shuts down
```

Key behavior: `newVirtualThreadPerTaskExecutor()` creates **one new virtual thread per submitted task**. There is no pooling — virtual threads are cheap enough that pooling them is unnecessary and actually counterproductive (pooling would prevent GC of completed thread stacks).

**Anti-pattern warning:** Do not wrap this executor in a semaphore to limit concurrency "for performance." If you have 100,000 tasks and worry about overwhelming a downstream service, use a `Semaphore` explicitly to limit outbound connections, not by limiting VT count.

### Thread.startVirtualThread() Convenience Method

```java
// Shorthand for Thread.ofVirtual().start(runnable)
Thread vt = Thread.startVirtualThread(() -> {
    // task
});
```

### Comparing Executor Choices

```java
// Pre-Loom: bounded pool to limit thread creation cost
ExecutorService pool = Executors.newFixedThreadPool(200);

// Java 21: one VT per task — no pool sizing needed
ExecutorService vtExecutor = Executors.newVirtualThreadPerTaskExecutor();

// For CPU-bound parallel work — still use this, NOT virtual threads
ExecutorService cpuPool = Executors.newWorkStealingPool();  // ForkJoinPool
// or
ForkJoinPool.commonPool();
```

---

## Structured Concurrency

### The Problem with Unstructured Concurrency

Before structured concurrency, spawning subtasks from a parent task was unstructured: if the parent was cancelled, the subtasks lived on. If a subtask failed, the parent had no automatic notification. Leak scenarios were common:

```java
// Unstructured — subtasks outlive their logical scope
ExecutorService exec = Executors.newVirtualThreadPerTaskExecutor();
Future<String> user = exec.submit(() -> fetchUser(id));
Future<Order> order = exec.submit(() -> fetchOrder(id));

// If fetchUser throws, we call order.get() and block forever
// If we cancel, the threads keep running
String u = user.get();     // might throw
Order o = order.get();     // might block forever if above throws
```

### StructuredTaskScope (Java 21 Preview → Java 23 Standard)

`StructuredTaskScope` enforces **structured concurrency**: the lifetime of a subtask is scoped to the block that created it. On exit from the try-with-resources block, all subtasks are guaranteed to have completed (either successfully, failed, or been cancelled).

```java
// ShutdownOnFailure: cancel all sibling tasks if any fails
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Subtask<String> user  = scope.fork(() -> fetchUser(userId));
    Subtask<Order>  order = scope.fork(() -> fetchOrder(orderId));

    scope.join();           // wait for all subtasks to complete or first failure
    scope.throwIfFailed();  // rethrows the first exception if any subtask failed

    // Both completed successfully — results are safe to access
    return new Response(user.get(), order.get());
}
// At this point, both subtasks are guaranteed done — no leaks
```

```java
// ShutdownOnSuccess: return as soon as the first task succeeds
try (var scope = new StructuredTaskScope.ShutdownOnSuccess<String>()) {
    scope.fork(() -> queryPrimary(query));
    scope.fork(() -> queryReplica(query));

    return scope.join().result();  // returns first successful result, cancels other
}
```

### StructuredTaskScope Semantics

| Aspect | Behavior |
|---|---|
| `fork()` | Spawns a virtual thread; returns a `Subtask<T>` handle |
| `join()` | Blocks until the shutdown policy triggers or all tasks complete |
| `join(Duration)` | With timeout — throws `TimeoutException` if exceeded |
| Task cancellation | All forked tasks receive interrupt when scope shuts down |
| Error propagation | `throwIfFailed()` rethrows the first exception as-is or wrapped |
| Nesting | Scopes can be nested; inner scope must complete before outer scope |
| Thread locality | The forking thread must also call `join()` — cross-thread ownership is a compile-time error in future API versions |

### Custom ShutdownPolicy

```java
// Custom scope that collects all results (no shutdown on first failure)
class CollectingScope<T> extends StructuredTaskScope<T> {
    private final List<T> results = new CopyOnWriteArrayList<>();
    private final List<Throwable> failures = new CopyOnWriteArrayList<>();

    @Override
    protected void handleComplete(Subtask<? extends T> subtask) {
        if (subtask.state() == Subtask.State.SUCCESS) {
            results.add(subtask.get());
        } else if (subtask.state() == Subtask.State.FAILED) {
            failures.add(subtask.exception());
        }
    }

    public List<T> results() { return Collections.unmodifiableList(results); }
    public List<Throwable> failures() { return Collections.unmodifiableList(failures); }
}

try (var scope = new CollectingScope<String>()) {
    urls.forEach(url -> scope.fork(() -> fetch(url)));
    scope.join();
    // Process scope.results() and scope.failures()
}
```

---

## Scoped Values

### Why ThreadLocal Is Problematic with Virtual Threads

`ThreadLocal` works — virtual threads support it. The problem is that `ThreadLocal` was designed assuming a bounded thread pool where threads are reused. In a virtual-thread-per-task world:

1. **Memory overhead**: Each virtual thread that reads a `ThreadLocal` creates an entry in its map. With millions of VTs, the aggregate overhead is real.
2. **Accidental inheritance**: `InheritableThreadLocal` copies parent values to child threads. With millions of cheap VT forks, this copy-on-creation cost compounds.
3. **Mutable shared state hazard**: `ThreadLocal` is mutable — any code on the thread can modify it. In deep call stacks this creates implicit coupling.
4. **No encapsulation**: A `ThreadLocal` set in a framework layer is visible to application code, and vice versa.

### ScopedValue API (Java 21 Preview → Java 23 Standard)

`ScopedValue` is immutable and scoped to a specific dynamic call stack extent. It is bound for a block of code and automatically unbound when that block exits:

```java
// Declare as static final — like a ThreadLocal declaration
static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();
static final ScopedValue<RequestContext> REQUEST_CTX = ScopedValue.newInstance();

// Bind value for the duration of a lambda
ScopedValue.where(CURRENT_USER, authenticatedUser)
           .where(REQUEST_CTX, new RequestContext(requestId))
           .run(() -> handleRequest());   // CURRENT_USER and REQUEST_CTX bound here

// Anywhere in the call stack within handleRequest():
User user = CURRENT_USER.get();  // no argument — always the right value for this VT

// After run() returns, the binding is gone — automatic cleanup
```

### ScopedValue vs ThreadLocal

| Dimension | ThreadLocal | ScopedValue |
|---|---|---|
| Mutability | Mutable (`set()` anytime) | Immutable within its scope (re-bind = new scope) |
| Lifetime | Until `remove()` is called | Tied to the `run()` / `call()` block — automatic |
| Inheritance | `InheritableThreadLocal` copies | Automatically visible to child VTs forked within scope |
| Memory | Entry per thread (can leak) | Bounded by call depth |
| API | `get()` / `set()` / `remove()` | `where().run()` / `get()` |
| Error-prone? | Yes — forgetting `remove()` pollutes thread pool | No — scope boundary is enforced |

### ScopedValue with Structured Concurrency

The combination of structured concurrency and scoped values is where the real power shows. Scoped values are inherited by forked subtasks automatically:

```java
static final ScopedValue<String> TRACE_ID = ScopedValue.newInstance();

ScopedValue.where(TRACE_ID, generateTraceId()).run(() -> {
    try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
        scope.fork(() -> {
            // TRACE_ID is visible here — automatically inherited
            log.info("Fetching user, traceId={}", TRACE_ID.get());
            return fetchUser();
        });
        scope.fork(() -> {
            log.info("Fetching order, traceId={}", TRACE_ID.get());
            return fetchOrder();
        });
        scope.join().throwIfFailed();
    }
});
```

No explicit passing of the trace ID through method parameters. No ThreadLocal pollution. Automatic cleanup.

---

## Performance Characteristics

### When Virtual Threads Help

Virtual threads deliver massive throughput improvements for **I/O-bound workloads** where threads spend most of their time waiting:

- REST/gRPC services calling external APIs
- Database query execution (JDBC with a Loom-compatible driver)
- File I/O
- Services that fan out to multiple downstream services
- Anything that does `Thread.sleep()` (e.g., retry with backoff)

**Mental model for throughput:** With platform threads, throughput ≈ `thread_count / average_latency`. With virtual threads, throughput ≈ `available_memory / stack_size` × `(1 - CPU_utilization)`. For I/O-bound services, the latter is orders of magnitude larger.

**Benchmark mental model:**

```
Platform threads (200 pool):
  200 threads × 50ms service time = 200 / 0.05 = 4,000 RPS
  If each request waits 40ms on DB: CPU busy = 10ms/50ms = 20%
  Wasted: 200 threads × 40ms = 8000ms of carrier capacity per second

Virtual threads (millions possible):
  10,000 concurrent VTs × 50ms service time
  Only 2,000 need CPU at any given moment (20% CPU usage, same as above)
  Throughput ≈ 10,000 / 0.05 = 200,000 RPS (50x improvement)
  Bottleneck is now: DB connection pool, not thread count
```

### When Virtual Threads Do NOT Help

**CPU-bound workloads** get zero benefit from virtual threads. If a task is doing:
- Number crunching (ML inference, image processing, cryptography)
- In-memory sorting or stream operations
- JSON parsing of large payloads
- Complex business logic with no I/O

The virtual thread holds the carrier for the entire duration. With N CPU cores and N carrier threads, you can run N CPU-bound tasks simultaneously — same as N platform threads.

Worse: if you saturate all carrier threads with CPU work, you **starve** other virtual threads that could be doing I/O. For CPU-intensive parallel work, use `ForkJoinPool` or `Executors.newWorkStealingPool()` with properly sized thread counts.

### Connection Pool Sizing

This is the most important operational change when migrating. Pre-Loom, your thread pool size and connection pool size were often the same number (e.g., 200 Tomcat threads → 200 DB connections). With virtual threads:

- Tomcat spins up a VT per request — potentially thousands of concurrent requests
- Each request might want a DB connection
- If your `HikariPool` has `maximumPoolSize=10`, those thousands of VTs will queue for 10 connections

**You must not scale your connection pool to match virtual thread count.** Instead:
1. Keep connection pools sized appropriately for the database server's capacity
2. Virtual threads will naturally queue on the connection pool semaphore — they park without wasting a carrier thread
3. The `maximumPoolSize` in HikariCP / PgBouncer / etc. is now a resource governor, not a throughput limiter

---

## Pinning

### What Is Pinning?

A virtual thread is **pinned** when it cannot unmount from its carrier thread, even during a blocking operation. When a pinned VT blocks, the carrier thread is held hostage — defeating the purpose of virtual threads.

Pinning happens in two scenarios:

**1. Inside a `synchronized` block or method:**
```java
// This pins the virtual thread to its carrier during the sleep
synchronized (lock) {
    Thread.sleep(1000);  // VT is PINNED — carrier held for 1 second
}
```

**2. During JNI / native code execution:**
```java
// Calling native code pins the VT for the duration of the native call
// Nothing to fix — inherent limitation of native interop
nativeLibrary.processData(buffer);  // VT pinned during native execution
```

### Why synchronized Causes Pinning

The JVM's implementation of `synchronized` uses intrinsic locks tied to OS-level monitor primitives. When a virtual thread enters a `synchronized` block, the JVM cannot safely unmount it because the monitor state is bound to the OS thread identity. If the JVM unmounted the VT and remounted it on a different carrier, the lock ownership would be wrong.

This is a **JVM implementation limitation, not a design choice**. The JDK team is working on fixing `synchronized` to work without pinning (tracked in JEP 491, released in Java 24 — `synchronized` no longer pins in Java 24+). But in Java 21/22/23, pinning via `synchronized` is real and you must handle it.

### Detecting Pinning

Enable the JVM flag to log pinning events:

```bash
# Print stack trace whenever a VT is pinned
-Djdk.tracePinnedThreads=full

# Print just a line (less verbose)
-Djdk.tracePinnedThreads=short
```

Output example:
```
Thread[#24,ForkJoinPool-1-worker-1,5,CarrierThreads]
    com.example.UserService.loadUser(UserService.java:42) <== monitors:1
    com.example.CacheService.get(CacheService.java:78)
```

JFR (Java Flight Recorder) events:
```
jdk.VirtualThreadPinned  -- emitted when a VT is pinned for > 20ms (threshold configurable)
```

### Fixing Pinning: ReentrantLock

Replace `synchronized` with `ReentrantLock` (or `ReadWriteLock`). `ReentrantLock` uses `LockSupport.park()` internally, which the JVM intercepts to unmount the VT:

```java
// BEFORE: pins the carrier during blocking I/O inside the lock
private final Object lock = new Object();

public String getCachedValue(String key) {
    synchronized (lock) {
        if (!cache.containsKey(key)) {
            String value = fetchFromDatabase(key);  // I/O — VT PINNED
            cache.put(key, value);
        }
        return cache.get(key);
    }
}

// AFTER: VT can unmount during fetchFromDatabase()
private final ReentrantLock lock = new ReentrantLock();

public String getCachedValue(String key) {
    lock.lock();
    try {
        if (!cache.containsKey(key)) {
            String value = fetchFromDatabase(key);  // I/O — VT can unmount
            cache.put(key, value);
        }
        return cache.get(key);
    } finally {
        lock.unlock();
    }
}
```

### Pinning Decision Matrix

| Scenario | Pinned? | Action |
|---|---|---|
| `synchronized` + no blocking inside | No performance issue | Fine as-is unless throughput is critical |
| `synchronized` + I/O or `sleep()` inside | **PINNED — problem** | Replace with `ReentrantLock` |
| `synchronized` + short CPU computation | Minimal pinning duration | Usually fine |
| JNI / native call | **PINNED — inherent** | No fix; size carrier pool accordingly |
| `ReentrantLock` + I/O | Not pinned | Preferred pattern |
| `synchronized` in Java 24+ | Not pinned | JEP 491 fixes this |

### The Compensation Mechanism

When a VT is pinned and would block, the JVM temporarily spawns an extra carrier thread to compensate, up to `jdk.virtualThreadScheduler.maxPoolSize` (default 256). This prevents full deadlock but adds overhead. Persistent pinning at scale will exhaust the compensation pool and cause real starvation.

---

## Migration Guide

### Identifying Migration Candidates

The biggest wins come from services that are:
1. I/O-bound (DB calls, external API calls, file reads)
2. Currently using a fixed thread pool (`newFixedThreadPool`, Tomcat threads)
3. NOT using reactive programming (or using it reluctantly just for throughput)
4. Using Spring MVC or standard Jakarta EE servlets

**Not worth migrating immediately:**
- Services already using Spring WebFlux/Reactor (already efficient)
- CPU-bound batch processing
- Services with heavy JNI usage

### Spring Boot Integration

Spring Boot 3.2+ includes first-class virtual thread support:

```yaml
# application.yml
spring:
  threads:
    virtual:
      enabled: true
```

This single property switches Tomcat's connector to use virtual threads per request. No code changes required. Spring's `@Async`, `@Scheduled`, and `TaskExecutor` also use virtual threads when enabled.

```java
// Explicit configuration if needed
@Configuration
public class ThreadConfig {
    @Bean
    public TomcatProtocolHandlerCustomizer<?> protocolHandlerVirtualThreadExecutorCustomizer() {
        return protocolHandler -> 
            protocolHandler.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
    }

    @Bean
    public AsyncTaskExecutor asyncTaskExecutor() {
        return new TaskExecutorAdapter(Executors.newVirtualThreadPerTaskExecutor());
    }
}
```

### JDBC and Connection Pools

As of Java 21:
- **HikariCP 5.1.0+**: compatible with virtual threads; connection acquisition parks the VT without pinning
- **PostgreSQL JDBC 42.6+**: virtual-thread compatible
- **MySQL Connector/J 8.2+**: virtual-thread compatible
- **Old synchronized-heavy drivers**: may pin — check with `jdk.tracePinnedThreads`

```java
// HikariCP: size based on DB capacity, not thread count
HikariConfig config = new HikariConfig();
config.setMaximumPoolSize(20);   // NOT 200 — this is a DB limit, not a throughput limit
config.setMinimumIdle(5);
DataSource ds = new HikariDataSource(config);
```

### Thread Pool Replacement Patterns

```java
// BEFORE: fixed pool to limit resource usage
ExecutorService executor = Executors.newFixedThreadPool(100);

// AFTER: virtual threads — drop-in replacement for I/O-bound work
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

// BEFORE: cached pool for burst handling
ExecutorService executor = Executors.newCachedThreadPool();

// AFTER: same drop-in (VT is naturally elastic)
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

// DO NOT REPLACE for CPU-bound:
ExecutorService cpuWork = Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors());
// Keep this as-is. Virtual threads do NOT help here.
```

### What NOT to Do After Migration

**1. Do not pool virtual threads:**
```java
// WRONG — defeats the purpose
ExecutorService pool = new ThreadPoolExecutor(
    100, 100, 0, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>(),
    Thread.ofVirtual().factory()   // VT factory but with pooling — anti-pattern
);

// RIGHT — let VTs be created and GCed per task
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
```

**2. Do not set priorities on virtual threads:**
Virtual thread priority is ignored by the JVM scheduler. Calling `setPriority()` on a VT has no effect.

**3. Do not use virtual threads as carrier thread competitors for CPU work:**
```java
// WRONG for CPU-intensive task
IntStream.range(0, 1_000_000)
    .parallel()  // uses ForkJoinPool common pool — this is correct
    .map(i -> expensiveCompute(i))
    .sum();

// Do not replace .parallel() stream execution with virtual threads
```

**4. ThreadLocal cleanup:**
Virtual threads are created and discarded per task. `ThreadLocal.remove()` is less critical than with pooled threads (GC handles it), but frameworks that assume `ThreadLocal` cleanup still need updating.

### Testing and Verification

```java
@Test
void verifyVirtualThreadUsed() throws Exception {
    AtomicReference<Boolean> wasVirtual = new AtomicReference<>();
    
    try (ExecutorService exec = Executors.newVirtualThreadPerTaskExecutor()) {
        exec.submit(() -> wasVirtual.set(Thread.currentThread().isVirtual()))
            .get();
    }
    
    assertTrue(wasVirtual.get(), "Task should run on a virtual thread");
}
```

---

## Real Interview Q&A

### 15 Most-Asked Virtual Threads Questions

??? question "Q1: What is the difference between a virtual thread and a platform thread?"

    **Answer:** A platform thread is a 1:1 wrapper around an OS thread — created via syscall, scheduled by the kernel, with a fixed native-memory stack (~1MB). A virtual thread is a JVM-managed entity scheduled by a `ForkJoinPool` of carrier threads, with a heap-allocated stack that starts at ~1KB and grows dynamically. Virtual threads mount onto carrier threads when runnable and unmount when blocked — the carrier thread is freed to run other virtual threads during blocking I/O. You can create millions of virtual threads; platform threads are limited to ~10K–20K by memory.

    **Gotcha interviewers love:** "If a virtual thread is CPU-bound, does it still unmount?" No — it holds the carrier for the full duration, same as a platform thread. Virtual threads only help for blocking I/O, not for CPU utilization.

??? question "Q2: What is pinning in the context of virtual threads and how do you fix it?"

    **Answer:** Pinning is when a virtual thread cannot unmount from its carrier thread even during a blocking operation, because it is inside a `synchronized` block or executing JNI code. The carrier thread is held blocked, reducing throughput. Fix: replace `synchronized` with `ReentrantLock`. Detect pinning with `-Djdk.tracePinnedThreads=full` or via the `jdk.VirtualThreadPinned` JFR event. Note: Java 24 (JEP 491) fixes `synchronized` so it no longer causes pinning.

??? question "Q3: Why should you not pool virtual threads?"

    **Answer:** Virtual threads are designed to be created and discarded per task. Pooling them defeats two key benefits: (1) you prevent GC of completed thread stacks, wasting heap; (2) pooling assumes thread reuse has a cost worth amortizing — for VTs, creation is ~microseconds and there is nothing to amortize. Additionally, pooling VTs can reintroduce `ThreadLocal` pollution bugs that pooled platform threads had. The correct pattern is `Executors.newVirtualThreadPerTaskExecutor()` which creates one VT per submitted task.

??? question "Q4: What is structured concurrency and what problem does it solve?"

    **Answer:** Structured concurrency is the principle that the lifetime of a subtask must be bounded by the lifetime of the scope that created it. It is implemented in Java via `StructuredTaskScope`. The problem it solves: in unstructured concurrency (raw futures), a parent task can complete or fail while its subtasks keep running — leaking threads and leaving work in undefined states. With `StructuredTaskScope`, calling `join()` guarantees all forked subtasks have completed (or been cancelled) before the scope exits. Error propagation is explicit: `ShutdownOnFailure` cancels all siblings on first failure; `ShutdownOnSuccess` returns on first success. Debugging is also better — thread dumps show the full parent→child task tree.

??? question "Q5: What is the difference between ShutdownOnFailure and ShutdownOnSuccess?"

    **Answer:** Both are built-in `StructuredTaskScope` shutdown policies. `ShutdownOnFailure` calls `scope.shutdown()` as soon as any subtask fails — all remaining forked tasks receive interrupts and the scope exits with the exception available via `throwIfFailed()`. Use it when you need ALL tasks to succeed (e.g., fan-out to multiple dependencies). `ShutdownOnSuccess` calls `scope.shutdown()` as soon as any subtask succeeds — use it for hedged requests or competitive execution where the first response wins (e.g., query primary and replica simultaneously, return whichever answers first).

??? question "Q6: What are Scoped Values and how are they different from ThreadLocal?"

    **Answer:** `ScopedValue` is an immutable, bounded alternative to `ThreadLocal`. Where `ThreadLocal` is mutable (any code can call `set()`) and persists until `remove()` is called, `ScopedValue` is bound via `ScopedValue.where(VALUE, data).run(...)` and automatically unbound when the `run()` block exits — no cleanup needed. Scoped values are automatically visible to virtual threads forked within the scope (structured inheritance). They are also cheaper: no per-thread map entry to maintain; the binding is in the call stack. The immutability makes them safer in deep call stacks — no accidental clobbering from a utility method.

??? question "Q7: Can virtual threads improve performance for CPU-bound tasks?"

    **Answer:** No. Virtual threads only help when threads are blocked waiting for I/O. A CPU-bound virtual thread holds its carrier thread for the full duration of computation. With N CPU cores and N carrier threads, N CPU-bound VTs saturate all carriers and starve I/O-bound VTs from making progress. For CPU-bound parallelism, use `ForkJoinPool`, parallel streams, or a fixed thread pool sized to CPU core count. Virtual threads are an I/O concurrency mechanism, not a CPU parallelism mechanism.

??? question "Q8: How does Thread.sleep() behave differently for virtual threads?"

    **Answer:** In a platform thread, `Thread.sleep(1000)` blocks the OS thread for 1 second — the thread is unavailable to the scheduler. In a virtual thread, `Thread.sleep(1000)` causes the JVM to unmount the VT from its carrier thread and schedule a wake-up via a timer. The carrier thread is immediately free to run other virtual threads. This means sleeping millions of virtual threads concurrently costs nothing more than heap space for their stacks — no wasted OS threads. This makes virtual threads practical for things like retry-with-backoff implemented with plain `Thread.sleep()`.

??? question "Q9: What changes do you need to make to migrate a Spring MVC application to use virtual threads?"

    **Answer:** In Spring Boot 3.2+, add `spring.threads.virtual.enabled=true` to `application.yml`. That is the minimum change — Spring configures Tomcat to use a virtual thread per request. Additional considerations: check for `synchronized` blocks with I/O inside and replace with `ReentrantLock`; resize connection pools (keep them small — sized to DB capacity, not concurrency level); check `ThreadLocal` usage for correctness (not a correctness bug, but a potential memory efficiency issue); verify JDBC driver compatibility. Do not change anything reactive or CPU-bound — those are already efficient.

??? question "Q10: How many virtual threads can you create?"

    **Answer:** Practically limited by available heap memory. A virtual thread's stack starts at ~1KB and grows on demand. With 2GB heap dedicated to stacks, you could have ~2 million minimally-stacked VTs, though realistic stacks for non-trivial work average more. The JVM can handle millions of VTs — JDK benchmarks show 1M+ concurrent virtual threads without issues. The practical limit in production is usually the downstream resource: DB connection pool, rate limits on external APIs, or network bandwidth — not the VT count itself.

??? question "Q11: What happens when a carrier thread pool is exhausted? (What is the compensation mechanism?)"

    **Answer:** When all carrier threads are occupied with pinned virtual threads (inside `synchronized` or JNI), the JVM temporarily exceeds the normal carrier pool size to prevent full starvation. It spawns additional "compensating" platform threads up to `jdk.virtualThreadScheduler.maxPoolSize` (default 256). This keeps the system alive but at reduced efficiency. If pinning is severe enough to exhaust even the compensation pool, virtual threads queue waiting for a carrier — equivalent to thread starvation in old pool-based systems. This is why eliminating pinning is important for high-throughput services.

??? question "Q12: How do you name virtual threads for debugging?"

    **Answer:** Use `Thread.ofVirtual().name("prefix-", 0).start(task)` for sequentially-numbered threads, or `.name("specific-name")` for a fixed name. Virtual threads created by `newVirtualThreadPerTaskExecutor()` get auto-generated names like `virtual-thread-N`. In thread dumps (via `jcmd`, `jstack`, or JFR), virtual threads appear with their names and the full stack trace. You can take virtual thread dumps with `jcmd <pid> Thread.dump_to_file -format=json <file>` — this serializes all VTs, including parked ones, which would have been invisible with platform threads.

??? question "Q13: Is ThreadLocal safe to use with virtual threads?"

    **Answer:** `ThreadLocal` works correctly with virtual threads — each VT has its own `ThreadLocal` map. The correctness concern is only when code assumes `ThreadLocal` values are preserved across a blocking call that might cause a carrier switch — but the VT identity does not change across mount/unmount cycles, only the carrier does. `ThreadLocal` is still bound to the *virtual* thread, not the carrier. The concerns are: (1) memory: per-VT `ThreadLocal` maps add overhead when millions of VTs are created; (2) pool interactions: frameworks that `remove()` `ThreadLocal` values at task completion may not do so with VT-per-task executors; (3) `InheritableThreadLocal` copies values on VT creation, which can be expensive at scale. Prefer `ScopedValue` for new code.

??? question "Q14: What is a carrier thread and how many does the JVM create?"

    **Answer:** A carrier thread is a platform thread that executes virtual threads. The JVM maintains a carrier pool implemented as a `ForkJoinPool`. By default, the pool is sized to `Runtime.getRuntime().availableProcessors()` (the number of CPU cores). This makes sense: each CPU core can run one thread at a time, and the carrier pool should match the hardware parallelism. The pool uses FIFO scheduling (not work-stealing) to fairly process runnable virtual threads. You can tune it with `-Djdk.virtualThreadScheduler.parallelism=N`. The maximum (compensation pool) is controlled by `-Djdk.virtualThreadScheduler.maxPoolSize=N` (default 256).

??? question "Q15: How does virtual thread behavior differ when using try-with-resources on ExecutorService?"

    **Answer:** `ExecutorService` was retrofitted in Java 19+ to implement `AutoCloseable`. Calling `close()` (or exiting a try-with-resources block) on an executor is equivalent to calling `shutdown()` followed by `awaitTermination(Long.MAX_VALUE, NANOSECONDS)` — it blocks until all submitted tasks complete. This makes `try (var exec = Executors.newVirtualThreadPerTaskExecutor()) { ... }` a structured idiom: you submit tasks inside the block and the block exit guarantees all tasks have finished. This is less powerful than `StructuredTaskScope` (no built-in cancellation on failure/success), but is a simple and safe replacement for submit + get loops over `Future` lists.

---

## Advanced Topics

### Virtual Thread Thread Dumps

Pre-virtual-threads, a thread dump from `jstack` showed ~200 platform threads. With virtual threads, you might have a million. The JVM provides filtered dumps:

```bash
# All threads including virtual (can be huge)
jcmd <pid> Thread.dump_to_file -format=json /tmp/threads.json

# Just platform (carrier) threads — usually 8-32 entries
jcmd <pid> Thread.print  # omits virtual threads by default in JDK 21

# JFR-based: captures VT scheduling events over time
jcmd <pid> JFR.start name=vt-profile settings=profile duration=30s filename=/tmp/vt.jfr
```

### JFR Events for Virtual Threads

Java Flight Recorder has dedicated virtual thread events:

| JFR Event | Description |
|---|---|
| `jdk.VirtualThreadStart` | VT started |
| `jdk.VirtualThreadEnd` | VT terminated |
| `jdk.VirtualThreadPinned` | VT was pinned (default threshold: 20ms) |
| `jdk.VirtualThreadSubmitFailed` | VT could not be submitted to scheduler |

```java
// Programmatic JFR recording targeting VT events
Configuration config = Configuration.getConfiguration("profile");
try (Recording recording = new Recording(config)) {
    recording.enable("jdk.VirtualThreadPinned").withThreshold(Duration.ofMillis(10));
    recording.start();
    // ... run workload ...
    recording.dump(Path.of("/tmp/recording.jfr"));
}
```

### Virtual Threads and Reactive Frameworks

If you are currently using Spring WebFlux / Reactor / RxJava for throughput, virtual threads do not automatically make these better. Reactive frameworks already achieve high throughput via non-blocking I/O and event loops — the motivation for writing reactive code is gone, not the code itself. Migration options:

1. **New services**: Write them with virtual threads (Spring MVC + `spring.threads.virtual.enabled=true`) instead of WebFlux
2. **Existing reactive services**: Leave them as-is if they are working well; rewriting for the sake of it is not justified
3. **Mixed**: Virtual threads and reactive can coexist; do not mix paradigms in the same service

### Project Loom Feature Timeline

| Feature | Preview | Standard |
|---|---|---|
| Virtual Threads | Java 19 (JEP 425) | **Java 21 (JEP 444)** |
| Structured Concurrency | Java 21 (JEP 453) | Java 23 (JEP 480) |
| Scoped Values | Java 21 (JEP 446) | Java 23 (JEP 481) |
| `synchronized` no-pin | — | **Java 24 (JEP 491)** |

### Locking Strategies at Scale

With millions of virtual threads, lock contention becomes the new bottleneck. Strategies:

```java
// 1. Striped locks — reduce contention by sharding the lock space
Striped<ReentrantLock> striped = Striped.lock(1024);
ReentrantLock lock = striped.get(key);
lock.lock();
try { /* ... */ } finally { lock.unlock(); }

// 2. Compare-and-swap for simple counters
AtomicLong counter = new AtomicLong();
counter.incrementAndGet();

// 3. Semaphore to limit concurrency on a resource
Semaphore dbSemaphore = new Semaphore(20);  // max 20 concurrent DB ops
dbSemaphore.acquire();   // VT parks here if limit reached (does NOT pin)
try { /* DB work */ } finally { dbSemaphore.release(); }
```

A `Semaphore.acquire()` uses `LockSupport.park()` internally, so the VT unmounts while waiting — this is the correct way to rate-limit VT concurrency without wasting carrier threads.

---

## Quick Reference

### Creation Cheatsheet

```java
// Single VT
Thread.startVirtualThread(() -> task());

// Builder with options
Thread.ofVirtual().name("worker").start(() -> task());

// Executor (preferred for task submission)
ExecutorService exec = Executors.newVirtualThreadPerTaskExecutor();

// Check if current thread is virtual
Thread.currentThread().isVirtual()

// Custom thread factory (for frameworks that accept ThreadFactory)
ThreadFactory vtFactory = Thread.ofVirtual().name("app-vt-", 0).factory();
```

### Structured Concurrency Cheatsheet

```java
// Fan-out, fail fast
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    var t1 = scope.fork(task1);
    var t2 = scope.fork(task2);
    scope.join().throwIfFailed();
    use(t1.get(), t2.get());
}

// Competitive / hedged
try (var scope = new StructuredTaskScope.ShutdownOnSuccess<R>()) {
    scope.fork(primary);
    scope.fork(fallback);
    R result = scope.join().result();
}
```

### Common Pitfalls Summary

| Pitfall | Consequence | Fix |
|---|---|---|
| `synchronized` + I/O inside | Pinning — carrier thread blocked | Replace with `ReentrantLock` |
| Pooling virtual threads | Anti-pattern, nullifies benefits | Use `newVirtualThreadPerTaskExecutor()` |
| Large connection pool | Overwhelms database | Size pool to DB capacity, not VT count |
| CPU-bound work on VTs | Starves I/O VTs | Use `ForkJoinPool` or fixed CPU thread pool |
| Ignoring pinning in JNI-heavy code | Carrier starvation | Size `maxPoolSize` appropriately |
| Using VTs with reactive stack | No benefit, added confusion | Pick one paradigm per service |
| Not testing with `isVirtual()` | Silently running on platform threads | Add assertions in tests |
