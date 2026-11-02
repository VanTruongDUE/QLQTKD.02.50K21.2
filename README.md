# Starlight Cinema – Cinema Management & Ticketing Platform

Hệ thống quản lý cụm rạp chiếu phim hiện đại với kiến trúc Full-stack Monorepo gồm **Next.js 16 (Turbopack)**, **NestJS 11**, **PostgreSQL 17**, và tích hợp tự động hóa quy trình gửi email thông báo qua **n8n Cloud**.

---

## 1. Giới thiệu dự án

**Starlight Cinema** là nền tảng quản lý rạp và bán vé xem phim toàn diện, hỗ trợ đầy đủ các nghiệp vụ thực tế của một cụm rạp:
- **Khách hàng (CUSTOMER)**: Khám phá phim, xem lịch chiếu theo rạp, giữ ghế thời gian thực (300 giây), đặt combo bắp nước, nhận vé điện tử QR an toàn, yêu cầu đổi suất chiếu / hoàn vé theo chính sách.
- **Nhân viên (STAFF)**: Tra cứu vé, quét mã QR / laser check-in vào phòng chiếu (kiểm soát khung giờ -30 phút đến +15 phút), trả combo bắp nước theo phân công rạp phụ trách.
- **Quản lý (MANAGER)**: Quản lý danh mục rạp, phòng chiếu, phim, suất chiếu, giá vé; phê duyệt yêu cầu đổi/trả vé; quản trị nhân viên và xem báo cáo tài chính, audit trail.

---

## 2. Tech Stack

- **Frontend**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack), React 19, Tailwind CSS v4, Lucide Icons, React Hook Form, Zod.
- **Backend**: [NestJS 11](https://nestjs.com/) (TypeScript), Express, Passport JWT, Throttler (Rate Limiting).
- **Database & ORM**: [PostgreSQL 17](https://www.postgresql.org/) (Docker), [TypeORM](https://typeorm.io/) với cơ chế Migration có kiểm soát.
- **Background Worker & Outbox**: Transactional Outbox Pattern xử lý gửi email và webhook bất đồng bộ, có retry và tracking trạng thái.
- **Automation & Workflow**: [n8n Cloud](https://n8n.io/) Webhook tích hợp Header Secret Authentication và Gmail SMTP Credential.
- **Package Manager & Monorepo**: [pnpm 10](https://pnpm.io/) Workspaces.
- **Testing & Code Quality**: Vitest 3, Playwright, Oxlint, Prettier.

---

## 3. Kiến trúc tổng thể & Nguyên tắc bảo mật

### Kiến trúc tổng thể

```
[ Frontend: Next.js 16 (Vercel) ]
               |  (HTTPS / REST API)
               v
[ Backend: NestJS 11 (Docker / Cloud API) ]
    |                    |
    | (Advisory Lock)    | (Transactional Outbox)
    v                    v
[ PostgreSQL 17 ]   [ notification_outbox ]
                         |
                         v (Background Worker)
            [ n8n Cloud Webhook ]  hoặc  [ SMTP Local / Mailpit ]
                    |
                    v
          [ Gmail SMTP / Customer ]
```

### Nguyên tắc bảo mật cốt lõi
1. **Phân quyền Role-Based Access Control (RBAC)**: Phân tách rõ ràng 3 vai trò: `CUSTOMER`, `STAFF`, `MANAGER`. API nhạy cảm được bảo vệ nghiêm ngặt qua `@Roles()` Guard. Nhân viên chỉ được thao tác tại rạp được phân công.
2. **Khóa chống giữ trùng ghế**: Cơ chế PostgreSQL Advisory Transaction Locks (`pg_advisory_xact_lock`) giữ ghế an toàn trong đúng 300 giây (5 phút), tự động giải phóng khi hết hạn.
3. **Vé điện tử & Token QR an toàn**: QR chứa token đã ký bảo mật (HMAC SHA-256) kèm mã tra cứu duy nhất. Check-in chỉ hợp lệ trong khung giờ cho phép và cập nhật trạng thái nguyên tử (`atomic update`), ngăn chặn tái sử dụng vé.
4. **Transactional Outbox Pattern**: Không gọi HTTP webhook trực tiếp trong transaction đặt vé để tránh kéo dài lock hoặc thất thoát thông báo. Event được ghi vào bảng `notification_outbox` và Worker phụ trách gửi có retry, timeout và idempotency key.
5. **Bảo mật Secret**: Tuyệt đối không commit file `.env`, mật khẩu, hay secret key vào Git. Mọi key đều yêu cầu độ dài tối thiểu 32 ký tự khi khởi động.

---

## 4. Cấu trúc thư mục

```
starlight-cinema/
├── apps/
│   ├── api/                     # Backend NestJS
│   │   ├── src/
│   │   │   ├── auth/            # JWT, Auth Guards, RBAC
│   │   │   ├── booking.service.ts # Nghiệp vụ giữ ghế, tạo đơn, xác nhận vé
│   │   │   ├── check-in/        # Quét mã QR, xác minh phòng chiếu
│   │   │   ├── operations/      # Quản trị danh mục, nhân viên, audit log
│   │   │   ├── notification.ts  # Notification Service & n8n Webhook Client
│   │   │   ├── worker.ts        # Background Worker xử lý Outbox
│   │   │   └── database/        # TypeORM DataSource & Migrations
│   │   └── test/                # 71 Integration & Unit Tests
│   └── web/                     # Frontend Next.js 16
│       ├── app/                 # App Router (Trang chủ, Khách, Nhân viên, Quản trị)
│       └── components/          # UI Components
├── docs/                        # Tài liệu kỹ thuật, API, Workflow n8n
│   ├── BACKEND_API.md           # Đặc tả chi tiết các endpoint API
│   ├── TEST_RESULTS.md          # Kết quả kiểm thử tự động
│   └── integrations/
│       ├── n8n-starlight-cinema.json # Workflow JSON chuẩn hóa cho n8n Cloud
│       └── n8n-starlight-cinema.md   # Hướng dẫn thiết lập n8n chi tiết
├── infra/                       # Dockerfile, Script cấu hình môi trường
├── packages/contracts/          # Schema chia sẻ giữa Frontend và Backend
├── compose.yaml                 # Docker Compose cho PostgreSQL 17 và Mailpit
├── .env.example                 # Mẫu biến môi trường an toàn (placeholder)
└── package.json                 # Cấu hình workspace pnpm
```

---

## 5. Hướng dẫn thiết lập môi trường

Sao chép file `.env.example` thành `.env`:

```powershell
cp .env.example .env
```

Mở file `.env` và cập nhật các giá trị thích hợp:
- `JWT_SECRET`: Chuỗi ngẫu nhiên dài ít nhất 32 ký tự dùng để ký JWT.
- `QR_SECRET`: Chuỗi ngẫu nhiên dài ít nhất 32 ký tự dùng để ký mã vé QR.
- `DATABASE_URL`: Đường dẫn kết nối PostgreSQL (mặc định trỏ tới Docker local port `54329`).
- `WEB_ORIGIN`: URL gốc của Frontend (mặc định `http://localhost:3000`).
- `NEXT_PUBLIC_API_URL`: URL API công khai cho Frontend (mặc định `http://localhost:4000/api/v1`).
- `N8N_WEBHOOK_URL` & `N8N_WEBHOOK_SECRET`: (Tùy chọn) Webhook URL và Secret trên n8n Cloud.

> **Cảnh báo bảo mật**: Tuyệt đối không commit file `.env` chứa thông tin thực lên GitHub!

---

## 6. Khởi chạy Docker (Database & Mail Testing)

Khởi động PostgreSQL 17 và Mailpit:

```powershell
docker compose up -d postgres mailpit
```

- **PostgreSQL 17**: `127.0.0.1:54329` (Database: `starlight`, Test DB: `starlight_test`)
- **Mailpit Web UI**: `http://localhost:8025` (Xem email kiểm thử gửi từ Worker)
- **Mailpit SMTP**: `127.0.0.1:1025`

---

## 7. Migration và Bootstrap tài khoản Quản lý

### Cài đặt dependencies:
```powershell
pnpm install --frozen-lockfile
```

### Chạy Database Migrations:
```powershell
pnpm db:migrate
```

### Tạo tài khoản Quản lý đầu tiên (Bootstrap):
Thiết lập biến tạm thời trên terminal (không lưu vào code) và chạy CLI bootstrap:

```powershell
$env:INITIAL_MANAGER_EMAIL="admin@starlight.vn"
$env:INITIAL_MANAGER_PASSWORD="StrongAdminPassword123!"
$env:INITIAL_CINEMA_NAME="Starlight Nguyễn Du"

pnpm --filter @starlight/api bootstrap:manager

# Xóa biến môi trường sau khi tạo thành công:
Remove-Item Env:INITIAL_MANAGER_EMAIL
Remove-Item Env:INITIAL_MANAGER_PASSWORD
Remove-Item Env:INITIAL_CINEMA_NAME
```

---

## 8. Khởi chạy Backend và Background Worker

### Khởi chạy Backend API (Port 4000):
```powershell
pnpm --filter @starlight/api dev
```
API Health Check: `http://localhost:4000/api/v1/health`

### Khởi chạy Background Worker (Xử lý Outbox / Gửi Email):
Mở một cửa sổ terminal riêng và chạy:
```powershell
pnpm --filter @starlight/api worker
```

---

## 9. Khởi chạy Frontend (Next.js)

```powershell
pnpm --filter @starlight/web dev
```
Truy cập giao diện tại: `http://localhost:3000`

---

## 10. Kiểm thử và Kiểm tra chất lượng mã nguồn

Tất cả các kiểm thử integration, unit test và linting đều được thiết kế chạy độc lập với database kiểm thử riêng (`starlight_test`):

```powershell
# Chạy toàn bộ 71 integration tests
pnpm test

# Kiểm tra TypeScript type-check
pnpm typecheck

# Build kiểm tra Backend
pnpm --filter @starlight/api build

# Build kiểm tra Frontend Next.js (SSG/SSR)
pnpm --filter @starlight/web build

# Chạy linter
pnpm lint
```

---

## 11. Hướng dẫn tích hợp n8n Cloud Workflow

Hệ thống cung cấp sẵn file workflow tự động hóa hoàn chỉnh: `docs/integrations/n8n-starlight-cinema.json`.

1. Đăng nhập vào workspace **n8n Cloud**.
2. Nhấn **Add workflow** > Chọn menu ba chấm `...` > **Import from File** > Chọn file `docs/integrations/n8n-starlight-cinema.json`.
3. Nhấp đúp vào node **Starlight Webhook**:
   - Chọn Authentication: **Header Auth**.
   - Tạo Credential mới: Header Name là `X-Webhook-Secret`, Value khớp với biến `N8N_WEBHOOK_SECRET` trong `.env`.
4. Nhấp đúp vào các node **Gmail SMTP Send** trên từng nhánh:
   - Chọn Credential Gmail SMTP đã liên kết sẵn trên tài khoản n8n Cloud của bạn.
5. Xem chi tiết hướng dẫn tại [docs/integrations/n8n-starlight-cinema.md](docs/integrations/n8n-starlight-cinema.md).

---

## 12. Hướng dẫn triển khai Production

### Frontend (Triển khai lên Vercel)
1. Kết nối repository GitHub với tài khoản Vercel.
2. Thiết lập **Root Directory** là `apps/web`.
3. Thêm Environment Variable trên Vercel:
   - `NEXT_PUBLIC_API_URL`: URL HTTPS của Backend API thực tế (ví dụ: `https://api.yourdomain.com/api/v1`).
4. Nhấn **Deploy**.

### Backend (Triển khai lên Docker / VPS / PaaS)
1. Chuẩn bị cơ sở dữ liệu PostgreSQL 17 (qua dịch vụ Managed Postgres như Neon, Supabase, AWS RDS, hoặc Docker trên VPS).
2. Thiết lập các Environment Variables an toàn trên server:
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://user:password@host:port/dbname`
   - `JWT_SECRET` (ít nhất 32 ký tự ngẫu nhiên)
   - `QR_SECRET` (ít nhất 32 ký tự ngẫu nhiên)
   - `WEB_ORIGIN=https://your-frontend-domain.vercel.app`
   - `PORT=4000`
   - `N8N_WEBHOOK_URL` & `N8N_WEBHOOK_SECRET` (nếu dùng n8n)
   - `SMTP_*` (nếu dùng SMTP trực tiếp)
3. Chạy lệnh:
   ```bash
   pnpm install --frozen-lockfile
   pnpm db:migrate
   pnpm --filter @starlight/api build
   pnpm --filter @starlight/api start
   ```
4. Chạy tiến trình Worker bằng Process Manager (PM2 / Systemd):
   ```bash
   node apps/api/dist/worker.js
   ```

---

## Giấy phép
Dự án được bảo lưu bản quyền theo quy định nội bộ của đồ án Starlight Cinema.
