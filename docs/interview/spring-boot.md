---
title: "Spring Boot Interview Questions — Top 40 with Answers (2026)"
description: "Top 40 Spring Boot interview questions with answers. Auto-configuration, IoC/DI, @Transactional propagation, AOP, Spring Security, JPA, testing — asked at FAANG, Salesforce, Amazon, and top Java shops."
---

# Top 40 Spring Boot Interview Questions & Answers

!!! tip "Interview Prep"
    These 40 questions cover the most frequently asked Spring Boot topics across all experience levels. Each answer is concise and interview-ready, with code snippets where they add clarity.

---

## Core Concepts

??? question "Q1: What is Spring Boot and why use it?"

    **Answer:** Spring Boot is an opinionated framework built on top of Spring Framework that eliminates boilerplate configuration and lets you ship production-ready applications in minutes rather than days.

    **Why it exists:** The Spring Framework is powerful but notoriously configuration-heavy. Setting up a web application required XML configs, servlet mappings, dependency version management, and external server deployment. Spring Boot solves this "configuration fatigue" by making sensible defaults the norm.

    **How it works internally:**

    - **Auto-configuration** scans the classpath and registers beans automatically (e.g., sees `HikariCP` jar, configures a `DataSource`).
    - **Embedded servers** (Tomcat/Jetty/Undertow) are packaged inside the JAR — no WAR deployment.
    - **Starter dependencies** bundle compatible library versions under a tested BOM.
    - **Actuator** provides health checks, metrics, and env inspection out of the box.

    **When to use:** Any new Spring-based project. The only reason NOT to use it is if you are maintaining a legacy Spring project that cannot upgrade.

    **Common follow-up:** "Is Spring Boot a replacement for Spring?" No — it is a layer on top that makes Spring easier to configure. All Spring concepts (DI, AOP, transactions) still apply.

    **Key gotchas:**

    - Auto-configuration can feel like "magic" — learn to use `--debug` or `/actuator/conditions` to understand what is being configured.
    - The main class must sit at the root package, otherwise `@ComponentScan` misses your beans.

??? question "Q2: What is the difference between Spring and Spring Boot?"

    **Answer:** Spring is the foundational IoC/DI framework; Spring Boot is an opinionated wrapper that removes Spring's configuration overhead while keeping all its power.

    **Why the distinction matters in interviews:** Interviewers want to know you understand that Spring Boot does not replace Spring — it automates what you would otherwise configure manually.

    | Aspect | Spring Framework | Spring Boot |
    |--------|-----------------|-------------|
    | Configuration | Requires manual XML or Java config | Auto-configuration out of the box |
    | Server | Needs external server (Tomcat, JBoss) | Embedded server included |
    | Dependencies | Manually manage compatible versions | Starters provide curated dependency sets |
    | Setup time | Significant boilerplate | Minimal — start coding immediately |
    | Production features | Build your own | Actuator, DevTools built in |
    | Opinionation | Flexible but verbose | Convention over configuration |

    **How to think about it:** Spring gives you Lego bricks. Spring Boot gives you a pre-built house you can customize.

    **When you would still use raw Spring:** Embedded library development, extremely constrained environments, or when you need fine-grained control over every bean without any auto-magic.

    **Key gotcha:** Spring Boot auto-configures only when you have not defined your own bean. If something is not wiring correctly, check if auto-configuration backed off because it detected your custom bean.

??? question "Q3: How does auto-configuration work in Spring Boot?"

    **Answer:** Auto-configuration is the mechanism that automatically registers beans based on what jars are on your classpath and what beans you have already defined — essentially, Spring Boot "guesses" what you need and configures it for you.

    **Why it exists:** Without it, you would need 50+ lines of configuration just to set up a DataSource, EntityManagerFactory, and TransactionManager. Auto-configuration does it in zero lines.

    **How it works step by step:**

    1. `@EnableAutoConfiguration` (bundled in `@SpringBootApplication`) triggers the process.
    2. Spring Boot reads `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (3.x) or `META-INF/spring.factories` (2.x) to discover ~150 configuration classes.
    3. Each class uses `@Conditional` annotations to decide whether to activate:
        - `@ConditionalOnClass` — "only if this class is on classpath"
        - `@ConditionalOnMissingBean` — "only if user hasn't defined their own"
        - `@ConditionalOnProperty` — "only if this property is set"
    4. User-defined beans **always win** — define your own `DataSource` and the auto-configured one backs off.

    **Debugging auto-configuration:**

    - Run with `--debug` flag to see the conditions evaluation report
    - Visit `/actuator/conditions` at runtime
    - Use `@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})` to disable specific auto-configs

    **Key gotcha:** Auto-configuration ordering matters. If your custom config runs too late, you might get the auto-configured bean instead. Use `@AutoConfigureBefore` / `@AutoConfigureAfter` in library code.

??? question "Q4: What does @SpringBootApplication combine?"

    **Answer:** `@SpringBootApplication` is a convenience meta-annotation that combines three annotations into one, reducing the boilerplate on your main class.

    **The three annotations:**

    ```java
    @SpringBootConfiguration   // Marks this as a configuration class (specialization of @Configuration)
    @EnableAutoConfiguration   // Enables Spring Boot auto-configuration
    @ComponentScan             // Scans the current package and sub-packages for @Component classes
    ```

    **Why this matters:** These three annotations together establish the foundation of a Spring Boot app: (1) this class is a config source, (2) auto-configure everything you can, (3) find all my beans starting from this package downward.

    **When to customize:**

    - Exclude specific auto-configs: `@SpringBootApplication(exclude = {SecurityAutoConfiguration.class})`
    - Change scan base: `@SpringBootApplication(scanBasePackages = "com.myapp")`

    **Common follow-up:** "Why must the main class be in the root package?" Because `@ComponentScan` defaults to scanning from the annotated class's package downward. If your main class is in `com.app` but services are in `com.services`, they will not be found.

    **Key gotcha:** Having multiple `@SpringBootApplication` classes causes confusion. Your app should have exactly one, placed at the root package.

??? question "Q5: What are Spring Boot starters?"

    **Answer:** Starters are curated, pre-tested sets of dependencies bundled under a single artifact that you include in your `pom.xml` or `build.gradle` — one dependency gives you everything needed for a capability.

    **Why they exist:** Before starters, setting up Spring MVC required manually adding Spring Web, Jackson, Tomcat, validation, and ensuring all versions were compatible. One mismatch meant hours of debugging `NoSuchMethodError`.

    **How they work:** Each starter pulls in a specific set of transitive dependencies managed by the Spring Boot BOM (Bill of Materials). No code — just dependency coordination.

    **Key starters:**

    - `spring-boot-starter-web` — Spring MVC, embedded Tomcat, Jackson, validation
    - `spring-boot-starter-data-jpa` — Spring Data JPA, Hibernate, HikariCP
    - `spring-boot-starter-security` — Spring Security, authentication/authorization
    - `spring-boot-starter-test` — JUnit 5, Mockito, AssertJ, Spring Test
    - `spring-boot-starter-actuator` — Health checks, metrics, monitoring

    **Naming convention:** `spring-boot-starter-*` for official starters. Third-party starters use `*-spring-boot-starter` (e.g., `mybatis-spring-boot-starter`).

    **Common follow-up:** "How do you create a custom starter?" Create a `*-spring-boot-starter` module with an auto-configuration class, a `META-INF/spring/...AutoConfiguration.imports` file, and optionally a `*-spring-boot-starter-autoconfigure` module.

    **Key gotcha:** Including a starter you do not need can trigger unwanted auto-configuration. For example, including `spring-boot-starter-data-jpa` without a DataSource configured will fail at startup.

??? question "Q6: How does the embedded server work, and can you switch it?"

    **Answer:** Spring Boot packages an embedded servlet container inside your JAR, so your application runs as a self-contained Java process with `java -jar app.jar` — no external server installation or WAR deployment required.

    **Why this matters:** It aligns with modern deployment (Docker containers, Kubernetes). One JAR = one deployable unit, version-controlled and reproducible.

    **How it works internally:**

    1. `spring-boot-starter-web` includes `spring-boot-starter-tomcat` by default.
    2. Auto-configuration creates a `TomcatServletWebServerFactory` bean.
    3. On startup, Spring Boot launches the embedded server, registers your `DispatcherServlet`, and begins accepting requests.

    **Switching servers:**

    ```xml
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
        <exclusions>
            <exclusion>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-starter-tomcat</artifactId>
            </exclusion>
        </exclusions>
    </dependency>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-undertow</artifactId>
    </dependency>
    ```

    **When to switch:** Undertow has lower memory footprint (good for reactive/microservices). Jetty offers better HTTP/2 and WebSocket support. Tomcat is the safest default.

    **Key gotcha:** If you are building a reactive app with WebFlux, Netty is the default (not a servlet container at all). Do not mix servlet and reactive stacks in the same application.

---

## Configuration & Profiles

??? question "Q7: application.properties vs application.yml — which should you use?"

    **Answer:** Both serve the same purpose — externalizing application configuration. The choice is largely team preference, but YAML has won the popularity contest in modern Spring Boot projects.

    **Why YAML is more popular:** Spring Boot configs tend to be deeply nested (`spring.datasource.hikari.maximum-pool-size`). YAML's hierarchical format eliminates prefix repetition.

    | Feature | .properties | .yml |
    |---------|------------|------|
    | Syntax | `key=value` flat pairs | Hierarchical indentation-based |
    | Readability | Verbose for nested keys | Cleaner for deep nesting |
    | Multi-doc | Not supported | Supports `---` separator for multiple profiles |
    | Lists | `server.ports[0]=8080` | Natural list syntax with `-` |
    | Gotcha | None significant | Indentation errors cause silent failures |

    **How Spring resolves them:** Both are loaded by the same `PropertySource` mechanism. If both exist, `.properties` takes precedence for the same key.

    **When to use .properties:** Simple apps, legacy teams familiar with the format, or when you want zero risk of indentation bugs.

    **Key gotcha:** YAML is whitespace-sensitive. A single tab character (instead of spaces) will silently break parsing without a clear error message. Use an IDE with YAML validation.

??? question "Q8: How do Spring Boot profiles work?"

    **Answer:** Profiles are a mechanism to segregate configuration and beans by environment, so the same codebase behaves differently in dev, staging, and production without code changes.

    **Why they exist:** You need different database URLs, logging levels, feature flags, and credentials per environment. Profiles make this first-class rather than relying on external scripts.

    **How they work:**

    - **File-based:** `application-{profile}.yml` files override the default `application.yml`. E.g., `application-prod.yml` sets production DataSource.
    - **Activation:** `spring.profiles.active=dev` via properties, JVM arg (`-Dspring.profiles.active=dev`), env variable, or programmatically.
    - **Bean-level:** `@Profile("dev")` on a bean class or method restricts it to that environment.

    **Profile groups (Spring Boot 2.4+):**

    ```yaml
    spring:
      profiles:
        group:
          prod: proddb, prodmq, prodcache
    ```

    Activating `prod` now activates all three sub-profiles.

    **When to use:** Every project with more than one environment (i.e., every real project).

    **Common follow-up:** "What is the profile precedence order?" Profile-specific files override default. If multiple profiles are active, the last one wins for conflicting keys.

    **Key gotcha:** Secrets should NOT live in profile files committed to Git. Use environment variables, Vault, or Spring Cloud Config for credentials. Profiles are for structural differences (URLs, pool sizes), not secrets.

??? question "Q9: How does @ConfigurationProperties work?"

    **Answer:** `@ConfigurationProperties` binds a group of external configuration properties to a strongly-typed Java object, giving you type safety, validation, and IDE auto-completion instead of scattered `@Value` annotations.

    **Why it exists:** Using `@Value("${app.mail.host}")` everywhere is fragile — typos are not caught until runtime, you get no auto-completion, and related properties are scattered across classes.

    **How it works:**

    ```java
    @ConfigurationProperties(prefix = "app.mail")
    @Validated
    public class MailProperties {
        @NotEmpty private String host;
        private int port = 587;
        private String username;
        // getters and setters (or use constructor binding)
    }
    ```

    ```yaml
    app:
      mail:
        host: smtp.gmail.com
        port: 465
        username: noreply@company.com
    ```

    Enable with `@EnableConfigurationProperties(MailProperties.class)` or annotate with `@Component`.

    **Constructor binding (Spring Boot 2.2+):** Makes config objects immutable — no setters needed:

    ```java
    @ConfigurationProperties(prefix = "app.mail")
    public record MailProperties(String host, int port, String username) {}
    ```

    **When to use:** Any time you have 3+ related config properties. It is the standard approach for library/starter configuration.

    **Common follow-up:** "How is this different from @Value?" `@Value` is for single properties; `@ConfigurationProperties` is for groups. `@ConfigurationProperties` supports relaxed binding (`app.mail-host` maps to `mailHost`), validation, and metadata generation for IDE support.

    **Key gotcha:** If validation fails, the application will not start — which is actually a good thing (fail fast). But make sure test profiles provide valid values.

---

## Bean Lifecycle & Dependency Injection

??? question "Q10: Describe the Spring bean lifecycle."

    **Answer:** The Spring bean lifecycle is the sequence of steps from instantiation to destruction that every Spring-managed bean goes through, with multiple extension points where you can hook in custom logic.

    **Why this matters:** Understanding the lifecycle helps you debug initialization issues, implement custom startup/shutdown logic, and understand when proxies (AOP, transactions) get applied.

    **The lifecycle sequence:**

    1. **Instantiation** — Bean created via constructor (or factory method).
    2. **Populate properties** — Dependencies injected (setter/field injection).
    3. **Aware interfaces** — `BeanNameAware`, `BeanFactoryAware`, `ApplicationContextAware` called.
    4. **BeanPostProcessor.postProcessBeforeInitialization()** — Applied to ALL beans (e.g., `@PostConstruct` handling).
    5. **Initialization** — `@PostConstruct` / `InitializingBean.afterPropertiesSet()` / custom `init-method`.
    6. **BeanPostProcessor.postProcessAfterInitialization()** — Proxies created here (AOP, `@Transactional`, `@Async`).
    7. **Bean is ready for use.**
    8. **Destruction** — `@PreDestroy` / `DisposableBean.destroy()` / custom `destroy-method` on context shutdown.

    **When to use lifecycle hooks:**

    - `@PostConstruct` — Validate configuration, warm caches, register listeners
    - `@PreDestroy` — Close connections, flush buffers, deregister from service discovery

    **Common follow-up:** "When are proxies created?" In step 6 — which is why calling a `@Transactional` method from within `@PostConstruct` might not work as expected (the proxy may not be fully wired yet).

    **Key gotcha:** Prototype-scoped beans do NOT get `@PreDestroy` called — Spring does not manage their full lifecycle after creation.

??? question "Q11: What are the bean scopes in Spring?"

    **Answer:** Bean scope determines how many instances of a bean Spring creates and how long they live. The default is singleton — one instance shared across the entire application context.

    **Why this matters:** Choosing the wrong scope causes subtle bugs like shared mutable state in singletons or unexpected garbage collection in prototypes.

    | Scope | Description | Lifecycle |
    |-------|-------------|-----------|
    | **singleton** (default) | One instance per Spring IoC container | Application lifetime |
    | **prototype** | New instance every time the bean is requested | Caller manages |
    | **request** | One instance per HTTP request (web only) | Request lifetime |
    | **session** | One instance per HTTP session (web only) | Session lifetime |
    | **application** | One instance per ServletContext | App lifetime |
    | **websocket** | One instance per WebSocket session | WebSocket lifetime |

    **When to use non-singleton:** Prototype for stateful objects (builders, command objects). Request scope for request-scoped data (current user context). Session scope for shopping carts or wizard state.

    **The classic pitfall:** Injecting a prototype bean into a singleton gives you a single instance of the prototype forever. The singleton holds one reference and never asks for a new one.

    **Solutions:**

    ```java
    @Autowired ObjectProvider<PrototypeBean> provider;
    PrototypeBean fresh = provider.getObject(); // new instance each call

    // Or use @Lookup
    @Lookup
    public abstract PrototypeBean createPrototype();
    ```

    **Key gotcha:** `@Scope("prototype")` beans do not participate in `@PreDestroy` callbacks — Spring hands them off and forgets about them.

??? question "Q12: What is the difference between @Component, @Service, @Repository, and @Controller?"

    **Answer:** All four are stereotype annotations detected by component scanning. They all register the class as a Spring bean. The difference is semantic clarity and, in one case, additional behavior.

    **Why multiple annotations exist:** Code readability and layered architecture. When you see `@Repository`, you instantly know it is a data access class. It also enables targeted AOP pointcuts.

    **The hierarchy:**

    - **@Component** — Generic Spring-managed bean. Base annotation.
    - **@Service** — Business/service layer. No extra behavior beyond semantics.
    - **@Repository** — Persistence layer. Adds **automatic exception translation** — converts JDBC/JPA/Hibernate exceptions into Spring's `DataAccessException` hierarchy. This makes your service layer database-agnostic.
    - **@Controller** — Web layer. Enables `@RequestMapping` and view resolution. `@RestController` = `@Controller` + `@ResponseBody` on every method.

    **When to use what:** Follow your architectural layers. If a class does not fit neatly into service/repo/controller, use `@Component`. For configuration, use `@Configuration`.

    **Common follow-up:** "Can you use @Component everywhere instead?" Yes, it compiles and works. But you lose the `@Repository` exception translation, your AOP pointcuts become less precise, and code reviewers will flag it.

    **Key gotcha:** `@Repository` exception translation only works if you have a `PersistenceExceptionTranslationPostProcessor` bean — which Spring Boot auto-configures. In plain Spring, you need to register it manually.

??? question "Q13: What are the types of dependency injection, and which is preferred?"

    **Answer:** Constructor injection is the preferred approach in modern Spring — it enforces immutability, makes dependencies explicit, and eliminates the possibility of partially constructed beans.

    **The three types:**

    ```java
    // 1. Constructor injection (PREFERRED)
    @Service
    public class OrderService {
        private final PaymentGateway gateway;
        private final InventoryService inventory;

        public OrderService(PaymentGateway gateway, InventoryService inventory) {
            this.gateway = gateway;
            this.inventory = inventory;
        }
    }

    // 2. Setter injection — for optional dependencies
    @Autowired(required = false)
    public void setNotificationService(NotificationService svc) { this.svc = svc; }

    // 3. Field injection — avoid in production code
    @Autowired private PaymentGateway gateway; // untestable without reflection
    ```

    **Why constructor injection wins:**

    - Fields can be `final` (immutable, thread-safe)
    - Dependencies are explicit in the constructor signature
    - The bean cannot exist in an invalid state (all deps provided at creation)
    - Easy to test — just pass mocks to the constructor, no reflection needed
    - `@Autowired` is optional when there is a single constructor (Spring 4.3+)

    **When setter injection is acceptable:** Truly optional dependencies, or breaking circular dependencies (as a workaround).

    **Key gotcha:** Field injection makes your classes tightly coupled to the Spring container. You cannot instantiate them in a plain unit test without `@InjectMocks` or reflection.

??? question "Q14: How do @Qualifier and @Primary resolve ambiguity?"

    **Answer:** When multiple beans of the same type exist in the container, Spring throws `NoUniqueBeanDefinitionException`. `@Primary` and `@Qualifier` are the two mechanisms to resolve this ambiguity.

    **Why this happens:** You have two `DataSource` beans (primary and reporting), or two implementations of a `NotificationService` interface (email and SMS).

    **How they work:**

    - **@Primary** — Marks one bean as the default choice. Used at the declaration site.
    - **@Qualifier("name")** — Explicitly selects a specific bean at the injection point.

    ```java
    @Bean @Primary
    public DataSource primaryDataSource() { ... }

    @Bean @Qualifier("reporting")
    public DataSource reportingDataSource() { ... }

    // Uses primary (default)
    @Autowired DataSource ds;

    // Uses reporting (qualifier overrides primary)
    @Autowired @Qualifier("reporting") DataSource reportingDs;
    ```

    **Precedence:** `@Qualifier` > `@Primary` > bean name matching.

    **When to use which:** Use `@Primary` when 90% of injection points want the same bean. Use `@Qualifier` when you need explicit selection at specific injection points.

    **Common follow-up:** "What about custom qualifiers?" You can create your own qualifier annotation for type-safe selection without string-based names:

    ```java
    @Qualifier @Retention(RUNTIME) @Target({FIELD, PARAMETER})
    public @interface Reporting {}
    ```

    **Key gotcha:** If you rename a `@Qualifier` string and miss one injection point, you get a runtime error. Custom qualifier annotations prevent this.

??? question "Q15: What is a circular dependency and how do you resolve it?"

    **Answer:** A circular dependency occurs when bean A depends on bean B, and bean B depends on bean A (directly or transitively), creating an unresolvable creation loop.

    **Why this is a problem:** With constructor injection, Spring cannot instantiate either bean — it needs B to create A, but needs A to create B. You get `BeanCurrentlyInCreationException`.

    **How to detect:** Spring Boot 2.6+ disables circular references by default, so you will get a clear error at startup listing the cycle.

    **Solutions (best to worst):**

    1. **Redesign** — Extract the shared logic into a third bean that both depend on. This is almost always the correct answer because a circular dependency signals a design flaw.
    2. **Use `@Lazy`** on one constructor parameter — Spring injects a proxy that resolves lazily:
        ```java
        public OrderService(@Lazy PaymentService paymentService) { ... }
        ```
    3. **Use events** — Replace direct calls with `ApplicationEventPublisher`, decoupling the two beans.
    4. **Switch one dependency to setter injection** — Allows partial construction.

    **When it is acceptable:** Rarely. In legacy code migrations, `@Lazy` is a pragmatic short-term fix.

    **Key gotcha:** `spring.main.allow-circular-references=true` re-enables the old behavior, but this is a band-aid. Every circular dependency is tech debt — the app becomes harder to reason about, test, and maintain.

---

## Transactions & AOP

??? question "Q16: How does @Transactional work under the hood?"

    **Answer:** `@Transactional` uses AOP proxies to wrap your bean in transaction management logic — the proxy begins a transaction before your method executes, and commits or rolls back afterward based on the outcome.

    **Why it exists:** Without it, you would manually call `connection.setAutoCommit(false)`, `connection.commit()`, and handle rollback in every service method. `@Transactional` declaratively handles all this.

    **How it works step by step:**

    1. Spring creates a **proxy** (CGLIB by default) around your bean at startup.
    2. When a `@Transactional` method is called externally, the proxy intercepts.
    3. The proxy obtains a connection from the pool and begins a transaction.
    4. Your method executes.
    5. On success — proxy commits. On RuntimeException — proxy rolls back.

    **Key attributes:**

    - **propagation** — `REQUIRED` (join or create), `REQUIRES_NEW` (always new, suspend current), `NESTED` (savepoint), `MANDATORY`, `SUPPORTS`, `NOT_SUPPORTED`, `NEVER`
    - **isolation** — `READ_COMMITTED` (most common), `REPEATABLE_READ`, `SERIALIZABLE`
    - **rollbackFor** — By default, only unchecked exceptions trigger rollback. Use `rollbackFor = Exception.class` to include checked exceptions.
    - **readOnly** — Hints to Hibernate to skip dirty checking and to the DB to use read replicas.
    - **timeout** — Seconds before transaction timeout.

    **The #1 interview pitfall:** Calling a `@Transactional` method from within the same class bypasses the proxy — the transaction is NOT applied. This is called "self-invocation."

    ```java
    public class OrderService {
        public void process() {
            this.save(); // NO TRANSACTION — direct call, not through proxy
        }
        @Transactional
        public void save() { ... }
    }
    ```

    **Fix:** Inject the bean into itself (self-injection), use `TransactionTemplate` programmatically, or refactor into a separate bean.

??? question "Q17: Explain Spring AOP concepts: aspect, advice, pointcut, join point."

    **Answer:** Spring AOP (Aspect-Oriented Programming) lets you extract cross-cutting concerns (logging, security, caching, transactions) into reusable modules called aspects, rather than scattering them across your business code.

    **Why it exists:** Without AOP, you would have logging/security/metrics code duplicated in every service method. AOP separates "what to do" (advice) from "where to do it" (pointcut).

    **The four core concepts:**

    - **Aspect** — A class that encapsulates a cross-cutting concern. Annotated with `@Aspect`.
    - **Join Point** — A point during execution where an aspect can plug in. In Spring AOP, this is always a **method execution** (not field access or constructor — that requires full AspectJ).
    - **Pointcut** — An expression that matches join points: `@Pointcut("execution(* com.app.service.*.*(..))")`.
    - **Advice** — The code that runs at a join point:
        - `@Before` — runs before the method
        - `@After` — runs after (regardless of outcome)
        - `@AfterReturning` — runs after successful return (access return value)
        - `@AfterThrowing` — runs after an exception (access exception)
        - `@Around` — wraps the method entirely (most powerful, controls whether method even executes)

    ```java
    @Aspect @Component
    public class PerformanceAspect {
        @Around("@annotation(Timed)")
        public Object measureTime(ProceedingJoinPoint pjp) throws Throwable {
            long start = System.nanoTime();
            Object result = pjp.proceed();
            log.info("{} took {}ms", pjp.getSignature(), (System.nanoTime() - start) / 1_000_000);
            return result;
        }
    }
    ```

    **How Spring AOP differs from AspectJ:** Spring uses **runtime proxies** (not bytecode weaving). This means it only works on **Spring-managed beans**, only on **public methods**, and only on **external calls** (not self-invocation).

    **Key gotcha:** `@Around` advice MUST call `pjp.proceed()` or the target method never executes. Forgetting this silently swallows the method call.

---

## Security

??? question "Q18: Describe the Spring Security authentication flow."

    **Answer:** Spring Security is a filter-based framework that intercepts every HTTP request before it reaches your controller, authenticating the user and authorizing access through a chain of servlet filters.

    **Why filter-based:** Filters run before Spring MVC dispatching, so unauthenticated requests never reach your business code. This is the security-in-depth principle.

    **The authentication flow (form/HTTP Basic):**

    1. Request hits the **Security Filter Chain** (a chain of `jakarta.servlet.Filter` implementations).
    2. `UsernamePasswordAuthenticationFilter` extracts credentials and creates an unauthenticated `Authentication` token.
    3. Token is passed to **AuthenticationManager** (typically `ProviderManager`).
    4. ProviderManager delegates to one or more **AuthenticationProviders**.
    5. The provider uses **UserDetailsService** to load the user and **PasswordEncoder** to verify the password.
    6. On success: a fully populated `Authentication` (with authorities) is stored in **SecurityContextHolder** (ThreadLocal by default).
    7. Subsequent requests: `SecurityContextPersistenceFilter` restores the context from the session (stateful) or re-authenticates (stateless/JWT).

    **When to customize which part:**

    - Custom user store? Implement `UserDetailsService`
    - Custom auth logic (LDAP, OAuth)? Implement `AuthenticationProvider`
    - Custom filter (JWT)? Add a `OncePerRequestFilter`

    **Common follow-up:** "What is SecurityContextHolder?" It is a ThreadLocal holder for the `Authentication` object. After authentication, any code in the request can call `SecurityContextHolder.getContext().getAuthentication()` to get the current user.

    **Key gotcha:** In async/reactive scenarios, ThreadLocal does not propagate. You need `SecurityContextHolder.setStrategyName(MODE_INHERITABLETHREADLOCAL)` or use `DelegatingSecurityContextExecutor`.

??? question "Q19: How do you implement JWT authentication with Spring Security?"

    **Answer:** JWT (JSON Web Token) authentication replaces server-side sessions with a stateless token — the server validates the token signature on each request instead of looking up a session store.

    **Why JWT:** Stateless authentication scales horizontally (no sticky sessions, no session replication). Perfect for microservices and SPAs.

    **The implementation pattern:**

    1. **Disable sessions** — `sessionManagement(sm -> sm.sessionCreationPolicy(STATELESS))`
    2. **Login endpoint** (`/auth/login`) — Verify credentials with `AuthenticationManager`, then generate a signed JWT containing subject, roles, and expiry.
    3. **JWT filter** — A `OncePerRequestFilter` placed before `UsernamePasswordAuthenticationFilter`:
        - Extract `Authorization: Bearer <token>` header
        - Validate signature and expiry
        - Parse claims into a `UsernamePasswordAuthenticationToken`
        - Set it in `SecurityContextHolder`

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

    **Best practices:**

    - Short-lived access tokens (15 min) + refresh tokens (7 days)
    - Never put sensitive data in JWT payload (it is Base64, not encrypted)
    - Use asymmetric keys (RS256) in microservices so services verify without sharing the secret
    - Store refresh tokens server-side (DB/Redis) for revocation capability

    **Key gotcha:** JWTs cannot be revoked once issued (they are self-contained). If a user's permissions change, the old token remains valid until it expires. Solutions: short TTL, token blacklist, or version-based invalidation.

---

## Exception Handling & Validation

??? question "Q20: How does global exception handling work in Spring Boot?"

    **Answer:** `@RestControllerAdvice` provides a centralized place to handle exceptions across all controllers, eliminating the need for try-catch blocks in every controller method and ensuring consistent error responses.

    **Why it exists:** Without centralized handling, every controller duplicates error-response logic, formats vary between endpoints, and stack traces leak to clients.

    **How it works:**

    ```java
    @RestControllerAdvice
    public class GlobalExceptionHandler {

        @ExceptionHandler(ResourceNotFoundException.class)
        @ResponseStatus(HttpStatus.NOT_FOUND)
        public ErrorResponse handleNotFound(ResourceNotFoundException ex) {
            return new ErrorResponse("NOT_FOUND", ex.getMessage(), Instant.now());
        }

        @ExceptionHandler(MethodArgumentNotValidException.class)
        @ResponseStatus(HttpStatus.BAD_REQUEST)
        public ErrorResponse handleValidation(MethodArgumentNotValidException ex) {
            Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(FieldError::getField, FieldError::getDefaultMessage));
            return new ErrorResponse("VALIDATION_FAILED", errors.toString(), Instant.now());
        }

        @ExceptionHandler(Exception.class)
        @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
        public ErrorResponse handleAll(Exception ex) {
            log.error("Unhandled exception", ex);
            return new ErrorResponse("INTERNAL_ERROR", "Something went wrong", Instant.now());
        }
    }
    ```

    **Mechanism:** Spring MVC's `ExceptionHandlerExceptionResolver` catches exceptions thrown from controllers, matches them to `@ExceptionHandler` methods by exception type (most specific wins), and invokes the handler.

    **When to use:** Every production Spring Boot application should have one. Scope it with `@RestControllerAdvice(basePackages = "com.app.api")` if needed.

    **Common follow-up:** "What about Spring Boot 3's Problem Details (RFC 7807)?" Spring Boot 3 adds native support — set `spring.mvc.problemdetails.enabled=true` and extend `ResponseEntityExceptionHandler` for automatic RFC 7807 responses.

    **Key gotcha:** The catch-all `Exception.class` handler should always log the full stack trace server-side but return a generic message to the client. Never leak internal details in production error responses.

??? question "Q21: How do you validate request bodies in Spring Boot?"

    **Answer:** Spring Boot integrates with Bean Validation (JSR 380 / Hibernate Validator) to declaratively validate incoming request data using annotations — invalid requests are rejected before reaching your business logic.

    **Why it exists:** Validation is a cross-cutting concern. Without declarative validation, you write manual if-else checks in every controller method, which is error-prone and verbose.

    **How it works:**

    ```java
    // 1. Define constraints on the DTO
    public class CreateUserRequest {
        @NotBlank(message = "Name is required")
        private String name;

        @Email(message = "Invalid email format")
        private String email;

        @Min(value = 18, message = "Must be at least 18")
        @Max(150)
        private int age;

        @Pattern(regexp = "^\\+?[1-9]\\d{9,14}$", message = "Invalid phone")
        private String phone;
    }

    // 2. Trigger validation in controller
    @PostMapping("/users")
    public ResponseEntity<?> create(@Valid @RequestBody CreateUserRequest req) { ... }
    ```

    **`@Valid` vs `@Validated`:**

    - **@Valid** (JSR 380) — Triggers validation, throws `MethodArgumentNotValidException`.
    - **@Validated** (Spring) — Supports **validation groups** for different rules on create vs update.

    ```java
    public interface OnCreate {}
    public interface OnUpdate {}

    @NotNull(groups = OnUpdate.class)
    private Long id;

    @PostMapping  public void create(@Validated(OnCreate.class) @RequestBody Req req) { ... }
    @PutMapping   public void update(@Validated(OnUpdate.class) @RequestBody Req req) { ... }
    ```

    **Custom validators:** Implement `ConstraintValidator<AnnotationType, FieldType>` for cross-field or business rule validation (e.g., `@UniqueEmail`).

    **Key gotcha:** `@Valid` on `@RequestParam` or `@PathVariable` does not work without `@Validated` on the controller class. Also, nested objects need `@Valid` on the field to trigger cascading validation.

---

## Spring Data JPA

??? question "Q22: What are Spring Data JPA repositories?"

    **Answer:** Spring Data JPA repositories are interfaces that provide full CRUD and query functionality without writing any implementation code — Spring generates the implementation at runtime using JDK dynamic proxies.

    **Why they exist:** Traditional DAO classes are 80% boilerplate. Every entity needs `save()`, `findById()`, `findAll()`, `delete()` — all doing the same thing with different types. Spring Data eliminates this repetition.

    **How it works:**

    1. You define an interface extending `JpaRepository<Entity, IdType>`.
    2. At startup, Spring scans for repository interfaces and generates proxy implementations.
    3. Method names are parsed into JPQL queries automatically (derived queries).

    ```java
    public interface UserRepository extends JpaRepository<User, Long> {
        List<User> findByLastNameOrderByFirstNameAsc(String lastName);
        Optional<User> findByEmail(String email);
        boolean existsByUsername(String username);
        long countByStatus(Status status);
        List<User> findByAgeBetween(int min, int max);
    }
    ```

    **Repository hierarchy:**

    - `Repository` — Marker interface
    - `CrudRepository` — Basic CRUD (`save`, `findById`, `delete`, `count`)
    - `PagingAndSortingRepository` — Adds `findAll(Pageable)` and `findAll(Sort)`
    - `JpaRepository` — Adds `flush`, `saveAndFlush`, `deleteInBatch`, `getOne`

    **When to use which:** Start with `JpaRepository` for most cases. Use `CrudRepository` when you want to restrict the available operations.

    **Key gotcha:** Derived query method names can get unwieldy (`findByDepartmentNameAndStatusAndSalaryGreaterThanOrderByHireDateDesc`). Switch to `@Query` when the method name exceeds readability limits.

??? question "Q23: @Query — JPQL vs native queries?"

    **Answer:** `@Query` lets you define custom queries on repository methods — either in JPQL (database-agnostic, operates on entities) or native SQL (database-specific, operates on tables).

    **Why you need both:** Derived query methods handle simple cases, but complex joins, subqueries, window functions, or database-specific syntax require explicit queries.

    **How to use:**

    ```java
    // JPQL — database-agnostic, uses entity/field names
    @Query("SELECT u FROM User u WHERE u.email = :email")
    Optional<User> findByEmailJpql(@Param("email") String email);

    // Native SQL — database-specific, uses table/column names
    @Query(value = "SELECT * FROM users WHERE email = :email", nativeQuery = true)
    Optional<User> findByEmailNative(@Param("email") String email);

    // Modification queries (requires @Modifying)
    @Modifying(clearAutomatically = true)
    @Query("UPDATE User u SET u.active = false WHERE u.lastLogin < :date")
    int deactivateInactiveUsers(@Param("date") LocalDate date);
    ```

    **When to use JPQL:** Default choice. Portable, validates at startup, supports entity graph navigation.

    **When to use native:** Window functions (`ROW_NUMBER()`), JSON operators (`->>`), full-text search (`@@`), CTEs, database-specific hints.

    **Common follow-up:** "What does `@Modifying` do?" It tells Spring Data this is not a SELECT — it is an INSERT/UPDATE/DELETE. Without it, Spring assumes a select query and fails. Add `clearAutomatically = true` to evict stale entities from the persistence context after the update.

    **Key gotcha:** Native queries bypass Hibernate's entity tracking. If you update via native SQL, the persistence context still has stale cached entities. Use `clearAutomatically = true` or manually call `entityManager.clear()`.

??? question "Q24: How do pagination and sorting work?"

    **Answer:** Spring Data JPA provides pagination as a first-class feature — pass a `Pageable` parameter to any repository method and get back a `Page<T>` with content, total count, and navigation metadata.

    **Why it matters:** Without pagination, querying a table with millions of rows returns everything into memory. Pagination keeps responses bounded and APIs responsive.

    **How it works:**

    ```java
    // Repository method
    Page<User> findByStatus(Status status, Pageable pageable);

    // Service usage
    Pageable pageable = PageRequest.of(0, 20, Sort.by("createdAt").descending());
    Page<User> page = userRepository.findByStatus(Status.ACTIVE, pageable);

    page.getContent();        // List<User> for this page
    page.getTotalElements();  // Total matching records
    page.getTotalPages();     // Total pages
    page.hasNext();           // Navigation
    ```

    **REST controller integration:** Spring resolves `Pageable` directly from query params:

    ```
    GET /api/users?page=0&size=20&sort=createdAt,desc
    ```

    **When to use `Slice` vs `Page`:** `Page` executes a COUNT query (expensive on large tables). `Slice` only knows if there is a "next" page — more efficient for infinite scroll UIs.

    **Common follow-up:** "What about keyset pagination?" For large datasets, offset-based pagination degrades (the DB still scans skipped rows). Keyset pagination uses a WHERE clause on the last seen ID — O(1) regardless of offset.

    **Key gotcha:** The COUNT query for `Page` can be a performance killer. Use `@Query(countQuery = "...")` to optimize it, or switch to `Slice<T>` when you do not need total count.

??? question "Q25: What is the N+1 problem and how do you solve it?"

    **Answer:** The N+1 problem is when loading N parent entities causes N additional queries to lazily fetch their associated children — turning 1 query into N+1, devastating performance at scale.

    **Why it happens:** JPA defaults `@OneToMany` to `LAZY` loading. When you iterate over parents and access their children, each access triggers a separate SELECT. Loading 100 orders with lazy items fires 1 + 100 = 101 queries.

    **How to detect:** Enable SQL logging (`spring.jpa.show-sql=true` or `logging.level.org.hibernate.SQL=DEBUG`) and watch for repeated SELECT patterns. Tools like Hibernate Statistics or P6Spy also help.

    **Solutions (from most to least common):**

    1. **JOIN FETCH (JPQL):**
        ```java
        @Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.status = :s")
        List<Order> findOrdersWithItems(@Param("s") Status s);
        ```

    2. **@EntityGraph (declarative):**
        ```java
        @EntityGraph(attributePaths = {"items", "items.product"})
        List<Order> findByStatus(Status status);
        ```

    3. **@BatchSize (Hibernate-specific):**
        ```java
        @BatchSize(size = 50)
        @OneToMany(mappedBy = "order")
        private List<OrderItem> items;
        // Loads children in batches: 1 + ceil(N/50) queries
        ```

    4. **Subselect fetch mode:**
        ```java
        @Fetch(FetchMode.SUBSELECT)  // One subquery fetches ALL children
        ```

    **When to use which:** JOIN FETCH for known use cases. @EntityGraph for flexibility across multiple repository methods. @BatchSize as a global safety net.

    **Key gotcha:** JOIN FETCH with pagination (`Pageable`) causes Hibernate to fetch ALL results in memory and paginate in Java (with a warning: "firstResult/maxResults specified with collection fetch"). Solution: use a two-query approach — first query IDs with pagination, then fetch entities with JOIN FETCH by IDs.

??? question "Q26: Lazy vs Eager loading — when to use which?"

    **Answer:** Lazy loading defers association fetching until first access; eager loading fetches immediately with the parent. The universal best practice is to default everything to LAZY and selectively fetch eagerly where needed.

    **Why LAZY is the default recommendation:**

    - You rarely need all associations for every use case
    - Eager loading creates a "snowball effect" — loading one entity pulls in its entire object graph
    - You cannot un-eager something, but you can always eagerly fetch a lazy association via JOIN FETCH

    **Defaults:**

    - `@OneToMany`, `@ManyToMany` — LAZY (collection, could be large)
    - `@ManyToOne`, `@OneToOne` — EAGER (single row, cheap... in theory)

    **Best practice:** Override the `@ManyToOne` and `@OneToOne` defaults to LAZY:

    ```java
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dept_id")
    private Department department;
    ```

    **Then eagerly fetch only when needed:**

    ```java
    @EntityGraph(attributePaths = {"department", "manager"})
    Optional<Employee> findWithDetailsById(Long id);
    ```

    **The LazyInitializationException:** Occurs when accessing a lazy association outside a Hibernate session (after the transaction/session is closed).

    **Fixes:**

    1. Ensure `@Transactional` spans the entire operation that needs the data
    2. Use DTOs — project only needed fields in the query
    3. Use `@EntityGraph` or JOIN FETCH to pre-load what you need
    4. Avoid `Open Session in View` (anti-pattern that keeps sessions open in the controller layer)

    **Key gotcha:** `@OneToOne` with LAZY only works correctly when the association is non-optional and on the side that owns the FK. Otherwise Hibernate must query to determine if the value is null, effectively making it eager.

---

## Caching

??? question "Q27: How does Spring Boot caching work?"

    **Answer:** Spring Boot's caching abstraction lets you cache method return values with annotations — the first call executes the method and stores the result; subsequent calls with the same key return the cached value without executing the method.

    **Why it exists:** Caching is a cross-cutting concern. Without abstraction, you would write Redis/Caffeine-specific code in every service method. Spring's abstraction lets you switch providers without changing business code.

    **How it works:**

    1. Add `@EnableCaching` to a configuration class.
    2. Annotate methods with cache annotations.
    3. Spring creates a proxy that checks the cache before invoking the method.

    ```java
    @Cacheable(value = "users", key = "#id")          // Cache on first call
    public User findById(Long id) { ... }

    @CachePut(value = "users", key = "#user.id")      // Always execute, update cache
    public User update(User user) { ... }

    @CacheEvict(value = "users", key = "#id")         // Remove from cache
    public void delete(Long id) { ... }

    @CacheEvict(value = "users", allEntries = true)   // Clear entire cache
    public void evictAll() { ... }
    ```

    **Cache provider auto-detection (priority order):** Caffeine > Redis > EhCache > Hazelcast > ConcurrentHashMap (fallback).

    **When to use:** Read-heavy data that changes infrequently (user profiles, product catalogs, configuration lookups). Not for rapidly changing data.

    **Common follow-up:** "How do you handle cache invalidation in distributed systems?" Use Redis or Hazelcast as the cache provider — all instances share the same cache. For event-driven invalidation, publish cache eviction events via messaging.

    **Key gotchas:**

    - Same-class method calls bypass the cache proxy (same as `@Transactional`).
    - `@Cacheable` with `null` return values — by default, null is cached. Use `unless = "#result == null"` to prevent this.
    - Cache key collisions — ensure your key strategy is unique across method signatures.

---

## Actuator & Monitoring

??? question "Q28: What does Spring Boot Actuator provide?"

    **Answer:** Actuator exposes production-ready operational endpoints for health checking, metrics collection, environment inspection, and runtime management — everything ops teams need to monitor and manage a running application.

    **Why it exists:** Production applications need observability. Without Actuator, you build custom health endpoints, metrics exporters, and log-level changers from scratch for every service.

    **Key endpoints:**

    | Endpoint | Purpose |
    |----------|---------|
    | `/actuator/health` | Application health (DB, disk, custom checks) |
    | `/actuator/info` | Build info, git commit, custom metadata |
    | `/actuator/metrics` | Micrometer metrics (JVM, HTTP, custom) |
    | `/actuator/env` | All configuration properties (sanitized) |
    | `/actuator/beans` | All registered beans and their dependencies |
    | `/actuator/loggers` | View and change log levels at runtime |
    | `/actuator/threaddump` | JVM thread dump |
    | `/actuator/prometheus` | Prometheus-format metrics export |
    | `/actuator/heapdump` | JVM heap dump (downloadable) |

    **Configuration:**

    ```yaml
    management:
      endpoints:
        web:
          exposure:
            include: health, info, metrics, prometheus
      endpoint:
        health:
          show-details: when_authorized
    ```

    **How it integrates with monitoring:** Actuator + Micrometer + Prometheus + Grafana is the standard observability stack. Actuator exposes metrics, Prometheus scrapes them, Grafana visualizes.

    **When to use:** Every production Spring Boot application. No exceptions.

    **Key gotcha:** By default only `health` and `info` are exposed over HTTP. Sensitive endpoints like `env`, `heapdump`, and `shutdown` must be secured or restricted to internal networks. Never expose all endpoints without authentication in production.

??? question "Q29: How do you create a custom health indicator?"

    **Answer:** A custom health indicator lets you add application-specific health checks (external service availability, queue depth, license expiry) to the `/actuator/health` endpoint.

    **Why you need custom indicators:** The built-in checks cover DB, disk, and Redis. But your app likely depends on Elasticsearch, a payment gateway, a third-party API, or an internal microservice — those need custom checks.

    **How to implement:**

    ```java
    @Component
    public class SearchEngineHealthIndicator implements HealthIndicator {
        private final RestClient searchClient;

        @Override
        public Health health() {
            try {
                SearchClusterInfo info = searchClient.clusterHealth();
                if ("green".equals(info.status())) {
                    return Health.up()
                        .withDetail("cluster", info.name())
                        .withDetail("nodes", info.nodeCount())
                        .build();
                }
                return Health.degraded()
                    .withDetail("status", info.status())
                    .build();
            } catch (Exception e) {
                return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
            }
        }
    }
    ```

    **How it works:** Spring auto-detects any bean implementing `HealthIndicator` and includes it in the composite health check at `/actuator/health`. The bean name minus "HealthIndicator" suffix becomes the component name (e.g., `searchEngine`).

    **When to create one:** For every critical external dependency your service cannot function without. Use health groups to separate liveness from readiness checks:

    ```yaml
    management:
      endpoint:
        health:
          group:
            readiness:
              include: db, searchEngine
            liveness:
              include: ping
    ```

    **Key gotcha:** Health checks should be fast (< 1 second) and lightweight. Do not perform heavy queries or full integration tests. Use timeouts and circuit breakers within health checks to prevent cascading failures.

---

## Async & Scheduling

??? question "Q30: How does @Async work in Spring Boot?"

    **Answer:** `@Async` makes a method execute in a separate thread from a thread pool, returning immediately to the caller — turning synchronous calls into asynchronous ones without managing threads manually.

    **Why it exists:** Some operations (email sending, report generation, notification dispatch) should not block the HTTP request thread. `@Async` offloads them without you managing `ExecutorService` directly.

    **How it works:**

    1. `@EnableAsync` on a config class activates async support.
    2. Spring creates a proxy around `@Async` methods.
    3. When called, the proxy submits the method to a `TaskExecutor` instead of executing synchronously.

    ```java
    @Async("reportExecutor")
    public CompletableFuture<Report> generateReport(Long userId) {
        Report report = heavyComputation(userId);  // runs in pool thread
        return CompletableFuture.completedFuture(report);
    }
    ```

    **Configuring the thread pool (critical):**

    ```java
    @Bean("reportExecutor")
    public TaskExecutor reportExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("report-");
        executor.setRejectedExecutionHandler(new CallerRunsPolicy());
        return executor;
    }
    ```

    **Return types:** `void` (fire-and-forget) or `CompletableFuture<T>` / `Future<T>` (caller can check result later).

    **Key gotchas:**

    - Must be called from a **different bean** — same-class calls bypass the proxy (identical to `@Transactional`).
    - The default `SimpleAsyncTaskExecutor` creates a new thread per task with **no pooling** — always define a custom `ThreadPoolTaskExecutor`.
    - Exceptions in `void` async methods are silently swallowed unless you configure an `AsyncUncaughtExceptionHandler`.
    - `SecurityContext` does not propagate to async threads by default — use `DelegatingSecurityContextAsyncTaskExecutor`.

??? question "Q31: How does scheduling work with @Scheduled?"

    **Answer:** `@Scheduled` lets you define methods that execute periodically or on a cron schedule — perfect for background maintenance tasks, polling, and batch jobs without requiring a full-blown scheduler like Quartz.

    **Why it exists:** Nearly every application has recurring tasks: cache cleanup, report generation, health checks, dead-letter reprocessing. `@Scheduled` handles these with zero infrastructure.

    **How it works:**

    ```java
    @EnableScheduling  // on a config class

    @Scheduled(fixedRate = 5000)           // Every 5 seconds regardless of execution time
    public void pollForUpdates() { ... }

    @Scheduled(fixedDelay = 10000)         // 10 seconds after PREVIOUS execution finishes
    public void processQueue() { ... }

    @Scheduled(cron = "0 0 2 * * MON-FRI") // 2 AM on weekdays
    public void nightlyCleanup() { ... }

    @Scheduled(fixedRateString = "${app.poll.interval}")  // Externalized
    public void configurablePoll() { ... }
    ```

    **Cron format:** `second minute hour day-of-month month day-of-week`

    **Critical configuration:** By default, ALL `@Scheduled` methods share a **single thread**. If one task blocks, all others are delayed.

    ```yaml
    spring:
      task:
        scheduling:
          pool:
            size: 5  # parallel scheduled tasks
    ```

    **When to use vs Quartz:** `@Scheduled` is perfect for single-instance tasks. For distributed scheduling (cluster-aware, persistent, retry), use Quartz or a distributed scheduler.

    **Common follow-up:** "How do you prevent duplicate execution in multiple instances?" Use **ShedLock** — it acquires a lock in a shared store (DB/Redis) before executing, ensuring only one instance runs the task.

    **Key gotcha:** `fixedRate` can cause task overlap if execution takes longer than the interval. Use `fixedDelay` for tasks where overlap is dangerous (e.g., processing a queue).

---

## Events

??? question "Q32: How do Spring Events work?"

    **Answer:** Spring Events provide a publish-subscribe mechanism for decoupling components within a single application — publishers emit events without knowing who handles them, and listeners react independently.

    **Why they exist:** Direct method calls between services create tight coupling. Events invert this: the order service publishes "order placed" without knowing about email, inventory, analytics, or loyalty services.

    **How it works:**

    ```java
    // 1. Define event (any POJO — no need to extend ApplicationEvent since Spring 4.2)
    public record OrderPlacedEvent(Long orderId, BigDecimal amount, String customerEmail) {}

    // 2. Publish
    @Service
    public class OrderService {
        @Autowired private ApplicationEventPublisher publisher;

        @Transactional
        public void placeOrder(Order order) {
            orderRepo.save(order);
            publisher.publishEvent(new OrderPlacedEvent(order.getId(), order.getTotal(), order.getEmail()));
        }
    }

    // 3. Listen
    @Component
    public class NotificationListener {
        @EventListener
        public void onOrderPlaced(OrderPlacedEvent event) {
            sendEmail(event.customerEmail(), event.orderId());
        }
    }

    // 4. Transactional listener — fires only AFTER the transaction commits
    @TransactionalEventListener(phase = AFTER_COMMIT)
    public void afterOrderCommitted(OrderPlacedEvent event) {
        sendToAnalytics(event);  // Only if the order actually persisted
    }
    ```

    **Synchronous by default:** The listener runs in the same thread as the publisher. Combine with `@Async` for fire-and-forget:

    ```java
    @Async @EventListener
    public void handleAsync(OrderPlacedEvent event) { ... }
    ```

    **When to use:** Decoupling side effects (notifications, audit logs, cache invalidation) from the primary business logic. For cross-service events, graduate to a message broker (Kafka, RabbitMQ).

    **Key gotcha:** `@TransactionalEventListener` with `AFTER_COMMIT` does NOT run if there is no active transaction when the event is published. Also, if the listener throws an exception, it is logged but does not affect the publisher — which can cause silent failures.

---

## Reactive Spring

??? question "Q33: What is the difference between Spring MVC and Spring WebFlux?"

    **Answer:** Spring MVC is the traditional synchronous, thread-per-request web framework; Spring WebFlux is its non-blocking, reactive counterpart designed for high-concurrency scenarios with minimal threads.

    **Why WebFlux exists:** The thread-per-request model breaks down when you have thousands of concurrent connections with high I/O latency (waiting for slow microservices, databases, external APIs). You run out of threads while they sit idle waiting for responses.

    | Aspect | Spring MVC | Spring WebFlux |
    |--------|-----------|---------------|
    | Programming model | Synchronous, blocking | Asynchronous, non-blocking |
    | Threading | Thread-per-request (200 threads = 200 concurrent) | Event loop (4 threads can handle thousands) |
    | Server | Servlet-based (Tomcat, Jetty) | Netty (default), or Servlet 3.1+ async |
    | Return types | Plain objects, ResponseEntity | `Mono<T>`, `Flux<T>` |
    | Best for | CRUD apps with blocking JDBC | High-concurrency, streaming, gateway/proxy |
    | Stack | Servlet API, blocking I/O | Reactive Streams (Project Reactor) |
    | Learning curve | Lower | Higher — requires reactive thinking |

    **When to choose WebFlux:** API gateways, real-time streaming (SSE, WebSocket), orchestrating many downstream service calls, applications with 10K+ concurrent connections.

    **When to stick with MVC:** Traditional CRUD with JDBC/JPA (blocking), team not trained in reactive, simpler debugging and stack traces.

    **Common follow-up:** "Can you mix them?" Not in the same application. You choose one stack. However, you can use `WebClient` (reactive HTTP client) in an MVC app for non-blocking outbound calls.

    **Key gotcha:** A single blocking call in a WebFlux pipeline (e.g., JDBC query, `Thread.sleep()`) blocks the event loop thread and degrades the entire application. You must use non-blocking I/O end-to-end (R2DBC for DB, reactive Redis, WebClient for HTTP).

??? question "Q34: What are Mono and Flux?"

    **Answer:** Mono and Flux are the two reactive types from **Project Reactor** — they represent asynchronous sequences of 0-to-1 and 0-to-N elements respectively, and form the foundation of Spring WebFlux's reactive programming model.

    **Why two types:** Having separate types for "at most one result" vs "multiple results" makes API contracts clearer and enables optimizations. `Mono<User>` tells you this returns one user; `Flux<User>` tells you it could be a stream.

    - **Mono&lt;T&gt;** — 0 or 1 element. Analogous to `Optional<T>` or `CompletableFuture<T>`.
    - **Flux&lt;T&gt;** — 0 to N elements. Analogous to a reactive `Stream<T>` that can be infinite.

    ```java
    @GetMapping("/users/{id}")
    public Mono<User> getUser(@PathVariable Long id) {
        return userRepository.findById(id);  // single result
    }

    @GetMapping(value = "/users/stream", produces = TEXT_EVENT_STREAM_VALUE)
    public Flux<User> streamUsers() {
        return userRepository.findAll();  // streamed to client as SSE
    }

    // Composing reactive pipelines
    public Mono<OrderSummary> createOrder(OrderRequest req) {
        return userService.findById(req.userId())
            .flatMap(user -> inventoryService.reserve(req.items()))
            .flatMap(reservation -> paymentService.charge(user, req.total()))
            .map(payment -> new OrderSummary(payment.id(), "CONFIRMED"));
    }
    ```

    **Key operators:** `map`, `flatMap`, `filter`, `zip`, `merge`, `concat`, `retry`, `onErrorResume`, `switchIfEmpty`, `timeout`, `cache`.

    **Critical principle:** Both are **lazy** — nothing happens until something subscribes. In WebFlux, the framework subscribes for you. In non-web contexts, you must call `.subscribe()` or `.block()`.

    **Key gotcha:** Never call `.block()` on a Mono/Flux in a WebFlux application — it defeats the purpose and can deadlock the event loop. `.block()` is only for bridging reactive code in traditional MVC or test code.

---

## REST API Design

??? question "Q35: What are REST API best practices in Spring Boot?"

    **Answer:** REST API design is about creating intuitive, consistent, and maintainable interfaces. Spring Boot provides the tools; you provide the discipline.

    **Core principles:**

    - **Nouns for resources** — `/api/orders`, not `/api/getOrders` or `/api/createOrder`.
    - **HTTP methods convey action** — `GET` (read), `POST` (create), `PUT` (full replace), `PATCH` (partial update), `DELETE` (remove).
    - **Correct status codes** — `201 Created` (with Location header), `204 No Content` (successful DELETE), `400 Bad Request`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`.
    - **Consistent error responses** — Standardized body with `code`, `message`, `timestamp`, `details`.
    - **Pagination** — Return metadata (`totalElements`, `page`, `size`, `totalPages`) alongside content.
    - **Use DTOs** — Never expose JPA entities directly. Entities leak internal structure, bypass lazy loading boundaries, and create coupling between DB schema and API contract.
    - **Versioning** — Plan for it from day one (URI path is simplest).
    - **HATEOAS** — Include links to related resources for discoverability (optional but RESTful).

    ```java
    @RestController
    @RequestMapping("/api/v1/orders")
    public class OrderController {
        @PostMapping
        public ResponseEntity<OrderResponse> create(@Valid @RequestBody CreateOrderRequest req) {
            OrderResponse order = orderService.create(req);
            URI location = URI.create("/api/v1/orders/" + order.id());
            return ResponseEntity.created(location).body(order);
        }
    }
    ```

    **Common follow-up:** "DTO vs Entity — why bother?" Entities expose database internals, create infinite recursion with bidirectional relationships, leak lazy-loading proxies in JSON, and make API evolution impossible without DB migration.

    **Key gotcha:** Returning `200 OK` for everything is a common anti-pattern. Clients rely on status codes for flow control (retry on 503, redirect on 301, show form errors on 422).

??? question "Q36: What are the common API versioning strategies?"

    **Answer:** API versioning ensures existing clients continue working when you make breaking changes. The strategy you choose determines how clients specify which version they want.

    **Why you need versioning:** APIs are contracts. Once a client depends on a response shape, you cannot change it without breaking them. Versioning lets you evolve while maintaining backward compatibility.

    | Strategy | Example | Pros | Cons |
    |----------|---------|------|------|
    | **URI path** | `/api/v1/users` | Simple, visible, easy to route, cache-friendly | URL pollution, hard to sunset |
    | **Query parameter** | `/api/users?version=1` | Easy to default | Easy to overlook, caching issues |
    | **Custom header** | `X-API-Version: 1` | Clean URLs | Not visible in browser, harder to test |
    | **Content negotiation** | `Accept: application/vnd.myapp.v1+json` | Most RESTful, standard | Complex client configuration |

    **URI path versioning** is the most widely used in practice (GitHub, Stripe, Google all use it) because of its simplicity and visibility.

    **Implementation in Spring Boot:**

    ```java
    @RestController
    @RequestMapping("/api/v1/users")
    public class UserControllerV1 { ... }

    @RestController
    @RequestMapping("/api/v2/users")
    public class UserControllerV2 { ... }
    ```

    **When you need a new version:** Only for breaking changes (removing fields, changing types, restructuring response). Adding new fields is backward-compatible and does not need a version bump.

    **Common follow-up:** "How do you deprecate a version?" Announce a timeline (6-12 months), add `Sunset` and `Deprecation` headers to responses, monitor usage metrics, and eventually return `410 Gone`.

    **Key gotcha:** Do not version too eagerly. Every version doubles your maintenance burden. Use additive changes (new optional fields) to avoid versioning as long as possible.

---

## Testing

??? question "Q37: What testing annotations does Spring Boot provide?"

    **Answer:** Spring Boot provides test "slices" — annotations that load only a subset of the application context relevant to the layer you are testing, making tests faster and more focused than loading the entire application.

    **Why slices matter:** A full `@SpringBootTest` loads every bean, database connection, and external integration. For testing a single controller, that is overkill and slow. Slice tests load only what you need.

    | Annotation | Scope | What it loads | Use for |
    |------------|-------|---------------|---------|
    | `@SpringBootTest` | Full integration | Entire application context | End-to-end, smoke tests |
    | `@WebMvcTest` | Controller layer | MVC infra only (no services, no DB) | Controller logic, request/response |
    | `@DataJpaTest` | Repository layer | JPA + embedded DB, no web | Query correctness, repo methods |
    | `@WebFluxTest` | Reactive controllers | WebFlux infrastructure | Reactive endpoint testing |
    | `@JsonTest` | Serialization | Jackson/Gson auto-config | JSON ser/deser edge cases |
    | `@RestClientTest` | REST clients | MockRestServiceServer | Outbound HTTP call testing |

    **Practical usage:**

    ```java
    @WebMvcTest(OrderController.class)
    class OrderControllerTest {
        @Autowired MockMvc mockMvc;
        @MockBean OrderService orderService;

        @Test
        void shouldReturn404WhenNotFound() throws Exception {
            when(orderService.findById(1L)).thenReturn(Optional.empty());
            mockMvc.perform(get("/api/orders/1"))
                .andExpect(status().isNotFound());
        }
    }
    ```

    **Testing pyramid:** Many unit tests (no Spring) > some slice tests > few full integration tests.

    **Common follow-up:** "When do you use @SpringBootTest?" For testing the wiring between layers, startup behavior, or full request-to-database flows. Use `webEnvironment = RANDOM_PORT` with `TestRestTemplate` for true HTTP tests.

    **Key gotcha:** `@DataJpaTest` uses an embedded H2 by default, which can mask database-specific behavior. Use `@AutoConfigureTestDatabase(replace = NONE)` + Testcontainers for realistic DB testing.

??? question "Q38: What is the difference between @MockBean and @Mock?"

    **Answer:** `@Mock` creates a standalone Mockito mock for pure unit tests; `@MockBean` creates a mock and registers it in the Spring application context, replacing the real bean — used in slice and integration tests.

    **Why the distinction matters:** Choosing the wrong one either slows your test unnecessarily (using Spring when you don't need it) or causes confusing failures (mock not injected into the context).

    | Aspect | @Mock (Mockito) | @MockBean (Spring Boot) |
    |--------|----------------|------------------------|
    | Context | No Spring context | Requires Spring context |
    | Speed | Milliseconds | Seconds (context startup) |
    | Replaces bean | No | Yes (in the context) |
    | Use with | `@ExtendWith(MockitoExtension.class)` | `@WebMvcTest`, `@SpringBootTest` |

    ```java
    // Unit test — fast, no Spring context
    @ExtendWith(MockitoExtension.class)
    class OrderServiceTest {
        @Mock PaymentGateway gateway;
        @Mock OrderRepository repo;
        @InjectMocks OrderService service;

        @Test
        void shouldProcessPayment() {
            when(gateway.charge(any())).thenReturn(success());
            service.placeOrder(order);
            verify(gateway).charge(order.getTotal());
        }
    }

    // Slice test — needs Spring context for MVC infrastructure
    @WebMvcTest(OrderController.class)
    class OrderControllerTest {
        @MockBean OrderService orderService;  // replaces real bean
        @Autowired MockMvc mockMvc;
    }
    ```

    **When to use which:**

    - `@Mock` — Testing business logic in isolation (service, utility classes). Preferred.
    - `@MockBean` — Testing controllers (need MockMvc), or when the test requires Spring wiring (security filters, validation, serialization).

    **Common follow-up (Spring Boot 3.4+):** `@MockitoBean` and `@MockitoSpyBean` are the new names — `@MockBean` is deprecated in favor of these to avoid confusion with the Mockito `@Mock` annotation.

    **Key gotcha:** Every unique combination of `@MockBean` declarations creates a new application context (contexts are cached by their bean definitions). Overusing `@MockBean` with different configurations defeats context caching and makes your test suite slow.

---

## Docker & Deployment

??? question "Q39: How do you containerize a Spring Boot application?"

    **Answer:** Spring Boot applications are containerized as executable JARs inside Docker images, with multi-stage builds being the standard approach for optimal image size and security.

    **Why containerize:** Consistency across environments (dev laptop = CI = production), easy horizontal scaling, infrastructure-as-code, and compatibility with orchestrators (Kubernetes, ECS).

    **Multi-stage Dockerfile (standard approach):**

    ```dockerfile
    # Build stage
    FROM eclipse-temurin:21-jdk AS build
    WORKDIR /app
    COPY . .
    RUN ./mvnw package -DskipTests

    # Runtime stage — smaller base image, no build tools
    FROM eclipse-temurin:21-jre
    WORKDIR /app
    COPY --from=build /app/target/*.jar app.jar
    EXPOSE 8080
    ENTRYPOINT ["java", "-jar", "app.jar"]
    ```

    **Layered JARs (Spring Boot 2.3+) — better caching:**

    ```dockerfile
    FROM eclipse-temurin:21-jre
    WORKDIR /app
    COPY --from=build /app/target/*.jar app.jar
    RUN java -Djarmode=layertools -jar app.jar extract
    # Dependencies change rarely — cached layers
    COPY --from=build /app/dependencies/ ./
    COPY --from=build /app/spring-boot-loader/ ./
    COPY --from=build /app/snapshot-dependencies/ ./
    COPY --from=build /app/application/ ./
    ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
    ```

    **Buildpacks (zero Dockerfile):**

    ```bash
    ./mvnw spring-boot:build-image -Dspring-boot.build-image.imageName=myapp:latest
    ```

    **Production best practices:**

    - Use non-root user in the container
    - Set JVM memory limits (`-XX:MaxRAMPercentage=75.0`)
    - Use health check: `HEALTHCHECK CMD curl -f http://localhost:8080/actuator/health`
    - Pin base image versions (not `latest`)

    **Key gotcha:** JVM inside Docker does not know the container memory limits by default (older JVMs). Use Java 17+ which respects cgroup limits automatically, or explicitly set `-XX:MaxRAMPercentage`.

---

## Spring Boot 3 & Jakarta EE

??? question "Q40: What are the key changes in Spring Boot 3?"

    **Answer:** Spring Boot 3 is the most significant major version upgrade — it raises the Java baseline to 17, migrates the entire ecosystem from `javax.*` to `jakarta.*`, and adds first-class support for native compilation and observability.

    **Why it is a big deal:** The `javax` to `jakarta` namespace change affects every import in your codebase. Combined with the Java 17 baseline, it forces a coordinated upgrade of your entire dependency stack.

    | Change | Detail | Impact |
    |--------|--------|--------|
    | **Java 17+ baseline** | Minimum Java version raised from 8/11 to 17 | Records, sealed classes, pattern matching available |
    | **Jakarta EE 9+** | `javax.*` -> `jakarta.*` package namespace | Every servlet, JPA, validation import changes |
    | **Spring Framework 6** | Underlying framework major version | New APIs, removed deprecations |
    | **Native compilation** | First-class GraalVM native image via Spring AOT | Sub-second startup, reduced memory |
    | **Observability** | Built-in Micrometer Observation API | Unified metrics + distributed tracing |
    | **HTTP interfaces** | Declarative HTTP clients (like Feign but native) | `@HttpExchange` on interfaces |
    | **Problem Details** | RFC 7807 error responses | Standardized error format |
    | **Virtual threads** | Java 21 virtual thread support (3.2+) | Thread-per-request at WebFlux scale |

    **Migration essentials:**

    1. Upgrade to Java 17+ (or 21 for virtual threads)
    2. Replace `javax.*` with `jakarta.*` — use **OpenRewrite** to automate
    3. Replace `WebSecurityConfigurerAdapter` with `SecurityFilterChain` beans
    4. Update third-party libs to Jakarta-compatible versions
    5. Test thoroughly — subtle behavior changes in security, property binding

    **Common follow-up:** "What is Spring AOT and how does it enable native images?" Spring AOT (Ahead-of-Time) processing analyzes your application at build time, pre-computes bean definitions, and generates reflection hints — eliminating the runtime classpath scanning that GraalVM cannot handle.

    **Key gotcha:** Not all libraries support native compilation. Anything relying heavily on runtime reflection (some ORMs, serialization libs) needs explicit GraalVM hints. Check compatibility before committing to native.

---

!!! info "Further Reading"
    For deeper dives into each topic, explore the dedicated pages in the **Spring & Microservices** section of this site.
