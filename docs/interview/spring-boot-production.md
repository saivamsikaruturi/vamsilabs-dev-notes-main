---
title: "Spring Boot Production Troubleshooting Guide"
description: "Practical Spring Boot production troubleshooting guide — diagnose memory leaks, heap dumps, slow startup, HikariCP connection pool exhaustion, health check failures, thread pool issues, and GC tuning. Written for on-call engineers."
---

# Spring Boot Production Troubleshooting Guide

> **Written for the engineer who gets paged at 2am.** No theory, no hand-waving — just what breaks, why, and how to fix it fast.

The gap between "works locally" and "works in production" is enormous. Tests don't catch: memory leaks under sustained load, connection pool exhaustion from a single slow query, GC pauses that violate SLAs, or startup timing issues that fail Kubernetes readiness probes. This guide covers all of it.

---

## What Tests Miss That Production Exposes

| Local / Test | Production Reality |
|---|---|
| Tiny dataset, fast DB | N+1 queries take 20ms locally, 2000ms on prod data |
| Single request, no concurrency | 50 concurrent requests saturate a 10-connection pool |
| JVM warm, app never restarts | Metaspace leak causes OOM after 3 days |
| No resource limits | Kubernetes OOMKills pod — no heap dump, no logs |
| 1 bean, no scan overhead | 500-bean app takes 40s to start, fails readiness probe |
| No long-running state | ThreadLocal leaks accumulate over thousands of requests |

**The rule:** production issues are almost always about *time*, *concurrency*, and *resource limits* — none of which unit tests exercise.

---

## Section 1 — Memory Issues

### Memory Regions to Understand

```
JVM Memory Layout
┌─────────────────────────────────────────────────────────┐
│  JVM Process Memory                                      │
│  ┌───────────────────────────────┐  ┌─────────────────┐ │
│  │  Java Heap (-Xms / -Xmx)     │  │  Metaspace      │ │
│  │  ┌──────────────┬──────────┐  │  │  (class meta,   │ │
│  │  │  Young Gen   │ Old Gen  │  │  │   no hard limit │ │
│  │  │  (Eden+S0+S1)│          │  │  │   by default)   │ │
│  │  └──────────────┴──────────┘  │  └─────────────────┘ │
│  └───────────────────────────────┘                       │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  Thread Stacks  │  │  Direct Memory (NIO buffers, │  │
│  │  (~512KB each)  │  │  Netty, mapped files)        │  │
│  └─────────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Heap OOM** → `java.lang.OutOfMemoryError: Java heap space` — objects not getting collected.

**Metaspace OOM** → `java.lang.OutOfMemoryError: Metaspace` — too many classes loaded (ClassLoader leaks in OSGi, hot-reloading, dynamic codegen).

**Direct memory OOM** → `java.lang.OutOfMemoryError: Direct buffer memory` — Netty/NIO not releasing off-heap buffers. Set `-XX:MaxDirectMemorySize`.

### Essential JVM Flags for Production

```bash
java \
  -Xms2g -Xmx2g \                             # Set equal — avoid heap resize pauses
  -XX:+UseG1GC \                               # G1 default; use ZGC for <1ms latency
  -XX:MaxGCPauseMillis=200 \                   # Target pause time (G1)
  -XX:+HeapDumpOnOutOfMemoryError \            # CRITICAL — auto-dump on OOM
  -XX:HeapDumpPath=/dumps/heap.hprof \         # Writable volume in K8s
  -XX:+ExitOnOutOfMemoryError \                # Kill pod on OOM (don't limp)
  -XX:MaxMetaspaceSize=512m \                  # Put a ceiling on Metaspace
  -XX:MaxDirectMemorySize=256m \               # Cap NIO direct buffers
  -XX:+PrintGCDetails \                        # GC logging (Java 8)
  -Xlog:gc*:file=/logs/gc.log:time,uptime \   # GC logging (Java 11+)
  -XX:+UseContainerSupport \                   # Respect container memory limits
  -XX:MaxRAMPercentage=75.0 \                  # Use 75% of container RAM for heap
  -jar app.jar
```

!!! warning "K8s OOMKill leaves no trace"
    If you don't set `-XX:+HeapDumpOnOutOfMemoryError` with a mounted volume, Kubernetes will OOMKill the pod and you will have zero evidence. Always mount a `/dumps` volume and configure this flag.

### Detecting Memory Leaks

**Step 1: Confirm it's a leak, not undersized heap**

```bash
# Check if GC is constantly running (GC overhead)
# In GC log, look for: too frequent full GCs with heap still high after collection
grep "GC\|Heap" /logs/gc.log | tail -50

# Or via JMX / actuator
curl http://localhost:8080/actuator/metrics/jvm.memory.used?tag=area:heap
```

**Step 2: Capture a heap dump**

```bash
# Attach to running process (pid = $(pgrep -f app.jar))
jmap -dump:format=b,file=/tmp/heap.hprof <pid>

# Or trigger via actuator (Spring Boot Actuator)
curl -X POST http://localhost:8080/actuator/heapdump -o heap.hprof

# Or JVM will auto-dump on OOM if you set the flag above
```

**Step 3: Analyze with Eclipse MAT (Memory Analyzer Tool)**

1. Open heap.hprof in MAT
2. Run **Leak Suspects Report** — MAT points to the largest retained object trees
3. Look at **Dominator Tree** — find the root object holding the most memory
4. Use **OQL** (Object Query Language) to query for specific types: `SELECT * FROM java.util.HashMap`

**Step 4: Find the GC root**

In MAT, right-click a suspicious object → **Path to GC Roots** → **Exclude weak/soft refs**. This shows you exactly which live reference chain is preventing collection.

### Common Leak Sources in Spring Boot

**1. Static caches / Maps that grow unbounded**

```java
// LEAK: static map with no eviction
private static final Map<String, UserData> cache = new HashMap<>();

// FIX: use Caffeine with size and TTL
@Bean
public Cache<String, UserData> userCache() {
    return Caffeine.newBuilder()
        .maximumSize(10_000)
        .expireAfterWrite(Duration.ofMinutes(30))
        .build();
}
```

**2. ThreadLocal variables not removed**

```java
// LEAK: RequestContext not cleared after request
private static ThreadLocal<RequestContext> context = new ThreadLocal<>();

// FIX: always remove in a finally block or servlet filter
try {
    context.set(new RequestContext(request));
    doFilter(request, response, chain);
} finally {
    context.remove(); // CRITICAL — thread goes back to pool, not destroyed
}
```

In Spring, use `RequestContextHolder` — it handles cleanup automatically via `DispatcherServlet`.

**3. ClassLoader leaks (dynamic class loading)**

Occur with: JDBC drivers registered to `DriverManager`, Spring DevTools in production, scripting engines (Groovy, JRuby), or redeployment. Metaspace grows without bound.

```bash
# Detect: Metaspace growing? Count loaded classes
jcmd <pid> VM.class_stats | sort -k2 -rn | head -20
```

**4. Event listeners not unregistered**

```java
// LEAK: registers listener but never removes it
applicationContext.addApplicationListener(myListener);

// FIX: use @EventListener (Spring manages lifecycle)
@EventListener
public void handleOrderCreated(OrderCreatedEvent event) { ... }
// Or implement ApplicationListener and let Spring manage it as a bean
```

**5. Hibernate first-level cache in long transactions**

```java
// LEAK: processing 1M rows in one transaction loads them all into session cache
@Transactional
public void processAll() {
    List<Order> orders = repo.findAll(); // 1M objects in session cache
    orders.forEach(this::process);
}

// FIX: process in batches, clear session cache
@Transactional
public void processAll(EntityManager em) {
    int batch = 500;
    for (int i = 0; ; i += batch) {
        List<Order> page = repo.findPage(i, batch);
        if (page.isEmpty()) break;
        page.forEach(this::process);
        em.flush();
        em.clear(); // clear session cache
    }
}
```

### GC Log Analysis

```bash
# Java 11+ GC log format — key patterns to look for
# Healthy: short young GC pauses, heap freed significantly
[2.456s][info][gc] GC(42) Pause Young (Normal) (G1 Evacuation Pause) 512M->128M(2048M) 12.543ms

# Warning: long GC pause or frequent full GC
[3.123s][info][gc] GC(43) Pause Full (Ergonomics) 1800M->1750M(2048M) 4500.234ms
#                                                  ^^ heap barely freed = leak

# Key metrics to extract:
# - Pause duration > 500ms = investigate GC tuning or leak
# - Heap after GC trending up over time = leak
# - Full GC frequency > 1/hour = either undersized or leaking
```

Use **GCEasy.io** (paste log online) or **JVM GC Analyzer** for visual analysis.

---

## Section 2 — Slow Startup

### Spring Boot Startup Timeline

```
0ms    → JVM starts, agent initialization
50ms   → SpringApplication.run() begins
100ms  → ApplicationContext created
150ms  → Environment prepared (properties, profiles loaded)
200ms  → Bean definitions scanned (@ComponentScan)
        ↳ Scans all packages for @Component, @Service, etc.
        ↳ Expensive if base package is too broad
500ms  → Beans instantiated and wired (DI graph resolved)
        ↳ Each @Autowired constructor called
        ↳ @PostConstruct methods run
800ms  → Auto-configuration processed
        ↳ DataSource initialized (first DB connection)
        ↳ Flyway/Liquibase migrations run
        ↳ JPA/Hibernate entity scan and schema validation
1200ms → Embedded Tomcat starts, port bound
1500ms → ApplicationReadyEvent fired
        ↳ App reports UP to readiness probe
```

**Slow startup usually comes from:** wide `@ComponentScan`, Hibernate entity scan on large schema, slow DB connection during startup, or synchronous external API calls in `@PostConstruct`.

### Profiling Startup

```bash
# Enable class loading log to see what's being loaded and when
java -Xlog:class+load:file=/tmp/classload.log -jar app.jar

# Spring Boot 2.5+ — startup actuator endpoint
curl http://localhost:8080/actuator/startup | python3 -m json.tool
# Shows each ApplicationContext event with duration
```

```yaml
# application.yml — enable startup endpoint
management:
  endpoints:
    web:
      exposure:
        include: startup, health, metrics
```

```bash
# Parse startup endpoint to find slowest steps
curl -s http://localhost:8080/actuator/startup | \
  jq '.timeline.events | sort_by(.duration) | reverse | .[0:10] | .[] | {name: .startupStep.name, duration: .duration}'
```

### Lazy Initialization

```yaml
# application.yml — lazily initialize all beans
spring:
  main:
    lazy-initialization: true
```

This defers bean creation until first use. **Trade-off:** first request after startup is slow (beans created on demand). Best for dev environments or apps with many unused beans.

For production, be selective:

```java
// Only mark expensive beans as lazy
@Lazy
@Bean
public ExpensiveReportEngine reportEngine() {
    return new ExpensiveReportEngine(); // Only created when first needed
}

// Or lazy-inject a dependency
@Autowired
@Lazy
private ExpensiveService expensiveService;
```

### Reducing ComponentScan Overhead

```java
// BAD: scans entire com.mycompany tree (thousands of classes)
@SpringBootApplication // defaults to scanning everything under the main class package
public class App { }

// BETTER: narrow the scan
@SpringBootApplication(scanBasePackages = {
    "com.mycompany.app.web",
    "com.mycompany.app.service",
    "com.mycompany.app.repository"
})
public class App { }
```

```yaml
# Disable Hibernate schema validation on startup (saves 200-500ms on large schemas)
spring:
  jpa:
    hibernate:
      ddl-auto: none      # don't validate/create schema
    properties:
      hibernate:
        temp:
          use_jdbc_metadata_defaults: false  # skip metadata fetch
```

### Deferring DB Connection

```yaml
# Don't initialize DataSource until first use
spring:
  datasource:
    hikari:
      initialization-fail-timeout: -1  # Don't fail startup if DB unreachable
  jpa:
    open-in-view: false  # Don't hold DB connections across HTTP request lifecycle
```

!!! tip "open-in-view: false is required in production"
    The default is `true` — Hibernate session held open for entire HTTP request. Under load, this can hold DB connections while waiting for JSON serialization, template rendering, etc. Always set `open-in-view: false`.

---

## Section 3 — Connection Pool Exhaustion (HikariCP)

### Recognizing the Symptom

```
HikariPool-1 - Connection is not available, request timed out after 30000ms.
```

This means all connections in the pool are checked out and no new connection was released within `connectionTimeout`. The pool is exhausted.

### HikariCP Tuning

```yaml
spring:
  datasource:
    url: jdbc:postgresql://db:5432/mydb
    username: app
    password: secret
    hikari:
      # Pool size — formula: (core_count * 2) + effective_spindle_count
      # For 4-core CPU with SSD: (4 * 2) + 1 = 9 → round to 10
      maximum-pool-size: 10
      minimum-idle: 5              # Keep 5 connections ready
      
      # Timeouts
      connection-timeout: 5000     # Max wait for a connection (ms) — default 30s is too long
      idle-timeout: 600000         # Remove idle connections after 10 min
      max-lifetime: 1800000        # Retire connections after 30 min (shorter than DB timeout)
      keepalive-time: 60000        # Ping idle connections to prevent stale connections
      
      # Leak detection — ALWAYS enable in production
      leak-detection-threshold: 5000  # Log warning if connection held > 5s
      
      # Connection validation
      connection-test-query: SELECT 1   # For DBs that don't support isValid()
      validation-timeout: 1000
      
      pool-name: MyApp-HikariPool
```

!!! danger "maximumPoolSize is not 'bigger is better'"
    More connections = more DB server threads = more memory on DB server = more lock contention. Beyond the formula above, adding connections *reduces* throughput. The real fix is faster queries.

### Finding the Leak

**Enable leak detection and check logs:**

```bash
# When leak-detection-threshold is set, HikariCP logs:
WARN  HikariPool-1 - Connection leak detection triggered for
      com.zaxxer.hikari.pool.ProxyConnection@abc123 on thread http-nio-8080-exec-5,
      stack trace follows
      java.lang.Exception: Apparent connection leak detected
          at com.myapp.OrderRepository.findById(OrderRepository.java:42)
          at com.myapp.OrderService.getOrder(OrderService.java:28)
```

**Common causes:**

**1. Missing @Transactional boundary**

```java
// LEAK: manually opens connection, but exception prevents close
public Order process(Long id) {
    Connection conn = dataSource.getConnection(); // checked out
    // ... exception thrown here ...
    conn.close(); // never reached
}

// FIX: use try-with-resources
try (Connection conn = dataSource.getConnection()) {
    // connection auto-closed
}
// OR better: let Spring's @Transactional manage it
@Transactional
public Order process(Long id) { ... } // connection returned at end of transaction
```

**2. Long-running transactions holding connections**

```java
// LEAK: transaction spans an external HTTP call — holds DB connection while waiting
@Transactional
public Order processOrder(Long id) {
    Order order = repo.findById(id);      // gets DB connection
    paymentClient.charge(order);          // HTTP call — could take 5s!
    repo.save(order);                     // connection held the whole time
    return order;
}

// FIX: minimize transaction scope
public Order processOrder(Long id) {
    Order order = loadOrder(id);              // short transaction
    PaymentResult result = paymentClient.charge(order); // outside transaction
    return saveResult(order, result);         // short transaction
}

@Transactional(readOnly = true)
private Order loadOrder(Long id) { return repo.findById(id).orElseThrow(); }

@Transactional
private Order saveResult(Order order, PaymentResult result) { ... }
```

**3. N+1 queries holding connections longer**

Fix N+1 (use `JOIN FETCH` / `@EntityGraph`). Faster queries = connections returned sooner = pool not exhausted.

### Monitoring HikariCP via Actuator

```yaml
# Enable HikariCP metrics
spring:
  datasource:
    hikari:
      register-mbeans: true  # JMX exposure

management:
  metrics:
    enable:
      hikaricp: true
```

```bash
# Check pool metrics
curl http://localhost:8080/actuator/metrics/hikaricp.connections.active
curl http://localhost:8080/actuator/metrics/hikaricp.connections.idle
curl http://localhost:8080/actuator/metrics/hikaricp.connections.pending  # waiters!
curl http://localhost:8080/actuator/metrics/hikaricp.connections.acquire  # avg wait time
```

**Alert if `hikaricp.connections.pending > 0` for more than 30 seconds** — you're at capacity.

---

## Section 4 — Health & Readiness

### Actuator /health Breakdown

```bash
# Full health details (enable in config first)
curl http://localhost:8080/actuator/health | python3 -m json.tool
```

```json
{
  "status": "UP",
  "components": {
    "db": {
      "status": "UP",
      "details": { "database": "PostgreSQL", "validationQuery": "isValid()" }
    },
    "diskSpace": {
      "status": "UP",
      "details": { "total": 10GB, "free": 8GB, "threshold": 10MB }
    },
    "redis": { "status": "UP" },
    "circuitBreakers": {
      "status": "UP",
      "details": {
        "paymentService": { "status": "CLOSED", "bufferedCalls": 10 }
      }
    }
  }
}
```

```yaml
# application.yml — expose details for internal monitoring
management:
  endpoint:
    health:
      show-details: always        # expose full details (restrict to ROLE_ADMIN in prod)
      show-components: always
  endpoints:
    web:
      exposure:
        include: health, metrics, info, prometheus
  health:
    db:
      enabled: true
    diskspace:
      enabled: true
      threshold: 100MB            # warn if less than 100MB free
```

### Liveness vs Readiness in Kubernetes

```yaml
# Spring Boot 2.3+ — automatic K8s probe groups
management:
  endpoint:
    health:
      probes:
        enabled: true  # enables /actuator/health/liveness and /actuator/health/readiness

# k8s deployment spec
livenessProbe:
  httpGet:
    path: /actuator/health/liveness  # Is the app alive? (not deadlocked)
    port: 8080
  initialDelaySeconds: 60            # Give app time to start
  periodSeconds: 10
  failureThreshold: 3                # Restart after 3 failures

readinessProbe:
  httpGet:
    path: /actuator/health/readiness  # Is the app ready to serve traffic?
    port: 8080
  initialDelaySeconds: 20            # Earlier — check readiness sooner
  periodSeconds: 5
  failureThreshold: 6                # Remove from load balancer after 30s
```

**Liveness** = "should Kubernetes restart this pod?" → fails only on deadlock / unrecoverable state. Never fail liveness for a slow DB — the restart makes it worse.

**Readiness** = "should this pod receive traffic?" → fails when dependencies (DB, cache) are unreachable. Pod stays running but is removed from the load balancer.

```java
// Mark readiness as DOWN during graceful shutdown
@Bean
public ApplicationAvailability availability() {
    return ApplicationAvailability.get(applicationContext);
}

// Manually change readiness state (e.g., before maintenance)
@Autowired
private ApplicationEventPublisher publisher;

public void goOffline() {
    publisher.publishEvent(new AvailabilityChangeEvent<>(
        this, ReadinessState.REFUSING_TRAFFIC));
}
```

### Custom HealthIndicator

```java
@Component
public class ExternalServiceHealthIndicator implements HealthIndicator {

    private final ExternalServiceClient client;

    public ExternalServiceHealthIndicator(ExternalServiceClient client) {
        this.client = client;
    }

    @Override
    public Health health() {
        try {
            // Keep health checks fast — timeout < 3s
            boolean available = client.ping(Duration.ofSeconds(2));
            if (available) {
                return Health.up()
                    .withDetail("url", client.getBaseUrl())
                    .withDetail("responseTime", "< 2s")
                    .build();
            } else {
                return Health.down()
                    .withDetail("reason", "ping timeout")
                    .build();
            }
        } catch (Exception ex) {
            return Health.down(ex)
                .withDetail("url", client.getBaseUrl())
                .build();
        }
    }
}
```

!!! warning "Health checks that are too aggressive kill production"
    A health check that runs a DB query every 5 seconds, times out, and flips the pod out of the load balancer can cause a cascade: pod removed → traffic shifted to other pods → those pods get more requests → their health checks also slow → all pods flip → outage. Make health checks cheap (SELECT 1, not SELECT COUNT(*) FROM orders).

### CircuitBreaker Health Contribution

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-circuitbreaker-resilience4j</artifactId>
</dependency>
```

```yaml
# application.yml — expose circuit breaker health
resilience4j:
  circuitbreaker:
    instances:
      paymentService:
        registerHealthIndicator: true
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 10s
```

Circuit breaker health will appear as `circuitBreakers` in `/actuator/health`. When `paymentService` is OPEN, readiness stays UP (the circuit breaker is doing its job) but you get an alert to investigate the downstream.

---

## Section 5 — Thread Pool & Async Issues

### @Async Thread Pool Exhaustion

Default `@Async` uses `SimpleAsyncTaskExecutor` — **creates a new thread per task, no pool, no queue limit**. Under load, this spawns thousands of threads and causes OOM.

```java
// BAD: default @Async with SimpleAsyncTaskExecutor
@Async
public CompletableFuture<String> doWork() { ... }

// GOOD: configure a bounded thread pool
@Configuration
@EnableAsync
public class AsyncConfig implements AsyncConfigurer {

    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);          // always-alive threads
        executor.setMaxPoolSize(50);           // expand up to 50 under load
        executor.setQueueCapacity(500);        // queue up to 500 tasks before rejecting
        executor.setThreadNamePrefix("async-worker-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        // CallerRunsPolicy: if pool full, caller thread executes the task (backpressure)
        executor.initialize();
        return executor;
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) ->
            log.error("Uncaught async exception in {}: {}", method.getName(), ex.getMessage(), ex);
    }
}
```

**Diagnosing thread pool exhaustion:**

```bash
# Check thread states
jstack <pid> | grep -A 3 "async-worker" | grep "WAITING\|BLOCKED\|TIMED_WAITING" | wc -l

# Via actuator
curl http://localhost:8080/actuator/metrics/executor.active
curl http://localhost:8080/actuator/metrics/executor.queued
curl http://localhost:8080/actuator/metrics/executor.pool.size
```

**Alert if `executor.queued > (queue-capacity * 0.8)`** — you're near rejection threshold.

### Named Executors for Different Workloads

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    // CPU-bound work — #threads = number of cores
    @Bean("cpuBoundExecutor")
    public TaskExecutor cpuBoundExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(Runtime.getRuntime().availableProcessors());
        executor.setMaxPoolSize(Runtime.getRuntime().availableProcessors());
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("cpu-");
        executor.initialize();
        return executor;
    }

    // I/O-bound work — more threads since they mostly wait
    @Bean("ioBoundExecutor")
    public TaskExecutor ioBoundExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(50);
        executor.setMaxPoolSize(200);
        executor.setQueueCapacity(1000);
        executor.setThreadNamePrefix("io-");
        executor.initialize();
        return executor;
    }
}

// Use the named executor
@Async("ioBoundExecutor")
public CompletableFuture<String> callExternalApi() { ... }
```

### Detecting Blocking Calls in Reactive Code (BlockHound)

If you're using WebFlux / Project Reactor, blocking calls on reactor threads cause thread starvation — the entire reactive pipeline stalls.

```xml
<!-- pom.xml -->
<dependency>
    <groupId>io.projectreactor.tools</groupId>
    <artifactId>blockhound</artifactId>
    <version>1.0.9.RELEASE</version>
</dependency>
```

```java
// In main class or a test setup
@SpringBootApplication
public class App {
    public static void main(String[] args) {
        BlockHound.install(); // throws BlockingOperationError when blocking call detected on reactor thread
        SpringApplication.run(App.class, args);
    }
}
```

BlockHound throws `BlockingOperationError` when a blocking call (Thread.sleep, JDBC query, file I/O) is made on a Reactor scheduler thread. Use in staging/canary, not production.

**Common blocking call patterns to avoid in reactive code:**

```java
// BAD: blocking call inside a reactive chain
Mono<String> result = Mono.fromCallable(() -> jdbcTemplate.queryForObject(...)); 
// This will block the reactor thread!

// GOOD: offload to a bounded elastic scheduler
Mono<String> result = Mono.fromCallable(() -> jdbcTemplate.queryForObject(...))
    .subscribeOn(Schedulers.boundedElastic()); // switches to I/O thread pool
```

---

## Section 6 — Production Logging Strategy

### Structured JSON Logging

Raw text logs are unqueryable at scale. Use JSON and ship to Elasticsearch / Splunk / CloudWatch.

```xml
<!-- pom.xml -->
<dependency>
    <groupId>net.logstash.logback</groupId>
    <artifactId>logstash-logback-encoder</artifactId>
    <version>7.4</version>
</dependency>
```

```xml
<!-- src/main/resources/logback-spring.xml -->
<configuration>
    <springProfile name="prod">
        <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
            <encoder class="net.logstash.logback.encoder.LogstashEncoder">
                <includeMdcKeyName>traceId</includeMdcKeyName>
                <includeMdcKeyName>spanId</includeMdcKeyName>
                <includeMdcKeyName>userId</includeMdcKeyName>
                <includeMdcKeyName>requestId</includeMdcKeyName>
                <throwableConverter class="net.logstash.logback.stacktrace.ShortenedThrowableConverter">
                    <maxDepthPerCause>20</maxDepthPerCause>
                    <shortenedClassNameLength>40</shortenedClassNameLength>
                </throwableConverter>
            </encoder>
        </appender>
        <root level="INFO">
            <appender-ref ref="STDOUT"/>
        </root>
    </springProfile>

    <springProfile name="!prod">
        <!-- Human-readable format for local development -->
        <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
            <encoder>
                <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
            </encoder>
        </appender>
        <root level="DEBUG">
            <appender-ref ref="CONSOLE"/>
        </root>
    </springProfile>
</configuration>
```

Output:
```json
{
  "@timestamp": "2026-06-15T14:23:45.123Z",
  "level": "ERROR",
  "logger_name": "com.myapp.OrderService",
  "message": "Failed to process order 12345",
  "traceId": "abc123def456",
  "spanId": "789xyz",
  "userId": "user-99",
  "requestId": "req-abc",
  "stack_trace": "..."
}
```

### MDC for Correlation IDs

MDC (Mapped Diagnostic Context) attaches key-value pairs to log entries for the current thread. Essential for tracing a request through all log lines.

```java
// Servlet filter to inject trace context
@Component
@Order(1)
public class TraceContextFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        
        String requestId = Optional.ofNullable(req.getHeader("X-Request-ID"))
            .orElse(UUID.randomUUID().toString());
        
        // Extract from OpenTelemetry/Zipkin headers if present
        String traceId = req.getHeader("X-B3-TraceId");
        if (traceId == null) traceId = UUID.randomUUID().toString().replace("-", "");

        MDC.put("requestId", requestId);
        MDC.put("traceId", traceId);
        MDC.put("path", req.getRequestURI());
        
        res.setHeader("X-Request-ID", requestId);
        
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.clear(); // MUST clear — thread goes back to pool
        }
    }
}
```

```java
// Propagate MDC to async tasks
@Async
public void processAsync(String orderId) {
    // MDC is thread-local — it's empty in the async thread
    // Use Spring's TaskDecorator to propagate it
}

// Fix: configure MDC-aware decorator
@Bean
public ThreadPoolTaskExecutor asyncExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(10);
    executor.setTaskDecorator(runnable -> {
        Map<String, String> contextMap = MDC.getCopyOfContextMap();
        return () -> {
            try {
                if (contextMap != null) MDC.setContextMap(contextMap);
                runnable.run();
            } finally {
                MDC.clear();
            }
        };
    });
    executor.initialize();
    return executor;
}
```

### Log Levels and Sampling

```yaml
# application.yml
logging:
  level:
    root: INFO
    com.myapp: INFO
    org.springframework.web: WARN       # Reduce Spring web noise
    org.hibernate.SQL: WARN             # Only log SQL on WARN in prod (DEBUG in dev)
    org.hibernate.type: WARN
    com.zaxxer.hikari: WARN
    io.lettuce.core: WARN               # Redis client
```

**Log sampling for high-volume paths** (don't log every health check ping):

```java
@Component
public class SamplingHealthCheckFilter extends OncePerRequestFilter {
    
    private final AtomicLong counter = new AtomicLong();
    
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        
        // Only log 1 in 100 health check requests
        if (req.getRequestURI().startsWith("/actuator/health")) {
            if (counter.incrementAndGet() % 100 != 0) {
                chain.doFilter(req, res);
                return; // skip logging
            }
        }
        chain.doFilter(req, res);
    }
}
```

### Never Log PII

```java
// BAD — PII in logs
log.info("Processing payment for user {} with card {}", user.getEmail(), card.getNumber());

// GOOD — mask sensitive data
log.info("Processing payment for user {} with card ending {}", 
    user.getId(),  // use ID, not email
    card.getNumber().substring(card.getNumber().length() - 4)); // last 4 only

// Even better — a masking helper
public class LogMasker {
    public static String maskCard(String number) {
        return "****-****-****-" + number.substring(number.length() - 4);
    }
    public static String maskEmail(String email) {
        int at = email.indexOf('@');
        return email.charAt(0) + "***" + email.substring(at);
    }
}
```

!!! danger "PII in logs is a GDPR / CCPA violation"
    Emails, SSNs, card numbers, passwords, tokens — never log them. Set up log scanning in your CI pipeline with tools like `detect-secrets` to catch accidental PII before it reaches production.

---

## Section 7 — Key Metrics to Monitor

### JVM Metrics (Spring Actuator + Micrometer)

```yaml
# Expose metrics for Prometheus scraping
management:
  endpoints:
    web:
      exposure:
        include: prometheus, health, metrics
  metrics:
    export:
      prometheus:
        enabled: true
    tags:
      application: ${spring.application.name}
      environment: ${spring.profiles.active}
```

| Metric | Key | Alert Threshold |
|---|---|---|
| Heap used | `jvm.memory.used{area="heap"}` | > 80% of max for 5 min |
| Heap after GC | Check GC log | Trending up = leak |
| GC pause time | `jvm.gc.pause` (max) | > 500ms |
| GC frequency | `jvm.gc.pause` (count/min) | > 10 Full GCs/hour |
| Thread count | `jvm.threads.live` | > (2x expected) |
| Blocked threads | `jvm.threads.states{state="blocked"}` | > 5 |
| Metaspace used | `jvm.memory.used{area="nonheap"}` | > 400MB (if max=512m) |

### HTTP Metrics

```bash
# p99 latency for all endpoints
curl "http://localhost:8080/actuator/metrics/http.server.requests?tag=quantile:0.99"

# Error rate by endpoint
curl "http://localhost:8080/actuator/metrics/http.server.requests?tag=status:500"
```

| Metric | Key | Alert Threshold |
|---|---|---|
| p99 latency | `http.server.requests{quantile="0.99"}` | > SLA (e.g., 500ms) |
| p50 latency | `http.server.requests{quantile="0.50"}` | Baseline |
| 5xx error rate | `http.server.requests{status="5xx"}` | > 0.1% of requests |
| 4xx rate | `http.server.requests{status="4xx"}` | Spike > 5x baseline |
| Request rate | `http.server.requests` (count/sec) | Drop > 50% = upstream issue |

### Datasource Metrics

| Metric | Key | Alert Threshold |
|---|---|---|
| Active connections | `hikaricp.connections.active` | Near maximumPoolSize |
| Pending waiters | `hikaricp.connections.pending` | > 0 for > 30s |
| Avg acquisition | `hikaricp.connections.acquire` | > 100ms |
| Connection timeouts | `hikaricp.connections.timeout` | Any in 5-min window |

### Prometheus + Grafana Dashboard

```yaml
# prometheus.yml scrape config
scrape_configs:
  - job_name: 'spring-boot-app'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['app:8080']
    scrape_interval: 15s
```

```
# Key PromQL queries for a Grafana dashboard

# Heap utilization %
jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"} * 100

# p99 latency (last 5 min)
histogram_quantile(0.99, rate(http_server_requests_seconds_bucket[5m]))

# Error rate %
rate(http_server_requests_seconds_count{status=~"5.."}[5m]) 
  / rate(http_server_requests_seconds_count[5m]) * 100

# HikariCP pool utilization
hikaricp_connections_active / hikaricp_connections_max * 100
```

---

## Section 8 — Runbook Patterns

### 2am Systematic Diagnostic Checklist

When you get paged, resist the urge to restart immediately. A restart destroys evidence. Follow this order:

```
Step 1: CPU
  □ Is CPU > 90%?
    YES → likely GC thrashing (see GC logs) or infinite loop (see thread dump)
    NO  → move to memory

Step 2: Memory  
  □ Heap near max (-Xmx)?
    YES → leak or undersized. Capture heap dump NOW before OOM kills it.
    □ jmap -dump:format=b,file=/tmp/heap.hprof <pid>
    NO  → move to threads

Step 3: Threads
  □ Thread count exploding? Blocked threads > 10?
    YES → thread pool exhausted or deadlock. Capture thread dump.
    □ jstack <pid> > /tmp/threads.txt
    Look for: BLOCKED on same lock object, or hundreds of WAITING threads
    NO  → move to GC

Step 4: GC
  □ Frequent Full GC? Pauses > 500ms?
    YES → tune GC settings or increase heap
    □ jstat -gcutil <pid> 5000 20   # GC stats every 5s, 20 iterations
    NO  → move to connections

Step 5: Connections
  □ HikariCP pending > 0? DB connection timeouts in logs?
    YES → pool exhausted. Find long transactions.
    □ curl .../actuator/metrics/hikaricp.connections.pending
    □ Check leak-detection-threshold log output
    NO  → move to external dependencies

Step 6: External Dependencies
  □ Downstream service latency spiked?
  □ DB query time increased?
    YES → circuit breaker should be OPEN, check /actuator/health
    Use distributed tracing (Zipkin / Jaeger) to find the slow call
```

### Essential Commands

```bash
# --- PROCESS INFO ---
# Find the Java PID
pgrep -f "app.jar"
# Or
jps -l

# Process memory usage
ps aux | grep java
cat /proc/<pid>/status | grep VmRSS  # RSS = actual resident memory

# --- JVM DIAGNOSTICS ---
# Thread dump (take 3, 5 seconds apart — compare for stuck threads)
jstack <pid> > /tmp/threads-$(date +%s).txt

# Heap dump
jmap -dump:live,format=b,file=/tmp/heap.hprof <pid>

# Heap histogram (quick, no full dump needed)
jmap -histo:live <pid> | head -50

# GC stats (live)
jstat -gcutil <pid> 2000 30   # every 2s, 30 iterations
# Output: S0  S1    E    O    M   CCS  YGC  YGCT  FGC  FGCT   GCT
#         0   50  73.2  80.1  95   82  142   3.6    5   0.8    4.4
# O=OldGen %, FGC=FullGC count — watch for O% not dropping after FGC

# JVM flags currently running
jcmd <pid> VM.flags

# System properties
jcmd <pid> VM.system_properties

# --- NETWORK ---
# Check open connections and states
netstat -an | grep 5432 | awk '{print $6}' | sort | uniq -c | sort -rn
# ESTABLISHED = active connections; TIME_WAIT = recently closed; CLOSE_WAIT = not closed properly
# CLOSE_WAIT accumulating = connection leak in your code

# Connections to DB grouped by state
ss -tn dst :5432 | awk '{print $1}' | sort | uniq -c

# Open file descriptors (DB connections, HTTP connections, file handles)
lsof -p <pid> | wc -l
lsof -p <pid> | grep "IPv4\|IPv6" | wc -l  # network connections only

# --- HTTP ---
# Check if actuator is responding (basic liveness)
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/actuator/health

# Watch error rate in real-time
watch -n5 "curl -s http://localhost:8080/actuator/metrics/http.server.requests | 
  python3 -c \"import json,sys; data=json.load(sys.stdin); 
  [print(m) for m in data['availableTags'] if m['tag']=='status']\""

# --- LOG ANALYSIS ---
# Count errors in last 100 lines
tail -100 /var/log/app/app.log | grep '"level":"ERROR"' | wc -l

# Find slow DB queries (HikariCP leak detection output)
grep "Apparent connection leak" /var/log/app/app.log | head -20

# Connection timeout frequency
grep "Connection is not available" /var/log/app/app.log | \
  awk '{print $1}' | sort | uniq -c | sort -rn
```

### Thread Dump Analysis Pattern

```bash
# After capturing thread dump with jstack, look for:

# 1. DEADLOCK — jstack explicitly reports it at the bottom
grep -A 20 "Found.*deadlock" /tmp/threads.txt

# 2. Blocked threads (all waiting on same lock)
grep -B2 "BLOCKED" /tmp/threads.txt | grep "- locked"
# If many threads blocked on same object → contention bottleneck

# 3. Thread pool exhaustion
grep "http-nio-8080-exec" /tmp/threads.txt | grep "WAITING\|TIMED_WAITING" | wc -l
# If all N threads are WAITING → pool exhausted waiting for something

# 4. Stuck threads (same stack trace in all 3 dumps)
# Take 3 dumps 5 seconds apart, compare:
diff /tmp/threads-1.txt /tmp/threads-2.txt | grep "thread-name" # same stack = stuck
```

### When to Restart (and How)

```bash
# BEFORE restarting, capture evidence:
jstack <pid> > /tmp/final-threads.txt
jmap -dump:format=b,file=/tmp/final-heap.hprof <pid>
cp /var/log/app/app.log /tmp/app-incident-$(date +%Y%m%d-%H%M%S).log

# Graceful shutdown — sends SIGTERM, Spring Boot handles it
kill -15 <pid>
# Spring Boot 2.3+ graceful shutdown: completes in-flight requests, then exits
# Configure:
```

```yaml
# application.yml
server:
  shutdown: graceful  # SIGTERM triggers graceful drain
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s  # Max 30s to drain requests
```

```bash
# NEVER use kill -9 unless kill -15 hangs > 60 seconds
# kill -9 = immediate termination, no cleanup, possible data corruption
```

---

## Quick Reference Card

```
MEMORY LEAK
  Evidence:  OOM | Heap% not dropping after GC | GC overhead > 98%
  First step: jmap -histo:live <pid> | head -30
  Then:       heap dump → MAT → Leak Suspects

CONNECTION POOL EXHAUSTED
  Evidence:  "Connection is not available, request timed out"
  First step: curl .../actuator/metrics/hikaricp.connections.pending
  Then:       check leak-detection-threshold logs for which code holds connection

SLOW STARTUP
  Evidence:  K8s readiness probe fails | app takes > 60s to start
  First step: curl .../actuator/startup | jq to find slow step
  Then:       check Flyway migrations, entity scan, @PostConstruct calls

THREAD STARVATION
  Evidence:  High thread count | BLOCKED threads | requests queueing
  First step: jstack <pid> | grep BLOCKED
  Then:       find the lock, find what holds it

HIGH GC PAUSE
  Evidence:  Latency spikes at regular intervals | GC log shows > 500ms pauses
  First step: jstat -gcutil <pid> 2000 10
  Then:       review heap size, GC algorithm, check for allocation pressure

5XX SPIKE
  Evidence:  Error rate alert fires
  First step: tail app.log | grep ERROR | head -20
  Then:       distributed trace the failing request, find root cause
```

---

*Related: [Production Performance Tuning](../springboot/production-tuning.md) | [Actuator & Monitoring](../springboot/actuator.md) | [HikariCP & Transactions](../springboot/transactions.md) | [JVM Tuning](../java/JVMTuning.md)*
