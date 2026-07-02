---
title: "Data Structures & Algorithms — 12 Patterns for FAANG Coding Interviews (2026)"
description: "After enough problems, you realize there are really only about 12-15 patterns. Everything else is a variation. Here's what I've seen ranked by how..."
---

# Data Structures & Algorithms

> These are my notes from grinding ~300 LeetCode problems and reading through 3,700+ problem statements. I've distilled what actually matters for FAANG interviews — the patterns that keep showing up, the data structures you need cold, and the problems worth your time.

---

## The patterns that matter most

After enough problems, you realize there are really only about 12-15 patterns. Everything else is a variation. Here's what I've seen ranked by how often they show up:

| Pattern | Frequency | One-liner |
|---|---|---|
| **Hash Map** | Very high | If you need O(1) lookup, this is it |
| **Dynamic Programming** | Very high | "Find min/max/count" + choices at each step |
| **Greedy** | High | Local optimal works globally (prove it or use DP) |
| **Binary Search** | High | Monotonic property → halve the search space |
| **Two Pointers** | High | Sorted data, pairs, converging from both ends |
| **Sliding Window** | Medium-high | Contiguous subarray with some constraint |
| **Prefix Sum** | Medium | Need O(1) range queries? Precompute. |
| **Heap** | Medium | Anything "top K" or "kth largest" |
| **Tree Traversal** | Medium | Most tree problems = choose the right traversal |
| **Backtracking** | Medium | Generate all combinations/permutations |
| **Union Find** | Lower | Connected components, cycle detection |
| **Monotonic Stack** | Lower | Next greater/smaller element |
| **Topological Sort** | Lower | Dependencies, course schedule type |

The first 5 alone cover probably 60% of what you'll see in interviews.

---

## Data Structures

!!! tip "Big-O Intuition at Scale"
    - **O(1):** Same speed whether 100 or 100 million items
    - **O(log n):** 100M items = ~27 steps (halving each time)
    - **O(n):** Scales linearly — 2x data = 2x time
    - **O(n log n):** Sorting 100M items ≈ 2.7 billion operations

### Arrays

Contiguous memory, O(1) random access. Shows up everywhere.

| Operation | Unsorted | Sorted |
|---|---|---|
| Access by index | O(1) | O(1) |
| Search | O(n) | O(log n) — binary search |
| Insert at end | O(1) amortized | O(n) — shift elements |
| Insert at position | O(n) | O(n) |
| Delete | O(n) | O(n) |

Things to know cold:

- **Subarray** — Contiguous elements: `[1,3,2]` from `[5,1,3,2,4]`
- **Subsequence** — Maintains order but not contiguous: `[1,3,4]` from `[5,1,3,2,4]`
- **Subset** — Any combination, order doesn't matter
- **Prefix Sum** — Precompute cumulative sums for O(1) range queries: `prefix[i] = prefix[i-1] + arr[i]`
- **Kadane's Algorithm** — Maximum subarray sum in O(n). Comes up a lot.

??? tip "Problems I'd solve first"
    | # | Problem | Pattern | Difficulty |
    |---|---|---|---|
    | 1 | Two Sum | Hash Map | Easy |
    | 53 | Maximum Subarray | Kadane's | Medium |
    | 42 | Trapping Rain Water | Two Pointers | Hard |
    | 121 | Best Time to Buy and Sell Stock | Greedy | Easy |
    | 15 | 3Sum | Two Pointers | Medium |
    | 238 | Product of Array Except Self | Prefix Sum | Medium |
    | 560 | Subarray Sum Equals K | Prefix Sum | Medium |
    | 56 | Merge Intervals | Sorting + Sweep | Medium |
    | 11 | Container With Most Water | Two Pointers | Medium |
    | 287 | Find the Duplicate Number | Cycle Detection (Floyd's) | Medium |

---

### Strings

Immutable in Java (String Pool). Use `char[]` or `StringBuilder` when you need to modify.

| Operation | Complexity |
|---|---|
| charAt(i) | O(1) |
| substring(i, j) | O(j - i) since Java 7u6 |
| concat (+) | O(n + m) — creates new object |
| StringBuilder.append | O(1) amortized |
| equals() | O(n) |
| hashCode() | O(n) first call, cached after |

String-specific algorithms (rarely asked directly, but good to know the ideas):

- **KMP** — Pattern matching in O(n + m) using failure function
- **Rabin-Karp** — Rolling hash for O(n) average pattern matching
- **Z-Algorithm** — Z-array for pattern matching in O(n + m)
- **Manacher's** — All palindromic substrings in O(n)

??? tip "Problems I'd solve first"
    | # | Problem | Pattern | Difficulty |
    |---|---|---|---|
    | 3 | Longest Substring Without Repeating Characters | Sliding Window | Medium |
    | 5 | Longest Palindromic Substring | Two Pointers / DP | Medium |
    | 76 | Minimum Window Substring | Sliding Window | Hard |
    | 49 | Group Anagrams | Hash Map | Medium |
    | 438 | Find All Anagrams in a String | Sliding Window | Medium |
    | 20 | Valid Parentheses | Stack | Easy |
    | 647 | Palindromic Substrings | Expand from center | Medium |

---

### Hash Map / Hash Set

O(1) average for everything. Half of all "easy" and "medium" problems become trivial once you think "what if I just stored this in a map?"

| Aspect | Details |
|---|---|
| Internal structure | Array of buckets (linked list or tree for collisions) |
| Load factor | Default 0.75 — rehash when 75% full |
| Collision resolution | Chaining (Java) or open addressing (Python) |
| Worst case | O(n) when all keys hash to same bucket |
| Java 8+ | Bucket becomes red-black tree at 8 elements |

When to reach for a HashMap:

- Two Sum (store complements)
- Frequency counting
- Grouping (anagrams, patterns)
- Duplicate detection
- Caching (LRU with LinkedHashMap)

---

### Linked Lists

| Type | Structure | Use Case |
|---|---|---|
| Singly Linked | next pointer only | Stack, basic insertion/deletion |
| Doubly Linked | next + prev pointers | LRU Cache, deque |
| Circular | Tail points to head | Round-robin scheduling |

The tricks that come up over and over:

- **Two-pointer (slow/fast)** — Detect cycle, find middle, find nth from end
- **Dummy head node** — Simplifies edge cases at the head
- **Reversal** — Iterative (3 pointers) or recursive. Practice both.

| Operation | Singly | Doubly |
|---|---|---|
| Insert at head | O(1) | O(1) |
| Insert at tail | O(n) or O(1) with tail pointer | O(1) |
| Delete by reference | O(n) — need predecessor | O(1) |
| Search | O(n) | O(n) |

??? tip "Problems I'd solve first"
    | # | Problem | Pattern | Difficulty |
    |---|---|---|---|
    | 206 | Reverse Linked List | Iterative/Recursive | Easy |
    | 21 | Merge Two Sorted Lists | Two pointers | Easy |
    | 2 | Add Two Numbers | Linked List | Medium |
    | 146 | LRU Cache | HashMap + DLL | Medium |
    | 23 | Merge k Sorted Lists | Heap | Hard |
    | 141 | Linked List Cycle | Fast/Slow | Easy |
    | 19 | Remove Nth Node From End | Two Pointers | Medium |

---

### Stack

LIFO. Surprisingly useful — monotonic stacks alone solve a whole class of problems.

| Operation | Complexity |
|---|---|
| push / pop / peek | O(1) |
| search | O(n) |

Where stacks show up:

- Valid parentheses matching
- **Monotonic stack** — next greater element, largest rectangle in histogram
- Expression evaluation (postfix, infix to postfix)
- DFS (explicit stack replaces recursion)
- Min stack (track minimum at each level)

??? tip "Problems I'd solve first"
    | # | Problem | Pattern | Difficulty |
    |---|---|---|---|
    | 20 | Valid Parentheses | Stack | Easy |
    | 84 | Largest Rectangle in Histogram | Monotonic Stack | Hard |
    | 155 | Min Stack | Design | Medium |
    | 739 | Daily Temperatures | Monotonic Stack | Medium |
    | 394 | Decode String | Stack | Medium |

---

### Queue

FIFO. The main thing to remember: BFS = queue.

| Variant | Implementation | Use Case |
|---|---|---|
| Queue | LinkedList or ArrayDeque | BFS traversal |
| Deque | ArrayDeque | Sliding window max/min |
| Priority Queue | Binary heap | Top-K, Dijkstra, merge K sorted |
| Circular Queue | Fixed-size array | Bounded buffer |

---

### Trees

#### Binary Tree Properties

| Property | Definition |
|---|---|
| Full | Every node has 0 or 2 children |
| Complete | All levels full except last (filled left to right) |
| Perfect | Full + all leaves at same level |
| Balanced | Height difference ≤ 1 |

#### BST

Left < parent < right for all nodes.

| Operation | Average | Worst (unbalanced) |
|---|---|---|
| Search | O(log n) | O(n) |
| Insert | O(log n) | O(n) |
| Delete | O(log n) | O(n) |

#### Self-Balancing BSTs

| Tree | Guarantee | Where you see it |
|---|---|---|
| AVL | Strict balance (height diff ≤ 1) | Read-heavy workloads |
| Red-Black | Relaxed balance (max 2x height) | Java TreeMap/TreeSet |
| B-Tree / B+ Tree | Multi-way, disk-friendly | Database indexes |

#### Traversals

| Traversal | Order | When to use |
|---|---|---|
| In-order | Left, Root, Right | Get sorted order from BST |
| Pre-order | Root, Left, Right | Serialize / copy tree |
| Post-order | Left, Right, Root | Delete tree / calculate size |
| Level-order | Level by level | BFS, level-based problems |
| Morris | O(1) space in-order | When you can't use O(n) space |

??? tip "Problems I'd solve first"
    | # | Problem | Pattern | Difficulty |
    |---|---|---|---|
    | 236 | Lowest Common Ancestor | Recursion | Medium |
    | 124 | Binary Tree Max Path Sum | Tree DP | Hard |
    | 98 | Validate BST | In-order / recursion | Medium |
    | 102 | Level Order Traversal | BFS | Medium |
    | 105 | Construct from Preorder & Inorder | Recursion | Medium |
    | 297 | Serialize and Deserialize | BFS/DFS | Hard |
    | 543 | Diameter of Binary Tree | DFS | Easy |

---

### Heap (Priority Queue)

Complete binary tree. Parent >= children (max-heap) or <= children (min-heap).

| Operation | Complexity |
|---|---|
| Insert (offer) | O(log n) |
| Remove top (poll) | O(log n) |
| Peek | O(1) |
| Build from array | O(n) — heapify |

When to use: anything with "top K", "kth largest", "merge K sorted", or "running median."

??? tip "Problems I'd solve first"
    | # | Problem | Difficulty |
    |---|---|---|
    | 23 | Merge k Sorted Lists | Hard |
    | 347 | Top K Frequent Elements | Medium |
    | 215 | Kth Largest Element | Medium |
    | 295 | Find Median from Data Stream | Hard |
    | 973 | K Closest Points to Origin | Medium |

---

### Trie (Prefix Tree)

| Operation | Complexity |
|---|---|
| Insert word | O(word length) |
| Search word | O(word length) |
| Search prefix | O(prefix length) |

Use for: autocomplete, spell checker, word search, IP routing (longest prefix match), word break.

---

### Graph Representations

| Representation | Space | Check Edge | Iterate Neighbors |
|---|---|---|---|
| Adjacency Matrix | O(V²) | O(1) | O(V) |
| Adjacency List | O(V + E) | O(degree) | O(degree) |

Use adjacency list for almost everything. Matrix only when the graph is dense or you need O(1) edge checks.

??? tip "Problems I'd solve first"
    | # | Problem | Pattern | Difficulty |
    |---|---|---|---|
    | 200 | Number of Islands | BFS/DFS/Union Find | Medium |
    | 207 | Course Schedule | Topological Sort | Medium |
    | 133 | Clone Graph | BFS + HashMap | Medium |
    | 547 | Number of Provinces | Union Find | Medium |
    | 743 | Network Delay Time | Dijkstra | Medium |
    | 994 | Rotting Oranges | Multi-source BFS | Medium |

---

### Disjoint Set (Union-Find)

| Operation | Naive | With path compression + rank |
|---|---|---|
| Find | O(n) | O(α(n)) ≈ O(1) |
| Union | O(n) | O(α(n)) ≈ O(1) |

Use for: Kruskal's MST, cycle detection (undirected), connected components, accounts merge.

---

### Data Structures in Real Systems

| Data Structure | Real-World System Use |
|---|---|
| HashMap | In-memory caches, request deduplication, connection pools |
| B+ Tree | Database indexes (PostgreSQL, MySQL) |
| LSM Tree | Write-heavy stores (Cassandra, RocksDB, LevelDB) |
| Bloom Filter | Avoid disk reads (Cassandra), spam detection, CDN cache checks |
| Skip List | Redis sorted sets, concurrent data structures |
| Trie | Autocomplete, IP routing tables, DNS lookup |
| Heap/PQ | Task schedulers, Dijkstra's algorithm, top-K streaming |
| Graph | Social networks, dependency resolution, network routing |

---

## Algorithm Patterns (with templates)

### Two Pointers

**Recognize it:** Sorted array, finding pairs, removing in-place, palindromes.

| Variant | Example |
|---|---|
| Opposite direction (converging) | Container With Most Water, Two Sum II |
| Same direction (fast/slow) | Remove duplicates, linked list cycle |
| Fixed gap | Nth node from end |

??? tip "Problems I'd solve first"
    | # | Problem | Difficulty |
    |---|---|---|
    | 42 | Trapping Rain Water | Hard |
    | 15 | 3Sum | Medium |
    | 11 | Container With Most Water | Medium |
    | 75 | Sort Colors (Dutch Flag) | Medium |
    | 283 | Move Zeroes | Easy |

---

### Sliding Window

**Recognize it:** "Longest/shortest subarray/substring with constraint X."

| Type | When |
|---|---|
| Fixed size | Window of exact size K |
| Variable (expand) | Longest window satisfying condition |
| Variable (shrink) | Shortest window satisfying condition |

Template I use:

```java
int left = 0;
for (int right = 0; right < n; right++) {
    // expand: add arr[right] to window state
    while (window is invalid) {
        // shrink: remove arr[left] from window state
        left++;
    }
    // update answer
}
```

??? tip "Problems I'd solve first"
    | # | Problem | Difficulty |
    |---|---|---|
    | 3 | Longest Substring Without Repeating | Medium |
    | 76 | Minimum Window Substring | Hard |
    | 239 | Sliding Window Maximum | Hard |
    | 209 | Minimum Size Subarray Sum | Medium |
    | 424 | Longest Repeating Char Replacement | Medium |
    | 567 | Permutation in String | Medium |

---

### Binary Search

**Recognize it:** Sorted data, or "find minimum X such that..." (search on answer space).

| Variant | Key insight |
|---|---|
| Standard | Find exact element |
| Lower bound | First element >= target |
| Upper bound | First element > target |
| On answer space | Binary search the answer, validate with greedy |

Binary search on answer space is underrated. Problems like Koko Eating Bananas, Split Array Largest Sum, Ship Packages — they all follow the same template.

??? tip "Problems I'd solve first"
    | # | Problem | Difficulty |
    |---|---|---|
    | 4 | Median of Two Sorted Arrays | Hard |
    | 33 | Search in Rotated Sorted Array | Medium |
    | 34 | Find First and Last Position | Medium |
    | 875 | Koko Eating Bananas | Medium |
    | 1011 | Capacity To Ship Packages | Medium |
    | 153 | Find Min in Rotated Array | Medium |

---

### DFS

**Recognize it:** Explore all paths, detect cycles, topological sort, connected components.

| Use | Detail |
|---|---|
| Cycle detection (directed) | 3 states: unvisited, in-progress, visited |
| Cycle detection (undirected) | Track parent |
| Topological sort | Post-order + reverse |
| Connected components | DFS from each unvisited |

---

### BFS

**Recognize it:** Shortest path (unweighted), level-order, "minimum steps to reach X."

| Variant | Example |
|---|---|
| Standard | Shortest path in maze |
| Multi-source | Rotting Oranges, 01 Matrix |
| Bidirectional | Word Ladder (optimization) |
| With extra state | Shortest path with obstacle elimination |

---

### Backtracking

**Recognize it:** "Generate all...", "find all combinations/permutations", constraint satisfaction.

Template:

```java
void backtrack(state, choices) {
    if (isGoal(state)) {
        result.add(copy(state));
        return;
    }
    for (choice : choices) {
        if (isValid(choice)) {
            make(choice);
            backtrack(state, remaining);
            undo(choice);
        }
    }
}
```

Pruning makes or breaks your runtime: sort candidates, skip duplicates, check constraints early.

??? tip "Problems I'd solve first"
    | # | Problem | Difficulty |
    |---|---|---|
    | 46 | Permutations | Medium |
    | 78 | Subsets | Medium |
    | 39 | Combination Sum | Medium |
    | 79 | Word Search | Medium |
    | 51 | N-Queens | Hard |
    | 22 | Generate Parentheses | Medium |

---

### Dynamic Programming

**Recognize it:** "Find min cost / max value / number of ways" + choices at each step that affect future decisions. If greedy fails (you can find a counterexample), it's probably DP.

#### Categories

| Category | Examples |
|---|---|
| 1D Linear | Climbing Stairs, House Robber, Decode Ways |
| 2D Grid | Unique Paths, Min Path Sum |
| Knapsack | Coin Change, Partition Equal Subset Sum |
| String DP | Edit Distance, LCS |
| Interval DP | Burst Balloons, Matrix Chain |
| Bitmask DP | TSP, Assign Tasks |
| Tree DP | Diameter, House Robber III |
| State Machine | Buy/Sell Stock with cooldown |

#### My approach for every DP problem

1. **Define state** — What uniquely describes a subproblem?
2. **Recurrence** — How does current relate to smaller subproblems?
3. **Base cases** — What's trivially solvable?
4. **Iteration order** — Dependencies must be computed first
5. **Space optimize** — Can you go from 2D to 1D?

??? tip "Problems I'd solve first"
    | # | Problem | Category | Difficulty |
    |---|---|---|---|
    | 70 | Climbing Stairs | 1D | Easy |
    | 198 | House Robber | 1D | Medium |
    | 322 | Coin Change | Knapsack | Medium |
    | 300 | Longest Increasing Subsequence | 1D | Medium |
    | 1143 | Longest Common Subsequence | String DP | Medium |
    | 72 | Edit Distance | String DP | Medium |
    | 152 | Maximum Product Subarray | 1D | Medium |
    | 416 | Partition Equal Subset Sum | Knapsack | Medium |
    | 312 | Burst Balloons | Interval | Hard |

---

### Greedy

**Recognize it:** Local optimal → global optimal. You need to prove it works (exchange argument or show no counterexample).

| Problem Type | Strategy |
|---|---|
| Interval selection | Sort by end time, pick non-overlapping |
| Huffman coding | Merge two smallest |
| Fractional knapsack | Sort by value/weight |
| Jump Game | Track farthest reachable |
| Task scheduling | Sort by deadline |

---

### Graph Algorithms

| Algorithm | Purpose | Complexity |
|---|---|---|
| BFS | Shortest path (unweighted) | O(V + E) |
| Dijkstra | Shortest path (positive weights) | O((V + E) log V) |
| Bellman-Ford | Shortest path (negative weights ok) | O(V × E) |
| Floyd-Warshall | All-pairs shortest | O(V³) |
| Kruskal's | MST (sparse graphs) | O(E log E) |
| Prim's | MST (dense graphs) | O((V + E) log V) |
| Topological Sort | DAG ordering | O(V + E) |
| Tarjan's | Strongly Connected Components | O(V + E) |

---

### Sorting

| Algorithm | Average | Worst | Space | Stable |
|---|---|---|---|---|
| Merge Sort | O(n log n) | O(n log n) | O(n) | Yes |
| Quick Sort | O(n log n) | O(n²) | O(log n) | No |
| Heap Sort | O(n log n) | O(n log n) | O(1) | No |
| Tim Sort | O(n log n) | O(n log n) | O(n) | Yes |
| Counting Sort | O(n + k) | O(n + k) | O(k) | Yes |

Java: `Arrays.sort()` = Dual-Pivot Quicksort for primitives, TimSort for objects.

---

## Complexity Cheat Sheet

### Operations by Data Structure

| Structure | Access | Search | Insert | Delete |
|---|---|---|---|---|
| Array | O(1) | O(n) | O(n) | O(n) |
| Sorted Array | O(1) | O(log n) | O(n) | O(n) |
| Linked List | O(n) | O(n) | O(1)* | O(1)* |
| Stack / Queue | O(n) | O(n) | O(1) | O(1) |
| HashMap | — | O(1) avg | O(1) avg | O(1) avg |
| TreeMap | — | O(log n) | O(log n) | O(log n) |
| Heap | — | O(n) | O(log n) | O(log n) |
| BST (balanced) | — | O(log n) | O(log n) | O(log n) |
| Trie | — | O(m) | O(m) | O(m) |

*O(1) with reference to node; O(n) to find it.

---

### Space Complexity

| Pattern | Space |
|---|---|
| Hash map/set of input | O(n) |
| Recursion (balanced tree) | O(log n) |
| Recursion (worst case) | O(n) |
| BFS queue | O(width) — O(n) worst |
| DFS stack | O(height) — O(n) worst |
| DP 2D table | O(n × m) |
| DP 1D optimized | O(n) |
| Graph adjacency list | O(V + E) |

---

## Math & Bit Manipulation

### Number Theory

| Concept | Complexity | Notes |
|---|---|---|
| GCD (Euclidean) | O(log(min(a,b))) | `gcd(a, b) = gcd(b, a % b)` |
| LCM | O(log(min(a,b))) | `a * b / gcd(a, b)` |
| Sieve of Eratosthenes | O(n log log n) | All primes up to n |
| Fast Exponentiation | O(log n) | Binary exponentiation |

### Bit Manipulation

| Operation | Expression | Use |
|---|---|---|
| Check bit set | `(n >> i) & 1` | Test ith bit |
| Set bit | `n | (1 << i)` | Turn on |
| Clear bit | `n & ~(1 << i)` | Turn off |
| Toggle bit | `n ^ (1 << i)` | Flip |
| Power of 2? | `n & (n - 1) == 0` | Single bit set |
| Count set bits | `Integer.bitCount(n)` | Popcount |
| Lowest set bit | `n & (-n)` | Isolate rightmost 1 |
| Clear lowest set | `n & (n - 1)` | Remove rightmost 1 |

---

## How to pick the right approach

??? question "How do I choose a data structure?"
    Match the operations you need: O(1) lookup → HashMap. Sorted order + O(log n) → TreeMap. Min/max quickly → Heap. LIFO → Stack. Connected components → Union-Find. Also look at constraints: n ≤ 20 → bitmask/exponential. n ≤ 10⁴ → O(n²) is fine. n ≤ 10⁵ → need O(n log n). n ≤ 10⁷ → must be O(n).

??? question "BFS or DFS?"
    **BFS** when you need shortest path (unweighted) or level-order anything. **DFS** when you need to explore all possibilities, do backtracking, topological sort, or cycle detection. BFS = O(width) space, DFS = O(depth) space.

??? question "Greedy or DP?"
    Try greedy first — it's simpler. If you can find a counterexample where the greedy choice fails, use DP. DP problems usually have "overlapping subproblems" (same subproblem solved repeatedly in naive recursion) and the problem asks for optimal value, not the actual solution path.

??? question "What are the highest-ROI problems to solve?"
    The top 8 patterns (HashMap, DP, Greedy, Binary Search, Two Pointers, Sliding Window, Prefix Sum, Heap) cover ~80% of interviews. Do 5-8 problems per pattern. After that you're mostly pattern-matching and the problems start feeling repetitive — that's when you know you're ready.
