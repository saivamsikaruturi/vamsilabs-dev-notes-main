---
title: "Top 30 REST API Interview Questions & Answers (2026)"
description: "Why it exists: Roy Fielding formalized REST in his 2000 dissertation to describe why the web scales so well. He distilled the web's architecture into..."
---

# Top 30 REST API Interview Questions & Answers

---

??? question "Q1: What is REST and what makes an API RESTful?"

    **Answer:** REST is an architectural style -- not a protocol -- that models your system as a set of addressable resources manipulated through a uniform interface over HTTP.

    **Why it exists:** Roy Fielding formalized REST in his 2000 dissertation to describe why the web scales so well. He distilled the web's architecture into constraints that any distributed hypermedia system can follow to achieve loose coupling, independent evolution, and massive scalability.

    **How it works internally:** A RESTful API exposes resources (nouns) via URIs, uses standard HTTP methods (verbs) for operations, exchanges representations (JSON/XML) of resource state, and relies on HTTP's built-in semantics for caching, content negotiation, and error signaling. The server holds no client session state between requests -- every request is self-contained.

    **When to use:** Any time you need a scalable, cacheable, broadly-compatible API -- especially public APIs, microservices communication, or mobile/web backends where HTTP infrastructure (CDNs, load balancers, proxies) should work out of the box.

    **Gotchas:** REST is not a specification -- there is no certification. Teams often call any HTTP+JSON API "RESTful" even without statelessness or proper resource modeling. The constraints are all-or-nothing for the full benefits; partial adoption gives partial benefits. Also, REST is resource-oriented -- if your domain is action-heavy (e.g., "run this computation"), you may need to model actions as resources (e.g., POST to a `/calculations` collection).

---

??? question "Q2: What are the six constraints of REST?"

    **Answer:** REST has six constraints that collectively enable scalability, simplicity, and independent evolvability of distributed systems.

    **Why they exist:** Each constraint solves a specific distributed systems problem -- statelessness enables horizontal scaling, caching reduces latency, layering allows transparent intermediaries like CDNs and gateways.

    | # | Constraint | Description |
    |---|-----------|-------------|
    | 1 | **Client-Server** | Separation of concerns -- the client handles the UI, the server handles data storage. They evolve independently. |
    | 2 | **Stateless** | Each request from the client must contain all information needed to process it. The server stores no client session state between requests. |
    | 3 | **Cacheable** | Responses must implicitly or explicitly label themselves as cacheable or non-cacheable so clients (and intermediaries) can reuse responses. |
    | 4 | **Uniform Interface** | A standardized way to interact with resources (resource identification via URIs, manipulation through representations, self-descriptive messages, and HATEOAS). |
    | 5 | **Layered System** | The architecture can be composed of multiple layers (proxies, gateways, load balancers). A client cannot tell whether it is connected directly to the server. |
    | 6 | **Code on Demand (optional)** | Servers can extend client functionality by transferring executable code (e.g., JavaScript). This is the only optional constraint. |

    **How they work together:** Statelessness lets any server instance handle any request (horizontal scaling). Cacheability means responses can be stored at multiple layers. The uniform interface means intermediaries can understand and optimize traffic without knowing your domain.

    **When to apply:** All five mandatory constraints must be present for the system to be considered RESTful. Violating even one (e.g., storing session state server-side) means you lose the guarantees that depend on it.

    **Gotchas:** "Stateless" does not mean the server has no state -- it means no *client session* state. The database still holds resources. Also, most teams implement Uniform Interface partially (they use proper verbs and URIs but skip HATEOAS), which puts them at Richardson Level 2, not true REST.

---

??? question "Q3: How does REST differ from SOAP?"

    **Answer:** REST is an architectural style that leverages HTTP natively; SOAP is a formal protocol with its own envelope, contract, and security stack built on top of any transport.

    **Why both exist:** SOAP emerged from enterprise needs for guaranteed delivery, formal contracts, and transport independence. REST came later as a simpler alternative that embraces the web's existing infrastructure rather than layering on top of it.

    | Aspect | REST | SOAP |
    |--------|------|------|
    | **Protocol** | Architectural style over HTTP | Protocol (uses XML-based messaging) |
    | **Data Format** | JSON, XML, plain text, etc. | XML only |
    | **Transport** | HTTP/HTTPS | HTTP, SMTP, TCP, JMS |
    | **Contract** | No formal contract (optional OpenAPI) | WSDL (Web Services Description Language) |
    | **Statefulness** | Stateless by design | Can be stateful (WS-ReliableMessaging) |
    | **Performance** | Lightweight, fast (especially with JSON) | Heavier due to XML envelope overhead |
    | **Caching** | Built-in HTTP caching | No native caching support |
    | **Error Handling** | HTTP status codes | SOAP Fault elements |
    | **Security** | HTTPS, OAuth2, JWT | WS-Security (more comprehensive) |
    | **Best For** | Public APIs, mobile/web apps, microservices | Enterprise integrations, financial/banking systems requiring ACID compliance |

    **When to choose SOAP:** You need formal contracts (WSDL), built-in retry/reliable messaging, WS-Security for complex enterprise integrations, or non-HTTP transports like JMS.

    **When to choose REST:** You want simplicity, performance, HTTP caching, broad client compatibility, or you are building public APIs/microservices.

    **Gotchas:** SOAP's XML overhead can be 5-10x larger than equivalent JSON payloads. However, REST has no built-in equivalent to WS-ReliableMessaging or WS-AtomicTransaction -- you must build retry/idempotency yourself. Many legacy enterprise systems still expose only SOAP, so integration projects often require both.

---

??? question "Q4: What are the main HTTP methods and their semantics?"

    **Answer:** HTTP defines a small set of verbs with well-defined semantics around safety, idempotency, and request/response expectations -- REST APIs rely on these semantics rather than inventing custom action vocabularies.

    **Why it matters:** When every team agrees on what GET, POST, PUT, DELETE mean, intermediaries (caches, proxies, browsers) can optimize traffic automatically, and developers can reason about retry safety without reading documentation.

    | Method | Purpose | Request Body | Response Body | Idempotent | Safe |
    |--------|---------|:------------:|:-------------:|:----------:|:----:|
    | **GET** | Retrieve a resource | No | Yes | Yes | Yes |
    | **POST** | Create a new resource or trigger a process | Yes | Yes | No | No |
    | **PUT** | Replace a resource entirely | Yes | Optional | Yes | No |
    | **PATCH** | Partially update a resource | Yes | Yes | No* | No |
    | **DELETE** | Remove a resource | Optional | Optional | Yes | No |
    | **HEAD** | Same as GET but without the response body | No | No | Yes | Yes |
    | **OPTIONS** | Describe communication options for a resource | No | Yes | Yes | Yes |

    *PATCH can be made idempotent depending on implementation (e.g., JSON Merge Patch is idempotent, but JSON Patch with `add` operations may not be).

    **When to use which:** GET for reads, POST for creating resources where the server assigns the ID, PUT for full replacements when you know the URI, PATCH for partial field updates, DELETE for removal. Use HEAD to check existence or content-length without downloading the body.

    **Gotchas:** Some firewalls/proxies block PUT and DELETE -- legacy systems sometimes tunnel everything through POST. GET requests with bodies are technically allowed by HTTP but semantically undefined and unsupported by most tooling. Never use GET for state-changing operations -- crawlers and prefetch will trigger them accidentally.

---

??? question "Q5: What is the difference between PUT and PATCH?"

    **Answer:** PUT replaces the entire resource (full overwrite); PATCH modifies only the fields you send (surgical update).

    **Why both exist:** PUT has clean idempotency semantics but forces clients to send the full object even when changing one field -- wasteful on bandwidth and risky for concurrent edits. PATCH was introduced (RFC 5789) to allow partial updates without the all-or-nothing tradeoff.

    ```json
    PUT /users/42
    {
      "name": "Vamsi",
      "email": "vamsi@example.com",
      "phone": "555-1234"
    }
    ```

    ```json
    PATCH /users/42
    {
      "phone": "555-9999"
    }
    ```

    **How they differ internally:**

    - **PUT** is idempotent by definition. Sending the same PUT request twice produces the same result. The server replaces the stored resource wholesale.
    - **PATCH** is not guaranteed to be idempotent (depends on patch format). The server merges the patch document into the existing resource.
    - **PUT** requires the client to know the full resource structure; **PATCH** does not.

    **When to use:** Use PUT when the client owns the entire resource representation (config files, settings objects). Use PATCH when updating one or two fields on a large resource, or when you want to avoid accidental nullification of fields.

    **Gotchas:** With PUT, if a client omits a field, the server should set it to null -- many implementations accidentally treat PUT as a merge (partial update), which violates the spec. PATCH with JSON Merge Patch (RFC 7396) cannot explicitly set a field to null vs. "not included" -- use JSON Patch (RFC 6902) if you need that distinction. Also, concurrent PATCHes on different fields are safe; concurrent PUTs will clobber each other.

---

??? question "Q6: When should you use POST vs PUT?"

    **Answer:** POST creates a resource when the server assigns the identity; PUT creates or replaces a resource when the client already knows the target URI.

    **Why it matters:** The distinction drives retry safety. POST is non-idempotent -- retrying creates duplicates. PUT is idempotent -- retrying is harmless because the same state is written each time.

    | Characteristic | POST | PUT |
    |---------------|------|-----|
    | **Purpose** | Create a new resource (server assigns ID) | Create or replace a resource (client knows the ID) |
    | **Idempotent** | No -- calling twice may create duplicates | Yes -- calling twice has the same effect |
    | **URI target** | Collection URI: `POST /users` | Specific resource URI: `PUT /users/42` |
    | **Response** | `201 Created` with `Location` header | `200 OK` or `201 Created` (if new) or `204 No Content` |

    ```
    POST /articles          --> server creates /articles/17
    PUT  /articles/17       --> client replaces /articles/17
    ```

    **When to use POST:** Most CRUD creation flows where the server auto-generates an ID (UUIDs, sequences). Also use POST for any operation that does not fit neatly into CRUD -- triggering workflows, running calculations, sending notifications.

    **When to use PUT:** The client controls the resource identity (e.g., uploading a file to a known path, upsert patterns, configuration objects keyed by a natural key the client knows).

    **Gotchas:** Many developers use POST for everything "because it is safe from caching" -- this sacrifices idempotency guarantees. If you must use POST for creation but need retry safety, implement an idempotency-key header pattern. Also, PUT to a non-existent URI should create the resource (upsert) per the spec, but many frameworks return 404 instead -- check your framework's behavior.

---

??? question "Q7: What is idempotency and which HTTP methods are idempotent?"

    **Answer:** An operation is idempotent if calling it N times produces the same server-side state as calling it once -- it is the foundation of safe retries in distributed systems.

    **Why it exists:** Networks are unreliable. When a client sends a request and gets a timeout, it cannot know if the server processed it. Idempotency lets clients retry without fear of side effects like duplicate orders or double charges.

    **Idempotent methods:** GET, PUT, DELETE, HEAD, OPTIONS, TRACE

    **Non-idempotent methods:** POST, PATCH (by default)

    **How it works internally:** For PUT, the server overwrites the resource with the exact same state each time -- no accumulation. For DELETE, deleting an already-deleted resource is a no-op (still returns success or 404). For GET, no state changes at all.

    **When to use:** Design mutation endpoints to be idempotent wherever possible. For non-idempotent POST, use an **idempotency key** pattern -- the client generates a unique ID per logical operation:

    ```
    Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
    ```

    The server stores this key and deduplicates on replay within a TTL window.

    **Gotchas:** DELETE is idempotent in terms of *state* (resource stays gone), but the *response* may differ (204 vs 404 on second call) -- idempotency is about state, not response codes. Also, "idempotent" does not mean "safe" -- DELETE changes state but is still idempotent. Finally, PATCH with increment operations (`{"views": "+1"}`) is explicitly non-idempotent.

---

??? question "Q8: What is the difference between safe methods and idempotent methods?"

    **Answer:** Safe methods guarantee no server-side state change (read-only); idempotent methods may change state but produce the same outcome regardless of how many times you call them.

    **Why the distinction matters:** Infrastructure relies on these guarantees. Browsers freely prefetch safe URLs, retry idempotent requests on connection drops, and refuse to cache or retry non-safe/non-idempotent ones. Getting this wrong means crawlers accidentally delete data or load balancers incorrectly retry side-effecting calls.

    **How they relate:** All safe methods are idempotent (reading never changes state, so repeating is trivially the same). But not all idempotent methods are safe -- DELETE changes state on first call, but repeating it does not change it further.

    | Method | Safe | Idempotent |
    |--------|:----:|:----------:|
    | GET | Yes | Yes |
    | HEAD | Yes | Yes |
    | OPTIONS | Yes | Yes |
    | PUT | No | Yes |
    | DELETE | No | Yes |
    | POST | No | No |
    | PATCH | No | No |

    **When to apply:** Mark your custom endpoints accordingly. If a GET endpoint has side effects (logging page views, incrementing counters), you have violated safety -- crawlers and prefetch will trigger those side effects unpredictably.

    **Gotchas:** Some developers implement GET endpoints that mutate state ("GET /unsubscribe?token=x") -- this is dangerous because link previews, browser prefetch, and crawlers will trigger it. Also, HTTP spec says intermediaries MAY retry idempotent requests on failure -- if your PUT is accidentally non-idempotent, retries will corrupt data silently.

---

??? question "Q9: What are the key HTTP status codes to know for REST APIs?"

    **Answer:** Status codes are REST's signaling mechanism -- they tell clients, caches, and intermediaries exactly what happened without parsing the body.

    **Why they matter:** Correct status codes enable automatic behavior: caches store 200s, browsers redirect on 301s, retry logic fires on 503s, and monitoring dashboards alert on 5xx spikes. Wrong codes break this entire ecosystem.

    **2xx -- Success:**

    - `200 OK` -- Request succeeded (general success)
    - `201 Created` -- Resource created successfully
    - `202 Accepted` -- Request accepted for async processing
    - `204 No Content` -- Success but no response body (common for DELETE and PUT)

    **3xx -- Redirection:**

    - `301 Moved Permanently` -- Resource permanently moved to a new URI
    - `304 Not Modified` -- Cached version is still valid (used with ETag/If-None-Match)

    **4xx -- Client Errors:**

    - `400 Bad Request` -- Malformed syntax, invalid input
    - `401 Unauthorized` -- Authentication required or failed
    - `403 Forbidden` -- Authenticated but not authorized
    - `404 Not Found` -- Resource does not exist
    - `405 Method Not Allowed` -- HTTP method not supported for this resource
    - `409 Conflict` -- Conflict with current resource state (e.g., duplicate)
    - `422 Unprocessable Entity` -- Syntactically valid but semantically invalid
    - `429 Too Many Requests` -- Rate limit exceeded

    **5xx -- Server Errors:**

    - `500 Internal Server Error` -- Unexpected server failure
    - `502 Bad Gateway` -- Upstream server returned invalid response
    - `503 Service Unavailable` -- Server temporarily overloaded or under maintenance
    - `504 Gateway Timeout` -- Upstream server timed out

    **Gotchas:** Never return 200 with an error in the body -- monitoring and client libraries rely on status codes. Returning 500 for validation errors inflates error budgets and triggers unnecessary alerts. 401 vs 403 confusion is common: 401 means "who are you?" (re-authenticate might help), 403 means "I know who you are, but no" (re-authenticating will not help).

---

??? question "Q10: What is the difference between 200, 201, and 204?"

    **Answer:** 200 means "here is the result," 201 means "I created something new for you," and 204 means "done, nothing to show you" -- each drives different client behavior.

    **Why the distinction matters:** Client libraries and frameworks behave differently: 201 tells the client to follow the Location header to the new resource, 204 tells JSON parsers not to attempt body deserialization (avoids parse errors on empty body), and 200 signals a cacheable response with content.

    | Code | Meaning | When to Use | Response Body |
    |------|---------|-------------|:-------------:|
    | **200 OK** | General success | GET requests, PUT/PATCH that return the updated resource | Yes |
    | **201 Created** | A new resource was created | Successful POST (and PUT when creating) | Yes (the created resource) + `Location` header |
    | **204 No Content** | Success with nothing to return | DELETE, PUT/PATCH when no body is needed | No |

    Example flow:

    ```
    POST /users  --> 201 Created, Location: /users/42
    GET /users/42  --> 200 OK, { "id": 42, "name": "Vamsi" }
    DELETE /users/42  --> 204 No Content
    ```

    **When to use which:** Return 201 from any POST that creates a resource -- always include the Location header. Return 204 when the operation succeeded but returning a body adds no value (DELETE, bulk operations, fire-and-forget updates). Return 200 for everything else that succeeds with content.

    **Gotchas:** Returning 200 from a POST that creates a resource is technically correct but loses the semantic signal that something new was created. Some frontend frameworks throw on 204 if they expect JSON -- ensure your client handles empty bodies. Never return 204 with a body -- HTTP spec forbids it, and proxies may strip it silently.

---

??? question "Q11: What is the difference between 400, 401, 403, 404, 409, and 422?"

    **Answer:** These six codes cover the spectrum of "what went wrong on the client side" -- from malformed requests to authorization failures to business rule violations.

    **Why precise codes matter:** Each code tells the client a different recovery strategy. 401 means "get a new token." 403 means "you will never be allowed -- stop trying." 409 means "fetch the latest state and retry." 422 means "fix your input values." Using the wrong code leads to broken retry logic and confused developers.

    | Code | Name | When to Use |
    |------|------|-------------|
    | **400** | Bad Request | Malformed JSON, missing required fields, wrong data types. The request itself is structurally invalid. |
    | **401** | Unauthorized | No authentication credentials provided, or the token/credentials are invalid or expired. The client must authenticate. |
    | **403** | Forbidden | The client is authenticated but lacks permission to perform the action. Re-authenticating will not help. |
    | **404** | Not Found | The resource does not exist at the given URI, or the server wants to hide its existence from unauthorized users. |
    | **409** | Conflict | The request conflicts with the current state of the resource -- e.g., creating a user with a duplicate email, or an optimistic locking version mismatch. |
    | **422** | Unprocessable Entity | The JSON is well-formed (not a 400) but the values fail business validation -- e.g., age is -5, email format is invalid, end date is before start date. |

    **How to decide:** If a JSON parser rejects it, return 400. If your business logic rejects it, return 422. If the resource just does not exist, 404. If it exists but the operation conflicts with current state, 409.

    **Gotchas:** Some APIs return 404 instead of 403 to avoid leaking resource existence to unauthorized users -- this is a valid security pattern but complicates debugging. The 401/403 naming is confusing ("Unauthorized" actually means unauthenticated) -- this is a historical HTTP spec misnaming. For 409, always include enough detail in the body for the client to resolve the conflict (current version, conflicting field).

---

??? question "Q12: What are REST API URL naming conventions and best practices?"

    **Answer:** Good URL design makes your API self-documenting -- a developer should guess the endpoint without reading docs.

    **Why conventions matter:** Consistent naming reduces cognitive load, prevents bikeshedding across teams, and makes APIs predictable. Inconsistent URIs (mixing camelCase, snake_case, verbs, and nouns) signal an immature API and slow down integration.

    1. **Use nouns, not verbs** -- resources are things, not actions
        - Good: `GET /users/42` | Bad: `GET /getUser?id=42`
    2. **Use plural nouns** for collections
        - `/users`, `/orders`, `/products`
    3. **Use kebab-case** (hyphens) for multi-word names
        - `/order-items` not `/orderItems` or `/order_items`
    4. **Use hierarchy** to express relationships
        - `/users/42/orders` -- orders belonging to user 42
        - `/users/42/orders/7` -- order 7 of user 42
    5. **No trailing slashes**
        - `/users` not `/users/`
    6. **Use query parameters for filtering, sorting, pagination**
        - `/users?status=active&sort=name&page=2`
    7. **Avoid deep nesting** (more than 2 levels)
        - Instead of `/users/42/orders/7/items/3`, consider `/order-items/3`
    8. **Use lowercase** throughout the URI path
    9. **Version your API** in the URI or header
        - `/api/v1/users`

    **When to break rules:** Action-oriented operations that do not map to CRUD (e.g., "send email," "merge accounts") can use verbs as sub-resources: `POST /accounts/42/merge`. This is pragmatic and widely accepted.

    **Gotchas:** URIs are case-sensitive per RFC 3986 -- `/Users` and `/users` are different resources on compliant servers, causing subtle bugs. Trailing slash inconsistency causes 301 redirects that break POST requests (body gets dropped on redirect). Deep nesting couples your URL structure to your data model -- when relationships change, URLs break.

---

??? question "Q13: When should you use path parameters vs query parameters?"

    **Answer:** Path parameters identify *which* resource you want; query parameters control *how* you want it -- filtering, sorting, shaping the response.

    **Why this distinction exists:** Caching and routing infrastructure treats paths and query strings differently. Path segments define the resource identity (cached separately), while query strings are modifiers that can be stripped or varied. Getting this wrong breaks caching and makes URLs unreadable.

    **Path parameters** identify a specific resource:

    ```
    GET /users/42          --> user with ID 42
    GET /users/42/orders   --> all orders for user 42
    ```

    **Query parameters** filter, sort, paginate, or modify the response:

    ```
    GET /users?status=active&sort=name&limit=20
    GET /products?category=electronics&min_price=100
    ```

    | Use Path Parameters When | Use Query Parameters When |
    |-------------------------|--------------------------|
    | Identifying a specific resource | Filtering a collection |
    | The parameter is required | The parameter is optional |
    | The value defines what you are requesting | The value refines how results are returned |
    | Removing it changes the meaning of the URI | Removing it just returns unfiltered results |

    **When to use which:** If removing the parameter makes the URL meaningless or points to a different resource, it belongs in the path. If removing it just returns a broader result set, it belongs in the query.

    **Gotchas:** Putting optional filters in the path (`/users/active`) creates combinatorial URL explosion and caching nightmares. Conversely, putting resource IDs in query params (`/users?id=42`) loses the semantic clarity and breaks RESTful tooling expectations. Also watch out for query param ordering -- `/users?a=1&b=2` and `/users?b=2&a=1` are technically different URIs for caching purposes, so normalize on the server side.

---

??? question "Q14: What is HATEOAS?"

    **Answer:** HATEOAS means the server tells the client what it can do next by embedding navigational links in every response -- the client drives workflow by following links, not by hardcoding URLs.

    **Why it exists:** Without HATEOAS, clients must know the full URL structure at build time. Any server-side URL change breaks all clients. With HATEOAS, clients only need to know the entry-point URL -- they discover everything else at runtime, like a human clicking links on a website.

    Example response:

    ```json
    {
      "id": 42,
      "name": "Vamsi",
      "balance": 250.00,
      "_links": {
        "self": { "href": "/accounts/42" },
        "deposit": { "href": "/accounts/42/deposit", "method": "POST" },
        "withdraw": { "href": "/accounts/42/withdraw", "method": "POST" },
        "transfer": { "href": "/accounts/42/transfer", "method": "POST" },
        "close": { "href": "/accounts/42", "method": "DELETE" }
      }
    }
    ```

    **How it works:** The server conditionally includes links based on the resource's current state. A frozen account would omit "withdraw" and "transfer" links -- the client knows these actions are unavailable without any business logic on the client side.

    **When to use:** API platforms where clients are developed by third parties and you need to evolve URLs without coordinated releases. Also useful for workflow-driven APIs (order state machines, approval processes).

    **Gotchas:** Most real-world REST APIs skip HATEOAS because of complexity and because clients typically hardcode URLs for performance. Adding links without clients consuming them is dead code. There is no dominant standard -- HAL, JSON:API, Siren, and JSON-LD all implement it differently, fragmenting tooling. It is the hallmark of Richardson Maturity Level 3, but pragmatically, Level 2 with good documentation often delivers more value.

---

??? question "Q15: What is the Richardson Maturity Model?"

    **Answer:** The Richardson Maturity Model is a 4-level ladder that measures how well an API leverages HTTP and REST principles -- from "HTTP as a tunnel" (Level 0) to full hypermedia (Level 3).

    **Why it exists:** It gives teams a shared vocabulary to discuss API design maturity without subjective arguments. It also helps prioritize improvements -- moving from Level 1 to Level 2 delivers the most practical value for most teams.

    | Level | Name | Description | Example |
    |-------|------|-------------|---------|
    | **Level 0** | The Swamp of POX | Single URI, single HTTP method (usually POST). Basically RPC over HTTP. | `POST /api` with action in the body |
    | **Level 1** | Resources | Multiple URIs (one per resource), but still using a single HTTP method. | `POST /users/42`, `POST /orders/7` |
    | **Level 2** | HTTP Verbs | Proper use of HTTP methods (GET, POST, PUT, DELETE) and status codes. | `GET /users/42`, `DELETE /orders/7` |
    | **Level 3** | Hypermedia Controls | HATEOAS -- responses include links to available actions and related resources. | Response includes `_links` with next actions |

    **How to apply:** Audit your API -- if you use POST for everything, you are at Level 0/1. Add proper HTTP verbs and status codes to reach Level 2. Add hypermedia links for Level 3.

    **When to aim for what:** Level 2 is the sweet spot for most production APIs -- it unlocks HTTP caching, idempotent retries, and standard tooling. Level 3 is worth pursuing only when you have many third-party consumers who need to decouple from your URL structure.

    **Gotchas:** The model is descriptive, not prescriptive -- Level 3 is not always "better." Many successful APIs (Stripe, GitHub) are Level 2 with excellent documentation. Chasing Level 3 without clients that consume hypermedia links adds complexity without benefit. Also, being at Level 2 does not make an API "RESTful" by Fielding's strict definition -- he insists on HATEOAS.

---

??? question "Q16: What are common pagination approaches in REST APIs?"

    **Answer:** Pagination controls how clients consume large collections incrementally -- the choice of strategy affects performance, consistency, and UX.

    **Why it matters:** Returning unbounded result sets kills server memory, saturates network bandwidth, and overwhelms clients. The pagination strategy you choose determines whether clients see duplicates/gaps during concurrent writes and whether your database melts at page 10,000.

    **1. Offset-based pagination:**

    ```
    GET /users?offset=40&limit=20
    ```

    - Simple to implement and understand.
    - Problem: inconsistent results if data is inserted/deleted between pages (items can be skipped or duplicated). Performance degrades on large offsets because the database must scan and skip rows (`OFFSET 100000` is a full scan).

    **2. Cursor/Keyset-based pagination:**

    ```
    GET /users?after=eyJpZCI6NDJ9&limit=20
    ```

    - The cursor is an opaque token (often base64-encoded) pointing to the last item of the previous page.
    - Consistent results even when data changes. Efficient for large datasets (uses indexed column seeks -- O(log n) not O(n)).
    - Downside: cannot jump to an arbitrary page.

    **3. Page-number pagination:**

    ```
    GET /users?page=3&size=20
    ```

    - Simple and intuitive but suffers from the same consistency issues as offset.

    **4. Link header pagination (RFC 5988):**

    ```
    Link: </users?page=3&size=20>; rel="next",
          </users?page=1&size=20>; rel="prev",
          </users?page=10&size=20>; rel="last"
    ```

    **When to use which:** Cursor-based for large/real-time feeds (Twitter timelines, event logs). Offset/page-number for admin dashboards where users need "jump to page 7" and datasets are small. Link headers when you want HATEOAS-style navigation.

    **Gotchas:** `total_count` requires a `COUNT(*)` query that can be expensive on large tables -- consider returning it only on the first page or making it approximate. Cursor pagination breaks if the sort-key column is not unique (use compound cursors: `id + created_at`). Never let `limit` be unbounded -- always enforce a server-side max.

---

??? question "Q17: How do you design filtering, sorting, and searching in a REST API?"

    **Answer:** Filtering, sorting, and searching let clients retrieve exactly the slice of data they need without multiple round trips or client-side post-processing.

    **Why it matters:** Without server-side filtering, clients download entire collections and filter locally -- wasting bandwidth, increasing latency, and making pagination inconsistent. Good query design shifts work to the database where indexes make it fast.

    **Filtering** -- use query parameters that match field names:

    ```
    GET /products?category=electronics&status=in_stock&min_price=50
    ```

    **Sorting** -- use a `sort` parameter with field name and direction:

    ```
    GET /products?sort=price:asc
    GET /products?sort=-created_at        (prefix - for descending)
    GET /products?sort=category:asc,price:desc   (multi-field)
    ```

    **Searching** -- use a generic `q` or `search` parameter for full-text search:

    ```
    GET /products?q=wireless+keyboard
    ```

    **Field selection** (sparse fieldsets) -- let clients request only the fields they need:

    ```
    GET /users/42?fields=name,email,avatar
    ```

    **When to use:** Filtering on every collection endpoint. Sorting wherever order matters to the UI. Field selection for bandwidth-constrained mobile clients or when resources have many computed/nested fields.

    **Gotchas:** Exposing arbitrary filter fields without database indexes creates slow query vectors -- attackers can craft expensive queries. Always whitelist allowed filter/sort fields and back them with indexes. Field selection can break caching (each combination is a different cache key) -- use `Vary` headers or cache at the full-resource level and trim on response. Avoid ad-hoc query languages (allowing `gt`, `lt`, `contains` on every field) unless you are building a platform -- it is a maintenance burden and SQL injection risk if not parameterized properly.

---

??? question "Q18: What are the main API versioning strategies?"

    **Answer:** API versioning isolates breaking changes so existing clients keep working while new clients adopt the latest contract -- the strategy you choose determines how visible and manageable versions are.

    **Why it exists:** APIs evolve. Fields get renamed, endpoints restructured, response shapes changed. Without versioning, any breaking change forces all clients to update simultaneously -- impossible with public APIs or mobile apps stuck on old app-store versions.

    | Strategy | Example | Pros | Cons |
    |----------|---------|------|------|
    | **URI Path** | `GET /api/v1/users` | Simple, visible, easy to route | Violates REST (URI should identify resource, not version). Proliferates URI paths. |
    | **Query Parameter** | `GET /users?version=2` | Easy to add, optional | Easy to forget, not obvious in documentation |
    | **Custom Header** | `X-API-Version: 2` | Keeps URI clean | Hidden from browsers, harder to test with simple tools |
    | **Accept Header (Content Negotiation)** | `Accept: application/vnd.myapi.v2+json` | Most RESTful approach, keeps URIs clean | Complex to implement and test, not intuitive for beginners |

    **How to choose:** URI path versioning wins for simplicity and is used by Stripe, GitHub, Google, and most major APIs. Header-based versioning wins for REST purity and when you want one canonical URL per resource.

    **When to version:** Only on breaking changes (removing fields, renaming endpoints, changing response structure). Additive changes (new optional fields, new endpoints) do not require a version bump.

    **Gotchas:** Running multiple versions multiplies your test matrix and operational burden -- support at most N and N-1 concurrently. Communicate deprecation timelines with `Sunset` and `Deprecation` headers. Never version preemptively (starting at v1 is fine, but do not create v2 until you need a breaking change). If using URI versioning, the "resource" at `/v1/users/42` and `/v2/users/42` is the same entity -- make sure internal IDs are consistent across versions.

---

??? question "Q19: What is content negotiation?"

    **Answer:** Content negotiation is how the client and server agree on response format (JSON vs XML), language, and encoding -- using HTTP headers rather than separate endpoints for each format.

    **Why it exists:** Without it, you would need `/users/42.json` and `/users/42.xml` -- multiplying endpoints by format. Content negotiation keeps one canonical URI per resource while letting different clients (browser, mobile, legacy system) each get the representation they can handle.

    **Request:**

    ```http
    GET /users/42 HTTP/1.1
    Accept: application/json, application/xml;q=0.9
    ```

    The `q` (quality) value indicates preference: `application/json` has an implicit `q=1.0`, and `application/xml` has `q=0.9`, so JSON is preferred.

    **Response:**

    ```http
    HTTP/1.1 200 OK
    Content-Type: application/json
    ```

    If the server cannot satisfy any of the requested formats, it returns **`406 Not Acceptable`**.

    **How it works internally:** The server parses the Accept header, ranks media types by q-value, matches against its supported formats, and selects the highest-priority match. The `Vary: Accept` response header tells caches to store separate copies per format.

    Other negotiation headers:

    - `Accept-Language: en-US, fr;q=0.8` -- language preference
    - `Accept-Encoding: gzip, deflate` -- compression preference
    - `Accept-Charset: utf-8` -- character set preference

    **When to use:** When your API serves multiple formats (JSON + XML for legacy clients) or multiple languages. Also used in versioning via vendor media types (`application/vnd.myapi.v2+json`).

    **Gotchas:** If you omit the `Vary` header, CDNs will cache the first format served and return it to all clients regardless of their Accept header. Most modern APIs only support JSON and skip negotiation entirely -- that is fine, but return 406 (not 200 with an error body) if a client requests an unsupported format. Also, `Accept: */*` (the default for curl and many HTTP libraries) matches anything, so test with explicit Accept headers.

---

??? question "Q20: What are the common authentication methods for REST APIs?"

    **Answer:** REST APIs authenticate via tokens or credentials sent in HTTP headers -- the choice depends on your trust model, client type, and security requirements.

    **Why multiple methods exist:** Different contexts have different threat models. Browser clients cannot keep secrets (use OAuth + PKCE). Server-to-server calls can use long-lived API keys or mTLS. Third-party integrations need delegation (OAuth scopes) without sharing passwords.

    | Method | How It Works | Best For |
    |--------|-------------|----------|
    | **Basic Auth** | Base64-encoded `username:password` in the `Authorization` header. | Simple internal/dev APIs. Always use with HTTPS. |
    | **API Key** | A unique key sent via header (`X-API-Key`) or query parameter. | Server-to-server communication, public APIs with usage tracking. |
    | **Bearer Token** | A token (often JWT) sent in the `Authorization: Bearer <token>` header. | Stateless authentication for web/mobile apps. |
    | **OAuth 2.0** | Delegation framework with grant types (Authorization Code, Client Credentials, etc.). Issues access tokens with scopes. | Third-party API access, SSO, granular permissions. |
    | **Mutual TLS (mTLS)** | Both client and server present certificates. | High-security service-to-service communication. |

    **When to use which:** API keys for simple server-to-server calls with rate limiting. OAuth 2.0 + PKCE for any user-facing app (SPA, mobile). mTLS for zero-trust service meshes. Basic Auth only for internal tools behind a VPN over HTTPS.

    **Gotchas:** API keys in query parameters get logged in access logs, browser history, and referrer headers -- always use headers. Basic Auth credentials are only Base64-encoded, not encrypted -- without HTTPS they are plaintext. JWTs cannot be revoked without a blocklist or short expiry -- plan for token revocation. Never store tokens in localStorage (XSS-vulnerable) -- use HttpOnly cookies with SameSite=Strict for browser clients.

---

??? question "Q21: What is the structure of a JWT and how is it validated?"

    **Answer:** A JWT is a self-contained, cryptographically signed token with three Base64URL-encoded parts (header.payload.signature) that lets servers verify identity without a database lookup.

    **Why it exists:** Traditional session-based auth requires a server-side session store that every instance must access (sticky sessions or shared Redis). JWTs push the session data into the token itself -- any server with the public key can verify it independently, enabling stateless horizontal scaling.

    ```
    header.payload.signature
    ```

    **1. Header:**

    ```json
    {
      "alg": "RS256",
      "typ": "JWT"
    }
    ```

    **2. Payload (Claims):**

    ```json
    {
      "sub": "user-42",
      "name": "Vamsi",
      "email": "vamsi@example.com",
      "roles": ["admin"],
      "iat": 1700000000,
      "exp": 1700003600,
      "iss": "auth.myapp.com",
      "aud": "api.myapp.com"
    }
    ```

    **3. Signature:**

    ```
    RS256(base64UrlEncode(header) + "." + base64UrlEncode(payload), privateKey)
    ```

    **Validation steps:**

    1. Decode the header and verify the algorithm is expected (prevent `alg: none` attacks).
    2. Verify the **signature** using the public key (asymmetric) or shared secret (symmetric).
    3. Check **`exp`** -- reject if the token is expired.
    4. Check **`iat`** and **`nbf`** (not before) -- reject if the token is not yet valid.
    5. Verify **`iss`** (issuer) matches the expected authorization server.
    6. Verify **`aud`** (audience) matches your API.
    7. Check custom claims (roles, scopes, permissions) for authorization.

    **Gotchas:** JWTs are not encrypted by default -- anyone can decode the payload (use JWE if you need encryption). The `alg: none` attack tricks servers into skipping signature verification -- always whitelist accepted algorithms server-side. JWTs cannot be revoked before expiry without a blocklist (defeats statelessness), so keep expiry short (5-15 min) and use refresh tokens. Large JWTs (many claims) increase every request's size since they travel in headers.

---

??? question "Q22: How does rate limiting work in REST APIs?"

    **Answer:** Rate limiting caps how many requests a client can make per time window -- it protects backend resources, ensures fair usage across tenants, and prevents runaway scripts from taking down your service.

    **Why it exists:** Without rate limiting, a single misbehaving client (bug, scraper, or attacker) can saturate your API, starving legitimate users. It is also a business tool -- tiered limits drive paid plan upgrades.

    **Common algorithms:**

    - **Fixed Window** -- count requests in fixed time intervals (e.g., 100 req/min). Simple but allows burst at window edges (200 requests in 2 seconds straddling the boundary).
    - **Sliding Window** -- smooths out bursts by using a rolling time window. Weighted combination of current and previous window counts.
    - **Token Bucket** -- tokens are added at a fixed rate; each request consumes a token. Allows controlled bursts up to bucket capacity.
    - **Leaky Bucket** -- requests are queued and processed at a constant rate. Smoothest output but adds latency.

    **Standard response headers:**

    ```http
    X-RateLimit-Limit: 1000          # Max requests in the window
    X-RateLimit-Remaining: 742       # Requests remaining
    X-RateLimit-Reset: 1700003600    # Unix timestamp when the window resets
    Retry-After: 30                  # Seconds to wait (when rate limited)
    ```

    When the limit is exceeded, the server returns **`429 Too Many Requests`** with a `Retry-After` header.

    **When to use which algorithm:** Token bucket for APIs that need burst tolerance (user-facing). Sliding window for strict fairness (multi-tenant platforms). Fixed window when simplicity matters and edge bursts are acceptable.

    **Gotchas:** Rate limiting by IP breaks for clients behind shared NATs (corporate offices, mobile carriers -- thousands of users share one IP). Use API key or authenticated user ID instead. Distributed rate limiting across multiple API gateway instances requires shared state (Redis) -- a single-node counter does not work. Always return rate limit headers on *every* response (not just 429) so clients can self-throttle proactively. The `X-RateLimit-Reset` should be a Unix timestamp, not "seconds remaining" -- but implementations vary, so document yours clearly.

---

??? question "Q23: What is CORS and why is it needed?"

    **Answer:** CORS is a browser-enforced security mechanism that controls which external origins can call your API from client-side JavaScript -- it does not apply to server-to-server calls.

    **Why it exists:** The Same-Origin Policy prevents malicious sites from making authenticated requests to your API using a victim's cookies. CORS relaxes this safely by letting servers explicitly whitelist trusted origins. Without it, any website could silently call your API with the user's session.

    **How it works:**

    1. **Simple requests** (GET, POST with standard headers) -- browser sends the request directly with an `Origin` header. The server responds with `Access-Control-Allow-Origin`.

    2. **Preflight requests** (PUT, DELETE, custom headers) -- browser first sends an `OPTIONS` request:

    ```http
    OPTIONS /api/users HTTP/1.1
    Origin: https://app.example.com
    Access-Control-Request-Method: DELETE
    Access-Control-Request-Headers: Authorization
    ```

    Server responds:

    ```http
    HTTP/1.1 204 No Content
    Access-Control-Allow-Origin: https://app.example.com
    Access-Control-Allow-Methods: GET, POST, PUT, DELETE
    Access-Control-Allow-Headers: Authorization, Content-Type
    Access-Control-Max-Age: 86400
    ```

    **Key headers:**

    - `Access-Control-Allow-Origin` -- which origins are permitted (`*` for public APIs)
    - `Access-Control-Allow-Methods` -- allowed HTTP methods
    - `Access-Control-Allow-Headers` -- allowed custom headers
    - `Access-Control-Allow-Credentials` -- whether cookies/auth headers are allowed (cannot use `*` for origin if true)
    - `Access-Control-Max-Age` -- how long the preflight result can be cached

    **When to configure:** Any API called from a browser on a different origin. Not needed for server-to-server communication (CORS is purely a browser enforcement).

    **Gotchas:** `Access-Control-Allow-Origin: *` with `credentials: true` is forbidden by the spec -- you must echo the specific origin. Preflight adds a round trip to every non-simple request; set `Access-Control-Max-Age` high (86400s) to cache it. CORS errors appear in the browser console but the actual response is hidden from JavaScript -- this confuses developers debugging API calls. Also, CORS is not security on its own -- curl/Postman bypass it entirely. It only protects against unwitting browser-based attacks.

---

??? question "Q24: What is CSRF and how do you protect REST APIs from it?"

    **Answer:** CSRF exploits the browser's automatic cookie attachment to trick authenticated users into performing unwanted actions -- REST APIs using Bearer tokens in headers are inherently immune.

    **Why it matters:** CSRF is a top-10 web vulnerability. If your API uses cookie-based sessions and a user visits a malicious page, that page can silently trigger state-changing requests (transfers, password changes, deletions) using the victim's authenticated session.

    **Example attack:** A user is logged into `bank.com`. They visit `evil.com`, which contains:

    ```html
    <img src="https://bank.com/api/transfer?to=attacker&amount=10000">
    ```

    The browser sends the request with the user's session cookies automatically.

    **How to protect REST APIs:**

    1. **Use Bearer tokens instead of cookies** -- if your API uses `Authorization: Bearer <token>` headers, browsers will not attach the token automatically. This is the simplest and most effective defense.

    2. **CSRF tokens** -- if you must use cookie-based auth, generate a unique token per session, include it in a custom header (e.g., `X-CSRF-Token`), and validate it server-side.

    3. **SameSite cookies** -- set `SameSite=Strict` or `SameSite=Lax` on session cookies so browsers do not send them on cross-origin requests.

    4. **Check the `Origin` / `Referer` header** -- verify requests come from your own domain.

    5. **Double-submit cookie** -- set a random value in both a cookie and a request header; the server verifies they match.

    **When to worry:** Only when using cookie-based authentication with state-changing endpoints. Truly stateless REST APIs with Bearer tokens are immune by design.

    **Gotchas:** `SameSite=Lax` still allows top-level GET navigations to send cookies -- if your GET endpoints have side effects, Lax is insufficient (use Strict). CSRF protection is orthogonal to CORS -- CORS prevents reading responses, CSRF prevents triggering actions. You need both. Also, subdomains can set cookies for parent domains -- a compromised subdomain can bypass double-submit cookie patterns. Login endpoints need CSRF protection too (login CSRF can force a victim into the attacker's account).

---

??? question "Q25: How does caching work in REST APIs?"

    **Answer:** HTTP caching lets clients, CDNs, and proxies serve stored responses instead of hitting your server -- reducing latency, bandwidth, and backend load by orders of magnitude for read-heavy APIs.

    **Why it matters:** Caching is the single biggest performance lever in REST. A properly cached API can absorb traffic spikes without scaling infrastructure. The HTTP spec builds caching in as a first-class citizen -- REST APIs that ignore it leave massive performance on the table.

    **Cache-Control header** (primary caching mechanism):

    ```http
    Cache-Control: public, max-age=3600          # Cacheable by anyone for 1 hour
    Cache-Control: private, max-age=600           # Only the client can cache (not CDNs)
    Cache-Control: no-cache                       # Must revalidate before reuse
    Cache-Control: no-store                       # Never cache (sensitive data)
    ```

    **ETag (Entity Tag)** -- fingerprint of the resource for conditional requests:

    ```http
    # First response
    HTTP/1.1 200 OK
    ETag: "a1b2c3d4"

    # Subsequent request (conditional)
    GET /users/42
    If-None-Match: "a1b2c3d4"

    # If unchanged
    HTTP/1.1 304 Not Modified    # No body, use cached version
    ```

    **Last-Modified / If-Modified-Since** -- time-based conditional requests:

    ```http
    Last-Modified: Wed, 13 May 2026 10:00:00 GMT

    # Client sends
    If-Modified-Since: Wed, 13 May 2026 10:00:00 GMT
    ```

    **When to use which:** `max-age` for resources with predictable freshness (config, static data). ETags for resources that change unpredictably (user profiles). `no-store` for sensitive data (bank balances, PII). `private` when responses are user-specific and CDNs should not cache them.

    **Gotchas:** `no-cache` does NOT mean "do not cache" -- it means "cache but revalidate every time" (use `no-store` to prevent caching entirely). Missing `Vary: Authorization` on user-specific responses lets CDNs serve one user's data to another. ETags with load-balanced servers can fail if each server generates different hashes for the same content (use content-based hashes, not inode-based). Aggressive caching without cache-busting strategies makes deploying breaking changes difficult -- clients hold stale data.

---

??? question "Q26: What is OpenAPI (Swagger) and why is it important?"

    **Answer:** OpenAPI is the industry-standard, machine-readable format for describing REST APIs -- it is both a living contract and a code generation source that keeps documentation, clients, and servers in sync.

    **Why it matters:** Without a formal spec, API documentation drifts from reality, client SDKs are hand-maintained, and integration testing is manual. OpenAPI closes the loop: one YAML file generates docs, client libraries, server stubs, request validation, and mock servers automatically.

    **Key components of an OpenAPI document:**

    ```yaml
    openapi: 3.1.0
    info:
      title: User Service API
      version: 1.0.0
    paths:
      /users:
        get:
          summary: List all users
          parameters:
            - name: status
              in: query
              schema:
                type: string
          responses:
            '200':
              description: A list of users
              content:
                application/json:
                  schema:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
    components:
      schemas:
        User:
          type: object
          properties:
            id:
              type: integer
            name:
              type: string
    ```

    **Benefits:**

    - **Swagger UI** -- auto-generates interactive API documentation.
    - **Code generation** -- generate client SDKs and server stubs from the spec.
    - **Contract-first design** -- define the API before writing code.
    - **Testing** -- validate requests and responses against the spec.
    - **Gateway integration** -- API gateways can import OpenAPI specs for routing and validation.

    **When to use:** Every production API should have an OpenAPI spec. Use contract-first (write spec, then implement) for new APIs with multiple consumers. Use code-first (generate spec from annotations) for rapid prototyping.

    **Gotchas:** Specs that are generated from code but never reviewed drift into unusable documentation. Overly permissive schemas (everything optional) pass validation but do not actually document the contract. OpenAPI 3.1 aligns with JSON Schema draft 2020-12 -- older tooling may not support it yet. Keep the spec in source control and validate it in CI (use `spectral` or `openapi-generator validate`) to catch breaking changes before deployment.

---

??? question "Q27: What is RFC 7807 Problem Details and how should you format error responses?"

    **Answer:** RFC 7807 (updated as RFC 9457) defines a standard JSON structure for error responses so clients can parse, categorize, and handle errors programmatically without guessing at ad-hoc formats.

    **Why it exists:** Without a standard, every API invents its own error format -- some return `{"error": "..."}`, others `{"message": "...", "code": 123}`, others just a string. Clients must write custom parsing for each API. Problem Details standardizes this so generic error-handling middleware works across all compliant APIs.

    **Standard fields:**

    ```json
    {
      "type": "https://api.example.com/errors/insufficient-funds",
      "title": "Insufficient Funds",
      "status": 422,
      "detail": "Your account balance of $30.00 is insufficient for the $50.00 transfer.",
      "instance": "/transfers/req-abc123"
    }
    ```

    | Field | Description |
    |-------|-------------|
    | `type` | A URI reference identifying the error type (can link to documentation) |
    | `title` | A short, human-readable summary of the problem type |
    | `status` | The HTTP status code |
    | `detail` | A human-readable explanation specific to this occurrence |
    | `instance` | A URI reference identifying this specific occurrence |

    You can extend it with custom fields:

    ```json
    {
      "type": "https://api.example.com/errors/validation-error",
      "title": "Validation Error",
      "status": 422,
      "detail": "The request contains invalid fields.",
      "errors": [
        { "field": "email", "message": "must be a valid email address" },
        { "field": "age", "message": "must be between 0 and 150" }
      ]
    }
    ```

    **When to use:** Any API that returns structured errors. Set the content type to `application/problem+json`. Spring Boot, ASP.NET Core, and many frameworks have built-in support.

    **Gotchas:** The `type` URI should actually resolve to documentation (not a dead link). The `title` is for the error *type* (stable across occurrences), while `detail` is for the specific *instance* (varies). Do not leak internal stack traces or SQL errors in `detail` -- this is a security risk. Also, `status` in the body should always match the HTTP status code header -- if they disagree, clients get confused.

---

??? question "Q28: What are best practices for file upload and download in REST APIs?"

    **Answer:** File operations in REST use multipart/form-data for uploads and content-disposition headers for downloads -- but for production scale, offload the actual bytes to object storage via pre-signed URLs.

    **Why special handling is needed:** Files are binary blobs that do not fit neatly into JSON request/response bodies. They can be gigabytes in size, need streaming (not buffering in memory), require content-type validation, and benefit from CDN delivery -- all things that your API server is not optimized for.

    **File Upload:**

    - Use `multipart/form-data` for uploading files along with metadata:

    ```http
    POST /documents HTTP/1.1
    Content-Type: multipart/form-data; boundary=----boundary

    ------boundary
    Content-Disposition: form-data; name="file"; filename="report.pdf"
    Content-Type: application/pdf

    <binary data>
    ------boundary
    Content-Disposition: form-data; name="description"

    Q3 quarterly report
    ------boundary--
    ```

    - For large files, support **chunked uploads** (upload in parts and reassemble server-side).
    - Return `201 Created` with a `Location` header pointing to the uploaded resource.
    - Validate file type, size, and content server-side (do not trust `Content-Type` from the client).

    **File Download:**

    - Use `GET` with proper `Content-Type` and `Content-Disposition` headers:

    ```http
    GET /documents/42/download HTTP/1.1

    HTTP/1.1 200 OK
    Content-Type: application/pdf
    Content-Disposition: attachment; filename="report.pdf"
    Content-Length: 245678
    ```

    - Support **Range requests** (`Accept-Ranges: bytes`) for resumable downloads.
    - For large files, consider generating pre-signed URLs (e.g., S3 pre-signed URLs) to offload transfer from your API server.

    **When to use pre-signed URLs:** Any file over a few MB, or when you want to keep your API server free from streaming load. The pattern: client calls your API to get a signed upload/download URL, then transfers directly with the storage service.

    **Gotchas:** Never trust client-provided `Content-Type` or filename -- sniff the actual file content (magic bytes) and sanitize filenames to prevent path traversal. Set upload size limits at the reverse proxy level (nginx `client_max_body_size`) not just application code -- otherwise the server buffers the entire body before rejecting. Multipart parsing can be a DoS vector (zip bombs, infinite boundaries) -- use battle-tested libraries with limits. For resumable uploads, consider the tus protocol or Google's resumable upload protocol for standardized chunking.

---

??? question "Q29: How do you handle long-running operations in a REST API?"

    **Answer:** For operations exceeding typical HTTP timeouts, return 202 Accepted immediately and let clients poll a status resource or receive a webhook callback when processing completes.

    **Why this pattern exists:** HTTP connections have finite timeouts (typically 30-60s). Operations like report generation, video encoding, or bulk imports can take minutes to hours. Holding the connection open is fragile (proxy timeouts, mobile network switches, client crashes). The async pattern decouples request submission from result retrieval.

    **Pattern: Asynchronous processing with polling**

    1. Client initiates the operation:

    ```http
    POST /reports
    { "type": "annual", "year": 2025 }

    HTTP/1.1 202 Accepted
    Location: /reports/jobs/abc123
    Retry-After: 10
    ```

    2. Client polls for status:

    ```http
    GET /reports/jobs/abc123

    HTTP/1.1 200 OK
    {
      "status": "processing",
      "progress": 65,
      "estimated_completion": "2026-05-13T15:30:00Z"
    }
    ```

    3. When complete:

    ```http
    GET /reports/jobs/abc123

    HTTP/1.1 303 See Other
    Location: /reports/42
    ```

    **Pattern: Webhooks (server push)**

    The client registers a callback URL upfront. When the operation completes, the server sends a POST to the callback URL with the result.

    ```json
    POST /reports
    {
      "type": "annual",
      "year": 2025,
      "callback_url": "https://client.example.com/hooks/report-done"
    }
    ```

    **When to use which:** Polling for simple integrations or when clients cannot expose public endpoints. Webhooks for server-to-server where the client can receive inbound requests and wants minimal latency on completion notification. Combine both -- offer polling as fallback when webhooks fail.

    **Gotchas:** Polling without `Retry-After` leads to clients hammering your status endpoint -- use exponential backoff or explicit retry intervals. Webhooks require retry logic (what if the client is temporarily down?) -- implement exponential retry with dead-letter queues. Always make the status endpoint idempotent and keep job state for a reasonable TTL (not forever). Clients must handle the case where they poll and the job has failed -- include error details and a clear terminal status.

---

??? question "Q30: What are the differences between Webhooks, Polling, SSE, and WebSocket? When would you choose GraphQL over REST?"

    **Answer:** These represent the spectrum from simple pull-based communication to full-duplex streaming -- choosing correctly depends on latency requirements, directionality, and infrastructure constraints. GraphQL vs REST is a separate axis: data-fetching flexibility vs operational simplicity.

    **Why multiple approaches exist:** Different use cases have fundamentally different communication patterns. A stock ticker (server-to-many-clients, one-way) has different needs than a chat app (bidirectional, per-connection state) or a payment notification (server-to-server, event-driven).

    **Real-time communication comparison:**

    | Approach | Direction | Connection | Latency | Use Case |
    |----------|-----------|------------|---------|----------|
    | **Polling** | Client to Server | Repeated HTTP requests | High (interval-dependent) | Simple status checks, legacy systems |
    | **Long Polling** | Client to Server | Held-open HTTP request | Medium | Moderate real-time needs |
    | **Webhooks** | Server to Client | Server POSTs to client URL | Low | Event notifications (payments, CI/CD) |
    | **SSE (Server-Sent Events)** | Server to Client | Persistent one-way HTTP stream | Low | Live feeds, notifications, dashboards |
    | **WebSocket** | Bidirectional | Persistent full-duplex TCP | Very Low | Chat, gaming, collaborative editing |

    **Choosing between them:**

    - **Polling** when simplicity matters more than latency and events are infrequent.
    - **Webhooks** for event-driven server-to-server notifications where the receiver has a public endpoint.
    - **SSE** when you need server-to-client streaming over standard HTTP (auto-reconnect built in, works through proxies/CDNs).
    - **WebSocket** when you need true bidirectional, low-latency communication with per-connection state.

    ---

    **GraphQL vs REST:**

    | Aspect | REST | GraphQL |
    |--------|------|---------|
    | **Data fetching** | Fixed structure per endpoint | Client specifies exact fields needed |
    | **Over-fetching** | Common (endpoint returns all fields) | Eliminated (client requests only what it needs) |
    | **Under-fetching** | Requires multiple round trips | Single query can fetch nested resources |
    | **Endpoints** | Many (`/users`, `/users/42/orders`) | One (`/graphql`) |
    | **Caching** | Built-in HTTP caching | Requires custom caching (Apollo, Relay) |
    | **Versioning** | Explicit versions (v1, v2) | Schema evolution, deprecate fields |
    | **File upload** | Native multipart support | Requires workarounds |
    | **Learning curve** | Low | Medium-High |

    **Choose REST when:** You need simplicity, HTTP caching, broad tooling support, and your data model maps cleanly to resources.

    **Choose GraphQL when:** You have complex, deeply nested data; many different clients with different data needs; or you want to avoid over-fetching/under-fetching on bandwidth-constrained clients (mobile).

    **Gotchas:** WebSockets bypass HTTP caching, authentication middleware, and load balancer features -- you must reimplement these at the application layer. SSE has a browser limit of 6 connections per domain (HTTP/1.1) -- use HTTP/2 to avoid this. Webhooks require idempotent receivers (the sender may retry) and verification (HMAC signatures) to prevent spoofing. GraphQL's flexibility is also its weakness -- without query complexity limits, clients can craft expensive nested queries that DoS your database (the "N+1 on steroids" problem). Long polling holds server threads/connections open -- it does not scale without async I/O.
