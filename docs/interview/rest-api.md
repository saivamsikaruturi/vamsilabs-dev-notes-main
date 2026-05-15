# Top 30 REST API Interview Questions & Answers

---

??? question "Q1: What is REST and what makes an API RESTful?"

    **Answer:** REST (Representational State Transfer) is an **architectural style** defined by Roy Fielding in his 2000 doctoral dissertation. It is not a protocol or standard -- it is a set of constraints that, when applied to a web service, make it "RESTful."

    A RESTful API uses HTTP as its transport protocol, represents resources as URIs, and exchanges representations (typically JSON or XML) of those resources. The key idea is that the server exposes **resources** and the client interacts with them through a uniform interface using standard HTTP methods.

    REST is popular because it is simple, stateless, cacheable, and aligns naturally with the architecture of the web itself.

---

??? question "Q2: What are the six constraints of REST?"

    **Answer:** Roy Fielding defined six architectural constraints:

    | # | Constraint | Description |
    |---|-----------|-------------|
    | 1 | **Client-Server** | Separation of concerns -- the client handles the UI, the server handles data storage. They evolve independently. |
    | 2 | **Stateless** | Each request from the client must contain all information needed to process it. The server stores no client session state between requests. |
    | 3 | **Cacheable** | Responses must implicitly or explicitly label themselves as cacheable or non-cacheable so clients (and intermediaries) can reuse responses. |
    | 4 | **Uniform Interface** | A standardized way to interact with resources (resource identification via URIs, manipulation through representations, self-descriptive messages, and HATEOAS). |
    | 5 | **Layered System** | The architecture can be composed of multiple layers (proxies, gateways, load balancers). A client cannot tell whether it is connected directly to the server. |
    | 6 | **Code on Demand (optional)** | Servers can extend client functionality by transferring executable code (e.g., JavaScript). This is the only optional constraint. |

---

??? question "Q3: How does REST differ from SOAP?"

    **Answer:**

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

    **When to choose SOAP:** You need formal contracts, built-in retry logic, or WS-Security for complex enterprise integrations.
    **When to choose REST:** You want simplicity, performance, caching, and broad client compatibility.

---

??? question "Q4: What are the main HTTP methods and their semantics?"

    **Answer:**

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

---

??? question "Q5: What is the difference between PUT and PATCH?"

    **Answer:**

    **PUT** performs a **full replacement** of the resource. The client sends the complete updated representation. Any field omitted from the payload is set to null or its default value.

    ```json
    PUT /users/42
    {
      "name": "Vamsi",
      "email": "vamsi@example.com",
      "phone": "555-1234"
    }
    ```

    **PATCH** performs a **partial update**. The client sends only the fields that need to change.

    ```json
    PATCH /users/42
    {
      "phone": "555-9999"
    }
    ```

    Key differences:

    - **PUT** is idempotent by definition. Sending the same PUT request twice produces the same result.
    - **PATCH** is not guaranteed to be idempotent (depends on patch format).
    - **PUT** requires the client to know the full resource structure; **PATCH** does not.
    - Use **PUT** when the client manages the entire resource. Use **PATCH** when updating one or two fields.

---

??? question "Q6: When should you use POST vs PUT?"

    **Answer:**

    | Characteristic | POST | PUT |
    |---------------|------|-----|
    | **Purpose** | Create a new resource (server assigns ID) | Create or replace a resource (client knows the ID) |
    | **Idempotent** | No -- calling twice may create duplicates | Yes -- calling twice has the same effect |
    | **URI target** | Collection URI: `POST /users` | Specific resource URI: `PUT /users/42` |
    | **Response** | `201 Created` with `Location` header | `200 OK` or `201 Created` (if new) or `204 No Content` |

    **Rule of thumb:** If the client determines the resource URI, use PUT. If the server determines the URI (e.g., auto-generated ID), use POST.

    ```
    POST /articles          --> server creates /articles/17
    PUT  /articles/17       --> client replaces /articles/17
    ```

---

??? question "Q7: What is idempotency and which HTTP methods are idempotent?"

    **Answer:** An operation is **idempotent** if performing it multiple times produces the same result as performing it once. The server-side state after N identical requests is the same as after one request.

    **Idempotent methods:** GET, PUT, DELETE, HEAD, OPTIONS, TRACE

    **Non-idempotent methods:** POST, PATCH (by default)

    Why it matters:

    - **Retries are safe** for idempotent methods. If a network failure occurs and the client is unsure whether the request succeeded, it can safely retry.
    - **POST** is not idempotent -- retrying a `POST /orders` could create duplicate orders, which is why APIs often use **idempotency keys** (a unique request ID in a header) to make POST requests safely retriable.

    ```
    Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
    ```

---

??? question "Q8: What is the difference between safe methods and idempotent methods?"

    **Answer:**

    - **Safe methods** do not modify server-side state. They are read-only. Safe methods are: **GET, HEAD, OPTIONS, TRACE**.
    - **Idempotent methods** may modify state, but repeating the same request has no additional effect. Idempotent methods are: **GET, HEAD, OPTIONS, TRACE, PUT, DELETE**.

    All safe methods are idempotent, but not all idempotent methods are safe. For example, **DELETE** is idempotent (deleting a resource twice results in the same state -- the resource is gone), but it is not safe because it modifies server state.

    | Method | Safe | Idempotent |
    |--------|:----:|:----------:|
    | GET | Yes | Yes |
    | HEAD | Yes | Yes |
    | OPTIONS | Yes | Yes |
    | PUT | No | Yes |
    | DELETE | No | Yes |
    | POST | No | No |
    | PATCH | No | No |

---

??? question "Q9: What are the key HTTP status codes to know for REST APIs?"

    **Answer:**

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

---

??? question "Q10: What is the difference between 200, 201, and 204?"

    **Answer:**

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

---

??? question "Q11: What is the difference between 400, 401, 403, 404, 409, and 422?"

    **Answer:**

    | Code | Name | When to Use |
    |------|------|-------------|
    | **400** | Bad Request | Malformed JSON, missing required fields, wrong data types. The request itself is structurally invalid. |
    | **401** | Unauthorized | No authentication credentials provided, or the token/credentials are invalid or expired. The client must authenticate. |
    | **403** | Forbidden | The client is authenticated but lacks permission to perform the action. Re-authenticating will not help. |
    | **404** | Not Found | The resource does not exist at the given URI, or the server wants to hide its existence from unauthorized users. |
    | **409** | Conflict | The request conflicts with the current state of the resource -- e.g., creating a user with a duplicate email, or an optimistic locking version mismatch. |
    | **422** | Unprocessable Entity | The JSON is well-formed (not a 400) but the values fail business validation -- e.g., age is -5, email format is invalid, end date is before start date. |

    A practical way to distinguish **400 vs 422**: if a JSON parser rejects it, return 400. If your business logic rejects it, return 422.

---

??? question "Q12: What are REST API URL naming conventions and best practices?"

    **Answer:**

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

---

??? question "Q13: When should you use path parameters vs query parameters?"

    **Answer:**

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

    **Guidelines:**

    | Use Path Parameters When | Use Query Parameters When |
    |-------------------------|--------------------------|
    | Identifying a specific resource | Filtering a collection |
    | The parameter is required | The parameter is optional |
    | The value defines what you are requesting | The value refines how results are returned |
    | Removing it changes the meaning of the URI | Removing it just returns unfiltered results |

    Rule of thumb: if it is a **resource identifier**, put it in the path. If it is a **modifier**, put it in the query string.

---

??? question "Q14: What is HATEOAS?"

    **Answer:** HATEOAS (Hypermedia as the Engine of Application State) is a REST constraint where the server provides **hypermedia links** in responses that tell the client what actions are available next. The client does not need hardcoded knowledge of the API structure -- it discovers available transitions dynamically.

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

    **Benefits:** Decouples client from server URL structure, enables API evolution without breaking clients, makes APIs self-documenting at runtime.

    **Reality:** Most real-world REST APIs do not fully implement HATEOAS because of the added complexity. It is the hallmark of a truly RESTful (Level 3) API per the Richardson Maturity Model.

---

??? question "Q15: What is the Richardson Maturity Model?"

    **Answer:** The Richardson Maturity Model (by Leonard Richardson) classifies REST APIs into four maturity levels:

    | Level | Name | Description | Example |
    |-------|------|-------------|---------|
    | **Level 0** | The Swamp of POX | Single URI, single HTTP method (usually POST). Basically RPC over HTTP. | `POST /api` with action in the body |
    | **Level 1** | Resources | Multiple URIs (one per resource), but still using a single HTTP method. | `POST /users/42`, `POST /orders/7` |
    | **Level 2** | HTTP Verbs | Proper use of HTTP methods (GET, POST, PUT, DELETE) and status codes. | `GET /users/42`, `DELETE /orders/7` |
    | **Level 3** | Hypermedia Controls | HATEOAS -- responses include links to available actions and related resources. | Response includes `_links` with next actions |

    Most production APIs are at **Level 2**. Level 3 (HATEOAS) is the "glory of REST" but is rarely fully implemented in practice.

---

??? question "Q16: What are common pagination approaches in REST APIs?"

    **Answer:**

    **1. Offset-based pagination:**

    ```
    GET /users?offset=40&limit=20
    ```

    - Simple to implement and understand.
    - Problem: inconsistent results if data is inserted/deleted between pages (items can be skipped or duplicated). Performance degrades on large offsets because the database must scan and skip rows.

    **2. Cursor/Keyset-based pagination:**

    ```
    GET /users?after=eyJpZCI6NDJ9&limit=20
    ```

    - The cursor is an opaque token (often base64-encoded) pointing to the last item of the previous page.
    - Consistent results even when data changes. Efficient for large datasets (uses indexed column seeks).
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

    **Best practice:** Use **cursor-based pagination** for large or frequently-changing datasets. Always return `total_count` (if feasible) and navigation links in the response.

---

??? question "Q17: How do you design filtering, sorting, and searching in a REST API?"

    **Answer:**

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

    **Best practices:**

    - Keep parameter names consistent across all endpoints.
    - Document allowed filter fields, sort fields, and operators.
    - Set sensible defaults (e.g., `limit=20`, `sort=created_at:desc`).
    - Validate and reject unknown parameters with `400 Bad Request`.

---

??? question "Q18: What are the main API versioning strategies?"

    **Answer:**

    | Strategy | Example | Pros | Cons |
    |----------|---------|------|------|
    | **URI Path** | `GET /api/v1/users` | Simple, visible, easy to route | Violates REST (URI should identify resource, not version). Proliferates URI paths. |
    | **Query Parameter** | `GET /users?version=2` | Easy to add, optional | Easy to forget, not obvious in documentation |
    | **Custom Header** | `X-API-Version: 2` | Keeps URI clean | Hidden from browsers, harder to test with simple tools |
    | **Accept Header (Content Negotiation)** | `Accept: application/vnd.myapi.v2+json` | Most RESTful approach, keeps URIs clean | Complex to implement and test, not intuitive for beginners |

    **Most common in practice:** URI path versioning (`/v1/`, `/v2/`) because of its simplicity and clarity, despite being less "pure REST."

    **Best practices:**

    - Version only when you introduce breaking changes.
    - Support at least the current and previous version concurrently.
    - Communicate deprecation timelines clearly with `Sunset` and `Deprecation` headers.

---

??? question "Q19: What is content negotiation?"

    **Answer:** Content negotiation is the mechanism by which a client and server agree on the **format** of the response. The client specifies its preferred media types via the `Accept` header, and the server responds with the best match.

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

    Other negotiation headers:

    - `Accept-Language: en-US, fr;q=0.8` -- language preference
    - `Accept-Encoding: gzip, deflate` -- compression preference
    - `Accept-Charset: utf-8` -- character set preference

---

??? question "Q20: What are the common authentication methods for REST APIs?"

    **Answer:**

    | Method | How It Works | Best For |
    |--------|-------------|----------|
    | **Basic Auth** | Base64-encoded `username:password` in the `Authorization` header. | Simple internal/dev APIs. Always use with HTTPS. |
    | **API Key** | A unique key sent via header (`X-API-Key`) or query parameter. | Server-to-server communication, public APIs with usage tracking. |
    | **Bearer Token** | A token (often JWT) sent in the `Authorization: Bearer <token>` header. | Stateless authentication for web/mobile apps. |
    | **OAuth 2.0** | Delegation framework with grant types (Authorization Code, Client Credentials, etc.). Issues access tokens with scopes. | Third-party API access, SSO, granular permissions. |
    | **Mutual TLS (mTLS)** | Both client and server present certificates. | High-security service-to-service communication. |

    **Best practices:**

    - Always use **HTTPS** -- never send credentials over plain HTTP.
    - Use **short-lived access tokens** with **refresh tokens** for rotation.
    - Use **OAuth 2.0 + PKCE** for public clients (SPAs, mobile apps).
    - Store tokens securely (HttpOnly cookies for browsers, secure storage for mobile).

---

??? question "Q21: What is the structure of a JWT and how is it validated?"

    **Answer:** A JWT (JSON Web Token) has three Base64URL-encoded parts separated by dots:

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

---

??? question "Q22: How does rate limiting work in REST APIs?"

    **Answer:** Rate limiting restricts the number of API requests a client can make within a time window to protect the server from abuse and ensure fair usage.

    **Common algorithms:**

    - **Fixed Window** -- count requests in fixed time intervals (e.g., 100 req/min). Simple but allows burst at window edges.
    - **Sliding Window** -- smooths out bursts by using a rolling time window.
    - **Token Bucket** -- tokens are added at a fixed rate; each request consumes a token. Allows controlled bursts.
    - **Leaky Bucket** -- requests are queued and processed at a constant rate.

    **Standard response headers:**

    ```http
    X-RateLimit-Limit: 1000          # Max requests in the window
    X-RateLimit-Remaining: 742       # Requests remaining
    X-RateLimit-Reset: 1700003600    # Unix timestamp when the window resets
    Retry-After: 30                  # Seconds to wait (when rate limited)
    ```

    When the limit is exceeded, the server returns **`429 Too Many Requests`** with a `Retry-After` header.

    **Best practices:** Rate limit by API key, user ID, or IP address. Use different limits for different tiers (free vs premium). Implement at the API gateway layer.

---

??? question "Q23: What is CORS and why is it needed?"

    **Answer:** CORS (Cross-Origin Resource Sharing) is a browser security mechanism that controls which **origins** (domain + protocol + port) can access your API from client-side JavaScript.

    By default, browsers enforce the **Same-Origin Policy** -- a script on `app.example.com` cannot call `api.another.com`. CORS relaxes this policy in a controlled way.

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

---

??? question "Q24: What is CSRF and how do you protect REST APIs from it?"

    **Answer:** CSRF (Cross-Site Request Forgery) is an attack where a malicious website tricks a user's browser into making an unwanted request to your API using the user's existing session cookies.

    **Example attack:** A user is logged into `bank.com`. They visit `evil.com`, which contains:

    ```html
    <img src="https://bank.com/api/transfer?to=attacker&amount=10000">
    ```

    The browser sends the request with the user's session cookies automatically.

    **Protection strategies for REST APIs:**

    1. **Use Bearer tokens instead of cookies** -- if your API uses `Authorization: Bearer <token>` headers, browsers will not attach the token automatically. This is the simplest and most effective defense.

    2. **CSRF tokens** -- if you must use cookie-based auth, generate a unique token per session, include it in a custom header (e.g., `X-CSRF-Token`), and validate it server-side.

    3. **SameSite cookies** -- set `SameSite=Strict` or `SameSite=Lax` on session cookies so browsers do not send them on cross-origin requests.

    4. **Check the `Origin` / `Referer` header** -- verify requests come from your own domain.

    5. **Double-submit cookie** -- set a random value in both a cookie and a request header; the server verifies they match.

    **Key insight:** Truly stateless REST APIs that use Bearer tokens in the `Authorization` header are inherently immune to CSRF because the browser never automatically attaches the token.

---

??? question "Q25: How does caching work in REST APIs?"

    **Answer:** HTTP caching reduces latency and server load by allowing clients and intermediaries to reuse responses.

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

    **Best practices:**

    - Use `ETag` for precise cache validation (hash-based).
    - Set `Cache-Control` explicitly on every response.
    - Cache GET responses aggressively; never cache POST/PUT/DELETE.
    - Use `Vary` header to cache different representations (e.g., `Vary: Accept`).

---

??? question "Q26: What is OpenAPI (Swagger) and why is it important?"

    **Answer:** The **OpenAPI Specification** (formerly Swagger Specification) is a standard, language-agnostic format for describing REST APIs. It defines endpoints, request/response schemas, authentication methods, and more in a machine-readable YAML or JSON file.

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

---

??? question "Q27: What is RFC 7807 Problem Details and how should you format error responses?"

    **Answer:** RFC 7807 (now also RFC 9457) defines a standard JSON format for HTTP error responses called **Problem Details**. It provides a consistent structure so clients can parse and handle errors programmatically.

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

    Use the content type `application/problem+json` for Problem Details responses.

---

??? question "Q28: What are best practices for file upload and download in REST APIs?"

    **Answer:**

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

    **Best practices:** Set upload size limits, scan for malware, store files in object storage (S3, GCS), and return only metadata from the upload endpoint.

---

??? question "Q29: How do you handle long-running operations in a REST API?"

    **Answer:** For operations that take longer than a typical HTTP timeout (e.g., report generation, data processing, video encoding):

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

    **Key points:**

    - Use **`202 Accepted`** to signal async processing has started.
    - Provide a `Location` header pointing to a status endpoint.
    - Include `Retry-After` to suggest polling intervals.
    - Return the final result URI via `303 See Other` when done.

---

??? question "Q30: What are the differences between Webhooks, Polling, SSE, and WebSocket? When would you choose GraphQL over REST?"

    **Answer:**

    **Real-time communication comparison:**

    | Approach | Direction | Connection | Latency | Use Case |
    |----------|-----------|------------|---------|----------|
    | **Polling** | Client to Server | Repeated HTTP requests | High (interval-dependent) | Simple status checks, legacy systems |
    | **Long Polling** | Client to Server | Held-open HTTP request | Medium | Moderate real-time needs |
    | **Webhooks** | Server to Client | Server POSTs to client URL | Low | Event notifications (payments, CI/CD) |
    | **SSE (Server-Sent Events)** | Server to Client | Persistent one-way HTTP stream | Low | Live feeds, notifications, dashboards |
    | **WebSocket** | Bidirectional | Persistent full-duplex TCP | Very Low | Chat, gaming, collaborative editing |

    **Choosing between them:**

    - **Polling** when simplicity matters more than latency.
    - **Webhooks** for event-driven server-to-server notifications.
    - **SSE** when you need server-to-client streaming over standard HTTP (auto-reconnect built in).
    - **WebSocket** when you need true bidirectional, low-latency communication.

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
