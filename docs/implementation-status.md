# Implementation Status

This document tracks what has been implemented from the current docs and what remains scaffolded.

## Current Slice

Implemented as the first foundation slice:

- Root npm workspace.
- Next.js web app scaffold under `apps/web`.
- Auth.js credentials configuration for demo users:
  - `user` / `User@123`
  - `admin` / `Admin@123`
- Role-based login redirect:
  - `user` sessions land on `/dashboard`.
  - `admin` sessions land on `/admin/ai-config`.
  - Admin sessions that manually open `/dashboard` are redirected back to `/admin/ai-config`.
- Server-side route guards for user and admin dashboard pages.
- Header logout action for authenticated dashboard pages.
- User dashboard route:
  - `/dashboard`
  - `/projects`
  - `/projects/new`
  - `/projects/[projectId]`
  - `/shots` with visible sidebar/page label `Scripts`
  - `/shots/new`
  - `/shots/[shotPlanId]`
  - `/templates`
  - `/templates/new`
  - `/templates/[templateId]`
- Project creation form:
  - Calls `POST /api/v1/projects`.
  - Requires either `Script Flow` or `Product Flow`.
  - Redirects to the selected project workspace after creation.
- Projects list:
  - Calls `GET /api/v1/projects` for active projects only.
  - Provides `Open` and compact delete/archive actions per row; delete calls `DELETE /api/v1/projects/{projectId}` and removes the project from the active list.
- Back action in public pages and authenticated dashboard shell pages.
- English-only UI copy in public pages and authenticated dashboard shell pages; no language toggle is rendered.
- Client-side language provider backed by a single English dictionary for core UI labels, buttons, form helpers and dashboard copy.
- Shared button variants standardize primary, secondary, destructive and ghost actions across user/admin screens.
- Project workspace interactive slice:
  - Renders the selected project flow instead of asking the user to choose a flow inside the project detail page.
  - Image/video upload uses the API Gateway, local storage files and PostgreSQL media metadata.
  - Script Flow upload is scoped to individual shot cards and stores validated media IDs in shot JSON.
  - Script Flow can load user-owned reusable shot plans, generate new plans, edit shot JSON, select multiple shots and persist them to PostgreSQL.
    - Loads video templates from PostgreSQL and renders template attribute/option checkboxes inside a desktop right-column `Attributes` panel that is collapsed by default and widened for label/count readability.
    - Script Flow has Step 1 `Story Content` with the active `Scripts` master prompt visible and editable for a temporary generation; `Generate Story Content` calls the active AI provider, writes the provider response back into the textarea, and reuses that content across later script steps.
    - Story Content generation failures show detailed safe errors inline under the button and do not fallback to local/sample content.
    - Script Flow can analyze Step 1 Story Content against the selected Kịch bản with an admin-managed Scenario master prompt that users can edit temporarily, auto-check matching options through AI, and save the selection to project JSON.
    - Script Flow labels Story Content as Step 1, Kịch bản as Step 2 and Shots as Step 3; shot generation sends selected Step 2 attributes/options into `shot_generation`.
    - Project workspace AI action rows show a `Prompt` button before `Request` for master-prompt flows, plus `Request` and `Response` buttons beside Story Content generation, Scenario analysis, Shot generation and Product analysis; buttons open read-only popups for the rendered prompt or latest successful raw data, and raw-data buttons stay disabled until data exists.
    - The Script Flow card spans the full available project workspace width so Step 1, Step 2 and Step 3 are not constrained by the Product Flow two-column layout.
    - Step 1, Step 2, Step 3, the Step 2 `Attributes` panel and individual attribute groups can collapse/expand. The Story Content textarea in Step 1 is reused by Step 2 scenario analysis and Step 3 shot generation.
    - Step 3 shows the active admin-managed `Shots` master prompt in an editable textarea; edits are sent as a temporary `masterPrompt` override for the next shot generation without changing the admin default.
    - Step 3 shot cards render shot-level attributes inside their own right-column collapsed `Attributes` panel with count, add, edit and remove controls using the same wider desktop layout; `Create Prompt` remains a separate shot action.
  - Script Flow includes a read-only prompt preview popup for the composed AI request before submission.
  - Script Flow no longer shows the `AI suggested content` panel in the per-shot local prompt composer path.
  - Product Flow prompt generation/analysis actions call the API Gateway, persist job/log/prompt records and poll database-backed job status.
  - Product URL analysis action calls the API Gateway, persists job/log/prompt records and polls database-backed job status.
  - Create Script action persists the final editable prompt as a script record.
- Kịch bản workspace:
  - Sidebar menu item `Kịch bản` at `/templates`.
  - `/templates` is now list-only with add/edit/delete/set-default actions.
  - `/templates/new` and `/templates/[templateId]` both show the AI idea/prompt area, AI-assisted scenario generation action and the editable attribute/option builder.
  - Scenario create/edit pages show the active admin-managed `Scenario` master prompt in an editable textarea. Temporary edits are sent as `masterPrompt` for the AI generation request.
  - AI-assisted scenario generation now calls the configured prompt provider/model through `/api/v1/templates/generate`, logs redacted raw provider request/response, returns detailed readable API errors on provider/config/schema failure and does not fallback to sample scenario data.
  - Compact schema textarea supports `attribute=option1,option2;` and compatible JSON input before save.
  - Visual editor uses numbered attribute/option rows and omits per-attribute description fields.
  - Manual add attribute and add option.
  - Delete saved scenarios and persist normalized template JSON to PostgreSQL.
- Admin dashboard routes:
  - `/admin/ai-config`
  - `/admin/shot-prompt`
    - Visible label/title is `Master Prompt`.
    - Manages `Scenario`, `Shots` and `Scripts` master prompts from `config.master_prompts`, including create, edit, archive/delete and set default per type.
    - Keeps legacy `/admin/shot-prompt` URL and legacy prompt columns as compatibility/fallback.
  - `/admin/ai-logs`
- Visible admin/user textareas use the shared `TextareaWithCounter` component with a character count, excluding hidden clipboard helper textareas.
- Visible master prompt editors use the shared cyan `MasterPromptField` surface so they are distinct from ordinary textareas.
- NestJS API Gateway scaffold under `apps/api-gateway`.
- Shared contracts package under `packages/contracts`.
- Shared support package skeletons:
  - `packages/auth`
  - `packages/config`
  - `packages/database`
  - `packages/errors`
  - `packages/logger`
  - `packages/storage`
  - `packages/ai-providers`
- Service boundary skeletons under `services/*`.
- Worker boundary skeletons under `workers/*`.
- Local infrastructure scaffold:
  - PostgreSQL schema init script.
  - Redis service in Docker Compose.
  - Local upload storage directory.
- Prisma schema and seed data:
  - Seeded credentials in PostgreSQL:
    - `user` / `User@123`
    - `admin` / `Admin@123`
  - Seeded demo project, active AI config and sample AI request/response log.
  - Seeded product introduction template.
  - `config.master_prompts` stores active/default master prompts by type; built-in prompts are used read-only when no DB prompt exists.
  - Root database scripts: `db:generate`, `db:push`, `db:seed`, `db:setup`.

## Current Limitations

- API Gateway is still the early vertical-slice orchestrator and calls Prisma-backed service schemas directly until separate service processes are wired.
- Prisma schema is implemented with `db push` for local development; formal migration files are not created yet.
- BullMQ queues are not wired yet.
- Service-to-service communication is not implemented yet.
- AI provider SDK adapters are not wired yet. `template_generation` and `shot_generation` now call real providers through REST using saved provider keys or env fallback; other provider results are still generated by the API vertical slice and persisted to PostgreSQL.
- Media binary files are stored through the local storage provider under `storage/uploads`; metadata, validation status and references are stored in PostgreSQL.
- Auth.js credentials authorize against PostgreSQL user profile records.
- Uploaded media metadata, projects, jobs, AI logs, prompts, scripts, AI config and video generation records are database-backed.
- Video templates and template selections used for prompt generation are database/log backed.
- Video shot plans and shot selections used for prompt generation are database/log backed.
- User sidebar includes `Scripts` at the compatibility route `/shots`; `/shots` is list-only with add/edit/delete/set-default actions, while `/shots/new` and `/shots/[shotPlanId]` handle story input, reusable shot-plan generation, raw provider request/response review, normalized plan/shot attribute editing and PostgreSQL persistence.
- User sidebar includes `Projects`, which opens the database-backed project list instead of a hard-coded project workspace.
- `Scripts` create/edit pages start from a fixed screenwriter prompt with a story-content section; generated shot plans include `Start state`, `End state` and `Dialogue` attributes for continuity and per-shot spoken content.
- `Generate shots` uses the active prompt provider/model. Missing saved provider key and missing env fallback fail the job with `AI_CONFIG_MISSING`; provider or parse failures use `AI_PROVIDER_FAILED` and do not create fake shot data.
- Admin can manage `Scenario`, `Shots` and `Scripts` master prompts with recommended placeholder formats and default selection per type; backend replaces placeholders when present and appends structured context at runtime.
- The per-shot local prompt composer remains a legacy compatibility surface and appends structured shot context in the web app.
- Script Flow now composes prompts per shot locally from shot media, shot attributes and selected template options, with copy actions in each shot card. Shot and plan attribute placeholders render bracketed rows, including `[Voiceover Script]: "..."` for the `Dialogue` value.

## Next Recommended Slice

Split the database-backed vertical slice into service-owned runtime modules:

1. Move project persistence behind Project Service.
2. Move media upload metadata and storage calls behind Media Service.
3. Move AI config and AI logs behind their service modules.
4. Add BullMQ queues for prompt/product/video jobs.
5. Add formal Prisma migrations per service-owned schema.

Alternative frontend-first slice:

1. Add TanStack Query.
2. Add richer upload progress and persisted upload retry UX.
3. Add video generation output tracking and artifact preview.

## Docs Sync Note

This implementation follows the current architecture in:

- `docs/tsd/02-system-architecture.md`
- `docs/tsd/03-service-boundaries.md`
- `docs/tsd/05-api-contract.md`
- `docs/tsd/09-frontend-ui-architecture.md`
- `docs/frontend/*`
