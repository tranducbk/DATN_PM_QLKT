export interface ContributionTimeAggregate {
  total_months: number;
  years: number;
  months: number;
  display: string;
}

export interface TitleDataItem {
  personnel_id?: string;
  don_vi_id?: string;
  don_vi_type?: 'CO_QUAN_DON_VI' | 'DON_VI_TRUC_THUOC';
  danh_hieu?: string;
  nam?: number;
  thang?: number;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  ghi_chu?: string;
  so_quyet_dinh?: string | null;
  so_quyet_dinh_bkbqp?: string | null;
  so_quyet_dinh_cstdtq?: string | null;
  so_quyet_dinh_bkttcp?: string | null;
  nhan_bkbqp?: boolean;
  nhan_cstdtq?: boolean;
  nhan_bkttcp?: boolean;
  loai?: 'DTKH' | 'SKKH';
  mo_ta?: string;
  thoi_gian_nhom_0_7?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_8?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_9_1_0?: ContributionTimeAggregate | null;
}

export interface DecisionRef {
  id?: string;
  nam: number;
  thang?: number;
  ngay_quyet_dinh?: string;
  ngay_ky?: string;
  nguoi_ky?: string;
  so_quyet_dinh?: string;
}

export interface DecisionData {
  so_quyet_dinh: string;
  decision?: DecisionRef | null;
}

export type DecisionDataMap = Record<string, DecisionData>;
