# Starlight Cinema

Workspace Next.js + NestJS + PostgreSQL. Bản cập nhật backend ngày 02/11/2026 dùng đúng ba vai trò CUSTOMER / STAFF / MANAGER, có phân quyền theo rạp, giữ ghế/đơn/vé, đổi/hoàn, check-in, nhận combo, quản lý danh mục/nhân viên và audit.

**Frontend hiện tại vẫn là giao diện mô phỏng và được giữ nguyên theo yêu cầu. Chưa tích hợp cổng thanh toán thật.** Backend không còn API tự mô phỏng thành công hoặc webhook demo; thao tác thu/hoàn cần nhà cung cấp trả 503 PAYMENT_NOT_CONFIGURED khi chưa có adapter. Không coi giao diện hiển thị thành công là bằng chứng giao dịch backend.

## Chạy backend sau khi xem thay đổi

```powershell
pnpm.cmd install --frozen-lockfile
node infra/setup-env.mjs
docker compose up -d postgres mailpit
pnpm.cmd db:migrate
pnpm.cmd --filter @starlight/api bootstrap:manager
pnpm.cmd --filter @starlight/api build
pnpm.cmd --filter @starlight/api start
```

Trước lệnh bootstrap, cấu hình local `INITIAL_MANAGER_EMAIL`, `INITIAL_MANAGER_PASSWORD` (≥16 ký tự) và `INITIAL_CINEMA_NAME` để tạo rạp mới. Không có mật khẩu quản lý mặc định, không gửi secret qua chat. CLI chỉ hoạt động khi chưa có quản lý không bị khóa; gỡ các biến INITIAL sau khi dùng. Các biến JWT_SECRET, QR_SECRET, DATABASE_URL, WEB_ORIGIN phải được cấu hình theo `.env.example`. Setup-env giữ nguyên `.env` đang có.

API: http://localhost:4000/api/v1/health. Worker ở terminal khác:

```powershell
pnpm.cmd --filter @starlight/api worker
```

Các lệnh trên do người vận hành chạy sau khi rà soát/sao lưu. Lượt cập nhật này chưa áp dụng migration vào database chính, chưa commit/push/merge/deploy. Chỉ PostgreSQL/Mailpit được khởi động phục vụ test và Nest được mở ở cổng ngẫu nhiên trong test rồi đóng.

## Dữ liệu cũ và tích hợp

Migration chuyển COUNTER/GATE sang STAFF nhưng giữ UUID/phân công/lịch sử. Tài khoản demo công khai cũ bị khóa và session thu hồi; không xóa chúng. Đơn/danh mục có sẵn được gắn LEGACY_DEMO, không dùng làm giao dịch thật hoặc quảng bá trong danh mục public. Giá trị tiền, trạng thái giao dịch và policy_version lịch sử được giữ nguyên. Dữ liệu mới có provenance OPERATIONAL; quản lý nhập danh mục qua API.

Fixture nằm trong `apps/api/test`, chỉ chạy với NODE_ENV=test và database starlight_test. Các lệnh seed demo cũ đã bỏ. Không dùng `docker compose down -v` để nâng cấp.

SMTP dùng Nodemailer, cần SMTP_HOST/PORT/FROM và USER/PASSWORD/TLS phù hợp. Thiếu cấu hình thì outbox chờ, không giả báo đã gửi. Mailpit chỉ là hộp thư kiểm thử local; thanh toán cần chọn nhà cung cấp và triển khai adapter theo tài liệu của nhà cung cấp, không chỉ thêm một HMAC chung.

## Kiểm tra

```powershell
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd --filter @starlight/api build
pnpm.cmd lint
git diff --exit-code -- apps/web
```

Test dùng TEST_DATABASE_URL trỏ riêng tới starlight_test, không reset database chính. Chưa chạy E2E giao diện mới với backend: trang chính vẫn dùng mock-data và các bài browser demo cũ không phải tiêu chí nghiệm thu backend này.

- [Bảng quyền, payload API, lệnh chạy, migration và giới hạn](docs/BACKEND_API.md)
- [Kết quả kiểm thử thực tế](docs/TEST_RESULTS.md)
- [AI Log](docs/AI_LOG.md)
- [Brief](docs/STARLIGHT_VIBE_CODING_BRIEF.md), [thiết kế nguồn](docs/STARLIGHT_IMPLEMENTATION_DESIGN.md)

Các tài liệu nguồn và bằng chứng ngày 01/11 hoặc lượt check-in trước là lịch sử. Yêu cầu backend mới và BACKEND_API.md thay thế hướng dẫn demo/login/seed của các bản đó.
