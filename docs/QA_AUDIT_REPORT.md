# Starlight Cinema — QA audit và phạm vi hoàn thiện

## Đã kiểm chứng trong lượt rà soát

- Backend có ba vai trò `CUSTOMER`, `STAFF`, `MANAGER`; các route quản trị và check-in đều dùng guard vai trò và phạm vi rạp.
- Dashboard quản lý mới dùng API backend `/api/v1/admin/dashboard`, lọc theo ngày và rạp được phân công, tổng hợp đơn đã xác nhận, vé phát hành, check-in, thu/hoàn, tiền ròng, đối soát và hàng đợi đổi/hoàn.
- Trang `/manager/accounts` đã hiển thị dashboard vận hành và khu vực quản lý nhân viên trong cùng màn hình.
- Luồng chọn phim/suất chiếu không còn tự rơi về danh mục mock khi API lỗi; giao diện báo trạng thái không khả dụng. Luồng ghế cũng không dựng lại sơ đồ ghế giả khi không tải được dữ liệu.
- Endpoint checkout demo cũ đã được gỡ khỏi `CatalogController`; thanh toán bắt đầu từ hold → booking → payment backend.
- `pnpm --filter @starlight/api typecheck` — đạt.
- `pnpm --filter @starlight/web typecheck` — đạt.
- `pnpm --filter @starlight/web build` — đạt.
- `pnpm db:migrate` — migration lưu mã giao dịch MoMo đã áp dụng.
- `pnpm --filter @starlight/api test` — 5 test files, 73/73 ca đạt trên PostgreSQL test.
- Bộ test check-in trước đó đã đạt 21/21; bộ booking trước đó 17/18, còn một ca AC11 phụ thuộc trạng thái dữ liệu test tích lũy.

## Chưa thể kiểm chứng trong môi trường hiện tại

- Docker Engine chưa chạy nên không thể xác nhận PostgreSQL/Compose hoặc chạy lại test tích hợp cần DB trong lượt này. Lỗi môi trường: `failed to connect to the docker API ... dockerDesktopLinuxEngine`.
- MoMo thật chưa thể xác nhận nếu chưa cung cấp credential và một URL HTTPS công khai cho IPN. Adapter đã có biến môi trường và kiểm tra chữ ký; không giả lập giao dịch thật trong luồng vận hành.
- Camera vật lý, Safari/iOS thật và webhook MoMo production chưa được coi là đã kiểm chứng.

## Backend thay đổi trong lượt này

- MoMo sandbox có create/refund/query, lưu `provider_transaction_id` bằng migration `PaymentProviderReference1793754000001`.
- Notification outbox chỉ giữ transaction khi claim/cập nhật; không giữ transaction trong lúc gọi webhook ngoài.
- Dashboard metrics đã sửa CTE và chuẩn hóa kiểu số JSON; occupancy dùng múi giờ nghiệp vụ `Asia/Ho_Chi_Minh`.

## Cách mở và demo

```powershell
docker compose --profile full up -d
pnpm --filter @starlight/api dev
pnpm --filter @starlight/web dev
```

- Khách hàng: `http://localhost:3000/`
- Nhân viên check-in: `http://localhost:3000/staff/check-in`
- Quản lý: `http://localhost:3000/manager/accounts`

Đăng nhập bằng tài khoản đã seed trong `README.md`/`.env` của môi trường; không dùng endpoint tạo manager trong production flow.
