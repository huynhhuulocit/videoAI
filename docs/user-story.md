# User Story - VideoAI

Tài liệu này là trang tổng quan cho user story của VideoAI. Các phần chi tiết được tách thành nhiều file trong `docs/` để dễ quản lý và mở rộng thêm FSD, TSD, AGENT, skill và hook ở các giai đoạn sau.

## Mục tiêu sản phẩm

VideoAI cho phép người dùng đăng nhập, tạo dự án và tạo script hoặc video bằng AI theo hai hướng chính:

- Tạo nội dung từ kịch bản/prompt do user nhập, có thể bổ sung hình ảnh hoặc video mẫu để AI phân tích.
- Tạo nội dung từ URL sản phẩm, có thể bổ sung hình ảnh hoặc video mẫu để AI phân tích và tạo prompt chính xác hơn.

Khi tạo dự án, user chọn `Scenario` hoặc `Product Flow`; trang chi tiết dự án sẽ mở đúng workspace theo lựa chọn này.

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
- User chọn `Scenario` hoặc `Product Flow` ngay trong form tạo dự án.
- User có thể mở menu `Projects` để xem toàn bộ project active của mình, mở lại workspace tương ứng hoặc xóa/archive project khỏi danh sách.
- User có thể mở menu `One Click` để tạo nhanh một project `Scenario` theo wizard riêng. One Click không thêm flow type backend mới; Start tạo project script bình thường với name/description, Step 1 tạo/chỉnh và lưu `Story Content`, Step 2 là `Scenario` step dùng scenario catalog để AI phân tích/chọn attributes mà không hiển thị dropdown `Choose scenario` rồi lưu Scenario mới theo setup name/description, Step 3 dùng `Shots` master prompt và Story Content để tạo shot plan editable gắn với project theo setup name/description và không hiển thị selector chọn shot plan có sẵn.
- User có thể tạo script hoặc tạo video từ URL sản phẩm sau khi AI phân tích sản phẩm.
- User có thể upload hình ảnh hoặc video mẫu trong luồng tạo nội dung để AI phân tích trước khi tạo prompt.
- Trong project workspace, mỗi shot card của `Bước 3` gom attribute cấp shot vào panel `Attributes` mặc định thu gọn giống pattern và độ rộng desktop ở `Bước 2`, còn `Create Prompt` là action riêng của shot.
- Trong project workspace, các action AI dùng master prompt có button `Prompt` trước `Request` để xem prompt đầy đủ sau khi thay placeholder; hệ thống không tự nối runtime context ẩn vào prompt text.
- Trong project workspace, mọi action AI chính (`Generate Story Content`, `Analyze scenario`, `Generate shots`, Product Flow `Analyze`) có button `Request` và `Response` cạnh action; button mở popup read-only để user kiểm tra raw request/response mới nhất đã redact secret.
- User có thể mở `Kịch bản` để xem danh sách scenario, thêm/sửa ở `/templates/new` hoặc `/templates/{templateId}` và xóa/archive. Scenario gồm attribute/option có thể tạo bằng AI hoặc thủ công; trang thêm/sửa hiển thị `Scenario` master prompt có thể sửa tạm cho lần tạo AI, hiển thị lỗi provider chi tiết nếu thất bại và không fallback sang dữ liệu mẫu.
- Trong `Scenario`, user có thể để AI phân tích story theo Kịch bản đang chọn, tự chọn option phù hợp và lưu selection đó vào project để lần mở lại vẫn giữ đúng lựa chọn.
- `Phân tích kịch bản` dùng default `Scenario` master prompt do admin quản lý; user chỉ có thể sửa tạm master prompt trong workspace khi Admin Site Config `showUserMasterPrompts=true`, rồi hệ thống kết hợp master prompt, nội dung kịch bản và catalog attribute/option để chọn option phù hợp.
- Nếu `Phân tích kịch bản` gặp lỗi AI, workspace hiển thị lỗi chi tiết ngay tại Bước 2 với mã lỗi, provider/model, gợi ý cấu hình cần kiểm tra và job ID để admin đối chiếu trong AI Logs.
- Trong `Scenario`, `Story Content` là Bước 1, `Kịch bản tạo prompt` là Bước 2, `Shots tạo prompt` là Bước 3, các step có thể thu gọn/mở rộng. Story Content dùng `Story Content` master prompt do admin quản lý; textarea master prompt chỉ hiển thị và cho sửa tạm thời khi Admin Site Config `showUserMasterPrompts=true`. Response tạo bằng AI được ghi lại vào textarea Story Content và dùng chung cho phân tích kịch bản, tạo shots, compose prompt từng shot và tạo script.
- Container `Scenario` dùng toàn bộ bề rộng workspace để Bước 1, Bước 2 và Bước 3 có đủ không gian chỉnh prompt, attribute và shots.
- Trong `Scenario`, Bước 3 chỉ hiển thị `Shots` master prompt do admin quản lý trong textarea có thể sửa tạm thời khi Admin Site Config `showUserMasterPrompts=true`; prompt override này chỉ dùng cho lần tạo shots hiện tại.
- Admin có thể đăng ký, đăng nhập và truy cập dashboard admin.
- Admin có thể bật/tắt chế độ tạo prompt/script hoặc tạo video cho toàn site.
- Admin có thể chọn provider/model mặc định cho tạo prompt, ví dụ Gemini hoặc ChatGPT.
- Admin có thể nhập API key và chọn model tạo video, ví dụ Veo hoặc Gemini.
- Admin có thể quản lý `Master Prompt` tại route tương thích `/admin/shot-prompt` và các route canonical, gồm `Story Content`, `Scenario`, `Shots`, và `Shot`, mỗi nhóm có create/edit/delete và một default active. API vẫn giữ type key `scripts` cho nhóm `Story Content` để tương thích dữ liệu hiện tại.
- Master prompt giữ format placeholder khuyến nghị theo từng nhóm, nhưng không bắt buộc placeholder khi lưu; backend chỉ đưa runtime data vào prompt khi prompt có placeholder tương ứng. Mỗi Story Content, Scenario, Shots và Shot master prompt có thêm `Output Format placeholder` textarea; `{outputFormat}` render từ field này và thiếu field khi token được dùng phải báo lỗi rõ ràng.
- Admin có thể quản lý `Master Prompt Config` trong nhóm `AI` để tạo một bộ attribute/option global dùng riêng cho admin khi author master prompt. Từng master prompt có thể lưu selection từ bộ này, và selection chỉ render qua `{masterPromptAttributes}` trong prompt admin.
- Admin có thể quản lý `Site Config` trong AI Config. `Show master prompts in user workspace` mặc định là `No`; khi `No`, Project và One Click ẩn các textarea Story/Scenario/Shots/Shot master prompt nhưng vẫn giữ nút `Prompt` để preview prompt rendered và backend dùng active admin default prompt.
- User screens không hiển thị `Master Prompt Config`, không gợi ý `{masterPromptAttributes}`, và user prompt override tạm thời không được sử dụng placeholder admin-only này.
- Tất cả textarea hiển thị ở admin/user có counter ký tự nhỏ ở góc trái phía dưới; textarea ẩn dùng copy clipboard không hiển thị counter.
- Hệ thống cần ghi log request trước khi submit tới AI và response sau khi AI trả về.

## Current Admin Attribute Catalog Scope

- Scenario management is admin-only. User navigation no longer exposes the Scenario catalog list or editor.
- Admin manages Story, Scenario, Shots, and Shot as separate parent groups. Each group has a Master Prompt page and an Attribute page.
- Attribute catalogs are separate from Master Prompts. Attribute Generation Prompt is separate as well and is used only to produce catalog JSON.
- Tracked `data-examples/` files are the editable admin templates for new Story, Scenario, Shots, and Shot master prompts and Attribute Generation Prompts. File-backed templates cannot be deleted or set as default; saving a new item still creates a DB record.
- Master Prompt Config is also separate from workflow Attribute catalogs. It is admin-only, shared globally across Story/Scenario/Shots/Shot master prompt editors, and user workflows cannot select or mutate it.
- Project and One Click workflows load active admin catalogs for Story, Scenario, Shots, and per-shot Shot. When there is no saved selection, every attribute starts with its first option selected. Required attributes cannot be empty; optional attributes can be cleared after the initial default selection.
- Runtime data enters AI prompts only through explicit placeholders in the selected prompt, such as `{storyAttributes}`, `{scenario}`, `{scenarioAttributes}`, and `{shotsAttributes}`. In Step 3, `{scenario}` is the editable Scenario result saved by Step 2 `Analyze scenario`, `Save selection`, or `Save Project`.
- Admin also manages a singular `Shot` feature for Step 4. `Shots` creates the Step 3 shot-list JSON; `Shot` provides the Step 4 per-shot master prompt and `Shot Attribute` catalog used to render a final prompt for one shot. Step 4 uses exact placeholder rendering only and stores per-shot `Shot Attribute` selections on each shot JSON object.
- `{masterPromptAttributes}` is an admin-only placeholder that renders only from the admin-saved selection on the active master prompt.

## AI Handoff Scope

- Public Home shows an `AI Handoff extension` install/status card with `Install extension` and `Check installed`.
- Installation uses the Chrome Web Store listing URL configured by `NEXT_PUBLIC_AI_HANDOFF_EXTENSION_URL`; the app must not claim direct one-click extension installation because Chrome requires the user to install through the browser store flow.
- In Project and One Click Step 4, each shot card can send the exact rendered shot prompt to the AI Handoff Chrome extension after an explicit user click.
- AI Handoff is generic. `google-flow-veo` is the first target adapter, but the data model and UI stay provider-neutral.
- Admin > AI Config controls the AI Handoff provider, target URL, and prompt selector. ENV values seed local/bootstrap setup only for provider/target URL; runtime uses the saved Admin target URL/selector and fails clearly when either is blank.
- The extension popup lets admins run `Check DOM` on the live Flow page to capture the prompt input selector and `Test fill` to validate it with hardcoded text without clicking Generate.
- AI Handoff v1 automates prompt text only. Reference images/videos remain visible in VideoAI and are uploaded manually to the target AI website.
- The extension must not store provider cookies, passwords, API keys, or try to bypass provider login, quota, CAPTCHA, safety dialogs, or restrictions.
- Handoff status is persisted per project/shot so users and admins can inspect whether the prompt was sent, target opened, filled, generated, failed, or completed manually.
## Project Templates

Admins can define reusable Project Templates by choosing workflow steps and a
saved master prompt for each selected Story, Scenario, Shots, and Shot step.
The creation UI prioritizes Shot, Shots, Scenario, Story; Shot is always
selected, and choosing an earlier step includes every later step through Shot.
Users clone these templates
into their own Custom Templates, adjust prompt and attribute snapshots, and
create projects from those snapshots. Snapshot projects remain stable after
future Admin default changes.
