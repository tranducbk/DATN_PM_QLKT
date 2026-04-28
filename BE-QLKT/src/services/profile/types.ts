import type {
  DanhHieuHangNam,
  ThanhTichKhoaHoc,
  QuanNhan,
} from '../../generated/prisma';

export interface HCCSVVCalcResult {
  status: string;
  ngay: Date | null;
  goiY: string;
}

export interface HCBVTQCalcResult {
  status: string;
  ngay: Date | null;
  goiY: string;
}

export interface SpecialCaseResult {
  isSpecialCase: boolean;
  goiY: string;
  resetChain: boolean;
}

export interface NCKHYearsResult {
  hasNCKH: boolean;
  years: number[];
}

export interface ChainContext {
  chainStartYear: number;
  lastBkbqpYear: number | null;
  lastCstdtqYear: number | null;
  lastBkttcpYear: number | null;
  streakSinceLastBkbqp: number;
  streakSinceLastCstdtq: number;
  streakSinceLastBkttcp: number;
  missedBkbqp: number;
  missedCstdtq: number;
}

export interface AnnualStreakResult {
  personnel: QuanNhan & {
    DanhHieuHangNam: DanhHieuHangNam[];
    ThanhTichKhoaHoc: ThanhTichKhoaHoc[];
  };
  danhHieuList: DanhHieuHangNam[];
  thanhTichList: ThanhTichKhoaHoc[];
  cstdcs_lien_tuc: number;
  nckh_lien_tuc: number;
  bkbqp_lien_tuc: number;
  cstdtq_lien_tuc: number;
  chainContext: ChainContext;
}

export interface TenureProfileUpdate {
  hccsvv_hang_ba_status?: string;
  hccsvv_hang_nhi_status?: string;
  hccsvv_hang_nhat_status?: string;
  hcbvtq_hang_ba_status?: string;
  hcbvtq_hang_nhi_status?: string;
  hcbvtq_hang_nhat_status?: string;
}

export interface RecalculateResult {
  message: string;
  success: number;
  errors: Array<{ personnelId: string; hoTen: string; error: string }>;
}
