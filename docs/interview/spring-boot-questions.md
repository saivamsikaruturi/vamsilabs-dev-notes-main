---
title: "Spring Boot Interview Questions 2025 — Top 40 with Answers"
description: "Top Spring Boot interview questions and answers for 2025. Covers auto-configuration, IoC/DI, @Transactional, AOP, Spring Security, JPA, testing — asked at FAANG, Salesforce, Amazon, and top product companies."
---

# Spring Boot Interview Questions 2025

Spring Boot is the most-asked topic in Java backend interviews. This page covers the **40 most frequently asked Spring Boot interview questions** with concise, interview-ready answers — from core fundamentals to production patterns asked at FAANG and top product companies.

**What interviewers actually test:** not whether you can define terms, but whether you understand *why* Spring Boot makes certain choices and what breaks when you misuse it.

---

## Core Fundamentals

**1. What is Spring Boot and how does it differ from Spring Framework?**

Spring Framework is the core DI/IoC container plus ecosystem (MVC, Security, Data). Spring Boot adds **auto-configuration**, an **embedded server** (Tomcat/Jetty), **starter POMs**, and **opinionated defaults** — so you get a production-ready app without XML config. Spring Boot doesn't replace Spring; it bootstraps it.

**2. How does Spring Boot auto-configuration work?**

`@SpringBootApplication` includes `@EnableAutoConfiguration`, which triggers `AutoConfigurationImportSelector`. It reads `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` and conditionally loads `@Configuration` classes using `@ConditionalOnClass`, `@ConditionalOnMissingBean`, etc. Only loads what's on the classpath and not already defined by you.

→ Deep dive: [Auto Configuration](../springboot/AutoConfiguration.md)

**3. What is the difference between `@Component`, `@Service`, `@Repository`, and `@Controller`?**

All are specializations of `@Component` — Spring treats them identically for bean registration. The difference is **semantic** and **AOP-based**: `@Repository` activates persistence exception translation (wraps JPA exceptions into Spring's `DataAccessException`). `@Controller` enables MVC request mapping. `@Service` is purely semantic with no extra behavior — use it to signal business logic.

**4. Explain IoC and Dependency Injection.**

**IoC (Inversion of Control):** the container manages object lifecycle and wiring, not your code. **DI** is how IoC is delivered — Spring injects dependencies rather than you calling `new`. Three types: constructor injection (preferred — makes dependencies explicit and enables immutability), setter injection (optional dependencies), field injection (`@Autowired` on field — avoid in production code, breaks testability).

→ Deep dive: [IoC & DI](../springboot/SpringIOC.md)

**5. What is the Spring Bean lifecycle?**

Instantiation → populate properties → `BeanNameAware`/`BeanFactoryAware` callbacks → `@PostConstruct` / `InitializingBean.afterPropertiesSet()` → bean ready → `@PreDestroy` / `DisposableBean.destroy()` on shutdown. `BeanPostProcessor` hooks run before/after initialization and are used by AOP to create proxies.

→ Deep dive: [Bean Lifecycle & Scopes](../springboot/bean-lifecycle.md)

---

## Transactions & Data

**6. How does `@Transactional` work internally?**

Spring creates a **JDK dynamic proxy** (or CGLIB proxy for classes) around your bean. The proxy intercepts the method call, opens a transaction via `PlatformTransactionManager`, and commits or rolls back based on the outcome. This is why **self-invocation breaks `@Transactional`** — calling `this.method()` bypasses the proxy.

**7. What is the self-invocation problem with `@Transactional`?**

When a `@Transactional` method calls another `@Transactional` method *on the same bean* (`this.save()`), it calls the real object directly — not the proxy — so no transaction is started/propagated. Fix: inject the bean into itself via `@Autowired`, use `ApplicationContext.getBean()`, or restructure into a separate service.

**8. Explain `@Transactional` propagation types.**

| Propagation | Behaviour |
|---|---|
| `REQUIRED` (default) | Join existing tx; create new if none |
| `REQUIRES_NEW` | Always create new tx; suspend existing |
| `NESTED` | Savepoint within existing tx; partial rollback possible |
| `SUPPORTS` | Join if exists; non-transactional if not |
| `NOT_SUPPORTED` | Suspend any existing tx; run non-transactionally |
| `MANDATORY` | Must have existing tx; throws if none |
| `NEVER` | Throws if tx exists |

→ Deep dive: [Transactions](../springboot/transactions.md)

**9. What does `@Transactional(readOnly = true)` do?**

Hints the underlying JDBC driver and JPA provider to optimize for reads: Hibernate skips dirty-checking (no snapshot comparison at flush), some databases route to read replicas. It does **not** prevent writes — it's a hint, not enforcement.

**10. What is the N+1 problem and how do you fix it?**

With lazy loading, fetching 100 `Order` entities and accessing each one's `items` triggers 100 additional queries (1 + N). Fix with: `JOIN FETCH` in JPQL, `@EntityGraph`, or `@BatchSize`. Use `spring.jpa.show-sql=true` to spot it.

→ Deep dive: [N+1 Problem & JPA Internals](../springboot/n-plus-one-jpa.md)

---

## AOP & Proxies

**11. What is AOP and how does Spring implement it?**

**Aspect-Oriented Programming** separates cross-cutting concerns (logging, security, transactions) from business logic. Spring AOP uses **proxy-based weaving** at runtime — either JDK dynamic proxies (for interfaces) or CGLIB proxies (for classes). AspectJ provides full compile/load-time weaving and is more powerful but heavier.

**12. What are the key AOP terms?**

- **Aspect:** the class with cross-cutting logic (`@Aspect`)
- **Advice:** *when* to run (`@Before`, `@After`, `@Around`, `@AfterReturning`, `@AfterThrowing`)
- **Pointcut:** *which* methods to intercept (`execution(* com.example.service.*.*(..))`)
- **Join point:** a specific execution point (Spring AOP only supports method execution)
- **Weaving:** applying aspects to targets

→ Deep dive: [AOP Deep Dive](../springboot/spring-aop-deep-dive.md)

**13. When does Spring use JDK proxy vs CGLIB?**

JDK proxy: target implements at least one interface. CGLIB: target is a concrete class (or `proxyTargetClass=true`). CGLIB subclasses the target — so `final` classes and `final` methods can't be proxied. Spring Boot defaults to CGLIB for `@Configuration` classes.

---

## Configuration & Profiles

**14. What is `@ConfigurationProperties` vs `@Value`?**

`@Value("${property}")` injects a single property — simple but not type-safe and not IDE-friendly. `@ConfigurationProperties(prefix="app")` binds an entire prefix namespace to a POJO — type-safe, supports nested objects, lists, validation via `@Validated`, and shows up in IDE autocomplete with a metadata processor.

→ Deep dive: [@ConfigurationProperties](../springboot/configuration-properties.md)

**15. How do Spring profiles work?**

`@Profile("prod")` marks beans active only in that profile. `application-{profile}.properties` overrides defaults when `spring.profiles.active=prod`. Use `@ActiveProfiles` in tests. Multiple profiles can be active simultaneously. `spring.profiles.include` adds profiles without replacing the active set.

→ Deep dive: [Profiles & Configuration](../springboot/profiles.md)

---

## Web & REST

**16. What is the DispatcherServlet and what does it do?**

The **front controller** for Spring MVC. All HTTP requests go through it. It delegates to `HandlerMapping` (find the right controller), `HandlerAdapter` (invoke it), `ViewResolver` (find the view) or `HttpMessageConverter` (serialize the response body). In a REST API, `@ResponseBody` / `@RestController` short-circuits view resolution.

→ Deep dive: [MVC Request Lifecycle](../springboot/mvc-request-lifecycle.md)

**17. What is the difference between `@RestController` and `@Controller`?**

`@RestController` = `@Controller` + `@ResponseBody`. Every method return value is written directly to the HTTP response body via `HttpMessageConverter` (typically Jackson JSON). `@Controller` alone resolves to a view name (Thymeleaf/JSP template).

**18. How does Spring Boot handle exceptions globally?**

`@ControllerAdvice` + `@ExceptionHandler` creates a global handler that applies across all controllers. Use `@RestControllerAdvice` for REST APIs. Return `ResponseEntity` with appropriate HTTP status. `@ResponseStatus` on custom exception classes is simpler but less flexible.

→ Deep dive: [Exception Handling](../springboot/exceptionhandling.md)

**19. What is the difference between `Filter`, `Interceptor`, and `AOP`?**

| | Filter | Interceptor | AOP |
|---|---|---|---|
| Level | Servlet (pre-Spring) | Spring MVC | Spring bean method |
| Access to | Raw request/response | Handler + ModelAndView | Method args + return value |
| Use for | Auth, CORS, logging | Request timing, auth | Business cross-cutting concerns |
| Configured in | `FilterChain` | `WebMvcConfigurer` | `@Aspect` |

→ Deep dive: [Filters vs Interceptors vs AOP](../springboot/filters-interceptors-aop.md)

---

## Security

**20. How does Spring Security's filter chain work?**

Spring Security inserts a `DelegatingFilterProxy` into the servlet filter chain. It delegates to a `SecurityFilterChain` bean — an ordered list of security filters: `UsernamePasswordAuthenticationFilter`, `BasicAuthenticationFilter`, `JwtAuthenticationFilter` (custom), `ExceptionTranslationFilter`, `FilterSecurityInterceptor`. Filters run in a specific order; placing a custom filter at the right position is critical.

**21. What is the difference between authentication and authorization in Spring Security?**

**Authentication:** who are you? (`AuthenticationManager`, `UserDetailsService`, password encoding). **Authorization:** what can you do? (`@PreAuthorize`, `hasRole()`, method security, URL matchers). Authentication always happens before authorization.

→ Deep dive: [Spring Security](../springboot/security.md)

**22. How do you implement JWT authentication in Spring Boot?**

1. Add a `JwtAuthenticationFilter extends OncePerRequestFilter`
2. Extract and validate the JWT from the `Authorization: Bearer` header
3. Load `UserDetails` and set `UsernamePasswordAuthenticationToken` in `SecurityContextHolder`
4. Add the filter before `UsernamePasswordAuthenticationFilter` in the `SecurityFilterChain`

→ Deep dive: [Method Security & OAuth2](../springboot/method-security-oauth2.md)

---

## Testing

**23. What is the difference between `@SpringBootTest` and `@WebMvcTest`?**

`@SpringBootTest` loads the **full application context** — use for integration tests. `@WebMvcTest(MyController.class)` loads only the **web layer** (controllers, filters, `@ControllerAdvice`) — fast, slice test. Service/repository beans are not loaded; mock them with `@MockBean`.

**24. What does `@MockBean` do vs Mockito's `@Mock`?**

`@Mock` creates a Mockito mock outside Spring context. `@MockBean` creates a mock *and registers it as a Spring bean* — replaces any existing bean of that type in the context. Use `@MockBean` in Spring tests; `@Mock` in pure unit tests with `@ExtendWith(MockitoExtension.class)`.

→ Deep dive: [Testing](../springboot/testing.md) · [Slice Testing & MockMvc](../springboot/slice-testing.md)

---

## Actuator & Production

**25. What is Spring Boot Actuator and what endpoints does it expose?**

Actuator adds production-ready monitoring endpoints: `/actuator/health`, `/actuator/metrics`, `/actuator/env`, `/actuator/beans`, `/actuator/loggers`, `/actuator/threaddump`, `/actuator/httptrace`. Most are disabled by default — enable with `management.endpoints.web.exposure.include`. Secure them — never expose `/env` or `/beans` publicly.

**26. How do you configure custom health indicators?**

Implement `HealthIndicator` and return `Health.up()` / `Health.down()` with details. Spring Boot aggregates all indicators into the `/actuator/health` response. Use `@Component` to register.

→ Deep dive: [Actuator & Monitoring](../springboot/actuator.md)

---

## Advanced

**27. What is circular dependency and how do you fix it?**

Bean A depends on Bean B, which depends on Bean A — Spring throws `BeanCurrentlyInCreationException` at startup (with constructor injection). Fixes: refactor to break the cycle (preferred), use `@Lazy` on one dependency, switch one to setter injection, or extract a shared dependency.

→ Deep dive: [Circular Dependencies](../springboot/circular-dependencies.md)

**28. What is Spring Boot's embedded server and can you change it?**

Default is **Tomcat**. Switch to Jetty or Undertow by excluding `spring-boot-starter-tomcat` and adding `spring-boot-starter-jetty`. Undertow is preferred for high-concurrency reactive apps. Configure via `server.*` properties.

**29. What is `@SpringBootApplication`?**

A meta-annotation combining:
- `@SpringBootConfiguration` (specialization of `@Configuration`)
- `@EnableAutoConfiguration` (triggers auto-config)
- `@ComponentScan` (scans the package and sub-packages of the annotated class)

**30. How does Spring Boot's external configuration priority work?**

Highest to lowest: command-line args → `SPRING_APPLICATION_JSON` → OS env vars → `application-{profile}.properties` → `application.properties` → `@PropertySource` → default properties. Later entries override earlier ones in `application.properties`; the priority order is fixed.

---

## Quick-Fire Questions

**31. Difference between `@Bean` and `@Component`?**
`@Bean` is a method-level annotation in `@Configuration` classes for explicit bean creation (third-party classes, conditional setup). `@Component` is class-level for your own classes.

**32. What is `CommandLineRunner` vs `ApplicationRunner`?**
Both run code after context starts. `CommandLineRunner.run(String... args)` gets raw CLI args. `ApplicationRunner.run(ApplicationArguments args)` gets parsed args with `--key=value` support.

**33. What is Spring Boot DevTools?**
Adds auto-restart on classpath changes, live reload, and relaxed caching for dev. Automatically disabled in production.

**34. What is `@ConditionalOnProperty`?**
Creates a bean only when a specific property is set/has a specific value. Core building block of auto-configuration.

**35. How do you disable a specific auto-configuration?**
`@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})` or `spring.autoconfigure.exclude` property.

**36. What is lazy initialization in Spring Boot?**
`spring.main.lazy-initialization=true` creates beans only on first use rather than at startup. Faster startup, slower first request.

**37. What is Spring Boot's fat JAR?**
An executable JAR that bundles the app, dependencies, and an embedded server. Run with `java -jar app.jar`. The `spring-boot-maven-plugin` repackages the standard JAR into a fat JAR.

**38. What is `@Async` and what are its pitfalls?**
Runs a method in a thread pool (`@EnableAsync` required). Pitfalls: self-invocation won't work (same proxy issue as `@Transactional`); exceptions are swallowed unless you return `Future`/`CompletableFuture`; the calling thread doesn't wait.

→ Deep dive: [Async & Scheduling](../springboot/async.md)

**39. How does Spring Boot handle database migration?**
Flyway (SQL scripts in `classpath:db/migration`, named `V1__desc.sql`) or Liquibase (XML/YAML changelogs). Both run migrations on startup before the app starts serving requests. Flyway is simpler; Liquibase supports rollback.

→ Deep dive: [Database Migrations](../springboot/database-migrations.md)

**40. What is Spring Boot 3's most important change for interviews?**
Built on Spring Framework 6 + Jakarta EE 10 (all `javax.*` → `jakarta.*`). Native image support via GraalVM AOT. `HttpExchange` replaces Feign-style declarative clients. Java 17 minimum. Spring Security 6 changed the `authorizeRequests()` API to `authorizeHttpRequests()`.

→ Deep dive: [Spring Boot 3](../springboot/SpringBoot3.md)

---

## Go Deeper

- [Spring Boot Core Concepts & Interview Guide](../springboot/spring-boot-interview-guide.md) — 100+ Q&As
- [@Transactional Deep Dive](../springboot/transactions.md)
- [Spring Security Filter Chain Internals](../springboot/security-filter-chain.md)
- [AOP & Custom Annotations](../springboot/aop.md)
- [Spring Boot Testing Guide](../springboot/testing.md)
- [Production Performance Tuning](../springboot/production-tuning.md)
