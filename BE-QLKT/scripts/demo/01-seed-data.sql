-- =================================================================
-- PM QLKT — Seed dữ liệu DEMO GIAO DIỆN (UI test)
-- =================================================================
-- File này seed dữ liệu nền: đơn vị, quân nhân, tài khoản, log, thông báo.
-- Dữ liệu khen thưởng (đề xuất, huy chương, danh hiệu...) tự nhập qua UI.
-- Để test riêng các kịch bản đề xuất chuỗi, dùng `02-seed-eligibility.sql`.
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
  ('cqdv01_demo', 'KNN', 'Khoa Ngoại ngữ',  12, NOW(), NOW()),
  ('cqdv02_demo', 'PTM', 'Phòng Tham mưu',  10, NOW(), NOW()),
  ('cqdv03_demo', 'PHC', 'Phòng Hậu cần',    8, NOW(), NOW());

-- -----------------------------------------------------------------
-- 3. DonViTrucThuoc — 6 đơn vị trực thuộc (2 mỗi CQDV)
-- -----------------------------------------------------------------
INSERT INTO "DonViTrucThuoc" (id, co_quan_don_vi_id, ma_don_vi, ten_don_vi, so_luong, "createdAt", "updatedAt") VALUES
  ('dvtt01_demo', 'cqdv01_demo', 'KNN-A1', 'Bộ môn Tiếng Anh',   6, NOW(), NOW()),
  ('dvtt02_demo', 'cqdv01_demo', 'KNN-A2', 'Bộ môn Tiếng Trung', 6, NOW(), NOW()),
  ('dvtt03_demo', 'cqdv02_demo', 'PTM-B1', 'Ban Tác chiến',       5, NOW(), NOW()),
  ('dvtt04_demo', 'cqdv02_demo', 'PTM-B2', 'Ban Quân huấn',       5, NOW(), NOW()),
  ('dvtt05_demo', 'cqdv03_demo', 'PHC-C1', 'Ban Quân nhu',        4, NOW(), NOW()),
  ('dvtt06_demo', 'cqdv03_demo', 'PHC-C2', 'Ban Tài chính',       4, NOW(), NOW());

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
  ('cv20_demo', NULL, 'dvtt06_demo', 'Trưởng ban',           true,  0.90, NOW(), NOW());

-- -----------------------------------------------------------------
-- 5. QuanNhan — 30 quân nhân (9 persona + 21 nhân viên thường)
-- -----------------------------------------------------------------
INSERT INTO "QuanNhan" (id, cccd, ho_ten, gioi_tinh, ngay_sinh, que_quan_2_cap, tru_quan, ngay_nhap_ngu, ngay_xuat_ngu, ngay_vao_dang, so_dien_thoai, cap_bac, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id, "createdAt", "updatedAt") VALUES
  -- QN-001: BKBQP eligible — đạt CSTDCS 2024+2025, chưa có flag BKBQP
  ('qn001_demo', '001234001234', 'Trần Văn An',      'NAM', '1990-03-15', 'Xã An Bình, tỉnh Thái Bình',   'Hà Nội', '2012-09-01', NULL, '2014-03-01', '0912000001', 'Thiếu tá',  'cqdv01_demo', 'dvtt01_demo', 'cv12_demo', NOW(), NOW()),
  -- QN-002: CSTDTQ eligible — chuỗi BKBQP đã có trong cửa sổ 3y
  ('qn002_demo', '001234001235', 'Nguyễn Văn Bình',  'NAM', '1985-07-22', 'Xã Long Hải, tỉnh Bà Rịa',    'Hà Nội', '2008-09-01', NULL, '2010-05-01', '0912000002', 'Trung tá',  'cqdv01_demo', NULL,           'cv11_demo', NOW(), NOW()),
  -- QN-003: BKTTCP eligible — chuỗi 7y đầy đủ
  ('qn003_demo', '001234001236', 'Lê Quang Cường',   'NAM', '1980-11-08', 'Xã Đông Khê, tỉnh Hưng Yên',  'Hà Nội', '2003-09-01', NULL, '2005-08-01', '0912000003', 'Thượng tá', 'cqdv01_demo', NULL,           'cv01_demo', NOW(), NOW()),
  -- QN-004: Đã nhận BKTTCP — demo lifetime block
  ('qn004_demo', '001234001237', 'Phạm Đình Dũng',   'NAM', '1978-04-02', 'Xã Diễn Hồng, tỉnh Nghệ An',  'Hà Nội', '2000-09-01', NULL, '2002-06-01', '0912000004', 'Đại tá',    'cqdv02_demo', NULL,           'cv03_demo', NOW(), NOW()),
  -- QN-005: HCBVTQ Hạng Ba eligible (đủ 120 tháng he_so 0.7-1.0)
  ('qn005_demo', '001234001238', 'Nguyễn Văn Em',    'NAM', '1979-09-25', 'Xã Yên Lạc, tỉnh Vĩnh Phúc',  'Hà Nội', '2001-09-01', NULL, '2003-04-01', '0912000005', 'Thượng tá', 'cqdv02_demo', 'dvtt03_demo', 'cv16_demo', NOW(), NOW()),
  -- QN-006: HCBVTQ Hạng Ba đã nhận, đủ Hạng Nhì — demo rank upgrade
  ('qn006_demo', '001234001239', 'Trần Thị Phượng',  'NU',  '1982-06-12', 'Xã Hoài Đức, TP Hà Nội',       'Hà Nội', '2004-09-01', NULL, '2006-09-01', '0912000006', 'Thượng tá', 'cqdv02_demo', 'dvtt04_demo', 'cv18_demo', NOW(), NOW()),
  -- QN-007: HCCSVV 10y — vừa đủ Hạng Ba
  ('qn007_demo', '001234001240', 'Hoàng Văn Giang',  'NAM', '1992-12-03', 'Xã Tam Phước, tỉnh Đồng Nai', 'Hà Nội', '2016-01-01', NULL, '2017-12-01', '0912000007', 'Thiếu tá',  'cqdv03_demo', 'dvtt05_demo', 'cv19_demo', NOW(), NOW()),
  -- QN-008: HCQKQT — 25 năm phục vụ
  ('qn008_demo', '001234001241', 'Đỗ Quang Hùng',    'NAM', '1976-08-18', 'Xã Hải An, tỉnh Hải Phòng',   'Hà Nội', '2001-01-01', NULL, '2003-02-01', '0912000008', 'Đại tá',    'cqdv03_demo', NULL,           'cv05_demo', NOW(), NOW()),
  -- QN-009: KNC nữ 20y phục vụ
  ('qn009_demo', '001234001242', 'Lê Thị Khánh',     'NU',  '1984-02-28', 'Xã Đông Hưng, tỉnh Thái Bình','Hà Nội', '2006-01-01', NULL, '2008-07-01', '0912000009', 'Trung tá',  'cqdv03_demo', 'dvtt06_demo', 'cv20_demo', NOW(), NOW());

-- 21 quân nhân thường
INSERT INTO "QuanNhan" (id, cccd, ho_ten, gioi_tinh, ngay_sinh, que_quan_2_cap, tru_quan, ngay_nhap_ngu, ngay_vao_dang, cap_bac, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id, "createdAt", "updatedAt") VALUES
  ('qn010_demo', '001234001243', 'Vũ Đình Lâm',      'NAM', '1995-05-14', 'Xã Tiên Lữ, tỉnh Hưng Yên',    'Hà Nội', '2018-09-01', '2020-12-01', 'Đại úy',   'cqdv01_demo', 'dvtt01_demo', 'cv13_demo', NOW(), NOW()),
  ('qn011_demo', '001234001244', 'Bùi Văn Mạnh',     'NAM', '1993-08-30', 'Xã Phú Đông, TP Hà Nội',        'Hà Nội', '2015-09-01', '2017-06-01', 'Thiếu tá', 'cqdv01_demo', 'dvtt01_demo', 'cv13_demo', NOW(), NOW()),
  ('qn012_demo', '001234001245', 'Đinh Thị Nga',     'NU',  '1991-11-19', 'Xã Long Bình, tỉnh Đồng Nai',  'Hà Nội', '2014-09-01', '2016-08-01', 'Thiếu tá', 'cqdv01_demo', 'dvtt02_demo', 'cv15_demo', NOW(), NOW()),
  ('qn013_demo', '001234001246', 'Nguyễn Thanh Ơn',  'NAM', '1988-02-07', 'Xã Tam Hiệp, TP Đà Nẵng',       'Hà Nội', '2010-09-01', '2012-09-01', 'Trung tá', 'cqdv01_demo', 'dvtt02_demo', 'cv14_demo', NOW(), NOW()),
  ('qn014_demo', '001234001247', 'Phạm Văn Phúc',    'NAM', '1996-09-04', 'Xã Long Hồ, tỉnh Vĩnh Long',   'Hà Nội', '2019-09-01', '2021-12-01', 'Đại úy',   'cqdv01_demo', 'dvtt02_demo', 'cv15_demo', NOW(), NOW()),
  ('qn015_demo', '001234001248', 'Trần Quang Quân',  'NAM', '1989-07-21', 'Xã Hoà Lạc, tỉnh Phú Thọ',     'Hà Nội', '2011-09-01', '2013-08-01', 'Trung tá', 'cqdv02_demo', 'dvtt03_demo', 'cv17_demo', NOW(), NOW()),
  ('qn016_demo', '001234001249', 'Lê Văn Sơn',       'NAM', '1994-03-15', 'Xã Tân Hiệp, tỉnh Tiền Giang', 'Hà Nội', '2017-09-01', '2019-07-01', 'Thiếu tá', 'cqdv02_demo', 'dvtt03_demo', 'cv17_demo', NOW(), NOW()),
  ('qn017_demo', '001234001250', 'Ngô Văn Tài',      'NAM', '1987-10-12', 'Xã An Khánh, tỉnh Bến Tre',    'Hà Nội', '2009-09-01', '2011-09-01', 'Trung tá', 'cqdv02_demo', 'dvtt03_demo', 'cv16_demo', NOW(), NOW()),
  ('qn018_demo', '001234001251', 'Vương Thị Uyên',   'NU',  '1990-01-25', 'Xã Bình Lợi, TP Hồ Chí Minh',  'Hà Nội', '2013-09-01', '2015-10-01', 'Thiếu tá', 'cqdv02_demo', 'dvtt04_demo', 'cv18_demo', NOW(), NOW()),
  ('qn019_demo', '001234001252', 'Đặng Văn Vinh',    'NAM', '1992-04-06', 'Xã Hoà Bình, tỉnh Hoà Bình',   'Hà Nội', '2014-09-01', '2016-09-01', 'Thiếu tá', 'cqdv02_demo', 'dvtt04_demo', 'cv18_demo', NOW(), NOW()),
  ('qn020_demo', '001234001253', 'Hoàng Thị Xuân',   'NU',  '1986-12-30', 'Xã Cẩm Mỹ, tỉnh Đồng Nai',     'Hà Nội', '2009-09-01', '2011-09-01', 'Trung tá', 'cqdv02_demo', NULL,           'cv04_demo', NOW(), NOW()),
  ('qn021_demo', '001234001254', 'Lý Văn Yên',       'NAM', '1990-08-11', 'Xã Đồng Văn, tỉnh Hà Giang',   'Hà Nội', '2013-09-01', '2015-08-01', 'Thiếu tá', 'cqdv03_demo', 'dvtt05_demo', 'cv19_demo', NOW(), NOW()),
  ('qn022_demo', '001234001255', 'Phan Đình Sang',   'NAM', '1985-05-23', 'Xã Long Khánh, tỉnh Đồng Nai', 'Hà Nội', '2008-09-01', '2010-09-01', 'Trung tá', 'cqdv03_demo', 'dvtt05_demo', 'cv19_demo', NOW(), NOW()),
  ('qn023_demo', '001234001256', 'Mai Văn Tùng',     'NAM', '1993-09-02', 'Xã An Phú, TP Hồ Chí Minh',    'Hà Nội', '2016-09-01', '2018-09-01', 'Thiếu tá', 'cqdv03_demo', 'dvtt06_demo', 'cv20_demo', NOW(), NOW()),
  ('qn024_demo', '001234001257', 'Nguyễn Thị Hoa',   'NU',  '1988-06-19', 'Xã Long Mỹ, tỉnh Hậu Giang',   'Hà Nội', '2011-09-01', '2013-08-01', 'Trung tá', 'cqdv03_demo', 'dvtt06_demo', 'cv20_demo', NOW(), NOW()),
  ('qn025_demo', '001234001258', 'Vũ Quang Trung',   'NAM', '1991-02-14', 'Xã Vĩnh Bình, tỉnh Long An',   'Hà Nội', '2014-09-01', '2016-09-01', 'Thiếu tá', 'cqdv01_demo', 'dvtt01_demo', 'cv13_demo', NOW(), NOW()),
  ('qn026_demo', '001234001259', 'Bùi Văn Khải',     'NAM', '1989-11-27', 'Xã Tân Phú, tỉnh Đồng Nai',    'Hà Nội', '2012-09-01', '2014-08-01', 'Thiếu tá', 'cqdv01_demo', 'dvtt02_demo', 'cv15_demo', NOW(), NOW()),
  ('qn027_demo', '001234001260', 'Đinh Văn Lộc',     'NAM', '1995-04-09', 'Xã Long Hải, tỉnh Bà Rịa',     'Hà Nội', '2018-09-01', '2020-08-01', 'Đại úy',   'cqdv02_demo', 'dvtt04_demo', 'cv18_demo', NOW(), NOW()),
  ('qn028_demo', '001234001261', 'Nguyễn Thị Hà',    'NU',  '1992-08-18', 'Xã Phú Yên, tỉnh Phú Yên',     'Hà Nội', '2015-09-01', '2017-09-01', 'Thiếu tá', 'cqdv03_demo', 'dvtt05_demo', 'cv19_demo', NOW(), NOW()),
  ('qn029_demo', '001234001262', 'Lê Hoàng Phương',  'NAM', '1987-01-03', 'Xã Cát Bà, TP Hải Phòng',      'Hà Nội', '2009-09-01', '2011-09-01', 'Trung tá', 'cqdv03_demo', NULL,           'cv05_demo', NOW(), NOW()),
  ('qn030_demo', '001234001263', 'Trần Thị Mai',     'NU',  '1994-10-20', 'Xã Mỹ Lộc, tỉnh Nam Định',     'Hà Nội', '2017-09-01', '2019-09-01', 'Thiếu tá', 'cqdv01_demo', 'dvtt02_demo', 'cv15_demo', NOW(), NOW());

-- -----------------------------------------------------------------
-- 6. TaiKhoan — 4 tài khoản demo (password đã hash sẵn = "Hvkhqs@123")
-- -----------------------------------------------------------------
-- bcrypt hash cost=10 cho password "Hvkhqs@123" — đã verify hoạt động.
INSERT INTO "TaiKhoan" (id, quan_nhan_id, username, password_hash, role, "refreshToken", "createdAt", "updatedAt") VALUES
  ('tk001_demo', NULL,         'superadmin_demo', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'SUPER_ADMIN', NULL, NOW(), NOW()),
  ('tk002_demo', 'qn003_demo', 'admin_demo',      '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'ADMIN',       NULL, NOW(), NOW()),
  ('tk003_demo', 'qn002_demo', 'manager_demo',    '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'MANAGER',     NULL, NOW(), NOW()),
  ('tk004_demo', 'qn010_demo', 'user_demo',       '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER',        NULL, NOW(), NOW()),
  -- 27 tài khoản USER cho các quân nhân còn lại (username = user_<6 số cuối CCCD>)
  ('tk005_demo', 'qn001_demo', 'user_001234', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk006_demo', 'qn004_demo', 'user_001237', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk007_demo', 'qn005_demo', 'user_001238', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk008_demo', 'qn006_demo', 'user_001239', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk009_demo', 'qn007_demo', 'user_001240', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk010_demo', 'qn008_demo', 'user_001241', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk011_demo', 'qn009_demo', 'user_001242', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk012_demo', 'qn011_demo', 'user_001244', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk013_demo', 'qn012_demo', 'user_001245', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk014_demo', 'qn013_demo', 'user_001246', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk015_demo', 'qn014_demo', 'user_001247', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk016_demo', 'qn015_demo', 'user_001248', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk017_demo', 'qn016_demo', 'user_001249', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk018_demo', 'qn017_demo', 'user_001250', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk019_demo', 'qn018_demo', 'user_001251', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk020_demo', 'qn019_demo', 'user_001252', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk021_demo', 'qn020_demo', 'user_001253', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk022_demo', 'qn021_demo', 'user_001254', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk023_demo', 'qn022_demo', 'user_001255', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk024_demo', 'qn023_demo', 'user_001256', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk025_demo', 'qn024_demo', 'user_001257', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk026_demo', 'qn025_demo', 'user_001258', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk027_demo', 'qn026_demo', 'user_001259', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk028_demo', 'qn027_demo', 'user_001260', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk029_demo', 'qn028_demo', 'user_001261', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk030_demo', 'qn029_demo', 'user_001262', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW()),
  ('tk031_demo', 'qn030_demo', 'user_001263', '$2b$10$1MdON6zgJCpx3ONfFhBKseP1rHF3LUB7Bpd59M9mG4p/S.4igpT5K', 'USER', NULL, NOW(), NOW());

-- -----------------------------------------------------------------
-- 7. SystemLog — nhật ký hệ thống
-- -----------------------------------------------------------------
-- Chỉ gồm các hành động liên quan đến quân nhân, đơn vị, tài khoản,
-- cấu hình, backup — không có log khen thưởng/đề xuất.
INSERT INTO "SystemLog" (id, nguoi_thuc_hien_id, actor_role, action, resource, tai_nguyen_id, description, payload, ip_address, user_agent, "createdAt") VALUES
  -- Đăng nhập / đăng xuất
  ('sl001_demo', 'tk001_demo', 'SUPER_ADMIN', 'LOGIN',  'auth', NULL, 'Đăng nhập hệ thống: superadmin_demo', NULL, '192.168.1.10', 'Mozilla/5.0', '2026-04-25 08:00:00'),
  ('sl011_demo', 'tk002_demo', 'ADMIN',       'LOGIN',  'auth', NULL, 'Đăng nhập hệ thống: admin_demo',      NULL, '192.168.1.11', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0', '2026-04-26 08:30:00'),
  ('sl012_demo', 'tk003_demo', 'MANAGER',     'LOGIN',  'auth', NULL, 'Đăng nhập hệ thống: manager_demo',    NULL, '192.168.1.12', 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/17.0',   '2026-04-26 08:45:00'),
  ('sl013_demo', 'tk004_demo', 'USER',        'LOGIN',  'auth', NULL, 'Đăng nhập hệ thống: user_demo',       NULL, '192.168.1.50', 'Mozilla/5.0 (iPhone; iPad) Safari/17.0',                '2026-04-26 09:00:00'),
  ('sl091_demo', 'tk003_demo', 'MANAGER',     'LOGOUT', 'auth', NULL, 'Đăng xuất hệ thống: manager_demo',    NULL, '192.168.1.12', 'Mozilla/5.0', '2026-04-26 17:30:00'),

  -- Quân nhân — tạo mới (ADMIN)
  ('sl030_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn001_demo', 'Tạo quân nhân: Trần Văn An (CCCD: 001234001234)',      NULL, '192.168.1.11', 'Mozilla/5.0', '2024-01-10 09:05:00'),
  ('sl031_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn002_demo', 'Tạo quân nhân: Nguyễn Văn Bình (CCCD: 001234001235)', NULL, '192.168.1.11', 'Mozilla/5.0', '2024-01-10 09:10:00'),
  ('sl032_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn003_demo', 'Tạo quân nhân: Lê Quang Cường (CCCD: 001234001236)',  NULL, '192.168.1.11', 'Mozilla/5.0', '2024-01-10 09:15:00'),
  ('sl033_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn005_demo', 'Tạo quân nhân: Nguyễn Văn Em (CCCD: 001234001238)',   NULL, '192.168.1.11', 'Mozilla/5.0', '2024-01-12 10:00:00'),
  ('sl034_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn008_demo', 'Tạo quân nhân: Đỗ Quang Hùng (CCCD: 001234001241)',   NULL, '192.168.1.11', 'Mozilla/5.0', '2024-01-12 10:30:00'),
  ('sl035_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn009_demo', 'Tạo quân nhân: Lê Thị Khánh (CCCD: 001234001242)',   NULL, '192.168.1.11', 'Mozilla/5.0', '2024-01-12 10:45:00'),
  ('sl002_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'personnel', 'qn030_demo', 'Tạo quân nhân: Trần Thị Mai (CCCD: 001234001263)',    '{"after":{"ho_ten":"Trần Thị Mai","cccd":"001234001263"}}'::jsonb, '192.168.1.11', 'Mozilla/5.0', '2026-04-25 09:15:00'),

  -- Quân nhân — cập nhật (MANAGER)
  ('sl009_demo', 'tk003_demo', 'MANAGER', 'UPDATE', 'personnel', 'qn010_demo', 'Cập nhật thông tin quân nhân: Vũ Đình Lâm', '{"diff":{"so_dien_thoai":["0912000010","0912999999"]}}'::jsonb, '192.168.1.12', 'Mozilla/5.0', '2026-04-22 14:20:00'),

  -- Quân nhân — xóa (ADMIN)
  ('sl036_demo', 'tk002_demo', 'ADMIN', 'DELETE', 'personnel', NULL, 'Xóa quân nhân: Đinh Thị Bình (CCCD: 001234009999)', NULL, '192.168.1.11', 'Mozilla/5.0', '2026-03-10 10:00:00'),

  -- Quân nhân — xuất Excel (ADMIN)
  ('sl018_demo', 'tk002_demo', 'ADMIN', 'EXPORT', 'personnel', NULL, 'Xuất danh sách quân nhân ra file Excel (30 bản ghi)', '{"count":30,"file_size":48000}'::jsonb, '192.168.1.11', 'Mozilla/5.0', '2026-04-23 16:00:00'),

  -- Đơn vị — tạo mới (ADMIN)
  ('sl060_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'units', 'cqdv01_demo', 'Tạo cơ quan đơn vị: Khoa Ngoại ngữ (mã: KNN)',        NULL, '192.168.1.11', 'Mozilla/5.0', '2023-09-01 08:00:00'),
  ('sl061_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'units', 'cqdv02_demo', 'Tạo cơ quan đơn vị: Phòng Tham mưu (mã: PTM)',        NULL, '192.168.1.11', 'Mozilla/5.0', '2023-09-01 08:15:00'),
  ('sl062_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'units', 'cqdv03_demo', 'Tạo cơ quan đơn vị: Phòng Hậu cần (mã: PHC)',         NULL, '192.168.1.11', 'Mozilla/5.0', '2023-09-01 08:30:00'),
  ('sl063_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'units', 'dvtt01_demo', 'Tạo đơn vị trực thuộc: Bộ môn Tiếng Anh (mã: KNN-A1)', NULL, '192.168.1.11', 'Mozilla/5.0', '2023-09-02 09:00:00'),
  ('sl014_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'units', 'dvtt06_demo', 'Tạo đơn vị trực thuộc: Ban Tài chính (mã: PHC-C2)',   '{"after":{"ma_don_vi":"PHC-C2","ten_don_vi":"Ban Tài chính"}}'::jsonb, '192.168.1.11', 'Mozilla/5.0', '2023-09-03 09:00:00'),

  -- Đơn vị — cập nhật (ADMIN)
  ('sl037_demo', 'tk002_demo', 'ADMIN', 'UPDATE', 'units', 'cqdv01_demo', 'Cập nhật cơ quan đơn vị: Khoa Ngoại ngữ', '{"diff":{"so_luong":[10,12]}}'::jsonb, '192.168.1.11', 'Mozilla/5.0', '2026-01-15 10:00:00'),

  -- Chức vụ — tạo mới (ADMIN)
  ('sl064_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'positions', 'cv01_demo', 'Tạo chức vụ: Trưởng phòng (đơn vị: Khoa Ngoại ngữ)',  NULL, '192.168.1.11', 'Mozilla/5.0', '2023-09-02 10:00:00'),
  ('sl065_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'positions', 'cv11_demo', 'Tạo chức vụ: Trưởng ban (đơn vị: Bộ môn Tiếng Anh)', NULL, '192.168.1.11', 'Mozilla/5.0', '2023-09-02 10:30:00'),
  ('sl015_demo', 'tk002_demo', 'ADMIN', 'CREATE', 'positions', 'cv20_demo', 'Tạo chức vụ: Trưởng ban (đơn vị: Ban Tài chính)',    NULL, '192.168.1.11', 'Mozilla/5.0', '2023-09-03 10:30:00'),

  -- Tài khoản — tạo mới (SUPER_ADMIN)
  ('sl070_demo', 'tk001_demo', 'SUPER_ADMIN', 'CREATE', 'accounts', 'tk002_demo', 'Tạo tài khoản: admin_demo cho quân nhân Lê Quang Cường',  NULL, '192.168.1.10', 'Mozilla/5.0', '2024-01-15 09:00:00'),
  ('sl071_demo', 'tk001_demo', 'SUPER_ADMIN', 'CREATE', 'accounts', 'tk003_demo', 'Tạo tài khoản: manager_demo cho quân nhân Nguyễn Văn Bình', NULL, '192.168.1.10', 'Mozilla/5.0', '2024-01-15 09:05:00'),
  ('sl072_demo', 'tk001_demo', 'SUPER_ADMIN', 'CREATE', 'accounts', 'tk004_demo', 'Tạo tài khoản: user_demo cho quân nhân Vũ Đình Lâm',       NULL, '192.168.1.10', 'Mozilla/5.0', '2024-01-15 09:10:00'),

  -- Tài khoản — tạo batch (SUPER_ADMIN)
  ('sl074_demo', 'tk001_demo', 'SUPER_ADMIN', 'CREATE', 'accounts', NULL, 'Tạo hàng loạt 27 tài khoản USER cho quân nhân chưa có tài khoản', '{"count":27}'::jsonb, '192.168.1.10', 'Mozilla/5.0', '2024-01-16 08:00:00'),

  -- Tài khoản — đặt lại mật khẩu (SUPER_ADMIN)
  ('sl073_demo', 'tk001_demo', 'SUPER_ADMIN', 'UPDATE', 'accounts', 'tk003_demo', 'Đặt lại mật khẩu tài khoản: manager_demo', NULL, '192.168.1.10', 'Mozilla/5.0', '2026-02-10 09:30:00'),

  -- Cấu hình hệ thống (SUPER_ADMIN)
  ('sl008_demo', 'tk001_demo', 'SUPER_ADMIN', 'UPDATE', 'systemSettings', 'ss_backup_schedule', 'Cập nhật cấu hình hệ thống: BACKUP_SCHEDULE', '{"key":"BACKUP_SCHEDULE","old":"0 1 1 * *","new":"0 2 * * *"}'::jsonb, '192.168.1.10', 'Mozilla/5.0', '2026-04-20 16:30:00'),

  -- Sao lưu (SUPER_ADMIN + SYSTEM)
  ('sl007_demo', 'tk001_demo', 'SUPER_ADMIN', 'BACKUP', 'backup', NULL, 'Sao lưu dữ liệu: backup_2026_04_01.sql (213 bản ghi, 4200 KB)',      '{"file":"backup_2026_04_01.sql","size":4200000}'::jsonb, NULL, NULL, '2026-04-01 01:00:05'),
  ('sl021_demo', 'tk001_demo', 'SUPER_ADMIN', 'BACKUP', 'backup', NULL, 'Sao lưu dữ liệu thất bại: ENOSPC - không đủ dung lượng đĩa',        '{"error":"ENOSPC: no space left on device","retry":2}'::jsonb,  NULL, NULL, '2026-03-01 01:00:08'),
  ('sl022_demo', 'tk001_demo', 'SUPER_ADMIN', 'BACKUP', 'backup', NULL, 'Sao lưu dữ liệu: backup_2026_05_01.sql (215 bản ghi, 5100 KB)',      '{"file":"backup_2026_05_01.sql","size":5100000}'::jsonb, NULL, NULL, '2026-05-01 01:00:05'),
  ('sl090_demo', 'tk001_demo', 'SUPER_ADMIN', 'DELETE', 'backup', NULL, 'Xóa file sao lưu: backup_2026_03_01.sql',                            NULL, NULL, NULL, '2026-04-20 16:00:00'),

  -- Tính lại hồ sơ (SYSTEM)
  ('sl010_demo', NULL, 'SYSTEM', 'RECALCULATE', 'profiles', NULL,        'Tính lại hồ sơ hằng năm cho toàn bộ quân nhân (30 quân nhân)', '{"count":30,"duration_ms":4200}'::jsonb, NULL, NULL, '2026-04-25 02:00:00'),
  ('sl024_demo', NULL, 'SYSTEM', 'RECALCULATE', 'profiles', 'qn005_demo','Tính lại hồ sơ cho 1 quân nhân: Nguyễn Văn Em',               '{"trigger":"manual","duration_ms":150}'::jsonb, NULL, NULL, '2026-04-25 11:30:00');

-- -----------------------------------------------------------------
-- 8. ThongBao — thông báo mẫu (chỉ liên quan quân nhân)
-- -----------------------------------------------------------------
-- Code thực tế chỉ gửi PERSONNEL_ADDED đến MANAGER phụ trách đơn vị,
-- PERSONNEL_TRANSFERRED đến MANAGER liên quan + USER (nếu có tài khoản).
INSERT INTO "ThongBao" (id, nguoi_nhan_id, recipient_role, type, title, message, resource, tai_nguyen_id, link, is_read, nhat_ky_he_thong_id, "createdAt") VALUES
  -- PERSONNEL_ADDED → MANAGER (khi ADMIN thêm quân nhân thuộc đơn vị manager_demo quản lý)
  ('tb001_demo', 'tk003_demo', 'MANAGER', 'PERSONNEL_ADDED', 'Quân nhân mới được thêm', 'Lê Quang Cường đã thêm quân nhân Trần Văn An (CCCD: 001234001234)',      'personnel', 'qn001_demo', '/manager/personnel/qn001_demo', true,  'sl030_demo', '2024-01-10 09:05:30'),
  ('tb002_demo', 'tk003_demo', 'MANAGER', 'PERSONNEL_ADDED', 'Quân nhân mới được thêm', 'Lê Quang Cường đã thêm quân nhân Nguyễn Văn Bình (CCCD: 001234001235)', 'personnel', 'qn002_demo', '/manager/personnel/qn002_demo', true,  'sl031_demo', '2024-01-10 09:10:30'),
  ('tb003_demo', 'tk003_demo', 'MANAGER', 'PERSONNEL_ADDED', 'Quân nhân mới được thêm', 'Lê Quang Cường đã thêm quân nhân Đỗ Quang Hùng (CCCD: 001234001241)',   'personnel', 'qn008_demo', '/manager/personnel/qn008_demo', true,  'sl034_demo', '2024-01-12 10:30:30'),
  ('tb004_demo', 'tk003_demo', 'MANAGER', 'PERSONNEL_ADDED', 'Quân nhân mới được thêm', 'Lê Quang Cường đã thêm quân nhân Vũ Quang Trung (CCCD: 001234001258)',  'personnel', 'qn025_demo', '/manager/personnel/qn025_demo', true,  NULL,         '2026-04-20 10:00:00'),
  ('tb005_demo', 'tk003_demo', 'MANAGER', 'PERSONNEL_ADDED', 'Quân nhân mới được thêm', 'Lê Quang Cường đã thêm quân nhân Trần Thị Mai (CCCD: 001234001263)',    'personnel', 'qn030_demo', '/manager/personnel/qn030_demo', false, 'sl002_demo', '2026-04-25 09:15:05'),

  -- PERSONNEL_TRANSFERRED → USER (quân nhân có tài khoản bị chuyển đơn vị)
  ('tb006_demo', 'tk004_demo', 'USER', 'PERSONNEL_TRANSFERRED', 'Bạn đã được chuyển đơn vị', 'Lê Quang Cường đã chuyển bạn từ đơn vị Bộ môn Tiếng Anh sang đơn vị Bộ môn Tiếng Trung', 'personnel', 'qn010_demo', '/user/profile', true, NULL, '2025-08-10 14:00:00'),

  -- PERSONNEL_TRANSFERRED → MANAGER (nhận quân nhân chuyển đến)
  ('tb007_demo', 'tk003_demo', 'MANAGER', 'PERSONNEL_TRANSFERRED', 'Quân nhân mới chuyển đến', 'Lê Quang Cường đã chuyển quân nhân Vũ Đình Lâm đến đơn vị của bạn (Bộ môn Tiếng Trung)', 'personnel', 'qn010_demo', '/manager/personnel/qn010_demo', true, NULL, '2025-08-10 14:00:05');

COMMIT;
