import type { DateInput } from '@/lib/types/common';

/** Personnel record shape used by Step2 personnel-selection components. */
export interface Step2Personnel {
  id: string;
  ho_ten: string;
  cccd: string;
  cap_bac?: string;
  gioi_tinh?: string | null;
  ngay_sinh?: string | null;
  co_quan_don_vi_id: string;
  don_vi_truc_thuoc_id: string;
  chuc_vu_id: string;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
  CoQuanDonVi?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
  };
  DonViTrucThuoc?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    CoQuanDonVi?: {
      id: string;
      ten_don_vi: string;
      ma_don_vi: string;
    };
  };
  ChucVu?: {
    id: string;
    ten_chuc_vu: string;
  };
}


/** Generic shape returned by local Excel processing. */
export interface Step2LocalImportResult<TTitle> {
  imported: number;
  total: number;
  errors: string[];
  selectedPersonnelIds?: string[];
  selectedUnitIds?: string[];
  titleData: TTitle[];
}

/** Loose award/achievement payload returned by BE preview/import APIs. */
export interface Step2ImportedAward {
  quan_nhan_id?: string;
  personnel_id?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  danh_hieu?: string;
  loai?: string;
  mo_ta?: string;
  nam?: number;
  thang?: number;
  cap_bac?: string;
  chuc_vu?: string;
  ghi_chu?: string;
}

/** Result handed off to Step2 onImportSuccess handlers. */
export interface Step2ImportSuccessResult {
  selectedPersonnelIds?: string[];
  selectedUnitIds?: string[];
  titleData?: Step2ImportedAward[];
}

/** Single result item from `checkDuplicateBatch`/`checkDuplicateUnitBatch` BE responses. */
export interface DuplicateCheckResult {
  exists: boolean;
  message?: string;
  personnel_id?: string;
  don_vi_id?: string;
}

/** Raw row read from a sheet using `XLSX.utils.sheet_to_json({ header: 1 })`. */
export type ExcelRow = (string | number | null | undefined)[];
