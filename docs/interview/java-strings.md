---
title: "Top 30 Java String Interview Questions & Answers (2026)"
description: "Master the most frequently asked Java String interview questions -- from immutability and the String Pool to modern Java text blocks and performance..."
---

# Top 30 Java String Interview Questions & Answers

Master the most frequently asked Java String interview questions -- from immutability and the String Pool to modern Java text blocks and performance internals.

---

??? question "Q1: Why is String immutable in Java?"

    **Answer:** String is immutable because its internal state cannot be changed after construction -- the class is `final`, the backing `byte[]` is `private final`, and no method modifies it in place.

    **Why it exists:** Immutability solves multiple critical problems simultaneously. Without it, the JVM could not safely share string literals across the application, every string passed to a security-sensitive API (class loaders, JDBC connections, file paths) would need defensive copying, and every multi-threaded access would require synchronization.

    **How it works internally:** The `String` class is declared `final` (cannot be subclassed), its data field is `private final byte[] value` (Java 9+), and every "mutating" method like `toUpperCase()`, `concat()`, or `replace()` returns a brand-new String object.

    **The four pillars interviewers expect:**

    1. **String Pool safety** -- the JVM can deduplicate literals only because no one can change them after creation
    2. **Thread safety** -- immutable objects are inherently thread-safe with zero synchronization cost
    3. **Security** -- validated strings used in class loading, network connections, or file I/O cannot be tampered with after the check
    4. **Hashcode caching** -- computed lazily on first call to `hashCode()`, cached forever since content never changes

    ```java
    String s = "hello";
    s.toUpperCase();       // Returns NEW String "HELLO"
    System.out.println(s); // Still "hello" -- original unchanged
    ```

    **Common follow-up -- "Can you break immutability with reflection?"**
    Yes, prior to Java 9 you could use `Field.setAccessible(true)` on the internal `char[]`. From Java 9+ with modules, this is blocked by default (`InaccessibleObjectException`). Even if you bypass it, you corrupt the String Pool and break the JVM's assumptions.

    **Key gotchas:**

    - `String` immutability does NOT mean the reference is immutable -- `s = "world"` just reassigns the variable
    - The `+` operator in a loop creates O(n) temporary String objects, not mutations

---

??? question "Q2: What is the String Pool and how does the intern mechanism work?"

    **Answer:** The String Pool (also called the intern pool) is a special hash table inside the JVM heap that stores exactly one copy of each unique string literal, enabling memory reuse via reference sharing.

    **Why it exists:** Java programs create massive numbers of strings -- log messages, property keys, JSON field names. Without deduplication, identical strings would waste heap. The pool guarantees that all string literals with the same content point to the same object, reducing memory and enabling fast `==` comparison for literals.

    **How it works internally:** When the class loader encounters a string literal, it checks the pool's hash table (backed by a native `StringTable`). If an equal string exists, the existing reference is returned. If not, the string is added to the pool. The `intern()` method does the same thing programmatically for runtime-created strings.

    ```java
    String a = "hello";              // Created in pool
    String b = "hello";              // Reuses pool reference
    System.out.println(a == b);      // true

    String c = new String("hello");  // New heap object, bypasses pool
    System.out.println(a == c);      // false

    String d = c.intern();           // Returns pool reference
    System.out.println(a == d);      // true
    ```

    **Evolution across Java versions:**

    - **Java 6 and earlier:** Pool lived in PermGen (fixed size, could cause `OutOfMemoryError: PermGen space`)
    - **Java 7+:** Moved to the main heap, eligible for GC
    - **Tuning:** `-XX:StringTableSize=60013` (prime number recommended, default varies by version)

    **When to use `intern()`:** Useful when you have many duplicate strings from external sources (e.g., parsing CSV column headers, XML tag names). Call `intern()` once and use `==` for subsequent comparisons.

    **Key gotchas:**

    - Over-interning causes the `StringTable` to degrade in performance (it is a fixed-bucket hash table)
    - Interned strings in Java 7+ are GC-eligible (unlike PermGen era), but the table itself has lock contention
    - Compile-time constant expressions like `"hello" + " world"` are automatically pooled

---

??? question "Q3: How many objects are created by `String s = new String(\"hello\")`?"

    **Answer:** Up to **2 objects** are created -- this is one of the most classic String interview questions and the interviewer expects you to explain both precisely.

    **Why this question matters:** It tests whether you understand the difference between string literals (pool-managed) and explicit heap allocation. It also reveals if you know when the pool entry is actually created.

    **How it works:**

    1. **Object 1 -- the literal `"hello"` in the String Pool.** When the class is loaded, the JVM checks if `"hello"` already exists in the pool. If not, it creates a new String object there. If it already exists (from a previous execution of this line or another literal), no new pool object is created.
    2. **Object 2 -- the `new String(...)` on the heap.** The `new` keyword always allocates a fresh object on the heap, copying the content from the pool string.

    The variable `s` points to the heap object (Object 2), so `s == "hello"` evaluates to `false`.

    ```java
    String s = new String("hello");
    System.out.println(s == "hello");           // false -- different references
    System.out.println(s.equals("hello"));      // true  -- same content
    System.out.println(s.intern() == "hello");  // true  -- intern returns pool ref
    ```

    **Common follow-up -- "What if `"hello"` already exists in the pool?"**
    Then only 1 new object is created (the heap copy). The pool entry is reused.

    **Key gotchas:**

    - The literal is created at class-loading time, not at the line's execution time
    - `new String("hello")` is almost always wasteful -- prefer direct literal assignment
    - This is why IDEs flag `new String("literal")` as a code smell

---

??? question "Q4: What does String.intern() do?"

    **Answer:** `intern()` returns the canonical (pool) reference for a string -- if an equal string already exists in the pool, that reference is returned; otherwise the string is added to the pool and its reference is returned.

    **Why it exists:** It bridges the gap between runtime-created strings (from I/O, concatenation, parsing) and pool-managed literals. After interning, you can use `==` for comparison, which is faster than `equals()` because it is a single pointer comparison.

    **How it works internally:** The method is `native` -- it delegates to the JVM's `StringTable`, a C++ hash table. It computes the string's hash, probes the table, and either returns the existing entry or inserts and returns the new one. The table uses a lock, so concurrent interning has contention.

    ```java
    String s1 = new String("java");  // heap object
    String s2 = s1.intern();         // returns pool reference
    String s3 = "java";             // same pool reference
    System.out.println(s2 == s3);    // true -- both point to pool entry
    System.out.println(s1 == s2);    // false -- s1 is still the heap object
    ```

    **When to use:**

    - Parsing large datasets where field names repeat (e.g., JSON keys, CSV headers)
    - Symbol tables in compilers or interpreters
    - When you need ultra-fast `==` comparison on a bounded set of values

    **When NOT to use:**

    - Arbitrary user input (unbounded pool growth)
    - Strings that are unique (no sharing benefit)
    - High-concurrency hot paths (StringTable lock contention)

    **Key gotchas:**

    - In Java 6, interned strings lived in PermGen and were NOT garbage collected -- easy OOM
    - In Java 7+, interned strings live in the heap and are GC-eligible
    - The `StringTable` default size is relatively small; tune with `-XX:StringTableSize` for heavy intern usage
    - `intern()` is NOT free -- it has O(1) amortized cost but involves native calls and locking

---

??? question "Q5: What are the differences between String, StringBuilder, and StringBuffer?"

    **Answer:** String is immutable (every modification creates a new object), StringBuilder is mutable and unsynchronized (fast, single-threaded), and StringBuffer is mutable and synchronized (thread-safe but slower).

    **Why all three exist:** String covers the 90% case of text that does not change. But building strings incrementally (in loops, parsers, formatters) with String creates O(n) garbage objects. StringBuilder was introduced in Java 5 as the go-to mutable alternative. StringBuffer predates it (Java 1.0) with synchronized methods -- a design decision later recognized as premature synchronization since most string building is thread-local.

    **How they work internally:** Both StringBuilder and StringBuffer extend `AbstractStringBuilder`, which maintains a resizable `byte[]` (or `char[]` pre-Java 9). The only difference is that StringBuffer's `append()`, `insert()`, `delete()` methods are `synchronized`. StringBuilder's methods are identical but without the monitor lock.

    | Feature       | String          | StringBuilder     | StringBuffer      |
    |---------------|-----------------|-------------------|-------------------|
    | Mutability    | Immutable       | Mutable           | Mutable           |
    | Thread Safety | Yes (immutable) | No                | Yes (synchronized)|
    | Performance   | Slow for concat | Fastest           | Slower than SB    |
    | Since         | JDK 1.0         | JDK 1.5           | JDK 1.0           |
    | Use Case      | Constants, keys | Loops, building   | Shared mutable buffer |

    ```java
    StringBuilder sb = new StringBuilder(64); // pre-sized for performance
    sb.append("a").append("b").append("c");   // single mutable buffer, no copies
    String result = sb.toString();            // creates immutable String from buffer
    ```

    **Common follow-up -- "Is StringBuffer ever needed in modern Java?"**
    Rarely. If multiple threads must append to a shared buffer, you are usually better off with thread-local StringBuilders merged at the end, or a concurrent data structure. StringBuffer's method-level synchronization does not protect multi-step operations anyway.

    **Key gotchas:**

    - StringBuffer's synchronization does NOT guarantee atomicity of compound operations (e.g., check-then-append)
    - StringBuilder is NOT thread-safe -- sharing one across threads without external synchronization causes corruption
    - Both have a default initial capacity of 16 characters

---

??? question "Q6: When should you use String, StringBuilder, or StringBuffer?"

    **Answer:** Use String for values that will not change, StringBuilder for any mutable string work in a single thread (the default choice), and StringBuffer only in the rare case where a mutable buffer is genuinely shared across threads.

    **Why this matters in interviews:** This question tests whether you understand performance implications. The wrong choice in a hot path can cause severe GC pressure or, conversely, unnecessary lock overhead.

    **Decision framework:**

    - **String** -- configuration values, map keys, method parameters, return values, anything that should be safely shared
    - **StringBuilder** -- building SQL queries, HTML, log messages, CSV lines, any loop-based concatenation
    - **StringBuffer** -- legacy codebases, or the extremely rare case of a shared append-only log buffer

    ```java
    // BAD -- O(n^2) with String: each += creates a new String + copies all previous chars
    String result = "";
    for (int i = 0; i < 10000; i++) result += i;

    // GOOD -- O(n) with StringBuilder: appends to existing buffer, resizes occasionally
    StringBuilder sb = new StringBuilder(50000); // estimate capacity
    for (int i = 0; i < 10000; i++) sb.append(i);
    String result = sb.toString();
    ```

    **Real-world examples:**

    - Building a WHERE clause dynamically: StringBuilder
    - Formatting a response body in a servlet: StringBuilder
    - Storing a username after validation: String
    - Writing to a shared log buffer from multiple threads: StringBuffer (or better, a ConcurrentLinkedQueue)

    **Key gotchas:**

    - The compiler optimizes simple `a + b + c` (non-loop) into StringBuilder automatically, so do not manually replace every `+`
    - In Java 9+, `invokedynamic`-based concatenation often outperforms manual StringBuilder for simple cases
    - Pre-sizing StringBuilder avoids repeated array copies: `new StringBuilder(estimatedLength)`
    - After Java 21, `StringBuffer` is essentially legacy -- prefer StringBuilder + external synchronization if needed

---

??? question "Q7: How does String concatenation with + work internally?"

    **Answer:** The `+` operator on strings is syntactic sugar -- the compiler transforms it into efficient bytecode, but the strategy has changed significantly across Java versions.

    **Why it matters:** Understanding the internal mechanism tells you when `+` is fine and when it kills performance.

    **How it works -- three eras:**

    1. **Compile-time constants** (all versions): Expressions involving only literals are folded at compile time. `"Hello" + " " + "World"` becomes the single literal `"Hello World"` in the constant pool. Zero runtime cost.

    2. **Java 5-8** (StringBuilder era): For non-constant expressions, `javac` generates `new StringBuilder().append(a).append(b).toString()`. Problem: in a loop, a new StringBuilder is created per iteration.

    3. **Java 9+** (invokedynamic era, JEP 280): The compiler emits an `invokedynamic` instruction linked to `StringConcatFactory`. At first invocation, the JVM generates an optimized concatenation strategy (e.g., pre-sized byte array copy). Benefits: no intermediate StringBuilder, JIT can inline better, future JVM improvements apply without recompiling.

    ```java
    // Constant folding -- zero runtime cost
    String s1 = "Hello" + " " + "World"; // compiled as "Hello World"

    // Variable concatenation -- invokedynamic in Java 9+
    String name = "World";
    String s2 = "Hello " + name + "!";
    // Java 9+: invokedynamic -> StringConcatFactory

    // Loop -- still problematic with +
    String bad = "";
    for (int i = 0; i < 1000; i++) bad += i; // 1000 allocations!
    ```

    **When to manually use StringBuilder:**

    - Loops with concatenation (compiler cannot hoist the builder out of the loop)
    - Building strings conditionally across multiple branches
    - When you need to pre-size the buffer

    **Key gotchas:**

    - `final String` variables are compile-time constants: `final String a = "x"; a + "y"` is folded
    - Non-final variables are never folded, even if effectively final
    - In Java 9+, you can choose the strategy via `-Djava.lang.invoke.stringConcat=` (MH_INLINE_SIZED_EXACT is default)

---

??? question "Q8: How does HashMap work with String keys?"

    **Answer:** String is the ideal HashMap key because its immutability guarantees that its hash code never changes after insertion, its `hashCode()` is cached after first computation, and it has a correct `equals()`/`hashCode()` contract.

    **Why this is asked:** Interviewers want to verify you understand the relationship between hash-based collections and the objects used as keys. A mutable key that changes its hash after insertion effectively "loses" the entry in the map.

    **How it works internally:**

    1. `map.put("hello", value)` -- computes `"hello".hashCode()` (cached in the String object), applies a secondary hash spread, finds the bucket index
    2. If collision occurs, traverses the bucket's linked list (or tree in Java 8+) using `equals()` to find exact match
    3. `map.get(new String("hello"))` -- computes hash (same value), finds same bucket, `equals()` matches the key

    ```java
    Map<String, Integer> map = new HashMap<>();
    map.put("hello", 1);

    // Works because equals() compares content, not reference
    String key = new String("hello");
    map.get(key); // returns 1

    // String's hashCode is cached -- second call is O(1)
    "hello".hashCode(); // computed
    "hello".hashCode(); // returned from cache (field `hash`)
    ```

    **Why String is perfect for keys:**

    - **Immutable** -- hash cannot change after map insertion (no "lost" entries)
    - **Cached hashCode** -- repeated lookups are effectively O(1) for the hash computation
    - **Implements Comparable** -- when a bucket degrades to a tree (8+ collisions), String's natural ordering enables O(log n) tree search instead of O(n) traversal
    - **Well-distributed hash** -- String's polynomial rolling hash (`s[0]*31^(n-1) + s[1]*31^(n-2) + ...`) produces good distribution

    **Key gotchas:**

    - If you use a mutable object as a key and change its fields after insertion, `get()` will fail silently
    - HashMap's secondary hash spread (`hash ^ (hash >>> 16)`) reduces collisions for poor hash functions
    - String's hash of `""` (empty string) is 0, which is also the default uncomputed value -- this is fine since the hash is recomputed lazily

---

??? question "Q9: What is the difference between equals() and == for Strings?"

    **Answer:** `==` compares references (are these the exact same object in memory?), while `equals()` compares content (do these two strings contain the same sequence of characters?). For strings, you almost always want `equals()`.

    **Why this is a top interview question:** It is the single most common source of subtle bugs in Java. Candidates who use `==` on strings from user input, deserialization, or concatenation will get incorrect behavior that works "sometimes" (when the pool is involved) and fails mysteriously otherwise.

    **How it works internally:**

    - `==` is a single pointer comparison -- O(1), compares two memory addresses
    - `String.equals()` first checks `==` (same reference? done), then checks length equality, then compares byte-by-byte. O(n) worst case but short-circuits early.

    ```java
    String a = "hello";             // pool reference
    String b = new String("hello"); // heap object (different address)

    System.out.println(a == b);          // false (different objects!)
    System.out.println(a.equals(b));     // true  (same content)
    System.out.println("hello".equals(a)); // true, and NPE-safe

    // When == works (but you still shouldn't rely on it):
    String c = "hello";
    System.out.println(a == c); // true -- both from pool
    ```

    **Best practices:**

    - Always use `equals()` for string comparison
    - Put the literal on the left to avoid NPE: `"expected".equals(variable)`
    - Or use `Objects.equals(a, b)` for null-safe comparison
    - In switch statements (Java 7+), the compiler uses `equals()` internally -- safe to use

    **When `==` is acceptable:**

    - Comparing interned strings where you control both sides
    - Comparing against `null` (must use `==`)
    - Enum comparisons (not strings, but related concept)

    **Key gotchas:**

    - `==` may return `true` for small strings due to pool caching, creating false confidence
    - Strings from `substring()`, `concat()`, `+` with variables are NOT pooled -- `==` fails
    - In unit tests, `assertEquals()` uses `equals()`, not `==`

---

??? question "Q10: Why is String a popular HashMap key?"

    **Answer:** String is the most commonly used HashMap key in Java because it satisfies all the requirements for a well-behaved map key: immutability, correct and consistent `equals()`/`hashCode()`, cached hash computation, and natural human readability.

    **Why this is asked:** Interviewers use this to check whether you understand the `equals()`/`hashCode()` contract and what properties make an object safe for use in hash-based collections.

    **The five reasons:**

    1. **Immutable** -- the hash code can never change after the key is inserted into the map. Mutable keys risk "phantom entries" that can never be retrieved.
    2. **Cached hashCode** -- String caches its hash after first computation in a private `int hash` field. Subsequent map operations avoid recomputation.
    3. **Correct equals/hashCode contract** -- `a.equals(b)` implies `a.hashCode() == b.hashCode()`. This is guaranteed by the String implementation and critical for map correctness.
    4. **Implements Comparable** -- Java 8 HashMap uses balanced trees (red-black) for buckets with 8+ entries. Comparable keys enable O(log n) tree search instead of O(n) traversal.
    5. **Ubiquity and readability** -- IDs, names, URLs, property keys, JSON field names are naturally strings. Using them directly avoids wrapping in custom key classes.

    **Real-world scenarios:** Configuration maps (`Map<String, Object>`), HTTP headers, caches keyed by URL, environment variables, property files.

    **Common follow-up -- "What happens if you use a mutable object as a key?"**
    If you mutate the key after insertion, its `hashCode()` changes, the map looks in the wrong bucket on `get()`, and the entry becomes unreachable. The entry still exists (causes memory leak) but is effectively lost.

    **Key gotchas:**

    - Custom key classes MUST override both `equals()` and `hashCode()` consistently
    - Using `new String("key")` vs `"key"` as keys works correctly (equals-based lookup) but wastes memory
    - For composite keys, consider records (Java 16+) which auto-generate correct `equals()`/`hashCode()`

---

??? question "Q11: How many objects: `new String(\"hello\") + new String(\"world\")`?"

    **Answer:** This expression creates up to **5 String objects** plus a temporary StringBuilder -- a classic interview question that tests your understanding of string creation at every level.

    **Why it matters:** It demonstrates that seemingly simple string operations can produce significant garbage, especially in loops.

    **Breakdown of object creation:**

    1. `"hello"` -- literal placed in the String Pool (if not already present)
    2. `new String("hello")` -- new heap object copying pool content
    3. `"world"` -- literal placed in the String Pool (if not already present)
    4. `new String("world")` -- new heap object copying pool content
    5. `"helloworld"` -- the result of concatenation, created on the heap by `StringBuilder.toString()`

    **Plus the hidden 6th object:** the temporary `StringBuilder` used internally to perform the `+` concatenation (in Java 5-8). In Java 9+, `StringConcatFactory` may optimize this differently.

    ```java
    String result = new String("hello") + new String("world");
    // result == "helloworld" is false (not in pool)
    // result.equals("helloworld") is true

    // To put result in pool:
    String pooled = result.intern();
    System.out.println(pooled == "helloworld"); // true
    ```

    **Common follow-up -- "Is the concatenation result in the pool?"**
    No. Only literals and explicitly interned strings enter the pool. The `+` operator with non-constant operands always produces a heap-only string.

    **Key gotchas:**

    - If `"hello"` and `"world"` already exist in the pool (from earlier code), only 3 new objects are created (2 heap copies + 1 concatenated result)
    - The StringBuilder itself is an additional object beyond the 5 strings
    - This is why `new String(literal)` is considered bad practice -- it doubles objects for no benefit

---

??? question "Q12: What was the substring() memory leak in Java 6?"

    **Answer:** In Java 6, `substring()` created a new String object that shared the original's backing `char[]` array via offset and count fields, meaning a tiny substring could prevent a huge original array from being garbage collected.

    **Why it existed (the tradeoff):** The Java designers optimized `substring()` for speed -- O(1) by avoiding array copy. This made it blazing fast but introduced an insidious memory leak when the original string was large and no longer needed.

    **How it worked internally (Java 6):**

    - `String` had fields: `char[] value`, `int offset`, `int count`
    - `substring(begin, end)` created a new String with the SAME `char[]` reference, different offset/count
    - The original 10MB array stayed alive as long as the tiny substring existed

    ```java
    // Java 6 -- severe memory leak scenario
    String huge = readHugeFile();           // 10 MB char[]
    String small = huge.substring(0, 5);   // Still references the 10 MB array!
    huge = null;                            // GC cannot reclaim the 10 MB array
    // small holds it alive via shared char[]
    ```

    **The fix (Java 7+):** `substring()` now performs `Arrays.copyOfRange()` -- copies only the needed characters into a new, right-sized array. Trading O(n) copy cost for predictable memory behavior.

    **Workaround in Java 6:**
    ```java
    String small = new String(huge.substring(0, 5)); // forces array copy
    ```

    **Why interviewers ask this:**

    - Tests understanding of internal String representation
    - Shows awareness of memory leak patterns
    - Demonstrates knowledge of Java version evolution

    **Key gotchas:**

    - This bug affected any code caching small portions of large strings (e.g., extracting headers from HTTP responses)
    - The leak was silent -- no `OutOfMemoryError` directly pointing to substring
    - Java 7+ substring is O(n) not O(1) -- a deliberate tradeoff

---

??? question "Q13: How does String immutability provide thread safety?"

    **Answer:** An immutable object's state is fixed at construction and can never be modified, which means multiple threads can read it concurrently without any possibility of data races, torn reads, or inconsistent state -- no synchronization required.

    **Why this matters:** Thread safety through immutability is the cheapest and most reliable form of concurrency control. No locks, no volatile, no CAS operations -- just share freely.

    **How it works (the Java Memory Model perspective):**

    - The `final` fields in String are guaranteed by the JMM to be fully visible to all threads after construction completes (the "freeze" guarantee of `final` fields)
    - Since no method can modify the `byte[]` content, there is no write after construction -- only reads
    - Reads from multiple threads to the same memory location without writes are always safe

    **What would break without immutability:**

    - Thread A validates a filename string, Thread B modifies it before Thread A opens the file (TOCTOU attack)
    - Thread A puts a string key in HashMap, Thread B changes the string, the entry becomes unreachable
    - Every method accepting a String parameter would need `new String(param)` defensive copy

    ```java
    // Safe -- no synchronization needed
    public class Config {
        private final String dbUrl; // immutable, safe to share

        public Config(String dbUrl) { this.dbUrl = dbUrl; }
        public String getDbUrl() { return dbUrl; } // safe to return directly
    }
    ```

    **Common follow-up -- "Are all final fields thread-safe?"**
    `final` guarantees safe publication (visibility after construction). But if the final field points to a mutable object (e.g., `final List<String>`), the list content is still not thread-safe. String avoids this because its internal array is never exposed or modified.

    **Key gotchas:**

    - Immutability provides safety for reads only -- if you need atomic read-modify-write on a String reference, use `AtomicReference<String>` or `volatile`
    - StringBuilder is explicitly NOT thread-safe -- sharing one across threads causes corruption (missing chars, ArrayIndexOutOfBoundsException)

---

??? question "Q14: How do you create an immutable class (using String as example)?"

    **Answer:** An immutable class is one whose instances cannot be modified after construction. String is the canonical example in Java, and the recipe has five strict rules.

    **Why immutability matters:** It eliminates entire categories of bugs (race conditions, defensive copy errors, unintended aliasing), makes objects safe for concurrent use, and enables aggressive caching and sharing.

    **The five rules:**

    1. **Declare the class `final`** -- prevents subclasses from adding mutable state or overriding methods
    2. **Make all fields `private final`** -- no direct access, assigned exactly once
    3. **No setter methods** -- no way to change state after construction
    4. **Defensive copy on input** -- if constructor accepts mutable objects (lists, dates, arrays), copy them
    5. **Defensive copy on output** -- if getters return mutable objects, return copies or unmodifiable views

    ```java
    public final class Employee {
        private final String name;           // String is already immutable
        private final List<String> skills;   // List is mutable -- needs protection

        public Employee(String name, List<String> skills) {
            this.name = name;
            this.skills = List.copyOf(skills); // defensive copy -- unmodifiable
        }

        public String getName() { return name; }
        public List<String> getSkills() { return skills; } // List.copyOf is already unmodifiable
    }
    ```

    **Modern alternatives (Java 16+):**
    ```java
    // Records are immutable data carriers with auto-generated equals/hashCode/toString
    public record Employee(String name, List<String> skills) {
        public Employee {
            skills = List.copyOf(skills); // compact constructor for defensive copy
        }
    }
    ```

    **How String follows these rules:**

    - `public final class String` -- cannot be subclassed
    - `private final byte[] value` -- never reassigned
    - No method modifies `value` in place
    - `toCharArray()` returns a copy, not the internal array

    **Key gotchas:**

    - `final` on the field means the reference cannot change, but the object it points to might still be mutable (e.g., `final int[]` -- array contents can change)
    - `Collections.unmodifiableList()` wraps but does not copy -- if the original is modified, the view reflects changes. Use `List.copyOf()` instead.
    - Lazy initialization (like String's cached `hash`) is acceptable if done safely and produces consistent results

---

??? question "Q15: What is StringJoiner and how does String.join() work?"

    **Answer:** `StringJoiner` (Java 8+) is a mutable class that constructs a string by joining elements with a delimiter, and optionally wrapping the result with a prefix and suffix. `String.join()` is a static convenience method that delegates to `StringJoiner` internally.

    **Why it exists:** Before Java 8, joining strings with a delimiter required manual loop logic with off-by-one checks ("don't add comma after the last element"). StringJoiner encapsulates this cleanly.

    **How it works internally:** StringJoiner maintains a `StringBuilder`. Each `add()` call appends the delimiter (if not the first element) and then the new element. `toString()` adds prefix/suffix and returns the result.

    ```java
    // String.join() -- simplest API for basic joining
    String csv = String.join(", ", "Java", "Python", "Go"); // "Java, Python, Go"

    // StringJoiner -- when you need prefix/suffix
    StringJoiner sj = new StringJoiner(", ", "[", "]");
    sj.add("Java").add("Python").add("Go");
    sj.toString(); // "[Java, Python, Go]"

    // Empty value handling
    StringJoiner empty = new StringJoiner(", ", "[", "]");
    empty.setEmptyValue("EMPTY");
    empty.toString(); // "EMPTY" (not "[]")

    // Stream integration via Collectors.joining()
    List.of("a", "b", "c").stream()
        .collect(Collectors.joining(", ", "{", "}")); // "{a, b, c}"
    ```

    **When to use each:**

    - `String.join(delimiter, elements)` -- quick one-liner for arrays or iterables
    - `StringJoiner` -- when you need prefix/suffix or custom empty value
    - `Collectors.joining()` -- terminal operation in stream pipelines

    **Key gotchas:**

    - `String.join()` accepts `CharSequence...` or `Iterable<? extends CharSequence>` -- not `int[]` or other primitives
    - `StringJoiner` is NOT thread-safe (it wraps a StringBuilder)
    - `setEmptyValue()` only applies when no elements have been added -- not when all elements are empty strings
    - For very large joins, pre-sizing the internal StringBuilder is not exposed -- consider manual StringBuilder if performance is critical

---

??? question "Q16: What are Compact Strings in Java 9+ (Latin1 vs UTF-16)?"

    **Answer:** Compact Strings (JEP 254) is a Java 9 optimization that changed String's internal representation from `char[]` (always 2 bytes per character) to `byte[]` with an encoding flag -- using 1 byte per character for Latin1 strings and 2 bytes only when needed for UTF-16.

    **Why it exists:** Empirical studies of real-world Java applications showed that the vast majority of strings (often 95%+) contain only Latin1 characters (ASCII, Western European). Storing these as `char[]` wastes 50% of heap on zeroes in the high byte. This optimization cuts typical application heap usage by 10-15%.

    **How it works internally:**

    - `private final byte[] value` -- the raw string data
    - `private final byte coder` -- either `LATIN1 (0)` or `UTF16 (1)`
    - All String methods check the coder and dispatch to Latin1-optimized or UTF-16 code paths
    - The JIT compiler aggressively intrinsifies Latin1 paths

    ```java
    String ascii = "hello";   // Latin1: 5 bytes (coder=0)
    String emoji = "hello世";  // UTF-16: 12 bytes (coder=1, 6 chars x 2 bytes)

    // Both behave identically from the API perspective
    ascii.length();  // 5
    emoji.length();  // 6
    ```

    **Performance impact:**

    - **Memory:** ~10-15% heap reduction for typical applications
    - **Speed:** Latin1 operations can use single-byte array intrinsics (faster memcpy, vectorized comparison)
    - **No API change:** Completely transparent to application code

    **Configuration:**

    - Enabled by default in Java 9+
    - Disable with `-XX:-CompactStrings` (rarely needed, mostly for debugging)

    **Key gotchas:**

    - A single non-Latin1 character in a string forces the entire string to UTF-16 encoding
    - `charAt()` still returns `char` (2 bytes) regardless of internal encoding -- the abstraction is preserved
    - String concatenation may need encoding promotion if mixing Latin1 and UTF-16 operands
    - Benchmarks should use realistic data -- all-ASCII tests may overestimate gains for internationalized apps

---

??? question "Q17: String.format() vs MessageFormat vs + concatenation performance?"

    **Answer:** For pure performance, direct concatenation (`+` or StringBuilder) is fastest, `String.format()` is 5-10x slower due to parsing the format string at runtime, and `MessageFormat` is slowest due to locale-aware formatting and pattern compilation.

    **Why the difference:** `+` concatenation (especially in Java 9+ with `StringConcatFactory`) compiles down to near-optimal bytecode. `String.format()` must parse the format string, match placeholders to arguments, and apply type-specific formatting on every call. `MessageFormat` adds locale handling, pluralization, and choice formats.

    | Method            | Relative Speed | Best For                     |
    |-------------------|---------------|-------------------------------|
    | `+` / `concat()`  | 1x (fastest)  | Simple joins, hot paths       |
    | `StringBuilder`   | ~1x           | Loops, conditional building   |
    | `String.format()` | ~5-10x slower | Formatted output, readability |
    | `.formatted()`    | ~5-10x slower | Same as format, Java 15+     |
    | `MessageFormat`   | ~20x slower   | i18n / localization           |

    ```java
    String name = "Alice"; int age = 30;

    // Fastest -- direct concatenation
    String s1 = "Name: " + name + ", Age: " + age;

    // Readable -- format (acceptable for non-hot paths)
    String s2 = String.format("Name: %s, Age: %d", name, age);

    // Java 15+ -- instance method on the template string
    String s3 = "Name: %s, Age: %d".formatted(name, age);

    // i18n -- when you need locale-specific formatting
    String s4 = MessageFormat.format("Name: {0}, Age: {1}", name, age);
    ```

    **When to use each:**

    - Hot paths (logging, serialization loops): `+` or StringBuilder
    - Readable one-off messages (exceptions, UI text): `String.format()` or `.formatted()`
    - Internationalized applications: `MessageFormat` with resource bundles
    - Debug/log output: Consider `String.format()` -- readability trumps nanoseconds

    **Key gotchas:**

    - `String.format()` compiles the format string on every call -- for repeated formats, consider `java.util.Formatter` with a pre-built pattern
    - Logging frameworks (SLF4J, Log4j) use `{}` placeholders that avoid formatting when the log level is disabled -- always prefer this over `String.format()` in log statements
    - Java 21+ String Templates (preview) aim to combine performance with readability, but are not yet stable

---

??? question "Q18: isBlank() vs isEmpty() (Java 11+)?"

    **Answer:** `isEmpty()` returns `true` only when the string has zero characters (`length() == 0`). `isBlank()` (added in Java 11) returns `true` when the string is empty OR contains only whitespace characters -- a strictly more inclusive check.

    **Why `isBlank()` was added:** Input validation almost always needs to reject whitespace-only inputs (a form field with just spaces, a config value of `"\t"`). Before Java 11, this required `str.trim().isEmpty()` or regex. `isBlank()` provides a cleaner, Unicode-aware one-liner.

    **How they work internally:**

    - `isEmpty()`: simply checks `value.length == 0` -- O(1)
    - `isBlank()`: iterates through characters, checking `Character.isWhitespace()` for each. Returns false on the first non-whitespace character. O(n) worst case for all-whitespace strings, but O(1) for non-blank strings (short-circuits on first char).

    ```java
    "".isEmpty();      // true     "".isBlank();      // true
    "   ".isEmpty();   // false    "   ".isBlank();   // true
    "\t\n".isEmpty();  // false    "\t\n".isBlank();  // true
    "hi".isEmpty();    // false    "hi".isBlank();    // false
    " hi ".isEmpty();  // false    " hi ".isBlank();  // false
    ```

    **Practical usage:**
    ```java
    // Input validation -- reject blank inputs
    if (username == null || username.isBlank()) {
        throw new IllegalArgumentException("Username must not be blank");
    }

    // Filtering blank lines from text
    String text = "hello\n   \nworld\n\n";
    text.lines().filter(line -> !line.isBlank()).toList(); // ["hello", "world"]
    ```

    **Key gotchas:**

    - `isBlank()` uses `Character.isWhitespace()` which covers Unicode whitespace (not just ASCII <= 32 like `trim()`)
    - A `null` string will throw NPE on both methods -- always null-check first
    - `isBlank()` was added in Java 11 -- if you are on Java 8, use `str.trim().isEmpty()`
    - `" "` (regular space), `" "` (non-breaking space) -- `isBlank()` returns true for the first but NOT the second because `Character.isWhitespace()` excludes non-breaking space

---

??? question "Q19: String.strip() vs trim() difference?"

    **Answer:** `trim()` removes characters with code point <= 32 (ASCII control characters and space). `strip()` (Java 11) removes all Unicode whitespace as defined by `Character.isWhitespace()` -- a broader and more correct definition.

    **Why `strip()` was added:** Globalization. Data from international sources may contain Unicode whitespace characters (ideographic space, em space, thin space) that have code points well above 32. `trim()` silently fails to remove these, causing validation bugs.

    **How they differ internally:**

    - `trim()`: scans from both ends, skipping characters where `ch <= ' '` (char value 32). Simple ASCII-era logic.
    - `strip()`: scans from both ends, skipping characters where `Character.isWhitespace(codepoint)` returns true. This includes 25+ whitespace code points across Unicode.

    ```java
    char enQuad = ' '; // EN QUAD -- Unicode whitespace (code point > 32)
    String s = enQuad + "hello" + enQuad;

    s.trim();   // " hello " -- NOT trimmed! (char > 32)
    s.strip();  // "hello" -- properly trimmed

    // Directional stripping
    "  hi  ".stripLeading();  // "hi  "
    "  hi  ".stripTrailing(); // "  hi"

    // trim() also removes control characters (0-31) that aren't whitespace
    String withNull = "\0hello\0";
    withNull.trim();  // "hello" (removes \0 since 0 < 32)
    withNull.strip(); // "\0hello\0" (Character.isWhitespace('\0') is false)
    ```

    **When to use each:**

    - **Java 11+ new code:** Always use `strip()` -- it is the correct modern choice
    - **Legacy code on Java 8:** `trim()` is your only option
    - **Removing control characters:** `trim()` actually handles this case (chars 0-31), where `strip()` does not

    **Key gotchas:**

    - `strip()` does NOT remove ` ` (non-breaking space) -- `Character.isWhitespace()` returns false for it
    - `trim()` removes ` ` (null char) -- `strip()` does not
    - Both methods return the original string instance (not a copy) if no trimming was needed -- minor optimization
    - `stripLeading()` and `stripTrailing()` have no `trim` equivalents -- you had to use regex before Java 11

---

??? question "Q20: What do lines(), repeat(), and indent() do?"

    **Answer:** These are Java 11-12 convenience methods that eliminate boilerplate for common string operations: splitting by line terminators, repeating a string N times, and adjusting indentation.

    **Why they were added:** Before these methods, you needed regex splits (`split("\\R")`), loops or third-party libraries (Guava's `Strings.repeat()`), and manual padding logic. The JDK consolidated the most common patterns into the String class itself.

    **How each works:**

    - **`lines()` (Java 11):** Returns a `Stream<String>` split by line terminators (`\n`, `\r`, `\r\n`). Unlike `split()`, it is lazy (processes one line at a time) and does not include a trailing empty string.
    - **`repeat(int n)` (Java 11):** Returns the string concatenated with itself `n` times. Internally uses `Arrays.copyOf` with doubling strategy for O(n) performance.
    - **`indent(int n)` (Java 12):** Adjusts indentation -- positive `n` adds spaces to each line, negative `n` removes up to that many leading spaces. Also normalizes line endings and ensures a trailing newline.

    ```java
    // lines() -- lazy stream of lines, handles all line terminators
    "a\nb\r\nc".lines().count();                    // 3
    "a\nb\nc\n".lines().toList();                   // ["a", "b", "c"] (no trailing empty)
    "hello\nworld".lines().filter(l -> !l.isBlank()).count(); // 2

    // repeat() -- string multiplication
    "-".repeat(20);        // "--------------------"
    "ab".repeat(3);        // "ababab"
    "x".repeat(0);         // ""
    // "x".repeat(-1);     // IllegalArgumentException

    // indent() -- adjust indentation per line
    "hello\nworld".indent(4);
    //     "    hello\n    world\n"

    "    hello\n    world".indent(-2);
    //     "  hello\n  world\n"
    ```

    **Practical use cases:**

    - `lines()`: Parsing multi-line config, log analysis, line-by-line processing without loading all into memory
    - `repeat()`: Building separators, padding, generating test data
    - `indent()`: Code generation, formatting nested output, adjusting text block indentation at runtime

    **Key gotchas:**

    - `lines()` does NOT include a trailing empty string for a trailing newline (unlike `split("\n", -1)`)
    - `indent()` always adds a trailing newline -- even if the original did not have one
    - `indent()` with negative values only removes spaces, not tabs
    - `repeat(0)` returns empty string, `repeat(1)` returns the string itself (same instance)

---

??? question "Q21: How do text blocks work (Java 15)?"

    **Answer:** Text blocks (JEP 378, finalized in Java 15) are multi-line string literals delimited by `"""` that automatically handle indentation stripping, line continuation, and escape sequences, making embedded JSON, SQL, HTML, and code snippets readable.

    **Why they exist:** Writing multi-line strings with `\n` and `+` concatenation is error-prone and unreadable. Text blocks let you paste formatted text directly into Java source, and the compiler intelligently removes incidental indentation (the whitespace that exists only because of Java code formatting).

    **How indentation stripping works:**

    1. The compiler finds the leftmost non-whitespace character across all content lines AND the position of the closing `"""`
    2. That column becomes the "incidental indent" -- everything left of it is stripped
    3. The closing `"""` position can be used to control stripping

    ```java
    // JSON embedding -- clean and readable
    String json = """
            {
                "name": "Alice",
                "age": 30
            }
            """;
    // Result has no leading spaces (incidental indent is 12 spaces)

    // Line continuation with \ (no newline at that point)
    String single = """
            This is a \
            single line"""; // "This is a single line"

    // Preserve trailing spaces with \s (space escape)
    String padded = """
            col1  \s
            col2  \s
            """; // Each line ends with exactly 3 spaces

    // Interpolation with .formatted()
    String html = """
            <html>
              <body>
                <p>Hello, %s!</p>
              </body>
            </html>
            """.formatted("World");
    ```

    **Rules and syntax:**

    - Opening `"""` must be followed by a newline (content starts on next line)
    - Closing `"""` can be on its own line (adds trailing newline) or at end of last content line (no trailing newline)
    - Supports all standard escape sequences (`\n`, `\t`, `\"`, etc.) plus new ones (`\s`, `\` line continuation)

    **Key gotchas:**

    - The opening `"""` cannot have content on the same line -- compile error
    - Moving the closing `"""` left or right changes the effective indentation of the entire block
    - `\s` translates to a literal space -- it exists only to prevent trailing-space stripping
    - Text blocks are still regular `String` objects at runtime -- no new type
    - IDE formatting (auto-indent) can accidentally change the content by shifting the incidental indent

---

??? question "Q22: How do you convert String to int/Integer?"

    **Answer:** Use `Integer.parseInt()` for a primitive `int` result, or `Integer.valueOf()` for a boxed `Integer` object. Both throw `NumberFormatException` on invalid input.

    **Why two methods exist:** `parseInt()` avoids boxing overhead -- critical in tight loops processing millions of values. `valueOf()` uses the Integer cache (-128 to 127) and is preferable when you need an `Integer` object (e.g., for collections).

    **How they work internally:**

    - `parseInt()`: Iterates through characters, validates digit-by-digit, accumulates the result using multiplication and subtraction (uses negative accumulation to handle `Integer.MIN_VALUE` edge case)
    - `valueOf()`: Calls `parseInt()` internally, then wraps result in `Integer.valueOf(int)` which checks the cache

    ```java
    // Primitive result -- preferred for performance
    int a = Integer.parseInt("42");          // 42

    // Boxed result -- uses cache for -128 to 127
    Integer b = Integer.valueOf("42");       // Integer(42), cached

    // Radix support -- parse hex, binary, octal
    int hex = Integer.parseInt("FF", 16);    // 255
    int bin = Integer.parseInt("1010", 2);   // 10
    int oct = Integer.parseInt("77", 8);     // 63

    // Unsigned parsing (Java 8+)
    int unsigned = Integer.parseUnsignedInt("4294967295"); // -1 as unsigned

    // Defensive parsing
    try {
        Integer.parseInt("hello");
    } catch (NumberFormatException e) {
        // Handle gracefully
    }

    // Java 9+ Optional-based alternative (no exceptions)
    // Not in stdlib, but common pattern:
    OptionalInt result = tryParse("42"); // custom utility
    ```

    **When to use each:**

    - `parseInt()` -- you need a primitive, or you are in a performance-sensitive loop
    - `valueOf()` -- you need an Integer object, especially for values in the cached range
    - `decode()` -- when input might have `0x`, `0`, or `#` prefixes

    **Key gotchas:**

    - Leading/trailing whitespace causes `NumberFormatException` -- `trim()` first
    - Empty string throws `NumberFormatException` (not zero)
    - `Integer.parseInt(null)` throws `NumberFormatException`, not `NullPointerException`
    - Overflow: parsing "2147483648" (MAX_VALUE + 1) throws `NumberFormatException`, not silent wrap-around
    - For `Long`, `Double`, etc., the same pattern applies: `Long.parseLong()`, `Double.parseDouble()`

---

??? question "Q23: What are the ways to convert other types to String?"

    **Answer:** Java provides multiple ways to convert any type to String, each with different null-handling semantics and performance characteristics. `String.valueOf()` is the safest default choice.

    **Why multiple options exist:** Different scenarios need different null behavior. Sometimes you want "null" (display), sometimes an exception (fail-fast), sometimes a fallback value (configuration).

    **The methods ranked by safety:**

    | Method | Null Input | Result | Use Case |
    |--------|-----------|--------|----------|
    | `String.valueOf(obj)` | Returns `"null"` | Safe | Default choice |
    | `"" + obj` | Returns `"null"` | Safe | Quick inline |
    | `Objects.toString(obj, default)` | Returns default | Safe | Config/fallback |
    | `obj.toString()` | NPE | Unsafe | When you know non-null |
    | `Integer.toString(n)` | NPE on null Integer | Unsafe | Primitive wrappers |

    ```java
    int num = 42;
    Object obj = null;

    String.valueOf(num);              // "42" -- null-safe (returns "null" for null)
    String.valueOf(obj);              // "null" (not NPE)
    Integer.toString(num);            // "42" -- NPE if called on null Integer
    "" + num;                         // "42" -- null-safe, invokes String.valueOf
    Objects.toString(obj, "default"); // "default" -- null-safe with custom fallback
    String.format("%d", num);         // "42" -- formatted, slowest

    // For arrays -- common mistake
    int[] arr = {1, 2, 3};
    String.valueOf(arr);              // "[I@7852e922" (useless!)
    Arrays.toString(arr);             // "[1, 2, 3]" (correct)
    ```

    **Best practices:**

    - **Default choice:** `String.valueOf()` -- handles null, works for all types
    - **With fallback:** `Objects.toString(obj, "N/A")` -- useful for config display
    - **Known non-null:** `obj.toString()` -- direct, fast, fail-fast on null
    - **Primitives:** `Integer.toString(n)`, `Double.toString(d)` -- avoids boxing

    **Key gotchas:**

    - `String.valueOf(char[])` is special -- it creates a String from the chars, not `"[C@hash"`
    - `(String) obj` is a cast, not a conversion -- throws `ClassCastException` if obj is not a String
    - Concatenation `"" + obj` creates a StringBuilder in Java 5-8 (slight overhead), optimized in Java 9+
    - For logging, prefer SLF4J's `{}` placeholders over any conversion -- they defer computation until the log level is enabled

---

??? question "Q24: What are the different ways to compare Strings?"

    **Answer:** Java provides multiple string comparison methods for different needs: content equality, case-insensitive equality, lexicographic ordering, null-safe comparison, and partial/region matching.

    **Why multiple methods exist:** Different use cases demand different comparison semantics. Sorting requires ordering (compareTo), search needs case-insensitivity (equalsIgnoreCase), null-safe code needs Objects.equals, and substring matching needs regionMatches.

    **Complete comparison toolkit:**

    ```java
    String a = "Hello", b = "hello";

    // Content equality
    a.equals(b);              // false -- case-sensitive, the standard check
    a.equalsIgnoreCase(b);    // true  -- locale-independent case folding

    // Lexicographic ordering (for sorting)
    a.compareTo(b);           // negative ('H' < 'h' in Unicode)
    a.compareToIgnoreCase(b); // 0 (equal ignoring case)

    // CharSequence compatibility
    a.contentEquals(new StringBuilder("Hello")); // true -- works across types

    // Region/substring comparison without creating substrings
    "Hello World".regionMatches(true, 6, "WORLD", 0, 5); // true (ignoreCase=true)

    // Null-safe comparison
    Objects.equals(a, null); // false (no NPE!)
    Objects.equals(null, null); // true

    // Prefix/suffix matching
    "Hello World".startsWith("Hello");  // true
    "Hello World".endsWith("World");    // true
    "Hello World".contains("lo Wo");    // true
    ```

    **Choosing the right method:**

    - **Exact match:** `equals()` -- always use this over `==`
    - **Case-insensitive match:** `equalsIgnoreCase()` for simple cases; `Collator` for locale-aware comparison
    - **Sorting:** `compareTo()` for natural order; `Comparator.compareToIgnoreCase()` for case-insensitive sort
    - **Null-safe:** `Objects.equals()` or `"literal".equals(variable)`
    - **Performance-sensitive substring check:** `regionMatches()` avoids creating intermediate substring objects

    **Key gotchas:**

    - `equalsIgnoreCase()` uses simple Unicode case folding -- not locale-aware. For Turkish, German (sharp-s), etc., use `Collator`
    - `compareTo()` returns negative/zero/positive, not -1/0/1 specifically -- never compare with `== -1`
    - `contentEquals(CharSequence)` is the only way to compare String with StringBuilder without calling `toString()`
    - Comparing with `==` after `intern()` is valid but couples your code to interning discipline -- fragile

---

??? question "Q25: How do you tokenize/split Strings in Java?"

    **Answer:** Java provides multiple tokenization strategies ranging from regex-based `split()` to the legacy `StringTokenizer`, the stream-friendly `Pattern.splitAsStream()`, and typed parsing via `Scanner`. The right choice depends on your performance and feature needs.

    **Why multiple approaches exist:** `split()` is the most common but compiles a regex on every call. `StringTokenizer` is legacy but faster for simple delimiters. `Pattern.splitAsStream()` integrates with streams and pre-compiles. `Scanner` adds type-aware parsing.

    ```java
    String csv = "Java,Python,,Go";

    // split() -- regex-based, default choice
    csv.split(",");    // ["Java", "Python", "", "Go"] -- keeps empty tokens
    csv.split(",", 3); // ["Java", "Python", ",Go"] -- limit controls max splits
    csv.split(",", -1);// ["Java", "Python", "", "Go"] -- negative keeps trailing empties

    // StringTokenizer -- legacy (Java 1.0), skips empty tokens
    StringTokenizer st = new StringTokenizer(csv, ",");
    while (st.hasMoreTokens()) st.nextToken(); // Java, Python, Go (no empty!)

    // Pattern.splitAsStream() -- precompiled regex + stream pipeline
    Pattern comma = Pattern.compile(",");
    comma.splitAsStream(csv)
        .filter(s -> !s.isEmpty())
        .map(String::trim)
        .toList(); // [Java, Python, Go]

    // Scanner -- typed parsing from mixed-format input
    Scanner sc = new Scanner("42 hello 3.14");
    int i = sc.nextInt();       // 42
    String s = sc.next();       // "hello"
    double d = sc.nextDouble(); // 3.14
    ```

    **Performance considerations:**

    - `split(regex)` compiles the pattern on every call unless the JVM caches single-char patterns (it does for common cases like `,`, `.` in some implementations)
    - For hot paths, pre-compile: `private static final Pattern COMMA = Pattern.compile(",");`
    - `StringTokenizer` avoids regex overhead but lacks stream support and empty-token handling
    - For simple single-character splits, `split()` is internally optimized (no regex engine)

    **Key gotchas:**

    - `"a.b.c".split(".")` returns empty array! `.` is regex for "any character" -- use `split("\\.")`
    - `split()` with no limit discards trailing empty strings: `"a,,".split(",")` gives `["a", ""]` (not 3 elements)
    - `split()` with limit `-1` preserves all trailing empties
    - `StringTokenizer` is not deprecated but is considered legacy -- prefer `split()` or `Pattern` in new code
    - For CSV parsing, use a proper library (Apache Commons CSV, OpenCSV) -- edge cases with quotes and escaping are brutal

---

??? question "Q26: How do regular expressions work with String methods?"

    **Answer:** String provides three regex-powered methods (`matches()`, `replaceAll()`, `replaceFirst()`) that compile a `Pattern` on every call. For repeated use, pre-compiling a `Pattern` and using a `Matcher` gives 10-100x better performance.

    **Why this matters:** Regex is powerful but expensive. Knowing when to use String convenience methods vs. `Pattern`/`Matcher` separates juniors from seniors in interviews.

    **The three String regex methods:**

    ```java
    // matches() -- tests the ENTIRE string against the pattern
    "hello123".matches("[a-z]+\\d+"); // true (full match)
    "hello123!".matches("[a-z]+\\d+"); // false (trailing ! doesn't match)

    // replaceAll() -- replaces every match
    "Hello   World".replaceAll("\\s+", " "); // "Hello World"

    // replaceFirst() -- replaces only the first match
    "aabbcc".replaceFirst("b+", "X");        // "aaXcc"
    ```

    **Pre-compiled Pattern for performance (the production approach):**

    ```java
    // Compile once, reuse everywhere
    private static final Pattern DATE_PATTERN =
        Pattern.compile("(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})");

    Matcher m = DATE_PATTERN.matcher("2024-06-15");
    if (m.matches()) {
        String year = m.group("year");   // "2024"
        String month = m.group("month"); // "06"
        String day = m.group("day");     // "15"
    }

    // find() for partial matching (unlike matches() which requires full match)
    Matcher finder = Pattern.compile("\\d+").matcher("abc 123 def 456");
    while (finder.find()) {
        System.out.println(finder.group()); // "123", then "456"
    }
    ```

    **Critical differences:**

    - `matches()` requires the ENTIRE string to match (implicit `^...$`)
    - `Matcher.find()` finds the pattern anywhere in the string
    - `Matcher.lookingAt()` matches from the beginning but does not require full match

    **Key gotchas:**

    - `matches()` is NOT `contains()` -- `"hello123".matches("\\d+")` is FALSE because "hello" does not match
    - Never pass user input directly as a regex pattern -- use `Pattern.quote(userInput)` to escape
    - `replaceAll("$", "x")` uses `$` as a regex anchor, not literal. Use `Matcher.quoteReplacement()` for literals
    - Catastrophic backtracking: patterns like `(a+)+b` on non-matching input can hang -- always test regex with adversarial input
    - `String.matches()` compiles a new Pattern per call -- in a loop, this is devastating for performance

---

??? question "Q27: How does StringBuilder capacity and expansion work?"

    **Answer:** StringBuilder maintains an internal `byte[]` (or `char[]` pre-Java 9) with a capacity that is initially 16 (default constructor). When an append exceeds capacity, the array is expanded to `(currentCapacity + 1) * 2`, and the contents are copied to the new array.

    **Why this matters:** Understanding capacity management lets you pre-size the buffer to avoid costly array copies. In high-throughput code, a single pre-sized `new StringBuilder(estimatedSize)` can eliminate multiple reallocations.

    **How expansion works internally:**

    1. Default capacity: 16 characters
    2. With initial string: `string.length() + 16`
    3. With explicit capacity: exactly what you specify
    4. Expansion formula: `max(minCapacity, (oldCapacity + 1) * 2)`
    5. Each expansion triggers `Arrays.copyOf()` -- O(n) operation

    ```java
    StringBuilder sb = new StringBuilder();       // capacity = 16
    new StringBuilder("hello").capacity();        // 21 (5 + 16)
    new StringBuilder(100).capacity();            // 100

    // Expansion in action
    StringBuilder sb2 = new StringBuilder(4);    // capacity = 4
    sb2.append("hello");                         // needs 5 -> expands to (4+1)*2 = 10
    sb2.append("world");                         // needs 10 -> fits exactly
    sb2.append("!");                             // needs 11 -> expands to (10+1)*2 = 22

    // Shrink to actual size (useful after building is complete)
    sb2.trimToSize();                            // capacity reduced to match length
    ```

    **Performance optimization tips:**

    ```java
    // Bad -- multiple expansions and array copies
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < 10000; i++) sb.append(someString);

    // Good -- pre-sized, zero or minimal expansions
    StringBuilder sb = new StringBuilder(estimatedTotalLength);
    for (int i = 0; i < 10000; i++) sb.append(someString);
    ```

    **Common follow-up -- "What happens with ensureCapacity()?"**
    You can manually trigger expansion: `sb.ensureCapacity(500)` -- guarantees at least 500 capacity. Useful when you know a large append is coming.

    **Key gotchas:**

    - Default capacity of 16 is almost always too small for real use -- always estimate and pre-size
    - Each expansion copies the ENTIRE existing content to a new array -- O(n) per expansion
    - Total cost of k expansions from capacity 16 to final size n: O(n) amortized, but with k array allocations and copies
    - `trimToSize()` is useful before long-lived storage but triggers yet another copy
    - Java 9+ Compact Strings mean the internal buffer is `byte[]` -- Latin1 strings use half the memory per character

---

??? question "Q28: What is the CharSequence interface?"

    **Answer:** `CharSequence` is the foundational interface for all character-based sequences in Java -- implemented by `String`, `StringBuilder`, `StringBuffer`, and `CharBuffer`. It defines the read-only contract for accessing a sequence of characters.

    **Why it exists:** It enables polymorphism across different string implementations. APIs that accept `CharSequence` parameters work with any implementation without coupling to a specific class. This is the Interface Segregation Principle in action.

    **The interface contract (key methods):**

    - `length()` -- number of chars
    - `charAt(int index)` -- char at position
    - `subSequence(int start, int end)` -- sub-view
    - `toString()` -- convert to String
    - `chars()` (Java 8+) -- IntStream of char values
    - `codePoints()` (Java 8+) -- IntStream of Unicode code points
    - `isEmpty()` (Java 15+) -- default method, checks `length() == 0`

    ```java
    // Design APIs with CharSequence for maximum flexibility
    public boolean isValidEmail(CharSequence input) {
        return Pattern.matches("[^@]+@[^@]+\\.[^@]+", input);
    }

    // Works with any implementation
    isValidEmail("user@example.com");                    // String
    isValidEmail(new StringBuilder("user@example.com")); // StringBuilder

    // Pattern/Matcher accepts CharSequence
    Pattern p = Pattern.compile("\\d+");
    p.matcher(someStringBuilder);  // no toString() needed

    // Stream operations on characters
    "hello".chars().filter(c -> c != 'l').forEach(c -> System.out.print((char) c));
    // prints "heo"

    // Code point stream -- proper Unicode handling
    "hello😀".codePoints().count(); // 6 (emoji is 1 code point, 2 chars)
    ```

    **Design guideline:**

    - **Accept** `CharSequence` in method parameters -- maximizes caller flexibility
    - **Return** `String` from methods -- provides immutability guarantee to callers
    - This mirrors how the JDK itself is designed (e.g., `Pattern.matcher(CharSequence)`)

    **Key gotchas:**

    - `CharSequence` does NOT guarantee immutability -- a `StringBuilder` passed as `CharSequence` can be modified by another thread
    - `CharSequence.equals()` is NOT overridden by the interface -- comparing a String and StringBuilder via `equals()` returns false. Use `contentEquals()` instead.
    - `chars()` returns an `IntStream`, not a `Stream<Character>` -- you need to cast: `(char) c`
    - `subSequence()` behaves differently across implementations -- String returns a new String, StringBuilder returns a String (not a view)

---

??? question "Q29: What is String Deduplication in G1 GC?"

    **Answer:** String Deduplication is a G1 GC feature (Java 8u20+) that automatically identifies String objects on the heap with identical content and makes them share the same internal `byte[]` array -- reducing memory without any code changes.

    **Why it exists:** Studies show 25-30% of live heap in typical Java applications consists of String objects, and roughly half of those are duplicates. Unlike `intern()`, which requires code changes and has API implications, GC-based deduplication is transparent and safe.

    **How it works internally:**

    1. During young GC, the collector identifies String objects that have survived a configurable number of collections (age threshold)
    2. It hashes their content and checks a deduplication table
    3. If a match is found, it redirects the new String's `value` field to point to the existing `byte[]`
    4. The original `byte[]` becomes unreachable and is eventually collected
    5. The String objects themselves remain separate -- only the backing arrays are shared

    ```bash
    java -XX:+UseG1GC -XX:+UseStringDeduplication \
         -XX:StringDeduplicationAgeThreshold=3 MyApp
    ```

    | Feature          | `intern()`           | String Deduplication    |
    |------------------|----------------------|-------------------------|
    | Triggered by     | Developer code       | GC automatically        |
    | Shares           | Entire String object | Internal byte[] only    |
    | `==` works?      | Yes                  | No (separate objects)   |
    | Overhead         | Lock contention      | GC pause extension      |
    | Code changes     | Required             | None (JVM flag only)    |

    **When to use:**

    - Applications with large heaps containing many duplicate strings (JSON/XML parsing, ETL pipelines, report generation)
    - When you cannot modify code to call `intern()`
    - Long-lived String data (caches, in-memory databases)

    **When NOT to use:**

    - Applications with mostly unique strings (no dedup benefit)
    - Latency-sensitive apps where extended GC pauses are unacceptable
    - Non-G1 collectors (ZGC and Shenandoah do not support it as of Java 17)

    **Key gotchas:**

    - Only works with G1 GC (default since Java 9) -- not with Parallel, ZGC, or Shenandoah
    - Extends GC pause time slightly (deduplication work happens during GC)
    - The dedup table itself consumes memory -- minimal for most apps but non-zero
    - Monitor effectiveness with `-XX:+PrintStringDeduplicationStatistics` (pre-Java 9) or JFR events
    - Java 18+ introduced dedup support for ZGC as well (JEP experimental)

---

??? question "Q30: Common String coding problems (reverse, palindrome, anagram, permutations)?"

    **Answer:** These four problems form the core of string-based coding interviews. Each tests different algorithmic concepts: in-place manipulation, two-pointer technique, frequency counting, and backtracking/recursion.

    **Why interviewers ask these:** They test your ability to work with character arrays, understand time/space complexity tradeoffs, and write clean bug-free code under pressure.

    **1. String Reversal** -- tests basic string manipulation

    ```java
    // Using StringBuilder (simplest)
    public static String reverse(String s) {
        return new StringBuilder(s).reverse().toString();
    }

    // Two-pointer approach (often required in interviews)
    public static String reverseManual(String s) {
        char[] chars = s.toCharArray();
        int left = 0, right = chars.length - 1;
        while (left < right) {
            char temp = chars[left];
            chars[left++] = chars[right];
            chars[right--] = temp;
        }
        return new String(chars);
    }
    ```

    **2. Palindrome Check** -- tests two-pointer and string cleaning

    ```java
    public static boolean isPalindrome(String s) {
        String clean = s.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
        int left = 0, right = clean.length() - 1;
        while (left < right) {
            if (clean.charAt(left++) != clean.charAt(right--)) return false;
        }
        return true;
    }
    ```

    **3. Anagram Check** -- tests frequency counting (O(n) time, O(1) space)

    ```java
    public static boolean isAnagram(String a, String b) {
        if (a.length() != b.length()) return false;
        int[] freq = new int[26]; // O(1) space -- fixed size
        for (char c : a.toLowerCase().toCharArray()) freq[c - 'a']++;
        for (char c : b.toLowerCase().toCharArray()) freq[c - 'a']--;
        for (int f : freq) if (f != 0) return false;
        return true;
    }
    ```

    **4. Permutations** -- tests backtracking (O(n * n!) time)

    ```java
    public static List<String> permute(String s) {
        List<String> result = new ArrayList<>();
        backtrack(s.toCharArray(), 0, result);
        return result;
    }

    private static void backtrack(char[] ch, int idx, List<String> res) {
        if (idx == ch.length - 1) { res.add(new String(ch)); return; }
        Set<Character> seen = new HashSet<>(); // skip duplicates
        for (int i = idx; i < ch.length; i++) {
            if (seen.add(ch[i])) { // only process unique chars at this position
                swap(ch, idx, i);
                backtrack(ch, idx + 1, res);
                swap(ch, idx, i); // backtrack
            }
        }
    }

    private static void swap(char[] ch, int i, int j) {
        char temp = ch[i]; ch[i] = ch[j]; ch[j] = temp;
    }
    ```

    **Complexity summary:**

    | Problem      | Time      | Space | Key Technique          |
    |--------------|-----------|-------|------------------------|
    | Reverse      | O(n)      | O(n)  | Two pointers           |
    | Palindrome   | O(n)      | O(n)  | Two pointers + clean   |
    | Anagram      | O(n)      | O(1)  | Frequency array        |
    | Permutations | O(n * n!) | O(n!) | Backtracking + swap    |

    **Key gotchas:**

    - Palindrome: always clarify if spaces/punctuation count and if it is case-sensitive
    - Anagram: the `int[26]` trick only works for lowercase English -- for Unicode, use a `HashMap<Character, Integer>`
    - Permutations: without the `seen` set, duplicate characters produce duplicate permutations
    - Reverse: `StringBuilder.reverse()` handles surrogate pairs correctly -- manual swap does not
