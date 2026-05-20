---
name: videoai-frontend-dashboard
description: Build modern, accessible VideoAI frontend and dashboard screens using Next.js App Router, shadcn/ui, Tailwind CSS, Radix UI, TanStack Query/Table, React Hook Form, Zod, Recharts, Motion, Lucide icons, and Playwright verification. Use when implementing or reviewing VideoAI user dashboards, admin dashboards, prompt/product workflows, media upload UI, AI job progress, AI config screens, or AI request/response log UI.
---

# VideoAI Frontend Dashboard

## Overview

Use this skill to build or review VideoAI frontend work with a consistent modern dashboard experience. Keep the UI clean, accessible, workflow-oriented, and aligned with the project docs.

## Required Context

Before implementing UI, read the smallest relevant set:

- Core frontend guidance: `docs/frontend/README.md`, `docs/frontend/design-system.md`, `docs/frontend/dashboard-ux-guidelines.md`.
- Component planning: `docs/frontend/component-inventory.md`, `docs/frontend/implementation-guidelines.md`.
- API integration: `docs/tsd/05-api-contract.md`, `docs/tsd/09-frontend-ui-architecture.md`.
- User flows: `docs/user-stories/user-flows.md`, `docs/user-stories/functional-requirements.md`.
- Media upload work: `docs/media/reference-media-upload.md`.
- Admin AI work: `docs/admin/ai-model-config.md`, `docs/admin/ai-log-tracking.md`.

For screen-level layout patterns, read `references/ui-patterns.md`.

## Implementation Workflow

1. Identify the screen type: user dashboard, project workspace, script flow, product flow, media upload, admin config, or admin logs.
2. Select the expected components from `docs/frontend/component-inventory.md`.
3. Build with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Radix primitives, Lucide icons, TanStack Query/Table, React Hook Form, Zod, Recharts, and Motion only where useful.
4. Keep the app surface dashboard-first: no marketing hero inside authenticated user/admin routes.
5. Implement loading, empty, error, disabled, uploading, processing, succeeded, and failed states where the workflow can reach them.
6. Keep API calls in typed clients, route handlers, server functions, or feature hooks; do not put provider calls or domain logic in visual components.
7. Verify desktop and mobile behavior. For substantial UI changes, run the app and capture browser screenshots.

## Product UI Rules

- Use a modern SaaS dashboard style: clean, calm, dense enough for work, and visually polished.
- Use cards for repeated items, metrics, dialogs, and framed tools only. Do not nest cards inside cards.
- Use icon buttons for common actions when a clear Lucide icon exists; add labels/tooltips for accessibility.
- Use stable dimensions for media previews, tables, toolbars, counters, and job progress UI.
- Keep prompt and product workflows reviewable: user must clearly see the final prompt/script before creating a script or video.
- Keep admin screens audit-friendly: tables, filters, drawers, status badges, redacted payloads, and copyable request IDs.
- Never display API keys after save. Show masked or configured status only.
- Keep text readable and inside its containers at desktop and mobile sizes.

## Verification Checklist

Before finalizing UI work:

- Run typecheck/lint/tests when available.
- Verify role-specific navigation for user and admin routes.
- Verify form validation and error rendering.
- Verify upload preview, deletion, and invalid-file states when media is involved.
- Verify job polling and terminal statuses when generation is involved.
- Verify admin log filters and detail drawer when log UI is involved.
- Use Playwright or the in-app browser for screenshots on desktop and mobile if a runnable app exists.

## References

- `references/ui-patterns.md`: screen archetypes, component choices, and state checklist.
