import type { HoSoHangNam, DanhHieuHangNam, ThanhTichKhoaHoc } from '../../generated/prisma';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { annualProfileRepository } from '../../repositories/annualProfile.repository';
import { writeSystemLog } from '../../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../../constants/auditActions.constants';
import { logMessages } from '../../constants/logMessages.constants';
import { NotFoundError } from '../../middlewares/errorHandler';
import {
  DANH_HIEU_CA_NHAN_BANG_KHEN,
  DANH_HIEU_CA_NHAN_HANG_NAM,
  getDanhHieuName,
} from '../../constants/danhHieu.constants';
import { RESOURCE_SLUGS } from '../../constants/resourceSlugs.constants';
import { AWARD_SLUGS } from '../../constants/awardSlugs.constants';
import { type EligibilityResult } from '../eligibility/chainEligibility';
import { evaluatePersonalChain } from '../eligibility/personalChainEvaluator';
import type { AnnualStreakResult, RecalculateResult } from './types';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  ANNUAL PROFILE (cá nhân) — tính hồ sơ danh hiệu hằng năm
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  HoSoHangNam là bản TỔNG HỢP suy ra từ bảng DanhHieuHangNam (mỗi năm 1 dòng
 *  CSTDCS/CSTT...). KHÔNG nhập tay — luôn recalc lại từ dữ liệu gốc để khỏi lệch.
 *
 *  Vai trò file:
 *  - getAnnualProfile: load (hoặc tạo mới rỗng) hồ sơ + ngữ cảnh đơn vị/chức vụ.
 *  - computeAnnualStreaks / streak: ĐẾM chuỗi CSTDCS liên tục, NCKH liên tục, số
 *    BKBQP/CSTDTQ trong cửa sổ trượt → chuẩn bị số liệu cho evaluatePersonalChain.
 *  - recalculateAnnualProfile: tính lại du_dieu_kien_* + goi_y rồi UPSERT vào
 *    HoSoHangNam. Gọi sau mỗi lần thêm/sửa/xoá danh hiệu.
 *
 *  Logic chuỗi (BKBQP/CSTDTQ/BKTTCP) nằm ở eligibility/* — file này chỉ query +
 *  đếm rồi gọi evaluatePersonalChain (giữ 1 nguồn rule duy nhất).
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Loads or creates the annual profile with unit and position context.
 * @param personnelId - Personnel ID
 * @returns Annual profile row (created when missing)
 */
export async function getAnnualProfile(personnelId: string) {
  const personnel = await quanNhanRepository.findIdById(personnelId);

  if (!personnel) {
    throw new NotFoundError('Quân nhân');
  }

  // Load hồ sơ + kèm đơn vị (CQĐV/ĐVTT) + chức vụ trong 1 query (Prisma include = JOIN).
  // SQL minh hoạ:
  //   SELECT h.*, q.*, cq.ten_don_vi, dv.ten_don_vi, cv.ten_chuc_vu
  //     FROM "HoSoHangNam" h
  //     JOIN      "QuanNhan"        q  ON h.quan_nhan_id         = q.id
  //     LEFT JOIN "CoQuanDonVi"     cq ON q.co_quan_don_vi_id    = cq.id
  //     LEFT JOIN "DonViTrucThuoc"  dv ON q.don_vi_truc_thuoc_id = dv.id
  //     LEFT JOIN "ChucVu"          cv ON q.chuc_vu_id           = cv.id
  //     WHERE h.quan_nhan_id = $personnelId;
  let profile = await annualProfileRepository.findUniqueRaw({
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
    profile = await annualProfileRepository.createRaw({
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
  // THUẬT TOÁN đếm streak CSTDCS liên tục lùi từ (year - 1):
  //
  //   1. Sort giảm dần theo năm → duyệt từ năm gần nhất trước.
  //   2. Lọc bỏ records >= year (chỉ xét quá khứ + năm liền trước).
  //   3. Walk: nếu năm tiếp theo không liên tiếp (gap) HOẶC không phải CSTDCS
  //      → DỪNG. Đây là điểm "break the chain".
  //
  // Vd: year=2026, records [2025 CSTDCS, 2024 CSTDCS, 2022 CSTDCS]
  //     → đếm 2025 (OK), 2024 (OK), tới 2023 thì record là 2022 (gap) → break
  //     → streak = 2 (chứ không phải 3, vì 2023 trống = đứt chuỗi)
  let count = 0;
  const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);
  const filteredRewards = sortedRewards.filter(r => r.nam <= year - 1);
  let currentYear = year - 1;
  for (const reward of filteredRewards) {
    if (reward.nam !== currentYear) break; // gap năm → đứt chuỗi
    if (reward.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS) {
      count++;
      currentYear--;
    } else {
      break; // năm có award khác CSTDCS → đứt chuỗi
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
  // 1 năm có thể có nhiều thành tích KH → gom về 1 dòng/năm (dedupe theo nam)
  // trước khi đếm chuỗi năm liên tục.
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
 * Đếm số BKBQP nhận trong cửa sổ chuỗi CSTDCS liên tục [year-cstdcsStreak, year-1].
 * @param danhHieuList - Danh sách danh hiệu hằng năm (thứ tự bất kỳ)
 * @param year - Năm xét (cửa sổ kết thúc ở year-1)
 * @param cstdcsStreak - Độ dài chuỗi CSTDCS liên tục → quyết định bề rộng cửa sổ
 * @returns Số BKBQP trong cửa sổ
 */
export function countBKBQPInStreak(
  danhHieuList: DanhHieuHangNam[],
  year: number,
  cstdcsStreak: number
): number {
  // Cửa sổ = đúng chuỗi CSTDCS liên tục [startYear, endYear] (endYear = year-1);
  // đếm số lần nhận BKBQP rơi trong cửa sổ này.
  const endYear = year - 1;
  const startYear = endYear - cstdcsStreak + 1;
  return danhHieuList.filter(r => r.nhan_bkbqp === true && r.nam >= startYear && r.nam <= endYear)
    .length;
}

/**
 * Đếm số CSTDTQ nhận trong cửa sổ chuỗi CSTDCS liên tục [year-cstdcsStreak, year-1].
 * @param danhHieuList - Danh sách danh hiệu hằng năm (thứ tự bất kỳ)
 * @param year - Năm xét (cửa sổ kết thúc ở year-1)
 * @param cstdcsStreak - Độ dài chuỗi CSTDCS liên tục → quyết định bề rộng cửa sổ
 * @returns Số CSTDTQ trong cửa sổ
 */
export function countCSTDTQInStreak(
  danhHieuList: DanhHieuHangNam[],
  year: number,
  cstdcsStreak: number
): number {
  // Tương tự BKBQP nhưng đếm số lần nhận CSTDTQ trong cửa sổ chuỗi CSTDCS liên tục.
  const endYear = year - 1;
  const startYear = endYear - cstdcsStreak + 1;
  return danhHieuList.filter(r => r.nhan_cstdtq === true && r.nam >= startYear && r.nam <= endYear)
    .length;
}

/**
 * Loads personnel with awards/achievements and computes all streak counters.
 * @param personnelId - Personnel ID
 * @param year - Evaluation anchor year
 * @returns Personnel data, lists, and computed streaks
 */
async function computeAnnualStreaks(
  personnelId: string,
  year: number
): Promise<AnnualStreakResult> {
  // Load quân nhân kèm toàn bộ danh hiệu hằng năm + thành tích KH tới năm xét
  // (nam <= year) trong 1 query → đủ dữ liệu tính mọi chuỗi, không query lẻ.
  const personnel = await quanNhanRepository.findUniqueRaw({
    where: { id: personnelId },
    include: {
      DanhHieuHangNam: { where: { nam: { lte: year } }, orderBy: { nam: 'asc' } },
      ThanhTichKhoaHoc: { where: { nam: { lte: year } }, orderBy: { nam: 'asc' } },
    },
  });
  if (!personnel) throw new NotFoundError('Quân nhân');

  const danhHieuList = personnel.DanhHieuHangNam || [];
  const thanhTichList = personnel.ThanhTichKhoaHoc || [];

  // CSTDCS liên tục là CHUỖI GỐC — quyết định cửa sổ đếm cho BKBQP/CSTDTQ bên dưới.
  const cstdcs_lien_tuc = calculateContinuousCSTDCS(
    danhHieuList.filter(dh => dh.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS),
    year
  );
  const nckh_lien_tuc = calculateContinuousNCKH(thanhTichList, year);

  // Dùng độ dài chuỗi CSTDCS làm cửa sổ đếm số BKBQP/CSTDTQ đã nhận trong chuỗi đó.
  const bkbqp_lien_tuc = countBKBQPInStreak(danhHieuList, year, cstdcs_lien_tuc);
  const cstdtq_lien_tuc = countCSTDTQInStreak(danhHieuList, year, cstdcs_lien_tuc);

  return {
    personnel,
    danhHieuList,
    thanhTichList,
    cstdcs_lien_tuc,
    nckh_lien_tuc,
    bkbqp_lien_tuc,
    cstdtq_lien_tuc,
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
function computeEligibilityFlags(
  streaks: {
    cstdcs_lien_tuc: number;
    nckh_lien_tuc: number;
    bkbqp_lien_tuc: number;
    cstdtq_lien_tuc: number;
  },
  danhHieuList: Array<Record<string, unknown> & { nam: number }>,
  year: number
) {
  // ───────────────────────────────────────────────────────────────────
  //  TÍNH 3 FLAG ĐỦ ĐIỀU KIỆN: BKBQP / CSTDTQ / BKTTCP (cá nhân)
  // ───────────────────────────────────────────────────────────────────
  //  Hàm này chạy khi recalc profile của 1 quân nhân. Kết quả lưu vào
  //  bảng HoSoHangNam và FE hiển thị badge "Đủ ĐK ...".
  //
  //  Quan trọng: hàm này phải KHỚP với checkAwardEligibility (validate
  //  khi approve đề xuất). Nếu lệch → recalc nói "đủ" mà approve báo
  //  "không đủ" hoặc ngược lại → bug nhức nhối.
  // ───────────────────────────────────────────────────────────────────
  const { cstdcs_lien_tuc, nckh_lien_tuc } = streaks;
  // Uỷ quyền cho engine chung evaluatePersonalChain (BKBQP chu kỳ 2y /
  // CSTDTQ 3y + BKBQP trong 3y cuối / BKTTCP 7y lifetime + 3 BKBQP + 2
  // CSTDTQ). Cùng engine với checkChainEligibility nên recalc ↔ approve
  // luôn khớp — không còn nhân bản công thức chu kỳ ở 2 nơi.
  return {
    du_dieu_kien_bkbqp: evaluatePersonalChain(
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      danhHieuList,
      year,
      cstdcs_lien_tuc,
      nckh_lien_tuc
    ).eligible,
    du_dieu_kien_cstdtq: evaluatePersonalChain(
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
      danhHieuList,
      year,
      cstdcs_lien_tuc,
      nckh_lien_tuc
    ).eligible,
    du_dieu_kien_bkttcp: evaluatePersonalChain(
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
      danhHieuList,
      year,
      cstdcs_lien_tuc,
      nckh_lien_tuc
    ).eligible,
  };
}

/**
 * Recomputes annual-profile counters and suggestion text for one personnel.
 * @param personnelId - Personnel ID
 * @param year - Evaluation year (defaults to current calendar year)
 * @returns Success response with message and updated profile row
 */
export async function recalculateAnnualProfile(
  personnelId: string,
  year: number = new Date().getFullYear()
): Promise<{ success: boolean; message: string; data: HoSoHangNam }> {
  const {
    danhHieuList,
    thanhTichList,
    cstdcs_lien_tuc,
    nckh_lien_tuc,
    bkbqp_lien_tuc,
    cstdtq_lien_tuc,
  } = await computeAnnualStreaks(personnelId, year);

  // Snapshot JSON chỉ giữ các năm "có ý nghĩa": đạt CSTDCS hoặc có nhận BKBQP/
  // CSTDTQ/BKTTCP — để FE hiển thị dòng thời gian khen thưởng (sort tăng theo năm).
  const tong_cstdcs_json = danhHieuList
    .filter(
      dh =>
        dh.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS ||
        dh.nhan_bkbqp ||
        dh.nhan_cstdtq ||
        dh.nhan_bkttcp
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

  const { du_dieu_kien_bkbqp, du_dieu_kien_cstdtq, du_dieu_kien_bkttcp } = computeEligibilityFlags(
    { cstdcs_lien_tuc, nckh_lien_tuc, bkbqp_lien_tuc, cstdtq_lien_tuc },
    danhHieuList,
    year
  );

  const hasReceivedBKTTCP = danhHieuList.some(dh => dh.nhan_bkttcp === true);

  const labelBKBQP = getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP);
  const labelCSTDTQ = getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ);
  const labelBKTTCP = getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP);

  // Gợi ý hiển thị FE — ưu tiên từ cao xuống: đã có BKTTCP (lifetime, chặn cao hơn)
  // → đủ ĐK bậc cao nhất → ... → chưa đủ ĐK. Mỗi nhánh là 1 trạng thái loại trừ.
  let goi_y: string;
  if (hasReceivedBKTTCP) {
    goi_y = `Phần mềm chưa hỗ trợ khen thưởng cao hơn ${labelBKTTCP}, sẽ phát triển trong thời gian tới.`;
  } else if (du_dieu_kien_bkttcp) {
    goi_y = `Đã đủ điều kiện đề nghị xét ${labelBKTTCP}.`;
  } else if (du_dieu_kien_cstdtq && du_dieu_kien_bkbqp) {
    goi_y = `Đã đủ điều kiện đề nghị xét ${labelBKBQP} và ${labelCSTDTQ}.`;
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

  // UPSERT hồ sơ: chưa có → INSERT, đã có → UPDATE (idempotent, recalc bao nhiêu lần
  // cũng ra 1 dòng/quân nhân). SQL minh hoạ:
  //   INSERT INTO "HoSoHangNam" (quan_nhan_id, cstdcs_lien_tuc, du_dieu_kien_bkbqp, ..., goi_y)
  //     VALUES ($qnId, ...)
  //     ON CONFLICT (quan_nhan_id) DO UPDATE SET cstdcs_lien_tuc = EXCLUDED.cstdcs_lien_tuc, ...;
  const hoSoHangNam = await annualProfileRepository.upsert(
    personnelId,
    { quan_nhan_id: personnelId, ...profileData },
    profileData
  );

  return {
    success: true,
    message: 'Tính toán hồ sơ hằng năm thành công',
    data: hoSoHangNam,
  };
}

/**
 * Recalculates the annual profile, swallowing errors so the caller's main flow is not interrupted.
 * @param personnelId - Personnel ID to recalculate
 * @param resource - Resource slug for the error system-log entry
 * @returns Nothing
 */
export async function safeRecalculateAnnualProfile(
  personnelId: string,
  resource: string = AWARD_SLUGS.ANNUAL_REWARDS
): Promise<void> {
  try {
    await recalculateAnnualProfile(personnelId);
  } catch (e) {
    void writeSystemLog({
      action: AUDIT_ACTIONS.ERROR,
      resource,
      description: `Lỗi tính lại hồ sơ hằng năm: ${e}`,
    });
  }
}

/**
 * Chain eligibility for BKBQP / CSTDTQ / BKTTCP (proposal submit, approval, import preview).
 * @param personnelId - Personnel ID
 * @param year - Proposal year under validation
 * @param danhHieu - Medal code to validate
 * @returns Eligibility result with operator-facing reason
 */
export async function checkAwardEligibility(
  personnelId: string,
  year: number,
  danhHieu: string
): Promise<EligibilityResult> {
  if (!DANH_HIEU_CA_NHAN_BANG_KHEN.has(danhHieu)) {
    return { eligible: true, reason: '' };
  }

  let streaks;
  try {
    streaks = await computeAnnualStreaks(personnelId, year);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { eligible: false, reason: 'Quân nhân không tồn tại' };
    }
    throw error;
  }

  return evaluatePersonalChain(
    danhHieu,
    streaks.danhHieuList as Array<Record<string, unknown> & { nam: number }>,
    year,
    streaks.cstdcs_lien_tuc,
    streaks.nckh_lien_tuc
  );
}

/**
 * Batch job: `recalculateAnnualProfile` for every personnel (best-effort per row).
 * @returns Aggregate counts and per-personnel error list
 */
export async function recalculateAll(): Promise<RecalculateResult> {
  // Lấy id + tên TẤT CẢ quân nhân (select gọn để khỏi kéo cả hàng nặng).
  // SQL minh hoạ:  SELECT id, ho_ten FROM "QuanNhan";
  // Sau đó recalc tuần tự từng người (best-effort: 1 người lỗi không chặn cả lô —
  // gom vào errors). KHÔNG gói transaction vì là job tổng, không cần all-or-nothing.
  const allPersonnel = await quanNhanRepository.findManyRaw({
    select: { id: true, ho_ten: true },
  });

  void writeSystemLog({
    action: AUDIT_ACTIONS.RECALCULATE,
    resource: RESOURCE_SLUGS.PROFILES,
    description: `Bắt đầu tính toán lại hồ sơ cho ${allPersonnel.length} quân nhân`,
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
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: RESOURCE_SLUGS.PROFILES,
        resourceId: personnel.id,
        description: logMessages.recalcPersonnelError(
          `${personnel.ho_ten} (${personnel.id})`,
          error.message
        ),
      });
    }
  }

  void writeSystemLog({
    action: AUDIT_ACTIONS.RECALCULATE,
    resource: RESOURCE_SLUGS.PROFILES,
    description: `Tính toán lại hồ sơ hoàn tất: ${successCount} thành công, ${errors.length} lỗi`,
    payload: errors.length > 0 ? { errors } : null,
  });

  return {
    message: `Tính toán hoàn tất. Thành công: ${successCount}, Lỗi: ${errors.length}`,
    success: successCount,
    errors,
  };
}
