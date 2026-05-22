# AGENTS.md - VideoAI Project Control

This file is the operating contract for agents and developers working in this repository.

When a task changes product behavior, architecture, API contracts, database schema, AI workflow, frontend UX, admin behavior, security rules, or implementation logic described in `docs/`, update code and docs together in the same change.

## 1. Core Rule

Docs and code must stay synchronized.

- Treat `docs/` as the project source of truth for requirements, architecture, UX, service boundaries, API contracts, AI workflows, and future implementation direction.
- If the user updates docs first, read this file and the relevant docs before implementing.
- If code changes make any doc inaccurate, update the related doc in the same task.
- If code and docs conflict, stop and resolve the conflict by checking the newest user request and the most relevant docs.
- If the intended behavior is unclear after reading docs, ask concise clarifying questions before implementation.

## 2. Required Reading by Task Type

Always start with the smallest relevant set.

For product/user-flow changes:

- `docs/user-story.md`
- `docs/user-stories/user-flows.md`
- `docs/user-stories/functional-requirements.md`

For backend, architecture, database, API, microservice, queue, storage, or AI workflow changes:

- `docs/tsd/README.md`
- `docs/tsd/01-technology-recommendation.md`
- `docs/tsd/02-system-architecture.md`
- `docs/tsd/03-service-boundaries.md`
- `docs/tsd/04-data-model.md`
- `docs/tsd/05-api-contract.md`
- `docs/tsd/06-ai-media-workflows.md`
- `docs/tsd/07-security-observability.md`
- `docs/tsd/08-design-patterns.md`

For frontend and dashboard changes:

- `docs/frontend/README.md`
- `docs/frontend/technology-stack.md`
- `docs/frontend/design-system.md`
- `docs/frontend/dashboard-ux-guidelines.md`
- `docs/frontend/component-inventory.md`
- `docs/frontend/implementation-guidelines.md`
- `docs/tsd/09-frontend-ui-architecture.md`
- `docs/skills/videoai-frontend-dashboard/SKILL.md`

For admin AI config:

- `docs/admin/ai-model-config.md`
- `docs/tsd/05-api-contract.md`
- `docs/tsd/07-security-observability.md`

For AI request/response logging:

- `docs/admin/ai-log-tracking.md`
- `docs/tsd/06-ai-media-workflows.md`
- `docs/tsd/07-security-observability.md`

For upload/reference media behavior:

- `docs/media/reference-media-upload.md`
- `docs/tsd/06-ai-media-workflows.md`
- `docs/frontend/dashboard-ux-guidelines.md`

For new agent, skill, hook, FSD, or TSD documents:

- `docs/agents/README.md`
- `docs/skills/README.md`
- `docs/hooks/README.md`
- `docs/fsd/README.md`
- `docs/tsd/README.md`

## 3. Architecture Decisions

Follow the accepted TSD unless the user explicitly changes it.

- Frontend: Next.js App Router, TypeScript, Auth.js.
- Frontend UI: Tailwind CSS, shadcn/ui, Radix UI, Lucide React.
- Frontend state/forms: TanStack Query, TanStack Table, React Hook Form, Zod.
- Charts/animation: Recharts and Motion, used conservatively.
- Backend: NestJS microservices from the first implementation phase.
- Database: PostgreSQL with Prisma.
- Initial database strategy: one PostgreSQL cluster with service-owned schemas.
- Queue/runtime: Redis plus BullMQ.
- Storage: `StorageProvider` abstraction, local storage for the current phase.
- API: REST/OpenAPI via NestJS API Gateway.
- Long-running work: asynchronous jobs for AI, media analysis, product analysis, script generation, and video generation.

Do not replace these choices casually. If a task requires changing them, update the relevant TSD and ADR.

## 4. Service Boundary Rules

Respect service ownership.

- `web`: Next.js UI, Auth.js session UX, frontend route structure.
- `api-gateway`: public REST API, validation, RBAC, OpenAPI, request orchestration.
- `user-service`: app profile, roles, user status.
- `project-service`: projects, project ownership, project access checks.
- `media-service`: file metadata, validation, storage provider calls.
- `ai-config-service`: site-wide AI config, provider/model config, encrypted API keys.
- `ai-orchestrator-service`: prompt generation, product analysis, media analysis, script workflow orchestration.
- `video-service`: video generation records, status, output metadata.
- `ai-log-service`: AI request/response logs and admin log query APIs.
- `worker-ai`: async AI provider calls.
- `worker-video`: async video provider calls.

Rules:

- A service must not write another service's tables.
- Cross-service writes must be commands/jobs, not direct database access.
- Shared packages must stay thin: DTOs, contracts, errors, logger, auth helpers, storage/provider interfaces.
- Business logic belongs in the owning service, not in shared packages or frontend components.

## 5. Docs Sync Matrix

Update these docs when related code changes:

| Code/behavior change | Required docs to check/update |
| --- | --- |
| User flow, role behavior, project workflow | `docs/user-stories/*`, `docs/user-story.md` |
| Backend service boundary | `docs/tsd/02-system-architecture.md`, `docs/tsd/03-service-boundaries.md` |
| API endpoint, request/response, error code | `docs/tsd/05-api-contract.md` |
| Database table, field, index, migration | `docs/tsd/04-data-model.md` |
| AI workflow, provider flow, retry, idempotency | `docs/tsd/06-ai-media-workflows.md` |
| Auth, RBAC, secret, log redaction, observability | `docs/tsd/07-security-observability.md` |
| Design pattern or cross-service process | `docs/tsd/08-design-patterns.md` |
| Frontend routes, UI architecture, dashboard UX | `docs/frontend/*`, `docs/tsd/09-frontend-ui-architecture.md` |
| Admin AI config behavior | `docs/admin/ai-model-config.md` |
| AI request/response log behavior | `docs/admin/ai-log-tracking.md` |
| Media upload validation/preview/limits | `docs/media/reference-media-upload.md` |
| Architecture decision change | `docs/tsd/adr/*` |
| Agent/skill/hook workflow | `docs/agents/*`, `docs/skills/*`, `docs/hooks/*` |

If no docs require changes, mention that in the final response.

## 6. Frontend Standards

Build the authenticated app as a modern SaaS dashboard, not a marketing page.

- Use shadcn/ui and Radix primitives before creating custom controls.
- Use Lucide React icons for common actions.
- Keep UI dense enough for repeated work, but not crowded.
- Use stable dimensions for upload previews, tables, toolbars, counters, and job progress.
- Include loading, empty, error, disabled, pending, success, and failed states where relevant.
- User dashboard must prioritize project creation, recent projects, active jobs, and generation workflows.
- Admin dashboard must prioritize AI config, provider/model settings, secret status, AI logs, filters, and detail drawers.
- Never show a plain API key after save. Show masked/configured status only.
- For substantial UI work, run the app and verify desktop/mobile screenshots with Playwright or the in-app browser when possible.

## 7. Backend Standards

- Use NestJS modules, controllers, services, guards, interceptors, DTOs, and providers consistently.
- Validate all external inputs with DTO/schema validation.
- Use Prisma only inside service-owned persistence layers.
- Use BullMQ for long-running or retryable work.
- Return `jobId` for async operations.
- Use idempotency keys for user-triggered AI/video operations.
- Use structured errors with stable error codes.
- Keep provider SDK calls behind adapters.
- Keep storage behind `StorageProvider`.

## 8. AI and Logging Standards

- Never call AI providers directly from the browser.
- Read active AI config before provider calls.
- Create an AI request log before submitting to a provider.
- Update the same log with response or error after provider completion.
- Never log API keys, access tokens, refresh tokens, cookies, or raw binary media.
- Log media references as metadata, not file bytes.
- Record provider, model, flow type, status, latency, token usage, and cost estimate when available.

## 9. Security Standards

- Auth is handled by Auth.js in the Next.js app.
- Use RBAC for `user` and `admin`.
- User can only access their own projects and media unless docs define a new admin policy.
- Admin-only APIs must be guarded.
- Provider API keys must be encrypted at rest and never returned as plain text.
- Uploads must validate MIME type, extension, size, duration, and ownership.
- Redact sensitive values in logs, API responses, screenshots, and docs examples.

## 10. Implementation Workflow

For every non-trivial task:

1. Read this file.
2. Read the relevant docs from section 2.
3. Inspect existing code before editing.
4. Identify the owning service/module/component.
5. Make the smallest coherent change.
6. Update related docs if behavior, contracts, architecture, schema, or UX changed.
7. Run relevant verification commands.
8. Report what changed, what docs were updated, and what was or was not verified.

Prefer thin vertical slices:

- Route/API contract.
- Owning service logic.
- Persistence or queue.
- UI state.
- Tests/verification.
- Docs sync.

Avoid broad refactors unless the task requires them.

## 10.1 No Fallbacks Without Explicit Approval

Do not add fallback behavior by default.

- If required runtime data, config, provider keys, prompts, database records, request fields, uploaded media, or API responses are missing, fail clearly with a structured, user-readable error instead of silently substituting another value.
- Do not use mock, fake, sample, synthetic, legacy, built-in, environment, hardcoded, or guessed data as a fallback unless the user explicitly requested it or you proposed the fallback and the user accepted it.
- Do not hide provider/API failures by returning local/generated substitute results.
- Do not add default provider/model/key/prompt/env URL behavior as a convenience unless it is explicitly part of the accepted requirement.
- Compatibility fallback for migrations must be treated as temporary product behavior: document it, keep it narrowly scoped, expose clear status, and remove it when the migration is complete.
- For existing fallback behavior, do not expand it. Prefer replacing it with validation, explicit configuration, or a clear missing-configuration error.
- When you believe a fallback is necessary for safety, backward compatibility, or developer setup, explain the exact fallback, why it is needed, and wait for user approval before implementing it.

## 11. Verification Expectations

Run the strongest available checks for the touched area.

Frontend:

- Typecheck.
- Lint.
- Unit/component tests if present.
- Playwright or browser screenshot for visual changes when the app can run.

Backend:

- Typecheck.
- Lint.
- Unit tests.
- Integration tests for API/service/queue behavior when present.

Database:

- Prisma generate.
- Migration validation.
- Tests around repository/service behavior when present.

Docs-only changes:

- Check markdown links when practical.
- No app tests are required unless docs generation tooling exists.

If a command cannot run, explain why in the final response.

## 12. Git and Change Safety

- Do not revert user changes unless explicitly asked.
- Do not use destructive git commands.
- Keep unrelated changes out of the task.
- If the worktree is dirty, work around unrelated files.
- Use focused commits/branches only when the user asks for git actions.

## 13. Communication Rules

- Ask clarifying questions when requirements are ambiguous or when docs conflict.
- Keep progress updates short and concrete.
- In final responses, list changed files, verification performed, and any remaining risk.
- If docs were intentionally not updated, say why.

## 14. Vibe Coding Best Practices

Move quickly, but keep the system coherent.

- Let docs guide implementation.
- Keep changes small enough to review.
- Prefer working software over speculative abstractions.
- Add abstractions only where docs or repeated code justify them.
- Preserve future extensibility through boundaries, adapters, contracts, and tests.
- Keep UI polished enough that users can trust AI/video workflows.
- Keep admin/debug surfaces practical, searchable, and safe.
