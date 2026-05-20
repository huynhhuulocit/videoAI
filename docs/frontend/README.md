# Frontend and Dashboard Documentation - VideoAI

This folder defines the frontend technology choices, dashboard UX direction, design system rules and implementation guidelines for VideoAI.

The frontend should feel like a modern AI productivity dashboard: clean, fast, focused and polished. It should not look like a marketing landing page once the user is inside the application.

## Documents

- [Technology Stack](./technology-stack.md)
- [Design System](./design-system.md)
- [Dashboard UX Guidelines](./dashboard-ux-guidelines.md)
- [Component Inventory](./component-inventory.md)
- [Implementation Guidelines](./implementation-guidelines.md)
- [Project-local Frontend Skill](../skills/videoai-frontend-dashboard/SKILL.md)

## Primary Recommendation

Use:

- Next.js App Router
- TypeScript
- Auth.js
- Tailwind CSS
- shadcn/ui
- Radix UI
- TanStack Query
- TanStack Table
- React Hook Form
- Zod
- Recharts
- Motion
- Lucide React
- Playwright for UI verification

## Product UI Direction

VideoAI has two main UI surfaces:

- User dashboard: project creation, prompt/script generation, reference media upload, product URL analysis and video generation status.
- Admin dashboard: site configuration, AI provider/model settings, API key status and AI request/response logs.

The UI should prioritize repeated work, clarity and trust:

- Clear hierarchy.
- Fast access to primary actions.
- Strong loading/error/empty states.
- Preview-first media upload.
- Audit-friendly admin screens.
- Accessible keyboard and screen-reader behavior.
