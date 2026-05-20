# Technical Specification Documents - VideoAI

This folder contains the initial Technical Specification Document set for VideoAI.

The current architecture decision is:

- Frontend: Next.js App Router with Auth.js.
- Backend: NestJS microservices from the first implementation phase.
- Database: PostgreSQL.
- ORM: Prisma, with service-owned schemas and migrations.
- Cache and queue runtime: Redis plus BullMQ.
- Storage: storage abstraction with local storage for the current phase.
- API style: REST/OpenAPI for synchronous client/backend APIs, queue-based jobs for long-running AI and video generation.

## Documents

- [01 - Technology Recommendation](./01-technology-recommendation.md)
- [02 - System Architecture](./02-system-architecture.md)
- [03 - Service Boundaries](./03-service-boundaries.md)
- [04 - Data Model](./04-data-model.md)
- [05 - API Contract](./05-api-contract.md)
- [06 - AI and Media Workflows](./06-ai-media-workflows.md)
- [07 - Security and Observability](./07-security-observability.md)
- [08 - Design Patterns](./08-design-patterns.md)
- [09 - Frontend UI Architecture](./09-frontend-ui-architecture.md)
- [ADR 0001 - Initial Architecture](./adr/0001-initial-architecture.md)

## Source Requirement Documents

- [User Story Overview](../user-story.md)
- [User Flows](../user-stories/user-flows.md)
- [Functional Requirements](../user-stories/functional-requirements.md)
- [Admin AI Model Config](../admin/ai-model-config.md)
- [AI Log Tracking](../admin/ai-log-tracking.md)
- [Reference Media Upload](../media/reference-media-upload.md)
- [Frontend and Dashboard Documentation](../frontend/README.md)

## External References

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [NestJS Microservices](https://docs.nestjs.com/microservices/basics)
- [Auth.js Installation](https://authjs.dev/getting-started/installation)
- [Auth.js Prisma Adapter](https://authjs.dev/getting-started/adapters/prisma)
- [Prisma ORM](https://www.prisma.io/docs/orm)
- [PostgreSQL JSON Types](https://www.postgresql.org/docs/current/datatype-json.html)
- [BullMQ Queues](https://docs.bullmq.io/guide/queues)
- [BullMQ Workers](https://docs.bullmq.io/guide/workers)
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/breakpoints)
- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [shadcn/ui Blocks](https://ui.shadcn.com/blocks)
- [Radix UI Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [TanStack Query](https://tanstack.com/query/)
- [TanStack Table](https://tanstack.com/table/latest/docs/guide/tables)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [Recharts](https://recharts.github.io/en-US/)
- [Motion for React](https://motion.dev/react)
