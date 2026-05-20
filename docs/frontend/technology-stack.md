# Frontend Technology Stack

## 1. Recommended Stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Framework | Next.js App Router | Application routing, server rendering, layouts and BFF surface |
| Language | TypeScript | Type safety across UI, API clients and shared contracts |
| Auth | Auth.js | Login, logout, session handling and protected routes |
| Styling | Tailwind CSS | Utility-first styling and design tokens |
| UI Components | shadcn/ui | Modern copy-owned component system |
| UI Primitives | Radix UI | Accessible dialogs, menus, selects, tabs and focus behavior |
| Icons | Lucide React | Consistent icon set for actions and navigation |
| Server State | TanStack Query | API fetching, mutations, caching, polling and job status |
| Tables | TanStack Table | Project tables, AI log tables and admin filtering |
| Forms | React Hook Form | Performant form state for login, project, prompt and admin forms |
| Validation | Zod | Runtime validation and typed schema inference |
| Charts | Recharts | Dashboard charts and usage/status summaries |
| Animation | Motion | Subtle transitions and interaction polish |
| Testing | Playwright | Browser verification, screenshots and visual checks |
| Component Workshop | Storybook | Optional component isolation and UI documentation |

## 2. Why This Stack Fits VideoAI

VideoAI needs authenticated dashboards, upload preview, long-running AI/video jobs and admin data tables. The stack above supports these needs without introducing a heavy enterprise UI framework.

Key reasons:

- shadcn/ui keeps components in the codebase, so the product can customize UI without waiting for a vendor.
- Radix UI provides accessible behavior for complex controls such as Dialog, Select, Tabs, Tooltip and Dropdown Menu.
- Tailwind CSS makes it easy to keep spacing, color, typography and responsive rules consistent.
- TanStack Query is well suited for job polling and server-state changes after `Generate`, `Analyze Product` and `Create Video`.
- TanStack Table is a strong fit for admin logs because filtering, sorting, pagination and column visibility will matter.
- React Hook Form and Zod keep form-heavy screens predictable.

## 3. Next.js Usage

Use App Router with route groups:

```text
app/
  (public)/
    page.tsx
    login/
  (user)/
    dashboard/
    projects/
  (admin)/
    admin/
      ai-config/
      ai-logs/
```

Guidelines:

- Use Server Components for initial page data when the data is stable and can be fetched server-side.
- Use Client Components for upload, preview, forms, filters, polling and interactive editors.
- Keep Auth.js logic in the web app.
- Call the NestJS API Gateway from server-side code or typed API clients.
- Do not call AI providers from the browser.

## 4. UI Library Choice

Use shadcn/ui as the main component source.

Recommended components:

- Sidebar
- Button
- Dialog
- Sheet
- Drawer
- Form
- Input
- Textarea
- Select
- Tabs
- Switch
- Data Table
- Chart
- Badge
- Progress
- Skeleton
- Sonner
- Tooltip
- Dropdown Menu
- Breadcrumb

Use Radix UI directly only when shadcn/ui does not expose the needed primitive.

## 5. State Management

Use three state categories:

- Server state: TanStack Query.
- Form state: React Hook Form.
- Local UI state: React `useState` or small colocated reducers.

Avoid a global client-state store unless a future feature clearly needs shared state across unrelated route segments.

Good TanStack Query use cases:

- List projects.
- Fetch project detail.
- Poll job status.
- Fetch AI log table.
- Submit generation mutations.
- Refresh admin config after save.

## 6. Charts and Analytics

Use Recharts for:

- Jobs by status.
- AI requests by provider/model.
- Average latency.
- Video generation success/failure rate.
- Upload volume.

Keep charts compact and dashboard-oriented. Charts should support scanning, not decorative storytelling.

## 7. Animation

Use Motion only for small interaction details:

- Dialog/sheet entry.
- Upload preview add/remove.
- Progress transitions.
- Empty state transitions.
- Row detail drawer transitions.

Avoid heavy page animations in admin and workflow screens.

## 8. Verification

Use Playwright for:

- Login flow.
- User dashboard flow.
- Admin dashboard access control.
- Upload preview behavior.
- Prompt generation state transitions.
- AI log table filters.
- Responsive screenshots for desktop and mobile.

Visual checks should verify that text does not overflow, tables remain usable, media previews are visible and primary actions are clear.
