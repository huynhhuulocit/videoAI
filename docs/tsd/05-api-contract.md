# 05 - API Contract

## 1. API Style

Use REST over HTTPS for client-facing APIs.

All client-facing APIs are exposed by the NestJS API Gateway under `/api/v1`.

Use OpenAPI as the contract source for frontend/backend integration.

Current local implementation rule:

- API responses must be backed by PostgreSQL records for auth profile, projects, media metadata, AI config, AI logs, prompts, scripts, video shot plans, video generation records and job status.
- The web app must not fall back to source-code sample data when API calls fail.

## 2. Standard Headers

Request headers:

- `authorization`: internal token or session-derived bearer token from the Next.js server layer.
- `x-request-id`: client-generated or gateway-generated correlation ID.
- `content-type`: `application/json` for JSON APIs.

Response headers:

- `x-request-id`: same request ID.

## 3. Standard Response Envelope

Success:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123"
  }
}
```

Error:

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found",
    "details": {}
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

## 4. Auth and Profile APIs

Auth.js owns sign in, sign out and session routes inside the Next.js app.

The optional site-wide gate is implemented in the Next.js web layer, outside the `/api/v1` Gateway contract. It protects pages and app routes before Auth.js when `SITE_GATE_ENABLED=true`.

### `POST /api/site-gate/login`

Validates the outer site gate username/password against environment variables and sets a signed HTTP-only cookie for the whole site. The request is form-encoded from `/site-login` and accepts `username`, `password` and optional safe relative `next`.

Invalid credentials redirect back to `/site-login?error=1`. The real password is never stored in source code or returned to the browser.

### `POST /api/site-gate/logout`

Clears the outer site gate cookie and redirects to `/site-login`. This does not sign out the existing Auth.js user/admin session by itself.

Gateway profile APIs:

### `GET /api/v1/me`

Returns current application user profile and role.

Response:

```json
{
  "data": {
    "id": "user_001",
    "displayName": "Demo User",
    "role": "user",
    "status": "active"
  }
}
```

## 5. Project APIs

### `GET /api/v1/projects`

Returns active projects owned by current user. Archived/deleted projects are omitted from the list.

### `POST /api/v1/projects`

Creates a project.

Request:

```json
{
  "name": "Spring Product Campaign",
  "description": "Campaign videos for the new product.",
  "flowType": "product"
}
```

`flowType` is required and must be one of:

- `script`: project workspace starts with Scenario.
- `product`: project workspace starts with Product Flow.

### `GET /api/v1/projects/{projectId}`

Returns active project detail.

Project detail may include `templateSelection`, the saved Kịch bản/scenario option selection for that project, and `scenarioResult`, the editable Step 2 Scenario result used by Step 3 `{scenario}` rendering.

### `PATCH /api/v1/projects/{projectId}`

Updates project metadata.

### `DELETE /api/v1/projects/{projectId}`

Archives a project by marking it non-active. Archived projects no longer appear in `GET /api/v1/projects` and are not returned by the project detail endpoint.

### `POST /api/v1/projects/{projectId}/template-selection/analyze`

Uses the active prompt provider/model to generate the current Step 2 `Scenario result` from Story Content and selected Scenario attribute inputs. The provider receives the admin-managed `Scenario` master prompt or optional temporary user override after replacing any placeholders present in that prompt. Temporary `masterPrompt` overrides are accepted only when Admin Site Config `showUserMasterPrompts=true`; otherwise the request is rejected and clients should omit the field. The provider response is treated as plain output text, the API saves it in `scenarioResult` on the project, creates AI request/response logs and returns a completed job. It does not parse AI output to select Scenario attributes.

Request:

```json
{
  "inputText": "Ăn khế trả vàng...",
  "templateId": "template_product_intro",
  "masterPrompt": "You are a video script analyst...",
  "attributeSelections": {
    "scenario": {
      "attributes": []
    }
  }
}
```

`masterPrompt` is optional. When omitted, the API uses the active admin-managed scenario analysis prompt. If no active default exists, the job fails with `AI_CONFIG_MISSING`. `attributeSelections.scenario` is optional and is used only for placeholder rendering such as `{scenarioAttributes}`; it is not mutated by the AI response.

Completed job result:

```json
{
  "projectId": "project_001",
  "scenarioResult": "A concise scenario analysis result formatted by the active Scenario master prompt.",
  "rawRequest": {},
  "rawResponse": {},
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

Failure behavior:

- Missing saved key for the active prompt provider returns a failed job with `AI_CONFIG_MISSING` and safe details such as `provider` and `model`.
- Provider quota or rate-limit responses such as HTTP `429` return a failed job with `AI_RATE_LIMITED`.
- Provider HTTP failures or empty provider text return a failed job with `AI_PROVIDER_FAILED`.
- The user workspace must render failed scenario-analysis jobs as an inline, understandable error near `Analyze scenario`, including code, provider/model, status hints and job ID. Raw provider payloads must not be shown inside the error text; successful job raw request/response can be opened from the adjacent workspace `Request`/`Response` buttons and from admin AI logs, with secrets redacted.

### `PATCH /api/v1/projects/{projectId}/template-selection`

Saves the current manual or AI-generated Kịch bản/scenario selection and optional editable Scenario result to the project.

Request:

```json
{
  "templateSelection": {
    "templateId": "template_product_intro",
    "templateName": "Template giới thiệu sản phẩm",
    "attributes": []
  },
  "scenarioResult": "genre=Folk Tale;"
}
```

### `PATCH /api/v1/projects/{projectId}/scenario-result`

Saves only the editable Scenario result textarea. Send `null` to clear it.

Request:

```json
{
  "scenarioResult": "genre=Folk Tale;"
}
```

## 5.1. AI Handoff APIs

AI Handoff APIs persist user-initiated extension handoffs. They do not call video providers and do not store provider credentials.

### `GET /api/v1/projects/{projectId}/ai-handoffs`

Lists AI Handoff records owned by the current user for a project. Optional query `shotId` narrows the list to one shot.

Response item:

```json
{
  "id": "ai_handoff_001",
  "projectId": "project_001",
  "shotId": "shot_001",
  "provider": "google-flow-veo",
  "targetUrl": "https://labs.google/fx/tools/flow/project/5a83ae13-0d06-48fb-a993-b092c7395df4",
  "promptText": "Complete prompt for this shot...",
  "status": "generate_clicked",
  "errorMessage": null,
  "createdAt": "2026-05-23T00:00:00.000Z",
  "updatedAt": "2026-05-23T00:00:05.000Z"
}
```

### `POST /api/v1/projects/{projectId}/ai-handoffs`

Creates a handoff record before sending the prompt to the Chrome extension.

Request:

```json
{
  "shotId": "shot_001",
  "provider": "google-flow-veo",
  "targetUrl": "https://labs.google/fx/tools/flow/project/5a83ae13-0d06-48fb-a993-b092c7395df4",
  "promptText": "Complete prompt for this shot..."
}
```

The API validates that `provider` and `targetUrl` match the active Admin > AI Config AI Handoff settings, then stores status `created`. The frontend then updates status after extension messaging.

### `PATCH /api/v1/projects/{projectId}/ai-handoffs/{handoffId}`

Updates extension/browser progress for the handoff.

Request:

```json
{
  "status": "prompt_filled",
  "errorMessage": null
}
```

Allowed statuses are `created`, `sent_to_extension`, `target_opened`, `prompt_filled`, `generate_clicked`, `failed`, and `completed_manually`.

Security:

- The project must be active and owned by the current user.
- `promptText` is stored because AI Handoff is an explicit prompt transfer workflow.
- Provider cookies, passwords, API keys and raw binary media are never sent to these endpoints.

## 6. Media APIs

### `POST /api/v1/projects/{projectId}/media`

Creates an upload session or uploads a file through the gateway depending on implementation phase.

For the current local storage phase, multipart upload through the gateway is implemented. Binary files are stored under the local storage provider and metadata is persisted in `media.media_assets`.

For S3-compatible phase, return a signed upload URL.

Multipart fields:

- `file`: required image/video binary.
- `durationSeconds`: optional client-provided video duration used for local validation.

Response:

```json
{
  "data": {
    "id": "media_001",
    "ownerUserId": "user_001",
    "projectId": "project_001",
    "mediaType": "image",
    "mimeType": "image/png",
    "originalFilename": "product-reference.png",
    "sizeBytes": 1200000,
    "previewUrl": "/api/v1/projects/project_001/media/media_001/content",
    "status": "validated",
    "createdAt": "2026-05-17T10:00:00.000Z"
  }
}
```

### `GET /api/v1/projects/{projectId}/media`

Lists media assets for the project.

### `GET /api/v1/projects/{projectId}/media/{mediaId}`

Returns media metadata and preview URL.

### `GET /api/v1/projects/{projectId}/media/{mediaId}/content`

Streams the local media file for preview.

### `DELETE /api/v1/projects/{projectId}/media/{mediaId}`

Deletes a media asset.

## 7. Kịch Bản / Template APIs

The user-facing feature is named `Kịch bản` / `Scenario`, while the current backend route and database model remain `templates` for compatibility with existing workspace selection.

### `GET /api/v1/templates`

Lists active kịch bản/scenario templates owned by current user. The current user default is returned first.

### `POST /api/v1/templates/generate`

Creates a kịch bản/scenario from a free-text video idea by calling the active prompt provider/model. The API uses the optional request `masterPrompt` as a temporary `Scenario` master prompt override; when omitted, it uses the active admin-managed `Scenario` prompt. If that prompt is missing, the request fails with `AI_CONFIG_MISSING`. Placeholder replacement for `{story}` and `{attributes}` is best-effort and optional; the backend does not append hidden runtime context or output instructions to the selected master prompt.

The system must not create fake/sample scenario data when provider execution fails. Success persists the generated attribute/option JSON and AI request/response log in PostgreSQL, and the response also returns the redacted raw provider request/response so the Scenario create/edit UI can open `Request` and `Response` review popups next to the generate action.

Request:

```json
{
  "idea": "Tạo 1 video về ngày vui của bé",
  "masterPrompt": "You are a video script analyst.\n\nStory:\n{story}\n\nScenario attributes/catalog:\n{attributes}"
}
```

`masterPrompt` is optional and does not overwrite the admin default.

Response:

```json
{
  "data": {
    "id": "template_001",
    "ownerUserId": "user_001",
    "name": "Template ngày vui của bé",
    "attributes": [
      {
        "id": "emotion",
        "name": "Cảm xúc chính",
        "options": [
          {
            "id": "emotion-warm",
            "label": "Ấm áp",
            "value": "Ấm áp"
          }
        ]
      }
    ],
    "rawRequest": {
      "provider": "gemini",
      "model": "gemini-2.5-flash",
      "method": "POST",
      "headers": {
        "x-goog-api-key": "[REDACTED]"
      },
      "body": {}
    },
    "rawResponse": {
      "name": "Template ngÃ y vui cá»§a bÃ©",
      "attributes": []
    },
    "provider": "gemini",
    "model": "gemini-2.5-flash",
    "status": "active"
  }
}
```

Failure behavior:

- Missing saved key for the active prompt provider returns `AI_CONFIG_MISSING` with safe details such as `provider`, `model` and `requestId`.
- Provider quota or rate-limit responses such as HTTP `429` return `AI_RATE_LIMITED`.
- Provider HTTP failures, empty provider text, invalid JSON, or schema-mismatched scenario JSON return `AI_PROVIDER_FAILED` with safe details such as provider/model/status/schema issue count. Raw provider payloads remain in Admin > AI Logs.
- The Scenario create/edit UI must render these errors inline below `Generate scenario with AI` as readable multi-line text. It must not hide the error by falling back to sample attribute data.

### `POST /api/v1/templates`

Creates a kịch bản/scenario manually from user-defined attributes/options. Frontend may parse attributes/options from a compact schema textarea such as `videoPurpose=Storytelling,Commercial;` and `genre=Folk Tale,Drama;`, or from optimized JSON before sending the normalized `attributes` array. The optimized JSON uses `id`, `name`, optional `description` and nested `options`; option `name` is converted to the internal `label`/`value` pair for compatibility. Legacy JSON with `translate`, `label` or `value` remains accepted.

### `PATCH /api/v1/templates/{templateId}`

Updates scenario name, description, idea or attributes/options JSON.

### `DELETE /api/v1/templates/{templateId}`

Soft deletes a scenario by marking it archived.

## 8. Shot APIs

### `GET /api/v1/shots`

Lists all active shot plans owned by the current user. Shot plans are reusable by any project owned by the same user. The list is ordered by latest update.

### `POST /api/v1/shots/generate`

Generates a user-owned shot plan from story content. The API reads the active admin prompt provider/model and uses the optional request `masterPrompt` as a temporary `Shots` prompt override only when Admin Site Config `showUserMasterPrompts=true`; when `showUserMasterPrompts=false`, any non-empty `masterPrompt` override is rejected. When omitted, it uses the active admin default `Shots` master prompt. It optionally replaces placeholders, does not append hidden story/attribute/duration text, calls the provider with the saved encrypted provider key, stores the redacted raw provider request plus raw response in AI logs/job result, validates the returned JSON, and persists the generated shot JSON in PostgreSQL. In the project workspace, `attributes` should include the selected Step 2 Kịch bản/scenario options formatted as compact plan attributes such as `genre=Folk Tale,Drama;` only when the prompt includes `{attributes}`.

`scenario` contains the saved Step 2 `Scenario result` textarea for prompts that include `{scenario}`. `attributes` remains compatibility-only for selected Step 2 scenario options when prompts still include `{attributes}`.

For ChatGPT, the provider request uses the OpenAI Responses API with `text.format.type = "json_schema"`, `strict = true`, and `additionalProperties: false` on every schema object. Backend validation rejects provider output with missing required fields or durations outside `1-8`.

Request:

```json
{
  "sourceText": "Create a short product introduction video.",
  "name": "One Click video project",
  "description": "Short setup description used for the saved shot plan.",
  "masterPrompt": "You are an expert video shot planner.\n\nStory:\n{story}\n\nScenario:\n{scenario}\n\nScenario attributes:\n{scenarioAttributes}\n\nShots attributes:\n{shotsAttributes}",
  "scenario": "scenario-structure=3-Act Structure;\nscene-count=Auto;",
  "attributes": [
    {
      "id": "tone",
      "name": "Tone",
      "value": "Warm and cinematic"
    },
    {
      "id": "scenario_genre",
      "name": "genre",
      "value": "Folk Tale, Drama"
    }
  ]
}
```

Response:

```json
{
  "data": {
    "jobId": "job_shot_generation_001",
    "status": "queued"
  }
}
```

Completed job result:

```json
{
  "shotPlan": {
    "id": "shot_plan_001",
    "projectId": null,
    "name": "Shot plan 2026-05-18",
    "description": "Short setup description used for the saved shot plan.",
    "sourceText": "Create a short product introduction video.",
    "durationSeconds": 8,
    "attributes": [],
    "shots": []
  },
  "rawRequest": {
    "provider": "gemini",
    "model": "gemini-2.5-flash",
    "method": "POST",
    "headers": {
      "x-goog-api-key": "[REDACTED]"
    },
    "body": {}
  },
  "rawResponse": {
    "name": "Shot plan 2026-05-18",
    "durationSeconds": 8,
    "shots": []
  },
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

`rawRequest` and `rawResponse` are stored in the job result and AI logs, and can be displayed from the latest job result through project workspace review popups. `content.video_shot_plans` stores normalized plan-level `attributes` and `shotPlan.shots` JSON, not separate raw request/response columns. Each normalized shot must include `Start state`, `End state` and `Dialogue` attributes; `Start state` and `End state` values must be non-empty, while `Dialogue` may be an empty string for no-dialogue scenarios. UI renders `Dialogue` as a dedicated textarea while persisting it in the shot JSON.

Failure behavior:

- Missing saved key for the active prompt provider returns a failed job with `AI_CONFIG_MISSING`. Environment API keys are not runtime fallback sources.
- Provider quota or rate-limit responses such as HTTP `429` return a failed job with `AI_RATE_LIMITED`.
- Provider HTTP failures or invalid JSON return a failed job with `AI_PROVIDER_FAILED`.
- The system must not create fake shot data when provider execution fails.

### `PATCH /api/v1/shots/{shotPlanId}`

Updates shot plan name, description, default duration, plan-level `attributes` or `shots` JSON after user edits.

### `GET /api/v1/shots/{shotPlanId}`

Returns one active shot plan owned by the current user.

### `DELETE /api/v1/shots/{shotPlanId}`

Soft deletes a shot plan by marking it archived.

Compatibility endpoints retained during migration:

- `GET /api/v1/projects/{projectId}/shots`
- `POST /api/v1/projects/{projectId}/shots`
- `POST /api/v1/projects/{projectId}/shots/generate`
- `PATCH /api/v1/projects/{projectId}/shots/{shotPlanId}`
- `DELETE /api/v1/projects/{projectId}/shots/{shotPlanId}`

`POST /api/v1/projects/{projectId}/shots` persists a user-edited or pasted normalized shot-plan JSON after the workspace has applied it to local shot cards. It requires `name`, `sourceText`, `durationSeconds`, and at least one `shots[]` item using the same `VideoShotPlan` shot JSON structure as generated plans.

Standalone user-facing shot-plan UI is removed. Project and One Click shot workflows use the project-scoped endpoints so generated or pasted shot plans are linked to the current project without requiring the old `/shots` pages.

## 9. Prompt and Script APIs

### `POST /api/v1/projects/{projectId}/prompts/generate`

Starts Step 1 Story Content generation from Scenario. The optional `masterPrompt` is a temporary `Story Content` master prompt override for this request only and is accepted only when Admin Site Config `showUserMasterPrompts=true`; when `showUserMasterPrompts=false`, any non-empty override is rejected. When omitted, runtime uses the active admin default. The persisted master-prompt type key remains `scripts` for compatibility. Runtime data is included only through placeholders present in the selected prompt. This endpoint calls the active prompt provider/model; it must not return locally generated fallback content when provider execution fails.

Request:

```json
{
  "inputText": "Create a short video script for a skincare product.",
  "mediaIds": ["media_001", "media_002"],
  "masterPrompt": "You are a video script and prompt strategist...",
  "shotSelection": {
    "shotPlanId": "shot_plan_001",
    "shotPlanName": "Shot plan 2026-05-17",
    "shots": [
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
        ]
      }
    ]
  },
  "templateSelection": {
    "templateId": "template_001",
    "templateName": "Template ngày vui của bé",
    "attributes": [
      {
        "id": "emotion",
        "name": "Cảm xúc chính",
        "options": [
          {
            "id": "emotion-warm",
            "label": "Ấm áp",
            "value": "Ấm áp"
          }
        ]
      }
    ]
  }
}
```

Response:

```json
{
  "data": {
    "jobId": "job_ai_prompt_001",
    "status": "queued"
  }
}
```

Completed job result includes the provider text in `generatedPrompt`, plus redacted `rawRequest` and raw provider `rawResponse` in the job result and AI logs for admin review.

Failure behavior:

- Missing saved key for the active prompt provider returns a failed job with `AI_CONFIG_MISSING`. Environment API keys are not runtime fallback sources.
- Provider quota/rate-limit status such as HTTP `429` returns `AI_RATE_LIMITED`.
- Provider HTTP failures, unsupported providers, or empty provider text return `AI_PROVIDER_FAILED`.
- The user workspace should show the safe error details inline under `Generate Story Content`; successful job raw request/response can be opened from the adjacent workspace `Request`/`Response` buttons and from Admin > AI Logs, with secrets redacted.

### `GET /api/v1/projects/{projectId}/story-content`

Returns the latest saved Story Content for a Scenario/One Click project. The response is loaded from the newest succeeded `content.prompts` row for the project with source type `script_flow` or `story_content`, and the workspace uses it to hydrate the Story Content textarea when the project is opened.

Response:

```json
{
  "data": {
    "storyContent": "Expanded story content used by later wizard steps."
  }
}
```

### `PATCH /api/v1/projects/{projectId}/story-content`

Persists manually edited One Click Story Content before the wizard advances. This does not call an AI provider. The API writes a succeeded `content.prompts` record with `sourceType = story_content`, using the same text as `inputText` and `generatedPrompt`, so later Step 2/Step 3 loads can reuse the database-backed content.

Request:

```json
{
  "storyContent": "Expanded story content used by later wizard steps."
}
```

Response:

```json
{
  "data": {
    "saved": true,
    "storyContent": "Expanded story content used by later wizard steps."
  }
}
```

### `POST /api/v1/projects/{projectId}/products/analyze`

Starts product URL and optional media analysis.

Request:

```json
{
  "productUrl": "https://example.com/product",
  "mediaIds": ["media_001"],
  "templateSelection": {
    "templateId": "template_001",
    "templateName": "Template ngày vui của bé",
    "attributes": []
  }
}
```

Response:

```json
{
  "data": {
    "jobId": "job_product_analysis_001",
    "status": "queued"
  }
}
```

### `POST /api/v1/projects/{projectId}/scripts`

Creates a script from final user-confirmed prompt/text.

Request:

```json
{
  "promptId": "prompt_001",
  "finalPrompt": "Final approved prompt text."
}
```

Response:

```json
{
  "data": {
    "scriptId": "script_001",
    "status": "succeeded"
  }
}
```

## 10. Video APIs

### `POST /api/v1/projects/{projectId}/videos`

Starts video generation from a final prompt, script, or composed project shot prompt. The current local implementation creates a `video_generation` job, writes a video generation record, logs the AI request, and calls the configured video provider/model. It must not return a fake success when the provider is missing, unsupported, over quota, or returns an error.

For Project and One Click Step 4, the web app first renders the active admin `Shot` master prompt for the selected shot using exact placeholder replacement only. The video endpoint receives the already-rendered `finalPrompt`; it does not append runtime context or substitute a fallback prompt.

Request:

```json
{
  "promptId": "prompt_001",
  "scriptId": "script_001",
  "finalPrompt": "Final approved prompt text.",
  "mediaIds": ["media_001"]
}
```

`mediaIds` is optional and is used for ownership validation/logging when a project shot has reference media.

Response:

```json
{
  "data": {
    "jobId": "job_video_generation_001",
    "type": "video_generation",
    "status": "succeeded",
    "progress": 100,
    "result": {
      "videoGenerationId": "video_gen_001",
      "projectId": "project_001",
      "status": "succeeded",
      "provider": "veo",
      "model": "veo-3.0-generate-preview",
      "rawRequest": {},
      "rawResponse": {}
    }
  }
}
```

If the provider call fails, the job status is `failed`, the video generation record is marked failed, and the job error contains a stable code such as `AI_CONFIG_MISSING`, `AI_RATE_LIMITED` or `AI_PROVIDER_FAILED`. The web app surfaces this error beside the shot card and leaves the raw response popup available with the job error payload.

### `GET /api/v1/projects/{projectId}/videos/{videoGenerationId}`

Returns video generation status and output metadata.

## 11. Job APIs

### `GET /api/v1/jobs/{jobId}`

Returns async job status.

Current local implementation persists every job status update in `jobs.job_statuses`. BullMQ workers should update the same read model when queues are wired.

Response:

```json
{
  "data": {
    "jobId": "job_video_001",
    "type": "video_generation",
    "status": "processing",
    "progress": 45,
    "result": null,
    "error": null
  }
}
```

Optional later:

- `GET /api/v1/jobs/{jobId}/events` for Server-Sent Events.

## 12. Admin Config APIs

Admin-only APIs.

### `GET /api/v1/admin/ai-config`

Returns current site-wide AI config.

Secrets must be masked. The response returns key status only:

- `configured`: an encrypted saved key exists and can be decrypted.
- `missing`: no saved key is available for that provider.

### `PUT /api/v1/admin/ai-config`

Updates content mode, models, site config, and optionally rotates provider API keys supplied with the same request.

Admin UI submits free-form provider/model values. The API normalizes provider names to lowercase and accepts any non-empty provider string; runtime provider execution still requires a matching adapter.
`showUserMasterPrompts` controls whether user Project/One Click screens show editable master prompt fields. It defaults to `false`; when `false`, user generation APIs reject temporary `masterPrompt` overrides and use active admin defaults.
`aiHandoffProvider`, `aiHandoffTargetUrl`, and `aiHandoffPromptSelector` configure the Step 4 browser-extension handoff target. ENV values seed/bootstrap provider/target URL only; the saved Admin config is authoritative. If `aiHandoffTargetUrl` or `aiHandoffPromptSelector` is blank, Project/One Click handoff must fail clearly.
If `promptApiKey` or `videoApiKey` is supplied, the API stores it encrypted for the corresponding provider and returns only key status, never key material.

Request:

```json
{
  "contentMode": "script",
  "showUserMasterPrompts": false,
  "aiHandoffProvider": "google-flow-veo",
  "aiHandoffTargetUrl": "https://labs.google/fx/tools/flow/project/5a83ae13-0d06-48fb-a993-b092c7395df4",
  "aiHandoffPromptSelector": "textarea[aria-label=\"Prompt\"]",
  "promptProvider": "chatgpt",
  "promptModel": "gpt-5.5",
  "promptApiKey": "optional-new-secret",
  "videoProvider": "veo",
  "videoModel": "veo-default",
  "videoApiKey": "optional-new-secret"
}
```

### `PATCH /api/v1/admin/ai-config/ai-handoff-dom`

Saves the prompt input selector captured by the Chrome extension `Check DOM` flow. The `provider` must match the active Admin AI Config provider. This endpoint updates only the AI Handoff DOM selector and preserves the rest of the active config.

Request:

```json
{
  "provider": "google-flow-veo",
  "promptSelector": "textarea[aria-label=\"Prompt\"]"
}
```

Response:

```json
{
  "data": {
    "provider": "google-flow-veo",
    "promptSelector": "textarea[aria-label=\"Prompt\"]",
    "updatedAt": "2026-05-23T00:00:00.000Z"
  }
}
```

### `PUT /api/v1/admin/ai-config/provider-keys/{provider}`

Creates or rotates a provider API key. This endpoint remains available for API clients; the Admin UI saves keys through the shared `PUT /api/v1/admin/ai-config` action. The provider path is normalized to lowercase before storage. The response returns key status only and never returns key material.

Request:

```json
{
  "apiKey": "secret-value"
}
```

Response:

```json
{
  "data": {
    "provider": "chatgpt",
    "keyStatus": "configured"
  }
}
```

### `POST /api/v1/admin/ai-config/test-connection`

Tests the active key source for a provider/model pair. If `apiKey` is supplied, the API tests that unsaved key. If omitted, it uses the saved encrypted key only. Live connectivity checks are implemented for `gemini`/`google` and `chatgpt`/`openai`; other provider names return success only when a saved/input key source is available because no generic provider URL exists.

Request:

```json
{
  "provider": "chatgpt",
  "model": "gpt-5.5",
  "apiKey": "optional-unsaved-test-key"
}
```

Response:

```json
{
  "data": {
    "provider": "chatgpt",
    "model": "gpt-5.5",
    "status": "success",
    "keySource": "stored",
    "message": "OpenAI API key and model are reachable."
  }
}
```

### `GET /api/v1/admin/master-prompts`

Returns active master prompts grouped by type. Each group has one current default prompt. Built-in templates may appear in admin management only as read-only setup guidance; runtime AI calls require an active DB default prompt and do not use built-in prompt fallback. Supported types are `scripts` (displayed as Story Content), `scenario`, `shots`, and `shot`.

Response:

```json
{
  "data": {
    "groups": [
      {
        "type": "scenario",
        "prompts": [
          {
            "id": "master_prompt_001",
            "type": "scenario",
            "name": "Default scenario analyst",
            "content": "Choose matching scenario options.",
            "outputFormat": "Return strict JSON only.",
            "attributeSelection": {
              "attributes": []
            },
            "isDefault": true,
            "status": "active",
            "isBuiltIn": false,
            "createdAt": "2026-05-18T10:00:00.000Z",
            "updatedAt": "2026-05-18T10:00:00.000Z"
          }
        ],
        "defaultPrompt": {
          "id": "master_prompt_001",
          "type": "scenario",
          "name": "Default scenario analyst",
          "content": "Choose matching scenario options.",
          "outputFormat": "Return strict JSON only.",
          "isDefault": true,
          "status": "active",
          "isBuiltIn": false,
          "createdAt": "2026-05-18T10:00:00.000Z",
          "updatedAt": "2026-05-18T10:00:00.000Z"
        }
      },
      {
        "type": "shots",
        "prompts": [
          {
            "id": "built_in_shots",
            "type": "shots",
            "name": "Built-in Shots master prompt",
            "content": "Split the story into continuous shots.",
            "outputFormat": "Return the generated shots in the provider JSON schema.",
            "isDefault": true,
            "status": "active",
            "isBuiltIn": true,
            "createdAt": "1970-01-01T00:00:00.000Z",
            "updatedAt": "1970-01-01T00:00:00.000Z"
          }
        ],
        "defaultPrompt": {
          "id": "built_in_shots",
          "type": "shots",
          "name": "Built-in Shots master prompt",
          "content": "Split the story into continuous shots.",
          "outputFormat": "Return the generated shots in the provider JSON schema.",
          "isDefault": true,
          "status": "active",
          "isBuiltIn": true,
          "createdAt": "1970-01-01T00:00:00.000Z",
          "updatedAt": "1970-01-01T00:00:00.000Z"
        }
      },
      {
        "type": "scripts",
        "prompts": [
          {
            "id": "built_in_scripts",
            "type": "scripts",
            "name": "Built-in Story Content master prompt",
            "content": "Create readable script and prompt content.",
            "outputFormat": "Return a polished Story Content draft.",
            "isDefault": true,
            "status": "active",
            "isBuiltIn": true,
            "createdAt": "1970-01-01T00:00:00.000Z",
            "updatedAt": "1970-01-01T00:00:00.000Z"
          }
        ],
        "defaultPrompt": {
          "id": "built_in_scripts",
          "type": "scripts",
          "name": "Built-in Story Content master prompt",
          "content": "Create readable script and prompt content.",
          "outputFormat": "Return a polished Story Content draft.",
          "isDefault": true,
          "status": "active",
          "isBuiltIn": true,
          "createdAt": "1970-01-01T00:00:00.000Z",
          "updatedAt": "1970-01-01T00:00:00.000Z"
        }
      },
      {
        "type": "shot",
        "prompts": [
          {
            "id": "master_prompt_shot_default",
            "type": "shot",
            "name": "Default Shot master prompt",
            "content": "Create the final video generation prompt for one shot.",
            "outputFormat": "Return one polished video prompt for this shot.",
            "isDefault": true,
            "status": "active",
            "isBuiltIn": false,
            "createdAt": "2026-05-18T10:00:00.000Z",
            "updatedAt": "2026-05-18T10:00:00.000Z"
          }
        ],
        "defaultPrompt": {
          "id": "master_prompt_shot_default",
          "type": "shot",
          "name": "Default Shot master prompt",
          "content": "Create the final video generation prompt for one shot.",
          "outputFormat": "Return one polished video prompt for this shot.",
          "isDefault": true,
          "status": "active",
          "isBuiltIn": false,
          "createdAt": "2026-05-18T10:00:00.000Z",
          "updatedAt": "2026-05-18T10:00:00.000Z"
        }
      }
    ],
    "updatedAt": "2026-05-18T10:00:00.000Z"
  }
}
```

### `POST /api/v1/admin/master-prompts`

Creates an active master prompt. If it is the first active prompt for its type, it becomes the default.

Request:

```json
{
  "type": "shots",
  "name": "Narrative shots",
  "content": "Split the script into continuous visual shots.",
  "outputFormat": "Return strict JSON using the configured provider schema.",
  "attributeSelection": {
    "attributes": [
      {
        "attributeId": "tone",
        "optionIds": ["tone-cinematic"]
      }
    ]
  }
}
```

Validation:

- `type` must be `scenario`, `shots`, `scripts`, or `shot`. The `scripts` key is displayed in admin/user UI as `Story Content`; `shots` is Step 3 batch shot-list generation and `shot` is Step 4 per-shot prompt creation.
- `name` and `content` are required.
- Content may keep the recommended placeholder format, but placeholders are optional and saves do not validate their presence.
- `outputFormat` is optional unless `content` contains `{outputFormat}`. When the token is present and `outputFormat` is blank, create/update/preview/runtime must fail with a clear validation error.
- Master prompt records do not store Story/Scenario/Shots/Shot workflow attribute selections. Those workflow attributes are selected in Project and One Click user flows.
- Recommended placeholders by type: `scripts`/`Story Content` uses `{storyContent}`, `{storyAttributes}`, `{outputFormat}`; `scenario` uses `{story}`, `{attributes}`, `{scenarioAttributes}`, `{outputFormat}`; `shots` uses `{story}`, `{scenario}`, `{attributes}`, `{scenarioAttributes}`, `{shotsAttributes}`, `{outputFormat}`; `shot` uses `{storyContent}`, `{shotTitle}`, `{shotDescription}`, `{shotDialogue}`, `{shotDuration}`, `{shotGeneratedAttributes}`, `{shotAttributes}`, `{referenceMedia}`, `{outputFormat}`.
- `{masterPromptAttributes}` is admin-only. It is suggested only in admin master prompt editors and renders from the prompt record's saved `attributeSelection`.
- User-facing temporary master prompt overrides containing `{masterPromptAttributes}` are rejected.

### `PATCH /api/v1/admin/master-prompts/{id}`

Updates prompt name and/or content.

Request:

```json
{
  "name": "Narrative shots v2",
  "content": "Updated instructions.",
  "outputFormat": "Updated output instructions.",
  "attributeSelection": {
    "attributes": []
  }
}
```

### `DELETE /api/v1/admin/master-prompts/{id}`

Archives an active prompt.

Rules:

- Deleting the current default is rejected. Admin must set another active prompt of the same type as default first.
- Archived prompts are not returned by `GET /api/v1/admin/master-prompts` and are not used at runtime.

Response:

```json
{
  "data": {
    "archived": true,
    "prompt": {
      "id": "master_prompt_001",
      "type": "shots",
      "name": "Narrative shots v2",
      "status": "archived"
    }
  }
}
```

### `POST /api/v1/admin/master-prompts/{id}/default`

Makes the prompt the only active default for its type.

### `GET /api/v1/admin/data-examples/{type}`

Returns the protected file-backed template content used to initialize new master prompts and attribute catalogs. Supported `type` values are `story`, `scenario`, `shots`, and `shot`.

Response:

```json
{
  "data": {
    "type": "story",
    "masterPromptContent": "You are a Story Content writer...",
    "attributeGenerationPrompt": "Create Story attribute JSON...",
    "attributeJsonFormat": "{ \"attributes\": [] }",
    "attributeOutputFormat": "Return only strict JSON using this structure: ...",
    "updatedAt": "2026-05-23T10:00:00.000Z"
  }
}
```

Rules:

- This endpoint is admin-only.
- `masterPromptContent` comes from `data-examples/{type}/{type}-master-prompt.md`.
- `attributeGenerationPrompt` comes from `data-examples/{type}/{type}-attribute-generation-prompt.md`.
- `attributeJsonFormat` comes from `data-examples/{type}/{type}-attribute-json-format.md`.
- `attributeOutputFormat` comes from `data-examples/{type}/{type}-attribute-output-format.md`.
- Missing or unreadable files fail with a clear error. The API must not return hardcoded sample fallback content.

### `PATCH /api/v1/admin/data-examples/{type}`

Updates one or both protected file-backed templates for the selected type.

Request:

```json
{
  "masterPromptContent": "Updated starter master prompt.",
  "attributeGenerationPrompt": "Updated starter Attribute Generation Prompt.",
  "attributeJsonFormat": "Updated JSON format example.",
  "attributeOutputFormat": "Updated output format instructions."
}
```

Rules:

- At least one field is required.
- Missing or unwritable files fail with a clear error.
- Attribute generation renders `{outputFormat}` from `attributeOutputFormat` after replacing `{attributeJsonFormat}` with the saved `attributeJsonFormat`.
- These file-backed templates cannot be deleted or set as default. New DB master prompts and new DB attribute catalogs use the matching file content as starter data, then save normal DB records.

### `GET /api/v1/admin/master-prompt-config`

Returns the global admin-only Master Prompt Config attribute set.

Response:

```json
{
  "data": {
    "id": "master_prompt_config_001",
    "attributes": [
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
    ],
    "updatedAt": "2026-05-22T10:00:00.000Z"
  }
}
```

### `PATCH /api/v1/admin/master-prompt-config`

Replaces the global admin-only Master Prompt Config.

Request:

```json
{
  "attributes": [
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
}
```

Rules:

- This endpoint is admin-only.
- There is no user API to select or mutate Master Prompt Attributes.
- Runtime includes these attributes only through `{masterPromptAttributes}` in the active admin master prompt and only using the saved prompt-level `attributeSelection`.

### Legacy `GET/PATCH /api/v1/admin/shot-prompt`

Kept for read/write compatibility during migration. New admin UI should use `/admin/master-prompts`.

- Runtime AI resolves the default `shots`, `scenario` and `scripts` master prompts from `config.master_prompts`; missing active defaults fail with `AI_CONFIG_MISSING`.
- `GET` includes `showUserMasterPrompts`, `aiHandoffProvider`, `aiHandoffTargetUrl`, and `aiHandoffPromptSelector` so Project and One Click can consistently render master prompt editability and create extension handoffs from the saved Admin config. It also returns the resolved `outputFormat`, `scenarioAnalysisOutputFormat`, and `scriptGenerationOutputFormat` fields used to render `{outputFormat}` when a selected master prompt contains that token.
- `PATCH` still writes legacy `ai_site_configs` prompt columns and requires non-empty strings only; placeholder validation is no longer enforced.

## 13. Admin Log APIs

Admin-only APIs.

### `GET /api/v1/admin/ai-logs`

Query parameters:

- `from`
- `to`
- `userId`
- `projectId`
- `provider`
- `model`
- `flowType`
- `status`
- `page`
- `pageSize`

### `GET /api/v1/admin/ai-logs/{requestId}`

Returns request and response details with secrets redacted.

## 14. Error Codes

Recommended first set:

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `PROJECT_NOT_FOUND`
- `MEDIA_NOT_FOUND`
- `MEDIA_INVALID_TYPE`
- `MEDIA_SIZE_EXCEEDED`
- `MEDIA_DURATION_EXCEEDED`
- `AI_CONFIG_MISSING`
- `AI_PROVIDER_FAILED`
- `AI_RATE_LIMITED`
- `VIDEO_PROVIDER_FAILED`
- `JOB_NOT_FOUND`
- `INTERNAL_ERROR`

## 15. Admin Attribute Catalog APIs

Scenario attribute management is admin-only. The user `/templates` UI is no longer the primary management surface.

Admin endpoints:

- `GET /api/v1/admin/attribute-catalogs?type=story|scenario|shots|shot`
- `POST /api/v1/admin/attribute-catalogs`
- `GET /api/v1/admin/attribute-catalogs/{type}/{id}`
- `PATCH /api/v1/admin/attribute-catalogs/{type}/{id}`
- `DELETE /api/v1/admin/attribute-catalogs/{type}/{id}`
- `POST /api/v1/admin/attribute-catalogs/{type}/{id}/default`
- `GET /api/v1/admin/attribute-generation-prompts/{type}`
- `PATCH /api/v1/admin/attribute-generation-prompts/{type}`
- `POST /api/v1/admin/attribute-catalogs/{type}/generate`
- `GET /api/v1/admin/data-examples/{type}`
- `PATCH /api/v1/admin/data-examples/{type}`

The `attribute-generation-prompts` endpoints are retained for compatibility. Admin UI uses the tracked `data-examples/{type}/{type}-attribute-generation-prompt.md` file as the editable protected template and as the starter content for new catalog editors.

User/project read endpoint:

- `GET /api/v1/attribute-catalogs/{type}/default`

Project selection endpoint:

- `PATCH /api/v1/projects/{projectId}/attribute-selections`

Catalog JSON:

```json
{
  "attributes": [
    {
      "id": "mood",
      "name": "Mood",
      "description": "Primary feeling.",
      "required": true,
      "options": [
        {
          "id": "mood-friendly",
          "name": "Friendly",
          "description": "Warm and approachable."
        }
      ]
    }
  ]
}
```

Runtime data enters provider prompts only through explicit placeholders present in the selected prompt. New prompts should prefer `{storyAttributes}`, `{scenarioAttributes}`, `{shotsAttributes}`, and `{shotAttributes}` instead of the legacy `{attributes}` token.
Step 4 per-shot prompt rendering uses `GET /api/v1/attribute-catalogs/shot/default` for the active `Shot Attribute` catalog. The selected per-shot options are stored on each shot JSON object as `attributeSelection` and are included only when the active `Shot` master prompt contains `{shotAttributes}`.

## Attribute Selection Mode Notes

- `GET/PUT /api/v1/admin/ai-config` and `GET /api/v1/admin/shot-prompt` include `aiSelectAttributeText` and `userSelectAttributeText`.
- Project generation payloads may include `attributeSelections` where each attribute has `selectionMode: "user_selection" | "ai_suggestion"`. Older records without the field are treated as `user_selection`.
- For Story, Scenario, Shots, and Shot placeholder rendering, `ai_suggestion` uses the Admin `AI select Attribute` text plus all options from the active catalog for that attribute. `user_selection` uses the Admin `User select Attribute` text plus selected options only.
- Empty Admin text config values render as empty prefixes and do not trigger fallback text.
## Project Template APIs

Admin Project Template management:

- `GET /api/v1/admin/project-templates` lists active Admin templates.
- `GET /api/v1/admin/project-templates/default-snapshot?finalStep=story|scenario|shots|shot`
  also requires `{step}MasterPromptId` query values for every selected workflow
  step, for example `storyMasterPromptId`, `scenarioMasterPromptId`,
  `shotsMasterPromptId`, and `shotMasterPromptId`. `Shot` is always selected;
  `finalStep=scenario` selects Scenario, Shots, and Shot, and
  `finalStep=story` selects all steps. It builds a new template
  snapshot from those selected saved active master prompts and the active default
  attribute catalog for every selected workflow step. Missing selected prompts or
  default catalogs return a clear validation error.
- `POST /api/v1/admin/project-templates` creates a template from a validated
  workflow snapshot.
- `GET /api/v1/admin/project-templates/{templateId}` reads one active template.
- `PATCH /api/v1/admin/project-templates/{templateId}` updates the template
  name, description, final selected step, and stored step snapshot.
- `DELETE /api/v1/admin/project-templates/{templateId}` archives the template.

Project Template selection and User Custom Template management:

- `GET /api/v1/project-templates` lists active Admin templates that can be
  selected directly during project creation.
- `GET /api/v1/user-project-templates` lists the current user's active custom
  templates.
- `POST /api/v1/user-project-templates` clones an Admin template into a user
  custom template.
- `GET/PATCH/DELETE /api/v1/user-project-templates/{templateId}` read, update
  snapshot, or archive the current user's custom template.

`POST /api/v1/projects` accepts optional `projectTemplateId` or
`userProjectTemplateId`, but not both. `projectTemplateId` copies an active
Admin Project Template snapshot directly into the project. `userProjectTemplateId`
validates ownership, then copies the user's Custom Template snapshot. In both
cases the API creates a Scenario project using the selected template steps. If
the selected template is missing, archived, malformed, or owned by another user,
the request fails with a readable validation error.
