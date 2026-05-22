# Upload hình ảnh/video mẫu

## Current Local Implementation

- Browser validation is only an early UX check.
- Authoritative media metadata is stored in PostgreSQL table `media.media_assets`.
- Binary files are stored by the local storage provider under `storage/uploads`.
- The frontend receives database media IDs from `POST /api/v1/projects/{projectId}/media`.
- Prompt generation and product analysis may only submit media IDs that exist in PostgreSQL with status `validated`.
- In `Scenario`, uploaded media is attached inside an individual shot card and the validated media IDs are stored in that shot JSON as `mediaIds`.
- Shot media uploads are persisted to the active shot plan so reloading the project keeps the uploaded image/video attached to the same shot.
- Prompt popups that receive media show the saved media preview, filename, database media ID, MIME, size and preview URL. Prompt copy remains text-only and does not copy image binaries.
- In `Product Flow`, uploaded media remains project-level and is sent with the product analysis request.
- Removing a file soft-deletes the media metadata by setting status `deleted`; deleted media IDs must not be accepted by AI workflows.

## 1. Mục tiêu

User có thể upload hình ảnh hoặc video mẫu trong luồng tạo video theo kịch bản và luồng tạo video theo thông tin sản phẩm. AI dùng media mẫu để phân tích style, bối cảnh, sản phẩm, bố cục, màu sắc, góc quay và cách trình bày trước khi tạo prompt/script.

## 2. Luồng áp dụng

### 2.1. Tạo video theo kịch bản

- User nhập kịch bản hoặc prompt.
- User tạo hoặc chọn shot plan.
- User upload hình ảnh/video mẫu bên trong từng shot nếu cần.
- Hệ thống preview media đã upload trong đúng shot card.
- User có thể xóa từng file media khỏi shot.
- Khi user click `Tạo Prompt` trong shot, hệ thống compose prompt cục bộ từ text, shot JSON, `mediaIds` của shot và template selection.

### 2.2. Tạo video theo thông tin sản phẩm

- User nhập URL sản phẩm.
- User upload hình ảnh/video mẫu nếu cần.
- Hệ thống preview media đã upload.
- User có thể xóa từng file media.
- Khi user click `Phân tích sản phẩm`, AI phân tích URL sản phẩm và media mẫu để tạo prompt/script.

## 3. Định dạng file hỗ trợ

Hình ảnh:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

Video:

- `.mp4`
- `.mov`
- `.webm`

## 4. Giới hạn upload đề xuất

- Tối đa 10 file cho mỗi lần tạo nội dung.
- Tối đa 10 MB cho mỗi file hình ảnh.
- Tối đa 200 MB cho mỗi file video.
- Tối đa 3 phút cho mỗi file video.
- Tổng dung lượng media trong một lần tạo nội dung không vượt quá 500 MB.

Các giới hạn này là baseline cho user story. FSD/TSD có thể điều chỉnh theo hạ tầng storage, provider AI và giới hạn chi phí.

## 5. Preview và quản lý file

- Hệ thống phải hiển thị preview thumbnail cho hình ảnh.
- Hệ thống phải hiển thị preview player hoặc thumbnail cho video.
- Mỗi file phải hiển thị tên file, dung lượng, loại file và trạng thái upload.
- User có thể xóa từng file trước khi gọi AI.
- Nếu file upload lỗi, hệ thống hiển thị lỗi trên đúng file đó.
- Nếu file không hợp lệ, hệ thống không gửi file đó tới AI.

## 6. Phân tích media bằng AI

AI cần phân tích media mẫu để rút ra các yếu tố:

- Chủ thể chính trong ảnh/video.
- Màu sắc và mood tổng thể.
- Bối cảnh và môi trường.
- Bố cục hình ảnh.
- Góc quay và chuyển động camera nếu là video.
- Phong cách trình bày sản phẩm.
- Điểm cần giữ lại hoặc tránh khi tạo prompt/script.

Kết quả phân tích media được dùng để tạo prompt/script chính xác hơn, nhưng user vẫn có thể chỉnh sửa nội dung cuối cùng trước khi tạo script hoặc video.

## 7. Trạng thái và lỗi

- Khi upload file, hệ thống hiển thị trạng thái `Đang upload`.
- Khi phân tích media, hệ thống hiển thị trạng thái `Đang phân tích`.
- Nếu file vượt dung lượng, hệ thống hiển thị lỗi dung lượng.
- Nếu file sai định dạng, hệ thống hiển thị lỗi định dạng.
- Nếu video vượt thời lượng, hệ thống hiển thị lỗi thời lượng.
- Nếu AI không phân tích được media, hệ thống hiển thị lỗi và cho phép user thử lại hoặc xóa file.
