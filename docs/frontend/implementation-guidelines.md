# Frontend Implementation Guidelines

## 1. Architecture

Recommended app structure:

```text
apps/web/
  app/
    (public)/
    (user)/
    (admin)/
    api/auth/[...nextauth]/
  components/
    ui/
    shell/
    project/
    ai/
    media/
    admin/
    feedback/
  features/
    projects/
    prompt-generation/
    product-analysis/
    video-generation/
    admin-ai-config/
    admin-ai-logs/
  lib/
    auth/
    api/
    query/
    validation/
    formatters/
```

## 2. Data Fetching

Use:

- Server Components for initial data when it improves page load.
- TanStack Query for interactive client data, mutations and polling.
- Typed API clients for NestJS API Gateway calls.

Guidelines:

- Query keys must include resource ID and filter state.
- Mutations should invalidate only related queries.
- Long-running jobs should return `jobId`.
- Poll job status until terminal status: `succeeded`, `failed` or `cancelled`.

## 3. Forms

Use React Hook Form with Zod.

Forms:

- Login form.
- Create project form with required `Scenario` or `Product Flow` selection.
- Prompt/script input form.
- Product URL form.
- Admin AI config form.
- Provider key form.
- AI log filter form.

Guidelines:

- Validate on submit by default.
- Show field-level errors.
- Disable submit while mutation is pending.
- Preserve user-entered prompt text after failed generation.

## 4. Uploads

Use a dedicated upload feature module.

Guidelines:

- Validate file type and size on the client before upload.
- Treat client validation as UX only; backend validation remains authoritative.
- Show upload progress per file.
- Show preview immediately when safe.
- Allow removing files before AI analysis.
- Do not send invalid files to AI workflows.

## 5. Job Progress

Every long-running action needs:

- Queued state.
- Processing state.
- Success state.
- Failure state.
- Retry action when safe.

Long-running actions:

- Generate prompt.
- Analyze product.
- Analyze media.
- Create script.
- Create video.

## 6. Admin Screens

Admin screens should be information-dense and audit-friendly.

Guidelines:

- Use tables for logs.
- Use filters above the table.
- Use drawers for detail inspection.
- Never display raw API keys.
- Make redaction visible where payload values are masked.

## 7. Accessibility

Rules:

- Use semantic buttons and forms.
- Do not replace buttons with clickable `div` elements.
- Add `aria-label` to icon-only buttons.
- Keep focus visible.
- Ensure dialog/sheet close buttons are keyboard reachable.
- Provide text alternatives for media previews where possible.

## 7.1. Localization

Guidelines:

- Use one shared English frontend dictionary for UI labels and helper text.
- Do not render a language switch in public or authenticated navigation.
- Do not store locale selection in browser storage.
- Do not translate user-entered project data or AI-generated output automatically.
- New product UI copy should be added to the English dictionary.

## 7.2. Button Variants

Use semantic variants consistently:

- `primary`: blue filled for main actions such as Create, Save, Generate and Analyze.
- `secondary`: white/outline for supporting actions such as Edit, Set default, Prompt, Request, Response and Back.
- `destructive`: red filled for explicit delete/archive actions.
- `ghost`: neutral icon-only or low-emphasis controls.

## 8. Performance

Guidelines:

- Use route-level code splitting from Next.js naturally.
- Keep heavy JSON viewers in lazy-loaded client components.
- Avoid rendering large log payloads inside table rows.
- Use pagination for logs and projects.
- Use stable dimensions for previews and tables to avoid layout shift.

## 9. Visual Verification

Use Playwright for:

- Desktop screenshot.
- Mobile screenshot.
- Login happy path.
- User project creation happy path.
- Script flow with uploaded image.
- Product flow with URL and uploaded media.
- Admin AI config save.
- Admin AI logs filtering and detail drawer.

Screenshots should verify:

- No overlapping text.
- No clipped primary actions.
- Upload previews render.
- Tables remain readable.
- Empty/loading/error states look intentional.

## 10. Definition of Done

Frontend work is done only when:

- Main happy path works.
- Loading, empty and error states exist.
- Forms have validation.
- Responsive desktop/mobile layouts are checked.
- Role-based navigation is respected.
- UI follows the design system.
- Relevant docs are updated when behavior or structure changes.
