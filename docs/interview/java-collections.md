# Top 40 Java Collections Interview Questions & Answers

---

??? question "Q1: What is the Java Collections Framework hierarchy?"

    **Answer:** The framework has two root interfaces: `Collection` and `Map`.

    `Collection` extends `Iterable` and branches into three sub-interfaces:

    - **List** -- ordered, allows duplicates. Implementations: `ArrayList`, `LinkedList`, `Vector`.
    - **Set** -- no duplicates. Implementations: `HashSet`, `LinkedHashSet`, `TreeSet`.
    - **Queue** -- FIFO/priority ordering. Implementations: `PriorityQueue`, `ArrayDeque`. `Deque` extends `Queue` and supports double-ended operations.

    **Map** is a separate hierarchy (not extending `Collection`) that stores key-value pairs. Implementations: `HashMap`, `LinkedHashMap`, `TreeMap`, `ConcurrentHashMap`, `Hashtable`.

    ```
    Iterable
      └── Collection
            ├── List  (ArrayList, LinkedList, Vector)
            ├── Set   (HashSet, LinkedHashSet, TreeSet)
            └── Queue (PriorityQueue, ArrayDeque)
                  └── Deque (ArrayDeque, LinkedList)

    Map (HashMap, TreeMap, LinkedHashMap, ConcurrentHashMap)
    ```

??? question "Q2: ArrayList vs LinkedList -- what are the internal differences and when should you use each?"

    **Answer:** `ArrayList` is backed by a **resizable array** (`Object[]`). Random access is O(1), but insertion/removal in the middle is O(n) due to shifting. `LinkedList` is a **doubly-linked list** -- insertion/removal at known positions is O(1), but random access is O(n) because you must traverse nodes.

    | Operation | ArrayList | LinkedList |
    |-----------|-----------|------------|
    | `get(index)` | O(1) | O(n) |
    | `add(end)` | O(1) amortized | O(1) |
    | `add(middle)` | O(n) | O(1) if at iterator position |
    | `remove(middle)` | O(n) | O(1) if at iterator position |
    | Memory per element | ~4 bytes (reference) | ~24 bytes (Node object) |

    **Use ArrayList** when you mostly read/iterate (cache-friendly, less memory overhead). **Use LinkedList** only when you frequently insert/remove at the head or via iterators, or need a `Deque`. In practice, `ArrayList` is almost always the better choice due to CPU cache locality.

??? question "Q3: How does ArrayList resize internally?"

    **Answer:** `ArrayList` starts with a default capacity of **10**. When the internal array is full, it grows by roughly **50%** (new capacity = old capacity + old capacity >> 1, i.e., factor of 1.5). A new array is allocated and elements are copied via `Arrays.copyOf()`. This amortizes the cost of resizing to O(1) per insertion on average.

    ```
    Capacity progression: 10 → 15 → 22 → 33 → 49 → 73 → ...
    ```

    You can avoid repeated resizing by specifying an initial capacity or calling `ensureCapacity()`:

    ```java
    // Avoid resizing overhead for known sizes
    List<String> list = new ArrayList<>(10_000);

    // Or expand later
    ((ArrayList<String>) list).ensureCapacity(50_000);
    ```

    Note: `trimToSize()` can reclaim unused capacity after bulk removal.

??? question "Q4: How does HashMap work internally?"

    **Answer:** `HashMap` maintains an array of **buckets** (initially size 16, always a power of 2). Each bucket holds a linked list (or a **red-black tree** when a bucket has 8+ entries, since Java 8).

    **Key internals:**

    - **Hash perturbation:** `hash = key.hashCode() ^ (key.hashCode() >>> 16)` -- spreads higher bits into lower bits to reduce collisions.
    - **Bucket index:** `i = hash & (capacity - 1)` -- fast modulo using bitwise AND (works because capacity is a power of 2).
    - **Node structure:** Each node stores `hash`, `key`, `value`, and `next` pointer.
    - **Load factor:** Default is 0.75. When `size > capacity * loadFactor`, the table **doubles** in size and all entries are rehashed into new buckets.
    - **Treeification:** When a bucket reaches 8 entries, the linked list converts to a red-black tree (O(log n) vs O(n) lookup). Requires table size >= 64; otherwise it resizes instead.

    ```
    Bucket Array (length = 16)
    [0] → null
    [1] → Node("key1", hash=1) → Node("key17", hash=1) → null
    [2] → TreeNode (if 8+ collisions)
    ...
    [15] → null
    ```

??? question "Q5: Walk through how put() and get() work in HashMap."

    **Answer:**

    **`put(key, value)` step-by-step:**

    1. Compute `hash = hash(key.hashCode())` -- applies a spread function to reduce collisions.
    2. Find bucket index: `i = hash & (n - 1)` where `n` is the table length (always a power of 2).
    3. If the bucket is empty, insert a new `Node` directly.
    4. If the bucket is occupied, iterate the chain/tree:
        - If a key with the same hash **and** `equals()` is found, replace the value and return the old value.
        - Otherwise, append a new node at the end.
    5. If the chain length reaches **8** and the table has at least 64 buckets, treeify the bucket into a red-black tree.
    6. Increment size. If `size > capacity * loadFactor`, **resize** (double the table).

    **`get(key)` step-by-step:**

    1. Compute hash and bucket index.
    2. Check the first node -- if hash matches and `equals()` returns true, return its value.
    3. Otherwise, traverse the chain (or search the tree) until found or return `null`.

??? question "Q6: What happens when two keys have the same hashCode in a HashMap?"

    **Answer:** This is a **hash collision**. Both keys land in the same bucket. HashMap stores them as a linked list of nodes in that bucket. On `get()`, it traverses the list, comparing each entry's hash and calling `equals()` to find the exact key.

    **Treeification (Java 8+):**

    - When a bucket accumulates **8 or more** entries, the linked list converts to a **red-black tree**.
    - Lookup improves from O(n) to **O(log n)** for that bucket.
    - When the count drops below **6** (due to removals), it converts back to a linked list.
    - Treeification only happens if the table has at least **64 buckets**; otherwise HashMap prefers to resize.

    This protects against worst-case performance when keys have poor hash distribution or when a deliberate hash-collision attack targets a `HashMap`.

??? question "Q7: HashMap vs Hashtable vs ConcurrentHashMap -- what are the differences?"

    **Answer:**

    | Feature | HashMap | Hashtable | ConcurrentHashMap |
    |---------|---------|-----------|-------------------|
    | Thread-safe | No | Yes (synchronized) | Yes (fine-grained) |
    | Null keys/values | 1 null key, null values | Neither allowed | Neither allowed |
    | Performance | Fastest (single-thread) | Slow (full lock) | High concurrent throughput |
    | Iteration | Fail-fast | Fail-fast | Weakly consistent |
    | Legacy | No | Yes (since JDK 1.0) | No (since JDK 1.5) |

    **Use `ConcurrentHashMap`** for concurrent access. `Hashtable` is considered legacy.

??? question "Q8: How does ConcurrentHashMap achieve thread safety internally?"

    **Answer:**

    **Java 7 design:** The map was divided into **16 Segments**, each an independent mini-HashMap with its own lock. Concurrency level = number of segments. Reads required no lock; writes locked only the affected segment.

    **Java 8+ design (current):** Segments were removed. The new approach uses:

    - **CAS (Compare-And-Swap)** for inserts into empty buckets -- no locking needed.
    - **`synchronized` on the bucket head node** for updates to occupied buckets -- only that one bucket is locked.
    - **`volatile` reads** for the table and node values -- reads are lock-free.
    - **Cooperative resizing** -- multiple threads help transfer entries during resize, rather than one thread doing all the work.

    This achieves much higher concurrency than the old segment model because the lock granularity is per-bucket rather than per-segment.

??? question "Q9: Compare TreeMap, HashMap, and LinkedHashMap."

    **Answer:**

    - **HashMap**: O(1) average get/put, **no ordering** guarantee.
    - **LinkedHashMap**: O(1) average get/put, maintains **insertion order** (or access order if configured). Useful for LRU caches via `removeEldestEntry()`.
    - **TreeMap**: O(log n) get/put, maintains **sorted order** by keys (natural or custom `Comparator`). Implements `NavigableMap`, so it supports `floorKey()`, `ceilingKey()`, range views.

    ```java
    // LRU Cache with LinkedHashMap
    Map<K, V> lru = new LinkedHashMap<>(16, 0.75f, true) {
        protected boolean removeEldestEntry(Map.Entry<K, V> e) {
            return size() > MAX_SIZE;
        }
    };
    ```

??? question "Q10: How is HashSet implemented internally?"

    **Answer:** `HashSet` is backed by a **HashMap**. Every element added to the `HashSet` is stored as a **key** in the internal `HashMap`, with a dummy constant object (`PRESENT`) as the value. So `add(e)` calls `map.put(e, PRESENT)`, and `contains(e)` calls `map.containsKey(e)`. This means all the hashing, bucketing, and collision resolution of `HashMap` applies directly to `HashSet`.

    ```java
    // Simplified internal view
    private transient HashMap<E, Object> map;
    private static final Object PRESENT = new Object();

    public boolean add(E e) {
        return map.put(e, PRESENT) == null; // true if new element
    }
    ```

    Similarly, `LinkedHashSet` is backed by `LinkedHashMap`, and `TreeSet` is backed by `TreeMap`.

??? question "Q11: How does HashSet ensure uniqueness of elements?"

    **Answer:** When you call `add(element)`, it delegates to the internal `HashMap.put(element, PRESENT)`. `HashMap.put()` computes the hash, finds the bucket, and checks existing entries using `hashCode()` first, then `equals()`. If an existing key is found with the same hash and `equals()` returns `true`, the old value is replaced (but since the value is always `PRESENT`, effectively nothing changes) and `put()` returns the old value, signaling that the element was a duplicate. Therefore, **both `hashCode()` and `equals()` must be correctly overridden** for custom objects stored in a `HashSet`.

??? question "Q12: What are the differences between Iterator, ListIterator, and Enumeration?"

    **Answer:**

    - **Enumeration**: Legacy (since JDK 1.0), only `hasMoreElements()` and `nextElement()`. Forward-only, no remove. Used with `Vector` and `Hashtable`.
    - **Iterator**: Replaces Enumeration. `hasNext()`, `next()`, `remove()`. Forward-only, works on any `Collection`.
    - **ListIterator**: Extends Iterator for `List` only. Supports **bidirectional** traversal (`hasPrevious()`, `previous()`), **add**, **set**, and getting the current index.

    ```java
    ListIterator<String> it = list.listIterator();
    while (it.hasNext()) {
        if (it.next().equals("old")) it.set("new"); // replace in-place
    }
    ```

??? question "Q13: What are fail-fast and fail-safe iterators?"

    **Answer:** **Fail-fast** iterators (e.g., from `ArrayList`, `HashMap`) detect structural modification during iteration by checking a `modCount` field. If the collection is modified outside the iterator, a `ConcurrentModificationException` is thrown. **Fail-safe** (weakly consistent) iterators (e.g., from `ConcurrentHashMap`, `CopyOnWriteArrayList`) work on a snapshot or tolerate concurrent modification -- they never throw `ConcurrentModificationException` but may not reflect the latest changes.

    ```java
    // Fail-fast -- throws ConcurrentModificationException
    for (String s : list) {
        list.remove(s); // BAD
    }
    // Safe alternative
    Iterator<String> it = list.iterator();
    while (it.hasNext()) {
        if (it.next().equals("x")) it.remove(); // OK
    }
    ```

??? question "Q14: Comparable vs Comparator -- when do you use each?"

    **Answer:** **Comparable** defines the **natural ordering** of a class by implementing `compareTo()` inside the class itself. There can be only one natural order. **Comparator** is an **external** strategy for comparison -- you can define multiple comparators for different sort orders without modifying the class.

    ```java
    // Comparable -- single natural order
    class Employee implements Comparable<Employee> {
        public int compareTo(Employee o) { return this.name.compareTo(o.name); }
    }
    // Comparator -- multiple strategies
    Comparator<Employee> bySalary = Comparator.comparingDouble(Employee::getSalary);
    Comparator<Employee> byAge = Comparator.comparingInt(Employee::getAge);
    ```

??? question "Q15: How does Collections.sort() work internally?"

    **Answer:** `Collections.sort()` delegates to `List.sort()`, which uses **TimSort** (since Java 7). TimSort is a hybrid of merge sort and insertion sort designed to exploit partially sorted data.

    **How TimSort works:**

    1. Scan the array for natural **runs** (already sorted subsequences).
    2. If a run is shorter than a minimum run length (typically 32), extend it with **binary insertion sort**.
    3. Push runs onto a stack and **merge** them using a carefully balanced strategy (maintains stack invariants to guarantee at most O(log n) merges).

    | Property | Value |
    |----------|-------|
    | Worst case | O(n log n) |
    | Best case (nearly sorted) | **O(n)** |
    | Space | O(n) |
    | Stable | Yes |

    For **primitive arrays**, `Arrays.sort()` uses **Dual-Pivot Quicksort** instead (not stable, but faster in practice for primitives).

??? question "Q16: How does PriorityQueue work internally?"

    **Answer:** `PriorityQueue` is backed by a **min-heap** (binary heap stored as an array). The smallest element (by natural ordering or a `Comparator`) is always at the root.

    **Operations and time complexity:**

    | Operation | Complexity | Description |
    |-----------|-----------|-------------|
    | `offer()`/`add()` | O(log n) | Insert and sift up |
    | `poll()` | O(log n) | Remove root, sift down |
    | `peek()` | O(1) | View the min/max without removing |
    | `remove(Object)` | O(n) | Linear search + sift |
    | `contains()` | O(n) | Linear search |

    **Important:** Iteration order is **NOT sorted** -- the heap property only guarantees the root is the min/max. Only calling `poll()` repeatedly gives elements in priority order. Not thread-safe (use `PriorityBlockingQueue` for concurrency).

    ```java
    // Max-heap example
    PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());
    maxHeap.offer(3); maxHeap.offer(1); maxHeap.offer(5);
    maxHeap.poll(); // returns 5

    // Custom objects
    PriorityQueue<Task> tasks = new PriorityQueue<>(
        Comparator.comparingInt(Task::getPriority)
    );
    ```

??? question "Q17: ArrayDeque vs LinkedList as a Deque -- which is better?"

    **Answer:** **ArrayDeque** is almost always better.

    | Aspect | ArrayDeque | LinkedList |
    |--------|-----------|------------|
    | Backing | Circular resizable array | Doubly-linked nodes |
    | Cache performance | Excellent (contiguous memory) | Poor (scattered nodes) |
    | Memory per element | ~4 bytes (reference only) | ~24 bytes (Node object) |
    | Null elements | Not allowed | Allowed |
    | Implements List | No | Yes |
    | Push/pop at both ends | Amortized O(1) | O(1) |

    The only reasons to choose `LinkedList` are if you need `null` elements or need the `List` interface. For stack or queue use cases, **prefer ArrayDeque**.

??? question "Q18: What are EnumSet and EnumMap, and why use them?"

    **Answer:** **EnumSet** is a specialized `Set` for enum types, implemented internally as a **bit vector** (one bit per enum constant). Operations like add, remove, and contains are O(1) bitwise operations -- extremely fast and memory-efficient. **EnumMap** is a specialized `Map` with enum keys, backed by a simple **array** indexed by the enum ordinal. Both are much faster than `HashSet`/`HashMap` for enum types and maintain natural enum ordering.

    ```java
    EnumSet<Day> weekend = EnumSet.of(Day.SATURDAY, Day.SUNDAY);
    EnumMap<Day, String> tasks = new EnumMap<>(Day.class);
    tasks.put(Day.MONDAY, "standup");
    ```

??? question "Q19: What is WeakHashMap and when would you use it?"

    **Answer:** `WeakHashMap` stores keys as **weak references**. When a key has no strong references left, the garbage collector can reclaim it, and the entry is automatically removed from the map on subsequent access.

    **Use cases:**

    - **Caches** where cached data should be evictable when the key object is no longer in use.
    - **Canonicalization maps** that associate metadata with objects without preventing GC.
    - **Listener registries** where you don't want to force callers to explicitly deregister.

    ```java
    WeakHashMap<Object, String> cache = new WeakHashMap<>();
    Object key = new Object();
    cache.put(key, "metadata");
    key = null;     // no more strong references to the key
    System.gc();    // entry becomes eligible for removal
    cache.size();   // likely 0
    ```

    **Caveat:** Values are held with strong references. If a value references its own key, the key will never be GC'd. Use a `WeakReference` for the value in such cases.

??? question "Q20: What is IdentityHashMap and how is it different from HashMap?"

    **Answer:** `IdentityHashMap` uses **reference equality** (`==`) instead of `equals()` for comparing keys, and `System.identityHashCode()` instead of `hashCode()`. Two keys are the same only if they are the exact same object. Use cases include **serialization graphs**, **topology-preserving transformations**, and **proxy-to-original mappings** where logical equality is not desired.

    ```java
    IdentityHashMap<String, Integer> map = new IdentityHashMap<>();
    String a = new String("key");
    String b = new String("key");
    map.put(a, 1);
    map.put(b, 2);
    map.size(); // 2 -- different objects, even though equals() is true
    ```

??? question "Q21: Collections.unmodifiableList() vs List.of() vs List.copyOf() -- what is the difference?"

    **Answer:**

    | Feature | `unmodifiableList()` | `List.of()` | `List.copyOf()` |
    |---------|---------------------|-------------|-----------------|
    | Java version | 1.2+ | 9+ | 10+ |
    | Truly immutable | No (view only) | Yes | Yes |
    | Allows nulls | Yes | No | No |
    | Reflects source changes | Yes | N/A | No |
    | Memory | Wraps original | Compact | Compact copy |

    ```java
    List<String> original = new ArrayList<>(List.of("a", "b"));
    List<String> view = Collections.unmodifiableList(original);
    original.add("c");
    view.size(); // 3 -- view reflects the change!

    List<String> immutable = List.of("a", "b");
    List<String> copy = List.copyOf(original);
    original.add("d");
    copy.size(); // 3 -- copy is independent
    ```

??? question "Q22: How can you make a collection thread-safe?"

    **Answer:** Several approaches, each with trade-offs:

    1. **`Collections.synchronizedList/Map/Set()`** -- wraps every method with `synchronized`. Simple but coarse-grained; iteration still needs external sync.
    2. **Concurrent collections** (`ConcurrentHashMap`, `CopyOnWriteArrayList`, `ConcurrentLinkedQueue`) -- designed for concurrency with better performance.
    3. **External synchronization** -- wrap access in your own `synchronized` block or `ReentrantLock`.
    4. **Immutable collections** (`List.of()`, `Collections.unmodifiableList()`) -- inherently thread-safe since no mutation is possible.

    ```java
    // Approach 1: synchronized wrapper (iteration still needs manual sync)
    List<String> syncList = Collections.synchronizedList(new ArrayList<>());
    synchronized (syncList) {
        for (String s : syncList) { /* safe iteration */ }
    }

    // Approach 2: concurrent collection (no external sync needed)
    ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();
    map.computeIfAbsent("key", k -> expensiveCompute(k)); // atomic
    ```

??? question "Q23: Collections.synchronizedList() vs CopyOnWriteArrayList -- when to use which?"

    **Answer:**

    | Aspect | `synchronizedList()` | `CopyOnWriteArrayList` |
    |--------|---------------------|----------------------|
    | Write cost | O(1) amortized | O(n) -- copies entire array |
    | Read cost | Synchronized (blocks) | Lock-free |
    | Iteration safety | Needs manual sync | Snapshot-based, safe |
    | Best for | Write-heavy workloads | Read-heavy workloads |
    | Memory | Single backing array | Copy on each write |

    Use `CopyOnWriteArrayList` when **reads vastly outnumber writes** (e.g., listener lists, event handlers, configuration registries). Use `synchronizedList` when writes are frequent or the list is large (copying would be too expensive).

??? question "Q24: What is ConcurrentSkipListMap?"

    **Answer:** `ConcurrentSkipListMap` is a concurrent, sorted `NavigableMap` based on a **skip list** data structure. It provides O(log n) expected time for `get`, `put`, and `remove`, with lock-free reads and fine-grained locking for writes. It is the concurrent equivalent of `TreeMap`.

    **When to use:**

    - Need a **sorted, thread-safe map** -- `TreeMap` is not thread-safe, and `ConcurrentHashMap` is not sorted.
    - Need concurrent **range queries** (`subMap`, `headMap`, `tailMap`).
    - Also comes with `ConcurrentSkipListSet` for a concurrent sorted set.

    ```java
    ConcurrentSkipListMap<String, Integer> map = new ConcurrentSkipListMap<>();
    map.put("banana", 2);
    map.put("apple", 1);
    map.put("cherry", 3);
    map.firstKey();              // "apple" (sorted)
    map.subMap("a", "c");       // {apple=1, banana=2}
    ```

??? question "Q25: Explain BlockingQueue and its main implementations."

    **Answer:** `BlockingQueue` extends `Queue` with blocking operations: `put()` blocks if the queue is full, `take()` blocks if empty. It is the backbone of **producer-consumer** patterns.

    | Implementation | Backing | Bounded? | Notes |
    |----------------|---------|----------|-------|
    | `ArrayBlockingQueue` | Array | Yes | Fair/unfair locking option |
    | `LinkedBlockingQueue` | Linked nodes | Optionally | Separate put/take locks, higher throughput |
    | `PriorityBlockingQueue` | Heap | No (unbounded) | Priority-ordered |
    | `SynchronousQueue` | None | Zero-capacity | Direct handoff, no storage |
    | `DelayQueue` | Heap | No | Elements available after delay |

    ```java
    // Producer-Consumer with BlockingQueue
    BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);

    // Producer thread
    queue.put(task);       // blocks if full

    // Consumer thread
    Task task = queue.take(); // blocks if empty
    ```

    `BlockingQueue` also has non-blocking (`offer`/`poll`) and timed (`offer(e, timeout, unit)`) variants.

??? question "Q26: What are NavigableMap and NavigableSet?"

    **Answer:** `NavigableMap` (extends `SortedMap`) and `NavigableSet` (extends `SortedSet`) provide **navigation methods** for closest-match lookups: `floorKey/Entry()` (greatest key <= given), `ceilingKey/Entry()` (smallest key >= given), `lowerKey()`, `higherKey()`, `descendingMap()`, and range sub-views (`subMap`, `headMap`, `tailMap`). `TreeMap` implements `NavigableMap`; `TreeSet` implements `NavigableSet`.

    ```java
    TreeMap<Integer, String> map = new TreeMap<>();
    map.put(1, "a"); map.put(5, "b"); map.put(10, "c");
    map.floorKey(7);   // 5
    map.ceilingKey(7);  // 10
    ```

??? question "Q27: What is a Spliterator and how does it relate to parallel streams?"

    **Answer:** `Spliterator` (Splitable Iterator, Java 8) is designed for **parallel traversal** of data sources.

    **Key methods:**

    - `tryAdvance(Consumer)` -- process one element and return `true`, or `false` if exhausted.
    - `forEachRemaining(Consumer)` -- bulk traversal of remaining elements.
    - `trySplit()` -- partition the data into two halves; returns a new `Spliterator` for the first half.
    - `estimateSize()` -- approximate number of remaining elements.
    - `characteristics()` -- flags like `ORDERED`, `SIZED`, `SORTED`, `DISTINCT`.

    The Stream API uses Spliterators internally: when you call `parallelStream()`, the ForkJoinPool repeatedly calls `trySplit()` to divide work among threads. `ArrayList`'s Spliterator can split by index range (efficient). `LinkedList`'s Spliterator cannot split well, which is why parallel streams on linked lists perform poorly.

    ```java
    Spliterator<String> full = list.spliterator();
    Spliterator<String> firstHalf = full.trySplit(); // splits off first half
    // full now covers only the second half
    ```

??? question "Q28: Why doesn't Map extend Collection?"

    **Answer:** `Collection` models a group of **single elements** with methods like `add(E)`, `remove(Object)`, and `iterator()`. `Map` models **key-value pairs**, so its fundamental operations are `put(K, V)` and `get(K)`.

    **Why they are separate:**

    - A `Map` is not a collection of elements -- it's a collection of **mappings** (key-value pairs).
    - `Collection.add(E)` takes one element. What would `Map.add()` take? A key? A value? An entry?
    - `Collection.equals()` semantics differ from `Map.equals()`.
    - Forcing inheritance would violate the Liskov Substitution Principle.

    Instead, `Map` provides **collection views** to bridge the two worlds:

    - `map.keySet()` -- a `Set<K>` view of all keys.
    - `map.values()` -- a `Collection<V>` view of all values.
    - `map.entrySet()` -- a `Set<Map.Entry<K,V>>` view of all mappings.

??? question "Q29: What is the equals() and hashCode() contract, and why does it matter for Map keys?"

    **Answer:** The contract states:

    1. If `a.equals(b)` is `true`, then `a.hashCode() == b.hashCode()` **must** be true.
    2. If `a.hashCode() != b.hashCode()`, then `a.equals(b)` **must** be `false`.
    3. If `a.hashCode() == b.hashCode()`, `a.equals(b)` may or may not be `true` (collisions are allowed).

    If you override `equals()` without overriding `hashCode()`, two logically equal objects can end up in **different buckets** in a `HashMap`, making it impossible to retrieve values by an equal key. This leads to silent data loss:

    ```java
    class Person {
        String name;
        @Override public boolean equals(Object o) { /* compares name */ }
        // MISSING hashCode() override!
    }
    Map<Person, String> map = new HashMap<>();
    map.put(new Person("Alice"), "engineer");
    map.get(new Person("Alice")); // null! Different hashCode → different bucket
    ```

??? question "Q30: What happens if you mutate a key object after inserting it into a HashMap?"

    **Answer:** The entry becomes **unreachable**. When the key was inserted, its `hashCode()` determined the bucket. If you mutate the key such that its `hashCode()` changes, a `get()` with the (now mutated) key computes a **different bucket index**, so the entry is not found. The original entry still sits in the old bucket, occupying memory but inaccessible.

    ```java
    List<String> key = new ArrayList<>(List.of("a"));
    Map<List<String>, String> map = new HashMap<>();
    map.put(key, "value");
    key.add("b");           // mutates the key, changes its hashCode
    map.get(key);            // null -- looks in wrong bucket
    map.containsKey(key);    // false
    map.size();              // 1 -- entry is still there, but orphaned
    ```

    This is effectively a **memory leak**. Rule: **Map keys should be immutable** (use `String`, `Integer`, records, or custom immutable classes). At minimum, the fields used in `hashCode()`/`equals()` must never change after insertion.

??? question "Q31: What are the best practices for initial capacity and load factor in HashMap?"

    **Answer:** The default capacity is **16** and load factor is **0.75**, meaning resize triggers when the map reaches 12 entries. If you know the expected number of entries `n`, set initial capacity to avoid resizing:

    ```java
    // For 100 expected entries: 100 / 0.75 = 134, round up to next power of 2 = 256
    Map<String, String> map = new HashMap<>(134);

    // Java 19+: let the JDK compute it
    Map<String, String> map2 = HashMap.newHashMap(100);

    // Guava
    Map<String, String> map3 = Maps.newHashMapWithExpectedSize(100);
    ```

    **Load factor guidelines:**

    - **0.75 (default)** -- good balance of space and speed for most use cases.
    - **Higher (e.g., 0.9)** -- saves memory but increases collision probability and lookup time.
    - **Lower (e.g., 0.5)** -- faster lookups but wastes memory.
    - **Never** set it below 0.25 or above 1.0.

??? question "Q32: What are the Java 9+ factory methods for creating collections?"

    **Answer:** Java 9 introduced concise factory methods that create **immutable** collections:

    ```java
    List<String> list = List.of("a", "b", "c");        // immutable list
    Set<String> set = Set.of("a", "b", "c");            // immutable set
    Map<String, Integer> map = Map.of("a", 1, "b", 2);  // immutable map (up to 10 entries)
    Map<String, Integer> map2 = Map.ofEntries(           // any number of entries
        Map.entry("a", 1), Map.entry("b", 2)
    );
    ```

    Key properties: **null elements/keys/values are not allowed**, duplicate elements/keys throw `IllegalArgumentException`, iteration order of `Set.of()` and `Map.of()` is deliberately **randomized** across JVM runs, and all mutating operations throw `UnsupportedOperationException`.

??? question "Q33: Stream vs Collection -- what is the fundamental difference?"

    **Answer:** A **Collection** is an in-memory data structure that **stores** elements -- you can add, remove, and iterate repeatedly. A **Stream** is a **pipeline of computation** over a data source -- it does not store elements.

    | Aspect | Collection | Stream |
    |--------|-----------|--------|
    | Stores data | Yes | No (pipeline) |
    | Eagerness | Eager | Lazy (until terminal op) |
    | Reusable | Yes | Single-use |
    | Can be infinite | No | Yes (`Stream.generate()`) |
    | Parallelism | Manual | Built-in (`parallelStream()`) |
    | Modifiable | Yes (most) | No mutation of source |

    Think of a Collection as a warehouse and a Stream as a conveyor belt. You can walk through the warehouse repeatedly, but the conveyor belt runs once and items are gone after processing.

??? question "Q34: What are the pitfalls of toArray() in collections?"

    **Answer:** `toArray()` with no arguments returns `Object[]`, which cannot be cast to a typed array: `String[] arr = (String[]) list.toArray()` throws `ClassCastException`. Use the typed overload:

    ```java
    // Correct approaches
    String[] arr1 = list.toArray(new String[0]);         // recommended since Java 6
    String[] arr2 = list.toArray(String[]::new);         // Java 11+ method reference
    ```

    Passing `new String[0]` is preferred over `new String[list.size()]` because the JVM can optimize zero-length array allocation and avoids a race condition if the list size changes between the `size()` call and `toArray()`.

??? question "Q35: What are the gotchas of subList()?"

    **Answer:** `subList()` returns a **view** of the original list, not a copy. Modifications to the subList affect the original, and vice versa. However, **structural modifications** to the original list (add/remove) after creating a subList invalidate it -- subsequent operations on the subList throw `ConcurrentModificationException`. Also, the subList holds a reference to the entire original list, which can prevent garbage collection of a large list.

    ```java
    List<Integer> original = new ArrayList<>(List.of(1, 2, 3, 4, 5));
    List<Integer> sub = original.subList(1, 3); // [2, 3] -- view
    sub.set(0, 99);       // original is now [1, 99, 3, 4, 5]
    original.add(6);      // DANGER: sub is now invalid
    sub.get(0);           // throws ConcurrentModificationException
    ```

??? question "Q36: How should you safely remove elements during iteration?"

    **Answer:** Three safe approaches:

    ```java
    // 1. Iterator.remove() -- classic, always works
    Iterator<String> it = list.iterator();
    while (it.hasNext()) {
        if (it.next().startsWith("x")) it.remove();
    }

    // 2. removeIf() (Java 8+) -- cleanest
    list.removeIf(s -> s.startsWith("x"));

    // 3. Collect and remove (for complex conditions)
    List<String> toRemove = list.stream()
        .filter(s -> s.startsWith("x"))
        .collect(Collectors.toList());
    list.removeAll(toRemove);
    ```

    **Never** use a for-each loop with `list.remove()` -- it causes `ConcurrentModificationException`. A backward indexed for-loop also works but is error-prone.

??? question "Q37: How does Comparator.comparing() work and how do you chain comparators?"

    **Answer:** `Comparator.comparing()` creates a comparator from a key-extraction function. You chain them with `thenComparing()` for multi-level sorting:

    ```java
    Comparator<Employee> comp = Comparator
        .comparing(Employee::getDepartment)
        .thenComparing(Employee::getSalary, Comparator.reverseOrder())
        .thenComparing(Employee::getName);

    employees.sort(comp);
    ```

    Additional utilities: `Comparator.reverseOrder()`, `Comparator.naturalOrder()`, `Comparator.nullsFirst()`, `Comparator.nullsLast()`. These are composable and eliminate the need for verbose anonymous classes.

??? question "Q38: Queue vs Deque -- what is the difference?"

    **Answer:** **Queue** is a FIFO (First-In-First-Out) structure with operations at **one end only**: `offer()`/`add()` at the tail, `poll()`/`remove()` at the head. **Deque** (Double-Ended Queue) extends `Queue` and supports insertion and removal at **both ends**.

    ```java
    // Queue usage (FIFO)
    Queue<String> queue = new ArrayDeque<>();
    queue.offer("first");
    queue.offer("second");
    queue.poll(); // "first"

    // Deque as stack (LIFO)
    Deque<String> stack = new ArrayDeque<>();
    stack.push("first");
    stack.push("second");
    stack.pop(); // "second"

    // Deque methods: offerFirst(), offerLast(), pollFirst(), pollLast()
    ```

    Implementations: `ArrayDeque` (preferred for both stack and queue), `LinkedList`. The `Stack` class is legacy -- use `Deque` as a stack instead.

??? question "Q39: Vector vs ArrayList -- why is Vector obsolete?"

    **Answer:**

    | Aspect | ArrayList | Vector |
    |--------|-----------|--------|
    | Synchronization | None | Every method synchronized |
    | Growth factor | 1.5x | 2x (wastes more memory) |
    | Performance | Fast (no lock overhead) | Slow (even single-threaded) |
    | Iterator | Fail-fast | Fail-fast |
    | Since | JDK 1.2 | JDK 1.0 (legacy) |

    `Vector` synchronizes **every method**, adding overhead even when thread safety is not needed. When thread safety **is** needed, `Collections.synchronizedList()` or `CopyOnWriteArrayList` are superior alternatives because they separate the concern of synchronization from the data structure. `Vector`'s companion class `Stack` is also legacy -- prefer `ArrayDeque`.

??? question "Q40: Why should you prefer Deque over Stack?"

    **Answer:** `Stack` extends `Vector`, inheriting all its synchronized overhead and `List` methods (like `get(index)`) that break the stack abstraction. `Deque` (specifically `ArrayDeque`) is faster (unsynchronized), cleaner (only exposes stack/queue operations), and is the **officially recommended** replacement as stated in the Java documentation.

    ```java
    // Legacy -- avoid
    Stack<Integer> stack = new Stack<>();
    stack.push(1);
    stack.get(0); // breaks stack abstraction

    // Modern -- preferred
    Deque<Integer> stack = new ArrayDeque<>();
    stack.push(1);
    stack.pop();
    ```
