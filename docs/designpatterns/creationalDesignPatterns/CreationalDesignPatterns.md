# Creational Design Patterns

> **Creational patterns abstract the instantiation process — they make a system independent of how its objects are created, composed, and represented.**

---

```mermaid
flowchart LR
    C["🟡 <b>CREATIONAL</b><br/>Object Creation"] --> Q["❓ Core Question:<br/>HOW should objects<br/>be created?"]
    Q --> G1["✅ Hide creation logic"]
    Q --> G2["✅ Flexible instantiation"]
    Q --> G3["✅ Decouple from concrete classes"]
    
    style C fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#000
    style Q fill:#FFF3E0,stroke:#E65100,color:#000
    style G1 fill:#E8F5E9,stroke:#2E7D32,color:#000
    style G2 fill:#E8F5E9,stroke:#2E7D32,color:#000
    style G3 fill:#E8F5E9,stroke:#2E7D32,color:#000
```

---

## Why Creational Patterns?

As systems grow, hardcoding object creation (`new ConcreteClass()`) everywhere leads to:

- **Tight coupling** — changing one class means modifying dozens of files
- **Inflexibility** — can't swap implementations without rewriting code
- **Duplication** — creation logic scattered and repeated

Creational patterns solve this by **encapsulating** which classes get instantiated and **hiding** how instances are assembled.

---

## The 5 Creational Patterns

| # | Pattern | When to Use | Key Idea |
|---|---------|-------------|----------|
| 1 | [**Singleton**](singletondesignpattern.md) | Need exactly ONE instance | Private constructor + static access |
| 2 | [**Factory Method**](FactoryDesignPattern.md) | Let subclasses decide what to create | Interface for creation, subclass implements |
| 3 | [**Abstract Factory**](AbstractFactoryDesignPattern.md) | Need families of related objects | Factory of factories |
| 4 | [**Builder**](BuilderDesignPattern.md) | Complex objects with many options | Step-by-step construction |
| 5 | [**Prototype**](PrototypeDesignPattern.md) | Expensive creation, clone instead | Copy existing objects |

---

## Choosing the Right Pattern

```mermaid
flowchart LR
    Start{"🤔 How should I create this object?"}
    Start -->|"Only ONE instance ever?"| Sing(["🎯 Singleton"])
    Start -->|"Multiple types, pick at runtime?"| Fact(["🏭 Factory Method"])
    Start -->|"Families of related objects?"| AF(["🏗️ Abstract Factory"])
    Start -->|"Many optional parameters?"| Build(["🔨 Builder"])
    Start -->|"Creation is expensive, copy instead?"| Proto(["🧬 Prototype"])
    
    style Start fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#000
    style Sing fill:#E3F2FD,stroke:#1565C0,color:#000
    style Fact fill:#E8F5E9,stroke:#2E7D32,color:#000
    style AF fill:#F3E5F5,stroke:#6A1B9A,color:#000
    style Build fill:#FFF3E0,stroke:#E65100,color:#000
    style Proto fill:#FCE4EC,stroke:#C62828,color:#000
```

---

!!! tip "Key Principle"
    All creational patterns share one goal: **program to an interface, not an implementation.** The client never needs to know the exact class being instantiated — only the contract it fulfills.
