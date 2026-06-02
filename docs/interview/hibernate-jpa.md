---
description: "Top 35 Hibernate & JPA interview questions with detailed answers — caching, lazy loading, N+1 problem, locking, and Spring Data JPA. Asked at Amazon, Google, Flipkart."
---

# Top 35 Hibernate & JPA Interview Questions & Answers

!!! tip "Why Hibernate & JPA in Interviews?"
    Hibernate and JPA are foundational for any Java backend role. Interviewers expect you to understand the specification vs implementation distinction, caching layers, fetching strategies, locking mechanisms, and how Spring Data JPA simplifies data access.

---

## Core Concepts

??? question "Q1: What is ORM, and why do we need it?"

    **Answer:** ORM (Object-Relational Mapping) is a programming technique that maps Java objects to relational database tables, bridging the "impedance mismatch" between object-oriented domain models and tabular SQL storage.

    **Why:** Interviewers ask this to verify you understand the fundamental problem ORM solves -- the structural disconnect between inheritance/polymorphism/encapsulation in OOP and flat rows/columns/foreign-keys in RDBMS. Without ORM, you write repetitive JDBC boilerplate for every entity, handle type conversions manually, and lose compile-time safety.

    **How:** An ORM framework introspects entity metadata (annotations or XML), generates SQL at runtime, manages object identity (ensures one instance per row per session), tracks dirty state, and handles relationship traversal transparently.

    ```java
    // Without ORM (JDBC) -- verbose, error-prone
    PreparedStatement ps = conn.prepareStatement("SELECT * FROM employee WHERE id = ?");
    ps.setLong(1, id);
    ResultSet rs = ps.executeQuery();
    if (rs.next()) { emp.setName(rs.getString("name")); ... }

    // With ORM (JPA) -- concise, type-safe
    Employee emp = entityManager.find(Employee.class, id);
    ```

    | Aspect | JDBC | ORM |
    |--------|------|-----|
    | Boilerplate | High (ResultSet mapping) | Minimal |
    | SQL injection risk | Higher (manual params) | Lower (parameterized by default) |
    | Caching | Manual | Built-in L1/L2 |
    | Relationship navigation | Manual joins | Transparent lazy loading |

    **When to use:** Almost all enterprise Java apps benefit from ORM. Exceptions include ultra-low-latency systems, report-heavy batch SQL, or when you need full control over every query.

    **Gotchas:** ORM is not a silver bullet -- it can generate inefficient SQL (N+1), hide performance issues behind abstractions, and make debugging harder if you do not understand the generated queries. Always enable SQL logging during development.

??? question "Q2: What is the difference between JPA and Hibernate?"

    **Answer:** JPA (Jakarta Persistence API) is a specification defining interfaces, annotations, and behavioral contracts for ORM in Java. Hibernate is the most widely used implementation of that specification, providing the actual runtime engine.

    **Why:** This is asked to ensure you understand the spec-vs-implementation pattern. Coding to JPA means you can swap providers (EclipseLink, OpenJPA) without rewriting business logic -- a key architectural principle.

    **How:** JPA defines what `EntityManager.persist()` should do; Hibernate's `SessionImpl` contains the actual code that executes it. At deployment, the JPA bootstrap mechanism (`Persistence.createEntityManagerFactory`) discovers the provider via `META-INF/persistence.xml` or Spring auto-configuration.

    | Aspect | JPA | Hibernate |
    |--------|-----|-----------|
    | Type | Specification (JSR 338 / Jakarta Persistence 3.1) | Implementation (provider) |
    | Package | `jakarta.persistence.*` | `org.hibernate.*` |
    | Query Language | JPQL (strict subset) | HQL (superset: `WITH` clause, list params, etc.) |
    | Extras | None | `@Formula`, `@BatchSize`, `@NaturalId`, Envers, `@Filter`, multi-tenancy |
    | Portability | Provider-agnostic | Hibernate-specific features lock you in |

    ```java
    // JPA-standard (portable)
    @PersistenceContext
    private EntityManager em;

    // Accessing Hibernate-specific API when needed
    Session session = em.unwrap(Session.class);
    session.byNaturalId(User.class).using("email", email).load();
    ```

    **When to use:** Always start with JPA annotations. Drop to Hibernate APIs only for features JPA lacks -- `@NaturalId`, `@Filter`, batch size hints, Envers auditing, or advanced multi-tenancy.

    **Gotchas:** Some Hibernate behaviors subtly differ from the JPA spec (e.g., `flush()` timing, cascade semantics on `merge()`). If you rely on Hibernate-specific behavior, switching providers later becomes painful. Also, `hbm2ddl.auto` and `@Formula` are purely Hibernate -- they will not port to EclipseLink.

??? question "Q3: Describe the four entity lifecycle states in JPA."

    **Answer:** Every JPA entity exists in one of four states -- Transient, Managed, Detached, or Removed -- which determine whether changes are tracked and eventually synchronized to the database.

    **Why:** Understanding lifecycle states is critical because it explains why `save()` sometimes issues INSERT vs UPDATE, why `LazyInitializationException` occurs, and how dirty checking works. Interviewers use this to gauge your understanding of the persistence context.

    **How:**

    | State | In Persistence Context? | In Database? | Description |
    |-------|:-----------------------:|:------------:|-------------|
    | **Transient** | No | No | Newly created with `new`; JPA is completely unaware |
    | **Managed** | Yes | Yes (or pending INSERT) | Tracked by L1 cache; changes auto-synced on flush |
    | **Detached** | No | Yes | Was managed but session closed or `detach()`/`clear()` called |
    | **Removed** | Yes (marked for deletion) | Yes (pending DELETE) | Scheduled for removal on next flush |

    ```
    new Entity()          persist()           flush()
        |                    |                   |
    [Transient] --------> [Managed] --------> [DB INSERT]
                             |   ^
                  detach()/  |   | merge()
                  close()   v   |
                         [Detached]
                             
    [Managed] --remove()--> [Removed] --flush()--> [DB DELETE]
    ```

    ```java
    Employee emp = new Employee("Alice");   // Transient
    em.persist(emp);                        // Managed (INSERT queued)
    emp.setSalary(90000);                   // Dirty checking tracks this
    em.detach(emp);                         // Detached (no longer tracked)
    Employee merged = em.merge(emp);        // Returns NEW Managed copy
    em.remove(merged);                      // Removed (DELETE queued)
    ```

    **When to use:** Know this to predict Hibernate behavior -- only Managed entities get dirty-checked. Use `merge()` to reattach DTOs from the web layer. Use `detach()` to prevent accidental writes.

    **Gotchas:** `merge()` returns a NEW managed instance -- the original remains detached. Calling setters on the original after merge has no effect. Also, accessing a lazy collection on a Detached entity throws `LazyInitializationException` unless you use OSIV or fetch eagerly before detaching.

??? question "Q4: What is the difference between Session and SessionFactory?"

    **Answer:** `SessionFactory` is a heavyweight, thread-safe, immutable factory created once at application startup that holds all compiled entity metadata, the L2 cache, and connection pool configuration. `Session` is a lightweight, short-lived, single-threaded unit of work that wraps a JDBC connection and serves as the L1 cache (persistence context).

    **Why:** Interviewers test whether you understand Hibernate's architecture -- misusing these leads to connection leaks, threading bugs, and memory issues. Creating a `SessionFactory` per request is a classic anti-pattern that kills performance.

    **How:**

    | Aspect | SessionFactory | Session |
    |--------|---------------|---------|
    | Lifecycle | Application-scoped (singleton) | Request/transaction-scoped |
    | Thread safety | Thread-safe | NOT thread-safe |
    | Weight | Heavy (~MB of metadata) | Light (~KB per instance) |
    | Creation cost | Expensive (parses mappings, validates) | Cheap (borrows pooled connection) |
    | Cache | Holds L2 cache + query cache | Holds L1 cache (identity map) |
    | JPA equivalent | `EntityManagerFactory` | `EntityManager` |

    ```java
    // Application startup -- once
    SessionFactory sf = new Configuration().configure().buildSessionFactory();

    // Per request/transaction
    try (Session session = sf.openSession()) {
        Transaction tx = session.beginTransaction();
        session.persist(entity);
        tx.commit();
    } // session closed, L1 cache cleared, connection returned to pool
    ```

    **When to use:** In Spring Boot, both are managed for you -- `EntityManagerFactory` (wrapping `SessionFactory`) is a singleton bean, and `EntityManager` is a request-scoped proxy injected via `@PersistenceContext`.

    **Gotchas:** Never store a `Session` in a static field or share across threads -- it causes unpredictable errors. If you need to access entities across multiple sessions (e.g., long-running batch), detach/merge explicitly. Also, `SessionFactory` is expensive to close -- doing so drops the L2 cache and connection pool.

??? question "Q5: How does EntityManager relate to Hibernate Session?"

    **Answer:** `EntityManager` is the JPA-standard interface for interacting with the persistence context, while Hibernate's `Session` is the proprietary implementation that provides the same functionality plus additional Hibernate-specific features. In a Hibernate-backed environment, every `EntityManager` delegates internally to a `Session`.

    **Why:** Interviewers ask this to see if you know when to use the standard API vs. the proprietary one, and to test your understanding of the delegation/adapter pattern in JPA's architecture.

    **How:** Spring creates a shared `EntityManager` proxy (via `@PersistenceContext`) that delegates to the underlying `SessionImpl`. The proxy is thread-safe because it binds to the current transaction's actual `Session` at invocation time.

    | EntityManager (JPA) | Session (Hibernate) | Notes |
    |---------------------|---------------------|-------|
    | `persist(entity)` | `persist(entity)` / `save(entity)` | `save()` returns generated ID immediately |
    | `merge(entity)` | `merge(entity)` / `update(entity)` | `update()` reattaches; `merge()` copies state |
    | `remove(entity)` | `delete(entity)` | Same semantics |
    | `find(Class, id)` | `get(Class, id)` | Both return null if not found |
    | `getReference(Class, id)` | `load(Class, id)` | Returns proxy; throws on access if not found |
    | `flush()` | `flush()` | Synchronize persistence context to DB |
    | `detach(entity)` | `evict(entity)` | Remove from L1 cache |

    ```java
    // Unwrap to access Hibernate-specific features
    Session session = entityManager.unwrap(Session.class);
    session.byNaturalId(User.class).using("email", "alice@example.com").load();
    session.enableFilter("activeOnly").setParameter("isActive", true);
    ```

    **When to use:** Prefer `EntityManager` for portability. Unwrap to `Session` only for Hibernate-specific features: natural IDs, filters, `@BatchSize` control, `ScrollableResults`, or `StatelessSession` for bulk operations.

    **Gotchas:** Hibernate's deprecated `save()`/`update()`/`saveOrUpdate()` methods have subtle behavioral differences from JPA's `persist()`/`merge()`. For example, `save()` executes INSERT immediately to generate the ID (for `IDENTITY` strategy), while `persist()` may defer it. Prefer the JPA methods for consistent behavior.

---

## Caching

??? question "Q6: Explain first-level cache vs second-level cache."

    **Answer:** The first-level (L1) cache is the persistence context itself -- a per-session identity map that guarantees one Java instance per database row within a transaction. The second-level (L2) cache is a shared, application-wide cache that survives session boundaries and reduces database hits across requests.

    **Why:** Caching is a top performance concern in Hibernate applications. Interviewers expect you to know which cache solves which problem, how they interact, and the consistency trade-offs.

    **How:**

    | Aspect | L1 Cache | L2 Cache |
    |--------|----------|----------|
    | Scope | Single `Session` / `EntityManager` | `SessionFactory` -- shared across all sessions |
    | Enabled | Always on (cannot disable) | Opt-in per entity (`@Cacheable`) |
    | Storage format | Full Java object references | Dehydrated state arrays (column values, not objects) |
    | Lifetime | Cleared when session closes or `clear()` called | Configurable TTL, max-size, eviction policy |
    | Thread safety | No (session is single-threaded) | Yes (provider handles concurrency) |
    | Provider | Built into Hibernate | Ehcache, Infinispan, Hazelcast, Caffeine via JCache |
    | Lookup key | Entity class + primary key | Entity class + primary key |

    **Lookup flow:** `find(Employee.class, 1)` -> check L1 -> miss -> check L2 -> miss -> hit DB -> store in L1 + L2.

    ```java
    @Entity
    @Cacheable
    @org.hibernate.annotations.Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
    public class Product { ... }
    ```

    ```properties
    spring.jpa.properties.hibernate.cache.use_second_level_cache=true
    spring.jpa.properties.hibernate.cache.region.factory_class=org.hibernate.cache.jcache.JCacheRegionFactory
    spring.jpa.properties.javax.persistence.sharedCache.mode=ENABLE_SELECTIVE
    ```

    **When to use:** L2 cache is ideal for read-heavy, rarely-changing reference data (countries, product categories, config). Avoid it for frequently-updated entities or when strong consistency is mandatory.

    **Gotchas:** L2 cache stores dehydrated state -- relationships are stored as FK IDs, so associated entities need their own cache region or you still hit the DB. Cache invalidation on bulk `UPDATE`/`DELETE` (JPQL) does NOT automatically evict L2 cache entries unless you call `evict()` or use `@CacheEvict`. Stale reads are possible in clustered environments without distributed cache replication.

??? question "Q7: What is the query cache and when should you use it?"

    **Answer:** The query cache stores the list of entity IDs (not full objects) returned by a JPQL/HQL query keyed by the query string + parameter values. On a cache hit, Hibernate uses those IDs to look up the actual entities from the L2 cache, avoiding the database entirely.

    **Why:** Interviewers ask this to test whether you understand how the query cache and L2 cache work together, and importantly, when the query cache hurts rather than helps.

    **How:** Hibernate maintains a `StandardQueryCache` region that maps `(query + params + result-set-hash)` -> `[list of entity IDs + a timestamp]`. It also maintains an `UpdateTimestampsCache` that tracks the last modification time of each table. On a query cache hit, Hibernate compares the cached timestamp against the table's last update -- if the table was modified after the cache entry was created, the entry is invalidated.

    ```java
    List<Product> products = em.createQuery(
            "SELECT p FROM Product p WHERE p.category = :cat", Product.class)
        .setParameter("cat", "electronics")
        .setHint("org.hibernate.cacheable", true)  // enable for this query
        .getResultList();
    ```

    ```properties
    spring.jpa.properties.hibernate.cache.use_query_cache=true
    spring.jpa.properties.hibernate.cache.use_second_level_cache=true
    ```

    **When to use:** Reference/lookup queries on rarely-changing data (e.g., "find all active categories", "find config by key") that execute frequently with the same parameters. The L2 entity cache must also be enabled for the target entities.

    **Gotchas:** ANY insert, update, or delete to a table invalidates ALL query cache entries involving that table -- even if the specific rows did not overlap. This makes the query cache counterproductive for tables with frequent writes. Also, without L2 cache enabled for the entities, each cached ID triggers an individual SELECT (worse than no cache). The query cache adds overhead for every query execution (timestamp checking), so enable it selectively, not globally.

---

## Fetching Strategies

??? question "Q8: What is the difference between Lazy and Eager loading?"

    **Answer:** `FetchType.LAZY` defers loading of an association until the application first accesses it (via a proxy or collection wrapper), while `FetchType.EAGER` loads the association immediately as part of the owning entity's query, typically via a JOIN or secondary SELECT.

    **Why:** Fetching strategy directly impacts query count, memory consumption, and response time. Interviewers expect you to know the defaults, the trade-offs, and the recommended approach.

    **How:** For lazy loading, Hibernate returns a proxy (for `@ManyToOne`/`@OneToOne`) or a persistent collection wrapper (for `@OneToMany`/`@ManyToMany`). When you call a method on the proxy or iterate the collection, Hibernate intercepts and issues the SQL. For eager loading, the SQL is issued at entity load time -- either as a JOIN in the same query or as an immediate secondary SELECT.

    | Aspect | LAZY | EAGER |
    |--------|------|-------|
    | Default for | `@OneToMany`, `@ManyToMany` | `@ManyToOne`, `@OneToOne` |
    | SQL timing | On first access | With parent query |
    | Memory | Lower (load only when needed) | Higher (always loaded) |
    | N+1 risk | Yes (if accessed in a loop) | No (but may load unused data) |
    | Override at query time | Can eagerly fetch with `JOIN FETCH` | Cannot make lazy at query time |

    ```java
    @OneToMany(mappedBy = "department", fetch = FetchType.LAZY)
    private List<Employee> employees;  // proxy -- loaded only when accessed

    @ManyToOne(fetch = FetchType.LAZY)  // override default EAGER
    private Department department;      // proxy until accessed
    ```

    **When to use:** Default ALL associations to `LAZY`. Then selectively fetch eagerly in specific queries using `JOIN FETCH`, `@EntityGraph`, or `@BatchSize`. This gives you control per use-case rather than a one-size-fits-all approach baked into the entity.

    **Gotchas:** (1) Eager fetching is a compile-time decision on the entity -- you cannot make it lazy at query time. Lazy is always overridable to eager, but not vice versa. (2) `LazyInitializationException` occurs when accessing a lazy proxy outside an open session. Solutions: OSIV (anti-pattern in APIs), DTOs, or fetch at query time. (3) Multiple eager `@OneToMany` collections on one entity cause a Cartesian product (MultipleBagFetchException) -- Hibernate cannot fetch multiple bags eagerly.

??? question "Q9: What is the N+1 select problem, and how do you solve it?"

    **Answer:** The N+1 problem occurs when loading a collection of N parent entities triggers N additional queries to load their associated children -- resulting in 1 (parent query) + N (child queries) = N+1 total database round trips.

    **Why:** This is the single most common Hibernate performance issue and nearly always asked in interviews. It can turn a simple page load into hundreds of queries, crippling response times. Interviewers want to see that you can diagnose it and apply the correct fix.

    **How:** It happens with `FetchType.LAZY` (default for collections) when you iterate parents and access each parent's children:

    ```java
    List<Department> depts = em.createQuery("SELECT d FROM Department d", Department.class)
        .getResultList(); // 1 query
    for (Department d : depts) {
        d.getEmployees().size(); // N queries (one per department)
    }
    ```

    **Solutions:**

    | Solution | Mechanism | Queries | Trade-off |
    |----------|-----------|---------|-----------|
    | **JOIN FETCH** | Single query with JOIN | 1 | Cartesian product risk with multiple collections |
    | **@EntityGraph** | Declarative attribute paths | 1 | Same as JOIN FETCH but cleaner for Spring Data |
    | **@BatchSize(size=N)** | Loads children in batches using `IN` clause | 1 + ceil(N/batch) | Good default; no query changes needed |
    | **@Fetch(SUBSELECT)** | Single subselect for ALL children | 2 | Loads all children even if not all parents are accessed |
    | **DTO Projection** | Select only needed columns | 1 | No entity management overhead |

    ```java
    // JOIN FETCH
    @Query("SELECT d FROM Department d JOIN FETCH d.employees")
    List<Department> findAllWithEmployees();

    // EntityGraph
    @EntityGraph(attributePaths = {"employees"})
    List<Department> findAll();

    // BatchSize on the entity mapping
    @OneToMany(mappedBy = "department")
    @BatchSize(size = 25)
    private List<Employee> employees;
    ```

    **When to use:** `JOIN FETCH` for single-collection eager loading. `@BatchSize` as a global safety net (set `hibernate.default_batch_fetch_size=16`). DTO projections when you only need specific fields.

    **Gotchas:** (1) `JOIN FETCH` with multiple collections causes a Cartesian product -- use `Set` instead of `List` or fetch one collection at a time. (2) `JOIN FETCH` with pagination (`setMaxResults`) applies pagination in-memory (Hibernate warns "firstResult/maxResults specified with collection fetch; applying in memory"). Use a two-query approach instead. (3) Detecting N+1 requires SQL logging -- always enable `hibernate.show_sql` or use tools like Hibernate Statistics or datasource-proxy in development.

---

## Mappings & Relationships

??? question "Q10: Explain @OneToMany, @ManyToOne, @ManyToMany, and @OneToOne mappings."

    **Answer:** These four annotations define the cardinality of relationships between JPA entities and control how foreign keys, join columns, and join tables are generated in the database schema.

    **Why:** Relationship mapping is the core of ORM. Interviewers ask this to verify you understand owning vs. inverse sides, join column placement, and the performance implications of each mapping type.

    **How:**

    | Annotation | Cardinality | FK Location | Default Fetch | Example |
    |------------|-------------|-------------|---------------|---------|
    | `@OneToOne` | 1:1 | Either side (owner has FK) | EAGER | User -- UserProfile |
    | `@ManyToOne` | N:1 | On the "many" side (this entity) | EAGER | Employee -- Department |
    | `@OneToMany` | 1:N | On the "many" side (child table) | LAZY | Department -- Employees |
    | `@ManyToMany` | M:N | Join table (auto or explicit) | LAZY | Student -- Course |

    ```java
    @Entity
    public class Department {
        @OneToMany(mappedBy = "department", cascade = CascadeType.ALL, orphanRemoval = true)
        private List<Employee> employees = new ArrayList<>();

        public void addEmployee(Employee emp) {  // sync both sides
            employees.add(emp);
            emp.setDepartment(this);
        }
    }

    @Entity
    public class Employee {
        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "dept_id")  // FK column in employee table
        private Department department;
    }

    @Entity
    public class Student {
        @ManyToMany
        @JoinTable(name = "enrollment",
            joinColumns = @JoinColumn(name = "student_id"),
            inverseJoinColumns = @JoinColumn(name = "course_id"))
        private Set<Course> courses = new HashSet<>();
    }
    ```

    **When to use:** `@ManyToOne` is the most common (FK on child). Always make it the owning side of a bidirectional `@OneToMany`. For `@ManyToMany`, prefer an explicit join entity (e.g., `Enrollment`) when you need extra columns on the relationship (grade, enrollDate).

    **Gotchas:** (1) Unidirectional `@OneToMany` without `@JoinColumn` creates a join table -- always specify `@JoinColumn` or use bidirectional with `mappedBy`. (2) Always synchronize both sides of bidirectional relationships (`parent.addChild(child)` + `child.setParent(parent)`). (3) `@OneToOne` with lazy loading does not work on the non-owning side (Hibernate cannot know if the association is null without querying) -- use `@MapsId` or bytecode enhancement. (4) Use `Set` for `@ManyToMany` -- `List` triggers full delete + re-insert on modification.

??? question "Q11: What does the mappedBy attribute do?"

    **Answer:** `mappedBy` declares the inverse (non-owning) side of a bidirectional relationship, telling Hibernate that the foreign key is managed by the specified field on the other entity -- so it should not create an additional join column or join table for this side.

    **Why:** Interviewers ask this because misunderstanding `mappedBy` is one of the most common causes of duplicate join tables, redundant FK columns, and unexpected INSERT/UPDATE behavior. It tests your grasp of the owning-side concept.

    **How:** In every bidirectional relationship, exactly ONE side owns the FK. The owning side is the one that actually writes to the FK column. The inverse side (with `mappedBy`) is read-only for relationship management -- changes to the inverse collection alone do NOT persist unless the owning side is also updated.

    ```java
    @Entity
    public class Department {
        // Inverse side -- "department" refers to Employee.department field
        @OneToMany(mappedBy = "department", cascade = CascadeType.ALL)
        private List<Employee> employees;
    }

    @Entity
    public class Employee {
        // Owning side -- this entity's table has the FK column
        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "dept_id")
        private Department department;
    }
    ```

    **Without `mappedBy`:**
    ```sql
    -- Hibernate creates an unnecessary join table:
    CREATE TABLE department_employees (department_id BIGINT, employees_id BIGINT);
    ```

    **With `mappedBy`:**
    ```sql
    -- Uses the existing FK in employee table:
    ALTER TABLE employee ADD COLUMN dept_id BIGINT REFERENCES department(id);
    ```

    **When to use:** Always on the "one" side of `@OneToMany`, and on one side of `@OneToOne` and `@ManyToMany` bidirectional relationships. The value must exactly match the Java field name on the owning entity.

    **Gotchas:** (1) Adding a child only to the `mappedBy` collection without setting the child's owning reference will NOT persist the relationship -- you must sync both sides. (2) The string value in `mappedBy` is the Java field name, not the database column name. (3) You cannot combine `mappedBy` with `@JoinColumn` on the same side -- they are mutually exclusive concepts.

??? question "Q12: What are the JPA Cascade types?"

    **Answer:** JPA Cascade types propagate persistence operations from a parent entity to its associated children, so you do not have to manually call `persist()`, `merge()`, or `remove()` on each child individually.

    **Why:** Interviewers test whether you understand lifecycle propagation and its dangers. Incorrect cascading is a common source of accidental deletions, orphaned records, and `TransientPropertyValueException`.

    **How:** When you perform an operation on the parent, Hibernate iterates the cascading associations and applies the same operation to each child:

    | Cascade Type | Effect | Example |
    |-------------|--------|---------|
    | `PERSIST` | Persisting parent also persists new children | Save order -> saves order items |
    | `MERGE` | Merging parent also merges children | Reattach detached order -> reattaches items |
    | `REMOVE` | Removing parent also removes children | Delete order -> deletes items |
    | `REFRESH` | Refreshing parent also refreshes children from DB | Reload order -> reloads items |
    | `DETACH` | Detaching parent also detaches children | Evict order -> evicts items from L1 |
    | `ALL` | All of the above combined | Full lifecycle propagation |

    ```java
    @Entity
    public class Order {
        @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
        private List<OrderItem> items = new ArrayList<>();
    }

    // Single persist saves both
    Order order = new Order();
    order.addItem(new OrderItem("Widget", 3));
    em.persist(order); // cascades PERSIST to OrderItem
    ```

    **When to use:** Use `CascadeType.ALL` for true composition (parent owns children's lifecycle entirely: Order/OrderItem, Post/Comment). Use `PERSIST` + `MERGE` for associations where children should be saved/updated with the parent but not deleted. Avoid cascade entirely for associations between independent aggregates (Employee/Department).

    **Gotchas:** (1) `REMOVE` on `@ManyToMany` will delete the shared entity from the database, not just the join row -- almost never what you want. (2) `PERSIST` cascade on a managed parent with a transient child works automatically, but `MERGE` on a detached parent with a new child requires `PERSIST` cascade too (or you get `TransientPropertyValueException`). (3) Cascade is NOT a database-level FK CASCADE -- it operates at the Hibernate level before SQL is generated. (4) Hibernate-specific `CascadeType.SAVE_UPDATE` (for `saveOrUpdate()`) is deprecated -- use JPA `PERSIST` + `MERGE` instead.

??? question "Q13: What is the difference between orphanRemoval and CascadeType.REMOVE?"

    **Answer:** `CascadeType.REMOVE` deletes child entities only when the parent entity itself is deleted. `orphanRemoval = true` goes further -- it deletes a child entity whenever it is removed from the parent's collection, even if the parent continues to exist.

    **Why:** This distinction is critical for correctly modeling composition relationships. Interviewers ask it because confusing the two leads to either orphaned rows or accidental data loss.

    **How:**

    | Scenario | `CascadeType.REMOVE` | `orphanRemoval = true` |
    |----------|---------------------|----------------------|
    | `em.remove(parent)` | Deletes all children | Deletes all children |
    | `parent.getChildren().remove(child)` | Child remains in DB (orphaned) | Child DELETE issued |
    | `parent.setChildren(newList)` | Old children remain in DB | Old children DELETEd |

    ```java
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    // Removing from collection triggers DELETE
    order.getItems().remove(0);  // SQL: DELETE FROM order_item WHERE id = ?

    // Replacing the collection triggers DELETE for all old items
    order.setItems(newItemList); // SQL: DELETE for each old item not in new list
    ```

    **Internally:** Hibernate tracks the "snapshot" of the collection at load time. During flush, it compares the current collection state to the snapshot. Any entity present in the snapshot but missing from the current collection is treated as an orphan and scheduled for deletion.

    **When to use:** Use `orphanRemoval = true` for strong composition where children have no meaning without the parent (OrderItem without Order, Phone without Contact). Use `CascadeType.REMOVE` alone when you only want cascade on parent deletion but children might be reassigned to other parents.

    **Gotchas:** (1) `orphanRemoval` implies `CascadeType.REMOVE` -- you do not need both explicitly. (2) Orphan removal only works on the owning side's collection changes -- it requires a bidirectional relationship with `mappedBy`. (3) If you use `orphanRemoval` on `@ManyToMany`, it will delete the entity itself, not just the join table row. (4) Clearing a collection (`items.clear()`) with orphanRemoval deletes ALL children -- make sure this is intentional. (5) Setting a child's parent reference to null does NOT trigger orphanRemoval -- you must remove it from the parent's collection.

---

## Primary Key Strategies

??? question "Q14: What are the @GeneratedValue strategies?"

    **Answer:** JPA provides four ID generation strategies that determine how primary key values are assigned: `AUTO`, `IDENTITY`, `SEQUENCE`, and `TABLE`. The choice significantly impacts batch insert performance and portability.

    **Why:** Interviewers ask this because the ID strategy directly affects whether JDBC batching works, how many round trips are needed for inserts, and whether your application can scale writes efficiently.

    **How:**

    | Strategy | Mechanism | Pros | Cons |
    |----------|-----------|------|------|
    | `AUTO` | Hibernate picks based on DB dialect | Portable | Unpredictable; may choose TABLE on some dialects |
    | `IDENTITY` | DB auto-increment (`AUTO_INCREMENT`, `SERIAL`) | Simple, no extra objects | **Disables JDBC batch inserts** (must flush each INSERT to get ID) |
    | `SEQUENCE` | DB sequence object with pre-allocation | Supports batching; high throughput | Not natively on MySQL < 8.0 (Hibernate emulates) |
    | `TABLE` | Simulates sequence via a dedicated table row | Portable across all DBs | Very poor performance (row-level lock contention) |

    ```java
    // Recommended: SEQUENCE with allocation
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "emp_seq")
    @SequenceGenerator(name = "emp_seq", sequenceName = "employee_seq", allocationSize = 50)
    private Long id;
    ```

    **IDENTITY disables batching because:** Hibernate needs the generated ID immediately after INSERT to set it on the entity and maintain the persistence context identity map. With IDENTITY, the only way to get the ID is to execute the INSERT -- so Hibernate cannot group multiple INSERTs into a single batch.

    **SEQUENCE enables batching because:** Hibernate calls `SELECT nextval('seq')` to pre-allocate a range of IDs (e.g., 50 at once with `allocationSize=50`), assigns them in memory, and can then batch all 50 INSERTs in one JDBC batch call.

    **When to use:** `SEQUENCE` for any serious application (especially with batch inserts). `IDENTITY` only for simple apps where batching is not a concern. Avoid `TABLE` entirely -- it is a legacy fallback. `AUTO` is acceptable for prototyping.

    **Gotchas:** (1) `allocationSize` must match the DB sequence's INCREMENT BY value or you get duplicate key errors in clustered environments. (2) With `allocationSize=50`, IDs have gaps (1, 51, 101...) which is normal but surprises some teams. (3) On MySQL < 8.0, Hibernate 5 uses TABLE strategy when you specify `AUTO` -- upgrading to Hibernate 6 changes this to emulated SEQUENCE, potentially causing ID conflicts during migration. (4) UUID strategies (`@UuidGenerator`) avoid all these issues but increase index size and reduce range-scan performance.

??? question "Q15: How do you map composite keys -- @EmbeddedId vs @IdClass?"

    **Answer:** JPA offers two approaches for composite primary keys: `@EmbeddedId` encapsulates the key as a single embedded object on the entity, while `@IdClass` declares key fields directly on the entity and uses a separate class for lookups. Both require the key class to implement `Serializable`, `equals()`, and `hashCode()`.

    **Why:** Composite keys appear in legacy schemas, join tables with extra attributes, and natural-key designs. Interviewers want to see you understand both approaches and their trade-offs.

    **How:**

    | Aspect | @EmbeddedId | @IdClass |
    |--------|-------------|----------|
    | Key access | `entity.getId().getOrderId()` | `entity.getOrderId()` directly |
    | JPQL syntax | `SELECT o FROM OrderItem o WHERE o.id.orderId = :oid` | `SELECT o FROM OrderItem o WHERE o.orderId = :oid` |
    | Key reuse | Embeddable can be reused across entities | Class is just a lookup helper |
    | Clarity | Makes composite nature explicit | Looks like a regular entity |
    | find() call | `em.find(OrderItem.class, new OrderItemId(1L, 2L))` | Same |

    ```java
    // --- @EmbeddedId approach ---
    @Embeddable
    public class OrderItemId implements Serializable {
        private Long orderId;
        private Long productId;
        // equals() and hashCode() required
    }

    @Entity
    public class OrderItem {
        @EmbeddedId
        private OrderItemId id;

        @ManyToOne
        @MapsId("orderId")  // maps orderId field in the embedded key
        @JoinColumn(name = "order_id")
        private Order order;
    }

    // --- @IdClass approach ---
    public class OrderItemId implements Serializable {
        private Long orderId;
        private Long productId;
        // equals() and hashCode() required
    }

    @Entity
    @IdClass(OrderItemId.class)
    public class OrderItem {
        @Id private Long orderId;
        @Id private Long productId;
    }
    ```

    **When to use:** Prefer `@EmbeddedId` for new designs -- it makes the composite nature of the key explicit and allows `@MapsId` for derived identifiers. Use `@IdClass` when mapping legacy schemas where entity fields should not be nested, or when you want flatter JPQL queries.

    **Gotchas:** (1) `equals()` and `hashCode()` are mandatory -- without them, `em.find()` and `em.contains()` break. Use all key fields in both methods. (2) The key class must have a no-arg constructor. (3) With `@EmbeddedId`, do not annotate the key fields with `@Column` on the entity -- put column mappings inside the `@Embeddable` class. (4) `@GeneratedValue` cannot be used with composite keys -- values must be assigned manually or derived via `@MapsId`. (5) Prefer surrogate keys (`@Id Long id`) for new designs -- composite keys complicate relationships, caching, and URLs.

---

## Inheritance Mapping

??? question "Q16: What are the JPA inheritance mapping strategies?"

    **Answer:** JPA provides three strategies for mapping class hierarchies to relational tables: `SINGLE_TABLE` (all classes in one table with a discriminator), `JOINED` (one table per class joined via FK), and `TABLE_PER_CLASS` (one table per concrete class with duplicated columns).

    **Why:** Inheritance mapping is a classic ORM design decision that impacts query performance, schema normalization, and data integrity. Interviewers ask this to test your ability to choose the right strategy for a given domain.

    **How:**

    | Strategy | Tables | Polymorphic Query | NOT NULL constraints | Insert cost | Best For |
    |----------|--------|-------------------|---------------------|-------------|----------|
    | **SINGLE_TABLE** | 1 (discriminator column) | Fast (no JOIN) | Cannot enforce on subclass fields | 1 INSERT | Few subclass-specific fields |
    | **JOINED** | 1 per class (base + subclass tables) | Moderate (JOINs) | Full constraint support | N INSERTs (one per table in hierarchy) |  Normalized, many subclass fields |
    | **TABLE_PER_CLASS** | 1 per concrete class (all columns) | Slow (`UNION ALL`) | Full constraint support | 1 INSERT | Rare polymorphic queries |

    ```java
    // SINGLE_TABLE (default, fastest for polymorphic queries)
    @Entity
    @Inheritance(strategy = InheritanceType.SINGLE_TABLE)
    @DiscriminatorColumn(name = "payment_type", discriminatorType = DiscriminatorType.STRING)
    public abstract class Payment {
        @Id @GeneratedValue private Long id;
        private BigDecimal amount;
    }

    @Entity @DiscriminatorValue("CREDIT")
    public class CreditCardPayment extends Payment {
        private String cardNumber;  // nullable in DB even if required by business logic
    }

    @Entity @DiscriminatorValue("BANK")
    public class BankTransfer extends Payment {
        private String iban;
    }
    ```

    ```java
    // JOINED (normalized, full constraints)
    @Entity
    @Inheritance(strategy = InheritanceType.JOINED)
    public abstract class Vehicle {
        @Id @GeneratedValue private Long id;
        private String manufacturer;
    }

    @Entity
    @PrimaryKeyJoinColumn(name = "vehicle_id")
    public class Car extends Vehicle {
        private int seatCount;  // NOT NULL allowed
    }
    ```

    **When to use:** Start with `SINGLE_TABLE` for simple hierarchies (2-3 subclasses, few extra fields). Use `JOINED` when subclasses have many unique fields and you need data integrity (NOT NULL). Avoid `TABLE_PER_CLASS` unless polymorphic queries are rare and you want the simplest schema per concrete type.

    **Gotchas:** (1) `SINGLE_TABLE` cannot enforce NOT NULL on subclass columns (the column must allow NULL for rows of other subtypes). (2) `JOINED` queries become expensive with deep hierarchies (multiple JOINs). (3) `TABLE_PER_CLASS` does not support `IDENTITY` generation strategy (IDs must be unique across all tables). (4) You can also use `@MappedSuperclass` when you do NOT need polymorphic queries -- it shares fields without inheritance mapping. (5) Switching strategies on an existing schema requires data migration.

---

## Querying

??? question "Q17: Compare JPQL, Criteria API, and Native Query."

    **Answer:** JPA provides three query mechanisms: JPQL (string-based object query language), the Criteria API (programmatic, type-safe query builder), and Native Queries (raw SQL). Each serves different use cases and has distinct trade-offs in readability, type safety, and portability.

    **Why:** Interviewers ask this to assess whether you can select the appropriate query approach for a given situation -- static reports vs. dynamic search forms vs. database-specific optimizations.

    **How:**

    | Feature | JPQL | Criteria API | Native Query |
    |---------|------|-------------|--------------|
    | Syntax | String-based, SQL-like | Programmatic, fluent builder | Raw SQL |
    | Type safety | No (strings; runtime errors) | Yes (with metamodel) | No |
    | Dynamic queries | Concatenation (error-prone) | Excellent (conditional predicates) | Manual string building |
    | DB portability | Yes (entity/property names) | Yes | No (DB-specific SQL) |
    | Compile-time validation | No (use Named Queries for startup check) | Yes (metamodel) | No |
    | Performance | Query plan cached by string | Plan cached by structure | Sent directly to DB |
    | Best for | Static queries, readability | Dynamic search filters | DB-specific features, CTEs, window functions |

    ```java
    // JPQL -- readable, static queries
    List<Employee> emps = em.createQuery(
        "SELECT e FROM Employee e WHERE e.salary > :min AND e.department.name = :dept",
        Employee.class)
        .setParameter("min", 80000)
        .setParameter("dept", "Engineering")
        .getResultList();

    // Criteria API -- dynamic, type-safe
    CriteriaBuilder cb = em.getCriteriaBuilder();
    CriteriaQuery<Employee> cq = cb.createQuery(Employee.class);
    Root<Employee> root = cq.from(Employee.class);
    List<Predicate> predicates = new ArrayList<>();
    if (minSalary != null) predicates.add(cb.gt(root.get("salary"), minSalary));
    if (deptName != null) predicates.add(cb.equal(root.get("department").get("name"), deptName));
    cq.where(predicates.toArray(new Predicate[0]));
    List<Employee> results = em.createQuery(cq).getResultList();

    // Native Query -- when you need DB-specific features
    List<Employee> emps = em.createNativeQuery(
        "SELECT * FROM employee WHERE salary > ?1 ORDER BY salary DESC LIMIT 10",
        Employee.class)
        .setParameter(1, 80000)
        .getResultList();
    ```

    **When to use:** JPQL for 80% of queries (readable, portable). Criteria API for dynamic search screens with optional filters. Native queries for CTEs, window functions, full-text search, or performance-critical SQL that JPQL cannot express.

    **Gotchas:** (1) JPQL operates on entity names and field names, not table/column names -- `SELECT e FROM Employee e`, not `SELECT * FROM employee`. (2) Criteria API is verbose; consider Spring Specifications or QueryDSL for cleaner dynamic queries. (3) Native queries bypass Hibernate's flush-before-query behavior for JPQL -- manually flush first if needed. (4) Native queries return managed entities only if you pass the entity class; otherwise, you get `Object[]`.

??? question "Q18: What are Named Queries and why use them?"

    **Answer:** Named queries are statically declared JPQL or SQL queries defined at compile time via annotations (or XML). They are parsed, validated, and compiled into execution plans at application startup, catching syntax errors before any request hits the system.

    **Why:** Interviewers ask this to see if you understand the performance and reliability benefits of pre-compiled queries vs. ad-hoc query strings scattered throughout service code.

    **How:** At startup, Hibernate parses every `@NamedQuery` and `@NamedNativeQuery`, validates entity/field references against the metamodel, and stores the compiled query plan in a cache. Subsequent calls to `createNamedQuery()` skip parsing entirely and reuse the plan.

    ```java
    @Entity
    @NamedQueries({
        @NamedQuery(name = "Employee.findByDept",
            query = "SELECT e FROM Employee e WHERE e.department.name = :deptName"),
        @NamedQuery(name = "Employee.findHighEarners",
            query = "SELECT e FROM Employee e WHERE e.salary > :threshold ORDER BY e.salary DESC")
    })
    public class Employee { ... }

    // Usage -- no parsing overhead at runtime
    List<Employee> emps = em.createNamedQuery("Employee.findByDept", Employee.class)
        .setParameter("deptName", "Engineering")
        .getResultList();
    ```

    **Benefits:**

    | Benefit | Explanation |
    |---------|-------------|
    | Startup validation | Typos in entity/field names caught immediately |
    | Query plan caching | Parsed once, reused on every invocation |
    | Centralized | Queries defined on the entity, easy to find |
    | Refactoring safety | Rename a field -> startup fails -> you know to fix the query |
    | Hints support | Can attach lock modes, fetch size, cache hints at definition |

    **When to use:** For all static queries that do not change structure at runtime. In Spring Data JPA, repository derived queries and `@Query` annotations are effectively named queries under the hood (validated at startup).

    **Gotchas:** (1) Named query names must be globally unique across the persistence unit -- convention is `EntityName.methodName`. (2) You cannot build dynamic WHERE clauses with named queries -- use Criteria API for that. (3) Named native queries (`@NamedNativeQuery`) are NOT validated against the entity model at startup -- only SQL syntax is checked by the DB (if at all). (4) In Hibernate 6+, the query plan cache also benefits dynamic JPQL queries, narrowing the performance gap -- but startup validation remains the key advantage of named queries.

??? question "Q19: How do you implement pagination with JPA?"

    **Answer:** JPA supports pagination via `setFirstResult(offset)` and `setMaxResults(limit)` on queries. Spring Data JPA provides a higher-level abstraction with `Pageable`, `Page`, and `Slice` interfaces that handle count queries, sorting, and navigation metadata.

    **Why:** Pagination is essential for any API or UI that displays large datasets. Interviewers ask this to test whether you know the performance differences between offset-based and keyset-based pagination, and the gotchas with JOINs.

    **How:**

    ```java
    // JPA EntityManager -- offset-based
    List<Employee> page = em.createQuery("SELECT e FROM Employee e ORDER BY e.id", Employee.class)
        .setFirstResult(20)   // OFFSET 20
        .setMaxResults(10)    // LIMIT 10
        .getResultList();

    // Spring Data JPA -- full pagination metadata
    Page<Employee> page = repo.findAll(PageRequest.of(2, 10, Sort.by("id")));
    page.getTotalElements(); // total count
    page.getTotalPages();    // total pages
    page.getContent();       // current page data
    page.hasNext();          // navigation

    // Slice -- no count query (better performance for infinite scroll)
    Slice<Employee> slice = repo.findByDepartment("Engineering",
        PageRequest.of(0, 20, Sort.by("hireDate").descending()));
    ```

    **Offset vs. Keyset Pagination:**

    | Approach | SQL | Performance | Use Case |
    |----------|-----|-------------|----------|
    | Offset | `LIMIT 10 OFFSET 10000` | Degrades with large offsets (DB scans skipped rows) | Small datasets, random page access |
    | Keyset | `WHERE id > :lastId LIMIT 10` | Constant performance regardless of page depth | Large datasets, infinite scroll |

    ```java
    // Keyset pagination -- constant performance
    @Query("SELECT e FROM Employee e WHERE e.id > :lastId ORDER BY e.id")
    List<Employee> findNextPage(@Param("lastId") Long lastId, Pageable pageable);
    ```

    **When to use:** Offset for traditional page-numbered UIs with moderate data. Keyset (also called "seek method") for APIs with millions of rows, infinite scroll, or background batch processing.

    **Gotchas:** (1) `Page` executes a COUNT query on every call -- use `Slice` if you only need "has next?" without total count. (2) Pagination with `JOIN FETCH` on collections applies LIMIT in-memory (Hibernate logs a warning) -- use a two-query approach: first query IDs with pagination, then fetch entities by IDs with JOIN FETCH. (3) Sorting must include a unique column (e.g., `id`) as a tiebreaker to avoid non-deterministic ordering. (4) Offset pagination can show duplicates or skip rows if data is inserted/deleted between page requests.

??? question "Q20: What is the difference between HQL and SQL?"

    **Answer:** HQL (Hibernate Query Language) operates on entity classes and their Java properties, while SQL operates directly on database tables and columns. HQL is database-independent, supports polymorphic queries, and is translated by Hibernate into the appropriate SQL dialect at runtime.

    **Why:** Interviewers ask this to verify you understand the abstraction layer HQL provides and when it is appropriate to bypass it with native SQL.

    **How:** Hibernate's HQL parser takes entity-oriented queries, resolves them against the mapped metadata, and generates dialect-specific SQL. HQL is a superset of JPQL -- everything valid in JPQL works in HQL, plus Hibernate-specific extensions.

    | Aspect | HQL / JPQL | SQL |
    |--------|-----------|-----|
    | Operates on | Entity classes and Java field names | Database tables and column names |
    | Joins | Implicit via navigation (`e.department.name`) | Explicit `JOIN` with ON clause |
    | Portability | Database-independent | Database-specific dialect |
    | Polymorphism | `FROM Payment` returns Credit, Bank, etc. | Must UNION or query specific tables |
    | Functions | Limited standard functions | Full DB function library |
    | Result | Managed entities (tracked) | Raw rows (unmanaged unless mapped) |
    | Case sensitivity | Entity/field names are case-sensitive | Depends on DB collation |

    ```java
    // HQL -- entity-oriented
    List<Employee> emps = session.createQuery(
        "FROM Employee e WHERE e.department.name = :dept AND e.salary > :min",
        Employee.class)
        .setParameter("dept", "Engineering")
        .setParameter("min", 80000)
        .getResultList();
    // Generated SQL (PostgreSQL dialect):
    // SELECT e.* FROM employee e JOIN department d ON e.dept_id = d.id
    //   WHERE d.name = ? AND e.salary > ?

    // HQL-specific features not in JPQL:
    // WITH clause on joins, list parameters, LIMIT/OFFSET keywords (Hibernate 6)
    ```

    **When to use:** HQL/JPQL for 90% of queries (portable, type-safe entity results). Drop to native SQL only for CTEs, window functions (`ROW_NUMBER`, `RANK`), full-text search, JSON operators, or performance-critical queries where you need exact control over the execution plan.

    **Gotchas:** (1) HQL uses entity and field names, not table/column names -- `FROM Employee`, not `FROM employee`. (2) Implicit joins via path expressions can generate unexpected multiple JOINs if you navigate deep graphs. (3) HQL does not support all SQL functions -- use `function('name', args)` for DB-specific functions. (4) HQL polymorphic queries (`FROM Payment`) can be expensive with TABLE_PER_CLASS inheritance (generates UNION ALL). (5) In Hibernate 6, HQL gained support for `LIMIT`, `OFFSET`, set operations (`UNION`, `INTERSECT`), and sub-query `FROM` clauses, closing many gaps with SQL.

---

## Transactions & Locking

??? question "Q21: What are the @Transactional propagation types?"

    **Answer:** Transaction propagation defines how a transactional method behaves when called within or without an existing transaction context. Spring provides seven propagation levels that control transaction boundaries for nested service calls.

    **Why:** Interviewers ask this because incorrect propagation causes silent data loss (method runs without a transaction when you expected one) or unexpected rollbacks (shared transaction rolling back unrelated work). It tests your understanding of Spring's transaction abstraction.

    **How:** Spring's `TransactionInterceptor` (AOP proxy) checks the propagation setting before invoking the target method and either joins, creates, suspends, or rejects a transaction accordingly.

    | Propagation | Existing TX? | Behavior | Use Case |
    |-------------|:------------:|----------|----------|
    | `REQUIRED` (default) | Yes -> Join; No -> Create | Most common; ensures transactional execution | Standard service methods |
    | `REQUIRES_NEW` | Yes -> Suspend + Create new; No -> Create | Independent commit/rollback | Audit logging that must persist even on failure |
    | `NESTED` | Yes -> Savepoint; No -> Create | Rolls back to savepoint without affecting outer TX | Partial retry within a larger operation |
    | `SUPPORTS` | Yes -> Join; No -> Run non-TX | Flexible; works either way | Read methods that can work with or without TX |
    | `NOT_SUPPORTED` | Yes -> Suspend; No -> Run non-TX | Forces non-transactional | Long-running reads that should not hold locks |
    | `MANDATORY` | Yes -> Join; No -> Exception | Enforces caller responsibility | Methods that must never be entry points |
    | `NEVER` | Yes -> Exception; No -> Run non-TX | Enforces no-TX context | Sanity check for methods that must not run in TX |

    ```java
    @Service
    public class OrderService {
        @Transactional(propagation = Propagation.REQUIRED)  // default
        public void placeOrder(Order order) {
            orderRepo.save(order);
            auditService.logOrderPlaced(order);  // REQUIRES_NEW -> commits independently
        }
    }

    @Service
    public class AuditService {
        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public void logOrderPlaced(Order order) {
            auditRepo.save(new AuditEntry("ORDER_PLACED", order.getId()));
            // Commits even if placeOrder() rolls back later
        }
    }
    ```

    **When to use:** `REQUIRED` for 95% of service methods. `REQUIRES_NEW` for operations that must commit independently (audit, notification). `MANDATORY` for repository/internal methods that should never be called without a transaction.

    **Gotchas:** (1) Propagation only works through the AOP proxy -- calling a `@Transactional` method from within the same class bypasses the proxy (self-invocation problem). Fix: extract to a separate bean or use `@EnableAspectJAutoProxy(exposeProxy=true)`. (2) `REQUIRES_NEW` suspends the outer transaction's JDBC connection -- with limited pool size, this can deadlock. (3) `NESTED` requires JDBC 3.0 savepoint support (works with most modern DBs but not all JTA environments). (4) `readOnly = true` is a hint, not a propagation -- it can be combined with any propagation type.

??? question "Q22: How does Hibernate's dirty checking work?"

    **Answer:** When an entity becomes Managed, Hibernate takes a deep snapshot (copy) of all its persistent field values. At flush time (typically before transaction commit), it compares each managed entity's current state against its snapshot and automatically generates UPDATE statements for any entities whose values have changed -- without you calling any `save()` or `update()` method.

    **Why:** Dirty checking is fundamental to Hibernate's "transparent persistence" model. Interviewers ask this to confirm you understand why explicit save calls are unnecessary for managed entities, and to discuss performance optimization strategies.

    **How (internal mechanism):**

    1. **Load/persist:** Hibernate stores a `Object[]` snapshot of all property values in the persistence context (associated with the entity's key).
    2. **Flush triggered:** By default at transaction commit, before queries, or on explicit `em.flush()`.
    3. **Comparison:** For each managed entity, Hibernate iterates all properties and calls `Objects.equals()` (or deep comparison for embedded types) between current value and snapshot.
    4. **SQL generation:** For dirty entities, generates UPDATE with all columns (default) or only changed columns (`@DynamicUpdate`).

    ```java
    @Transactional
    public void giveRaise(Long empId) {
        Employee emp = em.find(Employee.class, empId);  // snapshot: {salary: 80000, ...}
        emp.setSalary(emp.getSalary() + 5000);          // current: {salary: 85000, ...}
        // At commit: snapshot != current -> generates:
        // UPDATE employee SET name=?, salary=85000, dept_id=? WHERE id=?
    }
    ```

    **Optimization options:**

    | Technique | Effect |
    |-----------|--------|
    | `@DynamicUpdate` | Only includes changed columns in UPDATE (less data, better for wide tables) |
    | `@Transactional(readOnly = true)` | Hibernate skips dirty checking entirely (no snapshots compared) |
    | `@Immutable` | Entity is never dirty-checked; any changes are silently ignored |
    | `StatelessSession` | No persistence context, no dirty checking, no caching |
    | `em.detach(entity)` | Removes entity from tracking (no longer dirty-checked) |

    **When to use:** Dirty checking is always active for managed entities. Optimize with `readOnly = true` for read-heavy service methods (10-15% performance gain for large result sets). Use `@DynamicUpdate` for entities with many columns where only a few change.

    **Gotchas:** (1) Dirty checking compares ALL fields on every flush -- with thousands of managed entities, this becomes expensive. Periodically `clear()` the persistence context in batch jobs. (2) Collections are dirty-checked separately -- adding/removing elements marks the collection as dirty. (3) `@DynamicUpdate` prevents Hibernate from caching the UPDATE SQL plan (statement changes per invocation) -- trade-off between narrower UPDATE and plan caching. (4) Mutable embedded objects (e.g., `Address`) are always considered dirty unless you implement custom `equals()` -- Hibernate cannot detect changes within embeddings without comparison.

??? question "Q23: How does optimistic locking work with @Version?"

    **Answer:** Optimistic locking uses a `@Version` field (integer or timestamp) that Hibernate includes in the WHERE clause of every UPDATE. If another transaction modified the row between your read and write, the version will not match, zero rows are updated, and Hibernate throws `OptimisticLockException` -- forcing the application to handle the conflict.

    **Why:** Optimistic locking is the standard concurrency strategy for web applications. Interviewers ask this to verify you understand how it prevents lost updates without holding database locks, and how to handle the resulting exceptions.

    **How (step by step):**

    1. Transaction A reads Product (id=1, version=2, price=25.00)
    2. Transaction B reads same Product (id=1, version=2, price=25.00)
    3. Transaction A updates price to 29.99 -> `UPDATE product SET price=29.99, version=3 WHERE id=1 AND version=2` -> 1 row updated, version now 3
    4. Transaction B updates price to 27.99 -> `UPDATE product SET price=27.99, version=3 WHERE id=1 AND version=2` -> **0 rows updated** (version is now 3, not 2)
    5. Hibernate detects 0 rows affected -> throws `OptimisticLockException`

    ```java
    @Entity
    public class Product {
        @Id @GeneratedValue private Long id;
        @Version private Integer version;  // auto-managed by Hibernate
        private BigDecimal price;
    }
    ```

    ```sql
    -- Generated SQL with version check
    UPDATE product SET price = 29.99, version = 3 WHERE id = 1 AND version = 2
    ```

    **Handling the exception:**
    ```java
    @Retryable(value = OptimisticLockException.class, maxAttempts = 3)
    @Transactional
    public void updatePrice(Long productId, BigDecimal newPrice) {
        Product p = repo.findById(productId).orElseThrow();
        p.setPrice(newPrice);
    }
    ```

    **Version field types:** `Integer` (recommended, most compact), `Long`, `Short`, `Timestamp` (less reliable due to granularity).

    **When to use:** Most web applications (read-heavy, conflicts are rare). REST APIs where clients send the version back and you validate it. Any scenario where holding a DB lock for the duration of user think-time is unacceptable.

    **Gotchas:** (1) `@Version` is auto-managed -- never set it manually or you break the mechanism. (2) The version increments on every UPDATE even if values did not change (Hibernate considers any flush-triggered update as a modification). (3) Bulk JPQL updates (`UPDATE Employee e SET e.salary = ...`) bypass `@Version` by default -- add `em.lock()` or include version in the UPDATE manually. (4) Detached entities retain their version -- `merge()` will use the stale version for the conflict check, which is exactly what you want for long conversations (optimistic offline lock). (5) `OptimisticLockException` causes the current transaction to be marked for rollback -- you must retry in a new transaction.

??? question "Q24: What is pessimistic locking and when should you use it?"

    **Answer:** Pessimistic locking acquires database-level locks (row or table) at read time, preventing other transactions from reading or writing the locked rows until the holding transaction completes. It trades concurrency for guaranteed conflict prevention.

    **Why:** Interviewers ask this to see if you understand when optimistic locking (retry-based) is insufficient and when you need guaranteed exclusive access. It also tests knowledge of deadlock risks and lock escalation.

    **How:** JPA provides lock modes that translate to database-specific locking clauses:

    | LockModeType | SQL Generated | Behavior | Use Case |
    |-------------|---------------|----------|----------|
    | `PESSIMISTIC_READ` | `SELECT ... FOR SHARE` | Shared lock -- others can read but not write | Ensure data stability during complex calculation |
    | `PESSIMISTIC_WRITE` | `SELECT ... FOR UPDATE` | Exclusive lock -- others cannot read or write | Read-then-write (inventory decrement, balance transfer) |
    | `PESSIMISTIC_FORCE_INCREMENT` | `FOR UPDATE` + version++ | Exclusive lock + bumps `@Version` | Combine pessimistic and optimistic (parent version bump) |

    ```java
    // EntityManager API
    Product product = em.find(Product.class, productId, LockModeType.PESSIMISTIC_WRITE);
    product.setStock(product.getStock() - quantity);  // safe -- no other TX can read this row

    // Spring Data JPA
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Product p WHERE p.id = :id")
    Optional<Product> findByIdForUpdate(@Param("id") Long id);

    // With timeout (avoid waiting forever)
    Map<String, Object> hints = Map.of("javax.persistence.lock.timeout", 5000); // 5 seconds
    Product product = em.find(Product.class, id, LockModeType.PESSIMISTIC_WRITE, hints);
    ```

    **When to use:** (1) High-contention scenarios where conflicts are frequent and retry costs are high (financial transactions, seat reservation). (2) Read-modify-write patterns where you cannot afford lost updates (inventory count, account balance). (3) When the operation is short-lived (seconds, not minutes).

    **Gotchas:** (1) **Deadlocks:** Two transactions locking rows in different order cause deadlocks. Always lock in a consistent order (by ID ascending). (2) **Connection holding:** Lock is held until transaction commits -- long transactions block other users. Keep pessimistic transactions short. (3) **Lock timeout:** Without a timeout, blocked transactions wait indefinitely. Always set `javax.persistence.lock.timeout`. (4) **SKIP LOCKED:** For queue-like patterns, use `FOR UPDATE SKIP LOCKED` (Hibernate 5.2+) to skip already-locked rows instead of blocking: `@QueryHint(name = "javax.persistence.lock.timeout", value = "-2")`. (5) Read replicas do not honor locks -- pessimistic locking only works against the primary database.

---

## Advanced Features

??? question "Q25: What are DTO projections and interface-based projections?"

    **Answer:** Projections allow you to fetch only the columns you need from the database, bypassing the full entity lifecycle (no persistence context tracking, no dirty checking). JPA supports constructor-based DTO projections, while Spring Data JPA adds interface-based projections (closed and open).

    **Why:** Loading full entities when you only need 2-3 fields wastes memory, network bandwidth, and CPU (dirty checking overhead). Interviewers ask this to see if you optimize read queries rather than blindly loading entire entity graphs.

    **How:**

    | Projection Type | Mechanism | Performance | Flexibility |
    |----------------|-----------|-------------|-------------|
    | DTO (constructor expression) | `SELECT NEW` in JPQL | Best (direct POJO, no proxy) | Must match constructor exactly |
    | Closed interface | Spring generates JDK proxy | Good (only declared columns fetched) | Easy; just define getter interfaces |
    | Open interface (`@Value` SpEL) | Proxy with runtime SpEL evaluation | Worst (all columns fetched + SpEL overhead) | Most flexible |
    | Class-based (Spring) | Spring calls constructor by param names | Good | Requires matching parameter names |

    ```java
    // 1. DTO projection with JPQL constructor expression
    public record EmployeeSummary(String name, BigDecimal salary) {}

    @Query("SELECT new com.example.EmployeeSummary(e.name, e.salary) FROM Employee e")
    List<EmployeeSummary> findSummaries();

    // 2. Closed interface projection (Spring Data magic)
    public interface EmployeeNameOnly {
        String getName();
        String getDepartmentName();  // nested navigation works
    }
    List<EmployeeNameOnly> findByDepartmentName(String deptName);
    // SQL: SELECT e.name, d.name FROM employee e JOIN department d ...

    // 3. Open interface projection (SpEL)
    public interface EmployeeFullName {
        @Value("#{target.firstName + ' ' + target.lastName}")
        String getFullName();
    }

    // 4. Native query with interface projection
    @Query(value = "SELECT name, salary FROM employee WHERE dept_id = ?1", nativeQuery = true)
    List<EmployeeSummaryProjection> findByDeptNative(Long deptId);
    ```

    **When to use:** DTO projections for API responses (no proxy overhead, immutable, serializable). Closed interfaces for quick Spring Data queries without writing JPQL. Open interfaces rarely (only when you need computed fields). Always prefer projections over full entities for read-only APIs.

    **Gotchas:** (1) DTO projections with `SELECT NEW` require the fully qualified class name in JPQL (or use Hibernate 6's simplified syntax). (2) Closed interface projections fetch only declared columns -- but adding a method that does not map to a column causes a runtime error, not compile-time. (3) Interface projections do not work with `Tuple` queries or native queries without `@Column`/alias mapping. (4) DTO projections are NOT managed entities -- changes to them are not persisted. (5) Nested associations in interface projections (`getDepartment().getName()`) trigger additional queries unless you use a JOIN explicitly.

??? question "Q26: What are @Formula and @Subselect in Hibernate?"

    **Answer:** `@Formula` defines a read-only computed property using a SQL expression that Hibernate injects into the SELECT clause. `@Subselect` maps an entire entity to a SQL subquery, acting like a database view defined in code. Both are Hibernate-specific (not JPA standard) and produce read-only results.

    **Why:** Interviewers ask this to test knowledge of Hibernate's advanced mapping capabilities for derived/computed data without creating database views or denormalizing the schema.

    **How:**

    **@Formula** -- Evaluated by the database on every entity load:

    ```java
    @Entity
    public class Employee {
        @Id private Long id;
        private BigDecimal salary;
        private BigDecimal bonus;

        @Formula("salary + bonus")  // raw SQL expression, not JPQL
        private BigDecimal totalCompensation;

        @Formula("(SELECT COUNT(*) FROM task t WHERE t.assignee_id = id)")
        private int openTaskCount;

        @Formula("(SELECT d.name FROM department d WHERE d.id = dept_id)")
        private String departmentName;  // avoids join in some cases
    }
    // Generated: SELECT id, salary, bonus, (salary + bonus), (SELECT COUNT(*)...) FROM employee
    ```

    **@Subselect** -- Maps a read-only entity to a SQL subquery:

    ```java
    @Entity
    @Subselect("SELECT d.id, d.name, COUNT(e.id) as emp_count, AVG(e.salary) as avg_salary " +
               "FROM department d LEFT JOIN employee e ON e.dept_id = d.id GROUP BY d.id, d.name")
    @Synchronize({"department", "employee"})  // flush these tables before querying
    public class DepartmentSummary {
        @Id private Long id;
        private String name;
        private Long empCount;
        private BigDecimal avgSalary;
    }
    ```

    **@Synchronize** is critical -- it tells Hibernate which tables the subselect depends on, so it flushes pending changes to those tables before executing the subselect query, preventing stale results.

    **When to use:** `@Formula` for simple computed fields (totals, counts, status derivations) without denormalization. `@Subselect` for reporting views or aggregated summaries that you want to query via JPQL/Criteria without creating a database view.

    **Gotchas:** (1) `@Formula` uses raw SQL (table/column names, not entity/field names) -- not portable across dialects if you use DB-specific functions. (2) `@Formula` subqueries execute on EVERY entity load -- N entities = N subquery executions. Use `@BatchSize` or fetch via a dedicated query for large collections. (3) `@Subselect` entities are immutable -- `persist()`/`merge()` will fail. (4) Forgetting `@Synchronize` means Hibernate may read stale data from the subselect if pending INSERTs/UPDATEs have not been flushed. (5) `@Formula` fields cannot be used in WHERE clauses of JPQL queries (they are not entity properties in the metamodel).

??? question "Q27: How do you optimize batch inserts and updates?"

    **Answer:** Batch optimization in Hibernate involves configuring JDBC batching (grouping multiple SQL statements into a single network round trip), using the SEQUENCE ID strategy, ordering statements by entity type, and periodically flushing/clearing the persistence context to prevent memory exhaustion.

    **Why:** Without batch optimization, inserting 100,000 rows generates 100,000 individual network round trips. With batching, the same work can be done in 2,000 round trips (batch size 50). Interviewers ask this because bulk data operations are common in enterprise apps and the default Hibernate configuration does not batch.

    **How:**

    **Step 1: Configuration**
    ```properties
    # Enable JDBC batching
    spring.jpa.properties.hibernate.jdbc.batch_size=50
    # Group INSERTs by entity type (required for batching with inheritance)
    spring.jpa.properties.hibernate.order_inserts=true
    # Group UPDATEs by entity type
    spring.jpa.properties.hibernate.order_updates=true
    # Batch versioned entities (required for optimistic locking + batching)
    spring.jpa.properties.hibernate.jdbc.batch_versioned_data=true
    ```

    **Step 2: Use SEQUENCE strategy (not IDENTITY)**
    ```java
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "emp_seq")
    @SequenceGenerator(name = "emp_seq", allocationSize = 50)
    private Long id;
    // IDENTITY forces immediate INSERT per entity (breaks batching)
    ```

    **Step 3: Flush and clear periodically**
    ```java
    @Transactional
    public void bulkInsert(List<Employee> employees) {
        for (int i = 0; i < employees.size(); i++) {
            em.persist(employees.get(i));
            if (i > 0 && i % 50 == 0) {
                em.flush();   // execute batched INSERTs
                em.clear();   // release L1 cache memory
            }
        }
    }
    ```

    **Step 4: For maximum throughput, use StatelessSession**
    ```java
    StatelessSession session = sessionFactory.openStatelessSession();
    Transaction tx = session.beginTransaction();
    for (Employee emp : employees) {
        session.insert(emp);  // no L1 cache, no dirty checking, immediate batch
    }
    tx.commit();
    session.close();
    ```

    | Approach | Throughput | Managed entities? | Dirty checking? |
    |----------|-----------|:-----------------:|:---------------:|
    | Default (no batch) | Low | Yes | Yes |
    | Batch + flush/clear | Medium-High | Yes (periodically cleared) | Yes |
    | StatelessSession | Highest | No | No |
    | Spring JDBC `batchUpdate` | Highest | No (bypass Hibernate) | No |

    **When to use:** Batch + flush/clear for most bulk operations where you still want entity lifecycle (cascades, validation). `StatelessSession` or raw JDBC for pure data loading (ETL, migrations) where entity features are not needed.

    **Gotchas:** (1) IDENTITY strategy completely disables batching -- this is the most common mistake. (2) Without `order_inserts=true`, mixed entity types in the persistence context break batch grouping. (3) Forgetting `em.clear()` causes `OutOfMemoryError` for large imports (L1 cache grows unbounded). (4) Batch size > 50-100 gives diminishing returns and may hit DB packet limits. (5) `hibernate.generate_statistics=true` shows batch counts -- verify batching actually works. (6) PostgreSQL requires `reWriteBatchedInserts=true` in the JDBC URL for true multi-row INSERT optimization.

??? question "Q28: What is connection pooling and why is HikariCP the default?"

    **Answer:** Connection pooling maintains a cache of pre-established database connections that are borrowed and returned by application threads, eliminating the overhead of creating a new TCP connection + authentication handshake for every database operation. HikariCP is Spring Boot's default pool because it achieves sub-microsecond connection acquisition, has the smallest footprint (~130KB), and provides the best throughput in benchmarks.

    **Why:** Establishing a database connection takes 20-100ms (TCP handshake + TLS + authentication). In a high-throughput application handling 1000 req/s, creating connections on demand would be catastrophic. Interviewers ask this to test your understanding of resource management and capacity planning.

    **How:** The pool maintains a set of open connections. When a thread needs a connection, it borrows one from the pool (microsecond operation). When the transaction completes, the connection is returned to the pool (not closed). The pool handles validation (is the connection still alive?), eviction (idle timeout), and leak detection.

    ```properties
    # HikariCP configuration
    spring.datasource.hikari.maximum-pool-size=20         # max concurrent connections
    spring.datasource.hikari.minimum-idle=5               # keep at least 5 idle
    spring.datasource.hikari.idle-timeout=300000          # close idle connections after 5 min
    spring.datasource.hikari.connection-timeout=30000     # wait max 30s for a connection
    spring.datasource.hikari.max-lifetime=1800000         # retire connections after 30 min
    spring.datasource.hikari.leak-detection-threshold=60000  # warn if connection held > 60s
    ```

    **Why HikariCP specifically:**

    | Feature | HikariCP | Tomcat Pool | C3P0 |
    |---------|----------|-------------|------|
    | Acquisition time | ~250ns | ~3000ns | ~5000ns |
    | JAR size | ~130KB | ~100KB | ~600KB |
    | Code quality | ConcurrentBag (lock-free) | Standard blocking queue | Complex, legacy |
    | Leak detection | Built-in | Manual config | Built-in |
    | Connection validation | Fast path (driver hint) | Query-based | Query-based |

    **Pool sizing formula:** `connections = (core_count * 2) + effective_spindle_count`. For SSD-backed databases, typically **10-20 connections** serve hundreds of concurrent users because most time is spent in application logic, not waiting on DB I/O.

    **When to use:** Always. There is no production scenario where connection pooling should be disabled. HikariCP is the correct default unless you have a specific reason for another pool (e.g., container-managed DataSource in Jakarta EE).

    **Gotchas:** (1) Over-sizing the pool (100+ connections) actually DECREASES throughput due to context switching and DB lock contention. (2) `connection-timeout` exception (`SQLTransientConnectionException`) means all connections are in use -- check for leaked connections, not just "increase pool size." (3) `REQUIRES_NEW` propagation borrows a SECOND connection from the pool -- with deep nesting + small pool, this deadlocks. (4) `max-lifetime` should be less than your database's `wait_timeout` (MySQL) or `idle_in_transaction_session_timeout` (PostgreSQL) to avoid broken connections. (5) Always set `leak-detection-threshold` in development to catch missing `@Transactional` or long-held connections.

---

## Schema Management

??? question "Q29: What are the hibernate.hbm2ddl.auto options?"

    **Answer:** `hibernate.hbm2ddl.auto` (or `spring.jpa.hibernate.ddl-auto`) controls how Hibernate manages the database schema at application startup. It compares entity mappings against the actual database schema and takes action based on the configured value.

    **Why:** This is a frequently asked question because misconfiguring this property in production can drop tables, corrupt data, or silently fail to apply necessary schema changes. Interviewers test whether you know the safe options vs. dangerous ones.

    **How:**

    | Value | Behavior | Data Safe? | Use Case |
    |-------|----------|:----------:|----------|
    | `none` | Do absolutely nothing | Yes | Production (with Flyway/Liquibase) |
    | `validate` | Compare schema vs entities; throw `SchemaManagementException` on mismatch | Yes | Production (validates migrations are correct) |
    | `update` | Add new columns/tables; never drops/modifies existing | Partially | Development convenience |
    | `create` | Drop all tables, then create fresh on every startup | **NO** | Clean integration tests |
    | `create-drop` | Create on startup, drop all on `SessionFactory` close | **NO** | Unit tests with embedded DB |

    ```properties
    # Development
    spring.jpa.hibernate.ddl-auto=update

    # Production (with Flyway/Liquibase handling migrations)
    spring.jpa.hibernate.ddl-auto=validate

    # Integration tests
    spring.jpa.hibernate.ddl-auto=create-drop
    ```

    **What `update` does internally:**

    1. Reads current DB metadata via `DatabaseMetaData`
    2. Compares against entity metamodel
    3. Generates ALTER TABLE statements for missing columns/tables
    4. Executes them (silently on failure for some dialects)

    **When to use:** `validate` in production alongside a migration tool (Flyway/Liquibase). `update` during early development for quick iteration. `create-drop` for isolated integration tests with H2/HSQLDB.

    **Gotchas:** (1) `update` NEVER drops columns, even if you remove a field from an entity -- leads to schema drift. (2) `update` cannot rename columns (it creates a new one and leaves the old). (3) `update` cannot change column types (e.g., VARCHAR(50) to VARCHAR(255)) on all databases. (4) `update` may silently fail on constraint changes (adding NOT NULL to a column with existing NULL values). (5) `create` drops tables IN THE WRONG ORDER if there are FK constraints -- can fail without cascade. (6) Spring Boot defaults to `none` unless you use an embedded database (H2, HSQLDB), where it defaults to `create-drop`. (7) Never rely on `update` for production -- it produces no audit trail, no rollback capability, and cannot handle data migrations.

??? question "Q30: When should you use Flyway/Liquibase instead of hbm2ddl.auto?"

    **Answer:** Always use Flyway or Liquibase in production and any environment where you need reproducible, version-controlled, auditable schema changes. `hbm2ddl.auto` should only be used for local development convenience or test environments. The two approaches serve complementary roles: migration tools manage schema evolution, while `validate` verifies that your entity mappings match the migrated schema.

    **Why:** Interviewers ask this because schema management is a critical DevOps concern. Teams that rely on `hbm2ddl.auto=update` in production inevitably encounter data loss, broken deployments, or schema drift that is impossible to debug.

    **How:**

    | Capability | hbm2ddl.auto | Flyway / Liquibase |
    |-----------|-------------|-------------------|
    | Version control | No | Yes (migrations in Git) |
    | Rollback | No | Yes (undo scripts or Liquibase rollback) |
    | Data migrations | No (DDL only) | Yes (INSERT, UPDATE, transform) |
    | Column rename | No (creates new column) | Yes |
    | Audit trail | No | Yes (schema_version / changelog table) |
    | Team collaboration | Conflicts | Ordered versions prevent conflicts |
    | Repeatable scripts | No | Yes (views, procedures, functions) |
    | Environment-specific | No | Yes (profiles, conditions) |

    ```
    src/main/resources/db/migration/
        V1__create_employee_table.sql
        V2__add_department_table.sql
        V3__add_salary_column.sql
        V4__migrate_legacy_data.sql      -- data migration!
        V5__rename_dept_to_department.sql -- rename!
    ```

    ```properties
    # Production setup: Flyway migrates, Hibernate validates
    spring.flyway.enabled=true
    spring.flyway.locations=classpath:db/migration
    spring.jpa.hibernate.ddl-auto=validate
    ```

    **Flyway vs Liquibase:**

    | Aspect | Flyway | Liquibase |
    |--------|--------|-----------|
    | Format | Plain SQL files | XML/YAML/JSON/SQL |
    | Learning curve | Lower (just SQL) | Higher (abstraction layer) |
    | DB portability | Manual (per-dialect SQL) | Auto-generates dialect SQL |
    | Rollback | Pro feature (or manual) | Built-in (auto or explicit) |
    | Best for | Teams comfortable with SQL | Multi-DB support, complex workflows |

    **When to use:** Flyway for most Spring Boot projects (simpler, SQL-native). Liquibase when you support multiple database vendors or need automatic rollback generation. Always pair with `ddl-auto=validate`.

    **Gotchas:** (1) Never modify an already-applied migration -- Flyway checksums detect tampering and fail startup. Create a new migration instead. (2) Team members must communicate migration version numbers to avoid conflicts (use timestamps: `V20240115_1030__description.sql`). (3) Flyway runs BEFORE Hibernate validation -- so if a migration fails, you may get partial schema state. (4) `spring.jpa.defer-datasource-initialization=true` is needed if you use `data.sql` with Flyway. (5) Test migrations against a copy of production data -- not just an empty schema. A migration that works on empty DB may fail on production data (NOT NULL on existing NULL columns).

---

## Spring Data JPA

??? question "Q31: How does the Spring Data JPA repository abstraction work?"

    **Answer:** Spring Data JPA auto-generates repository implementations at runtime by scanning interfaces that extend `Repository` (or its sub-interfaces), creating JDK dynamic proxies that intercept method calls and translate them into JPA queries -- either by parsing method names (derived queries), executing `@Query` annotations, or delegating to built-in CRUD methods.

    **Why:** Interviewers ask this to verify you understand the "magic" behind Spring Data -- how method names become SQL, what the proxy does, and where the actual implementation lives. This tests both Spring internals knowledge and practical usage.

    **How (internal mechanism):**

    1. `@EnableJpaRepositories` (auto-configured in Spring Boot) triggers `JpaRepositoryFactoryBean`
    2. Factory scans for interfaces extending `Repository`
    3. For each interface, creates a `JdkDynamicProxy` backed by `SimpleJpaRepository` (default impl)
    4. Method calls are intercepted by `QueryExecutorMethodInterceptor`
    5. Derived query methods are parsed into `PartTree` -> JPQL/Criteria at startup (validated early)
    6. `@Query` methods compile the JPQL/SQL at startup
    7. Built-in methods (`save`, `findById`, `delete`) delegate to `SimpleJpaRepository`

    **Repository hierarchy:**
    ```
    Repository (marker)
      -> CrudRepository (save, findById, delete, count, existsById)
        -> ListCrudRepository (returns List instead of Iterable)
        -> PagingAndSortingRepository (findAll(Pageable), findAll(Sort))
          -> JpaRepository (flush, saveAll, deleteInBatch, findAll with Example)
    ```

    ```java
    public interface EmployeeRepository extends JpaRepository<Employee, Long> {
        // Derived query -- parsed from method name
        List<Employee> findByDepartmentNameAndSalaryGreaterThan(String dept, BigDecimal salary);
        // Generates: SELECT e FROM Employee e WHERE e.department.name = ?1 AND e.salary > ?2

        // Custom JPQL
        @Query("SELECT e FROM Employee e WHERE e.hireDate > :date")
        List<Employee> findRecentHires(@Param("date") LocalDate date);

        // Native query
        @Query(value = "SELECT * FROM employee WHERE YEAR(hire_date) = ?1", nativeQuery = true)
        List<Employee> findByHireYear(int year);

        // Modifying query
        @Modifying @Query("UPDATE Employee e SET e.salary = e.salary * :factor WHERE e.department.id = :deptId")
        int adjustSalaries(@Param("factor") BigDecimal factor, @Param("deptId") Long deptId);
    }
    ```

    **When to use:** For 90% of data access needs. Derived queries for simple conditions (up to 2-3 predicates). `@Query` for anything more complex. Custom implementations for dynamic queries or non-standard operations.

    **Gotchas:** (1) Derived query method names are validated at startup -- typos like `findByNam` (missing 'e') cause `BeanCreationException`. (2) `@Modifying` queries require `@Transactional` and do NOT update the persistence context -- call `em.clear()` or use `@Modifying(clearAutomatically = true)`. (3) `save()` calls `merge()` if the entity has an ID (isNew() returns false) -- this triggers a SELECT before INSERT for new entities with manually-set IDs. Fix with `Persistable` interface. (4) Return type matters: `List` vs `Stream` vs `Page` vs `Slice` all have different query behaviors. (5) Method names with >3 conditions become unreadable -- switch to `@Query` at that point.

??? question "Q32: How do you add custom repository implementations?"

    **Answer:** Spring Data JPA supports custom repository implementations through a fragment pattern: define a custom interface with the methods you need, implement it in a class with the `Impl` suffix, and have your main repository interface extend both `JpaRepository` and the custom interface. Spring auto-discovers and wires the implementation.

    **Why:** Interviewers ask this because real applications inevitably need complex queries (dynamic Criteria, native queries with custom mapping, external service calls) that cannot be expressed as derived methods or `@Query` annotations. This tests your ability to extend Spring Data without fighting the framework.

    **How:**

    ```java
    // Step 1: Define custom interface
    public interface EmployeeRepositoryCustom {
        List<Employee> searchEmployees(EmployeeSearchCriteria criteria);
        void bulkUpdateSalaries(BigDecimal factor, List<Long> departmentIds);
    }

    // Step 2: Implement with "Impl" suffix (convention-based discovery)
    @RequiredArgsConstructor
    public class EmployeeRepositoryCustomImpl implements EmployeeRepositoryCustom {
        private final EntityManager em;

        @Override
        public List<Employee> searchEmployees(EmployeeSearchCriteria criteria) {
            CriteriaBuilder cb = em.getCriteriaBuilder();
            CriteriaQuery<Employee> cq = cb.createQuery(Employee.class);
            Root<Employee> root = cq.from(Employee.class);

            List<Predicate> predicates = new ArrayList<>();
            if (criteria.getName() != null)
                predicates.add(cb.like(root.get("name"), "%" + criteria.getName() + "%"));
            if (criteria.getMinSalary() != null)
                predicates.add(cb.ge(root.get("salary"), criteria.getMinSalary()));
            if (criteria.getDepartment() != null)
                predicates.add(cb.equal(root.get("department").get("name"), criteria.getDepartment()));

            cq.where(predicates.toArray(new Predicate[0]));
            return em.createQuery(cq).getResultList();
        }
    }

    // Step 3: Compose in main repository
    public interface EmployeeRepository
        extends JpaRepository<Employee, Long>, EmployeeRepositoryCustom {
        // Derived + @Query methods here, custom methods auto-wired
    }
    ```

    **Alternative: Base repository customization (for ALL repositories):**
    ```java
    @NoRepositoryBean
    public interface BaseRepository<T, ID> extends JpaRepository<T, ID> {
        List<T> findByNaturalId(Object naturalId);
    }

    public class BaseRepositoryImpl<T, ID> extends SimpleJpaRepository<T, ID>
        implements BaseRepository<T, ID> {
        // Custom base implementation
    }

    @EnableJpaRepositories(repositoryBaseClass = BaseRepositoryImpl.class)
    ```

    **When to use:** Custom fragments for entity-specific complex queries. Base repository customization for cross-cutting behavior (soft delete, multi-tenancy filtering, audit logging).

    **Gotchas:** (1) The class MUST be named `<InterfaceName>Impl` by default. To change the suffix, set `@EnableJpaRepositories(repositoryImplementationPostfix = "CustomImpl")`. (2) The `Impl` class must NOT be annotated with `@Repository` or `@Component` -- Spring Data discovers it by naming convention, and duplicate bean errors will occur. (3) You can have multiple fragments -- `EmployeeRepository extends JpaRepository, SearchFragment, BulkFragment`. Each fragment has its own Impl class. (4) Inject `EntityManager` via constructor, not `@PersistenceContext` field injection, for testability. (5) Custom methods participate in the same transaction as the calling service method (no separate transaction boundary unless explicitly annotated).

??? question "Q33: What are Specifications and QueryDSL?"

    **Answer:** Both Specifications and QueryDSL provide type-safe, composable, dynamic query building for JPA -- solving the problem of constructing queries with optional filters at runtime without error-prone string concatenation. Specifications are built into Spring Data JPA (no extra dependencies), while QueryDSL requires an APT plugin but offers a more readable, fluent API.

    **Why:** Dynamic search forms (e.g., "filter employees by name AND/OR department AND/OR salary range") are extremely common. Interviewers ask this to see if you know alternatives to raw Criteria API verbosity and can build maintainable query logic.

    **How:**

    **Specifications (Spring Data built-in):**
    ```java
    // Repository must extend JpaSpecificationExecutor
    public interface EmployeeRepository extends JpaRepository<Employee, Long>,
                                                JpaSpecificationExecutor<Employee> {}

    // Define reusable specifications
    public class EmployeeSpecs {
        public static Specification<Employee> hasSalaryAbove(BigDecimal min) {
            return (root, query, cb) -> cb.greaterThan(root.get("salary"), min);
        }
        public static Specification<Employee> inDepartment(String dept) {
            return (root, query, cb) -> cb.equal(root.get("department").get("name"), dept);
        }
        public static Specification<Employee> nameContains(String keyword) {
            return (root, query, cb) -> cb.like(cb.lower(root.get("name")),
                "%" + keyword.toLowerCase() + "%");
        }
    }

    // Compose dynamically
    Specification<Employee> spec = Specification.where(null); // start with no filter
    if (minSalary != null) spec = spec.and(hasSalaryAbove(minSalary));
    if (dept != null)      spec = spec.and(inDepartment(dept));
    if (name != null)      spec = spec.and(nameContains(name));
    Page<Employee> results = repo.findAll(spec, pageable);
    ```

    **QueryDSL (external library):**
    ```java
    // Generated Q-class by APT (annotation processor)
    QEmployee emp = QEmployee.employee;

    List<Employee> results = queryFactory.selectFrom(emp)
        .where(emp.salary.gt(80000)
            .and(emp.department.name.eq("Engineering"))
            .and(emp.hireDate.after(LocalDate.of(2020, 1, 1))))
        .orderBy(emp.salary.desc())
        .offset(0).limit(20)
        .fetch();
    ```

    | Aspect | Specifications | QueryDSL |
    |--------|---------------|----------|
    | Dependencies | None (Spring Data built-in) | querydsl-jpa + APT plugin |
    | Readability | Moderate (lambda-heavy) | Excellent (fluent, SQL-like) |
    | Type safety | Partial (string field names) | Full (generated Q-classes) |
    | IDE support | Limited autocomplete | Full autocomplete on Q-classes |
    | Composability | `.and()`, `.or()`, `.not()` | `.and()`, `.or()`, BooleanBuilder |
    | Pagination | `findAll(spec, pageable)` | `.offset().limit()` manual |
    | Spring integration | Native | Via `QuerydslPredicateExecutor` |

    **When to use:** Specifications for simple dynamic filters (2-5 optional criteria) without adding dependencies. QueryDSL for complex queries, subqueries, projections, and teams that value readability and full type safety.

    **Gotchas:** (1) Specifications use string-based field access (`root.get("salary")`) -- typos are runtime errors. Use the JPA metamodel (`Employee_.salary`) for compile-time safety. (2) QueryDSL requires APT configuration in the build (Maven/Gradle plugin) -- Q-classes must be regenerated when entities change. (3) QueryDSL's `fetchJoin()` does not play well with count queries for pagination -- use separate count query. (4) Specifications with `DISTINCT` or `JOIN FETCH` require careful handling: `query.distinct(true)` and cast to `CriteriaQuery<Long>` for count. (5) QueryDSL project has had maintenance concerns -- evaluate `Blaze-Persistence` as an alternative for very complex queries.

??? question "Q34: How does auditing work with @CreatedDate and @LastModifiedDate?"

    **Answer:** Spring Data JPA auditing automatically populates timestamp and user fields on entity creation and modification using JPA entity listeners. You enable it with `@EnableJpaAuditing`, annotate a base class with `@EntityListeners(AuditingEntityListener.class)`, and mark fields with `@CreatedDate`, `@LastModifiedDate`, `@CreatedBy`, and `@LastModifiedBy`.

    **Why:** Audit columns (who created/modified what, when) are required in virtually every enterprise application for compliance, debugging, and data governance. Interviewers ask this to verify you can implement cross-cutting concerns without polluting business logic.

    **How:**

    ```java
    // Step 1: Enable auditing
    @Configuration
    @EnableJpaAuditing(auditorAwareRef = "auditorProvider")
    public class JpaConfig {
        @Bean
        public AuditorAware<String> auditorProvider() {
            return () -> Optional.ofNullable(SecurityContextHolder.getContext())
                .map(SecurityContext::getAuthentication)
                .filter(Authentication::isAuthenticated)
                .map(Authentication::getName);
        }
    }

    // Step 2: Create auditable base class
    @MappedSuperclass
    @EntityListeners(AuditingEntityListener.class)
    public abstract class Auditable {
        @CreatedDate
        @Column(nullable = false, updatable = false)
        private LocalDateTime createdDate;

        @LastModifiedDate
        @Column(nullable = false)
        private LocalDateTime lastModifiedDate;

        @CreatedBy
        @Column(updatable = false)
        private String createdBy;

        @LastModifiedBy
        private String lastModifiedBy;
    }

    // Step 3: Extend in your entities
    @Entity
    public class Employee extends Auditable {
        @Id @GeneratedValue private Long id;
        private String name;
    }
    ```

    **Lifecycle:**

    | Event | @CreatedDate | @LastModifiedDate | @CreatedBy | @LastModifiedBy |
    |-------|:------------:|:-----------------:|:----------:|:---------------:|
    | `persist()` | Set | Set | Set | Set |
    | `merge()/update` | Unchanged | Updated | Unchanged | Updated |

    **Alternative: Hibernate `@CreationTimestamp` / `@UpdateTimestamp`:**
    ```java
    @CreationTimestamp  // Hibernate-specific, no AuditorAware needed
    private LocalDateTime createdAt;
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    ```

    **When to use:** Spring Data auditing when you need both user tracking and timestamps with Spring Security integration. Hibernate `@CreationTimestamp`/`@UpdateTimestamp` when you only need timestamps without user info and want to avoid Spring Data dependency.

    **Gotchas:** (1) `@CreatedDate` requires the entity to correctly implement `isNew()` -- if using manually-assigned IDs, implement `Persistable<ID>` interface or auditing will not set dates on "new" entities (Spring thinks they are existing). (2) Bulk JPQL UPDATE statements bypass entity listeners entirely -- audit fields will NOT be updated. (3) `@Column(updatable = false)` is a JPA-level protection; Hibernate can still update via native queries. (4) In tests without Spring Security context, `AuditorAware` returns empty -- fields will be null. Provide a test-scoped `AuditorAware` bean. (5) `@LastModifiedDate` is set even if no actual field values changed (Hibernate considers the entity dirty on any flush with modification detection).

??? question "Q35: What are the multi-tenancy strategies in Hibernate?"

    **Answer:** Hibernate supports three multi-tenancy strategies for serving multiple tenants from a single application instance: separate database per tenant, separate schema per tenant, and shared schema with a discriminator column. Each offers different trade-offs between data isolation, resource efficiency, and operational complexity.

    **Why:** Multi-tenancy is essential for SaaS applications. Interviewers ask this to assess your ability to design scalable data architectures and understand the isolation-vs-efficiency spectrum.

    **How:**

    | Strategy | Isolation | Resource Efficiency | Complexity | Tenant Limit | Use Case |
    |----------|-----------|:------------------:|:----------:|:------------:|----------|
    | **Separate Database** | Highest (full DB isolation) | Lowest (1 DB per tenant) | High | ~100s | Regulatory/compliance (healthcare, finance) |
    | **Separate Schema** | High (schema-level isolation) | Medium (shared DB server) | Medium | ~1000s | Mid-market SaaS, per-client customization |
    | **Discriminator (shared schema)** | Lowest (row-level, same tables) | Highest (one schema for all) | Low | Unlimited | Consumer SaaS, many small tenants |

    **Implementation:**

    ```java
    // 1. Tenant identifier resolver (common to all strategies)
    @Component
    public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver {
        @Override
        public String resolveCurrentTenantIdentifier() {
            return TenantContext.getCurrentTenant(); // from ThreadLocal, JWT, header, etc.
        }
        @Override
        public boolean validateExistingCurrentSessions() { return true; }
    }

    // 2. For SCHEMA strategy -- connection provider
    @Component
    public class SchemaMultiTenantConnectionProvider implements MultiTenantConnectionProvider {
        @Override
        public Connection getConnection(String tenantIdentifier) throws SQLException {
            Connection conn = dataSource.getConnection();
            conn.setSchema(tenantIdentifier);  // switch schema
            return conn;
        }
    }

    // 3. For DISCRIMINATOR strategy -- Hibernate 6 @TenantId
    @Entity
    public class Employee {
        @Id @GeneratedValue private Long id;
        @TenantId  // Hibernate 6+ automatically filters and sets this
        private String tenantId;
        private String name;
    }
    ```

    ```properties
    # Configuration
    spring.jpa.properties.hibernate.multiTenancy=SCHEMA
    # or DATABASE, DISCRIMINATOR (Hibernate 6)
    ```

    **Discriminator approach (pre-Hibernate 6) using @Filter:**
    ```java
    @Entity
    @FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = String.class))
    @Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")
    public class Employee {
        @Column(name = "tenant_id")
        private String tenantId;
    }
    // Must enable filter on every session: session.enableFilter("tenantFilter").setParameter(...)
    ```

    **When to use:** Start with discriminator (simplest, cheapest, scales to millions of tenants). Move to separate schema when tenants need custom indexes, different backup schedules, or medium isolation. Move to separate database only for regulatory compliance (HIPAA, SOC2 requiring physical separation).

    **Gotchas:** (1) Discriminator strategy -- forgetting the `@Filter` or `@TenantId` exposes data across tenants (security disaster). Always have integration tests verifying tenant isolation. (2) Schema strategy -- DDL migrations must be applied to ALL schemas (Flyway supports this with `schemas` config). (3) Database strategy -- connection pools multiply per tenant (10 tenants x 20 connections = 200 connections). Use dynamic pool creation with lazy initialization. (4) Cross-tenant queries (admin dashboards) require bypassing the tenant filter -- use a `StatelessSession` or disable the filter temporarily. (5) The `@TenantId` annotation (Hibernate 6) is much simpler than `@Filter` -- prefer it for new projects. It automatically adds the WHERE clause and sets the value on persist.

---

## Quick Reference

| Topic | Key Takeaway |
|-------|-------------|
| JPA vs Hibernate | JPA = spec, Hibernate = implementation. Code to JPA interfaces. |
| Entity States | Transient -> Managed -> Detached/Removed. Only Managed entities are tracked. |
| L1 vs L2 Cache | L1 = per session (always on). L2 = shared (opt-in, needs provider). |
| Fetching | Default to LAZY. Use JOIN FETCH or @EntityGraph when needed. |
| N+1 Problem | Fix with JOIN FETCH, @BatchSize, or @EntityGraph. |
| Locking | Optimistic (@Version) for read-heavy. Pessimistic (FOR UPDATE) for write-heavy. |
| Batch Inserts | SEQUENCE strategy + batch_size + periodic flush/clear. |
| Schema Mgmt | Flyway/Liquibase for production. hbm2ddl.auto=validate only. |
| Spring Data | Derived queries for simple cases. Specifications/QueryDSL for dynamic filters. |
