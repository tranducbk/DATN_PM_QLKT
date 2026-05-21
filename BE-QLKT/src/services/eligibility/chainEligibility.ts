import type { ChainAwardConfig } from '../../constants/chainAwards.constants';
import { getDanhHieuName } from '../../constants/danhHieu.constants';

/*
 * ============================================================================
 *  CHAIN AWARDS ELIGIBILITY — checker chuỗi danh hiệu BKBQP/CSTDTQ/BKTTCP
 * ============================================================================
 *
 *  Đây là "core engine" cho 3 danh hiệu cao hơn CSTDCS/ĐVQT, đều có chung
 *  pattern "phải đạt liên tục N năm + đã có X danh hiệu cấp dưới trong cửa
 *  sổ N năm cuối" — gọi chung là CHAIN AWARDS (chuỗi danh hiệu).
 *
 *  3 CHU KỲ (cycleYears):
 *      BKBQP  (Bằng khen Bộ Quốc phòng)         = 2  năm CSTDCS / ĐVQT
 *      CSTDTQ (Chiến sĩ Thi đua Toàn quân)     = 3  năm + 1 BKBQP trong 3y
 *      BKTTCP (Bằng khen Thủ tướng Chính phủ)  = 7  năm + 3 BKBQP + 2 CSTDTQ
 *
 *  CYCLE LẶP LẠI: sau khi đạt 1 lần, đếm tiếp đến mốc kế tiếp lại được xét.
 *  Vd: được BKBQP năm 2024 (sau 2y CSTDCS 2023-2024) → tới năm 2026 (thêm 2y
 *  liên tục) lại đủ điều kiện đề xuất BKBQP lần 2. Công thức:
 *      cycleMet = (streak >= cycleYears) AND (streak % cycleYears === 0)
 *
 *  LỠ ĐỢT (missed cycle): nếu năm đến hạn nhưng không đề xuất, cycle TIẾP
 *  TỤC ĐẾM, KHÔNG reset chuỗi CSTDCS/ĐVQT. Đến chu kỳ kế tiếp lại được xét.
 *  Vd: đủ BKBQP năm 2024 mà bỏ qua → năm 2026 lại đủ (vẫn % 2 === 0).
 *
 *  LIFETIME (isLifetime=true): BKTTCP CÁ NHÂN — sau khi nhận 1 lần thì
 *  KHÔNG bao giờ được nhận lại. Block bằng `hasReceived` flag.
 *  Tất cả chuỗi đơn vị + BKBQP/CSTDTQ cá nhân đều isLifetime=false
 *  (được nhận lặp lại theo cycle).
 *
 *  CỬA SỔ TRƯỢT (sliding window):
 *      CSTDTQ đếm BKBQP: cửa sổ 3 năm cuối (year-2 → year). BKBQP của chu
 *                        kỳ trước sẽ tự rơi khỏi cửa sổ → BUỘC phải có
 *                        BKBQP MỚI trong chu kỳ hiện tại.
 *      BKTTCP đếm BKBQP/CSTDTQ: cửa sổ 7 năm cuối, logic tương tự.
 *
 *  STRICT vs NON-STRICT (`have === count` vs `have >= count`):
 *      Personal BKTTCP (isLifetime): strict equality — vì chỉ được 1 lần.
 *      Unit BKTTCP (non-lifetime):  >= count vì có thể nhận lặp.
 * ============================================================================
 */

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
}

/**
 * Đếm streak hiện tại của quân nhân/đơn vị:
 *  - streakLength: số năm CSTDCS/ĐVQT liên tục tính đến thời điểm xét.
 *  - nckhStreak:   số năm có nghiên cứu khoa học liên tục (chỉ cá nhân;
 *                  đơn vị không có NCKH).
 */
export interface ChainStreaks {
  streakLength: number;
  nckhStreak: number;
}

/**
 * Map đếm số flag (BKBQP/CSTDTQ) xuất hiện trong cửa sổ trượt N năm.
 * Key = mã danh hiệu, value = số lần xuất hiện.
 * Vd: { BKBQP: 3, CSTDTQ: 2 } → đủ điều kiện BKTTCP cá nhân.
 */
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
/**
 * Checker generic — dùng chung cho cả 6 chain award (3 cá nhân + 3 đơn vị)
 * thông qua config `ChainAwardConfig`.
 *
 *  THUẬT TOÁN (3 điều kiện AND lại):
 *  1. cycleMet:  streak >= cycleYears && streak % cycleYears === 0
 *                (đến đúng mốc chu kỳ; lỡ chu kỳ này thì đợi chu kỳ kế).
 *
 *  2. flagsMet:  đủ flag prerequisite trong cửa sổ.
 *                - isLifetime → strict `===` (1 lần duy nhất, không cho dư).
 *                - non-lifetime → `>=` (lặp lại nên dư flag không vấn đề).
 *
 *  3. nckhMet:   nếu yêu cầu NCKH thì nckhStreak phải bằng streakLength
 *                (NCKH liên tục TỪNG NĂM trong suốt chuỗi CSTDCS).
 *                Đơn vị không có NCKH → award.requiresNCKH=false → bỏ qua.
 *
 *  LIFETIME BLOCK: với personal BKTTCP, một khi `hasReceived=true` thì
 *  trả về reason đặc biệt "chưa hỗ trợ cao hơn ...". Trường hợp này CHẶN
 *  TUYỆT ĐỐI, không xét cycle/flags/nckh nữa.
 *
 *  @example
 *      // Cá nhân CSTDTQ năm 2026, đã có 3y CSTDCS + 1 BKBQP năm 2025
 *      checkChainEligibility(
 *        award: { code: 'CSTDTQ', cycleYears: 3, requiredFlags: [{code:'BKBQP', count:1}], requiresNCKH: true },
 *        streaks: { streakLength: 3, nckhStreak: 3 },
 *        hasReceived: false,
 *        flagsInWindow: { BKBQP: 1 }
 *      )
 *      // → { eligible: true }  vì 3>=3 && 3%3===0 && have 1>=1 && nckh 3>=3
 */
export function checkChainEligibility(
  award: ChainAwardConfig,
  streaks: ChainStreaks,
  hasReceived: boolean,
  flagsInWindow: FlagsInWindow
): EligibilityResult {
  const name = getDanhHieuName(award.code);

  // Chặn hard cho danh hiệu lifetime đã nhận (chỉ áp dụng BKTTCP cá nhân).
  if (award.isLifetime && hasReceived) {
    return {
      eligible: false,
      reason: `Đã có ${name}. Phần mềm chưa hỗ trợ các danh hiệu cao hơn ${name}, sẽ phát triển trong thời gian tới.`,
    };
  }

  // Đk 1: chuỗi CSTDCS/ĐVQT đến đúng mốc chu kỳ.
  // Vd: cycle=2 (BKBQP), streak=4 → 4>=2 && 4%2===0 → OK (chu kỳ thứ 2).
  //                       streak=3 → 3>=2 nhưng 3%2!==0 → false (giữa chu kỳ).
  const cycleMet =
    streaks.streakLength >= award.cycleYears &&
    streaks.streakLength % award.cycleYears === 0;

  // Đk 2: đủ flag yêu cầu trong cửa sổ. Strict equality cho lifetime.
  const flagsMet = award.requiredFlags.every(f => {
    const have = flagsInWindow[f.code] ?? 0;
    return award.isLifetime ? have === f.count : have >= f.count;
  });

  // Đk 3: NCKH liên tục mỗi năm (chỉ cá nhân, đơn vị bỏ qua).
  // nckhStreak >= streakLength → mỗi năm trong chuỗi đều có NCKH.
  const nckhMet = !award.requiresNCKH || streaks.nckhStreak >= streaks.streakLength;

  if (cycleMet && flagsMet && nckhMet) {
    return { eligible: true, reason: `Đủ điều kiện ${name}.` };
  }

  return { eligible: false, reason: buildInsufficientReason(award, streaks, flagsInWindow) };
}
