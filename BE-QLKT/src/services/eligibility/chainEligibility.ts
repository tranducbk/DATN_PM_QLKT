import type { ChainAwardConfig } from '../../constants/chainAwards.constants';
import { getDanhHieuName } from '../../constants/danhHieu.constants';

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
}

export interface ChainStreaks {
  streakLength: number;
  nckhStreak: number;
}

export type FlagsInWindow = Record<string, number>;

/**
 * Builds a concise insufficient-eligibility reason.
 * @param award - Award config
 * @param streaks - Current streak counters
 * @param flagsInWindow - Prerequisite flags found in streak window
 * @returns Human-readable reason text
 */
export function buildInsufficientReason(
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

  const cycleMet =
    streaks.streakLength >= award.cycleYears &&
    streaks.streakLength % award.cycleYears === 0;
  const flagsMet = award.requiredFlags.every(f => {
    const have = flagsInWindow[f.code] ?? 0;
    return award.isLifetime ? have === f.count : have >= f.count;
  });
  const nckhMet = !award.requiresNCKH || streaks.nckhStreak >= streaks.streakLength;

  if (cycleMet && flagsMet && nckhMet) {
    return { eligible: true, reason: `Đủ điều kiện ${name}.` };
  }

  return { eligible: false, reason: buildInsufficientReason(award, streaks, flagsInWindow) };
}
