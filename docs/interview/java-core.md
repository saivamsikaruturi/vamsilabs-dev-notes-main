# Top 50 Core Java Interview Questions & Answers

This page is a rapid-fire reference for the most frequently asked **Core Java** interview questions. Each answer is kept concise yet complete enough to use in a real interview. Expand any question to reveal the answer. Use this as a last-minute revision guide or a self-assessment checklist before your next Java interview.

---

??? question "Q1: What is the difference between JDK, JRE, and JVM?"

    **Answer:** **JVM** (Java Virtual Machine) is the runtime engine that executes bytecode. **JRE** (Java Runtime Environment) = JVM + core libraries needed to *run* Java programs. **JDK** (Java Development Kit) = JRE + development tools (`javac`, `jdb`, `javadoc`, etc.) needed to *compile and develop* Java programs.

    ```
    JDK  ⊃  JRE  ⊃  JVM
    ```

    If you only need to run a Java application, you need the JRE. If you need to develop one, you need the JDK.

??? question "Q2: How does Java achieve platform independence?"

    **Answer:** The Java compiler (`javac`) compiles source code into platform-neutral **bytecode** (`.class` files), not native machine code. The JVM on each platform interprets or JIT-compiles this bytecode into native instructions at runtime. This "write once, run anywhere" model means the same `.class` file runs on Windows, Linux, or macOS as long as a compatible JVM is installed.

    ```mermaid
    flowchart LR
        A[/"HelloWorld.java"/] -->|javac| B{{"HelloWorld.class<br/>bytecode"}}
        B --> C(["JVM - Windows"])
        B --> D(["JVM - Linux"])
        B --> E(["JVM - macOS"])
        C --> F[["Native code"]]
        D --> G[["Native code"]]
        E --> H[["Native code"]]
    ```

    Note: Java *is* platform-dependent at the JVM level -- each OS requires its own JVM implementation.

??? question "Q3: Why is Java not 100% object-oriented?"

    **Answer:** Java uses eight **primitive types** (`int`, `byte`, `short`, `long`, `float`, `double`, `char`, `boolean`) that are not objects. They live on the stack, have no methods, and do not extend `Object`. Additionally, `static` members belong to the class rather than an instance. These deviations from pure OOP were made for performance reasons. Wrapper classes (`Integer`, `Boolean`, etc.) exist to bridge the gap when objects are required.

??? question "Q4: What is the significance of the main() method?"

    **Answer:** `public static void main(String[] args)` is the entry point for any standalone Java application. It must be `public` (accessible by the JVM), `static` (callable without creating an instance), and `void` (returns nothing to the JVM). The `String[] args` parameter receives command-line arguments. The JVM looks for this exact signature to start execution.

??? question "Q5: Explain the static keyword (variable, method, block, nested class)."

    **Answer:**

    - **Static variable** -- shared across all instances of the class; stored in the metaspace (not per-object heap).
    - **Static method** -- belongs to the class, can be called without an object, cannot access `this` or instance members directly.
    - **Static block** -- runs once when the class is loaded; used for static initialization.
    - **Static nested class** -- a nested class that does not hold a reference to the enclosing instance.

    ```java
    class Demo {
        static int count;                       // static variable
        static { count = 0; }                   // static block
        static void increment() { count++; }    // static method
        static class Helper { }                 // static nested class
    }
    ```

??? question "Q6: Explain the final keyword (variable, method, class)."

    **Answer:**

    - **Final variable** -- value cannot be changed once assigned (constant). For reference types, the reference cannot be reassigned but the object's internal state can still change.
    - **Final method** -- cannot be overridden by subclasses.
    - **Final class** -- cannot be extended (e.g., `String`, `Integer`).

    ```java
    final int MAX = 100;          // constant
    final List<String> list = new ArrayList<>();
    list.add("ok");               // allowed -- mutating the object
    // list = new ArrayList<>();  // compile error -- reassigning the reference
    ```

??? question "Q7: What is the difference between == and .equals()?"

    **Answer:** `==` compares **references** (memory addresses) for objects and **values** for primitives. `.equals()` compares **logical equality** and can be overridden. By default, `Object.equals()` behaves like `==`, but classes like `String`, `Integer`, and `LocalDate` override it to compare content.

    ```java
    String a = new String("hello");
    String b = new String("hello");
    System.out.println(a == b);       // false (different objects)
    System.out.println(a.equals(b));  // true  (same content)
    ```

??? question "Q8: What is the hashCode() contract?"

    **Answer:** The contract states: (1) If `a.equals(b)` is `true`, then `a.hashCode() == b.hashCode()` must also be `true`. (2) If two objects have the same hash code, they are *not* necessarily equal (hash collisions are allowed). (3) `hashCode()` must return the same value for the same object within a single execution (assuming no fields used in the computation change). Violating this contract breaks `HashMap`, `HashSet`, and other hash-based collections.

    ```java
    @Override
    public int hashCode() {
        return Objects.hash(firstName, lastName, age);  // consistent with equals()
    }
    ```

    A common mistake is overriding `equals()` without overriding `hashCode()`, causing objects that are logically equal to land in different hash buckets.

??? question "Q9: Is Java pass-by-value or pass-by-reference?"

    **Answer:** Java is **always pass-by-value**. For primitives, the actual value is copied. For objects, the *reference* (pointer) is copied by value. This means you can mutate the object a reference points to inside a method, but you cannot make the caller's variable point to a different object.

    ```java
    void change(StringBuilder sb) {
        sb.append(" world");     // mutates the original object -- visible to caller
        sb = new StringBuilder("new");  // reassigns local copy -- caller unaffected
    }
    ```

??? question "Q10: What is autoboxing/unboxing? Explain Integer caching."

    **Answer:** **Autoboxing** is the automatic conversion from a primitive to its wrapper (`int` to `Integer`). **Unboxing** is the reverse. Java caches `Integer` objects for values **-128 to 127** (per JLS), so `==` comparisons work within that range but fail outside it.

    ```java
    Integer a = 127, b = 127;
    System.out.println(a == b);    // true  (cached)

    Integer x = 128, y = 128;
    System.out.println(x == y);    // false (different objects)
    System.out.println(x.equals(y)); // true
    ```

??? question "Q11: Why is String immutable in Java?"

    **Answer:** String immutability enables: (1) **String pool** -- the JVM can safely share string literals across references. (2) **Thread safety** -- immutable objects are inherently thread-safe. (3) **Security** -- strings are used for class loading, network connections, and file paths; mutability would create security holes. (4) **Caching hashCode** -- `String` caches its hash code for fast `HashMap` lookups. The class is declared `final` with a `private final char[]` (or `byte[]` since Java 9) backing array.

??? question "Q12: String vs StringBuilder vs StringBuffer?"

    **Answer:**

    | Feature       | `String`       | `StringBuilder` | `StringBuffer` |
    |---------------|---------------|-----------------|----------------|
    | Mutability    | Immutable     | Mutable         | Mutable        |
    | Thread-safe   | Yes (immutable) | No            | Yes (synchronized) |
    | Performance   | Slow for concatenation | Fast   | Slower than StringBuilder |

    Use `StringBuilder` for single-threaded string manipulation, `StringBuffer` when thread safety is required (rare), and `String` for fixed text.

??? question "Q13: What is the String pool?"

    **Answer:** The String pool (intern pool) is a special memory area in the **heap** (moved from PermGen in Java 7) where the JVM stores unique string literals. When you write `String s = "hello"`, the JVM checks the pool first and reuses an existing instance if found. `new String("hello")` always creates a new object on the heap, bypassing the pool. You can explicitly add a string to the pool with `s.intern()`.

    ```java
    String s1 = "hello";              // goes to pool
    String s2 = "hello";              // reuses same pool object
    String s3 = new String("hello");  // new heap object (pool NOT used)

    System.out.println(s1 == s2);            // true  (same pool reference)
    System.out.println(s1 == s3);            // false (different objects)
    System.out.println(s1 == s3.intern());   // true  (intern returns pool reference)
    ```

??? question "Q14: What are marker interfaces?"

    **Answer:** A marker interface is an interface with **no methods or fields**. It acts as a tag to signal metadata to the JVM or framework. Classic examples: `Serializable` (tells the JVM the object can be serialized), `Cloneable` (permits `Object.clone()`), and `Remote` (marks RMI remote objects). Since Java 5, annotations (e.g., `@Entity`) largely replace marker interfaces for metadata.

??? question "Q15: Explain Cloneable and Object cloning."

    **Answer:** `Object.clone()` creates a **shallow copy** of an object. A class must implement the `Cloneable` marker interface; otherwise, `clone()` throws `CloneNotSupportedException`. The default clone copies primitive fields and copies references (not the objects they point to). For a **deep copy**, you must override `clone()` and explicitly clone mutable fields.

    ```java
    class Employee implements Cloneable {
        String name;
        Address address;

        @Override
        protected Employee clone() throws CloneNotSupportedException {
            Employee copy = (Employee) super.clone();  // shallow copy
            copy.address = new Address(this.address);  // deep copy of mutable field
            return copy;
        }
    }
    ```

    Many developers prefer **copy constructors** or static factory methods over `clone()` due to its fragile, error-prone design (Effective Java, Item 13).

??? question "Q16: Comparable vs Comparator?"

    **Answer:** `Comparable<T>` defines a **natural ordering** inside the class itself via `compareTo(T o)`. `Comparator<T>` defines an **external, custom ordering** via `compare(T o1, T o2)` and can be swapped at runtime.

    ```java
    // Comparable -- natural order
    class Employee implements Comparable<Employee> {
        public int compareTo(Employee o) { return this.name.compareTo(o.name); }
    }

    // Comparator -- custom order
    Comparator<Employee> bySalary = Comparator.comparingDouble(Employee::getSalary);
    employees.sort(bySalary);
    ```

??? question "Q17: What is type casting (upcasting and downcasting)?"

    **Answer:** **Upcasting** is casting a subclass reference to a superclass type. It is implicit and always safe. **Downcasting** is casting a superclass reference to a subclass type. It is explicit and can throw `ClassCastException` at runtime if the actual object is not of that subclass.

    ```java
    Animal a = new Dog();      // upcasting (implicit)
    Dog d = (Dog) a;           // downcasting (explicit, safe here)
    Cat c = (Cat) a;           // ClassCastException at runtime!
    ```

    Always check with `instanceof` before downcasting.

??? question "Q18: Abstract class vs interface (Java 8+)?"

    **Answer:**

    | Feature | Abstract Class | Interface |
    |---------|---------------|-----------|
    | Methods | Abstract + concrete | Abstract + `default` + `static` + `private` (Java 9+) |
    | Fields | Any fields | Only `public static final` constants |
    | Constructor | Yes | No |
    | Inheritance | Single (`extends`) | Multiple (`implements`) |
    | State | Can hold mutable state | Cannot hold instance state |

    Use an abstract class when subclasses share state or constructor logic. Use an interface to define a capability contract that unrelated classes can implement.

??? question "Q19: What is the diamond problem and how does Java solve it?"

    **Answer:** The diamond problem occurs when a class inherits from two classes that both have a method with the same signature. Java avoids this by **disallowing multiple class inheritance**. With interfaces (Java 8+ default methods), if two interfaces provide the same default method, the implementing class **must override** the method to resolve the ambiguity.

    ```java
    interface A { default void greet() { System.out.println("A"); } }
    interface B { default void greet() { System.out.println("B"); } }

    class C implements A, B {
        @Override
        public void greet() { A.super.greet(); }  // explicit resolution
    }
    ```

??? question "Q20: Method overloading vs method overriding rules?"

    **Answer:** **Overloading** (compile-time polymorphism): same method name, different parameter list (type, number, or order). Return type alone is not sufficient. **Overriding** (runtime polymorphism): subclass provides a specific implementation for a method already defined in its superclass.

    Rules for **overriding**:

    - Same method name and parameter list.
    - Return type must be the same or a covariant (subclass) type.
    - Access modifier must be the same or wider (e.g., `protected` -> `public`).
    - Cannot throw new or broader checked exceptions.
    - `static`, `final`, and `private` methods cannot be overridden.

    ```java
    // Overloading
    int add(int a, int b) { return a + b; }
    double add(double a, double b) { return a + b; }  // different param types

    // Overriding
    class Parent { void speak() { System.out.println("Parent"); } }
    class Child extends Parent {
        @Override void speak() { System.out.println("Child"); }
    }
    ```

??? question "Q21: What are covariant return types?"

    **Answer:** Since Java 5, an overriding method can return a **subtype** of the return type declared in the superclass method. This is called a covariant return type.

    ```java
    class Animal {
        Animal create() { return new Animal(); }
    }
    class Dog extends Animal {
        @Override
        Dog create() { return new Dog(); }  // covariant return -- Dog is a subtype of Animal
    }
    ```

??? question "Q22: What is the scope of each access modifier?"

    **Answer:**

    | Modifier    | Class | Package | Subclass | World |
    |-------------|:-----:|:-------:|:--------:|:-----:|
    | `private`   | Yes   | No      | No       | No    |
    | (default)   | Yes   | Yes     | No       | No    |
    | `protected` | Yes   | Yes     | Yes      | No    |
    | `public`    | Yes   | Yes     | Yes      | Yes   |

    Top-level classes can only be `public` or package-private (default). `private` and `protected` are allowed only on members and nested classes.

??? question "Q23: What is the difference between transient and volatile?"

    **Answer:** `transient` marks a field to be **excluded from serialization**. When an object is serialized, transient fields are set to their default values upon deserialization. `volatile` ensures a field's value is always **read from and written to main memory**, providing visibility guarantees across threads. It does not provide atomicity -- use `AtomicInteger` or `synchronized` for compound operations.

    ```java
    class User implements Serializable {
        private String name;
        private transient String password;  // not serialized
    }

    class SharedFlag {
        private volatile boolean running = true;  // visible across threads immediately
    }
    ```

??? question "Q24: Explain this vs super keyword."

    **Answer:** `this` refers to the **current object instance**. Uses: access instance members, call another constructor in the same class (`this(...)`), pass the current object as an argument. `super` refers to the **parent class**. Uses: access parent methods/fields hidden by the subclass, call the parent constructor (`super(...)`). Both `this()` and `super()` must be the first statement in a constructor, so they cannot be used together.

    ```java
    class Animal {
        String name;
        Animal(String name) { this.name = name; }
    }

    class Dog extends Animal {
        String breed;
        Dog(String name, String breed) {
            super(name);           // calls Animal(name) -- must be first line
            this.breed = breed;    // resolves ambiguity with parameter name
        }
    }
    ```

??? question "Q25: Static binding vs dynamic binding?"

    **Answer:** **Static binding** (early binding) is resolved at **compile time**. It applies to `static`, `private`, and `final` methods, as well as method overloading. **Dynamic binding** (late binding) is resolved at **runtime** based on the actual object type. It applies to overridden instance methods (polymorphism). The JVM uses the virtual method table (vtable) to dispatch dynamically bound calls.

    ```java
    class Animal { void sound() { System.out.println("..."); } }
    class Dog extends Animal { void sound() { System.out.println("Bark"); } }

    Animal a = new Dog();
    a.sound();   // "Bark" -- dynamic binding (resolved at runtime)
    ```

??? question "Q26: Shallow copy vs deep copy?"

    **Answer:** A **shallow copy** duplicates the object but copies references to nested objects (both copies point to the same nested objects). A **deep copy** recursively duplicates all nested objects so the copy is completely independent.

    ```java
    // Shallow: address is shared
    Person copy = original.clone();
    copy.getAddress().setCity("NYC"); // also changes original's address

    // Deep: address is independently cloned
    Person deepCopy = new Person(original.getName(),
                                  new Address(original.getAddress()));
    ```

??? question "Q27: Fail-fast vs fail-safe iterators?"

    **Answer:** **Fail-fast** iterators (e.g., `ArrayList.iterator()`, `HashMap.iterator()`) throw `ConcurrentModificationException` if the collection is structurally modified during iteration. They use an internal `modCount` field to detect changes. **Fail-safe** iterators (e.g., `ConcurrentHashMap.iterator()`, `CopyOnWriteArrayList.iterator()`) work on a snapshot or allow concurrent modification without throwing exceptions, at the cost of additional memory or not reflecting real-time changes.

    ```java
    // Fail-fast -- throws ConcurrentModificationException
    List<String> list = new ArrayList<>(List.of("a", "b", "c"));
    for (String s : list) {
        list.remove(s);  // structural modification during iteration
    }

    // Safe alternative -- use Iterator.remove() or CopyOnWriteArrayList
    Iterator<String> it = list.iterator();
    while (it.hasNext()) {
        if (it.next().equals("b")) it.remove();  // safe
    }
    ```

??? question "Q28: How do you create an immutable class in Java?"

    **Answer:**

    1. Declare the class as `final` (prevent subclassing).
    2. Make all fields `private final`.
    3. Do not provide setter methods.
    4. Initialize all fields via the constructor.
    5. Return **defensive copies** of mutable fields in getters.

    ```java
    public final class Money {
        private final BigDecimal amount;
        private final Currency currency;

        public Money(BigDecimal amount, Currency currency) {
            this.amount = amount;
            this.currency = currency;
        }
        public BigDecimal getAmount() { return amount; }       // BigDecimal is immutable
        public Currency getCurrency() { return currency; }
    }
    ```

??? question "Q29: What is the finalize() method? Why is it deprecated?"

    **Answer:** `finalize()` is called by the garbage collector before reclaiming an object's memory. It was deprecated in Java 9 and marked for removal because: (1) execution is **not guaranteed** -- the GC may never call it. (2) It causes **performance overhead** and delays GC. (3) It can **resurrect objects** accidentally. (4) It introduces **non-deterministic** cleanup timing. Use `try-with-resources` and `Cleaner` (Java 9+) instead.

??? question "Q30: Explain try-with-resources."

    **Answer:** Introduced in Java 7, try-with-resources automatically closes resources that implement `AutoCloseable` when the try block exits (normally or via exception). This eliminates boilerplate `finally` blocks and prevents resource leaks.

    ```java
    try (var reader = new BufferedReader(new FileReader("data.txt"));
         var writer = new BufferedWriter(new FileWriter("out.txt"))) {
        writer.write(reader.readLine());
    }  // reader and writer are automatically closed in reverse order
    ```

    Suppressed exceptions (from `close()`) are attached to the primary exception via `getSuppressed()`.

??? question "Q31: Checked vs unchecked exceptions?"

    **Answer:** **Checked exceptions** (`IOException`, `SQLException`) are verified at compile time; the method must declare them with `throws` or handle them in a `catch` block. **Unchecked exceptions** (`NullPointerException`, `IllegalArgumentException`) extend `RuntimeException` and are not required to be declared or caught.

    ```
    Throwable
    ├── Error (unchecked) -- OutOfMemoryError, StackOverflowError
    └── Exception (checked)
        ├── IOException, SQLException, ...
        └── RuntimeException (unchecked)
            ├── NullPointerException
            ├── IllegalArgumentException
            └── IndexOutOfBoundsException
    ```

    Rule of thumb: use checked exceptions for recoverable conditions and unchecked exceptions for programming errors.

??? question "Q32: ClassNotFoundException vs NoClassDefFoundError?"

    **Answer:** `ClassNotFoundException` is a **checked exception** thrown when a class is loaded dynamically at runtime via `Class.forName()`, `ClassLoader.loadClass()`, etc., and the `.class` file is not found on the classpath. `NoClassDefFoundError` is an **Error** thrown when a class was available at compile time but is missing at runtime, or when static initialization of the class failed. The first is recoverable; the second typically is not.

    ```java
    // ClassNotFoundException -- dynamic loading fails
    try {
        Class.forName("com.example.Missing");
    } catch (ClassNotFoundException e) { /* recoverable */ }

    // NoClassDefFoundError -- class existed at compile time but missing at runtime
    // Commonly caused by missing JAR in the classpath or failed static initializer
    ```

??? question "Q33: StackOverflowError vs OutOfMemoryError?"

    **Answer:** `StackOverflowError` occurs when the **call stack** exceeds its limit, usually due to infinite or excessively deep recursion. `OutOfMemoryError` occurs when the **heap** (or other memory area) is exhausted and the GC cannot free enough space. Both extend `Error` (not `Exception`) and typically indicate unrecoverable conditions. Stack size can be tuned with `-Xss`; heap size with `-Xmx`.

??? question "Q34: What is the difference between Error and Exception?"

    **Answer:** Both extend `Throwable`. **Errors** (`OutOfMemoryError`, `StackOverflowError`, `NoClassDefFoundError`) represent serious JVM-level or system-level problems that applications should generally not try to catch or recover from. **Exceptions** represent conditions that applications can reasonably anticipate and recover from. Exceptions further split into checked exceptions (compiler-enforced handling) and unchecked/runtime exceptions (optional handling).

    | Aspect | Error | Exception |
    |--------|-------|-----------|
    | Recovery | Usually unrecoverable | Recoverable |
    | Cause | JVM / system failure | Application logic |
    | Examples | `OutOfMemoryError`, `StackOverflowError` | `IOException`, `NullPointerException` |
    | Should catch? | Rarely | Yes (checked) / Depends (unchecked) |

??? question "Q35: Difference between throw and throws?"

    **Answer:** `throw` is used inside a method to **explicitly throw an exception** object. `throws` is used in the method signature to **declare** that the method may throw one or more checked exceptions, pushing the responsibility to the caller.

    ```java
    void validate(int age) throws IllegalArgumentException {
        if (age < 0) throw new IllegalArgumentException("Age cannot be negative");
    }
    ```

??? question "Q36: What are best practices for custom exceptions?"

    **Answer:**

    1. Extend `RuntimeException` for programming errors (unchecked) or `Exception` for recoverable conditions (checked).
    2. Provide meaningful names that describe the problem (e.g., `InsufficientFundsException`).
    3. Include constructors for message, cause, and both (`super(message, cause)`).
    4. Keep exceptions serializable (they extend `Throwable`, which is `Serializable`).
    5. Do not use exceptions for flow control -- they are expensive due to stack trace capture.
    6. Add domain-specific fields (e.g., error codes) when helpful.

    ```java
    public class OrderNotFoundException extends RuntimeException {
        private final String orderId;

        public OrderNotFoundException(String orderId) {
            super("Order not found: " + orderId);
            this.orderId = orderId;
        }

        public OrderNotFoundException(String orderId, Throwable cause) {
            super("Order not found: " + orderId, cause);
            this.orderId = orderId;
        }

        public String getOrderId() { return orderId; }
    }
    ```

??? question "Q37: How does the instanceof operator work?"

    **Answer:** `instanceof` checks if an object is an instance of a particular class or implements a particular interface. It returns `false` for `null`. Since Java 16, **pattern matching for instanceof** eliminates the need for explicit casting.

    ```java
    // Traditional
    if (obj instanceof String) {
        String s = (String) obj;
        System.out.println(s.length());
    }

    // Java 16+ pattern matching
    if (obj instanceof String s) {
        System.out.println(s.length());  // s is already cast
    }
    ```

??? question "Q38: What is the Reflection API?"

    **Answer:** The Reflection API (`java.lang.reflect`) allows you to inspect and manipulate classes, methods, fields, and constructors at **runtime**. You can create instances, invoke methods, and access private fields dynamically. Use cases include frameworks (Spring, Hibernate), serialization libraries, and testing tools. Drawbacks: breaks encapsulation, bypasses compile-time type checking, has performance overhead, and conflicts with module system restrictions (Java 9+).

    ```java
    Class<?> clazz = Class.forName("com.example.User");
    Method m = clazz.getDeclaredMethod("getName");
    m.setAccessible(true);
    Object result = m.invoke(userInstance);
    ```

??? question "Q39: Describe the Java compilation and execution process."

    **Answer:**

    1. **Write** source code in `.java` files.
    2. **Compile** with `javac` -- produces platform-independent `.class` files (bytecode).
    3. **Class loading** -- the ClassLoader loads `.class` files into the JVM.
    4. **Bytecode verification** -- the verifier checks for illegal code.
    5. **Execution** -- the interpreter runs bytecode line by line; the **JIT compiler** identifies hot methods and compiles them to native machine code for performance.

??? question "Q40: Heap vs Stack memory in Java?"

    **Answer:**

    | Feature | Stack | Heap |
    |---------|-------|------|
    | Stores | Method frames, local variables, references | Objects and instance variables |
    | Lifetime | Per-thread, freed when method returns | Managed by GC |
    | Speed | Fast (LIFO allocation) | Slower (dynamic allocation) |
    | Thread safety | Thread-private | Shared across threads |
    | Size | Small (tuned via `-Xss`) | Large (tuned via `-Xms`/`-Xmx`) |
    | Error | `StackOverflowError` | `OutOfMemoryError` |

??? question "Q41: Explain Strong, Weak, Soft, and Phantom references."

    **Answer:**

    - **Strong** -- default (`Object obj = new Object()`). Never collected while reachable.
    - **Soft** (`SoftReference`) -- collected only when the JVM is low on memory. Good for caches.
    - **Weak** (`WeakReference`) -- collected at the next GC cycle regardless of memory. Used by `WeakHashMap`.
    - **Phantom** (`PhantomReference`) -- enqueued in a `ReferenceQueue` after the object is finalized but before memory is reclaimed. Used for cleanup actions as a safer alternative to `finalize()`.

    ```java
    // Soft reference -- cache-friendly
    SoftReference<byte[]> cache = new SoftReference<>(new byte[1024 * 1024]);
    byte[] data = cache.get();  // may return null if GC reclaimed it

    // Weak reference -- does not prevent GC
    WeakReference<MyObject> weakRef = new WeakReference<>(new MyObject());
    MyObject obj = weakRef.get();  // null after next GC cycle
    ```

    Strength order: Strong > Soft > Weak > Phantom.

??? question "Q42: When is an object eligible for garbage collection?"

    **Answer:** An object becomes eligible for GC when it is **unreachable** -- no live thread holds a strong reference to it. Common ways:

    1. Assigning `null` to the reference.
    2. Reassigning the reference to another object.
    3. Objects created inside a method become eligible after the method returns.
    4. **Island of isolation** -- a group of objects referencing each other but unreachable from any GC root.

    ```java
    Object a = new Object();  // object 1 created
    Object b = new Object();  // object 2 created
    a = b;                    // object 1 is now eligible for GC
    a = null;
    b = null;                 // object 2 is now eligible for GC
    ```

??? question "Q43: How can memory leaks occur in Java?"

    **Answer:** Despite garbage collection, leaks happen when objects are **unintentionally retained** -- still reachable but no longer needed. Common causes:

    1. **Static collections** that grow unbounded (`static List<Object> cache`).
    2. **Unclosed resources** (database connections, streams, sockets).
    3. **Listeners/callbacks** not deregistered after use.
    4. **Non-static inner classes** holding implicit references to outer class instances.
    5. **ClassLoader leaks** in application servers during redeployment.
    6. **`ThreadLocal` values** not removed after use in thread pools.
    7. **Broken `equals()`/`hashCode()`** in `HashMap` keys preventing entry removal.

    Tools for detection: VisualVM, Eclipse MAT, JFR (Java Flight Recorder), and heap dump analysis.

??? question "Q44: final vs finally vs finalize?"

    **Answer:**

    - **`final`** -- keyword to declare constants, prevent method overriding, or prevent class extension.
    - **`finally`** -- block that always executes after `try`/`catch`, used for cleanup (closing resources). It does not execute only if the JVM exits (`System.exit()`) or the thread is killed.
    - **`finalize()`** -- deprecated method called by the GC before reclaiming an object. Unreliable and should not be used.

    ```java
    final String name = "Java";            // final variable

    try {
        riskyOperation();
    } catch (Exception e) {
        log(e);
    } finally {
        cleanup();                         // always runs
    }

    // finalize() -- deprecated, do NOT use
    // @Override protected void finalize() throws Throwable { ... }
    ```

    These three are unrelated despite the similar names -- a classic trick question in interviews.

??? question "Q45: Can we override static, private, or final methods?"

    **Answer:**

    - **`static` methods** -- cannot be overridden. A subclass can declare a static method with the same signature, but this is **method hiding**, not overriding. The call is resolved at compile time based on the reference type.
    - **`private` methods** -- cannot be overridden because they are not visible to subclasses. A subclass can define a method with the same name, but it is a completely independent method.
    - **`final` methods** -- cannot be overridden. The compiler enforces this, and the JVM can inline final methods for performance.

    ```java
    class Parent {
        static void staticMethod() { System.out.println("Parent static"); }
        private void privateMethod() { System.out.println("Parent private"); }
        final void finalMethod() { System.out.println("Parent final"); }
    }

    class Child extends Parent {
        static void staticMethod() { System.out.println("Child static"); }  // hiding, NOT overriding
        void privateMethod() { System.out.println("Child independent"); }   // new method, NOT overriding
        // void finalMethod() { }  // compile error!
    }
    ```

??? question "Q46: Anonymous classes vs lambdas?"

    **Answer:**

    | Feature | Anonymous Class | Lambda |
    |---------|----------------|--------|
    | Can implement interface with multiple abstract methods | Yes | No (SAM/functional interface only) |
    | Has its own `this` | Yes | No (`this` refers to enclosing class) |
    | Can have state (fields) | Yes | No |
    | Compiled to | Separate `.class` file | `invokedynamic` bytecode |
    | Verbosity | Verbose | Concise |

    ```java
    // Anonymous class
    Runnable r1 = new Runnable() {
        @Override public void run() { System.out.println("anon"); }
    };
    // Lambda
    Runnable r2 = () -> System.out.println("lambda");
    ```

??? question "Q47: What is the var keyword (Java 10+)?"

    **Answer:** `var` enables **local variable type inference**. The compiler infers the type from the initializer. It can only be used for local variables with an initializer -- not for fields, method parameters, or return types. The variable is still **statically typed**; `var` is just syntactic sugar.

    ```java
    var list = new ArrayList<String>();   // inferred as ArrayList<String>
    var stream = list.stream();           // inferred as Stream<String>
    // var x;                             // error -- no initializer
    // var y = null;                      // error -- cannot infer type
    ```

??? question "Q48: What are Record classes (Java 16+)?"

    **Answer:** Records are a concise way to declare **immutable data carriers**. The compiler auto-generates `equals()`, `hashCode()`, `toString()`, a canonical constructor, and accessor methods. Records are implicitly `final` and extend `java.lang.Record`.

    ```java
    public record Point(int x, int y) { }

    // Usage
    var p = new Point(3, 4);
    System.out.println(p.x());       // 3 (accessor, not getX())
    System.out.println(p);           // Point[x=3, y=4]
    ```

    Records can have compact constructors for validation, static methods, and implement interfaces, but cannot extend other classes.

??? question "Q49: What are Sealed classes (Java 17+)?"

    **Answer:** Sealed classes restrict which classes can extend them using the `permits` clause. This gives the developer **explicit control over the class hierarchy** and enables exhaustive pattern matching in `switch` expressions.

    ```java
    public sealed class Shape permits Circle, Rectangle, Triangle { }

    public final class Circle extends Shape { }
    public sealed class Rectangle extends Shape permits Square { }
    public non-sealed class Triangle extends Shape { }  // open for further extension
    public final class Square extends Rectangle { }
    ```

    Permitted subclasses must be `final`, `sealed`, or `non-sealed`.

??? question "Q50: What are Text blocks (Java 15+)?"

    **Answer:** Text blocks provide a clean way to write **multi-line string literals** using triple quotes (`"""`). They preserve line breaks, handle indentation via common leading whitespace removal, and eliminate the need for escape sequences in JSON, SQL, HTML, etc.

    ```java
    String json = """
            {
                "name": "Vamsi",
                "role": "Developer"
            }
            """;

    String query = """
            SELECT id, name
            FROM users
            WHERE active = true
            """;
    ```

    You can use `\` at the end of a line to suppress the newline character.
