# Hướng Dẫn Tích Hợp n8n Cloud & Gmail SMTP – Starlight Cinema

Tài liệu này hướng dẫn chi tiết quy trình kết nối Backend NestJS của Starlight Cinema với n8n Cloud để tự động hóa gửi email thông báo đặt vé, đổi vé, hoàn tiền và ghi nhận check-in qua Gmail SMTP.

---

## 1. Kiến Trúc Tích Hợp

```
[Starlight Backend NestJS]
         │ (Transaction Commit)
         ▼
[PostgreSQL: notification_outbox]
         │ (Worker / Dispatcher with Retries)
         ▼  (HTTPS POST + X-Webhook-Secret)
[n8n Cloud Webhook Trigger]
         │ (Header Authentication)
         ▼
[Validate & Check Idempotency] ── (Trùng eventId) ──► [200 Duplicate Ignored]
         │ (Hợp lệ)
         ▼
[Route Event Type (Switch)]
 ├── booking.confirmed       ──► [Template Đặt vé]   ──► [Gmail SMTP] ──► [200 Success / 502 Fail]
 ├── ticket.exchange.completed ─► [Template Đổi vé]  ──► [Gmail SMTP] ──► [200 Success / 502 Fail]
 ├── ticket.refund.completed ──► [Template Hoàn tiền] ─► [Gmail SMTP] ──► [200 Success / 502 Fail]
 └── ticket.checked_in       ──► [Acknowledge Audit] ───────────────► [200 Check-in Ack]
```

---

## 2. Các Bước Cài Đặt Trên n8n Cloud

### Bước 1: Import Workflow JSON
1. Đăng nhập vào tài khoản [n8n Cloud](https://app.n8n.cloud/).
2. Trong menu bên trái, chọn **Workflows** -> Nhấn nút **Add workflow** (hoặc icon `...` ở góc trên bên phải).
3. Chọn **Import from File...** và tải lên file:
   `docs/integrations/n8n-starlight-cinema.json`

### Bước 2: Cấu hình Header Authentication Credential
1. Nhấp đúp vào node **Webhook Trigger**.
2. Tại mục **Authentication**, chọn **Header Auth**.
3. Tại ô **Credential for Header Auth**, chọn **Create New Credential**:
   - **Name**: `Starlight Header Auth`
   - **Name (Header Name)**: `X-Webhook-Secret`
   - **Value (Secret Value)**: Nhập chuỗi secret bảo mật (trùng với biến `N8N_WEBHOOK_SECRET` trong file `.env` của Backend, ví dụ: một chuỗi ngẫu nhiên từ 32 ký tự trở lên).
4. Nhấn **Save**.

### Bước 3: Chọn Gmail SMTP Credential
1. Nhấp đúp vào node **Send Email via Gmail SMTP**.
2. Tại mục **Credential for SMTP**, nhấp vào danh sách chọn và chọn credential **"SMTP account"** đã được cấu hình và kiểm tra thành công trước đó trên workspace n8n Cloud của bạn.
3. Không cần sửa ID credential; n8n sẽ tự động liên kết với credential có sẵn.

### Bước 4: Lấy Webhook URL và Cấu hình Backend
1. Trên node **Webhook Trigger**, chuyển tab sang **Test URL** (khi chạy thử) hoặc **Production URL** (khi chính thức).
   - Đường dẫn có dạng: `https://<ten-workspace>.app.n8n.cloud/webhook-test/starlight-cinema-webhook` (Test)
   - Hoặc: `https://<ten-workspace>.app.n8n.cloud/webhook/starlight-cinema-webhook` (Production)
2. Mở file `.env` trên máy chủ Backend của bạn và cập nhật:
   ```env
   N8N_WEBHOOK_URL=https://<ten-workspace>.app.n8n.cloud/webhook-test/starlight-cinema-webhook
   N8N_WEBHOOK_SECRET=<chuoi-secret-da-dat-o-buoc-2>
   N8N_WEBHOOK_TIMEOUT=10000
   N8N_WEBHOOK_MAX_RETRIES=3
   ```

---

## 3. Các Luồng Nghiệp Vụ & Payload Chuẩn

### 3.1. Luồng Đặt Vé Thành Công (`booking.confirmed`)
- **Điều kiện kích hoạt**: Chỉ sau khi thanh toán được xác minh thành công (`payments.status = 'SUCCEEDED'`), ghế được chốt, vé điện tử được cấp và transaction cơ sở dữ liệu đã commit.
- **Payload mẫu**:
```json
{
  "eventId": "evt_booking_123456",
  "eventType": "booking.confirmed",
  "schemaVersion": 1,
  "occurredAt": "2026-11-02T15:30:00.000Z",
  "recipientEmail": "khachhang@example.com",
  "booking": {
    "id": "b0a1c2d3-e4f5-6789-abcd-ef0123456789",
    "total": 170000,
    "createdAt": "2026-11-02T15:28:00.000Z"
  },
  "customer": {
    "id": "u1a2b3c4-...",
    "email": "khachhang@example.com",
    "name": "Nguyễn Văn A"
  },
  "movie": {
    "title": "Chuyến tàu bình minh",
    "rating": "T13"
  },
  "showtime": {
    "startsAt": "2026-11-03T19:30:00.000Z",
    "room": "Phòng 1",
    "cinema": "Starlight Cinema Đà Nẵng"
  },
  "seats": ["A1", "A2"]
}
```

### 3.2. Luồng Đổi Vé (`ticket.exchange.completed`)
- **Điều kiện kích hoạt**: Sau khi nhân viên quầy kiểm tra tính hợp lệ (>60 phút trước giờ chiếu), duyệt đổi ghế, thanh toán chênh lệch (nếu có) thành công và vé mới được phát hành.
- **Payload mẫu**:
```json
{
  "eventId": "evt_exchange_789012",
  "eventType": "ticket.exchange.completed",
  "schemaVersion": 1,
  "occurredAt": "2026-11-02T16:00:00.000Z",
  "recipientEmail": "khachhang@example.com",
  "exchange": {
    "requestId": "req_exc_9999",
    "oldTickets": [{"id": "t1"}],
    "newTickets": [{"id": "t2", "seatLabel": "B3"}],
    "payable": 0,
    "refundable": 0
  }
}
```

### 3.3. Luồng Hoàn Tiền (`ticket.refund.completed`)
- **Điều kiện kích hoạt**: Sau khi yêu cầu hoàn vé được quản lý phê duyệt và lệnh hoàn tiền được xác nhận thành công từ nhà cung cấp/kế toán.
- **Payload mẫu**:
```json
{
  "eventId": "evt_refund_345678",
  "eventType": "ticket.refund.completed",
  "schemaVersion": 1,
  "occurredAt": "2026-11-02T16:30:00.000Z",
  "recipientEmail": "khachhang@example.com",
  "refund": {
    "requestId": "req_ref_8888",
    "amount": 85000,
    "tickets": [{"id": "t1"}],
    "reason": "Khách yêu cầu hủy vé đúng hạn quy định"
  }
}
```

### 3.4. Luồng Check-In Vé (`ticket.checked_in`)
- **Điều kiện kích hoạt**: Nhân viên soát vé quét mã QR hoặc nhập mã vé tại cửa vào suất chiếu hợp lệ.
- **Xử lý**: Workflow xác nhận ghi nhận sự kiện vào audit trail. **Không gửi email rác đến khách hàng**.
- **Payload mẫu**:
```json
{
  "eventId": "evt_checkin_567890",
  "eventType": "ticket.checked_in",
  "schemaVersion": 1,
  "occurredAt": "2026-11-02T19:15:00.000Z",
  "checkIn": {
    "ticketId": "t1_uuid",
    "staffId": "staff_uuid",
    "checkedInAt": "2026-11-02T19:15:00.000Z",
    "seatLabel": "A1",
    "movieTitle": "Chuyến tàu bình minh"
  }
}
```

---

## 4. Cơ Chế Chống Trùng Lặp (Idempotency) & Tin Cậy (Reliability)

1. **Transactional Outbox tại Backend**:
   - Mọi sự kiện được ghi vào bảng `notification_outbox` trong cùng transaction với nghiệp vụ chính.
   - Thất bại gửi email hoặc n8n bảo trì **không bao giờ rollback đơn hàng hay giao dịch thanh toán**.
2. **Idempotency tại n8n Cloud**:
   - Sử dụng static data (`$getWorkflowStaticData('global')`) để lưu vết các `eventId` đã nhận trong vòng 7 ngày.
   - Nếu n8n nhận lại một `eventId` do retry mạng, workflow sẽ trả về ngay HTTP 200 `DUPLICATE_IGNORED` và **không gửi email lần thứ hai**.
3. **Retry & Backoff**:
   - Node gửi email SMTP được cấu hình `retryOnFail: true`, tối đa 3 lần thử lại, cách nhau 5 giây.
   - Nếu thất bại toàn bộ, workflow trả về HTTP 502 `EMAIL_DELIVERY_FAILED` để Backend lưu lại lỗi và thử lại với exponential backoff.

---

## 5. Quy Trình Kiểm Thử An Toàn (Testing & Activation)

> [!IMPORTANT]
> **Chưa kích hoạt workflow sang trạng thái ACTIVE (Production)** cho đến khi hoàn thành các bước kiểm tra sau:

1. **Kiểm tra với Test URL**:
   - Nhấn nút **"Test step"** hoặc **"Listen for test event"** trên node Webhook Trigger trong n8n.
   - Chạy lệnh kiểm thử từ máy phát triển gửi một payload `booking.confirmed`.
   - Kiểm tra hộp thư Gmail nhận thông báo xem định dạng, font chữ và hình ảnh hiển thị chuẩn xác.
2. **Kích hoạt chính thức**:
   - Sau khi email test đạt yêu cầu, bật công tắc **Inactive -> Active** ở góc trên bên phải giao diện n8n workflow.
   - Chuyển `N8N_WEBHOOK_URL` trong `.env` Backend từ `webhook-test` sang `webhook`.
