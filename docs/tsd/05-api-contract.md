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

- `script`: project workspace starts with Script Flow.
- `product`: project workspace starts with Product Flow.

### `GET /api/v1/projects/{projectId}`

Returns active project detail.

Project detail may include `templateSelection`, the saved Kịch bản/scenario option selection for that project. The workspace uses it to restore checked options after reload.

### `PATCH /api/v1/projects/{projectId}`

Updates project metadata.

### `DELETE /api/v1/projects/{projectId}`

Archives a project by marking it non-active. Archived projects no longer appear in `GET /api/v1/projects` and are not returned by the project detail endpoint.

### `POST /api/v1/projects/{projectId}/template-selection/analyze`

Uses the active prompt provider/model to analyze the current Script Flow story against a selected Kịch bản/scenario template. The provider receives the admin-managed `Scenario` master prompt or optional temporary user override, then backend-appended story and full attribute/option catalog context. The provider returns strict JSON with selected option IDs. The API normalizes the response, saves the resulting `templateSelection` on the project, creates AI request/response logs and returns a completed job.

Request:

```json
{
  "inputText": "Ăn khế trả vàng...",
  "templateId": "template_product_intro",
  "masterPrompt": "You are a video script analyst..."
}
```

`masterPrompt` is optional. When omitted, the API uses the active admin-managed scenario analysis prompt, then falls back to the built-in default.

Completed job result:

```json
{
  "projectId": "project_001",
  "templateSelection": {
    "templateId": "template_product_intro",
    "templateName": "Template giới thiệu sản phẩm",
    "attributes": [
      {
        "id": "genre",
        "name": "Genre",
        "options": [
          {
            "id": "genre-folk-tale",
            "label": "Folk Tale",
            "value": "Folk Tale"
          }
        ]
      }
    ]
  },
  "compactSelection": "genre=Folk Tale;",
  "rawRequest": {},
  "rawResponse": {},
  "provider": "gemini",
  "model": "gemini-2.5-flash"
}
```

Failure behavior:

- Missing key for the active prompt provider returns a failed job with `AI_CONFIG_MISSING` and safe details such as `provider`, `model` and the fallback env name.
- Provider quota or rate-limit responses such as HTTP `429` return a failed job with `AI_RATE_LIMITED`.
- Provider HTTP failures, empty provider text or invalid/contract-mismatched JSON return a failed job with `AI_PROVIDER_FAILED`.
- The user workspace must render failed scenario-analysis jobs as an inline, understandable error near `Analyze scenario`, including code, provider/model, env/status hints and job ID. Raw provider payloads must not be shown inside the error text; successful job raw request/response can be opened from the adjacent workspace `Request`/`Response` buttons and from admin AI logs, with secrets redacted.

### `PATCH /api/v1/projects/{projectId}/template-selection`

Saves the current manual or AI-generated Kịch bản/scenario selection to the project.

Request:

```json
{
  "templateSelection": {
    "templateId": "template_product_intro",
    "templateName": "Template giới thiệu sản phẩm",
    "attributes": []
  }
}
```

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

Creates a kịch bản/scenario from a free-text video idea by calling the active prompt provider/model. The API uses the optional request `masterPrompt` as a temporary `Scenario` master prompt override; when omitted, it uses the active admin-managed `Scenario` prompt, then legacy fallback, then the built-in default. Placeholder replacement for `{story}` and `{attributes}` is best-effort and optional; the backend always appends structured runtime context and a strict JSON output contract after the selected master prompt.

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

- Missing key for the active prompt provider returns `AI_CONFIG_MISSING` with safe details such as `provider`, `model`, `env` and `requestId`.
- Provider quota or rate-limit responses such as HTTP `429` return `AI_RATE_LIMITED`.
- Provider HTTP failures, empty provider text, invalid JSON, or schema-mismatched scenario JSON return `AI_PROVIDER_FAILED` with safe details such as provider/model/status/schema issue count. Raw provider payloads remain in Admin > AI Logs.
- The Scenario create/edit UI must render these errors inline below `Generate scenario with AI` as readable multi-line text. It must not hide the error by falling back to sample attribute data.

### `POST /api/v1/templates`

Creates a kịch bản/scenario manually from user-defined attributes/options. Frontend may parse attributes/options from a compact schema textarea such as `videoPurpose=Storytelling,Commercial;` and `genre=Folk Tale,Drama;`, or from compatible JSON, before sending the normalized `attributes` array.

### `PATCH /api/v1/templates/{templateId}`

Updates scenario name, description, idea or attributes/options JSON.

### `DELETE /api/v1/templates/{templateId}`

Soft deletes a scenario by marking it archived.

### `POST /api/v1/templates/{templateId}/default`

Makes the scenario the current user's default scenario and clears the default flag from other active scenarios owned by the same user. If the default scenario is deleted later, the newest remaining active scenario becomes default.

## 8. Shot APIs

### `GET /api/v1/shots`

Lists all active shot plans owned by the current user. Shot plans are reusable by any project owned by the same user. The current user default is returned first.

### `POST /api/v1/shots/generate`

Generates a user-owned shot plan from story content. The API reads the active admin prompt provider/model and uses the optional request `masterPrompt` as a temporary `Shots` prompt override; when omitted, it falls back to the active admin default `Shots` master prompt. It optionally replaces legacy placeholders, appends structured story/attribute/duration context, calls the provider with a saved encrypted provider key or environment API key fallback, stores the redacted raw provider request plus raw response in AI logs/job result, normalizes the returned JSON, and persists the generated shot JSON in PostgreSQL. In the project workspace, `attributes` should include the selected Step 2 Kịch bản/scenario options formatted as compact plan attributes such as `genre=Folk Tale,Drama;`.

For ChatGPT, the provider request uses the OpenAI Responses API with `text.format.type = "json_schema"`, `strict = true`, and `additionalProperties: false` on every schema object. Backend normalization still clamps shot durations to `1-8`.

Request:

```json
{
  "sourceText": "Create a short product introduction video.",
  "durationSeconds": 8,
  "masterPrompt": "You are an expert video shot planner.\n\nStory:\n{story}\n\nScenario attributes:\n{attributes}\n\nTarget seconds per shot: {durationSeconds}",
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

`rawRequest` and `rawResponse` are stored in the job result and AI logs, and can be displayed from the latest job result through project workspace review popups. `content.video_shot_plans` stores normalized plan-level `attributes` and `shotPlan.shots` JSON, not separate raw request/response columns. Each normalized shot must include `Start state`, `End state` and `Dialogue` attributes; UI renders `Dialogue` as a dedicated textarea while persisting it in the shot JSON.

Failure behavior:

- Missing key for the active prompt provider returns a failed job with `AI_CONFIG_MISSING`. Key lookup order is saved encrypted provider key first, then provider-specific env fallback.
- Provider quota or rate-limit responses such as HTTP `429` return a failed job with `AI_RATE_LIMITED`.
- Provider HTTP failures or invalid JSON return a failed job with `AI_PROVIDER_FAILED`.
- The system must not create fake shot data when provider execution fails.

### `PATCH /api/v1/shots/{shotPlanId}`

Updates shot plan name, default duration, plan-level `attributes` or `shots` JSON after user edits.

### `GET /api/v1/shots/{shotPlanId}`

Returns one active shot plan owned by the current user.

### `DELETE /api/v1/shots/{shotPlanId}`

Soft deletes a shot plan by marking it archived.

### `POST /api/v1/shots/{shotPlanId}/default`

Makes the shot plan the current user's default script/shot plan and clears the default flag from other active shot plans owned by the same user. If the default shot plan is deleted later, the newest remaining active shot plan becomes default.

Compatibility endpoints retained during migration:

- `GET /api/v1/projects/{projectId}/shots`
- `POST /api/v1/projects/{projectId}/shots/generate`
- `PATCH /api/v1/projects/{projectId}/shots/{shotPlanId}`
- `DELETE /api/v1/projects/{projectId}/shots/{shotPlanId}`

New frontend code should use the user-level `/api/v1/shots` endpoints.

## 9. Prompt and Script APIs

### `POST /api/v1/projects/{projectId}/prompts/generate`

Starts Step 1 Story Content generation from Script Flow. The optional `masterPrompt` is a temporary `Scripts`/Story Content master prompt override for this request only; when omitted, runtime uses the active admin default. This endpoint calls the active prompt provider/model; it must not return locally generated fallback content when provider execution fails.

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

- Missing key for the active prompt provider returns a failed job with `AI_CONFIG_MISSING`. Key lookup order is saved encrypted provider key first, then provider-specific env fallback.
- Provider quota/rate-limit status such as HTTP `429` returns `AI_RATE_LIMITED`.
- Provider HTTP failures, unsupported providers, or empty provider text return `AI_PROVIDER_FAILED`.
- The user workspace should show the safe error details inline under `Generate Story Content`; successful job raw request/response can be opened from the adjacent workspace `Request`/`Response` buttons and from Admin > AI Logs, with secrets redacted.

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

Starts video generation from final prompt or script.

Request:

```json
{
  "promptId": "prompt_001",
  "scriptId": "script_001",
  "finalPrompt": "Final approved prompt text."
}
```

Response:

```json
{
  "data": {
    "videoGenerationId": "video_gen_001",
    "jobId": "job_video_001",
    "status": "queued"
  }
}
```

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
- `env`: no saved key is available, but the provider env fallback exists.
- `missing`: neither saved key nor env fallback is available.

### `PUT /api/v1/admin/ai-config`

Updates content mode and models.

Admin UI submits free-form provider/model values. The API normalizes provider names to lowercase and accepts any non-empty provider string; runtime provider execution still requires a matching adapter.

Request:

```json
{
  "contentMode": "script",
  "promptProvider": "chatgpt",
  "promptModel": "gpt-5.5",
  "videoProvider": "veo",
  "videoModel": "veo-default"
}
```

### `PUT /api/v1/admin/ai-config/provider-keys/{provider}`

Creates or rotates a provider API key. The provider path is normalized to lowercase before storage. The response returns key status only and never returns key material.

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

Tests the active key source for a provider/model pair. If `apiKey` is supplied, the API tests that unsaved key. If omitted, it uses the saved encrypted key and then env fallback. Live connectivity checks are implemented for `gemini`/`google` and `chatgpt`/`openai`; other provider names return success only when a key source is available because no generic provider URL exists.

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

Returns active master prompts grouped by type. Each group has one current default prompt. If no DB prompt exists for a type, the response includes a read-only built-in default prompt for that type.

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
            "name": "Built-in Scripts master prompt",
            "content": "Create readable script and prompt content.",
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
          "name": "Built-in Scripts master prompt",
          "content": "Create readable script and prompt content.",
          "isDefault": true,
          "status": "active",
          "isBuiltIn": true,
          "createdAt": "1970-01-01T00:00:00.000Z",
          "updatedAt": "1970-01-01T00:00:00.000Z"
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
  "content": "Split the script into continuous visual shots."
}
```

Validation:

- `type` must be `scenario`, `shots` or `scripts`.
- `name` and `content` are required.
- Content may keep the recommended placeholder format, but placeholders are optional and saves do not validate their presence.
- Recommended placeholders by type: `scenario` uses `{story}`, `{attributes}`; `shots` uses `{story}`, `{attributes}`, `{durationSeconds}`; `scripts` uses `{inputText}`, `{mediaSummary}`, `{shotSelection}`, `{scenarioSelection}`.

### `PATCH /api/v1/admin/master-prompts/{id}`

Updates prompt name and/or content.

Request:

```json
{
  "name": "Narrative shots v2",
  "content": "Updated instructions."
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

### Legacy `GET/PATCH /api/v1/admin/shot-prompt`

Kept for read/write compatibility during migration. New admin UI should use `/admin/master-prompts`.

- `GET` resolves the default `shots` and `scenario` master prompts, with legacy `config.ai_site_configs` prompt columns as fallback.
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
