# Top 30 Design Patterns Interview Questions & Answers

---

## Fundamentals

??? question "Q1: What are design patterns and why should we use them?"

    **Answer:** Design patterns are proven, reusable solutions to common software design problems. They are not finished code but templates for solving recurring design challenges.

    **Why use them:**

    - **Proven solutions** -- avoid reinventing the wheel.
    - **Common vocabulary** -- teams communicate faster ("use a Strategy here").
    - **Maintainability** -- promote loose coupling and high cohesion.
    - **Flexibility** -- open for extension, closed for modification (OCP).

    Popularized by the *Gang of Four* (GoF) book (1994) which catalogued 23 classic patterns.

??? question "Q2: How are design patterns classified?"

    **Answer:** The GoF patterns fall into three categories:

    | Category | Purpose | Patterns |
    |---|---|---|
    | **Creational** | Object creation mechanisms | Singleton, Factory Method, Abstract Factory, Builder, Prototype |
    | **Structural** | Compose objects into larger structures | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
    | **Behavioral** | Communication between objects | Chain of Responsibility, Command, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor |

---

## Creational Patterns

??? question "Q3: What is the Singleton pattern? Show a thread-safe implementation."

    **Answer:** Singleton ensures a class has **exactly one instance** with a global access point.

    ```java
    // Bill Pugh approach -- lazy, no synchronization overhead
    public class Singleton {
        private Singleton() {}
        private static class Holder {
            private static final Singleton INSTANCE = new Singleton();
        }
        public static Singleton getInstance() { return Holder.INSTANCE; }
    }
    ```

    **Other approaches:** eager initialization, double-checked locking (`volatile` + `synchronized`), and **enum singleton** (`enum Singleton { INSTANCE; }`) which is the simplest and most robust.

??? question "Q4: How can Singleton be broken via Reflection and Serialization?"

    **Answer:**

    **Reflection** -- call `setAccessible(true)` on the private constructor to create a second instance. *Fix:* throw an exception in the constructor if an instance exists.

    **Serialization** -- deserializing creates a new object. *Fix:* implement `readResolve()`:

    ```java
    protected Object readResolve() { return getInstance(); }
    ```

    **Best defense:** Use an **enum Singleton** -- Java guarantees enum values are instantiated once and handles both reflection and serialization automatically.

??? question "Q5: When is Singleton considered an anti-pattern?"

    **Answer:** Singleton becomes problematic when it introduces:

    - **Hidden dependencies** -- classes silently depend on the global instance.
    - **Tight coupling** -- callers couple to the concrete class, not an abstraction.
    - **Testing difficulty** -- hard to mock; state leaks between tests.
    - **SRP violation** -- manages its own lifecycle *and* business logic.

    **Prefer:** a DI framework (like Spring) to manage a single instance via scope, rather than hard-coding the pattern.

??? question "Q6: What is the difference between Factory Method and Abstract Factory?"

    **Answer:**

    | Aspect | Factory Method | Abstract Factory |
    |---|---|---|
    | Scope | Creates **one product** | Creates a **family of related products** |
    | Mechanism | Subclass overrides a method | Composes multiple factory methods |
    | Example | `LoggerFactory.getLogger()` | `GUIFactory` producing Button + Checkbox per theme |

    ```java
    // Factory Method -- one product
    abstract class Dialog { abstract Button createButton(); }

    // Abstract Factory -- family of products
    interface GUIFactory {
        Button createButton();
        Checkbox createCheckbox();
    }
    ```

??? question "Q7: When should you use the Builder pattern instead of a telescoping constructor?"

    **Answer:** Use Builder when a class has **many parameters** (4+), several are **optional**, and you want **readable, fluent, immutable** construction.

    ```java
    public class User {
        private final String name;
        private final int age;
        private final String email;

        private User(Builder b) {
            this.name = b.name; this.age = b.age; this.email = b.email;
        }
        public static class Builder {
            private final String name;
            private final int age;
            private String email = "";
            public Builder(String name, int age) { this.name = name; this.age = age; }
            public Builder email(String e) { this.email = e; return this; }
            public User build() { return new User(this); }
        }
    }
    // Usage: new User.Builder("Alice", 30).email("a@b.com").build();
    ```

??? question "Q8: Explain the Prototype pattern. Shallow copy vs deep copy?"

    **Answer:** Prototype creates new objects by **cloning an existing instance** instead of calling `new`. Useful when creation is expensive.

    ```java
    public class Shape implements Cloneable {
        private List<String> tags;
        public Shape shallowCopy() throws CloneNotSupportedException {
            return (Shape) super.clone(); // tags list is shared
        }
        public Shape deepCopy() {
            return new Shape(new ArrayList<>(this.tags)); // independent copy
        }
    }
    ```

    | Shallow Copy | Deep Copy |
    |---|---|
    | Copies field references | Recursively copies all referenced objects |
    | Fast but shared mutable state | Slower but fully independent |

---

## Structural Patterns

??? question "Q9: What are the key differences between Adapter, Facade, Decorator, and Proxy?"

    **Answer:**

    | Pattern | Intent |
    |---|---|
    | **Adapter** | Makes incompatible interfaces work together (changes interface) |
    | **Facade** | Simplified interface to a complex subsystem (wraps many objects) |
    | **Decorator** | Adds behavior dynamically (same interface, enhances) |
    | **Proxy** | Controls access to an object (same interface, restricts/manages) |

??? question "Q10: Explain class adapter vs object adapter."

    **Answer:** Adapter converts one interface into another that clients expect.

    ```java
    // Object Adapter (composition -- preferred)
    public class SocketAdapter implements USPlug {
        private EUPlug euPlug;
        public SocketAdapter(EUPlug euPlug) { this.euPlug = euPlug; }
        public void provideUSPower() { euPlug.provideEUPower(); }
    }

    // Class Adapter (inheritance -- less flexible)
    public class SocketAdapter extends EUPlug implements USPlug {
        public void provideUSPower() { provideEUPower(); }
    }
    ```

    Object adapters use composition (can adapt any subclass), class adapters use inheritance (tied to one class). Java favors object adapters since it lacks multiple class inheritance.

??? question "Q11: How does the Decorator pattern work? Give a real-world Java example."

    **Answer:** Decorator wraps an object with the same interface to add behavior dynamically.

    **Java I/O Streams -- classic Decorator:**

    ```java
    InputStream in = new DataInputStream(        // adds typed reads
        new BufferedInputStream(                  // adds buffering
            new FileInputStream("data.bin")));    // base stream
    ```

    **Custom example:**

    ```java
    interface Coffee { double cost(); }
    class SimpleCoffee implements Coffee { public double cost() { return 2.0; } }
    class MilkDecorator implements Coffee {
        private Coffee coffee;
        MilkDecorator(Coffee c) { this.coffee = c; }
        public double cost() { return coffee.cost() + 0.5; }
    }
    // new MilkDecorator(new SimpleCoffee()).cost() => 2.5
    ```

??? question "Q12: What are the types of Proxy pattern?"

    **Answer:**

    | Type | Purpose | Example |
    |---|---|---|
    | **Virtual Proxy** | Lazy loading of expensive objects | Load image on first `display()` call |
    | **Protection Proxy** | Access control based on permissions | Check user role before method call |
    | **Remote Proxy** | Represent object in another address space | Java RMI stubs |
    | **Caching Proxy** | Cache expensive operation results | DB query result caching |

    ```java
    public class ImageProxy implements Image {
        private RealImage realImage;
        private String filename;
        public ImageProxy(String f) { this.filename = f; }
        public void display() {
            if (realImage == null) realImage = new RealImage(filename);
            realImage.display();
        }
    }
    ```

    Spring uses JDK dynamic proxies and CGLIB proxies for AOP, `@Transactional`, and security.

??? question "Q13: How does the Facade pattern simplify complex subsystems?"

    **Answer:** Facade provides a **unified, higher-level interface** to a set of subsystem interfaces.

    ```java
    class CPU    { void start() { } }
    class Memory { void load()  { } }
    class Disk   { void read()  { } }

    class ComputerFacade {
        private CPU cpu = new CPU();
        private Memory mem = new Memory();
        private Disk disk = new Disk();
        public void startComputer() { disk.read(); mem.load(); cpu.start(); }
    }
    ```

    Does **not** prevent direct subsystem access. Real examples: `JdbcTemplate`, `RestTemplate` in Spring.

??? question "Q14: When should you use the Composite pattern?"

    **Answer:** Use Composite for **part-whole hierarchies** (tree structures) where individual objects and groups are treated uniformly.

    ```java
    interface FileSystemItem { long getSize(); }

    class File implements FileSystemItem {
        private long size;
        public long getSize() { return size; }
    }
    class Folder implements FileSystemItem {
        private List<FileSystemItem> children = new ArrayList<>();
        public void add(FileSystemItem item) { children.add(item); }
        public long getSize() {
            return children.stream().mapToLong(FileSystemItem::getSize).sum();
        }
    }
    ```

    Use cases: file systems, UI component trees, org charts, menu systems.

??? question "Q15: Explain the Bridge pattern."

    **Answer:** Bridge **decouples an abstraction from its implementation** so both can vary independently via composition.

    ```java
    interface Color { String fill(); }
    class Red implements Color  { public String fill() { return "Red"; } }

    abstract class Shape {
        protected Color color;
        Shape(Color c) { this.color = c; }
        abstract void draw();
    }
    class Circle extends Shape {
        Circle(Color c) { super(c); }
        void draw() { System.out.println("Circle in " + color.fill()); }
    }
    // new Circle(new Red()).draw() => "Circle in Red"
    ```

    Without Bridge you need `RedCircle`, `BlueCircle`, `RedSquare`, etc. -- an explosion of subclasses.

??? question "Q16: How does the Flyweight pattern optimize memory?"

    **Answer:** Flyweight **shares intrinsic (common) state** among many objects; extrinsic (context-specific) state is passed by the client.

    ```java
    class FlyweightFactory {
        private Map<String, CharFlyweight> cache = new HashMap<>();
        CharFlyweight get(char symbol, String font) {
            String key = symbol + "-" + font;
            return cache.computeIfAbsent(key, k -> new CharFlyweight(symbol, font));
        }
    }
    ```

    **Java examples:** `String.intern()`, `Integer.valueOf()` (caches -128 to 127), `Boolean.valueOf()`.

---

## Behavioral Patterns

??? question "Q17: How does the Strategy pattern eliminate switch/if-else chains?"

    **Answer:** Strategy encapsulates algorithms as interchangeable objects, selected at runtime.

    ```java
    // Before: fragile if-else
    if ("REGULAR".equals(type)) return amount * 0.1;
    else if ("PREMIUM".equals(type)) return amount * 0.2;

    // After: Strategy
    interface DiscountStrategy { double calculate(double amount); }
    class RegularDiscount implements DiscountStrategy {
        public double calculate(double amount) { return amount * 0.1; }
    }
    class PriceCalculator {
        private DiscountStrategy strategy;
        double applyDiscount(double amount) { return strategy.calculate(amount); }
    }
    ```

    Adding a new discount = new class, **zero changes** to existing code (Open/Closed Principle).

??? question "Q18: What is the Observer pattern? How does it differ from Pub/Sub?"

    **Answer:** Observer defines a one-to-many dependency -- when Subject changes state, all Observers are notified.

    ```java
    interface Observer { void update(String event); }
    class EventEmitter {
        private List<Observer> observers = new ArrayList<>();
        void subscribe(Observer o) { observers.add(o); }
        void emit(String event) { observers.forEach(o -> o.update(event)); }
    }
    ```

    | Observer | Pub/Sub |
    |---|---|
    | Subject knows observers directly | Decoupled via message broker |
    | Typically synchronous | Often asynchronous |
    | In-process | Can span networks (Kafka, RabbitMQ) |

??? question "Q19: Compare Template Method and Strategy patterns."

    **Answer:**

    | Aspect | Template Method | Strategy |
    |---|---|---|
    | Mechanism | **Inheritance** -- override hook methods | **Composition** -- inject algorithm object |
    | Granularity | Varies **steps** in a fixed skeleton | Varies the **entire algorithm** |
    | Selection | Compile time (subclass) | Runtime (swappable object) |

    ```java
    // Template Method -- fixed skeleton, variable steps
    abstract class DataMiner {
        final void mine() { openFile(); extractData(); parseData(); }
        abstract void openFile();
        abstract void extractData();
        void parseData() { /* default */ }
    }
    // Strategy -- entire algorithm is injected
    class Sorter { void sort(int[] data) { strategy.sort(data); } }
    ```

??? question "Q20: Explain the Command pattern. How does it support undo/redo?"

    **Answer:** Command encapsulates a request as an object, enabling undo, queueing, and logging.

    ```java
    interface Command { void execute(); void undo(); }

    class AddTextCommand implements Command {
        private StringBuilder doc;
        private String text;
        AddTextCommand(StringBuilder doc, String text) {
            this.doc = doc; this.text = text;
        }
        public void execute() { doc.append(text); }
        public void undo() { doc.delete(doc.length() - text.length(), doc.length()); }
    }

    class CommandHistory {
        private Deque<Command> history = new ArrayDeque<>();
        void run(Command cmd) { cmd.execute(); history.push(cmd); }
        void undo() { if (!history.isEmpty()) history.pop().undo(); }
    }
    ```

    **Macro commands** group multiple commands, execute them in sequence, undo in reverse.

??? question "Q21: How does Chain of Responsibility differ from an if-else chain?"

    **Answer:** Each handler in the chain decides to process the request or pass it along.

    ```java
    abstract class Handler {
        private Handler next;
        Handler setNext(Handler h) { this.next = h; return h; }
        void handle(Request req) {
            if (canHandle(req)) process(req);
            else if (next != null) next.handle(req);
        }
        abstract boolean canHandle(Request req);
        abstract void process(Request req);
    }
    ```

    | if-else | Chain of Responsibility |
    |---|---|
    | All logic in one place | Each handler is a separate class |
    | Modify existing code to add cases | Add a new handler class (OCP) |
    | Fixed order | Chain is configurable at runtime |

    Real-world: Servlet Filters, Spring Security filter chain.

??? question "Q22: How does the State pattern differ from Strategy and from if-else?"

    **Answer:** State lets an object alter behavior when its internal state changes.

    ```java
    interface State { void handle(Context ctx); }
    class LockedState implements State {
        public void handle(Context ctx) {
            System.out.println("Unlocking...");
            ctx.setState(new UnlockedState());
        }
    }
    class Context {
        private State state;
        void setState(State s) { this.state = s; }
        void request() { state.handle(this); }
    }
    ```

    | State | Strategy |
    |---|---|
    | States **transition themselves** | Client selects strategy |
    | States know about each other | Strategies are independent |
    | Models a state machine | Selects an algorithm |

??? question "Q23: What is the difference between internal and external iterators?"

    **Answer:**

    | External Iterator | Internal Iterator |
    |---|---|
    | Client controls: `hasNext()`, `next()` | Collection controls: client provides action |
    | More flexible (can break, skip) | Simpler, functional style |
    | `Iterator<T>` | `forEach()`, `Stream.forEach()` |

    ```java
    // External -- client controls
    Iterator<String> it = list.iterator();
    while (it.hasNext()) { if (it.next().startsWith("A")) break; }

    // Internal -- collection controls
    list.forEach(s -> System.out.println(s));
    ```

??? question "Q24: How does the Mediator pattern reduce coupling?"

    **Answer:** Mediator centralizes communication -- objects interact through it (N-to-1) instead of directly (N-to-N).

    ```java
    class ChatRoom {
        private List<User> users = new ArrayList<>();
        void addUser(User u) { users.add(u); }
        void sendMessage(String msg, User sender) {
            users.stream().filter(u -> u != sender)
                 .forEach(u -> u.receive(msg));
        }
    }
    class User {
        private ChatRoom mediator;
        void send(String msg) { mediator.sendMessage(msg, this); }
        void receive(String msg) { System.out.println(msg); }
    }
    ```

??? question "Q25: Explain the Memento pattern for snapshot/restore."

    **Answer:** Memento captures an object's state for later restoration without violating encapsulation. Three roles: **Originator** (object), **Memento** (snapshot), **Caretaker** (stores mementos).

    ```java
    class Editor {
        private String content;
        void setContent(String c) { this.content = c; }
        EditorMemento save() { return new EditorMemento(content); }
        void restore(EditorMemento m) { this.content = m.getContent(); }
    }
    class EditorMemento {
        private final String content;
        EditorMemento(String c) { this.content = c; }
        String getContent() { return content; }
    }
    ```

    Use cases: undo systems, transaction rollback, game save/load.

??? question "Q26: What is the Visitor pattern and why is it called double dispatch?"

    **Answer:** Visitor defines new operations on a structure without modifying its classes. **Double dispatch**: the operation depends on both the visitor type *and* the element type.

    ```java
    interface Shape { void accept(ShapeVisitor v); }
    class Circle implements Shape {
        double radius;
        public void accept(ShapeVisitor v) { v.visit(this); }
    }
    interface ShapeVisitor {
        void visit(Circle c);
        void visit(Rectangle r);
    }
    class AreaCalculator implements ShapeVisitor {
        public void visit(Circle c) { System.out.println(Math.PI * c.radius * c.radius); }
        public void visit(Rectangle r) { System.out.println(r.width * r.height); }
    }
    // shape.accept(visitor) -> dispatch #1 (element type)
    // visitor.visit(this)   -> dispatch #2 (visitor overload)
    ```

    Trade-off: easy to add operations, hard to add new element types.

---

## Patterns in Frameworks

??? question "Q27: Which design patterns does Spring Framework use?"

    **Answer:**

    | Pattern | Where in Spring |
    |---|---|
    | **Singleton** | Default bean scope -- one instance per container |
    | **Factory** | `BeanFactory`, `ApplicationContext` create beans |
    | **Proxy** | AOP proxies for `@Transactional`, `@Cacheable`, `@Async` |
    | **Template Method** | `JdbcTemplate`, `RestTemplate` -- fixed algorithm, customizable steps |
    | **Observer** | `ApplicationEvent` and `@EventListener` |
    | **Strategy** | `ResourceLoader`, `HandlerMapping`, `ViewResolver` |
    | **Decorator** | `BeanPostProcessor` wrapping beans |
    | **Adapter** | `HandlerAdapter` in Spring MVC |
    | **Front Controller** | `DispatcherServlet` as single entry point |

??? question "Q28: Which design patterns does the Java standard library use?"

    **Answer:**

    | Pattern | Java Example |
    |---|---|
    | **Iterator** | `java.util.Iterator` |
    | **Decorator** | `BufferedInputStream`, `DataInputStream` |
    | **Factory Method** | `Calendar.getInstance()`, `NumberFormat.getInstance()` |
    | **Singleton** | `Runtime.getRuntime()` |
    | **Strategy** | `Comparator<T>` with `Collections.sort()` |
    | **Template Method** | `AbstractList.add()`, `HttpServlet.doGet()` |
    | **Adapter** | `Arrays.asList()`, `InputStreamReader` |
    | **Flyweight** | `Integer.valueOf()` (caches -128 to 127) |
    | **Proxy** | `java.lang.reflect.Proxy` |
    | **Builder** | `StringBuilder`, `Locale.Builder` |
    | **Command** | `Runnable` encapsulates an action |
    | **Composite** | `java.awt.Container` holds `Component` objects |

---

## Principles, Anti-Patterns & Decision-Making

??? question "Q29: How do SOLID principles relate to design patterns?"

    **Answer:**

    | SOLID Principle | Related Patterns |
    |---|---|
    | **S** -- Single Responsibility | Command, Strategy (each class has one job) |
    | **O** -- Open/Closed | Strategy, Decorator, Observer (extend without modifying) |
    | **L** -- Liskov Substitution | Template Method, Strategy (subtypes are interchangeable) |
    | **I** -- Interface Segregation | Adapter, Facade (clients see only what they need) |
    | **D** -- Dependency Inversion | Factory, Strategy, Observer (depend on abstractions) |

    Example: **Strategy** embodies OCP -- add new algorithms without touching existing code. **Factory** embodies DIP -- code depends on an abstraction, not concrete instantiation.

??? question "Q30: What are common anti-patterns, and how do you choose the right design pattern?"

    **Answer:**

    **Common anti-patterns:**

    | Anti-Pattern | Description |
    |---|---|
    | **God Object** | One class that knows/does too much -- violates SRP |
    | **Spaghetti Code** | Tangled, unstructured code with no clear architecture |
    | **Golden Hammer** | Using a favorite pattern for every problem |
    | **Lava Flow** | Dead code nobody dares remove |
    | **Premature Optimization** | Optimizing before evidence of a bottleneck |

    **How to choose the right pattern:**

    1. **Identify the problem** -- creation, structure, or behavior?
    2. **Consider the forces** -- what changes? What stays stable?
    3. **Start simple** -- do not apply a pattern unless the problem demands it (YAGNI).
    4. **Favor composition over inheritance**.
    5. **Check trade-offs** -- every pattern adds indirection.
    6. **Refactor toward patterns** -- apply when code smells tell you it is needed.
