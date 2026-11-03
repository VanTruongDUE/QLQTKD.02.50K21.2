# AI Log — 01/11/2026

## Backend ba vai trò — yêu cầu đính kèm ngày 02/11/2026

- Đọc prompt đính kèm, git status (sạch lúc bắt đầu), brief/design, schema, auth, booking, worker, check-in và frontend thực tế. Phát hiện frontend đã đổi sang trang dùng mock-data/useState; giữ nguyên toàn bộ apps/web. Không dùng sub-agent, không commit/push/merge/deploy.
- Kiểm tra Node 24.14.0, pnpm 10.32.1, Git 2.52.0.windows.1. Docker CLI có nhưng Engine dừng. Đường dẫn Docker mặc định không tồn tại; tìm được cài đặt trong AppData/Local/Programs/DockerDesktop, khởi động ẩn và kiểm chứng Engine 29.9.2. Chỉ chạy PostgreSQL/Mailpit để test.
- Thêm Operations migration: ba role, khóa/session/profile, phạm vi dữ liệu, bảng yêu cầu/hoàn/phân bổ tiền/nhận combo/audit. Giữ dữ liệu cũ, đánh dấu provenance; khóa tài khoản demo cũ. Thêm ProviderEvents và CatalogProvenance, giữ nguyên tiền/trạng thái/policy lịch sử, cách ly danh mục giả khỏi public và giữ ghế.
- Bổ sung API hồ sơ, nhân viên/phân công, CRUD danh mục có ràng buộc, tra cứu đơn/vé, combo, audit/reports và bảng quyền. Manager không mặc định có quyền STAFF. CLI bootstrap quản lý dùng cấu hình người vận hành, không mật khẩu mặc định hoặc endpoint tạo manager.
- Xóa route simulate và webhook demo, chuyển seed vào test-only fixtures, bỏ seed scripts/cấu hình demo. PaymentGateway mặc định fail 503; không tự tạo tiền thật. Giữ core thanh toán để adapter đã xác minh gọi; TestGateway chỉ trong test. SMTP bỏ nội dung/thông tin gửi demo, hỗ trợ cấu hình auth/TLS và không gửi legacy outbox.
- Thực hiện báo giá/yêu cầu/duyệt/rút/thực thi đổi-hoàn: ba dấu chênh lệch, deadline kiểm tra lại sau khóa, khóa vé/combo, phân bổ nhiều khoản thu, callback idempotent, late payment đối soát, UNKNOWN không tự mở khóa, hoàn một phần giữ khóa. Check-in khóa booking trước vé/suất, lưu audit từ chối có scope và không log QR.
- Chạy test theo phần. 52 ca đầu qua; bổ sung nâng cấp schema cũ/CLI/tiền đến muộn/hoàn một phần. Có lượt bị ECONNREFUSED vì Docker Engine dừng, không coi ca bị skip là đã qua; khởi động lại rồi 57 ca qua. Thêm kiểm tra catalog legacy và gateway chưa cấu hình; kết quả cuối ở TEST_RESULTS.md.
- Sửa test cũ vốn gọi simulate/HMAC demo để kiểm tra route đã bị gỡ; kiểm tra timeout bằng fixture cô lập. Sửa kiểm tra chủ đơn trước lỗi thiếu payment adapter. Typecheck API/contracts/web, build backend và lint đã chạy; Git diff apps/web trống. Lệnh format qua PowerShell shim gộp mảng sai, đã chuyển sang execFileSync với argv tách rời và format đúng các file đã sửa.
- Không áp dụng migration lên DB chính hoặc tạo quản lý bằng thông tin tự bịa. Chưa có adapter nhà cung cấp, SMTP Internet, nhánh sự cố suất đã bán, job đối soát tự động hoặc retry khoản hoàn thất bại sau cam kết; tài liệu nêu rõ thay vì tuyên bố production-ready.

## Bổ sung ngày 02/11/2026 — check-in nhân viên

- Yêu cầu thực tế: tiếp tục dự án, đọc hai tài liệu trong docs và mã nguồn trước khi sửa; hoàn thiện check-in, camera, mã nhập tay, kiểm tra trạng thái/suất, chống trùng, nhật ký và demo/test. Đã giữ nguyên luồng thanh toán/giữ ghế và dùng Next/Nest/TypeORM/contracts/Playwright theo vai trò sẵn có.
- Tách CheckInModule khỏi controller cinema cũ; bắt buộc selected showtime và đúng một QR token/mã vé UUID; GATE và phân công rạp được kiểm tra ở backend. Có cửa sổ -30/+15 phút, xác minh tuổi, lý do lỗi riêng, lịch sử thời điểm/nhân viên. Không tạo quyền quản lý vượt quyền soát vé.
- Confirm khóa booking/showtime/ticket, kiểm tra lại trạng thái và thời gian bằng đồng hồ PostgreSQL, cập nhật có điều kiện, insert check_ins/audit trong cùng transaction. Cùng idempotency key trả biên nhận cũ, hai thao tác khác nhau chỉ một lượt mới. Bổ sung migration khóa nghiệp vụ để chặn vé đang chờ đổi/hoàn; chưa xây workflow đổi/hoàn.
- Thêm route `/staff/check-in`, camera ZXing tải động, quản lý dừng stream, chọn thiết bị và fallback nhập mã; QR không tự xác nhận. Giữ palette/layout dự án với skill design-taste-frontend. Xem ảnh desktop/tablet/mobile; bổ sung thông tin phòng/phim bên ngoài select để đọc được trên màn hình hẹp. Inspector chỉ đo trạng thái chưa đăng nhập (0 FAIL/2 WARN vùng trống); ảnh xác thực từ Playwright.
- Seed mới gọi booking/payment demo hiện có để phát hành 12 vé mỗi lần, sau đó mô phỏng các trạng thái lỗi; thêm khách checkin và nhân viên thứ hai. Không xóa dữ liệu cũ, không phục hồi vé đã dùng. README và CHECK_IN.md ghi lệnh seed và phạm vi mô phỏng.
- Kiểm thử backend 39/39 qua; build/typecheck/lint qua. Browser ban đầu lỗi strict locator do Next route announcer, đã giới hạn selector vào main. Các lần chạy sát nhau chạm rate limit; đã tái sử dụng phiên khách trong setup, không thay guard. Bài booking chọn suất đầu tiên hết ghế do test trước, sửa để chọn phòng đặt vé demo gốc. Kết quả cuối 10/10 browser qua trên Docker mới (17,5 giây).
- QR thật được decoder đọc từ video canvas giả lập, kiểm tra tắt stream và bước xác nhận thủ công. Không tuyên bố đã thử camera vật lý, Safari/iOS thật hoặc đã hoàn thiện quy trình đổi/hoàn. Đã cập nhật TEST_RESULTS với giới hạn cụ thể. Không dùng sub-agent, không tạo lịch sử tương tác giả.
- Khi thử lệnh demo cuối trong container, `pnpm db:seed:check-in` không tìm thấy vì thư mục làm việc là workspace root; đã sửa tài liệu dùng `pnpm --filter @starlight/api db:seed:check-in` và chạy lại.

## Nhật ký triển khai ban đầu — 01/11/2026

Đây là nhật ký công việc thực tế trong một yêu cầu triển khai. Không tách thành 10 tương tác người dùng giả hoặc tạo thất bại/commit để đủ rubric.

| Bước                 | Hành động và quyết định                                                                      | Kết quả thực tế / sửa lỗi                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khảo sát             | Kiểm tra Node, npm, pnpm, Git, Docker CLI, Compose và Engine                                 | Công cụ có đủ; Engine chưa chạy. Mở Docker Desktop bằng tiến trình ẩn, `docker info` sau đó trả 29.9.2                                                                                      |
| Đọc nguồn            | Tìm hai file tại docs theo yêu cầu                                                           | Đọc thất bại vì file nằm ở root. Đã tìm bằng rg, đọc nguồn và giữ nguyên; sao chép vào docs                                                                                                 |
| Thiết kế lát cắt     | Theo DEMO-1.0, giữ ghế 300 giây, mua cần CUSTOMER, giá backend, payment demo                 | Chọn pnpm workspace, PostgreSQL 17, TypeORM raw SQL có tham số trong transaction, không clone 23 repo                                                                                       |
| Dựng nền             | package/lockfile, compose, migration, seed, secret local ngẫu nhiên                          | Migration chạy thành công; dữ liệu demo theo ngày seed; `.env` không commit                                                                                                                 |
| Backend              | Auth, refresh rotation, role/cinema scope, hold/order/payment/ticket/check-in                | Typecheck lần đầu thất bại: JSON.parse dùng sai overload, thiếu kiểu map, điều kiện dư trong AES. Sửa và typecheck/build qua                                                                |
| Công cụ sửa mã       | Dùng Python thay một đoạn mã                                                                 | Lần đầu lỗi cp1252 khi đọc tiếng Việt. Đổi read/write sang UTF-8; không coi lỗi này là kiểm thử nghiệp vụ                                                                                   |
| Kiểm thử tích hợp    | 17 test đầu trên PostgreSQL thật, HTTP Nest ở cổng ngẫu nhiên                                | 17/17 qua: tranh ghế, all-or-nothing, hết hạn, callback lặp/muộn, số tiền, HMAC, RBAC, session, check-in                                                                                    |
| UI                   | Skill design-taste-frontend, True-black flat giữ màu brief, poster demo tự vẽ, sơ đồ ghế, QR | draw lần đầu dùng kind media không hợp lệ; sửa commerce. Inspector vòng đầu 0 FAIL/2 WARN; đã tăng tương phản chữ poster, sửa màu chữ                                                       |
| Browser              | Playwright desktop và mobile trên production build                                           | Desktop qua; mobile đặt và tải lại vé được nhưng thất bại ở logout: icon thiếu accessible name. Thêm aria-label, chạy lại 2/2 qua. Chuyển hộp đăng nhập sang native dialog để quản lý focus |
| SMTP                 | Chạy worker và kiểm tra Mailpit thay vì giả báo gửi thành công                               | Phát hiện tuple kết quả UPDATE RETURNING khiến outbox PROCESSING không được xử lý. Đổi sang CTE SELECT rows                                                                                 |
| SMTP kiểm chứng tiếp | Thêm test worker; kết quả 17 qua/1 lỗi                                                       | SMTP localhost phân giải ::1 trong khi Docker chỉ bind 127.0.0.1. Lỗi thực `ECONNREFUSED ::1:1025`; sửa SMTP_HOST local sang 127.0.0.1. Chạy lại 18/18 qua, Mailpit có thư                  |
| Docker               | Build cả web/api/worker trên node:24-alpine với frozen lockfile                              | Build thành công. Kiểm tra vận hành full profile và dữ liệu sau chuyển từ host sang container ghi trong TEST_RESULTS                                                                        |
| Bàn giao             | README, env example/setup, truy vết, kết quả test, AI Log, Git                               | Chỉ ghi phần đã triển khai; đổi/hoàn, phê duyệt, CRUD, n8n và cổng thật còn lại. Không tuyên bố hoàn tất TP3                                                                                |

Các cập nhật chat giải thích giả định/phạm vi, kết quả môi trường, lỗi typecheck, test đồng thời, lỗi mobile/SMTP và kết quả sửa. Không sử dụng sub-agent trong lượt này.

## Bổ sung ngày 03/11/2026 — audit full-stack và dashboard quản lý

- Kiểm tra lại Node.js 24.14.0, pnpm 10.32.1, Git 2.52.0 và Docker CLI 29.9.2; Docker Engine hiện chưa chạy nên không khẳng định stack container sẵn sàng.
- Gỡ endpoint checkout demo cũ khỏi catalog controller. Checkout web hiện bắt đầu bằng hold, tạo booking và tạo payment qua API backend; không còn tạo ticket/QR giả bằng `Math.random` trong callback UI.
- Bổ sung API dashboard quản lý có phạm vi `staff_cinema_assignments`, bộ lọc ngày/rạp và các số liệu đơn, vé, check-in, thu, hoàn, net, đối soát, phim và hàng đợi đổi/hoàn.
- Nối dashboard vào `/manager/accounts`, vẫn giữ quản lý hồ sơ và nhân viên. Chọn phong cách `true-black-flat` của design-taste-frontend cho màn hình vận hành: nền đen phẳng, phân cấp bằng tone, màu nhấn dành cho dữ liệu.
- Loại bỏ fallback danh mục phim/suất chiếu và fallback sơ đồ ghế khi API lỗi; giao diện báo không khả dụng để tránh che lỗi dữ liệu thật.
- Kết quả kiểm tra lượt này: API typecheck, web typecheck và web production build đều đạt. Chi tiết giới hạn và lệnh chạy được ghi tại `docs/QA_AUDIT_REPORT.md`.

## Bổ sung ngày 03/11/2026 — hoàn thiện backend giao dịch và worker

- Rà soát lại backend theo prompt full-scope, giữ nguyên frontend hiện có và không reset dữ liệu.
- Bổ sung migration `PaymentProviderReference1793754000001` để lưu mã giao dịch MoMo tách khỏi UUID nội bộ.
- Hoàn thiện adapter MoMo sandbox cho create, refund, query payment/refund; callback lưu `provider_transaction_id`, kiểm tra HMAC raw IPN, số tiền và VND. Thêm các biến `MOMO_REFUND_URL`, `MOMO_QUERY_URL`, `MOMO_REFUND_QUERY_URL` vào `.env.example`.
- Khi nhà cung cấp trả thành công khoản hoàn, backend gọi luồng `refundEvent` idempotent; PENDING/UNKNOWN vẫn giữ trạng thái để đối soát, không tự suy diễn thành thất bại.
- Sửa notification outbox worker: transaction chỉ claim bản ghi; gọi webhook ngoài transaction, sau đó cập nhật trạng thái bằng giao dịch ngắn, tránh giữ connection/lock trong lúc chờ mạng.
- Sửa lỗi SQL dashboard: CTE metrics thiếu `FROM scoped`, chuẩn hóa bigint/numeric thành số JSON và lọc occupancy theo múi giờ `Asia/Ho_Chi_Minh`. Thêm test dashboard với dữ liệu đã biết.
- Kiểm chứng sau sửa: `pnpm db:migrate` áp dụng migration mới; `pnpm --filter @starlight/api typecheck`, build đạt; toàn bộ backend `pnpm --filter @starlight/api test` đạt 73/73 (thêm test chữ ký IPN MoMo); Docker Compose API/PostgreSQL/worker/Mailpit đang Up.
- Giới hạn còn lại: chưa chạy giao dịch MoMo sandbox thật vì môi trường chưa có credential và IPN HTTPS công khai; chưa đánh giá tải nhiều instance/production.
