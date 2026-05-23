# Yêu cầu chức năng - VideoAI

## 1. Trang chủ

- Trang chủ phải có nút `Login`.
- Khi click `Login`, hệ thống điều hướng đến trang đăng nhập.
- Nếu user đã đăng nhập, hệ thống có thể điều hướng trực tiếp đến dashboard phù hợp với role.
- Product UI is English-only across public page, user dashboard, project workspace and admin dashboard.
- Project workspace has a top save bar with truncated project title/description and a primary `Save Project` action. `Save Project` persists Story Content, Story/Scenario/Shots attribute selections, Scenario selection when available, and the current shot plan when available.
- Website không hiển thị nút chuyển đổi ngôn ngữ và không lưu lựa chọn locale trong browser.

## 2. Xác thực và phân quyền

- Hệ thống hỗ trợ đăng nhập cho user và admin.
- Hệ thống hỗ trợ tài khoản mẫu:
  - `user` / `User@123`
  - `admin` / `Admin@123`
- User đã đăng nhập được truy cập dashboard user.
- Admin đã đăng nhập được truy cập dashboard admin.
- User và admin đã đăng nhập có thể logout khỏi hệ thống.
- Trang admin phải được bảo vệ bằng role `admin`.
- User thường không được truy cập trang admin.
- Nếu phiên đăng nhập hết hạn hoặc không hợp lệ, hệ thống điều hướng về trang đăng nhập.

- When `SITE_GATE_ENABLED=true`, the full site is protected by a separate username/password gate before the VideoAI login page; successful gate login stores an HTTP-only signed cookie so customers do not need to re-enter the gate password on refresh.

## 3. Dashboard User

- Dashboard user phải hiển thị nút `Tạo dự án`.
- Sidebar user phải có menu `Projects` trỏ đến danh sách tất cả project của user.
- Sidebar user phải có menu `One Click` trỏ đến wizard `/one-click`.
- Trang `Projects` phải dùng dữ liệu database/API để hiển thị project của user, không dùng project hard-code.
- Trang `Projects` phải có action xóa/archive project ở từng dòng; project đã xóa không còn hiển thị trong danh sách active và không mở được từ detail endpoint.
- User có thể tạo dự án mới.
- Sau khi tạo dự án, user có thể truy cập chi tiết dự án.
- Form tạo dự án phải có hai lựa chọn flow:
  - `Scenario`: bắt đầu từ ý tưởng, prompt hoặc kịch bản.
  - `Product Flow`: bắt đầu từ URL sản phẩm và media tham khảo.
- Trang chi tiết dự án chỉ hiển thị workspace đúng với flow đã chọn khi tạo dự án.

## 3.1. One Click wizard

- Route `/one-click` phải hiển thị Start form yêu cầu project name và cho nhập description; project được tạo với `flowType = script` qua API project hiện có.
- Route `/one-click/{projectId}` phải mở wizard cho project script đã tạo; nếu project không tồn tại thì quay lại `/one-click`, nếu project không phải script thì quay về workspace project thường.
- One Click phải là shortcut UI của `Scenario`, không thêm enum flow type, bảng database hay endpoint backend mới nếu API hiện có đã đủ.
- Wizard chỉ hiển thị một step tại một thời điểm và có `Back` / `Next`.
- Step 1 dùng UI/API Story Content hiện có: Story Content textarea, Generate Story Content và các nút `Prompt`, `Request`, `Response`; `Story Content` master prompt chỉ hiển thị khi Admin Site Config `showUserMasterPrompts=true`. `Next` bị disable khi Story Content rỗng và khi đi tiếp hệ thống lưu Story Content vào database.
- Step 2 là `Scenario` step: hiển thị Story Content và scenario catalog đang dùng; `Scenario` master prompt chỉ hiển thị khi Admin Site Config `showUserMasterPrompts=true`; không hiển thị dropdown `Choose scenario`.
- Step 2 phải có `Analyze scenario`, `Prompt`, `Request`, `Response`. Khi user bấm `Analyze scenario`, hệ thống dùng Story Content, active Scenario master prompt và catalog attributes/options để AI chọn attributes phù hợp, lưu template selection vào project, đồng thời lưu Scenario mới với name/description lấy từ One Click setup.
- Step 3 dùng active `Shots` master prompt và Story Content để gọi AI tạo shot plan mới cho project; textarea `Shots` master prompt chỉ hiển thị khi Admin Site Config `showUserMasterPrompts=true`. Step 3 hiển thị success/error chi tiết, raw Prompt/Request/Response và shot plan editable giống Project Step 3. One Click không hiển thị selector `Choose shot plan`; shot plan tạo ra được lưu vào database, gắn với project và dùng name/description lấy từ One Click setup.
- Shot plan tạo từ One Click phải được lưu như shot plan hiện có và gắn được với project script khi gọi endpoint project-scoped.

## 4. Tạo dự án

- User có thể nhập thông tin cơ bản của dự án.
- User phải chọn một flow khi tạo dự án: `Scenario` hoặc `Product Flow`.
- Hệ thống phải lưu flow đã chọn vào dự án.
- Hệ thống phải lưu dự án gắn với user đang đăng nhập.
- Dự án mới phải xuất hiện trong dashboard user sau khi tạo thành công.
- Nếu tạo dự án thất bại, hệ thống phải hiển thị thông báo lỗi.

## 5. Tạo video theo kịch bản

- Hệ thống phải có ô nhập text cho kịch bản hoặc prompt.
- Hệ thống phải có nút `Tạo Prompt` trong từng shot để compose prompt cục bộ từ shot, attribute của shot và template đang chọn.
- User có thể upload hình ảnh hoặc video mẫu trong từng shot để prompt của shot đó có media tham khảo riêng.
- User có thể xem preview và xóa file media đã upload trong từng shot.
- User có thể tạo shot plan từ nội dung hiện tại trong `Scenario`.
- Trong `Scenario`, `Story Content` là `Bước 1`; `Kịch bản tạo prompt` là `Bước 2`; `Shots tạo prompt` là `Bước 3` và các bước phải nằm theo đúng thứ tự này.
- Container chính của `Scenario` phải dùng toàn bộ bề rộng workspace khả dụng để `Bước 1`, `Bước 2` và `Bước 3` không bị bó trong một cột hẹp.
- Section `Bước 1`, `Bước 2` và `Bước 3` phải có thể thu gọn/mở rộng; từng nhóm attribute trong `Bước 2` cũng có thể thu gọn/mở rộng và vẫn hiển thị số option đã chọn.
- `Bước 1` chỉ hiển thị textarea `Story Content` master prompt do admin quản lý khi Admin Site Config `showUserMasterPrompts=true`; nếu setting là `false`, workspace ẩn textarea này và dùng active admin default. `Story Attributes` phải nằm trong panel cột phải trên desktop, mặc định thu gọn và giữ selected-count visible. Khi user bấm tạo bằng AI, response trả về được ghi lại vào textarea `Story Content`.
- Nút tạo AI trong `Bước 1` phải gọi provider/model đang active. Nếu provider lỗi, thiếu key, hết quota hoặc trả text rỗng, job phải failed với lỗi chi tiết dễ hiểu ngay dưới nút `Generate Story Content`; hệ thống không được dùng fallback/sample content.
- Các action AI dùng master prompt có placeholder trong project workspace phải có button `Prompt` nằm trước `Request`. Button này mở popup read-only hiển thị đúng prompt sau khi thay placeholder optional; hệ thống không tự nối runtime context ẩn vào prompt text.
- Mỗi action AI trong project workspace (`Generate Story Content`, `Analyze scenario`, `Generate shots`, và Product Flow `Analyze`) phải có button `Request` và `Response` nằm cạnh action chính. Button chỉ bật khi có raw data của lần chạy mới nhất và khi click phải mở popup read-only hiển thị đầy đủ request/response đã redact secret.
- Textarea `Story Content` ở `Bước 1` là source chung cho các bước sau: AI phân tích scenario ở `Bước 2`, tạo shot plan ở `Bước 3`, compose prompt từng shot và tạo script.
- Trong `Bước 2`, catalog attribute/option phải được gom vào panel `Attributes` ở cột phải trên desktop; panel này mặc định thu gọn, đủ rộng để đọc label/count trên desktop, còn khu vực master prompt Scenario, action, lỗi và kết quả AI nằm ở cột nội dung bên trái.
- Trong panel `Attributes` của workspace, attribute/option có mô tả từ Scenario phải có icon helper; hover hoặc click icon sẽ hiển thị mô tả mà không làm đổi trạng thái chọn/collapse.
- Trong `Bước 3`, workspace chỉ hiển thị textarea `Shots` master prompt do admin quản lý khi Admin Site Config `showUserMasterPrompts=true`; user có thể sửa tạm thời prompt này cho lần tạo shots hiện tại mà không lưu đè default admin. Khi setting là `false`, frontend không gửi `masterPrompt` override và backend dùng active admin default.
- Trong `Bước 3`, workspace chỉ hiển thị panel `Shots Attributes` trong cột phải bên cạnh `Shots` master prompt/generate controls. Panel này mặc định thu gọn, giữ selected-count visible, và cho user xem/chỉnh các option được đưa vào `{shotsAttributes}`. Scenario options được chỉnh ở `Bước 2` và vẫn có thể đi vào `{scenarioAttributes}` nếu prompt có placeholder đó.
- Khi user tạo shots trong `Bước 3`, hệ thống phải gửi các attribute/option đã chọn ở `Bước 2` vào workflow `shot_generation` dưới dạng attribute cấp shot plan.
- Request tạo shots trong `Bước 3` chỉ được gửi `Shots` master prompt tạm thời khi Admin Site Config `showUserMasterPrompts=true`; khi setting là `false`, backend phải reject mọi request user vẫn gửi `masterPrompt` override.
- Sau khi user bấm `Generate shots`, UI phải hiển thị thông báo thành công ngay dưới action nếu tạo shot plan thành công; nếu lỗi AI/provider/config/schema thì hiển thị lỗi nhiều dòng dễ hiểu, gồm mã lỗi ổn định, provider/model/status/env/job ID khi có.
- Ở `Bước 3`, UI luôn hiển thị textarea `Shots result` ngay dưới action generate. Textarea này trống khi chưa có shot plan, và chứa JSON normalized dùng để build shot cards khi đã generate/chọn/paste JSON; user có thể sửa JSON và bấm `Apply JSON` để đồng bộ lại shot cards trước khi `Save shots`.
- Shot plan phải được lưu trong database theo user để mọi project của cùng user đều có thể chọn lại.
- Nếu nội dung hiện tại quá ngắn, hệ thống phải bổ sung các shot mặc định để shot plan có ít nhất 3 shot.
- Mỗi shot có thời lượng mặc định 8 giây và chỉ được nằm trong khoảng 1-8 giây.
- User có thể chỉnh sửa shot, thêm shot, xóa shot và chỉnh sửa attribute của shot.
- Trong từng shot card của `Bước 3`, attribute của shot phải được gom vào panel `Attributes` ở cột phải giống pattern và độ rộng desktop ở `Bước 2`, mặc định thu gọn, hiển thị số attribute và chứa thao tác thêm/sửa/xóa attribute.
- Trong từng shot card của `Bước 3`, user có thể bấm `Prompt` để xem prompt hoàn chỉnh trong popup có copy icon, bấm `Create video` để gửi prompt đó tới provider/model video trong Admin AI Config, và xem `Request`/`Response` raw data cho riêng shot đó. Nếu provider lỗi, UI phải hiển thị lỗi chi tiết dễ hiểu ngay trong shot card và không được dùng fallback/fake success.
- Mỗi shot phải có textarea `Lời thoại`; dữ liệu này được lưu như attribute `Dialogue` trong JSON của shot và có thể chỉnh sửa trước khi lưu.
- User có thể chọn nhiều shot trong shot plan để định hướng prompt, nhưng nút `Tạo Prompt` trong từng shot chỉ compose prompt cho shot đó.
- User có thể mở popup xem trước prompt/payload ẩn đã compose từ nội dung nhập, media hợp lệ, shot selection và template selection trước khi gửi yêu cầu AI.
- Prompt được tạo trong từng shot phải được trình bày dễ đọc bằng xuống dòng và section đánh số; placeholder attribute của shot/shot plan phải render từng dòng theo format `[Attribute Name]: value`, trong đó `Dialogue` render thành `[Voiceover Script]: "..."`.
- Prompt được tạo trong từng shot phải có icon copy ở góc phải của khung prompt.
- Prompt được tạo trong từng shot phải dùng prompt composer tương thích legacy, nối thêm context của shot và chỉ render cục bộ, không gọi AI.
- `Scenario` không hiển thị panel `AI suggested content` trong luồng compose prompt cục bộ theo từng shot.
- User có thể bấm `Phân tích kịch bản` trong workspace để AI đọc story/prompt đang nhập, đối chiếu với attribute/option của Kịch bản đang chọn, tự chọn các option phù hợp và lưu selection đó vào project.
- Trong workspace, `Phân tích kịch bản` chỉ hiển thị textarea `Scenario` master prompt do admin quản lý khi Admin Site Config `showUserMasterPrompts=true`; user có thể sửa tạm thời master prompt này cho lần phân tích hiện tại trong mode đó. Khi setting là `false`, workspace ẩn textarea và backend dùng active admin default.
- Request `Phân tích kịch bản` phải gửi master prompt sau khi thay placeholder có trong prompt. Placeholder `{story}` và `{attributes}` được hỗ trợ nhưng không bắt buộc; nếu prompt thiếu placeholder nào thì runtime data tương ứng không được đưa vào request.
- Nếu `Phân tích kịch bản` thất bại, UI phải hiển thị lỗi chi tiết và dễ hiểu ngay dưới action, gồm mã lỗi ổn định, provider/model nếu có, gợi ý env/status/job ID để admin tra cứu, và hướng xử lý tiếp theo. UI user không hiển thị API key hoặc raw payload của provider.
- Các action `Phân tích kịch bản` và `Lưu lựa chọn` phải nằm sau khu vực prompt/content hiện hành, trước danh sách attribute/option. Nếu master prompt textarea bị ẩn bởi Site Config, action row vẫn hiển thị cùng `Prompt`, `Request`, `Response`.
- User có thể chỉnh sửa checkbox option sau khi AI phân tích và bấm `Lưu lựa chọn` để lưu selection hiện tại vào project.
- User có thể chỉnh sửa nội dung AI gợi ý trước khi tạo script hoặc video.
- Hệ thống phải hiển thị nút `Tạo script` hoặc `Tạo video` theo cấu hình admin.
- Khi tạo script thành công, script phải được lưu vào dự án.
- Khi tạo video thành công, video phải được lưu vào dự án.
- Nếu AI generate thất bại, hệ thống phải hiển thị thông báo lỗi và cho phép user thử lại.

## 6. Tạo video theo thông tin sản phẩm

- Hệ thống phải có ô nhập URL sản phẩm.
- Hệ thống phải có nút `Phân tích sản phẩm`.
- User có thể upload hình ảnh hoặc video mẫu để AI phân tích cùng URL sản phẩm.
- User có thể xem preview và xóa file media đã upload.
- Hệ thống phải dùng AI để phân tích thông tin sản phẩm từ URL và media mẫu.
- Hệ thống phải tạo prompt/script gợi ý dựa trên kết quả phân tích.
- User có thể chỉnh sửa prompt/script được AI tạo.
- Hệ thống phải hiển thị nút `Tạo script` hoặc `Tạo video` theo cấu hình admin.
- Khi tạo script thành công, script phải được lưu vào dự án.
- Khi tạo video thành công, video phải được lưu vào dự án.
- Nếu URL không hợp lệ hoặc không phân tích được, hệ thống phải hiển thị thông báo lỗi rõ ràng.

## 7. Dashboard Admin

- Hệ thống phải có trang admin riêng.
- Admin có thể đăng ký và đăng nhập đơn giản.
- Dashboard admin phải có menu bên trái.
- Menu bên trái phải có nhóm cấu hình dành cho site.
- Admin có thể cấu hình chế độ tạo nội dung của user.
- Admin có thể cấu hình provider/model mặc định cho tạo prompt.
- Admin AI Config phải có Site Config `Show master prompts in user workspace` dạng Yes/No, mặc định `No`. Khi `No`, Project và One Click ẩn textarea Story/Scenario/Shots/Shot master prompt, vẫn giữ nút `Prompt` preview, frontend không gửi temporary `masterPrompt`, và backend reject override nếu user gửi thủ công.
- Menu admin hiển thị các nhóm `Story`, `Scenario`, `Shots`, `Shot`; mỗi nhóm có child `Master Prompt`. Route tương thích `/admin/shot-prompt` vẫn redirect về nhóm phù hợp.
- Admin có thể quản lý 4 nhóm master prompt tại các list-only route `/admin/story/master-prompt`, `/admin/scenario/master-prompt`, `/admin/shots/master-prompt`, `/admin/shot/master-prompt`. `New prompt` mở `/new`, `Edit` mở `/{promptId}`, và built-in row mở `/new?source=built-in`. Nhóm `Story Content` vẫn dùng type key `scripts`; `Shots` dùng cho Step 3 và `Shot` dùng cho Step 4.
- Mỗi nhóm master prompt phải hỗ trợ tạo, sửa, xóa/archive và `Set default`; mỗi nhóm có đúng một default active.
- Admin không thể xóa prompt đang là default nếu chưa chọn prompt khác làm default trước.
- Master prompt giữ format placeholder khuyến nghị theo từng nhóm, nhưng không bắt buộc placeholder khi lưu; backend replace nếu có và không tự nối runtime field mà prompt được chọn chưa chứa placeholder.
- Mỗi `Story Content`, `Scenario` và `Shots` master prompt phải có field textarea `Output Format placeholder`. Placeholder `{outputFormat}` chỉ render từ field này khi prompt content có token đó; nếu prompt dùng token nhưng field rỗng, hệ thống báo lỗi rõ ràng và không dùng fallback output instruction.
- Admin có thể mở `Master Prompt Config` trong nhóm `AI` để tạo một bộ attribute/option dùng riêng cho quá trình author master prompt. Bộ này là global, admin-only, và không xuất hiện trong màn hình user.
- Trong từng editor `Story Content`, `Scenario`, `Shots` master prompt, admin có thể chọn option từ `Master Prompt Config`; selection này được lưu cùng master prompt và chỉ được đưa vào runtime nếu prompt admin chứa `{masterPromptAttributes}`.
- UI chỉ hiển thị tên attribute/option trong phần chọn `Master Prompt Attribute`; mô tả nằm sau helper icon và không được render vào `{masterPromptAttributes}`.
- Trong từng editor `Story Content`, `Scenario`, `Shots` master prompt, admin có thể bấm `Prompt` để xem preview chính xác của draft prompt. Preview chỉ render `{masterPromptAttributes}` theo selection admin; các placeholder runtime của user được giữ nguyên.
- Placeholder `{masterPromptAttributes}` chỉ xuất hiện trong gợi ý placeholder của admin master prompt. User Project, One Click và prompt override tạm thời không được thấy, chọn, hoặc gửi placeholder này.
- `Story Content` is used for Step 1 content expansion in Project and One Click; `Scenario` is used for scenario analysis; `Shots` is used for Project and One Click shot-plan generation.
- Admin có thể cấu hình API key và model cho tạo video.
- Admin có thể xem log request/response AI.
- Chỉ admin mới có quyền xem và thay đổi cấu hình.
- Tất cả textarea hiển thị trong admin/user phải có số ký tự nhỏ ở góc trái phía dưới; textarea ẩn phục vụ copy clipboard không hiển thị counter.

## 8. Kịch bản tạo prompt

- User dashboard phải có menu `Kịch bản` (route hiện tại vẫn là `/templates`).
- Route `/templates` chỉ hiển thị danh sách kịch bản, gồm action thêm, sửa và xóa/archive; không có action `Set default`.
- Khi user thêm hoặc sửa kịch bản, UI phải điều hướng sang `/templates/new` hoặc `/templates/{templateId}` để xử lý form/editor.
- User có thể tạo kịch bản mới.
- Kịch bản mô tả các attribute và option dùng để tạo prompt video.
- User có thể nhập ý tưởng video để AI gợi ý kịch bản dưới dạng JSON.
- Trang thêm/sửa kịch bản phải hiển thị `Scenario` master prompt do admin quản lý trong textarea, cho phép sửa tạm thời prompt cho lần tạo AI hiện tại.
- Request AI tạo kịch bản phải gửi optional temporary `masterPrompt` và chỉ thay placeholder `{story}`/`{attributes}` nếu có; backend không tự nối runtime context hoặc output instruction ẩn trước khi gọi provider.
- Action `Generate scenario with AI` phải có các nút `Prompt`, `Request`, `Response` giống project workspace. `Prompt` mở popup prompt đầy đủ trước khi gọi AI; `Request` và `Response` chỉ bật sau khi có raw data của lần generate gần nhất.
- Nếu AI tạo kịch bản lỗi vì thiếu key, quota, HTTP provider, response rỗng, JSON sai hoặc schema sai, UI phải hiển thị lỗi chi tiết dễ hiểu dưới action tạo AI, gồm mã lỗi ổn định, provider/model, env/status/request ID nếu có.
- Hệ thống không được dùng mock/fake/sample scenario attributes để fallback khi AI tạo kịch bản lỗi.
- AI JSON phải gồm danh sách attribute và option.
- UI phải trình bày trực quan các attribute/option để user kiểm tra và chỉnh sửa.
- UI editor trực quan hiển thị attribute và option theo thứ tự số để user scan nhanh, kèm ghi chú tiếng Việt/mô tả gọn nếu có.
- UI phải có textarea schema chứa attribute/option hiện tại bằng format ngắn `attribute=option1,option2;`; user có thể nhập nhiều dòng như `videoPurpose=Storytelling,Commercial;` và `genre=Folk Tale,Drama;`, sau đó parse và Save.
- Textarea schema vẫn phải hỗ trợ JSON cũ dạng mảng attributes hoặc object có key `attributes` để tương thích dữ liệu đã có.
- Schema ngắn và JSON có thể kèm mô tả để người dùng đọc hiểu attribute/option. Mô tả chỉ lưu vào `description`, không thay thế label/value dùng cho xử lý prompt.
- Trang thêm/sửa scenario dùng JSON làm format chính cho `Attribute/option schema`; JSON mới dùng `id`, `name`, `description`, `options` để ngắn gọn. User có thể nhập trực tiếp `description` trong JSON hoặc field description của attribute/option; compact `attribute=option1,option2;` và JSON cũ có `translate`/`label`/`value` vẫn được hỗ trợ để tương thích.
- User có thể tự thêm attribute.
- User có thể tự thêm option cho từng attribute.
- User có thể xóa kịch bản đã lưu.
- User không còn chọn kịch bản default; danh sách scenario được sắp theo lần cập nhật mới nhất.
- Một attribute có thể cho phép chọn nhiều option.
- Kịch bản và JSON attribute/option đã normalize phải được lưu trong database.
- Trong project workspace, `Scenario` phải load Kịch bản phía trên Shots; `Product Flow` phải load Kịch bản trước action phân tích sản phẩm.
- Trong `Scenario`, lựa chọn kịch bản được dùng để compose prompt cục bộ cho từng shot. Trong `Product Flow`, lựa chọn kịch bản được gửi vào workflow analyze/generate.
- Các request AI/log/result có liên quan phải lưu lại template/scenario selection; prompt panel cục bộ phải hiển thị lựa chọn kịch bản được dùng để compose prompt.

## 8.1. Standalone shot plan routes

- User sidebar must not show `Scripts`.
- Compatibility routes `/shots`, `/shots/new`, and `/shots/{shotPlanId}` must redirect to `/projects`.
- Shot plan creation, generation, editing, media attachment and save behavior remain inside Project Scenario and One Click workflows.
- Project and One Click shot workflows must use project-scoped endpoints so removing the standalone shot-plan UI does not break shot generation.

## 9. Cấu hình tạo nội dung/video

- Hệ thống phải có cấu hình bật/tắt để quyết định hành động chính trong luồng tạo nội dung của user.
- Khi cấu hình ở chế độ tạo prompt/script, user sẽ thấy hành động `Tạo script`.
- Khi cấu hình ở chế độ tạo video, user sẽ thấy hành động `Tạo video`.
- Cấu hình phải được lưu và áp dụng nhất quán trên cả hai luồng:
  - Tạo video theo kịch bản.
  - Tạo video theo thông tin sản phẩm.
- Khi admin thay đổi cấu hình, user cần thấy cấu hình mới ở lần tải lại hoặc lần mở luồng tạo nội dung tiếp theo.

## 10. Quy tắc nghiệp vụ

- Mỗi dự án thuộc về một user.
- User chỉ được xem và thao tác với dự án của chính mình.
- Tài khoản, project, flow đã chọn, cấu hình AI, media metadata, AI log, job status, prompt, script và video generation record phải được lưu trong database.
- Template video, attribute, option và template selection được dùng khi tạo prompt phải được lưu trong database hoặc log/prompt metadata dạng JSON.
- Shot plan, shot JSON và shot selection được dùng khi tạo prompt phải được lưu trong database hoặc log/prompt metadata dạng JSON.
- Hệ thống không được dùng mock data, mảng dữ liệu trong source code hoặc process-local store làm nguồn dữ liệu chính cho các luồng đã implement.
- Admin có quyền cấu hình site nhưng không trực tiếp tạo video trong dashboard admin.
- Cấu hình AI của admin áp dụng cho toàn site.
- Nội dung do AI tạo chỉ là gợi ý, user có thể chỉnh sửa trước khi tạo script hoặc video.
- Tạo video phải dựa trên prompt/script cuối cùng mà user xác nhận.
- Tạo script phải dựa trên nội dung cuối cùng mà user xác nhận.
- Các thao tác upload media, tạo script, phân tích sản phẩm, gọi AI và tạo video cần có trạng thái loading.
- Các lỗi đăng nhập, phân quyền, upload media, phân tích URL, generate AI, tạo script và tạo video phải được hiển thị rõ ràng cho người dùng.
- Các page trong app phải có hành động quay lại rõ ràng; public, user và admin page dùng nút `Quay lại` ở vị trí dễ thấy.

## 11. Admin Attribute Catalog Requirements

- User sidebar must not show Scenario management.
- Admin sidebar must show Story, Scenario, Shots, and Shot as non-clickable parent groups. Each parent has Master Prompt and Attribute child pages.
- Story, Scenario, Shots, and Shot Attribute pages must support CRUD, default selection, JSON editing, visual editing, required checkbox per attribute, and AI generation through a separate Attribute Generation Prompt.
- Scenario catalogs are admin-only. User Project and One Click flows load the active Admin Scenario catalog.
- Project and One Click Step 1, Step 2, and Step 3 load Story, Scenario, and Shots catalogs respectively.
- Required attributes default to the first option when no saved selection exists, remain multi-select, and cannot be cleared to zero selected options.

## 12. AI Handoff Chrome Extension

- Public Home must show an AI Handoff install/status card with `Install extension`, `Check installed`, and safety copy.
- `Install extension` opens the configured Chrome Web Store listing from `NEXT_PUBLIC_AI_HANDOFF_EXTENSION_URL`; normal websites cannot directly install Chrome extensions.
- `Check installed` uses `NEXT_PUBLIC_AI_HANDOFF_EXTENSION_ID` and Chrome external messaging to detect the installed extension.
- AI Handoff is enabled only when `NEXT_PUBLIC_AI_HANDOFF_ENABLED=true` and a configured extension id exists.
- Project and One Click Step 4 shot cards must show an `AI Handoff` action beside `Prompt` and `Create video`.
- Clicking `AI Handoff` uses the active Admin AI Config `aiHandoffProvider`, `aiHandoffTargetUrl`, and `aiHandoffPromptSelector`, creates a project-owned handoff record, sends `{handoffId, provider, targetUrl, promptText, promptSelector, shotId}` to the extension, persists status updates, and shows success/error feedback in the shot card.
- `AI_HANDOFF_PROVIDER` and `AI_HANDOFF_TARGET_URL` seed local/bootstrap config only. The saved Admin target URL is runtime source of truth; if it is blank or invalid, the UI/API fail clearly and do not use a hardcoded fallback.
- Handoff statuses are `created`, `sent_to_extension`, `target_opened`, `prompt_filled`, `generate_clicked`, `failed`, and `completed_manually`.
- The first target adapter is `google-flow-veo`, but UI, API, and database names must remain generic as `AI Handoff`.
- The extension runs content scripts only on allowlisted AI target origins and must fail clearly when the target page is not logged in, the configured selector is missing, or the generate button is disabled. The popup provides `Check DOM` to recapture the prompt selector and `Test fill` to insert hardcoded test text without clicking Generate.
- AI Handoff v1 automates prompt text only. Reference media remains visible in VideoAI and must be uploaded manually to the target AI site.
- The extension must not store provider cookies, passwords, API keys, or bypass login, quota, CAPTCHA, safety dialogs, or provider restrictions.
- Project selections are persisted as JSON keyed by `story`, `scenario`, and `shots`.
- Runtime data enters AI prompts only through explicit placeholders present in the selected prompt.
- `Master Prompt Config` is separate from Story/Scenario/Shots user workflow attributes. It is admin-only, uses the admin-saved selection on each master prompt, and never exposes `{masterPromptAttributes}` to user screens or user-facing placeholder autocomplete.

## 12. Admin Shot Step 4 Requirements

- Admin sidebar must also show a non-clickable `Shot` parent group after `Shots`.
- `Shots` remains the Step 3 batch shot-list JSON feature. `Shot` is singular and is used only for Step 4 per-shot final prompt creation.
- Admin can manage `Shot Master Prompt` and `Shot Attribute` with the same list-only and dedicated new/edit route model as Story, Scenario, and Shots.
- Project and One Click Step 4 must load the active `Shot` master prompt and active `Shot Attribute` catalog.
- Required Shot attributes auto-select the first option and cannot be cleared to zero selections. Selections are saved on the individual shot JSON object.
- Step 4 prompt rendering must replace only placeholders present in the selected `Shot` master prompt. It must not append hidden runtime context, provider output contract text, or fallback prompt content.
