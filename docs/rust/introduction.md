# Rust Programming Language

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

## When to Use Rust

!!! tip "Great for"
    - **Systems programming** — OS, drivers, embedded
    - **Web backends** — Actix-web, Axum, Rocket
    - **CLI tools** — ripgrep, bat, fd, exa
    - **WebAssembly** — high-performance browser code
    - **Blockchain** — Solana, Polkadot
    - **Game engines** — Bevy
    - **Data pipelines** — Polars, DataFusion
