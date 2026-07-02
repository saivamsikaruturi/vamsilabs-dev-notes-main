---
title: "Top 40 SQL Interview Questions & Answers (2026)"
description: "Why: This separation enforces a clear boundary between structure changes (DDL, which auto-commit in most RDBMS) and data manipulation (DML, which is..."
---

# Top 40 SQL Interview Questions & Answers

---

## SQL Basics & Categories

??? question "Q1: What is the difference between DDL, DML, DCL, and TCL?"

    **Answer:** SQL commands are classified into four categories based on what they operate on -- schema, data, permissions, or transaction boundaries.

    **Why:** This separation enforces a clear boundary between structure changes (DDL, which auto-commit in most RDBMS) and data manipulation (DML, which is transactional). Mixing them up causes subtle bugs -- e.g., a `TRUNCATE` inside a transaction won't rollback in MySQL.

    **How they map:**

    | Category | Commands | Purpose |
    |----------|----------|---------|
    | **DDL** (Data Definition) | `CREATE`, `ALTER`, `DROP`, `TRUNCATE` | Define/modify schema |
    | **DML** (Data Manipulation) | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Manipulate data |
    | **DCL** (Data Control) | `GRANT`, `REVOKE` | Control access/permissions |
    | **TCL** (Transaction Control) | `COMMIT`, `ROLLBACK`, `SAVEPOINT` | Manage transactions |

    ```sql
    CREATE TABLE employees (id INT PRIMARY KEY, name VARCHAR(100)); -- DDL
    INSERT INTO employees VALUES (1, 'Alice');                      -- DML
    GRANT SELECT ON employees TO analyst_role;                      -- DCL
    BEGIN; UPDATE employees SET name='Bob' WHERE id=1; COMMIT;      -- TCL
    ```

    **When to use:** Understand the category to predict commit behavior. DDL implicitly commits in Oracle/MySQL, so you cannot rollback a `DROP TABLE`.

    **Gotchas:** `TRUNCATE` is DDL (not DML) -- it won't fire row-level triggers and resets identity counters. `SELECT` is technically DML even though it doesn't modify data.

??? question "Q2: What is the difference between a Primary Key and a Unique Key?"

    **Answer:** A Primary Key is the row's identity -- non-null and singular per table -- while a Unique Key simply enforces uniqueness on a column that may allow NULLs.

    **Why:** The PK defines how the storage engine physically organizes data (clustered index in SQL Server/InnoDB). Unique keys exist for business constraints like "email must be unique" without dictating physical layout.

    **How:**

    | Feature | Primary Key | Unique Key |
    |---------|-------------|------------|
    | NULLs | Not allowed | Allows one NULL (varies by RDBMS) |
    | Count per table | Only one | Multiple allowed |
    | Clustered index | Created by default (SQL Server) | Non-clustered by default |

    ```sql
    CREATE TABLE users (
        user_id  INT PRIMARY KEY,         -- one per table, no NULLs
        email    VARCHAR(255) UNIQUE,      -- unique, allows one NULL
        username VARCHAR(100) UNIQUE
    );
    ```

    **When to use:** PK for the canonical row identifier (surrogate or natural). Unique keys for alternate business identifiers (email, SSN) that you also want indexed.

    **Gotchas:** PostgreSQL allows multiple NULLs in a UNIQUE column (NULLs are never equal); SQL Server allows only one. A composite PK means *every column* in the key is NOT NULL. Changing a PK on a large table requires a full table rebuild.

??? question "Q3: What is a Foreign Key and how does it enforce referential integrity?"

    **Answer:** A foreign key is a constraint that guarantees every value in a child column exists in the parent table's referenced column -- preventing orphan records.

    **Why:** Without FKs, your application code alone is responsible for data consistency. One buggy INSERT or a direct DB migration can silently create dangling references that corrupt business logic.

    **How:** The DB checks the FK constraint on every INSERT/UPDATE to the child and on every DELETE/UPDATE to the parent. Referential actions define what happens to children when the parent changes.

    ```sql
    CREATE TABLE departments (dept_id INT PRIMARY KEY, dept_name VARCHAR(100));
    CREATE TABLE employees (
        emp_id  INT PRIMARY KEY, name VARCHAR(100), dept_id INT,
        FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
            ON DELETE CASCADE ON UPDATE SET NULL
    );
    -- INSERT INTO employees VALUES (1, 'Alice', 99); -- ERROR if dept 99 missing
    ```

    Referential actions: `CASCADE`, `SET NULL`, `SET DEFAULT`, `RESTRICT`, `NO ACTION`.

    **When to use:** Always in OLTP systems for data integrity. Skip in data warehouses or high-write event tables where throughput matters more than relational correctness.

    **Gotchas:** `ON DELETE CASCADE` can silently wipe thousands of child rows -- dangerous on production. FKs add overhead to every write (parent lookup). Circular FKs make schema migrations a nightmare. `NO ACTION` vs `RESTRICT` differs only in deferrable constraint timing.

---

## Joins

??? question "Q4: Explain INNER, LEFT, RIGHT, FULL OUTER, and CROSS JOIN."

    **Answer:** Joins combine rows from two tables based on a condition -- they differ in how they handle non-matching rows.

    **Why:** Real data lives across normalized tables. Joins are the mechanism to reassemble it. Choosing the wrong join type silently drops data or inflates row counts.

    **How:**

    ```sql
    -- employees: (1,'Alice',10), (2,'Bob',20), (3,'Carol',NULL)
    -- departments: (10,'Engineering'), (20,'Sales'), (30,'Marketing')

    -- INNER JOIN: only matching rows
    SELECT e.name, d.dept_name FROM employees e
    INNER JOIN departments d ON e.dept_id = d.dept_id;
    -- Alice-Engineering, Bob-Sales

    -- LEFT JOIN: all from left + matches from right (NULL if none)
    SELECT e.name, d.dept_name FROM employees e
    LEFT JOIN departments d ON e.dept_id = d.dept_id;
    -- Alice-Engineering, Bob-Sales, Carol-NULL

    -- RIGHT JOIN: all from right + matches from left
    -- FULL OUTER JOIN: all from both sides, NULLs where unmatched
    -- CROSS JOIN: cartesian product (3 x 3 = 9 rows)
    ```

    **When to use:** INNER for strict matches. LEFT when you need all records from the driving table regardless of match. FULL OUTER for reconciliation queries. CROSS for generating combinations (e.g., all dates x all products for gap-filling).

    **Gotchas:** A LEFT JOIN becomes an INNER JOIN if you put a WHERE filter on the right table's non-null columns. CROSS JOIN on two large tables explodes row count -- always add a sensible ON clause. MySQL does not support FULL OUTER JOIN natively (use UNION of LEFT + RIGHT).

??? question "Q5: What is a Self Join? Give a practical example."

    **Answer:** A self join is a table joined to itself using aliases -- it models relationships where both sides of the relationship live in the same table.

    **Why:** Hierarchical and graph-like data (org charts, friend networks, parts assemblies) naturally reference rows within the same table. A self join lets you traverse one level of that relationship.

    **How:** You alias the table twice and join on the parent-child relationship column.

    ```sql
    SELECT e.name AS employee, m.name AS manager
    FROM employees e
    LEFT JOIN employees m ON e.manager_id = m.emp_id;
    -- Developer -> Dev Lead, Dev Lead -> VP, VP -> CEO, CEO -> NULL
    ```

    **When to use:** Manager-employee hierarchies, bill-of-materials (part contains sub-parts), flight connections (same airports table), or finding duplicate records by joining on matching columns.

    **Gotchas:** Use LEFT JOIN (not INNER) or you lose root nodes (e.g., CEO has no manager). Self joins only traverse one level -- for arbitrary depth, use recursive CTEs. Performance degrades on large tables without proper indexes on the join column.

??? question "Q6: Subquery vs JOIN -- which performs better?"

    **Answer:** JOINs typically give the optimizer more room to choose efficient algorithms (hash join, merge join), while subqueries can force less optimal nested-loop execution -- but modern optimizers often rewrite one into the other anyway.

    **Why:** The optimizer sees JOINs as a set operation and can reorder tables, pick join strategies, and push predicates. Subqueries, especially correlated ones, may limit these optimizations.

    **How:**

    ```sql
    -- Subquery (can be slower)
    SELECT name FROM employees
    WHERE dept_id IN (SELECT dept_id FROM departments WHERE dept_name = 'Engineering');

    -- JOIN (usually preferred)
    SELECT e.name FROM employees e
    JOIN departments d ON e.dept_id = d.dept_id WHERE d.dept_name = 'Engineering';
    ```

    **When to use:** Prefer JOINs for readability and optimizer flexibility. Use subqueries when the logic is genuinely a filter (EXISTS for semi-joins) or when you need to isolate aggregation before joining.

    **Gotchas:** PostgreSQL and modern MySQL flatten IN-subqueries into semi-joins automatically -- so the performance difference may be zero. Always check `EXPLAIN` to compare actual plans. A subquery in SELECT clause executes per row (correlated) and can be a hidden performance killer.

??? question "Q7: Correlated vs non-correlated subquery?"

    **Answer:** A non-correlated subquery is self-contained (runs once), while a correlated subquery references the outer row and conceptually re-executes for every row in the outer query.

    **Why:** Understanding this distinction is critical for performance reasoning. A correlated subquery on 1M outer rows means 1M inner executions unless the optimizer rewrites it.

    **How:**

    ```sql
    -- Non-correlated: runs once
    SELECT name FROM employees
    WHERE dept_id IN (SELECT dept_id FROM departments WHERE budget > 100000);

    -- Correlated: runs per row (can be expensive)
    SELECT e.name FROM employees e
    WHERE e.salary > (
        SELECT AVG(e2.salary) FROM employees e2
        WHERE e2.dept_id = e.dept_id  -- references outer query
    );
    ```

    **When to use:** Non-correlated for simple filtering. Correlated when you need row-by-row comparison against an aggregate of related rows (e.g., "employees earning above their department average"). Often rewritable as a window function or JOIN for better performance.

    **Gotchas:** The optimizer may decorrelate the subquery into a join -- check EXPLAIN. If it doesn't, performance is O(N*M). EXISTS with a correlated subquery is fine because it short-circuits. Correlated subqueries in SELECT clause are particularly dangerous -- they hide N+1 behavior inside SQL.

---

## Aggregation & Set Operations

??? question "Q8: Explain GROUP BY and HAVING clause."

    **Answer:** GROUP BY collapses rows sharing the same values into summary rows; HAVING is the WHERE clause for groups -- it filters after aggregation.

    **Why:** You cannot filter on aggregate results with WHERE (it runs before grouping). HAVING exists specifically to apply conditions to grouped/aggregated output.

    **How:** The execution order is: FROM -> WHERE -> GROUP BY -> aggregate functions -> HAVING -> SELECT -> ORDER BY. GROUP BY creates buckets; HAVING discards buckets that don't meet criteria.

    ```sql
    SELECT dept_id, COUNT(*) AS cnt, AVG(salary) AS avg_sal
    FROM employees
    GROUP BY dept_id
    HAVING COUNT(*) >= 5
    ORDER BY avg_sal DESC;
    ```

    **When to use:** Any time you need aggregated metrics per group -- department headcount, daily revenue, error rates per service. Use HAVING when you want to filter out groups (e.g., only departments with 5+ people).

    **Gotchas:** Every non-aggregated column in SELECT must appear in GROUP BY (strict SQL mode). Putting filterable conditions in HAVING instead of WHERE is a performance anti-pattern -- WHERE reduces rows before grouping, HAVING filters after. MySQL's non-standard behavior of allowing non-grouped columns in SELECT causes silent wrong results.

??? question "Q9: WHERE vs HAVING?"

    **Answer:** WHERE filters individual rows before grouping; HAVING filters aggregated groups after grouping -- they operate at completely different stages of query execution.

    **Why:** SQL's logical execution order makes this necessary. You physically cannot reference COUNT(*) or AVG() in WHERE because those values don't exist until after GROUP BY runs.

    **How:**

    | Feature | WHERE | HAVING |
    |---------|-------|--------|
    | Filters | Individual rows | Grouped results |
    | Timing | Before aggregation | After aggregation |
    | Aggregates | Cannot use | Can use |

    ```sql
    SELECT dept_id, AVG(salary) AS avg_sal FROM employees
    WHERE hire_date > '2020-01-01'   -- row filter (before grouping)
    GROUP BY dept_id
    HAVING AVG(salary) > 75000;      -- group filter (after aggregation)
    ```

    **When to use:** Use WHERE for row-level predicates (date ranges, status filters) to reduce data early. Use HAVING only when the condition involves an aggregate function.

    **Gotchas:** Putting `WHERE dept_id = 10` in HAVING works but is slower -- it processes all groups then discards, rather than filtering rows upfront. You cannot reference column aliases in HAVING in some RDBMS (use the full expression). HAVING without GROUP BY treats the entire result set as one group.

??? question "Q10: UNION vs UNION ALL?"

    **Answer:** UNION concatenates result sets and deduplicates (costly sort/hash); UNION ALL concatenates without deduplication and is almost always what you actually want.

    **Why:** Deduplication requires the engine to sort or hash the entire combined result set -- an O(n log n) operation. If your data is naturally distinct (different source tables, different ID ranges), UNION ALL avoids wasted work.

    **How:** Both require matching column count and compatible types. UNION adds a distinct step (sort or hash aggregate) on top of the concatenation.

    ```sql
    SELECT city FROM customers UNION     SELECT city FROM suppliers; -- deduped
    SELECT city FROM customers UNION ALL SELECT city FROM suppliers; -- faster
    ```

    **When to use:** UNION ALL for combining partitioned data, audit logs from multiple tables, or CTEs where duplicates are impossible by design. UNION only when you explicitly need deduplication and cannot guarantee uniqueness.

    **Gotchas:** UNION's dedup compares entire rows, not just one column -- two rows with the same city but different other columns survive. Using UNION by default is a common performance anti-pattern in ETL pipelines. Column names come from the first SELECT -- aliases on subsequent SELECTs are ignored.

??? question "Q11: EXISTS vs IN -- performance differences?"

    **Answer:** EXISTS short-circuits on the first match (ideal for large subqueries); IN materializes the full list first (better for small, known sets). The critical difference shows up with NULLs.

    **Why:** EXISTS is a semi-join -- it only checks existence, never returns data from the subquery. IN builds a complete result set for comparison. Modern optimizers often treat them identically, but NULL semantics differ dramatically.

    **How:**

    ```sql
    -- EXISTS: stops early
    SELECT e.name FROM employees e
    WHERE EXISTS (SELECT 1 FROM orders o WHERE o.emp_id = e.emp_id);

    -- IN: better for small result sets
    SELECT e.name FROM employees e
    WHERE e.dept_id IN (SELECT dept_id FROM departments WHERE region = 'US');
    ```

    **When to use:** EXISTS when the subquery is large or has good indexes on the correlation column. IN for small static lists or when readability matters. Always prefer EXISTS for NOT-existence checks.

    **Gotchas:** `NOT IN` is a landmine -- if the subquery returns even one NULL, the entire result is empty (because `x NOT IN (..., NULL)` is UNKNOWN for every x). `NOT EXISTS` handles NULLs safely and is almost always the correct choice. PostgreSQL's optimizer usually converts IN to a semi-join anyway, making them equivalent in plans.

---

## Data Modification & Views

??? question "Q12: DELETE vs TRUNCATE vs DROP?"

    **Answer:** DELETE removes specific rows transactionally, TRUNCATE deallocates all data pages instantly, and DROP eliminates the entire table object from the catalog.

    **Why:** They exist for different use cases along the spectrum of "remove some data" to "remove the entire schema object." Choosing wrong impacts performance, recoverability, and cascade behavior.

    **How:**

    | Feature | DELETE | TRUNCATE | DROP |
    |---------|--------|----------|------|
    | Type | DML | DDL | DDL |
    | WHERE clause | Yes | No | No |
    | Rollback | Yes | RDBMS-dependent | No |
    | Triggers fired | Yes | No | No |
    | Resets identity | No | Yes | N/A |

    ```sql
    DELETE FROM employees WHERE dept_id = 10;  -- row-by-row, logged
    TRUNCATE TABLE temp_logs;                  -- fast, minimal logging
    DROP TABLE IF EXISTS temp_logs;            -- removes entire object
    ```

    **When to use:** DELETE for selective removal with audit trail. TRUNCATE for fast table resets (staging tables, temp data). DROP when the table is no longer needed in the schema.

    **Gotchas:** TRUNCATE cannot be rolled back in MySQL (implicit commit) but CAN in PostgreSQL (it's transactional there). TRUNCATE on a table referenced by FKs fails unless you CASCADE. DELETE of millions of rows generates massive WAL/redo logs and can fill your disk. TRUNCATE resets sequences in PostgreSQL only with `RESTART IDENTITY`.

??? question "Q13: Normal View vs Materialized View?"

    **Answer:** A view is a saved query that re-executes on every access (zero storage cost, always fresh). A materialized view physically stores the result set (fast reads, but stale until refreshed).

    **Why:** Views simplify complex queries and enforce security (expose only certain columns). Materialized views trade storage and freshness for read performance on expensive aggregations or joins.

    **How:** A regular view is inlined into the calling query by the optimizer. A materialized view writes results to disk and serves reads directly from that snapshot, bypassing the base tables entirely.

    ```sql
    CREATE VIEW active_emps AS
    SELECT emp_id, name FROM employees WHERE status = 'ACTIVE';

    -- Materialized View (PostgreSQL)
    CREATE MATERIALIZED VIEW dept_stats AS
    SELECT dept_id, AVG(salary) avg_sal, COUNT(*) cnt FROM employees GROUP BY dept_id;
    REFRESH MATERIALIZED VIEW CONCURRENTLY dept_stats;
    ```

    **When to use:** Regular views for abstraction, access control, and query reuse. Materialized views for dashboards, reporting queries, and expensive aggregations that tolerate staleness (refresh on schedule or trigger).

    **Gotchas:** Not all views are updatable -- complex views with JOINs, DISTINCT, or GROUP BY block INSERT/UPDATE through the view. `REFRESH MATERIALIZED VIEW` takes a full lock unless you use `CONCURRENTLY` (which requires a unique index). MySQL does not support materialized views natively -- you simulate with tables + scheduled refresh.

---

## Indexes

??? question "Q14: B-Tree, Hash, Composite, and Covering indexes?"

    **Answer:** These are index types that optimize different access patterns -- B-Tree for range/equality (the workhorse), Hash for pure equality, Composite for multi-column filters, and Covering to avoid heap lookups entirely.

    **Why:** The right index type can turn a 5-second full table scan into a 5ms seek. Wrong choice (or wrong column order in composite) means the index exists but the optimizer ignores it.

    **How:**

    - **B-Tree:** Balanced tree structure. O(log n) for equality and range. Supports ORDER BY, BETWEEN, LIKE 'prefix%'.
    - **Hash:** Hash table. O(1) equality only. Cannot sort or range scan.
    - **Composite:** B-Tree on multiple columns. Follows the **leftmost prefix rule** -- index on (A, B, C) supports queries filtering on A, (A,B), or (A,B,C) but NOT B alone.
    - **Covering:** Includes all columns the query needs in the index itself -- the engine never touches the heap/table.

    ```sql
    CREATE INDEX idx_name ON employees(name);                          -- B-Tree
    CREATE INDEX idx_email ON employees USING HASH (email);            -- Hash
    CREATE INDEX idx_dept_hire ON employees(dept_id, hire_date);       -- Composite
    CREATE INDEX idx_cover ON employees(dept_id, name) INCLUDE (salary); -- Covering
    ```

    **When to use:** B-Tree is your default choice 95% of the time. Hash only for exact-match lookups (rare in practice). Composite for queries with multi-column WHERE/ORDER BY. Covering for hot queries you want at maximum speed.

    **Gotchas:** Composite index column order matters enormously -- put equality columns first, range columns last. Hash indexes are not WAL-logged in older PostgreSQL (crash-unsafe). INCLUDE columns are stored in leaf nodes only -- they don't participate in the tree structure for seeking.

??? question "Q15: When should you NOT use indexes?"

    **Answer:** Indexes are not free -- each one adds write overhead, storage, and maintenance cost. Skip them when the cost outweighs the read benefit.

    **Why:** Every INSERT/UPDATE/DELETE must also update all affected indexes. On a high-write table with 10 indexes, you're doing 10x the write amplification. The optimizer also ignores indexes when it estimates they won't help (low selectivity).

    **How:** The optimizer uses statistics to decide: if an index would return >15-20% of the table, a sequential scan is cheaper (fewer random I/Os). Columns wrapped in functions are invisible to the index because the B-Tree stores raw values.

    ```sql
    SELECT * FROM employees WHERE salary * 1.1 > 100000; -- cannot use index
    SELECT * FROM employees WHERE salary > 100000 / 1.1;  -- index-friendly
    ```

    **When to avoid:** Small tables (<1000 rows), high-write/low-read tables (event streams, logs), low-cardinality columns (boolean, gender), columns always used inside functions, and wide columns rarely queried (TEXT/BLOB).

    **Gotchas:** A "useless" index still consumes disk, bloats backups, and slows down VACUUM/autovacuum. Expression indexes (e.g., `CREATE INDEX ON t(LOWER(email))`) solve the function problem but are RDBMS-specific. Unused indexes should be periodically identified and dropped using `pg_stat_user_indexes` or equivalent.

??? question "Q16: Clustered vs Non-Clustered index?"

    **Answer:** A clustered index IS the table -- rows are physically stored in index order. A non-clustered index is a separate structure that points back to the heap or clustered index.

    **Why:** This distinction determines I/O patterns. A range scan on the clustered index reads sequential pages (fast). The same scan on a non-clustered index does random I/O for each row lookup (slow if many rows match).

    **How:**

    | Feature | Clustered | Non-Clustered |
    |---------|-----------|---------------|
    | Data order | Physically reorders table rows | Separate structure with pointers |
    | Per table | Only one | Multiple allowed |
    | Leaf nodes | Contain actual data | Contain pointers to data |
    | Best for | Range scans | Lookups on secondary columns |

    **When to use:** Clustered on columns you frequently range-scan or sort by (often the PK). Non-clustered on columns used in WHERE/JOIN that aren't the PK. Consider covering non-clustered indexes to eliminate the bookmark lookup.

    **Gotchas:** In PostgreSQL, tables are heap-organized by default (no clustered index) -- the CLUSTER command is a one-time physical reorder, not maintained. In SQL Server/InnoDB, the PK is the clustered index by default. Choosing a wide or random clustered key (like UUID) causes page splits and fragmentation on inserts. Non-clustered index pointers grow wider if the clustered key is wide.

??? question "Q17: Index Scan vs Index Seek?"

    **Answer:** An Index Seek navigates the B-Tree directly to matching entries (O(log n), surgical). An Index Scan reads the entire index sequentially (used when the optimizer decides too many rows match to bother seeking).

    **Why:** Seeing "Index Scan" in your EXPLAIN plan does not mean your index is working well -- it might be reading the full index because selectivity is too low. You want Index Seek (or "Index Only Scan" in PostgreSQL) for point lookups and narrow ranges.

    **How:** The optimizer estimates selectivity. If <5-15% of rows match, it seeks. If more match, a sequential scan (table or index) is cheaper due to sequential I/O vs random I/O.

    ```sql
    SELECT * FROM employees WHERE emp_id = 42;       -- Index Seek
    SELECT * FROM employees WHERE salary > 10000;     -- Index Scan (broad filter)
    SELECT * FROM employees WHERE UPPER(name)='ALICE'; -- Full Table Scan
    ```

    **When to use:** Design queries and indexes to enable seeks -- highly selective predicates on leading index columns. If you see Index Scan on a query that should be selective, check if stale statistics are fooling the optimizer.

    **Gotchas:** An "Index Scan" followed by a "Table Lookup" (bookmark lookup) for non-covered columns can be worse than a full table scan -- the optimizer may choose seq scan instead. In PostgreSQL terminology, "Index Scan" actually includes the seek to the start point; the equivalent of SQL Server's "Index Scan" is "Bitmap Index Scan" or a seq scan on the index.

??? question "Q18: How do you read an EXPLAIN/ANALYZE plan?"

    **Answer:** EXPLAIN shows the optimizer's planned execution strategy; EXPLAIN ANALYZE actually runs the query and shows real timings, row counts, and I/O -- it is your single most important tool for query tuning.

    **Why:** Without reading plans, you're guessing. A slow query might be slow because of a missing index, stale statistics causing wrong join order, or an unexpected nested loop on a large table.

    **How:** Read bottom-up (innermost nodes execute first). Compare estimated rows vs actual rows at each node.

    Key things to look for:

    - **Seq Scan** -- full table scan (may need index)
    - **Index Scan / Index Only Scan** -- using index efficiently
    - **Nested Loop / Hash Join / Merge Join** -- join strategies
    - **Rows** -- estimated vs actual (mismatch = stale stats, run `ANALYZE`)
    - **Cost** -- startup cost vs total cost
    - **Buffers** -- shared hit (cache) vs read (disk)

    **When to use:** Before and after every optimization. Use `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` in PostgreSQL for the most detailed output. Compare plans between environments (dev vs prod may differ due to statistics).

    **Gotchas:** EXPLAIN ANALYZE actually executes the query -- do NOT run it on a destructive statement without wrapping in a transaction and rolling back. Estimated row count off by 10x+ is usually stale stats or a correlation the optimizer cannot model. "Actual loops" multiplied by "actual rows" gives true row count for nested loops.

---

## Normalization & Denormalization

??? question "Q19: Explain 1NF, 2NF, 3NF, BCNF with examples."

    **Answer:** Normal forms are progressive levels of eliminating redundancy -- each level removes a specific type of problematic dependency that causes update anomalies.

    **Why:** Unnormalized data leads to insert/update/delete anomalies. Change a department name? You must update every employee row that stores it. Miss one? Inconsistent data.

    **How:**

    - **1NF:** Atomic values only, no repeating groups (no arrays, no comma-separated lists in a cell).
    - **2NF:** 1NF + no partial dependency on a composite key (every non-key column depends on the *whole* PK).
    - **3NF:** 2NF + no transitive dependency (non-key must not depend on another non-key).
    - **BCNF:** For every functional dependency X->Y, X must be a superkey. Stricter than 3NF for edge cases with overlapping candidate keys.

    ```sql
    -- Violates 2NF: student_name depends only on student_id, not full PK
    -- PK = (student_id, course_id) | student_name | grade
    -- Fix: students(student_id, student_name) + enrollments(student_id, course_id, grade)

    -- Violates 3NF: dept_name depends on dept_id, not on emp_id
    -- emp_id | dept_id | dept_name
    -- Fix: employees(emp_id, dept_id) + departments(dept_id, dept_name)
    ```

    **When to use:** Normalize to 3NF/BCNF for OLTP systems. Data warehouses deliberately denormalize (star/snowflake schemas) for query performance.

    **Gotchas:** Over-normalizing creates excessive joins that kill read performance. 2NF violations only exist when you have a composite PK -- single-column PKs skip straight to 3NF concerns. BCNF can lose dependency preservation in rare cases, requiring you to pick between BCNF and maintaining a functional dependency via constraints.

??? question "Q20: When and why would you denormalize?"

    **Answer:** Denormalization intentionally introduces redundancy to eliminate expensive joins and aggregations at read time -- it trades write complexity for read speed.

    **Why:** In read-heavy systems (100:1 read-to-write ratio), paying the cost of maintaining redundant data on writes is worth it when it eliminates multi-table joins on every read. This is the fundamental insight behind CQRS and data warehousing.

    **How:** Common techniques: pre-computed totals, duplicated columns (store `dept_name` in employee table), materialized aggregates, and JSON denormalization for nested data.

    ```sql
    -- Normalized: requires JOIN
    SELECT o.order_id, SUM(oi.price * oi.quantity) FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id GROUP BY o.order_id;

    -- Denormalized: total pre-stored
    SELECT order_id, total FROM orders;
    ```

    **When to use:** Reporting/analytics tables, caching layers, search indices, microservice boundaries (each service owns its denormalized view), and high-traffic read paths where latency matters.

    **Gotchas:** You now own the consistency problem -- every write path must update all copies, or you get stale data. Use triggers, CDC (Change Data Capture), or application-level events to keep copies in sync. Over-denormalization leads to "update everywhere" syndrome. Always start normalized and denormalize based on measured performance needs, not speculation.

---

## Transactions & Concurrency

??? question "Q21: What are the ACID properties?"

    **Answer:** ACID is the contract that makes relational databases reliable -- Atomicity (all-or-nothing), Consistency (valid state transitions), Isolation (concurrent txns don't collide), Durability (committed data survives crashes).

    **Why:** Without ACID, a bank transfer that crashes mid-way could debit one account without crediting another. These guarantees are what separate a real database from a file system.

    **How:**

    - **Atomicity:** Implemented via WAL (Write-Ahead Log). On failure, uncommitted changes are rolled back using the log.
    - **Consistency:** Enforced by constraints (PK, FK, CHECK, UNIQUE) checked at commit time.
    - **Isolation:** Implemented via MVCC (PostgreSQL) or locks (MySQL). Controls what uncommitted data other transactions can see.
    - **Durability:** WAL is fsynced to disk before commit returns. Even if the server crashes, recovery replays the log.

    ```sql
    BEGIN;
    UPDATE accounts SET balance = balance - 500 WHERE id = 1;
    UPDATE accounts SET balance = balance + 500 WHERE id = 2;
    COMMIT; -- both succeed or neither does
    ```

    **When to use:** ACID is non-negotiable for financial transactions, inventory management, and any operation where partial completion equals corruption. NoSQL databases often relax one or more ACID properties for throughput.

    **Gotchas:** "Consistency" in ACID is different from CAP's "Consistency" -- ACID means constraint validation, CAP means all nodes see the same data. Long-running transactions hold locks/MVCC snapshots and can cause bloat or deadlocks. Durability has a performance cost (fsync) -- some systems offer `synchronous_commit = off` for speed at the risk of losing the last few ms of commits on crash.

??? question "Q22: Explain the four transaction isolation levels."

    **Answer:** Isolation levels control how much of other transactions' uncommitted or recently committed work is visible -- higher isolation means fewer anomalies but more contention/overhead.

    **Why:** Full serialization is safe but slow (transactions queue up). Lower levels increase throughput by allowing controlled anomalies that your application can tolerate.

    **How:**

    | Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read |
    |-----------------|-----------|---------------------|--------------|
    | Read Uncommitted | Yes | Yes | Yes |
    | Read Committed | No | Yes | Yes |
    | Repeatable Read | No | No | Yes (varies) |
    | Serializable | No | No | No |

    PostgreSQL defaults to **Read Committed**. MySQL InnoDB defaults to **Repeatable Read**.

    **When to use:** Read Committed for most OLTP workloads (good balance). Repeatable Read when you need consistent reads within a transaction (reporting). Serializable for financial operations where absolute correctness matters. Read Uncommitted is almost never appropriate.

    **Gotchas:** MySQL's Repeatable Read actually prevents phantoms via gap locks -- so it behaves closer to Serializable than the SQL standard suggests. PostgreSQL's Serializable uses SSI (Serializable Snapshot Isolation) which can abort transactions on conflict rather than blocking them. Setting Serializable globally tanks throughput -- use it only on specific critical transactions.

??? question "Q23: Dirty Read, Non-Repeatable Read, Phantom Read?"

    **Answer:** These are the three read anomalies that isolation levels progressively eliminate -- each represents a different way concurrent transactions can produce surprising results.

    **Why:** Understanding these anomalies tells you what can go wrong at each isolation level and helps you choose the minimum level that keeps your application correct.

    **How:**

    - **Dirty Read:** Reading uncommitted data from another transaction (may be rolled back). You base decisions on data that never actually existed.
    - **Non-Repeatable Read:** Re-reading a row yields a different value because another transaction modified and committed it between your two reads.
    - **Phantom Read:** Re-running a range query returns different rows because another transaction inserted/deleted matching rows. Your result set changes shape.

    **When each matters:** Dirty reads are almost never acceptable (data integrity). Non-repeatable reads matter when you read-then-write based on what you read (lost updates). Phantoms matter for aggregate queries or range-based business rules (e.g., "total allocated budget < limit").

    **Gotchas:** Non-repeatable read and phantom read look similar but differ in scope -- non-repeatable is about a single row changing, phantom is about new/deleted rows appearing in a range. MVCC-based databases (PostgreSQL) prevent dirty reads at all levels with no locking cost. The "lost update" problem (two transactions read same value, both write) is not directly in this taxonomy but is prevented by Repeatable Read.

??? question "Q24: What is a deadlock? How do you prevent it?"

    **Answer:** A deadlock is a circular wait where two or more transactions each hold a resource the other needs, creating an unresolvable standoff that requires external intervention.

    **Why:** Deadlocks are inevitable in any system with concurrent lock-based access. You cannot eliminate them entirely -- you can only reduce their frequency and handle them gracefully.

    **How:** The database maintains a wait-for graph. When it detects a cycle, it picks a "victim" transaction (usually the cheapest to rollback), aborts it, and lets the other proceed.

    ```
    Tx A: locks Row 1, waits for Row 2
    Tx B: locks Row 2, waits for Row 1 --> Deadlock!
    ```

    **Prevention strategies:** Access resources in a consistent global order (e.g., always lock lower ID first). Keep transactions short. Acquire all locks upfront (pessimistic). Use `NOWAIT` or `lock_timeout` to fail fast.

    ```sql
    SET lock_timeout = '5s'; -- avoid indefinite waiting
    ```

    **When to worry:** High-concurrency OLTP with multi-row updates. Batch jobs running alongside OLTP. Any operation that locks multiple rows in unpredictable order.

    **Gotchas:** Deadlock detection itself has a cost -- InnoDB checks the wait-for graph on every lock wait. Frequent deadlocks signal a design problem, not just bad luck. Your application must be prepared to retry the aborted transaction. Index-level locks (gap locks in MySQL) can cause deadlocks even when the application never touches the same rows.

??? question "Q25: Optimistic vs Pessimistic locking?"

    **Answer:** Pessimistic locking grabs locks upfront assuming conflict is likely; optimistic locking assumes conflict is rare and detects it at write time via a version check.

    **Why:** The choice depends on contention probability. High contention (inventory checkout) favors pessimistic -- you avoid wasted work. Low contention (editing a user profile) favors optimistic -- you avoid holding locks during think time.

    **How:**

    ```sql
    -- Pessimistic
    BEGIN;
    SELECT * FROM products WHERE id = 1 FOR UPDATE; -- row locked
    UPDATE products SET stock = stock - 1 WHERE id = 1;
    COMMIT;

    -- Optimistic: version check
    UPDATE products SET stock = 9, version = 4
    WHERE id = 1 AND version = 3; -- fails if someone else changed it
    ```

    **When to use:** Pessimistic for short-lived transactions with high contention (flash sales, seat booking). Optimistic for long-lived operations (user editing a form, API updates) where holding a lock for minutes is impractical.

    **Gotchas:** Optimistic locking requires application code to handle the "version mismatch" failure -- retry or notify user. If affected_rows == 0, the update was lost. Pessimistic locks can cause deadlocks if multiple rows are locked in different orders. `SELECT FOR UPDATE SKIP LOCKED` is useful for job queues -- grab the next unlocked row without waiting. JPA's `@Version` annotation implements optimistic locking automatically.

---

## Window Functions

??? question "Q26: Explain ROW_NUMBER, RANK, DENSE_RANK, LEAD, and LAG."

    **Answer:** Window functions perform calculations across a set of rows related to the current row without collapsing them -- unlike GROUP BY, you keep all rows in the output.

    **Why:** They solve "top-N per group," running totals, year-over-year comparisons, and gap detection without self-joins or correlated subqueries -- cleaner and usually faster.

    **How:**

    ```sql
    SELECT name, dept_id, salary,
        ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS row_num,
        RANK()       OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rnk,
        DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS dense_rnk
    FROM employees;
    -- Salaries 90k, 80k, 80k, 70k:
    -- ROW_NUMBER: 1,2,3,4  |  RANK: 1,2,2,4  |  DENSE_RANK: 1,2,2,3

    SELECT emp_id, salary,
        LAG(salary, 1)  OVER (ORDER BY hire_date) AS prev_salary,
        LEAD(salary, 1) OVER (ORDER BY hire_date) AS next_salary
    FROM employees;
    ```

    **When to use:** ROW_NUMBER for pagination or deduplication (pick row_num=1). RANK/DENSE_RANK for leaderboards with ties. LAG/LEAD for time-series comparisons (month-over-month growth, detecting gaps).

    **Gotchas:** ROW_NUMBER is non-deterministic for ties unless ORDER BY is unique -- add a tiebreaker column. Window functions execute after WHERE/GROUP BY/HAVING, so you cannot filter on them directly -- wrap in a subquery. Large PARTITION BY without proper indexes causes expensive sorts. LEAD/LAG default to NULL at partition boundaries -- use the third argument for a default value.

---

## CTEs & Recursive Queries

??? question "Q27: CTE vs subquery?"

    **Answer:** A CTE (Common Table Expression) is a named, readable temporary result set defined with WITH -- it improves query organization and enables recursion, but performance is usually identical to an equivalent subquery.

    **Why:** CTEs exist primarily for readability and maintainability. Complex queries with nested subqueries become unreadable fast. A CTE lets you name each logical step, making the query self-documenting.

    **How:** The optimizer typically inlines the CTE into the main query (same plan as a subquery). Some databases materialize CTEs (older PostgreSQL <12 always materialized), which can be good or bad depending on context.

    ```sql
    WITH high_earners AS (
        SELECT emp_id, dept_id FROM employees WHERE salary > 100000
    )
    SELECT d.dept_name, COUNT(*) FROM high_earners h
    JOIN departments d ON h.dept_id = d.dept_id GROUP BY d.dept_name;
    ```

    **When to use:** Complex multi-step transformations, recursive queries (hierarchies, graphs), and when you reference the same derived table multiple times (avoids copy-pasting a subquery).

    **Gotchas:** In PostgreSQL <12, CTEs were always materialized (optimization fence) -- adding `AS NOT MATERIALIZED` fixed this in 12+. CTEs referenced multiple times may be computed multiple times unless the optimizer materializes them. A CTE cannot be indexed -- if you need indexed temp results, use a temp table. Recursive CTEs without a termination condition will run forever (set a depth limit).

??? question "Q28: Recursive CTE example?"

    **Answer:** A recursive CTE references itself to traverse hierarchical or graph data -- it has an anchor member (base case) and a recursive member that builds on previous results until no new rows are produced.

    **Why:** Without recursive CTEs, traversing a tree of unknown depth requires either multiple self-joins (one per level) or application-side iteration. Recursive CTEs solve this in a single SQL statement.

    **How:** The engine executes the anchor query first, then repeatedly executes the recursive member using the previous iteration's results as input, until the recursive member returns zero rows.

    ```sql
    WITH RECURSIVE org_tree AS (
        SELECT emp_id, name, manager_id, 1 AS level
        FROM employees WHERE emp_id = 1          -- anchor
        UNION ALL
        SELECT e.emp_id, e.name, e.manager_id, ot.level + 1
        FROM employees e
        JOIN org_tree ot ON e.manager_id = ot.emp_id  -- recursive
    )
    SELECT * FROM org_tree ORDER BY level;
    -- CEO(1) -> VP(2) -> Lead(3) -> Dev(4)
    ```

    **When to use:** Org charts, bill-of-materials, file system paths, shortest path in graphs, generating date series, and any adjacency-list traversal.

    **Gotchas:** Circular references cause infinite loops -- always add a depth limit (`WHERE level < 50`) or use `CYCLE` detection (PostgreSQL 14+). Performance degrades on wide trees -- each level is a join against the base table. MySQL requires `RECURSIVE` keyword; PostgreSQL optional but recommended. SQL Server uses `WITH` without RECURSIVE keyword but limits recursion to 100 by default (`OPTION(MAXRECURSION n)`).

---

## SQL Functions & Expressions

??? question "Q29: COALESCE and NULLIF?"

    **Answer:** COALESCE returns the first non-NULL value from a list (NULL-safe fallback chain); NULLIF returns NULL when two values are equal (NULL-producing guard). Together they are your primary NULL-handling toolkit.

    **Why:** NULLs propagate through expressions -- any arithmetic with NULL yields NULL, any comparison with NULL yields UNKNOWN. These functions let you control NULL behavior explicitly rather than getting bitten by three-valued logic.

    **How:** COALESCE evaluates left-to-right, short-circuits at the first non-NULL. NULLIF(a, b) is syntactic sugar for `CASE WHEN a = b THEN NULL ELSE a END`.

    ```sql
    SELECT COALESCE(nickname, first_name, 'Unknown') AS display_name FROM users;
    SELECT total_revenue / NULLIF(total_orders, 0) AS avg_val FROM sales;
    -- NULLIF prevents division-by-zero by returning NULL when orders = 0
    ```

    **When to use:** COALESCE for default values in display, merging nullable columns, and providing fallbacks in ORDER BY. NULLIF for safe division, treating sentinel values (empty string, 0) as NULL for aggregation.

    **Gotchas:** COALESCE evaluates all arguments for type resolution even if it short-circuits on value -- put expensive subqueries last. In PostgreSQL, COALESCE determines return type from the first non-null-typed argument; mixing types can cause implicit casts. `NVL` (Oracle) and `ISNULL` (SQL Server) are vendor-specific equivalents of COALESCE but only take two arguments.

??? question "Q30: How does the CASE expression work?"

    **Answer:** CASE is SQL's inline conditional expression -- it evaluates conditions top-to-bottom and returns the value for the first matching branch, like a functional if-else that can be used anywhere an expression is valid.

    **Why:** SQL is declarative and lacks procedural if/else. CASE lets you embed business logic (bucketing, pivoting, conditional aggregation) directly in queries without post-processing in application code.

    **How:** Two forms -- "searched CASE" (WHEN condition THEN ...) and "simple CASE" (CASE expr WHEN value THEN ...). Evaluates top-down, short-circuits at first match, returns NULL if no ELSE and nothing matches.

    ```sql
    SELECT name, salary,
        CASE WHEN salary >= 120000 THEN 'Senior'
             WHEN salary >= 80000  THEN 'Mid'
             ELSE 'Junior' END AS level
    FROM employees;

    -- Pivot with CASE
    SELECT dept_id,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active,
        COUNT(CASE WHEN status = 'INACTIVE' THEN 1 END) AS inactive
    FROM employees GROUP BY dept_id;
    ```

    **When to use:** Conditional aggregation (pivot without PIVOT syntax), bucketing/binning values, custom sort orders (`ORDER BY CASE WHEN ...`), and conditional joins or filters.

    **Gotchas:** Missing ELSE returns NULL silently -- always include ELSE for clarity. CASE in WHERE clause can prevent index usage (not sargable). Nested CASE expressions become unreadable fast -- consider a lookup table join instead. Each WHEN is evaluated independently -- overlapping conditions mean only the first match fires (order matters).

---

## Stored Procedures, Functions, Triggers, & Cursors

??? question "Q31: Stored Procedures vs Functions?"

    **Answer:** A stored procedure encapsulates a transaction workflow (can modify data, manage transactions, return multiple result sets). A function computes and returns a value, usable inline within SQL expressions.

    **Why:** Procedures exist for multi-step business operations (transfer money, process order). Functions exist for reusable computations you can call inside SELECT, WHERE, or JOIN -- they compose with SQL naturally.

    **How:**

    | Feature | Procedure | Function |
    |---------|-----------|----------|
    | Return | Optional, multiple result sets | Must return a value/table |
    | Usable in SELECT | No | Yes |
    | Side effects | Can modify data | Ideally none |
    | Transactions | Can manage | Cannot (usually) |

    ```sql
    -- Procedure
    CREATE PROCEDURE transfer(s INT, r INT, amt DECIMAL) LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE accounts SET balance = balance - amt WHERE id = s;
      UPDATE accounts SET balance = balance + amt WHERE id = r;
    END; $$;
    CALL transfer(1, 2, 500.00);

    -- Function
    CREATE FUNCTION full_name(eid INT) RETURNS VARCHAR LANGUAGE plpgsql AS $$
    BEGIN RETURN (SELECT first_name||' '||last_name FROM employees WHERE id=eid);
    END; $$;
    SELECT full_name(1);
    ```

    **When to use:** Procedures for batch operations, migrations, and complex business transactions. Functions for computed columns, reusable filters, and table-valued transformations.

    **Gotchas:** A function called in WHERE clause executes per row -- a scalar function on 1M rows means 1M function calls (use inline expressions or table-valued functions instead). PostgreSQL blurs the line -- functions CAN modify data and manage transactions. SQL Server functions are truly side-effect-free. Debugging stored procedures is painful -- no stack traces, limited tooling. Modern architectures often move this logic to application code for testability.

??? question "Q32: What are Triggers? Types and use cases?"

    **Answer:** Triggers are database-level event hooks that auto-execute code when a DML event (INSERT, UPDATE, DELETE) fires on a table -- they enforce rules that constraints alone cannot express.

    **Why:** Some business rules span multiple tables or require procedural logic (audit logging, derived column maintenance, cross-table validation). Triggers enforce these at the database layer regardless of which application writes the data.

    **How:** Types: **BEFORE** (can modify NEW values or abort), **AFTER** (for side effects like audit logs), **INSTEAD OF** (intercept operations on views). Granularity: **row-level** (fires per row) vs **statement-level** (fires once per statement).

    ```sql
    CREATE OR REPLACE FUNCTION log_salary_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.salary <> NEW.salary THEN
        INSERT INTO salary_audit VALUES (NEW.emp_id, OLD.salary, NEW.salary, NOW());
      END IF;
      RETURN NEW;
    END; $$;

    CREATE TRIGGER trg_salary AFTER UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION log_salary_change();
    ```

    **When to use:** Audit trails, maintaining denormalized columns (updated_at timestamps), enforcing complex cross-table constraints, and CDC (change data capture) when you cannot modify application code.

    **Gotchas:** Triggers are invisible to application developers -- "hidden logic" that makes debugging nightmares. They execute inside the same transaction (failure in trigger = failed DML). Cascading triggers (trigger A fires trigger B) can cause infinite loops. Row-level triggers on bulk operations kill performance (1M row update = 1M trigger executions). Prefer application-level events or database-level CDC (logical replication) for modern architectures.

??? question "Q33: What is a Cursor and why avoid it?"

    **Answer:** A cursor is a server-side pointer that lets you process query results row-by-row -- it is the procedural antithesis of SQL's set-based philosophy and is almost always the wrong approach.

    **Why avoid:** SQL engines are optimized for set operations (bulk I/O, vectorized execution, parallelism). A cursor forces row-at-a-time processing, bypasses the optimizer, holds resources for the entire iteration, and is typically 10-100x slower than the equivalent set-based statement.

    **How:** DECLARE opens a query, FETCH retrieves one row at a time, CLOSE releases resources. Each FETCH is a round-trip between the procedural engine and the SQL engine.

    ```sql
    -- Cursor (slow, avoid)
    DO $$ DECLARE emp RECORD;
      cur CURSOR FOR SELECT emp_id, salary FROM employees WHERE dept_id=10;
    BEGIN OPEN cur; LOOP FETCH cur INTO emp; EXIT WHEN NOT FOUND;
      UPDATE employees SET bonus=emp.salary*0.1 WHERE emp_id=emp.emp_id;
    END LOOP; CLOSE cur; END; $$;

    -- Set-based (fast, preferred)
    UPDATE employees SET bonus = salary * 0.1 WHERE dept_id = 10;
    ```

    **When to use (rare):** Sending result sets to clients in batches (application cursors), operations that truly cannot be expressed as set operations (row-dependent external API calls), or administrative scripts that must process one row at a time to avoid lock escalation.

    **Gotchas:** Cursors hold locks for the entire iteration duration. They prevent parallelism. In PostgreSQL, `DECLARE CURSOR` inside a transaction holds the snapshot open (bloating MVCC). If you think you need a cursor, first try window functions, CTEs, or batch UPDATE with LIMIT/OFFSET.

---

## Query Optimization

??? question "Q34: Top query optimization techniques?"

    **Answer:** Query optimization is about helping the optimizer choose the right plan -- reduce I/O, enable index usage, and minimize the working set at each stage.

    **Why:** A poorly written query on a well-indexed table can still do a full table scan. The optimizer is smart but not omniscient -- it relies on statistics, sargable predicates, and sensible query structure.

    **How:** The optimization hierarchy (biggest impact first):

    1. Index columns used in `WHERE`, `JOIN`, `ORDER BY`
    2. Avoid `SELECT *` -- fetch only needed columns
    3. Use `EXISTS` over `IN` for large subqueries
    4. Avoid functions on indexed columns (not sargable)
    5. Use `EXPLAIN ANALYZE` to read execution plans
    6. Keep statistics updated (`ANALYZE`)
    7. Use covering indexes to avoid table lookups
    8. Batch large operations
    9. Rewrite correlated subqueries as JOINs
    10. Use proper pagination

    ```sql
    -- Bad: function on indexed column
    SELECT * FROM orders WHERE YEAR(created_at) = 2024;
    -- Good: sargable
    SELECT * FROM orders WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01';
    ```

    **When to apply:** Always profile before optimizing. Use EXPLAIN ANALYZE to identify the actual bottleneck -- don't guess. Optimize the queries that matter (high frequency or high latency), not every query.

    **Gotchas:** Adding indexes speeds reads but slows writes -- balance is key. Stale statistics are the #1 cause of bad plans in production. OR conditions often prevent index usage (rewrite as UNION ALL). Implicit type casts in WHERE (comparing varchar to int) silently prevent index seeks. The best optimization is often eliminating the query entirely (caching, denormalization).

??? question "Q35: What is the N+1 query problem?"

    **Answer:** The N+1 problem is when code issues 1 query to fetch parent entities, then N additional queries to lazily load each parent's children -- turning O(1) database calls into O(N), killing performance at scale.

    **Why:** ORMs with lazy loading (JPA/Hibernate, ActiveRecord, Django) make this trivially easy to introduce. It looks fine with 10 departments but collapses at 10,000 -- each round-trip adds network latency and connection pool pressure.

    **How:**

    ```sql
    SELECT * FROM departments;                                  -- 1 query
    SELECT * FROM employees WHERE dept_id = 1;                  -- N queries
    SELECT * FROM employees WHERE dept_id = 2; ...

    -- Fix: JOIN or batch IN
    SELECT d.dept_name, e.name FROM departments d
    LEFT JOIN employees e ON d.dept_id = e.dept_id;
    ```

    **When to detect:** Watch for linear growth in query count as data grows. Enable query logging or use tools like p6spy, Hibernate statistics, or Django Debug Toolbar.

    **Gotchas:** In JPA/Hibernate, fix with `JOIN FETCH`, `@EntityGraph`, or `hibernate.default_batch_fetch_size`. A JOIN FETCH on multiple collections causes a cartesian product (use `@BatchSize` for multiple bags). GraphQL APIs are particularly prone to N+1 -- use DataLoader pattern. The fix in raw SQL is always a JOIN or `WHERE id IN (...)` batch.

??? question "Q36: OFFSET/LIMIT vs keyset pagination?"

    **Answer:** OFFSET/LIMIT pagination scans and discards rows to reach your page (O(offset) cost); keyset pagination seeks directly via an indexed cursor value (O(log n) regardless of depth).

    **Why:** OFFSET 1,000,000 means the database reads and throws away 1M rows before returning your 20. At scale, this is the difference between sub-ms response and multi-second timeouts. Every infinite-scroll feed you use (Twitter, Reddit) uses keyset pagination.

    **How:**

    | Feature | OFFSET/LIMIT | Keyset |
    |---------|-------------|--------|
    | Deep pages | Slow (scans offset rows) | Fast (seeks via index) |
    | Jump to page N | Yes | No (sequential only) |
    | Consistency | Duplicates/misses on writes | Stable |

    ```sql
    -- OFFSET (slow at depth)
    SELECT * FROM products ORDER BY id LIMIT 20 OFFSET 10000;

    -- Keyset (fast at any depth)
    SELECT * FROM products WHERE id > 10000 ORDER BY id LIMIT 20;
    ```

    **When to use:** OFFSET for admin UIs with page numbers and small datasets. Keyset for APIs, infinite scroll, large datasets, and any user-facing pagination where deep pages exist.

    **Gotchas:** Keyset requires a unique, indexed sort column -- if sorting by non-unique columns (e.g., created_at), add a tiebreaker (created_at, id). OFFSET pagination with concurrent inserts/deletes causes skipped or duplicate rows. For multi-column sort, keyset WHERE clause becomes a tuple comparison: `WHERE (created_at, id) > (?, ?)`. Some ORMs (Spring Data) support keyset via "scroll" APIs.

---

## Database Architecture

??? question "Q37: What is database sharding?"

    **Answer:** Sharding horizontally partitions data across multiple independent database instances by a shard key -- each shard holds a subset of rows, enabling near-linear horizontal scaling.

    **Why:** A single database server has finite CPU, memory, and I/O. When vertical scaling (bigger hardware) and read replicas are maxed out, sharding is the only path to handle billions of rows or tens of thousands of writes/sec.

    **How:** Strategies: **range-based** (customer_id 1-1M on shard 1, risk of hotspots), **hash-based** (`hash(key) % N`, even distribution), **directory-based** (lookup table for flexible placement). A routing layer directs queries to the correct shard.

    **When to use:** Only when vertical scaling and read replicas are insufficient. Signs you need it: single-table size exceeds RAM, write throughput hits disk limits, or replication lag is unacceptable.

    **Gotchas:** Cross-shard joins are expensive or impossible -- denormalize data per shard. Distributed transactions (2PC) add latency and failure modes. Rebalancing (adding/removing shards) requires data migration. Choosing a bad shard key (e.g., timestamp) creates hot shards. Auto-increment IDs need a global sequence or UUID. Once sharded, going back is nearly impossible -- exhaust all other options first.

??? question "Q38: Master-slave vs master-master replication?"

    **Answer:** Master-slave (primary-replica) routes all writes to one node and replicates to read-only replicas. Master-master allows writes on multiple nodes with bidirectional sync -- simpler scaling vs conflict complexity.

    **Why:** Single-master hits a write ceiling, but is simple (no conflicts). Multi-master increases write availability and geographic distribution, but introduces conflict resolution (last-write-wins, vector clocks, CRDTs).

    **How:**

    - **Master-Slave:** Async or sync replication of WAL/binlog to replicas. Reads scale horizontally. Writes are single-node bottleneck.
    - **Master-Master:** Both nodes apply each other's changes. Conflicts arise when the same row is modified on both simultaneously.

    ```
    Master-Slave: [App] --writes--> [Master] --replication--> [Replica] <--reads-- [App]
    Master-Master: [App] <--> [Master A] <--sync--> [Master B] <--> [App]
    ```

    **When to use:** Master-slave for most applications (read-heavy, simple). Master-master for multi-region write availability or HA where failover must be instant (active-active).

    **Gotchas:** Replication lag in master-slave means reads after writes may return stale data -- use "read-your-writes" consistency (route reads to master for the writer's session). Master-master with auto-increment IDs causes collisions -- use odd/even or UUIDs. Conflict resolution is hard -- "last write wins" loses data silently. Most teams are better served by single-master with fast automated failover (patroni, RDS Multi-AZ) than true multi-master.

??? question "Q39: CAP theorem and databases?"

    **Answer:** CAP states that during a network partition, a distributed system must choose between Consistency (all nodes see the same data) and Availability (every request gets a response) -- you cannot have both simultaneously.

    **Why:** Network partitions are not theoretical -- they happen in production (cloud AZ failures, network misconfigurations). CAP forces you to make a conscious design decision about what your system does when the network splits.

    **How:** Since partitions are unavoidable in distributed systems, the real choice is CP vs AP:

    | Type | Examples | During partition |
    |------|---------|-----------------|
    | CP | PostgreSQL, MongoDB, HBase | Rejects requests to stay consistent |
    | AP | Cassandra, DynamoDB, CouchDB | Serves possibly stale data |

    **When to use:** CP for financial data, inventory counts, and anything where stale reads cause business damage. AP for social feeds, analytics, and use cases where eventual consistency is acceptable.

    **Gotchas:** CAP is often misunderstood -- it only applies *during* a partition. When the network is healthy, you can have all three. Most systems are not purely CP or AP -- they make different tradeoffs per operation (e.g., DynamoDB offers both eventual and strong reads). PACELC theorem extends CAP: even without partitions, there's a Latency vs Consistency tradeoff. Single-node PostgreSQL is not "CP" -- CAP only applies to distributed systems.

---

## Security

??? question "Q40: What is SQL injection and how do you prevent it?"

    **Answer:** SQL injection occurs when untrusted input is concatenated directly into a SQL string, allowing attackers to modify the query's logic -- it remains the #1 web vulnerability (OWASP Top 10) decades after the fix was well-known.

    **Why:** A single injectable endpoint can expose your entire database -- dump all tables, bypass authentication, modify data, or even execute OS commands via `xp_cmdshell` (SQL Server).

    **How:** The attacker crafts input that closes the existing string literal and injects new SQL syntax:

    ```sql
    -- Vulnerable
    query = "SELECT * FROM users WHERE name='" + input + "'"
    -- input = "' OR '1'='1' --" returns ALL users

    -- Fix: parameterized queries (primary defense)
    PreparedStatement stmt = conn.prepareStatement(
        "SELECT * FROM users WHERE name = ?");
    stmt.setString(1, userInput);
    ```

    **When to apply:** Every single database interaction that includes external input. No exceptions. Parameterized queries (prepared statements) separate SQL structure from data -- the DB can never confuse user input for SQL syntax.

    **Gotchas:** ORM frameworks help but are not bulletproof -- raw queries in JPA (`@Query`), Django's `extra()`, or ActiveRecord's `where("...")` are still injectable. Dynamic table/column names cannot be parameterized -- use whitelist validation. Stored procedures are NOT inherently safe if they concatenate strings internally. Second-order injection stores malicious input that is later used in another query. Defense in depth: parameterized queries + least-privilege DB accounts + WAF + input validation.
