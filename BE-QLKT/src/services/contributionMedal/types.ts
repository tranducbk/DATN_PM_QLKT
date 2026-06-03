export interface ContributionAwardValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string | null;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  thang: number;
  danh_hieu: string;
  so_quyet_dinh: string;
  ghi_chu: string | null;
  history: Array<{ nam: number; danh_hieu: string; so_quyet_dinh: string | null }>;
}
