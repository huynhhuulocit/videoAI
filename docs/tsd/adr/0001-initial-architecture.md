# ADR 0001 - Initial Architecture

## Status

Accepted

## Context

VideoAI needs:

- User and admin dashboards.
- Authenticated user flows.
- Role-protected admin pages.
- Project creation.
- Prompt/script generation.
- Product URL analysis.
- Image/video reference upload.
- AI provider model configuration.
- Video generation through providers such as Veo or Gemini.
- Request/response logging for AI calls.
- Future extension for FSD, TSD, agents, skills and hooks.

The project owner selected:

- Next.js and NestJS.
- Microservices from the first implementation phase.
- Auth.js.
- Local storage now, with storage abstraction for future backends.
- English TSD documentation.

## Decision

Implement VideoAI as a TypeScript microservice system:

- `web`: Next.js App Router with Auth.js.
- `api-gateway`: NestJS public API gateway.
- Domain services for user, project, media, AI config, AI orchestration, video and AI logs.
- Worker services for AI and video jobs.
- PostgreSQL as primary database.
- Prisma as ORM and migration tool.
- Redis plus BullMQ for queues and job processing.
- Storage abstraction with local storage implementation first.

## Consequences

Positive:

- Clear service ownership from the start.
- Long-running AI/video tasks do not block HTTP requests.
- AI providers and storage backends can be swapped through adapters.
- Admin AI config can apply globally without redeploy.
- Request/response logs are first-class rather than an afterthought.

Tradeoffs:

- More operational overhead than a modular monolith.
- Local development requires multiple services and shared infrastructure.
- Cross-service transactions must be avoided or handled with process managers/outbox.
- Good contracts and testing are required to prevent service drift.

## Rejected Alternatives

### Modular Monolith

Rejected because the project owner explicitly selected microservices from the first implementation phase.

### Single Next.js Full-Stack App

Rejected because AI/video jobs, admin logging, provider abstraction and service boundaries would become harder to scale and secure.

### Kafka From Day One

Rejected for initial phase because Redis plus BullMQ is enough for job execution and simpler to operate. Kafka or NATS can be introduced later for high-volume durable domain events.

### Direct Browser Calls to AI Providers

Rejected because it would expose secrets, bypass admin config and make request/response logging unreliable.
