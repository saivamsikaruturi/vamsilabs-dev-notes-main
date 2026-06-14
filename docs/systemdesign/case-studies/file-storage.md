---
description: "Design a distributed file storage system like Google Drive or Dropbox — system design interview walkthrough covering file chunking, content-addressable storage, delta sync, deduplication, and scaling to 500M users."
---

# File Storage System (Google Drive / Dropbox)

!!! danger "Real Incident: Dropbox Sync Conflict Storm, 2014"
    A bug in Dropbox's desktop client caused infinite sync loops when two users edited a shared file simultaneously. The conflict resolution logic created a "conflict copy," which itself triggered a sync event on the other device, creating another conflict copy — cascading until users had hundreds of `(Conflicted Copy)` files in their folders. The root cause: the sync protocol treated conflict copies as new edits rather than terminal states. After the incident, Dropbox rewrote their sync engine (Project Infinite, later "Smart Sync") with a strict conflict DAG that marks copies as non-propagating terminal nodes. **A file storage system is a distributed state machine — your sync protocol must guarantee convergence or a single shared folder can generate unbounded writes.**

---

## System Design Concepts Used

`Content-Addressable Storage` · `File Chunking` · `Delta Sync` · `Deduplication` · `Consistent Hashing` · `Merkle Tree` · `Operational Transform / CRDT` · `Long Polling / WebSocket` · `Object Storage (S3/GCS)` · `Metadata Service` · `Distributed Locking` · `Idempotent Uploads` · `Resumable Transfers` · `Eventual Consistency` · `Conflict Resolution (LWW)`

---

## 1. Functional Requirements

1. **Upload files** — user uploads files from desktop, mobile, or web; supports resume on interruption
2. **Download files** — user downloads the latest version of any file they have access to
3. **Sync across devices** — changes propagate to all connected devices in near real-time (<5s)
4. **File versioning** — maintain version history; user can restore any previous version
5. **Sharing & permissions** — share files/folders with other users (view, edit, comment)
6. **Conflict resolution** — when two users edit the same file offline, create a conflict copy (last-writer-wins with manual merge)
7. **Notifications** — notify connected clients when a file they care about changes

## 2. Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **Availability** | 99.99% (< 52 min/year) | Users rely on file access for daily work |
| **Upload latency** | < 2s for delta sync (small edits) | Editing feels instant across devices |
| **Download latency** | < 500ms for metadata; streaming for large files | File open must feel snappy |
| **Durability** | 99.999999999% (11 nines) | Losing a user's file is unrecoverable |
| **Consistency** | Strong for metadata, eventual for sync propagation | User must never see a partial/corrupted file |
| **Scalability** | 500M users, 2B uploads/day, 100 PB storage | Must handle exponential growth |

---

## 3. Capacity Estimation

```text
/* ━━━ NAPKIN MATH: Start From Daily Uploads ━━━ */
Total users: 500M
DAU (20%): 100M
Files uploaded/day: 2B
Avg file size: 500 KB (mix of docs, photos, small videos)
Peak upload QPS: 2B / 86,400 ≈ 23,000 uploads/sec (avg)
Peak (3x): ~70,000 uploads/sec

/* ━━━ CHUNKING ━━━ */
Chunk size: 4 MB
Avg file: 500 KB → most files = 1 chunk
Large files (100 MB video): 100 MB / 4 MB = 25 chunks
Delta sync: avg edit changes 1-2 chunks out of 25 → 92% bandwidth saved

/* ━━━ STORAGE ━━━ */
New data/day: 2B × 500 KB = 1 PB/day (before dedup)
Deduplication ratio: ~60% (email attachments, shared files, OS files)
Net new storage/day: 1 PB × 0.4 = 400 TB/day
Annual growth: 400 TB × 365 = 146 PB/year
Total storage (existing): 100 PB
Replication (3x for durability): 100 PB × 3 = 300 PB raw

/* ━━━ METADATA ━━━ */
Metadata per file: file_id + name + path + owner + perms + chunk_list ≈ 2 KB
Total files: 100B (500M users × 200 files avg)
Metadata storage: 100B × 2 KB = 200 TB
Metadata QPS: 100M DAU × 50 ops/day / 86,400 ≈ 58,000 ops/sec

/* ━━━ SYNC NOTIFICATIONS ━━━ */
Active connections (long-poll/WS): 50M concurrent
Notification events/sec: ~500K (file changes propagating)

/* ━━━ BANDWIDTH ━━━ */
Upload bandwidth: 70K uploads/sec × 500 KB = 35 GB/sec peak
Download bandwidth: ~2x upload = 70 GB/sec peak (syncing to multiple devices)
```

!!! note "System Nature"
    **Write-heavy with bursty sync reads.** Unlike a URL shortener (100:1 read-write), file storage is roughly 1:3 write-to-read (one upload triggers syncs to ~3 devices). The architecture must optimize for large sequential writes (chunked uploads) AND high-frequency small metadata reads (sync polling). Deduplication is the single biggest cost optimization lever.

---

## 4. "Why X, Not Y?" — Tradeoff Analysis

### Why fixed 4 MB chunks and not variable-size (Rabin fingerprinting)?

**Fixed 4 MB chunks win for simplicity, parallelism, and predictable I/O.** Every chunk is the same size, making upload progress bars accurate, retry logic trivial (re-upload exactly one 4 MB block), and storage allocation predictable. S3/GCS multipart uploads are optimized for fixed-size parts.

*Variable-size (Rabin) advantage:* Content-defined chunking (CDC) detects boundaries based on content, so inserting a byte at the beginning of a file shifts only one chunk boundary — not all of them. This means better deduplication for files with insertions/deletions (e.g., editing the middle of a large text file). Dropbox actually uses variable-size chunking internally for this reason.

### Why push (WebSocket) and not pull (polling) for sync notifications?

**WebSocket wins for real-time sync (<5s) at scale.** With 50M concurrent connections, polling every 5 seconds means 10M requests/sec hitting your notification servers — most returning "no changes." WebSocket maintains a persistent connection and pushes only when there IS a change, reducing server load by 100x for idle users.

*Polling advantage:* Simpler infrastructure (stateless HTTP servers, no connection state to manage). Works better behind corporate proxies that block WebSocket. Dropbox originally used long-polling (30s timeout) as a compromise — the server holds the connection open and responds immediately when a change occurs, or times out and the client reconnects. This avoids the thundering-herd of short-poll while being more proxy-friendly than WebSocket.

### Why content-addressable storage (SHA-256 hash as block ID) and not UUID block IDs?

**Content-addressing enables global deduplication for free.** If two users upload the same 4 MB block (same PDF attachment, same OS library, same photo), the SHA-256 hash is identical — store it once, reference it twice. At 100 PB scale with 60% dedup ratio, this saves 60 PB of storage ($1.2M/month on S3 alone).

*UUID advantage:* Simpler — no hash computation on upload, no collision concerns (SHA-256 collisions are astronomically unlikely but not zero). Updates are cheaper (overwrite a block without checking references). Use UUID if dedup savings don't justify the hash computation cost.

### Why centralized metadata service and not distributed metadata (like a DHT)?

**Centralized metadata (sharded SQL/NoSQL) gives you strong consistency for file operations.** Renaming a folder with 10,000 files must be atomic. Permission checks must be authoritative. A DHT provides eventual consistency — a user might see a file they no longer have access to, or miss a file that was just shared with them.

*DHT advantage:* Infinite horizontal scale with no single-point coordination. Used by systems like IPFS where consistency is less important than availability. For an enterprise file storage product, consistency trumps partition tolerance (CP over AP for metadata).

---

## 5. High-Level Architecture

<div class="arch-diagram" style="background: #FAFBFE; border: 2px solid #E2E8F0; border-radius: 14px; padding: 20px; margin: 24px 0; overflow-x: auto; text-align: center;">
<svg viewBox="0 0 1100 800" xmlns="http://www.w3.org/2000/svg" font-family="Inter,system-ui,sans-serif">
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
  <rect width="1100" height="800" fill="#FAFAFA" rx="8"/>

  <!-- Title -->
  <text x="550" y="28" text-anchor="middle" font-size="18" font-weight="800" fill="#212121">File Storage System — Architecture</text>
  <text x="550" y="48" text-anchor="middle" font-size="11" fill="#757575">500M users | 2B uploads/day | 100 PB storage | 4 MB chunks | SHA-256 dedup | &lt;5s sync</text>

  <!-- ═══ LAYER 1: Clients ═══ -->
  <rect x="40" y="60" width="1020" height="75" rx="10" fill="#E3F2FD" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="76" font-size="10" font-weight="600" fill="#9E9E9E">Client Layer (Desktop / Mobile / Web)</text>
  <rect x="60" y="82" width="220" height="42" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="170" y="99" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">File Watcher</text>
  <text x="170" y="115" text-anchor="middle" font-size="9" fill="#757575">Detects local changes (inotify/FSEvents)</text>
  <rect x="300" y="82" width="220" height="42" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="410" y="99" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Chunker + Hasher</text>
  <text x="410" y="115" text-anchor="middle" font-size="9" fill="#757575">Split file into 4 MB blocks, SHA-256 each</text>
  <rect x="540" y="82" width="220" height="42" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="650" y="99" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Sync Engine</text>
  <text x="650" y="115" text-anchor="middle" font-size="9" fill="#757575">Diff local vs remote, upload/download delta</text>
  <rect x="780" y="82" width="220" height="42" rx="6" fill="#BBDEFB" stroke="#1976D2" stroke-width="1.5" filter="url(#sh)"/>
  <text x="890" y="99" text-anchor="middle" font-size="11" font-weight="600" fill="#0D47A1">Notification Listener</text>
  <text x="890" y="115" text-anchor="middle" font-size="9" fill="#757575">WebSocket / long-poll for push updates</text>

  <!-- ═══ LAYER 2: API Gateway ═══ -->
  <line x1="550" y1="135" x2="550" y2="165" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <polygon points="550,170 620,200 550,230 480,200" fill="#FFF9C4" stroke="#F9A825" stroke-width="1.5"/>
  <text x="550" y="204" text-anchor="middle" font-size="11" font-weight="600" fill="#F57F17">API Gateway / LB</text>

  <!-- ═══ LAYER 3: Services ═══ -->
  <line x1="550" y1="230" x2="550" y2="260" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>
  <rect x="40" y="260" width="1020" height="85" rx="10" fill="#E8F5E9" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="276" font-size="10" font-weight="600" fill="#9E9E9E">Application Services (Stateless, Auto-Scaled)</text>

  <rect x="60" y="285" width="230" height="48" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="175" y="304" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Upload Service</text>
  <text x="175" y="322" text-anchor="middle" font-size="9" fill="#757575">Receives chunks, dedup check, store to S3</text>

  <rect x="310" y="285" width="230" height="48" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="425" y="304" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Metadata Service</text>
  <text x="425" y="322" text-anchor="middle" font-size="9" fill="#757575">File tree, versions, permissions, chunk lists</text>

  <rect x="560" y="285" width="230" height="48" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="675" y="304" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Download Service</text>
  <text x="675" y="322" text-anchor="middle" font-size="9" fill="#757575">Assemble chunks, stream to client</text>

  <rect x="810" y="285" width="230" height="48" rx="6" fill="#C8E6C9" stroke="#388E3C" stroke-width="1.5" filter="url(#sh)"/>
  <text x="925" y="304" text-anchor="middle" font-size="12" font-weight="600" fill="#1B5E20">Notification Service</text>
  <text x="925" y="322" text-anchor="middle" font-size="9" fill="#757575">WebSocket hub, push file change events</text>

  <!-- ═══ LAYER 4: Storage ═══ -->
  <rect x="40" y="380" width="500" height="120" rx="10" fill="#E8EAF6" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="396" font-size="10" font-weight="600" fill="#9E9E9E">Metadata Store</text>
  <line x1="425" y1="333" x2="290" y2="400" stroke="#546E7A" stroke-width="1.2" marker-end="url(#a)"/>

  <path d="M70,420 L70,460 C70,475 210,475 210,460 L210,420" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <ellipse cx="140" cy="420" rx="70" ry="10" fill="#E8EAF6" stroke="#283593" stroke-width="1.5"/>
  <text x="140" y="442" text-anchor="middle" font-size="10" font-weight="600" fill="#1A237E">MySQL (Sharded)</text>
  <text x="140" y="458" text-anchor="middle" font-size="8" fill="#757575">File tree + versions</text>

  <rect x="250" y="415" width="140" height="45" rx="6" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1.5" filter="url(#sh)"/>
  <text x="320" y="434" text-anchor="middle" font-size="11" font-weight="600" fill="#B71C1C">Redis Cache</text>
  <text x="320" y="450" text-anchor="middle" font-size="8" fill="#757575">Hot metadata + dedup index</text>

  <rect x="410" y="415" width="120" height="45" rx="6" fill="#D1C4E9" stroke="#512DA8" stroke-width="1.5" filter="url(#sh)"/>
  <text x="470" y="434" text-anchor="middle" font-size="11" font-weight="600" fill="#311B92">Block Index</text>
  <text x="470" y="450" text-anchor="middle" font-size="8" fill="#757575">SHA-256 → block location</text>

  <!-- ═══ Block Storage ═══ -->
  <rect x="570" y="380" width="490" height="120" rx="10" fill="#FFF3E0" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="582" y="396" font-size="10" font-weight="600" fill="#9E9E9E">Block Storage (Object Store)</text>
  <line x1="175" y1="333" x2="750" y2="400" stroke="#388E3C" stroke-width="1.2" marker-end="url(#ag)"/>
  <text x="460" y="365" font-size="8" fill="#388E3C">upload chunks</text>

  <rect x="590" y="410" width="200" height="50" rx="8" fill="#FFE0B2" stroke="#E65100" stroke-width="1.5" filter="url(#sh)"/>
  <text x="690" y="430" text-anchor="middle" font-size="12" font-weight="700" fill="#BF360C">S3 / GCS</text>
  <text x="690" y="448" text-anchor="middle" font-size="9" fill="#757575">100 PB, 3x replicated, 11 nines durability</text>

  <rect x="820" y="410" width="200" height="50" rx="8" fill="#FFE0B2" stroke="#E65100" stroke-width="1.5" filter="url(#sh)"/>
  <text x="920" y="430" text-anchor="middle" font-size="12" font-weight="700" fill="#BF360C">Cold Tier (Glacier)</text>
  <text x="920" y="448" text-anchor="middle" font-size="9" fill="#757575">Versions older than 90 days</text>

  <!-- ═══ Notification / Message Queue ═══ -->
  <rect x="40" y="540" width="1020" height="70" rx="10" fill="#F3E5F5" stroke="#BDBDBD" stroke-width="1" stroke-dasharray="6,3" filter="url(#sh)"/>
  <text x="52" y="556" font-size="10" font-weight="600" fill="#9E9E9E">Event Bus / Notification Pipeline</text>
  <line x1="925" y1="333" x2="550" y2="555" stroke="#512DA8" stroke-width="1.2" stroke-dasharray="5,3" marker-end="url(#ap)"/>
  <text x="760" y="450" font-size="8" fill="#512DA8">publish change events</text>

  <rect x="60" y="562" width="250" height="38" rx="6" fill="#CE93D8" stroke="#6A1B9A" stroke-width="1.5" filter="url(#sh)"/>
  <text x="185" y="585" text-anchor="middle" font-size="11" font-weight="600" fill="#4A148C">Kafka (Change Events)</text>

  <rect x="340" y="562" width="250" height="38" rx="6" fill="#CE93D8" stroke="#6A1B9A" stroke-width="1.5" filter="url(#sh)"/>
  <text x="465" y="585" text-anchor="middle" font-size="11" font-weight="600" fill="#4A148C">WebSocket Hub (50M conns)</text>

  <rect x="620" y="562" width="250" height="38" rx="6" fill="#CE93D8" stroke="#6A1B9A" stroke-width="1.5" filter="url(#sh)"/>
  <text x="745" y="585" text-anchor="middle" font-size="11" font-weight="600" fill="#4A148C">Push Notification (Mobile)</text>

  <!-- ═══ LEGEND ═══ -->
  <rect x="40" y="650" width="1020" height="35" rx="6" fill="#F5F5F5" stroke="#E0E0E0" stroke-width="1"/>
  <text x="56" y="672" font-size="10" font-weight="700" fill="#757575">Legend:</text>
  <rect x="110" y="663" width="18" height="12" rx="3" fill="#BBDEFB" stroke="#1976D2" stroke-width="1"/>
  <text x="133" y="673" font-size="9" fill="#757575">Client</text>
  <polygon points="193,663 203,669 193,675 183,669" fill="#FFF9C4" stroke="#F9A825" stroke-width="1"/>
  <text x="210" y="673" font-size="9" fill="#757575">Gateway</text>
  <rect x="262" y="663" width="18" height="12" rx="3" fill="#C8E6C9" stroke="#388E3C" stroke-width="1"/>
  <text x="285" y="673" font-size="9" fill="#757575">Service</text>
  <rect x="335" y="663" width="18" height="12" rx="3" fill="#FFCDD2" stroke="#D32F2F" stroke-width="1"/>
  <text x="358" y="673" font-size="9" fill="#757575">Cache</text>
  <ellipse cx="410" cy="669" rx="10" ry="6" fill="#E8EAF6" stroke="#283593" stroke-width="1"/>
  <text x="426" y="673" font-size="9" fill="#757575">SQL DB</text>
  <rect x="476" y="663" width="18" height="12" rx="3" fill="#FFE0B2" stroke="#E65100" stroke-width="1"/>
  <text x="499" y="673" font-size="9" fill="#757575">Object Store</text>
  <rect x="566" y="663" width="18" height="12" rx="3" fill="#CE93D8" stroke="#6A1B9A" stroke-width="1"/>
  <text x="589" y="673" font-size="9" fill="#757575">Event Bus</text>
  <line x1="640" y1="669" x2="665" y2="669" stroke="#546E7A" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="672" y="673" font-size="9" fill="#757575">Data flow</text>
  <line x1="720" y1="669" x2="745" y2="669" stroke="#512DA8" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#ap)"/>
  <text x="752" y="673" font-size="9" fill="#757575">Async/event</text>
</svg>
</div>

---

## 6. Backend Services Explained

### Upload Service
Receives chunked file uploads from clients. Stateless — any instance handles any upload. For each block: (1) compute SHA-256 if not provided by client, (2) check Block Index for dedup, (3) if new, write to S3 via multipart upload, (4) register in Block Index. Supports **resumable uploads** — if connection drops, the client retries only the unacknowledged blocks. Each block upload is idempotent (re-uploading the same hash is a no-op).

### Metadata Service
The brain of the system. Manages the file tree (folders, names, permissions), version history, and block-to-file mappings. Implements **optimistic concurrency control** — every commit includes a `parent_version`, and the service rejects writes with stale parents. Sharded by `user_id` for personal files and by `file_id` for shared files (dual-sharding strategy).

### Download Service
Reconstructs files from blocks. Reads the block list from Metadata Service, fetches blocks from S3 in parallel (8 concurrent reads), and streams the assembled file to the client. For large files, streams blocks as they arrive (no buffering the entire file in memory). Supports **byte-range requests** for partial downloads (e.g., video seeking).

### Notification Service
Maintains persistent connections to all online clients. Uses a **fan-out** model: when a file changes, the service looks up all subscribers (file owner + shared users + other devices of the same user) and pushes the change event. Backed by Kafka for durability — if a client is temporarily disconnected, it receives all missed events on reconnection by providing its last-seen Kafka offset.

---

## 7. Architecture Flow — Editing a File on Your Laptop

A user named **Priya** edits a 10 MB presentation file (`Q4-report.pptx`) on her laptop. She saves it. Here is exactly what happens to sync that change to her phone and her colleague Raj's laptop.

### Phase 1 — Local Detection & Chunking

**T+0ms:** The **File Watcher** (using macOS FSEvents) detects that `Q4-report.pptx` was modified.

**T+10ms:** The **Chunker** splits the 10 MB file into fixed 4 MB blocks:

```text
Block 0: bytes[0 .. 4MB]       → SHA-256 = "a3f8c1..."  (unchanged)
Block 1: bytes[4MB .. 8MB]     → SHA-256 = "7b2e9d..."  (CHANGED — new hash)
Block 2: bytes[8MB .. 10MB]    → SHA-256 = "e5d4a0..."  (unchanged)
```

**T+50ms:** The **Sync Engine** compares the new chunk list against the last-synced version stored locally:

```text
Previous: [a3f8c1, 9f1b3c, e5d4a0]   (3 blocks)
Current:  [a3f8c1, 7b2e9d, e5d4a0]   (3 blocks)
Diff:     Block 1 changed (9f1b3c → 7b2e9d)
```

Only **Block 1 (4 MB)** needs to be uploaded — not the entire 10 MB file. This is **delta sync**.

### Phase 2 — Upload Changed Blocks

**T+100ms:** Client sends block upload request to the **Upload Service**:

```text
PUT /blocks/7b2e9d...
Content-Length: 4194304
X-Upload-Id: resume-token-xyz
Body: <4 MB binary>
```

**T+120ms:** Upload Service checks the **Block Index** (Redis): does block `7b2e9d...` already exist?

- **Dedup HIT** (another user already uploaded identical content): Skip storage, just record a reference. Upload completes in 20ms.
- **Dedup MISS** (new content): Write to S3, then register in Block Index.

**T+2100ms:** Block stored in S3 (2 seconds for 4 MB on a typical connection).

### Phase 3 — Update Metadata

**T+2150ms:** Client calls the **Metadata Service** to commit the new file version:

```text
POST /files/q4-report-id/versions
{
  "blocks": ["a3f8c1", "7b2e9d", "e5d4a0"],
  "size": 10485760,
  "checksum": "full-file-sha256",
  "parent_version": 14
}
```

**T+2160ms:** Metadata Service validates: is `parent_version: 14` still the latest? Yes — no conflict. It creates version 15 and publishes a change event to Kafka.

### Phase 4 — Notify Other Devices

**T+2200ms:** The **Notification Service** picks up the Kafka event and pushes it to all subscribers:

- Priya's phone (connected via WebSocket): receives `{file: "q4-report-id", version: 15, changed_blocks: ["7b2e9d"]}`
- Raj's laptop (connected via long-poll): response released with the change event

**T+2500ms:** Priya's phone's Sync Engine downloads only block `7b2e9d` (4 MB), reconstructs the file from cached blocks 0 and 2 + new block 1. File is now in sync.

```text
Total: 10 MB file edited → only 4 MB uploaded + 4 MB downloaded per device
Latency: ~2.5 seconds end-to-end (dominated by network transfer)
```

---

### Phase 5 — Dedup in Action (Raj Uploads the Same Attachment)

Meanwhile, **Raj** receives the same `Q4-report.pptx` via email and uploads it to his own Drive folder. His client chunks the file and sends the block hashes to the Upload Service.

**T+0ms:** Upload Service receives block hashes: `["a3f8c1", "7b2e9d", "e5d4a0"]`

**T+5ms:** Block Index lookup: ALL THREE hashes already exist (from Priya's earlier upload).

**T+6ms:** Upload Service responds: `{status: "all_blocks_deduplicated", bytes_stored: 0}`

Raj's file is now "uploaded" — but **zero additional bytes were stored on S3**. The Metadata Service creates a new file entry for Raj pointing to the same three blocks. The `ref_count` for each block increases from 1 to 2. This is the power of content-addressable storage.

```text
Storage saved: 10 MB (100% dedup for this upload)
At 500M users with 60% avg dedup: ~60 PB saved = $1.2M/month
```

---

## 8. Failure & Recovery Scenarios

### Upload Interrupted Mid-Transfer

**Impact:** User closes laptop while uploading block 2 of a 25-block video file. 23 blocks are already stored.

**Mitigation:** Uploads are **idempotent and resumable**. Each block upload has a unique `upload_id`. On reconnection, the client asks the server "which blocks do you already have for this file version?" The server responds with the list of received block hashes. Client resumes from block 24 — no re-upload of the 23 completed blocks. This is identical to S3's multipart upload protocol.

### Metadata Service Crashes

**Impact:** No new file versions can be committed. Uploads of raw blocks to S3 can continue (stateless), but the file tree is frozen.

**Mitigation:** Metadata Service is horizontally scaled behind a load balancer. If one instance dies, others continue serving. The MySQL metadata database uses synchronous replication with automatic failover (<30s). During failover, clients receive 503 and retry with exponential backoff — their local file watcher queues changes.

### Notification Service Goes Down

**Impact:** Devices stop receiving push updates. Files eventually sync when the client's periodic full-sync poll runs (every 5 minutes), but real-time sync is lost.

**Mitigation:** WebSocket Hub is stateless — connections are distributed across N servers. If one server dies, clients reconnect to another. The change events are durably stored in Kafka — on reconnection, the client provides its last-seen event offset and receives all missed changes (no data loss, just delayed delivery).

### S3 Region Becomes Unavailable

**Impact:** Block downloads fail for files stored in that region. Uploads to that region fail.

**Mitigation:** Cross-region replication. Every block is replicated to at least 2 regions asynchronously. If us-east-1 is down, the Download Service reads from us-west-2. Metadata stores the block's replica locations. RPO (Recovery Point Objective) for replication lag: <15 minutes.

### Conflict: Two Users Edit Same File Offline

**Impact:** Priya edits the file on her laptop (airplane mode) while Raj edits the same file. Both come online and try to commit.

**Mitigation:** **Last-Writer-Wins with conflict copies.** When Priya commits, the Metadata Service checks if `parent_version` matches the current head version. If Raj already committed version 15, Priya's commit (also based on version 14) is rejected. The client saves Priya's version as `Q4-report (Priya's Conflicted Copy).pptx` and syncs it as a new file. Users manually merge. This is exactly how Dropbox handles conflicts.

---

## 9. Data Model

```text
/* MySQL — Sharded by user_id for file tree, by file_id for sharing */

CREATE TABLE files (
    file_id         BIGINT       PRIMARY KEY,
    parent_folder   BIGINT       NOT NULL,       -- self-referencing for tree
    owner_id        BIGINT       NOT NULL,
    name            VARCHAR(255) NOT NULL,
    is_folder       BOOLEAN      DEFAULT FALSE,
    current_version INT          NOT NULL,
    size_bytes      BIGINT,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW(),
    is_deleted      BOOLEAN      DEFAULT FALSE,  -- soft delete for versioning
    UNIQUE (parent_folder, name, owner_id)       -- no duplicate names in a folder
);

CREATE TABLE file_versions (
    file_id     BIGINT   NOT NULL,
    version     INT      NOT NULL,
    block_list  TEXT[]   NOT NULL,               -- ordered array of block hashes
    size_bytes  BIGINT   NOT NULL,
    checksum    CHAR(64) NOT NULL,               -- SHA-256 of full file
    created_by  BIGINT   NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (file_id, version)
);

CREATE TABLE blocks (
    block_hash   CHAR(64)    PRIMARY KEY,        -- SHA-256 (content-addressable)
    size_bytes   INT         NOT NULL,
    storage_url  TEXT        NOT NULL,           -- s3://bucket/path
    ref_count    INT         DEFAULT 1,          -- for garbage collection
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sharing (
    file_id      BIGINT      NOT NULL,
    user_id      BIGINT      NOT NULL,
    permission   VARCHAR(10) NOT NULL,           -- 'view', 'edit', 'owner'
    granted_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (file_id, user_id)
);

CREATE INDEX idx_files_parent ON files (parent_folder, owner_id);
CREATE INDEX idx_versions_file ON file_versions (file_id, version DESC);
CREATE INDEX idx_blocks_refcount ON blocks (ref_count) WHERE ref_count = 0;
```

```text
/* Redis — Key structures */

// Dedup index (block existence check)
EXISTS block:a3f8c1e2...   → 1 (exists) or 0 (new block, must upload)

// File metadata cache (hot files)
HGETALL file:12345
  → {name: "Q4-report.pptx", version: 15, size: 10485760, updated: "..."}

// User's sync cursor (last-seen event)
GET sync_cursor:user:789  → "kafka-offset:4521890"
```

---

## 10. Algorithms Under the Hood

### File Chunking (Fixed-Size)

```text
CHUNK_SIZE = 4 * 1024 * 1024  // 4 MB

function chunk_file(file_path):
    chunks = []
    file = open(file_path, "rb")
    while True:
        data = file.read(CHUNK_SIZE)
        if data is empty:
            break
        hash = SHA256(data)
        chunks.append({hash: hash, data: data, offset: len(chunks)})
    return chunks

// Example: 10 MB file → 3 chunks (4MB, 4MB, 2MB)
// Each chunk identified by its SHA-256 hash
```

### Content-Addressable Deduplication

```text
function upload_block(block_hash, block_data):
    // Step 1: Check if block already exists (O(1) lookup)
    exists = redis.EXISTS("block:" + block_hash)
    if exists:
        // Dedup hit! Just increment reference count
        db.execute("UPDATE blocks SET ref_count = ref_count + 1 WHERE block_hash = $1", block_hash)
        return {status: "deduped", stored: false}

    // Step 2: New block — store in object storage
    storage_url = s3.put_object(
        bucket = "file-blocks",
        key = block_hash,             // content-addressable key
        body = block_data,
        content_md5 = MD5(block_data) // integrity check
    )

    // Step 3: Register in block index
    db.execute(
        "INSERT INTO blocks (block_hash, size_bytes, storage_url, ref_count) VALUES ($1, $2, $3, 1)",
        block_hash, len(block_data), storage_url
    )
    redis.SET("block:" + block_hash, 1)

    return {status: "stored", url: storage_url}
```

### Delta Sync Protocol

```text
function sync_file_change(file_id, new_blocks[]):
    // Step 1: Get current server-side block list
    current = metadata_service.get_block_list(file_id)
    // current = ["a3f8c1", "9f1b3c", "e5d4a0"]

    // Step 2: Diff against new version
    // new_blocks = ["a3f8c1", "7b2e9d", "e5d4a0"]
    blocks_to_upload = []
    for i in range(len(new_blocks)):
        if new_blocks[i] != current[i]:
            blocks_to_upload.append(new_blocks[i])
    // blocks_to_upload = ["7b2e9d"]  ← only 1 changed block!

    // Step 3: Upload only changed blocks
    for block_hash in blocks_to_upload:
        upload_block(block_hash, local_block_data[block_hash])

    // Step 4: Commit new version (optimistic concurrency)
    result = metadata_service.commit_version(
        file_id = file_id,
        blocks = new_blocks,
        parent_version = last_known_version  // optimistic lock
    )
    if result.conflict:
        handle_conflict(file_id, new_blocks)

    return result
```

### Resumable Upload Protocol

```text
// Server tracks upload progress per file_version attempt
function get_upload_status(file_id, upload_session_id):
    // Returns which blocks the server has already received
    received = db.query(
        "SELECT block_hash FROM upload_progress WHERE session_id = $1",
        upload_session_id
    )
    return received  // e.g., ["a3f8c1", "e5d4a0"] — 2 of 3 blocks done

function resume_upload(file_id, upload_session_id, all_blocks):
    received = get_upload_status(file_id, upload_session_id)
    remaining = all_blocks - received
    // remaining = ["7b2e9d"] — only 1 block left to upload
    for block in remaining:
        upload_block(block.hash, block.data)
        db.execute(
            "INSERT INTO upload_progress (session_id, block_hash) VALUES ($1, $2)",
            upload_session_id, block.hash
        )
    // All blocks uploaded — commit the version
    commit_version(file_id, all_blocks, parent_version)
```

### Conflict Resolution (Last-Writer-Wins)

```text
function commit_version(file_id, blocks, parent_version):
    BEGIN TRANSACTION
    current_version = SELECT current_version FROM files WHERE file_id = $1 FOR UPDATE

    if current_version != parent_version:
        // Conflict detected! Someone else committed while we were editing
        ROLLBACK
        return {conflict: true, server_version: current_version}

    new_version = current_version + 1
    INSERT INTO file_versions (file_id, version, block_list) VALUES ($1, new_version, blocks)
    UPDATE files SET current_version = new_version, updated_at = NOW() WHERE file_id = $1
    COMMIT

    // Publish change event for sync
    kafka.produce("file-changes", {file_id, version: new_version, blocks})
    return {conflict: false, version: new_version}

function handle_conflict(file_id, my_blocks):
    // Create a conflict copy (Dropbox-style)
    original_name = get_file_name(file_id)
    conflict_name = original_name.replace(".pptx", " (Conflicted Copy - " + username + ").pptx")
    create_new_file(conflict_name, my_blocks)
    notify_user("Conflict detected. Your version saved as: " + conflict_name)
```

---

## 11. Scaling Considerations

| Challenge | Solution | Numbers |
|---|---|---|
| 100 PB storage cost | Content-addressable dedup (60% savings) + cold tier after 90 days | Saves ~$1.2M/month on S3 |
| 2B uploads/day | Horizontal Upload Service + S3 multipart (parallel chunk uploads) | Each server handles ~5K uploads/sec |
| 50M concurrent WebSocket connections | Shard by user_id across WebSocket Hub nodes | 1M connections per server × 50 servers |
| Metadata hotspot (popular shared folders) | Cache file tree in Redis; shard by user_id for personal files, by file_id for shared | Redis serves 95%+ metadata reads |
| Global latency (users in 100+ countries) | Multi-region S3 with CDN for downloads; metadata replicated to 3 regions | <100ms metadata read anywhere |
| Thundering herd on large shared folder change | Fan-out notifications via Kafka partitioned by user_id | Spread 1M notifications over 60s, not instant |
| Block garbage collection (dedup ref_count = 0) | Async GC job scans blocks with ref_count = 0, deletes from S3 after 30-day grace period | Reclaims ~5% storage monthly |
| Version history explosion | Keep last 30 versions in hot storage, archive older to Glacier | 90% of restores are <7 days old |
| Search across files | Async indexing pipeline: on upload, extract text (OCR for images, Apache Tika for docs) → Elasticsearch | Sub-second full-text search across 100B files |
| Mobile bandwidth constraints | Client-side smart sync: only download file headers, fetch full content on open; prefer Wi-Fi for large uploads | 80% bandwidth reduction on mobile |
| Ransomware protection | Immutable versions for 30 days (cannot be deleted even by file owner); anomaly detection on bulk-encrypt patterns | Auto-freeze account on suspicious activity |

---

## 12. What If the Interviewer Pushes Back?

??? question "How do you handle a 50 GB video file upload?"
    **Adapt:** A 50 GB file = 12,500 chunks at 4 MB each. The client uploads chunks in parallel (8 concurrent uploads), with each chunk being an independent S3 multipart-upload part. If the connection drops after 10,000 chunks, the client resumes from chunk 10,001 — no re-upload. Total upload time: 50 GB / 100 Mbps connection = ~67 minutes. With 8 parallel streams: ~8.5 minutes. We show a progress bar based on completed chunks (granular feedback every 4 MB). For users on slow connections, we suggest the web uploader which runs in background.

??? question "What if two users edit the same Google Doc simultaneously — isn't your conflict model too coarse?"
    **Adapt:** You're right — for real-time collaborative editing (Google Docs style), "conflict copies" are a terrible UX. For that use case, you need **Operational Transforms (OT)** or **CRDTs** to merge character-level edits in real-time. But the question asks for file storage (Dropbox/Drive), where the unit of editing is an opaque binary file (Word doc, Photoshop file). The application doesn't understand the file format — it can only do whole-file versioning. If the interviewer wants collaborative editing, that's a separate subsystem layered on top (like Google Docs' OT engine that operates on structured documents, not raw bytes).

??? question "Content-addressable storage means SHA-256 collisions would corrupt data. How do you handle that?"
    **Defend:** SHA-256 has 2^256 possible outputs. The probability of a collision in 10^18 blocks (far more than we'll ever store) is approximately 10^-39 — more likely that a cosmic ray flips your RAM bits. But for defense-in-depth: we store the block size alongside the hash and verify it on download. If paranoid (e.g., US government compliance), use SHA-256 + a secondary hash (Blake3) as a composite key — two independent hash collisions on the same block is statistically impossible.

??? question "Why not use a distributed file system (HDFS/Ceph) instead of S3?"
    **Defend:** S3/GCS gives us 11 nines of durability out of the box, with zero operational overhead for replication, healing, and hardware failures. HDFS requires managing DataNodes, handling disk failures, rebalancing data — significant ops burden. At 100 PB, S3's cost ($0.023/GB/month = $2.3M/month) is steep but predictable. HDFS on-prem is cheaper per GB but requires a dedicated storage team of 10+ engineers ($2M+/year in salary). For a startup, S3 wins. For Google/Dropbox at exabyte scale, a custom distributed FS (like Google's Colossus or Dropbox's Magic Pocket) makes economic sense.

??? question "How do you prevent a single user from consuming unlimited storage?"
    **Defend:** Quotas enforced at the Metadata Service layer. Each user has a `storage_quota` (e.g., 15 GB free, 2 TB paid). On every `commit_version`, we compute the delta in storage (new blocks' total size minus blocks that became unreferenced) and check against quota. If over quota, reject with 429 and a clear error. Deduplication is transparent to the user — their quota is based on logical file size, not physical storage. This means uploading a file that's 100% deduplicated still counts against your quota (same as Dropbox behavior).

??? question "50M concurrent WebSocket connections — isn't that expensive to maintain?"
    **Adapt:** Yes. Each WebSocket connection consumes ~10 KB of memory (kernel socket buffer + application state). 50M connections × 10 KB = 500 GB of RAM across the fleet — that's 50 servers with 10 GB each for connection state alone. Alternative: **long-polling with 60s timeout**. Idle users (80%) use long-poll (cheaper, stateless). Active users (currently editing) upgrade to WebSocket for sub-second sync. This reduces concurrent WebSocket connections from 50M to ~10M while maintaining the same real-time experience for active editors.

??? question "How does the system handle folder renames when the folder contains 100K files?"
    **Defend:** Folder rename is a **metadata-only operation** — no blocks are moved on S3. The `files` table uses a `parent_folder` foreign key, so renaming a folder is a single row update (`UPDATE files SET name = 'new-name' WHERE file_id = folder_id`). Child files don't change. If you use full paths as keys (bad design), renaming requires updating 100K rows — this is why we use parent pointers (adjacency list) instead of materialized paths. The sync notification for a folder rename includes the folder ID only; clients reconstruct the new full path locally from their cached tree.

??? question "What about end-to-end encryption — can the server still do deduplication?"
    **Adapt:** No — this is a fundamental tradeoff. If files are encrypted client-side with per-user keys, identical plaintext produces different ciphertext, making content-addressable dedup impossible. Options: (1) **Convergent encryption** — derive the encryption key from the content hash (same plaintext = same key = same ciphertext). This enables dedup but leaks information (attacker can confirm whether a specific plaintext exists). (2) **Server-side encryption** — encrypt at rest with a service-managed key. The server can dedup before encrypting. This is what Dropbox and Google Drive do — they offer encryption at rest but NOT end-to-end. For true E2E (like Tresorit), you sacrifice dedup and accept higher storage costs.

---

## 13. Quick Recall

| Question | Answer |
|---|---|
| Chunk size? | Fixed 4 MB blocks (simple, parallelizable, resumable) |
| Block ID? | SHA-256 hash of content (content-addressable) |
| Dedup mechanism? | Same hash = same content = store once, ref_count++ |
| Sync protocol? | Client sends block list, server diffs, upload only changed blocks |
| Conflict resolution? | Optimistic concurrency on version number; conflict = save copy |
| Notification mechanism? | WebSocket for active users, long-poll for idle, Kafka as event bus |
| Storage durability? | S3/GCS with 11 nines, 3x replication, cross-region backup |
| Metadata store? | Sharded MySQL + Redis cache for hot paths |
| Resumable uploads? | Each block is independent; resume = re-upload only missing blocks |
| Scale numbers? | 500M users, 2B uploads/day, 100 PB storage, 50M concurrent connections |
| Cost optimization? | Dedup (60% savings) + cold tier (Glacier for old versions) |
| Garbage collection? | Async job deletes blocks with ref_count=0 after 30-day grace period |
