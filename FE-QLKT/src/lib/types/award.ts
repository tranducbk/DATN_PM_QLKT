export interface AnnualRewardRecord {
  id: string;
  quan_nhan_id: string;
  nam: number;
  danh_hieu: string | null;
  so_quyet_dinh: string | null;
  cap_bac: string | null;
  chuc_vu: string | null;
  ghi_chu: string | null;
  nhan_bkbqp: boolean;
  so_quyet_dinh_bkbqp: string | null;
  ghi_chu_bkbqp: string | null;
  nhan_cstdtq: boolean;
  so_quyet_dinh_cstdtq: string | null;
  ghi_chu_cstdtq: string | null;
  nhan_bkttcp: boolean;
  so_quyet_dinh_bkttcp: string | null;
  ghi_chu_bkttcp: string | null;
}

export interface UnitAnnualRewardRecord {
  id: string;
  co_quan_don_vi_id: string | null;
  don_vi_truc_thuoc_id: string | null;
  nam: number;
  danh_hieu: string | null;
  so_quyet_dinh: string | null;
  ghi_chu: string | null;
  nhan_bkbqp: boolean;
  so_quyet_dinh_bkbqp: string | null;
  ghi_chu_bkbqp: string | null;
  nhan_bkttcp: boolean;
  so_quyet_dinh_bkttcp: string | null;
  ghi_chu_bkttcp: string | null;
}
