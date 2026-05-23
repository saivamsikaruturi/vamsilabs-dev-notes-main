# CAP Theorem

!!! danger "Real Incident: GitHub, October 2018"
    A 43-second network partition split GitHub's MySQL cluster. Both sides promoted a primary. Two databases accepted writes simultaneously. Result: **24 hours of degraded service**, millions of developers affected. This is CAP theorem hitting production.

---

## The 30-Second Explanation

<img src="../assets/images/system-design/cap-theorem.svg" alt="CAP Theorem" style="max-width: 400px; width: 100%; display: block; margin: 0 auto;" />

**In a distributed system, when a network partition happens, you must choose:**

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin: 2rem 0;">
<div style="background: linear-gradient(135deg, #fee2e2, #fef2f2); border: 2px solid #f87171; border-radius: 12px; padding: 1.5rem; text-align: center;">
<div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔒</div>
<h4 style="margin: 0 0 0.5rem; color: #dc2626;">Consistency (CP)</h4>
<p style="margin: 0; font-size: 0.9rem; color: #7f1d1d;">"I'd rather show an error than wrong data"</p>
<p style="margin: 0.5rem 0 0; font-size: 0.8rem; color: #991b1b;"><strong>Banks, inventory, bookings</strong></p>
</div>
<div style="background: linear-gradient(135deg, #dbeafe, #eff6ff); border: 2px solid #60a5fa; border-radius: 12px; padding: 1.5rem; text-align: center;">
<div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🌐</div>
<h4 style="margin: 0 0 0.5rem; color: #2563eb;">Availability (AP)</h4>
<p style="margin: 0; font-size: 0.9rem; color: #1e3a5f;">"I'd rather show stale data than nothing"</p>
<p style="margin: 0.5rem 0 0; font-size: 0.8rem; color: #1e40af;"><strong>Social feeds, DNS, shopping carts</strong></p>
</div>
</div>

> **The key insight:** You're not choosing between C, A, and P. Partitions are inevitable. You're choosing between **C and A when a partition happens.**

---

## The Pizza Shop Analogy

You own 3 pizza shops in SF, NYC, and Chicago. All must serve the same menu.

**The phone lines between shops go down** (partition). A customer in Chicago asks for a pizza you just added in SF 5 minutes ago.

| You choose... | What happens | Real-world equivalent |
|:---:|---|---|
| **Consistency** | "Sorry, system is down. Come back later." | Banking app during outage |
| **Availability** | "Here's our menu!" (missing the new pizza) | Netflix showing stale recommendations |

That's it. That's the entire theorem.

---

## What FAANG Interviewers Actually Ask

### "Given this system, would you choose CP or AP?"

**Framework to answer:**

| If the data is... | Choose | Because | Example |
|---|:---:|---|---|
| Financial / transactional | **CP** | Wrong balance = lawsuit | Stripe, banks |
| User-generated content | **AP** | Stale likes > error page | Instagram, Twitter |
| Inventory / booking | **CP** | Overselling = real money lost | Uber seats, airline tickets |
| Session / preference | **AP** | Show old settings > force re-login | Netflix, Spotify |
| Leader election / config | **CP** | Split-brain = catastrophe | ZooKeeper, etcd |

---

## Real Systems Mapped

<div style="overflow-x: auto; margin: 1.5rem 0;">
<table style="width: 100%; border-collapse: collapse;">
<thead>
<tr style="background: linear-gradient(135deg, #f8fafc, #f1f5f9);">
<th style="padding: 0.8rem; border-bottom: 2px solid #e2e8f0; text-align: left;">System</th>
<th style="padding: 0.8rem; border-bottom: 2px solid #e2e8f0; text-align: center;">Choice</th>
<th style="padding: 0.8rem; border-bottom: 2px solid #e2e8f0; text-align: left;">What happens during partition</th>
</tr>
</thead>
<tbody>
<tr><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9;"><strong>ZooKeeper</strong></td><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9; text-align: center;">🔒 CP</td><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9;">Minority side stops accepting writes. Waits for quorum.</td></tr>
<tr><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9;"><strong>etcd</strong></td><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9; text-align: center;">🔒 CP</td><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9;">Raft consensus — no leader = no writes.</td></tr>
<tr><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9;"><strong>Google Spanner</strong></td><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9; text-align: center;">🔒 CP</td><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9;">TrueTime + Paxos. Blocks rather than diverge.</td></tr>
<tr><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9;"><strong>Cassandra</strong></td><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9; text-align: center;">🌐 AP</td><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9;">Every node accepts writes. Resolves conflicts later (last-write-wins).</td></tr>
<tr><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9;"><strong>DynamoDB</strong></td><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9; text-align: center;">🌐 AP</td><td style="padding: 0.7rem; border-bottom: 1px solid #f1f5f9;">Eventually consistent by default. Strong consistency optional (costs 2x).</td></tr>
<tr><td style="padding: 0.7rem;"><strong>MongoDB</strong></td><td style="padding: 0.7rem; text-align: center;">🔒 CP</td><td style="padding: 0.7rem;">Primary goes down → election (10-30s downtime). Reads can be stale on secondaries.</td></tr>
</tbody>
</table>
</div>

---

## PACELC — The Follow-Up They Always Ask

> "OK, so you know CAP. What about when there's NO partition?"

**PACELC** extends CAP: if **P**artition → choose **A** or **C**. **E**lse (normal operation) → choose **L**atency or **C**onsistency.

| System | During Partition | Normal Operation |
|---|:---:|:---:|
| Cassandra | **A** (stay available) | **L** (fast, eventually consistent) |
| DynamoDB | **A** | **L** (default) or **C** (strong reads cost 2x) |
| ZooKeeper | **C** (refuse writes) | **C** (always consistent, higher latency) |
| Spanner | **C** | **C** (TrueTime makes it fast despite consistency) |
| MongoDB | **C** | **L** (reads from secondaries are faster but stale) |

!!! tip "Interview Gold"
    When an interviewer asks "What's the trade-off of using DynamoDB?" — answer with PACELC: "It's PA/EL by default. Available during partitions, low-latency in normal operation, but eventually consistent. You can opt into strong consistency per-read at 2x cost."

---

## Consistency Models (From Strict to Relaxed)

| Model | Promise | Real-World Feel |
|---|---|---|
| **Linearizability** | Every read sees the absolute latest write | Your bank balance — always correct |
| **Sequential** | All nodes agree on ordering, maybe slightly behind | A shared Google Doc |
| **Causal** | If A caused B, everyone sees A before B | Chat messages in order |
| **Eventual** | Everyone will *eventually* agree | Instagram like count (might be off by a few) |

---

## The 3 Interview Mistakes That Get You Rejected

!!! danger "Don't Say These"
    1. **"Just pick CP for everything"** — Shows you don't understand the trade-off. No interviewer wants a system that goes down during every network blip.
    2. **"CA is a valid option"** — In any real distributed system, partitions WILL happen. CA only exists on a single machine (not distributed).
    3. **"Eventual consistency means data loss"** — No. It means temporary staleness. All writes are eventually propagated. No data is lost.

---

## Your Interview Answer Template

When asked "How would you handle consistency in [System X]?"

> "For [specific use case], I'd choose [CP/AP] because [reason tied to business impact]. During normal operation, I'd optimize for [latency/consistency]. Specifically, I'd use [real system] which gives me [specific guarantee]. For the parts that need [opposite choice], I'd use a separate store — for example [second system] for [that specific data]."

**Example:** "For the payment service, I'd choose CP using PostgreSQL with synchronous replication — a wrong balance is worse than brief unavailability. But for the activity feed, I'd use Cassandra (AP) because showing a slightly stale feed is fine, and we need sub-10ms reads globally."

---

## Quick Recall Card

| Question | Answer |
|---|---|
| What is CAP? | During a partition, choose Consistency or Availability |
| Why not both? | Partitions are inevitable in distributed systems |
| CP examples? | ZooKeeper, etcd, Spanner, HBase, MongoDB |
| AP examples? | Cassandra, DynamoDB, CouchDB, DNS |
| What's PACELC? | Extends CAP: what do you trade-off when there's NO partition? |
| Most common mistake? | Treating it as "pick 2 of 3" instead of "CP or AP during partition" |
