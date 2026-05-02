# Demo database seed cho Neon

> 213 bản ghi mẫu cho 23 bảng — đủ cover 15 video demo trong `slides/demo-video-plan.md`.

---

## 1. Quy trình import vào Neon

### Bước 1 — Tạo Neon project + schema

```bash
# Trên máy local
cd BE-QLKT

# Trong .env hoặc .env.local
# DATABASE_URL="postgresql://user:pwd@ep-xxx.neon.tech/qlkt?sslmode=require"

# Đẩy schema lên Neon (tạo 23 bảng + index + FK)
npx prisma db push
```

→ Kiểm tra trên Neon Console (https://console.neon.tech) → Tables → thấy 23 bảng có cấu trúc đầy đủ.

### Bước 2 — Import dữ liệu seed

**Cách 1**: Neon SQL Editor (web UI)
1. Mở project trên Neon Console → tab **SQL Editor**
2. Copy toàn bộ nội dung `01-seed-data.sql`
3. Paste vào editor → Run
4. Đợi ~3 giây → success

**Cách 2**: Dùng `psql` từ terminal
```bash
psql "$DATABASE_URL" -f scripts/demo/01-seed-data.sql
```

→ Verify trên Neon Console: Tables → `QuanNhan` → thấy 30 bản ghi.

### Bước 3 (tuỳ chọn) — Đổi mật khẩu mặc định

Mật khẩu `Hvkhqs@123` đã được **hash sẵn** trong `01-seed-data.sql` — sau khi import là login được ngay, không cần làm gì thêm.

Chỉ chạy bước này nếu muốn **đổi password** sang giá trị khác:

```bash
cd BE-QLKT
DEMO_PASSWORD=mypassword npx tsx scripts/demo/02-set-passwords.ts
```

### Bước 4 — Khởi động hệ thống và test

```bash
# Terminal 1 — BE
cd BE-QLKT && npm run dev

# Terminal 2 — FE
cd FE-QLKT && npm run dev
```

Mở `http://localhost:3000` → đăng nhập `admin_demo` / `Hvkhqs@123` → kiểm tra:
- Dashboard hiển thị số liệu
- Trang Quân nhân list 30 record
- Trang Đề xuất có 4 bản ghi (2 PENDING + 1 APPROVED + 1 REJECTED)

---

## 2. Map dữ liệu demo → 15 video

| Video | Persona / Data dùng | Ghi chú |
|---|---|---|
| **V01** Login + tổng quan | 4 tài khoản demo | Đăng nhập từng role |
| **V02** Quản lý đơn vị | 3 CQDV + 6 DVTT + 15 ChucVu | Cây đầy đủ |
| **V03** Quản lý quân nhân | 30 QuanNhan, có lịch sử chức vụ | QN-005 có 4 LSCV để demo |
| **V04** Import Excel danh hiệu | (tự tạo file Excel khi demo) | Có 30 QN sẵn để link CCCD |
| **V05** Tạo đề xuất (Manager) | QN-001 Trần Văn An — đủ ĐK BKBQP 2026 | `manager_demo` thuộc cqdv01 |
| **V06** Phê duyệt + PDF (Admin) | `bdx001_demo` (PENDING) | Có sẵn trong DB |
| **V07** Từ chối đề xuất | `bdx002_demo` (PENDING — chưa đủ ĐK) | Reject với lý do |
| **V08** Chuỗi danh hiệu ⭐ | QN-003 (BKTTCP eligible) + QN-004 (đã có BKTTCP) | Demo lifetime block |
| **V09** Niên hạn HCCSVV | QN-007 (10y) hoặc QN-009 (20y) | Đã có HoSoNienHan |
| **V10** HCBVTQ rank upgrade | QN-005 (chưa có) + QN-006 (đã có Hạng Ba) | Có HCBVTQ Hạng Ba sẵn |
| **V11** Khen thưởng đột xuất | 3 record `KhenThuongDotXuat` | Có sẵn |
| **V12** Cascade rename QĐ | QĐ `12/QD-BTL` (refed by ~15 records) | Đổi tên → cascade |
| **V13** Notification real-time | 2 browser: `manager_demo` + `admin_demo` | 5 thông báo có sẵn |
| **V14** Audit log | 10 SystemLog mẫu, đa dạng action | Filter theo resource |
| **V15** Backup DevZone | SystemSetting đã có cấu hình | Trigger thủ công |

---

## 3. 9 Persona đặc biệt

| ID | Họ tên | Persona | Data setup |
|---|---|---|---|
| `qn001_demo` | Trần Văn An | **BKBQP eligible** 2026 | CSTDCS 2024+2025, no BKBQP flag |
| `qn002_demo` | Nguyễn Văn Bình | **CSTDTQ eligible** 2026 | 4 năm CSTDCS + BKBQP 2023 (trong cửa sổ 3y) |
| `qn003_demo` | Lê Quang Cường | **BKTTCP eligible** 2026 | Chuỗi 7y với 3 BKBQP + 2 CSTDTQ + NCKH/năm |
| `qn004_demo` | Phạm Đình Dũng | **BKTTCP đã nhận** | `nhan_bkttcp = true` năm 2024 → demo lifetime |
| `qn005_demo` | Nguyễn Văn Em | **HCBVTQ Hạng Ba eligible** | LSCV 256 tháng (đa hệ số) |
| `qn006_demo` | Trần Thị Phượng | **HCBVTQ Hạng Nhì upgrade** | Đã có Hạng Ba + LSCV đủ Hạng Nhì |
| `qn007_demo` | Hoàng Văn Giang | **HCCSVV Hạng Ba (10y)** | Nhập ngũ 2016-01-01 |
| `qn008_demo` | Đỗ Quang Hùng | **HCQKQT (25y)** + đã có 2 HCCSVV | Nhập ngũ 2001-01-01 |
| `qn009_demo` | Lê Thị Khánh | **KNC nữ (20y)** | Nữ + nhập ngũ 2006-01-01 |

---

## 4. Reset / re-seed

Nếu cần xoá toàn bộ data và seed lại:

```sql
-- Trên Neon SQL Editor
TRUNCATE TABLE
  "ThongBao", "SystemLog", "BangDeXuat",
  "DanhHieuDonViHangNam", "HoSoDonViHangNam",
  "HoSoHangNam", "HoSoCongHien", "HoSoNienHan",
  "KhenThuongDotXuat", "KyNiemChuongVSNXDQDNDVN",
  "HuanChuongQuanKyQuyetThang", "KhenThuongHCCSVV",
  "KhenThuongHCBVTQ", "DanhHieuHangNam",
  "ThanhTichKhoaHoc", "LichSuChucVu",
  "TaiKhoan", "QuanNhan", "FileQuyetDinh",
  "ChucVu", "DonViTrucThuoc", "CoQuanDonVi",
  "SystemSetting"
RESTART IDENTITY CASCADE;
```

→ Sau đó chạy lại từ Bước 2.

---

## 5. Troubleshooting

### Lỗi: `duplicate key value violates unique constraint`
→ Data đã import rồi. Chạy TRUNCATE ở mục 4 trước khi seed lại.

### Lỗi: `null value in column "password_hash" violates not-null`
→ Đảm bảo bước 3 đã chạy. Nếu chưa, chạy `npx tsx scripts/demo/02-set-passwords.ts`.

### Lỗi: `insert or update on table "X" violates foreign key constraint`
→ Schema chưa được push lên Neon đầy đủ. Chạy lại `npx prisma db push`.

### Login `manager_demo` không thấy data
→ MANAGER chỉ thấy data thuộc đơn vị quản lý. `manager_demo` có `quan_nhan_id = qn002_demo` (cqdv01). Để thấy đơn vị khác, đổi `quan_nhan_id` của tài khoản này hoặc đăng nhập `admin_demo`.

### HoSo* không khớp với data thực tế
→ Có thể do logic tính toán thay đổi. Chạy `POST /api/profiles/recalculate-all` từ tài khoản `admin_demo` để hệ thống tự tính lại từ DanhHieuHangNam + LichSuChucVu thực.

---

## 6. Lưu ý bảo mật

- **Demo password mặc định** (`Hvkhqs@123`) — đặt theo convention HVKHQS, chỉ dùng cho môi trường demo. Sau khi deploy thật, đổi password qua giao diện hoặc reset script trước khi public.
- **Tài khoản demo có quyền cao** — `superadmin_demo` thấy được toàn bộ DB. Sau buổi bảo vệ, xoá hoặc đổi password.
- **Dữ liệu CCCD demo** (001234001234, ...) là số fake — không trùng với CCCD thật.
- **Số quyết định demo** (12/QD-BTL, ...) là fake — không trùng với QĐ thật của Học viện.
