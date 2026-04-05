---
name: api-design
description: Load when designing a new REST API, reviewing an API contract, adding new endpoints, or when asked about REST conventions, versioning, request/response shapes, error formats.
---

# API Design

## Resource Naming

| Rule                                   | Good                        | Bad                         |
|----------------------------------------|-----------------------------|-----------------------------|
| Plural nouns for collections           | `/users`                    | `/user`, `/getUsers`        |
| kebab-case for multi-word resources    | `/order-items`              | `/orderItems`, `/order_items`|
| Nested for ownership (max 1 level)     | `/users/{id}/orders`        | `/users/{id}/orders/{oid}/items/{iid}` |
| No verbs in URLs                       | `POST /orders`              | `POST /createOrder`         |
| Resource ID in path, filters in query  | `/orders?status=pending`    | `/orders/pending`           |

---

## HTTP Methods & Status Codes

| Method   | Semantics                        | Success codes     |
|----------|----------------------------------|-------------------|
| GET      | Read resource(s)                 | 200               |
| POST     | Create resource                  | 201 + Location header |
| PUT      | Replace full resource            | 200               |
| PATCH    | Partial update                   | 200               |
| DELETE   | Remove resource                  | 204 (no body)     |

| Situation                             | Status |
|---------------------------------------|--------|
| Validation error                      | 400    |
| Unauthenticated                       | 401    |
| Authenticated but not authorised      | 403    |
| Resource not found                    | 404    |
| Conflict (duplicate, state violation) | 409    |
| Unprocessable (semantic error)        | 422    |
| Internal server error                 | 500    |

**Never return 200 for an error.**

---

## Standard Error Response Shape

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    { "field": "email", "message": "must be a valid email address" },
    { "field": "age",   "message": "must be a positive integer" }
  ],
  "requestId": "req_01HXYZ"
}
```

- `code`: machine-readable SCREAMING_SNAKE_CASE constant.
- `message`: human-readable summary.
- `details`: array of field-level errors (omit if not applicable).
- `requestId`: trace ID for correlation.

---

## Versioning Strategy

| Strategy        | Format                           | When to use                                 |
|-----------------|----------------------------------|---------------------------------------------|
| URL path        | `/v1/users`                      | Default; simple, cacheable, easy to test    |
| Accept header   | `Accept: application/vnd.api+v2` | Multiple representations of same resource  |
| Query param     | `/users?version=2`               | Avoid — pollutes caching and logs           |

**Rule**: Use URL path versioning by default. Introduce `/v2` only for breaking changes; never modify a published version.

---

## Pagination Shape (cursor-based)

```json
{
  "data": [...],
  "pagination": {
    "cursor": "eyJpZCI6MTAwfQ==",
    "hasMore": true,
    "limit": 20
  }
}
```

Use cursor-based pagination for large or frequently-changing datasets.
Use offset/limit only for small, stable datasets where arbitrary page jumps are needed.

```
GET /orders?cursor=eyJpZCI6MTAwfQ==&limit=20
```

---

## Idempotency

| Method         | Idempotent? | Notes                                              |
|----------------|-------------|----------------------------------------------------|
| GET            | Yes         | Must not have side effects                         |
| PUT            | Yes         | Same request = same state                          |
| PATCH          | Conditional | If using JSON Patch operations, yes; otherwise careful |
| DELETE         | Yes         | Deleting an already-deleted resource returns 404, not 500 |
| POST           | No          | Use `Idempotency-Key` header for payment/order endpoints |

```
POST /payments
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

---

## OpenAPI-First Principle

1. Write the OpenAPI spec **before** implementation.
2. Implement against the spec; use generated validators.
3. Never let the implementation diverge from the spec — use contract tests.

```bash
# Validate spec
npx @stoplight/spectral-cli lint openapi.yaml

# Generate TypeScript types from spec
npx openapi-typescript openapi.yaml -o src/types/api.ts
```

---

## Anti-Patterns

| Anti-pattern                            | Fix                                                  |
|-----------------------------------------|------------------------------------------------------|
| Verbs in URLs (`/createUser`)           | Use noun + HTTP method (`POST /users`)               |
| Returning entity instead of DTO        | Always project to a response DTO; never leak internals|
| `200 OK` for errors                     | Use the correct 4xx/5xx status code                  |
| Inconsistent error shapes per endpoint  | Centralise error formatting in middleware            |
| Deeply nested routes (> 2 levels)       | Flatten; use query params for filters                |
| Breaking changes in existing version    | Introduce `/v2`; deprecate `/v1` with sunset header  |
| No pagination on list endpoints         | Default `limit=20`; never return unbounded lists     |
