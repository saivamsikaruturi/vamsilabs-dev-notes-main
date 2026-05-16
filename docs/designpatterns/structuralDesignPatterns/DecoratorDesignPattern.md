# :gift: Decorator Design Pattern

> **Attach additional responsibilities to an object dynamically. Decorators provide a flexible alternative to subclassing for extending functionality.**

---

## :bulb: Real-World Analogy

!!! abstract "Think of a Coffee Order"
    You start with a plain coffee. Then you add milk — it's still coffee but with milk. Add whipped cream — still coffee but with more toppings. Each addition "decorates" the base coffee without changing what coffee fundamentally is. You can stack any combination of add-ons dynamically.

```mermaid
flowchart LR
    A["☕ Plain Coffee<br/>$2"] --> B["🥛 + Milk<br/>$2.50"]
    B --> C["🍫 + Chocolate<br/>$3.00"]
    C --> D["🍦 + Whipped Cream<br/>$3.75"]
    D --> E["✨ Final Drink!<br/>Same cup, extra powers"]
    
    style A fill:#EFEBE9,stroke:#4E342E,color:#000
    style B fill:#FFF3E0,stroke:#E65100,color:#000
    style C fill:#FBE9E7,stroke:#BF360C,color:#000
    style D fill:#FCE4EC,stroke:#C62828,color:#000
    style E fill:#E8F5E9,stroke:#2E7D32,stroke-width:3px,color:#000
```

---

## :triangular_ruler: Pattern Structure

```mermaid
flowchart LR
    Component[["Component\n(interface)"]]
    ConcreteComponent(["Concrete\nComponent"])
    Decorator{{"Base Decorator\n(abstract)"}}
    DecoratorA(["Decorator A"])
    DecoratorB(["Decorator B"])

    ConcreteComponent -->|implements| Component
    Decorator -->|implements| Component
    Decorator -->|wraps| Component
    DecoratorA -->|extends| Decorator
    DecoratorB -->|extends| Decorator

    style Component fill:#c8e6c9,stroke:#2e7d32,color:#000
    style ConcreteComponent fill:#a5d6a7,stroke:#1b5e20,color:#000
    style Decorator fill:#e8f5e9,stroke:#2e7d32,color:#000
    style DecoratorA fill:#b2dfdb,stroke:#00695c,color:#000
    style DecoratorB fill:#b2dfdb,stroke:#00695c,color:#000
```

## UML Class Diagram

```mermaid
classDiagram
    class Pizza {
        <<interface>>
        +getDescription() String
        +getCost() double
    }
    class PlainPizza {
        +getDescription() String
        +getCost() double
    }
    class PizzaDecorator {
        <<abstract>>
        #decoratedPizza: Pizza
        +getDescription() String
        +getCost() double
    }
    class CheeseDecorator {
        +getDescription() String
        +getCost() double
    }
    class PepperoniDecorator {
        +getDescription() String
        +getCost() double
    }
    class OliveDecorator {
        +getDescription() String
        +getCost() double
    }

    PlainPizza ..|> Pizza : implements
    PizzaDecorator ..|> Pizza : implements
    PizzaDecorator o-- Pizza : wraps
    CheeseDecorator --|> PizzaDecorator : extends
    PepperoniDecorator --|> PizzaDecorator : extends
    OliveDecorator --|> PizzaDecorator : extends
```

---

## :x: The Problem

You have a `Notifier` class that sends emails. Now you need to also send notifications via SMS, Slack, and Facebook. You could create subclasses like `SMSNotifier`, `SlackNotifier` — but what if a user wants **both** SMS and Slack? You'd need `SMSSlackNotifier`, `SMSFacebookNotifier`, `SlackFacebookNotifier`...

This leads to a **class explosion** — `2^n` combinations for `n` notification types!

---

## :white_check_mark: The Solution

Instead of static subclassing, the Decorator pattern lets you **wrap** objects with new behaviors at runtime. Each decorator:

1. Implements the same interface as the wrapped object
2. Holds a reference to the wrapped object
3. Delegates to the wrapped object and adds its own behavior

Decorators can be **stacked** — wrapping a decorator with another decorator, creating layered behavior.

---

## :hammer_and_wrench: Implementation

=== "Pizza Decorator Example"

    ```java
    // Component interface
    public interface Pizza {
        String getDescription();
        double getCost();
    }

    // Concrete Component
    public class PlainPizza implements Pizza {
        @Override
        public String getDescription() {
            return "Plain pizza dough";
        }

        @Override
        public double getCost() {
            return 5.00;
        }
    }

    // Base Decorator
    public abstract class PizzaDecorator implements Pizza {
        protected final Pizza decoratedPizza;

        protected PizzaDecorator(Pizza pizza) {
            this.decoratedPizza = pizza;
        }

        @Override
        public String getDescription() {
            return decoratedPizza.getDescription();
        }

        @Override
        public double getCost() {
            return decoratedPizza.getCost();
        }
    }

    // Concrete Decorators
    public class CheeseDecorator extends PizzaDecorator {
        public CheeseDecorator(Pizza pizza) {
            super(pizza);
        }

        @Override
        public String getDescription() {
            return decoratedPizza.getDescription() + " + Cheese";
        }

        @Override
        public double getCost() {
            return decoratedPizza.getCost() + 1.50;
        }
    }

    public class PepperoniDecorator extends PizzaDecorator {
        public PepperoniDecorator(Pizza pizza) {
            super(pizza);
        }

        @Override
        public String getDescription() {
            return decoratedPizza.getDescription() + " + Pepperoni";
        }

        @Override
        public double getCost() {
            return decoratedPizza.getCost() + 2.00;
        }
    }

    public class OliveDecorator extends PizzaDecorator {
        public OliveDecorator(Pizza pizza) {
            super(pizza);
        }

        @Override
        public String getDescription() {
            return decoratedPizza.getDescription() + " + Olives";
        }

        @Override
        public double getCost() {
            return decoratedPizza.getCost() + 0.75;
        }
    }

    // Client — stacking decorators
    public class PizzaShop {
        public static void main(String[] args) {
            Pizza pizza = new PlainPizza();
            pizza = new CheeseDecorator(pizza);
            pizza = new PepperoniDecorator(pizza);
            pizza = new OliveDecorator(pizza);

            System.out.println(pizza.getDescription());
            // Output: Plain pizza dough + Cheese + Pepperoni + Olives
            System.out.println("Total: $" + pizza.getCost());
            // Output: Total: $9.25
        }
    }
    ```

=== "I/O Stream Example (JDK Style)"

    ```java
    // Simulating Java's InputStream decorator chain
    public interface DataSource {
        void writeData(String data);
        String readData();
    }

    // Concrete Component
    public class FileDataSource implements DataSource {
        private final String filename;

        public FileDataSource(String filename) {
            this.filename = filename;
        }

        @Override
        public void writeData(String data) {
            // Write to file
            System.out.println("Writing raw data to " + filename);
        }

        @Override
        public String readData() {
            return "raw data from " + filename;
        }
    }

    // Base Decorator
    public abstract class DataSourceDecorator implements DataSource {
        protected final DataSource wrappee;

        protected DataSourceDecorator(DataSource source) {
            this.wrappee = source;
        }

        @Override
        public void writeData(String data) {
            wrappee.writeData(data);
        }

        @Override
        public String readData() {
            return wrappee.readData();
        }
    }

    // Encryption Decorator
    public class EncryptionDecorator extends DataSourceDecorator {
        public EncryptionDecorator(DataSource source) {
            super(source);
        }

        @Override
        public void writeData(String data) {
            String encrypted = encrypt(data);
            super.writeData(encrypted);
        }

        @Override
        public String readData() {
            return decrypt(super.readData());
        }

        private String encrypt(String data) { return "ENC[" + data + "]"; }
        private String decrypt(String data) { return data.replace("ENC[", "").replace("]", ""); }
    }

    // Compression Decorator
    public class CompressionDecorator extends DataSourceDecorator {
        public CompressionDecorator(DataSource source) {
            super(source);
        }

        @Override
        public void writeData(String data) {
            String compressed = compress(data);
            super.writeData(compressed);
        }

        @Override
        public String readData() {
            return decompress(super.readData());
        }

        private String compress(String data) { return "ZIP[" + data + "]"; }
        private String decompress(String data) { return data.replace("ZIP[", "").replace("]", ""); }
    }

    // Usage — stacking encryption + compression
    public class Demo {
        public static void main(String[] args) {
            DataSource source = new FileDataSource("secrets.txt");
            source = new CompressionDecorator(source);
            source = new EncryptionDecorator(source);

            source.writeData("sensitive information");
            // Writes: ENC[ZIP[sensitive information]]
        }
    }
    ```

---

## :dart: When to Use

- You need to add responsibilities to individual objects **dynamically and transparently**
- Extension by subclassing is impractical due to **class explosion**
- You want to add/remove behaviors at **runtime**
- You need to combine multiple behaviors in **various combinations**
- When you want features that can be **withdrawn** (unlike inheritance)

---

## :globe_with_meridians: Real-World Examples

| Where | Example |
|-------|---------|
| **JDK** | `BufferedInputStream(new FileInputStream(...))` — entire I/O stream hierarchy |
| **JDK** | `Collections.unmodifiableList()`, `synchronizedList()`, `checkedList()` |
| **Spring** | `HttpServletRequestWrapper` — decorates servlet requests |
| **Spring Security** | Filter chain — each filter decorates the security handling |
| **Spring** | `TransactionProxyFactoryBean` — adds transactional behavior |
| **Jackson** | `ObjectMapper` features added via modules (decorator-like) |

---

## :warning: Pitfalls

!!! warning "Common Mistakes"
    - **Removing a decorator from the middle** of the stack is difficult — you only have reference to the outermost wrapper
    - **Identity checks fail**: `decoratedObj != originalObj` even though they represent the same logical entity
    - **Order matters**: `Encrypt(Compress(data))` produces different results than `Compress(Encrypt(data))`
    - **Too many small classes**: Having dozens of single-purpose decorators can make code hard to navigate
    - **Confusing with Proxy**: Decorator adds new behavior; Proxy controls access to existing behavior

---

## :memo: Key Takeaways

!!! tip "Summary"
    | Aspect | Detail |
    |--------|--------|
    | **Intent** | Add behavior to objects dynamically without subclassing |
    | **Mechanism** | Wrapping objects in decorator layers (composition) |
    | **Key Benefit** | Avoids class explosion; Single Responsibility Principle |
    | **Key Principle** | Open/Closed — add behavior without modifying existing code |
    | **vs Inheritance** | Decorator = runtime flexibility; Inheritance = compile-time only |
    | **Interview Tip** | "Java I/O streams are the textbook example of Decorator pattern" |
