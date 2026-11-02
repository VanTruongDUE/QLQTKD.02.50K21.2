# Kết quả kiểm thử thực tế

## Backend ba vai trò — kết quả cuối ngày 02/11/2026

Lượt cập nhật này thay thế hướng dẫn demo runtime ở các mục lịch sử bên dưới. Không chỉnh sửa apps/web, không commit/push/merge/deploy, không áp dụng migration lên database chính.

| Kiểm tra | Kết quả |
| --- | --- |
| `pnpm test` | **58/58 qua**, 3 file: 18 booking, 20 check-in, 20 operations; lần cuối 20:47:43, 27,01 giây |
| `pnpm --filter @starlight/api build` | Exit 0 |
| `pnpm typecheck` | Contracts, API và web đều qua |
| `pnpm lint` | Exit 0, lượt cuối không có warning |
| `git diff --exit-code -- apps/web` | Exit 0, không có thay đổi frontend |
| Migration/CLI | Schema cũ → Operations/ProviderEvents/CatalogProvenance trong schema riêng thuộc starlight_test; kiểm tra giữ tiền/policy/UUID/phân công, khóa tài khoản/session cũ; bootstrap thành công một lần và từ chối lần tiếp theo |
| SMTP | Outbox gửi tới Mailpit local; không gửi lại event SENT; không chứng minh SMTP Internet |

Đã kiểm chứng các ca chính:

- Chỉ CUSTOMER/STAFF/MANAGER; khách không đọc đơn/vé người khác, không chọn role qua register/profile, không gọi staff/admin. STAFF không phê duyệt, không truy cập ngoài rạp. MANAGER không được check-in. Khóa tài khoản làm token/refresh cũ thất bại, thay role/phân công có hiệu lực ngay.
- Catalog có scope, không trùng lịch, không sửa suất đã có hold, không đổi sơ đồ ghế đã có lịch. Nhận combo đồng thời chỉ một thành công; combo có khóa hoàn không được giao.
- Giữ ghế tranh chấp, các giỏ giao nhau, hết hạn/retry, callback lặp/sai số tiền, tiền đến muộn và SMTP của bộ booking được giữ. Demo simulate và HMAC webhook trả 404; không coi test này là xác minh chữ ký cổng thật.
- Check-in mã tay/QR, sai suất/trạng thái/thời gian/quyền/rạp, trùng và đồng thời. Yêu cầu đổi/hoàn có khóa chặn check-in; worker hết hạn rồi gỡ khóa đúng yêu cầu mới cho vé còn hợp lệ vào phòng.
- Đổi ngang giá nhiều vé, đổi tăng giá rồi hoàn từ hai nguồn thu, hoàn chênh lệch thất bại vẫn giữ vé mới, hoàn vé/combo chỉ sau callback đã xác minh. Duyệt chưa tạo kết quả hoàn thành; callback hoàn trùng chỉ ghi một sự kiện; hoàn chưa rõ/hoàn một phần không tự mở lại vé.
- Giá đổi làm quote cũ không hợp lệ; mốc đúng 60 phút được chấp nhận, dưới mốc bị chặn. Người lập không tự duyệt; yêu cầu muộn bị hết hạn. Thanh toán chênh lệch đến muộn không lấy ghế người khác, tạo đối soát cần quản lý duyệt.
- Catalogue legacy bị ẩn và không giữ ghế được; đơn legacy không trở thành tiền thật. Gateway mặc định không xử lý sự kiện tiền; endpoint thanh toán đúng chủ trả 503 khi thiếu adapter và không tạo payment giả.

Test tiền dùng TestGateway và dữ liệu cô lập trong starlight_test, không có route fake trong runtime. Các test thêm fixture/schema mới, không reset database chính. Có một lượt test bị lỗi ECONNREFUSED vì Docker Engine dừng; toàn bộ ca bị skip của lượt đó không tính thành công. Sau khởi động lại đã chạy lại và đạt số liệu trên.

Chưa kiểm chứng/triển khai: provider sandbox/production và chữ ký riêng nhà cung cấp, SMTP Internet, frontend E2E với API mới, tải nhiều instance, migration trên database chính, sự cố suất đã bán, job đối soát tự động và gửi lại khoản hoàn FAILED sau khi đã đổi/hoàn một phần. Các trường hợp chưa giải quyết được giữ RECONCILIATION_REQUIRED và không giả hoàn tất. Chi tiết API, cấu hình còn thiếu và phương án dữ liệu cũ: [BACKEND_API.md](BACKEND_API.md).

## Cập nhật check-in — 02/11/2026

Đã đọc lại brief/design và giữ luồng đặt vé hiện có. Bản Docker mới chứa route `/staff/check-in`, QR camera, mã vé đầy đủ, phân quyền GATE/phân công rạp và giao dịch xác nhận nguyên tử.

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| Migration | CheckInLocks1793581200000 chạy trên development và test DB |
| `pnpm test` | **39/39 qua**, lần cuối 10:20:42, 7,64 giây: 18 booking và 21 check-in |
| `pnpm typecheck`, `pnpm lint` | Exit 0 sau thay đổi cuối |
| `docker compose --profile full up -d --build` | Build API/Next và frozen lockfile thành công; api/web/worker khởi động lại |
| `pnpm test:e2e` | **10/10 qua trong 17,5 giây** trên Docker mới: 2 booking, 8 check-in ở Chromium desktop và mobile giả lập |
| HTTP / dịch vụ | `/staff/check-in` HTTP 200; `/api/v1/health` trả ok; năm dịch vụ Up, PostgreSQL/Mailpit healthy |
| Giao diện | Đã xem ảnh màn hình staff đăng nhập ở 1440/768/390, không tràn ngang. Inspector ở trạng thái chưa đăng nhập: 0 FAIL/2 WARN do vùng trống của trang yêu cầu đăng nhập; không coi đây là đo toàn bộ màn hình đã xác thực |

Các ca backend mới: inspect mã vé/QR hợp lệ không ghi dữ liệu; QR sai/mã không tồn tại; payload thiếu suất hoặc hai cách nhận diện; sai suất; vé hủy/hoàn/đổi/đã dùng/đang khóa; đơn hủy; suất hủy; chưa đến giờ/quá giờ; bốn mốc trước/tại/sau cửa sổ (đơn vị ms); chưa xác nhận tuổi; thay trạng thái giữa inspect và confirm; hai nhân viên cùng xác nhận; retry cùng key; lịch sử có staff/time; chưa đăng nhập, CUSTOMER, COUNTER, MANAGER; rạp ngoài phạm vi. Test đồng thời kiểm tra HTTP 201/409 và đúng một dòng check_ins/audit trong PostgreSQL.

Các ca browser: nhập mã sai suất và vé vô hiệu → vé hợp lệ → xác nhận tuổi → check-in → lịch sử → từ chối trùng; giải mã QR thật từ canvas video stream giả lập rồi kiểm tra stream đã dừng; camera bị từ chối nhưng vẫn nhập mã được; đổi suất xóa kết quả cũ; khách không thấy điều khiển nhân viên. Bài đặt vé vẫn hoàn tất phim → suất → ghế → thanh toán demo → QR tồn tại sau reload.

Lỗi đã gặp và sửa: selector `getByRole('alert')` còn chọn route announcer ẩn của Next, đã giới hạn vào main; lặp nhiều suite chạm giới hạn đăng nhập, đã giảm login bằng phiên khách riêng trong setup và giữ nguyên rate limit ứng dụng; bài booking luôn chọn suất đầu tiên nên dùng hết ghế suất check-in demo, đã chọn phòng demo đặt vé gốc `Phòng 1`. Khi chạy suite liên tiếp, chờ ít nhất 60 giây sau lần gọi auth cuối để hết cửa sổ rate limit; không vô hiệu hóa guard để test qua.

Chưa kiểm chứng: camera vật lý, Safari/iOS thật, đổi camera trên phần cứng, tải nhiều instance, mất mạng dài hạn, quy trình đổi/hoàn thực tế cạnh tranh với check-in. Vé có trạng thái hoàn/đổi và khóa đang chờ trong fixture là mô phỏng, không phải giao dịch hoàn tiền. Chi tiết demo: [CHECK_IN.md](CHECK_IN.md).

## Bằng chứng lịch sử — 01/11/2026

Ngày 01/11/2026, Windows/PowerShell, PostgreSQL 17 chạy Docker. Đây là bằng chứng demo, không phải SLA, đánh giá tải production hay khảo sát rạp thật.

## Kiểm tra đã chạy

| Nhóm                            | Lệnh / kiểm tra                                        | Kết quả                                                                   |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Môi trường                      | node/npm/pnpm/git/docker/compose versions; docker info | Có đủ; Engine được khởi động sau lần đầu chưa kết nối                     |
| CSDL                            | pnpm db:migrate, pnpm db:seed                          | Migration Initial1793494800000 thành công; seed lại không sửa dữ liệu cũ  |
| Kiểu và build                   | pnpm typecheck; pnpm build                             | Qua cho contracts/API/web; Next 16.4.3 production build                   |
| Chất lượng                      | pnpm lint; Prettier cho source                         | Oxlint exit 0; đã format source                                           |
| Nghiệp vụ / an toàn / đồng thời | pnpm test                                              | **18/18** kiểm thử PostgreSQL/API/SMTP qua sau sửa lỗi                    |
| Trình duyệt                     | pnpm test:e2e                                          | **2/2** qua: Chromium desktop và mobile iPhone 13 giả lập bằng Chromium   |
| Giao diện                       | skill inspect --app trên production build              | 1440/768/390: **0 FAIL, 1 WARN**; đã xem ảnh ba viewport và ảnh vé mobile |
| Docker build                    | docker compose --profile full build                    | web/api/worker build thành công với pnpm frozen lockfile                  |

## Các tình huống đã tự động hóa

Full profile Docker đã được khởi động: web, api, worker, PostgreSQL, Mailpit đều Up; health API trả ok và trang web trả HTTP 200. Hai bài Playwright được chạy lại trên chính các container, **2/2 qua (3,4 giây)**. Lệnh seed trong container báo dữ liệu đã tồn tại và không sửa dữ liệu.

Đã restart api/web/worker sau hành trình browser: số vé development trước và sau đều **6**. Đây là snapshot của lượt kiểm tra, không phải số liệu cố định cần giữ. PostgreSQL dùng named volume; không xóa volume trong quá trình kiểm tra.

1. Hai khách giữ đồng thời cùng một ghế: chỉ một thành công.
2. Hai giỏ giao nhau: chỉ một giỏ được cấp đủ ghế; không cấp một phần.
3. Hai request cùng idempotency key: cùng ID; key khác payload bị từ chối.
4. Hết hạn có thể cấp lại trước khi worker chạy; cleanup cũ không xóa hold mới.
5. Tám callback đồng thời cùng event và một event mới cùng payment: chỉ một vé/outbox.
6. Thanh toán thất bại: không có vé; thử lại không gia hạn hold.
7. Tiền về sau hạn và ghế đã cấp lại: khoản đối soát được ghi, không lấy ghế.
8. Thanh toán tại/qua mốc hết hạn: không phát hành vé. Test đặt expires_at bằng clock_timestamp thực trong DB; không đợi 5 phút theo đồng hồ thật.
9. Timeout UNKNOWN: không tạo khoản thu thứ hai.
10. Sai số tiền hoặc event ID dùng lại với nội dung khác: từ chối.
11. Callback thất bại muộn không ghi đè SUCCEEDED.
12. Khóa ghép ghế/phòng/suất và lịch chiếu giao nhau bị DB chặn.
13. Worker gửi tới Mailpit, đánh SENT, tick sau không gửi lại event hoàn thành.
14. API chặn chưa đăng nhập, role quầy giữ ghế, chủ khác thanh toán và khách xem admin.
15. Webhook HTTP phải có HMAC đúng trên raw body.
16. Inspect check-in không đổi trạng thái; hai confirm đồng thời chỉ một thành công; QR không lộ hash/mã hóa.
17. Dữ liệu UUID sai và ghế lặp trả 422.
18. Cookie HttpOnly, refresh token xoay vòng; token cũ bị từ chối, logout thu hồi access; Origin lạ bị chặn.

Hai bài browser đăng ký khách riêng → chọn phim → suất → ghế → thanh toán → hiển thị một QR → reload còn vé → không tràn ngang → logout. Chúng tạo đơn demo trong DB development và giữ lại dữ liệu, không reset dữ liệu người dùng.

## Đánh giá ảnh cuối

- Màn hình chính trả lời chọn phim nào; phim và lịch là nội dung lớn nhất, không có KPI giả.
- Mép nội dung/header/footer thẳng hàng; trên mobile danh sách phim chuyển sang ảnh nhỏ và tên bên cạnh.
- Màu xanh đen/vàng theo brief; chỉ thêm màu trong poster demo và trạng thái ghế.
- Tổng tiền tính từ số ghế và combo; backend tính lại, tiền vé trong E2E là 85.000 VND cho một ghế không combo.
- Không có vé/không có đối soát có thông báo, không dựng số liệu.
- Chú giải trạng thái khớp màu ghế; QR đủ tương phản trắng/đen.
- Navigation mobile chỉ hai đến ba tác vụ, không có sidebar; icon logout có nhãn truy cập. Poster CSS chỉ là hình minh họa demo; WARN panel-void là vùng hình được vẽ bằng pseudo-element, không phải dữ liệu bị bỏ trống.

## Giới hạn kiểm chứng

Chưa thử Firefox/WebKit thật, tải lớn, nhiều instance API, mất mạng dài hạn hoặc mọi tổ hợp deadlock. Chưa có camera QR, đổi/hoàn/phê duyệt, tích hợp thanh toán thật, n8n, CRUD quản trị. SMTP là Mailpit local; không khẳng định giao thư Internet. Kiểm thử cửa sổ check-in mới chứng minh ca hợp lệ và dùng trùng, chưa kiểm tra tất cả mốc biên thời gian/phân công rạp trong browser. Không báo coverage phần trăm vì chưa đo.
## Bổ sung kiểm chứng backend ngày 03/11/2026

- `pnpm db:migrate`: áp dụng `PaymentProviderReference1793754000001` trên database đang chạy.
- `pnpm --filter @starlight/api test`: 5 test files, **73/73 ca đạt**; có test dashboard đối chiếu doanh thu/vé/lấp đầy và test chữ ký IPN MoMo với dữ liệu đã biết.
- `pnpm typecheck`: contracts, API và web đạt.
- `pnpm --filter @starlight/api build`: đạt.
- `docker compose build api worker` và `docker compose up -d api worker`: đạt; API health trả `{ "ok": true }`, các route demo simulate/webhook đều trả 404.
- MoMo sandbox thật chưa chạy do chưa có credential và IPN HTTPS public; adapter/refund/query chỉ được kiểm chứng qua typecheck và test core bằng TestGateway.
