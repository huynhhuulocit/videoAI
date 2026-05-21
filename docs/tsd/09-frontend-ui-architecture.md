# 09 - Frontend UI Architecture

## 1. Purpose

This document connects the frontend UI direction to the broader VideoAI technical architecture.

Detailed UI guidance lives in:

- [Frontend Technology Stack](../frontend/technology-stack.md)
- [Design System](../frontend/design-system.md)
- [Dashboard UX Guidelines](../frontend/dashboard-ux-guidelines.md)
- [Component Inventory](../frontend/component-inventory.md)
- [Implementation Guidelines](../frontend/implementation-guidelines.md)

## 2. Architecture Position

The frontend is the user-facing layer of the VideoAI microservice system.

Responsibilities:

- Render public, user and admin routes.
- Manage Auth.js session UX.
- Provide upload and preview interactions.
- Call the NestJS API Gateway through typed clients.
- Display asynchronous AI/video job progress.
- Provide admin configuration and observability screens.
- Provide a visible `Scripts` user route label backed by the compatibility `/shots` route for user-owned reusable shot plan creation and review.

Non-responsibilities:

- Direct AI provider calls.
- Secret handling beyond masked admin inputs.
- Domain persistence.
- Video generation execution.

## 3. Route Groups

Recommended route groups:

```text
app/
  (public)/
    page.tsx
    login/
  (user)/
    dashboard/
    projects/
    projects/new/
    projects/[projectId]/
    one-click/
    one-click/[projectId]/
    shots/
    shots/new/
    shots/[shotPlanId]/
    templates/
    templates/new/
    templates/[templateId]/
  (admin)/
    admin/
      ai-config/
      shot-prompt/   # visible label: Master Prompt
      ai-logs/
```

## 4. Feature Modules

Recommended feature modules:

- `projects`
- `prompt-generation`
- `product-analysis`
- `media-upload`
- `shot-media-upload`
- `template-builder`
- `video-generation`
- `admin-ai-config`
- `admin-master-prompt` (route compatibility redirect: `/admin/shot-prompt`; canonical child routes: `/admin/shot-prompt/story-content`, `/admin/shot-prompt/scenario`, `/admin/shot-prompt/shots`)
- `admin-ai-logs`

Each feature module should own:

- API hooks.
- Form schemas.
- Feature components.
- State mapping from API status to UI status.

`shot-media-upload` is a Script Flow UI concern: the upload control is rendered inside each shot card, stores validated media IDs in the shot JSON and feeds the local per-shot prompt composer. Product Flow continues to use project-level `media-upload`.

In the project workspace Script Flow, the main Script Flow card spans the full available workspace width so Step 1, Step 2 and Step 3 are not constrained to a half-width dashboard column. Step 1 is `Story Content`: it renders the admin-managed `Story Content` master prompt and the source textarea. The underlying master-prompt type key remains `scripts` for API/data compatibility. On open, Script Flow and One Click workspaces load the latest saved database Story Content into that textarea before the user edits it. Generated content replaces that textarea and becomes the source for later steps. Step 2 keeps the Scenario master prompt/action surface in the left main content column and renders scenario attributes/options in a desktop right-column `Attributes` panel. The `Attributes` panel is collapsed by default, widened for label/count readability, and individual attribute groups remain collapsible with selected-count badges. Attribute and option rows expose saved Scenario description metadata through compact helper icons that open on hover or click. AI action rows expose a `Prompt` button before adjacent `Request` and `Response` buttons; `Prompt` opens exactly the rendered provider prompt after placeholder replacement with no hidden runtime context appended, while `Request`/`Response` open read-only raw-data popups for the latest successful AI run.

Step 3 renders the active admin-managed `Shots` master prompt in an editable `TextareaWithCounter` before duration/generate controls. Changes are temporary workspace state and are sent as the optional `masterPrompt` request override for shot generation; the admin default remains unchanged. Step 3 always shows a `Shots result` JSON textarea directly below the generate action row. It is empty until a shot plan exists or the user pastes JSON; when populated, it is the normalized shot plan used to build the editable shot cards. Users can edit it and apply it back to the cards before saving. `Generate shots` renders inline success/error feedback directly below the JSON editor/action area, with AI provider/config/schema failures formatted as detailed multi-line messages using stable error codes and job metadata when available. Per-shot `Attributes` panels also sit in the same wider right column on desktop.

## 5. UI State Strategy

Use:

- Server Components for stable initial page data.
- TanStack Query for client-side server state.
- React Hook Form for form state.
- Local React state for small UI-only behavior.
- A small client-side language provider backed by a single English dictionary.

Do not introduce Redux/Zustand in the first phase unless a concrete cross-route client-state problem appears.

## 6. Dashboard Shells

Create separate shells:

- `PublicShell`
- `UserDashboardShell`
- `AdminDashboardShell`

Admin shell should include a persistent sidebar on desktop and sheet navigation on mobile.

User shell navigation includes:

- `/dashboard`
- `/projects`
- `/one-click`
- `/one-click/[projectId]`
- `/shots` with visible label `Scripts`
- `/shots/new`
- `/shots/[shotPlanId]`
- `/templates`
- `/templates/new`
- `/templates/[templateId]`

The `/projects` route lists active projects owned by the signed-in user, links to each project workspace at `/projects/[projectId]`, and exposes a compact delete/archive action per row. `/shots` and `/templates` are list-only routes; creation and editing are handled by their `/new` and dynamic detail routes. User shell should prioritize project context, active jobs and fast creation actions.

The `/one-click` route is a guided Script Flow shortcut, not a new backend project flow. It creates a normal `script` project from setup name/description, then `/one-click/[projectId]` renders `ProjectWorkspace` in One Click mode: Step 1 Story Content, Step 2 Scenario analysis using a scenario catalog without showing a `Choose scenario` dropdown, and Step 3 Shots master prompt plus editable shot generation. Step 2 also embeds the Scenario content editor pattern from `/templates/[templateId]` so the active scenario name, description, schema JSON and attributes/options can be reviewed or saved inline. One Click persists each step: Story Content is saved before Step 2, Scenario analysis writes `templateSelection` to the project and creates a Scenario named/described from setup, and Step 3 generates a project-linked shot plan named/described from setup without showing an existing shot-plan selector.

Scenario create/edit routes (`/templates/new` and `/templates/[templateId]`) render the active admin-managed `Scenario` master prompt above the video idea textarea. The prompt can be edited temporarily for that AI generation request, and provider failures must be displayed inline as detailed multi-line errors without falling back to sample scenario data. The AI generation row exposes `Prompt`, `Request` and `Response` buttons: `Prompt` opens the full rendered provider prompt, while `Request`/`Response` open the redacted raw provider payloads returned by the latest successful `/api/v1/templates/generate` call. Prompt and raw-data popups expose a header copy icon.

Scripts create/edit routes (`/shots/new` and `/shots/[shotPlanId]`) use the same AI debug action pattern for shot-generation. The generated full prompt is available before submission, and the latest job result raw request/response opens in read-only popups instead of inline collapsible panels.

Scenario create/edit routes store human-readable explanations directly in the main JSON-first schema. Each attribute and option can include `description`; options use `name` in JSON and the editor converts it to the internal processing label/value. `Parse schema` and `Save scenario` keep the visual description fields synchronized with the JSON textarea. Legacy `translate`, `label` and `value` fields remain parse-compatible for older scenarios, but the editor emits the shorter `id/name/description/options` format. The schema parser still accepts compact `attribute=option1,option2;` text for compatibility.

All public, user and admin pages should expose a visible back action. The back action may use browser history first, then fall back to the nearest safe route such as `/`, `/dashboard` or `/admin/ai-config`.

Public and authenticated shells use English-only UI copy and do not expose a language toggle. The frontend does not read or write locale browser storage.

Buttons use shared semantic variants: `primary` for blue filled main actions, `secondary` for neutral supporting actions, `destructive` for delete/archive actions and `ghost` for icon-only or low-emphasis controls.

Visible master prompt editors use a shared cyan prompt surface. This applies to project workspace Story Content, Scenario and Shots master prompts, scenario create/edit master prompts and the admin Master Prompt editor. Ordinary content/schema/output textareas stay neutral.

## 7. Integration With API Gateway

Frontend API clients should map to Gateway endpoints from [API Contract](./05-api-contract.md).

Rules:

- Use typed request/response DTOs.
- Normalize API errors into UI error states.
- Poll job status through `/api/v1/jobs/{jobId}`.
- Never expose provider API keys to browser runtime.

## 8. Verification

Frontend changes should be verified with:

- Type checks.
- Lint checks.
- Playwright user-flow tests.
- Playwright screenshots for desktop and mobile dashboards.

For UI-heavy changes, screenshots are part of implementation verification, not optional polish.
