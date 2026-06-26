import type { HoSoNienHan, HoSoHangNam } from '../generated/prisma';
import type { EligibilityResult } from './eligibility/chainEligibility';
import type { TenureProfileUpdate, RecalculateResult } from './profile/types';
import {
  getAnnualProfile,
  recalculateAnnualProfile,
  checkAwardEligibility,
  recalculateAll,
} from './profile/annual';
import {
  getTenureProfile,
  recalculateTenureProfile,
  getAllTenureProfiles,
  updateTenureProfile,
} from './profile/tenure';
import {
  getContributionProfile,
  recalculateContributionProfile,
} from './profile/contribution';
import { recalculateFullProfile, recalculateAllFullProfiles } from './profile/fullRecalc';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  PROFILE SERVICE — FACADE cho 3 hồ sơ riêng biệt (annual/tenure/contribution)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Mỗi quân nhân có 3 hồ sơ độc lập (tách bảng DB):
 *
 *      ① HoSoHangNam     (annual)       — chuỗi CSTDCS + BKBQP/CSTDTQ/BKTTCP
 *      ② HoSoNienHan     (tenure)       — 3 hạng HCCSVV theo năm phục vụ
 *      ③ HoSoCongHien    (contribution) — 3 hạng HCBVTQ theo nhóm tháng
 *
 *  WHY tách 3 bảng (không gộp 1):
 *  - 3 nghiệp vụ độc lập, recalc trigger khác nhau.
 *  - Schema fields khác nhau (annual có streak counters, tenure có dates,
 *    contribution có month buckets).
 *  - Index riêng → query nhanh.
 *  - Dễ migrate từng phần khi thay đổi rule 1 loại.
 *
 *  WHY FACADE PATTERN (file này):
 *  - Caller chỉ cần `profileService.recalculateAnnualProfile(qnId)` thay
 *    vì biết tới `services/profile/annual.ts`.
 *  - Inject mock dễ trong test (jest.spyOn(profileService, 'X')).
 *  - Cho phép swap implementation sau này không breaking caller.
 *
 *  TRIGGER POINTS recalc:
 *  - Sau approve đề xuất CA_NHAN_HANG_NAM → recalculateAnnualProfile
 *  - Sau approve NIEN_HAN/HC_QKQT/KNC → recalculateTenureProfile
 *  - Sau approve CONG_HIEN → recalculateContributionProfile
 *  - Sau thay đổi LichSuChucVu (chức vụ) → recalculateContributionProfile
 *  - Cron / DevZone trigger → recalculateAll (3 loại + tất cả quân nhân)
 *
 *  Xem từng file con `services/profile/` để hiểu thuật toán chi tiết:
 *  - annual.ts:      chuỗi CSTDCS + chain context + cycle eligibility
 *  - tenure.ts:      HCCSVV rank by enlistment year + N
 *  - contribution.ts: HCBVTQ rank by cumulative months in he_so group
 * ════════════════════════════════════════════════════════════════════════════
 */
class ProfileService {
  /**
   * Loads or creates the annual profile with unit and position context.
   * @param personnelId - Personnel ID
   * @returns Annual profile row (created when missing)
   */
  getAnnualProfile(personnelId: string) {
    return getAnnualProfile(personnelId);
  }

  /**
   * Loads or creates the tenure profile and augments it with award year/month data.
   * @param personnelId - Personnel ID
   * @returns Tenure profile with hccsvv_nam_nhan timeline data
   */
  getTenureProfile(personnelId: string) {
    return getTenureProfile(personnelId);
  }

  /**
   * Loads or creates the contribution profile with months and tier statuses.
   * @param personnelId - Personnel ID
   * @returns Contribution profile row (created when missing)
   */
  getContributionProfile(personnelId: string) {
    return getContributionProfile(personnelId);
  }

  /**
   * Recomputes annual-profile counters and suggestion text for one personnel.
   * @param personnelId - Personnel ID
   * @param year - Evaluation year (defaults to current calendar year)
   * @returns Success response with message and updated profile row
   */
  recalculateAnnualProfile(personnelId: string, year: number = new Date().getFullYear()): Promise<{ success: boolean; message: string; data: HoSoHangNam }> {
    return recalculateAnnualProfile(personnelId, year);
  }

  /**
   * Chain eligibility for BKBQP / CSTDTQ / BKTTCP (proposal submit, approval, import preview).
   * @param personnelId - Personnel ID
   * @param year - Proposal year under validation
   * @param danhHieu - Medal code to validate
   * @returns Eligibility result with operator-facing reason
   */
  checkAwardEligibility(personnelId: string, year: number, danhHieu: string): Promise<EligibilityResult> {
    return checkAwardEligibility(personnelId, year, danhHieu);
  }

  /**
   * Recomputes HCCSVV tier statuses and hints on `ho_so_nien_han` from `khen_thuong_hccsvv` (tenure medals only).
   * @param personnelId - Personnel ID
   * @returns Success message for admin flows
   */
  recalculateTenureProfile(personnelId: string): Promise<{ message: string }> {
    return recalculateTenureProfile(personnelId);
  }

  /**
   * Recomputes HCBVTQ months and tier eligibility on `ho_so_cong_hien` from position history and existing medals.
   * @param personnelId - Personnel ID
   * @returns Success message for admin flows
   */
  recalculateContributionProfile(personnelId: string): Promise<{ message: string }> {
    return recalculateContributionProfile(personnelId);
  }

  /**
   * Batch job: `recalculateAnnualProfile` for every personnel (best-effort per row).
   * @returns Aggregate counts and per-personnel error list
   */
  recalculateAll(): Promise<RecalculateResult> {
    return recalculateAll();
  }

  /**
   * Recalculates all three profile types (annual, tenure, contribution) for one personnel.
   * @param personnelId - Personnel ID
   * @returns The personnel's name for the caller's success message
   * @throws NotFoundError - When the personnel does not exist
   */
  recalculateFullProfile(personnelId: string): Promise<{ ho_ten: string | null }> {
    return recalculateFullProfile(personnelId);
  }

  /**
   * Batch job: recalculates all three profile types for every personnel (best-effort per row).
   * @returns Aggregate counts and per-personnel error list
   */
  recalculateAllFullProfiles(): Promise<RecalculateResult> {
    return recalculateAllFullProfiles();
  }

  /**
   * Admin listing of tenure profiles with nested unit + position context.
   * @returns All `ho_so_nien_han` rows with relations
   */
  getAllTenureProfiles(): Promise<HoSoNienHan[]> {
    return getAllTenureProfiles();
  }

  /**
   * Partially updates tenure medal statuses after admin verification.
   * @param personnelId - Personnel ID
   * @param updates - Subset of HCCSVV / HCBVTQ status fields
   * @returns Updated `ho_so_nien_han` row (status columns only; no relation includes)
   */
  updateTenureProfile(personnelId: string, updates: TenureProfileUpdate): Promise<HoSoNienHan> {
    return updateTenureProfile(personnelId, updates);
  }
}

export default new ProfileService();
