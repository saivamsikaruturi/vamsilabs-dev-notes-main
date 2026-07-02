---
title: "Service Discovery — System Design Interview (2026)"
description: "Any microservices design triggers: \"How does Service A find Service B?\" This appears in:"
---

# Service Discovery

!!! danger "Real Incident: Netflix AWS Outage, 2012"
    During an AWS failure, Netflix's CP-oriented discovery system refused to serve stale data during the network partition. Services couldn't find each other — even though most were still running. The discovery system was "correct" (consistent) but useless (unavailable). Netflix built Eureka with AP guarantees: "We'd rather have a slightly wrong answer than no answer at all." **In service discovery, availability beats consistency — a stale registry that says instance X is alive causes a few retried requests. An unavailable registry causes total system failure.**

---

## Why This Comes Up in Interviews

Any microservices design triggers: "How does Service A find Service B?" This appears in:

- "How do your services communicate?" → Need to locate instances first
- "What happens when you scale up/down?" → New instances need to be discoverable
- "How do you handle instance failures?" → Dead instances must be removed from routing
- "How does your load balancer know the backends?" → Service registry feeds it

Understanding the trade-offs (CP vs AP, client-side vs server-side, DNS vs registry) separates junior from senior answers.

---

## The Problem: Nothing Stays Still

In microservices, a single request might hit 5-10 services. Each service has 50+ instances spread across availability zones. Instances are created and destroyed by auto-scalers every few minutes. Deploys roll out new containers while killing old ones.

**The anti-pattern that never dies:** Hardcoding IP addresses in config files. One infrastructure change, one VM migration, one container restart — and half your services send requests to an IP that no longer exists.

---

## DNS-Based Discovery — The Simplest Approach

**How:** Register services as DNS records. `user-service.internal.company.com` resolves to healthy instance IPs.

| Aspect | Detail |
|---|---|
| Protocol | Standard DNS (A records, SRV records) |
| Universal | Every language/framework does DNS lookups |
| Health checking | Not built in (must layer on top) |
| Metadata | Can't attach tags like "version=2.1" to records |

**The killer problem: TTL caching.**

| TTL Setting | Problem |
|---|---|
| 60 seconds | Instance dies → clients send traffic to dead IP for up to 60s |
| 5 seconds | DNS server drowns under query volume |
| 0 seconds | Many libraries cache anyway (Java's `InetAddress` caches forever by default) |

**Still used:** Kubernetes (CoreDNS), Consul (DNS interface), AWS Route 53 service discovery. The trick is layering health checks and faster propagation on top.

---

## Client-Side vs Server-Side Discovery

| Aspect | Client-Side (Netflix Model) | Server-Side (Kubernetes Model) |
|---|---|---|
| **How** | Client queries registry, picks instance, does LB itself | Client sends to proxy/LB, proxy queries registry and routes |
| **Client complexity** | Smart (needs discovery library + LB logic) | Dumb (just a hostname) |
| **Infrastructure** | Simple (no proxy in path) | Proxy required (ALB, Envoy, kube-proxy) |
| **SPOF** | No proxy bottleneck | Proxy is potential SPOF |
| **Routing intelligence** | Client can make latency-aware, zone-aware decisions | Proxy decides (less app-specific context) |
| **Language support** | Every language needs a discovery library | Language-agnostic (any HTTP client works) |
| **Used by** | Netflix Eureka + Ribbon, gRPC client-side LB | AWS ALB, Kubernetes Services, Envoy, Nginx |

**Industry trend:** Moving toward server-side discovery via service meshes (Istio, Linkerd). The sidecar proxy handles discovery — application code doesn't know it's happening.

---

## Service Registries Compared

### ZooKeeper — The Original Coordinator

- Built at Yahoo (late 2000s) for distributed coordination, not discovery specifically
- **Ephemeral znodes:** Service creates a node; if heartbeat stops → node auto-deleted → watchers notified
- CP system (ZAB consensus) — during partition, minority side becomes unavailable
- Operationally complex: sessions, watches, recipes, JVM GC tuning

### etcd — Kubernetes' Brain

- Distributed KV store using Raft consensus
- **Leases:** Write key with TTL → auto-expires if not renewed → watchers notified
- Simpler API than ZooKeeper (HTTP/gRPC)
- ALL Kubernetes state lives in etcd (pods, services, deployments, secrets)

### Consul — Built for Service Discovery

- HashiCorp. The ONLY registry in this list built specifically for service discovery from day one
- Combines: service registry + health checking + KV store + multi-datacenter
- Raft (servers) + Gossip/SWIM (agents) — detects failure in <2 seconds across 10,000 nodes
- Speaks DNS natively: `user-svc.service.consul` resolves to healthy instances
- Rich health checks: HTTP, TCP, gRPC, TTL, script

### Eureka — Netflix's AP Registry

- Deliberately AP (available during partitions, eventually consistent)
- Clients cache registry locally, refresh every 30 seconds
- **Self-preservation:** When too many instances fail heartbeats simultaneously (probably network issue), Eureka stops evicting and preserves last known good state
- If ALL Eureka servers die, clients work from local cache

---

## Registry Comparison Table

| Registry | Consensus | CAP | Health Checks | Multi-DC | Primary Use |
|---|---|---|---|---|---|
| **ZooKeeper** | ZAB | CP | Session heartbeats | Observer mode | Kafka, HBase, Solr coordination |
| **etcd** | Raft | CP | Leases (TTL) | No native | Kubernetes cluster state |
| **Consul** | Raft + Gossip | CP (servers) + AP (agents) | HTTP, TCP, gRPC, TTL, script | Native WAN federation | Service mesh, discovery, KV |
| **Eureka** | Peer-to-peer async | AP | Client heartbeat | Via zone replication | Netflix microservices on AWS |

---

## Kubernetes Service Discovery

In Kubernetes, service discovery is built-in and invisible:

| Component | Role |
|---|---|
| **CoreDNS** | Resolves service names → ClusterIP |
| **Service (ClusterIP)** | Virtual IP that load-balances to backing pods |
| **Endpoints** | Automatically updated list of healthy pod IPs |
| **kube-proxy** | Programs iptables/IPVS rules for traffic routing |

**How it works:**

1. Create a Service YAML: `name: user-svc`, selector matches pods with label `app=user-svc`
2. Kubernetes assigns a virtual ClusterIP (e.g., `10.96.0.42`)
3. CoreDNS creates: `user-svc.default.svc.cluster.local` → `10.96.0.42`
4. kube-proxy programs iptables: `10.96.0.42` → round-robin to actual pod IPs
5. Pods scale up/down → Endpoints auto-updated → routing adjusts

**Why this is powerful:** Application code just calls `http://user-svc:8080/api` — no discovery library, no registry client, no configuration. DNS + virtual IP handles everything.

---

## Service Mesh — Discovery in the Infrastructure

With Istio/Envoy, every pod gets a sidecar proxy:

| Without Mesh | With Mesh (Istio/Envoy) |
|---|---|
| App code calls discovery library | Sidecar handles discovery transparently |
| App implements retry/timeout | Sidecar handles retries/timeouts |
| Manual health checking | Sidecar health-checks upstream pods |
| No inter-service auth | Sidecar does mTLS automatically |
| Traffic splitting in app code | Sidecar routes canary/blue-green |

**Key insight:** Move service discovery from application code to infrastructure. Application doesn't know it's happening.

---

## Health Checking Patterns

| Check Type | How | Best For |
|---|---|---|
| **HTTP health endpoint** | GET `/health` → 200 OK | Web services |
| **TCP connect** | Open connection → success | Databases, Redis |
| **gRPC health** | Standard gRPC health protocol | gRPC services |
| **Liveness probe** | "Are you alive?" (restart if dead) | Deadlock detection |
| **Readiness probe** | "Can you serve traffic?" (remove from LB if not) | Startup, dependency readiness |

**Kubernetes distinction:**

- **Liveness:** Failed → kubelet restarts the pod
- **Readiness:** Failed → pod removed from Service endpoints (no traffic)
- **Startup:** Gives slow-starting apps time before liveness kicks in

---

## Back-of-Envelope: Discovery Scale

| Parameter | Netflix (Eureka) | Kubernetes (large) | Consul (enterprise) |
|---|---|---|---|
| Services | 600+ | 1,000+ | 10,000+ |
| Instances | 100,000+ | 50,000+ pods | 100,000+ |
| Registry queries/sec | ~100K (client-side caching) | Negligible (DNS + iptables) | ~50K |
| Failure detection | 30-90 seconds | 10-40 seconds | 2-10 seconds |
| Propagation time | 30 seconds (cache refresh) | Immediate (watch) | 2-5 seconds (gossip) |

---

## Interview Framework

**When asked "How do services find each other in your design?":**

> **Step 1 — Environment:** "On Kubernetes, I'd use the built-in service discovery — CoreDNS resolves service names to ClusterIPs, kube-proxy handles routing. No additional infrastructure needed."
>
> **Step 2 — Health checking:** "Services expose `/health` endpoints. Kubernetes readiness probes remove unhealthy pods from the Service's endpoint list within seconds."
>
> **Step 3 — Service mesh (if needed):** "For advanced requirements (mTLS, canary routing, observability), I'd add a service mesh (Istio). Envoy sidecars handle discovery, retries, and traffic splitting transparently."
>
> **Step 4 — Cross-cluster/region:** "For multi-region, I'd use [Consul with WAN federation / global load balancer with DNS-based routing]. Each region has its own registry for local availability."
>
> **Step 5 — AP vs CP:** "I'd prefer an AP discovery system — stale data is better than no data. Client-side caching ensures services can still communicate even if the registry is briefly unavailable."

---

## Quick Recall

| Question | Answer |
|---|---|
| Why not hardcode IPs? | Containers scale, die, and restart constantly. IPs are ephemeral. |
| DNS problem? | TTL caching — clients hit dead instances for seconds/minutes after death |
| Client-side vs server-side? | Client-side = smart client, no proxy SPOF. Server-side = dumb client, proxy decides. |
| Eureka's philosophy? | AP — stale data > no data. Self-preservation on suspected network issues. |
| Consul's advantage? | Built for discovery: health checks, DNS native, multi-DC, gossip for fast failure detection |
| Kubernetes approach? | CoreDNS + ClusterIP + Endpoints. Fully automatic, no app code changes. |
| Why service mesh? | Moves discovery, retries, auth, observability from app code to infrastructure (sidecar) |
| ZooKeeper vs etcd? | Both CP/Raft-like. etcd has simpler API. ZK has richer primitives (ephemeral nodes). |
| Failure detection speed? | Consul gossip: 2-10s. Kubernetes: 10-40s. Eureka: 30-90s. |
| When to care? | Any microservice architecture with >3 services or auto-scaling |
