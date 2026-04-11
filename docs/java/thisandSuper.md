# `this` and `super` Keywords in Java

These two keywords control how you reference the **current object** and the **parent class**. They're fundamental to understanding inheritance, constructor chaining, and method overriding.

---

## `this` Keyword

`this` refers to the **current object** — the instance whose method or constructor is executing.

### 5 Uses of `this`

| Use | Purpose |
|---|---|
| `this.field` | Distinguish instance variable from parameter |
| `this.method()` | Call another method of the current object |
| `this()` | Call another constructor in the same class |
| `return this` | Return the current object (fluent/builder pattern) |
| Pass `this` | Pass current object as an argument |

### 1. Resolve field vs parameter ambiguity

```java
public class Employee {
    private String name;
    private double salary;

    public Employee(String name, double salary) {
        this.name = name;      // this.name = instance field, name = parameter
        this.salary = salary;
    }
}
```

Without `this`, the parameter **shadows** the field and the field never gets assigned.

### 2. Constructor chaining with `this()`

```java
public class Order {
    private String id;
    private String status;
    private int priority;

    public Order(String id) {
        this(id, "PENDING", 0);  // calls the 3-arg constructor
    }

    public Order(String id, String status, int priority) {
        this.id = id;
        this.status = status;
        this.priority = priority;
    }
}
```

**Rule**: `this()` must be the **first statement** in the constructor.

### 3. Fluent / Builder pattern

```java
public class QueryBuilder {
    private String table;
    private String condition;
    private int limit;

    public QueryBuilder from(String table) {
        this.table = table;
        return this;  // returns the same object for chaining
    }

    public QueryBuilder where(String condition) {
        this.condition = condition;
        return this;
    }

    public QueryBuilder limit(int limit) {
        this.limit = limit;
        return this;
    }
}

// Fluent API usage
QueryBuilder query = new QueryBuilder()
    .from("employees")
    .where("salary > 50000")
    .limit(10);
```

### 4. Pass current object as argument

```java
public class EventSource {
    private List<Listener> listeners = new ArrayList<>();

    public void register(Listener listener) {
        listeners.add(listener);
    }

    public void start() {
        for (Listener l : listeners) {
            l.onEvent(this);  // passes current object to listener
        }
    }
}
```

---

## `super` Keyword

`super` refers to the **parent class** — used to access parent fields, methods, and constructors.

### 3 Uses of `super`

| Use | Purpose |
|---|---|
| `super.field` | Access parent's field (if shadowed by child) |
| `super.method()` | Call parent's method (when overridden) |
| `super()` | Call parent's constructor |

### 1. Call parent constructor with `super()`

```java
public class Vehicle {
    protected String brand;

    public Vehicle(String brand) {
        this.brand = brand;
    }
}

public class Car extends Vehicle {
    private int doors;

    public Car(String brand, int doors) {
        super(brand);  // MUST be first line — calls Vehicle(brand)
        this.doors = doors;
    }
}
```

**If you don't write `super()`, Java inserts `super()` (no-arg) automatically.** This fails if the parent has no no-arg constructor.

### 2. Call overridden parent method

```java
public class Animal {
    public String describe() {
        return "I am an animal";
    }
}

public class Dog extends Animal {
    @Override
    public String describe() {
        return super.describe() + " — specifically, a dog";
    }
}

new Dog().describe();  // "I am an animal — specifically, a dog"
```

**Real-world example — Spring framework**:

```java
@Service
public class CustomUserDetailsService extends BaseUserDetailsService {
    @Override
    public UserDetails loadUserByUsername(String username) {
        UserDetails base = super.loadUserByUsername(username);  // parent logic
        // add custom role mapping
        return enrichWithRoles(base);
    }
}
```

### 3. Access shadowed parent field

```java
public class Parent {
    String name = "Parent";
}

public class Child extends Parent {
    String name = "Child";

    void print() {
        System.out.println(name);        // "Child"
        System.out.println(this.name);   // "Child"
        System.out.println(super.name);  // "Parent"
    }
}
```

Avoid field shadowing in real code — it's confusing.

---

## `this` vs `super` — Side by Side

| Feature | `this` | `super` |
|---|---|---|
| Refers to | Current object | Parent class |
| Constructor call | `this()` — same class | `super()` — parent class |
| Must be first line | Yes (in constructor) | Yes (in constructor) |
| Can use together | No — only one can be first | No — only one can be first |
| Static context | Cannot use | Cannot use |
| Method call | `this.method()` — current class | `super.method()` — parent class |

---

## Constructor Execution Order

```java
class A {
    A() { System.out.println("A"); }
}
class B extends A {
    B() { System.out.println("B"); }
}
class C extends B {
    C() { System.out.println("C"); }
}

new C();
```

```
    Output:
    A     ◄── super() chain reaches the top first
    B
    C
```

Even though you wrote `new C()`, Java calls `A()` → `B()` → `C()` because every constructor implicitly calls `super()` as its first statement.

---

## Interview Questions

??? question "1. Can you use `this` inside a static method?"
    **No.** `this` refers to the current **instance**, but static methods belong to the **class**, not any instance. There is no `this` in a static context. Same applies to `super`.

??? question "2. What is the output?"
    ```java
    class A {
        A() { this(10); System.out.println("A()"); }
        A(int x) { System.out.println("A(int): " + x); }
    }
    ```
    `new A()` outputs: `A(int): 10` then `A()`. The no-arg constructor chains to `A(int)` via `this(10)`, which runs first.

??? question "3. What happens if the parent has no no-arg constructor and the child doesn't call super()?"
    **Compile error.** Java inserts `super()` (no-arg) automatically, but the parent only has a parameterized constructor. The child **must** explicitly call `super(args)`.

    ```java
    class Parent { Parent(String name) {} }
    class Child extends Parent {
        Child() {}  // COMPILE ERROR — no super() match
    }
    ```

??? question "4. Can this() and super() exist in the same constructor?"
    **No.** Both must be the first statement. You can only have one. Use constructor chaining: let one constructor call `this()` and the final constructor in the chain call `super()`.
