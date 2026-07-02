---
title: "Web Crawler (Googlebot Scale) — System Design Interview (2026)"
description: "Design a web crawler at Googlebot scale — system design interview walkthrough covering URL frontier, politeness enforcement, deduplication via Bloom filters and SimHash, and scaling to 1 billion pages per day."
---

# Web Crawler (Googlebot Scale)

!!! danger "Real Incident: Googlebot DDoS, 2009"
    In 2009, a bug in Googlebot's crawl scheduler caused it to ignore updated `robots.txt` files for several hours. Sites that had recently restricted crawl paths were hammered with thousands of requests per second — effectively a DDoS from Google's own infrastructure. Small WordPress sites went down. Hosting providers flagged Google's IP ranges. The root cause: the robots.txt cache had a stale-entry bug that prevented refreshes when the file returned a temporary 5xx error — so the crawler kept using the OLD permissive rules. Google's post-mortem led to the "always re-fetch robots.txt on 5xx" policy and per-host adaptive rate limiting. **A web crawler without strict politeness enforcement is indistinguishable from a denial-of-service attack.**

---

## System Design Concepts Used

`URL Frontier` · `Priority Queue` · `Politeness Queue` · `Bloom Filter` · `SimHash / MinHash` · `Consistent Hashing` · `DNS Caching` · `Robots.txt Compliance` · `Breadth-First Crawl` · `Distributed Workers` · `Kafka` · `Content Fingerprinting` · `Crawl Budget` · `Trap Detection` · `Adaptive Rate Limiting`

---

## 1. Functional Requirements

1. **Seed URL ingestion** — accept a list of seed URLs to begin crawling
2. **Page fetching** — download HTML content from the web (HTTP/HTTPS)
3. **Link extraction** — parse fetched pages and extract outgoing hyperlinks
4. **Deduplication** — avoid re-crawling the same URL or storing duplicate content
5. **Politeness** — respect `robots.txt`, enforce per-domain rate limits and crawl delays
6. **Priority crawling** — crawl high-value pages (news homepages, frequently updated) more often
7. **Content storage** — store raw HTML and extracted metadata for downstream indexing
8. **Recrawl scheduling** — revisit pages based on change frequency (adaptive freshness)

## 2. Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Throughput** | 1 billion pages/day (~10K pages/sec) | Googlebot-scale requires massive parallelism |
| **Politeness** | Max 1 req/sec per domain (configurable) | Must not overwhelm target servers |
| **Freshness** | < 1 hour for news, < 7 days for static pages | Search relevance depends on fresh content |
| **Fault tolerance** | No URL permanently lost on worker crash | Crawl progress must survive failures |
| **Storage** | Petabytes of raw content | Average page = 500 KB; 1B pages/day = 500 TB/day raw |
| **Scalability** | Horizontal — add workers linearly | Doubling workers should double throughput |
| **Dedup accuracy** | < 0.01% false-positive crawl rate | Wasted bandwidth on duplicates is expensive at scale |

---

## 3. Capacity Estimation

```text
/* ━━━ NAPKIN MATH: Daily Crawl Volume ━━━ */
Pages/day: 1 billion (1,000,000,000)
Pages/sec: 1B / 86,400 ≈ 11,574 → round to 10K pages/sec
Peak (2x): 20K pages/sec

/* ━━━ BANDWIDTH ━━━ */
Average page size (HTML only): 100 KB (compressed transfer)
Raw storage per page (with headers): 500 KB
Bandwidth: 10K pages/sec × 100 KB = 1 GB/sec inbound (≈ 8 Gbps)
Peak bandwidth: 2 GB/sec (≈ 16 Gbps)

/* ━━━ STORAGE ━━━ */
Daily raw content: 1B × 500 KB = 500 TB/day
With 30-day retention: 500 TB × 30 = 15 PB
Compressed (5:1): ~3 PB active storage
URL store (seen URLs): 10B unique URLs × 100 bytes = 1 TB

/* ━━━ DNS LOOKUPS ━━━ */
Unique domains: ~200M domains across the web
DNS queries: 10K pages/sec → ~2K unique domains/sec (batch by domain)
DNS cache size: 200M × 50 bytes = 10 GB (fits in memory)

/* ━━━ URL FRONTIER ━━━ */
Pending URLs at any time: ~10 billion URLs in queue
At 100 bytes/URL: 10B × 100B = 1 TB frontier size
In-memory working set: ~100M URLs = 10 GB

/* ━━━ WORKERS ━━━ */
Per worker throughput: ~50 pages/sec (limited by network RTT + politeness)
Workers needed: 10K / 50 = 200 workers
With overhead: 300-500 worker machines
```

!!! note "System Nature"
    **Network-bound and politeness-constrained.** The bottleneck is NOT CPU or disk — it's the combination of network round-trip time for fetching and the politeness requirement that limits per-domain request rate. Architecture must maximize parallelism ACROSS domains while throttling WITHIN each domain.

---

## 4. "Why X, Not Y?" — Tradeoff Analysis

### Why BFS crawling and not DFS?

**BFS wins because it discovers high-value pages first.** Starting from seed URLs (homepages), BFS explores all links at depth 1 (category pages), then depth 2 (articles), etc. This mirrors the web's link structure — important pages are linked from many homepages and appear early in BFS. DFS would follow one chain deep into a site (page 1 → page 2 → page 3 → ...) potentially reaching low-value pages while ignoring the rest of the web.

*DFS advantage:* Lower memory usage (only the current path in memory vs. entire frontier). Useful for focused crawling of a single site where depth matters more than breadth.

### Why Bloom filter and not Redis SET for URL deduplication?

**Bloom filter wins at 10B URLs because it fits in memory with O(1) lookups and zero network calls.** A Bloom filter for 10B URLs with 0.01% false-positive rate needs ~18 GB of memory — a single machine can hold it. A Redis SET storing 10B URLs × 100 bytes = 1 TB — requires a massive Redis cluster with network latency on every check.

*Redis SET advantage:* Zero false positives. Supports deletion (removing URLs from "seen" set for recrawling). Use for smaller crawl scopes (< 100M URLs) where exactness matters.

### Why persistent queue (Kafka) and not in-memory frontier only?

**Kafka wins because a crawler crash must not lose millions of pending URLs.** The URL frontier holds 10B URLs — losing even 1% on a restart means 100M URLs need rediscovery. Kafka provides persistence, replay capability, and back-pressure for free. In-memory-only frontiers (like a priority queue in RAM) are fast but volatile.

*In-memory advantage:* Lower latency (no disk I/O per enqueue). Use an in-memory working set backed by Kafka — workers pull batches of 1000 URLs from Kafka into a local priority queue, process them, then pull the next batch.

### Why SimHash and not exact content hashing (SHA-256) for dedup?

**SimHash detects near-duplicates, not just exact duplicates.** Two pages with identical content except for a timestamp, ad banner, or session token are "near-duplicates" — SHA-256 would see them as completely different. SimHash produces similar fingerprints for similar content, catching the 30%+ of web pages that are near-duplicates (navigation templates, paginated lists, cookie banners).

*SHA-256 advantage:* Exact match with zero false positives. Use as a first-pass filter (exact duplicates are free to detect), then apply SimHash only for near-duplicate detection.

---

## 5. High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          WEB CRAWLER — SYSTEM ARCHITECTURE                       │
│         1B pages/day | 10K pages/sec | Petabytes of content | Politeness-first  │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   Seed URLs      │
                              │ (Initial Input)  │
                              └────────┬─────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            URL FRONTIER                                           │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────────────┐  │
│  │ Priority Queues  │    │ Politeness Queues │    │ Recrawl Scheduler           │  │
│  │ (PageRank,       │───▶│ (per-domain       │    │ (adaptive freshness,        │  │
│  │  freshness,      │    │  rate limiting,   │    │  change-frequency based)    │  │
│  │  site importance)│    │  crawl-delay)     │    │                             │  │
│  └─────────────────┘    └────────┬─────────┘    └─────────────────────────────┘  │
│                                  │                                                │
│  Backed by: Kafka (persistence) + In-memory working set (hot URLs)               │
└──────────────────────────────────┼───────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        DISTRIBUTED FETCH WORKERS (300-500 nodes)                  │
│                                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │  Worker 1    │   │  Worker 2    │   │  Worker 3    │   │  Worker N    │     │
│  │  ─────────   │   │  ─────────   │   │  ─────────   │   │  ─────────   │     │
│  │  DNS Resolve │   │  DNS Resolve │   │  DNS Resolve │   │  DNS Resolve │     │
│  │  HTTP Fetch  │   │  HTTP Fetch  │   │  HTTP Fetch  │   │  HTTP Fetch  │     │
│  │  Parse HTML  │   │  Parse HTML  │   │  Parse HTML  │   │  Parse HTML  │     │
│  │  Extract URLs│   │  Extract URLs│   │  Extract URLs│   │  Extract URLs│     │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘     │
│         └──────────────────┼──────────────────┼──────────────────┘              │
└─────────────────────────────┼──────────────────┼─────────────────────────────────┘
                              │                  │
                    ┌─────────┘                  └────────────┐
                    ▼                                         ▼
┌───────────────────────────────────┐   ┌───────────────────────────────────────┐
│       DEDUPLICATION SERVICE        │   │         CONTENT STORE                 │
│                                   │   │                                       │
│  URL-Level:                       │   │  ┌─────────────────────────────────┐  │
│  ┌─────────────────────────────┐  │   │  │   HDFS / S3 (Raw HTML)         │  │
│  │ Bloom Filter (18 GB, 10B)   │  │   │  │   500 TB/day, 30-day retention │  │
│  │ 0.01% false-positive rate   │  │   │  └─────────────────────────────────┘  │
│  └─────────────────────────────┘  │   │                                       │
│                                   │   │  ┌─────────────────────────────────┐  │
│  Content-Level:                   │   │  │   Metadata DB (Cassandra)       │  │
│  ┌─────────────────────────────┐  │   │  │   URL, fetch time, status,     │  │
│  │ SimHash / MinHash           │  │   │  │   content hash, outlinks       │  │
│  │ (near-duplicate detection)  │  │   │  └─────────────────────────────────┘  │
│  └─────────────────────────────┘  │   │                                       │
└───────────────────────────────────┘   └───────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────┐
│         URL STORE                  │
│  (All discovered URLs + metadata) │
│  RocksDB / Cassandra              │
│  10B URLs × 100 bytes = 1 TB      │
│  Tracks: last_crawled, priority,  │
│  change_freq, robots_status       │
└───────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│                        SUPPORTING SERVICES                                        │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────────────┐  │
│  │ DNS Cache         │  │ Robots.txt Cache  │  │ Trap Detector                 │  │
│  │ (10 GB, 200M     │  │ (per-domain,      │  │ (infinite URL pattern         │  │
│  │  domains, local)  │  │  refresh on 5xx,  │  │  detection, depth limits,     │  │
│  │                   │  │  24h TTL)         │  │  URL length heuristics)       │  │
│  └──────────────────┘  └──────────────────┘  └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Key Components Explained

### URL Frontier
The heart of the crawler. Combines **priority** (what to crawl next) with **politeness** (when it's safe to crawl). Backed by Kafka for durability — if the entire frontier service restarts, pending URLs are not lost. Workers pull batches of URLs from their assigned domain partitions, process them locally, and commit offsets only after successful storage.

### Distributed Fetch Workers
Stateless HTTP fetchers partitioned by domain hash (Worker N handles domains where `hash(domain) mod NUM_WORKERS = N`). This ensures a single domain's politeness state lives on one worker — no distributed locking needed. Each worker maintains a local connection pool, DNS cache, and robots.txt cache for its assigned domains.

### Deduplication Service
Two-tier dedup: (1) **URL-level** — Bloom filter rejects URLs we've already seen, preventing redundant fetches. (2) **Content-level** — SimHash detects near-duplicate pages after fetching, preventing redundant storage. The first tier saves network bandwidth; the second saves storage costs.

### DNS Cache
External DNS resolution takes 10-100ms — at 10K pages/sec, that's a massive bottleneck if done per-fetch. The local DNS cache (10 GB for 200M domains) provides sub-millisecond lookups for 80% of requests. The remaining 20% (new or expired domains) are resolved in batch via dedicated DNS resolver threads.

### Robots.txt Cache
Every domain's robots.txt is fetched once and cached for 24 hours. The cache is proactively refreshed for high-traffic domains. On 5xx errors (can't fetch robots.txt), the crawler assumes the MOST RESTRICTIVE policy — stop crawling that domain until robots.txt is successfully retrieved. This prevents the 2009 Googlebot incident.

### Trap Detector
Runs heuristics on incoming URLs and crawl patterns to identify infinite URL generators. Operates in real-time (rejecting suspicious URLs before they enter the frontier) and in batch mode (analyzing crawl logs to detect patterns that slipped through).

---

## 7. Architecture Flow — Crawling a News Article

A new article `https://bbc.com/news/tech/ai-breakthrough-2026` is published and linked from BBC's homepage. Here's how the crawler discovers and fetches it.

### Phase 1 — URL Discovery

**T+0s:** A worker fetching `https://bbc.com/` (scheduled for recrawl every 15 minutes due to high change frequency) parses the homepage HTML and extracts 200+ outgoing links, including our target URL.

**T+0.1s:** The worker sends extracted URLs to the **Deduplication Service**. The Bloom filter is checked: `https://bbc.com/news/tech/ai-breakthrough-2026` is NOT in the filter (new URL). The URL passes dedup.

```text
Worker → extract links → Bloom filter check → NEW URL → enqueue to frontier
```

### Phase 2 — Frontier Prioritization

**T+0.2s:** The URL is enqueued into the **URL Frontier**. The priority module assigns it a high score because:

- Domain: `bbc.com` (high authority, PageRank > 7)
- Path pattern: `/news/` (news content = high freshness value)
- Discovery source: linked from homepage (important pages link to important pages)

**T+0.3s:** The URL enters the `bbc.com` **politeness queue**. The crawler last hit `bbc.com` 0.8 seconds ago. The `robots.txt` for BBC specifies `Crawl-delay: 1`. The URL must wait at least 0.2 seconds before being dispatched.

### Phase 3 — Robots.txt Check

**T+0.5s:** Before dispatching, the system checks the **Robots.txt Cache** for `bbc.com`. The cached copy (fetched 2 hours ago, TTL = 24h) shows:

```text
User-agent: *
Disallow: /search
Disallow: /cgi-bin
Crawl-delay: 1

User-agent: Googlebot
Allow: /
Crawl-delay: 0.5
```

Our target URL `/news/tech/ai-breakthrough-2026` is NOT disallowed. The URL is cleared for fetching.

### Phase 4 — DNS Resolution

**T+0.6s:** Worker checks the **DNS Cache**: `bbc.com → 151.101.0.81` (cached 6 hours ago, TTL = 24h). Cache HIT — no external DNS query needed. At 10K pages/sec, DNS caching eliminates ~80% of external DNS lookups.

### Phase 5 — HTTP Fetch

**T+0.7s:** Worker sends `GET /news/tech/ai-breakthrough-2026` to `151.101.0.81` with:

```text
User-Agent: Googlebot/2.1 (+http://www.google.com/bot.html)
Accept-Encoding: gzip
If-Modified-Since: (none — first fetch)
Connection: keep-alive
```

**T+1.2s:** Response received. `200 OK`, `Content-Length: 85KB` (gzipped), `Content-Type: text/html`.

### Phase 6 — Content Processing

**T+1.3s:** Worker decompresses and parses the HTML:

1. **Content fingerprint:** Compute SimHash of the page body text (ignoring boilerplate). Check against the SimHash index — no near-duplicate found. Content is NEW.
2. **Store raw HTML:** Write to HDFS/S3 with key `bbc.com/news/tech/ai-breakthrough-2026/2026-06-07T10:00:00Z`.
3. **Extract outlinks:** 45 links found. Normalize URLs (resolve relative paths, remove fragments, canonicalize).
4. **Update URL Store:** Mark this URL as `last_crawled = now`, `change_freq = unknown` (first fetch).

### Phase 7 — Extracted URLs Re-enter the Loop

**T+1.4s:** The 45 extracted URLs are sent through dedup. 38 are already in the Bloom filter (previously seen). 7 are new — they're enqueued into the frontier with appropriate priority scores. The cycle continues.

```text
Total time for one page: ~1.4 seconds (dominated by network RTT + politeness delay)
Parallelism: 300 workers × 50 pages/sec each = 15K pages/sec capacity
```

---

## 8. Failure & Recovery Scenarios

### Worker Crash Mid-Fetch

**Impact:** The URL was dequeued from the frontier but never marked as "fetched" in the URL Store.

**Mitigation:** Use **at-least-once delivery** with visibility timeout. When a worker pulls a URL from Kafka, the message is not committed until processing completes. If the worker dies, Kafka re-delivers the message to another worker after the visibility timeout (30 seconds). The URL is fetched again — idempotent because we check content hash before storing duplicates.

### DNS Cache Poisoning

**Impact:** A poisoned DNS entry could redirect crawl traffic to a malicious server, causing the crawler to index fake content or leak internal request patterns.

**Mitigation:** (1) Use DNS-over-HTTPS (DoH) to prevent man-in-the-middle poisoning. (2) Validate DNS responses — reject private IP ranges (10.x.x.x, 192.168.x.x) that could be SSRF attacks. (3) Cross-reference DNS results with historical records — flag sudden IP changes for high-authority domains. (4) Short DNS cache TTLs (6-24h) limit the blast radius of a stale poisoned entry.

### Spider Trap Detection

**Impact:** Malicious or misconfigured sites generate infinite URLs dynamically (e.g., calendar sites with `?date=2026-01-01`, `?date=2026-01-02`, ..., forever). Without detection, the crawler wastes resources on one site indefinitely.

**Mitigation:**

- **URL length limit:** Reject URLs > 2048 characters (often a sign of parameter accumulation)
- **Depth limit:** Stop crawling a site beyond depth 20 from the homepage
- **Per-domain URL cap:** Max 500K unique URLs per domain per day
- **Pattern detection:** If > 100 URLs match a regex pattern (e.g., `/calendar?date=YYYY-MM-DD`), flag the pattern and stop expanding it
- **Novelty scoring:** If the last 50 pages from a domain all have SimHash distance < 3 (near-identical content), reduce the domain's priority to near-zero

### Frontier Corruption / Kafka Failure

**Impact:** Loss of the URL frontier means millions of pending URLs are lost and must be rediscovered.

**Mitigation:** (1) Kafka runs with replication factor 3 across availability zones. (2) The URL Store (Cassandra) keeps a permanent record of all discovered URLs and their status — the frontier can be reconstructed by querying all URLs with `status = PENDING`. (3) Daily snapshots of the Bloom filter are persisted to S3 — on total loss, rebuild from the URL Store scan.

### Target Site Returns 5xx Errors

**Impact:** Temporary server errors should not cause permanent crawl failures or aggressive retries that worsen the target's issues.

**Mitigation:** Exponential backoff with jitter per domain: 1s → 2s → 4s → 8s → ... up to 1 hour. After 5 consecutive failures for a domain, move ALL that domain's URLs to a low-priority "sick list" — retry the domain after 6 hours. This prevents the crawler from repeatedly hammering a struggling server.

---

## 9. Data Model

```text
/* ━━━ URL Store (Cassandra / RocksDB) ━━━ */

CREATE TABLE urls (
    url_hash        BIGINT PRIMARY KEY,      -- 64-bit hash of normalized URL
    url             TEXT NOT NULL,            -- full normalized URL
    domain          TEXT NOT NULL,            -- extracted domain for politeness
    status          TEXT,                     -- PENDING | FETCHING | FETCHED | FAILED
    priority        FLOAT,                   -- 0.0 to 1.0 (higher = crawl sooner)
    last_crawled    TIMESTAMP,
    last_modified   TIMESTAMP,               -- from HTTP Last-Modified header
    content_hash    BIGINT,                  -- SimHash fingerprint
    change_freq     TEXT,                    -- HOURLY | DAILY | WEEKLY | MONTHLY | NEVER
    depth           INT,                     -- hops from seed URL
    retry_count     INT DEFAULT 0,
    created_at      TIMESTAMP
);

CREATE INDEX idx_domain_status ON urls (domain, status);
CREATE INDEX idx_priority ON urls (priority DESC) WHERE status = 'PENDING';
```

```text
/* ━━━ Content Store (HDFS / S3) ━━━ */

Path: s3://crawl-data/{domain}/{url_hash}/{timestamp}.html.gz

Metadata sidecar (stored in Cassandra):
{
    "url": "https://bbc.com/news/tech/ai-breakthrough-2026",
    "fetch_time": "2026-06-07T10:00:00Z",
    "http_status": 200,
    "content_type": "text/html",
    "content_length": 85000,
    "content_hash": "a4f8c2e1...",       -- SHA-256 of raw content
    "simhash": 0x3F2A1B4C5D6E7F80,      -- 64-bit SimHash
    "outlinks": ["url1", "url2", ...],   -- extracted outgoing URLs
    "title": "AI Breakthrough 2026...",
    "language": "en"
}
```

```text
/* ━━━ Robots.txt Cache (Redis) ━━━ */

Key: robots:{domain}
Value: {
    "fetched_at": "2026-06-07T08:00:00Z",
    "ttl": 86400,
    "rules": [
        {"user_agent": "*", "disallow": ["/search", "/cgi-bin"], "crawl_delay": 1},
        {"user_agent": "Googlebot", "allow": ["/"], "crawl_delay": 0.5}
    ]
}
TTL: 24 hours (refresh on access if stale, immediate refresh on 5xx)
```

```text
/* ━━━ DNS Cache (In-Memory / Redis) ━━━ */

Key: dns:{domain}
Value: {
    "ip": "151.101.0.81",
    "resolved_at": "2026-06-07T04:00:00Z",
    "ttl": 86400
}
```

---

## 10. Algorithms Under the Hood

### URL Frontier: Two-Level Queue Architecture

```text
/*
 * The frontier has TWO concerns that conflict:
 * 1. PRIORITY — crawl important pages first
 * 2. POLITENESS — don't hit any single domain too fast
 *
 * Solution: two-level queue system
 */

/* ━━━ LEVEL 1: Priority Queues (Front Queues) ━━━ */
/* URLs are routed to priority buckets based on score */

function compute_priority(url):
    score = 0.0
    score += pagerank(url.domain) × 0.3        // domain authority
    score += freshness_need(url) × 0.3         // how stale is our copy?
    score += discovery_source_weight × 0.2     // linked from important page?
    score += depth_penalty(url.depth) × 0.2    // shallow = higher priority
    return score  // 0.0 to 1.0

// Route to priority queue: queue_id = floor(score × NUM_PRIORITY_QUEUES)
// Higher priority queues are sampled more frequently

/* ━━━ LEVEL 2: Politeness Queues (Back Queues) ━━━ */
/* Each domain gets its own FIFO queue. Worker can only pull from a domain
   if enough time has elapsed since the last request to that domain. */

MAP<domain, Queue<URL>> politeness_queues
MAP<domain, timestamp> last_request_time
MAP<domain, float> crawl_delay  // from robots.txt, default 1s

function get_next_url():
    // Pick highest-priority non-blocked domain
    for queue in priority_queues (highest first):
        url = queue.peek()
        domain = url.domain
        elapsed = now() - last_request_time[domain]
        if elapsed >= crawl_delay[domain]:
            queue.dequeue()
            last_request_time[domain] = now()
            return url
    return null  // all domains are rate-limited, wait
```

### Deduplication: Bloom Filter + SimHash

```text
/* ━━━ URL-LEVEL DEDUP: Bloom Filter ━━━ */
/*
 * Parameters for 10B URLs, 0.01% false-positive rate:
 * m (bits) = -n × ln(p) / (ln2)^2 = 10B × 13.3 = 133 billion bits ≈ 16 GB
 * k (hash functions) = (m/n) × ln2 = 13.3 × 0.693 ≈ 9 hash functions
 */

function is_url_seen(url):
    normalized = normalize(url)    // lowercase, remove fragment, sort params
    hash = fingerprint(normalized) // 64-bit hash
    return bloom_filter.might_contain(hash)

function mark_url_seen(url):
    normalized = normalize(url)
    hash = fingerprint(normalized)
    bloom_filter.add(hash)

/* ━━━ CONTENT-LEVEL DEDUP: SimHash ━━━ */
/*
 * SimHash: locality-sensitive hash — similar documents produce similar hashes.
 * Hamming distance < 3 bits → near-duplicate (empirically validated threshold).
 */

function compute_simhash(html):
    text = extract_body_text(html)   // strip tags, scripts, boilerplate
    tokens = tokenize(text)          // word-level tokens
    
    vector = [0] × 64               // 64-dimensional accumulator
    for token in tokens:
        hash = md5(token)            // 64-bit hash per token
        weight = idf(token)          // TF-IDF weight
        for i in 0..63:
            if hash.bit(i) == 1:
                vector[i] += weight
            else:
                vector[i] -= weight
    
    // Convert to 64-bit fingerprint
    fingerprint = 0
    for i in 0..63:
        if vector[i] > 0:
            fingerprint.set_bit(i)
    return fingerprint

function is_near_duplicate(new_hash, existing_hashes):
    for existing in existing_hashes:
        if hamming_distance(new_hash, existing) <= 3:
            return true  // near-duplicate detected
    return false
```

### Politeness: Adaptive Rate Limiting

```text
/*
 * Base rate: from robots.txt Crawl-delay (default: 1 second)
 * Adaptive: if server responds slowly, back off further
 */

function adaptive_crawl_delay(domain, response_time_ms):
    base_delay = robots_crawl_delay(domain)  // from robots.txt, default 1s
    
    // If server is struggling (response > 2s), increase delay
    if response_time_ms > 2000:
        multiplier = response_time_ms / 1000  // e.g., 3s response → 3x delay
        return base_delay × multiplier
    
    // If server is fast (< 200ms), use base delay (don't go faster than robots.txt allows)
    return base_delay

function should_fetch(domain):
    elapsed = now() - last_request_time[domain]
    delay = adaptive_crawl_delay(domain, avg_response_time[domain])
    return elapsed >= delay
```

### URL Normalization

```text
function normalize(url):
    // 1. Lowercase scheme and host
    url.scheme = url.scheme.lower()      // HTTP → http
    url.host = url.host.lower()          // BBC.com → bbc.com
    
    // 2. Remove default ports
    if url.port == 80 and url.scheme == "http": remove port
    if url.port == 443 and url.scheme == "https": remove port
    
    // 3. Remove fragment
    url.fragment = null                  // #section → removed
    
    // 4. Sort query parameters
    url.query_params = sort(url.query_params)
    
    // 5. Remove tracking parameters
    remove params: utm_source, utm_medium, utm_campaign, fbclid, gclid
    
    // 6. Resolve path
    url.path = resolve_dots(url.path)   // /a/../b → /b
    url.path = remove_trailing_slash(url.path) unless root
    
    // 7. Percent-encode normalization
    url = canonical_percent_encode(url)
    
    return url.toString()
```

---

## 11. Scaling Considerations

| Challenge | Solution | Numbers |
|---|---|---|
| 10K pages/sec throughput | Horizontally scale workers; partition frontier by domain hash | 300-500 worker nodes, each handles ~50 pages/sec |
| 10B URLs in Bloom filter | Partitioned Bloom filter across machines OR single 18 GB filter in memory | 18 GB fits on one 64 GB machine with room for other services |
| Frontier size (10B pending URLs) | Kafka for persistence + in-memory working set of 100M hot URLs | Workers pull batches; Kafka handles overflow |
| DNS bottleneck | Local DNS cache (10 GB) + batch resolution per domain | 80% cache hit rate reduces external DNS by 5x |
| Heterogeneous page sizes | Adaptive timeout: 5s for HTML, 30s for large PDFs, skip > 10 MB | Prevents slow pages from blocking workers |
| Global crawl (latency to distant servers) | Deploy crawl workers in multiple regions (US, EU, Asia) | Workers in EU crawl EU sites faster (lower RTT) |
| Recrawl scheduling | Change-detection model: pages that change often get shorter recrawl intervals | News sites: 15 min. Blogs: 7 days. Static docs: 30 days. |
| Bloom filter rebuild | Daily snapshot to S3. On corruption, rebuild from URL Store scan (1 hour) | Can serve from stale filter during rebuild (slight dup increase) |

---

## 12. What If the Interviewer Pushes Back?

??? question "How do you handle websites that generate infinite URLs (spider traps)?"
    **Defend:** Multiple layers of defense. (1) **URL length limit** — reject URLs > 2048 characters. (2) **Per-domain depth limit** — stop at depth 20 from homepage. (3) **Per-domain URL cap** — max 500K URLs per domain per day. (4) **Pattern detection** — if the last 100 URLs from a domain follow the same parameterized pattern (e.g., `/page?id=N`), flag the pattern and stop expanding. (5) **Content novelty scoring** — if SimHash shows the last 50 pages are near-identical, deprioritize the domain to near-zero. These heuristics catch calendar traps, session ID traps, and dynamically generated infinite pagination.

??? question "Your Bloom filter has false positives — won't you miss pages?"
    **Defend:** Yes, 0.01% of NEW URLs will be incorrectly flagged as "already seen" and skipped. At 1B pages/day discovering ~100M new URLs/day, that's ~10K missed pages per day — negligible for web-scale crawling. These pages will eventually be discovered through alternate paths (other pages link to them). If this is unacceptable, use a **counting Bloom filter** that allows deletion, or pair the Bloom filter with a secondary check against the URL Store for high-priority domains (only for top-1000 sites, not all 200M domains).

??? question "How do you decide recrawl frequency for each page?"
    **Adapt:** Use an **adaptive freshness model**. Track the ratio of fetches where content actually changed vs. stayed the same. If a page changed in 8 out of 10 recrawls → increase frequency (crawl every hour). If it changed in 0 out of 10 recrawls → decrease frequency (crawl monthly). This is essentially a modified Poisson model. For brand-new URLs with no history, use heuristics: news domains start at 1-hour intervals, blog domains start at 1-day, static documentation starts at 1-week. Adjust based on observed behavior.

??? question "What if a single domain has 100M pages (like Amazon or Wikipedia)? Your per-domain politeness queue becomes huge."
    **Adapt:** For mega-domains, apply **intra-domain priority** — not all 100M Amazon product pages are equally important. Prioritize pages with higher incoming link counts (popular products), recently updated pages (price changes), and pages linked from sitemaps. Cap per-domain crawl budget at a configurable limit (e.g., 1M pages/day for top domains, 10K for average sites). The rest of the 100M pages are crawled over weeks, not days.

??? question "How do you handle JavaScript-rendered content (SPAs)?"
    **Adapt:** This is the hardest problem in modern crawling. Options: (1) **Headless browser rendering** — spin up Chrome/Puppeteer instances to render JS. Expensive: 10x slower (2-5 seconds per page vs. 200ms for static HTML). Reserve headless rendering for high-value domains known to be JS-heavy. (2) **Selective rendering** — fetch static HTML first. If the body is nearly empty (<1KB text content), re-fetch with headless rendering. (3) **Pre-rendering services** — partner with sites via dynamic rendering (they serve pre-rendered HTML to bot user-agents). Google's actual approach: render a subset of pages asynchronously in a "render queue" separate from the fetch queue.

??? question "What consistency guarantees does the Bloom filter have across distributed workers?"
    **Defend:** The Bloom filter is eventually consistent. A URL marked as "seen" by Worker A might not be visible to Worker B for a few seconds (replication lag). This means occasional duplicate fetches — a page might be fetched twice before the Bloom filter propagates. This is acceptable because: (1) content dedup (SimHash) catches it at the storage layer, and (2) duplicate fetches are idempotent and only waste bandwidth, not correctness. For stricter dedup, use a centralized Redis-backed Bloom filter (adds ~1ms network latency per check but guarantees consistency).

??? question "How do you prevent the crawler from being used as a DDoS proxy?"
    **Defend:** Multiple safeguards. (1) **Seed URL validation** — only accept seeds from authenticated internal systems, not arbitrary user input. (2) **Per-domain global rate limit** — regardless of how many URLs exist for a domain, the system-wide crawl rate to any single domain is capped (e.g., 10 req/sec max for ANY domain). (3) **IP reputation** — if a target IP serves error responses to other legitimate crawlers too, it's likely under load — automatic backoff. (4) **Outbound bandwidth monitoring** — alert if any single target is receiving disproportionate traffic from our crawler fleet.

??? question "How would you handle a requirement to crawl the dark web (.onion sites)?"
    **Adapt:** The architecture stays the same, but the network layer changes. (1) Route fetch workers through Tor SOCKS proxies for .onion domains. (2) DNS resolution is unnecessary (Tor handles .onion routing internally). (3) Throughput drops dramatically — Tor circuit setup takes 2-5 seconds per connection, so expect ~5 pages/sec per worker instead of 50. (4) Separate frontier partition for .onion URLs with relaxed politeness (these sites have no robots.txt convention). (5) Additional safety: sandboxed workers with no access to internal infrastructure (`.onion` content may be malicious).

---

## 13. Quick Recall

| Question | Answer |
|---|---|
| Scale? | 1B pages/day, 10K pages/sec, petabytes of content |
| Frontier design? | Two-level: priority queues (importance) → politeness queues (per-domain rate limit) |
| URL dedup? | Bloom filter: 18 GB for 10B URLs, 0.01% false-positive rate |
| Content dedup? | SimHash: 64-bit fingerprint, Hamming distance ≤ 3 = near-duplicate |
| Politeness? | Per-domain crawl delay from robots.txt + adaptive backoff on slow responses |
| Persistence? | Kafka-backed frontier. Worker crash → message redelivered. Zero URL loss. |
| DNS optimization? | Local cache (10 GB, 200M domains), 80% hit rate, 6-24h TTL |
| Storage? | S3/HDFS for raw HTML (500 TB/day). Cassandra for URL metadata (1 TB). |
| Trap detection? | URL length limit + depth limit + per-domain cap + pattern detection + content novelty |
| Recrawl strategy? | Adaptive: track change frequency per URL. News=15min, blogs=7d, static=30d. |
| BFS vs DFS? | BFS — discovers high-value pages first (important pages are shallow in link graph) |
| Workers? | 300-500 nodes, ~50 pages/sec each, partitioned by domain hash |
| Bottleneck? | Network RTT + politeness delay, NOT CPU or disk. Maximize cross-domain parallelism. |
| Robots.txt failure? | Assume most restrictive policy on 5xx. Re-fetch immediately when available. |
| JS-rendered pages? | Headless browser (Chrome) for high-value JS-heavy sites. 10x slower, use selectively. |
| Worker partitioning? | By domain hash — ensures per-domain state (politeness, connections) stays local |
| Failure mode? | Worker crash → Kafka redelivers URL. DNS poisoning → IP validation + DoH. |
