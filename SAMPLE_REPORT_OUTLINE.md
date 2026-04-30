# SAMPLE_REPORT_OUTLINE — Phân tích báo cáo ĐATN mẫu

> File: `2025-06-28_16-04-25_datn_20242.pdf` (76 trang).
> Mục đích: cung cấp khung sườn để xây dựng báo cáo ĐATN cho đề tài "Phần mềm Quản lý Khen thưởng" (PM QLKT).
> Toàn bộ ghi chú được tóm tắt bằng ngôn ngữ riêng — KHÔNG copy trực tiếp văn bản gốc.

## Mục lục

- [1. Metadata báo cáo](#1-metadata-báo-cáo)
- [2. Mục lục đầy đủ của báo cáo mẫu](#2-mục-lục-đầy-đủ-của-báo-cáo-mẫu)
- [3. Cấu trúc chi tiết từng chương](#3-cấu-trúc-chi-tiết-từng-chương)
- [4. Phần phụ (front matter / back matter)](#4-phần-phụ-front-matter--back-matter)
- [5. Dấu hiệu phong cách viết](#5-dấu-hiệu-phong-cách-viết)
- [6. Đặc điểm nổi bật cần bám theo](#6-đặc-điểm-nổi-bật-cần-bám-theo)
- [7. Plan đề xuất cho báo cáo PM QLKT](#7-plan-đề-xuất-cho-báo-cáo-pm-qlkt)

---

## 1. Metadata báo cáo

| Mục | Giá trị |
|-----|---------|
| Tên đề tài | "Thiết kế xây dựng Hệ thống Quản lý nhân sự Phòng Công nghệ thông tin Học viện Khoa học Quân sự" |
| Sinh viên | Nguyễn Huy Hoàng (hoang.nh211012@sis.hust.edu.vn) |
| GVHD | ThS. Lê Đức Trung |
| Trường | Đại học Bách Khoa Hà Nội — Trường Công nghệ Thông tin và Truyền thông |
| Chương trình | Khoa học máy tính (IT1) |
| Thời gian | Hà Nội, 06/2025 (học kỳ 2024.2) |
| Tổng số trang | 76 (nội dung chính 64 trang + front/back matter) |
| Số chương | 6 |

### Phong cách trình bày
- Định dạng: rất giống template LaTeX chuẩn của ĐHBK Hà Nội (font có chân kiểu Times/Computer Modern, header chương ở mỗi trang, đánh số trang đáy).
- Layout: 1 cột, lề rộng vừa, dòng kẻ ngang dưới header.
- Header trang: tên chương viết hoa ở góc trên.
- Footer: số trang ở giữa hoặc lệch theo trang chẵn/lẻ.
- Tiêu đề chương: căn giữa, in hoa đậm "CHƯƠNG X. TÊN CHƯƠNG".
- Mục cấp 2: "X.Y Tên mục" đậm, không thụt.
- Mục cấp 3: "X.Y.Z Tên mục" đậm, thụt nhẹ.
- Mục cấp 4: dùng "a, b, c," (chữ thường có dấu phẩy) — phong cách BKHN.
- Hình: caption "Hình X.Y: ..." in đậm, đặt dưới ảnh, căn giữa.
- Bảng: caption "Bảng X.Y: ..." in đậm, đặt trên hoặc dưới bảng tuỳ ngữ cảnh.

### Bìa, lời cảm ơn, tóm tắt
- **Bìa**: 1 trang, có "ĐẠI HỌC BÁCH KHOA HÀ NỘI" trên đầu, "ĐỒ ÁN TỐT NGHIỆP" cỡ lớn ở giữa, tên đề tài, tên sinh viên, email, GVHD + chỗ ký, chương trình đào tạo, trường, "Hà Nội, 06/2025".
- **Lời cảm ơn**: 1 trang (~1 đoạn ngắn ~10 dòng). Cảm ơn thầy cô + GVHD + gia đình. Văn phong trang trọng, dùng "em".
- **Tóm tắt nội dung đồ án**: 1 trang, 3 đoạn:
  - Đoạn 1: bối cảnh (chuyển đổi số trong quân đội, hạn chế Excel/giấy tờ).
  - Đoạn 2: mục tiêu đồ án (chuẩn hoá quy trình + tự động hoá + bảo mật).
  - Đoạn 3: hướng tiếp cận (web-based, mã nguồn mở) + kết quả mong đợi.
  - Kết: "Sinh viên thực hiện (Ký và ghi rõ họ tên)".
- **KHÔNG có**: nhiệm vụ đồ án (đề bài), bản nhận xét GVHD, abstract tiếng Anh — có thể là do bản này chưa đính kèm hoặc trường không yêu cầu.

---

## 2. Mục lục đầy đủ của báo cáo mẫu

### Front matter (không đánh số trang Ả Rập)
- Bìa
- Lời cảm ơn
- Tóm tắt nội dung đồ án
- Mục lục
- Danh mục hình vẽ (24 hình tổng cộng)
- Danh mục bảng biểu (16 bảng tổng cộng)
- Danh sách thuật ngữ (15 dòng — Vietnamese ↔ English/giải thích)

### Body
| Chương | Tên | Trang bắt đầu | Trang kết thúc | Số trang |
|--------|-----|---------------|----------------|----------|
| 1 | Giới thiệu đề tài | 1 | 3 | 3 |
| 2 | Khảo sát và phân tích yêu cầu | 4 | 23 | 20 |
| 3 | Công nghệ sử dụng | 24 | 27 | 4 |
| 4 | Thiết kế, triển khai và đánh giá hệ thống | 28 | 58 | 31 |
| 5 | Các giải pháp và đóng góp nổi bật | 59 | 62 | 4 |
| 6 | Kết luận và hướng phát triển | 63 | 64 | 2 |

### Back matter
- Một số lưu ý về tài liệu tham khảo (trang 65) — chỉ 6 mục.

### Mục lục chi tiết theo từng tiểu mục

**CHƯƠNG 1. GIỚI THIỆU ĐỀ TÀI** (3 trang)
- 1.1 Đặt vấn đề ............ 1
- 1.2 Mục tiêu và phạm vi đề tài ............ 1
- 1.3 Định hướng giải pháp ............ 2
- 1.4 Bố cục đồ án ............ 2

**CHƯƠNG 2. KHẢO SÁT VÀ PHÂN TÍCH YÊU CẦU** (20 trang)
- 2.1 Khảo sát hiện trạng ............ 4
- 2.2 Tổng quan chức năng ............ 4
  - 2.2.1 Biểu đồ use case tổng quát ............ 4
  - 2.2.2 Biểu đồ use case phân rã quản lý nhân viên ............ 7
  - 2.2.3 Biểu đồ use case phân rã quản lý ca làm việc ............ 8
  - 2.2.4 Biểu đồ use case phân rã quản lý dự án ............ 9
  - 2.2.5 Biểu đồ use case phân rã quản lý nhiệm vụ ............ 9
  - 2.2.6 Biểu đồ use case phân rã quản lý đơn xin phép ............ 10
  - 2.2.7 Biểu đồ use case phân rã quản lý chấm công ............ 11
  - 2.2.8 Biểu đồ use case phân rã quản lý tổ ............ 12
  - 2.2.9 Biểu đồ use case phân rã quản lý tuyển dụng ............ 13
  - 2.2.10 Quy trình nghiệp vụ ............ 14
    - a, Quy trình nghiệp vụ tuyển dụng
    - b, Quy trình nghiệp vụ thêm mới nhân viên
- 2.3 Đặc tả chức năng ............ 17
  - 2.3.1 Đặc tả use case đăng nhập ............ 17
  - 2.3.2 Đặc tả use case quản lý nhân viên ............ 18
  - 2.3.3 Đặc tả use case quản lý dự án ............ 19
  - 2.3.4 Đặc tả use case quản lý tổ ............ 20
  - 2.3.5 Đặc tả use case quản lý ca làm việc ............ 21
- 2.4 Yêu cầu phi chức năng ............ 21
  - 2.4.1 Yêu cầu về hiệu năng và trải nghiệm ............ 21
  - 2.4.2 Yêu cầu về bảo mật ............ 22
  - 2.4.3 Yêu cầu về tính xác thực của thông tin ............ 23

**CHƯƠNG 3. CÔNG NGHỆ SỬ DỤNG** (4 trang)
- 3.1 Node.js + Express: Backend JavaScript Framework ............ 24
- 3.2 Công nghệ MySQL cho Web Development ............ 24
- 3.3 XAMPP: Môi trường phát triển web tích hợp ............ 25
- 3.4 React + TypeScript: Công nghệ Frontend Hiện đại ............ 25
- 3.5 Một số công nghệ khác liên quan ............ 26
  - 3.5.1 Radix UI: React Component Library ............ 26
  - 3.5.2 JWT: JSON Web Token Authentication ............ 27
  - 3.5.3 Swagger: API Documentation Testing Tool ............ 27

**CHƯƠNG 4. THIẾT KẾ, TRIỂN KHAI VÀ ĐÁNH GIÁ HỆ THỐNG** (31 trang)
- 4.1 Thiết kế kiến trúc ............ 28
  - 4.1.1 Lựa chọn kiến trúc phần mềm ............ 28
  - 4.1.2 Tổng Quan Hệ Thống ............ 28
  - 4.1.3 Thiết kế tổng quan ............ 30
    - a, Thiết kế gói phía client
    - b, Thiết kế gói cho server
  - 4.1.4 Thiết kế chi tiết gói ............ 32
  - 4.1.5 Thiết kế lớp ............ 34
  - 4.1.6 Biểu đồ tuần tự ............ 35
    - a, Biểu đồ tuần tự đăng nhập
    - b, Biểu đồ tuần tự phê duyệt hồ sơ ứng viên
  - 4.1.7 Thiết kế cơ sở dữ liệu ............ 36
- 4.2 Thiết kế chi tiết ............ 43
  - 4.2.1 Thiết kế giao diện ............ 43 (wireframe ASCII-style)
- 4.3 Xây dựng ứng dụng ............ 46
  - 4.3.1 Thư viện và công cụ sử dụng ............ 46
  - 4.3.2 Kết quả đạt được ............ 46
  - 4.3.3 Minh họa các chức năng chính ............ 47 (screenshots)
- 4.4 Kiểm thử ............ 52
  - 4.4.1 Kiểm thử hộp đen ............ 52 (a-h, mỗi chức năng 1 bảng)
  - 4.4.2 Kiểm thử tương thích ............ 56
- 4.5 Triển khai ............ 56 (6 bước hướng dẫn install)

**CHƯƠNG 5. CÁC GIẢI PHÁP VÀ ĐÓNG GÓP NỔI BẬT** (4 trang)
- 5.1 Số hóa công tác quản lý ............ 59 (Thực trạng / Giải pháp / Kết quả đạt được)
- 5.2 Quản lý thông tin nhân viên ............ 60 (Thực trạng / Giải pháp / Kết quả đạt được)
- 5.3 Theo dõi tiến độ công việc ............ 60 (Thực trạng / Giải pháp / Kết quả đạt được)
- 5.4 Quản lý tuyển dụng nhân sự ............ 61 (Thực trạng / Giải pháp / Kết quả đạt được)

**CHƯƠNG 6. KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN** (2 trang)
- 6.1 Kết luận ............ 63
- 6.2 Hướng phát triển ............ 64

**MỘT SỐ LƯU Ý VỀ TÀI LIỆU THAM KHẢO** ............ 65

---

## 3. Cấu trúc chi tiết từng chương

### Chương 1 — Giới thiệu đề tài (3 trang)

**Mục đích**: Mở bài. Giới thiệu bối cảnh, lý do chọn đề tài, phạm vi và bố cục.

**Section breakdown**:
- **1.1 Đặt vấn đề** (~1 trang): bối cảnh chuyển đổi số trong quân đội + Học viện. Nêu hiện trạng (Excel/giấy tờ thủ công, khó truy xuất, dễ sai sót, bảo mật yếu). Đặt nhu cầu xây dựng hệ thống điện tử có lưu ý đặc thù quân sự.
- **1.2 Mục tiêu và phạm vi đề tài** (~0.5 trang): liệt kê mục tiêu (chuẩn hoá quản lý, tự động hoá, bảo mật) + 4 thành phần chính (quản lý hồ sơ, tuyển dụng, công việc, báo cáo). Nêu rõ phạm vi đóng (chỉ Phòng CNTT, không bao gồm tài chính/hành chính tổng).
- **1.3 Định hướng giải pháp** (~0.5 trang): chọn web-based + client-server. Nêu tech stack (React FE, Node.js BE, MySQL DB, RESTful API, JWT, bcrypt).
- **1.4 Bố cục đồ án** (~1 trang): liệt kê tóm tắt 5 chương sau (chương 2-6), mỗi chương 1 đoạn ngắn 3-5 dòng.

**Hình/bảng/code**: KHÔNG có hình hay bảng nào. Pure prose.

---

### Chương 2 — Khảo sát và phân tích yêu cầu (20 trang, lớn nhất sau chương 4)

**Mục đích**: Khảo sát thực trạng → phân tích yêu cầu → xác định actor + use case + đặc tả + yêu cầu phi chức năng.

**Section breakdown**:
- **2.1 Khảo sát hiện trạng** (~1 trang): mở rộng phần đặt vấn đề. Phân tích sâu hơn về hạn chế của Excel/giấy tờ trong môi trường quân sự. Giới thiệu đặc thù bảo mật.
- **2.2 Tổng quan chức năng** (chiếm phần lớn):
  - **2.2.1 Use case tổng quát**: 1 hình lớn (Hình 2.1) với 5 actor (Admin, HR Manager, Project Manager, Employee, Ứng viên) và ~13 use case. Sau đó là 1 paragraph/actor giải thích vai trò.
  - **2.2.2 — 2.2.9 Phân rã use case** (8 sub-mục): mỗi sub-mục có 1 hình use case con (Hình 2.2 — 2.9) + 1 đoạn văn 5-10 dòng giải thích.
  - **2.2.10 Quy trình nghiệp vụ**: 2 activity diagram (Hình 2.10 quy trình tuyển dụng, Hình 2.11 quy trình thêm mới nhân viên) + đoạn diễn giải step-by-step.
- **2.3 Đặc tả chức năng** (~5 trang, 5 bảng):
  - Mỗi sub-mục là 1 bảng (Bảng 2.1 — 2.5) đặc tả use case theo template:
    - Tên ca sử dụng / ID
    - Tác nhân hệ thống
    - Tiền điều kiện
    - Luồng sự kiện chính (bảng STT — Thực hiện — Hành động)
    - Luồng sự kiện thay thế
    - Hậu điều kiện
- **2.4 Yêu cầu phi chức năng** (~3 trang):
  - 2.4.1 Hiệu năng & trải nghiệm: ~1 đoạn ngắn.
  - 2.4.2 Bảo mật: liệt kê 6 mục đánh số (JWT, bcrypt, ORM chống SQL injection, DOMPurify chống XSS, backup tự động, log).
  - 2.4.3 Xác thực thông tin: 1 đoạn về validation + log + phân quyền.

**Hình/bảng/code**:
- Hình: 11 cái (2.1 — 2.11). Toàn bộ là use case diagram và activity diagram.
- Bảng: 5 cái đặc tả use case.
- Code listing: KHÔNG có.

---

### Chương 3 — Công nghệ sử dụng (4 trang)

**Mục đích**: Liệt kê + giải thích các công nghệ đã chọn. Mỗi công nghệ là 1 mục con.

**Section breakdown**: cấu trúc đều cho mỗi công nghệ — 2-3 đoạn:
1. Đoạn giới thiệu công nghệ (lịch sử, ai phát triển, năm ra đời).
2. Đoạn nêu đặc trưng kỹ thuật.
3. Đoạn nói về use case thực tế / ai dùng / lý do chọn.

Các công nghệ:
- 3.1 Node.js + Express
- 3.2 MySQL
- 3.3 XAMPP
- 3.4 React + TypeScript
- 3.5 Khác: Radix UI, JWT, Swagger

**Hình/bảng/code**: KHÔNG có hình, KHÔNG có code listing trong chương này. Pure prose.

---

### Chương 4 — Thiết kế, triển khai và đánh giá hệ thống (31 trang, lớn nhất)

**Mục đích**: Trình bày toàn bộ design → implementation → testing → deployment.

**Section breakdown**:
- **4.1 Thiết kế kiến trúc** (~15 trang):
  - 4.1.1 Lựa chọn kiến trúc: chọn MVC. Giải thích Model/View/Controller, ưu điểm, đoạn văn chỉ có text.
  - 4.1.2 Tổng quan hệ thống: luồng dữ liệu MVC + Hình 4.1 (sơ đồ MVC tổng quát có sẵn từ web).
  - 4.1.3 Thiết kế tổng quan: 2 sub a/b — package diagram cho client (Hình 4.2) và server (Hình 4.3) + đoạn giải thích từng package.
  - 4.1.4 Thiết kế chi tiết gói: zoom vào module quản lý nhân viên, có Hình 4.4 (UML package detail) + bullet list mô tả Services / States / Components / Pages.
  - 4.1.5 Thiết kế lớp: class diagram chi tiết (Hình 4.5) cho User + UserRoute + UsersController + UserService + 3 enum (UsersRole, MilitaryRank, LaborContract). Sau đó là đoạn giải thích layered architecture.
  - 4.1.6 Biểu đồ tuần tự: 2 sequence diagram a (đăng nhập, Hình 4.6) và b (phê duyệt hồ sơ ứng viên, Hình 4.7).
  - 4.1.7 Thiết kế cơ sở dữ liệu: ERD lớn (Hình 4.8, ~14 bảng) + giải thích từng bảng (bullet list khoá chính / thuộc tính / ý nghĩa / quan hệ) + 6 bảng chi tiết schema (Bảng 4.1 — 4.6) cho 6 bảng chính.
- **4.2 Thiết kế chi tiết** (~3 trang):
  - 4.2.1 Thiết kế giao diện: 6 wireframe ASCII-style đơn giản (Hình 4.9 — 4.14) cho login, dashboard, quản lý nhân viên, settings, task board, recruitment.
- **4.3 Xây dựng ứng dụng** (~6 trang):
  - 4.3.1 Thư viện và công cụ: Bảng 4.7 — 6 dòng (Mục đích / Công cụ / URL).
  - 4.3.2 Kết quả đạt được: bullet list ~11 chức năng đã hoàn thành.
  - 4.3.3 Minh họa: 10 screenshot UI thật (Hình 4.15 — 4.24) — login, dashboard, danh sách user, team detail, log, kanban, attendance modal, careers landing, careers detail, candidate CV.
- **4.4 Kiểm thử** (~4 trang):
  - 4.4.1 Hộp đen: 8 sub a-h, mỗi chức năng 1 bảng test case (Bảng 4.8 — 4.15) với cột STT / Chức năng / Đầu vào / Đầu ra mong muốn / Kết quả. Tất cả "Đạt".
  - 4.4.2 Tương thích: Bảng 4.16 — 4 dòng test trên 4 dòng máy + browser khác nhau.
- **4.5 Triển khai** (~2 trang):
  - 6 "Bước" hướng dẫn cài đặt + chạy local (chuẩn bị tools, mở source, khởi động XAMPP, kết nối DB, install + run BE/FE, đăng nhập). Có vài lệnh shell `cd be / npm i / npm run dev`.

**Hình/bảng/code**:
- Hình: 24 cái (Hình 4.1 — 4.24). Mix: MVC diagram, package diagram, class diagram, sequence diagram, ERD, wireframe, screenshot UI thật.
- Bảng: 16 cái (Bảng 4.1 — 4.16). Mix: schema description, library list, test cases, compatibility test.
- Code listing: chỉ có vài lệnh shell rời (cd, npm i, npm run dev) — KHÔNG có code TypeScript/JS thực sự nào trong báo cáo.

---

### Chương 5 — Các giải pháp và đóng góp nổi bật (4 trang)

**Mục đích**: Tự nêu bật điểm mạnh / value đem lại. Mỗi giải pháp 3 sub: thực trạng, giải pháp, kết quả.

**Section breakdown**: 4 giải pháp, mỗi giải pháp ~1 trang, cấu trúc giống hệt:
- X.1 Thực trạng: vấn đề trước khi có hệ thống.
- X.2 Giải pháp: hệ thống giải quyết thế nào.
- X.3 Kết quả đạt được: lợi ích cụ thể (đôi khi có % cải thiện, vd "loại bỏ 95% lỗi nhập liệu").

4 giải pháp:
- 5.1 Số hóa công tác quản lý
- 5.2 Quản lý thông tin nhân viên
- 5.3 Theo dõi tiến độ công việc
- 5.4 Quản lý tuyển dụng nhân sự

**Hình/bảng/code**: KHÔNG có hình hay bảng. Pure prose.

---

### Chương 6 — Kết luận và hướng phát triển (2 trang)

**Mục đích**: Đóng bài.

**Section breakdown**:
- **6.1 Kết luận** (~1 trang): tổng kết những gì đã làm + tech stack đã dùng + thừa nhận khó khăn (môi trường quân sự, hạn chế tiếp cận data thật) + bài học rút ra.
- **6.2 Hướng phát triển** (~1 trang): liệt kê 5 hướng (đánh số i-v): đánh giá hiệu suất + thi đua khen thưởng, mở rộng phân quyền, tích hợp notification, tích hợp AI dự đoán, bảo mật cao hơn (MFA + mã hoá hai chiều).

**Hình/bảng/code**: KHÔNG có.

---

## 4. Phần phụ (front matter / back matter)

### Tài liệu tham khảo
- Tổng số: **6 references** (đánh số [1], [2], [3], [6], [7], [8] — có nhảy số).
- Loại nguồn: 5 trang web (ExpressJS, NodeJS, Sequelize, Radix-UI, JWT) + 1 đồ án ĐATN khoá trước (Nguyễn Văn Khoa, BKHN 2024).
- Định dạng: không hẳn IEEE chuẩn — đơn giản hoá: `[N] Tên, URL, lần cuối truy cập YYYY`.
- Tiêu đề là "Một số lưu ý về tài liệu tham khảo" — viết khá thoải mái, không chuẩn IEEE/APA.

### Phụ lục
- KHÔNG có phụ lục riêng (không có code source, không có user manual, không có dataset).
- Tất cả screenshot UI nằm trong chương 4.

### Hình ảnh / sơ đồ / bảng biểu — tổng số

| Loại | Số lượng | Phân bố |
|------|----------|---------|
| Hình tổng cộng | 24 | Ch.2: 11, Ch.4: 24 (— wait, đúng là 24 chỉ trong Ch.4). Total cả báo cáo = 11 + 24 + 0 = thực tế 24 (re-check) |

Đếm lại từ Danh mục hình:
- Chương 2: Hình 2.1 — 2.11 (11 hình)
- Chương 4: Hình 4.1 — 4.24 (24 hình)
- Tổng cộng: **35 hình**

| Loại | Số lượng |
|------|----------|
| Bảng | 16 cái (Bảng 2.1 — 2.5 + Bảng 4.1 — 4.16, đánh số reset theo chương) |
| Hình tổng | 35 cái (11 + 24) |

### Loại sơ đồ đã dùng
- Use case diagram (UML) — Ch.2
- Activity diagram (quy trình nghiệp vụ) — Ch.2
- Package diagram — Ch.4
- Class diagram (UML) — Ch.4
- Sequence diagram (UML) — Ch.4
- ERD (Entity-Relationship Diagram, dạng dbdiagram.io) — Ch.4
- Wireframe (ASCII / mockup giấy) — Ch.4
- Screenshot UI thật (browser thật) — Ch.4

### KHÔNG dùng
- Component diagram chi tiết
- Deployment diagram
- State diagram
- DFD (data flow diagram)

---

## 5. Dấu hiệu phong cách viết

### Ngôn ngữ
- Tiếng Việt formal / academic, không quá cứng.
- Ngôi xưng: dùng "em" trong Lời cảm ơn và Kết luận. Phần thân chương dùng giọng vô nhân xưng / passive ("hệ thống được thiết kế...", "đồ án hướng tới việc...", "phần backend sử dụng...").
- Có khi xen "chúng tôi" hoặc "ta" nhưng khá hiếm — chủ yếu giọng impersonal.

### Cách trình bày
- Câu trung bình ~2-3 dòng, không quá dài. Có một số câu dài 4 dòng nhưng không quá khó đọc.
- Đoạn văn dài 5-10 dòng, mỗi đoạn 1 idea.
- Hay dùng "Cụ thể, ...", "Bên cạnh đó, ...", "Đồng thời, ...", "Ngoài ra, ..." để chuyển đoạn.
- Dùng bullet list khá thường xuyên (đặc biệt trong Ch.4 mô tả schema DB và Ch.5 liệt kê giải pháp).

### Code listing
- **Cực kỳ ít** — chỉ có vài lệnh shell trong Ch.4 (`cd be / npm i / npm run dev`).
- KHÔNG có đoạn code TypeScript/JavaScript/SQL nào in vào báo cáo.
- KHÔNG có code listing có syntax highlighting.
- → đây là điểm đáng chú ý: báo cáo này thiên về diagram + bảng đặc tả, không show code.

### Diagram tools (đoán)
- Use case + class + sequence + activity: rõ ràng vẽ bằng PlantUML hoặc StarUML hoặc draw.io (style line gãy đặc trưng UML).
- ERD: vẽ bằng dbdiagram.io (style cột/khoá chính có icon).
- Wireframe: ASCII-art hoặc Balsamiq style đơn giản.
- Screenshot: chụp trực tiếp browser local.

---

## 6. Đặc điểm nổi bật cần bám theo

### Phần bắt buộc giảng viên Việt Nam thường yêu cầu (báo cáo mẫu này có)
- ✅ Đặt vấn đề / bối cảnh
- ✅ Mục tiêu + phạm vi
- ✅ Khảo sát hiện trạng
- ✅ Phân tích yêu cầu (functional + non-functional)
- ✅ Use case diagram + đặc tả
- ✅ Quy trình nghiệp vụ (activity diagram)
- ✅ Công nghệ sử dụng (justification)
- ✅ Thiết kế kiến trúc (MVC / layered)
- ✅ Thiết kế CSDL (ERD + bảng schema)
- ✅ Thiết kế class + sequence diagram
- ✅ Thiết kế giao diện (wireframe)
- ✅ Kết quả triển khai (screenshot)
- ✅ Kiểm thử (test case bảng)
- ✅ Hướng dẫn triển khai
- ✅ Đóng góp / giải pháp nổi bật
- ✅ Kết luận + hướng phát triển

### Format đặc biệt cần lưu ý
- Header chương ở đầu mỗi trang (kiểu LaTeX `\fancyhdr`).
- Mục cấp 4 đánh ký tự "a, b, c," không phải "(a) (b) (c)" hay "1) 2) 3)".
- Tiêu đề chương căn giữa, in hoa toàn bộ.
- Đánh số trang Ả Rập từ Chương 1 (front matter có thể không đánh hoặc đánh La Mã — bản này phần front matter có vẻ không có số rõ).
- Caption hình/bảng đậm, có dạng "Hình X.Y: ..." và "Bảng X.Y: ...".

### Điểm yếu / có thể cải thiện so với mẫu
- Tài liệu tham khảo quá ít (chỉ 6 nguồn, đánh số nhảy → có thể là copy-paste lỗi).
- KHÔNG có phụ lục → mất cơ hội thể hiện thêm.
- KHÔNG có code listing → giảm độ thuyết phục về độ kỹ thuật.
- Chương 3 quá ngắn (4 trang) cho 6 công nghệ.
- Chương 5 hơi trùng với Ch.2 (thực trạng) và Ch.4 (kết quả) → dễ lặp ý.
- Chương 6 hơi sơ sài (2 trang).

---

## 7. Plan đề xuất cho báo cáo PM QLKT

> Mục tiêu: bám cấu trúc 6 chương của mẫu, nhưng tăng độ kỹ thuật (thêm code listing, thêm tài liệu tham khảo, tăng độ sâu chương 3 và 6) và tránh các điểm yếu nêu trên.

### Đề xuất cấu trúc 6 chương cho PM QLKT

| Chương | Tên đề xuất | Số trang ước tính | Word count ước tính |
|--------|-------------|-------------------|---------------------|
| 1 | Giới thiệu đề tài | 3-4 | 1500 |
| 2 | Khảo sát và phân tích yêu cầu | 22-26 | 9000 |
| 3 | Công nghệ sử dụng | 6-8 | 2500 |
| 4 | Thiết kế, triển khai và đánh giá hệ thống | 32-40 | 13000 |
| 5 | Các giải pháp và đóng góp nổi bật | 5-7 | 2200 |
| 6 | Kết luận và hướng phát triển | 3-4 | 1200 |
| **Tổng** | | **70-90 trang** | **~30000 từ** |

### Chi tiết đề xuất từng chương

#### Chương 1 — Giới thiệu đề tài
- **1.1 Đặt vấn đề**: Bối cảnh quân đội số hoá. Quản lý khen thưởng (thi đua, danh hiệu, huân chương) hiện làm thủ công Excel. Quy trình xét thưởng phức tạp (chuỗi danh hiệu hằng năm, các loại huân chương lifetime). Sai sót, khó truy vấn theo mốc đề nghị, khó verify rule "2 năm CSTDCS → BKBQP", "3 năm + 1 BKBQP → CSTDTQ", v.v.
- **1.2 Mục tiêu và phạm vi**: 7 loại khen thưởng (Annual, Unit Annual, Tenure Medals, Contribution, Commemorative, Military Flag, Scientific). Phân quyền 4 vai trò. Phạm vi: cá nhân + đơn vị, không bao gồm quân lương / hành chính.
- **1.3 Định hướng giải pháp**: Web-based, Next.js + Express + PostgreSQL + Prisma. Real-time qua Socket.IO. JWT auth.
- **1.4 Bố cục đồ án**: tóm tắt 5 chương sau, mỗi chương 3-5 dòng.

**Map vào codebase**: không có code-map cho chương này, là chương lý thuyết.

**Risk trùng mẫu**: thấp — bối cảnh khen thưởng khác hẳn nhân sự HR.

---

#### Chương 2 — Khảo sát và phân tích yêu cầu
- **2.1 Khảo sát hiện trạng**: phỏng vấn / giả định nghiệp vụ Phòng Khen thưởng. Quy trình hiện tại với Excel + giấy. Thông tư hướng dẫn xét thưởng (luật quân đội).
- **2.2 Tổng quan chức năng**:
  - 2.2.1 Use case tổng quát: 4 actor (SUPER_ADMIN, ADMIN, MANAGER, USER). ~15-20 use case.
  - 2.2.2 — 2.2.8 Phân rã use case theo nhóm chức năng:
    - Quản lý quân nhân (CRUD personnel)
    - Quản lý đơn vị (đơn vị cha / DVTT / CQDV)
    - Quản lý đề xuất khen thưởng (7 loại)
    - Quản lý chuỗi danh hiệu hằng năm cá nhân
    - Quản lý chuỗi danh hiệu hằng năm đơn vị
    - Quản lý NCKH
    - Quản lý hệ thống (log, backup, dev zone)
  - 2.2.9 Quy trình nghiệp vụ:
    - a, Quy trình đề xuất → phê duyệt 1 đợt khen thưởng
    - b, Quy trình tính eligibility chuỗi danh hiệu (BKBQP/CSTDTQ/BKTTCP)
    - c, Quy trình import Excel hàng loạt
- **2.3 Đặc tả chức năng**: 6-8 bảng đặc tả use case theo template chuẩn (tương tự Bảng 2.1 mẫu).
  - UC-01: Đăng nhập
  - UC-02: Thêm / sửa / xoá quân nhân
  - UC-03: Tạo đề xuất khen thưởng
  - UC-04: Phê duyệt đề xuất
  - UC-05: Recalc eligibility chuỗi danh hiệu
  - UC-06: Import Excel
- **2.4 Yêu cầu phi chức năng**:
  - 2.4.1 Hiệu năng + UX
  - 2.4.2 Bảo mật: JWT (access + refresh), bcrypt, audit log, role-based access, input validation Joi, CORS, rate limit
  - 2.4.3 Tính xác thực + nhất quán: validation trước khi lưu, transaction cho import, optimistic UI

**Map vào codebase**:
- `BE-QLKT/prisma/schema.prisma` → schema DB cho chương 4
- `BE-QLKT/src/services/profile/annual.ts` → eligibility logic
- `BE-QLKT/src/middlewares/` → mô tả middleware chain
- `FE-QLKT/src/lib/schemas.ts` → Zod validation
- `BE-QLKT/src/validations/` → Joi schemas

**Risk trùng mẫu**: trung bình — cấu trúc 2.2 / 2.3 / 2.4 giống y hệt mẫu, nhưng nội dung use case hoàn toàn khác. Cần đặc biệt viết phần 2.2 (chuỗi danh hiệu, eligibility cycle) khác hẳn để không bị "use case CRUD na ná HR system".

---

#### Chương 3 — Công nghệ sử dụng
> Đề xuất tăng độ sâu so với mẫu (mẫu chỉ 4 trang, hơi mỏng).

- **3.1 Next.js 14 (App Router)**: SSR, server components, route handler, app dir vs pages dir.
- **3.2 Express + TypeScript**: middleware pattern, async error handling.
- **3.3 PostgreSQL + Prisma ORM**: type-safe schema, migration, Prisma Client.
- **3.4 Ant Design + Tailwind + shadcn/ui**: kết hợp 3 lib UI.
- **3.5 Socket.IO**: real-time notification.
- **3.6 JWT (access + refresh)**: refresh token rotation.
- **3.7 Joi vs Zod**: BE Joi, FE Zod, lý do split.
- **3.8 Jest**: unit test cho eligibility logic.
- **3.9 ExcelJS**: import/export template.

**Map vào codebase**:
- `BE-QLKT/package.json` + `FE-QLKT/package.json` → dependency list
- `BE-QLKT/src/middlewares/auth.middleware.ts` → JWT
- `BE-QLKT/src/utils/excel*.ts` → ExcelJS

**Risk trùng mẫu**: thấp — tech stack khác hẳn (mẫu dùng MySQL + Sequelize, mình dùng PostgreSQL + Prisma).

---

#### Chương 4 — Thiết kế, triển khai và đánh giá hệ thống
> Chương lớn nhất. Phải vẽ đầy đủ diagram + có code listing để tăng độ kỹ thuật so với mẫu.

- **4.1 Thiết kế kiến trúc**:
  - 4.1.1 Lựa chọn kiến trúc: layered architecture (Route → Middleware → Controller → Service → Repository → Prisma) thay vì MVC pure. Giải thích lý do.
  - 4.1.2 Tổng quan hệ thống: sơ đồ cao tầm — FE Next.js ↔ BE Express ↔ DB PostgreSQL + Socket.IO + Prisma Studio.
  - 4.1.3 Thiết kế tổng quan:
    - a, Package FE (`src/app/`, `components/`, `lib/`, `contexts/`, `hooks/`)
    - b, Package BE (`routes/`, `controllers/`, `services/`, `repositories/`, `validations/`, `middlewares/`)
  - 4.1.4 Thiết kế chi tiết gói: zoom vào module Award (`services/award/`, `routes/award/`).
  - 4.1.5 Thiết kế lớp: class diagram cho Personnel + Award + ChainContext + EligibilityResult.
  - 4.1.6 Biểu đồ tuần tự:
    - a, Login + refresh token rotation
    - b, Tạo đề xuất khen thưởng + audit log
    - c, Recalc eligibility cho 1 quân nhân (trace qua chainEligibility service)
  - 4.1.7 Thiết kế CSDL: ERD đầy đủ ~30 bảng (QuanNhan, DanhHieuHangNam, DonVi, DeXuat*, NCKH, ...). Bảng schema chi tiết cho 8-10 bảng quan trọng nhất.
- **4.2 Thiết kế chi tiết**:
  - 4.2.1 Wireframe: dashboard, danh sách quân nhân, form đề xuất, chi tiết chuỗi danh hiệu, recalc result, import preview.
  - 4.2.2 Design system: color palette (Ant Design + custom), spacing, typography.
- **4.3 Xây dựng ứng dụng**:
  - 4.3.1 Tools + libraries: Bảng list ~15 dòng (so với 6 dòng mẫu).
  - 4.3.2 Kết quả đạt được: bullet list các module đã hoàn thành.
  - 4.3.3 Minh hoạ chức năng: 15-20 screenshot UI thật.
  - **4.3.4 Một số đoạn code minh hoạ** (đề xuất thêm — mẫu KHÔNG có): show 3-4 đoạn code nhỏ cho:
    - Eligibility logic (`computeChainContext`)
    - Middleware chain (verifyToken → requireRole → validate → auditLog)
    - Repository pattern (extract từ commit gần đây "Introduce repository layer")
    - Prisma transaction cho import Excel
- **4.4 Kiểm thử**:
  - 4.4.1 Unit test (Jest): show test results cho `chainEligibility`, `medalRanking`. Bảng test cases.
  - 4.4.2 Hộp đen: 8-10 bảng test theo chức năng.
  - 4.4.3 Tương thích: bảng 4-5 dòng máy + browser.
- **4.5 Triển khai**: hướng dẫn cài đặt + chạy local + deploy production (PM2). Có thể thêm Docker.

**Map vào codebase**:
- 4.1.3a → `FE-QLKT/src/` directory tree
- 4.1.3b → `BE-QLKT/src/` directory tree
- 4.1.4 → `BE-QLKT/src/services/award/`, `BE-QLKT/src/routes/award/`
- 4.1.5 → `BE-QLKT/src/services/profile/annual.ts` (ChainContext interface), `services/eligibility/`
- 4.1.6b → `BE-QLKT/src/middlewares/auditLog.ts` + controller flow
- 4.1.6c → `BE-QLKT/src/services/profile/annual.ts` (`computeChainContext`, `lastFlagYearInChain`)
- 4.1.7 → `BE-QLKT/prisma/schema.prisma`
- 4.3.4 code snippet:
  - `BE-QLKT/src/services/eligibility/chainEligibility.ts`
  - `BE-QLKT/src/middlewares/` (chain helpers)
  - `BE-QLKT/src/repositories/` (mới có sau commit `9bd12f6`)
- 4.4.1 → `BE-QLKT/tests/scenarios/`, `BE-QLKT/tests/approve/`

**Risk trùng mẫu**: trung bình. Cấu trúc 4.1 — 4.5 giống mẫu, nhưng:
- Mục 4.1.5 class diagram phải khác vì model khác.
- Mục 4.1.7 ERD phải hoàn toàn khác.
- Mục 4.3.3 screenshot khác hẳn vì UI khác.
- Tránh viết "MVC" — mình dùng layered architecture, phải nhấn mạnh khác biệt.

---

#### Chương 5 — Các giải pháp và đóng góp nổi bật
> Bám pattern Thực trạng / Giải pháp / Kết quả của mẫu. Đề xuất 5 giải pháp.

- **5.1 Tự động hoá tính eligibility chuỗi danh hiệu**: thay vì xét thủ công, hệ thống tự compute `chainContext` (lastBkbqp, streak, missedBkbqp) → giảm sai sót.
- **5.2 Quy trình đề xuất → phê duyệt số hoá**: thay 1 chuỗi giấy bằng workflow điện tử có audit log.
- **5.3 Recalc tổng thể & gợi ý đề xuất chủ động**: hệ thống tự gợi ý quân nhân đủ điều kiện cho từng đợt.
- **5.4 Import Excel hàng loạt**: chuẩn hoá template + validation + transaction → giảm thời gian nhập liệu.
- **5.5 Backup tự động + audit log + phân quyền theo role**: bảo mật theo đặc thù quân đội.

**Map vào codebase**:
- 5.1 → `services/profile/annual.ts`, `services/eligibility/`
- 5.2 → `services/award/approve/`, `middlewares/auditLog.ts`
- 5.3 → recalc endpoints
- 5.4 → `utils/excelImportHelper.ts`, `services/*/import.ts`
- 5.5 → `services/backup.service.ts`, `routes/devZone.route.ts`

**Risk trùng mẫu**: cao — pattern Thực trạng/Giải pháp/Kết quả lặp lại y hệt mẫu. Phải viết nội dung concrete, có số đo (vd: "giảm thời gian xét eligibility từ 2 ngày xuống 5 phút") để không bị "AI generic".

---

#### Chương 6 — Kết luận và hướng phát triển
- **6.1 Kết luận**: tổng kết đã làm gì, đã học gì, khó khăn (rule eligibility phức tạp, lifetime vs non-lifetime, cycle repeat).
- **6.2 Hướng phát triển**:
  - Hỗ trợ các danh hiệu cao hơn BKTTCP
  - AI gợi ý đề xuất dựa trên lịch sử (clustering quân nhân)
  - Tích hợp ký số quyết định
  - Mobile app cho USER xem trạng thái đề xuất
  - Dashboard analytics (cấp Bộ Quốc phòng)
  - SSO với hệ thống PKI quân đội

**Risk trùng mẫu**: thấp.

---

### Tài liệu tham khảo đề xuất (target ≥ 12 nguồn)
> Mẫu chỉ 6 nguồn — quá ít. Mình nên có 12-20 nguồn IEEE format chuẩn.

1. Next.js docs
2. Prisma docs
3. Express docs
4. PostgreSQL manual
5. Joi schema docs
6. Zod docs
7. Ant Design docs
8. JWT RFC 7519
9. bcrypt paper / Niels Provos
10. Socket.IO docs
11. Thông tư BQP về xét thưởng (nguồn pháp lý)
12. Luật Thi đua khen thưởng 2022
13. ĐATN khoá trước (tham khảo cấu trúc, không nội dung)
14. ExcelJS docs
15. REST API design — Roy Fielding thesis (optional)

### Phụ lục đề xuất (mẫu KHÔNG có — đây là cơ hội)
- Phụ lục A: Schema Prisma đầy đủ (`schema.prisma`)
- Phụ lục B: API endpoint list (auto-generated từ Swagger)
- Phụ lục C: Hướng dẫn sử dụng cho USER / MANAGER / ADMIN
- Phụ lục D: Test report (Jest output)

### Risk summary — chương nào dễ trùng mẫu nhất

| Chương | Risk | Lý do | Mitigation |
|--------|------|-------|------------|
| 1 | Thấp | Bối cảnh khác hẳn | OK |
| 2 | Trung bình | Pattern use case + đặc tả + non-functional giống hệt | Viết content concrete về domain khen thưởng |
| 3 | Thấp | Tech stack khác | OK, có thể thêm chiều sâu |
| 4 | Trung bình | Cấu trúc 4.1 — 4.5 giống | Diagram + screenshot khác. Thêm code listing |
| 5 | **Cao** | Pattern Thực trạng/Giải pháp/Kết quả y hệt | Viết số đo cụ thể, tránh sáo rỗng |
| 6 | Thấp | Generic | OK |

### Quy tắc tránh đạo văn
- KHÔNG copy nguyên đoạn nào từ mẫu — kể cả các đoạn "dễ trùng" như "Hệ thống được thiết kế theo mô hình..." hay "Dễ dàng truy xuất và cập nhật thông tin...".
- Diễn đạt lại bằng từ ngữ riêng. Ví dụ thay "tiết kiệm thời gian xử lý công việc" → "rút ngắn vòng lặp xét duyệt từ tuần xuống ngày".
- Thay metaphor và ví dụ: mẫu nói "loại bỏ 95% lỗi nhập liệu" — mình nên đo cụ thể từ project (vd: "phát hiện 100% trường hợp đề xuất sai chu kỳ trong 1247 hồ sơ test").
- Cấu trúc câu khác: mẫu hay dùng "Cụ thể, ..." — mình có thể thay bằng "Chi tiết hơn, ..." hoặc tách câu.

### Checklist trước khi nộp
- [ ] Kiểm tra word count (~30000 từ, ~80 trang)
- [ ] Tất cả hình caption đúng format "Hình X.Y: ..."
- [ ] Tất cả bảng caption đúng format "Bảng X.Y: ..."
- [ ] Mục lục tự động (LaTeX `\tableofcontents`)
- [ ] Danh mục hình + bảng tự động
- [ ] Đánh số trang Ả Rập từ Ch.1
- [ ] Front matter dùng số La Mã hoặc không số
- [ ] Reference đầy đủ ≥ 12 nguồn IEEE
- [ ] Phụ lục có ít nhất 2 mục
- [ ] Code listing có syntax highlight (LaTeX `listings` package)
- [ ] Không trùng câu với mẫu (Turnitin check < 15%)
