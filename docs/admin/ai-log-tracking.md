# Log request/response AI

## Current Local Implementation

- AI request logs are stored in PostgreSQL table `ai_logs.ai_request_logs`.
- AI response/error logs are stored in PostgreSQL table `ai_logs.ai_response_logs`.
- The admin log list and detail APIs read from these tables.
- Media references are stored as metadata/IDs only; raw file bytes and secrets must never be written to log payloads.

## 1. Mục tiêu

Hệ thống cần tạo log để tracking request trước khi submit tới AI và response sau khi AI trả về. Log giúp admin debug chất lượng prompt, lỗi provider, thời gian xử lý và kết quả AI.

## 2. Phạm vi log

Hệ thống cần ghi log cho các tác vụ:

- Generate kịch bản/prompt từ text user nhập.
- Generate Scenario templates (`template_generation`) from a free-text video idea and the active `Scenario` master prompt.
- Phân tích URL sản phẩm.
- Phân tích hình ảnh/video mẫu.
- Tạo shot plan (`shot_generation`) từ nội dung Script Flow hoặc menu `Shots`.
- Tạo script.
- Tạo video.

## 3. Thời điểm ghi log

### 3.1. Trước khi submit tới AI

Hệ thống tạo log request ngay trước khi gọi provider AI.

Thông tin cần ghi:

- `requestId`
- `timestamp`
- `actorUserId`
- `actorRole`
- `projectId`
- `flowType`: `script_prompt`, `product_url`, `media_analysis`, `script_generation`, `video_generation`, `template_generation`, `shot_generation`
- `provider`: ví dụ `gemini`, `chatgpt`, `veo`
- `model`
- `requestPayload`
- `mediaReferences`
- `status`: `pending`

### 3.2. Sau khi AI trả về

Hệ thống cập nhật log với response AI.

Thông tin cần ghi:

- `responsePayload`
- Với `template_generation`, `requestPayload` phải gồm video idea, optional temporary Scenario master prompt override, and raw provider request đã redact secret. `responsePayload` phải gồm raw provider request, raw AI JSON, normalized Scenario template or safe error details. Provider failure must not be hidden by fake/sample scenario data.
- Với `shot_generation`, `requestPayload` phải gồm raw provider request đã redact secret. Khi provider là ChatGPT, raw request phải thể hiện OpenAI Responses API JSON schema strict với `additionalProperties: false` để admin debug lỗi schema/provider. `responsePayload` phải gồm raw provider request, raw AI JSON và shot plan đã normalize trong job result; không lưu API key hoặc raw binary media.
- `status`: `success` hoặc `failed`
- `errorCode`
- `errorMessage`
- Provider quota/rate-limit failures, including ChatGPT/OpenAI `insufficient_quota`, should be recorded as `AI_RATE_LIMITED` with the provider's raw error payload redacted and available in the response detail.
- `latencyMs`
- `tokenUsage` nếu provider hỗ trợ
- `costEstimate` nếu provider hỗ trợ
- `completedAt`

## 4. Bảo mật log

- Không log API key, access token, refresh token hoặc secret.
- Không log raw binary của hình ảnh/video.
- `mediaReferences` chỉ lưu metadata hoặc đường dẫn object storage nội bộ.
- Nếu request có dữ liệu nhạy cảm, hệ thống cần mask trước khi lưu log.
- Chỉ admin có role `admin` mới được xem log AI.

## 5. Định dạng log đề xuất

Log có thể lưu trong database hoặc file theo dạng JSON Lines.

Ví dụ một record:

```json
{
  "requestId": "ai_req_001",
  "timestamp": "2026-05-16T10:00:00+07:00",
  "actorUserId": "user_001",
  "actorRole": "user",
  "projectId": "project_001",
  "flowType": "product_url",
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "requestPayload": {
    "productUrl": "https://example.com/product",
    "prompt": "Tạo video giới thiệu sản phẩm..."
  },
  "mediaReferences": [
    {
      "fileId": "media_001",
      "type": "image",
      "mimeType": "image/png",
      "sizeBytes": 1200000
    }
  ],
  "responsePayload": {
    "summary": "AI đã phân tích sản phẩm và tạo prompt đề xuất.",
    "generatedPrompt": "..."
  },
  "status": "success",
  "latencyMs": 3200,
  "completedAt": "2026-05-16T10:00:03+07:00"
}
```

## 6. Chức năng xem log trong Admin

- Admin có thể xem danh sách log AI.
- Admin có thể lọc theo thời gian, user, project, provider, model, flow type và status.
- Admin có thể xem chi tiết request/response của từng log.
- Admin có thể copy requestId để debug.
- Admin có thể xem lỗi provider khi request thất bại.
- `prompt_generation` / Story Content generation là request provider thật. Job thành công lưu provider request đã redact và raw provider response trong AI logs; job thất bại lưu safe details như code, provider, model, env fallback, HTTP status và job/request identifier. Workspace user không hiển thị API key hoặc raw provider payload.
