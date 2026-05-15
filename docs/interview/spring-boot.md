# Top 40 Spring Boot Interview Questions & Answers

!!! tip "Interview Prep"
    These 40 questions cover the most frequently asked Spring Boot topics across all experience levels. Each answer is concise and interview-ready, with code snippets where they add clarity.

---

## Core Concepts

??? question "Q1: What is Spring Boot and why use it?"

    **Answer:** Spring Boot is an opinionated framework built on top of Spring Framework that simplifies the creation of production-ready applications. It eliminates boilerplate configuration through **auto-configuration**, provides **embedded servers** (no WAR deployment needed), offers **starter dependencies** for quick setup, and includes **production-ready features** like health checks and metrics via Actuator. In short, it lets you focus on business logic instead of infrastructure plumbing.

??? question "Q2: What is the difference between Spring and Spring Boot?"

    **Answer:**

    | Aspect | Spring Framework | Spring Boot |
    |--------|-----------------|-------------|
    | Configuration | Requires manual XML or Java config | Auto-configuration out of the box |
    | Server | Needs external server (Tomcat, JBoss) | Embedded server included |
    | Dependencies | Manually manage compatible versions | Starters provide curated dependency sets |
    | Setup time | Significant boilerplate | Minimal — start coding immediately |
    | Production features | Build your own | Actuator, DevTools built in |

    Spring Boot is not a replacement for Spring — it is a layer on top that makes Spring easier to use.

??? question "Q3: How does auto-configuration work in Spring Boot?"

    **Answer:** Auto-configuration automatically configures beans based on classpath jars and your existing bean definitions:

    1. `@EnableAutoConfiguration` (part of `@SpringBootApplication`) triggers the process.
    2. Spring Boot reads `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (3.x) or `META-INF/spring.factories` (2.x) to discover configuration classes.
    3. Each class uses `@Conditional` annotations (`@ConditionalOnClass`, `@ConditionalOnMissingBean`) to decide whether to apply.
    4. User-defined beans always take precedence — define your own `DataSource` and the auto-configured one backs off.

    Inspect active auto-configurations with `--debug` or `/actuator/conditions`.

??? question "Q4: What does @SpringBootApplication combine?"

    **Answer:** `@SpringBootApplication` is a convenience annotation that combines three annotations:

    ```java
    @SpringBootConfiguration   // Marks this as a configuration class (specialization of @Configuration)
    @EnableAutoConfiguration   // Enables Spring Boot auto-configuration
    @ComponentScan             // Scans the current package and sub-packages for @Component classes
    ```

    This is why your main class should sit at the **root package** — so component scanning picks up all your beans.

??? question "Q5: What are Spring Boot starters?"

    **Answer:** Starters are curated sets of dependencies that you can include in your project. They follow the naming convention `spring-boot-starter-*`. Examples:

    - `spring-boot-starter-web` — Spring MVC, embedded Tomcat, Jackson
    - `spring-boot-starter-data-jpa` — Spring Data JPA, Hibernate, HikariCP
    - `spring-boot-starter-security` — Spring Security, authentication/authorization
    - `spring-boot-starter-test` — JUnit 5, Mockito, AssertJ, Spring Test

    They solve **version compatibility** headaches — all transitive dependencies are tested together under the Spring Boot BOM.

??? question "Q6: How does the embedded server work, and can you switch it?"

    **Answer:** Spring Boot packages an embedded servlet container (Tomcat by default) inside your JAR. The application runs as a standalone Java process — no external server installation required.

    To switch, exclude `spring-boot-starter-tomcat` from `spring-boot-starter-web` and add `spring-boot-starter-jetty` or `spring-boot-starter-undertow`. Undertow is often preferred for reactive workloads due to lower memory footprint.

---

## Configuration & Profiles

??? question "Q7: application.properties vs application.yml — which should you use?"

    **Answer:** Both serve the same purpose; the choice is largely team preference.

    | Feature | .properties | .yml |
    |---------|------------|------|
    | Syntax | `key=value` flat pairs | Hierarchical indentation-based |
    | Readability | Verbose for nested keys | Cleaner for deep nesting |
    | Multi-doc | Not supported | Supports `---` separator for multiple profiles |
    | Gotcha | None | Indentation errors cause silent failures |

    YAML is more popular in modern projects because Spring Boot configurations tend to be deeply nested (e.g., `spring.datasource.hikari.maximum-pool-size`).

??? question "Q8: How do Spring Boot profiles work?"

    **Answer:** Profiles let you segregate configuration by environment. Activate a profile via:

    - `application-{profile}.yml` files (e.g., `application-dev.yml`, `application-prod.yml`)
    - `spring.profiles.active=dev` in properties, as a JVM argument (`-Dspring.profiles.active=dev`), or as an env variable
    - Programmatically via `SpringApplication.setAdditionalProfiles()`

    You can also annotate beans with `@Profile("dev")` so they only load in specific environments. Spring Boot 2.4+ introduced **profile groups** to activate multiple profiles together:

    ```yaml
    spring:
      profiles:
        group:
          prod: proddb, prodmq
    ```

??? question "Q9: How does @ConfigurationProperties work?"

    **Answer:** `@ConfigurationProperties` binds external configuration to a strongly typed Java bean, providing type safety and validation:

    ```java
    @ConfigurationProperties(prefix = "app.mail")
    @Validated
    public class MailProperties {
        @NotEmpty private String host;
        private int port = 587;
        private String username;
        // getters and setters
    }
    ```

    Enable it with `@EnableConfigurationProperties(MailProperties.class)` or `@Component` on the class. Since Spring Boot 2.2+, **constructor binding** allows immutable config objects.

---

## Bean Lifecycle & Dependency Injection

??? question "Q10: Describe the Spring bean lifecycle."

    **Answer:** The lifecycle follows this sequence:

    1. **Instantiation** — Bean created via constructor.
    2. **Populate properties** — Dependencies injected.
    3. **Aware interfaces** — `BeanNameAware`, `ApplicationContextAware`, etc.
    4. **BeanPostProcessor.postProcessBeforeInitialization()**
    5. **@PostConstruct** / `InitializingBean.afterPropertiesSet()` / custom `init-method`
    6. **BeanPostProcessor.postProcessAfterInitialization()** — Proxies created here (AOP).
    7. **Bean is ready for use.**
    8. **@PreDestroy** / `DisposableBean.destroy()` / custom `destroy-method` — On context shutdown.

??? question "Q11: What are the bean scopes in Spring?"

    **Answer:**

    | Scope | Description |
    |-------|-------------|
    | **singleton** (default) | One instance per Spring IoC container |
    | **prototype** | New instance every time the bean is requested |
    | **request** | One instance per HTTP request (web only) |
    | **session** | One instance per HTTP session (web only) |
    | **application** | One instance per ServletContext |
    | **websocket** | One instance per WebSocket session |

    **Common pitfall:** Injecting a prototype bean into a singleton gives you a single instance of the prototype. Fix with `ObjectProvider<T>`, `@Lookup`, or `Provider<T>`.

??? question "Q12: What is the difference between @Component, @Service, @Repository, and @Controller?"

    **Answer:** All four are stereotype annotations detected by component scanning. Functionally, `@Service`, `@Repository`, and `@Controller` are specializations of `@Component`:

    - **@Component** — Generic Spring-managed bean.
    - **@Service** — Business/service layer. No extra behavior, but signals intent.
    - **@Repository** — Persistence layer. Spring adds **automatic exception translation** (converts JDBC/JPA exceptions to Spring's `DataAccessException` hierarchy).
    - **@Controller** — Web layer. Enables `@RequestMapping` and view resolution. `@RestController` adds `@ResponseBody` to every method.

    Use them for **semantic clarity** — it matters for readability, AOP pointcuts, and exception handling.

??? question "Q13: What are the types of dependency injection, and which is preferred?"

    **Answer:** Spring supports three injection types:

    ```java
    // 1. Constructor injection (PREFERRED)
    @Service
    public class OrderService {
        private final PaymentGateway gateway;
        public OrderService(PaymentGateway gateway) { this.gateway = gateway; }
    }

    // 2. Setter injection — @Autowired on setter method
    // 3. Field injection — @Autowired on field (AVOID)
    ```

    **Constructor injection is preferred** because: fields can be `final` (immutable), dependencies are explicit, the bean cannot exist in an invalid state, and it is easily testable without reflection. `@Autowired` is optional when there is a single constructor.

??? question "Q14: How do @Qualifier and @Primary resolve ambiguity?"

    **Answer:** When multiple beans of the same type exist, Spring cannot decide which to inject.

    - **@Primary** — Marks a bean as the default choice when no qualifier is specified.
    - **@Qualifier("beanName")** — Explicitly selects a specific bean by name at the injection point.

    `@Qualifier` overrides `@Primary` when both are present. Example: `@Bean @Primary DataSource primaryDs()` is the default, but `@Autowired @Qualifier("reporting") DataSource ds` selects the named bean instead.

??? question "Q15: What is a circular dependency and how do you resolve it?"

    **Answer:** A circular dependency occurs when bean A depends on bean B, and B depends on A. With constructor injection, Spring cannot create either bean and throws `BeanCurrentlyInCreationException`.

    **Solutions (best to worst):**

    1. **Redesign** — Extract shared logic into a third bean. This is almost always the right answer.
    2. **Use `@Lazy`** on one constructor parameter — Spring injects a proxy, resolving the cycle.
    3. **Switch one dependency to setter injection** — Allows Spring to partially construct the bean first.
    4. **`@PostConstruct` initialization** — Fetch the dependency after construction.

    Note: Spring Boot 2.6+ **disables circular references by default**. You can allow them with `spring.main.allow-circular-references=true`, but fixing the design is strongly preferred.

---

## Transactions & AOP

??? question "Q16: How does @Transactional work under the hood?"

    **Answer:** Spring creates a **proxy** (JDK dynamic proxy or CGLIB) around the bean. When a `@Transactional` method is called, the proxy intercepts, begins a transaction, delegates to the actual method, and commits or rolls back.

    Key attributes:

    - **propagation** — `REQUIRED` (default, join existing or create new), `REQUIRES_NEW` (always new), `NESTED`, `SUPPORTS`, `MANDATORY`, `NOT_SUPPORTED`, `NEVER`
    - **isolation** — `DEFAULT`, `READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE`
    - **rollbackFor** — By default rolls back only on unchecked exceptions. Use `rollbackFor = Exception.class` to include checked exceptions.
    - **readOnly** — Hints to the persistence provider (can enable optimizations).

    **Common pitfall:** Calling a `@Transactional` method from within the same class bypasses the proxy — the transaction is not applied. Solution: self-inject or refactor into a separate bean.

??? question "Q17: Explain Spring AOP concepts: aspect, advice, pointcut, join point."

    **Answer:**

    - **Aspect** — A cross-cutting concern modularized into a class (e.g., logging, security). Annotated with `@Aspect`.
    - **Join Point** — A point during execution where an aspect can plug in. In Spring AOP, this is always a **method execution**.
    - **Pointcut** — An expression that selects join points. Example: `@Pointcut("execution(* com.app.service.*.*(..))")`.
    - **Advice** — The action taken at a join point:
        - `@Before` — runs before the method
        - `@After` — runs after (regardless of outcome)
        - `@AfterReturning` — runs after successful return
        - `@AfterThrowing` — runs after an exception
        - `@Around` — wraps the method (most powerful)

    Spring AOP uses **runtime proxies**, not bytecode weaving (unlike AspectJ). This means it only works on **Spring-managed beans** and **public methods**.

---

## Security

??? question "Q18: Describe the Spring Security authentication flow."

    **Answer:** For a typical form/HTTP Basic authentication:

    1. Request hits the **Security Filter Chain** (`jakarta.servlet.Filter` chain).
    2. `UsernamePasswordAuthenticationFilter` extracts credentials and creates an `Authentication` token.
    3. The token is passed to **AuthenticationManager** (usually `ProviderManager`).
    4. It delegates to **AuthenticationProviders** which use **UserDetailsService** + **PasswordEncoder** to verify.
    5. On success, a populated `Authentication` object is stored in the **SecurityContextHolder**.
    6. Subsequent requests restore the context (session-based) or re-authenticate (stateless/JWT).

??? question "Q19: How do you implement JWT authentication with Spring Security?"

    **Answer:** The typical setup involves:

    1. **Disable sessions** — `sessionManagement(sm -> sm.sessionCreationPolicy(STATELESS))`.
    2. **Login endpoint** — Authenticates credentials and returns a signed JWT (subject, roles, expiry).
    3. **JWT filter** — A `OncePerRequestFilter` before `UsernamePasswordAuthenticationFilter` that extracts `Authorization: Bearer <token>`, validates signature/expiry, and sets `Authentication` in `SecurityContextHolder`.

    ```java
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http.csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/auth/**").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
    ```

    Use short-lived access tokens with refresh tokens, and never put sensitive data in the JWT payload.

---

## Exception Handling & Validation

??? question "Q20: How does global exception handling work in Spring Boot?"

    **Answer:** Use `@ControllerAdvice` (or `@RestControllerAdvice`) with `@ExceptionHandler` methods:

    ```java
    @RestControllerAdvice
    public class GlobalExceptionHandler {
        @ExceptionHandler(ResourceNotFoundException.class)
        @ResponseStatus(HttpStatus.NOT_FOUND)
        public ErrorResponse handleNotFound(ResourceNotFoundException ex) {
            return new ErrorResponse("NOT_FOUND", ex.getMessage());
        }

        @ExceptionHandler(MethodArgumentNotValidException.class)
        @ResponseStatus(HttpStatus.BAD_REQUEST)
        public ErrorResponse handleValidation(MethodArgumentNotValidException ex) {
            Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(FieldError::getField, FieldError::getDefaultMessage));
            return new ErrorResponse("VALIDATION_FAILED", errors.toString());
        }
    }
    ```

    `@ControllerAdvice` applies globally (scope with `basePackages` if needed). Extend `ResponseEntityExceptionHandler` for a convenient base class.

??? question "Q21: How do you validate request bodies in Spring Boot?"

    **Answer:** Add `spring-boot-starter-validation` (Hibernate Validator) and use `@Valid` or `@Validated`:

    ```java
    public class CreateUserRequest {
        @NotBlank(message = "Name is required")
        private String name;

        @Email(message = "Invalid email")
        private String email;

        @Min(18) @Max(150)
        private int age;
    }

    @PostMapping("/users")
    public ResponseEntity<?> create(@Valid @RequestBody CreateUserRequest req) { ... }
    ```

    - **@Valid** — Standard JSR-380; triggers validation and throws `MethodArgumentNotValidException` on failure.
    - **@Validated** — Spring-specific; supports **validation groups** for different rules on create vs update.
    - **Custom validators** — Implement `ConstraintValidator<A, T>` and create a custom annotation.

---

## Spring Data JPA

??? question "Q22: What are Spring Data JPA repositories?"

    **Answer:** Spring Data JPA eliminates boilerplate DAO code by providing repository interfaces:

    - **CrudRepository** — Basic CRUD operations (`save`, `findById`, `delete`, `findAll`).
    - **JpaRepository** — Extends `CrudRepository` with JPA-specific methods (`flush`, `saveAndFlush`, batch deletes) and `PagingAndSortingRepository`.
    - **Derived query methods** — Spring parses method names into queries: `findByEmailAndStatus(String email, Status status)` becomes `SELECT ... WHERE email = ? AND status = ?`.

    ```java
    public interface UserRepository extends JpaRepository<User, Long> {
        List<User> findByLastNameOrderByFirstNameAsc(String lastName);
        Optional<User> findByEmail(String email);
        boolean existsByUsername(String username);
    }
    ```

    Spring generates the implementation at runtime using JDK proxies.

??? question "Q23: @Query — JPQL vs native queries?"

    **Answer:**

    ```java
    // JPQL — database-agnostic, uses entity/field names
    @Query("SELECT u FROM User u WHERE u.email = :email")
    Optional<User> findByEmailJpql(@Param("email") String email);

    // Native SQL — database-specific, uses table/column names
    @Query(value = "SELECT * FROM users WHERE email = :email", nativeQuery = true)
    Optional<User> findByEmailNative(@Param("email") String email);

    // Modification queries
    @Modifying
    @Query("UPDATE User u SET u.active = false WHERE u.lastLogin < :date")
    int deactivateInactiveUsers(@Param("date") LocalDate date);
    ```

    **Use JPQL** by default for portability. Use **native queries** when you need database-specific features (window functions, JSON operators, full-text search).

??? question "Q24: How do pagination and sorting work?"

    **Answer:** `JpaRepository` extends `PagingAndSortingRepository`, so you get pagination for free:

    ```java
    Page<User> findByStatus(Status status, Pageable pageable);

    Pageable pageable = PageRequest.of(0, 20, Sort.by("createdAt").descending());
    Page<User> page = userRepository.findByStatus(Status.ACTIVE, pageable);
    // page.getTotalElements(), page.getContent(), page.hasNext()
    ```

    In REST controllers, Spring resolves `Pageable` directly from query params: `?page=0&size=20&sort=createdAt,desc`.

??? question "Q25: What is the N+1 problem and how do you solve it?"

    **Answer:** The N+1 problem occurs when loading a parent entity triggers N additional queries to load its children (one per parent). For example, loading 100 orders with lazy-loaded items fires 1 query for orders + 100 queries for items.

    **Solutions:**

    1. **JOIN FETCH** — `@Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.status = :s")`
    2. **@EntityGraph** — `@EntityGraph(attributePaths = {"items", "items.product"})`
    3. **@BatchSize(size = 50)** — Hibernate loads associations in batches instead of one-by-one.

    `JOIN FETCH` and `@EntityGraph` are the most common fixes. Enable SQL logging during development to catch N+1 issues early.

??? question "Q26: Lazy vs Eager loading — when to use which?"

    **Answer:**

    - **LAZY** (default for `@OneToMany`, `@ManyToMany`) — The association is loaded only when accessed. Preferred in most cases to avoid loading unnecessary data.
    - **EAGER** (`@ManyToOne`, `@OneToOne` default) — The association is loaded immediately with the parent.

    **Best practice:** Set everything to `LAZY` and use `JOIN FETCH` or `@EntityGraph` where you actually need the related data. Eager loading leads to unexpected queries and performance issues as your object graph grows.

    **LazyInitializationException** occurs when accessing a lazy association outside a transaction/session. Fix with `@Transactional` on the service method, DTOs, or `@EntityGraph`.

---

## Caching

??? question "Q27: How does Spring Boot caching work?"

    **Answer:** Enable caching with `@EnableCaching` and annotate methods:

    ```java
    @Cacheable(value = "users", key = "#id")       public User findById(Long id) { ... }
    @CachePut(value = "users", key = "#user.id")   public User update(User user) { ... }
    @CacheEvict(value = "users", key = "#id")      public void delete(Long id) { ... }
    @CacheEvict(value = "users", allEntries = true) public void evictAll() { ... }
    ```

    Spring Boot auto-configures a provider based on classpath: **Caffeine**, **Redis**, **EhCache**, or **Hazelcast**. Falls back to `ConcurrentHashMap`. Like `@Transactional`, caching uses proxies — same-class calls bypass the cache.

---

## Actuator & Monitoring

??? question "Q28: What does Spring Boot Actuator provide?"

    **Answer:** Actuator exposes production-ready operational endpoints:

    | Endpoint | Purpose |
    |----------|---------|
    | `/actuator/health` | Application health status |
    | `/actuator/info` | Application info (version, description) |
    | `/actuator/metrics` | Micrometer metrics (JVM, HTTP, custom) |
    | `/actuator/env` | Configuration properties |
    | `/actuator/beans` | All registered beans |
    | `/actuator/loggers` | View and change log levels at runtime |
    | `/actuator/threaddump` | Thread dump |
    | `/actuator/prometheus` | Prometheus-format metrics export |

    By default, only `health` and `info` are exposed over HTTP. Expose more with:

    ```yaml
    management:
      endpoints:
        web:
          exposure:
            include: health, info, metrics, prometheus
    ```

    Always secure actuator endpoints in production.

??? question "Q29: How do you create a custom health indicator?"

    **Answer:** Implement the `HealthIndicator` interface:

    ```java
    @Component
    public class SearchEngineHealthIndicator implements HealthIndicator {
        @Override
        public Health health() {
            boolean isUp = checkElasticsearch();
            return isUp ? Health.up().withDetail("cluster", "green").build()
                        : Health.down().withDetail("reason", "ping failed").build();
        }
    }
    ```

    It automatically appears under `/actuator/health`. Use custom health indicators for databases, message brokers, and any critical external dependency.

---

## Async & Scheduling

??? question "Q30: How does @Async work in Spring Boot?"

    **Answer:** Enable with `@EnableAsync`, then annotate methods with `@Async`:

    ```java
    @Async
    public CompletableFuture<Report> generateReport(Long userId) {
        Report report = heavyComputation(userId);
        return CompletableFuture.completedFuture(report);
    }
    ```

    Spring executes the method in a separate thread from a task executor. **Key points:**

    - Must be called from a **different bean** (proxy-based, same-class calls bypass it).
    - Return `void` or `CompletableFuture<T>`.
    - Configure a custom `ThreadPoolTaskExecutor` bean to avoid the default `SimpleAsyncTaskExecutor` (which creates a new thread per task with no pooling).

??? question "Q31: How does scheduling work with @Scheduled?"

    **Answer:** Enable with `@EnableScheduling`:

    ```java
    @Scheduled(fixedRate = 5000)          // Every 5 seconds
    public void pollForUpdates() { ... }

    @Scheduled(fixedDelay = 10000)        // 10 seconds after previous execution finishes
    public void processQueue() { ... }

    @Scheduled(cron = "0 0 2 * * MON-FRI") // 2 AM on weekdays
    public void nightlyCleanup() { ... }
    ```

    **Cron format:** `second minute hour day-of-month month day-of-week`. By default all `@Scheduled` methods share a **single thread** — configure `spring.task.scheduling.pool.size` for parallelism. In distributed environments, use **ShedLock** to prevent duplicate execution across instances.

---

## Events

??? question "Q32: How do Spring Events work?"

    **Answer:** Spring provides an event-driven model for decoupling components:

    ```java
    // 1. Define event
    public record OrderPlacedEvent(Long orderId, BigDecimal amount) {}

    // 2. Publish
    publisher.publishEvent(new OrderPlacedEvent(order.getId(), order.getTotal()));

    // 3. Listen
    @EventListener
    public void onOrderPlaced(OrderPlacedEvent event) { sendEmail(event.orderId()); }

    @TransactionalEventListener(phase = AFTER_COMMIT)  // fires only if TX commits
    public void afterCommit(OrderPlacedEvent event) { ... }
    ```

    `@TransactionalEventListener` prevents side effects when the transaction rolls back. Events are synchronous by default; combine with `@Async` for async processing.

---

## Reactive Spring

??? question "Q33: What is the difference between Spring MVC and Spring WebFlux?"

    **Answer:**

    | Aspect | Spring MVC | Spring WebFlux |
    |--------|-----------|---------------|
    | Programming model | Synchronous, blocking | Asynchronous, non-blocking |
    | Threading | Thread-per-request | Event loop (few threads) |
    | Server | Servlet-based (Tomcat, Jetty) | Netty (default), Servlet 3.1+ |
    | Return types | Plain objects | `Mono<T>`, `Flux<T>` |
    | Best for | Traditional CRUD apps | High-concurrency, streaming, I/O-heavy |
    | Stack | Servlet API | Reactive Streams (Project Reactor) |

    WebFlux shines with many concurrent connections and high I/O latency. For typical CRUD with blocking JDBC, stick with Spring MVC.

??? question "Q34: What are Mono and Flux?"

    **Answer:** Mono and Flux are the two reactive types from **Project Reactor**, the reactive library behind WebFlux:

    - **Mono&lt;T&gt;** — Emits **0 or 1** element. Analogous to `Optional<T>` or `CompletableFuture<T>`.
    - **Flux&lt;T&gt;** — Emits **0 to N** elements. Analogous to a `Stream<T>` or a collection.

    ```java
    @GetMapping("/users/{id}")
    public Mono<User> getUser(@PathVariable Long id) {
        return userRepository.findById(id);
    }

    @GetMapping(value = "/users/stream", produces = TEXT_EVENT_STREAM_VALUE)
    public Flux<User> streamUsers() {
        return userRepository.findAll();
    }
    ```

    Both are **lazy** — nothing happens until subscribed. They support operators like `map`, `flatMap`, `filter`, `zip`, `retry`, and `onErrorResume`.

---

## REST API Design

??? question "Q35: What are REST API best practices in Spring Boot?"

    **Answer:**

    - **Nouns for resources** — `/api/orders`, not `/api/getOrders`.
    - **HTTP methods convey action** — `GET` (read), `POST` (create), `PUT` (full update), `PATCH` (partial), `DELETE`.
    - **Correct status codes** — `201 Created`, `204 No Content`, `400 Bad Request`, `404 Not Found`, `409 Conflict`.
    - **Pagination** — Return metadata (`totalElements`, `page`, `size`) alongside content.
    - **Consistent error responses** — Standard body with `code`, `message`, `timestamp`.
    - **Use DTOs** — Never expose JPA entities directly in API responses.

??? question "Q36: What are the common API versioning strategies?"

    **Answer:**

    | Strategy | Example | Pros | Cons |
    |----------|---------|------|------|
    | **URI path** | `/api/v1/users` | Simple, visible, easy to route | URL pollution, hard to sunset |
    | **Query parameter** | `/api/users?version=1` | Easy to default | Easy to overlook, caching issues |
    | **Custom header** | `X-API-Version: 1` | Clean URLs | Not visible in browser |
    | **Content negotiation** | `Accept: application/vnd.myapp.v1+json` | RESTful, standard | Complex client configuration |

    **URI path versioning** is the most widely used in practice due to simplicity. Whichever strategy you choose, maintain backward compatibility within a version and give clients a deprecation timeline.

---

## Testing

??? question "Q37: What testing annotations does Spring Boot provide?"

    **Answer:**

    | Annotation | Scope | What it loads |
    |------------|-------|---------------|
    | `@SpringBootTest` | Full integration test | Entire application context |
    | `@WebMvcTest` | Controller layer | MVC infrastructure only (no services, no DB) |
    | `@DataJpaTest` | Repository layer | JPA components, embedded DB, no web layer |
    | `@WebFluxTest` | Reactive controllers | WebFlux infrastructure |
    | `@JsonTest` | JSON serialization | Jackson/Gson auto-configuration |
    | `@RestClientTest` | REST clients | RestTemplate/WebClient mock server |

    **Slice tests** (`@WebMvcTest`, `@DataJpaTest`) are faster because they load only a subset of the context. Use `@SpringBootTest` sparingly for end-to-end scenarios.

??? question "Q38: What is the difference between @MockBean and @Mock?"

    **Answer:**

    - **@Mock** (Mockito) — Creates a standalone mock. Used in unit tests with `@ExtendWith(MockitoExtension.class)`. Does not interact with Spring context.
    - **@MockBean** (Spring Boot Test) — Creates a mock **and registers it in the Spring application context**, replacing any existing bean of that type. Used in integration and slice tests.

    ```java
    // Unit test — @Mock (fast, no Spring)
    @ExtendWith(MockitoExtension.class)
    class OrderServiceTest {
        @Mock PaymentGateway gateway;
        @InjectMocks OrderService service;
    }

    // Slice test — @MockBean (replaces bean in Spring context)
    @WebMvcTest(OrderController.class)
    class OrderControllerTest {
        @MockBean OrderService orderService;
        @Autowired MockMvc mockMvc;
    }
    ```

    Prefer `@Mock` for unit tests and `@MockBean` only when you need the Spring context.

---

## Docker & Deployment

??? question "Q39: How do you containerize a Spring Boot application?"

    **Answer:** Use a multi-stage Dockerfile:

    ```dockerfile
    # Build stage
    FROM eclipse-temurin:21-jdk AS build
    WORKDIR /app
    COPY . .
    RUN ./mvnw package -DskipTests

    # Runtime stage
    FROM eclipse-temurin:21-jre
    WORKDIR /app
    COPY --from=build /app/target/*.jar app.jar
    EXPOSE 8080
    ENTRYPOINT ["java", "-jar", "app.jar"]
    ```

    **Layered JARs** (Spring Boot 2.3+) improve Docker build caching by splitting dependencies, loader, snapshot-dependencies, and application code into separate layers. Alternatively, use `./mvnw spring-boot:build-image` to build OCI images via Cloud Native Buildpacks with no Dockerfile at all.

---

## Spring Boot 3 & Jakarta EE

??? question "Q40: What are the key changes in Spring Boot 3?"

    **Answer:** Spring Boot 3 (released Nov 2022, current line: 3.x) introduced significant changes:

    | Change | Detail |
    |--------|--------|
    | **Java 17+ baseline** | Minimum Java version raised from 8/11 to 17 |
    | **Jakarta EE 9+** | Package namespace changed from `javax.*` to `jakarta.*` |
    | **Spring Framework 6** | Underlying framework major version bump |
    | **Native compilation** | First-class GraalVM native image support via Spring AOT |
    | **Observability** | Built-in Micrometer Observation API for metrics and tracing |
    | **HTTP interfaces** | Declarative HTTP clients (like Feign but native Spring) |
    | **Problem Details** | RFC 7807 problem detail responses out of the box |

    **Migration essentials:** Upgrade to Java 17+, replace `javax.*` with `jakarta.*` (use OpenRewrite for automation), update third-party libraries to Jakarta-compatible versions, and replace deprecated APIs (e.g., `WebSecurityConfigurerAdapter` with `SecurityFilterChain` beans).

---

!!! info "Further Reading"
    For deeper dives into each topic, explore the dedicated pages in the **Spring & Microservices** section of this site.
