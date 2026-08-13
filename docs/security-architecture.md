# API Security Architecture

This Express API uses layered defenses. Application middleware protects normal
API traffic, while large-scale volumetric attacks should be stopped before they
reach Node.js.

## Request Flow

1. Reverse proxy/CDN: Cloudflare, Nginx, AWS ALB, or similar.
2. Express proxy trust and request metadata.
3. HTTP hardening: Helmet, CORS, HPP, compression, hidden Express headers.
4. Request guards: URL length, payload size, request abort logging.
5. Temporary IP blocking for repeated abusive behavior.
6. Public and burst rate limits.
7. Slow-down middleware for request flooding.
8. JSON/urlencoded parsers with small payload limits.
9. Suspicious request detection for common SQLi/XSS/path traversal probes.
10. Route-specific authentication, authorization, validation, and rate limits.

## Rate Limits

Current default limits:

- Public APIs: 100 requests per 15 minutes per IP.
- Login: 5 requests per 15 minutes per IP.
- Register: 5 requests per hour per IP.
- Forgot password: 3 requests per hour per IP.
- OTP verification: 10 requests per hour per IP.
- Resend OTP: 3 requests per 10 minutes per IP.
- Authenticated user APIs: 300 requests per 15 minutes per user.
- Admin APIs: 100 requests per minute per admin user.
- File upload APIs: 20 uploads per hour per user.
- Burst protection: 40 requests per 10 seconds per IP.

Configure `REDIS_URL` in production so these limits are shared across all API
instances. Without Redis, the limiter uses process memory and is suitable only
for local development or a single-instance deployment.

## Redis

Example:

```env
REDIS_URL=redis://localhost:6379
TRUST_PROXY_HOPS=1
JSON_BODY_LIMIT=100kb
URL_ENCODED_BODY_LIMIT=100kb
MAX_URL_LENGTH=2048
REQUEST_TIMEOUT_MS=30000
MAX_UPLOAD_SIZE_BYTES=5242880
```

The app uses Redis only for distributed rate-limit counters. If Redis has a
temporary failure, the limiter is configured to fail open for availability and
logs the store failure. Edge/CDN limits should remain active as the hard outer
control.

## DDoS Responsibilities

Express can handle API-aware protections: authentication-aware rate limits,
slow-down, suspicious request blocking, and structured logs.

Cloudflare, Nginx, or AWS ALB should handle:

- L3/L4 volumetric DDoS.
- Bot challenges and IP reputation.
- Country/ASN blocking.
- TLS negotiation and HTTP/2 flood controls.
- Connection limits before traffic reaches Node.js.
- WAF rules for known exploit signatures.

Recommended Nginx controls:

```nginx
client_max_body_size 5m;
client_body_timeout 10s;
client_header_timeout 10s;
keepalive_timeout 30s;
large_client_header_buffers 4 8k;
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=addr:10m;
```

Recommended Cloudflare controls:

- Enable WAF managed rules for OWASP.
- Enable bot fight mode or bot management.
- Add rate rules for `/api/user/login`, `/api/user/register`, and `/api/admins`.
- Challenge suspicious countries or ASNs when business allows.
- Cache only safe public GET assets, not authenticated API responses.

## SQL Injection With Prisma

Prisma query builders are safe by default because values are parameterized:

```ts
await prisma.user.findMany({
  where: { email: { contains: search, mode: "insensitive" } },
});
```

Unsafe raw SQL concatenation:

```ts
await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

Safe raw SQL:

```ts
await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`;
```

Rules:

- Prefer Prisma model APIs over raw SQL.
- Never concatenate user input into SQL strings.
- If raw SQL is required, use tagged `$queryRaw` or parameterized APIs.
- Validate body, params, and query with Zod.
- Reject unknown fields via `.strict()`.
- Keep request body limits small.

## Request Validation

All new modules should validate:

- `req.body`
- `req.params`
- `req.query`

Use `validateRequest` for route-level validation, or module-local parse helpers
that use strict Zod schemas. Unknown fields should be rejected unless a route has
a specific reason to allow them.

## Logging

Pino logs:

- Rate-limit violations.
- Suspicious requests.
- Failed logins.
- Temporary IP blocks.
- Unhandled internal errors.
- Request aborts.

Sensitive values such as cookies, authorization headers, passwords, and tokens
are redacted.

## Performance

- Redis keeps rate-limit counters off the Node.js heap.
- Compression is enabled globally, but static assets should normally be served
  from a CDN or reverse proxy.
- Slow-down is applied after burst/public rate limits to reduce CPU cost.
- Small JSON limits reduce memory pressure.
- `passOnStoreError` keeps Redis outages from taking down the API, while logs
  preserve operational visibility.
