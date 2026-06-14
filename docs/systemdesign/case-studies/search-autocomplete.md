---
description: "Design a search autocomplete system like Google Suggest — system design interview walkthrough covering trie data structures, frequency ranking, exponential decay, offline pipelines, and scaling to 100K QPS."
---

# Search Autocomplete (Google Suggest)

!!! danger "Real Incident: Google Autocomplete Latency Degradation, 2017"
    A routine trie rebuild pushed a malformed frequency index to 30% of Google's autocomplete serving fleet. Suggestions that normally returned in 12ms spiked to 800ms+ as nodes fell back to real-time trie traversal instead of serving precomputed top-K results. Users saw blank suggestion boxes for 47 minutes across North America and Europe. The root cause: the offline pipeline skipped the validation step that confirms every prefix node contains exactly 10 precomputed suggestions. After the incident, Google added checksummed validation gates and a shadow-traffic canary phase before any trie binary goes live. **Autocomplete is a precomputation problem — if your offline pipeline fails, the online path cannot compensate at 100K QPS without catastrophic latency.**

---

## System Design Concepts Used

`Trie (Prefix Tree)` · `Prefix Hashing` · `Frequency Ranking` · `Exponential Decay` · `Offline Aggregation Pipeline` · `Cache Warming` · `Shard by Prefix` · `Personalization Layer` · `Blue-Green Deployment` · `Top-K at Every Node` · `Kafka Streaming` · `MapReduce Batch` · `Client-Side Debounce` · `Horizontal Scaling`

---

## 1. Functional Requirements

1. **Prefix suggestions** — as the user types each character, return the top 10 most relevant completions
2. **Frequency-based ranking** — suggestions ranked by search popularity with recency weighting
3. **Trending support** — newly trending terms surface within 5-15 minutes
4. **Personalization** — user's recent searches boosted in their suggestion list
5. **Multi-language** — support queries in any Unicode script (CJK, Arabic, Cyrillic, etc.)
6. **Content filtering** — suppress offensive, dangerous, or legally restricted suggestions
7. **Spell correction hints** — if prefix has no exact match, suggest closest fuzzy matches

## 2. Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Latency** | < 100ms p99 (end-to-end) | Must feel instant; users type at 150ms/keystroke |
| **Availability** | 99.99% (< 52 min/year) | Autocomplete is the entry point to search — if it fails, users perceive the entire product as down |
| **Throughput** | 100K QPS sustained, 500K burst | 5B searches/day, each generating 3-5 prefix lookups |
| **Freshness** | Trending topics in < 15 min | Breaking news must appear in suggestions quickly |
| **Read-write ratio** | 1000:1 | Overwhelmingly read-heavy; writes only happen in offline pipeline |
| **Consistency** | Eventual (minutes-stale OK) | Slightly outdated suggestions are invisible to users |
| **Memory per node** | < 15 GB (trie replica) | Must fit in a single server's RAM for in-memory serving |

---

## 3. Capacity Estimation

```text
/* ━━━ NAPKIN MATH: Start From Daily Searches ━━━ */
Total searches/day: 5 billion
Avg keystrokes before selection: 4 (user types "pyth" then clicks "python")
Autocomplete requests/day: 5B × 4 = 20 billion prefix lookups/day
QPS (avg): 20B / 86,400 ≈ 230K QPS
QPS (sustained design target): 100K (after client-side debounce + browser cache)
QPS (burst, breaking news): 500K

/* ━━━ WHY 100K NOT 230K? ━━━ */
Client debounce (50ms): eliminates ~30% of keystrokes
Browser cache (5min TTL): absorbs ~50% of remaining (repeated prefixes)
Effective server-side QPS: 230K × 0.7 × 0.5 ≈ 80K → round up to 100K

/* ━━━ STORAGE: TRIE SIZE ━━━ */
Unique search terms (vocabulary): 500 million
Average term length: 20 characters (UTF-8 → ~20 bytes)
Raw text: 500M × 20B = 10 GB
Trie overhead (child pointers, top-K lists per node): ~1.2x text
Top-K per node: each node stores 10 suggestions × 8 bytes (pointer + score) = 80B
Prefix nodes (average depth 10): 500M × 10 = 5B nodes (but sharing reduces to ~2B)
Estimated trie size: 12-15 GB per replica (fits one large instance)

/* ━━━ CACHE SIZE ━━━ */
Short prefixes (length 1-4) cover 95% of lookups
Unique prefixes (len 1-4): 26 + 676 + 17,576 + 456,976 ≈ 475K entries
Per entry: prefix (4B) + 10 suggestions × avg 30B = 304B
Cache size: 475K × 304B ≈ 145 MB (trivial for Redis)
Generous (len 1-6): ~12M entries × 304B ≈ 3.6 GB Redis

/* ━━━ BANDWIDTH ━━━ */
Request size: ~20 bytes (prefix + headers via HTTP/2)
Response size: ~500 bytes (10 suggestions, JSON-compressed)
Inbound: 100K × 20B = 2 MB/sec
Outbound: 100K × 500B = 50 MB/sec
```

!!! note "System Nature"
    **Extreme read-heavy, precomputation-driven.** The online serving path does almost zero computation — it is a pure lookup into precomputed results. All heavy work (frequency aggregation, ranking, trie building) happens in the offline pipeline. The read path must be sub-10ms within the datacenter, with the remaining 90ms budget consumed by network and client rendering.

---

## 4. "Why X, Not Y?" — Tradeoff Analysis

### Why a Trie with precomputed top-K and not ElasticSearch prefix queries?

**Trie wins because it guarantees O(L) lookup time where L is the prefix length (typically 1-6 characters), returning precomputed results in under 1ms.** ElasticSearch prefix queries (`prefix` or `completion` suggester) involve disk I/O, segment merges, and scoring at query time. At 100K QPS with a p99 target of <100ms, ElasticSearch would require massive over-provisioning — a 50-node cluster just for autocomplete. A trie replica fits in 15 GB RAM on a single machine and serves lookups in microseconds.

*ElasticSearch advantage:* Better fuzzy matching out of the box, supports complex ranking models at query time, and requires no custom infrastructure. Use for low-traffic applications (<1K QPS) where operational simplicity matters more than latency.

### Why precomputed results at each trie node and not real-time trie traversal?

**Precomputation eliminates the fan-out problem.** Without precomputed top-K, a prefix query for "p" would need to traverse millions of descendant nodes, sort by frequency, and return the top 10 — an O(N) operation at query time that is impossible at 100K QPS. By storing the top 10 at every prefix node during the offline build phase, the online query is O(L) regardless of how many descendants exist.

*Real-time traversal advantage:* Results are always perfectly fresh (no pipeline delay). Use only if the vocabulary is small (<1M terms) and QPS is low (<5K), such as an internal enterprise search.

### Why in-memory trie replicas and not Redis as the primary store?

**In-memory trie avoids network round-trips and serialization overhead.** A Redis lookup requires network hop (0.2ms) + deserialization. The trie lives in the same process as the serving logic — a prefix lookup is a pointer chase in local RAM (~50 microseconds). At 100K QPS, eliminating network per request saves 20K seconds of cumulative network time per day and removes Redis as a latency bottleneck.

*Redis advantage:* Acts as a shared cache layer across all service instances, enabling instant updates without redeploying trie binaries. We use Redis as a **Layer 2 fallback** (for cache warming and during trie rebuilds), not as the primary serving path.

### Why shard by prefix (first 2 characters) and not by consistent hashing?

**Prefix-based sharding guarantees data locality — all queries for "py*" hit the same shard, enabling efficient subtree caching.** Consistent hashing would scatter prefixes randomly across shards, meaning a single user session (typing "p" → "py" → "pyt" → "pyth") hits 4 different shards. Prefix sharding ensures all those requests hit the same shard, and its local cache stays hot.

*Consistent hashing advantage:* More even distribution if some prefix ranges are hotter than others (e.g., "th" in English is far more common than "zx"). Mitigate hot-prefix skew with virtual shards or split hot prefixes across multiple replicas.

---

## 5. High-Level Architecture

<div class="arch-diagram" style="background: #FAFBFE; border: 2px solid #E2E8F0; border-radius: 14px; padding: 20px; margin: 24px 0; overflow-x: auto; text-align: center;">
<svg viewBox="0 0 1100 820" xmlns="http://www.w3.org/2000/svg" font-family="Inter,system-ui,sans-serif">
  <defs>
    <marker id="a" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#546E7A"/>
    </marker>
    <marker id="ag" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#388E3C"/>
    </marker>
    <marker id="ap" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0,10 3.5,0 7" fill="#512DA8"/>
    </marker>
    <filter id="sh" x="-3%" y="-3%" width="106%" height="106%">
      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="1100" height="820" fill="#FAFAFA" rx="8"/>

  <!-- Title -->
  <text x="550" y="28" text-anchor="middle" font-size="18" font-weight="800" fill="#212121">Search Autocomplete — System Architecture</text>
  <text x="550" y="48" text-anchor="middle" font-size="11" fill="#757575">1000:1 read-write ratio | 100K QPS | &lt;100ms p99 | Two paths: Online Read + Offline Build</text>

  <!-- ═══ LAYER 1: Clients ═══ -->
  <rect x="40" y="60" width="1020" height="65" rx="10" fill="#E3F2FD" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="76" font-size="10" font-weight="600" fill="#9E9E9E">Clients (with debounce + local cache)</text>
  <rect x="60" y="82" width="220" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="170" y="104" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Browser (debounce 50ms)</text>
  <rect x="300" y="82" width="220" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="410" y="104" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Mobile App (cache 5min)</text>
  <rect x="540" y="82" width="220" height="35" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="650" y="104" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Search Bar Widget</text>

  <!-- ═══ LAYER 2: CDN / Edge ═══ -->
  <line x1="400" y1="125" x2="400" y2="148" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="200" y="148" width="420" height="50" rx="8" fill="#B2EBF2" stroke="#00838F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="410" y="168" text-anchor="middle" font-size="13" font-weight="700" fill="#006064">CDN / Edge Cache (CloudFront)</text>
  <text x="410" y="186" text-anchor="middle" font-size="9" fill="#757575">Cache popular prefixes (len 1-3) at edge | 60% hit rate | 5min TTL</text>

  <!-- ═══ LAYER 3: Load Balancer ═══ -->
  <line x1="410" y1="198" x2="410" y2="225" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <text x="430" y="214" font-size="8" fill="#757575">cache miss</text>
  <polygon points="410,225 470,252 410,279 350,252" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5"/>
  <text x="410" y="256" text-anchor="middle" font-size="11" font-weight="600" fill="#F57F17">L7 Load Balancer</text>
  <text x="410" y="270" text-anchor="middle" font-size="8" fill="#F57F17">route by prefix[0:2]</text>

  <!-- ═══ LAYER 4: Trie Service (Online Read Path) ═══ -->
  <line x1="410" y1="279" x2="410" y2="310" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="40" y="310" width="620" height="90" rx="10" fill="#E8F5E9" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="326" font-size="10" font-weight="600" fill="#9E9E9E">Online Read Path (stateless, &lt;10ms per lookup)</text>

  <rect x="60" y="335" width="270" height="55" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="195" y="353" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Trie Service (In-Memory)</text>
  <text x="195" y="370" text-anchor="middle" font-size="9" fill="#757575">Prefix → top-10 precomputed | O(L) lookup</text>
  <text x="195" y="383" text-anchor="middle" font-size="9" fill="#757575">15 GB trie per replica | Sharded by prefix[0:2]</text>

  <rect x="370" y="335" width="270" height="55" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="505" y="353" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Personalization Mixer</text>
  <text x="505" y="370" text-anchor="middle" font-size="9" fill="#757575">Merge global top-K + user recent searches</text>
  <text x="505" y="383" text-anchor="middle" font-size="9" fill="#757575">Boost user history by 1.5x | Client-side storage</text>

  <!-- ═══ Redis Cache (Layer 2 fallback) ═══ -->
  <line x1="195" y1="390" x2="195" y2="425" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <text x="210" y="412" font-size="8" fill="#757575">fallback on rebuild</text>
  <rect x="80" y="425" width="300" height="48" rx="8" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="230" y="445" text-anchor="middle" font-size="12" font-weight="700" fill="#B71C1C">Redis Cache Cluster</text>
  <text x="230" y="461" text-anchor="middle" font-size="9" fill="#757575">prefix → suggestions | 3.6 GB | Warm from offline pipeline</text>

  <!-- ═══ OFFLINE PIPELINE (right side) ═══ -->
  <rect x="690" y="310" width="370" height="240" rx="10" fill="#EDE7F6" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="702" y="326" font-size="10" font-weight="600" fill="#9E9E9E">Offline Build Pipeline (every 15 min - 1 hour)</text>

  <rect x="710" y="340" width="190" height="38" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="805" y="358" text-anchor="middle" font-size="11" font-weight="600" fill="#311B92">Search Logs (Kafka)</text>
  <text x="805" y="372" text-anchor="middle" font-size="8" fill="#757575">5B events/day</text>

  <line x1="805" y1="378" x2="805" y2="398" stroke="#512DA8" stroke-width="1.2" marker-end="url(#ap)"/>

  <rect x="710" y="398" width="190" height="38" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="805" y="416" text-anchor="middle" font-size="11" font-weight="600" fill="#311B92">Frequency Aggregator</text>
  <text x="805" y="430" text-anchor="middle" font-size="8" fill="#757575">MapReduce + decay scoring</text>

  <line x1="805" y1="436" x2="805" y2="456" stroke="#512DA8" stroke-width="1.2" marker-end="url(#ap)"/>

  <rect x="710" y="456" width="190" height="38" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="805" y="474" text-anchor="middle" font-size="11" font-weight="600" fill="#311B92">Trie Builder</text>
  <text x="805" y="488" text-anchor="middle" font-size="8" fill="#757575">Build + validate + serialize</text>

  <line x1="805" y1="494" x2="805" y2="514" stroke="#512DA8" stroke-width="1.2" marker-end="url(#ap)"/>

  <rect x="710" y="514" width="190" height="28" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="805" y="533" text-anchor="middle" font-size="10" font-weight="600" fill="#311B92">Canary + Blue-Green Deploy</text>

  <!-- Arrow from pipeline to trie service -->
  <line x1="710" y1="528" x2="330" y2="365" stroke="#512DA8" stroke-width="1.5" stroke-dasharray="5,3" marker-end="url(#ap)"/>
  <text x="490" y="440" font-size="8" fill="#512DA8">new trie binary pushed</text>

  <!-- Arrow from pipeline to Redis -->
  <line x1="710" y1="480" x2="380" y2="445" stroke="#512DA8" stroke-width="1.2" stroke-dasharray="5,3" marker-end="url(#ap)"/>
  <text x="540" y="470" font-size="8" fill="#512DA8">warm cache</text>

  <!-- ═══ Trending Fast Path ═══ -->
  <rect x="920" y="340" width="120" height="80" rx="6" fill="#FFF3E0" stroke="#E65100" stroke-width="1.5" filter="url(#sh)"/>
  <text x="980" y="360" text-anchor="middle" font-size="10" font-weight="600" fill="#BF360C">Trending</text>
  <text x="980" y="375" text-anchor="middle" font-size="10" font-weight="600" fill="#BF360C">Fast Path</text>
  <text x="980" y="392" text-anchor="middle" font-size="8" fill="#757575">Flink stream</text>
  <text x="980" y="404" text-anchor="middle" font-size="8" fill="#757575">5min window</text>
  <text x="980" y="416" text-anchor="middle" font-size="8" fill="#757575">→ Redis hot inject</text>

  <!-- ═══ LEGEND ═══ -->
  <rect x="40" y="570" width="1020" height="35" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="56" y="592" font-size="10" font-weight="700" fill="#757575">Legend:</text>
  <rect x="110" y="583" width="18" height="12" rx="3" fill="#BBDEFB" stroke="#1976D2" stroke-width="1"/>
  <text x="133" y="593" font-size="9" fill="#757575">Client</text>
  <rect x="175" y="583" width="18" height="12" rx="3" fill="#B2EBF2" stroke="#00838F" stroke-width="1"/>
  <text x="198" y="593" font-size="9" fill="#757575">CDN</text>
  <polygon points="258,583 268,589 258,595 248,589" fill="#FFF9C4" stroke="#F9A825" stroke-width="1"/>
  <text x="274" y="593" font-size="9" fill="#757575">LB</text>
  <rect x="302" y="583" width="18" height="12" rx="3" fill="#C8E6C9" stroke="#388E3C" stroke-width="1"/>
  <text x="325" y="593" font-size="9" fill="#757575">Online Service</text>
  <rect x="405" y="583" width="18" height="12" rx="3" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1"/>
  <text x="428" y="593" font-size="9" fill="#757575">Cache</text>
  <rect x="470" y="583" width="18" height="12" rx="3" fill="#D1C4E9" stroke="#512DA8" stroke-width="1"/>
  <text x="493" y="593" font-size="9" fill="#757575">Offline Pipeline</text>
  <rect x="580" y="583" width="18" height="12" rx="3" fill="#FFF3E0" stroke="#E65100" stroke-width="1"/>
  <text x="603" y="593" font-size="9" fill="#757575">Trending</text>
  <line x1="660" y1="589" x2="685" y2="589" stroke="#546E7A" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="692" y="593" font-size="9" fill="#757575">Data flow</text>
  <line x1="745" y1="589" x2="770" y2="589" stroke="#512DA8" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#ap)"/>
  <text x="777" y="593" font-size="9" fill="#757575">Offline/async</text>
</svg>
</div>

---

## 6. Backend Services Explained

### Trie Service (Online Read Path)
The most critical service — handles 100% of user-facing autocomplete requests. Each instance loads a complete trie shard into memory (sharded by `prefix[0:2]`, so shard "py" handles all queries starting with "py"). A lookup traverses the trie from root to the prefix node in O(L) time and returns the precomputed top-10 list. Completely **stateless** in terms of user context — personalization is mixed in by the Personalization Mixer after the trie lookup.

### Personalization Mixer
A lightweight service (or in-process module) that merges the global top-10 from the Trie Service with the user's recent search history. User history is stored **client-side** (localStorage/cookie, encrypted) and sent with each request. The mixer boosts matching terms by 1.5x score and re-ranks. This avoids storing per-user data server-side while still delivering personalized results.

### Redis Cache Cluster
Serves as the **fallback layer** during trie rebuilds and as the warm cache for CDN edge population. The offline pipeline writes all prefix→suggestions mappings to Redis after each build cycle. If a Trie Service instance is restarting or loading a new binary, the load balancer routes to Redis temporarily.

### Offline Frequency Aggregator
A MapReduce/Spark job that runs every 15 minutes to 1 hour. Consumes search logs from Kafka, applies exponential decay to historical frequencies, aggregates per-term scores, and outputs a sorted vocabulary ready for trie building.

### Trie Builder
Takes the scored vocabulary from the Aggregator and constructs a serialized trie binary. At each node, it stores the top-10 suggestions from all descendants (precomputed via a bottom-up traversal). The output is a validated, checksummed binary file deployed via blue-green swap.

### Trending Fast Path (Flink)
A streaming pipeline that detects sudden frequency spikes (e.g., a breaking news term goes from 10 searches/min to 100K/min). It injects trending terms directly into Redis with a short TTL (5 min), bypassing the slower batch pipeline. The Trie Service checks Redis for trending overlays before returning results.

---

## 7. Architecture Flow — User Types "python"

A developer named **Priya** in Bangalore opens Google and begins typing a search query. Her fingers hit: `p` → `py` → `pyt` → `pyth` → `pytho` → `python`. Here is what happens at each keystroke.

### Keystroke 1 — "p" (T+0ms)

**T+0ms:** Priya types "p". The browser's JavaScript debounce timer starts (50ms).

**T+50ms:** Debounce fires. Browser checks local cache: no entry for "p" (first search of the session). Sends `GET /autocomplete?q=p` to CDN.

**T+55ms:** CDN cache **HIT** (prefix "p" is one of 26 single-character prefixes, always cached). Returns cached response:

```text
["python", "pizza near me", "paypal login", "pinterest", "prime video",
 "phone number lookup", "papa johns", "people finder", "pandora", "publix"]
```

**T+60ms:** Browser renders dropdown. Total perceived latency: **10ms** (from debounce fire to render).

```text
Priya → debounce(50ms) → CDN (hit) → response (5ms) → render
```

### Keystroke 2 — "py" (T+150ms)

**T+150ms:** Priya types "y" (average inter-keystroke interval is 100-200ms). Debounce resets.

**T+200ms:** Debounce fires. Browser checks local cache: no entry. Sends `GET /autocomplete?q=py`.

**T+205ms:** CDN cache **MISS** for "py" (less common 2-char prefix). Forwards to origin.

**T+210ms:** Load Balancer routes to Trie Service shard "py" (based on first 2 chars).

**T+211ms:** Trie Service traverses: root → 'p' → 'py'. Returns precomputed top-10 at node "py":

```text
["python", "python tutorial", "python download", "pypi",
 "python for beginners", "python ide", "python list", "python dictionary",
 "python install", "python string methods"]
```

**T+212ms:** Personalization Mixer checks Priya's history cookie: she searched "python asyncio" yesterday. Boosts "python asyncio" into position 5, displacing "python install".

**T+215ms:** Response sent. CDN caches for 5 minutes. Browser renders.

```text
Priya → debounce → CDN (miss) → LB → Trie shard "py" → Mixer → response (15ms) → CDN caches
```

### Keystroke 3 — "pyth" (T+400ms)

**T+400ms:** Priya types "t" then quickly "h". Browser debounce groups them.

**T+450ms:** Sends `GET /autocomplete?q=pyth`. CDN miss → LB → Trie shard "py".

**T+452ms:** Trie traversal: root → p → py → pyt → pyth. Returns top-10 from node "pyth":

```text
["python", "python tutorial", "python download", "pythagoras theorem",
 "python 3.12", "python asyncio", "python pandas", "python flask",
 "python machine learning", "python vs java"]
```

**T+455ms:** Response returned. At this point Priya sees exactly what she wants ("python tutorial") and clicks it.

### Keystroke 4 — Selection (T+600ms)

**T+600ms:** Priya clicks "python tutorial". Browser sends full search query. The autocomplete system logs this selection event to Kafka for future frequency updates.

```text
Kafka.produce("search_events", {
  query: "python tutorial",
  prefix_at_selection: "pyth",
  timestamp: "2026-06-07T09:15:23Z",
  user_geo: "IN-KA",
  device: "desktop"
})
```

This event will be consumed by the Frequency Aggregator in the next pipeline run, incrementing the score for "python tutorial" at all its prefix nodes.

---

## 8. Failure & Recovery Scenarios

### Trie Service Crash (One Shard Down)

**Impact:** All queries for prefixes starting with that shard's 2-char range (e.g., "py" shard handles "py*") get no trie results.

**Mitigation:** Each shard has 3 replicas. If one instance dies, the load balancer routes to surviving replicas (health check removes unhealthy instance in <5s). If ALL replicas of a shard die simultaneously, the system falls back to Redis cache — which was warmed by the last pipeline run. Results may be up to 1 hour stale, but users get suggestions.

**Recovery:** Kubernetes auto-restarts the pod, which loads the latest trie binary from blob storage (~30s for 15 GB mmap load). During this window, Redis serves.

### Offline Pipeline Fails (Bad Trie Build)

**Impact:** No new trie binary is produced. Trending terms stop surfacing. Existing trie continues serving (it is immutable once loaded).

**Mitigation:** The pipeline has a validation gate: the new trie must (1) contain >95% of the previous trie's vocabulary, (2) every prefix node must have exactly 10 suggestions, (3) a shadow traffic canary must show p99 < 100ms. If validation fails, the old trie stays in production and an alert fires.

**Recovery:** On-call engineer fixes the pipeline (usually a data quality issue in search logs). Next pipeline run produces a valid trie. No user impact during the gap — suggestions simply stop evolving.

### Redis Cluster Goes Down

**Impact:** Minimal in steady state — Redis is Layer 2 fallback, not the primary serving path. Trending fast-path injection stops working (trending terms won't surface until the next full trie rebuild).

**Mitigation:** Redis Cluster with 3 replicas per shard. Automatic failover in <5s. During total Redis outage, the system degrades gracefully: trie serves all requests (slightly higher latency for CDN-miss queries that used to hit Redis), and trending terms are delayed.

### Cascading Failure During Breaking News

**Impact:** A massive global event (e.g., earthquake, election result) drives 10x normal QPS. All users type the same prefix simultaneously.

**Mitigation:** The CDN absorbs the burst — since everyone is typing the same prefix, CDN hit rate approaches 99%. Even if CDN TTL expires, the trie handles 500K QPS across all shards (each shard needs to handle ~750 QPS for a single hot prefix, trivial for in-memory lookup). The Trending Fast Path detects the spike within 5 minutes and injects the trending term into Redis/CDN with elevated priority.

---

## 9. Data Model

```text
/* ━━━ Trie Binary Format (serialized, mmap-loaded) ━━━ */

Header:
  magic_number:     4 bytes ("TRIE")
  version:          4 bytes
  checksum:         32 bytes (SHA-256)
  node_count:       8 bytes
  vocabulary_size:  8 bytes
  build_timestamp:  8 bytes

Node (variable length):
  char:             2 bytes (UTF-16 for Unicode support)
  num_children:     1 byte
  child_offsets:    num_children × 4 bytes (relative offset in file)
  num_suggestions:  1 byte (always 10 in production)
  suggestions:      num_suggestions × SuggestionEntry

SuggestionEntry:
  term_offset:      4 bytes (pointer into string table)
  score:            4 bytes (fixed-point frequency score)

String Table (at end of file):
  All suggestion strings, null-terminated, deduplicated
```

```text
/* ━━━ Redis — Cache Schema ━━━ */

// Global prefix suggestions (warmed by pipeline)
SET prefix:p     '["python","pizza near me","paypal",...]' EX 3600
SET prefix:py    '["python","python tutorial",...]' EX 3600
SET prefix:pyth  '["python","pythagoras",...]' EX 3600

// Trending overlay (injected by Flink fast path)
SET trending:elect '["election results 2026","electoral college",...]' EX 300

// Pipeline metadata
SET trie:build:latest  '{"version":"v2026-06-07-0915","checksum":"a3f2...","shards":676}' 
```

```text
/* ━━━ Kafka — Search Events Schema ━━━ */

Topic: search_events
Partition key: query[0:2] (co-located with trie shards)

Event schema (Avro):
{
  "query": "python tutorial",
  "prefix_at_selection": "pyth",
  "timestamp": 1749283523000,
  "user_id": "anon_hash_abc123",    // hashed, not PII
  "geo": "IN-KA",
  "device": "desktop",
  "session_id": "sess_xyz789"
}
```

```text
/* ━━━ Frequency Store (used by Aggregator) ━━━ */

-- Stored in a columnar format (Parquet on S3 or ClickHouse)
CREATE TABLE search_frequencies (
    term         String,
    frequency    Float64,          -- decayed score (not raw count)
    raw_count_7d UInt64,           -- raw searches in last 7 days
    raw_count_1d UInt64,           -- raw searches in last 24 hours
    last_seen    DateTime,
    category     LowCardinality(String),  -- 'normal', 'trending', 'blocked'
    updated_at   DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY term;
```

---

## 10. Algorithms Under the Hood

### Trie Lookup with Precomputed Top-K

```text
function getSuggestions(prefix):
    node = root
    for char in prefix:
        if char not in node.children:
            return []                    // no match — trigger fuzzy fallback
        node = node.children[char]
    return node.topSuggestions           // O(L) — precomputed, no traversal
```

At build time, the top-K at each node is computed via **bottom-up aggregation**:

```text
function buildTopK(node):
    // Leaf node: its own term is the only suggestion
    if node.isTerminal:
        candidates = [(node.term, node.score)]
    else:
        candidates = []
    
    // Gather top-K from all children
    for child in node.children:
        buildTopK(child)
        candidates.extend(child.topSuggestions)
    
    // Keep only top 10 by score
    node.topSuggestions = heapSelect(candidates, k=10)
```

### Exponential Decay Scoring

Raw search frequency is not enough — a term searched 1 million times 3 years ago should rank below a term searched 50K times today. We apply exponential decay:

```text
score(term) = SUM over all searches of: weight(search)

weight(search) = e^(-lambda * hours_since_search)

where lambda = ln(2) / half_life_hours

/* ━━━ Example with half_life = 168 hours (1 week) ━━━ */
lambda = ln(2) / 168 = 0.00413

A search 1 hour ago:   e^(-0.00413 × 1)   = 0.996  (nearly full weight)
A search 1 day ago:    e^(-0.00413 × 24)   = 0.905  (90.5% weight)
A search 1 week ago:   e^(-0.00413 × 168)  = 0.500  (half weight)
A search 1 month ago:  e^(-0.00413 × 720)  = 0.052  (5% weight — nearly forgotten)
```

This means the trie naturally favors recent searches. During the aggregation pipeline, each search event contributes its decayed weight to its term's total score. The formula can be efficiently computed incrementally:

```text
/* Incremental update (no need to re-sum all history) */
new_score = old_score × e^(-lambda × hours_since_last_update) + new_event_weight
```

### Shard Routing by Prefix

```text
/* 676 shards: "aa" through "zz" (first 2 chars, lowercased) */
function routeToShard(prefix):
    key = prefix[0:2].toLowerCase()
    if key.length < 2:
        key = key.padRight(2, 'a')       // "p" → "pa" shard (handles all p*)
    shard_id = (ord(key[0]) - ord('a')) × 26 + (ord(key[1]) - ord('a'))
    return shard_id                       // 0 to 675

/* Special handling for non-alpha prefixes */
function routeNonAlpha(prefix):
    // Numeric prefixes: shards 676-685 (0-9)
    // CJK: hash-based routing to dedicated CJK shards
    // Emoji: single shard (low volume)
```

### Client-Side Debounce + Caching

```text
/* Browser-side optimization (reduces server QPS by ~65%) */

let debounceTimer = null
let cache = new Map()  // prefix → {suggestions, timestamp}

function onKeyPress(inputValue):
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
        fetchSuggestions(inputValue)
    }, 50)  // 50ms debounce — fires after user pauses typing

function fetchSuggestions(prefix):
    // Check local cache (5 min TTL)
    cached = cache.get(prefix)
    if cached && (now - cached.timestamp) < 300_000:
        renderSuggestions(cached.suggestions)
        return
    
    // Also check: if we have cached results for a shorter prefix,
    // we can filter client-side (e.g., "pyt" results contain "python",
    // which is still valid for "pyth")
    for len = prefix.length - 1; len >= 1; len--:
        shorter = prefix.substring(0, len)
        cached = cache.get(shorter)
        if cached:
            filtered = cached.suggestions.filter(s => s.startsWith(prefix))
            if filtered.length >= 5:
                renderSuggestions(filtered)
                return  // avoid network call entirely

    // Cache miss — call server
    response = await fetch(`/autocomplete?q=${prefix}`)
    cache.set(prefix, {suggestions: response.data, timestamp: now})
    renderSuggestions(response.data)
```

### Blue-Green Trie Deployment

```text
/* Zero-downtime trie replacement */

State machine per shard:
  SERVING_BLUE  → loading green in background
  BOTH_LOADED   → canary traffic (5%) to green
  CANARY_PASS   → swap: green becomes primary, blue becomes standby
  SERVING_GREEN → ready for next cycle

function deployNewTrie(shard_id, new_binary_path):
    // Step 1: Load new trie in background (mmap, ~30s for 15GB)
    green_trie = mmap(new_binary_path)
    validate(green_trie)  // checksum + node count + sample queries
    
    // Step 2: Canary (5% traffic for 5 minutes)
    router.setWeight(shard_id, {blue: 95, green: 5})
    wait(5_minutes)
    if green_trie.p99 > 100ms || green_trie.error_rate > 0.1%:
        router.setWeight(shard_id, {blue: 100, green: 0})
        alert("Canary failed for shard " + shard_id)
        return ROLLBACK
    
    // Step 3: Full swap
    router.setWeight(shard_id, {blue: 0, green: 100})
    unmap(blue_trie)  // free memory
    return SUCCESS
```

---

## 11. Scaling Considerations

| Challenge | Solution | Numbers |
|---|---|---|
| 100K QPS sustained | Prefix-sharded trie across 676 shards, each handling ~150 QPS | 3 replicas per shard = 2,028 instances total |
| Viral/trending prefix (all users type same thing) | CDN caches popular prefixes; single shard handles 50K QPS trivially (in-memory) | CDN absorbs 95%+ during spikes |
| Trie memory (15 GB per shard) | Each shard holds only its prefix range (~22 MB avg), full trie partitioned | Total cluster memory: 2,028 × 22 MB = ~45 GB active |
| Trie staleness | Pipeline runs every 15 min; Trending Fast Path injects in 5 min | Balance freshness vs build cost |
| Global latency | CDN caches short prefixes at 200+ edge PoPs worldwide | Edge-served = 5ms; origin-served = 50ms |
| Multi-language (CJK has no word boundaries) | Dedicated CJK shards with character n-gram tokenization | Separate trie per language family |
| Memory pressure during rebuild | Blue-green: only 2x memory needed briefly during swap | 30s window of double memory |
| Hot shard ("th" prefix in English) | Split hot shards into sub-shards ("tha"-"thm", "thn"-"thz") | Monitor per-shard QPS, auto-split above threshold |

---

## 12. What If the Interviewer Pushes Back?

??? question "What if the trie doesn't fit in memory on a single machine?"
    **Adapt:** Partition the trie by prefix depth. Keep only the top 3 levels (length 1-3 prefixes, ~475K nodes) in a hot tier that fits any machine. For deeper prefixes (length 4+), use a distributed trie with each server owning a subtree. Alternatively, use a compressed trie (Patricia trie/radix tree) that merges single-child chains — this typically reduces memory by 60-70%.

??? question "How do you handle personalization without storing user data server-side?"
    **Defend:** Personalization data lives **client-side** — the browser stores the user's last 50 searches in an encrypted cookie or localStorage. On each autocomplete request, the client sends a compact bloom filter of recent queries (50 queries × 10 bytes = 500 bytes). The Personalization Mixer checks incoming global suggestions against this bloom filter and boosts matches. Zero PII stored on our servers, GDPR-compliant by design.

??? question "15 minutes is too slow for trending. What if a celebrity dies and you need it in 30 seconds?"
    **Adapt:** Add a real-time tier. A Flink streaming job with a 30-second tumbling window detects terms whose frequency exceeds 10x their historical baseline. These are injected directly into the CDN edge cache (via cache invalidation API) and Redis. The trie itself isn't updated — instead, the serving layer merges trie results with a "trending overlay" from Redis. This hybrid approach gets trending terms live in <60 seconds without rebuilding the trie.

??? question "What about abusive/offensive autocomplete suggestions?"
    **Defend:** Three layers of defense: (1) A blocklist of 500K+ known-bad terms/patterns is applied during trie build — these terms are never inserted into the trie. (2) A lightweight toxicity classifier runs on all new terms entering the vocabulary — anything scoring above threshold is quarantined for human review. (3) A real-time feedback loop: if users report a suggestion, it's added to the blocklist within minutes via the Trending Fast Path (inject a "block" signal instead of a "suggest" signal).

??? question "How do you handle the cold-start problem — new user, no history, rare prefix?"
    **Defend:** For new users, global popularity ranking serves perfectly well — most people want the same popular completions. For rare/long prefixes with no precomputed results (e.g., "python asyncio gather timeout"), the system has a fallback path: query ElasticSearch with a prefix match on the full search corpus. This is slower (20-50ms) but only triggered for the 1% of queries that miss the trie. The result is cached in Redis for future requests with the same prefix.

??? question "676 shards seems like a lot of infrastructure. Can you reduce it?"
    **Adapt:** Absolutely. 676 shards is the theoretical maximum — in practice, you coalesce low-traffic shards. Shards "zx", "zq", "qx" might handle <1 QPS each; combine them into a single "rare prefix" shard. A production deployment might use 50-100 physical shards (each handling multiple prefix ranges) with 3 replicas each = 150-300 instances. That's reasonable for a service handling 100K QPS at Google scale.

---

## 13. Quick Recall

| Question | Answer |
|---|---|
| Core data structure? | Trie with precomputed top-10 at every prefix node |
| Why not ElasticSearch? | ES requires disk I/O + scoring at query time; trie is O(L) in-memory lookup |
| Lookup complexity? | O(L) where L = prefix length (typically 1-6 chars) |
| How are results ranked? | Exponential decay on search frequency (half-life = 1 week) |
| Freshness guarantee? | Batch pipeline: 15 min. Trending fast path: <60 seconds |
| Sharding strategy? | By first 2 characters of prefix (676 logical shards) |
| Personalization storage? | Client-side (cookie/localStorage), bloom filter sent with request |
| Cache layers? | Browser (5min) → CDN (5min) → Redis (1hr) → Trie (in-memory) |
| Trie size? | ~15 GB total, ~22 MB per shard after partitioning |
| Deployment strategy? | Blue-green with canary traffic (5% for 5 min, then full swap) |
| Failure mode? | Trie crash → Redis serves stale results. Pipeline failure → old trie stays live. |
| Client optimization? | 50ms debounce + local cache + client-side prefix filtering |
| QPS handling? | CDN absorbs 60%, debounce removes 30%, trie serves remaining 100K QPS |
| Vocabulary size? | 500M unique terms, rebuilt every 15 min with decay scoring |
