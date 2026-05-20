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
   - `Script Flow`: dùng khi user muốn bắt đầu từ ý tưởng, prompt hoặc kịch bản.
   - `Product Flow`: dùng khi user muốn bắt đầu từ URL sản phẩm và media tham khảo.
9. User xác nhận tạo dự án.
10. Hệ thống tạo dự án mới, lưu flow đã chọn và chuyển user vào trang chi tiết dự án.
11. Trong chi tiết dự án, hệ thống chỉ hiển thị workspace đúng với flow đã chọn khi tạo dự án.

### 2.3. Tạo video theo kịch bản

1. User mở một dự án đã được tạo với `Script Flow`.
2. Hệ thống hiển thị màn hình nhập kịch bản/prompt.
3. User kiểm tra đúng flow đang làm việc.
4. User nhập hoặc dùng AI tạo nội dung trong section `Bước 1 · Story Content`; section này hiển thị `Scripts`/Story Content master prompt do admin quản lý và có thể sửa tạm thời.
5. Response tạo bằng AI được ghi lại vào textarea Story Content. Textarea này là source chung cho phân tích kịch bản, tạo shots, compose prompt từng shot và tạo script.
6. User chọn Kịch bản trong section `Bước 2 · Kịch bản tạo prompt` để load danh sách attribute/option; trên desktop danh sách này nằm trong panel `Attributes` ở cột phải, mặc định thu gọn, đủ rộng để đọc label/count, và user có thể mở panel rồi mở từng nhóm attribute khi cần chọn option.
7. Workspace hiển thị `Scenario` master prompt do admin quản lý. User có thể sửa tạm master prompt cho lần phân tích hiện tại.
8. User có thể bấm `Phân tích kịch bản`; hệ thống gửi master prompt, Story Content và runtime catalog attribute/option của Kịch bản tới AI, nhận JSON selection, tự check các option phù hợp và lưu selection vào project.
9. User có thể chỉnh lại checkbox option và bấm `Lưu lựa chọn` để lưu selection hiện tại vào project.
10. User tạo shot plan trong section `Bước 3 · Shots tạo prompt`; Step 3 dùng Story Content ở Bước 1 làm source, hiển thị `Shots` master prompt để user có thể sửa tạm thời trước khi generate, và có thể thu gọn khi không cần chỉnh shots.
11. Hệ thống gửi các attribute/option đã chọn ở `Bước 2` vào `shot_generation` theo format compact `attribute=option1,option2;` để AI dựng shots đúng kịch bản.
12. Sau khi gọi `Generate shots`, UI hiển thị thông báo thành công nếu shot plan được tạo; nếu provider/config/schema lỗi thì hiển thị lỗi chi tiết ngay dưới action.
13. Mỗi shot mặc định 8 giây và chỉ cho phép từ 1 đến 8 giây để phù hợp giới hạn Veo.
14. User có thể chỉnh sửa shot, thêm shot, xóa shot, mở panel `Attributes` trong từng shot để thêm/sửa/xóa attribute giống pattern và độ rộng desktop ở Bước 2, và nhập `Lời thoại` trong textarea riêng của từng shot.
15. Trong từng shot, user có thể upload hình ảnh hoặc video mẫu để mô tả ngữ cảnh, style, bố cục, góc quay, màu sắc hoặc cách trình bày riêng cho shot đó.
16. Hệ thống hiển thị preview media trong đúng shot đã upload và cho phép user xóa từng file.
17. Bên dưới nút `Thêm attribute` của từng shot, user click `Tạo Prompt`.
18. Hệ thống dùng prompt composer tương thích legacy và nối thêm structured context để compose prompt cục bộ cho đúng shot đó, gồm nội dung nguồn, thông tin shot, lời thoại, attribute của shot, media hợp lệ của shot và template option đang chọn; attribute placeholder render theo format `[Attribute Name]: value`, riêng `Dialogue` là `[Voiceover Script]: "..."`.
19. Hệ thống hiển thị prompt theo format dễ đọc với section, bullet/list và icon copy ở góc phải trong shot card.
20. `Script Flow` không hiển thị panel `AI suggested content` trong luồng compose prompt cục bộ.
21. User có thể copy prompt để dùng cho bước tạo video/script bên ngoài hoặc workflow tiếp theo.

### 2.3.1. Tạo shot plan trong Script Flow

1. User nhập hoặc tạo nội dung trong `Bước 1 · Story Content` của `Script Flow`.
2. User kiểm tra ô số giây/shot, mặc định là `8`.
3. User click `Tạo shots`; request sẽ kèm attribute/option đã chọn ở `Bước 2 · Kịch bản tạo prompt`.
4. Hệ thống tạo AI request log với flow type `shot_generation`.
5. Trước hoặc sau khi gọi AI, user có thể bấm `Prompt` cạnh nút `Tạo shots` để xem prompt đầy đủ sau khi thay placeholder và nối runtime context. Khi hệ thống gọi provider/model prompt đang active, raw provider request đã redact secret và response JSON thô sẽ bật hai button `Request`/`Response`; click vào từng button mở popup đầy đủ để user kiểm tra.
6. Hệ thống normalize JSON thành shot plan gồm nhiều shot, mỗi shot có tiêu đề, mô tả, thời lượng, textarea lời thoại và danh sách attribute.
7. Shot plan được lưu vào database theo user, có thể chọn lại từ bất kỳ project workspace nào của cùng user.
8. User có thể chỉnh sửa shot plan và lưu lại.
9. Khi user click `Tạo Prompt` trong từng shot, hệ thống compose prompt cục bộ từ shot đó, attribute của shot và template selection hiện tại.

### 2.3.2. Tạo shot plan từ menu Scripts

1. User mở menu `Scripts` trong dashboard sidebar; route tương thích vẫn là `/shots`.
2. Hệ thống chỉ hiển thị danh sách script/shot plan active, gồm default badge và action `Thêm`, `Sửa`, `Xóa`, `Set default`.
3. User click `Thêm` để mở `/shots/new`.
4. User xem tóm tắt `Shots` master prompt do admin quản lý, nhập `Nội dung câu chuyện` trong textarea riêng và thêm attribute cấp shot plan nếu cần. Hệ thống luôn gửi duration mặc định `8` giây/shot cho lần generate.
5. User click `Tạo shots`.
6. Hệ thống gọi AI provider thật theo admin config, hiển thị raw request đã redact secret và raw response JSON dưới dạng panel thu gọn/mở rộng, sau đó normalize JSON để build các shot editable.
7. Mỗi shot có `Start state`, `End state` và `Dialogue` để shot sau nối tiếp trạng thái kết thúc của shot trước và có lời thoại/voiceover riêng, rồi lưu JSON vào database theo user.
8. User click `Sửa` ở danh sách để mở `/shots/{shotPlanId}` và chỉnh sửa attribute cấp shot plan, title, description, duration, textarea lời thoại và attribute của từng shot, thêm/xóa shot hoặc attribute, rồi lưu lại database. Mọi project workspace của user đều có thể chọn shot plan này.
9. User có thể click `Set default`; default script/shot plan được ưu tiên hiển thị đầu danh sách và trong selector ở project workspace.

### 2.4. Tạo kịch bản prompt

1. User mở menu `Kịch bản`.
2. Hệ thống chỉ hiển thị danh sách scenario active, gồm default badge và action `Thêm`, `Sửa`, `Xóa`, `Set default`.
3. User click `Thêm` để mở `/templates/new` hoặc click `Sửa` để mở `/templates/{templateId}`.
4. Trang thêm và trang sửa đều hiển thị `Scenario` master prompt do admin quản lý và ô nhập ý tưởng/prompt video; user có thể sửa tạm master prompt cho lần tạo này và nhập nội dung, ví dụ `tạo 1 video về ngày vui của bé`.
5. User click tạo kịch bản bằng AI.
6. Hệ thống gọi provider/model prompt đang active qua API, thay placeholder `{story}`/`{attributes}` nếu có, nối runtime context có cấu trúc, suy luận các yếu tố cần có để tạo video đẹp và trả về JSON gồm attribute/option.
7. Nếu provider/key/schema lỗi, UI hiển thị lỗi chi tiết dễ hiểu ngay dưới action tạo AI, gồm mã lỗi, provider/model, env/status/request ID nếu có; hệ thống không dùng dữ liệu mẫu để fallback.
8. UI hiển thị JSON đó thành các nhóm attribute và option trực quan.
9. UI hiển thị textarea schema chứa attribute/option hiện tại theo format ngắn `attribute=option1,option2;`, ví dụ `videoPurpose=Storytelling,Commercial;` và `genre=Folk Tale,Drama;`.
10. User có thể paste schema ngắn hoặc JSON cũ dạng mảng attributes/object `attributes`, parse trước khi lưu.
11. User có thể dùng textarea `Vietnamese translate JSON` để tạo hoặc chỉnh bản dịch/giải thích tiếng Việt cho attribute/option. JSON này dùng `attributeId`/`optionId` để apply chính xác vào `description`, không thay label/value tiếng Anh dùng cho xử lý prompt; nếu JSON hiện tại đã được apply thì không thể apply lại.
12. User có thể thêm attribute mới, thêm hoặc xóa option trong từng attribute.
13. User có thể lưu kịch bản; danh sách `/templates` cho phép xóa/archive và `Set default`.
14. Hệ thống lưu JSON attribute/option đã normalize vào database để project workspace có thể load lại; trong workspace, helper icon trên attribute/option hiển thị lại translate/mô tả đã lưu khi hover hoặc click.
15. Scenario default được ưu tiên hiển thị trong selector.

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
7. Admin mở `Master Prompt` tại route tương thích `/admin/shot-prompt` để quản lý 3 nhóm `Scenario`, `Shots`, `Scripts`, gồm tạo/sửa/xóa và chọn default cho từng nhóm.
8. Admin nhập API key và chọn model dùng cho tạo video.
9. Admin lưu cấu hình.
10. Hệ thống áp dụng cấu hình này cho toàn site.

### 3.3. Theo dõi log AI

1. Admin truy cập mục log AI trong dashboard admin.
2. Hệ thống hiển thị danh sách request đã gửi tới AI và response AI trả về.
3. Admin có thể lọc log theo thời gian, user, project, provider, model, trạng thái hoặc loại tác vụ.
4. Admin có thể xem chi tiết từng log để debug request, response, lỗi và thời gian xử lý.
5. Hệ thống không hiển thị API key hoặc secret trong log.
