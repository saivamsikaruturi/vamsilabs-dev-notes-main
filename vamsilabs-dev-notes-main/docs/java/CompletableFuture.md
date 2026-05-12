# CompletableFuture — Async Programming in Java

`CompletableFuture` is Java's way of writing **non-blocking, asynchronous code** without callback hell. It's used heavily in microservices for parallel API calls, async event processing, and non-blocking I/O.

---

## Why Not Just Use `Future`?

| Feature | `Future` | `CompletableFuture` |
|---|---|---|
| Get result | `get()` — **blocks** the thread | `thenApply()` — non-blocking |
| Chain operations | Not possible | Full chaining (map, flatMap style) |
| Combine results | Not possible | `thenCombine()`, `allOf()` |
| Handle errors | Only via `try-catch` on `get()` | `exceptionally()`, `handle()` |
| Manual completion | Not possible | `complete()`, `completeExceptionally()` |

```java
// Old way — blocks the thread
Future<String> future = executor.submit(() -> fetchFromApi());
String result = future.get();  // BLOCKED until done

// New way — non-blocking
CompletableFuture.supplyAsync(() -> fetchFromApi())
    .thenApply(result -> process(result))
    .thenAccept(processed -> save(processed));
// thread is free immediately
```

---

## Creating CompletableFutures

```java
// Run async task that returns a value
CompletableFuture<String> cf = CompletableFuture.supplyAsync(() -> {
    return fetchUserName(userId);
});

// Run async task with no return value
CompletableFuture<Void> cf = CompletableFuture.runAsync(() -> {
    sendNotification(userId);
});

// Already completed (for testing or default values)
CompletableFuture<String> cf = CompletableFuture.completedFuture("default");

// With custom thread pool (recommended for production)
ExecutorService pool = Executors.newFixedThreadPool(10);
CompletableFuture.supplyAsync(() -> fetchData(), pool);
```

---

## Chaining Operations

```mermaid
graph LR
    A["🚀 supplyAsync<br/><i>produce</i>"] --> B["🔄 thenApply<br/><i>transform</i>"]
    B --> C["🔄 thenApply<br/><i>transform</i>"]
    C --> D["✅ thenAccept<br/><i>consume</i>"]

    style A fill:#4CAF50,color:#fff,stroke-width:2px
    style B fill:#FF9800,color:#fff,stroke-width:2px
    style C fill:#FF9800,color:#fff,stroke-width:2px
    style D fill:#2196F3,color:#fff,stroke-width:2px
```

### Transform result — `thenApply` (like `map`)

```java
CompletableFuture<Integer> future = CompletableFuture
    .supplyAsync(() -> "Hello, World")
    .thenApply(s -> s.length());  // 12
```

### Consume result — `thenAccept` (no return)

```java
CompletableFuture.supplyAsync(() -> fetchUser(id))
    .thenAccept(user -> log.info("Fetched: {}", user.getName()));
```

### Run after completion — `thenRun` (no access to result)

```java
CompletableFuture.supplyAsync(() -> saveOrder(order))
    .thenRun(() -> log.info("Order saved successfully"));
```

### Chain async operations — `thenCompose` (like `flatMap`)

Use when each step returns a `CompletableFuture`.

```java
CompletableFuture<Order> future = CompletableFuture
    .supplyAsync(() -> fetchUser(userId))           // returns User
    .thenCompose(user -> fetchOrders(user.getId()))  // returns CompletableFuture<Order>
    .thenCompose(order -> enrichOrder(order));        // returns CompletableFuture<Order>
```

**`thenApply` vs `thenCompose`**: Same as `map` vs `flatMap` in Streams. Use `thenCompose` when the function itself returns a `CompletableFuture` to avoid `CompletableFuture<CompletableFuture<T>>`.

---

## Combining Multiple Futures

### Combine two — `thenCombine`

```java
CompletableFuture<String> userFuture = CompletableFuture
    .supplyAsync(() -> fetchUserName(userId));

CompletableFuture<String> orderFuture = CompletableFuture
    .supplyAsync(() -> fetchLatestOrder(userId));

CompletableFuture<String> combined = userFuture
    .thenCombine(orderFuture, (user, order) ->
        user + " ordered " + order);
```

Both calls run **in parallel**, and the result combines when both are done.

### Wait for all — `allOf`

```java
CompletableFuture<String> api1 = CompletableFuture.supplyAsync(() -> callService1());
CompletableFuture<String> api2 = CompletableFuture.supplyAsync(() -> callService2());
CompletableFuture<String> api3 = CompletableFuture.supplyAsync(() -> callService3());

CompletableFuture.allOf(api1, api2, api3)
    .thenRun(() -> {
        String r1 = api1.join();
        String r2 = api2.join();
        String r3 = api3.join();
        // all three results available
    });
```

### First to complete — `anyOf`

```java
CompletableFuture<Object> fastest = CompletableFuture
    .anyOf(api1, api2, api3);  // returns as soon as ANY one completes
```

---

## Error Handling

### `exceptionally` — recover from errors

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        if (serviceDown) throw new RuntimeException("Service unavailable");
        return fetchData();
    })
    .exceptionally(ex -> {
        log.error("Failed: {}", ex.getMessage());
        return "default-value";  // fallback
    });
```

### `handle` — access both result and exception

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> fetchData())
    .handle((result, ex) -> {
        if (ex != null) {
            log.error("Error", ex);
            return "fallback";
        }
        return result.toUpperCase();
    });
```

### `whenComplete` — side effect without changing the result

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> fetchData())
    .whenComplete((result, ex) -> {
        if (ex != null) log.error("Failed", ex);
        else log.info("Success: {}", result);
    });
```

---

## Real-World Pattern: Parallel API Calls in Microservices

```java
public OrderSummary getOrderSummary(String userId) {
    CompletableFuture<User> userFuture = CompletableFuture
        .supplyAsync(() -> userService.getUser(userId), pool);

    CompletableFuture<List<Order>> ordersFuture = CompletableFuture
        .supplyAsync(() -> orderService.getOrders(userId), pool);

    CompletableFuture<PaymentInfo> paymentFuture = CompletableFuture
        .supplyAsync(() -> paymentService.getPaymentInfo(userId), pool);

    return CompletableFuture.allOf(userFuture, ordersFuture, paymentFuture)
        .thenApply(v -> new OrderSummary(
            userFuture.join(),
            ordersFuture.join(),
            paymentFuture.join()
        ))
        .orTimeout(3, TimeUnit.SECONDS)  // Java 9+
        .exceptionally(ex -> OrderSummary.fallback())
        .join();
}
```

Instead of 3 sequential calls (3s total), all 3 run in parallel (~1s total).

---

## Async vs Sync Variants

Every method has 3 variants:

| Variant | Thread used | Example |
|---|---|---|
| `thenApply()` | Same thread or caller | Fast transformations |
| `thenApplyAsync()` | ForkJoinPool.commonPool() | CPU-bound work |
| `thenApplyAsync(fn, executor)` | Custom thread pool | Production code |

**Rule**: Always use the version with a **custom executor** in production to control thread pool sizing and avoid starving the common pool.

---

## Interview Questions

??? question "1. What is the difference between `thenApply` and `thenCompose`?"
    `thenApply` transforms the result synchronously: `CompletableFuture<T>` → `CompletableFuture<R>`. `thenCompose` is for functions that return a `CompletableFuture` themselves — it flattens the result (like `flatMap`). Without `thenCompose`, you'd get `CompletableFuture<CompletableFuture<R>>`.

??? question "2. Your service calls 5 downstream APIs sequentially, taking 5 seconds total. How do you optimize?"
    Use `CompletableFuture.supplyAsync()` for each call with a custom thread pool, then `CompletableFuture.allOf()` to wait for all. Total time becomes the **slowest single call** instead of the sum. Add `.orTimeout()` for resilience and `.exceptionally()` for fallbacks.

??? question "3. Why should you avoid using the default ForkJoinPool in production?"
    The `ForkJoinPool.commonPool()` is shared across the entire JVM — all `parallelStream()` and `CompletableFuture` async calls without a custom executor use it. If one component blocks threads (e.g., HTTP calls), it starves all other components. Always pass a dedicated `ExecutorService`.

??? question "4. How do you handle timeouts with CompletableFuture?"
    Java 9+: `.orTimeout(3, TimeUnit.SECONDS)` throws `TimeoutException` if not complete. `.completeOnTimeout(fallback, 3, TimeUnit.SECONDS)` returns a fallback value instead. Pre-Java 9: use a `ScheduledExecutorService` to complete exceptionally after a delay.
