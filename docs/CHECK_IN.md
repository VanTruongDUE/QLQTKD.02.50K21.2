# Check-in nhân viên — 02/11/2026

> Tài liệu lịch sử của lượt triển khai check-in trước. Backend mới đã chuyển GATE/COUNTER thành STAFF, bỏ seed/login demo runtime và cách ly dữ liệu cũ. Dùng [BACKEND_API.md](BACKEND_API.md) cho API, lệnh chạy và cấu hình hiện tại; các bước demo dưới đây không còn là hướng dẫn vận hành.

## Chạy và demo

```powershell
docker compose --profile full up -d --build
docker compose exec api pnpm --filter @starlight/api db:seed:check-in
```

API tự chạy migration lúc khởi động. Khi chạy Node trực tiếp, dùng `pnpm db:migrate` rồi `pnpm --filter @starlight/api db:seed:check-in`. Các lệnh dùng cấu hình development hiện có; seed bị chặn ở production.

Màn hình: http://localhost:3000/staff/check-in. Tài khoản `soatve@starlight.demo` hoặc `soatve2@starlight.demo`, mật khẩu mặc định `StarlightDemo2026!` (DEMO_PASSWORD lúc tạo tài khoản; seed không đổi mật khẩu cũ). Chỉ role GATE trong rạp được phân công được gọi API. Khách, nhân viên quầy và quản lý bị từ chối; ẩn nút không thay thế phân quyền backend.

Mỗi lần seed in JSON chứa `shows` và `tickets`. Chọn đúng tên phòng duy nhất của lần seed, `Soát vé demo <suffix> / 1`. Phim bắt đầu sau 10 phút; cửa sổ hiện tại còn khoảng 25 phút để thử. Seed lần nữa khi đã hết hạn; không chỉnh đồng hồ hay tái sử dụng vé đã check-in.

| Khóa trong tickets | Kết quả khi kiểm tra ở suất / 1                                                         |
| ------------------ | --------------------------------------------------------------------------------------- |
| valid, valid2      | Đủ điều kiện; phải xác minh tuổi và xác nhận mới ghi vào phòng                          |
| camera             | Vé hợp lệ để quét camera                                                                |
| wrongShow          | Sai suất (vé thuộc suất / 2)                                                            |
| refunded           | Đã hoàn tiền                                                                            |
| replaced           | Đã đổi, phải dùng vé mới                                                                |
| voided             | Đã hủy                                                                                  |
| checkedIn          | Đã check-in                                                                             |
| locked             | Đang có yêu cầu đổi/hoàn                                                                |
| cancelledBooking   | Đơn không còn hợp lệ                                                                    |
| concurrent         | Mở hai phiên nhân viên riêng, kiểm tra cùng mã rồi cùng xác nhận: chỉ một lượt được ghi |
| tooEarly           | Chọn suất / 3 tương ứng: chưa đến giờ nhận khách                                        |

Nhập `tickets.<khóa>.id` đầy đủ (UUID 36 ký tự), không dùng 8 ký tự đầu. UUID hợp lệ nhưng không tồn tại trả lý do không tìm thấy; mã sai định dạng được báo ngay ở form. Để quét, đăng nhập `checkin@starlight.demo` ở cửa sổ riêng, mở **Vé của tôi**, tìm QR theo mã vé vừa in. Bật camera, đưa QR trước ống kính. Sau khi giải mã, camera dừng; nhân viên kiểm tra phim/phòng/ghế/giờ và độ tuổi rồi xác nhận. Lịch sử hiển thị thời gian, mã vé và email nhân viên; tự cập nhật mỗi 5 giây.

Dữ liệu demo phát hành vé qua luồng giữ ghế/đơn/thanh toán giả lập hiện có, rồi **mô phỏng** trạng thái hủy/hoàn/đổi và khóa chờ cho từng ca. Đây không phải bằng chứng đã thực hiện giao dịch hoàn hay quy trình đổi vé. Seed chỉ thêm phòng/suất/đơn/vé mới, không xóa hoặc hồi sinh dữ liệu cũ; email demo đi vào Mailpit.

## API và tính nguyên tử

Tất cả endpoint dưới `/api/v1/check-in`, cần Bearer access token GATE và phân công rạp:

| Endpoint                     | Dữ liệu                                                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GET /showtimes               | Suất của rạp được phân công từ một ngày trước đến bảy ngày sau, kèm cửa sổ nhận khách                                             |
| GET /history?showtimeId=UUID | 50 lượt thành công gần nhất của suất được phân công                                                                               |
| POST /inspect                | `{ "showtimeId": "UUID", "ticketCode": "UUID" }` hoặc `{ "showtimeId": "UUID", "token": "nội dung QR" }`; đúng một cách nhận diện |
| POST /confirm                | Cùng dữ liệu trên, thêm `"ageVerified": true` và header `Idempotency-Key` là UUID mới cho thao tác                                |

Inspect không cập nhật vé. Confirm kiểm tra lại mọi điều kiện trong transaction, khóa hàng booking/showtime/ticket (`FOR UPDATE`), kiểm tra đồng hồ PostgreSQL sau khi lấy khóa, cập nhật có điều kiện `ISSUED → CHECKED_IN`, chèn `check_ins` và `audit_logs` trước commit. Khóa chính `check_ins.ticket_id` cũng ngăn hai bản ghi cho cùng vé. `check_ins.created_at` và `staff_id` lưu thời điểm và nhân viên.

Hai thao tác độc lập cùng vé (kể cả hai nhân viên khác nhau) chỉ có một lượt thành công; lượt còn lại nhận `ALREADY_CHECKED_IN`. Gửi lại **cùng key, cùng nhân viên, cùng payload** trả biên nhận cũ để phục hồi khi mất phản hồi mạng, không tạo lượt mới. Gửi lại key với payload khác bị từ chối. Giao diện giữ key khi lỗi mạng; sau lỗi nghiệp vụ phải kiểm tra vé lại.

Migration `CheckInLocks1793581200000` thêm `ticket_operation_locks` (mỗi vé tối đa một yêu cầu đang hoạt động) và index lịch sử. Phần đổi/hoàn chưa triển khai: khi bổ sung phải khóa cùng hàng vé trước khi tạo/gỡ khóa nghiệp vụ hoặc thay đổi hiệu lực, và xử lý theo thứ tự khóa nhất quán. Hiện tại đã kiểm thử từ chối vé có khóa; chưa tuyên bố kiểm thử cạnh tranh với một quy trình đổi/hoàn hoàn chỉnh.

## Lý do từ chối

| Mã                                                | Ý nghĩa                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| FORBIDDEN_ROLE                                    | Sai vai trò (403); chưa đăng nhập là 401                                   |
| SHOWTIME_NOT_FOUND                                | Suất không tồn tại trong phạm vi rạp (404)                                 |
| TICKET_NOT_FOUND                                  | QR/mã vé không tồn tại trong phạm vi rạp (404)                             |
| WRONG_SHOWTIME                                    | Vé thuộc suất khác                                                         |
| TICKET_VOIDED / TICKET_REFUNDED / TICKET_REPLACED | Vé đã hủy / hoàn / đổi                                                     |
| TICKET_NOT_VALID                                  | Vé chưa phát hành hợp lệ hoặc đơn không còn CONFIRMED                      |
| ALREADY_CHECKED_IN                                | Đã ghi nhận vào phòng                                                      |
| TICKET_OPERATION_PENDING                          | Có khóa yêu cầu đổi/hoàn đang hoạt động                                    |
| SHOWTIME_UNAVAILABLE                              | Suất đã hủy/thay đổi                                                       |
| CHECK_IN_TOO_EARLY / CHECK_IN_CLOSED              | Ngoài khoảng từ trước 30 phút đến sau 15 phút; hai mốc biên được chấp nhận |

Lỗi nghiệp vụ trên mặc định 409; payload sai hoặc chưa xác nhận tuổi là 422. Không trả QR token/hash hay thông tin của vé ngoài rạp được phân công. Endpoint dùng giới hạn tốc độ và xác thực sẵn có.

## Camera và kiểm chứng

Decoder dùng [ZXing Browser](https://github.com/zxing-js/browser), tải khi bật camera. Trình duyệt cần cho phép camera và secure context: HTTPS hoặc localhost ([MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)). Khi có nhiều camera có thể chọn thiết bị; khi bị từ chối quyền, không tìm thấy hoặc camera bận, màn hình báo lỗi và vẫn cho nhập mã. Đổi suất, dừng hoặc rời màn hình sẽ giải phóng stream; không gửi hình ảnh camera lên backend.

Playwright giải mã QR vé thật từ canvas video stream giả lập trên Chromium desktop/mobile, kiểm tra dừng stream và xác nhận thủ công; có ca từ chối quyền và đổi suất. Backend kiểm thử bằng PostgreSQL thật. Xem [kết quả chạy](TEST_RESULTS.md). Chưa thử camera vật lý, Safari/iOS thật, camera sau/chuyển thiết bị trên phần cứng thật hay điều kiện ánh sáng thực tế. Muốn mở từ điện thoại cần cấu hình mạng/HTTPS riêng; cấu hình Docker hiện tại chỉ bind localhost.
