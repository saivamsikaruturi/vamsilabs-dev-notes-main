# JVM Tuning, Performance & Monitoring

JVM tuning is the art of configuring the Java Virtual Machine to squeeze maximum performance out of your application while meeting latency, throughput, and resource constraints. In FAANG interviews, this topic distinguishes engineers who can deploy to production and troubleshoot live systems from those who only write application code. Mastering JVM flags, profiling tools, and diagnostic techniques is essential for system design discussions involving SLAs, capacity planning, and incident response.

---

## JVM Flags Categories

JVM flags are divided into three tiers based on stability and portability.

| Category | Prefix | Stability | Example |
|---|---|---|---|
| **Standard** | (none or `-`) | Stable across all JVM implementations | `-version`, `-classpath`, `-verbose:gc` |
| **Non-standard** | `-X` | JVM-specific, generally stable in HotSpot | `-Xms`, `-Xmx`, `-Xss`, `-Xlog:gc` |
| **Advanced** | `-XX:` | Experimental/diagnostic, may change between releases | `-XX:+UseG1GC`, `-XX:MaxGCPauseMillis=200` |

!!! tip "Boolean vs Value Flags"
    Advanced flags use `+` to enable and `-` to disable: `-XX:+UseG1GC` (enable), `-XX:-UseCompressedOops` (disable). Value flags use `=`: `-XX:MaxGCPauseMillis=200`.

```bash
# List all -XX flags with current values
java -XX:+PrintFlagsFinal -version 2>&1 | head -50

# List only flags that differ from defaults
java -XX:+PrintFlagsFinal -version 2>&1 | grep ':='

# List all non-standard (-X) flags
java -X
```

---

## Heap Sizing

The heap is where all Java objects live. Correct sizing is the single most impactful tuning decision.

```
┌──────────────────────────────────────────────────────────────────┐
│                        JVM Process Memory                        │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Java Heap (-Xms / -Xmx)                 │  │
│  │  ┌──────────────────────┐  ┌────────────────────────────┐  │  │
│  │  │   Young Generation   │  │      Old Generation        │  │  │
│  │  │  -XX:NewSize         │  │                            │  │  │
│  │  │  -XX:MaxNewSize      │  │                            │  │  │
│  │  └──────────────────────┘  └────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Metaspace      │  │  Thread       │  │  Direct Buffers  │   │
│  │ -XX:MaxMetaspace │  │  Stacks       │  │  (NIO)           │   │
│  │    Size          │  │  (-Xss each)  │  │                  │   │
│  └─────────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

| Flag | Purpose | Default | Guideline |
|---|---|---|---|
| `-Xms` | Initial heap size | 1/64 of physical RAM | Set equal to `-Xmx` in production to avoid resize pauses |
| `-Xmx` | Maximum heap size | 1/4 of physical RAM | 50-70% of available container memory |
| `-Xss` | Thread stack size | 512KB-1MB (platform-dependent) | Reduce if many threads; increase if deep recursion |
| `-XX:NewRatio=N` | Old/Young ratio | 2 (Old is 2x Young) | Lower = larger young gen = fewer minor GCs |
| `-XX:SurvivorRatio=N` | Eden/Survivor ratio | 8 | Eden is 8x each survivor space |
| `-XX:MaxMetaspaceSize` | Metaspace cap | Unlimited | Set a cap to prevent runaway class loading |

```bash
# Production-grade heap sizing
java -Xms4g -Xmx4g -Xss512k \
     -XX:MaxMetaspaceSize=256m \
     -XX:NewRatio=2 \
     -jar myapp.jar
```

!!! warning "Never Oversizing"
    Setting `-Xmx` too large causes longer GC pauses (more heap to scan) and wastes memory. For most microservices, 2-4GB is the sweet spot. If you need more than 8GB, consider whether your data model fits in-heap or should use off-heap storage (Redis, database).

---

## Garbage Collection Tuning

### Selecting a Collector

| Collector | Flag | Best For | Pause Behavior |
|---|---|---|---|
| **Serial** | `-XX:+UseSerialGC` | Single-core, small heaps (<100MB) | Stop-the-world, single-threaded |
| **Parallel** | `-XX:+UseParallelGC` | Batch processing, throughput-first | Stop-the-world, multi-threaded |
| **G1** | `-XX:+UseG1GC` | General purpose (default since Java 9) | Low-pause, region-based |
| **ZGC** | `-XX:+UseZGC` | Ultra-low latency (<1ms pauses) | Concurrent, colored pointers |
| **Shenandoah** | `-XX:+UseShenandoahGC` | Low latency (RedHat JDK) | Concurrent compaction |

### Tuning Pause Goals vs Throughput

```bash
# G1GC with pause target (latency-focused)
java -XX:+UseG1GC \
     -XX:MaxGCPauseMillis=100 \
     -XX:GCPauseIntervalMillis=500 \
     -Xmx8g -jar myapp.jar

# Parallel GC with throughput target
java -XX:+UseParallelGC \
     -XX:GCTimeRatio=19 \       # 5% GC time (1/(1+19))
     -XX:MaxGCPauseMillis=200 \
     -Xmx8g -jar myapp.jar
```

!!! info "GC Logging (Java 11+)"
    ```bash
    java -Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=5,filesize=10m \
         -jar myapp.jar
    ```
    This produces unified logging with rotation (5 files, 10MB each). For Java 8, use `-XX:+PrintGCDetails -XX:+PrintGCDateStamps -Xloggc:gc.log`.

---

## G1GC Deep Dive

G1 (Garbage-First) divides the heap into equally-sized **regions** (1-32MB each) and prioritizes collecting regions with the most garbage first.

```
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ Eden │ Eden │ Surv │ Old  │ Old  │ Free │ Hum. │ Old  │
│      │      │      │      │      │      │      │      │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
  Region-based layout — any region can be any generation type
  Hum. = Humongous (object > 50% region size)
```

**G1 Collection Phases:**

1. **Young-only phase** -- Evacuates live objects from Eden and Survivor regions (STW)
2. **Concurrent marking** -- Runs when heap occupancy exceeds threshold; marks live objects concurrently
3. **Mixed collections** -- Collects both young and selected old regions with most garbage
4. **Full GC (fallback)** -- Single-threaded full compaction if G1 falls behind (avoid this)

**Key G1 Tuning Flags:**

```bash
java -XX:+UseG1GC \
     -XX:MaxGCPauseMillis=200 \            # Target max pause (ms)
     -XX:G1HeapRegionSize=8m \             # Region size (1-32MB, power of 2)
     -XX:InitiatingHeapOccupancyPercent=45 \ # Start concurrent marking at 45% heap
     -XX:G1MixedGCCountTarget=8 \          # Spread mixed GC over 8 cycles
     -XX:G1ReservePercent=10 \             # Reserve 10% heap for promotions
     -XX:ConcGCThreads=4 \                # Concurrent marking threads
     -XX:ParallelGCThreads=8 \            # STW phase threads
     -Xmx8g -jar myapp.jar
```

!!! tip "G1 Humongous Allocations"
    Objects larger than 50% of a region are allocated as **humongous** objects in contiguous regions. These are expensive to collect. If you see many humongous allocations in GC logs, increase `-XX:G1HeapRegionSize` so fewer objects qualify as humongous.

---

## ZGC Tuning

ZGC is a concurrent, non-generational (generational since Java 21) garbage collector designed for sub-millisecond pauses regardless of heap size.

**Key characteristics:**

- Pause times do **not** increase with heap size (handles multi-terabyte heaps)
- Uses **colored pointers** and **load barriers** for concurrent relocation
- Generational mode (Java 21+) separates young/old objects for better throughput

```bash
# ZGC on Java 17
java -XX:+UseZGC \
     -XX:SoftMaxHeapSize=4g \    # Soft target — ZGC tries to stay below this
     -Xmx8g \                   # Hard limit
     -jar myapp.jar

# Generational ZGC on Java 21+
java -XX:+UseZGC -XX:+ZGenerational \
     -Xmx8g -jar myapp.jar

# Java 23+ — Generational ZGC is the default mode
java -XX:+UseZGC -Xmx8g -jar myapp.jar
```

| ZGC Flag | Purpose |
|---|---|
| `-XX:SoftMaxHeapSize` | ZGC returns memory to OS when usage is below this |
| `-XX:ZCollectionInterval=N` | Force GC every N seconds (0 = disabled) |
| `-XX:ZAllocationSpikeTolerance` | How aggressively to start GC on allocation spikes |
| `-XX:ZUncommitDelay=N` | Seconds before uncommitting unused memory |

!!! note "When to Choose ZGC over G1"
    Choose ZGC when your application requires sub-millisecond tail latencies (p99), operates with large heaps (>16GB), or serves latency-sensitive traffic (real-time bidding, financial trading). G1 remains better for moderate heaps where throughput matters more than worst-case latency.

---

## JIT Compilation

The JVM interprets bytecode initially, then compiles **hot** methods to native code via Just-In-Time compilation.

```
Bytecode → Interpreter → C1 (Client Compiler) → C2 (Server Compiler)
              ↑               Quick compilation      Aggressive optimizations
              │               Level 1-3              Level 4
              │
         Tiered Compilation (default since Java 8)
         combines both C1 and C2 for fast startup + peak performance
```

**Compilation Tiers (Tiered Compilation):**

| Level | Compiler | Description |
|---|---|---|
| 0 | Interpreter | No compilation, collects profiling data |
| 1 | C1 | Simple compilation, no profiling |
| 2 | C1 | Compilation with invocation and backedge counters |
| 3 | C1 | Compilation with full profiling |
| 4 | C2 | Aggressive optimizations (inlining, escape analysis, loop unrolling) |

```bash
# Show what the JIT is compiling
java -XX:+PrintCompilation -jar myapp.jar

# Output format:
#  timestamp compilation_id attributes tier method_name size deopt
#  125    34       b  3       com.app.Service::process (45 bytes)
#   b = blocking, s = synchronized, % = on-stack replacement, ! = has exception handlers

# Disable C2 compiler (faster startup, less peak performance)
java -XX:TieredStopAtLevel=1 -jar myapp.jar

# Print inlining decisions
java -XX:+UnlockDiagnosticVMOptions -XX:+PrintInlining -jar myapp.jar
```

**Key C2 Optimizations:**

- **Method inlining** -- Eliminates method call overhead by inserting callee code at the call site
- **Escape analysis** -- Determines if an object escapes a method; if not, allocates on the stack
- **Loop unrolling** -- Reduces loop overhead by duplicating loop body
- **Dead code elimination** -- Removes code paths that are never reached
- **Null check elimination** -- Removes redundant null checks after profiling proves non-null

!!! info "GraalVM Native Image vs JIT"
    GraalVM compiles Java to native code **ahead of time** (AOT). This eliminates startup overhead but sacrifices C2's profile-guided optimizations. Use native images for CLI tools and serverless; use JIT for long-running services.

---

## Java Flight Recorder (JFR)

JFR is a low-overhead (<2%) event-based profiling framework built into the JVM since Java 11 (backported to Java 8u262+). It records CPU, memory, I/O, GC, locks, and custom events.

### Enabling JFR

```bash
# Start recording at JVM launch
java -XX:StartFlightRecording=duration=60s,filename=recording.jfr \
     -jar myapp.jar

# Continuous recording with dump on exit
java -XX:StartFlightRecording=disk=true,maxage=1h,maxsize=500m,dumponexit=true,filename=dump.jfr \
     -jar myapp.jar

# Start/stop recording on a running JVM
jcmd <pid> JFR.start name=myrecording settings=profile
jcmd <pid> JFR.dump name=myrecording filename=recording.jfr
jcmd <pid> JFR.stop name=myrecording
```

### JFR Event Categories

| Category | Events Captured |
|---|---|
| **CPU** | Method profiling, thread CPU time, compilation |
| **Memory** | Allocations, GC pauses, heap stats, OOM |
| **I/O** | File reads/writes, socket I/O |
| **Locks** | Contended monitors, thread park/unpark |
| **Code** | Class loading, method compilation, deoptimization |
| **OS** | CPU load, memory usage, context switches |

### Analyzing JFR Recordings

```bash
# Print summary of events
jfr summary recording.jfr

# Print specific events
jfr print --events jdk.GarbageCollection recording.jfr
jfr print --events jdk.CPULoad recording.jfr

# Filter events by thread
jfr print --events jdk.JavaMonitorEnter --stack-depth 10 recording.jfr
```

For visual analysis, open `.jfr` files in **JDK Mission Control (JMC)** -- it provides flame graphs, event histograms, and memory leak detection.

### Custom JFR Events

```java
import jdk.jfr.*;

@Name("com.app.OrderProcessed")
@Label("Order Processed")
@Category({"Application", "Orders"})
@StackTrace(false)
public class OrderProcessedEvent extends Event {
    @Label("Order ID")
    public long orderId;

    @Label("Processing Time (ms)")
    @Timespan(Timespan.MILLISECONDS)
    public long processingTime;

    @Label("Status")
    public String status;
}

// Usage
OrderProcessedEvent event = new OrderProcessedEvent();
event.begin();
processOrder(order);
event.orderId = order.getId();
event.processingTime = System.currentTimeMillis() - start;
event.status = "SUCCESS";
event.commit();
```

---

## JMX and MBeans

Java Management Extensions (JMX) exposes JVM and application metrics through **MBeans** (Managed Beans) over RMI or HTTP.

```bash
# Enable remote JMX (development only — no auth)
java -Dcom.sun.management.jmxremote \
     -Dcom.sun.management.jmxremote.port=9999 \
     -Dcom.sun.management.jmxremote.authenticate=false \
     -Dcom.sun.management.jmxremote.ssl=false \
     -jar myapp.jar
```

**Built-in MBean Domains:**

| MBean | What It Exposes |
|---|---|
| `java.lang:type=Memory` | Heap/non-heap usage, GC counts |
| `java.lang:type=GarbageCollector` | GC invocation count, cumulative time |
| `java.lang:type=Threading` | Thread count, deadlock detection |
| `java.lang:type=OperatingSystem` | CPU load, available processors, system memory |
| `java.lang:type=Runtime` | Uptime, classpath, VM arguments |

### Custom MBeans

```java
// Define the MBean interface
public interface AppMetricsMBean {
    int getActiveConnections();
    long getRequestCount();
    double getAverageLatencyMs();
}

// Implement and register
public class AppMetrics implements AppMetricsMBean {
    private final AtomicInteger activeConnections = new AtomicInteger();
    private final AtomicLong requestCount = new AtomicLong();
    // ... implementation
}

// Register with the platform MBean server
MBeanServer mbs = ManagementFactory.getPlatformMBeanServer();
ObjectName name = new ObjectName("com.app:type=AppMetrics");
mbs.registerMBean(new AppMetrics(), name);
```

!!! warning "JMX in Production"
    Never expose unauthenticated JMX ports in production. Use SSH tunneling, JMX over TLS, or export metrics to Prometheus/Grafana via Micrometer instead.

---

## Profiling & Diagnostic Tools

### jcmd -- The Swiss Army Knife

`jcmd` is the most versatile diagnostic tool. It replaces many older tools.

```bash
# List all Java processes
jcmd -l

# VM version and flags
jcmd <pid> VM.version
jcmd <pid> VM.flags

# Trigger GC
jcmd <pid> GC.run

# Heap info
jcmd <pid> GC.heap_info

# Thread dump
jcmd <pid> Thread.print

# Heap dump
jcmd <pid> GC.heap_dump /tmp/heap.hprof

# JFR control (see JFR section above)
jcmd <pid> JFR.start name=rec settings=profile duration=60s
```

### jstack -- Thread Dumps

```bash
# Capture a thread dump
jstack <pid> > thread_dump.txt

# Force dump even if JVM is hung
jstack -F <pid> > thread_dump.txt

# Include locks information
jstack -l <pid> > thread_dump.txt
```

### jmap -- Memory Diagnostics

```bash
# Heap histogram (live objects only)
jmap -histo:live <pid> | head -30

# Heap dump
jmap -dump:live,format=b,file=heap.hprof <pid>

# Heap summary
jmap -heap <pid>
```

### jstat -- GC Statistics

```bash
# GC stats every 1 second, 10 samples
jstat -gcutil <pid> 1000 10

# Output:
#  S0     S1     E      O      M     CCS    YGC    YGCT   FGC    FGCT   CGC    CGCT   GCT
#  0.00  45.21  67.33  34.12  97.45  93.21   234   1.456    3   0.892    12   0.234  2.582
# S0/S1 = Survivor spaces, E = Eden, O = Old, M = Metaspace
# YGC = Young GC count, FGC = Full GC count, GCT = Total GC time

# Class loader statistics
jstat -class <pid> 1000 5

# JIT compilation statistics
jstat -compiler <pid>
```

### jconsole and VisualVM

| Tool | Strengths | When to Use |
|---|---|---|
| **jconsole** | Built-in, JMX browser, MBean viewer | Quick JMX inspection during development |
| **VisualVM** | Heap/CPU profiling, thread analysis, plugins | Deep profiling, memory leak investigation |
| **JDK Mission Control** | JFR analysis, flame graphs, low overhead | Production profiling via JFR |
| **async-profiler** | Native CPU/allocation profiling, no safepoint bias | Accurate CPU profiling in production |

---

## Thread Dump Analysis

Thread dumps are snapshots of all thread states. They are the primary tool for diagnosing deadlocks, thread starvation, and contention.

**Thread States:**

| State | Meaning |
|---|---|
| `RUNNABLE` | Executing or ready to execute |
| `BLOCKED` | Waiting to acquire a monitor lock |
| `WAITING` | Waiting indefinitely (`Object.wait()`, `LockSupport.park()`) |
| `TIMED_WAITING` | Waiting with timeout (`Thread.sleep()`, `Object.wait(timeout)`) |
| `NEW` | Created but not started |
| `TERMINATED` | Completed execution |

### Detecting Deadlocks

```
Found one Java-level deadlock:
=============================
"Thread-1":
  waiting to lock monitor 0x00007f8b3c003f08 (object 0x00000007160a2c58, a java.lang.Object),
  which is held by "Thread-2"

"Thread-2":
  waiting to lock monitor 0x00007f8b3c005f08 (object 0x00000007160a2c48, a java.lang.Object),
  which is held by "Thread-1"
```

### What to Look For

- **Many threads BLOCKED on the same lock** -- Lock contention, bottleneck
- **Threads stuck in WAITING on a pool** -- Thread pool exhaustion (all workers busy)
- **Threads in TIMED_WAITING on `Thread.sleep`** -- Polling patterns, can indicate inefficiency
- **No RUNNABLE threads** -- Application is completely stalled
- **Same stack traces across multiple dumps** -- Threads are stuck, not progressing

!!! tip "Production Practice"
    Capture **3 thread dumps 5-10 seconds apart** to distinguish stuck threads from threads that are simply slow. If a thread shows the same stack in all 3 dumps, it is truly stuck.

---

## Heap Dump Analysis

Heap dumps capture every object on the heap. They are essential for diagnosing memory leaks and understanding memory footprint.

```bash
# Generate heap dump
jmap -dump:live,format=b,file=heap.hprof <pid>

# Generate heap dump on OOM automatically
java -XX:+HeapDumpOnOutOfMemoryError \
     -XX:HeapDumpPath=/var/log/java/ \
     -jar myapp.jar
```

**Analysis with Eclipse MAT (Memory Analyzer Tool):**

1. **Dominator Tree** -- Shows which objects retain the most memory
2. **Leak Suspects Report** -- Automatic identification of likely leaks
3. **Histogram** -- Object count and size by class
4. **Path to GC Roots** -- Trace why an object is not being collected
5. **OQL (Object Query Language)** -- SQL-like queries on heap objects

```sql
-- OQL: Find all Strings longer than 10,000 characters
SELECT s FROM java.lang.String s WHERE s.value.length > 10000

-- Find all instances of a class
SELECT * FROM com.app.model.User

-- Find objects retaining more than 1MB
SELECT * FROM INSTANCEOF java.lang.Object WHERE @retainedHeapSize > 1048576
```

---

## Common Memory Issues

### OutOfMemoryError Types

| Error | Cause | Fix |
|---|---|---|
| `Java heap space` | Heap is full, GC cannot reclaim enough | Increase `-Xmx`, fix memory leaks, reduce object retention |
| `Metaspace` | Too many classes loaded (classloader leak) | Set `-XX:MaxMetaspaceSize`, fix classloader leaks (common in app servers with hot deploys) |
| `GC overhead limit exceeded` | >98% of time spent in GC, <2% heap recovered | Increase heap or fix leak -- JVM is thrashing |
| `unable to create native thread` | OS thread limit reached | Reduce thread count, increase `ulimit -u`, use virtual threads |
| `Direct buffer memory` | NIO direct buffer limit exceeded | Increase `-XX:MaxDirectMemorySize` or fix buffer leaks |
| `Requested array size exceeds VM limit` | Trying to allocate array > `Integer.MAX_VALUE - 5` | Fix application logic |

### Native Memory Tracking (NMT)

NMT tracks all memory allocated by the JVM itself (heap, metaspace, thread stacks, code cache, GC overhead).

```bash
# Enable NMT (adds ~5-10% overhead)
java -XX:NativeMemoryTracking=summary -jar myapp.jar

# Capture a baseline
jcmd <pid> VM.native_memory baseline

# Compare against baseline (find growth)
jcmd <pid> VM.native_memory summary.diff

# Sample output:
# Total: reserved=5678MB, committed=2345MB
#
# -                 Java Heap (reserved=4096MB, committed=2048MB)
#                             (mmap: reserved=4096MB, committed=2048MB)
#
# -                     Class (reserved=1056MB, committed=128MB)
#                             (classes #15234)
#                             (malloc=2MB)
#                             (mmap: reserved=1054MB, committed=126MB)
#
# -                    Thread (reserved=256MB, committed=256MB)
#                             (thread #254)
#                             (stack: reserved=253MB, committed=253MB)
```

!!! note "Resident Memory > Xmx?"
    The JVM process RSS (Resident Set Size) is always larger than `-Xmx` because it includes metaspace, thread stacks, code cache, GC data structures, direct buffers, and native library allocations. A good rule of thumb: **RSS = Xmx + 300-500MB** for typical applications.

---

## Performance Benchmarking with JMH

JMH (Java Microbenchmark Harness) is the standard for writing reliable Java benchmarks. It handles JIT warmup, dead code elimination, and statistical rigor.

### Setup

```xml
<!-- Maven dependency -->
<dependency>
    <groupId>org.openjdk.jmh</groupId>
    <artifactId>jmh-core</artifactId>
    <version>1.37</version>
</dependency>
<dependency>
    <groupId>org.openjdk.jmh</groupId>
    <artifactId>jmh-generator-annprocess</artifactId>
    <version>1.37</version>
    <scope>provided</scope>
</dependency>
```

### Writing Benchmarks

```java
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
@State(Scope.Thread)
@Warmup(iterations = 5, time = 1, timeUnit = TimeUnit.SECONDS)
@Measurement(iterations = 5, time = 1, timeUnit = TimeUnit.SECONDS)
@Fork(2)
public class StringConcatBenchmark {

    private static final int SIZE = 100;

    @Benchmark
    public String stringBuilder() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < SIZE; i++) {
            sb.append("item").append(i);
        }
        return sb.toString();
    }

    @Benchmark
    public String stringConcat() {
        String result = "";
        for (int i = 0; i < SIZE; i++) {
            result += "item" + i;
        }
        return result;
    }

    @Benchmark
    public String stringJoin() {
        StringJoiner sj = new StringJoiner(",");
        for (int i = 0; i < SIZE; i++) {
            sj.add("item" + i);
        }
        return sj.toString();
    }

    public static void main(String[] args) throws Exception {
        org.openjdk.jmh.Main.main(args);
    }
}
```

**Common JMH Pitfalls:**

- **Dead code elimination** -- Always return the benchmark result or use `Blackhole.consume()`
- **Constant folding** -- JIT may compute results at compile time; use `@State` fields
- **Loop optimization** -- JIT may vectorize or eliminate loops; use `@Benchmark` per operation
- **Not enough warmup** -- C2 needs thousands of invocations; use `@Warmup` iterations

---

## Container-Aware JVM Settings

Modern JVMs (Java 10+) are container-aware and automatically detect **cgroup** memory and CPU limits. Older JVMs see the host's resources, leading to over-allocation.

### Memory in Containers

```bash
# Java 10+ automatically respects container memory limits
# The JVM sets -Xmx to ~25% of container memory by default

# Override with explicit percentage of container memory
java -XX:MaxRAMPercentage=75.0 \       # Use 75% of container memory for heap
     -XX:InitialRAMPercentage=75.0 \   # Start at 75%
     -XX:MinRAMPercentage=50.0 \       # Floor for small containers
     -jar myapp.jar

# Verify what the JVM sees
java -XX:+PrintFlagsFinal -version 2>&1 | grep -i "MaxHeapSize\|ActiveProcessorCount"
```

### CPU in Containers

```bash
# Java 10+ respects CPU limits from cgroups
# E.g., if container has cpu.shares=2, Runtime.getRuntime().availableProcessors() = 2

# Override detected CPU count
java -XX:ActiveProcessorCount=4 -jar myapp.jar
```

### Dockerfile Best Practices

```dockerfile
FROM eclipse-temurin:21-jre-alpine

# Set container-friendly JVM options
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 \
               -XX:InitialRAMPercentage=75.0 \
               -XX:+UseG1GC \
               -XX:MaxGCPauseMillis=200 \
               -XX:+HeapDumpOnOutOfMemoryError \
               -XX:HeapDumpPath=/tmp \
               -XX:+ExitOnOutOfMemoryError"

COPY target/myapp.jar /app/myapp.jar

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/myapp.jar"]
```

!!! danger "ExitOnOutOfMemoryError in Containers"
    Always set `-XX:+ExitOnOutOfMemoryError` in containers. Without it, a JVM that hits OOM may limp along in a degraded state instead of being restarted by Kubernetes. The exit allows the container orchestrator to restart the pod cleanly.

### Key Container Sizing Rules

| Container Memory | Recommended -Xmx | Headroom For |
|---|---|---|
| 512MB | 300MB (`-XX:MaxRAMPercentage=60`) | Metaspace, threads, native |
| 1GB | 700MB (`-XX:MaxRAMPercentage=70`) | Moderate app |
| 2GB | 1.5GB (`-XX:MaxRAMPercentage=75`) | Typical microservice |
| 4GB | 3GB (`-XX:MaxRAMPercentage=75`) | Larger services |
| 8GB+ | 6GB (`-XX:MaxRAMPercentage=75`) | Data-heavy services |

---

## Production JVM Configuration Template

A battle-tested starting configuration for Java 21 microservices:

```bash
java \
  # Memory
  -XX:MaxRAMPercentage=75.0 \
  -XX:InitialRAMPercentage=75.0 \
  -XX:MaxMetaspaceSize=256m \
  -XX:+AlwaysPreTouch \                  # Touch all heap pages at startup (avoids RSS growth later)
  \
  # GC
  -XX:+UseG1GC \
  -XX:MaxGCPauseMillis=200 \
  -XX:+ParallelRefProcEnabled \          # Parallel reference processing
  \
  # Resilience
  -XX:+HeapDumpOnOutOfMemoryError \
  -XX:HeapDumpPath=/var/log/java/ \
  -XX:+ExitOnOutOfMemoryError \
  \
  # Diagnostics
  -Xlog:gc*:file=/var/log/java/gc.log:time,uptime,level,tags:filecount=5,filesize=20m \
  -XX:StartFlightRecording=disk=true,maxage=6h,maxsize=1g,dumponexit=true,filename=/var/log/java/flight.jfr \
  \
  # JMX (behind firewall/service mesh only)
  -Dcom.sun.management.jmxremote.port=9090 \
  -Dcom.sun.management.jmxremote.rmi.port=9090 \
  -Dcom.sun.management.jmxremote.authenticate=true \
  -Dcom.sun.management.jmxremote.ssl=true \
  \
  -jar myapp.jar
```

---

## Interview Questions

??? question "What is the difference between -Xms, -Xmx, and -Xss? When would you set -Xms equal to -Xmx?"

    - **`-Xms`** sets the **initial heap size**. The JVM starts with this much heap allocated.
    - **`-Xmx`** sets the **maximum heap size**. The JVM cannot grow the heap beyond this.
    - **`-Xss`** sets the **thread stack size** for each thread (default ~512KB-1MB).

    You set `-Xms` equal to `-Xmx` in **production** to:

    1. **Avoid heap resizing pauses** -- The JVM does not need to request more memory from the OS during runtime
    2. **Predictable memory footprint** -- Important for container resource limits (Kubernetes)
    3. **Avoid fragmentation** -- The OS allocates one contiguous block upfront

    Pair with `-XX:+AlwaysPreTouch` to fault in all pages at startup, avoiding page faults during peak load.

??? question "How does G1GC work and how would you tune it for a latency-sensitive application?"

    **G1GC (Garbage-First Garbage Collector)** divides the heap into equally-sized regions (1-32MB). Each region is dynamically assigned as Eden, Survivor, Old, or Humongous. G1 maintains a priority queue of regions sorted by garbage density and collects the most garbage-rich regions first.

    **Collection lifecycle:**

    1. **Young GC** -- Evacuates live objects from Eden/Survivor regions (STW)
    2. **Concurrent marking** -- Triggered when heap occupancy exceeds `InitiatingHeapOccupancyPercent` (default 45%). Marks live objects concurrently with application threads.
    3. **Mixed GC** -- Collects both young and old regions with high garbage
    4. **Full GC (fallback)** -- Happens only if G1 cannot keep up; single-threaded and very slow

    **Tuning for latency:**

    - `-XX:MaxGCPauseMillis=100` -- Set aggressive pause target
    - `-XX:InitiatingHeapOccupancyPercent=35` -- Start concurrent marking earlier to avoid Full GC
    - `-XX:G1HeapRegionSize=16m` -- Larger regions reduce humongous allocations for large objects
    - `-XX:G1ReservePercent=15` -- More reserve space prevents to-space exhaustion
    - Give enough heap that G1 is never pressured into Full GC

??? question "Explain ZGC. When would you choose it over G1GC?"

    **ZGC** is a concurrent garbage collector that achieves **sub-millisecond pause times** regardless of heap size. It uses **colored pointers** (metadata stored in pointer bits) and **load barriers** (inserted by JIT at every reference load) to perform relocation concurrently with the application.

    **Key properties:**

    - Pause times are **O(1)** with respect to heap size -- even multi-terabyte heaps have <1ms pauses
    - Since Java 21, ZGC supports **generational mode**, which improves throughput by separating short-lived and long-lived objects
    - Memory is returned to the OS when not needed (`-XX:SoftMaxHeapSize`)

    **Choose ZGC over G1 when:**

    - p99 latency SLAs require sub-millisecond tail latencies
    - Heap sizes exceed 16GB (G1 pause times scale with heap)
    - Serving latency-sensitive workloads (ad bidding, financial services, gaming)
    - Running on Java 21+ where Generational ZGC closes the throughput gap with G1

    **Stick with G1 when:**

    - Heap is moderate (2-8GB) and throughput matters more than worst-case latency
    - Running on older Java versions (ZGC was experimental before Java 15)
    - Your workload is batch-oriented rather than latency-sensitive

??? question "How would you diagnose a memory leak in a production Java application?"

    **Step-by-step approach:**

    1. **Detect** -- Monitor heap usage trends via JMX/Prometheus. A leak shows a sawtooth pattern where the baseline after each Full GC steadily rises.

    2. **Capture evidence** -- Take two heap dumps separated by time:
       ```bash
       jcmd <pid> GC.heap_dump /tmp/heap1.hprof
       # Wait 10-30 minutes
       jcmd <pid> GC.heap_dump /tmp/heap2.hprof
       ```

    3. **Analyze with Eclipse MAT:**
       - Open the **Leak Suspects** report for automatic detection
       - Compare **histograms** between the two dumps to identify growing classes
       - Use **Dominator Tree** to find which objects retain the most memory
       - Trace **Path to GC Roots** to find the reference chain keeping leaked objects alive

    4. **Common leak sources:**
       - Static collections (`Map`, `List`) that grow unbounded
       - Listeners/callbacks not deregistered
       - Thread-local variables in thread pools (threads are reused, ThreadLocal is never cleared)
       - Classloader leaks in app servers with hot deploy
       - Unclosed resources (`Connection`, `InputStream`, `ResultSet`)

    5. **Fix** -- Remove the strong reference, add cleanup hooks, use `WeakReference` where appropriate, or close resources in finally/try-with-resources.

??? question "What is Java Flight Recorder (JFR) and how would you use it in production?"

    **JFR** is a low-overhead (<2%) profiling and event recording framework built into the JVM. It records events about GC, CPU, memory, I/O, threads, locks, and custom application events into a binary `.jfr` file.

    **Production usage:**

    - **Always-on continuous recording:** Start JFR at JVM launch with `maxage` and `maxsize` limits. When an incident occurs, dump the recording.
      ```bash
      java -XX:StartFlightRecording=disk=true,maxage=6h,maxsize=1g,dumponexit=true \
           -jar myapp.jar
      ```
    - **On-demand recording:** Use `jcmd` to start a recording when investigating an issue:
      ```bash
      jcmd <pid> JFR.start name=incident settings=profile duration=120s
      jcmd <pid> JFR.dump name=incident filename=/tmp/incident.jfr
      ```
    - **Analysis:** Open in JDK Mission Control (JMC) for flame graphs, allocation hot spots, GC analysis, and lock contention visualization.

    **Why JFR over other profilers:**

    - No safepoint bias (unlike tools that only sample at safepoints)
    - Built into the JVM -- no agent attachment or bytecode instrumentation
    - Designed for production use with negligible overhead
    - Records system-level events (not just Java) like CPU load, I/O wait

??? question "How does the JVM behave in containers, and what flags are important for containerized deployments?"

    **Pre-Java 10 problem:** The JVM read `/proc/meminfo` and `/proc/cpuinfo`, seeing the **host's** resources instead of the container's cgroup limits. A container with 2GB limit on a 64GB host would get `-Xmx` of ~16GB, causing OOM kills.

    **Java 10+ solution:** The JVM reads cgroup v1/v2 limits automatically:

    - `Runtime.getRuntime().availableProcessors()` returns the container's CPU quota
    - Default `-Xmx` is ~25% of the container's memory limit

    **Key flags for containers:**

    - `-XX:MaxRAMPercentage=75.0` -- Use 75% of container memory for heap (better than `-Xmx` which is a fixed value)
    - `-XX:+ExitOnOutOfMemoryError` -- Exit on OOM so Kubernetes restarts the pod
    - `-XX:+HeapDumpOnOutOfMemoryError` -- Capture heap dump before exit
    - `-XX:ActiveProcessorCount=N` -- Override detected CPU count if needed
    - `-XX:+AlwaysPreTouch` -- Commit all heap memory at startup so RSS matches committed immediately

    **Sizing rule:** Container memory should be **Xmx + 300-500MB** to leave room for metaspace, thread stacks, code cache, NIO buffers, and native allocations.

??? question "Explain the JIT compilation process. What are C1 and C2 compilers?"

    The JVM uses **tiered compilation** (default since Java 8) that combines two compilers:

    - **C1 (Client Compiler):** Fast compilation with basic optimizations. Used for methods that are warm but not yet hot. Produces code quickly to reduce interpretation overhead.
    - **C2 (Server Compiler):** Slow compilation with aggressive optimizations (inlining, escape analysis, loop unrolling, vectorization). Produces highly optimized native code for the hottest methods.

    **Compilation tiers:** 0 (interpreter) -> 1-3 (C1 with increasing profiling) -> 4 (C2). Methods progress through tiers as they accumulate invocation counts and profiling data.

    **Key optimizations in C2:**

    - **Inlining:** Copies the callee's code into the caller, eliminating method call overhead. The single most impactful optimization.
    - **Escape Analysis:** Determines if an object escapes the method. If not, allocates on the stack (no GC pressure) or eliminates the allocation entirely (scalar replacement).
    - **Loop Unrolling:** Reduces loop overhead by replicating the loop body.
    - **Deoptimization:** If a speculative optimization is invalidated (e.g., a new subclass is loaded), the JVM falls back to the interpreter.

    Use `-XX:+PrintCompilation` to see what is being compiled and `-XX:TieredStopAtLevel=1` for fast startup (skip C2).

??? question "How would you analyze a thread dump to find the root cause of application hanging?"

    **Capture:** Take 3 thread dumps 5-10 seconds apart using `jstack <pid>` or `jcmd <pid> Thread.print`. Multiple dumps differentiate stuck threads from merely slow ones.

    **Analysis steps:**

    1. **Check for deadlocks** -- Look for "Found one Java-level deadlock" in the dump output. If present, identify the two (or more) threads and the locks they hold and wait for.

    2. **Count thread states:**
       - Many `BLOCKED` threads on the same monitor = lock contention bottleneck
       - Many `WAITING` threads in a thread pool = pool exhaustion (all workers blocked on downstream calls)
       - Threads in `RUNNABLE` state doing I/O = potential slow external dependency

    3. **Find stuck threads** -- Compare the same thread across all 3 dumps. If it shows the same stack trace in all 3, it is stuck.

    4. **Follow the chain** -- If Thread A is BLOCKED waiting for a lock held by Thread B, check what Thread B is doing. It might be waiting for a database connection, making an HTTP call, or also blocked on another lock.

    5. **Common root causes:**
       - Database connection pool exhaustion (all connections checked out, threads waiting)
       - Downstream service timeout (threads stuck in `SocketInputStream.read()`)
       - Synchronized block contention (one thread holding a lock while doing I/O)
       - Deadlock (circular lock dependency)

??? question "What are the different types of OutOfMemoryError and how do you handle each?"

    | Error | Root Cause | Diagnosis | Resolution |
    |---|---|---|---|
    | `Java heap space` | Heap is full, usually a memory leak or under-sizing | Heap dump analysis (MAT dominator tree, leak suspects) | Fix leak or increase `-Xmx` |
    | `Metaspace` | Too many classes loaded, typically classloader leak | `jcmd <pid> VM.native_memory summary` + heap dump filtered to `ClassLoader` | Fix hot-deploy leak, set `-XX:MaxMetaspaceSize` |
    | `GC overhead limit exceeded` | JVM spending >98% time in GC, recovering <2% | GC logs show back-to-back Full GCs with minimal recovery | Fix the memory leak; increasing heap only delays the inevitable |
    | `unable to create native thread` | OS thread limit or virtual memory exhausted | `jcmd <pid> Thread.print` shows thousands of threads | Reduce thread count, use thread pools, increase `ulimit -u` |
    | `Direct buffer memory` | NIO direct buffers not freed | NMT or `-XX:MaxDirectMemorySize` monitoring | Close NIO channels properly, increase direct memory limit |

    **Best practice:** Always run production JVMs with `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/var/log/java/`. This automatically captures the evidence you need for post-mortem analysis.

??? question "What is JMH and why can't you just use System.currentTimeMillis() for benchmarking?"

    **JMH (Java Microbenchmark Harness)** is the standard benchmarking framework created by the OpenJDK team. It handles the complexities that make naive benchmarking unreliable:

    **Why System.currentTimeMillis() fails:**

    1. **JIT warmup:** The first N invocations run interpreted or partially compiled. JMH runs configurable warmup iterations to reach steady state.
    2. **Dead code elimination:** If the JIT detects the result is unused, it removes the entire computation. JMH returns results from `@Benchmark` methods to a `Blackhole` that prevents elimination.
    3. **Constant folding:** If inputs are compile-time constants, the JIT computes results at compile time. JMH uses `@State` objects to prevent this.
    4. **Loop optimization:** A tight benchmark loop might be vectorized or eliminated. JMH controls invocation granularity.
    5. **GC noise:** A GC pause during your measurement skews results. JMH uses statistical methods (multiple forks, iterations) to produce reliable averages with error bars.

    **JMH output includes** mean, error margin, confidence intervals, and percentiles -- giving you statistical confidence that one implementation is faster than another.

---

## Quick Reference Cheat Sheet

```bash
# ─── Heap & Memory ──────────────────────────────────────────────
-Xms4g -Xmx4g                           # Fixed heap size
-XX:MaxMetaspaceSize=256m                # Cap metaspace
-XX:MaxDirectMemorySize=256m             # Cap NIO buffers
-XX:+AlwaysPreTouch                      # Pre-fault heap pages

# ─── GC Selection ───────────────────────────────────────────────
-XX:+UseG1GC                             # G1 (default Java 9+)
-XX:+UseZGC                              # ZGC (low latency)
-XX:+UseParallelGC                       # Throughput-first

# ─── G1 Tuning ──────────────────────────────────────────────────
-XX:MaxGCPauseMillis=200                 # Pause target
-XX:InitiatingHeapOccupancyPercent=45    # Start concurrent marking
-XX:G1HeapRegionSize=16m                 # Region size

# ─── Diagnostics ────────────────────────────────────────────────
-XX:+HeapDumpOnOutOfMemoryError          # Auto heap dump
-XX:+ExitOnOutOfMemoryError              # Exit on OOM (containers)
-XX:NativeMemoryTracking=summary         # Track native memory

# ─── GC Logging (Java 11+) ─────────────────────────────────────
-Xlog:gc*:file=gc.log:time,level,tags:filecount=5,filesize=20m

# ─── JFR ────────────────────────────────────────────────────────
-XX:StartFlightRecording=disk=true,maxage=6h,maxsize=1g,dumponexit=true

# ─── Container ──────────────────────────────────────────────────
-XX:MaxRAMPercentage=75.0                # % of container memory
-XX:ActiveProcessorCount=4               # Override CPU count
```
