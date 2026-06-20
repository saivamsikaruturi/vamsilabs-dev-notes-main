---
title: "Java Collections Framework — ArrayList vs HashMap Internals, Interview Guide (2026)"
description: "Master Java Collections for interviews — ArrayList, HashMap, HashSet, LinkedList internals, performance O(n) analysis, fail-fast iterators, ConcurrentHashMap. Real FAANG questions with code examples by Salesforce engineer."
---

# Java Collections Framework — List, Set, Map, Queue Internals

The Collections Framework is a unified architecture for storing and manipulating groups of objects. It's one of the most asked topics in Java interviews.

---

## Collection Hierarchy

```mermaid
flowchart LR
    %% Root
    Iterable(("<b>Iterable</b>")) --> Collection(("<b>Collection</b>"))

    %% Branches from Collection
    Collection --> List{{"<b>List</b>"}}
    Collection --> Set{{"<b>Set</b>"}}
    Collection --> Queue{{"<b>Queue</b>"}}

    %% List implementations
    List --> ArrayList(["ArrayList"])
    List --> LinkedList(["LinkedList"])
    List --> Vector(["Vector"])

    %% Set implementations
    Set --> HashSet(["HashSet"])
    Set --> LinkedHashSet(["LinkedHashSet"])
    Set --> TreeSet(["TreeSet"])

    %% Queue implementations
    Queue --> PriorityQueue(["PriorityQueue"])
    Queue --> ArrayDeque(["ArrayDeque"])

    %% Map hierarchy (separate)
    MapRoot{{"<b>Map</b><br/><i>(separate hierarchy)</i>"}} --> HashMap(["HashMap"])
    MapRoot --> LinkedHashMap(["LinkedHashMap"])
    MapRoot --> TreeMap(["TreeMap"])
    MapRoot --> ConcurrentHashMap(["ConcurrentHashMap"])

    style Iterable fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style Collection fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style List fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style Set fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style Queue fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style ArrayList fill:#BFDBFE,stroke:#93C5FD,color:#1E40AF
    style LinkedList fill:#BFDBFE,stroke:#93C5FD,color:#1E40AF
    style Vector fill:#BFDBFE,stroke:#93C5FD,color:#1E40AF
    style HashSet fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style LinkedHashSet fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style TreeSet fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style PriorityQueue fill:#FFFBEB,stroke:#FCD34D,color:#92400E
    style ArrayDeque fill:#FFFBEB,stroke:#FCD34D,color:#92400E
    style MapRoot fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style HashMap fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style LinkedHashMap fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style TreeMap fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style ConcurrentHashMap fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
```

### When to Use Which Collection (Decision Tree)

```mermaid
flowchart LR
    Start(("What do you need?"))

    Start -->|"Key-Value pairs?"| MapQ{"Need ordering<br/>of keys?"}
    Start -->|"Ordered elements<br/>with duplicates?"| ListQ{"Need fast<br/>random access?"}
    Start -->|"Unique elements<br/>only?"| SetQ{"Need sorted<br/>order?"}
    Start -->|"FIFO / Priority<br/>processing?"| QueueQ{"Need priority<br/>ordering?"}

    %% Map branch
    MapQ -->|"No order needed"| HashMap2(["<b>HashMap</b><br/>O(1) get/put"])
    MapQ -->|"Insertion order"| LinkedHashMap2(["<b>LinkedHashMap</b><br/>Maintains insert order"])
    MapQ -->|"Sorted keys"| TreeMap2(["<b>TreeMap</b><br/>O(log n) sorted"])
    MapQ -->|"Thread-safe"| ConcurrentHashMap2(["<b>ConcurrentHashMap</b><br/>Lock striping"])

    %% List branch
    ListQ -->|"Yes — random access"| ArrayList2(["<b>ArrayList</b><br/>O(1) get by index"])
    ListQ -->|"No — frequent insert/delete"| LinkedList2(["<b>LinkedList</b><br/>O(1) add/remove at ends"])

    %% Set branch
    SetQ -->|"No — just unique"| HashSet2(["<b>HashSet</b><br/>O(1) add/contains"])
    SetQ -->|"Yes — sorted"| TreeSet2(["<b>TreeSet</b><br/>O(log n) sorted"])
    SetQ -->|"Insertion order"| LinkedHashSet2(["<b>LinkedHashSet</b><br/>Maintains insert order"])

    %% Queue branch
    QueueQ -->|"Yes — priority"| PriorityQueue2(["<b>PriorityQueue</b><br/>Min-heap based"])
    QueueQ -->|"No — FIFO/LIFO"| ArrayDeque2(["<b>ArrayDeque</b><br/>Fast double-ended"])

    style Start fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style MapQ fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style ListQ fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style SetQ fill:#D1FAE5,stroke:#6EE7B7,color:#065F46
    style QueueQ fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style HashMap2 fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style LinkedHashMap2 fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style TreeMap2 fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style ConcurrentHashMap2 fill:#EFF6FF,stroke:#93C5FD,color:#1E40AF
    style ArrayList2 fill:#BFDBFE,stroke:#93C5FD,color:#1E40AF
    style LinkedList2 fill:#BFDBFE,stroke:#93C5FD,color:#1E40AF
    style HashSet2 fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style TreeSet2 fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style LinkedHashSet2 fill:#ECFDF5,stroke:#6EE7B7,color:#065F46
    style PriorityQueue2 fill:#FFFBEB,stroke:#FCD34D,color:#92400E
    style ArrayDeque2 fill:#FFFBEB,stroke:#FCD34D,color:#92400E
```

---

## SequencedCollection (Java 21+)

Java 21 introduced `SequencedCollection`, `SequencedSet`, and `SequencedMap` to provide **uniform access to the first and last elements** across ordered collections. Before Java 21, getting the last element was inconsistent: `list.get(list.size()-1)` for List, `((TreeSet)set).last()` for SortedSet, `deque.peekLast()` for Deque.

```java
// Now unified across List, LinkedHashSet, SortedSet, Deque
SequencedCollection<String> seq = new ArrayList<>(List.of("a", "b", "c"));
seq.getFirst();    // "a"
seq.getLast();     // "c"
seq.addFirst("z"); // adds at beginning
seq.reversed();    // reversed view (not a copy)

// Works on LinkedHashSet too!
SequencedSet<String> set = new LinkedHashSet<>(List.of("x", "y", "z"));
set.getFirst();    // "x"
set.getLast();     // "z"

// SequencedMap — first/last entry access
SequencedMap<String, Integer> map = new LinkedHashMap<>();
map.put("a", 1); map.put("b", 2); map.put("c", 3);
map.firstEntry(); // a=1
map.lastEntry();  // c=3
map.reversed();   // reversed view
```

| Interface | Extends | Implementations |
|---|---|---|
| `SequencedCollection<E>` | `Collection<E>` | `ArrayList`, `LinkedList`, `ArrayDeque`, `LinkedHashSet`, `TreeSet` |
| `SequencedSet<E>` | `SequencedCollection<E>`, `Set<E>` | `LinkedHashSet`, `TreeSet` |
| `SequencedMap<K,V>` | `Map<K,V>` | `LinkedHashMap`, `TreeMap` |

---

## Collection vs Collections

| `Collection` | `Collections` |
|---|---|
| **Interface** — root of the collection hierarchy | **Utility class** — static helper methods |
| `List`, `Set`, `Queue` extend it | `sort()`, `min()`, `max()`, `unmodifiableList()` |

---

## List — Ordered, Allows Duplicates

### ArrayList

- **Backed by**: Dynamic array
- **Best for**: Random access (`get(i)` is O(1))
- **Worst at**: Insertions/deletions in the middle (O(n) — shifts elements)

```java
List<String> list = new ArrayList<>();
list.add("Java");
list.add("Python");
list.add("Java");     // duplicates allowed
list.get(0);          // O(1) — "Java"
list.remove(1);       // O(n) — shifts elements
```

### LinkedList

- **Backed by**: Doubly-linked list
- **Best for**: Frequent insertions/deletions at head/tail
- **Worst at**: Random access (`get(i)` is O(n) — traverses nodes)

```java
LinkedList<String> list = new LinkedList<>();
list.addFirst("First");  // O(1)
list.addLast("Last");    // O(1)
list.get(5);             // O(n) — must traverse
```

### ArrayList vs LinkedList

| Operation | ArrayList | LinkedList |
|---|---|---|
| `get(index)` | O(1) | O(n) |
| `add(end)` | O(1) amortized | O(1) |
| `add(middle)` | O(n) | O(1) if you have the node |
| `remove(middle)` | O(n) | O(1) if you have the node |
| Memory | Less (contiguous array) | More (node + 2 pointers per element) |

**Rule of thumb**: Use `ArrayList` unless you have a specific reason for `LinkedList`. ArrayList is almost always faster in practice due to CPU cache friendliness.

---

## Set — No Duplicates

### HashSet

- **Backed by**: `HashMap` internally
- **Order**: No guaranteed order
- **Null**: Allows one null element
- **Performance**: O(1) for add, remove, contains

### LinkedHashSet

- **Backed by**: `LinkedHashMap`
- **Order**: Maintains **insertion order**
- **Use case**: When you need uniqueness + predictable iteration order

### TreeSet

- **Backed by**: Red-Black Tree (`TreeMap`)
- **Order**: **Sorted** (natural order or custom `Comparator`)
- **Performance**: O(log n) for add, remove, contains
- **Null**: Does NOT allow null

```java
Set<Integer> set = new TreeSet<>();
set.add(30); set.add(10); set.add(20);
System.out.println(set);  // [10, 20, 30] — sorted
```

---

## Map — Key-Value Pairs

### HashMap

- **Backed by**: Array of buckets + linked lists (or trees when bucket > 8 elements)
- **Order**: No guaranteed order
- **Null**: One null key, multiple null values
- **Performance**: O(1) average for get/put

### How HashMap Works Internally

```
    Index:  [0]  [1]  [2]  [3]  [4]  [5]  [6]  [7]
             │         │
             ▼         ▼
          [K1,V1]   [K3,V3]──►[K4,V4]  (collision → linked list)
             │
             ▼
          [K2,V2]  (collision → linked list, then tree if > 8)
```

1. `hashCode()` of key → determines **bucket index**
2. If bucket is empty → insert directly
3. If bucket has entries → check `equals()` for duplicate key
4. If same key → **replace** value
5. If different key → **chain** (linked list, or red-black tree if chain > 8)

### The hashCode/equals Contract

| Rule | Meaning |
|---|---|
| If `a.equals(b)` → `a.hashCode() == b.hashCode()` | Equal objects MUST have the same hash code |
| If `a.hashCode() == b.hashCode()` → `a.equals(b)` might be false | Same hash doesn't mean equal (collisions exist) |
| Override both or neither | Breaking this contract breaks HashMap |

```java
public class Employee {
    private int id;
    private String name;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Employee e)) return false;
        return id == e.id && Objects.equals(name, e.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name);
    }
}
```

### LinkedHashMap

- Maintains **insertion order** (or access order for LRU cache)
- Slightly slower than HashMap due to maintaining linked list

### TreeMap

- **Sorted** by key (natural order or custom `Comparator`)
- O(log n) for all operations
- Does NOT allow null keys

---

## Queue and Deque

### PriorityQueue

- Elements ordered by **priority** (natural order or Comparator)
- NOT FIFO — highest priority element comes out first
- Backed by: min-heap

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();
pq.add(30); pq.add(10); pq.add(20);
pq.poll();  // 10 (smallest = highest priority)
pq.poll();  // 20
```

### ArrayDeque

- Double-ended queue — add/remove from both ends
- **Faster** than `LinkedList` as a queue and stack
- No null elements

```java
Deque<String> stack = new ArrayDeque<>();
stack.push("A"); stack.push("B");
stack.pop();  // "B" (LIFO)

Deque<String> queue = new ArrayDeque<>();
queue.offer("A"); queue.offer("B");
queue.poll();  // "A" (FIFO)
```

---

## Fail-Fast vs Fail-Safe Iterators

| Type | Behavior | Example |
|---|---|---|
| **Fail-Fast** | Throws `ConcurrentModificationException` if collection is modified during iteration | `ArrayList`, `HashMap`, `HashSet` |
| **Fail-Safe** | Works on a copy, no exception | `CopyOnWriteArrayList`, `ConcurrentHashMap` |

```java
// Fail-Fast — throws exception
List<String> list = new ArrayList<>(List.of("A", "B", "C"));
for (String s : list) {
    if (s.equals("B")) list.remove(s);  // ConcurrentModificationException!
}

// Safe way — use Iterator.remove()
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (it.next().equals("B")) it.remove();  // safe
}
```

---

## Choosing the Right Collection

| Need | Use |
|---|---|
| Ordered list, fast random access | `ArrayList` |
| Frequent add/remove at ends | `LinkedList` or `ArrayDeque` |
| Unique elements, no order | `HashSet` |
| Unique elements, sorted | `TreeSet` |
| Unique elements, insertion order | `LinkedHashSet` |
| Key-value pairs, fast lookup | `HashMap` |
| Key-value pairs, sorted keys | `TreeMap` |
| Key-value pairs, insertion order | `LinkedHashMap` |
| Priority-based processing | `PriorityQueue` |
| Stack (LIFO) | `ArrayDeque` |
| Queue (FIFO) | `ArrayDeque` or `LinkedList` |
| Thread-safe list | `CopyOnWriteArrayList` |
| Thread-safe map | `ConcurrentHashMap` |

---

## Interview Questions

??? question "1. How does HashMap handle collisions?"
    When two keys have the same bucket index (hash collision), HashMap stores them as a **linked list** in that bucket. Since Java 8, when a bucket has more than 8 entries, the linked list converts to a **red-black tree** (O(log n) lookup instead of O(n)). When it shrinks below 6, it converts back to a linked list.

??? question "2. Why should you override both hashCode() and equals()?"
    If you override `equals()` but not `hashCode()`, two equal objects could end up in **different buckets** in a HashMap, making `map.get(key)` fail even though the key exists. The contract requires: if `a.equals(b)` is true, then `a.hashCode()` must equal `b.hashCode()`.

??? question "3. What is the difference between `Comparable` and `Comparator`?"
    `Comparable` — the class itself defines its natural ordering via `compareTo()`. One sorting logic per class. `Comparator` — an external class defines ordering via `compare()`. Multiple sorting strategies possible. Use `Comparable` for the default order, `Comparator` for alternate orders.

??? question "4. Why is HashMap not thread-safe? What happens in concurrent access?"
    Multiple threads can simultaneously modify the internal array, leading to: lost updates (one write overwrites another), infinite loops (in Java 7 due to rehashing), corrupted data. Use `ConcurrentHashMap` for thread-safe access or `Collections.synchronizedMap()` (but that's slower due to full locking).

??? question "5. How would you implement an LRU Cache using Java collections?"
    Use `LinkedHashMap` with `accessOrder=true` and override `removeEldestEntry()`:
    ```java
    Map<K, V> lru = new LinkedHashMap<>(capacity, 0.75f, true) {
        protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
            return size() > capacity;
        }
    };
    ```
    For thread-safe LRU, wrap it in `Collections.synchronizedMap()` or use `ConcurrentHashMap` with a custom eviction strategy.

---

---

## Quick Quiz

??? question "Q1: Which collection would you choose for O(1) random access by index with fast iteration?"
    - [x] A) ArrayList
    - [ ] B) LinkedList
    - [ ] C) HashSet
    - [ ] D) TreeSet

    **Answer: A)** ArrayList is backed by a contiguous dynamic array, providing O(1) random access via `get(index)`. LinkedList requires O(n) traversal. HashSet and TreeSet do not support index-based access at all.

??? question "Q2: What is the key difference between HashSet and LinkedHashSet?"
    - [ ] A) LinkedHashSet uses a linked list instead of hashing
    - [ ] B) HashSet maintains insertion order but LinkedHashSet does not
    - [x] C) LinkedHashSet maintains insertion order while HashSet has no ordering guarantee
    - [ ] D) LinkedHashSet allows duplicate elements

    **Answer: C)** LinkedHashSet wraps a LinkedHashMap internally, maintaining a doubly-linked list that preserves insertion order during iteration. HashSet (backed by HashMap) provides no ordering guarantees. Both ensure uniqueness.

??? question "Q3: What happens when you modify a collection while iterating over it with a fail-fast iterator?"
    - [ ] A) The modification is silently ignored
    - [x] B) A ConcurrentModificationException is thrown
    - [ ] C) The iterator restarts from the beginning
    - [ ] D) The JVM terminates the thread

    **Answer: B)** Fail-fast iterators (used by ArrayList, HashMap, HashSet, etc.) detect structural modifications via a modification counter. If the collection is modified outside the iterator during iteration, they throw `ConcurrentModificationException`. The safe alternative is to use `Iterator.remove()` or a fail-safe collection like ConcurrentHashMap.

??? question "Q4: Which data structure backs PriorityQueue, and what is its time complexity for insertion?"
    - [ ] A) Red-black tree with O(log n) insertion
    - [x] B) Binary min-heap with O(log n) insertion
    - [ ] C) Sorted array with O(n) insertion
    - [ ] D) Hash table with O(1) insertion

    **Answer: B)** PriorityQueue is backed by a binary min-heap implemented as an array. Insertion (offer/add) is O(log n) due to heap sift-up. Peek is O(1) since the minimum is always at the root. It is NOT a sorted structure — only the head is guaranteed to be the smallest element.

---

## See Also

- [HashMap Internals](HashMapInternals.md) — Hashing, buckets, treeification, and resizing
- [ConcurrentHashMap](ConcurrentHashMapInternals.md) — Thread-safe map with per-bucket locking
- [Comparable vs Comparator](ComparableComparator.md) — Natural ordering vs custom sorting
- [Fail-Fast vs Fail-Safe](FailFastFailSafe.md) — Iterator behavior under modification
- [Stream API](../stream-api/streamapi.md) — Functional-style collection processing
- [Collections Compared](DiffCollections.md) — When to use which collection
