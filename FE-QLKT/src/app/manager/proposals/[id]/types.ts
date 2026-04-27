import type { ProposalType } from '@/constants/proposal.constants';

export interface DanhHieuItem {
  personnel_id: string;
  ho_ten: string;
  nam: number;
  thang?: number | null;
  danh_hieu: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  thang_nhan?: number | null;
  nam_nhan?: number | null;
  // Legacy scalar fields (kept for backward compatibility)
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  file_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
  file_quyet_dinh_cstdtq?: string | null;
  thoi_gian_nhom_0_7?: {
    display?: string;
    years?: number;
    months?: number;
  } | null;
  thoi_gian_nhom_0_8?: {
    display?: string;
    years?: number;
    months?: number;
  } | null;
  thoi_gian_nhom_0_9_1_0?: {
    display?: string;
    years?: number;
    months?: number;
  } | null;
  co_quan_don_vi?: {
    id: string;
    ten_co_quan_don_vi: string;
    ma_co_quan_don_vi: string;
  } | null;
  don_vi_truc_thuoc?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    co_quan_don_vi?: {
      id: string;
      ten_don_vi_truc: string;
      ma_don_vi: string;
    } | null;
  } | null;
}

export interface ThanhTichItem {
  personnel_id: string;
  ho_ten: string;
  nam: number;
  loai: string;
  mo_ta: string;
  status: string;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  co_quan_don_vi?: {
    id: string;
    ten_co_quan_don_vi: string;
    ma_co_quan_don_vi: string;
  } | null;
  don_vi_truc_thuoc?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    co_quan_don_vi?: {
      id: string;
      ten_don_vi_truc: string;
      ma_don_vi: string;
    } | null;
  } | null;
}

export interface AttachedFile {
  filename: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

export interface ReviewerAccount {
  id: string;
  username: string;
  ho_ten?: string;
}

export interface PositionHistoryEntry {
  he_so_chuc_vu?: number;
  so_thang?: number | null;
}

export interface DurationDisplay {
  display?: string;
  years?: number;
  months?: number;
}

export interface ProposalDetail {
  id: string;
  loai_de_xuat: ProposalType;
  nam: number;
  thang?: number;
  don_vi: {
    id: string;
    ma_don_vi: string;
    ten_don_vi: string;
  };
  nguoi_de_xuat: {
    id: string;
    username: string;
    ho_ten: string;
  };
  status: string;
  data_danh_hieu: DanhHieuItem[];
  data_thanh_tich: ThanhTichItem[];
  data_nien_han?: DanhHieuItem[];
  data_cong_hien?: DanhHieuItem[];
  files_attached: AttachedFile[];
  nguoi_duyet: ReviewerAccount | null;
  ngay_duyet: string | null;
  ghi_chu: string | null;
  rejection_reason: string | null;
  createdAt: string;
  updatedAt: string;
}
