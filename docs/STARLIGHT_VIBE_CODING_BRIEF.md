# Starlight Cinema — Hồ sơ khởi đầu vibe coding

Ngày lập: 01/11/2026.
Trạng thái: Intent và hướng dẫn áp dụng repo; đã chọn chính sách mô hình ở mục 11 theo ủy quyền ngày 01/11/2026. Chưa phải đặc tả thực thi hoàn chỉnh.
Mục đích: dùng cùng tài liệu gốc trong dự án ChatGPT hiện tại, rồi bàn giao sang môi trường lập trình khi bắt đầu triển khai.

## 1. Cách sử dụng

Đọc hồ sơ này cùng các tài liệu gốc. Dùng BPMN To-Be để xác định luồng; dùng tài liệu học phần để kiểm tra phương pháp và sản phẩm phải nộp. Áp dụng các repository theo vai trò ở mục 5.

Mỗi yêu cầu phải truy được về nguồn, tác nhân, quy tắc và tiêu chí nghiệm thu. Gắn nhãn rõ:
- NGUỒN: điều tài liệu hoặc người dùng đã nêu.
- ĐỀ XUẤT KỸ THUẬT — KIẾN THỨC BỔ SUNG: cách hiện thực hóa đang được đề xuất.
- CHƯA CHỐT: thông tin chưa đủ để quyết định.
- ĐÃ KIỂM THỬ: chỉ dùng khi có kết quả chạy và bằng chứng thực tế.

Không coi việc có đường dẫn GitHub là đã cài thư viện hoặc kích hoạt skill. Trong giai đoạn ChatGPT hiện tại, dùng Spec Kit và các repo hướng dẫn như nguồn phương pháp. Chỉ dùng lệnh riêng của công cụ khi môi trường đã hỗ trợ.

## 2. Nguồn và nguyên tắc xử lý khác biệt

### 2.1. Bộ nguồn đã đọc

1. MIS3047_090826.pdf — đề cương, 8 trang.
2. MIS3047_Ke_hoach_giang_day.docx — tiến độ, đánh giá TP1–TP3.
3. MIS3047_Chuong1_Slide.pptx — 55 slide.
4. MIS3047_Chuong2_Slide [Repaired].pptx — 62 slide.
5. MIS3047_Chuong3_Slide.pptx — 54 slide.
6. MIS3047_Chuong4_Slide.pptx — 52 slide.
7. MIS3047_Chuong5_Slide.pptx — 52 slide.
8. Quy trình Đặt vé, Đổi_Trả vé & Check-in Xem phim tại Rạp Starlight Cinema.docx — hồ sơ đề tài.
9. KỊCH BẢN CÓ XÁC SUẤT CAO NHẤT.docx — chứa cả kịch bản có xác suất cao nhất, xấu nhất và tốt nhất.
10. NHÓM 2_BPMN_da_sua_v2-TOBE-ChiTiet.drawio.xml — BPMN To-Be hiện có.

Bộ nguồn hiện có không chứa một tệp hướng dẫn TP3 riêng mang tên MIS3047_DoAnCuoiKy_TP3_DUE_v2.pdf. Các yêu cầu TP3 trong hồ sơ này được đối chiếu với Chương 5 và kế hoạch giảng dạy; nếu có rubric mới phải đọc và đối chiếu lại.

### 2.2. Cách xử lý nguồn

- Quyết định mới được người dùng xác nhận là căn cứ cập nhật.
- Dùng BPMN To-Be hiện tại cho luồng sẽ triển khai; giữ đúng sự khác nhau với As-Is.
- Khi BPMN và mô tả nghiệp vụ khác nhau, nêu chính xác điểm khác. Chính sách mô hình được chọn theo ủy quyền ngày 01/11/2026 nằm ở mục 11; không coi chúng là chính sách chính thức của rạp. Tệp BPMN gốc chưa được sửa.
- Tài liệu mô phỏng là bằng chứng của một lần chạy với cấu hình cụ thể. Không coi đó là số liệu khảo sát thực tế hoặc hiệu quả triển khai.
- Ba kịch bản mô phỏng có cấu hình thời gian khác nhau; không tự lấy chênh lệch giữa chúng làm phần trăm cải tiến.
- Không nhập nghiệp vụ từ dự án marketing/contact hoặc đề tài PHP2Shell vào Starlight.

## 3. Phiếu Intent bảy mục — bản khởi đầu

### I1. Vấn đề nghiệp vụ

Dự án hỗ trợ vòng đời vé từ đặt vé đến đổi/hoàn hoặc check-in. Hồ sơ đề tài nêu các vấn đề: chờ tại quầy và điểm soát vé; kiểm tra điều kiện lặp lại bằng tay; bàn giao chậm; trạng thái vé không đồng bộ; ngoại lệ thanh toán, phát hành vé và QR.

Chưa có bằng chứng khảo sát trong bộ nguồn để khẳng định tần suất, mức tiết kiệm hoặc thời gian vận hành thực tế. Mọi số giả định mới phải được ghi là giả định và dùng nhất quán.

### I2. Người dùng và tác nhân

| Tác nhân | Nhu cầu có căn cứ | Điểm cần làm rõ |
| --- | --- | --- |
| Khách hàng | Tra cứu, chọn suất/ghế/sản phẩm; thanh toán; nhận vé; yêu cầu đổi/trả qua ứng dụng hoặc quầy; xuất trình QR | Quy định đăng nhập khi xem phim và khi mua vé chưa được đặc tả đầy đủ |
| Nhân viên tại quầy | Tiếp nhận yêu cầu và nhập thông tin vào hệ thống | Thẩm quyền đổi/hoàn tại mục 11; quyền toàn hệ thống lập ở Design |
| Nhân viên soát vé | Quét QR, yêu cầu xuất trình lại, từ chối hoặc xác nhận cho vào phòng | Quyền hỗ trợ và xử lý ngoại lệ cụ thể cần đặc tả |
| Quản lý | Có trong định hướng ứng dụng của hồ sơ đề tài | Thẩm quyền đổi/hoàn tại mục 11 là bổ sung cho Design; BPMN gốc chưa thể hiện đầy đủ |
| Ngân hàng/dịch vụ thanh toán | Trao đổi kết quả thanh toán và hoàn tiền với hệ thống | Nhà cung cấp và môi trường demo chưa được chọn |
| Hệ thống | Kiểm tra rule, trạng thái, giao dịch và thông báo | Đây là tác nhân kỹ thuật; không mặc nhiên là một vai trò đăng nhập của con người |

### I3. Phạm vi

Phạm vi đã có căn cứ:
- Đặt vé: chọn phim/suất/ghế/sản phẩm; kiểm tra ghế; giữ ghế; thanh toán; phát hành và gửi vé QR; thất bại, thử lại và hết hạn.
- Đổi vé: nhận yêu cầu; kiểm tra quyền và điều kiện; chọn phương án thay thế; giữ ghế mới; xử lý chênh lệch; cập nhật giao dịch; thay thế vé; giải phóng ghế cũ.
- Trả/hoàn vé: kiểm tra điều kiện; tra giao dịch gốc; tính và hiển thị tiền hoàn; khách đồng ý hoặc không; nhận kết quả hoàn tiền; cập nhật vé và ghế.
- Check-in: đọc QR; tra vé; kiểm tra điều kiện; cập nhật trạng thái; nhân viên xác nhận cho vào hoặc từ chối.
- Xác thực, phân quyền, dữ liệu bền vững, nhật ký và tích hợp phục vụ các luồng trên.

Chưa đưa vào phạm vi mặc định: hệ thống tích điểm; thành viên VIP; khuyến mãi phức tạp; kế toán; quản lý nhân sự; báo cáo doanh thu đầy đủ; thanh toán bằng tiền thật. Nếu cần, phải bổ sung yêu cầu riêng.

### I4. Kịch bản chính

- Với vai trò khách hàng, tôi muốn chọn suất và ghế, thanh toán rồi nhận vé để sử dụng tại rạp.
- Với vai trò khách hàng, tôi muốn gửi yêu cầu đổi/trả và nhận kết quả có lý do để biết phương án xử lý vé.
- Với vai trò nhân viên tại quầy, tôi muốn nhập yêu cầu và xem kết quả kiểm tra điều kiện để hỗ trợ khách.
- Với vai trò nhân viên soát vé, tôi muốn quét QR và nhận kết quả từ hệ thống để quyết định cho khách vào phòng.
- Với vai trò quản lý, tôi cần phạm vi quyền được đặc tả trước khi triển khai các màn hình quản trị.

Đây là bản diễn đạt từ luồng hiện có, chưa thay thế đặc tả chi tiết từng kịch bản.

### I5. Quy tắc nghiệp vụ

Bảy quy tắc đổi/trả được ghi trong BPMN:

| Mã trong sơ đồ | Nội dung |
| --- | --- |
| BR1 | Mã vé phải tồn tại trong cơ sở dữ liệu |
| BR2 | Vé thuộc khách hàng yêu cầu; người thực hiện được xác minh có quyền |
| BR3 | Vé đã phát hành hợp lệ, chưa hủy hoặc bị thay thế |
| BR4 | Vé chưa được sử dụng |
| BR5 | Còn trong thời hạn đổi/trả |
| BR6 | Loại vé được phép đổi/trả |
| BR7 | Không có yêu cầu xung đột |

Các nguyên tắc khác từ hồ sơ đề tài và yêu cầu người dùng:
- Phát hành vé sau khi thanh toán được xác nhận thành công.
- Backend kiểm soát giữ ghế, chống đặt trùng, đổi/hoàn và xác nhận check-in.
- Vé cũ mất hiệu lực sau khi đổi thành công; vé đã hoàn không được check-in; vé đã check-in không dùng lại.
- QR nhận diện vé; việc chấp nhận sử dụng phải dựa trên dữ liệu và quy tắc ở backend.
- To-Be hỗ trợ cả ứng dụng và quầy; không biến As-Is thành luồng tự phục vụ toàn bộ.
- Tính tiền, so sánh thời hạn, kiểm tra trạng thái và quyền dùng logic xác định.
- Không dùng AI để quyết định tính hợp lệ của một giao dịch tài chính hoặc thay backend kiểm tra rule.
- Thời hạn, phí, loại vé và thẩm quyền đổi/hoàn áp dụng mục 11. Những quyết định ngoài phạm vi đó vẫn phải ghi CHƯA CHỐT.

### I6. Dữ liệu

Các nhóm dữ liệu cần phân tích tiếp: phim; rạp/phòng/ghế; suất chiếu; sản phẩm đi kèm; người dùng/quyền; phiên giữ ghế; đơn đặt vé; giao dịch thanh toán; vé; yêu cầu đổi/trả; giao dịch hoàn tiền; bản ghi check-in; thông báo và nhật ký.

Đây là danh sách thực thể dự kiến để phân tích, chưa phải mô hình CSDL đã chốt. Phải tách trạng thái ghế, đơn đặt vé, thanh toán, vé và yêu cầu đổi/trả theo trách nhiệm; không dùng một trạng thái chung thay tất cả.

Trường dữ liệu cá nhân, trường bắt buộc, thời hạn lưu và dữ liệu được xuất cần được chỉ rõ khi thiết kế schema/API.

### I7. Tiêu chí hoàn thành

Một tính năng được nghiệm thu khi:
1. Khớp kịch bản chính và ngoại lệ có căn cứ.
2. Backend kiểm tra quyền, dữ liệu và trạng thái.
3. Có kiểm thử phù hợp, ghi kết quả thực chạy.
4. Không làm sai dữ liệu khi gửi lại yêu cầu hoặc xử lý đồng thời.
5. Người dùng có thông báo rõ khi chờ, thành công hoặc thất bại.
6. Người thực hiện giải thích được thay đổi.
7. Qua kiểm tra bảo mật liên quan, đã commit và có hướng dẫn chạy.

Yêu cầu học phần được đối chiếu tại mục 9; tiêu chí kỹ thuật bổ sung tại mục 6–7 là đề xuất để kiểm chứng nghiệp vụ.

## 4. Bảng ánh xạ BPMN sang chức năng

Mã N trong bảng là id mxCell của tệp draw.io đang có, không phải mã Use Case mới.

| Hạng mục | Dấu vết BPMN | Phần frontend | Phần backend | Repo dùng chính | Tiêu chí nghiệm thu dự kiến |
| --- | --- | --- | --- | --- | --- |
| Tra cứu và chọn vé | N258, N262, N264, N267; hồ sơ đề tài | Chọn phim, suất, ghế, sản phẩm | Trả dữ liệu và kiểm tra lựa chọn theo suất | Next.js, shadcn/ui, Tailwind, Lucide; NestJS | Chọn được tổ hợp dữ liệu hợp lệ; dữ liệu thay đổi được phản hồi rõ |
| Giữ ghế | N9, N15, N21 | Hiển thị trạng thái và thời gian còn lại từ server | Kiểm tra khả dụng và ghi nhận giữ ghế có hạn | NestJS, PostgreSQL, TypeORM | Hai yêu cầu đồng thời cho cùng ghế/suất không cùng được cấp quyền giữ ghế |
| Thanh toán và phát hành vé | N23, N25, N28, N34, N36, N43, N47 | Hiển thị thanh toán, chờ kết quả, nhận vé | Xác minh kết quả, chốt ghế và phát hành vé | NestJS, PostgreSQL, TypeORM; Next.js, TanStack Query | Giao diện không tự đánh dấu đã thanh toán; gửi lại kết quả không tạo thêm vé |
| Thất bại và hết hạn | N48, N53, N56, N57, N59, N39 | Thông báo, thử lại khi còn điều kiện, chọn lại | Kiểm soát thời hạn và giải phóng đúng phiên giữ ghế | NestJS, TypeORM; TanStack Query | Phiên hết hạn không giữ ghế vô hạn; cập nhật cũ không ghi đè phiên mới |
| Nhận yêu cầu đổi/trả | N119, N198, N226, N121, N122, N123 | Form khách hàng và form tại quầy | Ghi yêu cầu, kiểm tra BR1–BR7, trả lý do | React Hook Form, Zod; NestJS, Passport, JWT | Mỗi quy tắc được kiểm tra ở server; người không có quyền bị từ chối |
| Đổi vé ngang giá | N147, N152, N170, N153, N155, N163, N190, N211 | Chọn suất/ghế thay thế, xem kết quả | Giữ ghế mới; xác nhận không có chênh lệch; thay thế vé | NestJS, PostgreSQL, TypeORM; Next.js | Không yêu cầu thanh toán phần chênh lệch bằng 0; vé cũ mất hiệu lực sau đổi thành công |
| Đổi vé có chênh lệch | N156, N154, N157, N158, N219, N160, N221 | Xem chênh lệch, thanh toán và kết quả | Xác minh giao dịch; đổi thành công hoặc giải phóng ghế mới khi thất bại | NestJS, TypeORM; TanStack Query | Không hủy vé cũ khi đổi chưa thành công; trường hợp giá thấp hơn áp dụng hoàn chênh lệch đã duyệt theo mục 11 |
| Hoàn vé | N167, N168, N169, N171, N174, N175, N180, N177, N179, N215 | Xem tiền hoàn, xác nhận và kết quả | Tính tiền theo chính sách; gửi/nhận hoàn; cập nhật vé/ghế | NestJS, PostgreSQL, TypeORM; React Hook Form, Zod | Không ghi hoàn tất khi dịch vụ ngoài chưa xác nhận; không tạo hoàn tiền trùng |
| Check-in | N239, N124, N127, N129, N131, N134, N135, N136, N241, N243, N246 | Màn hình quét/nhập mã theo phương án được chọn | Tra vé, kiểm tra quyền/điều kiện, cập nhật dùng vé | Next.js, shadcn/ui; NestJS, PostgreSQL, TypeORM | Hai lần quét đồng thời không tạo hai lần chấp nhận; vé vô hiệu bị từ chối |
| Thông báo và dấu vết | N63, N198, N164, N183, N214 | Hiển thị tình trạng và lịch sử phù hợp quyền | Phát sự kiện/kết quả và ghi nhật ký | NestJS; n8n nếu chọn tích hợp workflow theo học phần | Lỗi thông báo được ghi nhận và có cách xử lý; không làm phát hành/hoàn vé lần hai |

Cột frontend/backend là ĐỀ XUẤT KỸ THUẬT — KIẾN THỨC BỔ SUNG. Chưa mặc định có thư viện quét/tạo QR hoặc SDK thanh toán chỉ vì đã chọn Next.js và NestJS; phải chọn thành phần còn thiếu khi có yêu cầu tích hợp cụ thể.

## 5. Vai trò của toàn bộ 23 repository đã chọn

| Repository | Loại sử dụng | Áp dụng vào Starlight |
| --- | --- | --- |
| [github/spec-kit](https://github.com/github/spec-kit) | Phương pháp; CLI tùy chọn về sau | Yêu cầu → đặc tả → kế hoạch → task có tiêu chí nghiệm thu; hiện tại tham khảo phương pháp |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Hướng dẫn/skill cho coding agent | Chọn quy tắc React/Next.js liên quan để viết và review; không tự coi mọi skill đã được kích hoạt |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Hướng dẫn/skill thiết kế | Lập quy ước bố cục, typography, màu, responsive và accessibility; style cụ thể của Starlight cần chốt |
| [vercel/next.js](https://github.com/vercel/next.js) | Framework frontend React | Trang, layout, routing và render |
| [microsoft/TypeScript](https://github.com/microsoft/TypeScript) | Ngôn ngữ và công cụ kiểm tra kiểu | Kiểu dữ liệu FE/BE; không thay validation lúc chạy |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | Mã nguồn component được thêm vào dự án | Button, form, dialog, table, navigation; thêm component cần dùng |
| [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) | Công cụ styling | Responsive và style theo quy ước chung |
| [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | Thư viện icon | Một bộ icon thống nhất |
| [TanStack/query](https://github.com/TanStack/query) | Quản lý server state trên frontend | Query/mutation, loading, lỗi, refetch dữ liệu tương tác; cache không quyết định quyền giữ ghế |
| [react-hook-form/react-hook-form](https://github.com/react-hook-form/react-hook-form) | Thư viện form | Form đổi/trả, thông tin người dùng và tác vụ nhân viên phù hợp phạm vi |
| [colinhacks/zod](https://github.com/colinhacks/zod) | Schema validation | Kiểm tra dữ liệu đầu vào/đầu ra theo hợp đồng; backend vẫn kiểm tra độc lập quyền và nghiệp vụ |
| [nestjs/nest](https://github.com/nestjs/nest) | Framework backend | API, module nghiệp vụ, quyền, giao dịch và trạng thái |
| [nestjs/typescript-starter](https://github.com/nestjs/typescript-starter) | Starter tham khảo khi khởi tạo | Tham khảo cấu trúc nền, không clone thêm mã nguồn Nest framework |
| [postgres/postgres](https://github.com/postgres/postgres) | Hệ quản trị CSDL | Dữ liệu bền vững, transaction và ràng buộc nhất quán |
| [typeorm/typeorm](https://github.com/typeorm/typeorm) | ORM | Entity, relation, migration, truy vấn và transaction |
| [nestjs/typeorm](https://github.com/nestjs/typeorm) | Tích hợp ORM với NestJS | Cấu hình DataSource/repository theo module |
| [nestjs/passport](https://github.com/nestjs/passport) | Tích hợp xác thực | Cơ chế xác thực được chọn cho API |
| [nestjs/jwt](https://github.com/nestjs/jwt) | Công cụ JWT | Ký/xác minh token theo thiết kế xác thực; không tự cung cấp toàn bộ RBAC |
| [vitest-dev/vitest](https://github.com/vitest-dev/vitest) | Kiểm thử | Kiểm thử logic và thành phần phù hợp; kiểm tra cấu hình với starter thực tế |
| [microsoft/playwright](https://github.com/microsoft/playwright) | Kiểm thử trình duyệt | Luồng đặt, đổi/hoàn và check-in từ giao diện |
| [oxc-project/oxc](https://github.com/oxc-project/oxc) | Công cụ chất lượng code | Sử dụng Oxlint theo cấu hình chọn; không coi lint là thay typecheck hay kiểm thử |
| [prettier/prettier](https://github.com/prettier/prettier) | Công cụ định dạng | Định dạng code thống nhất |
| [docker/compose](https://github.com/docker/compose) | Công cụ chạy môi trường | Mô tả frontend/backend/database khi khởi tạo môi trường phát triển |

Trạng thái kiểm chứng: đã tham khảo các README/hướng dẫn liên quan cho Spec Kit, Agent Skills, UI UX Pro Max, Next.js, shadcn/ui, Nest starter và TanStack Query trong quá trình chuẩn bị. Không khẳng định đã đọc toàn bộ mã nguồn của 23 repo hoặc đã kiểm thử tích hợp chúng. Phiên bản package, Node.js, cấu hình công cụ và API phải được đối chiếu ở bước khởi tạo.

## 6. Ranh giới hệ thống — đề xuất kỹ thuật, kiến thức bổ sung

### 6.1. Phân trách nhiệm

- Next.js: hiển thị và tương tác; nhận kết quả từ API. Không tự quyết định giá hợp lệ, quyền sở hữu vé, hết hạn giữ ghế hoặc check-in thành công.
- NestJS: nguồn thực thi quy tắc nghiệp vụ, xác thực, quyền truy cập và chuyển trạng thái.
- PostgreSQL: lưu trạng thái bền vững và bảo vệ bằng transaction/ràng buộc phù hợp.
- TypeORM: lớp truy cập dữ liệu và migration; có ORM không tự có cơ chế chống đặt trùng.
- n8n: có thể xử lý tích hợp/thông báo theo thiết kế TP2. Chưa có tệp workflow và log chạy trong bộ nguồn để xác nhận workflow hiện tại đã hoạt động.
- AI: chỉ chọn khi có nhiệm vụ nhận thức rõ và tiêu chí đánh giá. Kiểm tra vé, tính tiền, so sánh thời hạn và chống trùng dùng rule.

### 6.2. Những bất biến phải được thiết kế và kiểm thử

1. Với một suất chiếu và một ghế, có một nguồn trạng thái phân bổ có thẩm quyền tại backend/CSDL.
2. Giữ ghế là trạng thái có hạn lưu bền vững; không giữ khóa transaction của CSDL suốt thời gian khách chờ thanh toán.
3. Thao tác kiểm tra rồi cập nhật ghế phải được bảo vệ khi có nhiều yêu cầu đồng thời; chỉ kiểm tra bằng một truy vấn đọc trước khi ghi là chưa đủ.
4. Lịch sử vé và phân bổ ghế đang hoạt động cần được phân biệt, để vừa chống trùng vừa có thể bán lại sau khi đổi/trả hợp lệ.
5. Callback thanh toán cần được xác thực và đối chiếu giao dịch, số tiền, trạng thái; không tin tham số từ trang redirect.
6. Gửi lại yêu cầu hoặc nhận lại cùng một kết quả không tạo thêm vé/hoàn tiền/check-in.
7. QR không phải bằng chứng thanh toán độc lập và không thay việc kiểm tra trạng thái hiện tại.
8. Kiểm tra vai trò và quyền trên từng bản ghi ở backend; việc ẩn nút chỉ phục vụ giao diện.
9. Các bước thanh toán/hoàn qua dịch vụ ngoài cần trạng thái chờ, kết quả và đối soát; transaction trong CSDL không bao trùm được việc chuyển tiền bên ngoài.
10. Thời điểm hết hạn và hành vi khi callback đến muộn phải được thiết kế rõ; không tự phát hành vé cho ghế đã cấp cho giao dịch khác.
11. Dữ liệu riêng của người dùng không được chia sẻ nhầm qua cache/query key.
12. Chỉ nói triển khai/tích hợp thành công khi có kiểm thử thực tế.

Hướng đọc chính thức cho thiết kế đồng thời và phân quyền:
- [PostgreSQL — Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html).
- [PostgreSQL — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).
- [NestJS — Authorization](https://docs.nestjs.com/security/authorization).

Các tài liệu trên cung cấp cơ chế kỹ thuật; không quyết định chính sách đổi/hoàn của Starlight. Đường dẫn TypeORM transactions chưa cung cấp được nội dung đọc hợp lệ trong lượt chuẩn bị này; cần đối chiếu lại tài liệu/API của đúng phiên bản TypeORM khi viết transaction.

### 6.3. Tổ chức code dự kiến

Đây là cấu trúc đề xuất để trao đổi khi thiết kế, chưa có mã nguồn được khởi tạo:

    starlight-cinema/
      apps/
        web/               # Next.js
        api/               # NestJS
      packages/
        contracts/         # DTO/schema công khai được phép dùng chung
      docs/
        intent/
        decisions/
        specifications/
        testing/
        ai-log/
      workflows/           # Bản xuất workflow nếu có
      compose.yaml
      README.md

Không đưa entity ORM, bí mật hoặc cấu hình nội bộ backend sang frontend qua packages/contracts. API có thể chia module theo danh mục suất chiếu, giữ ghế/đặt vé, thanh toán, vé, đổi/trả, check-in, thông báo và quyền; ranh giới cuối cùng được chốt cùng mô hình dữ liệu.

## 7. Bộ tiêu chí kiểm thử nghiệp vụ khởi đầu

Các trường hợp dưới đây là đề xuất kiểm thử, chưa phải kết quả đã chạy.

| Mã | Trường hợp | Kết quả cần chứng minh |
| --- | --- | --- |
| AC01 | Hai khách cùng giữ một ghế/suất | Chỉ một quyền giữ ghế hợp lệ được cấp |
| AC02 | Hai giỏ có nhiều ghế giao nhau | Không có phân bổ trùng; hành vi cấp cả giỏ hoặc một phần phải được đặc tả |
| AC03 | Hết thời hạn giữ ghế | Phiên hết hạn không tiếp tục chiếm ghế; giao diện đồng bộ lại |
| AC04 | Thanh toán thất bại | Không phát hành vé; chỉ thử lại trong điều kiện còn hợp lệ |
| AC05 | Cùng kết quả thanh toán được gửi nhiều lần | Không phát hành thêm vé hoặc ghi nhận thành công nhiều lần |
| AC06 | Thanh toán đến sau hết hạn | Không chiếm lại ghế của giao dịch khác; đi theo chính sách đến muộn đã chốt |
| AC07 | Đổi vé ngang giá | Không tạo thanh toán chênh lệch giả |
| AC08 | Đổi vé, thanh toán chênh lệch thất bại | Giải phóng ghế mới theo luồng; vé cũ chưa bị thay thế |
| AC09 | Đổi thành công rồi quét QR cũ | QR cũ không được chấp nhận |
| AC10 | Hoàn thành công rồi check-in | Vé không còn được chấp nhận |
| AC11 | Quét một vé đồng thời tại hai điểm | Không có hai lần chấp nhận check-in hợp lệ |
| AC12 | Khách đổi id vé/đơn trong request | Không xem hoặc sửa bản ghi ngoài quyền |
| AC13 | Gửi lại yêu cầu hoàn tiền | Không tạo thêm khoản hoàn cho cùng phạm vi giao dịch |
| AC14 | Đổi/hoàn và check-in chạy đồng thời | Không có hai kết quả đã hoàn tất xung đột; xử lý trạng thái chờ theo chính sách đã chốt |
| AC15 | Email hoặc workflow thông báo lỗi | Ghi lỗi và xử lý lại phù hợp; không tái thực hiện giao dịch tài chính |
| AC16 | API thanh toán/hoàn timeout, kết quả chưa biết | Giữ trạng thái phản ánh chưa xác định; không tự suy ra thất bại hay thành công |
| AC17 | Dữ liệu thiếu, sai định dạng hoặc tên có dấu | Validation và thông báo rõ; dữ liệu hợp lệ được lưu đúng |
| AC18 | Vai trò không có quyền gọi trực tiếp API | Backend từ chối dù không đi qua giao diện |

Các kiểm thử biên thời gian cần triển khai được liệt kê tại mục 11.7. Không tự đặt một tỷ lệ coverage hoặc SLA rồi ghi là yêu cầu của giảng viên.

## 8. Sổ quyết định

| Mã | Nội dung cần chốt | Căn cứ hiện tại | Việc phụ thuộc |
| --- | --- | --- | --- |
| D01 | Thời gian giữ ghế | Đã chọn 5 phút theo mô phỏng; chi tiết mục 11 | Cấu hình hết hạn, countdown và kiểm thử biên |
| D02 | Thời hạn đổi/trả | Đã chọn ≥60 phút cho mô hình To-Be; không phải chính sách chính thức của rạp | BR5, mục 11 |
| D03 | Cách tính tiền hoàn, phí, loại vé và combo | Đã chọn phí 0; hoàn phần thực trả đủ điều kiện, mục 11 | BR6, báo giá hoàn và đối soát |
| D04 | Đổi sang vé rẻ hơn | Đã chọn hoàn chênh lệch về phương thức gốc; cần quản lý duyệt | Mục 11; cần bổ sung nhánh khi đặc tả thực thi |
| D05 | Nhà cung cấp thanh toán, QR và môi trường demo | Chưa được chọn | Tích hợp thực tế, callback và bộ kiểm thử |
| D06 | Callback muộn hoặc trạng thái thanh toán chưa rõ | Đã chọn nguyên tắc ở mục 11; hợp đồng API nhà cung cấp còn mở | Thanh toán và giải phóng ghế |
| D07 | Quyền quản lý và phê duyệt ngoại lệ | Đã chọn thẩm quyền đổi/hoàn ở mục 11; ma trận quyền toàn hệ thống sẽ lập ở Design | RBAC và luồng phê duyệt TP3 |
| D08 | Điều kiện check-in cụ thể | Có task kiểm tra và các nguyên tắc trạng thái; chưa đủ ngưỡng thời gian, tuổi và ngoại lệ | Bộ rule check-in |
| D09 | Workflow n8n hiện có | Chưa có bản xuất JSON và bằng chứng chạy trong 10 tệp | Quyết định tích hợp lại TP2 |
| D10 | Đăng nhập, tài khoản khách và khôi phục truy cập | Chưa có đặc tả xác thực chi tiết cho Starlight | Thiết kế Auth, sở hữu đơn và vé |
| D11 | Style và phạm vi quản trị dữ liệu | Chưa có design system Starlight hoặc danh sách CRUD được chốt | UI và màn hình quản lý |

Ghi nhận kỹ thuật trong BPMN:
- Có hai edge cùng đi từ N153 đến N156: edge 84 và 85.
- Có hai edge cùng đi từ N301 đến N300: edge 291 và 292.
- Trước khi chuyển chúng thành logic, cần rà soát để không diễn giải đường nối lặp thành hai lần thu tiền hoặc hai hành động.
- Phiếu này chỉ ghi nhận; chưa chỉnh sửa tệp BPMN gốc.

Không cần dừng toàn bộ công việc vì các quyết định còn mở. Tiếp tục phân tích dữ liệu, mô hình trạng thái và giao diện ở phần không phụ thuộc; chỉ giữ lại nhánh cần chính sách chưa chốt.

## 9. Áp dụng IDEA và Spec Kit vào quá trình làm

| Bước | Việc làm với tài liệu Starlight | Repo/phương pháp hỗ trợ | Kết quả cần có |
| --- | --- | --- | --- |
| Intent | Hoàn thiện mục 3, phân biệt nguồn với giả định, ghi quyết định còn mở | Spec Kit; Chương 5 | Phiếu ý định có phạm vi, người dùng, rule và nghiệm thu |
| Design | Lập trạng thái từng đối tượng, mô hình dữ liệu, quyền, hợp đồng API và màn hình; liên kết về BPMN | Spec Kit; NestJS/TypeORM/PostgreSQL; Next.js; hướng dẫn React/UI | Hồ sơ thiết kế đủ để chia việc; không tự chốt chính sách thiếu |
| Execute | Tạo repo dự án; khởi tạo nền; triển khai từng phần nhỏ, chạy và đọc thay đổi | Các framework/package được chọn; Docker Compose | Phần mềm chạy được theo từng mốc, có commit thật |
| Assess | Kiểm tra nghiệp vụ, đồng thời, dữ liệu, quyền, lỗi ngoài và khả năng chạy lại | Vitest, Playwright, Oxlint, Prettier; typecheck | Kết quả thực chạy, lỗi và cách sửa; cập nhật AI Log/README |

Spec Kit cung cấp cách tổ chức đặc tả/kế hoạch/task; IDEA là khung học phần. Dùng hai cách này bổ sung cho nhau. Không phải dựng thêm hai hệ tài liệu trùng lặp cho cùng một yêu cầu.

Bằng chứng TP3 từ Chương 5, slide 48–50:
- Bám đúng quy trình; rubric trong slide chia: nghiệp vụ 30%, hoàn chỉnh/kỹ thuật 25%, kiểm thử/bảo mật 15%, quá trình 15%, bảo vệ/giải thích 15%.
- Xác thực và ít nhất hai vai trò; một luồng phê duyệt phản ánh XOR; dữ liệu bền vững; ít nhất một tích hợp bên ngoài.
- Ít nhất 15 commit phản ánh quá trình làm việc thật.
- Ít nhất 10 tương tác AI đáng chú ý, có ít nhất hai lượt thất bại thật kèm phân tích nguyên nhân.
- Kiểm thử tự động kịch bản chính và ngoại lệ; báo cáo sáu nhóm kiểm tra.
- Trình bày 10 phút; giải thích mã và ba quyết định thiết kế tự đưa ra.

Không tạo commit hoặc thất bại giả để đủ số lượng. Luồng quản lý duyệt hoàn đã chọn ở mục 11 cần được ánh xạ rõ tại Design; không mặc định mọi nhánh XOR trong BPMN gốc đều là phê duyệt của con người.

## 10. Yêu cầu đầu tiên dùng ngay trong dự án ChatGPT

Sao chép đoạn dưới khi bắt đầu bước Design. Dùng kèm hồ sơ này và tài liệu nguồn của dự án.

> Hãy áp dụng hồ sơ Starlight Cinema vừa đọc cùng 23 repository đã được phân vai.
>
> Bắt đầu bước Design của IDEA từ bản nháp Intent hiện có. Dùng github/spec-kit để tham khảo cách biến yêu cầu thành đặc tả và task; dùng các repo framework/thư viện đúng vai trò. Chưa viết mã hoặc cài đặt.
>
> Đầu tiên lập bảng truy vết yêu cầu gồm: mã yêu cầu, nguồn hoặc id BPMN, tác nhân, dữ liệu vào/ra, rule, kết quả và tiêu chí nghiệm thu.
>
> Sau đó đề xuất riêng mô hình trạng thái cho giữ ghế, đơn đặt vé, thanh toán, vé, yêu cầu đổi/trả và check-in; giải thích cách chúng liên hệ. Không gom mọi trạng thái vào một chuỗi chung.
>
> Từ đó đề xuất mô hình dữ liệu, ma trận quyền và hợp đồng API ở mức cần thiết để kiểm tra luồng; đánh dấu mọi trường/ràng buộc chỉ là đề xuất kỹ thuật. Giữ đúng hai kênh đổi/trả của To-Be và các nguyên tắc backend kiểm soát nghiệp vụ.
>
> Nêu rõ repo nào đang được dùng làm phương pháp, repo nào sẽ là dependency hoặc công cụ. Với React/Next.js, tham khảo agent-skills và UI UX Pro Max cho phần có liên quan; không tuyên bố skill đã được cài nếu chưa thực hiện.
>
> Áp dụng chính sách mô hình tại mục 11 cho giữ ghế, thời hạn đổi/hoàn, phí, chênh lệch âm và thẩm quyền. Đây là quyết định theo ủy quyền của người dùng, không phải chính sách chính thức của Starlight. Các phần còn mở ở mục 8, gồm nhà cung cấp thanh toán, phải được phân biệt rõ.
>
> Không tự sửa BPMN. Nếu thấy xung đột hoặc đường nối gây mơ hồ, dẫn đúng vị trí và đề xuất cách làm rõ.
>
> Kết quả cần đủ cụ thể để sau đó bàn giao sang môi trường lập trình; chưa khẳng định code, workflow hoặc tích hợp đã chạy.

## 11. Chính sách mô hình đã chọn theo ủy quyền

Phiên bản chính sách: DEMO-1.0. Lưu phiên bản và báo giá áp dụng trên giao dịch; thay cấu hình về sau không tự tính lại giao dịch đã cam kết.

Ngày quyết định: 01/11/2026. Người dùng cho phép tự nghiên cứu và phân tích để quyết định các điều kiện ở bước 1. Các quyết định dưới đây là đường cơ sở cho bản demo học phần, có thể điều chỉnh bằng phiên bản chính sách mới. Không cần xin lại xác nhận từng thông số trong phạm vi đã ủy quyền.

### 11.1 Căn cứ và giới hạn

- NGUỒN DỰ ÁN: tài liệu mô phỏng có task giữ ghế 5 phút; BPMN có BR1–BR7, hai kênh ứng dụng/quầy, xử lý chênh lệch và hoàn tiền. Hồ sơ đề tài yêu cầu xác minh mốc 60 phút trước khi gọi đó là chính sách rạp.
- NGUỒN CÔNG KHAI: trang [Kiểm hàng đổi trả hoàn tiền của Starlight](https://starlight.vn/chinh-sach/chinh-sach-thanh-toan-5.html), tra cứu ngày 01/11/2026, nêu không đổi/trả thông thường; hỗ trợ hoàn khi lịch chiếu thay đổi, bị hủy hoặc dịch vụ không thể cung cấp. Trang cũng nêu hoàn qua phương thức thanh toán gốc và rạp chịu chi phí hoàn trả.
- KHÁC BIỆT: quyền đổi/hoàn tự nguyện của khách trong mô hình To-Be rộng hơn chính sách công khai vừa đọc. Giữ phạm vi To-Be đã có và ghi rõ đây là phương án cải tiến phục vụ học phần, không mô tả là chính sách vận hành thật đã được Starlight chấp thuận.
- CHƯA CÓ DỮ LIỆU THỰC NGHIỆM: không có mẫu thời gian thanh toán, tỷ lệ bỏ giỏ, nhu cầu bán lại, tổn thất doanh thu hay chi phí xử lý thực tế để tối ưu thông số. Mốc 60 phút và phí 0 là lựa chọn thiết kế; không phải kết quả khảo sát hoặc phân tích thống kê.
- KIẾN THỨC BỔ SUNG: các quy tắc đồng thời, giao dịch, dấu vết và tính lặp an toàn bên dưới là thiết kế kỹ thuật phục vụ tính nhất quán.

### 11.2 Giữ ghế và thanh toán

1. Giữ ghế 300 giây từ lúc backend giữ thành công. Có hiệu lực khi `server_now < expires_at`; đúng thời điểm hết hạn là không còn hiệu lực. Thử thanh toán lại hoặc tải lại trang không kéo dài thời gian.
2. Giá trị này kế thừa tài liệu mô phỏng, giúp thống nhất bài làm. Chưa chứng minh 5 phút là tối ưu cho khách thực tế. Áp dụng cùng thời lượng cho ghế thay thế trong đổi vé.
3. Mỗi ghế của một suất chỉ có một phân bổ đang hiệu lực. Giữ nhiều ghế theo nguyên tắc tất cả hoặc không ghế nào; chống trùng tại backend/CSDL.
4. Hết hạn thì giải phóng phân bổ tạm. Thanh toán chỉ phát hành vé nếu backend đã xác minh thành công và phân bổ vẫn còn hiệu lực tại thời điểm chốt.
5. Nếu nhận xác nhận tiền thành công sau khi giữ ghế hết hạn, không lấy ghế đã cấp lại hoặc tự phát hành vé. Ghi nhận đã nhận tiền nhưng không cấp vé, chuyển đối soát và yêu cầu hoàn toàn bộ khoản thu thừa; khoản hoàn cần quản lý duyệt.
6. Timeout kết nối không chứng minh thanh toán thất bại. Tra cứu trạng thái và đối soát trước khi cho phép một lần thu mới; không tạo nhiều yêu cầu thu cho cùng số tiền đang chưa rõ kết quả. Hợp đồng tích hợp cụ thể thuộc Design sau khi chọn nhà cung cấp.

### 11.3 Điều kiện đổi và trả vé

1. BR1: vé tồn tại. BR2: đúng chủ vé hoặc nhân viên có quyền thao tác thay khách đã được xác minh. BR3: vé đã phát hành hợp lệ, chưa hủy hoặc bị thay thế. BR4: chưa check-in. BR5: còn hạn. BR6: loại vé được hỗ trợ. BR7: không có yêu cầu/giao dịch xung đột.
2. Hạn thông thường: `show_start_at - server_now >= 60 phút`. Đúng 60 phút được nhận, 59 phút 59 giây bị từ chối. Áp dụng ở lúc nhận yêu cầu và kiểm tra lại ngay trước khi cam kết đổi hoặc gửi hoàn ra ngoài. Yêu cầu gửi sớm không giữ quyền vô thời hạn.
3. Nếu chờ duyệt đến quá hạn, yêu cầu chưa gửi hoàn và chưa cam kết đổi sẽ hết hiệu lực; giải phóng ghế mới tạm giữ. Vé cũ vẫn có hiệu lực nếu chưa có nghiệp vụ khác thay đổi nó. Giao dịch hoàn đã gửi hợp lệ trước hạn tiếp tục chờ kết quả, không bị hủy chỉ vì đồng hồ đi qua mốc hạn.
4. Bản demo hỗ trợ vé thường được thanh toán bằng tiền, gồm các hạng ghế thông thường. Vé tặng, voucher, điểm và khuyến mãi có điều kiện không được tự động đổi/hoàn; ngoài phạm vi MVP. Không giả định mọi vé giảm giá đều tương đương vé thường.
5. Đổi vé giữ nguyên phim, cùng rạp, cùng số lượng vé; cho phép đổi suất hoặc ghế còn trống. Suất mới cũng phải còn ít nhất 60 phút tại lúc cam kết đổi. Không giới hạn số lần đổi bằng một con số tùy ý; mỗi lần đều kiểm tra lại rule và lưu lịch sử dòng vé.
6. Cho phép chọn các vé cụ thể trong đơn để đổi/trả. Mỗi yêu cầu xử lý một suất gốc; không gộp nhiều suất hoặc nhiều phương thức thanh toán trong cùng một yêu cầu. Các vé trong yêu cầu được xử lý đồng bộ; vé không được chọn giữ nguyên.
7. Phạm vi được đổi/trả luôn hiển thị cùng số tiền và cần khách xác nhận. Chỉ lập hồ sơ sau khi chọn phạm vi, tránh khóa vé chỉ vì mở màn hình xem báo giá.
8. Lý do chọn 60 phút: tạo khoảng đệm cho kiểm tra, hỗ trợ tại quầy và cơ hội bán lại; là giả định vận hành dễ kiểm thử. Chưa có dữ liệu chứng minh cải thiện công suất hoặc doanh thu.

### 11.4 Phí và công thức tiền

Chọn phí xử lý bằng 0 đồng cho bản demo. Quyết định này giảm giả định về chi phí chưa có dữ liệu và giúp giải trình phép tính. Không suy rộng thành chính sách đổi/hoàn miễn phí của Starlight cho mọi trường hợp.

- `V`: giá trị tiền đã thanh toán đang gắn với các vé hiện hành được chọn. Vé gốc lấy tiền thực trả; sau đổi, giá trị vé mới được ghi rõ trong sổ giao dịch.
- `N`: giá bán các vé mới do backend báo giá và cố định trong phiên giữ ghế mới.
- Chênh lệch `D = N - V`.
- Nếu `D > 0`: khách trả thêm D; chỉ đổi thành công sau khi xác minh khoản thu và kiểm tra lại ghế, hạn, quyền và trạng thái.
- Nếu `D = 0`: không thu và không hoàn.
- Nếu `D < 0`: hoàn `-D` về phương thức gốc, cần quản lý duyệt trước khi cam kết đổi. Ghế mới được giữ sau bước duyệt; nếu giá hoặc ghế đổi, báo giá lại cho khách và duyệt lại số tiền đã thay đổi.
- Trả vé: `R = V + C`, với `C` là tiền thực trả cho combo đủ điều kiện hoàn được khách chọn, chưa được đổi lấy sản phẩm. Phí bằng 0. Không hoàn tiền cho combo đã sử dụng.
- Bản demo ghi combo thành dòng riêng với giá riêng và trạng thái nhận hàng; không dùng gói giá chung vé–combo hoặc chiết khấu khó phân bổ. Khi đổi vé trong cùng rạp, combo chưa nhận được giữ lại với liên kết đơn; combo đã nhận không được chuyển thành một quyền nhận mới. Khi hoàn vé, combo chưa nhận có thể được chọn hoàn hoặc giữ lại; combo đã nhận giữ lịch sử và không hoàn.
- Hoàn về chính phương thức đã thanh toán, không nhận số tài khoản mới tùy ý. Nếu dòng vé có nhiều lần trả thêm, hoàn theo các khoản thu còn số dư, khoản thu mới nhất trước; mỗi khoản hoàn liên kết một giao dịch thu cụ thể.
- Tổng tiền đã hoàn cộng các khoản hoàn đang chờ không được vượt tổng tiền đã thu của phạm vi tương ứng. Dùng số nguyên VND; không dùng số thực để cộng trừ tiền.
- Khi đổi sang vé rẻ hơn: thay vé và ghi khoản phải hoàn trong cùng một transaction nội bộ sau phê duyệt, rồi gửi hoàn ra dịch vụ thanh toán. Vé cũ mất hiệu lực khi đổi đã cam kết; vé mới có hiệu lực dù khoản hoàn chênh lệch còn chờ. UI hiển thị riêng kết quả đổi vé và trạng thái hoàn tiền. Lỗi hoàn chuyển đối soát, không tự phục hồi vé cũ.

Ví dụ giả định để kiểm tra công thức, chưa phải kết quả chạy phần mềm:

| Tình huống | Giá trị đầu vào | Kết quả |
| --- | --- | --- |
| Đổi đắt hơn | V=90.000, N=110.000 | Thu thêm 20.000 đồng |
| Đổi ngang giá | V=90.000, N=90.000 | Không thu/hoàn |
| Đổi rẻ hơn | V=90.000, N=70.000 | Hoàn 20.000 đồng sau duyệt |
| Trả vé và combo chưa nhận | V=90.000, C=50.000 | Hoàn 140.000 đồng |
| Trả vé, combo đã nhận | V=90.000, combo=50.000 | Hoàn 90.000 đồng |

### 11.5 Phê duyệt và xử lý ngoại lệ

| Tình huống | Thẩm quyền | Điều kiện thực thi |
| --- | --- | --- |
| Đổi ngang giá hoặc trả thêm, đủ rule | Hệ thống xử lý tự động | Khách xác nhận, backend kiểm tra; không cần quản lý |
| Trả vé hoặc đổi rẻ hơn có tiền hoàn | Quản lý duyệt hoặc từ chối | Hệ thống tính tiền, khách đồng ý, quản lý duyệt trước khi hoàn |
| Yêu cầu tại quầy | Nhân viên tiếp nhận | Kiểm tra quyền sở hữu; không tự duyệt khoản hoàn do mình lập |
| Thanh toán muộn, thu trùng hoặc xác nhận đã thu nhưng không cấp được vé | Nhân viên đối soát, quản lý duyệt hoàn | Có bằng chứng giao dịch; không đoán kết quả từ timeout |
| Rạp hủy/đổi lịch hoặc không thể cung cấp dịch vụ | Quản lý xác nhận sự cố và duyệt hoàn | Miễn hạn 60 phút cho vé bị ảnh hưởng; vẫn chống hoàn trùng và xác minh giao dịch |
| Vé đã dùng, đã hoàn, không thuộc khách, không tồn tại | Hệ thống từ chối | Quản lý không được bỏ qua các bất biến để biến vé sai thành vé hợp lệ |

Các hồ sơ hoàn do nhân viên lập cần người quản lý khác duyệt; không tự duyệt hồ sơ do chính mình lập. Nếu quản lý tiếp nhận trực tiếp thì chuyển người quản lý khác duyệt. Tài khoản demo cần đủ vai trò để thể hiện quy tắc này.

Luồng duyệt: nhận yêu cầu → kiểm tra BR1–BR7 → tính tiền và khách xác nhận → chờ quản lý → duyệt/từ chối có lý do → kiểm tra lại điều kiện → thực thi → nhận kết quả → thông báo, ghi nhật ký. Có thể rút yêu cầu trước lúc cam kết hoặc gửi hoàn ra ngoài; khi đã gửi thì phải đối soát, không tự mở vé lại.

Trong khi hồ sơ đổi/hoàn đang hoạt động, các vé liên quan bị chặn check-in và chặn yêu cầu xung đột. Từ chối hoặc hết hạn trước thực thi thì gỡ chặn và giữ vé cũ. Với trả vé, giữ phân bổ ghế đến khi có kết quả hoàn thành công theo luồng BPMN hiện có; khi thành công thì hủy hiệu lực vé, giải phóng ghế nếu suất còn bán được. Nếu kết quả hoàn chưa rõ thì tiếp tục chặn, đối soát và hiển thị trạng thái chờ. Không coi timeout là căn cứ khôi phục vé. Nếu xác nhận thất bại dứt khoát và không còn khoản hoàn đang xử lý, đóng yêu cầu thất bại và gỡ chặn vé nếu suất/vé còn hợp lệ. Hoàn một phần qua nhiều khoản thu cần đối soát, không tự mở lại toàn bộ vé.

Rạp thay đổi/hủy lịch là nhánh ngoại lệ riêng, không cho khách tự gắn cờ sự cố để vượt thời hạn. Mô hình hoàn phần dịch vụ chưa cung cấp theo công thức trên; trường hợp đã sử dụng một phần và tranh chấp phải xử lý riêng, chưa đưa vào tự động hóa MVP.

### 11.6 Ảnh hưởng BPMN và các bước Design

- Giữ các nút kiểm tra rule, giữ ghế, thu chênh lệch, hoàn tiền và check-in; BR5/BR6 được cụ thể hóa bằng chính sách trên.
- BPMN hiện tại chưa biểu diễn đầy đủ phê duyệt của quản lý và chênh lệch âm. Đặc tả Design phải ghi đây là phần bổ sung theo ủy quyền, không nói sơ đồ gốc đã có. Cần lane/quyền quản lý, nhánh duyệt/từ chối, hết hạn chờ duyệt và ba nhánh chênh lệch âm/bằng 0/dương.
- Mã số trong XML đang đọc là 122, 150, 151, 168, 174...; cách viết N122, N150... ở các mục trước là nhãn tham chiếu quy ước của hồ sơ, không phải chuỗi id nguyên gốc trong XML.
- Luồng đổi rẻ hơn dùng trạng thái đổi vé và hoàn chênh lệch riêng; điều này cần được phản ánh trong thiết kế và sơ đồ tương ứng. Tệp draw.io chưa được chỉnh sửa ở lượt này.
- Repo tiếp tục đúng vai trò đã thống nhất: Spec Kit tổ chức đặc tả; NestJS thực thi rule và quyền; PostgreSQL/TypeORM giữ tính nhất quán; React/Next.js hiển thị báo giá, đồng hồ và trạng thái; Vitest/Playwright kiểm tra logic và luồng. Chưa cài đặt hoặc chạy các công cụ trong lượt chốt chính sách này.
- Tiếp theo lập mô hình trạng thái, CSDL, ma trận quyền, API và màn hình theo mục 11. Các quyết định còn mở ở mục 8 tiếp tục được xử lý tại Design; không mặc định toàn bộ thiết kế đã xong.

### 11.7 Tiêu chí kiểm chứng bổ sung

Chưa chạy các kiểm thử sau; đây là đầu vào cho triển khai:

1. 299 giây vẫn giữ ghế, đúng 300 giây hết hạn; tải lại không kéo dài.
2. Đúng 60 phút được nhận; dưới 60 phút bị từ chối; duyệt muộn bị chặn trước thực thi.
3. Hai yêu cầu cùng ghế chỉ một yêu cầu thắng; callback trùng không cấp hai vé.
4. Mỗi BR1–BR7 có ca bị từ chối và lý do cụ thể.
5. Kiểm tra chênh lệch âm/bằng 0/dương và combo chưa nhận/đã nhận theo bảng ví dụ.
6. Khách/nhân viên không thể gọi API duyệt; người lập không tự duyệt; quản lý từ chối phải ghi lý do.
7. Đổi/hoàn và check-in đồng thời không cùng hoàn tất trên một vé.
8. Hoàn timeout vẫn là chờ; callback thành công trùng không hoàn thêm; tổng hoàn kể cả đang chờ không vượt tiền thu.
9. Đổi rẻ hơn hoàn tiền lỗi vẫn giữ đúng vé mới và khoản phải hoàn, không khôi phục vé cũ.
10. Sự cố suất chiếu được quản lý xác nhận có thể miễn hạn; khách không tự tạo quyền miễn hạn.
11. Vé không được chọn trong đơn và combo đã nhận không bị hủy/hoàn nhầm.
12. Yêu cầu hết hạn hoặc bị rút gỡ chặn đúng phạm vi; khi hoàn đã gửi hoặc một phần đã hoàn thì không gỡ chặn trái điều kiện.

