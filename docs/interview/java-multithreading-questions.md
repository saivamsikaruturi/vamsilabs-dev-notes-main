---
title: "Java Multithreading Interview Questions — Top 40 with Answers"
description: "Top Java multithreading and concurrency interview questions with answers. Covers threads, synchronization, locks, thread pools, ExecutorService, CompletableFuture, volatile, deadlocks — asked at FAANG and top Java shops."
---

# Java Multithreading Interview Questions

Multithreading and concurrency is the **#1 most-failed topic** in Java interviews. This page covers the 40 most frequently asked questions with concise, interview-ready answers — from thread fundamentals to the Java Memory Model and modern concurrency utilities asked at Amazon, Google, Salesforce, and top product companies.

**What interviewers test:** Can you reason about shared state, identify race conditions, explain the Java Memory Model, and choose the right concurrency primitive for a given problem?

---

## Thread Fundamentals

**1. What is a thread? How do you create one in Java?**

A thread is a lightweight unit of execution sharing the process's memory. Two ways to create:
1. Extend `Thread` and override `run()` — tightly coupled, can't extend anything else
2. Implement `Runnable` (or `Callable`) and pass to `Thread` or `ExecutorService` — preferred

Modern Java: use `ExecutorService` or `CompletableFuture` instead of creating raw threads.

**2. What is the difference between `start()` and `run()`?**

`start()` creates a new OS thread and eventually calls `run()` in that thread. Calling `run()` directly executes in the **current** thread — no new thread is created. Classic interview trap.

**3. What are the thread states in Java?**

`NEW` → `RUNNABLE` → (`BLOCKED` | `WAITING` | `TIMED_WAITING`) → `TERMINATED`

- **BLOCKED:** waiting to acquire a monitor lock
- **WAITING:** waiting indefinitely (`wait()`, `join()`, `park()`)
- **TIMED_WAITING:** waiting with a timeout (`sleep()`, `wait(timeout)`, `join(timeout)`)

**4. What is the difference between `sleep()` and `wait()`?**

| | `Thread.sleep(ms)` | `Object.wait()` |
|---|---|---|
| Lock | Does **not** release the lock | **Releases** the lock |
| Called on | Any thread | Must hold the object's monitor |
| Woken by | Timeout / interrupt | `notify()` / `notifyAll()` / interrupt |
| Use for | Pausing execution | Inter-thread communication |

**5. What is a daemon thread?**

A daemon thread is a background/service thread (GC, JIT). The JVM exits when **all non-daemon threads** finish — daemon threads are killed automatically. Set with `thread.setDaemon(true)` before `start()`. Don't use for I/O that must complete.

→ Deep dive: [Daemon Threads & Lifecycle](../java/DaemonThreadsAndLifecycle.md)

---

## Synchronization

**6. What does `synchronized` do?**

Acquires the **intrinsic lock (monitor)** of an object before executing the block/method, releases it after. Guarantees **mutual exclusion** (only one thread at a time) and **visibility** (changes made inside are visible to the next thread that acquires the same lock). Reentrant — the same thread can re-acquire.

**7. What is a race condition?**

When the correctness of a program depends on the relative timing of thread execution. Classic example: two threads doing `count++` (read-modify-write) without synchronization — both read the same value, both increment, one write is lost.

**8. What is `volatile` and when should you use it?**

`volatile` guarantees **visibility** — writes are immediately flushed to main memory, reads always come from main memory, not thread-local CPU cache. It does **not** guarantee atomicity for compound operations (`i++`). Use for: simple flags (`boolean running = true`), safely published singletons (DCL pattern), or when only one thread writes and others read.

→ Deep dive: [volatile & Atomics](../java/VolatileAtomics.md)

**9. What is the Java Memory Model (JMM)?**

The JMM defines **happens-before** relationships — when one action's result is guaranteed visible to another. Key rules:
- A write to a `volatile` field happens-before every subsequent read of that field
- `Thread.start()` happens-before any action in the started thread
- `Thread.join()` happens-before the caller returns from it
- Monitor unlock happens-before every subsequent lock of that monitor

Without a happens-before relationship, there's no guaranteed visibility.

**10. What is `AtomicInteger` and when do you use it vs `synchronized`?**

`AtomicInteger` uses **CAS (Compare-And-Swap)** CPU instructions — lock-free, non-blocking. Faster than `synchronized` for single-variable operations (`get`, `set`, `incrementAndGet`, `compareAndSet`). Use `synchronized`/`Lock` when you need atomicity across **multiple** operations or variables.

→ Deep dive: [volatile & Atomics](../java/VolatileAtomics.md)

---

## Locks & Advanced Synchronization

**11. What is `ReentrantLock` and how does it differ from `synchronized`?**

`ReentrantLock` gives you explicit lock control:
- `tryLock()` / `tryLock(timeout)` — attempt lock without blocking forever
- `lockInterruptibly()` — can be interrupted while waiting
- `Condition` objects — multiple wait sets per lock (vs one per `synchronized` object)
- Fairness option (`new ReentrantLock(true)`) — FIFO ordering
- Must release in `finally` block — easy to forget, unlike `synchronized`

→ Deep dive: [Locks](../java/Locks.md)

**12. What is `ReadWriteLock`?**

Allows **multiple concurrent readers** or **one exclusive writer**. `ReentrantReadWriteLock` is the standard impl. Use when reads vastly outnumber writes (read-heavy caches, config). Writers starve in high-read scenarios — consider `StampedLock` for read-heavy workloads.

**13. What is a deadlock? How do you prevent it?**

Deadlock: Thread A holds lock 1, waits for lock 2. Thread B holds lock 2, waits for lock 1. Prevention strategies:
1. **Lock ordering:** always acquire locks in the same global order
2. **Try-lock with timeout:** `tryLock(timeout)` — back off and retry
3. **Lock-free data structures:** `ConcurrentHashMap`, `AtomicReference`
4. Avoid nested locking wherever possible

→ Deep dive: [Deadlocks](../java/deadlocks.md)

**14. What is a livelock? What is starvation?**

**Livelock:** threads keep responding to each other and changing state but make no progress (two people stepping aside to let each other pass — forever). **Starvation:** a thread never gets CPU time because higher-priority threads or unfair scheduling always preempt it.

---

## Thread Pools & ExecutorService

**15. Why use a thread pool instead of creating threads directly?**

Creating threads is expensive (OS resources, stack allocation). Thread pools reuse threads, bound the number of concurrent threads (preventing resource exhaustion), and provide lifecycle management. A single uncontrolled `new Thread()` per request can crash a server under load.

**16. What are the key `ExecutorService` implementations?**

| Factory method | Behaviour |
|---|---|
| `newFixedThreadPool(n)` | Fixed n threads; unbounded queue |
| `newCachedThreadPool()` | Grows unboundedly; idle threads die after 60s |
| `newSingleThreadExecutor()` | Single thread; tasks are serialized |
| `newScheduledThreadPool(n)` | Fixed pool for delayed/periodic tasks |
| `new ThreadPoolExecutor(...)` | Full control — prefer this in production |

`newCachedThreadPool()` can create thousands of threads under load — dangerous in production without bounding.

**17. What are the `ThreadPoolExecutor` parameters?**

```
corePoolSize    — threads always kept alive
maximumPoolSize — max threads (created when queue is full)
keepAliveTime   — idle non-core threads die after this
workQueue       — task buffer (LinkedBlockingQueue, ArrayBlockingQueue, SynchronousQueue)
rejectionPolicy — what to do when pool + queue full
                  (AbortPolicy, CallerRunsPolicy, DiscardPolicy, DiscardOldestPolicy)
```

→ Deep dive: [Thread Pools & Executors](../java/Executors.md)

**18. What is `Callable` vs `Runnable`?**

`Runnable.run()` returns `void` and can't throw checked exceptions. `Callable<V>.call()` returns a result and can throw checked exceptions. Submit via `ExecutorService.submit(callable)` → returns `Future<V>`.

**19. What is `Future` and what are its limitations?**

`Future<V>` represents an async result. `get()` blocks until done, `isDone()` polls. Limitations: can't be composed, can't attach callbacks, blocking `get()` defeats async purpose. Superseded by `CompletableFuture`.

---

## CompletableFuture

**20. What is `CompletableFuture` and why is it better than `Future`?**

`CompletableFuture<T>` is a fully composable async programming model:
- `thenApply()` — transform result (sync, same thread)
- `thenApplyAsync()` — transform in ForkJoinPool thread
- `thenCombine()` — combine two independent futures
- `allOf()` / `anyOf()` — wait for multiple futures
- `exceptionally()` / `handle()` — error handling
- `completeExceptionally()` — manual failure

→ Deep dive: [CompletableFuture](../java/CompletableFuture.md)

**21. What thread pool does `thenApplyAsync()` use by default?**

`ForkJoinPool.commonPool()`. In production, always supply a custom executor — the common pool is shared across the JVM and can be starved.

---

## Concurrent Collections

**22. What is `ConcurrentHashMap` and how does it differ from `HashMap` and `Hashtable`?**

- `HashMap`: not thread-safe
- `Hashtable`: synchronized on every method — entire map locked, poor concurrency
- `ConcurrentHashMap`: **segment-level locking** (Java 7) or **CAS + bin-level locks** (Java 8+) — multiple threads can read/write different segments simultaneously. `get()` is lock-free. Null keys/values not allowed (ambiguity with absent keys).

→ Deep dive: [ConcurrentHashMap Internals](../java/ConcurrentHashMapInternals.md)

**23. What is `CopyOnWriteArrayList`?**

On every write (add/remove), creates a **fresh copy** of the backing array. Reads are lock-free and never throw `ConcurrentModificationException`. Use only when reads vastly outnumber writes — writes are O(n).

**24. What is `BlockingQueue`? Name common implementations.**

A thread-safe queue where `put()` blocks when full and `take()` blocks when empty — perfect for producer-consumer. Implementations: `LinkedBlockingQueue` (optionally bounded), `ArrayBlockingQueue` (bounded, fairness option), `PriorityBlockingQueue`, `SynchronousQueue` (no capacity — each put must pair with a take).

→ Deep dive: [Concurrent Collections](../java/ConcurrentCollections.md)

---

## Synchronization Utilities

**25. What is `CountDownLatch`?**

One-time barrier. Initialize with a count; threads call `await()` to block until `countDown()` is called count times. Not reusable. Use: waiting for N services to start, waiting for N tasks to complete before proceeding.

**26. What is `CyclicBarrier`?**

Reusable barrier where N threads must all call `await()` before any can proceed. When the last thread arrives, optionally runs a `Runnable` action, then all threads are released. Resets for the next cycle. Use: parallel computation phases.

**27. What is `Semaphore`?**

Controls access to N permits. `acquire()` blocks if no permits available; `release()` returns one. Use: rate limiting, bounded resource pools (DB connections), limiting concurrent access to a resource.

**28. What is `Phaser`?**

Flexible replacement for `CountDownLatch` and `CyclicBarrier` — dynamic number of parties, multiple phases, parties can register/deregister. Use for complex staged parallel algorithms.

→ Deep dive: [ThreadLocal & Sync Aids](../java/ThreadLocalAndSyncAids.md)

---

## ThreadLocal

**29. What is `ThreadLocal`?**

A variable where each thread has its own independent copy — no synchronization needed. Used for per-thread state: database connections, transactions, user sessions, date formatters. `remove()` after use to prevent memory leaks in thread pools (threads are reused, old values persist).

**30. When does `ThreadLocal` cause a memory leak?**

In thread pools, threads are reused. If you set a `ThreadLocal` and never call `remove()`, the value stays in the thread's `ThreadLocalMap` even after the logical request ends. If the value holds a classloader reference (common in app servers), it prevents GC of the entire application classloader → `OutOfMemoryError: Metaspace`.

---

## Modern Concurrency (Java 21+)

**31. What are Virtual Threads (Java 21)?**

Virtual threads are **lightweight threads managed by the JVM** (not the OS). You can create millions — they're cheap (~few KB vs ~1MB for platform threads). When a virtual thread blocks on I/O, the JVM parks it and reuses the carrier (OS) thread for other virtual threads. Massively simplifies high-concurrency server code — write blocking code, get async performance.

**32. How do virtual threads change thread pool sizing?**

For virtual threads, thread pools are no longer the right model — just create a new virtual thread per task (`Thread.ofVirtual().start(runnable)` or `Executors.newVirtualThreadPerTaskExecutor()`). Don't pool virtual threads.

→ Deep dive: [Virtual Threads & Structured Concurrency](../java/VirtualThreads.md)

---

## Common Interview Problems

**33. Implement a thread-safe singleton.**

```java
// Best: enum (serialization-safe, thread-safe by JVM)
public enum Singleton { INSTANCE; }

// Also fine: initialization-on-demand holder
public class Singleton {
    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
    }
    public static Singleton getInstance() { return Holder.INSTANCE; }
}
```

**34. What is double-checked locking? Is it safe?**

```java
// Safe in Java 5+ with volatile
private static volatile Singleton instance;

public static Singleton getInstance() {
    if (instance == null) {                    // first check (no lock)
        synchronized (Singleton.class) {
            if (instance == null) {            // second check (with lock)
                instance = new Singleton();
            }
        }
    }
    return instance;
}
```
Without `volatile`, the JVM can reorder object construction — another thread may see a partially constructed object.

**35. What is the producer-consumer pattern? How do you implement it?**

Producer threads add items; consumer threads remove and process them. Implement with `BlockingQueue`:
```java
BlockingQueue<Task> queue = new LinkedBlockingQueue<>(100);
// Producer: queue.put(task);  // blocks if full
// Consumer: Task t = queue.take();  // blocks if empty
```

→ Deep dive: [BlockingQueue & Producer-Consumer](../java/BlockingQueueProducerConsumer.md)

---

## Quick-Fire Questions

**36. What is `synchronized(this)` vs `synchronized(MyClass.class)`?**
`synchronized(this)` locks the instance — different instances don't block each other. `synchronized(MyClass.class)` locks the class — all instances share the lock.

**37. Can a thread hold multiple locks simultaneously?**
Yes. This is how deadlocks happen — always acquire in consistent order.

**38. What happens if you call `notify()` with no thread waiting?**
Nothing — the notification is lost. This is why `wait()` should always be in a loop checking the condition: `while (!condition) { wait(); }`.

**39. What is `ForkJoinPool`?**
A thread pool optimized for divide-and-conquer tasks. Uses **work-stealing** — idle threads steal tasks from busy threads' queues. Powers `parallelStream()` and `CompletableFuture` async operations. `ForkJoinPool.commonPool()` is the shared JVM pool.

**40. How do you detect deadlocks in production?**
`jstack <pid>` prints thread dumps and highlights deadlocks. `ThreadMXBean.findDeadlockedThreads()` programmatically. In Actuator: `/actuator/threaddump`. Set up alerts on `BLOCKED` threads — sustained blocking is usually a deadlock or a slow lock holder.

→ Deep dive: [Multithreading](../java/MultiThreading.md)

---

## Go Deeper

- [Multithreading Deep Dive](../java/MultiThreading.md)
- [Thread Pools & Executors](../java/Executors.md)
- [Locks (ReentrantLock, ReadWriteLock, StampedLock)](../java/Locks.md)
- [volatile & Atomics](../java/VolatileAtomics.md)
- [Deadlocks — Detect & Prevent](../java/deadlocks.md)
- [ConcurrentHashMap Internals](../java/ConcurrentHashMapInternals.md)
- [CompletableFuture](../java/CompletableFuture.md)
- [Virtual Threads (Java 21)](../java/VirtualThreads.md)
