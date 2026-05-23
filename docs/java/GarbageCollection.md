# Garbage Collection in Java

Garbage Collection (GC) is one of the most critical topics for FAANG interviews. It separates engineers who can merely write Java from those who can diagnose production outages, tune JVM performance, and make informed decisions about memory-intensive systems. Understanding GC internals is essential for system design discussions involving latency SLAs, throughput requirements, and capacity planning.

---

## Why Garbage Collection? The Case Against Manual Memory Management

In C/C++, developers must explicitly allocate and free memory (`malloc`/`free`, `new`/`delete`). This leads to:

- **Memory leaks** — forgetting to free memory
- **Dangling pointers** — using memory after it's freed
- **Double-free bugs** — freeing memory twice (crashes, security vulnerabilities)

Java's GC eliminates these classes of bugs entirely by **automatically reclaiming memory** that is no longer reachable from the application's root references (stack variables, static fields, JNI references).

```java
public void processOrder(Order order) {
    // temp object created on the heap
    OrderValidator validator = new OrderValidator(order);
    validator.validate();
    // After this method returns, 'validator' has no references
    // GC will reclaim it — no manual free() needed
}
```

**Key principles:**

- **Live object** = reachable from a GC root (referenced directly or transitively)
- **Dead object** = unreachable from any GC root
- GC runs on a daemon thread — you **cannot force** it (`System.gc()` is only a hint)
- When the heap is full and GC cannot reclaim enough space: `java.lang.OutOfMemoryError: Java heap space`

---

## JVM Heap Structure

The JVM divides the heap into generations based on object age. This design exploits the **Generational Hypothesis**: most objects die young.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              JVM MEMORY                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────┐  ┌────────────────────────────┐  │
│  │         YOUNG GENERATION          │  │       OLD GENERATION       │  │
│  │                                   │  │       (Tenured)            │  │
│  │  ┌─────────┐  ┌─────┐  ┌─────┐   │  │                            │  │
│  │  │  Eden   │  │ S0  │  │ S1  │   │  │  Long-lived objects        │  │
│  │  │  Space  │  │(From)│  │(To) │   │  │  (survived many GC        │  │
│  │  │         │  │     │  │     │   │  │   cycles)                  │  │
│  │  │ (new    │  │     │  │     │   │  │                            │  │
│  │  │ objects)│  │     │  │     │   │  │                            │  │
│  │  └─────────┘  └─────┘  └─────┘   │  └────────────────────────────┘  │
│  └───────────────────────────────────┘                                  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     METASPACE (off-heap)                          │   │
│  │  Class metadata, method bytecode, constant pools                 │   │
│  │  (Replaced PermGen in Java 8 — grows dynamically)                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

```mermaid
flowchart LR
    subgraph JVM Heap
        subgraph Young Generation
            Eden[/"Eden Space<br/>(new objects allocated here)"/]
            S0(["Survivor S0 (From)"])
            S1(["Survivor S1 (To)"])
        end
        subgraph Old Generation
            Tenured{{"Tenured Space<br/>(long-lived objects)"}}
        end
    end
    subgraph Off-Heap
        Meta[["Metaspace<br/>(class metadata, replaced PermGen in Java 8)"]]
    end

    Eden -->|"Minor GC<br/>survivors"| S0
    S0 -->|"Age threshold<br/>exceeded"| S1
    S1 -->|"Promotion<br/>(age > 15)"| Tenured

    style Eden fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style Meta fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style S0 fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style S1 fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
    style Tenured fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
```

| Region | Purpose | Default Size |
|---|---|---|
| **Eden** | Where all new objects are born | ~76% of Young Gen |
| **Survivor S0/S1** | Hold objects that survived at least one GC | ~12% each of Young Gen |
| **Old Gen (Tenured)** | Objects that survived many GC cycles | ~2/3 of total heap |
| **Metaspace** | Class definitions, method metadata | Unbounded (off-heap, native memory) |

---

## The Generational Hypothesis

The entire design of generational GC rests on two empirical observations:

1. **Most objects die young** — temporary variables, iterators, intermediate results, request-scoped objects
2. **References from old objects to young objects are rare** — tracked via a "card table" or "remembered set"

This means focusing GC effort on the Young Generation (where most garbage is) gives the best return on investment. Collecting the entire heap every time would be extremely expensive.

```
Object Survival Rate
│
│  ████
│  ████
│  ████
│  ████░░
│  ████░░░░
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
└──────────────────────────────────────────────────── Object Age
   young                                        old

   ████ = objects that die (majority — collected cheaply)
   ░░░░ = objects that survive (minority — promoted)
```

---

## GC Process: Mark, Sweep, Compact

All GC algorithms share a fundamental three-phase approach:

```mermaid
flowchart LR
    A{{"1. MARK<br/>Traverse from GC roots,<br/>mark reachable objects"}} --> B{{"2. SWEEP<br/>Reclaim memory of<br/>unmarked objects"}}
    B --> C(["3. COMPACT<br/>Defragment by moving<br/>live objects together"])

    style A fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style B fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style r fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style s fill:#FEE2E2,stroke:#FCA5A5,color:#991B1B
```

```
BEFORE GC:
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│ A │ B │   │ C │   │ D │   │ E │   │ F │   (A,C,E = live; B,D,F = garbage)
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘

AFTER MARK:
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│ A*│ B │   │ C*│   │ D │   │ E*│   │ F │   (* = marked as live)
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘

AFTER SWEEP:
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│ A │   │   │ C │   │   │   │ E │   │   │   (garbage reclaimed, fragmented)
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘

AFTER COMPACT:
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│ A │ C │ E │   │   │   │   │   │   │   │   (contiguous free space)
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
```

**GC Roots** (starting points for the mark phase):

- Local variables on thread stacks
- Active threads themselves
- Static fields of loaded classes
- JNI references

---

## Minor GC vs Major GC vs Full GC

| Type | Scope | Trigger | Pause |
|---|---|---|---|
| **Minor GC** | Young Generation only | Eden is full | Short (milliseconds) |
| **Major GC** | Old Generation only | Old Gen is full or occupancy threshold reached | Longer (seconds possible) |
| **Full GC** | Entire heap + Metaspace | System.gc(), heap exhaustion, promotion failure | Longest (avoid in production) |

### Object Lifecycle Through GC

```mermaid
sequenceDiagram
    participant App as Application
    participant Eden as Eden Space
    participant S0 as Survivor S0
    participant S1 as Survivor S1
    participant Old as Old Generation

    App->>Eden: new Object()
    Note over Eden: Eden fills up
    Eden->>S0: Minor GC — survivors move to S0 (age=1)
    Note over Eden: Eden cleared
    App->>Eden: new Object()
    Note over Eden: Eden fills up again
    Eden->>S1: Minor GC — Eden survivors to S1
    S0->>S1: S0 survivors to S1 (age incremented)
    Note over S0: S0 cleared
    Note over S1: Objects with age > 15
    S1->>Old: Promotion to Old Gen
```

**Promotion threshold**: Objects that survive 15 Minor GC cycles (default, tunable with `-XX:MaxTenuringThreshold`) are promoted to Old Generation.

---

## GC Algorithms

### 1. Serial GC

The simplest collector — single-threaded, Stop-The-World (STW) for both Young and Old Gen.

```java
// Enable with:
// -XX:+UseSerialGC
```

```
Application Threads:   ─────────┤ STOP ├─────────────────
                                │      │
Serial GC Thread:               ├──GC──┤
                                │      │
                        ────────┴──────┴─────────────────► time
```

- **Best for**: Single-CPU machines, small heaps (<100MB), client applications
- **Pause**: Full STW during collection
- **Algorithm**: Mark-Copy (Young) + Mark-Sweep-Compact (Old)

### 2. Parallel GC (Throughput Collector)

Multi-threaded STW collector — maximizes application throughput (time spent running app vs time spent in GC).

```java
// Enable with:
// -XX:+UseParallelGC
// Default in Java 8
```

```
Application Threads:   ─────────┤   STOP   ├───────────────
                                │          │
GC Thread 1:                    ├──GC──────┤
GC Thread 2:                    ├──GC──────┤
GC Thread 3:                    ├──GC──────┤
GC Thread 4:                    ├──GC──────┤
                                │          │
                        ────────┴──────────┴───────────────► time
```

- **Best for**: Batch processing, data pipelines, backend jobs where throughput matters more than latency
- **Pause**: STW but faster (multiple threads working in parallel)
- **Tuning**: `-XX:ParallelGCThreads=N`, `-XX:GCTimeRatio=99` (1% time in GC)

### 3. CMS (Concurrent Mark-Sweep) — Deprecated

Reduced pause times by doing most marking concurrently with application threads.

```java
// Enable with:
// -XX:+UseConcMarkSweepGC
// DEPRECATED in Java 9, REMOVED in Java 14
```

```
Application Threads:   ────────────────────────────────────────────
                           │STW│               │STW│
CMS Phases:                ├───┤               ├───┤
                       Init Mark  Concurrent   Remark  Concurrent
                                   Mark                  Sweep
```

**Phases:**

1. **Initial Mark** (STW) — mark objects directly reachable from GC roots
2. **Concurrent Mark** — traverse object graph concurrently with application
3. **Remark** (STW) — fix changes made during concurrent mark
4. **Concurrent Sweep** — reclaim dead objects concurrently

**Problems** (why it was deprecated):

- No compaction — leads to fragmentation
- "Concurrent mode failure" — falls back to Serial Full GC if Old Gen fills up during marking
- Higher CPU usage for concurrent phases

### 4. G1 GC (Garbage-First) — Default Since Java 9

Region-based collector designed for large heaps with **predictable pause times**.

```java
// Enable with:
// -XX:+UseG1GC (default in Java 9+)
// -XX:MaxGCPauseMillis=200 (target pause time)
```

```
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│  E  │  E  │  S  │  O  │  O  │  E  │  H  │  O  │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  O  │  -  │  E  │  O  │  -  │  S  │  H  │  E  │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  -  │  O  │  -  │  E  │  O  │  -  │  O  │  -  │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘

E = Eden region    S = Survivor region    O = Old region
H = Humongous      - = Free region
```

**Key innovations:**

- Heap divided into **equal-sized regions** (1-32MB each)
- Regions are dynamically assigned roles (Eden, Survivor, Old, Humongous)
- **Garbage-First** = collects regions with the most garbage first (best ROI)
- Targets a **configurable pause time** (default 200ms)
- **Mixed collections** — can collect some Old Gen regions during Young GC

**Phases:**

1. Young-only phase (evacuate Eden + Survivor regions)
2. Space reclamation phase (mixed GCs — Young + selected Old regions)
3. Full GC (fallback — should be rare if tuned properly)

### 5. ZGC (Z Garbage Collector) — Ultra-Low Latency

Designed for applications requiring **sub-millisecond pause times** regardless of heap size.

```java
// Enable with:
// -XX:+UseZGC (production-ready since Java 15)
// Works with heaps from 8MB to 16TB
```

```
Application Threads:   ────────────────────────────────────────────
                           │<1ms│                         │<1ms│
ZGC Pauses:                ├────┤                         ├────┤
                                    ▲ concurrent work ▲
                                    │  (relocation,   │
                                    │   remapping)    │
```

**Key innovations:**

- **Colored pointers** — stores GC metadata in unused pointer bits (64-bit only)
- **Load barriers** — intercepts object references at load time to handle relocation
- **Concurrent compaction** — moves objects without stopping the application
- **Pause time < 1ms** — does NOT scale with heap size or live set size
- **No generational distinction** (until Generational ZGC in Java 21)

**Best for**: Latency-sensitive applications (trading systems, real-time services, large in-memory caches)

### 6. Shenandoah GC

Similar goals to ZGC — low pause times with concurrent compaction. Developed by Red Hat.

```java
// Enable with:
// -XX:+UseShenandoahGC (available since Java 12, backported to Java 8/11)
```

**Key difference from ZGC**: Uses **Brooks forwarding pointers** (extra word per object) instead of colored pointers. Works on 32-bit JVMs (ZGC requires 64-bit).

---

## GC Algorithm Comparison

| Algorithm | Pause Time | Throughput | Heap Size | Use Case | Java Version |
|---|---|---|---|---|---|
| **Serial** | High (full STW) | Low | Small (<100MB) | Client apps, single-core | All |
| **Parallel** | Medium (STW, multi-threaded) | **Highest** | Medium-Large | Batch jobs, data processing | Default in Java 8 |
| **CMS** | Low (mostly concurrent) | Medium | Medium-Large | Web apps (deprecated) | Removed in Java 14 |
| **G1** | **Predictable** (target-based) | High | Large (4GB-64GB) | General purpose, microservices | Default since Java 9 |
| **ZGC** | **Ultra-low** (<1ms) | High | Very Large (up to 16TB) | Latency-critical systems | Production since Java 15 |
| **Shenandoah** | **Ultra-low** (<10ms) | High | Large | Low-latency, Red Hat ecosystem | Java 12+ (backported) |

---

## GC Tuning: Key JVM Flags

### Essential Flags

```bash
# Heap sizing
-Xms4g                         # Initial heap size (set equal to -Xmx to avoid resizing)
-Xmx4g                         # Maximum heap size

# GC algorithm selection
-XX:+UseG1GC                   # Use G1 (default in Java 9+)
-XX:+UseZGC                    # Use ZGC (Java 15+)
-XX:+UseParallelGC             # Use Parallel GC

# G1 tuning
-XX:MaxGCPauseMillis=200       # Target max pause (G1 will try to meet this)
-XX:G1HeapRegionSize=16m       # Region size (1MB-32MB, power of 2)
-XX:InitiatingHeapOccupancyPercent=45  # Start mixed GC when Old Gen is 45% full

# Generational tuning
-XX:NewRatio=2                 # Old:Young = 2:1 (Old Gen is 2/3 of heap)
-XX:SurvivorRatio=8            # Eden:Survivor = 8:1:1
-XX:MaxTenuringThreshold=15    # Promote to Old Gen after 15 cycles

# Metaspace
-XX:MetaspaceSize=256m         # Initial metaspace size
-XX:MaxMetaspaceSize=512m      # Cap metaspace growth
```

### GC Logging (Java 9+ Unified Logging)

```bash
# Enable GC logging
-Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=5,filesize=10m

# Detailed GC logging for analysis
-Xlog:gc+heap=debug:file=gc-detail.log

# Legacy (Java 8)
-XX:+PrintGCDetails -XX:+PrintGCDateStamps -Xloggc:gc.log
```

### Production Recommendations

```bash
# Microservice (low-latency, 4GB heap)
java -Xms4g -Xmx4g -XX:+UseG1GC -XX:MaxGCPauseMillis=100 \
     -Xlog:gc*:file=gc.log:time:filecount=5,filesize=10m \
     -jar service.jar

# High-throughput batch job (16GB heap)
java -Xms16g -Xmx16g -XX:+UseParallelGC -XX:ParallelGCThreads=8 \
     -jar batch-job.jar

# Ultra-low-latency trading system (32GB heap)
java -Xms32g -Xmx32g -XX:+UseZGC \
     -Xlog:gc*:file=gc.log:time:filecount=5,filesize=10m \
     -jar trading-engine.jar
```

---

## Reading GC Logs

### Sample G1 GC Log Entry

```
[2024-01-15T10:30:45.123+0000][info][gc] GC(42) Pause Young (Normal)
    (G1 Evacuation Pause) 1024M->256M(4096M) 12.345ms
```

**Breakdown:**

| Field | Meaning |
|---|---|
| `GC(42)` | 42nd GC event since JVM start |
| `Pause Young (Normal)` | Minor GC triggered normally (Eden full) |
| `1024M->256M` | Heap usage: before -> after |
| `(4096M)` | Total heap capacity |
| `12.345ms` | Pause duration |

### Warning Signs in GC Logs

| Pattern | Problem | Action |
|---|---|---|
| Frequent Full GC | Heap too small or memory leak | Increase heap or investigate leak |
| `to-space exhausted` | Survivor space overflow | Increase survivor ratio or heap |
| Increasing Old Gen after Full GC | Memory leak | Heap dump analysis |
| Long pause times (>500ms) | GC tuning needed | Switch to G1/ZGC, tune pause target |
| `Concurrent mode failure` (CMS) | Old Gen fills during concurrent phase | Increase heap, lower IHOP threshold |

### Analysis Tools

- **GCViewer** — open-source desktop tool for visualizing GC logs
- **GCEasy** (gceasy.io) — web-based GC log analyzer with recommendations
- **JVisualVM** — real-time monitoring with GC plugin
- **Eclipse MAT** — memory analyzer for heap dumps
- **jstat** — command-line GC statistics: `jstat -gcutil <pid> 1000`

---

## Common Memory Issues and Troubleshooting

### 1. Memory Leaks

Objects that are still referenced but never used again — GC cannot collect them.

```java
// Classic leak: static collection that grows forever
public class LeakyCache {
    private static final Map<String, Object> cache = new HashMap<>();

    public void addToCache(String key, Object value) {
        cache.put(key, value);  // Never removed — grows until OOM
    }
}

// Fix: Use WeakHashMap, bounded cache, or explicit eviction
private static final Map<String, Object> cache =
    Collections.synchronizedMap(new LinkedHashMap<>(1000, 0.75f, true) {
        protected boolean removeEldestEntry(Map.Entry eldest) {
            return size() > 1000;
        }
    });
```

**Common leak sources:**

- Unclosed resources (connections, streams, cursors)
- Static collections without eviction
- Listeners/callbacks never deregistered
- ThreadLocal variables not removed
- ClassLoader leaks (common in app servers)

### 2. OutOfMemoryError Variants

| Error | Cause | Fix |
|---|---|---|
| `Java heap space` | Heap is full, GC cannot reclaim enough | Increase `-Xmx`, fix leak, reduce object creation |
| `GC overhead limit exceeded` | >98% time spent in GC, <2% heap recovered | Same as above — GC is thrashing |
| `Metaspace` | Too many classes loaded (dynamic proxies, reflection) | Increase `-XX:MaxMetaspaceSize`, check classloader leaks |
| `Unable to create native thread` | OS thread limit reached | Reduce thread count, increase `ulimit -u` |
| `Direct buffer memory` | NIO direct buffers exhausted | Increase `-XX:MaxDirectMemorySize` |

### 3. Long GC Pauses — Production Troubleshooting

**Scenario**: "Your service's P99 latency spikes to 5 seconds every few minutes. What do you do?"

**Step-by-step approach:**

1. **Confirm it's GC**: Check GC logs for pauses correlating with latency spikes
2. **Identify GC type**: Minor GC pauses (usually OK) vs Full GC (problematic)
3. **Check heap usage pattern**: `jstat -gcutil <pid> 1000`
4. **Analyze**: Feed logs into GCEasy or GCViewer
5. **Common fixes**:
    - If Full GC is frequent: likely memory leak or undersized heap
    - If Minor GC is long: too much surviving data, increase Young Gen
    - If promotion failure: Old Gen cannot accommodate promoted objects
    - Switch to G1 with pause time target, or ZGC for sub-ms pauses

```bash
# Quick diagnosis commands
jstat -gcutil <pid> 1000      # GC stats every second
jmap -histo:live <pid>         # Object histogram (triggers Full GC!)
jmap -dump:live,format=b,file=heap.hprof <pid>  # Heap dump for analysis
jcmd <pid> GC.heap_info       # Heap region info (no GC triggered)
```

---

## Interview Questions

??? question "1. Explain the Generational Hypothesis. Why does Java divide the heap into generations?"
    The Generational Hypothesis states that (1) most objects die young and (2) old-to-young references are rare. Java exploits this by concentrating GC effort on the Young Generation where most garbage exists. This means Minor GCs (which only scan Young Gen) are fast and frequent, while expensive Full GCs (entire heap) are rare. Without generations, every GC would scan the entire heap — unacceptable for large applications.

??? question "2. What is the difference between Minor GC, Major GC, and Full GC? When does each occur?"
    **Minor GC** collects only the Young Generation (triggered when Eden is full) — fast, millisecond pauses. **Major GC** collects the Old Generation (triggered when Old Gen reaches occupancy threshold) — can be concurrent (G1, CMS) or STW. **Full GC** collects the entire heap plus Metaspace — the most expensive, triggered by `System.gc()`, promotion failure, or when concurrent collection cannot keep up. In production, Full GC should be rare; frequent Full GCs indicate a memory leak or undersized heap.

??? question "3. How does G1 GC achieve predictable pause times?"
    G1 divides the heap into equal-sized regions (1-32MB). Instead of collecting the entire Old Generation, it tracks the **liveness ratio** of each region and collects the regions with the most garbage first (hence "Garbage-First"). It maintains a **pause time target** (`MaxGCPauseMillis`) and selects only enough regions to fit within that budget. It uses **concurrent marking** to identify garbage without stopping the app, then evacuates (copies) live objects from selected regions during a controlled STW pause.

??? question "4. Your production service has P99 latency spikes of 3-5 seconds every 2 minutes. How do you diagnose and fix this?"
    First, enable GC logging (`-Xlog:gc*`) and correlate pause events with latency spikes. If Full GCs are occurring, check for memory leaks (heap dump with `jmap`, analyze with Eclipse MAT). If the heap is simply too small, increase `-Xmx`. If using Parallel GC, switch to G1 with `-XX:MaxGCPauseMillis=100`. If Old Gen is growing steadily, look for a leak — objects staying in memory longer than expected (static maps, unclosed resources, listener leaks). For truly latency-critical services, consider ZGC which guarantees sub-millisecond pauses regardless of heap size.

??? question "5. When would you choose ZGC over G1? What are the trade-offs?"
    Choose ZGC when: (1) you have strict latency requirements (P99 < 10ms), (2) large heaps (tens of GB), (3) you cannot tolerate any GC pauses >1ms. Trade-offs: ZGC uses more CPU for its concurrent work (load barriers on every reference load), slightly higher memory overhead (colored pointers, multi-mapping), and was single-generation until Java 21 (Generational ZGC). G1 is better for general-purpose workloads where 50-200ms pauses are acceptable and maximum throughput is more important.

??? question "6. Explain the Mark-Sweep-Compact process. Why is compaction necessary?"
    **Mark**: Starting from GC roots (stack variables, static fields), traverse the object graph and mark all reachable objects as live. **Sweep**: Reclaim memory occupied by unmarked (dead) objects. **Compact**: Move surviving objects together to eliminate fragmentation. Without compaction, the heap becomes fragmented — you might have enough total free space for a large allocation but no single contiguous block big enough. Fragmentation forces premature Full GCs and degrades allocation performance. Compaction is expensive (requires updating all references) but essential for long-running applications.

??? question "7. What JVM flags would you set for a microservice handling 10K requests/second with a 100ms P99 latency SLA?"
    `-Xms4g -Xmx4g` (set equal to avoid resize pauses), `-XX:+UseG1GC` (predictable pauses), `-XX:MaxGCPauseMillis=50` (leave margin below 100ms SLA), `-XX:+AlwaysPreTouch` (commit memory pages at startup), `-Xlog:gc*:file=gc.log:time:filecount=5,filesize=10m` (for diagnostics). If 50ms is still too high, consider ZGC. Always set `-Xms` equal to `-Xmx` to prevent heap resizing under load. Monitor with `jstat` and analyze logs with GCEasy to validate tuning.

??? question "8. How can you identify a memory leak in a Java application? Walk through your approach."
    (1) **Symptom**: Old Gen usage grows over time, Full GCs become more frequent, eventually OOM. (2) **Confirm**: Monitor with `jstat -gcutil` — if Old Gen usage after Full GC keeps increasing, it's a leak. (3) **Capture**: Take heap dumps at intervals: `jmap -dump:live,format=b,file=heap1.hprof <pid>`, wait, take another. (4) **Analyze**: Open in Eclipse MAT, use "Leak Suspects" report. Look at dominator tree and histogram diff between dumps. (5) **Common culprits**: Static maps/caches without eviction, unclosed database connections, event listeners never deregistered, ThreadLocal not cleaned up, class loader leaks in web containers.
