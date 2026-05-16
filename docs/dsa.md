# Data Structures & Algorithms

A comprehensive reference covering every data structure and algorithm pattern tested at FAANG interviews, with complexity analysis, implementation notes, and when to use each.

---

## Data Structures

### Arrays

The most fundamental structure — contiguous memory, O(1) random access.

| Operation | Unsorted | Sorted |
|---|---|---|
| Access by index | O(1) | O(1) |
| Search | O(n) | O(log n) — binary search |
| Insert at end | O(1) amortized | O(n) — shift elements |
| Insert at position | O(n) | O(n) |
| Delete | O(n) | O(n) |

**Key Concepts:**

- **Subarray** — Contiguous elements: `[1,3,2]` from `[5,1,3,2,4]`
- **Subsequence** — Maintains order but not contiguous: `[1,3,4]` from `[5,1,3,2,4]`
- **Subset** — Any combination, order doesn't matter
- **Prefix Sum** — Precompute cumulative sums for O(1) range queries: `prefix[i] = prefix[i-1] + arr[i]`
- **Kadane's Algorithm** — Maximum subarray sum in O(n)

---

### Strings

Strings in Java are immutable (stored in String Pool). Character-level manipulation often uses `char[]` or `StringBuilder`.

| Operation | Complexity |
|---|---|
| charAt(i) | O(1) |
| substring(i, j) | O(j - i) since Java 7u6 |
| concat (+) | O(n + m) — creates new object |
| StringBuilder.append | O(1) amortized |
| equals() | O(n) |
| hashCode() | O(n) first call, cached after |

**Key Algorithms:**

- **KMP (Knuth-Morris-Pratt)** — Pattern matching in O(n + m) using failure function
- **Rabin-Karp** — Rolling hash for O(n) average pattern matching
- **Z-Algorithm** — Z-array for pattern matching in O(n + m)
- **Manacher's** — All palindromic substrings in O(n)

---

### Hash Map / Hash Set

O(1) average case for insert, delete, lookup. Foundation of countless interview solutions.

| Aspect | Details |
|---|---|
| Internal structure | Array of buckets (linked list or tree for collisions) |
| Load factor | Default 0.75 — rehash when 75% full |
| Collision resolution | Chaining (Java) or open addressing (Python) |
| Worst case | O(n) when all keys hash to same bucket |
| Java 8+ optimization | Bucket converts to red-black tree at 8 elements |

**Common Interview Applications:**

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

**Key Techniques:**

- **Two-pointer (slow/fast)** — Detect cycle, find middle, find nth from end
- **Dummy head node** — Simplifies edge cases for insertion/deletion at head
- **Reversal** — Iterative (3 pointers) or recursive

| Operation | Singly | Doubly |
|---|---|---|
| Insert at head | O(1) | O(1) |
| Insert at tail | O(n) or O(1) with tail pointer | O(1) |
| Delete by reference | O(n) — need predecessor | O(1) |
| Search | O(n) | O(n) |

---

### Stack

LIFO — Last In, First Out.

| Operation | Complexity |
|---|---|
| push / pop / peek | O(1) |
| search | O(n) |

**Interview Applications:**

- Valid parentheses matching
- Monotonic stack (next greater element, largest rectangle in histogram)
- Expression evaluation (postfix, infix to postfix)
- DFS (explicit stack replaces recursion)
- Undo/redo operations
- Min stack (track minimum at each level)

---

### Queue

FIFO — First In, First Out.

| Variant | Implementation | Use Case |
|---|---|---|
| Queue | LinkedList or ArrayDeque | BFS traversal |
| Deque | ArrayDeque | Sliding window max/min |
| Priority Queue | Binary heap | Top-K, Dijkstra, merge K sorted |
| Circular Queue | Fixed-size array | Bounded buffer, ring buffer |

---

### Trees

#### Binary Tree Properties

| Property | Definition |
|---|---|
| Full | Every node has 0 or 2 children |
| Complete | All levels full except last (filled left to right) |
| Perfect | Full + all leaves at same level |
| Balanced | Height difference between subtrees is at most 1 |
| Height | Longest path from root to leaf (edges) |
| Depth | Distance from root to node (edges) |

#### Binary Search Tree (BST)

Left child < parent < right child for all nodes.

| Operation | Average | Worst (unbalanced) |
|---|---|---|
| Search | O(log n) | O(n) |
| Insert | O(log n) | O(n) |
| Delete | O(log n) | O(n) |
| In-order traversal | O(n) | O(n) |

#### Self-Balancing BSTs

| Tree | Guarantee | Use Case |
|---|---|---|
| AVL | Strict balance (height diff <= 1) | Read-heavy workloads |
| Red-Black | Relaxed balance (max 2x height) | Java TreeMap/TreeSet |
| B-Tree / B+ Tree | Multi-way, disk-friendly | Database indexes |

#### Tree Traversals

| Traversal | Order | Common Use |
|---|---|---|
| In-order | Left, Root, Right | Sorted order from BST |
| Pre-order | Root, Left, Right | Serialize tree / copy tree |
| Post-order | Left, Right, Root | Delete tree / calculate size |
| Level-order (BFS) | Level by level | Shortest path, level problems |
| Morris Traversal | O(1) space in-order | Space-constrained in-order |

---

### Heap (Priority Queue)

A complete binary tree where parent >= children (max-heap) or parent <= children (min-heap).

| Operation | Complexity |
|---|---|
| Insert (offer) | O(log n) |
| Remove top (poll) | O(log n) |
| Peek | O(1) |
| Build heap from array | O(n) — heapify |
| Delete arbitrary | O(n) to find + O(log n) to remove |

**When to Use:**

- Top K elements (min-heap of size K)
- Kth largest/smallest
- Merge K sorted lists
- Running median (two heaps)
- Dijkstra's algorithm
- Task scheduling

---

### Trie (Prefix Tree)

| Operation | Complexity |
|---|---|
| Insert word | O(word length) |
| Search word | O(word length) |
| Search prefix | O(prefix length) |
| Space | O(total characters across all words) |

**Applications:** Autocomplete, spell checker, word search, IP routing (longest prefix match), word break problem.

---

### Graph Representations

| Representation | Space | Add Edge | Check Edge | Iterate Neighbors |
|---|---|---|---|---|
| Adjacency Matrix | O(V^2) | O(1) | O(1) | O(V) |
| Adjacency List | O(V + E) | O(1) | O(degree) | O(degree) |
| Edge List | O(E) | O(1) | O(E) | O(E) |

**Choose adjacency list** for sparse graphs (most real-world graphs). Choose **matrix** for dense graphs or when you need O(1) edge existence checks.

---

### Disjoint Set (Union-Find)

| Operation | Without optimization | With path compression + union by rank |
|---|---|---|
| Find | O(n) | O(α(n)) — nearly O(1) |
| Union | O(n) | O(α(n)) — nearly O(1) |
| Connected check | O(n) | O(α(n)) |

**Applications:** Kruskal's MST, cycle detection in undirected graphs, connected components, accounts merge, redundant connections.

---

## Algorithm Patterns

### Two Pointers

**When:** Sorted arrays, finding pairs/triplets, removing elements in-place, palindromes.

| Variant | Description | Example Problem |
|---|---|---|
| Opposite direction | Left + right converging | Two Sum (sorted), Container With Most Water |
| Same direction | Slow + fast pointers | Remove duplicates, linked list cycle |
| Fixed gap | Pointers with fixed distance | Nth node from end |

---

### Sliding Window

**When:** Contiguous subarray/substring with a constraint (max sum, distinct characters, etc.)

| Type | Description | Template |
|---|---|---|
| Fixed size | Window of size K | Max sum subarray of size K |
| Variable size (expand) | Expand right, shrink left when constraint breaks | Longest substring without repeating |
| Variable size (shrink) | Find minimum window satisfying constraint | Minimum window substring |

**Template (variable window):**

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

---

### Binary Search

**When:** Sorted array, search space with monotonic property, minimize/maximize answer.

| Variant | Use Case | Key Insight |
|---|---|---|
| Standard | Find exact element | Classic template |
| Lower bound | First element >= target | `left = mid + 1` when `arr[mid] < target` |
| Upper bound | First element > target | `left = mid + 1` when `arr[mid] <= target` |
| On answer | Minimize/maximize result | Binary search on the answer space, validate with helper |

**Binary Search on Answer Space:** When the problem asks "find minimum X such that condition is satisfied" — binary search on X, check feasibility with a greedy/linear scan.

Examples: Koko Eating Bananas, Split Array Largest Sum, Capacity To Ship Packages.

---

### Depth-First Search (DFS)

**When:** Explore all paths, detect cycles, topological sort, connected components.

| Application | Implementation Detail |
|---|---|
| Path finding | Track visited, backtrack |
| Cycle detection (directed) | 3 states: unvisited, in-progress, visited |
| Cycle detection (undirected) | Track parent to avoid false cycle |
| Topological sort | Post-order DFS + reverse |
| Connected components | DFS from each unvisited node |
| Island counting | DFS/BFS from each unvisited land cell |

---

### Breadth-First Search (BFS)

**When:** Shortest path in unweighted graph, level-order traversal, multi-source BFS.

| Variant | Description | Example |
|---|---|---|
| Standard BFS | Single source, shortest path | Shortest path in maze |
| Multi-source BFS | Start from all sources simultaneously | Rotting Oranges, 01 Matrix |
| Bidirectional BFS | Search from both ends | Word Ladder (optimization) |
| BFS with state | Track additional state in visited | Shortest Path with Obstacles Elimination |

---

### Backtracking

**When:** Generate all combinations/permutations/subsets, constraint satisfaction (N-Queens, Sudoku).

**Template:**

```java
void backtrack(state, choices) {
    if (isGoal(state)) {
        result.add(copy(state));
        return;
    }
    for (choice : choices) {
        if (isValid(choice)) {
            make(choice);
            backtrack(state, remainingChoices);
            undo(choice);  // backtrack
        }
    }
}
```

**Optimization — Pruning:**

- Sort candidates to enable early termination
- Skip duplicates (for combinations without repetition)
- Check constraints before recursing (not after)

---

### Dynamic Programming

**When:** Optimal substructure + overlapping subproblems. "Find minimum cost / maximum value / number of ways."

#### DP Categories

| Category | Key Insight | Examples |
|---|---|---|
| 1D Linear | Decision at each index depends on previous | Climbing Stairs, House Robber, Decode Ways |
| 2D Grid | Path in matrix | Unique Paths, Minimum Path Sum |
| Knapsack | Include/exclude items with weight constraint | 0/1 Knapsack, Coin Change, Partition Equal Subset |
| String DP | Two strings, LCS-style recurrence | Edit Distance, Longest Common Subsequence |
| Interval DP | Optimal merge/split of intervals | Burst Balloons, Matrix Chain Multiplication |
| Bitmask DP | Track subset state as bitmask | TSP, Assign Tasks |
| Tree DP | Combine children results | Diameter of Binary Tree, House Robber III |
| State Machine | Finite states with transitions | Buy/Sell Stock with cooldown/fees |

#### DP Approach

1. **Define state** — What information uniquely describes a subproblem?
2. **Recurrence** — How does current state relate to smaller subproblems?
3. **Base cases** — What are the trivially solvable subproblems?
4. **Iteration order** — Compute dependencies before the current state
5. **Space optimization** — Can you reduce from 2D to 1D? (rolling array)

---

### Greedy

**When:** Local optimal choice leads to global optimal. Must prove greedy choice property + optimal substructure.

| Problem Type | Greedy Strategy |
|---|---|
| Activity/interval selection | Sort by end time, pick non-overlapping |
| Huffman coding | Always merge two smallest frequencies |
| Fractional knapsack | Sort by value/weight ratio |
| Jump Game | Track farthest reachable index |
| Task scheduling | Sort by deadline or penalty |
| Merge intervals | Sort by start, merge overlapping |

---

### Graph Algorithms

| Algorithm | Purpose | Complexity | When to Use |
|---|---|---|---|
| BFS | Shortest path (unweighted) | O(V + E) | Unweighted graphs |
| Dijkstra | Shortest path (non-negative weights) | O((V + E) log V) | Weighted graph, no negative edges |
| Bellman-Ford | Shortest path (handles negatives) | O(V * E) | Negative weights, detect negative cycles |
| Floyd-Warshall | All-pairs shortest path | O(V^3) | Dense graph, all-pairs needed |
| Kruskal's | Minimum Spanning Tree | O(E log E) | Sparse graph MST |
| Prim's | Minimum Spanning Tree | O((V + E) log V) | Dense graph MST |
| Topological Sort | Linear ordering of DAG | O(V + E) | Task scheduling, build order |
| Tarjan's / Kosaraju's | Strongly Connected Components | O(V + E) | Directed graph decomposition |

---

### Sorting Algorithms

| Algorithm | Best | Average | Worst | Space | Stable |
|---|---|---|---|---|---|
| Merge Sort | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes |
| Quick Sort | O(n log n) | O(n log n) | O(n^2) | O(log n) | No |
| Heap Sort | O(n log n) | O(n log n) | O(n log n) | O(1) | No |
| Tim Sort | O(n) | O(n log n) | O(n log n) | O(n) | Yes |
| Counting Sort | O(n + k) | O(n + k) | O(n + k) | O(k) | Yes |
| Radix Sort | O(nk) | O(nk) | O(nk) | O(n + k) | Yes |

**Java defaults:** `Arrays.sort()` uses Dual-Pivot Quicksort for primitives, TimSort for objects. `Collections.sort()` uses TimSort.

---

## Complexity Cheat Sheet

### Data Structure Operations

| Structure | Access | Search | Insert | Delete |
|---|---|---|---|---|
| Array | O(1) | O(n) | O(n) | O(n) |
| Sorted Array | O(1) | O(log n) | O(n) | O(n) |
| Linked List | O(n) | O(n) | O(1)* | O(1)* |
| Stack / Queue | O(n) | O(n) | O(1) | O(1) |
| HashMap | - | O(1) avg | O(1) avg | O(1) avg |
| TreeMap | - | O(log n) | O(log n) | O(log n) |
| Heap | - | O(n) | O(log n) | O(log n) |
| BST (balanced) | - | O(log n) | O(log n) | O(log n) |
| Trie | - | O(m) | O(m) | O(m) |

*O(1) when you have a reference to the node; O(n) to find it first.

---

### Space Complexity Common Cases

| Pattern | Space |
|---|---|
| Hash map/set of input | O(n) |
| Recursion (balanced tree) | O(log n) |
| Recursion (worst case) | O(n) |
| BFS queue | O(width) — O(n) worst case |
| DFS stack | O(height) — O(n) worst case |
| DP 2D table | O(n * m) |
| DP 1D optimized | O(n) or O(min(n, m)) |
| Sorting (merge sort) | O(n) |
| Sorting (quick sort) | O(log n) |
| Graph adjacency list | O(V + E) |

---

## Math & Number Theory

| Concept | Complexity | Notes |
|---|---|---|
| GCD (Euclidean) | O(log(min(a,b))) | `gcd(a, b) = gcd(b, a % b)` |
| LCM | O(log(min(a,b))) | `lcm(a, b) = a * b / gcd(a, b)` |
| Sieve of Eratosthenes | O(n log log n) | Find all primes up to n |
| Fast Exponentiation | O(log n) | `pow(base, exp, mod)` — binary exponentiation |
| Modular arithmetic | O(1) per op | `(a + b) % m = ((a % m) + (b % m)) % m` |

---

## Bit Manipulation

| Operation | Expression | Use |
|---|---|---|
| Check if bit is set | `(n >> i) & 1` | Test ith bit |
| Set a bit | `n | (1 << i)` | Turn on ith bit |
| Clear a bit | `n & ~(1 << i)` | Turn off ith bit |
| Toggle a bit | `n ^ (1 << i)` | Flip ith bit |
| Check power of 2 | `n & (n - 1) == 0` | Single bit set |
| Count set bits | `Integer.bitCount(n)` | Population count |
| Lowest set bit | `n & (-n)` | Isolate rightmost 1 |
| Clear lowest set bit | `n & (n - 1)` | Turn off rightmost 1 |

---

??? question "How do I know which data structure to choose for a problem?"
    **Match the operations you need to their complexities.** Need O(1) lookup? HashMap. Need sorted order + O(log n) operations? TreeMap. Need min/max quickly? Heap. Need LIFO? Stack. Need to track connected components? Union-Find. The constraint size also hints: n <= 20 suggests exponential/bitmask DP; n <= 10^4 suggests O(n^2); n <= 10^5 suggests O(n log n); n <= 10^7 suggests O(n).

??? question "When should I use BFS vs DFS?"
    **BFS** for shortest path in unweighted graphs, level-order problems, and when the answer is close to the source. **DFS** for exhaustive search, path finding, topological sort, cycle detection, and when you need to explore all possibilities (backtracking). BFS uses O(width) space; DFS uses O(depth) space.

??? question "How do I identify if a problem needs Dynamic Programming?"
    Look for: (1) **Optimal substructure** — optimal solution contains optimal solutions to subproblems. (2) **Overlapping subproblems** — same subproblem solved multiple times in recursion. (3) **Problem asks** for min/max/count of ways. (4) **Choices at each step** that affect future decisions. If a greedy approach doesn't work (counterexample exists), DP is likely needed.

??? question "What are the most common patterns across FAANG interviews?"
    Based on frequency: (1) HashMap/HashSet for O(1) lookups (2) Two Pointers on sorted data (3) BFS/DFS for trees and graphs (4) Sliding Window for subarray problems (5) Binary Search on answer space (6) DP for optimization problems (7) Stack for next greater/smaller element (8) Heap for Top-K problems. Master these 8 patterns and you can solve 80% of interview problems.
