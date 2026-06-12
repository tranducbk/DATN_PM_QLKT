import { UNIT_CHAIN_AWARDS, findChainAwardConfig } from '../../constants/chainAwards.constants';
import { checkChainEligibility, type FlagsInWindow, type EligibilityResult } from './chainEligibility';

/**
 * Resolves the unit chain-award config for a danh hiệu code.
 * @param code - Unit award code (BKBQP / BKTTCP)
 * @returns Chain-award config, or `null` when the code is not a unit chain award
 */
export function getUnitChainConfig(code: string) {
  return findChainAwardConfig(UNIT_CHAIN_AWARDS, code);
}

/**
 * Shared unit chain-award rule engine. Both `recalculateAnnualUnit` and the
 * proposal-time `checkUnitAwardEligibility` call this so the two paths cannot
 * diverge on cycle semantics — mirrors `evaluatePersonalChain`. Cycle uses raw
 * `dvqt_lien_tuc % cycleYears` (the streak does not reset after an award).
 * @param code - Unit award code (BKBQP / BKTTCP)
 * @param dvqtLienTuc - Continuous ĐVQT streak ending at year-1
 * @param flagsInWindow - Counts of prerequisite flags within the cycle window
 * @param hasReceived - Whether already received (lifetime awards only)
 * @returns Eligibility result + reason
 */
export function evaluateUnitChain(
  code: string,
  dvqtLienTuc: number,
  flagsInWindow: FlagsInWindow,
  hasReceived = false
): EligibilityResult {
  const config = getUnitChainConfig(code);
  if (!config) return { eligible: true, reason: '' };

  return checkChainEligibility(
    config,
    { streakLength: dvqtLienTuc, nckhStreak: 0 },
    hasReceived,
    flagsInWindow
  );
}
