---
title: "SQL Interview Questions — Top 50 for Experienced Developers (2025)"
description: "Top SQL interview questions for senior developers. Covers query optimization, indexing strategy, transaction isolation levels, window functions, schema design, and database concurrency — the questions asked at FAANG and top product companies."
---

# SQL Interview Questions — Top 50 for Experienced Developers (2025)

SQL shows up in nearly every backend and data-engineering interview — not as a warmup, but as a signal of depth. At the senior level, interviewers are not checking whether you know SELECT syntax. They are testing whether you can reason about **query execution plans**, choose the right **index strategy** for a given access pattern, explain the exact difference between isolation levels, and design schemas that stay performant at scale.

This page covers the 50 most-asked SQL questions with interview-ready answers targeting **FAANG and senior backend roles** — covering core SQL, query optimization, indexing, transactions, schema design, and system-design-angle database topics.

---

## Section 1 — Core SQL

**1. What is the difference between INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL OUTER JOIN?**

All four are JOIN types — they differ in what rows survive when there is no match on the join condition.

| JOIN type | Result |
|---|---|
| `INNER JOIN` | Only rows with a match in *both* tables |
| `LEFT JOIN` | All rows from left table; NULLs for unmatched right columns |
| `RIGHT JOIN` | All rows from right table; NULLs for unmatched left columns |
| `FULL OUTER JOIN` | All rows from both; NULLs where no match on either side |

```sql
-- Find all customers, even those with no orders
SELECT c.id, c.name, o.order_id
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id;

-- Find customers who have never ordered (anti-join pattern)
SELECT c.id, c.name
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE o.order_id IS NULL;
```

**Senior gotcha:** `CROSS JOIN` produces a Cartesian product (m × n rows) — useful for generating combinations, catastrophic when accidental. Also know `SELF JOIN` for hierarchical data (org chart, adjacency list).

---

**2. What is the difference between WHERE and HAVING?**

- `WHERE` filters rows **before** aggregation — it operates on individual row values.
- `HAVING` filters **after** `GROUP BY` — it operates on aggregated results.

```sql
-- WHERE: filter before grouping (only orders over $100 are counted)
SELECT customer_id, COUNT(*) AS order_count
FROM orders
WHERE amount > 100
GROUP BY customer_id;

-- HAVING: filter after grouping (customers with more than 5 qualifying orders)
SELECT customer_id, COUNT(*) AS order_count
FROM orders
WHERE amount > 100
GROUP BY customer_id
HAVING COUNT(*) > 5;
```

**Interview trap:** You cannot reference an aggregate function in a `WHERE` clause — that triggers a syntax error. `HAVING` is the correct place. You *can* reference the alias in `ORDER BY` (not in `HAVING` in standard SQL, though many databases allow it).

---

**3. What is the difference between a subquery and a CTE? When do you prefer one over the other?**

Both express intermediate result sets. The difference is **readability, reuse, and in some databases, performance**.

```sql
-- Subquery (inline, single use)
SELECT e.name, e.salary
FROM employees e
WHERE e.salary > (SELECT AVG(salary) FROM employees);

-- CTE (Common Table Expression) — same logic, reusable and readable
WITH avg_salary AS (
    SELECT AVG(salary) AS avg_sal FROM employees
)
SELECT e.name, e.salary
FROM employees e
JOIN avg_salary ON e.salary > avg_salary.avg_sal;

-- CTE shines when the same subquery is needed multiple times
WITH dept_stats AS (
    SELECT dept_id, AVG(salary) AS avg_sal, MAX(salary) AS max_sal
    FROM employees
    GROUP BY dept_id
)
SELECT e.name, e.salary, ds.avg_sal
FROM employees e
JOIN dept_stats ds ON e.dept_id = ds.dept_id
WHERE e.salary > ds.avg_sal;
```

**Prefer CTEs when:** the logic is used more than once, the query has multiple transformation steps, or you need a recursive query (hierarchical data). Subqueries can be slightly faster in some databases because CTEs are sometimes materialized — check `EXPLAIN` output.

---

**4. Explain GROUP BY and its rules. What columns must appear in the SELECT clause?**

`GROUP BY` collapses rows with the same value(s) into a single row. The rule: every column in `SELECT` must either appear in `GROUP BY` or be wrapped in an aggregate function (`COUNT`, `SUM`, `AVG`, `MAX`, `MIN`).

```sql
-- Correct: dept_id is in GROUP BY; salary uses aggregate
SELECT dept_id, AVG(salary) AS avg_salary, COUNT(*) AS headcount
FROM employees
GROUP BY dept_id;

-- Error in standard SQL: name is neither aggregated nor in GROUP BY
-- SELECT dept_id, name, AVG(salary) FROM employees GROUP BY dept_id;

-- Group by multiple columns
SELECT dept_id, job_title, COUNT(*) AS cnt
FROM employees
GROUP BY dept_id, job_title
ORDER BY dept_id, cnt DESC;
```

**MySQL gotcha:** MySQL's `ONLY_FULL_GROUP_BY` mode (default in 5.7+) enforces standard SQL rules. Older MySQL allowed non-aggregated, non-grouped columns — a common source of bugs.

---

**5. What are window functions? Explain ROW_NUMBER, RANK, and DENSE_RANK.**

Window functions compute a value across a set of rows **related to the current row** without collapsing them into a group. The `OVER()` clause defines the window.

| Function | Ties handling | Gaps in sequence |
|---|---|---|
| `ROW_NUMBER()` | Arbitrary unique number for ties | No gaps |
| `RANK()` | Same rank for ties | Gaps after ties (1,1,3) |
| `DENSE_RANK()` | Same rank for ties | No gaps (1,1,2) |

```sql
SELECT
    employee_id,
    name,
    salary,
    dept_id,
    ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS row_num,
    RANK()       OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rnk,
    DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS dense_rnk
FROM employees;
```

Classic interview question — "get the top 3 earners per department":

```sql
SELECT *
FROM (
    SELECT *, DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS dr
    FROM employees
) ranked
WHERE dr <= 3;
```

---

**6. What are LAG and LEAD functions? Give a real-world use case.**

`LAG(col, n)` accesses the value n rows **before** the current row. `LEAD(col, n)` accesses n rows **ahead**. Both operate within the window defined by `OVER`.

```sql
-- Month-over-month revenue change
SELECT
    month,
    revenue,
    LAG(revenue, 1)  OVER (ORDER BY month) AS prev_month_revenue,
    revenue - LAG(revenue, 1) OVER (ORDER BY month) AS delta,
    ROUND(
        100.0 * (revenue - LAG(revenue, 1) OVER (ORDER BY month))
              / LAG(revenue, 1) OVER (ORDER BY month),
        2
    ) AS pct_change
FROM monthly_revenue;

-- Session analysis: time gap between consecutive user events
SELECT
    user_id,
    event_time,
    LAG(event_time) OVER (PARTITION BY user_id ORDER BY event_time) AS prev_event,
    EXTRACT(EPOCH FROM (event_time - LAG(event_time) OVER (
        PARTITION BY user_id ORDER BY event_time
    ))) / 60 AS minutes_since_last_event
FROM user_events;
```

---

**7. What is the difference between DELETE, TRUNCATE, and DROP?**

| Command | What it removes | Transaction-safe | Triggers | Speed |
|---|---|---|---|---|
| `DELETE` | Rows (with optional WHERE) | Yes — can rollback | Fires row triggers | Slow for bulk |
| `TRUNCATE` | All rows, resets identity | DDL — auto-commits in most DBs | Does not fire row triggers | Very fast |
| `DROP` | Entire table (structure + data) | DDL — auto-commits | N/A | Immediate |

Use `DELETE` when you need row-level filtering or rollback safety. Use `TRUNCATE` to efficiently empty a table in dev/test. Never use `DROP` unless you intend to remove the schema.

---

**8. What is a correlated subquery? What is its performance implication?**

A correlated subquery references a column from the outer query — it re-executes for each row of the outer query.

```sql
-- Find employees earning more than their department average
-- Correlated: subquery runs once per employee row
SELECT e.name, e.salary, e.dept_id
FROM employees e
WHERE e.salary > (
    SELECT AVG(salary)
    FROM employees
    WHERE dept_id = e.dept_id  -- references outer query's e.dept_id
);
```

**Performance:** O(n × m) complexity — slow at scale. Rewrite using a JOIN with a derived table or CTE:

```sql
WITH dept_avg AS (
    SELECT dept_id, AVG(salary) AS avg_sal
    FROM employees
    GROUP BY dept_id
)
SELECT e.name, e.salary
FROM employees e
JOIN dept_avg d ON e.dept_id = d.dept_id
WHERE e.salary > d.avg_sal;
```

This computes the averages once — O(n + m) instead of O(n × m).

---

**9. What is a self-join? When is it useful?**

A self-join joins a table to itself — treating it as two logical tables via aliases. Use it for hierarchical or comparative data within the same table.

```sql
-- Find the manager's name for each employee (org chart)
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;

-- Find all pairs of employees in the same department
SELECT a.name AS emp1, b.name AS emp2, a.dept_id
FROM employees a
JOIN employees b ON a.dept_id = b.dept_id AND a.id < b.id;
-- a.id < b.id prevents duplicates (Alice-Bob and Bob-Alice)
```

---

**10. What is the difference between UNION and UNION ALL?**

`UNION` removes duplicate rows (sorts and deduplicates — expensive). `UNION ALL` keeps all rows including duplicates — faster because no sort/dedup.

```sql
-- UNION: deduplicates; slower
SELECT email FROM customers
UNION
SELECT email FROM prospects;

-- UNION ALL: keeps duplicates; faster
SELECT email FROM customers
UNION ALL
SELECT email FROM prospects;
```

**Always use `UNION ALL`** unless you explicitly need deduplication. The implicit sort in `UNION` can be a bottleneck on large result sets.

---

## Section 2 — Query Optimization & Execution Plans

**11. What does EXPLAIN / EXPLAIN ANALYZE tell you? How do you read it?**

`EXPLAIN` shows the query execution plan — how the optimizer plans to retrieve data. `EXPLAIN ANALYZE` actually executes the query and shows actual vs estimated rows and timing.

```sql
-- PostgreSQL
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 123 AND status = 'PENDING';

-- MySQL
EXPLAIN SELECT * FROM orders WHERE customer_id = 123;
```

Key columns to watch:

| Field | Red flag |
|---|---|
| `type` (MySQL) | `ALL` = full table scan — almost always bad on large tables |
| `rows` | Large row estimates indicate missing index |
| `Extra` | `Using filesort`, `Using temporary` — expensive operations |
| `cost` (PostgreSQL) | High cost node is the bottleneck |
| `actual rows` vs `rows` | Large mismatch = stale statistics — run `ANALYZE` |

Work from the **innermost / highest-cost node** outward. Fix the most expensive operation first.

---

**12. What is a full table scan? When is it acceptable?**

A full table scan reads every row in the table. The optimizer chooses it when:
- No usable index exists on the filtered columns
- The query returns a large percentage of rows (index read + heap lookup costs more than sequential scan)
- Table statistics are stale

```sql
-- This scans all rows if no index on (status, created_at)
SELECT * FROM orders WHERE status = 'COMPLETED' AND created_at > NOW() - INTERVAL '30 days';
```

**When acceptable:** small tables (< ~1000 rows), analytical queries fetching the majority of rows, or temporary/staging tables. On production OLTP tables with millions of rows, a full scan is almost always a bug.

---

**13. What are the main index types? When do you use each?**

| Index type | Best for | Notes |
|---|---|---|
| **B-tree** | Equality, range, ORDER BY, prefix LIKE | Default in PostgreSQL, MySQL InnoDB — works for `=`, `<`, `>`, `BETWEEN` |
| **Hash** | Exact equality only | No range support; PostgreSQL supports; MySQL InnoDB does not persist hash indexes |
| **GIN / GiST** | Full-text search, JSONB, arrays | PostgreSQL-specific; GIN for discrete values, GiST for ranges/geometric |
| **BRIN** | Very large tables with natural sort order (timestamps, IDs) | Tiny footprint; trades accuracy for size |
| **Composite (multi-column)** | Queries filtering on multiple columns together | Column order matters — leftmost-prefix rule |

```sql
-- B-tree (default)
CREATE INDEX idx_orders_customer ON orders(customer_id);

-- Composite index: benefits queries on (customer_id), (customer_id, status), but NOT (status) alone
CREATE INDEX idx_orders_cust_status ON orders(customer_id, status);

-- Covering index (PostgreSQL INCLUDE)
CREATE INDEX idx_orders_covering ON orders(customer_id) INCLUDE (amount, created_at);
```

---

**14. What is the leftmost-prefix rule for composite indexes?**

A composite index `(a, b, c)` can satisfy queries filtering on:
- `a`
- `a, b`
- `a, b, c`

But NOT:
- `b` alone
- `c` alone
- `b, c` alone

```sql
-- Index: CREATE INDEX idx ON orders(customer_id, status, created_at)

-- Uses index: all three columns, or first one or two
SELECT * FROM orders WHERE customer_id = 5;
SELECT * FROM orders WHERE customer_id = 5 AND status = 'ACTIVE';
SELECT * FROM orders WHERE customer_id = 5 AND status = 'ACTIVE' AND created_at > '2024-01-01';

-- Does NOT use this index
SELECT * FROM orders WHERE status = 'ACTIVE';  -- skips first column
SELECT * FROM orders WHERE status = 'ACTIVE' AND created_at > '2024-01-01';
```

**Design tip:** Put the most selective column (or the equality column) first. Put range-filtered columns last — a range filter on column `a` stops the index from being used for column `b`.

---

**15. What is a covering index?**

A covering index contains **all columns** the query needs — so the database satisfies the query entirely from the index without touching the heap/table at all (no "heap lookup" or "key lookup" in the execution plan).

```sql
-- Query needs: customer_id (filter), amount and created_at (select)
SELECT amount, created_at
FROM orders
WHERE customer_id = 123;

-- Non-covering: finds rows in index, then fetches heap for amount, created_at
CREATE INDEX idx ON orders(customer_id);

-- Covering: entire query satisfied from index
CREATE INDEX idx_covering ON orders(customer_id, amount, created_at);
-- PostgreSQL 11+: cleaner syntax with INCLUDE
CREATE INDEX idx_covering ON orders(customer_id) INCLUDE (amount, created_at);
```

The `INCLUDE` form (PostgreSQL) keeps non-key columns in leaf pages without affecting sort order — useful for columns used only in SELECT.

---

**16. What is index selectivity? Why does it matter?**

Selectivity = `distinct values / total rows`. High selectivity (close to 1.0) means the index narrows results effectively. Low selectivity means many rows match — the index may be useless.

```sql
-- Check selectivity (PostgreSQL)
SELECT
    attname AS column,
    n_distinct,
    CASE WHEN n_distinct > 0
         THEN n_distinct::float / reltuples
         ELSE ABS(n_distinct)  -- negative = fraction of rows
    END AS selectivity
FROM pg_stats
JOIN pg_class ON pg_class.relname = pg_stats.tablename
WHERE tablename = 'orders';
```

**Rule of thumb:**
- `status` on an orders table (3-5 distinct values) → low selectivity → index rarely helps for general queries
- `customer_id` (millions of distinct values) → high selectivity → great index candidate

Low-selectivity columns can still be part of a composite index if combined with high-selectivity columns.

---

**17. What is the N+1 query problem? How do you detect and fix it?**

N+1 occurs when code executes 1 query to fetch N parent records, then N additional queries to fetch related data — one per record.

```java
// N+1 in JPA/Hibernate
List<Order> orders = orderRepository.findAll();  // 1 query
for (Order order : orders) {
    System.out.println(order.getCustomer().getName());  // N queries — one per order
}
```

At the SQL level this becomes:
```sql
SELECT * FROM orders;                             -- 1 query
SELECT * FROM customers WHERE id = 1;             -- N queries
SELECT * FROM customers WHERE id = 2;
-- ... repeated N times
```

**Fix options:**

```java
// Option 1: JOIN FETCH in JPQL
List<Order> orders = em.createQuery(
    "SELECT o FROM Order o JOIN FETCH o.customer", Order.class
).getResultList();  // 1 query with JOIN

// Option 2: @EntityGraph
@EntityGraph(attributePaths = {"customer"})
List<Order> findAll();

// Option 3: @BatchSize — fetches in batches of N instead of 1-by-1
@BatchSize(size = 50)
private Customer customer;
```

**Detection:** Enable SQL logging (`spring.jpa.show-sql=true`), use tools like Hibernate Statistics, or look for many nearly-identical queries in APM traces.

---

**18. What is a query hint? When should you use it?**

Query hints tell the optimizer to use a specific index or join strategy, overriding its cost-based decision.

```sql
-- MySQL: force a specific index
SELECT * FROM orders USE INDEX (idx_orders_status)
WHERE status = 'PENDING';

-- PostgreSQL: no direct hints, but you can disable planner methods:
SET enable_seqscan = OFF;  -- forces index scan (use in session only)
SET enable_hashjoin = OFF;

-- SQL Server
SELECT * FROM orders WITH (INDEX(idx_orders_status))
WHERE status = 'PENDING';
```

**When to use:** sparingly — only when you've verified via `EXPLAIN` that the optimizer makes a wrong choice due to stale statistics or a known edge case. First try: update statistics with `ANALYZE`. Query hints create maintenance debt and can become wrong as data grows.

---

**19. What causes slow queries even with proper indexes?**

Common reasons an indexed query is still slow:

1. **Implicit type conversion:** `WHERE customer_id = '123'` — string literal on an integer column forces a cast on every row, defeating the index.
2. **Function on indexed column:** `WHERE YEAR(created_at) = 2024` — wrapping a column in a function prevents index use. Fix: `WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31'`.
3. **OR conditions:** `WHERE status = 'A' OR customer_id = 5` — may not use an index efficiently. Use `UNION ALL` of two indexed queries.
4. **Leading wildcard:** `WHERE name LIKE '%smith'` — cannot use a B-tree index on the leading `%`.
5. **Stale statistics:** optimizer estimates are wrong. Fix: `ANALYZE table_name`.
6. **Index fragmentation / bloat:** after heavy DELETE/UPDATE. Fix: `REINDEX` or `VACUUM`.

---

**20. What is query cost and how does the optimizer make decisions?**

The query optimizer (cost-based in modern databases) estimates the **cost** of each possible execution plan — measured in I/O page reads + CPU. It chooses the plan with the lowest estimated cost.

Inputs to the cost model:
- Table statistics (`pg_stats`, `information_schema.TABLE_STATISTICS`)
- Index statistics (selectivity, depth)
- Configuration parameters (random_page_cost, seq_page_cost)
- Row count estimates

```sql
-- PostgreSQL: see cost estimate
EXPLAIN SELECT * FROM orders WHERE customer_id = 123;
-- "Index Scan using idx_orders_customer on orders  (cost=0.43..8.45 rows=3 width=200)"
--  cost=startup..total, rows=estimated rows, width=avg row bytes
```

Misestimates happen when: statistics are stale, columns have skewed distributions (most NULLs + few values), or after bulk loads. Always `ANALYZE` after bulk data changes.

---

## Section 3 — Indexing Deep Dive

**21. What is the difference between a clustered index and a non-clustered index?**

| | Clustered Index | Non-Clustered Index |
|---|---|---|
| Physical order | Table rows stored in index order | Separate structure; contains pointer to heap row |
| Count per table | One (the table *is* the index) | Many |
| Lookup | No heap lookup needed | Heap lookup required (unless covering) |
| In InnoDB | Primary key = clustered index | Secondary indexes store PK value as row pointer |
| In PostgreSQL | No true clustered index (CLUSTER command exists but is one-time) | All indexes are non-clustered (heap-based) |

```sql
-- InnoDB: PK is the clustered index
CREATE TABLE orders (
    id BIGINT PRIMARY KEY,  -- this IS the clustered index
    customer_id INT,
    amount DECIMAL(10,2)
);

-- Secondary index in InnoDB stores (customer_id → primary_key_value)
-- Lookup on customer_id: index scan → get PK → PK lookup to fetch row
CREATE INDEX idx_customer ON orders(customer_id);
```

**Implication:** In InnoDB, secondary index lookups require a double lookup (secondary index → PK → clustered index). Covering indexes eliminate the second lookup.

---

**22. When should you NOT create an index?**

Indexes are not free — they cost write overhead and storage. Avoid indexes when:

1. **Low-cardinality column used alone:** boolean, gender, status with 3 values — returns too many rows to be useful.
2. **Small tables:** full table scan is cheaper than index overhead for < ~1000 rows.
3. **Heavily written tables:** every `INSERT`/`UPDATE`/`DELETE` must maintain every index. A table with 10 indexes pays 10x write overhead.
4. **Rarely queried columns:** if the column is only used in reports running nightly, evaluate whether the query runtime justifies continuous write overhead.
5. **Columns in SELECT only (not WHERE/JOIN/ORDER BY):** indexes only help filter/sort, not projection.

```sql
-- Index on a boolean column: rarely beneficial
CREATE INDEX idx_is_deleted ON users(is_deleted);
-- Only 2 values — every "false" query returns ~99% of the table

-- Better: partial index (see Q23)
CREATE INDEX idx_active_users ON users(email) WHERE is_deleted = FALSE;
```

---

**23. What is a partial index? When is it valuable?**

A partial index only indexes rows matching a `WHERE` condition — smaller, faster, and more selective than a full index.

```sql
-- Only index unprocessed orders (tiny fraction of the table)
CREATE INDEX idx_pending_orders ON orders(customer_id)
WHERE status = 'PENDING';

-- Only index non-null values
CREATE INDEX idx_promo_code ON orders(promo_code)
WHERE promo_code IS NOT NULL;

-- Unique constraint on non-deleted emails
CREATE UNIQUE INDEX idx_active_user_email ON users(email)
WHERE deleted_at IS NULL;
```

**Value:** if 5% of orders are PENDING, the partial index is 20x smaller than a full index on `status`. Queries that include `WHERE status = 'PENDING'` will use it; others won't. PostgreSQL supports partial indexes natively; MySQL does not (use generated columns as a workaround).

---

**24. What is index bloat? How does it happen and how do you fix it?**

Index bloat occurs when index pages accumulate dead tuples (from updates/deletes) that are not reclaimed — the index grows but remains useful data shrinks as a percentage.

**Cause:** In PostgreSQL, `UPDATE` creates a new row version (MVCC); the old version is "dead" until `VACUUM` runs. Indexes point to both live and dead versions until vacuumed. Heavy UPDATE/DELETE workloads cause bloat.

```sql
-- Check index bloat (PostgreSQL)
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS scans
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Fix: REINDEX (locks table) or REINDEX CONCURRENTLY (PostgreSQL 12+, no lock)
REINDEX INDEX CONCURRENTLY idx_orders_customer;

-- Or: VACUUM ANALYZE (less aggressive, reclaims dead tuples)
VACUUM ANALYZE orders;
```

**Prevention:** Tune `autovacuum` for high-churn tables. Monitor with `pgstattuple` extension.

---

**25. What is a functional (expression) index?**

An index on the result of a function or expression — makes function-based queries indexable.

```sql
-- Without: this query cannot use index on email (function applied)
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com';

-- Create a functional index
CREATE INDEX idx_users_email_lower ON users(LOWER(email));

-- Now the query uses the index
SELECT * FROM users WHERE LOWER(email) = 'alice@example.com';

-- Another example: index on JSON field (PostgreSQL)
CREATE INDEX idx_users_meta_city ON users((metadata->>'city'));

-- Index on date part
CREATE INDEX idx_orders_year ON orders(EXTRACT(YEAR FROM created_at));
```

**Requirement:** the query predicate must exactly match the expression in the index definition — `LOWER(email)` vs `lower(email)` may matter (PostgreSQL is case-sensitive here).

---

**26. What is the difference between an index scan, index-only scan, and bitmap index scan?**

| Scan type | Description | When |
|---|---|---|
| **Index Scan** | Walks index, fetches each matching row from heap | Selective query, few rows |
| **Index-Only Scan** | Satisfies query entirely from index (covering index) | All needed columns in index |
| **Bitmap Index Scan** | Collects all matching TIDs into a bitmap, then fetches heap pages in order | Medium selectivity, many rows — amortizes random I/O |
| **Sequential Scan** | Reads entire table | Low selectivity or no useful index |

```sql
-- Force explain to see scan type (PostgreSQL)
EXPLAIN (ANALYZE, BUFFERS)
SELECT customer_id, amount FROM orders WHERE customer_id = 123;
-- "Index Only Scan" if (customer_id, amount) covering index exists
-- "Index Scan" if only customer_id indexed
-- "Bitmap Heap Scan" if medium-selectivity result set
```

**Bitmap scan** is PostgreSQL's optimization for queries returning hundreds to thousands of rows — it avoids jumping back and forth in the heap by sorting the row locations first.

---

**27. How does InnoDB handle index updates internally?**

InnoDB uses a **change buffer** (part of the buffer pool) to defer writes to secondary index pages when those pages are not in memory. Instead of fetching the page from disk for each insert, it buffers the change and applies it lazily when the page is eventually read.

- Primary key (clustered) index: always updated immediately (rows are stored there)
- Secondary indexes: changes buffered if the page is not in memory
- At checkpoint / page read: buffered changes are merged

**Implication:** heavy inserts into tables with many secondary indexes can cause a "merge storm" — a spike in I/O when the change buffer is flushed. Monitor with `SHOW ENGINE INNODB STATUS`.

---

**28. What is a composite index vs. multiple single-column indexes on the same table?**

A composite index `(a, b)` serves queries filtering on `a` AND `b` together — it's a single B-tree that the database walks once. Multiple single-column indexes on `a` and `b` require a bitmap AND operation to combine results (two index scans + merge).

```sql
-- Query: WHERE dept_id = 10 AND status = 'ACTIVE'

-- Option 1: two single-column indexes
CREATE INDEX idx_dept ON employees(dept_id);
CREATE INDEX idx_status ON employees(status);
-- Database must bitmap-AND results of two index scans

-- Option 2: one composite index (better for this query pattern)
CREATE INDEX idx_dept_status ON employees(dept_id, status);
-- Single index walk — more efficient
```

**When multiple single-column indexes win:** the columns are queried independently in different query patterns, and no single query uses both together. The composite index only helps queries that match the leftmost prefix.

---

## Section 4 — Transactions & Concurrency

**29. What is ACID? Explain each property.**

ACID is the set of guarantees that make database transactions reliable.

| Property | Meaning | Example |
|---|---|---|
| **Atomicity** | All-or-nothing: either all operations in a transaction commit, or none do | Transfer $100: debit account A AND credit account B. If credit fails, debit rolls back. |
| **Consistency** | Transaction moves the database from one valid state to another — all constraints satisfied | FK constraints, CHECK constraints, unique constraints enforced on commit |
| **Isolation** | Concurrent transactions behave as if they ran serially | Two simultaneous transfers don't see each other's intermediate states |
| **Durability** | Committed transactions survive crashes | Write-ahead log (WAL) ensures committed data survives a server restart |

```sql
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;  -- debit
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;  -- credit
COMMIT;
-- If either UPDATE fails, ROLLBACK restores both rows
```

**Senior note:** "Consistency" in ACID is about database-level constraints, not the "C" in CAP theorem. They mean different things.

---

**30. What are the four transaction isolation levels?**

Isolation levels trade consistency for concurrency. Higher isolation = fewer anomalies but more lock contention.

| Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|---|---|---|---|
| READ UNCOMMITTED | Possible | Possible | Possible |
| READ COMMITTED | Prevented | Possible | Possible |
| REPEATABLE READ | Prevented | Prevented | Possible (MySQL prevents this too) |
| SERIALIZABLE | Prevented | Prevented | Prevented |

```sql
-- PostgreSQL
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
BEGIN;
  SELECT balance FROM accounts WHERE id = 1;  -- reads balance
  -- ... application logic ...
  SELECT balance FROM accounts WHERE id = 1;  -- reads same balance even if another txn committed
COMMIT;

-- MySQL InnoDB default: REPEATABLE READ
-- PostgreSQL default: READ COMMITTED
```

---

**31. What is a dirty read, non-repeatable read, and phantom read?**

**Dirty read:** transaction reads data written by another uncommitted transaction.
```sql
-- Session A: BEGIN; UPDATE accounts SET balance = 0 WHERE id = 1;  (not committed)
-- Session B (READ UNCOMMITTED): SELECT balance FROM accounts WHERE id = 1;  → sees 0 (uncommitted)
-- Session A: ROLLBACK;  → Session B read data that never existed
```

**Non-repeatable read:** the same `SELECT` returns different values within the same transaction because another transaction committed an `UPDATE` in between.
```sql
-- Session A: BEGIN; SELECT balance FROM accounts WHERE id = 1;  → 500
-- Session B: UPDATE accounts SET balance = 300 WHERE id = 1; COMMIT;
-- Session A: SELECT balance FROM accounts WHERE id = 1;  → 300 (different!) 
```

**Phantom read:** a repeated query returns different *rows* (not values) because another transaction inserted or deleted rows matching the predicate.
```sql
-- Session A: BEGIN; SELECT COUNT(*) FROM orders WHERE status = 'PENDING';  → 10
-- Session B: INSERT INTO orders (status) VALUES ('PENDING'); COMMIT;
-- Session A: SELECT COUNT(*) FROM orders WHERE status = 'PENDING';  → 11 (phantom row appeared)
```

---

**32. What is a deadlock? How does it occur and how do you handle it?**

A deadlock occurs when two (or more) transactions each hold a lock the other needs, forming a cycle.

```
Transaction A: LOCK row 1 → waiting for row 2
Transaction B: LOCK row 2 → waiting for row 1
→ Neither can proceed
```

```sql
-- Classic deadlock scenario
-- Session A:
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;  -- locks row 1
-- (pause) ...
UPDATE accounts SET balance = balance + 100 WHERE id = 2;  -- waits for row 2

-- Session B (concurrent):
BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 2;   -- locks row 2
-- (pause) ...
UPDATE accounts SET balance = balance + 50 WHERE id = 1;   -- waits for row 1 → DEADLOCK
```

**Detection:** databases detect cycles and kill one transaction (the "victim") with an error. Application must catch and retry.

**Prevention:**
1. **Consistent lock ordering:** always acquire locks in the same order (always lock lower ID first)
2. **Keep transactions short:** reduce the window where locks are held
3. **Use `SELECT FOR UPDATE SKIP LOCKED`** for queue-style processing
4. **Reduce lock granularity:** row locks are safer than table locks

```java
// Spring: catch deadlock and retry
@Retryable(value = DeadlockLoserDataAccessException.class, maxAttempts = 3)
@Transactional
public void transfer(long fromId, long toId, BigDecimal amount) { ... }
```

---

**33. What is optimistic locking vs. pessimistic locking?**

| | Optimistic Locking | Pessimistic Locking |
|---|---|---|
| Assumption | Conflicts are rare | Conflicts are frequent |
| Mechanism | Check version at commit; fail if changed | Lock row on read |
| SQL | `UPDATE ... WHERE id = ? AND version = ?` | `SELECT ... FOR UPDATE` |
| Concurrency | High — no locks held during read | Lower — readers block writers |
| Use case | Read-heavy, low contention | Write-heavy, inventory, financial |

```sql
-- Optimistic locking: version column
UPDATE products
SET stock = stock - 1, version = version + 1
WHERE id = 42 AND version = 7;
-- 0 rows updated = conflict → retry in application

-- Pessimistic locking: row-level exclusive lock
BEGIN;
SELECT * FROM products WHERE id = 42 FOR UPDATE;  -- locks the row
-- ... business logic ...
UPDATE products SET stock = stock - 1 WHERE id = 42;
COMMIT;
```

In JPA: `@Version` for optimistic, `LockModeType.PESSIMISTIC_WRITE` for pessimistic.

---

**34. What is MVCC (Multi-Version Concurrency Control)?**

MVCC allows readers and writers to not block each other by keeping multiple versions of each row. Readers see a snapshot of the database as of their transaction start time; writers create new versions.

- **PostgreSQL:** uses MVCC for all isolation levels. Dead tuples accumulate until `VACUUM` runs.
- **MySQL InnoDB:** uses MVCC with an undo log. Rollback segment keeps old versions.

```
Row id=1, version 1: balance=500  (visible to transactions started before T2)
Row id=1, version 2: balance=400  (written by T2, visible after T2 commits)
```

**Benefits:**
- Reads never block writes; writes never block reads
- Snapshot isolation "for free" — no read locks needed
- Enables consistent backups (point-in-time snapshot)

**Cost:** Dead tuples waste storage (PostgreSQL). Undo logs grow under long-running transactions (MySQL). `VACUUM`/autovacuum must run regularly.

---

**35. What is a savepoint? When do you use it?**

A savepoint is a named marker within a transaction that allows partial rollback — you can rollback to the savepoint without aborting the entire transaction.

```sql
BEGIN;
  INSERT INTO audit_log (event) VALUES ('start');

  SAVEPOINT before_risky_operation;

  UPDATE accounts SET balance = -999 WHERE id = 1;  -- risky!

  -- Detect error, rollback to savepoint only
  ROLLBACK TO SAVEPOINT before_risky_operation;

  -- Transaction is still open; continue with safe operations
  UPDATE accounts SET balance = 0 WHERE id = 1;

COMMIT;
```

**Use cases:**
- Batch processing — rollback one failed item without losing the whole batch
- Stored procedures with error handling
- Nested transaction simulation in ORM frameworks (Spring's `PROPAGATION_NESTED`)

---

**36. What is two-phase locking (2PL) and how does it relate to serializability?**

2PL is a concurrency control protocol that guarantees serializable execution: a transaction **acquires all locks it needs before releasing any**. Two phases:
1. **Growing phase:** acquire locks, never release
2. **Shrinking phase:** release locks, never acquire new ones

```
T1: LOCK(A) → LOCK(B) → [release phase] → UNLOCK(A) → UNLOCK(B)
T2: LOCK(C) → LOCK(A) → ...  (blocks until T1 unlocks A)
```

2PL prevents non-serializable anomalies but does **not** prevent deadlocks — in fact it increases deadlock risk (because locks are held longer). Most databases use variations like **strict 2PL** (hold all locks until commit) rather than pure 2PL.

---

**37. What is a long-running transaction? Why is it dangerous?**

A transaction that stays open for minutes or hours without committing.

**Problems:**
- **Lock contention:** holds row locks, blocking other transactions
- **MVCC overhead:** PostgreSQL cannot vacuum dead tuples needed by the long transaction; table bloat grows
- **Undo log growth (MySQL):** InnoDB undo segment grows; affects all queries, not just the long transaction
- **Replication lag:** MySQL binlog-based replication serializes long transactions

```sql
-- PostgreSQL: find long-running transactions
SELECT pid, now() - xact_start AS duration, query, state
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY duration DESC;

-- Kill if necessary
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE now() - xact_start > INTERVAL '10 minutes';
```

**Prevention:** keep transactions short, never leave them open waiting for user input, use connection pool statement timeouts.

---

**38. What is SELECT FOR UPDATE SKIP LOCKED? When is it used?**

`SELECT FOR UPDATE SKIP LOCKED` locks selected rows and **skips** any rows already locked by another transaction — instead of blocking. Essential for building job queues on relational databases.

```sql
-- Worker process: claim one pending job without blocking other workers
BEGIN;
SELECT id, payload
FROM job_queue
WHERE status = 'PENDING'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- Process the job ...

UPDATE job_queue SET status = 'DONE' WHERE id = :claimed_id;
COMMIT;
```

Without `SKIP LOCKED`, multiple workers would block each other on the same row. With it, each worker atomically claims a different row. Supported in PostgreSQL 9.5+ and MySQL 8.0+.

---

## Section 5 — Schema Design

**39. Explain database normalization: 1NF, 2NF, 3NF, and BCNF.**

Normalization eliminates redundancy and update anomalies by organizing data into well-structured tables.

**1NF (First Normal Form):** no repeating groups; each column contains atomic (indivisible) values; each row is unique.
```sql
-- Violates 1NF: phone_numbers is multi-valued
CREATE TABLE contacts (id INT, name VARCHAR, phone_numbers VARCHAR);
-- ('1', 'Alice', '555-1234, 555-5678')

-- 1NF: separate table for phones
CREATE TABLE contact_phones (contact_id INT, phone VARCHAR, PRIMARY KEY (contact_id, phone));
```

**2NF:** 1NF + every non-key column is **fully functionally dependent** on the entire primary key (no partial dependencies — only matters with composite PKs).
```sql
-- Violates 2NF: order_item has (order_id, product_id) PK
-- product_name depends only on product_id (partial dependency)
-- Fix: move product_name to products table
```

**3NF:** 2NF + no **transitive dependencies** — non-key columns depend only on the PK, not on other non-key columns.
```sql
-- Violates 3NF: employees(id, dept_id, dept_name)
-- dept_name depends on dept_id (not on id) → transitive
-- Fix: separate departments table
```

**BCNF (Boyce-Codd):** stricter 3NF — every determinant must be a candidate key. Eliminates anomalies 3NF misses when there are overlapping composite candidate keys.

---

**40. When should you denormalize? What are the trade-offs?**

Denormalization intentionally introduces redundancy to improve read performance. Use it when:

1. **Frequent joins are a bottleneck:** pre-join the data into a denormalized table or add redundant columns
2. **Aggregates are expensive:** store `total_order_amount` on the order header instead of always summing line items
3. **Read-heavy, write-light:** analytics/reporting tables, read replicas, materialized views

```sql
-- Normalized: every order total requires summing line items
SELECT o.id, SUM(li.quantity * li.unit_price) AS total
FROM orders o JOIN line_items li ON o.id = li.order_id
GROUP BY o.id;

-- Denormalized: total stored directly (updated on insert/update of line_items via trigger or app logic)
ALTER TABLE orders ADD COLUMN total_amount DECIMAL(10,2);
```

**Trade-offs:**
- Write complexity: updates must maintain consistency of redundant data
- Storage cost
- Risk of inconsistency if denormalization is not maintained atomically (use transactions)

---

**41. What is a surrogate key vs. a natural key? Which do you prefer?**

| | Surrogate Key | Natural Key |
|---|---|---|
| Definition | System-generated (auto-increment, UUID) | Meaningful business attribute (SSN, email) |
| Pros | Stable, compact, no business logic leaks | No extra column needed, self-documenting |
| Cons | Extra column, no business meaning | Can change (email changes), may be long/complex |

```sql
-- Surrogate key (preferred in most systems)
CREATE TABLE customers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL
);

-- Natural key
CREATE TABLE currencies (
    code CHAR(3) PRIMARY KEY,  -- 'USD', 'EUR' — stable, meaningful
    name VARCHAR(50)
);
```

**Recommendation:** use surrogates for most entities (they are stable and join-efficient as foreign keys). Use natural keys only when the business key is guaranteed stable and short (currency codes, country ISO codes).

---

**42. How do you implement soft deletes? What are the pitfalls?**

Soft delete: mark rows as deleted with a flag/timestamp instead of physically removing them.

```sql
-- Common pattern
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;

-- "Delete"
UPDATE users SET deleted_at = NOW() WHERE id = 42;

-- Query active users
SELECT * FROM users WHERE deleted_at IS NULL;
```

**Pitfalls:**
1. **Unique constraints break:** you can't have `UNIQUE (email)` if deleted users keep their email. Fix: partial unique index: `CREATE UNIQUE INDEX idx_active_email ON users(email) WHERE deleted_at IS NULL;`
2. **Query pollution:** every query needs `WHERE deleted_at IS NULL`. Fix: database view or ORM global filter (`@Where` in Hibernate).
3. **Foreign keys:** cascading deletes may not trigger. Child records remain with a FK pointing to a "deleted" parent.
4. **Performance:** index on `deleted_at IS NULL` needed; partial index is ideal.
5. **Regulatory compliance:** GDPR "right to be forgotten" may require true deletion anyway.

---

**43. What are audit columns? How do you implement them?**

Audit columns track when a row was created and last modified, and by whom. Standard pattern:

```sql
CREATE TABLE orders (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    amount      DECIMAL(10,2) NOT NULL,
    -- Audit columns
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by  VARCHAR(100),
    updated_by  VARCHAR(100),
    version     INT NOT NULL DEFAULT 1  -- for optimistic locking
);

-- Trigger to auto-update updated_at (PostgreSQL)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

In Spring/JPA: use `@CreatedDate`, `@LastModifiedDate`, `@CreatedBy`, `@LastModifiedBy` with `@EntityListeners(AuditingEntityListener.class)` — no trigger needed.

---

**44. What is the difference between a one-to-many and a many-to-many relationship? How do you model each?**

**One-to-many:** one parent row relates to many child rows — use a foreign key on the child.
```sql
-- One customer → many orders
CREATE TABLE orders (
    id          BIGINT PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id)  -- FK on many side
);
```

**Many-to-many:** each row in A can relate to many rows in B and vice versa — use a junction (bridge) table.
```sql
-- Students and Courses: a student takes many courses; a course has many students
CREATE TABLE student_courses (
    student_id BIGINT REFERENCES students(id),
    course_id  BIGINT REFERENCES courses(id),
    enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (student_id, course_id)
);
```

Add columns to the junction table when the relationship itself has attributes (enrollment date, grade, etc.). In JPA: `@ManyToMany` + `@JoinTable`, or model the junction as its own entity for richer relationships.

---

**45. What is referential integrity and when might you intentionally relax it?**

Referential integrity (enforced by foreign keys) ensures a FK value always points to an existing PK. The database rejects inserts/updates that violate this.

```sql
-- Enforced: cannot insert order with non-existent customer
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id);
```

**When to relax (disable FK constraints):**
1. **Bulk data loads:** FK checks slow down ETL jobs. Disable, load, validate, re-enable.
2. **Microservices:** each service owns its database. Cross-service FKs are impossible — enforce integrity at the application layer.
3. **Event-sourced systems:** events may arrive out of order; enforce consistency via eventual consistency.
4. **Sharding:** rows referenced by a FK may live on a different shard — cross-shard FKs are not supported.

---

## Section 6 — Advanced / System Design Angle

**46. What are the trade-offs between offset pagination and keyset (cursor) pagination?**

**Offset pagination:** `LIMIT n OFFSET k` — skip k rows, return n. Simple but has problems at scale.

```sql
-- Offset pagination (page 1000, 20 items per page)
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 19980;
-- Database must scan and discard 19,980 rows — gets slower as offset grows
```

**Keyset pagination (cursor-based):** use the last seen value as the anchor — no row skipping.

```sql
-- First page
SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 20;

-- Next page: pass last seen (created_at, id) as cursor
SELECT * FROM orders
WHERE (created_at, id) < ('2024-03-15 10:30:00', 9876)  -- last row of prev page
ORDER BY created_at DESC, id DESC
LIMIT 20;
-- Index on (created_at DESC, id DESC) makes this O(1) regardless of page number
```

| | Offset | Keyset |
|---|---|---|
| Performance | Degrades with page depth | Constant — O(log n) per page |
| Arbitrary jump | Yes — `OFFSET k` directly | No — must paginate from start |
| Stable results | No — inserts shift offsets | Yes — cursor anchors position |
| Complexity | Simple | Moderate |

**Use keyset for:** infinite scroll, APIs serving deep pages, large tables. Use offset for: small datasets, UI needing arbitrary page jumps.

---

**47. What is database partitioning? What are the partition types?**

Partitioning splits a large table into smaller physical sub-tables (partitions) while appearing as one logical table. The database routes queries to the relevant partition(s) — called **partition pruning**.

```sql
-- Range partitioning by month (PostgreSQL declarative partitioning)
CREATE TABLE orders (
    id          BIGINT,
    created_at  TIMESTAMP NOT NULL,
    amount      DECIMAL(10,2)
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_2024_q1 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
CREATE TABLE orders_2024_q2 PARTITION OF orders
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- Query automatically uses partition pruning:
SELECT * FROM orders WHERE created_at BETWEEN '2024-01-01' AND '2024-03-31';
-- Only scans orders_2024_q1
```

**Partition types:**
| Type | Use case |
|---|---|
| **Range** | Time-series data (logs, orders by date) |
| **List** | Discrete values (region, country, status) |
| **Hash** | Even distribution (user_id % N) |
| **Composite** | Range + Hash for very large tables |

---

**48. What is the difference between sharding and partitioning?**

| | Partitioning | Sharding |
|---|---|---|
| Scope | Single database instance — multiple files/tablespaces | Multiple database instances (nodes) |
| Transparency | Application sees one logical table | Application must know which shard to query |
| Joins | Cross-partition joins work (same instance) | Cross-shard joins are expensive / avoided |
| Scalability | Scales storage/query performance on one node | Scales write throughput across nodes |
| Failure isolation | Single point of failure | Each shard is independent |

**Partitioning** is a storage optimization on a single database. **Sharding** is a horizontal scaling pattern across multiple databases.

```
Partitioning: orders table → orders_2024_q1 + orders_2024_q2 (same Postgres instance)
Sharding:     user_id % 4 → shard_0.orders, shard_1.orders, shard_2.orders, shard_3.orders
              (four separate Postgres instances)
```

In practice: partition first, shard only when a single node cannot handle the load. Sharding adds enormous operational complexity.

---

**49. What is a read replica? How does it affect query routing and consistency?**

A read replica is a secondary database instance that receives a copy of all writes from the primary via replication (WAL streaming in PostgreSQL, binlog in MySQL). Reads can be directed to replicas to scale read throughput.

```
Application → Write → Primary DB
             → Read  → Replica 1
             → Read  → Replica 2
```

**Replication lag:** writes commit on primary and asynchronously replicate to replicas. There is always some lag (typically milliseconds to seconds). After a write, a subsequent read on a replica may not see the new data — **read-your-own-writes** is not guaranteed without routing the read to the primary.

**Routing strategy:**
```java
// Spring AbstractRoutingDataSource pattern
// Annotate reads to go to replica, writes to primary
@Transactional(readOnly = true)  // routes to replica
public List<Order> getOrders() { ... }

@Transactional  // routes to primary
public Order createOrder(OrderRequest req) { ... }
```

**Consistency options:**
- **Synchronous replication:** primary waits for replica to confirm write — no lag, but slower writes, replica becomes blocking
- **Asynchronous (default):** low latency writes, potential data loss on primary failure
- **Semi-synchronous (MySQL):** at least one replica confirms before primary commits

---

**50. How would you design a time-series table that needs to store billions of rows and serve range queries efficiently?**

This is a system-design SQL question. Key decisions:

1. **Partition by time range** — monthly or weekly partitions eliminate the need to scan old data
2. **Clustered on (entity_id, timestamp)** — most queries filter by entity + time window
3. **Covering index** — include the metric columns to avoid heap lookups
4. **BRIN index on timestamp** — massive space saving when data is naturally ordered by time
5. **Retention policy** — `DROP PARTITION` is O(1) vs `DELETE` which is O(rows)

```sql
-- PostgreSQL time-series schema
CREATE TABLE metrics (
    sensor_id    BIGINT NOT NULL,
    recorded_at  TIMESTAMPTZ NOT NULL,
    value        DOUBLE PRECISION NOT NULL,
    tags         JSONB
) PARTITION BY RANGE (recorded_at);

-- Automate monthly partition creation (pg_partman extension)
-- Or create manually:
CREATE TABLE metrics_2024_06 PARTITION OF metrics
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

-- Covering composite index per partition
CREATE INDEX ON metrics_2024_06 (sensor_id, recorded_at) INCLUDE (value);

-- BRIN on recorded_at for bulk scans (PostgreSQL)
CREATE INDEX ON metrics_2024_06 USING BRIN (recorded_at);

-- Query: last 24h for sensor 42 (hits only today's partition + covering index)
SELECT recorded_at, value
FROM metrics
WHERE sensor_id = 42
  AND recorded_at >= NOW() - INTERVAL '24 hours'
ORDER BY recorded_at DESC;

-- Drop old data: O(1), no lock, no VACUUM needed
DROP TABLE metrics_2023_01;
```

**At even larger scale:** TimescaleDB (PostgreSQL extension), ClickHouse (columnar), or Apache Cassandra (wide-column, write-optimized) — each trades relational features for write/read throughput at billions of rows.

---

## Quick Reference

| Concept | One-line answer |
|---|---|
| INNER JOIN | Only matched rows from both tables |
| LEFT JOIN | All left rows; NULLs for unmatched right |
| WHERE vs HAVING | WHERE filters rows before grouping; HAVING filters after aggregation |
| Subquery vs CTE | CTE is named, reusable, and supports recursion; subquery is inline |
| ROW_NUMBER | Unique sequential number even for ties |
| RANK | Same rank for ties, gaps after |
| DENSE_RANK | Same rank for ties, no gaps |
| LAG/LEAD | Access previous/next row value without a self-join |
| B-tree index | Default; equality, range, ORDER BY |
| Hash index | Equality only; faster than B-tree for exact lookups |
| Composite index | Leftmost-prefix rule: (a,b,c) helps queries on a, a+b, a+b+c |
| Covering index | All needed columns in index; no heap lookup |
| Clustered index | Table rows stored in index order (InnoDB PK) |
| Partial index | Index only rows matching a WHERE condition |
| ACID | Atomicity, Consistency, Isolation, Durability |
| READ COMMITTED | Prevents dirty reads; default in PostgreSQL |
| REPEATABLE READ | Prevents dirty + non-repeatable reads; default in MySQL InnoDB |
| SERIALIZABLE | Prevents all anomalies; highest isolation, most locking |
| Dirty read | Reading uncommitted data from another transaction |
| Phantom read | New rows appear in a repeated query within the same transaction |
| Deadlock | Two txns waiting on each other's locks; one is killed and retried |
| Optimistic locking | Version check at commit; no locks held during read |
| Pessimistic locking | `SELECT FOR UPDATE`; row locked during read |
| MVCC | Multiple row versions; readers don't block writers |
| Offset pagination | Simple but O(n) at depth; rows shift on concurrent inserts |
| Keyset pagination | O(log n) regardless of depth; no arbitrary page jump |
| Partitioning | Splits one table into physical sub-tables on one instance |
| Sharding | Horizontal split across multiple database instances |
| Read replica | Secondary DB receiving replicated writes; asynchronous lag risk |
| N+1 problem | 1 query for N parents + N queries for children; fix with JOIN FETCH |
| 1NF | Atomic values, no repeating groups |
| 3NF | No transitive dependencies (non-key depends only on PK) |
| Soft delete | `deleted_at` timestamp instead of physical removal; beware unique constraints |
