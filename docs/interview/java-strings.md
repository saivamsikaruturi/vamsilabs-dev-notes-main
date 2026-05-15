# Top 30 Java String Interview Questions & Answers

Master the most frequently asked Java String interview questions -- from immutability and the String Pool to modern Java text blocks and performance internals.

---

??? question "Q1: Why is String immutable in Java?"

    **Answer:** String is immutable for four key reasons: (1) **String Pool** -- immutability lets the JVM safely share literals; (2) **Thread safety** -- no synchronization needed; (3) **Security** -- Strings used in class loading, connections, file paths cannot be tampered with after validation; (4) **Hashcode caching** -- computed once, never changes.

    ```java
    String s = "hello";
    s.toUpperCase();       // Returns NEW String "HELLO"
    System.out.println(s); // Still "hello" -- original unchanged
    ```

    Internally, `String` is `final` with a `private final byte[]` and no mutating methods.

---

??? question "Q2: What is the String Pool and how does the intern mechanism work?"

    **Answer:** The String Pool is a region inside the heap where the JVM stores unique String literals. Duplicate literals reuse the same reference.

    ```java
    String a = "hello";              // Created in pool
    String b = "hello";              // Reuses pool reference
    System.out.println(a == b);      // true

    String c = new String("hello");  // New heap object
    System.out.println(a == c);      // false

    String d = c.intern();           // Returns pool reference
    System.out.println(a == d);      // true
    ```

    Before Java 7, the pool lived in PermGen. From Java 7+, it moved to the main heap. Tune with `-XX:StringTableSize`.

---

??? question "Q3: How many objects are created by `String s = new String(\"hello\")`?"

    **Answer:** Up to **2 objects**: (1) the `"hello"` literal in the String Pool (if not already present), and (2) a new String object on the heap via `new`. The variable `s` points to the heap object, so `s == "hello"` is `false`.

---

??? question "Q4: What does String.intern() do?"

    **Answer:** Returns the pool reference for a String. If the pool contains an equal String, that reference is returned; otherwise the String is added to the pool.

    ```java
    String s1 = new String("java");
    String s2 = s1.intern();
    String s3 = "java";
    System.out.println(s2 == s3); // true -- both pool references
    ```

    Use cautiously -- the pool's native hash table can become a bottleneck under heavy interning.

---

??? question "Q5: What are the differences between String, StringBuilder, and StringBuffer?"

    **Answer:**

    | Feature       | String          | StringBuilder     | StringBuffer      |
    |---------------|-----------------|-------------------|-------------------|
    | Mutability    | Immutable       | Mutable           | Mutable           |
    | Thread Safety | Yes (immutable) | No                | Yes (synchronized)|
    | Performance   | Slow for concat | Fastest           | Slower than SB    |
    | Since         | JDK 1.0         | JDK 1.5           | JDK 1.0           |

    ```java
    StringBuilder sb = new StringBuilder();
    sb.append("a").append("b").append("c"); // Single mutable buffer
    ```

---

??? question "Q6: When should you use String, StringBuilder, or StringBuffer?"

    **Answer:** Use **String** for constant/rarely-changed text. Use **StringBuilder** (default choice) for single-threaded mutations, especially loops. Use **StringBuffer** only when multiple threads modify the same buffer.

    ```java
    // Bad -- O(n^2) with String
    String result = "";
    for (int i = 0; i < 10000; i++) result += i;

    // Good -- O(n) with StringBuilder
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < 10000; i++) sb.append(i);
    ```

---

??? question "Q7: How does String concatenation with + work internally?"

    **Answer:** Compile-time constants are folded: `"Hello" + " World"` becomes `"Hello World"`. For variables, **Java 5-8** translates `+` to `StringBuilder.append()` chains; **Java 9+** uses `invokedynamic` with `StringConcatFactory` for better runtime optimization.

    ```java
    String name = "World";
    String s = "Hello " + name + "!";
    // Java 9+: invokedynamic -> StringConcatFactory
    ```

    In loops, the compiler cannot hoist StringBuilder creation, so manual usage is still preferred.

---

??? question "Q8: How does HashMap work with String keys?"

    **Answer:** HashMap uses `hashCode()` to find the bucket and `equals()` to match keys. String is ideal because: its hash is **cached** (computed once), **immutability** guarantees the hash never changes post-insertion, and it implements `Comparable` for efficient tree-bin lookups (Java 8+).

    ```java
    Map<String, Integer> map = new HashMap<>();
    map.put("hello", 1);
    map.get(new String("hello")); // 1 -- equals() matches
    ```

---

??? question "Q9: What is the difference between equals() and == for Strings?"

    **Answer:** `==` checks **reference identity** (same object); `equals()` checks **content equality**.

    ```java
    String a = "hello";
    String b = new String("hello");

    System.out.println(a == b);       // false (different objects)
    System.out.println(a.equals(b));  // true  (same content)
    System.out.println("hello".equals(a)); // true, NPE-safe
    ```

    Always use `equals()` for String comparison.

---

??? question "Q10: Why is String a popular HashMap key?"

    **Answer:** Five reasons: (1) **Immutable** -- hash never changes after insertion; (2) **Cached hashCode** -- O(1) repeated lookups; (3) **Correct equals/hashCode** contract; (4) **Implements Comparable** -- enables tree-bin optimization; (5) **Ubiquity** -- IDs, names, URLs are naturally Strings.

---

??? question "Q11: How many objects: `new String(\"hello\") + new String(\"world\")`?"

    **Answer:** Up to **5 objects**: `"hello"` in pool, `new String("hello")` on heap, `"world"` in pool, `new String("world")` on heap, and the concatenated `"helloworld"` on heap (from `StringBuilder.toString()`). The result is **not** in the pool unless `intern()` is called. The temporary `StringBuilder` is an additional object.

---

??? question "Q12: What was the substring() memory leak in Java 6?"

    **Answer:** In Java 6, `substring()` shared the original's `char[]` with different offset/count. A tiny substring could pin a huge array in memory.

    ```java
    // Java 6 -- memory leak
    String huge = readHugeFile();        // 10 MB char[]
    String small = huge.substring(0, 5); // Still refs 10 MB!
    ```

    **Fixed in Java 7+**: `substring()` now copies into a new array. Workaround in Java 6: `new String(huge.substring(0, 5))`.

---

??? question "Q13: How does String immutability provide thread safety?"

    **Answer:** Immutable objects cannot change state after construction, eliminating data races. Multiple threads can read the same String without synchronization. If String were mutable, every method accepting a String would need defensive copies.

---

??? question "Q14: How do you create an immutable class (using String as example)?"

    **Answer:** (1) Class is `final`; (2) fields are `private final`; (3) no setters; (4) defensive copies for mutable fields.

    ```java
    public final class Employee {
        private final String name;
        private final List<String> skills;

        public Employee(String name, List<String> skills) {
            this.name = name;
            this.skills = List.copyOf(skills); // defensive copy
        }
        public String getName() { return name; }
        public List<String> getSkills() { return skills; }
    }
    ```

    Java 16+ records provide concise immutable data carriers.

---

??? question "Q15: What is StringJoiner and how does String.join() work?"

    **Answer:** `StringJoiner` (Java 8+) joins elements with a delimiter, optional prefix/suffix. `String.join()` is a convenience wrapper.

    ```java
    String csv = String.join(", ", "Java", "Python", "Go"); // "Java, Python, Go"

    StringJoiner sj = new StringJoiner(", ", "[", "]");
    sj.add("Java").add("Python").add("Go");
    sj.toString(); // "[Java, Python, Go]"

    // With Streams
    List.of("a", "b").stream().collect(Collectors.joining(", ")); // "a, b"
    ```

---

??? question "Q16: What are Compact Strings in Java 9+ (Latin1 vs UTF-16)?"

    **Answer:** Java 9 (`JEP 254`) changed `String` from `char[]` to `byte[]` with an encoding flag. **Latin1** strings (all chars fit in 1 byte) use half the memory. **UTF-16** is used when any character exceeds 1 byte.

    ```java
    String ascii = "hello";  // Latin1: 5 bytes (not 10)
    String emoji = "hello世"; // UTF-16: 12 bytes (6 chars x 2)
    ```

    Enabled by default. Most apps see **10-15% heap reduction**. Disable with `-XX:-CompactStrings`.

---

??? question "Q17: String.format() vs MessageFormat vs + concatenation performance?"

    **Answer:**

    | Method            | Speed   | Best For                 |
    |-------------------|---------|--------------------------|
    | `+` / `concat()`  | Fastest | Simple joins             |
    | `StringBuilder`   | Fast    | Loops, many appends      |
    | `String.format()` | Slow    | Formatted output         |
    | `MessageFormat`   | Slowest | i18n / localization      |

    ```java
    String s1 = "Name: " + name + ", Age: " + age;              // fastest
    String s2 = String.format("Name: %s, Age: %d", name, age);  // readable
    String s3 = "Name: %s, Age: %d".formatted(name, age);       // Java 15+
    ```

---

??? question "Q18: isBlank() vs isEmpty() (Java 11+)?"

    **Answer:** `isEmpty()` returns true only for zero-length strings. `isBlank()` (Java 11) returns true for empty **or whitespace-only** strings.

    ```java
    "".isEmpty();      // true     "".isBlank();      // true
    "   ".isEmpty();   // false    "   ".isBlank();   // true
    "\t\n".isEmpty();  // false    "\t\n".isBlank();  // true
    "hi".isEmpty();    // false    "hi".isBlank();    // false
    ```

    Use `isBlank()` for input validation to catch whitespace-only inputs.

---

??? question "Q19: String.strip() vs trim() difference?"

    **Answer:** `trim()` removes ASCII chars <= 32. `strip()` (Java 11) removes all **Unicode whitespace** via `Character.isWhitespace()`.

    ```java
    char uSpace = ' '; // EN QUAD -- Unicode whitespace
    String s = uSpace + "hello" + uSpace;
    s.trim();  // NOT trimmed (Unicode space > 32)
    s.strip(); // "hello" -- properly trimmed

    "  hi  ".stripLeading();  // "hi  "
    "  hi  ".stripTrailing(); // "  hi"
    ```

    Always prefer `strip()` in Java 11+ code.

---

??? question "Q20: What do lines(), repeat(), and indent() do?"

    **Answer:**

    ```java
    // lines() -- Java 11: splits by line terminators -> Stream<String>
    "a\nb\nc".lines().count(); // 3

    // repeat() -- Java 11: repeats N times
    "-".repeat(20); // "--------------------"

    // indent() -- Java 12: adjusts indentation per line
    "hello\nworld".indent(4);
    //     hello
    //     world
    ```

---

??? question "Q21: How do text blocks work (Java 15)?"

    **Answer:** Text blocks use `"""` for multiline strings with automatic indentation stripping.

    ```java
    String json = """
            {
                "name": "Alice",
                "age": 30
            }
            """;

    // Line continuation with \
    String single = """
            This is a \
            single line"""; // "This is a single line"

    // Preserve trailing space with \s
    // Use .formatted() for interpolation
    String html = """
            <p>Hello, %s</p>
            """.formatted("World");
    ```

    Opening `"""` must be followed by a newline. Indentation is stripped based on the closing `"""` position.

---

??? question "Q22: How do you convert String to int/Integer?"

    **Answer:** `parseInt()` returns primitive `int`; `valueOf()` returns cached `Integer` object.

    ```java
    int a = Integer.parseInt("42");        // primitive
    Integer b = Integer.valueOf("42");     // boxed (cached -128 to 127)

    int hex = Integer.parseInt("FF", 16);  // 255
    int bin = Integer.parseInt("1010", 2); // 10

    // Handle invalid input
    try {
        Integer.parseInt("hello");
    } catch (NumberFormatException e) {
        System.out.println("Not a number!");
    }
    ```

    Prefer `parseInt()` when you need a primitive (avoids boxing overhead).

---

??? question "Q23: What are the ways to convert other types to String?"

    **Answer:**

    ```java
    int num = 42;
    Object obj = null;

    String.valueOf(num);              // "42" -- null-safe (returns "null")
    Integer.toString(num);            // "42" -- NPE on null
    "" + num;                         // "42" -- null-safe
    Objects.toString(obj, "default"); // "default" -- null-safe with fallback
    String.format("%d", num);         // "42"
    ```

    **Best practice:** Use `String.valueOf()` as the default -- it handles nulls gracefully.

---

??? question "Q24: What are the different ways to compare Strings?"

    **Answer:**

    ```java
    String a = "Hello", b = "hello";

    a.equals(b);              // false -- case-sensitive
    a.equalsIgnoreCase(b);    // true
    a.compareTo(b);           // negative (lexicographic)
    a.compareToIgnoreCase(b); // 0

    // Compare with CharSequence
    a.contentEquals(new StringBuilder("Hello")); // true

    // Substring comparison
    "Hello World".regionMatches(true, 6, "WORLD", 0, 5); // true

    // Null-safe
    Objects.equals(a, null); // false (no NPE)
    ```

---

??? question "Q25: How do you tokenize/split Strings in Java?"

    **Answer:**

    ```java
    String csv = "Java,Python,,Go";

    // split() -- regex-based, keeps empty tokens
    csv.split(",");    // ["Java", "Python", "", "Go"]
    csv.split(",", 3); // ["Java", "Python", ",Go"]

    // StringTokenizer -- legacy, skips empty tokens
    StringTokenizer st = new StringTokenizer(csv, ",");
    while (st.hasMoreTokens()) st.nextToken(); // Java, Python, Go

    // Pattern.splitAsStream() -- precompiled, streamable
    Pattern.compile(",").splitAsStream(csv)
        .filter(s -> !s.isEmpty())
        .toList(); // [Java, Python, Go]

    // Scanner -- typed parsing
    Scanner sc = new Scanner("42 hello 3.14");
    sc.nextInt(); sc.next(); sc.nextDouble();
    ```

---

??? question "Q26: How do regular expressions work with String methods?"

    **Answer:**

    ```java
    // matches() -- tests ENTIRE string
    "hello123".matches("[a-z]+\\d+"); // true

    // replaceAll() / replaceFirst()
    "Hello   World".replaceAll("\\s+", " "); // "Hello World"
    "aabbcc".replaceFirst("b+", "X");        // "aaXcc"

    // Precompile for performance
    Pattern p = Pattern.compile("(?<year>\\d{4})-(?<month>\\d{2})");
    Matcher m = p.matcher("2024-06");
    if (m.matches()) {
        m.group("year");  // "2024"
        m.group("month"); // "06"
    }
    ```

    **Caution:** `matches()` checks the **entire** string; use `Matcher.find()` for partial matches. Never pass unvalidated user input as a regex pattern.

---

??? question "Q27: How does StringBuilder capacity and expansion work?"

    **Answer:** Default capacity is 16. With an initial string, capacity = `length + 16`. When exceeded, new capacity = `(old + 1) * 2`.

    ```java
    StringBuilder sb = new StringBuilder();    // capacity 16
    new StringBuilder("hello").capacity();     // 21 (5 + 16)
    new StringBuilder(100).capacity();         // 100

    StringBuilder sb2 = new StringBuilder(4);
    sb2.append("hello"); // needs 5 -> expands to (4+1)*2 = 10
    sb2.trimToSize();    // shrink capacity to match length
    ```

    **Tip:** Pre-size with estimated length to avoid repeated array copies.

---

??? question "Q28: What is the CharSequence interface?"

    **Answer:** `CharSequence` is the common interface for `String`, `StringBuilder`, `StringBuffer`, and `CharBuffer`. It defines `length()`, `charAt()`, `subSequence()`, and (Java 8+) `chars()`/`codePoints()` streams.

    ```java
    // APIs accepting CharSequence work with any implementation
    public void process(CharSequence input) {
        System.out.println(input.length());
    }
    process("hello");                    // String
    process(new StringBuilder("hello")); // StringBuilder

    Pattern.matches("\\d+", someCharSequence); // works with any impl
    ```

    **Design tip:** Accept `CharSequence` parameters for flexibility; return `String` for immutability.

---

??? question "Q29: What is String Deduplication in G1 GC?"

    **Answer:** Enabled with `-XX:+UseStringDeduplication` (G1 GC, Java 8u20+), the GC automatically identifies heap Strings with identical content and makes them share the same internal `byte[]`. Unlike `intern()`, the String objects remain separate -- only the backing arrays are shared.

    ```bash
    java -XX:+UseG1GC -XX:+UseStringDeduplication -XX:StringDeduplicationAgeThreshold=3 MyApp
    ```

    | Feature          | `intern()`        | String Deduplication |
    |------------------|-------------------|----------------------|
    | Triggered by     | Developer code    | GC automatically     |
    | Shares           | Whole String obj  | Internal array only  |
    | `==` works?      | Yes               | No                   |

    Best for apps with many duplicate Strings (JSON/XML parsing, large datasets).

---

??? question "Q30: Common String coding problems (reverse, palindrome, anagram, permutations)?"

    **Answer:**

    ```java
    // 1. Reverse
    public static String reverse(String s) {
        return new StringBuilder(s).reverse().toString();
    }

    // 2. Palindrome
    public static boolean isPalindrome(String s) {
        String clean = s.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
        return clean.equals(new StringBuilder(clean).reverse().toString());
    }

    // 3. Anagram (frequency count -- O(n) time, O(1) space)
    public static boolean isAnagram(String a, String b) {
        if (a.length() != b.length()) return false;
        int[] freq = new int[26];
        for (char c : a.toLowerCase().toCharArray()) freq[c - 'a']++;
        for (char c : b.toLowerCase().toCharArray()) freq[c - 'a']--;
        for (int f : freq) if (f != 0) return false;
        return true;
    }

    // 4. Permutations (backtracking -- O(n*n!) time)
    public static void permute(char[] ch, int idx, List<String> res) {
        if (idx == ch.length - 1) { res.add(new String(ch)); return; }
        for (int i = idx; i < ch.length; i++) {
            swap(ch, idx, i);
            permute(ch, idx + 1, res);
            swap(ch, idx, i); // backtrack
        }
    }
    ```

    | Problem      | Time      | Space |
    |--------------|-----------|-------|
    | Reverse      | O(n)      | O(n)  |
    | Palindrome   | O(n)      | O(n)  |
    | Anagram      | O(n)      | O(1)  |
    | Permutations | O(n * n!) | O(n!) |
