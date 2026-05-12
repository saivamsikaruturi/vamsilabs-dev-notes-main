# Wrapper Classes in Java

Wrapper classes convert **primitive types into objects**. This is essential because Java collections, generics, and many APIs only work with objects, not primitives.

---

## Primitive → Wrapper Mapping

| Primitive | Wrapper Class | Size |
|---|---|---|
| `byte` | `Byte` | 8 bits |
| `short` | `Short` | 16 bits |
| `int` | `Integer` | 32 bits |
| `long` | `Long` | 64 bits |
| `float` | `Float` | 32 bits |
| `double` | `Double` | 64 bits |
| `char` | `Character` | 16 bits |
| `boolean` | `Boolean` | JVM-dependent |

---

## Autoboxing & Unboxing

Java automatically converts between primitives and wrapper objects.

```
    Autoboxing                    Unboxing
    ─────────►                   ─────────►
    int  ──────►  Integer        Integer  ──────►  int
    ◄──────────                   ◄──────────
```

```java
// Autoboxing: primitive → object (compiler does Integer.valueOf(42))
Integer num = 42;

// Unboxing: object → primitive (compiler does num.intValue())
int value = num;

// Works in collections
List<Integer> numbers = new ArrayList<>();
numbers.add(10);          // autoboxing: int → Integer
int first = numbers.get(0); // unboxing: Integer → int
```

---

## The Integer Cache Trap (Asked in 90% of interviews)

Java caches `Integer` objects for values **-128 to 127**. This leads to confusing behavior.

```java
Integer a = 127;
Integer b = 127;
System.out.println(a == b);     // true  (same cached object)

Integer c = 128;
Integer d = 128;
System.out.println(c == d);     // false (different objects!)

System.out.println(c.equals(d)); // true  (always use .equals for objects)
```

### Why this happens

```
    Integer.valueOf(127)
    ┌─────────────────────────────────────┐
    │        Integer Cache [-128..127]     │
    │  ... │ 126 │ 127 │                  │  ◄── a and b point here (same object)
    └─────────────────────────────────────┘

    Integer.valueOf(128)
    ┌──────────┐    ┌──────────┐
    │ Integer  │    │ Integer  │
    │ val=128  │    │ val=128  │  ◄── c and d are different objects
    └──────────┘    └──────────┘
```

`Integer.valueOf()` returns the cached object for -128 to 127. For values outside this range, it creates a **new object every time**.

**Rule**: Always use `.equals()` to compare wrapper objects, never `==`.

---

## NullPointerException Trap

Unboxing a `null` wrapper throws `NullPointerException`.

```java
Integer num = null;
int value = num;  // NullPointerException at runtime!
```

This is extremely common in real codebases — especially when a method returns `Integer` (nullable) and the caller uses `int`.

```java
// Dangerous
public int getAge(Map<String, Integer> map, String key) {
    return map.get(key);  // NPE if key doesn't exist!
}

// Safe
public int getAge(Map<String, Integer> map, String key) {
    Integer age = map.get(key);
    return age != null ? age : 0;
}

// Even better (Java 8+)
public int getAge(Map<String, Integer> map, String key) {
    return map.getOrDefault(key, 0);
}
```

---

## Performance: Primitives vs Wrappers

| Aspect | Primitive (`int`) | Wrapper (`Integer`) |
|---|---|---|
| Memory | 4 bytes | ~16 bytes (object header + value) |
| Speed | Direct CPU operations | Boxing/unboxing overhead |
| Null support | No | Yes |
| Collections | Cannot use | Required |
| Generics | Cannot use | Required |

### Performance impact in loops

```java
// BAD — creates ~10 million Integer objects
Long sum = 0L;
for (int i = 0; i < 10_000_000; i++) {
    sum += i;  // autoboxing every iteration!
}

// GOOD — uses primitive, no boxing
long sum = 0L;
for (int i = 0; i < 10_000_000; i++) {
    sum += i;
}
```

The bad version is **5-10x slower** because of autoboxing overhead.

---

## Useful Wrapper Methods

```java
// Parsing strings
int num = Integer.parseInt("42");
double d = Double.parseDouble("3.14");

// String conversion
String s = Integer.toString(42);
String hex = Integer.toHexString(255);   // "ff"
String bin = Integer.toBinaryString(10);  // "1010"

// Constants
int max = Integer.MAX_VALUE;  // 2,147,483,647
int min = Integer.MIN_VALUE;  // -2,147,483,648

// Comparison
int result = Integer.compare(10, 20);  // -1 (10 < 20)

// Value of (uses cache for -128 to 127)
Integer cached = Integer.valueOf(100);
```

---

## Interview Questions

??? question "1. What is the output?"
    ```java
    Integer a = new Integer(10);
    Integer b = new Integer(10);
    System.out.println(a == b);
    System.out.println(a.equals(b));
    ```

    **Output**: `false`, `true`. The `new` keyword always creates a **new object** on the heap, bypassing the cache entirely. `==` compares references (different objects), `.equals()` compares values. Note: `new Integer()` is deprecated since Java 9 — use `Integer.valueOf()` instead.

??? question "2. Why can't we use primitives with generics like List<int>?"
    Java generics use **type erasure** — at runtime, `List<Integer>` becomes `List<Object>`. Since primitives are not objects, they can't be used with generics. This is why wrapper classes exist. Java 21+ has plans for **Project Valhalla** which will allow `List<int>` through value types.

??? question "3. What is the output?"
    ```java
    Double a = 0.0;
    Double b = -0.0;
    System.out.println(a.equals(b));
    System.out.println(0.0 == -0.0);
    ```

    **Output**: `false`, `true`. The `Double.equals()` method distinguishes between `0.0` and `-0.0` (per IEEE 754), but the `==` operator on primitives treats them as equal. This is a subtle gotcha when using `Double` as HashMap keys.

??? question "4. How does autoboxing affect HashMap performance?"
    If you use `Map<Integer, Integer>` with millions of entries, every key lookup involves autoboxing (int → Integer) and object creation. For high-performance code, use specialized maps like Eclipse Collections' `IntIntHashMap` or Trove's `TIntIntHashMap` which store raw primitives and avoid boxing entirely.
