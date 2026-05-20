# 03 - Service Boundaries

## 1. Boundary Principles

- A service owns its write model.
- A service does not write another service's tables.
- Cross-service reads should go through APIs or replicated read models.
- Long-running AI/video work must be queued.
- Service boundaries should follow business capabilities, not technical layers.

## 2. Services

### 2.1. Web App

Type: Next.js application.

Owns:

- Pages and layouts.
- Auth.js configuration.
- Session UX.
- Client upload and preview flows.

Does not own:

- Project persistence.
- AI provider calls.
- Video generation.
- AI logs.

### 2.2. API Gateway

Type: NestJS application.

Owns:

- Public API routes.
- Request validation.
- Auth and RBAC enforcement.
- OpenAPI docs.
- Request correlation ID.
- Response envelope.

Does not own:

- Domain persistence.
- Provider secrets.
- Long-running workers.

### 2.3. User Service

Owns:

- User profile.
- Role metadata.
- Admin/user authorization data exposed to backend services.

Notes:

- Auth.js owns authentication sessions and auth adapter tables.
- User Service owns application-level user profile and role metadata.

### 2.4. Project Service

Owns:

- Project records.
- Project ownership.
- Project listing.
- Project access checks.

Main invariants:

- A project belongs to one user.
- A user can only access their own projects unless an admin policy allows otherwise.

### 2.5. Media Service

Owns:

- Media metadata.
- File validation rules.
- Storage provider calls.
- Media deletion.
- Preview metadata.

Does not own:

- AI media interpretation.

### 2.6. AI Config Service

Owns:

- Site-wide content mode: `script` or `video`.
- Default prompt provider/model.
- Video provider/model.
- Encrypted API keys.
- Config audit log.

Main invariants:

- Config applies to the whole site.
- API keys are never returned as plain text.
- API keys are never written to AI request/response logs.

### 2.7. AI Orchestrator Service

Owns:

- Prompt generation workflow.
- Product URL analysis workflow.
- Media analysis workflow.
- Script generation workflow.
- Job creation for AI tasks.
- Selecting provider/model using AI Config Service.

Does not own:

- Provider key storage.
- Raw uploaded files.
- Final video artifacts.

### 2.8. Video Service

Owns:

- Video generation requests.
- Video records.
- Video status.
- Video artifact metadata.
- Job creation for video generation.

### 2.9. AI Log Service

Owns:

- AI request log records.
- AI response log records.
- Admin query APIs for logs.
- Log redaction policy.

Main invariants:

- Every provider request should create a log before submission.
- Every provider response or error should update the same log.
- Secrets and raw binary media are not logged.

## 3. Shared Packages

Keep shared packages small:

- `contracts`: DTOs, event types and enum definitions.
- `errors`: common error envelope and typed error codes.
- `logger`: structured logging helper.
- `auth`: service token verification and role helpers.
- `storage`: `StorageProvider` interface and implementations.
- `ai-providers`: provider interfaces and adapters.

Do not put service business logic into shared packages.

## 4. Boundary Rules for Future Changes

- New provider integration goes into an adapter under `ai-providers`, not into controllers.
- New storage backend implements `StorageProvider`.
- New AI workflow starts in AI Orchestrator and emits a job.
- New admin setting belongs to AI Config Service unless it is unrelated to AI/site behavior.
- New user-facing project feature belongs to Project Service unless it is media, AI or video specific.

## 5. Current Local Vertical Slice

The current implementation is allowed to keep direct Prisma calls in the API Gateway only as a temporary local vertical slice.

Rules for this slice:

- Data must still be stored in the service-owned PostgreSQL schemas listed in the TSD.
- Controllers must not use source-code sample arrays or process-local stores for authoritative state.
- New persistence code should be easy to move into the owning service without changing the public API contract.
- When a service process is implemented, move the corresponding Prisma calls out of the gateway and keep the same API response shape.
