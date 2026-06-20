export interface CommemorativeMedalValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string | null;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  thang: number;
  so_quyet_dinh: string;
  ghi_chu: string | null;
  service_years: number;
  gioi_tinh: string;
  history: Array<{ nam: number; so_quyet_dinh: string | null }>;
}
