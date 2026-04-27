export interface CreateAnnualRewardData {
  personnel_id: string;
  nam: number;
  danh_hieu?: string | null;
  so_quyet_dinh?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  ghi_chu?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
}

export interface UpdateAnnualRewardData {
  nam?: number;
  danh_hieu?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  ghi_chu?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
}

export interface ImportResult {
  imported: number;
  total: number;
  errors: string[];
  selectedPersonnelIds: string[];
  titleData: Record<string, unknown>[];
}

export interface PreviewError {
  row: number;
  ho_ten: string;
  nam: unknown;
  danh_hieu?: string;
  message: string;
}

export interface PreviewValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  danh_hieu: string;
  so_quyet_dinh: string | null;
  ghi_chu: string | null;
  history: Record<string, unknown>[];
}

export interface PreviewResult {
  total: number;
  valid: PreviewValidItem[];
  errors: PreviewError[];
}

export interface ConfirmImportItem {
  personnel_id: string;
  ho_ten: string;
  nam: number;
  danh_hieu: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  so_quyet_dinh_bkbqp?: string | null;
  so_quyet_dinh_cstdtq?: string | null;
  so_quyet_dinh_bkttcp?: string | null;
  nhan_bkbqp?: boolean;
  nhan_cstdtq?: boolean;
  nhan_bkttcp?: boolean;
  ghi_chu?: string | null;
}

export interface CheckResult {
  personnel_id: string;
  has_reward: boolean;
  has_proposal: boolean;
  reward: Record<string, unknown> | null;
  proposal: Record<string, unknown> | null;
}

export interface BulkCreateData {
  personnel_ids: string[];
  personnel_rewards_data?: {
    personnel_id: string;
    so_quyet_dinh?: string;
    cap_bac?: string;
    chuc_vu?: string;
  }[];
  nam: number;
  danh_hieu: string;
  ghi_chu?: string;
  so_quyet_dinh?: string;
  cap_bac?: string;
  chuc_vu?: string;
}

export interface ExportFilters {
  nam?: number;
  danh_hieu?: string;
  don_vi_id?: string;
  personnel_ids?: string[];
}

export interface StatisticsFilters {
  nam?: number;
  don_vi_id?: string;
}
