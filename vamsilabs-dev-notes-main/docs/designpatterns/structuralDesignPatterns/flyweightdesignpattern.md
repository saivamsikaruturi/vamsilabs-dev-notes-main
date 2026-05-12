# :feather: Flyweight Design Pattern

> **Use sharing to support large numbers of fine-grained objects efficiently by separating intrinsic (shared) state from extrinsic (unique) state.**

---

## :bulb: Real-World Analogy

!!! abstract "Think of Characters in a Word Processor"
    A document has 100,000 characters. Each character has a glyph (shape), font, and size (intrinsic state — shared) plus a position on the page (extrinsic state — unique). Instead of creating 100,000 separate objects with all data duplicated, the word processor shares character glyph objects. The letter 'A' object is reused for every 'A' in the document — only the position changes.

```mermaid
flowchart LR
    subgraph Document["📄 Document (100,000 chars)"]
        P1["position: 1"] 
        P2["position: 2"]
        P3["position: 3"]
        P4["position: 4"]
        P5["position: 5"]
    end
    
    subgraph Pool["🏊 Flyweight Pool (only 26 objects!)"]
        A["🅰️ 'A'"]
        B["🅱️ 'B'"]
        C["©️ 'C'"]
    end
    
    P1 --> A
    P2 --> B
    P3 --> A
    P4 --> C
    P5 --> A
    
    style A fill:#E8F5E9,stroke:#2E7D32,stroke-width:2px,color:#000
    style B fill:#E3F2FD,stroke:#1565C0,color:#000
    style C fill:#F3E5F5,stroke:#6A1B9A,color:#000
    style P1 fill:#FFF9C4,stroke:#F57F17,color:#000
    style P2 fill:#FFF9C4,stroke:#F57F17,color:#000
    style P3 fill:#FFF9C4,stroke:#F57F17,color:#000
    style P4 fill:#FFF9C4,stroke:#F57F17,color:#000
    style P5 fill:#FFF9C4,stroke:#F57F17,color:#000
```

---

## :triangular_ruler: Pattern Structure

```mermaid
flowchart TD
    Client["Client"]
    Factory["Flyweight Factory\n(Cache/Pool)"]
    Flyweight["Flyweight\n(interface)"]
    ConcreteFW["Concrete Flyweight\n(shared, intrinsic state)"]
    UnsharedFW["Unshared Flyweight\n(if needed)"]

    Client -->|requests| Factory
    Factory -->|returns cached| Flyweight
    ConcreteFW -->|implements| Flyweight
    UnsharedFW -->|implements| Flyweight
    Client -->|passes extrinsic state| Flyweight

    style Client fill:#e8f5e9,stroke:#2e7d32,color:#000
    style Factory fill:#a5d6a7,stroke:#1b5e20,color:#000
    style Flyweight fill:#c8e6c9,stroke:#2e7d32,color:#000
    style ConcreteFW fill:#b2dfdb,stroke:#00695c,color:#000
    style UnsharedFW fill:#e0f2f1,stroke:#00695c,color:#000
```

### Intrinsic vs Extrinsic State

```mermaid
flowchart LR
    subgraph Intrinsic["Intrinsic State (SHARED)"]
        direction TB
        I1["Immutable"]
        I2["Context-independent"]
        I3["Stored in flyweight"]
        I4["e.g., tree type, color, texture"]
    end

    subgraph Extrinsic["Extrinsic State (UNIQUE)"]
        direction TB
        E1["Varies per context"]
        E2["Passed by client"]
        E3["NOT stored in flyweight"]
        E4["e.g., position, scale, rotation"]
    end

    style Intrinsic fill:#c8e6c9,stroke:#2e7d32,color:#000
    style Extrinsic fill:#fff9c4,stroke:#f57f17,color:#000
    style I1 fill:#e8f5e9,stroke:#2e7d32,color:#000
    style I2 fill:#e8f5e9,stroke:#2e7d32,color:#000
    style I3 fill:#e8f5e9,stroke:#2e7d32,color:#000
    style I4 fill:#e8f5e9,stroke:#2e7d32,color:#000
    style E1 fill:#fffde7,stroke:#f57f17,color:#000
    style E2 fill:#fffde7,stroke:#f57f17,color:#000
    style E3 fill:#fffde7,stroke:#f57f17,color:#000
    style E4 fill:#fffde7,stroke:#f57f17,color:#000
```

---

## :x: The Problem

You're building a game with a forest of **1,000,000 trees**. Each tree has:

- Tree type name (Oak, Pine, Birch)
- Color
- Texture (large bitmap data)
- X, Y position on map
- Age

Without Flyweight, each tree object stores **everything** — including the massive texture data. 1 million trees x 5MB texture = **5 TB of RAM**! Clearly impossible.

---

## :white_check_mark: The Solution

The Flyweight pattern separates the object's data into:

| State Type | Description | Storage |
|------------|-------------|---------|
| **Intrinsic** | Shared across instances, immutable | Inside the flyweight (cached) |
| **Extrinsic** | Unique per instance, context-dependent | Passed by client at runtime |

For our forest:
- **Intrinsic** (shared): type name, color, texture → stored in `TreeType` flyweight
- **Extrinsic** (unique): x, y position, age → stored/passed by client

Now 1 million trees share just 3 TreeType objects (Oak, Pine, Birch). RAM usage drops from TBs to MBs!

---

## :hammer_and_wrench: Implementation

=== "Forest/Tree Example"

    ```java
    // Flyweight — shared tree type data
    public class TreeType {
        private final String name;
        private final String color;
        private final byte[] texture; // Large data — shared!

        public TreeType(String name, String color, byte[] texture) {
            this.name = name;
            this.color = color;
            this.texture = texture;
            System.out.println("Created TreeType: " + name + " (texture: " + texture.length + " bytes)");
        }

        // Operation uses both intrinsic (this) and extrinsic (params) state
        public void draw(int x, int y, int age) {
            System.out.printf("Drawing %s tree at (%d,%d), age=%d, color=%s%n",
                              name, x, y, age, color);
        }

        public String getName() { return name; }
    }

    // Flyweight Factory — ensures sharing
    public class TreeTypeFactory {
        private static final Map<String, TreeType> cache = new HashMap<>();

        public static TreeType getTreeType(String name, String color, byte[] texture) {
            String key = name + "_" + color;

            return cache.computeIfAbsent(key, k -> new TreeType(name, color, texture));
        }

        public static int getCacheSize() {
            return cache.size();
        }
    }

    // Context — stores extrinsic state + reference to flyweight
    public class Tree {
        private final int x;        // extrinsic
        private final int y;        // extrinsic
        private final int age;      // extrinsic
        private final TreeType type; // flyweight reference (intrinsic state)

        public Tree(int x, int y, int age, TreeType type) {
            this.x = x;
            this.y = y;
            this.age = age;
            this.type = type;
        }

        public void draw() {
            type.draw(x, y, age); // Pass extrinsic state to flyweight
        }
    }

    // Client — the forest
    public class Forest {
        private final List<Tree> trees = new ArrayList<>();

        public void plantTree(int x, int y, int age, String name, String color, byte[] texture) {
            TreeType type = TreeTypeFactory.getTreeType(name, color, texture);
            trees.add(new Tree(x, y, age, type));
        }

        public void drawForest() {
            trees.forEach(Tree::draw);
        }

        public static void main(String[] args) {
            Forest forest = new Forest();
            Random random = new Random();

            byte[] oakTexture = new byte[5_000_000];   // 5MB texture
            byte[] pineTexture = new byte[4_000_000];  // 4MB texture
            byte[] birchTexture = new byte[3_000_000]; // 3MB texture

            // Plant 1 million trees — only 3 TreeType objects created!
            for (int i = 0; i < 1_000_000; i++) {
                int x = random.nextInt(10000);
                int y = random.nextInt(10000);
                int age = random.nextInt(100);

                switch (random.nextInt(3)) {
                    case 0 -> forest.plantTree(x, y, age, "Oak", "Green", oakTexture);
                    case 1 -> forest.plantTree(x, y, age, "Pine", "DarkGreen", pineTexture);
                    case 2 -> forest.plantTree(x, y, age, "Birch", "White", birchTexture);
                }
            }

            System.out.println("Trees planted: " + 1_000_000);
            System.out.println("Unique TreeType objects: " + TreeTypeFactory.getCacheSize());
            // Output: Trees planted: 1000000
            // Output: Unique TreeType objects: 3
        }
    }
    ```

=== "Text Editor Characters"

    ```java
    // Flyweight — character glyph
    public class CharacterGlyph {
        private final char character;
        private final String font;
        private final int size;
        private final boolean bold;

        public CharacterGlyph(char character, String font, int size, boolean bold) {
            this.character = character;
            this.font = font;
            this.size = size;
            this.bold = bold;
        }

        // Extrinsic state (row, col) passed at render time
        public void render(int row, int col) {
            System.out.printf("'%c' [%s %dpx %s] at (%d,%d)%n",
                character, font, size, bold ? "bold" : "normal", row, col);
        }

        public String getKey() {
            return character + "_" + font + "_" + size + "_" + bold;
        }
    }

    // Flyweight Factory
    public class GlyphFactory {
        private final Map<String, CharacterGlyph> glyphs = new HashMap<>();
        private int creationCount = 0;

        public CharacterGlyph getGlyph(char c, String font, int size, boolean bold) {
            String key = c + "_" + font + "_" + size + "_" + bold;

            if (!glyphs.containsKey(key)) {
                glyphs.put(key, new CharacterGlyph(c, font, size, bold));
                creationCount++;
            }

            return glyphs.get(key);
        }

        public void printStats(int totalCharacters) {
            System.out.println("Total characters in document: " + totalCharacters);
            System.out.println("Unique glyph objects created: " + creationCount);
            System.out.printf("Memory saved: %.1f%%%n",
                (1.0 - (double) creationCount / totalCharacters) * 100);
        }
    }

    // Usage
    public class TextEditor {
        public static void main(String[] args) {
            GlyphFactory factory = new GlyphFactory();
            String document = "Hello World! This is a flyweight demo. Hello again!";
            int totalChars = 0;

            for (int i = 0; i < document.length(); i++) {
                char c = document.charAt(i);
                CharacterGlyph glyph = factory.getGlyph(c, "Arial", 12, false);
                glyph.render(0, i); // row=0, col=i (extrinsic state)
                totalChars++;
            }

            factory.printStats(totalChars);
            // Unique glyph objects: ~20 (unique chars)
            // vs 51 objects without flyweight
        }
    }
    ```

=== "Connection Pool (Practical)"

    ```java
    // Flyweight — database connection wrapper
    public class DatabaseConnection {
        private final String url;
        private final String driver;
        private boolean inUse;

        public DatabaseConnection(String url, String driver) {
            this.url = url;
            this.driver = driver;
            this.inUse = false;
            System.out.println("Creating expensive DB connection to: " + url);
            // Simulate expensive connection setup
        }

        public void executeQuery(String query) {
            System.out.println("[" + url + "] Executing: " + query);
        }

        public boolean isInUse() { return inUse; }
        public void acquire() { this.inUse = true; }
        public void release() { this.inUse = false; }
    }

    // Flyweight Factory — Connection Pool
    public class ConnectionPool {
        private final List<DatabaseConnection> pool;
        private final int maxSize;

        public ConnectionPool(String url, String driver, int maxSize) {
            this.maxSize = maxSize;
            this.pool = new ArrayList<>();
            // Pre-create connections (flyweight objects)
            for (int i = 0; i < maxSize; i++) {
                pool.add(new DatabaseConnection(url, driver));
            }
        }

        public synchronized DatabaseConnection acquire() {
            for (DatabaseConnection conn : pool) {
                if (!conn.isInUse()) {
                    conn.acquire();
                    return conn;
                }
            }
            throw new RuntimeException("Connection pool exhausted! Max: " + maxSize);
        }

        public synchronized void release(DatabaseConnection conn) {
            conn.release();
        }

        public int getActiveCount() {
            return (int) pool.stream().filter(DatabaseConnection::isInUse).count();
        }
    }

    // Usage
    public class App {
        public static void main(String[] args) {
            ConnectionPool pool = new ConnectionPool("jdbc:mysql://localhost/db", "mysql", 5);

            // 1000 queries, only 5 connection objects!
            DatabaseConnection conn = pool.acquire();
            conn.executeQuery("SELECT * FROM users");
            pool.release(conn);

            System.out.println("Active connections: " + pool.getActiveCount());
        }
    }
    ```

---

## :dart: When to Use

- Your application uses a **large number of objects** that consume significant memory
- Most object state can be made **extrinsic** (moved outside the object)
- Many groups of objects can be replaced by **fewer shared objects** once extrinsic state is removed
- The application doesn't depend on **object identity** (shared objects are interchangeable)
- You need to optimize for **memory over CPU** (slight computational overhead for huge memory savings)

---

## :globe_with_meridians: Real-World Examples

| Where | Example |
|-------|---------|
| **JDK** | `Integer.valueOf()` — caches Integer objects for -128 to 127 |
| **JDK** | `String.intern()` — shares String objects in the string pool |
| **JDK** | `Boolean.valueOf()` — only two Boolean objects ever exist |
| **JDK** | `java.util.regex.Pattern` — compiled patterns are cached |
| **Connection Pools** | HikariCP, Apache DBCP — reuse connection objects |
| **Thread Pools** | `ExecutorService` — reuses thread objects |
| **Game Engines** | Particle systems, tile maps, sprite sharing |
| **Browsers** | DOM element type metadata shared across instances |

---

## :warning: Pitfalls

!!! warning "Common Mistakes"
    - **Mutable intrinsic state**: Flyweight intrinsic state MUST be immutable — otherwise sharing breaks (one client's change affects all others)
    - **Thread safety**: The flyweight factory (cache) must be thread-safe if accessed concurrently — use `ConcurrentHashMap` or synchronization
    - **Over-optimization**: Don't apply Flyweight when you have few objects — the indirection overhead isn't worth it
    - **Complex extrinsic state management**: If extrinsic state is complex, clients bear the burden of managing and passing it
    - **Identity confusion**: `flyweight1 == flyweight2` may be true for "different" logical objects — don't rely on identity for flyweights

---

## :memo: Key Takeaways

!!! tip "Summary"
    | Aspect | Detail |
    |--------|--------|
    | **Intent** | Share objects to reduce memory footprint dramatically |
    | **Mechanism** | Separate intrinsic (shared) from extrinsic (unique) state |
    | **Key Requirement** | Intrinsic state must be **immutable** |
    | **Key Benefit** | Reduces memory from O(n) to O(k) where k << n |
    | **Trade-off** | Saves memory at the cost of CPU (looking up shared objects, passing extrinsic state) |
    | **Interview Tip** | "`Integer.valueOf(42)` returns a cached flyweight — that's why `==` works for small integers in Java" |
