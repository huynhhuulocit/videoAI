# 01 - Technology Recommendation

## 1. Executive Recommendation

Use a TypeScript-first microservice architecture:

- Frontend: Next.js App Router.
- Authentication: Auth.js in the Next.js web app.
- Backend: NestJS microservices.
- Database: PostgreSQL.
- ORM: Prisma.
- Queue and job processing: Redis plus BullMQ.
- Storage: abstract `StorageProvider`; use local storage now and keep S3/R2/MinIO compatible storage as the production path.
- API style: REST/OpenAPI for synchronous APIs; asynchronous jobs for AI generation, media analysis and video generation.

This stack keeps the first version practical while preserving clear service boundaries for future scale.

## 2. Frontend

Recommended stack:

- Next.js App Router.
- React Server Components for server-side data access where suitable.
- Client Components for interactive flows such as upload, preview, generation progress and admin forms.
- Auth.js for sign in, sign out, session handling and protected route checks.
- TanStack Query for client-side API cache, mutation state and polling job status.
- Zod for form and API response validation.
- Tailwind CSS for utility-first styling and design tokens.
- shadcn/ui for copy-owned modern application components.
- Radix UI for accessible primitives.
- TanStack Table for projects and AI request/response logs.
- React Hook Form for forms.
- Recharts for dashboard charts.
- Motion for subtle interaction transitions.
- Lucide React for icons.

Rationale:

- The product has authenticated dashboards, admin pages, upload UI and long-running job states.
- Next.js fits the dashboard and BFF needs without making the frontend own core business logic.
- Auth.js integrates naturally with Next.js and can use Prisma/PostgreSQL for persisted users and sessions.
- shadcn/ui and Radix provide a strong dashboard component baseline without locking the product into a heavy vendor framework.

Frontend responsibility:

- Render user and admin dashboards.
- Own Auth.js routes and session UX.
- Use thin route handlers only for auth/BFF needs.
- Call the NestJS API Gateway for product business operations.
- Never call AI providers directly from the browser.

## 3. Backend

Recommended stack:

- NestJS for API Gateway and microservices.
- TypeScript shared contracts for DTOs and events.
- Prisma per service for database access.
- BullMQ workers for long-running and retryable jobs.
- OpenAPI generated from the API Gateway.

Rationale:

- NestJS has first-class concepts for dependency injection, guards, interceptors, modules and microservices.
- The project needs multiple technical domains: project management, media upload, AI orchestration, admin config, logs and video jobs.
- Microservices from the start are acceptable if each service has a small, explicit responsibility and shared libraries are kept thin.

## 4. Database

Recommended stack:

- PostgreSQL as the primary transactional database.
- Prisma migrations for schema management.
- Separate PostgreSQL schemas per service in the first deployment.
- Move to database-per-service later only when operational scale requires it.

Rationale:

- PostgreSQL handles relational ownership well: users, projects, media, configs, logs and jobs.
- JSONB is useful for provider-specific AI payloads, token usage, cost metadata and flexible request/response logs.
- Separate schemas preserve microservice boundaries without the operational burden of many database clusters on day one.

## 5. Queue and Async Processing

Recommended stack:

- Redis for queue backing and short-lived cache.
- BullMQ for job queues and workers.

Use queues for:

- Media analysis.
- Product URL analysis.
- Prompt/script generation.
- Video generation.
- AI request/response log enrichment.

Rationale:

- AI and video generation are slow, failure-prone and often rate-limited.
- BullMQ supports job workers, retry, progress and delayed processing.
- Redis/BullMQ is simpler for phase one than Kafka/NATS while still compatible with a microservice design.

Future path:

- If service-to-service event volume grows, introduce NATS or Kafka for durable domain events.
- Keep BullMQ for task execution even if a separate event broker is added later.

## 6. Storage

Recommended stack:

- Implement `StorageProvider` as an application port.
- Local storage implementation for current development.
- S3-compatible implementation later for production.

Required abstraction:

- `putObject`
- `getObject`
- `deleteObject`
- `createReadUrl`
- `createWriteUrl`
- `getMetadata`

Rationale:

- The user story requires image and video uploads, previews, deletion and AI analysis.
- Local storage is enough for the current phase.
- Object storage should be swappable without changing business services.

## 7. API

Recommended API approach:

- Public client API through NestJS API Gateway.
- REST endpoints documented with OpenAPI.
- Internal service-to-service communication through HTTP for simple queries and BullMQ jobs/events for long-running commands.
- SSE or WebSocket from API Gateway for job progress if polling becomes inefficient.

Rationale:

- REST is sufficient and easy to test for dashboards.
- OpenAPI gives frontend/backend contract clarity.
- Async jobs avoid request timeouts and allow retries.

## 8. Microservice Recommendation

Start with these deployable services:

- `web`: Next.js frontend and Auth.js.
- `api-gateway`: external API, RBAC, validation and request orchestration.
- `user-service`: user profile, roles and admin/user metadata.
- `project-service`: projects and ownership.
- `media-service`: upload metadata, file validation and storage access.
- `ai-config-service`: site-wide AI provider/model/API key config.
- `ai-orchestrator-service`: prompt/script/product/media analysis orchestration.
- `video-service`: video generation jobs and video records.
- `ai-log-service`: AI request/response log storage and admin query APIs.
- `worker-ai`: queue workers for AI calls and analysis.
- `worker-video`: queue workers for video generation.

This is enough separation to respect the user's microservice requirement without over-fragmenting every CRUD feature.

## 9. Technologies Not Recommended Initially

- Kafka: useful later, but operationally heavier than needed for phase one.
- GraphQL: not necessary for the current dashboard workflows.
- Multiple physical databases from day one: increases local development and migration complexity.
- Direct browser-to-AI provider calls: exposes secrets and makes logging/auditing harder.
- Storing uploaded media in PostgreSQL: store metadata in PostgreSQL and binary files in storage.
