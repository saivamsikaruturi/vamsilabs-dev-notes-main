---
title: "GraphQL (2026)"
description: "GraphQL = a query language for APIs where the client specifies exactly what data it wants. One endpoint, flexible queries, no over/under-fetching."
---

# GraphQL

!!! danger "Real Incident: Facebook iOS App, 2012"
    Facebook's iOS app needed 7 REST calls to render one News Feed screen. Each returned 80% unused data. Backend was drowning in custom endpoints: `/mobile/feed`, `/mobile/feed-v2`, `/mobile/feed-slim`. They built GraphQL. **One query, exactly the data you need, zero waste.**

---

## The 30-Second Explanation

**GraphQL = a query language for APIs where the client specifies exactly what data it wants. One endpoint, flexible queries, no over/under-fetching.**

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin: 2rem 0;">
<div style="background: linear-gradient(135deg, #fee2e2, #fef2f2); border: 2px solid #f87171; border-radius: 12px; padding: 1.5rem; text-align: center;">
<div style="font-size: 2.5rem; margin-bottom: 0.5rem;">😤</div>
<h4 style="margin: 0 0 0.5rem; color: #dc2626;">REST Pain Points</h4>
<p style="margin: 0; font-size: 0.9rem; color: #7f1d1d;">Over-fetching, under-fetching, N+1 endpoints, versioning hell</p>
</div>
<div style="background: linear-gradient(135deg, #d1fae5, #ecfdf5); border: 2px solid #34d399; border-radius: 12px; padding: 1.5rem; text-align: center;">
<div style="font-size: 2.5rem; margin-bottom: 0.5rem;">✨</div>
<h4 style="margin: 0 0 0.5rem; color: #059669;">GraphQL Solution</h4>
<p style="margin: 0; font-size: 0.9rem; color: #065f46;">Ask for exactly what you need. One request. Type-safe. Self-documenting.</p>
</div>
</div>

---

## REST vs GraphQL — The Core Difference

| Aspect | REST | GraphQL |
|---|---|---|
| **Endpoints** | Many (`/users`, `/posts`, `/comments`) | One (`/graphql`) |
| **Data shape** | Server decides what to return | Client decides what to fetch |
| **Over-fetching** | Common (get 20 fields, need 3) | Impossible (ask for only what you need) |
| **Under-fetching** | Common (need 3 calls for one view) | Impossible (get everything in 1 query) |
| **Versioning** | URL-based (`/v1/`, `/v2/`) | No versions needed (add fields, deprecate old ones) |
| **Caching** | Easy (HTTP caching by URL) | Harder (all requests go to same URL) |
| **Learning curve** | Low | Medium |

---

## When to Use GraphQL vs REST

| Choose GraphQL When | Choose REST When |
|---|---|
| Mobile apps (bandwidth-sensitive) | Simple CRUD APIs |
| Multiple client types (web, iOS, Android, watch) | Heavy caching needed |
| Deeply nested/related data | File upload/download |
| Rapid frontend iteration | Simple microservice-to-microservice |
| Need to avoid endpoint explosion | Team unfamiliar with GraphQL |

---

## Key Concepts

| Concept | What | Analogy |
|---|---|---|
| **Query** | Read data (like GET) | "Show me this data" |
| **Mutation** | Write/update data (like POST/PUT/DELETE) | "Change this data" |
| **Subscription** | Real-time updates (WebSocket) | "Notify me when this changes" |
| **Schema** | Contract defining all types and operations | The menu |
| **Resolver** | Function that fetches data for a field | The kitchen |
| **Type** | Shape of data (User, Post, Comment) | The recipe |

---

## The N+1 Problem — GraphQL's Biggest Trap

**The problem:** Query all users + their posts. Naive implementation: 1 query for users + N queries for each user's posts.

| Approach | Queries | Used By |
|---|---|---|
| **Naive resolvers** | 1 + N (one per user) | Nobody (in production) |
| **DataLoader (batching)** | 2 (users + all posts in one batch) | Facebook, GitHub, Shopify |
| **Join optimization** | 1 (database join) | Hasura, PostGraphile |

**DataLoader pattern:** Collect all IDs requested in a single tick, batch into one DB query. This is how every production GraphQL server solves N+1.

---

## Security Concerns (What Interviewers Ask)

| Threat | What | Mitigation |
|---|---|---|
| **Deep queries** | Nested query 20 levels deep → kills server | Query depth limiting (max 10) |
| **Expensive queries** | Request every field on every type | Query complexity scoring + cost limit |
| **DDoS via query** | Malicious query that takes 30s to resolve | Timeout + persisted queries (whitelist) |
| **Introspection** | Attacker discovers your entire schema | Disable introspection in production |

---

## Real Systems

| Company | Why GraphQL | Notable |
|---|---|---|
| **GitHub** | REST API had 300+ endpoints, too many for clients | v4 API is GraphQL-only |
| **Shopify** | 1M+ merchants with different data needs | Storefront API = GraphQL |
| **Netflix** | Different UIs (TV, phone, browser) need different data | Studio search API |
| **Twitter** | Timeline composition from many sources | Internal federation |
| **Airbnb** | Complex nested data (listing → host → reviews → photos) | Frontend-driven queries |

---

## GraphQL Federation (Microservices)

**Problem:** You have 20 microservices. Each owns part of the data. Client needs data from 5 of them in one request.

**Solution:** GraphQL Federation — each service defines its part of the schema. A gateway merges them into one unified graph.

| Concept | What |
|---|---|
| **Subgraph** | One microservice's GraphQL schema |
| **Gateway** | Composes subgraphs into unified schema |
| **@key** | Defines entity identity across services |
| **Query plan** | Gateway figures out which services to call |

**Used by:** Netflix, Expedia, Walmart (Apollo Federation).

---

## REST + GraphQL (The Pragmatic Approach)

Most teams don't go all-in on either. Common pattern:

| Layer | Protocol | Why |
|---|---|---|
| **External API (clients)** | GraphQL | Flexible, client-driven |
| **Service-to-service** | REST or gRPC | Simple, cacheable, typed (gRPC) |
| **Internal batch ops** | REST | File upload, webhooks, simple CRUD |

---

## The 3 Mistakes That Get You Rejected

!!! danger "Don't Say These"
    1. **"GraphQL replaces REST"** — No. They coexist. REST is better for simple APIs, caching, and service-to-service. GraphQL shines for complex client needs.
    2. **"GraphQL is faster"** — Not inherently. A naive GraphQL server can be SLOWER (N+1 problem). Speed depends on resolver implementation and DataLoader usage.
    3. **"No versioning needed means no breaking changes"** — You still need discipline. Deprecate fields gracefully. Removing a field without warning breaks clients.

---

## Interview Answer Template

> "For [system] with [multiple clients / complex data], I'd use GraphQL because [reason: flexible queries, avoid endpoint explosion, reduce mobile bandwidth]. I'd address N+1 with DataLoader batching, security with query depth/complexity limits, and caching with [persisted queries / CDN-level caching]. For service-to-service, I'd keep REST/gRPC."

---

## Quick Recall Card

| Question | Answer |
|---|---|
| Core advantage over REST? | Client gets exactly what it asks for (no over/under-fetch) |
| N+1 solution? | DataLoader (batch + cache within single request) |
| Biggest security risk? | Deep/expensive queries → timeout + complexity limiting |
| When NOT to use? | Simple CRUD, heavy caching needs, file operations |
| Federation? | Gateway composes multiple subgraph schemas into one |
| Caching challenge? | All queries go to same URL → can't use HTTP cache naively |
