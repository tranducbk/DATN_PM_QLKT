import type {
  HoSoNienHan,
  HoSoHangNam,
  DanhHieuHangNam,
  ThanhTichKhoaHoc,
} from '../generated/prisma';
import type { EligibilityResult } from './eligibility/chainEligibility';
import type {
  HCCSVVCalcResult,
  HCBVTQCalcResult,
  SpecialCaseResult,
  NCKHYearsResult,
  TenureProfileUpdate,
  RecalculateResult,
} from './profile/types';
import {
  getAnnualProfile,
  calculateContinuousCSTDCS,
  calculateContinuousNCKH,
  countBKBQPInStreak,
  countCSTDTQInStreak,
  checkNCKHInYears,
  handleSpecialCases,
  recalculateAnnualProfile,
  checkAwardEligibility,
  recalculateAll,
} from './profile/annual';
import {
  getTenureProfile,
  calculateEligibilityDate,
  calculateHCCSVV,
  recalculateTenureProfile,
  getAllTenureProfiles,
  updateTenureProfile,
} from './profile/tenure';
import {
  getContributionProfile,
  recalculateContributionProfile,
  calculateHCBVTQ,
} from './profile/contribution';

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
   * Longest backward chain of calendar years ending at `year - 1` where each year has `danh_hieu === 'CSTDCS'`.
   * @param danhHieuList - `DanhHieuHangNam` rows (callers may pass filtered or full lists)
   * @param year - Evaluation anchor year
   * @returns Streak length; non-`CSTDCS` years in the sequence stop the count
   */
  calculateContinuousCSTDCS(danhHieuList: DanhHieuHangNam[], year: number): number {
    return calculateContinuousCSTDCS(danhHieuList, year);
  }

  /**
   * Counts consecutive approved science rows ending at `year - 1` (one per calendar year).
   * @param thanhTichList - `ThanhTichKhoaHoc` rows (any order; sorted internally)
   * @param year - Proposal / evaluation anchor year
   * @returns Streak length
   */
  calculateContinuousNCKH(thanhTichList: ThanhTichKhoaHoc[], year: number): number {
    return calculateContinuousNCKH(thanhTichList, year);
  }

  /**
   * Đếm tổng số lần nhận BKBQP trong chuỗi CSTDCS liên tục.
   */
  countBKBQPInStreak(danhHieuList: DanhHieuHangNam[], year: number, cstdcsStreak: number): number {
    return countBKBQPInStreak(danhHieuList, year, cstdcsStreak);
  }

  /**
   * Đếm tổng số lần nhận CSTDTQ trong chuỗi CSTDCS liên tục.
   */
  countCSTDTQInStreak(danhHieuList: DanhHieuHangNam[], year: number, cstdcsStreak: number): number {
    return countCSTDTQInStreak(danhHieuList, year, cstdcsStreak);
  }

  /**
   * Whether approved NCKH exists for any year in the candidate list.
   * @param nckhList - Approved `ThanhTichKhoaHoc` rows
   * @param years - Years to intersect (e.g. streak window)
   * @returns Flags plus the matching year subset
   */
  checkNCKHInYears(nckhList: ThanhTichKhoaHoc[], years: number[]): NCKHYearsResult {
    return checkNCKHInYears(nckhList, years);
  }

  /**
   * Detects admin-forced medals or broken CSTDCS chains that restart eligibility messaging.
   * @param danhHieuList - Annual rows (newest first after internal sort)
   * @returns Whether to show a one-off hint and whether streak counters reset
   */
  handleSpecialCases(danhHieuList: DanhHieuHangNam[]): SpecialCaseResult {
    return handleSpecialCases(danhHieuList);
  }

  /**
   * Eligibility date = enlistment + required years of service for the given HCCSVV tier.
   * @param ngayNhapNgu - Enlistment date
   * @param soNam - Required tenure (10 / 15 / 20)
   * @returns Calendar date when the tier becomes eligible, or `null` without enlistment
   */
  calculateEligibilityDate(ngayNhapNgu: Date | null | undefined, soNam: number): Date | null {
    return calculateEligibilityDate(ngayNhapNgu, soNam);
  }

  /**
   * Eligibility snapshot for one HCCSVV tier, including operator-facing `goiY` text.
   * @param ngayNhapNgu - Enlistment date
   * @param soNam - Required years for this tier
   * @param currentStatus - `ELIGIBILITY_STATUS` from `ho_so_nien_han`
   * @param hangName - Tier label
   * @returns Status, optional milestone date, and Vietnamese guidance string
   */
  calculateHCCSVV(
    ngayNhapNgu: Date | null | undefined,
    soNam: number,
    currentStatus: string,
    hangName: string
  ): HCCSVVCalcResult {
    return calculateHCCSVV(ngayNhapNgu, soNam, currentStatus, hangName);
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
   * HCBVTQ tier helper: compares total months served against the coefficient-specific threshold.
   * @param totalMonths - Cumulative qualifying months
   * @param requiredMonths - Threshold from position group rules
   * @param currentStatus - Existing `ELIGIBILITY_STATUS` (preserves `DA_NHAN`)
   * @param rank - Medal tier label used in `goiY` text
   * @returns Status, optional milestone date, and Vietnamese guidance string
   */
  calculateHCBVTQ(
    totalMonths: number,
    requiredMonths: number,
    currentStatus: string,
    rank: string
  ): HCBVTQCalcResult {
    return calculateHCBVTQ(totalMonths, requiredMonths, currentStatus, rank);
  }

  /**
   * Batch job: `recalculateAnnualProfile` for every personnel (best-effort per row).
   * @returns Aggregate counts and per-personnel error list
   */
  recalculateAll(): Promise<RecalculateResult> {
    return recalculateAll();
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
