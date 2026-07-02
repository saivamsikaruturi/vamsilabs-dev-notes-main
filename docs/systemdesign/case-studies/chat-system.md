---
title: "Chat System (WhatsApp / Slack Scale) — System Design Interview (2026)"
description: "Design a chat system like WhatsApp — system design covering WebSocket connections, message delivery, read receipts, group chat, and scaling to billions of users."
---

# Chat System (WhatsApp / Slack Scale)

!!! danger "Real Incident: WhatsApp Outage, October 4, 2021 (6 hours)"
    A routine BGP maintenance change at Facebook's backbone routers withdrew all routes to Facebook's data centers from the global routing table. Within seconds, every WhatsApp client on Earth lost its WebSocket connection. 2 billion users went offline simultaneously. DNS resolution failed because Facebook's authoritative nameservers were inside the same unreachable network. The outage lasted **6 hours and 7 minutes** — the longest in WhatsApp's history.

    But the truly interesting engineering challenge came *after* the fix. When BGP routes were restored, **2 billion clients attempted to reconnect simultaneously** — a classic thundering herd problem. WhatsApp's gateway fleet faced a surge 200x normal connection rate. Here is why their architecture survived the recovery:

    1. **Decoupled persistence from delivery** — messages sent during the outage were queued in Kafka and persisted to Cassandra. No messages were lost.
    2. **Exponential backoff with jitter** — clients used randomized retry intervals (base 1s, max 5 min, +/- 20% jitter) to spread reconnection over minutes rather than milliseconds.
    3. **Cursor-based sync** — reconnected clients pulled missed messages using a `last_seen_message_id` cursor, paginated in batches of 50, preventing any single client from overwhelming the storage tier.
    4. **Connection admission control** — gateways throttled new connections at 80% capacity, returning HTTP 503 with `Retry-After` headers to shed load gracefully.

    **Lesson: Design for the recovery stampede, not just steady state. Your system's most dangerous moment is the 60 seconds after it comes back online.**

---

## System Design Concepts Used

`WebSocket` `Long Polling (fallback)` `Pub/Sub` `Consistent Hashing` `Snowflake IDs` `Write-Ahead Log` `Fan-out (write vs. read)` `Heartbeat / Gossip Protocol` `End-to-End Encryption (Signal Protocol)` `Cursor-based Pagination` `Exponential Backoff with Jitter` `Partitioned Storage` `LSM-tree (Cassandra)` `Connection Multiplexing` `Push Notification Gateway` `Rate Limiting` `Circuit Breaker` `Message Queuing (Kafka)` `Sharded Redis Cluster` `Consistent Hashing Ring` `Object Storage (S3/CDN)` `Idempotency Keys`

---

## Functional Requirements

1. **One-to-one messaging** — Users can send text messages to any other user with delivery guarantees (at-least-once, deduplicated at client).
2. **Group chat** — Support groups up to 1,024 members with all members receiving messages in consistent order.
3. **Online presence and typing indicators** — Show real-time online/offline/last-seen status and "typing..." indicators per conversation.
4. **Read receipts** — Single-tick (sent), double-tick (delivered), blue-tick (read) semantics, propagated to sender.
5. **Media messages** — Support images (up to 16MB), voice notes (up to 100MB), videos (up to 2GB), and documents with thumbnail previews.
6. **Offline message sync** — When a user comes back online, deliver all missed messages in order without duplicates.
7. **End-to-end encryption** — Messages must be unreadable by the server. Key exchange via Signal Protocol (X3DH + Double Ratchet).
8. **Message search** — Full-text search across a user's message history (client-side index for E2E encrypted messages).
9. **Multi-device sync** — A user logged in on phone and desktop receives messages on both devices simultaneously.
10. **Message reactions and replies** — Users can react with emoji or reply to a specific message with threading context.

---

## Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Message delivery latency** | < 200ms (P99 for online recipients) | Users perceive chat as "instant" below 300ms; 200ms gives headroom for network jitter |
| **Availability** | 99.99% (52 min downtime/year) | Chat is a primary communication channel; even minutes of downtime affect billions |
| **Concurrent connections** | 170M simultaneous WebSockets | Peak concurrency = ~34% of 500M DAU (measured from WhatsApp public stats) |
| **Message ordering** | Per-conversation total order | Users must see messages in same sequence; global order is impossible and unnecessary |
| **Durability** | Zero message loss once acknowledged | Messages are users' memories — losing even one is unacceptable |
| **Throughput** | 580K messages/sec sustained, 2.9M peak | 50B messages/day with 5x peak-to-average ratio |
| **Storage retention** | 30 days server-side (encrypted) | Balance between sync needs and storage costs; clients hold full history |
| **Horizontal scalability** | Linear scale-out to 10x current load | Must handle growth and events (New Year midnight, elections) without re-architecture |

---

## Capacity Estimation

```text
===============================================
CHAT SYSTEM — NAPKIN MATH (WhatsApp Scale)
===============================================

GIVEN:
  DAU                    = 500,000,000 users
  Messages per user/day  = 100 (avg)
  Total messages/day     = 500M × 100 = 50,000,000,000 (50B)
  Avg message size       = 200 bytes (encrypted text + metadata)
  Media messages         = 5% of total
  Avg media size         = 500 KB
  Peak-to-average ratio  = 5x

───────────────────────────────────────────────
THROUGHPUT
───────────────────────────────────────────────
  Avg messages/sec       = 50B ÷ 86,400 = ~580,000 msg/sec
  Peak messages/sec      = 580K × 5     = ~2,900,000 msg/sec
  
  Avg media uploads/sec  = 50B × 0.05 ÷ 86,400 = ~29,000 uploads/sec

───────────────────────────────────────────────
CONNECTIONS
───────────────────────────────────────────────
  Concurrent connections = 500M × 0.34           = 170,000,000
  Connections per server = 100,000 (epoll limit with 32GB RAM)
  Gateway servers needed = 170M ÷ 100K           = 1,700 servers
  
  RAM per connection     = ~10 KB (buffer + session state)
  RAM per gateway        = 100K × 10 KB          = 1 GB (connection state only)

───────────────────────────────────────────────
STORAGE (TEXT MESSAGES)
───────────────────────────────────────────────
  Daily text storage     = 50B × 200 bytes       = 10 TB/day
  30-day retention       = 10 TB × 30            = 300 TB
  Annual (if retained)   = 10 TB × 365           = 3.6 PB/year
  
  Cassandra replication  = 3x
  Actual disk needed     = 300 TB × 3            = 900 TB (30-day window)
  Cassandra nodes (4TB)  = 900 TB ÷ 4 TB        = 225 nodes

───────────────────────────────────────────────
STORAGE (MEDIA)
───────────────────────────────────────────────
  Daily media storage    = 50B × 0.05 × 500 KB   = 1.25 PB/day
  30-day media           = 1.25 PB × 30          = 37.5 PB
  (Stored in S3 with CDN, not Cassandra)

───────────────────────────────────────────────
BANDWIDTH
───────────────────────────────────────────────
  Text bandwidth (avg)   = 580K × 200 B          = 116 MB/sec = ~1 Gbps
  Media bandwidth (avg)  = 29K × 500 KB          = 14.5 GB/sec = ~116 Gbps
  Total egress (peak)    = (1 + 116) × 5         = ~585 Gbps

───────────────────────────────────────────────
REDIS PUB/SUB (ROUTING LAYER)
───────────────────────────────────────────────
  Messages routed/sec    = 580K (each needs pub/sub lookup)
  Redis shards needed    = 580K ÷ 100K ops/shard = 6 shards (min)
  With headroom (3x)     = 18 Redis shards

───────────────────────────────────────────────
KAFKA (PERSISTENCE PIPELINE)
───────────────────────────────────────────────
  Partitions needed      = Peak msg/sec ÷ 10K per partition
                         = 2.9M ÷ 10K = 290 partitions
  Brokers (20 part/each) = 290 ÷ 20 = ~15 brokers (min)
  With replication (3x)  = 45 Kafka brokers
```

---

## "Why X, Not Y?" Tradeoff Analysis

### Why WebSocket, Not HTTP Long Polling or Server-Sent Events?

| Criterion | WebSocket | HTTP Long Polling | Server-Sent Events (SSE) |
|---|---|---|---|
| **Direction** | Full-duplex (bidirectional) | Simulated bidirectional (new request per message) | Server-to-client only |
| **Overhead per message** | 2-6 bytes framing | ~800 bytes (full HTTP headers each time) | ~50 bytes (event stream format) |
| **Latency** | Sub-millisecond (connection already open) | 50-200ms (TCP + TLS handshake per request) | Sub-ms receive, but needs separate channel for sends |
| **Connection count at 170M users** | 170M persistent sockets | 170M × 2 (send + receive) = 340M connections | 170M SSE + 170M HTTP POST = 340M |
| **Mobile battery impact** | Low (single persistent connection) | High (constant reconnection) | Medium (still needs POST for sends) |

**Decision: WebSocket with long-polling fallback.**

The math is decisive: at 580K messages/sec, HTTP long polling would require 580K × 800 bytes = 464 MB/sec of pure header overhead vs. 580K × 6 bytes = 3.5 MB/sec with WebSocket. That is a 130x bandwidth reduction. For mobile users on metered connections, this translates directly to data charges and battery life.

Long polling remains as a fallback for restrictive corporate proxies that terminate WebSocket upgrades. Approximately 2-3% of connections fall back to this path.

---

### Why Cassandra, Not PostgreSQL for Message Storage?

| Criterion | Cassandra | PostgreSQL |
|---|---|---|
| **Write throughput** | 580K writes/sec across cluster (linear scale) | ~50K writes/sec per node (vertical limit) |
| **Scale-out model** | Add nodes, automatic rebalancing via consistent hashing | Complex sharding (Citus), manual shard management |
| **Partition model** | Native partition by `conversation_id`, sorted by `message_id` | Requires explicit table partitioning, harder to range-scan |
| **Availability model** | AP system (tunable consistency: QUORUM for writes) | CP system (single-leader, failover = downtime) |
| **Storage engine** | LSM-tree (optimized for sequential writes) | B-tree (optimized for random reads) |
| **Multi-datacenter** | Built-in multi-DC replication, conflict-free | Logical replication, complex conflict resolution |

**Decision: Cassandra with `LOCAL_QUORUM` consistency.**

Chat message storage is a write-heavy, time-series workload. At 580K msg/sec sustained, PostgreSQL would need 12+ shards with complex routing logic. Cassandra handles this natively: `conversation_id` as partition key gives us all messages for a conversation on the same node, sorted by `message_id` (Snowflake timestamp). Range queries like "give me the next 50 messages after cursor X" are a single sequential disk read.

The tradeoff: we lose ad-hoc SQL queries and transactions. But chat messages are immutable once written (append-only), so we never need UPDATE or multi-row transactions. The one case where we need atomic read-modify-write (message status: sent -> delivered -> read) is handled via Cassandra's lightweight transactions (Paxos) on the status field only.

---

### Why Redis Pub/Sub, Not Kafka for Cross-Gateway Message Routing?

| Criterion | Redis Pub/Sub | Kafka |
|---|---|---|
| **Latency** | < 1ms (in-memory, no disk) | 2-10ms (disk write, batch flush) |
| **Delivery semantics** | Fire-and-forget (at-most-once) | At-least-once with consumer offsets |
| **Connection model** | Gateway subscribes to user channels | Gateway polls topic partitions |
| **Message retention** | None (if subscriber is offline, message is lost) | Configurable retention (hours/days) |
| **Throughput** | ~100K msg/sec per shard | ~100K msg/sec per partition |
| **Operational complexity** | Simple (no ZooKeeper, no offsets) | Complex (partition rebalancing, consumer groups) |

**Decision: Redis Pub/Sub for real-time routing, Kafka for durable persistence pipeline.**

This is a two-tier architecture. Redis Pub/Sub is the "hot path" — when User A sends a message to User B who is currently online, we need sub-millisecond routing from Gateway-1 to Gateway-2. Redis delivers this because it is purely in-memory with no disk I/O.

But Redis Pub/Sub is lossy: if a gateway crashes mid-delivery, the message vanishes from the pub/sub channel. This is acceptable because Kafka is the "cold path" — every message is also written to Kafka (partitioned by `conversation_id`) for durable persistence to Cassandra. If Redis fails to deliver, the recipient pulls missed messages from Cassandra on their next sync.

This separation gives us: sub-millisecond delivery for the happy path (Redis) + zero message loss guarantee (Kafka + Cassandra).

---

### Why Partition by conversation_id, Not user_id?

| Criterion | Partition by `conversation_id` | Partition by `user_id` (recipient inbox) |
|---|---|---|
| **Write amplification** | 1 write per message (single partition) | N writes per group message (one per member) |
| **Read pattern: "Load conversation"** | Single partition scan (fast) | Scatter-gather across sender partitions (slow) |
| **Read pattern: "Load all conversations"** | Requires secondary index or separate inbox table | Single partition scan (fast) |
| **Group messages** | 1 write regardless of group size | 1,024 writes for a 1,024-member group |
| **Hot partition risk** | Celebrity conversations (millions of fans) | Celebrity user partitions |
| **Ordering guarantee** | Natural: all messages in same partition, sorted by time | Requires cross-partition coordination |

**Decision: Primary partition by `conversation_id` with a lightweight inbox index.**

The key insight is that the dominant read pattern in chat is "open a conversation and scroll through messages" — this is a range scan within a single partition. Partitioning by `user_id` would make this a scatter-gather across potentially thousands of partitions (one per conversation the user is in).

The tradeoff: listing all conversations for a user requires a separate lightweight index table (`user_conversations`) that maps `user_id -> [conversation_id, last_message_preview, unread_count]`. This table is small (one row per conversation, not per message) and handles the "conversation list" screen efficiently.

For group messages, this decision saves massive write amplification: a message to a 1,024-member group is 1 write (to the conversation partition) instead of 1,024 writes (to each member's inbox).

---

## High-Level Architecture

<div class="arch-diagram" style="background: #FAFBFE; border: 2px solid #E2E8F0; border-radius: 14px; padding: 20px; margin: 24px 0; overflow-x: auto; text-align: center;">
<svg viewBox="0 0 1100 750" xmlns="http://www.w3.org/2000/svg" font-family="Inter,system-ui,sans-serif">
  <defs>
    <marker id="a" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#546E7A"/>
    </marker>
    <marker id="ar" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#D32F2F"/>
    </marker>
    <marker id="ag" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#2E7D32"/>
    </marker>
    <filter id="sh"><feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.08"/></filter>
  </defs>

  <!-- Background -->
  <rect width="1100" height="750" fill="#FAFAFA" rx="8"/>

  <!-- Title -->
  <text x="550" y="30" text-anchor="middle" font-size="16" font-weight="800" fill="#212121">Chat System — High-Level Architecture</text>
  <text x="550" y="50" text-anchor="middle" font-size="11" fill="#757575">500M DAU | 170M WebSockets | 580K msg/sec | &lt; 200ms P99 delivery | E2E encrypted</text>

  <!-- ═══════════ CLIENTS LAYER ═══════════ -->
  <rect x="30" y="65" width="1040" height="85" rx="8" fill="none" stroke="#1976D2" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="50" y="82" font-size="10" font-weight="700" fill="#1976D2">CLIENTS</text>

  <rect x="60" y="92" width="120" height="48" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="120" y="113" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Mobile App</text>
  <text x="120" y="128" text-anchor="middle" font-size="8" fill="#546E7A">iOS / Android</text>

  <rect x="210" y="92" width="120" height="48" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="270" y="113" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Web Client</text>
  <text x="270" y="128" text-anchor="middle" font-size="8" fill="#546E7A">React SPA</text>

  <rect x="360" y="92" width="120" height="48" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="420" y="113" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Desktop</text>
  <text x="420" y="128" text-anchor="middle" font-size="8" fill="#546E7A">Electron</text>

  <rect x="900" y="92" width="150" height="48" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="975" y="113" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">User B (Recipient)</text>
  <text x="975" y="128" text-anchor="middle" font-size="8" fill="#546E7A">Any platform</text>

  <!-- ═══════════ GATEWAY LAYER ═══════════ -->
  <rect x="30" y="165" width="1040" height="105" rx="8" fill="none" stroke="#388E3C" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="50" y="182" font-size="10" font-weight="700" fill="#388E3C">GATEWAY LAYER (1,700 servers)</text>

  <!-- Load Balancer -->
  <rect x="350" y="185" width="180" height="35" rx="6" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5" filter="url(#sh)"/>
  <text x="440" y="207" text-anchor="middle" font-size="11" font-weight="600" fill="#F57F17">L4 Load Balancer</text>

  <!-- Gateways -->
  <rect x="80" y="228" width="160" height="35" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="160" y="250" text-anchor="middle" font-size="10" font-weight="600" fill="#1B5E20">WS Gateway 1 (100K conn)</text>

  <rect x="280" y="228" width="160" height="35" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="360" y="250" text-anchor="middle" font-size="10" font-weight="600" fill="#1B5E20">WS Gateway 2 (100K conn)</text>

  <rect x="480" y="228" width="160" height="35" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="560" y="250" text-anchor="middle" font-size="10" font-weight="600" fill="#1B5E20">WS Gateway 3 (100K conn)</text>

  <rect x="690" y="228" width="80" height="35" rx="6" fill="#E0E0E0" stroke="#9E9E9E" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="730" y="250" text-anchor="middle" font-size="10" fill="#757575">... N</text>

  <rect x="820" y="228" width="160" height="35" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="900" y="250" text-anchor="middle" font-size="10" font-weight="600" fill="#1B5E20">WS Gateway 1700</text>

  <!-- Arrows: clients to LB -->
  <line x1="200" y1="140" x2="380" y2="185" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <line x1="975" y1="140" x2="500" y2="185" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- Arrows: LB to gateways -->
  <line x1="400" y1="220" x2="200" y2="228" stroke="#546E7A" stroke-width="1" marker-end="url(#a)"/>
  <line x1="440" y1="220" x2="360" y2="228" stroke="#546E7A" stroke-width="1" marker-end="url(#a)"/>
  <line x1="470" y1="220" x2="540" y2="228" stroke="#546E7A" stroke-width="1" marker-end="url(#a)"/>
  <line x1="500" y1="220" x2="880" y2="228" stroke="#546E7A" stroke-width="1" marker-end="url(#a)"/>

  <!-- ═══════════ APPLICATION LAYER ═══════════ -->
  <rect x="30" y="280" width="1040" height="200" rx="8" fill="none" stroke="#512DA8" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="50" y="297" font-size="10" font-weight="700" fill="#512DA8">APPLICATION LAYER</text>

  <!-- Redis Pub/Sub -->
  <rect x="280" y="305" width="240" height="45" rx="6" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="400" y="324" text-anchor="middle" font-size="11" font-weight="700" fill="#B71C1C">Redis Pub/Sub Cluster</text>
  <text x="400" y="340" text-anchor="middle" font-size="8" fill="#757575">18 shards | Cross-gateway routing | &lt; 1ms</text>

  <!-- Session Store -->
  <rect x="560" y="305" width="180" height="45" rx="6" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="650" y="324" text-anchor="middle" font-size="11" font-weight="700" fill="#B71C1C">Session Store (Redis)</text>
  <text x="650" y="340" text-anchor="middle" font-size="8" fill="#757575">user_id -> gateway_id mapping</text>

  <!-- Message Service -->
  <rect x="60" y="370" width="200" height="50" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="160" y="390" text-anchor="middle" font-size="11" font-weight="600" fill="#311B92">Message Service</text>
  <text x="160" y="406" text-anchor="middle" font-size="8" fill="#757575">Validate | ID gen | Route | Persist</text>

  <!-- Presence Service -->
  <rect x="290" y="370" width="180" height="50" rx="6" fill="#B2DFDB" stroke="#00695C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="380" y="390" text-anchor="middle" font-size="11" font-weight="600" fill="#004D40">Presence Service</text>
  <text x="380" y="406" text-anchor="middle" font-size="8" fill="#757575">Heartbeat 30s | Gossip protocol</text>

  <!-- Group Service -->
  <rect x="500" y="370" width="180" height="50" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="590" y="390" text-anchor="middle" font-size="11" font-weight="600" fill="#311B92">Group Service</text>
  <text x="590" y="406" text-anchor="middle" font-size="8" fill="#757575">Fan-out | Membership | Hybrid push/pull</text>

  <!-- Push Notification -->
  <rect x="710" y="370" width="180" height="50" rx="6" fill="#FFE0B2" stroke="#F57C00" stroke-width="1.5" filter="url(#sh)"/>
  <text x="800" y="390" text-anchor="middle" font-size="11" font-weight="600" fill="#E65100">Push Notification</text>
  <text x="800" y="406" text-anchor="middle" font-size="8" fill="#757575">APNs / FCM / offline delivery</text>

  <!-- Kafka -->
  <rect x="120" y="440" width="260" height="30" rx="6" fill="#37474F" stroke="#263238" stroke-width="1.5" filter="url(#sh)"/>
  <text x="250" y="460" text-anchor="middle" font-size="10" font-weight="600" fill="#ECEFF1">Kafka (290 partitions, keyed by conversation_id)</text>

  <!-- Arrows: Gateway to Redis Pub/Sub -->
  <line x1="160" y1="263" x2="300" y2="305" stroke="#D32F2F" stroke-width="1.3" marker-end="url(#ar)"/>
  <line x1="900" y1="263" x2="500" y2="305" stroke="#D32F2F" stroke-width="1.3" marker-end="url(#ar)"/>

  <!-- Arrows: Gateway to Message Service -->
  <line x1="160" y1="263" x2="160" y2="370" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- Arrows: Message Service to Kafka -->
  <line x1="180" y1="420" x2="200" y2="440" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- ═══════════ DATA LAYER ═══════════ -->
  <rect x="30" y="490" width="1040" height="140" rx="8" fill="none" stroke="#283593" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="50" y="507" font-size="10" font-weight="700" fill="#283593">DATA LAYER</text>

  <!-- Cassandra -->
  <path d="M70,535 L70,580 C70,595 250,595 250,580 L250,535" fill="#E8EAF6" stroke="#283593" stroke-width="1.5" filter="url(#sh)"/>
  <ellipse cx="160" cy="535" rx="90" ry="12" fill="#C5CAE9" stroke="#283593" stroke-width="1.5"/>
  <text x="160" y="558" text-anchor="middle" font-size="10" font-weight="600" fill="#1A237E">Cassandra</text>
  <text x="160" y="572" text-anchor="middle" font-size="8" fill="#757575">Messages (225 nodes, RF=3)</text>

  <!-- User DB -->
  <path d="M290,535 L290,580 C290,595 440,595 440,580 L440,535" fill="#E8EAF6" stroke="#283593" stroke-width="1.5" filter="url(#sh)"/>
  <ellipse cx="365" cy="535" rx="75" ry="12" fill="#C5CAE9" stroke="#283593" stroke-width="1.5"/>
  <text x="365" y="558" text-anchor="middle" font-size="10" font-weight="600" fill="#1A237E">PostgreSQL</text>
  <text x="365" y="572" text-anchor="middle" font-size="8" fill="#757575">Users, Groups, Contacts</text>

  <!-- Object Storage -->
  <rect x="480" y="525" width="180" height="55" rx="6" fill="#E8EAF6" stroke="#283593" stroke-width="1.5" filter="url(#sh)"/>
  <text x="570" y="548" text-anchor="middle" font-size="10" font-weight="600" fill="#1A237E">S3 / Object Store</text>
  <text x="570" y="564" text-anchor="middle" font-size="8" fill="#757575">Media files + CDN</text>

  <!-- Search Index -->
  <rect x="700" y="525" width="160" height="55" rx="6" fill="#E8EAF6" stroke="#283593" stroke-width="1.5" filter="url(#sh)"/>
  <text x="780" y="548" text-anchor="middle" font-size="10" font-weight="600" fill="#1A237E">Elasticsearch</text>
  <text x="780" y="564" text-anchor="middle" font-size="8" fill="#757575">Message search index</text>

  <!-- Metrics/Monitoring -->
  <rect x="900" y="525" width="150" height="55" rx="6" fill="#E8EAF6" stroke="#283593" stroke-width="1.5" filter="url(#sh)"/>
  <text x="975" y="548" text-anchor="middle" font-size="10" font-weight="600" fill="#1A237E">Prometheus</text>
  <text x="975" y="564" text-anchor="middle" font-size="8" fill="#757575">Metrics + Alerting</text>

  <!-- Arrows: Kafka to Cassandra -->
  <line x1="200" y1="470" x2="160" y2="523" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- Arrow: Message Service to Push -->
  <line x1="260" y1="395" x2="710" y2="395" stroke="#F57C00" stroke-width="1" stroke-dasharray="4,2" marker-end="url(#a)"/>

  <!-- ═══════════ LEGEND ═══════════ -->
  <rect x="30" y="645" width="1040" height="90" rx="8" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="550" y="665" text-anchor="middle" font-size="11" font-weight="700" fill="#424242">LEGEND</text>

  <rect x="80" y="680" width="20" height="14" rx="3" fill="#BBDEFB" stroke="#1976D2" stroke-width="1"/>
  <text x="106" y="691" font-size="9" fill="#424242">Client</text>

  <rect x="165" y="680" width="20" height="14" rx="3" fill="#FFF9C4" stroke="#F9A825" stroke-width="1"/>
  <text x="191" y="691" font-size="9" fill="#424242">Load Balancer</text>

  <rect x="285" y="680" width="20" height="14" rx="3" fill="#C8E6C9" stroke="#388E3C" stroke-width="1"/>
  <text x="311" y="691" font-size="9" fill="#424242">WS Gateway</text>

  <rect x="395" y="680" width="20" height="14" rx="3" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1"/>
  <text x="421" y="691" font-size="9" fill="#424242">Cache / Pub/Sub</text>

  <rect x="520" y="680" width="20" height="14" rx="3" fill="#D1C4E9" stroke="#512DA8" stroke-width="1"/>
  <text x="546" y="691" font-size="9" fill="#424242">Application Service</text>

  <rect x="670" y="680" width="20" height="14" rx="3" fill="#37474F" stroke="#263238" stroke-width="1"/>
  <text x="696" y="691" font-size="9" fill="#424242">Message Queue</text>

  <rect x="790" y="680" width="20" height="14" rx="3" fill="#E8EAF6" stroke="#283593" stroke-width="1"/>
  <text x="816" y="691" font-size="9" fill="#424242">Database / Storage</text>

  <rect x="930" y="680" width="20" height="14" rx="3" fill="#FFE0B2" stroke="#F57C00" stroke-width="1"/>
  <text x="956" y="691" font-size="9" fill="#424242">Push Service</text>

  <!-- Flow annotations -->
  <line x1="80" y1="715" x2="130" y2="715" stroke="#546E7A" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="136" y="719" font-size="9" fill="#424242">Data flow</text>

  <line x1="220" y1="715" x2="270" y2="715" stroke="#D32F2F" stroke-width="1.5" marker-end="url(#ar)"/>
  <text x="276" y="719" font-size="9" fill="#424242">Pub/Sub channel</text>

  <line x1="400" y1="715" x2="450" y2="715" stroke="#F57C00" stroke-width="1.5" stroke-dasharray="4,2" marker-end="url(#a)"/>
  <text x="456" y="719" font-size="9" fill="#424242">Async / offline path</text>
</svg>
</div>

---

## Backend Services Explained

### WebSocket Gateway Service

The gateway is the edge of the system — it maintains persistent WebSocket connections with every online client. Each gateway server handles approximately 100,000 concurrent connections using Linux `epoll` for event-driven I/O. The gateway is intentionally "dumb": it does not process business logic. Its responsibilities are: (1) authenticate the WebSocket handshake via JWT, (2) register the connection in the session store (`user_id -> gateway_id`), (3) forward incoming messages to the Message Service, and (4) push outbound messages to the client's socket. This separation means we can scale gateways independently of application logic, and a gateway crash only requires clients to reconnect (no state is lost server-side).

### Message Service

The Message Service is the brain of the system. When it receives a message from a gateway, it performs: (1) validation (message size, rate limiting, spam detection), (2) Snowflake ID generation for global ordering, (3) encryption verification (ensuring the payload is E2E encrypted), (4) session store lookup to determine where the recipient is connected, (5) publishing to Redis Pub/Sub for real-time delivery, and (6) writing to Kafka for durable persistence. The service is stateless and horizontally scalable behind an internal load balancer.

### Presence Service

Presence answers the question "is this user online?" at scale. Every connected client sends a heartbeat every 30 seconds. The Presence Service maintains an in-memory map of `user_id -> {status, last_seen, gateway_id}`. For efficiency, it uses a gossip protocol between instances to propagate state changes without a central coordinator. A user is marked "offline" if no heartbeat is received for 90 seconds (3 missed heartbeats). Typing indicators flow through the same service but are ephemeral — they are never persisted and only forwarded to the other participant(s) in the conversation.

### Group Service

The Group Service manages group membership and implements the fan-out strategy. For small groups (2-100 members), it uses write fan-out: the message is routed individually to each member's gateway via Redis Pub/Sub. For large groups (101-1,024 members), it uses read fan-out: the message is written once to the group conversation partition in Cassandra, and members pull it on their next sync. The service maintains a membership cache in Redis to avoid hitting PostgreSQL on every group message.

### Push Notification Service

When the session store indicates a recipient is offline (no active WebSocket), the Push Notification Service takes over. It formats platform-specific payloads (APNs for iOS, FCM for Android, Web Push for browsers) and delivers them with exponential backoff. It respects user notification preferences (mute, DND schedules) and implements priority levels (high for direct messages, normal for group messages). To avoid notification storms, it batches multiple messages into a single notification with a count badge after a 2-second debounce window.

### Session Store (Redis)

A dedicated Redis cluster that maps `user_id -> [gateway_id, connection_id, device_type, connected_at]`. This is the routing table for the entire system. When a message arrives for a user, the Message Service queries this store to determine which gateway holds the recipient's connection. For multi-device users, there are multiple entries per `user_id`, and the message is delivered to all active sessions.

---

## Architecture Flow

### Scenario: Alice in Tokyo sends "Hey, want to grab dinner?" to Bob in NYC

```text
T+0ms    Alice types message, client encrypts with Bob's public key (Signal Protocol)
         Client generates client-side message ID (UUID) for idempotency

T+1ms    Encrypted payload sent over Alice's WebSocket to Gateway-47 (Tokyo DC)
         Frame: [opcode=0x1, payload={"to":"bob_123", "conv":"conv_abc", "body":"<encrypted>", "client_id":"uuid-xyz"}]

T+2ms    Gateway-47 authenticates frame (JWT session valid)
         Forwards to Message Service via gRPC

T+5ms    Message Service:
         ├─ Validates: message < 64KB, Alice not rate-limited (100 msg/min)
         ├─ Generates Snowflake ID: timestamp(41bit) + datacenter(5bit) + machine(5bit) + sequence(12bit)
         ├─ Deduplication check: client_id "uuid-xyz" not in recent 5-min cache
         └─ Publishes to Kafka topic "messages" partition = hash(conv_abc) % 290

T+7ms    Message Service queries Session Store:
         GET user:bob_123 → {"gateway": "gateway-1201", "dc": "us-east-1"}

T+8ms    Message Service publishes to Redis Pub/Sub:
         PUBLISH channel:gateway-1201 {"msg_id":"sf-123", "to":"bob_123", "body":"<encrypted>"}

T+9ms    Redis routes to Gateway-1201 (NYC DC) subscriber
         Gateway-1201 finds Bob's WebSocket in its local connection map

T+10ms   Gateway-1201 pushes message frame to Bob's WebSocket
         Bob's client decrypts with private key, renders in UI

T+11ms   Bob's client sends delivery ACK back through WebSocket
         ACK propagates: Gateway-1201 → Message Service → status update

T+15ms   Message Service publishes delivery receipt to Alice via same Redis path
         Alice sees double-tick (✓✓ delivered)

T+200ms  Kafka consumer persists message to Cassandra (async, non-blocking)
         INSERT INTO messages (conversation_id, message_id, sender, body, status)
         VALUES ('conv_abc', 'sf-123', 'alice_456', '<encrypted>', 'delivered')
```

**Total end-to-end latency: ~10ms** (both users online, cross-continent)

---

### Scenario: Alice sends a message but Bob is OFFLINE

```text
T+0ms    Same flow as above through T+7ms

T+7ms    Message Service queries Session Store:
         GET user:bob_123 → NULL (no active connection)

T+8ms    Message Service marks message status as "sent" (single tick ✓)
         Sends ACK to Alice: "message accepted, recipient offline"

T+9ms    Message Service enqueues push notification request:
         → Push Service: {to: "bob_123", title: "Alice", body: "New message", badge: 3}

T+12ms   Push Service queries Bob's device tokens from PostgreSQL
         Sends APNs payload to Bob's iPhone

T+200ms  Kafka consumer persists message to Cassandra with status="sent"

... 2 hours later ...

T+2h     Bob opens app, WebSocket connects to Gateway-892
         Gateway-892 registers: SET user:bob_123 → {"gateway": "gateway-892"}

T+2h+1ms Bob's client sends sync request:
         {"action": "sync", "last_seen_msg_id": "sf-100"}

T+2h+3ms Message Service queries Cassandra:
         SELECT * FROM messages WHERE conversation_id IN (bob's conversations)
         AND message_id > 'sf-100' LIMIT 50

T+2h+8ms Returns batch of missed messages (paginated)
         Bob's client decrypts and renders all missed messages
         Sends delivery ACKs for each → Alice sees ✓✓ for all
```

---

### Scenario: Group message fan-out (50-member group)

```text
T+0ms    Alice sends message to group "Weekend Hiking" (50 members)
         Encrypted with group shared key (sender keys protocol)

T+5ms    Message Service receives, generates Snowflake ID
         Queries Group Service: GET group:hiking_789 → [50 member user_ids]

T+6ms    Group Service determines: 50 members → WRITE FAN-OUT strategy

T+7ms    Session Store batch query: MGET user:m1, user:m2, ... user:m50
         Result: 32 online (on various gateways), 18 offline

T+8ms    Redis Pub/Sub fan-out to online members:
         ├─ PUBLISH channel:gateway-47  (Alice + 5 others on this gateway)
         ├─ PUBLISH channel:gateway-201 (8 members)
         ├─ PUBLISH channel:gateway-892 (7 members)
         ├─ PUBLISH channel:gateway-1201 (6 members)
         └─ PUBLISH channel:gateway-550  (6 members)

T+10ms   All 32 online members receive message via WebSocket

T+12ms   Push Service: batch notification to 18 offline members
         Grouped by platform: 11 APNs, 7 FCM

T+200ms  Single write to Cassandra (conversation partition for hiking_789)
         NOT 50 writes — message stored once, all members read from same partition
```

---

## Failure & Recovery Scenarios

### Scenario 1: WebSocket Gateway Dies (Gateway-47 crashes)

**Impact:** 100,000 users on Gateway-47 lose their WebSocket connections immediately.

**Detection:** The L4 load balancer detects failed health checks within 5 seconds. The Session Store entries for those users have a TTL of 60 seconds and will auto-expire.

**Recovery:**

1. Clients detect connection drop (TCP RST or timeout) within 1-3 seconds.
2. Clients initiate reconnection with exponential backoff: 1s, 2s, 4s, 8s (+ 20% jitter).
3. Load balancer routes reconnections to healthy gateways (Gateway-48, 49, etc.).
4. New gateway registers fresh session in Redis Session Store.
5. Client sends sync request with `last_seen_msg_id` to pull any messages missed during the 5-10 second reconnection window.
6. Messages sent TO these users during the gap were published to Redis Pub/Sub for the dead gateway — they were lost from the real-time path. But Kafka persisted them, so the sync request retrieves them from Cassandra.

**Key insight:** No messages are lost because the persistence path (Kafka -> Cassandra) is independent of the delivery path (Redis Pub/Sub -> Gateway). The real-time path is best-effort; the storage path is durable.

---

### Scenario 2: Redis Pub/Sub Shard Fails

**Impact:** Messages destined for gateways subscribed to the failed shard are not delivered in real-time. Users appear to not receive messages for 10-30 seconds.

**Detection:** Gateway health checks to Redis fail. Circuit breaker opens after 3 consecutive failures (500ms timeout each).

**Recovery:**

1. Circuit breaker opens — gateways stop publishing to the failed shard.
2. Fallback path activates: Message Service writes a "pending delivery" record to a separate Redis list (different shard) for each affected user.
3. Gateways poll the pending delivery list every 5 seconds as a fallback.
4. Once the Redis shard recovers (typically auto-failover via Redis Sentinel in 10-30s), subscriptions are re-established.
5. Any messages in the pending delivery list are drained.

**Why not Kafka for real-time routing?** Even during Redis failure, the added latency is only 5 seconds (polling interval) vs. Kafka's 2-10ms per message under normal conditions. The failure case is rare enough that the simpler architecture wins.

---

### Scenario 3: Cassandra Cluster Degradation (1 node down in 3-node replica set)

**Impact:** With `LOCAL_QUORUM` consistency (2 of 3 replicas must ACK), losing 1 node means writes still succeed (2 remaining nodes can form quorum). BUT if a second node in the same replica set fails, writes to those partitions fail.

**Detection:** Cassandra gossip protocol detects node failure within 10 seconds. Monitoring alerts fire.

**Recovery:**

1. Single node failure: **No user-visible impact.** Reads and writes continue at `LOCAL_QUORUM`.
2. Cassandra automatically streams data to replacement node (or the failed node when it recovers).
3. Kafka consumers that fail to write to Cassandra will retry with backoff. Kafka retention (72 hours) provides a buffer — no messages are lost even if Cassandra is fully down for hours.
4. If multiple nodes fail: Message Service detects write failures, activates "degraded mode" — messages are kept in Kafka and delivered in real-time via Redis Pub/Sub, but not persisted. A banner appears in client: "Messages may not be saved to history."

---

### Scenario 4: Full Datacenter Failure

**Impact:** All users connected to gateways in the failed DC lose connections. Cross-DC routing via Redis Pub/Sub is interrupted.

**Recovery:**

1. DNS failover (or Anycast BGP withdrawal) redirects clients to nearest healthy DC within 30-60 seconds.
2. Clients reconnect to gateways in the healthy DC.
3. Cassandra's multi-DC replication means message history is available from the other DC (assuming `EACH_QUORUM` was not used for writes).
4. Kafka MirrorMaker ensures unprocessed messages in the failed DC's Kafka are replicated to the surviving DC.

---

## Data Model

### Messages Table (Cassandra)

```sql
CREATE TABLE messages (
    conversation_id UUID,          -- Partition key
    message_id      BIGINT,        -- Clustering key (Snowflake ID, sorts by time)
    sender_id       BIGINT,
    message_type    TEXT,           -- 'text', 'image', 'video', 'audio', 'document'
    body            BLOB,          -- E2E encrypted payload
    media_url       TEXT,           -- S3 presigned URL (null for text)
    media_thumbnail BLOB,          -- Encrypted thumbnail (< 5KB)
    reply_to        BIGINT,        -- Snowflake ID of parent message (null if not reply)
    status          TEXT,           -- 'sent', 'delivered', 'read'
    created_at      TIMESTAMP,
    expires_at      TIMESTAMP,     -- For disappearing messages
    PRIMARY KEY (conversation_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC)
  AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_size': 1, 'compaction_window_unit': 'DAYS'}
  AND gc_grace_seconds = 864000
  AND default_time_to_live = 2592000;  -- 30 days server-side retention
```

### User Conversations Index (Cassandra)

```sql
CREATE TABLE user_conversations (
    user_id             BIGINT,        -- Partition key
    last_activity_at    TIMESTAMP,     -- Clustering key (most recent first)
    conversation_id     UUID,
    conversation_type   TEXT,          -- '1:1', 'group'
    conversation_name   TEXT,          -- Group name or other user's name
    last_message_preview TEXT,         -- Truncated, encrypted
    unread_count        INT,
    is_muted            BOOLEAN,
    PRIMARY KEY (user_id, last_activity_at)
) WITH CLUSTERING ORDER BY (last_activity_at DESC);
```

### Users Table (PostgreSQL)

```sql
CREATE TABLE users (
    user_id         BIGINT PRIMARY KEY,
    phone_number    VARCHAR(20) UNIQUE NOT NULL,
    display_name    VARCHAR(100),
    avatar_url      TEXT,
    public_key      BYTEA,           -- Signal Protocol identity key
    created_at      TIMESTAMP DEFAULT NOW(),
    last_seen_at    TIMESTAMP,
    status_text     VARCHAR(500)
);

CREATE INDEX idx_users_phone ON users(phone_number);
```

### Groups Table (PostgreSQL)

```sql
CREATE TABLE groups (
    group_id        UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(conversation_id),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    avatar_url      TEXT,
    created_by      BIGINT REFERENCES users(user_id),
    max_members     INT DEFAULT 1024,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_members (
    group_id    UUID REFERENCES groups(group_id),
    user_id     BIGINT REFERENCES users(user_id),
    role        VARCHAR(20) DEFAULT 'member',  -- 'admin', 'member'
    joined_at   TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members(user_id);
```

### Session Store (Redis)

```text
# Active session mapping
KEY:   session:user:{user_id}:{device_id}
VALUE: {"gateway_id": "gw-47", "connected_at": 1698234567, "device_type": "ios"}
TTL:   300 seconds (refreshed on every heartbeat)

# Presence
KEY:   presence:{user_id}
VALUE: {"status": "online", "last_seen": 1698234567}
TTL:   90 seconds (3 missed heartbeats = offline)

# Group membership cache
KEY:   group:members:{group_id}
VALUE: SET of user_ids
TTL:   3600 seconds (1 hour, invalidated on membership change)

# Message deduplication
KEY:   dedup:{client_message_id}
VALUE: server_message_id (Snowflake ID)
TTL:   300 seconds (5-minute dedup window)
```

---

## Algorithms Under the Hood

### Snowflake ID Generation (Message Ordering)

```python
class SnowflakeIDGenerator:
    """
    64-bit ID: [1 bit unused][41 bits timestamp][5 bits datacenter][5 bits machine][12 bits sequence]
    
    Properties:
    - Time-ordered: IDs generated later are always larger
    - Unique across all machines: datacenter + machine bits prevent collision
    - High throughput: 4096 IDs per millisecond per machine (12-bit sequence)
    - No coordination: each machine generates independently
    
    Why not UUID? UUIDs are 128 bits (wastes storage), not time-ordered (can't sort),
    and random (destroys Cassandra write locality in LSM-tree).
    """
    
    EPOCH = 1288834974657  # Custom epoch (Nov 04, 2010) to extend 41-bit range
    
    DATACENTER_BITS = 5   # 32 datacenters
    MACHINE_BITS = 5      # 32 machines per DC
    SEQUENCE_BITS = 12    # 4096 per ms per machine
    
    def __init__(self, datacenter_id: int, machine_id: int):
        self.datacenter_id = datacenter_id
        self.machine_id = machine_id
        self.sequence = 0
        self.last_timestamp = -1
    
    def next_id(self) -> int:
        timestamp = current_time_ms() - self.EPOCH
        
        if timestamp == self.last_timestamp:
            # Same millisecond: increment sequence
            self.sequence = (self.sequence + 1) & 0xFFF  # 4095 max
            if self.sequence == 0:
                # Sequence exhausted: wait for next millisecond
                timestamp = self._wait_next_ms(timestamp)
        else:
            self.sequence = 0  # New millisecond: reset sequence
        
        self.last_timestamp = timestamp
        
        # Bit-pack: timestamp(41) | datacenter(5) | machine(5) | sequence(12)
        return (
            (timestamp << 22) |
            (self.datacenter_id << 17) |
            (self.machine_id << 12) |
            self.sequence
        )
    
    def _wait_next_ms(self, current_ts: int) -> int:
        """Spin-wait until clock advances (handles clock skew)."""
        ts = current_time_ms() - self.EPOCH
        while ts <= current_ts:
            ts = current_time_ms() - self.EPOCH
        return ts
```

### WebSocket Connection Routing

```python
class ConnectionRouter:
    """
    Routes a message to the correct gateway holding the recipient's WebSocket.
    
    Architecture:
    - Session Store (Redis): user_id -> gateway_id mapping
    - Redis Pub/Sub: gateway subscribes to its own channel
    - Fallback: if real-time delivery fails, message persists in Cassandra for sync
    """
    
    def __init__(self, session_store: Redis, pubsub: Redis, push_service: PushService):
        self.session_store = session_store
        self.pubsub = pubsub
        self.push_service = push_service
    
    async def route_message(self, message: Message, recipient_id: str) -> DeliveryStatus:
        # Step 1: Find recipient's active sessions
        sessions = await self.session_store.smembers(f"session:user:{recipient_id}")
        
        if not sessions:
            # User is offline → push notification + persist for later sync
            await self.push_service.send_notification(
                user_id=recipient_id,
                title=message.sender_name,
                body="New message",
                data={"conversation_id": message.conversation_id}
            )
            return DeliveryStatus.SENT  # Single tick ✓
        
        # Step 2: Publish to each gateway holding a session (multi-device)
        delivered_count = 0
        for session in sessions:
            gateway_id = session["gateway_id"]
            try:
                await self.pubsub.publish(
                    channel=f"channel:{gateway_id}",
                    message=serialize(message, recipient_id, session["device_id"])
                )
                delivered_count += 1
            except RedisError:
                # Circuit breaker: gateway might be dead
                # Message will be picked up via Cassandra sync
                logger.warning(f"Failed to route to {gateway_id}")
        
        if delivered_count > 0:
            return DeliveryStatus.DELIVERED  # Double tick ✓✓
        else:
            # All gateways failed — treat as offline
            await self.push_service.send_notification(recipient_id, message)
            return DeliveryStatus.SENT
    
    async def handle_delivery_ack(self, message_id: str, user_id: str):
        """Called when client ACKs receipt. Updates status and notifies sender."""
        await self.session_store.set(
            f"delivered:{message_id}:{user_id}", "1", ex=86400
        )
        # Notify sender of delivery (double tick)
        sender_id = await self.get_sender(message_id)
        await self.route_message(
            DeliveryReceipt(message_id=message_id, status="delivered"),
            recipient_id=sender_id
        )
```

### Group Message Fan-out

```python
class GroupFanoutService:
    """
    Hybrid fan-out strategy:
    - Small groups (≤ 100): Write fan-out (push to each member individually)
    - Large groups (> 100): Read fan-out (write once, members pull on sync)
    
    Why hybrid?
    - 99% of groups have < 50 members → write fan-out gives instant delivery
    - 1% large groups would cause 1000+ Redis publishes per message → read fan-out avoids this
    - Threshold is tunable based on real-time delivery SLA vs. write amplification cost
    """
    
    FANOUT_THRESHOLD = 100  # Groups larger than this use read fan-out
    
    async def fan_out(self, message: Message, group_id: str) -> FanoutResult:
        # Step 1: Get group members (cached in Redis, TTL 1 hour)
        members = await self.get_group_members(group_id)
        group_size = len(members)
        
        if group_size <= self.FANOUT_THRESHOLD:
            return await self._write_fanout(message, members)
        else:
            return await self._read_fanout(message, group_id, members)
    
    async def _write_fanout(self, message: Message, members: List[str]) -> FanoutResult:
        """Push message individually to each member. O(N) publishes."""
        online_members = []
        offline_members = []
        
        # Batch lookup: which members are online?
        sessions = await self.session_store.mget(
            [f"session:user:{m}" for m in members]
        )
        
        for member_id, session in zip(members, sessions):
            if member_id == message.sender_id:
                continue  # Don't deliver to sender
            if session:
                online_members.append((member_id, session))
            else:
                offline_members.append(member_id)
        
        # Fan-out to online members via Redis Pub/Sub
        # Group by gateway to reduce publish calls
        gateway_groups = defaultdict(list)
        for member_id, session in online_members:
            gateway_groups[session["gateway_id"]].append(member_id)
        
        for gateway_id, recipient_ids in gateway_groups.items():
            # Single publish per gateway with list of recipients
            await self.pubsub.publish(
                channel=f"channel:{gateway_id}",
                message=serialize_group_message(message, recipient_ids)
            )
        
        # Batch push notifications for offline members
        if offline_members:
            await self.push_service.send_batch(
                user_ids=offline_members,
                title=f"{message.sender_name} in {message.group_name}",
                body="New message",
                collapse_key=f"group:{message.group_id}"  # Collapse multiple into one notification
            )
        
        return FanoutResult(
            online_delivered=len(online_members),
            push_sent=len(offline_members),
            strategy="write_fanout"
        )
    
    async def _read_fanout(self, message: Message, group_id: str, members: List[str]) -> FanoutResult:
        """Write once to group conversation. Members pull on next sync. O(1) write."""
        
        # Message is already being written to Cassandra via Kafka (normal persistence path)
        # For online members, we still send a lightweight "new message" notification
        # so they know to pull from Cassandra
        
        # Send lightweight "nudge" (not the full message) to online members
        online_count = 0
        for batch in chunk(members, 100):
            sessions = await self.session_store.mget(
                [f"session:user:{m}" for m in batch]
            )
            for member_id, session in zip(batch, sessions):
                if session and member_id != message.sender_id:
                    await self.pubsub.publish(
                        channel=f"channel:{session['gateway_id']}",
                        message=serialize_nudge(group_id, message.message_id)
                    )
                    online_count += 1
        
        # Client receives nudge → fetches latest messages from Cassandra
        # This adds ~50ms latency vs. write fan-out but prevents write amplification
        
        return FanoutResult(
            online_delivered=online_count,
            push_sent=0,  # Large groups: rely on nudge, not individual push
            strategy="read_fanout"
        )
```

---

## Scaling Considerations

| Challenge | Solution | Why It Works |
|---|---|---|
| **170M concurrent WebSockets** | 1,700+ gateway servers, each handling 100K connections via epoll | Linux kernel supports 1M+ file descriptors; 100K is conservative to leave headroom for CPU and memory |
| **Cross-gateway message routing** | Sharded Redis Pub/Sub (18 shards, consistent hash ring) | Each gateway subscribes to its own channel; routing is O(1) lookup + O(1) publish |
| **Message ordering** | Kafka partition by `conversation_id` + Snowflake IDs | Single partition = single consumer = total order; Snowflake provides wall-clock correlation |
| **Thundering herd on recovery** | Exponential backoff with jitter (base=1s, max=300s, jitter=20%) | Spreads 170M reconnections over ~5 minutes instead of 1 second |
| **Hot conversations** | Rate limiting per conversation (1000 msg/min) + connection-level throttling | Prevents viral group chats from overwhelming a single Cassandra partition |
| **Media messages** | Presigned S3 URLs + CDN; only URL reference stored in message | Keeps message path fast (200 bytes); media uploaded/downloaded directly to S3 |
| **Read receipts at scale** | Batched status updates (aggregate per conversation, flush every 500ms) | Without batching: 580K receipts/sec doubles write load; batching reduces to ~50K/sec |
| **Multi-datacenter** | Active-active with Cassandra multi-DC replication + Redis Cluster per DC | Users connect to nearest DC; messages replicate async (50-100ms cross-DC) |
| **Offline sync storm** | Cursor-based pagination (50 messages/batch) + server-side rate limiting (10 batches/sec) | Prevents a user with 10K missed messages from saturating Cassandra reads |
| **Group membership changes** | Invalidate Redis cache + Kafka event for async propagation | Membership is read-heavy (every group message) but write-rare (joins/leaves) |
| **End-to-end encryption key distribution** | Prekey bundles stored in PostgreSQL; fetched once per new conversation | Signal Protocol X3DH: sender fetches recipient's prekeys, establishes shared secret without interaction |
| **Message search** | Client-side index (E2E encrypted messages can't be server-searched); optional server-side for enterprise (Slack model) | Privacy vs. functionality tradeoff; WhatsApp chose privacy, Slack chose searchability |

---

## Quick Recall

| Interview Question | Concise Answer |
|---|---|
| Why WebSocket over HTTP polling? | Full-duplex, 130x less overhead (6 bytes vs 800 bytes/msg), persistent connection saves mobile battery |
| How do you route messages between gateways? | Redis Pub/Sub — each gateway subscribes to its own channel; Message Service publishes to recipient's gateway channel |
| Why Cassandra for messages? | Write-heavy workload (580K/sec), partition by `conversation_id` gives range-scan for conversation history, LSM-tree optimized for sequential writes |
| How do you guarantee ordering? | Per-conversation only: Kafka partition key = `conversation_id`; within partition, Snowflake IDs provide total order |
| What happens if Redis Pub/Sub loses a message? | No data loss — Kafka persists every message to Cassandra independently. Client syncs missed messages on next heartbeat or reconnect |
| How does group chat work at scale? | Hybrid fan-out: write fan-out for groups <= 100 (push individually), read fan-out for larger groups (write once, members pull) |
| How do offline users get messages? | Push notification (APNs/FCM) for alerting; full message retrieval via cursor-based sync from Cassandra on reconnect |
| How does presence work at 500M users? | Heartbeat every 30s + gossip protocol between presence instances; approximate (90s TTL) because exact is too expensive |
| Why Snowflake IDs instead of UUIDs? | 64 bits (vs 128), time-ordered (sortable without timestamp column), preserves Cassandra write locality in LSM-tree |
| How do you handle the thundering herd? | Exponential backoff with jitter on client reconnect; gateway admission control (503 + Retry-After); Kafka buffers messages during recovery |
| How does E2E encryption work? | Signal Protocol: X3DH key exchange + Double Ratchet for forward secrecy; server never sees plaintext; group chats use Sender Keys |
| Why partition by conversation_id not user_id? | Dominant access pattern is "load conversation history" (range scan); avoids N writes per group message; separate lightweight inbox index for conversation list |
| How do you handle media messages? | Client uploads directly to S3 (presigned URL); message contains only the S3 reference URL; CDN serves downloads; keeps message path fast |
| What is the single point of failure? | None by design — every layer is horizontally scaled and multi-DC. Closest risk: Redis Session Store (mitigated by Redis Cluster + fallback to Cassandra sync) |
