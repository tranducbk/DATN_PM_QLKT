import type {
  HoSoHangNam,
  DanhHieuHangNam,
  ThanhTichKhoaHoc,
} from '../../generated/prisma';
import { prisma } from '../../models';
import { writeSystemLog } from '../../helpers/systemLogHelper';
import { NotFoundError } from '../../middlewares/errorHandler';
import { DANH_HIEU_CA_NHAN_BANG_KHEN, DANH_HIEU_CA_NHAN_HANG_NAM, getDanhHieuName } from '../../constants/danhHieu.constants';
import { PERSONAL_CHAIN_AWARDS, findChainAwardConfig } from '../../constants/chainAwards.constants';
import { checkChainEligibility, type EligibilityResult, type FlagsInWindow } from '../eligibility/chainEligibility';
import type { AnnualStreakResult, ChainContext, NCKHYearsResult, RecalculateResult, SpecialCaseResult } from './types';

/**
 * Loads or creates the annual profile with unit and position context.
 * @param personnelId - Personnel ID
 * @returns Annual profile row (created when missing)
 */
export async function getAnnualProfile(personnelId: string) {
  const personnel = await prisma.quanNhan.findUnique({
    where: { id: personnelId },
  });

  if (!personnel) {
    throw new NotFoundError('Quân nhân');
  }

  let profile = await prisma.hoSoHangNam.findUnique({
    where: { quan_nhan_id: personnelId },
    include: {
      QuanNhan: {
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: true,
          ChucVu: true,
        },
      },
    },
  });

  if (!profile) {
    profile = await prisma.hoSoHangNam.create({
      data: {
        quan_nhan_id: personnelId,
        tong_cstdcs: 0,
        tong_nckh: 0,
        tong_cstdcs_json: [],
        tong_nckh_json: [],
        cstdcs_lien_tuc: 0,
        du_dieu_kien_bkbqp: false,
        du_dieu_kien_cstdtq: false,
        goi_y: 'Chưa có dữ liệu để tính toán. Vui lòng nhập danh hiệu và thành tích.',
      },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
            ChucVu: true,
          },
        },
      },
    });
  }

  return profile;
}

/**
 * Longest backward chain of calendar years ending at `year - 1` where each year has `danh_hieu === 'CSTDCS'`.
 * @param danhHieuList - `DanhHieuHangNam` rows (callers may pass filtered or full lists)
 * @param year - Evaluation anchor year
 * @returns Streak length; non-`CSTDCS` years in the sequence stop the count
 */
export function calculateContinuousCSTDCS(danhHieuList: DanhHieuHangNam[], year: number): number {
  let count = 0;
  const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);
  const filteredRewards = sortedRewards.filter(r => r.nam <= year - 1);
  let currentYear = year - 1;
  for (const reward of filteredRewards) {
    if (reward.nam !== currentYear) break;
    if (reward.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS) {
      count++;
      currentYear--;
    } else {
      break;
    }
  }

  return count;
}

/**
 * Counts consecutive approved science rows ending at `year - 1` (one per calendar year).
 * @param thanhTichList - `ThanhTichKhoaHoc` rows (any order; sorted internally)
 * @param year - Proposal / evaluation anchor year
 * @returns Streak length
 */
export function calculateContinuousNCKH(thanhTichList: ThanhTichKhoaHoc[], year: number): number {
  let count = 0;
  const sortedRewards = [...thanhTichList].sort((a, b) => b.nam - a.nam);
  const filteredRewards = sortedRewards.filter(r => r.nam <= year - 1);
  const uniqueRewards = filteredRewards.filter(
    (item, index, self) => index === self.findIndex(t => t.nam === item.nam)
  );
  let currentYear = year - 1;
  for (const reward of uniqueRewards) {
    if (reward.nam !== currentYear) break;
    count++;
    currentYear--;
  }

  return count;
}

/**
 * Counts BKBQP awards on the 2-year cadence ending at `year - 1`.
 * @param danhHieuList - Annual title rows (any order)
 * @param year - Evaluation anchor year
 * @returns Number of BKBQP steps in the active chain
 */
/**
 * Đếm tổng số lần nhận BKBQP trong chuỗi CSTDCS liên tục.
 */
export function countBKBQPInStreak(danhHieuList: DanhHieuHangNam[], year: number, cstdcsStreak: number): number {
  const endYear = year - 1;
  const startYear = endYear - cstdcsStreak + 1;
  return danhHieuList.filter(r => r.nhan_bkbqp === true && r.nam >= startYear && r.nam <= endYear).length;
}

/**
 * Counts CSTDTQ awards on the 3-year cadence ending at `year - 1`.
 * @param danhHieuList - Annual title rows (any order)
 * @param year - Evaluation anchor year
 * @returns Number of CSTDTQ steps in the active chain
 */
/**
 * Counts records with flag = true within N years back from year-1.
 */
export function countFlagInRange(
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
 * Đếm tổng số lần nhận CSTDTQ trong chuỗi CSTDCS liên tục.
 */
export function countCSTDTQInStreak(danhHieuList: DanhHieuHangNam[], year: number, cstdcsStreak: number): number {
  const endYear = year - 1;
  const startYear = endYear - cstdcsStreak + 1;
  return danhHieuList.filter(r => r.nhan_cstdtq === true && r.nam >= startYear && r.nam <= endYear).length;
}

/**
 * Latest year within `[chainStartYear, year-1]` where `flagKey` is true; null when none.
 * @param danhHieuList - Annual title rows
 * @param flagKey - Boolean flag column (`nhan_bkbqp`, `nhan_cstdtq`, `nhan_bkttcp`)
 * @param chainStartYear - First year of the current CSTDCS streak
 * @param year - Evaluation anchor year
 */
export function lastFlagYearInChain(
  danhHieuList: Array<{ nam: number } & Record<string, unknown>>,
  flagKey: string,
  chainStartYear: number,
  year: number
): number | null {
  let max = -1;
  for (const r of danhHieuList) {
    if (r[flagKey] === true && r.nam >= chainStartYear && r.nam <= year - 1 && r.nam > max) {
      max = r.nam;
    }
  }
  return max < 0 ? null : max;
}

/**
 * Builds chain-cycle context — derives anchor years and "streak since last flag"
 * for each chain award without storing extra DB columns. The anchor for the next
 * award cycle is `lastFlagYear + 1`; when nothing received yet the anchor falls
 * back to the chain's first CSTDCS year.
 * @param danhHieuList - Annual title rows for this person
 * @param cstdcsLienTuc - Continuous CSTDCS streak count anchored at `year - 1`
 * @param year - Evaluation anchor year
 */
export function computeChainContext(
  danhHieuList: Array<{ nam: number } & Record<string, unknown>>,
  cstdcsLienTuc: number,
  year: number
): ChainContext {
  const chainStartYear = year - cstdcsLienTuc;
  const lastBkbqpYear = lastFlagYearInChain(danhHieuList, 'nhan_bkbqp', chainStartYear, year);
  const lastCstdtqYear = lastFlagYearInChain(danhHieuList, 'nhan_cstdtq', chainStartYear, year);
  const lastBkttcpYear = lastFlagYearInChain(danhHieuList, 'nhan_bkttcp', chainStartYear, year);

  const streakSinceLastBkbqp =
    lastBkbqpYear !== null ? year - lastBkbqpYear - 1 : cstdcsLienTuc;
  const streakSinceLastCstdtq =
    lastCstdtqYear !== null ? year - lastCstdtqYear - 1 : cstdcsLienTuc;
  const streakSinceLastBkttcp =
    lastBkttcpYear !== null ? year - lastBkttcpYear - 1 : cstdcsLienTuc;

  const missedBkbqp = streakSinceLastBkbqp >= 2 ? Math.floor((streakSinceLastBkbqp - 1) / 2) : 0;
  const missedCstdtq = streakSinceLastCstdtq >= 3 ? Math.floor((streakSinceLastCstdtq - 1) / 3) : 0;

  return {
    chainStartYear,
    lastBkbqpYear,
    lastCstdtqYear,
    lastBkttcpYear,
    streakSinceLastBkbqp,
    streakSinceLastCstdtq,
    streakSinceLastBkttcp,
    missedBkbqp,
    missedCstdtq,
  };
}

/**
 * Whether approved NCKH exists for any year in the candidate list.
 * @param nckhList - Approved `ThanhTichKhoaHoc` rows
 * @param years - Years to intersect (e.g. streak window)
 * @returns Flags plus the matching year subset
 */
export function checkNCKHInYears(nckhList: ThanhTichKhoaHoc[], years: number[]): NCKHYearsResult {
  const nckhYears = nckhList.map(n => n.nam);
  const foundYears = years.filter(year => nckhYears.includes(year));
  return {
    hasNCKH: foundYears.length > 0,
    years: foundYears,
  };
}

/**
 * Detects admin-forced medals or broken CSTDCS chains that restart eligibility messaging.
 * @param danhHieuList - Annual rows (newest first after internal sort)
 * @returns Whether to show a one-off hint and whether streak counters reset
 */
export function handleSpecialCases(danhHieuList: DanhHieuHangNam[]): SpecialCaseResult {
  const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);
  const latestReward = sortedRewards[0];

  if (!latestReward) {
    return { isSpecialCase: false, goiY: '', resetChain: false };
  }

  // Case 1: Admin explicitly set BKTTCP (highest)
  if (latestReward.nhan_bkttcp === true) {
    return {
      isSpecialCase: true,
      goiY: `Đã nhận Bằng khen thi đua cấp phòng (Năm ${latestReward.nam}). Bắt đầu chuỗi thành tích mới.`,
      resetChain: true,
    };
  }

  // Case 2: Admin explicitly set CSTDTQ
  if (latestReward.nhan_cstdtq === true) {
    return {
      isSpecialCase: true,
      goiY: `Đã nhận Chiến sĩ thi đua Toàn quân (Năm ${latestReward.nam}). Bắt đầu chuỗi thành tích mới.`,
      resetChain: true,
    };
  }

  // Case 3: Admin explicitly set BKBQP (CSTDTQ not yet reached)
  if (latestReward.nhan_bkbqp === true && !latestReward.nhan_cstdtq) {
    return {
      isSpecialCase: true,
      goiY: `Đã nhận Bằng khen Bộ Quốc phòng (Năm ${latestReward.nam}).`,
      resetChain: false,
    };
  }

  // Case 4: Not eligible for CSTDCS this year
  if (latestReward.danh_hieu !== DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS && latestReward.danh_hieu !== null) {
    return {
      isSpecialCase: true,
      goiY: 'Chưa có CSTDCS liên tục. Cần đạt CSTDCS để bắt đầu tính điều kiện khen thưởng.',
      resetChain: true,
    };
  }

  return { isSpecialCase: false, goiY: '', resetChain: false };
}

/**
 * Loads personnel with awards/achievements and computes all streak counters.
 * @param personnelId - Personnel ID
 * @param year - Evaluation anchor year
 * @returns Personnel data, lists, and computed streaks
 */
export async function computeAnnualStreaks(personnelId: string, year: number): Promise<AnnualStreakResult> {
  const personnel = await prisma.quanNhan.findUnique({
    where: { id: personnelId },
    include: {
      DanhHieuHangNam: { where: { nam: { lte: year } }, orderBy: { nam: 'asc' } },
      ThanhTichKhoaHoc: { where: { nam: { lte: year } }, orderBy: { nam: 'asc' } },
    },
  });

  if (!personnel) throw new NotFoundError('Quân nhân');

  const danhHieuList = personnel.DanhHieuHangNam || [];
  const thanhTichList = personnel.ThanhTichKhoaHoc || [];

  const cstdcs_lien_tuc = calculateContinuousCSTDCS(
    danhHieuList.filter(dh => dh.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS),
    year
  );
  const nckh_lien_tuc = calculateContinuousNCKH(thanhTichList, year);

  const bkbqp_lien_tuc = countBKBQPInStreak(danhHieuList, year, cstdcs_lien_tuc);
  const cstdtq_lien_tuc = countCSTDTQInStreak(danhHieuList, year, cstdcs_lien_tuc);
  const chainContext = computeChainContext(danhHieuList, cstdcs_lien_tuc, year);

  return {
    personnel,
    danhHieuList,
    thanhTichList,
    cstdcs_lien_tuc,
    nckh_lien_tuc,
    bkbqp_lien_tuc,
    cstdtq_lien_tuc,
    chainContext,
  };
}

/**
 * Computes BKBQP / CSTDTQ / BKTTCP eligibility flags from streak counters.
 * BKBQP and BKTTCP use "streak since last receipt" so missed cycles automatically
 * advance the next opportunity by `cycleYears`. CSTDTQ keeps the fixed 3-year
 * BKBQP-window because business rule requires BKBQP within the trailing 3 years
 * of the current proposal — flags from earlier cycles cannot retro-claim.
 * @param streaks - Streak values from computeAnnualStreaks
 * @param danhHieuList - Full annual award list for re-check edge cases
 * @param year - Evaluation year
 * @returns Eligibility booleans for the three medal tiers
 */
export function computeEligibilityFlags(
  streaks: { cstdcs_lien_tuc: number; nckh_lien_tuc: number; bkbqp_lien_tuc: number; cstdtq_lien_tuc: number },
  danhHieuList: Array<Record<string, unknown> & { nam: number }>,
  year: number
) {
  const { cstdcs_lien_tuc, nckh_lien_tuc } = streaks;
  const hasEnoughNCKH = nckh_lien_tuc >= cstdcs_lien_tuc;
  const ctx = computeChainContext(danhHieuList, cstdcs_lien_tuc, year);

  const du_dieu_kien_bkbqp =
    ctx.streakSinceLastBkbqp >= 2 &&
    ctx.streakSinceLastBkbqp % 2 === 0 &&
    hasEnoughNCKH;

  const bkbqpIn3Years = countFlagInRange(danhHieuList, year, 3, 'nhan_bkbqp');
  const du_dieu_kien_cstdtq =
    cstdcs_lien_tuc >= 3 && cstdcs_lien_tuc % 3 === 0 &&
    bkbqpIn3Years >= 1 && hasEnoughNCKH;

  const hasReceivedBKTTCP = danhHieuList.some(r => r.nhan_bkttcp === true);
  const bkbqpIn7Years = countFlagInRange(danhHieuList, year, 7, 'nhan_bkbqp');
  const cstdtqIn7Years = countFlagInRange(danhHieuList, year, 7, 'nhan_cstdtq');
  const du_dieu_kien_bkttcp =
    !hasReceivedBKTTCP &&
    cstdcs_lien_tuc >= 7 &&
    cstdcs_lien_tuc % 7 === 0 &&
    bkbqpIn7Years === 3 &&
    cstdtqIn7Years === 2 &&
    hasEnoughNCKH;

  return { du_dieu_kien_bkbqp, du_dieu_kien_cstdtq, du_dieu_kien_bkttcp };
}

/**
 * Recomputes annual-profile counters and suggestion text for one personnel.
 * @param personnelId - Personnel ID
 * @param year - Evaluation year (defaults to current calendar year)
 * @returns Success response with message and updated profile row
 */
export async function recalculateAnnualProfile(personnelId: string, year: number = new Date().getFullYear()): Promise<{ success: boolean; message: string; data: HoSoHangNam }> {
  const { danhHieuList, thanhTichList, cstdcs_lien_tuc, nckh_lien_tuc, bkbqp_lien_tuc, cstdtq_lien_tuc } =
    await computeAnnualStreaks(personnelId, year);

  const tong_cstdcs_json = danhHieuList
    .filter(
      dh => dh.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS || dh.nhan_bkbqp || dh.nhan_cstdtq || dh.nhan_bkttcp
    )
    .map(dh => ({
      nam: dh.nam,
      danh_hieu: dh.danh_hieu,
      so_quyet_dinh: dh.so_quyet_dinh || null,
      nhan_bkbqp: dh.nhan_bkbqp || false,
      nhan_cstdtq: dh.nhan_cstdtq || false,
      nhan_bkttcp: dh.nhan_bkttcp || false,
      so_quyet_dinh_bkbqp: dh.so_quyet_dinh_bkbqp || null,
      so_quyet_dinh_cstdtq: dh.so_quyet_dinh_cstdtq || null,
      so_quyet_dinh_bkttcp: dh.so_quyet_dinh_bkttcp || null,
    }))
    .sort((a, b) => a.nam - b.nam);
  const tong_cstdcs = tong_cstdcs_json.length;
  const tong_nckh_json = thanhTichList
    .map(tt => ({
      nam: tt.nam,
      loai: tt.loai,
      mo_ta: tt.mo_ta,
      so_quyet_dinh: tt.so_quyet_dinh || null,
    }))
    .sort((a, b) => a.nam - b.nam);
  const tong_nckh = tong_nckh_json.length;

  const { du_dieu_kien_bkbqp, du_dieu_kien_cstdtq, du_dieu_kien_bkttcp } =
    computeEligibilityFlags(
      { cstdcs_lien_tuc, nckh_lien_tuc, bkbqp_lien_tuc, cstdtq_lien_tuc },
      danhHieuList,
      year
    );

  const hasReceivedBKTTCP = danhHieuList.some(dh => dh.nhan_bkttcp === true);

  const labelBKBQP = getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP);
  const labelCSTDTQ = getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ);
  const labelBKTTCP = getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP);

  let goi_y: string;
  if (hasReceivedBKTTCP) {
    goi_y = `Phần mềm chưa hỗ trợ khen thưởng cao hơn ${labelBKTTCP}, sẽ phát triển trong thời gian tới.`;
  } else if (du_dieu_kien_bkttcp) {
    goi_y = `Đã đủ điều kiện đề nghị xét ${labelBKTTCP}.`;
  } else if (du_dieu_kien_cstdtq) {
    goi_y = `Đã đủ điều kiện đề nghị xét ${labelCSTDTQ}.`;
  } else if (du_dieu_kien_bkbqp) {
    goi_y = `Đã đủ điều kiện đề nghị xét ${labelBKBQP}.`;
  } else {
    goi_y = `Chưa đủ điều kiện đề nghị xét ${labelBKBQP} hoặc ${labelCSTDTQ}.`;
  }

  const profileData = {
    tong_cstdcs,
    tong_nckh,
    tong_cstdcs_json,
    tong_nckh_json,
    cstdcs_lien_tuc,
    nckh_lien_tuc,
    bkbqp_lien_tuc,
    cstdtq_lien_tuc,
    du_dieu_kien_bkbqp,
    du_dieu_kien_cstdtq,
    du_dieu_kien_bkttcp,
    goi_y,
  };

  const hoSoHangNam = await prisma.hoSoHangNam.upsert({
    where: { quan_nhan_id: personnelId },
    update: profileData,
    create: { quan_nhan_id: personnelId, ...profileData },
  });

  return {
    success: true,
    message: 'Tính toán hồ sơ hằng năm thành công',
    data: hoSoHangNam,
  };
}

/**
 * Chain eligibility for BKBQP / CSTDTQ / BKTTCP (proposal submit, approval, import preview).
 * @param personnelId - Personnel ID
 * @param year - Proposal year under validation
 * @param danhHieu - Medal code to validate
 * @returns Eligibility result with operator-facing reason
 */
export async function checkAwardEligibility(personnelId: string, year: number, danhHieu: string): Promise<EligibilityResult> {
  if (!DANH_HIEU_CA_NHAN_BANG_KHEN.has(danhHieu)) {
    return { eligible: true, reason: '' };
  }

  const config = findChainAwardConfig(PERSONAL_CHAIN_AWARDS, danhHieu);
  if (!config) return { eligible: true, reason: '' };

  let streaks;
  try {
    streaks = await computeAnnualStreaks(personnelId, year);
  } catch {
    return { eligible: false, reason: 'Quân nhân không tồn tại' };
  }

  const { cstdcs_lien_tuc, nckh_lien_tuc, danhHieuList } = streaks;

  // Always window prerequisite-flag counts to the cycle length (3y CSTDTQ, 7y BKTTCP).
  // A streak past the cycle boundary cannot retro-claim flags from earlier cycles.
  const flagsInWindow: FlagsInWindow = {};
  config.requiredFlags.forEach(f => {
    flagsInWindow[f.code] = countFlagInRange(
      danhHieuList,
      year,
      config.cycleYears,
      flagColumnFor(f.code)
    );
  });

  const hasReceived = config.isLifetime
    ? danhHieuList.some((dh: DanhHieuHangNam) => (dh as unknown as Record<string, unknown>)[config.flagColumn] === true)
    : false;

  return checkChainEligibility(
    config,
    { streakLength: cstdcs_lien_tuc, nckhStreak: nckh_lien_tuc },
    hasReceived,
    flagsInWindow
  );
}

/** Maps a chain award code to its boolean flag column on `DanhHieuHangNam`. */
function flagColumnFor(code: string): string {
  const map: Record<string, string> = {
    [DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP]: 'nhan_bkbqp',
    [DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ]: 'nhan_cstdtq',
    [DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP]: 'nhan_bkttcp',
  };
  return map[code] ?? '';
}

/**
 * Batch job: `recalculateAnnualProfile` for every personnel (best-effort per row).
 * @returns Aggregate counts and per-personnel error list
 */
export async function recalculateAll(): Promise<RecalculateResult> {
  const allPersonnel = await prisma.quanNhan.findMany({
    select: { id: true, ho_ten: true },
  });

  writeSystemLog({
    action: 'RECALCULATE',
    resource: 'profiles',
    description: `[Recalculate] Bắt đầu tính toán cho ${allPersonnel.length} quân nhân`,
  });

  let successCount = 0;
  const errors: Array<{ personnelId: string; hoTen: string; error: string }> = [];

  for (const personnel of allPersonnel) {
    try {
      await recalculateAnnualProfile(personnel.id);
      successCount++;
    } catch (error) {
      errors.push({
        personnelId: personnel.id,
        hoTen: personnel.ho_ten,
        error: error.message,
      });
      writeSystemLog({
        action: 'ERROR',
        resource: 'profiles',
        resourceId: personnel.id,
        description: `[Recalculate] Lỗi: ${personnel.ho_ten} (${personnel.id}) — ${error.message}`,
      });
    }
  }

  writeSystemLog({
    action: 'RECALCULATE',
    resource: 'profiles',
    description: `[Recalculate] Hoàn tất: ${successCount} thành công, ${errors.length} lỗi`,
    payload: errors.length > 0 ? { errors } : null,
  });

  return {
    message: `Tính toán hoàn tất. Thành công: ${successCount}, Lỗi: ${errors.length}`,
    success: successCount,
    errors,
  };
}
