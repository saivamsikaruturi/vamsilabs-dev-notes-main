# Memory Leaks & Profiling in Java

A memory leak in Java happens when objects are **no longer needed but still referenced**, preventing the garbage collector from reclaiming them. Over time, this leads to `OutOfMemoryError` and service crashes.

---

## How Memory Leaks Happen in Java

```mermaid
graph LR
    subgraph Normal Lifecycle 🟢
        direction TB
        A1[Object Created] --> A2[Object Used]
        A2 --> A3[Reference Removed]
        A3 --> A4[GC Reclaims Memory]
    end
    subgraph Memory Leak 🔴
        direction TB
        B1[Object Created] --> B2[Object Used]
        B2 --> B3[Reference STILL Held]
        B3 --> B4[GC Can't Reclaim]
        B4 --> B5[💥 Grows Until OOM]
    end

    style A1 fill:#4CAF50,color:#fff
    style A2 fill:#66BB6A,color:#fff
    style A3 fill:#81C784,color:#fff
    style A4 fill:#A5D6A7,color:#000
    style B1 fill:#EF5350,color:#fff
    style B2 fill:#E57373,color:#fff
    style B3 fill:#FF8A65,color:#fff
    style B4 fill:#FF7043,color:#fff
    style B5 fill:#D32F2F,color:#fff
```

Java has automatic GC, but GC can only collect objects with **zero reachable references**. If even one reference exists, the object stays alive.

---

## Common Causes of Memory Leaks

### 1. Static Collections That Grow Forever

```java
// LEAK — static map grows until OOM
private static final Map<String, byte[]> cache = new HashMap<>();

public void processRequest(String key, byte[] data) {
    cache.put(key, data);  // never removed!
}
```

**Fix**: Use bounded caches with eviction.

```java
// Caffeine cache with max size and TTL
Cache<String, byte[]> cache = Caffeine.newBuilder()
    .maximumSize(1000)
    .expireAfterWrite(10, TimeUnit.MINUTES)
    .build();
```

### 2. Unclosed Resources

```java
// LEAK — connection never closed, connection pool exhausted
public void query(String sql) {
    Connection conn = dataSource.getConnection();
    PreparedStatement ps = conn.prepareStatement(sql);
    ResultSet rs = ps.executeQuery();
    // process results...
    // forgot to close rs, ps, conn!
}
```

**Fix**: Always use `try-with-resources`.

```java
public void query(String sql) {
    try (Connection conn = dataSource.getConnection();
         PreparedStatement ps = conn.prepareStatement(sql);
         ResultSet rs = ps.executeQuery()) {
        // process results...
    }  // all three auto-closed
}
```

### 3. Listener / Observer Registration Without Deregistration

```java
// LEAK — listener registered but never removed
public class EventBus {
    private final List<EventListener> listeners = new ArrayList<>();

    public void register(EventListener listener) {
        listeners.add(listener);  // holds a strong reference forever
    }
    // no unregister() method!
}
```

**Fix**: Provide an `unregister()` method, or use `WeakReference`.

### 4. Inner Classes Holding Outer Class References

```java
// LEAK — anonymous inner class holds reference to Activity (Android-style)
public class Activity {
    private byte[] heavyData = new byte[10_000_000];  // 10MB

    public Runnable getTask() {
        return new Runnable() {
            public void run() {
                // this anonymous class holds an implicit reference to Activity
                // even if Activity is no longer needed, it can't be GC'd
            }
        };
    }
}
```

**Fix**: Use static inner classes or lambdas (lambdas only capture what they reference).

### 5. String.intern() Abuse

```java
// LEAK — interns millions of unique strings into the pool
for (String line : readMillionLines()) {
    String interned = line.intern();  // permanently stored in String Pool
}
```

### 6. ThreadLocal Not Cleaned Up

```java
// LEAK — ThreadLocal value persists as long as the thread lives
private static final ThreadLocal<byte[]> buffer = new ThreadLocal<>();

public void process() {
    buffer.set(new byte[1_000_000]);  // 1MB per thread
    // forgot buffer.remove()!
    // in a thread pool, threads live forever → leak
}
```

**Fix**: Always call `remove()` in a `finally` block.

```java
try {
    buffer.set(new byte[1_000_000]);
    // process...
} finally {
    buffer.remove();
}
```

---

## Detecting Memory Leaks

### Step 1: Monitor with GC Logs and Metrics

```bash
# Enable GC logging (Java 11+)
java -Xlog:gc*:file=gc.log:time,level,tags -jar app.jar
```

**Red flags in GC logs:**

- Old Generation usage keeps **growing after each Full GC**
- Full GC frequency **increasing** over time
- GC reclaiming **less and less** memory each cycle

### Step 2: Take a Heap Dump

```bash
# On-demand
jmap -dump:format=b,file=heap.hprof <pid>

# Automatic on OOM (add to JVM flags)
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/var/logs/heap.hprof
```

### Step 3: Analyze with Tools

| Tool | Use for |
|---|---|
| **Eclipse MAT** | Heap dump analysis — "Leak Suspects" report, dominator tree |
| **VisualVM** | Live monitoring — heap usage, GC activity, thread states |
| **jstat** | `jstat -gc <pid> 1000` — live GC stats every second |
| **Grafana + Micrometer** | Production dashboards — heap, GC pause, thread pool metrics |
| **YourKit / JProfiler** | Commercial profilers — allocation tracking, CPU profiling |
| **Async Profiler** | Free, low-overhead — flame graphs for CPU and allocation |

---

## Profiling in Production

### Key JVM Flags for Monitoring

```bash
# Heap sizing
-Xms512m -Xmx2g

# GC logging
-Xlog:gc*:file=gc.log:time,level,tags

# Heap dump on OOM
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/tmp/heapdump.hprof

# JMX for remote monitoring
-Dcom.sun.management.jmxremote
-Dcom.sun.management.jmxremote.port=9010
```

### Key Metrics to Track

| Metric | What it tells you |
|---|---|
| Heap usage after GC | If growing → leak |
| GC pause time (P95/P99) | If increasing → heap too small or leak |
| Full GC count | Should be rare — if frequent, investigate |
| Thread count | If growing → thread leak |
| Off-heap / Metaspace | Class loading leaks (common in hot-deploy scenarios) |

---

## Analyzing a Heap Dump with Eclipse MAT

```
    1. Open heap dump in MAT
    2. Click "Leak Suspects Report"
    3. Look at "Problem Suspect 1" → shows the largest retained objects
    4. Open "Dominator Tree" → shows which objects retain the most memory
    5. Look for:
       - Static collections with unexpected size
       - Thread locals with large retained sets
       - Connection/stream objects that should have been closed
```

---

## Interview Questions

??? question "1. How would you diagnose a memory leak in a production Java service?"
    (1) Check Grafana dashboards — if Old Gen heap keeps growing after each GC cycle, it's a leak. (2) Enable `-XX:+HeapDumpOnOutOfMemoryError` or take a manual dump with `jmap`. (3) Open the dump in Eclipse MAT — check the "Leak Suspects" report and "Dominator Tree" to find which objects retain the most memory. (4) Trace back to the code that creates/holds those objects.

??? question "2. What is the difference between a memory leak and high memory usage?"
    High memory usage means the app legitimately needs that much memory (large dataset, many concurrent users). A memory leak means objects accumulate that are **no longer needed** but can't be GC'd. The key difference: in a leak, memory usage grows **unboundedly over time** even with constant load. High usage stabilizes.

??? question "3. How does ThreadLocal cause memory leaks in thread pools?"
    Thread pool threads live forever (they're reused). ThreadLocal values are stored in each thread's internal map. If `remove()` is never called, the value stays as long as the thread lives — which in a pool is the lifetime of the application. Multiply by pool size and value size, and you get a steady leak.

??? question "4. Your service runs fine for days but crashes with OOM every 2 weeks. How do you investigate?"
    This pattern strongly suggests a slow memory leak. (1) Add `-XX:+HeapDumpOnOutOfMemoryError` to capture the crash state. (2) Set up heap monitoring in Grafana and track Old Gen growth rate. (3) Compare heap dumps from day 1 vs day 7 — the difference reveals what's accumulating. Common culprits: unbounded caches, event listeners, thread locals in thread pools, unclosed resources.
