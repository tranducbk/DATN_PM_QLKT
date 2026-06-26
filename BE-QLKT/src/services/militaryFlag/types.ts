export interface PreviewError {
  row: number;
  ho_ten: string;
  nam: number | unknown;
  thang?: number | unknown;
  message: string;
}

export interface PreviewValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  thang: number;
  so_quyet_dinh: string | null;
  ghi_chu: string | null;
  history: {
    nam: number;
    so_quyet_dinh: string | null;
  }[];
}

export interface ConfirmImportItem {
  personnel_id: string;
  ho_ten: string;
  nam: number;
  thang?: number;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
}
