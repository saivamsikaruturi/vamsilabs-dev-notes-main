# Design Patterns

## Why Do We Need Design Patterns?

```mermaid
flowchart LR
    A["🖥️ Start:<br/>Simple Code"] --> B["🕸️ As Features Grow:<br/>• more if-else<br/>• duplicate logic<br/>• hard to change"]
    B --> C["🎯 Design Patterns:<br/>✅ Clean code<br/>✅ Easy to extend<br/>✅ Reusable solutions<br/>✅ Easy to maintain"]
```

!!! abstract "What are Design Patterns?"
    Design patterns are **proven solutions** to common software design problems. They are not code — they are **templates** for how to solve problems that can be used in many different situations.

!!! tip "Practice Repository"
    Full Java implementations of all patterns: [:fontawesome-brands-github: lld-Design-Patterns](https://github.com/saivamsikaruturi/lld-Design-Patterns)

---

## Types of Design Patterns

```mermaid
flowchart LR
    DP{{"<b>DESIGN PATTERNS</b>"}} --> C(["① <b>CREATIONAL</b><br/>(Object Creation)"])
    DP --> S(["② <b>STRUCTURAL</b><br/>(Object Structure)"])
    DP --> B(["③ <b>BEHAVIORAL</b><br/>(Object Behavior)"])
```

---

## ① Creational Patterns — *Object Creation*

!!! question "Problem"
    How to create different objects in a clean and flexible way **without tying code to concrete classes**?

**Example:** Payment method selection — UPI, Card, or Wallet. You don't want `new UPIPayment()` scattered everywhere.

**Goal:** Create objects without hard-coding the exact class to instantiate.

**Used In:** Payment systems, Notification systems, Document parsers

| # | Pattern | What it Does |
|---|---------|-------------|
| 1 | [**Singleton**](creationalDesignPatterns/singletondesignpattern.md) | Ensures only ONE instance of a class exists globally |
| 2 | [**Factory Method**](creationalDesignPatterns/FactoryDesignPattern.md) | Creates objects without specifying the exact class |
| 3 | [**Abstract Factory**](creationalDesignPatterns/AbstractFactoryDesignPattern.md) | Creates families of related objects |
| 4 | [**Builder**](creationalDesignPatterns/BuilderDesignPattern.md) | Constructs complex objects step by step |
| 5 | [**Prototype**](creationalDesignPatterns/PrototypeDesignPattern.md) | Creates new objects by cloning existing ones |

---

## ② Structural Patterns — *Object Structure*

!!! question "Problem"
    How to add new behavior or features to existing objects **without changing their code**?

**Example:** Add logging + authentication to every API call without modifying the API handler.

```mermaid
flowchart LR
    Client --> Decorator1["🔒 Authentication"]
    Decorator1 --> Decorator2["📝 Logging"]
    Decorator2 --> Server["🖥️ Server"]
```

**Goal:** Extend functionality without modifying existing code.

**Used In:** API wrappers, Adapters, Logging, Caching, Decorators

| # | Pattern | What it Does |
|---|---------|-------------|
| 1 | [**Adapter**](structuralDesignPatterns/AdapterDesignPattern.md) | Makes incompatible interfaces work together |
| 2 | [**Decorator**](structuralDesignPatterns/DecoratorDesignPattern.md) | Adds behavior dynamically without subclassing |
| 3 | [**Facade**](structuralDesignPatterns/facadedesignpattern.md) | Simplifies a complex subsystem with one interface |
| 4 | [**Proxy**](structuralDesignPatterns/Proxydesignpattern.md) | Controls access to another object |
| 5 | [**Composite**](structuralDesignPatterns/CompositeDesignPattern.md) | Treats individual objects and compositions uniformly |
| 6 | [**Bridge**](structuralDesignPatterns/BridgeDesignPattern.md) | Separates abstraction from implementation |
| 7 | [**Flyweight**](structuralDesignPatterns/flyweightdesignpattern.md) | Shares objects to reduce memory usage |

---

## ③ Behavioral Patterns — *Object Behavior*

!!! question "Problem"
    How objects **communicate and behave** in different situations without tight coupling?

**Example 1:** Payment System — same interface, different logic (Strategy)

```mermaid
flowchart LR
    PI[["Payment Interface"]] --> UPI(["UPI Payment"])
    PI --> Card(["Card Payment"])
    PI --> Wallet(["Wallet Payment"])
```

**Example 2:** Notification System — one event, many users notified (Observer)

```mermaid
flowchart LR
    Event["🔔 Event"] --> U1["👤 User 1"]
    Event --> U2["👤 User 2"]
    Event --> U3["👤 User 3"]
```

**Goal:** Handle different behaviors and interactions between objects.

**Used In:** Notification systems, Event handling, Undo/Redo, Workflows

| # | Pattern | What it Does |
|---|---------|-------------|
| 1 | [**Observer**](behaviouralDesignPatterns/ObserverDesignPattern.md) | Notifies multiple objects when state changes |
| 2 | [**Strategy**](behaviouralDesignPatterns/StrategyDp.md) | Swaps algorithms at runtime |
| 3 | [**Command**](behaviouralDesignPatterns/CommandDp.md) | Encapsulates a request as an object |
| 4 | [**Chain of Responsibility**](behaviouralDesignPatterns/ChainOfResponsibilityDesignPattern.md) | Passes request along a chain of handlers |
| 5 | [**State**](behaviouralDesignPatterns/StateDp.md) | Changes behavior when internal state changes |
| 6 | [**Template Method**](behaviouralDesignPatterns/TemplateDp.md) | Defines skeleton, subclasses fill in steps |
| 7 | [**Iterator**](behaviouralDesignPatterns/Iterator.md) | Traverses a collection without exposing internals |
| 8 | [**Mediator**](behaviouralDesignPatterns/MediatorDp.md) | Reduces chaotic dependencies between objects |
| 9 | [**Memento**](behaviouralDesignPatterns/MementoDp.md) | Captures and restores object state (undo) |
| 10 | [**Visitor**](behaviouralDesignPatterns/VisitorDp.md) | Adds operations without changing classes |
| 11 | [**Interpreter**](behaviouralDesignPatterns/Interpreter.md) | Evaluates sentences in a language |

---

## Quick Reference — All 23 Patterns

<div class="dp-reference" markdown>

<div class="dp-category dp-creational" markdown>
<div class="dp-category-header">
<span class="dp-category-icon">🟡</span>
<div>
<h3>Creational Patterns</h3>
<p>How objects get <strong>created</strong></p>
</div>
<span class="dp-count">5</span>
</div>
<div class="dp-cards">
<a href="creationalDesignPatterns/singletondesignpattern/" class="dp-card">
<span class="dp-card-emoji">🏗️</span>
<span class="dp-card-name">Singleton</span>
<span class="dp-card-desc">One instance only</span>
</a>
<a href="creationalDesignPatterns/FactoryDesignPattern/" class="dp-card">
<span class="dp-card-emoji">🏭</span>
<span class="dp-card-name">Factory</span>
<span class="dp-card-desc">Create by type</span>
</a>
<a href="creationalDesignPatterns/AbstractFactoryDesignPattern/" class="dp-card">
<span class="dp-card-emoji">🏭</span>
<span class="dp-card-name">Abstract Factory</span>
<span class="dp-card-desc">Families of objects</span>
</a>
<a href="creationalDesignPatterns/BuilderDesignPattern/" class="dp-card">
<span class="dp-card-emoji">🧱</span>
<span class="dp-card-name">Builder</span>
<span class="dp-card-desc">Step-by-step build</span>
</a>
<a href="creationalDesignPatterns/PrototypeDesignPattern/" class="dp-card">
<span class="dp-card-emoji">🐑</span>
<span class="dp-card-name">Prototype</span>
<span class="dp-card-desc">Clone objects</span>
</a>
</div>
</div>

<div class="dp-category dp-structural" markdown>
<div class="dp-category-header">
<span class="dp-category-icon">🟢</span>
<div>
<h3>Structural Patterns</h3>
<p>How objects are <strong>composed</strong></p>
</div>
<span class="dp-count">7</span>
</div>
<div class="dp-cards">
<a href="structuralDesignPatterns/AdapterDesignPattern/" class="dp-card">
<span class="dp-card-emoji">🔌</span>
<span class="dp-card-name">Adapter</span>
<span class="dp-card-desc">Convert interface</span>
</a>
<a href="structuralDesignPatterns/DecoratorDesignPattern/" class="dp-card">
<span class="dp-card-emoji">🎨</span>
<span class="dp-card-name">Decorator</span>
<span class="dp-card-desc">Add behavior</span>
</a>
<a href="structuralDesignPatterns/facadedesignpattern/" class="dp-card">
<span class="dp-card-emoji">🏛️</span>
<span class="dp-card-name">Facade</span>
<span class="dp-card-desc">Simplify access</span>
</a>
<a href="structuralDesignPatterns/Proxydesignpattern/" class="dp-card">
<span class="dp-card-emoji">🛡️</span>
<span class="dp-card-name">Proxy</span>
<span class="dp-card-desc">Control access</span>
</a>
<a href="structuralDesignPatterns/CompositeDesignPattern/" class="dp-card">
<span class="dp-card-emoji">🌳</span>
<span class="dp-card-name">Composite</span>
<span class="dp-card-desc">Tree structure</span>
</a>
<a href="structuralDesignPatterns/BridgeDesignPattern/" class="dp-card">
<span class="dp-card-emoji">🌉</span>
<span class="dp-card-name">Bridge</span>
<span class="dp-card-desc">Decouple layers</span>
</a>
<a href="structuralDesignPatterns/flyweightdesignpattern/" class="dp-card">
<span class="dp-card-emoji">🪶</span>
<span class="dp-card-name">Flyweight</span>
<span class="dp-card-desc">Share & save memory</span>
</a>
</div>
</div>

<div class="dp-category dp-behavioral" markdown>
<div class="dp-category-header">
<span class="dp-category-icon">🟣</span>
<div>
<h3>Behavioral Patterns</h3>
<p>How objects <strong>communicate</strong></p>
</div>
<span class="dp-count">11</span>
</div>
<div class="dp-cards">
<a href="behaviouralDesignPatterns/ObserverDesignPattern/" class="dp-card">
<span class="dp-card-emoji">👁️</span>
<span class="dp-card-name">Observer</span>
<span class="dp-card-desc">Notify changes</span>
</a>
<a href="behaviouralDesignPatterns/StrategyDp/" class="dp-card">
<span class="dp-card-emoji">♟️</span>
<span class="dp-card-name">Strategy</span>
<span class="dp-card-desc">Swap algorithms</span>
</a>
<a href="behaviouralDesignPatterns/CommandDp/" class="dp-card">
<span class="dp-card-emoji">📦</span>
<span class="dp-card-name">Command</span>
<span class="dp-card-desc">Encapsulate action</span>
</a>
<a href="behaviouralDesignPatterns/ChainOfResponsibilityDesignPattern/" class="dp-card">
<span class="dp-card-emoji">⛓️</span>
<span class="dp-card-name">Chain of Resp.</span>
<span class="dp-card-desc">Pass along</span>
</a>
<a href="behaviouralDesignPatterns/StateDp/" class="dp-card">
<span class="dp-card-emoji">🔄</span>
<span class="dp-card-name">State</span>
<span class="dp-card-desc">Behavior switch</span>
</a>
<a href="behaviouralDesignPatterns/TemplateDp/" class="dp-card">
<span class="dp-card-emoji">📋</span>
<span class="dp-card-name">Template</span>
<span class="dp-card-desc">Define skeleton</span>
</a>
<a href="behaviouralDesignPatterns/Iterator/" class="dp-card">
<span class="dp-card-emoji">🔂</span>
<span class="dp-card-name">Iterator</span>
<span class="dp-card-desc">Traverse</span>
</a>
<a href="behaviouralDesignPatterns/MediatorDp/" class="dp-card">
<span class="dp-card-emoji">🤝</span>
<span class="dp-card-name">Mediator</span>
<span class="dp-card-desc">Centralize comms</span>
</a>
<a href="behaviouralDesignPatterns/MementoDp/" class="dp-card">
<span class="dp-card-emoji">💾</span>
<span class="dp-card-name">Memento</span>
<span class="dp-card-desc">Undo / Redo</span>
</a>
<a href="behaviouralDesignPatterns/VisitorDp/" class="dp-card">
<span class="dp-card-emoji">🚶</span>
<span class="dp-card-name">Visitor</span>
<span class="dp-card-desc">Add operations</span>
</a>
<a href="behaviouralDesignPatterns/Interpreter/" class="dp-card">
<span class="dp-card-emoji">📖</span>
<span class="dp-card-name">Interpreter</span>
<span class="dp-card-desc">Parse grammar</span>
</a>
</div>
</div>

</div>

---

!!! tip "Think in Patterns, Write Better Code!"
    Don't memorize patterns — **understand the problem each one solves**. When you face a similar problem in your code, the right pattern will come naturally.
