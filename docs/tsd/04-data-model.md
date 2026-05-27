# 04 - Data Model

## 1. Database Strategy

Use PostgreSQL as the primary database.

Initial deployment:

- One PostgreSQL cluster.
- Separate schema per service.
- Separate Prisma schema and migrations per service.
- Current local implementation uses one root Prisma schema at `prisma/schema.prisma` with service-owned PostgreSQL schemas. Formal per-service migrations remain a follow-up.
- Local PostgreSQL runs on `localhost:55432` to avoid conflicts with other local projects.

Future deployment:

- Move high-volume services to separate physical databases only when scaling or compliance requires it.

## 2. Schemas

Recommended schemas:

- `auth`: Auth.js tables and credentials/session data.
- `users`: application user profile and role data.
- `projects`: project ownership and project metadata.
- `media`: uploaded media metadata.
- `content`: prompts, scripts and generated content references.
- `config`: site-wide AI configuration and encrypted provider keys.
- `video`: video generation requests and final artifacts.
- `ai_logs`: AI request/response logs.
- `jobs`: optional job status read model if BullMQ status alone is not enough.

## 3. Core Tables

### 3.1. `users.user_profiles`

Purpose: application profile mapped to Auth.js user.

Fields:

- `id`
- `auth_user_id`
- `username`
- `email`
- `password_hash`
- `display_name`
- `role`: `user` or `admin`
- `status`: `active`, `disabled`
- `created_at`
- `updated_at`

Indexes:

- Unique index on `auth_user_id`.
- Unique index on `username`.
- Unique index on `email`.
- Index on `role`.

Local phase:

- Seed credentials live in PostgreSQL, not source code:
  - `user` / `User@123`
  - `admin` / `Admin@123`
- Password hashes use a server-side password hashing helper and are never stored as plain text.

### 3.2. `projects.projects`

Purpose: user-owned project records.

Fields:

- `id`
- `owner_user_id`
- `name`
- `description`
- `flow_type`: `script` or `product`
- `template_selection`: nullable JSONB storing the project-level Kịch bản/scenario option selection selected manually or by AI analysis
- `scenario_result`: nullable text storing the editable Step 2 Scenario result used by Step 3 `{scenario}` rendering
- `status`
- `created_at`
- `updated_at`

Indexes:

- Index on `owner_user_id`.
- Index on `(owner_user_id, created_at)`.

### 3.3. `media.media_assets`

Purpose: metadata for uploaded image/video files.

Fields:

- `id`
- `owner_user_id`
- `project_id`
- `storage_provider`: `local`, `s3`, `r2`, `minio`
- `storage_key`
- `original_filename`
- `mime_type`
- `media_type`: `image`, `video`
- `size_bytes`
- `duration_seconds`
- `width`
- `height`
- `status`: `uploaded`, `validated`, `rejected`, `deleted`
- `validation_error`
- `created_at`
- `updated_at`

Indexes:

- Index on `project_id`.
- Index on `(owner_user_id, created_at)`.
- Index on `status`.

### 3.4. `content.prompts`

Purpose: generated or user-edited prompts.

Fields:

- `id`
- `project_id`
- `owner_user_id`
- `source_type`: `script_flow`, `product_flow`, `story_content`
- `input_text`
- `product_url`
- `media_asset_ids`
- `generated_prompt`
- `final_prompt`
- `provider`
- `model`
- `status`
- `created_at`
- `updated_at`

Use JSONB for:

- Provider-specific metadata.
- Parsed product attributes.
- Media analysis summary.

Rules:

- `script_flow` rows store AI-generated Story Content from the provider workflow.
- `story_content` rows store manually edited One Click Story Content without calling a provider; `input_text` and `generated_prompt` contain the same persisted user text so later One Click steps can reload the database-backed Story Content.

### 3.5. `content.scripts`

Purpose: scripts created from final prompt/user text.

Fields:

- `id`
- `project_id`
- `prompt_id`
- `owner_user_id`
- `script_text`
- `provider`
- `model`
- `status`
- `created_at`
- `updated_at`

### 3.5.1. `content.video_templates`

Purpose: user-owned template definitions used to structure prompt generation.

Fields:

- `id`
- `owner_user_id`
- `name`
- `description`
- `idea`
- `attributes`: JSONB list of attribute/option definitions
- `is_default`: legacy compatibility flag; user-facing Scenario default selection is removed
- `status`: `active`, `archived`
- `created_at`
- `updated_at`

JSON shape:

```json
[
  {
    "id": "mood",
    "name": "Mood",
    "description": "Primary feeling of the video.",
    "options": [
      {
        "id": "mood-warm",
        "name": "Warm",
        "description": "Warm and friendly tone."
      }
    ]
  }
]
```

Rules:

- Template JSON is stored in PostgreSQL and must not be source-code sample data.
- User can add attributes and options manually.
- AI-generated template drafts use the same JSON shape.
- Scenario editor JSON uses compact option `name`; the API stores it internally as option `label`/`value` for existing prompt-processing compatibility.
- Attribute and option `description` values are user-facing helper text and stay synchronized between the JSON textarea and visual editor fields.
- A project generation request can select multiple options per attribute.
- Template selections used for prompt generation should be persisted in AI request payload and prompt provider metadata.
- Scenario lists are ordered by latest update. One Click Step 2 can save an AI-analyzed scenario using the One Click setup name and description.

### 3.5.2. `content.video_shot_plans`

Purpose: user-owned reusable shot plans generated from story or Scenario content.

Fields:

- `id`
- `owner_user_id`
- `project_id`: nullable legacy/source project reference; user-level shot plans use `null`
- `name`
- `description`: optional user-facing description; One Click Step 3 stores the One Click setup description here
- `source_text`
- `duration_seconds`: default project shot duration, 1-8 seconds
- `attributes`: JSONB list of plan-level attributes applied to every shot in the plan
- `shots`: JSONB list of shot definitions
- `is_default`: legacy compatibility flag; user-facing standalone shot-plan default selection is removed
- `status`: `active`, `archived`
- `created_at`
- `updated_at`

JSON shape:

```json
[
  {
    "id": "shot_001",
    "title": "Shot 1: Hook",
    "description": "Open with a clear product close-up.",
    "durationSeconds": 8,
    "mediaIds": ["media_001"],
    "attributes": [
      {
        "id": "camera",
        "name": "Camera",
        "value": "Stable close-up"
      }
    ],
    "attributeSelection": {
      "catalogId": "shot_catalog_default",
      "catalogName": "Default Shot attributes",
      "type": "shot",
      "attributes": [
        {
          "id": "visual-emphasis",
          "name": "Visual emphasis",
          "required": true,
          "options": [
            {
              "id": "visual-emphasis-character",
              "name": "Character focus"
            }
          ]
        }
      ]
    }
  }
]
```

Rules:

- Shot plans are reusable within the owning user account; any active project owned by the same user can select them.
- Existing project-linked shot plans remain readable and editable by the owner.
- A shot duration must be between 1 and 8 seconds to match current Veo constraints.
- User can edit plan-level attributes; those attributes are saved with the shot plan and included when the plan is selected for prompt composition.
- User can edit shots, add/remove shots, edit generated shot attributes, and select admin-defined per-shot `attributeSelection` from the active `Shot Attribute` catalog.
- Each shot can store `mediaIds` so Scenario prompts can use media references scoped to that shot.

### 3.6. `config.master_prompts`

Purpose: admin-managed Story Content, Scenario, Shots, and Shot master prompts.

Fields:

- `id`
- `type`: `scripts`, `scenario`, `shots`, or `shot`
- `name`
- `content`
- `attribute_selection`: nullable JSONB storing the admin-selected Master Prompt Config options for that prompt
- `workflow_attribute_selection`: nullable JSONB storing admin-selected options from the active Story, Scenario, Shots, or Shot Attribute catalog for that prompt
- `is_default`
- `status`
- `created_by_admin_id`
- `created_at`
- `updated_at`

Rules:

- `attribute_selection` is admin-only. It is not editable from user Project or One Click screens.
- `workflow_attribute_selection` is admin-only prompt-authoring metadata. Story Content prompts use the active Story Attribute catalog, Scenario prompts use the active Scenario Attribute catalog, Shots prompts use the active Shots Attribute catalog, and Shot prompts use the active Shot Attribute catalog.
- Runtime uses `attribute_selection` only when the prompt content contains `{masterPromptAttributes}`.
- Temporary user prompt overrides are not allowed to use `{masterPromptAttributes}`.

### 3.7. `config.master_prompt_attribute_configs`

Purpose: one global admin-only attribute/option set for master prompt authors.

Fields:

- `id`
- `attributes`: JSONB list of prompt-authoring attributes and options
- `created_by_admin_id`
- `created_at`
- `updated_at`

JSON shape:

```json
[
  {
    "id": "tone",
    "name": "Tone",
    "description": "Prompt authoring tone.",
    "options": [
      {
        "id": "tone-cinematic",
        "name": "Cinematic",
        "description": "Use cinematic, vivid wording."
      }
    ]
  }
]
```

Rules:

- This config is shared by Story Content, Scenario, Shots, and Shot master prompts.
- The config is admin-only and must not appear as a selectable user workflow attribute.
- The config is separate from Story, Scenario, Shots, and Shot workflow Attribute catalogs.
- Shot selections used for prompt generation should be persisted in AI request payload and prompt provider metadata.

### 3.6. `config.ai_site_configs`

Purpose: current site-wide AI behavior.

Fields:

- `id`
- `content_mode`: `script` or `video`
- `show_user_master_prompts`: boolean, default `false`; controls whether user Project/One Click workspaces show editable Story Content, Scenario, Shots and Shot master prompt fields
- `ai_handoff_provider`: adapter key such as `google-flow-veo`; seeded from `AI_HANDOFF_PROVIDER`
- `ai_handoff_target_url`: nullable target URL opened by the extension; seeded from `AI_HANDOFF_TARGET_URL`
- `ai_handoff_prompt_selector`: nullable CSS selector captured by the extension `Check DOM` flow and used to fill the target prompt input
- `prompt_provider`
- `prompt_model`
- `shot_generation_prompt`: nullable legacy admin-managed prompt for `shot_generation`; new CRUD uses `config.master_prompts`
- `shot_composer_prompt`: nullable legacy local prompt template column; Step 4 now uses `config.master_prompts` type `shot` instead
- `template_selection_prompt`: nullable legacy master prompt for `template_selection`; new CRUD uses `config.master_prompts`
- `video_provider`
- `video_model`
- `is_active`
- `created_by_admin_id`
- `created_at`
- `updated_at`

Rules:

- Only one active config should exist at a time.
- `shot_generation_prompt` and `template_selection_prompt` remain read-compatibility columns during migration to `config.master_prompts`; runtime AI requests do not use them as fallback.
- Runtime master prompts keep a recommended placeholder format, but placeholder replacement is optional compatibility; backend does not append hidden runtime context to the selected prompt.
- When `show_user_master_prompts` is `false`, user-facing generation requests must not accept temporary `masterPrompt` overrides. Runtime uses the active admin default prompt while prompt preview buttons may still show the rendered prompt.
- AI Handoff target config is saved here by Admin > AI Config. Runtime uses the saved provider, target URL, and prompt selector only; if `ai_handoff_target_url` or `ai_handoff_prompt_selector` is blank, Step 4 handoff fails clearly instead of opening a fallback target or using fallback selectors.
- `ai_select_attribute_text` and `user_select_attribute_text` are site-wide text prefixes used when rendering workflow attribute placeholders. Empty strings are stored as empty strings and do not trigger fallback copy.
- Config updates should create audit records.

### 3.7. `config.master_prompts`

Purpose: admin-managed master prompts grouped by workflow type.

Fields:

- `id`
- `type`: `scenario`, `shots`, `scripts` or `shot`
- `name`
- `content`: master prompt instructions, usually with the recommended placeholder format
- `output_format`: optional instructions inserted only when `content` contains `{outputFormat}`
- `is_default`
- `status`: `active`, `archived`
- `created_by_admin_id`
- `created_at`
- `updated_at`

Indexes:

- Index on `(type, status)`.
- Index on `(type, is_default)`.

Rules:

- Admin CRUD for master prompts writes this table, not the legacy prompt columns in `config.ai_site_configs`.
- Exactly one active default prompt should be selected per `type`.
- Deleting/archiving the current default is blocked until another active prompt of the same type is set as default.
- If no active prompt exists for a type, runtime AI requests fail with `AI_CONFIG_MISSING`. Built-in prompt text is setup guidance only, not runtime fallback.
- Prompt content is required but placeholders are optional.
- Recommended placeholders by type: `scripts`/`Story Content` uses `{storyContent}`, `{storyAttributes}`, `{outputFormat}`; `scenario` uses `{story}`, `{attributes}`, `{scenarioAttributes}`, `{outputFormat}`; `shots` uses `{story}`, `{scenario}`, `{attributes}`, `{scenarioAttributes}`, `{shotsAttributes}`, `{outputFormat}`; `shot` uses `{storyContent}`, `{shotTitle}`, `{shotDescription}`, `{shotDialogue}`, `{shotDuration}`, `{shotGeneratedAttributes}`, `{shotAttributes}`, `{referenceMedia}`, `{outputFormat}`.
- If `content` contains `{outputFormat}`, `output_format` is required for save/preview/runtime. The backend must fail clearly when it is missing instead of substituting fallback output instructions.

### 3.8. `config.ai_provider_keys`

Purpose: encrypted AI provider credentials.

Fields:

- `id`
- `provider`
- `encrypted_key`
- `key_status`: `configured`, `revoked`
- `created_by_admin_id`
- `rotated_at`
- `created_at`
- `updated_at`

Rules:

- Never store plain text API keys.
- Never return `encrypted_key` to clients.
- A provider key can be used by either prompt or video workflows when the active config references that provider.
- If no decryptable saved key exists, runtime AI requests fail with `AI_CONFIG_MISSING`. Environment API keys are not runtime fallback sources.

### 3.9. `video.video_generations`

Purpose: video generation lifecycle.

Fields:

- `id`
- `project_id`
- `owner_user_id`
- `prompt_id`
- `script_id`
- `provider`
- `model`
- `status`: `queued`, `processing`, `succeeded`, `failed`, `cancelled`
- `job_id`
- `output_media_asset_id`
- `error_code`
- `error_message`
- `created_at`
- `updated_at`
- `completed_at`

Indexes:

- Index on `project_id`.
- Index on `(owner_user_id, created_at)`.
- Index on `status`.
- Unique index on `job_id` when present.

### 3.10. `ai_logs.ai_request_logs`

Purpose: request log before provider submission.

Fields:

- `id`
- `request_id`
- `actor_user_id`
- `actor_role`
- `project_id`
- `flow_type`
- `provider`
- `model`
- `request_payload`
- `media_references`
- `status`: `pending`, `success`, `failed`
- `created_at`
- `completed_at`

Use JSONB for:

- `request_payload`
- `media_references`

### 3.11. `ai_logs.ai_response_logs`

Purpose: response/error details after provider completion.

Fields:

- `id`
- `request_log_id`
- `response_payload`
- `error_code`
- `error_message`
- `latency_ms`
- `token_usage`
- `cost_estimate`
- `created_at`

Use JSONB for:

- `response_payload`
- `token_usage`
- `cost_estimate`

### 3.12. `jobs.job_statuses`

Purpose: database-backed job status read model for prompt, product, media, script and video operations.

Fields:

- `job_id`
- `type`: `prompt_generation`, `product_analysis`, `media_analysis`, `script_generation`, `video_generation`, `template_generation`, `template_selection`, `shot_generation`
- `status`: `queued`, `processing`, `succeeded`, `failed`, `cancelled`
- `progress`
- `result`
- `error`
- `created_at`
- `updated_at`

Use JSONB for:

- `result`
- `error`

Rules:

- The frontend must poll this database-backed read model through the API Gateway.
- Current local implementation writes job state directly to PostgreSQL. BullMQ can later update the same read model from workers.

## 4. Current Local Persistence Rule

The current implementation must not use source-code sample arrays, process-local stores or browser-generated IDs as authoritative application data.

Database-backed records are required for:

- Auth user profiles and credentials.
- Projects and selected project flow.
- Media metadata, validation status and media IDs.
- AI config and provider-key status.
- AI request and response logs.
- Prompt and product analysis results.
- Script records.
- Video templates and template attribute/option JSON.
- Template selections stored with project metadata and prompt request/log metadata.
- Video shot plans and shot JSON.
- Shot selections stored with prompt request/log metadata.
- Video generation records.
- Job status.

## 5. Auth.js Tables

Use Auth.js with Prisma adapter tables in the `auth` schema.

Expected Auth.js concepts:

- Users.
- Accounts.
- Sessions.
- Verification tokens.

Application role data should live outside Auth.js adapter tables in `users.user_profiles`.

## 6. JSONB Usage Rules

Use JSONB for provider-specific or flexible data:

- AI request payloads.
- AI response payloads.
- Token usage and cost estimates.
- Product analysis attributes.
- Media analysis summaries.

Do not use JSONB for stable ownership and permission fields such as `owner_user_id`, `project_id`, `role` or `status`.

## 7. Data Retention

Recommended defaults:

- AI logs: keep for 90 days by default, configurable later.
- Failed media uploads: purge after 7 days.
- Deleted media: soft delete first, hard delete after a retention window.
- API keys: keep audit metadata, not old plain keys.

## 8. Migration Rules

- Each service owns its Prisma migrations.
- Cross-schema foreign keys may be used in early phase only when they do not block future separation.
- Prefer application-level references across service boundaries for future database-per-service migration.
- Migration names should describe the feature, not only the table name.

## 9. Admin Attribute Catalogs

- Scenario management is now admin-only. User-owned `content.video_templates` remains only as a legacy compatibility table for older links and saved data.
- Admin-managed catalogs are stored separately from Master Prompts:
  - `content.story_attribute_catalogs`
  - `content.scenario_attribute_catalogs`
  - `content.shot_attribute_catalogs` with `type='shots'` for Step 3 and `type='shot'` for Step 4
- Each catalog stores `id`, `name`, optional `description`, `attributes` JSONB, `is_default`, `status`, `created_by_admin_id`, `created_at`, and `updated_at`.
- Catalog JSON uses `id`, `name`, `description`, `required`, and `options[]` with the same `id`, `name`, and `description` fields.
- Tracked `data-examples/{type}/{type}-master-prompt.md`, `data-examples/{type}/{type}-attribute-generation-prompt.md`, `data-examples/{type}/{type}-attribute-json-format.md`, and `data-examples/{type}/{type}-attribute-output-format.md` files are editable admin templates used to initialize new DB master prompts and new DB attribute catalog editors. These files are protected from Delete and Set default actions.
- `config.attribute_generation_prompts` remains a compatibility store for one Attribute Generation Prompt per type (`story`, `scenario`, `shots`, `shot`). The admin UI uses the tracked `data-examples` file as the protected template and starter content.
- `projects.projects.attribute_selections` stores selected options keyed by `story`, `scenario`, and `shots`. Per-shot Step 4 selections use each shot JSON object's `attributeSelection`. Each selected attribute can include `selectionMode`, defaulting old records to `user_selection`. `ai_suggestion` means prompt rendering uses all options from that attribute's active catalog and disables option editing in the user UI; `user_selection` means prompt rendering uses only selected options. When no saved selection exists, every attribute starts with its first option selected. Required attributes remain user-changeable as multi-select as long as at least one option stays selected; optional attributes may be cleared after the initial default selection.

## 10. AI Handoff Records

Table: `projects.ai_handoffs`

Purpose: persist one user-initiated browser-extension handoff for a project shot.

Fields:

- `id`
- `project_id`
- `shot_id`
- `owner_user_id`
- `provider`: generic adapter key such as `google-flow-veo`
- `target_url`: the saved Admin-configured allowlisted AI target URL opened by the extension
- `prompt_text`: exact rendered prompt text sent to the extension
- `status`: `created`, `sent_to_extension`, `target_opened`, `prompt_filled`, `generate_clicked`, `failed`, or `completed_manually`
- `error_message`
- `created_at`
- `updated_at`

Indexes:

- Index on `project_id`.
- Index on `(project_id, shot_id)`.
- Index on `(owner_user_id, updated_at)`.
- Index on `status`.

Rules:

- AI Handoff records are owned by the project owner and must not expose another user's shot prompts.
- Handoff creation must match the active Admin `ai_handoff_provider` and `ai_handoff_target_url` values.
- Handoff status represents extension/browser progress only; it is separate from provider API video-generation records.
- The extension never stores provider credentials, cookies, or API keys in the database.
- Media upload automation is out of scope for v1; reference media remains stored through normal media tables and is handled manually on the target AI site.
## Project Template Snapshots

Admin Project Templates are stored in `config.project_templates`. Each record has
`name`, `description`, `final_step`, `steps` JSON, `status`, and timestamps. The
`steps` JSON is a snapshot keyed by `story`, `scenario`, `shots`, and `shot`;
only the prefix up to `final_step` is valid. Each selected step stores the
master prompt content/output format and the attribute catalog JSON used at the
time the template was created or edited.

User Custom Templates are stored in `projects.user_project_templates`. They are
cloned from active Admin Project Templates and keep their own editable snapshot.
Users may edit prompt and attribute snapshots, but not the selected step prefix.

`projects.projects` stores optional `project_template_id`,
`user_project_template_id`, and `project_template_snapshot`. A project created
from an Admin Project Template stores `project_template_id`; a project created
from a user Custom Template stores both the originating `project_template_id`
when available and `user_project_template_id`. Both paths copy the selected
snapshot at creation time so later Admin default prompt/catalog changes do not
alter existing projects. Missing or malformed selected step data is an error; no
fallback prompt or catalog is used.
