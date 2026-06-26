import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { aggregatePositionMonthsByGroup } from '../eligibility/contributionMonthsAggregator';
import { contributionMedalRepository } from '../../repositories/contributionMedal.repository';
import { contributionProfileRepository } from '../../repositories/contributionProfile.repository';
import { ELIGIBILITY_STATUS } from '../../constants/eligibilityStatus.constants';
import { NotFoundError } from '../../middlewares/errorHandler';
import {
  DANH_HIEU_HCBVTQ,
  CONTRIBUTION_BASE_REQUIRED_MONTHS,
  CONTRIBUTION_FEMALE_REQUIRED_MONTHS,
  CONTRIBUTION_COEFFICIENT_GROUPS,
  HCBVTQ_RANK_KEYS,
  cumulativeMonthsForHcbvtqRank,
  getLoaiDeXuatName,
  type HcbvtqRankKey,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { GENDER } from '../../constants/gender.constants';

const CONTRIBUTION_LABEL = getLoaiDeXuatName(PROPOSAL_TYPES.CONG_HIEN);

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
/*
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  CONTRIBUTION PROFILE — recalc trạng thái 3 hạng HCBVTQ              ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  KHÁC HCCSVV ở chỗ tính theo SỐ THÁNG NHÓM HỆ SỐ chức vụ thay vì    ║
 * ║  số năm phục vụ thuần. aggregatePositionMonthsByGroup gom lịch sử   ║
 * ║  chức vụ thành 3 nhóm hệ số: 0.7, 0.8, 0.9-1.0.                     ║
 * ║                                                                       ║
 * ║  NGƯỠNG theo giới tính: nữ = CONTRIBUTION_FEMALE_REQUIRED_MONTHS,   ║
 * ║  còn lại = CONTRIBUTION_BASE_REQUIRED_MONTHS (120 tháng = 10 năm).  ║
 * ║                                                                       ║
 * ║  3 HẠNG xét bằng cumulativeMonthsForHcbvtqRank: cộng dồn nhóm hệ số ║
 * ║  sàn của hạng đó VÀ các nhóm cao hơn (Hạng Ba từ 0.7, Hạng Nhì từ   ║
 * ║  0.8, Hạng Nhất chỉ 0.9-1.0) rồi so với ngưỡng.                     ║
 * ║                                                                       ║
 * ║  HIERARCHY + ADMIN OVERRIDE: đã có row trong contributionMedal →    ║
 * ║  DA_NHAN (giữ nguyên, không recalc đè); ngược lại đủ tháng →        ║
 * ║  DU_DIEU_KIEN, chưa đủ → CHUA_DU.                                   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
export async function recalculateContributionProfile(
  personnelId: string
): Promise<{ message: string }> {
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

  // Gom lịch sử chức vụ thành số tháng theo 3 nhóm hệ số (0.7 / 0.8 / 0.9-1.0).
  const monthsByGroup = aggregatePositionMonthsByGroup(selectedPersonnel.LichSuChucVu, new Date());
  // Ngưỡng tháng: nữ được giảm còn 2/3 mức nam (ưu đãi giới).
  const requiredMonths =
    selectedPersonnel.gioi_tinh === GENDER.FEMALE
      ? CONTRIBUTION_FEMALE_REQUIRED_MONTHS
      : CONTRIBUTION_BASE_REQUIRED_MONTHS;
  // Một hạng đủ ĐK khi tổng tháng cộng dồn (nhóm sàn của hạng + các nhóm cao hơn) >= ngưỡng.
  const isEligibleForRank = (rank: HcbvtqRankKey): boolean =>
    cumulativeMonthsForHcbvtqRank(monthsByGroup, rank) >= requiredMonths;

  const personnelHCBVTQ = await contributionMedalRepository.findManyRaw({
    where: { quan_nhan_id: personnelId },
  });

  // Award hierarchy: lower rank must be received (DA_NHAN) before a higher rank can be proposed.
  // 3 nhánh mỗi hạng: đã có trong sổ khen thưởng → DA_NHAN (không xét lại);
  // chưa có mà đủ tháng → DU_DIEU_KIEN; còn lại → CHUA_DU.
  const hcbvtqBa = personnelHCBVTQ.find(kt => kt.danh_hieu === DANH_HIEU_HCBVTQ.HANG_BA)
    ? { status: ELIGIBILITY_STATUS.DA_NHAN }
    : isEligibleForRank(HCBVTQ_RANK_KEYS.HANG_BA)
      ? { status: ELIGIBILITY_STATUS.DU_DIEU_KIEN }
      : { status: ELIGIBILITY_STATUS.CHUA_DU };

  const hcbvtqNhi = personnelHCBVTQ.find(kt => kt.danh_hieu === DANH_HIEU_HCBVTQ.HANG_NHI)
    ? { status: ELIGIBILITY_STATUS.DA_NHAN }
    : isEligibleForRank(HCBVTQ_RANK_KEYS.HANG_NHI)
      ? { status: ELIGIBILITY_STATUS.DU_DIEU_KIEN }
      : { status: ELIGIBILITY_STATUS.CHUA_DU };

  const hcbvtqNhat = personnelHCBVTQ.find(kt => kt.danh_hieu === DANH_HIEU_HCBVTQ.HANG_NHAT)
    ? { status: ELIGIBILITY_STATUS.DA_NHAN }
    : isEligibleForRank(HCBVTQ_RANK_KEYS.HANG_NHAT)
      ? { status: ELIGIBILITY_STATUS.DU_DIEU_KIEN }
      : { status: ELIGIBILITY_STATUS.CHUA_DU };

  const months0_7 = monthsByGroup[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]; // số tháng giữ chức hệ số 0.7
  const months0_8 = monthsByGroup[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]; // hệ số 0.8
  const months0_9_1_0 = monthsByGroup[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]; // hệ số 0.9-1.0

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

  return { message: `Tính toán lại hồ sơ ${CONTRIBUTION_LABEL} thành công` };
}

