# Rust Programming Language

> **Memory safety without garbage collection — powers Cloudflare Workers, Discord's backend, Dropbox's sync engine, and the Linux kernel.**

---

!!! abstract "Why Rust Matters for Backend Engineers"
    Rust is relevant for interviews at Cloudflare, Discord, Figma, AWS (Firecracker, Lambda runtime), Microsoft (Windows kernel), and any company building performance-critical infrastructure. As a Java/Go developer, learning Rust gives you: (1) deeper understanding of memory management that makes you better at JVM tuning, (2) fearless concurrency patterns that transfer to any language, (3) access to the fastest-growing systems programming ecosystem. Rust has been voted "most loved language" on Stack Overflow for 8 years straight.

## Why Rust?

Rust is a systems programming language focused on **safety**, **speed**, and **concurrency** — without a garbage collector.

| Feature | Rust | C++ | Go | Java |
|---|---|---|---|---|
| Memory Safety | Compile-time | Manual | GC | GC |
| Performance | Native | Native | Near-native | JIT |
| Concurrency | Fearless | Manual | Goroutines | Threads |
| Null Safety | `Option<T>` | Pointers | `nil` | Nullable |
| Package Manager | Cargo | CMake/Conan | Go modules | Maven/Gradle |

## Installation

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

rustc --version
cargo --version
```

## Hello World

```rust
fn main() {
    println!("Hello, world!");
}
```

```bash
cargo new hello_rust
cd hello_rust
cargo run
```

## Ownership — Rust's Core Innovation

Rust's ownership system guarantees memory safety at compile time.

### Three Rules of Ownership

1. Each value has exactly **one owner**
2. When the owner goes out of scope, the value is **dropped**
3. There can be either **one mutable reference** OR **any number of immutable references**

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;        // s1 is MOVED to s2; s1 is no longer valid
    // println!("{s1}"); // compile error!
    println!("{s2}");    // works fine
}
```

### Borrowing

```rust
fn calculate_length(s: &String) -> usize {
    s.len()
}

fn main() {
    let s = String::from("hello");
    let len = calculate_length(&s);  // borrow s, don't take ownership
    println!("Length of '{s}' is {len}");
}
```

### Mutable Borrowing

```rust
fn add_world(s: &mut String) {
    s.push_str(", world!");
}

fn main() {
    let mut s = String::from("hello");
    add_world(&mut s);
    println!("{s}");
}
```

## Structs & Enums

### Structs

```rust
#[derive(Debug)]
struct User {
    name: String,
    email: String,
    age: u32,
    active: bool,
}

impl User {
    fn new(name: String, email: String, age: u32) -> Self {
        Self { name, email, age, active: true }
    }

    fn is_adult(&self) -> bool {
        self.age >= 18
    }
}
```

### Enums with Data

```rust
enum Shape {
    Circle(f64),
    Rectangle(f64, f64),
    Triangle { base: f64, height: f64 },
}

fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Rectangle(w, h) => w * h,
        Shape::Triangle { base, height } => 0.5 * base * height,
    }
}
```

## Error Handling

Rust uses `Result<T, E>` and `Option<T>` instead of exceptions.

### Result Type

```rust
use std::fs;
use std::io;

fn read_file(path: &str) -> Result<String, io::Error> {
    fs::read_to_string(path)
}

fn main() {
    match read_file("config.toml") {
        Ok(contents) => println!("{contents}"),
        Err(e) => eprintln!("Failed to read file: {e}"),
    }
}
```

### The `?` Operator

Propagate errors concisely:

```rust
fn read_config() -> Result<String, io::Error> {
    let contents = fs::read_to_string("config.toml")?;
    Ok(contents.to_uppercase())
}
```

## Traits (Interfaces)

```rust
trait Summary {
    fn summarize(&self) -> String;

    fn preview(&self) -> String {
        format!("{}...", &self.summarize()[..50])
    }
}

struct Article {
    title: String,
    content: String,
}

impl Summary for Article {
    fn summarize(&self) -> String {
        format!("{}: {}", self.title, self.content)
    }
}
```

## Concurrency

### Threads

```rust
use std::thread;

fn main() {
    let handles: Vec<_> = (0..5)
        .map(|i| {
            thread::spawn(move || {
                println!("Thread {i} running");
            })
        })
        .collect();

    for handle in handles {
        handle.join().unwrap();
    }
}
```

### Channels (Message Passing)

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        tx.send("hello from thread").unwrap();
    });

    let msg = rx.recv().unwrap();
    println!("Received: {msg}");
}
```

## Cargo — The Build System

```bash
cargo new my_project       # Create new project
cargo build                # Compile
cargo run                  # Compile and run
cargo test                 # Run tests
cargo doc --open           # Generate and open documentation
cargo clippy               # Lint your code
cargo fmt                  # Format code
```

### Cargo.toml

```toml
[package]
name = "my_project"
version = "0.1.0"
edition = "2024"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
```

## Async Rust (Tokio)

```rust
use tokio;
use reqwest;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let resp = reqwest::get("https://api.example.com/users")
        .await?
        .json::<Vec<User>>()
        .await?;
    
    println!("Got {} users", resp.len());
    Ok(())
}

// Concurrent requests (like Promise.all in JS)
async fn fetch_all(urls: Vec<String>) -> Vec<String> {
    let futures: Vec<_> = urls.iter()
        .map(|url| reqwest::get(url))
        .collect();
    
    let results = futures::future::join_all(futures).await;
    results.into_iter()
        .filter_map(|r| r.ok())
        .map(|r| r.text())
        // ...
        .collect()
}
```

---

## When to Use Rust

!!! tip "Great for"
    - **Systems programming** — OS, drivers, embedded
    - **Web backends** — Actix-web, Axum, Rocket
    - **CLI tools** — ripgrep, bat, fd, exa
    - **WebAssembly** — high-performance browser code
    - **Blockchain** — Solana, Polkadot
    - **Game engines** — Bevy
    - **Data pipelines** — Polars, DataFusion

!!! warning "Not ideal for"
    - **Rapid prototyping** — compile times and borrow checker slow iteration
    - **CRUD web apps** — Go/Java/Python are simpler for typical REST APIs
    - **Teams new to systems programming** — steep learning curve (6-12 months to productivity)
    - **Short-lived scripts** — Python is faster to write for one-off tasks

---

## Interview Questions

??? question "What problem does Rust's ownership system solve?"
    It eliminates use-after-free, double-free, dangling pointers, and data races — **at compile time** with zero runtime cost. In C/C++, these bugs cause ~70% of security vulnerabilities (per Microsoft and Google's published data). Rust makes it impossible to write these bugs without `unsafe` blocks.

??? question "What is the difference between `&` (borrow) and `clone()`?"
    `&` creates a reference without copying data — zero cost, but the original owner must outlive the borrow. `clone()` creates a deep copy — safe but allocates new memory. Prefer borrowing; clone when you need independent ownership (e.g., sending data to another thread).

??? question "When would you use `unsafe` in Rust?"
    When the compiler can't verify safety but you can: FFI (calling C libraries), implementing data structures with raw pointers (custom linked lists), performance-critical code where bounds-checking is a bottleneck. The rule: minimize `unsafe` scope and wrap it in a safe API.

??? question "How does Rust achieve 'fearless concurrency'?"
    The ownership + type system prevents data races at compile time. You can't share mutable data across threads unless it's wrapped in `Arc<Mutex<T>>` or sent via channels. The compiler rejects code that could race — it's not a runtime check, it's a compile-time guarantee.
