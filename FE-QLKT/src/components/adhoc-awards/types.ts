import { MILITARY_RANKS } from '@/constants/militaryRanks.constants';

export interface AdhocAward {
  id: string;
  loai: string;
  doi_tuong: 'CA_NHAN' | 'TAP_THE';
  quan_nhan_id?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  hinh_thuc_khen_thuong: string;
  nam: number;
  cap_bac?: string;
  chuc_vu?: string;
  ghi_chu?: string;
  so_quyet_dinh?: string;
  files_dinh_kem?: FileInfo[];
  createdAt: string;
  QuanNhan?: {
    id: string;
    ho_ten: string;
    cccd?: string;
    cap_bac?: string;
    CoQuanDonVi?: { ten_don_vi: string };
    DonViTrucThuoc?: { ten_don_vi: string };
    ChucVu?: { ten_chuc_vu: string };
  };
  CoQuanDonVi?: { id: string; ten_don_vi: string };
  DonViTrucThuoc?: { id: string; ten_don_vi: string; CoQuanDonVi?: { ten_don_vi: string } };
}

export interface FileInfo {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface Personnel {
  id: string;
  ho_ten: string;
  cccd?: string;
  ngay_sinh?: string;
  gioi_tinh?: string;
  cap_bac?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  ChucVu?: { ten_chuc_vu: string };
}

export interface Unit {
  id: string;
  ten_don_vi: string;
  ma_don_vi?: string;
  co_quan_don_vi_id?: string;
}

export interface DecisionAutocompleteRow {
  so_quyet_dinh: string;
  nguoi_ky: string;
  ngay_ky: string;
  file_path?: string | null;
}

export interface PersonnelAwardInfo {
  personnelId: string;
  rank: string;
  position: string;
}

export interface CreateFormData {
  type: 'CA_NHAN' | 'TAP_THE';
  year: number;
  awardForm: string;
  personnelIds: string[];
  personnelAwardInfo: PersonnelAwardInfo[];
  unitIds: string[];
  note: string;
  decisionNumber: string;
  decisionYear: number;
  signer: string;
  signDate: string;
  decisionFilePath?: string | null;
  currentStep: number;
}

export interface EditFormData {
  awardForm: string;
  year: number;
  rank: string;
  position: string;
  note: string;
  decisionNumber: string;
}

export interface TableFilters {
  year: number | null;
  searchText: string;
  type: 'ALL' | 'CA_NHAN' | 'TAP_THE';
}

export const INITIAL_CREATE_FORM: CreateFormData = {
  type: 'CA_NHAN',
  year: new Date().getFullYear(),
  awardForm: '',
  personnelIds: [],
  personnelAwardInfo: [],
  unitIds: [],
  note: '',
  decisionNumber: '',
  decisionYear: new Date().getFullYear(),
  signer: '',
  signDate: '',
  currentStep: 0,
};

export const INITIAL_EDIT_FORM: EditFormData = {
  awardForm: '',
  year: new Date().getFullYear(),
  rank: '',
  position: '',
  note: '',
  decisionNumber: '',
};

export const INITIAL_TABLE_FILTERS: TableFilters = {
  year: null,
  searchText: '',
  type: 'ALL',
};

export const RANK_OPTIONS = MILITARY_RANKS.map(r => ({ value: r, label: r }));
