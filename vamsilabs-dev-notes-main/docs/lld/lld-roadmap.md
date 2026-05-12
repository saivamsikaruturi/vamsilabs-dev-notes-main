# Low-Level Design — Complete Roadmap

**Curated by Vamsi Karuturi** | Backend Engineer @ Salesforce | [topmate.io/vamsi_krishna13](https://topmate.io/vamsi_krishna13)

---

## The LLD Learning Roadmap

Follow these phases sequentially. Each builds on the previous one.
**Estimated total time**: 3–4 months for interview readiness.

---

### Phase 1: OOP & Design Foundations (2–3 weeks)

- [x] Master OOP pillars: Encapsulation, Inheritance, Polymorphism, Abstraction
- [x] SOLID Principles — Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
- [x] DRY (Don't Repeat Yourself), KISS (Keep It Simple), YAGNI (You Aren't Gonna Need It)
- [x] UML: Class diagrams, Sequence diagrams, State diagrams — draw them for every problem
- [x] Java specifics: Interfaces vs Abstract classes, when to use each

### Phase 2: Design Patterns (3–4 weeks)

- [x] **Creational**: Singleton (thread-safe), Factory, Abstract Factory, Builder, Prototype
- [x] **Structural**: Adapter, Decorator, Proxy, Facade, Composite, Flyweight, Bridge
- [x] **Behavioral**: Strategy, Observer, Command, State, Chain of Responsibility, Template Method, Iterator, Mediator
- [x] For each pattern: understand the problem it solves, draw a class diagram, code it in Java
- [x] Know which patterns are used in Java SDK (e.g. Iterator, Decorator in I/O streams)

### Phase 3: Machine Coding Problems (4–5 weeks)

- [x] **Parking Lot System** — spot allocation, multiple levels, different vehicle types, payment
- [x] **Library Management System** — books, members, borrowing, overdue fines
- [x] **Vending Machine** — item selection, payment processing, change dispensing, state machine
- [x] **ATM System** — withdrawal, deposit, balance, PIN validation, card blocking
- [x] **Online Movie Ticket Booking** — theater, shows, seat selection, concurrent booking
- [x] **Chess / Snake & Ladder** — extensible board games with rule isolation
- [x] **Cab Booking (Ola/Uber)** — driver matching, ride lifecycle, pricing
- [x] **Food Delivery (Swiggy/Zomato)** — restaurant, menu, cart, order, delivery tracking
- [x] **Hotel Booking (OYO)** — room types, inventory, booking window, cancellation
- [x] **Splitwise** — expense groups, settlement optimization, user balance tracking

### Phase 4: Concurrency & Java-Specific LLD (2–3 weeks)

- [x] Thread safety in Singleton, Producer-Consumer, Bounded Buffer patterns
- [x] Java concurrency: `ReentrantLock`, `Semaphore`, `CountDownLatch`, `CyclicBarrier`
- [x] `ExecutorService` — `ThreadPoolExecutor`, `ScheduledExecutorService`
- [x] Concurrent collections: `ConcurrentHashMap`, `CopyOnWriteArrayList`, `BlockingQueue`
- [x] Deadlock detection, avoidance, and resolution strategies
- [x] Immutability as a concurrency strategy — design immutable value objects

### Phase 5: Real-World & Advanced LLD (2–3 weeks)

- [x] Event-driven design — Observer vs EventBus vs Kafka-style pub/sub in-process
- [x] Plugin/Extension architectures — designing for extensibility without modification
- [x] Rate limiting patterns — Token Bucket, Leaky Bucket, Sliding Window
- [x] Caching at the class level — LRU Cache, LFU Cache implementations from scratch
- [x] Database interaction patterns — Repository pattern, DAO, Unit of Work
- [x] API design — designing clean Java interfaces before implementation
- [x] Refactoring existing code for SOLID compliance (real interview scenario)

---

## LLD Interview Questions Bank

These are the most frequently asked LLD questions across **Salesforce, Microsoft, Amazon, Google, Flipkart, Uber**, and other top-tier companies.

### Machine Coding Problems

| # | Question | Key Concepts |
|---|---|---|
| 1 | Design a Parking Lot System | OOP, Strategy, State, Singleton |
| 2 | Design a Library Management System | Encapsulation, Observer, Repository |
| 3 | Design a Vending Machine | State pattern, OCP, encapsulation |
| 4 | Design Snake & Ladder (with concurrency) | State, Strategy, Concurrency |
| 5 | Design a Chess Game | Factory, Strategy, Board modelling |
| 6 | Design an ATM System | State machine, Chain of Responsibility |
| 7 | Design BookMyShow / Movie Ticket Booking | Concurrency, Facade, Observer |
| 8 | Design an LRU Cache | HashMap + DLL, O(1) operations |
| 9 | Design a Rate Limiter (Token Bucket / Sliding Window) | Strategy, concurrency |
| 10 | Design a Cab Booking System (Ola/Uber) | Strategy, Observer, Factory |
| 11 | Design a Food Delivery App (Swiggy) | Composite, Builder, Observer |
| 12 | Design a Logging Framework | Singleton, Chain of Responsibility, Builder |
| 13 | Design a Notification System | Observer, Strategy, Factory |
| 14 | Design a Task Scheduler / Job Scheduler | ThreadPool, Priority Queue, Cron |
| 15 | Design Splitwise / Expense Sharing | Graph, Strategy, settlement algos |
| 16 | Design an Online Voting System | Concurrency, Idempotency, State |
| 17 | Design a File System (in-memory) | Composite pattern, Tree structure |
| 18 | Design a Shopping Cart with discounts | Strategy, Decorator, Builder |

### Design Principles & Pattern Questions

| # | Question | Key Concepts |
|---|---|---|
| 1 | Explain SOLID with a real example from your code | All 5 SOLID principles |
| 2 | When would you use Strategy vs State pattern? | Pattern trade-offs |
| 3 | How would you make Singleton thread-safe in Java? | DCL, Enum Singleton |
| 4 | How does the Decorator pattern differ from Inheritance? | Composition vs Inheritance |
| 5 | When should you use Factory vs Abstract Factory? | Creational patterns |
| 6 | Explain the Observer pattern with a real-world scenario | Loose coupling, event-driven |
| 7 | How would you refactor a God class for SRP? | Decomposition, SRP |
| 8 | When is it okay to break the Open/Closed Principle? | OCP pragmatics |
| 9 | Difference between Proxy and Decorator pattern? | Structural pattern distinction |
| 10 | How would you design an extensible payment gateway? | Strategy, OCP, interface design |

### Java Concurrency LLD Questions

| # | Question | Key Concepts |
|---|---|---|
| 1 | Design a thread-safe Bounded Blocking Queue | `ReentrantLock`, `Condition` |
| 2 | Implement a thread-safe LRU Cache | `ConcurrentHashMap`, `LinkedHashMap` |
| 3 | Design a Producer-Consumer system | `BlockingQueue`, `ExecutorService` |
| 4 | How would you handle concurrent seat booking? | Optimistic locking, Redis |
| 5 | Design a connection pool from scratch | `Semaphore`, object pooling |
| 6 | Explain deadlock with example and how to prevent it | Lock ordering, `tryLock` |
| 7 | Design a pub/sub event bus (in-process) | Observer, `ConcurrentHashMap` |

---

## Interview Execution Framework

When you walk into a machine coding or LLD round, follow this structure **every time**:

| Step | Action | Time |
|---|---|---|
| **1** | **Clarify requirements** — Ask scope, actors, core flows, edge cases. Don't jump to code. | 5 min |
| **2** | **Identify entities & relationships** — List nouns (classes) and verbs (methods). Draw a rough class diagram. | 5 min |
| **3** | **Apply design patterns** — Identify where patterns fit naturally. Don't force patterns. | 3 min |
| **4** | **Code the core flow first** — Get working code for the happy path before handling edge cases. | 25 min |
| **5** | **Talk through extensions** — Tell the interviewer how your design handles new requirements. This is the seniority signal. | 5 min |

---

## Common Mistakes to Avoid

!!! danger "Red flags in LLD interviews"
    - Starting to code before clarifying requirements
    - Using inheritance where composition fits better
    - Over-engineering with patterns that aren't needed
    - Missing thread safety when the problem clearly needs it
    - Not separating interfaces from implementations (violates DIP)
    - Using public fields instead of encapsulating state
    - Writing God classes — one class doing everything
    - Forgetting to ask about extensibility requirements

---

<div style="text-align: center; padding: 2rem 1rem; margin-top: 2rem; background: var(--vtn-gradient-subtle); border-radius: var(--vtn-radius); border: 1px solid var(--vtn-border);">

**Need a mock LLD interview or code review?**

[Book a 1:1 on Topmate](https://topmate.io/vamsi_krishna13){ .md-button .md-button--primary }

100+ sessions | 90%+ placement rate | Ex-Walmart, now Salesforce

</div>
