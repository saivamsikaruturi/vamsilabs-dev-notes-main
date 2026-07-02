---
title: "Design a News Feed System — Twitter/Facebook Scale (System Design Interview)"
description: "Design a news feed like Twitter or Facebook — system design interview walkthrough covering fan-out-on-write vs fan-out-on-read, hybrid strategies for celebrity users, timeline ranking, and scaling to billions of users."
---

# News Feed (Twitter/Facebook)

!!! danger "Real Incident: Twitter's Flock Fan-out Meltdown, October 2012"
    When Lady Gaga tweeted to her 31 million followers, Twitter's pure fan-out-on-write system attempted to insert that single tweet into 31 million individual timeline caches simultaneously. The write amplification overwhelmed the Flock social graph service and Redis fleet — timelines went stale for 25+ minutes across the platform. Internal postmortems revealed that **one celebrity tweet generated 31 million cache writes, each requiring a social graph lookup and a sorted-set insertion**. The cascading failure also stalled fan-out for normal users whose tweets queued behind the celebrity storm. Twitter's fix: **hybrid fan-out** — users with >10K followers are excluded from write-time fan-out; their tweets are merged at read time instead. This single architectural change reduced peak write amplification by 90% and eliminated the "celebrity tweet = platform meltdown" failure mode. **The fan-out strategy IS the architecture.**

---

## System Design Concepts Used

`Fan-out on Write` · `Fan-out on Read` · `Hybrid Fan-out` · `Redis Sorted Sets` · `Social Graph (TAO/Neo4j)` · `Message Queue (Kafka)` · `ML Ranking` · `Cursor-based Pagination` · `Content Moderation Pipeline` · `Consistent Hashing` · `Cache-Aside` · `Pub/Sub` · `Trending Detection (Count-Min Sketch)` · `Power Law Distribution` · `Horizontal Scaling`

---

## 1. Functional Requirements

1. **Post content** — text (280 chars Twitter / 63K chars Facebook), images, videos, links with preview cards
2. **Follow/unfollow** — asymmetric (Twitter) or symmetric (Facebook friend) relationships
3. **Generate personalized feed** — ranked, paginated timeline of posts from followed accounts
4. **Engage with posts** — like, comment, share/retweet, bookmark
5. **Celebrity detection** — automatically classify users above a follower threshold for pull-based delivery
6. **Trending topics** — real-time detection of viral content and hashtags
7. **Content moderation** — filter spam, hate speech, misinformation before delivery

## 2. Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Availability** | 99.99% (< 52 min/year) | Global social platform — downtime = front-page news |
| **Feed latency** | < 500ms p99 (feed generation) | User opens app, feed must appear instantly |
| **Write propagation** | < 5s (normal user post visible to followers) | Near-real-time social experience |
| **Consistency** | Eventually consistent (1-2s stale OK) | Cache can serve slightly stale timelines |
| **DAU** | 500M daily active users | Scale of Twitter + Facebook combined |
| **Throughput** | 174K peak feed reads/sec, 23K peak writes/sec | Derived from capacity estimation below |
| **Durability** | Zero post loss | User content is sacred — lost posts = user churn |

---

## 3. Capacity Estimation

```text
/* ━━━ NAPKIN MATH: News Feed at Scale ━━━ */

/* ━━━ USERS & POSTS ━━━ */
DAU:                  500M
Posts per user/day:   2 (average across lurkers and power users)
Total posts/day:      500M × 2 = 1B posts/day
Posts/sec (avg):      1B / 86,400 ≈ 11,574 writes/sec
Posts/sec (peak 2x):  ~23,000 writes/sec

/* ━━━ FEED READS ━━━ */
Feed opens per user/day:    6 (avg user checks feed 6 times)
Total feed reads/day:       500M × 6 = 3B reads/day
Feed reads/sec (avg):       3B / 86,400 ≈ 34,700 reads/sec
Feed reads/sec (peak 5x):  ~174,000 reads/sec  ← must absorb celebrity events

/* ━━━ FAN-OUT MATH ━━━ */
Avg followers per user:     200 (median is ~50, power law skews up)
Normal user post fan-out:   200 Redis ZADD operations per post
Celebrity post (>10K):      0 fan-out writes (merged at read time)
Total fan-out writes/sec:   11,574 × 0.99 × 200 = ~2.3M cache writes/sec
                            (99% of users are "normal", each generates 200 writes)

/* ━━━ STORAGE ━━━ */
Post size (avg):            text(500B) + metadata(200B) + media_refs(100B) = ~800 bytes
Daily post storage:         1B × 800B = 800 GB/day
Monthly post storage:       ~24 TB/month (before compression)
5-year retention:           ~1.4 PB (sharded across Cassandra cluster)

/* ━━━ TIMELINE CACHE (Redis) ━━━ */
Posts cached per user:      800 post IDs (sorted set)
Entry size:                 post_id (8B) + score/timestamp (8B) = 16 bytes per entry
Per-user cache:             800 × 16 = 12.8 KB
Total cache footprint:      500M × 12.8 KB = 6.4 TB Redis
                            → 64 Redis nodes × 100GB each (with replication: 192 nodes)

/* ━━━ SOCIAL GRAPH ━━━ */
Avg edges per user:         400 (200 following + 200 followers)
Total edges:                500M × 400 / 2 = 100B edges
Edge size:                  follower_id(8B) + followee_id(8B) + ts(8B) = 24B
Graph storage:              100B × 24B = 2.4 TB

/* ━━━ BANDWIDTH ━━━ */
Feed response (50 posts):   50 × 800B = 40KB per response
Peak bandwidth (reads):     174K × 40KB = 7 GB/sec outbound
```

!!! note "System Nature"
    **Read-heavy with massive write amplification.** A single post generates 200+ cache writes (fan-out). The architecture must absorb 2.3M cache writes/sec while serving 174K feed reads/sec at sub-500ms latency. The hybrid fan-out strategy is not optional — it is the only viable approach at this scale.

---

## 4. "Why X, Not Y?" — Tradeoff Analysis

### Why hybrid fan-out, not pure push or pure pull?

**Hybrid wins because it eliminates the worst case of both extremes.** Pure push (fan-out-on-write) means a celebrity with 100M followers generates 100M cache writes per tweet — taking minutes and potentially crashing the system. Pure pull (fan-out-on-read) means every feed request must query the post tables of all 200+ followed users, merge-sort them in real-time — giving 500ms+ latency for every single feed open. Hybrid gives you the best of both: 99% of posts are pre-materialized (fast reads), and the 1% from celebrities are merged at read time (cheap writes).

*Pure push advantage:* Simpler architecture, guaranteed sub-10ms reads. Works at small scale (e.g., a startup with no celebrities).

*Pure pull advantage:* Zero write amplification, always fresh data. Works if you can tolerate 500ms+ feed generation (early Facebook used this with heavy caching).

### Why Redis sorted sets, not regular lists for timeline cache?

**Sorted sets give O(log N) insertion with automatic ordering by timestamp score, plus O(log N + K) range queries for pagination.** When merging celebrity posts into a user's timeline at read time, you need efficient insertion at the correct chronological position. A list would require scanning to find the right position (O(N)) or appending and re-sorting (O(N log N)). Sorted sets also support `ZRANGEBYSCORE` for cursor-based pagination — "give me 50 posts with timestamp < cursor" is a single command.

*List advantage:* Slightly less memory (no score storage). Simpler mental model. Use if timelines are always prepended (no out-of-order insertions needed).

### Why Cassandra for posts, not PostgreSQL?

**Cassandra handles 1B inserts/day across hundreds of nodes with linear horizontal scalability, tunable consistency, and no single point of failure.** Posts are write-once, read-many, rarely updated — a perfect fit for Cassandra's LSM-tree storage engine. Partitioning by user_id gives excellent write distribution and enables efficient "get all posts by user X" queries for celebrity pull. PostgreSQL would require complex sharding middleware, and a single shard failure would make 1/N of all posts unreadable.

*PostgreSQL advantage:* Strong consistency, ACID transactions, mature tooling. Use for the social graph where you need atomic follow/unfollow operations. Not for the post store at 1B writes/day.

### Why ML ranking, not pure chronological?

**ML ranking increases engagement by 50%+ (Facebook's reported metrics) because it surfaces posts the user actually cares about rather than the most recent.** A pure chronological feed buries a close friend's post from 3 hours ago under 50 posts from accounts the user rarely interacts with. The ranking model predicts P(engagement) using features like social closeness, content type affinity, recency, and historical interaction patterns.

*Chronological advantage:* No filter bubble, transparent ordering, no algorithmic bias. Twitter offers "Latest Tweets" as a toggle for users who want this. Simpler to implement and debug.

---

## 5. High-Level Architecture

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
      <polygon points="0 0,10 3.5,0 7" fill="#388E3C"/>
    </marker>
    <filter id="sh" x="-3%" y="-3%" width="106%" height="106%">
      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="1100" height="750" fill="#FAFAFA" rx="8"/>

  <!-- Title -->
  <text x="550" y="28" text-anchor="middle" font-size="18" font-weight="800" fill="#212121">News Feed — System Architecture</text>
  <text x="550" y="48" text-anchor="middle" font-size="11" fill="#757575">Hybrid fan-out | 174K reads/sec peak | 2.3M cache writes/sec | &lt;500ms feed generation</text>

  <!-- ═══ LAYER 1: Clients ═══ -->
  <rect x="40" y="60" width="1020" height="60" rx="10" fill="#E3F2FD" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="76" font-size="10" font-weight="600" fill="#9E9E9E">Clients</text>
  <rect x="60" y="82" width="160" height="30" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="140" y="101" text-anchor="middle" font-size="10" font-weight="600" fill="#0D47A1">Mobile App</text>
  <rect x="240" y="82" width="160" height="30" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="320" y="101" text-anchor="middle" font-size="10" font-weight="600" fill="#0D47A1">Web Browser</text>
  <rect x="420" y="82" width="160" height="30" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="500" y="101" text-anchor="middle" font-size="10" font-weight="600" fill="#0D47A1">API Client (POST)</text>
  <rect x="600" y="82" width="160" height="30" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="680" y="101" text-anchor="middle" font-size="10" font-weight="600" fill="#0D47A1">Push Notifications</text>

  <!-- ═══ LAYER 2: CDN + LB ═══ -->
  <line x1="400" y1="120" x2="400" y2="140" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="250" y="140" width="300" height="40" rx="8" fill="#B2EBF2" stroke="#00838F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="400" y="157" text-anchor="middle" font-size="12" font-weight="700" fill="#006064">CDN + API Gateway</text>
  <text x="400" y="172" text-anchor="middle" font-size="9" fill="#757575">Static media delivery | Rate limiting | Auth</text>

  <line x1="400" y1="180" x2="400" y2="198" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <polygon points="400,198 450,218 400,238 350,218" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5"/>
  <text x="400" y="222" text-anchor="middle" font-size="10" font-weight="600" fill="#F57F17">L7 LB</text>

  <!-- ═══ LAYER 3: WRITE PATH (Left) ═══ -->
  <rect x="40" y="250" width="480" height="200" rx="10" fill="#E8F5E9" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="266" font-size="10" font-weight="600" fill="#388E3C">WRITE PATH</text>

  <!-- Post Service -->
  <line x1="350" y1="238" x2="200" y2="280" stroke="#388E3C" stroke-width="1.5" marker-end="url(#ag)"/>
  <text x="260" y="258" font-size="8" fill="#388E3C" font-weight="600">new post</text>
  <rect x="80" y="280" width="240" height="42" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="200" y="297" text-anchor="middle" font-size="11" font-weight="600" fill="#1B5E20">Post Service</text>
  <text x="200" y="313" text-anchor="middle" font-size="9" fill="#757575">Validate | Store | Publish event to Kafka</text>

  <!-- Kafka -->
  <line x1="200" y1="322" x2="200" y2="348" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="100" y="348" width="200" height="36" rx="6" fill="#37474F" stroke="#263238" stroke-width="1.5" filter="url(#sh)"/>
  <text x="200" y="365" text-anchor="middle" font-size="11" font-weight="600" fill="#ECEFF1">Kafka</text>
  <text x="200" y="378" text-anchor="middle" font-size="8" fill="#B0BEC5">post.created topic</text>

  <!-- Fan-out Service -->
  <line x1="200" y1="384" x2="200" y2="408" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="70" y="408" width="260" height="36" rx="6" fill="#FFE0B2" stroke="#F57C00" stroke-width="1.5" filter="url(#sh)"/>
  <text x="200" y="424" text-anchor="middle" font-size="11" font-weight="600" fill="#E65100">Fan-out Service</text>
  <text x="200" y="437" text-anchor="middle" font-size="8" fill="#757575">Check follower count | Decide push vs skip</text>

  <!-- Celebrity decision -->
  <polygon points="430,330 480,355 430,380 380,355" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5"/>
  <text x="430" y="353" text-anchor="middle" font-size="8" font-weight="600" fill="#F57F17">> 10K?</text>
  <text x="430" y="365" text-anchor="middle" font-size="7" fill="#F57F17">followers</text>
  <line x1="320" y1="365" x2="380" y2="358" stroke="#546E7A" stroke-width="1" marker-end="url(#a)"/>
  <text x="488" y="345" font-size="7" fill="#D32F2F" font-weight="600">YES: skip</text>
  <text x="378" y="395" font-size="7" fill="#388E3C" font-weight="600">NO: push</text>

  <!-- ═══ LAYER 3: READ PATH (Right) ═══ -->
  <rect x="560" y="250" width="500" height="200" rx="10" fill="#FCE4EC" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="572" y="266" font-size="10" font-weight="600" fill="#D32F2F">READ PATH</text>

  <!-- Feed Service -->
  <line x1="450" y1="238" x2="720" y2="280" stroke="#D32F2F" stroke-width="1.5" marker-end="url(#ar)"/>
  <text x="600" y="258" font-size="8" fill="#D32F2F" font-weight="600">GET /feed</text>
  <rect x="620" y="280" width="240" height="42" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="740" y="297" text-anchor="middle" font-size="11" font-weight="600" fill="#1B5E20">Feed Service</text>
  <text x="740" y="313" text-anchor="middle" font-size="9" fill="#757575">Read cache + merge celebrity posts</text>

  <!-- Ranking Service -->
  <line x1="740" y1="322" x2="740" y2="348" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="620" y="348" width="240" height="42" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="740" y="365" text-anchor="middle" font-size="11" font-weight="600" fill="#311B92">Ranking Service (ML)</text>
  <text x="740" y="381" text-anchor="middle" font-size="9" fill="#757575">Score = f(engagement, recency, closeness)</text>

  <!-- Social Graph Service -->
  <rect x="880" y="300" width="160" height="42" rx="6" fill="#E8EAF6" stroke="#283593" stroke-width="1.5" filter="url(#sh)"/>
  <text x="960" y="317" text-anchor="middle" font-size="10" font-weight="600" fill="#1A237E">Social Graph</text>
  <text x="960" y="333" text-anchor="middle" font-size="8" fill="#757575">TAO / Neo4j</text>
  <line x1="860" y1="300" x2="880" y2="310" stroke="#546E7A" stroke-width="1" stroke-dasharray="4,3" marker-end="url(#a)"/>

  <!-- Response to user -->
  <line x1="740" y1="390" x2="740" y2="416" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="660" y="416" width="160" height="28" rx="6" fill="#B2DFDB" stroke="#00695C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="740" y="435" text-anchor="middle" font-size="10" font-weight="600" fill="#004D40">Ranked Feed Response</text>

  <!-- ═══ LAYER 4: Data Layer ═══ -->
  <rect x="40" y="470" width="1020" height="120" rx="10" fill="#E8EAF6" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="486" font-size="10" font-weight="600" fill="#9E9E9E">Data Layer</text>

  <!-- Redis Timeline Cache -->
  <rect x="60" y="495" width="250" height="48" rx="8" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="185" y="515" text-anchor="middle" font-size="12" font-weight="700" fill="#B71C1C">Redis Timeline Cache</text>
  <text x="185" y="533" text-anchor="middle" font-size="9" fill="#757575">Sorted set per user | 6.4 TB | 192 nodes</text>
  <line x1="200" y1="444" x2="185" y2="495" stroke="#388E3C" stroke-width="1.5" marker-end="url(#ag)"/>
  <text x="155" y="468" font-size="8" fill="#388E3C">ZADD timeline:{uid}</text>
  <line x1="700" y1="322" x2="185" y2="495" stroke="#D32F2F" stroke-width="1.2" stroke-dasharray="5,3" marker-end="url(#ar)"/>
  <text x="420" y="420" font-size="8" fill="#D32F2F">ZREVRANGEBYSCORE</text>

  <!-- Post Store (Cassandra) -->
  <path d="M380,505 L380,535 C380,548 560,548 560,535 L560,505" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="470" cy="505" rx="90" ry="10" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="470" cy="505" rx="90" ry="10" fill="#283593" opacity="0.1"/>
  <text x="470" y="524" text-anchor="middle" font-size="11" font-weight="600" fill="#1A237E">Post Store</text>
  <text x="470" y="540" text-anchor="middle" font-size="8" fill="#757575">Cassandra (partitioned by user_id)</text>

  <!-- Media Store -->
  <path d="M620,505 L620,535 C620,548 770,548 770,535 L770,505" fill="#B2EBF2" stroke="#00838F" stroke-width="1.5"/>
  <ellipse cx="695" cy="505" rx="75" ry="10" fill="#B2EBF2" stroke="#00838F" stroke-width="1.5"/>
  <text x="695" y="524" text-anchor="middle" font-size="11" font-weight="600" fill="#006064">Media Store</text>
  <text x="695" y="540" text-anchor="middle" font-size="8" fill="#757575">S3 + CDN (images/video)</text>

  <!-- Social Graph DB -->
  <path d="M830,505 L830,535 C830,548 1010,548 1010,535 L1010,505" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="920" cy="505" rx="90" ry="10" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="920" cy="505" rx="90" ry="10" fill="#283593" opacity="0.1"/>
  <text x="920" y="524" text-anchor="middle" font-size="11" font-weight="600" fill="#1A237E">Graph Store</text>
  <text x="920" y="540" text-anchor="middle" font-size="8" fill="#757575">Neo4j / TAO (edges)</text>

  <!-- ═══ LAYER 5: Async Pipeline ═══ -->
  <rect x="40" y="600" width="1020" height="55" rx="10" fill="#FFF3E0" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="616" font-size="10" font-weight="600" fill="#9E9E9E">Async Pipeline</text>
  <rect x="60" y="622" width="200" height="28" rx="6" fill="#FFE0B2" stroke="#F57C00" stroke-width="1.5" filter="url(#sh)"/>
  <text x="160" y="640" text-anchor="middle" font-size="9" font-weight="600" fill="#E65100">Content Moderation</text>
  <rect x="280" y="622" width="200" height="28" rx="6" fill="#FFE0B2" stroke="#F57C00" stroke-width="1.5" filter="url(#sh)"/>
  <text x="380" y="640" text-anchor="middle" font-size="9" font-weight="600" fill="#E65100">Trending Detection</text>
  <rect x="500" y="622" width="200" height="28" rx="6" fill="#FFE0B2" stroke="#F57C00" stroke-width="1.5" filter="url(#sh)"/>
  <text x="600" y="640" text-anchor="middle" font-size="9" font-weight="600" fill="#E65100">Notification Delivery</text>
  <rect x="720" y="622" width="200" height="28" rx="6" fill="#FFE0B2" stroke="#F57C00" stroke-width="1.5" filter="url(#sh)"/>
  <text x="820" y="640" text-anchor="middle" font-size="9" font-weight="600" fill="#E65100">Analytics Aggregation</text>

  <!-- ═══ LEGEND ═══ -->
  <rect x="40" y="670" width="1020" height="35" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="56" y="692" font-size="10" font-weight="700" fill="#757575">Legend:</text>
  <rect x="110" y="683" width="18" height="12" rx="3" fill="#BBDEFB" stroke="#1976D2" stroke-width="1"/>
  <text x="133" y="693" font-size="9" fill="#757575">Client</text>
  <rect x="175" y="683" width="18" height="12" rx="3" fill="#C8E6C9" stroke="#388E3C" stroke-width="1"/>
  <text x="198" y="693" font-size="9" fill="#757575">Service</text>
  <rect x="248" y="683" width="18" height="12" rx="3" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1"/>
  <text x="271" y="693" font-size="9" fill="#757575">Cache</text>
  <rect x="308" y="683" width="18" height="12" rx="3" fill="#FFE0B2" stroke="#F57C00" stroke-width="1"/>
  <text x="331" y="693" font-size="9" fill="#757575">Fan-out/Async</text>
  <rect x="400" y="683" width="18" height="12" rx="3" fill="#37474F" stroke="#263238" stroke-width="1"/>
  <text x="423" y="693" font-size="9" fill="#757575">Queue</text>
  <rect x="463" y="683" width="18" height="12" rx="3" fill="#D1C4E9" stroke="#512DA8" stroke-width="1"/>
  <text x="486" y="693" font-size="9" fill="#757575">ML Service</text>
  <ellipse cx="540" cy="689" rx="10" ry="6" fill="#E8EAF6" stroke="#283593" stroke-width="1"/>
  <text x="556" y="693" font-size="9" fill="#757575">Database</text>
  <line x1="610" y1="689" x2="635" y2="689" stroke="#388E3C" stroke-width="1.5" marker-end="url(#ag)"/>
  <text x="642" y="693" font-size="9" fill="#388E3C">Write path</text>
  <line x1="700" y1="689" x2="725" y2="689" stroke="#D32F2F" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#ar)"/>
  <text x="732" y="693" font-size="9" fill="#D32F2F">Read path</text>
  <polygon points="810,683 820,689 810,695 800,689" fill="#FFF9C4" stroke="#F9A825" stroke-width="1"/>
  <text x="826" y="693" font-size="9" fill="#757575">Decision/LB</text>
</svg>
</div>

---

## 6. Backend Services Explained

### Post Service
The entry point for all user-generated content. Validates post content (length limits, banned words, malformed media references), persists the post to the Cassandra post store (partitioned by user_id for efficient author-page queries), and publishes a `post.created` event to Kafka. This service is stateless and horizontally scaled behind the load balancer. It also triggers the media processing pipeline asynchronously — uploaded images are resized into multiple formats (thumbnail, feed-size, full) and videos are transcoded before CDN delivery.

### Fan-out Service
Consumes `post.created` events from Kafka. For each event, it queries the social graph to get the author's follower list. If the author has fewer than 10,000 followers, it performs fan-out-on-write: for each follower, it executes `ZADD timeline:{follower_id} {timestamp} {post_id}` on the Redis cluster. If the author exceeds the celebrity threshold, it skips fan-out entirely — those posts will be merged at read time. The service is horizontally scaled with consumer groups; each partition is processed by one worker to maintain ordering guarantees per user.

### Feed Service
Handles `GET /feed` requests. Reads the user's pre-computed timeline from Redis (`ZREVRANGEBYSCORE timeline:{user_id} +inf {cursor} LIMIT 0 50`), identifies followed celebrities from the social graph service, fetches their recent posts from the post store, merges them into the cached timeline using a k-way merge sort by timestamp, and passes the merged list to the Ranking Service before returning the final ordered feed to the client.

### Ranking Service
An ML inference service that re-orders the merged feed candidates. For each candidate post, it computes a relevance score using features: P(like), P(comment), P(share), recency decay, content-type affinity (does this user engage more with photos?), social closeness (mutual friends, interaction frequency), and diversity penalty (avoid 5 posts in a row from the same author). The model is a lightweight neural network (or gradient-boosted tree) served via TensorFlow Serving with <20ms p99 latency.

### Social Graph Service
Maintains the follow/friend relationship graph. Built on a TAO-style architecture (Facebook's graph store) or Neo4j for smaller scale. Provides APIs: `getFollowers(user_id)`, `getFollowing(user_id)`, `isCelebrity(user_id)`. The follower list for each user is cached in Redis with a 5-minute TTL. Follow/unfollow operations trigger cache invalidation and asynchronously update the fan-out routing tables.

### Content Moderation Service
Runs asynchronously on every new post. Uses a combination of rule-based filters (regex for banned content, known-spam URLs), ML classifiers (toxicity detection, nudity detection for images), and human review queues for borderline cases. Posts flagged as violations are removed from timeline caches retroactively. This pipeline adds 100-500ms of latency but runs in the background — the post appears in feeds immediately and is removed later if flagged.

### Media Processing Pipeline
Handles image resizing, video transcoding, thumbnail generation, and EXIF stripping. Operates asynchronously — the post is created with placeholder media URLs that resolve once processing completes (typically 2-10 seconds for images, 30-60 seconds for video). Processed media is pushed to S3 with CloudFront distribution for global low-latency delivery.

---

## 7. Architecture Flow — Priya and Ronaldo

### Scenario: Two Posts, Two Paths

**Priya** is a software engineer in Mumbai with 500 followers. **Cristiano Ronaldo** has 100 million followers. Both post at the same time. Watch how the system handles each differently.

### Phase 1 — Priya Posts a Photo (Normal User, Push Path)

**T+0ms:** Priya's phone sends `POST /posts` with a photo and caption "Beautiful sunset from Marine Drive." The request hits the API Gateway, passes auth and rate limiting.

**T+15ms:** Post Service validates the content, generates a Snowflake post_id (`7291847362910`), writes to Cassandra (`INSERT INTO posts ...`), and publishes to Kafka:

```text
Kafka.produce("post.created", {
  post_id: 7291847362910,
  author_id: "priya_123",
  author_followers: 500,    ← below 10K threshold
  timestamp: 1716134400000,
  media: ["s3://bucket/img/7291847362910.jpg"]
})
```

**T+20ms:** Post Service returns `201 Created` to Priya. She sees her post immediately.

**T+25ms:** Fan-out Service consumes the event. Queries social graph: `getFollowers("priya_123")` → returns 500 follower IDs.

**T+30ms — T+80ms:** Fan-out Service executes 500 Redis operations in pipeline batches of 100:

```text
ZADD timeline:follower_001 1716134400000 7291847362910
ZADD timeline:follower_002 1716134400000 7291847362910
... (500 total ZADDs, batched in 5 pipeline calls)
```

**T+80ms:** All 500 followers now have Priya's post in their pre-computed timelines. Total write latency: **80ms from post creation to full propagation.**

```text
Priya (Mumbai) → Post Service → Cassandra + Kafka → Fan-out → 500 Redis ZADDs → done (80ms)
```

### Phase 2 — Ronaldo Posts (Celebrity, Pull Path)

**T+0ms:** Ronaldo posts "Hat trick! What a night!" The same pipeline fires.

**T+15ms:** Post Service writes to Cassandra, publishes to Kafka:

```text
Kafka.produce("post.created", {
  post_id: 7291847362911,
  author_id: "ronaldo_cr7",
  author_followers: 100000000,    ← WAY above 10K threshold
  timestamp: 1716134400000
})
```

**T+20ms:** Fan-out Service consumes the event. Checks `author_followers: 100M > 10K threshold`. **Skips fan-out entirely.** The post exists only in the post store.

```text
Ronaldo → Post Service → Cassandra (1 write) → Fan-out checks → SKIP → done (20ms)
                          ↑ No 100M Redis writes! System stays healthy.
```

**If we had done push:** 100M ZADD operations at 500K ops/sec = **200 seconds** of dedicated Redis write capacity. The platform would stall for ALL users.

### Phase 3 — A Follower Opens Their Feed (Read Path)

**T+0ms:** Rahul (follows both Priya and Ronaldo) opens the app. `GET /feed?cursor=&limit=50`

**T+5ms:** Feed Service reads Rahul's cached timeline: `ZREVRANGEBYSCORE timeline:rahul_456 +inf -inf LIMIT 0 50` → Returns 50 post IDs (including Priya's `7291847362910` which was pre-pushed).

**T+8ms:** Feed Service checks Rahul's followed celebrities (cached in Redis): `["ronaldo_cr7", "taylorswift", "elonmusk"]`

**T+12ms:** Fetches recent posts from each celebrity from Cassandra: `SELECT * FROM posts WHERE user_id = 'ronaldo_cr7' AND created_at > {24h_ago} LIMIT 10`

**T+18ms:** Merges celebrity posts into the timeline using a k-way merge sort (by timestamp). Ronaldo's hat-trick post is now interleaved with the pre-computed timeline.

**T+22ms:** Passes the merged 60 candidates to Ranking Service. ML model scores each post.

**T+40ms:** Ranking Service returns the top 50, re-ordered by relevance. Ronaldo's post ranks #2 (high engagement prediction), Priya's sunset ranks #8 (moderate closeness score).

**T+42ms:** Feed Service returns the ranked feed to Rahul's phone.

```text
Rahul → Feed Service → Redis (cached timeline) + Cassandra (celebrity posts)
      → Merge sort → Ranking ML → Top 50 → Response (42ms total)
```

---

## 8. Failure & Recovery Scenarios

### Fan-out Service Overloaded (Consumer Lag)

**Scenario:** A major global event (World Cup final) causes a 10x spike in posts. Kafka consumer lag grows — fan-out falls behind by 30 seconds.

**Impact:** Normal users' posts appear in followers' feeds 30 seconds late instead of 5 seconds. Feed reads still work (they show slightly stale cached timelines). Celebrity posts are unaffected (they use pull path).

**Mitigation:**
- Auto-scale fan-out consumer instances (Kubernetes HPA on consumer lag metric)
- Degrade gracefully: if lag > 60s, temporarily increase the celebrity threshold from 10K to 5K followers (fewer push writes)
- Kafka partitions are pre-allocated by user_id hash — adding consumers instantly parallelizes work
- **Recovery:** Once lag is cleared, system self-heals. No data loss — Kafka retains events for 7 days.

### Redis Timeline Cache Goes Down (Partial Cluster Failure)

**Scenario:** A Redis node serving 1/64th of timeline cache fails. 8M users lose their pre-computed timelines.

**Impact:** Feed reads for those 8M users fall back to full pull mode — Feed Service queries Cassandra for all followed users' recent posts, merges in memory. Latency increases from 40ms to 300-500ms for affected users.

**Mitigation:**
- Redis Cluster with 3 replicas per shard — if master dies, replica promotes in <5 seconds
- During failover gap: Feed Service detects Redis timeout, falls back to "pull-all" mode (query post store for each followed user's recent posts)
- Timeline cache is reconstructable: run a background fan-out replay from Kafka for affected user partitions
- **Recovery:** New Redis master promotes, fan-out replay re-populates caches within 5 minutes. Users experience degraded (but functional) performance during this window.

### Social Graph Inconsistency (Stale Follower Lists)

**Scenario:** User A unfollows User B, but the social graph cache still has the stale edge. Fan-out continues pushing B's posts to A's timeline.

**Impact:** User A sees posts from someone they unfollowed for up to 5 minutes (cache TTL). Annoying but not catastrophic.

**Mitigation:**
- Unfollow operation immediately invalidates the social graph cache entry (`DEL followers:B` and `DEL following:A`)
- Feed Service applies a client-side filter: before returning feed, cross-check post authors against the user's current following list (authoritative source)
- Retroactive cleanup: a background job periodically scans timelines and removes posts from unfollowed users
- **Recovery:** Cache naturally expires within TTL. Client-side filter prevents exposure within one feed refresh.

### Ranking Service Timeout (ML Model Latency Spike)

**Scenario:** The ML ranking model deploys a new version with a bug causing 2-second inference latency.

**Impact:** If Feed Service waits for ranking, all feed reads timeout (>500ms SLA violated).

**Mitigation:**
- Circuit breaker on Ranking Service calls: if p99 > 100ms for 30 seconds, open circuit
- Fallback: serve feed in reverse-chronological order (skip ranking entirely). Users get a "Latest" feed instead of "For You"
- Canary deployment: new model versions serve only 1% of traffic initially; promote if latency stays healthy
- **Recovery:** Roll back model version (stored in model registry). Circuit breaker closes automatically when latency recovers.

---

## 9. Data Model

```text
/* ━━━ Post Store (Cassandra) — Partitioned by user_id ━━━ */

CREATE TABLE posts (
    user_id     BIGINT,
    post_id     BIGINT,          -- Snowflake ID (embeds timestamp)
    content     TEXT,
    media_urls  LIST<TEXT>,       -- S3 references
    post_type   TEXT,            -- 'text', 'photo', 'video', 'link'
    like_count  COUNTER,
    share_count COUNTER,
    created_at  TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
) WITH CLUSTERING ORDER BY (post_id DESC);
-- Query pattern: "Get recent posts by user X" → partition scan, no scatter

/* ━━━ Timeline Cache (Redis Sorted Sets) ━━━ */

Key:     timeline:{user_id}
Type:    ZSET (sorted set)
Members: post_id (as string)
Score:   Unix timestamp (milliseconds)
Max:     800 entries per user (ZREMRANGEBYRANK to trim)

Example:
  ZADD timeline:rahul_456 1716134400000 "7291847362910"
  ZADD timeline:rahul_456 1716134399000 "7291847362800"
  ...
  ZREVRANGEBYSCORE timeline:rahul_456 +inf 1716048000000 LIMIT 0 50
  → Returns 50 most recent post_ids in Rahul's timeline

/* ━━━ Social Graph (Neo4j or TAO-style) ━━━ */

CREATE TABLE follows (
    follower_id   BIGINT,
    followee_id   BIGINT,
    created_at    TIMESTAMP,
    PRIMARY KEY (follower_id, followee_id)
);
-- Reverse index for fan-out:
CREATE TABLE followers (
    followee_id   BIGINT,
    follower_id   BIGINT,
    PRIMARY KEY (followee_id, follower_id)
);

/* ━━━ User Metadata ━━━ */

CREATE TABLE users (
    user_id        BIGINT PRIMARY KEY,
    username       TEXT,
    follower_count BIGINT,       -- Denormalized, updated async
    is_celebrity   BOOLEAN,      -- follower_count > 10K
    created_at     TIMESTAMP
);

/* ━━━ Celebrity Registry (Redis Hash) ━━━ */

Key:     celebrities
Type:    SET
Members: user_ids with > 10K followers
Usage:   SISMEMBER celebrities "ronaldo_cr7" → 1 (true)
```

---

## 10. Algorithms Under the Hood

### Hybrid Fan-out Decision

```text
function handle_new_post(event):
    post_id = event.post_id
    author_id = event.author_id
    timestamp = event.timestamp

    // Step 1: Check if author is a celebrity
    is_celeb = redis.SISMEMBER("celebrities", author_id)

    if is_celeb:
        // Celebrity path: no fan-out, post lives only in post store
        // Followers will pull it at read time
        log("Skipping fan-out for celebrity: " + author_id)
        return

    // Step 2: Normal user — fan-out on write
    followers = social_graph.getFollowers(author_id)

    // Step 3: Batch ZADD to all follower timelines
    pipeline = redis.pipeline()
    for follower_id in followers:
        pipeline.ZADD("timeline:" + follower_id, timestamp, post_id)
        pipeline.ZREMRANGEBYRANK("timeline:" + follower_id, 0, -801)
        // ↑ Keep only last 800 entries (trim oldest)
    pipeline.execute()

    // Step 4: Metrics
    metrics.increment("fanout.writes", followers.length)
```

### Feed Assembly (Merge Sort + Celebrity Pull)

```text
function get_feed(user_id, cursor, limit=50):
    // Step 1: Read pre-computed timeline from cache
    if cursor == null:
        cursor = "+inf"
    cached_posts = redis.ZREVRANGEBYSCORE(
        "timeline:" + user_id, cursor, "-inf", LIMIT, 0, limit
    )

    // Step 2: Identify followed celebrities
    following = social_graph.getFollowing(user_id)
    celeb_ids = filter(following, id -> redis.SISMEMBER("celebrities", id))

    // Step 3: Fetch recent posts from each celebrity (from post store)
    celeb_posts = []
    for celeb_id in celeb_ids:
        posts = cassandra.query(
            "SELECT post_id, created_at FROM posts
             WHERE user_id = ? AND created_at > ? LIMIT 10",
            celeb_id, now() - 24_HOURS
        )
        celeb_posts.extend(posts)

    // Step 4: Merge cached timeline + celebrity posts (k-way merge by timestamp)
    merged = merge_sorted(cached_posts, celeb_posts, key=timestamp, order=DESC)
    candidates = merged[:limit * 2]  // Take 2x for ranking headroom

    // Step 5: Rank candidates
    ranked = ranking_service.rank(user_id, candidates)

    // Step 6: Return top N with next cursor
    result = ranked[:limit]
    next_cursor = result[-1].timestamp  // For pagination
    return {posts: result, next_cursor: next_cursor}
```

### ML Ranking Score Formula

```text
function compute_rank_score(user, post, author):
    // Feature extraction
    recency = time_decay(now() - post.created_at, half_life=6_HOURS)
    social_closeness = compute_closeness(user, author)
    engagement_pred = predict_engagement(user, post)
    content_affinity = user_content_preference(user, post.type)
    diversity_penalty = same_author_penalty(user.recent_feed, author)

    // Weighted combination (weights learned via A/B testing)
    score = (
        0.35 * engagement_pred +     // P(like) + P(comment) + P(share)
        0.25 * recency +             // Exponential decay
        0.20 * social_closeness +    // Mutual friends, DM frequency, profile visits
        0.15 * content_affinity +    // Photo lover sees photos first
        0.05 * author_quality        // Account age, verification, spam score
    ) * (1.0 - diversity_penalty)    // Penalize 3rd+ post from same author

    return score

function time_decay(age_ms, half_life):
    // Posts lose half their recency score every 6 hours
    return 2 ^ (-age_ms / half_life)

function compute_closeness(user_a, user_b):
    // Edges: mutual follow, DMs, likes on each other's posts, profile visits
    mutual = social_graph.mutual_friends(user_a, user_b)
    interactions = interaction_store.get_count(user_a, user_b, last_30_days)
    return normalize(0.4 * mutual/100 + 0.6 * min(interactions/50, 1.0))
```

### Trending Detection (Count-Min Sketch)

```text
function detect_trending():
    // Sliding window: count hashtag occurrences in last 15 minutes
    // Use Count-Min Sketch for memory-efficient counting
    sketch = CountMinSketch(width=10000, depth=5)

    for event in kafka.consume("post.created", window=15_MINUTES):
        for hashtag in extract_hashtags(event.content):
            sketch.add(hashtag)

    // Compare current counts vs expected (baseline from same hour last week)
    trending = []
    for hashtag in sketch.heavy_hitters(threshold=1000):
        current_rate = sketch.estimate(hashtag)
        baseline = historical_baseline(hashtag, hour_of_day)
        if current_rate > 3 * baseline:  // 3x above normal = trending
            trending.append({hashtag, current_rate, surge_factor: current_rate/baseline})

    return sorted(trending, key=surge_factor, reverse=True)[:20]
```

---

## 11. Scaling Considerations

| Challenge | Solution | Numbers |
|---|---|---|
| 2.3M cache writes/sec (fan-out) | Redis Cluster: 192 nodes, pipeline batching (100 ops/batch) | Each node handles ~12K writes/sec — well within Redis limits |
| 174K feed reads/sec peak | Feed Service scaled to 200+ instances, Redis read replicas | Each instance handles ~900 req/sec |
| Celebrity fan-out storm | Hybrid threshold at 10K followers; pull for celebrities | Eliminates 90% of peak write amplification |
| Social graph queries | Graph cached in Redis (5min TTL), TAO-style edge store | 99% hit rate on follower list lookups |
| Cassandra post store growth (800 GB/day) | Time-based compaction, TTL on posts >1 year, tiered storage (hot/cold) | Hot tier: last 7 days on SSD; cold tier: S3-backed |
| Global latency | Multi-region deployment, Redis per-region, cross-region async replication | Users read from local region; fan-out replicates cross-region |
| Feed freshness vs cost | Adaptive fan-out: inactive users get smaller timelines; active users get priority | Save 40% cache memory by trimming inactive user timelines to 200 entries |
| ML ranking latency | Model quantization (FP32 → INT8), batched inference, circuit breaker fallback | <20ms p99 for scoring 100 candidates |
| Thundering herd (app open after push notification) | Staggered push delivery, read-through cache with probabilistic early refresh | Spread 10M notifications over 30 seconds |

---

## 12. Quick Recall

| Question | Answer |
|---|---|
| Fan-out strategy? | Hybrid: push for users with <10K followers (99% of users), pull for celebrities at read time |
| Why not pure push? | Celebrity with 100M followers = 100M cache writes per post. Takes 200 seconds. Crashes system. |
| Why not pure pull? | Every feed read queries 200+ users' post tables and merge-sorts. 500ms+ latency per open. |
| Why Redis sorted set? | O(log N) insert, O(log N + K) range query, auto-sorted by timestamp score, native LIMIT for pagination |
| Celebrity threshold? | >10K followers. 99% of users are below this. Configurable — can raise during traffic spikes. |
| Timeline cache size? | 800 post IDs per user, 12.8 KB per user, 6.4 TB total across 192 Redis nodes |
| Feed read latency? | ~40ms total: 5ms (cache read) + 12ms (celebrity pull) + 20ms (ML ranking) + 3ms (serialization) |
| Post storage? | Cassandra partitioned by user_id. 800 GB/day. Supports "get recent posts by user X" efficiently. |
| Why Cassandra over Postgres? | 1B writes/day, linear horizontal scale, no single point of failure, partition-key queries only |
| Ranking formula? | 0.35*engagement + 0.25*recency + 0.20*closeness + 0.15*affinity + 0.05*quality, with diversity penalty |
| How does pagination work? | Cursor-based: next_cursor = timestamp of last post in current page. ZREVRANGEBYSCORE with LIMIT. |
| What if Redis is down? | Fall back to full pull mode (query Cassandra for all followed users). Latency degrades to 300-500ms. |
| What if fan-out is lagged? | Feeds show slightly stale content. Auto-scale consumers. No data loss (Kafka retains 7 days). |
| Trending detection? | Count-Min Sketch over 15-min sliding window. Trending = 3x above historical baseline for same hour. |
| Content moderation? | Async pipeline: post appears immediately, removed retroactively if flagged. 100-500ms detection latency. |
