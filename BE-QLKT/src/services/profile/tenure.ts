import type {
  HoSoNienHan,
} from '../../generated/prisma';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { tenureMedalRepository } from '../../repositories/tenureMedal.repository';
import { tenureProfileRepository } from '../../repositories/tenureProfile.repository';
import { ELIGIBILITY_STATUS } from '../../constants/eligibilityStatus.constants';
import { formatServiceDuration } from '../../helpers/serviceYearsHelper';
import { NotFoundError } from '../../middlewares/errorHandler';
import { DANH_HIEU_HCCSVV } from '../../constants/danhHieu.constants';
import type { HCCSVVCalcResult, TenureProfileUpdate } from './types';

/**
 * Loads or creates the tenure profile and augments it with award year/month data.
 * @param personnelId - Personnel ID
 * @returns Tenure profile with hccsvv_nam_nhan timeline data
 */
export async function getTenureProfile(personnelId: string) {
  const includeQuanNhan = {
    QuanNhan: {
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: { include: { CoQuanDonVi: true } },
        ChucVu: true,
        KhenThuongHCCSVV: { select: { danh_hieu: true, nam: true, thang: true } },
      },
    },
  };

  let profile = await tenureProfileRepository.findUniqueRaw({
    where: { quan_nhan_id: personnelId },
    include: includeQuanNhan,
  });

  if (!profile) {
    profile = await tenureProfileRepository.createRaw({
      data: {
        quan_nhan_id: personnelId,
        hccsvv_hang_ba_status: ELIGIBILITY_STATUS.CHUA_DU,
        hccsvv_hang_nhi_status: ELIGIBILITY_STATUS.CHUA_DU,
        hccsvv_hang_nhat_status: ELIGIBILITY_STATUS.CHUA_DU,
        goi_y: 'Chưa có dữ liệu để tính toán. Vui lòng nhập lịch sử chức vụ.',
      },
      include: includeQuanNhan,
    });
  }

  (profile as Record<string, unknown>).hccsvv_nam_nhan = Object.fromEntries(
    (profile.QuanNhan?.KhenThuongHCCSVV || []).map(r => [r.danh_hieu, { nam: r.nam, thang: r.thang }])
  );

  return profile;
}

/**
 * Eligibility date = enlistment + required years of service for the given HCCSVV tier.
 * @param ngayNhapNgu - Enlistment date
 * @param soNam - Required tenure (10 / 15 / 20)
 * @returns Calendar date when the tier becomes eligible, or `null` without enlistment
 */
export function calculateEligibilityDate(ngayNhapNgu: Date | null | undefined, soNam: number): Date | null {
  if (!ngayNhapNgu) return null;
  const eligibilityDate = new Date(ngayNhapNgu);
  eligibilityDate.setFullYear(eligibilityDate.getFullYear() + soNam);
  return eligibilityDate;
}

/**
 * Eligibility snapshot for one HCCSVV tier, including operator-facing `goiY` text.
 * @param ngayNhapNgu - Enlistment date
 * @param soNam - Required years for this tier
 * @param currentStatus - `ELIGIBILITY_STATUS` from `ho_so_nien_han`
 * @param hangName - Tier label
 * @returns Status, optional milestone date, and Vietnamese guidance string
 */
export function calculateHCCSVV(
  ngayNhapNgu: Date | null | undefined,
  soNam: number,
  currentStatus: string,
  hangName: string
): HCCSVVCalcResult {
  if (!ngayNhapNgu) {
    return {
      status: ELIGIBILITY_STATUS.CHUA_DU,
      ngay: null,
      goiY: `Chưa có ngày nhập ngũ. Không thể tính toán HCCSVV Hạng ${hangName}.`,
    };
  }

  const today = new Date();
  const eligibilityDate = calculateEligibilityDate(ngayNhapNgu, soNam);

  // Case 13: Admin explicitly set DA_NHAN
  if (currentStatus === ELIGIBILITY_STATUS.DA_NHAN) {
    return {
      status: ELIGIBILITY_STATUS.DA_NHAN,
      ngay: eligibilityDate,
      goiY: `Đã nhận HCCSVV Hạng ${hangName}.`,
    };
  }

  if (today >= eligibilityDate) {
    return {
      status: ELIGIBILITY_STATUS.DU_DIEU_KIEN,
      ngay: eligibilityDate,
      goiY: `Đủ điều kiện (${soNam} năm) xét HCCSVV Hạng ${hangName}. Ngày đủ điều kiện: ${eligibilityDate.toLocaleDateString('vi-VN')}.`,
    };
  }

  const monthsLeft = Math.max(0,
    (eligibilityDate.getFullYear() - today.getFullYear()) * 12 +
    eligibilityDate.getMonth() - today.getMonth()
  );
  return {
    status: ELIGIBILITY_STATUS.CHUA_DU,
    ngay: null,
    goiY: `Chưa đủ điều kiện (${soNam} năm) xét HCCSVV Hạng ${hangName}. Dự kiến: ${eligibilityDate.toLocaleDateString('vi-VN')} (còn ${formatServiceDuration(monthsLeft)}).`,
  };
}

/**
 * Recomputes HCCSVV tier statuses and hints on `ho_so_nien_han` from `khen_thuong_hccsvv` (tenure medals only).
 * @param personnelId - Personnel ID
 * @returns Success message for admin flows
 */
export async function recalculateTenureProfile(personnelId: string): Promise<{ message: string }> {
  const personnel = await quanNhanRepository.findUniqueRaw({
    where: { id: personnelId },
    select: { id: true, ngay_nhap_ngu: true },
  });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    const existingProfile = await tenureProfileRepository.findByPersonnelId(personnelId);

    const khenthuonghccsvv = await tenureMedalRepository.findManyRaw({
      where: { quan_nhan_id: personnelId },
    });

    // Reset status when no HCCSVV awards exist
    let newProfile: Partial<HoSoNienHan> = existingProfile ?? {};
    newProfile.hccsvv_hang_ba_status = ELIGIBILITY_STATUS.CHUA_DU;
    newProfile.hccsvv_hang_nhi_status = ELIGIBILITY_STATUS.CHUA_DU;
    newProfile.hccsvv_hang_nhat_status = ELIGIBILITY_STATUS.CHUA_DU;

    // Store actual award year for FE display (differs from eligibility year)
    const hccsvvNamNhan: Record<string, number | null> = {
      [DANH_HIEU_HCCSVV.HANG_BA]: null,
      [DANH_HIEU_HCCSVV.HANG_NHI]: null,
      [DANH_HIEU_HCCSVV.HANG_NHAT]: null,
    };
    for (const kt of khenthuonghccsvv) {
      if (kt.danh_hieu === DANH_HIEU_HCCSVV.HANG_BA) {
        newProfile.hccsvv_hang_ba_status = ELIGIBILITY_STATUS.DA_NHAN;
        hccsvvNamNhan[DANH_HIEU_HCCSVV.HANG_BA] = kt.nam;
      }
      if (kt.danh_hieu === DANH_HIEU_HCCSVV.HANG_NHI) {
        newProfile.hccsvv_hang_nhi_status = ELIGIBILITY_STATUS.DA_NHAN;
        hccsvvNamNhan[DANH_HIEU_HCCSVV.HANG_NHI] = kt.nam;
      }
      if (kt.danh_hieu === DANH_HIEU_HCCSVV.HANG_NHAT) {
        newProfile.hccsvv_hang_nhat_status = ELIGIBILITY_STATUS.DA_NHAN;
        hccsvvNamNhan[DANH_HIEU_HCCSVV.HANG_NHAT] = kt.nam;
      }
    }

    // HCCSVV calculation
    const hccsvvBa = calculateHCCSVV(
      personnel.ngay_nhap_ngu,
      10,
      newProfile.hccsvv_hang_ba_status || ELIGIBILITY_STATUS.CHUA_DU,
      'Ba'
    );
    // Preserve the approval date entered by admins; do not recompute it here.
    if (hccsvvBa.status === ELIGIBILITY_STATUS.DA_NHAN && existingProfile?.hccsvv_hang_ba_ngay) {
      hccsvvBa.ngay = existingProfile.hccsvv_hang_ba_ngay;
    }

    // Rank 2 requires Rank 3 to already be received (DA_NHAN), not just eligible
    let hccsvvNhi;
    if (newProfile.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN) {
      hccsvvNhi = calculateHCCSVV(
        personnel.ngay_nhap_ngu,
        15,
        newProfile.hccsvv_hang_nhi_status || ELIGIBILITY_STATUS.CHUA_DU,
        'Nhì'
      );
      if (hccsvvNhi.status === ELIGIBILITY_STATUS.DA_NHAN && existingProfile?.hccsvv_hang_nhi_ngay) {
        hccsvvNhi.ngay = existingProfile.hccsvv_hang_nhi_ngay;
      }
    } else {
      hccsvvNhi = {
        status: ELIGIBILITY_STATUS.CHUA_DU,
        ngay: null,
        goiY: '',
      };
    }

    // Rank 1 requires Rank 2 to already be received (DA_NHAN)
    let hccsvvNhat;
    if (newProfile.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN) {
      hccsvvNhat = calculateHCCSVV(
        personnel.ngay_nhap_ngu,
        20,
        newProfile.hccsvv_hang_nhat_status || ELIGIBILITY_STATUS.CHUA_DU,
        'Nhất'
      );
      if (hccsvvNhat.status === ELIGIBILITY_STATUS.DA_NHAN && existingProfile?.hccsvv_hang_nhat_ngay) {
        hccsvvNhat.ngay = existingProfile.hccsvv_hang_nhat_ngay;
      }
    } else {
      hccsvvNhat = {
        status: ELIGIBILITY_STATUS.CHUA_DU,
        ngay: null,
        goiY: '',
      };
    }

    const goiYList = [];
    if (hccsvvBa.goiY) goiYList.push(hccsvvBa.goiY);
    if (hccsvvNhi.goiY) goiYList.push(hccsvvNhi.goiY);
    if (hccsvvNhat.goiY) goiYList.push(hccsvvNhat.goiY);

    const finalGoiY =
      goiYList.length > 0
        ? goiYList.join('\n')
        : 'Chưa đủ điều kiện xét Huy chương Chiến sĩ vẻ vang.';

    const tenureData = {
      hccsvv_hang_ba_status: hccsvvBa.status,
      hccsvv_hang_ba_ngay: hccsvvBa.ngay,
      hccsvv_hang_nhi_status: hccsvvNhi.status,
      hccsvv_hang_nhi_ngay: hccsvvNhi.ngay,
      hccsvv_hang_nhat_status: hccsvvNhat.status,
      hccsvv_hang_nhat_ngay: hccsvvNhat.ngay,
      goi_y: finalGoiY,
    };

    await tenureProfileRepository.upsert(
      personnelId,
      { quan_nhan_id: personnelId, ...tenureData },
      tenureData
    );
  return { message: 'Tính toán lại hồ sơ Huy chương Chiến sĩ vẻ vang thành công' };
}

/**
 * Admin listing of tenure profiles with nested unit + position context.
 * @returns All `ho_so_nien_han` rows with relations
 */
export async function getAllTenureProfiles(): Promise<HoSoNienHan[]> {
  const profiles = await tenureProfileRepository.findManyRaw({
    include: {
      QuanNhan: {
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          ChucVu: true,
        },
      },
    },
    orderBy: {
      quan_nhan_id: 'asc',
    },
  });

  return profiles;
}

/**
 * Partially updates tenure medal statuses after admin verification.
 * @param personnelId - Personnel ID
 * @param updates - Subset of HCCSVV / HCBVTQ status fields
 * @returns Updated `ho_so_nien_han` row (status columns only; no relation includes)
 */
export async function updateTenureProfile(personnelId: string, updates: TenureProfileUpdate): Promise<HoSoNienHan> {
  const profile = await tenureProfileRepository.findByPersonnelId(personnelId);

  if (!profile) {
    throw new NotFoundError('Hồ sơ Huy chương Chiến sĩ vẻ vang');
  }

  const validStatuses: string[] = [
    ELIGIBILITY_STATUS.CHUA_DU,
    ELIGIBILITY_STATUS.DU_DIEU_KIEN,
    ELIGIBILITY_STATUS.DA_NHAN,
  ];
  const updateData: Record<string, any> = {};

  if (updates.hccsvv_hang_ba_status && validStatuses.includes(updates.hccsvv_hang_ba_status)) {
    updateData.hccsvv_hang_ba_status = updates.hccsvv_hang_ba_status;
  }
  if (updates.hccsvv_hang_nhi_status && validStatuses.includes(updates.hccsvv_hang_nhi_status)) {
    updateData.hccsvv_hang_nhi_status = updates.hccsvv_hang_nhi_status;
  }
  if (
    updates.hccsvv_hang_nhat_status &&
    validStatuses.includes(updates.hccsvv_hang_nhat_status)
  ) {
    updateData.hccsvv_hang_nhat_status = updates.hccsvv_hang_nhat_status;
  }

  if (updates.hcbvtq_hang_ba_status && validStatuses.includes(updates.hcbvtq_hang_ba_status)) {
    updateData.hcbvtq_hang_ba_status = updates.hcbvtq_hang_ba_status;
  }
  if (updates.hcbvtq_hang_nhi_status && validStatuses.includes(updates.hcbvtq_hang_nhi_status)) {
    updateData.hcbvtq_hang_nhi_status = updates.hcbvtq_hang_nhi_status;
  }
  if (
    updates.hcbvtq_hang_nhat_status &&
    validStatuses.includes(updates.hcbvtq_hang_nhat_status)
  ) {
    updateData.hcbvtq_hang_nhat_status = updates.hcbvtq_hang_nhat_status;
  }

  const updatedProfile = await tenureProfileRepository.updateRaw({
    where: { quan_nhan_id: personnelId },
    data: updateData,
  });

  return updatedProfile;
}
