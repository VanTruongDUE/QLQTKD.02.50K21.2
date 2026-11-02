# Báo Cáo Kết Quả Kiểm Thử Tích Hợp (Integration Test Report)
# STARLIGHT CINEMA – TP3 EVIDENCE

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

