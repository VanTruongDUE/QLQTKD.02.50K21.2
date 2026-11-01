# Starlight — lát cắt đặt vé

Ngày triển khai: 01/11/2026. NGUỒN: hai tài liệu STARLIGHT và yêu cầu hiện tại của người dùng. Phạm vi bàn giao là nền tảng + đặt vé; không coi đây là toàn bộ TP3.

## Truy vết và tiêu chí

| Nguồn                      | Hiện thực                                                                           | Bằng chứng                                                   |
| -------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Design 2, 8, lát cắt 1     | pnpm workspace, Next App Router, Nest module, migration PostgreSQL                  | typecheck, build, migration trên hai DB                      |
| Brief N9/N15/N21, DEMO-1.0 | giữ 300 giây, tất cả hoặc không, khóa theo seat_id                                  | AC01–03, giỏ giao nhau, biên hết hạn                         |
| N23/N28/N36/N43            | giá từ API, payment adapter demo, phát hành QR trong transaction                    | AC04–06, HMAC HTTP, kiểm tra số tiền                         |
| N48/N53/N59, mục 11.2      | không kéo dài giữ ghế khi thử lại; UNKNOWN chặn thu mới                             | failure/retry, timeout, tiền về muộn                         |
| Design 3, 7                | Passport JWT, refresh xoay vòng, hash token, cookie HttpOnly, kiểm tra Origin, RBAC | AC12/18, token cũ và logout                                  |
| Design 4 check-in          | kiểm tra chỉ đọc; xác nhận có khóa; cửa sổ -30/+15 phút                             | AC11 hai lượt xác nhận đồng thời                             |
| Design 7                   | transactional outbox → SMTP Mailpit                                                 | kiểm tra gửi email thực tế; ghi rõ không phải email Internet |

## Quyết định kỹ thuật bổ sung

- CSDL là nguồn quyết định ghế; query frontend chỉ là ảnh chụp. SQL tham số hóa qua TypeORM DataSource/EntityManager giúp thể hiện rõ thứ tự khóa. Không bật synchronize; không dùng SQLite thay kiểm thử PostgreSQL.
- Các bảng của lát cắt đặt vé đã có. Một role trực tiếp trên users thay bộ roles/user_roles vì demo không cần đa vai trò; staff_cinema_assignments vẫn giới hạn rạp. Giá vé tại showtimes thay bảng giá nhiều loại. Chưa tạo bảng đổi/hoàn rỗng để giả vờ hoàn tất thiết kế.
- Migration giữ khóa ghép suất/phòng/ghế, lịch không giao nhau bằng exclusion constraint, số tiền nguyên không âm, ticket duy nhất trên item và check-in duy nhất trên ticket. Seed cộng thời lượng phim và 15 phút dọn phòng vào lịch.
- Idempotency theo chủ thể + operation + key; advisory lock tuần tự hóa cùng key, hash payload chống đổi nội dung, kết quả lưu trong cùng transaction. Callback có event ID duy nhất, khóa booking → payment → hold → seats, đọc clock_timestamp sau khi có khóa.
- QR là 32 byte ngẫu nhiên, chỉ chứa token; hash để tra cứu, bản mã AES-256-GCM để chủ vé tải lại QR. Không log token; thay QR_SECRET sẽ khiến QR đã mã hóa không đọc lại được, nên giữ bí mật bền vững.
- Tiền về muộn/thu thêm được lưu payments.SUCCEEDED và reconciliation_cases.PENDING_APPROVAL. Không tự hoàn tiền hoặc tự chiếm ghế; màn hình quản lý chỉ đọc hàng chờ, chưa có thực thi hoàn.
- Worker gửi SMTP ngoài transaction; lease một phút và retry, giao thư ít nhất một lần. Message-ID ổn định nhưng không hứa exactly-once email nếu tiến trình chết sau gửi trước ghi SENT. Vé không bị phát hành lại.
- Access token chỉ ở bộ nhớ, refresh có cookie HttpOnly/SameSite Strict; origin cố định. Role lấy lại từ DB trên mỗi request. Login/register giới hạn riêng, global rate limit cho API. Chưa cung cấp khôi phục mật khẩu, email verification hay triển khai production.
- Các ngày demo tính từ lúc seed. Seed chạy lại không ghi đè vé hay tài khoản hiện có; khi lịch cũ hết hạn cần bổ sung lịch có kiểm soát, không reset dữ liệu.

## Repository đúng vai trò

Không clone repo nào. Framework được cài package với pnpm-lock.yaml. Không tuyên bố cài các skill bên ngoài chỉ vì đã đọc README.

| Repository                                         | Sử dụng thực tế                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| github/spec-kit                                    | Tham khảo README; yêu cầu → thiết kế → tiêu chí → thực thi → bằng chứng trong bộ docs này; không cài CLI                  |
| vercel-labs/agent-skills                           | Tham khảo hướng dẫn React: không coi cache là authority, truy vấn danh mục độc lập; không cài skill repo                  |
| nextlevelbuilder/ui-ux-pro-max-skill               | Tham khảo vai trò hướng dẫn UI/accessibility; không cài CLI. Dùng thêm skill design-taste-frontend có sẵn để kiểm tra ảnh |
| vercel/next.js, microsoft/TypeScript               | next và typescript trong workspace                                                                                        |
| shadcn-ui/ui                                       | Button local theo mẫu Radix Slot/CVA, điều chỉnh token Starlight; không cài toàn bộ component                             |
| tailwindlabs/tailwindcss, lucide-icons/lucide      | Tailwind 4/PostCSS và Lucide React                                                                                        |
| TanStack/query                                     | query/mutation, tải lại ghế/vé/đơn                                                                                        |
| react-hook-form/react-hook-form, colinhacks/zod    | form đăng nhập/đăng ký, contracts và validation độc lập tại API                                                           |
| nestjs/nest, nestjs/typescript-starter             | Nest runtime; tham khảo cấu trúc module/controller/service của starter, không clone framework                             |
| postgres/postgres, typeorm/typeorm, nestjs/typeorm | PostgreSQL 17 container, migration/transaction, tích hợp Nest DataSource                                                  |
| nestjs/passport, nestjs/jwt                        | Passport JWT strategy và access token                                                                                     |
| vitest-dev/vitest, microsoft/playwright            | kiểm thử PostgreSQL/API và browser desktop/mobile                                                                         |
| oxc-project/oxc, prettier/prettier                 | Oxlint và Prettier, không thay thế typecheck                                                                              |
| docker/compose                                     | postgres + mailpit; profile full chứa web/api/worker                                                                      |

Thành phần bổ sung: qrcode (ảnh QR), Node crypto (scrypt/AES/HMAC), nodemailer (SMTP), helmet/cookie-parser/throttler, pg. Đây là lựa chọn triển khai, không phải repo thứ 24 đã được người dùng bắt buộc.

## Tài liệu kỹ thuật đối chiếu trong lượt làm

- https://nextjs.org/docs/app/getting-started/installation
- https://docs.nestjs.com/security/authentication
- https://www.postgresql.org/docs/17/explicit-locking.html
- https://typeorm.io/docs/advanced-topics/transactions/ (trang mở không trả nội dung; đối chiếu kiểu/API package đã cài và kiểm thử thực tế)
- https://github.com/github/spec-kit
- https://github.com/vercel-labs/agent-skills
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- https://github.com/nestjs/typescript-starter
- https://ui.shadcn.com/docs/components/button

## Giao diện

Style sheet True-black flat, seed 1542886928, app commerce. Giữ shell không sidebar và các bề mặt phẳng; màu xanh đen/vàng theo yêu cầu thiết kế ưu tiên hơn màu mặc định của skill. Dấu hiệu riêng là poster phim demo và sơ đồ ghế, câu hỏi chính là chọn phim/suất nào rồi ghế nào.

Ba phim, poster CSS tự vẽ, giá 85/95/105 nghìn, combo 65/95 nghìn và rạp demo đều là giả lập. Không dùng ảnh quảng bá thật, ảnh Internet hoặc số liệu kinh doanh giả. Khi dùng thực tế phải thay phim, poster, phân loại tuổi, rạp, suất, giá và policy bằng dữ liệu được xác minh.

Kiểm tra ảnh vòng đầu: ba viewport không tràn ngang; poster có vùng chữ sáng trên vùng ảnh sáng. Đã thêm nền tối riêng dưới chữ và đổi chữ chính về màu trung tính. Login dùng native dialog để focus nằm trong hộp thoại; nút logout icon trên điện thoại được thêm accessible name sau test thất bại. Cảnh báo khoảng trống trong poster được chấp nhận vì đó là vùng hình minh họa, không phải panel dữ liệu thiếu nội dung.
