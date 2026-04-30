---
marp: true
paginate: true
size: 4:3
theme: default
header: '**ĐATN — Phần mềm Quản lý Khen thưởng (PM QLKT)**'
footer: '© 2025/2026 — Đại học Bách khoa Hà Nội'
style: |
  :root {
    --hust-red: #c8102e;
    --hust-dark: #8a0c20;
    --bg-soft: #fafafa;
    --line: #e5e7eb;
  }
  section {
    font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
    font-size: 21px;
    background: #fff;
    color: #1f2937;
    padding: 60px 70px 70px;
  }
  header {
    color: var(--hust-red);
    font-size: 13px;
    padding: 16px 70px 0;
  }
  footer {
    color: #6b7280;
    font-size: 12px;
    padding: 0 70px 16px;
  }
  section::after {
    color: var(--hust-red);
    font-weight: 700;
  }
  h1 {
    color: var(--hust-red);
    font-size: 34px;
    border-bottom: 3px solid var(--hust-red);
    padding-bottom: 8px;
    margin-bottom: 18px;
  }
  h2 {
    color: var(--hust-dark);
    font-size: 24px;
    margin: 14px 0 8px;
  }
  h3 {
    color: var(--hust-red);
    font-size: 18px;
    margin: 10px 0 6px;
  }
  ul, ol { margin: 6px 0; padding-left: 24px; }
  li { margin: 4px 0; }
  strong { color: var(--hust-dark); }
  table {
    font-size: 0.78em;
    border-collapse: collapse;
    margin: 8px auto;
    width: 100%;
  }
  th {
    background: var(--hust-red);
    color: #fff;
    text-align: left;
    padding: 8px 12px;
    font-weight: 600;
  }
  td {
    padding: 7px 12px;
    border-bottom: 1px solid var(--line);
    background: #fff;
  }
  tr:nth-child(even) td { background: var(--bg-soft); }
  code {
    background: #f3f4f6;
    color: var(--hust-dark);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.9em;
  }
  pre {
    background: #1e293b;
    color: #e2e8f0;
    font-size: 0.7em;
    padding: 12px 16px;
    border-radius: 6px;
    line-height: 1.5;
  }
  pre code { background: transparent; color: inherit; padding: 0; }
  blockquote {
    border-left: 4px solid var(--hust-red);
    padding: 6px 14px;
    color: #4b5563;
    background: var(--bg-soft);
    font-style: italic;
  }
  /* Title slide */
  section.title {
    text-align: center;
    justify-content: center;
    background:
      radial-gradient(circle at 20% 0%, rgba(200,16,46,.08), transparent 50%),
      radial-gradient(circle at 80% 100%, rgba(200,16,46,.08), transparent 50%);
  }
  section.title h1 { border: none; font-size: 44px; margin-bottom: 8px; }
  section.title h2 { color: #6b7280; font-weight: 400; font-size: 22px; margin-bottom: 30px; }
  section.title .meta { margin-top: 24px; font-size: 20px; line-height: 1.8; }
  section.title .meta strong { color: var(--hust-red); }
  section.title header, section.title footer { display: none; }
  /* Feature slide — banner header */
  section.feature h1 {
    background: linear-gradient(90deg, var(--hust-red), var(--hust-dark));
    color: #fff !important;
    padding: 12px 20px !important;
    border: none;
    border-radius: 8px;
    font-size: 28px;
  }
  section.feature h1::before {
    content: "★ TÍNH NĂNG NỔI BẬT — ";
    font-size: 0.55em;
    letter-spacing: 1px;
    opacity: 0.9;
    display: block;
    margin-bottom: 4px;
  }
  /* Layouts */
  .cols-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 8px; }
  .cols-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 8px; }
  .cols-2-3 { display: grid; grid-template-columns: 2fr 3fr; gap: 24px; margin-top: 8px; }
  .cols-3-2 { display: grid; grid-template-columns: 3fr 2fr; gap: 24px; margin-top: 8px; }
  /* Image placeholder box */
  .img-box {
    border: 2px dashed var(--hust-red);
    border-radius: 10px;
    padding: 22px 18px;
    text-align: center;
    color: #9ca3af;
    background:
      linear-gradient(45deg, #fff8f9 25%, #fff 25%, #fff 50%, #fff8f9 50%, #fff8f9 75%, #fff 75%);
    background-size: 14px 14px;
    font-style: italic;
    font-size: 0.85em;
    min-height: 160px;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column;
  }
  .img-box.tall { min-height: 380px; }
  .img-box.short { min-height: 130px; }
  .img-box .label { color: var(--hust-red); font-weight: 600; font-style: normal; margin-bottom: 6px; }
  .img-box .size { font-size: 0.82em; opacity: 0.7; margin-top: 6px; }
  /* Metric / stat card */
  .metric {
    background: #fff;
    border: 1px solid var(--line);
    border-left: 5px solid var(--hust-red);
    padding: 12px 16px;
    border-radius: 6px;
    margin: 6px 0;
  }
  .metric .num {
    color: var(--hust-red);
    font-size: 28px; font-weight: 700; line-height: 1;
  }
  .metric .label { color: #6b7280; font-size: 0.82em; margin-top: 4px; }
  /* Pill / tag */
  .pill {
    display: inline-block;
    background: #fef2f2;
    color: var(--hust-red);
    border: 1px solid #fecaca;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 0.78em;
    margin: 2px 4px 2px 0;
  }
  /* Callout */
  .callout {
    background: #fff8f9;
    border-left: 4px solid var(--hust-red);
    padding: 10px 14px;
    margin: 8px 0;
    border-radius: 4px;
    font-size: 0.88em;
  }
  /* Step / numbered card */
  .step {
    background: var(--bg-soft);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.85em;
    margin: 4px 0;
  }
  .step .n {
    display: inline-block;
    width: 24px; height: 24px;
    background: var(--hust-red); color: #fff;
    border-radius: 50%;
    text-align: center; line-height: 24px;
    font-weight: 700; margin-right: 8px;
    font-size: 0.78em;
  }
  /* Feature highlight box */
  .feat {
    background: #fff;
    border: 1px solid var(--line);
    border-top: 3px solid var(--hust-red);
    border-radius: 6px;
    padding: 10px 14px;
    margin: 6px 0;
  }
  .feat .ti {
    color: var(--hust-red);
    font-weight: 700;
    font-size: 0.95em;
    margin-bottom: 4px;
  }
  .feat .de { color: #4b5563; font-size: 0.85em; line-height: 1.5; }
---

<!-- _class: title -->

# PHẦN MỀM QUẢN LÝ KHEN THƯỞNG

## Đồ án Tốt nghiệp Đại học — Niên khóa 2025/2026

<div class="meta">

**Sinh viên thực hiện**: [Họ tên đầy đủ]
**Mã số sinh viên**: [MSSV]
**Lớp**: [Tên lớp]

**Giảng viên hướng dẫn**: [Học hàm. Tên giảng viên]

</div>

ĐẠI HỌC BÁCH KHOA HÀ NỘI

---

# Nội dung trình bày

<div class="cols-2">
<div>

### Phần I — Mở đầu
1. **Mục tiêu của đồ án**
2. **Phân tích bài toán**
3. **Hệ thống danh hiệu khen thưởng**
4. **Logic chuỗi danh hiệu**

### Phần II — Thiết kế
5. **Kiến trúc & công nghệ**
6. **Cơ sở dữ liệu**
7. **Phân tích chức năng & quy trình**
8. **Kiến trúc phần mềm**

</div>
<div>

### Phần III — Tính năng nổi bật
9. **Tự động xét điều kiện**
10. **Quy trình đề xuất & ra quyết định**
11. **Nhập/xuất dữ liệu hàng loạt**
12. **Vận hành & quản trị hệ thống**

### Phần IV — Đánh giá & Tổng kết
13. **Kiểm thử, hiệu năng, triển khai**
14. **Kết luận và hướng phát triển**

</div>
</div>

<div class="callout">
⏱️ Thời lượng trình bày: <strong>13–14 phút</strong>, sau đó là phần Hỏi & Đáp với Hội đồng.
</div>

---

# Mục tiêu của đồ án

<div class="cols-2">
<div>

## Bối cảnh và động lực

- Quy trình quản lý khen thưởng tại đơn vị quân đội hiện chủ yếu dựa trên **Excel và hồ sơ giấy**
- Khó tra cứu lịch sử khen thưởng nhiều năm của cá nhân và đơn vị
- **Quy định xét chuỗi danh hiệu phức tạp** (BKBQP, CSTDTQ, BKTTCP) dễ gây sai sót khi tính thủ công
- Yêu cầu vận hành trên **mạng nội bộ**, không phụ thuộc Internet

</div>
<div>

## Mục tiêu cụ thể

- Xây dựng phần mềm **quản lý 5 nhóm khen thưởng** (UC5–UC9) với 4 cấp vai trò
- **Tự động hóa** xét điều kiện theo quy định hiện hành
- Hỗ trợ quy trình **đề xuất → duyệt → ra quyết định**
- Đảm bảo **truy vết (audit) và bảo mật** đầy đủ
- **Triển khai được trên mạng nội bộ offline**

<div class="callout">
🎯 <strong>Mục tiêu cốt lõi</strong>: Giảm sai sót thủ công, tiết kiệm thời gian, đảm bảo đúng quy định.
</div>

</div>
</div>

---

# Phân tích bài toán — 6 nhóm thách thức

<div class="cols-2">
<div>

### 🏛️ Nghiệp vụ phức tạp
**5 nhóm khen thưởng** (UC5–UC9), mỗi nhóm có quy định xét duyệt riêng

### 🔗 Logic chuỗi danh hiệu
Cửa sổ trượt 3 năm và 7 năm; ràng buộc lifetime đối với BKTTCP cá nhân

### 👥 Phân quyền 4 cấp
SUPER_ADMIN > ADMIN > MANAGER > USER, dữ liệu giới hạn theo phạm vi đơn vị

</div>
<div>

### ⚡ Thông báo thời gian thực
Cập nhật trạng thái duyệt đến người liên quan ngay tức thì

### 📋 Truy vết toàn diện
Mọi thao tác phải được ghi nhận để phục vụ kiểm tra nội bộ

### 🌐 Triển khai offline
Hệ thống vận hành trong **mạng nội bộ**, không gọi dịch vụ ngoài

</div>
</div>

<div class="callout">
💡 Trọng tâm khó nhất là <strong>logic chuỗi danh hiệu</strong> — sẽ được trình bày chi tiết ở slide kế tiếp.
</div>

---

# Hệ thống khen thưởng — 5 nhóm UC5–UC9

| UC | Nhóm khen thưởng | Phân rã chi tiết | Tiêu chí xét |
|---|---|---|---|
| **UC5** | **Khen thưởng hằng năm** | Cá nhân (CSTDCS, CSTT, BKBQP, CSTDTQ, BKTTCP) + Đơn vị (ĐVQT, ĐVTT, BKBQP, BKTTCP) | Theo năm |
| **UC6** | **Khen thưởng niên hạn** | HCCSVV (3 hạng), HCQKQT, KNC VSNXD QĐNDVN | Theo thời gian phục vụ |
| **UC7** | **Khen thưởng cống hiến** | HCBVTQ (3 hạng) | Cộng dồn 120 tháng |
| **UC8** | **Khen thưởng thành tích** | NCKH (Đề tài khoa học, Sáng kiến khoa học) | Theo công trình |
| **UC9** | **Khen thưởng đột xuất** | Theo sự kiện / chiến công cụ thể | Phi định kỳ |

<div class="callout">
✏️ Mỗi nhóm UC được hiện thực bằng một hoặc nhiều <strong>proposal type</strong> trong code, dispatch qua <strong>Strategy pattern</strong> — slide 12.
</div>

---

# Chuỗi danh hiệu hằng năm — Logic cốt lõi

<div class="cols-2-3">
<div>

### Chuỗi cá nhân

```
   CSTDCS × 2 năm
        │
        ▼
     BKBQP   (cycle 2y)
        │
   3y + 1 BKBQP/3y
        ▼
     CSTDTQ  (cycle 3y)
        │
   7y + 3 BKBQP
   + 2 CSTDTQ
   + NCKH/năm
        ▼
     BKTTCP  ⛔ lifetime
```

### Chuỗi đơn vị

```
ĐVQT × 2y → BKBQP →
7y + 3 BKBQP/7y → BKTTCP
            (lặp lại được)
```

</div>
<div>

### Quy tắc đặc biệt

<div class="metric">
<div class="num">3y / 7y</div>
<div class="label"><strong>Cửa sổ trượt</strong>: BKBQP của chu kỳ trước rơi ra → bắt buộc có BKBQP mới ở chu kỳ hiện tại</div>
</div>

<div class="metric">
<div class="num">×1</div>
<div class="label"><strong>Lifetime BKTTCP cá nhân</strong>: chỉ nhận một lần. Hệ thống chặn các đề xuất sau với thông báo cụ thể, do quy định chưa có danh hiệu cao hơn</div>
</div>

<div class="metric">
<div class="num">↻</div>
<div class="label"><strong>Lỡ đợt</strong>: chu kỳ vẫn tiếp tục đếm. Chu kỳ kế lại được xét, không yêu cầu đứt chuỗi CSTDCS / ĐVQT</div>
</div>

</div>
</div>

---

# Kiến trúc tổng quan hệ thống

<div class="img-box tall">
<div class="label">📐 ẢNH: Sơ đồ kiến trúc hệ thống</div>
Browser ⇄ Frontend (Next.js) ⇄ Backend (Express) ⇄ PostgreSQL
+ Socket.IO real-time + PM2 process manager
<div class="size">Kích thước gợi ý: 800 × 380 px — vẽ bằng draw.io hoặc Excalidraw</div>
</div>

<div class="cols-3" style="margin-top:14px">
<div>

### 🎨 Tầng giao diện
**Next.js 14**, Ant Design, TypeScript end-to-end

</div>
<div>

### ⚙️ Tầng ứng dụng
**Express** + Prisma ORM, layered Controller→Service→Repository

</div>
<div>

### 💾 Tầng dữ liệu
**PostgreSQL** + Socket.IO real-time, PM2 process manager

</div>
</div>

---

# Công nghệ sử dụng — Tech Stack

<div class="cols-2">
<div>

## 🎨 Frontend

- **Next.js 14** (App Router) — server components, file-based routing
- **TypeScript** — type safety toàn dự án
- **Ant Design** — component nghiệp vụ (Form, Table, DatePicker)
- **Tailwind CSS + shadcn/ui** — styling tùy biến
- **Zod** — schema validation chia sẻ giữa client và server
- **Socket.IO client** — nhận thông báo real-time

<div class="callout" style="font-size:0.82em">
✓ <strong>Schema Zod dùng chung</strong> cho cả FE và BE — đảm bảo type-safe end-to-end và tránh lệch quy tắc validate.
</div>

</div>
<div>

## ⚙️ Backend & CSDL

- **Express + TypeScript** — REST API
- **Prisma ORM 6.x** — type-safe queries, migration tự động
- **PostgreSQL** — RDBMS, transaction `SERIALIZABLE`
- **Zod** — validate request body, schema dùng chung với FE
- **JWT 2 token** — xác thực access + refresh
- **bcrypt** — hash password (10 rounds)

<div class="callout" style="font-size:0.82em">
✓ <strong>Prisma Client type-safe</strong>: kiểm tra kiểu ở thời điểm biên dịch.
</div>

</div>
</div>

<div class="cols-3" style="margin-top:8px">
<div><span class="pill">🔔 Socket.IO</span> Real-time push</div>
<div><span class="pill">🚀 PM2</span> Process manager + auto-restart</div>
<div><span class="pill">📅 node-cron</span> Backup tự động</div>
</div>
<div class="cols-3" style="margin-top:4px">
<div><span class="pill">📊 ExcelJS</span> Import/Export Excel</div>
<div><span class="pill">📄 PDFKit</span> Sinh quyết định PDF</div>
<div><span class="pill">🐳 Local deploy</span> Mạng nội bộ offline</div>
</div>

---

# Thiết kế cơ sở dữ liệu

<div class="cols-3-2">
<div>

<div class="img-box tall">
<div class="label">🗂️ ẢNH: Sơ đồ ERD rút gọn</div>
QuanNhan ⇄ CoQuanDonVi ⇄ DonViTrucThuoc
BangDeXuat ⇄ HoSo* ⇄ DanhHieu*
<div class="size">Nguồn sẵn có: <code>BE-QLKT/prisma/ERD.svg</code><br>Kích thước gợi ý: 600 × 480 px</div>
</div>

</div>
<div>

## Tổng quan

<div class="metric">
<div class="num">23</div>
<div class="label">bảng chính, FK đầy đủ, ID dạng CUID 25 ký tự</div>
</div>

### Nhóm bảng

- **Tổ chức**
  `QuanNhan`, `CoQuanDonVi`, `DonViTrucThuoc`, `ChucVu`
- **Đề xuất & Hồ sơ**
  `BangDeXuat`, `DanhHieuHangNam`, `HoSoNienHan`, `HoSoCongHien`, ...
- **Tài khoản**
  `TaiKhoan` — 4 vai trò
- **Phụ trợ**
  `SystemLog`, `ThongBao`, `FileQuyetDinh`, `SystemSetting`

</div>
</div>

---

# Phân tích chức năng — Use-case Diagram

<div class="cols-2-3">
<div>

## Phân quyền theo vai trò

| Vai trò | Phạm vi |
|---|---|
| **USER** | Cá nhân |
| **MANAGER** | Đơn vị quản lý |
| **ADMIN** | Toàn nghiệp vụ |
| **SUPER_ADMIN** | Hệ thống + quản trị |

<div class="callout" style="font-size:0.82em">
🔐 <strong>Hai lớp phân quyền</strong>: middleware <code>requireRole</code> chặn ở route + <code>unitFilter</code> giới hạn dữ liệu theo đơn vị.
</div>

</div>
<div>

<div class="img-box tall">
<div class="label">🧑‍💼 ẢNH: Use-case Diagram</div>
4 actor: USER / MANAGER / ADMIN / SUPER_ADMIN
9 use-case: tạo đề xuất, duyệt, ký quyết định, import/export, audit, backup, ...
<div class="size">Vẽ bằng draw.io / Mermaid Live<br>Kích thước gợi ý: 720 × 540 px</div>
</div>

</div>
</div>

---

# Thiết kế hoạt động — Quy trình duyệt đề xuất

<div class="cols-3-2">
<div>

<div class="img-box tall">
<div class="label">🔄 ẢNH: Activity Diagram</div>
USER tạo → MANAGER duyệt → ADMIN ký
+ nhánh từ chối, kiểm tra eligibility, cấp số quyết định, sinh PDF, gửi thông báo
<div class="size">Vẽ bằng draw.io / Mermaid Live<br>Kích thước gợi ý: 600 × 540 px</div>
</div>

</div>
<div>

## Các bước chính

<div class="step"><span class="n">1</span>USER tạo đề xuất (form / Excel)</div>
<div class="step"><span class="n">2</span>MANAGER review cấp đơn vị</div>
<div class="step"><span class="n">3</span>ADMIN kiểm tra điều kiện và cấp số quyết định</div>
<div class="step"><span class="n">4</span>Sinh PDF, lưu file đính kèm</div>
<div class="step"><span class="n">5</span>Cập nhật hồ sơ + thông báo + audit log</div>

<div class="callout" style="font-size:0.82em">
⚙️ Bước 3–5 thực hiện trong <strong>một transaction Prisma</strong> bảo đảm tính nhất quán.
</div>

</div>
</div>

---

# Kiến trúc phần mềm — Strategy Pattern

<div class="cols-2">
<div>

## Vấn đề
5 nhóm UC5–UC9 được hiện thực thành 8 proposal type ở tầng nghiệp vụ, mỗi loại có logic submit / validate / import khác nhau → nếu dùng `if/else` sẽ tạo file 2000+ dòng, khó test và bảo trì.

## Giải pháp
Định nghĩa **interface chung**, mỗi loại 1 file riêng, dispatch qua **Registry**.

```typescript
interface ProposalStrategy {
  buildSubmitPayload(data);
  validateApprove(ctx);
  importInTransaction(tx);
  buildSuccessMessage(result);
}
```

</div>
<div>

<div class="img-box tall">
<div class="label">📐 ẢNH: Class Diagram (UML)</div>
Interface ProposalStrategy
+ 7 implementation (DOT_XUAT có flow riêng, không qua proposal)
+ Registry map
<div class="size">Vẽ bằng draw.io / Mermaid<br>Kích thước gợi ý: 480 × 540 px</div>
</div>

<div class="callout" style="font-size:0.82em">
🔁 <code>HC_QKQT</code> và <code>KNC</code> chia sẻ helper <code>singleMedalImporter</code> để DRY.
</div>

</div>
</div>

---

<!-- _class: feature -->

# Tự động xét điều kiện khen thưởng

<div class="cols-2">
<div>

## Cách thức hoạt động

<div class="feat">
<div class="ti">🎯 Xét điều kiện hai lớp đồng bộ</div>
<div class="de"><code>computeEligibilityFlags</code> (recalc hồ sơ) và <code>checkAwardEligibility</code> (validate API) dùng chung helper lõi <code>chainEligibility</code> — bảo đảm hiển thị và xét duyệt nhất quán.</div>
</div>

<div class="feat">
<div class="ti">💬 Gợi ý đề xuất tự động theo năm</div>
<div class="de">Hồ sơ hằng năm tự sinh <code>goi_y</code> như <em>"Đủ điều kiện đề nghị BKBQP năm 2026"</em> — cán bộ chỉ cần xác nhận để tạo đề xuất.</div>
</div>

<div class="feat">
<div class="ti">⏱️ Recalc tự động khi có thay đổi</div>
<div class="de">Khi quân nhân nhận danh hiệu mới, đổi đơn vị, hoặc cập nhật năm phục vụ — hệ thống tính lại toàn bộ chuỗi và cập nhật trạng thái đủ/không đủ điều kiện.</div>
</div>

<div class="feat">
<div class="ti">📅 Lịch sử khen thưởng dạng timeline</div>
<div class="de">Hiển thị toàn bộ danh hiệu của một quân nhân theo trục thời gian — dễ quan sát chuỗi BKBQP/CSTDTQ/BKTTCP.</div>
</div>

</div>
<div>

<div class="img-box tall">
<div class="label">🖼️ ẢNH: Trang hồ sơ + Timeline chuỗi danh hiệu</div>
Hiển thị thông tin quân nhân, danh hiệu các năm, gợi ý đề xuất
<div class="size">Kích thước gợi ý: 540 × 460 px</div>
</div>

<div class="callout" style="font-size:0.82em; margin-top:10px">
✅ Loại bỏ hoàn toàn việc <strong>tính thủ công</strong> các quy định phức tạp 2y / 3y / 7y.
</div>

</div>
</div>

---

<!-- _class: feature -->

# Quy trình đề xuất và ra quyết định

<div class="cols-2">
<div>

## Đặc điểm chính

<div class="feat">
<div class="ti">📝 Form đề xuất theo từng nhóm UC</div>
<div class="de">Mỗi nhóm khen thưởng UC5–UC9 có form riêng với các trường nghiệp vụ phù hợp. Schema <strong>Zod chia sẻ giữa client và server</strong> đảm bảo nhất quán.</div>
</div>

<div class="feat">
<div class="ti">⛓️ Workflow ba cấp duyệt</div>
<div class="de">USER → MANAGER cấp đơn vị → ADMIN cấp toàn nghiệp vụ. Mỗi bước có thể duyệt hoặc từ chối kèm lý do, gửi thông báo về người tạo.</div>
</div>

<div class="feat">
<div class="ti">🔢 Cấp số quyết định tự động</div>
<div class="de">Sinh số quyết định theo định dạng và bộ đếm riêng cho từng năm — đảm bảo không trùng lặp.</div>
</div>

<div class="feat">
<div class="ti">📄 Sinh PDF quyết định ký số</div>
<div class="de">Áp dụng template theo từng loại danh hiệu, kết xuất PDF đính kèm vào đề xuất, lưu trữ tập trung trong thư mục <code>storage/</code>.</div>
</div>

</div>
<div>

<div class="img-box tall">
<div class="label">🖼️ ẢNH: Trang duyệt đề xuất + PDF quyết định</div>
Bảng eligibility, danh sách đối tượng, bản xem trước PDF
<div class="size">Kích thước gợi ý: 540 × 460 px</div>
</div>

<div class="callout" style="font-size:0.82em; margin-top:10px">
🔐 Toàn bộ quy trình thực hiện trong <strong>một transaction</strong>, kèm <strong>audit log</strong> chi tiết và phát thông báo real-time.
</div>

</div>
</div>

---

<!-- _class: feature -->

# Nhập / Xuất dữ liệu hàng loạt qua Excel

<div class="cols-2">
<div>

## Pattern hai bước an toàn

<div class="feat">
<div class="ti">👁️ Bước 1 — Preview</div>
<div class="de">Parse file Excel, validate từng dòng (định dạng ngày, CCCD, mã quân nhân, mã đơn vị). Hiển thị bảng lỗi cụ thể trên giao diện trước khi commit.</div>
</div>

<div class="feat">
<div class="ti">✅ Bước 2 — Confirm</div>
<div class="de">Cán bộ xác nhận dữ liệu đúng → ghi vào CSDL trong một transaction. Nếu một dòng lỗi, toàn bộ rollback.</div>
</div>

<div class="feat">
<div class="ti">📋 Template chuẩn có data validation</div>
<div class="de">Hệ thống sinh template Excel với dropdown (cấp bậc, đơn vị, danh hiệu), định dạng ngày tháng — cán bộ điền theo mẫu, giảm sai sót.</div>
</div>

<div class="feat">
<div class="ti">⚡ Hiệu năng cao</div>
<div class="de">Áp dụng <strong>batch query</strong>: collect IDs → 1 query <code>findMany</code> → đẩy vào <code>Map</code>. Import 1000 dòng dưới 2 giây.</div>
</div>

</div>
<div>

<div class="img-box tall">
<div class="label">🖼️ ẢNH: Trang Preview Import Excel</div>
Bảng dữ liệu, cột trạng thái Hợp lệ / Lỗi, thông báo lỗi từng dòng
<div class="size">Kích thước gợi ý: 540 × 460 px</div>
</div>

<div class="callout" style="font-size:0.82em; margin-top:10px">
📤 Hỗ trợ <strong>Import hàng loạt</strong> các nhóm UC5–UC8 qua Excel + <strong>Export báo cáo</strong> theo năm và đơn vị.
</div>

</div>
</div>

---

<!-- _class: feature -->

# Vận hành & Quản trị hệ thống

<div class="cols-3">
<div>

### 🔔 Thông báo Real-time

<div class="feat">
<div class="ti">Socket.IO push</div>
<div class="de">Phát thông báo qua WebSocket theo room <code>user_id</code> khi có sự kiện liên quan.</div>
</div>

<div class="feat">
<div class="ti">Lưu lâu dài</div>
<div class="de">Đồng thời lưu vào bảng <code>ThongBao</code> để người dùng offline vẫn nhận sau khi đăng nhập.</div>
</div>

</div>
<div>

### 📋 Audit Log

<div class="feat">
<div class="ti">Ghi nhận đầy đủ</div>
<div class="de">Middleware tự động ghi: ai (user_id) làm gì (action) trên đối tượng nào (resource), kèm IP và user-agent.</div>
</div>

<div class="feat">
<div class="ti">Lọc đa chiều</div>
<div class="de">Tìm theo user / hành động / loại tài nguyên / khoảng thời gian. Phân quyền hiển thị theo vai trò.</div>
</div>

</div>
<div>

### 💾 Backup & DevZone

<div class="feat">
<div class="ti">Backup tự động</div>
<div class="de">Lập lịch qua <code>node-cron</code>, kết xuất file SQL vào thư mục <code>backups/</code>. Restore bằng <code>psql</code>.</div>
</div>

<div class="feat">
<div class="ti">DevZone (SUPER_ADMIN)</div>
<div class="de">Bật/tắt schedule, tải về backup, cài đặt hệ thống — quản trị tập trung tại một nơi.</div>
</div>

</div>
</div>

<div class="img-box short" style="margin-top:12px">
<div class="label">🖼️ ẢNH: Notification panel + Audit log + DevZone</div>
Có thể chèn 2–3 ảnh nhỏ ghép ngang
<div class="size">Kích thước gợi ý: 800 × 200 px</div>
</div>

---

# Kiểm thử, Hiệu năng và Triển khai

<div class="cols-2">
<div>

## Kiểm thử & Hiệu năng

<div class="metric">
<div class="num">74</div>
<div class="label">file kiểm thử Jest, pass <strong>100%</strong></div>
</div>

<div class="metric">
<div class="num">< 2s</div>
<div class="label">Import Excel <strong>1000 dòng</strong> nhờ batch query</div>
</div>

### 4 kịch bản nổi bật
<div class="step"><span class="n">1</span><strong>Race condition</strong> — 2 quản trị duyệt song song, chỉ 1 thành công (Prisma SERIALIZABLE)</div>
<div class="step"><span class="n">2</span><strong>BKTTCP eligibility</strong> — cửa sổ trượt 7y + lifetime</div>
<div class="step"><span class="n">3</span><strong>Tampering</strong> — server vẫn ghi đúng dù admin sửa payload</div>
<div class="step"><span class="n">4</span><strong>Vòng đời thực tế</strong> — quân nhân lên cấp danh hiệu</div>

</div>
<div>

## Triển khai mạng nội bộ

<div class="step"><span class="n">1</span>Cài <code>node_modules</code> trên máy có Internet, chuyển sang máy nội bộ</div>
<div class="step"><span class="n">2</span>Tạo CSDL PostgreSQL rỗng + cấu hình <code>.env</code></div>
<div class="step"><span class="n">3</span><code>npm run setup</code> — tạo bảng và SUPER_ADMIN (idempotent)</div>
<div class="step"><span class="n">4</span><code>npm run serve</code> — build + khởi chạy bằng PM2</div>

<div class="metric" style="margin-top:10px">
<div class="num">PM2</div>
<div class="label">Auto-restart, giới hạn RAM 500MB, log rotation</div>
</div>

<div class="callout" style="font-size:0.82em">
🌐 Hệ thống vận hành <strong>hoàn toàn offline</strong> sau khi cài đặt.
</div>

</div>
</div>

---

# Kết luận và hướng phát triển

<div class="cols-3">
<div>

### ✅ Đã đạt được
- Hoàn thành 5 nhóm khen thưởng (UC5–UC9), 4 vai trò
- Tự động hóa toàn bộ quy trình xét duyệt
- 74 file test bao phủ logic cốt lõi
- Triển khai thực tế trên mạng nội bộ
- Kiến trúc layered + Strategy rõ ràng

<div class="metric" style="margin-top:8px">
<div class="num">~100k</div>
<div class="label">LOC tổng dự án (BE + FE)</div>
</div>

</div>
<div>

### ⚠️ Hạn chế
- BKTTCP cá nhân lifetime — chưa hỗ trợ danh hiệu cao hơn
- Chưa có module thống kê (BI) chi tiết
- Chỉ chạy 1 instance — chưa scale ngang
- Ký số quyết định còn ở mức lưu file PDF, chưa tích hợp Smart Card

</div>
<div>

### 🚀 Hướng phát triển
- Ứng dụng di động cho cấp duyệt nhanh
- Module BI: biểu đồ xu hướng khen thưởng theo năm và đơn vị
- Tích hợp ký số bằng **Smart Card / USB token**
- Cluster mode + Redis adapter cho Socket.IO khi mở rộng quy mô

</div>
</div>

<div class="callout" style="margin-top:14px">
🎯 Phần mềm đã sẵn sàng <strong>triển khai thử nghiệm tại đơn vị</strong>, đáp ứng đầy đủ các mục tiêu đặt ra ban đầu.
</div>

---

<!-- _class: title -->

# EM XIN TRÂN TRỌNG CẢM ƠN

## Hội đồng đã lắng nghe phần trình bày

<div class="meta" style="margin-top:40px">

Em rất mong nhận được **nhận xét và câu hỏi** từ Hội đồng

</div>

<div style="font-size:60px; margin-top:30px">🙏</div>
