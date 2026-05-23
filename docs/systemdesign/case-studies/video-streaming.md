# Video Streaming Platform (YouTube / Netflix)

!!! danger "Real Incident: YouTube Global Outage, October 16, 2018"
    At 9:10 PM ET, YouTube went completely dark worldwide for 90 minutes. Every video returned a blank page or a monkey holding a wrench. The outage impacted 1.9 billion monthly active users across YouTube, YouTube TV, YouTube Music, and Google-served video ads. The root cause was a bug in YouTube's internal traffic management system that caused servers to incorrectly route all requests to a non-existent backend pool. Because YouTube serves over 500 million hours of video daily and accounts for approximately 15% of global internet traffic, the outage caused a measurable 4% dip in global internet traffic according to multiple ISPs. Recovery required a manual rollback of the configuration change, but the cascading effects (CDN cache invalidation storms, client retry amplification, cold-start thundering herds) extended the resolution window well beyond what a simple rollback should have taken. **Lesson: When your system IS the internet for 15% of traffic, even a single misconfiguration in the control plane cascades into a global catastrophe. Defense-in-depth must include canary deployments for configuration changes, not just code.**

---

## System Design Concepts Used

`adaptive bitrate streaming` `CDN edge caching` `chunked/resumable upload` `async job queues` `transcoding pipelines` `object storage` `content-based routing` `consistent hashing` `eventual consistency` `collaborative filtering` `full-text search` `sharding` `replication` `DRM/encryption` `HLS/DASH protocols` `pre-computed recommendations` `write-behind caching` `circuit breakers` `rate limiting` `horizontal auto-scaling`

---

## Functional Requirements

1. **Video Upload** - Creators upload videos up to 12 hours long (256 GB max) via chunked, resumable uploads with progress tracking
2. **Video Transcoding** - Uploaded videos are automatically transcoded into 8+ resolution/codec combinations (144p through 4K, H.264/H.265/VP9/AV1)
3. **Adaptive Bitrate Streaming** - Viewers watch videos with seamless quality switching based on real-time network conditions using HLS or DASH
4. **Video Search** - Full-text search across titles, descriptions, tags, captions, and auto-generated transcripts with ranked results
5. **Personalized Recommendations** - Home feed and "Up Next" suggestions powered by collaborative filtering, watch history, and content embeddings
6. **Social Engagement** - Comments, likes/dislikes, subscriptions, live chat during premieres, and community posts
7. **Video Analytics** - Real-time view counts, audience retention graphs, traffic source breakdown for creators
8. **Content Moderation** - Automated detection of copyright violations (Content ID), harmful content, and policy violations before publishing

---

## Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Availability** | 99.99% (52 min downtime/year) | YouTube accounts for 15% of global internet traffic; even minutes of downtime affect billions |
| **Video Start Latency** | < 2 seconds (p99) | Users abandon videos with > 2s start time; every 100ms delay loses 1% of viewers |
| **Rebuffer Rate** | < 0.5% of watch time | Rebuffering is the #1 predictor of viewer churn; must be near-zero |
| **Upload-to-Playable** | < 10 minutes for 1080p, < 60 min for 4K | Creators expect fast turnaround; competitors offer "instant" short-form posting |
| **Global Reach** | < 50ms latency to nearest CDN PoP for 95% of users | Must serve 200+ countries; edge presence in all major metros |
| **Throughput** | 170 Tbps peak egress bandwidth | Prime-time concurrent viewership requires massive CDN capacity |
| **Durability** | 99.999999999% (11 nines) for uploaded content | Losing a creator's original content is unrecoverable and destroys trust |
| **Consistency** | Eventual (< 5s) for view counts; strong for uploads | Users accept slightly stale counts; they do NOT accept "video not found" after upload |

---

## Capacity Estimation

```
=== YouTube-Scale Video Streaming — Napkin Math ===

DAU:                    500 million
Video views/day:        1 billion (2 views/user avg)
Peak concurrent streams: 1B / 86400 * 3x peak factor = ~35,000 concurrent streams per second
Avg session duration:   40 minutes

=== Upload Volume ===
Videos uploaded/minute:      500 hours of content
Avg video length:            7 minutes
Videos/day:                  (500 * 60 / 7) * 1440 = ~6.2 million videos/day
Avg raw file size (1080p):   ~1.5 GB per hour → ~175 MB per 7-min video
Raw upload storage/day:      6.2M * 175 MB = ~1.1 PB/day (raw)

=== Transcoding Output ===
Renditions per video:        8 (144p, 240p, 360p, 480p, 720p, 1080p, 1440p, 4K)
Avg total output per video:  ~500 MB (all renditions combined, compressed)
Transcoded storage/day:      6.2M * 500 MB = ~3.1 PB/day
Total new storage/day:       ~4.2 PB/day (raw + transcoded)
Cumulative storage:          100+ PB (years of content)

=== Bandwidth ===
Avg bitrate per stream:      5 Mbps (weighted avg across resolutions)
Peak concurrent viewers:     ~35 million simultaneous
Peak bandwidth:              35M * 5 Mbps = ~170 Tbps
CDN cache hit ratio:         95%+ (popular content, long-tail from origin)
Origin bandwidth:            170 Tbps * 5% = ~8.5 Tbps origin egress

=== CDN Infrastructure ===
Global PoPs:                 200+ edge locations
Avg PoP capacity:            ~1 Tbps
Storage per PoP:             ~500 TB SSD cache (hot content)
Total CDN edge storage:      200 * 500 TB = ~100 PB edge cache

=== Metadata ===
Video metadata records:      ~800 million videos total
Avg metadata size:           ~2 KB per video (title, desc, tags, stats)
Metadata DB size:            800M * 2 KB = ~1.6 TB
Watch history events/day:    1B views * 10 events each = 10B events/day
```

---

## "Why X, Not Y?" Tradeoff Analysis

### Why Adaptive Bitrate (HLS/DASH), Not Single-Quality Streaming?

| Factor | Single Quality | Adaptive Bitrate (HLS/DASH) |
|---|---|---|
| **Network variability** | Buffers or fails on bandwidth drops | Seamlessly switches to lower quality |
| **Device diversity** | Wastes bandwidth on mobile, starves 4K TVs | Serves optimal quality per device |
| **Start time** | Must buffer full segment at target quality | Starts at low quality, ramps up quickly |
| **CDN efficiency** | Single rendition cached | Popular renditions cached per-PoP |
| **User experience** | Binary: plays or stalls | Graceful degradation, near-zero rebuffering |

**Decision:** Adaptive bitrate (ABR) is the only viable approach at scale. The upfront cost of transcoding into 8 renditions pays for itself immediately in reduced rebuffering (the #1 cause of viewer abandonment). HLS is used for Apple ecosystem, DASH for everything else; most platforms support both.

---

### Why Async Transcoding Queue, Not Synchronous?

| Factor | Synchronous Transcode | Async Queue + Workers |
|---|---|---|
| **Upload latency** | Minutes to hours (blocks response) | Immediate acknowledgment (< 1s) |
| **Resource isolation** | Upload server needs GPU | Dedicated GPU fleet, independently scaled |
| **Failure handling** | Upload fails if transcode fails | Retry with backoff, dead-letter queue |
| **Priority management** | FIFO only | Priority queues (premium creators first) |
| **Cost optimization** | Always-on GPU | Spot instances, scale to zero off-peak |
| **Throughput** | Limited by single machine | Horizontally scalable worker fleet |

**Decision:** Video transcoding is inherently CPU/GPU-intensive (a 10-min 4K video takes 30+ minutes to encode all renditions). Blocking the upload request would create unacceptable latency and couple unrelated failure domains. The async pattern (upload -> ack -> enqueue -> process -> notify) decouples ingestion from processing and allows independent scaling of the expensive GPU fleet.

---

### Why CDN for Delivery, Not Origin Servers?

| Factor | Origin Servers | CDN (200+ PoPs) |
|---|---|---|
| **Latency** | 100-300ms (cross-continent) | < 20ms (nearest PoP) |
| **Bandwidth cost** | $0.05-0.09/GB at origin | $0.01-0.02/GB at edge (volume discounts) |
| **Peak handling** | Must provision for 170 Tbps | Distributed across 200+ PoPs |
| **Failure blast radius** | One region down = millions affected | One PoP down = auto-failover to next |
| **Video start time** | 2-5 seconds (cold) | < 500ms for cached content |
| **Cache hit ratio** | N/A | 95%+ for popular content |

**Decision:** At 170 Tbps peak bandwidth, no single origin can serve this traffic. CDN edge caching ensures that the top 20% of content (which represents 80%+ of views due to Zipf distribution) is served from edge cache in < 20ms. The economics are compelling: edge delivery costs 3-5x less than origin delivery at scale.

---

### Why Chunked Upload, Not Single-File Upload?

| Factor | Single-File Upload | Chunked Resumable Upload |
|---|---|---|
| **Large files** | Timeout on 4K videos (50+ GB) | Upload in 5 MB chunks, no timeout |
| **Network interruption** | Restart from byte 0 | Resume from last successful chunk |
| **Progress tracking** | Binary (uploading or not) | Granular progress (chunk 47/1000) |
| **Parallel upload** | Single stream | Upload multiple chunks in parallel |
| **Server memory** | Buffer entire file | Process chunk by chunk (5 MB buffer) |
| **Mobile support** | Fails on spotty connections | Works on 3G, handles disconnects |

**Decision:** YouTube's upload limit is 256 GB per video. A single HTTP request for a 50 GB 4K file would timeout, consume excessive server memory, and force complete restart on any network blip. Chunked upload (5 MB chunks) with server-side reassembly provides resumability, parallel uploads, and graceful handling of the unreliable last-mile connections that mobile creators depend on.

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
  <rect width="1100" height="750" fill="#FAFAFA" rx="8"/>

  <!-- Title -->
  <text x="550" y="30" text-anchor="middle" font-size="16" font-weight="800" fill="#212121">Video Streaming Platform — System Architecture</text>
  <text x="550" y="50" text-anchor="middle" font-size="11" fill="#757575">Upload + Transcode (write path) | CDN + Adaptive Bitrate Streaming (read path) | 170 Tbps peak</text>

  <!-- ========== CLIENT LAYER ========== -->
  <rect x="30" y="65" width="1040" height="75" rx="8" fill="#E3F2FD" stroke="#1565C0" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.5"/>
  <text x="50" y="82" font-size="10" font-weight="700" fill="#1565C0">CLIENTS</text>

  <!-- Creator Client -->
  <rect x="100" y="90" width="140" height="40" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="170" y="114" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Creator (Upload)</text>

  <!-- Viewer Client -->
  <rect x="800" y="90" width="140" height="40" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="870" y="114" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Viewer (Watch)</text>

  <!-- Mobile/TV/Web labels -->
  <text x="170" y="126" text-anchor="middle" font-size="8" fill="#757575">Web | Mobile | Studio App</text>
  <text x="870" y="126" text-anchor="middle" font-size="8" fill="#757575">Web | Mobile | Smart TV | Console</text>

  <!-- ========== APPLICATION LAYER ========== -->
  <rect x="30" y="155" width="520" height="220" rx="8" fill="#E8F5E9" stroke="#2E7D32" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.4"/>
  <text x="50" y="172" font-size="10" font-weight="700" fill="#2E7D32">UPLOAD + PROCESSING PATH</text>

  <!-- Upload Service -->
  <rect x="100" y="185" width="170" height="50" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="185" y="207" text-anchor="middle" font-size="11" font-weight="600" fill="#1B5E20">Upload Service</text>
  <text x="185" y="222" text-anchor="middle" font-size="9" fill="#757575">Chunked | Resumable | Auth</text>

  <!-- Arrow from Creator to Upload Service -->
  <line x1="170" y1="130" x2="170" y2="185" stroke="#546E7A" stroke-width="1.3" marker-end="url(#a)"/>
  <text x="178" y="160" font-size="8" fill="#546E7A">5 MB chunks</text>

  <!-- Raw Object Storage -->
  <path d="M100,290 L100,325 C100,338 270,338 270,325 L270,290" fill="#B2EBF2" stroke="#00838F" stroke-width="1.5"/>
  <ellipse cx="185" cy="290" rx="85" ry="10" fill="#B2EBF2" stroke="#00838F" stroke-width="1.5"/>
  <text x="185" y="310" text-anchor="middle" font-size="10" font-weight="600" fill="#006064">Raw Object Storage</text>
  <text x="185" y="325" text-anchor="middle" font-size="8" fill="#757575">S3 / GCS | 11-nines durability</text>

  <!-- Arrow Upload -> Raw Storage -->
  <line x1="185" y1="235" x2="185" y2="280" stroke="#546E7A" stroke-width="1.3" marker-end="url(#a)"/>

  <!-- Transcode Queue -->
  <rect x="320" y="185" width="170" height="45" rx="6" fill="#37474F" stroke="#263238" stroke-width="1.5" filter="url(#sh)"/>
  <text x="405" y="205" text-anchor="middle" font-size="11" font-weight="600" fill="#ECEFF1">Transcode Queue</text>
  <text x="405" y="220" text-anchor="middle" font-size="9" fill="#B0BEC5">Kafka | Priority Lanes</text>

  <!-- Arrow Raw Storage -> Queue -->
  <line x1="270" y1="290" x2="340" y2="220" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <text x="290" y="248" font-size="8" fill="#546E7A">enqueue</text>

  <!-- Transcoder Fleet -->
  <rect x="310" y="265" width="195" height="60" rx="6" fill="#FFE0B2" stroke="#F57C00" stroke-width="1.5" filter="url(#sh)"/>
  <text x="407" y="287" text-anchor="middle" font-size="11" font-weight="600" fill="#E65100">Transcoder Fleet (GPU)</text>
  <text x="407" y="302" text-anchor="middle" font-size="9" fill="#757575">FFmpeg | H.264 H.265 VP9 AV1</text>
  <text x="407" y="316" text-anchor="middle" font-size="8" fill="#757575">144p | 240p | 360p | 480p | 720p | 1080p | 1440p | 4K</text>

  <!-- Arrow Queue -> Transcoder -->
  <line x1="405" y1="230" x2="405" y2="265" stroke="#546E7A" stroke-width="1.3" marker-end="url(#a)"/>

  <!-- ========== DATA LAYER ========== -->
  <rect x="30" y="390" width="1040" height="155" rx="8" fill="#E8EAF6" stroke="#283593" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.4"/>
  <text x="50" y="407" font-size="10" font-weight="700" fill="#283593">DATA LAYER</text>

  <!-- Encoded Segment Storage -->
  <path d="M80,430 L80,470 C80,483 280,483 280,470 L280,430" fill="#C5CAE9" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="180" cy="430" rx="100" ry="11" fill="#C5CAE9" stroke="#283593" stroke-width="1.5"/>
  <text x="180" y="450" text-anchor="middle" font-size="10" font-weight="600" fill="#1A237E">Encoded Segments (S3)</text>
  <text x="180" y="466" text-anchor="middle" font-size="8" fill="#757575">2-10s chunks | 8 renditions/video</text>
  <text x="180" y="478" text-anchor="middle" font-size="8" fill="#757575">~3.1 PB/day new content</text>

  <!-- Arrow Transcoder -> Encoded Storage -->
  <line x1="407" y1="325" x2="250" y2="420" stroke="#283593" stroke-width="1.3" marker-end="url(#a)"/>
  <text x="340" y="368" font-size="8" fill="#283593">write segments</text>

  <!-- Metadata DB -->
  <path d="M340,430 L340,470 C340,483 530,483 530,470 L530,430" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5"/>
  <ellipse cx="435" cy="430" rx="95" ry="11" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5"/>
  <text x="435" y="450" text-anchor="middle" font-size="10" font-weight="600" fill="#311B92">Metadata DB</text>
  <text x="435" y="466" text-anchor="middle" font-size="8" fill="#757575">PostgreSQL/Vitess | Sharded by video_id</text>
  <text x="435" y="478" text-anchor="middle" font-size="8" fill="#757575">800M videos | title, desc, tags, stats</text>

  <!-- Search Index -->
  <path d="M580,430 L580,470 C580,483 740,483 740,470 L740,430" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5"/>
  <ellipse cx="660" cy="430" rx="80" ry="11" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5"/>
  <text x="660" y="450" text-anchor="middle" font-size="10" font-weight="600" fill="#F57F17">Search Index</text>
  <text x="660" y="466" text-anchor="middle" font-size="8" fill="#757575">Elasticsearch | Full-text</text>
  <text x="660" y="478" text-anchor="middle" font-size="8" fill="#757575">Titles + captions + transcripts</text>

  <!-- Watch History DB -->
  <path d="M790,430 L790,470 C790,483 1000,483 1000,470 L1000,430" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5"/>
  <ellipse cx="895" cy="430" rx="105" ry="11" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5"/>
  <text x="895" y="450" text-anchor="middle" font-size="10" font-weight="600" fill="#B71C1C">Watch History + Events</text>
  <text x="895" y="466" text-anchor="middle" font-size="8" fill="#757575">Cassandra | Write-heavy (10B events/day)</text>
  <text x="895" y="478" text-anchor="middle" font-size="8" fill="#757575">user_id partition | TTL 2 years</text>

  <!-- ========== STREAMING / READ PATH ========== -->
  <rect x="560" y="155" width="510" height="220" rx="8" fill="#E8F5E9" stroke="#2E7D32" stroke-width="1.5" stroke-dasharray="6,3" opacity="0.4"/>
  <text x="580" y="172" font-size="10" font-weight="700" fill="#2E7D32">STREAMING PATH (READ)</text>

  <!-- CDN Edge -->
  <rect x="720" y="185" width="230" height="55" rx="6" fill="#B2EBF2" stroke="#00838F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="835" y="207" text-anchor="middle" font-size="12" font-weight="700" fill="#006064">CDN Edge (200+ PoPs)</text>
  <text x="835" y="222" text-anchor="middle" font-size="9" fill="#757575">95% cache hit | < 20ms latency | CloudFront/Akamai</text>
  <text x="835" y="234" text-anchor="middle" font-size="8" fill="#757575">Serves HLS/DASH segments directly from edge SSD</text>

  <!-- Arrow Viewer -> CDN -->
  <line x1="870" y1="130" x2="855" y2="185" stroke="#2E7D32" stroke-width="1.5" marker-end="url(#ag)"/>
  <text x="878" y="160" font-size="8" fill="#2E7D32">GET /segment_47.ts</text>

  <!-- Origin / Streaming Service -->
  <rect x="720" y="270" width="230" height="50" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="835" y="292" text-anchor="middle" font-size="11" font-weight="600" fill="#1B5E20">Origin / Streaming Service</text>
  <text x="835" y="307" text-anchor="middle" font-size="9" fill="#757575">Manifest gen | DRM | Token auth | Range requests</text>

  <!-- Arrow CDN -> Origin (cache miss) -->
  <line x1="835" y1="240" x2="835" y2="270" stroke="#D32F2F" stroke-width="1.2" stroke-dasharray="4,2" marker-end="url(#ar)"/>
  <text x="850" y="258" font-size="8" fill="#D32F2F">cache miss (5%)</text>

  <!-- Arrow Origin -> Encoded Storage -->
  <line x1="720" y1="310" x2="270" y2="445" stroke="#283593" stroke-width="1.2" stroke-dasharray="5,3" marker-end="url(#a)"/>
  <text x="470" y="370" font-size="8" fill="#283593">fetch segment from storage</text>

  <!-- Metadata Service -->
  <rect x="580" y="185" width="125" height="45" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="642" y="205" text-anchor="middle" font-size="10" font-weight="600" fill="#311B92">Metadata Svc</text>
  <text x="642" y="218" text-anchor="middle" font-size="8" fill="#757575">Video info | Stats</text>

  <!-- Search Service -->
  <rect x="580" y="250" width="125" height="45" rx="6" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5" filter="url(#sh)"/>
  <text x="642" y="270" text-anchor="middle" font-size="10" font-weight="600" fill="#F57F17">Search Service</text>
  <text x="642" y="283" text-anchor="middle" font-size="8" fill="#757575">Query + Rank</text>

  <!-- Recommendation Engine -->
  <rect x="580" y="315" width="125" height="45" rx="6" fill="#F3E5F5" stroke="#7B1FA2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="642" y="335" text-anchor="middle" font-size="10" font-weight="600" fill="#4A148C">Reco Engine</text>
  <text x="642" y="348" text-anchor="middle" font-size="8" fill="#757575">CF + Deep Learning</text>

  <!-- Arrows from services to data layer -->
  <line x1="435" y1="325" x2="435" y2="420" stroke="#512DA8" stroke-width="1" stroke-dasharray="3,2" marker-end="url(#a)"/>
  <line x1="642" y1="230" x2="480" y2="420" stroke="#512DA8" stroke-width="1" stroke-dasharray="3,2" marker-end="url(#a)"/>
  <line x1="642" y1="295" x2="660" y2="420" stroke="#F9A825" stroke-width="1" stroke-dasharray="3,2" marker-end="url(#a)"/>
  <line x1="642" y1="360" x2="830" y2="420" stroke="#D32F2F" stroke-width="1" stroke-dasharray="3,2" marker-end="url(#a)"/>

  <!-- Arrow CDN -> Encoded Storage (pre-warm) -->
  <path d="M720,230 Q400,380 265,425" fill="none" stroke="#00838F" stroke-width="1" stroke-dasharray="4,3" marker-end="url(#a)"/>
  <text x="440" y="340" font-size="8" fill="#00838F">pre-warm popular</text>

  <!-- ========== LEGEND ========== -->
  <rect x="30" y="560" width="1040" height="180" rx="8" fill="none" stroke="#E0E0E0" stroke-width="1"/>

  <!-- Legend Bar -->
  <rect x="50" y="570" width="1000" height="28" rx="4" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="70" y="588" font-size="9" font-weight="700" fill="#757575">LEGEND:</text>
  <rect x="130" y="580" width="14" height="10" rx="2" fill="#C8E6C9" stroke="#388E3C" stroke-width="1"/>
  <text x="148" y="589" font-size="8" fill="#616161">Service</text>
  <rect x="195" y="580" width="14" height="10" rx="2" fill="#B2EBF2" stroke="#00838F" stroke-width="1"/>
  <text x="213" y="589" font-size="8" fill="#616161">CDN/Storage</text>
  <rect x="278" y="580" width="14" height="10" rx="2" fill="#FFE0B2" stroke="#F57C00" stroke-width="1"/>
  <text x="296" y="589" font-size="8" fill="#616161">GPU Workers</text>
  <rect x="363" y="580" width="14" height="10" rx="2" fill="#37474F" stroke="#263238" stroke-width="1"/>
  <text x="381" y="589" font-size="8" fill="#616161">Queue</text>
  <rect x="420" y="580" width="14" height="10" rx="2" fill="#C5CAE9" stroke="#283593" stroke-width="1"/>
  <text x="438" y="589" font-size="8" fill="#616161">Database</text>
  <rect x="495" y="580" width="14" height="10" rx="2" fill="#D1C4E9" stroke="#512DA8" stroke-width="1"/>
  <text x="513" y="589" font-size="8" fill="#616161">Metadata</text>
  <rect x="570" y="580" width="14" height="10" rx="2" fill="#F3E5F5" stroke="#7B1FA2" stroke-width="1"/>
  <text x="588" y="589" font-size="8" fill="#616161">ML/Reco</text>
  <line x1="640" y1="585" x2="680" y2="585" stroke="#546E7A" stroke-width="1.3" marker-end="url(#a)"/>
  <text x="685" y="589" font-size="8" fill="#616161">Data flow</text>
  <line x1="730" y1="585" x2="770" y2="585" stroke="#D32F2F" stroke-width="1.2" stroke-dasharray="4,2" marker-end="url(#ar)"/>
  <text x="775" y="589" font-size="8" fill="#616161">Cache miss</text>
  <line x1="835" y1="585" x2="875" y2="585" stroke="#2E7D32" stroke-width="1.3" marker-end="url(#ag)"/>
  <text x="880" y="589" font-size="8" fill="#616161">Cache hit</text>

  <!-- Flow annotations -->
  <text x="70" y="620" font-size="10" font-weight="700" fill="#1565C0">UPLOAD FLOW:</text>
  <text x="70" y="636" font-size="9" fill="#424242">Creator → Upload Service (5MB chunks, resumable) → Raw Object Storage (S3) → Transcode Queue (Kafka) → GPU Fleet → Encoded Segments (S3) → CDN pre-warm</text>

  <text x="70" y="660" font-size="10" font-weight="700" fill="#2E7D32">WATCH FLOW:</text>
  <text x="70" y="676" font-size="9" fill="#424242">Viewer → CDN Edge (95% hit) → [miss] Origin Service → Encoded Segments → CDN cache-fill → Viewer</text>

  <text x="70" y="700" font-size="10" font-weight="700" fill="#7B1FA2">DISCOVERY FLOW:</text>
  <text x="70" y="716" font-size="9" fill="#424242">Viewer → Metadata Service → Search Index / Recommendation Engine → Watch History (Cassandra) → Personalized feed</text>

  <text x="70" y="740" font-size="9" font-style="italic" fill="#9E9E9E">Scale: 500M DAU | 1B views/day | 170 Tbps peak | 200+ CDN PoPs | 100+ PB stored content</text>
</svg>
</div>

---

## Backend Services Explained

### Upload Service

The Upload Service handles the ingestion of raw video files from creators. It implements the **tus** resumable upload protocol (or a proprietary equivalent) where clients split files into 5 MB chunks and upload them independently with each chunk identified by a byte-range offset. The server maintains an upload session state in Redis (tracking which chunks have been received) and writes completed chunks directly to object storage (S3/GCS) using multipart upload APIs. Once all chunks arrive, it triggers a "video uploaded" event to the transcode queue. The service also performs pre-upload validation: codec sniffing, file-size limits (256 GB max), virus scanning, and duplicate detection via perceptual hashing. It runs behind a rate limiter (per-creator: 50 uploads/day for free tier, unlimited for premium) and authenticates every request via short-lived signed upload URLs.

### Transcoder Fleet

The Transcoder Fleet is a horizontally-scalable pool of GPU-accelerated workers (typically NVIDIA T4 or A10G instances) that consume jobs from the transcode queue. Each job specifies the source video location in raw storage and produces a **resolution ladder** — eight renditions from 144p to 4K. The transcoding pipeline is a DAG: first, the source is decoded and analyzed (scene detection, bitrate optimization via per-title encoding), then each resolution is encoded in parallel using FFmpeg with hardware-accelerated codecs (NVENC for H.264/H.265, libvpx-vp9, libaom-av1). Each rendition is chunked into 2-10 second segments (aligned to keyframes for clean switching). The fleet auto-scales based on queue depth with a target of < 10 min processing time for 1080p content. Failed jobs are retried 3 times before moving to a dead-letter queue for manual investigation. The fleet uses spot/preemptible instances for 60-70% cost savings with on-demand fallback for priority jobs.

### Streaming / Origin Service

The Origin Service generates **manifest files** (HLS `.m3u8` or DASH `.mpd`) that describe all available renditions and their segment URLs, and serves video segments on CDN cache misses. The manifest is the "control plane" of video playback — it tells the client player what quality levels exist, segment durations, and byte ranges. For DRM-protected content (Netflix, premium YouTube), the origin injects license acquisition URLs and content key IDs into the manifest. It also handles **range requests** for byte-range seeking, **token authentication** (signed URLs with expiry to prevent hotlinking), and **geo-restriction** enforcement. The origin is deployed across multiple regions with Anycast DNS for automatic failover.

### CDN (Content Delivery Network)

The CDN layer consists of 200+ Points of Presence (PoPs) globally, each equipped with 100+ TB of SSD cache and 1+ Tbps of egress capacity. When a viewer requests a segment, DNS routes them to the nearest PoP (< 20ms latency). The PoP checks its local cache: on a **hit** (95% of requests for popular content), it serves the segment directly from SSD with zero origin contact. On a **miss**, it fetches from the origin (or a mid-tier cache), serves the viewer, and caches the segment for future requests. Cache eviction uses a combination of LRU and popularity scoring — viral content stays cached longer. The CDN also handles **pre-warming**: when a high-profile video is published (e.g., a new music video from a major artist), the system proactively pushes segments to all PoPs before viewers request them, eliminating first-viewer latency.

### Metadata Service

The Metadata Service owns all non-binary video data: title, description, tags, thumbnails, view counts, like/dislike ratios, upload timestamps, channel information, and video status (processing, live, unlisted, private). It is backed by a sharded PostgreSQL cluster (Vitess) partitioned by `video_id` with read replicas for high-throughput queries. View counts use a **write-behind** pattern: increments are batched in Redis (flushed every 5 seconds) to avoid write amplification on the primary DB. The service exposes both internal gRPC APIs (for other services) and external REST APIs (for the client app). It also publishes change events to Kafka for downstream consumers (search indexing, analytics, recommendation training).

### Search Service

The Search Service provides full-text search across 800M+ videos using Elasticsearch clusters sharded by language/region. It indexes video titles, descriptions, tags, auto-generated captions (from speech-to-text), and channel names. Ranking combines text relevance (BM25) with engagement signals (CTR, watch time, freshness) and personalization (user's watch history, subscriptions). Autocomplete suggestions are served from a separate prefix-tree index with sub-50ms latency. The search pipeline includes spell correction, synonym expansion, and safe-search filtering. Index updates are near-real-time (< 30 seconds from metadata change to searchable) via a Kafka-to-Elasticsearch connector.

### Recommendation Engine

The Recommendation Engine generates personalized video suggestions for the home feed, "Up Next" sidebar, and notifications. It combines multiple signals through a two-stage architecture: **candidate generation** (recall: retrieve 1000s of candidates from collaborative filtering, content-based similarity, and trending signals) and **ranking** (precision: score each candidate using a deep neural network trained on engagement features — watch time, likes, shares, not-interested signals). The model is trained on billions of watch events using distributed TensorFlow/PyTorch. Recommendations are pre-computed in batch (updated hourly per user) and stored in a low-latency serving layer (Redis/Memcached). Real-time signals (e.g., user just watched a cooking video) trigger lightweight re-ranking of the pre-computed set without waiting for full model inference.

---

## Architecture Flow

### Upload Path: Diego in Mexico City uploads a 4K cooking video

> Diego opens the YouTube Studio app and selects a 4K video (12 minutes, 8.5 GB) of his abuela's mole recipe.

**T+0ms** — The client requests an upload session from the Upload Service. The service validates Diego's auth token, checks his upload quota, and returns a signed upload URL with a unique `upload_id`. It creates a session record in Redis: `{upload_id, total_size: 8.5GB, chunks_received: [], status: "in_progress"}`.

**T+50ms** — The client splits the file into 1,700 chunks (5 MB each) and begins uploading 6 chunks in parallel (browser/app limit). Each chunk is a PUT request with header `Content-Range: bytes 0-5242879/8500000000`. The Upload Service writes each chunk directly to S3 using multipart upload and marks it complete in Redis.

**T+3min** — Diego's train enters a tunnel. Upload pauses at chunk 847/1700. No data is lost. When connectivity returns 45 seconds later, the client queries `GET /upload/{upload_id}/status`, receives the list of completed chunks, and resumes from chunk 848. No re-upload needed.

**T+8min** — All 1,700 chunks received. The Upload Service calls S3's `CompleteMultipartUpload`, which assembles the chunks into a single object. It publishes a message to the Transcode Queue (Kafka): `{video_id: "dQw4w9WgXcQ", source: "s3://raw/diego/upload_id.mp4", priority: "standard"}`. Diego sees "Processing..." in his dashboard.

**T+8min 10s** — A transcoder worker picks up the job. It downloads the source file, probes the video (4K, 30fps, H.264, AAC audio), and constructs the transcoding DAG: 8 resolution outputs, 2 codec variants (H.264 for compatibility + VP9 for Chrome/Android), producing 16 total renditions. GPU-accelerated encoding begins in parallel across the resolution ladder.

**T+12min** — Lower resolutions (144p through 720p) complete first. As each rendition finishes, its segments are uploaded to S3 and the video becomes playable at those qualities. Diego's video shows "Processing — SD quality available" in his dashboard.

**T+35min** — All 16 renditions complete. The transcoder writes the final manifest files (one `.m3u8` master playlist pointing to all quality levels), updates the metadata DB (`status: "ready"`), triggers thumbnail extraction (ML-selected best frame), and publishes a "video ready" event. Diego receives a push notification: "Your video is ready to share!"

**T+36min** — The CDN pre-warm system detects Diego has 50K subscribers. It pushes the first 30 seconds of the video (all renditions) to the top 20 PoPs where his audience is concentrated (Mexico, US Southwest, Spain).

---

### Watch Path: Yuki in Tokyo opens the app to watch Diego's video

> Yuki sees Diego's video recommended on her home feed (collaborative filtering: she watches cooking content, other cooking viewers watched Diego's video). She taps to play.

**T+0ms** — Yuki's player sends `GET /api/v1/videos/dQw4w9WgXcQ/manifest.m3u8` to the CDN edge PoP in Tokyo. The PoP has the manifest cached (popular video, recently pre-warmed). **Cache hit.** Response in 8ms.

**T+8ms** — The player parses the master manifest, which lists 8 quality levels:

```
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=256x144
/segments/dQw4w9WgXcQ/144p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=16000000,RESOLUTION=3840x2160
/segments/dQw4w9WgXcQ/4k/playlist.m3u8
```

The ABR algorithm estimates Yuki's bandwidth (~50 Mbps fiber). It selects 1080p as the initial quality (conservative start — not 4K until buffer is established).

**T+15ms** — Player requests the first segment: `GET /segments/dQw4w9WgXcQ/1080p/seg_0.ts`. Tokyo PoP has it cached (pre-warmed). Serves 2-second segment (2 MB) in 40ms. Video begins playing.

**T+55ms** — First frame rendered. Total startup latency: 55ms (well under the 2-second target). Player background-fetches segments 1, 2, 3 to build a 6-second buffer.

**T+2s** — Buffer established at 6 seconds. ABR algorithm observes stable 50 Mbps throughput and low RTT. Upgrades to 4K for segment 4 onward. Yuki doesn't notice the switch — the transition happens at a segment boundary during playback.

**T+4min** — Yuki's roommate starts a large download. Available bandwidth drops to 8 Mbps. The ABR algorithm detects the throughput drop (last segment took 3x longer than expected). Buffer is draining: 4 seconds remaining. Algorithm switches DOWN aggressively to 720p immediately (skip 1080p — when dropping, skip levels to protect buffer). Buffer stabilizes.

**T+4min 30s** — Roommate's download completes. Bandwidth recovers to 50 Mbps. ABR algorithm waits until buffer exceeds 15 seconds (conservative upswitch threshold), then gradually steps up: 720p → 1080p → 4K over the next 3 segments. This asymmetric switching (fast down, slow up) prevents oscillation.

**T+12min** — Video ends. Player reports watch-time analytics event to the Watch History service: `{user: yuki, video: dQw4w9WgXcQ, watch_time: 12min, max_quality: 4K, rebuffers: 0}`. The recommendation engine updates Yuki's profile in real-time for the next "Up Next" suggestion.

---

## Failure & Recovery Scenarios

### CDN PoP Failure

**Scenario:** The Tokyo PoP loses power. 200K concurrent viewers in Japan are affected.

**Detection:** Health checks fail within 5 seconds. DNS-based routing (Anycast or latency-based Route53) detects the PoP is unresponsive.

**Recovery:** DNS TTL is 30 seconds. Within 30-60 seconds, all Japanese viewers are re-routed to the Osaka PoP (next nearest, 15ms additional latency). Viewers experience a brief quality downgrade (ABR detects increased latency, steps down one level) but zero interruption. The Osaka PoP's cache has 70% hit rate for Japanese-popular content; the remaining 30% of requests go to origin for a few seconds until the cache warms. Total user-visible impact: 1-2 second quality dip for 30 seconds.

**Prevention:** Multi-PoP redundancy in every metro. Tokyo has 3 PoPs across different facilities. Anycast automatically routes around failures at the network layer.

---

### Transcoding Job Stuck / Failed

**Scenario:** A transcoder worker crashes mid-encoding of a video. The job has been processing for 20 minutes with no heartbeat.

**Detection:** The queue system uses **visibility timeout** — if a worker doesn't send a heartbeat within 5 minutes, the message becomes visible again for another worker to pick up.

**Recovery:** Another worker claims the job and restarts transcoding from scratch (transcoding is idempotent — same input always produces same output). If the job fails 3 times consecutively, it moves to a **dead-letter queue (DLQ)** for investigation. The creator sees "Processing failed — our team is investigating" and is notified when resolved.

**Prevention:** Workers checkpoint progress for long-running encodes (e.g., "720p complete, 1080p in progress"). On retry, the new worker can skip already-completed renditions and resume from the incomplete one. Workers run health-check processes that kill and restart stuck FFmpeg processes.

---

### Origin Overloaded (Cache Miss Storm)

**Scenario:** A viral video is published with 10M simultaneous viewers. CDN hasn't cached it yet — all requests hit origin.

**Detection:** Origin request rate spikes 100x above baseline. Latency increases from 50ms to 5 seconds. 503 errors begin.

**Recovery (immediate):** **Request coalescing** — when 1000 CDN PoPs simultaneously request the same segment, the origin recognizes duplicate requests and serves a single read from S3, fanning the response out to all waiting CDN PoPs. This reduces origin load from N (number of PoPs) to 1 per unique segment.

**Recovery (proactive):** **Shield / mid-tier cache** — a small number of regional "shield" servers sit between CDN PoPs and origin. All PoPs in a region route misses through the shield first. The shield caches the response after the first fetch, so only 1 request per region reaches origin instead of 1 per PoP.

**Prevention:** Pre-warming for high-profile releases. When a creator with > 1M subscribers publishes, the system proactively pushes segments to all PoPs before the video goes live.

---

### Client Bandwidth Drops Mid-Stream

**Scenario:** A viewer on cellular data enters an elevator. Bandwidth drops from 10 Mbps to 0.5 Mbps.

**Detection:** The ABR algorithm monitors two signals: (1) **throughput** — measured download speed of the last N segments, and (2) **buffer level** — seconds of video already downloaded but not yet played.

**Recovery:** When buffer drops below the "panic threshold" (4 seconds), the algorithm switches to the lowest available quality (144p at 400 Kbps) immediately — no gradual stepping. This "emergency downswitch" sacrifices quality to prevent the cardinal sin of rebuffering. If bandwidth is truly zero (elevator), the buffer drains over 4 seconds and playback pauses with a "Poor connection" message. When bandwidth returns, playback resumes from the buffer and quality ramps back up conservatively.

**Prevention:** Predictive buffering — the player pre-fetches extra segments when it detects the user is on cellular (based on network type API). Some players implement "download ahead" during high-bandwidth periods to build a 30-60 second buffer cushion.

---

## Data Model

### Video Metadata (PostgreSQL/Vitess — sharded by video_id)

```sql
CREATE TABLE videos (
    video_id        BIGINT PRIMARY KEY,          -- Snowflake ID (timestamp + worker + seq)
    channel_id      BIGINT NOT NULL,             -- FK to channels table
    title           VARCHAR(200) NOT NULL,        -- Full-text indexed in Elasticsearch
    description     TEXT,
    tags            TEXT[],                        -- Array of tags for search/filtering
    status          VARCHAR(20) NOT NULL,          -- 'uploading','transcoding','ready','failed','removed'
    privacy         VARCHAR(10) DEFAULT 'public',  -- 'public','unlisted','private'
    duration_ms     INTEGER,
    upload_size_bytes BIGINT,
    thumbnail_url   VARCHAR(500),
    view_count      BIGINT DEFAULT 0,             -- Denormalized, updated via write-behind from Redis
    like_count      INTEGER DEFAULT 0,
    dislike_count   INTEGER DEFAULT 0,
    comment_count   INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at    TIMESTAMP WITH TIME ZONE,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for channel video listing
CREATE INDEX idx_videos_channel_published ON videos(channel_id, published_at DESC);
-- Index for trending/popular queries
CREATE INDEX idx_videos_view_count ON videos(view_count DESC) WHERE status = 'ready';
```

### HLS Manifest / Chunk Manifest (stored as files in S3, structure shown here)

```
#EXTM3U
#EXT-X-VERSION:4
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=256x144,CODECS="avc1.42c00c,mp4a.40.2"
144p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=426x240,CODECS="avc1.4d4015,mp4a.40.2"
240p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2"
360p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=854x480,CODECS="avc1.4d401f,mp4a.40.2"
480p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1280x720,CODECS="avc1.4d4020,mp4a.40.2"
720p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"
1080p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=12000000,RESOLUTION=2560x1440,CODECS="avc1.640032,mp4a.40.2"
1440p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=20000000,RESOLUTION=3840x2160,CODECS="avc1.640033,mp4a.40.2"
4k/playlist.m3u8
```

**Per-resolution playlist (e.g., `720p/playlist.m3u8`):**

```
#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:4.000,
seg_000.ts
#EXTINF:4.000,
seg_001.ts
#EXTINF:4.000,
seg_002.ts
...
#EXTINF:2.500,
seg_179.ts
#EXT-X-ENDLIST
```

### User Watch History (Cassandra — partitioned by user_id)

```sql
CREATE TABLE watch_history (
    user_id         BIGINT,
    watched_at      TIMESTAMP,
    video_id        BIGINT,
    watch_duration_ms INTEGER,         -- How long they actually watched
    video_duration_ms INTEGER,         -- Total video length (for % calculation)
    max_quality     VARCHAR(10),       -- Highest quality reached
    device_type     VARCHAR(20),       -- mobile, desktop, tv, tablet
    rebuffer_count  INTEGER,
    PRIMARY KEY ((user_id), watched_at)
) WITH CLUSTERING ORDER BY (watched_at DESC)
  AND default_time_to_live = 63072000;  -- 2-year TTL

-- Materialized view for "continue watching" feature
CREATE MATERIALIZED VIEW incomplete_watches AS
    SELECT * FROM watch_history
    WHERE watch_duration_ms < video_duration_ms * 0.9
    PRIMARY KEY ((user_id), watched_at)
    WITH CLUSTERING ORDER BY (watched_at DESC);
```

---

## Algorithms Under the Hood

### Adaptive Bitrate Selection (Hybrid: Buffer-Based + Throughput-Based)

```python
def select_next_quality(state):
    """
    Hybrid ABR algorithm combining buffer-level and throughput estimation.
    Used by the client player to decide quality for the next segment.
    
    Inputs:
        state.buffer_level_sec    - seconds of video in buffer
        state.throughput_history  - list of measured throughputs (last 5 segments)
        state.current_quality    - index into QUALITY_LEVELS
        state.segment_duration   - typical segment length in seconds
    
    Returns: index into QUALITY_LEVELS for next segment download
    """
    QUALITY_LEVELS = [
        {"name": "144p",  "bitrate": 400_000},
        {"name": "240p",  "bitrate": 800_000},
        {"name": "360p",  "bitrate": 1_500_000},
        {"name": "480p",  "bitrate": 3_000_000},
        {"name": "720p",  "bitrate": 5_000_000},
        {"name": "1080p", "bitrate": 8_000_000},
        {"name": "1440p", "bitrate": 12_000_000},
        {"name": "4K",    "bitrate": 20_000_000},
    ]
    
    BUFFER_LOW = 4       # seconds - panic zone, switch down aggressively
    BUFFER_SAFE = 10     # seconds - stable, allow current quality
    BUFFER_HIGH = 20     # seconds - surplus, consider switching up
    SAFETY_FACTOR = 0.7  # only use 70% of estimated throughput
    
    # Step 1: Estimate available throughput (harmonic mean for stability)
    if len(state.throughput_history) >= 3:
        # Harmonic mean is more conservative than arithmetic mean
        # (penalizes low samples more), which is what we want for video
        harmonic_mean = len(state.throughput_history) / sum(
            1.0 / t for t in state.throughput_history
        )
        estimated_throughput = harmonic_mean * SAFETY_FACTOR
    else:
        # Not enough samples yet - be conservative
        estimated_throughput = QUALITY_LEVELS[1]["bitrate"]  # Start at 240p
    
    # Step 2: Find max quality our throughput can support
    throughput_max_quality = 0
    for i, level in enumerate(QUALITY_LEVELS):
        if level["bitrate"] <= estimated_throughput:
            throughput_max_quality = i
    
    # Step 3: Buffer-based decision (overrides throughput in extreme cases)
    current = state.current_quality
    
    if state.buffer_level_sec < BUFFER_LOW:
        # PANIC: Buffer critically low. Drop to lowest immediately.
        # Skip levels — don't step down gradually, that's too slow.
        return 0  # 144p - survival mode
    
    elif state.buffer_level_sec < BUFFER_SAFE:
        # LOW: Don't go up. Allow one step down if throughput says so.
        return min(current, throughput_max_quality)
    
    elif state.buffer_level_sec < BUFFER_HIGH:
        # SAFE: Follow throughput estimate, but don't go above current+1
        # (conservative upswitch to avoid oscillation)
        return min(throughput_max_quality, current + 1)
    
    else:
        # HIGH: Buffer is healthy. Allow throughput to drive quality up.
        # Still cap at +1 level per segment to avoid jarring jumps.
        target = min(throughput_max_quality, current + 1)
        return target
```

---

### Chunked Upload with Resumability

```python
def chunked_upload(file_path, upload_url, chunk_size=5 * 1024 * 1024):
    """
    Client-side chunked upload with resumability.
    Implements a simplified tus-protocol-like flow.
    
    On network failure: call resume_upload() which queries server
    for completed chunks and restarts from the last gap.
    """
    file_size = os.path.getsize(file_path)
    total_chunks = math.ceil(file_size / chunk_size)
    
    # Step 1: Create upload session on server
    session = http_post(f"{upload_url}/create", body={
        "filename": os.path.basename(file_path),
        "file_size": file_size,
        "chunk_size": chunk_size,
        "content_type": detect_mime_type(file_path),
        "checksum_algo": "sha256"
    })
    upload_id = session["upload_id"]
    
    # Step 2: Upload chunks with parallel workers
    MAX_PARALLEL = 6  # Browser/HTTP2 connection limit
    completed_chunks = set()
    
    with ThreadPoolExecutor(max_workers=MAX_PARALLEL) as executor:
        futures = {}
        
        for chunk_index in range(total_chunks):
            offset = chunk_index * chunk_size
            length = min(chunk_size, file_size - offset)
            
            future = executor.submit(
                upload_single_chunk,
                upload_id, file_path, chunk_index, offset, length
            )
            futures[future] = chunk_index
        
        for future in as_completed(futures):
            chunk_idx = futures[future]
            try:
                future.result()
                completed_chunks.add(chunk_idx)
                report_progress(len(completed_chunks) / total_chunks)
            except NetworkError:
                # Don't fail entire upload — we'll retry missing chunks
                pass
    
    # Step 3: Retry any failed chunks (with exponential backoff)
    missing = set(range(total_chunks)) - completed_chunks
    for attempt in range(3):
        if not missing:
            break
        time.sleep(2 ** attempt)  # 1s, 2s, 4s backoff
        for chunk_index in list(missing):
            try:
                offset = chunk_index * chunk_size
                length = min(chunk_size, file_size - offset)
                upload_single_chunk(upload_id, file_path, chunk_index, offset, length)
                missing.discard(chunk_index)
            except NetworkError:
                continue
    
    if missing:
        raise UploadError(f"Failed to upload chunks: {missing}")
    
    # Step 4: Finalize — server assembles chunks
    http_post(f"{upload_url}/{upload_id}/complete", body={
        "total_chunks": total_chunks,
        "full_file_sha256": compute_sha256(file_path)
    })
    
    return upload_id


def upload_single_chunk(upload_id, file_path, chunk_index, offset, length):
    """Upload a single chunk with integrity verification."""
    with open(file_path, 'rb') as f:
        f.seek(offset)
        chunk_data = f.read(length)
    
    chunk_sha256 = hashlib.sha256(chunk_data).hexdigest()
    
    response = http_put(
        f"{UPLOAD_URL}/{upload_id}/chunks/{chunk_index}",
        headers={
            "Content-Range": f"bytes {offset}-{offset + length - 1}/{file_size}",
            "X-Chunk-SHA256": chunk_sha256,
        },
        body=chunk_data,
        timeout=30  # Per-chunk timeout, not entire file
    )
    
    if response.status != 200:
        raise NetworkError(f"Chunk {chunk_index} upload failed: {response.status}")


def resume_upload(upload_id):
    """Query server for upload status and return missing chunk indices."""
    status = http_get(f"{UPLOAD_URL}/{upload_id}/status")
    # Server returns: {"completed_chunks": [0,1,2,5,6,7], "total": 1700}
    all_chunks = set(range(status["total"]))
    completed = set(status["completed_chunks"])
    return all_chunks - completed  # Chunks that need re-uploading
```

---

### Transcoding DAG (Resolution Ladder with Per-Title Encoding)

```python
def build_transcode_dag(source_video_path):
    """
    Build a transcoding Directed Acyclic Graph (DAG) for a video.
    
    The DAG optimizes for:
    1. Parallel encoding of independent resolutions
    2. Per-title encoding: adjust bitrate based on content complexity
    3. Fast availability: lower resolutions complete first → early playback
    4. Codec variants: H.264 (compatibility) + VP9 (efficiency) + AV1 (future)
    
    Returns: DAG of tasks that the scheduler executes on GPU workers.
    """
    
    RESOLUTION_LADDER = [
        {"name": "144p",  "width": 256,  "height": 144,  "base_bitrate_kbps": 400},
        {"name": "240p",  "width": 426,  "height": 240,  "base_bitrate_kbps": 800},
        {"name": "360p",  "width": 640,  "height": 360,  "base_bitrate_kbps": 1500},
        {"name": "480p",  "width": 854,  "height": 480,  "base_bitrate_kbps": 3000},
        {"name": "720p",  "width": 1280, "height": 720,  "base_bitrate_kbps": 5000},
        {"name": "1080p", "width": 1920, "height": 1080, "base_bitrate_kbps": 8000},
        {"name": "1440p", "width": 2560, "height": 1440, "base_bitrate_kbps": 12000},
        {"name": "4K",    "width": 3840, "height": 2160, "base_bitrate_kbps": 20000},
    ]
    
    dag = TranscodeDAG()
    
    # ──── Stage 1: Source Analysis (runs first, all else depends on it) ────
    analyze_task = dag.add_task(
        name="analyze_source",
        command=f"ffprobe -v quiet -print_format json -show_streams {source_video_path}",
        outputs=["source_info.json"]
    )
    
    # Per-title encoding: analyze content complexity to optimize bitrates
    complexity_task = dag.add_task(
        name="analyze_complexity",
        command=f"""
            ffmpeg -i {source_video_path} -vf "select=not(mod(n\\,30))" 
            -vsync vfr -q:v 2 -f null - 2>&1 | grep 'frame=' 
        """,
        depends_on=[analyze_task],
        outputs=["complexity_score"]
    )
    # complexity_score: 0.0 (static slideshow) to 1.0 (fast action sports)
    # Low complexity → reduce bitrate 30% (saves storage, same quality)
    # High complexity → increase bitrate 20% (maintains quality in motion)
    
    # ──── Stage 2: Determine output resolutions ────
    # Don't upscale: if source is 720p, only produce 144p-720p
    source_info = probe_video(source_video_path)
    source_height = source_info["height"]
    
    applicable_resolutions = [
        r for r in RESOLUTION_LADDER if r["height"] <= source_height
    ]
    
    # ──── Stage 3: Parallel encoding per resolution ────
    segment_tasks = []
    for resolution in applicable_resolutions:
        # Adjust bitrate based on content complexity
        adjusted_bitrate = adjust_bitrate_for_complexity(
            resolution["base_bitrate_kbps"], 
            complexity_score
        )
        
        # H.264 encode (universal compatibility)
        h264_task = dag.add_task(
            name=f"encode_h264_{resolution['name']}",
            command=f"""
                ffmpeg -i {source_video_path} 
                -vf scale={resolution['width']}:{resolution['height']}
                -c:v libx264 -preset medium -b:v {adjusted_bitrate}k
                -c:a aac -b:a 128k
                -f hls -hls_time 4 -hls_segment_type mpegts
                -hls_playlist_type vod
                output/{resolution['name']}/h264/playlist.m3u8
            """,
            depends_on=[complexity_task],
            gpu_required=True,
            priority=resolution["height"],  # Lower res = higher priority (faster availability)
        )
        segment_tasks.append(h264_task)
        
        # VP9 encode (better compression for Chrome/Android)
        if resolution["height"] >= 360:  # VP9 only for 360p+
            vp9_task = dag.add_task(
                name=f"encode_vp9_{resolution['name']}",
                command=f"""
                    ffmpeg -i {source_video_path}
                    -vf scale={resolution['width']}:{resolution['height']}
                    -c:v libvpx-vp9 -b:v {int(adjusted_bitrate * 0.7)}k
                    -c:a libopus -b:a 128k
                    -f dash
                    output/{resolution['name']}/vp9/manifest.mpd
                """,
                depends_on=[complexity_task],
                gpu_required=True,
                priority=resolution["height"] + 1000,  # Lower priority than H.264
            )
            segment_tasks.append(vp9_task)
    
    # ──── Stage 4: Generate master manifest (after all encodes complete) ────
    manifest_task = dag.add_task(
        name="generate_master_manifest",
        command="generate_hls_master_playlist(output/)",
        depends_on=segment_tasks,  # Waits for ALL encodes
        outputs=["master.m3u8", "master.mpd"]
    )
    
    # ──── Stage 5: Upload to storage + notify ────
    upload_task = dag.add_task(
        name="upload_to_s3",
        command=f"aws s3 sync output/ s3://encoded-segments/{video_id}/",
        depends_on=[manifest_task],
    )
    
    notify_task = dag.add_task(
        name="notify_completion",
        command=f"publish_event('video.ready', {{video_id: '{video_id}'}})",
        depends_on=[upload_task],
    )
    
    return dag


def adjust_bitrate_for_complexity(base_bitrate_kbps, complexity_score):
    """
    Per-title encoding: adjust bitrate based on content complexity.
    
    - Talking head / slideshow (score ~0.2): reduce 30% — no motion to encode
    - Normal content (score ~0.5): use base bitrate
    - Sports / fast action (score ~0.8): increase 20% — more bits needed for motion
    """
    multiplier = 0.7 + (complexity_score * 0.5)  # Range: 0.7x to 1.2x
    return int(base_bitrate_kbps * multiplier)
```

---

## Scaling Considerations

| Dimension | Challenge | Solution |
|---|---|---|
| **Storage growth** | 4.2 PB/day new content, 100+ PB total | Tiered storage: hot (SSD, < 7 days), warm (HDD, < 1 year), cold (Glacier, archive). Deduplication for re-uploads. |
| **CDN bandwidth** | 170 Tbps peak, growing 25% YoY | Multi-CDN strategy (CloudFront + Akamai + Fastly). Build own CDN for top markets (Google Global Cache). |
| **Transcoding throughput** | 500 hours uploaded/minute, 8 renditions each | Auto-scaling GPU fleet on spot instances. Priority queues (premium creators first). Regional processing to minimize data movement. |
| **Metadata queries** | 100K+ QPS for video lookups | Vitess (sharded MySQL) + aggressive caching (Redis, 99% hit rate for popular videos). Read replicas per region. |
| **Search indexing** | 6.2M new videos/day, 800M total docs | Elasticsearch cluster per region, sharded by language. Near-real-time indexing via Kafka connector. |
| **Recommendation serving** | 500M DAU, each needs personalized feed | Pre-compute top-1000 recommendations per user (batch). Store in Redis. Real-time re-ranking only for engaged users. |
| **Watch history writes** | 10B events/day | Cassandra with wide rows (partition by user_id, cluster by timestamp). TTL for auto-cleanup. |
| **Global consistency** | Creator uploads in Brazil, viewer watches in Japan | Eventual consistency for non-critical (view counts, recommendations). Strong consistency for critical (video availability — wait for CDN pre-warm before showing "ready"). |
| **Cost optimization** | $10M+/month in compute + storage + bandwidth | Spot instances for transcoding (70% savings). Reserved instances for origin. Content-aware encoding (lower bitrate for simple content). AV1 codec (30% smaller files at same quality). |
| **Cold start (new PoP)** | New CDN PoP has empty cache | Pre-warm with top 10K videos for the region. ML model predicts which content will be popular in next 24 hours. |

---

## Quick Recall

| Question | Answer |
|---|---|
| Why adaptive bitrate (ABR)? | Network conditions fluctuate. ABR lets client switch quality per-segment (every 2-10s) based on measured throughput + buffer level. Eliminates rebuffering. |
| HLS vs DASH? | HLS = Apple (HTTP Live Streaming, `.m3u8` manifests). DASH = Open standard (`.mpd` manifests). Functionally equivalent. Most platforms support both. |
| Why async transcoding? | Encoding a 10-min 4K video takes 30+ min of GPU time. Can't block upload response. Queue decouples ingestion from processing, enables retry, priority, and independent scaling. |
| Why CDN not origin? | 170 Tbps peak. No single data center can serve this. CDN distributes load across 200+ PoPs. 95% cache hit rate. < 20ms to nearest edge. 3-5x cheaper than origin delivery. |
| Buffer-based vs throughput-based ABR? | Throughput: measures download speed of recent segments. Buffer: tracks seconds of video cached locally. Hybrid (both) is best — throughput for steady-state, buffer for emergency switching. |
| Why chunked upload? | Files up to 256 GB. Single HTTP request would timeout. Chunks (5 MB) enable: resumability, parallel upload, per-chunk retry, progress tracking, low server memory. |
| What's a manifest file? | The "table of contents" for adaptive streaming. Lists all quality levels and their segment URLs. Client parses manifest to know what qualities exist and where to fetch segments. |
| Per-title encoding? | Adjust bitrate based on content complexity. A talking-head video needs fewer bits than a fast-action sports clip at the same quality. Saves 20-30% storage. |
| CDN cache miss storm? | Request coalescing (dedupe concurrent requests for same segment). Shield/mid-tier cache (regional layer between PoPs and origin). Pre-warming for viral content. |
| Why Cassandra for watch history? | Write-heavy (10B events/day), time-series access pattern, TTL for auto-cleanup, partition by user_id for efficient "my history" queries. AP system — availability over consistency. |
| How to handle live streaming? | Same architecture but segments are generated in real-time (low-latency HLS/DASH). No transcoding queue — direct encode + push to CDN. Typical latency: 3-10 seconds behind live. |
| How to reduce storage costs? | Tiered storage (hot/warm/cold), per-title encoding (lower bitrates where possible), AV1 codec (30% smaller), deduplication, delete low-view content from hot tier after 90 days. |
| What about DRM? | Widevine (Google), FairPlay (Apple), PlayReady (Microsoft). Encryption applied during transcoding. License server validates entitlement before issuing decryption keys to client. |
| How to measure quality of experience? | Track: video start time (< 2s target), rebuffer rate (< 0.5%), average bitrate delivered, quality switches per session, and abandonment rate. All reported via client-side analytics. |
