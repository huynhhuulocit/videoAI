# Cấu hình AI cho Admin

## Current Local Implementation

- Active site-wide config is stored in PostgreSQL table `config.ai_site_configs`.
- Provider key status is stored in PostgreSQL table `config.ai_provider_keys`.
- API responses return configured/missing status only and never return key material.
- The current local provider-key storage encrypts key material with an application key derived from `AI_CONFIG_ENCRYPTION_KEY`; production should move this to KMS or a managed secret store.

## 1. Mục tiêu

Admin có thể quản lý cấu hình AI áp dụng cho toàn site. Cấu hình này quyết định model mặc định cho tạo prompt/script và model/API key dùng cho tạo video.

## 2. Cấu hình tạo prompt/script

Admin có thể chọn provider và model mặc định dùng cho các tác vụ tạo prompt/script.

Provider/model gợi ý:

- Gemini
- ChatGPT
- OpenAI
- UI admin dùng input tự do cho provider và model, kèm chip gợi ý. Admin có thể nhập bất kỳ provider hoặc model ID nào mà không cần code mới, nhưng backend chỉ live-call các provider đã có adapter.

Yêu cầu:

- Cấu hình áp dụng cho toàn site.
- Hệ thống phải lưu provider/model mặc định.
- Admin có ô nhập API key cho provider prompt/script/shot. Key được lưu mã hóa, không hiển thị plain text sau khi lưu.
- Nếu provider prompt không có key đã lưu, backend fallback sang env tương ứng: `OPENAI_API_KEY` cho `chatgpt`/`openai`, `GEMINI_API_KEY` cho `gemini`/`google`, hoặc `<PROVIDER>_API_KEY` cho provider khác.
- Admin có nút `Test connect` cho provider/model prompt. Test live hỗ trợ `gemini` và `chatgpt`/`openai`; provider khác chỉ xác nhận key source cho đến khi có adapter.
- ChatGPT Plus là quyền dùng giao diện ChatGPT, không thay thế OpenAI API key cho app. Khi dùng provider `chatgpt`/`openai`, admin vẫn cần lưu OpenAI API key hoặc cấu hình `OPENAI_API_KEY`.
- Khi user gọi `Generate`, hệ thống dùng provider/model đang được admin cấu hình.
- Khi user gọi `Generate shots`, hệ thống dùng provider/model prompt đang được admin cấu hình và đọc key theo thứ tự: key đã lưu, sau đó fallback env.
- Khi user bấm `Generate scenario with AI` trong trang thêm/sửa Scenario hoặc bấm `Phân tích kịch bản` trong project workspace, hệ thống dùng default `Scenario` master prompt do admin quản lý; user có thể sửa tạm master prompt cho một lần gọi AI. Backend luôn nối thêm runtime context có cấu trúc sau master prompt.
- Khi user gọi `Generate shots`, hệ thống dùng default `Shots` master prompt do admin quản lý, nối thêm story, attribute và duration context có cấu trúc, rồi gọi provider/model prompt đang active. Provider contract luôn yêu cầu mỗi shot có `Start state`, `End state` và `Dialogue` để UI có thể hiển thị textarea lời thoại riêng.
- Khi user bấm `Generate` trong Script Flow để tạo prompt/content, hệ thống dùng default `Scripts` master prompt do admin quản lý và nối thêm input, media, shot selection và scenario selection context có cấu trúc.
- Khi user bấm `Tạo Prompt` trong từng shot, hệ thống dùng prompt composer tương thích legacy để render prompt cục bộ từ source, thông tin shot, lời thoại, attribute, kịch bản đã chọn và media. Hành động này không gọi AI.
- Nếu provider/model chưa được cấu hình, hệ thống phải hiển thị lỗi cấu hình thiếu hoặc dùng default an toàn được định nghĩa trong FSD/TSD.
- Nếu thiếu key môi trường của provider đang active, job `shot_generation` phải failed với `AI_CONFIG_MISSING` và không được tạo dữ liệu shot giả.
- Khi admin thay đổi provider/model, cấu hình mới được áp dụng ở lần gọi AI tiếp theo.

## 2.1. Cấu hình Master Prompt

Admin có thể mở menu `Master Prompt` trong dashboard admin để quản lý 3 nhóm prompt con:

- `Scenario`: workflow `template_generation` để tạo kịch bản/scenario từ video idea và workflow `template_selection` để phân tích kịch bản và chọn option phù hợp.
- `Shots`: workflow `shot_generation` và API `/shots` để tạo shot plan.
- `Scripts`: Script Flow prompt/content generation.

Yêu cầu:

- Mỗi nhóm prompt áp dụng toàn site và có đúng một default active.
- Admin có thể tạo, sửa, archive/xóa và `Set default` từng prompt trong mỗi nhóm.
- Không được xóa prompt đang là default; admin phải chọn prompt khác làm default trước.
- Master prompt vẫn giữ format placeholder để admin dễ đọc và tái sử dụng, nhưng placeholder không bắt buộc khi lưu.
- Placeholder khuyến nghị theo nhóm: `Scenario` dùng `{story}`, `{attributes}`; `Shots` dùng `{story}`, `{attributes}`, `{durationSeconds}`; `Scripts` dùng `{inputText}`, `{mediaSummary}`, `{shotSelection}`, `{scenarioSelection}`.
- Backend replace placeholder nếu có, rồi luôn nối runtime context có cấu trúc sau master prompt được chọn để provider request không phụ thuộc placeholder.
- Nếu chưa có prompt trong bảng `config.master_prompts`, backend dùng built-in default read-only cho nhóm tương ứng. Các cột prompt legacy trong `config.ai_site_configs` vẫn được đọc làm fallback trong giai đoạn migration.
- User page `/shots` chỉ hiển thị tóm tắt prompt cố định, không cho user chỉnh prompt site-wide.

## 3. Cấu hình tạo video

Admin có thể nhập API key và chọn model tạo video.

Provider/model gợi ý:

- Veo
- Gemini

Yêu cầu:

- Cấu hình áp dụng cho toàn site.
- Admin có ô nhập API key cho provider tạo video.
- API key phải được lưu ở dạng bảo mật, không hiển thị plain text sau khi lưu.
- Nếu provider video không có key đã lưu, backend fallback sang env tương ứng giống provider prompt.
- UI chỉ hiển thị trạng thái key: `configured`, `env` hoặc `missing`.
- Admin có thể cập nhật hoặc xóa API key.
- Admin có thể nhập bất kỳ model tạo video nào, kèm chip gợi ý cho model phổ biến.
- Admin có thể dùng `Test connect`; provider có adapter thì test live, provider chưa có adapter thì xác nhận key source.
- Khi user click `Tạo video`, hệ thống dùng provider/model/API key đang được admin cấu hình.
- Nếu thiếu API key hoặc model, hệ thống phải chặn tạo video và hiển thị lỗi cấu hình rõ ràng.

## 4. Cấu hình chế độ user

Admin có thể bật/tắt chế độ hành động chính của user:

- `Tạo script`: User chỉ tạo prompt/script từ nội dung đã nhập, URL sản phẩm hoặc media mẫu.
- `Tạo video`: User tạo video từ prompt/script cuối cùng đã xác nhận.

Yêu cầu:

- Tại một thời điểm, toàn site dùng một chế độ chính.
- Cấu hình phải áp dụng cho cả luồng tạo video theo kịch bản và theo thông tin sản phẩm.
- Nếu admin đổi chế độ, user thấy hành động mới sau khi tải lại trang hoặc mở lại luồng tạo nội dung.

## 5. Bảo mật

- Không ghi API key, access token hoặc secret vào log request/response AI.
- Không trả API key về client sau khi lưu.
- Chỉ admin có role `admin` mới được xem và cập nhật cấu hình AI.
- Mọi thay đổi cấu hình nên có audit log gồm admin thực hiện, thời gian và loại cấu hình thay đổi.
