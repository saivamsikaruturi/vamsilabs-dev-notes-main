# Java Basics — Foundations You Must Know

Before diving into Spring Boot or microservices, you need rock-solid fundamentals. Every FAANG interviewer starts here.

---

## Java Platform Overview

```
    Your Code (.java)
         │
         ▼ javac (compiler)
    Bytecode (.class)
         │
         ▼ JVM (Java Virtual Machine)
    Machine Code ──► Runs on any OS
```

| Term | What it is |
|---|---|
| **JDK** | Java Development Kit = JRE + dev tools (javac, jdb, javadoc) |
| **JRE** | Java Runtime Environment = JVM + core libraries |
| **JVM** | Executes bytecode, manages memory, provides platform independence |
| **JIT** | Just-In-Time compiler inside JVM — compiles hot bytecode to native code |

**Java is platform-independent** (write once, run anywhere). **JVM is platform-dependent** (each OS has its own JVM implementation).

---

## Data Types

### Primitive Types (8 total)

| Type | Size | Default | Range | Example |
|---|---|---|---|---|
| `byte` | 1 byte | 0 | -128 to 127 | `byte b = 100;` |
| `short` | 2 bytes | 0 | -32,768 to 32,767 | `short s = 10000;` |
| `int` | 4 bytes | 0 | -2.1B to 2.1B | `int i = 42;` |
| `long` | 8 bytes | 0L | Very large | `long l = 999999999L;` |
| `float` | 4 bytes | 0.0f | ~7 decimal digits | `float f = 3.14f;` |
| `double` | 8 bytes | 0.0d | ~15 decimal digits | `double d = 3.14159;` |
| `char` | 2 bytes | '\u0000' | 0 to 65,535 | `char c = 'A';` |
| `boolean` | JVM-dep | false | true / false | `boolean b = true;` |

### Reference Types

Everything that's not a primitive: `String`, arrays, objects, interfaces, enums.

```java
String name = "Vamsi";       // reference to a String object
int[] numbers = {1, 2, 3};   // reference to an array object
Employee emp = new Employee(); // reference to an Employee object
```

**Key difference**: Primitives hold the value directly. References hold the **memory address** of the object.

---

## Variables

| Type | Where declared | Lifetime | Default value |
|---|---|---|---|
| **Local** | Inside method/block | Until method returns | None (must initialize) |
| **Instance** | Inside class (non-static) | Until object is GC'd | Type default (0, null, false) |
| **Static (Class)** | Inside class with `static` | Until class is unloaded | Type default |

```java
public class Example {
    static int count = 0;        // static variable (shared across all instances)
    private String name;         // instance variable (one per object)

    public void process() {
        int temp = 42;           // local variable (must initialize before use)
    }
}
```

---

## Pass-by-Value (Java is ALWAYS pass-by-value)

Java does **not** have pass-by-reference. It passes the **value of the reference** (for objects) or the **value itself** (for primitives).

### Primitives — value is copied

```java
void change(int x) {
    x = 100;  // changes the local copy only
}

int num = 42;
change(num);
System.out.println(num);  // 42 (unchanged)
```

### Objects — reference value is copied

```java
void changeName(Employee e) {
    e.setName("Krishna");  // modifies the SAME object (reference points to same heap location)
}

void reassign(Employee e) {
    e = new Employee("Ravi");  // creates a NEW local reference — doesn't affect caller
}

Employee emp = new Employee("Vamsi");
changeName(emp);
System.out.println(emp.getName());  // "Krishna" (modified via shared reference)

reassign(emp);
System.out.println(emp.getName());  // "Krishna" (reassign had no effect)
```

---

## `static` Keyword

`static` means the member belongs to the **class, not to any instance**.

| Used with | Meaning |
|---|---|
| `static` variable | One copy shared by all instances |
| `static` method | Can be called without creating an object |
| `static` block | Runs once when the class is loaded |
| `static` inner class | Doesn't need an instance of the outer class |

```java
public class Counter {
    private static int count = 0;  // shared across all instances

    public Counter() {
        count++;
    }

    public static int getCount() {
        return count;  // can't access non-static members here
    }
}

Counter c1 = new Counter();
Counter c2 = new Counter();
Counter.getCount();  // 2
```

**Interview trap**: A `static` method cannot access `this` or non-static members because it has no instance context.

---

## `final` Keyword

| Used with | Meaning |
|---|---|
| `final` variable | Value can't be changed after initialization (constant) |
| `final` method | Can't be overridden by subclasses |
| `final` class | Can't be extended (e.g., `String`, `Integer`) |

```java
final int MAX = 100;       // constant — can't reassign
MAX = 200;                 // COMPILE ERROR

final List<String> list = new ArrayList<>();
list.add("hello");         // OK — the reference is final, not the object
list = new ArrayList<>();  // COMPILE ERROR — can't reassign reference
```

---

## Type Casting

### Widening (automatic) — small → large

```java
int i = 42;
double d = i;  // int → double (automatic, no data loss)
```

### Narrowing (explicit) — large → small

```java
double d = 3.99;
int i = (int) d;  // double → int (must cast, loses decimal: i = 3)
```

### Object casting

```java
Animal animal = new Dog();       // upcasting (automatic)
Dog dog = (Dog) animal;          // downcasting (explicit, risky)

// Safe downcasting with instanceof
if (animal instanceof Dog d) {   // Java 17 pattern matching
    d.bark();
}
```

---

## Operators You Should Know

| Operator | What | Example | Result |
|---|---|---|---|
| `==` | Reference equality (for objects) | `s1 == s2` | true/false |
| `.equals()` | Value equality | `s1.equals(s2)` | true/false |
| `instanceof` | Type checking | `obj instanceof String` | true/false |
| `? :` | Ternary | `x > 0 ? "pos" : "neg"` | "pos" or "neg" |
| `>>` | Signed right shift | `8 >> 1` | 4 |
| `>>>` | Unsigned right shift | `-1 >>> 1` | 2147483647 |

---

## Interview Questions

??? question "1. Is Java pass-by-value or pass-by-reference?"
    **Always pass-by-value.** For primitives, the actual value is copied. For objects, the **reference value** (memory address) is copied — not the object itself. This means you can modify the object's state through the copied reference, but you can't make the caller's variable point to a different object.

??? question "2. What is the difference between `==` and `.equals()`?"
    `==` compares **references** (whether two variables point to the same object in memory). `.equals()` compares **values** (whether two objects are logically equal). For Strings: `new String("abc") == new String("abc")` is `false`, but `.equals()` is `true`.

??? question "3. Can a `static` method access non-static variables?"
    **No.** Static methods belong to the class, not any instance. There is no `this` reference in a static context, so there's no instance to access non-static members from. To access instance members, you need an object reference.

??? question "4. What is the difference between `final`, `finally`, and `finalize()`?"
    `final` — keyword to make variables constant, methods non-overridable, classes non-extendable. `finally` — block that always executes after try/catch (for cleanup). `finalize()` — method called by GC before reclaiming an object (deprecated since Java 9, removed in Java 18 — use `Cleaner` or `try-with-resources` instead).

??? question "5. Why is the `main` method `public static void`?"
    `public` — JVM must call it from outside the class. `static` — JVM calls it without creating an object of the class. `void` — it doesn't return anything to the JVM. `String[] args` — accepts command-line arguments.
