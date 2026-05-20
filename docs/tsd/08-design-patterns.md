# 08 - Design Patterns

## 1. API Gateway Pattern

Use the NestJS API Gateway as the only public backend entrypoint.

Benefits:

- Centralized auth and RBAC.
- Stable API surface for the frontend.
- Service topology can change without changing browser clients.

## 2. Backend-for-Frontend Pattern

Use Next.js as a thin BFF only where it is useful for Auth.js and browser interaction.

Use cases:

- Auth.js routes.
- Session-aware server components.
- Client upload helper routes when needed.

Do not put core business logic in the BFF.

## 3. Hexagonal Architecture

Use ports and adapters for external dependencies:

- AI providers.
- Storage providers.
- Queue clients.
- Email/notification providers later.

Example ports:

- `PromptProvider`
- `VideoProvider`
- `StorageProvider`
- `JobQueue`

Benefits:

- Provider changes do not rewrite domain services.
- Local storage can be replaced with S3-compatible storage.
- Tests can use fake providers.

## 4. Strategy Pattern

Use strategy selection for provider/model behavior.

Examples:

- `GeminiPromptStrategy`
- `ChatGptPromptStrategy`
- `VeoVideoStrategy`
- `GeminiVideoStrategy`

The active strategy is selected from Admin AI Config.

## 5. Adapter Pattern

Use adapters around vendor SDKs and storage SDKs.

Examples:

- `GeminiClientAdapter`
- `OpenAiClientAdapter`
- `VeoClientAdapter`
- `LocalStorageAdapter`
- `S3StorageAdapter`

Adapters should normalize vendor-specific request/response shapes into internal DTOs.

## 6. CQRS-Lite

Use separate command and query handlers for complex modules without adding full CQRS infrastructure.

Commands:

- `CreateProjectCommand`
- `GeneratePromptCommand`
- `AnalyzeProductCommand`
- `CreateVideoCommand`
- `UpdateAiConfigCommand`

Queries:

- `ListProjectsQuery`
- `GetProjectDetailQuery`
- `GetJobStatusQuery`
- `SearchAiLogsQuery`

Benefits:

- Clear mutation flows.
- Easier validation.
- Easier future transition to read models.

## 7. Saga / Process Manager

Use a process manager for multi-step AI/video workflows.

Video generation example:

1. Validate project ownership.
2. Validate final prompt/script.
3. Read active AI config.
4. Create video generation record.
5. Enqueue provider job.
6. Create pending AI log.
7. Submit to provider.
8. Store output artifact.
9. Mark generation succeeded or failed.
10. Update AI response log.

Benefits:

- The workflow is explicit.
- Retries and compensation are easier to reason about.

## 8. Outbox Pattern

Use the outbox pattern when a service must persist data and emit a job/event atomically.

Recommended for:

- Creating video generation records and queueing video jobs.
- Creating prompt records and queueing prompt jobs.
- Updating config and emitting config changed event.

Initial phase:

- A local transaction writes domain record and outbox record.
- A small dispatcher publishes outbox records to BullMQ.

## 9. Idempotency Pattern

Use idempotency keys for user-triggered long-running operations.

Required for:

- Prompt generation.
- Product analysis.
- Script creation.
- Video generation.

Benefits:

- Avoids duplicate cost if user double-clicks.
- Allows safe retry after network failure.

## 10. Repository Pattern

Use repositories carefully.

Recommended:

- Use repositories for aggregate-specific persistence methods.
- Keep Prisma query complexity inside service-owned data access classes.

Avoid:

- Generic repositories that hide important Prisma capabilities.
- Sharing repositories across services.

## 11. Guard and Policy Pattern

Use NestJS guards for coarse route checks and policy functions for resource ownership.

Examples:

- `RequireAuthGuard`
- `RequireAdminGuard`
- `CanAccessProjectPolicy`
- `CanManageAiConfigPolicy`

## 12. Circuit Breaker Pattern

Use circuit breakers around AI/video provider calls.

Behavior:

- Track repeated transient failures.
- Temporarily block calls to a failing provider.
- Return a controlled error.
- Record failures in AI logs.

This protects user experience and provider cost during outages.
