---
title: "Top 30 Design Patterns Interview Questions & Answers (2026)"
description: "Design patterns are proven, reusable solutions to common software design problems. They are not finished code but templates that describe how to solve..."
---

# Top 30 Design Patterns Interview Questions & Answers

---

## Fundamentals

??? question "Q1: What are design patterns and why should we use them?"

    Design patterns are proven, reusable solutions to common software design problems. They are not finished code but templates that describe how to solve recurring design challenges in a flexible, maintainable way.

    **Why:** Interviewers ask this to gauge whether you see patterns as a communication tool and design accelerator, or just textbook knowledge. Patterns reduce ambiguity in team discussions -- saying "use a Strategy here" instantly conveys intent without lengthy explanations.

    **How:** Patterns work at three levels: (1) they name a recurring problem, (2) they describe the core structure (participants, collaborations), and (3) they outline consequences and trade-offs. The *Gang of Four* (GoF, 1994) catalogued 23 classic patterns; since then, enterprise patterns (Fowler), concurrency patterns (Lea), and microservice patterns (Richardson) have expanded the toolkit.

    **When to use:**

    - **Proven solutions** -- avoid reinventing the wheel when the problem shape is well-known.
    - **Common vocabulary** -- teams communicate faster and code reviews are more precise.
    - **Maintainability** -- promote loose coupling and high cohesion, making change cheaper.
    - **Flexibility** -- support the Open/Closed Principle (extend without modifying).

    **Gotchas:**

    - **Over-engineering** -- applying patterns prematurely adds indirection without value (YAGNI).
    - **Pattern worship** -- not every problem maps to a GoF pattern; sometimes a simple function is enough.
    - **Cargo-culting** -- copying pattern structure without understanding the forces behind it leads to bloated code.
    - Patterns are guidelines, not rules. Refactor *toward* a pattern when code smells appear, rather than designing in patterns up-front.

??? question "Q2: How are design patterns classified?"

    The GoF patterns are classified into three categories based on their purpose: Creational (object creation), Structural (object composition), and Behavioral (object communication and responsibility assignment).

    **Why:** Interviewers test whether you can quickly identify which category a problem falls into, because that narrows the solution space from 23 patterns to roughly 5-7 candidates immediately.

    **How:**

    | Category | Purpose | Key Question Answered | Patterns |
    |---|---|---|---|
    | **Creational** | Control object creation | *How is this object made?* | Singleton, Factory Method, Abstract Factory, Builder, Prototype |
    | **Structural** | Compose objects into larger structures | *How are classes/objects assembled?* | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
    | **Behavioral** | Manage communication & responsibility | *Who does what and how do they talk?* | Chain of Responsibility, Command, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor |

    There is also a secondary classification by scope:

    - **Class patterns** use inheritance (compile-time): Factory Method, Adapter (class), Template Method, Interpreter.
    - **Object patterns** use composition (runtime): most other patterns -- more flexible and preferred in modern Java.

    **When to use:** When facing a design decision, ask: "Is my problem about creating, structuring, or coordinating objects?" This immediately filters the relevant patterns.

    **Gotchas:**

    - Some patterns blur categories (e.g., Prototype is creational but involves cloning structure).
    - Beyond GoF, modern systems use architectural patterns (MVC, CQRS, Event Sourcing) and enterprise patterns (Repository, Unit of Work) that do not fit neatly into these three buckets.
    - Do not memorize all 23 -- focus on the 8-10 most commonly used in enterprise Java (Singleton, Factory, Builder, Strategy, Observer, Decorator, Proxy, Template Method).

---

## Creational Patterns

??? question "Q3: What is the Singleton pattern? Show a thread-safe implementation."

    Singleton ensures a class has **exactly one instance** and provides a global access point to it. It is the most commonly asked pattern in interviews due to its deceptive simplicity and many subtle pitfalls.

    **Why:** Interviewers use this to test your understanding of class loading, thread safety, serialization, and reflection -- all in one question.

    **How:** The JVM class loader guarantees that static fields are initialized exactly once per classloader, which forms the basis of most thread-safe implementations.

    ```java
    // Bill Pugh (Initialization-on-Demand Holder) -- lazy, thread-safe, no synchronization overhead
    public class Singleton {
        private Singleton() {}
        private static class Holder {
            private static final Singleton INSTANCE = new Singleton();
        }
        public static Singleton getInstance() { return Holder.INSTANCE; }
    }
    ```

    | Approach | Lazy? | Thread-safe? | Notes |
    |---|---|---|---|
    | Eager (`static final`) | No | Yes | Simplest; wastes memory if never used |
    | Synchronized method | Yes | Yes | Slow -- lock on every call |
    | Double-checked locking | Yes | Yes | Requires `volatile`; verbose |
    | Bill Pugh (holder idiom) | Yes | Yes | Leverages class loading; no lock overhead |
    | **Enum singleton** | No | Yes | Best defense against reflection/serialization |

    ```java
    // Enum singleton -- recommended by Joshua Bloch (Effective Java)
    public enum Singleton {
        INSTANCE;
        public void doSomething() { /* ... */ }
    }
    ```

    **When to use:** Configuration managers, connection pools, caches, logging. In modern Spring, prefer `@Scope("singleton")` (the default) over manual Singleton implementation.

    **Gotchas:**

    - Multiple classloaders (e.g., in app servers) can create multiple instances.
    - Singleton complicates unit testing -- prefer dependency injection.
    - Bill Pugh fails if the constructor throws -- the class becomes unusable permanently (`NoClassDefFoundError`).

??? question "Q4: How can Singleton be broken via Reflection and Serialization?"

    Singleton can be broken in two primary ways: reflection (bypassing private constructors) and serialization (creating a new instance during deserialization). The enum singleton is the only implementation immune to both by default.

    **Why:** This is a favorite follow-up to Q3 -- it tests whether you understand Java's runtime mechanics beyond surface-level syntax.

    **How -- Reflection attack:**

    ```java
    Constructor<Singleton> ctor = Singleton.class.getDeclaredConstructor();
    ctor.setAccessible(true);  // bypasses private
    Singleton s2 = ctor.newInstance(); // second instance created!
    ```

    *Fix:* Guard the constructor:

    ```java
    private Singleton() {
        if (Holder.INSTANCE != null) {
            throw new IllegalStateException("Already instantiated");
        }
    }
    ```

    **How -- Serialization attack:**

    ```java
    ObjectOutputStream out = new ObjectOutputStream(new FileOutputStream("s.ser"));
    out.writeObject(Singleton.getInstance());
    ObjectInputStream in = new ObjectInputStream(new FileInputStream("s.ser"));
    Singleton s2 = (Singleton) in.readObject(); // different instance!
    ```

    *Fix:* Implement `readResolve()`:

    ```java
    protected Object readResolve() { return getInstance(); }
    ```

    **How -- Cloning attack:** If Singleton implements `Cloneable`, `clone()` creates a copy. *Fix:* Override `clone()` to throw `CloneNotSupportedException` or return the same instance.

    **Best defense:** Use an **enum Singleton**. The JVM guarantees enum constants are instantiated once; `Enum.class` prevents reflective constructor access, serialization returns the same instance, and cloning is forbidden.

    **When to use:** Always prefer enum singleton unless you need lazy initialization or inheritance.

    **Gotchas:**

    - `readResolve()` must be `protected` or `private`, not `public`, to prevent subclass override.
    - Spring-managed singletons are not immune to these attacks if someone bypasses the container.
    - In modular systems (JPMS), `setAccessible` may be blocked by module boundaries, providing some protection.

??? question "Q5: When is Singleton considered an anti-pattern?"

    Singleton becomes an anti-pattern when it introduces hidden global state, tight coupling, and testability problems. In modern applications with dependency injection frameworks, manually implementing Singleton is rarely justified.

    **Why:** Interviewers ask this to test your design maturity -- knowing *when not* to use a pattern is more valuable than knowing its structure.

    **How Singleton causes harm:**

    | Problem | Explanation |
    |---|---|
    | **Hidden dependencies** | Classes call `getInstance()` internally, making dependency graphs invisible in constructors/interfaces |
    | **Tight coupling** | Callers depend on the concrete class, not an abstraction -- violates DIP |
    | **Testing difficulty** | Cannot substitute a mock without reflection hacks; global state leaks between tests |
    | **SRP violation** | The class manages its own lifecycle *and* its business logic |
    | **Concurrency bottleneck** | Shared mutable state requires synchronization that limits throughput |
    | **Memory leaks** | Singleton lives for the application lifetime, holding references that prevent GC |

    **When Singleton is acceptable:**

    - Truly stateless utility holders (rare -- prefer static methods or DI).
    - JVM-level resources like `Runtime.getRuntime()` where only one physical resource exists.
    - Framework-managed singletons (Spring `@Scope("singleton")`) where the container owns lifecycle and testing is supported via `@MockBean`.

    **Better alternatives:**

    ```java
    // Instead of: DatabaseConnection.getInstance()
    // Use constructor injection:
    public class OrderService {
        private final DataSource dataSource;
        public OrderService(DataSource dataSource) { this.dataSource = dataSource; }
    }
    ```

    **Gotchas:**

    - Spring's "singleton" scope is per-container, not per-JVM -- different from the GoF pattern.
    - If you must use Singleton, hide it behind an interface so callers can be tested with mocks.
    - Singleton in a distributed system (multiple JVMs) does not guarantee single-instance semantics -- you need distributed locking or a coordination service.

??? question "Q6: What is the difference between Factory Method and Abstract Factory?"

    Factory Method uses inheritance to delegate instantiation of a single product to subclasses, while Abstract Factory uses composition to create families of related products without specifying concrete classes.

    **Why:** Interviewers test your ability to distinguish these two because they are frequently confused. Choosing the wrong one leads to either unnecessary class hierarchies or insufficient product consistency.

    **How:**

    | Aspect | Factory Method | Abstract Factory |
    |---|---|---|
    | Scope | Creates **one product** | Creates a **family of related products** |
    | Mechanism | Subclass overrides a creation method | Object with multiple factory methods |
    | Relationship | Inheritance-based | Composition-based |
    | Adding products | Add a new creator subclass | Modify the factory interface (breaking change) |
    | Example | `LoggerFactory.getLogger()` | `GUIFactory` producing Button + Checkbox per OS |

    ```java
    // Factory Method -- one product, subclass decides which
    abstract class Dialog {
        abstract Button createButton();
        void render() { Button b = createButton(); b.paint(); }
    }
    class WindowsDialog extends Dialog { Button createButton() { return new WindowsButton(); } }

    // Abstract Factory -- family of consistent products
    interface GUIFactory {
        Button createButton();
        Checkbox createCheckbox();
    }
    class MacFactory implements GUIFactory {
        public Button createButton() { return new MacButton(); }
        public Checkbox createCheckbox() { return new MacCheckbox(); }
    }
    ```

    **When to use:**

    - **Factory Method:** When a class cannot anticipate which type to create, or wants subclasses to specify it. Example: `java.util.Calendar.getInstance()`, Spring's `BeanFactory`.
    - **Abstract Factory:** When you must ensure product families are used together (e.g., Mac button + Mac checkbox, never mixed). Example: JDBC (`DriverManager` returns `Connection`, `Statement`, `ResultSet` from the same vendor).

    **Gotchas:**

    - Abstract Factory is hard to extend -- adding a new product type (e.g., `Slider`) requires changing every factory implementation.
    - Factory Method can lead to a parallel class hierarchy explosion if overused.
    - In Spring, `@Bean` methods in `@Configuration` classes act as factory methods without explicit inheritance.

??? question "Q7: When should you use the Builder pattern instead of a telescoping constructor?"

    Use Builder when a class has many parameters (typically 4+), several are optional, and you want readable, fluent, and immutable object construction. It separates the construction logic from the representation.

    **Why:** Interviewers ask this to see if you know how to design clean APIs. Telescoping constructors (multiple overloaded constructors) become unreadable past 3-4 parameters, and JavaBeans setters sacrifice immutability and allow partially-constructed objects.

    **How:**

    ```java
    public class User {
        private final String name;  // required
        private final int age;      // required
        private final String email; // optional
        private final String phone; // optional

        private User(Builder b) {
            this.name = b.name; this.age = b.age;
            this.email = b.email; this.phone = b.phone;
        }
        public static class Builder {
            private final String name;
            private final int age;
            private String email = "";
            private String phone = "";
            public Builder(String name, int age) { this.name = name; this.age = age; }
            public Builder email(String e) { this.email = e; return this; }
            public Builder phone(String p) { this.phone = p; return this; }
            public User build() {
                // validation here
                return new User(this);
            }
        }
    }
    // Usage: new User.Builder("Alice", 30).email("a@b.com").build();
    ```

    | Approach | Readability | Immutability | Validation |
    |---|---|---|---|
    | Telescoping constructors | Poor at 4+ params | Yes | At construction |
    | JavaBeans (setters) | Good | No | No guaranteed valid state |
    | **Builder** | Excellent (fluent) | Yes | In `build()` method |

    **When to use:**

    - Objects with many optional fields: HTTP requests, database queries, configuration objects.
    - Real-world: `StringBuilder`, `Locale.Builder`, `OkHttp.Request.Builder`, `Stream.Builder`, Lombok `@Builder`.
    - DSL-style APIs: `CriteriaQuery` in JPA, `MockMvcRequestBuilders` in Spring Test.

    **Gotchas:**

    - Builder adds boilerplate -- use Lombok `@Builder` or Java records (if all fields are required) to reduce it.
    - Do not use Builder for classes with 2-3 simple required fields -- a constructor is clearer.
    - Mutable builders should not be shared across threads without synchronization.
    - Validate invariants in `build()`, not in individual setter methods, to keep the fluent API ergonomic.

??? question "Q8: Explain the Prototype pattern. Shallow copy vs deep copy?"

    Prototype creates new objects by cloning an existing instance (the prototype) instead of calling `new`. It is useful when object creation is expensive (e.g., involves DB/network calls) or when the concrete type is unknown at compile time.

    **Why:** Interviewers ask this to probe your understanding of object identity, reference semantics, and the pitfalls of Java's `clone()` mechanism.

    **How:**

    ```java
    public class Shape implements Cloneable {
        private String type;
        private List<String> tags;

        public Shape shallowCopy() throws CloneNotSupportedException {
            return (Shape) super.clone(); // tags list reference is shared!
        }
        public Shape deepCopy() {
            Shape copy = new Shape();
            copy.type = this.type;  // String is immutable, safe to share
            copy.tags = new ArrayList<>(this.tags); // independent list
            return copy;
        }
    }
    ```

    | Aspect | Shallow Copy | Deep Copy |
    |---|---|---|
    | Behavior | Copies field values (references shared) | Recursively copies all referenced objects |
    | Performance | Fast | Slower (proportional to object graph size) |
    | Safety | Mutations to nested objects affect both copies | Fully independent objects |
    | When to use | Immutable or primitive fields only | Mutable nested objects present |

    **Prototype Registry pattern:** Maintain a `Map<String, Prototype>` of pre-configured objects. Clients clone from the registry instead of constructing from scratch.

    ```java
    class ShapeRegistry {
        private Map<String, Shape> cache = new HashMap<>();
        public void load() { cache.put("circle", new Circle(5)); cache.put("rect", new Rectangle(3,4)); }
        public Shape get(String key) { return cache.get(key).deepCopy(); }
    }
    ```

    **When to use:**

    - Expensive setup: objects loaded from DB, network, or complex computation.
    - Runtime type flexibility: when the type hierarchy is determined at runtime.
    - Real-world: `Object.clone()`, Spring bean scopes (`prototype` scope creates a clone-like new instance), `java.util.Date` (though copy constructor preferred).

    **Gotchas:**

    - Java's `Cloneable` is a broken interface (no `clone()` method on the interface itself) -- prefer copy constructors or dedicated `copy()` methods.
    - Circular references in deep copy cause infinite recursion -- use a visited-set or serialization-based cloning.
    - `super.clone()` only works correctly if the entire hierarchy calls it -- fragile with inheritance.

---

## Structural Patterns

??? question "Q9: What are the key differences between Adapter, Facade, Decorator, and Proxy?"

    These four structural patterns all "wrap" something, but differ in intent: Adapter changes the interface, Facade simplifies multiple interfaces, Decorator adds responsibilities, and Proxy controls access -- all without modifying the wrapped objects.

    **Why:** Interviewers ask this because these are the most confused patterns. Demonstrating you understand the *intent* behind each shows design maturity beyond surface-level structure.

    **How:**

    | Pattern | Interface Change? | Wraps | Intent | Key Characteristic |
    |---|---|---|---|---|
    | **Adapter** | Yes (converts) | One object | Make incompatible interfaces compatible | Changes the interface shape |
    | **Facade** | Yes (simplifies) | Many objects | Provide a simple unified API to a complex subsystem | Reduces coupling to internals |
    | **Decorator** | No (same) | One object | Add behavior dynamically without subclassing | Stackable enhancements |
    | **Proxy** | No (same) | One object | Control access (lazy load, security, caching) | Same interface, different control logic |

    **Real-world examples:**

    - **Adapter:** `Arrays.asList()` adapts an array to `List`; `InputStreamReader` adapts byte stream to char stream.
    - **Facade:** Spring `JdbcTemplate` hides Connection/Statement/ResultSet management; SLF4J facades over Log4j/Logback.
    - **Decorator:** `BufferedInputStream` decorates `FileInputStream`; Spring `BeanPostProcessor` wraps beans.
    - **Proxy:** Spring `@Transactional` creates a proxy managing TX boundaries; `java.lang.reflect.Proxy` for dynamic proxies.

    **When to use:**

    - Need to integrate a third-party library with an incompatible API? **Adapter**.
    - Want to hide complexity from calling code? **Facade**.
    - Need to layer optional behaviors (logging, caching, validation)? **Decorator**.
    - Need to control when/how an object is accessed? **Proxy**.

    **Gotchas:**

    - Decorator and Proxy look structurally identical (both wrap one object with the same interface). The difference is purely in intent: Decorator enriches, Proxy restricts/manages.
    - Facade does not prevent direct subsystem access; it just provides a convenient alternative.
    - Over-decorating creates hard-to-debug call stacks ("decorator hell").

??? question "Q10: Explain class adapter vs object adapter."

    An Adapter converts one interface into another that clients expect. A **class adapter** uses inheritance (extends the adaptee), while an **object adapter** uses composition (holds a reference to the adaptee). Java strongly favors object adapters because it lacks multiple class inheritance.

    **Why:** This tests your understanding of composition vs. inheritance trade-offs -- a fundamental OOP design decision that surfaces in many patterns.

    **How:**

    ```java
    // Object Adapter (composition -- preferred in Java)
    public class SocketAdapter implements USPlug {
        private EUPlug euPlug;  // composition
        public SocketAdapter(EUPlug euPlug) { this.euPlug = euPlug; }
        public void provideUSPower() { euPlug.provideEUPower(); }
    }

    // Class Adapter (inheritance -- possible in C++, limited in Java)
    public class SocketAdapter extends EUPlug implements USPlug {
        public void provideUSPower() { provideEUPower(); }  // inherited method
    }
    ```

    | Aspect | Class Adapter | Object Adapter |
    |---|---|---|
    | Mechanism | Inheritance (`extends`) | Composition (holds reference) |
    | Adaptee access | Can override adaptee methods | Cannot override, only delegate |
    | Flexibility | Tied to one concrete adaptee class | Can adapt any subclass of adaptee |
    | Multiple adaptation | Requires multiple inheritance (not in Java) | Works naturally with interfaces |
    | Performance | Slightly faster (no delegation hop) | Negligible overhead in practice |

    **When to use:**

    - **Object adapter (almost always):** When you need to adapt an existing class or any of its subclasses, or when the adaptee is final.
    - **Class adapter (rare in Java):** Only when you need to override specific adaptee behavior and the adaptee is not final. More common in C++ with multiple inheritance.
    - Real-world object adapters: `InputStreamReader` adapts `InputStream` to `Reader`; Spring `HandlerAdapter` adapts various handler types to `DispatcherServlet`.

    **Gotchas:**

    - Class adapter exposes the adaptee's public interface to subclasses -- potential Liskov Substitution violations.
    - Object adapter adds a level of indirection that makes stack traces slightly harder to read.
    - Two-way adapters (adapting in both directions) are complex and usually a design smell -- reconsider the interface boundaries instead.

??? question "Q11: How does the Decorator pattern work? Give a real-world Java example."

    Decorator wraps an object with the **same interface** to add behavior dynamically at runtime, without modifying the original class or using inheritance for every combination. Decorators are stackable -- each one delegates to the next, forming a chain.

    **Why:** Interviewers love this because it tests your understanding of composition over inheritance and the Open/Closed Principle. It also reveals whether you recognize it in Java's I/O library.

    **How -- Structure:**

    ```
    Component (interface) <--- ConcreteComponent
         ^
         |
    Decorator (abstract, holds Component reference)
         ^
         |
    ConcreteDecorator (adds behavior before/after delegating)
    ```

    **Java I/O Streams -- the textbook Decorator example:**

    ```java
    InputStream in = new DataInputStream(        // adds typed reads (readInt, readDouble)
        new BufferedInputStream(                  // adds buffering (performance)
            new FileInputStream("data.bin")));    // base concrete component
    ```

    **Custom example:**

    ```java
    interface Coffee { double cost(); String description(); }
    class SimpleCoffee implements Coffee {
        public double cost() { return 2.0; }
        public String description() { return "Coffee"; }
    }
    abstract class CoffeeDecorator implements Coffee {
        protected Coffee wrapped;
        CoffeeDecorator(Coffee c) { this.wrapped = c; }
    }
    class MilkDecorator extends CoffeeDecorator {
        MilkDecorator(Coffee c) { super(c); }
        public double cost() { return wrapped.cost() + 0.5; }
        public String description() { return wrapped.description() + " + Milk"; }
    }
    // new MilkDecorator(new SimpleCoffee()).cost() => 2.5
    // Stack: new MilkDecorator(new SugarDecorator(new SimpleCoffee()))
    ```

    **When to use:**

    - Adding cross-cutting concerns: logging, caching, retry, compression, encryption.
    - When subclassing would lead to a combinatorial explosion (N features = 2^N subclasses vs. N decorators).
    - Spring: `BeanPostProcessor`, servlet filters as request/response decorators, `Collections.unmodifiableList()`.

    **Gotchas:**

    - Object identity is broken: `decorated != original` even though they share an interface -- beware `equals()`/`hashCode()`.
    - Deep decorator stacks produce confusing stack traces and make debugging harder.
    - Order matters: `BufferedInputStream(GZIPInputStream(...))` differs from `GZIPInputStream(BufferedInputStream(...))`.
    - If the base interface has many methods, each decorator must delegate all of them -- use an abstract decorator base class to reduce boilerplate.

??? question "Q12: What are the types of Proxy pattern?"

    The Proxy pattern provides a surrogate or placeholder that controls access to another object. There are four main types: Virtual (lazy loading), Protection (access control), Remote (network transparency), and Caching (result memoization).

    **Why:** Proxy is one of the most practically important patterns in enterprise Java. Spring's entire AOP infrastructure, `@Transactional`, `@Cacheable`, and `@Secured` all rely on proxies. Interviewers expect you to explain the mechanics.

    **How:**

    | Type | Purpose | Example |
    |---|---|---|
    | **Virtual Proxy** | Defer expensive object creation until first use | Hibernate lazy-loaded entity proxies |
    | **Protection Proxy** | Access control based on caller identity/role | Spring Security method-level checks |
    | **Remote Proxy** | Represent an object in another JVM/network | Java RMI stubs, gRPC stubs |
    | **Caching Proxy** | Cache results of expensive operations | Spring `@Cacheable` proxy |
    | **Logging/Audit Proxy** | Intercept calls for observability | AOP-based method tracing |

    ```java
    // Virtual Proxy -- lazy initialization
    public class ImageProxy implements Image {
        private RealImage realImage;  // expensive to create
        private String filename;
        public ImageProxy(String f) { this.filename = f; }
        public void display() {
            if (realImage == null) {
                realImage = new RealImage(filename); // loaded only on first call
            }
            realImage.display();
        }
    }
    ```

    **Spring Proxy Mechanisms:**

    | Mechanism | When Used | Limitation |
    |---|---|---|
    | **JDK Dynamic Proxy** | Target implements an interface | Cannot proxy concrete classes |
    | **CGLIB Proxy** | No interface; subclasses the target | Cannot proxy `final` classes/methods |

    **When to use:**

    - Lazy initialization of heavy resources (DB connections, file handles, remote services).
    - Cross-cutting concerns without polluting business logic (transactions, security, caching, logging).
    - Smart references: reference counting, thread-safety wrappers (`Collections.synchronizedList()`).

    **Gotchas:**

    - **Self-invocation trap in Spring:** Calling `this.method()` bypasses the proxy -- AOP aspects will not fire. Fix: inject self-reference or use `AopContext.currentProxy()`.
    - CGLIB proxies fail on `final` methods silently (the method runs unproxied).
    - Proxy adds latency (negligible but measurable in tight loops) and complicates debugging (stack traces include proxy frames).
    - `equals()`/`hashCode()` on proxied objects can behave unexpectedly -- the proxy is not the same object as the target.

??? question "Q13: How does the Facade pattern simplify complex subsystems?"

    Facade provides a unified, higher-level interface to a set of interfaces in a subsystem. It does not add new functionality -- it orchestrates existing subsystem components into a convenient API that reduces the learning curve for clients.

    **Why:** Interviewers ask this to check whether you understand layered architecture and API design. Facade is the pattern behind most "service" classes and SDK wrappers in enterprise code.

    **How:**

    ```java
    // Complex subsystem classes
    class CPU    { void freeze() {} void jump(long addr) {} void execute() {} }
    class Memory { void load(long pos, byte[] data) {} }
    class Disk   { byte[] read(long sector, int size) { return new byte[0]; } }

    // Facade -- simple interface hiding orchestration complexity
    class ComputerFacade {
        private CPU cpu = new CPU();
        private Memory mem = new Memory();
        private Disk disk = new Disk();

        public void startComputer() {
            cpu.freeze();
            byte[] bootSector = disk.read(0, 512);
            mem.load(0, bootSector);
            cpu.jump(0);
            cpu.execute();
        }
    }
    // Client only calls: facade.startComputer()
    ```

    **Key characteristics:**

    - Does **not** encapsulate the subsystem -- clients can still access subsystem classes directly if needed.
    - Does **not** add new behavior -- only orchestrates existing functionality.
    - Can serve as a **decoupling layer** between modules, reducing compile-time dependencies.

    **When to use:**

    - Wrapping legacy or third-party libraries with a cleaner API.
    - Providing a simple default usage path while keeping advanced APIs available.
    - Real-world: Spring `JdbcTemplate` (hides Connection/Statement/ResultSet lifecycle), `RestTemplate`, SLF4J (facade over logging frameworks), AWS SDK high-level clients.

    **Gotchas:**

    - A Facade can become a **God Object** if it accumulates too many methods -- split into multiple focused facades.
    - Facade is not a replacement for proper modular design -- it is a band-aid if the subsystem is fundamentally poorly designed.
    - Do not confuse with Adapter: Facade simplifies, Adapter converts. Facade wraps many objects; Adapter wraps one.
    - Avoid making the Facade the *only* entry point (anti-pattern: "Facade Lock-in") -- allow power users to bypass it when needed.

??? question "Q14: When should you use the Composite pattern?"

    Use Composite when you need to represent **part-whole hierarchies** (tree structures) and want clients to treat individual objects (leaves) and compositions (branches) uniformly through a common interface.

    **Why:** Interviewers test whether you can model recursive structures cleanly. Composite eliminates the need for client code to distinguish between "one item" and "a group of items," dramatically simplifying tree-processing algorithms.

    **How:**

    ```java
    // Component -- common interface
    interface FileSystemItem {
        long getSize();
        String getName();
    }

    // Leaf -- no children
    class File implements FileSystemItem {
        private String name;
        private long size;
        public long getSize() { return size; }
        public String getName() { return name; }
    }

    // Composite -- contains children (both Files and Folders)
    class Folder implements FileSystemItem {
        private String name;
        private List<FileSystemItem> children = new ArrayList<>();
        public void add(FileSystemItem item) { children.add(item); }
        public void remove(FileSystemItem item) { children.remove(item); }
        public long getSize() {
            return children.stream().mapToLong(FileSystemItem::getSize).sum();
        }
        public String getName() { return name; }
    }
    // folder.getSize() recursively sums all nested files -- client treats leaf and composite identically
    ```

    **When to use:**

    - File systems, directory trees.
    - UI component hierarchies (`java.awt.Container` holds `Component` objects).
    - Organizational charts, bill-of-materials, menu/submenu systems.
    - Expression trees (arithmetic parsers), JSON/XML DOM structures.
    - Spring: `CompositeCacheManager`, `CompositeHealthIndicator`.

    **Design variations:**

    | Approach | Transparency | Safety |
    |---|---|---|
    | `add()`/`remove()` on Component interface | High (uniform API) | Low (leaves must throw on `add()`) |
    | `add()`/`remove()` only on Composite | Low (must cast) | High (compile-time safety) |

    **Gotchas:**

    - Overly general Component interfaces force leaves to implement meaningless operations (`add()` on a file) -- use the "safe" design unless transparency is critical.
    - Cycles in the tree (a folder containing itself) cause infinite recursion -- validate or use a visited set.
    - Deep trees can cause `StackOverflowError` with recursive traversal -- consider iterative approaches for production code.
    - Composite makes it hard to restrict which component types can be children -- you lose type specificity.

??? question "Q15: Explain the Bridge pattern."

    Bridge decouples an **abstraction** from its **implementation** so both hierarchies can vary independently. It replaces inheritance-based binding with composition-based binding, preventing the "class explosion" problem when two dimensions of variation exist.

    **Why:** Interviewers ask this to test whether you can identify when inheritance creates a Cartesian product problem (M abstractions x N implementations = M*N classes) and apply composition to solve it.

    **How:**

    ```java
    // Implementation hierarchy (can vary independently)
    interface Color { String fill(); }
    class Red implements Color  { public String fill() { return "Red"; } }
    class Blue implements Color { public String fill() { return "Blue"; } }

    // Abstraction hierarchy (references implementation via composition)
    abstract class Shape {
        protected Color color;  // "bridge" to implementation
        Shape(Color c) { this.color = c; }
        abstract void draw();
    }
    class Circle extends Shape {
        private double radius;
        Circle(Color c, double r) { super(c); this.radius = r; }
        void draw() { System.out.println("Circle[" + radius + "] in " + color.fill()); }
    }
    class Square extends Shape {
        Square(Color c) { super(c); }
        void draw() { System.out.println("Square in " + color.fill()); }
    }
    // new Circle(new Red(), 5).draw() => "Circle[5.0] in Red"
    ```

    **Without Bridge:** You would need `RedCircle`, `BlueCircle`, `RedSquare`, `BlueSquare` -- 2 shapes x 2 colors = 4 classes. With Bridge: 2 + 2 = 4 classes, and adding a new color or shape costs exactly 1 class.

    | Without Bridge | With Bridge |
    |---|---|
    | M x N subclasses | M + N classes |
    | Adding a dimension requires modifying both hierarchies | Each dimension extends independently |
    | Compile-time binding | Runtime binding (can swap implementation) |

    **When to use:**

    - Platform-independent abstractions: JDBC (abstraction) over vendor drivers (implementation).
    - UI frameworks: rendering logic (OpenGL, DirectX, Vulkan) independent of shape hierarchy.
    - Persistence: domain model bridged to different storage backends (SQL, NoSQL, file).
    - Spring: `PlatformTransactionManager` is an abstraction bridging to JPA/JDBC/JTA implementations.

    **Gotchas:**

    - Bridge is one of the hardest GoF patterns to justify early -- it often emerges through refactoring when you notice two reasons for a class to change.
    - Over-applying Bridge to a single dimension of variation adds unnecessary indirection.
    - Confused with Strategy: Strategy varies *one* algorithm; Bridge varies *two* orthogonal hierarchies simultaneously.

??? question "Q16: How does the Flyweight pattern optimize memory?"

    Flyweight reduces memory consumption by sharing **intrinsic state** (invariant, context-independent data) among many objects, while **extrinsic state** (context-specific data) is passed in by the client at usage time rather than stored in the flyweight.

    **Why:** Interviewers ask this to test whether you can optimize systems with millions of fine-grained objects (text editors, game particles, map tiles). It also reveals understanding of object identity vs. equality.

    **How:**

    ```java
    // Flyweight -- stores only intrinsic (shared) state
    class CharacterGlyph {
        private final char symbol;  // intrinsic
        private final String font;  // intrinsic
        CharacterGlyph(char symbol, String font) { this.symbol = symbol; this.font = font; }
        void render(int x, int y, int size) { // x, y, size = extrinsic (passed in)
            System.out.println(symbol + " at (" + x + "," + y + ") size=" + size);
        }
    }

    // Factory ensures sharing
    class GlyphFactory {
        private Map<String, CharacterGlyph> cache = new HashMap<>();
        CharacterGlyph get(char symbol, String font) {
            String key = symbol + "-" + font;
            return cache.computeIfAbsent(key, k -> new CharacterGlyph(symbol, font));
        }
    }
    // 100,000 characters in a document, but only ~100 unique glyphs cached
    ```

    | State Type | Stored Where | Example |
    |---|---|---|
    | **Intrinsic** | In the flyweight (shared) | Character code, font family, glyph bitmap |
    | **Extrinsic** | Passed by client per use | Position (x, y), font size, color |

    **Java standard library examples:**

    - `Integer.valueOf(int)` -- caches -128 to 127, returning shared instances.
    - `String.intern()` -- returns canonical reference from the string pool.
    - `Boolean.valueOf(boolean)` -- always returns `TRUE` or `FALSE` constants.
    - `EnumSet` -- bit-vector flyweight for enum combinations.

    **When to use:**

    - Application creates a huge number of similar objects that cause memory pressure.
    - Most object state can be made extrinsic (moved outside the object).
    - Object identity (`==`) is not required -- flyweights are shared, so identity comparisons change semantics.

    **Gotchas:**

    - Flyweights must be **immutable** -- shared mutable state causes hard-to-trace concurrency bugs.
    - Trading CPU for memory: computing or passing extrinsic state has runtime cost.
    - Over-applying Flyweight to objects that are not numerous enough wastes development effort for negligible savings.
    - Thread safety of the factory's cache: use `ConcurrentHashMap` or synchronize access in concurrent environments.

---

## Behavioral Patterns

??? question "Q17: How does the Strategy pattern eliminate switch/if-else chains?"

    Strategy encapsulates a family of algorithms as interchangeable objects behind a common interface, allowing the algorithm to vary independently from the clients that use it. This replaces brittle conditional logic with polymorphic dispatch.

    **Why:** This is the most commonly used behavioral pattern in enterprise Java. Interviewers ask it to see if you understand OCP (Open/Closed Principle) -- adding new behavior without modifying existing code.

    **How:**

    ```java
    // BEFORE: fragile, violates OCP -- every new type requires modifying this method
    double discount(String type, double amount) {
        if ("REGULAR".equals(type)) return amount * 0.1;
        else if ("PREMIUM".equals(type)) return amount * 0.2;
        else if ("VIP".equals(type)) return amount * 0.3;
        // grows forever...
    }

    // AFTER: Strategy pattern -- each algorithm is a separate class
    interface DiscountStrategy { double calculate(double amount); }

    class RegularDiscount implements DiscountStrategy {
        public double calculate(double amount) { return amount * 0.1; }
    }
    class PremiumDiscount implements DiscountStrategy {
        public double calculate(double amount) { return amount * 0.2; }
    }

    class PriceCalculator {
        private DiscountStrategy strategy;
        public PriceCalculator(DiscountStrategy strategy) { this.strategy = strategy; }
        public void setStrategy(DiscountStrategy s) { this.strategy = s; }
        public double applyDiscount(double amount) { return strategy.calculate(amount); }
    }
    // Adding VIP discount = new class, ZERO changes to PriceCalculator
    ```

    With Java 8+ lambdas, lightweight strategies become even simpler:

    ```java
    PriceCalculator calc = new PriceCalculator(amount -> amount * 0.25);
    ```

    **When to use:**

    - Multiple algorithms for the same task: sorting, validation, parsing, pricing, authentication.
    - Real-world: `Comparator<T>` with `Collections.sort()`, Spring `ResourceLoader`, `HandlerMapping`, `AuthenticationProvider`, `PasswordEncoder`.
    - When behavior needs to change at runtime based on user input, configuration, or context.

    | if-else chain | Strategy |
    |---|---|
    | One class, many responsibilities | Each algorithm has its own class (SRP) |
    | Modify existing code to add cases | Add new class (OCP) |
    | Hard to unit test individual branches | Each strategy is independently testable |
    | Compile-time logic | Runtime-swappable |

    **Gotchas:**

    - Do not use Strategy for 2-3 simple cases that never change -- a simple `if-else` is more readable.
    - Clients must know which strategy to select -- use a Factory or registry to avoid pushing selection logic to callers.
    - Strategy proliferation: too many single-method strategy classes can be replaced by lambda expressions or method references in Java 8+.
    - Strategies should be stateless when possible; stateful strategies need careful lifecycle management.

??? question "Q18: What is the Observer pattern? How does it differ from Pub/Sub?"

    Observer defines a **one-to-many dependency** so that when a subject changes state, all registered observers are automatically notified and updated. It is the foundation of event-driven programming and reactive systems.

    **Why:** This pattern is ubiquitous -- from GUI event listeners to Spring events to reactive streams. Interviewers expect you to know both the classic GoF version and how it evolves into Pub/Sub in distributed systems.

    **How:**

    ```java
    // Subject (Observable)
    interface Observer { void update(String event, Object data); }

    class EventEmitter {
        private final Map<String, List<Observer>> listeners = new HashMap<>();

        void subscribe(String eventType, Observer o) {
            listeners.computeIfAbsent(eventType, k -> new ArrayList<>()).add(o);
        }
        void unsubscribe(String eventType, Observer o) {
            listeners.getOrDefault(eventType, List.of()).remove(o);
        }
        void emit(String eventType, Object data) {
            listeners.getOrDefault(eventType, List.of())
                     .forEach(o -> o.update(eventType, data));
        }
    }
    ```

    **Observer vs. Pub/Sub:**

    | Aspect | Observer (GoF) | Pub/Sub |
    |---|---|---|
    | Coupling | Subject knows observers directly | Fully decoupled via message broker/channel |
    | Communication | Typically synchronous | Typically asynchronous |
    | Scope | In-process, same JVM | Can span networks, services |
    | Filtering | Observer registers with subject | Subscribers filter by topic/channel |
    | Backpressure | None (observer must keep up) | Broker can buffer messages |
    | Examples | `java.util.Observable`, Swing listeners | Kafka, RabbitMQ, Redis Pub/Sub, Spring Cloud Stream |

    **When to use:**

    - UI event handling: button clicks, form submissions.
    - Domain events: `OrderPlacedEvent` triggers inventory, email, and analytics listeners.
    - Spring: `ApplicationEventPublisher` + `@EventListener`, `@TransactionalEventListener` for post-commit events.
    - Reactive: Project Reactor (`Flux`/`Mono`) and RxJava are advanced Observer implementations with backpressure.

    **Gotchas:**

    - **Memory leaks:** Forgetting to unsubscribe keeps observers alive (common in GUI frameworks). Use `WeakReference` or explicit lifecycle management.
    - **Ordering:** Notification order is usually undefined -- do not depend on it.
    - **Exception handling:** One failing observer can break notification to subsequent observers -- use try-catch per observer.
    - **Performance:** Synchronous notification with many observers blocks the emitter. Consider async dispatch (`@Async` + `@EventListener` in Spring) for slow handlers.
    - `java.util.Observable` is deprecated since Java 9 -- use custom implementations, `PropertyChangeListener`, or reactive libraries.

??? question "Q19: Compare Template Method and Strategy patterns."

    Template Method uses **inheritance** to let subclasses redefine specific steps of an algorithm while keeping the overall skeleton fixed. Strategy uses **composition** to let clients inject an entire interchangeable algorithm at runtime. Both eliminate code duplication and support OCP, but through different mechanisms.

    **Why:** Interviewers ask this because these two patterns solve similar problems (varying behavior) but with fundamentally different trade-offs. Choosing wrong leads to either fragile inheritance hierarchies or unnecessary indirection.

    **How:**

    ```java
    // Template Method -- fixed skeleton, subclasses override steps
    abstract class DataMiner {
        // "template method" -- final prevents subclasses from changing the structure
        final void mine() {
            openFile();
            extractData();
            parseData();
            closeFile();
        }
        abstract void openFile();      // mandatory hook
        abstract void extractData();   // mandatory hook
        void parseData() { /* default implementation -- optional hook */ }
        void closeFile() { /* common logic */ }
    }
    class CSVMiner extends DataMiner {
        void openFile() { /* CSV-specific */ }
        void extractData() { /* CSV-specific */ }
    }

    // Strategy -- entire algorithm is injected via composition
    class Sorter {
        private SortStrategy strategy;
        Sorter(SortStrategy s) { this.strategy = s; }
        void sort(int[] data) { strategy.sort(data); }
        void setStrategy(SortStrategy s) { this.strategy = s; } // runtime swap
    }
    ```

    | Aspect | Template Method | Strategy |
    |---|---|---|
    | Mechanism | Inheritance (override hooks) | Composition (inject object) |
    | Granularity | Varies individual **steps** | Varies the **entire algorithm** |
    | Binding time | Compile time (subclass chosen) | Runtime (swappable) |
    | Code reuse | Shared in abstract class | Shared via default interface methods |
    | Flexibility | Fixed algorithm structure | Algorithm entirely replaceable |
    | Testability | Harder (must subclass to test) | Easier (mock the strategy) |
    | Class count | One subclass per variant | One strategy class per variant |

    **When to use:**

    - **Template Method:** When the algorithm structure is invariant but details vary. Examples: `AbstractList.add()`, `HttpServlet.doGet()/doPost()`, Spring `JdbcTemplate` (internally), JUnit lifecycle hooks (`@BeforeEach`).
    - **Strategy:** When multiple algorithms exist and you need runtime selection. Examples: `Comparator`, `PasswordEncoder`, Spring `HandlerMapping`.

    **Gotchas:**

    - Template Method creates tight coupling via inheritance -- deep hierarchies become fragile (Fragile Base Class problem).
    - Strategy with many single-method interfaces in Java 8+ collapses into lambdas -- simpler but less discoverable.
    - Template Method with too many hooks becomes confusing ("which hooks do I override?"). Keep hooks to 2-3 maximum.
    - Prefer Strategy when you need runtime flexibility; prefer Template Method when the algorithm skeleton truly should never change.

??? question "Q20: Explain the Command pattern. How does it support undo/redo?"

    Command encapsulates a request (action + parameters + receiver) as an object, decoupling the invoker from the executor. This reification enables undo/redo, queueing, logging, and transactional behavior -- because actions become first-class data that can be stored, replayed, and reversed.

    **Why:** Interviewers ask this because it is central to event sourcing, CQRS, task scheduling, and GUI frameworks. It tests whether you understand how turning "verbs into nouns" unlocks powerful capabilities.

    **How:**

    ```java
    interface Command {
        void execute();
        void undo();
    }

    class AddTextCommand implements Command {
        private StringBuilder doc;
        private String text;
        private int position;

        AddTextCommand(StringBuilder doc, String text) {
            this.doc = doc; this.text = text;
        }
        public void execute() {
            this.position = doc.length();
            doc.append(text);
        }
        public void undo() {
            doc.delete(position, position + text.length());
        }
    }

    class CommandHistory {
        private Deque<Command> undoStack = new ArrayDeque<>();
        private Deque<Command> redoStack = new ArrayDeque<>();

        void run(Command cmd) {
            cmd.execute();
            undoStack.push(cmd);
            redoStack.clear(); // new action invalidates redo history
        }
        void undo() {
            if (!undoStack.isEmpty()) {
                Command cmd = undoStack.pop();
                cmd.undo();
                redoStack.push(cmd);
            }
        }
        void redo() {
            if (!redoStack.isEmpty()) {
                Command cmd = redoStack.pop();
                cmd.execute();
                undoStack.push(cmd);
            }
        }
    }
    ```

    **Key participants:** Invoker (triggers command), Command (encapsulates action), Receiver (actual business object), Client (creates and configures commands).

    **When to use:**

    - **Undo/Redo:** Text editors, drawing tools, form builders.
    - **Task queues:** Thread pools execute `Runnable`/`Callable` (Command pattern).
    - **Macro recording:** Group commands for batch replay.
    - **Transactional behavior:** Execute a set of commands; rollback all on failure.
    - **Event sourcing/CQRS:** Commands as write-side events.
    - Real-world: `Runnable`, `Callable`, Spring `@Scheduled` tasks, Swing `Action`, JPA/Hibernate flush queue.

    **Gotchas:**

    - Commands that interact with external systems (DB, API) may not be perfectly reversible -- design compensating actions rather than true undo.
    - Storing full command history consumes memory -- implement periodic checkpointing or limit history depth.
    - Macro commands (composite of commands) must undo in reverse order.
    - Avoid putting business logic in the Command itself -- keep it thin and delegate to the Receiver.

??? question "Q21: How does Chain of Responsibility differ from an if-else chain?"

    Chain of Responsibility passes a request along a chain of handlers, where each handler either processes it or forwards it to the next. Unlike an if-else chain (monolithic), each handler is a separate object, making the chain composable, extensible, and configurable at runtime.

    **Why:** This is a critical pattern in web frameworks (filters, interceptors, middleware). Interviewers test whether you can design pipelines that follow OCP -- adding behavior without touching existing code.

    **How:**

    ```java
    abstract class Handler {
        private Handler next;

        Handler setNext(Handler h) { this.next = h; return h; }

        void handle(Request req) {
            if (canHandle(req)) {
                process(req);
            } else if (next != null) {
                next.handle(req);
            } else {
                throw new UnhandledRequestException(req);
            }
        }
        abstract boolean canHandle(Request req);
        abstract void process(Request req);
    }

    // Concrete handlers
    class AuthHandler extends Handler {
        boolean canHandle(Request req) { return !req.isAuthenticated(); }
        void process(Request req) { /* reject or authenticate */ }
    }
    class LoggingHandler extends Handler {
        boolean canHandle(Request req) { return true; } // always processes
        void process(Request req) { log(req); next.handle(req); } // pass-through
    }
    ```

    **Two flavors:**

    | Pure CoR (GoF) | Pipeline/Filter variant |
    |---|---|
    | Only one handler processes | Each handler processes AND forwards |
    | First match wins | All handlers contribute |
    | Exception handling, event bubbling | Servlet Filters, Spring Interceptors |

    | if-else chain | Chain of Responsibility |
    |---|---|
    | All logic in one class (God method) | Each handler is a separate class (SRP) |
    | Modify existing code to add cases | Add a new handler class (OCP) |
    | Fixed, hard-coded order | Chain order configurable at runtime |
    | Hard to test individual branches | Each handler is independently testable |
    | No reuse across contexts | Handlers reusable in different chains |

    **When to use:**

    - Request processing pipelines: Servlet `Filter` chain, Spring Security `FilterChain`, Spring MVC `HandlerInterceptor`.
    - Event handling: DOM event bubbling, logging level handlers.
    - Validation chains: each validator checks one rule, fails fast or accumulates errors.
    - Approval workflows: expense request escalates through manager -> director -> VP.

    **Gotchas:**

    - A request might fall off the end of the chain unhandled -- always have a fallback/default handler.
    - Long chains hurt performance and debuggability -- keep chain length reasonable.
    - Circular chains cause infinite loops -- validate chain structure at construction time.
    - Order matters: security filters must come before business logic handlers.

??? question "Q22: How does the State pattern differ from Strategy and from if-else?"

    State lets an object alter its behavior when its internal state changes -- the object appears to change its class. Unlike Strategy (where the client selects the algorithm), in State the transitions happen internally and automatically based on the current state's logic.

    **Why:** Interviewers ask this because State and Strategy are structurally identical (both use composition with a polymorphic interface) but differ fundamentally in intent and lifecycle. This tests your ability to distinguish patterns by purpose, not structure.

    **How:**

    ```java
    interface State {
        void handle(Context ctx);
    }

    class LockedState implements State {
        public void handle(Context ctx) {
            System.out.println("Unlocking...");
            ctx.setState(new UnlockedState()); // state transitions itself
        }
    }
    class UnlockedState implements State {
        public void handle(Context ctx) {
            System.out.println("Already unlocked. Locking...");
            ctx.setState(new LockedState()); // transitions back
        }
    }

    class Context {
        private State state = new LockedState();
        void setState(State s) { this.state = s; }
        void request() { state.handle(this); } // behavior depends on current state
    }
    // ctx.request() -> "Unlocking..."
    // ctx.request() -> "Already unlocked. Locking..."
    ```

    | Aspect | State | Strategy | if-else |
    |---|---|---|---|
    | Who controls transitions | **State objects** transition themselves | **Client** selects strategy | Central method checks conditions |
    | Awareness | States know about sibling states | Strategies are independent | All logic in one place |
    | Models | A **state machine** with defined transitions | An **algorithm family** | Procedural logic |
    | Lifecycle | State changes over time automatically | Strategy typically set once | Static |
    | OCP compliance | New state = new class | New strategy = new class | Must modify existing code |

    **When to use:**

    - Objects with well-defined states and transitions: Order (Placed -> Paid -> Shipped -> Delivered), TCP connection (Listen -> Established -> Closed), UI components (Enabled/Disabled/Loading).
    - Replacing complex `switch(currentState)` blocks that appear in multiple methods.
    - Real-world: Spring State Machine, workflow engines, game character AI states.

    **Gotchas:**

    - State explosion: too many states with complex transitions become hard to manage -- consider a state machine framework (Spring State Machine) for complex cases.
    - Circular state dependencies: states reference each other, creating tight coupling among state classes.
    - Thread safety: concurrent access to the context can cause invalid transitions -- synchronize `setState()` or use atomic references.
    - Overkill for 2-3 simple states with trivial behavior differences -- a boolean flag or enum may suffice.

??? question "Q23: What is the difference between internal and external iterators?"

    An **external iterator** gives the client explicit control over traversal (`hasNext()`/`next()`), while an **internal iterator** takes a function from the client and applies it to each element internally. External iterators offer more flexibility; internal iterators offer more simplicity and enable optimizations.

    **Why:** With Java 8's streams and functional programming becoming standard, interviewers test whether you understand the trade-offs between imperative iteration (external) and declarative iteration (internal), and when each is appropriate.

    **How:**

    ```java
    // External Iterator -- client controls traversal
    Iterator<String> it = list.iterator();
    while (it.hasNext()) {
        String s = it.next();
        if (s.startsWith("A")) break;  // client can break early
        if (s.length() > 5) it.remove(); // client can modify during traversal
    }

    // Internal Iterator -- collection controls traversal
    list.forEach(s -> System.out.println(s));           // simple action
    list.stream().filter(s -> s.length() > 3).count();  // pipeline
    ```

    | Aspect | External Iterator | Internal Iterator |
    |---|---|---|
    | Control | Client drives (`hasNext`, `next`) | Collection drives; client provides action |
    | Flexibility | Can break, skip, compare two iterators, remove | Limited (no break in `forEach`) |
    | Style | Imperative | Functional / declarative |
    | Parallelism | Hard (client manages state) | Easy (`parallelStream()`) |
    | Fail-fast | `ConcurrentModificationException` on mutation | Same, unless using `ConcurrentHashMap` |
    | Java API | `Iterator<T>`, `ListIterator<T>` | `Iterable.forEach()`, `Stream` API |

    **When to use:**

    - **External:** When you need fine-grained control -- early termination, interleaving two collections, using `ListIterator` for bidirectional traversal, or calling `remove()` during iteration.
    - **Internal:** When you want concise, readable code and can leverage parallelism. Preferred for map/filter/reduce pipelines.
    - Real-world: `java.util.Iterator` (external), `Stream.forEach()` (internal), Spring `ItemReader` (external cursor-based iteration over DB results).

    **Gotchas:**

    - `forEach` does not support `break` -- use `stream().takeWhile()` (Java 9+) or `findFirst()` instead.
    - Internal iterators hide control flow, making debugging harder (stack traces go through lambda machinery).
    - Mixing external and internal iteration (e.g., modifying a collection inside `forEach`) causes `ConcurrentModificationException`.
    - `Stream` is not reusable -- calling terminal operations twice throws `IllegalStateException`. Iterators can be obtained fresh from the collection each time.

??? question "Q24: How does the Mediator pattern reduce coupling?"

    Mediator centralizes complex communication logic so that objects (colleagues) interact through a single mediator (N-to-1) instead of directly with each other (N-to-N). This transforms a tangled web of dependencies into a star topology.

    **Why:** Interviewers ask this to test your ability to manage complexity in systems with many interacting components. Without Mediator, N objects communicating directly create N*(N-1)/2 relationships -- a maintenance nightmare.

    **How:**

    ```java
    // Mediator
    class ChatRoom {
        private List<User> users = new ArrayList<>();

        void addUser(User u) { users.add(u); u.setChatRoom(this); }

        void sendMessage(String msg, User sender) {
            users.stream()
                 .filter(u -> u != sender)
                 .forEach(u -> u.receive(sender.getName() + ": " + msg));
        }

        void sendPrivate(String msg, User sender, User recipient) {
            recipient.receive("[DM from " + sender.getName() + "]: " + msg);
        }
    }

    // Colleague -- knows only the mediator, not other colleagues
    class User {
        private String name;
        private ChatRoom mediator;

        void setChatRoom(ChatRoom room) { this.mediator = room; }
        void send(String msg) { mediator.sendMessage(msg, this); }
        void receive(String msg) { System.out.println(name + " received: " + msg); }
        String getName() { return name; }
    }
    ```

    | Without Mediator | With Mediator |
    |---|---|
    | N*(N-1)/2 direct dependencies | N dependencies (each to mediator) |
    | Adding a component requires modifying many others | Only modify the mediator |
    | Communication logic scattered | Centralized, easier to understand |
    | Hard to reuse components | Components are independent and reusable |

    **When to use:**

    - UI forms: when changing one field (country) updates others (state, zip, currency) -- a form mediator coordinates.
    - Air traffic control: planes do not talk to each other; the tower (mediator) coordinates.
    - Spring MVC: `DispatcherServlet` mediates between controllers, view resolvers, handler mappings.
    - Microservices: an orchestrator service mediates between multiple downstream services (orchestration vs. choreography).

    **Gotchas:**

    - The mediator can become a **God Object** if it accumulates too much logic -- split into multiple focused mediators.
    - Mediator introduces a single point of failure -- if it goes down, all communication stops.
    - Over-applying Mediator to simple 2-3 object interactions adds unnecessary indirection.
    - Distinguish from Observer: Observer is one-to-many notification; Mediator is many-to-many coordination through a central hub.

??? question "Q25: Explain the Memento pattern for snapshot/restore."

    Memento captures and externalizes an object's internal state so it can be restored later, without violating encapsulation. The originator creates mementos; the caretaker stores them; only the originator can read the memento's contents.

    **Why:** Interviewers ask this because it tests encapsulation understanding. The challenge is saving internal state externally (for undo/restore) while preventing other objects from tampering with that state.

    **How -- Three participants:**

    - **Originator:** The object whose state needs saving. Creates and restores from mementos.
    - **Memento:** An immutable snapshot of the originator's state. Opaque to everyone except the originator.
    - **Caretaker:** Stores mementos (history stack) but never inspects or modifies their contents.

    ```java
    // Originator
    class Editor {
        private String content;
        private int cursorPos;

        void type(String text) { content += text; cursorPos += text.length(); }

        EditorMemento save() { return new EditorMemento(content, cursorPos); }

        void restore(EditorMemento m) {
            this.content = m.content;
            this.cursorPos = m.cursorPos;
        }

        // Memento -- inner class has access to private fields (encapsulation preserved)
        static class EditorMemento {
            private final String content;
            private final int cursorPos;
            private EditorMemento(String c, int p) { this.content = c; this.cursorPos = p; }
        }
    }

    // Caretaker
    class History {
        private final Deque<Editor.EditorMemento> snapshots = new ArrayDeque<>();
        void push(Editor.EditorMemento m) { snapshots.push(m); }
        Editor.EditorMemento pop() { return snapshots.pop(); }
    }
    ```

    | Aspect | Detail |
    |---|---|
    | Encapsulation | Memento is opaque to caretaker (no getters exposed) |
    | Immutability | Memento state is `final` -- safe from modification |
    | Storage | Caretaker decides retention policy (stack, list, DB) |

    **When to use:**

    - Undo/redo systems (text editors, drawing tools).
    - Transaction rollback (save state before risky operation, restore on failure).
    - Game save/load -- checkpoint player state.
    - Database savepoints (`Connection.setSavepoint()`).
    - Real-world: `java.io.Serializable` objects as mementos, Git commits as code mementos.

    **Gotchas:**

    - **Memory consumption:** Storing full state for every change is expensive. Use incremental/delta mementos for large objects.
    - Making Memento a public class with getters defeats the purpose -- use nested classes or package-private access.
    - Deep-copy the state into the memento; otherwise, mutations to the originator's fields affect the "snapshot."
    - Caretaker must manage memento lifecycle (LRU eviction, max history size) to avoid memory leaks.
    - Often combined with Command pattern: commands execute actions, mementos store pre-execution state for undo.

??? question "Q26: What is the Visitor pattern and why is it called double dispatch?"

    Visitor lets you define new operations on a set of classes without modifying them, by externalizing the operation into a visitor object. It is called **double dispatch** because the correct method is determined by both the runtime type of the element AND the runtime type of the visitor -- two virtual method calls.

    **Why:** Interviewers ask this because it is one of the most complex GoF patterns. Understanding Visitor demonstrates mastery of polymorphism, the expression problem, and the trade-off between easy-to-add-operations vs. easy-to-add-types.

    **How -- Double dispatch explained:**

    ```java
    // Element hierarchy (stable -- rarely add new shapes)
    interface Shape { void accept(ShapeVisitor v); }

    class Circle implements Shape {
        double radius;
        Circle(double r) { this.radius = r; }
        public void accept(ShapeVisitor v) { v.visit(this); } // dispatch #1: resolves Shape -> Circle
    }
    class Rectangle implements Shape {
        double width, height;
        public void accept(ShapeVisitor v) { v.visit(this); } // dispatch #1: resolves Shape -> Rectangle
    }

    // Visitor hierarchy (grows freely -- add new operations without modifying shapes)
    interface ShapeVisitor {
        void visit(Circle c);    // dispatch #2: overload resolved by element type
        void visit(Rectangle r);
    }

    class AreaCalculator implements ShapeVisitor {
        public void visit(Circle c) { System.out.println(Math.PI * c.radius * c.radius); }
        public void visit(Rectangle r) { System.out.println(r.width * r.height); }
    }
    class JsonExporter implements ShapeVisitor {
        public void visit(Circle c) { System.out.println("{\"type\":\"circle\",\"r\":" + c.radius + "}"); }
        public void visit(Rectangle r) { System.out.println("{\"type\":\"rect\"}"); }
    }
    ```

    **Dispatch flow:** `shape.accept(visitor)` -- dispatch #1 picks the element's `accept()` method (virtual call). Inside, `visitor.visit(this)` -- dispatch #2 picks the correct overload based on `this` type. Two polymorphic calls = double dispatch.

    | Trade-off | Visitor |
    |---|---|
    | Adding new operations | Easy -- new visitor class, no changes to elements |
    | Adding new element types | Hard -- must modify ALL existing visitors |
    | Encapsulation | Elements expose internals to visitors (breaks encapsulation) |

    **When to use:**

    - Compilers/interpreters: AST nodes accept visitors for type-checking, code generation, optimization (each is a separate visitor).
    - Document processing: export to PDF, HTML, Markdown without modifying document model.
    - Real-world: `java.nio.file.FileVisitor`, `javax.lang.model.element.ElementVisitor` (annotation processing), Spring `BeanDefinitionVisitor`.

    **Gotchas:**

    - Visitor violates encapsulation -- elements must expose enough state for visitors to operate.
    - Adding a new element type is a breaking change (all visitors must add a new `visit()` method). Consider a default method on the visitor interface to mitigate.
    - Java's lack of true multiple dispatch makes Visitor verbose -- languages with pattern matching (Kotlin `when`, Java 21 sealed classes + switch) may eliminate the need.
    - Avoid Visitor when the element hierarchy changes frequently -- use Strategy or polymorphic methods on elements instead.

---

## Patterns in Frameworks

??? question "Q27: Which design patterns does Spring Framework use?"

    Spring Framework is essentially a pattern catalog brought to life -- nearly every GoF pattern appears somewhere in its architecture. Understanding these patterns helps you leverage Spring effectively and debug framework behavior.

    **Why:** Interviewers ask this to see if you understand *why* Spring works the way it does, not just how to use annotations. It reveals framework-level architectural understanding.

    **How -- Key patterns in Spring:**

    | Pattern | Where in Spring | What it Does |
    |---|---|---|
    | **Singleton** | Default bean scope | One instance per container (not per JVM) |
    | **Factory Method** | `BeanFactory`, `ApplicationContext` | Creates and manages bean instances |
    | **Abstract Factory** | `FactoryBean<T>` interface | Custom complex object creation logic |
    | **Proxy** | AOP, `@Transactional`, `@Cacheable`, `@Async` | Intercepts method calls for cross-cutting concerns |
    | **Template Method** | `JdbcTemplate`, `RestTemplate`, `TransactionTemplate` | Fixed algorithm skeleton with customizable callbacks |
    | **Observer** | `ApplicationEvent` + `@EventListener` | Decoupled event-driven communication between beans |
    | **Strategy** | `ResourceLoader`, `HandlerMapping`, `ViewResolver`, `PlatformTransactionManager` | Pluggable algorithm selection |
    | **Decorator** | `BeanPostProcessor`, `HandlerInterceptor` | Wraps beans to add behavior transparently |
    | **Adapter** | `HandlerAdapter` in MVC | Adapts various handler types to a uniform interface |
    | **Front Controller** | `DispatcherServlet` | Single entry point routing all requests |
    | **Composite** | `CompositeCacheManager`, `CompositeHealthContributor` | Treats groups of objects uniformly |
    | **Chain of Responsibility** | `Security FilterChain`, `HandlerInterceptor` chain | Request passes through ordered handlers |
    | **Builder** | `UriComponentsBuilder`, `MockMvc builders` | Fluent construction of complex objects |

    **When to use (recognizing patterns in Spring):**

    - When `@Transactional` does not fire on self-invocation -- you are dealing with a Proxy pattern limitation.
    - When you need custom bean creation logic -- implement `FactoryBean` (Factory pattern).
    - When you want to react to application lifecycle -- use `@EventListener` (Observer).
    - When you need to intercept all requests -- add a `Filter` or `HandlerInterceptor` (Chain of Responsibility).

    **Gotchas:**

    - Spring's "singleton" is per-ApplicationContext, not per-JVM -- multiple contexts = multiple instances.
    - Proxy-based AOP fails on `final` methods (CGLIB) and self-invocation (`this.method()` bypasses proxy).
    - Over-relying on Spring patterns without understanding the underlying GoF concepts leads to cargo-cult configuration.
    - `BeanPostProcessor` (Decorator) runs on ALL beans -- be careful with ordering and performance impact.

??? question "Q28: Which design patterns does the Java standard library use?"

    The Java standard library is rich with GoF pattern implementations. Recognizing them helps you understand API design decisions and use the library idiomatically.

    **Why:** Interviewers ask this to verify you can identify patterns "in the wild" rather than just textbook examples. It shows practical pattern recognition skills.

    **How -- Patterns with concrete examples:**

    | Pattern | Java Example | Why This Pattern |
    |---|---|---|
    | **Iterator** | `java.util.Iterator`, `Spliterator` | Traverse collections without exposing internals |
    | **Decorator** | `BufferedInputStream(FileInputStream)`, `Collections.unmodifiableList()` | Layer behavior without subclassing |
    | **Factory Method** | `Calendar.getInstance()`, `NumberFormat.getInstance()`, `EnumSet.of()` | Hide concrete type selection |
    | **Abstract Factory** | `DocumentBuilderFactory`, `TransformerFactory` (JAXP) | Family of XML-related objects |
    | **Singleton** | `Runtime.getRuntime()`, `Desktop.getDesktop()` | JVM-level unique resource |
    | **Strategy** | `Comparator<T>`, `ThreadFactory`, `RejectedExecutionHandler` | Pluggable algorithms |
    | **Template Method** | `AbstractList.add()`, `AbstractMap.entrySet()`, `HttpServlet.doGet()` | Fixed structure, variable steps |
    | **Adapter** | `Arrays.asList()` (array to List), `InputStreamReader` (bytes to chars) | Interface conversion |
    | **Flyweight** | `Integer.valueOf(-128..127)`, `String.intern()`, `Boolean.TRUE/FALSE` | Share immutable common objects |
    | **Proxy** | `java.lang.reflect.Proxy`, `InvocationHandler` | Dynamic interface implementation |
    | **Builder** | `StringBuilder`, `Locale.Builder`, `Stream.Builder`, `HttpRequest.newBuilder()` (Java 11) | Fluent construction |
    | **Command** | `Runnable`, `Callable<T>` | Encapsulate action for deferred execution |
    | **Composite** | `java.awt.Container` holds `Component`s, `CompletableFuture.allOf()` | Tree structure / group operations |
    | **Observer** | `PropertyChangeListener`, `Flow.Publisher` (Java 9 Reactive Streams) | Event notification |
    | **Chain of Responsibility** | `Logger` hierarchy (parent loggers), `ClassLoader` delegation | Delegated handling |
    | **State** | `Thread.State` enum (transitions managed by JVM) | Lifecycle states |
    | **Prototype** | `Object.clone()`, `Cloneable` | Copy creation |

    **When to use (learning from the JDK):**

    - Need thread-safe lazy caching? Study `Integer.valueOf()` (Flyweight).
    - Need extensible I/O? Study `InputStream` decorator chain.
    - Need flexible comparison? Study `Comparator` (Strategy with lambdas).
    - Need deferred execution? Study `Runnable`/`Callable` (Command).

    **Gotchas:**

    - `Cloneable` is considered a broken design (no method on the interface) -- prefer copy constructors.
    - `java.util.Observable` was deprecated in Java 9 -- use `Flow` API or third-party reactive libraries.
    - `Collections.unmodifiableList()` is a Decorator that throws on mutation -- not truly immutable (underlying list can still change). Use `List.copyOf()` (Java 10+) for true immutability.
    - `Proxy` only works with interfaces -- for class proxying, use bytecode libraries (CGLIB, ByteBuddy).

---

## Principles, Anti-Patterns & Decision-Making

??? question "Q29: How do SOLID principles relate to design patterns?"

    SOLID principles are the "why" behind design patterns -- patterns are concrete implementations of these abstract principles. Every well-applied pattern enforces one or more SOLID principles; every SOLID violation suggests a pattern that could fix it.

    **Why:** Interviewers ask this to see if you understand design patterns at a principled level, not just as recipes. If you can connect a pattern to the principle it enforces, you can judge when to apply it and when to skip it.

    **How:**

    | SOLID Principle | Related Patterns | How the Pattern Enforces It |
    |---|---|---|
    | **S** -- Single Responsibility | Command, Strategy, State | Each class encapsulates one reason to change |
    | **O** -- Open/Closed | Strategy, Decorator, Observer, Chain of Responsibility | Extend behavior by adding new classes, not modifying existing |
    | **L** -- Liskov Substitution | Template Method, Strategy, Composite | Subtypes are interchangeable without breaking client code |
    | **I** -- Interface Segregation | Adapter, Facade, Proxy | Clients see only the interface they need |
    | **D** -- Dependency Inversion | Factory, Strategy, Observer, Bridge | High-level modules depend on abstractions, not concretes |

    **Practical examples:**

    - **Strategy + OCP:** Adding a new pricing algorithm means a new class -- zero changes to the calculator.
    - **Factory + DIP:** Service depends on `Repository` interface, factory provides `JpaRepository` or `MongoRepository`.
    - **Decorator + OCP + SRP:** Each decorator adds one responsibility (logging, caching, retry) without modifying the base.

    **When to use:** When you spot a SOLID violation (code smell), look for the pattern that fixes it. God Object (SRP violation) -> decompose with Strategy/Command. Rigid conditional logic (OCP violation) -> replace with Strategy or Chain of Responsibility.

    **Gotchas:** Patterns can violate SOLID too -- Singleton violates SRP (manages lifecycle + business logic) and DIP (hard-coded concrete access). Visitor violates OCP from the element perspective (adding elements breaks visitors). Always evaluate the trade-off, not just the pattern's marketed benefit.

??? question "Q30: What are common anti-patterns, and how do you choose the right design pattern?"

    Anti-patterns are recurring "solutions" that appear helpful but create more problems than they solve. Choosing the right design pattern requires identifying what changes, starting simple, and letting code smells guide you toward patterns through refactoring.

    **Why:** The most dangerous developer is one who knows patterns but not when to stop. This question tests design judgment -- knowing when NOT to apply a pattern is more valuable than knowing its UML diagram.

    **How -- Common anti-patterns:**

    | Anti-Pattern | Description | Fix |
    |---|---|---|
    | **God Object** | One class that knows/does too much -- violates SRP | Decompose with Strategy, Command, Facade |
    | **Spaghetti Code** | Tangled, unstructured code with no clear architecture | Layer with Facade, extract with Template Method |
    | **Golden Hammer** | Using a favorite pattern for every problem | YAGNI -- choose based on forces, not familiarity |
    | **Lava Flow** | Dead code nobody dares remove | Track with coverage tools, delete fearlessly with tests |
    | **Premature Optimization** | Optimizing before evidence of a bottleneck | Profile first, then optimize the measured hotspot |
    | **Poltergeist** | Classes that only exist to invoke other classes | Remove indirection, let callers use the real object |
    | **Copy-Paste Programming** | Duplicated code instead of abstraction | Extract with Template Method or Strategy |

    **Decision framework for choosing the right pattern:**

    1. **Identify the problem category** -- is it about creation, structure, or behavior?
    2. **Identify what varies** -- the axis of change tells you which pattern applies (varying algorithm = Strategy, varying object type = Factory, varying state = State).
    3. **Start without a pattern** -- simple code that works beats elegant code that doesn't ship.
    4. **Let code smells guide you** -- switch statements (Strategy), deep nesting (Chain of Responsibility), constructor explosion (Builder).
    5. **Favor composition over inheritance** -- prefer Strategy over Template Method, Object Adapter over Class Adapter.
    6. **Check the trade-offs** -- every pattern adds indirection, classes, and complexity.
    7. **Refactor toward patterns** -- apply when the pain of not having the pattern exceeds the cost of introducing it.

    **When to use:** When you see repetition, rigidity, or fragility in code reviews. When adding a feature requires touching 5+ files. When tests are brittle because of tight coupling.

    **Gotchas:** Applying patterns upfront (Big Design Up Front) leads to over-engineered code that solves problems you never encounter. A 50-line class with a simple switch statement does not need a Strategy pattern. Patterns are tools for managing complexity -- if there is no complexity, the pattern IS the complexity. The best code often uses zero named patterns and simply follows good OOP fundamentals.
