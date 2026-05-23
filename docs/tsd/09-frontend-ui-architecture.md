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
- Do not expose a user `Scripts` route in the sidebar. The old `/shots`, `/shots/new`, and `/shots/[shotPlanId]` routes redirect to `/projects`; shot-plan creation remains inside Project and One Click workflows.

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
      master-prompt-config/
      story/master-prompt/
      story/master-prompt/new/
      story/master-prompt/[promptId]/
      scenario/master-prompt/
      scenario/master-prompt/new/
      scenario/master-prompt/[promptId]/
      shots/master-prompt/
      shots/master-prompt/new/
      shots/master-prompt/[promptId]/
      shot-prompt/   # compatibility redirects
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
- `admin-master-prompt` (route compatibility redirect: `/admin/shot-prompt`; canonical list routes: `/admin/story/master-prompt`, `/admin/scenario/master-prompt`, `/admin/shots/master-prompt`, `/admin/shot/master-prompt`; editor routes: `/admin/{story|scenario|shots|shot}/master-prompt/new` and `/admin/{story|scenario|shots|shot}/master-prompt/{promptId}`)
- `admin-master-prompt-config` (global admin-only attribute/option set for master prompt authors)
- `admin-ai-logs`

Each feature module should own:

- API hooks.
- Form schemas.
- Feature components.
- State mapping from API status to UI status.

`shot-media-upload` is a Scenario UI concern: the upload control is rendered inside each shot card, stores validated media IDs in the shot JSON and feeds the Step 4 `Shot` master prompt renderer. Product Flow continues to use project-level `media-upload`.

In the project workspace Scenario flow, a sticky top save bar shows project title, project description and a primary `Save Project` action in one row on desktop; title and description are truncated with ellipsis when long. `Save Project` persists Step 1 Story Content, Step 2 selections and Step 3 Shots result/card edits together. The main Scenario card spans the full available workspace width so Step 1, Step 2 and Step 3 are not constrained to a half-width dashboard column. Step 1 is `Story Content`: it renders the source textarea in the left content column, with `Story Attributes` in a desktop right-column panel that is collapsed by default. The admin-managed `Story Content` master prompt textarea is rendered only when Admin Site Config `showUserMasterPrompts=true`; otherwise the editable prompt field is hidden and the frontend omits temporary `masterPrompt` overrides. The underlying master-prompt type key remains `scripts` for API/data compatibility. On open, Scenario and One Click workspaces load the latest saved database Story Content into that textarea before the user edits it. Generated content replaces that textarea and becomes the source for later steps. Step 2 keeps the Scenario action surface in the left main content column and renders scenario attributes/options in a desktop right-column `Attributes` panel. The Scenario master prompt textarea is rendered only when `showUserMasterPrompts=true`; otherwise analysis uses the active admin default. The `Attributes` panel is collapsed by default, widened for label/count readability, and individual attribute groups remain collapsible with selected-count badges. Attribute and option rows expose saved Scenario description metadata through compact helper icons that open on hover or click. AI action rows expose a `Prompt` button before adjacent `Request` and `Response` buttons; `Prompt` opens exactly the rendered provider prompt after placeholder replacement with no hidden runtime context appended, while `Request`/`Response` open read-only raw-data popups for the latest successful AI run.

Step 3 renders the active admin-managed `Shots` master prompt in an editable `TextareaWithCounter` before the generate controls only when Admin Site Config `showUserMasterPrompts=true`. Changes are temporary workspace state and are sent as the optional `masterPrompt` request override for shot generation only in that mode; when the setting is false, the frontend omits `masterPrompt` and the backend uses the active admin default. Only `Shots Attributes` render in the desktop right-column attribute area beside the Shots generation controls; the panel is collapsed by default while keeping selected-count and attribute-count badges visible. Scenario options are managed in Step 2 and can feed `{scenarioAttributes}` when the Shots prompt contains that placeholder. Step 3 always shows a `Shots result` JSON textarea directly below the generate action row. It is empty until shots exist or the user pastes JSON; when populated, it is the normalized shots JSON used to build Step 4 shot cards. Users can edit it, and every valid JSON edit immediately syncs back to the cards before saving; invalid JSON keeps the last valid cards and shows a readable error. Project and One Click do not show a shot-plan selector or shot-plan name field; the backend persistence record remains internal to the project workflow. `Generate shots` renders inline success/error feedback directly below the JSON editor/action area, with AI provider/config/schema failures formatted as detailed multi-line messages using stable error codes and job metadata when available.

Step 4 renders the editable `Shots` cards as a separate collapsible section below Step 3. It keeps all shot-card behavior: add, remove, select, edit title/duration/description/dialogue, manage generated shot attributes in the wider right column on desktop, upload reference media, open `Prompt`, submit `Create video`, inspect per-shot `Request`/`Response`, and save the synced shot cards. Step 4 also loads the active admin `Shot` master prompt and the active `Shot Attribute` catalog. `Shot Attribute` selections are per-shot, required attributes auto-select their first option, and selections are stored on the shot JSON. The `Shot` master prompt textarea is visible only when Admin Site Config `showUserMasterPrompts=true`; otherwise the user sees only `Prompt`/`Create video`/`Request`/`Response`. Prompt rendering replaces only explicit `Shot` placeholders and never appends hidden runtime context or fallback prompt text.

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
- `/shots`, `/shots/new`, and `/shots/[shotPlanId]` redirect to `/projects` because standalone shot-plan management is no longer exposed.
- `/templates`
- `/templates/new`
- `/templates/[templateId]`

The `/projects` route lists active projects owned by the signed-in user, links to each project workspace at `/projects/[projectId]`, and exposes a compact delete/archive action per row. User shell should prioritize project context, One Click, active jobs and fast creation actions.

The `/one-click` route is a guided Scenario shortcut, not a new backend project flow. It creates a normal internal `script` project from setup name/description, then `/one-click/[projectId]` renders `ProjectWorkspace` in One Click mode: Step 1 Story Content, Step 2 Scenario analysis using a scenario catalog without showing a `Choose scenario` dropdown, Step 3 Shots master prompt plus shot JSON generation, and Step 4 editable shot cards. One Click persists each step: Story Content is saved before Step 2, Scenario analysis writes `templateSelection` to the project and creates a Scenario named/described from setup, Step 3 generates `Shots result` JSON without showing a shot-plan selector or shot-plan name, and Step 4 saves project-linked shot cards.

Scenario create/edit routes (`/templates/new` and `/templates/[templateId]`) render the active admin-managed `Scenario` master prompt above the video idea textarea. The prompt can be edited temporarily for that AI generation request, and provider failures must be displayed inline as detailed multi-line errors without falling back to sample scenario data. The AI generation row exposes `Prompt`, `Request` and `Response` buttons: `Prompt` opens the full rendered provider prompt, while `Request`/`Response` open the redacted raw provider payloads returned by the latest successful `/api/v1/templates/generate` call. Prompt and raw-data popups expose a header copy icon.

Standalone shot-plan create/edit routes are no longer user-facing. Shot generation uses the same AI debug action pattern inside Project and One Click workspaces.

Scenario create/edit routes store human-readable explanations directly in the main JSON-first schema. Each attribute and option can include `description`; options use `name` in JSON and the editor converts it to the internal processing label/value. `Parse schema` and `Save scenario` keep the visual description fields synchronized with the JSON textarea. Legacy `translate`, `label` and `value` fields remain parse-compatible for older scenarios, but the editor emits the shorter `id/name/description/options` format. The schema parser still accepts compact `attribute=option1,option2;` text for compatibility.

All public, user and admin pages should expose a visible back action. The back action may use browser history first, then fall back to the nearest safe route such as `/`, `/dashboard` or `/admin/ai-config`.

Public and authenticated shells use English-only UI copy and do not expose a language toggle. The frontend does not read or write locale browser storage.

Buttons use shared semantic variants: `primary` for blue filled main actions, `secondary` for neutral supporting actions, `destructive` for delete/archive actions and `ghost` for icon-only or low-emphasis controls.

Admin async actions use a shared feedback pattern: the active button is disabled and shows a spinner while the request is in flight, then a compact success/error popup auto-hides after 2 seconds. Admin editor/config pages keep primary `Save` controls at both the top-right and bottom-right so long forms can be saved without scrolling.

Visible master prompt editors use a shared cyan prompt surface. This applies to project workspace Story Content, Scenario, Shots and Shot master prompts, scenario create/edit master prompts and the admin Master Prompt editor. Ordinary content/schema/output textareas stay neutral.

Admin master prompt navigation uses list/editor route separation. `/admin/story/master-prompt`, `/admin/scenario/master-prompt`, `/admin/shots/master-prompt`, and `/admin/shot/master-prompt` are list-only pages. `New prompt` opens `/new`; `Edit` opens `/{promptId}`. Built-in prompt rows open `/new?source=built-in` so admin users create persisted copies instead of editing built-in content. Editor pages expose `Prompt content` plus a separate `Output Format placeholder` textarea. They also show the matching admin workflow Attribute catalog below `Master Prompt Attribute`: Story Content shows Story Attribute, Scenario shows Scenario Attribute, Shots shows Shots Attribute, and Shot shows Shot Attribute. Their `Prompt` preview button renders the exact draft prompt, replacing admin-owned `{masterPromptAttributes}`, replacing the matching type-specific attribute placeholder when admin selections exist, and replacing `{outputFormat}` while leaving other user runtime placeholders unchanged.

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
## 9. Admin Attribute Navigation

- Admin navigation groups Story, Scenario, Shots, and Shot as non-clickable parents.
- Each parent exposes two child routes: `Master Prompt` and `Attribute`. `Shots` is Step 3 batch shot-list generation; `Shot` is Step 4 per-shot final prompt creation.
- Canonical routes are:
  - `/admin/story/master-prompt`
  - `/admin/story/attributes`
  - `/admin/scenario/master-prompt`
  - `/admin/scenario/attributes`
  - `/admin/shots/master-prompt`
  - `/admin/shots/attributes`
  - `/admin/shot/master-prompt`
  - `/admin/shot/attributes`
- The `Attribute` child routes are catalog list pages only. Catalog creation and editing use dedicated routes under the same type, such as `/admin/story/attributes/new` and `/admin/story/attributes/{catalogId}`.
- Attribute editor pages share the same prompt/source/JSON/visual editor pattern. `Prompt`, `Request`, and `Response` actions sit next to the AI generation button so raw debug controls stay tied to generation.
- Old `/admin/shot-prompt/...` routes should redirect to the matching new Master Prompt routes.
- User navigation no longer exposes Scenario management. Project and One Click screens read admin default catalogs instead.

## 10. Admin-Only Master Prompt Config

- Admin navigation exposes `Master Prompt Config` under the AI admin area.
- `/admin/master-prompt-config` renders a visual attribute/option editor plus a synchronized JSON textarea.
- The config is shared by Story Content, Scenario, Shots, and Shot master prompt editors.
- Story Content, Scenario, Shots, and Shot master prompt editor pages show a read/select `Master Prompt Attribute` section. Admins can select options for that prompt but cannot edit the global config from that section.
- Story Content, Scenario, Shots, and Shot master prompt editor pages also show a read/select type-specific Attribute section using the active catalog for that prompt type. The selected options are saved per prompt as admin prompt-authoring metadata.
- Master Prompt Attribute selection rows show names only. Descriptions are helper-icon content and are not inserted into `{masterPromptAttributes}`.
- Admin master prompt placeholder suggestions include `{masterPromptAttributes}`.
- User Project and One Click master prompt editors continue to use the user-safe placeholder list and must not show `{masterPromptAttributes}` or Master Prompt Attribute selectors.
