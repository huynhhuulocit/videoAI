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
- `OneClickStartForm` creates a normal `Script Flow` project from setup name/description and opens the guided `/one-click/{projectId}` wizard.
- `ProjectWorkspace` supports a One Click rendering mode that reuses Script Flow Story Content, Scenario analysis and Shots components, hides the Scenario dropdown, embeds the Scenario content editor pattern from Scenario create/edit in Step 2, hides the Step 3 reusable shot-plan selector, saves Step 2/Step 3 records with setup name/description, and presents one step at a time.

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

- Support script flow, product flow, AI output review and user confirmation.
- Let users inspect the composed AI request/prompt payload before starting generation.
- Render visible master prompt editors in the shared cyan prompt surface while ordinary story/script/schema textareas remain neutral.
- Let users generate and edit reusable user-owned video shot plans.
- Let users attach reference media to each shot and compose/copy a formatted prompt from shot media, shot attributes and selected template options.
- Media-aware prompt popups show saved media previews and metadata, but prompt copy remains text-only and does not copy image binaries.
- Project shot cards expose per-shot `Prompt`, `Create video`, `Request` and `Response` controls. `Prompt` uses the shared popup/copy pattern, `Create video` calls the configured video provider/model with the composed shot prompt, and raw request/response popups are scoped to the shot.

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
- In Script Flow, media upload is embedded inside each shot card and writes validated media IDs into the shot JSON. Prompt popups that receive media show the saved media preview and metadata from the database-backed media record.
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
- In project workspace, render the scenario attributes/options inside a right-column `Attributes` panel that is collapsed by default, wide enough for label/count readability on desktop; individual attribute groups remain collapsible and show selected counts.

## 5.2. Scripts Components

Components:

- `ShotsManager`
- `ScriptsList`
- `ShotPlanList`
- `RawShotRequestPanel`
- `RawShotResponsePanel`
- `ShotEditor`
- `ShotAttributeEditor`

Purpose:

- `/shots` renders only the script/shot-plan list with add/edit/delete/set-default actions.
- Add and edit navigate to `/shots/new` or `/shots/{shotPlanId}` for the actual editor.
- Let user create user-owned reusable shot plans from the sidebar `Scripts` menu; the route remains `/shots` for compatibility.
- Do not require project selection when creating shot plans in `/shots/new`.
- Store generated shot JSON through `/shots/generate`.
- Render `Prompt`, `Request` and `Response` buttons beside Generate shots on script create/edit pages. `Prompt` opens the full rendered shot-generation prompt; `Request`/`Response` open read-only raw provider data from the completed job result. These popups include a header copy icon.
- In the project workspace Step 3, show inline feedback directly below `Generate shots`: success when the shot plan is generated and detailed readable errors for AI provider/config/schema failures.
- In the project workspace Step 3, always render `Shots result` below the generation action row. The field is empty until a shot plan exists or user pastes JSON; `Apply JSON` parses edits and rebuilds the shot cards, while `Save shots` persists the applied cards.
- Display `Start state`, `End state` and `Dialogue` attributes returned by shot generation so users can preserve continuity between shots and edit per-shot spoken content.
- Let user edit saved shot plans on `/shots/{shotPlanId}`: plan-level attributes, shot title, description, duration, shot attributes, add/remove shot, add/remove attribute and save through `PATCH /shots/{shotPlanId}`.
- Let any project workspace owned by the same user select saved shot plans for per-shot prompt composition.
- In project workspace Step 1, render the active admin-managed `Story Content` master prompt and Story Content textarea with counters; generated content replaces the Story Content textarea and is reused by later steps.
- In project workspace AI action rows that use master prompts, render a `Prompt` button before `Request`; it opens exactly the rendered master prompt after placeholder replacement, with no hidden runtime context appended. Render disabled-until-ready `Request` and `Response` buttons beside `Generate Story Content`, `Analyze scenario`, `Generate shots`, and Product Flow `Analyze`; clicking opens a full read-only JSON popup with the latest raw data for that action. All prompt/raw-data popups include a header copy icon.
- In project workspace Step 3, render the active admin-managed `Shots` master prompt in a counter-enabled textarea and send edits as a temporary `masterPrompt` override for the next shot-generation request.
- In One Click Step 3, use only project-scoped shot plans generated from the wizard; do not show the reusable Scripts selector.
- In project workspace shot cards, render shot-level attributes in a right-column collapsed `Attributes` panel with count, add, edit and remove controls, matching the Step 2 scenario attribute panel pattern and desktop width.
- In project workspace shot cards, video creation errors are shown inline with the same detailed AI job failure format used by Scenario and Shots generation; no fallback video success is displayed when the provider request fails.
- Per-shot prompt composition uses the legacy composer prompt plus structured shot context and renders locally without calling AI. `{shotAttributes}` and `{planAttributes}` render bracketed rows such as `[Start State]: ...` and `[Voiceover Script]: "..."`.

## 6. Admin Config Components

Components:

- `ContentModeToggle`
- `ProviderSelect`
- `ModelSelect`
- `SecretInput`
- `ApiKeyStatus`
- `AiConfigForm`
- `MasterPromptForm` / legacy export `ShotPromptForm`
- `ConfigAuditSummary`

Purpose:

- Allow admin to manage site-wide prompt/video behavior and provider credentials.
- `AiConfigForm` renders prompt and video provider/model as free-text inputs with suggestion chips. The form manages prompt/video provider keys, shows `configured`/`env`/`missing` status, saves keys through `PUT /api/v1/admin/ai-config/provider-keys/{provider}` and tests provider/model connectivity through `POST /api/v1/admin/ai-config/test-connection`.
- Allow admin to manage `Story Content`, `Scenario` and `Shots` master prompts from child menu routes under `Master Prompt`: `/admin/shot-prompt/story-content`, `/admin/shot-prompt/scenario` and `/admin/shot-prompt/shots`. Selecting a child item shows only that prompt type's CRUD list; `New prompt` and `Edit` open the editor. The persisted type key for Story Content remains `scripts` for API compatibility. Prompt content keeps a recommended placeholder format, but placeholders are optional when saving.
- Admin `Master Prompt` content editing uses `MasterPromptField`.

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
- `Toast`
- `ProgressBar`

Purpose:

- Keep loading, error and empty states consistent across workflows.

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

## 8.2. Button Components

Components:

- `Button`
- `LinkButton`

Purpose:

- Use `primary` for blue filled main actions such as Create, Save, Generate and Analyze.
- Use `secondary` for neutral outline supporting actions such as Edit, Set default, Prompt, Request, Response and Back.
- Use `destructive` for explicit delete/archive actions.
- Use `ghost` for neutral icon-only or low-emphasis controls.

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
