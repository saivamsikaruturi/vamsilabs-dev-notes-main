# Serialization in Java

Serialization converts an **object into a byte stream** so it can be saved to a file, sent over a network, or stored in a cache. Deserialization is the reverse — converting bytes back into an object.

---

## How It Works

```
    Serialization                          Deserialization
    ─────────────►                         ─────────────►
    Java Object ──► Byte Stream ──► File   File ──► Byte Stream ──► Java Object
                                   / DB                              (restored)
                                   / Network
```

---

## Basic Example

### Step 1: Implement `Serializable`

```java
import java.io.Serializable;

public class Employee implements Serializable {
    private static final long serialVersionUID = 1L;

    private String name;
    private int age;
    private double salary;

    public Employee(String name, int age, double salary) {
        this.name = name;
        this.age = age;
        this.salary = salary;
    }

    @Override
    public String toString() {
        return name + " | Age: " + age + " | Salary: " + salary;
    }
}
```

### Step 2: Serialize (Write object to file)

```java
Employee emp = new Employee("Vamsi", 27, 150000);

try (ObjectOutputStream oos = new ObjectOutputStream(
        new FileOutputStream("employee.ser"))) {
    oos.writeObject(emp);
    System.out.println("Serialized: " + emp);
}
```

### Step 3: Deserialize (Read object from file)

```java
try (ObjectInputStream ois = new ObjectInputStream(
        new FileInputStream("employee.ser"))) {
    Employee emp = (Employee) ois.readObject();
    System.out.println("Deserialized: " + emp);
}
```

---

## `serialVersionUID` — Why It Matters

`serialVersionUID` is a **version number** for your class. If you serialize an object and then change the class (add/remove fields), the `serialVersionUID` changes and deserialization **fails** with `InvalidClassException`.

```java
// Always declare it explicitly
private static final long serialVersionUID = 1L;
```

| Scenario | What happens |
|---|---|
| No `serialVersionUID` declared | JVM auto-generates one — changes if class changes |
| Explicit `serialVersionUID` + add new field | Deserialization works — new field gets default value |
| Explicit `serialVersionUID` + remove field | Deserialization works — removed field is ignored |
| Different `serialVersionUID` | `InvalidClassException` — deserialization fails |

---

## `transient` Keyword — Excluding Fields

Fields marked `transient` are **not serialized**. Use it for sensitive data or derived fields.

```java
public class User implements Serializable {
    private static final long serialVersionUID = 1L;

    private String username;
    private transient String password;  // NOT serialized
    private transient int loginCount;   // NOT serialized

    public User(String username, String password) {
        this.username = username;
        this.password = password;
        this.loginCount = 0;
    }
}
```

```java
User user = new User("vamsi", "secret123");

// Serialize
try (ObjectOutputStream oos = new ObjectOutputStream(
        new FileOutputStream("user.ser"))) {
    oos.writeObject(user);
}

// Deserialize
try (ObjectInputStream ois = new ObjectInputStream(
        new FileInputStream("user.ser"))) {
    User restored = (User) ois.readObject();
    System.out.println(restored.username);  // "vamsi"
    System.out.println(restored.password);  // null (transient!)
    System.out.println(restored.loginCount); // 0 (transient!)
}
```

---

## `static` Fields and Serialization

`static` fields belong to the **class, not the object**. They are **never serialized**.

```java
public class Config implements Serializable {
    private static String appName = "MyApp";  // NOT serialized
    private String userId;                      // serialized
}
```

---

## `Serializable` vs `Externalizable`

| Feature | `Serializable` | `Externalizable` |
|---|---|---|
| Marker interface | Yes (no methods) | No (has 2 methods) |
| Control | JVM handles everything | You control read/write |
| Performance | Slower (serializes all fields) | Faster (you choose what to write) |
| Default constructor | Not required | **Required** (public no-arg) |
| `transient` | Respected | You decide manually |

### Externalizable Example

```java
public class Product implements Externalizable {
    private String name;
    private double price;
    private transient String internalCode;

    public Product() {} // REQUIRED for Externalizable

    public Product(String name, double price, String code) {
        this.name = name;
        this.price = price;
        this.internalCode = code;
    }

    @Override
    public void writeExternal(ObjectOutput out) throws IOException {
        out.writeUTF(name);
        out.writeDouble(price);
        // deliberately NOT writing internalCode
    }

    @Override
    public void readExternal(ObjectInput in) throws IOException {
        this.name = in.readUTF();
        this.price = in.readDouble();
    }
}
```

---

## Serialization with Inheritance

```
    ┌──────────────────┐
    │  Parent (not      │  ◄── If parent is NOT Serializable,
    │  Serializable)    │      parent fields get DEFAULT values
    └────────┬─────────┘
             │
    ┌────────▼─────────┐
    │  Child            │  ◄── If child IS Serializable,
    │  (Serializable)   │      child fields are serialized
    └──────────────────┘
```

```java
class Animal {  // NOT Serializable
    String species;
    Animal() { this.species = "Unknown"; }
    Animal(String species) { this.species = species; }
}

class Dog extends Animal implements Serializable {
    private static final long serialVersionUID = 1L;
    String name;
    Dog(String species, String name) {
        super(species);
        this.name = name;
    }
}

// After serialization + deserialization:
Dog dog = new Dog("Canine", "Buddy");
// dog.name → "Buddy"    (serialized — child field)
// dog.species → "Unknown" (NOT serialized — parent's no-arg constructor runs)
```

---

## Custom Serialization with `readObject` / `writeObject`

You can customize the default serialization behavior:

```java
public class Account implements Serializable {
    private static final long serialVersionUID = 1L;

    private String accountNumber;
    private transient String encryptedPassword;

    private void writeObject(ObjectOutputStream oos) throws IOException {
        oos.defaultWriteObject();
        oos.writeObject(encrypt(encryptedPassword));  // custom write
    }

    private void readObject(ObjectInputStream ois) throws IOException, ClassNotFoundException {
        ois.defaultReadObject();
        this.encryptedPassword = decrypt((String) ois.readObject());  // custom read
    }
}
```

---

## Modern Alternatives to Java Serialization

Java serialization has **security vulnerabilities** and is considered legacy. Modern alternatives:

| Format | Library | When to use |
|---|---|---|
| JSON | Jackson, Gson | REST APIs, config files |
| Protocol Buffers | Google protobuf | High-performance, cross-language RPC |
| Avro | Apache Avro | Kafka messages, schema evolution |
| Kryo | Kryo | In-memory serialization, fast |
| MessagePack | msgpack-java | Compact binary, cross-language |

---

## Interview Questions

??? question "1. What happens if a Serializable class contains a non-Serializable field?"
    `NotSerializableException` at runtime. To fix: either make the field's class Serializable, mark the field `transient`, or use custom serialization (`writeObject`/`readObject`).

??? question "2. How can you prevent a Serializable class from being serialized?"
    Throw an exception in `writeObject`: `private void writeObject(ObjectOutputStream oos) throws IOException { throw new NotSerializableException("Serialization not allowed"); }`. Or implement `readResolve()` for Singleton protection.

??? question "3. How does Singleton break with serialization, and how do you fix it?"
    Deserializing creates a **new object**, breaking the Singleton contract. Fix: implement `readResolve()` to return the existing instance.

    ```java
    private Object readResolve() throws ObjectStreamException {
        return INSTANCE;  // return existing singleton
    }
    ```

??? question "4. What is the difference between `transient` and `static` in the context of serialization?"
    Both are excluded from serialization, but for different reasons. `transient` — explicitly marks an **instance field** to skip. `static` — belongs to the class, not the object, so it's inherently not part of object state. After deserialization, `transient` fields get default values (`null`, `0`), while `static` fields retain whatever value the class currently has.
