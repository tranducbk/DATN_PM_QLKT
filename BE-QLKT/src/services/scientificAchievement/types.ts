export interface PreviewError {
  row: number;
  ho_ten: string;
  nam: number | unknown;
  loai?: string;
  message: string;
}

export interface PreviewValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  loai: string;
  mo_ta: string;
  so_quyet_dinh: string | null;
  ghi_chu: string | null;
  history: {
    nam: number;
    loai: string;
    mo_ta: string;
    so_quyet_dinh: string | null;
  }[];
}

export interface ConfirmImportItem {
  personnel_id: string;
  nam: number;
  loai: string;
  mo_ta: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
}
