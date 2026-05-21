import { DANH_HIEU_CA_NHAN_HANG_NAM, DANH_HIEU_DON_VI_HANG_NAM } from './danhHieu.constants';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  CHAIN AWARDS CONFIG — SINGLE SOURCE OF TRUTH cho rule chuỗi danh hiệu
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Đây là CONFIG DATA-DRIVEN — toàn bộ rule chuỗi BKBQP/CSTDTQ/BKTTCP
 *  được mô tả qua object thay vì code if/else. Lợi ích:
 *    1. Đổi rule (vd: cycle 2y → 3y) chỉ sửa số ở đây, không touch logic.
 *    2. Eligibility engine (`chainEligibility.ts`) generic 100% — dùng
 *       chung cho cả cá nhân và đơn vị thông qua config khác nhau.
 *    3. Báo cáo nghiệp vụ rõ ràng: 1 bảng config = 1 trang business rule.
 *
 *  CẤU TRÚC CONFIG (ChainAwardConfig):
 *
 *  - code:          mã danh hiệu (constant từ DANH_HIEU_*).
 *  - cycleYears:    số năm 1 chu kỳ (BKBQP=2, CSTDTQ=3, BKTTCP=7).
 *                   Quân nhân/đơn vị đạt streak >= cycleYears && %=0 → đủ.
 *  - requiredFlags: pre-requisite flag cần có trong cửa sổ trượt.
 *                   Vd: CSTDTQ cần 1 BKBQP trong 3y cuối.
 *                       BKTTCP personal cần 3 BKBQP + 2 CSTDTQ trong 7y.
 *  - requiresNCKH:  cá nhân TRUE (NCKH liên tục mỗi năm), đơn vị FALSE.
 *  - isLifetime:    chỉ BKTTCP cá nhân = TRUE (1 lần, block vĩnh viễn).
 *                   Còn lại FALSE (lặp lại theo cycle).
 *  - flagColumn:    tên cột boolean trong DB (DanhHieuHangNam.nhan_*).
 *  - streakLabel:   nhãn hiển thị message ('CSTDCS' cá nhân, 'ĐVQT' đơn vị).
 *
 *  ORDER (PERSONAL_CHAIN_AWARDS):
 *  Sắp xếp theo level tăng dần: BKBQP → CSTDTQ → BKTTCP.
 *  Lý do: khi loop iterate (vd: build gợi ý "có thể đạt..."), check theo
 *  thứ tự từ thấp đến cao → message ưu tiên danh hiệu cao nhất (BKTTCP)
 *  nếu đủ.
 *
 *  UNIT vs PERSONAL khác biệt:
 *  - Unit không có CSTDTQ → UNIT_CHAIN_AWARDS chỉ có 2 entry (BKBQP + BKTTCP).
 *  - Unit BKTTCP isLifetime=false (đơn vị nhận lặp lại).
 *  - Unit không requiresNCKH (đơn vị không tự nghiên cứu).
 *
 *  EXTEND khi có rule mới (vd: cấp Quốc gia thêm danh hiệu cao hơn BKTTCP):
 *  1. Thêm entry vào PERSONAL_CHAIN_AWARDS.
 *  2. Thêm DANH_HIEU constant.
 *  3. Thêm flag column vào schema.prisma + migrate.
 *  → Engine eligibility tự pick up, không cần sửa logic.
 * ════════════════════════════════════════════════════════════════════════════
 */

export interface ChainAwardConfig {
  /** Award code (BKBQP, CSTDTQ, BKTTCP, ...). */
  code: string;
  /** Streak cycle years (BKBQP=2, CSTDTQ=3, BKTTCP=7). */
  cycleYears: number;
  /** Required count of prerequisite flags within the streak window (e.g. BKTTCP needs 3 BKBQP + 2 CSTDTQ). */
  requiredFlags: { code: string; count: number }[];
  /** Whether NCKH every year is required (personal awards only — units do not track NCKH). */
  requiresNCKH: boolean;
  /** One-time award: receiving once permanently blocks future proposals. */
  isLifetime: boolean;
  /** DB flag column name (`nhan_bkbqp`, `nhan_cstdtq`, `nhan_bkttcp`). */
  flagColumn: string;
  /** Vietnamese label for "streak unit" used in messages: 'CSTDCS' (personal) or 'ĐVQT' (unit). */
  streakLabel: string;
}

/** Personal annual chain awards — ordered by ascending eligibility level. */
export const PERSONAL_CHAIN_AWARDS: ChainAwardConfig[] = [
  {
    code: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
    cycleYears: 2,
    requiredFlags: [],
    requiresNCKH: true,
    isLifetime: false,
    flagColumn: 'nhan_bkbqp',
    streakLabel: 'CSTDCS',
  },
  {
    code: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
    cycleYears: 3,
    requiredFlags: [{ code: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP, count: 1 }],
    requiresNCKH: true,
    isLifetime: false,
    flagColumn: 'nhan_cstdtq',
    streakLabel: 'CSTDCS',
  },
  {
    code: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
    cycleYears: 7,
    requiredFlags: [
      { code: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP, count: 3 },
      { code: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ, count: 2 },
    ],
    requiresNCKH: true,
    isLifetime: true,
    flagColumn: 'nhan_bkttcp',
    streakLabel: 'CSTDCS',
  },
];

/** Unit annual chain awards — units do not have CSTDTQ tier. */
export const UNIT_CHAIN_AWARDS: ChainAwardConfig[] = [
  {
    code: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
    cycleYears: 2,
    requiredFlags: [],
    requiresNCKH: false,
    isLifetime: false,
    flagColumn: 'nhan_bkbqp',
    streakLabel: 'ĐVQT',
  },
  {
    code: DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
    cycleYears: 7,
    requiredFlags: [{ code: DANH_HIEU_DON_VI_HANG_NAM.BKBQP, count: 3 }],
    requiresNCKH: false,
    isLifetime: false,
    flagColumn: 'nhan_bkttcp',
    streakLabel: 'ĐVQT',
  },
];

/**
 * Looks up a chain-award config by code.
 * @param awards - Award list (PERSONAL_CHAIN_AWARDS or UNIT_CHAIN_AWARDS)
 * @param code - Danh hieu code
 * @returns Matching config or undefined
 */
export function findChainAwardConfig(
  awards: ChainAwardConfig[],
  code: string
): ChainAwardConfig | undefined {
  return awards.find(a => a.code === code);
}
