# Dashboard UX Guidelines

## 1. User Dashboard

Primary goals:

- Let user create a project quickly.
- Let user resume recent projects.
- Make generation status visible.
- Keep prompt/script/video actions obvious.

User navigation should include:

- Dashboard
- Projects
- One Click
- Scripts (route remains `/shots` for compatibility)
- Kịch bản

Recommended first screen:

- Header with `Create Project` primary action.
- Recent projects table or grid.
- Recent projects should show the selected project flow when practical.
- Project rows should expose `Open` plus a compact delete/archive action; deleting removes the project from active lists.
- Active jobs panel.
- Small metrics: projects, scripts, videos, failed jobs.
- Empty state when no projects exist.

Create Project should open a focused project creation screen where the user selects exactly one starting flow:

- `Script Flow` for text, prompt or script-first work.
- `Product Flow` for product URL and reference-media-first work.

One Click should open a guided shortcut, not a separate backend flow:

- `/one-click` creates a normal `Script Flow` project from a project name.
- `/one-click/{projectId}` shows one step at a time with `Back` and `Next`.
- Step 1 reuses Story Content generation and raw Prompt/Request/Response debugging, and saves Story Content to the database before moving to the next step.
- Step 2 is a Scenario step: it shows Scenario master prompt, Story Content, the scenario catalog in use, and `Analyze scenario` with `Prompt`/`Request`/`Response`; it does not show a `Choose scenario` dropdown. It reuses the Scenario content editor pattern from Scenario create/edit so the current scenario name, description, schema JSON and attributes/options can be reviewed and saved inline. Successful analysis saves a Scenario with the One Click setup name and description.
- Step 3 reuses Shots master prompt and AI shot generation with editable shot cards, including selected scenario attributes when Step 2 analysis has run. One Click does not show an existing shot-plan selector in Step 3; generated shot plans are saved to the database, linked to the project and named/described from the One Click setup.

Avoid a marketing hero after login.

## 1.1. Language

The product UI is English-only:

- Public home and login pages do not show a language switch.
- User dashboard, project workspace and admin dashboard do not show a language switch.
- Locale is not read from or written to browser storage.
- User-generated project data and AI-generated content are displayed as entered or returned by AI.

## 2. Project Detail Workspace

Project detail should be a workspace, not a static detail page.

Recommended layout:

- Left or top context area: project name, status, last updated.
- Main workspace renders the flow selected during project creation:
  - `Script Flow`
  - `Product Flow`
- Kịch bản/scenario selection area above generation actions.
- Right-side or lower activity panel for generation history.

Do not ask the user to choose between Script Flow and Product Flow again inside the project detail page unless the product requirement explicitly adds flow switching later.

## 3. Script Flow

Recommended layout:

- Step 1 `Story Content` editor.
  - The Script Flow card spans the full project workspace width so all script steps have the full available content width.
  - The whole step can collapse/expand.
  - Show the admin-managed `Story Content` master prompt in a textarea above the Story Content textarea. Edits are temporary for the current generation and do not overwrite the admin default.
  - Master prompt editors use the shared cyan prompt surface so they are visually distinct from ordinary story/schema/output textareas.
  - When a Script Flow or One Click project is opened, load the latest saved database Story Content into the Story Content textarea before the user edits it.
  - The `Story Content` textarea is the source of truth for later Scenario analysis, Shots generation, per-shot prompt composition and Script creation.
  - Clicking `Generate Story Content` sends the temporary master prompt override when present. The returned content replaces the Story Content textarea and becomes the source for following steps.
  - Story Content generation is a real AI provider request. If it fails, show the readable failure details directly under the button, including stable error code, provider/model when available, env/status hints when relevant and job ID. Do not show fallback sample content in the user workspace.
  - Show a `Prompt` button before `Request` next to `Generate Story Content`; it opens a read-only popup containing exactly the master prompt after optional placeholder replacement. Runtime data appears only through placeholders present in the prompt.
  - Show `Request` and `Response` buttons next to `Generate Story Content`; they stay disabled until the latest AI run returns raw data and open a full read-only popup for inspection.
  - Include a prompt preview icon above the Story Content editor to inspect the composed AI request before submission.
- Step 2 `Kịch bản tạo prompt` selector with attribute/option checkboxes.
  - The Script Flow card spans the full project workspace width so Step 2 and Step 3 have the full available content width.
  - The whole step can collapse/expand.
  - The admin-managed scenario analysis master prompt is shown in a textarea above the attribute/option catalog and can be edited temporarily for the current analysis.
  - The Scenario master prompt uses the shared cyan prompt surface.
  - `Analyze scenario` and `Save selection` actions appear directly after the master prompt, before the attribute/option catalog.
  - Show a `Prompt` button before `Request` next to `Analyze scenario`; it opens a read-only popup containing exactly the Scenario master prompt after optional `{story}`/`{attributes}` replacement.
  - Show `Request` and `Response` buttons next to `Analyze scenario`; they stay disabled until the latest AI run returns raw data and open a full read-only popup for inspection.
  - On desktop, the attribute/option catalog lives in a right-column `Attributes` panel; the master prompt, actions and AI error/result feedback stay in the left content column. The panel should be wide enough for Vietnamese labels and selected-count badges without cramped wrapping, about `380px` on wide desktop.
  - The `Attributes` panel is collapsed by default, and each attribute group inside it can also collapse/expand while keeping the selected option count visible.
  - Attribute and option rows that have saved Scenario description metadata show a compact helper icon. Hovering or clicking the icon opens a small popover with the saved description without toggling the row selection/collapse state.
- AI scenario analysis action that combines the current temporary master prompt, Step 1 Story Content and selected Kịch bản attribute/option catalog, auto-selects matching options, and saves that selection to the project.
- Manual `Save selection` action for edited Kịch bản checkboxes so project reloads keep the same option selection.
- Step 3 `Shots tạo prompt` planner below Kịch bản:
  - The whole step can collapse/expand.
  - Step 3 uses the Story Content entered or generated in Step 1 as the source content for shot generation.
  - Default 8 seconds per shot.
  - Generate shot plan from current final content or prompt input through the AI-backed `shot_generation` job.
  - Include the currently selected Step 2 scenario attributes/options in the shot-generation request as compact plan attributes.
  - Display the admin-managed `Shots` master prompt in an editable textarea before the duration/generate action. Edits are temporary for the current generation and do not overwrite the admin default.
  - The Shots master prompt uses the shared cyan prompt surface.
  - Send the temporary `Shots` master prompt override with the shot-generation request; when absent, backend uses the active admin default.
  - Show a `Prompt` button before `Request` next to `Generate shots`; it opens a read-only popup containing exactly the Shots master prompt after optional `{story}`/`{attributes}`/`{durationSeconds}` replacement.
  - Show `Request` and `Response` buttons next to `Generate shots`; they stay disabled until the latest AI run returns raw data and open a full read-only popup before the normalized editable cards are reviewed.
  - `Generate shots` shows an inline success notice when the shot plan is created and a detailed multi-line error notice when provider/config/schema failures occur. Error details include the stable code, provider/model/status/env hints and job ID when the backend returns them.
  - Always show `Shots result` directly below the generate action row. It contains the normalized shot-plan JSON used to build the editable shot cards when available, or stays empty until user generates/pastes JSON. User edits to this JSON are applied with `Apply JSON`, which rebuilds the cards; `Save shots` persists the applied result.
  - Edit, add, remove and select shots before prompt generation.
  - Each shot card includes a dedicated dialogue/voiceover textarea backed by the `Dialogue` shot attribute.
  - Each shot card renders shot-level attributes in its own right-column `Attributes` panel, matching the Step 2 pattern and desktop width; the panel is collapsed by default, keeps the attribute count visible, and contains add/edit/remove controls.
  - Reference media upload is inside each shot card, not a global Script Flow upload block.
  - Shot prompt composition uses only the media attached to that shot.
  - Each shot can locally compose a formatted prompt from the shot, shot attributes and selected template options using the legacy per-shot composer prompt plus structured runtime context.
  - Each shot card shows `Prompt`, `Create video`, `Request` and `Response` actions. `Prompt` opens the shared read-only popup with copy support. `Create video` submits the composed shot prompt to the configured video provider/model, then enables raw request/response popups for that shot.
  - Video creation failures must show a readable inline error on the shot card with provider/model, error code, HTTP status/env hint and job ID when available. The UI must not show fake successful video data when the provider fails.
- Compact status/error feedback inside the Script Flow workspace. Do not show the `AI suggested content` panel for this per-shot prompt composer path.
- Scenario analysis failures must show an inline, user-readable error directly below `Analyze scenario`, including the stable error code, provider/model when available, env/status hints when relevant and the job ID for admin lookup. Do not expose API keys; successful raw request/response is available through the adjacent read-only popup buttons and Admin > AI Logs.

States:

- Empty input.
- Media uploading.
- Generate queued.
- Generate processing.
- Generate succeeded.
- Generate failed.
- Final prompt edited.
- Shot plan generated, edited, saved and selected.
- Shot prompt composed and copied.

UX rule:

- User must clearly see which content is final before creating script or video.
- AI-generated final content should be readable in the editor with line breaks and numbered sections. Local per-shot composer attribute placeholders should render each shot/plan attribute as `[Attribute Name]: value`; the `Dialogue` shot attribute renders as `[Voiceover Script]: "..."`.
- The prompt preview popup must be read-only and show the current user text, selected shot media IDs, selected shots, selected template options and the composed instruction preview without calling AI.
- In the local per-shot prompt composer path, `Prompt` does not call AI and opens a complete, readable prompt in the shared popup.

## 4. Product Flow

Recommended layout:

- Product URL input.
- Reference media upload area.
- Kịch bản selector with attribute/option checkboxes.
- Product analysis output.
- Generated prompt editor.
- Action footer with `Analyze Product`, then `Create Script` or `Create Video`.

The result panel should separate:

- Product facts.
- Media insights.
- Generated prompt.
- Provider/model metadata if useful.

## 4.1. Kịch Bản Builder

Kịch bản page requirements:

- `/templates` is a list-only Scenario page. It shows saved scenarios with `Add`, `Edit` and `Delete`; there is no `Set default` action.
- `Add` opens `/templates/new`; `Edit` opens `/templates/{templateId}`.
- Scenario create/edit pages both show the free-text AI idea/prompt area, AI generation action, JSON-first schema parsing and visual attribute/option editing.
- Scenario create/edit pages show the active `Scenario` master prompt in an editable textarea above the video idea. Edits are temporary for that AI generation request and do not overwrite the admin default.
- The Scenario master prompt editor uses the shared cyan prompt surface.
- AI Scenario generation calls the active prompt provider/model through the API. If the provider request fails, the UI shows a readable multi-line error directly below `Generate scenario with AI`, including stable error code, provider/model, env/status/request ID when available.
- `Generate scenario with AI` shows `Prompt`, `Request` and `Response` buttons in the same action row. `Prompt` opens the full rendered Scenario generation prompt without calling AI. `Request` and `Response` stay disabled until a generation returns raw provider data, then open read-only popups.
- Prompt, Request and Response popups include a header copy icon so the full rendered prompt or raw payload can be copied without selecting text manually.
- Prompt popups that include uploaded image media show the persisted media preview and metadata. Prompt copy remains text-only; image binaries are not copied from the media card or prompt popup.
- Scenario generation must not silently populate sample/fallback attributes after AI failure.
- The visual editor shows numbered attributes and numbered option rows with editable `description` fields for each attribute and option.
- The schema textarea uses optimized JSON as the primary format for normalized attributes/options: attributes and options use `id`, `name`, optional `description`, and nested `options`. Compact `attribute=option1,option2;` text remains accepted for compatibility.
- The schema parser reads `description` directly from the main JSON schema when parsing or saving. Option `name` becomes the processing label/value. Legacy `label`, `value` and `translate` fields are still accepted when loading older JSON, but the editor no longer emits them.
- Scenario create/edit pages no longer have a separate translate textarea. Users edit the main JSON schema or the visual description fields, and both stay synchronized through `Parse schema` and save.
- Project workspace Scenario attributes/options reuse those saved descriptions through helper icons so users can inspect description context while selecting options.
- User can add attributes manually and add/remove options inside each attribute on create/edit pages.
- User can delete a saved scenario from the list page.
- Scenario lists are ordered by latest update; user-facing default scenario selection is removed.
- Each attribute can later allow multiple selected options in project workspace.
- Saving writes scenario/template JSON to PostgreSQL through the API.

## 4.2. Scripts Manager

Scripts page requirements:

- User can open `Scripts` from the user sidebar; the compatibility route remains `/shots`.
- Shot plans are user-owned reusable assets; `/shots` must not require a project selector.
- `/shots` is a list-only Scripts page. It shows saved scripts/shot plans with `Add`, `Edit` and `Delete`; there is no `Set default` action.
- `Add` opens `/shots/new`; `Edit` opens `/shots/{shotPlanId}`.
- Script create/edit pages handle story input, optional plan-level attributes, AI generation, raw request/response review and normalized shot-card editing.
- `/shots/new` generation sends the default 8 seconds per shot.
- Script create/edit generation uses the same AI debug action pattern as project workspace: `Prompt` opens the full rendered shot-generation prompt, while `Request` and `Response` open latest raw provider data in read-only popups after generation succeeds.
- Generated shots should include explicit `Start state` and `End state` attributes so each shot can continue from the previous shot's ending state.
- Generated shot plans must be listed from PostgreSQL and be selectable from any project workspace owned by the same user.
- User can edit shot plan attributes, shot title, description, duration and arbitrary shot attributes, add/remove shots or attributes, save changes to PostgreSQL, and open the related project workspace to select shots for prompt generation.
- Scripts/shot-plan lists are ordered by latest update; user-facing default script selection is removed.

## 5. Reference Media Upload

Upload UI requirements:

- Drag and drop area.
- File picker button.
- Supported type helper text.
- Preview grid.
- File status.
- Remove button per file.
- Validation errors per file.
- Uploaded media IDs and validation status come from the API/database, not browser-generated IDs.

Preview behavior:

- Images show thumbnail.
- Videos show thumbnail or player.
- Long file names truncate safely.
- Invalid files remain visible until user removes them or retries.
- Reloading the project workspace should show persisted media metadata and preview routes for files that have not been deleted.

## 6. Admin Dashboard

Admin navigation:

- Overview
- AI Config
- AI Logs
- Users
- System Settings

Initial admin scope:

- AI Config.
- Master Prompt.
- AI Logs.

## 7. Admin AI Config

Recommended layout:

- Content mode card:
  - `Create Script`
  - `Create Video`
- Prompt provider/model card:
  - Provider free-text input with provider suggestion chips.
  - Model free-text input with provider-aware suggestion chips.
  - Secret input for prompt provider key.
  - Key status and `Test connect` action.
- Video provider/model/key card:
  - Provider free-text input with provider suggestion chips.
  - Model free-text input with provider-aware suggestion chips.
  - Secret input.
  - Key status.
  - `Test connect` action.
- Audit summary panel.

UX rules:

- API key is never shown after save.
- Key status distinguishes saved key, env fallback and missing key.
- Admin can type an arbitrary provider/model; suggestions are helpers, not limits.
- Save button clearly indicates pending/success/failure.
- Missing config blocks user generation with actionable admin-facing error.

## 8. Admin Master Prompt

Recommended layout:

- Sidebar label and page title are `Master Prompt`; `/admin/shot-prompt` remains a compatibility redirect.
- Render `Story Content`, `Scenario` and `Shots` as child menu items under `Master Prompt`. The underlying API type key for Story Content remains `scripts`.
- Child menu routes are `/admin/shot-prompt/story-content`, `/admin/shot-prompt/scenario` and `/admin/shot-prompt/shots`; the active parent and active child must be visually highlighted.
- Clicking a child menu item shows only that prompt type's list in CRUD format. The editor opens after `New prompt` or `Edit`, keeping the list as the default view.
- Each child list shows prompt rows with default/built-in badges plus `Edit`, `Set default` and `Delete`; the editor contains `Save`, `Delete` and `Set default` for the open prompt.
- Built-in defaults are read-only when no DB prompt exists.
- Deleting the current default is blocked until another active prompt in the same type is selected as default.

UX rules:

- Master prompts keep recommended placeholder formats, but helper text must state placeholders are optional and runtime data is included only through placeholders in the prompt.
- `Story Content` is used for Step 1 content expansion in Project and One Click, `Scenario` is used for scenario analysis, and `Shots` is used for shot-plan generation and `/shots`.
- Every visible textarea in admin and user workflows shows a small muted character count at the bottom-left. Hidden clipboard helper textareas are excluded.

## 9. Admin AI Logs

Use a dense data table with:

- Date/time.
- User.
- Project.
- Flow type.
- Provider.
- Model.
- Status.
- Latency.
- Request ID.
- Detail action.

Filters:

- Date range.
- Status.
- Provider.
- Model.
- Flow type.
- User/project search.

Detail view:

- Use a drawer or sheet.
- Show request metadata.
- Show request payload with secrets redacted.
- Show response payload.
- Show errors.
- Show latency/token/cost metadata.

## 10. Responsive Behavior

Desktop:

- Sidebar stays visible.
- Tables use full width.
- Prompt workspace can use two-column layout.

Tablet:

- Sidebar can collapse.
- Prompt workspace stacks result panel below editor.

Mobile:

- Sidebar becomes sheet navigation.
- Tables need simplified cards or horizontal scroll.
- Upload preview stays readable.
- Primary action remains reachable.

## 11. Visual QA Checklist

Before completing UI work, verify:

- Text does not overflow buttons, cards, tabs or table cells.
- Loading states do not shift layout unexpectedly.
- Empty states are useful and not oversized.
- Error states identify the failed operation.
- Upload previews are visible on desktop and mobile.
- Admin tables remain usable with realistic log data.
- Keyboard focus is visible.
- Dialogs and drawers can be closed with keyboard.
