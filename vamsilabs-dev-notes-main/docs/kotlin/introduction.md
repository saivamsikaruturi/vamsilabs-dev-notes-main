# Kotlin Fundamentals

## Overview

Kotlin is a statically-typed, JVM-based programming language developed by JetBrains. It is fully interoperable with Java and is the preferred language for Android development. Kotlin emphasizes conciseness, null safety, and developer productivity.

!!! info "Key Characteristics"
    - 100% interoperable with Java
    - Null safety built into the type system
    - Coroutines for asynchronous programming
    - Concise syntax (reduces boilerplate by ~40% vs Java)
    - First-class support on Android, server-side, and multiplatform

```kotlin
fun main() {
    val greeting = "Hello, Kotlin!"
    println(greeting)
}
```

## Build Tool Configuration

- [Configure Kotlin using Maven](https://kotlinlang.org/docs/reference/using-maven.html)
- [Configure Kotlin using Gradle](https://kotlinlang.org/docs/reference/using-gradle.html)

## Null Safety

Kotlin's type system distinguishes between nullable and non-nullable types at compile time, eliminating `NullPointerException` in most cases.

### Nullable Types (?)

```kotlin
var name: String = "Kotlin"    // cannot be null
var nickname: String? = null   // can be null

// Compile error:
// name = null

// Safe call operator
println(nickname?.length)      // prints null (no crash)

// Chained safe calls
val city = user?.address?.city
```

### Not-null Assertion (!!)

```kotlin
// Use !! when you are certain the value is not null
val length: Int = nickname!!.length  // throws NPE if null
```

!!! warning "Avoid !! in Production"
    The `!!` operator defeats the purpose of null safety. Use it only when you can guarantee non-null at that point or in tests.

### let Scope Function

```kotlin
val email: String? = getEmail()

// Execute block only if non-null
email?.let { nonNullEmail ->
    sendVerification(nonNullEmail)
    println("Sent to $nonNullEmail")
}
```

### Elvis Operator (?:)

```kotlin
// Provide a default value when null
val displayName = user.nickname ?: "Anonymous"

// Combine with return/throw
fun getUser(id: Int): User {
    return userRepository.findById(id)
        ?: throw NotFoundException("User $id not found")
}
```

## Data Classes, Sealed Classes, and Object Declarations

### Data Classes

Data classes auto-generate `equals()`, `hashCode()`, `toString()`, `copy()`, and destructuring.

```kotlin
data class User(
    val id: Long,
    val name: String,
    val email: String
)

val user = User(1, "Alice", "alice@example.com")
println(user)  // User(id=1, name=Alice, email=alice@example.com)

// Copy with modifications
val updated = user.copy(email = "new@example.com")

// Destructuring
val (id, name, email) = user
```

### Sealed Classes

Sealed classes restrict class hierarchies — all subclasses must be defined in the same file or module.

```kotlin
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String, val cause: Exception? = null) : Result<Nothing>()
    object Loading : Result<Nothing>()
}

// Exhaustive when — compiler ensures all cases handled
fun handleResult(result: Result<String>) = when (result) {
    is Result.Success -> println("Data: ${result.data}")
    is Result.Error -> println("Error: ${result.message}")
    is Result.Loading -> println("Loading...")
}
```

!!! tip "Sealed vs Enum"
    Use `enum` for a fixed set of simple constants. Use `sealed class` when subclasses need to hold different data or state.

### Object Declarations (Singleton)

```kotlin
// Singleton
object DatabaseConfig {
    val url = "jdbc:postgresql://localhost:5432/mydb"
    val maxPoolSize = 10

    fun connect(): Connection { /* ... */ }
}

// Companion object (static-like members)
class User(val name: String) {
    companion object {
        fun fromJson(json: String): User {
            // parse JSON
            return User("parsed")
        }
    }
}

val user = User.fromJson("""{"name": "Alice"}""")
```

## Extension Functions

Add new functions to existing classes without modifying them.

```kotlin
// Extension function on String
fun String.removeWhitespace(): String {
    return this.replace("\\s".toRegex(), "")
}

"Hello World".removeWhitespace()  // => "HelloWorld"

// Extension function with generics
fun <T> List<T>.secondOrNull(): T? {
    return if (this.size >= 2) this[1] else null
}

listOf(1, 2, 3).secondOrNull()  // => 2
emptyList<Int>().secondOrNull() // => null

// Extension properties
val String.wordCount: Int
    get() = this.split("\\s+".toRegex()).size

"Hello Kotlin World".wordCount  // => 3
```

!!! note "Extension functions are resolved statically"
    Extension functions do not support polymorphism. The function called is determined by the declared type of the variable, not the runtime type.

## Coroutines

Coroutines enable asynchronous, non-blocking programming in a sequential style.

### Setup

```kotlin
// build.gradle.kts
dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")
}
```

### launch and async

```kotlin
import kotlinx.coroutines.*

fun main() = runBlocking {
    // launch — fire and forget (returns Job)
    val job = launch {
        delay(1000)
        println("World!")
    }
    println("Hello,")
    job.join()

    // async — returns a Deferred (future with a result)
    val deferred = async {
        fetchUserFromNetwork()
    }
    val user = deferred.await()
    println(user)
}
```

### Suspend Functions

```kotlin
suspend fun fetchUser(id: Int): User {
    delay(1000)  // non-blocking sleep
    return userRepository.findById(id)
}

suspend fun fetchUserWithPosts(id: Int): UserWithPosts {
    // Parallel decomposition
    return coroutineScope {
        val user = async { fetchUser(id) }
        val posts = async { fetchPosts(id) }
        UserWithPosts(user.await(), posts.await())
    }
}
```

### Structured Concurrency

Structured concurrency ensures that coroutines do not leak — when a scope is cancelled, all its children are cancelled.

```kotlin
class UserViewModel : ViewModel() {
    // viewModelScope auto-cancels when ViewModel is destroyed
    fun loadData() {
        viewModelScope.launch {
            try {
                val users = fetchUsers()
                _state.value = UiState.Success(users)
            } catch (e: Exception) {
                _state.value = UiState.Error(e.message)
            }
        }
    }
}

// Custom scope with SupervisorJob
val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
```

### Dispatchers

| Dispatcher | Use Case |
|-----------|----------|
| `Dispatchers.Main` | UI updates (Android) |
| `Dispatchers.IO` | Network, disk I/O |
| `Dispatchers.Default` | CPU-intensive work |
| `Dispatchers.Unconfined` | Testing (not for production) |

```kotlin
suspend fun processData() = withContext(Dispatchers.Default) {
    // CPU-intensive work happens here
    data.map { transform(it) }
}
```

## Kotlin vs Java Comparison

| Feature | Kotlin | Java |
|---------|--------|------|
| Null safety | Built into type system | Optional (added in Java 8) |
| Data classes | `data class User(val name: String)` | Records (Java 16+) or manual boilerplate |
| Extension functions | Supported natively | Not available |
| Coroutines | First-class support | Virtual threads (Java 21+) |
| String templates | `"Hello, $name"` | `STR."Hello, \{name}"` (Java 21+) |
| Smart casts | Automatic after type check | Manual casting required |
| Default arguments | `fun greet(name: String = "World")` | Method overloading |
| Sealed classes | Since Kotlin 1.0 | Since Java 17 |
| Singletons | `object` keyword | Manual implementation |

```kotlin
// Kotlin — concise
data class User(val name: String, val age: Int)

val adults = users.filter { it.age >= 18 }
                  .sortedBy { it.name }
                  .map { it.name }
```

```java
// Java — more verbose
public record User(String name, int age) {}

List<String> adults = users.stream()
    .filter(u -> u.age() >= 18)
    .sorted(Comparator.comparing(User::name))
    .map(User::name)
    .collect(Collectors.toList());
```

## Ktor Framework Basics

[Ktor](https://ktor.io/) is a lightweight, asynchronous framework for building web applications and HTTP clients in Kotlin.

```kotlin
// build.gradle.kts
dependencies {
    implementation("io.ktor:ktor-server-core:2.3.7")
    implementation("io.ktor:ktor-server-netty:2.3.7")
    implementation("io.ktor:ktor-server-content-negotiation:2.3.7")
    implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.7")
}
```

### Server Setup

```kotlin
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun main() {
    embeddedServer(Netty, port = 8080) {
        configureRouting()
        configureSerialization()
    }.start(wait = true)
}

fun Application.configureRouting() {
    routing {
        get("/") {
            call.respondText("Hello, Ktor!")
        }

        route("/api/users") {
            get {
                val users = userService.getAll()
                call.respond(users)
            }
            post {
                val user = call.receive<CreateUserRequest>()
                val created = userService.create(user)
                call.respond(HttpStatusCode.Created, created)
            }
            get("/{id}") {
                val id = call.parameters["id"]?.toLongOrNull()
                    ?: return@get call.respond(HttpStatusCode.BadRequest)
                val user = userService.findById(id)
                    ?: return@get call.respond(HttpStatusCode.NotFound)
                call.respond(user)
            }
        }
    }
}
```

### Ktor HTTP Client

```kotlin
val client = HttpClient(CIO) {
    install(ContentNegotiation) {
        json()
    }
}

suspend fun fetchTodos(): List<Todo> {
    return client.get("https://jsonplaceholder.typicode.com/todos").body()
}
```

## Common Interview Questions

!!! question "What is the difference between `val` and `var`?"
    `val` is read-only (similar to `final` in Java) — once assigned, it cannot be reassigned. `var` is mutable and can be reassigned.

!!! question "How do `==` and `===` differ in Kotlin?"
    `==` checks structural equality (calls `equals()`). `===` checks referential equality (same object in memory).

!!! question "What is the difference between `lateinit` and `lazy`?"
    - `lateinit` is for `var` properties — initialization is deferred but must happen before first access.
    - `lazy` is for `val` properties — initialized on first access using a lambda. Thread-safe by default.

```kotlin
lateinit var adapter: RecyclerAdapter  // mutable, initialized later

val heavyObject: ExpensiveClass by lazy {
    ExpensiveClass()  // created only on first access
}
```

!!! question "Explain `inline` functions and `reified` type parameters."
    `inline` copies the function body to the call site, avoiding lambda object allocation. `reified` allows accessing generic type info at runtime (normally erased).

```kotlin
inline fun <reified T> isInstanceOf(value: Any): Boolean {
    return value is T  // only possible with reified
}

isInstanceOf<String>("hello")  // true
isInstanceOf<Int>("hello")     // false
```

!!! question "What are scope functions (let, run, with, apply, also)?"
    Scope functions execute a block of code in the context of an object:

    - `let` — null checks, transformations (`it` reference)
    - `run` — object configuration + compute result (`this` reference)
    - `with` — group calls on an object (`this` reference)
    - `apply` — object configuration, returns the object (`this` reference)
    - `also` — additional actions, returns the object (`it` reference)

```kotlin
// apply — configure and return object
val user = User().apply {
    name = "Alice"
    email = "alice@example.com"
}

// let — null-safe transformation
val length = nullableString?.let { it.length } ?: 0

// also — side effects
val numbers = mutableListOf(1, 2, 3).also {
    println("Original list: $it")
}
```

## Libraries and Frameworks

* [Ktor](https://ktor.io/) — Asynchronous web framework
* [Spring Boot with Kotlin](https://spring.io/guides/tutorials/spring-boot-kotlin/) — Enterprise framework
* [MockK](https://mockk.io/) — Mocking library for Kotlin
* [Koin](https://insert-koin.io/) — Lightweight dependency injection
* [Exposed](https://github.com/JetBrains/Exposed) — SQL framework by JetBrains
* [Arrow](https://arrow-kt.io/) — Functional programming library

## References

* <https://kotlinlang.org/docs/reference/>
* <https://www.reddit.com/r/kotlin>
* <https://github.com/KotlinBy/awesome-kotlin>
* <https://play.kotlinlang.org/>
