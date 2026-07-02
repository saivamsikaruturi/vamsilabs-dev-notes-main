---
title: "Top 50 Core Java Interview Questions & Answers (2026)"
description: "This page is a rapid-fire reference for the most frequently asked Core Java interview questions. Each answer is kept concise yet complete enough to use..."
---

# Top 50 Core Java Interview Questions & Answers

This page is a rapid-fire reference for the most frequently asked **Core Java** interview questions. Each answer is kept concise yet complete enough to use in a real interview. Expand any question to reveal the answer. Use this as a last-minute revision guide or a self-assessment checklist before your next Java interview.

---

??? question "Q1: What is the difference between JDK, JRE, and JVM?"

    JDK, JRE, and JVM are three nested layers of the Java platform -- JDK contains JRE, which contains JVM.

    **Why:** This layered architecture separates concerns -- developers need compilation tools, end-users only need the runtime, and the JVM handles the actual execution abstraction across platforms.

    **How:** **JVM** is the runtime engine that loads bytecode, verifies it, and either interprets or JIT-compiles it to native instructions. **JRE** bundles the JVM with core libraries (`java.lang`, `java.util`, `rt.jar`) needed to run programs. **JDK** adds development tools (`javac`, `jdb`, `javadoc`, `jlink`, etc.) on top of the JRE.

    ```
    JDK  ⊃  JRE  ⊃  JVM
    ```

    **When to use:** Deploying a production server? You technically only need a JRE (or a custom runtime image via `jlink` since Java 9). Developing or debugging? You need the JDK. Note: since Java 11, Oracle no longer ships a standalone JRE -- the JDK is the default distribution.

    **Gotchas:** Many developers conflate JRE and JVM. The JVM alone cannot run your app -- it needs the standard library classes bundled in the JRE. Also, different JDK vendors (Oracle, Eclipse Temurin, Amazon Corretto) have subtle differences in garbage collectors, flight recorder availability, and licensing.

??? question "Q2: How does Java achieve platform independence?"

    Java achieves "write once, run anywhere" by compiling to platform-neutral bytecode that any JVM can execute.

    **Why:** Before Java, C/C++ code had to be recompiled for every target OS/architecture. Java introduced an abstraction layer (the JVM) so a single compiled artifact works everywhere.

    **How:** The compiler (`javac`) produces `.class` files containing bytecode -- an intermediate instruction set for the JVM. At runtime, each platform's JVM either interprets the bytecode or JIT-compiles hot paths to native machine code. The JIT compiler (C1/C2 in HotSpot) makes Java competitive with native languages for long-running processes.

    ```
    .java  ──javac──▶  .class (bytecode)  ──▶  JVM (Windows / Linux / macOS)  ──▶  Native code
    ```

    **When to use:** This matters when you ship a single JAR/container image that runs across dev (macOS), CI (Linux), and prod (Linux/ARM). Platform independence also simplifies library distribution.

    **Gotchas:** Java is platform-independent at the bytecode level, but platform-dependent at the JVM level -- each OS needs its own JVM binary. Native method calls via JNI break portability. File path separators, line endings, and `Runtime.exec()` commands can also introduce OS-specific bugs if you are not careful.

??? question "Q3: Why is Java not 100% object-oriented?"

    Java is not purely object-oriented because it retains eight primitive types that are not objects.

    **Why:** Pure OOP (like Smalltalk) treats everything as an object. Java deliberately introduced primitives for raw performance -- avoiding heap allocation and pointer indirection for simple arithmetic operations. This was a pragmatic trade-off at Java's inception in 1995.

    **How:** The eight primitives (`int`, `byte`, `short`, `long`, `float`, `double`, `char`, `boolean`) live on the stack, have no methods, and do not extend `Object`. Additionally, `static` members belong to the class rather than an instance, which violates "everything is an object that receives messages." Wrapper classes (`Integer`, `Boolean`, etc.) bridge the gap when objects are required (e.g., generics, collections).

    **When to use:** Use primitives for performance-critical code (tight loops, large arrays). Use wrappers when you need nullability, generics (`List<Integer>`), or object identity.

    **Gotchas:** Project Valhalla (value types) aims to close this gap by allowing user-defined types with primitive-like performance. Autoboxing hides the primitive/object distinction but introduces subtle bugs: `Integer a = null; int b = a;` throws `NullPointerException`. Also, `==` on boxed types compares references outside the cached range (-128 to 127).

??? question "Q4: What is the significance of the main() method?"

    The `main()` method is the JVM's well-known entry point -- the first user code that executes in a standalone Java application.

    **Why:** The JVM needs a deterministic starting point without requiring object instantiation (since no objects exist yet at startup). Making it `static` avoids the chicken-and-egg problem of needing an object to call a method before any objects are created.

    **How:** Signature: `public static void main(String[] args)`. The JVM locates the class specified on the command line, loads it, and invokes this exact method signature reflectively. `public` -- accessible to the JVM launcher from outside the class. `static` -- callable without instantiation. `void` -- the JVM uses `System.exit(code)` for exit status, not a return value. `String[] args` -- receives command-line arguments.

    **When to use:** Every standalone application needs one. In frameworks (Spring Boot, Quarkus), the `main()` typically just bootstraps the framework's container. Since Java 21 (preview), unnamed classes and instance main methods simplify entry points for beginners.

    **Gotchas:** Overloading `main` is legal but only the canonical signature is called by the JVM. If you forget `static`, you get `Main method is not static`. Also, `main` in an inner class will not be found by the launcher -- only top-level or static nested classes qualify.

??? question "Q5: Explain the static keyword (variable, method, block, nested class)."

    The `static` keyword means "belongs to the class itself, not to any instance" -- it is the Java mechanism for class-level state and behavior.

    **Why:** Sometimes you need shared state (counters, caches) or utility methods (factory methods, helpers) that do not depend on instance state. `static` avoids forcing callers to instantiate objects just to call a utility function.

    **How:**

    - **Static variable** -- one copy shared across all instances; stored in metaspace. Initialized when the class is loaded.
    - **Static method** -- called via `ClassName.method()`; cannot access `this` or instance members directly (no implicit receiver).
    - **Static block** -- runs once during class loading, in declaration order; used for complex static initialization (e.g., loading native libraries, populating lookup maps).
    - **Static nested class** -- does not hold an implicit reference to the enclosing instance, so it can be instantiated independently.

    ```java
    class Demo {
        static int count;                       // static variable
        static { count = 0; }                   // static block
        static void increment() { count++; }    // static method
        static class Helper { }                 // static nested class
    }
    ```

    **When to use:** Utility/helper classes (`Math`, `Collections`), constants, singleton holders, factory methods, and counters.

    **Gotchas:** Static variables create hidden global state that makes testing and concurrency harder. Static methods cannot be overridden (only hidden). Static blocks that throw exceptions cause `ExceptionInInitializerError` and the class becomes permanently unusable (`NoClassDefFoundError` on subsequent access).

??? question "Q6: Explain the final keyword (variable, method, class)."

    The `final` keyword is Java's immutability and extensibility lock -- once set, it cannot be changed or overridden.

    **Why:** `final` communicates design intent: "this value/behavior/type is not meant to change." It enables compiler optimizations (inlining final methods), thread-safety guarantees (final fields in constructors have safe publication semantics under the Java Memory Model), and prevents fragile base class problems.

    **How:**

    - **Final variable** -- must be assigned exactly once. For primitives, it is a true constant. For references, the reference cannot be reassigned, but the object's internal state can still be mutated.
    - **Final method** -- cannot be overridden by subclasses. The JVM may inline these for performance.
    - **Final class** -- cannot be extended (e.g., `String`, `Integer`, `System`). Prevents subclass-based hacks.

    ```java
    final int MAX = 100;          // constant
    final List<String> list = new ArrayList<>();
    list.add("ok");               // allowed -- mutating the object
    // list = new ArrayList<>();  // compile error -- reassigning the reference
    ```

    **When to use:** Method parameters you do not want reassigned, immutable value objects, constants (`static final`), and classes that must not be subclassed for security or correctness (e.g., `String`).

    **Gotchas:** `final` does not mean deeply immutable -- a `final List` can still have elements added/removed. Blank finals (declared without initializer) must be assigned in every constructor path. Overuse of `final` on local variables is style-dependent; some teams enforce it via linters, others find it noisy.

??? question "Q7: What is the difference between == and .equals()?"

    `==` checks identity (same memory address), while `.equals()` checks logical equivalence (same meaningful content).

    **Why:** Java needs both because objects have two notions of "sameness" -- are these the exact same object in memory (identity), or do they represent the same value (equivalence)? Primitives only have value semantics, so `==` works directly on them.

    **How:** For objects, `==` compares the reference (pointer) stored on the stack. `Object.equals()` by default also does reference comparison (`return this == obj`), but classes override it to define meaningful equality. For example, `String.equals()` compares char-by-char, `Integer.equals()` compares the int value.

    ```java
    String a = new String("hello");
    String b = new String("hello");
    System.out.println(a == b);       // false (different objects)
    System.out.println(a.equals(b));  // true  (same content)
    ```

    **When to use:** Use `==` for primitives, enum constants, and deliberate identity checks (e.g., checking for `null`). Use `.equals()` for all object value comparisons. In modern Java, prefer `Objects.equals(a, b)` to avoid NPEs.

    **Gotchas:** String literals are interned, so `"hello" == "hello"` is `true` -- this misleads beginners into thinking `==` works for strings. Integer caching (-128 to 127) creates a similar trap. Never use `==` on wrapper types for value comparison. Also, if you override `equals()`, you must override `hashCode()` to maintain the contract.

??? question "Q8: What is the hashCode() contract?"

    The `hashCode()` contract ties hash codes to `equals()` -- equal objects must produce the same hash, ensuring hash-based collections work correctly.

    **Why:** `HashMap`, `HashSet`, and `Hashtable` use hash codes to determine bucket placement. If two logically equal objects produce different hashes, they land in different buckets and the collection "loses" entries -- `map.get(key)` fails even though an equal key exists.

    **How:** The contract: (1) If `a.equals(b)` then `a.hashCode() == b.hashCode()` -- mandatory. (2) Same hash code does not imply equality (collisions are allowed). (3) `hashCode()` must be consistent within a single execution if no fields used in the computation change.

    ```java
    @Override
    public int hashCode() {
        return Objects.hash(firstName, lastName, age);  // consistent with equals()
    }
    ```

    **When to use:** Always override `hashCode()` when you override `equals()`. Use the same fields in both. For records (Java 16+), both are auto-generated correctly.

    **Gotchas:** Overriding `equals()` without `hashCode()` is the number-one contract violation -- objects that are `.equals()` true end up in different buckets. Using mutable fields in `hashCode()` is another trap: if a field changes after insertion into a `HashSet`, the object becomes unreachable in its bucket, causing a silent memory leak. Also, a constant hash (`return 1`) is legal but degrades all hash collections to O(n) linked lists.

??? question "Q9: Is Java pass-by-value or pass-by-reference?"

    Java is **always pass-by-value** -- even for objects, it passes a copy of the reference, not the reference itself.

    **Why:** This is one of the most misunderstood aspects of Java. People see that you can mutate an object inside a method and assume it is pass-by-reference. The distinction matters: you can modify what a reference points *to*, but you cannot make the caller's variable point *somewhere else*.

    **How:** For primitives, the actual value is copied into the method's stack frame. For objects, the reference (essentially a pointer/address) is copied by value. The method gets its own copy of the pointer. Both point to the same heap object, so mutations via the copy are visible. But reassigning the local copy does not affect the caller's original reference.

    ```java
    void change(StringBuilder sb) {
        sb.append(" world");     // mutates the original object -- visible to caller
        sb = new StringBuilder("new");  // reassigns local copy -- caller unaffected
    }
    ```

    **When to use:** Understanding this prevents confusion when writing methods that swap variables, reassign parameters, or attempt to "null out" a caller's reference from inside a helper.

    **Gotchas:** You cannot write a generic `swap(a, b)` method in Java (unlike C++ with pass-by-reference). If you pass an immutable object (like `String` or `Integer`), there is no way for the method to alter the caller's state. The term "pass-by-reference" is technically wrong in Java -- even languages like C# require an explicit `ref` keyword for true pass-by-reference.

??? question "Q10: What is autoboxing/unboxing? Explain Integer caching."

    Autoboxing silently wraps primitives into objects; unboxing unwraps them back -- and Integer caching makes `==` unreliable beyond -128 to 127.

    **Why:** Generics in Java work only with objects (`List<Integer>`, not `List<int>`). Autoboxing (Java 5+) removes the boilerplate of manual `Integer.valueOf(x)` and `.intValue()` calls, making collections and streams work seamlessly with numeric types.

    **How:** The compiler inserts `Integer.valueOf(n)` for autoboxing and `.intValue()` for unboxing. `Integer.valueOf()` returns cached instances for values in [-128, 127] (configurable with `-XX:AutoBoxCacheMax`). Outside that range, a new `Integer` object is heap-allocated each time.

    ```java
    Integer a = 127, b = 127;
    System.out.println(a == b);    // true  (cached)

    Integer x = 128, y = 128;
    System.out.println(x == y);    // false (different objects)
    System.out.println(x.equals(y)); // true
    ```

    **When to use:** Autoboxing is convenient for collections, Optional, and stream operations. Prefer primitives in performance-critical loops to avoid allocation pressure.

    **Gotchas:** Unboxing `null` throws `NullPointerException` -- a frequent surprise (`Integer count = null; int x = count;` blows up). In tight loops, accidental autoboxing creates millions of garbage objects (use `IntStream` instead of `Stream<Integer>`). Never compare wrapper types with `==` -- always use `.equals()` or unbox first. The `Boolean`, `Byte`, `Short`, `Long` (-128 to 127), and `Character` (0 to 127) caches follow similar rules.

??? question "Q11: Why is String immutable in Java?"

    String is immutable because it serves as the backbone of security, hashing, and memory optimization in the JVM -- mutability would break all three.

    **Why:** Strings are everywhere: class names, URLs, file paths, database queries, map keys. If a `String` could be mutated after creation, a security manager check on a file path could pass, and then the path could be changed before the actual file operation -- a classic TOCTOU vulnerability.

    **How:** The `String` class is declared `final` (cannot be subclassed) with a `private final byte[]` (since Java 9, compact strings) backing array that is never exposed. No method modifies the internal array; methods like `concat()` and `substring()` return new `String` objects. The class also caches `hashCode` lazily -- computed once, reused forever.

    **When to use:** Use `String` for any text that should not change: constants, keys, identifiers. For text manipulation (building SQL, logging, formatting), use `StringBuilder` to avoid creating dozens of intermediate `String` objects.

    **Gotchas:** Immutability enables the String pool, but `new String("x")` bypasses the pool -- creating a redundant heap object. Sensitive data (passwords) stored as `String` lingers in the pool and heap until GC and cannot be zeroed out; use `char[]` and clear it manually. Since Java 9, compact strings store Latin-1 characters in one byte per char, but the immutability guarantee remains the same.

??? question "Q12: String vs StringBuilder vs StringBuffer?"

    `String` is immutable, `StringBuilder` is mutable and fast, `StringBuffer` is mutable and synchronized -- use `StringBuilder` by default for building strings.

    **Why:** String concatenation in a loop creates O(n) intermediate objects because each `+` allocates a new `String`. Mutable builders avoid this by appending to an internal resizable array without creating throwaway objects.

    **How:**

    | Feature       | `String`       | `StringBuilder` | `StringBuffer` |
    |---------------|---------------|-----------------|----------------|
    | Mutability    | Immutable     | Mutable         | Mutable        |
    | Thread-safe   | Yes (immutable) | No            | Yes (synchronized) |
    | Performance   | Slow for concatenation | Fast   | Slower than StringBuilder |
    | Internal      | `byte[]` (final) | `byte[]` (resizable) | `byte[]` (resizable + locks) |

    Both builders start with capacity 16 and grow by doubling. `StringBuffer` synchronizes every method (`append`, `insert`, `delete`); `StringBuilder` does not.

    **When to use:** `StringBuilder` for single-threaded string building (99% of cases). `StringBuffer` only when multiple threads append to the same builder (extremely rare in practice -- prefer `StringBuilder` + external synchronization or thread-local builders). Use plain `String` for constants and simple expressions.

    **Gotchas:** The compiler optimizes `"a" + "b" + "c"` into a single constant at compile time, so concatenation of literals is free. However, concatenation inside a loop still creates intermediate objects in older Java versions (Java 9+ uses `invokedynamic`-based `StringConcatFactory` which is smarter). `StringBuffer` is essentially legacy -- you almost never need it in modern Java.

??? question "Q13: What is the String pool?"

    The String pool is a JVM-managed hash table of unique string instances that eliminates duplicate string objects to save memory.

    **Why:** Applications create enormous numbers of strings, many of which are identical (log messages, column names, status codes). Without pooling, each duplicate would waste heap space. The pool guarantees that identical literals share a single object.

    **How:** The pool lives in the main heap (moved from PermGen in Java 7). When the compiler encounters a string literal (`"hello"`), it emits a reference to the pool entry. At class loading, the JVM checks if that string already exists in the pool -- if yes, it reuses the reference; if no, it creates a new entry. `new String("hello")` always allocates a separate heap object. `String.intern()` manually adds a string to the pool (or returns the existing pooled instance).

    ```java
    String s1 = "hello";              // goes to pool
    String s2 = "hello";              // reuses same pool object
    String s3 = new String("hello");  // new heap object (pool NOT used)

    System.out.println(s1 == s2);            // true  (same pool reference)
    System.out.println(s1 == s3);            // false (different objects)
    System.out.println(s1 == s3.intern());   // true  (intern returns pool reference)
    ```

    **When to use:** Rely on the pool for literals automatically. Call `.intern()` explicitly when you have many duplicate dynamic strings (e.g., parsing CSV columns) and want to deduplicate.

    **Gotchas:** Calling `.intern()` aggressively can overwhelm the pool's internal hash table (tunable via `-XX:StringTableSize`) and actually hurt performance. Since Java 7, pooled strings are GC-eligible (unlike PermGen days). Also, `new String("abc")` creates two objects -- one in the pool (the literal) and one on the heap -- a common interview trick question.

??? question "Q14: What are marker interfaces?"

    A marker interface is an empty interface (no methods, no fields) that acts as a type-level tag to signal behavior to the JVM or frameworks.

    **Why:** Before annotations existed (pre-Java 5), there was no metadata mechanism. Marker interfaces provided a compile-time-checkable way to say "this class has a certain capability." They also enable `instanceof` checks at runtime, which annotations alone cannot provide without reflection.

    **How:** The JVM or framework checks `instanceof MarkerInterface` at runtime. For example, `ObjectOutputStream` checks `obj instanceof Serializable` before serializing; if false, it throws `NotSerializableException`. The interface itself declares nothing -- the mere act of implementing it is the signal.

    Classic examples: `Serializable` (enables serialization), `Cloneable` (permits `Object.clone()`), `Remote` (marks RMI endpoints), `RandomAccess` (signals O(1) index access to algorithms).

    **When to use:** Prefer annotations for pure metadata (`@Entity`, `@Deprecated`). Use marker interfaces when you need compile-time type safety -- e.g., restricting a method parameter to only accept serializable objects: `void send(Serializable payload)`. This cannot be done with annotations alone.

    **Gotchas:** `Cloneable` is a poorly designed marker -- implementing it does not actually override `clone()` for you, and `Object.clone()` is still `protected`. Since Java 5, annotations have largely replaced marker interfaces, but the old ones (`Serializable`, `Cloneable`) remain in the standard library for backward compatibility.

??? question "Q15: Explain Cloneable and Object cloning."

    `Object.clone()` performs a shallow, field-by-field copy of an object -- but only if the class implements the `Cloneable` marker interface.

    **Why:** Cloning provides a way to duplicate objects without knowing their concrete type at compile time. It predates copy constructors and was designed for polymorphic copying in inheritance hierarchies.

    **How:** `Object.clone()` is a `native` method that allocates new memory, copies all fields bit-for-bit (primitives by value, references by pointer), and returns the new object. If the class does not implement `Cloneable`, it throws `CloneNotSupportedException`. For deep copy, you override `clone()` and manually clone each mutable reference field.

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

    **When to use:** Honestly, rarely. Prefer **copy constructors** (`new Employee(original)`) or static factory methods. They are explicit, do not require implementing an interface, and do not rely on a fragile `super.clone()` chain.

    **Gotchas:** `clone()` bypasses constructors -- final fields cannot be reassigned in `clone()`, breaking deep copy. If any class in the hierarchy forgets to call `super.clone()`, the chain breaks. The return type is `Object`, requiring a cast. Arrays are the one place where `clone()` works cleanly: `int[] copy = original.clone()`. For everything else, Effective Java Item 13 recommends avoiding `Cloneable` entirely.

??? question "Q16: Comparable vs Comparator?"

    `Comparable` bakes a single natural ordering into the class; `Comparator` defines external, swappable orderings without modifying the class.

    **Why:** Objects need ordering for sorting, tree-based collections (`TreeMap`, `TreeSet`), and binary search. `Comparable` gives a class one "default" sort (e.g., `String` alphabetical, `Integer` numeric). `Comparator` lets you sort the same objects differently in different contexts (by name, by salary, by date) without changing the class itself.

    **How:** `Comparable<T>` lives inside the class -- you implement `compareTo(T o)` returning negative/zero/positive. `Comparator<T>` is a separate functional interface with `compare(T o1, T o2)`. Java 8+ added powerful factory methods: `Comparator.comparing()`, `thenComparing()`, `reversed()`.

    ```java
    // Comparable -- natural order
    class Employee implements Comparable<Employee> {
        public int compareTo(Employee o) { return this.name.compareTo(o.name); }
    }

    // Comparator -- custom order
    Comparator<Employee> bySalary = Comparator.comparingDouble(Employee::getSalary);
    employees.sort(bySalary);
    ```

    **When to use:** Implement `Comparable` when there is an obvious natural ordering (dates, numbers, IDs). Use `Comparator` for secondary sort criteria, UI-specific orderings, or when you do not own the class.

    **Gotchas:** `compareTo` must be consistent with `equals` for `TreeSet`/`TreeMap` to work correctly (if `a.compareTo(b) == 0`, then `a.equals(b)` should be `true`). Subtracting ints for comparison (`a.age - b.age`) overflows for extreme values -- use `Integer.compare(a, b)` instead. Also, `null` handling is not defined in `Comparable` -- use `Comparator.nullsFirst()` or `nullsLast()` when nulls are possible.

??? question "Q17: What is type casting (upcasting and downcasting)?"

    Upcasting widens a reference (child to parent, always safe and implicit); downcasting narrows it (parent to child, explicit and risky).

    **Why:** Polymorphism requires storing specific types in general-purpose variables (`List<Animal>`). Upcasting enables this. Downcasting is needed when you must access subclass-specific methods after retrieving an object from a general collection.

    **How:** Upcasting is done implicitly by the compiler -- no cast syntax needed. The reference loses access to subclass-specific methods but the actual object in memory remains unchanged. Downcasting requires an explicit cast `(SubType)`. At runtime, the JVM checks if the actual object's type is compatible; if not, it throws `ClassCastException`.

    ```java
    Animal a = new Dog();      // upcasting (implicit)
    Dog d = (Dog) a;           // downcasting (explicit, safe here)
    Cat c = (Cat) a;           // ClassCastException at runtime!
    ```

    **When to use:** Upcasting is used everywhere in polymorphic code (collections, method parameters). Downcasting typically appears when deserializing objects, working with legacy APIs that return `Object`, or in visitor patterns. Prefer generics over casting when possible.

    **Gotchas:** Always guard downcasts with `instanceof` (or pattern matching in Java 16+). The compiler cannot catch invalid downcasts -- they only fail at runtime. Casting between unrelated classes (e.g., `String` to `Integer`) is caught at compile time, but casting within an inheritance hierarchy is not. Also, generics are erased at runtime, so `(List<String>) obj` does not actually verify the element type -- only the raw `List` is checked.

??? question "Q18: Abstract class vs interface (Java 8+)?"

    An abstract class shares state and partial implementation across related types; an interface defines a capability contract that any unrelated class can adopt.

    **Why:** Java allows only single inheritance of classes but multiple inheritance of interfaces. This forces a design choice: use an abstract class when you want to share mutable state/constructors, use an interface when you want to define a contract that cuts across unrelated hierarchies (e.g., `Comparable`, `Serializable`).

    **How:**

    | Feature | Abstract Class | Interface |
    |---------|---------------|-----------|
    | Methods | Abstract + concrete | Abstract + `default` + `static` + `private` (Java 9+) |
    | Fields | Any fields | Only `public static final` constants |
    | Constructor | Yes | No |
    | Inheritance | Single (`extends`) | Multiple (`implements`) |
    | State | Can hold mutable state | Cannot hold instance state |

    Since Java 8, interfaces gained `default` methods (providing implementation without breaking existing implementors) and `static` methods. Java 9 added `private` helper methods within interfaces.

    **When to use:** Abstract class: template method pattern, shared initialization logic, evolving base with protected state (e.g., `AbstractList`). Interface: defining APIs, strategy/callback contracts, mixins, functional interfaces for lambdas.

    **Gotchas:** Default methods can cause the diamond problem (resolved by requiring the implementor to override). Adding an abstract method to an interface breaks all implementors; adding it to an abstract class does too -- but `default` methods allow non-breaking evolution. Do not use abstract classes just because you want to provide one shared method -- use an interface with a default method instead, preserving the class's single-inheritance slot.

??? question "Q19: What is the diamond problem and how does Java solve it?"

    The diamond problem is ambiguity when a class inherits the same method from two paths -- Java prevents it by forbidding multiple class inheritance and requiring explicit resolution for conflicting default methods.

    **Why:** In C++, a class can extend two classes that both define `void print()`, and the compiler cannot determine which one to call. This leads to ambiguous dispatch. Java's designers chose single class inheritance to eliminate this entirely, keeping the type system simple and predictable.

    **How:** With Java 8+ default methods, the diamond can resurface. If a class implements two interfaces that each provide a `default` method with the same signature, the compiler forces the class to override the conflicting method. You can delegate to a specific interface using `InterfaceName.super.method()`.

    Resolution rules: (1) Class methods always win over interface defaults. (2) More specific interfaces win (sub-interface overrides super-interface). (3) If still ambiguous, the implementing class must override.

    ```java
    interface A { default void greet() { System.out.println("A"); } }
    interface B { default void greet() { System.out.println("B"); } }

    class C implements A, B {
        @Override
        public void greet() { A.super.greet(); }  // explicit resolution
    }
    ```

    **When to use:** You encounter this when composing multiple interfaces with default methods (common in mixin-style designs). Understanding the resolution rules is critical for framework/library authors.

    **Gotchas:** If interface B extends interface A and overrides the default, then a class implementing only B gets B's version -- no conflict. But if a class extends a concrete class and implements an interface with a conflicting default, the class's inherited method always wins (class wins over interface rule). This surprises developers who expect the interface default to "enhance" the class.

??? question "Q20: Method overloading vs method overriding rules?"

    Overloading is compile-time polymorphism (same name, different parameters); overriding is runtime polymorphism (subclass replaces parent behavior with the same signature).

    **Why:** Overloading provides API convenience (e.g., `println(int)`, `println(String)`, `println(Object)` -- one intuitive name for related operations). Overriding enables the open-closed principle -- extend behavior without modifying existing code.

    **How:**

    **Overloading rules:** Same method name, different parameter list (type, count, or order). Return type alone does not distinguish overloads. Resolution happens at compile time based on the declared type of arguments.

    **Overriding rules:**

    - Same method name and exact parameter list.
    - Return type must be same or covariant (subclass type).
    - Access must be same or wider (`protected` -> `public` is fine, reverse is not).
    - Cannot throw new/broader checked exceptions (can throw fewer or narrower).
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

    **When to use:** Overload for convenience variants (with/without optional params). Override to specialize behavior in subclasses (strategy, template method).

    **Gotchas:** Overloading with autoboxing creates surprising dispatch: `remove(int index)` vs `remove(Object o)` in `List` -- passing an `int` calls the index version, not the object version. The `@Override` annotation is not required but catches typos at compile time. Varargs (`String...`) and overloading together create ambiguous scenarios the compiler cannot always resolve cleanly.

??? question "Q21: What are covariant return types?"

    Covariant return types let an overriding method declare a more specific return type than the parent -- avoiding unnecessary casts for callers.

    **Why:** Before Java 5, overriding `clone()` or factory methods forced you to return the parent type, making callers cast: `Dog d = (Dog) animal.create()`. Covariant returns eliminate this cast by allowing the override to promise a narrower type.

    **How:** The compiler generates a synthetic bridge method that returns the parent type and delegates to your narrower-typed method. This preserves binary compatibility with old bytecode that expects the parent return type while giving compile-time type safety to new code. Only the return type can vary -- parameter types must match exactly for overriding.

    ```java
    class Animal {
        Animal create() { return new Animal(); }
    }
    class Dog extends Animal {
        @Override
        Dog create() { return new Dog(); }  // covariant return -- Dog is a subtype of Animal
    }
    ```

    **When to use:** Factory methods, `clone()`, builder patterns, and fluent APIs where returning `this` in subclasses should reflect the actual subclass type. It is especially useful in hierarchical builders (`DogBuilder extends AnimalBuilder`).

    **Gotchas:** Covariant returns only work for return types, not parameter types (parameters must be invariant for overriding). Primitive types do not participate -- `int` is not a subtype of `long`. The bridge method can appear in stack traces and reflection, which confuses debugging. Also, this feature works only for class/interface types; you cannot narrow `Object` to `int`.

??? question "Q22: What is the scope of each access modifier?"

    Java has four access levels -- `private`, default (package-private), `protected`, and `public` -- each progressively widening visibility.

    **Why:** Encapsulation is the core OOP principle. Access modifiers enforce information hiding, letting you expose a stable public API while keeping internals free to change. Choosing the narrowest sufficient access reduces coupling and attack surface.

    **How:**

    | Modifier    | Class | Package | Subclass (diff pkg) | World |
    |-------------|:-----:|:-------:|:-------------------:|:-----:|
    | `private`   | Yes   | No      | No                  | No    |
    | (default)   | Yes   | Yes     | No                  | No    |
    | `protected` | Yes   | Yes     | Yes                 | No    |
    | `public`    | Yes   | Yes     | Yes                 | Yes   |

    Top-level classes can only be `public` or package-private. `private` and `protected` apply only to members and nested classes. The module system (Java 9+) adds another layer -- even `public` types are inaccessible outside their module unless explicitly exported.

    **When to use:** Start with `private` and widen only as needed. Use package-private for internal helpers within the same package. Use `protected` sparingly -- only for extension points in designed-for-inheritance classes. Use `public` for your API surface.

    **Gotchas:** `protected` is wider than most people think -- it is accessible from the entire package, not just subclasses. A common mistake is making fields `protected` for testing; prefer package-private or test utilities instead. In the module system, a `public` class in a non-exported package is effectively package-private to the outside world.

??? question "Q23: What is the difference between transient and volatile?"

    `transient` excludes a field from serialization; `volatile` guarantees cross-thread visibility -- they solve completely different problems despite both being field modifiers.

    **Why:** `transient` exists because some fields should not be persisted (passwords, cached values, derived state). `volatile` exists because the Java Memory Model allows threads to cache field values in CPU registers/L1 cache -- without `volatile`, one thread's write may never be seen by another thread.

    **How:** `transient` -- during serialization (`ObjectOutputStream`), transient fields are skipped; on deserialization, they get their type's default value (`null`, `0`, `false`). `volatile` -- every read goes to main memory, every write flushes to main memory. It also establishes a happens-before relationship (prevents instruction reordering around the volatile access). However, it does NOT provide atomicity for compound operations like `count++`.

    ```java
    class User implements Serializable {
        private String name;
        private transient String password;  // not serialized
    }

    class SharedFlag {
        private volatile boolean running = true;  // visible across threads immediately
    }
    ```

    **When to use:** `transient` -- sensitive data, non-serializable fields (loggers, locks), cached/derived values. `volatile` -- simple flags (stop signals), double-checked locking's instance field, publishing immutable objects across threads.

    **Gotchas:** `transient` fields are lost silently -- if you forget to reinitialize them after deserialization, you get `NullPointerException`. Use `readObject()` for custom reinitialization. For `volatile`, `count++` is still a race (read-increment-write is three operations). Use `AtomicInteger` or `synchronized` for compound atomicity. Also, `volatile long`/`double` guarantees atomic read/write on 32-bit JVMs where these are normally non-atomic.

??? question "Q24: Explain this vs super keyword."

    `this` refers to the current instance; `super` refers to the parent class -- both are used to disambiguate and chain constructors/methods up the hierarchy.

    **Why:** Without `this`, there is no way to distinguish a field from a same-named parameter. Without `super`, there is no way to access a parent method that has been overridden or to invoke the parent's constructor for initialization.

    **How:** `this.field` -- resolves field/parameter name conflicts. `this(args)` -- constructor chaining within the same class (must be first statement). `this` as argument -- passes the current object to another method. `super.method()` -- calls the parent's version of an overridden method. `super(args)` -- invokes a specific parent constructor (must be first statement). If you write neither `this()` nor `super()` in a constructor, the compiler inserts `super()` (no-arg parent constructor) implicitly.

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

    **When to use:** `this` in constructors for chaining overloaded constructors (telescope pattern). `super` in constructors to pass required initialization to the parent. `super.method()` inside an override when you want to extend rather than replace the parent's behavior.

    **Gotchas:** `this()` and `super()` cannot both appear in the same constructor (both must be the first statement). If the parent has no no-arg constructor and you do not call `super(args)` explicitly, compilation fails. In static contexts, `this` and `super` are not available. Also, `super` does not support "grandparent" access -- `super.super.method()` is illegal in Java.

??? question "Q25: Static binding vs dynamic binding?"

    Static binding resolves method calls at compile time; dynamic binding defers resolution to runtime based on the actual object type -- this is the mechanism behind polymorphism.

    **Why:** Without dynamic binding, polymorphism would not work. When you call `animal.sound()` on a variable typed as `Animal` but holding a `Dog`, the JVM must dispatch to `Dog.sound()` at runtime. Static binding is used for methods where the target is unambiguous at compile time, enabling optimizations like inlining.

    **How:** Static binding applies to `static`, `private`, and `final` methods, as well as overloaded methods -- the compiler resolves these using the declared (reference) type. Dynamic binding applies to overridden instance methods -- the JVM uses the virtual method table (vtable) to look up the correct implementation based on the actual runtime object type.

    ```java
    class Animal { void sound() { System.out.println("..."); } }
    class Dog extends Animal { void sound() { System.out.println("Bark"); } }

    Animal a = new Dog();
    a.sound();   // "Bark" -- dynamic binding (resolved at runtime)
    ```

    **When to use:** You do not choose binding explicitly -- the language rules determine it. But understanding it helps you predict behavior: overloaded methods use the compile-time type of the arguments, while overridden methods use the runtime type of the receiver.

    **Gotchas:** A classic trap: overloaded methods are resolved statically. If you have `process(Animal a)` vs `process(Dog d)`, the compiler picks based on the declared type, not the runtime type. Developers expect runtime dispatch but get compile-time selection. Also, a `static` method in a subclass with the same signature as a parent's `static` method is hiding, not overriding -- calling via a parent-typed reference invokes the parent's version.

??? question "Q26: Shallow copy vs deep copy?"

    **Answer:** A **shallow copy** duplicates the top-level object but shares nested references; a **deep copy** recursively clones everything so the two object graphs are fully independent.

    **Why it matters:** Accidentally sharing mutable nested objects between copies leads to spooky-action-at-a-distance bugs -- you mutate one "copy" and the original silently changes.

    **How they work:**

    - *Shallow:* `Object.clone()` by default copies primitive fields and copies reference values (pointers), not the objects they reference.
    - *Deep:* You manually clone or reconstruct every mutable field. Alternatively, serialize/deserialize the object, or use a library like Apache Commons `SerializationUtils.clone()`.

    **When to use:**

    - Shallow copy is fine when all fields are primitives or immutable (e.g., `String`, `LocalDate`).
    - Deep copy is required when your object graph contains mutable references you do not want shared.

    **Gotchas:**

    - `clone()` is shallow by default -- forgetting to deep-clone a `List` or `Date` field is a classic bug.
    - Circular references make deep copy tricky; serialization handles them, manual recursion may not.
    - Prefer copy constructors or static factory methods over `clone()` -- the `Cloneable` contract is poorly designed.

    ```java
    // Shallow: address is shared
    Person copy = original.clone();
    copy.getAddress().setCity("NYC"); // also changes original's address

    // Deep: address is independently cloned
    Person deepCopy = new Person(original.getName(),
                                  new Address(original.getAddress()));
    ```

??? question "Q27: Fail-fast vs fail-safe iterators?"

    **Answer:** Fail-fast iterators blow up immediately on concurrent modification; fail-safe iterators tolerate it by working on a snapshot or a lock-free structure.

    **Why:** Fail-fast behavior surfaces bugs early -- silently iterating over a corrupted structure would produce unpredictable results. Fail-safe is needed in concurrent environments where you cannot lock the entire collection.

    **How:**

    - *Fail-fast* (`ArrayList`, `HashMap`, `HashSet`): The collection maintains an internal `modCount`. The iterator captures it at creation; on every `next()` call it checks whether `modCount` changed. If so, it throws `ConcurrentModificationException`.
    - *Fail-safe* (`ConcurrentHashMap`, `CopyOnWriteArrayList`): `CopyOnWriteArrayList` snapshots the backing array on write, so iterators traverse the old array. `ConcurrentHashMap` uses lock-striping and weakly consistent iterators that never throw CME.

    **When to use:**

    - Single-threaded code: fail-fast collections are fine; just use `Iterator.remove()` instead of modifying the collection directly.
    - Multi-threaded hot reads, rare writes: `CopyOnWriteArrayList`.
    - High-concurrency reads/writes: `ConcurrentHashMap`.

    **Gotchas:**

    - Fail-fast is best-effort, not guaranteed -- do not rely on `ConcurrentModificationException` for correctness.
    - `CopyOnWriteArrayList` is O(n) on every write; disastrous for write-heavy workloads.
    - `ConcurrentHashMap` iterators may or may not reflect updates that happen *during* iteration.

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

    An immutable class guarantees that once constructed, its state can never change -- making it inherently thread-safe and safe as a `HashMap` key.

    **Why:** Immutability eliminates entire categories of bugs: race conditions, defensive copying at API boundaries, and accidental state corruption. Core JDK classes like `String`, `Integer`, and `LocalDate` are immutable for these reasons.

    **How -- the recipe:**

    1. Declare the class `final` (prevents subclass from breaking the contract).
    2. Make all fields `private final`.
    3. No setters -- ever.
    4. Initialize everything via the constructor.
    5. **Defensive copy** mutable arguments in the constructor AND in getters (e.g., `Date`, `List`).

    **When to use:** Value objects, DTOs shared across threads, cache keys, configuration holders, and anywhere you want safe sharing without synchronization.

    **Gotchas:**

    - Forgetting defensive copies of `Date`, `List`, or arrays -- the caller still holds a mutable reference to your "immutable" field.
    - Not making the class `final` -- a subclass can add mutable state and break your guarantee.
    - Java 16+ `record` classes are immutable by default and eliminate most boilerplate, but they cannot do defensive copies without a compact constructor.

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

    `finalize()` is a legacy GC cleanup hook -- deprecated since Java 9 because it is unreliable, slow, and dangerous.

    **Why it existed:** Before `try-with-resources`, Java lacked a guaranteed cleanup mechanism. `finalize()` was meant as a safety net for releasing native resources. In practice, it created more problems than it solved.

    **How:** When an object with a non-trivial `finalize()` becomes unreachable, the GC places it on a finalization queue. A low-priority `Finalizer` thread eventually calls `finalize()`. Only after that does the object become truly reclaimable -- requiring a second GC cycle.

    **When to use:** Never. Use `try-with-resources` for deterministic cleanup. For native resources without an owner, use `java.lang.ref.Cleaner` (Java 9+), which provides a similar safety-net without the pitfalls.

    **Gotchas:**

    - GC may never run, so `finalize()` may never execute -- not even at JVM shutdown.
    - Objects with finalizers take at least two GC cycles to collect, causing memory pressure.
    - A finalizer can accidentally resurrect the object by leaking `this` to a reachable reference.
    - Finalizer thread is single-threaded; a slow finalizer blocks all other finalizations.
    - Removed entirely in newer Java versions (JEP 421 deprecation for removal).

??? question "Q30: Explain try-with-resources."

    `try-with-resources` is Java 7's mechanism for automatic, deterministic resource cleanup -- it guarantees `close()` is called even when exceptions fly.

    **Why:** Before Java 7, developers wrote verbose and error-prone `try/finally` blocks. Forgetting to close a resource in the right order, or swallowing exceptions from `close()`, caused resource leaks and lost error context.

    **How:** Any object implementing `AutoCloseable` (or `Closeable`) can be declared in the try header. On exit -- normal or exceptional -- the JVM calls `close()` on each resource in reverse declaration order. If both the try body and `close()` throw, the body's exception wins and the close exception is attached via `addSuppressed()`.

    **When to use:** Streams, database connections, channels, locks, sockets -- anything holding an external resource. Since Java 9, you can use effectively-final variables declared outside the try block directly.

    **Gotchas:**

    - Suppressed exceptions are easy to overlook -- always check `getSuppressed()` in logs.
    - Wrapping resources (e.g., `BufferedReader` wrapping `FileReader`): if the outer constructor throws, the inner resource leaks unless declared separately.
    - Not all `AutoCloseable` implementations are idempotent -- calling `close()` twice may throw.

    ```java
    try (var reader = new BufferedReader(new FileReader("data.txt"));
         var writer = new BufferedWriter(new FileWriter("out.txt"))) {
        writer.write(reader.readLine());
    }  // reader and writer are automatically closed in reverse order
    ```

??? question "Q31: Checked vs unchecked exceptions?"

    Checked exceptions are compile-time-enforced contracts for recoverable conditions; unchecked exceptions signal programming errors that should be fixed, not caught.

    **Why:** Java's designers wanted to force callers to handle anticipated failure modes (file not found, network timeout). Unchecked exceptions were reserved for bugs (null dereference, array bounds) where catching masks the real problem.

    **How:** The compiler checks that every checked exception is either caught or declared in `throws`. Unchecked exceptions extend `RuntimeException` or `Error` and bypass this check. Under the hood there is no runtime difference -- the distinction is purely a compile-time rule.

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

    **When to use:** Checked for recoverable conditions (retry, fallback, prompt user). Unchecked for precondition violations and logic bugs.

    **Gotchas:**

    - Over-using checked exceptions leads to `catch (Exception e) { /* ignore */ }` anti-patterns.
    - Lambdas cannot throw checked exceptions without wrapping -- a major pain point with the `Stream` API.
    - Spring and Hibernate converted most checked exceptions to unchecked for this reason.
    - `sneakyThrows` (Lombok) bypasses checked exception rules but hurts readability.

??? question "Q32: ClassNotFoundException vs NoClassDefFoundError?"

    `ClassNotFoundException` is a recoverable checked exception from dynamic class loading; `NoClassDefFoundError` is a fatal linkage error when a compile-time dependency vanishes at runtime.

    **Why:** Java separates compile-time and runtime class resolution. Dynamic loading (`Class.forName()`) is expected to fail sometimes -- hence a checked exception. But if a class the compiler already verified is missing at runtime, something is fundamentally broken -- hence an `Error`.

    **How:**

    - `ClassNotFoundException`: thrown by `Class.forName()`, `ClassLoader.loadClass()`, or `ClassLoader.findSystemClass()` when the bytecode file is not on the classpath.
    - `NoClassDefFoundError`: thrown by the JVM linker when it cannot find the definition of a class that was present at compile time. Also triggered when a class's static initializer throws an exception -- the class is marked as permanently unusable.

    **When to use:** Catch `ClassNotFoundException` when doing plugin/driver loading. Almost never catch `NoClassDefFoundError` -- fix the classpath or packaging instead.

    **Gotchas:**

    - A failed static initializer causes `ExceptionInInitializerError` the first time, then `NoClassDefFoundError` on every subsequent attempt to use that class.
    - Fat-JAR conflicts (multiple versions of the same class) can produce `NoClassDefFoundError` for methods that exist in one version but not another.
    - In OSGi/modular environments, visibility rules can cause `ClassNotFoundException` even when the JAR is physically present.

    ```java
    // ClassNotFoundException -- dynamic loading fails
    try {
        Class.forName("com.example.Missing");
    } catch (ClassNotFoundException e) { /* recoverable */ }

    // NoClassDefFoundError -- class existed at compile time but missing at runtime
    // Commonly caused by missing JAR in the classpath or failed static initializer
    ```

??? question "Q33: StackOverflowError vs OutOfMemoryError?"

    `StackOverflowError` means you blew the per-thread call stack (usually runaway recursion); `OutOfMemoryError` means the JVM cannot allocate more memory anywhere.

    **Why:** The JVM separates stack memory (per-thread, fixed-size) from heap memory (shared, GC-managed). Each has its own failure mode when exhausted, and each requires a different fix.

    **How:**

    - *StackOverflow:* Each method call pushes a frame onto the thread's stack. When the stack pointer exceeds the thread's allocated size (`-Xss`, default ~512KB-1MB), the JVM throws `StackOverflowError`.
    - *OutOfMemory:* When `new` cannot satisfy an allocation after a full GC, or when metaspace/native memory is exhausted. Variants include "Java heap space", "Metaspace", "GC overhead limit exceeded", and "unable to create new native thread".

    **When to use (diagnostics):**

    - StackOverflow: check for infinite recursion, convert deep recursion to iteration, or increase `-Xss`.
    - OOM: analyze heap dumps with Eclipse MAT, check for memory leaks, increase `-Xmx`, or optimize object retention.

    **Gotchas:**

    - `StackOverflowError` can be caught and recovered from (the stack unwinds), but `OutOfMemoryError` often leaves the JVM in an unstable state.
    - `-Xss` is per-thread -- setting it too high with many threads can exhaust native memory and cause OOM.
    - "GC overhead limit exceeded" means the JVM is spending >98% of time in GC recovering <2% of heap -- effectively an OOM.

??? question "Q34: What is the difference between Error and Exception?"

    `Error` represents catastrophic JVM/system-level failures you should not catch; `Exception` represents application-level conditions you can anticipate and handle.

    **Why:** The `Throwable` hierarchy intentionally separates "things the application can fix" from "things that are fundamentally broken." Catching `OutOfMemoryError` and continuing usually makes things worse.

    **How:** Both extend `Throwable`. `Error` subclasses are unchecked and signal JVM-level problems. `Exception` subclasses split into checked (compiler-enforced) and unchecked (`RuntimeException`).

    | Aspect | Error | Exception |
    |--------|-------|-----------|
    | Recovery | Usually unrecoverable | Recoverable |
    | Cause | JVM / system failure | Application logic |
    | Examples | `OutOfMemoryError`, `StackOverflowError` | `IOException`, `NullPointerException` |
    | Should catch? | Rarely | Yes (checked) / Depends (unchecked) |

    **When to use:** Let `Error` propagate and crash the process (container orchestrator restarts it). Only catch `Error` in very specific scenarios like test frameworks catching `AssertionError`.

    **Gotchas:**

    - Catching `Throwable` or `Exception` at a top-level handler accidentally catches `Error` too -- be explicit.
    - Some libraries throw `Error` for non-fatal conditions (bad practice but it exists).
    - `LinkageError` subclasses often indicate classpath/module issues requiring repackaging, not code fixes.

??? question "Q35: Difference between throw and throws?"

    `throw` is the act of launching an exception object; `throws` is the declaration in a method signature warning callers what might come their way.

    **Why:** Java separates raising an exception from declaring it. `throw` is imperative (do this now); `throws` is declarative (this might happen). This distinction enables compile-time checking of checked exceptions.

    **How:**

    - `throw new SomeException("msg")` -- creates and throws the exception at that point. Control immediately transfers to the nearest matching `catch` block up the call stack.
    - `void foo() throws IOException` -- declares that callers must handle or propagate these checked exceptions. The compiler enforces this.

    **When to use:** Use `throw` for precondition checks, validation failures, and converting low-level exceptions to domain exceptions. Use `throws` on any method that can propagate a checked exception it does not handle internally.

    **Gotchas:**

    - Declaring `throws RuntimeException` is legal but pointless -- unchecked exceptions do not require declaration.
    - Overriding methods cannot add new checked exceptions to `throws` (but can narrow or remove them).
    - Throwing `null` (`throw null`) compiles but throws `NullPointerException` at runtime -- confusing.

    ```java
    void validate(int age) throws IllegalArgumentException {
        if (age < 0) throw new IllegalArgumentException("Age cannot be negative");
    }
    ```

??? question "Q36: What are best practices for custom exceptions?"

    Custom exceptions give your domain a specific error vocabulary -- they replace generic exceptions with meaningful, catchable, actionable types.

    **Why:** Catching `RuntimeException` is too broad; you cannot distinguish "order not found" from "database timeout." Custom exceptions let callers handle specific failure modes differently and carry domain context (order IDs, error codes) that generic exceptions cannot.

    **How:**

    1. Extend `RuntimeException` (unchecked) or `Exception` (checked) based on recoverability.
    2. Name descriptively: `InsufficientFundsException`, not `MyException`.
    3. Provide constructors for message, cause, and both (`super(message, cause)`).
    4. Add domain-specific fields (error codes, entity IDs) for structured error handling.
    5. Keep them serializable (inherited from `Throwable`).

    **When to use:** Service boundaries, validation layers, domain-specific failure modes, and anywhere callers need to make decisions based on the exception type.

    **Gotchas:**

    - Do not use exceptions for flow control -- stack trace capture costs ~1-5 microseconds per throw.
    - Too many custom exceptions bloat the codebase -- group related failures under a common base with an error-code enum.
    - Always preserve the cause chain: `throw new OrderException(msg, originalException)`.
    - If you override `fillInStackTrace()` for performance, you lose debugging info.

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

    `instanceof` tests whether an object's runtime type is assignment-compatible with a given type -- returning `true` for that class or any subclass/implementor.

    **Why:** In polymorphic code, you sometimes need to safely narrow a reference before calling subtype-specific methods. `instanceof` prevents `ClassCastException` by letting you check before you cast.

    **How:** At runtime, the JVM compares the object's actual class (stored in the object header) against the target type's hierarchy. It walks up the class chain and interface table. Returns `false` for `null`. Since Java 16, pattern matching combines the check and cast into one expression.

    **When to use:** `equals()` implementations, visitor-pattern alternatives, deserialization type checks, and working with legacy APIs that return `Object`. With sealed classes + pattern matching (Java 17+), `instanceof` enables exhaustive type switches.

    **Gotchas:**

    - Overusing `instanceof` often signals a design smell -- prefer polymorphism where possible.
    - `instanceof` with generics checks the raw type only (type erasure): `list instanceof List<String>` does not compile.
    - Pattern variable scope follows flow-scoping rules: `if (!(x instanceof String s)) return; s.length();` is valid.

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

    Reflection lets you inspect and manipulate classes, methods, and fields at runtime -- it is the backbone of frameworks like Spring, Hibernate, and JUnit.

    **Why:** Frameworks need to instantiate classes, inject dependencies, and call methods without knowing types at compile time. Serialization libraries need to read private fields. Testing tools need to access internals. Reflection makes all of this possible without modifying target code.

    **How:** `java.lang.reflect` provides `Class`, `Method`, `Field`, `Constructor` objects. You obtain a `Class<?>` via `Class.forName()`, `.class` literal, or `obj.getClass()`. From there you can enumerate members, bypass access checks with `setAccessible(true)`, create instances, and invoke methods dynamically.

    **When to use:** Framework/library development, annotation processors at runtime, plugin systems, serialization, and test utilities. Application code should rarely use reflection directly.

    **Gotchas:**

    - **Performance:** reflective calls are 5-50x slower than direct calls (though JIT can optimize repeated calls via `MethodHandle`).
    - **Module system (Java 9+):** `setAccessible(true)` fails across module boundaries unless you `--add-opens`.
    - **No compile-time safety:** method name typos become runtime errors.
    - Prefer `MethodHandle` or `VarHandle` for performance-sensitive reflective access.

    ```java
    Class<?> clazz = Class.forName("com.example.User");
    Method m = clazz.getDeclaredMethod("getName");
    m.setAccessible(true);
    Object result = m.invoke(userInstance);
    ```

??? question "Q39: Describe the Java compilation and execution process."

    Java uses a two-stage execution model: ahead-of-time compilation to bytecode, then runtime interpretation plus JIT compilation to native code.

    **Why:** This hybrid approach gives you platform independence (bytecode is portable) without sacrificing performance (JIT compiles hot paths with runtime profiling that can exceed static compilation quality).

    **How:**

    1. **Compile** (`javac`): source `.java` files become `.class` files containing platform-independent bytecode.
    2. **Class loading**: the ClassLoader hierarchy (bootstrap, platform, application) loads `.class` files lazily on first use.
    3. **Bytecode verification**: the verifier ensures type safety and stack consistency -- preventing malicious or corrupt bytecode from running.
    4. **Interpretation**: the JVM interpreter executes bytecode instruction-by-instruction.
    5. **JIT compilation**: C1 (client) and C2 (server) compilers identify hot methods via invocation counters and compile them to optimized native code. Tiered compilation (default since Java 8) starts with C1 and promotes to C2.

    **When to use:** Understanding this pipeline helps with: tuning JIT thresholds, diagnosing startup latency (interpreter phase), and deciding when AOT compilation (GraalVM native-image) is appropriate for short-lived processes.

    **Gotchas:**

    - JIT optimizations (inlining, escape analysis) are based on runtime profiling -- benchmarks must warm up the JVM first.
    - Class loading order can cause `NoClassDefFoundError` or static initializer races.
    - GraalVM native-image eliminates the JIT but requires closed-world assumptions (no dynamic class loading).

??? question "Q40: Heap vs Stack memory in Java?"

    Stack is per-thread, fast, and auto-freed on method return; heap is shared, GC-managed, and where all objects live.

    **Why:** Separating these concerns lets the JVM optimize for two different allocation patterns: short-lived method-scoped data (stack) versus long-lived shared objects (heap). The stack's LIFO discipline makes allocation/deallocation nearly free.

    **How:**

    | Feature | Stack | Heap |
    |---------|-------|------|
    | Stores | Method frames, local variables, references | Objects and instance variables |
    | Lifetime | Per-thread, freed when method returns | Managed by GC |
    | Speed | Fast (LIFO allocation) | Slower (dynamic allocation) |
    | Thread safety | Thread-private | Shared across threads |
    | Size | Small (tuned via `-Xss`) | Large (tuned via `-Xms`/`-Xmx`) |
    | Error | `StackOverflowError` | `OutOfMemoryError` |

    **When to use (tuning):** Increase `-Xss` for deep recursion. Increase `-Xmx` for large object graphs. Use escape analysis (enabled by default) which can allocate short-lived objects on the stack automatically.

    **Gotchas:**

    - Primitive locals live on the stack, but primitive *fields* of objects live on the heap (because the object is on the heap).
    - Each thread gets its own stack -- 1000 threads x 1MB = 1GB of native memory, contributing to OOM even if heap is fine.
    - `ThreadLocal` values are heap-allocated but conceptually act like stack-scoped data -- easy to leak in thread pools.

??? question "Q41: Explain Strong, Weak, Soft, and Phantom references."

    Java's reference types form a spectrum from "never collect" to "already collected" -- giving you fine-grained control over object reachability and GC behavior.

    **Why:** Sometimes you want the GC to reclaim objects under memory pressure (caches), or you need notification when an object dies (resource cleanup). Strong references alone cannot express these semantics.

    **How:**

    - **Strong** -- default (`Object obj = new Object()`). GC never touches it while reachable from a GC root.
    - **Soft** (`SoftReference`) -- GC clears it only when heap is low. JVM guarantees soft refs are cleared before throwing OOM. Ideal for memory-sensitive caches.
    - **Weak** (`WeakReference`) -- GC clears it at the next collection regardless of memory. Used by `WeakHashMap` for canonicalization maps.
    - **Phantom** (`PhantomReference`) -- `get()` always returns `null`. Enqueued in a `ReferenceQueue` after finalization. Used for post-mortem cleanup as a safer alternative to `finalize()`.

    **When to use:** Soft refs for caches (image buffers). Weak refs for metadata maps keyed by classloaders or listeners. Phantom refs for releasing native resources after GC.

    **Gotchas:**

    - Soft references can still cause OOM if the JVM does not clear them aggressively enough -- tune with `-XX:SoftRefLRUPolicyMSPerMB`.
    - `WeakHashMap` only weak-references the *keys*, not the values -- large values still leak if keys are weakly reachable.
    - Phantom references must be manually cleared from the `ReferenceQueue` or they themselves leak.

    Strength order: Strong > Soft > Weak > Phantom.

    ```java
    // Soft reference -- cache-friendly
    SoftReference<byte[]> cache = new SoftReference<>(new byte[1024 * 1024]);
    byte[] data = cache.get();  // may return null if GC reclaimed it

    // Weak reference -- does not prevent GC
    WeakReference<MyObject> weakRef = new WeakReference<>(new MyObject());
    MyObject obj = weakRef.get();  // null after next GC cycle
    ```

??? question "Q42: When is an object eligible for garbage collection?"

    An object becomes eligible for GC the moment no live thread can reach it through any chain of strong references from a GC root.

    **Why:** The GC's job is to reclaim memory without programmer intervention. Understanding eligibility helps you reason about memory leaks, finalization timing, and weak reference behavior.

    **How:** GC roots include: active thread stacks, static fields, JNI references, and monitor objects. The GC traces from these roots; anything unreachable is eligible. Common triggers:

    1. Setting a reference to `null`.
    2. Reassigning a reference to a different object.
    3. Method return (local variables go out of scope).
    4. **Island of isolation** -- objects referencing each other in a cycle, but with no external root pointing in.

    **When to use (design):** Minimize object scope (declare variables in the narrowest block). Null out references in long-lived data structures when entries are removed. Use weak references for caches.

    **Gotchas:**

    - Eligibility does not mean immediate collection -- the GC runs on its own schedule.
    - A finalizer can resurrect an object by leaking `this` to a reachable reference.
    - Escape analysis may keep objects on the stack (never GC'd at all), so "no allocation" is possible for short-lived objects.
    - Retaining a reference to one element of a large collection can keep the entire structure alive.

    ```java
    Object a = new Object();  // object 1 created
    Object b = new Object();  // object 2 created
    a = b;                    // object 1 is now eligible for GC
    a = null;
    b = null;                 // object 2 is now eligible for GC
    ```

??? question "Q43: How can memory leaks occur in Java?"

    Memory leaks in Java happen when objects are unintentionally retained -- still reachable from a GC root but no longer logically needed by the application.

    **Why:** Unlike C/C++ where leaks mean "forgot to free," Java leaks mean "forgot to unreference." The GC faithfully keeps alive anything reachable, so a single stale reference to a large object graph prevents reclamation of the entire subgraph.

    **How -- common patterns:**

    1. **Static collections** that grow unbounded (`static Map<Key, HeavyObject> cache`).
    2. **Unclosed resources** (JDBC connections, streams) -- the objects and their buffers stay alive.
    3. **Listeners/callbacks** registered but never deregistered.
    4. **Non-static inner classes** holding implicit references to the enclosing instance.
    5. **ClassLoader leaks** in app servers during hot redeploy.
    6. **`ThreadLocal` values** not removed in thread pools -- the value lives as long as the thread.
    7. **Broken `equals()`/`hashCode()`** in `HashMap` keys -- entries accumulate because `remove()` cannot find them.

    **When to use (detection):** Take heap dumps (`jmap -dump:live`), analyze with Eclipse MAT or VisualVM, look for dominator trees and retained size. Java Flight Recorder (JFR) shows allocation hot spots.

    **Gotchas:**

    - A "small" leak of 100 bytes/request becomes catastrophic at 10K req/s over hours.
    - `ThreadLocal` in Tomcat thread pools is the #1 cause of classloader leaks in web apps.
    - `String.substring()` (pre-Java 7u6) kept a reference to the original char array -- a historical leak source.

??? question "Q44: final vs finally vs finalize?"

    Three unrelated keywords sharing a prefix -- `final` prevents change, `finally` guarantees cleanup execution, and `finalize()` is a deprecated GC hook you should never use.

    **Why:** This is a classic interview trick question testing whether you confuse similar-sounding constructs. Each serves an entirely different purpose in the language.

    **How:**

    - **`final`** -- applied to variables (constant reference), methods (cannot override), and classes (cannot extend). Enables compiler optimizations and communicates design intent.
    - **`finally`** -- block that always executes after `try/catch`, regardless of whether an exception was thrown. Used for deterministic cleanup before `try-with-resources` existed.
    - **`finalize()`** -- a method on `Object` called by the GC before reclaiming memory. Non-deterministic, slow, and deprecated since Java 9.

    **When to use:** `final` liberally for immutability and clarity. `finally` rarely now (prefer try-with-resources). `finalize()` never.

    **Gotchas:**

    - `finally` does not execute if `System.exit()` is called or the JVM crashes.
    - A `return` inside `finally` silently swallows exceptions from the try block -- never do this.
    - `final` on a reference does not make the object immutable -- `final List` can still have elements added.
    - `finalize()` is removed in newer Java versions (JEP 421); code relying on it will break.

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

??? question "Q45: Can we override static, private, or final methods?"

    No -- none of these three can be overridden, but for entirely different reasons related to visibility, binding, and design intent.

    **Why:**

    - *Static:* belongs to the class, not an instance -- there is no polymorphic dispatch.
    - *Private:* invisible to subclasses -- they cannot even see it to override.
    - *Final:* explicitly locked down by the author to prevent behavioral changes in subclasses.

    **How:**

    - **Static methods**: a subclass can declare the same signature, but this is **method hiding** (resolved at compile time by reference type). `Parent p = new Child(); p.staticMethod();` calls Parent's version.
    - **Private methods**: the subclass method with the same name is completely independent -- no `@Override` applies.
    - **Final methods**: the compiler rejects any override attempt. The JVM can aggressively inline final methods.

    **When to use:** Mark methods `final` when the algorithm must not change (Template Method invariants). Use `private` for internal helpers. Use `static` for utility methods needing no instance context.

    **Gotchas:**

    - Developers often confuse hiding with overriding for static methods -- the difference only surfaces when called via a superclass reference.
    - `@Override` on a hidden static method is a compile error -- a useful sanity check.
    - In testing, final and static methods are hard to mock without bytecode manipulation (Mockito inline mock-maker or PowerMock).

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

    Lambdas are concise syntax for single-method interfaces; anonymous classes are the verbose predecessor that can do more (multiple methods, state, own `this`).

    **Why:** Before Java 8, every callback required an anonymous class -- boilerplate-heavy code that obscured intent. Lambdas fixed this for functional interfaces, but anonymous classes remain necessary for multi-method interfaces or when you need instance state.

    **How:**

    | Feature | Anonymous Class | Lambda |
    |---------|----------------|--------|
    | Can implement interface with multiple abstract methods | Yes | No (SAM/functional interface only) |
    | Has its own `this` | Yes | No (`this` refers to enclosing class) |
    | Can have state (fields) | Yes | No |
    | Compiled to | Separate `.class` file | `invokedynamic` bytecode |
    | Verbosity | Verbose | Concise |

    **When to use:** Lambdas for functional interfaces (`Runnable`, `Comparator`, `Function`). Anonymous classes when you need multiple methods, local state, or your own `this` reference.

    **Gotchas:**

    - `this` inside a lambda refers to the enclosing instance -- not the lambda itself. This can cause subtle serialization issues.
    - Lambdas can only capture effectively-final local variables.
    - Anonymous classes generate a `$1.class` file per usage; lambdas use `invokedynamic` + lambda metafactory, which is more memory-efficient.
    - Debugging lambdas shows synthetic method names in stack traces -- harder to read.

    ```java
    // Anonymous class
    Runnable r1 = new Runnable() {
        @Override public void run() { System.out.println("anon"); }
    };
    // Lambda
    Runnable r2 = () -> System.out.println("lambda");
    ```

??? question "Q47: What is the var keyword (Java 10+)?"

    `var` is local variable type inference -- the compiler figures out the type from the right-hand side so you do not have to repeat it.

    **Why:** Java is often criticized for verbosity: `Map<String, List<Employee>> map = new HashMap<String, List<Employee>>();`. `var` reduces noise without sacrificing type safety -- the variable is still statically typed, just inferred rather than declared explicitly.

    **How:** The compiler examines the initializer expression and assigns the inferred type at compile time. The bytecode is identical to an explicit declaration. `var` is a reserved type name (not a keyword), so existing code with a variable named `var` still compiles.

    **When to use:** Complex generic types, iterator declarations in for-loops, and anywhere the type is obvious from the right-hand side. Improves readability when the type name is long but the variable name is descriptive.

    **Gotchas:**

    - Cannot be used for fields, method parameters, return types, or variables without an initializer.
    - `var x = null;` does not compile -- the compiler cannot infer a type from null.
    - `var list = new ArrayList<>();` infers `ArrayList<Object>` -- the diamond operator needs the left-hand type hint.
    - Overuse harms readability: `var result = service.process(data);` -- what type is `result`?

    ```java
    var list = new ArrayList<String>();   // inferred as ArrayList<String>
    var stream = list.stream();           // inferred as Stream<String>
    // var x;                             // error -- no initializer
    // var y = null;                      // error -- cannot infer type
    ```

??? question "Q48: What are Record classes (Java 16+)?"

    Records are transparent, immutable data carriers where the compiler generates `equals()`, `hashCode()`, `toString()`, and accessors -- eliminating boilerplate for value types.

    **Why:** Java developers routinely wrote hundreds of lines for simple POJOs: fields, constructor, getters, equals, hashCode, toString. Records reduce this to a single line while guaranteeing immutability and correct value semantics.

    **How:** `record Point(int x, int y) {}` desugars to a `final` class extending `java.lang.Record` with `private final` fields, a canonical constructor, component accessors (`x()`, `y()`), and well-behaved `equals`/`hashCode`/`toString` based on all components.

    **When to use:** DTOs, API response objects, compound map keys, method return types bundling multiple values, and event payloads. Anywhere you previously used Lombok `@Value` or manual POJOs.

    **Gotchas:**

    - Accessors are `x()` not `getX()` -- breaks JavaBeans conventions and some frameworks expecting getters.
    - Records cannot extend other classes (they already extend `Record`) but can implement interfaces.
    - You cannot add mutable state -- any field must be a record component.
    - Compact constructors validate but cannot assign to fields manually; auto-assignment happens after the compact constructor body.
    - Serialization uses the canonical constructor (not `Unsafe`), making records safer for deserialization.

    ```java
    public record Point(int x, int y) { }

    // Usage
    var p = new Point(3, 4);
    System.out.println(p.x());       // 3 (accessor, not getX())
    System.out.println(p);           // Point[x=3, y=4]
    ```

??? question "Q49: What are Sealed classes (Java 17+)?"

    Sealed classes restrict which types can extend them -- giving you a closed, known set of subtypes that enables exhaustive pattern matching.

    **Why:** Before sealed classes, you had two extremes: `final` (no extension) or open (anyone can extend). Sealed classes fill the middle ground -- you control the hierarchy while still allowing inheritance. Essential for algebraic data types, state machines, and domain models where an unknown subtype would be a bug.

    **How:** The `sealed` modifier plus `permits` clause lists the only allowed direct subtypes. Each permitted subtype must be `final` (no further extension), `sealed` (controlled further), or `non-sealed` (open). The compiler knows all subtypes at compile time, enabling exhaustive `switch` without a `default` branch.

    **When to use:** Domain models with fixed variants (payment methods, AST nodes, protocol messages), state machines, and anywhere you want the compiler to enforce exhaustive handling.

    **Gotchas:**

    - Permitted subtypes must be in the same package (or module) as the sealed class.
    - If you omit `permits`, the compiler infers permitted subtypes from the same compilation unit.
    - `non-sealed` breaks the closed-world assumption -- exhaustive switch is no longer guaranteed for that branch.
    - Records can be permitted subtypes of sealed interfaces -- a powerful combination for algebraic data types.

    ```java
    public sealed class Shape permits Circle, Rectangle, Triangle { }

    public final class Circle extends Shape { }
    public sealed class Rectangle extends Shape permits Square { }
    public non-sealed class Triangle extends Shape { }  // open for further extension
    public final class Square extends Rectangle { }
    ```

??? question "Q50: What are Text blocks (Java 15+)?"

    Text blocks are multi-line string literals delimited by triple quotes -- they eliminate escape-character noise and preserve readable formatting for embedded JSON, SQL, HTML, and XML.

    **Why:** Writing `"SELECT *\n" + "FROM users\n" + "WHERE id = " + id` is error-prone and unreadable. Text blocks let you paste the actual query directly into code with proper indentation, and the compiler handles the rest.

    **How:** The opening `"""` must be followed by a newline. The compiler determines *common leading whitespace* (incidental indentation) from the closing `"""` position and strips it. This means the closing delimiter position controls the left margin. Escape sequences still work inside text blocks. The result is a regular `String` at runtime.

    **When to use:** Embedded SQL queries, JSON/XML templates, HTML fragments, regex patterns, and test data fixtures. Anywhere a string spans multiple lines.

    **Gotchas:**

    - Trailing whitespace is stripped by default -- use `\s` escape to preserve it.
    - `\` at end of line suppresses the newline (line continuation) -- useful for long single-line strings formatted across multiple source lines.
    - The closing `"""` position matters: move it left to add indentation, right to strip it.
    - String interpolation is NOT supported (unlike Kotlin/Python) -- use `String.formatted()` or `MessageFormat`.
    - Text blocks are still interned like regular string literals.

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
