# Cảnh báo Trùng lặp / Đạo văn so với báo cáo mẫu

> File này quét những phần có nguy cơ trùng lặp cao nếu bạn vô tình copy nguyên si từ báo cáo mẫu `2025-06-28_16-04-25_datn_20242.pdf`. Tránh các bẫy này để pass Turnitin / DoIT plagiarism check (HUST thường đặt ngưỡng 25–30 %).

---

## 1. Phần cực kỳ rủi ro (KHÔNG được copy nguyên văn)

### 1.1. Lời cảm ơn
Báo cáo mẫu cảm ơn ThS. Lê Đức Trung. Bạn có giảng viên hướng dẫn riêng — viết hoàn toàn khác. Tránh các cụm cố định "Trước hết, em xin gửi lời cảm ơn chân thành...", "Đặc biệt, em xin gửi lời biết ơn sâu sắc...".

### 1.2. Tóm tắt nội dung đồ án
Đoạn đầu báo cáo mẫu mở đầu bằng "Trong bối cảnh chuyển đổi số đang diễn ra mạnh mẽ trong toàn quân...". **Đây là cụm cực dễ bị nhận dạng**. Phải tự viết theo công thức khác:

- Dẫn dắt: nói về **đặc thù khen thưởng quân đội** (chuỗi Nghị định 91/2017, Luật Thi đua khen thưởng 2022, ...) — **không** dùng cụm "chuyển đổi số toàn quân".
- Vấn đề: "Phòng QLKT đang quản lý ... bằng Excel/giấy tờ → khó truy vết, khó tính chuỗi BKBQP/CSTDTQ/BKTTCP, dễ trùng/sót khen".
- Giải pháp: "Hệ thống web Next.js + Express + PostgreSQL với engine kiểm tra điều kiện chuỗi tự động..."

### 1.3. Chương 1 — Đặt vấn đề
Báo cáo mẫu lặp 3 lần cụm "chuyển đổi số trong toàn quân", "phòng Công nghệ thông tin Học viện Khoa học Quân sự", "phương pháp truyền thống dựa vào Excel/giấy tờ". **Phải viết khác cấu trúc câu**:

- Mẫu HRM: "Trước thực trạng này, việc triển khai một hệ thống quản lý nhân sự điện tử..."
- Của bạn (gợi ý): "Quản lý khen thưởng tại Phòng X hiện vận hành thủ công, đặc biệt việc xét điều kiện chuỗi danh hiệu kéo dài 7 năm với 3 cấp BKBQP – CSTDTQ – BKTTCP đòi hỏi tra cứu chéo nhiều bảng Excel..."

### 1.4. Chương 3 — Mô tả công nghệ
Đây là **chương rủi ro cao nhất** vì cùng dùng JavaScript stack. Báo cáo mẫu có các đoạn rất công thức:

| Cụm dễ trùng từ báo cáo mẫu | Cách bạn nên viết |
|---|---|
| "Node.js là môi trường chạy JavaScript được xây dựng trên công cụ JavaScript V8 của Google Chrome..." | Tham chiếu **release date + creator + dùng cụm khác** + giải thích **vì sao chọn cho PM QLKT cụ thể** (vd: "phù hợp với hệ thống có nhiều I/O DB từ recalc batch eligibility hằng đêm") |
| "JSON Web Token (JWT) là tiêu chuẩn mở (RFC 7519)..." | Diễn đạt khác: "Hệ thống áp dụng JWT (chuẩn RFC 7519) cho cơ chế xác thực không trạng thái — phù hợp với kiến trúc API REST..." |
| "Express.js là khung phát triển web tối giản và linh hoạt nhất cho Node.js..." | Đừng tâng bốc Express. Viết sự kiện: "Express được chọn do tương thích tốt với middleware chain mà PM QLKT cần (verifyToken → requireRole → validate → auditLog)..." |

**Tip pass plagiarism**: Khi viết về một công nghệ phổ thông (Node.js, React, JWT, Bcrypt), thêm **1–2 câu phân tích cụ thể nó dùng vào việc gì trong PM QLKT**. Ví dụ Bcrypt: "Mật khẩu trong bảng `TaiKhoan` được hash bằng bcrypt với cost factor 10 — cân bằng giữa thời gian login (~80 ms) và bảo mật khi DB bị đánh cắp."

### 1.5. Chương 4 — Mô hình MVC
Báo cáo mẫu có hình **MVC Architecture Pattern** (lấy từ internet — Hình 4.1) + đoạn "Model (M): thành phần chịu trách nhiệm chính trong việc quản lý dữ liệu..." . Cụm này có ở **hàng nghìn báo cáo trên Google**. Plagiarism tool sẽ flag.

→ Bạn dùng **Layered Architecture** (Route → Controller → Service → Repository → Prisma) thay vì pure MVC. Đây là **điểm khác biệt thật** vì BE-QLKT có lớp Repository (commit `9bd12f6`). Vẽ sơ đồ riêng + giải thích lý do tách Repository (xem `03-architecture.md` — sơ đồ C1.2).

### 1.6. Wireframe / mockup giao diện
Báo cáo mẫu có 6 wireframe đơn giản (Header / Login form / Sidebar / Title / Charts ...). Bạn KHÔNG nên copy bố cục đó.

→ Tự thiết kế trên Figma/Excalidraw với layout **đặc thù PM QLKT**: cây đơn vị (CQDV → DVTT → quân nhân) ở sidebar, tab khen thưởng theo 7 loại, multi-step form đề xuất.

---

## 2. Phần TRUNG BÌNH (cần đổi cách diễn đạt)

### 2.1. Mô tả các use case chuẩn
Cụm "Tên ca sử dụng / Tác nhân hệ thống / Tiền điều kiện / Luồng sự kiện chính / Luồng sự kiện thay thế / Hậu điều kiện" — đây là **template UML chuẩn**, không thuộc đạo văn. Giữ nguyên cấu trúc bảng OK.

Chỉ cần khác **nội dung từng cell** — vốn đã khác hoàn toàn (HRM vs khen thưởng).

### 2.2. Yêu cầu phi chức năng (bảo mật)
Báo cáo mẫu liệt kê 6 mục: JWT, Bcrypt, ORM-Sequelize, DOMPurify, Backup, Audit log.

→ Của bạn (đề xuất): JWT (access + refresh), Bcrypt cost 10, **Joi validation** (không phải Sequelize — bạn dùng Prisma), **Helmet + CORS**, **Rate limiter**, **Audit log với resource visibility theo role** (đặc biệt `backup` chỉ SUPER_ADMIN xem được — cái này HRM mẫu không có), **Daily backup tự động qua cron**.

→ Khác về: 6 → 7 mục, 1 mục khác (Helmet/CORS thay DOMPurify), nhấn mạnh visibility-by-role là điểm riêng.

### 2.3. Mô tả lý do chọn từng công nghệ
Mỗi technology có nhiều cách "mô tả ưu điểm" giống nhau (open-source, performance, cộng đồng lớn, ...). Plagiarism tool đôi khi flag vì cụm này.

→ Mẹo: Mỗi khi nói "ưu điểm là...", **gắn ngay với 1 trường hợp cụ thể trong PM QLKT**. Ví dụ:
- ❌ "Prisma có ưu điểm là type-safe."
- ✅ "Prisma sinh client typed từ schema, giúp 22 model của PM QLKT (CoQuanDonVi, QuanNhan, DanhHieuHangNam, ...) đều được TypeScript autocomplete khi truy vấn — giảm lỗi runtime trong các service eligibility chuỗi vốn truy cập nhiều bảng cùng lúc."

---

## 3. Phần AN TOÀN (có thể tham khảo cấu trúc)

Các phần sau **chỉ tham khảo cấu trúc/format**, không có vấn đề trùng lặp:

- Bố cục 6 chương chuẩn ĐATN HUST
- Cách đánh số hình `Hình X.Y`, bảng `Bảng X.Y`
- Cách dùng package diagram + class diagram + sequence diagram (UML chuẩn)
- Format bảng kiểm thử (ID, Mô tả, Đầu vào, Kết quả mong đợi, Pass/Fail)

---

## 4. Khác biệt cốt lõi giữa PM QLKT và HRM mẫu

Khi viết, **luôn nhấn vào các điểm khác** sau (giúp giảm tỉ lệ trùng lặp tự nhiên):

| HRM mẫu | PM QLKT (của bạn) |
|---|---|
| 5 actor (Admin, HR Manager, PM, Employee, Ứng viên) | 4 actor (SUPER_ADMIN, ADMIN, MANAGER, USER) |
| Quản lý nhân viên + dự án + chấm công + tuyển dụng | Quản lý quân nhân + 7 loại khen thưởng + đề xuất + duyệt + chuỗi rule |
| Tuyển dụng (CV, phỏng vấn, email tự động) | Đề xuất khen thưởng (Strategy pattern 7 loại) |
| Chấm công, đơn xin phép | NCKH, Lịch sử chức vụ |
| MySQL + Sequelize + XAMPP | PostgreSQL + Prisma + Docker (giả định) |
| React (CRA) | Next.js 14 App Router |
| 14 bảng DB | **23 bảng DB** |
| Không có rule chuỗi nghiệp vụ phức tạp | **Chain rule BKBQP/CSTDTQ/BKTTCP với cycle 2/3/7 năm + lifetime block** |
| Không có pattern thiết kế đặc biệt | **Strategy pattern + Repository pattern + Layered architecture** |
| Không có audit visibility theo role | **`resource: 'backup'` chỉ SUPER_ADMIN** xem được |
| Wireframe đơn giản | **Cây đơn vị 2 cấp + multi-step proposal form + 7 tab khen thưởng** |
| Không có bảo mật theo đặc thù quân đội | Phân quyền theo cây đơn vị, manager chỉ duyệt trong CQDV của mình |

→ **Trong mỗi chương, dành ít nhất 1 đoạn nhấn vào sự khác biệt này** (vd: "Khác với hệ thống HRM thông thường, PM QLKT phải xử lý chuỗi danh hiệu kéo dài tới 7 năm..."). Đoạn này tự nhiên không trùng với báo cáo nào.

---

## 5. Trước khi nộp — checklist plagiarism

- [ ] Chạy Turnitin (nếu trường có) hoặc **plagiarism-checker.com**, **DoIT**, **DupliChecker**
- [ ] Đặt mục tiêu: tổng tỉ lệ < 25 %, không đoạn nào > 5 % match với 1 nguồn duy nhất
- [ ] Đặc biệt scan Chương 1 (Đặt vấn đề) và Chương 3 (Công nghệ) — đây là 2 chương rủi ro nhất
- [ ] Tránh copy bullet point "ưu điểm/đặc điểm công nghệ" từ Wikipedia/blog
- [ ] Tự viết tóm tắt + đặt vấn đề theo nghiệp vụ khen thưởng cụ thể, không theo công thức "chuyển đổi số toàn quân"
- [ ] Mọi định nghĩa kỹ thuật (JWT, Bcrypt, ...) đều phải có **1 câu kết nối với PM QLKT**
- [ ] Hình ảnh sơ đồ tự vẽ (đã có sẵn `01-use-case.md` → `06-erd.md`), không screenshot từ báo cáo mẫu
- [ ] Code snippet trong báo cáo lấy từ project của mình, **không** copy code mẫu trên blog
- [ ] Trích dẫn rõ ràng các nguồn tham khảo (sách, RFC, tài liệu Prisma/Next.js) ở mục Tài liệu tham khảo

---

## 6. Tóm tắt — 3 nguyên tắc vàng

1. **Thay vì mô tả công nghệ chung chung → mô tả công nghệ trong ngữ cảnh PM QLKT cụ thể.**
2. **Thay vì copy cấu trúc câu → giữ ý, đổi cấu trúc + đổi từ vựng.**
3. **Tự vẽ sơ đồ + tự chụp ảnh giao diện → không screenshot từ PDF mẫu.**
