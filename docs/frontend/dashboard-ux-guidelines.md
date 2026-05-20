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
  - Show the admin-managed `Scripts`/Story Content master prompt in a textarea above the Story Content textarea. Edits are temporary for the current generation and do not overwrite the admin default.
  - Master prompt editors use the shared cyan prompt surface so they are visually distinct from ordinary story/schema/output textareas.
  - The `Story Content` textarea is the source of truth for later Scenario analysis, Shots generation, per-shot prompt composition and Script creation.
  - Clicking `Generate Story Content` sends the temporary master prompt override when present. The returned content replaces the Story Content textarea and becomes the source for following steps.
  - Story Content generation is a real AI provider request. If it fails, show the readable failure details directly under the button, including stable error code, provider/model when available, env/status hints when relevant and job ID. Do not show fallback sample content in the user workspace.
  - Show a `Prompt` button before `Request` next to `Generate Story Content`; it opens a read-only popup containing the full prompt after optional placeholder replacement and appended runtime context.
  - Show `Request` and `Response` buttons next to `Generate Story Content`; they stay disabled until the latest AI run returns raw data and open a full read-only popup for inspection.
  - Include a prompt preview icon above the Story Content editor to inspect the composed AI request before submission.
- Step 2 `Kịch bản tạo prompt` selector with attribute/option checkboxes.
  - The Script Flow card spans the full project workspace width so Step 2 and Step 3 have the full available content width.
  - The whole step can collapse/expand.
  - The admin-managed scenario analysis master prompt is shown in a textarea above the attribute/option catalog and can be edited temporarily for the current analysis.
  - The Scenario master prompt uses the shared cyan prompt surface.
  - `Analyze scenario` and `Save selection` actions appear directly after the master prompt, before the attribute/option catalog.
  - Show a `Prompt` button before `Request` next to `Analyze scenario`; it opens a read-only popup containing the full prompt after optional `{story}`/`{attributes}` replacement and appended runtime catalog/story context.
  - Show `Request` and `Response` buttons next to `Analyze scenario`; they stay disabled until the latest AI run returns raw data and open a full read-only popup for inspection.
  - On desktop, the attribute/option catalog lives in a right-column `Attributes` panel; the master prompt, actions and AI error/result feedback stay in the left content column. The panel should be wide enough for Vietnamese labels and selected-count badges without cramped wrapping, about `380px` on wide desktop.
  - The `Attributes` panel is collapsed by default, and each attribute group inside it can also collapse/expand while keeping the selected option count visible.
  - Attribute and option rows that have saved Scenario translate/description metadata show a compact helper icon. Hovering or clicking the icon opens a small popover with the saved translate and description without toggling the row selection/collapse state.
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
  - Show a `Prompt` button before `Request` next to `Generate shots`; it opens a read-only popup containing the full prompt after optional `{story}`/`{attributes}`/`{durationSeconds}` replacement and appended shot-generation runtime context.
  - Show `Request` and `Response` buttons next to `Generate shots`; they stay disabled until the latest AI run returns raw data and open a full read-only popup before the normalized editable cards are reviewed.
  - `Generate shots` shows an inline success notice when the shot plan is created and a detailed multi-line error notice when provider/config/schema failures occur. Error details include the stable code, provider/model/status/env hints and job ID when the backend returns them.
  - Edit, add, remove and select shots before prompt generation.
  - Each shot card includes a dedicated dialogue/voiceover textarea backed by the `Dialogue` shot attribute.
  - Each shot card renders shot-level attributes in its own right-column `Attributes` panel, matching the Step 2 pattern and desktop width; the panel is collapsed by default, keeps the attribute count visible, and contains add/edit/remove controls.
  - Reference media upload is inside each shot card, not a global Script Flow upload block.
  - Shot prompt composition uses only the media attached to that shot.
  - Each shot can locally compose a formatted prompt from the shot, shot attributes and selected template options using the legacy per-shot composer prompt plus structured runtime context.
  - Each generated shot prompt has a copy action in the prompt panel.
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
- In the local per-shot prompt composer path, `Create Prompt` does not call AI and should produce a complete, readable prompt inside the shot card.

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

- `/templates` is a list-only Scenario page. It shows saved scenarios, default badge, `Add`, `Edit`, `Delete` and `Set default`.
- `Add` opens `/templates/new`; `Edit` opens `/templates/{templateId}`.
- Scenario create/edit pages both show the free-text AI idea/prompt area, AI generation action, compact schema parsing and visual attribute/option editing.
- Scenario create/edit pages show the active `Scenario` master prompt in an editable textarea above the video idea. Edits are temporary for that AI generation request and do not overwrite the admin default.
- The Scenario master prompt editor uses the shared cyan prompt surface.
- AI Scenario generation calls the active prompt provider/model through the API. If the provider request fails, the UI shows a readable multi-line error directly below `Generate scenario with AI`, including stable error code, provider/model, env/status/request ID when available.
- `Generate scenario with AI` shows `Prompt`, `Request` and `Response` buttons in the same action row. `Prompt` opens the full rendered Scenario generation prompt without calling AI. `Request` and `Response` stay disabled until a generation returns raw provider data, then open read-only popups.
- Scenario generation must not silently populate sample/fallback attributes after AI failure.
- The visual editor shows numbered attributes and numbered option rows; per-attribute description inputs are not shown in the primary editor.
- The compact schema textarea accepts `attribute=option1,option2;` text or compatible JSON and parses it into normalized database JSON before save.
- The compact schema parser also supports optional human-readable notes using `attributeKey | Vietnamese | description = option | Vietnamese | description`; JSON input can use `description`, `vietnamese`, `translation`, `explanation` or `detail` fields. English labels/values remain the prompt-processing data, while Vietnamese text is saved only as user-facing explanation.
- Scenario create/edit pages include a `Vietnamese translate JSON` textarea. Users can generate JSON from the current attributes, edit translate/description values, and apply it exactly by `attributeId`/`optionId` to update descriptions for readability. The apply action is disabled after the JSON has already been applied and there are no pending description changes.
- Project workspace Scenario attributes/options reuse those saved descriptions through helper icons so users can inspect translate/description context while selecting options.
- User can add attributes manually and add/remove options inside each attribute on create/edit pages.
- User can delete a saved scenario from the list page.
- User can set one default scenario; default scenarios are shown first in lists and project selectors.
- Each attribute can later allow multiple selected options in project workspace.
- Saving writes scenario/template JSON to PostgreSQL through the API.

## 4.2. Scripts Manager

Scripts page requirements:

- User can open `Scripts` from the user sidebar; the compatibility route remains `/shots`.
- Shot plans are user-owned reusable assets; `/shots` must not require a project selector.
- `/shots` is a list-only Scripts page. It shows saved scripts/shot plans, default badge, `Add`, `Edit`, `Delete` and `Set default`.
- `Add` opens `/shots/new`; `Edit` opens `/shots/{shotPlanId}`.
- Script create/edit pages handle story input, optional plan-level attributes, AI generation, raw request/response review and normalized shot-card editing.
- `/shots/new` generation sends the default 8 seconds per shot.
- Script create/edit generation uses the same AI debug action pattern as project workspace: `Prompt` opens the full rendered shot-generation prompt, while `Request` and `Response` open latest raw provider data in read-only popups after generation succeeds.
- Generated shots should include explicit `Start state` and `End state` attributes so each shot can continue from the previous shot's ending state.
- Generated shot plans must be listed from PostgreSQL and be selectable from any project workspace owned by the same user.
- User can edit shot plan attributes, shot title, description, duration and arbitrary shot attributes, add/remove shots or attributes, save changes to PostgreSQL, and open the related project workspace to select shots for prompt generation.
- User can set one default script/shot plan; default scripts are shown first in lists and project selectors.

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

- Sidebar label and page title are `Master Prompt`; route remains `/admin/shot-prompt` for compatibility.
- Use tabs or segmented controls for `Scenario`, `Shots` and `Scripts`.
- Each tab shows a prompt list, default badge, editor, `New`, `Save`, `Delete` and `Set default`.
- Built-in defaults are read-only when no DB prompt exists.
- Deleting the current default is blocked until another active prompt in the same type is selected as default.

UX rules:

- Master prompts keep recommended placeholder formats, but helper text must state placeholders are optional and backend still appends structured runtime context.
- `Scenario` is used for scenario analysis, `Shots` for shot-plan generation and `/shots`, and `Scripts` for Script Flow prompt/content generation.
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
