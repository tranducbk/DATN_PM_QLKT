export interface PersonnelListItem {
  id: string;
  ho_ten?: string | null;
  cccd?: string | null;
  cap_bac?: string | null;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  chuc_vu_id?: string | null;
  chuc_vu_name?: string | null;
  don_vi_name?: string;
  don_vi_display?: string;
  ChucVu?: { ten_chuc_vu?: string | null };
  CoQuanDonVi?: { ten_don_vi?: string | null; id?: string; co_quan_don_vi_id?: string | null };
  DonViTrucThuoc?: {
    id?: string;
    ten_don_vi?: string | null;
    ten?: string | null;
    co_quan_don_vi_id?: string | null;
    CoQuanDonVi?: { id?: string; ten_don_vi?: string | null };
  };
}

export interface PersonnelApiRow {
  id?: string;
  ho_ten?: string;
  cccd?: string;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  cap_bac?: string | null;
  chuc_vu_id?: string | null;
  ChucVu?: { ten_chuc_vu?: string | null };
  CoQuanDonVi?: { ten_don_vi?: string | null; id?: string; co_quan_don_vi_id?: string | null };
  DonViTrucThuoc?: {
    id?: string;
    ten_don_vi?: string | null;
    ten?: string | null;
    co_quan_don_vi_id?: string | null;
    CoQuanDonVi?: { id?: string; ten_don_vi?: string | null };
  };
  DonVi?: UnitRelationLike & {
    CoQuanDonVi?: UnitRelationLike | { id?: string; ten_don_vi?: string | null };
  };
  co_quan_don_vi?: unknown;
  don_vi_truc_thuoc?: unknown;
}

export interface UnitRelationLike {
  id?: string;
  ten_don_vi?: string;
  ten?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  CoQuanDonVi?: { id?: string; ten_don_vi?: string | null };
}

export interface UnitOptionRow {
  id: string;
  ma_don_vi?: string;
  ten_don_vi: string;
  co_quan_don_vi_id?: string | null;
  CoQuanDonVi?: { id?: string; ten_don_vi?: string | null };
}

export interface ManagerPositionRow {
  id: string;
  ten_chuc_vu?: string;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  DonViTrucThuoc?: {
    co_quan_don_vi_id?: string | null;
    CoQuanDonVi?: { id?: string };
  };
}

export interface AdminDonViTrucThuocRow {
  id: string;
  ten_don_vi: string;
  ma_don_vi: string;
  type: 'don_vi_truc_thuoc';
}

export interface AdminCoQuanDonViRow {
  id: string;
  ten_don_vi: string;
  ma_don_vi: string;
  type: 'co_quan_don_vi';
  donViTrucThuoc: AdminDonViTrucThuocRow[];
}

export interface ServiceProfile {
  hccsvv_hang_ba_status: string;
  hccsvv_hang_ba_ngay: string | null;
  hccsvv_hang_nhi_status: string;
  hccsvv_hang_nhi_ngay: string | null;
  hccsvv_hang_nhat_status: string;
  hccsvv_hang_nhat_ngay: string | null;
  goi_y?: string | null;
}

export interface ContributionProfile {
  months_07: number;
  months_08: number;
  months_0910: number;
  hcbvtq_hang_ba_status: string;
  hcbvtq_hang_nhi_status: string;
  hcbvtq_hang_nhat_status: string;
  goi_y?: string | null;
}

export interface AnnualProfile {
  tong_cstdcs: number | number[];
  cstdcs_lien_tuc: number;
  tong_nckh: number;
  du_dieu_kien_bkbqp: boolean;
  du_dieu_kien_cstdtq: boolean;
  du_dieu_kien_bkttcp: boolean;
  goi_y: string | null;
}

export interface MedalData {
  hasReceived: boolean;
  data?: { ngay_cap?: string | null; nam?: number; thang?: number }[];
}

export interface PersonnelDetail {
  id: string;
  ho_ten: string;
  cccd: string;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  chuc_vu_id?: string | null;
  gioi_tinh: string | null;
  so_dien_thoai: string | null;
  ngay_sinh: string | null;
  ngay_nhap_ngu: string;
  ngay_xuat_ngu: string | null;
  que_quan_2_cap: string | null;
  que_quan_3_cap: string | null;
  tru_quan: string | null;
  cho_o_hien_nay: string | null;
  ngay_vao_dang: string | null;
  ngay_vao_dang_chinh_thuc: string | null;
  so_the_dang_vien: string | null;
  cap_bac: string | null;
  DonViTrucThuoc?: { ten_don_vi: string; CoQuanDonVi?: { ten_don_vi: string } | null } | null;
  CoQuanDonVi?: { ten_don_vi: string } | null;
  ChucVu?: { ten_chuc_vu: string; he_so_chuc_vu?: number | string | null } | null;
  TaiKhoan?: { username: string; role: string } | null;
}

export interface UnitApiRow {
  id: string;
  ten_don_vi: string;
  ma_don_vi?: string;
  co_quan_don_vi_id?: string | null;
  CoQuanDonVi?: { id?: string; ten_don_vi?: string };
  DonViTrucThuoc?: UnitApiRow[];
}
