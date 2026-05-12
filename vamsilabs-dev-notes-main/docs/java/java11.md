# Java 11 — LTS Features You Should Know

Java 11 is the first **Long-Term Support** release after Java 8. Most enterprises migrated from Java 8 directly to Java 11. It removed several deprecated modules and added practical API improvements.

---

## Key Features at a Glance

| Feature | What changed |
|---|---|
| **`var` in lambdas** | Local variable type inference in lambda parameters |
| **New String methods** | `isBlank()`, `strip()`, `lines()`, `repeat()` |
| **HttpClient (Standard)** | Modern HTTP/2 client replaces `HttpURLConnection` |
| **Files utility methods** | `readString()`, `writeString()` — one-liners for file I/O |
| **Optional improvements** | `isEmpty()` method added |
| **Removed modules** | Java EE and CORBA modules removed from JDK |
| **Single-file execution** | Run `.java` files directly without compiling |

---

## New String Methods

Java 11 added **6 new methods** to the `String` class:

```java
// isBlank() — checks for empty or whitespace-only
"".isBlank();       // true
"   ".isBlank();    // true
"hello".isBlank();  // false

// strip() — removes leading AND trailing whitespace (Unicode-aware)
"  hello  ".strip();       // "hello"
"  hello  ".stripLeading(); // "hello  "
"  hello  ".stripTrailing(); // "  hello"

// lines() — splits string by line terminators, returns Stream
"line1\nline2\nline3".lines()
    .forEach(System.out::println);
// line1
// line2
// line3

// repeat() — repeats the string N times
"ha".repeat(3);  // "hahaha"
"-".repeat(40);  // "----------------------------------------"
```

### `strip()` vs `trim()` — What's the difference?

| Method | Removes | Unicode-aware |
|---|---|---|
| `trim()` | Characters <= `\u0020` (space) | No |
| `strip()` | All Unicode whitespace | Yes |

```java
char unicodeSpace = '\u2003';  // em space
String s = unicodeSpace + "hello" + unicodeSpace;
s.trim().length();   // still has unicode spaces — trim doesn't remove them
s.strip().length();  // 5 — strip handles Unicode correctly
```

**Rule**: Always use `strip()` in Java 11+.

---

## HttpClient — Modern HTTP Calls

Java 11 promoted the HTTP Client from incubator to standard (`java.net.http`). It supports **HTTP/2**, **async calls**, and **WebSocket**.

### Synchronous GET

```java
HttpClient client = HttpClient.newHttpClient();

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.github.com/users/vamsi1998123"))
    .header("Accept", "application/json")
    .GET()
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

System.out.println(response.statusCode());  // 200
System.out.println(response.body());        // JSON string
```

### Asynchronous POST

```java
HttpClient client = HttpClient.newHttpClient();

String json = """
    {"name": "Vamsi", "role": "Engineer"}
    """;

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://httpbin.org/post"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(json))
    .build();

client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
    .thenApply(HttpResponse::body)
    .thenAccept(System.out::println)
    .join();  // wait for completion
```

### HttpClient vs RestTemplate vs WebClient

| Feature | HttpClient (Java 11) | RestTemplate (Spring) | WebClient (Spring) |
|---|---|---|---|
| Dependency | None (JDK built-in) | Spring Web | Spring WebFlux |
| Async support | Yes | No | Yes (reactive) |
| HTTP/2 | Yes | No | Yes |
| Best for | Utility apps, non-Spring | Spring MVC apps | Reactive/Spring apps |

---

## `var` in Lambda Parameters

Java 10 introduced `var` for local variables. Java 11 extends it to **lambda parameters**, which enables annotations on lambda params.

```java
// Without var
list.stream()
    .map((String s) -> s.toUpperCase())
    .collect(Collectors.toList());

// With var — now you can add annotations
list.stream()
    .map((@NotNull var s) -> s.toUpperCase())
    .collect(Collectors.toList());
```

The main use case is **adding annotations** to lambda parameters — you can't annotate implicit types without `var`.

---

## File I/O — One-Liners

```java
// Read entire file as string
String content = Files.readString(Path.of("config.json"));

// Write string to file
Files.writeString(Path.of("output.txt"), "Hello, Java 11!");

// With options
Files.writeString(
    Path.of("log.txt"),
    "New log entry\n",
    StandardOpenOption.APPEND, StandardOpenOption.CREATE
);
```

Compare with Java 8:
```java
// Java 8 — verbose
String content = new String(Files.readAllBytes(Paths.get("config.json")));
```

---

## Optional Improvements

```java
// isEmpty() — opposite of isPresent()
Optional<String> empty = Optional.empty();
empty.isEmpty();    // true (new in Java 11)
empty.isPresent();  // false

// or() — lazy alternative (Java 9)
Optional<String> name = getName()
    .or(() -> getNickname())
    .or(() -> Optional.of("Anonymous"));
```

---

## Running Java Files Directly

No need to compile first for single-file programs:

```bash
# Before Java 11
javac HelloWorld.java
java HelloWorld

# Java 11+
java HelloWorld.java
```

Useful for scripts, prototyping, and teaching.

---

## Removed Modules

These were deprecated in Java 9 and **removed in Java 11**:

| Module | What it was | Replacement |
|---|---|---|
| `java.xml.ws` | JAX-WS (SOAP) | Add `jakarta.xml.ws-api` dependency |
| `java.xml.bind` | JAXB (XML binding) | Add `jakarta.xml.bind-api` + `jaxb-runtime` |
| `java.activation` | JavaBeans Activation | Add `jakarta.activation-api` |
| `java.corba` | CORBA | None (dead technology) |
| `java.transaction` | JTA | Add `jakarta.transaction-api` |
| `java.se.ee` | Aggregator | Add individual Jakarta dependencies |

If you're migrating from Java 8 → 11, this is the most common source of build failures.

---

## Interview Questions

??? question "1. Your project migrated from Java 8 to 11 and builds are failing. What's the most likely cause?"
    The removal of Java EE modules (JAXB, JAX-WS, JTA). These were bundled with Java 8 but removed in Java 11. Add the corresponding Jakarta dependencies to your `pom.xml` or `build.gradle`. Run `javac --list-modules` to verify what's available.

??? question "2. When would you use Java 11's HttpClient over Spring's RestTemplate?"
    For non-Spring applications (CLI tools, libraries, Lambda functions) where adding Spring as a dependency is overkill. Also when you need HTTP/2 support or non-blocking async calls without the reactive programming model of WebClient. In Spring apps, stick with RestTemplate or WebClient.

??? question "3. What is the difference between `isBlank()` and `isEmpty()`?"
    `isEmpty()` returns `true` only for `""` (zero length). `isBlank()` returns `true` for `""` AND strings containing only whitespace (`"   "`, `"\t\n"`). Use `isBlank()` for user input validation where whitespace-only input should be treated as empty.
