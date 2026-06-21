/** An award table row — may be a nested structure (adhoc, scientific, …). */
export interface AwardCore {
  id: string;
  cccd: string;
  ho_ten: string;
  ngay_sinh?: string;
  don_vi: string;
  co_quan_don_vi?: string;
  don_vi_truc_thuoc?: string;
  cap_bac?: string;
  chuc_vu: string;
  nam: number;
  thang?: number | null;
  danh_hieu: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
  mo_ta?: string | null;
  ten_de_tai?: string | null;
}

/** Display/filter row — includes nested adhoc/scientific records. */
export type AwardTableRow = AwardCore & {
  loai?: string;
  QuanNhan?: {
    ho_ten?: string;
    ngay_sinh?: string;
    CoQuanDonVi?: { ten_don_vi?: string };
    DonViTrucThuoc?: { ten_don_vi?: string; CoQuanDonVi?: { ten_don_vi?: string } };
  };
  CoQuanDonVi?: { ten_don_vi?: string };
  DonViTrucThuoc?: { ten_don_vi?: string; CoQuanDonVi?: { ten_don_vi?: string } };
};

export interface AwardFilters {
  nam: string;
  ho_ten: string;
  danh_hieu: string;
  de_tai: string;
}

export interface PersonnelDisplay {
  displayName: string;
  unitInfoText: string;
  parentUnit: string | null;
  ngaySinh?: string;
}

export interface AwardTypeFetchParams {
  limit?: number;
  page?: number;
  [key: string]: unknown;
}

export interface AwardTypeApiResult {
  success: boolean;
  message?: string;
  data?: AwardTableRow[];
}

export interface AwardTypeDeleteResult {
  success: boolean;
  message?: string;
}
