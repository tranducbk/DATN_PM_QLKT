export interface AnnualRewardRow {
  id?: string;
  nam: number;
  danh_hieu?: string | null;
  so_quyet_dinh?: string | null;
  so_quyet_dinh_bkbqp?: string | null;
  so_quyet_dinh_cstdtq?: string | null;
  so_quyet_dinh_bkttcp?: string | null;
  nhan_bkbqp?: boolean;
  nhan_cstdtq?: boolean;
  nhan_bkttcp?: boolean;
}

export interface ScientificAchievementRow {
  id?: string;
  nam: number;
  loai?: string;
  mo_ta?: string;
  so_quyet_dinh?: string | null;
  status?: string;
}

export interface PositionHistoryRow {
  id?: string;
  ngay_bat_dau?: string | null;
  ngay_ket_thuc?: string | null;
  ChucVu?: { ten_chuc_vu?: string; he_so_chuc_vu?: number | string } | null;
}

export interface AdhocAwardRow {
  id?: string;
  nam: number;
  hinh_thuc_khen_thuong?: string;
  cap_bac?: string;
  chuc_vu?: string;
  so_quyet_dinh?: string | null;
}
