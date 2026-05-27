# Luồng người dùng - VideoAI

## 1. Vai trò

### 1.1. Khách chưa đăng nhập

Khách chưa đăng nhập có thể truy cập trang chủ và bắt đầu luồng đăng nhập.

### 1.2. User

User là người dùng đã đăng nhập. Sau khi đăng nhập thành công, user được chuyển vào dashboard user để tạo dự án, tạo script hoặc tạo video.

### 1.3. Admin

Admin là người dùng có quyền quản trị. Admin có thể đăng ký, đăng nhập và truy cập dashboard admin. Dashboard admin chỉ dành cho tài khoản có role `admin`.

## 2. Luồng User

### 2.1. Truy cập và đăng nhập

1. Khách truy cập trang chủ.
2. Khách click nút `Login`.
3. Hệ thống hiển thị form đăng nhập.
4. User nhập tài khoản `user` và mật khẩu `User@123`.
5. Hệ thống xác thực thông tin đăng nhập.
6. Nếu đăng nhập thành công, hệ thống chuyển user vào dashboard user.
7. Nếu đăng nhập thất bại, hệ thống hiển thị thông báo lỗi phù hợp.

### 2.2. Dashboard User và tạo dự án

1. User truy cập dashboard sau khi đăng nhập.
2. Dashboard hiển thị danh sách dự án hiện có nếu có dữ liệu.
3. Sidebar có menu `Projects` để user mở danh sách tất cả project của mình.
4. Dashboard và trang `Projects` có nút `Tạo dự án`.
5. User click `Tạo dự án`.
6. Hệ thống hiển thị form tạo dự án.
7. User nhập thông tin dự án cần thiết.
8. User chọn một trong hai flow:
   - `Scenario`: dùng khi user muốn bắt đầu từ ý tưởng, prompt hoặc kịch bản.
   - `Product Flow`: dùng khi user muốn bắt đầu từ URL sản phẩm và media tham khảo.
9. User xác nhận tạo dự án.
10. Hệ thống tạo dự án mới, lưu flow đã chọn và chuyển user vào trang chi tiết dự án.
11. Trong chi tiết dự án, hệ thống chỉ hiển thị workspace đúng với flow đã chọn khi tạo dự án.

### 2.2.1. One Click wizard

1. User mở menu `One Click` trong sidebar user.
2. Hệ thống hiển thị trang Start để user nhập project name và description.
3. Khi user xác nhận, hệ thống tạo một project bình thường với `flowType = script` qua API project hiện có và chuyển sang `/one-click/{projectId}`.
4. Wizard chỉ hiển thị một step tại một thời điểm và có nút `Back` / `Next`.
5. Step 1 hiển thị Story Content textarea, `Generate Story Content`, `Prompt`, `Request` và `Response` giống Project Scenario. `Story Content` master prompt chỉ hiển thị khi Admin Site Config `showUserMasterPrompts=true`. `Next` chỉ bật khi Story Content không rỗng và lưu Story Content vào database trước khi chuyển step.
6. Step 2 là `Scenario` step: hiển thị Story Content và scenario catalog đang được dùng; `Scenario` master prompt chỉ hiển thị khi Admin Site Config `showUserMasterPrompts=true`; không hiển thị dropdown `Choose scenario`.
7. User có thể bấm `Analyze scenario`; hệ thống dùng Story Content, `Scenario` master prompt và catalog attributes/options để AI chọn attributes phù hợp, lưu selection vào project, đồng thời lưu Scenario mới với name/description lấy từ One Click setup. Action row vẫn có `Prompt`, `Request`, `Response`.
8. Step 3 hiển thị `Shots` master prompt chỉ khi Admin Site Config `showUserMasterPrompts=true`; luôn hiển thị `Generate shots`, `Prompt`, `Request`, `Response`, thông báo success/error và shot plan editable giống Project Step 3. Không hiển thị selector chọn shot plan có sẵn; nếu Step 2 đã phân tích thành công, selected scenario attributes được gửi vào shot generation.
9. Shot plan được tạo từ One Click được lưu vào database với name/description lấy từ One Click setup, gắn với project hiện tại và có thể mở lại từ Project workspace.
10. One Click là shortcut UI của `Scenario`, không phải flow type backend/database mới.

### 2.3. Tạo video theo kịch bản

1. User mở một dự án đã được tạo với `Scenario`.
2. Hệ thống hiển thị màn hình nhập kịch bản/prompt.
3. User kiểm tra đúng flow đang làm việc.
4. User nhập hoặc dùng AI tạo nội dung trong section `Bước 1 · Story Content`; section này chỉ hiển thị `Story Content` master prompt do admin quản lý khi Admin Site Config `showUserMasterPrompts=true`. `Story Attributes` nằm ở cột phải trên desktop, mặc định thu gọn giống panel Scenario attributes.
5. Response tạo bằng AI được ghi lại vào textarea Story Content. Textarea này là source chung cho phân tích kịch bản, tạo shots, compose prompt từng shot và tạo script.
6. User chọn Kịch bản trong section `Bước 2 · Kịch bản tạo prompt` để load danh sách attribute/option; trên desktop danh sách này nằm trong panel `Attributes` ở cột phải, mặc định thu gọn, đủ rộng để đọc label/count, và user có thể mở panel rồi mở từng nhóm attribute khi cần chọn option.
7. Workspace chỉ hiển thị `Scenario` master prompt do admin quản lý khi Admin Site Config `showUserMasterPrompts=true`. User có thể sửa tạm master prompt cho lần phân tích hiện tại trong mode đó; khi setting là `false`, generation request không gửi `masterPrompt`.
8. User có thể bấm `Phân tích kịch bản`; hệ thống gửi master prompt, Story Content và runtime catalog attribute/option của Kịch bản tới AI, nhận JSON selection, tự check các option phù hợp và lưu selection vào project.
9. User có thể chỉnh lại checkbox option và bấm `Lưu lựa chọn` để lưu selection hiện tại vào project.
10. User tạo shot plan trong section `Bước 3 · Shots tạo prompt`; Step 3 dùng Story Content ở Bước 1 làm source, chỉ hiển thị `Shots` master prompt để user sửa tạm thời khi Admin Site Config `showUserMasterPrompts=true`, và có thể thu gọn khi không cần chỉnh shots.
11. Step 2 hiển thị textarea `Scenario result`; `Analyze scenario` điền output text từ AI vào textarea này, không auto-select Scenario attribute/option, user có thể sửa thủ công, và `Save selection` hoặc `Save Project` lưu vào database.
12. Step 3 chỉ hiển thị `Shots Attributes` ở cột phải bên cạnh `Shots` master prompt/generate controls; panel này mặc định thu gọn và cho user xem/chỉnh các option được gửi qua `{shotsAttributes}`. Scenario options được chỉnh ở Step 2 và vẫn có thể đi vào `{scenarioAttributes}` nếu prompt có placeholder đó. `Scenario result` đã lưu được dùng cho placeholder `{scenario}` của Step 3.
13. Hệ thống gửi `Scenario result` đã lưu từ `Bước 2` vào `shot_generation` cho placeholder `{scenario}`; các attribute/option ở `Bước 2` vẫn có thể được gửi riêng qua `{scenarioAttributes}` nếu prompt có token đó.
14. Sau khi gọi `Generate shots`, UI hiển thị thông báo thành công nếu shot plan được tạo; nếu provider/config/schema lỗi thì hiển thị lỗi chi tiết ngay dưới action.
15. UI luôn hiển thị `Shots result` ngay dưới action generate. Khi chưa có shot plan thì field trống; khi có shot plan hoặc user paste JSON thì field chứa JSON normalized. User có thể sửa JSON hợp lệ để rebuild shot cards ngay lập tức, rồi bấm `Save shots` để lưu kết quả đã sync.
16. Mỗi shot mặc định 8 giây và chỉ cho phép từ 1 đến 8 giây để phù hợp giới hạn Veo.
16. User có thể chỉnh sửa shot, thêm shot, xóa shot, mở panel `Attributes` trong từng shot để thêm/sửa/xóa attribute giống pattern và độ rộng desktop ở Bước 2, và nhập `Lời thoại` trong textarea riêng của từng shot.
17. Trong từng shot, user có thể upload hình ảnh hoặc video mẫu để mô tả ngữ cảnh, style, bố cục, góc quay, màu sắc hoặc cách trình bày riêng cho shot đó.
18. Hệ thống hiển thị preview media trong đúng shot đã upload và cho phép user xóa từng file.
19. Bên dưới nút `Thêm attribute` của từng shot, user click `Tạo Prompt`.
20. Hệ thống dùng prompt composer tương thích legacy và nối thêm structured context để compose prompt cục bộ cho đúng shot đó, gồm nội dung nguồn, thông tin shot, lời thoại, attribute của shot, media hợp lệ của shot và template option đang chọn; attribute placeholder render theo format `[Attribute Name]: value`, riêng `Dialogue` là `[Voiceover Script]: "..."`.
21. Hệ thống hiển thị prompt theo format dễ đọc với section, bullet/list và icon copy ở góc phải trong shot card.
22. `Scenario` không hiển thị panel `AI suggested content` trong luồng compose prompt cục bộ.
23. User có thể copy prompt để dùng cho bước tạo video/script bên ngoài hoặc workflow tiếp theo.

### 2.3.1. Tạo shot plan trong Scenario

1. User nhập hoặc tạo nội dung trong `Bước 1 · Story Content` của `Scenario`.
2. User kiểm tra ô số giây/shot, mặc định là `8`.
3. User click `Tạo shots`; request sẽ kèm attribute/option đã chọn ở `Bước 2 · Kịch bản tạo prompt`.
4. Hệ thống tạo AI request log với flow type `shot_generation`.
5. Trước hoặc sau khi gọi AI, user có thể bấm `Prompt` cạnh nút `Tạo shots` để xem đúng prompt sau khi thay placeholder optional; hệ thống không tự nối runtime context ẩn. Khi hệ thống gọi provider/model prompt đang active, raw provider request đã redact secret và response JSON thô sẽ bật hai button `Request`/`Response`; click vào từng button mở popup đầy đủ để user kiểm tra.
6. Hệ thống normalize JSON thành shot plan gồm nhiều shot, mỗi shot có tiêu đề, mô tả, thời lượng, textarea lời thoại và danh sách attribute.
7. Shot plan được lưu vào database theo user, có thể chọn lại từ bất kỳ project workspace nào của cùng user.
8. User có thể chỉnh sửa shot plan và lưu lại.
9. Khi user click `Tạo Prompt` trong từng shot, hệ thống compose prompt cục bộ từ shot đó, attribute của shot và template selection hiện tại.

### 2.3.2. Standalone shot plan routes

1. User sidebar no longer shows `Scripts`.
2. Compatibility routes `/shots`, `/shots/new`, and `/shots/{shotPlanId}` redirect to `/projects`.
3. Shot plan generation and editing stay inside Project Scenario and One Click workflows through project-scoped endpoints.

### 2.4. Tạo kịch bản prompt

1. User mở menu `Kịch bản`.
2. Hệ thống chỉ hiển thị danh sách scenario active, gồm action `Thêm`, `Sửa`, `Xóa`; không có `Set default`.
3. User click `Thêm` để mở `/templates/new` hoặc click `Sửa` để mở `/templates/{templateId}`.
4. Trang thêm và trang sửa đều hiển thị `Scenario` master prompt do admin quản lý và ô nhập ý tưởng/prompt video; user có thể sửa tạm master prompt cho lần tạo này và nhập nội dung, ví dụ `tạo 1 video về ngày vui của bé`.
5. User click tạo kịch bản bằng AI.
6. Hệ thống gọi provider/model prompt đang active qua API, chỉ thay placeholder `{story}`/`{attributes}` nếu có trong master prompt, không tự nối runtime context/output instruction ẩn, rồi trả về JSON gồm attribute/option.
7. Nếu provider/key/schema lỗi, UI hiển thị lỗi chi tiết dễ hiểu ngay dưới action tạo AI, gồm mã lỗi, provider/model, env/status/request ID nếu có; hệ thống không dùng dữ liệu mẫu để fallback.
8. UI hiển thị JSON đó thành các nhóm attribute và option trực quan.
9. UI hiển thị textarea schema chứa attribute/option hiện tại theo format ngắn `attribute=option1,option2;`, ví dụ `videoPurpose=Storytelling,Commercial;` và `genre=Folk Tale,Drama;`.
10. User có thể paste schema ngắn hoặc JSON cũ dạng mảng attributes/object `attributes`, parse trước khi lưu.
11. User có thể nhập trực tiếp `description` trong JSON schema hoặc field description của từng attribute/option để tạo giải thích cho người dùng đọc hiểu. JSON dùng option `name` cho ngắn gọn; hệ thống convert sang label/value nội bộ khi lưu để xử lý prompt. Dữ liệu cũ có `translate`, `label` hoặc `value` vẫn parse được.
12. User có thể thêm attribute mới, thêm hoặc xóa option trong từng attribute.
13. User có thể lưu kịch bản; danh sách `/templates` cho phép xóa/archive nhưng không có `Set default`.
14. Hệ thống lưu JSON attribute/option đã normalize vào database để project workspace có thể load lại; trong workspace, helper icon trên attribute/option hiển thị lại mô tả đã lưu khi hover hoặc click.

### 2.5. Tạo video theo thông tin sản phẩm

1. User mở một dự án đã được tạo với `Product Flow`.
2. Hệ thống hiển thị ô nhập URL sản phẩm.
3. User kiểm tra đúng flow đang làm việc.
4. User nhập URL sản phẩm.
5. User có thể upload hình ảnh hoặc video mẫu của sản phẩm, video quảng cáo tham khảo, ảnh lifestyle hoặc media mô tả phong cách mong muốn.
6. Hệ thống hiển thị preview media đã upload và cho phép user xóa từng file trước khi phân tích.
7. User có thể chọn template, attribute và nhiều option trong từng attribute để định hướng prompt.
8. User click `Phân tích sản phẩm`.
9. Hệ thống dùng AI để phân tích URL sản phẩm, media mẫu hợp lệ và template selection.
10. Hệ thống tạo prompt/script gợi ý dựa trên thông tin sản phẩm, nội dung media mẫu, template selection và mục tiêu tạo video.
11. Hệ thống hiển thị kết quả phân tích, bao gồm thông tin chính của sản phẩm, insight từ media mẫu và prompt/script do AI tạo.
12. User có thể chỉnh sửa prompt/script được AI tạo.
13. Tùy theo cấu hình admin, hệ thống hiển thị hành động phù hợp:
    - Nếu bật chế độ tạo prompt/script: user có thể click `Tạo script`.
    - Nếu bật chế độ tạo video: user có thể click `Tạo video`.
14. Khi user click `Tạo script`, hệ thống tạo script dựa trên prompt/script sau phân tích và lưu vào dự án.
15. Khi user click `Tạo video`, hệ thống tạo video dựa trên prompt/script sau phân tích và lưu kết quả vào dự án.

## 3. Luồng Admin

### 3.1. Đăng ký và đăng nhập Admin

1. Admin truy cập trang admin.
2. Nếu chưa có tài khoản, admin có thể đăng ký tài khoản admin đơn giản.
3. Admin có thể đăng nhập bằng tài khoản `admin` và mật khẩu `Admin@123`.
4. Hệ thống xác thực tài khoản và role.
5. Nếu tài khoản có role `admin`, hệ thống chuyển vào dashboard admin.
6. Nếu tài khoản không có role `admin`, hệ thống từ chối truy cập và hiển thị thông báo không có quyền.

### 3.2. Dashboard Admin

1. Admin đăng nhập thành công và truy cập dashboard admin.
2. Dashboard admin có menu bên trái.
3. Menu bên trái hiển thị các nhóm cấu hình dành cho site.
4. Admin chọn mục cấu hình tạo nội dung/video.
5. Hệ thống hiển thị cấu hình chế độ user:
   - Cho phép user tạo prompt/script.
   - Cho phép user tạo video.
6. Admin chọn provider/model mặc định cho tạo prompt.
7. Admin mở child `Master Prompt` trong nhóm `Story`, `Scenario`, `Shots` hoặc `Shot`. Các route `/admin/story/master-prompt`, `/admin/scenario/master-prompt`, `/admin/shots/master-prompt`, `/admin/shot/master-prompt` chỉ hiển thị list; `New prompt` mở `/new`, `Edit` mở `/{promptId}`, built-in row mở `/new?source=built-in`, và route tương thích `/admin/shot-prompt` vẫn redirect về route phù hợp. Nhóm `Story Content` vẫn dùng type key `scripts`; `Shots` dùng cho Step 3 và `Shot` dùng cho Step 4.
8. Admin mở `Master Prompt Config` trong nhóm `AI` để tạo global attribute/option JSON dùng riêng khi author master prompt.
9. Trong editor `Story Content`, `Scenario`, `Shots` hoặc `Shot` master prompt, admin chọn các option từ `Master Prompt Config`; selection được lưu cùng master prompt và chỉ render khi prompt admin chứa `{masterPromptAttributes}`. Admin nhập thêm `Output Format placeholder`; `{outputFormat}` chỉ render từ field này khi prompt content có token đó. Admin có thể bấm `Prompt` để xem preview chính xác của draft prompt: `{masterPromptAttributes}` và `{outputFormat}` được render, còn placeholder runtime của user được giữ nguyên.
10. User screens không hiển thị `Master Prompt Config`, không gợi ý `{masterPromptAttributes}`, và không được gửi placeholder này trong prompt override tạm thời.
11. Admin nhập API key và chọn model dùng cho tạo video.
12. Admin lưu cấu hình.
13. Hệ thống áp dụng cấu hình này cho toàn site.

### 3.3. Theo dõi log AI

1. Admin truy cập mục log AI trong dashboard admin.
2. Hệ thống hiển thị danh sách request đã gửi tới AI và response AI trả về.
3. Admin có thể lọc log theo thời gian, user, project, provider, model, trạng thái hoặc loại tác vụ.
4. Admin có thể xem chi tiết từng log để debug request, response, lỗi và thời gian xử lý.
5. Hệ thống không hiển thị API key hoặc secret trong log.

## 4. Admin Attribute Catalog Flow

1. Admin opens Story, Scenario, Shots, or Shot in the admin sidebar.
2. The parent item is not clickable; admin chooses either `Master Prompt` or `Attribute`.
3. In `Attribute`, admin manages catalogs for that type using the shared CRUD/editor screen.
4. Admin can edit the protected file-backed Attribute Generation Prompt, JSON format, and Output format templates for that type. This prompt set is separate from Master Prompt and only creates catalog JSON.
5. Admin can create, edit, archive, and set one default DB catalog per type. New catalog editors load the file-backed Attribute Generation Prompt, JSON format, and Output format as starter content.
6. Each attribute can be marked required. When there is no saved user selection, every attribute starts with its first option selected. Users can change and multi-select options; required attributes cannot be left empty, while optional attributes may be cleared.
6.1. Each attribute header also has an `AI suggestion` checkbox. When checked, option controls are disabled and prompt placeholders use the Admin `AI select Attribute` text plus every option in that attribute. When unchecked, placeholders use the Admin `User select Attribute` text plus selected options only.
7. User Project and One Click flows no longer open a user Scenario list. They load active admin catalogs for Story, Scenario, Shots, and per-shot Shot.
8. AI prompts receive selected attributes only when the active prompt includes explicit placeholders such as `{storyAttributes}`, `{scenarioAttributes}`, or `{shotsAttributes}`.
9. `Master Prompt Config` is not part of the user workflow catalog. It is an admin-only authoring helper, and `{masterPromptAttributes}` is available only in admin master prompt editors.

## 5. Admin Shot Step 4 Flow

1. Admin sidebar includes a non-clickable `Shot` group after `Shots`.
2. `Shots` remains the Step 3 batch shot-list JSON feature. `Shot` is singular and is used only for Step 4 final prompt creation for one shot.
3. Admin manages `Shot Master Prompt` at `/admin/shot/master-prompt` and `Shot Attribute` at `/admin/shot/attributes`; both routes use the same list-only plus dedicated new/edit route pattern as Story, Scenario, and Shots.
4. Project and One Click Step 4 load the active `Shot` master prompt and active `Shot Attribute` catalog. Per-shot selections are saved on each shot JSON object.
5. Step 4 prompt preview and video generation use exact placeholder rendering only. Runtime data enters the prompt only through placeholders such as `{storyContent}`, `{shotTitle}`, `{shotDescription}`, `{shotDialogue}`, `{shotDuration}`, `{shotGeneratedAttributes}`, `{shotAttributes}`, `{referenceMedia}`, and `{outputFormat}`.

## 6. AI Handoff Flow

1. User opens the public Home page.
2. If AI Handoff is configured, Home shows the install/status card.
3. User clicks `Install extension`; VideoAI navigates the current tab to the Chrome Web Store listing. Chrome owns the `Add to Chrome` install flow. In local developer mode, the Chrome Web Store URL can be empty; the user loads `apps/chrome-extension/dist` from `chrome://extensions` and reloads it after each build.
4. User can click `Check installed`; VideoAI sends a ping to `NEXT_PUBLIC_AI_HANDOFF_EXTENSION_ID` and shows detected/not detected status.
5. In Project or One Click Step 4, user reviews a shot and clicks `AI Handoff`.
6. VideoAI renders the same exact shot prompt used by the `Prompt` popup, reads the saved Admin AI Handoff provider/target URL/prompt selector, creates an `ai_handoffs` record for the project/shot, and sends one user-initiated message to the extension.
7. The extension opens the configured AI target for the selected adapter, injects the content script into the allowlisted tab, fills the prompt, and clicks Generate only when the page origin and saved selector match the allowlist. If Admin AI Config has no saved target URL or prompt selector, VideoAI shows a missing-config error and does not open a fallback target or use a fallback selector.
8. If the target is not logged in, selector lookup fails, or the Generate button is disabled, the extension returns a structured error and VideoAI persists the handoff as `failed`.
9. Reference media is not auto-uploaded in v1; user uploads media manually to the target AI website if needed.
10. If Flow/VEO changes DOM, admin opens Flow, uses extension popup `Check DOM`, clicks the real prompt input, then uses `Test fill` to validate the saved selector before running AI Handoff again.
## Project Template And Custom Template Flow

Admins manage Project Templates from Admin > Project Template. Creating a
template happens on the workflow page. The UI lists steps in the priority order
Shot, Shots, Scenario, Story. Shot is always selected; selecting Shots,
Scenario, or Story also selects every later step in the Story, Scenario, Shots,
Shot chain.
Admins choose the saved master prompt for every selected step, then save the
template snapshot directly from the same form. The snapshot uses the chosen
master prompts and the active default attribute catalog for each selected step.
Editing an existing template reuses the same workflow form, so admins can update
the template name, description, selected step prefix, and selected master prompt
per step. There is no second snapshot editor step.

Users select Admin Project Templates from `/projects/new` inside the `Choose how
to start` section, below the standard Scenario/Product start cards. Admin
Project Templates are selectable start cards; there is no Clone action in the
project creation flow. Users manage their Custom Template list from `/projects`,
where templates can be edited or deleted without crowding the create-project
form. The Custom Template editor shows the selected steps as Project-style step
cards with prompt preview controls and Attribute panels for choosing default
options or AI suggestion mode. Creating a project from an Admin Project Template
copies that template snapshot into the project, and the workspace renders only
the selected steps from that snapshot. Dashboard and project list Flow columns
show the snapshot name for those projects.
