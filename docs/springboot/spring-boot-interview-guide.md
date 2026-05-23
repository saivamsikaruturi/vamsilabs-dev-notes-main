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

### Key Topics

Interviewers at senior levels expect you to explain not just *what* IoC and DI are, but *how* Spring implements them internally — the BeanFactory vs ApplicationContext distinction, bean definition parsing, and the full lifecycle from instantiation to destruction. You should be able to discuss when to use constructor vs setter injection and articulate the trade-offs.

### Must-Know Questions

**Q: What is IoC and DI? How does Spring implement them?**
Inversion of Control means the framework manages object creation and wiring rather than the application code. Dependency Injection is the mechanism — Spring's IoC container reads configuration (annotations, XML, or Java config), creates bean definitions, resolves dependencies via reflection, and injects them through constructors, setters, or fields.

**Q: What are the different bean scopes?**
Singleton (one instance per container, default), Prototype (new instance per request), Request (one per HTTP request), Session (one per HTTP session), Application (one per ServletContext), and WebSocket (one per WebSocket session). Injecting a prototype into a singleton requires a proxy or ObjectFactory to avoid stale references.

**Q: Explain the bean lifecycle.**
Instantiation → populate properties → BeanNameAware → BeanFactoryAware → ApplicationContextAware → BeanPostProcessor#postProcessBeforeInitialization → @PostConstruct → InitializingBean#afterPropertiesSet → custom init-method → BeanPostProcessor#postProcessAfterInitialization → ready → @PreDestroy → DisposableBean#destroy → custom destroy-method.

**Q: What is circular dependency and how does Spring handle it?**
A circular dependency occurs when Bean A depends on Bean B and Bean B depends on Bean A. Spring resolves this for singleton beans using a three-level cache (singletonObjects, earlySingletonObjects, singletonFactories) that exposes early references. This does NOT work with constructor injection — you must use @Lazy or redesign.

**Q: What is the difference between BeanFactory and ApplicationContext?**
BeanFactory provides basic IoC (lazy initialization, bean instantiation). ApplicationContext extends it with eager initialization, event publishing, internationalization, AOP integration, and environment abstraction. In production, you always use ApplicationContext.

**Q: When should you use @Component vs @Bean?**
@Component is for classpath scanning of your own classes. @Bean is for explicit registration in @Configuration classes, typically for third-party library classes you cannot annotate, or when you need programmatic construction logic.

### Deep Dive Pages

- [Spring IoC Container](SpringIOC.md)
- [Types of Dependency Injection](TypesOfDi.md)
- [Bean Lifecycle](bean-lifecycle.md)
- [Circular Dependencies](circular-dependencies.md)
- [Configuration Properties](configuration-properties.md)
- [Profiles](profiles.md)
- [SpEL](spel.md)
- [Events](events.md)

---

## 2. Auto-Configuration & Internals

### Key Topics

Senior engineers are expected to understand what happens when a Spring Boot application starts — from SpringApplication.run() through auto-configuration resolution. Know how @Conditional annotations drive auto-configuration, how to write custom starters, and what changed in Spring Boot 3 (Jakarta namespace, GraalVM AOT, observability APIs).

### Must-Know Questions

**Q: How does Spring Boot auto-configuration work?**
Spring Boot reads META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports (Boot 3) or META-INF/spring.factories (Boot 2). Each auto-configuration class uses @Conditional annotations (@ConditionalOnClass, @ConditionalOnMissingBean, @ConditionalOnProperty) to decide whether to apply. Your explicit @Bean definitions take priority over auto-configured ones.

**Q: What is the difference between @SpringBootApplication and its components?**
@SpringBootApplication combines @Configuration (Java-based config), @EnableAutoConfiguration (trigger auto-configuration), and @ComponentScan (scan current package and sub-packages). Understanding this helps you control scanning scope and auto-configuration behavior.

**Q: How do you create a custom Spring Boot starter?**
Create two modules: an autoconfigure module with @Configuration classes annotated with @Conditional* annotations, and a starter module that pulls in the autoconfigure module as a dependency. Register the configuration in the AutoConfiguration.imports file. Provide sensible defaults and allow override via application properties.

**Q: What happens during SpringApplication.run()?**
Creates SpringApplication instance → loads SpringApplicationRunListeners → prepares Environment → creates ApplicationContext (reactive vs servlet) → loads bean definitions → refreshes context (instantiates beans) → calls runners (CommandLineRunner, ApplicationRunner) → publishes ApplicationReadyEvent.

**Q: What changed in Spring Boot 3?**
Java 17 baseline, Jakarta EE 10 (javax.* → jakarta.*), GraalVM native image support, built-in observability with Micrometer, ProblemDetail for error responses (RFC 7807), new declarative HTTP clients, and deprecation of spring.factories for auto-configuration.

### Deep Dive Pages

- [Auto-Configuration](AutoConfiguration.md)
- [Spring Boot 3 Features](SpringBoot3.md)
- [Spring Boot Internals](internals.md)
- [Custom Starters & Bean Processors](custom-starter-bean-processors.md)
- [Annotations](Annotations.md)

---

## 3. Web & REST APIs

### Key Topics

You must understand the full MVC request lifecycle from DispatcherServlet through handler mapping, argument resolution, and response rendering. Interviewers expect you to design RESTful APIs following best practices and handle cross-cutting concerns (validation, exception handling, content negotiation) cleanly.

### Must-Know Questions

**Q: Explain the Spring MVC request lifecycle.**
Request hits DispatcherServlet → HandlerMapping finds the controller method → HandlerAdapter invokes it with resolved arguments (via HandlerMethodArgumentResolvers) → method executes → return value processed by HandlerMethodReturnValueHandler → ViewResolver (if view) or HttpMessageConverter (if @ResponseBody) produces response.

**Q: How do you handle exceptions globally?**
Use @ControllerAdvice with @ExceptionHandler methods. Spring Boot 3 adds ProblemDetail support for RFC 7807 responses. You can also implement ErrorController for overriding the default /error endpoint, or use ResponseStatusException for simple cases.

**Q: What is the difference between @Controller and @RestController?**
@RestController combines @Controller and @ResponseBody — every method returns serialized data directly rather than a view name. Use @Controller when you need to return views (Thymeleaf, JSP).

**Q: How does validation work in Spring Boot?**
Add spring-boot-starter-validation. Annotate DTOs with Bean Validation annotations (@NotNull, @Size, @Email). Use @Valid or @Validated on method parameters. Validation errors trigger MethodArgumentNotValidException, which you handle in @ControllerAdvice. For custom validation, implement ConstraintValidator.

**Q: How do filters differ from interceptors?**
Filters (javax.servlet.Filter) operate at the servlet level — they see raw requests before Spring processes them. HandlerInterceptors operate at the Spring MVC level — they have access to the handler method and model. Filters are for security, logging, compression. Interceptors are for controller-specific concerns.

**Q: How do you version a REST API?**
URI versioning (/api/v1/users), header versioning (Accept: application/vnd.api.v1+json), or query parameter (?version=1). URI versioning is most common and cache-friendly. Header versioning is more RESTful but less discoverable. Pick one and be consistent.

### Deep Dive Pages

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

### Key Topics

Spring Security is a top interview topic. You need to understand the filter chain architecture, authentication vs authorization flow, and how to secure both traditional and stateless (JWT/OAuth2) applications. Senior candidates should be able to explain security internals — not just configuration.

### Must-Know Questions

**Q: How does the Spring Security filter chain work?**
DelegatingFilterProxy delegates to FilterChainProxy, which holds one or more SecurityFilterChain instances. Each chain contains ordered filters (CsrfFilter, AuthenticationFilter, AuthorizationFilter, etc.). The chain processes sequentially; each filter can short-circuit the chain. You can add custom filters at specific positions.

**Q: What is the difference between authentication and authorization?**
Authentication verifies identity (who are you?) via AuthenticationManager → AuthenticationProvider → UserDetailsService. Authorization verifies permissions (what can you do?) via AuthorizationManager, checked after successful authentication. Spring stores both in the SecurityContext (ThreadLocal by default).

**Q: How do you implement JWT authentication in Spring Boot?**
Create a OncePerRequestFilter that extracts the JWT from the Authorization header, validates it (signature, expiration, claims), creates an Authentication object, and sets it in SecurityContextHolder. Configure SecurityFilterChain as stateless (SessionCreationPolicy.STATELESS) and register the filter before UsernamePasswordAuthenticationFilter.

**Q: How does method-level security work?**
Enable with @EnableMethodSecurity. Use @PreAuthorize("hasRole('ADMIN')") for pre-invocation checks, @PostAuthorize for post-invocation checks, @Secured for simple role checks. These use AOP proxies — so self-invocation bypasses security (same as @Transactional).

**Q: How do you secure a REST API against CSRF?**
For stateless APIs (JWT-based), disable CSRF — the token-based auth itself prevents CSRF. For session-based APIs, use Spring's CsrfFilter with the Synchronizer Token Pattern or the cookie-based approach (CookieCsrfTokenRepository).

### Deep Dive Pages

- [Spring Security](security.md)
- [Security Filter Chain Internals](security-filter-chain.md)
- [Method Security & OAuth2](method-security-oauth2.md)
- [JWT](../security/JWT.md)
- [OAuth 2.0](../security/Oauth.md)

---

## 5. Data Access & JPA

### Key Topics

Expect deep questions on JPA internals, Hibernate session management, transaction propagation, and performance optimization (especially the N+1 problem). Senior engineers should understand persistence context, dirty checking, and when JPA is not the right tool.

### Must-Know Questions

**Q: What is the N+1 problem and how do you fix it?**
When you load a parent entity and Hibernate lazily loads each child with a separate query. Fixes: JOIN FETCH in JPQL, @EntityGraph, batch fetching (@BatchSize), or using a DTO projection. Choose based on whether you need managed entities or read-only data.

**Q: Explain transaction propagation levels.**
REQUIRED (join existing or create new — default), REQUIRES_NEW (always new, suspends existing), NESTED (savepoint within existing), SUPPORTS (join if exists, else non-transactional), NOT_SUPPORTED (suspend existing), MANDATORY (must exist, else exception), NEVER (must not exist, else exception).

**Q: Why does @Transactional not work on private methods or self-invocation?**
Spring AOP uses proxies (JDK dynamic proxy or CGLIB). When a method calls another method on the same object, it bypasses the proxy — so the transactional advice is never applied. Solutions: inject self, use TransactionTemplate programmatically, or restructure into separate beans.

**Q: What is the difference between EAGER and LAZY loading?**
EAGER loads associated entities immediately with the parent query. LAZY loads them on first access (via proxy). Default: @ManyToOne/@OneToOne are EAGER; @OneToMany/@ManyToMany are LAZY. Best practice: use LAZY everywhere and fetch explicitly when needed.

**Q: How does the Hibernate first-level cache work?**
The persistence context (Session) acts as a first-level cache — every entity loaded in a transaction is cached by its ID. Repeated findById calls return the same object instance. It enables dirty checking (comparing snapshot at flush time) and repeatable reads within a transaction.

**Q: How do you handle optimistic vs pessimistic locking?**
Optimistic: @Version field — Hibernate checks version on update, throws OptimisticLockException on conflict. Best for low-contention scenarios. Pessimistic: @Lock(LockModeType.PESSIMISTIC_WRITE) — database-level lock. Best for high-contention, short-lived transactions.

### Deep Dive Pages

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

### Key Topics

Senior engineers must demonstrate testing strategy — unit tests with mocks, integration tests with slices, and end-to-end tests with real infrastructure. Know the trade-offs between test speed and confidence. Interviewers want to see that you understand the test pyramid in a Spring context.

### Must-Know Questions

**Q: What are Spring Boot test slices and when do you use them?**
Test slices load only a subset of the application context. @WebMvcTest loads MVC layer only (controllers, filters, advice). @DataJpaTest loads JPA layer (repositories, EntityManager). @JsonTest loads JSON serialization. They are faster than @SpringBootTest because they avoid loading the full context.

**Q: How does @MockBean differ from @Mock?**
@Mock (Mockito) creates a standalone mock not registered in Spring context. @MockBean replaces or adds a bean in the Spring ApplicationContext with a mock — useful when you need the mock to be injected into other Spring-managed beans during integration tests.

**Q: When should you use Testcontainers?**
When you need integration tests against real infrastructure (PostgreSQL, Redis, Kafka, Elasticsearch) without relying on shared test environments. Testcontainers spins up Docker containers per test class or test suite, giving you isolated, reproducible tests. Use @ServiceConnection in Boot 3.1+ for auto-configuration of connection properties.

**Q: How do you test @Transactional behavior?**
Use @SpringBootTest with @Transactional on the test class — Spring rolls back after each test. To test actual commit behavior (e.g., testing that optimistic locking works), remove @Transactional from the test and clean up manually or use @DirtiesContext.

### Deep Dive Pages

- [Testing in Spring Boot](testing.md)
- [Slice Testing](slice-testing.md)
- [Testcontainers](testcontainers.md)

---

## 7. Messaging & Async

### Key Topics

Distributed systems rely heavily on asynchronous communication. Know when to use message brokers vs direct async, understand at-least-once vs exactly-once semantics, and be prepared to discuss how Spring abstracts Kafka, RabbitMQ, and other messaging systems.

### Must-Know Questions

**Q: How does @Async work in Spring?**
@EnableAsync enables proxy-based async execution. Methods annotated with @Async run on a TaskExecutor thread pool. The method must return void or CompletableFuture. Caveats: self-invocation bypasses the proxy, exceptions in void methods are lost (use AsyncUncaughtExceptionHandler), and you should always configure a custom executor rather than using the default SimpleAsyncTaskExecutor (which creates unbounded threads).

**Q: How do you handle Kafka consumer failures?**
Use a RetryTopic or DefaultErrorHandler with backoff. Configure a dead-letter topic (DLT) for messages that exceed retry attempts. For ordering-sensitive consumers, pause the partition on failure. Spring Kafka provides @RetryableTopic annotation for declarative retry with exponential backoff and DLT routing.

**Q: What is the difference between @KafkaListener and @RabbitListener error handling?**
Kafka: offset-based — failed message blocks the partition unless you use a SeekToCurrentErrorHandler or skip. RabbitMQ: acknowledgment-based — failed messages can be nacked and requeued or routed to a dead-letter exchange. RabbitMQ gives more granular per-message control; Kafka requires partition-level strategies.

**Q: When should you use Spring Batch vs async processing?**
Spring Batch is for large-volume, chunk-based processing with built-in restart, skip, and retry capabilities, plus job repository for tracking. Use @Async or messaging for real-time, event-driven workloads. Batch is for ETL, report generation, and data migration.

### Deep Dive Pages

- [Async Processing](async.md)
- [Spring Kafka](spring-kafka.md)
- [Spring RabbitMQ](spring-rabbitmq.md)
- [Spring Batch](spring-batch.md)
- [WebSocket](spring-websocket.md)
- [Spring GraphQL](spring-graphql.md)

---

## 8. Production & Operations

### Key Topics

FAANG interviews increasingly focus on production readiness — observability, performance tuning, containerization, and operational maturity. You should demonstrate that you have shipped and operated Spring Boot services at scale, not just built them.

### Must-Know Questions

**Q: What Actuator endpoints should every production service expose?**
/health (for load balancer probes — with liveness and readiness groups in Kubernetes), /metrics (Prometheus-compatible via Micrometer), /info (build metadata), and /env or /configprops for debugging. Secure sensitive endpoints with Spring Security. Never expose /env or /beans publicly.

**Q: How do you implement health checks for Kubernetes?**
Configure liveness and readiness probe groups in application.yml. Liveness (/actuator/health/liveness) checks if the app is alive — failures trigger pod restart. Readiness (/actuator/health/readiness) checks if the app can serve traffic — failures remove from service. Add custom HealthIndicators for downstream dependencies to readiness only.

**Q: How do you tune a Spring Boot application for throughput?**
Size the Tomcat thread pool (server.tomcat.threads.max) to match your workload. Tune HikariCP pool (maximumPoolSize slightly above thread count for DB-bound apps). Enable response compression. Use virtual threads (Java 21) for I/O-bound workloads. Profile with async-profiler to find bottlenecks before tuning blindly.

**Q: What is the benefit of GraalVM native images for Spring Boot?**
Near-instant startup (milliseconds vs seconds) and lower memory footprint — ideal for serverless and scale-to-zero scenarios. Trade-offs: longer build times, limited reflection/dynamic proxy support (requires hint configuration), and no runtime class loading. Spring Boot 3 provides first-class AOT processing to generate native hints automatically.

**Q: How do you implement distributed tracing in Spring Boot?**
Spring Boot 3 uses Micrometer Tracing (replacing Spring Cloud Sleuth). Add micrometer-tracing-bridge-otel for OpenTelemetry integration. Trace IDs propagate automatically through RestTemplate, WebClient, @Async, and messaging. Export spans to Zipkin, Jaeger, or any OTLP-compatible backend.

### Deep Dive Pages

- [Actuator](actuator.md)
- [Observability](observability.md)
- [Caching](caching.md)
- [Docker & Kubernetes](docker-kubernetes.md)
- [Production Tuning](production-tuning.md)
- [GraalVM Native Images](graalvm-native.md)
- [Common Pitfalls](pitfalls.md)

---

## 9. Advanced & Ecosystem

### Key Topics

These topics demonstrate breadth and architectural maturity. Reactive programming, modular monoliths, AI integration, and cloud patterns show that you think beyond CRUD applications. Not all FAANG interviews go this deep, but these differentiate strong senior candidates.

### Must-Know Questions

**Q: When should you use WebFlux over Spring MVC?**
WebFlux (Project Reactor) is for high-concurrency, I/O-bound workloads where you need to handle thousands of concurrent connections with minimal threads (streaming, real-time APIs, gateway services). It is NOT faster for CPU-bound work and adds complexity. If your app is primarily CRUD with moderate concurrency, Spring MVC (especially with virtual threads) is simpler and sufficient.

**Q: What is Spring Modulith and when would you use it?**
Spring Modulith enforces logical module boundaries within a monolith using package conventions and ArchUnit-style tests. It provides event-based inter-module communication, module documentation generation, and a path to microservices extraction. Use it when you want modular architecture without the distributed systems overhead.

**Q: How does Spring AOP work internally?**
Spring AOP uses proxy-based interception. For interfaces, it uses JDK dynamic proxies. For concrete classes, it uses CGLIB subclass proxies. Aspects are woven at runtime (not compile-time like AspectJ). Advisors contain pointcuts (where) and advice (what). Limitations: only public method invocations through the proxy are intercepted.

**Q: What design patterns does Spring use internally?**
Factory (BeanFactory), Singleton (bean scope), Proxy (AOP, @Transactional), Template Method (JdbcTemplate, RestTemplate), Observer (ApplicationEvent), Strategy (HandlerMapping, ResourceLoader), Adapter (HandlerAdapter), and Composite (CompositeCacheManager). Understanding these helps you extend the framework correctly.

### Deep Dive Pages

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

## See Also

- [Java Interview Guide](../java/java-interview-guide.md)
- [System Design Interview Guide](../systemdesign/system-design-interview-guide.md)
- [Microservices Interview Guide](../microservices/microservices.md)
