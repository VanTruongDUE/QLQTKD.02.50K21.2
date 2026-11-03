# Báo Cáo Kết Quả Kiểm Thử Tích Hợp (Integration Test Report)
# STARLIGHT CINEMA – TP3 EVIDENCE

## Sửa lỗi fixture GitHub Actions — 03/11/2026

### Root cause

Các test files dùng chung `starlight_test`. `operations.test.ts` tạo và commit phim của riêng nó. Sau đó `booking.test.ts` gọi fixture `seed()`, nhưng fixture chỉ kiểm tra `SELECT id FROM movies LIMIT 1`; nếu có bất kỳ phim nào thì bỏ qua toàn bộ việc tạo cinema, user và dữ liệu seed còn lại. Log `Seed already exists; no existing data changed` chỉ thể hiện nhánh thoát đó, không xác nhận fixture bắt buộc đã tồn tại. Booking tiếp tục truy vấn hai email demo rồi đọc `.id` từ `undefined`. Fixture check-in cũng gọi `seed()`, sau đó tìm đúng tên cinema demo và truy vấn gate staff; các kết quả rỗng dẫn đến lỗi khi đọc `cinema.id` lúc gán nhân viên. Local từng qua khi DB đã có sẵn toàn bộ dữ liệu demo. Migration chỉ tạo schema, không seed các tài khoản và rạp này.

### Thay đổi

- `booking.test.ts` nay tự tạo hai CUSTOMER, hai STAFF, cinema, phim, auditorium, showtime và ghế của suite với email UUID duy nhất; không gọi demo seed hay tra cứu tài khoản demo.
- `seed-check-in.ts` nay tạo cinema/phim và CUSTOMER, STAFF, MANAGER riêng cho mỗi fixture, gán gate vào cinema vừa tạo và trả email fixture cho test. Playwright cấp email riêng cho customer/staff; kiểm tra session E2E dùng đúng customer được tạo.
- Bỏ ràng buộc test HTTP phải dùng cổng `54329`; vẫn bắt buộc tên database `starlight_test`, để có thể chạy an toàn trên PostgreSQL test cô lập ở cổng khác.
- Job `quality` có Mailpit và cấu hình SMTP test vì booking suite thực sự gửi thư vào Mailpit để kiểm tra worker.

### Xác minh sau sửa

- PostgreSQL 17 test mới trên Docker, database `starlight_test`, tmpfs ở cổng `54330`; migration chạy từ trạng thái trắng, không chạy seed runtime và không đụng DB phát triển `54329`.
- Chạy riêng `booking.test.ts` + `check-in.test.ts`: **40/40 qua** trên DB mới; chạy lại hai suite trên cùng DB: **40/40 qua**, không lỗi duplicate.
- `pnpm test:coverage`: **80/80 qua**, 7 test files từ DB sạch; thứ tự thực tế chạy suite operations trước booking nên đã tái hiện điều kiện trước đây khiến demo seed bỏ qua fixture. Coverage: statements/lines 75.03%, branches 75.65%, functions 75.00%. Không có test bị skip do setup.
- `pnpm test:e2e`: **11/11 qua** (Chromium desktop và mobile giả lập), gồm luồng đặt vé và check-in QR.
- `pnpm typecheck`, `pnpm lint`, Prettier check và `docker compose -f compose.test.yaml config --quiet` đều qua. Lint còn 2 cảnh báo unused parameter cũ trong frontend.
- Workflow đã được kiểm tra tĩnh, chưa được chạy từ GitHub; cần push/PR để GitHub Actions xác nhận trực tiếp.

## Cập nhật bộ kiểm thử tự động — 03/11/2026

### Môi trường và lệnh đã chạy

Các bài browser chạy trên stack riêng `compose.test.yaml`: PostgreSQL `starlight_test` trong tmpfs, API `127.0.0.1:4100`, web `127.0.0.1:3100`; không dùng hoặc reset database phát triển. Cấu hình test Compose đã qua `docker compose -f compose.test.yaml config --quiet`.

| Lệnh | Kết quả thực tế |
| --- | --- |
| `pnpm test:coverage` | **80/80** qua, 7 file; statements/lines 75.08%, branches 75.76%, functions 75.00% |
| `pnpm test:e2e` | **11/11** qua trong 46.7 giây: workflow đặt vé + QR, đăng nhập/role quản lý, check-in; Chromium desktop và mobile giả lập |
| `pnpm typecheck` | Qua cho contracts, API và web |
| `pnpm lint` | Exit 0; còn 2 cảnh báo unused parameter trong `step4-checkout.tsx` và `booking-wizard.tsx` |
| `pnpm build` | Qua; Nest API và Next.js production build, có `/manager/accounts` và `/staff/check-in` |
| `docker compose -f compose.test.yaml config --quiet` | Qua |

E2E mới xác minh đăng ký khách, chọn suất tương lai, thanh toán test, QR còn sau reload, đăng nhập sai, trang dashboard quản lý, thao tác check-in bằng mã tay/QR, từ chối vé sai/trùng, camera bị từ chối và chặn khách truy cập màn nhân viên. Màn quản lý chỉ được E2E xác minh đăng nhập và mở dashboard; các phép tính dashboard được xác minh trong test API.

### Kết quả / giới hạn

- API coverage có 80 test qua, gồm kiểm tra tranh chấp ghế, giữ ghế hết hạn, idempotency thanh toán, phân quyền, đổi/hoàn, check-in đồng thời, dashboard và worker/outbox; chi tiết các ca hiện có vẫn ở bảng lịch sử phía trên và `docs/TEST_RESULTS.md`.
- Thêm HTTP integration tests và browser E2E dùng tài khoản/fixture chỉ dành cho test. Helper phát hành session E2E chỉ chấp nhận database `starlight_test`; test stack dùng secret và payment mock riêng, không có đường callback giả trong runtime ứng dụng.
- Chuyển sang màn Smart Check-in sau khi thanh toán giờ làm mới danh sách vé của khách; E2E kiểm tra QR còn sau tải lại trang.
- Workflow GitHub Actions đã được bổ sung cho quality/API coverage và Playwright trên stack cô lập, nhưng chưa chạy trên GitHub từ phiên này.
- Chưa kiểm chứng sandbox/cổng thanh toán thật, email Internet, tải cao/nhiều instance, Firefox/WebKit hoặc triển khai production. Mobile là Playwright Chromium giả lập. Đổi/hoàn được kiểm thử backend; chưa có E2E thao tác nghiệp vụ đổi/hoàn từ giao diện nhân viên trong bộ browser hiện tại.
- Hai cảnh báo lint là tham số không dùng ở frontend và không phát sinh từ test harness; không sửa UI ngoài phạm vi.

Để chạy lại browser suite: `pnpm test:e2e:up`, `pnpm test:e2e`, sau đó `pnpm test:e2e:down`. Các lệnh API/quality ở bảng trên chạy từ root repository.

Ngày thực hiện: **02/11/2026**  
Môi trường kiểm thử: **Node.js v24.14.0 + NestJS 11 + Vitest 3.2.7 + PostgreSQL 17 on Docker (Port 54329)**  
Database kiểm thử: `starlight_test` (cơ sở dữ liệu biệt lập theo đúng tiêu chuẩn an toàn)

---

## 1. Tóm Tắt Kết Quả Kiểm Thử (Executive Summary)

| Test Suite (Tập tin) | Mô tả phạm vi kiểm thử | Số ca kiểm thử | Kết quả | Thời gian chạy |
| :--- | :--- | :---: | :---: | :---: |
| `booking.test.ts` | Giao dịch đặt vé, giữ ghế, timeout, idempotency, race condition | 18 | **18/18 PASS** | 7.04s |
| `check-in.test.ts` | Soát vé QR, xác thực độ tuổi, chặn vé giả/trùng, phạm vi nhân viên | 21 | **21/21 PASS** | 3.46s |
| `operations.test.ts` | Phân quyền 3 vai trò, đổi/hoàn vé, quản lý rạp & suất chiếu, đối soát | 20 | **20/20 PASS** | 4.91s |
| `notification.test.ts` | Tích hợp n8n Cloud Webhook, Outbox, chống trùng, retry, timeout | 12 | **12/12 PASS** | 10.54s |
| **TỔNG CỘNG** | **Toàn bộ hệ thống Backend Starlight Cinema** | **71** | **71/71 PASS (100%)** | **26.32s** |

---

## 2. Đối Chiếu 33 Ca Kiểm Thử Theo Yêu Cầu Master Prompt

### Nhóm 1: Xác Thực & Phân Quyền Vai Trò (Authentication & RBAC)
- **Test 1 - Customer authentication**: Khách hàng đăng ký, đăng nhập nhận JWT accessToken và cookie HttpOnly refreshToken. (**PASS**)
- **Test 2 - Staff authentication**: Nhân viên đăng nhập và được gán phạm vi rạp (`staff_cinema_assignments`). (**PASS**)
- **Test 3 - Manager authentication**: Quản trị viên đăng nhập với đầy đủ quyền quản lý nhân viên và danh mục rạp. (**PASS**)
- **Test 4 - Unauthorized access**: Chặn người dùng chưa xác thực (HTTP 401 Unauthorized) khi truy cập các endpoint nội bộ. (**PASS**)
- **Test 5 - Role privilege restrictions**: Ngăn chặn leo quyền; khách hàng và nhân viên bị từ chối truy cập API quản trị (HTTP 403 Forbidden). (**PASS**)

### Nhóm 2: Quy Trình Đặt Vé (Booking Process)
- **Test 6 - Successful booking**: Đặt vé thành công, khóa ghế và trừ tiền chính xác. (**PASS**)
- **Test 7 - Seat conflict**: Hai khách hàng tranh chấp cùng một ghế trong cùng microsecond: chỉ 1 người thành công, người kia nhận lỗi xung đột (AC01). (**PASS**)
- **Test 8 - Seat reservation expiration**: Phiên giữ ghế 5 phút tự động hết hạn, người khác có thể đặt lại ngay mà không bị giữ ảo (AC03). (**PASS**)
- **Test 9 - Payment failure**: Thanh toán thất bại không phát hành vé và không kéo dài thời gian giữ ghế (AC04). (**PASS**)
- **Test 10 - Duplicate payment callback**: Nhiều webhook MoMo trùng lặp gửi đồng thời chỉ sinh duy nhất 1 vé và 1 bản ghi outbox (AC05). (**PASS**)
- **Test 11 - Ticket issuance**: Cấp vé điện tử với mã băm QR bảo mật, không lộ token nhạy cảm ra ngoài (AC11). (**PASS**)

### Nhóm 3: Quy Trình Đổi & Hoàn Vé (Exchange & Refund)
- **Test 12 - Valid exchange**: Đổi vé ngang giá/chênh lệch được thực hiện nguyên tử, vé cũ chuyển `REPLACED`, vé mới phát hành `ISSUED`. (**PASS**)
- **Test 13 - Rejected exchange**: Từ chối đổi vé nếu đổi sang rạp khác, phim khác hoặc yêu cầu gửi trong vòng 60 phút trước giờ chiếu. (**PASS**)
- **Test 14 - Valid refund request**: Khách hàng tạo yêu cầu hoàn vé đủ điều kiện, vé được khóa tạm thời chờ quản lý duyệt. (**PASS**)
- **Test 15 - Failed refund**: Khi lệnh hoàn tiền từ cổng thanh toán thất bại, hệ thống chuyển sang đối soát (RECONCILIATION_REQUIRED), không tự động hồi sinh vé cũ. (**PASS**)
- **Test 16 - Completed refund**: Quản lý duyệt và tiền được hoàn trả thành công, vé chuyển sang `REFUNDED`, giải phóng ghế. (**PASS**)

### Nhóm 4: Quy Trình Soát Vé (QR Check-In)
- **Test 17 - Valid QR ticket**: Nhân viên quét mã QR hợp lệ trong khung giờ mở cửa (-30 phút đến +15 phút giờ chiếu) được chấp thuận. (**PASS**)
- **Test 18 - Invalid QR ticket**: Quét mã QR giả mạo hoặc không tồn tại bị từ chối với mã `TICKET_NOT_FOUND` (HTTP 404). (**PASS**)
- **Test 19 - Expired ticket / Showtime unavailable**: Từ chối check-in vé quá giờ chiếu hoặc suất chiếu đã hủy (`CHECK_IN_CLOSED`). (**PASS**)
- **Test 20 - Duplicate check-in**: Hai nhân viên cùng quét 1 vé đồng thời: chỉ 1 nhân viên thành công, nhân viên kia nhận thông báo `ALREADY_CHECKED_IN` (HTTP 409). (**PASS**)
- **Test 21 - Refunded or cancelled ticket**: Từ chối check-in vé đã hoàn (`TICKET_REFUNDED`), vé đã đổi (`TICKET_REPLACED`) hoặc vé bị hủy (`TICKET_VOIDED`). (**PASS**)

### Nhóm 5: Tích Hợp n8n Cloud & Automation (n8n Integration)
- **Test 22 - Booking notification event**: Sự kiện `booking.confirmed` được lưu vào outbox với đầy đủ dữ liệu phim, rạp, suất chiếu, ghế và tổng tiền. (**PASS**)
- **Test 23 - Exchange notification event**: Sự kiện `ticket.exchange.completed` được lưu vết vào outbox với danh sách vé cũ và vé mới. (**PASS**)
- **Test 24 - Refund notification event**: Sự kiện `ticket.refund.completed` được lưu vết với số tiền hoàn và lý do. (**PASS**)
- **Test 25 - Check-in event recording**: Sự kiện `ticket.checked_in` được ghi nhận vào audit trail mà không gửi email rác đến khách hàng. (**PASS**)
- **Test 26 - Invalid webhook authentication**: Kiểm tra bảo mật header `X-Webhook-Secret`; từ chối kết nối nếu secret sai (HTTP 401). (**PASS**)
- **Test 27 - Missing customer email**: Xử lý an toàn khi thiếu email khách hàng, không gây crash ứng dụng hay lỗi transaction. (**PASS**)
- **Test 28 - Duplicate event**: Cơ chế chống trùng lặp tại database và n8n ngăn chặn gửi email hai lần cho cùng một `eventId`. (**PASS**)
- **Test 29 - n8n timeout**: Xử lý an toàn khi Webhook n8n phản hồi chậm vượt ngưỡng `N8N_WEBHOOK_TIMEOUT`. (**PASS**)
- **Test 30 - Network failure**: Bắt lỗi đứt kết nối mạng và giữ trạng thái để gửi lại sau. (**PASS**)
- **Test 31 - Retry behavior**: Kiểm tra cơ chế tự động tăng số lần thử (`attempts`) và lùi thời gian thử lại theo hàm mũ (exponential backoff). (**PASS**)
- **Test 32 - Notification status persistence**: Cập nhật trạng thái `SENT` và ghi nhận mốc thời gian `sent_at` khi gửi webhook thành công. (**PASS**)
- **Test 33 - Failed email delivery**: Chuyển trạng thái sang `FAILED` khi vượt quá số lần thử tối đa (`N8N_WEBHOOK_MAX_RETRIES`), lưu lại nguyên nhân lỗi `last_error`. (**PASS**)

---

## 3. Lệnh Tái Hiện Kiểm Thử (Reproduction Instructions)

Để kiểm chứng toàn bộ 71 ca kiểm thử độc lập:
```bash
# 1. Khởi động PostgreSQL và Mailpit trên Docker
docker compose up -d postgres mailpit

# 2. Chạy migration cơ sở dữ liệu
pnpm db:migrate

# 3. Thực thi toàn bộ test suite
pnpm --filter @starlight/api test
```

