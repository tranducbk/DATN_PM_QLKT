import { PROPOSAL_TYPES, type ProposalType } from '@/constants/proposal.constants';
import { HCQKQT_YEARS_REQUIRED } from '@/constants/danhHieu.constants';
import type { TitleDataItem } from '@/lib/types/proposal';

interface PersonnelWithMilitaryInfo {
  ho_ten: string;
  gioi_tinh?: string;
  ngay_nhap_ngu?: string | Date | null;
  ngay_xuat_ngu?: string | Date | null;
}

export const getProposalReferenceEndDate = (nam: number, thang: number): Date => {
  if (Number.isInteger(thang) && thang >= 1 && thang <= 12) {
    return new Date(nam, thang, 0);
  }
  return new Date(nam, 11, 31);
};

export const canProceedToNextStep = (
  currentStep: number,
  proposalType: ProposalType,
  selectedPersonnelIds: string[],
  selectedUnitIds: string[],
  titleData: TitleDataItem[]
): boolean => {
  switch (currentStep) {
    case 0:
      return true;
    case 1:
      if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        return selectedUnitIds.length > 0;
      }
      return selectedPersonnelIds.length > 0;
    case 2: {
      const expectedLength =
        proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM
          ? selectedUnitIds.length
          : selectedPersonnelIds.length;
      if (titleData.length !== expectedLength) return false;

      if (proposalType === PROPOSAL_TYPES.NCKH) {
        return titleData.every(d => d.loai && d.mo_ta && d.cap_bac && d.chuc_vu);
      }

      if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        return titleData.every(d => d.danh_hieu);
      }

      return titleData.every(d => d.danh_hieu && d.cap_bac?.trim() && d.chuc_vu?.trim());
    }
    case 3:
      return true;
    default:
      return false;
  }
};

/**
 * Validates KNC_VSNXD_QDNDVN personnel: must have gender + enlistment date.
 * @param personnelData - List of personnel to validate
 * @param context - 'next' when advancing steps, 'submit' when submitting
 * @returns Error message string, or null if all pass
 */
export function buildKNCValidationError(
  personnelData: PersonnelWithMilitaryInfo[],
  context: 'next' | 'submit'
): string | null {
  const missingGender = personnelData.filter(
    p => !p.gioi_tinh || (p.gioi_tinh !== 'NAM' && p.gioi_tinh !== 'NU')
  );
  const missingNgayNhapNgu = personnelData.filter(p => !p.ngay_nhap_ngu);
  if (missingGender.length === 0 && missingNgayNhapNgu.length === 0) return null;

  const errors: string[] = [];
  if (missingGender.length > 0) {
    errors.push(`chưa cập nhật giới tính: ${missingGender.map(p => p.ho_ten).join(', ')}`);
  }
  if (missingNgayNhapNgu.length > 0) {
    errors.push(`chưa cập nhật ngày nhập ngũ: ${missingNgayNhapNgu.map(p => p.ho_ten).join(', ')}`);
  }
  const suffix = context === 'submit' ? 'trước khi đề xuất' : 'trước khi tiếp tục';
  return `Một số quân nhân ${errors.join(' và ')}. Vui lòng cập nhật ${suffix}.`;
}

/**
 * Validates NIEN_HAN personnel: must have enlistment date.
 * @param personnelData - List of personnel to validate
 * @param context - 'next' when advancing steps, 'submit' when submitting
 * @returns Error message string, or null if all pass
 */
export function buildNienHanValidationError(
  personnelData: PersonnelWithMilitaryInfo[],
  context: 'next' | 'submit'
): string | null {
  const missing = personnelData.filter(p => !p.ngay_nhap_ngu);
  if (missing.length === 0) return null;
  const names = missing.map(p => p.ho_ten).join(', ');
  const suffix = context === 'submit' ? 'trước khi đề xuất' : 'trước khi tiếp tục';
  return `Một số quân nhân chưa cập nhật ngày nhập ngũ: ${names}. Vui lòng cập nhật ${suffix}.`;
}

/**
 * Validates HC_QKQT personnel: must have >= HCQKQT_YEARS_REQUIRED years of service.
 * @param personnelData - List of personnel to validate
 * @param referenceEndDate - Reference date for service duration calculation
 * @param context - 'next' when advancing steps, 'submit' when submitting
 * @returns Error message string, or null if all pass
 */
export function buildHCQKQTValidationError(
  personnelData: PersonnelWithMilitaryInfo[],
  referenceEndDate: Date,
  context: 'next' | 'submit'
): string | null {
  const ineligible: Array<{ ho_ten: string; reason: string }> = [];

  for (const p of personnelData) {
    if (!p.ngay_nhap_ngu) {
      ineligible.push({ ho_ten: p.ho_ten, reason: 'Chưa cập nhật ngày nhập ngũ' });
      continue;
    }

    const ngayNhapNgu = new Date(p.ngay_nhap_ngu);
    const ngayKetThuc = p.ngay_xuat_ngu ? new Date(p.ngay_xuat_ngu) : referenceEndDate;
    const effectiveEndDate = ngayKetThuc > referenceEndDate ? referenceEndDate : ngayKetThuc;

    const months = Math.max(
      0,
      (effectiveEndDate.getFullYear() - ngayNhapNgu.getFullYear()) * 12 +
        effectiveEndDate.getMonth() -
        ngayNhapNgu.getMonth()
    );
    const years = Math.floor(months / 12);

    if (years < HCQKQT_YEARS_REQUIRED) {
      ineligible.push({
        ho_ten: p.ho_ten,
        reason: `Chưa đủ ${HCQKQT_YEARS_REQUIRED} năm phục vụ (hiện tại: ${years} năm)`,
      });
    }
  }

  if (ineligible.length === 0) return null;

  const names = ineligible.map(p => `${p.ho_ten} (${p.reason})`).join(', ');
  const suffix = context === 'submit' ? 'trước khi đề xuất' : 'trước khi tiếp tục';
  return `Một số quân nhân chưa đủ điều kiện đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= ${HCQKQT_YEARS_REQUIRED} năm): ${names}. Vui lòng cập nhật ${suffix}.`;
}

/**
 * Computes per-title counts and percentages for the proposal review step.
 * @param reviewTableData - Rows with optional danh_hieu field
 * @param allowedTitles - Subset of titles to include in stats
 * @returns Array of stats entries, or null if no matching titles found
 */
export function computeTitleStats(
  reviewTableData: Array<{ danh_hieu?: string }>,
  allowedTitles: string[]
): Array<{ title: string; count: number; percentage: string }> | null {
  const titleCounts: Record<string, number> = {};
  reviewTableData.forEach(item => {
    const title = item.danh_hieu;
    if (title && allowedTitles.includes(title)) {
      titleCounts[title] = (titleCounts[title] || 0) + 1;
    }
  });
  if (Object.keys(titleCounts).length === 0) return null;
  const total = Object.values(titleCounts).reduce((sum, count) => sum + count, 0);
  return Object.entries(titleCounts).map(([title, count]) => ({
    title,
    count,
    percentage: ((count / total) * 100).toFixed(1),
  }));
}
