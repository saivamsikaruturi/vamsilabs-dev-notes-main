# Java Regular Expressions

Regular expressions (regex) are a powerful pattern-matching language used for searching, validating, and manipulating text. Java's `java.util.regex` package provides a robust regex engine based on Perl-style patterns. Regex is a frequent topic in interviews — interviewers test both your ability to write patterns and your understanding of the underlying engine.

---

## Core Classes: Pattern and Matcher

Java's regex engine revolves around two classes:

| Class | Purpose |
|---|---|
| `Pattern` | Compiled representation of a regex. Immutable and thread-safe. |
| `Matcher` | Stateful engine that performs match operations against a `CharSequence`. |

```java
// 1. Compile the pattern (expensive — do once, reuse)
Pattern pattern = Pattern.compile("\\d{3}-\\d{4}");

// 2. Create a matcher against input
Matcher matcher = pattern.matcher("Call 555-1234 now");

// 3. Use matcher methods
if (matcher.find()) {
    System.out.println(matcher.group()); // "555-1234"
    System.out.println(matcher.start()); // 5
    System.out.println(matcher.end());   // 13
}
```

### Key Matcher Methods

| Method | Description |
|---|---|
| `matches()` | Entire input must match the pattern |
| `find()` | Finds the next subsequence that matches |
| `lookingAt()` | Input must match from the beginning (but need not consume all) |
| `group()` | Returns the matched subsequence |
| `start()` / `end()` | Start and end indices of the match |
| `replaceAll(String)` | Replaces every match with the replacement |
| `reset(CharSequence)` | Reuses the matcher with new input |

---

## Compilation Flags

Pass flags to `Pattern.compile()` to alter matching behavior.

| Flag | Constant | Effect |
|---|---|---|
| `(?i)` | `Pattern.CASE_INSENSITIVE` | Case-insensitive matching (ASCII only) |
| `(?m)` | `Pattern.MULTILINE` | `^` and `$` match line boundaries, not just input boundaries |
| `(?s)` | `Pattern.DOTALL` | `.` matches everything including `\n` |
| `(?x)` | `Pattern.COMMENTS` | Allows whitespace and comments in the pattern |
| `(?u)` | `Pattern.UNICODE_CASE` | Unicode-aware case folding (use with `CASE_INSENSITIVE`) |
| `(?d)` | `Pattern.UNIX_LINES` | Only `\n` is recognized as a line terminator |

```java
// Combine flags with bitwise OR
Pattern p = Pattern.compile("hello world",
        Pattern.CASE_INSENSITIVE | Pattern.MULTILINE);

// Or embed flags inline
Pattern p2 = Pattern.compile("(?im)hello world");
```

!!! tip "MULTILINE vs DOTALL"
    `MULTILINE` changes what `^` and `$` mean — they match at line boundaries instead of only at the start/end of the entire input. `DOTALL` changes what `.` matches — it includes newline characters. These are independent and frequently confused in interviews.

---

## Character Classes

| Syntax | Matches | Example |
|---|---|---|
| `[abc]` | Any of a, b, or c | `[aeiou]` matches vowels |
| `[^abc]` | Anything except a, b, c | `[^0-9]` matches non-digits |
| `[a-z]` | Range a through z | `[A-Za-z]` matches letters |
| `[a-z&&[^m-p]]` | Intersection (a-z minus m-p) | Java-specific syntax |
| `.` | Any character (except `\n` by default) | |
| `\d` | Digit `[0-9]` | |
| `\D` | Non-digit `[^0-9]` | |
| `\w` | Word character `[a-zA-Z0-9_]` | |
| `\W` | Non-word character | |
| `\s` | Whitespace `[ \t\n\r\f]` | |
| `\S` | Non-whitespace | |
| `\b` | Word boundary | |
| `\B` | Non-word boundary | |

!!! warning "Double Backslash in Java"
    Java strings require escaping backslashes. Write `\\d` in code to represent the regex `\d`. This is the most common source of regex bugs in Java.

---

## Quantifiers

### Greedy, Reluctant, and Possessive

| Greedy | Reluctant | Possessive | Meaning |
|---|---|---|---|
| `X?` | `X??` | `X?+` | Zero or one |
| `X*` | `X*?` | `X*+` | Zero or more |
| `X+` | `X+?` | `X++` | One or more |
| `X{n}` | `X{n}?` | `X{n}+` | Exactly n |
| `X{n,}` | `X{n,}?` | `X{n,}+` | At least n |
| `X{n,m}` | `X{n,m}?` | `X{n,m}+` | Between n and m |

```java
String input = "<b>bold</b> and <i>italic</i>";

// Greedy: matches as much as possible, then backtracks
Pattern greedy = Pattern.compile("<.+>");
// Matches: "<b>bold</b> and <i>italic</i>"  (one huge match)

// Reluctant: matches as little as possible
Pattern reluctant = Pattern.compile("<.+?>");
// Matches: "<b>", "</b>", "<i>", "</i>"  (four separate matches)

// Possessive: matches as much as possible, NO backtracking
Pattern possessive = Pattern.compile("<.++>");
// No match at all! Consumes everything, won't give back the ">"
```

!!! info "When to Use Possessive Quantifiers"
    Possessive quantifiers prevent backtracking entirely. Use them when you know the consumed characters will never be part of a later match — this dramatically improves performance and prevents catastrophic backtracking (ReDoS).

---

## Anchors

| Anchor | Meaning |
|---|---|
| `^` | Start of input (or line in `MULTILINE` mode) |
| `$` | End of input (or line in `MULTILINE` mode) |
| `\b` | Word boundary |
| `\B` | Non-word boundary |
| `\A` | Absolute start of input (ignores `MULTILINE`) |
| `\Z` | End of input, before final terminator |
| `\z` | Absolute end of input |

```java
// \b ensures we match whole words only
Pattern p = Pattern.compile("\\bcat\\b");
Matcher m = p.matcher("concatenate the cat in the catalog");
// Finds only "cat" at position 18, not inside "concatenate" or "catalog"
```

---

## Capturing Groups and Named Groups

Parentheses `()` create capturing groups. Groups are numbered left-to-right starting at 1. Group 0 is always the entire match.

```java
Pattern datePattern = Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})");
Matcher m = datePattern.matcher("Date: 2025-07-15");

if (m.find()) {
    System.out.println(m.group(0)); // "2025-07-15"  (full match)
    System.out.println(m.group(1)); // "2025"        (year)
    System.out.println(m.group(2)); // "07"          (month)
    System.out.println(m.group(3)); // "15"          (day)
}
```

### Named Groups (Java 7+)

Use `(?<name>...)` to assign names to groups. Improves readability significantly.

```java
Pattern p = Pattern.compile(
    "(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})");
Matcher m = p.matcher("2025-07-15");

if (m.find()) {
    System.out.println(m.group("year"));  // "2025"
    System.out.println(m.group("month")); // "07"
    System.out.println(m.group("day"));   // "15"
}
```

### Non-Capturing Groups

Use `(?:...)` when you need grouping for alternation or quantifiers but do not need to capture.

```java
// Non-capturing: groups for alternation without creating a capture
Pattern p = Pattern.compile("(?:http|https)://(.+)");
Matcher m = p.matcher("https://example.com");

if (m.find()) {
    System.out.println(m.group(1)); // "example.com" — group 1, not 2
}
```

---

## Backreferences

Backreferences refer to previously captured groups within the same pattern. `\1` refers to group 1, `\k<name>` refers to a named group.

```java
// Find repeated words
Pattern p = Pattern.compile("\\b(\\w+)\\s+\\1\\b", Pattern.CASE_INSENSITIVE);
Matcher m = p.matcher("The the quick brown fox fox jumped");

while (m.find()) {
    System.out.println("Duplicate: " + m.group()); 
    // "The the"
    // "fox fox"
}
```

```java
// Named backreference
Pattern p = Pattern.compile("(?<tag>\\w+)=\\k<tag>");
Matcher m = p.matcher("test=test value=value bad=wrong");

while (m.find()) {
    System.out.println(m.group()); // "test=test", "value=value"
}
```

---

## Lookahead and Lookbehind Assertions

Lookarounds assert that a pattern exists (or does not exist) at a position **without consuming characters**.

| Syntax | Name | Meaning |
|---|---|---|
| `(?=X)` | Positive lookahead | Followed by X |
| `(?!X)` | Negative lookahead | NOT followed by X |
| `(?<=X)` | Positive lookbehind | Preceded by X |
| `(?<!X)` | Negative lookbehind | NOT preceded by X |

```java
// Password validation: at least 8 chars, one uppercase, one digit, one special
Pattern strongPassword = Pattern.compile(
    "^(?=.*[A-Z])(?=.*\\d)(?=.*[@#$%^&+=!]).{8,}$"
);

System.out.println(strongPassword.matcher("Passw0rd!").matches());  // true
System.out.println(strongPassword.matcher("weakpass").matches());   // false
```

```java
// Lookbehind: extract amounts after a dollar sign
Pattern p = Pattern.compile("(?<=\\$)\\d+\\.\\d{2}");
Matcher m = p.matcher("Price: $49.99 and $12.50");

while (m.find()) {
    System.out.println(m.group()); // "49.99", "12.50" (without the $)
}
```

```java
// Negative lookahead: find "foo" NOT followed by "bar"
Pattern p = Pattern.compile("foo(?!bar)");
Matcher m = p.matcher("foobar foobaz foo");

while (m.find()) {
    System.out.println(m.start()); // 7 ("foobaz"), 14 ("foo")
}
```

!!! warning "Lookbehind Limitations in Java"
    Java requires lookbehinds to have a **finite, obvious length**. Patterns like `(?<=a+)` are illegal. Use `(?<=a{1,10})` or restructure with lookahead instead.

---

## String Convenience Methods

Java's `String` class provides regex-powered methods for quick operations.

```java
String input = "Hello, World!";

// matches() — entire string must match
input.matches("[A-Za-z, !]+");  // true

// split() — split on a pattern
"one:two::three".split(":");     // ["one", "two", "", "three"]
"one:two::three".split(":", 3);  // ["one", "two", ":three"] (limit = 3 parts)
"one:two::three".split(":", -1); // ["one", "two", "", "three"] (keep trailing empties)

// replaceAll() — replace all matches
"2025-07-15".replaceAll("(\\d{4})-(\\d{2})-(\\d{2})", "$2/$3/$1");
// Result: "07/15/2025"

// replaceFirst() — replace first match only
"aaa bbb aaa".replaceFirst("aaa", "ccc");  // "ccc bbb aaa"
```

---

## Pattern.compile() vs String.matches() Performance

This is a classic interview question. `String.matches()` recompiles the pattern **every single call**.

```java
// BAD: recompiles pattern on every iteration — O(n * compile_cost)
for (String email : emails) {
    if (email.matches("[\\w.]+@[\\w.]+\\.\\w+")) {
        // ...
    }
}

// GOOD: compile once, reuse — O(compile_cost + n * match_cost)
private static final Pattern EMAIL_PATTERN = 
    Pattern.compile("[\\w.]+@[\\w.]+\\.\\w+");

for (String email : emails) {
    if (EMAIL_PATTERN.matcher(email).matches()) {
        // ...
    }
}
```

!!! tip "Performance Rule of Thumb"
    If you use a regex more than once, always pre-compile with `Pattern.compile()` and store it in a `static final` field. The `Pattern` object is immutable and thread-safe, making this pattern safe for concurrent access.

---

## Common Patterns

These are frequently asked in interviews. Understand the trade-offs — production-grade validation often requires more than regex alone.

```java
// Email (simplified — RFC 5322 is much more complex)
Pattern EMAIL = Pattern.compile(
    "^[\\w.%+-]+@[\\w.-]+\\.[a-zA-Z]{2,}$"
);

// US Phone Number (flexible format)
Pattern PHONE = Pattern.compile(
    "^\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}$"
);

// IPv4 Address
Pattern IPV4 = Pattern.compile(
    "^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$"
);

// URL (http/https)
Pattern URL = Pattern.compile(
    "^https?://[\\w.-]+(?:\\.[a-zA-Z]{2,})(?:/[\\w./?%&=+-]*)?$"
);

// Java identifier
Pattern IDENTIFIER = Pattern.compile(
    "^[a-zA-Z_$][a-zA-Z0-9_$]*$"
);

// ISO date (YYYY-MM-DD)
Pattern ISO_DATE = Pattern.compile(
    "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$"
);
```

!!! warning "Regex is Not a Validator"
    These patterns check format, not validity. For example, the date pattern accepts `2025-02-31` which does not exist. For production validation, use proper libraries (`InternetAddress` for email, `InetAddress` for IP, `LocalDate.parse()` for dates).

---

## ReDoS: Catastrophic Backtracking

**ReDoS** (Regular Expression Denial of Service) occurs when a regex engine takes exponential time on certain inputs due to excessive backtracking.

### The Problem

```java
// VULNERABLE: nested quantifiers create exponential backtracking
Pattern bad = Pattern.compile("(a+)+b");

// Benign input: matches quickly
bad.matcher("aaaaab").matches(); // true, fast

// Malicious input: no match, but engine tries every combination
bad.matcher("aaaaaaaaaaaaaaaaaaaaa!").matches(); 
// Takes seconds... minutes... hangs!
```

The engine tries `a+` matching 1 char, then the outer `+` repeating... then backtracks and tries `a+` matching 2 chars, and so on. For n characters, this is **O(2^n)**.

### Vulnerable Patterns to Avoid

| Pattern | Problem |
|---|---|
| `(a+)+` | Nested quantifiers |
| `(a\|b)*` | Alternation inside repetition with overlap |
| `(.*a){n}` | Wildcard with suffix inside repetition |
| `(\w+\s?)+` | Overlapping possibilities for each position |

### How to Prevent ReDoS

1. **Use possessive quantifiers**: `(a++)b` prevents backtracking entirely
2. **Use atomic groups**: `(?>a+)b` (Java supports this)
3. **Avoid nested quantifiers**: Flatten `(a+)+` to `a+`
4. **Anchor patterns**: Use `^` and `$` to constrain matching
5. **Set timeouts**: Limit regex execution time
6. **Test with tools**: Use regex analysis tools to detect vulnerable patterns

```java
// SAFE: possessive quantifier prevents backtracking
Pattern safe = Pattern.compile("(a++)b");
safe.matcher("aaaaaaaaaaaaaaaaaaaaa!").matches(); // false, instant

// SAFE: atomic group (equivalent to possessive)
Pattern atomic = Pattern.compile("(?>a+)b");
atomic.matcher("aaaaaaaaaaaaaaaaaaaaa!").matches(); // false, instant
```

!!! danger "Interview Red Flag"
    If an interviewer asks you to write a regex for user-facing input validation, always mention ReDoS as a concern. It shows security awareness and production-mindset thinking.

---

## Java 9+ Regex Enhancements

| Version | Feature |
|---|---|
| Java 9 | `Matcher.results()` returns a `Stream<MatchResult>` |
| Java 9 | `Scanner.findAll()` returns a `Stream<MatchResult>` |
| Java 9 | `Pattern.asMatchPredicate()` — returns `Predicate<String>` (full match) |
| Java 11 | `Pattern.asMatchPredicate()` stabilized |

```java
// Java 9+: Stream-based matching
Pattern p = Pattern.compile("\\b\\w{5}\\b");
List<String> fiveLetterWords = p.matcher("Hello brave new world today")
    .results()
    .map(MatchResult::group)
    .collect(Collectors.toList());
// ["Hello", "brave", "world", "today"]

// Java 9+: Use as a predicate for filtering
Pattern emailPattern = Pattern.compile("[\\w.]+@[\\w.]+\\.\\w+");
Predicate<String> isEmail = emailPattern.asMatchPredicate();

List<String> validEmails = candidates.stream()
    .filter(isEmail)
    .collect(Collectors.toList());
```

---

## Interview Questions

??? question "What is the difference between matches(), find(), and lookingAt()?"
    - `matches()` requires the **entire input** to match the pattern. Equivalent to wrapping the pattern with `^...$`.
    - `find()` searches for the **next subsequence** anywhere in the input that matches. Can be called repeatedly to find all matches.
    - `lookingAt()` checks if the input **starts with** the pattern, but does not require it to consume the entire input.

    ```java
    Pattern p = Pattern.compile("\\d+");
    Matcher m = p.matcher("abc 123 def");

    m.matches();    // false — "abc 123 def" is not all digits
    m.lookingAt();  // false — does not start with digits
    m.find();       // true  — finds "123" within the input
    ```

??? question "Why should you avoid String.matches() in a loop?"
    `String.matches()` internally calls `Pattern.compile()` **every invocation**. Pattern compilation involves parsing the regex, building an NFA, and optimizing it — this is expensive. In a loop processing thousands of strings, you pay this cost every iteration.

    The correct approach is to pre-compile the `Pattern` into a `static final` field and create new `Matcher` instances per input. `Pattern` is immutable and thread-safe; `Matcher` is not.

??? question "Explain greedy vs reluctant vs possessive quantifiers with an example."
    Given input `"<b>bold</b>"` and pattern `<.+>`:

    - **Greedy** (`<.+>`): `.+` consumes as much as possible (`b>bold</b`), then backtracks character by character until `>` matches. Result: `<b>bold</b>` (one match spanning the whole string).
    - **Reluctant** (`<.+?>`): `.+?` consumes as little as possible (`b`), then checks if `>` matches. Result: `<b>` and `</b>` (two separate matches).
    - **Possessive** (`<.++>`): `.++` consumes as much as possible and **refuses to backtrack**. Since it consumed the final `>`, the pattern cannot match. Result: no match.

    Possessive quantifiers are useful for performance — they fail fast when no match is possible and prevent catastrophic backtracking.

??? question "What is the difference between a capturing group and a non-capturing group?"
    - **Capturing group** `(X)`: Matches X and remembers the match. Accessible via `matcher.group(n)`. Each capturing group is assigned a number (left-to-right by opening parenthesis).
    - **Non-capturing group** `(?:X)`: Matches X but does not remember it. Used for grouping alternation or applying quantifiers without the overhead of capturing.

    Use non-capturing groups when you only need logical grouping. This reduces memory usage and keeps group numbering clean.

    ```java
    // Capturing: group(1) = "http" or "https"
    Pattern p1 = Pattern.compile("(https?)://(.+)");

    // Non-capturing: group(1) = the URL path directly
    Pattern p2 = Pattern.compile("(?:https?)://(.+)");
    ```

??? question "How do lookahead and lookbehind work? Give a practical example."
    Lookarounds are **zero-width assertions** — they check for a condition at a position without consuming any characters.

    - `(?=X)` Positive lookahead: succeeds if X matches ahead
    - `(?!X)` Negative lookahead: succeeds if X does NOT match ahead
    - `(?<=X)` Positive lookbehind: succeeds if X matches behind
    - `(?<!X)` Negative lookbehind: succeeds if X does NOT match behind

    **Practical example** — extract numbers that are preceded by `$`:
    ```java
    Pattern p = Pattern.compile("(?<=\\$)\\d+\\.?\\d*");
    Matcher m = p.matcher("Items: $50, 30 units, $19.99");
    // Finds: "50", "19.99" (without the dollar sign)
    ```

    **Practical example** — password must contain at least one digit and one uppercase letter:
    ```java
    Pattern p = Pattern.compile("^(?=.*[A-Z])(?=.*\\d).{8,}$");
    ```
    Each lookahead checks a condition at position 0 without advancing the cursor.

??? question "What is ReDoS and how do you prevent it?"
    **ReDoS** (Regular Expression Denial of Service) is a vulnerability where a malicious input causes the regex engine to enter catastrophic backtracking, consuming exponential time.

    It occurs with patterns that have:

    - Nested quantifiers: `(a+)+`
    - Overlapping alternation: `(a|a)+`
    - Ambiguous repetition: `(\w+\s?)+`

    **Prevention strategies:**

    1. Use **possessive quantifiers** (`a++`) or **atomic groups** (`(?>a+)`) to prevent backtracking
    2. Avoid **nested quantifiers** — flatten them
    3. **Anchor** patterns with `^` and `$`
    4. Set a **timeout** or run regex in a separate thread with a deadline
    5. Use **static analysis tools** to detect vulnerable patterns before deployment

??? question "What does the MULTILINE flag actually do? How is it different from DOTALL?"
    `MULTILINE` (`(?m)`) changes the behavior of `^` and `$`:

    - Without it: `^` matches start of input, `$` matches end of input
    - With it: `^` also matches after `\n`, `$` also matches before `\n`

    `DOTALL` (`(?s)`) changes the behavior of `.`:

    - Without it: `.` matches any character **except** `\n`
    - With it: `.` matches any character **including** `\n`

    They are independent flags. You can use both, one, or neither.

    ```java
    String input = "line1\nline2\nline3";

    // Without MULTILINE: ^ only matches start of entire input
    Pattern.compile("^\\w+").matcher(input).find();      // "line1"

    // With MULTILINE: ^ matches start of each line
    Pattern.compile("(?m)^\\w+").matcher(input).results()
        .map(MatchResult::group).toList(); // ["line1", "line2", "line3"]
    ```

??? question "How would you extract all key-value pairs from a config string like 'host=localhost;port=8080;debug=true'?"
    Use named capturing groups for clarity:

    ```java
    Pattern p = Pattern.compile("(?<key>\\w+)=(?<value>[^;]+)");
    Matcher m = p.matcher("host=localhost;port=8080;debug=true");

    Map<String, String> config = new LinkedHashMap<>();
    while (m.find()) {
        config.put(m.group("key"), m.group("value"));
    }
    // {host=localhost, port=8080, debug=true}
    ```

    In Java 9+, you can use `matcher.results()` with streams for a more functional approach:
    ```java
    Map<String, String> config = p.matcher(input).results()
        .collect(Collectors.toMap(
            mr -> mr.group("key"),
            mr -> mr.group("value")
        ));
    ```

??? question "Is Pattern thread-safe? Is Matcher thread-safe?"
    `Pattern` is **immutable and thread-safe**. You should compile it once and store it in a `static final` field.

    `Matcher` is **stateful and NOT thread-safe**. It maintains internal state (current position, group captures, etc.). Each thread must create its own `Matcher` instance via `pattern.matcher(input)`.

    ```java
    // Correct concurrent usage
    private static final Pattern PATTERN = Pattern.compile("\\d+");

    // Each thread creates its own Matcher
    public boolean validate(String input) {
        return PATTERN.matcher(input).matches(); // new Matcher each call
    }
    ```

??? question "Write a regex to validate an IPv4 address."
    Each octet must be 0-255. This requires careful range handling:

    ```java
    Pattern IPV4 = Pattern.compile(
        "^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}" +
        "(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$"
    );

    IPV4.matcher("192.168.1.1").matches();    // true
    IPV4.matcher("255.255.255.255").matches(); // true
    IPV4.matcher("256.1.1.1").matches();       // false
    IPV4.matcher("1.2.3").matches();           // false
    ```

    **Breakdown of each octet:** `25[0-5]` matches 250-255, `2[0-4]\d` matches 200-249, `[01]?\d\d?` matches 0-199. The order matters because the regex engine tries alternatives left-to-right.

    In production, prefer `InetAddress.getByName()` with validation — regex cannot catch semantic issues like reserved ranges.
