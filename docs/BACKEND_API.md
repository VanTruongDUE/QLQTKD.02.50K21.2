# Backend Starlight Cinema — bàn giao ngày 02/11/2026

Yêu cầu mới chỉ sửa backend, contracts tương thích, cấu hình backend, tài liệu và test. Không sửa `apps/web`; không commit/push/merge/deploy. Chính sách MODEL-1.0 giữ các quyết định của mô hình học phần: giữ ghế 300 giây, đổi/hoàn trước ít nhất 60 phút, cùng phim/cùng rạp/cùng số vé, phí 0; không phải chính sách chính thức của rạp Starlight.

## Trạng thái và cách chạy

API dùng NestJS/TypeORM/PostgreSQL hiện có. Test chạy database `starlight_test`, thêm dữ liệu riêng, không reset database người dùng. Adapter MoMo sandbox đã được triển khai nhưng chỉ hoạt động khi người vận hành cấu hình credential, redirect URL và IPN HTTPS; thiếu cấu hình vẫn trả **503 PAYMENT_NOT_CONFIGURED**, không thu/hoàn/phát hành vé giả.

```powershell
pnpm.cmd install --frozen-lockfile
node infra/setup-env.mjs
docker compose up -d postgres mailpit
# Sau khi rà soát migration và sao lưu database cần nâng cấp:
pnpm.cmd db:migrate
pnpm.cmd --filter @starlight/api bootstrap:manager
pnpm.cmd --filter @starlight/api build
pnpm.cmd --filter @starlight/api start
```

Terminal khác: `pnpm.cmd --filter @starlight/api worker`. Hoặc phát triển API bằng `pnpm.cmd --filter @starlight/api dev`. API mặc định `http://localhost:4000/api/v1`; `/health` kiểm tra kết nối database, không chứng nhận payment/SMTP sẵn sàng. Chưa có dữ liệu vận hành thì danh mục trả mảng rỗng, không fallback sang mock.

Trước CLI, người vận hành đặt `INITIAL_MANAGER_EMAIL`, `INITIAL_MANAGER_PASSWORD` (ít nhất 16 ký tự), và **một trong hai**: `INITIAL_CINEMA_NAME` để tạo rạp mới, hoặc `INITIAL_CINEMA_IDS` là UUID các rạp đã được rà soát, ngăn cách bằng dấu phẩy. Đặt trong môi trường tiến trình hoặc `.env` local đã bị Git bỏ qua; không dán secret vào chat. CLI khóa transaction để không tạo hai quản lý đầu tiên, từ chối nếu đã có quản lý không bị khóa, không log mật khẩu và không có HTTP endpoint tạo MANAGER. Sau khi bootstrap, gỡ các biến INITIAL khỏi cấu hình dài hạn. Việc gắn rạp cũ không tự biến dữ liệu rạp cũ thành dữ liệu thật.

Các biến backend khác: `DATABASE_URL`, `JWT_SECRET`, `QR_SECRET` (hai secret độc lập ≥32 ký tự), `WEB_ORIGIN`, `PORT`, `NODE_ENV`. `TEST_DATABASE_URL` chỉ dùng test. Không còn DEMO_PAYMENTS, DEMO_PASSWORD hoặc PAYMENT_WEBHOOK_SECRET trong cấu hình mẫu. Test tự sinh mật khẩu ngẫu nhiên; fixture chỉ nằm trong `apps/api/test`, bị chặn nếu không phải NODE_ENV=test và database starlight_test.

## Migration và bảo toàn dữ liệu

| Migration mới | Thay đổi |
| --- | --- |
| Operations1793667600000 | COUNTER/GATE → STAFF, giữ UUID và phân công; thêm locked/profile, khóa tài khoản `@starlight.demo` cũ và thu hồi session; thêm provenance cho đơn, phạm vi danh mục, đổi/hoàn, phân bổ tiền, audit, nhận combo; bỏ unique request_id trên khóa vé để một yêu cầu có nhiều vé |
| ProviderEvents1793667600001 | ID sự kiện nhà cung cấp chuyển UUID → text; giữ giá trị cũ, cho phép ID nhà cung cấp thực tế |
| CatalogProvenance1793667600002 | Gắn danh mục có sẵn là LEGACY_DEMO, bản ghi mới mặc định OPERATIONAL; public API và giữ ghế không sử dụng danh mục legacy |
| PaymentProviderReference1793754000001 | Lưu `payments.provider_transaction_id` và index để refund/query MoMo dùng đúng mã giao dịch nhà cung cấp |

Không xóa đơn, vé, tiền, check-in hay lịch sử cũ; không sửa số tiền/trạng thái thanh toán hoặc policy_version cũ. Đơn cũ giữ DEMO-1.0, được đánh dấu LEGACY_DEMO và không dùng làm bằng chứng thu thật hoặc cơ sở hoàn tiền. Danh mục cũ không bị đổi tên, hủy lịch hay xóa; public không quảng bá chúng như dữ liệu vận hành. Quản lý được đọc danh mục/đơn trong phạm vi để rà soát; ghi danh mục yêu cầu rạp vận hành.

Phương án chuyển đổi: sao lưu → chạy migration → bootstrap quản lý với rạp mới → nhập danh mục thật bằng API. Nếu muốn tái sử dụng danh mục cũ, người vận hành đối chiếu từng ID/phim/phòng/giá/giờ, phê duyệt danh sách và chạy migration forward riêng chỉ chuyển **danh mục đã kiểm chứng**; không đổi provenance của tiền/vé demo. Không có endpoint nâng một khoản thu demo thành thu thật. Các migration down chủ động từ chối rollback phá dữ liệu.

## Quy ước API

Base `/api/v1`. Auth dùng `Authorization: Bearer <accessToken>`; access token 15 phút, refresh cookie HttpOnly xoay vòng. Login/register/refresh/logout cần header `Origin` đúng WEB_ORIGIN, cookie cần `credentials: include` khi nối web. Role và locked được đọc từ database ở mỗi request; phân công rạp được kiểm tra khi truy cập. Khóa tài khoản/đổi mật khẩu thu hồi session, đổi phân công hoặc role có hiệu lực ở request kế tiếp.

Các mutation đánh dấu **K** cần `Idempotency-Key` (UUID là lựa chọn phù hợp, tối đa 100 ký tự). Retry cùng user/operation/key/payload trả kết quả cũ, không tạo tác vụ mới; khác payload trả 409. Các thao tác PATCH hồ sơ/phân công tự ghi cùng trạng thái khi gửi lại. Không nhận ownerId, role tự chọn, tiền do browser tính hoặc trạng thái thanh toán do browser xác nhận.

401: chưa xác thực/phiên khóa; 403: sai quyền; 404: không tồn tại hoặc ngoài phạm vi; 409: xung đột trạng thái/ghế/lịch; 422: payload không hợp lệ; 503: dịch vụ thanh toán chưa cấu hình. Lỗi có `code`, `message`; validation có `issues`. UUID/tiền VND nguyên; thời gian ISO UTC. Không trả password hash/QR hash/QR ciphertext. List có giới hạn nêu bên dưới, chưa có cursor pagination.

## Bảng quyền endpoint

C = CUSTOMER, S = STAFF, M = MANAGER. M **không** được check-in hoặc nhận combo thay STAFF.

| Method / path | Quyền | Input / kết quả chính |
| --- | --- | --- |
| GET /health | Public | `{ok:true}` khi DB kết nối được |
| GET /cinemas, /movies, /products, /showtimes | Public | Danh mục OPERATIONAL, giữ tên field hiện có |
| GET /showtimes/:id/seats | Public | `{serverTime,seats:[{id,label,status}]}`; status AVAILABLE/HELD/SOLD |
| POST /auth/register | Public | `{email,password}`; tạo CUSTOMER; field role bị từ chối |
| POST /auth/login | Public | `{email,password}` → accessToken, user, refresh cookie |
| POST /auth/refresh, /auth/logout | Cookie + Origin | Refresh xoay token / thu hồi phiên |
| GET /auth/me | C/S/M | Danh tính hiện tại; không có secret |
| GET/PATCH /me/profile | C/S/M | PATCH `{displayName,phone}`, không nhận role/email/locked |
| POST /me/password | C/S/M | `{currentPassword,newPassword}`; phải đăng nhập lại |
| POST /holds **K** | C | `{showtimeId,seatIds}`; 1–8 ghế không trùng; expiresAt/serverTime |
| POST /bookings **K** | C | `{holdId,products:[{productId,quantity}]}`; backend snapshot giá |
| POST /bookings/:id/payments **K** | C, chủ đơn | Tạo checkout MoMo qua adapter; 503 khi thiếu cấu hình, 404 nếu không đúng chủ |
| GET /me/bookings, /me/tickets | C | Đơn/vé chính mình; QR chỉ được cấp cho chủ vé |
| GET /bookings/:id | C chủ đơn / S,M cùng rạp | Đơn + items/products/payments, gồm checkout_url/status |
| GET /tickets/:id | C chủ vé / S,M cùng rạp | Vé; chỉ C nhận qrToken/qrImage |
| GET /staff/bookings?email=... | S | Tra email chính xác trong rạp, tối đa 100 đơn |
| POST /staff/products/:id/redeem **K** | S | Nhận nguyên dòng combo một lần; chống nhận khi đang hoàn |
| GET /check-in/showtimes | S | Suất rạp được phân công, từ -1 đến +7 ngày |
| GET /check-in/history?showtimeId=... | S | 50 lượt thành công gần nhất, thời điểm/nhân viên |
| POST /check-in/inspect | S | showtimeId và đúng một ticketCode hoặc token |
| POST /check-in/confirm **K** | S | Như inspect + `ageVerified:true`; ghi check-in nguyên tử |
| POST /change-quotes | C/S | Báo giá; không tạo khóa vé |
| POST /change-requests **K** | C/S | Payload báo giá + quoteHash + customerConfirmed:true |
| GET /change-requests | C chính mình / S,M cùng rạp | 100 yêu cầu gần nhất |
| GET /change-requests/:id | C chính mình / S,M cùng rạp | Yêu cầu, items cũ/mới, payments, refunds và trạng thái độc lập |
| POST /change-requests/:id/approve **K** | M cùng rạp, khác người lập | `{reason}`; duyệt không đồng nghĩa đã hoàn tiền |
| POST /change-requests/:id/reject **K** | M cùng rạp, khác người lập | `{reason}`; giải phóng khóa trước thực thi |
| POST /change-requests/:id/cancel **K** | C chủ / S cùng rạp | `{reason}`; chỉ PENDING_APPROVAL/APPROVED |
| POST /change-requests/:id/execute **K** | C chủ / S; M chỉ yêu cầu có khoản hoàn | Kiểm tra lại deadline/giá/trạng thái, giữ ghế mới, gửi tác vụ tiền |
| GET/POST /admin/staff | M | GET nhân viên trong rạp; POST **K** `{email,password,cinemaIds}` luôn tạo STAFF |
| PATCH /admin/staff/:id | M | `{locked,cinemaIds,displayName?,password?}`; phải quản lý cả phạm vi cũ và mới; không tạo MANAGER |
| GET /admin/catalog/:kind | M | Danh mục cùng rạp, tối đa 500 bản ghi |
| POST /admin/catalog/:kind **K** | M | Tạo danh mục theo schema bên dưới |
| PATCH /admin/catalog/:kind/:id **K** | M | Đủ các field schema; không đổi phạm vi; không sửa suất đã có hold/đơn |
| GET /admin/bookings | M | 100 đơn mới nhất trong rạp, gồm provenance |
| GET /admin/reports | M | Tổng thu SUCCEEDED và tổng hoàn SUCCEEDED, chỉ đơn OPERATIONAL; VND bigint dạng chuỗi |
| GET /admin/dashboard | M | Lọc `dateFrom`, `dateTo`, tùy chọn `cinemaId`, `movieId`, `showtimeId`; trả metrics, daily, movies, occupancy, pendingRefunds trong phạm vi phân công |
| GET /admin/audit | M | 200 thao tác mới nhất có cinema_id trong phạm vi |
| GET /admin/reconciliation | M | Các khoản thu cần đối soát trong rạp |
| POST /admin/reconciliation/:id/approve-refund **K** | M | `{reason}`; tạo nghĩa vụ hoàn CREATED từ khoản thu SUCCEEDED có cờ đối soát |
| POST /admin/reconciliation/refunds/:id/dispatch | M | Gửi khoản đã duyệt qua MoMo; CAS trạng thái ngăn gửi trùng; 503 khi thiếu cấu hình |
| POST /admin/reconciliation/:kind/:id/query | M | kind payment/refund; truy vấn nhà cung cấp, chỉ cập nhật từ bằng chứng đã xác minh |

`/payments/:id/simulate`, `/webhooks/payments/demo` và checkout giả **đã xóa route**. Webhook thật là `POST /webhooks/payments/momo`; backend kiểm tra chữ ký trên raw body, orderId, amount, VND và trạng thái trước khi callback idempotent. Không có đường HTTP cho client tự gửi `SUCCEEDED`.

## Payload để nối frontend

Đổi vé:

```json
{
  "kind": "EXCHANGE",
  "ticketIds": ["UUID-ve-cu"],
  "productItemIds": [],
  "targetShowtimeId": "UUID-suat-moi",
  "seatIds": ["UUID-ghe-moi"]
}
```

Hoàn vé: `{"kind":"REFUND","ticketIds":["UUID-ve"],"productItemIds":["UUID-dong-combo-chua-nhan"]}`. Nhân viên thêm `ownerVerified:true` sau khi xác minh chủ vé; owner_id luôn lấy từ đơn trong DB. Một yêu cầu dùng các vé của cùng một đơn/suất, tối đa 8, không đổi một vé sang nhiều vé. Trường hợp đổi không nhận productItemIds khác rỗng; combo giữ ở đơn gốc, không cấp lại quyền nhận.

`POST /change-quotes` trả `value`, `combo`, `newValue`, `payable`, `refundable`, `fee`, `policyVersion`, `quoteHash`, `expiresAt`. Gửi lại đúng payload cùng `quoteHash` và `customerConfirmed:true` tới `/change-requests`. Nếu báo giá thay đổi, hủy hồ sơ cũ và xác nhận lại báo giá mới; không tự tăng tiền/giảm khoản hoàn đã duyệt. quoteHash là mã đối chiếu báo giá được backend tính lại, không phải bằng chứng thanh toán.

Danh mục (`:kind` chỉ thuộc whitelist):

| kind | Field POST và PATCH |
| --- | --- |
| movies | cinema_id, title, description, duration_minutes (1–600), rating (P/K/T13/T16/T18), poster, active |
| products | cinema_id, name, price (VND nguyên ≥0), active |
| auditoriums | cinema_id, name, active |
| seats | auditorium_id, label; chỉ tạo/sửa sơ đồ trước khi phòng có lịch |
| showtimes | movie_id, auditorium_id, starts_at ISO có timezone, price, status SCHEDULED/CANCELLED; ends_at tự tính thời lượng +15 phút |

Không có DELETE phá lịch sử. Dùng active=false cho phim/combo/phòng khi đủ điều kiện. PostgreSQL chặn lịch trùng; không chuyển phòng của suất bằng CRUD. Suất đã có giữ ghế hoặc đơn không được sửa giá/giờ/status qua CRUD; nhánh xử lý sự cố suất có khách đã mua chưa được tự động hóa ở bản này.

## Giao dịch và giới hạn thực thi

- Giữ ghế 300 giây lấy từ đồng hồ PostgreSQL, không gia hạn do reload/retry. Khóa hàng ghế theo thứ tự; booking/payment/check-in/đổi-hoàn cùng khóa booking trước các tài nguyên con. Check-in chỉ từ -30 đến +15 phút, inclusive; yêu cầu pending khóa vé. Xác nhận lại dưới khóa và unique check_ins.ticket_id ngăn hai lần thành công. Audit ghi nhân viên, thời điểm, thành công và lý do từ chối nghiệp vụ trong rạp; không ghi token QR.
- Yêu cầu đổi/hoàn giữ snapshot quote/policy, có created_by/approved_by/reason. Đổi ngang giá không gọi dịch vụ tiền. Đổi tăng giá giữ ghế mới 5 phút, chỉ thay vé sau bằng chứng thu; thất bại giải phóng ghế mới, giữ vé cũ. Tiền đến muộn không lấy lại ghế đã cấp cho người khác: giữ khoản thu và tạo đối soát cần duyệt hoàn.
- Mọi khoản hoàn dương cần quản lý khác người lập duyệt. Đổi rẻ hơn chỉ giữ ghế và cam kết vé mới sau duyệt; lỗi hoàn không phục hồi vé cũ. Phân bổ tiền theo từng khoản thu/từng vé hoặc combo, trả từ khoản mới nhất; khóa payment khi dự trù hoàn để tổng đang chờ + thành công không vượt tiền đã thu.
- Duyệt chỉ là APPROVED, không ghi REFUNDED. Trước gửi ra ngoài ghi UNKNOWN bền vững; không giữ transaction SQL trong lúc gọi mạng. Phản hồi PENDING vẫn chờ. Chỉ sự kiện/query đã được adapter xác minh mới ghi SUCCEEDED và vô hiệu vé hoàn. Timeout/crash không đồng nghĩa thất bại, không tự gửi một khoản mới. Callback lặp không tạo thêm vé/khoản hoàn.
- Hết hạn chưa thực thi thì worker gỡ khóa đúng request, giữ vé cũ. Hoàn đã gửi tiếp tục chờ dù qua giờ. Hoàn một phần thành công và phần khác thất bại giữ khóa và RECONCILIATION_REQUIRED; không cho khách hủy để dùng lại toàn bộ vé. Thất bại dứt khoát toàn bộ, chưa đổi vé, mới gỡ khóa.
- Nhận combo khóa booking/dòng sản phẩm và kiểm tra khóa hoàn; unique combo_redemptions.item_id ngăn nhận hai lần. Audit và phân bổ tiền không dùng dữ liệu giá do frontend gửi.

## Adapter và thông tin vận hành còn thiếu

`src/payments.ts` hiện có adapter MoMo sandbox. `charge` gọi `/v2/gateway/api/create`; `refund` gọi `/v2/gateway/api/refund`; query payment/refund gọi endpoint query tương ứng. `provider_transaction_id` được lưu từ IPN để refund không dùng nhầm internal UUID. Webhook MoMo được xác minh HMAC-SHA256 trên raw body và chỉ callback khi orderId/amount/VND khớp. Timeout giữ UNKNOWN/PENDING để đối soát, không tự charge lại.

Còn cần người vận hành cung cấp `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, redirect URL hợp lệ và IPN HTTPS công khai. **Chỉ thêm secret vào .env chưa chứng minh giao dịch sandbox thành công.** Không dán secret vào chat.

Query đã có đường xử lý PENDING/UNKNOWN theo bằng chứng terminal. Còn cần adapter/job đối soát tự động, chính sách retry của từng cổng và xử lý hỗ trợ khi provider trả kết quả mâu thuẫn. Khoản hoàn FAILED sau khi đổi đã cam kết hoặc hoàn một phần được giữ trong hàng đối soát; chưa có thao tác tự động gửi một khoản hoàn mới cho trường hợp này. Không sửa tay trạng thái SUCCEEDED hay mở khóa vé để bỏ qua công nợ.

SMTP dùng Nodemailer sẵn có, bổ sung SMTP_FROM, SMTP_USER/PASSWORD, SMTP_PORT, SMTP_SECURE; production yêu cầu TLS. Thiếu SMTP_HOST hoặc SMTP_FROM thì outbox vẫn chờ, không đánh SENT giả. Mailpit là hộp thư test local, không chứng minh email Internet. Cấu hình `.env` cũ được giữ nguyên; nếu dùng Mailpit để kiểm thử local, SMTP_PORT=1025, SMTP_HOST=127.0.0.1 (hoặc mailpit khi trong Docker) và SMTP_FROM do người vận hành cấu hình. Không gửi email cho đơn LEGACY_DEMO.

## Frontend được giữ nguyên, chưa nối đầy đủ

| File hiện tại | Điểm còn mô phỏng |
| --- | --- |
| apps/web/src/app/page.tsx | Khởi tạo tickets từ SAMPLE_TICKETS, tab/activeSimulation và các trạng thái demo bằng useState |
| apps/web/src/components/cinema/mock-data.ts | Phim, rạp, suất, combo, vé mẫu và ghế sinh cục bộ |
| apps/web/src/components/cinema/booking-flow/booking-wizard.tsx | Dùng MOVIES/SHOWTIMES/FNB_ITEMS/generateInitialSeats và điều khiển luồng cục bộ |
| apps/web/src/components/cinema/booking-flow/step1-showtimes.tsx, step3-fnb.tsx, step4-checkout.tsx | Dữ liệu/giá/thanh toán giao diện mẫu, không phải bằng chứng backend xác nhận |
| apps/web/src/components/cinema/exchange-refund-flow/ | UI đổi/hoàn hiện tại tự điều khiển kết quả; chưa gọi các API mới |
| apps/web/src/components/cinema/check-in-flow/ | UI check-in hiện tại dựa vé/trạng thái từ trang chính; không chứng minh check-in DB |
| apps/web/src/components/cinema/demo-simulator-dock.tsx, navbar.tsx | Điều khiển demo/tài khoản hiển thị hardcode vẫn còn theo yêu cầu không sửa frontend |
| apps/web/src/components/check-in-desk.tsx | Component cũ có request prop tới /check-in; trang chính mới không dùng nó làm luồng thực |

Không còn lệnh seed/demo login backend. Khi nối lại frontend, dùng đúng role STAFF thay COUNTER/GATE, đăng nhập thật và API bảng trên; thay nút mô phỏng thanh toán bằng checkout_url/trạng thái backend. Route demo bị gỡ không có API “tự báo thành công” thay thế. Frontend hiện vẫn biên dịch được, nhưng website **chưa hết demo** và không được trình bày như đã tích hợp thanh toán thật.

## Kiểm thử và ranh giới nghiệm thu

`pnpm test`, `pnpm typecheck`, `pnpm --filter @starlight/api build`, `pnpm lint`. Backend test hiện chạy 72 ca PostgreSQL/API/SMTP; test tiền nội bộ dùng TestGateway trong `test/gateway.ts`, không đăng ký endpoint giả lập vào Nest. Chưa có giao dịch MoMo sandbox thật vì chưa có credential/IPN public trong môi trường này.

Đã kiểm tra migration với schema cũ trong database test, first-manager CLI function, khóa phiên, phạm vi, tranh ghế, callback lặp, check-in, đổi nhiều vé, ba mức chênh lệch, combo, deadline, hoàn chưa rõ/một phần/thất bại và đối soát tiền chênh lệch muộn. Chưa kiểm thử production, tải lớn/nhiều instance, provider thật, SMTP Internet, sự cố suất đã bán, job đối soát tự động hoặc frontend xuyên suốt với API mới. Các giới hạn bên ngoài không được thay bằng dữ liệu giả runtime.
