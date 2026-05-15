# Top 40 SQL Interview Questions & Answers

---

## SQL Basics & Categories

??? question "Q1: What is the difference between DDL, DML, DCL, and TCL?"

    **Answer:**

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

??? question "Q2: What is the difference between a Primary Key and a Unique Key?"

    **Answer:**

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

??? question "Q3: What is a Foreign Key and how does it enforce referential integrity?"

    **Answer:** A foreign key references the primary key of another table. It enforces **referential integrity** -- a value in the child table must exist in the parent table.

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

---

## Joins

??? question "Q4: Explain INNER, LEFT, RIGHT, FULL OUTER, and CROSS JOIN."

    **Answer:**

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

??? question "Q5: What is a Self Join? Give a practical example."

    **Answer:** A self join joins a table with itself. Common for hierarchical data like employee-manager relationships.

    ```sql
    SELECT e.name AS employee, m.name AS manager
    FROM employees e
    LEFT JOIN employees m ON e.manager_id = m.emp_id;
    -- Developer -> Dev Lead, Dev Lead -> VP, VP -> CEO, CEO -> NULL
    ```

??? question "Q6: Subquery vs JOIN -- which performs better?"

    **Answer:** JOINs generally outperform subqueries because the optimizer can choose efficient join algorithms. However, modern optimizers often rewrite subqueries as joins internally.

    ```sql
    -- Subquery (can be slower)
    SELECT name FROM employees
    WHERE dept_id IN (SELECT dept_id FROM departments WHERE dept_name = 'Engineering');

    -- JOIN (usually preferred)
    SELECT e.name FROM employees e
    JOIN departments d ON e.dept_id = d.dept_id WHERE d.dept_name = 'Engineering';
    ```

    Always check `EXPLAIN` to compare actual plans.

??? question "Q7: Correlated vs non-correlated subquery?"

    **Answer:** A **non-correlated** subquery executes once independently. A **correlated** subquery references the outer query and re-executes per outer row.

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

---

## Aggregation & Set Operations

??? question "Q8: Explain GROUP BY and HAVING clause."

    **Answer:** `GROUP BY` groups rows into summary rows. `HAVING` filters groups after aggregation.

    ```sql
    SELECT dept_id, COUNT(*) AS cnt, AVG(salary) AS avg_sal
    FROM employees
    GROUP BY dept_id
    HAVING COUNT(*) >= 5
    ORDER BY avg_sal DESC;
    ```

??? question "Q9: WHERE vs HAVING?"

    **Answer:**

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

??? question "Q10: UNION vs UNION ALL?"

    **Answer:** `UNION` removes duplicates (extra sort). `UNION ALL` keeps all rows and is faster.

    ```sql
    SELECT city FROM customers UNION     SELECT city FROM suppliers; -- deduped
    SELECT city FROM customers UNION ALL SELECT city FROM suppliers; -- faster
    ```

??? question "Q11: EXISTS vs IN -- performance differences?"

    **Answer:** `EXISTS` short-circuits at the first match; great for large subqueries. `IN` materializes the full result set; better for small lists. `NOT IN` returns no rows if any NULL exists in the list.

    ```sql
    -- EXISTS: stops early
    SELECT e.name FROM employees e
    WHERE EXISTS (SELECT 1 FROM orders o WHERE o.emp_id = e.emp_id);

    -- IN: better for small result sets
    SELECT e.name FROM employees e
    WHERE e.dept_id IN (SELECT dept_id FROM departments WHERE region = 'US');
    ```

---

## Data Modification & Views

??? question "Q12: DELETE vs TRUNCATE vs DROP?"

    **Answer:**

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

??? question "Q13: Normal View vs Materialized View?"

    **Answer:** A **view** is virtual (re-executes query each time). A **materialized view** stores results physically (pre-computed, faster reads, but stale until refreshed).

    ```sql
    CREATE VIEW active_emps AS
    SELECT emp_id, name FROM employees WHERE status = 'ACTIVE';

    -- Materialized View (PostgreSQL)
    CREATE MATERIALIZED VIEW dept_stats AS
    SELECT dept_id, AVG(salary) avg_sal, COUNT(*) cnt FROM employees GROUP BY dept_id;
    REFRESH MATERIALIZED VIEW CONCURRENTLY dept_stats;
    ```

---

## Indexes

??? question "Q14: B-Tree, Hash, Composite, and Covering indexes?"

    **Answer:**

    - **B-Tree:** Default. Supports range queries and equality. O(log n).
    - **Hash:** Equality only (`=`). O(1) but no range support.
    - **Composite:** Multiple columns. Follows the **leftmost prefix rule**.
    - **Covering:** Contains all columns needed by a query, avoiding table lookups.

    ```sql
    CREATE INDEX idx_name ON employees(name);                          -- B-Tree
    CREATE INDEX idx_email ON employees USING HASH (email);            -- Hash
    CREATE INDEX idx_dept_hire ON employees(dept_id, hire_date);       -- Composite
    CREATE INDEX idx_cover ON employees(dept_id, name) INCLUDE (salary); -- Covering
    ```

??? question "Q15: When should you NOT use indexes?"

    **Answer:** Avoid indexes on: **small tables** (full scan is faster), **high-write tables** (index maintenance overhead), **low-cardinality columns** (boolean/gender), **frequently updated columns**, and **columns used inside functions**.

    ```sql
    SELECT * FROM employees WHERE salary * 1.1 > 100000; -- cannot use index
    SELECT * FROM employees WHERE salary > 100000 / 1.1;  -- index-friendly
    ```

??? question "Q16: Clustered vs Non-Clustered index?"

    **Answer:**

    | Feature | Clustered | Non-Clustered |
    |---------|-----------|---------------|
    | Data order | Physically reorders table rows | Separate structure with pointers |
    | Per table | Only one | Multiple allowed |
    | Leaf nodes | Contain actual data | Contain pointers to data |
    | Best for | Range scans | Lookups on secondary columns |

??? question "Q17: Index Scan vs Index Seek?"

    **Answer:** **Index Seek** navigates the B-Tree to specific rows (O(log n), very fast). **Index Scan** reads the entire index sequentially (used when many rows match). Check `EXPLAIN` to see which the optimizer picks.

    ```sql
    SELECT * FROM employees WHERE emp_id = 42;       -- Index Seek
    SELECT * FROM employees WHERE salary > 10000;     -- Index Scan (broad filter)
    SELECT * FROM employees WHERE UPPER(name)='ALICE'; -- Full Table Scan
    ```

??? question "Q18: How do you read an EXPLAIN/ANALYZE plan?"

    **Answer:** `EXPLAIN` shows the plan. `EXPLAIN ANALYZE` executes and shows actual timings.

    Key things to look for:

    - **Seq Scan** -- full table scan (may need index)
    - **Index Scan / Index Only Scan** -- using index efficiently
    - **Nested Loop / Hash Join / Merge Join** -- join strategies
    - **Rows** -- estimated vs actual (mismatch = stale stats, run `ANALYZE`)
    - **Cost** -- startup cost vs total cost
    - **Buffers** -- shared hit (cache) vs read (disk)

---

## Normalization & Denormalization

??? question "Q19: Explain 1NF, 2NF, 3NF, BCNF with examples."

    **Answer:**

    **1NF:** Atomic values only, no repeating groups.
    **2NF:** 1NF + no partial dependency on a composite key.
    **3NF:** 2NF + no transitive dependency (non-key depends on non-key).
    **BCNF:** For every dependency X->Y, X must be a superkey.

    ```sql
    -- Violates 2NF: student_name depends only on student_id, not full PK
    -- PK = (student_id, course_id) | student_name | grade
    -- Fix: students(student_id, student_name) + enrollments(student_id, course_id, grade)

    -- Violates 3NF: dept_name depends on dept_id, not on emp_id
    -- emp_id | dept_id | dept_name
    -- Fix: employees(emp_id, dept_id) + departments(dept_id, dept_name)
    ```

??? question "Q20: When and why would you denormalize?"

    **Answer:** Denormalization adds redundancy to **improve read performance**. Use for read-heavy workloads, expensive joins, aggregated caches, or microservice-owned data.

    ```sql
    -- Normalized: requires JOIN
    SELECT o.order_id, SUM(oi.price * oi.quantity) FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id GROUP BY o.order_id;

    -- Denormalized: total pre-stored
    SELECT order_id, total FROM orders;
    ```

    Trade-off: faster reads but risk of data inconsistency and more complex writes.

---

## Transactions & Concurrency

??? question "Q21: What are the ACID properties?"

    **Answer:**

    - **Atomicity:** All-or-nothing. If any part fails, the entire transaction rolls back.
    - **Consistency:** DB moves from one valid state to another, respecting all constraints.
    - **Isolation:** Concurrent transactions don't interfere with each other.
    - **Durability:** Committed changes survive crashes.

    ```sql
    BEGIN;
    UPDATE accounts SET balance = balance - 500 WHERE id = 1;
    UPDATE accounts SET balance = balance + 500 WHERE id = 2;
    COMMIT; -- both succeed or neither does
    ```

??? question "Q22: Explain the four transaction isolation levels."

    **Answer:**

    | Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read |
    |-----------------|-----------|---------------------|--------------|
    | Read Uncommitted | Yes | Yes | Yes |
    | Read Committed | No | Yes | Yes |
    | Repeatable Read | No | No | Yes (varies) |
    | Serializable | No | No | No |

    PostgreSQL defaults to **Read Committed**. MySQL InnoDB defaults to **Repeatable Read**.

??? question "Q23: Dirty Read, Non-Repeatable Read, Phantom Read?"

    **Answer:**

    - **Dirty Read:** Reading uncommitted data from another transaction (may be rolled back).
    - **Non-Repeatable Read:** Re-reading a row yields a different value because another transaction modified and committed it.
    - **Phantom Read:** Re-running a range query returns different rows because another transaction inserted/deleted matching rows.

??? question "Q24: What is a deadlock? How do you prevent it?"

    **Answer:** A deadlock is a circular wait where two transactions each hold a lock the other needs.

    ```
    Tx A: locks Row 1, waits for Row 2
    Tx B: locks Row 2, waits for Row 1 --> Deadlock!
    ```

    **Prevention:** consistent lock ordering, short transactions, lower isolation levels, lock timeouts. Most databases auto-detect deadlocks and roll back one victim.

    ```sql
    SET lock_timeout = '5s'; -- avoid indefinite waiting
    ```

??? question "Q25: Optimistic vs Pessimistic locking?"

    **Answer:** **Pessimistic** locks rows on read (`SELECT ... FOR UPDATE`), assuming conflicts are common. **Optimistic** uses a version column and checks at commit time, assuming conflicts are rare.

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

---

## Window Functions

??? question "Q26: Explain ROW_NUMBER, RANK, DENSE_RANK, LEAD, and LAG."

    **Answer:**

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

---

## CTEs & Recursive Queries

??? question "Q27: CTE vs subquery?"

    **Answer:** A **CTE** (`WITH` clause) is a named temporary result set. It is more readable, reusable within the query, and can be recursive. Performance is typically identical to a subquery.

    ```sql
    WITH high_earners AS (
        SELECT emp_id, dept_id FROM employees WHERE salary > 100000
    )
    SELECT d.dept_name, COUNT(*) FROM high_earners h
    JOIN departments d ON h.dept_id = d.dept_id GROUP BY d.dept_name;
    ```

??? question "Q28: Recursive CTE example?"

    **Answer:** A recursive CTE references itself for hierarchical/graph data.

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

---

## SQL Functions & Expressions

??? question "Q29: COALESCE and NULLIF?"

    **Answer:** `COALESCE(a,b,c)` returns the first non-NULL argument. `NULLIF(a,b)` returns NULL if a=b, otherwise a.

    ```sql
    SELECT COALESCE(nickname, first_name, 'Unknown') AS display_name FROM users;
    SELECT total_revenue / NULLIF(total_orders, 0) AS avg_val FROM sales;
    -- NULLIF prevents division-by-zero by returning NULL when orders = 0
    ```

??? question "Q30: How does the CASE expression work?"

    **Answer:** `CASE` provides if-else logic inside SQL.

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

---

## Stored Procedures, Functions, Triggers, & Cursors

??? question "Q31: Stored Procedures vs Functions?"

    **Answer:**

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

??? question "Q32: What are Triggers? Types and use cases?"

    **Answer:** Triggers auto-execute code on table events. Types: **BEFORE**, **AFTER**, **INSTEAD OF** (views); **row-level** vs **statement-level**.

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

    Use sparingly -- triggers add hidden logic that complicates debugging.

??? question "Q33: What is a Cursor and why avoid it?"

    **Answer:** A cursor processes rows one-by-one. Avoid because set-based operations are orders of magnitude faster and let the optimizer work.

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

---

## Query Optimization

??? question "Q34: Top query optimization techniques?"

    **Answer:**

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

??? question "Q35: What is the N+1 query problem?"

    **Answer:** 1 query fetches N parents, then N queries fetch children -- total N+1.

    ```sql
    SELECT * FROM departments;                                  -- 1 query
    SELECT * FROM employees WHERE dept_id = 1;                  -- N queries
    SELECT * FROM employees WHERE dept_id = 2; ...

    -- Fix: JOIN or batch IN
    SELECT d.dept_name, e.name FROM departments d
    LEFT JOIN employees e ON d.dept_id = e.dept_id;
    ```

    In JPA/Hibernate, fix with `JOIN FETCH`, `@EntityGraph`, or batch size config.

??? question "Q36: OFFSET/LIMIT vs keyset pagination?"

    **Answer:**

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

---

## Database Architecture

??? question "Q37: What is database sharding?"

    **Answer:** Sharding horizontally partitions data across multiple DB instances by a **shard key**.

    Strategies: **range-based** (risk of hotspots), **hash-based** (`hash(key) % N`, even distribution), **directory-based** (lookup table).

    Challenges: cross-shard joins, distributed transactions, rebalancing, routing logic. Use only when vertical scaling and read replicas are insufficient.

??? question "Q38: Master-slave vs master-master replication?"

    **Answer:**

    - **Master-Slave:** One master for writes, replicas for reads. Simpler, no conflicts, but write bottleneck and replication lag.
    - **Master-Master:** Multiple nodes accept writes. Higher throughput but requires conflict resolution.

    ```
    Master-Slave: [App] --writes--> [Master] --replication--> [Replica] <--reads-- [App]
    Master-Master: [App] <--> [Master A] <--sync--> [Master B] <--> [App]
    ```

??? question "Q39: CAP theorem and databases?"

    **Answer:** A distributed system can guarantee at most two of: **Consistency** (latest data), **Availability** (always responds), **Partition Tolerance** (works despite network splits). Since partitions are unavoidable, the real choice is CP vs AP.

    | Type | Examples | During partition |
    |------|---------|-----------------|
    | CP | PostgreSQL, MongoDB, HBase | Rejects requests to stay consistent |
    | AP | Cassandra, DynamoDB, CouchDB | Serves possibly stale data |

---

## Security

??? question "Q40: What is SQL injection and how do you prevent it?"

    **Answer:** SQL injection concatenates user input directly into queries, letting attackers execute arbitrary SQL.

    ```sql
    -- Vulnerable
    query = "SELECT * FROM users WHERE name='" + input + "'"
    -- input = "' OR '1'='1' --" returns ALL users

    -- Fix: parameterized queries (primary defense)
    PreparedStatement stmt = conn.prepareStatement(
        "SELECT * FROM users WHERE name = ?");
    stmt.setString(1, userInput);
    ```

    Other defenses: ORM frameworks, input validation (whitelist), least-privilege DB users, WAF. **Never** rely on escaping or client-side validation alone.
