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
- Admin có ô nhập API key cho provider prompt/script/shot. Key được lưu mã hóa bằng nút `Save configuration` chung, không hiển thị plain text sau khi lưu.
- Nếu provider prompt không có key đã lưu trong Admin > AI Config, backend trả lỗi cấu hình thiếu. Không dùng env key làm fallback runtime.
- Admin có nút `Test connect` cho provider/model prompt. Test live hỗ trợ `gemini` và `chatgpt`/`openai`; provider khác chỉ xác nhận key source cho đến khi có adapter.
- ChatGPT Plus là quyền dùng giao diện ChatGPT, không thay thế OpenAI API key cho app. Khi dùng provider `chatgpt`/`openai`, admin phải lưu OpenAI API key trong Admin > AI Config.
- Khi user gọi `Generate`, hệ thống dùng provider/model đang được admin cấu hình.
- Khi user gọi AI, hệ thống dùng provider/model prompt đang được admin cấu hình và chỉ đọc key đã lưu mã hóa trong database.
- Khi user bấm `Generate scenario with AI` trong trang thêm/sửa Scenario hoặc bấm `Phân tích kịch bản` trong project workspace, hệ thống dùng default `Scenario` master prompt do admin quản lý; user có thể sửa tạm master prompt cho một lần gọi AI. Backend chỉ replace placeholder có trong prompt và không tự nối runtime context ẩn.
- Khi user gọi `Generate shots`, hệ thống dùng default `Shots` master prompt do admin quản lý, replace placeholder có trong prompt, rồi gọi provider/model prompt đang active. Provider schema/normalization vẫn yêu cầu mỗi shot có `Start state`, `End state` và `Dialogue` để UI có thể hiển thị textarea lời thoại riêng.
- Khi user bấm `Generate Story Content` trong Scenario hoặc One Click, hệ thống dùng default `Story Content` master prompt do admin quản lý và chỉ đưa Story Content source text hoặc Story attributes vào prompt nếu prompt có placeholder tương ứng. API vẫn dùng type key `scripts` cho nhóm này để tương thích dữ liệu hiện tại.
- Khi user bấm `Prompt` trong từng shot ở Step 4, hệ thống dùng active admin `Shot` master prompt để render prompt cục bộ cho riêng shot đó. `Shot` khác với `Shots`: `Shots` tạo danh sách shot JSON ở Step 3, còn `Shot` tạo prompt cuối cùng cho một shot ở Step 4. Dữ liệu chỉ đi vào prompt qua placeholder explicit như `{storyContent}`, `{shotTitle}`, `{shotDescription}`, `{shotDialogue}`, `{shotDuration}`, `{shotGeneratedAttributes}`, `{shotAttributes}`, `{referenceMedia}` và `{outputFormat}`; không append runtime context ẩn hoặc dùng legacy composer fallback.
- Nếu provider/model, API key hoặc master prompt chưa được cấu hình, hệ thống phải hiển thị lỗi cấu hình thiếu. Không tự dùng default/fallback runtime.
- Nếu thiếu key đã lưu của provider đang active, job AI phải failed với `AI_CONFIG_MISSING` và không được tạo dữ liệu giả.
- Khi admin thay đổi provider/model hoặc nhập API key mới, cấu hình mới được áp dụng ở lần gọi AI tiếp theo sau khi bấm `Save configuration`.
- Admin có `Site Config` setting `Show master prompts in user workspace` với giá trị `Yes/No`, mặc định `No`. Khi `No`, Project và One Click ẩn các textarea master prompt Story Content, Scenario và Shots trong user workspace; nút `Prompt` debug vẫn hiển thị để user kiểm tra rendered prompt. Khi ẩn, frontend không gửi temporary `masterPrompt` override và backend chặn override nếu user gửi thủ công; AI dùng active admin default prompt.
- Admin > AI Config hiển thị các block `Content mode`, `Site Config`, `Prompt provider/model`, và `Video provider/model` trong một cột, mặc định thu gọn. Nút `Save configuration` xuất hiện ở góc phải đầu và cuối form. Không có nút `Save key` riêng; API key mới được lưu cùng lần save cấu hình chung.

## 2.1. Cấu hình Master Prompt

Admin có thể mở các nhóm trong dashboard admin để quản lý prompt con:

- `Scenario`: workflow `template_generation` để tạo kịch bản/scenario từ video idea và workflow `template_selection` để phân tích kịch bản và chọn option phù hợp.
- `Shots`: workflow `shot_generation` for Project and One Click shot plan creation.
- `Shot`: workflow Step 4 để tạo prompt cuối cùng cho từng shot riêng lẻ.
- `Story Content` (`scripts` type key): transforms the user's rough source text into richer Story Content for Scenario and Shots steps.

Admin UI renders these groups as child items under the non-clickable `Story`, `Scenario`, `Shots`, and `Shot` admin groups. Clicking a `Master Prompt` child route opens a list-only CRUD view for that prompt type; the editor opens only after `New prompt` or `Edit` is selected. If a row is the built-in template, `Edit` opens `/new?source=built-in` as an editable copy and `Save` creates the first database prompt for that group. Canonical list routes are `/admin/story/master-prompt`, `/admin/scenario/master-prompt`, `/admin/shots/master-prompt`, and `/admin/shot/master-prompt`. Canonical editor routes are `/admin/{story|scenario|shots|shot}/master-prompt/new` and `/admin/{story|scenario|shots|shot}/master-prompt/{promptId}`. `/admin/shot-prompt` and old `/admin/shot-prompt/...` routes remain compatibility redirects.

Yêu cầu:

- Mỗi nhóm prompt áp dụng toàn site và có đúng một default active.
- Admin có thể tạo, sửa, archive/xóa và `Set default` từng prompt trong mỗi nhóm.
- Không được xóa prompt đang là default; admin phải chọn prompt khác làm default trước.
- Master prompt vẫn giữ format placeholder để admin dễ đọc và tái sử dụng, nhưng placeholder không bắt buộc khi lưu.
- Placeholder khuyến nghị theo nhóm: `Story Content` dùng `{storyContent}`, `{storyAttributes}`, `{outputFormat}`; `Scenario` dùng `{story}`, `{attributes}`, `{scenarioAttributes}`, `{outputFormat}`; `Shots` dùng `{story}`, `{attributes}`, `{scenarioAttributes}`, `{shotsAttributes}`, `{outputFormat}`; `Shot` dùng `{storyContent}`, `{shotTitle}`, `{shotDescription}`, `{shotDialogue}`, `{shotDuration}`, `{shotGeneratedAttributes}`, `{shotAttributes}`, `{referenceMedia}`, `{outputFormat}`.
- Each Story Content, Scenario, Shots, and Shot master prompt editor includes an `Output Format placeholder` textarea. That text is inserted into the provider prompt only when `Prompt content` contains `{outputFormat}`. If `{outputFormat}` is present but the Output Format field is empty, save/preview/runtime must fail with a clear error instead of using fallback text.
- Each Story Content, Scenario, Shots, and Shot master prompt editor also shows the matching admin Attribute catalog below `Master Prompt Attribute`: Story Content shows `Story Attribute`, Scenario shows `Scenario Attribute`, Shots shows `Shots Attribute`, and Shot shows `Shot Attribute`. Admin can select options per master prompt record; those selections are saved separately from the global Master Prompt Config selection.
- Admin UI hiển thị danh sách placeholder ngay dưới `Prompt content` để admin click chèn token. Danh sách chỉ hiển thị token; mô tả nằm sau helper icon để hover/click xem khi cần. Khi admin nhập `{...`, textarea cũng gợi ý placeholder hợp lệ cho nhóm đang chỉnh; admin có thể click hoặc nhấn Enter/Tab để chèn token chính xác.
- Admin editor có nút `Prompt` để xem preview chính xác của draft master prompt. Preview render `{masterPromptAttributes}` từ selection admin đang chọn, render placeholder attribute theo type khi admin đã chọn option trong section Story/Scenario/Shots Attribute, và render `{outputFormat}` từ Output Format; các placeholder runtime khác của user được giữ nguyên vì editor admin không có dữ liệu runtime user.
- Backend replace placeholder nếu có và không tự nối runtime context ẩn sau master prompt. Runtime data chỉ xuất hiện trong prompt khi prompt có placeholder tương ứng.
- Runtime AI chỉ dùng active default prompt trong bảng `config.master_prompts` hoặc prompt override tạm thời từ request. Nếu thiếu active default prompt, request failed với lỗi cấu hình thiếu. Built-in prompt chỉ là template tham khảo trong admin UI, không phải fallback runtime.
- User-facing `/shots*` pages redirect to `/projects`; shot generation is handled inside Project and One Click workspaces.

## 3. Cấu hình tạo video

Admin có thể nhập API key và chọn model tạo video.

Provider/model gợi ý:

- Veo
- Gemini

Yêu cầu:

- Cấu hình áp dụng cho toàn site.
- Admin có ô nhập API key cho provider tạo video và lưu bằng nút `Save configuration` chung.
- API key phải được lưu ở dạng bảo mật, không hiển thị plain text sau khi lưu.
- Nếu provider video không có key đã lưu, backend trả lỗi cấu hình thiếu.
- UI chỉ hiển thị trạng thái key: `configured` hoặc `missing`.
- Admin có thể cập nhật API key bằng cách nhập key mới và bấm `Save configuration`.
- Admin có thể nhập bất kỳ model tạo video nào, kèm chip gợi ý cho model phổ biến.
- Admin có thể dùng `Test connect`; provider có adapter thì test live, provider chưa có adapter thì xác nhận key source.
- Khi user click `Tạo video`, hệ thống dùng provider/model/API key đang được admin cấu hình.
- Khi user click `Create video` trong từng shot card của project workspace, API gửi prompt cục bộ đã compose cho shot đó tới provider/model video đang active, lưu raw request/response đã redact và hiển thị lỗi chi tiết nếu provider/key/model thất bại. Không được trả fake success/fallback video data.
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
## 6. Attribute Catalog Administration

- Story, Scenario, Shots, and Shot attribute catalogs are admin-managed and separate from provider/model AI Config.
- Each type has its own Attribute Generation Prompt. This prompt is not a Master Prompt and is used only to generate or edit catalog JSON.
- Story, Scenario, Shots, and Shot `Attribute` menu pages show catalog lists only. Admins create or edit a catalog on dedicated routes such as `/admin/scenario/attributes/new`, `/admin/shots/attributes/{catalogId}`, or `/admin/shot/attributes/{catalogId}`.
- Attribute editor pages keep Prompt, Request, and Response controls next to the AI generation action so admins can inspect the exact generated prompt and latest raw provider payloads for that generation.
- Scenario management is admin-only; user dashboards no longer own Scenario catalogs.
- Required attributes are configured in the admin Attribute editor. User workflows auto-select the first option for required attributes but still allow users to change or multi-select options.
- Runtime data enters AI prompts only through explicit placeholders in the selected Master Prompt.

## 7. Admin-Only Master Prompt Config

- `Master Prompt Config` is an admin-only page under the AI admin area.
- It stores one global attribute/option config used only by prompt authors when editing Story Content, Scenario, Shots, and Shot master prompts.
- Admins build the config as JSON with `id`, `name`, optional `description`, and `options[]` where each option also has `id`, `name`, and optional `description`.
- Story Content, Scenario, Shots, and Shot master prompt editors show a read/select `Master Prompt Attribute` section. Admins can select configured options for each master prompt but cannot edit the global config from that section.
- The `Master Prompt Attribute` section shows attribute and option names only by default. Attribute/option descriptions are exposed through helper icons and are not rendered into `{masterPromptAttributes}`.
- The admin-only placeholder is `{masterPromptAttributes}`. It appears only in admin master prompt placeholder suggestions.
- User Project and One Click screens must not show Master Prompt Attribute selectors or suggest `{masterPromptAttributes}`.
- Runtime replaces `{masterPromptAttributes}` only with the selection saved on the active admin master prompt. If the token is absent, no Master Prompt Config data is included.
- Temporary user prompt overrides containing `{masterPromptAttributes}` are invalid and must be rejected with a readable validation error.
