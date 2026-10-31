-- CreateTable
CREATE TABLE "CoQuanDonVi" (
    "id" VARCHAR(30) NOT NULL,
    "ma_don_vi" VARCHAR(50) NOT NULL,
    "ten_don_vi" VARCHAR(255) NOT NULL,
    "so_luong" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "CoQuanDonVi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonViTrucThuoc" (
    "id" VARCHAR(30) NOT NULL,
    "co_quan_don_vi_id" VARCHAR(30) NOT NULL,
    "ma_don_vi" VARCHAR(50) NOT NULL,
    "ten_don_vi" VARCHAR(255) NOT NULL,
    "so_luong" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "DonViTrucThuoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChucVu" (
    "id" VARCHAR(30) NOT NULL,
    "co_quan_don_vi_id" VARCHAR(30),
    "don_vi_truc_thuoc_id" VARCHAR(30),
    "ten_chuc_vu" VARCHAR(255) NOT NULL,
    "is_manager" BOOLEAN NOT NULL DEFAULT false,
    "he_so_chuc_vu" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "ChucVu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuanNhan" (
    "id" VARCHAR(30) NOT NULL,
    "cccd" VARCHAR(20),
    "ho_ten" VARCHAR(255) NOT NULL,
    "gioi_tinh" VARCHAR(10),
    "ngay_sinh" DATE,
    "que_quan_2_cap" VARCHAR(255),
    "que_quan_3_cap" VARCHAR(255),
    "tru_quan" VARCHAR(255),
    "cho_o_hien_nay" VARCHAR(255),
    "co_quan_don_vi" JSONB,
    "ngay_nhap_ngu" DATE,
    "ngay_xuat_ngu" DATE,
    "ngay_vao_dang" DATE,
    "ngay_vao_dang_chinh_thuc" DATE,
    "so_the_dang_vien" VARCHAR(50),
    "so_dien_thoai" VARCHAR(20),
    "cap_bac" VARCHAR(50),
    "co_quan_don_vi_id" VARCHAR(30),
    "don_vi_truc_thuoc_id" VARCHAR(30),
    "chuc_vu_id" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "QuanNhan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaiKhoan" (
    "id" VARCHAR(30) NOT NULL,
    "quan_nhan_id" VARCHAR(30),
    "username" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "refreshToken" TEXT,
    "prevRefreshToken" TEXT,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "TaiKhoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LichSuChucVu" (
    "id" VARCHAR(30) NOT NULL,
    "quan_nhan_id" VARCHAR(30) NOT NULL,
    "chuc_vu_id" VARCHAR(30),
    "he_so_chuc_vu" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ten_chuc_vu" VARCHAR(255),
    "ten_co_quan_don_vi" VARCHAR(255),
    "ten_don_vi_truc_thuoc" VARCHAR(255),
    "ngay_bat_dau" DATE NOT NULL,
    "ngay_ket_thuc" DATE,
    "so_thang" INTEGER,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "LichSuChucVu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThanhTichKhoaHoc" (
    "id" VARCHAR(30) NOT NULL,
    "quan_nhan_id" VARCHAR(30) NOT NULL,
    "nam" INTEGER NOT NULL,
    "loai" VARCHAR(10) NOT NULL,
    "mo_ta" VARCHAR(500) NOT NULL,
    "cap_bac" VARCHAR(50),
    "chuc_vu" VARCHAR(255),
    "ghi_chu" TEXT,
    "so_quyet_dinh" VARCHAR(100),
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "ThanhTichKhoaHoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DanhHieuHangNam" (
    "id" VARCHAR(30) NOT NULL,
    "quan_nhan_id" VARCHAR(30) NOT NULL,
    "nam" INTEGER NOT NULL,
    "danh_hieu" VARCHAR(20),
    "cap_bac" VARCHAR(50),
    "chuc_vu" VARCHAR(255),
    "ghi_chu" TEXT,
    "so_quyet_dinh" VARCHAR(100),
    "nhan_bkbqp" BOOLEAN NOT NULL DEFAULT false,
    "so_quyet_dinh_bkbqp" VARCHAR(100),
    "ghi_chu_bkbqp" TEXT,
    "nhan_cstdtq" BOOLEAN NOT NULL DEFAULT false,
    "so_quyet_dinh_cstdtq" VARCHAR(100),
    "ghi_chu_cstdtq" TEXT,
    "nhan_bkttcp" BOOLEAN NOT NULL DEFAULT false,
    "so_quyet_dinh_bkttcp" VARCHAR(100),
    "ghi_chu_bkttcp" TEXT,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "DanhHieuHangNam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KhenThuongHCBVTQ" (
    "id" VARCHAR(30) NOT NULL,
    "quan_nhan_id" VARCHAR(30) NOT NULL,
    "danh_hieu" VARCHAR(20) NOT NULL,
    "nam" INTEGER NOT NULL,
    "thang" INTEGER NOT NULL,
    "cap_bac" VARCHAR(50),
    "chuc_vu" VARCHAR(255),
    "ghi_chu" TEXT,
    "so_quyet_dinh" VARCHAR(100),
    "thoi_gian_nhom_0_7" JSONB,
    "thoi_gian_nhom_0_8" JSONB,
    "thoi_gian_nhom_0_9_1_0" JSONB,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "KhenThuongHCBVTQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuanChuongQuanKyQuyetThang" (
    "id" VARCHAR(30) NOT NULL,
    "quan_nhan_id" VARCHAR(30) NOT NULL,
    "nam" INTEGER NOT NULL,
    "thang" INTEGER NOT NULL,
    "cap_bac" VARCHAR(50),
    "chuc_vu" VARCHAR(255),
    "ghi_chu" TEXT,
    "so_quyet_dinh" VARCHAR(100),
    "thoi_gian" JSONB,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "HuanChuongQuanKyQuyetThang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KyNiemChuongVSNXDQDNDVN" (
    "id" VARCHAR(30) NOT NULL,
    "quan_nhan_id" VARCHAR(30) NOT NULL,
    "nam" INTEGER NOT NULL,
    "thang" INTEGER NOT NULL,
    "cap_bac" VARCHAR(50),
    "chuc_vu" VARCHAR(255),
    "ghi_chu" TEXT,
    "so_quyet_dinh" VARCHAR(100),
    "thoi_gian" JSONB,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "KyNiemChuongVSNXDQDNDVN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KhenThuongHCCSVV" (
    "id" VARCHAR(30) NOT NULL,
    "quan_nhan_id" VARCHAR(30) NOT NULL,
    "danh_hieu" VARCHAR(20) NOT NULL,
    "nam" INTEGER NOT NULL,
    "thang" INTEGER NOT NULL,
    "cap_bac" VARCHAR(50),
    "chuc_vu" VARCHAR(255),
    "ghi_chu" TEXT,
    "so_quyet_dinh" VARCHAR(100),
    "thoi_gian" JSONB,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "KhenThuongHCCSVV_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KhenThuongDotXuat" (
    "id" VARCHAR(30) NOT NULL,
    "loai" VARCHAR(30) NOT NULL DEFAULT 'KHEN_THUONG_DOT_XUAT',
    "doi_tuong" VARCHAR(20) NOT NULL DEFAULT 'CA_NHAN',
    "quan_nhan_id" VARCHAR(30),
    "co_quan_don_vi_id" VARCHAR(30),
    "don_vi_truc_thuoc_id" VARCHAR(30),
    "hinh_thuc_khen_thuong" VARCHAR(255) NOT NULL,
    "nam" INTEGER NOT NULL,
    "cap_bac" VARCHAR(50),
    "chuc_vu" VARCHAR(255),
    "ghi_chu" TEXT,
    "so_quyet_dinh" VARCHAR(100),
    "files_dinh_kem" JSONB,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "KhenThuongDotXuat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoSoNienHan" (
    "id" VARCHAR(30) NOT NULL,
    "quan_nhan_id" VARCHAR(30) NOT NULL,
    "hccsvv_hang_ba_status" VARCHAR(20) NOT NULL DEFAULT 'CHUA_DU',
    "hccsvv_hang_ba_ngay" DATE,
    "hccsvv_hang_nhi_status" VARCHAR(20) NOT NULL DEFAULT 'CHUA_DU',
    "hccsvv_hang_nhi_ngay" DATE,
    "hccsvv_hang_nhat_status" VARCHAR(20) NOT NULL DEFAULT 'CHUA_DU',
    "hccsvv_hang_nhat_ngay" DATE,
    "goi_y" TEXT,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "HoSoNienHan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoSoCongHien" (
    "id" VARCHAR(30) NOT NULL,
    "quan_nhan_id" VARCHAR(30) NOT NULL,
    "hcbvtq_total_months" INTEGER NOT NULL DEFAULT 0,
    "months_07" INTEGER NOT NULL DEFAULT 0,
    "months_08" INTEGER NOT NULL DEFAULT 0,
    "months_0910" INTEGER NOT NULL DEFAULT 0,
    "hcbvtq_hang_ba_status" VARCHAR(20) NOT NULL DEFAULT 'CHUA_DU',
    "hcbvtq_hang_ba_ngay" DATE,
    "hcbvtq_hang_nhi_status" VARCHAR(20) NOT NULL DEFAULT 'CHUA_DU',
    "hcbvtq_hang_nhi_ngay" DATE,
    "hcbvtq_hang_nhat_status" VARCHAR(20) NOT NULL DEFAULT 'CHUA_DU',
    "hcbvtq_hang_nhat_ngay" DATE,
    "goi_y" TEXT,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "HoSoCongHien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoSoHangNam" (
    "id" VARCHAR(30) NOT NULL,
    "quan_nhan_id" VARCHAR(30) NOT NULL,
    "tong_cstdcs" INTEGER NOT NULL DEFAULT 0,
    "tong_nckh" INTEGER NOT NULL DEFAULT 0,
    "tong_cstdcs_json" JSONB,
    "tong_nckh_json" JSONB,
    "cstdcs_lien_tuc" INTEGER NOT NULL DEFAULT 0,
    "nckh_lien_tuc" INTEGER NOT NULL DEFAULT 0,
    "bkbqp_lien_tuc" INTEGER NOT NULL DEFAULT 0,
    "cstdtq_lien_tuc" INTEGER NOT NULL DEFAULT 0,
    "du_dieu_kien_bkbqp" BOOLEAN NOT NULL DEFAULT false,
    "du_dieu_kien_cstdtq" BOOLEAN NOT NULL DEFAULT false,
    "du_dieu_kien_bkttcp" BOOLEAN NOT NULL DEFAULT false,
    "goi_y" TEXT,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "HoSoHangNam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" VARCHAR(30) NOT NULL,
    "nguoi_thuc_hien_id" VARCHAR(30),
    "actor_role" VARCHAR(20) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "tai_nguyen_id" VARCHAR(30),
    "description" VARCHAR(500) NOT NULL,
    "payload" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThongBao" (
    "id" VARCHAR(30) NOT NULL,
    "nguoi_nhan_id" VARCHAR(30),
    "recipient_role" VARCHAR(20) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "resource" VARCHAR(50),
    "tai_nguyen_id" VARCHAR(30),
    "link" VARCHAR(255),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "nhat_ky_he_thong_id" VARCHAR(30),
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(0),

    CONSTRAINT "ThongBao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BangDeXuat" (
    "id" VARCHAR(30) NOT NULL,
    "co_quan_don_vi_id" VARCHAR(30),
    "don_vi_truc_thuoc_id" VARCHAR(30),
    "nguoi_de_xuat_id" VARCHAR(30),
    "loai_de_xuat" VARCHAR(20) NOT NULL,
    "nam" INTEGER NOT NULL,
    "thang" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "data_danh_hieu" JSONB,
    "data_thanh_tich" JSONB,
    "data_nien_han" JSONB,
    "data_cong_hien" JSONB,
    "files_attached" JSONB,
    "files_attached_admin" JSONB,
    "ghi_chu" TEXT,
    "rejection_reason" TEXT,
    "nguoi_duyet_id" VARCHAR(30),
    "ngay_duyet" TIMESTAMP(0),
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "BangDeXuat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoSoDonViHangNam" (
    "id" VARCHAR(30) NOT NULL,
    "co_quan_don_vi_id" VARCHAR(30),
    "don_vi_truc_thuoc_id" VARCHAR(30),
    "nam" INTEGER NOT NULL,
    "tong_dvqt" INTEGER NOT NULL DEFAULT 0,
    "tong_dvqt_json" JSONB,
    "dvqt_lien_tuc" INTEGER NOT NULL DEFAULT 0,
    "du_dieu_kien_bkbqp" BOOLEAN NOT NULL DEFAULT false,
    "du_dieu_kien_bkttcp" BOOLEAN NOT NULL DEFAULT false,
    "goi_y" TEXT,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "HoSoDonViHangNam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DanhHieuDonViHangNam" (
    "id" VARCHAR(30) NOT NULL,
    "co_quan_don_vi_id" VARCHAR(30),
    "don_vi_truc_thuoc_id" VARCHAR(30),
    "nam" INTEGER NOT NULL,
    "danh_hieu" VARCHAR(50),
    "so_quyet_dinh" VARCHAR(100),
    "nhan_bkbqp" BOOLEAN NOT NULL DEFAULT false,
    "so_quyet_dinh_bkbqp" VARCHAR(100),
    "ghi_chu_bkbqp" TEXT,
    "nhan_bkttcp" BOOLEAN NOT NULL DEFAULT false,
    "so_quyet_dinh_bkttcp" VARCHAR(100),
    "ghi_chu_bkttcp" TEXT,
    "nguoi_tao_id" VARCHAR(30),
    "nguoi_duyet_id" VARCHAR(30),
    "ngay_duyet" TIMESTAMP(0),
    "ghi_chu" TEXT,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "DanhHieuDonViHangNam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileQuyetDinh" (
    "id" VARCHAR(30) NOT NULL,
    "so_quyet_dinh" VARCHAR(100) NOT NULL,
    "nam" INTEGER NOT NULL,
    "ngay_ky" DATE NOT NULL,
    "nguoi_ky" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(500),
    "loai_khen_thuong" VARCHAR(50),
    "ghi_chu" TEXT,
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "FileQuyetDinh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" VARCHAR(30) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoQuanDonVi_ma_don_vi_key" ON "CoQuanDonVi"("ma_don_vi");

-- CreateIndex
CREATE UNIQUE INDEX "DonViTrucThuoc_ma_don_vi_key" ON "DonViTrucThuoc"("ma_don_vi");

-- CreateIndex
CREATE UNIQUE INDEX "ChucVu_co_quan_don_vi_id_ten_chuc_vu_key" ON "ChucVu"("co_quan_don_vi_id", "ten_chuc_vu");

-- CreateIndex
CREATE UNIQUE INDEX "ChucVu_don_vi_truc_thuoc_id_ten_chuc_vu_key" ON "ChucVu"("don_vi_truc_thuoc_id", "ten_chuc_vu");

-- CreateIndex
CREATE UNIQUE INDEX "QuanNhan_cccd_key" ON "QuanNhan"("cccd");

-- CreateIndex
CREATE INDEX "QuanNhan_co_quan_don_vi_id_idx" ON "QuanNhan"("co_quan_don_vi_id");

-- CreateIndex
CREATE UNIQUE INDEX "TaiKhoan_quan_nhan_id_key" ON "TaiKhoan"("quan_nhan_id");

-- CreateIndex
CREATE UNIQUE INDEX "TaiKhoan_username_key" ON "TaiKhoan"("username");

-- CreateIndex
CREATE INDEX "ThanhTichKhoaHoc_quan_nhan_id_nam_idx" ON "ThanhTichKhoaHoc"("quan_nhan_id", "nam");

-- CreateIndex
CREATE INDEX "ThanhTichKhoaHoc_so_quyet_dinh_idx" ON "ThanhTichKhoaHoc"("so_quyet_dinh");

-- CreateIndex
CREATE INDEX "DanhHieuHangNam_so_quyet_dinh_idx" ON "DanhHieuHangNam"("so_quyet_dinh");

-- CreateIndex
CREATE INDEX "DanhHieuHangNam_so_quyet_dinh_bkbqp_idx" ON "DanhHieuHangNam"("so_quyet_dinh_bkbqp");

-- CreateIndex
CREATE INDEX "DanhHieuHangNam_so_quyet_dinh_cstdtq_idx" ON "DanhHieuHangNam"("so_quyet_dinh_cstdtq");

-- CreateIndex
CREATE INDEX "DanhHieuHangNam_so_quyet_dinh_bkttcp_idx" ON "DanhHieuHangNam"("so_quyet_dinh_bkttcp");

-- CreateIndex
CREATE UNIQUE INDEX "DanhHieuHangNam_quan_nhan_id_nam_key" ON "DanhHieuHangNam"("quan_nhan_id", "nam");

-- CreateIndex
CREATE UNIQUE INDEX "KhenThuongHCBVTQ_quan_nhan_id_key" ON "KhenThuongHCBVTQ"("quan_nhan_id");

-- CreateIndex
CREATE INDEX "KhenThuongHCBVTQ_so_quyet_dinh_idx" ON "KhenThuongHCBVTQ"("so_quyet_dinh");

-- CreateIndex
CREATE UNIQUE INDEX "HuanChuongQuanKyQuyetThang_quan_nhan_id_key" ON "HuanChuongQuanKyQuyetThang"("quan_nhan_id");

-- CreateIndex
CREATE INDEX "HuanChuongQuanKyQuyetThang_so_quyet_dinh_idx" ON "HuanChuongQuanKyQuyetThang"("so_quyet_dinh");

-- CreateIndex
CREATE UNIQUE INDEX "KyNiemChuongVSNXDQDNDVN_quan_nhan_id_key" ON "KyNiemChuongVSNXDQDNDVN"("quan_nhan_id");

-- CreateIndex
CREATE INDEX "KyNiemChuongVSNXDQDNDVN_so_quyet_dinh_idx" ON "KyNiemChuongVSNXDQDNDVN"("so_quyet_dinh");

-- CreateIndex
CREATE INDEX "KhenThuongHCCSVV_so_quyet_dinh_idx" ON "KhenThuongHCCSVV"("so_quyet_dinh");

-- CreateIndex
CREATE UNIQUE INDEX "KhenThuongHCCSVV_quan_nhan_id_danh_hieu_key" ON "KhenThuongHCCSVV"("quan_nhan_id", "danh_hieu");

-- CreateIndex
CREATE INDEX "KhenThuongDotXuat_quan_nhan_id_nam_idx" ON "KhenThuongDotXuat"("quan_nhan_id", "nam");

-- CreateIndex
CREATE INDEX "KhenThuongDotXuat_co_quan_don_vi_id_nam_idx" ON "KhenThuongDotXuat"("co_quan_don_vi_id", "nam");

-- CreateIndex
CREATE INDEX "KhenThuongDotXuat_don_vi_truc_thuoc_id_nam_idx" ON "KhenThuongDotXuat"("don_vi_truc_thuoc_id", "nam");

-- CreateIndex
CREATE INDEX "KhenThuongDotXuat_so_quyet_dinh_idx" ON "KhenThuongDotXuat"("so_quyet_dinh");

-- CreateIndex
CREATE UNIQUE INDEX "HoSoNienHan_quan_nhan_id_key" ON "HoSoNienHan"("quan_nhan_id");

-- CreateIndex
CREATE UNIQUE INDEX "HoSoCongHien_quan_nhan_id_key" ON "HoSoCongHien"("quan_nhan_id");

-- CreateIndex
CREATE UNIQUE INDEX "HoSoHangNam_quan_nhan_id_key" ON "HoSoHangNam"("quan_nhan_id");

-- CreateIndex
CREATE INDEX "SystemLog_actor_role_createdAt_idx" ON "SystemLog"("actor_role", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_action_createdAt_idx" ON "SystemLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_resource_createdAt_idx" ON "SystemLog"("resource", "createdAt");

-- CreateIndex
CREATE INDEX "ThongBao_nguoi_nhan_id_is_read_createdAt_idx" ON "ThongBao"("nguoi_nhan_id", "is_read", "createdAt");

-- CreateIndex
CREATE INDEX "ThongBao_recipient_role_is_read_createdAt_idx" ON "ThongBao"("recipient_role", "is_read", "createdAt");

-- CreateIndex
CREATE INDEX "ThongBao_type_createdAt_idx" ON "ThongBao"("type", "createdAt");

-- CreateIndex
CREATE INDEX "BangDeXuat_status_loai_de_xuat_idx" ON "BangDeXuat"("status", "loai_de_xuat");

-- CreateIndex
CREATE INDEX "HoSoDonViHangNam_co_quan_don_vi_id_nam_idx" ON "HoSoDonViHangNam"("co_quan_don_vi_id", "nam");

-- CreateIndex
CREATE INDEX "HoSoDonViHangNam_don_vi_truc_thuoc_id_nam_idx" ON "HoSoDonViHangNam"("don_vi_truc_thuoc_id", "nam");

-- CreateIndex
CREATE UNIQUE INDEX "HoSoDonViHangNam_co_quan_don_vi_id_nam_key" ON "HoSoDonViHangNam"("co_quan_don_vi_id", "nam");

-- CreateIndex
CREATE UNIQUE INDEX "HoSoDonViHangNam_don_vi_truc_thuoc_id_nam_key" ON "HoSoDonViHangNam"("don_vi_truc_thuoc_id", "nam");

-- CreateIndex
CREATE INDEX "DanhHieuDonViHangNam_co_quan_don_vi_id_nam_idx" ON "DanhHieuDonViHangNam"("co_quan_don_vi_id", "nam");

-- CreateIndex
CREATE INDEX "DanhHieuDonViHangNam_don_vi_truc_thuoc_id_nam_idx" ON "DanhHieuDonViHangNam"("don_vi_truc_thuoc_id", "nam");

-- CreateIndex
CREATE INDEX "DanhHieuDonViHangNam_so_quyet_dinh_idx" ON "DanhHieuDonViHangNam"("so_quyet_dinh");

-- CreateIndex
CREATE INDEX "DanhHieuDonViHangNam_so_quyet_dinh_bkbqp_idx" ON "DanhHieuDonViHangNam"("so_quyet_dinh_bkbqp");

-- CreateIndex
CREATE INDEX "DanhHieuDonViHangNam_so_quyet_dinh_bkttcp_idx" ON "DanhHieuDonViHangNam"("so_quyet_dinh_bkttcp");

-- CreateIndex
CREATE UNIQUE INDEX "DanhHieuDonViHangNam_co_quan_don_vi_id_nam_key" ON "DanhHieuDonViHangNam"("co_quan_don_vi_id", "nam");

-- CreateIndex
CREATE UNIQUE INDEX "DanhHieuDonViHangNam_don_vi_truc_thuoc_id_nam_key" ON "DanhHieuDonViHangNam"("don_vi_truc_thuoc_id", "nam");

-- CreateIndex
CREATE UNIQUE INDEX "FileQuyetDinh_so_quyet_dinh_key" ON "FileQuyetDinh"("so_quyet_dinh");

-- CreateIndex
CREATE INDEX "FileQuyetDinh_so_quyet_dinh_idx" ON "FileQuyetDinh"("so_quyet_dinh");

-- CreateIndex
CREATE INDEX "FileQuyetDinh_nam_idx" ON "FileQuyetDinh"("nam");

-- CreateIndex
CREATE INDEX "FileQuyetDinh_loai_khen_thuong_idx" ON "FileQuyetDinh"("loai_khen_thuong");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "DonViTrucThuoc" ADD CONSTRAINT "DonViTrucThuoc_co_quan_don_vi_id_fkey" FOREIGN KEY ("co_quan_don_vi_id") REFERENCES "CoQuanDonVi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChucVu" ADD CONSTRAINT "ChucVu_co_quan_don_vi_id_fkey" FOREIGN KEY ("co_quan_don_vi_id") REFERENCES "CoQuanDonVi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChucVu" ADD CONSTRAINT "ChucVu_don_vi_truc_thuoc_id_fkey" FOREIGN KEY ("don_vi_truc_thuoc_id") REFERENCES "DonViTrucThuoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuanNhan" ADD CONSTRAINT "QuanNhan_co_quan_don_vi_id_fkey" FOREIGN KEY ("co_quan_don_vi_id") REFERENCES "CoQuanDonVi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuanNhan" ADD CONSTRAINT "QuanNhan_don_vi_truc_thuoc_id_fkey" FOREIGN KEY ("don_vi_truc_thuoc_id") REFERENCES "DonViTrucThuoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuanNhan" ADD CONSTRAINT "QuanNhan_chuc_vu_id_fkey" FOREIGN KEY ("chuc_vu_id") REFERENCES "ChucVu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaiKhoan" ADD CONSTRAINT "TaiKhoan_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LichSuChucVu" ADD CONSTRAINT "LichSuChucVu_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LichSuChucVu" ADD CONSTRAINT "LichSuChucVu_chuc_vu_id_fkey" FOREIGN KEY ("chuc_vu_id") REFERENCES "ChucVu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThanhTichKhoaHoc" ADD CONSTRAINT "ThanhTichKhoaHoc_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThanhTichKhoaHoc" ADD CONSTRAINT "ThanhTichKhoaHoc_so_quyet_dinh_fkey" FOREIGN KEY ("so_quyet_dinh") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuHangNam" ADD CONSTRAINT "DanhHieuHangNam_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuHangNam" ADD CONSTRAINT "DanhHieuHangNam_so_quyet_dinh_fkey" FOREIGN KEY ("so_quyet_dinh") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuHangNam" ADD CONSTRAINT "DanhHieuHangNam_so_quyet_dinh_bkbqp_fkey" FOREIGN KEY ("so_quyet_dinh_bkbqp") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuHangNam" ADD CONSTRAINT "DanhHieuHangNam_so_quyet_dinh_cstdtq_fkey" FOREIGN KEY ("so_quyet_dinh_cstdtq") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuHangNam" ADD CONSTRAINT "DanhHieuHangNam_so_quyet_dinh_bkttcp_fkey" FOREIGN KEY ("so_quyet_dinh_bkttcp") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KhenThuongHCBVTQ" ADD CONSTRAINT "KhenThuongHCBVTQ_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KhenThuongHCBVTQ" ADD CONSTRAINT "KhenThuongHCBVTQ_so_quyet_dinh_fkey" FOREIGN KEY ("so_quyet_dinh") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuanChuongQuanKyQuyetThang" ADD CONSTRAINT "HuanChuongQuanKyQuyetThang_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuanChuongQuanKyQuyetThang" ADD CONSTRAINT "HuanChuongQuanKyQuyetThang_so_quyet_dinh_fkey" FOREIGN KEY ("so_quyet_dinh") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KyNiemChuongVSNXDQDNDVN" ADD CONSTRAINT "KyNiemChuongVSNXDQDNDVN_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KyNiemChuongVSNXDQDNDVN" ADD CONSTRAINT "KyNiemChuongVSNXDQDNDVN_so_quyet_dinh_fkey" FOREIGN KEY ("so_quyet_dinh") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KhenThuongHCCSVV" ADD CONSTRAINT "KhenThuongHCCSVV_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KhenThuongHCCSVV" ADD CONSTRAINT "KhenThuongHCCSVV_so_quyet_dinh_fkey" FOREIGN KEY ("so_quyet_dinh") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KhenThuongDotXuat" ADD CONSTRAINT "KhenThuongDotXuat_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KhenThuongDotXuat" ADD CONSTRAINT "KhenThuongDotXuat_co_quan_don_vi_id_fkey" FOREIGN KEY ("co_quan_don_vi_id") REFERENCES "CoQuanDonVi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KhenThuongDotXuat" ADD CONSTRAINT "KhenThuongDotXuat_don_vi_truc_thuoc_id_fkey" FOREIGN KEY ("don_vi_truc_thuoc_id") REFERENCES "DonViTrucThuoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KhenThuongDotXuat" ADD CONSTRAINT "KhenThuongDotXuat_so_quyet_dinh_fkey" FOREIGN KEY ("so_quyet_dinh") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoSoNienHan" ADD CONSTRAINT "HoSoNienHan_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoSoCongHien" ADD CONSTRAINT "HoSoCongHien_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoSoHangNam" ADD CONSTRAINT "HoSoHangNam_quan_nhan_id_fkey" FOREIGN KEY ("quan_nhan_id") REFERENCES "QuanNhan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemLog" ADD CONSTRAINT "SystemLog_nguoi_thuc_hien_id_fkey" FOREIGN KEY ("nguoi_thuc_hien_id") REFERENCES "TaiKhoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThongBao" ADD CONSTRAINT "ThongBao_nguoi_nhan_id_fkey" FOREIGN KEY ("nguoi_nhan_id") REFERENCES "TaiKhoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThongBao" ADD CONSTRAINT "ThongBao_nhat_ky_he_thong_id_fkey" FOREIGN KEY ("nhat_ky_he_thong_id") REFERENCES "SystemLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BangDeXuat" ADD CONSTRAINT "BangDeXuat_co_quan_don_vi_id_fkey" FOREIGN KEY ("co_quan_don_vi_id") REFERENCES "CoQuanDonVi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BangDeXuat" ADD CONSTRAINT "BangDeXuat_don_vi_truc_thuoc_id_fkey" FOREIGN KEY ("don_vi_truc_thuoc_id") REFERENCES "DonViTrucThuoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BangDeXuat" ADD CONSTRAINT "BangDeXuat_nguoi_de_xuat_id_fkey" FOREIGN KEY ("nguoi_de_xuat_id") REFERENCES "TaiKhoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BangDeXuat" ADD CONSTRAINT "BangDeXuat_nguoi_duyet_id_fkey" FOREIGN KEY ("nguoi_duyet_id") REFERENCES "TaiKhoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoSoDonViHangNam" ADD CONSTRAINT "HoSoDonViHangNam_co_quan_don_vi_id_fkey" FOREIGN KEY ("co_quan_don_vi_id") REFERENCES "CoQuanDonVi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoSoDonViHangNam" ADD CONSTRAINT "HoSoDonViHangNam_don_vi_truc_thuoc_id_fkey" FOREIGN KEY ("don_vi_truc_thuoc_id") REFERENCES "DonViTrucThuoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuDonViHangNam" ADD CONSTRAINT "DanhHieuDonViHangNam_co_quan_don_vi_id_fkey" FOREIGN KEY ("co_quan_don_vi_id") REFERENCES "CoQuanDonVi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuDonViHangNam" ADD CONSTRAINT "DanhHieuDonViHangNam_don_vi_truc_thuoc_id_fkey" FOREIGN KEY ("don_vi_truc_thuoc_id") REFERENCES "DonViTrucThuoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuDonViHangNam" ADD CONSTRAINT "DanhHieuDonViHangNam_so_quyet_dinh_fkey" FOREIGN KEY ("so_quyet_dinh") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuDonViHangNam" ADD CONSTRAINT "DanhHieuDonViHangNam_so_quyet_dinh_bkbqp_fkey" FOREIGN KEY ("so_quyet_dinh_bkbqp") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuDonViHangNam" ADD CONSTRAINT "DanhHieuDonViHangNam_so_quyet_dinh_bkttcp_fkey" FOREIGN KEY ("so_quyet_dinh_bkttcp") REFERENCES "FileQuyetDinh"("so_quyet_dinh") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuDonViHangNam" ADD CONSTRAINT "DanhHieuDonViHangNam_nguoi_tao_id_fkey" FOREIGN KEY ("nguoi_tao_id") REFERENCES "TaiKhoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DanhHieuDonViHangNam" ADD CONSTRAINT "DanhHieuDonViHangNam_nguoi_duyet_id_fkey" FOREIGN KEY ("nguoi_duyet_id") REFERENCES "TaiKhoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

