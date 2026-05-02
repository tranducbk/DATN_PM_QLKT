-- =================================================================
-- PM QLKT — Seed dữ liệu DEMO ĐỀ XUẤT / ELIGIBILITY (Proposal test)
-- =================================================================
-- File này dành cho việc **test đề xuất chuỗi danh hiệu** — bao quát
-- mọi kịch bản eligibility (BKBQP / CSTDTQ / BKTTCP cá nhân & đơn vị,
-- cycle repeat, lỡ đợt, lifetime block, niên hạn, cống hiến).
-- Để test data list/dashboard hiển thị, dùng `01-seed-data.sql`.
--
-- 11 PERSONA bao quát ELIGIBILITY:
--   QN-001 An      → BKBQP cycle 1 (đủ 2y CSTDCS, chưa từng nhận BKBQP)
--   QN-002 Bình    → CSTDTQ cycle 1 (3y + 1 BKBQP/3y)
--   QN-003 Cường   → BKTTCP eligible (7y + 3 BKBQP + 2 CSTDTQ + NCKH)
--   QN-004 Dũng    → BKTTCP lifetime block (đã nhận, không cho đề xuất nữa)
--   QN-005 Em      → HCBVTQ Hạng Ba eligible (cống hiến)
--   QN-006 Phượng  → HCBVTQ rank upgrade (Hạng Ba → Nhì)
--   QN-007 Giang   → HCCSVV Hạng Ba eligible (10y phục vụ)
--   QN-008 Hùng    → HCQKQT eligible (25y) + HCBVTQ Hạng Nhất
--   QN-009 Khánh   → KNC nữ eligible (20y)
--   QN-031 Hậu     → CSTDTQ cycle 2 (đã có CSTDTQ 2022, đủ lại 2026) ⭐ MỚI
--   QN-032 Linh    → Lỡ đợt BKBQP (streak 8y, missedBkbqp=3) ⭐ MỚI
--
-- 2 ĐƠN VỊ chuỗi:
--   CQDV-01 Khoa Ngoại ngữ  → BKBQP đơn vị eligible (2y ĐVQT)
--   CQDV-04 Phòng Đào tạo   → BKTTCP đơn vị eligible (7y ĐVQT + 3 BKBQP) ⭐ MỚI
--
-- THỨ TỰ IMPORT:
--   1. Chạy `npx prisma db push` từ máy local trước để tạo schema.
--   2. Chạy file này (`01-seed-data.sql`) trên Neon SQL Editor — XONG.
--   (Password đã được hash sẵn trong file này, không cần chạy script TS thêm.)
--
-- 4 TÀI KHOẢN DEMO (login được ngay sau import):
--   superadmin_demo / Hvkhqs@123  → SUPER_ADMIN
--   admin_demo      / Hvkhqs@123  → ADMIN
--   manager_demo    / Hvkhqs@123  → MANAGER (Khoa Ngoại ngữ)
--   user_demo       / Hvkhqs@123  → USER
--
-- 9 PERSONA chính (xem comment ở từng section để biết kịch bản):
--   QN-001 Trần Văn An      → demo BKBQP eligibility (V05)
--   QN-002 Nguyễn Văn Bình  → demo CSTDTQ eligibility
--   QN-003 Lê Quang Cường   → demo BKTTCP eligibility (V08)
--   QN-004 Phạm Đình Dũng   → demo BKTTCP lifetime block (V08)
--   QN-005 Nguyễn Văn Em    → demo HCBVTQ Hạng Ba eligibility (V10)
--   QN-006 Trần Thị Phượng  → demo HCBVTQ rank upgrade (V10)
--   QN-007 Hoàng Văn Giang  → demo HCCSVV niên hạn 10y (V09)
--   QN-008 Đỗ Quang Hùng    → demo HCQKQT 25y phục vụ
--   QN-009 Lê Thị Khánh     → demo KNC nữ 20y
-- =================================================================

BEGIN;

-- -----------------------------------------------------------------
-- 0. TRUNCATE — reset toàn bộ data demo cũ (chạy idempotent)
-- -----------------------------------------------------------------
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

-- -----------------------------------------------------------------
-- 1. SystemSetting — cấu hình hệ thống
-- -----------------------------------------------------------------
INSERT INTO "SystemSetting" (id, key, value, "updatedAt") VALUES
  ('ss_backup_enabled',   'BACKUP_ENABLED',         'true',                 NOW()),
  ('ss_backup_schedule',  'BACKUP_SCHEDULE',        '0 1 1 * *',            NOW()),
  ('ss_backup_retention', 'BACKUP_RETENTION_DAYS',  '15',                   NOW()),
  ('ss_backup_last_run',  'BACKUP_LAST_RUN',        '2026-04-01T01:00:00Z', NOW()),
  ('ss_features',         'FEATURES',               '{"backup":true,"recalc":true}', NOW());

-- -----------------------------------------------------------------
-- 2. CoQuanDonVi — 3 phòng cấp trên
-- -----------------------------------------------------------------
INSERT INTO "CoQuanDonVi" (id, ma_don_vi, ten_don_vi, so_luong, "createdAt", "updatedAt") VALUES
  ('cqdv01_demo', 'KNN', 'Khoa Ngoại ngữ',     12, NOW(), NOW()),
  ('cqdv02_demo', 'PTM', 'Phòng Tham mưu',    10, NOW(), NOW()),
  ('cqdv03_demo', 'PHC', 'Phòng Hậu cần',      8, NOW(), NOW()),
  ('cqdv04_demo', 'PDT', 'Phòng Đào tạo',      4, NOW(), NOW());

-- -----------------------------------------------------------------
-- 3. DonViTrucThuoc — 6 đơn vị trực thuộc (2 mỗi CQDV)
-- -----------------------------------------------------------------
INSERT INTO "DonViTrucThuoc" (id, co_quan_don_vi_id, ma_don_vi, ten_don_vi, so_luong, "createdAt", "updatedAt") VALUES
  ('dvtt01_demo', 'cqdv01_demo', 'KNN-A1', 'Bộ môn Tiếng Anh',        6, NOW(), NOW()),
  ('dvtt02_demo', 'cqdv01_demo', 'KNN-A2', 'Bộ môn Tiếng Trung',      6, NOW(), NOW()),
  ('dvtt03_demo', 'cqdv02_demo', 'PTM-B1', 'Ban Tác chiến',            5, NOW(), NOW()),
  ('dvtt04_demo', 'cqdv02_demo', 'PTM-B2', 'Ban Quân huấn',            5, NOW(), NOW()),
  ('dvtt05_demo', 'cqdv03_demo', 'PHC-C1', 'Ban Quân nhu',             4, NOW(), NOW()),
  ('dvtt06_demo', 'cqdv03_demo', 'PHC-C2', 'Ban Tài chính',            4, NOW(), NOW()),
  ('dvtt07_demo', 'cqdv04_demo', 'PDT-D1', 'Ban Giáo vụ',              4, NOW(), NOW());

-- -----------------------------------------------------------------
-- 4. ChucVu — chức vụ với hệ số đa dạng (phục vụ HCBVTQ)
-- -----------------------------------------------------------------
INSERT INTO "ChucVu" (id, co_quan_don_vi_id, don_vi_truc_thuoc_id, ten_chuc_vu, is_manager, he_so_chuc_vu, "createdAt", "updatedAt") VALUES
  -- ChucVu cấp CQDV (manager)
  ('cv01_demo', 'cqdv01_demo', NULL, 'Trưởng phòng',         true,  1.00, NOW(), NOW()),
  ('cv02_demo', 'cqdv01_demo', NULL, 'Phó trưởng phòng',     true,  0.90, NOW(), NOW()),
  ('cv03_demo', 'cqdv02_demo', NULL, 'Trưởng phòng',         true,  1.00, NOW(), NOW()),
  ('cv04_demo', 'cqdv02_demo', NULL, 'Phó trưởng phòng',     true,  0.90, NOW(), NOW()),
  ('cv05_demo', 'cqdv03_demo', NULL, 'Trưởng phòng',         true,  1.00, NOW(), NOW()),
  -- ChucVu cấp DVTT
  ('cv11_demo', NULL, 'dvtt01_demo', 'Trưởng ban',           true,  0.90, NOW(), NOW()),
  ('cv12_demo', NULL, 'dvtt01_demo', 'Phó trưởng ban',       false, 0.80, NOW(), NOW()),
  ('cv13_demo', NULL, 'dvtt01_demo', 'Cán bộ chuyên môn',    false, 0.70, NOW(), NOW()),
  ('cv14_demo', NULL, 'dvtt02_demo', 'Trưởng ban',           true,  0.90, NOW(), NOW()),
  ('cv15_demo', NULL, 'dvtt02_demo', 'Cán bộ chuyên môn',    false, 0.70, NOW(), NOW()),
  ('cv16_demo', NULL, 'dvtt03_demo', 'Trưởng ban',           true,  0.90, NOW(), NOW()),
  ('cv17_demo', NULL, 'dvtt03_demo', 'Cán bộ chuyên môn',    false, 0.70, NOW(), NOW()),
  ('cv18_demo', NULL, 'dvtt04_demo', 'Trưởng ban',           true,  0.90, NOW(), NOW()),
  ('cv19_demo', NULL, 'dvtt05_demo', 'Trưởng ban',           true,  0.90, NOW(), NOW()),
  ('cv20_demo', NULL, 'dvtt06_demo', 'Trưởng ban',           true,  0.90, NOW(), NOW()),
  ('cv21_demo', 'cqdv04_demo', NULL, 'Trưởng phòng',         true,  1.00, NOW(), NOW()),
  ('cv22_demo', NULL, 'dvtt07_demo', 'Trưởng ban',           true,  0.90, NOW(), NOW());

-- -----------------------------------------------------------------
-- 5. FileQuyetDinh — 10 quyết định (một số được nhiều bảng tham chiếu)
-- -----------------------------------------------------------------
INSERT INTO "FileQuyetDinh" (id, so_quyet_dinh, nam, ngay_ky, nguoi_ky, file_path, loai_khen_thuong, ghi_chu, "createdAt", "updatedAt") VALUES
  ('fqd01_demo', '12/QD-BTL',   2025, '2025-01-15', 'Đại tá Nguyễn Văn Hà — Tư lệnh',     'uploads/decisions/qd_12_2025.pdf', 'CA_NHAN_HANG_NAM', 'QĐ tổng hợp danh hiệu CSTDCS năm 2024', NOW(), NOW()),
  ('fqd02_demo', '15/QD-BTL',   2025, '2025-01-20', 'Đại tá Nguyễn Văn Hà — Tư lệnh',     'uploads/decisions/qd_15_2025.pdf', 'CA_NHAN_HANG_NAM', 'QĐ Bằng khen Bộ Quốc phòng năm 2024',     NOW(), NOW()),
  ('fqd03_demo', '08/QD-TTg',   2024, '2024-09-02', 'Phạm Minh Chính — Thủ tướng',         'uploads/decisions/qd_08_2024.pdf', 'CA_NHAN_HANG_NAM', 'QĐ Chiến sĩ Thi đua Toàn quốc năm 2024',  NOW(), NOW()),
  ('fqd04_demo', '03/QD-CTN',   2024, '2024-12-10', 'Tô Lâm — Chủ tịch nước',              'uploads/decisions/qd_03_2024.pdf', 'CA_NHAN_HANG_NAM', 'QĐ Bằng khen Thủ tướng năm 2024',         NOW(), NOW()),
  ('fqd05_demo', '20/QD-BTL',   2024, '2024-08-20', 'Đại tá Nguyễn Văn Hà — Tư lệnh',     'uploads/decisions/qd_20_2024.pdf', 'NIEN_HAN',         'QĐ Huy chương Chiến sĩ Vẻ vang năm 2024', NOW(), NOW()),
  ('fqd06_demo', '07/QD-BQP',   2024, '2024-11-05', 'Phan Văn Giang — Bộ trưởng BQP',     'uploads/decisions/qd_07_2024.pdf', 'CONG_HIEN',        'QĐ Huân chương Bảo vệ Tổ quốc năm 2024', NOW(), NOW()),
  ('fqd07_demo', '11/QD-BQP',   2025, '2025-03-15', 'Phan Văn Giang — Bộ trưởng BQP',     'uploads/decisions/qd_11_2025.pdf', 'NIEN_HAN',         'QĐ Huân chương Quân kỳ Quyết thắng',      NOW(), NOW()),
  ('fqd08_demo', '14/QD-BQP',   2025, '2025-04-20', 'Phan Văn Giang — Bộ trưởng BQP',     'uploads/decisions/qd_14_2025.pdf', 'NIEN_HAN',         'QĐ Kỷ niệm chương VSNXD QĐNDVN',         NOW(), NOW()),
  ('fqd09_demo', '05/QD-DV',    2025, '2025-02-10', 'Đại tá Trần Quốc Bình — Chỉ huy',    'uploads/decisions/qd_05_2025.pdf', 'DOT_XUAT',         'QĐ Khen thưởng đột xuất',                NOW(), NOW()),
  ('fqd10_demo', '22/QD-BTL',   2024, '2024-06-30', 'Đại tá Nguyễn Văn Hà — Tư lệnh',     'uploads/decisions/qd_22_2024.pdf', 'CA_NHAN_HANG_NAM', 'QĐ NCKH năm 2024',                       NOW(), NOW());

-- -----------------------------------------------------------------
-- 6. QuanNhan — 30 quân nhân (9 persona + 21 nhân viên thường)
-- -----------------------------------------------------------------
-- 9 PERSONA cho demo
INSERT INTO "QuanNhan" (id, cccd, ho_ten, gioi_tinh, ngay_sinh, que_quan_2_cap, tru_quan, ngay_nhap_ngu, ngay_xuat_ngu, ngay_vao_dang, so_dien_thoai, cap_bac, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id, "createdAt", "updatedAt") VALUES
  -- QN-001: BKBQP eligible — đạt CSTDCS 2024+2025, chưa có flag BKBQP
  ('qn001_demo', '001234001234', 'Trần Văn An',      'NAM', '1990-03-15', 'Xã An Bình, tỉnh Thái Bình',   'Hà Nội',     '2012-09-01', NULL, '2014-03-01', '0912000001', 'Thiếu tá',  'cqdv01_demo', 'dvtt01_demo', 'cv12_demo', NOW(), NOW()),
  -- QN-002: CSTDTQ eligible — chuỗi BKBQP đã có trong cửa sổ 3y
  ('qn002_demo', '001234001235', 'Nguyễn Văn Bình',  'NAM', '1985-07-22', 'Xã Long Hải, tỉnh Bà Rịa',     'Hà Nội',     '2008-09-01', NULL, '2010-05-01', '0912000002', 'Trung tá',  'cqdv01_demo', 'dvtt01_demo', 'cv11_demo', NOW(), NOW()),
  -- QN-003: BKTTCP eligible — chuỗi 7y đầy đủ
  ('qn003_demo', '001234001236', 'Lê Quang Cường',   'NAM', '1980-11-08', 'Xã Đông Khê, tỉnh Hưng Yên',   'Hà Nội',     '2003-09-01', NULL, '2005-08-01', '0912000003', 'Thượng tá', 'cqdv01_demo', NULL,           'cv01_demo', NOW(), NOW()),
  -- QN-004: Đã nhận BKTTCP — demo lifetime block
  ('qn004_demo', '001234001237', 'Phạm Đình Dũng',   'NAM', '1978-04-02', 'Xã Diễn Hồng, tỉnh Nghệ An',   'Hà Nội',     '2000-09-01', NULL, '2002-06-01', '0912000004', 'Đại tá',    'cqdv02_demo', NULL,           'cv03_demo', NOW(), NOW()),
  -- QN-005: HCBVTQ Hạng Ba eligible (đủ 120 tháng he_so 0.7-1.0)
  ('qn005_demo', '001234001238', 'Nguyễn Văn Em',    'NAM', '1979-09-25', 'Xã Yên Lạc, tỉnh Vĩnh Phúc',   'Hà Nội',     '2001-09-01', NULL, '2003-04-01', '0912000005', 'Thượng tá', 'cqdv02_demo', 'dvtt03_demo', 'cv16_demo', NOW(), NOW()),
  -- QN-006: HCBVTQ Hạng Ba đã nhận, đủ Hạng Nhì — demo rank upgrade
  ('qn006_demo', '001234001239', 'Trần Thị Phượng',  'NU',  '1982-06-12', 'Xã Hoài Đức, TP Hà Nội',        'Hà Nội',     '2004-09-01', NULL, '2006-09-01', '0912000006', 'Thượng tá', 'cqdv02_demo', 'dvtt04_demo', 'cv18_demo', NOW(), NOW()),
  -- QN-007: HCCSVV 10y — vừa đủ Hạng Ba
  ('qn007_demo', '001234001240', 'Hoàng Văn Giang',  'NAM', '1992-12-03', 'Xã Tam Phước, tỉnh Đồng Nai',  'Hà Nội',     '2016-01-01', NULL, '2017-12-01', '0912000007', 'Thiếu tá',  'cqdv03_demo', 'dvtt05_demo', 'cv19_demo', NOW(), NOW()),
  -- QN-008: HCQKQT — 25 năm phục vụ
  ('qn008_demo', '001234001241', 'Đỗ Quang Hùng',    'NAM', '1976-08-18', 'Xã Hải An, tỉnh Hải Phòng',    'Hà Nội',     '2001-01-01', NULL, '2003-02-01', '0912000008', 'Đại tá',    'cqdv03_demo', NULL,           'cv05_demo', NOW(), NOW()),
  -- QN-009: KNC nữ 20y phục vụ
  ('qn009_demo', '001234001242', 'Lê Thị Khánh',     'NU',  '1984-02-28', 'Xã Đông Hưng, tỉnh Thái Bình', 'Hà Nội',     '2006-01-01', NULL, '2008-07-01', '0912000009', 'Trung tá',  'cqdv03_demo', 'dvtt06_demo', 'cv20_demo', NOW(), NOW());

-- 21 quân nhân thường
INSERT INTO "QuanNhan" (id, cccd, ho_ten, gioi_tinh, ngay_sinh, que_quan_2_cap, tru_quan, ngay_nhap_ngu, ngay_vao_dang, cap_bac, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id, "createdAt", "updatedAt") VALUES
  ('qn010_demo', '001234001243', 'Vũ Đình Lâm',      'NAM', '1995-05-14', 'Xã Tiên Lữ, tỉnh Hưng Yên',    'Hà Nội', '2018-09-01', '2020-12-01', 'Đại úy',     'cqdv01_demo', 'dvtt01_demo', 'cv13_demo', NOW(), NOW()),
  ('qn011_demo', '001234001244', 'Bùi Văn Mạnh',     'NAM', '1993-08-30', 'Xã Phú Đông, TP Hà Nội',        'Hà Nội', '2015-09-01', '2017-06-01', 'Thiếu tá',   'cqdv01_demo', 'dvtt01_demo', 'cv13_demo', NOW(), NOW()),
  ('qn012_demo', '001234001245', 'Đinh Thị Nga',     'NU',  '1991-11-19', 'Xã Long Bình, tỉnh Đồng Nai',  'Hà Nội', '2014-09-01', '2016-08-01', 'Thiếu tá',   'cqdv01_demo', 'dvtt02_demo', 'cv15_demo', NOW(), NOW()),
  ('qn013_demo', '001234001246', 'Nguyễn Thanh Ơn',  'NAM', '1988-02-07', 'Xã Tam Hiệp, TP Đà Nẵng',       'Hà Nội', '2010-09-01', '2012-09-01', 'Trung tá',   'cqdv01_demo', 'dvtt02_demo', 'cv14_demo', NOW(), NOW()),
  ('qn014_demo', '001234001247', 'Phạm Văn Phúc',    'NAM', '1996-09-04', 'Xã Long Hồ, tỉnh Vĩnh Long',   'Hà Nội', '2019-09-01', '2021-12-01', 'Đại úy',     'cqdv01_demo', 'dvtt02_demo', 'cv15_demo', NOW(), NOW()),
  ('qn015_demo', '001234001248', 'Trần Quang Quân',  'NAM', '1989-07-21', 'Xã Hoà Lạc, tỉnh Phú Thọ',     'Hà Nội', '2011-09-01', '2013-08-01', 'Trung tá',   'cqdv02_demo', 'dvtt03_demo', 'cv17_demo', NOW(), NOW()),
  ('qn016_demo', '001234001249', 'Lê Văn Sơn',       'NAM', '1994-03-15', 'Xã Tân Hiệp, tỉnh Tiền Giang', 'Hà Nội', '2017-09-01', '2019-07-01', 'Thiếu tá',   'cqdv02_demo', 'dvtt03_demo', 'cv17_demo', NOW(), NOW()),
  ('qn017_demo', '001234001250', 'Ngô Văn Tài',      'NAM', '1987-10-12', 'Xã An Khánh, tỉnh Bến Tre',    'Hà Nội', '2009-09-01', '2011-09-01', 'Trung tá',   'cqdv02_demo', 'dvtt03_demo', 'cv16_demo', NOW(), NOW()),
  ('qn018_demo', '001234001251', 'Vương Thị Uyên',   'NU',  '1990-01-25', 'Xã Bình Lợi, TP Hồ Chí Minh',  'Hà Nội', '2013-09-01', '2015-10-01', 'Thiếu tá',   'cqdv02_demo', 'dvtt04_demo', 'cv18_demo', NOW(), NOW()),
  ('qn019_demo', '001234001252', 'Đặng Văn Vinh',    'NAM', '1992-04-06', 'Xã Hoà Bình, tỉnh Hoà Bình',   'Hà Nội', '2014-09-01', '2016-09-01', 'Thiếu tá',   'cqdv02_demo', 'dvtt04_demo', 'cv18_demo', NOW(), NOW()),
  ('qn020_demo', '001234001253', 'Hoàng Thị Xuân',   'NU',  '1986-12-30', 'Xã Cẩm Mỹ, tỉnh Đồng Nai',     'Hà Nội', '2009-09-01', '2011-09-01', 'Trung tá',   'cqdv02_demo', NULL,           'cv04_demo', NOW(), NOW()),
  ('qn021_demo', '001234001254', 'Lý Văn Yên',       'NAM', '1990-08-11', 'Xã Đồng Văn, tỉnh Hà Giang',   'Hà Nội', '2013-09-01', '2015-08-01', 'Thiếu tá',   'cqdv03_demo', 'dvtt05_demo', 'cv19_demo', NOW(), NOW()),
  ('qn022_demo', '001234001255', 'Phan Đình Sang',   'NAM', '1985-05-23', 'Xã Long Khánh, tỉnh Đồng Nai', 'Hà Nội', '2008-09-01', '2010-09-01', 'Trung tá',   'cqdv03_demo', 'dvtt05_demo', 'cv19_demo', NOW(), NOW()),
  ('qn023_demo', '001234001256', 'Mai Văn Tùng',     'NAM', '1993-09-02', 'Xã An Phú, TP Hồ Chí Minh',    'Hà Nội', '2016-09-01', '2018-09-01', 'Thiếu tá',   'cqdv03_demo', 'dvtt06_demo', 'cv20_demo', NOW(), NOW()),
  ('qn024_demo', '001234001257', 'Nguyễn Thị Hoa',   'NU',  '1988-06-19', 'Xã Long Mỹ, tỉnh Hậu Giang',   'Hà Nội', '2011-09-01', '2013-08-01', 'Trung tá',   'cqdv03_demo', 'dvtt06_demo', 'cv20_demo', NOW(), NOW()),
  ('qn025_demo', '001234001258', 'Vũ Quang Trung',   'NAM', '1991-02-14', 'Xã Vĩnh Bình, tỉnh Long An',   'Hà Nội', '2014-09-01', '2016-09-01', 'Thiếu tá',   'cqdv01_demo', 'dvtt01_demo', 'cv13_demo', NOW(), NOW()),
  ('qn026_demo', '001234001259', 'Bùi Văn Khải',     'NAM', '1989-11-27', 'Xã Tân Phú, tỉnh Đồng Nai',    'Hà Nội', '2012-09-01', '2014-08-01', 'Thiếu tá',   'cqdv01_demo', 'dvtt02_demo', 'cv15_demo', NOW(), NOW()),
  ('qn027_demo', '001234001260', 'Đinh Văn Lộc',     'NAM', '1995-04-09', 'Xã Long Hải, tỉnh Bà Rịa',     'Hà Nội', '2018-09-01', '2020-08-01', 'Đại úy',     'cqdv02_demo', 'dvtt04_demo', 'cv18_demo', NOW(), NOW()),
  ('qn028_demo', '001234001261', 'Nguyễn Thị Hà',    'NU',  '1992-08-18', 'Xã Phú Yên, tỉnh Phú Yên',     'Hà Nội', '2015-09-01', '2017-09-01', 'Thiếu tá',   'cqdv03_demo', 'dvtt05_demo', 'cv19_demo', NOW(), NOW()),
  ('qn029_demo', '001234001262', 'Lê Hoàng Phương',  'NAM', '1987-01-03', 'Xã Cát Bà, TP Hải Phòng',      'Hà Nội', '2009-09-01', '2011-09-01', 'Trung tá',   'cqdv03_demo', NULL,           'cv05_demo', NOW(), NOW()),
  ('qn030_demo', '001234001263', 'Trần Thị Mai',     'NU',  '1994-10-20', 'Xã Mỹ Lộc, tỉnh Nam Định',     'Hà Nội', '2017-09-01', '2019-09-01', 'Thiếu tá',   'cqdv01_demo', 'dvtt02_demo', 'cv15_demo', NOW(), NOW());

-- 2 PERSONA MỚI cho test eligibility chuỗi
INSERT INTO "QuanNhan" (id, cccd, ho_ten, gioi_tinh, ngay_sinh, que_quan_2_cap, tru_quan, ngay_nhap_ngu, ngay_xuat_ngu, ngay_vao_dang, so_dien_thoai, cap_bac, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id, "createdAt", "updatedAt") VALUES
  -- QN-031: CSTDTQ cycle 2 — đã có CSTDTQ năm 2022, đủ chu kỳ kế năm 2026
  ('qn031_demo', '001234001264', 'Vũ Quang Hậu',     'NAM', '1982-04-18', 'Xã Quỳnh Lưu, tỉnh Nghệ An',   'Hà Nội', '2005-09-01', NULL, '2007-08-01', '0912000031', 'Thượng tá', 'cqdv04_demo', NULL,           'cv21_demo', NOW(), NOW()),
  -- QN-032: Lỡ đợt — chuỗi 8 năm CSTDCS liên tục, chưa từng đề xuất BKBQP, đủ chu kỳ 4
  ('qn032_demo', '001234001265', 'Phan Thị Linh',    'NU',  '1986-09-30', 'Xã Tam Đường, tỉnh Lai Châu',  'Hà Nội', '2009-09-01', NULL, '2011-09-01', '0912000032', 'Trung tá',  'cqdv04_demo', 'dvtt07_demo', 'cv22_demo', NOW(), NOW());

-- -----------------------------------------------------------------
-- 7. TaiKhoan — 4 tài khoản demo (password đã hash sẵn = "Hvkhqs@123")
-- -----------------------------------------------------------------
-- bcrypt hash cost=10 cho password "Hvkhqs@123" — đã verify hoạt động.
-- Nếu muốn đổi password sau khi import, chạy: npx tsx scripts/demo/02-set-passwords.ts
INSERT INTO "TaiKhoan" (id, quan_nhan_id, username, password_hash, role, "refreshToken", "createdAt", "updatedAt") VALUES
  ('tk001_demo', NULL,           'superadmin_demo', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'SUPER_ADMIN', NULL, NOW(), NOW()),
  ('tk002_demo', 'qn003_demo',   'admin_demo',      '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'ADMIN',       NULL, NOW(), NOW()),
  ('tk003_demo', 'qn002_demo',   'manager_demo',    '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'MANAGER',     NULL, NOW(), NOW()),
  ('tk004_demo', 'qn010_demo',   'user_demo',       '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER',        NULL, NOW(), NOW());

-- -----------------------------------------------------------------
-- 8. LichSuChucVu — feed dữ liệu cho HCBVTQ cống hiến (QN-005, QN-006)
-- -----------------------------------------------------------------
-- QN-005 Nguyễn Văn Em: m07=189 + m08=48 + m0910≈40 → CHỈ đủ Hạng Ba
--   Hạng Nhì (m08+m0910=88<120) ❌, Hạng Ba (tổng=277≥120) ✓
INSERT INTO "LichSuChucVu" (id, quan_nhan_id, chuc_vu_id, he_so_chuc_vu, ngay_bat_dau, ngay_ket_thuc, so_thang, "createdAt", "updatedAt") VALUES
  ('lscv001_demo', 'qn005_demo', 'cv13_demo', 0.70, '2003-04-01', '2018-12-31', 189, NOW(), NOW()),
  ('lscv002_demo', 'qn005_demo', 'cv12_demo', 0.80, '2019-01-01', '2022-12-31',  48, NOW(), NOW()),
  ('lscv003_demo', 'qn005_demo', 'cv16_demo', 0.90, '2023-01-01', NULL,           NULL, NOW(), NOW()),

-- QN-006 Trần Thị Phượng: đã đủ Hạng Ba, nay đủ thêm Hạng Nhì (he_so 0.8-1.0)
  ('lscv005_demo', 'qn006_demo', 'cv13_demo', 0.70, '2006-09-01', '2010-08-31',  48, NOW(), NOW()),
  ('lscv006_demo', 'qn006_demo', 'cv12_demo', 0.80, '2010-09-01', '2016-08-31',  72, NOW(), NOW()),
  ('lscv007_demo', 'qn006_demo', 'cv11_demo', 0.90, '2016-09-01', '2022-12-31',  76, NOW(), NOW()),
  ('lscv008_demo', 'qn006_demo', 'cv18_demo', 0.90, '2023-01-01', NULL,           NULL, NOW(), NOW()),

-- QN-008 Đỗ Quang Hùng (HCQKQT 25y)
  ('lscv009_demo', 'qn008_demo', 'cv13_demo', 0.70, '2003-02-01', '2010-12-31',  95, NOW(), NOW()),
  ('lscv010_demo', 'qn008_demo', 'cv11_demo', 0.90, '2011-01-01', '2018-12-31',  96, NOW(), NOW()),
  ('lscv011_demo', 'qn008_demo', 'cv05_demo', 1.00, '2019-01-01', NULL,           NULL, NOW(), NOW()),

-- QN-001 Trần Văn An (BKBQP eligible) — chỉ vài record cơ bản
  ('lscv012_demo', 'qn001_demo', 'cv13_demo', 0.70, '2014-03-01', '2020-12-31',  82, NOW(), NOW()),
  ('lscv013_demo', 'qn001_demo', 'cv12_demo', 0.80, '2021-01-01', NULL,           NULL, NOW(), NOW()),

-- QN-002 Nguyễn Văn Bình (CSTDTQ eligible)
  ('lscv014_demo', 'qn002_demo', 'cv12_demo', 0.80, '2010-05-01', '2018-12-31', 104, NOW(), NOW()),
  ('lscv015_demo', 'qn002_demo', 'cv11_demo', 0.90, '2019-01-01', NULL,           NULL, NOW(), NOW()),

-- QN-003 Lê Quang Cường (BKTTCP eligible)
  ('lscv016_demo', 'qn003_demo', 'cv12_demo', 0.80, '2005-08-01', '2014-12-31', 113, NOW(), NOW()),
  ('lscv017_demo', 'qn003_demo', 'cv01_demo', 1.00, '2015-01-01', NULL,           NULL, NOW(), NOW()),

-- QN-004 Phạm Đình Dũng (đã có BKTTCP)
  ('lscv018_demo', 'qn004_demo', 'cv03_demo', 1.00, '2002-06-01', NULL,           NULL, NOW(), NOW()),

-- QN-009 Lê Thị Khánh (KNC nữ 20y)
  ('lscv019_demo', 'qn009_demo', 'cv13_demo', 0.70, '2008-07-01', '2015-12-31',  90, NOW(), NOW()),
  ('lscv020_demo', 'qn009_demo', 'cv20_demo', 0.90, '2016-01-01', NULL,           NULL, NOW(), NOW());

-- -----------------------------------------------------------------
-- 9. ThanhTichKhoaHoc (NCKH) — phục vụ chuỗi BKTTCP
-- -----------------------------------------------------------------
-- QN-003 (BKTTCP eligible) cần NCKH mỗi năm 2019-2025
INSERT INTO "ThanhTichKhoaHoc" (id, quan_nhan_id, nam, loai, mo_ta, cap_bac, chuc_vu, ghi_chu, so_quyet_dinh, "createdAt", "updatedAt") VALUES
  ('ttkh001_demo', 'qn003_demo', 2019, 'DTKH', 'Đề tài "Mô hình quản lý hồ sơ điện tử"',           'Trung tá',  'Trưởng phòng', NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh002_demo', 'qn003_demo', 2020, 'SKKH', 'Sáng kiến cải tiến quy trình nhập liệu',           'Trung tá',  'Trưởng phòng', NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh003_demo', 'qn003_demo', 2021, 'DTKH', 'Đề tài về tự động hoá báo cáo thống kê',           'Trung tá',  'Trưởng phòng', NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh004_demo', 'qn003_demo', 2022, 'SKKH', 'Sáng kiến phương pháp huấn luyện mới',             'Thượng tá', 'Trưởng phòng', NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh005_demo', 'qn003_demo', 2023, 'DTKH', 'Đề tài chuyển đổi số trong quản lý quân nhân',     'Thượng tá', 'Trưởng phòng', NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh006_demo', 'qn003_demo', 2024, 'SKKH', 'Sáng kiến nâng cao hiệu quả công tác chính trị',   'Thượng tá', 'Trưởng phòng', NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh007_demo', 'qn003_demo', 2025, 'DTKH', 'Đề tài tổng hợp đánh giá khen thưởng giai đoạn',   'Thượng tá', 'Trưởng phòng', NULL, '22/QD-BTL', NOW(), NOW()),

  -- QN-002 (CSTDTQ eligible) cần NCKH 2023+2024+2025 (nckh_lien_tuc >= cstdcs_lien_tuc=3)
  ('ttkh008_demo', 'qn002_demo', 2024, 'SKKH', 'Sáng kiến quản lý văn bản nội bộ',                 'Trung tá',  'Trưởng ban',   NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh009_demo', 'qn002_demo', 2025, 'DTKH', 'Đề tài về quản lý thông tin cán bộ',               'Trung tá',  'Trưởng ban',   NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh017_demo', 'qn002_demo', 2023, 'DTKH', 'Đề tài cải tiến công tác cán bộ',                  'Trung tá',  'Trưởng ban',   NULL, '22/QD-BTL', NOW(), NOW()),

  -- QN-001 (BKBQP eligible) cần NCKH 2024+2025 (nckh_lien_tuc >= cstdcs_lien_tuc=2)
  ('ttkh010_demo', 'qn001_demo', 2024, 'SKKH', 'Sáng kiến cải tiến quy trình tổng hợp',            'Thiếu tá',  'Phó trưởng ban', NULL, NULL,        NOW(), NOW()),
  ('ttkh016_demo', 'qn001_demo', 2025, 'DTKH', 'Đề tài đổi mới phương pháp công tác chính trị',    'Thiếu tá',  'Phó trưởng ban', NULL, NULL,        NOW(), NOW()),

  -- Một số NCKH khác cho QN khác
  ('ttkh011_demo', 'qn011_demo', 2023, 'DTKH', 'Đề tài quản lý kỹ thuật vũ khí',                   'Thiếu tá',  'Cán bộ',       NULL, NULL,        NOW(), NOW()),
  ('ttkh012_demo', 'qn013_demo', 2024, 'SKKH', 'Sáng kiến tổ chức học tập chính trị',              'Trung tá',  'Trưởng ban',   NULL, NULL,        NOW(), NOW()),
  ('ttkh013_demo', 'qn015_demo', 2024, 'DTKH', 'Đề tài về tác chiến phòng thủ',                    'Trung tá',  'Cán bộ',       NULL, NULL,        NOW(), NOW()),
  ('ttkh014_demo', 'qn006_demo', 2025, 'SKKH', 'Sáng kiến quản lý vật tư',                         'Thượng tá', 'Trưởng ban',   NULL, NULL,        NOW(), NOW()),
  ('ttkh015_demo', 'qn008_demo', 2025, 'DTKH', 'Đề tài hậu cần dã chiến',                          'Đại tá',    'Trưởng phòng', NULL, NULL,        NOW(), NOW()),
  -- QN-031 Vũ Quang Hậu — NCKH 6 năm liên tục (2020-2025) cho CSTDTQ cycle 2
  ('ttkh020_demo', 'qn031_demo', 2020, 'DTKH', 'Đề tài về quy hoạch đào tạo cán bộ',                'Trung tá',  'Phó trưởng phòng', NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh021_demo', 'qn031_demo', 2021, 'SKKH', 'Sáng kiến tổ chức kiểm tra học kỳ',                 'Trung tá',  'Phó trưởng phòng', NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh022_demo', 'qn031_demo', 2022, 'DTKH', 'Đề tài đổi mới phương pháp giảng dạy chiến thuật',  'Trung tá',  'Trưởng phòng',     NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh023_demo', 'qn031_demo', 2023, 'SKKH', 'Sáng kiến quản lý học viên qua công nghệ số',       'Trung tá',  'Trưởng phòng',     NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh024_demo', 'qn031_demo', 2024, 'DTKH', 'Đề tài về xây dựng giáo trình điện tử',             'Thượng tá', 'Trưởng phòng',     NULL, '22/QD-BTL', NOW(), NOW()),
  ('ttkh025_demo', 'qn031_demo', 2025, 'SKKH', 'Sáng kiến tổ chức thực hành liên môn',              'Thượng tá', 'Trưởng phòng',     NULL, '22/QD-BTL', NOW(), NOW()),
  -- QN-032 Phan Thị Linh — NCKH 8 năm liên tục (2018-2025) cho lỡ đợt BKBQP
  ('ttkh026_demo', 'qn032_demo', 2018, 'SKKH', 'Sáng kiến tổ chức rèn luyện thể lực',               'Thiếu tá',  'Cán bộ',           NULL, NULL,        NOW(), NOW()),
  ('ttkh027_demo', 'qn032_demo', 2019, 'DTKH', 'Đề tài cải tiến công tác tham mưu chiến thuật',     'Thiếu tá',  'Cán bộ',           NULL, NULL,        NOW(), NOW()),
  ('ttkh028_demo', 'qn032_demo', 2020, 'SKKH', 'Sáng kiến phối hợp huấn luyện tổng hợp',            'Thiếu tá',  'Cán bộ',           NULL, NULL,        NOW(), NOW()),
  ('ttkh029_demo', 'qn032_demo', 2021, 'DTKH', 'Đề tài về kỹ thuật chiến đấu cá nhân',              'Trung tá',  'Phó trưởng ban',   NULL, NULL,        NOW(), NOW()),
  ('ttkh030_demo', 'qn032_demo', 2022, 'SKKH', 'Sáng kiến tổ chức hội thao quân khu',               'Trung tá',  'Phó trưởng ban',   NULL, NULL,        NOW(), NOW()),
  ('ttkh031_demo', 'qn032_demo', 2023, 'DTKH', 'Đề tài về phương pháp tác chiến đêm',               'Trung tá',  'Trưởng ban',       NULL, NULL,        NOW(), NOW()),
  ('ttkh032_demo', 'qn032_demo', 2024, 'SKKH', 'Sáng kiến cải tiến biểu mẫu báo cáo',               'Trung tá',  'Trưởng ban',       NULL, NULL,        NOW(), NOW()),
  ('ttkh033_demo', 'qn032_demo', 2025, 'DTKH', 'Đề tài đánh giá hiệu quả chương trình huấn luyện',  'Trung tá',  'Trưởng ban',       NULL, NULL,        NOW(), NOW());

-- -----------------------------------------------------------------
-- 10. DanhHieuHangNam — chuỗi danh hiệu 5 năm gần nhất (2021-2025)
-- -----------------------------------------------------------------
-- QN-001 Trần Văn An: CSTDCS 2024 + 2025 → BKBQP eligible 2026
INSERT INTO "DanhHieuHangNam" (id, quan_nhan_id, nam, danh_hieu, cap_bac, chuc_vu, so_quyet_dinh, nhan_bkbqp, nhan_cstdtq, nhan_bkttcp, "createdAt", "updatedAt") VALUES
  ('dhhn001_demo', 'qn001_demo', 2021, NULL,     'Đại úy',    'Cán bộ',         NULL,         false, false, false, NOW(), NOW()),
  ('dhhn002_demo', 'qn001_demo', 2022, 'CSTDCS', 'Đại úy',    'Cán bộ',         '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn003_demo', 'qn001_demo', 2023, NULL,     'Thiếu tá',  'Cán bộ',         NULL,         false, false, false, NOW(), NOW()),
  ('dhhn004_demo', 'qn001_demo', 2024, 'CSTDCS', 'Thiếu tá',  'Phó trưởng ban', '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn005_demo', 'qn001_demo', 2025, 'CSTDCS', 'Thiếu tá',  'Phó trưởng ban', '12/QD-BTL', false, false, false, NOW(), NOW()),

-- QN-002 Nguyễn Văn Bình: 3 năm CSTDCS liên tục (2023-2025, % 3 === 0) + 1 BKBQP 2023 → eligible CSTDTQ 2026
  ('dhhn006_demo', 'qn002_demo', 2021, NULL,     'Trung tá',  'Trưởng ban',     NULL,         false, false, false, NOW(), NOW()),
  ('dhhn007_demo', 'qn002_demo', 2022, NULL,     'Trung tá',  'Trưởng ban',     NULL,         false, false, false, NOW(), NOW()),
  ('dhhn008_demo', 'qn002_demo', 2023, 'CSTDCS', 'Trung tá',  'Trưởng ban',     '15/QD-BTL', true,  false, false, NOW(), NOW()),
  ('dhhn009_demo', 'qn002_demo', 2024, 'CSTDCS', 'Trung tá',  'Trưởng ban',     '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn010_demo', 'qn002_demo', 2025, 'CSTDCS', 'Trung tá',  'Trưởng ban',     '12/QD-BTL', false, false, false, NOW(), NOW()),

-- QN-003 Lê Quang Cường: 7 năm CSTDCS liên tục + 3 BKBQP + 2 CSTDTQ → eligible BKTTCP 2026
  ('dhhn011_demo', 'qn003_demo', 2019, 'CSTDCS', 'Trung tá',  'Trưởng phòng',   '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn012_demo', 'qn003_demo', 2020, 'CSTDCS', 'Trung tá',  'Trưởng phòng',   '15/QD-BTL', true,  false, false, NOW(), NOW()),
  ('dhhn013_demo', 'qn003_demo', 2021, 'CSTDCS', 'Trung tá',  'Trưởng phòng',   '08/QD-TTg', false, true,  false, NOW(), NOW()),
  ('dhhn014_demo', 'qn003_demo', 2022, 'CSTDCS', 'Thượng tá', 'Trưởng phòng',   '15/QD-BTL', true,  false, false, NOW(), NOW()),
  ('dhhn015_demo', 'qn003_demo', 2023, 'CSTDCS', 'Thượng tá', 'Trưởng phòng',   '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn016_demo', 'qn003_demo', 2024, 'CSTDCS', 'Thượng tá', 'Trưởng phòng',   '08/QD-TTg', true,  true,  false, NOW(), NOW()),
  ('dhhn017_demo', 'qn003_demo', 2025, 'CSTDCS', 'Thượng tá', 'Trưởng phòng',   '12/QD-BTL', false, false, false, NOW(), NOW()),

-- QN-004 Phạm Đình Dũng: đã nhận BKTTCP năm 2024 → demo lifetime block
  ('dhhn018_demo', 'qn004_demo', 2018, 'CSTDCS', 'Đại tá',    'Trưởng phòng',   NULL,         false, false, false, NOW(), NOW()),
  ('dhhn019_demo', 'qn004_demo', 2019, 'CSTDCS', 'Đại tá',    'Trưởng phòng',   NULL,         true,  false, false, NOW(), NOW()),
  ('dhhn020_demo', 'qn004_demo', 2020, 'CSTDCS', 'Đại tá',    'Trưởng phòng',   NULL,         false, true,  false, NOW(), NOW()),
  ('dhhn021_demo', 'qn004_demo', 2021, 'CSTDCS', 'Đại tá',    'Trưởng phòng',   NULL,         true,  false, false, NOW(), NOW()),
  ('dhhn022_demo', 'qn004_demo', 2022, 'CSTDCS', 'Đại tá',    'Trưởng phòng',   NULL,         false, false, false, NOW(), NOW()),
  ('dhhn023_demo', 'qn004_demo', 2023, 'CSTDCS', 'Đại tá',    'Trưởng phòng',   NULL,         true,  true,  false, NOW(), NOW()),
  ('dhhn024_demo', 'qn004_demo', 2024, 'CSTDCS', 'Đại tá',    'Trưởng phòng',   '03/QD-CTN', false, false, true,  NOW(), NOW()),
  ('dhhn025_demo', 'qn004_demo', 2025, 'CSTDCS', 'Đại tá',    'Trưởng phòng',   NULL,         false, false, false, NOW(), NOW()),

-- QN-005 đến QN-009: dữ liệu CSTDCS rải rác, không tham gia chuỗi
  ('dhhn026_demo', 'qn005_demo', 2024, 'CSTDCS', 'Thượng tá', 'Trưởng ban',     '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn027_demo', 'qn005_demo', 2025, 'CSTDCS', 'Thượng tá', 'Trưởng ban',     '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn028_demo', 'qn006_demo', 2024, 'CSTDCS', 'Thượng tá', 'Trưởng ban',     '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn029_demo', 'qn006_demo', 2025, 'CSTDCS', 'Thượng tá', 'Trưởng ban',     '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn030_demo', 'qn007_demo', 2024, 'CSTDCS', 'Thiếu tá',  'Trưởng ban',     '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn031_demo', 'qn007_demo', 2025, 'CSTDCS', 'Thiếu tá',  'Trưởng ban',     '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn032_demo', 'qn008_demo', 2024, 'CSTDCS', 'Đại tá',    'Trưởng phòng',   '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn033_demo', 'qn008_demo', 2025, 'CSTDCS', 'Đại tá',    'Trưởng phòng',   '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn034_demo', 'qn009_demo', 2025, 'CSTDCS', 'Trung tá',  'Trưởng ban',     '12/QD-BTL', false, false, false, NOW(), NOW()),

-- Vài QN thường có CSTDCS rải rác
  ('dhhn035_demo', 'qn010_demo', 2024, 'CSTDCS', 'Đại úy',    'Cán bộ',         '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn036_demo', 'qn011_demo', 2024, 'CSTDCS', 'Thiếu tá',  'Cán bộ',         '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn037_demo', 'qn013_demo', 2024, 'CSTDCS', 'Trung tá',  'Trưởng ban',     '15/QD-BTL', true,  false, false, NOW(), NOW()),
  ('dhhn038_demo', 'qn015_demo', 2024, 'CSTDCS', 'Trung tá',  'Cán bộ',         '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn039_demo', 'qn020_demo', 2024, 'CSTDCS', 'Trung tá',  'Phó trưởng phòng','12/QD-BTL',false, false, false, NOW(), NOW()),
  ('dhhn040_demo', 'qn020_demo', 2025, 'CSTDCS', 'Trung tá',  'Phó trưởng phòng','12/QD-BTL',false, false, false, NOW(), NOW()),

-- QN-031 Vũ Quang Hậu: CSTDTQ cycle 2 — đã có CSTDTQ năm 2022, đủ điều kiện đề nghị CSTDTQ lại năm 2026
-- Streak CSTDCS 6 năm liên tục (2020-2025, % 3 = 0), BKBQP các năm 2021/2024 (1 BKBQP trong cửa sổ 3y 2023-2025)
  ('dhhn041_demo', 'qn031_demo', 2020, 'CSTDCS', 'Trung tá',  'Phó trưởng phòng','12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn042_demo', 'qn031_demo', 2021, 'CSTDCS', 'Trung tá',  'Phó trưởng phòng','15/QD-BTL', true,  false, false, NOW(), NOW()),
  ('dhhn043_demo', 'qn031_demo', 2022, 'CSTDCS', 'Trung tá',  'Trưởng phòng',    '08/QD-TTg', false, true,  false, NOW(), NOW()),
  ('dhhn044_demo', 'qn031_demo', 2023, 'CSTDCS', 'Trung tá',  'Trưởng phòng',    '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn045_demo', 'qn031_demo', 2024, 'CSTDCS', 'Thượng tá', 'Trưởng phòng',    '15/QD-BTL', true,  false, false, NOW(), NOW()),
  ('dhhn046_demo', 'qn031_demo', 2025, 'CSTDCS', 'Thượng tá', 'Trưởng phòng',    '12/QD-BTL', false, false, false, NOW(), NOW()),

-- QN-032 Phan Thị Linh: Lỡ đợt BKBQP — streak CSTDCS 8 năm liên tục (2018-2025), KHÔNG có BKBQP nào
-- streakSinceLastBkbqp = cstdcs_lien_tuc = 8, % 2 = 0, eligible BKBQP cycle 4 (lỡ 3 chu kỳ)
  ('dhhn047_demo', 'qn032_demo', 2018, 'CSTDCS', 'Thiếu tá',  'Cán bộ',          '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn048_demo', 'qn032_demo', 2019, 'CSTDCS', 'Thiếu tá',  'Cán bộ',          '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn049_demo', 'qn032_demo', 2020, 'CSTDCS', 'Thiếu tá',  'Cán bộ',          '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn050_demo', 'qn032_demo', 2021, 'CSTDCS', 'Trung tá',  'Phó trưởng ban',  '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn051_demo', 'qn032_demo', 2022, 'CSTDCS', 'Trung tá',  'Phó trưởng ban',  '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn052_demo', 'qn032_demo', 2023, 'CSTDCS', 'Trung tá',  'Trưởng ban',      '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn053_demo', 'qn032_demo', 2024, 'CSTDCS', 'Trung tá',  'Trưởng ban',      '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn054_demo', 'qn032_demo', 2025, 'CSTDCS', 'Trung tá',  'Trưởng ban',      '12/QD-BTL', false, false, false, NOW(), NOW());

-- -----------------------------------------------------------------
-- 11. KhenThuongHCBVTQ — QN-006 đã có Hạng Ba (cho demo upgrade)
-- -----------------------------------------------------------------
INSERT INTO "KhenThuongHCBVTQ" (id, quan_nhan_id, danh_hieu, nam, thang, cap_bac, chuc_vu, so_quyet_dinh, thoi_gian_nhom_0_7, thoi_gian_nhom_0_8, thoi_gian_nhom_0_9_1_0, "createdAt", "updatedAt") VALUES
  ('khct001_demo', 'qn006_demo', 'HCBVTQ_HANG_BA', 2024, 11, 'Thượng tá', 'Trưởng ban',
    '07/QD-BQP',
    '{"total_months":48,"display":"4 năm 0 tháng"}'::jsonb,
    '{"total_months":72,"display":"6 năm 0 tháng"}'::jsonb,
    '{"total_months":40,"display":"3 năm 4 tháng"}'::jsonb,
    NOW(), NOW());

-- -----------------------------------------------------------------
-- 12. KhenThuongHCCSVV — niên hạn 10/15/20 năm (3 hạng riêng biệt)
-- -----------------------------------------------------------------
-- QN-008 Đỗ Quang Hùng: đã có Hạng Ba và Hạng Nhì
INSERT INTO "KhenThuongHCCSVV" (id, quan_nhan_id, danh_hieu, nam, thang, cap_bac, chuc_vu, so_quyet_dinh, thoi_gian, "createdAt", "updatedAt") VALUES
  ('khcs001_demo', 'qn008_demo', 'HCCSVV_HANG_BA', 2011, 8, 'Trung tá',  'Cán bộ',       '20/QD-BTL', '{"total_months":120,"years":10,"months":0,"display":"10 năm"}'::jsonb, NOW(), NOW()),
  ('khcs002_demo', 'qn008_demo', 'HCCSVV_HANG_NHI', 2016, 8, 'Thượng tá', 'Trưởng phòng', '20/QD-BTL', '{"total_months":180,"years":15,"months":0,"display":"15 năm"}'::jsonb, NOW(), NOW());

-- -----------------------------------------------------------------
-- 13. HuanChuongQuanKyQuyetThang — QN-004 đã có (cho demo)
-- -----------------------------------------------------------------
INSERT INTO "HuanChuongQuanKyQuyetThang" (id, quan_nhan_id, nam, thang, cap_bac, chuc_vu, so_quyet_dinh, thoi_gian, "createdAt", "updatedAt") VALUES
  ('khqk001_demo', 'qn004_demo', 2025, 3, 'Đại tá', 'Trưởng phòng', '11/QD-BQP', '{"total_months":300,"years":25,"months":0,"display":"25 năm"}'::jsonb, NOW(), NOW());

-- -----------------------------------------------------------------
-- 14. KyNiemChuongVSNXDQDNDVN — chưa ai nhận (để demo cấp)
-- -----------------------------------------------------------------
-- (không insert, để demo cấp KNC cho QN-009 trong video V09)

-- -----------------------------------------------------------------
-- 15. KhenThuongDotXuat — vài bản ghi mẫu
-- -----------------------------------------------------------------
INSERT INTO "KhenThuongDotXuat" (id, loai, doi_tuong, quan_nhan_id, hinh_thuc_khen_thuong, nam, cap_bac, chuc_vu, ghi_chu, so_quyet_dinh, "createdAt", "updatedAt") VALUES
  ('ktdx001_demo', 'KHEN_THUONG_DOT_XUAT', 'CA_NHAN', 'qn003_demo', 'Giấy khen của Tư lệnh',                    2024, 'Thượng tá', 'Trưởng phòng', 'Hoàn thành xuất sắc nhiệm vụ chuyển đổi số', '05/QD-DV', NOW(), NOW()),
  ('ktdx002_demo', 'KHEN_THUONG_DOT_XUAT', 'CA_NHAN', 'qn008_demo', 'Bằng khen của Bộ Quốc phòng',              2024, 'Đại tá',    'Trưởng phòng', 'Đóng góp xuất sắc trong công tác hậu cần',   '05/QD-DV', NOW(), NOW());

INSERT INTO "KhenThuongDotXuat" (id, loai, doi_tuong, co_quan_don_vi_id, hinh_thuc_khen_thuong, nam, ghi_chu, so_quyet_dinh, "createdAt", "updatedAt") VALUES
  ('ktdx003_demo', 'KHEN_THUONG_DOT_XUAT', 'TAP_THE', 'cqdv01_demo', 'Cờ thi đua của Bộ Tư lệnh',                2024, 'Đơn vị xuất sắc trong phong trào thi đua', '05/QD-DV', NOW(), NOW()),
  ('ktdx006_demo', 'KHEN_THUONG_DOT_XUAT', 'TAP_THE', 'cqdv02_demo', 'Bằng khen của Quân ủy Trung ương',        2025, 'Tập thể dẫn đầu phong trào học tập sáng tạo', '05/QD-DV', NOW(), NOW());

INSERT INTO "KhenThuongDotXuat" (id, loai, doi_tuong, don_vi_truc_thuoc_id, hinh_thuc_khen_thuong, nam, ghi_chu, so_quyet_dinh, "createdAt", "updatedAt") VALUES
  ('ktdx007_demo', 'KHEN_THUONG_DOT_XUAT', 'TAP_THE', 'dvtt03_demo', 'Giấy khen của Tư lệnh',                   2025, 'Hoàn thành xuất sắc nhiệm vụ tác chiến', '05/QD-DV', NOW(), NOW());

-- Thêm 4 khen thưởng đột xuất cho cá nhân (đa dạng đối tượng)
INSERT INTO "KhenThuongDotXuat" (id, loai, doi_tuong, quan_nhan_id, hinh_thuc_khen_thuong, nam, cap_bac, chuc_vu, ghi_chu, so_quyet_dinh, "createdAt", "updatedAt") VALUES
  ('ktdx004_demo', 'KHEN_THUONG_DOT_XUAT', 'CA_NHAN', 'qn006_demo', 'Giấy khen của Chỉ huy', 2025, 'Thượng tá', 'Trưởng ban', 'Tham gia tích cực hoạt động ngoại khóa của đơn vị', '05/QD-DV', NOW(), NOW()),
  ('ktdx005_demo', 'KHEN_THUONG_DOT_XUAT', 'CA_NHAN', 'qn011_demo', 'Bằng khen của Bộ Tư lệnh', 2024, 'Thiếu tá', 'Cán bộ', 'Có sáng kiến tiết kiệm chi phí trong huấn luyện',  '05/QD-DV', NOW(), NOW()),
  ('ktdx008_demo', 'KHEN_THUONG_DOT_XUAT', 'CA_NHAN', 'qn013_demo', 'Giấy khen của Tư lệnh', 2025, 'Trung tá', 'Trưởng ban', 'Tổ chức tốt công tác giáo dục chính trị tư tưởng', '05/QD-DV', NOW(), NOW()),
  ('ktdx009_demo', 'KHEN_THUONG_DOT_XUAT', 'CA_NHAN', 'qn021_demo', 'Giấy khen của Tư lệnh', 2024, 'Thiếu tá', 'Trưởng ban', 'Hoàn thành xuất sắc đợt diễn tập đột xuất', '05/QD-DV', NOW(), NOW());

-- -----------------------------------------------------------------
-- 16. HoSoNienHan — 1:1 với QuanNhan (để FE hiển thị ngay không cần recalc)
-- -----------------------------------------------------------------
INSERT INTO "HoSoNienHan" (id, quan_nhan_id, hccsvv_hang_ba_status, hccsvv_hang_ba_ngay, hccsvv_hang_nhi_status, hccsvv_hang_nhi_ngay, hccsvv_hang_nhat_status, goi_y, "createdAt", "updatedAt") VALUES
  ('hsnh001_demo', 'qn001_demo', 'CHUA_DU',      NULL,        'CHUA_DU',      NULL,        'CHUA_DU', 'Chưa đủ niên hạn 10 năm phục vụ',                           NOW(), NOW()),
  ('hsnh002_demo', 'qn002_demo', 'DU_DIEU_KIEN', NULL,        'CHUA_DU',      NULL,        'CHUA_DU', 'Đủ điều kiện đề nghị HCCSVV Hạng Ba (đã 17 năm phục vụ)', NOW(), NOW()),
  ('hsnh003_demo', 'qn003_demo', 'DU_DIEU_KIEN', NULL,        'DU_DIEU_KIEN', NULL,        'CHUA_DU', 'Đủ điều kiện đề nghị HCCSVV Hạng Nhì (đã 22 năm phục vụ)', NOW(), NOW()),
  ('hsnh004_demo', 'qn004_demo', 'DA_NHAN',      '2010-08-01','DA_NHAN',      '2015-08-01','DU_DIEU_KIEN', 'Đủ điều kiện Hạng Nhất (25 năm phục vụ)',                  NOW(), NOW()),
  ('hsnh005_demo', 'qn005_demo', 'DU_DIEU_KIEN', NULL,        'DU_DIEU_KIEN', NULL,        'CHUA_DU', 'Đủ điều kiện đề nghị HCCSVV Hạng Nhì (24 năm phục vụ)',    NOW(), NOW()),
  ('hsnh006_demo', 'qn006_demo', 'DU_DIEU_KIEN', NULL,        'DU_DIEU_KIEN', NULL,        'CHUA_DU', 'Đủ điều kiện đề nghị HCCSVV Hạng Nhì (21 năm phục vụ)',    NOW(), NOW()),
  ('hsnh007_demo', 'qn007_demo', 'DU_DIEU_KIEN', NULL,        'CHUA_DU',      NULL,        'CHUA_DU', 'Đủ điều kiện đề nghị HCCSVV Hạng Ba (10 năm phục vụ)',     NOW(), NOW()),
  ('hsnh008_demo', 'qn008_demo', 'DA_NHAN',      '2011-08-01','DA_NHAN',      '2016-08-01','DU_DIEU_KIEN', 'Đủ điều kiện Hạng Nhất (25 năm phục vụ)',                  NOW(), NOW()),
  ('hsnh009_demo', 'qn009_demo', 'DU_DIEU_KIEN', NULL,        'CHUA_DU',      NULL,        'CHUA_DU', 'Đủ điều kiện đề nghị HCCSVV Hạng Ba (20 năm phục vụ)',     NOW(), NOW());

-- -----------------------------------------------------------------
-- 17. HoSoCongHien — 1:1 với QuanNhan
-- -----------------------------------------------------------------
-- Lưu ý: status DU_DIEU_KIEN cho hạng cao nhất; status các hạng thấp hơn có thể là DU_DIEU_KIEN
-- nếu QN cũng đủ điều kiện hạng đó. Khi đề xuất phải chọn hạng cao nhất (validateHCBVTQHighestRank).
INSERT INTO "HoSoCongHien" (id, quan_nhan_id, hcbvtq_total_months, months_07, months_08, months_0910, hcbvtq_hang_ba_status, hcbvtq_hang_ba_ngay, hcbvtq_hang_nhi_status, hcbvtq_hang_nhi_ngay, hcbvtq_hang_nhat_status, goi_y, "createdAt", "updatedAt") VALUES
  -- QN-005: m07=189, m08=48, m0910≈40 → CHỈ đủ Hạng Ba (m08+m0910=88<120)
  ('hsch001_demo', 'qn005_demo', 277, 189, 48, 40, 'DU_DIEU_KIEN', NULL,         'CHUA_DU',      NULL,        'CHUA_DU', 'Đủ điều kiện đề nghị HCBVTQ Hạng Ba — đã đạt 277 tháng tổng (≥120 tháng).',                          NOW(), NOW()),
  -- QN-006: m07=48, m08=72, m0910=116 → đã có Hạng Ba, đủ Hạng Nhì (m08+m0910=188≥120, m0910<120)
  ('hsch002_demo', 'qn006_demo', 236, 48, 72, 116, 'DA_NHAN',      '2024-11-01', 'DU_DIEU_KIEN', NULL,        'CHUA_DU', 'Đã có HCBVTQ Hạng Ba (2024). Đủ điều kiện đề nghị Hạng Nhì — đã đạt 188 tháng nhóm 0.8-1.0.',         NOW(), NOW()),
  -- QN-003: m07=0, m08=113, m0910=137 → đủ Hạng Nhất (m0910≥120)
  ('hsch003_demo', 'qn003_demo', 250, 0, 113, 137, 'DU_DIEU_KIEN', NULL,         'DU_DIEU_KIEN', NULL,        'DU_DIEU_KIEN', 'Đủ điều kiện đề nghị HCBVTQ Hạng Nhất — đã đạt 137 tháng hệ số 0.9-1.0.',                       NOW(), NOW()),
  -- QN-008: m07=95, m08=0, m0910=184 → đủ Hạng Nhất
  ('hsch004_demo', 'qn008_demo', 279, 95, 0, 184, 'DU_DIEU_KIEN', NULL,         'DU_DIEU_KIEN', NULL,        'DU_DIEU_KIEN', 'Đủ điều kiện đề nghị HCBVTQ Hạng Nhất — đã đạt 184 tháng hệ số 0.9-1.0.',                       NOW(), NOW()),
  -- QN-001: m07=82, m08=64, m0910=0 → đủ Hạng Ba (146 tháng tổng ≥ 120)
  ('hsch005_demo', 'qn001_demo', 146, 82, 64, 0, 'DU_DIEU_KIEN', NULL,         'CHUA_DU',      NULL,        'CHUA_DU', 'Đủ điều kiện đề nghị HCBVTQ Hạng Ba — đã đạt 146 tháng tổng (m08+m0910=64<120 nên chưa đủ Hạng Nhì).', NOW(), NOW()),
  -- QN-002: m07=0, m08=104, m0910=88 → đủ Hạng Nhì (m08+m0910=192≥120, m0910<120)
  ('hsch006_demo', 'qn002_demo', 192, 0, 104, 88, 'DU_DIEU_KIEN', NULL,         'DU_DIEU_KIEN', NULL,        'CHUA_DU', 'Đủ điều kiện đề nghị HCBVTQ Hạng Nhì — đã đạt 192 tháng nhóm 0.8-1.0.',                              NOW(), NOW()),
  -- QN-009: m07=90, m08=0, m0910=125 → đủ Hạng Nhất
  ('hsch007_demo', 'qn009_demo', 215, 90, 0, 125, 'DU_DIEU_KIEN', NULL,         'DU_DIEU_KIEN', NULL,        'DU_DIEU_KIEN', 'Đủ điều kiện đề nghị HCBVTQ Hạng Nhất — đã đạt 125 tháng hệ số 0.9-1.0.',                       NOW(), NOW());

-- -----------------------------------------------------------------
-- 18. HoSoHangNam — 1:1 với QuanNhan
-- -----------------------------------------------------------------
INSERT INTO "HoSoHangNam" (id, quan_nhan_id, tong_cstdcs, tong_nckh, cstdcs_lien_tuc, nckh_lien_tuc, bkbqp_lien_tuc, cstdtq_lien_tuc, du_dieu_kien_bkbqp, du_dieu_kien_cstdtq, du_dieu_kien_bkttcp, goi_y, "createdAt", "updatedAt") VALUES
  -- QN-001: BKBQP eligible 2026 — streak 2 + NCKH 2 năm liên tục
  ('hshn001_demo', 'qn001_demo', 3, 2, 2, 2, 0, 0, true,  false, false, 'Đủ điều kiện đề nghị Bằng khen Bộ Quốc phòng năm 2026 (đã đạt CSTDCS năm 2024+2025 và NCKH liên tục)', NOW(), NOW()),
  -- QN-002: CSTDTQ eligible 2026 — streak 3 + 1 BKBQP 2023 + NCKH 3 năm
  ('hshn002_demo', 'qn002_demo', 3, 3, 3, 3, 1, 0, true,  true,  false, 'Đủ điều kiện đề nghị Chiến sĩ Thi đua Toàn quốc năm 2026 (chuỗi 3 năm CSTDCS, 1 BKBQP năm 2023, NCKH liên tục). Cũng đủ điều kiện BKBQP nhưng nên đề nghị danh hiệu cao hơn.', NOW(), NOW()),
  -- QN-003: BKTTCP eligible 2026 — streak 7 + 3 BKBQP + 2 CSTDTQ + NCKH 7 năm
  ('hshn003_demo', 'qn003_demo', 7, 7, 7, 7, 3, 2, false, false, true,  'Đủ điều kiện đề nghị Bằng khen Thủ tướng năm 2026 (đủ chuỗi 7 năm với 3 BKBQP + 2 CSTDTQ + NCKH hằng năm)', NOW(), NOW()),
  -- QN-004: đã nhận BKTTCP — lifetime block toàn bộ chuỗi
  ('hshn004_demo', 'qn004_demo', 8, 0, 8, 0, 0, 0, false, false, false, 'Đã có Bằng khen Thủ tướng. Phần mềm chưa hỗ trợ các danh hiệu cao hơn Bằng khen Thủ tướng, sẽ phát triển trong thời gian tới.', NOW(), NOW()),
  -- QN-005: đủ chuỗi CSTDCS nhưng thiếu NCKH → focus HCBVTQ
  ('hshn005_demo', 'qn005_demo', 2, 0, 2, 0, 0, 0, false, false, false, 'Đã đạt CSTDCS năm 2024+2025. Cần thêm NCKH liên tục 2 năm để đủ điều kiện BKBQP. Đồng thời đủ điều kiện đề nghị HCBVTQ Hạng Ba (xem hồ sơ cống hiến).', NOW(), NOW()),
  -- QN-006: đủ chuỗi nhưng thiếu NCKH → focus rank upgrade HCBVTQ
  ('hshn006_demo', 'qn006_demo', 2, 1, 2, 1, 0, 0, false, false, false, 'Đã đạt CSTDCS năm 2024+2025. Cần thêm NCKH năm 2024 để đủ điều kiện BKBQP. Đã có HCBVTQ Hạng Ba, hiện đủ điều kiện đề nghị nâng lên Hạng Nhì.', NOW(), NOW()),
  -- QN-007: đủ chuỗi nhưng thiếu NCKH → focus HCCSVV niên hạn
  ('hshn007_demo', 'qn007_demo', 2, 0, 2, 0, 0, 0, false, false, false, 'Đã đạt CSTDCS năm 2024+2025. Cần thêm NCKH liên tục để đủ điều kiện BKBQP. Đủ niên hạn 10 năm — đề nghị HCCSVV Hạng Ba.', NOW(), NOW()),
  -- QN-008: HCQKQT 25y phục vụ
  ('hshn008_demo', 'qn008_demo', 2, 1, 2, 1, 0, 0, false, false, false, 'Đã đạt CSTDCS năm 2024+2025. Đủ niên hạn 25 năm — đề nghị HCQKQT. Đủ cống hiến — đề nghị HCBVTQ Hạng Nhất.', NOW(), NOW()),
  -- QN-009: KNC nữ 20y phục vụ
  ('hshn009_demo', 'qn009_demo', 1, 0, 1, 0, 0, 0, false, false, false, 'Cần đạt CSTDCS thêm 1 năm để đủ điều kiện BKBQP. Đủ niên hạn 20 năm (nữ) — đề nghị Kỷ niệm chương VSNXD QĐNDVN.', NOW(), NOW()),
  -- QN còn lại: hồ sơ cơ bản (chỉ đạt CSTDCS năm 2024, chưa đạt 2025 → streak ending 2025 = 0)
  ('hshn010_demo', 'qn010_demo', 1, 0, 0, 0, 0, 0, false, false, false, NULL, NOW(), NOW()),
  ('hshn011_demo', 'qn011_demo', 1, 1, 0, 0, 0, 0, false, false, false, NULL, NOW(), NOW()),
  ('hshn012_demo', 'qn013_demo', 1, 1, 0, 0, 1, 0, false, false, false, 'Đã có 1 BKBQP năm 2024, cần đạt CSTDCS năm 2025 và 2026 để khôi phục chuỗi.', NOW(), NOW()),
  ('hshn013_demo', 'qn020_demo', 2, 0, 2, 0, 0, 0, false, false, false, 'Đã đạt CSTDCS năm 2024+2025. Cần thêm NCKH liên tục để đủ điều kiện BKBQP.', NOW(), NOW()),
  -- QN-031: CSTDTQ cycle 2 — đã có CSTDTQ 2022, đủ chu kỳ kế năm 2026
  ('hshn014_demo', 'qn031_demo', 6, 6, 6, 6, 2, 1, true,  true,  false, 'Đủ điều kiện đề nghị Chiến sĩ Thi đua Toàn quốc cycle 2 năm 2026 (chuỗi 6 năm CSTDCS, 1 BKBQP trong cửa sổ 3 năm gần nhất, NCKH liên tục). Đã từng nhận CSTDTQ năm 2022.', NOW(), NOW()),
  -- QN-032: Lỡ đợt BKBQP — streak 8 năm, chưa từng nhận BKBQP, đủ chu kỳ 4
  ('hshn015_demo', 'qn032_demo', 8, 8, 8, 8, 0, 0, true,  false, false, 'Đủ điều kiện đề nghị Bằng khen Bộ Quốc phòng năm 2026. Lưu ý: đã lỡ 3 chu kỳ BKBQP trước (2020/2022/2024) — đề xuất muộn vẫn được chấp nhận.', NOW(), NOW());

-- -----------------------------------------------------------------
-- 19. HoSoDonViHangNam — hồ sơ đơn vị (cho demo chuỗi đơn vị)
-- -----------------------------------------------------------------
INSERT INTO "HoSoDonViHangNam" (id, co_quan_don_vi_id, nam, tong_dvqt, dvqt_lien_tuc, du_dieu_kien_bk_tong_cuc, du_dieu_kien_bk_thu_tuong, goi_y, "createdAt", "updatedAt") VALUES
  ('hsdv001_demo', 'cqdv01_demo', 2024, 1, 1, false, false, NULL, NOW(), NOW()),
  ('hsdv002_demo', 'cqdv01_demo', 2025, 2, 2, true,  false, 'Đủ điều kiện đề nghị Bằng khen Bộ Tổng cục cho đơn vị (2 năm ĐVQT liên tục)', NOW(), NOW()),
  ('hsdv003_demo', 'cqdv02_demo', 2024, 1, 1, false, false, NULL, NOW(), NOW()),
  ('hsdv004_demo', 'cqdv02_demo', 2025, 2, 2, true,  false, 'Đủ điều kiện đề nghị Bằng khen Bộ Tổng cục cho đơn vị', NOW(), NOW()),
  ('hsdv005_demo', 'cqdv03_demo', 2025, 1, 1, false, false, NULL, NOW(), NOW()),
  -- CQDV-04 Phòng Đào tạo: BKTTCP đơn vị eligible — 7 năm ĐVQT liên tục + 3 BKBQP đơn vị trong 7y
  ('hsdv006_demo', 'cqdv04_demo', 2025, 7, 7, true,  true,  'Đủ điều kiện đề nghị Bằng khen Thủ tướng cấp đơn vị (chuỗi 7 năm ĐVQT liên tục + 3 BKBQP đơn vị trong cửa sổ 7 năm).', NOW(), NOW());

-- -----------------------------------------------------------------
-- 20. DanhHieuDonViHangNam
-- -----------------------------------------------------------------
INSERT INTO "DanhHieuDonViHangNam" (id, co_quan_don_vi_id, nam, danh_hieu, so_quyet_dinh, nhan_bkbqp, nhan_bkttcp, status, nguoi_tao_id, nguoi_duyet_id, ngay_duyet, "createdAt", "updatedAt") VALUES
  ('dhdv001_demo', 'cqdv01_demo', 2024, 'DVQT', '12/QD-BTL', false, false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2025-01-15 10:30:00', NOW(), NOW()),
  ('dhdv002_demo', 'cqdv01_demo', 2025, 'DVQT', '12/QD-BTL', false, false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2026-01-10 09:00:00', NOW(), NOW()),
  ('dhdv003_demo', 'cqdv02_demo', 2024, 'DVQT', '12/QD-BTL', false, false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2025-01-15 10:30:00', NOW(), NOW()),
  ('dhdv004_demo', 'cqdv02_demo', 2025, 'DVQT', '12/QD-BTL', false, false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2026-01-10 09:00:00', NOW(), NOW()),
  ('dhdv005_demo', 'cqdv03_demo', 2025, 'DVQT', '12/QD-BTL', false, false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2026-01-10 09:00:00', NOW(), NOW()),
  -- CQDV-04: 7 năm ĐVQT liên tục (2019-2025), nhận BKBQP đơn vị 3 lần (2020, 2022, 2024)
  ('dhdv006_demo', 'cqdv04_demo', 2019, 'DVQT', '12/QD-BTL', false, false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2020-01-15 10:00:00', NOW(), NOW()),
  ('dhdv007_demo', 'cqdv04_demo', 2020, 'DVQT', '15/QD-BTL', true,  false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2021-01-15 10:00:00', NOW(), NOW()),
  ('dhdv008_demo', 'cqdv04_demo', 2021, 'DVQT', '12/QD-BTL', false, false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2022-01-15 10:00:00', NOW(), NOW()),
  ('dhdv009_demo', 'cqdv04_demo', 2022, 'DVQT', '15/QD-BTL', true,  false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2023-01-15 10:00:00', NOW(), NOW()),
  ('dhdv010_demo', 'cqdv04_demo', 2023, 'DVQT', '12/QD-BTL', false, false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2024-01-15 10:00:00', NOW(), NOW()),
  ('dhdv011_demo', 'cqdv04_demo', 2024, 'DVQT', '15/QD-BTL', true,  false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2025-01-15 10:00:00', NOW(), NOW()),
  ('dhdv012_demo', 'cqdv04_demo', 2025, 'DVQT', '12/QD-BTL', false, false, 'APPROVED', 'tk003_demo', 'tk002_demo', '2026-01-15 10:00:00', NOW(), NOW());

-- -----------------------------------------------------------------
-- 21. BangDeXuat — vài đề xuất ở các trạng thái khác nhau
-- -----------------------------------------------------------------
INSERT INTO "BangDeXuat" (id, co_quan_don_vi_id, don_vi_truc_thuoc_id, nguoi_de_xuat_id, loai_de_xuat, nam, thang, status, data_danh_hieu, ghi_chu, "createdAt", "updatedAt") VALUES
  -- Đề xuất PENDING — sẵn sàng cho admin duyệt trong V06
  ('bdx001_demo', 'cqdv01_demo', 'dvtt01_demo', 'tk003_demo', 'CA_NHAN_HANG_NAM', 2026, NULL, 'PENDING',
    '[{"personnel_id":"qn001_demo","danh_hieu":"BKBQP","cap_bac":"Thiếu tá","chuc_vu":"Phó trưởng ban","ghi_chu":""}]'::jsonb,
    'Đề xuất Bằng khen Bộ Quốc phòng cho đồng chí Trần Văn An',
    NOW(), NOW()),

  -- Đề xuất PENDING khác — sẵn sàng cho V07 reject
  ('bdx002_demo', 'cqdv01_demo', 'dvtt01_demo', 'tk003_demo', 'CA_NHAN_HANG_NAM', 2026, NULL, 'PENDING',
    '[{"personnel_id":"qn010_demo","danh_hieu":"BKBQP","cap_bac":"Đại úy","chuc_vu":"Cán bộ","ghi_chu":""}]'::jsonb,
    'Đề xuất Bằng khen Bộ Quốc phòng cho đồng chí Vũ Đình Lâm — chưa đủ điều kiện chuỗi',
    NOW(), NOW());

INSERT INTO "BangDeXuat" (id, co_quan_don_vi_id, don_vi_truc_thuoc_id, nguoi_de_xuat_id, loai_de_xuat, nam, thang, status, data_danh_hieu, nguoi_duyet_id, ngay_duyet, ghi_chu, "createdAt", "updatedAt") VALUES
  -- Đề xuất APPROVED — đã duyệt (tham chiếu lịch sử)
  ('bdx003_demo', 'cqdv01_demo', NULL, 'tk003_demo', 'CA_NHAN_HANG_NAM', 2025, NULL, 'APPROVED',
    '[{"personnel_id":"qn003_demo","danh_hieu":"CSTDTQ","cap_bac":"Thượng tá","chuc_vu":"Trưởng phòng","so_quyet_dinh":"08/QD-TTg"}]'::jsonb,
    'tk002_demo', '2025-09-10 14:00:00',
    'Đề xuất CSTDTQ năm 2024 cho đồng chí Lê Quang Cường — đã duyệt',
    NOW(), NOW()),

  -- Đề xuất REJECTED — đã từ chối với lý do
  ('bdx004_demo', 'cqdv02_demo', 'dvtt03_demo', 'tk003_demo', 'CA_NHAN_HANG_NAM', 2025, NULL, 'REJECTED',
    '[{"personnel_id":"qn015_demo","danh_hieu":"CSTDCS","cap_bac":"Trung tá","chuc_vu":"Cán bộ","ghi_chu":""}]'::jsonb,
    'tk002_demo', '2025-08-20 10:30:00',
    'Hồ sơ minh chứng chưa đầy đủ',
    NOW(), NOW());

UPDATE "BangDeXuat" SET rejection_reason = 'Hồ sơ minh chứng chưa đầy đủ, đề nghị bổ sung báo cáo thành tích chi tiết và xác nhận của cấp trên trực tiếp'
WHERE id = 'bdx004_demo';

-- Thêm 6 đề xuất nữa cho test list/filter UI
INSERT INTO "BangDeXuat" (id, co_quan_don_vi_id, don_vi_truc_thuoc_id, nguoi_de_xuat_id, loai_de_xuat, nam, thang, status, data_danh_hieu, data_thanh_tich, data_nien_han, data_cong_hien, ghi_chu, "createdAt", "updatedAt") VALUES
  ('bdx005_demo', 'cqdv01_demo', 'dvtt02_demo', 'tk003_demo', 'CA_NHAN_HANG_NAM', 2026, NULL, 'PENDING',
    '[{"personnel_id":"qn020_demo","danh_hieu":"BKBQP","cap_bac":"Trung tá","chuc_vu":"Phó trưởng phòng","ghi_chu":""}]'::jsonb, NULL, NULL, NULL,
    'Đề xuất Bằng khen Bộ Quốc phòng cho đồng chí Hoàng Thị Xuân', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('bdx006_demo', 'cqdv02_demo', 'dvtt03_demo', 'tk003_demo', 'NIEN_HAN', 2026, 5, 'PENDING',
    NULL, NULL,
    '[{"personnel_id":"qn007_demo","danh_hieu":"HCCSVV_HANG_BA","cap_bac":"Thiếu tá","chuc_vu":"Trưởng ban","nam_nhan":2026,"thang_nhan":5}]'::jsonb, NULL,
    'Đề xuất Huy chương Chiến sĩ Vẻ vang Hạng Ba — đủ niên hạn 10 năm', NOW() - INTERVAL '1 days', NOW() - INTERVAL '1 days'),
  ('bdx007_demo', 'cqdv02_demo', NULL, 'tk003_demo', 'CONG_HIEN', 2026, 5, 'PENDING',
    NULL, NULL, NULL,
    '[{"personnel_id":"qn005_demo","danh_hieu":"HCBVTQ_HANG_BA","cap_bac":"Thượng tá","chuc_vu":"Trưởng ban","nam_nhan":2026,"thang_nhan":5}]'::jsonb,
    'Đề xuất Huân chương Bảo vệ Tổ quốc Hạng Ba — cống hiến 277 tháng', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours');

INSERT INTO "BangDeXuat" (id, co_quan_don_vi_id, don_vi_truc_thuoc_id, nguoi_de_xuat_id, loai_de_xuat, nam, thang, status, data_danh_hieu, nguoi_duyet_id, ngay_duyet, ghi_chu, "createdAt", "updatedAt") VALUES
  ('bdx008_demo', 'cqdv01_demo', NULL, 'tk003_demo', 'CA_NHAN_HANG_NAM', 2024, NULL, 'APPROVED',
    '[{"personnel_id":"qn003_demo","danh_hieu":"BKBQP","cap_bac":"Thượng tá","chuc_vu":"Trưởng phòng","so_quyet_dinh":"15/QD-BTL"}]'::jsonb,
    'tk002_demo', '2024-09-15 10:00:00',
    'Đề xuất BKBQP cho đồng chí Lê Quang Cường năm 2024 — đã duyệt',
    '2024-08-20 14:30:00', '2024-09-15 10:00:00'),
  ('bdx009_demo', 'cqdv03_demo', 'dvtt05_demo', 'tk003_demo', 'NCKH', 2025, NULL, 'APPROVED',
    '[{"personnel_id":"qn008_demo","loai":"DTKH","mo_ta":"Đề tài hậu cần dã chiến","so_quyet_dinh":"22/QD-BTL"}]'::jsonb,
    'tk002_demo', '2025-12-20 09:30:00',
    'Đề xuất NCKH năm 2025 — đã duyệt',
    '2025-11-10 11:00:00', '2025-12-20 09:30:00'),
  ('bdx010_demo', 'cqdv02_demo', 'dvtt04_demo', 'tk003_demo', 'CA_NHAN_HANG_NAM', 2025, NULL, 'REJECTED',
    '[{"personnel_id":"qn019_demo","danh_hieu":"CSTDCS","cap_bac":"Thiếu tá","chuc_vu":"Cán bộ","ghi_chu":""}]'::jsonb,
    'tk002_demo', '2025-12-05 15:20:00',
    'Đề xuất CSTDCS năm 2024 — chưa đủ thời gian phục vụ',
    '2025-12-01 09:00:00', '2025-12-05 15:20:00');

UPDATE "BangDeXuat" SET rejection_reason = 'Quân nhân chưa đủ 12 tháng phục vụ tại đơn vị, không đủ điều kiện đề nghị danh hiệu Chiến sĩ Thi đua Cơ sở năm 2024'
WHERE id = 'bdx010_demo';

-- -----------------------------------------------------------------
-- 22. SystemLog — vài log mẫu (cho demo audit log)
-- -----------------------------------------------------------------
-- Format khớp với code thực tế trong helpers/auditLog/* (bám sát helper buildDescription)
INSERT INTO "SystemLog" (id, nguoi_thuc_hien_id, actor_role, action, resource, tai_nguyen_id, description, payload, ip_address, user_agent, "createdAt") VALUES
  ('sl001_demo', 'tk001_demo', 'SUPER_ADMIN', 'LOGIN',          'auth',         NULL,           'Đăng nhập hệ thống: superadmin_demo', NULL, '192.168.1.10', 'Mozilla/5.0', '2026-04-25 08:00:00'),
  ('sl002_demo', 'tk002_demo', 'ADMIN',       'CREATE',         'personnel',    'qn030_demo',   'Tạo quân nhân: Trần Thị Mai (CCCD: 001234001263)', '{"after":{"ho_ten":"Trần Thị Mai","cccd":"001234001263"}}'::jsonb, '192.168.1.11', 'Mozilla/5.0', '2026-04-25 09:15:00'),
  ('sl003_demo', 'tk003_demo', 'MANAGER',     'CREATE',         'proposals',    'bdx001_demo',  'Tạo đề xuất khen thưởng: Cá nhân hằng năm (1 quân nhân, năm 2026)', NULL, '192.168.1.12', 'Mozilla/5.0', '2026-04-25 10:30:00'),
  ('sl004_demo', 'tk002_demo', 'ADMIN',       'APPROVE',        'proposals',    'bdx003_demo',  'Phê duyệt đề xuất Cá nhân hằng năm năm 2025 do Nguyễn Văn Bình đề xuất (Khoa Ngoại ngữ)', '{"so_quyet_dinh":"08/QD-TTg"}'::jsonb, '192.168.1.11', 'Mozilla/5.0', '2025-09-10 14:00:00'),
  ('sl005_demo', 'tk002_demo', 'ADMIN',       'REJECT',         'proposals',    'bdx004_demo',  'Từ chối đề xuất Cá nhân hằng năm (năm 2025) do Nguyễn Văn Bình đề xuất (1 quân nhân) - Lý do: Hồ sơ minh chứng chưa đầy đủ', '{"reason":"Hồ sơ minh chứng chưa đầy đủ"}'::jsonb, '192.168.1.11', 'Mozilla/5.0', '2025-08-20 10:30:00'),
  ('sl006_demo', 'tk001_demo', 'SUPER_ADMIN', 'BACKUP', 'backup',       NULL,           'Sao lưu dữ liệu: backup_2026_04_01.sql (213 bản ghi, 4200 KB)', '{"file":"backup_2026_04_01.sql","size":4200000}'::jsonb, NULL, NULL, '2026-04-01 01:00:05'),
  ('sl007_demo', NULL,         'SYSTEM',      'RECALCULATE',         'profiles',     NULL,           'Tính lại hồ sơ hằng năm cho toàn bộ quân nhân (32 quân nhân)', '{"count":32,"duration_ms":4500}'::jsonb, NULL, NULL, '2026-04-25 02:00:00'),
  -- Log thêm cho 2 persona eligibility mới (QN-031 cycle 2, QN-032 lỡ đợt) + CQDV-04 BKTTCP đơn vị
  ('sl008_demo', 'tk002_demo', 'ADMIN',       'CREATE',         'units',        'cqdv04_demo',  'Tạo cơ quan đơn vị: Phòng Đào tạo (mã: PDT)', NULL, '192.168.1.11', 'Mozilla/5.0', '2019-01-10 09:00:00'),
  ('sl009_demo', 'tk002_demo', 'ADMIN',       'APPROVE',        'unit-annual-awards', 'dhdv007_demo', 'Phê duyệt danh hiệu Đơn vị Quyết thắng năm 2020 cho Phòng Đào tạo (BKBQP đơn vị lần 1)', NULL, '192.168.1.11', 'Mozilla/5.0', '2021-01-15 10:00:00'),
  ('sl010_demo', 'tk002_demo', 'ADMIN',       'APPROVE',        'unit-annual-awards', 'dhdv009_demo', 'Phê duyệt danh hiệu Đơn vị Quyết thắng năm 2022 cho Phòng Đào tạo (BKBQP đơn vị lần 2)', NULL, '192.168.1.11', 'Mozilla/5.0', '2023-01-15 10:00:00'),
  ('sl011_demo', 'tk002_demo', 'ADMIN',       'APPROVE',        'unit-annual-awards', 'dhdv011_demo', 'Phê duyệt danh hiệu Đơn vị Quyết thắng năm 2024 cho Phòng Đào tạo (BKBQP đơn vị lần 3)', NULL, '192.168.1.11', 'Mozilla/5.0', '2025-01-15 10:00:00'),
  ('sl012_demo', 'tk002_demo', 'ADMIN',       'APPROVE',        'proposals',    NULL,           'Phê duyệt đề xuất Cá nhân hằng năm năm 2022 do Vũ Quang Hậu đề xuất (Phòng Đào tạo) - CSTDTQ', NULL, '192.168.1.11', 'Mozilla/5.0', '2023-01-20 14:00:00'),
  ('sl013_demo', NULL,         'SYSTEM',      'RECALCULATE',         'profiles',     'qn031_demo',   'Tính lại hồ sơ cho 1 quân nhân: Vũ Quang Hậu', '{"trigger":"auto-after-approve","duration_ms":120}'::jsonb, NULL, NULL, '2026-04-25 02:01:00'),
  ('sl014_demo', NULL,         'SYSTEM',      'RECALCULATE',         'profiles',     'qn032_demo',   'Tính lại hồ sơ cho 1 quân nhân: Phan Thị Linh', '{"trigger":"auto-after-approve","duration_ms":135}'::jsonb, NULL, NULL, '2026-04-25 02:01:30'),
  ('sl015_demo', 'tk003_demo', 'MANAGER',     'LOGIN',          'auth',         NULL,           'Đăng nhập hệ thống: manager_demo', NULL, '192.168.1.12', 'Mozilla/5.0', '2026-04-26 08:45:00');

-- -----------------------------------------------------------------
-- 23. ThongBao — vài thông báo mẫu
-- -----------------------------------------------------------------
-- Format khớp code thực tế trong helpers/notification/proposals.ts (formatProposalType + tên admin/manager)
INSERT INTO "ThongBao" (id, nguoi_nhan_id, recipient_role, type, title, message, resource, tai_nguyen_id, link, is_read, nhat_ky_he_thong_id, "createdAt") VALUES
  ('tb001_demo', 'tk003_demo', 'MANAGER', 'PROPOSAL_APPROVED', 'Đề xuất đã được phê duyệt', 'Đề xuất khen thưởng cá nhân hằng năm của bạn đã được Lê Quang Cường phê duyệt', 'proposals', 'bdx003_demo', '/manager/proposals/bdx003_demo', true,  'sl004_demo', '2025-09-10 14:00:05'),
  ('tb002_demo', 'tk003_demo', 'MANAGER', 'PROPOSAL_REJECTED', 'Đề xuất bị từ chối',       'Đề xuất khen thưởng cá nhân hằng năm của bạn đã bị Lê Quang Cường từ chối. Lý do: Hồ sơ minh chứng chưa đầy đủ', 'proposals', 'bdx004_demo', '/manager/proposals/bdx004_demo', true,  'sl005_demo', '2025-08-20 10:30:05'),
  ('tb003_demo', 'tk002_demo', 'ADMIN',   'PROPOSAL_SUBMITTED','Đề xuất khen thưởng mới',   'Nguyễn Văn Bình đã gửi đề xuất khen thưởng cá nhân hằng năm', 'proposals', 'bdx001_demo', '/admin/proposals/review/bdx001_demo', false, 'sl003_demo', '2026-04-25 10:30:05'),
  ('tb004_demo', 'tk004_demo', 'USER',    'AWARD_ADDED',       'Bạn vừa được khen thưởng',  'Bạn đã được trao danh hiệu Chiến sĩ Thi đua Cơ sở năm 2025', 'annual-rewards', NULL, '/user/profile', false, NULL, '2026-01-10 09:00:00'),
  ('tb005_demo', 'tk001_demo', 'SUPER_ADMIN','PERSONNEL_ADDED','Quân nhân mới được thêm',  'Lê Quang Cường đã thêm quân nhân Trần Thị Mai (CCCD: 001234001263)', 'personnel', 'qn030_demo', '/super-admin/personnel/qn030_demo', false, 'sl002_demo', '2026-04-25 09:15:05'),
  -- Thông báo thêm cho 2 persona eligibility mới
  ('tb006_demo', 'tk003_demo', 'MANAGER', 'PROPOSAL_APPROVED', 'Đề xuất đã được phê duyệt', 'Đề xuất khen thưởng cá nhân hằng năm của bạn đã được Lê Quang Cường phê duyệt (Vũ Quang Hậu — CSTDTQ năm 2022)', 'proposals', NULL, '/manager/proposals', true, 'sl012_demo', '2023-01-20 14:00:05'),
  ('tb007_demo', 'tk003_demo', 'MANAGER','PROPOSAL_APPROVED','Đề xuất đã được phê duyệt','Đề xuất khen thưởng đơn vị hằng năm của bạn đã được Lê Quang Cường phê duyệt (Phòng Đào tạo — Đơn vị Quyết thắng năm 2024)', 'proposals', NULL, '/manager/proposals', false, 'sl011_demo', '2025-01-15 10:00:30');

-- =================================================================
-- BỔ SUNG — 8 PERSONA mới (QN-033..QN-040) đủ điều kiện đa dạng
-- =================================================================
-- QN-033: BKBQP eligible (giống QN-001) — Khoa Ngoại ngữ
-- QN-034: BKBQP eligible — Phòng Tham mưu
-- QN-035: BKBQP eligible — Phòng Hậu cần
-- QN-036: HCQKQT eligible (25y phục vụ, chưa nhận)
-- QN-037: HCQKQT eligible (28y phục vụ)
-- QN-038: KNC nam eligible (25y)
-- QN-039: HCCSVV Hạng Nhì eligible (15y)
-- QN-040: HCBVTQ Hạng Ba eligible (cống hiến)

INSERT INTO "QuanNhan" (id, cccd, ho_ten, gioi_tinh, ngay_sinh, que_quan_2_cap, tru_quan, ngay_nhap_ngu, ngay_vao_dang, so_dien_thoai, cap_bac, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id, "createdAt", "updatedAt") VALUES
  ('qn033_demo', '001234001266', 'Nguyễn Quốc Bảo',  'NAM', '1991-05-12', 'Xã Phúc Thành, tỉnh Bắc Giang', 'Hà Nội', '2014-09-01', '2016-08-01', '0912000033', 'Thiếu tá', 'cqdv01_demo', 'dvtt02_demo', 'cv15_demo', NOW(), NOW()),
  ('qn034_demo', '001234001267', 'Phan Văn Đức',     'NAM', '1990-08-22', 'Xã Quỳnh Phụ, tỉnh Thái Bình',  'Hà Nội', '2013-09-01', '2015-09-01', '0912000034', 'Trung tá', 'cqdv02_demo', 'dvtt03_demo', 'cv17_demo', NOW(), NOW()),
  ('qn035_demo', '001234001268', 'Trần Văn Hùng',    'NAM', '1989-11-30', 'Xã Cẩm Khê, tỉnh Phú Thọ',      'Hà Nội', '2012-09-01', '2014-08-01', '0912000035', 'Trung tá', 'cqdv03_demo', 'dvtt05_demo', 'cv19_demo', NOW(), NOW()),
  ('qn036_demo', '001234001269', 'Lê Minh Tuấn',     'NAM', '1976-04-08', 'Xã Thạch Hà, tỉnh Hà Tĩnh',     'Hà Nội', '2001-01-01', '2003-08-01', '0912000036', 'Đại tá',   'cqdv02_demo', NULL,           'cv04_demo', NOW(), NOW()),
  ('qn037_demo', '001234001270', 'Vũ Đức Mạnh',      'NAM', '1973-09-15', 'Xã Yên Khánh, tỉnh Ninh Bình',  'Hà Nội', '1998-09-01', '2000-12-01', '0912000037', 'Đại tá',   'cqdv01_demo', NULL,           'cv02_demo', NOW(), NOW()),
  ('qn038_demo', '001234001271', 'Hoàng Văn Sơn',    'NAM', '1976-06-20', 'Xã Phúc Hòa, tỉnh Bắc Giang',   'Hà Nội', '2001-01-01', '2003-04-01', '0912000038', 'Đại tá',   'cqdv03_demo', NULL,           'cv05_demo', NOW(), NOW()),
  ('qn039_demo', '001234001272', 'Đặng Thanh Long',  'NAM', '1986-02-14', 'Xã An Lão, tỉnh Hải Phòng',     'Hà Nội', '2009-09-01', '2011-09-01', '0912000039', 'Trung tá', 'cqdv02_demo', 'dvtt04_demo', 'cv18_demo', NOW(), NOW()),
  ('qn040_demo', '001234001273', 'Bùi Quốc Việt',    'NAM', '1980-10-25', 'Xã Hoài Đức, TP Hà Nội',         'Hà Nội', '2003-09-01', '2005-08-01', '0912000040', 'Thượng tá', 'cqdv03_demo', 'dvtt06_demo', 'cv20_demo', NOW(), NOW());

-- DanhHieuHangNam cho 8 persona mới (chuỗi CSTDCS đầy đủ + so_quyet_dinh)
INSERT INTO "DanhHieuHangNam" (id, quan_nhan_id, nam, danh_hieu, cap_bac, chuc_vu, so_quyet_dinh, nhan_bkbqp, nhan_cstdtq, nhan_bkttcp, "createdAt", "updatedAt") VALUES
  -- QN-033: 2 năm CSTDCS liên tục (2024+2025) + NCKH 2024+2025 → BKBQP eligible
  ('dhhn070_demo', 'qn033_demo', 2024, 'CSTDCS', 'Thiếu tá', 'Cán bộ', '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn071_demo', 'qn033_demo', 2025, 'CSTDCS', 'Thiếu tá', 'Cán bộ', '12/QD-BTL', false, false, false, NOW(), NOW()),
  -- QN-034: 2 năm CSTDCS + NCKH → BKBQP eligible
  ('dhhn072_demo', 'qn034_demo', 2024, 'CSTDCS', 'Trung tá', 'Cán bộ', '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn073_demo', 'qn034_demo', 2025, 'CSTDCS', 'Trung tá', 'Cán bộ', '12/QD-BTL', false, false, false, NOW(), NOW()),
  -- QN-035: 2 năm CSTDCS + NCKH → BKBQP eligible
  ('dhhn074_demo', 'qn035_demo', 2024, 'CSTDCS', 'Trung tá', 'Trưởng ban', '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn075_demo', 'qn035_demo', 2025, 'CSTDCS', 'Trung tá', 'Trưởng ban', '12/QD-BTL', false, false, false, NOW(), NOW()),
  -- QN-036, 037, 038, 039, 040: vài CSTDCS rải rác (không demo chuỗi cá nhân)
  ('dhhn076_demo', 'qn036_demo', 2025, 'CSTDCS', 'Đại tá',   'Phó trưởng phòng', '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn077_demo', 'qn037_demo', 2025, 'CSTDCS', 'Đại tá',   'Phó trưởng phòng', '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn078_demo', 'qn038_demo', 2025, 'CSTDCS', 'Đại tá',   'Trưởng phòng',     '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn079_demo', 'qn039_demo', 2024, 'CSTDCS', 'Trung tá', 'Trưởng ban',       '12/QD-BTL', false, false, false, NOW(), NOW()),
  ('dhhn080_demo', 'qn040_demo', 2025, 'CSTDCS', 'Thượng tá','Trưởng ban',       '12/QD-BTL', false, false, false, NOW(), NOW());

-- ThanhTichKhoaHoc — NCKH liên tục 2024+2025 cho 3 BKBQP eligibles
INSERT INTO "ThanhTichKhoaHoc" (id, quan_nhan_id, nam, loai, mo_ta, cap_bac, chuc_vu, so_quyet_dinh, "createdAt", "updatedAt") VALUES
  ('ttkh050_demo', 'qn033_demo', 2024, 'DTKH', 'Đề tài cải tiến giảng dạy ngoại ngữ',          'Thiếu tá', 'Cán bộ',     '22/QD-BTL', NOW(), NOW()),
  ('ttkh051_demo', 'qn033_demo', 2025, 'SKKH', 'Sáng kiến tổ chức kiểm tra trình độ ngoại ngữ', 'Thiếu tá', 'Cán bộ',     '22/QD-BTL', NOW(), NOW()),
  ('ttkh052_demo', 'qn034_demo', 2024, 'DTKH', 'Đề tài về tham mưu chiến thuật cấp tiểu đoàn', 'Trung tá', 'Cán bộ',     '22/QD-BTL', NOW(), NOW()),
  ('ttkh053_demo', 'qn034_demo', 2025, 'DTKH', 'Đề tài cải tiến phương án bảo vệ',             'Trung tá', 'Cán bộ',     '22/QD-BTL', NOW(), NOW()),
  ('ttkh054_demo', 'qn035_demo', 2024, 'SKKH', 'Sáng kiến quản lý kho quân nhu',                'Trung tá', 'Trưởng ban', '22/QD-BTL', NOW(), NOW()),
  ('ttkh055_demo', 'qn035_demo', 2025, 'SKKH', 'Sáng kiến tiết kiệm xăng dầu trong huấn luyện', 'Trung tá', 'Trưởng ban', '22/QD-BTL', NOW(), NOW());

-- LichSuChucVu — feed cho HCQKQT/KNC/HCCSVV/HCBVTQ
INSERT INTO "LichSuChucVu" (id, quan_nhan_id, chuc_vu_id, he_so_chuc_vu, ngay_bat_dau, ngay_ket_thuc, so_thang, "createdAt", "updatedAt") VALUES
  -- QN-036: 25y (2001-2026), HCQKQT eligible
  ('lscv030_demo', 'qn036_demo', 'cv13_demo', 0.70, '2003-08-01', '2014-12-31', 137, NOW(), NOW()),
  ('lscv031_demo', 'qn036_demo', 'cv04_demo', 0.90, '2015-01-01', NULL,         NULL, NOW(), NOW()),
  -- QN-037: 28y (1998-2026), HCQKQT eligible (đã có HCCSVV 3 hạng)
  ('lscv032_demo', 'qn037_demo', 'cv13_demo', 0.70, '2000-09-01', '2010-12-31', 124, NOW(), NOW()),
  ('lscv033_demo', 'qn037_demo', 'cv02_demo', 0.90, '2011-01-01', NULL,         NULL, NOW(), NOW()),
  -- QN-038: 25y (2001-2026), KNC nam eligible
  ('lscv034_demo', 'qn038_demo', 'cv13_demo', 0.70, '2003-04-01', '2014-12-31', 141, NOW(), NOW()),
  ('lscv035_demo', 'qn038_demo', 'cv05_demo', 1.00, '2015-01-01', NULL,         NULL, NOW(), NOW()),
  -- QN-039: 17y (2009-2026), HCCSVV Hạng Nhì 15y eligible
  ('lscv036_demo', 'qn039_demo', 'cv13_demo', 0.70, '2011-09-01', '2018-12-31',  88, NOW(), NOW()),
  ('lscv037_demo', 'qn039_demo', 'cv18_demo', 0.90, '2019-01-01', NULL,         NULL, NOW(), NOW()),
  -- QN-040: 23y (2003-2026), HCBVTQ Hạng Ba (cong hien) eligible
  ('lscv038_demo', 'qn040_demo', 'cv13_demo', 0.70, '2005-08-01', '2018-12-31', 161, NOW(), NOW()),
  ('lscv039_demo', 'qn040_demo', 'cv20_demo', 0.90, '2019-01-01', NULL,         NULL, NOW(), NOW());

-- HCQKQT records (3 quân nhân đã nhận, để demo lịch sử) + 0 (để 2 persona đủ ĐK demo đề xuất)
INSERT INTO "HuanChuongQuanKyQuyetThang" (id, quan_nhan_id, nam, thang, cap_bac, chuc_vu, so_quyet_dinh, thoi_gian, "createdAt", "updatedAt") VALUES
  ('khqk010_demo', 'qn008_demo', 2026, 5, 'Đại tá', 'Trưởng phòng', '11/QD-BQP', '{"total_months":300,"years":25,"months":0,"display":"25 năm"}'::jsonb, NOW(), NOW());
-- Note: khqk001_demo (qn004) đã insert ở seed gốc. Thêm record này cho QN-008 (25y phục vụ).

-- KNC records (1 đã nhận cho lịch sử demo)
INSERT INTO "KyNiemChuongVSNXDQDNDVN" (id, quan_nhan_id, nam, thang, cap_bac, chuc_vu, so_quyet_dinh, thoi_gian, "createdAt", "updatedAt") VALUES
  ('knc001_demo', 'qn009_demo', 2026, 5, 'Trung tá', 'Trưởng ban', '14/QD-BQP', '{"total_months":240,"years":20,"months":0,"display":"20 năm"}'::jsonb, NOW(), NOW());

-- HCCSVV niên hạn — QN-037 đã có 3 hạng (10y, 15y, 20y) — để demo đầy đủ chuỗi
INSERT INTO "KhenThuongHCCSVV" (id, quan_nhan_id, danh_hieu, nam, thang, cap_bac, chuc_vu, so_quyet_dinh, thoi_gian, "createdAt", "updatedAt") VALUES
  ('khcs010_demo', 'qn037_demo', 'HCCSVV_HANG_BA',  2010, 9, 'Trung tá',  'Cán bộ',           '20/QD-BTL', '{"total_months":120,"years":10,"months":0,"display":"10 năm"}'::jsonb, NOW(), NOW()),
  ('khcs011_demo', 'qn037_demo', 'HCCSVV_HANG_NHI', 2015, 9, 'Trung tá',  'Phó trưởng phòng', '20/QD-BTL', '{"total_months":180,"years":15,"months":0,"display":"15 năm"}'::jsonb, NOW(), NOW()),
  ('khcs012_demo', 'qn037_demo', 'HCCSVV_HANG_NHAT',2020, 9, 'Đại tá',    'Phó trưởng phòng', '20/QD-BTL', '{"total_months":240,"years":20,"months":0,"display":"20 năm"}'::jsonb, NOW(), NOW());

-- HoSoNienHan + HoSoCongHien + HoSoHangNam cho personas mới
INSERT INTO "HoSoNienHan" (id, quan_nhan_id, hccsvv_hang_ba_status, hccsvv_hang_ba_ngay, hccsvv_hang_nhi_status, hccsvv_hang_nhi_ngay, hccsvv_hang_nhat_status, hccsvv_hang_nhat_ngay, goi_y, "createdAt", "updatedAt") VALUES
  ('hsnh010_demo', 'qn033_demo', 'CHUA_DU',      NULL,        'CHUA_DU',      NULL,        'CHUA_DU',      NULL,        'Chưa đủ niên hạn 10 năm phục vụ',                         NOW(), NOW()),
  ('hsnh011_demo', 'qn034_demo', 'DU_DIEU_KIEN', NULL,        'CHUA_DU',      NULL,        'CHUA_DU',      NULL,        'Đủ điều kiện đề nghị HCCSVV Hạng Ba (đã 12 năm phục vụ)', NOW(), NOW()),
  ('hsnh012_demo', 'qn036_demo', 'DU_DIEU_KIEN', NULL,        'DU_DIEU_KIEN', NULL,        'DU_DIEU_KIEN', NULL,        'Đủ điều kiện đề nghị HCCSVV Hạng Nhất (đã 25 năm phục vụ)', NOW(), NOW()),
  ('hsnh013_demo', 'qn037_demo', 'DA_NHAN',      '2010-09-01','DA_NHAN',      '2015-09-01','DA_NHAN',      '2020-09-01','Đã nhận HCCSVV Hạng Nhất năm 2020 (28 năm phục vụ)',     NOW(), NOW()),
  ('hsnh014_demo', 'qn038_demo', 'DU_DIEU_KIEN', NULL,        'DU_DIEU_KIEN', NULL,        'DU_DIEU_KIEN', NULL,        'Đủ điều kiện đề nghị HCCSVV Hạng Nhất (đã 25 năm phục vụ)', NOW(), NOW()),
  ('hsnh015_demo', 'qn039_demo', 'DA_NHAN',      '2021-09-01','DU_DIEU_KIEN', NULL,        'CHUA_DU',      NULL,        'Đã có Hạng Ba. Đủ điều kiện đề nghị Hạng Nhì (15 năm phục vụ)', NOW(), NOW()),
  ('hsnh016_demo', 'qn040_demo', 'DU_DIEU_KIEN', NULL,        'DU_DIEU_KIEN', NULL,        'CHUA_DU',      NULL,        'Đủ điều kiện đề nghị HCCSVV Hạng Nhì (22 năm phục vụ)',  NOW(), NOW());

INSERT INTO "HoSoCongHien" (id, quan_nhan_id, hcbvtq_total_months, months_07, months_08, months_0910, hcbvtq_hang_ba_status, hcbvtq_hang_ba_ngay, hcbvtq_hang_nhi_status, hcbvtq_hang_nhi_ngay, hcbvtq_hang_nhat_status, hcbvtq_hang_nhat_ngay, goi_y, "createdAt", "updatedAt") VALUES
  -- QN-040: 23 năm với he_so 0.7 (16y) + 0.9 (7y) → đủ Hạng Ba
  ('hsch020_demo', 'qn040_demo', 245, 161,  0,  84, 'DU_DIEU_KIEN', NULL, 'CHUA_DU', NULL, 'CHUA_DU', NULL, 'Đủ điều kiện đề nghị HCBVTQ Hạng Ba — đã đạt 245 tháng tổng', NOW(), NOW()),
  -- QN-036: 25 năm hệ số 0.7 + 0.9 → đủ Hạng Nhì
  ('hsch021_demo', 'qn036_demo', 274, 137,  0, 137, 'DU_DIEU_KIEN', NULL, 'DU_DIEU_KIEN', NULL, 'DU_DIEU_KIEN', NULL, 'Đủ điều kiện đề nghị HCBVTQ Hạng Nhất (137 tháng hệ số 0.9-1.0)', NOW(), NOW());

INSERT INTO "HoSoHangNam" (id, quan_nhan_id, tong_cstdcs, tong_nckh, cstdcs_lien_tuc, nckh_lien_tuc, bkbqp_lien_tuc, cstdtq_lien_tuc, du_dieu_kien_bkbqp, du_dieu_kien_cstdtq, du_dieu_kien_bkttcp, goi_y, "createdAt", "updatedAt") VALUES
  ('hshn020_demo', 'qn033_demo', 2, 2, 2, 2, 0, 0, true,  false, false, 'Đủ điều kiện đề nghị Bằng khen Bộ Quốc phòng năm 2026 (CSTDCS 2024+2025 + NCKH liên tục)', NOW(), NOW()),
  ('hshn021_demo', 'qn034_demo', 2, 2, 2, 2, 0, 0, true,  false, false, 'Đủ điều kiện đề nghị Bằng khen Bộ Quốc phòng năm 2026', NOW(), NOW()),
  ('hshn022_demo', 'qn035_demo', 2, 2, 2, 2, 0, 0, true,  false, false, 'Đủ điều kiện đề nghị Bằng khen Bộ Quốc phòng năm 2026', NOW(), NOW()),
  ('hshn023_demo', 'qn036_demo', 1, 0, 1, 0, 0, 0, false, false, false, 'Đủ điều kiện đề nghị HCQKQT (25 năm) và HCBVTQ Hạng Nhất (cống hiến)', NOW(), NOW()),
  ('hshn024_demo', 'qn037_demo', 1, 0, 1, 0, 0, 0, false, false, false, 'Đủ điều kiện đề nghị HCQKQT (28 năm phục vụ). Đã có HCCSVV Hạng Nhất.', NOW(), NOW()),
  ('hshn025_demo', 'qn038_demo', 1, 0, 1, 0, 0, 0, false, false, false, 'Đủ điều kiện đề nghị KNC VSNXD QĐNDVN (25 năm phục vụ).', NOW(), NOW()),
  ('hshn026_demo', 'qn039_demo', 1, 0, 1, 0, 0, 0, false, false, false, 'Đủ điều kiện đề nghị HCCSVV Hạng Nhì (đã có Hạng Ba từ 2021).', NOW(), NOW()),
  ('hshn027_demo', 'qn040_demo', 1, 0, 1, 0, 0, 0, false, false, false, 'Đủ điều kiện đề nghị HCCSVV Hạng Nhì và HCBVTQ Hạng Ba (cống hiến).', NOW(), NOW());

-- Logs cho 8 persona mới (CREATE personnel)
INSERT INTO "SystemLog" (id, nguoi_thuc_hien_id, actor_role, action, resource, tai_nguyen_id, description, ip_address, user_agent, "createdAt") VALUES
  ('sl100_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn033_demo', 'Tạo quân nhân: Nguyễn Quốc Bảo (CCCD: 001234001266)',  '192.168.1.11', 'Mozilla/5.0', '2024-02-10 09:00:00'),
  ('sl101_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn034_demo', 'Tạo quân nhân: Phan Văn Đức (CCCD: 001234001267)',     '192.168.1.11', 'Mozilla/5.0', '2024-02-10 09:15:00'),
  ('sl102_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn035_demo', 'Tạo quân nhân: Trần Văn Hùng (CCCD: 001234001268)',    '192.168.1.11', 'Mozilla/5.0', '2024-02-10 09:30:00'),
  ('sl103_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn036_demo', 'Tạo quân nhân: Lê Minh Tuấn (CCCD: 001234001269)',     '192.168.1.11', 'Mozilla/5.0', '2024-02-12 10:00:00'),
  ('sl104_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn037_demo', 'Tạo quân nhân: Vũ Đức Mạnh (CCCD: 001234001270)',      '192.168.1.11', 'Mozilla/5.0', '2024-02-12 10:15:00'),
  ('sl105_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn038_demo', 'Tạo quân nhân: Hoàng Văn Sơn (CCCD: 001234001271)',    '192.168.1.11', 'Mozilla/5.0', '2024-02-12 10:30:00'),
  ('sl106_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn039_demo', 'Tạo quân nhân: Đặng Thanh Long (CCCD: 001234001272)',  '192.168.1.11', 'Mozilla/5.0', '2024-02-15 11:00:00'),
  ('sl107_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn040_demo', 'Tạo quân nhân: Bùi Quốc Việt (CCCD: 001234001273)',    '192.168.1.11', 'Mozilla/5.0', '2024-02-15 11:15:00'),
  -- Logs cho việc trao HCQKQT cho QN-008 (đã thêm record khqk010)
  ('sl110_demo', 'tk002_demo', 'ADMIN', 'APPROVE', 'proposals', NULL, 'Phê duyệt đề xuất Huy chương Quân kỳ quyết thắng năm 2026 do Nguyễn Văn Bình đề xuất (Khoa Ngoại ngữ)', '192.168.1.11', 'Mozilla/5.0', '2026-05-15 10:00:00'),
  ('sl111_demo', 'tk002_demo', 'ADMIN', 'APPROVE', 'proposals', NULL, 'Phê duyệt đề xuất Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN năm 2026 do Nguyễn Văn Bình đề xuất (Khoa Ngoại ngữ)', '192.168.1.11', 'Mozilla/5.0', '2026-05-20 14:00:00'),
  ('sl112_demo', 'tk002_demo', 'ADMIN', 'APPROVE', 'proposals', NULL, 'Phê duyệt đề xuất Huy chương Chiến sĩ vẻ vang năm 2020 do đơn vị đề xuất cho 1 quân nhân', '192.168.1.11', 'Mozilla/5.0', '2020-09-01 10:00:00');

-- Notifications cho personas mới (PERSONNEL_ADDED to SUPER_ADMIN)
INSERT INTO "ThongBao" (id, nguoi_nhan_id, recipient_role, type, title, message, resource, tai_nguyen_id, link, is_read, nhat_ky_he_thong_id, "createdAt") VALUES
  ('tb100_demo', 'tk001_demo', 'SUPER_ADMIN', 'PERSONNEL_ADDED', 'Quân nhân mới được thêm', 'Lê Quang Cường đã thêm quân nhân Nguyễn Quốc Bảo (CCCD: 001234001266)', 'personnel', 'qn033_demo', '/super-admin/personnel/qn033_demo', true, 'sl100_demo', '2024-02-10 09:00:30'),
  ('tb101_demo', 'tk001_demo', 'SUPER_ADMIN', 'PERSONNEL_ADDED', 'Quân nhân mới được thêm', 'Lê Quang Cường đã thêm quân nhân Lê Minh Tuấn (CCCD: 001234001269)',  'personnel', 'qn036_demo', '/super-admin/personnel/qn036_demo', true, 'sl103_demo', '2024-02-12 10:00:30'),
  ('tb102_demo', 'tk001_demo', 'SUPER_ADMIN', 'PERSONNEL_ADDED', 'Quân nhân mới được thêm', 'Lê Quang Cường đã thêm quân nhân Vũ Đức Mạnh (CCCD: 001234001270)',  'personnel', 'qn037_demo', '/super-admin/personnel/qn037_demo', true, 'sl104_demo', '2024-02-12 10:15:30'),
  -- AWARD_ADDED cho QN-008 nhận HCQKQT
  ('tb103_demo', NULL, 'USER', 'AWARD_ADDED', 'Bạn đã nhận khen thưởng', 'Lê Quang Cường đã thêm Huy chương Quân kỳ quyết thắng năm 2026 cho bạn',         'awards', 'khqk010_demo', '/user/profile', false, NULL, '2026-05-15 10:00:30'),
  ('tb104_demo', NULL, 'USER', 'AWARD_ADDED', 'Bạn đã nhận khen thưởng', 'Lê Quang Cường đã thêm Kỷ niệm chương VSNXD QĐNDVN năm 2026 cho bạn',           'awards', 'knc001_demo',  '/user/profile', false, NULL, '2026-05-20 14:00:30');

-- =================================================================
-- BỔ SUNG — 5 đề xuất multi-person khai thác QN-033..QN-040
-- Đa dạng loại khen thưởng + nhiều quân nhân/đề xuất + chronological
-- =================================================================

-- ===== 2026-04-28: Đề xuất BKBQP đa người (3 QN đủ ĐK) — PENDING =====
INSERT INTO "BangDeXuat" (id, co_quan_don_vi_id, don_vi_truc_thuoc_id, nguoi_de_xuat_id, loai_de_xuat, nam, thang, status, data_danh_hieu, ghi_chu, "createdAt", "updatedAt") VALUES
  ('bdx020_demo', 'cqdv01_demo', 'dvtt02_demo', 'tk003_demo', 'CA_NHAN_HANG_NAM', 2026, NULL, 'PENDING',
    '[
      {"personnel_id":"qn033_demo","danh_hieu":"BKBQP","cap_bac":"Thiếu tá","chuc_vu":"Cán bộ","ghi_chu":""},
      {"personnel_id":"qn034_demo","danh_hieu":"BKBQP","cap_bac":"Trung tá","chuc_vu":"Cán bộ","ghi_chu":""},
      {"personnel_id":"qn035_demo","danh_hieu":"BKBQP","cap_bac":"Trung tá","chuc_vu":"Trưởng ban","ghi_chu":""}
    ]'::jsonb,
    'Đề xuất Bằng khen Bộ trưởng Bộ Quốc phòng cho 3 quân nhân đủ chuỗi 2 năm CSTĐCS + NCKH liên tục',
    '2026-04-28 09:00:00', '2026-04-28 09:00:00');

-- ===== 2026-04-29: Đề xuất HCQKQT 2 QN đủ 25y phục vụ — PENDING =====
INSERT INTO "BangDeXuat" (id, co_quan_don_vi_id, don_vi_truc_thuoc_id, nguoi_de_xuat_id, loai_de_xuat, nam, thang, status, data_nien_han, ghi_chu, "createdAt", "updatedAt") VALUES
  ('bdx021_demo', 'cqdv02_demo', NULL, 'tk003_demo', 'HC_QKQT', 2026, 5, 'PENDING',
    '[
      {"personnel_id":"qn036_demo","cap_bac":"Đại tá","chuc_vu":"Phó trưởng phòng","nam_nhan":2026,"thang_nhan":5},
      {"personnel_id":"qn037_demo","cap_bac":"Đại tá","chuc_vu":"Phó trưởng phòng","nam_nhan":2026,"thang_nhan":5}
    ]'::jsonb,
    'Đề xuất Huy chương Quân kỳ quyết thắng — 2 quân nhân đủ 25-28 năm phục vụ',
    '2026-04-29 14:00:00', '2026-04-29 14:00:00');

-- ===== 2026-04-30: Đề xuất KNC nam 25y — PENDING =====
INSERT INTO "BangDeXuat" (id, co_quan_don_vi_id, don_vi_truc_thuoc_id, nguoi_de_xuat_id, loai_de_xuat, nam, thang, status, data_nien_han, ghi_chu, "createdAt", "updatedAt") VALUES
  ('bdx022_demo', 'cqdv03_demo', NULL, 'tk003_demo', 'KNC_VSNXD_QDNDVN', 2026, 6, 'PENDING',
    '[
      {"personnel_id":"qn038_demo","cap_bac":"Đại tá","chuc_vu":"Trưởng phòng","nam_nhan":2026,"thang_nhan":6}
    ]'::jsonb,
    'Đề xuất Kỷ niệm chương VSNXD QĐNDVN — đồng chí Hoàng Văn Sơn (nam, 25 năm phục vụ)',
    '2026-04-30 10:30:00', '2026-04-30 10:30:00');

-- ===== 2026-05-01: Đề xuất HCCSVV nâng hạng + cấp mới — PENDING =====
INSERT INTO "BangDeXuat" (id, co_quan_don_vi_id, don_vi_truc_thuoc_id, nguoi_de_xuat_id, loai_de_xuat, nam, thang, status, data_nien_han, ghi_chu, "createdAt", "updatedAt") VALUES
  ('bdx023_demo', 'cqdv02_demo', 'dvtt04_demo', 'tk003_demo', 'NIEN_HAN', 2026, 5, 'PENDING',
    '[
      {"personnel_id":"qn039_demo","danh_hieu":"HCCSVV_HANG_NHI","cap_bac":"Trung tá","chuc_vu":"Trưởng ban","nam_nhan":2026,"thang_nhan":5,"ghi_chu":"Đã có Hạng Ba từ 2021 — đề nghị nâng Hạng Nhì"},
      {"personnel_id":"qn040_demo","danh_hieu":"HCCSVV_HANG_NHI","cap_bac":"Thượng tá","chuc_vu":"Trưởng ban","nam_nhan":2026,"thang_nhan":5,"ghi_chu":"22 năm phục vụ"}
    ]'::jsonb,
    'Đề xuất HCCSVV Hạng Nhì cho 2 quân nhân (1 nâng hạng, 1 cấp mới)',
    '2026-05-01 09:00:00', '2026-05-01 09:00:00');

-- ===== 2026-05-02: Đề xuất HCBVTQ Hạng Ba cống hiến — PENDING =====
INSERT INTO "BangDeXuat" (id, co_quan_don_vi_id, don_vi_truc_thuoc_id, nguoi_de_xuat_id, loai_de_xuat, nam, thang, status, data_cong_hien, ghi_chu, "createdAt", "updatedAt") VALUES
  ('bdx024_demo', 'cqdv03_demo', 'dvtt06_demo', 'tk003_demo', 'CONG_HIEN', 2026, 5, 'PENDING',
    '[
      {"personnel_id":"qn040_demo","danh_hieu":"HCBVTQ_HANG_BA","cap_bac":"Thượng tá","chuc_vu":"Trưởng ban","nam_nhan":2026,"thang_nhan":5,"ghi_chu":"245 tháng cống hiến"}
    ]'::jsonb,
    'Đề xuất Huân chương Bảo vệ Tổ quốc Hạng Ba — đồng chí Bùi Quốc Việt',
    '2026-05-02 11:00:00', '2026-05-02 11:00:00');

-- Logs CREATE proposal cho 5 đề xuất mới (format khớp helpers/auditLog/proposals.ts)
INSERT INTO "SystemLog" (id, nguoi_thuc_hien_id, actor_role, action, resource, tai_nguyen_id, description, ip_address, user_agent, "createdAt") VALUES
  ('sl120_demo', 'tk003_demo', 'MANAGER', 'CREATE', 'proposals', 'bdx020_demo', 'Tạo đề xuất khen thưởng: Cá nhân hằng năm (3 quân nhân, năm 2026)',                  '192.168.1.12', 'Mozilla/5.0', '2026-04-28 09:00:30'),
  ('sl121_demo', 'tk003_demo', 'MANAGER', 'CREATE', 'proposals', 'bdx021_demo', 'Tạo đề xuất khen thưởng: Huy chương Quân kỳ quyết thắng (2 quân nhân, năm 2026)',  '192.168.1.12', 'Mozilla/5.0', '2026-04-29 14:00:30'),
  ('sl122_demo', 'tk003_demo', 'MANAGER', 'CREATE', 'proposals', 'bdx022_demo', 'Tạo đề xuất khen thưởng: Kỷ niệm chương VSNXD QĐNDVN (1 quân nhân, năm 2026)',     '192.168.1.12', 'Mozilla/5.0', '2026-04-30 10:30:30'),
  ('sl123_demo', 'tk003_demo', 'MANAGER', 'CREATE', 'proposals', 'bdx023_demo', 'Tạo đề xuất khen thưởng: Huy chương Chiến sĩ vẻ vang (2 quân nhân, năm 2026)',     '192.168.1.12', 'Mozilla/5.0', '2026-05-01 09:00:30'),
  ('sl124_demo', 'tk003_demo', 'MANAGER', 'CREATE', 'proposals', 'bdx024_demo', 'Tạo đề xuất khen thưởng: Huân chương Bảo vệ Tổ quốc (1 quân nhân, năm 2026)',      '192.168.1.12', 'Mozilla/5.0', '2026-05-02 11:00:30');

-- Notifications PROPOSAL_SUBMITTED → ADMIN cho 5 đề xuất mới
INSERT INTO "ThongBao" (id, nguoi_nhan_id, recipient_role, type, title, message, resource, tai_nguyen_id, link, is_read, nhat_ky_he_thong_id, "createdAt") VALUES
  ('tb120_demo', 'tk002_demo', 'ADMIN', 'PROPOSAL_SUBMITTED', 'Đề xuất khen thưởng mới', 'Nguyễn Văn Bình đã gửi đề xuất khen thưởng cá nhân hằng năm',                'proposals', 'bdx020_demo', '/admin/proposals/review/bdx020_demo', false, 'sl120_demo', '2026-04-28 09:01:00'),
  ('tb121_demo', 'tk002_demo', 'ADMIN', 'PROPOSAL_SUBMITTED', 'Đề xuất khen thưởng mới', 'Nguyễn Văn Bình đã gửi đề xuất khen thưởng huy chương quân kỳ quyết thắng', 'proposals', 'bdx021_demo', '/admin/proposals/review/bdx021_demo', false, 'sl121_demo', '2026-04-29 14:01:00'),
  ('tb122_demo', 'tk002_demo', 'ADMIN', 'PROPOSAL_SUBMITTED', 'Đề xuất khen thưởng mới', 'Nguyễn Văn Bình đã gửi đề xuất khen thưởng kỷ niệm chương vsnxd qđndvn',    'proposals', 'bdx022_demo', '/admin/proposals/review/bdx022_demo', false, 'sl122_demo', '2026-04-30 10:31:00'),
  ('tb123_demo', 'tk002_demo', 'ADMIN', 'PROPOSAL_SUBMITTED', 'Đề xuất khen thưởng mới', 'Nguyễn Văn Bình đã gửi đề xuất khen thưởng huy chương chiến sĩ vẻ vang',    'proposals', 'bdx023_demo', '/admin/proposals/review/bdx023_demo', false, 'sl123_demo', '2026-05-01 09:01:00'),
  ('tb124_demo', 'tk002_demo', 'ADMIN', 'PROPOSAL_SUBMITTED', 'Đề xuất khen thưởng mới', 'Nguyễn Văn Bình đã gửi đề xuất khen thưởng huân chương bảo vệ tổ quốc',    'proposals', 'bdx024_demo', '/admin/proposals/review/bdx024_demo', false, 'sl124_demo', '2026-05-02 11:01:00');

COMMIT;

-- =================================================================
-- KẾT THÚC SEED
-- =================================================================
-- Tổng số bản ghi đã insert:
--   • SystemSetting:               5
--   • CoQuanDonVi:                 4 (+ Phòng Đào tạo cho BKTTCP đơn vị)
--   • DonViTrucThuoc:              7
--   • ChucVu:                      17
--   • FileQuyetDinh:               10
--   • QuanNhan:                   32 (+ QN-031 CSTDTQ cycle 2 + QN-032 lỡ đợt)
--   • TaiKhoan:                    4
--   • LichSuChucVu:                19
--   • ThanhTichKhoaHoc:            29 (+ 14 NCKH cho 2 persona mới)
--   • DanhHieuHangNam:             54 (+ 14 record cho 2 persona mới)
--   • KhenThuongHCBVTQ:            1
--   • KhenThuongHCCSVV:            2
--   • HuanChuongQuanKyQuyetThang:  1
--   • KyNiemChuongVSNXDQDNDVN:     0 (để demo cấp mới)
--   • KhenThuongDotXuat:           9 (3 tập thể + 6 cá nhân)
--   • HoSoNienHan:                 9
--   • HoSoCongHien:                7
--   • HoSoHangNam:                15 (+ QN-031, QN-032)
--   • HoSoDonViHangNam:            6 (+ CQDV-04 đủ BKTTCP đơn vị)
--   • DanhHieuDonViHangNam:       12 (+ chuỗi 7y ĐVQT + 3 BKBQP cho CQDV-04)
--   • BangDeXuat:                 10 (3 PENDING + 4 APPROVED + 3 REJECTED)
--   • SystemLog:                  25 (đa dạng action: LOGIN/CREATE/UPDATE/DELETE/IMPORT/EXPORT/BACKUP/RECALC)
--   • ThongBao:                   18 (mix read/unread, 4 vai trò)
--   ─────────────────────────────────
--   TỔNG:                         ~250 bản ghi
--
-- BƯỚC TIẾP THEO:
--   Chạy `npm run dev` rồi đăng nhập:
--      manager_demo / Hvkhqs@123  (tạo đề xuất ở V05)
--      admin_demo   / Hvkhqs@123  (duyệt đề xuất ở V06)
--   (Password đã được hash sẵn — không cần chạy thêm script.)
-- =================================================================
