# Long Polling, WebSockets & SSE

> **The three ways to push data from server to client — choose wrong and you waste 40% of your infrastructure budget.**

---

!!! danger "Real Incident: Slack's Architecture Evolution"
    Slack v1 used long polling — 1M users each holding a connection open for 30s, then reconnecting. Constant churn, brutal server costs. They switched to WebSockets: persistent connections, **40% less infrastructure**, instant delivery.

---

## The Real-Time Spectrum

```mermaid
flowchart LR
    A["SHORT POLLING<br/>new request every N sec"] ==>|"Hold open"| B["LONG POLLING<br/>wait for data or timeout"]
    B ==>|"Persistent"| C["SSE<br/>server push · auto-reconnect"]
    C ==>|"Full duplex"| D["WEBSOCKET<br/>2-byte frames · bidirectional"]

    style A fill:#FCD34D,stroke:#FBBF24,color:#78350F
    style B fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style C fill:#86EFAC,stroke:#4ADE80,color:#14532D
    style D fill:#93C5FD,stroke:#60A5FA,color:#1E3A5F

    linkStyle 0 stroke:#92400E,stroke-width:2px
    linkStyle 1 stroke:#166534,stroke-width:2px
    linkStyle 2 stroke:#1D4ED8,stroke-width:3px
```

| | Short Polling | Long Polling | SSE | WebSocket |
|---|---|---|---|---|
| **Direction** | Client → Server | Client → Server | Server → Client | Bidirectional |
| **Connection** | New each time | Held until data/timeout | Persistent HTTP | Persistent TCP |
| **Overhead** | ~800 bytes/req | ~800 bytes/reconnect | Minimal | 2-14 bytes/frame |
| **Latency** | Up to N seconds | Near-instant | Near-instant | Sub-millisecond |
| **Complexity** | Trivial | Low | Low | High |

---

## Short Polling

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server

    rect rgba(254, 243, 199, 0.3)
        C->>S: Any updates? (t=0s)
        S-->>C: No data
        C->>S: Any updates? (t=5s)
        S-->>C: No data
        C->>S: Any updates? (t=10s)
        S-->>C: No data
    end

    rect rgba(134, 239, 172, 0.3)
        C->>S: Any updates? (t=15s)
        S-->>C: Here is your message!
    end

    Note over C,S: 3 out of 4 requests wasted — 75% bandwidth burned
```

**The math that kills it:**

- 1M users × 5s interval = **200K requests/sec**
- 95% empty = **190K wasted/sec**
- ~800 bytes headers each = **152 MB/sec wasted bandwidth**

!!! failure "Only acceptable for"
    Weather updates, exchange rates — anything with > 5 min intervals. Never for real-time.

---

## Long Polling

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server

    rect rgba(219, 234, 254, 0.3)
        C->>S: Any updates?
        Note right of S: Holds connection open...
        Note right of S: Waits for data or timeout
        S-->>C: Data arrives! Here you go.
    end

    rect rgba(254, 243, 199, 0.3)
        C->>S: Reconnects immediately
        Note right of S: Holds... 30s timeout
        S-->>C: Timeout — no data
    end

    rect rgba(254, 226, 226, 0.3)
        C->>S: Reconnects again (churn!)
    end
```

**The thundering herd problem:**

```mermaid
flowchart LR
    A["1M users timeout<br/>at same moment"] ==> B["All reconnect<br/>simultaneously"] ==> C["SERVER<br/>OVERWHELMED"]

    style A fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style B fill:#FCD34D,stroke:#FBBF24,color:#78350F
    style C fill:#FCA5A5,stroke:#F87171,color:#7F1D1D

    linkStyle 0 stroke:#92400E,stroke-width:3px
    linkStyle 1 stroke:#DC2626,stroke-width:3px
```

**When to use:** Fallback when WebSocket/SSE blocked by corporate firewalls.

---

## Server-Sent Events (SSE)

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server

    rect rgba(209, 250, 229, 0.3)
        C->>S: GET /events (text/event-stream)
        S-->>C: 200 OK (keep-alive)
        S-->>C: event: price-update
        S-->>C: event: notification
        S-->>C: event: alert
    end

    rect rgba(254, 226, 226, 0.3)
        Note over C,S: Connection drops!
    end

    rect rgba(219, 234, 254, 0.3)
        C->>S: GET /events (Last-Event-ID: 42)
        S-->>C: Resumes from event 43!
        Note over C,S: Auto-reconnect with resume — zero data loss
    end
```

### SSE vs WebSocket — When to Choose SSE

```mermaid
flowchart LR
    subgraph SSE[" "]
        direction TB
        A["Standard HTTP infra"]
        B["Auto-reconnect built-in"]
        C["Resume from last event"]
    end
    subgraph WS[" "]
        direction TB
        D["Bidirectional needed"]
        E["Binary data support"]
        F["Sub-ms latency"]
    end

    SSE --- PICK_SSE["SSE WINS"]
    WS --- PICK_WS["WEBSOCKET WINS"]

    style A fill:#D1FAE5,stroke:#86EFAC,color:#166534
    style B fill:#D1FAE5,stroke:#86EFAC,color:#166534
    style C fill:#D1FAE5,stroke:#86EFAC,color:#166534
    style PICK_SSE fill:#86EFAC,stroke:#4ADE80,color:#14532D

    style D fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style E fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style F fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style PICK_WS fill:#93C5FD,stroke:#60A5FA,color:#1E3A5F

    linkStyle 0 stroke:#166534,stroke-width:2px
    linkStyle 1 stroke:#1D4ED8,stroke-width:2px
```

!!! tip "ChatGPT uses SSE"
    AI streaming responses are server-push only, text-based, HTTP-friendly — perfect SSE use case.

**When to use:** Notifications, live feeds, stock tickers, AI streaming, score updates.

---

## WebSocket

### The Upgrade Handshake

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server

    rect rgba(254, 243, 199, 0.3)
        C->>S: HTTP GET /chat (Upgrade: websocket)
        S-->>C: 101 Switching Protocols
    end

    Note over C,S: Full-duplex TCP — both sides talk freely

    rect rgba(219, 234, 254, 0.3)
        C->>S: "Hello everyone!"
        S-->>C: "Welcome to #general"
        S-->>C: Push: someone is typing...
        C->>S: Typing indicator
        S-->>C: Push: new reaction added
    end
```

### The Overhead Difference

| | HTTP Request | WebSocket Frame |
|---|---|---|
| Header overhead | ~800 bytes | 2-14 bytes |
| To send "hello" | 805 bytes | 7 bytes |
| 1000 messages | 805 KB | 7 KB |
| **Savings** | Baseline | **~99% less** |

---

## Decision Framework

!!! abstract "The 3-Second Rule"
    **Both sides talk?** → WebSocket. **Server talks, client listens?** → SSE. **That's it.**

```mermaid
flowchart LR
    subgraph need[" "]
        direction TB
        A["Both sides talk"]
        B["Only server pushes"]
        C["Data rarely changes"]
    end

    A ==> WS["WEBSOCKET<br/>2-byte frames · full duplex"]
    B ==> SSE["SSE<br/>auto-reconnect · HTTP native"]
    C -.-> SP["SHORT POLL<br/>simplest · most wasteful"]

    WS --- W["Slack · Discord · Uber<br/>Google Docs · Coinbase"]
    SSE --- S["ChatGPT · GitHub Actions<br/>ESPN · Stripe · Twitter"]

    style A fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style B fill:#D1FAE5,stroke:#86EFAC,color:#166534
    style C fill:#FEF3C7,stroke:#FCD34D,color:#92400E

    style WS fill:#93C5FD,stroke:#60A5FA,color:#1E3A5F
    style SSE fill:#86EFAC,stroke:#4ADE80,color:#14532D
    style SP fill:#FCD34D,stroke:#FBBF24,color:#78350F

    style W fill:#EFF6FF,stroke:#BFDBFE,color:#1E40AF
    style S fill:#ECFDF5,stroke:#A7F3D0,color:#166534

    linkStyle 0 stroke:#1D4ED8,stroke-width:3px
    linkStyle 1 stroke:#166534,stroke-width:3px
    linkStyle 2 stroke:#92400E,stroke-width:1px,stroke-dasharray:5
    linkStyle 3 stroke:#93C5FD,stroke-width:1px
    linkStyle 4 stroke:#86EFAC,stroke-width:1px
```

| Your System Looks Like... | Pick This | Real Examples |
|---|---|---|
| Users typing, sending, reacting in real-time | **WebSocket** | Slack, Discord, Google Docs, Uber |
| Server pushes updates, client just renders | **SSE** | ChatGPT, GitHub Actions, ESPN, Stripe |
| Data barely changes, simplicity > performance | **Short Polling** | Weather widget, dashboard refresh |

---

## Scaling WebSockets — The Hard Part

WebSocket connections are **stateful**. This changes everything about scaling.

### Multi-Server Architecture

```mermaid
flowchart TD
    C1["User A"] & C2["User B"] --> LB["LOAD BALANCER<br/>sticky sessions"]
    C3["User C"] & C4["User D"] --> LB
    LB ==> S1["Server 1"]
    LB ==> S2["Server 2"]
    S1 <--> PUB["REDIS PUB/SUB<br/>cross-server backbone"]
    S2 <--> PUB

    style C1 fill:#EFF6FF,stroke:#BFDBFE,color:#1E40AF
    style C2 fill:#EFF6FF,stroke:#BFDBFE,color:#1E40AF
    style C3 fill:#EFF6FF,stroke:#BFDBFE,color:#1E40AF
    style C4 fill:#EFF6FF,stroke:#BFDBFE,color:#1E40AF
    style LB fill:#FCD34D,stroke:#FBBF24,color:#78350F
    style S1 fill:#93C5FD,stroke:#60A5FA,color:#1E3A5F
    style S2 fill:#93C5FD,stroke:#60A5FA,color:#1E3A5F
    style PUB fill:#86EFAC,stroke:#4ADE80,color:#14532D

    linkStyle 4 stroke:#166534,stroke-width:2px
    linkStyle 5 stroke:#166534,stroke-width:2px
```

### Cross-Server Message Routing

```mermaid
sequenceDiagram
    participant A as User A (Server 1)
    participant S1 as Server 1
    participant R as Redis Pub/Sub
    participant S2 as Server 2
    participant B as User B (Server 2)

    rect rgba(219, 234, 254, 0.3)
        A->>S1: "Hello B!"
        S1->>R: PUBLISH channel:chat
    end

    rect rgba(209, 250, 229, 0.3)
        R->>S2: Deliver to subscribers
        S2->>B: "Hello B!"
    end

    Note over A,B: User A and B on different servers — Redis bridges the gap
```

| Pub/Sub Backbone | Latency | Used By |
|---|---|---|
| Redis Pub/Sub | <1ms | Slack |
| Kafka | 5-20ms | LinkedIn |
| Custom in-memory | <0.5ms | Discord (Elixir) |

### Connection Limits

| Users | RAM (at ~40KB/conn) | Servers (100K/server) |
|---|---|---|
| 100K | ~4 GB | 1 |
| 1M | ~40 GB | 10 |
| 10M | ~400 GB | 100 |

### Reconnection Storm

```mermaid
flowchart LR
    A["Server restarts"] ==> B["100K connections<br/>drop simultaneously"]
    B ==> D["WITHOUT JITTER<br/>thundering herd"]
    B -.-> E["WITH JITTER<br/>smooth reconnect over 15s"]

    style A fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style B fill:#FCD34D,stroke:#FBBF24,color:#78350F
    style D fill:#FCA5A5,stroke:#F87171,color:#7F1D1D
    style E fill:#86EFAC,stroke:#4ADE80,color:#14532D

    linkStyle 0 stroke:#92400E,stroke-width:3px
    linkStyle 1 stroke:#DC2626,stroke-width:3px
    linkStyle 2 stroke:#166534,stroke-width:2px,stroke-dasharray:5
```

**Fix:** `delay = min(base × 2^attempt, maxDelay) + random(0, jitter)`

---

## Connection Lifecycle

```mermaid
flowchart LR
    A["CONNECTING<br/>handshake in progress"] ==> B["OPEN<br/>ping/pong every 30s"]
    B ==> C["CLOSING<br/>close frame sent"]
    C ==> D["CLOSED"]
    B -.-> D
    D -.-> A

    style A fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style B fill:#86EFAC,stroke:#4ADE80,color:#14532D
    style C fill:#FCD34D,stroke:#FBBF24,color:#78350F
    style D fill:#93C5FD,stroke:#60A5FA,color:#1E3A5F

    linkStyle 0 stroke:#166534,stroke-width:3px
    linkStyle 1 stroke:#92400E,stroke-width:2px
    linkStyle 2 stroke:#1D4ED8,stroke-width:2px
    linkStyle 3 stroke:#DC2626,stroke-width:1px,stroke-dasharray:5
    linkStyle 4 stroke:#92400E,stroke-width:1px,stroke-dasharray:5
```

### Graceful Degradation

```mermaid
flowchart LR
    A["Try WebSocket"] ==>|"OK"| D["USE WEBSOCKET<br/>best experience"]
    A -.->|"Blocked"| B["Try SSE"]
    B ==>|"OK"| E["USE SSE<br/>good fallback"]
    B -.->|"Blocked"| C["LONG POLLING<br/>last resort"]

    style A fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style B fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF
    style D fill:#86EFAC,stroke:#4ADE80,color:#14532D
    style E fill:#93C5FD,stroke:#60A5FA,color:#1E3A5F
    style C fill:#FCD34D,stroke:#FBBF24,color:#78350F

    linkStyle 0 stroke:#166534,stroke-width:3px
    linkStyle 1 stroke:#92400E,stroke-width:1px,stroke-dasharray:5
    linkStyle 2 stroke:#1D4ED8,stroke-width:3px
    linkStyle 3 stroke:#92400E,stroke-width:1px,stroke-dasharray:5
```

---

## Real-World Architectures

### Slack

```mermaid
flowchart LR
    Client["Slack Client"] <===>|"WebSocket"| Flannel["FLANNEL<br/>connection manager"]
    Flannel <--> Redis["REDIS PUB/SUB"]
    Redis <--> MSG["Message Service"]
    MSG --> Vitess["MySQL Vitess"]

    style Client fill:#EFF6FF,stroke:#BFDBFE,color:#1E40AF
    style Flannel fill:#93C5FD,stroke:#60A5FA,color:#1E3A5F
    style Redis fill:#86EFAC,stroke:#4ADE80,color:#14532D
    style MSG fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style Vitess fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF

    linkStyle 0 stroke:#1D4ED8,stroke-width:3px
```

### Discord

```mermaid
flowchart LR
    Clients["10M+ Clients"] <===>|"WebSocket"| GW["GATEWAY<br/>Elixir · 2KB/process"]
    GW <--> Guild["GUILD SERVERS<br/>in-memory state"]
    Guild --> Cass["Cassandra"]

    style Clients fill:#EFF6FF,stroke:#BFDBFE,color:#1E40AF
    style GW fill:#93C5FD,stroke:#60A5FA,color:#1E3A5F
    style Guild fill:#86EFAC,stroke:#4ADE80,color:#14532D
    style Cass fill:#DBEAFE,stroke:#93C5FD,color:#1E40AF

    linkStyle 0 stroke:#1D4ED8,stroke-width:3px
```

**Key insight:** Elixir process = ~2KB vs OS thread = ~1MB. Millions of lightweight processes per server.

### Uber (Driver Location)

```mermaid
flowchart LR
    Driver["Driver App<br/>GPS every 4s"] ==>|"WebSocket"| GW["GATEWAY"]
    GW ==> Kafka["KAFKA"]
    Kafka ==> Geo["GEOSPATIAL INDEX<br/>H3 hexagonal grid"]
    Geo ==>|"WebSocket"| Rider["Rider App<br/>live map update"]

    style Driver fill:#FEF3C7,stroke:#FCD34D,color:#92400E
    style GW fill:#FCD34D,stroke:#FBBF24,color:#78350F
    style Kafka fill:#86EFAC,stroke:#4ADE80,color:#14532D
    style Geo fill:#93C5FD,stroke:#60A5FA,color:#1E3A5F
    style Rider fill:#D1FAE5,stroke:#86EFAC,color:#166534

    linkStyle 0 stroke:#92400E,stroke-width:3px
    linkStyle 1 stroke:#166534,stroke-width:3px
    linkStyle 2 stroke:#1D4ED8,stroke-width:3px
    linkStyle 3 stroke:#1D4ED8,stroke-width:3px
```

---

## HTTP/2 Push vs SSE vs WebSocket

| | HTTP/2 Push | SSE | WebSocket |
|---|---|---|---|
| Direction | Server → Client | Server → Client | Bidirectional |
| Designed for | Assets (CSS, JS) | Event streams | Real-time interactive |
| Status | **DEPRECATED** | Well-supported | Well-supported |

!!! warning "Interview Trap"
    HTTP/2 Server Push is NOT a replacement for SSE/WebSocket. It was for pushing assets and is being deprecated. Don't confuse them.

---

## Interview Answer Template

!!! abstract "How to answer real-time system design questions"

    **Step 1 — Direction:** "Communication is [bidirectional / server-push only], so [WebSocket / SSE] fits because..."

    **Step 2 — Frequency:** "Messages at [X/sec], latency needs [Y]ms. Rules out [polling] because..."

    **Step 3 — Scaling:** "With [N] concurrent connections at 100K/server, I need [N/100K] gateway servers. Cross-server routing via [Redis Pub/Sub / Kafka]."

    **Step 4 — Failures:** "Exponential backoff + jitter for reconnection. Heartbeat every 30s to detect dead connections."

    **Step 5 — Numbers:** "[N] users × 40KB = [X]GB RAM."

---

## Quick Recall

| Question | Answer |
|---|---|
| Short polling problem? | 95% empty responses, massive bandwidth waste |
| Long polling vs WebSocket? | LP reconnects per message. WS stays connected. |
| SSE vs WebSocket? | SSE = server-push only, auto-reconnect. WS = bidirectional. |
| WebSocket frame overhead? | 2-14 bytes (vs ~800 bytes HTTP) |
| Scaling challenge? | Stateful — need sticky sessions + pub/sub backbone |
| Reconnection storm fix? | Exponential backoff + jitter |
| Heartbeat purpose? | Keep alive (firewalls kill idle at 60-120s) |
| Memory per connection? | ~40KB. 1M connections = ~40GB. |
| ChatGPT streaming? | SSE — server-push, text, HTTP-friendly |
| Discord's secret? | Elixir — 2KB per process vs 1MB per thread |
