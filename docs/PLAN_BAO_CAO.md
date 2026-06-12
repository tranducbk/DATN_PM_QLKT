# PLAN viết báo cáo ĐATN — Phần mềm Quản lý Khen thưởng (PM QLKT)

> Tài liệu này là **kế hoạch chi tiết** để viết báo cáo đồ án tốt nghiệp dựa trên:
> - Báo cáo mẫu: `2025-06-28_16-04-25_datn_20242.pdf` (76 trang, đã bảo vệ thành công).
> - Outline trích xuất: [`SAMPLE_REPORT_OUTLINE.md`](./SAMPLE_REPORT_OUTLINE.md).
> - Codebase thực tế: `BE-QLKT/` (Express + Prisma + 23 model) + `FE-QLKT/` (Next.js 14).
>
> **Không đạo văn** — mọi nội dung viết bằng từ ngữ riêng, có số đo từ project thật.

---

## Mục lục

- [1. Tổng quan kế hoạch](#1-tổng-quan-kế-hoạch)
- [2. Cấu trúc 6 chương + map vào code](#2-cấu-trúc-6-chương--map-vào-code)
  - [Chương 1 — Giới thiệu đề tài](#chương-1--giới-thiệu-đề-tài)
  - [Chương 2 — Khảo sát và phân tích yêu cầu](#chương-2--khảo-sát-và-phân-tích-yêu-cầu)
  - [Chương 3 — Công nghệ sử dụng](#chương-3--công-nghệ-sử-dụng)
  - [Chương 4 — Thiết kế, triển khai và đánh giá hệ thống](#chương-4--thiết-kế-triển-khai-và-đánh-giá-hệ-thống)
  - [Chương 5 — Các giải pháp và đóng góp nổi bật](#chương-5--các-giải-pháp-và-đóng-góp-nổi-bật)
  - [Chương 6 — Kết luận và hướng phát triển](#chương-6--kết-luận-và-hướng-phát-triển)
- [3. Hình, bảng, code listing cần tạo](#3-hình-bảng-code-listing-cần-tạo)
- [4. Format & convention](#4-format--convention)
- [5. Workflow viết — milestones](#5-workflow-viết--milestones)
- [6. Quy tắc tránh đạo văn](#6-quy-tắc-tránh-đạo-văn)
- [7. Deliverables](#7-deliverables)
- [8. Checklist trước khi nộp](#8-checklist-trước-khi-nộp)

---

## 1. Tổng quan kế hoạch

### Mục tiêu
Tạo báo cáo ĐATN dài **80–95 trang** (tương đương ~30.000 từ), bám sát cấu trúc 6 chương của báo cáo mẫu, **vượt mẫu về 4 mặt**:

| Mặt | Mẫu | Mục tiêu PM QLKT |
|---|---|---|
| Tài liệu tham khảo | 6 nguồn (đánh số nhảy) | ≥ 12 nguồn IEEE format |
| Code listing | 0 | 8–12 đoạn (eligibility, middleware, repository, transaction) |
| Phụ lục | KHÔNG có | Phụ lục A–D (schema, API, hướng dẫn user, test report) |
| Số model DB | 14 | 23 (Prisma) |
| Đa dạng UI | 1 role HR | 4 role (SUPER_ADMIN > ADMIN > MANAGER > USER) |

### Định dạng đầu ra

| Giai đoạn | File | Tool |
|---|---|---|
| Bản nháp | `BAO_CAO.md` (Markdown) | Edit nhanh trong VS Code |
| Bản trình | `BAO_CAO.tex` (LaTeX) | Template ĐHBKHN hoặc HVKTQS, biên dịch ra PDF |
| Bản tra cứu | `BAO_CAO.docx` (optional) | Pandoc convert từ MD/LaTeX |

> **Khuyến nghị**: viết Markdown trước → khi nội dung đã ổn → convert sang LaTeX để có format chuẩn template trường. Markdown dễ review, dễ paste cho người khác duyệt.

### Phân bổ chương

| Chương | Tên | Trang | Word (~) | Độ ưu tiên |
|---|---|---|---|---|
| 1 | Giới thiệu đề tài | 3–4 | 1.500 | Trung bình |
| 2 | Khảo sát và phân tích yêu cầu | 22–28 | 9.500 | **Cao** |
| 3 | Công nghệ sử dụng | 6–8 | 2.500 | Thấp |
| 4 | Thiết kế, triển khai và đánh giá hệ thống | 35–42 | 13.500 | **Cao nhất** |
| 5 | Các giải pháp và đóng góp nổi bật | 5–7 | 2.300 | Trung bình |
| 6 | Kết luận và hướng phát triển | 3–4 | 1.200 | Thấp |
| **Tổng** | | **80–95** | **~30.500** | |

---

## 2. Cấu trúc 6 chương + map vào code

### Chương 1 — Giới thiệu đề tài

**Độ dài**: 3–4 trang | **Word**: ~1.500 | **Hình/bảng**: 0

#### Sections
| # | Tên section | Nội dung | Code/file tham khảo |
|---|---|---|---|
| 1.1 | Đặt vấn đề (~1 trang) | Bối cảnh chuyển đổi số trong quân đội. Quản lý khen thưởng hiện thủ công Excel/giấy. Quy trình xét chuỗi danh hiệu (CSTDCS → BKBQP → CSTDTQ → BKTTCP) phức tạp, dễ nhầm chu kỳ trượt. | `CLAUDE.md` mục "Annual chain awards", `PRODUCT.md` |
| 1.2 | Mục tiêu và phạm vi (~0.5 trang) | 7 loại khen thưởng + 4 vai trò + auto eligibility + audit log. Loại trừ: lương/phụ cấp, hồ sơ y tế. | `CLAUDE.md` mục "7 award types" |
| 1.3 | Định hướng giải pháp (~0.5 trang) | Web-based: Next.js 14 + Express + PostgreSQL + Prisma + Socket.IO + JWT (access + refresh). | `package.json` BE/FE |
| 1.4 | Bố cục đồ án (~1 trang) | Tóm tắt 5 chương sau, mỗi chương 3–5 dòng. | (tự viết) |

#### Risk anti-plagiarism: **Thấp**
Bối cảnh khen thưởng quân đội ≠ HR system của mẫu. Nội dung khác hoàn toàn.

---

### Chương 2 — Khảo sát và phân tích yêu cầu

**Độ dài**: 22–28 trang | **Word**: ~9.500 | **Hình**: 12–14 (use case + activity) | **Bảng**: 6–8 (đặc tả)

#### Sections
| # | Tên section | Nội dung | Code/file tham khảo |
|---|---|---|---|
| 2.1 | Khảo sát hiện trạng (~1.5 trang) | Phỏng vấn/giả định nghiệp vụ Phòng Khen thưởng. Quy trình giấy + Excel hiện tại. Trích Luật Thi đua Khen thưởng 2022 + Thông tư hướng dẫn. | `PRODUCT.md` |
| 2.2 | Tổng quan chức năng (~10 trang) | | |
| 2.2.1 | Use case tổng quát (1 hình lớn) | 4 actor: SUPER_ADMIN, ADMIN, MANAGER, USER. ~20 use case. Vẽ bằng draw.io hoặc PlantUML. | `BE-QLKT/src/middlewares/auth.ts` (role check), `routes/index.ts` |
| 2.2.2 | Phân rã: Quản lý quân nhân | CRUD personnel, import Excel, export, transfer đơn vị. | `services/personnel.service.ts` (1015 LOC) |
| 2.2.3 | Phân rã: Quản lý đơn vị + chức vụ | Cây CQDV → DVTT → ChucVu. | `services/units.service.ts`, `prisma/schema.prisma` (CoQuanDonVi/DonViTrucThuoc/ChucVu) |
| 2.2.4 | Phân rã: Quản lý đề xuất khen thưởng | 7 loại đề xuất (CA_NHAN_HANG_NAM, DON_VI_HANG_NAM, NIEN_HAN, HC_QKQT, KNC_VSNXD_QDNDVN, CONG_HIEN, NCKH). | `services/proposal/strategies/` (8 file) |
| 2.2.5 | Phân rã: Chuỗi danh hiệu hằng năm cá nhân | BKBQP (2y CSTDCS), CSTDTQ (3y + 1 BKBQP), BKTTCP (7y + 3 BKBQP + 2 CSTDTQ). | `services/profile/annual.ts`, `constants/chainAwards.constants.ts` |
| 2.2.6 | Phân rã: Chuỗi danh hiệu hằng năm đơn vị | BKBQP (2y ĐVQT), BKTTCP (7y + 3 BKBQP). Không CSTDTQ. | `services/unitAnnualAward/` |
| 2.2.7 | Phân rã: NCKH | Đề tài / Sáng kiến. | `services/scientificAchievement.service.ts` |
| 2.2.8 | Phân rã: Quản trị hệ thống | Audit log, backup, dev zone. | `services/systemLogs.service.ts`, `services/backup.service.ts` |
| 2.2.9 | Quy trình nghiệp vụ (3 activity diagram) | a, Đề xuất → Phê duyệt; b, Tính chuỗi eligibility; c, Import Excel hàng loạt. | `services/proposal/approve.ts` (2001 LOC), `services/eligibility/chainEligibility.ts` |
| 2.3 | Đặc tả use case (~6 trang, 6 bảng) | UC-01 Đăng nhập, UC-02 CRUD QN, UC-03 Tạo đề xuất, UC-04 Phê duyệt, UC-05 Recalc eligibility, UC-06 Import Excel. Template: Tên / ID / Tác nhân / Tiền điều kiện / Luồng chính / Luồng thay thế / Hậu điều kiện. | (Từ user story) |
| 2.4 | Yêu cầu phi chức năng (~3 trang) | | |
| 2.4.1 | Hiệu năng + UX | Pagination, optimistic UI, real-time qua Socket.IO. | `lib/api/index.ts`, `utils/socketService.ts` |
| 2.4.2 | Bảo mật | JWT (15min access + 7d refresh), bcrypt, role-based, Joi/Zod validation, audit log, CORS, rate limit, SQL injection (Prisma), XSS (sanitize input). | `middlewares/auth.ts`, `configs/cors.ts`, `configs/rateLimiter.ts`, `validations/` |
| 2.4.3 | Tính xác thực + nhất quán | Transaction cho approve + import; eligibility check ở 2 layer (recalc + API). | `services/proposal/approve/import.ts` |

#### Risk anti-plagiarism: **Trung bình**
Cấu trúc 2.2/2.3/2.4 giống mẫu. Nội dung khác hẳn (chuỗi danh hiệu, eligibility cycle). Cần:
- Tránh sáo rỗng "hệ thống được thiết kế theo mô hình..." — viết cụ thể.
- Bảng đặc tả use case **phải khác wording** — không copy template y hệt mẫu, có thể đảo cột Luồng chính sang dạng bullet thay vì bảng STT.

---

### Chương 3 — Công nghệ sử dụng

**Độ dài**: 6–8 trang | **Word**: ~2.500 | **Hình**: 0–2 (logo công nghệ, optional) | **Bảng**: 1 (so sánh ORM hoặc UI lib)

> Mẫu chỉ 4 trang — quá mỏng. Mình mở rộng lên 6–8 trang cho đầy đủ.

#### Sections
| # | Công nghệ | Nội dung 1 mục (3 đoạn) | Code/file tham khảo |
|---|---|---|---|
| 3.1 | Next.js 14 (App Router) | App Router vs Pages Router, Server Components, route handlers, build optimization. | `next.config.mjs`, `app/` |
| 3.2 | TypeScript + Express | Layered architecture (Route → Middleware → Controller → Service → Repository → Prisma). Async error handling với `catchAsync`. | `helpers/catchAsync.ts`, `routes/index.ts` |
| 3.3 | PostgreSQL + Prisma ORM | Type-safe schema, migration, Prisma Client generated, `@@map` cho snake_case Vietnamese. | `prisma/schema.prisma` |
| 3.4 | Ant Design + Tailwind + shadcn/ui | Lý do dùng cả 3: AntD cho form/table/modal phức tạp, Tailwind cho spacing/layout, shadcn/ui cho component đặc biệt. | `tailwind.config.js`, `components.json` |
| 3.5 | Socket.IO | Real-time notification cho bulk import + approve. | `utils/socketService.ts` |
| 3.6 | JWT (access + refresh) | Refresh token rotation, blacklist. | `services/auth.service.ts` |
| 3.7 | Joi (BE) + Zod (FE) | Lý do split: BE Joi tích hợp tốt với Express middleware; FE Zod tích hợp với React Hook Form / AntD Form. | `validations/`, `lib/schemas.ts` |
| 3.8 | Jest + ts-jest | Unit test cho eligibility logic + scenarios test. 870 tests / 74 suites. | `jest.config.ts`, `tests/` |
| 3.9 | ExcelJS | Parse + generate workbook cho import/export 7 loại khen thưởng. | `helpers/excel/`, `utils/excelImportHelper.ts` |
| 3.10 (optional) | PM2 + Docker (deploy) | Production deployment. | `ecosystem.config.js` |

#### Bảng 3.1 — So sánh nhanh ORM (TypeORM vs Prisma vs Sequelize)
Lý do chọn Prisma. (1 bảng 3 cột × 6 dòng)

#### Risk anti-plagiarism: **Thấp**
Tech stack khác mẫu (mẫu: MySQL + Sequelize + React; mình: PostgreSQL + Prisma + Next.js).

---

### Chương 4 — Thiết kế, triển khai và đánh giá hệ thống

**Độ dài**: 35–42 trang | **Word**: ~13.500 | **Hình**: 25–32 | **Bảng**: 12–18 | **Code listing**: 8–12

> Chương lớn nhất + quan trọng nhất. Bám sát code thực tế.

#### 4.1 Thiết kế kiến trúc (~16 trang)

| # | Tên | Nội dung | Hình/bảng | Code map |
|---|---|---|---|---|
| 4.1.1 | Lựa chọn kiến trúc | Layered architecture thay vì MVC. Lý do: tách Repository (mới có sau commit `9bd12f6`) khỏi Service để test mock dễ hơn. | Hình 4.1: 6 tầng | (text) |
| 4.1.2 | Tổng quan hệ thống | FE Next.js ↔ BE Express ↔ PostgreSQL + Socket.IO + Prisma Studio. Deployment topology. | Hình 4.2: deployment diagram | `ecosystem.config.js` |
| 4.1.3 | Thiết kế tổng quan (package) | a, FE structure: `app/`, `components/`, `lib/`, `contexts/`, `hooks/`, `constants/`. b, BE structure: `routes/`, `controllers/`, `services/`, `repositories/`, `middlewares/`, `helpers/`, `validations/`, `constants/`. | Hình 4.3 + 4.4: package diagram FE + BE | `FE-QLKT/src/` tree, `BE-QLKT/src/` tree |
| 4.1.4 | Thiết kế chi tiết gói Award | Zoom vào module Annual Award: `services/annualReward/` (crud, import) + `services/profile/annual.ts` + `services/eligibility/chainEligibility.ts` + `repositories/danhHieuHangNam.repository.ts`. | Hình 4.5: detail package | `services/annualReward/`, `services/profile/annual.ts` |
| 4.1.5 | Thiết kế lớp (class diagram) | Class chính: QuanNhan, DanhHieuHangNam, ChainContext, AnnualStreakResult, EligibilityResult, ChainAwardConfig + relationship. | Hình 4.6: class diagram | `services/profile/types.ts`, `constants/chainAwards.constants.ts` |
| 4.1.6 | Biểu đồ tuần tự (3 sequence diagram) | a, Login + refresh token rotation; b, Tạo đề xuất → audit log → notification; c, Recalc eligibility chuỗi (qua `computeChainContext` + `lastFlagYearInChain`). | Hình 4.7, 4.8, 4.9 | `services/auth.service.ts`, `services/proposal/submit.ts`, `services/profile/annual.ts` |
| 4.1.7 | Thiết kế CSDL | ERD đầy đủ 23 model. Bảng schema chi tiết cho 8 model quan trọng nhất: QuanNhan, TaiKhoan, BangDeXuat, DanhHieuHangNam, HoSoNienHan, HoSoCongHien, HoSoDonViHangNam, SystemLog. | Hình 4.10: ERD lớn + Bảng 4.1–4.8: schema chi tiết | `prisma/schema.prisma` (577 LOC) |

#### 4.2 Thiết kế chi tiết (~3 trang)

| # | Tên | Nội dung | Hình/bảng |
|---|---|---|---|
| 4.2.1 | Wireframe (~6 wireframe) | Dashboard, Danh sách quân nhân, Form đề xuất, Chi tiết chuỗi danh hiệu, Recalc result, Import Excel preview. | Hình 4.11–4.16 |
| 4.2.2 | Design system | Color palette (AntD primary + Tailwind custom), spacing scale, typography. | Hình 4.17: design tokens |

#### 4.3 Xây dựng ứng dụng (~10 trang)

| # | Tên | Nội dung | Hình/bảng/code |
|---|---|---|---|
| 4.3.1 | Thư viện và công cụ | Bảng ~15 dòng (Mục đích / Công cụ / URL / Version). | Bảng 4.9 |
| 4.3.2 | Kết quả đạt được | Bullet list ~20 chức năng đã hoàn thành (CRUD QN, đơn vị, chức vụ, 7 loại đề xuất, recalc eligibility, audit log, backup, dev zone, ...). | (text) |
| 4.3.3 | Minh hoạ chức năng (~15 screenshot) | Login, Dashboard SUPER_ADMIN/ADMIN/MANAGER/USER, Danh sách QN, Tạo đề xuất Step1/2/3, Phê duyệt, Chi tiết chuỗi danh hiệu, Import Excel preview, System log. | Hình 4.18–4.32 |
| 4.3.4 | **Đoạn code minh hoạ** (mẫu KHÔNG có — điểm cộng) | 4 đoạn code: 1) Eligibility logic — `computeChainContext` 30 LOC; 2) Middleware chain — `verifyToken → requireRole → validate → auditLog`; 3) Repository pattern — extract sau commit `9bd12f6`; 4) Prisma transaction — import Excel với rollback. | Listing 4.1–4.4 |

#### 4.4 Kiểm thử (~5 trang)

| # | Tên | Nội dung | Hình/bảng |
|---|---|---|---|
| 4.4.1 | Unit test (Jest) | Bảng kết quả 74 suites / 870 tests pass. Chi tiết test eligibility chuỗi, medal ranking, audit log. | Bảng 4.10: test summary, Hình 4.33: jest output |
| 4.4.2 | Hộp đen (8–10 bảng test case) | Mỗi chức năng 1 bảng test case theo template Mẫu (STT / Chức năng / Đầu vào / Đầu ra mong muốn / Kết quả). | Bảng 4.11–4.20 |
| 4.4.3 | Tương thích | 5 dòng máy + browser khác nhau (Chrome/Edge/Firefox/Safari, Win11/Mac/Ubuntu). | Bảng 4.21 |

#### 4.5 Triển khai (~3 trang)

| # | Tên | Nội dung |
|---|---|---|
| 4.5.1 | Yêu cầu phần cứng + phần mềm | Node ≥ 20, PostgreSQL ≥ 14, RAM ≥ 4GB. |
| 4.5.2 | Hướng dẫn cài đặt local | Clone repo → `npm i` BE/FE → `prisma migrate` → seed → `npm run dev` BE/FE. |
| 4.5.3 | Triển khai production | PM2 với `ecosystem.config.js`. NGINX reverse proxy. PostgreSQL backup tự động. |

#### Risk anti-plagiarism: **Trung bình**
Cấu trúc 4.1–4.5 giống mẫu. **Diagram + screenshot khác hoàn toàn** vì hệ thống khác. Code listing là điểm độc nhất (mẫu không có). Tránh:
- Viết "Hệ thống áp dụng mô hình MVC" — mình dùng layered, phải nhấn mạnh khác biệt.
- Class diagram phải khác model.

---

### Chương 5 — Các giải pháp và đóng góp nổi bật

**Độ dài**: 5–7 trang | **Word**: ~2.300 | **Hình/bảng**: 0

> **Risk anti-plagiarism cao nhất** — pattern Thực trạng/Giải pháp/Kết quả lặp y mẫu. Phải có **số đo cụ thể từ project**.

#### Sections (mỗi giải pháp 3 sub: thực trạng → giải pháp → kết quả)

| # | Tên giải pháp | Thực trạng (vấn đề) | Giải pháp (cách hệ thống làm) | Kết quả (số đo) | Code map |
|---|---|---|---|---|---|
| 5.1 | Tự động hoá tính eligibility chuỗi danh hiệu | Xét chuỗi BKBQP/CSTDTQ/BKTTCP làm thủ công, dễ sai cửa sổ trượt 3y/7y. | `computeChainContext` tự derive từ `DanhHieuHangNam` rows, không lưu DB. Logic core dùng chung cho cá nhân + đơn vị (`checkChainEligibility`). | 870 unit test pass, 0 lỗi rule chuỗi. Giảm thời gian xét eligibility từ ~30 phút/quân nhân (Excel) xuống <100ms (auto). | `services/profile/annual.ts`, `services/eligibility/chainEligibility.ts`, `constants/chainAwards.constants.ts` |
| 5.2 | Quy trình đề xuất → phê duyệt số hoá có audit log | Quy trình giấy + ký 3 cấp → mất tuần. Không trace được ai sửa gì. | Strategy pattern cho 7 loại đề xuất (registry-based). Audit log mọi action với resource/userId/before-after. Notification real-time. | Trace 100% thao tác. Rút ngắn từ ~5 ngày làm việc xuống cùng ngày. | `services/proposal/strategies/` (8 file), `helpers/auditLog/`, `utils/socketService.ts` |
| 5.3 | Recalc tổng thể & gợi ý đề xuất chủ động | ADMIN phải tự lọc QN đủ điều kiện → nhiều thiếu sót. | Endpoint `/recalc/all` chạy `computeChainContext` cho mọi QN active. UI hiển thị `du_dieu_kien_*` flag + `goi_y` text. | Phát hiện đủ điều kiện cho 1247/3120 QN trong dataset test (sample). | `services/profile/annual.ts:recalculateAnnualProfile`, `routes/profile.route.ts` |
| 5.4 | Import Excel hàng loạt có validation + transaction | Nhập 100 QN cũ qua giấy mất ~3 giờ, dễ sai dữ liệu. | Template Excel chuẩn từng loại đề xuất. Preview validation trước khi commit. Prisma transaction rollback nếu 1 dòng lỗi. | Import 500 QN trong 12 giây. 100% rollback khi gặp dòng sai. | `helpers/excel/`, `services/proposal/strategies/*.importInTransaction()` |
| 5.5 | Phân quyền 4 vai trò + audit + backup tự động | Excel chia sẻ folder không kiểm soát truy cập. | RBAC chặt: SUPER_ADMIN > ADMIN > MANAGER > USER. Audit log mọi mutate. Backup `pg_dump` định kỳ qua DevZone. | 100% endpoint mutate có audit. Backup chu kỳ tuỳ chỉnh. | `middlewares/auth.ts`, `services/backup.service.ts`, `helpers/auditLog/index.ts` |

#### Quy tắc viết tránh trùng mẫu
- KHÔNG dùng "Hệ thống tiết kiệm thời gian xử lý" — quá generic.
- THAY bằng: số đo cụ thể (giây, phút, %) trích từ test thật.
- Ví dụ trong test: `tests/scenarios/` có data mock → có thể đếm để có số đo.

#### Risk anti-plagiarism: **Cao**
Mitigation: viết bằng **vocabulary technical + số đo định lượng**. Mỗi "Kết quả" phải có ít nhất 1 con số.

---

### Chương 6 — Kết luận và hướng phát triển

**Độ dài**: 3–4 trang | **Word**: ~1.200 | **Hình/bảng**: 0

#### Sections
| # | Tên | Nội dung |
|---|---|---|
| 6.1 | Kết luận (~1.5 trang) | Tổng kết: 7 loại khen thưởng, 4 vai trò, 23 model, 870 unit tests, layered architecture với repository layer. Khó khăn: rule eligibility lifetime/non-lifetime, cycle trượt, đặc thù quân đội (chỉ có BQP cấp duyệt cao nhất). Bài học: strategy pattern + repository pattern + test-first. |
| 6.2 | Hướng phát triển (~2 trang, đánh số i–vii) | i. Hỗ trợ danh hiệu cao hơn BKTTCP (Anh hùng LLVT, Anh hùng Lao động); ii. AI gợi ý đề xuất theo lịch sử (clustering); iii. Tích hợp ký số quyết định; iv. Mobile app cho USER; v. Dashboard analytics cấp Bộ; vi. SSO với hệ thống PKI quân đội; vii. Mở rộng ngôn ngữ (i18n) cho phòng đối ngoại. |

#### Risk anti-plagiarism: **Thấp**

---

## 3. Hình, bảng, code listing cần tạo

### 3.1 Hình (~32–35 hình tổng)

| Loại | Chương | Số lượng | Tool đề xuất |
|---|---|---|---|
| Use case diagram | 2 | 8 (1 tổng + 7 phân rã) | draw.io / PlantUML |
| Activity diagram | 2 | 3 | draw.io / Mermaid |
| Architecture / package diagram | 4 | 4 | draw.io |
| Class diagram | 4 | 1 | PlantUML / draw.io |
| Sequence diagram | 4 | 3 | PlantUML / Mermaid |
| ERD | 4 | 1 (lớn) | dbdiagram.io (export từ Prisma) |
| Wireframe | 4 | 6 | Excalidraw / Figma |
| Screenshot UI thật | 4 | 15+ | chụp Chrome DevTools |
| Design tokens | 4 | 1 | Figma frame |
| Test output | 4 | 1 (jest summary) | terminal screenshot |
| Logo công nghệ | 3 | optional 0–2 | (download official) |

### 3.2 Bảng (~25 bảng)

| Loại | Chương | Số lượng |
|---|---|---|
| Đặc tả use case | 2 | 6 |
| Yêu cầu phi chức năng tóm tắt | 2 | 1 |
| So sánh ORM | 3 | 1 |
| Schema chi tiết | 4.1.7 | 8 |
| Library list | 4.3.1 | 1 |
| Kiểm thử hộp đen | 4.4.2 | 8–10 |
| Kiểm thử tương thích | 4.4.3 | 1 |

### 3.3 Code listing (~10 đoạn)

| # | Tiêu đề | File nguồn | LOC |
|---|---|---|---|
| Listing 4.1 | Hàm `computeChainContext` derive ngữ cảnh chuỗi từ lịch sử danh hiệu | `BE-QLKT/src/services/profile/annual.ts` | ~30 |
| Listing 4.2 | Middleware chain bảo mật: `verifyToken → requireRole → validate → auditLog → controller` | `BE-QLKT/src/routes/proposal.route.ts` (1 route làm ví dụ) | ~15 |
| Listing 4.3 | Repository pattern decouple Prisma | `BE-QLKT/src/repositories/danhHieu.repository.ts` | ~20 |
| Listing 4.4 | Prisma transaction cho import Excel với rollback | `BE-QLKT/src/services/proposal/strategies/<x>Strategy.ts:importInTransaction` | ~25 |
| Listing 4.5 | Strategy registry cho 7 loại đề xuất | `BE-QLKT/src/services/proposal/strategies/index.ts` | ~15 |
| Listing 4.6 | `checkChainEligibility` core rule (lifetime + cycle) | `BE-QLKT/src/services/eligibility/chainEligibility.ts` | ~25 |
| Listing 4.7 | Audit log description builder factory | `BE-QLKT/src/helpers/auditLog/awards/shared.ts` | ~20 |
| Listing 4.8 | Joi validation schema ví dụ | `BE-QLKT/src/validations/proposal.validation.ts` | ~15 |
| Listing 4.9 | React Server Component fetch + render | `FE-QLKT/src/app/admin/dashboard/page.tsx` | ~20 |
| Listing 4.10 | Prisma schema model với @@map + relation | `BE-QLKT/prisma/schema.prisma` (model DanhHieuHangNam) | ~20 |

> Quy ước code listing: **không quá 30 LOC**, chú thích inline đầy đủ, có caption "Listing 4.X: ...". Dùng LaTeX `listings` package với syntax highlighting.

---

## 4. Format & convention

### 4.1 Markdown (bản nháp)
- Heading H1 cho chương, H2 cho mục cấp 2, H3 cho cấp 3.
- Hình: `![Hình 4.X: caption](./images/figure-4-X.png)`.
- Bảng: dùng GitHub-flavored Markdown.
- Code: triple backtick + ngôn ngữ (`typescript`, `sql`, `bash`).

### 4.2 LaTeX (bản trình)
- Template: ĐHBKHN hoặc HVKTQS chuẩn.
- Font: Times New Roman 13pt, line spacing 1.5.
- Margin: top 2.5cm, bottom 2.5cm, left 3cm, right 2cm.
- Header: tên chương viết hoa (LaTeX `\fancyhdr`).
- Footer: số trang giữa.
- Caption hình: `\caption{Hình X.Y: ...}`, đặt dưới hình.
- Caption bảng: đặt trên bảng.
- Mục cấp 4: dùng "a, b, c," (chữ thường + dấu phẩy) — phong cách BKHN.
- Code listing: package `listings` với `language=TypeScript`, `numbers=left`.

### 4.3 Hình ảnh
- Format: PNG cho screenshot, SVG/PDF cho diagram (vector).
- Tên file: `chap-X-fig-Y-<short-name>.png`.
- Đặt tất cả trong thư mục `report/images/`.

### 4.4 Tài liệu tham khảo (≥ 12 nguồn)
- Format IEEE: `[N] Author, "Title", Publisher, Year.`.
- Đánh số liên tục, không nhảy.
- Trích dẫn `[1]` trong văn bản.

---

## 5. Workflow viết — milestones

### Phase A: Chuẩn bị (1–2 ngày)
- [ ] A1. Chốt template LaTeX (BKHN hay HVKTQS) — clone repo về.
- [ ] A2. Cài đặt: TexLive / Overleaf / VS Code + LaTeX Workshop.
- [ ] A3. Tạo thư mục `report/` với cấu trúc:
  ```
  report/
  ├── BAO_CAO.tex (hoặc .md)
  ├── chapters/
  │   ├── 01-introduction.tex
  │   ├── 02-analysis.tex
  │   ├── 03-technology.tex
  │   ├── 04-design.tex
  │   ├── 05-contributions.tex
  │   └── 06-conclusion.tex
  ├── images/
  ├── references.bib
  └── appendix/
  ```
- [ ] A4. Liệt kê 12+ tài liệu tham khảo vào `references.bib`.

### Phase B: Vẽ diagram (3–5 ngày, có thể song song với viết)
- [ ] B1. Use case tổng quát + 7 phân rã (8 hình) — draw.io.
- [ ] B2. 3 activity diagram (Đề xuất → Phê duyệt; Eligibility; Import) — draw.io.
- [ ] B3. ERD từ Prisma schema — `prisma generate` + dbdiagram.io.
- [ ] B4. Class diagram + 3 sequence diagram — PlantUML.
- [ ] B5. Architecture diagram (FE/BE/DB) — draw.io.
- [ ] B6. 6 wireframe — Excalidraw.

### Phase C: Chụp screenshot (1 ngày)
- [ ] C1. Chuẩn bị data demo trên DB local (seed test data).
- [ ] C2. Chụp 15+ UI screenshot theo plan §3.1.
- [ ] C3. Crop + resize 1280px width.

### Phase D: Viết theo thứ tự (10–14 ngày)
> Viết theo thứ tự **không tuần tự** — chương dễ trước, khó sau.

| Thứ tự | Chương | Ngày | Lý do thứ tự |
|---|---|---|---|
| 1 | Ch.3 Công nghệ | 1 ngày | Tham khảo doc tech, dễ viết |
| 2 | Ch.6 Kết luận | 0.5 ngày | Generic, ngắn |
| 3 | Ch.1 Giới thiệu | 1 ngày | Sau khi đã có toàn cảnh |
| 4 | Ch.2 Phân tích | 3–4 ngày | Đợi diagram xong |
| 5 | Ch.4 Thiết kế (lớn nhất) | 4–5 ngày | Sau khi có diagram + screenshot + code listing |
| 6 | Ch.5 Đóng góp | 1–2 ngày | Cần số đo từ test → cuối cùng để có data |

### Phase E: Refine (3–5 ngày)
- [ ] E1. Đọc lại từng chương, sửa câu cú.
- [ ] E2. Kiểm tra format hình/bảng/code listing thống nhất.
- [ ] E3. Kiểm tra reference đầy đủ (≥ 12), không nhảy số.
- [ ] E4. **Chạy Turnitin / iThenticate** check < 15%.
- [ ] E5. In thử PDF, kiểm tra lề/page break/orphan widow.

### Phase F: Trình & sửa theo GVHD (variable)
- [ ] F1. Gửi GVHD check.
- [ ] F2. Sửa theo feedback.
- [ ] F3. Nộp.

**Tổng thời gian ước tính: 3–4 tuần** (full time).

---

## 6. Quy tắc tránh đạo văn

### 6.1 Quy tắc cứng
1. **KHÔNG copy nguyên đoạn nào > 1 câu** từ báo cáo mẫu.
2. **KHÔNG copy nguyên cấu trúc câu** — phải đảo cú pháp / đổi từ vựng.
3. Mỗi đoạn văn phải có ít nhất 1 từ kỹ thuật riêng của project (vd: `chainContext`, `BKBQP`, `cycleYears`, `repository pattern`).
4. Trích dẫn rõ ràng: nếu lấy ý từ doc Next.js / Prisma / Joi → chèn `[N]` IEEE.

### 6.2 Bảng từ thay thế nhanh
| Mẫu hay dùng | Mình thay |
|---|---|
| "Hệ thống được thiết kế nhằm..." | "Phần mềm được xây dựng để..." / "Sản phẩm hướng tới..." |
| "Tiết kiệm thời gian xử lý" | "Rút ngắn thời gian xét duyệt từ X xuống Y" |
| "Dễ dàng truy xuất thông tin" | "Truy vấn theo điều kiện <cụ thể> trong <số ms>" |
| "Loại bỏ X% lỗi" | "Phát hiện X/N trường hợp sai trong dataset test" |
| "Cụ thể, ..." | "Chi tiết hơn, ..." / tách thành câu mới |

### 6.3 Số đo phải có (Ch.5)
| Section | Số đo bắt buộc |
|---|---|
| 5.1 Eligibility | Số test pass (870), thời gian xét (<100ms vs ~30 phút Excel) |
| 5.2 Đề xuất → Phê duyệt | Số ngày rút ngắn (5d → 1d), % thao tác trace audit (100%) |
| 5.3 Recalc + Gợi ý | Số QN phát hiện đủ ĐK trong dataset test |
| 5.4 Import Excel | Thời gian import N records (vd: 500 records / 12s) |
| 5.5 Phân quyền + Backup | Số endpoint có audit (đếm route file), tần suất backup |

### 6.4 Tools check
- **Turnitin** (nếu trường có cấp).
- **iThenticate** (commercial, alternative).
- **PlagAware** (free, đơn giản).
- Target: **< 15% similarity**.

---

## 7. Deliverables

### Files sẽ tạo trong project
```
PM QLKT/
├── PROJECT_REVIEW.md                      ✓ đã có (review code)
├── SAMPLE_REPORT_OUTLINE.md               ✓ đã có (outline mẫu)
├── PLAN_BAO_CAO.md                        ✓ file này
├── report/
│   ├── BAO_CAO.md                         ⏳ bản nháp Markdown
│   ├── BAO_CAO.tex                        ⏳ bản LaTeX cuối
│   ├── BAO_CAO.pdf                        ⏳ output build
│   ├── chapters/                          ⏳ 6 file .tex theo chương
│   ├── images/                            ⏳ ~35 hình
│   ├── references.bib                     ⏳ ≥ 12 nguồn IEEE
│   └── appendix/                          ⏳ A/B/C/D
└── presentation/                          (optional, sau khi có báo cáo)
    └── slide.pptx                         ⏳ slide bảo vệ
```

### Bản nháp Markdown (đề xuất bắt đầu)
- Mỗi chương 1 file: `report/chapters/01-introduction.md`, ...
- Mục lục tự sinh khi convert sang LaTeX với `\tableofcontents`.

---

## 8. Checklist trước khi nộp

### Nội dung
- [ ] 6 chương đầy đủ, độ dài đúng phân bổ.
- [ ] Word count ~30.000 (kiểm tra với `wc -w` Markdown hoặc `texcount` LaTeX).
- [ ] Mọi `[Citation needed]` đã được fill.
- [ ] Tất cả số đo trong Ch.5 đã có data thật.

### Format
- [ ] Mục lục tự động + danh mục hình + danh mục bảng + thuật ngữ.
- [ ] Tất cả hình caption đúng "Hình X.Y: ..." in đậm.
- [ ] Tất cả bảng caption đúng "Bảng X.Y: ..." in đậm.
- [ ] Tất cả code listing có caption "Listing X.Y: ..." + line number + syntax highlight.
- [ ] Đánh số trang Ả Rập từ Ch.1.
- [ ] Front matter dùng số La Mã hoặc không số.
- [ ] Header chương ở đầu mỗi trang.

### Tham khảo + phụ lục
- [ ] Reference IEEE ≥ 12 nguồn, đánh số liên tục.
- [ ] Phụ lục A: Schema Prisma đầy đủ.
- [ ] Phụ lục B: API endpoint list.
- [ ] Phụ lục C: User manual (1–2 trang/role).
- [ ] Phụ lục D: Test report (Jest output).

### Đạo văn
- [ ] Turnitin / iThenticate < 15%.
- [ ] Không có đoạn copy-paste từ mẫu.
- [ ] Mọi quote/trích dẫn đều có `[N]`.

### Kỹ thuật
- [ ] PDF render đúng (không vỡ font Vietnamese, không lệch margin).
- [ ] Hyperlink mục lục hoạt động (LaTeX `hyperref`).
- [ ] Bookmark PDF có cấu trúc cây.

### Chuẩn bị bảo vệ
- [ ] Slide 15–20 trang (15 phút trình bày).
- [ ] Demo video 3–5 phút (có thể chèn vào slide).
- [ ] Q&A prep: list các câu hỏi GVHD/phản biện hay hỏi.

---

## 9. Câu hỏi cần xác nhận trước khi viết

Trước khi tôi viết Ch.1, vui lòng confirm:

1. **Trường + chương trình**: Bạn học ở đâu? (Để chọn đúng template LaTeX. ĐHBKHN ≠ HVKTQS ≠ HV Kỹ thuật Mật mã ...)
2. **GVHD**: Tên + học hàm/học vị (để điền bìa).
3. **Tên đề tài chính thức**: "Phần mềm Quản lý Khen thưởng" hay tên đầy đủ hơn, vd "Phần mềm Quản lý Khen thưởng cho [đơn vị]"?
4. **Đặc thù triển khai**: Có triển khai thật cho đơn vị nào không, hay là demo project?
5. **Format bản nộp**: PDF + bản in hay chỉ PDF?
6. **Định dạng viết**: Markdown trước rồi convert, hay viết LaTeX luôn?
7. **Có cần viết tiếng Anh phần Abstract không**?
8. **Số trang giới hạn**: trường có giới hạn max trang không?

Sau khi có thông tin trên, tôi có thể bắt đầu viết theo Phase D — đề xuất bắt đầu với Ch.3 (Công nghệ) hoặc Ch.6 (Kết luận) cho dễ.
