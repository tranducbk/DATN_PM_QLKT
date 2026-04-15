/** Dòng danh sách quân nhân (admin normalize / manager API). Khác `Personnel` ở `@/lib/types` (flat). */

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

/**
 * Bản ghi thô từ API getPersonnel trước khi normalize (trang admin).
 */
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

/** Quan hệ đơn vị khi normalize (API có nhiều dạng). */
export interface UnitRelationLike {
  id?: string;
  ten_don_vi?: string;
  ten?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  CoQuanDonVi?: { id?: string; ten_don_vi?: string | null };
}

/** Đơn vị từ getMyUnits / getUnits (form chọn đơn vị). */
export interface UnitOptionRow {
  id: string;
  ma_don_vi?: string;
  ten_don_vi: string;
  co_quan_don_vi_id?: string | null;
  CoQuanDonVi?: { id?: string; ten_don_vi?: string | null };
}

/** Chức vụ (getPositions) — trang manager lọc theo đơn vị. */
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

/** Đơn vị trực thuộc trong map (admin — lọc theo cơ quan). */
export interface AdminDonViTrucThuocRow {
  id: string;
  ten_don_vi: string;
  ma_don_vi: string;
  type: 'don_vi_truc_thuoc';
}

/** Cơ quan đơn vị + đơn vị trực thuộc con (admin danh sách quân nhân). */
export interface AdminCoQuanDonViRow {
  id: string;
  ten_don_vi: string;
  ma_don_vi: string;
  type: 'co_quan_don_vi';
  donViTrucThuoc: AdminDonViTrucThuocRow[];
}

/** Một dòng từ API getUnits khi build cây đơn vị (admin). */
export interface UnitApiRow {
  id: string;
  ten_don_vi: string;
  ma_don_vi?: string;
  co_quan_don_vi_id?: string | null;
  CoQuanDonVi?: { id?: string; ten_don_vi?: string };
  DonViTrucThuoc?: UnitApiRow[];
}
