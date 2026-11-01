# Starlight Cinema Thiết kế triển khai web

Ngày 01/11/2026. Trạng thái: thiết kế để triển khai, chưa có ứng dụng hoặc kết quả chạy kiểm thử.

## 1 Quyền quyết định và mục tiêu

Người dùng giao AI tự nghiên cứu và xây dựng trạng thái nghiệp vụ, thiết kế và quyết định kỹ thuật; ưu tiên sản phẩm web sử dụng được. Không yêu cầu người dùng duyệt từng bảng, API hoặc trạng thái. Giữ ba nghiệp vụ đặt vé, đổi/hoàn và check-in, cùng chính sách DEMO-1.0 tại mục 11 của STARLIGHT_VIBE_CODING_BRIEF.md. Yêu cầu kỹ thuật dưới đây là thiết kế bổ sung, không phải số liệu khảo sát hay chính sách rạp thật.

## 2 Kiến trúc được chọn

| Thành phần | Lựa chọn | Trách nhiệm |
| --- | --- | --- |
| Web | React qua Next.js App Router và TypeScript | Khu khách hàng, quầy, check-in và quản lý |
| UI | shadcn/ui, Tailwind CSS, Lucide | Component nhất quán, responsive, bàn phím và trạng thái lỗi |
| Dữ liệu trên web | TanStack Query | Lấy dữ liệu, mutation, đồng bộ sau thao tác; không quyết định quyền giữ ghế |
| Form | React Hook Form và Zod | Kiểm tra nhập liệu, hiển thị lỗi; API kiểm tra độc lập |
| API | NestJS modular monolith | Rule, quyền, giao dịch và API REST /api/v1 |
| Dữ liệu | PostgreSQL và TypeORM migration | Dữ liệu bền vững, khóa hàng, ràng buộc và lịch sử |
| Xác thực | Passport và JWT | Access token ngắn hạn, refresh token xoay vòng, phiên thu hồi được |
| Môi trường | Docker Compose | web, api, postgres, worker và hộp thư thử nghiệm |
| Kiểm thử | Vitest và Playwright | Logic, tích hợp CSDL và hành trình trình duyệt |

Dùng pnpm workspace: apps/web, apps/api, packages/contracts, docs và infra. Worker dùng chung code backend, chạy tiến trình riêng để gửi thông báo, đối soát và giải phóng giữ ghế. Không thêm microservices hoặc Redis khi chưa cần.

Chọn giao diện tiếng Việt, nền xanh đen, điểm nhấn vàng ấm và poster nổi bật theo bối cảnh rạp phim. Đây là lựa chọn riêng cho Starlight; không tự chuyển thiết kế xanh công nghệ từ dự án marketing sang đây. Luồng đặt vé ưu tiên điện thoại; bàn làm việc nhân viên ưu tiên máy tính.

## 3 Phạm vi sản phẩm và màn hình

| Vai trò | Màn hình | Tác vụ chính |
| --- | --- | --- |
| Khách | Trang chính, danh sách phim, chi tiết phim | Tra lịch, chọn rạp/ngày/suất |
| Khách | Chọn ghế, combo, thanh toán | Chú giải ghế, tổng tiền, countdown, kết quả từ API |
| Khách | Vé của tôi, chi tiết vé | QR, lịch sử, trạng thái, gửi yêu cầu đổi/hoàn |
| Khách | Chọn vé đổi/trả, báo giá, tiến độ | Xem điều kiện, số tiền, xác nhận hoặc rút trước thực thi |
| Nhân viên quầy | Tra cứu đơn/vé, tạo yêu cầu thay khách | Xác minh chủ vé, xem lý do không đủ điều kiện |
| Nhân viên soát vé | Quét QR hoặc nhập mã | Kiểm tra trước, xác nhận cho vào, lịch sử lượt quét |
| Quản lý | Hàng chờ phê duyệt, chi tiết yêu cầu | Duyệt/từ chối có lý do, đối soát khoản tiền chưa rõ |
| Quản lý | Phim, phòng, ghế, suất, giá và combo | Quản lý dữ liệu phục vụ demo; không xóa dữ liệu đã phát sinh vé |
| Quản lý | Tổng quan và sự cố suất chiếu | Số đơn, vé, doanh thu thuần theo giao dịch thành công; xác nhận sự cố |

Tài khoản không quyết định quyền bằng cách chọn vai trò ở giao diện. Mỗi request đọc danh tính và quyền phía API; nhân viên chỉ làm việc trong rạp được phân công. Danh mục phim công khai; mua vé và gửi đổi/hoàn cần đăng nhập. Hệ thống tự tính giá, không tin giá frontend gửi lên.

## 4 Trạng thái và các bất biến

| Đối tượng | Trạng thái | Quy tắc chuyển |
| --- | --- | --- |
| Giữ ghế | ACTIVE, CONSUMED, EXPIRED, RELEASED | ACTIVE chỉ còn hiệu lực trước expires_at; đã kết thúc không hồi sinh |
| Đơn | PENDING_PAYMENT, CONFIRMED, EXPIRED, CANCELLED | Chỉ CONFIRMED sau khi xác minh tiền và chốt được ghế; tiền về muộn lưu ở Payment riêng |
| Thanh toán | CREATED, PENDING, SUCCEEDED, FAILED, UNKNOWN | Timeout sang UNKNOWN; đối soát mới kết luận; sự kiện cũ không ghi đè thành công |
| Vé | ISSUED, REPLACED, REFUNDED, CHECKED_IN, VOIDED | Chỉ ISSUED và không bị khóa nghiệp vụ mới được sử dụng |
| Yêu cầu | PENDING_APPROVAL, APPROVED, PROCESSING, COMPLETED, REJECTED, CANCELLED, EXPIRED, RECONCILIATION_REQUIRED | Đổi không cần duyệt được tạo APPROVED; không cho rút khi đã cam kết hoặc gửi hoàn |
| Khoản hoàn | CREATED, PENDING, SUCCEEDED, FAILED, UNKNOWN | Chỉ SUCCEEDED khi nhận bằng chứng hợp lệ; UNKNOWN không cho tạo khoản trùng |
| Combo | UNREDEEMED, REDEEMED, REFUNDED | Khóa dòng combo khi nhận hàng hoặc hoàn; không được cả hai |

Khóa đổi/hoàn là bản ghi riêng trên vé, không thay toàn bộ vòng đời vé bằng trạng thái yêu cầu. Hiệu lực thời gian, sự cố suất và trạng thái vé phải được kiểm tra cùng lúc; ISSUED không tự nghĩa là được vào bất kỳ thời điểm nào.

Chọn cửa sổ check-in cho demo: từ 30 phút trước giờ bắt đầu đến 15 phút sau giờ bắt đầu, bao gồm hai mốc. Đây là cấu hình mô hình, không khẳng định chính sách rạp thật. Nhân viên kiểm tra điều kiện độ tuổi theo phân loại phim trước khi bấm xác nhận; không tự kết luận tuổi chỉ từ thông tin tài khoản. Kiểm tra QR trước không ghi CHECKED_IN; nút xác nhận mới thực hiện cập nhật có khóa để chống hai cửa quét đồng thời.

## 5 CSDL logic và giao dịch

| Nhóm | Bảng và quan hệ chính |
| --- | --- |
| Danh tính | users, roles, user_roles, refresh_sessions, staff_cinema_assignments |
| Danh mục | movies, cinemas, auditoriums(cinema_id), seats(auditorium_id), showtimes(movie_id, auditorium_id), showtime_prices |
| Ghế theo suất | showtime_seats(showtime_id, seat_id, hold_id nullable, ticket_id nullable), holds(owner_id, expires_at) |
| Mua vé | bookings(owner_id), booking_items(booking_id, showtime_id, seat_id, amount_vnd), tickets(item_id, predecessor_ticket_id nullable, status, value_vnd) |
| Combo | products, order_product_items(booking_id, product_id, quantity, unit_price_vnd, status) |
| Tiền | payments(booking_id, provider_reference), payment_allocations(payment_id, ticket_id hoặc order_product_item_id, amount_vnd), refunds(payment_id, request_id), refund_allocations |
| Đổi/hoàn | change_requests(owner_id, created_by, approved_by nullable, kind, policy_version), change_request_items(request_id, old_ticket_id, new_ticket_id nullable), ticket_operation_locks(ticket_id, request_id) |
| Dấu vết | check_ins(ticket_id, staff_id), audit_logs, provider_events, idempotency_records, outbox_events, notifications |

UUID làm khóa chính; tiền số nguyên VND không âm; thời gian timestamptz, lưu UTC và hiển thị Asia/Ho_Chi_Minh. Snapshot tên, giá và policy trên giao dịch. Danh mục đã có giao dịch chỉ được ngừng sử dụng; không cascade xóa vé hoặc giao dịch tiền.

- Unique(showtime_id, seat_id) ở showtime_seats; unique(auditorium_id, seat_label) ở seats. Ghế phải thuộc đúng phòng của suất qua khóa ghép hoặc ràng buộc được migration kiểm chứng.
- Khóa các hàng showtime_seats có sẵn theo thứ tự cố định trong transaction. Kiểm tra và thay giữ ghế hết hạn ngay dưới khóa; job dọn dẹp không phải nguồn duy nhất quyết định khả dụng.
- Một check_ins thành công cho mỗi ticket_id. Unique provider event/reference trong phạm vi nhà cung cấp; một khóa nghiệp vụ đang hoạt động cho mỗi vé.
- Chống lịch chiếu trùng phòng bằng khoảng thời gian và exclusion constraint trên PostgreSQL; demo dành 15 phút dọn phòng sau thời lượng phim, là giả định cấu hình. Không cho đổi phòng/giờ của suất đã bán bằng thao tác CRUD thông thường; đi qua xử lý sự cố.
- Giao dịch đổi khóa vé cũ, request và ghế mới; xác minh phiên bản báo giá, thời hạn và quyền. Commit thay vé, chuyển phân bổ, ghi nghĩa vụ hoàn và outbox cùng transaction.
- Hoàn tiền khóa số dư khoản thu và các phân bổ liên quan; đã hoàn cộng đang chờ không vượt tiền đã nhận. Không giữ transaction CSDL trong lúc gọi dịch vụ ngoài.
- Mọi thao tác có side effect nhận idempotency key theo user và operation; cùng key khác payload bị từ chối. Lưu kết quả để trả lại khi retry.

## 6 API và hợp đồng hành vi

| API | Quyền và kết quả |
| --- | --- |
| GET /movies, /showtimes, /showtimes/:id/seats | Công khai; dữ liệu chọn ghế là ảnh chụp hiện tại |
| POST /auth/register, /auth/login, /auth/refresh, /auth/logout | Chống dò mật khẩu; mật khẩu băm; refresh token chỉ lưu hash phía server |
| POST /holds | Khách; all-or-nothing, trả expiresAt và serverTime |
| POST /bookings | Khách; giữ ghế phải thuộc khách, snapshot báo giá |
| POST /bookings/:id/payments | Chủ đơn; không tạo thu mới khi khoản trước chưa rõ |
| GET /me/tickets, /tickets/:id | Chủ vé hoặc nhân viên được phân quyền; không lộ vé khác qua đổi id |
| POST /change-quotes | Báo giá chỉ đọc, có phiên bản; chưa khóa vé |
| POST /change-requests | Khách hoặc quầy; kiểm tra rule, khóa đúng vé được chọn |
| POST /change-requests/:id/approve hoặc /reject | Quản lý; không tự duyệt yêu cầu do mình lập |
| POST /change-requests/:id/execute hoặc /cancel | Theo vai trò và trạng thái; kiểm tra lại trước commit |
| POST /check-in/inspect | Nhân viên soát vé; không ghi nhận vào phòng |
| POST /check-in/confirm | Nhân viên soát vé; khóa vé và ghi một lượt thành công |
| POST /webhooks/payments/:provider | Xác thực theo hợp đồng nhà cung cấp, deduplicate; không tin browser redirect |
| /admin/movies, /auditoriums, /showtimes, /products | Quản lý; validation riêng và audit |

Lỗi có code ổn định: SEAT_UNAVAILABLE, HOLD_EXPIRED, TICKET_NOT_ELIGIBLE, REQUEST_CONFLICT, APPROVAL_REQUIRED, PAYMENT_UNCERTAIN. Trả thông điệp tiếng Việt phù hợp, không trả stack trace. 401 chưa đăng nhập, 403 thiếu quyền, 404 ngoài phạm vi truy cập để tránh lộ dữ liệu, 409 xung đột trạng thái, 422 dữ liệu không hợp lệ.

## 7 Tích hợp và môi trường demo

Thanh toán chạy qua adapter có môi trường giả lập kiểm soát được: thành công, thất bại, timeout và callback trùng/muộn. Gắn nhãn thanh toán thử nghiệm rõ ràng; giả lập không được tính là bằng chứng tích hợp cổng tiền thật. Chọn cổng sandbox cụ thể khi môi trường lập trình cho phép và có tài khoản thử nghiệm; không chặn việc xây luồng nghiệp vụ.

Email gửi qua SMTP adapter, local dùng Mailpit. n8n nhận sự kiện booking.confirmed/change.completed qua webhook có secret để gửi thông báo trong môi trường TP2; nếu dịch vụ tạm lỗi, outbox retry và hiển thị vé trong tài khoản vẫn hoạt động. Khi chưa có SMTP/n8n hoạt động chỉ ghi chưa cấu hình; không hiển thị giả đã gửi thành công. Không để n8n trực tiếp quyết định quyền sở hữu ghế hoặc phát hành vé.

JWT access token lưu trong bộ nhớ; refresh token trong cookie HttpOnly, Secure ở production, SameSite phù hợp và kiểm tra Origin/CSRF cho endpoint dùng cookie. CORS theo allowlist. QR chứa token ngẫu nhiên khó đoán; server lưu hash và tra vé, không nhúng thông tin cá nhân. Giới hạn tốc độ endpoint tra cứu, không có chế độ check-in offline mặc định.

## 8 Các lát cắt triển khai và nghiệm thu

| Thứ tự | Sản phẩm kiểm tra được | Điều kiện hoàn thành |
| --- | --- | --- |
| 1 | Nền dự án, CSDL, đăng nhập, dữ liệu demo | Khởi động theo README; role đúng; migration trên database mới |
| 2 | Phim → suất → ghế → thanh toán thử → vé QR | Giữ ghế chống trùng, hết hạn đúng, dữ liệu còn sau restart |
| 3 | Quét/nhập QR → xác nhận check-in | Sai suất, trùng vé, ngoài cửa sổ, thiếu quyền đều bị chặn |
| 4 | Gửi đổi/hoàn → quản lý duyệt → kết quả | Ba dấu chênh lệch, hoàn chưa rõ và yêu cầu xung đột được xử lý |
| 5 | Quản lý dữ liệu, email/n8n, dashboard | CRUD an toàn, audit, retry thông báo và tích hợp có bằng chứng |
| 6 | Hoàn thiện UI và bàn giao | Responsive, lỗi/loading/empty rõ; chạy toàn bộ test và demo xuyên suốt |

Dữ liệu demo dùng suất tương đối theo ngày seed và được ghi là giả lập; không dùng lịch cố định đã quá hạn. Bộ tài khoản demo chỉ tạo ở môi trường development. Có kịch bản kiểm chứng hai khách giữ cùng ghế, hai cửa quét cùng vé và callback lặp; dùng PostgreSQL thật cho test tích hợp, không thay bằng SQLite.

Đầu ra triển khai: source code, migrations, seed, compose, .env.example không chứa bí mật, README, AI Log ghi thực tế, kết quả test và hướng dẫn demo. Ghi nhận commit theo thay đổi thật, không tạo lịch sử giả. Thiết kế này đủ làm nền để viết code; không chứng nhận phần mềm đã chạy.

## 9 Tài liệu kỹ thuật đã đối chiếu

Kiến thức bổ sung, tra cứu ngày 01/11/2026:

- Next.js App Router: https://nextjs.org/docs/app/getting-started — tổ chức trang/layout.
- PostgreSQL explicit locking: https://www.postgresql.org/docs/17/explicit-locking.html — căn cứ chọn khóa hàng; vẫn cần ràng buộc và test đồng thời của ứng dụng.
- NestJS authorization: https://docs.nestjs.com/v11/security/authorization — kiểm soát quyền ở API.

Các tài liệu cung cấp cơ chế, không xác định chính sách nghiệp vụ Starlight. Khi khởi tạo phải chọn phiên bản tương thích, ghi lockfile và đối chiếu API đúng phiên bản đã cài.
