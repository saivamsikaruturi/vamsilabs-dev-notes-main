# API Design Best Practices

## REST API Design Principles

REST (Representational State Transfer) APIs should be intuitive, consistent, and well-documented.

### Resource Naming Conventions

| Convention | Good | Bad |
|---|---|---|
| Use nouns, not verbs | `/users` | `/getUsers` |
| Use plural nouns | `/orders` | `/order` |
| Use kebab-case | `/user-profiles` | `/userProfiles` |
| Nest for relationships | `/users/123/orders` | `/getUserOrders?id=123` |

### HTTP Methods

| Method | Operation | Idempotent | Safe |
|---|---|---|---|
| `GET` | Read resource(s) | Yes | Yes |
| `POST` | Create resource | No | No |
| `PUT` | Full update / Replace | Yes | No |
| `PATCH` | Partial update | No | No |
| `DELETE` | Remove resource | Yes | No |

## API Versioning Strategies

### URI Versioning

```
GET /api/v1/users
GET /api/v2/users
```

**Pros**: Explicit, easy to understand, cacheable.
**Cons**: URL pollution, breaks when clients upgrade.

### Header Versioning

```http
GET /api/users
Accept: application/vnd.myapi.v2+json
```

**Pros**: Clean URLs, follows HTTP spec.
**Cons**: Harder to test in browser.

### Query Parameter Versioning

```
GET /api/users?version=2
```

**Pros**: Easy to implement and default.
**Cons**: Can be forgotten, cache key issues.

!!! tip "Recommendation"
    URI versioning is the most widely adopted approach and easiest for consumers to understand.

## Pagination

### Offset-Based Pagination

```json
GET /api/users?page=2&size=20

{
  "data": [...],
  "pagination": {
    "page": 2,
    "size": 20,
    "total_pages": 10,
    "total_elements": 200
  }
}
```

### Cursor-Based Pagination

```json
GET /api/users?cursor=eyJpZCI6MTAwfQ&limit=20

{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MTIwfQ",
    "has_more": true
  }
}
```

!!! note "When to use which?"
    - **Offset-based**: Simple datasets, need "jump to page" functionality.
    - **Cursor-based**: Large datasets, real-time feeds, better performance with deep pagination.

## Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body contains invalid fields",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      }
    ],
    "timestamp": "2025-01-15T10:30:00Z",
    "trace_id": "abc-123-def"
  }
}
```

### HTTP Status Code Cheat Sheet

| Range | Category | Common Codes |
|---|---|---|
| `2xx` | Success | `200` OK, `201` Created, `204` No Content |
| `3xx` | Redirection | `301` Moved Permanently, `304` Not Modified |
| `4xx` | Client Error | `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `409` Conflict, `422` Unprocessable, `429` Too Many Requests |
| `5xx` | Server Error | `500` Internal Server Error, `502` Bad Gateway, `503` Service Unavailable |

## HATEOAS

Hypermedia as the Engine of Application State — include links in responses to guide clients:

```json
{
  "id": 123,
  "name": "Vamsi",
  "email": "vamsi@example.com",
  "_links": {
    "self": { "href": "/api/users/123" },
    "orders": { "href": "/api/users/123/orders" },
    "update": { "href": "/api/users/123", "method": "PUT" },
    "delete": { "href": "/api/users/123", "method": "DELETE" }
  }
}
```

## Idempotency

Idempotent operations produce the same result regardless of how many times they are called.

### Idempotency Keys

For non-idempotent operations like `POST`, use an idempotency key:

```http
POST /api/payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "amount": 100.00,
  "currency": "USD"
}
```

The server stores the result keyed by the idempotency key and returns it on duplicate requests.

## Rate Limiting Headers

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
Retry-After: 60
```

## Security Checklist

- [x] Use HTTPS everywhere
- [x] Authenticate with OAuth 2.0 or JWT
- [x] Validate and sanitize all inputs
- [x] Use rate limiting and throttling
- [x] Implement CORS properly
- [x] Don't expose stack traces in production
- [x] Use request/response compression (gzip)
- [x] Log all requests with trace IDs
