import type { DanhHieuHangNam } from '../../generated/prisma';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../constants/danhHieu.constants';
import { PERSONAL_CHAIN_AWARDS, findChainAwardConfig } from '../../constants/chainAwards.constants';
import {
  checkChainEligibility,
  countFlagInWindow,
  type EligibilityResult,
  type FlagsInWindow,
} from './chainEligibility';

const FLAG_COLUMN_MAP: Record<string, keyof DanhHieuHangNam> = {
  [DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP]: 'nhan_bkbqp',
  [DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ]: 'nhan_cstdtq',
  [DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP]: 'nhan_bkttcp',
};

/** Maps a chain award code to its boolean flag column on `DanhHieuHangNam`. */
export function flagColumnFor(code: string): keyof DanhHieuHangNam | '' {
  return FLAG_COLUMN_MAP[code] ?? '';
}

/**
 * Single rule-engine entry point for personal chain awards (BKBQP/CSTDTQ/BKTTCP).
 * Both `recalculateAnnualProfile.computeEligibilityFlags` and the proposal-time
 * `checkAwardEligibility` call this so the two paths cannot diverge on cycle
 * semantics. Cycle uses `cstdcs_lien_tuc % cycleYears === 0` per business rule
 * "BKBQP cứ mỗi 2y, CSTDTQ mỗi 3y, BKTTCP mỗi 7y".
 * @param code - BKBQP / CSTDTQ / BKTTCP code
 * @param danhHieuList - Annual title rows for this personnel
 * @param year - Evaluation anchor year
 * @param cstdcsLienTuc - Continuous CSTDCS streak ending at year-1
 * @param nckhLienTuc - Continuous NCKH streak ending at year-1
 * @returns Eligibility result + reason; `eligible: true` when the rule is satisfied
 */
export function evaluatePersonalChain(
  code: string,
  danhHieuList: Array<Record<string, unknown> & { nam: number }>,
  year: number,
  cstdcsLienTuc: number,
  nckhLienTuc: number
): EligibilityResult {
  const config = findChainAwardConfig(PERSONAL_CHAIN_AWARDS, code);
  if (!config) return { eligible: true, reason: '' };

  const flagsInWindow: FlagsInWindow = {};
  config.requiredFlags.forEach(f => {
    flagsInWindow[f.code] = countFlagInWindow(danhHieuList, year, config.cycleYears, flagColumnFor(f.code));
  });

  const hasReceived = config.isLifetime
    ? danhHieuList.some(r => r[config.flagColumn] === true)
    : false;

  return checkChainEligibility(
    config,
    { streakLength: cstdcsLienTuc, nckhStreak: nckhLienTuc },
    hasReceived,
    flagsInWindow
  );
}
