-- =================================================================
-- PM QLKT — Xoá toàn bộ data (TRUNCATE all 23 tables)
-- =================================================================
-- File này chỉ dùng để **reset DB về rỗng** mà KHÔNG seed lại.
--
-- Khi nào dùng:
--   • Muốn xoá hết data demo trên Neon trước khi import lại
--   • Test scenario "DB rỗng" cho UI
--   • Cleanup trước khi deploy production thật
--
-- Khi nào KHÔNG cần dùng file này:
--   • Import `01-seed-data.sql` hoặc `02-seed-eligibility.sql`
--     — 2 file đó đã có TRUNCATE block ở đầu, tự xoá rồi seed lại.
--
-- THỨ TỰ XOÁ: con trước → cha sau (theo FK CASCADE).
-- `RESTART IDENTITY CASCADE` đảm bảo cả sequence và FK reference đều reset.
-- =================================================================

BEGIN;

TRUNCATE TABLE
  -- Bảng phụ trợ (notification + log + setting)
  "ThongBao",
  "SystemLog",

  -- Bảng đề xuất (đã reference bởi log/notification phía trên)
  "BangDeXuat",

  -- Bảng đơn vị hằng năm
  "DanhHieuDonViHangNam",
  "HoSoDonViHangNam",

  -- Bảng hồ sơ tổng hợp (1:1 với QuanNhan)
  "HoSoHangNam",
  "HoSoCongHien",
  "HoSoNienHan",

  -- Bảng khen thưởng cụ thể (đột xuất + 4 loại có hồ sơ riêng)
  "KhenThuongDotXuat",
  "KyNiemChuongVSNXDQDNDVN",
  "HuanChuongQuanKyQuyetThang",
  "KhenThuongHCCSVV",
  "KhenThuongHCBVTQ",

  -- Bảng danh hiệu hằng năm + thành tích NCKH (input)
  "DanhHieuHangNam",
  "ThanhTichKhoaHoc",

  -- Bảng lịch sử chức vụ (input cho cống hiến)
  "LichSuChucVu",

  -- Bảng tài khoản (FK tới QuanNhan)
  "TaiKhoan",

  -- Bảng quân nhân
  "QuanNhan",

  -- Bảng quyết định (FK natural-key tới 8 bảng khen thưởng phía trên)
  "FileQuyetDinh",

  -- Bảng tổ chức + chức vụ
  "ChucVu",
  "DonViTrucThuoc",
  "CoQuanDonVi",

  -- Cấu hình hệ thống
  "SystemSetting"

RESTART IDENTITY CASCADE;

COMMIT;

-- =================================================================
-- VERIFY (chạy thủ công sau khi TRUNCATE):
--
--   SELECT
--     (SELECT COUNT(*) FROM "QuanNhan")        AS quan_nhan,
--     (SELECT COUNT(*) FROM "TaiKhoan")        AS tai_khoan,
--     (SELECT COUNT(*) FROM "BangDeXuat")      AS de_xuat,
--     (SELECT COUNT(*) FROM "SystemLog")       AS logs,
--     (SELECT COUNT(*) FROM "ThongBao")        AS thong_bao;
--
-- → Kỳ vọng: tất cả = 0
-- =================================================================
