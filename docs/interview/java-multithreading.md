# Top 40 Java Multithreading & Concurrency Interview Questions

A comprehensive Q&A covering threads, synchronization, locks, executors, concurrent collections, and modern concurrency features through Java 21. Each answer is concise and interview-ready.

---

## Fundamentals

??? question "Q1: What is the difference between a Thread and a Process?"

    **Answer:** A thread is the smallest unit of execution within a process -- threads share heap memory while processes have fully isolated address spaces.

    **Why this matters:** The JVM is a single process; all your application logic runs as threads within it. Understanding this boundary tells you what's shared (heap, loaded classes) and what's private (stack, program counter).

    **How it works internally:**

    | Aspect | Process | Thread |
    |---|---|---|
    | Memory | Separate address space | Shares heap, owns its stack |
    | Creation cost | Heavy (OS-level) | Lightweight (JVM-managed) |
    | Communication | IPC (pipes, sockets) | Shared memory directly |
    | Crash isolation | Independent | Can crash the whole process |
    | Context switch | Slow | Fast |

    **When to use:** You use multiple processes for fault isolation (microservices). You use threads when tasks need shared state or you want low-overhead parallelism within the same JVM.

    **Gotchas:** Because threads share heap, one thread corrupting shared state crashes everything -- there is no process-level isolation protecting you. This is why thread safety is non-negotiable.

??? question "Q2: What are the three ways to create a thread in Java?"

    **Answer:** Java offers three approaches: extend `Thread`, implement `Runnable`, or implement `Callable<V>` -- each progressively more flexible.

    **Why multiple options exist:** `Thread` subclassing was the original API, but it burns your single inheritance slot. `Runnable` separates the task from the execution mechanism. `Callable` adds return values and checked exception support.

    **How:**

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

    **When to use:** In production, never use raw `Thread`. Submit `Runnable`/`Callable` to an `ExecutorService`. Use `Callable` when you need a result or need to propagate exceptions to the caller.

    **Gotchas:** Calling `executor.submit(runnable)` swallows exceptions silently -- always check the returned `Future` or use `execute()` with an `UncaughtExceptionHandler`. Also, forgetting to shut down the executor leaks threads.

??? question "Q3: What are the states in a thread's lifecycle?"

    **Answer:** A Java thread transitions through exactly six states defined in `Thread.State` -- knowing these is essential for reading thread dumps.

    **Why this matters:** When debugging production issues (deadlocks, hangs), `jstack` output shows these states. You need to instantly recognize what BLOCKED vs WAITING means to diagnose the problem.

    **How -- the state machine:**

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

    **When to use this knowledge:** Thread dump analysis, monitoring dashboards, detecting thread pool exhaustion (all threads WAITING = pool starvation).

    **Gotchas:** `RUNNABLE` does not mean actually running on a CPU -- it includes threads blocked on I/O (network socket read). Java has no separate "RUNNING" state, so a thread doing a slow HTTP call shows as RUNNABLE even though it is effectively blocked.

??? question "Q4: What happens if you call run() instead of start()?"

    **Answer:** Calling `run()` directly executes the method on the caller's thread -- no new thread is spawned, which completely defeats the purpose.

    **Why this trips people up:** It compiles fine and appears to work in unit tests (since the logic runs), but in production you get zero concurrency. This is one of the most common beginner bugs.

    **How it works internally:** `start()` does native work -- it asks the OS to allocate a new thread stack, registers with the scheduler, and only then invokes `run()` on that new thread. `run()` is just a regular method call with no threading magic.

    ```java
    Thread t = new Thread(() -> System.out.println(Thread.currentThread().getName()));
    t.run();   // prints "main" -- runs on caller thread
    t.start(); // prints "Thread-0" -- runs on new thread
    ```

    **When to use:** Always use `start()`. The only time you call `run()` directly is in unit tests where you want synchronous execution for deterministic assertions.

    **Gotchas:** Calling `start()` twice on the same `Thread` object throws `IllegalThreadStateException`. Thread objects are single-use -- create a new instance for each execution. This is another reason to prefer `ExecutorService` over raw threads.

??? question "Q5: Explain sleep(), wait(), and yield()."

    **Answer:** `sleep()` pauses without releasing locks, `wait()` releases the monitor and parks until notified, `yield()` is a non-binding hint to let other threads run.

    **Why the distinction matters:** Using `sleep()` inside a synchronized block holds the lock hostage. Using `wait()` without a loop around it causes spurious wake-up bugs. Mixing these up creates subtle concurrency issues.

    **How:**

    | Method | Lock released? | Resumes when | Class |
    |---|---|---|---|
    | `sleep(ms)` | No | Timeout expires or interrupted | `Thread` |
    | `wait()` | Yes (must hold monitor) | `notify()`/`notifyAll()` or interrupted | `Object` |
    | `yield()` | No | Scheduler decides (hint only) | `Thread` |

    **When to use:** `sleep()` for simple delays or polling backoff. `wait()`/`notify()` for producer-consumer coordination (though `BlockingQueue` is preferred now). `yield()` is almost never used in production -- it is platform-dependent and unreliable.

    **Gotchas:** `wait()` must be called inside a `synchronized` block or you get `IllegalMonitorStateException`. Always call `wait()` in a `while` loop checking your condition -- spurious wakeups are real and spec-allowed. `sleep()` inside `synchronized` is a common anti-pattern that causes unnecessary contention.

??? question "Q6: What does the join() method do?"

    **Answer:** `join()` blocks the calling thread until the target thread terminates -- it is the most basic "wait for completion" primitive in Java.

    **Why it exists:** Without `join()`, you would have no way to guarantee that Thread A's work is complete before Thread B uses its results. It establishes a happens-before relationship between the joined thread's termination and the caller's continuation.

    **How it works internally:** Under the hood, `join()` calls `wait()` on the thread's object monitor. When the thread terminates, the JVM calls `notifyAll()` on the Thread object, waking all joiners.

    ```java
    Thread t = new Thread(() -> {
        // long computation
    });
    t.start();
    t.join();  // current thread blocks until t finishes
    System.out.println("t is done");
    ```

    **When to use:** Coordinating startup sequences (wait for initialization threads), fork-join patterns where you manually manage threads, or simple parallel tasks before aggregating results.

    **Gotchas:** `join()` with no argument waits indefinitely -- always consider using `join(timeout)` to avoid hanging forever if the target thread is stuck. Also, never call `join()` on a thread that joins you back -- instant deadlock. In modern code, prefer `Future.get()` or `CompletableFuture` over raw `join()`.

??? question "Q7: What is a Daemon thread?"

    **Answer:** A daemon thread is a background service thread that the JVM will kill unceremoniously when all non-daemon threads have exited -- it never prevents JVM shutdown.

    **Why it exists:** Some work (GC, finalizers, monitoring heartbeats) should not keep the application alive. Marking these as daemon ensures clean shutdown without explicit thread management on exit.

    **How it works:** The JVM maintains a count of live non-daemon threads. When that count hits zero, the JVM initiates shutdown -- all daemon threads are stopped abruptly, no `finally` blocks execute.

    ```java
    Thread t = new Thread(() -> { /* background work */ });
    t.setDaemon(true);
    t.start();
    ```

    **When to use:** Background cache cleanup, periodic stats flushing, heartbeat pings, or any "fire and forget" housekeeping that should not block application exit.

    **Gotchas:** You must call `setDaemon(true)` before `start()` -- calling it after throws `IllegalThreadStateException`. Never do critical work (writing to DB, flushing files) in a daemon thread because `finally` blocks are not guaranteed to run on JVM exit. Threads in `ExecutorService` default to non-daemon; use a custom `ThreadFactory` to change this.

??? question "Q8: How does thread priority work in Java?"

    **Answer:** Thread priorities (1-10) are advisory hints to the OS scheduler -- they influence scheduling probability but guarantee nothing about execution order.

    **Why it exists:** The idea was to let the JVM communicate relative importance of threads to the OS. In practice, the mapping from Java's 10 levels to OS priority levels is platform-specific and often lossy.

    **How it works:** `setPriority()` calls down to native code that sets the OS thread priority. On Linux, all Java priorities often map to the same native priority unless you run as root. On Windows, the mapping is more granular but still unpredictable.

    ```java
    Thread t = new Thread(task);
    t.setPriority(Thread.MAX_PRIORITY);
    t.start();
    ```

    **When to use:** Almost never in production. If you need scheduling guarantees, use explicit coordination (locks, semaphores, queues with priority ordering) rather than relying on thread priority.

    **Gotchas:** Relying on priority for correctness is a classic bug -- your code may pass tests on Windows and fail on Linux. High-priority threads can starve lower-priority ones on some platforms (priority inversion). The GC threads run at high priority, so competing with them by setting MAX_PRIORITY is counterproductive.

---

## Synchronization & Locking

??? question "Q9: What is the synchronized keyword and how is it used?"

    **Answer:** `synchronized` is Java's built-in mutual exclusion mechanism -- it acquires a monitor lock ensuring only one thread executes the protected section at a time.

    **Why it exists:** Without mutual exclusion, concurrent writes to shared state produce corrupted data. `synchronized` was Java's original (and still most common) answer to this problem.

    **How it works internally:** Every Java object has an associated monitor. When a thread enters a `synchronized` block, the JVM uses CAS to acquire the monitor. If contended, the JVM escalates through biased locking, thin locks, and finally OS-level mutexes (heavyweight locks).

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

    **When to use:** Simple critical sections where you do not need tryLock, timeouts, or multiple conditions. It is sufficient for 90% of synchronization needs.

    **Gotchas:** Synchronizing on `this` exposes your lock to external code that might also synchronize on your instance, causing unexpected contention or deadlock. Prefer a `private final Object lock = new Object()`. Also, never synchronize on a boxed primitive or String literal -- these may be shared across unrelated code.

??? question "Q10: What is the difference between object-level and class-level locking?"

    **Answer:** Object-level locking uses the instance as the monitor (per-object exclusion), while class-level locking uses the `Class<?>` object (global exclusion across all instances).

    **Why this matters:** If you protect a static field with an instance-level lock, two threads using different instances will both enter the critical section and corrupt the shared static data. Matching lock scope to data scope is fundamental.

    **How:**

    ```java
    // Object-level -- each instance has its own lock
    synchronized (this) { /* per-instance */ }

    // Class-level -- one lock for all instances
    synchronized (MyClass.class) { /* one thread across all instances */ }
    // OR
    public static synchronized void method() { /* same effect */ }
    ```

    **When to use:** Object-level for instance state (counters, caches per object). Class-level for static state (shared registries, singleton initialization). If your state is static, your lock must be class-level.

    **Gotchas:** A `synchronized` instance method and a `synchronized` static method use different monitors -- they do not block each other. This means a thread modifying static state via a static synchronized method runs concurrently with another thread in an instance synchronized method, which can cause races if both touch the same field. Always audit whether your lock actually covers the data you think it covers.

??? question "Q11: What is reentrant locking?"

    **Answer:** A reentrant lock allows the same thread to acquire it multiple times without deadlocking on itself -- it tracks a hold count that must be fully released before other threads can enter.

    **Why it exists:** Without reentrancy, calling one synchronized method from another synchronized method on the same object would self-deadlock. Reentrancy makes composing synchronized code safe and natural.

    **How it works internally:** The lock maintains an owner thread and a hold count. On acquisition: if the current thread already owns it, increment count. On release: decrement count. The lock is truly released only when count hits zero.

    ```java
    public synchronized void outer() {
        inner(); // same thread can enter -- reentrant
    }
    public synchronized void inner() {
        // already holds the lock on 'this'
    }
    ```

    **When to use:** Both `synchronized` and `ReentrantLock` are reentrant by default. You benefit from this whenever methods that hold locks call other methods that also require the same lock -- which is common in recursive algorithms or layered APIs.

    **Gotchas:** With `ReentrantLock`, every `lock()` must have a matching `unlock()` -- if you lock twice and unlock once, the lock is still held. Always use try-finally to ensure unlock. Also, high hold counts can indicate a design smell -- deeply nested lock acquisition suggests overly coarse locking.

??? question "Q12: What causes a deadlock and how do you prevent it?"

    **Answer:** Deadlock is a permanent liveness failure where two or more threads are each waiting for a lock held by the other -- all four Coffman conditions must be present simultaneously.

    **Why you must know this cold:** Deadlocks are the number one concurrency bug in production. They are silent (no exception), intermittent, and hard to reproduce in testing.

    **How -- the four Coffman conditions:**

    1. **Mutual exclusion** -- resources are non-shareable
    2. **Hold and wait** -- thread holds one lock, waits for another
    3. **No preemption** -- locks cannot be forcibly taken
    4. **Circular wait** -- T1 waits for T2's lock, T2 waits for T1's lock

    **Prevention -- break any one condition:**

    - **Lock ordering** -- always acquire locks in a consistent global order (break circular wait)
    - **Timeout** -- use `tryLock(timeout)` with `ReentrantLock` (break hold-and-wait)
    - **Avoid nested locks** where possible
    - **Use `java.util.concurrent`** lock-free structures instead of manual locking

    ```java
    // Deadlock-prone
    synchronized (lockA) {
        synchronized (lockB) { /* ... */ }
    }
    // Another thread does lockB then lockA --> DEADLOCK

    // Fix: always acquire in the same order (e.g., lockA before lockB)
    ```

    **When to use lock ordering:** Assign a numeric ID to each lock and always acquire in ascending order. For database rows, use primary key ordering.

    **Gotchas:** Lock ordering only works if enforced everywhere -- one missed code path creates the deadlock. Hidden locks (calling a synchronized library method while holding your lock) are the usual culprit. Detection: `jstack <pid>`, `ThreadMXBean.findDeadlockedThreads()`, or VisualVM.

??? question "Q13: What is the difference between livelock and starvation?"

    **Answer:** Livelock means threads are actively executing but making zero progress (spinning in response to each other); starvation means a thread is perpetually denied resources by other threads monopolizing them.

    **Why the distinction matters:** Both are liveness failures, but the fix is different. Deadlock is easy to detect (threads are BLOCKED/WAITING). Livelock and starvation are harder -- threads appear active.

    **How they manifest:**

    - **Livelock:** Two threads both back off and retry in an identical pattern -- like two people in a hallway who keep stepping aside in the same direction. Common in retry-with-backoff logic where both threads use the same backoff strategy.
    - **Starvation:** A thread is runnable but never gets the lock because unfair lock acquisition keeps granting it to other threads. Also caused by priority inversion.

    **When you hit these:** Livelock appears in message-passing systems with eager retry. Starvation appears with unfair `ReentrantLock` or `synchronized` blocks under heavy contention from high-priority threads.

    **Gotchas:** Adding randomized jitter to backoff solves most livelocks. For starvation, use `new ReentrantLock(true)` for fair ordering -- but fair locks have ~2x throughput cost. Also, a thread that is "starved" in testing might work fine in production with less contention, making it hard to catch pre-deploy.

---

## Memory Model & Atomics

??? question "Q14: What does the volatile keyword do?"

    **Answer:** `volatile` guarantees visibility (all threads see the latest write) and ordering (prevents reordering around the volatile access) -- but it does NOT provide atomicity for compound operations.

    **Why it exists:** Without `volatile`, each CPU core can cache a variable locally indefinitely. One thread sets `running = false` but the other thread's core never sees the update because the JIT optimized the read into a register. `volatile` forces a memory barrier.

    **How it works internally:** A volatile write inserts a StoreStore + StoreLoad barrier; a volatile read inserts a LoadLoad + LoadStore barrier. This prevents the CPU and compiler from reordering operations across the volatile access.

    ```java
    private volatile boolean running = true;

    // Writer thread
    running = false;

    // Reader thread -- guaranteed to see the updated value
    while (running) { /* spin */ }
    ```

    **When to use:** Flags (stop signals), status indicators, double-checked locking's instance field, publishing immutable objects. Basically, any single read/write where you need cross-thread visibility.

    **Gotchas:** `volatile` does NOT make `count++` atomic -- that is a read-modify-write (three operations). Use `AtomicInteger` for that. Also, `volatile` on arrays only makes the reference volatile, not the elements. `volatile long` on 32-bit JVMs prevents word-tearing (non-atomic 64-bit write), which is another subtle use case.

??? question "Q15: What is the happens-before relationship?"

    **Answer:** Happens-before is the JMM's formal guarantee that memory writes by one action are visible to a subsequent action -- without it, the JVM and CPU can reorder operations freely.

    **Why it exists:** Modern CPUs and compilers aggressively reorder instructions for performance. The JMM defines happens-before as the contract between your code and the hardware -- if you establish this relationship, visibility is guaranteed. If you do not, anything goes.

    **How -- the key rules:**

    - **Program order:** Each action in a thread happens-before the next action in that thread.
    - **Monitor lock:** An unlock happens-before every subsequent lock on the same monitor.
    - **Volatile:** A write to a volatile field happens-before every subsequent read of that field.
    - **Thread start:** `t.start()` happens-before any action in thread `t`.
    - **Thread join:** All actions in thread `t` happen-before `t.join()` returns.
    - **Transitivity:** If A happens-before B and B happens-before C, then A happens-before C.

    **When to use this knowledge:** Whenever you question whether Thread B can "see" what Thread A wrote, trace the happens-before chain. If there is no chain, you have a potential visibility bug.

    **Gotchas:** "Happens-before" does not mean "happens earlier in wall-clock time." It means "is guaranteed to be visible to." Two operations can happen in calendar order but still lack a happens-before relationship, leading to stale reads. This is the single most misunderstood concept in Java concurrency.

??? question "Q16: How does AtomicInteger work (CAS)?"

    **Answer:** `AtomicInteger` uses Compare-And-Swap (CAS) -- a single CPU instruction that atomically reads, compares, and conditionally writes a value, achieving thread safety without locks.

    **Why it exists:** Locks have overhead: context switches, park/unpark, potential deadlocks. CAS gives you atomic compound operations with just a spin loop -- ideal for counters, sequence generators, and state flags under moderate contention.

    **How it works internally:** The JVM maps CAS to hardware instructions (`LOCK CMPXCHG` on x86). The algorithm: read current value, compute new value, attempt swap. If another thread modified the value between read and swap, the CAS fails and you retry.

    ```java
    AtomicInteger counter = new AtomicInteger(0);
    counter.incrementAndGet(); // atomic, lock-free

    // Under the hood (simplified):
    // do {
    //     int expected = current;
    //     int updated = expected + 1;
    // } while (!compareAndSwap(expected, updated));
    ```

    **When to use:** Counters, flags, accumulators, lock-free data structures. Anything where the operation is "read-modify-write" on a single variable.

    **Gotchas:** Under high contention, CAS degrades into a busy-spin loop burning CPU. At that point, switch to `LongAdder` (stripes updates across cells, reducing collisions). Also beware the **ABA problem** -- a value changes from A to B back to A, and CAS cannot detect the intermediate mutation. Use `AtomicStampedReference` if ABA matters to your logic.

??? question "Q17: What is ThreadLocal and when would you use it?"

    **Answer:** `ThreadLocal` gives each thread its own isolated copy of a variable, achieving thread safety through confinement rather than synchronization.

    **Why it exists:** Some objects are not thread-safe (e.g., `SimpleDateFormat`, `Random`) and creating them per-call is expensive. `ThreadLocal` lets each thread reuse its own instance without contention.

    **How it works internally:** Each `Thread` object holds a `ThreadLocalMap` (a hash map keyed by `ThreadLocal` references). When you call `get()`, it looks up the current thread's map to retrieve that thread's private value.

    ```java
    private static final ThreadLocal<SimpleDateFormat> dateFormat =
        ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

    // Each thread gets its own SimpleDateFormat instance
    String date = dateFormat.get().format(new Date());
    ```

    **When to use:** Per-thread database connections, user session/request context in web frameworks (Spring uses this heavily), transaction IDs for logging (MDC), and non-thread-safe utility objects.

    **Gotchas:** In thread pools, threads are reused -- if you do not call `remove()` after each task, the previous task's data leaks into the next task. This causes subtle bugs (wrong user context) and memory leaks (values not GC'd while the thread lives). With virtual threads (Java 21), `ThreadLocal` creates millions of map entries -- prefer `ScopedValue` (preview) instead.

---

## Executors & Thread Pools

??? question "Q18: What is ExecutorService and why use it over raw threads?"

    **Answer:** `ExecutorService` is a thread pool abstraction that decouples task submission from execution mechanics -- it handles thread lifecycle, reuse, and bounded concurrency so you do not have to.

    **Why it exists:** Creating a new OS thread per task is expensive (~1MB stack, kernel overhead) and unbounded -- 10K tasks means 10K threads means OOM. `ExecutorService` reuses a fixed pool of threads and queues excess work.

    **How:**

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

    **When to use:** Always. In production, there is almost no reason to use raw `new Thread()`. Use fixed pools for CPU-bound work (cores + 1 threads) and cached/virtual-thread pools for I/O-bound work.

    **Gotchas:** `newFixedThreadPool` and `newSingleThreadExecutor` use an unbounded `LinkedBlockingQueue` -- if tasks arrive faster than they execute, you will OOM with queued tasks, not threads. Always prefer constructing `ThreadPoolExecutor` directly with a bounded queue in production. Also, `shutdown()` does not interrupt running tasks -- use `shutdownNow()` for that.

??? question "Q19: What is the difference between Callable and Runnable?"

    **Answer:** `Runnable` is a void, no-throw task; `Callable<V>` returns a value and can throw checked exceptions -- it is the functional upgrade for tasks that produce results.

    **Why both exist:** `Runnable` predates generics (Java 1.0). `Callable` was added in Java 5 alongside `ExecutorService` to support tasks that compute and return values. You cannot retrofit return types onto `Runnable` without breaking backward compatibility.

    **How:**

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

    **When to use:** Use `Callable` whenever you need the result of a computation or need to propagate exceptions to the caller. Use `Runnable` for fire-and-forget side-effect tasks.

    **Gotchas:** When you submit a `Runnable` via `submit()`, exceptions are swallowed unless you call `get()` on the returned `Future`. If you use `execute()` instead, exceptions propagate to the `UncaughtExceptionHandler`. This silent swallowing is one of the most common bugs in executor-based code.

??? question "Q20: What is the difference between Future and CompletableFuture?"

    **Answer:** `Future` is a blocking, read-only handle to an async result; `CompletableFuture` is a composable, non-blocking promise that supports chaining, combining, and manual completion.

    **Why `CompletableFuture` was needed:** With `Future`, the only way to get the result is `get()`, which blocks. You cannot attach callbacks, chain transformations, or combine multiple futures without blocking a thread per future. This forced developers into callback hell or thread-wasteful patterns.

    **How:**

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

    **When to use:** Use `CompletableFuture` for any async pipeline -- service orchestration, parallel API calls with fan-out/fan-in, reactive-style programming. Use plain `Future` only if you are on a legacy API that returns one.

    **Gotchas:** Default `supplyAsync` uses `ForkJoinPool.commonPool()` -- if your tasks are blocking I/O, you starve the common pool and impact parallel streams everywhere. Always pass a dedicated executor for I/O tasks. Also, unhandled exceptions in a chain are silently swallowed unless you add `exceptionally()` or `handle()` at the end.

??? question "Q21: Explain the key ThreadPoolExecutor constructor parameters."

    **Answer:** `ThreadPoolExecutor` is the real implementation behind all `Executors` factory methods -- understanding its 7 parameters gives you full control over thread pool behavior and backpressure.

    **Why you need to know this:** The `Executors` convenience factories hide dangerous defaults (unbounded queues). In production, you should construct `ThreadPoolExecutor` directly with explicit bounds.

    **How:**

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

    **When to use each rejection policy:** `AbortPolicy` (default, throws -- good for detecting overload), `CallerRunsPolicy` (back-pressures the submitter -- excellent for self-throttling), `DiscardPolicy` (silent drop -- only if losing tasks is acceptable), `DiscardOldestPolicy` (drops the oldest queued task).

    **Gotchas:** The non-obvious interaction: with an unbounded queue, `maximumPoolSize` is meaningless because the queue never fills (step 3 never triggers). This is exactly the trap `newFixedThreadPool` sets. Also, `corePoolSize=0` with a `SynchronousQueue` is how `newCachedThreadPool` works -- it creates unbounded threads, which can OOM under burst load.

---

## Concurrency Utilities

??? question "Q22: What is the difference between CountDownLatch and CyclicBarrier?"

    **Answer:** `CountDownLatch` is a one-shot gate that opens when N events fire; `CyclicBarrier` is a reusable rendezvous point where N threads wait for each other before proceeding together.

    **Why both exist:** They solve different coordination patterns. Latch = "wait for prerequisites." Barrier = "synchronize peers." A latch opens once and stays open. A barrier resets and can be used for iterative algorithms.

    **How:**

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

    **When to use:** Latch for startup gates (wait for all services to initialize) or test harnesses (release all threads simultaneously). Barrier for parallel algorithms with phases (matrix computation, simulation ticks).

    **Gotchas:** If one thread in a `CyclicBarrier` dies or times out, all other waiting threads get `BrokenBarrierException` -- the barrier is broken and cannot be reused without `reset()`. With `CountDownLatch`, a thread that crashes before calling `countDown()` means `await()` hangs forever -- always use `await(timeout)`.

??? question "Q23: How does Semaphore work?"

    **Answer:** A `Semaphore` is a concurrency primitive that maintains a count of available permits -- threads acquire permits to proceed and release them when done, limiting concurrent access to a resource.

    **Why it exists:** Locks give you mutual exclusion (1 thread at a time). Semaphores generalize this to N concurrent threads. This is essential for resource pools where you want bounded parallelism without full exclusion.

    **How it works internally:** Built on `AbstractQueuedSynchronizer` (AQS). The state integer represents available permits. `acquire()` decrements via CAS; if permits drop below zero, the thread is parked in the AQS wait queue. `release()` increments and unparks a waiter.

    ```java
    Semaphore semaphore = new Semaphore(3); // max 3 concurrent accesses

    semaphore.acquire(); // blocks if no permits available
    try {
        accessSharedResource();
    } finally {
        semaphore.release();
    }
    ```

    **When to use:** Connection pools (limit to N connections), rate limiters (N requests per window), bounded resource access (max N file handles open), throttling concurrent I/O.

    **Gotchas:** `Semaphore(1)` acts as a mutex but is non-reentrant -- the same thread acquiring twice will deadlock. Unlike locks, any thread can release a permit (not just the acquirer), which enables flexible but error-prone patterns. A bug where `release()` is called without a matching `acquire()` silently inflates the permit count, breaking your concurrency limit.

??? question "Q24: ReentrantLock vs synchronized -- when to use which?"

    **Answer:** `synchronized` is simpler and less error-prone; `ReentrantLock` offers power features (tryLock, fairness, multiple conditions, interruptibility) at the cost of manual unlock management.

    **Why `ReentrantLock` was added:** `synchronized` cannot time out, cannot be interrupted while waiting, cannot try non-blocking acquisition, and has only one condition queue per monitor. These limitations are deal-breakers for sophisticated concurrency patterns.

    **How they compare:**

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

    **When to use:** `synchronized` for simple mutual exclusion (85% of cases). `ReentrantLock` when you need deadlock avoidance via `tryLock(timeout)`, or multiple conditions (e.g., producer and consumer waiting on different conditions of the same lock).

    **Gotchas:** Forgetting `unlock()` in a `finally` block means permanent lock holding -- the most common `ReentrantLock` bug. With `synchronized`, the JVM auto-releases on exception. Also, fair locks have ~2x throughput penalty -- do not enable fairness unless you have measured starvation.

??? question "Q25: What is ReadWriteLock?"

    **Answer:** `ReadWriteLock` allows unlimited concurrent readers OR one exclusive writer -- optimizing for the common case where reads vastly outnumber writes.

    **Why it exists:** With a regular lock, reads block other reads needlessly. If 99% of operations are reads, you are serializing work that could safely run in parallel. `ReadWriteLock` eliminates this bottleneck.

    **How it works internally:** `ReentrantReadWriteLock` uses a single AQS state split into two 16-bit fields: upper bits for read hold count, lower bits for write hold count. Readers increment the shared count via CAS; writers need exclusive access (shared count must be zero).

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

    **When to use:** Caches, configuration stores, in-memory lookup tables -- any shared data structure with a high read-to-write ratio. If reads and writes are roughly equal, the overhead of the read-write lock outweighs its benefit.

    **Gotchas:** Writer starvation is real -- if readers are continuous, a writer may wait indefinitely (use fair mode to mitigate). You cannot upgrade a read lock to a write lock (instant deadlock) -- you must release the read lock first, then acquire the write lock. Consider `StampedLock` if you need optimistic reads.

??? question "Q26: What is StampedLock and how does it improve over ReadWriteLock?"

    **Answer:** `StampedLock` (Java 8+) adds an optimistic read mode that acquires no lock at all -- just a stamp that you validate after reading, eliminating reader-writer contention in the happy path.

    **Why it exists:** `ReadWriteLock` still requires readers to acquire a lock (CAS on shared state), which becomes a bottleneck under extreme read concurrency. `StampedLock`'s optimistic read is a simple volatile read of a version number -- near zero cost.

    **How:**

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

    **When to use:** High-throughput read-heavy structures where writes are rare and reads are short (geometry computations, point lookups). The optimistic path avoids all memory contention.

    **Gotchas:** `StampedLock` is NOT reentrant -- acquiring it twice from the same thread deadlocks. It is not `Condition`-aware. The optimistic read pattern is tricky to get right: you must read all fields into locals before validating, and you must handle the fallback correctly. Misuse leads to reading inconsistent state. Also, `StampedLock` should not be used with `try-with-resources` -- it needs explicit stamp management.

??? question "Q27: How does ForkJoinPool and work-stealing work?"

    **Answer:** `ForkJoinPool` is a thread pool optimized for divide-and-conquer parallelism where each worker owns a deque and idle workers steal tasks from busy workers' deques, maximizing CPU utilization.

    **Why it exists:** Traditional thread pools with a shared queue create contention on the queue itself. ForkJoinPool gives each thread its own deque -- tasks are pushed/popped locally (LIFO, cache-friendly), and stealing happens from the tail (FIFO, coarse-grained work) only when a thread is idle.

    **How:**

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

    **When to use:** Recursive algorithms (merge sort, tree traversal, parallel array operations). `ForkJoinPool.commonPool()` backs parallel streams and `CompletableFuture` by default.

    **Gotchas:** The common pool size defaults to `Runtime.availableProcessors() - 1`. If you block inside a ForkJoinPool task (I/O, `synchronized`), you starve the pool because compensation threads are limited. Use `ManagedBlocker` for blocking operations. Also, forking tasks that are too small (below threshold) creates more overhead than sequential execution -- tune your threshold.

??? question "Q28: Implement Producer-Consumer using BlockingQueue."

    **Answer:** `BlockingQueue` is the canonical solution to producer-consumer -- `put()` blocks when full, `take()` blocks when empty, and you never write explicit wait/notify logic.

    **Why it exists:** Producer-consumer with manual `synchronized`/`wait`/`notify` is error-prone (missed signals, spurious wakeups, lock ordering). `BlockingQueue` encapsulates all coordination, making the pattern trivial to implement correctly.

    **How:**

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

    **When to use which implementation:** `ArrayBlockingQueue` (bounded, fair optional, lower GC) for most cases. `LinkedBlockingQueue` (higher throughput under contention due to separate put/take locks). `SynchronousQueue` (zero-capacity handoff, used by `newCachedThreadPool`). `PriorityBlockingQueue` (unbounded, priority-ordered).

    **Gotchas:** `LinkedBlockingQueue` with no capacity argument is unbounded -- producers never block, and you OOM under load. Always specify a capacity. Also, `poll()` vs `take()` -- using `poll(timeout)` enables graceful shutdown, while `take()` requires interrupt to unblock. Restoring the interrupt flag after catching `InterruptedException` is mandatory if your code runs inside an executor.

??? question "Q29: What is a Phaser?"

    **Answer:** `Phaser` is the most flexible synchronization barrier in Java -- it supports dynamic participant registration/deregistration and multiple reusable phases, combining the best of `CountDownLatch` and `CyclicBarrier`.

    **Why it exists:** `CyclicBarrier` requires a fixed party count set at construction. Real-world scenarios (worker pools that grow/shrink, iterative algorithms where threads exit early) need dynamic participation. `Phaser` fills this gap.

    **How:**

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

    **When to use:** Multi-phase algorithms where threads complete at different rates, fork-join patterns with dynamic task spawning, or when you need a hierarchical tiered barrier (parent Phaser with child Phasers).

    **Gotchas:** `Phaser` has higher per-operation overhead than `CyclicBarrier` -- do not use it if your party count is fixed and you do not need dynamic registration. If all parties deregister, the phaser is terminated and cannot be reused. The `onAdvance()` hook runs on the last arriving thread, so keep it fast to avoid blocking everyone. Also, `arriveAndAwaitAdvance()` is not interruptible -- use `awaitAdvanceInterruptibly()` if you need cancellation support.

??? question "Q30: What is an Exchanger?"

    **Answer:** `Exchanger<V>` is a synchronization point where exactly two threads rendezvous and atomically swap their objects -- each gives one and gets one.

    **Why it exists:** The classic use case is double-buffering: one thread fills a buffer while the other processes the previous buffer. When both are done, they swap -- zero copying, zero allocation, perfect pipelining.

    **How it works internally:** Internally uses a slot-based mechanism with CAS. The first thread to arrive places its item in a slot and parks. The second thread arrives, takes the first thread's item, deposits its own, and unparks the first thread.

    ```java
    Exchanger<String> exchanger = new Exchanger<>();

    // Thread 1
    String fromThread2 = exchanger.exchange("data-from-1");

    // Thread 2
    String fromThread1 = exchanger.exchange("data-from-2");
    ```

    **When to use:** Pipeline architectures with exactly two stages, buffer swapping in I/O processing, genetic algorithm crossover operations, or any scenario where two threads need to trade data symmetrically.

    **Gotchas:** Works only for exactly two threads -- if three threads call `exchange()`, pairing is non-deterministic. Use the timeout variant `exchange(V, long, TimeUnit)` to avoid indefinite blocking if the partner thread dies. If one thread is significantly faster than the other, the fast thread sits idle waiting -- consider `BlockingQueue` for asymmetric producer-consumer instead.

---

## Thread Management

??? question "Q31: Explain interrupt(), isInterrupted(), and interrupted()."

    **Answer:** `interrupt()` sets a cooperative cancellation flag on the target thread; `isInterrupted()` checks it without clearing; `Thread.interrupted()` checks and clears it -- together they form Java's cooperative thread cancellation mechanism.

    **Why cooperative cancellation:** Java deliberately does not allow forceful thread termination (deprecated `Thread.stop()` is unsafe). Instead, one thread requests cancellation, and the target thread checks and responds. This preserves invariants and allows cleanup.

    **How:**

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

    **When to use:** Cancelling long-running tasks, implementing shutdown logic in executor tasks, breaking out of blocking calls.

    **Gotchas:** When `InterruptedException` is thrown, the interrupt flag is automatically cleared -- you MUST re-set it with `Thread.currentThread().interrupt()` unless you are the top-level handler. Swallowing the exception without restoring the flag breaks cancellation for all upstream callers. Also, `Thread.interrupted()` is static and clears the flag -- using it when you just wanted to check (without clearing) is a common mistake.

??? question "Q32: How do you stop a thread gracefully?"

    **Answer:** Use cooperative cancellation via a volatile flag or the interrupt mechanism -- never use `Thread.stop()`, which was deprecated because it releases locks in an inconsistent state.

    **Why `Thread.stop()` is dangerous:** It throws `ThreadDeath` at an arbitrary point, releasing all monitors the thread holds. Any data structure being modified mid-update is left in a corrupted state. There is no safe way to use it.

    **How -- two production patterns:**

    ```java
    // Approach 1: volatile flag (simple CPU-bound loops)
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

    **When to use which:** Volatile flag for tight computation loops that never block. Interrupt for tasks that call blocking APIs (`sleep`, `wait`, `take`, `read`) -- these respond to interrupts by throwing `InterruptedException`.

    **Gotchas:** A volatile flag does not interrupt blocking calls -- the thread sits in `queue.take()` indefinitely. You need interrupts for that. Conversely, `ExecutorService.shutdownNow()` sends interrupts to running tasks -- if your task ignores interrupt status, it never stops. Well-written tasks should always check the interrupt flag in their loop condition and catch `InterruptedException` at blocking points.

??? question "Q33: How do you implement a thread-safe Singleton?"

    **Answer:** Three correct approaches exist: double-checked locking with volatile, the static holder idiom (most common), and the enum pattern (most bulletproof).

    **Why this is a classic interview question:** It tests understanding of volatile, class loading, serialization, reflection attacks, and initialization ordering -- all in one pattern.

    **How -- three safe approaches:**

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

    **When to use which:** Holder pattern for most production code (simple, lazy, fast). Enum when serialization/reflection attacks matter. Double-checked locking when you need constructor arguments (the only one that supports parameterized construction).

    **Gotchas:** Without `volatile` in DCL, the JVM can reorder the assignment so other threads see a partially-constructed object. The holder pattern works because class initialization is guaranteed atomic by the JLS. Enum cannot be lazily initialized and cannot extend classes. Also, in modern DI-heavy codebases (Spring), you rarely need manual singletons -- the container handles it.

---

## Concurrent Collections

??? question "Q34: ConcurrentHashMap vs synchronized HashMap -- what is the difference?"

    **Answer:** `ConcurrentHashMap` uses fine-grained locking (per-bucket CAS + node-level synchronized in Java 8+) and lock-free reads, while `synchronizedMap` wraps every operation in a single coarse lock that serializes all access.

    **Why `ConcurrentHashMap` wins:** Under contention, `synchronizedMap` becomes a bottleneck -- every reader blocks every other reader and writer. `ConcurrentHashMap` allows full read concurrency and only locks individual buckets on write, giving orders-of-magnitude better throughput.

    **How:**

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

    **When to use:** `ConcurrentHashMap` for any multi-threaded map access. `synchronizedMap` only if you need null keys/values (and cannot redesign) or need a consistent full-map snapshot via explicit synchronization on the wrapper.

    **Gotchas:** The classic bug: `if (!map.containsKey(k)) map.put(k, v)` is NOT atomic even with `ConcurrentHashMap` -- two threads can both pass the check. Use `putIfAbsent()` or `computeIfAbsent()`. Also, `size()` and `isEmpty()` on `ConcurrentHashMap` are estimates under concurrent modification -- do not make decisions based on exact counts.

??? question "Q35: What is CopyOnWriteArrayList and when should you use it?"

    **Answer:** `CopyOnWriteArrayList` achieves thread safety by creating a fresh copy of the internal array on every mutation -- reads are completely lock-free, operating on an immutable snapshot.

    **Why it exists:** For listener/observer lists in event-driven systems, writes (register/unregister) are rare but reads (iterating to notify) are extremely frequent and must not block. Copying on write trades write performance for zero-cost reads.

    **How it works internally:** The array reference is volatile. On write: acquire a lock, copy the array, modify the copy, swap the volatile reference. Readers see a consistent snapshot of the array at the time they started reading -- no `ConcurrentModificationException` possible.

    ```java
    CopyOnWriteArrayList<String> list = new CopyOnWriteArrayList<>();
    list.add("a"); // copies entire array
    // Iteration is safe, uses a snapshot
    for (String s : list) { /* no ConcurrentModificationException */ }
    ```

    **When to use:** Event listener lists, pub/sub subscriber lists, configuration registries, security policy lists -- anywhere writes are rare and reads/iterations are the hot path.

    **Gotchas:** Every `add()` or `remove()` is O(n) and creates garbage for GC. With 10K elements and frequent writes, you will see GC pressure and latency spikes. Iterator does not support `remove()` (throws `UnsupportedOperationException`). Also, the snapshot semantics mean iterators never reflect concurrent modifications -- which is usually desired but can confuse developers expecting "live" iteration.

---

## CompletableFuture Deep Dive

??? question "Q36: Explain thenApply, thenCompose, and thenCombine."

    **Answer:** `thenApply` is map (transform the value), `thenCompose` is flatMap (chain to another CompletableFuture), and `thenCombine` zips two independent futures into one result.

    **Why you need all three:** `thenApply` handles synchronous transformations. `thenCompose` is essential when your transformation itself is async (returns a CF) -- without it, you get `CF<CF<T>>` nesting. `thenCombine` enables fan-out/fan-in patterns where two independent computations run in parallel and their results merge.

    **How:**

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

    **When to use:** `thenApply` for pure transformations (parsing, formatting). `thenCompose` for sequential async calls (fetch user then fetch user's orders). `thenCombine` for parallel calls that converge (fetch user AND fetch product simultaneously, then build response).

    **Gotchas:** All have `*Async` variants (e.g., `thenApplyAsync`) that run the callback on a different thread. The non-async versions execute on whatever thread completes the previous stage -- which might be the caller's thread or the executor's thread, leading to unpredictable blocking if the callback is heavy. When in doubt, use the `*Async` variant with an explicit executor.

---

## Modern Java Concurrency

??? question "Q37: What are Virtual Threads in Java 21?"

    **Answer:** Virtual threads (Project Loom) are ultra-lightweight, JVM-managed threads that multiplex millions of tasks onto a small pool of OS carrier threads -- they make blocking code scale like async code without the complexity.

    **Why they exist:** Traditional threads cost ~1MB stack each, limiting concurrency to thousands. Reactive/async frameworks scale but destroy readability. Virtual threads give you the simple "one thread per request" model at million-thread scale by making blocking cheap (the carrier is released during I/O).

    **How:**

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

    **When to use:** I/O-bound workloads: HTTP servers, database access, microservice orchestration, file processing. NOT for CPU-bound computation (use platform thread pools for that since virtual threads still share the same carrier pool).

    **Gotchas:** Do NOT pool virtual threads -- pooling defeats their purpose (create one per task, they are cheap). `synchronized` blocks with blocking I/O inside pin the carrier thread (the virtual thread cannot unmount), starving other virtual threads. Replace `synchronized` with `ReentrantLock` around blocking calls. `ThreadLocal` with millions of virtual threads creates massive memory waste -- use `ScopedValue` instead. Also, CPU-bound virtual threads hog carriers since there is no preemption -- they only yield at blocking points.

??? question "Q38: What is Structured Concurrency (Preview in Java 21)?"

    **Answer:** Structured Concurrency ensures that concurrent subtasks are treated as a single unit of work -- all subtasks must complete (or be cancelled) before the parent scope exits, eliminating thread leaks and orphaned tasks by design.

    **Why it exists:** With unstructured concurrency (`CompletableFuture`, raw threads), a failed subtask can leave other subtasks running forever, leaking resources and producing confusing errors. Structured concurrency applies the same discipline to threads that try-with-resources brought to I/O -- the scope enforces cleanup.

    **How:**

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

    **When to use:** Any fan-out pattern: fetching multiple microservice responses, parallel validation, scatter-gather queries. Use `ShutdownOnFailure` for fail-fast (cancel all on first failure) or `ShutdownOnSuccess` for first-wins (take the first successful result and cancel the rest).

    **Gotchas:** This is still a preview API -- the class names and semantics may change. You cannot fork after `join()` is called. The scope must be closed in the same thread that created it (enforces structure). Subtask results are not available until after `join()` returns -- calling `get()` prematurely throws `IllegalStateException`. Also, this pairs naturally with virtual threads but does not require them.

---

## Race Conditions & Debugging

??? question "Q39: What is the difference between a race condition and a data race?"

    **Answer:** A data race is a low-level memory access violation (unsynchronized concurrent access, at least one write); a race condition is a higher-level logic bug where correctness depends on thread scheduling order -- you can have race conditions even with perfect synchronization.

    **Why the distinction matters:** Data races are undefined behavior under the JMM (literally anything can happen). Race conditions produce deterministic-looking but wrong results. Tools like TSan detect data races; race conditions require logic analysis.

    **How they differ:**

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

    **When to think about this:** During code review of any multi-threaded code. Data races are eliminated by proper synchronization. Race conditions require atomic compound operations (compare-and-swap patterns, `computeIfAbsent`, `putIfAbsent`).

    **Gotchas:** All data races are race conditions, but not all race conditions are data races. `ConcurrentHashMap` eliminates data races but does NOT prevent check-then-act race conditions if you use `get()` + `put()` separately. Time-of-check-to-time-of-use (TOCTTU) bugs in file systems are race conditions with no data races involved. ALWAYS think about the atomicity of your compound operation, not just individual reads/writes.

??? question "Q40: How do you debug concurrency issues?"

    **Answer:** Concurrency bugs are the hardest to debug because they are non-deterministic -- you need a layered approach combining prevention (design), detection (tooling), and reproduction (stress testing).

    **Why this is hard:** The bug may only manifest under specific thread interleavings that occur once in a million runs. It disappears under debugger (Heisenbug) because attaching a debugger changes timing.

    **How -- Detection tools:**

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

    - Stress testing with many threads and varied sleep intervals
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

    **Gotchas:** Adding logging or print statements changes thread timing and may hide the bug (observer effect). Thread dumps show a snapshot -- take multiple dumps seconds apart to see if threads are stuck or progressing. In production, proactively schedule periodic `findDeadlockedThreads()` checks and alert on detection rather than waiting for customer reports.
