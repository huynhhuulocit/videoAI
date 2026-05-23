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
- Kịch bản

Recommended first screen:

- Header with `Create Project` primary action.
- Recent projects table or grid.
- Recent projects should show the selected project flow when practical.
- Project rows should expose `Open` plus a compact delete/archive action; deleting removes the project from active lists.
- Active jobs panel.
- Small metrics: projects, videos, failed jobs.
- Empty state when no projects exist.

Create Project should open a focused project creation screen where the user selects exactly one starting flow:

- `Scenario` for text, prompt or scenario-first work.
- `Product Flow` for product URL and reference-media-first work.

One Click should open a guided shortcut, not a separate backend flow:

- `/one-click` creates a normal Scenario project from a project name.
- `/one-click/{projectId}` shows one step at a time with `Back` and `Next`.
- Step 1 reuses Story Content generation and raw Prompt/Request/Response debugging, and saves Story Content to the database before moving to the next step.
- Step 2 is a Scenario step: it shows Scenario master prompt, Story Content, the scenario catalog in use, and `Analyze scenario` with `Prompt`/`Request`/`Response`; it does not show a `Choose scenario` dropdown. It reuses the Scenario content editor pattern from Scenario create/edit so the current scenario name, description, schema JSON and attributes/options can be reviewed and saved inline. Successful analysis saves a Scenario with the One Click setup name and description.
- Step 3 reuses Shots master prompt and AI shot generation, including selected scenario attributes when Step 2 analysis has run. User workspaces do not show an existing shot-plan selector or shot-plan name; generated shots are rebuilt from the `Shots result` JSON.
- Step 4 shows the editable shot cards rebuilt from `Shots result` JSON and saves them to the database as project-linked shot records.

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
- The top workspace action bar keeps project title, project description and `Save Project` on one row on desktop. Title and description use single-line truncation with ellipsis when long.
- `Save Project` persists the current workspace state: Story Content, Story/Scenario/Shots attribute selections, Scenario selection when available, and the current synced Shots result/cards.
- Main workspace renders the flow selected during project creation:
  - `Scenario`
  - `Product Flow`
- Kịch bản/scenario selection area above generation actions.
- Right-side or lower activity panel for generation history.

Do not ask the user to choose between Scenario and Product Flow again inside the project detail page unless the product requirement explicitly adds flow switching later.

## 3. Scenario Flow

Recommended layout:

- Step 1 `Story Content` editor.
  - The Scenario card spans the full project workspace width so all steps have the full available content width.
  - The whole step can collapse/expand.
  - Show the admin-managed `Story Content` master prompt textarea above the Story Content textarea only when Admin > AI Config > Site Config has `Show master prompts in user workspace = Yes`. When the setting is `No`, hide the editable textarea and use the active admin default prompt.
  - Visible master prompt editors use the shared cyan prompt surface so they are visually distinct from ordinary story/schema/output textareas.
  - On desktop, `Story Attributes` live in the right-column attribute panel, collapsed by default, with selected-count and attribute-count badges visible before expanding.
  - When a Scenario or One Click project is opened, load the latest saved database Story Content into the Story Content textarea before the user edits it.
  - The `Story Content` textarea is the source of truth for later Scenario analysis, Shots generation, per-shot prompt composition and Script creation.
  - Clicking `Generate Story Content` sends a temporary master prompt override only when the Site Config setting is `Yes`; when it is `No`, the frontend omits `masterPrompt`. The returned content replaces the Story Content textarea and becomes the source for following steps.
  - Story Content generation is a real AI provider request. If it fails, show the readable failure details directly under the button, including stable error code, provider/model when available, env/status hints when relevant and job ID. Do not show fallback sample content in the user workspace.
  - Show a `Prompt` button before `Request` next to `Generate Story Content`; it opens a read-only popup containing exactly the master prompt after optional placeholder replacement. Runtime data appears only through placeholders present in the prompt.
  - Show `Request` and `Response` buttons next to `Generate Story Content`; they stay disabled until the latest AI run returns raw data and open a full read-only popup for inspection.
  - Include a prompt preview icon above the Story Content editor to inspect the composed AI request before submission.
- Step 2 `Kịch bản tạo prompt` selector with attribute/option checkboxes.
  - The Scenario card spans the full project workspace width so Step 2 and Step 3 have the full available content width.
  - The whole step can collapse/expand.
  - The admin-managed scenario analysis master prompt textarea is shown only when Site Config `Show master prompts in user workspace = Yes`; when hidden, analysis uses the active admin default prompt.
  - The visible Scenario master prompt uses the shared cyan prompt surface.
  - `Analyze scenario` and `Save selection` actions appear in the prompt/content action area before the attribute/option catalog. If the master prompt textarea is hidden by Site Config, this action row still appears with `Prompt`, `Request`, and `Response`.
  - Show a `Prompt` button before `Request` next to `Analyze scenario`; it opens a read-only popup containing exactly the Scenario master prompt after optional `{story}`/`{attributes}` replacement.
  - Show `Request` and `Response` buttons next to `Analyze scenario`; they stay disabled until the latest AI run returns raw data and open a full read-only popup for inspection.
  - On desktop, the attribute/option catalog lives in a right-column `Attributes` panel; the master prompt, actions and AI error/result feedback stay in the left content column. The panel should be wide enough for Vietnamese labels and selected-count badges without cramped wrapping, about `380px` on wide desktop.
  - The `Attributes` panel is collapsed by default, and each attribute group inside it can also collapse/expand while keeping the selected option count visible.
  - Attribute and option rows that have saved Scenario description metadata show a compact helper icon. Hovering or clicking the icon opens a small popover with the saved description without toggling the row selection/collapse state.
- AI scenario analysis action combines the active Scenario master prompt, Step 1 Story Content and selected Kịch bản attribute/option catalog, auto-selects matching options, and saves that selection to the project. A temporary prompt override is sent only when Site Config allows user-visible master prompts.
- Manual `Save selection` action for edited Kịch bản checkboxes so project reloads keep the same option selection.
- Step 3 `Shots tạo prompt` planner below Kịch bản:
  - The whole step can collapse/expand.
  - Step 3 uses the Story Content entered or generated in Step 1 as the source content for shot generation.
  - Generate shots from current final content or prompt input through the AI-backed `shot_generation` job.
  - Include the currently selected Step 2 scenario attributes/options in the shot-generation request as compact plan attributes.
  - Display the admin-managed `Shots` master prompt in an editable textarea before the generate action only when Site Config `Show master prompts in user workspace = Yes`. Edits are temporary for the current generation and do not overwrite the admin default.
  - The visible Shots master prompt uses the shared cyan prompt surface.
  - On desktop, `Shots Attributes` live in the right-column attribute panel beside the Shots master prompt and generation controls.
  - The Step 3 right-column `Shots Attributes` panel is collapsed by default, keeps selected-count and attribute-count badges visible, and expands only when the user needs to review or adjust options for `{shotsAttributes}`. Scenario options are controlled in Step 2 and can still feed `{scenarioAttributes}` when the prompt contains that placeholder.
  - Send the temporary `Shots` master prompt override only when the Site Config setting is `Yes`; when `No`, omit `masterPrompt` and let the backend use the active admin default.
  - Show a `Prompt` button before `Request` next to `Generate shots`; it opens a read-only popup containing exactly the Shots master prompt after optional `{story}`/`{attributes}`/`{scenarioAttributes}`/`{shotsAttributes}` replacement.
  - Show `Request` and `Response` buttons next to `Generate shots`; they stay disabled until the latest AI run returns raw data and open a full read-only popup before the normalized editable cards are reviewed.
  - `Generate shots` shows an inline success notice when shots are created and a detailed multi-line error notice when provider/config/schema failures occur. Error details include the stable code, provider/model/status/env hints and job ID when the backend returns them.
  - Always show `Shots result` directly below the generate action row. It contains the normalized shots JSON used to build the editable shot cards when available, or stays empty until user generates/pastes JSON. User edits to valid JSON immediately rebuild the cards; invalid JSON leaves the last valid cards in place and shows a readable error. `Save shots` persists the synced shots.
  - Do not show a shot-plan selector or shot-plan name field in Project or One Click. The backend may keep a project-linked persistence record, but user editing is driven by `Shots result` JSON plus the shot cards.
- Step 4 `Shots` cards:
  - The whole step can collapse/expand independently from Step 3.
  - Step 4 shows the editable shot cards rebuilt from `Shots result` JSON.
  - Edit, add, remove and select shots before prompt generation.
  - Each shot card includes a dedicated dialogue/voiceover textarea backed by the `Dialogue` shot attribute.
  - Each shot card renders shot-level attributes in its own right-column `Attributes` panel, matching the Step 2 pattern and desktop width; the panel is collapsed by default, keeps the attribute count visible, and contains add/edit/remove controls.
  - Shot attribute value fields use auto-growing multiline textareas so long values wrap naturally instead of being clipped in a one-line input.
  - Reference media upload is inside each shot card, not a global Scenario upload block.
  - Shot prompt composition uses only the media attached to that shot.
  - Each shot can locally compose a formatted prompt from the active admin `Shot` master prompt, the current shot fields, generated shot attributes, per-shot `Shot Attribute` selections, and reference media only when the prompt contains the matching placeholders.
  - Each shot card shows `Prompt`, `Create video`, `Request` and `Response` actions. `Prompt` opens the shared read-only popup with copy support. `Create video` submits the rendered Shot master prompt to the configured video provider/model, then enables raw request/response popups for that shot.
  - Video creation failures must show a readable inline error on the shot card with provider/model, error code, HTTP status/env hint and job ID when available. The UI must not show fake successful video data when the provider fails.
- Compact status/error feedback inside the Scenario workspace. Do not show the `AI suggested content` panel for this per-shot prompt composer path.
- Scenario analysis failures must show an inline, user-readable error directly below `Analyze scenario`, including the stable error code, provider/model when available, env/status hints when relevant and the job ID for admin lookup. Do not expose API keys; successful raw request/response is available through the adjacent read-only popup buttons and Admin > AI Logs.

States:

- Empty input.
- Media uploading.
- Generate queued.
- Generate processing.
- Generate succeeded.
- Generate failed.
- Final prompt edited.
- Shots generated, edited through JSON/cards, and saved.
- Shot prompt composed and copied.

UX rule:

- User must clearly see which content is final before creating script or video.
- AI-generated final content should be readable in the editor with line breaks and numbered sections. Step 4 per-shot prompt data enters the final prompt only through explicit `Shot` master prompt placeholders such as `{shotGeneratedAttributes}`, `{shotAttributes}`, `{shotDialogue}`, and `{referenceMedia}`.
- The prompt preview popup must be read-only and show the current user text, selected shot media IDs, selected shots, selected template options and the composed instruction preview without calling AI.
- In the Step 4 per-shot prompt path, `Prompt` does not call AI and opens a complete, readable prompt in the shared popup.

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

## 4.2. Standalone Shot Plan Routes

- The user sidebar no longer exposes `Scripts`.
- `/shots`, `/shots/new`, and `/shots/{shotPlanId}` redirect to `/projects`.
- Shot-plan generation and editing remain inside Project and One Click workspaces so those workflows are not affected.

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
- Master Prompt Config.
- Master Prompt.
- AI Logs.

## 7. Admin AI Config

Recommended layout:

- AI Config uses a single-column list of collapsed sections by default. `Save configuration` appears at the top-right and bottom-right of the form and persists config plus any newly entered API keys. There is no separate `Save key` action.
- Content mode section:
  - `Create Script`
  - `Create Video`
- Site Config section:
  - `Show master prompts in user workspace` Yes/No selector.
- Prompt provider/model section:
  - Provider free-text input with provider suggestion chips.
  - Model free-text input with provider-aware suggestion chips.
  - Secret input for prompt provider key.
  - Key status and `Test connect` action.
- Video provider/model/key section:
  - Provider free-text input with provider suggestion chips.
  - Model free-text input with provider-aware suggestion chips.
  - Secret input.
  - Key status.
  - `Test connect` action.
- Audit summary panel.

UX rules:

- API key is never shown after save.
- Key status distinguishes saved key and missing key. Runtime does not use env fallback keys.
- Admin can type an arbitrary provider/model; suggestions are helpers, not limits.
- Save buttons are primary, visually prominent and appear at both the top-right and bottom-right of admin editor/config forms.
- Async admin buttons disable during processing and show a spinner on the active button.
- Save, test, generate, default and delete actions show a compact success/error popup that auto-hides after 2 seconds.
- Missing config blocks user generation with actionable admin-facing error.

## 8. Admin Master Prompt

Recommended layout:

- Sidebar groups are `Story`, `Scenario`, `Shots`, and `Shot`; each group exposes a `Master Prompt` child route. `Shots` is Step 3 batch shot-list generation; `Shot` is Step 4 per-shot final prompt creation. `/admin/shot-prompt` remains a compatibility redirect.
- The underlying API type key for Story Content remains `scripts`.
- Child list routes are `/admin/story/master-prompt`, `/admin/scenario/master-prompt`, `/admin/shots/master-prompt`, and `/admin/shot/master-prompt`; the active parent and active child must be visually highlighted.
- Clicking a child menu item shows only that prompt type's list in CRUD format. `New prompt` opens `/new`; `Edit` opens `/{promptId}`. Built-in rows open `/new?source=built-in` as editable copies.
- Each child list shows prompt rows with default/built-in badges plus `Edit`, `Set default` and `Delete`; the editor contains `Save`, `Delete` and `Set default` for the open prompt.
- Master Prompt editor pages keep primary `Save` actions at the top-right and bottom-right. The action rows use loading spinners and auto-hiding success/error popups for save/default/delete failures or completion.
- Master Prompt editor pages show two admin-only selection areas under the prompt text: the global `Master Prompt Attribute` section and a type-specific Attribute section. Story Content editors show Story Attribute, Scenario editors show Scenario Attribute, Shots editors show Shots Attribute, and Shot editors show Shot Attribute.
- Built-in defaults are read-only when no DB prompt exists.
- Deleting the current default is blocked until another active prompt in the same type is selected as default.

UX rules:

- Master prompts keep recommended placeholder formats, but helper text must state placeholders are optional and runtime data is included only through placeholders in the prompt.
- Each Story Content, Scenario, Shots, and Shot master prompt editor includes a separate `Output Format placeholder` textarea. The editor suggests `{outputFormat}` for that prompt type, and the Prompt preview renders it from this field only when the prompt content contains `{outputFormat}`.
- Master prompt textareas expose supported placeholder tokens directly below the editor and provide autocomplete when the user types `{...`; click, Enter or Tab inserts the selected token. Placeholder descriptions stay behind helper icons so the list remains compact.
- Master prompt editors include a `Prompt` button that previews the exact draft. It replaces admin-owned `{masterPromptAttributes}` from the saved/draft selection, replaces the matching type-specific attribute placeholder when workflow attribute selections exist, and replaces `{outputFormat}` from the Output Format field, then leaves other user runtime placeholders unchanged.
- `Story Content` is used for Step 1 content expansion in Project and One Click, `Scenario` is used for scenario analysis, and `Shots` is used for shot-plan generation inside Project and One Click.
- Every visible textarea in admin and user workflows shows a small muted character count at the bottom-left. Hidden clipboard helper textareas are excluded.

## 8.1. Admin Master Prompt Config

Recommended layout:

- `Master Prompt Config` appears under the AI admin area.
- The page shows one synchronized JSON textarea and visual editor for admin-only prompt-authoring attributes.
- Each attribute has a name, description, and options. Each option has a name and description.
- Story Content, Scenario, Shots, and Shot master prompt editors show a read/select `Master Prompt Attribute` section below the prompt content.
- The selection section is read/select only; editing the global config happens only on `/admin/master-prompt-config`.
- Helper icons show attribute and option descriptions so admin users understand each option. The visible selection rows and `{masterPromptAttributes}` render only attribute/option names, not descriptions.

UX rules:

- `{masterPromptAttributes}` is available only in admin master prompt placeholder suggestions.
- User Project and One Click screens must not show the Master Prompt Attribute selector.
- User placeholder suggestions must not include `{masterPromptAttributes}`.
- Runtime sends Master Prompt Config data only when the active admin master prompt contains `{masterPromptAttributes}`.

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

## 12. Attribute Catalog UX

- Admin sidebar groups Story, Scenario, Shots, and Shot as section labels, not links. Active child pages need visible selected styling.
- Attribute pages for Story, Scenario, Shots, and Shot are list-only at the child menu route; create and edit open dedicated routes for the selected type.
- Attribute editors for Story, Scenario, Shots, and Shot share the same JSON editor, visual editor, AI generation prompt, Prompt, Request, and Response layout.
- Prompt, Request, and Response controls belong beside the generation action, not in the editor header.
- Attribute editor textareas must remain full-width with stable counter placement on desktop and narrow layouts.
- Required attributes use a clear checkbox in admin and a clear `Required` badge in user selection panels.
- In user workflows, required attributes should auto-select the first option on load and should not visually allow clearing every option.
- Scenario creation/editing is admin-only; user workflows should show the active admin Scenario catalog, not a user scenario dropdown.

## 13. AI Handoff UX

- Public Home should present AI Handoff as an optional extension-assisted workflow, not as a replacement for provider APIs.
- Copy must say `Install from Chrome Web Store` or equivalent; do not imply a website can directly install the extension.
- The safety copy must explain that the extension only runs after user click, transfers prompt text, and keeps media upload manual in v1.
- Step 4 shot cards place `AI Handoff` beside `Prompt` and `Create video` so users can choose between manual prompt copy, API video generation, and browser handoff.
- The target URL and prompt selector used by the extension come from Admin > AI Config. If either value is blank or invalid, the shot card should show a clear missing/invalid configuration message and must not open a hardcoded fallback or use a fallback selector.
- Extension popup `Check DOM` captures the live Flow prompt input selector, and `Test fill` inserts hardcoded text without clicking Generate so admins can validate selector changes safely.
- Handoff failures should be specific: extension missing, target not logged in, selector missing/layout changed, generate disabled, or target origin not allowlisted.
- Handoff progress is per shot and should not block editing other shots.
