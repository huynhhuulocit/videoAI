# 07 - Security and Observability

## 1. Authentication

Use Auth.js in the Next.js app.

Initial auth methods:

- Credentials provider for seeded demo users:
  - `user` / `User@123`
  - `admin` / `Admin@123`
- Password hashes stored securely, never plain text.
- Current local implementation reads these credentials from PostgreSQL `users.user_profiles`; credentials are not hardcoded in the Auth.js provider.

Recommended password hashing:

- Argon2id if available.
- Bcrypt as fallback.

Session handling:

- Auth.js owns browser session cookies.
- Next.js server layer validates session with Auth.js.
- Calls from Next.js to API Gateway include an internal signed token containing user ID, role and expiry.

Optional site gate:

- A lightweight site-wide gate can be enabled with `SITE_GATE_ENABLED=true`.
- The site gate is an outer customer-sharing layer before Auth.js, not a replacement for user/admin login.
- Site gate credentials are configured through environment variables and must not be committed.
- Successful site gate login sets an HTTP-only signed cookie so customers do not re-enter the gate password on every page refresh.

## 2. Authorization

Use RBAC at API Gateway and service level.

Roles:

- `user`
- `admin`

Rules:

- User can only access their own projects and media.
- Admin can access admin dashboard, AI config and AI logs.
- Admin does not create videos from admin dashboard unless a future user story adds this behavior.

Implementation:

- NestJS guards for route-level checks.
- Policy functions for resource ownership checks.
- Service-level checks before writing or reading sensitive records.

## 3. Secret Management

Provider API keys:

- Stored encrypted at rest.
- Never returned to client after save.
- Masked in UI.
- Redacted from logs.
- Rotatable by admin.

Current phase:

- Use an application encryption key from environment variables.
- The local vertical slice encrypts provider keys with an application-derived key from `AI_CONFIG_ENCRYPTION_KEY`, returns only key status and never returns plain key material.
- Provider execution resolves secrets in this order: encrypted saved key, then provider-specific environment fallback. Admin test connection may test an unsaved key supplied in the request body, but that key is not persisted unless the admin explicitly saves it.

Future phase:

- Use cloud KMS or a managed secret store.

## 4. Upload Security

Rules:

- Validate MIME type and file extension.
- Enforce file size and duration limits.
- Store files outside public source directories.
- Serve previews through controlled URLs.
- Do not pass raw local paths to clients.
- Scan files for malware in production phase if public uploads are enabled.

Local storage:

- Use a dedicated storage root, for example `storage/uploads`.
- Store generated previews under controlled paths.
- Store only metadata in PostgreSQL.
- Current local implementation persists upload metadata, validation status and preview route references in PostgreSQL, while binary files remain in the local storage provider.

## 5. AI Log Security

AI logs must support debugging without leaking secrets.

Required redaction:

- API keys.
- Auth tokens.
- Cookies.
- Raw binary media.
- Sensitive headers.

Access:

- Admin-only.
- All log detail views should be audited.

Retention:

- Default 90 days for AI request/response logs.
- Configurable later by admin setting.

## 6. Observability

Required signals:

- Structured logs.
- Request IDs.
- Job IDs.
- AI provider latency.
- Queue wait time.
- Job success/failure rate.
- Upload failures.
- API error rates.

Recommended stack:

- Pino for structured Node.js logs.
- OpenTelemetry for traces.
- Prometheus-compatible metrics.
- Grafana-compatible dashboards.

Minimum local phase:

- Console structured logs with `requestId`, `userId`, `projectId`, `service`, `operation` and `jobId`.
- Job status and AI request/response records must be queryable from PostgreSQL through admin/API routes.

## 7. Audit Logging

Audit events:

- Admin changes AI config.
- Admin creates, updates, archives or changes default status for a master prompt.
- Admin creates/rotates/deletes provider key.
- Admin views AI log detail.
- User creates project.
- User deletes media.
- User starts script generation.
- User starts video generation.

Audit fields:

- `actorUserId`
- `actorRole`
- `action`
- `resourceType`
- `resourceId`
- `requestId`
- `timestamp`
- `metadata`

## 8. Rate Limiting

Apply rate limits at API Gateway:

- Login attempts.
- Media uploads.
- Prompt generation.
- Product analysis.
- Video generation.

Use Redis-backed rate limiting so limits are consistent across gateway instances.

## 9. Local Tunnel Sharing

For short customer tests from a developer machine, the Cloudflare Tunnel guide lives in `deploy/cloudflare-tunnel/README.md`.

Rules:

- Use a fixed named Cloudflare Tunnel hostname.
- Put Cloudflare Access in front of the hostname.
- Allow only explicit customer/admin email addresses, preferably through One-Time PIN for guests.
- Do not use Access policies that include `Everyone` or unrestricted One-Time PIN login.
- Keep the app-level site gate enabled for tunnel sharing as an additional defense layer.
- Do not open inbound public access to local ports `3000`, `4000`, PostgreSQL or Redis.
- Route `/api/*` through the tunnel to the local API Gateway and route all other paths to the local web app.

## 10. Failure Handling

User-facing failures:

- Use stable error codes.
- Show clear messages.
- Allow retry for transient AI/media failures.

Internal handling:

- Retry transient provider failures.
- Open circuit for repeatedly failing providers.
- Record failed provider calls in AI logs.
- Alert on repeated video generation failures.
