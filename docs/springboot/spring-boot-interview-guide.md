---
description: "Complete Spring Boot interview guide for senior developers. Covers IoC, auto-configuration, JPA, Security, transactions, microservices patterns, and 50+ must-know questions for FAANG interviews."
---

# Complete Spring Boot Interview Guide — From Basics to Production

> **Master Spring Boot for senior-level interviews.** Covers IoC, auto-configuration, security, data access, microservices patterns, and production-grade topics that FAANG companies ask.

---

## How to Use This Guide

This guide is structured as a progressive learning path, organized from foundational Spring concepts through advanced production topics. Each section covers:

- **Key Topics** — what interviewers expect you to know at a senior level.
- **Must-Know Questions** — the questions that come up repeatedly in interviews, with concise answers.
- **Deep Dive Pages** — detailed write-ups for each topic when you need more depth.

Start with Sections 1-2 if you need to refresh core concepts. If you are already comfortable with IoC and auto-configuration, jump directly to the sections that match your interview focus areas. The 5-week roadmap at the bottom provides a structured preparation plan.

---

## 1. Spring Core & IoC

### What Interviewers Expect

Interviewers at senior levels expect you to explain not just *what* IoC and DI are, but *how* Spring implements them internally — the BeanFactory vs ApplicationContext distinction, bean definition parsing, and the full lifecycle from instantiation to destruction. You should be able to discuss when to use constructor vs setter injection and articulate the trade-offs.

### Top Questions

**Q: What is IoC and DI? How does Spring implement them?**

- **IoC** = framework manages object creation/wiring, not your code
- **DI** = the mechanism Spring uses to achieve IoC
- Spring's container reads config (annotations, XML, Java config) → creates bean definitions → resolves dependencies via reflection → injects via constructors, setters, or fields

```java
@Service
public class OrderService {
    private final PaymentGateway gateway; // injected by Spring

    public OrderService(PaymentGateway gateway) { // constructor injection
        this.gateway = gateway;
    }
}
```

---

**Q: What are the different bean scopes?**

- **Singleton** — one instance per container (default)
- **Prototype** — new instance per injection/request
- **Request** — one per HTTP request
- **Session** — one per HTTP session
- **Application** — one per ServletContext
- **WebSocket** — one per WebSocket session

!!! warning "Prototype inside Singleton"
    Injecting a prototype into a singleton gives you a stale reference. Use `ObjectFactory<T>` or `@Scope(proxyMode = ScopedProxyMode.TARGET_CLASS)` to get fresh instances.

```java
@Component
@Scope(value = "prototype", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class ShoppingCart { /* new instance per access */ }
```

---

**Q: Explain the bean lifecycle.**

- Instantiation → populate properties
- `BeanNameAware` → `BeanFactoryAware` → `ApplicationContextAware`
- `BeanPostProcessor#postProcessBeforeInitialization`
- `@PostConstruct`
- `InitializingBean#afterPropertiesSet`
- Custom `init-method`
- `BeanPostProcessor#postProcessAfterInitialization`
- **Bean is ready**
- `@PreDestroy`
- `DisposableBean#destroy`
- Custom `destroy-method`

```java
@Component
public class CacheWarmer {
    @PostConstruct
    public void warmUp() { /* runs after DI is complete */ }

    @PreDestroy
    public void flushCache() { /* runs before shutdown */ }
}
```

---

**Q: What is circular dependency and how does Spring handle it?**

- Occurs when Bean A depends on Bean B and Bean B depends on Bean A
- Spring resolves this for **singleton** beans using a three-level cache:
    - `singletonObjects` — fully initialized beans
    - `earlySingletonObjects` — partially initialized (exposed early)
    - `singletonFactories` — factory lambdas that produce early refs
- Does **NOT** work with constructor injection — use `@Lazy` or redesign

---

**Q: What is the difference between BeanFactory and ApplicationContext?**

| Feature | BeanFactory | ApplicationContext |
|---------|-------------|-------------------|
| Initialization | Lazy | Eager |
| Events | No | Yes |
| i18n | No | Yes |
| AOP integration | Limited | Full |

- In production, you always use `ApplicationContext`

---

**Q: When should you use @Component vs @Bean?**

- `@Component` — classpath scanning for **your own** classes
- `@Bean` — explicit registration in `@Configuration` classes for:
    - Third-party library classes you cannot annotate
    - Beans requiring programmatic construction logic

```java
@Configuration
public class AppConfig {
    @Bean // third-party class — can't add @Component to it
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}
```

### Go Deeper

- [Spring IoC Container](SpringIOC.md)
- [Types of Dependency Injection](typesofdi.md)
- [Bean Lifecycle](bean-lifecycle.md)
- [Circular Dependencies](circular-dependencies.md)
- [Configuration Properties](configuration-properties.md)
- [Profiles](profiles.md)
- [SpEL](spel.md)
- [Events](events.md)

---

## 2. Auto-Configuration & Internals

### Core Concepts

Senior engineers are expected to understand what happens when a Spring Boot application starts — from SpringApplication.run() through auto-configuration resolution. Know how @Conditional annotations drive auto-configuration, how to write custom starters, and what changed in Spring Boot 3 (Jakarta namespace, GraalVM AOT, observability APIs).

### Interview Questions

**Q: How does Spring Boot auto-configuration work?**

- Boot reads `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (Boot 3) or `META-INF/spring.factories` (Boot 2)
- Each class uses `@Conditional` annotations to decide whether to apply:
    - `@ConditionalOnClass` — only if class is on classpath
    - `@ConditionalOnMissingBean` — only if you haven't defined one
    - `@ConditionalOnProperty` — only if property is set
- Your explicit `@Bean` definitions **always take priority**

```java
@AutoConfiguration
@ConditionalOnClass(DataSource.class)
@ConditionalOnProperty(name = "spring.datasource.url")
public class DataSourceAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean
    public DataSource dataSource(DataSourceProperties props) {
        return props.initializeDataSourceBuilder().build();
    }
}
```

---

**Q: What is the difference between @SpringBootApplication and its components?**

- `@Configuration` — marks class as Java-based config source
- `@EnableAutoConfiguration` — triggers auto-configuration
- `@ComponentScan` — scans current package + sub-packages
- Understanding this lets you control scanning scope and auto-config behavior

---

**Q: How do you create a custom Spring Boot starter?**

- Create **two modules**:
    1. `autoconfigure` module — `@Configuration` classes with `@Conditional*` annotations
    2. `starter` module — pulls in autoconfigure + required dependencies
- Register configuration in `AutoConfiguration.imports`
- Provide sensible defaults, allow override via `application.properties`

---

**Q: What happens during SpringApplication.run()?**

1. Creates `SpringApplication` instance
2. Loads `SpringApplicationRunListeners`
3. Prepares `Environment`
4. Creates `ApplicationContext` (reactive vs servlet)
5. Loads bean definitions
6. Refreshes context (instantiates all singleton beans)
7. Calls runners (`CommandLineRunner`, `ApplicationRunner`)
8. Publishes `ApplicationReadyEvent`

---

**Q: What changed in Spring Boot 3?**

- Java 17 baseline
- Jakarta EE 10 (`javax.*` → `jakarta.*`)
- GraalVM native image support (first-class AOT processing)
- Built-in observability with Micrometer
- `ProblemDetail` for error responses (RFC 7807)
- New declarative HTTP clients
- Deprecation of `spring.factories` for auto-configuration

### Further Reading

- [Auto-Configuration](AutoConfiguration.md)
- [Spring Boot 3 Features](SpringBoot3.md)
- [Spring Boot Internals](internals.md)
- [Custom Starters & Bean Processors](custom-starter-bean-processors.md)
- [Annotations](Annotations.md)

---

## 3. Web & REST APIs

### What You Need to Know

You must understand the full MVC request lifecycle from DispatcherServlet through handler mapping, argument resolution, and response rendering. Interviewers expect you to design RESTful APIs following best practices and handle cross-cutting concerns (validation, exception handling, content negotiation) cleanly.

### Frequently Asked

**Q: Explain the Spring MVC request lifecycle.**

1. Request hits `DispatcherServlet`
2. `HandlerMapping` finds the controller method
3. `HandlerAdapter` invokes it with resolved arguments (via `HandlerMethodArgumentResolvers`)
4. Method executes business logic
5. Return value processed by `HandlerMethodReturnValueHandler`
6. `ViewResolver` (if view) or `HttpMessageConverter` (if `@ResponseBody`) produces response

---

**Q: How do you handle exceptions globally?**

- Use `@ControllerAdvice` with `@ExceptionHandler` methods
- Spring Boot 3 adds `ProblemDetail` for RFC 7807 responses
- `ResponseStatusException` works for simple one-off cases
- Implement `ErrorController` to override the default `/error` endpoint

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleNotFound(ResourceNotFoundException ex) {
        ProblemDetail pd = ProblemDetail.forStatus(HttpStatus.NOT_FOUND);
        pd.setTitle("Resource Not Found");
        pd.setDetail(ex.getMessage());
        return pd;
    }
}
```

---

**Q: What is the difference between @Controller and @RestController?**

- `@RestController` = `@Controller` + `@ResponseBody` on every method
- Returns serialized data directly (JSON/XML)
- Use `@Controller` when returning view names (Thymeleaf, JSP)

---

**Q: How does validation work in Spring Boot?**

- Add `spring-boot-starter-validation`
- Annotate DTOs with Bean Validation annotations (`@NotNull`, `@Size`, `@Email`)
- Use `@Valid` or `@Validated` on method parameters
- Failures throw `MethodArgumentNotValidException` → handle in `@ControllerAdvice`
- Custom rules: implement `ConstraintValidator`

```java
public record CreateUserRequest(
    @NotBlank String username,
    @Email String email,
    @Size(min = 8, max = 64) String password
) {}

@PostMapping("/users")
public ResponseEntity<User> createUser(@Valid @RequestBody CreateUserRequest req) {
    return ResponseEntity.status(201).body(userService.create(req));
}
```

---

**Q: How do filters differ from interceptors?**

| Aspect | Filter | HandlerInterceptor |
|--------|--------|--------------------|
| Level | Servlet container | Spring MVC |
| Access to handler | No | Yes |
| Use cases | Security, logging, compression | Auth checks, audit, model prep |

- Filters see **raw** requests before Spring processes them
- Interceptors have access to the handler method and model

---

**Q: How do you version a REST API?**

- **URI versioning** — `/api/v1/users` (most common, cache-friendly)
- **Header versioning** — `Accept: application/vnd.api.v1+json` (more RESTful, less discoverable)
- **Query param** — `?version=1`
- Pick one and be consistent across your service

### Related Pages

- [MVC Request Lifecycle](mvc-request-lifecycle.md)
- [REST API Best Practices](restapibestpractices.md)
- [Exception Handling](exceptionhandling.md)
- [Validation](validation.md)
- [CORS & Content Negotiation](cors-content-negotiation.md)
- [Filters, Interceptors & AOP](filters-interceptors-aop.md)
- [HTTP Clients](http-clients.md)
- [File Upload/Download](file-upload-download.md)
- [Pagination & Sorting](pagination-sorting.md)
- [OpenAPI & Swagger](openapi-swagger.md)
- [DTO Mapping](dto-mapping.md)

---

## 4. Security

### The Security Mental Model

Spring Security is a top interview topic. You need to understand the filter chain architecture, authentication vs authorization flow, and how to secure both traditional and stateless (JWT/OAuth2) applications. Senior candidates should be able to explain security internals — not just configuration.

### Critical Questions

**Q: How does the Spring Security filter chain work?**

- `DelegatingFilterProxy` → delegates to `FilterChainProxy`
- `FilterChainProxy` holds one or more `SecurityFilterChain` instances
- Each chain contains ordered filters:
    - `CsrfFilter` → `AuthenticationFilter` → `AuthorizationFilter` → ...
- Chain processes sequentially; each filter can **short-circuit**
- You can add custom filters at specific positions

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/public/**").permitAll()
            .anyRequest().authenticated())
        .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
        .build();
}
```

---

**Q: What is the difference between authentication and authorization?**

- **Authentication** — verifies identity (*who are you?*)
    - `AuthenticationManager` → `AuthenticationProvider` → `UserDetailsService`
- **Authorization** — verifies permissions (*what can you do?*)
    - `AuthorizationManager`, checked **after** successful authentication
- Both stored in `SecurityContext` (ThreadLocal by default)

---

**Q: How do you implement JWT authentication in Spring Boot?**

- Create a `OncePerRequestFilter` that:
    1. Extracts JWT from the `Authorization` header
    2. Validates it (signature, expiration, claims)
    3. Creates an `Authentication` object
    4. Sets it in `SecurityContextHolder`
- Configure `SecurityFilterChain` as stateless (`SessionCreationPolicy.STATELESS`)
- Register the filter **before** `UsernamePasswordAuthenticationFilter`

```java
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req,
            HttpServletResponse res, FilterChain chain) throws Exception {
        String token = extractToken(req);
        if (token != null && jwtUtil.isValid(token)) {
            var auth = jwtUtil.toAuthentication(token);
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(req, res);
    }
}
```

---

**Q: How does method-level security work?**

- Enable with `@EnableMethodSecurity`
- `@PreAuthorize("hasRole('ADMIN')")` — pre-invocation check
- `@PostAuthorize` — post-invocation check
- `@Secured` — simple role check
- Uses AOP proxies → **self-invocation bypasses security** (same as `@Transactional`)

---

**Q: How do you secure a REST API against CSRF?**

- **Stateless APIs (JWT-based)** — disable CSRF; token-based auth prevents it inherently
- **Session-based APIs** — use Spring's `CsrfFilter` with:
    - Synchronizer Token Pattern, or
    - `CookieCsrfTokenRepository` (cookie-based)

### Explore Security In Depth

- [Spring Security](security.md)
- [Security Filter Chain Internals](security-filter-chain.md)
- [Method Security & OAuth2](method-security-oauth2.md)
- [JWT](../security/JWT.md)
- [OAuth 2.0](../security/oauth.md)

---

## 5. Data Access & JPA

### What Sets Senior Candidates Apart

Expect deep questions on JPA internals, Hibernate session management, transaction propagation, and performance optimization (especially the N+1 problem). Senior engineers should understand persistence context, dirty checking, and when JPA is not the right tool.

### The Hard Questions

**Q: What is the N+1 problem and how do you fix it?**

- **Problem**: Load a parent entity → Hibernate lazily fetches each child with a **separate** query (1 + N queries)
- **Fixes**:
    - `JOIN FETCH` in JPQL
    - `@EntityGraph` on repository methods
    - Batch fetching (`@BatchSize`)
    - DTO projection (skip managed entities entirely)
- Choose based on whether you need managed entities or read-only data

```java
// BAD: triggers N+1
List<Order> orders = orderRepo.findAll(); // 1 query
orders.forEach(o -> o.getItems().size()); // N queries

// GOOD: single query with JOIN FETCH
@Query("SELECT o FROM Order o JOIN FETCH o.items")
List<Order> findAllWithItems();
```

---

**Q: Explain transaction propagation levels.**

| Propagation | Behavior |
|-------------|----------|
| `REQUIRED` | Join existing or create new (default) |
| `REQUIRES_NEW` | Always create new, suspend existing |
| `NESTED` | Savepoint within existing |
| `SUPPORTS` | Join if exists, else non-transactional |
| `NOT_SUPPORTED` | Suspend existing |
| `MANDATORY` | Must exist, else exception |
| `NEVER` | Must NOT exist, else exception |

---

**Q: Why does @Transactional not work on private methods or self-invocation?**

- Spring AOP uses proxies (JDK dynamic proxy or CGLIB)
- Self-call bypasses the proxy → transactional advice never applied
- **Solutions**:
    - Inject self (`@Lazy private MyService self;`)
    - Use `TransactionTemplate` programmatically
    - Restructure into separate beans

```java
// BROKEN — self-invocation, no proxy
@Service
public class PaymentService {
    @Transactional
    public void processPayment() {
        this.updateLedger(); // bypasses proxy!
    }
    @Transactional(propagation = REQUIRES_NEW)
    public void updateLedger() { /* ... */ }
}

// FIX — inject self or extract to another bean
@Service
public class PaymentService {
    @Lazy @Autowired private PaymentService self;
    
    @Transactional
    public void processPayment() {
        self.updateLedger(); // goes through proxy
    }
}
```

---

**Q: What is the difference between EAGER and LAZY loading?**

- **EAGER** — loads associations immediately with the parent query
- **LAZY** — loads on first access (via Hibernate proxy)
- Defaults:
    - `@ManyToOne` / `@OneToOne` → EAGER
    - `@OneToMany` / `@ManyToMany` → LAZY
- **Best practice**: use LAZY everywhere, fetch explicitly when needed

---

**Q: How does the Hibernate first-level cache work?**

- The persistence context (`Session`) caches every entity loaded in a transaction **by ID**
- Repeated `findById` calls return the **same object instance**
- Enables:
    - **Dirty checking** — compares snapshot at flush time to detect changes
    - **Repeatable reads** — within a single transaction

---

**Q: How do you handle optimistic vs pessimistic locking?**

- **Optimistic** — `@Version` field; Hibernate checks on update, throws `OptimisticLockException` on conflict. Best for **low-contention** scenarios.
- **Pessimistic** — `@Lock(LockModeType.PESSIMISTIC_WRITE)` → database-level lock. Best for **high-contention, short-lived** transactions.

```java
@Entity
public class Account {
    @Version
    private Long version; // optimistic locking

    private BigDecimal balance;
}
```

### Data Access Deep Dives

- [Spring Data JPA](spring-data-jpa.md)
- [N+1 Problem & JPA Internals](n-plus-one-jpa.md)
- [Hibernate Internals](hibernate-internals.md)
- [Transactions](transactions.md)
- [Multi-Datasource & Auditing](multi-datasource-auditing.md)
- [Database Migrations](database-migrations.md)
- [Specifications & Dynamic Queries](specifications-dynamic-queries.md)
- [Spring Data Redis](spring-data-redis.md)

---

## 6. Testing

### Testing Strategy Overview

Senior engineers must demonstrate testing strategy — unit tests with mocks, integration tests with slices, and end-to-end tests with real infrastructure. Know the trade-offs between test speed and confidence. Interviewers want to see that you understand the test pyramid in a Spring context.

### Commonly Tested Questions

**Q: What are Spring Boot test slices and when do you use them?**

- Test slices load **only a subset** of the application context
- Much faster than `@SpringBootTest` (avoids full context load)

| Slice | What it loads |
|-------|---------------|
| `@WebMvcTest` | Controllers, filters, advice |
| `@DataJpaTest` | Repositories, EntityManager |
| `@JsonTest` | JSON serialization only |

```java
@WebMvcTest(UserController.class)
class UserControllerTest {
    @Autowired MockMvc mockMvc;
    @MockBean UserService userService;

    @Test
    void returnsUser() throws Exception {
        when(userService.findById(1L)).thenReturn(new User("Alice"));
        mockMvc.perform(get("/users/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Alice"));
    }
}
```

---

**Q: How does @MockBean differ from @Mock?**

- `@Mock` (Mockito) — standalone mock, **not** in Spring context
- `@MockBean` — replaces/adds a bean in the `ApplicationContext` with a mock
- Use `@MockBean` when the mock needs to be injected into other Spring-managed beans

---

**Q: When should you use Testcontainers?**

- When you need integration tests against **real infrastructure** (PostgreSQL, Redis, Kafka)
- No shared test environments needed — Docker containers per test class/suite
- Isolated, reproducible tests
- Boot 3.1+ provides `@ServiceConnection` for auto-configuration of connection properties

```java
@SpringBootTest
@Testcontainers
class OrderRepositoryIT {
    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16");

    @Autowired OrderRepository repo;

    @Test
    void savesOrder() {
        Order saved = repo.save(new Order("item-1", 2));
        assertThat(saved.getId()).isNotNull();
    }
}
```

---

**Q: How do you test @Transactional behavior?**

- `@SpringBootTest` + `@Transactional` on test class → auto-rollback after each test
- To test actual commit behavior (e.g., optimistic locking): remove `@Transactional`, clean up manually or use `@DirtiesContext`

### Testing Resources

- [Testing in Spring Boot](testing.md)
- [Slice Testing](slice-testing.md)
- [Testcontainers](testcontainers.md)

---

## 7. Messaging & Async

### Distributed Communication Essentials

Distributed systems rely heavily on asynchronous communication. Know when to use message brokers vs direct async, understand at-least-once vs exactly-once semantics, and be prepared to discuss how Spring abstracts Kafka, RabbitMQ, and other messaging systems.

### Key Scenarios & Questions

**Q: How does @Async work in Spring?**

- `@EnableAsync` enables proxy-based async execution
- Methods run on a `TaskExecutor` thread pool
- Must return `void` or `CompletableFuture`
- **Caveats**:
    - Self-invocation bypasses the proxy
    - Exceptions in void methods are **lost** (use `AsyncUncaughtExceptionHandler`)
    - Always configure a custom executor — default `SimpleAsyncTaskExecutor` creates unbounded threads

```java
@Configuration
@EnableAsync
public class AsyncConfig {
    @Bean
    public TaskExecutor taskExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("async-");
        return executor;
    }
}

@Service
public class NotificationService {
    @Async
    public CompletableFuture<Void> sendEmail(String to, String body) {
        // runs on async thread pool
        emailClient.send(to, body);
        return CompletableFuture.completedFuture(null);
    }
}
```

---

**Q: How do you handle Kafka consumer failures?**

- Use `@RetryableTopic` or `DefaultErrorHandler` with backoff
- Configure a **dead-letter topic** (DLT) for messages exceeding retry attempts
- For ordering-sensitive consumers: pause the partition on failure
- Spring Kafka provides declarative retry with exponential backoff + DLT routing

```java
@RetryableTopic(
    backoff = @Backoff(delay = 1000, multiplier = 2),
    attempts = "3",
    dltStrategy = DltStrategy.FAIL_ON_ERROR)
@KafkaListener(topics = "orders")
public void processOrder(OrderEvent event) {
    orderService.process(event); // retried up to 3x, then sent to DLT
}
```

---

**Q: What is the difference between @KafkaListener and @RabbitListener error handling?**

- **Kafka** — offset-based; failed message blocks the partition unless you use `SeekToCurrentErrorHandler` or skip
- **RabbitMQ** — ack-based; failed messages can be nacked and requeued or routed to a dead-letter exchange
- RabbitMQ gives more granular per-message control; Kafka requires partition-level strategies

---

**Q: When should you use Spring Batch vs async processing?**

| | Spring Batch | @Async / Messaging |
|-|-------------|-------------------|
| Use case | ETL, report generation, data migration | Real-time event-driven workloads |
| Features | Chunk processing, restart, skip, retry | Fire-and-forget or CompletableFuture |
| Tracking | Job repository with execution history | Manual or messaging DLT |

### Messaging & Async Deep Dives

- [Async Processing](async.md)
- [Spring Kafka](spring-kafka.md)
- [Spring RabbitMQ](spring-rabbitmq.md)
- [Spring Batch](spring-batch.md)
- [WebSocket](spring-websocket.md)
- [Spring GraphQL](spring-graphql.md)

---

## 8. Production & Operations

### Production Readiness Checklist

FAANG interviews increasingly focus on production readiness — observability, performance tuning, containerization, and operational maturity. You should demonstrate that you have shipped and operated Spring Boot services at scale, not just built them.

### Operations Questions

**Q: What Actuator endpoints should every production service expose?**

- `/health` — load balancer probes (liveness + readiness groups in K8s)
- `/metrics` — Prometheus-compatible via Micrometer
- `/info` — build metadata
- `/env` or `/configprops` — debugging only

!!! danger "Security"
    Never expose `/env` or `/beans` publicly. Secure sensitive endpoints with Spring Security.

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health, metrics, info, prometheus
  endpoint:
    health:
      show-details: when_authorized
```

---

**Q: How do you implement health checks for Kubernetes?**

- Configure liveness and readiness probe groups:
    - **Liveness** (`/actuator/health/liveness`) — is the app alive? Failure → pod restart
    - **Readiness** (`/actuator/health/readiness`) — can it serve traffic? Failure → removed from service
- Add custom `HealthIndicator` for downstream dependencies to **readiness only**

```yaml
management:
  endpoint:
    health:
      probes:
        enabled: true
      group:
        readiness:
          include: db, redis, customDependency
```

---

**Q: How do you tune a Spring Boot application for throughput?**

- **Tomcat thread pool** — `server.tomcat.threads.max` matched to workload
- **HikariCP pool** — `maximumPoolSize` slightly above thread count for DB-bound apps
- **Response compression** — enable for text responses
- **Virtual threads** (Java 21) — for I/O-bound workloads
- **Profile first** — use async-profiler to find bottlenecks before tuning blindly

---

**Q: What is the benefit of GraalVM native images for Spring Boot?**

- Near-instant startup (milliseconds vs seconds)
- Lower memory footprint
- Ideal for serverless and scale-to-zero
- **Trade-offs**:
    - Longer build times
    - Limited reflection/dynamic proxy support (requires hint config)
    - No runtime class loading
- Spring Boot 3 provides first-class AOT processing to generate native hints automatically

---

**Q: How do you implement distributed tracing in Spring Boot?**

- Spring Boot 3 uses **Micrometer Tracing** (replacing Spring Cloud Sleuth)
- Add `micrometer-tracing-bridge-otel` for OpenTelemetry
- Trace IDs propagate automatically through `RestTemplate`, `WebClient`, `@Async`, and messaging
- Export spans to Zipkin, Jaeger, or any OTLP-compatible backend

### Production Deep Dives

- [Actuator](actuator.md)
- [Observability](observability.md)
- [Caching](caching.md)
- [Docker & Kubernetes](docker-kubernetes.md)
- [Production Tuning](production-tuning.md)
- [GraalVM Native Images](graalvm-native.md)
- [Common Pitfalls](pitfalls.md)

---

## 9. Advanced & Ecosystem

### Architecture & Breadth Topics

These topics demonstrate breadth and architectural maturity. Reactive programming, modular monoliths, AI integration, and cloud patterns show that you think beyond CRUD applications. Not all FAANG interviews go this deep, but these differentiate strong senior candidates.

### Senior-Level Deep Questions

**Q: When should you use WebFlux over Spring MVC?**

- **Use WebFlux** for:
    - High-concurrency, I/O-bound workloads
    - Thousands of concurrent connections with minimal threads
    - Streaming, real-time APIs, gateway services
- **Don't use WebFlux** when:
    - App is primarily CRUD with moderate concurrency
    - CPU-bound work (no benefit)
    - Team isn't comfortable with reactive paradigm
- Spring MVC + virtual threads (Java 21) is simpler for most cases

---

**Q: What is Spring Modulith and when would you use it?**

- Enforces logical module boundaries **within a monolith**
- Uses package conventions + ArchUnit-style tests
- Provides:
    - Event-based inter-module communication
    - Module documentation generation
    - Path to microservices extraction
- Use when you want modular architecture **without** distributed systems overhead

```java
// Module boundary enforced — other modules cannot access internals
// com.example.order (public API)
// com.example.order.internal (package-private, not accessible)

@ApplicationModuleTest
class OrderModuleTest {
    // Verifies module boundaries are respected
}
```

---

**Q: How does Spring AOP work internally?**

- Uses **proxy-based interception** (not compile-time weaving like full AspectJ)
- For interfaces → JDK dynamic proxies
- For concrete classes → CGLIB subclass proxies
- Advisors contain:
    - **Pointcuts** — where to apply (method matching)
    - **Advice** — what to do (before, after, around)
- **Limitation**: only public method invocations **through the proxy** are intercepted

---

**Q: What design patterns does Spring use internally?**

| Pattern | Spring Example |
|---------|---------------|
| Factory | `BeanFactory` |
| Singleton | Default bean scope |
| Proxy | AOP, `@Transactional` |
| Template Method | `JdbcTemplate`, `RestTemplate` |
| Observer | `ApplicationEvent` |
| Strategy | `HandlerMapping`, `ResourceLoader` |
| Adapter | `HandlerAdapter` |
| Composite | `CompositeCacheManager` |

Understanding these helps you extend the framework correctly.

### Advanced Reading

- [AOP](aop.md)
- [Design Patterns in Spring](design-patterns.md)
- [WebFlux (Reactive)](webflux.md)
- [Spring Cloud](spring-cloud.md)
- [Spring Modulith](spring-modulith.md)
- [Spring AI](spring-ai.md)

---

## Interview Preparation Roadmap

| Week | Focus | Sections | Goal |
|------|-------|----------|------|
| 1 | Core Spring & IoC | Sections 1-2 | Explain IoC internals, auto-config, and bean lifecycle fluently |
| 2 | Web & REST | Section 3 | Design a REST API and explain the full request lifecycle |
| 3 | Security & Data | Sections 4-5 | Implement JWT auth and optimize JPA queries from memory |
| 4 | Testing & Messaging | Sections 6-7 | Write test strategies and explain async error handling |
| 5 | Production & Advanced | Sections 8-9 | Discuss production tuning, observability, and architecture |

**Daily practice**: Pick 5 questions from the Quick Recall table below and answer them out loud without notes. Articulate answers in under 60 seconds — this mirrors real interview pacing.

---

## Quick Recall — Top 50 Spring Boot Interview Questions

| # | Question | One-Line Answer |
|---|----------|-----------------|
| 1 | What is Spring Boot? | Opinionated framework that auto-configures Spring applications with embedded servers, eliminating boilerplate XML/Java config. |
| 2 | What does @SpringBootApplication do? | Combines @Configuration, @EnableAutoConfiguration, and @ComponentScan on the main class. |
| 3 | How does auto-configuration work? | Reads AutoConfiguration.imports, applies @Conditional checks, and registers beans only when conditions are met. |
| 4 | What is the difference between @Component, @Service, @Repository? | All are stereotype annotations for component scanning; @Repository adds persistence exception translation, @Service is semantic only. |
| 5 | What are bean scopes? | Singleton (default), Prototype, Request, Session, Application, WebSocket. |
| 6 | How does constructor injection differ from field injection? | Constructor injection enables immutability, fails fast on missing deps, and is testable without reflection. |
| 7 | What is a BeanPostProcessor? | Hook that intercepts bean initialization to modify or wrap beans (e.g., AOP proxy creation). |
| 8 | What is @Conditional? | Meta-annotation that makes bean registration conditional on class presence, property values, or other beans. |
| 9 | How do profiles work? | @Profile activates beans/config only when the named profile is active via spring.profiles.active property. |
| 10 | What is SpEL? | Spring Expression Language — runtime expression evaluation for property injection, @Value, @PreAuthorize. |
| 11 | What is DispatcherServlet? | Front controller that receives all requests and dispatches to appropriate handlers via HandlerMapping. |
| 12 | What is @RequestBody vs @RequestParam? | @RequestBody deserializes the HTTP body; @RequestParam extracts query/form parameters. |
| 13 | How does content negotiation work? | Spring selects HttpMessageConverter based on Accept header, URL suffix, or query parameter. |
| 14 | What is @ControllerAdvice? | Global exception handling and model attribute binding across all controllers. |
| 15 | How do you implement pagination? | Accept Pageable parameter in repository method; Spring Data auto-resolves from request params. |
| 16 | What is HATEOAS? | Hypermedia links in responses that guide clients through available actions (Spring HATEOAS module). |
| 17 | How does @Valid work? | Triggers Bean Validation (JSR-380) on the annotated parameter; throws MethodArgumentNotValidException on failure. |
| 18 | What is the security filter chain? | Ordered list of security filters (CSRF, auth, authz) processed for each request inside FilterChainProxy. |
| 19 | How does Spring Security authenticate? | AuthenticationManager delegates to AuthenticationProvider, which uses UserDetailsService to load user and verify credentials. |
| 20 | What is CSRF and when to disable it? | Cross-Site Request Forgery protection; disable for stateless (token-based) APIs since tokens inherently prevent CSRF. |
| 21 | How do you implement role-based access? | Use hasRole() in SecurityFilterChain or @PreAuthorize("hasRole('ADMIN')") on methods. |
| 22 | What is OAuth2 Resource Server? | Spring module that validates access tokens (JWT or opaque) and creates Authentication from token claims. |
| 23 | What is JPA? | Java Persistence API — ORM specification that Hibernate implements; Spring Data JPA adds repository abstraction. |
| 24 | What is the N+1 problem? | Loading N child collections triggers N additional queries; fix with JOIN FETCH or @EntityGraph. |
| 25 | What is @Transactional propagation? | Defines how transactions relate — REQUIRED joins existing, REQUIRES_NEW always creates new. |
| 26 | Why does @Transactional fail on self-call? | Proxy is bypassed when a bean calls its own method; use separate beans or TransactionTemplate. |
| 27 | What is optimistic locking? | @Version column checked on update; throws exception if another transaction modified the row. |
| 28 | What is a DTO projection? | Interface or class-based projection that fetches only needed columns, avoiding full entity loading. |
| 29 | How do database migrations work? | Flyway/Liquibase track versioned SQL scripts and apply them on startup in order. |
| 30 | What is dirty checking? | Hibernate compares entity state at flush time to its initial snapshot and generates UPDATE for changes. |
| 31 | What is @WebMvcTest? | Test slice that loads only MVC components (controllers, filters, advice) — no service/repo layer. |
| 32 | What is @MockBean? | Replaces a bean in ApplicationContext with a Mockito mock for the duration of the test. |
| 33 | What are Testcontainers? | Library that spins up real Docker containers (DB, Kafka, Redis) for integration tests. |
| 34 | How do you test async methods? | Use Awaitility or CompletableFuture.get() with timeout; verify the executor is invoked. |
| 35 | What is @DirtiesContext? | Marks that the test modified the ApplicationContext, forcing Spring to rebuild it for subsequent tests. |
| 36 | How does @Async work? | Proxy intercepts call and submits to a TaskExecutor thread pool; must return void or CompletableFuture. |
| 37 | What is a dead-letter queue? | Destination for messages that failed processing after max retries — enables investigation without blocking. |
| 38 | What is exactly-once semantics in Kafka? | Producer idempotence + transactional API + consumer read-committed isolation for end-to-end guarantees. |
| 39 | What is Spring Batch? | Framework for chunk-based batch processing with restartability, skip/retry, and job repository tracking. |
| 40 | What is WebSocket in Spring? | STOMP-over-WebSocket support via @MessageMapping for bidirectional real-time communication. |
| 41 | What is Actuator? | Production endpoints for health, metrics, info, env, thread dumps, and more. |
| 42 | What metrics should you monitor? | Request rate, error rate, latency (p50/p95/p99), JVM heap, GC pause time, thread pool utilization, connection pool usage. |
| 43 | How does caching work in Spring? | @Cacheable stores method results keyed by params; supports EhCache, Redis, Caffeine via CacheManager abstraction. |
| 44 | What is a buildpack in Spring Boot? | Cloud Native Buildpack creates OCI images without Dockerfile via `mvn spring-boot:build-image`. |
| 45 | How do you configure HikariCP? | Set maximumPoolSize (match thread pool), connectionTimeout, minimumIdle, and maxLifetime in application.yml. |
| 46 | What is AOP? | Aspect-Oriented Programming — separates cross-cutting concerns (logging, security, tx) from business logic using proxies. |
| 47 | What is Spring Cloud Config? | Centralized configuration server that serves properties from Git/Vault to all microservices. |
| 48 | What is a Circuit Breaker? | Pattern that fails fast when a downstream service is unhealthy, preventing cascade failures (Resilience4j). |
| 49 | What is GraalVM native image? | AOT-compiled binary with instant startup and low memory; trade-off is build complexity and limited reflection. |
| 50 | What is Spring Modulith? | Framework for well-structured monoliths with enforced module boundaries and event-driven inter-module communication. |

---

## Common Follow-Up Topics

Beyond the core Spring Boot questions, FAANG interviewers often bridge into:

- **System Design** — How would you design a Spring Boot service handling 100K RPS? (Connection pooling, async, caching, horizontal scaling)
- **Debugging** — A Spring Boot app has a memory leak; walk me through your investigation. (Heap dump, MAT analysis, common causes like unbounded caches or session state)
- **Migration** — How do you migrate a monolith to microservices using Spring? (Strangler fig, Spring Modulith as intermediate step, API gateway introduction)
- **Trade-offs** — When would you NOT use Spring Boot? (Simple CLI tools, serverless with extreme cold-start sensitivity, polyglot systems where framework lock-in is a concern)

---

---

## Frequently Asked Questions

??? question "What are the top Spring Boot interview questions for senior developers?"

    Senior-level Spring Boot interviews focus on: auto-configuration internals and conditional beans, Bean lifecycle (instantiation → population → init → destroy), transaction propagation and isolation levels, Spring Security filter chain architecture, production tuning (connection pools, thread pools, caching), and how Spring Boot differs from Spring Framework. Expect deep dives into AOP proxies, circular dependency resolution, and reactive vs servlet stacks.

??? question "What is Spring Boot auto-configuration and how does it work?"

    Auto-configuration automatically configures beans based on classpath dependencies and defined properties. Spring Boot scans `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`, evaluates `@Conditional` annotations (e.g., `@ConditionalOnClass`, `@ConditionalOnMissingBean`), and registers beans only when conditions are met. You can override any auto-configured bean by defining your own.

??? question "What is the difference between @Component, @Service, @Repository, and @Controller?"

    All four are stereotype annotations that mark classes as Spring-managed beans. `@Component` is the generic stereotype. `@Service` indicates business logic (no extra behavior). `@Repository` adds persistence exception translation (SQLExceptions → DataAccessExceptions). `@Controller` enables MVC request mapping. Functionally they're interchangeable, but semantics improve code readability.

??? question "How do you handle transactions in Spring Boot?"

    Use `@Transactional` on methods or classes. Spring creates a proxy that manages the transaction lifecycle. Key attributes: `propagation` (REQUIRED, REQUIRES_NEW, etc.), `isolation` (READ_COMMITTED, SERIALIZABLE, etc.), `rollbackFor` (which exceptions trigger rollback). Common pitfall: `@Transactional` doesn't work on private methods or self-invocation because Spring uses proxy-based AOP.

??? question "What is the N+1 problem in Spring Data JPA and how to fix it?"

    The N+1 problem occurs when loading a parent entity triggers N additional queries for each child relationship. Solutions: use `@EntityGraph` or `JOIN FETCH` in JPQL for eager loading, batch fetching with `@BatchSize`, DTO projections to select only needed columns, or switch to a native query. Always enable SQL logging during development to detect N+1 issues early.

??? question "How does Spring Security filter chain work?"

    Spring Security uses a chain of servlet filters (DelegatingFilterProxy → FilterChainProxy → SecurityFilterChain). Each filter handles a specific concern: CSRF, authentication, authorization, session management. Requests pass through filters sequentially. You configure the chain via `SecurityFilterChain` bean with `HttpSecurity` builder. Custom filters can be inserted at specific positions using `addFilterBefore`/`addFilterAfter`.

---

## See Also

- [Java Interview Guide](../java/java-interview-guide.md)
- [System Design Interview Guide](../systemdesign/system-design-interview-guide.md)
- [Microservices Interview Guide](../microservices/microservices.md)
