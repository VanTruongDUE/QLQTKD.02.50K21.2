# Starlight Cinema

Demo học phần: Next.js + NestJS + PostgreSQL, giao diện tiếng Việt. Đã triển khai nền tảng và luồng phim → suất → ghế/combo → giữ 5 phút → thanh toán giả lập → vé QR. Không thu tiền thật.

Trạng thái bàn giao: toàn bộ ứng dụng đang chạy bằng Docker Compose. Mở http://localhost:3000 ngay; sau khi khởi động lại máy, mở Docker Desktop rồi chạy `docker compose --profile full up -d`. Các lệnh chạy Node trực tiếp bên dưới là phương án phát triển thay thế; dừng ba container ứng dụng bằng `docker compose stop web api worker` trước khi dùng để tránh trùng cổng.

## Chạy trên máy Windows này

Mở Docker Desktop và đợi Engine chạy. Tại thư mục dự án:

```powershell
pnpm.cmd install --frozen-lockfile
node infra/setup-env.mjs
docker compose up -d postgres mailpit
pnpm.cmd db:migrate
pnpm.cmd db:seed
pnpm.cmd dev
```

Mở **http://localhost:3000**. API: http://localhost:4000/api/v1/health. Hộp thư thử nghiệm: http://localhost:8025.

Mở terminal thứ hai để tự giải phóng ghế và gửi thông báo:

```powershell
pnpm.cmd --filter @starlight/api worker
```

Worker dọn giữ ghế mỗi 5 giây; API vẫn kiểm tra hạn ngay dưới khóa khi worker dừng. Email chứa liên kết tới tài khoản, QR xem trong Vé của tôi. Mailpit chỉ nhận thư local.

Nếu các server của lượt triển khai vẫn đang chạy thì mở URL trực tiếp; không chạy thêm server vào cùng cổng. Dùng Ctrl+C trong terminal đang chạy để dừng. Không dùng `docker compose down -v` vì sẽ xóa dữ liệu.

## Tài khoản demo

Mật khẩu mặc định local từ `.env.example`: `StarlightDemo2026!`. Có thể thay DEMO_PASSWORD **trước lần seed đầu**. Seed lại không đổi mật khẩu hay xóa dữ liệu cũ.

| Email                 | Quyền                                                |
| --------------------- | ---------------------------------------------------- |
| khach@starlight.demo  | Khách hàng                                           |
| khach2@starlight.demo | Khách thứ hai để thử tranh ghế                       |
| quay@starlight.demo   | Nhân viên quầy; không được giả vai khách để giữ ghế  |
| soatve@starlight.demo | Kiểm tra/xác nhận QR trong rạp được phân công        |
| quanly@starlight.demo | Xem khoản tiền cần đối soát trong rạp được phân công |

Có thể đăng ký khách mới trên web. Phim, rạp, giá, combo, lịch đều giả lập; seed tạo lịch 5 ngày kể từ lúc chạy. Check-in nhận token QR qua ô nhập, chỉ trong khoảng 30 phút trước đến 15 phút sau giờ bắt đầu, cần xác minh tuổi. Chưa tích hợp camera.

## Kiểm thử và bản build

```powershell
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd exec playwright install chromium
pnpm.cmd test:e2e
```

`pnpm test` dùng **starlight_test** riêng, tự migrate và thêm fixture mới, không reset DB thật. DB này được init khi volume PostgreSQL mới được tạo. Nếu dùng volume cũ thiếu test DB: `docker compose exec postgres createdb -U starlight starlight_test` (chỉ chạy khi DB chưa có).

Playwright cần web/API đang chạy ở cổng 3000/4000. Test browser tạo tài khoản và đơn demo thật trong DB development, không xóa chúng; hai viewport có tài khoản riêng. Báo cáo ở `playwright-report/`, ảnh ở `test-results/`. Để thử bản production build: chạy `pnpm.cmd --filter @starlight/api start` và `pnpm.cmd --filter @starlight/web start` ở hai terminal sau khi build. Demo API vẫn dùng NODE_ENV=development trong `.env`; không mô tả đó là deployment production.

## Docker toàn bộ ứng dụng

```powershell
node infra/setup-env.mjs
docker compose --profile full up -d --build
docker compose exec api pnpm db:seed
```

Dừng server local trước để không trùng cổng. API tự chạy migration khi container khởi động. Volume giữ dữ liệu qua restart; `.env` được bỏ qua Git và Docker build context. Dockerfile dùng Node 24 và pnpm 10.32.1. Cấu hình mặc định chỉ phục vụ local, không đưa lên Internet với tài khoản demo.

## Môi trường đã kiểm tra

Node 24.14.0, npm 11.19.1, pnpm 10.32.1, Git 2.52.0.windows.1, Docker 29.9.2, Compose 5.6.1. Docker Engine ban đầu chưa chạy; đã mở Docker Desktop và xác minh kết nối, PostgreSQL/Mailpit healthy. Không có công cụ bắt buộc nào cần cài thủ công trên máy này. Chromium của Playwright đã được tải bằng lệnh trên.

`pnpm-lock.yaml` khóa phiên bản thực cài. Trên máy khác thiếu Node: cài Node.js 24 LTS rồi `npm.cmd install -g pnpm@10.32.1`; thiếu Git: cài Git for Windows; thiếu Docker: cài Docker Desktop, bật WSL2/virtualization theo trình cài và xác minh `docker info`. Không chỉ dựa vào `docker --version` để kết luận Engine sẵn sàng.

## Phạm vi còn lại

Chưa triển khai đổi/hoàn, duyệt hoàn, quầy tạo yêu cầu thay khách, CRUD danh mục, dashboard, n8n, cổng thanh toán sandbox của nhà cung cấp thật, camera QR, khôi phục mật khẩu. Callback muộn đã ghi khoản thu chờ duyệt; chưa tự trả tiền. Chưa đạt toàn bộ rubric TP3 hoặc số lượng 15 commit/10 tương tác AI — không tạo lịch sử giả.

Chi tiết: [quyết định và truy vết](docs/IMPLEMENTATION_NOTES.md), [kết quả kiểm thử](docs/TEST_RESULTS.md), [AI Log](docs/AI_LOG.md). Hai tài liệu nguồn được giữ nguyên ở root và sao chép vào `docs/` theo đường dẫn yêu cầu.
