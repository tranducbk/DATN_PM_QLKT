import type { ContributionTimeAggregate } from '@/lib/types/proposal';

export interface DanhHieuItem {
  personnel_id?: string;
  don_vi_id?: string;
  don_vi_type?: 'CO_QUAN_DON_VI' | 'DON_VI_TRUC_THUOC';
  ho_ten?: string;
  nam_quyet_dinh?: number;
  ten_don_vi?: string;
  ma_don_vi?: string;
  nam: number;
  thang?: number | null;
  danh_hieu: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
  file_quyet_dinh?: string | null;
  file_quyet_dinh_bkbqp?: string | null;
  file_quyet_dinh_cstdtq?: string | null;
  ngay_nhan?: string | null;
  thang_nhan?: number | null;
  nam_nhan?: number | null;
  thoi_gian_nhom_0_7?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_8?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_9_1_0?: ContributionTimeAggregate | null;
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
  co_quan_don_vi_cha?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
  } | null;
}

export interface ThanhTichItem {
  personnel_id: string;
  ho_ten: string;
  nam: number;
  loai: string;
  mo_ta: string;
  status: string;
  so_quyet_dinh?: string;
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

export interface ReviewerAccount {
  id: string;
  username: string;
  ho_ten?: string;
}

export interface PositionHistoryEntry {
  he_so_chuc_vu?: number;
  so_thang?: number | null;
}

export interface DecisionPayload {
  loai_khen_thuong?: string;
  so_quyet_dinh?: string;
  file_path?: string | null;
  nam?: number;
}

export interface ApprovalImportSummary {
  imported_danh_hieu?: number;
  total_danh_hieu?: number;
  imported_thanh_tich?: number;
  total_thanh_tich?: number;
  imported_nien_han?: number;
  total_nien_han?: number;
  errors?: string[];
}

export interface UnitInfoSource {
  co_quan_don_vi?: { ten_co_quan_don_vi: string } | null;
  don_vi_truc_thuoc?: { ten_don_vi: string } | null;
}

export interface ProposalDetail {
  id: string;
  loai_de_xuat: string;
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
  data_nien_han: DanhHieuItem[];
  data_cong_hien: DanhHieuItem[];
  files_attached?: Array<{
    filename: string;
    originalName: string;
    size?: number;
    uploadedAt?: string;
  }>;
  ghi_chu: string | null;
  nguoi_duyet: ReviewerAccount | null;
  ngay_duyet: string | null;
  createdAt: string;
  updatedAt: string;
}
