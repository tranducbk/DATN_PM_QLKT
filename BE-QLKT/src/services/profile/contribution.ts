import type {
  QuanNhan,
  LichSuChucVu,
} from '../../generated/prisma';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { contributionMedalRepository } from '../../repositories/contributionMedal.repository';
import { contributionProfileRepository } from '../../repositories/contributionProfile.repository';
import { ELIGIBILITY_STATUS } from '../../constants/eligibilityStatus.constants';
import { NotFoundError } from '../../middlewares/errorHandler';
import { DANH_HIEU_HCBVTQ, CONG_HIEN_BASE_REQUIRED_MONTHS, CONG_HIEN_FEMALE_REQUIRED_MONTHS, HCBVTQ_RANK_KEYS, type HcbvtqRankKey } from '../../constants/danhHieu.constants';
import { GENDER } from '../../constants/gender.constants';
import type { HCBVTQCalcResult } from './types';

/**
 * Loads or creates the contribution profile with months and tier statuses.
 * @param personnelId - Personnel ID
 * @returns Contribution profile row (created when missing)
 */
export async function getContributionProfile(personnelId: string) {
  const personnel = await quanNhanRepository.findIdById(personnelId);

  if (!personnel) {
    throw new NotFoundError('Quân nhân');
  }

  let profile = await contributionProfileRepository.findUniqueRaw({
    where: { quan_nhan_id: personnelId },
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
  });

  if (!profile) {
    profile = await contributionProfileRepository.createRaw({
      data: {
        quan_nhan_id: personnelId,
        hcbvtq_total_months: 0,
        hcbvtq_hang_ba_status: ELIGIBILITY_STATUS.CHUA_DU,
        hcbvtq_hang_nhi_status: ELIGIBILITY_STATUS.CHUA_DU,
        hcbvtq_hang_nhat_status: ELIGIBILITY_STATUS.CHUA_DU,
        goi_y: 'Chưa có dữ liệu để tính toán. Vui lòng nhập lịch sử chức vụ.',
      },
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
    });
  }

  return profile;
}

/**
 * Recomputes HCBVTQ months and tier eligibility on `ho_so_cong_hien` from position history and existing medals.
 * @param personnelId - Personnel ID
 * @returns Success message for admin flows
 */
export async function recalculateContributionProfile(personnelId: string): Promise<{ message: string }> {
  const checkEligibleForRank = (
    personnel: QuanNhan & { LichSuChucVu: LichSuChucVu[] },
    rank: HcbvtqRankKey
  ): boolean => {
    const months0_9_1_0 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.9-1.0');
    const months0_8 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.8');
    const months0_7 = getTotalMonthsByGroup(personnel.LichSuChucVu, '0.7');
    const baseRequiredMonths = CONG_HIEN_BASE_REQUIRED_MONTHS;
    const femaleRequiredMonths = CONG_HIEN_FEMALE_REQUIRED_MONTHS;

    const requiredMonths =
      personnel?.gioi_tinh === GENDER.FEMALE ? femaleRequiredMonths : baseRequiredMonths;

    if (rank === HCBVTQ_RANK_KEYS.HANG_NHAT) {
      return months0_9_1_0 >= requiredMonths;
    } else if (rank === HCBVTQ_RANK_KEYS.HANG_NHI) {
      return months0_8 + months0_9_1_0 >= requiredMonths;
    } else if (rank === HCBVTQ_RANK_KEYS.HANG_BA) {
      return months0_7 + months0_8 + months0_9_1_0 >= requiredMonths;
    }

    return false;
  };
  const getTotalMonthsByGroup = (histories: LichSuChucVu[], group: '0.7' | '0.8' | '0.9-1.0'): number => {
    let totalMonths = 0;

    histories.forEach(history => {
      const heSo = Number(history.he_so_chuc_vu) || 0;
      let belongsToGroup = false;

      if (group === '0.7') {
        belongsToGroup = heSo >= 0.7 && heSo < 0.8;
      } else if (group === '0.8') {
        belongsToGroup = heSo >= 0.8 && heSo < 0.9;
      } else if (group === '0.9-1.0') {
        belongsToGroup = heSo >= 0.9 && heSo <= 1.0;
      }
      const monthDiff = (start: Date, end: Date): number => {
        const s = new Date(start);
        const e = new Date(end);

        return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
      };

      if (belongsToGroup) {
        // so_thang is null for current position — calculate from start date
        totalMonths += history.so_thang || monthDiff(history.ngay_bat_dau, new Date());
      }
    });

    return totalMonths;
  };

  const selectedPersonnel = await quanNhanRepository.findUniqueRaw({
    where: { id: personnelId },
    include: {
      LichSuChucVu: {
        include: {
          ChucVu: true,
        },
        orderBy: {
          ngay_bat_dau: 'asc',
        },
      },
    },
  });

    if (!selectedPersonnel) {
      throw new NotFoundError('Quân nhân');
    }

    const personnelHCBVTQ = await contributionMedalRepository.findManyRaw({
      where: { quan_nhan_id: personnelId },
    });

    // Award hierarchy: lower rank must be received (DA_NHAN) before higher rank can be proposed
    const hcbvtqBa = personnelHCBVTQ.find(kt => kt.danh_hieu === DANH_HIEU_HCBVTQ.HANG_BA)
      ? {
          status: ELIGIBILITY_STATUS.DA_NHAN,
        }
      : (await checkEligibleForRank(selectedPersonnel, HCBVTQ_RANK_KEYS.HANG_BA))
        ? { status: ELIGIBILITY_STATUS.DU_DIEU_KIEN }
        : { status: ELIGIBILITY_STATUS.CHUA_DU };

    const hcbvtqNhi = personnelHCBVTQ.find(kt => kt.danh_hieu === DANH_HIEU_HCBVTQ.HANG_NHI)
      ? {
          status: ELIGIBILITY_STATUS.DA_NHAN,
        }
      : (await checkEligibleForRank(selectedPersonnel, HCBVTQ_RANK_KEYS.HANG_NHI))
        ? { status: ELIGIBILITY_STATUS.DU_DIEU_KIEN }
        : { status: ELIGIBILITY_STATUS.CHUA_DU };

    const hcbvtqNhat = personnelHCBVTQ.find(kt => kt.danh_hieu === DANH_HIEU_HCBVTQ.HANG_NHAT)
      ? {
          status: ELIGIBILITY_STATUS.DA_NHAN,
        }
      : (await checkEligibleForRank(selectedPersonnel, HCBVTQ_RANK_KEYS.HANG_NHAT))
        ? { status: ELIGIBILITY_STATUS.DU_DIEU_KIEN }
        : { status: ELIGIBILITY_STATUS.CHUA_DU };

    const months0_7 = getTotalMonthsByGroup(selectedPersonnel.LichSuChucVu, '0.7');
    const months0_8 = getTotalMonthsByGroup(selectedPersonnel.LichSuChucVu, '0.8');
    const months0_9_1_0 = getTotalMonthsByGroup(selectedPersonnel.LichSuChucVu, '0.9-1.0');

    const contributionData = {
      hcbvtq_total_months: months0_7 + months0_8 + months0_9_1_0,
      months_07: months0_7,
      months_08: months0_8,
      months_0910: months0_9_1_0,
      hcbvtq_hang_ba_status: hcbvtqBa.status,
      hcbvtq_hang_ba_ngay: null as Date | null,
      hcbvtq_hang_nhi_status: hcbvtqNhi.status,
      hcbvtq_hang_nhi_ngay: null as Date | null,
      hcbvtq_hang_nhat_status: hcbvtqNhat.status,
      hcbvtq_hang_nhat_ngay: null as Date | null,
      goi_y: null as string | null,
    };

    await contributionProfileRepository.upsert(
      personnelId,
      { quan_nhan_id: personnelId, ...contributionData },
      contributionData
    );

    // Legacy table: refresh coefficient-group month mirrors when a contribution award row exists.
    const existingCongHien = await contributionMedalRepository.findUniqueRaw({
      where: { quan_nhan_id: personnelId },
    });

    if (existingCongHien) {
      await contributionMedalRepository.update(existingCongHien.id, {
        thoi_gian_nhom_0_7: existingCongHien.thoi_gian_nhom_0_7,
        thoi_gian_nhom_0_8: existingCongHien.thoi_gian_nhom_0_8,
        thoi_gian_nhom_0_9_1_0: existingCongHien.thoi_gian_nhom_0_9_1_0,
      });
    }

  return { message: 'Tính toán lại hồ sơ Huân chương Bảo vệ Tổ quốc thành công' };
}

/**
 * HCBVTQ tier helper: compares total months served against the coefficient-specific threshold.
 * @param totalMonths - Cumulative qualifying months
 * @param requiredMonths - Threshold from position group rules
 * @param currentStatus - Existing `ELIGIBILITY_STATUS` (preserves `DA_NHAN`)
 * @param rank - Medal tier label used in `goiY` text
 * @returns Status, optional milestone date, and Vietnamese guidance string
 */
export function calculateHCBVTQ(
  totalMonths: number,
  requiredMonths: number,
  currentStatus: string,
  rank: string
): HCBVTQCalcResult {
  // Already received — preserve status
  if (currentStatus === ELIGIBILITY_STATUS.DA_NHAN) {
    return {
      status: ELIGIBILITY_STATUS.DA_NHAN,
      ngay: null,
      goiY: '',
    };
  }

  if (totalMonths >= requiredMonths) {
    const years = Math.floor(totalMonths / 12);
    return {
      status: ELIGIBILITY_STATUS.DU_DIEU_KIEN,
      ngay: new Date(),
      goiY: `Đủ điều kiện xét Huân chương Bảo vệ Tổ quốc Hạng ${rank} (đã công tác ${years} năm).`,
    };
  }

  // Not yet eligible
  const remainingMonths = requiredMonths - totalMonths;
  const remainingYears = Math.floor(remainingMonths / 12);
  const remainingMonthsOnly = remainingMonths % 12;

  return {
    status: ELIGIBILITY_STATUS.CHUA_DU,
    ngay: null,
    goiY:
      remainingYears > 0
        ? `Còn ${remainingYears} năm ${remainingMonthsOnly} tháng nữa mới đủ điều kiện xét Huân chương Bảo vệ Tổ quốc Hạng ${rank}.`
        : `Còn ${remainingMonthsOnly} tháng nữa mới đủ điều kiện xét Huân chương Bảo vệ Tổ quốc Hạng ${rank}.`,
  };
}
