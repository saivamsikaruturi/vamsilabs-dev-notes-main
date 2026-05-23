# API Design

!!! danger "Real Incident: Fintech Startup, 2016"
    A junior dev deploys an API that accepts DELETE without authentication. $2.3M in user data — gone. No audit trail. No undo. The API returned `200 OK` for everything, including errors. **Bad API design costs real money and real careers.**

---

## The 30-Second Explanation

**API = the contract between your service and the outside world. A well-designed API is self-documenting, hard to misuse, and easy to evolve.**

<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin: 2rem 0;">
<div style="background: linear-gradient(135deg, #d1fae5, #ecfdf5); border: 2px solid #34d399; border-radius: 12px; padding: 1.2rem; text-align: center;">
<div style="font-size: 2rem; margin-bottom: 0.5rem;">📋</div>
<h4 style="margin: 0 0 0.5rem; color: #059669; font-size: 0.95rem;">Contract</h4>
<p style="margin: 0; font-size: 0.8rem; color: #065f46;">Input format, output format, error codes — all predictable</p>
</div>
<div style="background: linear-gradient(135deg, #dbeafe, #eff6ff); border: 2px solid #60a5fa; border-radius: 12px; padding: 1.2rem; text-align: center;">
<div style="font-size: 2rem; margin-bottom: 0.5rem;">🔄</div>
<h4 style="margin: 0 0 0.5rem; color: #2563eb; font-size: 0.95rem;">Evolvable</h4>
<p style="margin: 0; font-size: 0.8rem; color: #1e40af;">Versioning, backward compatibility, deprecation paths</p>
</div>
<div style="background: linear-gradient(135deg, #fef3c7, #fffbeb); border: 2px solid #f59e0b; border-radius: 12px; padding: 1.2rem; text-align: center;">
<div style="font-size: 2rem; margin-bottom: 0.5rem;">🛡️</div>
<h4 style="margin: 0 0 0.5rem; color: #92400e; font-size: 0.95rem;">Secure</h4>
<p style="margin: 0; font-size: 0.8rem; color: #78350f;">Auth, rate limiting, input validation — by default</p>
</div>
</div>

---

## REST API Design Rules

### URL Structure

| Rule | Good | Bad |
|---|---|---|
| Nouns, not verbs | `/users/123` | `/getUser?id=123` |
| Plural resources | `/orders` | `/order` |
| Nested for relationships | `/users/123/orders` | `/getUserOrders?userId=123` |
| Lowercase, hyphens | `/user-profiles` | `/UserProfiles` |
| No trailing slashes | `/users` | `/users/` |

### HTTP Methods

| Method | Purpose | Idempotent? | Example |
|---|---|---|---|
| **GET** | Read | Yes | GET /users/123 |
| **POST** | Create | No | POST /users |
| **PUT** | Full replace | Yes | PUT /users/123 |
| **PATCH** | Partial update | Yes | PATCH /users/123 |
| **DELETE** | Remove | Yes | DELETE /users/123 |

### Status Codes (The Important Ones)

| Code | Meaning | When |
|---|---|---|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input from client |
| 401 | Unauthorized | No/invalid authentication |
| 403 | Forbidden | Authenticated but not allowed |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate, version conflict |
| 429 | Too Many Requests | Rate limited |
| 500 | Internal Server Error | Your bug |

---

## Pagination — You Will Be Asked This

| Strategy | How | Best For |
|---|---|---|
| **Offset-based** | `?page=3&limit=20` | Simple UI pagination |
| **Cursor-based** | `?cursor=abc123&limit=20` | Infinite scroll, large datasets |
| **Keyset** | `?after_id=500&limit=20` | Sorted data, no skipping |

**Why cursor > offset at scale?** `OFFSET 10000` still scans 10000 rows then discards them. Cursor/keyset jumps directly to the right position.

!!! tip "Interview Gold"
    "For the feed API, I'd use cursor-based pagination. Return a `next_cursor` token with each response. This avoids the offset-skip problem at scale and handles items being added/deleted between pages without skipping or duplicating results."

---

## Versioning

| Strategy | Example | Trade-off |
|---|---|---|
| **URL path** | `/v1/users`, `/v2/users` | Explicit, easy to understand. Most common. |
| **Header** | `Accept: application/vnd.api.v2+json` | Clean URLs but hidden version |
| **Query param** | `/users?version=2` | Easy to forget, messy |

**Best practice:** URL path versioning (`/v1/`). It's explicit and cacheable.

---

## Idempotency — Critical for Payment APIs

| Concept | What |
|---|---|
| **Idempotent** | Same request sent N times = same result as sent once |
| **GET, PUT, DELETE** | Naturally idempotent |
| **POST** | NOT idempotent (creates new resource each time) |
| **Fix** | Client sends `Idempotency-Key` header. Server deduplicates. |

**How Stripe does it:** Client sends `Idempotency-Key: uuid-123`. Server stores result for 24h. Retry with same key → returns cached result instead of double-charging.

---

## API Security Checklist

| Layer | What |
|---|---|
| **Authentication** | OAuth 2.0 / JWT tokens |
| **Authorization** | RBAC or ABAC (check permissions per endpoint) |
| **Rate Limiting** | Per-user, per-IP, per-endpoint |
| **Input Validation** | Reject unexpected fields, validate types/ranges |
| **HTTPS** | Always. No exceptions. |
| **CORS** | Whitelist allowed origins |
| **Audit Logging** | Log who did what, when |

---

## Real API Design Decisions

| Company | Decision | Why |
|---|---|---|
| **Stripe** | Idempotency keys on all POST | Payment safety |
| **GitHub** | Cursor pagination | Massive datasets (commits, issues) |
| **Twitter** | Snowflake IDs (not sequential) | Don't leak creation rate or count |
| **Slack** | Rate limit with `Retry-After` | Protect backend from bot abuse |
| **Google** | Standardized error format | Consistent across 500+ APIs |

---

## The 3 Mistakes That Get You Rejected

!!! danger "Don't Say These"
    1. **"Return 200 for everything, put error in body"** — This makes clients parse every response body to detect failure. Use proper HTTP status codes. That's what they exist for.
    2. **"Use verbs in URLs"** — `/createUser`, `/deleteOrder` is RPC-style, not REST. Use HTTP methods + resource nouns.
    3. **"We don't need versioning, we'll just update"** — The moment you have external consumers, breaking changes = broken trust. Always version from day one.

---

## Interview Answer Template

> "For the [resource] API, I'd design RESTful endpoints: [list key endpoints with methods]. Pagination via [cursor/offset] with [limit]. Auth via [OAuth/JWT]. Versioning via URL path (/v1/). Idempotency via client-provided keys on POST/PATCH. Rate limiting at [N] req/sec per user with `429` + `Retry-After`."

---

## Quick Recall Card

| Question | Answer |
|---|---|
| Nouns or verbs in URLs? | Nouns always. HTTP method = the verb. |
| Cursor vs offset pagination? | Cursor for scale (no skip problem). Offset for simple UI. |
| How to handle duplicates? | Idempotency key (client-provided UUID) |
| Auth standard? | OAuth 2.0 + JWT |
| POST idempotent? | No. That's why you need idempotency keys. |
| Versioning? | URL path (/v1/) — explicit and cacheable |
