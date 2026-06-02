# DNS in 5 Minutes

!!! danger "Real Incident: Dyn DDoS (October 2016)"
    Mirai botnet — 100K+ IoT devices — flooded DNS provider Dyn with 1.2 Tbps. Twitter, GitHub, Netflix, Reddit all unreachable for hours. The sites were running fine — nobody could resolve their names. **DNS is the most critical single point of failure on the internet.**

---

## The One-Liner

DNS translates human-readable domain names (google.com) into machine-readable IP addresses (142.250.80.46).

---

## How It Works

```mermaid
flowchart LR
    B[Browser] -->|1| RC[Recursive Resolver]
    RC -->|2| ROOT[Root Server]
    ROOT -->|3 ".com NS"| RC
    RC -->|4| TLD[.com TLD]
    TLD -->|5 "stripe.com NS"| RC
    RC -->|6| AUTH[Authoritative NS]
    AUTH -->|7 "104.21.5.77"| RC
    RC -->|8| B

    style ROOT fill:#e74c3c,color:#fff
    style TLD fill:#f39c12,color:#fff
    style AUTH fill:#27ae60,color:#fff
```

- Browser → OS cache → Recursive resolver → Root → TLD → Authoritative → IP returned
- **Uncached**: ~100-200ms (3-4 network hops)
- **Cached**: <5ms (resolver already knows)
- With 300s TTL and 1000 req/s: only 1 in 300,000 requests triggers full resolution (**99.9997% cache hit**)

---

## Key Record Types

| Record | Maps | Example | Use Case |
|---|---|---|---|
| **A** | Domain → IPv4 | `stripe.com → 104.21.5.77` | Standard resolution |
| **AAAA** | Domain → IPv6 | `stripe.com → 2606:4700::` | IPv6 |
| **CNAME** | Domain → Domain | `www.stripe.com → stripe.com` | Aliases |
| **MX** | Domain → Mail server | `stripe.com → mail.stripe.com` | Email routing |
| **NS** | Domain → Name server | `stripe.com → ns1.stripe.com` | Delegation |
| **TXT** | Domain → Text | `stripe.com → "v=spf1..."` | Verification, SPF |

---

## Key Trade-offs

| Low TTL (30s) | High TTL (86400s) |
|---|---|
| Fast failover | Slow failover |
| More DNS queries (cost) | Fewer queries (cheaper) |
| Always fresh | May serve stale IPs |
| Good for dynamic infra | Good for stable services |

---

## Interview Cheat Sheet

- "DNS is hierarchical: Root → TLD → Authoritative. Caching at every level."
- "GeoDNS for global load balancing — resolve to nearest datacenter's IP"
- "Low TTL (30-60s) before migrations so old IPs drain quickly"
- "Multi-provider DNS (Route53 + Cloudflare) for resilience against provider-level attacks"
- "DNS prefetching in browsers: `<link rel='dns-prefetch' href='//api.example.com'>`"

---

## When to Use / When NOT to Use

| DNS Feature | Use When | Avoid When |
|---|---|---|
| **GeoDNS** | Global users, multi-region deploy | Single region |
| **Low TTL** | Active migration, failover needed | Stable infrastructure |
| **DNS load balancing** | Simple round-robin across IPs | Need session affinity or health checks |
| **Private DNS** | Internal service discovery | Public-facing services |

---

## Go Deeper

[Full DNS Deep Dive →](../dns.md)
