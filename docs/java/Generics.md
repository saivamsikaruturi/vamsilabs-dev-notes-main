# Generics in Java

Generics allow you to write **type-safe, reusable code** that works with any object type. Without generics, you'd cast everything from `Object` and pray for no `ClassCastException` at runtime.

---

## Why Generics Exist

```java
// BEFORE generics (Java 1.4) — no type safety
List list = new ArrayList();
list.add("Hello");
list.add(42);  // no compile error — anything goes
String s = (String) list.get(1);  // ClassCastException at RUNTIME!

// WITH generics (Java 5+) — compile-time safety
List<String> list = new ArrayList<>();
list.add("Hello");
list.add(42);  // COMPILE ERROR — caught early
String s = list.get(0);  // no cast needed
```

---

## Generic Classes

```java
public class Box<T> {
    private T value;

    public Box(T value) { this.value = value; }
    public T getValue() { return value; }
    public void setValue(T value) { this.value = value; }
}

Box<String> stringBox = new Box<>("Hello");
Box<Integer> intBox = new Box<>(42);

String s = stringBox.getValue();  // no cast — compiler knows it's String
```

### Multiple Type Parameters

```java
public class Pair<K, V> {
    private K key;
    private V value;

    public Pair(K key, V value) {
        this.key = key;
        this.value = value;
    }

    public K getKey() { return key; }
    public V getValue() { return value; }
}

Pair<String, Integer> entry = new Pair<>("age", 27);
```

---

## Generic Methods

A method can have its own type parameters, independent of the class.

```mermaid
sequenceDiagram
    participant Dev as 👨‍💻 Developer
    participant Code as 📝 Call Site
    participant Compiler as ⚙️ Compiler
    participant Method as 🎯 Generic Method

    Dev->>Code: Utils.max("apple", "banana")
    Code->>Compiler: Infer type for <T>
    
    Note over Compiler: Step 1: Look at arguments<br/>"apple" → String<br/>"banana" → String
    Note over Compiler: Step 2: Unify types<br/>T = String
    Note over Compiler: Step 3: Check bounds<br/>String extends Comparable<String>? ✅

    Compiler->>Method: Call max<String>(String, String)
    Method-->>Code: Returns String "banana"

    Dev->>Code: Utils.max(10, 20)
    Code->>Compiler: Infer type for <T>
    
    Note over Compiler: Step 1: Arguments<br/>10 → Integer, 20 → Integer
    Note over Compiler: Step 2: T = Integer
    Note over Compiler: Step 3: Integer extends<br/>Comparable<Integer>? ✅

    Compiler->>Method: Call max<Integer>(Integer, Integer)
    Method-->>Code: Returns Integer 20
```

```java
public class Utils {
    public static <T> List<T> listOf(T... elements) {
        return Arrays.asList(elements);
    }

    public static <T extends Comparable<T>> T max(T a, T b) {
        return a.compareTo(b) >= 0 ? a : b;
    }
}

List<String> names = Utils.listOf("Java", "Go", "Rust");
String bigger = Utils.max("apple", "banana");  // "banana"
int larger = Utils.max(10, 20);                 // 20
```

---

## Bounded Type Parameters

Restrict what types can be used with generics.

```mermaid
flowchart LR
    subgraph legend["🎯 Type Parameter Hierarchy"]
        direction LR
        W(["<b>? (Unbounded)</b><br/>Any type at all"])
        UB(["<b>? extends T</b><br/>Upper Bound — T or subtypes"])
        LB(["<b>? super T</b><br/>Lower Bound — T or supertypes"])
    end

    subgraph example["Example: Number Hierarchy"]
        direction LR
        OBJ(("Object"))
        NUM(("Number"))
        INT(("Integer"))
        DBL(("Double"))
        
        OBJ --> NUM
        NUM --> INT
        NUM --> DBL
    end

    subgraph bounds["Wildcard Scope"]
        direction LR
        EXT{{"? extends Number<br/>✅ Integer, Double, Float<br/>❌ Object, String"}}
        SUP{{"? super Integer<br/>✅ Integer, Number, Object<br/>❌ Double, String"}}
        UNB{{"?<br/>✅ Anything"}}
    end

    W --- UNB
    UB --- EXT
    LB --- SUP

    style W fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px,color:#1B5E20
    style UB fill:#E3F2FD,stroke:#1565C0,stroke-width:2px,color:#0D47A1
    style LB fill:#FFF3E0,stroke:#E65100,stroke-width:2px,color:#BF360C
    style EXT fill:#E3F2FD,stroke:#1565C0,stroke-width:2px,color:#0D47A1
    style SUP fill:#FFF3E0,stroke:#E65100,stroke-width:2px,color:#BF360C
    style UNB fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px,color:#1B5E20
    style OBJ fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px,color:#4A148C
    style NUM fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px,color:#4A148C
    style INT fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px,color:#4A148C
    style DBL fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px,color:#4A148C
    style legend fill:#F9FBE7,stroke:#827717,stroke-width:2px
    style example fill:#FCE4EC,stroke:#880E4F,stroke-width:2px
    style bounds fill:#E0F7FA,stroke:#006064,stroke-width:2px
```

### Upper bound (`extends`) — "T must be a subtype of X"

```java
// T must implement Comparable
public static <T extends Comparable<T>> void sort(List<T> list) {
    Collections.sort(list);
}

// T must extend Number
public static <T extends Number> double sum(List<T> list) {
    return list.stream().mapToDouble(Number::doubleValue).sum();
}

sum(List.of(1, 2, 3));       // works — Integer extends Number
sum(List.of(1.5, 2.5));      // works — Double extends Number
sum(List.of("a", "b"));      // COMPILE ERROR — String doesn't extend Number
```

### Multiple bounds

```java
// T must extend Number AND implement Comparable
public static <T extends Number & Comparable<T>> T max(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;
}
```

---

## Wildcards (`?`)

Wildcards are used when you **don't know or don't care** about the specific type.

### `?` — Unbounded wildcard

```java
public static void printAll(List<?> list) {
    for (Object item : list) {
        System.out.println(item);
    }
}

printAll(List.of("A", "B"));  // works
printAll(List.of(1, 2, 3));   // works
```

### `? extends T` — Upper bounded (read-only / producer)

"I accept any list of T **or its subtypes**."

```java
public static double sum(List<? extends Number> list) {
    double total = 0;
    for (Number n : list) {
        total += n.doubleValue();
    }
    return total;
}

sum(List.of(1, 2, 3));           // List<Integer> — works
sum(List.of(1.5, 2.5));          // List<Double> — works
```

You can **read** from it (as Number), but you **cannot add** to it (compiler doesn't know the exact subtype).

### `? super T` — Lower bounded (write-only / consumer)

"I accept any list of T **or its supertypes**."

```java
public static void addNumbers(List<? super Integer> list) {
    list.add(1);
    list.add(2);
    list.add(3);
}

addNumbers(new ArrayList<Integer>());  // works
addNumbers(new ArrayList<Number>());   // works
addNumbers(new ArrayList<Object>());   // works
```

You can **write** T to it, but when **reading** you only get `Object`.

### PECS — Producer Extends, Consumer Super

```mermaid
flowchart LR
    subgraph PRODUCER["📤 PRODUCER (extends)"]
        direction LR
        P1["Collection<b> PRODUCES </b>data"]
        P2["You <b>READ</b> from it"]
        P3["Use: <b>? extends T</b>"]
        P1 --> P2 --> P3
    end

    subgraph CONSUMER["📥 CONSUMER (super)"]
        direction LR
        C1["Collection <b>CONSUMES</b> data"]
        C2["You <b>WRITE</b> to it"]
        C3["Use: <b>? super T</b>"]
        C1 --> C2 --> C3
    end

    subgraph BOTH["🔄 BOTH"]
        direction LR
        B1["Read AND Write"]
        B2["Use: <b>T</b> (no wildcard)"]
        B1 --> B2
    end

    DATA_OUT["🍎 Data flows OUT<br/>of the collection"] --> PRODUCER
    DATA_IN["🍎 Data flows IN<br/>to the collection"] --> CONSUMER

    subgraph MNEMONIC["🧠 Memory Trick"]
        direction LR
        M1["<b>P</b>roducer = <b>E</b>xtends"]
        M2["<b>C</b>onsumer = <b>S</b>uper"]
        M1 --- M2
    end

    style PRODUCER fill:#C8E6C9,stroke:#2E7D32,stroke-width:3px,color:#1B5E20
    style CONSUMER fill:#BBDEFB,stroke:#1565C0,stroke-width:3px,color:#0D47A1
    style BOTH fill:#FFF9C4,stroke:#F9A825,stroke-width:3px,color:#F57F17
    style DATA_OUT fill:#A5D6A7,stroke:#388E3C,stroke-width:2px,color:#1B5E20
    style DATA_IN fill:#90CAF9,stroke:#1976D2,stroke-width:2px,color:#0D47A1
    style MNEMONIC fill:#F8BBD0,stroke:#C2185B,stroke-width:3px,color:#880E4F
    style M1 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px,color:#1B5E20
    style M2 fill:#BBDEFB,stroke:#1565C0,stroke-width:2px,color:#0D47A1
    style P1 fill:#E8F5E9,stroke:#4CAF50,color:#1B5E20
    style P2 fill:#E8F5E9,stroke:#4CAF50,color:#1B5E20
    style P3 fill:#E8F5E9,stroke:#4CAF50,color:#1B5E20
    style C1 fill:#E3F2FD,stroke:#2196F3,color:#0D47A1
    style C2 fill:#E3F2FD,stroke:#2196F3,color:#0D47A1
    style C3 fill:#E3F2FD,stroke:#2196F3,color:#0D47A1
    style B1 fill:#FFFDE7,stroke:#FBC02D,color:#F57F17
    style B2 fill:#FFFDE7,stroke:#FBC02D,color:#F57F17
```

| Direction | Use | Example |
|---|---|---|
| **Read** from the collection | `? extends T` | `List<? extends Number>` — read as Number |
| **Write** to the collection | `? super T` | `List<? super Integer>` — write Integer |
| **Both read and write** | `T` (no wildcard) | `List<T>` |

```java
// Real-world: Collections.copy() uses PECS
public static <T> void copy(List<? super T> dest, List<? extends T> src) {
    for (T item : src) {   // read from src (extends = producer)
        dest.add(item);     // write to dest (super = consumer)
    }
}
```

---

## Type Erasure

Java generics are a **compile-time feature**. At runtime, all generic type information is **erased**.

```mermaid
flowchart LR
    subgraph SOURCE["📝 Source Code (Compile Time)"]
        direction LR
        S1["List&lt;String&gt; names"]
        S2["List&lt;Integer&gt; ages"]
        S3["Box&lt;Double&gt; box"]
    end

    subgraph COMPILER["⚙️ Java Compiler"]
        direction LR
        C1["✅ Type Check"]
        C2["✅ Insert Casts"]
        C3["🗑️ Erase Types"]
        C1 --> C2 --> C3
    end

    subgraph BYTECODE["💾 Bytecode (Runtime)"]
        direction LR
        B1["List names"]
        B2["List ages"]
        B3["Box box"]
        B4["All become RAW types!"]
    end

    SOURCE --> COMPILER --> BYTECODE

    subgraph CANT["❌ Cannot Do at Runtime"]
        direction LR
        X1["new T()"]
        X2["instanceof List&lt;String&gt;"]
        X3["new T[10]"]
        X4["Overload by generic type"]
    end

    style SOURCE fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px
    style COMPILER fill:#FFF3E0,stroke:#E65100,stroke-width:2px
    style BYTECODE fill:#FFEBEE,stroke:#C62828,stroke-width:2px
    style CANT fill:#F3E5F5,stroke:#6A1B9A,stroke-width:2px
    style S1 fill:#C8E6C9,stroke:#388E3C,color:#1B5E20
    style S2 fill:#C8E6C9,stroke:#388E3C,color:#1B5E20
    style S3 fill:#C8E6C9,stroke:#388E3C,color:#1B5E20
    style C1 fill:#FFE0B2,stroke:#F57C00,color:#E65100
    style C2 fill:#FFE0B2,stroke:#F57C00,color:#E65100
    style C3 fill:#FFE0B2,stroke:#F57C00,color:#E65100
    style B1 fill:#FFCDD2,stroke:#E53935,color:#B71C1C
    style B2 fill:#FFCDD2,stroke:#E53935,color:#B71C1C
    style B3 fill:#FFCDD2,stroke:#E53935,color:#B71C1C
    style B4 fill:#FFCDD2,stroke:#E53935,color:#B71C1C
    style X1 fill:#E1BEE7,stroke:#8E24AA,color:#4A148C
    style X2 fill:#E1BEE7,stroke:#8E24AA,color:#4A148C
    style X3 fill:#E1BEE7,stroke:#8E24AA,color:#4A148C
    style X4 fill:#E1BEE7,stroke:#8E24AA,color:#4A148C
```

```java
// What you write:
List<String> list = new ArrayList<>();

// What the JVM sees at runtime:
List list = new ArrayList();  // just raw List
```

### Consequences of Type Erasure

| What you can't do | Why |
|---|---|
| `new T()` | JVM doesn't know what T is at runtime |
| `T[] array = new T[10]` | Can't create generic arrays |
| `instanceof List<String>` | Type info erased — only `instanceof List` works |
| Overload methods by generic type | `void process(List<String>)` and `void process(List<Integer>)` have the same erasure |

```java
// This WON'T compile — both methods have the same erasure
void process(List<String> list) {}
void process(List<Integer> list) {}  // COMPILE ERROR — same erasure: process(List)
```

---

## Common Generic Naming Conventions

| Letter | Meaning | Example |
|---|---|---|
| `T` | Type | `Box<T>` |
| `E` | Element | `List<E>` |
| `K` | Key | `Map<K, V>` |
| `V` | Value | `Map<K, V>` |
| `N` | Number | `Calculator<N extends Number>` |
| `R` | Return type | `Function<T, R>` |

---

## Wildcard Decision Tree

Use this flowchart in interviews to quickly decide which wildcard to use:

```mermaid
flowchart LR
    START(("🤔 Which wildcard<br/>should I use?"))
    Q1{"Do you know the<br/>exact type?"}
    Q2{"Do you need to<br/>READ or WRITE?"}
    Q3{"Only READ<br/>or only WRITE?"}
    Q4{"Do you care about<br/>the type at all?"}

    A1[["Use concrete type<br/><b>List&lt;T&gt;</b>"]]
    A2(["Use <b>? extends T</b><br/>📤 Producer Extends"])
    A3(["Use <b>? super T</b><br/>📥 Consumer Super"])
    A4[/"Use concrete <b>T</b><br/>No wildcard needed"/]
    A5{{"Use <b>?</b><br/>Unbounded wildcard"}}
    A6[/"Use concrete type<br/><b>List&lt;MyClass&gt;</b>"/]

    START --> Q1
    Q1 -->|"Yes, same type"| A6
    Q1 -->|"No, it varies"| Q2
    Q2 -->|"Read only"| A2
    Q2 -->|"Write only"| A3
    Q2 -->|"Both"| Q3
    Q3 -->|"Need full read + write"| A4
    Q3 -->|"Only care it is some List"| Q4
    Q4 -->|"No, any type"| A5
    Q4 -->|"Yes, within a family"| A1

    style START fill:#7E57C2,stroke:#4527A0,stroke-width:3px,color:#FFFFFF
    style Q1 fill:#FFF9C4,stroke:#F9A825,stroke-width:2px,color:#F57F17
    style Q2 fill:#FFF9C4,stroke:#F9A825,stroke-width:2px,color:#F57F17
    style Q3 fill:#FFF9C4,stroke:#F9A825,stroke-width:2px,color:#F57F17
    style Q4 fill:#FFF9C4,stroke:#F9A825,stroke-width:2px,color:#F57F17
    style A1 fill:#B3E5FC,stroke:#0277BD,stroke-width:2px,color:#01579B
    style A2 fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px,color:#1B5E20
    style A3 fill:#BBDEFB,stroke:#1565C0,stroke-width:2px,color:#0D47A1
    style A4 fill:#FFE0B2,stroke:#E65100,stroke-width:2px,color:#BF360C
    style A5 fill:#E1BEE7,stroke:#6A1B9A,stroke-width:2px,color:#4A148C
    style A6 fill:#FFCCBC,stroke:#BF360C,stroke-width:2px,color:#BF360C
```

---

## Interview Questions

??? question "1. What is type erasure and why does it matter?"
    At compile time, Java checks generic types for safety. At runtime, all generic type info is **removed** (replaced with `Object` or the bound). This means you can't do `new T()`, `instanceof List<String>`, or create generic arrays. It matters because it limits what you can do with generics at runtime and is why you sometimes see `Class<T>` passed as a parameter for reflective operations.

??? question "2. What is the difference between `List<Object>` and `List<?>`?"
    `List<Object>` — you can add any object, but `List<String>` is NOT assignable to it (generics are invariant). `List<?>` — you can assign any `List<X>` to it, but you can only **read** as `Object` and **cannot add** anything (except null). Use `List<?>` when you only need to read.

??? question "3. Why can't you create an array of a generic type like `new T[10]`?"
    Because of type erasure. Arrays are **reified** (they know their type at runtime and enforce it), but generics are **erased**. If `new T[10]` were allowed and T were erased to Object, the array wouldn't enforce the correct type at runtime, breaking type safety. Use `List<T>` instead of `T[]`.

??? question "4. Explain PECS with a real example."
    **Producer Extends**: `Collections.max(Collection<? extends T>)` — the collection **produces** elements for comparison, so use `extends`. **Consumer Super**: `Collections.addAll(Collection<? super T>, T...)` — the collection **consumes** elements being added, so use `super`. If you need both read and write, use the concrete type `T`.

??? question "5. What is the difference between `<T extends Comparable<T>>` and `<T extends Comparable<? super T>>`?"
    The second is more flexible. `<T extends Comparable<T>>` means T compares to itself. `<T extends Comparable<? super T>>` means T compares to itself **or any of its supertypes**. Example: `ScheduledFuture` extends `Delayed` which implements `Comparable<Delayed>`. With the first bound, `ScheduledFuture` wouldn't work because it's `Comparable<Delayed>`, not `Comparable<ScheduledFuture>`.
