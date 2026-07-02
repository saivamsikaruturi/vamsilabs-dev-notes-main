---
title: "Coding Scenarios & Challenges — Java — FAANG Interview (2026)"
description: "Java coding interview scenarios and challenges. 'What's wrong with this code?' puzzles, real-world coding problems, Big O analysis, and take-home assignment patterns."
---

# Coding Scenarios & Challenges — Java

> Beyond LeetCode: real-world coding scenarios that test production thinking. These are the questions that separate 5-year engineers from 10-year engineers.

---

## "What's Wrong With This Code?"

These are subtle bugs that look correct at first glance. Senior interviews love these because they test production instinct.

### Challenge 1: ConcurrentModificationException

```java
public void removeExpired(List<Session> sessions) {
    for (Session session : sessions) {
        if (session.isExpired()) {
            sessions.remove(session); // What happens here?
        }
    }
}
```

??? danger "Bug & Fix"
    **Bug:** Modifying a collection while iterating with enhanced for-loop throws `ConcurrentModificationException`.
    
    **Fix:**
    ```java
    sessions.removeIf(Session::isExpired);
    // Or use Iterator.remove()
    Iterator<Session> it = sessions.iterator();
    while (it.hasNext()) {
        if (it.next().isExpired()) it.remove();
    }
    ```

### Challenge 2: HashMap with Mutable Keys

```java
public class Employee {
    private String name;
    private int department;
    
    public int hashCode() { return Objects.hash(name, department); }
    public boolean equals(Object o) { /* standard equals */ }
}

Map<Employee, String> map = new HashMap<>();
Employee emp = new Employee("Alice", 42);
map.put(emp, "Engineering");
emp.setDepartment(99); // Manager moves Alice to another dept
String team = map.get(emp); // What does this return?
```

??? danger "Bug & Fix"
    **Bug:** Returns `null`. After mutation, `hashCode()` returns a different value, so `get()` looks in the wrong bucket. The entry exists but is unreachable — a memory leak.
    
    **Fix:** Make keys immutable. Use `record` types or make all fields `final` with no setters.

### Challenge 3: Double-Checked Locking (Broken)

```java
public class ConnectionPool {
    private static ConnectionPool instance;
    
    public static ConnectionPool getInstance() {
        if (instance == null) {                    // First check (no lock)
            synchronized (ConnectionPool.class) {
                if (instance == null) {            // Second check (with lock)
                    instance = new ConnectionPool(); // What's wrong?
                }
            }
        }
        return instance;
    }
}
```

??? danger "Bug & Fix"
    **Bug:** Without `volatile`, the JVM may reorder the constructor. Thread B may see a non-null `instance` that hasn't finished construction (partially constructed object).
    
    **Fix:** Add `volatile`:
    ```java
    private static volatile ConnectionPool instance;
    ```
    Or use the enum singleton pattern or holder class pattern (both are simpler and correct).

### Challenge 4: Integer Cache Boundary

```java
Integer a = 127;
Integer b = 127;
System.out.println(a == b); // true

Integer c = 128;
Integer d = 128;
System.out.println(c == d); // What does this print?
```

??? danger "Bug & Fix"
    **Bug:** Prints `false`. Java caches Integer objects for values -128 to 127. Beyond that range, `==` compares references (different objects), not values.
    
    **Fix:** Always use `.equals()` for object comparison:
    ```java
    System.out.println(c.equals(d)); // true
    ```

### Challenge 5: SimpleDateFormat Thread Safety

```java
public class DateUtil {
    private static final SimpleDateFormat SDF = 
        new SimpleDateFormat("yyyy-MM-dd");
    
    public static String format(Date date) {
        return SDF.format(date); // Called from multiple threads
    }
}
```

??? danger "Bug & Fix"
    **Bug:** `SimpleDateFormat` is NOT thread-safe. Concurrent access corrupts internal state, producing garbled dates or `ArrayIndexOutOfBoundsException`.
    
    **Fix:** Use `DateTimeFormatter` (Java 8+) which is immutable and thread-safe:
    ```java
    private static final DateTimeFormatter DTF = 
        DateTimeFormatter.ofPattern("yyyy-MM-dd");
    
    public static String format(LocalDate date) {
        return DTF.format(date);
    }
    ```

### Challenge 6: Resource Close Order

```java
try (Connection conn = dataSource.getConnection();
     PreparedStatement ps = conn.prepareStatement(sql);
     ResultSet rs = ps.executeQuery()) {
    
    while (rs.next()) {
        process(rs);
    }
} // What's the close order? What if ps.close() throws?
```

??? danger "Bug & Fix"
    **Bug:** This code is actually CORRECT. Try-with-resources closes in reverse order (rs → ps → conn) and suppresses exceptions from close(). 
    
    **The bug is when people write it manually:**
    ```java
    // BAD manual close — conn.close() never called if ps.close() throws
    try {
        // ...
    } finally {
        rs.close();
        ps.close();  // if this throws...
        conn.close(); // ...this never executes (connection leak!)
    }
    ```

### Challenge 7: Comparator Transitivity Violation

```java
Comparator<Task> byPriority = (a, b) -> {
    if (Math.abs(a.getPriority() - b.getPriority()) < 5) {
        return 0; // "close enough" — treat as equal
    }
    return Integer.compare(a.getPriority(), b.getPriority());
};
Collections.sort(tasks, byPriority); // What can happen?
```

??? danger "Bug & Fix"
    **Bug:** Violates transitivity. If A≈B and B≈C, it doesn't guarantee A≈C. `TimSort` throws `IllegalArgumentException: Comparison method violates its general contract`.
    
    Example: priorities 1, 4, 8. `compare(1,4)=0`, `compare(4,8)=0`, but `compare(1,8)≠0`.
    
    **Fix:** Comparators MUST be transitive. Remove the fuzzy equality:
    ```java
    Comparator<Task> byPriority = Comparator.comparingInt(Task::getPriority);
    ```

### Challenge 8: Race Condition in Lazy Singleton

```java
public class Registry {
    private Map<String, Service> services;
    
    public Map<String, Service> getServices() {
        if (services == null) {
            services = loadServices(); // expensive, called once
        }
        return services;
    }
}
```

??? danger "Bug & Fix"
    **Bug:** Two threads can both see `services == null`, both call `loadServices()`, and one overwrites the other's result. Worse: thread A may see a partially-constructed Map from thread B.
    
    **Fix:** Use holder pattern (lazy, thread-safe, no synchronization cost):
    ```java
    public class Registry {
        private static class Holder {
            static final Map<String, Service> SERVICES = loadServices();
        }
        public Map<String, Service> getServices() {
            return Holder.SERVICES;
        }
    }
    ```

### Challenge 9: BigDecimal equals vs compareTo

```java
Set<BigDecimal> prices = new HashSet<>();
prices.add(new BigDecimal("1.0"));
prices.add(new BigDecimal("1.00"));
System.out.println(prices.size()); // What does this print?
```

??? danger "Bug & Fix"
    **Bug:** Prints `2`. `BigDecimal.equals()` considers scale: `1.0` (scale=1) ≠ `1.00` (scale=2). But `compareTo()` returns 0 (they're numerically equal).
    
    **Fix:** Use `TreeSet` (uses `compareTo`) or normalize with `stripTrailingZeros()`:
    ```java
    Set<BigDecimal> prices = new TreeSet<>(); // uses compareTo
    prices.add(new BigDecimal("1.0"));
    prices.add(new BigDecimal("1.00"));
    System.out.println(prices.size()); // 1
    ```

### Challenge 10: Stream Short-Circuit Surprise

```java
List<String> result = Stream.of("a", "b", "c", "d")
    .peek(s -> System.out.print(s + " "))
    .filter(s -> !s.equals("b"))
    .peek(s -> System.out.print(s.toUpperCase() + " "))
    .limit(2)
    .collect(Collectors.toList());
// What gets printed?
```

??? danger "Bug & Fix"
    **Bug:** Many expect all elements processed. Actually prints: `a A b c C` — stream stops after collecting 2 elements ("a" and "c"). Element "d" is never touched due to `limit(2)` short-circuiting.
    
    **Lesson:** Don't use `peek()` for side effects in production. Stream processing order and short-circuiting make it unpredictable.

---

## Real-World Coding Scenarios

### Scenario 1: Thread-Safe LRU Cache

**Requirements:** TTL expiration, max size, LRU eviction, O(1) operations

```java
public class LRUCache<K, V> {
    private final int maxSize;
    private final long ttlMillis;
    private final Map<K, Node<K, V>> map;
    private final Node<K, V> head, tail;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    public LRUCache(int maxSize, Duration ttl) {
        this.maxSize = maxSize;
        this.ttlMillis = ttl.toMillis();
        this.map = new HashMap<>(maxSize * 4 / 3 + 1);
        this.head = new Node<>(null, null, 0);
        this.tail = new Node<>(null, null, 0);
        head.next = tail;
        tail.prev = head;
    }

    public V get(K key) {
        lock.readLock().lock();
        try {
            Node<K, V> node = map.get(key);
            if (node == null) return null;
            if (isExpired(node)) {
                lock.readLock().unlock();
                lock.writeLock().lock();
                try {
                    removeNode(node);
                    map.remove(key);
                    return null;
                } finally {
                    lock.writeLock().unlock();
                    lock.readLock().lock();
                }
            }
            return node.value;
        } finally {
            lock.readLock().unlock();
        }
    }

    public void put(K key, V value) {
        lock.writeLock().lock();
        try {
            Node<K, V> existing = map.get(key);
            if (existing != null) {
                removeNode(existing);
            }
            Node<K, V> node = new Node<>(key, value, System.currentTimeMillis());
            addToFront(node);
            map.put(key, node);
            if (map.size() > maxSize) {
                Node<K, V> victim = tail.prev;
                removeNode(victim);
                map.remove(victim.key);
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    private boolean isExpired(Node<K, V> node) {
        return System.currentTimeMillis() - node.timestamp > ttlMillis;
    }

    private void addToFront(Node<K, V> node) {
        node.next = head.next;
        node.prev = head;
        head.next.prev = node;
        head.next = node;
    }

    private void removeNode(Node<K, V> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private static class Node<K, V> {
        K key;
        V value;
        long timestamp;
        Node<K, V> prev, next;

        Node(K key, V value, long timestamp) {
            this.key = key;
            this.value = value;
            this.timestamp = timestamp;
        }
    }
}
```

**Follow-up questions interviewers ask:**

- "How would you make this distributed?" → Consistent hashing + Redis
- "What about cache stampede?" → Probabilistic early expiration or locking on miss
- "How do you handle 100K concurrent reads?" → Segmented/striped locks or lock-free with ConcurrentHashMap

### Scenario 2: Token Bucket Rate Limiter

```java
public class TokenBucketRateLimiter {
    private final int maxTokens;
    private final double refillRate; // tokens per second
    private double tokens;
    private long lastRefillTimestamp;

    public TokenBucketRateLimiter(int maxTokens, double refillRate) {
        this.maxTokens = maxTokens;
        this.refillRate = refillRate;
        this.tokens = maxTokens;
        this.lastRefillTimestamp = System.nanoTime();
    }

    public synchronized boolean tryAcquire() {
        refill();
        if (tokens >= 1) {
            tokens -= 1;
            return true;
        }
        return false;
    }

    private void refill() {
        long now = System.nanoTime();
        double elapsed = (now - lastRefillTimestamp) / 1_000_000_000.0;
        tokens = Math.min(maxTokens, tokens + elapsed * refillRate);
        lastRefillTimestamp = now;
    }
}
```

### Scenario 3: Producer-Consumer with Graceful Shutdown

```java
public class EventProcessor {
    private final BlockingQueue<Event> queue;
    private final ExecutorService consumers;
    private volatile boolean running = true;

    public EventProcessor(int queueSize, int consumerCount) {
        this.queue = new ArrayBlockingQueue<>(queueSize);
        this.consumers = Executors.newFixedThreadPool(consumerCount);
        for (int i = 0; i < consumerCount; i++) {
            consumers.submit(this::consumeLoop);
        }
    }

    public boolean publish(Event event) {
        if (!running) return false;
        return queue.offer(event, 100, TimeUnit.MILLISECONDS);
    }

    private void consumeLoop() {
        while (running || !queue.isEmpty()) {
            try {
                Event event = queue.poll(500, TimeUnit.MILLISECONDS);
                if (event != null) {
                    process(event);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }

    public void shutdown() {
        running = false;
        consumers.shutdown();
        try {
            if (!consumers.awaitTermination(30, TimeUnit.SECONDS)) {
                consumers.shutdownNow();
            }
        } catch (InterruptedException e) {
            consumers.shutdownNow();
        }
    }
}
```

---

## Big O with Java Collections

### Complexity Reference Table

| Operation | ArrayList | LinkedList | HashMap | TreeMap | ConcurrentHashMap |
|-----------|-----------|------------|---------|---------|-------------------|
| get(index) | O(1) | O(n) | — | — | — |
| get(key) | — | — | O(1)* | O(log n) | O(1)* |
| add(end) | O(1)† | O(1) | — | — | — |
| add(index) | O(n) | O(n)‡ | — | — | — |
| put(key) | — | — | O(1)* | O(log n) | O(1)* |
| remove | O(n) | O(1)§ | O(1)* | O(log n) | O(1)* |
| contains | O(n) | O(n) | O(1)* | O(log n) | O(1)* |
| iteration | O(n) | O(n) | O(capacity) | O(n) | O(n) |

*\* Amortized, degrades to O(log n) with many collisions (red-black tree in bucket)*  
*† Amortized, O(n) when resize triggers*  
*‡ O(1) if you already have the node reference*  
*§ O(1) if you have the iterator positioned*

### When O(1) HashMap Becomes O(n)

```java
// Hash collision attack — all keys hash to same bucket
class EvilKey {
    private final int id;
    public int hashCode() { return 42; } // always same bucket!
    // ...
}

// Java 8+ mitigation: when bucket size > 8, converts to red-black tree
// Worst case becomes O(log n) instead of O(n)
```

### ArrayList vs LinkedList — Why ArrayList Almost Always Wins

| Factor | ArrayList | LinkedList |
|--------|-----------|------------|
| Cache locality | Sequential memory, CPU prefetch works | Scattered nodes, cache misses |
| Memory overhead | ~4 bytes per element (reference) | ~24 bytes per element (node object + pointers) |
| Random access | O(1) direct index | O(n) traversal |
| Iteration speed | 10-100x faster (CPU cache) | Pointer chasing |
| Practical insert (middle) | Fast for <1000 elements (System.arraycopy is native) | Theoretically better, practically slower due to cache |

!!! tip "Rule of thumb"
    Use `ArrayList` unless you have a specific, measured need for `LinkedList` (which is almost never in practice).

---

## Take-Home Assignment Best Practices

### What Interviewers Evaluate

| Criteria | Weight | What They Look For |
|----------|--------|-------------------|
| Correctness | 30% | Does it work? Edge cases handled? |
| Code quality | 25% | Clean, readable, well-structured |
| Testing | 20% | Unit tests, edge cases, integration |
| Design decisions | 15% | Why this approach? Trade-offs documented? |
| Documentation | 10% | README, API docs, how to run |

### Project Structure Template

```
my-assignment/
├── src/
│   ├── main/java/com/example/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── model/
│   │   ├── exception/
│   │   └── config/
│   └── test/java/com/example/
│       ├── controller/  (integration tests)
│       ├── service/     (unit tests)
│       └── TestData.java (test fixtures)
├── docker-compose.yml
├── Makefile
├── README.md
└── DECISIONS.md  (trade-off documentation)
```

### README Template for Take-Homes

```markdown
# Project Name

## Quick Start
docker-compose up -d
./gradlew bootRun
# API available at http://localhost:8080

## Design Decisions
- Chose PostgreSQL over MongoDB because [reason]
- Used event-driven approach for [component] because [reason]
- Trade-off: chose consistency over availability for [feature]

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/orders | Create new order |
| GET | /api/v1/orders/{id} | Get order by ID |

## Testing
./gradlew test          # unit tests
./gradlew integrationTest  # requires Docker

## What I Would Add With More Time
- [ ] Caching layer for read-heavy endpoints
- [ ] Rate limiting
- [ ] Pagination for list endpoints
```

---

## Stream API Interview Challenges

### Challenge: Group and Aggregate

```java
// Given: List<Employee> with name, department, salary
// Task: Find the highest-paid employee in each department

Map<String, Optional<Employee>> topEarners = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.maxBy(Comparator.comparingDouble(Employee::getSalary))
    ));

// Better: avoid Optional in result
Map<String, Employee> topEarners = employees.stream()
    .collect(Collectors.toMap(
        Employee::getDepartment,
        Function.identity(),
        BinaryOperator.maxBy(Comparator.comparingDouble(Employee::getSalary))
    ));
```

### Challenge: Custom Collector

```java
// Implement a collector that partitions a list into chunks of size N
public static <T> Collector<T, ?, List<List<T>>> chunked(int size) {
    return Collector.of(
        ArrayList::new,
        (list, item) -> {
            if (list.isEmpty() || list.get(list.size() - 1).size() >= size) {
                list.add(new ArrayList<>());
            }
            list.get(list.size() - 1).add(item);
        },
        (left, right) -> { left.addAll(right); return left; }
    );
}

// Usage
List<List<Integer>> chunks = IntStream.rangeClosed(1, 10)
    .boxed()
    .collect(chunked(3));
// [[1,2,3], [4,5,6], [7,8,9], [10]]
```

---

## Concurrency Challenges

### Implement a Simple Thread Pool

```java
public class SimpleThreadPool {
    private final BlockingQueue<Runnable> taskQueue;
    private final List<Worker> workers;
    private volatile boolean isShutdown = false;

    public SimpleThreadPool(int poolSize, int queueSize) {
        taskQueue = new ArrayBlockingQueue<>(queueSize);
        workers = new ArrayList<>(poolSize);
        for (int i = 0; i < poolSize; i++) {
            Worker worker = new Worker();
            workers.add(worker);
            worker.start();
        }
    }

    public void submit(Runnable task) {
        if (isShutdown) throw new IllegalStateException("Pool is shut down");
        try {
            taskQueue.put(task);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public void shutdown() {
        isShutdown = true;
        workers.forEach(Thread::interrupt);
    }

    private class Worker extends Thread {
        public void run() {
            while (!isShutdown || !taskQueue.isEmpty()) {
                try {
                    Runnable task = taskQueue.poll(500, TimeUnit.MILLISECONDS);
                    if (task != null) task.run();
                } catch (InterruptedException e) {
                    break;
                } catch (Exception e) {
                    // Log and continue — don't kill the worker
                }
            }
        }
    }
}
```

### Implement a CountDownLatch

```java
public class SimpleCountDownLatch {
    private int count;

    public SimpleCountDownLatch(int count) {
        if (count < 0) throw new IllegalArgumentException();
        this.count = count;
    }

    public synchronized void countDown() {
        if (count > 0) {
            count--;
            if (count == 0) {
                notifyAll();
            }
        }
    }

    public synchronized void await() throws InterruptedException {
        while (count > 0) {
            wait();
        }
    }

    public synchronized void await(long timeout, TimeUnit unit) 
            throws InterruptedException {
        long millis = unit.toMillis(timeout);
        long deadline = System.currentTimeMillis() + millis;
        while (count > 0) {
            long remaining = deadline - System.currentTimeMillis();
            if (remaining <= 0) return;
            wait(remaining);
        }
    }
}
```

---

## Code Review Interview Practice

### Review This Code (Find 6 Issues)

```java
public class UserService {
    private Logger log = LoggerFactory.getLogger(UserService.class);
    private Map<String, User> cache = new HashMap<>();

    @Autowired
    private UserRepository userRepository;

    public User findUser(String email) {
        if (cache.containsKey(email)) {
            return cache.get(email);
        }
        User user = userRepository.findByEmail(email);
        if (user != null) {
            cache.put(email, user);
        }
        return user;
    }

    public void deleteUser(String id) {
        userRepository.deleteById(id);
        log.info("Deleted user: " + id);
    }

    public User updateEmail(String id, String newEmail) {
        User user = userRepository.findById(id).get();
        user.setEmail(newEmail);
        userRepository.save(user);
        return user;
    }
}
```

??? tip "Issues Found"
    1. **Thread safety:** `HashMap` cache accessed concurrently without synchronization → use `ConcurrentHashMap`
    2. **Race condition:** `containsKey` + `get` is not atomic → use `computeIfAbsent`
    3. **Cache invalidation:** `updateEmail` changes email but doesn't invalidate old cache entry
    4. **Unbounded cache:** No eviction policy → memory leak over time
    5. **NoSuchElementException:** `.get()` on Optional without `isPresent` check → use `orElseThrow`
    6. **String concatenation in log:** `"Deleted user: " + id` allocates even if log level is higher → use `log.info("Deleted user: {}", id)`
    7. **Bonus — Logger should be `private static final`** for proper singleton behavior
