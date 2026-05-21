# User Story - VideoAI

Tài liệu này là trang tổng quan cho user story của VideoAI. Các phần chi tiết được tách thành nhiều file trong `docs/` để dễ quản lý và mở rộng thêm FSD, TSD, AGENT, skill và hook ở các giai đoạn sau.

## Mục tiêu sản phẩm

VideoAI cho phép người dùng đăng nhập, tạo dự án và tạo script hoặc video bằng AI theo hai hướng chính:

- Tạo nội dung từ kịch bản/prompt do user nhập, có thể bổ sung hình ảnh hoặc video mẫu để AI phân tích.
- Tạo nội dung từ URL sản phẩm, có thể bổ sung hình ảnh hoặc video mẫu để AI phân tích và tạo prompt chính xác hơn.

Khi tạo dự án, user chọn `Script Flow` hoặc `Product Flow`; trang chi tiết dự án sẽ mở đúng workspace theo lựa chọn này.

Admin quản lý cấu hình toàn site, bao gồm chế độ user được tạo prompt/script hay tạo video, model AI mặc định cho tạo prompt, API key và model dùng cho tạo video, cùng log request/response khi hệ thống gọi AI.

## Tài khoản mẫu

- User: `user` / `User@123`
- Admin: `admin` / `Admin@123`

## Tài liệu chi tiết

- [Luồng người dùng](./user-stories/user-flows.md)
- [Yêu cầu chức năng](./user-stories/functional-requirements.md)
- [Cấu hình AI cho admin](./admin/ai-model-config.md)
- [Log request/response AI](./admin/ai-log-tracking.md)
- [Upload hình ảnh/video mẫu](./media/reference-media-upload.md)
- [Frontend và dashboard](./frontend/README.md)
- [Trạng thái implementation](./implementation-status.md)

## Cấu trúc tài liệu mở rộng

- `docs/user-stories/`: User story, user flow, functional requirements.
- `docs/admin/`: Tài liệu cho dashboard admin, cấu hình site, log và quản trị AI.
- `docs/media/`: Quy định upload, preview, phân tích media mẫu.
- `docs/frontend/`: Công nghệ frontend, design system, dashboard UX và component inventory.
- `docs/fsd/`: Nơi bổ sung Functional Specification Document.
- `docs/tsd/`: Nơi bổ sung Technical Specification Document.
- `docs/agents/`: Nơi bổ sung tài liệu AGENT.
- `docs/skills/`: Nơi bổ sung tài liệu skill.
- `docs/hooks/`: Nơi bổ sung tài liệu hook.

## Phạm vi hiện tại

- User có thể đăng nhập, tạo dự án, tạo script hoặc tạo video theo kịch bản.
- User chọn `Script Flow` hoặc `Product Flow` ngay trong form tạo dự án.
- User có thể mở menu `Projects` để xem toàn bộ project active của mình, mở lại workspace tương ứng hoặc xóa/archive project khỏi danh sách.
- User có thể mở menu `One Click` để tạo nhanh một project `Script Flow` theo wizard riêng. One Click không thêm flow type backend mới; Start tạo project script bình thường với name/description, Step 1 tạo/chỉnh và lưu `Story Content`, Step 2 là `Scenario` step dùng scenario catalog để AI phân tích/chọn attributes mà không hiển thị dropdown `Choose scenario` rồi lưu Scenario mới theo setup name/description, Step 3 dùng `Shots` master prompt và Story Content để tạo shot plan editable gắn với project theo setup name/description và không hiển thị selector chọn shot plan có sẵn.
- User có thể tạo script hoặc tạo video từ URL sản phẩm sau khi AI phân tích sản phẩm.
- User có thể upload hình ảnh hoặc video mẫu trong luồng tạo nội dung để AI phân tích trước khi tạo prompt.
- User có thể mở menu `Scripts` (route tương thích `/shots`) để xem danh sách script/shot plan reusable, thêm/sửa ở trang riêng `/shots/new` hoặc `/shots/{shotPlanId}` và xóa/archive. Khi tạo/sửa, user nhập nội dung câu chuyện trong textarea riêng, thêm attribute cấp shot plan, xem raw provider request và raw response JSON dạng thu gọn/mở rộng, chỉnh sửa nhiều shot video tối đa 8 giây/shot, mỗi shot có `Start state`, `End state` và `Dialogue`, rồi chọn shot plan đó trong bất kỳ project workspace nào của cùng user.
- Trong project workspace, mỗi shot card của `Bước 3` gom attribute cấp shot vào panel `Attributes` mặc định thu gọn giống pattern và độ rộng desktop ở `Bước 2`, còn `Create Prompt` là action riêng của shot.
- Trong project workspace, các action AI dùng master prompt có button `Prompt` trước `Request` để xem prompt đầy đủ sau khi thay placeholder; hệ thống không tự nối runtime context ẩn vào prompt text.
- Trong project workspace, mọi action AI chính (`Generate Story Content`, `Analyze scenario`, `Generate shots`, Product Flow `Analyze`) có button `Request` và `Response` cạnh action; button mở popup read-only để user kiểm tra raw request/response mới nhất đã redact secret.
- User có thể mở `Kịch bản` để xem danh sách scenario, thêm/sửa ở `/templates/new` hoặc `/templates/{templateId}` và xóa/archive. Scenario gồm attribute/option có thể tạo bằng AI hoặc thủ công; trang thêm/sửa hiển thị `Scenario` master prompt có thể sửa tạm cho lần tạo AI, hiển thị lỗi provider chi tiết nếu thất bại và không fallback sang dữ liệu mẫu.
- Trong `Script Flow`, user có thể để AI phân tích story theo Kịch bản đang chọn, tự chọn option phù hợp và lưu selection đó vào project để lần mở lại vẫn giữ đúng lựa chọn.
- `Phân tích kịch bản` dùng default `Scenario` master prompt do admin quản lý; user có thể sửa tạm master prompt trong workspace, rồi hệ thống kết hợp master prompt, nội dung kịch bản và catalog attribute/option để chọn option phù hợp.
- Nếu `Phân tích kịch bản` gặp lỗi AI, workspace hiển thị lỗi chi tiết ngay tại Bước 2 với mã lỗi, provider/model, gợi ý cấu hình cần kiểm tra và job ID để admin đối chiếu trong AI Logs.
- Trong `Script Flow`, `Story Content` là Bước 1, `Kịch bản tạo prompt` là Bước 2, `Shots tạo prompt` là Bước 3, các step có thể thu gọn/mở rộng. Story Content có `Story Content` master prompt do admin quản lý có thể sửa tạm thời; response tạo bằng AI được ghi lại vào textarea Story Content và dùng chung cho phân tích kịch bản, tạo shots, compose prompt từng shot và tạo script.
- Container `Script Flow` dùng toàn bộ bề rộng workspace để Bước 1, Bước 2 và Bước 3 có đủ không gian chỉnh prompt, attribute và shots.
- Trong `Script Flow`, Bước 3 hiển thị `Shots` master prompt do admin quản lý trong textarea có thể sửa tạm thời; prompt override này chỉ dùng cho lần tạo shots hiện tại.
- Admin có thể đăng ký, đăng nhập và truy cập dashboard admin.
- Admin có thể bật/tắt chế độ tạo prompt/script hoặc tạo video cho toàn site.
- Admin có thể chọn provider/model mặc định cho tạo prompt, ví dụ Gemini hoặc ChatGPT.
- Admin có thể nhập API key và chọn model tạo video, ví dụ Veo hoặc Gemini.
- Admin có thể quản lý `Master Prompt` tại route tương thích `/admin/shot-prompt`, gồm 3 nhóm `Story Content`, `Scenario`, `Shots`, mỗi nhóm có create/edit/delete và một default active. API vẫn giữ type key `scripts` cho nhóm `Story Content` để tương thích dữ liệu hiện tại.
- Master prompt giữ format placeholder khuyến nghị theo từng nhóm, nhưng không bắt buộc placeholder khi lưu; backend chỉ đưa runtime data vào prompt khi prompt có placeholder tương ứng.
- Tất cả textarea hiển thị ở admin/user có counter ký tự nhỏ ở góc trái phía dưới; textarea ẩn dùng copy clipboard không hiển thị counter.
- Hệ thống cần ghi log request trước khi submit tới AI và response sau khi AI trả về.
