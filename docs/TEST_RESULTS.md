# Kết quả kiểm thử thực tế

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
