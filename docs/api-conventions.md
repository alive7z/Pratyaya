# API conventions

Routes use `/api/v1`. Successful responses contain `data` and `meta`; errors contain `error` and `meta`.

```json
{
  "data": {},
  "meta": { "requestId": "...", "timestamp": "2026-10-23T00:00:00.000Z" }
}
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed"
  },
  "meta": { "requestId": "...", "timestamp": "2026-10-23T00:00:00.000Z" }
}
```

Caller request IDs are accepted only when they match the bounded safe pattern. Validation failures use `422`; malformed JSON uses `400`; missing authentication `401`; denied access `403`; conflicts `409`; rate limiting `429`; unavailable dependencies `503`. Internal MongoDB, provider, stack, and secret details are never returned.

The API currently exposes health, system information, authentication, demo sessions, role dashboards, audit logs, and OpenAPI. Authentication uses an HttpOnly access-token cookie and a rotated HttpOnly refresh-token cookie scoped to `/api/v1/auth`. State-changing cookie-authenticated routes require the `X-CSRF-Token` header matching the readable CSRF cookie.

Demo sessions are created through `POST /api/v1/demo/session` with an allowlisted role and grant read-only access to synthetic sandbox data. They are not credentials for real merchants and are subject to tighter rate limits and expiry.

| Method | Path                   | Auth                                  | Purpose                                   |
| ------ | ---------------------- | ------------------------------------- | ----------------------------------------- |
| `GET`  | `/demo/roles`          | public                                | List allowlisted demo roles               |
| `POST` | `/demo/session`        | public + CSRF cookie bootstrap        | Create a demo session                     |
| `POST` | `/auth/register`       | public                                | Register a user and merchant membership   |
| `POST` | `/auth/login`          | public                                | Authenticate and set session cookies      |
| `POST` | `/auth/refresh`        | refresh cookie + CSRF                 | Rotate the refresh token                  |
| `POST` | `/auth/logout`         | refresh cookie + CSRF                 | Revoke the current session                |
| `GET`  | `/auth/me`             | bearer or access cookie               | Current user, membership, and permissions |
| `GET`  | `/dashboard/merchant`  | `merchant:dashboard:read`             | Merchant dashboard data                   |
| `GET`  | `/dashboard/admin`     | `admin:dashboard:read` + demo sandbox | Admin dashboard data                      |
| `GET`  | `/dashboard/developer` | `developer:dashboard:read`            | Developer dashboard data                  |
| `GET`  | `/dashboard/risk`      | `risk:dashboard:read`                 | Risk dashboard data                       |
| `GET`  | `/audit-logs`          | audit permission                      | Scoped audit records                      |
