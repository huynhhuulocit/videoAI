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
- `ProjectFlowOptionCard`
- `ProjectStatusBadge`
- `ProjectActivityList`
- `ProjectTabs`

Purpose:

- Support dashboard listing, project creation and project detail navigation.
- Project tables include `Open` plus a compact delete/archive action; deleted projects are removed from active project lists.

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
- In Script Flow, media upload is embedded inside each shot card and writes validated media IDs into the shot JSON.
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
- Scenario create/edit AI action rows render `Prompt`, `Request` and `Response` buttons beside `Generate scenario with AI`; `Prompt` opens the fully rendered prompt with placeholder replacement plus runtime context, and `Request`/`Response` open read-only raw provider data returned by the latest generation.
- Store scenario attributes/options as JSON through the existing template API.
- Let user paste compact schema text such as `videoPurpose=Storytelling,Commercial;` or compatible JSON to parse attributes/options, save it, and delete saved scenarios. Compact text may include optional human-readable notes with `attributeKey | Vietnamese | description = option | Vietnamese | description`; JSON may include `description`, `vietnamese`, `translation`, `explanation` or `detail`.
- Render attributes/options as numbered rows with compact read-only Vietnamese/explanation notes. English labels/values remain the processing data; Vietnamese notes are for user understanding only.
- Provide a `Vietnamese translate JSON` textarea that builds JSON keyed by `attributeId` and `optionId`, then applies edited translate/description values back into attribute/option descriptions. Once the current JSON has already been applied and no description changes remain, the apply action is disabled.
- Let project workspace select multiple options per attribute before prompt generation.
- In the project workspace `Attributes` panel, expose saved Scenario translate/description metadata through compact helper icons on attribute and option rows; hover or click opens the helper popover.
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
- Render `Prompt`, `Request` and `Response` buttons beside Generate shots on script create/edit pages. `Prompt` opens the full rendered shot-generation prompt; `Request`/`Response` open read-only raw provider data from the completed job result.
- In the project workspace Step 3, show inline feedback directly below `Generate shots`: success when the shot plan is generated and detailed readable errors for AI provider/config/schema failures.
- Display `Start state`, `End state` and `Dialogue` attributes returned by shot generation so users can preserve continuity between shots and edit per-shot spoken content.
- Let user edit saved shot plans on `/shots/{shotPlanId}`: plan-level attributes, shot title, description, duration, shot attributes, add/remove shot, add/remove attribute and save through `PATCH /shots/{shotPlanId}`.
- Let any project workspace owned by the same user select saved shot plans for per-shot prompt composition.
- In project workspace Step 1, render the active admin-managed `Scripts`/Story Content master prompt and Story Content textarea with counters; generated content replaces the Story Content textarea and is reused by later steps.
- In project workspace AI action rows that use master prompts, render a `Prompt` button before `Request`; it opens the fully rendered prompt after placeholder replacement and appended runtime context. Render disabled-until-ready `Request` and `Response` buttons beside `Generate Story Content`, `Analyze scenario`, `Generate shots`, and Product Flow `Analyze`; clicking opens a full read-only JSON popup with the latest raw data for that action.
- In project workspace Step 3, render the active admin-managed `Shots` master prompt in a counter-enabled textarea and send edits as a temporary `masterPrompt` override for the next shot-generation request.
- In project workspace shot cards, render shot-level attributes in a right-column collapsed `Attributes` panel with count, add, edit and remove controls, matching the Step 2 scenario attribute panel pattern and desktop width.
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
- Allow admin to manage `Scenario`, `Shots` and `Scripts` master prompts with list, editor, default badge, create, save, delete and set-default controls. Prompt content keeps a recommended placeholder format, but placeholders are optional when saving.
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
