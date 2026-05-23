# System Design Estimation Cheat Sheet

!!! danger "Real Incident: Amazon EBS Outage, 2012"
    A capacity planning error for EBS volumes in US-East-1 triggered a cascading failure. The re-mirroring storm after a network event consumed more capacity than estimated, overwhelming the control plane. Reddit, Netflix, Instagram, and Pinterest went dark for hours. Root cause: the team underestimated how many volumes would simultaneously attempt recovery. **Back-of-envelope math isn't optional — it's the difference between a design that survives and one that cascades.**

---

## Why This Comes Up in Every Interview

Interviewers use estimation to test:

- Can you reason about scale without a calculator?
- Do you know the practical limits of hardware and systems?
- Can you identify bottlenecks BEFORE designing the solution?
- Do you make reasonable assumptions and state them explicitly?

Every system design answer should start with: "Let me estimate the scale first."

---

## Powers of 2 — The Foundation

| Power | Exact | Approximate | Name |
|---|---|---|---|
| 2^10 | 1,024 | ~1 Thousand | 1 KB |
| 2^20 | 1,048,576 | ~1 Million | 1 MB |
| 2^30 | 1,073,741,824 | ~1 Billion | 1 GB |
| 2^40 | ~1.1 Trillion | ~1 Trillion | 1 TB |
| 2^50 | ~1.1 Quadrillion | ~1 Quadrillion | 1 PB |

**Quick conversions:**

| From | To | Multiply by |
|---|---|---|
| Bytes → KB | ÷ 1,000 | (or shift right 10 bits) |
| KB → MB | ÷ 1,000 | |
| MB → GB | ÷ 1,000 | |
| Seconds/day | | 86,400 ≈ ~100K |
| Seconds/month | | ~2.5M |
| Seconds/year | | ~31.5M ≈ ~30M |

---

## Latency Numbers Every Programmer Should Know

| Operation | Latency | Notes |
|---|---|---|
| L1 cache reference | 1 ns | |
| L2 cache reference | 4 ns | |
| Branch mispredict | 3 ns | |
| Mutex lock/unlock | 17 ns | |
| Main memory (RAM) reference | 100 ns | |
| Compress 1KB (Snappy) | 2 μs | |
| Read 1MB sequentially from RAM | 3 μs | |
| SSD random read | 16 μs | |
| Read 1MB sequentially from SSD | 49 μs | |
| Round trip within same datacenter | 500 μs | 0.5 ms |
| Read 1MB sequentially from HDD | 825 μs | ~1 ms |
| Disk seek (HDD) | 2 ms | |
| Round trip same region (cross-AZ) | 1-2 ms | |
| Send packet CA → Netherlands → CA | 150 ms | Speed of light in fiber |
| Round trip cross-region (US→Europe) | 70-150 ms | |
| Round trip US → Asia | 150-300 ms | |

**Key takeaways for design:**

- Memory is 100x faster than SSD, 1000x faster than HDD
- Network within datacenter (~0.5ms) is acceptable for synchronous calls
- Cross-region (~150ms) means you MUST cache locally or accept latency
- Sequential reads are dramatically faster than random (SSD: 20x, HDD: 100x)

---

## Throughput Rules of Thumb

### Single Server Capacity

| Resource | Throughput | Notes |
|---|---|---|
| Web server (Nginx) | 100K-200K RPS | Static content / simple proxy |
| Application server | 5K-50K RPS | Depends on computation per request |
| PostgreSQL reads | 10K-50K QPS | With connection pooling, indexed queries |
| PostgreSQL writes | 5K-20K TPS | Depends on fsync, WAL |
| MySQL reads | 10K-50K QPS | Similar to PostgreSQL |
| Redis (single instance) | 100K-300K ops/sec | In-memory, single-threaded |
| Kafka (single broker) | 200K-2M msgs/sec | Depends on message size |
| Elasticsearch | 5K-50K queries/sec | Depends on query complexity |
| gRPC server | 10K-100K RPS | Lower latency than REST |

### Network Bandwidth

| Connection | Bandwidth | Effective Throughput |
|---|---|---|
| 1 Gbps NIC | 1 Gbps | ~100 MB/s effective |
| 10 Gbps NIC | 10 Gbps | ~1 GB/s effective |
| 25 Gbps NIC (cloud) | 25 Gbps | ~2.5 GB/s effective |
| Inter-AZ bandwidth | Typically 5-25 Gbps | Cloud dependent |
| Internet (user connection) | 10-100 Mbps | Highly variable |

---

## Availability Math

| SLA | Downtime/Year | Downtime/Month | Downtime/Week |
|---|---|---|---|
| 99% (two 9s) | 3.65 days | 7.3 hours | 1.68 hours |
| 99.9% (three 9s) | 8.77 hours | 43.8 minutes | 10.1 minutes |
| 99.95% | 4.38 hours | 21.9 minutes | 5.04 minutes |
| 99.99% (four 9s) | 52.6 minutes | 4.38 minutes | 1.01 minutes |
| 99.999% (five 9s) | 5.26 minutes | 26.3 seconds | 6.05 seconds |

**Compound availability:**

- Two components in SERIES: A × B (e.g., 99.9% × 99.9% = 99.8%)
- Two components in PARALLEL: 1 - (1-A)(1-B) (e.g., 1 - 0.001² = 99.9999%)

**Interview gold:** "If we need 99.99% availability and each server is 99.9% available, we need redundancy. Two servers in active-active gives us 1 - (0.001)² = 99.9999% — well above our target."

---

## The Estimation Template

### Step 1: Clarify Scale

| Question to Ask | Why |
|---|---|
| How many users? (DAU, MAU) | Determines request volume |
| Read-heavy or write-heavy? | Determines architecture (cache vs queue) |
| What's the read:write ratio? | Usually 10:1 to 1000:1 |
| What's the expected growth? | Size for 3-5 years ahead |
| Any traffic spikes? (peak:avg ratio) | Usually 3x-10x average |

### Step 2: Estimate Traffic

```
Daily active users (DAU) × actions per user = daily requests
Daily requests ÷ 86,400 = average QPS
Average QPS × peak factor (3-10x) = peak QPS
```

### Step 3: Estimate Storage

```
Daily new records × record size = daily storage
Daily storage × 365 × years × replication factor = total storage
```

### Step 4: Estimate Bandwidth

```
Peak QPS × average response size = outbound bandwidth
Peak write QPS × average request size = inbound bandwidth
```

### Step 5: Derive Infrastructure

```
Peak QPS ÷ single-server capacity = number of servers needed
Total storage ÷ per-machine storage = number of storage nodes
Add replication factor (usually 3x)
```

---

## Worked Examples

### Example 1: Twitter-like Feed (500M DAU)

| Parameter | Calculation | Result |
|---|---|---|
| Daily tweets | 500M × 2 tweets/user/day | 1B tweets/day |
| Tweet size | 280 chars + metadata ≈ 500 bytes | |
| Daily storage | 1B × 500 bytes | 500 GB/day |
| Yearly storage | 500 GB × 365 | ~180 TB/year |
| With replication (3x) | 180 TB × 3 | ~540 TB/year |
| Write QPS (avg) | 1B ÷ 86,400 | ~12K writes/sec |
| Peak write QPS (10x) | 12K × 10 | ~120K writes/sec |
| Read QPS (100:1 ratio) | 12K × 100 | ~1.2M reads/sec |
| Feed reads (timeline) | Need caching + fanout | Redis for hot timelines |

**Conclusion:** Need sharding (120K peak writes > single DB), heavy caching (1.2M reads/sec), and ~540TB storage over 3 years.

### Example 2: Chat System (WhatsApp-scale, 2B users, 100B messages/day)

| Parameter | Calculation | Result |
|---|---|---|
| Messages/sec (avg) | 100B ÷ 86,400 | ~1.15M msg/sec |
| Peak (5x) | 1.15M × 5 | ~5.8M msg/sec |
| Message size | ~100 bytes avg (text) | |
| Daily storage | 100B × 100 bytes | 10 TB/day |
| Monthly storage | 10 TB × 30 | 300 TB/month |
| With replication (3x) | 300 TB × 3 | 900 TB/month |
| WebSocket connections | 500M concurrent (DAU/4) | |
| Servers for connections | 500M ÷ 100K per server | ~5,000 servers |
| Bandwidth (outbound) | 5.8M × 100 bytes | ~580 MB/sec peak |

**Conclusion:** Need message queue backbone (Kafka at 5.8M/sec), ~5000 WebSocket gateway servers, partition by conversation_id.

### Example 3: Image Hosting (Instagram-scale, 2B users, 100M uploads/day)

| Parameter | Calculation | Result |
|---|---|---|
| Uploads/sec | 100M ÷ 86,400 | ~1,150 uploads/sec |
| Average image size | 2 MB (after compression) | |
| Daily storage | 100M × 2 MB | 200 TB/day |
| Yearly storage | 200 TB × 365 | 73 PB/year |
| With CDN replicas | 73 PB × 3 regions | ~220 PB |
| Upload bandwidth | 1,150 × 2 MB | 2.3 GB/sec inbound |
| Read QPS (50:1 ratio) | 1,150 × 50 | 57,500 reads/sec |
| CDN hit rate (95%) | Only 5% reach origin | ~2,875 origin reads/sec |
| Origin bandwidth | 2,875 × 2 MB | ~5.7 GB/sec |

**Conclusion:** CDN is critical (reduces origin load 20x), object storage (S3) for images, metadata in sharded DB.

---

## Common Interview Estimates (Quick Reference)

| System | Users | Key Metric | Key Number |
|---|---|---|---|
| URL shortener | 100M URLs/month | Redirects/sec | ~40K (read-heavy) |
| Chat system | 500M DAU | Messages/sec | ~1M |
| Social feed | 500M DAU | Feed reads/sec | ~1M |
| Video streaming | 1B views/day | Bandwidth | Petabytes/day |
| Search engine | 5B searches/day | QPS | ~60K |
| Payment system | 1M transactions/day | TPS | ~12 (low but critical) |

---

## Common Estimation Mistakes

| Mistake | Reality |
|---|---|
| Forgetting peak vs average | Peak is typically 3-10x average. Design for peak. |
| Ignoring replication | Storage × 3 for fault tolerance |
| Assuming uniform traffic | Time zones, events, and seasonality cause spikes |
| Not accounting for metadata | Indexes, logs, and metadata often 2-3x raw data |
| Forgetting retention/growth | "How long do we keep data?" changes everything |
| Single point math | Show range: "between X and Y, I'll use Z for design" |

---

## Interview Framework

**When the interviewer says "Design X":**

> **Step 1 — Clarify and scope:** "Before diving in, let me estimate the scale. We have [N] users doing [M] actions per day. That's [X] requests/sec average, [Y] peak."
>
> **Step 2 — Storage:** "Each [entity] is approximately [Z] bytes. At [N] per day with [R] replication, that's [T] TB over [Y] years."
>
> **Step 3 — Bandwidth:** "Peak [X] requests/sec × [Z] KB average response = [B] GB/sec. This tells me we need [CDN / multiple servers / caching]."
>
> **Step 4 — Identify bottleneck:** "The bottleneck is [reads at 1M QPS → need caching | writes at 100K TPS → need sharding | storage at PB scale → need object storage + tiering]."
>
> **Step 5 — Derive infrastructure:** "At [X] QPS per server, we need [N] servers. With [Z] TB per machine, we need [M] storage nodes. Replication factor 3 for durability."

---

## Quick Recall

| Question | Answer |
|---|---|
| Seconds in a day? | ~86,400 ≈ ~100K (for quick math) |
| QPS for 1B requests/day? | ~12K average |
| RAM vs SSD speed? | RAM is ~100x faster (100ns vs 16μs) |
| Cross-region latency? | 70-300ms (speed of light limit) |
| Redis throughput? | 100K-300K ops/sec per instance |
| 99.99% downtime? | ~52 minutes/year |
| Compound availability (series)? | Multiply: 99.9% × 99.9% = 99.8% |
| Peak vs average ratio? | Usually 3-10x |
| Replication factor? | Usually 3x for durability |
| When to shard? | Single DB can't handle the write QPS or storage |
