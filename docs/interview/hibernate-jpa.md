# Top 35 Hibernate & JPA Interview Questions & Answers

!!! tip "Why Hibernate & JPA in Interviews?"
    Hibernate and JPA are foundational for any Java backend role. Interviewers expect you to understand the specification vs implementation distinction, caching layers, fetching strategies, locking mechanisms, and how Spring Data JPA simplifies data access.

---

## Core Concepts

??? question "Q1: What is ORM, and why do we need it?"

    **Answer:** ORM (Object-Relational Mapping) maps Java objects to relational database tables, eliminating the impedance mismatch between object-oriented code and SQL storage. Instead of writing raw JDBC boilerplate, you work with entities and the ORM generates SQL.

    ```java
    // Without ORM (JDBC)
    PreparedStatement ps = conn.prepareStatement("SELECT * FROM employee WHERE id = ?");
    ps.setLong(1, id);
    ResultSet rs = ps.executeQuery();

    // With ORM (JPA)
    Employee emp = entityManager.find(Employee.class, id);
    ```

??? question "Q2: What is the difference between JPA and Hibernate?"

    **Answer:** **JPA** (Jakarta Persistence API) is a **specification** -- it defines interfaces, annotations, and contracts but contains no implementation. **Hibernate** is the most popular **implementation** of that specification.

    | Aspect | JPA | Hibernate |
    |--------|-----|-----------|
    | Type | Specification (JSR 338) | Implementation |
    | Package | `jakarta.persistence.*` | `org.hibernate.*` |
    | Query Language | JPQL | HQL (superset of JPQL) |
    | Extras | None | `@Formula`, `@BatchSize`, Envers, etc. |

    **Best practice:** Program to JPA interfaces; only drop to Hibernate APIs when you need features like `@Formula` or `@NaturalId`.

??? question "Q3: Describe the four entity lifecycle states in JPA."

    **Answer:**

    | State | In Persistence Context? | In Database? | Description |
    |-------|:-----------------------:|:------------:|-------------|
    | **Transient** | No | No | Newly created with `new`; JPA is unaware of it |
    | **Managed** | Yes | Yes (or pending INSERT) | Tracked; changes auto-synced on flush |
    | **Detached** | No | Yes | Was managed but session closed or `detach()` called |
    | **Removed** | Yes (marked) | Yes (pending DELETE) | Scheduled for removal on next flush |

    Transitions: `new` -> `persist()` -> Managed -> `detach()/close()` -> Detached -> `merge()` -> Managed; Managed -> `remove()` -> Removed.

??? question "Q4: What is the difference between Session and SessionFactory?"

    **Answer:**

    - **SessionFactory** -- Heavyweight, thread-safe, immutable. Created once at startup. Holds compiled mappings, L2 cache, and connection pool config.
    - **Session** -- Lightweight, short-lived, single-threaded. Wraps a JDBC connection, acts as L1 cache, implements the persistence context.

    ```java
    SessionFactory sf = new Configuration().configure().buildSessionFactory(); // once
    try (Session session = sf.openSession()) { // per request
        session.persist(entity);
    }
    ```

??? question "Q5: How does EntityManager relate to Hibernate Session?"

    **Answer:** `EntityManager` is the JPA-standard interface; Hibernate's `Session` is its proprietary equivalent. In a Hibernate-backed environment, `EntityManager` delegates to a `Session`.

    | EntityManager (JPA) | Session (Hibernate) |
    |---------------------|---------------------|
    | `persist()` | `save()` / `persist()` |
    | `merge()` | `merge()` / `update()` |
    | `remove()` | `delete()` |
    | `find()` | `get()` |

    ```java
    Session session = entityManager.unwrap(Session.class); // access Hibernate APIs
    ```

---

## Caching

??? question "Q6: Explain first-level cache vs second-level cache."

    **Answer:**

    | Aspect | L1 Cache | L2 Cache |
    |--------|----------|----------|
    | Scope | Single `Session` / `EntityManager` | `SessionFactory` -- shared across sessions |
    | Enabled | Always (cannot disable) | Opt-in (needs provider: Ehcache, Infinispan) |
    | Storage | Managed entity instances | Dehydrated (non-object) form |
    | Lifetime | Cleared when session closes | Configurable TTL/eviction |

    ```properties
    spring.jpa.properties.hibernate.cache.use_second_level_cache=true
    spring.jpa.properties.hibernate.cache.region.factory_class=org.hibernate.cache.jcache.JCacheRegionFactory
    ```

??? question "Q7: What is the query cache and when should you use it?"

    **Answer:** The query cache stores **result set IDs** (not full objects) for a JPQL/HQL query + parameters. On a hit, Hibernate uses those IDs to look up entities in the L2 cache.

    ```java
    List<Product> products = em.createQuery("SELECT p FROM Product p WHERE p.category = :cat", Product.class)
        .setParameter("cat", "electronics")
        .setHint("org.hibernate.cacheable", true)
        .getResultList();
    ```

    **Use when:** data rarely changes, same query executes frequently, and L2 cache is enabled. **Avoid when:** data changes often (any write invalidates all query cache entries for that table).

---

## Fetching Strategies

??? question "Q8: What is the difference between Lazy and Eager loading?"

    **Answer:**

    - **`FetchType.LAZY`** -- Loaded on demand when first accessed. Default for `@OneToMany` and `@ManyToMany`.
    - **`FetchType.EAGER`** -- Loaded immediately with the owning entity. Default for `@ManyToOne` and `@OneToOne`.

    ```java
    @OneToMany(mappedBy = "department", fetch = FetchType.LAZY)
    private List<Employee> employees;  // loaded only when accessed

    @ManyToOne(fetch = FetchType.EAGER)
    private Department department;     // loaded immediately
    ```

    **Best practice:** Default everything to `LAZY`; selectively fetch eagerly via `JOIN FETCH` or `@EntityGraph` in specific queries.

??? question "Q9: What is the N+1 select problem, and how do you solve it?"

    **Answer:** Loading N parents where each triggers a separate query for its children = **1 + N queries**.

    | Solution | How |
    |----------|-----|
    | **JOIN FETCH** | `SELECT d FROM Department d JOIN FETCH d.employees` |
    | **@EntityGraph** | `@EntityGraph(attributePaths = {"employees"})` on repository method |
    | **@BatchSize** | `@BatchSize(size = 25)` -- fetches children in batches of 25 |
    | **Subselect** | `@Fetch(FetchMode.SUBSELECT)` -- one subquery for all children |

---

## Mappings & Relationships

??? question "Q10: Explain @OneToMany, @ManyToOne, @ManyToMany, and @OneToOne mappings."

    **Answer:**

    | Annotation | Cardinality | Example |
    |------------|-------------|---------|
    | `@OneToOne` | 1:1 | User -- UserProfile |
    | `@OneToMany` | 1:N | Department -- Employees |
    | `@ManyToOne` | N:1 | Employee -- Department |
    | `@ManyToMany` | M:N | Student -- Course (join table) |

    ```java
    @Entity
    public class Department {
        @OneToMany(mappedBy = "department", cascade = CascadeType.ALL)
        private List<Employee> employees;
    }
    @Entity
    public class Employee {
        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "dept_id")
        private Department department;
    }
    ```

??? question "Q11: What does the mappedBy attribute do?"

    **Answer:** `mappedBy` declares the **inverse (non-owning) side** of a bidirectional relationship. It tells Hibernate: "the FK is managed by field X on the other entity -- do not create a separate join column or table."

    Without `mappedBy` on a `@OneToMany`, Hibernate creates a **join table**, leading to extra tables and less efficient SQL. The value of `mappedBy` must match the field name on the owning entity.

??? question "Q12: What are the JPA Cascade types?"

    **Answer:**

    | Cascade Type | Effect |
    |-------------|--------|
    | `PERSIST` | Persisting parent also persists children |
    | `MERGE` | Merging parent also merges children |
    | `REMOVE` | Removing parent also removes children |
    | `REFRESH` | Refreshing parent also refreshes children |
    | `DETACH` | Detaching parent also detaches children |
    | `ALL` | All of the above |

    Use `ALL` for true parent-child composition. Avoid `REMOVE` on `@ManyToMany` (would delete shared entities). Prefer explicit cascades for independent lifecycles.

??? question "Q13: What is the difference between orphanRemoval and CascadeType.REMOVE?"

    **Answer:**

    - **`CascadeType.REMOVE`** -- Deletes children when the **parent is deleted**. Removing a child from the collection does NOT delete it.
    - **`orphanRemoval = true`** -- Deletes the child row when it is **removed from the parent's collection**, even if the parent still exists.

    ```java
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items;

    order.getItems().remove(0); // triggers DELETE on that OrderItem row
    ```

---

## Primary Key Strategies

??? question "Q14: What are the @GeneratedValue strategies?"

    **Answer:**

    | Strategy | Mechanism | Pros | Cons |
    |----------|-----------|------|------|
    | `AUTO` | Hibernate picks based on dialect | Portable | Unpredictable |
    | `IDENTITY` | DB auto-increment | Simple | Disables JDBC batch inserts |
    | `SEQUENCE` | DB sequence object | Supports batching; fast | Not on MySQL < 8.0 |
    | `TABLE` | Simulates sequence via table | Portable | Poor performance (row lock) |

    **Best practice:** Use `SEQUENCE` with `allocationSize` for optimal batch insert performance.

??? question "Q15: How do you map composite keys -- @EmbeddedId vs @IdClass?"

    **Answer:**

    **@EmbeddedId** -- Key is an embedded object; access via `entity.getId().getField()`. JPQL uses `o.id.orderId`.

    **@IdClass** -- Key fields declared directly on entity; access via `entity.getField()`. JPQL uses `o.orderId`.

    ```java
    @Embeddable
    public class OrderItemId implements Serializable {
        private Long orderId;
        private Long productId;
    }
    @Entity
    public class OrderItem {
        @EmbeddedId private OrderItemId id;
    }
    ```

    Both require implementing `equals()` and `hashCode()` on the key class.

---

## Inheritance Mapping

??? question "Q16: What are the JPA inheritance mapping strategies?"

    **Answer:**

    | Strategy | Tables | Polymorphic Query | Nullable Cols | Best For |
    |----------|--------|-------------------|---------------|----------|
    | **SINGLE_TABLE** | 1 (discriminator col) | Fast (no JOIN) | Yes | Few subclass fields |
    | **TABLE_PER_CLASS** | N (columns duplicated) | Slow (UNION ALL) | No | Rare polymorphic queries |
    | **JOINED** | N+1 (FK joins) | Moderate (JOINs) | No | Normalized domains |

    ```java
    @Entity
    @Inheritance(strategy = InheritanceType.SINGLE_TABLE)
    @DiscriminatorColumn(name = "payment_type")
    public abstract class Payment { ... }

    @Entity @DiscriminatorValue("CREDIT")
    public class CreditCardPayment extends Payment { ... }
    ```

---

## Querying

??? question "Q17: Compare JPQL, Criteria API, and Native Query."

    **Answer:**

    | Feature | JPQL | Criteria API | Native Query |
    |---------|------|-------------|--------------|
    | Syntax | String-based | Programmatic, type-safe | Raw SQL |
    | Dynamic queries | Awkward concatenation | Excellent | Manual |
    | DB portability | Yes | Yes | No |
    | Best for | Static queries | Dynamic filters | DB-specific features |

    ```java
    // JPQL
    em.createQuery("SELECT e FROM Employee e WHERE e.salary > :min", Employee.class);
    // Criteria
    CriteriaBuilder cb = em.getCriteriaBuilder();
    CriteriaQuery<Employee> cq = cb.createQuery(Employee.class);
    Root<Employee> root = cq.from(Employee.class);
    cq.where(cb.gt(root.get("salary"), minSalary));
    // Native
    em.createNativeQuery("SELECT * FROM employee WHERE salary > ?1", Employee.class);
    ```

??? question "Q18: What are Named Queries and why use them?"

    **Answer:** Named queries are statically declared JPQL/SQL queries **parsed and validated at startup**, catching syntax errors early.

    ```java
    @Entity
    @NamedQuery(name = "Employee.findByDept",
        query = "SELECT e FROM Employee e WHERE e.department.name = :deptName")
    public class Employee { ... }

    List<Employee> emps = em.createNamedQuery("Employee.findByDept", Employee.class)
        .setParameter("deptName", "Engineering").getResultList();
    ```

    Benefits: startup validation, query plan caching, centralized definitions.

??? question "Q19: How do you implement pagination with JPA?"

    **Answer:**

    ```java
    // JPA EntityManager
    em.createQuery("SELECT e FROM Employee e ORDER BY e.id", Employee.class)
        .setFirstResult(20).setMaxResults(10).getResultList();

    // Spring Data JPA
    Page<Employee> page = repo.findAll(PageRequest.of(2, 10, Sort.by("id")));
    ```

    For large datasets, use **keyset pagination** instead of offset-based:

    ```java
    @Query("SELECT e FROM Employee e WHERE e.id > :lastId ORDER BY e.id")
    List<Employee> findNextPage(@Param("lastId") Long lastId, Pageable pageable);
    ```

??? question "Q20: What is the difference between HQL and SQL?"

    **Answer:**

    | Aspect | HQL | SQL |
    |--------|-----|-----|
    | Operates on | Entity classes and properties | Tables and columns |
    | Joins | Implicit via object navigation | Explicit JOIN required |
    | Portability | Database-independent | Database-specific |
    | Polymorphism | `FROM Payment` returns all subtypes | Must query specific tables |

    HQL is a superset of JPQL -- everything valid in JPQL is valid in HQL, plus Hibernate-specific features like `WITH` clauses.

---

## Transactions & Locking

??? question "Q21: What are the @Transactional propagation types?"

    **Answer:**

    | Propagation | Behavior |
    |-------------|----------|
    | `REQUIRED` (default) | Join existing or create new |
    | `REQUIRES_NEW` | Always create new; suspend current |
    | `NESTED` | Nested transaction (savepoint) |
    | `SUPPORTS` | Join if exists; else non-transactional |
    | `NOT_SUPPORTED` | Suspend existing; run non-transactional |
    | `MANDATORY` | Must have existing; else exception |
    | `NEVER` | Must NOT have existing; else exception |

??? question "Q22: How does Hibernate's dirty checking work?"

    **Answer:** When an entity is **Managed**, Hibernate snapshots its field values at load time. At flush, it compares current values against the snapshot and generates `UPDATE` statements for changes automatically.

    ```java
    @Transactional
    public void giveRaise(Long empId) {
        Employee emp = em.find(Employee.class, empId);  // snapshot taken
        emp.setSalary(emp.getSalary() + 5000);          // modify in memory
        // No save() needed -- dirty checking fires UPDATE at flush
    }
    ```

    Use `@DynamicUpdate` to update only changed columns. Use `@Transactional(readOnly = true)` to skip dirty checking for read-only operations.

??? question "Q23: How does optimistic locking work with @Version?"

    **Answer:** A `@Version` field is included in every UPDATE's WHERE clause. If another transaction modified the row, the version won't match, zero rows update, and Hibernate throws `OptimisticLockException`.

    ```java
    @Entity
    public class Product {
        @Id private Long id;
        @Version private Integer version;
        private BigDecimal price;
    }
    ```

    ```sql
    UPDATE product SET price = 29.99, version = 3 WHERE id = 1 AND version = 2
    ```

    **Use for:** read-heavy workloads where conflicts are rare (most web applications).

??? question "Q24: What is pessimistic locking and when should you use it?"

    **Answer:** Acquires a database-level lock on rows, preventing other transactions from reading/writing until released.

    | LockModeType | SQL | Use Case |
    |-------------|-----|----------|
    | `PESSIMISTIC_READ` | `SELECT ... FOR SHARE` | Guarantee no modification during read |
    | `PESSIMISTIC_WRITE` | `SELECT ... FOR UPDATE` | Read-then-write (e.g., inventory decrement) |
    | `PESSIMISTIC_FORCE_INCREMENT` | `FOR UPDATE` + version bump | Combine with optimistic locking |

    **Use when:** conflicts are frequent and retries are too expensive (financial transactions, inventory).

---

## Advanced Features

??? question "Q25: What are DTO projections and interface-based projections?"

    **Answer:** Projections fetch only needed columns, avoiding full entity overhead.

    ```java
    // DTO projection
    public record EmployeeSummary(String name, BigDecimal salary) {}
    @Query("SELECT new com.example.EmployeeSummary(e.name, e.salary) FROM Employee e")
    List<EmployeeSummary> findSummaries();

    // Interface-based projection (Spring Data)
    public interface EmployeeNameOnly {
        String getName();
    }
    List<EmployeeNameOnly> findByDepartmentName(String deptName);
    ```

    DTO projections offer best performance (direct instantiation). Interface projections (closed) use proxies. Open projections (with `@Value` SpEL) have the most overhead.

??? question "Q26: What are @Formula and @Subselect in Hibernate?"

    **Answer:**

    **@Formula** -- Read-only computed property injected into the SELECT clause:

    ```java
    @Formula("salary + bonus")
    private BigDecimal totalCompensation;

    @Formula("(SELECT COUNT(*) FROM task t WHERE t.assignee_id = id)")
    private int taskCount;
    ```

    **@Subselect** -- Maps an entity to a SQL subquery (like a view in code). Must be paired with `@Synchronize` to flush related tables before querying. The entity is read-only.

??? question "Q27: How do you optimize batch inserts and updates?"

    **Answer:**

    ```properties
    spring.jpa.properties.hibernate.jdbc.batch_size=50
    spring.jpa.properties.hibernate.order_inserts=true
    spring.jpa.properties.hibernate.order_updates=true
    ```

    Use `SEQUENCE` strategy (not `IDENTITY` -- identity disables batching). Flush and clear periodically:

    ```java
    for (int i = 0; i < employees.size(); i++) {
        em.persist(employees.get(i));
        if (i % 50 == 0) { em.flush(); em.clear(); }
    }
    ```

    This sends INSERTs in batches of 50 instead of individually, reducing network round trips dramatically.

??? question "Q28: What is connection pooling and why is HikariCP the default?"

    **Answer:** Connection pooling maintains pre-established DB connections so each request avoids TCP + auth overhead. **HikariCP** is the Spring Boot default because it is the fastest pool (sub-microsecond acquisition), has a minimal footprint (~130KB), and includes robust leak detection.

    ```properties
    spring.datasource.hikari.maximum-pool-size=20
    spring.datasource.hikari.minimum-idle=5
    spring.datasource.hikari.connection-timeout=30000
    spring.datasource.hikari.leak-detection-threshold=60000
    ```

    **Sizing:** `pool_size = (core_count * 2) + effective_spindle_count`. Typically 10-20 connections suffice.

---

## Schema Management

??? question "Q29: What are the hibernate.hbm2ddl.auto options?"

    **Answer:**

    | Value | Behavior |
    |-------|----------|
    | `none` | Do nothing (production default) |
    | `validate` | Validate schema vs entities at startup; throw on mismatch |
    | `update` | Add new columns/tables; never drops existing |
    | `create` | Drop and recreate on every startup |
    | `create-drop` | Create on startup, drop on shutdown |

    **Warning:** Never use `update`/`create`/`create-drop` in production. `update` cannot handle renames, type changes, or data migrations.

??? question "Q30: When should you use Flyway/Liquibase instead of hbm2ddl.auto?"

    **Answer:** Always in production. They provide version-controlled migrations, rollback support, data migrations, column renames, audit trails, and team-safe collaboration -- none of which `hbm2ddl.auto` offers.

    ```
    src/main/resources/db/migration/
        V1__create_employee_table.sql
        V2__add_department_table.sql
    ```

    **Best practice:** Use `hbm2ddl.auto=validate` alongside Flyway/Liquibase -- Flyway handles migration, Hibernate validates entity-schema alignment.

---

## Spring Data JPA

??? question "Q31: How does the Spring Data JPA repository abstraction work?"

    **Answer:** Spring auto-generates implementations from interface definitions using JDK dynamic proxies.

    ```java
    public interface EmployeeRepository extends JpaRepository<Employee, Long> {
        List<Employee> findByDepartmentNameAndSalaryGreaterThan(String dept, BigDecimal salary);
        @Query("SELECT e FROM Employee e WHERE e.hireDate > :date")
        List<Employee> findRecentHires(@Param("date") LocalDate date);
    }
    ```

    Hierarchy: `Repository` -> `CrudRepository` -> `PagingAndSortingRepository` -> `JpaRepository` (adds flush, batch, example queries).

??? question "Q32: How do you add custom repository implementations?"

    **Answer:** Create a custom interface, implement it in a class suffixed with `Impl`, and extend both in your repository.

    ```java
    public interface EmployeeRepositoryCustom {
        List<Employee> searchEmployees(EmployeeSearchCriteria criteria);
    }

    public class EmployeeRepositoryCustomImpl implements EmployeeRepositoryCustom {
        @Override
        public List<Employee> searchEmployees(EmployeeSearchCriteria criteria) {
            CriteriaBuilder cb = em.getCriteriaBuilder();
            // ... build dynamic query with Criteria API
        }
    }

    public interface EmployeeRepository
        extends JpaRepository<Employee, Long>, EmployeeRepositoryCustom {}
    ```

??? question "Q33: What are Specifications and QueryDSL?"

    **Answer:** Both provide type-safe, composable dynamic queries.

    **Specifications** (built into Spring Data):

    ```java
    public static Specification<Employee> hasSalaryAbove(BigDecimal min) {
        return (root, query, cb) -> cb.greaterThan(root.get("salary"), min);
    }
    repo.findAll(hasSalaryAbove(80000).and(inDepartment("Engineering")));
    ```

    **QueryDSL** (requires APT plugin): generates Q-classes for a fluent, SQL-like API:

    ```java
    queryFactory.selectFrom(emp)
        .where(emp.salary.gt(80000).and(emp.department.name.eq("Engineering")))
        .fetch();
    ```

    QueryDSL is more readable; Specifications need no extra setup beyond Spring Data.

??? question "Q34: How does auditing work with @CreatedDate and @LastModifiedDate?"

    **Answer:** Enable with `@EnableJpaAuditing` and use `@EntityListeners(AuditingEntityListener.class)`:

    ```java
    @MappedSuperclass
    @EntityListeners(AuditingEntityListener.class)
    public abstract class Auditable {
        @CreatedDate @Column(updatable = false)
        private LocalDateTime createdDate;
        @LastModifiedDate
        private LocalDateTime lastModifiedDate;
        @CreatedBy @Column(updatable = false)
        private String createdBy;
        @LastModifiedBy
        private String lastModifiedBy;
    }
    ```

    Provide an `AuditorAware<String>` bean to resolve the current user (e.g., from `SecurityContext`). Fields are auto-populated on persist and update.

??? question "Q35: What are the multi-tenancy strategies in Hibernate?"

    **Answer:**

    | Strategy | Isolation | Complexity | Use Case |
    |----------|-----------|------------|----------|
    | **Separate Database** | Highest | High | Regulatory/compliance needs |
    | **Separate Schema** | High | Medium | Per-tenant schema in same DB |
    | **Discriminator (shared schema)** | Lowest | Low | SaaS with many small tenants |

    Discriminator-based uses `@Filter` to add a `tenant_id` condition to all queries. Separate schema uses `CurrentTenantIdentifierResolver` to route to the correct schema per request.

    **Best practice:** Start with discriminator for simplicity. Move to separate schema/database only when stronger isolation is required.

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
