---
title: "Hibernate & JPA Interview Questions — Top 35 with Answers"
description: "Top Hibernate and JPA interview questions with answers. Covers entity lifecycle, caching, lazy vs eager loading, N+1 problem, transactions, JPQL, criteria API, and Spring Data JPA — asked at FAANG and top Java shops."
---

# Hibernate & JPA Interview Questions

Hibernate and JPA are tested in every Spring Boot backend interview. This page covers the 35 most frequently asked questions with concise, interview-ready answers — from entity lifecycle to the N+1 problem and caching internals asked at Amazon, Salesforce, and top product companies.

**What interviewers test:** Not just annotations, but whether you can explain the entity lifecycle, diagnose N+1 queries in production, understand first vs second-level cache, and know when `@Transactional` interacts with Hibernate's session.

---

## JPA Fundamentals

**1. What is JPA? What is the difference between JPA and Hibernate?**

**JPA (Jakarta Persistence API)** is a specification — defines the standard annotations (`@Entity`, `@Table`, `@Id`, `@OneToMany`) and the `EntityManager` API. **Hibernate** is the most popular *implementation* of JPA. Spring Boot auto-configures Hibernate as the JPA provider. You can swap Hibernate for EclipseLink without changing JPA annotations.

**2. What is an Entity?**

A Java class mapped to a database table. Requirements: `@Entity` annotation, a no-arg constructor (can be `protected`), and a field annotated with `@Id`. Each instance represents a row.

```java
@Entity
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String status;
    // ...
}
```

**3. What are the `@GeneratedValue` strategies?**

| Strategy | How it works | Use when |
|---|---|---|
| `IDENTITY` | DB auto-increment column | MySQL, PostgreSQL — simplest |
| `SEQUENCE` | DB sequence object | PostgreSQL, Oracle — batch-friendly |
| `TABLE` | Dedicated ID table | Portable but slow |
| `AUTO` | JPA picks based on DB | Avoid — unpredictable in production |
| `UUID` | Java-generated UUID | Distributed systems, no DB round-trip |

Prefer `SEQUENCE` on PostgreSQL — sequences can be pre-allocated (`allocationSize=50`) for batching.

**4. What is the Entity Lifecycle?**

```
New (Transient) → Managed (Persistent) → Detached → Removed
```

- **Transient:** `new Order()` — not associated with any session, not in DB
- **Managed:** returned by `find()`, `persist()`, or JPQL query — changes tracked by Hibernate's dirty checking
- **Detached:** session closed or `detach()` called — was managed, now Hibernate ignores changes
- **Removed:** `remove()` called — will be deleted at flush/commit

→ Deep dive: [Hibernate Internals](../springboot/hibernate-internals.md)

---

## Session & Persistence Context

**5. What is the Persistence Context?**

The **first-level cache** — a unit-of-work containing all managed entities for the current session. Hibernate tracks changes to managed entities and synchronizes them with the DB at flush time. One persistence context per `EntityManager` / Spring `@Transactional` method.

**6. What is dirty checking?**

Hibernate snapshots entity state when loaded. At flush time, it compares current state with the snapshot — if different, it generates an UPDATE. You don't call `save()` for updates — just modify the managed entity and the transaction commit flushes the change automatically.

```java
@Transactional
public void updateStatus(Long id, String status) {
    Order order = entityManager.find(Order.class, id); // managed
    order.setStatus(status); // dirty — no explicit save needed
} // commit → flush → UPDATE
```

**7. What is `flush()` and when does it happen?**

`flush()` synchronizes the persistence context with the database — executes pending INSERT/UPDATE/DELETE SQL. Does **not** commit the transaction. Flush modes:
- `AUTO` (default): flush before JPQL/criteria queries on the same entity, and before commit
- `COMMIT`: flush only on commit
- `MANUAL`: only when you call `flush()` explicitly

---

## Associations & Loading

**8. What is the difference between `@OneToMany`, `@ManyToOne`, `@OneToOne`, `@ManyToMany`?**

| Annotation | Example | Owning side |
|---|---|---|
| `@ManyToOne` | Many Orders → One Customer | Orders table (FK column here) |
| `@OneToMany` | One Customer → Many Orders | Usually mapped by `@ManyToOne` |
| `@OneToOne` | Order ↔ Invoice | Side with FK column |
| `@ManyToMany` | Students ↔ Courses | Either side; join table needed |

**9. What is the difference between `EAGER` and `LAZY` loading?**

- **`EAGER`:** associated entity is loaded immediately with the parent — one query (or a join). Default for `@ManyToOne`, `@OneToOne`.
- **`LAZY`:** associated entity is loaded on first access — proxy placeholder until accessed. Default for `@OneToMany`, `@ManyToMany`.

**Best practice:** always use `LAZY` loading. Load associations explicitly with `JOIN FETCH` when needed. `EAGER` causes unexpected queries and `LazyInitializationException` when misconfigured.

**10. What is `LazyInitializationException` and how do you fix it?**

Thrown when you access a lazy-loaded association **outside** an active session:

```java
Order order = repo.findById(id).get();
// session closes here (transaction ends)
order.getItems().size(); // LazyInitializationException!
```

Fixes:
1. `JOIN FETCH` in JPQL: `SELECT o FROM Order o JOIN FETCH o.items WHERE o.id = :id`
2. `@EntityGraph`: `@EntityGraph(attributePaths = {"items"})`
3. Keep transaction open (avoid open-session-in-view in production)
4. Use a DTO projection — fetch only what you need

**11. What is the N+1 problem?**

Loading 100 orders and accessing each order's `items` triggers 100 additional queries (1 for orders + N for each item collection).

```java
// N+1 — don't do this
List<Order> orders = repo.findAll(); // 1 query
orders.forEach(o -> o.getItems().size()); // 100 queries!
```

Fixes:
```java
// JOIN FETCH — one query with a join
@Query("SELECT o FROM Order o JOIN FETCH o.items")
List<Order> findAllWithItems();

// @EntityGraph
@EntityGraph(attributePaths = {"items"})
List<Order> findAll();

// @BatchSize — batch-loads associations in chunks
@BatchSize(size = 25) // 4 queries instead of 100
```

→ Deep dive: [N+1 Problem & JPA Internals](../springboot/n-plus-one-jpa.md)

---

## Caching

**12. What is the First-Level Cache?**

The persistence context (session) itself is the first-level cache. Within one session, calling `find(Order.class, 1L)` twice returns the same object — no second DB hit. Scoped to one session. Cannot be disabled. Cleared on `detach()`, `clear()`, or session close.

**13. What is the Second-Level Cache?**

A **session-factory-scoped** cache — shared across sessions. Must be explicitly enabled and configured (Ehcache, Caffeine, Redis). Caches entity state by primary key. Use for: read-mostly reference data (countries, categories, config).

```java
@Entity
@Cacheable
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
public class Country { ... }
```

**14. What is the Query Cache?**

Caches JPQL/HQL query **result sets** (not entities — just IDs). Must be combined with second-level cache (entities cached separately by ID). Only useful for queries that run frequently with the same parameters and rarely change results.

---

## JPQL & Criteria API

**15. What is JPQL?**

**Jakarta Persistence Query Language** — SQL-like but operates on **entity classes and fields**, not tables and columns. Database-agnostic.

```java
// JPQL — entity-oriented
@Query("SELECT o FROM Order o WHERE o.status = :status AND o.customer.id = :cid")
List<Order> findByStatusAndCustomer(@Param("status") String status, @Param("cid") Long cid);

// vs SQL — table-oriented
SELECT * FROM orders WHERE status = ? AND customer_id = ?
```

**16. What is the Criteria API and when would you use it?**

Programmatic, type-safe query building — useful when query structure is dynamic (filters applied based on user input). Verbose but compiler-checked.

```java
CriteriaBuilder cb = em.getCriteriaBuilder();
CriteriaQuery<Order> cq = cb.createQuery(Order.class);
Root<Order> root = cq.from(Order.class);
cq.where(cb.equal(root.get("status"), "PENDING"));
List<Order> results = em.createQuery(cq).getResultList();
```

For complex dynamic queries, prefer Spring Data JPA **Specifications** (wraps Criteria API).

→ Deep dive: [Spring Data JPA](../springboot/spring-data-jpa.md) · [Specifications & Dynamic Queries](../springboot/specifications-dynamic-queries.md)

---

## Spring Data JPA

**17. What is Spring Data JPA and how does it relate to Hibernate?**

Spring Data JPA is an abstraction over JPA — provides `JpaRepository` with boilerplate CRUD, query derivation from method names, and `@Query` for custom JPQL. Uses Hibernate (or another JPA provider) underneath. You almost never touch `EntityManager` directly when using Spring Data JPA.

**18. How does Spring Data JPA derive queries from method names?**

```java
// Method name → auto-generated JPQL
List<Order> findByStatusAndCreatedDateAfter(String status, LocalDate date);
// → SELECT o FROM Order o WHERE o.status = ? AND o.createdDate > ?

Optional<User> findByEmailIgnoreCase(String email);
List<Product> findTop5ByPriceOrderByCreatedDateDesc(BigDecimal price);
```

**19. What is the difference between `save()` and `saveAndFlush()`?**

`save()` — persists/merges in the persistence context, flushed at end of transaction. `saveAndFlush()` — immediately flushes to DB (executes SQL now). Use `saveAndFlush()` when you need the DB to reflect the change immediately (e.g., before a native query in the same transaction).

**20. What is `@Modifying` and when do you need it?**

Required for `@Query` methods that execute UPDATE or DELETE statements — tells Spring Data JPA this is not a SELECT:

```java
@Modifying
@Transactional
@Query("UPDATE Order o SET o.status = :status WHERE o.id = :id")
int updateStatus(@Param("id") Long id, @Param("status") String status);
```

---

## Transactions with JPA

**21. How does `@Transactional` interact with Hibernate?**

`@Transactional` opens a Hibernate session (persistence context) at the start and closes it at commit/rollback. Within the transaction, all loaded entities are managed — dirty checking works. Once the transaction ends, entities become detached.

**22. What is the `open-session-in-view` pattern and why is it controversial?**

Spring Boot enables `spring.jpa.open-in-view=true` by default — keeps the Hibernate session open through the entire HTTP request (including view rendering). Allows lazy loading in controllers/views without `LazyInitializationException`. But: ties DB resources to web layer, masks N+1 issues, hurts performance under load. **Disable in production** — use DTOs and fetch what you need in the service layer.

---

## Quick-Fire Questions

**23. What is `@Embeddable` and `@Embedded`?**
Map a value object (no own identity) into a parent entity's table. `@Embeddable` marks the class; `@Embedded` on the field in the entity. E.g., `Address` embedded in `User` — no separate table.

**24. What is `@MappedSuperclass`?**
Common fields (id, createdAt, updatedAt) in a base class shared by multiple entities. The base class is not mapped to a table — its fields are added to each subclass table.

**25. What is `CascadeType.ALL` and when is it dangerous?**
Propagates all operations (persist, merge, remove, refresh, detach) from parent to child. `CascadeType.REMOVE` is dangerous on `@ManyToMany` — deleting one student deletes all their courses from the join table AND cascades remove to Course entities. Use `CascadeType.PERSIST` and `CascadeType.MERGE` selectively.

**26. What is `orphanRemoval = true`?**
Automatically deletes child entities removed from the parent's collection. `order.getItems().remove(item)` → item deleted from DB on flush. Only use with `@OneToMany` where the child has no meaning without the parent.

**27. What is `@Version` used for?**
Optimistic locking — Hibernate increments the version column on every update. If two transactions update the same entity simultaneously, the second throws `OptimisticLockException`. Prevents lost updates without pessimistic DB locking.

**28. What is `FetchType.LAZY` on `@ManyToOne`?**
Default is `EAGER` for `@ManyToOne`. Overriding to `LAZY` (`@ManyToOne(fetch = FetchType.LAZY)`) creates a proxy for the associated entity — improves performance when the association is rarely needed.

**29. What is `@NamedQuery`?**
Pre-compiled JPQL query defined at the entity level — validated at startup, slightly faster. Less flexible than `@Query` in repositories. Rarely used in Spring Data JPA.

**30. What is the difference between `merge()` and `persist()`?**
`persist()` — make a transient entity managed (INSERT). Throws if entity already exists with that ID. `merge()` — synchronize a detached entity's state with the DB (UPDATE if exists, INSERT if not). Returns the managed copy — always use the returned instance.

**31. What is Hibernate's `show_sql` and `format_sql` property?**
`spring.jpa.show-sql=true` logs all SQL to console. `spring.jpa.properties.hibernate.format_sql=true` formats it readably. Essential for development — reveals N+1 issues and unexpected queries.

**32. What is a `ConstraintViolationException`?**
Thrown when a DB constraint fails (unique, not-null, FK). Spring translates it to `DataIntegrityViolationException`. Handle it at the service layer — don't let it propagate to the controller.

**33. What is the `@Transient` annotation?**
Marks a field that should NOT be persisted to the database — Hibernate ignores it. Different from `transient` keyword (which affects Java serialization).

**34. What is connection pooling in Spring Boot JPA?**
Spring Boot auto-configures HikariCP — the fastest JDBC connection pool. Key settings: `maximum-pool-size` (default 10), `minimum-idle`, `connection-timeout`, `idle-timeout`. Size the pool to match your DB's max connections ÷ number of app instances.

**35. What is the difference between `@OneToMany(mappedBy=...)` and a join column?**
`mappedBy` declares the non-owning side of a bidirectional relationship — the FK column lives on the other side. Without `mappedBy`, JPA creates a join table. With `@JoinColumn` on the `@OneToMany`, the FK is in the child table (rare — usually `@ManyToOne` on the child side owns the FK).

---

## Go Deeper

- [Hibernate & JPA Internals](../springboot/hibernate-internals.md)
- [Spring Data JPA](../springboot/spring-data-jpa.md)
- [N+1 Problem & JPA Internals](../springboot/n-plus-one-jpa.md)
- [Transactions](../springboot/transactions.md)
- [Specifications & Dynamic Queries](../springboot/specifications-dynamic-queries.md)
- [Hibernate Deep Dive (Sessions & Caching)](../springboot/hibernate-standalone.md)
