import { DANH_HIEU_CA_NHAN_HANG_NAM, DANH_HIEU_DON_VI_HANG_NAM } from './danhHieu.constants';

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
  /**
   * When true, a streak that overshoots the cycle without landing on a boundary multiple
   * yields a "missed window" reason instead of "Chưa đủ điều kiện…". Applies to awards where
   * skipping a cycle requires a fresh chain (CSTDTQ, BKTTCP). BKBQP keeps the simple cadence
   * (its 2-year cycle is too short for the missed-window concept to be meaningful).
   */
  enforceMissedWindow: boolean;
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
    enforceMissedWindow: false,
  },
  {
    code: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
    cycleYears: 3,
    requiredFlags: [{ code: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP, count: 1 }],
    requiresNCKH: true,
    isLifetime: false,
    flagColumn: 'nhan_cstdtq',
    streakLabel: 'CSTDCS',
    enforceMissedWindow: true,
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
    enforceMissedWindow: true,
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
    enforceMissedWindow: false,
  },
  {
    code: DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
    cycleYears: 7,
    requiredFlags: [{ code: DANH_HIEU_DON_VI_HANG_NAM.BKBQP, count: 3 }],
    requiresNCKH: false,
    isLifetime: true,
    flagColumn: 'nhan_bkttcp',
    streakLabel: 'ĐVQT',
    enforceMissedWindow: true,
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
