# Top 40 Java Collections Interview Questions & Answers

---

??? question "Q1: What is the Java Collections Framework hierarchy?"

    The Java Collections Framework has two root interfaces -- `Collection` (for groups of elements) and `Map` (for key-value pairs) -- each branching into specialized sub-interfaces with concrete implementations.

    **Why:** Interviewers ask this to verify you understand the design philosophy: program to interfaces, not implementations. Knowing the hierarchy helps you pick the right data structure and understand polymorphism across collections.

    **How:** `Collection` extends `Iterable` and splits into three sub-interfaces:

    - **List** -- ordered, allows duplicates. Implementations: `ArrayList`, `LinkedList`, `Vector`.
    - **Set** -- no duplicates. Implementations: `HashSet`, `LinkedHashSet`, `TreeSet`.
    - **Queue/Deque** -- FIFO/priority ordering. Implementations: `PriorityQueue`, `ArrayDeque`.

    **Map** is a separate hierarchy (does not extend `Collection`) because it stores mappings, not individual elements.

    ```
    Iterable
      └── Collection
            ├── List  (ArrayList, LinkedList, Vector)
            ├── Set   (HashSet, LinkedHashSet, TreeSet)
            └── Queue (PriorityQueue, ArrayDeque)
                  └── Deque (ArrayDeque, LinkedList)

    Map (HashMap, TreeMap, LinkedHashMap, ConcurrentHashMap)
    ```

    **When to use:** Choose `List` when order and duplicates matter, `Set` for uniqueness constraints, `Queue/Deque` for producer-consumer or stack patterns, and `Map` for associative lookups.

    **Gotchas:**

    - `Map` is NOT a `Collection` -- do not confuse the two hierarchies.
    - `LinkedList` implements both `List` and `Deque`, making it versatile but often misused.
    - `Vector`, `Hashtable`, and `Stack` are legacy classes -- prefer their modern equivalents.
    - Interfaces like `NavigableMap` and `NavigableSet` add closest-match navigation on top of sorted collections.

??? question "Q2: ArrayList vs LinkedList -- what are the internal differences and when should you use each?"

    `ArrayList` is backed by a contiguous resizable array with O(1) random access, while `LinkedList` is a doubly-linked list with O(1) insertion/removal at known positions but O(n) access.

    **Why:** This is a foundational question that tests understanding of data structure trade-offs, memory layout, and CPU cache behavior -- concepts critical for writing performant code.

    **How:**

    - `ArrayList` stores elements in a contiguous `Object[]`. Access by index is a direct array offset calculation. Insertions/removals in the middle require shifting all subsequent elements via `System.arraycopy()`.
    - `LinkedList` allocates a `Node` object per element (with `prev`, `next`, and `item` fields). Traversal requires pointer-chasing through heap-scattered nodes.

    | Operation | ArrayList | LinkedList |
    |-----------|-----------|------------|
    | `get(index)` | O(1) | O(n) |
    | `add(end)` | O(1) amortized | O(1) |
    | `add(middle)` | O(n) | O(1) if at iterator position |
    | `remove(middle)` | O(n) | O(1) if at iterator position |
    | Memory per element | ~4 bytes (reference) | ~24 bytes (Node object) |
    | CPU cache locality | Excellent | Poor |
    | Iterator `remove()` | O(n) shift | O(1) unlink |

    **When to use:**

    - **ArrayList** (95% of the time): sequential/random reads, iteration, bulk operations. Its cache-friendliness dominates even when big-O says LinkedList should win.
    - **LinkedList**: frequent insertions/removals at the head, need a `Deque` without null restrictions, or constant-time splicing during iteration.

    **Gotchas:**

    - LinkedList's O(1) insert advantage only applies when you already hold an iterator at the position; finding the position is still O(n).
    - LinkedList uses 6x more memory per element due to Node overhead and pointer fields.
    - In benchmarks, ArrayList beats LinkedList for almost all real workloads up to millions of elements because of CPU prefetching and L1/L2 cache effects.

??? question "Q3: How does ArrayList resize internally?"

    `ArrayList` starts with a default capacity of 10 and grows by 50% (factor 1.5x) each time the internal array is full, copying elements to a new larger array via `Arrays.copyOf()`.

    **Why:** Interviewers ask this to test knowledge of amortized analysis and to see if you can optimize memory usage in production code by pre-sizing collections.

    **How:**

    1. When `size == elementData.length`, the `grow()` method is triggered.
    2. New capacity is calculated: `newCapacity = oldCapacity + (oldCapacity >> 1)` (i.e., 1.5x).
    3. A new `Object[]` of the new capacity is allocated.
    4. `Arrays.copyOf()` (which internally uses `System.arraycopy()`) copies all existing elements to the new array.
    5. The old array becomes eligible for GC.

    ```
    Capacity progression: 10 → 15 → 22 → 33 → 49 → 73 → 109 → ...
    ```

    The amortized cost of `add()` remains O(1) because each element is copied at most O(log n) times across all resizes, and the geometric series converges.

    ```java
    // Pre-size to avoid resizing for known sizes
    List<String> list = new ArrayList<>(10_000);

    // Expand capacity later without resizing repeatedly
    ((ArrayList<String>) list).ensureCapacity(50_000);

    // Reclaim unused capacity after bulk removals
    ((ArrayList<String>) list).trimToSize();
    ```

    **When to use:** Always specify initial capacity when you know (or can estimate) the final size -- especially in tight loops or when building large lists from database results.

    **Gotchas:**

    - The default empty-arg constructor creates an empty array (not size 10) until the first `add()` -- a lazy optimization since Java 8.
    - Growth factor of 1.5x (not 2x like `Vector`) wastes less memory but triggers slightly more copies.
    - After `clear()`, the internal array retains its full capacity. Use `trimToSize()` or reassign to free memory.
    - `ensureCapacity(0)` is a no-op; you must pass a value larger than the current capacity for it to take effect.

??? question "Q4: How does HashMap work internally?"

    `HashMap` uses an array of buckets (default 16, always power of 2) where each bucket holds a linked list that converts to a red-black tree when it reaches 8 entries (Java 8+).

    **Why:** This is arguably the most important collections question. It tests understanding of hashing, collision resolution, amortized complexity, and Java-specific optimizations that distinguish a senior engineer.

    **How:**

    - **Hash perturbation:** `hash = key.hashCode() ^ (key.hashCode() >>> 16)` -- XORs the upper 16 bits into the lower 16 bits to reduce collisions when capacity is small and only lower bits determine the bucket.
    - **Bucket index:** `i = hash & (capacity - 1)` -- bitwise AND acts as fast modulo because capacity is always a power of 2.
    - **Node structure:** Each node stores `hash`, `key`, `value`, and `next` pointer (or left/right/parent for tree nodes).
    - **Load factor:** Default 0.75. When `size > capacity * loadFactor`, the table doubles and all entries are redistributed.
    - **Treeification:** At 8 entries in one bucket AND table size >= 64, the linked list converts to a red-black tree (O(log n) lookup). Untreeifies back at 6 entries.

    ```
    Bucket Array (length = 16)
    [0] → null
    [1] → Node("key1", hash=1) → Node("key17", hash=1) → null
    [2] → TreeNode (red-black tree if 8+ collisions)
    ...
    [15] → null
    ```

    **When to use:** HashMap is the default choice for key-value lookups when you need O(1) average-case performance and do not need ordering or thread safety.

    **Gotchas:**

    - Power-of-2 sizing means poor `hashCode()` implementations (e.g., returning constants) degrade to O(n) linked-list traversal.
    - Resizing rehashes ALL entries -- a single `put()` can take O(n) time when it triggers a resize.
    - Treeification requires keys to implement `Comparable`; otherwise tree nodes fall back to `identityHashCode` comparison, which is less predictable.
    - `null` key is always stored in bucket 0 (special-cased in the hash function).

??? question "Q5: Walk through how put() and get() work in HashMap."

    `put()` computes the hash, locates the bucket, and either inserts a new node or replaces an existing one; `get()` computes the hash, locates the bucket, and traverses the chain/tree to find the matching key.

    **Why:** This question tests whether you truly understand HashMap internals at the algorithmic level -- not just "O(1) average" but the exact sequence of operations, which matters for debugging performance issues.

    **How:**

    **`put(key, value)` step-by-step:**

    1. Compute `hash = key.hashCode() ^ (key.hashCode() >>> 16)` -- perturbation spreads upper bits into lower bits.
    2. Find bucket index: `i = hash & (n - 1)` where `n` is the table length.
    3. If `table[i] == null`, insert a new `Node(hash, key, value, null)` directly.
    4. If the bucket is occupied, iterate the chain/tree:
        - Compare each node: first check `hash ==`, then `key == || key.equals(existingKey)`.
        - If match found, replace the value and return the old value.
        - Otherwise, append a new node at the tail (tail-insertion since Java 8; Java 7 used head-insertion which caused infinite loops during concurrent resize).
    5. If chain length reaches **8** and table size >= 64, treeify the bucket into a red-black tree.
    6. Increment `size` and `modCount`. If `size > threshold` (capacity * loadFactor), call `resize()` to double the table.

    **`get(key)` step-by-step:**

    1. Compute hash and bucket index.
    2. Check the first node -- if hash matches and `equals()` returns true, return its value immediately (fast path for single-node buckets).
    3. If first node has a `next`, check if it is a `TreeNode` -- if so, perform red-black tree search O(log n).
    4. Otherwise, traverse the linked list until match or null.

    **When to use:** Understanding this flow helps you write proper `hashCode()`/`equals()` methods and debug issues like "put works but get returns null."

    **Gotchas:**

    - Java 8 switched from head-insertion to tail-insertion to prevent infinite loops during concurrent resize (a notorious Java 7 bug).
    - `get(null)` is special-cased -- hash of null is 0, so null keys always go to bucket 0.
    - Both `hashCode()` AND `equals()` are called during lookup -- a mismatch between them causes silent failures.
    - `modCount` is incremented on structural changes, enabling fail-fast iteration.

??? question "Q6: What happens when two keys have the same hashCode in a HashMap?"

    When two keys produce the same hash (a collision), they are stored in the same bucket as a linked list; if the bucket grows to 8+ entries, it converts to a red-black tree for O(log n) lookup.

    **Why:** Collision handling is the core challenge of hash-based structures. Interviewers test this to see if you understand worst-case behavior, security implications (HashDoS attacks), and how Java 8 mitigated the problem.

    **How:**

    1. Both keys compute the same `hash & (capacity - 1)`, landing in the same bucket.
    2. They are stored as a linked list (chaining strategy) -- each `Node` has a `next` pointer.
    3. On `get()`, the bucket is traversed comparing `hash` first (fast integer compare), then `equals()` (potentially expensive object compare).
    4. **Treeification (Java 8+):** When bucket size reaches 8 AND table capacity >= 64, the list converts to a red-black tree (`TreeNode`).
    5. **Untreeification:** When bucket size drops below 6 (on removal), the tree reverts to a linked list.

    | Bucket state | Lookup complexity | Condition |
    |-------------|------------------|-----------|
    | Linked list | O(n) | < 8 entries |
    | Red-black tree | O(log n) | >= 8 entries, table >= 64 |
    | Resize instead | -- | >= 8 entries, table < 64 |

    **When to use:** Understanding this helps you write good `hashCode()` methods that distribute keys evenly across buckets.

    **Gotchas:**

    - Treeification requires keys to implement `Comparable`; without it, Java uses `System.identityHashCode()` as a tiebreaker, which provides less balanced trees.
    - A deliberate HashDoS attack sends thousands of keys with the same hash to degrade HashMap to O(n). Treeification was added partly as a defense (limits damage to O(log n)).
    - The threshold of 8 was chosen based on Poisson distribution analysis -- with a load factor of 0.75, the probability of 8+ collisions in one bucket is less than 1 in 10 million under random hashing.
    - Even with treeification, massive collisions still consume extra memory for `TreeNode` (which has parent, left, right, prev pointers + color flag).

??? question "Q7: HashMap vs Hashtable vs ConcurrentHashMap -- what are the differences?"

    `HashMap` is unsynchronized and fastest for single-threaded use; `Hashtable` is a legacy fully-synchronized map; `ConcurrentHashMap` provides high-performance thread safety with fine-grained locking.

    **Why:** This question tests whether you know the evolution of concurrent maps in Java and can make the right choice for multi-threaded applications. Choosing `Hashtable` in a modern codebase is a red flag.

    **How:**

    | Feature | HashMap | Hashtable | ConcurrentHashMap |
    |---------|---------|-----------|-------------------|
    | Thread-safe | No | Yes (full sync) | Yes (per-bucket CAS/sync) |
    | Null keys/values | 1 null key, null values | Neither allowed | Neither allowed |
    | Performance | Fastest (single-thread) | Slow (global lock) | High concurrent throughput |
    | Iteration | Fail-fast | Fail-fast | Weakly consistent |
    | Lock granularity | N/A | Entire table | Per-bucket (Java 8+) |
    | Since | JDK 1.2 | JDK 1.0 | JDK 1.5 |

    - **Hashtable** locks the entire map on every operation -- even two `get()` calls from different threads block each other.
    - **ConcurrentHashMap** (Java 8+) uses CAS for empty-bucket inserts and `synchronized` only on the bucket head node, allowing N threads to operate on N different buckets simultaneously.

    **When to use:**

    - Single-threaded: `HashMap`
    - Multi-threaded: `ConcurrentHashMap` (always)
    - Never: `Hashtable` (legacy, kept only for backward compatibility)

    **Gotchas:**

    - `ConcurrentHashMap` does not allow null keys or values because `null` would be ambiguous -- does `get(key) == null` mean "key absent" or "value is null"?
    - `Collections.synchronizedMap(new HashMap<>())` is another option but still uses a single mutex -- worse than `ConcurrentHashMap` for concurrent reads.
    - `Hashtable`'s `Enumerator` is NOT fail-fast (unlike its `Iterator`), which can lead to inconsistent reads.
    - `ConcurrentHashMap.size()` is an estimate under concurrency; use `mappingCount()` for a `long` result on large maps.

??? question "Q8: How does ConcurrentHashMap achieve thread safety internally?"

    In Java 8+, `ConcurrentHashMap` uses CAS operations for empty-bucket inserts, `synchronized` on bucket head nodes for occupied buckets, and volatile reads for lock-free gets -- achieving per-bucket lock granularity.

    **Why:** This is a deep-dive question that separates candidates who memorized "it is thread-safe" from those who understand lock-free programming, CAS, and the evolution from segment-based locking.

    **How:**

    **Java 7 design (historical):**

    - Map divided into 16 `Segment` objects, each a mini-HashMap with its own `ReentrantLock`.
    - Reads used `volatile` fields (no lock); writes locked only the affected segment.
    - Maximum concurrency = number of segments (fixed at construction).

    **Java 8+ design (current):**

    - Segments removed entirely. The table is a `volatile Node[]`.
    - **Empty bucket insert:** Uses `Unsafe.compareAndSwapObject()` (CAS) -- no lock at all.
    - **Occupied bucket update:** `synchronized(headNode)` -- locks only that single bucket.
    - **Reads:** Always lock-free. `Node.val` and `Node.next` are `volatile`, ensuring visibility.
    - **Cooperative resizing:** When one thread triggers resize, other threads calling `put()` detect the resize-in-progress (`ForwardingNode` marker) and help transfer buckets, distributing the O(n) resize cost across threads.
    - **Counter:** Uses a `CounterCell[]` array (like `LongAdder`) to avoid contention on the size counter.

    **When to use:** Any multi-threaded scenario requiring a shared map. It is the de facto standard for concurrent key-value storage in Java.

    **Gotchas:**

    - Compound operations like "check-then-act" are NOT atomic by default -- use `computeIfAbsent()`, `merge()`, or `compute()` instead of `get()` + `put()`.
    - `size()` and `isEmpty()` are approximations under concurrency -- they reflect a point-in-time snapshot.
    - Iterators are weakly consistent: they reflect some (but not necessarily all) concurrent modifications.
    - The internal `TreeBin` uses a read-write lock (`lockState` field) separate from the bucket head sync, allowing concurrent reads even during tree restructuring.

??? question "Q9: Compare TreeMap, HashMap, and LinkedHashMap."

    `HashMap` offers O(1) with no ordering, `LinkedHashMap` adds insertion/access-order tracking at O(1), and `TreeMap` provides sorted-key ordering at O(log n) cost.

    **Why:** Interviewers want to see that you can pick the right Map implementation based on ordering requirements and performance constraints -- a frequent real-world design decision.

    **How:**

    | Feature | HashMap | LinkedHashMap | TreeMap |
    |---------|---------|--------------|---------|
    | Ordering | None | Insertion or access order | Sorted (natural/Comparator) |
    | get/put | O(1) avg | O(1) avg | O(log n) |
    | Null keys | 1 allowed | 1 allowed | Not allowed (if using natural order) |
    | Implements | Map | Map | NavigableMap, SortedMap |
    | Backing structure | Array + linked list/tree | HashMap + doubly-linked list | Red-black tree |
    | Extra memory | None | 2 extra pointers per entry (before/after) | left, right, parent, color per entry |

    - **LinkedHashMap** maintains a doubly-linked list threading through all entries, enabling predictable iteration order. With `accessOrder=true`, every `get()` moves the entry to the tail -- enabling LRU cache behavior.
    - **TreeMap** uses a self-balancing red-black tree, providing `floorKey()`, `ceilingKey()`, `subMap()`, `headMap()`, `tailMap()` for range queries.

    ```java
    // LRU Cache with LinkedHashMap (access-order mode)
    Map<K, V> lru = new LinkedHashMap<>(16, 0.75f, true) {
        protected boolean removeEldestEntry(Map.Entry<K, V> e) {
            return size() > MAX_SIZE;
        }
    };
    ```

    **When to use:**

    - **HashMap:** Default choice when you need fast lookups with no ordering requirement.
    - **LinkedHashMap:** When you need predictable iteration order (e.g., JSON serialization) or LRU cache behavior.
    - **TreeMap:** When you need sorted keys, range queries, or floor/ceiling operations.

    **Gotchas:**

    - `LinkedHashMap` with `accessOrder=true` modifies structure on `get()`, which means iteration during access throws `ConcurrentModificationException`.
    - `TreeMap` requires keys to be `Comparable` or a `Comparator` at construction -- otherwise `ClassCastException` at runtime.
    - `TreeMap.put(null)` throws `NullPointerException` (cannot compare null with `compareTo()`).
    - `LinkedHashMap` iteration is O(size), not O(capacity) -- unlike `HashMap` which iterates over all buckets.

??? question "Q10: How is HashSet implemented internally?"

    `HashSet` is simply a wrapper around a `HashMap` where each element is stored as a key with a shared dummy constant (`PRESENT`) as the value.

    **Why:** This question tests whether you understand the composition-over-inheritance design and realize that `HashSet` inherits all of `HashMap`'s performance characteristics, collision behavior, and resizing logic.

    **How:**

    ```java
    // Actual OpenJDK implementation (simplified)
    private transient HashMap<E, Object> map;
    private static final Object PRESENT = new Object();

    public HashSet() {
        map = new HashMap<>();
    }

    public boolean add(E e) {
        return map.put(e, PRESENT) == null; // returns true if key was new
    }

    public boolean contains(Object o) {
        return map.containsKey(o);
    }

    public boolean remove(Object o) {
        return map.remove(o) == PRESENT;
    }
    ```

    The same pattern applies to other Set implementations:

    | Set | Backed by |
    |-----|-----------|
    | `HashSet` | `HashMap` |
    | `LinkedHashSet` | `LinkedHashMap` |
    | `TreeSet` | `TreeMap` |

    **When to use:** `HashSet` is the default choice when you need O(1) uniqueness checks without ordering. Choose `LinkedHashSet` for insertion-ordered iteration and `TreeSet` for sorted iteration.

    **Gotchas:**

    - Every `HashSet` entry wastes memory on the dummy `PRESENT` value object (though there is only one instance shared across all entries, the `HashMap.Node` still stores a reference to it).
    - `HashSet`'s initial capacity and load factor are actually `HashMap`'s -- pass them through the `HashSet(int initialCapacity, float loadFactor)` constructor.
    - Serialization writes elements individually (not the backing map), so the dummy values are never serialized.
    - `HashSet` is not synchronized -- use `Collections.synchronizedSet()` or `ConcurrentHashMap.newKeySet()` for thread safety.

??? question "Q11: How does HashSet ensure uniqueness of elements?"

    `HashSet` delegates to `HashMap.put()`, which uses `hashCode()` to find the bucket and `equals()` to detect duplicates -- if an equal key already exists, the insertion is rejected.

    **Why:** This is a follow-up that probes whether you understand the `hashCode()`/`equals()` contract and what happens when custom objects are stored without proper overrides. It is one of the most common sources of bugs in production Java code.

    **How:**

    1. `hashSet.add(element)` calls `hashMap.put(element, PRESENT)`.
    2. HashMap computes `hash = element.hashCode() ^ (element.hashCode() >>> 16)`.
    3. Determines bucket: `index = hash & (capacity - 1)`.
    4. Traverses the bucket chain, for each node checking:
        - `node.hash == hash` (fast integer compare, filters most non-matches)
        - AND `(node.key == element || element.equals(node.key))` (identity or logical equality)
    5. If match found: `put()` returns the old value (non-null `PRESENT`), so `add()` returns `false` (duplicate).
    6. If no match: new node inserted, `put()` returns `null`, so `add()` returns `true` (unique element added).

    ```java
    // Broken: missing hashCode override
    class Person {
        String name;
        @Override public boolean equals(Object o) { return name.equals(((Person)o).name); }
        // hashCode() NOT overridden -- defaults to memory address
    }
    Set<Person> set = new HashSet<>();
    set.add(new Person("Alice"));
    set.add(new Person("Alice")); // BOTH added! Different hashCode → different bucket
    set.size(); // 2 -- uniqueness violated!
    ```

    **When to use:** Always override both `hashCode()` and `equals()` together when using custom objects in hash-based collections. Use IDE generation, `Objects.hash()`, or Java records (which auto-generate both).

    **Gotchas:**

    - If `hashCode()` is overridden but `equals()` is not: objects with the same hash but default reference-equality will be treated as different -- duplicates slip in.
    - If `equals()` is overridden but `hashCode()` is not: equal objects may land in different buckets -- `contains()` returns `false` for logically present elements.
    - Mutable fields used in `hashCode()`/`equals()` can cause "phantom" elements if modified after insertion (element becomes unreachable in its bucket).

??? question "Q12: What are the differences between Iterator, ListIterator, and Enumeration?"

    `Enumeration` is a legacy forward-only traversal interface; `Iterator` is its modern replacement with `remove()` support; `ListIterator` extends `Iterator` with bidirectional traversal, in-place modification, and index access.

    **Why:** This tests understanding of the evolution of Java's iteration abstractions and when each is appropriate. It also reveals whether you know about fail-fast behavior and the iterator-based safe removal pattern.

    **How:**

    | Feature | Enumeration | Iterator | ListIterator |
    |---------|-------------|----------|--------------|
    | Since | JDK 1.0 | JDK 1.2 | JDK 1.2 |
    | Direction | Forward only | Forward only | Bidirectional |
    | `remove()` | No | Yes | Yes |
    | `add()` | No | No | Yes |
    | `set()` | No | No | Yes |
    | Get index | No | No | `nextIndex()`, `previousIndex()` |
    | Fail-fast | No | Yes | Yes |
    | Works on | Vector, Hashtable | Any Collection | List only |

    ```java
    // ListIterator: bidirectional traversal with modification
    ListIterator<String> it = list.listIterator(list.size()); // start at end
    while (it.hasPrevious()) {
        String s = it.previous();
        if (s.equals("old")) it.set("new");   // replace in-place
        if (s.equals("remove")) it.remove();  // safe removal
    }
    it.add("inserted"); // inserts at current cursor position
    ```

    **When to use:**

    - **Iterator:** Default for any collection traversal with optional removal.
    - **ListIterator:** When you need backward traversal, in-place replacement, or insertion during iteration on a List.
    - **Enumeration:** Only when working with legacy APIs (`Vector`, `Hashtable`, `SequenceInputStream`).

    **Gotchas:**

    - `Iterator.remove()` can only be called once per `next()` call -- calling it twice throws `IllegalStateException`.
    - `ListIterator.set()` and `remove()` operate on the last element returned by `next()` or `previous()` -- calling them without a prior traversal method throws `IllegalStateException`.
    - `Enumeration` has no fail-fast guarantee -- concurrent modifications during enumeration lead to silent corruption.
    - Java 8 added `Iterator.forEachRemaining(Consumer)` for bulk processing of remaining elements.

??? question "Q13: What are fail-fast and fail-safe iterators?"

    Fail-fast iterators throw `ConcurrentModificationException` on structural modification detected via a `modCount` check; fail-safe (weakly consistent) iterators work on a snapshot or tolerate concurrent changes without throwing exceptions.

    **Why:** This is essential for writing correct multi-threaded code and avoiding `ConcurrentModificationException` -- one of the most common runtime errors in Java applications.

    **How:**

    **Fail-fast mechanism:**

    1. Each collection maintains an internal `modCount` counter, incremented on every structural modification (add, remove, clear).
    2. When an iterator is created, it captures the current `modCount` as `expectedModCount`.
    3. On every `next()` call, the iterator checks `modCount != expectedModCount` -- if true, throws `ConcurrentModificationException`.
    4. Note: this is a best-effort check, not a guaranteed concurrent access detector.

    **Fail-safe (weakly consistent) mechanism:**

    - `CopyOnWriteArrayList`: Iterator works on a snapshot of the array taken at iterator creation time. Writes create a new copy of the entire array.
    - `ConcurrentHashMap`: Iterator traverses the live table but tolerates concurrent modifications -- may or may not reflect changes made after creation.

    | Aspect | Fail-fast | Fail-safe / Weakly consistent |
    |--------|-----------|-------------------------------|
    | Collections | ArrayList, HashMap, HashSet | ConcurrentHashMap, CopyOnWriteArrayList |
    | Throws CME | Yes | Never |
    | Reflects live changes | N/A (aborts) | May or may not |
    | Memory overhead | None | Snapshot or copy |
    | Use case | Single-threaded or external sync | Concurrent access |

    ```java
    // Fail-fast -- throws ConcurrentModificationException
    for (String s : list) {
        list.remove(s); // BAD: modifies structure during iteration
    }

    // Safe removal with iterator
    Iterator<String> it = list.iterator();
    while (it.hasNext()) {
        if (it.next().equals("x")) it.remove(); // OK: uses iterator's own remove
    }

    // Fail-safe -- no exception
    ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();
    for (Map.Entry<String, Integer> e : map.entrySet()) {
        map.remove(e.getKey()); // OK: weakly consistent iterator
    }
    ```

    **When to use:** Use fail-fast collections for single-threaded scenarios (bugs surface quickly). Use concurrent collections when multiple threads access the collection simultaneously.

    **Gotchas:**

    - `ConcurrentModificationException` can occur in a single thread -- it is NOT just about multi-threading. A for-each loop calling `list.remove()` triggers it.
    - The fail-fast check is NOT guaranteed by the spec -- it is a "best effort" and should not be relied upon for correctness in concurrent code.
    - `CopyOnWriteArrayList` iterators never see modifications made after their creation -- stale reads are possible by design.
    - `removeIf()` (Java 8+) is internally optimized to avoid CME by deferring the `modCount` update.

??? question "Q14: Comparable vs Comparator -- when do you use each?"

    `Comparable` defines a single natural ordering inside the class itself via `compareTo()`; `Comparator` is an external, reusable strategy that enables multiple sort orders without modifying the class.

    **Why:** Sorting is fundamental, and interviewers want to see that you understand the Open/Closed Principle -- using `Comparator` lets you add new orderings without modifying existing classes, while `Comparable` establishes a default that collections like `TreeMap` rely on.

    **How:**

    | Aspect | Comparable | Comparator |
    |--------|-----------|------------|
    | Package | `java.lang` | `java.util` |
    | Method | `compareTo(T o)` | `compare(T o1, T o2)` |
    | Defined in | The class itself | External class/lambda |
    | Number of orderings | One (natural) | Unlimited |
    | Used by default in | `TreeMap`, `TreeSet`, `Collections.sort()` | Passed explicitly |
    | Modifies the class | Yes | No |

    ```java
    // Comparable -- single natural order baked into the class
    class Employee implements Comparable<Employee> {
        String name; double salary; int age;
        public int compareTo(Employee o) { return this.name.compareTo(o.name); }
    }

    // Comparator -- multiple external strategies, composable
    Comparator<Employee> bySalary = Comparator.comparingDouble(Employee::getSalary);
    Comparator<Employee> byAgeDesc = Comparator.comparingInt(Employee::getAge).reversed();
    Comparator<Employee> combined = bySalary.thenComparing(byAgeDesc);

    employees.sort(combined); // no class modification needed
    ```

    **When to use:**

    - **Comparable:** When there is a single, obvious natural ordering (e.g., `String` alphabetical, `Integer` numeric, `Date` chronological). Implement it in your domain class.
    - **Comparator:** When you need multiple sort orders, cannot modify the class, or need ad-hoc one-time sorting logic (lambdas make this trivial).

    **Gotchas:**

    - `compareTo()` must be consistent with `equals()` for correct behavior in `TreeSet`/`TreeMap` -- if `compareTo()` returns 0 but `equals()` returns false, `TreeSet` treats them as duplicates.
    - Avoid using subtraction for integer comparison (`a.age - b.age`) -- it can overflow. Use `Integer.compare(a, b)` instead.
    - `Comparator.naturalOrder()` and `Comparator.reverseOrder()` provide boxed-type comparators without a lambda.
    - `null` handling requires explicit `Comparator.nullsFirst()` or `nullsLast()` -- `Comparable.compareTo()` typically throws NPE on null.

??? question "Q15: How does Collections.sort() work internally?"

    `Collections.sort()` delegates to `List.sort()` which uses TimSort -- a hybrid merge sort/insertion sort algorithm that exploits existing order in data, achieving O(n) best case and O(n log n) worst case with stability.

    **Why:** Interviewers ask this to verify you know which sorting algorithm Java uses, why it was chosen (stability + adaptive performance), and the distinction between object sorting and primitive sorting.

    **How TimSort works:**

    1. **Find runs:** Scan the array for natural ascending/descending subsequences (runs). Reverse descending runs in-place.
    2. **Extend short runs:** If a run is shorter than `minRun` (typically 32-64, computed from array size), extend it using binary insertion sort (efficient for small arrays due to low overhead).
    3. **Merge runs:** Push runs onto a stack. Maintain invariants (similar to Fibonacci sequence) to balance merge sizes. Merge adjacent runs using a temporary buffer, with galloping mode to skip large already-sorted sections.

    | Property | TimSort (objects) | Dual-Pivot Quicksort (primitives) |
    |----------|----------|------|
    | Used for | `Collections.sort()`, `Arrays.sort(Object[])` | `Arrays.sort(int[])`, `Arrays.sort(double[])` |
    | Worst case | O(n log n) | O(n log n) |
    | Best case | **O(n)** (nearly sorted) | O(n log n) |
    | Space | O(n) | O(log n) |
    | Stable | Yes | No (stability irrelevant for primitives) |
    | Adaptive | Yes | No |

    **When to use:** You do not choose the algorithm -- Java picks it automatically. But understanding it helps you:

    - Know that re-sorting nearly-sorted data is cheap (O(n)).
    - Prefer `List.sort()` over `Collections.sort()` (avoids an extra method call and allows list-specific optimizations).
    - Use `Arrays.parallelSort()` for large arrays (uses ForkJoinPool + merge sort).

    **Gotchas:**

    - TimSort has a known edge case: the original implementation had a bug where the merge stack invariants could be violated for certain input sizes (fixed in Java 9).
    - `List.sort()` on an `ArrayList` dumps to an array, sorts, and copies back -- so there is an O(n) copy overhead.
    - Parallel sort (`Arrays.parallelSort()`) only parallelizes when `n > 8192`; below that it falls back to sequential TimSort.
    - The `Comparator` must be consistent (transitive) -- violating this can cause `IllegalArgumentException` ("Comparison method violates its general contract") in TimSort.

??? question "Q16: How does PriorityQueue work internally?"

    `PriorityQueue` is backed by a binary min-heap stored in a resizable array, guaranteeing that `peek()` and `poll()` always return the smallest element in O(1) and O(log n) respectively.

    **Why:** Priority queues are fundamental for scheduling, graph algorithms (Dijkstra, Prim), and task prioritization. Interviewers test whether you understand heap mechanics and the common pitfall of assuming iteration order is sorted.

    **How:**

    - The heap is stored in `Object[] queue` where for element at index `i`: parent is at `(i-1)/2`, left child at `2*i+1`, right child at `2*i+2`.
    - **Sift-up (on insert):** New element added at the end, then bubbled up by comparing with parent until heap property is restored.
    - **Sift-down (on poll):** Root removed, last element placed at root, then pushed down by comparing with the smaller child until heap property is restored.
    - Resizing: grows by 50% if capacity < 64, otherwise by 100%.

    | Operation | Complexity | Mechanism |
    |-----------|-----------|-----------|
    | `offer()`/`add()` | O(log n) | Append + sift up |
    | `poll()` | O(log n) | Remove root + sift down |
    | `peek()` | O(1) | Return `queue[0]` |
    | `remove(Object)` | O(n) | Linear search + sift |
    | `contains()` | O(n) | Linear scan |
    | `heapify` (build from collection) | O(n) | Bottom-up Floyd's algorithm |

    ```java
    // Max-heap using reversed comparator
    PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());
    maxHeap.offer(3); maxHeap.offer(1); maxHeap.offer(5);
    maxHeap.poll(); // returns 5

    // Custom priority for tasks
    PriorityQueue<Task> tasks = new PriorityQueue<>(
        Comparator.comparingInt(Task::getPriority)
            .thenComparing(Task::getCreatedAt)
    );
    ```

    **When to use:** Task schedulers, event-driven simulations, finding top-K elements, merge-K-sorted-lists, Dijkstra's algorithm, median-finding with two heaps.

    **Gotchas:**

    - **Iteration order is NOT sorted** -- the heap property only guarantees the root is the minimum. Iterating via `for-each` or `iterator()` gives elements in arbitrary order. Only repeated `poll()` yields sorted order.
    - Not thread-safe -- use `PriorityBlockingQueue` for concurrent producer-consumer patterns.
    - Does not permit `null` elements.
    - If you modify an element's priority after insertion, the heap does not automatically re-heapify. You must `remove()` and `add()` again (O(n) + O(log n)).

??? question "Q17: ArrayDeque vs LinkedList as a Deque -- which is better?"

    `ArrayDeque` is almost always better -- it uses a circular resizable array with excellent cache locality and lower memory overhead, making it 2-3x faster than `LinkedList` for both stack and queue operations.

    **Why:** This tests practical performance awareness. Many developers default to `LinkedList` for queues/stacks without realizing `ArrayDeque` dominates in virtually every benchmark due to modern CPU cache architecture.

    **How:**

    - **ArrayDeque** maintains a circular buffer with `head` and `tail` pointers. Push/pop at either end is a simple index increment/decrement with wraparound. When full, it doubles the array and copies elements.
    - **LinkedList** allocates a `Node` object (prev + next + item = 24 bytes overhead) for each element, scattered across the heap.

    | Aspect | ArrayDeque | LinkedList |
    |--------|-----------|------------|
    | Backing | Circular resizable array | Doubly-linked nodes |
    | Cache locality | Excellent (contiguous) | Poor (pointer chasing) |
    | Memory per element | ~4 bytes (reference) | ~24 bytes (Node) |
    | Null elements | Not allowed | Allowed |
    | Implements List | No | Yes |
    | Push/pop ends | Amortized O(1) | O(1) |
    | Constant factor | Very low | High (allocation + GC pressure) |
    | GC pressure | Low (one array) | High (one object per element) |

    ```java
    // Stack usage (LIFO) -- prefer ArrayDeque
    Deque<Integer> stack = new ArrayDeque<>();
    stack.push(1); stack.push(2);
    stack.pop(); // 2

    // Queue usage (FIFO) -- prefer ArrayDeque
    Deque<String> queue = new ArrayDeque<>();
    queue.offer("first"); queue.offer("second");
    queue.poll(); // "first"
    ```

    **When to use:**

    - **ArrayDeque:** Default choice for stack, queue, or deque patterns (Java docs explicitly recommend it).
    - **LinkedList:** Only when you need `null` elements, need the `List` interface for indexed access, or need constant-time removal during iteration (rare).

    **Gotchas:**

    - `ArrayDeque` does NOT allow `null` -- `null` is used internally as an empty-slot sentinel. Adding null throws `NullPointerException`.
    - `ArrayDeque` is not thread-safe; use `ConcurrentLinkedDeque` or `LinkedBlockingDeque` for concurrent access.
    - Initial capacity defaults to 16; for known sizes, pass initial capacity to the constructor to avoid early resizing.
    - `ArrayDeque` always allocates power-of-2 capacity internally (rounded up from your initial capacity).

??? question "Q18: What are EnumSet and EnumMap, and why use them?"

    `EnumSet` is a bitfield-backed Set for enums with O(1) operations, and `EnumMap` is an ordinal-indexed array-backed Map for enum keys -- both are dramatically faster and more memory-efficient than their generic counterparts.

    **Why:** This tests whether you know about JDK's specialized collections that exploit compile-time type information. Using `HashSet<MyEnum>` when `EnumSet<MyEnum>` exists is a performance anti-pattern that signals unfamiliarity with the standard library.

    **How:**

    - **EnumSet** uses a `long` (or `long[]` for enums with > 64 constants) as a bit vector. Each enum constant maps to a bit position based on its `ordinal()`. `add()` = bitwise OR, `remove()` = bitwise AND with complement, `contains()` = bitwise AND + check.
    - **EnumMap** allocates an `Object[]` of size equal to the enum constant count. `put(key, value)` simply does `table[key.ordinal()] = value`. No hashing, no collision resolution, no wasted capacity.

    | Feature | EnumSet vs HashSet | EnumMap vs HashMap |
    |---------|-------------------|-------------------|
    | Speed | 10-100x faster | 2-10x faster |
    | Memory | 1 bit per constant | 1 reference per constant |
    | Iteration order | Enum declaration order | Enum declaration order |
    | Null elements/keys | Not allowed | Not allowed |
    | Thread-safe | No | No |

    ```java
    // EnumSet -- various factory methods
    EnumSet<Day> weekend = EnumSet.of(Day.SATURDAY, Day.SUNDAY);
    EnumSet<Day> weekdays = EnumSet.complementOf(weekend);
    EnumSet<Day> all = EnumSet.allOf(Day.class);
    EnumSet<Day> range = EnumSet.range(Day.MONDAY, Day.FRIDAY);

    // EnumMap -- type-safe, fast
    EnumMap<Day, List<String>> schedule = new EnumMap<>(Day.class);
    schedule.put(Day.MONDAY, List.of("standup", "sprint planning"));
    ```

    **When to use:** Always prefer `EnumSet` over `HashSet<Enum>` and `EnumMap` over `HashMap<Enum, V>`. Common use cases include feature flags, permission sets, state machines, and day-of-week/month scheduling.

    **Gotchas:**

    - `EnumSet` is abstract -- you cannot instantiate it directly. Use factory methods (`of()`, `allOf()`, `noneOf()`, `range()`).
    - For enums with <= 64 constants, `RegularEnumSet` uses a single `long`; for larger enums, `JumboEnumSet` uses a `long[]`.
    - `EnumSet` does not have a public constructor -- it uses the enum's `Class` object to determine capacity.
    - Neither allows `null` -- `add(null)` throws `NullPointerException`.
    - Iteration is in declaration order, which can be surprising if you expect insertion order.

??? question "Q19: What is WeakHashMap and when would you use it?"

    `WeakHashMap` holds keys via weak references, allowing them to be garbage-collected when no strong references remain -- entries are then automatically removed from the map.

    **Why:** This tests understanding of Java's reference types (strong, soft, weak, phantom) and their interaction with collections. `WeakHashMap` is the canonical example of GC-aware data structures and is essential knowledge for building caches and avoiding memory leaks.

    **How:**

    1. Keys are wrapped in `WeakReference` objects internally (specifically `WeakHashMap.Entry extends WeakReference<Object>`).
    2. These weak references are registered with a `ReferenceQueue`.
    3. When the GC determines a key has no strong references, the `WeakReference` is enqueued in the `ReferenceQueue`.
    4. On the next map operation (`get`, `put`, `size`), `WeakHashMap` polls the queue and removes all stale entries (the `expungeStaleEntries()` method).

    ```java
    WeakHashMap<Object, String> cache = new WeakHashMap<>();
    Object key = new Object();
    cache.put(key, "metadata");
    cache.size(); // 1

    key = null;     // no more strong references to the key
    System.gc();    // GC reclaims the key, enqueues the weak reference
    cache.size();   // likely 0 (expunged on access)
    ```

    **When to use:**

    - **Metadata/auxiliary data caches:** Associate temporary data with objects that should not outlive the objects themselves (e.g., caching reflection results, computed toString).
    - **Canonicalization maps:** Intern-style deduplication without preventing GC.
    - **ClassLoader-aware caches:** Prevent classloader memory leaks by allowing class-keyed entries to be collected when the classloader is unloaded.

    **Gotchas:**

    - **Values hold strong references:** If a value references its own key (directly or transitively), the key will NEVER be GC'd -- creating a memory leak. Wrap values in `WeakReference` if this is possible.
    - **String literal keys are never collected:** `cache.put("literal", value)` -- string literals live in the string pool with strong references forever.
    - **Not thread-safe:** Use `Collections.synchronizedMap(new WeakHashMap<>())` for concurrent access.
    - **Cleanup is lazy:** Stale entries are only expunged when the map is accessed. A dormant `WeakHashMap` retains dead entries indefinitely.
    - **Not suitable for value-based caches:** If you want values (not keys) to be reclaimable, use `SoftReference` values in a regular `HashMap` instead, or use Guava's `CacheBuilder`.

??? question "Q20: What is IdentityHashMap and how is it different from HashMap?"

    `IdentityHashMap` uses reference equality (`==`) instead of `equals()` and `System.identityHashCode()` instead of `hashCode()` -- two keys are considered equal only if they are the exact same object in memory.

    **Why:** This is a niche but important question that tests understanding of when logical equality is inappropriate and reference identity is needed. It also reveals knowledge of the underlying open-addressing collision resolution (unique in the JDK collections).

    **How:**

    - Uses **linear probing** (open addressing) rather than chaining. Keys and values are stored in alternating slots of a single `Object[]`: `table[2i]` = key, `table[2i+1]` = value.
    - Comparison: `if (key == table[2i])` -- pure reference check, no `equals()` call.
    - Hashing: `System.identityHashCode(key)` -- returns the default hash code based on object memory address (unaffected by overridden `hashCode()`).

    | Aspect | HashMap | IdentityHashMap |
    |--------|---------|-----------------|
    | Key equality | `equals()` | `==` (reference) |
    | Hash function | `key.hashCode()` | `System.identityHashCode(key)` |
    | Collision resolution | Chaining (linked list/tree) | Linear probing |
    | Storage | Node objects | Flat Object[] (keys + values interleaved) |
    | Use case | General purpose | Topology, serialization, proxies |

    ```java
    IdentityHashMap<String, Integer> map = new IdentityHashMap<>();
    String a = new String("key");
    String b = new String("key");
    map.put(a, 1);
    map.put(b, 2);
    map.size(); // 2 -- different objects, even though a.equals(b) is true

    // With String literals (interned -- same reference)
    map.put("literal", 3);
    map.put("literal", 4);
    map.size(); // still 3 -- "literal" == "literal" is true (same interned reference)
    ```

    **When to use:**

    - **Serialization/deep-copy graphs:** Track which objects have already been visited to handle circular references.
    - **Proxy-to-target mappings:** Map a proxy object to its underlying target without being confused by proxy `equals()` delegation.
    - **Topology-preserving transformations:** When you need to distinguish between structurally identical but distinct objects.
    - **WeakHashMap alternative (when keys override hashCode):** Avoid interference from custom `hashCode()`.

    **Gotchas:**

    - Linear probing means performance degrades more sharply at high load factors than chaining.
    - The default expected max size is 21 (very small) -- specify capacity if you expect many entries.
    - `IdentityHashMap` violates the general `Map` contract (which specifies `equals()`-based comparison) -- use it only when you intentionally want reference semantics.
    - String interning can cause surprises: `"hello" == "hello"` is `true` due to the string pool, so interned strings will be treated as the same key.

??? question "Q21: Collections.unmodifiableList() vs List.of() vs List.copyOf() -- what is the difference?"

    `unmodifiableList()` is a read-only view that still reflects changes to the backing list; `List.of()` creates a truly immutable list from literal values; `List.copyOf()` creates a truly immutable copy of an existing collection.

    **Why:** Immutability is a cornerstone of safe concurrent programming and defensive API design. Interviewers want to know if you understand the crucial difference between "unmodifiable view" (mutable source can still change) and "truly immutable" (no one can modify it, ever).

    **How:**

    | Feature | `unmodifiableList()` | `List.of()` | `List.copyOf()` |
    |---------|---------------------|-------------|-----------------|
    | Java version | 1.2+ | 9+ | 10+ |
    | Truly immutable | No (view only) | Yes | Yes |
    | Allows nulls | Yes | No | No |
    | Reflects source changes | Yes | N/A (no source) | No (independent copy) |
    | Memory | Thin wrapper | Compact (field-based for <=2 elements) | Compact copy |
    | Serializable | Yes | Yes | Yes |
    | `instanceof List` identity | Wrapper class | Internal ImmutableList | Internal ImmutableList |

    ```java
    // unmodifiableList -- view only, source can still change
    List<String> original = new ArrayList<>(List.of("a", "b"));
    List<String> view = Collections.unmodifiableList(original);
    original.add("c");
    view.size(); // 3 -- view reflects the change!

    // List.of -- truly immutable, no source
    List<String> immutable = List.of("a", "b", "c");

    // List.copyOf -- independent immutable copy
    List<String> copy = List.copyOf(original);
    original.add("d");
    copy.size(); // 3 -- copy is independent
    ```

    **When to use:**

    - **`List.of()`:** When constructing an immutable list from known values (constants, API responses, configuration).
    - **`List.copyOf()`:** When you receive a mutable collection and want to create a defensive immutable copy.
    - **`unmodifiableList()`:** When you want to expose a read-only API but the internal list may still be modified by the owning class (e.g., returning an unmodifiable view of an internal field).

    **Gotchas:**

    - `List.of()` and `List.copyOf()` reject `null` elements -- `NullPointerException` at creation time.
    - `List.copyOf()` is smart: if the source is already an immutable list (created by `List.of()`), it returns the same instance (no copy).
    - The `Set.of()` and `Map.of()` equivalents randomize iteration order per JVM run to prevent developers from depending on order.
    - `unmodifiableList()` does NOT make the elements immutable -- if elements are mutable objects, they can still be modified through references.
    - All three throw `UnsupportedOperationException` on `add()`, `set()`, `remove()` -- but only the Java 9+ versions are structurally immutable.

??? question "Q22: How can you make a collection thread-safe?"

    You can make collections thread-safe via synchronized wrappers, purpose-built concurrent collections, external locking, or immutability -- each with different trade-offs between simplicity, performance, and correctness guarantees.

    **Why:** Thread-safe collection usage is a daily concern in server-side Java. Interviewers want to see that you know the full spectrum of options and can pick the right one for a given concurrency profile (read-heavy vs write-heavy, high vs low contention).

    **How:**

    | Approach | Mechanism | Pros | Cons |
    |----------|-----------|------|------|
    | `Collections.synchronizedXxx()` | Single mutex wrapping all methods | Simple, drop-in | Coarse-grained, iteration needs external lock |
    | `ConcurrentHashMap` | Per-bucket CAS + sync | High throughput, atomic compounds | No null keys/values, weakly consistent iteration |
    | `CopyOnWriteArrayList` | Copy array on every write | Lock-free reads, snapshot iterators | O(n) writes, memory-heavy |
    | `ConcurrentLinkedQueue` | Lock-free CAS (Michael-Scott) | Non-blocking, scalable | No random access, size() is O(n) |
    | External `ReentrantLock` | Manual lock/unlock | Full control, condition variables | Error-prone, verbose |
    | Immutable (`List.of()`) | No mutation possible | Inherently thread-safe, zero overhead | Cannot modify after creation |

    ```java
    // Synchronized wrapper (iteration still needs manual sync)
    List<String> syncList = Collections.synchronizedList(new ArrayList<>());
    synchronized (syncList) {
        for (String s : syncList) { /* safe iteration */ }
    }

    // Concurrent collection (atomic compound operations)
    ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();
    map.computeIfAbsent("key", k -> expensiveCompute(k)); // atomic

    // CopyOnWrite (read-heavy scenario)
    CopyOnWriteArrayList<EventListener> listeners = new CopyOnWriteArrayList<>();
    // iteration never blocks, writes copy entire array
    ```

    **When to use:**

    - Read-heavy, rare writes: `CopyOnWriteArrayList`, `CopyOnWriteArraySet`
    - High-concurrency map: `ConcurrentHashMap`
    - Simple drop-in safety: `Collections.synchronizedList()`
    - No modification needed: `List.of()`, `List.copyOf()`
    - Producer-consumer: `BlockingQueue` implementations

    **Gotchas:**

    - `synchronizedList()` does NOT make iteration safe -- you must still `synchronized(list)` during for-each loops.
    - `ConcurrentHashMap` does not support locking the entire map -- compound operations like "iterate and remove all" are not atomic.
    - `Collections.synchronizedMap()` returns a map where `size()` + `put()` is NOT atomic -- use `ConcurrentHashMap.computeIfAbsent()` instead.
    - Immutable collections are only safe if the elements themselves are immutable -- mutable elements can still be modified through shared references.

??? question "Q23: Collections.synchronizedList() vs CopyOnWriteArrayList -- when to use which?"

    Use `CopyOnWriteArrayList` when reads vastly outnumber writes (e.g., listener lists), and `synchronizedList` when writes are frequent or the list is large -- copying the entire array on each write would be prohibitively expensive.

    **Why:** This is a classic trade-off question that reveals whether you can reason about read/write ratios and pick the right concurrency strategy for your workload profile.

    **How:**

    - **`synchronizedList()`:** Wraps every method call in `synchronized(mutex)`. Reads and writes both acquire the same lock -- readers block each other and block writers. Iteration is NOT safe without external synchronization.
    - **`CopyOnWriteArrayList`:** Every write (`add`, `set`, `remove`) acquires a `ReentrantLock`, creates a full copy of the internal array, modifies the copy, then atomically swaps the reference. Reads are completely lock-free (read the current array snapshot via a `volatile` reference). Iterators work on the snapshot array at creation time.

    | Aspect | `synchronizedList()` | `CopyOnWriteArrayList` |
    |--------|---------------------|----------------------|
    | Write cost | O(1) amortized (lock + delegate) | O(n) -- full array copy |
    | Read cost | Lock acquisition (blocks) | Lock-free (volatile read) |
    | Iteration safety | Needs manual `synchronized` block | Snapshot-based, always safe |
    | Concurrent readers | Serialized (one at a time) | Unlimited parallel reads |
    | Best for | Write-heavy or large lists | Read-heavy, small-to-medium lists |
    | Memory on write | None extra | Entire array duplicated |
    | Iterator modification | Fail-fast (CME) | Iterator never throws CME, but `remove()`/`set()` on iterator throw UOE |

    ```java
    // CopyOnWriteArrayList -- ideal for event listeners
    CopyOnWriteArrayList<Listener> listeners = new CopyOnWriteArrayList<>();
    listeners.add(newListener);       // O(n) copy, but rare
    for (Listener l : listeners) {    // safe, no lock needed
        l.onEvent(event);             // even if another thread adds/removes concurrently
    }
    ```

    **When to use:**

    - **CopyOnWriteArrayList:** Event listener registries, observer patterns, configuration lists that are read on every request but updated rarely (at startup or via admin action).
    - **synchronizedList:** High-write workloads, large lists (>10K elements where copying is expensive), or when you need list operations like `sort()` or `subList()`.

    **Gotchas:**

    - `CopyOnWriteArrayList` iterator's `remove()` and `set()` throw `UnsupportedOperationException` -- you cannot modify through the iterator.
    - Bulk operations like `addAll(collection)` on `CopyOnWriteArrayList` make only ONE copy (not one per element) -- it is optimized.
    - `synchronizedList().iterator()` is NOT synchronized -- you MUST wrap iteration in a `synchronized` block or you get `ConcurrentModificationException`.
    - For a concurrent Set, use `CopyOnWriteArraySet` (backed by `CopyOnWriteArrayList`) or `ConcurrentHashMap.newKeySet()`.

??? question "Q24: What is ConcurrentSkipListMap?"

    `ConcurrentSkipListMap` is a thread-safe, sorted `NavigableMap` backed by a skip list data structure, providing O(log n) lock-free reads and fine-grained CAS-based writes -- the concurrent equivalent of `TreeMap`.

    **Why:** This tests whether you know the solution for "I need a sorted, concurrent map" -- a common requirement in caching, scheduling, and event-processing systems. It also probes knowledge of probabilistic data structures.

    **How:**

    A skip list is a layered linked list where each layer is a "express lane" that skips over elements:

    ```
    Level 3:  HEAD ──────────────────────────────── 50 ─── TAIL
    Level 2:  HEAD ─────── 20 ──────────────────── 50 ─── TAIL
    Level 1:  HEAD ── 10 ─ 20 ── 30 ─────── 45 ── 50 ─── TAIL
    Level 0:  HEAD ── 10 ─ 20 ── 30 ── 35 ─ 45 ── 50 ─── TAIL
    ```

    - Search starts at the highest level and drops down when the next pointer overshoots.
    - Insertion randomly determines the node's level (coin-flip probability) -- no rebalancing needed.
    - Concurrency is achieved via CAS operations on forward pointers and a marker-node deletion scheme -- no global lock.

    | Feature | ConcurrentSkipListMap | ConcurrentHashMap | TreeMap |
    |---------|----------------------|-------------------|---------|
    | Sorted | Yes | No | Yes |
    | Thread-safe | Yes (lock-free reads) | Yes (CAS + per-bucket sync) | No |
    | get/put/remove | O(log n) | O(1) avg | O(log n) |
    | Range queries | Yes (subMap, headMap) | No | Yes |
    | Memory overhead | High (multiple levels of pointers) | Moderate | Moderate |

    ```java
    ConcurrentSkipListMap<Long, Event> timeline = new ConcurrentSkipListMap<>();
    timeline.put(timestamp1, event1);
    timeline.put(timestamp2, event2);

    // Range query: all events between two timestamps
    NavigableMap<Long, Event> window = timeline.subMap(start, true, end, true);

    // Navigation
    Map.Entry<Long, Event> latest = timeline.lastEntry();
    Map.Entry<Long, Event> nearestBefore = timeline.floorEntry(targetTime);
    ```

    **When to use:**

    - Need sorted + concurrent: leaderboards, time-series event stores, scheduling queues.
    - Need concurrent range queries: `subMap()`, `headMap()`, `tailMap()` are all thread-safe.
    - Need a concurrent sorted set: use `ConcurrentSkipListSet` (backed by `ConcurrentSkipListMap`).

    **Gotchas:**

    - Higher memory usage than `TreeMap` due to multi-level pointers (average ~1.33 pointers per node).
    - O(log n) is slower than `ConcurrentHashMap`'s O(1) -- only use when you actually need sorting or range queries.
    - `size()` is O(n) -- it traverses the entire bottom-level list to count (no cached size counter, to avoid contention).
    - Keys must be `Comparable` or you must provide a `Comparator` at construction.
    - Weakly consistent iterators -- may or may not reflect concurrent modifications after creation.

??? question "Q25: Explain BlockingQueue and its main implementations."

    `BlockingQueue` is a thread-safe queue that adds blocking semantics: `put()` blocks when full and `take()` blocks when empty, making it the fundamental building block for producer-consumer patterns in Java.

    **Why:** Producer-consumer is one of the most common concurrent patterns in server-side Java (thread pools, message processing, pipeline architectures). Interviewers want to see that you know which implementation to choose and understand the API tiers (blocking, timed, non-blocking).

    **How:**

    `BlockingQueue` provides three tiers of operations:

    | Operation type | Insert | Remove | Examine |
    |---------------|--------|--------|---------|
    | Throws exception | `add(e)` | `remove()` | `element()` |
    | Returns special value | `offer(e)` → false | `poll()` → null | `peek()` → null |
    | Blocks | `put(e)` | `take()` | -- |
    | Times out | `offer(e, time, unit)` | `poll(time, unit)` | -- |

    **Main implementations:**

    | Implementation | Backing | Bounded? | Key characteristics |
    |----------------|---------|----------|---------------------|
    | `ArrayBlockingQueue` | Circular array | Yes (fixed) | Single `ReentrantLock`, optional fairness |
    | `LinkedBlockingQueue` | Linked nodes | Optionally (Integer.MAX by default) | Separate put/take locks = higher throughput |
    | `PriorityBlockingQueue` | Binary heap | Unbounded | Priority-ordered dequeue |
    | `SynchronousQueue` | None (zero capacity) | N/A | Direct handoff -- producer blocks until consumer takes |
    | `DelayQueue` | Priority heap | Unbounded | Elements available only after their delay expires |
    | `LinkedTransferQueue` | Linked nodes | Unbounded | Combines transfer semantics with non-blocking |

    ```java
    // Classic producer-consumer
    BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);

    // Producer thread
    queue.put(task);       // blocks if queue is full (backpressure!)

    // Consumer thread
    Task task = queue.take(); // blocks if queue is empty (waits for work)

    // Timed variant (useful for graceful shutdown)
    Task task = queue.poll(5, TimeUnit.SECONDS); // returns null on timeout
    ```

    **When to use:**

    - **ArrayBlockingQueue:** Fixed-size buffer, bounded memory, fairness needed.
    - **LinkedBlockingQueue:** Higher throughput (separate locks for put/take), used internally by `ThreadPoolExecutor` with unbounded queue.
    - **SynchronousQueue:** Direct handoff with no buffering (used by `Executors.newCachedThreadPool()`).
    - **DelayQueue:** Scheduled task execution, cache expiration, retry-after delays.
    - **PriorityBlockingQueue:** Priority-based task processing.

    **Gotchas:**

    - `LinkedBlockingQueue` with default capacity (`Integer.MAX_VALUE`) is effectively unbounded -- can cause OOM if producers outpace consumers. Always specify a capacity.
    - `SynchronousQueue.offer(e)` returns `false` immediately if no consumer is waiting -- it does NOT block (use `put()` for blocking).
    - `PriorityBlockingQueue` has no capacity bound -- it can grow until OOM. Backpressure is your responsibility.
    - `BlockingQueue` does not support blocking `peek()` -- only `take()` and `poll(timeout)` block.
    - `ArrayBlockingQueue` with `fair=true` uses a FIFO lock ordering (ensures longest-waiting thread goes first) but reduces throughput by ~30-50%.

??? question "Q26: What are NavigableMap and NavigableSet?"

    `NavigableMap` and `NavigableSet` extend `SortedMap`/`SortedSet` with closest-match navigation methods (`floor`, `ceiling`, `lower`, `higher`) and range-view operations, enabling efficient "nearest neighbor" lookups in sorted collections.

    **Why:** Interviewers ask this to test knowledge of Java's sorted collection APIs beyond basic `get()`/`put()`. Real-world use cases like "find the closest price point," "get all events after timestamp X," or "find the nearest server" require these navigation methods.

    **How:**

    | Method | NavigableMap | NavigableSet | Returns |
    |--------|-------------|--------------|---------|
    | `floor` | `floorKey(k)` / `floorEntry(k)` | `floor(e)` | Greatest element <= given |
    | `ceiling` | `ceilingKey(k)` / `ceilingEntry(k)` | `ceiling(e)` | Smallest element >= given |
    | `lower` | `lowerKey(k)` / `lowerEntry(k)` | `lower(e)` | Greatest element < given (strictly) |
    | `higher` | `higherKey(k)` / `higherEntry(k)` | `higher(e)` | Smallest element > given (strictly) |
    | `first/last` | `firstEntry()` / `lastEntry()` | `first()` / `last()` | Min/max element |
    | `pollFirst/Last` | `pollFirstEntry()` / `pollLastEntry()` | `pollFirst()` / `pollLast()` | Remove and return min/max |
    | `descending` | `descendingMap()` | `descendingSet()` | Reverse-order view |
    | `subMap` | `subMap(from, fromInc, to, toInc)` | `subSet(from, fromInc, to, toInc)` | Range view with inclusive flags |

    ```java
    TreeMap<Integer, String> map = new TreeMap<>();
    map.put(10, "ten"); map.put(20, "twenty"); map.put(30, "thirty");

    map.floorKey(25);    // 20 (greatest key <= 25)
    map.ceilingKey(25);  // 30 (smallest key >= 25)
    map.lowerKey(20);    // 10 (strictly less than 20)
    map.higherKey(20);   // 30 (strictly greater than 20)

    // Range view: all entries from 15 to 25 inclusive
    map.subMap(15, true, 25, true); // {20=twenty}

    // Descending iteration
    for (var e : map.descendingMap().entrySet()) { /* 30, 20, 10 */ }
    ```

    **When to use:** Time-series queries, IP range lookups, scheduling (find next available slot), price-level books in trading systems, geospatial nearest-neighbor approximations.

    **Gotchas:**

    - `subMap()`, `headMap()`, `tailMap()` return **views** -- modifications to the view affect the original map and vice versa.
    - The 2-arg `subMap(from, to)` is lower-inclusive, upper-exclusive. Use the 4-arg version for explicit control.
    - `pollFirstEntry()`/`pollLastEntry()` are destructive -- they remove the entry from the map.
    - These methods return `null` when no matching element exists (not an exception) -- always null-check the result.
    - `ConcurrentSkipListMap` also implements `NavigableMap` for concurrent sorted + navigable use cases.

??? question "Q27: What is a Spliterator and how does it relate to parallel streams?"

    `Spliterator` (Splittable Iterator) is a Java 8 interface designed for parallel traversal -- its `trySplit()` method partitions data into halves that can be processed concurrently by the ForkJoinPool in parallel streams.

    **Why:** Understanding Spliterators explains why some collections parallelize well (`ArrayList`, arrays) while others do not (`LinkedList`, `HashSet`). It is also essential for creating custom data sources that work efficiently with the Stream API.

    **How:**

    | Method | Purpose | Returns |
    |--------|---------|---------|
    | `tryAdvance(Consumer)` | Process one element | `true` if element existed, `false` if exhausted |
    | `forEachRemaining(Consumer)` | Bulk process all remaining | void |
    | `trySplit()` | Split into two halves | New Spliterator for first half (or null if unsplittable) |
    | `estimateSize()` | Approximate remaining count | `long` |
    | `characteristics()` | Describe properties | Bitfield of flags |

    **Characteristics flags:** `ORDERED`, `DISTINCT`, `SORTED`, `SIZED`, `SUBSIZED`, `NONNULL`, `IMMUTABLE`, `CONCURRENT`.

    **Parallel stream flow:**

    1. `parallelStream()` obtains the collection's `Spliterator`.
    2. ForkJoinPool tasks call `trySplit()` recursively until the chunk is small enough.
    3. Each chunk is processed by a separate thread.
    4. Results are merged according to the terminal operation (reduce, collect, etc.).

    ```java
    // Splitting demonstration
    List<Integer> list = IntStream.rangeClosed(1, 1000).boxed().toList();
    Spliterator<Integer> full = list.spliterator();
    Spliterator<Integer> firstHalf = full.trySplit(); // splits off [1..500]
    // full now covers only [501..1000]

    full.estimateSize();      // ~500
    firstHalf.estimateSize(); // ~500
    ```

    **Splitting efficiency by collection:**

    | Collection | Split quality | Why |
    |-----------|--------------|-----|
    | `ArrayList` / arrays | Excellent | Index-based split at midpoint |
    | `TreeMap`/`TreeSet` | Good | Balanced tree allows subtree splits |
    | `HashSet`/`HashMap` | Moderate | Bucket-range splitting |
    | `LinkedList` | Poor | Must traverse to find midpoint |
    | `Stream.iterate()` | Cannot split | Sequential by nature |

    **When to use:** Implement custom `Spliterator` when you have a non-standard data source (file, database cursor, generator) that you want to expose as a parallel-capable `Stream` via `StreamSupport.stream(spliterator, parallel)`.

    **Gotchas:**

    - `trySplit()` returning `null` means the Spliterator cannot (or chooses not to) split further -- the stream framework falls back to sequential processing for that chunk.
    - A `SIZED` + `SUBSIZED` Spliterator enables the stream to pre-allocate result arrays and avoid intermediate buffering.
    - Parallel streams on `LinkedList` perform worse than sequential because `trySplit()` must traverse O(n) nodes to find the midpoint.
    - Custom Spliterators must correctly report characteristics -- wrong flags can cause incorrect stream behavior (e.g., claiming `SORTED` when not sorted breaks `distinct()` optimizations).

??? question "Q28: Why doesn't Map extend Collection?"

    `Map` does not extend `Collection` because a Map stores key-value pairs (mappings), not individual elements -- the `Collection` API (`add(E)`, `iterator()`, `size()`) does not semantically fit the two-dimensional nature of a Map.

    **Why:** This is a design-philosophy question that tests understanding of interface segregation, Liskov Substitution Principle, and the intentional separation of concerns in the Java Collections Framework.

    **How the designers reasoned:**

    1. **Semantic mismatch:** `Collection.add(E)` takes one element. What would `Map.add()` take? A key? A value? An entry? No single-argument method makes sense for a two-typed structure.
    2. **`contains()` ambiguity:** Does `map.contains(x)` check for a key, a value, or an entry? The answer differs per use case, so `Map` provides `containsKey()` and `containsValue()` separately.
    3. **`equals()` contract:** `Collection.equals()` compares element-by-element; `Map.equals()` compares entry-by-entry. These are fundamentally different contracts.
    4. **Liskov Substitution Principle:** If `Map extends Collection`, code accepting a `Collection` would receive a Map whose `add()`, `iterator()`, and `size()` semantics violate the caller's expectations.

    Instead, `Map` provides **collection views** that bridge the two worlds:

    ```java
    Map<String, Integer> map = Map.of("a", 1, "b", 2);

    Set<String> keys = map.keySet();          // Set view of keys
    Collection<Integer> vals = map.values();  // Collection view of values
    Set<Map.Entry<String, Integer>> entries = map.entrySet(); // Set of entries

    // Views are live -- modifications to views affect the map
    keys.remove("a"); // removes the entry ("a", 1) from the map
    ```

    **When to use:** Use `entrySet()` for efficient iteration (avoids per-key `get()` lookup). Use `keySet()` when you only need keys. Use `values()` for aggregate operations on values.

    **Gotchas:**

    - `keySet()`, `values()`, and `entrySet()` are **live views** -- removing an element from the view removes the corresponding entry from the map. Adding is generally not supported (throws `UnsupportedOperationException`).
    - In C#, `Dictionary<K,V>` implements `ICollection<KeyValuePair<K,V>>` -- showing that the Java design was a deliberate choice, not the only possible design.
    - `Map.Entry` objects from `entrySet()` may be invalid after the iterator advances (in some implementations) -- use `Map.entry()` or copy values if you need to store them.
    - Some libraries (e.g., Apache Commons `MultiValuedMap`) do model maps as collections of entries, but the JDK chose cleaner API separation.

??? question "Q29: What is the equals() and hashCode() contract, and why does it matter for Map keys?"

    The contract requires that equal objects must have the same hash code (but objects with the same hash code need not be equal). Violating this causes hash-based collections to silently lose or fail to find entries.

    **Why:** This is one of the most important correctness questions in Java. Violating the contract leads to subtle, hard-to-debug bugs where `HashMap.get()` returns `null` for a key you just inserted. Every senior Java developer must know this cold.

    **How:** The formal contract (from `Object` javadoc):

    1. **Consistency:** Multiple invocations of `hashCode()` on an unchanged object must return the same value.
    2. **Equals implies same hashCode:** If `a.equals(b)` → `a.hashCode() == b.hashCode()` (MUST).
    3. **Same hashCode does NOT imply equals:** `a.hashCode() == b.hashCode()` does NOT require `a.equals(b)` (collisions are allowed).
    4. **Contrapositive (key insight):** If `a.hashCode() != b.hashCode()` → `a.equals(b)` MUST be `false`.

    **How HashMap uses both:**

    ```
    put(key, value):
      bucket = hashCode(key) & (capacity - 1)   // hashCode determines WHERE to look
      for each node in bucket:
        if node.hash == hash AND node.key.equals(key)  // equals determines IF it's a match
          → replace value
    ```

    ```java
    // BROKEN: equals without hashCode
    class Person {
        String name;
        @Override public boolean equals(Object o) {
            return o instanceof Person p && name.equals(p.name);
        }
        // MISSING hashCode() -- defaults to System.identityHashCode()
    }

    Map<Person, String> map = new HashMap<>();
    map.put(new Person("Alice"), "engineer");
    map.get(new Person("Alice")); // null! Different identity → different bucket

    // CORRECT: consistent equals + hashCode
    class Person {
        String name;
        @Override public boolean equals(Object o) {
            return o instanceof Person p && name.equals(p.name);
        }
        @Override public int hashCode() {
            return Objects.hash(name); // same fields as equals
        }
    }
    ```

    **When to use:** Always override both together when using custom objects as `HashMap`/`HashSet` keys. Use `Objects.hash()` for convenience or Java records (which auto-generate both).

    **Gotchas:**

    - **Only override hashCode without equals:** Two distinct objects may hash to the same bucket, but `equals()` (using `==`) will never match -- entries accumulate but are never "found" as duplicates. HashSet will contain duplicates.
    - **Using mutable fields in hashCode:** If fields change after insertion, the hash changes but the object stays in the old bucket -- it becomes a phantom entry (present but unfindable).
    - **Inconsistent with compareTo:** `TreeMap` uses `compareTo()` (not `equals()`/`hashCode()`). If `compareTo()` returns 0 but `equals()` returns false, `TreeMap` treats them as the same key but `HashMap` treats them as different.
    - **Array fields:** `Arrays.hashCode(arr)` must be used instead of `arr.hashCode()` (which is identity-based).
    - **Best practice:** Use the same fields for `equals()` and `hashCode()`. Never use more fields in `hashCode()` than in `equals()` (would violate the contract for equal objects that differ in the extra fields).

??? question "Q30: What happens if you mutate a key object after inserting it into a HashMap?"

    The entry becomes a phantom -- it still occupies a bucket based on the original `hashCode()`, but lookups with the mutated key compute a different bucket index, making the entry unreachable. This is effectively a memory leak.

    **Why:** This is the practical consequence of the `hashCode()` contract. Interviewers use it to test whether you understand why immutable keys are critical and to probe for real-world debugging experience with "lost" map entries.

    **How:**

    1. At `put(key, value)` time, `hashCode()` of the key determines the bucket (say bucket 5).
    2. The entry `Node(hash=oldHash, key=keyRef, value=val)` is stored in bucket 5.
    3. You mutate the key object -- its `hashCode()` now produces a different value.
    4. On `get(key)`: the new `hashCode()` maps to a different bucket (say bucket 12). HashMap looks in bucket 12 -- finds nothing. Returns `null`.
    5. The entry is still in bucket 5, consuming memory, but no lookup will ever find it there (because the key's current hash does not map to bucket 5 anymore).

    ```java
    List<String> key = new ArrayList<>(List.of("a"));
    Map<List<String>, String> map = new HashMap<>();
    map.put(key, "value");

    System.out.println(map.get(key)); // "value" -- works fine

    key.add("b");  // MUTATES the key! hashCode changes.

    map.get(key);           // null -- wrong bucket
    map.containsKey(key);   // false
    map.size();             // 1 -- entry is STILL there, orphaned
    map.values();           // ["value"] -- reachable via iteration
    map.remove(key);        // false -- can't find it to remove it

    // Even iterating entrySet() shows the entry, but key.hashCode() ≠ stored hash
    ```

    **When to use:** The rule is simple -- **Map keys must be effectively immutable** after insertion. Use:

    - `String`, `Integer`, `Long`, `enum` constants (inherently immutable)
    - Java `record` types (immutable by design)
    - Custom classes with `final` fields used in `hashCode()`/`equals()`

    **Gotchas:**

    - This bug is silent -- no exception is thrown. The only symptom is `get()` returning `null` or `containsKey()` returning `false` for an entry that `size()` confirms exists.
    - `HashMap.entrySet()` iteration WILL find the orphaned entry (it scans all buckets sequentially), but `get()` will not.
    - The same problem affects `HashSet` (which is backed by `HashMap`) -- mutating an element after `add()` means `contains()` returns `false`.
    - Even if you mutate the key back to its original state (restoring the original hashCode), the entry becomes findable again -- but this is fragile and not a valid strategy.
    - `TreeMap` has an analogous issue: if mutation changes the `compareTo()` result, the red-black tree's ordering invariant is violated, corrupting the entire tree structure.

??? question "Q31: What are the best practices for initial capacity and load factor in HashMap?"

    Set initial capacity to `expectedSize / 0.75 + 1` (or use `HashMap.newHashMap(expectedSize)` in Java 19+) to avoid costly resizing, and keep the default load factor of 0.75 unless you have a specific memory/speed trade-off in mind.

    **Why:** Each resize doubles the table and rehashes ALL entries -- O(n) work. For large maps built in hot paths (e.g., processing database results), unnecessary resizes cause GC pressure and latency spikes. Interviewers test this to see if you optimize real-world code.

    **How:**

    - `threshold = capacity * loadFactor`. When `size > threshold`, the table doubles.
    - Default: capacity=16, loadFactor=0.75, so first resize at 12 entries, then at 24, 48, 96...
    - The capacity is always rounded up to the next power of 2 internally.

    **Calculating optimal initial capacity:**

    ```java
    int expectedSize = 100;

    // Manual calculation: expectedSize / loadFactor + 1
    // 100 / 0.75 = 133.3 → pass 134 → internally rounds to 256 (next power of 2)
    Map<String, String> map = new HashMap<>(134);

    // Java 19+: newHashMap computes the right capacity for you
    Map<String, String> map2 = HashMap.newHashMap(100);

    // Guava: equivalent utility
    Map<String, String> map3 = Maps.newHashMapWithExpectedSize(100);
    ```

    **Load factor guidelines:**

    | Load factor | Space | Speed | Collisions | Use case |
    |-------------|-------|-------|-----------|----------|
    | 0.5 | Wasteful | Faster | Fewer | Latency-critical, small maps |
    | **0.75 (default)** | Balanced | Balanced | Acceptable | General purpose |
    | 0.9-1.0 | Compact | Slower | More | Memory-constrained, large maps |
    | >1.0 | Minimal | Degraded | Many | Not recommended |

    **When to use:**

    - Always pre-size when you know (or can estimate) the final map size -- especially for maps built from `ResultSet`, file parsing, or bulk API responses.
    - Use `HashMap.newHashMap(n)` (Java 19+) to avoid the mental math.
    - Rarely change load factor -- the default 0.75 is well-tuned for typical workloads.

    **Gotchas:**

    - Passing `new HashMap<>(100)` does NOT mean it can hold 100 entries without resizing -- it sets capacity to 128 (next power of 2), threshold = 96. You would resize at the 97th entry.
    - The formula is `expectedEntries / loadFactor`, not `expectedEntries`. This is a common mistake.
    - Over-sizing wastes memory (each empty bucket is an unused array slot). Under-sizing causes O(n) resize during insertion.
    - Load factor is set at construction and cannot be changed later.
    - `HashMap.newHashMap(int)` and `HashSet.newHashSet(int)` (Java 19+) are the clean way -- they internally compute `capacity = (int)(numMappings / 0.75) + 1`.

??? question "Q32: What are the Java 9+ factory methods for creating collections?"

    Java 9 introduced `List.of()`, `Set.of()`, and `Map.of()` factory methods that create compact, truly immutable collections with null rejection, duplicate detection, and randomized iteration order (for Set/Map).

    **Why:** Before Java 9, creating an immutable list required `Collections.unmodifiableList(Arrays.asList(...))` -- verbose and only a view (not truly immutable). The new factories are concise, safe, and optimized. Interviewers test this to gauge familiarity with modern Java idioms.

    **How:**

    ```java
    // Immutable List (preserves order, allows duplicates)
    List<String> list = List.of("a", "b", "c");

    // Immutable Set (no duplicates, randomized iteration order)
    Set<String> set = Set.of("a", "b", "c");

    // Immutable Map (up to 10 key-value pairs with varargs)
    Map<String, Integer> map = Map.of("a", 1, "b", 2, "c", 3);

    // Immutable Map (any number of entries)
    Map<String, Integer> map2 = Map.ofEntries(
        Map.entry("a", 1),
        Map.entry("b", 2),
        Map.entry("c", 3)
    );

    // Java 10+: immutable copy of existing collection
    List<String> copy = List.copyOf(mutableList);
    Set<String> setCopy = Set.copyOf(mutableSet);
    Map<String, Integer> mapCopy = Map.copyOf(mutableMap);
    ```

    **Internal optimizations:**

    | Size | List implementation | Memory |
    |------|-------------------|--------|
    | 0 | Singleton empty | Zero allocation |
    | 1 | Single-field class | 1 reference |
    | 2 | Two-field class | 2 references |
    | 3+ | Array-based | Compact Object[] |

    **When to use:** Constants, configuration values, method return values, test fixtures -- anywhere you want a concise, safe, immutable collection literal.

    **Gotchas:**

    - **Null rejection:** `List.of(null)` throws `NullPointerException` at creation time (not at access time like `unmodifiableList`).
    - **Duplicate rejection:** `Set.of("a", "a")` throws `IllegalArgumentException`. Same for duplicate keys in `Map.of()`.
    - **Randomized order:** `Set.of()` and `Map.of()` deliberately randomize iteration order per JVM run to prevent developers from depending on insertion order. This is NOT `LinkedHashSet` behavior.
    - **UnsupportedOperationException:** All mutating methods (`add`, `set`, `remove`, `put`, `clear`) throw UOE -- even `Collections.sort()` on a `List.of()` result will throw.
    - **No subclass guarantee:** The returned types are package-private implementation classes. Do not assume `instanceof ArrayList` or similar.
    - **Serialization:** These collections are serializable, but deserialize to their immutable equivalents (not to `ArrayList` etc.).

??? question "Q33: Stream vs Collection -- what is the fundamental difference?"

    A `Collection` is an in-memory data structure that stores elements for repeated access; a `Stream` is a lazily-evaluated, single-use pipeline of computations over a data source that does not store elements.

    **Why:** This conceptual distinction is fundamental to writing idiomatic Java 8+ code. Interviewers test it to ensure you understand lazy evaluation, the pipeline model, and when to use streams vs collections in production code.

    **How:**

    | Aspect | Collection | Stream |
    |--------|-----------|--------|
    | Purpose | Store and organize data | Compute over data |
    | Storage | Yes (in memory) | No (pipeline only) |
    | Evaluation | Eager | Lazy (until terminal op) |
    | Reusability | Iterate unlimited times | Single-use (IllegalStateException on reuse) |
    | Infinite | No (finite memory) | Yes (`Stream.generate()`, `iterate()`) |
    | Parallelism | Manual threads | Built-in (`parallelStream()`) |
    | Modification | Add/remove elements | Cannot mutate source |
    | External iteration | `for-each`, `iterator()` | Internal iteration (framework controls) |

    **Analogy:** A Collection is like a DVD (stored, replayable). A Stream is like a live broadcast (consumed once, processed as it flows).

    ```java
    // Stream is lazy -- nothing executes until terminal operation
    Stream<String> stream = list.stream()
        .filter(s -> s.length() > 3)   // not executed yet
        .map(String::toUpperCase);      // not executed yet

    // Terminal operation triggers the pipeline
    List<String> result = stream.collect(Collectors.toList()); // NOW it runs

    // Reuse attempt throws IllegalStateException
    stream.count(); // IllegalStateException: stream has already been operated upon
    ```

    **When to use:**

    - **Collections:** When you need to store data, access elements multiple times, modify the structure, or need indexed access.
    - **Streams:** When you need to transform, filter, aggregate data in a declarative pipeline -- especially for complex multi-step transformations, parallel processing, or working with infinite/lazy data sources.

    **Gotchas:**

    - Streams are **single-use** -- calling any terminal operation closes the stream. Attempting reuse throws `IllegalStateException`.
    - Stream operations are lazy -- intermediate operations like `filter()` and `map()` do nothing until a terminal operation (`collect()`, `forEach()`, `count()`) is invoked.
    - `Stream.forEach()` does not guarantee order in parallel streams -- use `forEachOrdered()` if order matters.
    - Collecting a stream into a collection creates a new in-memory data structure -- for very large datasets, this can cause OOM. Consider `forEach()` or reducing operations instead.
    - Streams should not have side effects in intermediate operations (no mutating external state in `map()` or `filter()`) -- this breaks parallelism and reasoning.

??? question "Q34: What are the pitfalls of toArray() in collections?"

    The no-arg `toArray()` returns `Object[]` which cannot be cast to a typed array; use `toArray(new T[0])` or `toArray(T[]::new)` (Java 11+) for type-safe conversion, preferring the zero-length array pattern for both performance and thread-safety.

    **Why:** This is a common source of `ClassCastException` and subtle bugs. Interviewers test it to see if you know the correct idiom and understand why the zero-length array approach is recommended by JVM engineers.

    **How:**

    ```java
    List<String> list = List.of("a", "b", "c");

    // WRONG: ClassCastException at runtime
    String[] bad = (String[]) list.toArray(); // toArray() returns Object[]

    // CORRECT: typed overload with zero-length array (recommended)
    String[] arr1 = list.toArray(new String[0]);

    // CORRECT: Java 11+ generator function
    String[] arr2 = list.toArray(String[]::new);

    // WORKS but NOT recommended: pre-sized array
    String[] arr3 = list.toArray(new String[list.size()]);
    ```

    **Why `new String[0]` beats `new String[list.size()]`:**

    | Aspect | `new T[0]` | `new T[list.size()]` |
    |--------|-----------|---------------------|
    | JVM optimization | JIT can use fast intrinsic `Arrays.copyOf` | Must zero-fill pre-allocated array, then overwrite |
    | Thread safety | Atomic -- no TOCTOU race | `list.size()` may change before `toArray()` |
    | Readability | Simpler, no size computation | Requires matching size call |
    | Performance | Slightly faster (modern JVMs) | Slightly slower due to zero-fill |

    The JVM detects the zero-length array pattern and uses an optimized path (`T[] result = Arrays.copyOf(elementData, size, arrayType)`) that avoids unnecessary zero-filling.

    **When to use:** Always use `toArray(new T[0])` or `toArray(T[]::new)`. The pre-sized array pattern is a legacy practice from Java 5 era when JVMs could not optimize the zero-length case.

    **Gotchas:**

    - If you pass an array larger than the collection size, `toArray()` sets `array[size] = null` as a sentinel -- this can mask bugs if the array is reused.
    - `toArray()` on a concurrent collection may return a stale snapshot -- the size may have changed between calling `size()` and `toArray()`.
    - Primitive arrays cannot be produced by `toArray()` -- use `stream().mapToInt(...).toArray()` for `int[]`.
    - `List.of().toArray(String[]::new)` returns `String[]` of length 0 (not null) -- safe to iterate without null checks.
    - For Streams: `stream.toArray(String[]::new)` is the equivalent -- same pattern, same reasoning.

??? question "Q35: What are the gotchas of subList()?"

    `subList()` returns a live view (not a copy) of the original list -- modifications to either affect both, structural changes to the original invalidate the subList, and the subList retains a reference to the entire backing list preventing GC.

    **Why:** Developers often assume `subList()` creates an independent list, leading to `ConcurrentModificationException` in production or memory leaks in long-lived applications. This question tests awareness of view semantics.

    **How:**

    `ArrayList.subList()` returns a `SubList` inner class that stores:

    - A reference to the parent `ArrayList`
    - The `offset` (start index in the parent)
    - The `size` of the sub-range
    - A snapshot of the parent's `modCount` at creation time

    Every operation on the SubList checks `parent.modCount == expectedModCount`. If the parent was structurally modified, it throws `ConcurrentModificationException`.

    ```java
    List<Integer> original = new ArrayList<>(List.of(1, 2, 3, 4, 5));
    List<Integer> sub = original.subList(1, 3); // [2, 3] -- live view

    // Modification through subList affects original
    sub.set(0, 99);       // original is now [1, 99, 3, 4, 5]
    sub.add(42);          // original is now [1, 99, 3, 42, 4, 5]

    // Structural modification to original invalidates subList
    original.add(6);      // modCount changes
    sub.get(0);           // ConcurrentModificationException!

    // Safe: create an independent copy
    List<Integer> safeCopy = new ArrayList<>(original.subList(1, 3));
    original.add(7);      // safeCopy is unaffected
    ```

    **When to use:**

    - **Range operations:** `subList(from, to).clear()` is the idiomatic way to remove a range from a list.
    - **Bulk algorithms:** Pass a sub-range to `Collections.sort()`, `Collections.shuffle()`, etc.
    - **Always create a copy** if the subList will outlive the current scope or if the original list will be modified.

    **Gotchas:**

    - **Memory leak:** A subList of 10 elements from a 10-million-element list keeps the entire 10-million-element array alive (the SubList references the parent, which references its internal `Object[]`). Solution: `new ArrayList<>(list.subList(a, b))`.
    - **Non-serializable:** `SubList` is not independently serializable in many implementations.
    - **ConcurrentModificationException from original:** Even `original.set(0, x)` does NOT cause CME (it is not structural), but `original.add(x)` or `original.remove(i)` DOES.
    - **Nested subLists:** `subList().subList()` works but creates a chain of views -- any structural modification to any ancestor invalidates all descendants.
    - **`List.of().subList()`:** Returns an immutable sub-range -- safe from modification but still a view (no copy made).

??? question "Q36: How should you safely remove elements during iteration?"

    Use `Iterator.remove()` for classic iteration, `removeIf()` (Java 8+) for the cleanest one-liner, or collect-then-removeAll for complex multi-step conditions. Never use a for-each loop with direct `list.remove()`.

    **Why:** Removing elements during iteration is one of the most common sources of `ConcurrentModificationException`. Interviewers want to see that you know multiple safe patterns and understand WHY the for-each approach fails.

    **How:** The for-each loop uses an implicit `Iterator` internally. Calling `list.remove()` modifies `modCount` without updating the iterator's `expectedModCount`, causing the next `iterator.next()` to detect the discrepancy and throw CME.

    ```java
    // WRONG: ConcurrentModificationException
    for (String s : list) {
        if (s.startsWith("x")) list.remove(s); // modifies list outside iterator
    }

    // APPROACH 1: Iterator.remove() -- classic, always works
    Iterator<String> it = list.iterator();
    while (it.hasNext()) {
        if (it.next().startsWith("x")) it.remove(); // safe: uses iterator's own remove
    }

    // APPROACH 2: removeIf() (Java 8+) -- cleanest and often fastest
    list.removeIf(s -> s.startsWith("x"));
    // ArrayList.removeIf() is optimized: single pass with bitset marking, then compaction

    // APPROACH 3: Collect candidates, then bulk remove
    List<String> toRemove = list.stream()
        .filter(s -> s.startsWith("x"))
        .collect(Collectors.toList());
    list.removeAll(toRemove);

    // APPROACH 4: Backward indexed loop (works but fragile)
    for (int i = list.size() - 1; i >= 0; i--) {
        if (list.get(i).startsWith("x")) list.remove(i);
    }

    // APPROACH 5: For concurrent collections (no CME by design)
    ConcurrentLinkedQueue<String> queue = new ConcurrentLinkedQueue<>(list);
    for (String s : queue) {
        if (s.startsWith("x")) queue.remove(s); // safe: weakly consistent
    }
    ```

    | Approach | Java version | Efficiency | Readability |
    |----------|-------------|------------|-------------|
    | `Iterator.remove()` | 1.2+ | O(n) per remove for ArrayList | Medium |
    | `removeIf()` | 8+ | O(n) single pass (optimized) | Best |
    | Collect + removeAll | 8+ | O(n + m) | Good for complex logic |
    | Backward loop | 1.2+ | O(n^2) worst case | Poor |

    **When to use:** Prefer `removeIf()` in all new code. Use `Iterator.remove()` when you need pre-Java-8 compatibility or need to process elements before deciding to remove.

    **Gotchas:**

    - `Iterator.remove()` can only be called ONCE per `next()` call -- calling it twice throws `IllegalStateException`.
    - `ArrayList.removeIf()` is optimized internally to avoid O(n^2) shifting: it marks elements with a `BitSet`, then compacts in one pass.
    - The backward-loop trick works only for `List` (not `Set` or `Queue`) and only because removing at index `i` does not affect indices < i.
    - `removeAll(Collection)` has O(n*m) complexity if the argument is a `List` -- wrap it in a `HashSet` for O(n) performance: `list.removeAll(new HashSet<>(toRemove))`.
    - For `Map`: use `entrySet().removeIf(entry -> condition)` -- this is the safe way to conditionally remove map entries.

??? question "Q37: How does Comparator.comparing() work and how do you chain comparators?"

    `Comparator.comparing()` takes a key-extraction function and returns a comparator that sorts by that key; `thenComparing()` chains additional comparators for multi-level sorting -- all composable and null-safe with utility methods.

    **Why:** Modern Java code uses declarative comparator composition instead of verbose anonymous classes. Interviewers test this to verify you write idiomatic Java 8+ code and understand functional interfaces and method references.

    **How:**

    `Comparator.comparing(Function<T, U> keyExtractor)` creates a `Comparator<T>` that:

    1. Applies the key extractor to both objects: `U key1 = keyExtractor.apply(o1)`, `U key2 = keyExtractor.apply(o2)`.
    2. Compares the extracted keys using their natural ordering (`Comparable.compareTo()`).
    3. Returns the comparison result.

    `thenComparing()` is used only when the previous comparison returns 0 (tie-breaking).

    ```java
    // Multi-level sort: department ASC, salary DESC, name ASC
    Comparator<Employee> comp = Comparator
        .comparing(Employee::getDepartment)                          // primary
        .thenComparing(Employee::getSalary, Comparator.reverseOrder()) // secondary (desc)
        .thenComparing(Employee::getName);                           // tertiary

    employees.sort(comp);

    // Null-safe comparators
    Comparator<Employee> nullSafe = Comparator
        .comparing(Employee::getManager, Comparator.nullsLast(Comparator.naturalOrder()))
        .thenComparing(Employee::getName);

    // Primitive-specialized (avoids autoboxing)
    Comparator<Employee> byAge = Comparator.comparingInt(Employee::getAge);
    Comparator<Employee> bySalary = Comparator.comparingDouble(Employee::getSalary);
    ```

    **Available composition utilities:**

    | Method | Purpose |
    |--------|---------|
    | `comparing(keyExtractor)` | Sort by extracted Comparable key |
    | `comparing(keyExtractor, keyComparator)` | Sort by key with custom comparator |
    | `comparingInt/Long/Double()` | Primitive-specialized (no boxing) |
    | `thenComparing()` | Tie-breaker (secondary sort) |
    | `reversed()` | Reverse the entire comparator |
    | `nullsFirst(comparator)` | Null elements sort first |
    | `nullsLast(comparator)` | Null elements sort last |
    | `naturalOrder()` | Natural ordering comparator |
    | `reverseOrder()` | Reverse natural ordering |

    **When to use:** Always prefer this declarative style over manual `compare()` implementations. It is more readable, less error-prone (no sign-flip bugs), and composable.

    **Gotchas:**

    - `reversed()` reverses the ENTIRE chain, not just the last level. To reverse only one level, pass `Comparator.reverseOrder()` to `thenComparing()`.
    - `nullsFirst()`/`nullsLast()` handle null elements (the objects being compared), not null keys. For null keys, wrap the key comparator: `comparing(Employee::getManager, nullsLast(naturalOrder()))`.
    - `comparingInt()` is preferred over `comparing(Employee::getAge)` because it avoids autoboxing `int` → `Integer` for every comparison.
    - The comparator returned by `comparing()` is NOT serializable by default -- if you need to serialize (e.g., for `TreeMap` in a distributed cache), implement `Comparator` explicitly.

??? question "Q38: Queue vs Deque -- what is the difference?"

    `Queue` is a FIFO structure with operations at one end (tail for insert, head for remove); `Deque` (Double-Ended Queue) extends `Queue` with operations at both ends, enabling it to function as both a queue (FIFO) and a stack (LIFO).

    **Why:** Interviewers test this to see if you understand the interface hierarchy and know that `Deque` is the modern replacement for both `Queue` and `Stack` use cases in Java.

    **How:**

    | Operation | Queue (FIFO) | Deque head (LIFO/stack) | Deque tail (FIFO/queue) |
    |-----------|-------------|------------------------|------------------------|
    | Insert | `offer(e)` / `add(e)` | `offerFirst(e)` / `push(e)` | `offerLast(e)` / `offer(e)` |
    | Remove | `poll()` / `remove()` | `pollFirst()` / `pop()` | `pollLast()` |
    | Examine | `peek()` / `element()` | `peekFirst()` / `peek()` | `peekLast()` |

    **Two-tier API (throw vs return special value):**

    | Outcome | Throws exception | Returns null/false |
    |---------|-----------------|-------------------|
    | Insert | `add(e)`, `addFirst(e)` | `offer(e)`, `offerFirst(e)` |
    | Remove | `remove()`, `removeFirst()` | `poll()`, `pollFirst()` |
    | Examine | `element()`, `getFirst()` | `peek()`, `peekFirst()` |

    ```java
    // Queue usage (FIFO) -- insert at tail, remove from head
    Queue<String> queue = new ArrayDeque<>();
    queue.offer("first");
    queue.offer("second");
    queue.poll(); // "first" (FIFO)

    // Deque as Stack (LIFO) -- push/pop at head
    Deque<String> stack = new ArrayDeque<>();
    stack.push("first");   // equivalent to addFirst()
    stack.push("second");
    stack.pop();           // "second" (LIFO), equivalent to removeFirst()

    // Deque as double-ended queue
    Deque<String> deque = new ArrayDeque<>();
    deque.offerFirst("front");
    deque.offerLast("back");
    deque.pollFirst(); // "front"
    deque.pollLast();  // "back"
    ```

    **When to use:**

    - **Queue:** BFS traversal, task scheduling, message passing (FIFO semantics).
    - **Deque as stack:** DFS traversal, undo/redo, expression evaluation (LIFO semantics). Replaces legacy `Stack` class.
    - **Deque as double-ended:** Sliding window algorithms, work-stealing schedulers, palindrome checking.

    **Gotchas:**

    - `Queue.poll()` and `Deque.pollFirst()` return `null` when empty -- if your queue legitimately contains null elements (only `LinkedList` allows this), you cannot distinguish "empty" from "null element."
    - `push()` and `pop()` on `Deque` operate on the **head** (first), not the tail -- this matches LIFO stack semantics but can be confusing if you think of "push" as "add to the end."
    - `ArrayDeque` does not allow `null` elements (used as sentinel). `LinkedList` allows `null` but makes empty-checking ambiguous.
    - The `Stack` class is legacy and should never be used -- it extends `Vector` (synchronized overhead) and exposes `List` methods that break stack abstraction.

??? question "Q39: Vector vs ArrayList -- why is Vector obsolete?"

    `Vector` is considered obsolete because it synchronizes every method (adding overhead even in single-threaded use), grows by 2x (wasting memory), and couples synchronization with the data structure -- modern alternatives like `ArrayList` + `Collections.synchronizedList()` or `CopyOnWriteArrayList` are always superior.

    **Why:** This question tests whether you understand separation of concerns in API design and know why the Java architects moved away from the "synchronize everything by default" approach of JDK 1.0.

    **How:**

    | Aspect | ArrayList | Vector |
    |--------|-----------|--------|
    | Synchronization | None (opt-in externally) | Every method `synchronized` (always-on) |
    | Growth factor | 1.5x (new = old + old>>1) | 2x (or custom `capacityIncrement`) |
    | Performance (single-threaded) | Fast (no lock overhead) | 30-50% slower (lock acquire/release on every call) |
    | Performance (multi-threaded) | N/A (not thread-safe) | Poor (global lock, all threads serialize) |
    | Iterator | Fail-fast | Fail-fast (also has legacy `Enumeration`) |
    | Since | JDK 1.2 | JDK 1.0 (legacy) |
    | Recommended | Yes | Never in new code |

    **Design problems with Vector:**

    1. **Always-on synchronization:** Even single-threaded code pays the lock overhead. With biased locking removed in Java 15+, this overhead is real.
    2. **2x growth:** Doubles capacity on each resize, wasting up to 50% of allocated memory. ArrayList's 1.5x is more memory-efficient.
    3. **Compound operations NOT atomic:** Even though individual methods are synchronized, `if (!vector.contains(x)) vector.add(x)` is NOT thread-safe (check-then-act race).
    4. **Exposes `Stack` subclass:** `Stack extends Vector` inherits all `List` methods (`get(0)`, `remove(i)`), violating the stack abstraction.

    ```java
    // Legacy -- never use in new code
    Vector<String> v = new Vector<>();
    v.addElement("old style"); // legacy method
    v.elementAt(0);            // legacy method

    // Modern equivalents
    List<String> list = new ArrayList<>();                    // single-threaded
    List<String> syncList = Collections.synchronizedList(list); // need sync
    CopyOnWriteArrayList<String> cowList = new CopyOnWriteArrayList<>(); // read-heavy
    ```

    **When to use:** Never use `Vector` in new code. The only valid reason to encounter it is maintaining legacy codebases (Swing `DefaultListModel`, some J2EE APIs).

    **Gotchas:**

    - `Vector` is not deprecated (unlike some truly obsolete classes) because too much legacy code depends on it -- but it is effectively deprecated by convention.
    - Some frameworks (Swing, older Servlet containers) still use `Vector` internally, so you may encounter it in stack traces.
    - `Collections.synchronizedList(new ArrayList<>())` has the same coarse-grained synchronization as `Vector` but allows you to choose when to apply it.
    - Java 15+ removed biased locking optimization, making `Vector`'s always-synchronized approach even more expensive.
    - `Stack` (extends `Vector`) should be replaced by `Deque<E> stack = new ArrayDeque<>()`.

??? question "Q40: Why should you prefer Deque over Stack?"

    `Deque` (specifically `ArrayDeque`) should always be preferred over `Stack` because it avoids synchronized overhead, does not expose `List` methods that break stack abstraction, and is the officially recommended replacement per the JDK documentation.

    **Why:** This tests whether you know about legacy vs modern Java idioms and understand API design principles like encapsulation. Using `Stack` in a code review is a red flag that signals unfamiliarity with modern Java best practices.

    **How:**

    | Aspect | `Stack` (legacy) | `Deque` via `ArrayDeque` (modern) |
    |--------|-----------------|-----------------------------------|
    | Inheritance | extends `Vector` extends `AbstractList` | implements `Deque` |
    | Synchronization | Every method (inherited from Vector) | None (opt-in externally if needed) |
    | Exposed methods | `push`, `pop`, `peek` PLUS `get(i)`, `set(i)`, `remove(i)`, `add(i)`, etc. | Only `push`, `pop`, `peek`, `offerFirst/Last`, `pollFirst/Last` |
    | Abstraction | Broken (can access any index) | Clean (only stack/deque operations) |
    | Performance | Slow (synchronized + object monitor) | Fast (no locking, cache-friendly array) |
    | Null support | Yes | No (null used as sentinel) |
    | Official stance | "A more complete and consistent set of LIFO stack operations is provided by the Deque interface" -- JDK Javadoc | Recommended |

    ```java
    // Legacy Stack -- avoid (leaks List abstraction)
    Stack<Integer> legacy = new Stack<>();
    legacy.push(1);
    legacy.push(2);
    legacy.get(0);     // 1 -- breaks stack! Should not be accessible
    legacy.remove(0);  // breaks stack! Can remove from middle
    legacy.add(0, 99); // breaks stack! Can insert at arbitrary position

    // Modern Deque -- preferred (clean abstraction)
    Deque<Integer> stack = new ArrayDeque<>();
    stack.push(1);
    stack.push(2);
    stack.pop();   // 2 (LIFO)
    stack.peek();  // 1 (view without removing)
    // No get(index), no add(index), no remove(index) -- stack abstraction enforced
    ```

    **When to use:**

    - **Always use `Deque`** (typically `ArrayDeque`) for stack behavior in new code.
    - Use `Deque` for queue behavior as well (`offer`/`poll`).
    - The only reason to touch `Stack` is maintaining legacy code.

    **Gotchas:**

    - `Stack.search(Object)` returns a 1-based distance from the top -- a unique method not available in `Deque`. If you need this, implement it manually or use `List.indexOf()` inverted.
    - `Deque.push()` adds to the **head** (first), not the tail -- this is LIFO correct but counter-intuitive if you think of "push" as "append."
    - If you need a thread-safe stack, use `ConcurrentLinkedDeque` or wrap `ArrayDeque` in explicit synchronization -- do NOT reach for `Stack` thinking "it is synchronized."
    - `ArrayDeque` does not allow `null` -- if your algorithm uses `null` as a sentinel in the stack, use `LinkedList` instead (implements `Deque` and allows null).
    - Declare the variable as `Deque<T>`, not `ArrayDeque<T>`, to program to the interface and allow easy swap of implementations.
