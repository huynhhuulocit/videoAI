# Component Inventory

## 1. App Shell

Components:

- `AppShell`
- `UserDashboardShell`
- `AdminDashboardShell`
- `DashboardSidebar`
- `TopBar`
- `PageHeader`
- `BackButton`
- `Breadcrumbs`
- `ThemeToggle`
- `UserMenu`

Purpose:

- Provide consistent navigation, page structure and role-specific menus.

## 2. Project Components

Components:

- `ProjectCard`
- `ProjectList`
- `ProjectTable`
- `CreateProjectForm`
- `OneClickStartForm`
- `ProjectFlowOptionCard`
- `ProjectStatusBadge`
- `ProjectActivityList`
- `ProjectTabs`

Purpose:

- Support dashboard listing, project creation and project detail navigation.
- Project tables include `Open` plus a compact delete/archive action; deleted projects are removed from active project lists.
- `OneClickStartForm` creates a normal `Scenario` project from setup name/description and opens the guided `/one-click/{projectId}` wizard.
- `ProjectWorkspace` supports a One Click rendering mode that reuses Scenario Story Content, Scenario analysis and Shots components, hides the Scenario dropdown, embeds the Scenario content editor pattern from Scenario create/edit in Step 2, hides all Step 3 shot-plan selection/name UI, separates generated shot cards into Step 4, saves Step 2/Step 3/Step 4 records with setup name/description, and presents one step at a time.

## 3. AI Generation Components

Components:

- `PromptEditor`
- `PromptPreviewDialog`
- `MasterPromptField`
- `ShotPlanner`
- `ShotEditor`
- `ShotAttributeEditor`
- `ShotPromptComposer`
- `ShotMediaUpload`
- `ShotSelector`
- `GeneratedPromptPanel`
- `AIResultPanel`
- `JobProgress`
- `GenerationActionBar`
- `ProviderModelMeta`
- `FinalPromptReview`

Purpose:

- Support scenario flow, product flow, AI output review and user confirmation.
- Let users inspect the composed AI request/prompt payload before starting generation.
- Render visible master prompt editors in the shared cyan prompt surface while ordinary story/script/schema textareas remain neutral.
- Master prompt editors show supported placeholders directly below the textarea as clickable token cards and also provide `{...` autocomplete. The cards/dropdown show token values only; descriptions are available through compact helper icons.
- Let users generate and edit reusable user-owned video shot plans.
- Let users attach reference media to each shot and compose/copy a formatted prompt from shot media, shot attributes and selected template options.
- Media-aware prompt popups show saved media previews and metadata, but prompt copy remains text-only and does not copy image binaries.
- Project shot cards expose per-shot `Prompt`, `Create video`, `Request` and `Response` controls. `Prompt` renders the active admin `Shot` master prompt with exact placeholder replacement for the current shot, `Create video` calls the configured video provider/model with that rendered prompt, and raw request/response popups are scoped to the shot.

## 4. Product Analysis Components

Components:

- `ProductUrlInput`
- `AnalyzeProductButton`
- `ProductFactsPanel`
- `MediaInsightsPanel`
- `GeneratedProductPromptPanel`

Purpose:

- Make product URL analysis understandable and editable before script/video creation.

## 5. Media Upload Components

Components:

- `FileDropzone`
- `MediaPreviewGrid`
- `MediaPreviewCard`
- `VideoPreview`
- `ImagePreview`
- `FileStatusBadge`
- `FileValidationMessage`
- `RemoveMediaButton`

Purpose:

- Support image/video upload, preview, validation and removal.
- In Scenario, media upload is embedded inside each shot card and writes validated media IDs into the shot JSON. Prompt popups that receive media show the saved media preview and metadata from the database-backed media record.
- In Product Flow, media upload remains project-level for product analysis.

## 5.1. Kịch Bản Components

Components:

- `TemplateManager`
- `ScenarioList`
- `TemplateAttributeEditor`
- `TemplateOptionEditor`
- `TemplateSelector`
- `TemplateOptionCheckboxGroup`
- `TemplateSchemaEditor`
- `TemplateSelectionAnalyzer`

Purpose:

- `/templates` renders only the scenario list with add/edit/delete/set-default actions.
- Add and edit navigate to `/templates/new` or `/templates/{templateId}` for the actual editor.
- Let user create AI-assisted or manual video prompt kịch bản/scenarios on the create/edit pages.
- Create/edit pages show the active `Scenario` master prompt in `MasterPromptField`; user edits are temporary for that AI generation request.
- `Generate scenario with AI` displays provider/API failures as readable multi-line inline errors and must not populate fake/sample attributes after failure.
- Scenario create/edit AI action rows render `Prompt`, `Request` and `Response` buttons beside `Generate scenario with AI`; `Prompt` opens exactly the rendered master prompt after placeholder replacement, and `Request`/`Response` open read-only raw provider data returned by the latest generation. These popups include a header copy icon so users can copy the full prompt or raw payload.
- Store scenario attributes/options as JSON through the existing template API.
- Let user edit JSON schema such as `{ "attributes": [{ "id": "mood", "name": "Mood", "description": "Primary feeling.", "options": [{ "id": "mood-friendly", "name": "Friendly", "description": "Warm tone." }] }] }` to parse attributes/options, save it, and delete saved scenarios. Compact text such as `videoPurpose=Storytelling,Commercial;` is still accepted for compatibility.
- Render attributes/options as numbered rows with editable description fields. Option `name` is converted to the processing label/value, while description remains helper text for user understanding.
- Keep helper text in the main `Attribute/option schema` JSON by adding `description` directly to each attribute and option. Legacy `translate`, `label` and `value` fields remain parse-compatible but the editor no longer emits them.
- Let project workspace select multiple options per attribute before prompt generation.
- In the project workspace `Attributes` panel, expose saved Scenario description metadata through compact helper icons on attribute and option rows; hover or click opens the helper popover.
- Let project workspace analyze the current story with AI, auto-select matching scenario options, and save the resulting selection to the project.
- In project workspace, render Story, Scenario and Shots attribute catalogs inside right-column `Attributes` panels that are collapsed by default, wide enough for label/count readability on desktop; individual attribute groups remain collapsible and show selected counts.

## 5.2. Project Shot Plan Components

Components:

- `ProjectWorkspace` shot planner
- `ShotPlanList`
- `RawShotRequestPanel`
- `RawShotResponsePanel`
- `ShotEditor`
- `ShotAttributeEditor`

Purpose:

- Standalone shot-plan list/editor components are no longer user-facing.
- `/shots`, `/shots/new`, and `/shots/{shotPlanId}` redirect to `/projects` for compatibility.
- Project and One Click workspaces own shots generation, JSON/card editing, media attachment, raw Prompt/Request/Response review, and saving through project-scoped APIs.
- Project and One Click workspaces include a sticky top save bar with truncated project title/description and a primary `Save Project` action. That action saves Step 1 Story Content, Step 2 selections, Step 3 Shots result JSON and Step 4 shot card edits in one operation.
- In the project workspace Step 3, show inline feedback directly below `Generate shots`: success when the shot plan is generated and detailed readable errors for AI provider/config/schema failures.
- In the project workspace Step 3, always render `Shots result` below the generation action row. The field is empty until generated shots exist or user pastes JSON; valid JSON edits immediately rebuild the Step 4 shot cards, while invalid JSON shows a readable error and keeps the last valid cards. The workspace does not show a shot-plan selector or shot-plan name field.
- In the project workspace Step 4, render the editable shot cards as a separate collapsible section. Keep add/remove/select, dialogue, generated shot attributes, per-shot admin `Shot Attribute` selection, reference media, per-shot prompt/video actions, and `Save shots` behavior in this section.
- Display `Start state`, `End state` and `Dialogue` attributes returned by shot generation so users can preserve continuity between shots and edit per-shot spoken content.
- In project workspace Step 1, render the active admin-managed `Story Content` master prompt textarea only when Site Config `showUserMasterPrompts=true`; always render the Story Content textarea with counters. Generated content replaces the Story Content textarea and is reused by later steps.
- In project workspace AI action rows that use master prompts, render a `Prompt` button before `Request`; it opens exactly the rendered master prompt after placeholder replacement, with no hidden runtime context appended. Render disabled-until-ready `Request` and `Response` buttons beside `Generate Story Content`, `Analyze scenario`, `Generate shots`, and Product Flow `Analyze`; clicking opens a full read-only JSON popup with the latest raw data for that action. All prompt/raw-data popups include a header copy icon.
- In project workspace Step 2, render the Scenario master prompt textarea only when Site Config `showUserMasterPrompts=true`; keep `Analyze scenario`, `Prompt`, `Request`, and `Response` available when it is hidden.
- In project workspace Step 3, render the active admin-managed `Shots` master prompt in a counter-enabled textarea only when Site Config `showUserMasterPrompts=true`; send edits as a temporary `masterPrompt` override only in that mode. When the setting is false, generation payloads omit `masterPrompt` and the backend uses the active admin default.
- In project workspace Step 3, render only `Shots Attributes` in the right-column attribute area beside the Shots master prompt/generation controls. Scenario options remain managed in Step 2 and can feed `{scenarioAttributes}` when the prompt contains that placeholder.
- In One Click, Step 3 owns Shots generation and `Shots result` JSON; Step 4 owns the editable project-scoped shot cards generated or pasted in the wizard.
- In project workspace shot cards, render shot-level attributes in a right-column collapsed `Attributes` panel with count, add, edit and remove controls, matching the Step 2 scenario attribute panel pattern and desktop width.
- In project workspace shot cards, render shot attribute values as auto-growing multiline textareas so long prompt instructions wrap and expand the card height.
- In project workspace shot cards, video creation errors are shown inline with the same detailed AI job failure format used by Scenario and Shots generation; no fallback video success is displayed when the provider request fails.
- Per-shot prompt composition uses the active admin `Shot` master prompt and renders locally without calling AI. Only explicit placeholders in that prompt are replaced; no structured context block or fallback composer text is appended.

## 6. Admin Config Components

Components:

- `ContentModeToggle`
- `ProviderSelect`
- `ModelSelect`
- `SecretInput`
- `ApiKeyStatus`
- `AiConfigForm`
- `MasterPromptList`
- `MasterPromptEditor`
- `ConfigAuditSummary`

Purpose:

- Allow admin to manage site-wide prompt/video behavior and provider credentials.
- `AiConfigForm` renders `Content mode`, `Site Config`, `Prompt provider/model`, and `Video provider/model` as a single-column set of collapsed sections by default. The form manages prompt/video provider keys, shows `configured`/`missing` status, saves config plus any newly entered keys through the shared `Save configuration` button at the top-right and bottom-right of the form, and tests provider/model connectivity through `POST /api/v1/admin/ai-config/test-connection`.
- `AiConfigForm` also renders a `Site Config` section with `Show master prompts in user workspace`. The default is `No`; when disabled, Project and One Click hide editable master prompt textareas while keeping `Prompt` preview buttons visible.
- `AiConfigForm` renders a read-only `JS DOM detector script` under Site Config > AI Handoff with a `Copy script` action. This lets admins reuse the console helper that exports prompt input and Generate button selectors from an allowlisted AI target page, including `bestSelector`, `.class`-only `classPath`, and `tagClassPath`; the script is not executed by the app and does not change runtime handoff behavior by itself.
- Allow admin to manage `Story Content`, `Scenario`, `Shots`, and `Shot` master prompts from list-only child routes: `/admin/story/master-prompt`, `/admin/scenario/master-prompt`, `/admin/shots/master-prompt`, and `/admin/shot/master-prompt`. `New prompt` opens `/new`; `Edit` opens `/{promptId}`. Built-in rows open `/new?source=built-in` so `Save` creates a persisted prompt instead of editing built-in content. The persisted type key for Story Content remains `scripts` for API compatibility. Prompt content keeps a recommended placeholder format, but placeholders are optional when saving.
- Admin `Master Prompt` content editing uses `MasterPromptField` for both `Prompt content` and the separate `Output Format placeholder` textarea. `{outputFormat}` is inserted only when the prompt content contains that token.
- `MasterPromptConfigManager` renders the admin-only global Master Prompt Config page. It provides a synchronized JSON textarea and visual attribute/option editor.
- `MasterPromptEditor` renders a read/select `Master Prompt Attribute` section in each Story Content, Scenario, Shots, and Shot master prompt editor. The section selects options from the global Master Prompt Config for that prompt record and does not allow editing the global config.
- `MasterPromptEditor` also renders a type-specific admin workflow attribute section below `Master Prompt Attribute`: Story Content shows Story Attribute, Scenario shows Scenario Attribute, Shots shows Shots Attribute, and Shot shows Shot Attribute. The section reads the active catalog for that type and saves the selected options on the prompt record as `workflowAttributeSelection`.
- `MasterPromptEditor` shows Master Prompt Attribute option names only in the selection rows. Attribute and option descriptions are hidden behind helper icons and are not injected into `{masterPromptAttributes}`.
- `MasterPromptEditor` exposes a `Prompt` preview button. It opens a read-only exact preview that replaces admin-owned `{masterPromptAttributes}` from the draft selection, replaces the matching type-specific attribute placeholder when `workflowAttributeSelection` has selected options, and replaces `{outputFormat}` from the draft Output Format textarea. Other user runtime placeholders stay unchanged.
- Admin master prompt editors include `{masterPromptAttributes}` in their placeholder suggestions. User-facing master prompt editors exclude it.

## 7. Admin Log Components

Components:

- `AIRequestLogTable`
- `AIRequestLogFilters`
- `AIRequestLogDetailDrawer`
- `JsonPayloadViewer`
- `RequestStatusBadge`
- `LatencyCell`
- `RequestIdCopyButton`

Purpose:

- Let admin inspect AI request/response history without exposing secrets.

## 8. Shared Feedback Components

Components:

- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `InlineAlert`
- `ConfirmDialog`
- `FeedbackToast`
- `ProgressBar`

Purpose:

- Keep loading, error and empty states consistent across workflows.
- Admin async actions show a compact modern `FeedbackToast` on success or failure and the toast auto-hides after 2 seconds.

## 8.1. Localization Components

Components:

- `LanguageProvider`
- `I18nText`
- `I18nInput`
- `TextareaWithCounter`

Purpose:

- Provide a fixed English UI dictionary.
- Keep common UI labels, navigation, dashboard text and form placeholders typed through shared dictionary keys for future flexibility.
- `TextareaWithCounter` wraps visible admin/user textareas and shows a small character count at the bottom-left. Hidden clipboard helper textareas are excluded.
- When configured with placeholder suggestions, `TextareaWithCounter` opens a token autocomplete after `{...`, supports mouse selection plus Arrow/Enter/Tab keyboard selection, and preserves the normal character counter.

## 8.2. Button Components

Components:

- `Button`
- `LinkButton`

Purpose:

- Use `primary` for blue filled main actions such as Create, Save, Generate and Analyze.
- Use `secondary` for neutral outline supporting actions such as Edit, Set default, Prompt, Request, Response and Back.
- Use `destructive` for explicit delete/archive actions.
- Use `ghost` for neutral icon-only or low-emphasis controls.
- Any button that starts a save, provider test, generate, default, or delete request must disable itself during the request and show a spinner icon while that request is active.
- Admin editor/config forms show prominent primary `Save` buttons at both the top-right and bottom-right of the form.

## 9. Suggested shadcn/ui Base Components

Install or generate these first:

- `button`
- `input`
- `textarea`
- `select`
- `form`
- `dialog`
- `sheet`
- `drawer`
- `dropdown-menu`
- `tabs`
- `badge`
- `card`
- `table`
- `data-table`
- `sidebar`
- `breadcrumb`
- `separator`
- `skeleton`
- `progress`
- `tooltip`
- `switch`
- `sonner`
- `chart`

## 10. Component Rules

- Keep components small and named by product intent.
- Use shadcn/ui as the base layer, then wrap into VideoAI-specific components.
- Keep API calls out of presentational components.
- Keep form validation schemas colocated with form modules or in shared contracts.
- Keep generated prompt/video job state in query hooks or feature-level hooks.

## 11. Attribute Catalog Components

- Admin attribute pages use shared Story, Scenario, Shots, and Shot catalog components.
- The `Attribute` child routes are list-only pages. `New catalog` and `Edit` open dedicated editor routes instead of appending the editor beside the list.
- The editor contains a separate Attribute Generation Prompt textarea, source textarea, JSON textarea, visual attribute/option editor, required checkbox per attribute, and Prompt/Request/Response debug actions next to the AI generation controls.
- Attribute JSON and visual attribute/option rows stay synchronized while editing; the attribute name, description, and `Require` checkbox sit on one row on desktop.
- Attribute Generation Prompt is not a Master Prompt. It only creates catalog JSON.
- Project and One Click use the same attribute selection pattern for Story, Scenario, Shots, and per-shot Shot: required attributes keep one selected option; optional attributes may be empty.
- Master Prompt placeholder autocomplete should list the explicit attribute placeholders for the active prompt type.

## 12. AI Handoff Components

- `AiHandoffInstallCard` appears on the public Home page and owns install/status copy for the Chrome extension.
- The card exposes `Install extension` and `Check installed`; install navigates the current tab to the Chrome Web Store listing to avoid popup blockers, and check uses Chrome external messaging.
- If the Chrome Web Store URL is not configured, the install action is disabled and the card shows local developer-mode guidance: load `apps/chrome-extension/dist` from `chrome://extensions`, reload the extension after each build, then click `Check installed`.
- Admin AI Config stores the AI Handoff prompt selector. The extension popup owns the normal maintenance flow: `Check DOM` captures the live Flow prompt input, saves the selector to Admin config, `Test fill` inserts hardcoded text without clicking Generate, and `Copy selector report` copies debug metadata. The legacy copyable JS DOM detector script remains a manual debugging helper.
- Project Step 4 shot cards include an `AI Handoff` button beside `Prompt` and `Create video`.
- `AI Handoff` uses the same rendered shot prompt as the prompt popup, reads provider/target URL/prompt selector from Admin AI Config, creates a handoff record, sends one message to the extension, and shows inline success/error state.
- If the saved target URL is missing or invalid, the shot card shows a clear configuration error and does not open a fallback URL.
- Extension popup/settings live in `apps/chrome-extension` and show extension status, current target support, and last handoff result.
- No component should expose provider cookies, passwords, API keys, or auto-upload reference media in AI Handoff v1.
