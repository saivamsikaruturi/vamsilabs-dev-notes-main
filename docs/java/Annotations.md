# Annotations in Java

Annotations are **metadata** attached to code elements (classes, methods, fields, parameters). They don't change what the code does directly, but they tell the compiler, frameworks, and tools **how to process** the code.

---

## Built-in Annotations

### Compiler Annotations

| Annotation | Purpose |
|---|---|
| `@Override` | Ensures method actually overrides a parent method — compile error if not |
| `@Deprecated` | Marks element as deprecated — compiler warns when used |
| `@SuppressWarnings` | Suppress specific compiler warnings |
| `@FunctionalInterface` | Ensures interface has exactly one abstract method |
| `@SafeVarargs` | Suppresses heap pollution warnings for varargs with generics |

```java
public class Example {

    @Override
    public String toString() {  // compile error if parent doesn't have toString()
        return "Example";
    }

    @Deprecated(since = "2.0", forRemoval = true)
    public void oldMethod() {}

    @SuppressWarnings("unchecked")
    public void rawTypes() {
        List list = new ArrayList();  // no warning
    }
}
```

### Why `@Override` matters

```java
// Without @Override — silent bug
public class Dog extends Animal {
    public boolean equa1s(Object o) {  // typo: "equa1s" not "equals"
        return true;  // this is a NEW method, not an override!
    }
}

// With @Override — compile error catches the typo
public class Dog extends Animal {
    @Override
    public boolean equa1s(Object o) {  // COMPILE ERROR — no such method in parent
        return true;
    }
}
```

---

## Spring Boot Annotations (Most Asked)

| Annotation | What it does |
|---|---|
| `@SpringBootApplication` | Combines `@Configuration` + `@EnableAutoConfiguration` + `@ComponentScan` |
| `@RestController` | Makes the class a REST controller (combines `@Controller` + `@ResponseBody`) |
| `@Service` | Marks a service layer bean |
| `@Repository` | Marks a data access bean (adds exception translation) |
| `@Component` | Generic Spring-managed bean |
| `@Autowired` | Injects dependencies |
| `@Value` | Injects values from properties |
| `@Transactional` | Wraps method in a database transaction |
| `@RequestMapping` / `@GetMapping` | Maps HTTP requests to methods |

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
    }

    @PostMapping
    public User createUser(@RequestBody @Valid User user) {
        return userService.save(user);
    }
}
```

---

## Creating Custom Annotations

### Step 1: Define the annotation

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LogExecutionTime {
    String value() default "";
}
```

### Step 2: Use it

```java
@LogExecutionTime("order processing")
public void processOrder(Order order) {
    // business logic
}
```

### Step 3: Process it (using AOP or reflection)

```java
@Aspect
@Component
public class LoggingAspect {

    @Around("@annotation(logExecutionTime)")
    public Object logTime(ProceedingJoinPoint joinPoint, LogExecutionTime logExecutionTime)
            throws Throwable {
        long start = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long elapsed = System.currentTimeMillis() - start;
        log.info("{} executed in {} ms", logExecutionTime.value(), elapsed);
        return result;
    }
}
```

---

## Meta-Annotations

Annotations that go **on other annotations**.

| Meta-Annotation | Purpose | Values |
|---|---|---|
| `@Target` | Where the annotation can be used | `TYPE`, `METHOD`, `FIELD`, `PARAMETER`, `CONSTRUCTOR` |
| `@Retention` | How long the annotation survives | `SOURCE`, `CLASS`, `RUNTIME` |
| `@Documented` | Include in Javadoc | — |
| `@Inherited` | Subclasses inherit this annotation | — |
| `@Repeatable` | Can be applied multiple times | — |

### Retention Policies

```
    @Retention(SOURCE)  ──► Discarded by compiler (e.g., @Override, @SuppressWarnings)
    @Retention(CLASS)   ──► In .class file but NOT available at runtime (default)
    @Retention(RUNTIME) ──► Available at runtime via reflection (e.g., Spring annotations)
```

---

## Reading Annotations via Reflection

```java
Method method = MyClass.class.getMethod("processOrder", Order.class);

if (method.isAnnotationPresent(LogExecutionTime.class)) {
    LogExecutionTime annotation = method.getAnnotation(LogExecutionTime.class);
    System.out.println("Value: " + annotation.value());
}
```

---

## Interview Questions

??? question "1. What is the difference between `@Component`, `@Service`, `@Repository`, and `@Controller`?"
    All four are Spring stereotypes and register the class as a bean. The difference is **semantics**: `@Component` is generic, `@Service` marks business logic, `@Repository` marks data access (adds exception translation for DB errors), `@Controller` marks web controllers. They help with readability and allow targeted AOP.

??? question "2. What is the difference between `@Retention(SOURCE)`, `CLASS`, and `RUNTIME`?"
    `SOURCE` — only available in source code, discarded during compilation (used by compiler: `@Override`). `CLASS` — stored in `.class` file but not available at runtime (default, rarely useful). `RUNTIME` — available at runtime via reflection. Spring, JPA, and Jackson annotations use `RUNTIME` because they need to be read at runtime.

??? question "3. Why is `@Override` important?"
    It tells the compiler to verify the method actually overrides a parent method. Without it, a typo in the method name creates a **new method** instead of overriding — a silent bug. With `@Override`, the compiler catches it immediately.

??? question "4. Can you create an annotation with a method that returns a complex type?"
    Annotation elements can only return: primitives, `String`, `Class<?>`, enums, other annotations, or arrays of these types. They **cannot** return arbitrary objects like `List<String>` or custom classes.
