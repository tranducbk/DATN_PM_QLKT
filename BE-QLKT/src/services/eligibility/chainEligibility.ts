import type { ChainAwardConfig } from '../../constants/chainAwards.constants';
import { getDanhHieuName } from '../../constants/danhHieu.constants';

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
}

interface ChainStreaks {
  streakLength: number;
  nckhStreak: number;
}

export type FlagsInWindow = Record<string, number>;

/**
 * Counts rows whose `flagKey` is true within the trailing window `[year-rangeYears, year-1]`.
 * @param danhHieuList - Annual title rows (personal or unit)
 * @param year - Evaluation anchor year (window ends at year-1)
 * @param rangeYears - Window length in years (typically the award's cycleYears)
 * @param flagKey - Boolean flag column to count (e.g. `nhan_bkbqp`)
 * @returns Count of matching rows in the window
 */
export function countFlagInWindow(
  danhHieuList: Array<Record<string, unknown> & { nam: number }>,
  year: number,
  rangeYears: number,
  flagKey: string
): number {
  const endYear = year - 1;
  const startYear = endYear - rangeYears + 1;
  return danhHieuList.filter(r => r[flagKey] === true && r.nam >= startYear && r.nam <= endYear).length;
}

/**
 * Builds a concise insufficient-eligibility reason.
 * @param award - Award config
 * @param streaks - Current streak counters
 * @param flagsInWindow - Prerequisite flags found in streak window
 * @returns Human-readable reason text
 */
function buildInsufficientReason(
  award: ChainAwardConfig,
  streaks: ChainStreaks,
  flagsInWindow: FlagsInWindow
): string {
  const name = getDanhHieuName(award.code);
  const required: string[] = [`${award.cycleYears} năm ${award.streakLabel} liên tục`];
  award.requiredFlags.forEach(f => required.push(`${f.count} ${f.code}`));
  if (award.requiresNCKH) required.push('NCKH mỗi năm');

  const current: string[] = [`${streaks.streakLength} năm ${award.streakLabel}`];
  award.requiredFlags.forEach(f => current.push(`${flagsInWindow[f.code] ?? 0} ${f.code}`));
  if (award.requiresNCKH) current.push(`${streaks.nckhStreak} năm NCKH`);

  return `Chưa đủ điều kiện ${name}.\nYêu cầu: ${required.join(', ')}.\nHiện có: ${current.join(', ')}.`;
}

/**
 * Generic config-driven chain-eligibility checker.
 * @param award - Award config
 * @param streaks - Current streak counters
 * @param hasReceived - Whether already received this award
 * @param flagsInWindow - Counts of prerequisite flags
 * @returns Eligibility result and reason
 */
export function checkChainEligibility(
  award: ChainAwardConfig,
  streaks: ChainStreaks,
  hasReceived: boolean,
  flagsInWindow: FlagsInWindow
): EligibilityResult {
  const name = getDanhHieuName(award.code);

  if (award.isLifetime && hasReceived) {
    return {
      eligible: false,
      reason: `Đã có ${name}. Phần mềm chưa hỗ trợ các danh hiệu cao hơn ${name}, sẽ phát triển trong thời gian tới.`,
    };
  }

  const isCycleComplete =
    streaks.streakLength >= award.cycleYears &&
    streaks.streakLength % award.cycleYears === 0;
  const hasRequiredFlags = award.requiredFlags.every(f => {
    const have = flagsInWindow[f.code] ?? 0;
    return award.isLifetime ? have === f.count : have >= f.count;
  });
  const hasEnoughResearch = !award.requiresNCKH || streaks.nckhStreak >= streaks.streakLength;

  if (isCycleComplete && hasRequiredFlags && hasEnoughResearch) {
    return { eligible: true, reason: `Đủ điều kiện ${name}.` };
  }

  return { eligible: false, reason: buildInsufficientReason(award, streaks, flagsInWindow) };
}
