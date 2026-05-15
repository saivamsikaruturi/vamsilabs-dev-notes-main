# Top 40 Java Multithreading & Concurrency Interview Questions

A comprehensive Q&A covering threads, synchronization, locks, executors, concurrent collections, and modern concurrency features through Java 21. Each answer is concise and interview-ready.

---

## Fundamentals

??? question "Q1: What is the difference between a Thread and a Process?"

    **Answer:** A **process** is an independent program with its own address space. A **thread** is the smallest unit of execution within a process and shares the process's heap memory.

    | Aspect | Process | Thread |
    |---|---|---|
    | Memory | Separate address space | Shares heap, owns its stack |
    | Creation cost | Heavy (OS-level) | Lightweight (JVM-managed) |
    | Communication | IPC (pipes, sockets) | Shared memory directly |
    | Crash isolation | Independent | Can crash the whole process |
    | Context switch | Slow | Fast |

    In Java, every `main()` runs inside a process, and you spawn threads within it.

??? question "Q2: What are the three ways to create a thread in Java?"

    **Answer:**

    **1. Extend `Thread`:**
    ```java
    class MyThread extends Thread {
        public void run() { System.out.println("Running"); }
    }
    new MyThread().start();
    ```

    **2. Implement `Runnable` (preferred -- allows extending another class):**
    ```java
    Runnable task = () -> System.out.println("Running");
    new Thread(task).start();
    ```

    **3. Implement `Callable<V>` (returns a result, can throw checked exceptions):**
    ```java
    Callable<Integer> task = () -> 42;
    Future<Integer> future = Executors.newSingleThreadExecutor().submit(task);
    System.out.println(future.get()); // 42
    ```

    Prefer `Runnable`/`Callable` with `ExecutorService` over raw `Thread` in production code.

??? question "Q3: What are the states in a thread's lifecycle?"

    **Answer:** A Java thread goes through six states defined in `Thread.State`:

    ```
    NEW --> RUNNABLE --> (BLOCKED | WAITING | TIMED_WAITING) --> RUNNABLE --> TERMINATED
    ```

    | State | Trigger |
    |---|---|
    | `NEW` | Thread created, `start()` not yet called |
    | `RUNNABLE` | `start()` called; thread is running or ready to run |
    | `BLOCKED` | Waiting to acquire a monitor lock |
    | `WAITING` | `wait()`, `join()`, or `LockSupport.park()` |
    | `TIMED_WAITING` | `sleep(ms)`, `wait(ms)`, `join(ms)` |
    | `TERMINATED` | `run()` completed or exception thrown |

??? question "Q4: What happens if you call run() instead of start()?"

    **Answer:** Calling `run()` directly executes the method **on the current thread** -- no new thread is created. Calling `start()` allocates a new OS thread and then invokes `run()` on that thread. Calling `start()` twice on the same `Thread` object throws `IllegalThreadStateException`.

    ```java
    Thread t = new Thread(() -> System.out.println(Thread.currentThread().getName()));
    t.run();   // prints "main" -- runs on caller thread
    t.start(); // prints "Thread-0" -- runs on new thread
    ```

??? question "Q5: Explain sleep(), wait(), and yield()."

    **Answer:**

    | Method | Lock released? | Resumes when | Class |
    |---|---|---|---|
    | `sleep(ms)` | No | Timeout expires or interrupted | `Thread` |
    | `wait()` | Yes (must hold monitor) | `notify()`/`notifyAll()` or interrupted | `Object` |
    | `yield()` | No | Scheduler decides (hint only) | `Thread` |

    `wait()` **must** be called inside a `synchronized` block; `sleep()` can be called anywhere. `yield()` is a hint to the scheduler that the current thread is willing to give up its time slice -- the scheduler is free to ignore it.

??? question "Q6: What does the join() method do?"

    **Answer:** `join()` makes the calling thread wait until the target thread finishes. It is the simplest form of inter-thread coordination.

    ```java
    Thread t = new Thread(() -> {
        // long computation
    });
    t.start();
    t.join();  // current thread blocks until t finishes
    System.out.println("t is done");
    ```

    Overloaded variants `join(long millis)` and `join(long millis, int nanos)` let you specify a maximum wait time.

??? question "Q7: What is a Daemon thread?"

    **Answer:** A daemon thread is a background service thread (e.g., GC, finalizer). The JVM exits when **only** daemon threads remain -- it does not wait for them to finish. Set before `start()`:

    ```java
    Thread t = new Thread(() -> { /* background work */ });
    t.setDaemon(true);
    t.start();
    ```

    User threads (non-daemon) keep the JVM alive. Use daemon threads for housekeeping tasks that should not prevent shutdown.

??? question "Q8: How does thread priority work in Java?"

    **Answer:** Priorities range from `Thread.MIN_PRIORITY` (1) to `Thread.MAX_PRIORITY` (10), with `NORM_PRIORITY` (5) as default. Priorities are **hints** to the OS scheduler -- they do not guarantee execution order. Some platforms ignore them entirely.

    ```java
    Thread t = new Thread(task);
    t.setPriority(Thread.MAX_PRIORITY);
    t.start();
    ```

    Never rely on priorities for correctness; use proper synchronization instead.

---

## Synchronization & Locking

??? question "Q9: What is the synchronized keyword and how is it used?"

    **Answer:** `synchronized` provides mutual exclusion by acquiring a **monitor lock** (intrinsic lock).

    **Synchronized method** -- locks `this` (instance method) or `Class` object (static method):
    ```java
    public synchronized void increment() { count++; }
    public static synchronized void staticMethod() { /* class-level lock */ }
    ```

    **Synchronized block** -- more granular, locks a specific object:
    ```java
    public void increment() {
        synchronized (this) {
            count++;
        }
    }
    ```

    Prefer synchronized blocks over methods for finer-grained locking and better performance.

??? question "Q10: What is the difference between object-level and class-level locking?"

    **Answer:**

    - **Object-level lock:** Each instance has its own lock. Two threads can enter the same `synchronized` instance method on **different** objects concurrently.
    - **Class-level lock:** Uses the `Class<?>` object as the monitor. Only one thread can hold it regardless of the number of instances.

    ```java
    // Object-level
    synchronized (this) { /* per-instance */ }

    // Class-level
    synchronized (MyClass.class) { /* one thread across all instances */ }
    // OR
    public static synchronized void method() { /* same effect */ }
    ```

??? question "Q11: What is reentrant locking?"

    **Answer:** Java's intrinsic locks are **reentrant** -- if a thread already holds a lock, it can re-acquire it without blocking. A hold count tracks nested acquisitions.

    ```java
    public synchronized void outer() {
        inner(); // same thread can enter -- reentrant
    }
    public synchronized void inner() {
        // already holds the lock on 'this'
    }
    ```

    `ReentrantLock` is the explicit equivalent with the same behavior. Without reentrancy, a thread calling a synchronized method from another synchronized method on the same object would deadlock on itself.

??? question "Q12: What causes a deadlock and how do you prevent it?"

    **Answer:** Deadlock requires **all four** Coffman conditions simultaneously:

    1. **Mutual exclusion** -- resources are non-shareable
    2. **Hold and wait** -- thread holds one lock, waits for another
    3. **No preemption** -- locks cannot be forcibly taken
    4. **Circular wait** -- T1 waits for T2's lock, T2 waits for T1's lock

    **Prevention strategies:**

    - **Lock ordering** -- always acquire locks in a consistent global order
    - **Timeout** -- use `tryLock(timeout)` with `ReentrantLock`
    - **Avoid nested locks** where possible
    - **Use `java.util.concurrent`** utilities instead of manual locking

    ```java
    // Deadlock-prone
    synchronized (lockA) {
        synchronized (lockB) { /* ... */ }
    }
    // Another thread does lockB then lockA --> DEADLOCK

    // Fix: always acquire in the same order (e.g., lockA before lockB)
    ```

    **Detection:** Use `jstack <pid>`, `ThreadMXBean.findDeadlockedThreads()`, or VisualVM.

??? question "Q13: What is the difference between livelock and starvation?"

    **Answer:**

    - **Livelock:** Threads are not blocked but keep responding to each other without making progress -- like two people in a hallway who keep stepping aside in the same direction.
    - **Starvation:** A thread is perpetually denied access to a resource because other (often higher-priority) threads keep acquiring it.

    Livelock: threads are active but unproductive. Starvation: a thread never gets scheduled. Both are liveness failures.

---

## Memory Model & Atomics

??? question "Q14: What does the volatile keyword do?"

    **Answer:** `volatile` ensures **visibility** and **ordering** for a variable:

    1. **Visibility** -- writes by one thread are immediately visible to all other threads (no CPU cache staleness).
    2. **Ordering** -- prevents instruction reordering around volatile reads/writes.

    ```java
    private volatile boolean running = true;

    // Writer thread
    running = false;

    // Reader thread -- guaranteed to see the updated value
    while (running) { /* spin */ }
    ```

    `volatile` does **not** provide atomicity for compound operations like `count++`. For that, use `AtomicInteger` or `synchronized`.

??? question "Q15: What is the happens-before relationship?"

    **Answer:** The Java Memory Model (JMM) defines **happens-before** as a guarantee that memory writes by one action are visible to another. Key rules:

    - **Program order:** Each action in a thread happens-before the next action in that thread.
    - **Monitor lock:** An unlock happens-before every subsequent lock on the same monitor.
    - **Volatile:** A write to a volatile field happens-before every subsequent read of that field.
    - **Thread start:** `t.start()` happens-before any action in thread `t`.
    - **Thread join:** All actions in thread `t` happen-before `t.join()` returns.

    Without a happens-before relationship, the JVM and CPU are free to reorder operations, leading to visibility bugs.

??? question "Q16: How does AtomicInteger work (CAS)?"

    **Answer:** `AtomicInteger` uses **Compare-And-Swap (CAS)** -- a lock-free CPU instruction that atomically updates a value only if it still matches the expected value.

    ```java
    AtomicInteger counter = new AtomicInteger(0);
    counter.incrementAndGet(); // atomic, lock-free

    // Under the hood (simplified):
    // do {
    //     int expected = current;
    //     int updated = expected + 1;
    // } while (!compareAndSwap(expected, updated));
    ```

    CAS avoids the overhead of locking but can cause **spinning** under high contention. For extreme contention, use `LongAdder` which distributes updates across cells to reduce CAS collisions.

??? question "Q17: What is ThreadLocal and when would you use it?"

    **Answer:** `ThreadLocal` gives each thread its own copy of a variable, eliminating the need for synchronization.

    ```java
    private static final ThreadLocal<SimpleDateFormat> dateFormat =
        ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

    // Each thread gets its own SimpleDateFormat instance
    String date = dateFormat.get().format(new Date());
    ```

    **Common uses:** per-thread database connections, user session context, request-scoped data in web apps.

    **Caution:** Always call `remove()` when done (especially with thread pools) to avoid memory leaks.

---

## Executors & Thread Pools

??? question "Q18: What is ExecutorService and why use it over raw threads?"

    **Answer:** `ExecutorService` decouples task submission from thread management. Benefits: thread reuse, bounded concurrency, lifecycle management.

    ```java
    ExecutorService executor = Executors.newFixedThreadPool(4);
    executor.submit(() -> System.out.println("Task 1"));
    executor.submit(() -> System.out.println("Task 2"));
    executor.shutdown(); // graceful shutdown -- no new tasks accepted
    executor.awaitTermination(60, TimeUnit.SECONDS);
    ```

    | Factory method | Pool behavior |
    |---|---|
    | `newFixedThreadPool(n)` | Fixed n threads, unbounded queue |
    | `newCachedThreadPool()` | Creates threads on demand, reuses idle ones |
    | `newSingleThreadExecutor()` | Single thread, tasks execute sequentially |
    | `newScheduledThreadPool(n)` | Supports delayed/periodic execution |

??? question "Q19: What is the difference between Callable and Runnable?"

    **Answer:**

    | Feature | `Runnable` | `Callable<V>` |
    |---|---|---|
    | Return value | `void` | `V` |
    | Checked exceptions | Cannot throw | Can throw |
    | Method | `run()` | `call()` |
    | Submit via | `execute()` or `submit()` | `submit()` only |

    ```java
    Callable<String> callable = () -> {
        if (error) throw new IOException("fail");
        return "result";
    };
    Future<String> f = executor.submit(callable);
    String result = f.get(); // blocks until done, may throw ExecutionException
    ```

??? question "Q20: What is the difference between Future and CompletableFuture?"

    **Answer:**

    `Future` is a basic handle: `get()` blocks, no chaining, no manual completion.

    `CompletableFuture` adds **async composition**, **non-blocking callbacks**, and **manual completion**:

    ```java
    // Future -- blocking
    Future<String> f = executor.submit(() -> fetchData());
    String result = f.get(); // blocks

    // CompletableFuture -- non-blocking, composable
    CompletableFuture.supplyAsync(() -> fetchData())
        .thenApply(data -> transform(data))
        .thenAccept(result -> save(result))
        .exceptionally(ex -> { log(ex); return null; });
    ```

    `CompletableFuture` implements both `Future` and `CompletionStage`.

??? question "Q21: Explain the key ThreadPoolExecutor constructor parameters."

    **Answer:**

    ```java
    new ThreadPoolExecutor(
        corePoolSize,     // threads kept alive even when idle
        maximumPoolSize,  // max threads when queue is full
        keepAliveTime,    // idle time before non-core threads die
        TimeUnit.SECONDS,
        workQueue,        // queue for holding waiting tasks
        threadFactory,    // custom thread creation
        rejectionHandler  // policy when queue and pool are full
    );
    ```

    **Task submission flow:**

    1. If threads < `corePoolSize` --> create a new thread
    2. If core is full --> add to `workQueue`
    3. If queue is full and threads < `maximumPoolSize` --> create new thread
    4. If both full --> `RejectedExecutionHandler` kicks in

    **Rejection policies:** `AbortPolicy` (default, throws), `CallerRunsPolicy` (caller thread executes), `DiscardPolicy`, `DiscardOldestPolicy`.

---

## Concurrency Utilities

??? question "Q22: What is the difference between CountDownLatch and CyclicBarrier?"

    **Answer:**

    | Feature | `CountDownLatch` | `CyclicBarrier` |
    |---|---|---|
    | Reusable | No (one-shot) | Yes (resets after each barrier) |
    | Who waits | One or more threads call `await()` | All participating threads call `await()` |
    | Count changed by | Any thread calls `countDown()` | A thread reaching the barrier |
    | Use case | "Wait for N events to complete" | "Wait until all N threads arrive" |

    ```java
    // CountDownLatch -- main waits for 3 workers
    CountDownLatch latch = new CountDownLatch(3);
    for (int i = 0; i < 3; i++) {
        executor.submit(() -> { doWork(); latch.countDown(); });
    }
    latch.await(); // blocks until count reaches 0

    // CyclicBarrier -- all threads wait for each other
    CyclicBarrier barrier = new CyclicBarrier(3, () -> System.out.println("All arrived"));
    for (int i = 0; i < 3; i++) {
        executor.submit(() -> { prepare(); barrier.await(); proceed(); });
    }
    ```

??? question "Q23: How does Semaphore work?"

    **Answer:** A `Semaphore` controls access to a resource by maintaining a set of **permits**. Threads acquire permits before accessing the resource and release them afterward.

    ```java
    Semaphore semaphore = new Semaphore(3); // max 3 concurrent accesses

    semaphore.acquire(); // blocks if no permits available
    try {
        accessSharedResource();
    } finally {
        semaphore.release();
    }
    ```

    - `Semaphore(1)` acts as a **mutual exclusion lock** (but non-reentrant).
    - Use `fairness = true` in the constructor to prevent starvation.
    - Common use: connection pools, rate limiting.

??? question "Q24: ReentrantLock vs synchronized -- when to use which?"

    **Answer:**

    | Feature | `synchronized` | `ReentrantLock` |
    |---|---|---|
    | Lock acquisition | Implicit (block/method) | Explicit `lock()`/`unlock()` |
    | Try lock | Not possible | `tryLock()` / `tryLock(timeout)` |
    | Interruptible | No | `lockInterruptibly()` |
    | Fairness | No (always unfair) | Optional fair ordering |
    | Multiple conditions | One wait-set per monitor | Multiple `Condition` objects |
    | Performance | Similar in modern JVMs | Similar |

    ```java
    ReentrantLock lock = new ReentrantLock(true); // fair lock
    Condition notEmpty = lock.newCondition();

    lock.lock();
    try {
        while (queue.isEmpty()) notEmpty.await();
        return queue.poll();
    } finally {
        lock.unlock(); // MUST be in finally
    }
    ```

    **Rule of thumb:** Use `synchronized` for simple cases. Use `ReentrantLock` when you need `tryLock`, interruptibility, fairness, or multiple conditions.

??? question "Q25: What is ReadWriteLock?"

    **Answer:** `ReadWriteLock` separates read and write access. Multiple readers can hold the read lock simultaneously, but a writer needs exclusive access.

    ```java
    ReadWriteLock rwLock = new ReentrantReadWriteLock();

    // Read -- many threads can hold this concurrently
    rwLock.readLock().lock();
    try { return map.get(key); }
    finally { rwLock.readLock().unlock(); }

    // Write -- exclusive access
    rwLock.writeLock().lock();
    try { map.put(key, value); }
    finally { rwLock.writeLock().unlock(); }
    ```

    Ideal for read-heavy workloads (caches, configuration). Writers are blocked while readers hold the lock and vice versa.

??? question "Q26: What is StampedLock and how does it improve over ReadWriteLock?"

    **Answer:** `StampedLock` (Java 8+) adds an **optimistic read** mode that does not block writers, boosting throughput under low-contention reads.

    ```java
    StampedLock sl = new StampedLock();

    // Optimistic read -- no lock acquired, very cheap
    long stamp = sl.tryOptimisticRead();
    double x = this.x, y = this.y;
    if (!sl.validate(stamp)) {
        // Someone wrote -- fall back to full read lock
        stamp = sl.readLock();
        try { x = this.x; y = this.y; }
        finally { sl.unlockRead(stamp); }
    }

    // Write lock
    long ws = sl.writeLock();
    try { this.x = newX; this.y = newY; }
    finally { sl.unlockWrite(ws); }
    ```

    **Key differences from `ReadWriteLock`:** not reentrant, supports lock conversion, optimistic reads avoid reader starvation of writers.

??? question "Q27: How does ForkJoinPool and work-stealing work?"

    **Answer:** `ForkJoinPool` is designed for **divide-and-conquer** parallelism. Each worker thread has a **deque**. When a thread finishes its tasks, it **steals** tasks from another thread's deque tail, keeping all CPUs busy.

    ```java
    class SumTask extends RecursiveTask<Long> {
        private final int[] arr;
        private final int lo, hi;

        protected Long compute() {
            if (hi - lo <= THRESHOLD) {
                long sum = 0;
                for (int i = lo; i < hi; i++) sum += arr[i];
                return sum;
            }
            int mid = (lo + hi) / 2;
            SumTask left = new SumTask(arr, lo, mid);
            SumTask right = new SumTask(arr, mid, hi);
            left.fork();  // submit to pool
            return right.compute() + left.join(); // join result
        }
    }
    ```

    `ForkJoinPool.commonPool()` is used by parallel streams and `CompletableFuture` by default.

??? question "Q28: Implement Producer-Consumer using BlockingQueue."

    **Answer:**

    ```java
    BlockingQueue<String> queue = new LinkedBlockingQueue<>(10);

    // Producer
    Runnable producer = () -> {
        try {
            while (true) {
                String item = produce();
                queue.put(item); // blocks if queue is full
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    };

    // Consumer
    Runnable consumer = () -> {
        try {
            while (true) {
                String item = queue.take(); // blocks if queue is empty
                consume(item);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    };
    ```

    `BlockingQueue` implementations: `ArrayBlockingQueue` (bounded), `LinkedBlockingQueue` (optionally bounded), `PriorityBlockingQueue` (unbounded, priority-ordered), `SynchronousQueue` (zero capacity, direct handoff).

??? question "Q29: What is a Phaser?"

    **Answer:** `Phaser` is a flexible synchronization barrier that supports a **dynamic number of participants** and **multiple phases**.

    ```java
    Phaser phaser = new Phaser(3); // 3 initial parties

    Runnable task = () -> {
        for (int phase = 0; phase < 3; phase++) {
            doWork(phase);
            phaser.arriveAndAwaitAdvance(); // barrier for each phase
        }
        phaser.arriveAndDeregister(); // leave after all phases
    };
    ```

    Unlike `CyclicBarrier`, parties can register/deregister dynamically. Supports `onAdvance()` override for phase-transition logic. Think of it as a reusable, flexible `CountDownLatch` + `CyclicBarrier` hybrid.

??? question "Q30: What is an Exchanger?"

    **Answer:** `Exchanger<V>` is a synchronization point where two threads can **swap objects**. Each thread calls `exchange(myObject)` and blocks until the other thread arrives.

    ```java
    Exchanger<String> exchanger = new Exchanger<>();

    // Thread 1
    String fromThread2 = exchanger.exchange("data-from-1");

    // Thread 2
    String fromThread1 = exchanger.exchange("data-from-2");
    ```

    Use case: pipeline stages where one thread fills a buffer while the other drains it, then they swap buffers.

---

## Thread Management

??? question "Q31: Explain interrupt(), isInterrupted(), and interrupted()."

    **Answer:**

    | Method | Type | Effect |
    |---|---|---|
    | `t.interrupt()` | Instance | Sets the interrupt flag on thread `t`; if `t` is in `sleep`/`wait`/`join`, throws `InterruptedException` |
    | `t.isInterrupted()` | Instance | Returns the flag value **without clearing** it |
    | `Thread.interrupted()` | Static | Returns and **clears** the flag of the **current** thread |

    ```java
    // Proper interrupt handling
    while (!Thread.currentThread().isInterrupted()) {
        try {
            doWork();
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); // restore flag
            break;
        }
    }
    ```

??? question "Q32: How do you stop a thread gracefully?"

    **Answer:** Never use the deprecated `Thread.stop()`. Use a **volatile flag** or **interrupt**:

    ```java
    // Approach 1: volatile flag
    class Worker implements Runnable {
        private volatile boolean stopped = false;
        public void stop() { stopped = true; }
        public void run() {
            while (!stopped) { doWork(); }
        }
    }

    // Approach 2: interrupt (preferred with blocking calls)
    public void run() {
        while (!Thread.currentThread().isInterrupted()) {
            try {
                doBlockingWork();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        cleanup();
    }
    ```

    `ExecutorService.shutdownNow()` sends interrupts to running tasks. Well-written tasks should check the interrupt flag.

??? question "Q33: How do you implement a thread-safe Singleton?"

    **Answer:** Three safe approaches:

    **1. Double-checked locking (lazy):**
    ```java
    public class Singleton {
        private static volatile Singleton instance;
        private Singleton() {}
        public static Singleton getInstance() {
            if (instance == null) {
                synchronized (Singleton.class) {
                    if (instance == null)
                        instance = new Singleton();
                }
            }
            return instance;
        }
    }
    ```

    **2. Holder pattern (lazy, no synchronization needed):**
    ```java
    public class Singleton {
        private Singleton() {}
        private static class Holder {
            static final Singleton INSTANCE = new Singleton();
        }
        public static Singleton getInstance() { return Holder.INSTANCE; }
    }
    ```

    **3. Enum (safest -- handles serialization and reflection):**
    ```java
    public enum Singleton {
        INSTANCE;
        public void doWork() { /* ... */ }
    }
    ```

    The enum approach is recommended by Effective Java. The holder pattern is the most common in real codebases.

---

## Concurrent Collections

??? question "Q34: ConcurrentHashMap vs synchronized HashMap -- what is the difference?"

    **Answer:**

    | Feature | `Collections.synchronizedMap` | `ConcurrentHashMap` |
    |---|---|---|
    | Locking | Single lock for entire map | Segment/bucket-level locking (Java 8: CAS + synchronized on node) |
    | Read concurrency | Blocks readers | Lock-free reads |
    | Iteration | Fail-fast (throws `ConcurrentModificationException`) | Weakly consistent (no exception) |
    | Null keys/values | Allowed | **Not** allowed |
    | Performance | Poor under contention | Excellent under contention |

    ```java
    ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();
    map.put("key", 1);
    map.compute("key", (k, v) -> v + 1); // atomic compound operation
    map.putIfAbsent("key2", 2);          // atomic check-and-put
    ```

    Always use `compute`, `merge`, `putIfAbsent` for atomic compound operations -- do not use `get` + `put` separately.

??? question "Q35: What is CopyOnWriteArrayList and when should you use it?"

    **Answer:** `CopyOnWriteArrayList` creates a **new copy of the underlying array** on every write (add, set, remove). Reads are lock-free and never block.

    ```java
    CopyOnWriteArrayList<String> list = new CopyOnWriteArrayList<>();
    list.add("a"); // copies entire array
    // Iteration is safe, uses a snapshot
    for (String s : list) { /* no ConcurrentModificationException */ }
    ```

    **Use when:** reads vastly outnumber writes (e.g., listener lists, config registries).
    **Avoid when:** frequent writes -- each write copies the entire array, resulting in O(n) per mutation and high garbage collection pressure.

---

## CompletableFuture Deep Dive

??? question "Q36: Explain thenApply, thenCompose, and thenCombine."

    **Answer:**

    ```java
    CompletableFuture<String> cf = CompletableFuture.supplyAsync(() -> "Hello");

    // thenApply -- transform result (like map)
    CompletableFuture<Integer> length = cf.thenApply(String::length); // 5

    // thenCompose -- chain with another CF (like flatMap), avoids nesting
    CompletableFuture<String> composed = cf.thenCompose(
        s -> CompletableFuture.supplyAsync(() -> s + " World")
    );

    // thenCombine -- combine two independent futures
    CompletableFuture<String> cf2 = CompletableFuture.supplyAsync(() -> " World");
    CompletableFuture<String> combined = cf.thenCombine(cf2, (a, b) -> a + b);
    ```

    | Method | Input | Output | Analogy |
    |---|---|---|---|
    | `thenApply` | `Function<T,U>` | `CF<U>` | `Stream.map()` |
    | `thenCompose` | `Function<T,CF<U>>` | `CF<U>` | `Stream.flatMap()` |
    | `thenCombine` | `CF<U>`, `BiFunction<T,U,V>` | `CF<V>` | zip two futures |

    All have `*Async` variants (e.g., `thenApplyAsync`) that run the callback on a different thread.

---

## Modern Java Concurrency

??? question "Q37: What are Virtual Threads in Java 21?"

    **Answer:** Virtual threads (Project Loom) are **lightweight, JVM-managed threads** that are not tied 1:1 to OS threads. They enable millions of concurrent tasks with minimal memory overhead.

    ```java
    // Create a virtual thread
    Thread.startVirtualThread(() -> {
        // blocking call is cheap -- carrier thread is released
        String result = httpClient.send(request, BodyHandlers.ofString()).body();
    });

    // Using executor (preferred for structured work)
    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        IntStream.range(0, 100_000).forEach(i ->
            executor.submit(() -> {
                Thread.sleep(Duration.ofSeconds(1));
                return i;
            })
        );
    } // auto-shutdown

    // Check if virtual
    Thread.currentThread().isVirtual(); // true
    ```

    **Key points:**

    - Do **not** pool virtual threads -- create one per task
    - Avoid `synchronized` blocks with blocking I/O inside (pin the carrier thread); use `ReentrantLock` instead
    - Ideal for I/O-bound workloads (HTTP servers, DB calls), not CPU-bound computation

??? question "Q38: What is Structured Concurrency (Preview in Java 21)?"

    **Answer:** Structured Concurrency treats concurrent tasks as a unit of work, ensuring all subtasks complete (or are cancelled) before the parent scope exits. It prevents thread leaks and orphaned tasks.

    ```java
    // Java 21 preview API
    try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
        Subtask<String> user  = scope.fork(() -> fetchUser());
        Subtask<Integer> order = scope.fork(() -> fetchOrder());

        scope.join();           // wait for both
        scope.throwIfFailed();  // propagate first exception

        return new Response(user.get(), order.get());
    }
    // If fetchUser() fails, fetchOrder() is automatically cancelled
    ```

    **Benefits:** deterministic cleanup, clear parent-child relationship, no dangling threads, easier reasoning about concurrency.

---

## Race Conditions & Debugging

??? question "Q39: What is the difference between a race condition and a data race?"

    **Answer:**

    - **Race condition:** Program correctness depends on the **timing/ordering** of thread execution. The result is non-deterministic. Can occur even with proper synchronization (logic error).
    - **Data race:** Two threads access the **same memory location** concurrently, at least one is a write, and there is **no happens-before ordering**. This is a JMM violation -- undefined behavior.

    ```java
    // Data race (no synchronization)
    int count = 0;
    // Thread 1: count++
    // Thread 2: count++
    // Result: undefined -- could be 1 or 2

    // Race condition (synchronized but still logically flawed)
    // "check-then-act" on a shared map
    if (!map.containsKey(key)) {   // check
        map.put(key, compute());    // act -- another thread may have inserted between check and act
    }
    // Fix: map.computeIfAbsent(key, k -> compute());
    ```

    All data races are race conditions, but not all race conditions are data races.

??? question "Q40: How do you debug concurrency issues?"

    **Answer:**

    **Detection tools:**

    - **`jstack <pid>`** -- dumps all thread states; shows deadlocks
    - **`ThreadMXBean.findDeadlockedThreads()`** -- programmatic deadlock detection
    - **VisualVM / JConsole** -- visual thread monitoring
    - **`-XX:+PrintConcurrentLocks`** -- JVM flag to include lock info in dumps
    - **Thread sanitizers** -- Google TSan, IntelliJ thread-safety inspections

    **Prevention techniques:**

    - Prefer immutable objects and `final` fields
    - Use `java.util.concurrent` over manual `synchronized`
    - Minimize shared mutable state
    - Use `AtomicReference` / `ConcurrentHashMap` for lock-free patterns
    - Write concurrent unit tests with `CountDownLatch` to control timing
    - Use `@GuardedBy` annotations (from `jcip-annotations`) for documentation

    **Reproducing issues:**

    - Stress testing with many threads
    - `Thread.sleep()` or `Thread.yield()` injections to widen race windows
    - Tools like **jcstress** (OpenJDK concurrency stress testing framework)

    ```java
    // Example: detect deadlocks at runtime
    ThreadMXBean bean = ManagementFactory.getThreadMXBean();
    long[] deadlockedIds = bean.findDeadlockedThreads();
    if (deadlockedIds != null) {
        ThreadInfo[] infos = bean.getThreadInfo(deadlockedIds, true, true);
        for (ThreadInfo info : infos) {
            System.err.println(info);
        }
    }
    ```
