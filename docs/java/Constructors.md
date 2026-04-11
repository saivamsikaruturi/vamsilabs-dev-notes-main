# Constructors in Java

A constructor is a special method that **initializes an object** when it's created. It has the same name as the class and no return type.

---

## Types of Constructors

```
                    ┌──────────────────┐
                    │   Constructors   │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
    ┌───────────┐    ┌──────────────┐    ┌───────────┐
    │  Default   │    │ Parameterized│    │   Copy     │
    │(no args)   │    │ (with args)  │    │Constructor │
    └───────────┘    └──────────────┘    └───────────┘
```

---

## Default Constructor

If you don't write any constructor, Java provides a **default no-arg constructor** automatically. The moment you write any constructor, the default disappears.

```java
public class Student {
    String name;
    int age;
    // Java provides: public Student() {} automatically
}

Student s = new Student();  // works fine
```

```java
public class Student {
    String name;
    int age;

    public Student(String name, int age) {
        this.name = name;
        this.age = age;
    }
}

Student s = new Student();  // COMPILE ERROR — no default constructor!
```

---

## Parameterized Constructor

Takes arguments to initialize the object with specific values.

```java
public class Employee {
    private final String name;
    private final String department;
    private final double salary;

    public Employee(String name, String department, double salary) {
        this.name = name;
        this.department = department;
        this.salary = salary;
    }
}

Employee emp = new Employee("Vamsi", "Engineering", 150000);
```

---

## Constructor Overloading

A class can have **multiple constructors** with different parameter lists.

```java
public class Connection {
    private String host;
    private int port;
    private int timeout;

    public Connection() {
        this("localhost", 8080, 30000);
    }

    public Connection(String host, int port) {
        this(host, port, 30000);
    }

    public Connection(String host, int port, int timeout) {
        this.host = host;
        this.port = port;
        this.timeout = timeout;
    }
}

// All valid
Connection c1 = new Connection();                    // localhost:8080, 30s
Connection c2 = new Connection("db.server.com", 5432); // custom host:port, 30s
Connection c3 = new Connection("db.server.com", 5432, 5000); // fully custom
```

---

## Constructor Chaining with `this()`

`this()` calls another constructor **in the same class**. Must be the **first statement**.

```java
public class User {
    private String name;
    private String email;
    private String role;

    public User(String name) {
        this(name, "no-reply@default.com");  // chains to 2-arg constructor
    }

    public User(String name, String email) {
        this(name, email, "USER");  // chains to 3-arg constructor
    }

    public User(String name, String email, String role) {
        this.name = name;
        this.email = email;
        this.role = role;
    }
}
```

```
    new User("Vamsi")
        │
        ▼ this("Vamsi", "no-reply@default.com")
        │
        ▼ this("Vamsi", "no-reply@default.com", "USER")
        │
        ▼ fields assigned
```

---

## Constructor Chaining with `super()`

`super()` calls the **parent class constructor**. If you don't write it, Java inserts `super()` (no-arg) automatically.

```java
public class Animal {
    String name;

    public Animal(String name) {
        this.name = name;
        System.out.println("Animal constructor: " + name);
    }
}

public class Dog extends Animal {
    String breed;

    public Dog(String name, String breed) {
        super(name);  // MUST be first line — calls Animal(name)
        this.breed = breed;
        System.out.println("Dog constructor: " + breed);
    }
}

new Dog("Buddy", "Labrador");
// Output:
// Animal constructor: Buddy
// Dog constructor: Labrador
```

---

## Copy Constructor

Creates a new object as a **copy of an existing object**. Java doesn't provide this by default — you write it yourself.

```java
public class Address {
    private String city;
    private String zip;

    public Address(String city, String zip) {
        this.city = city;
        this.zip = zip;
    }

    // Copy constructor
    public Address(Address other) {
        this.city = other.city;
        this.zip = other.zip;
    }
}

Address original = new Address("Bangalore", "560001");
Address copy = new Address(original);  // independent copy
```

**Why not just use clone()?** The `clone()` method is problematic — it bypasses constructors, has a confusing contract, and requires `Cloneable` interface. Copy constructors are cleaner and more explicit.

---

## Private Constructor — Singleton & Utility Classes

A `private` constructor **prevents external instantiation**.

### Singleton Pattern

```java
public class DatabaseConnection {
    private static final DatabaseConnection INSTANCE = new DatabaseConnection();

    private DatabaseConnection() {
        // private — no one can create another instance
    }

    public static DatabaseConnection getInstance() {
        return INSTANCE;
    }
}
```

### Utility Class

```java
public class MathUtils {
    private MathUtils() {
        throw new AssertionError("Cannot instantiate utility class");
    }

    public static double round(double value, int places) {
        return Math.round(value * Math.pow(10, places)) / Math.pow(10, places);
    }
}
```

---

## Constructor vs Method

| Feature | Constructor | Method |
|---|---|---|
| Name | Same as class name | Any valid name |
| Return type | None (not even `void`) | Must have one |
| Called when | Object is created (`new`) | Explicitly by programmer |
| Inheritance | Not inherited | Inherited |
| `this()`/`super()` | Can use (first line only) | Cannot use |
| Default provided | Yes (no-arg, if none written) | No |

---

## Interview Questions

??? question "1. What happens if you write `return` inside a constructor?"
    You can write `return;` (empty return) to exit early, but you **cannot** write `return value;` — constructors have no return type so they can't return a value. This compiles fine: `if (invalid) return;`

??? question "2. Can a constructor be `final`, `static`, or `abstract`?"
    **No** to all three. `final` — constructors aren't inherited, so final is meaningless. `static` — constructors create instances, which is an instance-level operation. `abstract` — constructors must have a body to initialize the object.

??? question "3. In what order are constructors called in a 3-level inheritance chain?"
    **Parent first, child last.** For `class C extends B`, `class B extends A`: `A()` → `B()` → `C()`. Java always calls the parent constructor before the child, because the parent's state must be initialized before the child can use it.

??? question "4. Can `this()` and `super()` both appear in the same constructor?"
    **No.** Both must be the **first statement** in a constructor, so only one can exist. If you need both, chain through constructors: one constructor calls `this()` to another constructor in the same class, which then calls `super()`.

??? question "5. What is the difference between a copy constructor and `clone()`?"
    Copy constructor: explicit, clean, type-safe, calls constructors normally. `clone()`: uses `Cloneable` marker interface, bypasses constructors, returns `Object` (needs casting), has a broken contract for deep vs shallow copy. **Joshua Bloch (Effective Java) recommends copy constructors over clone().**
