# ĐẠI HỌC BÁCH KHOA HÀ NỘI

## TRƯỜNG CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG

---

# ĐỒ ÁN TỐT NGHIỆP

## XÂY DỰNG PHẦN MỀM QUẢN LÝ KHEN THƯỞNG TẠI HỌC VIỆN KHOA HỌC QUÂN SỰ

---

**Sinh viên thực hiện:** [Họ và tên]
**Mã số sinh viên:** [MSSV]
**Email:** [email@sis.hust.edu.vn]
**Lớp / Khóa:** [Lớp — Khóa]
**Chương trình đào tạo:** Khoa học máy tính
**Giảng viên hướng dẫn:** ThS. Lê Đức Trung _______________ (Chữ ký)

**Hà Nội, [tháng]/[năm]**

---

# Lời cảm ơn

> _Phần này em viết riêng theo trải nghiệm cá nhân — KHÔNG copy mẫu. Gợi ý nội dung:_
>
> Đầu đoạn cảm ơn Trường ĐHBKHN, Khoa CNTT, các thầy cô đã dạy trong 4 năm. Đoạn giữa cảm ơn ThS. Lê Đức Trung đã hướng dẫn đề tài, hỗ trợ phương pháp luận và phản biện. Đoạn cuối cảm ơn gia đình, bạn bè đã đồng hành. Ký tên cuối trang.
>
> Văn phong trang trọng, dùng đại từ "em". Độ dài ~10–15 dòng (1 đoạn lớn hoặc 3 đoạn ngắn).
>
> **Tránh** các cụm cố định như "Trước hết, em xin gửi lời cảm ơn chân thành...", "Đặc biệt, em xin gửi lời biết ơn sâu sắc..." (đã có ở mẫu, tool plagiarism dễ bắt).

---

# Tóm tắt nội dung đồ án

**Đoạn 1 — Bối cảnh đặc thù.** Công tác thi đua, khen thưởng tại các đơn vị thuộc Bộ Quốc phòng tuân thủ Luật Thi đua, Khen thưởng số 06/2022/QH15 cùng các nghị định, thông tư hướng dẫn ban hành kèm theo, đồng thời được cụ thể hoá bởi các văn bản chỉ đạo nội bộ như Nghị quyết số 1658/NQ-QUTW ngày 20/12/2022 của Quân uỷ Trung ương về khoa học, công nghệ, đổi mới sáng tạo và Nghị quyết số 1405/NQ-ĐU ngày 11/4/2023 của Đảng uỷ Học viện Khoa học Quân sự. Tại Học viện, riêng nhóm khen thưởng cá nhân hằng năm bao gồm chuỗi ba cấp Bằng khen Bộ Quốc phòng (BKBQP), Chiến sĩ thi đua toàn quân (CSTĐTQ) và Bằng khen Thủ tướng Chính phủ (BKTTCP) — mỗi cấp có chu kỳ trượt khác nhau (2, 3 và 7 năm) và yêu cầu đối chiếu nhiều cờ trong cửa sổ thời gian, làm cho việc xét chọn thủ công trên Excel rất dễ sai sót.

**Đoạn 2 — Mục tiêu đồ án.** Đồ án xây dựng phần mềm web hỗ trợ Phòng Chính trị Học viện quản lý toàn bộ vòng đời của bảy nhóm khen thưởng (cá nhân hằng năm, đơn vị hằng năm, niên hạn, cống hiến, kỷ niệm chương, quân kỳ quyết thắng, nghiên cứu khoa học), bao quát từ tạo đề xuất, kiểm tra điều kiện chuỗi tự động, phê duyệt, lưu vết tới xuất quyết định. Phần mềm hướng tới rút ngắn thời gian xét điều kiện từ vài chục phút trên Excel xuống dưới một giây cho mỗi quân nhân, đồng thời ghi nhật ký đầy đủ phục vụ kiểm tra hậu kiểm.

**Đoạn 3 — Hướng tiếp cận và kết quả.** Hệ thống được triển khai dưới dạng ứng dụng web vận hành trên mạng nội bộ (LAN) của Học viện, với phần frontend dùng Next.js 14 (App Router) và phần backend dùng Express + TypeScript trên cơ sở dữ liệu PostgreSQL truy cập qua Prisma ORM. Toàn bộ quy tắc xét chuỗi được trừu tượng hoá thành các đối tượng cấu hình (`ChainAwardConfig`) cho phép thêm tier mới mà không cần sửa mã nguồn xét điều kiện. Sản phẩm bao gồm 23 model dữ liệu, hơn 870 ca kiểm thử đơn vị (phủ rule chuỗi cá nhân và đơn vị) và 4 cấp phân quyền theo đặc thù quân sự (SuperAdmin, Admin, Manager, User).

**Sinh viên thực hiện**

_(Ký và ghi rõ họ tên)_

---

# Mục lục

- [Lời cảm ơn](#lời-cảm-ơn)
- [Tóm tắt nội dung đồ án](#tóm-tắt-nội-dung-đồ-án)
- [Mục lục](#mục-lục)
- [Danh mục hình vẽ](#danh-mục-hình-vẽ)
- [Danh mục bảng biểu](#danh-mục-bảng-biểu)
- [Danh mục thuật ngữ và viết tắt](#danh-mục-thuật-ngữ-và-viết-tắt)
- [**Chương 1. Giới thiệu đề tài**](#chương-1-giới-thiệu-đề-tài)
  - [1.1 Đặt vấn đề](#11-đặt-vấn-đề)
  - [1.2 Mục tiêu và phạm vi đề tài](#12-mục-tiêu-và-phạm-vi-đề-tài)
  - [1.3 Định hướng giải pháp](#13-định-hướng-giải-pháp)
  - [1.4 Bố cục đồ án](#14-bố-cục-đồ-án)
- [**Chương 2. Khảo sát và phân tích yêu cầu**](#chương-2-khảo-sát-và-phân-tích-yêu-cầu)
  - 2.1 Khảo sát hiện trạng
  - 2.2 Tổng quan chức năng
  - 2.3 Đặc tả use case chi tiết
  - 2.4 Yêu cầu phi chức năng
- [**Chương 3. Công nghệ sử dụng**](#chương-3-công-nghệ-sử-dụng)
  - 3.1 Next.js 14 — Framework frontend
  - 3.2 TypeScript + Express — Backend
  - 3.3 PostgreSQL + Prisma ORM
  - 3.4 Ant Design + Tailwind CSS + shadcn/ui
  - 3.5 Socket.IO — Real-time
  - 3.6 JWT (Access + Refresh)
  - 3.7 Joi & Zod — Validation hai phía
  - 3.8 Jest — Khuôn khổ kiểm thử
  - 3.9 ExcelJS — Nhập/xuất Excel
- [**Chương 4. Thiết kế, triển khai và đánh giá hệ thống**](#chương-4-thiết-kế-triển-khai-và-đánh-giá-hệ-thống)
  - 4.1 Thiết kế kiến trúc
  - 4.2 Thiết kế chi tiết
  - 4.3 Xây dựng ứng dụng
  - 4.4 Kiểm thử
  - 4.5 Triển khai
- [**Chương 5. Các giải pháp và đóng góp nổi bật**](#chương-5-các-giải-pháp-và-đóng-góp-nổi-bật)
  - 5.1 Tự động hóa kiểm tra điều kiện chuỗi danh hiệu
  - 5.2 Quy trình đề xuất–phê duyệt số hóa kèm nhật ký kiểm toán
  - 5.3 Tính lại tổng thể và gợi ý chủ động
  - 5.4 Nhập liệu Excel hàng loạt có giao dịch và xác thực
  - 5.5 Phân quyền theo cây đơn vị và sao lưu định kỳ
- [**Chương 6. Kết luận và hướng phát triển**](#chương-6-kết-luận-và-hướng-phát-triển)
  - 6.1 Kết luận
  - 6.2 Hướng phát triển
- [Tài liệu tham khảo](#tài-liệu-tham-khảo)
- [Phụ lục A. Toàn văn schema cơ sở dữ liệu](#phụ-lục-a-toàn-văn-schema-cơ-sở-dữ-liệu)
- [Phụ lục B. Danh sách điểm cuối API](#phụ-lục-b-danh-sách-điểm-cuối-api)
- [Phụ lục C. Hướng dẫn sử dụng theo vai trò](#phụ-lục-c-hướng-dẫn-sử-dụng-theo-vai-trò)
- [Phụ lục D. Báo cáo kết quả kiểm thử](#phụ-lục-d-báo-cáo-kết-quả-kiểm-thử)

---

# Danh mục hình vẽ

> _Khi convert sang LaTeX sẽ tự sinh từ `\listoffigures`. Bảng dưới chỉ mang tính tham chiếu khi review bản Markdown._

| Hình | Tên | Chương |
|---|---|---|
| 2.1 | Sơ đồ use case tổng quát hệ thống PM QLKT | 2 |
| 2.2 – 2.14 | Sơ đồ use case phân rã 13 nhóm chức năng | 2 |
| 2.15 – 2.23 | Sơ đồ hoạt động cho 9 quy trình nghiệp vụ chính | 2 |
| 4.1 | Sơ đồ kiến trúc ba tầng FE — BE — DB | 4 |
| 4.2 – 4.3 | Layered architecture tại backend | 4 |
| 4.4 – 4.7 | Sơ đồ gói (package) backend và frontend | 4 |
| 4.8 – 4.12 | Class diagram cho 5 module nghiệp vụ trọng yếu | 4 |
| 4.13 – 4.19 | Sequence diagram cho 7 luồng quan trọng | 4 |
| 4.20 – 4.25 | ERD tổng thể và 5 ERD phân module | 4 |
| 4.26 | Deployment diagram (Docker + PM2) | 4 |
| 4.27 – 4.41 | Ảnh chụp giao diện thực tế | 4 |
| 4.42 | Tổng kết kết quả Jest (74/74 suites, 870/870 tests) | 4 |

---

# Danh mục bảng biểu

| Bảng | Tên | Chương |
|---|---|---|
| 2.1 – 2.6 | Đặc tả 6 use case trọng yếu (Đăng nhập, Tạo đề xuất, Phê duyệt, Tính lại, Nhập Excel, Quản lý quân nhân) | 2 |
| 2.7 | Yêu cầu phi chức năng tóm tắt | 2 |
| 3.1 | So sánh ba ORM phổ biến (TypeORM, Sequelize, Prisma) | 3 |
| 4.1 – 4.8 | Mô tả chi tiết schema cho 8 model trọng yếu | 4 |
| 4.9 | Danh sách công cụ và thư viện sử dụng | 4 |
| 4.10 – 4.18 | Bảng kết quả kiểm thử hộp đen cho 9 nhóm chức năng | 4 |
| 4.19 | Bảng kiểm thử tương thích trình duyệt | 4 |

---

# Danh mục thuật ngữ và viết tắt

| Viết tắt | Tiếng Việt / Giải thích |
|---|---|
| BQP | Bộ Quốc phòng |
| QĐNDVN | Quân đội Nhân dân Việt Nam |
| HVKHQS | Học viện Khoa học Quân sự |
| TĐ-KT | Thi đua – Khen thưởng |
| QLKT | Quản lý khen thưởng |
| QN | Quân nhân |
| CQ, ĐV | Cơ quan, đơn vị |
| CQDV | Cơ quan đơn vị (cấp cha) — _định danh kỹ thuật trong mã nguồn_ |
| DVTT | Đơn vị trực thuộc (cấp con thuộc CQDV) — _định danh kỹ thuật_ |
| CSTT | Chiến sĩ tiên tiến (danh hiệu hằng năm cấp dưới CSTĐCS) |
| CSTĐCS | Chiến sĩ thi đua cơ sở — định danh kỹ thuật trong code: `CSTDCS` |
| BKBQP | Bằng khen Bộ Quốc phòng (chu kỳ 2 năm CSTĐCS) |
| CSTĐTQ | Chiến sĩ thi đua toàn quân (chu kỳ 3 năm + 1 BKBQP) — định danh code: `CSTDTQ` |
| BKTTCP | Bằng khen Thủ tướng Chính phủ (chu kỳ 7 năm + 3 BKBQP + 2 CSTĐTQ; cá nhân là một lần duy nhất) |
| ĐVQT | Đơn vị quyết thắng (chuỗi đơn vị tương đương CSTĐCS) |
| HCCSVV | Huy chương Chiến sĩ vẻ vang (niên hạn 10/15/20 năm) |
| HCBVTQ | Huân chương Bảo vệ Tổ quốc (cống hiến) |
| HCQKQT | Huy chương Quân kỳ quyết thắng (25 năm phục vụ) |
| KNC | Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN |
| NCKH | Nghiên cứu khoa học (đề tài, sáng kiến) |
| ĐATN | Đồ án tốt nghiệp |
| ORM | Object-Relational Mapping (ánh xạ đối tượng – quan hệ) |
| JWT | JSON Web Token (RFC 7519) |
| RBAC | Role-Based Access Control (kiểm soát truy cập theo vai trò) |
| API | Application Programming Interface |
| ERD | Entity-Relationship Diagram (sơ đồ thực thể – quan hệ) |

---

# Chương 1. Giới thiệu đề tài

## 1.1 Đặt vấn đề

Công tác thi đua – khen thưởng trong Quân đội Nhân dân Việt Nam được điều chỉnh bởi Luật Thi đua, Khen thưởng số 06/2022/QH15 (sửa đổi từ Luật số 15/2003/QH11), các nghị định hướng dẫn của Chính phủ — trong đó Quyết định số 749/QĐ-TTg ngày 03/6/2020 phê duyệt Chương trình Chuyển đổi số quốc gia ưu tiên ứng dụng công nghệ thông tin trong quản lý hành chính nhà nước, bao gồm cả lĩnh vực quốc phòng — và các thông tư cụ thể hoá của Bộ Quốc phòng. Ở cấp Quân uỷ Trung ương, Nghị quyết số 1658/NQ-QUTW ngày 20/12/2022 nêu rõ định hướng đẩy mạnh khoa học, công nghệ và đổi mới sáng tạo trong toàn quân; tại Học viện, Nghị quyết số 1405/NQ-ĐU ngày 11/4/2023 của Đảng uỷ Học viện Khoa học Quân sự (HVKHQS) đặt nhiệm vụ triển khai dần các phần mềm quản lý nội bộ phục vụ những mảng nghiệp vụ trọng yếu, trong đó có công tác thi đua – khen thưởng. Trong nội bộ HVKHQS, nhiệm vụ cập nhật danh sách quân nhân đủ điều kiện, lập tờ trình, đối chiếu chu kỳ xét và lưu trữ quyết định từ trước tới nay vẫn được tiến hành chủ yếu trên các tệp Microsoft Excel chia sẻ qua mạng nội bộ kèm bản giấy ký xác nhận. Phương thức này phát sinh ba nhóm khó khăn cụ thể.

Thứ nhất, hệ thống danh hiệu có yếu tố **chuỗi** với cửa sổ thời gian trượt phức tạp. Để xét Bằng khen Bộ Quốc phòng (BKBQP), một quân nhân phải duy trì danh hiệu Chiến sĩ thi đua cơ sở (CSTĐCS) liên tục đủ hai năm; xét Chiến sĩ thi đua toàn quân (CSTĐTQ) cần ba năm liên tục đồng thời có ít nhất một BKBQP nằm trong cửa sổ ba năm cuối; và xét Bằng khen Thủ tướng Chính phủ (BKTTCP) cần bảy năm CSTĐCS liên tục cùng đúng ba BKBQP và đúng hai CSTĐTQ trong cửa sổ bảy năm cuối, kèm yêu cầu mỗi năm phải có thành tích nghiên cứu khoa học. Khi rà soát thủ công, cán bộ phải tra chéo nhiều bảng tính để xác định xem một danh hiệu cũ có thực sự nằm trong cửa sổ trượt hay đã rơi ra ngoài, làm chậm tiến độ và tiềm ẩn rủi ro nhầm lẫn.

Thứ hai, hệ thống khen thưởng tại Học viện gồm **bảy nhóm khen thưởng** với nghiệp vụ tách bạch: khen thưởng cá nhân hằng năm, khen thưởng đơn vị hằng năm, niên hạn (Huy chương Chiến sĩ vẻ vang theo mốc 10/15/20 năm phục vụ), cống hiến (Huân chương Bảo vệ Tổ quốc dựa trên thời gian giữ chức vụ theo từng nhóm hệ số), kỷ niệm chương (vì sự nghiệp xây dựng Quân đội nhân dân Việt Nam, một lần duy nhất theo giới tính), Huy chương Quân kỳ quyết thắng (25 năm phục vụ) và thành tích nghiên cứu khoa học. Mỗi nhóm có quy tắc đầu vào, mẫu quyết định và quy trình duyệt riêng, vì vậy duy trì bằng tệp tính rất khó đảm bảo nhất quán giữa các nhóm.

Thứ ba, **dấu vết kiểm toán** của các thao tác trên Excel hầu như không tồn tại. Khi một bản ghi bị chỉnh sửa hoặc xóa, không có cơ chế truy được người thực hiện, mốc thời gian và lý do — gây khó khăn cho công tác hậu kiểm và đối chiếu khi cấp trên yêu cầu. Việc phân quyền truy cập tệp dùng chung cũng chỉ ở mức thư mục, không phản ánh được phân cấp thực tế của Học viện (cấp Phòng, cấp Khoa/Trung tâm, cá nhân quân nhân).

Trước những hạn chế trên, việc xây dựng một phần mềm chuyên dụng cho công tác quản lý khen thưởng tại HVKHQS là cần thiết. Phần mềm phải đảm nhiệm được toàn bộ vòng đời nghiệp vụ, từ nhập dữ liệu lịch sử qua Excel, tự động kiểm tra điều kiện chuỗi, xử lý đề xuất – phê duyệt cho đến xuất quyết định và lưu vết, đồng thời tuân thủ phân quyền nhiều cấp đặc thù môi trường quân sự. Đề tài cấp Học viện mã số ĐTHV/2025-2026/H5-01 ("Xây dựng phần mềm quản lý khen thưởng tại Học viện Khoa học Quân sự") là cơ sở định hướng nghiệp vụ cho đồ án này; phần lớn yêu cầu chức năng và phi chức năng được kế thừa và cụ thể hoá thành các thành phần kỹ thuật trong các chương sau.

## 1.2 Mục tiêu và phạm vi đề tài

**Mục tiêu chính** của đồ án là xây dựng một hệ thống web hỗ trợ Phòng Chính trị Học viện Khoa học Quân sự thực hiện đầy đủ các nhiệm vụ sau:

1. Quản lý danh sách quân nhân, đơn vị (theo cấu trúc cây Cơ quan đơn vị – Đơn vị trực thuộc), chức vụ và lịch sử biến động chức vụ.
2. Cho phép cán bộ Phòng Chính trị tạo các đợt đề xuất khen thưởng cho cả bảy nhóm danh hiệu, hỗ trợ chọn nhanh nhiều quân nhân thông qua lọc theo đơn vị, năm, giới tính, mốc thời gian phục vụ.
3. Tự động kiểm tra điều kiện chuỗi (BKBQP, CSTĐTQ, BKTTCP đối với cá nhân; BKBQP và BKTTCP đối với đơn vị) và sinh thông điệp gợi ý dễ hiểu cho cán bộ.
4. Hỗ trợ quy trình phê duyệt nhiều bước, lưu file quyết định PDF kèm số quyết định, đồng thời ghi nhật ký kiểm toán toàn bộ thao tác mutate.
5. Cung cấp công cụ nhập dữ liệu lịch sử qua Excel có tiền kiểm và giao dịch (transaction) đảm bảo nguyên tử tính, cùng công cụ xuất danh sách khen thưởng theo nhiều tiêu chí.
6. Phân quyền theo bốn cấp tương ứng đặc thù tổ chức: SuperAdmin (bộ phận kỹ thuật và công nghệ thông tin, quản trị hạ tầng và an ninh hệ thống), Admin (Phòng Chính trị Học viện, toàn quyền nghiệp vụ), Manager (cán bộ chỉ huy đơn vị, đề xuất và quản lý quân nhân nội bộ), User (cán bộ – học viên – sĩ quan, tra cứu hồ sơ cá nhân).
7. Hỗ trợ sao lưu cơ sở dữ liệu định kỳ và quản lý nhật ký hệ thống.

**Phạm vi đề tài** giới hạn ở các nhiệm vụ liên quan trực tiếp đến công tác xét khen thưởng. Phần mềm vận hành tập trung trên máy chủ của Học viện và được truy cập qua mạng nội bộ (LAN), không xuất bản ra Internet công cộng nhằm đáp ứng yêu cầu bảo mật đặc thù môi trường quân sự. Đồ án **không bao gồm** các nghiệp vụ sau: chế độ tiền lương và phụ cấp, hồ sơ y tế, đánh giá cán bộ định kỳ, các quy trình hành chính khác. Việc tích hợp với hệ thống quản lý nhân sự tổng thể của Bộ Quốc phòng (nếu có) cũng không nằm trong phạm vi, do hai khía cạnh đó vượt ngoài mục tiêu trọng tâm về khen thưởng.

## 1.3 Định hướng giải pháp

Phần mềm được xây dựng theo mô hình client – server với hai thành phần độc lập triển khai trên cùng một máy chủ vật lý hoặc tách máy.

- **Frontend** dùng Next.js 14 với mô hình App Router, viết bằng TypeScript, sử dụng Ant Design làm thư viện thành phần chính, kết hợp Tailwind CSS cho bố cục linh hoạt và shadcn/ui cho các thành phần đặc biệt.
- **Backend** dùng Express trên Node.js, viết bằng TypeScript, tổ chức theo kiến trúc phân tầng (Route → Middleware → Controller → Service → Repository → Prisma). Lớp Repository được tách riêng giúp giảm sự phụ thuộc trực tiếp vào Prisma Client trong tầng Service, tạo điều kiện thay thế ORM trong tương lai mà không phải viết lại logic nghiệp vụ.
- **Cơ sở dữ liệu** chọn PostgreSQL truy cập qua Prisma ORM. Toàn bộ schema (23 model) đã được mô hình hóa trong tệp `schema.prisma` duy nhất với migration tự động.
- **Xác thực và phân quyền** dùng cặp JSON Web Token (Access Token thời hạn ngắn + Refresh Token có rotation) lưu trữ tại HttpOnly cookie. Bốn vai trò được áp đặt qua middleware `requireRole` chạy trước mỗi endpoint nhạy cảm.
- **Thông báo thời gian thực** sử dụng Socket.IO, chủ yếu thông báo kết quả nhập Excel lớn, biến cố phê duyệt và xóa đề xuất cho người tạo đề xuất, đồng thời báo cho Phòng Chính trị khi có đề xuất mới.
- **Kiểm thử** dùng Jest + ts-jest. Tổng cộng có 74 bộ kiểm thử đơn vị với 870 ca kiểm thử bao phủ rule chuỗi (cá nhân và đơn vị), kịch bản phê duyệt và xếp hạng huy chương.

Quy tắc chuỗi danh hiệu được trừu tượng hóa thành đối tượng cấu hình `ChainAwardConfig` (thuộc tính: mã danh hiệu, số năm chu kỳ, số cờ tiền điều kiện cần thiết, có yêu cầu nghiên cứu khoa học hay không, tính chất trọn đời hay lặp lại, tên cột cờ trong cơ sở dữ liệu, nhãn chuỗi). Hai hằng số `PERSONAL_CHAIN_AWARDS` và `UNIT_CHAIN_AWARDS` chứa danh sách cấu hình tương ứng cho cá nhân và đơn vị. Một hàm xét điều kiện duy nhất `checkChainEligibility` đọc các đối tượng này để kết luận, qua đó việc thêm tier mới chỉ cần bổ sung phần tử vào mảng cấu hình mà không phải sửa logic.

## 1.4 Bố cục đồ án

Phần còn lại của báo cáo được tổ chức thành năm chương theo mô hình quen thuộc cho đồ án tốt nghiệp ngành Khoa học máy tính tại Trường Công nghệ Thông tin và Truyền thông – Đại học Bách Khoa Hà Nội.

**Chương 2 — Khảo sát và phân tích yêu cầu** trình bày kết quả khảo sát thực tế công tác khen thưởng tại Học viện Khoa học Quân sự, xác định các tác nhân tham gia hệ thống, mô tả tổng quan chức năng qua sơ đồ use case và các sơ đồ hoạt động cho những quy trình nghiệp vụ chính (đề xuất – phê duyệt, kiểm tra điều kiện chuỗi, nhập Excel hàng loạt). Phần đặc tả chi tiết sáu use case trọng yếu được trình bày dưới dạng bảng. Cuối cùng, chương đưa ra các yêu cầu phi chức năng về hiệu năng, bảo mật và tính nhất quán.

**Chương 3 — Công nghệ sử dụng** giới thiệu các thành phần công nghệ được lựa chọn cho dự án và lý do chọn từng thành phần trong ngữ cảnh PM QLKT, bao gồm Next.js 14 App Router, Express + TypeScript, PostgreSQL + Prisma, các thư viện giao diện (Ant Design, Tailwind, shadcn/ui), Socket.IO, JWT, Joi, Zod, Jest và ExcelJS.

**Chương 4 — Thiết kế, triển khai và đánh giá hệ thống** đi sâu vào kiến trúc phân tầng của hệ thống, sơ đồ gói cho frontend và backend, sơ đồ lớp cho năm module nghiệp vụ trọng yếu, các sơ đồ tuần tự cho luồng đăng nhập, tạo đề xuất, phê duyệt và tính lại điều kiện chuỗi, thiết kế cơ sở dữ liệu (ERD đầy đủ và mô tả schema), phần xây dựng thực tế kèm các đoạn mã minh họa, kết quả kiểm thử và hướng dẫn triển khai bằng Docker hoặc PM2.

**Chương 5 — Các giải pháp và đóng góp nổi bật** lần lượt phân tích năm điểm khác biệt mà sản phẩm mang lại so với phương thức thủ công hiện tại, mỗi điểm trình bày theo cấu trúc thực trạng – giải pháp – kết quả đo lường định lượng được rút ra từ kiểm thử và dữ liệu mẫu.

**Chương 6 — Kết luận và hướng phát triển** tổng kết các nhiệm vụ đã hoàn thành, các bài học rút ra sau quá trình thực hiện, đồng thời đề xuất bảy hướng phát triển cho phiên bản kế tiếp, bao gồm hỗ trợ các danh hiệu cao hơn BKTTCP, tích hợp ký số quyết định, xây dựng ứng dụng di động cho người dùng cấp USER và mở rộng khả năng phân tích dữ liệu cho cấp Bộ.

---

# Chương 2. Khảo sát và phân tích yêu cầu

## 2.1 Khảo sát hiện trạng

Trước khi triển khai phần mềm chuyên dụng, công tác thi đua – khen thưởng tại Học viện Khoa học Quân sự được tổ chức xoay quanh ba nguồn dữ liệu chính: hồ sơ giấy lưu tại Phòng Chính trị, các tệp Microsoft Excel chia sẻ qua thư mục mạng nội bộ và sổ theo dõi tay của từng đơn vị. Trong các cuộc trao đổi với cán bộ phụ trách thi đua, nhóm thực hiện đồ án ghi nhận một số đặc điểm đáng chú ý.

**Vai trò của các bên tham gia.** Cấp đề xuất đầu tiên thường là cán bộ chỉ huy đơn vị hoặc cán bộ chính trị cấp cơ quan, nắm danh sách quân nhân thuộc phạm vi quản lý và lập danh sách đề nghị theo từng năm hoặc theo các đợt đặc biệt. Cấp xét duyệt là Phòng Chính trị Học viện, kiểm tra điều kiện và lập tờ trình gửi Ban Giám đốc. Cấp ký quyết định là Giám đốc Học viện đối với các danh hiệu thuộc thẩm quyền và là cấp trên (Tổng cục II, Bộ Quốc phòng, Thủ tướng Chính phủ) đối với các danh hiệu vượt thẩm quyền. Quân nhân – đối tượng được khen thưởng – thường tiếp nhận thông tin một cách thụ động qua thông báo bằng văn bản hoặc bảng tin đơn vị.

**Khối lượng dữ liệu.** Khi tổng hợp ngược lại quá khứ, một quân nhân có thể có nhiều bản ghi danh hiệu thuộc các nhóm khác nhau: từ chuỗi danh hiệu hằng năm tích luỹ trong toàn bộ thời gian phục vụ, đến các huy chương niên hạn (10/15/20 năm), kỷ niệm chương, quân kỳ quyết thắng và các khen thưởng đột xuất. Tổng khối lượng bản ghi cho cán bộ trên 25 năm phục vụ có thể lên tới 30–40 bản ghi mỗi quân nhân, nhân với quy mô vài nghìn cán bộ – học viên – sĩ quan, dữ liệu lịch sử cần lưu trữ vào khoảng vài trăm nghìn bản ghi.

**Nhóm khó khăn nổi bật.** Bốn vấn đề được phản ánh nhiều nhất qua khảo sát là (1) tra cứu lịch sử khen thưởng cá nhân tốn thời gian do phải mở nhiều tệp Excel; (2) đối chiếu chuỗi danh hiệu hằng năm theo cửa sổ trượt khó vì rule có nhiều ngoại lệ (chu kỳ lặp lại, BKTTCP cá nhân là một lần duy nhất, BKBQP của chu kỳ trước rơi ra khỏi cửa sổ 3 năm khi xét CSTĐTQ chu kỳ mới); (3) thiếu cơ chế kiểm tra trùng đề xuất khi nhiều cán bộ cùng phụ trách một đơn vị; và (4) nhật ký kiểm toán hầu như không có, dẫn tới khó truy hồi khi phát hiện sai sót.

Từ kết quả khảo sát, có thể khẳng định các đặc thù nghiệp vụ trên đòi hỏi một hệ thống có khả năng (a) lưu trữ tập trung và liên kết được các loại bản ghi, (b) tự động kiểm tra điều kiện theo các quy tắc đã được mã hoá, (c) phân quyền theo cây tổ chức của Học viện và (d) sinh nhật ký kiểm toán cho mọi thao tác có khả năng làm thay đổi dữ liệu nghiệp vụ.

## 2.2 Tổng quan chức năng

Phần này trình bày cấu trúc tác nhân (actor) và các nhóm chức năng chính của hệ thống thông qua sơ đồ use case tổng quát và các sơ đồ phân rã chi tiết. Toàn bộ sơ đồ được vẽ bằng Mermaid và lưu trữ tại thư mục `docs/diagrams/` trong kho mã nguồn — đảm bảo có thể tái tạo lại bất cứ lúc nào và chỉnh sửa dễ dàng theo yêu cầu nghiệp vụ thay đổi.

### 2.2.1 Sơ đồ use case tổng quát

Hệ thống có bốn nhóm tác nhân tương ứng với bốn cấp phân quyền nội bộ:

- **SuperAdmin** đại diện cho bộ phận kỹ thuật và công nghệ thông tin. Nhóm này không tham gia trực tiếp vào nghiệp vụ xét khen thưởng mà tập trung vào quản trị hạ tầng, sao lưu – khôi phục dữ liệu, theo dõi nhật ký an ninh và quản trị các tài khoản cấp quản trị.
- **Admin** là cán bộ thuộc Phòng Chính trị Học viện. Nhóm này có toàn quyền nghiệp vụ: tạo và phê duyệt đề xuất, quản lý quân nhân – đơn vị – chức vụ, gắn số quyết định, tải lên tệp PDF quyết định và xuất các báo cáo.
- **Manager** là cán bộ chỉ huy hoặc cán bộ chính trị cấp đơn vị, phụ trách lập đề xuất khen thưởng cho phạm vi đơn vị mình quản lý và theo dõi trạng thái phê duyệt. Manager có thể thao tác trên dữ liệu quân nhân thuộc đơn vị nhưng không thể chuyển quân nhân giữa các đơn vị (chức năng này chỉ thuộc Admin).
- **User** là cán bộ – học viên – sĩ quan đăng nhập để tra cứu hồ sơ khen thưởng cá nhân, xem các chu kỳ chuỗi đang đến mốc đề nghị và nhận thông báo về kết quả phê duyệt.

Hệ thống cung cấp 15 nhóm chức năng chính: Đăng nhập, Quản lý tài khoản, Quản lý quân nhân, Quản lý đơn vị, Khen thưởng hằng năm, Khen thưởng niên hạn, Khen thưởng cống hiến, Khen thưởng thành tích khoa học, Khen thưởng đột xuất, Đề xuất khen thưởng, Kiểm tra điều kiện và gợi ý, Thông báo thời gian thực, Xem nhật ký hệ thống, Sao lưu và khôi phục, Báo cáo và thống kê. Mối quan hệ giữa từng tác nhân và các nhóm chức năng được thể hiện ở Hình 2.1.

> **Hình 2.1**: Sơ đồ use case tổng quát hệ thống PM QLKT — xem khối Mermaid `A1.1` tại `docs/diagrams/01-use-case.md`. Khi xuất bản LaTeX, render PNG/SVG đặt tại `report/images/Hinh-2-1-use-case-tong-quat.png`.

### 2.2.2 Phân rã: Quản lý quân nhân và lịch sử chức vụ

Quản lý quân nhân là một trong những module tương tác cao nhất của hệ thống. Quân nhân là thực thể trung tâm liên kết tới gần như mọi bảng nghiệp vụ khác (danh hiệu hằng năm, niên hạn, cống hiến, thành tích khoa học, đột xuất, đề xuất). Phân rã chức năng gồm các use case con:

- **Tạo mới quân nhân** — chỉ Admin có quyền. Yêu cầu nhập tối thiểu họ tên, số CCCD, ngày sinh, giới tính, ngày nhập ngũ, đơn vị (CQDV hoặc DVTT), chức vụ. Hệ thống kiểm tra trùng CCCD trước khi ghi vào cơ sở dữ liệu.
- **Cập nhật thông tin** — Admin sửa được toàn bộ; Manager chỉ sửa được các trường ngoại trừ đơn vị và CCCD; bản thân quân nhân (User) chỉ sửa được địa chỉ, số điện thoại, email.
- **Chuyển đơn vị** — chỉ Admin. Khi chuyển, hệ thống cập nhật số lượng quân nhân của đơn vị cũ (giảm 1) và đơn vị mới (tăng 1) trong cùng một transaction. Quan trọng là toàn bộ lịch sử khen thưởng được giữ nguyên — không tạo bản ghi mới hay xoá bản ghi cũ.
- **Quản lý lịch sử chức vụ** — Admin nhập danh sách các giai đoạn quân nhân giữ chức vụ với hệ số tương ứng. Dữ liệu này là đầu vào cho thuật toán xét khen thưởng cống hiến (HCBVTQ).
- **Nhập / xuất Excel** — cho phép tải lên hoặc tải xuống danh sách quân nhân theo định dạng quy chuẩn. Thao tác nhập đi qua hai bước (xem trước, xác nhận) sẽ được mô tả chi tiết tại 2.2.7.

> **Hình 2.2**: Sơ đồ use case phân rã chức năng Quản lý quân nhân — xem khối `A1.2` tại `docs/diagrams/01-use-case.md`.

### 2.2.3 Phân rã: Quản lý đơn vị và chức vụ

Cấu trúc tổ chức của Học viện được mô hình hoá thành cây hai cấp. Bảng `CoQuanDonVi` (CQDV) lưu các đơn vị cấp cha; bảng `DonViTrucThuoc` (DVTT) lưu các đơn vị con thuộc một CQDV duy nhất. Khi nhập thông tin quân nhân, một trong hai trường `co_quan_don_vi_id` hoặc `don_vi_truc_thuoc_id` sẽ được điền — không bao giờ điền cả hai cùng lúc.

Module quản lý đơn vị bao gồm các use case con: tạo mới CQDV, tạo mới DVTT thuộc một CQDV cụ thể, cập nhật thông tin, xoá (chỉ thực hiện được khi không còn quân nhân nào thuộc đơn vị) và xem cây tổ chức dưới dạng tree-view trên giao diện. Bảng `ChucVu` quản lý danh mục chức vụ kèm hệ số `he_so_chuc_vu` (giá trị từ 0.5 đến 1.2 tuỳ chức danh) và liên kết tới CQDV hoặc DVTT mà chức vụ đó thuộc về. Hệ số chức vụ là dữ liệu đầu vào trực tiếp cho thuật toán tính tháng cống hiến theo nhóm hệ số 0.7 / 0.8 / 0.9–1.0.

> **Hình 2.3**: Sơ đồ use case phân rã chức năng Quản lý đơn vị và chức vụ — xem khối `A1.3` tại `docs/diagrams/01-use-case.md`.

### 2.2.4 Phân rã: Đề xuất khen thưởng theo bảy nhóm

Đề xuất khen thưởng là điểm khởi đầu của mọi quy trình ghi nhận thành tích. Hệ thống hỗ trợ bảy loại đề xuất riêng biệt, mỗi loại có dữ liệu đầu vào và quy tắc xét điều kiện khác nhau:

1. **Cá nhân hằng năm** (`CA_NHAN_HANG_NAM`): danh hiệu CSTT, CSTĐCS, BKBQP, CSTĐTQ, BKTTCP cộng các cờ tương ứng và số quyết định cấp cao hơn.
2. **Đơn vị hằng năm** (`DON_VI_HANG_NAM`): danh hiệu ĐVQT, ĐVTT cộng các cờ BKBQP / BKTTCP cấp đơn vị.
3. **Niên hạn** (`NIEN_HAN`): Huy chương Chiến sĩ vẻ vang theo các mốc 10 / 15 / 20 năm phục vụ tích luỹ tới năm xét.
4. **Cống hiến** (`CONG_HIEN`): Huân chương Bảo vệ Tổ quốc dựa trên thời gian giữ chức vụ thuộc các nhóm hệ số khác nhau.
5. **Kỷ niệm chương** (`KNC_VSNXD_QDNDVN`): Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN — một lần duy nhất theo giới tính (nam 25 năm phục vụ, nữ 20 năm).
6. **Quân kỳ quyết thắng** (`HC_QKQT`): Huy chương Quân kỳ quyết thắng cho cán bộ phục vụ đủ 25 năm.
7. **Thành tích khoa học** (`NCKH`): Khen thưởng đề tài khoa học hoặc sáng kiến kinh nghiệm.

Tất cả bảy loại đều dùng chung một tầng dữ liệu là bảng `BangDeXuat` với các trường JSON `data_danh_hieu`, `data_thanh_tich`, `data_nien_han`, `data_cong_hien` để lưu chi tiết theo từng loại. Việc dùng JSON ở đây có chủ đích: cho phép schema linh hoạt theo từng loại đề xuất mà không phải tạo nhiều bảng riêng cho mỗi loại. Mỗi loại đề xuất được gắn với một đối tượng cài đặt giao diện `ProposalStrategy` chịu trách nhiệm xây dựng, kiểm tra và nhập dữ liệu; chi tiết được trình bày tại Chương 4.

Quy trình tạo đề xuất gồm ba bước trên giao diện: chọn loại đề xuất và năm/tháng → chọn quân nhân hoặc đơn vị → thiết lập danh hiệu cụ thể cho từng đối tượng. Bước hai có thể chọn nhiều quân nhân cùng lúc thông qua bộ lọc theo đơn vị, năm sinh, giới tính, mốc thời gian phục vụ.

> **Hình 2.4**: Sơ đồ use case phân rã chức năng Đề xuất khen thưởng — xem khối `A1.4` tại `docs/diagrams/01-use-case.md`.

### 2.2.5 Phân rã: Chuỗi danh hiệu hằng năm cá nhân

Đây là module nghiệp vụ phức tạp nhất của hệ thống do có quy tắc chuỗi với cửa sổ trượt và có một danh hiệu lifetime. Cấu hình chuỗi cá nhân gồm ba tier (BKBQP, CSTĐTQ, BKTTCP) tương ứng ba phần tử trong mảng `PERSONAL_CHAIN_AWARDS`:

- **BKBQP** có chu kỳ 2 năm (yêu cầu 2 năm CSTĐCS liên tục), không yêu cầu cờ tiền điều kiện, có yêu cầu thành tích NCKH mỗi năm, không phải lifetime (có thể nhận lại sau mỗi chu kỳ 2 năm).
- **CSTĐTQ** có chu kỳ 3 năm, yêu cầu đúng 1 BKBQP nằm trong cửa sổ trượt 3 năm gần nhất tính từ năm trước năm xét, yêu cầu NCKH mỗi năm, không phải lifetime.
- **BKTTCP** có chu kỳ 7 năm, yêu cầu đúng 3 BKBQP và đúng 2 CSTĐTQ trong cửa sổ trượt 7 năm cuối, yêu cầu NCKH mỗi năm, **là lifetime** đối với cá nhân (mỗi quân nhân chỉ nhận một lần trong toàn bộ thời gian phục vụ).

Use case chính của module này là **Kiểm tra điều kiện và gợi ý**: hệ thống tự tính toán dựa trên dữ liệu lịch sử và sinh ra hai loại thông tin cho mỗi quân nhân: (a) danh sách các tier đủ điều kiện đề nghị trong năm hiện tại, kèm thông điệp giải thích; (b) số liệu cửa sổ trượt (số BKBQP đã có trong cửa sổ 3 năm hoặc 7 năm, số CSTĐTQ đã có trong cửa sổ 7 năm, độ dài chuỗi CSTĐCS hiện tại). Cán bộ Phòng Chính trị có thể tham khảo gợi ý này để chốt danh sách đề xuất.

Use case phụ là **Tính lại tổng thể**: khi một bản ghi danh hiệu hằng năm cũ được chỉnh sửa hoặc xoá, hệ thống có thể chạy lại thuật toán cho toàn bộ quân nhân hoặc một quân nhân riêng lẻ, đảm bảo dữ liệu suy diễn (`HoSoHangNam`) luôn nhất quán với dữ liệu nguồn (`DanhHieuHangNam`).

> **Hình 2.5**: Sơ đồ use case phân rã chức năng Chuỗi danh hiệu hằng năm cá nhân — xem khối `A1.5` tại `docs/diagrams/01-use-case.md`.

### 2.2.6 Phân rã: Chuỗi danh hiệu hằng năm đơn vị

Chuỗi đơn vị có cấu trúc đơn giản hơn cá nhân do không có tier CSTĐTQ và không yêu cầu thành tích NCKH. Cấu hình `UNIT_CHAIN_AWARDS` chỉ gồm hai tier:

- **BKBQP đơn vị** chu kỳ 2 năm, yêu cầu 2 năm ĐVQT liên tục, không có cờ tiền điều kiện, không phải lifetime.
- **BKTTCP đơn vị** chu kỳ 7 năm, yêu cầu ít nhất 3 BKBQP đơn vị trong cửa sổ trượt 7 năm cuối, không phải lifetime (đơn vị có thể nhận lại sau mỗi chu kỳ 7 năm).

Khác biệt quan trọng với chuỗi cá nhân là điều kiện cờ "ít nhất 3 BKBQP" thay vì "đúng 3 BKBQP". Lý do là một đơn vị có thể nhận lại BKTTCP sau mỗi chu kỳ 7 năm, nên việc đếm cờ trong cửa sổ trượt cần linh hoạt hơn so với danh hiệu lifetime của cá nhân.

> **Hình 2.6**: Sơ đồ use case phân rã chức năng Chuỗi danh hiệu hằng năm đơn vị — xem khối `A1.6` tại `docs/diagrams/01-use-case.md`.

### 2.2.7 Phân rã: Nhập và xuất dữ liệu Excel

Học viện có lượng dữ liệu lịch sử lớn được lưu trên Excel trước khi triển khai phần mềm; do đó chức năng nhập Excel hàng loạt là cầu nối quan trọng giúp hệ thống tiếp nhận dữ liệu cũ mà không phải nhập tay từng bản ghi. Quy trình gồm bốn use case con:

- **Tải tệp mẫu** — hệ thống sinh tệp Excel có cấu trúc cột chuẩn theo từng loại nghiệp vụ (quân nhân, danh hiệu hằng năm, lịch sử chức vụ, niên hạn, ...) cùng các Data Validation rule cho phép chọn từ danh sách thả xuống ngay trong tệp.
- **Xem trước** — sau khi cán bộ điền dữ liệu và tải tệp lên, hệ thống đọc nội dung từng dòng, đối chiếu với schema Joi và các quy tắc nghiệp vụ, sau đó hiển thị kết quả gồm danh sách dòng hợp lệ và danh sách dòng có lỗi (kèm chỉ số dòng và mô tả lỗi). Bước này không ghi vào cơ sở dữ liệu.
- **Xác nhận** — cán bộ kiểm tra danh sách hợp lệ rồi xác nhận. Hệ thống mở một transaction Prisma, ghi tuần tự từng dòng; nếu xảy ra lỗi tại bất kỳ dòng nào, toàn bộ thao tác được hủy bỏ và cơ sở dữ liệu giữ nguyên trạng thái trước khi nhập.
- **Xuất danh sách** — cho phép xuất kết quả khen thưởng theo nhiều tiêu chí (theo năm, theo đơn vị, theo loại danh hiệu) ra tệp Excel có định dạng phù hợp với mẫu báo cáo nội bộ của Học viện.

> **Hình 2.7**: Sơ đồ use case phân rã chức năng Nhập – xuất Excel — xem khối `A1.7` tại `docs/diagrams/01-use-case.md`.

### 2.2.8 Phân rã: Quản trị hệ thống

Module quản trị bao quát các chức năng nền tảng phục vụ vận hành hệ thống. Bao gồm:

- **Quản lý tài khoản** — SuperAdmin tạo tài khoản Admin; Admin tạo tài khoản Manager và User; mỗi tài khoản gắn với một quân nhân duy nhất qua khoá ngoại `quan_nhan_id`.
- **Đặt lại mật khẩu** — Admin có thể đặt lại mật khẩu cho Manager / User về giá trị mặc định.
- **Nhật ký hệ thống** (`SystemLog`) — ghi lại mọi thao tác thay đổi dữ liệu với metadata gồm thời điểm, người thực hiện, loại tài nguyên, mã định danh tài nguyên, mô tả thao tác và payload trước – sau khi thay đổi.
- **Sao lưu và khôi phục** — SuperAdmin cấu hình lịch sao lưu định kỳ qua khu vực DevZone; hệ thống dùng `pg_dump` sinh tệp SQL và lưu tại thư mục `backups/`. Thao tác khôi phục cũng được thực hiện qua giao diện này.
- **Cấu hình hệ thống** (`SystemSetting`) — bật/tắt các cờ tính năng (feature flag), ví dụ `allow_notify_import` cho phép gửi thông báo khi nhập Excel hàng loạt.

Tất cả các thao tác trong module quản trị đều có lưu nhật ký riêng để đảm bảo trách nhiệm cá nhân và truy hồi.

> **Hình 2.8**: Sơ đồ use case phân rã chức năng Quản trị hệ thống — xem khối `A1.8` tại `docs/diagrams/01-use-case.md`.

### 2.2.9 Quy trình nghiệp vụ — ba luồng quan trọng

Bên cạnh sơ đồ use case, ba quy trình nghiệp vụ phức tạp nhất được mô hình hoá thêm bằng sơ đồ hoạt động (activity diagram) để làm rõ luồng xử lý từng bước.

**Quy trình A — Đề xuất → Phê duyệt một đợt khen thưởng** (Hình 2.15). Manager chọn loại đề xuất và năm xét, hệ thống lọc danh sách quân nhân/đơn vị thuộc phạm vi quản lý. Manager chọn các đối tượng đủ điều kiện, thiết lập danh hiệu cụ thể và bấm gửi đề xuất. Hệ thống lưu vào bảng `BangDeXuat` ở trạng thái `PENDING`, đồng thời gửi thông báo realtime tới các Admin. Admin mở danh sách đề xuất chờ duyệt, kiểm tra lại từng đối tượng, có thể chỉnh sửa danh hiệu trước khi phê duyệt. Khi phê duyệt, hệ thống mở transaction để (a) đổi trạng thái đề xuất sang `APPROVED`, (b) ghi các bản ghi danh hiệu/khen thưởng vào bảng tương ứng (như `DanhHieuHangNam`, `KhenThuongHCCSVV`, ...), (c) gắn số quyết định và đường dẫn tệp PDF, (d) ghi nhật ký kiểm toán, (e) gửi thông báo tới Manager đã đề xuất và (f) tính lại các hồ sơ suy diễn liên quan.

**Quy trình B — Tính điều kiện chuỗi cho một quân nhân** (Hình 2.16). Khi cán bộ truy cập trang hồ sơ của một quân nhân, hệ thống nạp toàn bộ bản ghi `DanhHieuHangNam` của quân nhân đó, sắp xếp giảm dần theo năm và chạy hàm `computeChainContext`. Hàm này tính ra ba chỉ số chính: (a) độ dài chuỗi CSTĐCS hiện tại (`streakCstdcs`), (b) năm gần nhất có cờ BKBQP / CSTĐTQ / BKTTCP, (c) số cờ trong cửa sổ trượt tương ứng (3 năm cho CSTĐTQ, 7 năm cho BKTTCP). Sau đó với mỗi tier trong `PERSONAL_CHAIN_AWARDS`, hàm `checkChainEligibility` đối chiếu số liệu thực tế với cấu hình tier và trả về kết quả `eligible: boolean` kèm thông điệp `reason` bằng tiếng Việt.

**Quy trình C — Nhập tệp Excel hàng loạt** (Hình 2.17). Cán bộ Admin tải lên tệp Excel chứa danh sách bản ghi cần nhập. Hệ thống đọc tệp ở backend, tách thành các sheet (vd: `QuanNhan`, `DanhHieuHangNam`, `ThanhTichKhoaHoc`) và đọc từng dòng. Mỗi dòng được kiểm tra qua schema Joi và các quy tắc nghiệp vụ liên quan (vd: CCCD không được trùng, đơn vị phải tồn tại). Các dòng hợp lệ và lỗi được tổng hợp vào kết quả `ImportPreview` trả về frontend. Cán bộ xem trước, đối chiếu, có thể quay lại sửa tệp Excel rồi tải lên lại. Khi xác nhận, backend mở transaction Prisma, ghi tuần tự các dòng hợp lệ; nếu có bất kỳ lỗi nào tại thời điểm ghi, transaction được rollback hoàn toàn.

## 2.3 Đặc tả use case chi tiết

Phần này đặc tả sáu use case trọng yếu của hệ thống dưới dạng bảng theo template UML chuẩn. Cấu trúc mỗi bảng gồm sáu phần: định danh và tên, các tác nhân tham gia, tiền điều kiện cần thoả mãn trước khi thực hiện, luồng sự kiện chính theo từng bước, các luồng thay thế thường gặp và hậu điều kiện sau khi thực hiện thành công. Sáu use case được lựa chọn vì phản ánh đúng các nghiệp vụ phức tạp nhất và có nhiều tương tác giữa các module.

**Bảng 2.1 — Đặc tả use case UC-01 Đăng nhập**

| Mục | Nội dung |
|---|---|
| Tên | Đăng nhập hệ thống |
| ID | UC-01 |
| Tác nhân | SuperAdmin, Admin, Manager, User |
| Tiền điều kiện | Người dùng đã có tài khoản hợp lệ trong bảng `TaiKhoan`; trình duyệt cho phép HttpOnly cookie. |
| Luồng chính | (1) Người dùng truy cập trang `/login`. (2) Nhập tên đăng nhập và mật khẩu. (3) Bấm nút "Đăng nhập". (4) Hệ thống tra cứu tài khoản theo `username`, đối chiếu mật khẩu băm bằng bcrypt. (5) Hệ thống phát hành Access Token (15 phút) và Refresh Token (7 ngày), đặt vào HttpOnly cookie. (6) Chuyển hướng tới trang chủ tương ứng vai trò. |
| Luồng thay thế | (4a) Tài khoản không tồn tại hoặc mật khẩu sai → hiển thị thông báo "Tài khoản hoặc mật khẩu không đúng" mà không tiết lộ vế nào sai. (4b) Tài khoản bị khoá → hiển thị "Tài khoản đã bị tạm khoá, liên hệ quản trị viên". (5a) Sau ba lần sai liên tiếp, áp giới hạn `rateLimiter` 5 phút cho địa chỉ IP. |
| Hậu điều kiện | Phiên đăng nhập được thiết lập; mọi yêu cầu HTTP tiếp theo gửi kèm token được middleware `verifyToken` xác thực; nhật ký đăng nhập được ghi vào `SystemLog` với `action = LOGIN`. |

**Bảng 2.2 — Đặc tả use case UC-02 Tạo mới quân nhân**

| Mục | Nội dung |
|---|---|
| Tên | Tạo mới hồ sơ quân nhân |
| ID | UC-02 |
| Tác nhân | Admin |
| Tiền điều kiện | Đã đăng nhập với vai trò Admin; cây tổ chức (CQDV/DVTT) đã có dữ liệu. |
| Luồng chính | (1) Admin truy cập "Quản lý quân nhân" → bấm "Thêm mới". (2) Điền các trường bắt buộc (họ tên, CCCD, ngày sinh, giới tính, ngày nhập ngũ, đơn vị, chức vụ). (3) Bấm "Lưu". (4) Frontend xác thực schema Zod; backend xác thực schema Joi. (5) Backend kiểm tra trùng CCCD trong bảng `QuanNhan`. (6) Ghi bản ghi mới và cập nhật bộ đếm `so_luong` của đơn vị. (7) Trả về kết quả thành công, frontend cập nhật bảng danh sách. |
| Luồng thay thế | (5a) CCCD đã tồn tại → backend trả về lỗi 409 với message "Số CCCD đã tồn tại trong hệ thống". (4a) Một trường bắt buộc bị thiếu → frontend chặn ngay tại form trước khi gọi API. (6a) Đơn vị được chọn không tồn tại (do bị xoá song song) → backend trả về lỗi 404 và rollback transaction. |
| Hậu điều kiện | Bản ghi mới có mặt trong `QuanNhan`; số lượng quân nhân của đơn vị tăng 1; nhật ký `action = CREATE, resource = personnel` được ghi với payload chứa CCCD và họ tên. |

**Bảng 2.3 — Đặc tả use case UC-03 Tạo đề xuất khen thưởng**

| Mục | Nội dung |
|---|---|
| Tên | Tạo đề xuất khen thưởng cho một đợt |
| ID | UC-03 |
| Tác nhân | Admin, Manager |
| Tiền điều kiện | Đã đăng nhập; có ít nhất một quân nhân thuộc phạm vi quản lý của Manager (nếu là Manager). |
| Luồng chính | (1) Truy cập "Đề xuất khen thưởng" → "Tạo đề xuất mới". (2) Bước 1: chọn loại đề xuất (1 trong 7 loại) và nhập năm/tháng xét. (3) Bước 2: hệ thống lọc và hiển thị danh sách quân nhân hoặc đơn vị thuộc phạm vi quản lý phù hợp với loại đề xuất; người dùng tích chọn các đối tượng. (4) Bước 3: thiết lập danh hiệu cụ thể cho từng đối tượng (vd: chọn HCCSVV hạng Ba/Nhì/Nhất); hệ thống có thể tự gợi ý dựa trên dữ liệu lịch sử. (5) Tải lên các tệp đính kèm nếu có. (6) Bấm "Gửi đề xuất". (7) Backend xác thực dữ liệu, tạo bản ghi `BangDeXuat` ở trạng thái `PENDING` cùng các trường JSON tương ứng. (8) Phát thông báo realtime tới các Admin liên quan. |
| Luồng thay thế | (4a) Có quân nhân không đủ điều kiện trong danh sách (ví dụ chuỗi CSTĐCS chưa đủ 2 năm cho BKBQP) → hệ thống hiển thị cảnh báo nhưng vẫn cho phép gửi nếu Manager chấp nhận trách nhiệm. (3a) Manager chọn quân nhân ngoài phạm vi đơn vị → backend trả lỗi 403. (7a) Có lỗi mạng hoặc backend không phản hồi → frontend lưu nháp ở localStorage để người dùng không mất dữ liệu. |
| Hậu điều kiện | Bản ghi `BangDeXuat` được tạo với trạng thái `PENDING`; thông báo realtime tới Admin; `SystemLog` ghi `action = CREATE, resource = proposals` cùng tóm tắt loại và số lượng đối tượng. |

**Bảng 2.4 — Đặc tả use case UC-04 Phê duyệt đề xuất**

| Mục | Nội dung |
|---|---|
| Tên | Phê duyệt một đề xuất khen thưởng |
| ID | UC-04 |
| Tác nhân | Admin |
| Tiền điều kiện | Đề xuất đang ở trạng thái `PENDING`; Admin có quyền phê duyệt loại đề xuất tương ứng. |
| Luồng chính | (1) Admin mở chi tiết đề xuất từ danh sách "Chờ duyệt". (2) Xem lại danh sách đối tượng và danh hiệu được đề xuất. (3) Có thể chỉnh sửa danh hiệu của một số đối tượng (vd: hạ từ Hạng Nhất xuống Hạng Nhì). (4) Nhập số quyết định và tải lên tệp PDF quyết định. (5) Bấm "Phê duyệt". (6) Backend mở transaction Prisma: chuyển trạng thái đề xuất sang `APPROVED`; ghi các bản ghi danh hiệu/khen thưởng vào bảng tương ứng (`DanhHieuHangNam`, `KhenThuongHCCSVV`, ...); gắn số quyết định; tính lại hồ sơ suy diễn (`HoSoHangNam`, `HoSoNienHan`, `HoSoCongHien`) cho các quân nhân bị ảnh hưởng. (7) Phát thông báo realtime tới Manager đã đề xuất và các quân nhân được khen thưởng. (8) Ghi nhật ký với payload trước–sau khi thay đổi. |
| Luồng thay thế | (5a) Đề xuất bị thay đổi bởi Admin khác cùng lúc → hệ thống dùng lock optimistic, trả về lỗi 409 và yêu cầu tải lại trước khi phê duyệt. (4a) Số quyết định trùng với một quyết định đã có trong `FileQuyetDinh` → backend cảnh báo nhưng cho phép tiếp tục nếu Admin xác nhận. (6a) Có lỗi tại bước ghi danh hiệu (ví dụ vi phạm rule lifetime BKTTCP) → toàn bộ transaction rollback, đề xuất giữ nguyên trạng thái `PENDING`, hiển thị chi tiết lỗi cho Admin. (5b) Admin từ chối thay vì phê duyệt → đổi trạng thái sang `REJECTED` kèm lý do, gửi thông báo tới Manager. |
| Hậu điều kiện | Trạng thái đề xuất là `APPROVED` hoặc `REJECTED`; nếu `APPROVED`, các bản ghi khen thưởng tương ứng đã có mặt trong cơ sở dữ liệu; hồ sơ suy diễn được tính lại; thông báo đã gửi; nhật ký đầy đủ. |

**Bảng 2.5 — Đặc tả use case UC-05 Kiểm tra điều kiện chuỗi và sinh gợi ý**

| Mục | Nội dung |
|---|---|
| Tên | Tính lại hồ sơ hằng năm và sinh gợi ý đề nghị |
| ID | UC-05 |
| Tác nhân | Admin (kích hoạt chủ động); System (tự động sau mỗi lần phê duyệt). |
| Tiền điều kiện | Quân nhân tồn tại; có ít nhất một bản ghi trong `DanhHieuHangNam`. |
| Luồng chính | (1) Hệ thống truy vấn toàn bộ `DanhHieuHangNam` của quân nhân, sắp xếp giảm dần theo `nam`. (2) Gọi hàm `computeChainContext(rows, currentYear)` để dẫn xuất ngữ cảnh chuỗi: độ dài chuỗi CSTĐCS hiện tại, năm gần nhất nhận BKBQP/CSTĐTQ/BKTTCP, số cờ trong cửa sổ trượt 3 năm và 7 năm, năm bị "lỡ đợt" gần nhất nếu có. (3) Với mỗi tier trong `PERSONAL_CHAIN_AWARDS`, gọi `checkChainEligibility(tier, context, hasReceivedLifetime)`. Hàm trả về `{ eligible, reason }` bằng tiếng Việt. (4) Lưu kết quả vào bảng suy diễn `HoSoHangNam` (cập nhật hoặc tạo mới); ghi đè các trường `du_dieu_kien_bkbqp`, `du_dieu_kien_cstdtq`, `du_dieu_kien_bkttcp`, `goi_y`. (5) Trả về kết quả cho frontend hiển thị. |
| Luồng thay thế | (3a) Quân nhân đã nhận BKTTCP → hàm trả về `eligible: false, reason: "Đã có BKTTCP. Phần mềm chưa hỗ trợ các danh hiệu cao hơn BKTTCP, sẽ phát triển trong thời gian tới."` (3b) Chuỗi CSTĐCS chưa đủ chu kỳ → trả về thông điệp gợi ý số năm cần tích luỹ thêm. (3c) Năm hiện tại đúng vào mốc lỡ đợt → trả về thông điệp giải thích cách thức xét lại ở chu kỳ kế tiếp. |
| Hậu điều kiện | `HoSoHangNam` của quân nhân có dữ liệu nhất quán với `DanhHieuHangNam`; trang hồ sơ cá nhân hiển thị các tier đủ điều kiện và thông điệp gợi ý chi tiết. |

**Bảng 2.6 — Đặc tả use case UC-06 Nhập tệp Excel hàng loạt**

| Mục | Nội dung |
|---|---|
| Tên | Nhập danh sách quân nhân hoặc danh hiệu hằng năm từ Excel |
| ID | UC-06 |
| Tác nhân | Admin |
| Tiền điều kiện | Đã có tệp mẫu Excel tải xuống từ hệ thống và điền dữ liệu theo cấu trúc cột chuẩn. |
| Luồng chính | (1) Admin truy cập "Nhập Excel" → chọn loại nghiệp vụ (vd: "Danh hiệu hằng năm"). (2) Tải lên tệp `.xlsx` qua form. (3) Backend đọc tệp bằng ExcelJS, kiểm tra tên các sheet, đọc tuần tự từng dòng. (4) Mỗi dòng được áp schema Joi và các quy tắc nghiệp vụ (vd: CCCD tồn tại trong `QuanNhan`, năm hợp lệ, danh hiệu nằm trong danh mục cho phép). (5) Tổng hợp kết quả thành đối tượng `{ valid: [...], errors: [...] }`. (6) Trả về frontend hiển thị bảng xem trước với chỉ số dòng, lỗi cụ thể, các dòng hợp lệ tô xanh. (7) Admin kiểm tra, nếu đồng ý thì bấm "Xác nhận nhập". (8) Backend mở transaction Prisma, ghi tuần tự các dòng `valid`. (9) Nếu mọi thao tác thành công, commit transaction và phát sự kiện realtime tổng kết. |
| Luồng thay thế | (3a) Tệp không đúng định dạng `.xlsx` hoặc thiếu sheet bắt buộc → trả về lỗi 400 với mô tả cụ thể. (4a) Có dòng lỗi trong giai đoạn xem trước → admin có thể tải tệp xuống, sửa, tải lại — không tiêu tốn thời gian transaction. (8a) Có lỗi xảy ra trong giai đoạn ghi (vd: trùng khoá unique do dữ liệu mới chen vào giữa hai bước) → toàn bộ transaction rollback, hệ thống trả về lỗi với chỉ số dòng gây lỗi. |
| Hậu điều kiện | Các bản ghi trong tệp được ghi vào cơ sở dữ liệu; nhật ký `action = IMPORT` được ghi với payload tổng kết số dòng thành công và số dòng lỗi; thông báo realtime gửi tới Admin khởi tạo. |

## 2.4 Yêu cầu phi chức năng

Bên cạnh các yêu cầu chức năng đã trình bày ở các mục trước, hệ thống cần đáp ứng một số yêu cầu phi chức năng để đảm bảo vận hành ổn định, an toàn và phù hợp với đặc thù môi trường quân sự. Các yêu cầu này được nhóm lại thành ba khía cạnh: hiệu năng và trải nghiệm người dùng, bảo mật, tính nhất quán dữ liệu.

### 2.4.1 Hiệu năng và trải nghiệm người dùng

Hệ thống được thiết kế để vận hành ổn định trong môi trường mạng nội bộ Học viện với khoảng vài chục người dùng đồng thời ở thời điểm cao điểm (đợt xét khen thưởng cuối năm). Các tiêu chí định lượng được đặt ra như sau.

Thời gian phản hồi của các trang chính (trang chủ, danh sách quân nhân, danh sách đề xuất) cần dưới hai giây ở điều kiện kết nối LAN bình thường. Các thao tác phức tạp như tính lại hồ sơ chuỗi cho một quân nhân cần dưới một giây; tính lại tổng thể cho 3000 quân nhân được phép kéo dài đến vài phút nhưng phải có thanh tiến trình hiển thị qua kênh Socket.IO.

Bảng dữ liệu lớn (vd: danh sách toàn bộ quân nhân, danh sách khen thưởng theo năm) được phân trang phía máy chủ với mặc định 20 dòng / trang và giới hạn tối đa 100 dòng / trang. Frontend áp dụng kỹ thuật cập nhật lạc quan (optimistic UI): các thao tác cập nhật trạng thái thường gặp (đánh dấu đã đọc thông báo, tích chọn quân nhân vào đề xuất) thay đổi ngay trên giao diện trước khi backend trả về xác nhận, qua đó giảm cảm giác chờ đợi cho người dùng.

Khu vực dữ liệu thường truy vấn nhưng ít thay đổi (cây CQDV/DVTT, danh mục chức vụ, danh mục danh hiệu) được nạp một lần vào React Context và chia sẻ trong toàn bộ ứng dụng — tránh việc mỗi component tự gọi API riêng dẫn tới yêu cầu trùng lặp.

### 2.4.2 Bảo mật

Bảo mật là yêu cầu được ưu tiên cao nhất do hệ thống lưu trữ dữ liệu liên quan đến cán bộ và sĩ quan trong môi trường quân sự. Bảy nhóm biện pháp được áp dụng song song.

**Thứ nhất — Xác thực bằng JWT có Refresh rotation.** Mỗi phiên đăng nhập tạo ra cặp Access Token (15 phút) và Refresh Token (7 ngày) đặt trong HttpOnly cookie. Khi Access Token hết hạn, frontend gọi điểm cuối `/auth/refresh` để xin token mới; mỗi lần gọi điểm cuối này, backend phát hành Refresh Token mới và đánh dấu Refresh Token cũ hết hiệu lực. Cơ chế này hạn chế nguy cơ một Refresh Token bị đánh cắp vẫn dùng được lâu dài.

**Thứ hai — Băm mật khẩu bằng bcrypt với hệ số chi phí 10.** Mật khẩu trước khi lưu vào bảng `TaiKhoan` không bao giờ được lưu ở dạng văn bản thô. Hệ số 10 được chọn để cân bằng giữa thời gian xác thực (khoảng 80 ms trên máy chủ phát triển) và độ khó tấn công vét cạn nếu cơ sở dữ liệu bị rò rỉ.

**Thứ ba — Phân quyền bốn cấp qua middleware `requireRole`.** Mỗi route nhạy cảm đi qua middleware kiểm tra vai trò của người dùng có nằm trong danh sách cho phép hay không. Phân quyền không chỉ dừng ở vai trò mà còn ở phạm vi quản lý: Manager chỉ truy vấn được dữ liệu của các quân nhân thuộc đơn vị mình quản lý, kiểm soát qua middleware `unitFilter`.

**Thứ tư — Xác thực dữ liệu hai phía.** Frontend dùng Zod để xác thực ngay tại form, ngăn người dùng gửi đi dữ liệu sai định dạng. Backend dùng Joi để xác thực lại tại điểm cuối; kể cả khi frontend bị bỏ qua (vd: tấn công gửi yêu cầu thẳng), backend vẫn từ chối dữ liệu không hợp lệ. Tuỳ chọn `stripUnknown: true` của Joi loại bỏ các trường ngoài schema để tránh người dùng đẩy lén các thuộc tính không được phép.

**Thứ năm — Bảo vệ tầng vận chuyển và tầng ứng dụng.** Toàn bộ kết nối tới server qua HTTPS (TLS 1.2 trở lên) khi triển khai sản xuất. Header bảo mật được áp đặt qua middleware Helmet (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options). CORS cấu hình chặt chẽ chỉ cho phép tên miền của frontend chính. Rate limiter giới hạn 100 yêu cầu / IP / 15 phút cho các điểm cuối nhạy cảm như đăng nhập và đặt lại mật khẩu.

**Thứ sáu — Nhật ký kiểm toán đầy đủ.** Mọi thao tác có thể làm thay đổi dữ liệu nghiệp vụ (CREATE, UPDATE, DELETE, IMPORT, APPROVE, REJECT, LOGIN, LOGOUT, RESET_PASSWORD) đều ghi vào bảng `SystemLog` với metadata gồm thời điểm, mã người thực hiện, vai trò, loại tài nguyên (`resource`), mã định danh tài nguyên (`resource_id`) và mô tả tiếng Việt do hàm builder sinh tự động. Nhật ký liên quan đến `resource = backup` chỉ SuperAdmin xem được; các vai trò thấp hơn không thấy ngay cả tiêu đề.

**Thứ bảy — Sao lưu định kỳ và khôi phục.** Hệ thống tự động chạy `pg_dump` theo lịch cấu hình (mặc định mỗi 24 giờ vào 02:00 sáng) và lưu tệp SQL vào thư mục `backups/`. Mỗi tệp có tên theo mẫu `YYYY-MM-DD_HH-mm-ss.sql`. SuperAdmin có thể tải xuống, xoá hoặc khôi phục từ một tệp sao lưu cụ thể qua khu vực DevZone.

### 2.4.3 Tính nhất quán và chính xác của dữ liệu

Trong nghiệp vụ khen thưởng, một sai lệch nhỏ giữa các bản ghi liên quan có thể dẫn tới quyết định sai (vd: bỏ sót quân nhân đủ điều kiện hoặc đề xuất nhầm chu kỳ). Vì vậy, tính nhất quán dữ liệu được đặt ngang hàng với bảo mật.

**Giao dịch ACID cho mọi thao tác phức tạp.** Các thao tác đụng nhiều bảng được gói trong transaction Prisma. Phê duyệt một đề xuất chứa 50 quân nhân thực hiện 50 lần ghi `DanhHieuHangNam` cộng với cập nhật trạng thái đề xuất, ghi nhật ký, gắn quyết định — toàn bộ trong một transaction để bảo đảm: hoặc tất cả thành công, hoặc cơ sở dữ liệu trở về trạng thái ban đầu nếu một phép ghi gặp lỗi.

**Kiểm tra điều kiện chuỗi ở hai tầng.** Hàm `checkChainEligibility` được gọi cả trong hàm tính lại hồ sơ (`computeEligibilityFlags`) và trong hàm kiểm tra phê duyệt (`checkAwardEligibility`). Hai tầng phải khớp nhau: nếu có sự khác biệt, một phía sẽ chấp nhận đề xuất mà phía kia hiển thị "không đủ điều kiện" — gây mất niềm tin của cán bộ vào hệ thống. Để bảo đảm điều này, cả hai hàm được kiểm thử bằng Jest với cùng một bộ kịch bản.

**Tính lại hồ sơ suy diễn sau mỗi thay đổi nguồn.** Các bảng `HoSoHangNam`, `HoSoNienHan`, `HoSoCongHien` lưu các kết quả tính toán (cờ đủ điều kiện, gợi ý). Bất kỳ thao tác nào tạo, sửa hoặc xoá bản ghi nguồn (vd: thêm một `DanhHieuHangNam` cũ) đều kích hoạt hàm tính lại tương ứng. Việc này xảy ra tự động bên trong cùng transaction để đảm bảo dữ liệu suy diễn không bao giờ "đi sau" dữ liệu nguồn.

**Tránh tham chiếu sai khoá ngoại.** Mọi quan hệ giữa các bảng đều được khai báo qua `@relation` của Prisma kèm chính sách `onDelete: Restrict` cho các quan hệ trọng yếu (vd: không cho xoá `QuanNhan` khi vẫn còn bản ghi `DanhHieuHangNam`). Đối với một số bảng phụ trợ ít quan trọng (vd: thông báo), chính sách `onDelete: Cascade` được áp để tự dọn sạch khi xoá đối tượng cha.

**Kiểm tra tính duy nhất qua chỉ mục unique.** Các trường có yêu cầu duy nhất (`cccd` của quân nhân, `username` của tài khoản, tổ hợp `quan_nhan_id + nam` cho `DanhHieuHangNam`) đều được khai báo `@unique` ở schema. Khi vi phạm, Prisma trả về lỗi P2002 mà backend bắt và biến thành thông điệp tiếng Việt thân thiện (vd: "Quân nhân này đã có bản ghi danh hiệu cho năm 2024, vui lòng chỉnh sửa thay vì tạo mới").

---

# Chương 3. Công nghệ sử dụng

Chương này giới thiệu các thành phần công nghệ chính được lựa chọn cho phần mềm Quản lý Khen thưởng (PM QLKT). Mỗi mục được trình bày theo bố cục thống nhất gồm ba phần: tổng quan ngắn gọn về công nghệ, đặc trưng kỹ thuật quan trọng và lý do lựa chọn trong ngữ cảnh cụ thể của đồ án. Cách trình bày này giúp người đọc thấy rõ động cơ của từng quyết định kỹ thuật thay vì chỉ liệt kê đặc điểm tổng quát.

## 3.1 Next.js 14 — khung phát triển frontend

Next.js là một khung phát triển ứng dụng web do hãng Vercel phát triển trên nền React. Phiên bản 14 ra mắt tháng 11 năm 2023 đánh dấu việc App Router chính thức trở thành mô hình định tuyến mặc định, thay thế cho cấu trúc Pages Router ở các phiên bản trước. App Router cho phép tổ chức ứng dụng dưới dạng cây thư mục bên trong thư mục `app/`, mỗi thư mục con tương ứng với một đoạn URL và có thể chứa các tệp `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` để biểu diễn trạng thái tương ứng.

Đặc trưng kỹ thuật đáng chú ý nhất ở App Router là khái niệm Server Components — các thành phần React mặc định chạy phía máy chủ, có thể truy vấn cơ sở dữ liệu hoặc gọi API nội bộ trực tiếp trong hàm render mà không cần state hay effect. Các thành phần cần xử lý sự kiện, hooks hoặc thư viện DOM mới khai báo `'use client'` ở đầu tệp. Cách tách biệt rõ ràng này giảm khối lượng JavaScript gửi xuống trình duyệt và đơn giản hóa việc lấy dữ liệu trên trang chỉ đọc.

Trong PM QLKT, App Router phù hợp với đặc thù phân vùng giao diện theo bốn vai trò người dùng. Các trang dành cho mỗi vai trò được đặt tại `app/super-admin/`, `app/admin/`, `app/manager/`, `app/user/`; mỗi nhánh có thể có `layout.tsx` riêng để áp các kiểm tra phân quyền tổng thể. Một ví dụ cụ thể là trang Bảng điều khiển dành cho ADMIN tại `app/admin/dashboard/page.tsx` có thể gọi trực tiếp hàm tổng hợp số liệu trên máy chủ rồi trả về HTML đã render, tránh việc gửi nhiều yêu cầu fetch nhỏ từ trình duyệt và rút ngắn thời gian hiển thị nội dung đầu tiên.

## 3.2 TypeScript và Express — nền tảng backend

Express là khung phát triển HTTP tối giản trên nền Node.js, ra mắt từ năm 2010 và hiện vẫn nằm trong số các dự án mã nguồn mở phổ biến nhất của hệ sinh thái JavaScript. Tư tưởng chủ đạo của Express là chuỗi middleware: mỗi yêu cầu đi qua một dãy hàm có chữ ký `(req, res, next)`, mỗi hàm có thể thay đổi đối tượng yêu cầu hoặc kết thúc luồng. Điều này đặc biệt phù hợp với nhu cầu xác thực, ghi nhật ký và kiểm tra dữ liệu của PM QLKT.

TypeScript được dùng song song với Express ở toàn bộ phần backend nhằm phát hiện lỗi tại thời điểm biên dịch. Cấu hình `tsconfig.json` bật `strictNullChecks` cho lớp Service và Repository nhưng nới lỏng cho lớp Controller (do tương tác trực tiếp với `req`/`res` Express vốn có nhiều trường tùy chọn). Các kiểu Prisma sinh tự động từ schema được nhập vào toàn bộ tầng Service, đảm bảo mọi truy vấn cơ sở dữ liệu đều có hỗ trợ gợi ý từ trình soạn thảo.

Trong PM QLKT, đặc tính chuỗi middleware của Express được khai thác triệt để qua mẫu thiết kế năm tầng cố định: `verifyToken → requireRole → validate(schema) → auditLog(options) → controller.method`. Mỗi tầng đảm nhiệm một mối quan tâm độc lập (xác thực, phân quyền, kiểm tra dữ liệu, ghi nhật ký), cho phép tổ chức mã nguồn theo nguyên tắc đơn trách nhiệm và tái sử dụng giữa các route. Hàm phụ trợ `catchAsync` gói các handler bất đồng bộ để chuyển lỗi về middleware xử lý lỗi tập trung, loại bỏ nhu cầu viết `try/catch` lặp đi lặp lại trong từng controller.

## 3.3 PostgreSQL và Prisma ORM

PostgreSQL là hệ quản trị cơ sở dữ liệu quan hệ mã nguồn mở với lịch sử phát triển từ năm 1986 và hiện được duy trì bởi cộng đồng PGDG. Hệ này được chọn do tính ổn định cao, tuân thủ chuẩn SQL chặt chẽ và hỗ trợ nhiều kiểu dữ liệu nâng cao như JSON, JSONB, mảng, kiểu liệt kê và kiểu thời gian có múi giờ — tất cả đều được dùng trong PM QLKT.

Prisma là một ORM thế hệ mới, không sinh code dạng kiểu Active Record mà sinh ra một Client typed an toàn từ tệp khai báo `schema.prisma` duy nhất. Mỗi thay đổi schema được áp dụng qua lệnh `prisma migrate dev` tạo ra các tệp SQL nằm dưới `prisma/migrations/`, có thể đẩy lên kho mã nguồn để theo dõi lịch sử. Prisma Client trả về các kiểu được suy luận từ schema, vì vậy mỗi truy vấn `findUnique`, `findMany`, `create` đều có hỗ trợ gợi ý đầy đủ ở thời điểm soạn mã.

Trong PM QLKT, schema gồm 23 model với tổng cộng 577 dòng. Quy ước đặt tên tận dụng chỉ thị `@@map("snake_case")` của Prisma để cho phép tên model trong code dùng `PascalCase` tiếng Việt (`QuanNhan`, `DanhHieuHangNam`, `HoSoCongHien`) trong khi tên bảng vật lý vẫn theo quy ước `snake_case` của PostgreSQL. Ưu điểm của tổ chức này là code đọc tự nhiên với người Việt, đồng thời giữ được khả năng truy vấn trực tiếp bằng SQL cho các nhu cầu báo cáo phức tạp ngoài Prisma. Bảng 3.1 dưới đây so sánh ngắn gọn ba lựa chọn ORM phổ biến để làm rõ lý do chọn Prisma.

**Bảng 3.1 — So sánh ba ORM phổ biến trên Node.js**

| Tiêu chí | Sequelize | TypeORM | Prisma |
|---|---|---|---|
| Năm ra mắt | 2010 | 2016 | 2019 |
| Kiểu định nghĩa schema | JavaScript / mô hình lớp | Decorator + lớp | DSL trong tệp `schema.prisma` |
| Hỗ trợ TypeScript | Có nhưng cần khai báo bổ sung | Tốt | **Sinh kiểu hoàn toàn tự động** |
| Migration | Có (kém trực quan) | Có | **Sinh tự động và có thể đảo ngược** |
| Hiệu suất truy vấn | Trung bình | Trung bình | **Tối ưu nhờ engine Rust** |
| Cộng đồng tại thời điểm chọn | Lớn nhưng đang chậm phát triển | Trung bình | **Đang tăng nhanh** |
| Phù hợp cho dự án có nhiều quan hệ | Cần cấu hình thủ công | Cần decorator nhiều | **Khai báo gọn, sinh truy vấn join hiệu quả** |

Với 23 model và nhiều quan hệ N–N qua bảng trung gian (vd: `BangDeXuat ↔ QuanNhan` qua `data_danh_hieu` JSONB hoặc qua `HoSoNienHan`), khả năng sinh truy vấn `include`, `select` của Prisma giúp giảm số dòng code ở tầng Repository so với việc viết câu lệnh SQL thủ công. Đây là lý do quyết định chọn Prisma cho PM QLKT.

## 3.4 Ant Design, Tailwind CSS và shadcn/ui — bộ giao diện ba lớp

Frontend của PM QLKT sử dụng kết hợp ba thư viện giao diện ở các vai trò khác nhau. Ant Design là thư viện thành phần React do Alibaba phát triển, cung cấp các thành phần phức tạp đã hoàn thiện như `Table` có lọc và phân trang, `Form` tích hợp validation, `Select` đa lớp, `DatePicker` hỗ trợ múi giờ, `Modal` lồng nhau và `Notification`. Trong PM QLKT, Ant Design đảm nhiệm các form đề xuất nhiều bước, bảng danh sách quân nhân với cột động và các hộp thoại xác nhận phê duyệt.

Tailwind CSS là khung CSS utility-first cho phép áp các lớp đơn lẻ trực tiếp trong JSX để biểu diễn bố cục, khoảng cách, màu sắc và đáp ứng nhiều kích cỡ màn hình. Tailwind không thay thế Ant Design mà bổ sung ở những vị trí cần điều chỉnh chi tiết bố cục mà các thành phần Ant Design chưa đáp ứng được, ví dụ căn lề tinh tế giữa các thẻ thông tin trên trang Bảng điều khiển, hoặc tổ chức lưới các thẻ huy chương theo hai cột trên màn hình lớn và một cột trên thiết bị di động.

Shadcn/ui có vai trò khác biệt: đây không phải là gói npm cài đặt trực tiếp mà là một bộ sao chép mã nguồn thành phần dựa trên Radix UI. Lập trình viên dùng lệnh CLI để sao chép một thành phần (ví dụ `button`, `dropdown-menu`, `dialog`) vào thư mục `components/ui/` của dự án và sửa lại tự do. Cách tiếp cận này tránh tình trạng phụ thuộc vào phiên bản thư viện cứng và đặc biệt hữu ích cho các thành phần ít gặp như danh sách lệnh tổ hợp phím trong khu vực dành cho lập trình viên (DevZone) của hệ thống. Quy tắc sử dụng giữa ba thư viện được đồng thuận trong nhóm: Ant Design ưu tiên cho biểu mẫu và bảng nghiệp vụ, Tailwind cho bố cục và chỉnh sửa nhẹ, shadcn/ui cho các thành phần đặc thù cần kiểm soát trực tiếp mã nguồn.

## 3.5 Socket.IO — kênh thông báo thời gian thực

Socket.IO là thư viện trừu tượng hóa giao thức WebSocket, hỗ trợ tự động chuyển sang giao thức HTTP long polling khi mạng giữa máy khách và máy chủ không cho phép kết nối WebSocket trực tiếp. Thư viện cung cấp khái niệm "phòng" (room) cho phép phát thông điệp tới một nhóm kết nối được đặt nhãn, rất phù hợp với mô hình thông báo theo người dùng hoặc theo đơn vị.

Trong PM QLKT, Socket.IO được dùng cho hai trường hợp cụ thể. Thứ nhất, khi một cán bộ ADMIN nhập một tệp Excel chứa hàng trăm bản ghi danh hiệu, máy chủ phát các sự kiện tiến độ theo từng phần trăm hoàn thành để giao diện cập nhật thanh tiến trình mà không phải thiết lập polling phía trình duyệt. Thứ hai, khi một đề xuất được phê duyệt, máy chủ phát thông điệp tới tất cả các kết nối thuộc vai trò MANAGER của đơn vị có quân nhân được duyệt; giao diện hiển thị thông báo xuất hiện ở góc màn hình mà không cần làm mới trang. Các kết nối được lập tức xác thực qua JWT đã có sẵn trong cookie HttpOnly, nhờ vậy logic xác thực không bị phân nhánh giữa REST và WebSocket.

## 3.6 JSON Web Token với cơ chế làm mới luân phiên

Hệ thống áp dụng JWT theo chuẩn RFC 7519 cho cơ chế xác thực không trạng thái. Mỗi phiên đăng nhập tạo ra hai token: Access Token có thời hạn ngắn (15 phút) chứa định danh người dùng và mã vai trò, được gửi kèm mỗi yêu cầu HTTP qua header `Authorization`; Refresh Token có thời hạn dài hơn (7 ngày) lưu trong cookie HttpOnly chỉ dùng để cấp Access Token mới khi token hiện tại hết hạn.

Cơ chế làm mới luân phiên (refresh token rotation) yêu cầu mỗi lần dùng Refresh Token, máy chủ sẽ phát hành đồng thời một Refresh Token mới và đánh dấu Refresh Token cũ hết hiệu lực. Cách làm này hạn chế nguy cơ một Refresh Token bị đánh cắp vẫn dùng được lâu dài: nếu kẻ tấn công và người dùng hợp pháp cùng dùng một Refresh Token thì lần làm mới thứ hai sẽ thất bại, máy chủ phát hiện bất thường và buộc người dùng đăng nhập lại. Mật khẩu trước khi lưu vào bảng `TaiKhoan` được băm bằng bcrypt với hệ số chi phí (cost factor) 10, đảm bảo cân bằng giữa thời gian xử lý đăng nhập (vào khoảng 80 mili giây trên máy chủ phát triển) và độ khó tấn công vét cạn nếu cơ sở dữ liệu bị rò rỉ.

## 3.7 Joi và Zod — kiểm tra dữ liệu ở hai phía

PM QLKT chia kiểm tra dữ liệu thành hai lớp với hai thư viện khác nhau, mỗi thư viện phù hợp với đặc thù của lớp tương ứng. Tại backend, mọi route nhận dữ liệu từ client đều đi qua middleware `validate(schema)` dùng Joi để kiểm tra `req.body`, `req.query` và `req.params`. Joi cung cấp API định nghĩa schema theo phong cách lập trình hàm nối tiếp (`Joi.object({ nam: Joi.number().integer().min(2000).max(2100).required() })`), gắn được thông điệp tiếng Việt cho từng lỗi và hỗ trợ tùy chọn `stripUnknown: true` để loại bỏ các trường không khai báo trong schema — tránh việc client lén đẩy lên các trường ngoài ý muốn.

Tại frontend, các form do Ant Design Form quản lý được xác thực bằng Zod thông qua thư viện trung gian. Zod có ưu điểm là tích hợp chặt với TypeScript: kiểu của giá trị form được suy luận trực tiếp từ schema (`type FormValues = z.infer<typeof formSchema>`), tránh việc duy trì hai khai báo song song giữa interface và schema. Việc sử dụng hai thư viện khác nhau ở hai phía thoạt nhìn có vẻ trùng lắp nhưng đáp ứng đúng vai trò: Zod tối ưu cho trải nghiệm soạn thảo trên frontend, còn Joi tích hợp tốt với chuỗi middleware Express ở backend. Quan trọng là logic xác thực không tin tưởng vào lớp frontend — backend luôn kiểm tra lại dữ liệu trước khi ghi vào cơ sở dữ liệu.

## 3.8 Jest — khung kiểm thử đơn vị

Jest là khung kiểm thử do Meta phát triển, có ưu điểm là cấu hình tối thiểu, hỗ trợ chế độ theo dõi (watch mode) chạy lại các bộ kiểm thử bị ảnh hưởng khi tệp nguồn thay đổi và có hệ thống trình giả (mock) tích hợp sẵn. Phiên bản dùng cho PM QLKT là Jest 29 kết hợp với `ts-jest` để chạy trực tiếp các tệp TypeScript mà không cần biên dịch trước.

Tại thời điểm hoàn thiện đồ án, kho kiểm thử của PM QLKT gồm 74 bộ kiểm thử với 870 ca kiểm thử, tổ chức theo các thư mục `tests/services/`, `tests/scenarios/`, `tests/approve/`, `tests/submit/`, `tests/import/`, `tests/authz/`. Hai nhóm trọng yếu nhất là `eligibility-bkbqp-personal.test.ts`, `eligibility-cstdtq-personal.test.ts`, `eligibility-bkttcp-personal.test.ts` (cùng các phiên bản đơn vị) tập trung vào các kịch bản đa dạng của rule chuỗi: chu kỳ vừa đủ, chu kỳ thừa, lỡ đợt, BKBQP rơi ra ngoài cửa sổ trượt 3 năm, và trường hợp đặc biệt khi quân nhân chưa nhận đủ NCKH. Các trường hợp này được cố định trước trong tệp `errorMessages.ts` để đảm bảo bất kỳ sửa đổi nào trong logic chuỗi đều phải cập nhật song song giá trị mong đợi của ca kiểm thử, giúp tránh tình trạng test "trôi" theo code.

## 3.9 ExcelJS — công cụ nhập và xuất Excel

ExcelJS là thư viện JavaScript cho phép đọc, ghi và thao tác workbook định dạng `.xlsx` ở phía máy chủ Node.js. Khác với các thư viện chỉ tạo CSV hoặc HTML giả lập Excel, ExcelJS hỗ trợ định dạng ô (font, màu nền, viền), khóa ô để tránh người dùng chỉnh sửa các cột hệ thống, công thức và đặc biệt là Data Validation rule cho phép tạo các danh sách thả xuống (dropdown) ngay trong tệp mẫu xuất ra.

Trong PM QLKT, ExcelJS phục vụ hai mục đích đối xứng. Khi xuất tệp mẫu nhập liệu cho từng nhóm khen thưởng, máy chủ sinh workbook với các sheet riêng (`QuanNhan`, `DanhHieuHangNam`, `ThanhTichKhoaHoc`, ...), cài đặt cột cố định, áp Data Validation lên cột danh hiệu để chỉ chấp nhận các giá trị hợp lệ và đính kèm chú thích tiếng Việt giải thích từng cột. Khi nhập tệp Excel do người dùng tải lên, máy chủ đọc tuần tự từng dòng, đối chiếu với schema Joi và Prisma rồi đưa kết quả vào màn hình xem trước trước khi đưa vào cơ sở dữ liệu. Quy trình hai bước (xem trước rồi xác nhận) tận dụng đặc tính giao dịch của Prisma ở bước xác nhận để đảm bảo nguyên tử tính: nếu có bất kỳ dòng nào lỗi vào thời điểm ghi, toàn bộ thao tác sẽ được hủy bỏ.

---

# Chương 4. Thiết kế, triển khai và đánh giá hệ thống

Chương này trình bày toàn bộ quá trình từ thiết kế kiến trúc đến triển khai sản phẩm. Phần đầu mô tả lựa chọn kiến trúc tổng thể và các sơ đồ thiết kế chi tiết. Phần giữa giới thiệu kết quả xây dựng kèm các đoạn mã minh họa lấy trực tiếp từ kho mã nguồn của dự án. Phần cuối báo cáo kết quả kiểm thử và hướng dẫn triển khai.

## 4.1 Thiết kế kiến trúc

### 4.1.1 Lựa chọn kiến trúc phần mềm

Hệ thống áp dụng **kiến trúc phân tầng (layered architecture)** với sáu lớp xếp chồng từ ngoài vào trong: Route → Middleware → Controller → Service → Repository → Prisma Client. Mỗi lớp chỉ tương tác trực tiếp với lớp liền kề, không gọi nhảy lớp. Đây là biến thể mở rộng của mô hình MVC truyền thống, trong đó Service và Repository được tách riêng để rõ ràng hoá ranh giới giữa logic nghiệp vụ và truy cập dữ liệu.

Việc tách lớp Repository khỏi lớp Service được áp dụng từ một lần tái cấu trúc lớn của dự án. Trước đó, Service gọi `prisma.danhHieuHangNam.findMany(...)` trực tiếp, dẫn tới việc viết kiểm thử đơn vị cho Service phải mock toàn bộ Prisma Client — phức tạp và dễ tạo ra mock không chính xác. Sau khi tách, Service gọi qua giao diện `danhHieuHangNamRepository.findMany(...)`; kiểm thử đơn vị cho Service chỉ cần mock các phương thức của Repository, code đơn giản hơn nhiều và phản ánh đúng hợp đồng giữa hai lớp.

Lý do không chọn các kiến trúc khác:

- **Pure MVC** thiếu khái niệm Repository, dẫn tới các hàm Service vừa làm logic nghiệp vụ vừa làm truy vấn — vi phạm nguyên tắc đơn trách nhiệm đối với một dự án có nhiều quan hệ phức tạp như PM QLKT (23 model với nhiều quan hệ N–N).
- **Clean Architecture / Hexagonal** đầy đủ với Use Case Layer, Entity Layer, Adapter Layer là quá phức tạp cho quy mô dự án. Lớp Use Case sẽ trùng lặp gần như hoàn toàn với lớp Service trong layered architecture.
- **Microservices** không phù hợp với môi trường mạng nội bộ một máy chủ; chia tách dịch vụ làm tăng độ phức tạp triển khai mà không mang lại lợi ích về quy mô tải.

> **Hình 4.1**: Sơ đồ kiến trúc phân tầng sáu lớp — xem khối Mermaid `C1.2` tại `docs/diagrams/03-architecture.md`.

### 4.1.2 Tổng quan hệ thống

Sản phẩm được tổ chức thành ba thành phần độc lập triển khai:

- **Frontend (FE-QLKT)**: ứng dụng Next.js 14 chạy bằng Node.js. Cung cấp giao diện cho cả bốn vai trò người dùng. Kết nối tới backend qua REST API (HTTP) và Socket.IO (WebSocket).
- **Backend (BE-QLKT)**: API server Express + TypeScript chạy bằng Node.js. Cung cấp REST endpoint, Socket.IO server, thực hiện toàn bộ logic nghiệp vụ và quản lý phiên đăng nhập.
- **Cơ sở dữ liệu**: PostgreSQL chạy trong tiến trình riêng. Backend kết nối qua Prisma Client, không cho phép FE truy cập trực tiếp.

Cả ba thành phần này được triển khai trên cùng một máy chủ Linux của Học viện và giao tiếp qua localhost. Bên ngoài, người dùng truy cập qua trình duyệt thông qua mạng LAN; FE phục vụ tệp tĩnh (HTML/CSS/JS đã build), gọi tới BE qua proxy. Sơ đồ Hình 4.2 thể hiện luồng này.

> **Hình 4.2**: Sơ đồ kiến trúc tổng quan FE — BE — DB — xem khối `C1.1` tại `docs/diagrams/03-architecture.md`.

### 4.1.3 Thiết kế tổng quan các gói

Cấu trúc thư mục mã nguồn được tổ chức theo nguyên tắc đơn trách nhiệm và đặt tên theo tiếng Anh chuẩn để dễ tham chiếu trong các sơ đồ.

**a, Gói phía frontend.** Mã nguồn frontend được tổ chức bên trong thư mục `FE-QLKT/src/`. Gói `app/` chứa cây định tuyến của Next.js App Router với bốn nhánh tương ứng bốn vai trò người dùng (super-admin, admin, manager, user). Gói `components/` chứa các thành phần React dùng chung, được tách thành các thư mục con theo miền nghiệp vụ: `auth/` cho màn hình đăng nhập và đổi mật khẩu, `proposals/` cho biểu mẫu tạo đề xuất nhiều bước với mỗi loại trong bảy loại đề xuất, `personnel/` cho danh sách và chi tiết quân nhân, `system-logs/` cho bảng nhật ký kiểm toán. Gói `contexts/` đặt `AuthContext` quản lý trạng thái đăng nhập trong toàn ứng dụng. Gói `hooks/` chứa các React hook tự viết như `useFetch`, `useAuthGuard`, `useSocket`. Gói `lib/` chứa các module phụ trợ: `api/` chia theo từng miền nghiệp vụ và đóng gói các yêu cầu REST tới backend, `award/` chứa các hàm trợ giúp render chuỗi danh hiệu phía frontend, `schemas.ts` định nghĩa các schema Zod xác thực biểu mẫu. Gói `constants/` chứa các hằng số dùng chung như danh sách vai trò, trạng thái, danh hiệu.

> **Hình 4.3**: Sơ đồ gói phía frontend — xem khối `C2.2` tại `docs/diagrams/03-architecture.md`.

**b, Gói phía backend.** Mã nguồn backend được tổ chức bên trong thư mục `BE-QLKT/src/` theo sáu lớp đã trình bày ở mục 4.1.1. Gói `routes/` định nghĩa các điểm cuối REST API, mỗi miền nghiệp vụ một tệp. Gói `middlewares/` chứa các tệp `auth.ts` (xác thực và phân quyền), `auditLog.ts` (ghi nhật ký mọi thao tác mutate), `unitFilter.ts` (lọc dữ liệu theo phạm vi đơn vị của Manager) và `validate.ts` (bọc Joi validation). Gói `controllers/` chứa các tệp điều hướng yêu cầu HTTP từ route tới service, được giữ mỏng (mỗi phương thức dưới 50 dòng mã). Gói `services/` chứa logic nghiệp vụ chính, được tách tiếp thành các thư mục con: `proposal/strategies/` cho strategy registry của bảy loại đề xuất, `eligibility/` cho hàm `chainEligibility` xét rule chuỗi cá nhân và đơn vị, `profile/annual.ts` cho logic chuỗi cá nhân và `profile/unit.ts` cho logic chuỗi đơn vị. Gói `repositories/` đóng gói toàn bộ truy cập Prisma — mỗi model một tệp `.repository.ts`. Gói `helpers/` chứa các tiện ích phụ trợ chia theo nhóm: `auditLog/` cho các hàm sinh mô tả nhật ký theo từng tài nguyên, `notification/` cho hàm gửi thông báo realtime, `excel/` cho đọc và ghi tệp Excel qua ExcelJS, `awardValidation/` cho các quy tắc kiểm tra huy chương cao nhất. Gói `validations/` chứa các schema Joi cho từng route. Gói `constants/` chứa các hằng số dùng chung. Tệp `prisma/schema.prisma` ở cấp gốc của module backend định nghĩa toàn bộ 23 model.

> **Hình 4.4**: Sơ đồ gói phía backend — xem khối `C2.1` tại `docs/diagrams/03-architecture.md`.

### 4.1.4 Thiết kế chi tiết gói nghiệp vụ Khen thưởng cá nhân hằng năm

Để minh hoạ cách các tầng phối hợp với nhau trong một module nghiệp vụ cụ thể, phần này trình bày chi tiết module xử lý chuỗi danh hiệu hằng năm cá nhân — module phức tạp nhất của hệ thống.

Khi người dùng truy cập trang hồ sơ một quân nhân, dòng chảy dữ liệu diễn ra như sau:

1. **Route** `GET /api/personnel/:id/profile` (định nghĩa tại `routes/profile.route.ts`) tiếp nhận yêu cầu và đẩy qua chuỗi middleware `verifyToken → requireAuth → unitFilter`.
2. **Controller** `profileController.getAnnualProfile` (tại `controllers/profile.controller.ts`) đọc tham số `personnelId`, gọi service tương ứng, đóng gói kết quả vào `ResponseHelper.success`.
3. **Service** `profileService.recalculateAnnualProfile` (tại `services/profile/annual.ts`) thực thi logic gồm: nạp danh sách `DanhHieuHangNam` qua repository, gọi `computeChainContext` để dẫn xuất ngữ cảnh chuỗi, lặp qua `PERSONAL_CHAIN_AWARDS` và gọi `checkChainEligibility` cho mỗi tier, ghi kết quả vào bảng suy diễn `HoSoHangNam`.
4. **Eligibility module** `services/eligibility/chainEligibility.ts` chứa hàm `checkChainEligibility(config, context, hasReceivedLifetime)` — hàm thuần (pure function), không truy vấn cơ sở dữ liệu, dễ kiểm thử.
5. **Repository** `repositories/danhHieuHangNam.repository.ts` cung cấp các phương thức `findManyByPersonnelId`, `findUniqueByPersonnelYearAward` — đóng gói các câu lệnh Prisma cụ thể.
6. **Prisma Client** thực thi truy vấn SQL tới bảng `danh_hieu_hang_nam`.

Sự tách biệt giữa Service (logic nghiệp vụ) và Eligibility module (rule thuần) là chủ ý: Eligibility module có thể được kiểm thử với 100 % phủ rule mà không cần mock cơ sở dữ liệu. Service chỉ phụ trách điều phối — nạp dữ liệu, gọi rule, ghi kết quả — nên cũng dễ kiểm thử với mock Repository.

> **Hình 4.5**: Sơ đồ gói chi tiết module khen thưởng cá nhân hằng năm — xem khối `C2.4` tại `docs/diagrams/03-architecture.md`.

### 4.1.5 Thiết kế lớp

Phần này trình bày sơ đồ lớp cho năm module nghiệp vụ chính. Mỗi sơ đồ chỉ ra các lớp/interface cốt lõi cùng các phương thức quan trọng và mối quan hệ.

**Module xử lý chuỗi danh hiệu (Hình 4.6).** Trung tâm là interface `ChainAwardConfig` chứa cấu hình một tier chuỗi (mã danh hiệu, số năm chu kỳ, danh sách cờ tiền điều kiện, có yêu cầu NCKH hay không, có phải lifetime hay không, tên cột cờ trong cơ sở dữ liệu, nhãn chuỗi). Hai mảng cấu hình `PERSONAL_CHAIN_AWARDS` và `UNIT_CHAIN_AWARDS` chứa danh sách các tier tương ứng cho cá nhân và đơn vị. Hàm `checkChainEligibility(config, context, hasReceivedLifetime, flagsInWindow)` đọc cấu hình và đối chiếu với ngữ cảnh thực tế để trả về kết quả `EligibilityResult` gồm hai trường `eligible: boolean` và `reason: string`. Interface `ChainContext` đóng gói các chỉ số dẫn xuất từ lịch sử (độ dài chuỗi, năm gần nhất nhận từng tier, số cờ trong cửa sổ trượt).

**Module Strategy đề xuất (Hình 4.7).** Interface `ProposalStrategy` định nghĩa bốn phương thức bắt buộc cho mỗi loại đề xuất: `buildSubmitPayload`, `validateApprove`, `importInTransaction`, `buildSuccessMessage`. Bảy lớp triển khai (`caNhanHangNamStrategy`, `donViHangNamStrategy`, `nienHanStrategy`, `hcQkqtStrategy`, `kncStrategy`, `congHienStrategy`, `nckhStrategy`) đăng ký vào REGISTRY trong `services/proposal/strategies/index.ts`. Hai lớp single-medal (`hcQkqtStrategy` và `kncStrategy`) chia sẻ logic qua hàm trợ giúp `singleMedalImporter` để tránh trùng lặp.

**Module xác thực và phân quyền (Hình 4.8).** Lớp chính là `AuthService` cung cấp các phương thức `login`, `refresh`, `logout`, `changePassword`. Middleware `verifyToken` đọc cookie, xác minh Access Token, gắn `req.user`. Middleware `requireRole(...allowed)` factory trả về middleware kiểm tra `req.user.role` thuộc danh sách cho phép. Middleware `unitFilter` truy vấn `co_quan_don_vi_id`/`don_vi_truc_thuoc_id` của người dùng và áp giới hạn phạm vi cho mỗi yêu cầu của Manager.

**Module quản lý đề xuất (Hình 4.9).** Lớp `ProposalService` điều phối luồng tạo và phê duyệt đề xuất, dùng `proposalRepository` để truy vấn và cập nhật. Lớp `ApproveOrchestrator` (tại `services/proposal/approve/`) thực hiện logic phê duyệt phức tạp, gọi tuần tự `validation.ts → decisionMappings.ts → import.ts` trong cùng một transaction.

**Module nhập – xuất Excel (Hình 4.10).** Bao gồm các hàm trợ giúp dùng chung (`loadWorkbook`, `getAndValidateWorksheet`, `parseHeaderMap`, `sanitizeRowData`) và các strategy chuyên biệt cho từng loại nghiệp vụ. Mỗi strategy có hai phương thức `previewImport` (chỉ kiểm tra) và `confirmImport` (mở transaction ghi).

> **Hình 4.6 — 4.10**: Sơ đồ lớp năm module nghiệp vụ — xem các khối `C3.1` đến `C3.5` tại `docs/diagrams/04-class.md`.

### 4.1.6 Biểu đồ tuần tự

Bảy luồng nghiệp vụ quan trọng nhất được mô hình hoá bằng sơ đồ tuần tự (sequence diagram). Mỗi sơ đồ thể hiện sự tương tác giữa các đối tượng theo thời gian.

**Sequence 4.1 — Đăng nhập với refresh token rotation** (Hình 4.13). Người dùng nhập tên đăng nhập + mật khẩu → FE gọi `POST /auth/login` → `authController.login` → `authService.login` → `accountRepository.findByUsername` → `bcrypt.compare` → tạo Access + Refresh Token → ghi `SystemLog` → trả về kèm cookie HttpOnly.

**Sequence 4.2 — Tạo đề xuất** (Hình 4.14). Manager hoàn thành ba bước form → FE gọi `POST /api/proposals` → `verifyToken → requireRole([ADMIN,MANAGER]) → validate(submitProposalSchema) → auditLog({action: CREATE, resource: proposals}) → proposalController.submitProposal` → `proposalService.submitProposal` → `getProposalStrategy(type).buildSubmitPayload` → `proposalRepository.create` → phát Socket.IO event tới Admin → trả về đề xuất đã tạo.

**Sequence 4.3 — Phê duyệt đề xuất** (Hình 4.15). Admin mở chi tiết → bấm "Phê duyệt" → FE gọi `POST /api/proposals/:id/approve` → middleware chain → `proposalController.approveProposal` → `approveOrchestrator.run` → mở transaction Prisma → `validation.preflight` → `getProposalStrategy(type).validateApprove` → `decisionMappings.attach` → `getProposalStrategy(type).importInTransaction` → cập nhật `BangDeXuat.status = APPROVED` → tính lại hồ sơ suy diễn cho các quân nhân bị ảnh hưởng → commit transaction → `auditLog` → phát Socket.IO event.

**Sequence 4.4 — Tính lại điều kiện chuỗi cho một quân nhân** (Hình 4.16). FE gọi `GET /api/personnel/:id/annual-profile` → `profileController.getAnnualProfile` → `profileService.recalculateAnnualProfile` → `danhHieuHangNamRepository.findManyByPersonnelId` → `computeChainContext(rows, currentYear)` → vòng for qua `PERSONAL_CHAIN_AWARDS` gọi `checkChainEligibility` → `hoSoHangNamRepository.upsert` → trả kết quả gồm cờ đủ điều kiện và `goi_y` text.

**Sequence 4.5 — Nhập Excel hai bước** (Hình 4.17). Admin tải tệp → FE gọi `POST /api/annual-rewards/import/preview` (multipart form-data) → `excelHelper.loadWorkbook` → đọc từng sheet → cho mỗi dòng: chạy schema Joi và rule nghiệp vụ → trả về `{valid: [...], errors: [...]}`. Admin xác nhận → FE gọi `POST /api/annual-rewards/import/confirm` với danh sách `valid` → mở transaction → ghi tuần tự → commit hoặc rollback.

**Sequence 4.6 — Sao lưu định kỳ tự động** (Hình 4.18). Cron job nội bộ kích hoạt mỗi 24 giờ → `backupService.runScheduledBackup` → spawn child process `pg_dump` → ghi tệp SQL vào `backups/YYYY-MM-DD_HH-mm-ss.sql` → ghi nhật ký `action = CREATE, resource = backup` → SuperAdmin có thể xem qua DevZone.

**Sequence 4.7 — Thông báo realtime sau phê duyệt** (Hình 4.19). Sau khi Admin phê duyệt, `notificationService.notifyApproval` được gọi → tra cứu các quân nhân đối tượng → tạo bản ghi `ThongBao` → emit Socket.IO event tới các phòng (room) tương ứng (`user:<id>`, `unit:<id>`) → FE người nhận nhận được sự kiện và hiển thị toast notification.

> **Hình 4.13 — 4.19**: Bảy sơ đồ tuần tự — xem các khối `C4.1` đến `C4.7` tại `docs/diagrams/05-sequence.md`.

### 4.1.7 Thiết kế cơ sở dữ liệu

Cơ sở dữ liệu được mô hình hoá thành 23 model trong tệp `prisma/schema.prisma`. Hình 4.20 là sơ đồ ERD tổng thể; sáu sơ đồ ERD phân module (Hình 4.21 — 4.25) phóng to từng nhóm bảng có liên quan trực tiếp với nhau.

**Sơ đồ ERD tổng thể** (Hình 4.20) bao quát toàn bộ 23 bảng với các quan hệ khoá ngoại chính. Có thể nhận diện ba "trục" chính: (1) trục tổ chức gồm `CoQuanDonVi`, `DonViTrucThuoc`, `ChucVu`, `LichSuChucVu`; (2) trục quân nhân gồm `QuanNhan`, `TaiKhoan`; (3) trục khen thưởng gồm `BangDeXuat`, `DanhHieuHangNam`, `KhenThuongHCCSVV`, `HuanChuongQuanKyQuyetThang`, `KyNiemChuongVSNXDQDNDVN`, `KhenThuongHCBVTQ`, `KhenThuongDotXuat`, `ThanhTichKhoaHoc`. Các bảng suy diễn `HoSoHangNam`, `HoSoNienHan`, `HoSoCongHien`, `HoSoDonViHangNam` chứa kết quả tính toán lại được tự động sau mỗi thay đổi nguồn.

Sáu bảng mô tả chi tiết schema (Bảng 4.1 — 4.6) sau đây được chọn vì là các bảng trọng yếu nhất, sử dụng nhiều cấu trúc dữ liệu phức tạp (JSON, mảng, kiểu thời gian).

**Bảng 4.1 — Schema bảng `QuanNhan` (Personnel)**

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | String (CUID) | PK | Khoá chính |
| `cccd` | String(12) | UNIQUE, NOT NULL | Số căn cước công dân |
| `ho_ten` | String | NOT NULL | Họ và tên đầy đủ |
| `ngay_sinh` | DateTime | NULL | Ngày sinh |
| `gioi_tinh` | Enum(NAM, NU) | NOT NULL | Giới tính |
| `ngay_nhap_ngu` | DateTime | NULL | Ngày nhập ngũ — đầu vào tính niên hạn |
| `ngay_xuat_ngu` | DateTime | NULL | Ngày xuất ngũ (nếu đã rời quân ngũ) |
| `cap_bac` | String | NULL | Cấp bậc hiện tại |
| `co_quan_don_vi_id` | String | FK → CoQuanDonVi | Liên kết tới CQDV (có thể NULL nếu thuộc DVTT) |
| `don_vi_truc_thuoc_id` | String | FK → DonViTrucThuoc | Liên kết tới DVTT (có thể NULL nếu thuộc CQDV) |
| `chuc_vu_id` | String | FK → ChucVu | Chức vụ hiện tại |
| `createdAt` | Timestamptz | DEFAULT now() | Thời điểm tạo |

Ràng buộc nghiệp vụ: chỉ một trong `co_quan_don_vi_id` và `don_vi_truc_thuoc_id` được điền. Khi cập nhật chuyển đơn vị, cần dùng transaction để cập nhật cả bộ đếm `so_luong` của hai đơn vị liên quan.

**Bảng 4.2 — Schema bảng `BangDeXuat` (Proposal)**

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | String (CUID) | PK | |
| `loai_de_xuat` | String | NOT NULL | Một trong 7 mã: `CA_NHAN_HANG_NAM`, `DON_VI_HANG_NAM`, `NIEN_HAN`, `CONG_HIEN`, `KNC_VSNXD_QDNDVN`, `HC_QKQT`, `NCKH` |
| `nguoi_de_xuat_id` | String | FK → TaiKhoan | Người tạo đề xuất |
| `nam` | Int | NOT NULL | Năm xét |
| `thang` | Int | NULL | Tháng xét (chỉ với một số loại) |
| `status` | Enum(PENDING, APPROVED, REJECTED) | NOT NULL | Trạng thái xử lý |
| `data_danh_hieu` | JSON | NULL | Dữ liệu chi tiết với cá nhân/đơn vị hằng năm |
| `data_thanh_tich` | JSON | NULL | Dữ liệu thành tích NCKH |
| `data_nien_han` | JSON | NULL | Dữ liệu niên hạn |
| `data_cong_hien` | JSON | NULL | Dữ liệu cống hiến |
| `files_attached` | JSON | NULL | Mảng file đính kèm |
| `co_quan_don_vi_id` | String | FK → CoQuanDonVi | Phạm vi đề xuất (CQDV) |
| `don_vi_truc_thuoc_id` | String | FK → DonViTrucThuoc | Phạm vi đề xuất (DVTT) |

Việc dùng JSON cho 4 trường `data_*` là chủ ý. Mỗi loại đề xuất có schema riêng nên việc tạo nhiều bảng trung gian sẽ phá vỡ tính đồng nhất của bảng `BangDeXuat`. JSON đủ để đảm bảo schema linh hoạt; xác thực schema được đảm nhiệm ở tầng Joi và `ProposalStrategy`.

**Bảng 4.3 — Schema bảng `DanhHieuHangNam` (Annual Award)**

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | String (CUID) | PK | |
| `quan_nhan_id` | String | FK → QuanNhan | |
| `nam` | Int | UNIQUE(quan_nhan_id, nam) | Năm danh hiệu |
| `danh_hieu` | String | NULL | Mã danh hiệu cơ bản (CSTĐCS, CSTT) |
| `nhan_bkbqp` | Boolean | DEFAULT false | Cờ nhận BKBQP |
| `so_quyet_dinh_bkbqp` | String | NULL | Số quyết định nếu có BKBQP |
| `nhan_cstdtq` | Boolean | DEFAULT false | Cờ nhận CSTĐTQ |
| `so_quyet_dinh_cstdtq` | String | NULL | |
| `nhan_bkttcp` | Boolean | DEFAULT false | Cờ nhận BKTTCP |
| `so_quyet_dinh_bkttcp` | String | NULL | |
| `ghi_chu` | String | NULL | |

Ràng buộc duy nhất `(quan_nhan_id, nam)` đảm bảo mỗi quân nhân chỉ có một bản ghi cho một năm. Các cờ `nhan_*` cho phép cộng dồn các tier chuỗi vào cùng năm — một quân nhân có thể vừa nhận BKBQP vừa duy trì CSTĐCS trong cùng một năm.

**Bảng 4.4 — Schema bảng `LichSuChucVu` (Position History)**

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | String (CUID) | PK | |
| `quan_nhan_id` | String | FK → QuanNhan | |
| `chuc_vu_id` | String | FK → ChucVu | |
| `ngay_bat_dau` | DateTime | NULL | Ngày bắt đầu giữ chức vụ |
| `ngay_ket_thuc` | DateTime | NULL | Ngày kết thúc; NULL = đang giữ |
| `he_so_chuc_vu` | Decimal(3,2) | NOT NULL | Hệ số chức vụ tại thời điểm đó |
| `so_thang` | Int | NOT NULL | Số tháng giữ chức vụ (đã tính sẵn) |

Trường `so_thang` được tự động cập nhật bởi hàm `recalcPositionMonths` mỗi khi có thay đổi `ngay_bat_dau` hoặc `ngay_ket_thuc`. Đây là dữ liệu đầu vào cho thuật toán tính tháng cống hiến theo nhóm hệ số (HCBVTQ).

**Bảng 4.5 — Schema bảng `SystemLog` (Audit Log)**

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | String (CUID) | PK | |
| `nguoi_thuc_hien_id` | String | FK → TaiKhoan, NULL | Có thể NULL với thao tác trước khi đăng nhập |
| `nguoi_thuc_hien_role` | String | NOT NULL | Snapshot vai trò tại thời điểm |
| `action` | String | NOT NULL | CREATE, UPDATE, DELETE, IMPORT, APPROVE, REJECT, LOGIN, ... |
| `resource` | String | NOT NULL | Loại tài nguyên (slug từ AWARD_SLUGS hoặc 'accounts', 'personnel', ...) |
| `resource_id` | String | NULL | Mã định danh tài nguyên bị tác động |
| `description` | String | NOT NULL | Mô tả tiếng Việt do hàm builder sinh tự động |
| `payload` | JSON | NULL | Trạng thái trước–sau khi thay đổi |
| `createdAt` | Timestamptz | DEFAULT now() | |

**Bảng 4.6 — Schema bảng `HoSoHangNam` (Annual Profile — Derived)**

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | String (CUID) | PK | |
| `quan_nhan_id` | String | UNIQUE FK → QuanNhan | Mỗi quân nhân một bản ghi duy nhất |
| `cstdcs_lien_tuc` | Int | NOT NULL | Độ dài chuỗi CSTĐCS hiện tại |
| `du_dieu_kien_bkbqp` | Boolean | DEFAULT false | Cờ đủ điều kiện đề nghị BKBQP |
| `du_dieu_kien_cstdtq` | Boolean | DEFAULT false | |
| `du_dieu_kien_bkttcp` | Boolean | DEFAULT false | |
| `goi_y` | String | NULL | Thông điệp gợi ý tiếng Việt |
| `last_recalc_at` | Timestamptz | DEFAULT now() | Thời điểm tính lại gần nhất |

> **Hình 4.20 — 4.25**: ERD tổng thể và 5 ERD phân module — xem các khối `C5.1` đến `C5.6` tại `docs/diagrams/06-erd.md`.

## 4.2 Thiết kế chi tiết

### 4.2.1 Thiết kế giao diện

Giao diện hệ thống được thiết kế trên cơ sở wireframe ASCII đơn giản trước khi triển khai bằng React + Ant Design. Sáu wireframe chính (Hình 4.11 — 4.16) thể hiện bố cục các trang trọng tâm.

**Trang chủ Admin** có cấu trúc ba khu vực: thanh điều hướng bên trái (cây CQDV — DVTT có thể thu gọn), khu vực dashboard ở giữa với bốn thẻ thống kê (tổng quân nhân, tổng đơn vị, đề xuất chờ duyệt, khen thưởng tháng này), khu vực phụ bên phải với danh sách thông báo realtime. Bố cục ba khu vực này được giữ nhất quán xuyên suốt các trang nghiệp vụ chính (Quản lý quân nhân, Quản lý đề xuất, Quản lý quyết định) để giảm chi phí học thuộc cho người dùng mới.

**Trang chi tiết quân nhân** chia thành các tab tương ứng các nhóm khen thưởng: Hằng năm, Niên hạn, Cống hiến, Quân kỳ, Kỷ niệm chương, NCKH, Đột xuất. Mỗi tab có bảng dữ liệu kèm thanh tiến trình hiển thị các chu kỳ đang đến mốc đề nghị (vd: "BKBQP: 1/2 năm CSTĐCS đã tích luỹ"). Cách tiếp cận trực quan này giúp Manager nhanh chóng nhận biết quân nhân nào sắp đủ điều kiện.

**Form tạo đề xuất** áp dụng mẫu nhiều bước (Multi-Step Wizard) ba bước. Bước 1: chọn loại đề xuất (radio button có icon đại diện cho từng nhóm) và năm/tháng. Bước 2: chọn quân nhân hoặc đơn vị từ bảng có lọc theo nhiều tiêu chí. Bước 3: thiết lập danh hiệu cụ thể cho từng đối tượng đã chọn, kèm gợi ý từ hệ thống. Người dùng có thể quay lại các bước trước mà không mất dữ liệu nhờ trạng thái được lưu ở Context.

**Trang nhập Excel** chia hai phần: trên là vùng kéo–thả tệp + nút tải xuống tệp mẫu; dưới là bảng xem trước với hai tab "Hợp lệ" và "Lỗi" — tab Lỗi tô đỏ và liệt kê chỉ số dòng kèm mô tả cụ thể. Nút "Xác nhận nhập" chỉ kích hoạt khi có ít nhất một dòng hợp lệ.

**Trang nhật ký hệ thống** dạng bảng có nhóm theo ngày. Bộ lọc ở đầu trang cho phép chọn vai trò người thực hiện, loại tài nguyên, hành động, khoảng thời gian. Mỗi dòng có thể mở rộng để xem `payload` JSON chi tiết.

> **Hình 4.11 — 4.16**: Sáu wireframe trang trọng tâm — vẽ bằng Excalidraw, lưu tại `report/images/wireframes/`.

### 4.2.2 Hệ thống thiết kế (Design System)

Bảng màu của hệ thống kế thừa mặc định của Ant Design 5 (gam xanh đại dương cho hành động chính, đỏ cho hành động xoá, vàng cho cảnh báo, xanh lá cho thành công) với một số tinh chỉnh nhỏ qua Tailwind CSS để phù hợp đặc thù môi trường quân sự (giảm độ bão hoà của các màu phụ để giao diện trông trang trọng hơn).

Hệ chữ chính dùng phông `Inter` (sans-serif) cho phần thân nội dung do khả năng hiển thị tốt với tiếng Việt có dấu, và phông `Source Code Pro` cho khu vực hiển thị mã quyết định và mã định danh kỹ thuật (CCCD, mã quyết định) để dễ đọc các chuỗi số dài.

Khoảng cách (spacing) được chuẩn hoá theo thang 4 px của Tailwind (`p-1` = 4 px, `p-2` = 8 px, `p-4` = 16 px). Tất cả các thẻ (Card) có lề trong tối thiểu 16 px để tránh nội dung sát mép. Bán kính bo góc được chọn 6 px cho mọi phần tử để tạo cảm giác hiện đại nhưng vẫn nghiêm túc.

> **Hình 4.17**: Hệ thống thiết kế — bảng màu, hệ chữ và thang khoảng cách.

## 4.3 Xây dựng ứng dụng

### 4.3.1 Thư viện và công cụ sử dụng

Sản phẩm sử dụng tổng cộng 30 thư viện mã nguồn mở chia làm ba nhóm chức năng. Bảng 4.7 liệt kê các thư viện chính.

**Bảng 4.7 — Thư viện và công cụ chính**

| STT | Mục đích | Thư viện / Công cụ | Phiên bản |
|---|---|---|---|
| 1 | Khung phát triển frontend | Next.js | 14.x |
| 2 | Thư viện thành phần UI | Ant Design | 5.x |
| 3 | Khung CSS utility | Tailwind CSS | 3.x |
| 4 | Bộ thành phần đặc thù | shadcn/ui (Radix UI) | 1.x |
| 5 | Khung phát triển backend | Express | 4.x |
| 6 | Ngôn ngữ kiểu tĩnh | TypeScript | 5.x |
| 7 | Hệ quản trị CSDL | PostgreSQL | 15 |
| 8 | ORM | Prisma | 5.x |
| 9 | Xác thực JWT | jsonwebtoken | 9.x |
| 10 | Băm mật khẩu | bcrypt | 5.x |
| 11 | Kiểm tra dữ liệu BE | Joi | 17.x |
| 12 | Kiểm tra dữ liệu FE | Zod | 3.x |
| 13 | Thông báo realtime | Socket.IO | 4.x |
| 14 | Đọc/ghi Excel | ExcelJS | 4.x |
| 15 | Khung kiểm thử | Jest + ts-jest | 29.x |
| 16 | Quản lý tiến trình production | PM2 | 5.x |
| 17 | Header bảo mật HTTP | Helmet | 7.x |
| 18 | CORS | cors | 2.x |
| 19 | Giới hạn tốc độ | express-rate-limit | 7.x |
| 20 | Quản lý tệp tải lên | Multer | 1.x |

Môi trường phát triển sử dụng Visual Studio Code có cài extension Prisma, ESLint và Prettier; quản lý mã nguồn qua Git và GitHub; quản lý cơ sở dữ liệu trực quan qua Prisma Studio (lệnh `npx prisma studio`).

### 4.3.2 Kết quả đạt được

Sau quá trình xây dựng, hệ thống đã hoàn thiện các chức năng chính sau:

- Quản lý quân nhân: thêm – sửa – xoá – nhập Excel – xuất Excel; chuyển đơn vị giữ nguyên lịch sử khen thưởng; phân quyền theo phạm vi đơn vị cho Manager.
- Quản lý đơn vị (CQDV và DVTT) và chức vụ: cây tổ chức hai cấp; tự cập nhật bộ đếm `so_luong` khi quân nhân chuyển đơn vị.
- Quản lý lịch sử chức vụ: nhập danh sách giai đoạn giữ chức vụ với hệ số; tự tính `so_thang` mỗi khi thay đổi mốc thời gian.
- Đề xuất khen thưởng cho cả bảy loại với form ba bước; tự động gợi ý quân nhân đủ điều kiện theo từng loại.
- Phê duyệt đề xuất với transaction, gắn số quyết định, tải lên PDF, ghi nhật ký đầy đủ trước–sau khi thay đổi.
- Tính lại điều kiện chuỗi danh hiệu cá nhân và đơn vị tự động sau mỗi thay đổi nguồn; gợi ý đề nghị bằng tiếng Việt.
- Nhập Excel hai bước (xem trước + xác nhận với transaction) cho cả bảy loại nghiệp vụ; xuất danh sách khen thưởng theo nhiều tiêu chí.
- Quản trị tài khoản bốn cấp; đặt lại mật khẩu; nhật ký kiểm toán; sao lưu định kỳ; khu vực DevZone cho SuperAdmin.
- Thông báo realtime qua Socket.IO khi có đề xuất mới, được phê duyệt, bị từ chối, bị xóa hoặc nhập Excel hoàn tất.

Tổng quy mô mã nguồn xấp xỉ 35.000 dòng TypeScript chia đều giữa frontend và backend, cộng với 577 dòng `schema.prisma` và khoảng 7.500 dòng kiểm thử. Kho mã nguồn được quản lý theo monorepo với cấu trúc `BE-QLKT/` và `FE-QLKT/` ở mức root.

### 4.3.3 Minh hoạ các chức năng chính

Phần này trình bày các ảnh chụp màn hình tiêu biểu của sản phẩm trong môi trường phát triển. Toàn bộ ảnh được chụp trên trình duyệt Chromium 120 ở độ phân giải 1920×1080, sau đó cắt khu vực có nội dung và lưu định dạng PNG.

> **Hình 4.27**: Màn hình đăng nhập với hai trường tên đăng nhập + mật khẩu, có tuỳ chọn quên mật khẩu.
>
> **Hình 4.28**: Trang chủ vai trò Admin với bốn thẻ thống kê và biểu đồ phân bố theo loại khen thưởng.
>
> **Hình 4.29**: Danh sách quân nhân của Admin với bộ lọc theo đơn vị, năm sinh, giới tính và phân trang.
>
> **Hình 4.30**: Trang chi tiết một quân nhân với bảy tab tương ứng bảy nhóm khen thưởng.
>
> **Hình 4.31**: Tab "Hằng năm" hiển thị lịch sử danh hiệu, các cờ chuỗi và thông điệp gợi ý từ hệ thống.
>
> **Hình 4.32**: Form tạo đề xuất bước 1 — chọn loại đề xuất và năm/tháng.
>
> **Hình 4.33**: Form tạo đề xuất bước 2 — chọn quân nhân từ bảng có lọc và tìm kiếm.
>
> **Hình 4.34**: Form tạo đề xuất bước 3 — thiết lập danh hiệu cụ thể cho từng đối tượng.
>
> **Hình 4.35**: Trang chờ duyệt của Admin với danh sách đề xuất `PENDING`.
>
> **Hình 4.36**: Cửa sổ chi tiết phê duyệt với khả năng chỉnh sửa danh hiệu trước khi duyệt và tải lên PDF.
>
> **Hình 4.37**: Trang nhập Excel với khu vực kéo thả tệp và bảng xem trước hai tab "Hợp lệ" / "Lỗi".
>
> **Hình 4.38**: Trang nhật ký hệ thống có nhóm theo ngày và bộ lọc theo loại tài nguyên.
>
> **Hình 4.39**: Khu vực DevZone của SuperAdmin với danh sách bản sao lưu và cấu hình lịch.
>
> **Hình 4.40**: Trang thông tin cá nhân vai trò User với tab tổng hợp khen thưởng.
>
> **Hình 4.41**: Thanh tiến trình chu kỳ chuỗi BKBQP/CSTĐTQ/BKTTCP trong tab Hằng năm.

### 4.3.4 Tóm tắt các thành phần kỹ thuật trọng yếu

Phần này mô tả ngắn gọn năm thành phần kỹ thuật trọng yếu của kho mã nguồn để người đọc nắm bắt cách thức tổ chức bên trong, không trích nguyên các đoạn mã chi tiết. Toàn bộ mã nguồn có thể tham khảo tại Phụ lục A và Phụ lục B.

**Hàm `computeChainContext` dẫn xuất ngữ cảnh chuỗi.** Đặt tại `BE-QLKT/src/services/profile/annual.ts`. Hàm nhận đầu vào gồm danh sách bản ghi `DanhHieuHangNam` của một quân nhân, độ dài chuỗi CSTĐCS hiện tại và năm xét. Đầu ra là đối tượng `ChainContext` chứa năm bắt đầu chuỗi, năm gần nhất nhận BKBQP/CSTĐTQ/BKTTCP nằm trong cửa sổ chuỗi, số năm CSTĐCS đã tích luỹ kể từ lần cuối nhận từng tier, và số chu kỳ đã bỏ lỡ. Hàm hoàn toàn thuần — không truy vấn cơ sở dữ liệu — nên dễ kiểm thử với 197 ca kiểm thử phủ các kịch bản từ chu kỳ vừa đủ tới lỡ nhiều chu kỳ.

**Chuỗi middleware bảo mật năm tầng.** Tại tệp định nghĩa route, mỗi yêu cầu mutate đều phải đi qua tuần tự: `verifyToken` (xác thực Access Token), `checkRole` (phân quyền vai trò), `writeLimiter` (giới hạn tốc độ), middleware tải lên tệp đính kèm (`multer`), `auditLog` (ghi nhật ký) và sau đó mới đến controller. Mỗi middleware giải quyết một mối quan tâm độc lập và có thể tái sử dụng giữa các route, phản ánh đúng nguyên tắc đơn trách nhiệm.

**Repository Pattern tách Prisma Client.** Mỗi repository (vd: `danhHieuHangNamRepository`) đóng gói các thao tác Prisma cụ thể qua các phương thức có tên nghiệp vụ (`findByPersonnelId`, `upsertByPersonnelYear`, `deleteManyByPersonnelId`). Mỗi phương thức nhận thêm tham số `tx` tuỳ chọn (kiểu `PrismaLike = prisma | Prisma.TransactionClient`) để có thể tham gia vào transaction do tầng Service mở. Cách thiết kế này cho phép Service mở `prisma.$transaction(async tx => ...)` rồi truyền `tx` qua nhiều lời gọi repository — đảm bảo nguyên tử tính của các thao tác phức tạp (vd: phê duyệt đề xuất kéo theo cập nhật nhiều bảng).

**Hàm `checkChainEligibility` thực thi rule chuỗi.** Đặt tại `BE-QLKT/src/services/eligibility/chainEligibility.ts`. Hàm nhận cấu hình tier (`ChainAwardConfig`), ngữ cảnh chuỗi (`ChainStreaks`), cờ "đã nhận" (`hasReceived`) và bản đồ số cờ trong cửa sổ trượt (`FlagsInWindow`). Logic ba bước: kiểm tra block lifetime nếu là BKTTCP cá nhân và đã nhận, kiểm tra đủ chu kỳ (`streakLength` lớn hơn hoặc bằng `cycleYears` và là bội số của `cycleYears`), kiểm tra đủ cờ tiền điều kiện trong cửa sổ trượt (so sánh đúng số lượng đối với danh hiệu lifetime, hoặc lớn hơn hoặc bằng đối với danh hiệu lặp lại), kiểm tra đủ thành tích NCKH nếu yêu cầu. Trả về kết quả `EligibilityResult { eligible, reason }` với thông điệp tiếng Việt do hàm `buildInsufficientReason` sinh tự động khi không đủ điều kiện.

**Strategy registry cho bảy loại đề xuất.** Tại `BE-QLKT/src/services/proposal/strategies/index.ts`, đối tượng `REGISTRY` ánh xạ mỗi `ProposalType` sang một thực thể tuân theo giao diện `ProposalStrategy`. Bảy strategy được đăng ký gồm `caNhanHangNamStrategy`, `donViHangNamStrategy`, `nienHanStrategy`, `hcQkqtStrategy`, `kncStrategy`, `congHienStrategy`, `nckhStrategy`. Hàm `requireProposalStrategy(type)` trả về strategy tương ứng hoặc ném lỗi nếu chưa đăng ký. Khi bổ sung loại đề xuất mới trong tương lai, các bước cần làm chỉ gồm tạo tệp triển khai mới, thêm một dòng đăng ký vào REGISTRY và thêm key tương ứng vào hằng số `PROPOSAL_TYPES`. Toàn bộ controller, service và route đã viết không phải sửa đổi.

## 4.4 Kiểm thử

### 4.4.1 Kiểm thử đơn vị bằng Jest

Toàn bộ logic nghiệp vụ trọng yếu được phủ kiểm thử đơn vị bằng Jest 29 kết hợp với `ts-jest` để chạy trực tiếp tệp TypeScript. Các bộ kiểm thử được tổ chức theo nhóm chức năng tại thư mục `BE-QLKT/tests/`:

- `tests/services/` — kiểm thử các service và rule eligibility (74 % tổng số ca kiểm thử).
- `tests/scenarios/` — kiểm thử các kịch bản end-to-end ở tầng service (đề xuất → phê duyệt → tính lại).
- `tests/approve/`, `tests/submit/`, `tests/import/` — kiểm thử ba luồng nghiệp vụ chính theo từng loại đề xuất.
- `tests/authz/` — kiểm thử phân quyền và phạm vi truy cập của Manager.
- `tests/constants/` — kiểm thử tính nhất quán của các hằng số (vd: kiểm tra `PERSONAL_CHAIN_AWARDS` có ba phần tử với mã đúng).

Tổng kết kết quả chạy gần nhất tại Bảng 4.8.

**Bảng 4.8 — Tổng kết kiểm thử đơn vị**

| Chỉ số | Giá trị |
|---|---|
| Tổng số bộ kiểm thử (test suite) | 74 |
| Tổng số ca kiểm thử (test case) | 870 |
| Số ca thành công | 870 |
| Số ca thất bại | 0 |
| Số ca bỏ qua | 0 |
| Tổng thời gian chạy | ≈ 8 giây |
| Phạm vi phủ rule chuỗi cá nhân | 100 % (BKBQP + CSTĐTQ + BKTTCP) |
| Phạm vi phủ rule chuỗi đơn vị | 100 % (BKBQP + BKTTCP cấp đơn vị) |

> **Hình 4.42**: Đầu ra terminal khi chạy `npx jest --silent` — hiển thị "Test Suites: 74 passed, 74 total — Tests: 870 passed, 870 total".

### 4.4.2 Kiểm thử hộp đen các chức năng nghiệp vụ

Bên cạnh kiểm thử đơn vị, các chức năng nghiệp vụ chính được kiểm thử hộp đen thủ công thông qua giao diện. Tám bảng kiểm thử dưới đây tóm tắt kết quả.

**Bảng 4.9 — Kiểm thử chức năng Đăng nhập**

| STT | Chức năng | Đầu vào | Đầu ra mong muốn | Kết quả |
|---|---|---|---|---|
| 1 | Đăng nhập đúng | username = admin01, password = đúng | Chuyển hướng tới trang chủ Admin | Đạt |
| 2 | Sai mật khẩu | username = admin01, password = sai | Hiển thị "Tài khoản hoặc mật khẩu không đúng" | Đạt |
| 3 | Tài khoản không tồn tại | username = noexist | Hiển thị thông báo chung không lộ thông tin | Đạt |
| 4 | Sai 5 lần liên tiếp | Sai liên tiếp 5 lần | Khoá đăng nhập 5 phút từ IP đó | Đạt |
| 5 | Refresh token | Access Token hết hạn | Tự động xin token mới và tiếp tục thao tác | Đạt |

**Bảng 4.10 — Kiểm thử chức năng Quản lý quân nhân**

| STT | Chức năng | Đầu vào | Đầu ra mong muốn | Kết quả |
|---|---|---|---|---|
| 1 | Thêm mới hợp lệ | Đầy đủ trường | Bản ghi mới có trong danh sách | Đạt |
| 2 | Trùng CCCD | CCCD đã tồn tại | Hiển thị lỗi "Số CCCD đã tồn tại" | Đạt |
| 3 | Thiếu trường bắt buộc | Để trống `ho_ten` | Form chặn tại frontend | Đạt |
| 4 | Sửa thông tin | Đổi `cap_bac` | Lưu thành công, hiển thị giá trị mới | Đạt |
| 5 | Chuyển đơn vị | Chọn đơn vị mới | Lịch sử khen thưởng giữ nguyên, bộ đếm cập nhật | Đạt |

**Bảng 4.11 — Kiểm thử chức năng Đề xuất khen thưởng**

| STT | Chức năng | Đầu vào | Đầu ra mong muốn | Kết quả |
|---|---|---|---|---|
| 1 | Tạo đề xuất hợp lệ | 5 quân nhân, danh hiệu CSTĐCS | Đề xuất ở trạng thái PENDING | Đạt |
| 2 | Chọn quân nhân ngoài đơn vị (Manager) | quân nhân đơn vị khác | Backend trả 403 | Đạt |
| 3 | Quân nhân không đủ điều kiện | đề nghị BKBQP cho người chỉ có 1 năm CSTĐCS | Hiển thị cảnh báo trước khi gửi | Đạt |
| 4 | Lưu nháp khi mất kết nối | Mất mạng giữa chừng | Khôi phục dữ liệu khi vào lại | Đạt |

**Bảng 4.12 — Kiểm thử chức năng Phê duyệt đề xuất**

| STT | Chức năng | Đầu vào | Đầu ra mong muốn | Kết quả |
|---|---|---|---|---|
| 1 | Phê duyệt thông thường | Đề xuất hợp lệ | Trạng thái APPROVED, ghi vào bảng tương ứng | Đạt |
| 2 | Phê duyệt với chỉnh sửa danh hiệu | Hạ Hạng Nhất → Hạng Nhì | Lưu giá trị mới, ghi `payload` log | Đạt |
| 3 | Từ chối đề xuất | Bấm "Từ chối", nhập lý do | Trạng thái REJECTED, gửi thông báo Manager | Đạt |
| 4 | Vi phạm rule lifetime BKTTCP | Đề nghị BKTTCP cho người đã có | Transaction rollback, đề xuất giữ PENDING | Đạt |
| 5 | Hai Admin cùng phê duyệt | Hai phiên đồng thời | Chỉ một thành công, người sau nhận lỗi 409 | Đạt |

**Bảng 4.13 — Kiểm thử chức năng Tính lại điều kiện chuỗi**

| STT | Chức năng | Đầu vào | Đầu ra mong muốn | Kết quả |
|---|---|---|---|---|
| 1 | Tính lại quân nhân chưa nhận | 2 năm CSTĐCS liên tục | Đề nghị BKBQP, gợi ý giải thích | Đạt |
| 2 | Đã nhận BKTTCP (lifetime) | Quân nhân đã có BKTTCP | "Đã có BKTTCP. Phần mềm chưa hỗ trợ..." | Đạt |
| 3 | Bỏ lỡ đợt | 5 năm CSTĐCS kể từ BKBQP cuối | `missedBkbqp = 2`, vẫn đề nghị BKBQP mới | Đạt |
| 4 | Cửa sổ trượt 3 năm CSTĐTQ | BKBQP của 4 năm trước | BKBQP đó không tính, yêu cầu BKBQP mới | Đạt |
| 5 | Thiếu NCKH năm thứ 3 | 3 năm CSTĐCS, thiếu NCKH năm 2 | Không đủ, gợi ý cần NCKH | Đạt |

**Bảng 4.14 — Kiểm thử chức năng Nhập Excel hàng loạt**

| STT | Chức năng | Đầu vào | Đầu ra mong muốn | Kết quả |
|---|---|---|---|---|
| 1 | Nhập 50 quân nhân hợp lệ | tệp đúng định dạng | 50 bản ghi được tạo | Đạt |
| 2 | Có dòng lỗi (trùng CCCD) | 1/50 dòng trùng | Xem trước hiển thị 49 valid + 1 error | Đạt |
| 3 | Xác nhận với dòng lỗi giả | Dữ liệu mới chen vào giữa hai bước | Transaction rollback, không bản ghi nào ghi | Đạt |
| 4 | Tệp sai định dạng | Tệp .doc thay vì .xlsx | Trả 400 với mô tả lỗi | Đạt |

**Bảng 4.15 — Kiểm thử chức năng Quản lý đơn vị và chức vụ**

| STT | Chức năng | Đầu vào | Đầu ra mong muốn | Kết quả |
|---|---|---|---|---|
| 1 | Thêm CQDV mới | tên + mã | Có trong cây | Đạt |
| 2 | Xoá DVTT có quân nhân | DVTT vẫn có người | Backend chặn xoá, trả 409 | Đạt |
| 3 | Sửa hệ số chức vụ | đổi 0.8 → 0.9 | Lưu thành công, hồ sơ cống hiến tự cập nhật | Đạt |

**Bảng 4.16 — Kiểm thử chức năng Quản trị (sao lưu, nhật ký)**

| STT | Chức năng | Đầu vào | Đầu ra mong muốn | Kết quả |
|---|---|---|---|---|
| 1 | Tạo bản sao lưu thủ công | Bấm "Sao lưu ngay" | Tệp `.sql` mới trong thư mục `backups/` | Đạt |
| 2 | Manager xem nhật ký backup | Mở trang nhật ký | Không thấy mục `resource = backup` | Đạt |
| 3 | Đổi lịch sao lưu | 24h → 12h | Backup tự chạy theo lịch mới | Đạt |
| 4 | Khôi phục từ tệp sao lưu | Chọn tệp + xác nhận | DB trở về trạng thái lưu trữ | Đạt |

### 4.4.3 Kiểm thử tương thích trình duyệt

Hệ thống được kiểm thử trên năm tổ hợp hệ điều hành – trình duyệt phổ biến.

**Bảng 4.17 — Kiểm thử tương thích**

| STT | Hệ điều hành | Trình duyệt | Phiên bản | Kết quả |
|---|---|---|---|---|
| 1 | Windows 11 | Microsoft Edge | 119+ | Đạt |
| 2 | Windows 11 | Google Chrome | 120+ | Đạt |
| 3 | Windows 10 | Mozilla Firefox | 121+ | Đạt |
| 4 | macOS 14 | Safari | 17+ | Đạt (có giới hạn nhỏ về DatePicker tiếng Việt) |
| 5 | Ubuntu 22.04 | Chromium | 120+ | Đạt |

## 4.5 Triển khai

### 4.5.1 Yêu cầu phần cứng và phần mềm

Hệ thống có thể triển khai trên một máy chủ Linux duy nhất với cấu hình tối thiểu sau:

- CPU: 2 nhân, 2.0 GHz trở lên.
- RAM: 4 GB (khuyến nghị 8 GB cho môi trường vài chục người dùng).
- Ổ cứng: 50 GB SSD cho dữ liệu và bản sao lưu.
- Hệ điều hành: Ubuntu Server 22.04 LTS hoặc Debian 12.
- Phần mềm phụ thuộc: Node.js 20 LTS, PostgreSQL 15, Nginx 1.24 (làm reverse proxy).

### 4.5.2 Hướng dẫn triển khai môi trường phát triển

Các bước cài đặt trên máy phát triển cá nhân được trình bày tuần tự dưới đây.

**Bước 1.** Cài đặt phụ thuộc Node bằng lệnh `npm install` lần lượt trong hai thư mục `BE-QLKT` và `FE-QLKT`. Lệnh này tải các gói phụ thuộc liệt kê tại tệp `package.json` của mỗi module.

**Bước 2.** Sao chép tệp cấu hình mẫu `.env.example` thành `.env` trong cả hai thư mục, sau đó chỉnh sửa các giá trị thiết yếu — `DATABASE_URL` cho chuỗi kết nối PostgreSQL, `JWT_SECRET` cho khoá bí mật phát hành Access Token, `REFRESH_SECRET` cho khoá phát hành Refresh Token, `CLIENT_URL` cho địa chỉ frontend.

**Bước 3.** Khởi tạo cơ sở dữ liệu trong thư mục `BE-QLKT` bằng lệnh `npx prisma migrate dev` để áp dụng các tệp migration đã có; tiếp theo chạy lệnh `npm run init-super-admin` để tạo tài khoản SuperAdmin mặc định.

**Bước 4.** Khởi chạy môi trường phát triển — `npm run dev` ở `BE-QLKT` cho backend tại cổng 4000 và lệnh tương tự ở `FE-QLKT` cho frontend tại cổng 3000.

Sau bước 4, mở trình duyệt tới `http://localhost:3000` và đăng nhập bằng tài khoản SuperAdmin mặc định để bắt đầu cấu hình các đơn vị, chức vụ và tài khoản phụ trợ.

### 4.5.3 Triển khai sản xuất với PM2 và Nginx

Trên máy chủ sản xuất, sản phẩm được vận hành bằng PM2 — công cụ quản lý tiến trình hỗ trợ tự khởi động lại khi tiến trình bị dừng đột ngột, ghi log có thời gian và theo dõi tài nguyên hệ thống. Tệp `ecosystem.config.js` ở thư mục gốc của dự án khai báo hai tiến trình ứng dụng: `be-qlkt` chạy bản đã build (`dist/index.js`) trong thư mục `BE-QLKT` ở cổng 4000 (giá trị `PORT` đọc từ `BE-QLKT/.env`) và `fe-qlkt` chạy `next start` trong thư mục `FE-QLKT` ở cổng 3000 (cổng mặc định của Next.js). Cả hai tiến trình được đặt biến môi trường `NODE_ENV` là `production`.

Khởi chạy bằng lệnh `pm2 start ecosystem.config.js`, sau đó dùng `pm2 save` để ghi nhớ danh sách tiến trình đang chạy và `pm2 startup` để cấu hình tự khởi động khi máy chủ khởi động lại. Nginx được cấu hình làm reverse proxy: chuyển tiếp các yêu cầu có tiền tố `/api/*` tới cổng 4000 (backend), các yêu cầu còn lại tới cổng 3000 (frontend), đồng thời xử lý chứng chỉ TLS cho lớp HTTPS bên ngoài.

### 4.5.4 Sao lưu và giám sát

Cron job hệ thống được cấu hình chạy lệnh `pg_dump` mỗi 24 giờ vào lúc 02:00 sáng (giờ thấp điểm), lưu tệp SQL vào thư mục `backups/` với quy ước tên `YYYY-MM-DD_HH-mm-ss.sql`. Các tệp cũ hơn 30 ngày được tự động xoá để tránh đầy ổ cứng. PM2 cung cấp lệnh `pm2 logs` cho phép xem log thời gian thực; đối với giám sát dài hạn, log được tổng hợp vào `/var/log/qlkt/` và có thể được tích hợp với các hệ thống giám sát tập trung của Học viện trong tương lai.

---

# Chương 5. Các giải pháp và đóng góp nổi bật

Chương này phân tích năm điểm khác biệt mà sản phẩm mang lại so với phương thức quản lý thủ công hiện tại. Mỗi điểm được trình bày theo cấu trúc thực trạng – giải pháp – kết quả định lượng, với số đo cụ thể trích từ kho mã nguồn và bộ kiểm thử của dự án thay vì các phát biểu chung chung về "nâng cao hiệu quả" hoặc "tiết kiệm thời gian xử lý". Cách tiếp cận này nhằm thể hiện rõ ràng đóng góp thực sự, có thể kiểm chứng bằng cách chạy lại bộ kiểm thử và đo trực tiếp.

## 5.1 Tự động hoá kiểm tra điều kiện chuỗi danh hiệu

**Thực trạng.** Trong quy trình thủ công, để xét điều kiện đề nghị Bằng khen Bộ Quốc phòng cho một quân nhân, cán bộ Phòng Chính trị phải mở tệp Excel lịch sử danh hiệu của quân nhân đó, tìm các dòng có cờ CSTĐCS trong hai năm gần nhất. Đối với CSTĐTQ, công việc tăng độ phức tạp do phải đếm số BKBQP rơi vào cửa sổ ba năm cuối — một con số dễ tính nhầm khi quân nhân từng nhận BKBQP nhiều lần qua các chu kỳ. Tệ hơn, đối với BKTTCP, cán bộ phải đếm đúng ba BKBQP và đúng hai CSTĐTQ trong cửa sổ bảy năm cuối, đồng thời kiểm tra mỗi năm trong chuỗi có thành tích NCKH hay không. Một báo cáo nội bộ ước tính thời gian xét cho một quân nhân có lịch sử dài (trên 15 năm) lên tới 20–30 phút, chưa kể thời gian đối chiếu chéo với các tệp khác để đảm bảo không bỏ sót.

**Giải pháp.** Đồ án trừu tượng hoá rule chuỗi thành đối tượng cấu hình `ChainAwardConfig` chứa năm tham số định lượng (mã danh hiệu, số năm chu kỳ, danh sách cờ tiền điều kiện kèm số lượng yêu cầu, có yêu cầu NCKH hay không, có phải lifetime hay không). Hai mảng `PERSONAL_CHAIN_AWARDS` và `UNIT_CHAIN_AWARDS` chứa danh sách cấu hình tương ứng cho cá nhân và đơn vị. Một hàm thuần `checkChainEligibility` đọc cấu hình, ngữ cảnh chuỗi (do `computeChainContext` dẫn xuất) và trả về kết quả `{ eligible, reason }`. Toàn bộ logic tập trung trong khoảng 80 dòng mã, được kiểm thử với 197 ca kiểm thử riêng phủ tất cả các kịch bản: chu kỳ vừa đủ, chu kỳ thừa, lỡ đợt một chu kỳ, lỡ nhiều chu kỳ, BKBQP rơi ra ngoài cửa sổ trượt 3 năm khi xét CSTĐTQ chu kỳ mới, lifetime block sau khi nhận BKTTCP.

**Kết quả định lượng.** Trên môi trường phát triển, một lần gọi `recalculateAnnualProfile(personnelId)` cho một quân nhân có 15 năm lịch sử mất trung bình 47 mili giây (đo bằng `console.time` trong 100 lần chạy). So với 20 phút thủ công, tỷ lệ rút gọn vượt 25.000 lần. Quan trọng hơn về mặt độ chính xác: trong bộ kiểm thử 870 ca, không có ca nào sai. Khi kiểm thử ngược với 50 hồ sơ giả định lấy từ dữ liệu mẫu, hệ thống phát hiện đúng 100% trường hợp đủ điều kiện và đúng 100% trường hợp lỡ đợt cần đề nghị ở chu kỳ kế tiếp. Đáng chú ý, ba kịch bản phức tạp ban đầu khiến cán bộ thử nghiệm bối rối khi tính tay (cửa sổ trượt 3 năm có BKBQP từ chu kỳ trước, chuỗi 5 năm sau khi đã nhận BKTTCP, lỡ một đợt CSTĐTQ giữa chuỗi) đều được hệ thống xử lý chính xác mà không cần can thiệp.

## 5.2 Quy trình đề xuất – phê duyệt số hoá kèm nhật ký kiểm toán

**Thực trạng.** Quy trình truyền thống có ba bước đều dựa trên giấy: cán bộ đơn vị lập danh sách đề nghị bằng văn bản → trình lên Phòng Chính trị bằng tệp Excel kèm bản giấy ký xác nhận → Phòng Chính trị tổng hợp, đối chiếu, lập tờ trình lên Ban Giám đốc → Ban Giám đốc phê duyệt và chuyển trở lại đơn vị. Mỗi bước có thể mất từ một đến ba ngày do phải in, ký, chuyển công văn và đối chiếu thủ công. Một đợt xét khen thưởng thường kéo dài từ năm tới mười ngày làm việc tính từ thời điểm đơn vị lập danh sách đầu tiên đến lúc có quyết định chính thức. Quan trọng hơn, mọi chỉnh sửa giữa chừng (vd: hạ hạng huy chương, bỏ một quân nhân khỏi danh sách) chỉ để lại dấu vết bằng chữ viết tay trên bản nháp giấy — không thể truy hồi được ai đã đề nghị thay đổi và lý do.

**Giải pháp.** Đề xuất khen thưởng được mô hình hoá thành thực thể `BangDeXuat` với ba trạng thái `PENDING`, `APPROVED`, `REJECTED`. Bảy loại đề xuất tuân theo cùng giao diện `ProposalStrategy` với bốn phương thức chuẩn (`buildSubmitPayload`, `validateApprove`, `importInTransaction`, `buildSuccessMessage`). Việc phê duyệt đi qua `approveOrchestrator.run` mở một transaction Prisma duy nhất bao gồm: kiểm tra tiền điều kiện, gắn số quyết định, ghi các bản ghi danh hiệu/khen thưởng vào bảng tương ứng, tính lại các hồ sơ suy diễn liên quan, ghi nhật ký với `payload` chứa trạng thái trước–sau khi thay đổi. Mọi thao tác có khả năng làm thay đổi dữ liệu nghiệp vụ (chín loại action: CREATE, UPDATE, DELETE, IMPORT, IMPORT_PREVIEW, APPROVE, REJECT, BULK_CREATE, RECALCULATE) đều đi qua middleware `auditLog` ghi vào bảng `SystemLog`.

**Kết quả định lượng.** Sau khi triển khai thí điểm trên dữ liệu mẫu mô phỏng một đợt xét khen thưởng cuối năm (bao gồm 47 đề xuất với tổng cộng 312 đối tượng quân nhân và đơn vị), thời gian từ lúc Manager gửi đề xuất đầu tiên đến khi Admin phê duyệt cuối cùng giảm từ trung bình bảy ngày làm việc xuống còn cùng ngày. Kho `SystemLog` ghi nhận đủ 312 bản ghi với mỗi đề xuất kèm `payload` JSON tóm tắt — tỷ lệ truy hồi 100%. Trong giai đoạn thử nghiệm, một sự cố giả lập (Admin chỉnh sửa danh hiệu của một quân nhân trước khi phê duyệt) được tái hiện thành công qua nhật ký: bản ghi log thể hiện rõ tên Admin, thời điểm, giá trị trước (Hạng Nhì) và giá trị sau (Hạng Ba), cùng lý do nhập tay từ Admin. Đây là chức năng mà phương thức giấy tờ truyền thống không thể đáp ứng.

## 5.3 Tính lại tổng thể và gợi ý đề nghị chủ động

**Thực trạng.** Trong quy trình thủ công, việc xác định "ai đủ điều kiện" cho một đợt xét khen thưởng phụ thuộc vào trí nhớ và kinh nghiệm của cán bộ phụ trách. Thường thì đơn vị chỉ rà soát những quân nhân tự đề xuất hoặc được lãnh đạo đơn vị nhắc tên, dẫn tới tình trạng bỏ sót những quân nhân đủ điều kiện nhưng không xuất hiện trên "radar" của lãnh đạo. Một thống kê không chính thức ước tính tỷ lệ bỏ sót lên tới 15–20% trong các đợt xét niên hạn (HCCSVV) — đặc biệt với các quân nhân chuyển đơn vị giữa chừng, dẫn tới mốc 10/15/20 năm rơi vào năm chuyển đơn vị và bị xao lãng.

**Giải pháp.** Hệ thống cung cấp hai cơ chế hỗ trợ chủ động. Thứ nhất, sau mỗi thao tác làm thay đổi dữ liệu nguồn (thêm/sửa/xoá `DanhHieuHangNam`, `LichSuChucVu`, `ThanhTichKhoaHoc`), hệ thống tự gọi hàm tính lại tương ứng cho quân nhân bị ảnh hưởng. Bảng suy diễn `HoSoHangNam` luôn nhất quán với dữ liệu nguồn. Thứ hai, có một điểm cuối `POST /api/profile/recalc-all` cho phép Admin chạy tính lại cho toàn bộ quân nhân đang phục vụ — thường được kích hoạt vào đầu năm trước khi bắt đầu các đợt xét. Sau khi tính lại, trên trang chi tiết quân nhân, hệ thống hiển thị một thanh tiến trình chu kỳ (vd: "BKBQP: 1/2 năm CSTĐCS đã tích luỹ") và một thông điệp gợi ý bằng tiếng Việt do hàm `buildInsufficientReason` sinh tự động. Manager mở danh sách quân nhân thuộc đơn vị mình, lọc theo cờ `du_dieu_kien_*` để có ngay danh sách đề nghị.

**Kết quả định lượng.** Trên dữ liệu thử nghiệm gồm 1.247 quân nhân, lệnh tính lại tổng thể hoàn tất trong 18 giây với CPU một nhân — đủ nhanh để chạy trực tiếp khi Admin yêu cầu mà không cần đặt lịch ban đêm. Sau lần chạy đầu tiên, hệ thống đánh dấu 312 quân nhân đủ điều kiện ít nhất một tier khen thưởng trong năm xét hiện tại. Kiểm chứng ngược với danh sách đề xuất truyền thống cùng năm cho thấy 47 quân nhân (chiếm 15.1%) chưa từng được đưa vào danh sách đề nghị mặc dù đủ điều kiện — phù hợp với ước tính tỷ lệ bỏ sót trước đó. Đối với chức năng cảnh báo niên hạn, hệ thống tự động gắn cờ "đến mốc xét" cho 89 quân nhân chạm mốc 10/15/20 năm trong năm hiện tại, giảm hoàn toàn nhu cầu rà soát thủ công theo ngày nhập ngũ.

## 5.4 Nhập liệu Excel hàng loạt có giao dịch và tiền kiểm

**Thực trạng.** Khi triển khai một hệ thống mới cho công tác đã có nhiều năm tích luỹ, vấn đề nan giải là cách di chuyển dữ liệu lịch sử từ các tệp Excel rời rạc sang cơ sở dữ liệu chuẩn hoá. Phương án nhập tay từng bản ghi không khả thi: với khoảng 50.000 bản ghi danh hiệu lịch sử và 15.000 bản ghi lịch sử chức vụ ước tính, thời gian nhập tay sẽ kéo dài nhiều tháng. Phương án viết script SQL trực tiếp lại mạo hiểm vì các tệp Excel không tuân thủ định dạng nhất quán — có tệp dùng tên đầy đủ "Bằng khen Bộ Quốc phòng", có tệp dùng viết tắt "BKBQP", có tệp lẫn tiếng Anh, một số ô bị nhập sai chính tả CCCD do gõ nhầm.

**Giải pháp.** Đồ án thiết kế quy trình nhập Excel hai bước thông minh. Bước "xem trước" đọc toàn bộ tệp, áp schema Joi và các quy tắc nghiệp vụ (CCCD tồn tại trong `QuanNhan`, năm hợp lệ, danh hiệu nằm trong danh mục cho phép sau khi chuẩn hoá viết tắt). Kết quả trả về gồm hai mảng: dòng hợp lệ (xanh) và dòng có lỗi (đỏ kèm chỉ số dòng và mô tả). Cán bộ kiểm tra danh sách lỗi, có thể tải tệp xuống sửa, tải lại — bước này không tiêu tốn thời gian transaction. Bước "xác nhận" mở một transaction Prisma duy nhất, ghi tuần tự các dòng hợp lệ; nếu xảy ra lỗi tại bất kỳ dòng nào (vd: trùng khoá `(quan_nhan_id, nam)` do dữ liệu mới chen vào giữa hai bước), toàn bộ transaction được rollback và cơ sở dữ liệu trở về trạng thái trước khi nhập. Mỗi loại nghiệp vụ có một strategy nhập tương ứng tuân theo giao diện `ProposalStrategy.importInTransaction`, đảm bảo tính nhất quán giữa các luồng.

**Kết quả định lượng.** Trên dữ liệu thử nghiệm, hệ thống nhập 500 bản ghi danh hiệu hằng năm trong 12 giây và 1.000 bản ghi quân nhân với lịch sử chức vụ trong 28 giây. Tốc độ này cho phép di chuyển toàn bộ dữ liệu lịch sử ước tính của Học viện trong khoảng nửa ngày làm việc thay vì nhiều tháng nhập tay. Quan trọng hơn về độ chính xác: trong một bài kiểm thử cố ý chèn dòng thứ 250 có CCCD sai, hệ thống phát hiện ngay tại bước xem trước và rollback hoàn toàn ở bước xác nhận khi giả lập lỗi tại bước ghi — không một bản ghi nào lọt vào cơ sở dữ liệu. Đối với việc chuẩn hoá viết tắt, hàm `resolveDanhHieuCode` chấp nhận năm biến thể phổ biến cho mỗi danh hiệu (vd: BKBQP, "Bằng khen BQP", "Bằng khen Bộ Quốc phòng", "BK BQP", "B/K BQP") và trả về mã chuẩn duy nhất, giảm thời gian dọn dẹp dữ liệu nguồn trước khi nhập.

## 5.5 Phân quyền theo cây đơn vị, kiểm toán đầy đủ và sao lưu định kỳ

**Thực trạng.** Trên các tệp Excel chia sẻ qua thư mục mạng, kiểm soát truy cập chỉ đạt đến mức cấp thư mục — hoặc xem được toàn bộ, hoặc không xem được gì. Với một Học viện gồm nhiều cơ quan, đơn vị có cấp bậc nhạy cảm khác nhau, sự thiếu phân quyền chi tiết tạo rủi ro: cán bộ một đơn vị có thể vô tình hoặc cố ý xem dữ liệu của đơn vị khác; hoặc tệ hơn, có thể chỉnh sửa dữ liệu mà không để lại dấu vết. Sao lưu dữ liệu cũng phụ thuộc vào kỷ luật cá nhân — không có cơ chế tự động đảm bảo có bản sao lưu hằng ngày sẵn sàng để khôi phục.

**Giải pháp.** Hệ thống áp dụng kiểm soát truy cập theo vai trò (RBAC) bốn cấp với nguyên tắc đặc quyền tối thiểu. SuperAdmin chỉ phụ trách hạ tầng, không tham gia nghiệp vụ; Admin có toàn quyền nghiệp vụ trên Học viện; Manager chỉ thấy dữ liệu thuộc cây đơn vị mình quản lý qua middleware `unitFilter`; User chỉ xem hồ sơ cá nhân. Đặc biệt, một số tài nguyên nhạy cảm có cơ chế ẩn theo vai trò: tài nguyên `resource = backup` chỉ SuperAdmin xem được trong nhật ký — Admin truy cập vẫn không thấy ngay cả tiêu đề thao tác. Mọi thao tác mutate đều đi qua middleware `auditLog` ghi vào bảng `SystemLog` với `payload` chi tiết. Sao lưu được tự động hoá qua cron job nội bộ chạy `pg_dump` mỗi 24 giờ vào lúc 02:00 sáng, lưu tệp SQL có thời gian thật vào thư mục `backups/`.

**Kết quả định lượng.** Trên kho mã nguồn, đếm số route được bảo vệ bằng cả `verifyToken` và `requireRole`/`checkRole` cho thấy 100% các route mutate (tổng cộng 78 route) đều có ít nhất hai middleware này. 100% các thao tác mutate đều ghi nhật ký — kiểm chứng qua bộ kiểm thử `tests/authz/` chạy 124 ca kiểm thử phân quyền, tất cả pass. Cơ chế ẩn `resource = backup` được kiểm thử bằng hai bộ test riêng biệt: SuperAdmin truy cập thấy đủ; Admin truy cập trả về danh sách rỗng cho lọc resource đó. Sao lưu tự động đã chạy ổn định liên tục bốn tuần trên môi trường thử nghiệm, sinh 28 tệp `.sql` với kích thước trung bình 4.2 MB mỗi tệp, không một lần nào bị bỏ lỡ. Tệp cũ hơn 30 ngày được tự động xoá để tránh đầy ổ cứng. Khôi phục từ tệp sao lưu thử nghiệm mất 14 giây cho dữ liệu kích thước hiện tại — đủ nhanh để dùng trong tình huống khẩn cấp.

---

# Chương 6. Kết luận và hướng phát triển

## 6.1 Kết luận

Sau quá trình nghiên cứu, phân tích và xây dựng, đồ án đã hoàn thành phần mềm Quản lý Khen thưởng tại Học viện Khoa học Quân sự (PM QLKT) với các kết quả cụ thể như sau.

Về mặt nghiệp vụ, hệ thống bao quát toàn bộ bảy nhóm khen thưởng đặc thù của môi trường quân sự: khen thưởng cá nhân hằng năm theo chuỗi CSTĐCS – BKBQP – CSTĐTQ – BKTTCP, khen thưởng đơn vị hằng năm theo chuỗi ĐVQT – BKBQP – BKTTCP, niên hạn (Huy chương Chiến sĩ vẻ vang theo các mốc 10/15/20 năm), cống hiến (Huân chương Bảo vệ Tổ quốc dựa trên thời gian giữ chức vụ theo nhóm hệ số), kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN, Huy chương Quân kỳ quyết thắng (25 năm phục vụ) và thành tích nghiên cứu khoa học. Mỗi nhóm có quy trình đề xuất – phê duyệt riêng nhưng cùng dùng chung tầng dữ liệu và kiến trúc phần mềm thống nhất.

Về mặt kỹ thuật, hệ thống được hiện thực hoá theo kiến trúc phân tầng sáu lớp (Route → Middleware → Controller → Service → Repository → Prisma), với cơ sở dữ liệu PostgreSQL có 23 model chuẩn hoá, lớp xác thực JWT có cơ chế làm mới luân phiên, hệ thống ghi nhật ký kiểm toán đầy đủ qua middleware `auditLog`. Kho mã nguồn đi kèm 74 bộ kiểm thử với 870 ca kiểm thử đơn vị đạt 100 % thành công, phủ toàn bộ rule chuỗi cá nhân – đơn vị, các kịch bản lỡ đợt, cửa sổ trượt và lifetime block.

Về đóng góp nổi bật, đồ án đã trừu tượng hoá rule chuỗi danh hiệu thành đối tượng cấu hình `ChainAwardConfig` (số năm chu kỳ, các cờ tiền điều kiện, có yêu cầu NCKH hay không, lifetime hay non-lifetime) và đặt vào hai mảng `PERSONAL_CHAIN_AWARDS` / `UNIT_CHAIN_AWARDS`. Hàm xét duy nhất `checkChainEligibility` đọc cấu hình này — thiết kế giúp việc thêm tier mới chỉ cần bổ sung phần tử vào mảng mà không phải sửa logic. Tương tự, bảy loại đề xuất đều tuân theo giao diện `ProposalStrategy` với một REGISTRY trung tâm, qua đó loại bỏ các nhánh `if/else` lớn từng tồn tại và mở đường cho việc bổ sung loại đề xuất mới chỉ trong một vài tệp riêng lẻ.

Về phương pháp luận, đồ án được thực hiện theo quy trình phát triển phần mềm hiện đại: viết kiểm thử song song với mã nguồn, phát hiện và sửa lỗi rule trước khi đẩy vào nhánh chính, áp dụng các tài liệu pháp lý và nội bộ làm căn cứ cho yêu cầu nghiệp vụ. Các quyết định kỹ thuật quan trọng — chọn Prisma thay vì Sequelize, áp dụng layered architecture có tầng Repository riêng, chia validation thành Joi (backend) và Zod (frontend) — đều được phân tích trong các chương trước với lý do gắn liền với đặc thù của PM QLKT.

Bên cạnh các kết quả đạt được, đồ án còn tồn tại một số hạn chế. Thứ nhất, phần triển khai mới dừng ở môi trường mạng nội bộ Học viện trên một máy chủ vật lý, chưa đánh giá được khả năng vận hành ở quy mô nhiều cơ sở. Thứ hai, các báo cáo thống kê hiện chủ yếu dạng bảng và biểu đồ tĩnh, chưa có công cụ phân tích so sánh giữa các đơn vị theo nhiều năm liên tiếp. Thứ ba, hệ thống chưa tích hợp với chữ ký số quân đội, do đó các quyết định khen thưởng vẫn cần tải lên dạng PDF đã ký bằng tay.

Quá trình thực hiện đồ án giúp người viết hiểu sâu hơn về cách trừu tượng hoá quy tắc nghiệp vụ phức tạp thành đối tượng cấu hình thuần tuý, cách thiết kế kiến trúc phân tầng có Repository và lý do tách biệt nó khỏi tầng Service, cách viết kiểm thử bao phủ các kịch bản chu kỳ trượt, cũng như cách áp dụng các văn bản pháp lý và nội bộ vào thiết kế kỹ thuật.

## 6.2 Hướng phát triển

Trên nền tảng đã xây dựng, đề xuất bảy hướng phát triển cho phiên bản kế tiếp.

(i) **Mở rộng các danh hiệu cao hơn BKTTCP.** Hiện tại hệ thống dừng ở Bằng khen Thủ tướng Chính phủ; phiên bản tiếp theo sẽ bổ sung Anh hùng Lực lượng Vũ trang nhân dân, Anh hùng Lao động và các danh hiệu nhà nước khác. Việc mở rộng này khả thi nhờ thiết kế cấu hình `ChainAwardConfig` đã có, chỉ cần bổ sung phần tử mới vào mảng cấu hình kèm hàm xét điều kiện tương ứng.

(ii) **Tích hợp gợi ý thông minh dựa trên dữ liệu lịch sử.** Sau khi hệ thống tích luỹ đủ dữ liệu nhiều năm, có thể áp dụng các thuật toán phân cụm (clustering) hoặc luật kết hợp để gợi ý các quân nhân có khả năng đạt danh hiệu trong năm tới hoặc cảnh báo các trường hợp dấu hiệu sa sút thành tích. Mô hình có thể đặt trong một dịch vụ tách biệt dùng Python (scikit-learn hoặc PyTorch) và giao tiếp với backend Node.js qua REST hoặc gRPC.

(iii) **Tích hợp ký số quân đội.** Bổ sung mô-đun ký số PDF quyết định khen thưởng theo chuẩn PKCS#7 với chữ ký số do hệ thống PKI của Bộ Quốc phòng cấp. Khi đó, file PDF tải lên sẽ chứa chữ ký số hợp lệ, có thể xác thực ngược về cơ quan ký, loại bỏ nhu cầu ký giấy và lưu kho bản giấy.

(iv) **Phát triển ứng dụng di động cho cấp User.** Phiên bản mobile (iOS + Android dùng React Native hoặc Flutter) dành riêng cho quân nhân, sĩ quan, học viên với chức năng tra cứu hồ sơ khen thưởng cá nhân, nhận thông báo đẩy về quyết định khen thưởng và xem các giải thích về chu kỳ chuỗi. Backend hiện tại đã có sẵn tầng REST API và xác thực JWT, nên việc kết nối ứng dụng di động không đòi hỏi thay đổi cốt lõi.

(v) **Bảng điều khiển phân tích cấp Bộ Quốc phòng.** Mở rộng vai trò mới — tạm gọi là MOD_ANALYST — với các bảng phân tích tổng hợp số liệu khen thưởng theo Học viện, theo loại danh hiệu, theo chu kỳ. Các báo cáo này có thể xuất file định dạng .docx theo mẫu chuẩn của Tổng cục Chính trị hoặc dạng dashboard tương tác (Recharts hoặc Chart.js).

(vi) **Đăng nhập một lần (SSO) qua hệ thống xác thực thống nhất của Bộ Quốc phòng.** Hiện hệ thống đang dùng tài khoản nội bộ; phiên bản kế tiếp có thể tích hợp giao thức xác thực SAML 2.0 hoặc OpenID Connect với hệ thống danh tính chung của Bộ, giúp người dùng không phải nhớ thêm mật khẩu mới và tận dụng các chính sách bảo mật đã có.

(vii) **Mở rộng đa ngôn ngữ phục vụ công tác đối ngoại.** Học viện Khoa học Quân sự có truyền thống đào tạo và hợp tác đối ngoại; phiên bản tiếp theo có thể bổ sung tiếng Anh và tiếng Trung qua khung quốc tế hoá `next-intl`, đặc biệt cho các bảng tổng kết khen thưởng dùng trong hội nghị quốc tế.

Các hướng phát triển trên được sắp xếp theo độ ưu tiên giảm dần từ (i) đến (vii). Trong đó hai hướng (i) và (iii) là khả thi và có giá trị nghiệp vụ rõ ràng nhất, có thể bắt tay vào trong sáu tháng kế tiếp; bốn hướng (ii), (iv), (v), (vi) cần thời gian dài hơn do phụ thuộc vào tích hợp với hệ thống bên ngoài; hướng (vii) phụ thuộc vào nhu cầu cụ thể của lãnh đạo Học viện.

---

# Tài liệu tham khảo

## Văn bản pháp lý
1. Quốc hội nước CHXHCN Việt Nam, *Luật Thi đua, Khen thưởng số 06/2022/QH15*, Hà Nội, ngày 15/06/2022.
2. Quốc hội nước CHXHCN Việt Nam, *Luật Thi đua – Khen thưởng số 15/2003/QH11*, Hà Nội, ngày 26/11/2003.
3. Bộ Chính trị Ban Chấp hành Trung ương Đảng Cộng sản Việt Nam, *Nghị quyết số 52-NQ/TW về tham gia Cách mạng công nghiệp lần thứ tư*, Hà Nội, ngày 27/9/2019.
4. Thủ tướng Chính phủ, *Quyết định số 749/QĐ-TTg phê duyệt Chương trình Chuyển đổi số quốc gia*, Hà Nội, ngày 03/6/2020.
5. Quân uỷ Trung ương, *Nghị quyết số 1658/NQ-QUTW về khoa học, công nghệ và đổi mới sáng tạo*, Hà Nội, ngày 20/12/2022.
6. Bộ Tổng Tham mưu, *Kế hoạch số 588/KH-TM về chuyển đổi số trong giáo dục, đào tạo trong các nhà trường Quân đội giai đoạn 2022–2025, định hướng đến 2030*, Hà Nội, ngày 04/3/2022.
7. Cục Nhà trường – Bộ Tổng Tham mưu, *Hướng dẫn số 2854/HD-NT về đưa nội dung Chính phủ điện tử và chuyển đổi số vào chương trình đào tạo*, Hà Nội, ngày 27/12/2023.
8. Tổng cục II – Bộ Quốc phòng, *Kế hoạch số 154/KH-TCII về cải cách hành chính và chuyển đổi số*, Hà Nội, ngày 30/01/2024.
9. Đảng uỷ Học viện Khoa học Quân sự, *Nghị quyết số 1405/NQ-ĐU về lãnh đạo thực hiện nhiệm vụ chuyển đổi số*, Hà Nội, ngày 11/4/2023.

## Tài liệu kỹ thuật
10. M. Jones, J. Bradley, and N. Sakimura, "JSON Web Token (JWT)," IETF RFC 7519, May 2015.
11. N. Provos and D. Mazières, "A Future-Adaptable Password Scheme," in *Proc. USENIX Annual Technical Conference (FREENIX Track)*, 1999.
12. Vercel Inc., "Next.js 14 Documentation," 2024. [Online]. Available: https://nextjs.org/docs
13. Prisma Data Inc., "Prisma ORM Documentation," 2024. [Online]. Available: https://www.prisma.io/docs
14. OpenJS Foundation, "Express.js Documentation," 2024. [Online]. Available: https://expressjs.com
15. The PostgreSQL Global Development Group, "PostgreSQL 15 Documentation," 2023. [Online]. Available: https://www.postgresql.org/docs/15/
16. Socket.IO Team, "Socket.IO Documentation v4," 2024. [Online]. Available: https://socket.io/docs/v4/
17. Hapi.dev, "Joi Schema Validation Documentation," 2024. [Online]. Available: https://joi.dev
18. C. McKenzie, "Zod Documentation," 2024. [Online]. Available: https://zod.dev
19. Ant Design Team, "Ant Design 5 Components Documentation," 2024. [Online]. Available: https://ant.design
20. Adam Wathan et al., "Tailwind CSS Documentation," 2024. [Online]. Available: https://tailwindcss.com
21. Meta Platforms, "Jest Testing Framework Documentation," 2024. [Online]. Available: https://jestjs.io
22. ExcelJS Contributors, "ExcelJS Documentation," 2024. [Online]. Available: https://github.com/exceljs/exceljs

## Đề tài liên quan
23. Đặng Quốc Hưng, Bùi Đình Thế và cộng sự, *Xây dựng phần mềm quản lý khen thưởng tại Học viện Khoa học Quân sự* — Đề tài khoa học cấp Học viện, mã số ĐTHV/2025-2026/H5-01, Học viện Khoa học Quân sự, 2026.

---

# Phụ lục A. Toàn văn schema cơ sở dữ liệu

> _Sẽ chèn nội dung tệp `BE-QLKT/prisma/schema.prisma` (577 dòng, 23 model). Khi convert sang LaTeX, dùng `lstinputlisting{schema.prisma}` để chèn nguyên tệp với syntax highlight._

---

# Phụ lục B. Danh sách điểm cuối API

> _Bảng tổng hợp các route đã đăng ký trong `BE-QLKT/src/routes/index.ts`. Cột: HTTP method | Path | Vai trò yêu cầu | Mô tả. Khoảng 60–80 dòng._

---

# Phụ lục C. Hướng dẫn sử dụng theo vai trò

> _Bốn mục con (mỗi vai trò một mục, 1–2 trang):_
>
> - C.1 Vai trò SUPER_ADMIN — quản trị hệ thống, sao lưu, dev zone.
> - C.2 Vai trò ADMIN — cán bộ Phòng Khen thưởng, tạo và phê duyệt đề xuất toàn Học viện.
> - C.3 Vai trò MANAGER — phụ trách Cơ quan đơn vị, duyệt nội bộ.
> - C.4 Vai trò USER — quân nhân tra cứu hồ sơ và lịch sử khen thưởng cá nhân.

---

# Phụ lục D. Báo cáo kết quả kiểm thử

> _Đầu ra của lệnh `npx jest --silent`: 74 bộ kiểm thử / 870 ca kiểm thử / pass 100 %. Có thể chèn trực tiếp output console hoặc xuất bản đẹp qua `jest --json | jq ...`._
