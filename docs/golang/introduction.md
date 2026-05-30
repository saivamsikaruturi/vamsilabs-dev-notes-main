# Go (Golang)

> **A statically typed, compiled language designed for simplicity, concurrency, and building production services at scale.**

---

!!! abstract "Why Go Matters for Backend Engineers"
    Go powers Kubernetes, Docker, Terraform, and most cloud-native infrastructure. If you're interviewing at companies building distributed systems (Uber, Google, Cloudflare, Stripe), Go proficiency is a strong signal. It's the language of choice when you need: fast compilation, easy concurrency, small binaries, and straightforward deployment.

## Go vs Java — The Key Differences

| Aspect | Go | Java |
|---|---|---|
| **Type System** | Structural typing (interfaces satisfied implicitly) | Nominal typing (explicit `implements`) |
| **Inheritance** | None — composition via embedding | Class hierarchy |
| **Concurrency** | Goroutines + channels (CSP model) | Threads + shared memory (JMM) |
| **Memory** | GC with low-latency collector (sub-ms pauses) | GC with various collectors (G1, ZGC) |
| **Error Handling** | Explicit `error` return values | Exceptions (try/catch) |
| **Binary** | Single static binary, ~10MB | JVM + JAR, ~200MB+ runtime |
| **Compilation** | < 5 seconds for large projects | 30s-5min for large projects |
| **Generics** | Since Go 1.18 (2022) | Since Java 5 (2004) |
| **Deployment** | Copy binary, done | JVM + classpath + config |

---

## Installation & Setup

```bash
# macOS
brew install go

# Verify
go version
# go version go1.23.0 darwin/arm64

# Environment (set in ~/.zshrc)
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin
```

```bash
# Create a new project
mkdir myservice && cd myservice
go mod init github.com/yourname/myservice
```

---

## Core Language Features

### Variables & Types

```go
// Type inference
name := "Vamsi"          // string
age := 28                // int
rate := 99.9             // float64
active := true           // bool

// Explicit declaration
var timeout time.Duration = 30 * time.Second

// Constants
const maxRetries = 3

// Zero values (no null — everything has a default)
var s string   // ""
var n int      // 0
var b bool     // false
var p *int     // nil (only pointers, slices, maps, channels, interfaces)
```

### Structs & Methods (Go's "Classes")

```go
type Order struct {
    ID        string
    UserID    string
    Amount    float64
    Status    string
    CreatedAt time.Time
}

// Method with value receiver (read-only)
func (o Order) Total() float64 {
    return o.Amount * 1.18 // with tax
}

// Method with pointer receiver (can mutate)
func (o *Order) Cancel() {
    o.Status = "cancelled"
}

// Constructor pattern (Go has no constructors)
func NewOrder(userID string, amount float64) *Order {
    return &Order{
        ID:        uuid.New().String(),
        UserID:    userID,
        Amount:    amount,
        Status:    "pending",
        CreatedAt: time.Now(),
    }
}
```

### Interfaces (Structural / Implicit)

```go
// Define behavior, not identity
type PaymentProcessor interface {
    Charge(amount float64, currency string) (string, error)
    Refund(txID string) error
}

// Any struct with these methods satisfies the interface — no "implements" keyword
type StripeProcessor struct {
    apiKey string
}

func (s *StripeProcessor) Charge(amount float64, currency string) (string, error) {
    // call Stripe API...
    return "txn_abc123", nil
}

func (s *StripeProcessor) Refund(txID string) error {
    // call Stripe refund API...
    return nil
}

// Usage — depends on interface, not concrete type
func processPayment(p PaymentProcessor, amount float64) error {
    txID, err := p.Charge(amount, "USD")
    if err != nil {
        return fmt.Errorf("charge failed: %w", err)
    }
    log.Printf("charged %s", txID)
    return nil
}
```

### Error Handling

```go
// Go uses explicit error returns instead of exceptions
func fetchUser(id string) (*User, error) {
    resp, err := http.Get(fmt.Sprintf("/users/%s", id))
    if err != nil {
        return nil, fmt.Errorf("fetching user %s: %w", id, err)
    }
    defer resp.Body.Close()

    if resp.StatusCode == http.StatusNotFound {
        return nil, ErrUserNotFound
    }

    var user User
    if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
        return nil, fmt.Errorf("decoding user response: %w", err)
    }
    return &user, nil
}

// Sentinel errors for type-safe error checking
var ErrUserNotFound = errors.New("user not found")

// Caller
user, err := fetchUser("123")
if errors.Is(err, ErrUserNotFound) {
    // handle 404
} else if err != nil {
    // handle unexpected error
}
```

---

## Concurrency — Goroutines & Channels

This is Go's superpower. Goroutines are lightweight (2KB stack vs 1MB for OS threads) and multiplexed onto OS threads by the Go runtime scheduler.

### Goroutines

```go
// Launch a goroutine — just prefix with "go"
go func() {
    result := expensiveComputation()
    log.Println(result)
}()

// Real-world: fan-out to multiple services
func fetchOrderDetails(orderID string) (*OrderDetails, error) {
    var (
        order    *Order
        payment  *Payment
        shipping *Shipping
        mu       sync.Mutex
        errs     []error
    )

    var wg sync.WaitGroup
    wg.Add(3)

    go func() {
        defer wg.Done()
        o, err := orderService.Get(orderID)
        mu.Lock()
        defer mu.Unlock()
        if err != nil {
            errs = append(errs, err)
            return
        }
        order = o
    }()

    go func() {
        defer wg.Done()
        p, err := paymentService.GetByOrder(orderID)
        mu.Lock()
        defer mu.Unlock()
        if err != nil {
            errs = append(errs, err)
            return
        }
        payment = p
    }()

    go func() {
        defer wg.Done()
        s, err := shippingService.Track(orderID)
        mu.Lock()
        defer mu.Unlock()
        if err != nil {
            errs = append(errs, err)
            return
        }
        shipping = s
    }()

    wg.Wait()

    if len(errs) > 0 {
        return nil, fmt.Errorf("partial failure: %v", errs)
    }
    return &OrderDetails{Order: order, Payment: payment, Shipping: shipping}, nil
}
```

### Channels (Communication Between Goroutines)

```go
// Unbuffered channel — sender blocks until receiver is ready
ch := make(chan string)

go func() {
    ch <- "hello"  // blocks until someone reads
}()

msg := <-ch  // "hello"

// Buffered channel — sender blocks only when buffer is full
jobs := make(chan Job, 100)

// Worker pool pattern
func startWorkers(jobs <-chan Job, results chan<- Result, numWorkers int) {
    var wg sync.WaitGroup
    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for job := range jobs {
                results <- process(job)
            }
        }()
    }
    wg.Wait()
    close(results)
}

// Select — multiplexing channels (like Java's CompletableFuture.anyOf)
func fetchWithTimeout(ctx context.Context, url string) ([]byte, error) {
    ch := make(chan []byte, 1)
    errCh := make(chan error, 1)

    go func() {
        data, err := fetch(url)
        if err != nil {
            errCh <- err
            return
        }
        ch <- data
    }()

    select {
    case data := <-ch:
        return data, nil
    case err := <-errCh:
        return nil, err
    case <-ctx.Done():
        return nil, ctx.Err()  // timeout or cancellation
    }
}
```

### Context (Cancellation & Deadlines)

```go
// Every request handler should accept and propagate context
func handleRequest(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    user, err := userService.Get(ctx, r.URL.Query().Get("id"))
    if err != nil {
        if errors.Is(err, context.DeadlineExceeded) {
            http.Error(w, "timeout", http.StatusGatewayTimeout)
            return
        }
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }
    json.NewEncoder(w).Encode(user)
}
```

---

## The Standard Library — Go's Killer Feature

Unlike Java's ecosystem approach (Spring for HTTP, Jackson for JSON, JUnit for testing), Go ships production-grade tooling in the standard library. You can build real services with **zero external dependencies**.

| Need | Go Standard Library | Java Equivalent |
|---|---|---|
| HTTP server/client | `net/http` (production-ready, HTTP/2) | Spring Boot / Jetty |
| JSON encode/decode | `encoding/json` (struct tags for mapping) | Jackson / Gson |
| Unit testing | `testing` + `go test` (benchmarks, fuzzing built-in) | JUnit + Mockito + Gradle/Maven |
| Templating | `text/template`, `html/template` | Thymeleaf / Freemarker |
| Cryptography | `crypto/*` (TLS, AES, SHA, RSA) | Bouncy Castle |
| CLI flags | `flag` | Apache Commons CLI / Picocli |
| Logging | `log/slog` (structured, since Go 1.21) | SLF4J + Logback |
| Concurrency | `sync`, `context` (native to language) | `java.util.concurrent` |

This means: a Go microservice binary is often 10-15MB with zero runtime dependencies. No classpath hell, no dependency conflicts, no transitive vulnerability chains.

```go
// Complete JSON API handler — no external dependencies
func getUserHandler(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id") // Go 1.22+ path params in stdlib
    user, err := repo.FindByID(r.Context(), id)
    if err != nil {
        http.Error(w, "not found", http.StatusNotFound)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}
```

---

## Building Production Services

### HTTP Server (Standard Library)

```go
func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /health", healthHandler)
    mux.HandleFunc("GET /users/{id}", getUserHandler)
    mux.HandleFunc("POST /users", createUserHandler)

    server := &http.Server{
        Addr:         ":8080",
        Handler:      mux,
        ReadTimeout:  5 * time.Second,
        WriteTimeout: 10 * time.Second,
        IdleTimeout:  120 * time.Second,
    }

    // Graceful shutdown
    go func() {
        sigCh := make(chan os.Signal, 1)
        signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
        <-sigCh

        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
        defer cancel()
        server.Shutdown(ctx)
    }()

    log.Printf("listening on :8080")
    if err := server.ListenAndServe(); err != http.ErrServerClosed {
        log.Fatalf("server error: %v", err)
    }
}
```

### Project Layout (Standard)

```
myservice/
├── cmd/
│   └── server/
│       └── main.go          # entry point
├── internal/
│   ├── handler/             # HTTP handlers
│   ├── service/             # business logic
│   ├── repository/          # data access
│   └── model/               # domain types
├── pkg/                     # reusable libraries (exported)
├── go.mod
├── go.sum
├── Dockerfile
└── Makefile
```

### Testing

```go
func TestOrderService_PlaceOrder(t *testing.T) {
    // Table-driven tests — the Go idiom
    tests := []struct {
        name    string
        input   OrderRequest
        wantErr bool
    }{
        {
            name:    "valid order",
            input:   OrderRequest{UserID: "u1", Amount: 99.99},
            wantErr: false,
        },
        {
            name:    "zero amount rejected",
            input:   OrderRequest{UserID: "u1", Amount: 0},
            wantErr: true,
        },
        {
            name:    "missing user rejected",
            input:   OrderRequest{UserID: "", Amount: 50},
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            svc := NewOrderService(mockRepo{})
            _, err := svc.PlaceOrder(context.Background(), tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("PlaceOrder() error = %v, wantErr %v", err, tt.wantErr)
            }
        })
    }
}
```

---

## Go Concurrency Patterns

| Pattern | Use Case | Key Construct |
|---|---|---|
| **Worker Pool** | Process N jobs with M workers | Buffered channel + `sync.WaitGroup` |
| **Fan-Out/Fan-In** | Parallelize then aggregate | Multiple goroutines → single result channel |
| **Pipeline** | Multi-stage data processing | Chain of channels |
| **Rate Limiter** | Throttle operations | `time.Ticker` + channel |
| **Circuit Breaker** | Protect downstream services | State machine with mutex |
| **Pub/Sub** | Event broadcasting | Channel per subscriber |

---

## Interview Questions

??? question "How are goroutines different from Java threads?"
    Goroutines are **user-space threads** managed by the Go runtime, not OS threads. They start with ~2KB stack (vs 1MB for Java platform threads), are multiplexed onto a small pool of OS threads (M:N scheduling), and context-switching between them doesn't require a syscall. You can run millions of goroutines on a single machine. The closest Java equivalent is Virtual Threads (Java 21+), which adopted a similar M:N model.

??? question "What happens if a goroutine panics?"
    A panic in a goroutine crashes the **entire program** unless recovered with `defer`/`recover` in that specific goroutine. Unlike Java, there's no uncaught exception handler at the thread level. In production, wrap goroutine bodies with a recover-and-log pattern.

??? question "When would you use channels vs mutexes?"
    **Channels** for communicating data between goroutines (transferring ownership). **Mutexes** for protecting shared state that multiple goroutines read/write. Rule of thumb from the Go team: "Don't communicate by sharing memory; share memory by communicating."

??? question "How does Go's garbage collector work?"
    Go uses a **concurrent, tri-color mark-and-sweep** collector. It runs concurrently with application goroutines (no stop-the-world for most of the collection). GC pauses are typically < 1ms. The collector is optimized for latency over throughput — ideal for services where low p99 matters more than raw allocation speed.

??? question "Why doesn't Go have generics like Java?"
    Go added generics in Go 1.18 (2022), but with a simpler model — type parameters on functions and types, no wildcards, no variance annotations. The Go philosophy: prefer simple code that's slightly repetitive over complex abstractions. Before generics, Go used `interface{}` (empty interface) for generic containers, requiring type assertions at runtime.
