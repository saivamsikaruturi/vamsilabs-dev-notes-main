---
title: "Java Collections Interview Questions — Top 40 with Answers"
description: "Top Java Collections Framework interview questions with answers. Covers List, Set, Map, HashMap internals, TreeMap, LinkedHashMap, ConcurrentHashMap, fail-fast vs fail-safe iterators — asked at FAANG and top Java shops."
---

# Java Collections Interview Questions

The Java Collections Framework is asked in **every** Java interview. This page covers the 40 most frequently asked questions with concise, interview-ready answers — from core interfaces to internal implementation details that separate senior candidates from juniors.

**What interviewers test:** Not just "what is ArrayList" but *why* you'd pick one collection over another, what breaks under concurrent access, and what's happening inside `HashMap` when you call `put()`.

---

## Core Interfaces

**1. What is the Java Collections Framework?**

A unified architecture for representing and manipulating collections. Key interfaces: `Collection` (root) → `List`, `Set`, `Queue`. `Map` is separate (not a `Collection`). `Collections` (utility class) and `Arrays` provide static helpers. Introduced in Java 2, heavily enhanced in Java 8 with streams.

**2. What is the difference between `Collection` and `Collections`?**

`Collection` is the **interface** — root of the collection hierarchy (`List`, `Set`, `Queue` extend it). `Collections` is a **utility class** with static methods: `sort()`, `shuffle()`, `unmodifiableList()`, `synchronizedList()`, `frequency()`, `disjoint()`.

**3. What is the difference between `List`, `Set`, and `Map`?**

| Interface | Ordered | Duplicates | Null | Key interface |
|---|---|---|---|---|
| `List` | Yes (index) | Yes | Yes | `ArrayList`, `LinkedList` |
| `Set` | No (except `LinkedHashSet`, `TreeSet`) | No | One null (`HashSet`) | `HashSet`, `TreeSet` |
| `Map` | No (except `LinkedHashMap`, `TreeMap`) | Keys: No, Values: Yes | One null key (`HashMap`) | `HashMap`, `TreeMap` |

**4. What is the difference between `Comparable` and `Comparator`?**

`Comparable` defines the **natural ordering** of a class — implement `compareTo()` in the class itself. `Comparator` defines **external/custom ordering** — implement `compare()` in a separate class or lambda. Use `Comparator` when you need multiple sort orders or can't modify the class.

```java
// Comparable — natural order (by salary)
class Employee implements Comparable<Employee> {
    public int compareTo(Employee o) { return this.salary - o.salary; }
}

// Comparator — custom order (by name)
employees.sort(Comparator.comparing(Employee::getName));
```

→ Deep dive: [Comparable vs Comparator](../java/ComparableComparator.md)

---

## List Implementations

**5. What is the difference between `ArrayList` and `LinkedList`?**

| | `ArrayList` | `LinkedList` |
|---|---|---|
| Internal structure | Dynamic array | Doubly linked list |
| Random access (`get(i)`) | O(1) | O(n) |
| Insert/delete at end | O(1) amortized | O(1) |
| Insert/delete at middle | O(n) — shifts elements | O(1) — pointer update |
| Memory | Less (no node overhead) | More (prev/next pointers per node) |
| Cache performance | Better (contiguous memory) | Worse (scattered nodes) |

**Use `ArrayList` by default.** `LinkedList` wins only for frequent insertions/deletions at the head or as a `Deque`.

**6. How does `ArrayList` grow internally?**

Initial capacity is 10. When full, grows to `oldCapacity * 1.5` (roughly). Uses `Arrays.copyOf()` to copy to a new array — O(n) growth operation, but amortized O(1) per add. Pre-size with `new ArrayList<>(expectedSize)` if you know the size upfront.

**7. What is the difference between `ArrayList` and `Vector`?**

`Vector` is the legacy synchronized version of `ArrayList` — every method is `synchronized`. This makes it thread-safe but slow. Never use `Vector` in new code — use `ArrayList` with `Collections.synchronizedList()` or `CopyOnWriteArrayList` for concurrent use.

**8. What does `Arrays.asList()` return and what are its limitations?**

Returns a **fixed-size `List`** backed by the array — you can `set()` elements but cannot `add()` or `remove()` (throws `UnsupportedOperationException`). Backed means changes to the list reflect in the original array. Use `new ArrayList<>(Arrays.asList(...))` for a mutable copy. Java 9+: prefer `List.of()` for truly immutable lists.

---

## Set Implementations

**9. How does `HashSet` work internally?**

`HashSet` is backed by a `HashMap` — elements are stored as keys, a dummy `PRESENT` object as the value. Uniqueness is enforced by `HashMap`'s key uniqueness (via `hashCode()` + `equals()`). O(1) average for add/remove/contains. No ordering guarantee.

**10. What is the difference between `HashSet`, `LinkedHashSet`, and `TreeSet`?**

| | `HashSet` | `LinkedHashSet` | `TreeSet` |
|---|---|---|---|
| Order | None | Insertion order | Sorted (natural or `Comparator`) |
| Performance | O(1) | O(1) | O(log n) |
| Null | Yes (one) | Yes (one) | No (unless custom `Comparator`) |
| Backed by | `HashMap` | `LinkedHashMap` | `TreeMap` (Red-Black tree) |

**Use `TreeSet`** when you need sorted order or range operations (`headSet()`, `tailSet()`, `floor()`, `ceiling()`).

---

## Map Implementations

**11. How does `HashMap` work internally?**

An array of buckets (default 16). For each key: compute `hash(key.hashCode())`, find bucket index via `hash & (n-1)`. Within the bucket, store as a linked list (Java 7) or linked list → Red-Black tree when bucket size exceeds 8 (Java 8+). On `get()`, same hash → traverse bucket for `equals()` match.

**12. What happens when two keys have the same `hashCode()`?**

They land in the same bucket — a **hash collision**. Java 8: stored as a linked list (O(n) worst case). When a bucket exceeds 8 entries and the table has ≥64 buckets, it converts to a Red-Black tree (O(log n) worst case). This is called **treeification**.

**13. What is the load factor in `HashMap`?**

Default load factor is **0.75** — when the map is 75% full, it **rehashes** (doubles capacity, redistributes all entries). Lower load factor = fewer collisions, more memory. Higher = more collisions, less memory. Rehashing is O(n) — pre-size with `new HashMap<>(expectedSize / 0.75 + 1)` to avoid it.

→ Deep dive: [HashMap Internals](../java/HashMapInternals.md)

**14. Why must you override both `hashCode()` and `equals()` when using objects as Map keys?**

`HashMap` uses `hashCode()` to find the bucket, then `equals()` to find the exact key within the bucket. If you override `equals()` but not `hashCode()`:
- Two "equal" objects get different hash codes → land in different buckets → `get()` returns `null` even though the key "exists"

Contract: if `a.equals(b)` then `a.hashCode() == b.hashCode()` (reverse is not required).

**15. What is the difference between `HashMap`, `LinkedHashMap`, and `TreeMap`?**

| | `HashMap` | `LinkedHashMap` | `TreeMap` |
|---|---|---|---|
| Order | None | Insertion or access order | Sorted by key |
| Performance | O(1) avg | O(1) avg | O(log n) |
| Null keys | Yes (one) | Yes (one) | No |
| Use for | General purpose | LRU cache, ordered iteration | Range queries, sorted maps |

**16. How do you implement an LRU cache using `LinkedHashMap`?**

```java
class LRUCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;
    LRUCache(int capacity) {
        super(capacity, 0.75f, true); // accessOrder=true
        this.capacity = capacity;
    }
    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;
    }
}
```

`accessOrder=true` moves accessed entries to the end. `removeEldestEntry()` evicts the head (LRU) when capacity is exceeded.

→ Deep dive: [LinkedHashMap & LRU Cache](../java/LinkedHashMapLRU.md)

**17. What is `TreeMap` and when do you use it?**

`TreeMap` is backed by a **Red-Black tree** — keys are always sorted. Supports range operations: `subMap(from, to)`, `headMap(to)`, `tailMap(from)`, `floorKey()`, `ceilingKey()`, `firstKey()`, `lastKey()`. Use when you need sorted key iteration or range queries. O(log n) for all operations.

**18. What is `EnumMap` and why is it faster than `HashMap`?**

`EnumMap` uses a plain array indexed by enum ordinal — no hashing, no collision handling. O(1) for all operations with minimal memory. Always use `EnumMap` when your keys are enum values.

---

## Iteration & Fail-Fast

**19. What is a fail-fast iterator?**

An iterator that throws `ConcurrentModificationException` if the collection is structurally modified while iterating (add/remove, not `set()`). Detected via a `modCount` counter — iterator checks it on every `next()`. All iterators from `ArrayList`, `HashMap`, `HashSet` etc. are fail-fast. Not guaranteed — best-effort detection.

**20. What is a fail-safe iterator?**

Iterates over a **snapshot** or uses a structure that tolerates modification. Does not throw `ConcurrentModificationException`. Examples: `CopyOnWriteArrayList`, `ConcurrentHashMap`. Trade-off: may not reflect modifications made after iterator creation.

**21. How do you safely remove elements from a collection while iterating?**

```java
// Option 1: Iterator.remove() — safe, O(1)
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (it.next().startsWith("x")) it.remove();
}

// Option 2: removeIf() — Java 8, cleaner
list.removeIf(s -> s.startsWith("x"));

// Option 3: collect to new list — simple but allocates
list = list.stream().filter(s -> !s.startsWith("x")).collect(Collectors.toList());
```

Never `list.remove()` inside a `for-each` loop — throws `ConcurrentModificationException`.

→ Deep dive: [Iterator & Iterable](../java/IteratorAndIterable.md) · [Fail-Fast vs Fail-Safe](../java/FailFastFailSafe.md)

---

## Queue & Deque

**22. What is the difference between `Queue` and `Deque`?**

`Queue` is FIFO — `offer()` adds to tail, `poll()` removes from head. `Deque` (Double-Ended Queue) supports insert/remove at both ends — implements both `Queue` and `Stack` semantics. `ArrayDeque` is the preferred general-purpose implementation (faster than `LinkedList`, no null allowed).

**23. What is the difference between `poll()` and `remove()` in a Queue?**

Both remove and return the head. `poll()` returns `null` if queue is empty. `remove()` throws `NoSuchElementException`. Similarly: `peek()` vs `element()` (for viewing head without removal).

**24. What is `PriorityQueue`?**

A heap-based priority queue — elements are dequeued in **natural order** (min-heap by default) or custom `Comparator` order. `peek()`/`poll()` are O(log n). Iteration order is **not** sorted. Use for top-K problems, Dijkstra's algorithm, task scheduling.

→ Deep dive: [PriorityQueue & Heap](../java/PriorityQueueAndHeap.md)

---

## Concurrent Collections

**25. What is `ConcurrentHashMap` and how does it differ from `Collections.synchronizedMap()`?**

`Collections.synchronizedMap()` wraps every method in a `synchronized` block on the whole map — one thread at a time. `ConcurrentHashMap` uses **CAS + bin-level locking** (Java 8) — multiple threads can read/write different segments simultaneously. `get()` is lock-free. Dramatically higher throughput under concurrent load. Never use `synchronizedMap` in new code.

**26. What is `CopyOnWriteArrayList`?**

On every write (add/remove/set), creates a **fresh copy** of the backing array. Reads are lock-free and always consistent — iterators never throw `ConcurrentModificationException`. High write cost (O(n) per write). Use only in read-heavy scenarios (listener lists, config snapshots).

→ Deep dive: [Concurrent Collections](../java/ConcurrentCollections.md) · [ConcurrentHashMap Internals](../java/ConcurrentHashMapInternals.md)

---

## Java 8+ Collections Features

**27. What is `Map.getOrDefault()` and `computeIfAbsent()`?**

```java
// getOrDefault — return fallback if key absent
map.getOrDefault("key", 0);

// computeIfAbsent — compute and store if absent (atomic in ConcurrentHashMap)
map.computeIfAbsent("key", k -> new ArrayList<>()).add(value);

// merge — update existing or insert new
map.merge("word", 1, Integer::sum); // word frequency counter
```

**28. What is `Collections.unmodifiableList()` vs `List.of()`?**

`Collections.unmodifiableList(list)` returns a **view** — the underlying list can still be modified; the wrapper just throws on mutations. `List.of()` (Java 9+) returns a **truly immutable** list — no backing mutable list. Prefer `List.of()` / `Map.of()` / `Set.of()` for constants.

---

## Quick-Fire Questions

**29. What is the default capacity of `ArrayList`?** 10.

**30. What is the default capacity and load factor of `HashMap`?** 16 buckets, 0.75 load factor.

**31. Can `HashMap` have a `null` key?** Yes — exactly one null key, stored at bucket 0.

**32. Can `TreeMap` have a `null` key?** No — throws `NullPointerException` (can't compare null).

**33. What is `Collections.frequency()`?** Returns the number of times an element appears in a collection.

**34. What does `Collections.sort()` use?** TimSort (merge sort + insertion sort hybrid) — O(n log n), stable.

**35. What is the difference between `HashMap` and `Hashtable`?** `Hashtable` is synchronized on every method (slow), doesn't allow null keys/values, legacy class. Use `ConcurrentHashMap` instead.

**36. What is `WeakHashMap`?** Keys are held by weak references — entries are GC'd when the key has no other strong references. Used for caches where entries should expire when no longer referenced elsewhere.

**37. How does `EnumSet` work internally?** Backed by a `long` bitmask (one bit per enum value). Extremely fast and memory-efficient for enum-keyed sets. Use `EnumSet.of()`, `EnumSet.allOf()`, `EnumSet.range()`.

**38. What is `ArrayDeque` vs `Stack`?** `Stack` is a legacy `Vector` subclass — synchronized, slow. `ArrayDeque` is the modern replacement — faster, not synchronized, implements both `Deque` and `Stack` semantics. Always use `ArrayDeque` as a stack.

**39. What is `Collections.disjoint()`?** Returns `true` if two collections have no elements in common — O(n) check.

**40. What is a `NavigableMap`?** Extension of `SortedMap` with navigation methods: `floorKey()`, `ceilingKey()`, `lowerKey()`, `higherKey()`, `descendingMap()`. Implemented by `TreeMap` and `ConcurrentSkipListMap`.

---

## Go Deeper

- [Collections Framework Deep Dive](../java/Collections.md)
- [HashMap Internals](../java/HashMapInternals.md)
- [LinkedHashMap & LRU Cache](../java/LinkedHashMapLRU.md)
- [Comparable vs Comparator](../java/ComparableComparator.md)
- [Collections Compared](../java/DiffCollections.md)
- [PriorityQueue & Heap](../java/PriorityQueueAndHeap.md)
- [ConcurrentHashMap Internals](../java/ConcurrentHashMapInternals.md)
- [Iterator & Iterable](../java/IteratorAndIterable.md)
- [Fail-Fast vs Fail-Safe](../java/FailFastFailSafe.md)
