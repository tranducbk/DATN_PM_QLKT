import { prisma } from '../../models';
import * as notificationHelper from '../../helpers/notification';
import { safeRecalculateAnnualProfile } from '../../helpers/profileRecalcHelper';
import {
  formatDanhHieuList,
  getDanhHieuName,
  DANH_HIEU_CA_NHAN_CO_BAN,
  DANH_HIEU_CA_NHAN_BANG_KHEN,
  DANH_HIEU_CA_NHAN_HANG_NAM,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { writeSystemLog } from '../../helpers/systemLogHelper';
import { validateDecisionNumbers } from '../eligibility/decisionNumberValidation';
import profileService from '../profile.service';
import {
  collectPendingProposalPersonnelIdsForAward,
  isPersonalChainAward,
} from '../eligibility/annualBulkValidation';
import type { DanhHieuHangNam, QuanNhan, Prisma } from '../../generated/prisma';
import type {
  CreateAnnualRewardData,
  UpdateAnnualRewardData,
  CheckResult,
  BulkCreateData,
  StatisticsFilters,
} from './types';

export async function getAnnualRewards(personnelId: string): Promise<DanhHieuHangNam[]> {
  if (!personnelId) {
    throw new ValidationError('Thiếu thông tin quân nhân cần tra cứu.');
  }

  const personnel = await prisma.quanNhan.findUnique({
    where: { id: personnelId },
  });

  if (!personnel) {
    throw new NotFoundError('Quân nhân');
  }

  const rewards = await prisma.danhHieuHangNam.findMany({
    where: { quan_nhan_id: personnelId },
    orderBy: {
      nam: 'desc',
    },
  });

  return rewards;
}

export async function createAnnualReward(data: CreateAnnualRewardData): Promise<DanhHieuHangNam> {
  const {
    personnel_id,
    nam,
    danh_hieu,
    cap_bac,
    chuc_vu,
    ghi_chu,
    nhan_bkbqp,
    so_quyet_dinh_bkbqp,
    nhan_cstdtq,
    so_quyet_dinh_cstdtq,
    nhan_bkttcp,
    so_quyet_dinh_bkttcp,
  } = data;

  const personnel = await prisma.quanNhan.findUnique({
    where: { id: personnel_id },
  });

  if (!personnel) {
    throw new NotFoundError('Quân nhân');
  }

  const validDanhHieu = DANH_HIEU_CA_NHAN_CO_BAN;
  if (danh_hieu && !validDanhHieu.has(danh_hieu)) {
    throw new ValidationError(
      `Danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList([...validDanhHieu])}. Để trống nghĩa là không đạt danh hiệu.`
    );
  }

  const existingReward = await prisma.danhHieuHangNam.findFirst({
    where: { quan_nhan_id: personnel_id, nam },
  });

  if (existingReward) {
    const isCoBan = danh_hieu && DANH_HIEU_CA_NHAN_CO_BAN.has(danh_hieu);

    // Block: existing has same base title, or adding base title when one already exists
    if (isCoBan && existingReward.danh_hieu) {
      throw new ValidationError(`Năm ${nam} đã có ${getDanhHieuName(existingReward.danh_hieu)}.`);
    }
    // Block: adding same flag that already exists
    if (nhan_bkbqp && existingReward.nhan_bkbqp) {
      throw new ValidationError(`Năm ${nam} đã có Bằng khen Bộ Quốc phòng.`);
    }
    if (nhan_cstdtq && existingReward.nhan_cstdtq) {
      throw new ValidationError(`Năm ${nam} đã có Chiến sĩ thi đua toàn quân.`);
    }
    if (nhan_bkttcp && existingReward.nhan_bkttcp) {
      throw new ValidationError(`Năm ${nam} đã có Bằng khen Thủ tướng Chính phủ.`);
    }

    const mergeDecisionErrors = validateDecisionNumbers(
      {
        danh_hieu: isCoBan ? danh_hieu : null,
        so_quyet_dinh: isCoBan ? data.so_quyet_dinh : null,
        nhan_bkbqp,
        so_quyet_dinh_bkbqp,
        nhan_cstdtq,
        so_quyet_dinh_cstdtq,
        nhan_bkttcp,
        so_quyet_dinh_bkttcp,
      },
      { entityType: 'personal', entityName: personnel.ho_ten }
    );
    if (mergeDecisionErrors.length > 0) {
      throw new ValidationError(mergeDecisionErrors.join('\n'));
    }

    // Allow: merge into existing record
    const updateData: Record<string, unknown> = {};
    if (isCoBan) {
      updateData.danh_hieu = danh_hieu;
      if (data.so_quyet_dinh) updateData.so_quyet_dinh = data.so_quyet_dinh;
    }
    if (nhan_bkbqp) {
      updateData.nhan_bkbqp = true;
      if (so_quyet_dinh_bkbqp) updateData.so_quyet_dinh_bkbqp = so_quyet_dinh_bkbqp;
      if (ghi_chu) updateData.ghi_chu_bkbqp = ghi_chu;
    } else if (nhan_cstdtq) {
      updateData.nhan_cstdtq = true;
      if (so_quyet_dinh_cstdtq) updateData.so_quyet_dinh_cstdtq = so_quyet_dinh_cstdtq;
      if (ghi_chu) updateData.ghi_chu_cstdtq = ghi_chu;
    } else if (nhan_bkttcp) {
      updateData.nhan_bkttcp = true;
      if (so_quyet_dinh_bkttcp) updateData.so_quyet_dinh_bkttcp = so_quyet_dinh_bkttcp;
      if (ghi_chu) updateData.ghi_chu_bkttcp = ghi_chu;
    } else if (ghi_chu) {
      updateData.ghi_chu = ghi_chu;
    }
    if (cap_bac) updateData.cap_bac = cap_bac;
    if (chuc_vu) updateData.chuc_vu = chuc_vu;

    const updated = await prisma.danhHieuHangNam.update({
      where: { id: existingReward.id },
      data: updateData,
    });
    await safeRecalculateAnnualProfile(personnel_id);
    return updated;
  }

  const createDecisionErrors = validateDecisionNumbers(
    {
      danh_hieu,
      so_quyet_dinh: data.so_quyet_dinh,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp,
      nhan_cstdtq,
      so_quyet_dinh_cstdtq,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp,
    },
    { entityType: 'personal', entityName: personnel.ho_ten }
  );
  if (createDecisionErrors.length > 0) {
    throw new ValidationError(createDecisionErrors.join('\n'));
  }

  const newReward = await prisma.danhHieuHangNam.create({
    data: {
      quan_nhan_id: personnel_id,
      nam,
      danh_hieu,
      so_quyet_dinh: data.so_quyet_dinh || null,
      cap_bac: cap_bac || null,
      chuc_vu: chuc_vu || null,
      ghi_chu: ghi_chu || null,
      nhan_bkbqp: nhan_bkbqp || false,
      so_quyet_dinh_bkbqp: so_quyet_dinh_bkbqp || null,
      nhan_cstdtq: nhan_cstdtq || false,
      so_quyet_dinh_cstdtq: so_quyet_dinh_cstdtq || null,
      nhan_bkttcp: nhan_bkttcp || false,
      so_quyet_dinh_bkttcp: so_quyet_dinh_bkttcp || null,
    },
  });

  await safeRecalculateAnnualProfile(personnel_id);

  return newReward;
}

export async function updateAnnualReward(
  id: string,
  data: UpdateAnnualRewardData
): Promise<DanhHieuHangNam> {
  const {
    nam,
    danh_hieu,
    cap_bac,
    chuc_vu,
    ghi_chu,
    nhan_bkbqp,
    so_quyet_dinh_bkbqp,
    nhan_cstdtq,
    so_quyet_dinh_cstdtq,
    nhan_bkttcp,
    so_quyet_dinh_bkttcp,
  } = data;

  const reward = await prisma.danhHieuHangNam.findUnique({
    where: { id },
  });

  if (!reward) {
    throw new NotFoundError('Danh hiệu hằng năm');
  }

  if (danh_hieu) {
    const validDanhHieu = DANH_HIEU_CA_NHAN_CO_BAN;
    if (!validDanhHieu.has(danh_hieu)) {
      throw new ValidationError(
        `Danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList([...validDanhHieu])}. Để trống nghĩa là không đạt danh hiệu.`
      );
    }
  }

  const updatedReward = await prisma.danhHieuHangNam.update({
    where: { id },
    data: {
      nam: nam || reward.nam,
      danh_hieu: danh_hieu || reward.danh_hieu,
      cap_bac: cap_bac !== undefined ? cap_bac : reward.cap_bac,
      chuc_vu: chuc_vu !== undefined ? chuc_vu : reward.chuc_vu,
      ghi_chu: ghi_chu !== undefined ? ghi_chu : reward.ghi_chu,
      nhan_bkbqp: nhan_bkbqp !== undefined ? nhan_bkbqp : reward.nhan_bkbqp,
      so_quyet_dinh_bkbqp:
        so_quyet_dinh_bkbqp !== undefined ? so_quyet_dinh_bkbqp : reward.so_quyet_dinh_bkbqp,
      nhan_cstdtq: nhan_cstdtq !== undefined ? nhan_cstdtq : reward.nhan_cstdtq,
      so_quyet_dinh_cstdtq:
        so_quyet_dinh_cstdtq !== undefined ? so_quyet_dinh_cstdtq : reward.so_quyet_dinh_cstdtq,
      nhan_bkttcp: nhan_bkttcp !== undefined ? nhan_bkttcp : reward.nhan_bkttcp,
      so_quyet_dinh_bkttcp:
        so_quyet_dinh_bkttcp !== undefined ? so_quyet_dinh_bkttcp : reward.so_quyet_dinh_bkttcp,
    },
  });

  await safeRecalculateAnnualProfile(reward.quan_nhan_id);

  return updatedReward;
}

export async function deleteAnnualReward(
  id: string,
  adminUsername: string = 'Admin',
  awardType?: string | null
): Promise<{
  message: string;
  personnelId: string;
  personnel: QuanNhan | null;
  reward: DanhHieuHangNam;
}> {
  const reward = await prisma.danhHieuHangNam.findUnique({
    where: { id },
    include: {
      QuanNhan: {
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: true,
        },
      },
    },
  });

  if (!reward) {
    throw new NotFoundError('Danh hiệu hằng năm');
  }

  const personnelId = reward.quan_nhan_id;
  const personnel = reward.QuanNhan;

  // Awards page renders one row per year with multiple awards. Granular
  // delete clears only the requested award + its decision number + note;
  // the row is removed entirely when no awards remain.
  if (awardType) {
    const validTypes = new Set<string>([
      ...DANH_HIEU_CA_NHAN_CO_BAN,
      ...DANH_HIEU_CA_NHAN_BANG_KHEN,
    ]);
    if (!validTypes.has(awardType)) {
      throw new ValidationError(
        `Loại danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList([...validTypes])}.`
      );
    }

    const updateData: Prisma.DanhHieuHangNamUpdateInput = {};
    const isBaseAward = DANH_HIEU_CA_NHAN_CO_BAN.has(awardType);

    if (isBaseAward) {
      if (reward.danh_hieu !== awardType) {
        throw new ValidationError(
          `Bản ghi không có ${getDanhHieuName(awardType)}`
        );
      }
      updateData.danh_hieu = null;
      updateData.so_quyet_dinh = null;
      updateData.ghi_chu = null;
    } else if (awardType === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP) {
      if (!reward.nhan_bkbqp) {
        throw new ValidationError(
          `Bản ghi không có ${getDanhHieuName(awardType)}`
        );
      }
      updateData.nhan_bkbqp = false;
      updateData.so_quyet_dinh_bkbqp = null;
      updateData.ghi_chu_bkbqp = null;
    } else if (awardType === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ) {
      if (!reward.nhan_cstdtq) {
        throw new ValidationError(
          `Bản ghi không có ${getDanhHieuName(awardType)}`
        );
      }
      updateData.nhan_cstdtq = false;
      updateData.so_quyet_dinh_cstdtq = null;
      updateData.ghi_chu_cstdtq = null;
    } else if (awardType === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP) {
      if (!reward.nhan_bkttcp) {
        throw new ValidationError(
          `Bản ghi không có ${getDanhHieuName(awardType)}`
        );
      }
      updateData.nhan_bkttcp = false;
      updateData.so_quyet_dinh_bkttcp = null;
      updateData.ghi_chu_bkttcp = null;
    }

    const remainingDanhHieu = isBaseAward ? null : reward.danh_hieu;
    const remainingBkbqp =
      awardType === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP ? false : reward.nhan_bkbqp;
    const remainingCstdtq =
      awardType === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ ? false : reward.nhan_cstdtq;
    const remainingBkttcp =
      awardType === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP ? false : reward.nhan_bkttcp;
    const isEmpty =
      !remainingDanhHieu && !remainingBkbqp && !remainingCstdtq && !remainingBkttcp;

    if (isEmpty) {
      await prisma.danhHieuHangNam.delete({ where: { id } });
    } else {
      await prisma.danhHieuHangNam.update({ where: { id }, data: updateData });
    }

    await safeRecalculateAnnualProfile(personnelId);

    try {
      await notificationHelper.notifyOnAwardDeleted(
        reward,
        personnel,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        adminUsername
      );
    } catch (e) {
      void writeSystemLog({
        action: 'ERROR',
        resource: 'annual-rewards',
        description: `Lỗi gửi thông báo xóa khen thưởng hằng năm: ${e}`,
      });
    }

    return {
      message: `Đã xóa ${getDanhHieuName(awardType)}.`,
      personnelId,
      personnel,
      reward,
    };
  }

  await prisma.danhHieuHangNam.delete({
    where: { id },
  });

  await safeRecalculateAnnualProfile(personnelId);

  try {
    await notificationHelper.notifyOnAwardDeleted(
      reward,
      personnel,
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      adminUsername
    );
  } catch (e) {
    writeSystemLog({
      action: 'ERROR',
      resource: 'annual-rewards',
      description: `Lỗi gửi thông báo xóa khen thưởng hằng năm: ${e}`,
    });
  }

  return {
    message: 'Đã xóa danh hiệu hằng năm.',
    personnelId,
    personnel,
    reward,
  };
}

export async function checkAnnualRewards(
  personnelIds: string[],
  nam: number,
  danhHieu: string
): Promise<{ results: CheckResult[]; summary: Record<string, number> }> {
  const [existingRewards, proposals] = await Promise.all([
    prisma.danhHieuHangNam.findMany({ where: { quan_nhan_id: { in: personnelIds }, nam } }),
    prisma.bangDeXuat.findMany({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        nam,
        status: { in: [PROPOSAL_STATUS.PENDING, PROPOSAL_STATUS.APPROVED] },
      },
      select: { id: true, nam: true, status: true, data_danh_hieu: true },
    }),
  ]);
  const rewardByPersonnel = new Map(existingRewards.map(r => [r.quan_nhan_id, r] as const));
  const proposalsByPersonnel = new Map<string, typeof proposals>();
  for (const p of proposals) {
    const data = (p.data_danh_hieu as Array<Record<string, unknown>>) ?? [];
    for (const item of data) {
      const pid = item.personnel_id as string;
      if (!pid) continue;
      const list = proposalsByPersonnel.get(pid) ?? [];
      list.push(p);
      proposalsByPersonnel.set(pid, list);
    }
  }

  const results: CheckResult[] = [];

  for (const personnelId of personnelIds) {
    if (!personnelId) continue;

    const result: CheckResult = {
      personnel_id: personnelId,
      has_reward: false,
      has_proposal: false,
      reward: null,
      proposal: null,
    };

    const existingReward = rewardByPersonnel.get(personnelId) ?? null;
    if (existingReward) {
      result.has_reward = true;
      result.reward = {
        id: existingReward.id,
        nam: existingReward.nam,
        danh_hieu: existingReward.danh_hieu,
        nhan_bkbqp: existingReward.nhan_bkbqp,
        nhan_cstdtq: existingReward.nhan_cstdtq,
        nhan_bkttcp: existingReward.nhan_bkttcp,
      };
    }

    const personnelProposals = proposalsByPersonnel.get(personnelId) ?? [];
    for (const proposal of personnelProposals) {
      if (proposal.data_danh_hieu) {
        const dataList = Array.isArray(proposal.data_danh_hieu)
          ? (proposal.data_danh_hieu as Record<string, unknown>[])
          : [];

        const found = dataList.some(
          item => String(item.personnel_id) === personnelId && item.danh_hieu === danhHieu
        );

        if (found) {
          // APPROVED proposal: only block if award actually exists in DB
          if (proposal.status === PROPOSAL_STATUS.APPROVED && !result.has_reward) {
            continue;
          }
          result.has_proposal = true;
          result.proposal = {
            id: proposal.id,
            nam: proposal.nam,
            status: proposal.status,
          };
          break;
        }
      }
    }

    results.push(result);
  }

  return {
    results,
    summary: {
      total: personnelIds.length,
      has_reward: results.filter(r => r.has_reward).length,
      has_proposal: results.filter(r => r.has_proposal).length,
      can_add: results.filter(r => !r.has_reward && !r.has_proposal).length,
    },
  };
}

export async function bulkCreateAnnualRewards(data: BulkCreateData): Promise<{
  success: number;
  errors: number;
  details: {
    created: DanhHieuHangNam[];
    errors: { personnelId: string; error: string }[];
  };
}> {
  const {
    personnel_ids,
    personnel_rewards_data,
    nam,
    danh_hieu,
    ghi_chu,
    so_quyet_dinh,
    cap_bac,
    chuc_vu,
  } = data;

  const allowedDanhHieu = Object.values(DANH_HIEU_CA_NHAN_HANG_NAM) as string[];
  if (!allowedDanhHieu.includes(danh_hieu)) {
    throw new ValidationError(
      `Danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList(allowedDanhHieu)}.`
    );
  }

  const errors: { personnelId: string; error: string }[] = [];

  const personnelDataMap: Record<
    string,
    { so_quyet_dinh?: string; cap_bac?: string; chuc_vu?: string }
  > = {};
  if (personnel_rewards_data && Array.isArray(personnel_rewards_data)) {
    personnel_rewards_data.forEach(item => {
      if (item.personnel_id) {
        personnelDataMap[item.personnel_id] = item;
      }
    });
  }

  const personnelIds = personnel_ids.map(id => String(id)).filter(Boolean);
  const namInt = nam;

  const [allPersonnel, existingRewards, pendingProposals] = await Promise.all([
    prisma.quanNhan.findMany({ where: { id: { in: personnelIds } } }),
    prisma.danhHieuHangNam.findMany({
      where: { quan_nhan_id: { in: personnelIds }, nam: namInt },
    }),
    prisma.bangDeXuat.findMany({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        nam: namInt,
        status: PROPOSAL_STATUS.PENDING,
      },
    }),
  ]);

  const personnelMap = new Map(allPersonnel.map(p => [p.id, p] as const));
  const existingRewardMap = new Map(existingRewards.map(r => [r.quan_nhan_id, r] as const));
  const existingAwardSet = new Set(
    existingRewards
      .filter(r => {
        if (r.danh_hieu === danh_hieu) return true;
        if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP && r.nhan_bkbqp) return true;
        if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ && r.nhan_cstdtq) return true;
        if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP && r.nhan_bkttcp) return true;
        return false;
      })
      .map(r => r.quan_nhan_id)
  );
  const pendingProposalPersonnelSet = collectPendingProposalPersonnelIdsForAward(
    pendingProposals as Array<{ data_danh_hieu: unknown }>,
    danh_hieu
  );

  const eligibilityMap = new Map<string, { eligible: boolean; reason: string }>();
  if (isPersonalChainAward(danh_hieu)) {
    const eligibilityResults = await Promise.all(
      personnelIds.map(async personnelId => ({
        personnelId,
        result: await profileService.checkAwardEligibility(personnelId, namInt, danh_hieu),
      }))
    );
    for (const { personnelId, result } of eligibilityResults) {
      eligibilityMap.set(personnelId, result);
    }
  }

  const created = await prisma.$transaction(async prismaTx => {
    const txCreated: DanhHieuHangNam[] = [];

    for (const personnelId of personnelIds) {
      const personnelData = personnelDataMap[personnelId] || {};
      const individualSoQuyetDinh = personnelData.so_quyet_dinh || so_quyet_dinh;
      const individualCapBac = personnelData.cap_bac || cap_bac;
      const individualChucVu = personnelData.chuc_vu || chuc_vu;

      const personnel = personnelMap.get(personnelId);

      if (!personnel) {
        errors.push({ personnelId, error: 'Quân nhân không tồn tại' });
        continue;
      }

      if (existingAwardSet.has(personnelId)) {
        errors.push({
          personnelId,
          error: `Quân nhân đã có danh hiệu ${getDanhHieuName(danh_hieu)} năm ${namInt} trên hệ thống`,
        });
        continue;
      }
      if (pendingProposalPersonnelSet.has(personnelId)) {
        errors.push({
          personnelId,
          error: `Quân nhân đã có đề xuất danh hiệu ${getDanhHieuName(danh_hieu)} cho năm ${namInt}`,
        });
        continue;
      }

      if (isPersonalChainAward(danh_hieu)) {
        const eligibility = eligibilityMap.get(personnelId) || {
          eligible: false,
          reason: 'Không xác định được điều kiện khen thưởng',
        };
        if (!eligibility.eligible) {
          errors.push({
            personnelId,
            error: eligibility.reason,
          });
          continue;
        }
      }

      const isCoBanRow = DANH_HIEU_CA_NHAN_CO_BAN.has(danh_hieu);
      const isBkbqpRow = danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP;
      const isCstdtqRow = danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ;
      const isBkttcpRow = danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;
      const decisionErrors = validateDecisionNumbers(
        {
          danh_hieu: isCoBanRow ? danh_hieu : null,
          so_quyet_dinh: isCoBanRow ? individualSoQuyetDinh : null,
          nhan_bkbqp: isBkbqpRow,
          so_quyet_dinh_bkbqp: isBkbqpRow ? individualSoQuyetDinh : null,
          nhan_cstdtq: isCstdtqRow,
          so_quyet_dinh_cstdtq: isCstdtqRow ? individualSoQuyetDinh : null,
          nhan_bkttcp: isBkttcpRow,
          so_quyet_dinh_bkttcp: isBkttcpRow ? individualSoQuyetDinh : null,
        },
        { entityType: 'personal', entityName: personnel.ho_ten }
      );
      if (decisionErrors.length > 0) {
        errors.push({ personnelId, error: decisionErrors.join('\n') });
        continue;
      }

      const existingReward = existingRewardMap.get(personnelId) ?? null;

      let finalDanhHieu: string | null = null;
      let nhanBKBQP = false;
      let nhanCSTDTQ = false;
      let nhanBKTTCP = false;

      if (DANH_HIEU_CA_NHAN_CO_BAN.has(danh_hieu)) {
        finalDanhHieu = danh_hieu;
      } else if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP) {
        nhanBKBQP = true;
      } else if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ) {
        nhanCSTDTQ = true;
      } else if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP) {
        nhanBKTTCP = true;
      }

      let rewardRecord: DanhHieuHangNam;

      if (existingReward) {
        const isBangKhen = DANH_HIEU_CA_NHAN_BANG_KHEN.has(danh_hieu);
        const isCoBan = DANH_HIEU_CA_NHAN_CO_BAN.has(danh_hieu);
        const canUpdate = isBangKhen || (isCoBan && !existingReward.danh_hieu);

        if (!canUpdate) {
          errors.push({ personnelId, error: `Đã có danh hiệu ${getDanhHieuName(existingReward.danh_hieu || danh_hieu)} cho năm ${nam}` });
          continue;
        }

        const updateData: Prisma.DanhHieuHangNamUpdateInput = {};
        if (isBangKhen) {
          if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP) {
            updateData.nhan_bkbqp = true;
            if (individualSoQuyetDinh) updateData.so_quyet_dinh_bkbqp = individualSoQuyetDinh;
          } else if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ) {
            updateData.nhan_cstdtq = true;
            if (individualSoQuyetDinh) updateData.so_quyet_dinh_cstdtq = individualSoQuyetDinh;
          } else if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP) {
            updateData.nhan_bkttcp = true;
            if (individualSoQuyetDinh) updateData.so_quyet_dinh_bkttcp = individualSoQuyetDinh;
          }
        } else {
          updateData.danh_hieu = danh_hieu;
          if (individualSoQuyetDinh) updateData.so_quyet_dinh = individualSoQuyetDinh;
        }

        if (individualCapBac) updateData.cap_bac = individualCapBac;
        if (individualChucVu) updateData.chuc_vu = individualChucVu;
        if (ghi_chu) {
          if (nhanBKBQP) updateData.ghi_chu_bkbqp = ghi_chu;
          else if (nhanCSTDTQ) updateData.ghi_chu_cstdtq = ghi_chu;
          else if (nhanBKTTCP) updateData.ghi_chu_bkttcp = ghi_chu;
          else updateData.ghi_chu = ghi_chu;
        }

        rewardRecord = await prismaTx.danhHieuHangNam.update({
          where: { id: existingReward.id },
          data: updateData,
        });
      } else {
        const createData: Prisma.DanhHieuHangNamCreateInput = {
          QuanNhan: { connect: { id: personnelId } },
          nam: namInt,
          danh_hieu: finalDanhHieu,
          cap_bac: individualCapBac || null,
          chuc_vu: individualChucVu || null,
          ghi_chu: nhanBKBQP || nhanCSTDTQ || nhanBKTTCP ? null : (ghi_chu || null),
          nhan_bkbqp: nhanBKBQP,
          nhan_cstdtq: nhanCSTDTQ,
          nhan_bkttcp: nhanBKTTCP,
          ...(nhanBKBQP && ghi_chu && { ghi_chu_bkbqp: ghi_chu }),
          ...(nhanCSTDTQ && ghi_chu && { ghi_chu_cstdtq: ghi_chu }),
          ...(nhanBKTTCP && ghi_chu && { ghi_chu_bkttcp: ghi_chu }),
        };

        if (nhanBKBQP) {
          createData.so_quyet_dinh_bkbqp = individualSoQuyetDinh || null;
        } else if (nhanCSTDTQ) {
          createData.so_quyet_dinh_cstdtq = individualSoQuyetDinh || null;
        } else if (nhanBKTTCP) {
          createData.so_quyet_dinh_bkttcp = individualSoQuyetDinh || null;
        } else {
          createData.so_quyet_dinh = individualSoQuyetDinh || null;
        }

        rewardRecord = await prismaTx.danhHieuHangNam.create({
          data: createData,
        });
      }

      txCreated.push(rewardRecord);
    }

    return txCreated;
  });

  for (const rewardRecord of created) {
    await safeRecalculateAnnualProfile(rewardRecord.quan_nhan_id);
  }


  return {
    success: created.length,
    errors: errors.length,
    details: {
      created,
      errors,
    },
  };
}

export async function getStatistics(filters: StatisticsFilters = {}): Promise<{
  total: number;
  byDanhHieu: { danh_hieu: string | null; count: number }[];
  byNam: { nam: number; count: number }[];
}> {
  const { nam, don_vi_id } = filters;

  const where: Prisma.DanhHieuHangNamWhereInput = {};
  if (nam) where.nam = nam;

  const awards = await prisma.danhHieuHangNam.findMany({
    where,
    include: {
      QuanNhan: {
        select: {
          co_quan_don_vi_id: true,
          don_vi_truc_thuoc_id: true,
        },
      },
    },
  });

  let filteredAwards = awards;
  if (don_vi_id) {
    filteredAwards = awards.filter(
      award =>
        award.QuanNhan?.co_quan_don_vi_id === don_vi_id ||
        award.QuanNhan?.don_vi_truc_thuoc_id === don_vi_id
    );
  }

  const byDanhHieu = filteredAwards.reduce(
    (acc, award) => {
      const key = award.danh_hieu;
      if (!acc[key ?? 'null']) {
        acc[key ?? 'null'] = { danh_hieu: key, count: 0 };
      }
      acc[key ?? 'null'].count++;
      return acc;
    },
    {} as Record<string, { danh_hieu: string | null; count: number }>
  );

  const byNam = filteredAwards.reduce(
    (acc, award) => {
      const key = award.nam;
      if (!acc[key]) {
        acc[key] = { nam: key, count: 0 };
      }
      acc[key].count++;
      return acc;
    },
    {} as Record<number, { nam: number; count: number }>
  );

  return {
    total: filteredAwards.length,
    byDanhHieu: Object.values(byDanhHieu),
    byNam: Object.values(byNam).sort((a, b) => b.nam - a.nam),
  };
}

/**
 * Checks if a personnel has already received or has a pending HC_QKQT award.
 * @param personnelId - Personnel ID
 * @returns Check result with alreadyReceived flag and reason
 */
export async function checkAlreadyReceivedHCQKQT(personnelId: string) {
  const existingAward = await prisma.huanChuongQuanKyQuyetThang.findUnique({
    where: { quan_nhan_id: personnelId },
  });
  if (existingAward) return { alreadyReceived: true, reason: 'Đã nhận', award: existingAward };

  const pendingProposal = await prisma.bangDeXuat.findFirst({
    where: {
      loai_de_xuat: PROPOSAL_TYPES.HC_QKQT,
      status: PROPOSAL_STATUS.PENDING,
      data_nien_han: { array_contains: [{ personnel_id: personnelId }] },
    },
  });
  if (pendingProposal)
    return { alreadyReceived: true, reason: 'Đang chờ duyệt', proposal: pendingProposal };

  return { alreadyReceived: false, reason: null };
}

/**
 * Checks if a personnel has already received or has a pending KNC_VSNXD_QDNDVN award.
 * @param personnelId - Personnel ID
 * @returns Check result with alreadyReceived flag and reason
 */
export async function checkAlreadyReceivedKNCVSNXDQDNDVN(personnelId: string) {
  const existingAward = await prisma.kyNiemChuongVSNXDQDNDVN.findUnique({
    where: { quan_nhan_id: personnelId },
  });
  if (existingAward) return { alreadyReceived: true, reason: 'Đã nhận', award: existingAward };

  const pendingProposal = await prisma.bangDeXuat.findFirst({
    where: {
      loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      status: PROPOSAL_STATUS.PENDING,
      data_nien_han: { array_contains: [{ personnel_id: personnelId }] },
    },
  });
  if (pendingProposal)
    return { alreadyReceived: true, reason: 'Đang chờ duyệt', proposal: pendingProposal };

  return { alreadyReceived: false, reason: null };
}

/**
 * Returns paginated list of annual awards with optional filters.
 * @param params - Filter and pagination params
 * @returns Awards list and total count
 */
export async function getAnnualRewardsList(params: {
  page: number;
  limit: number;
  nam?: number;
  danh_hieu?: string;
  quanNhanWhere?: Record<string, unknown> | null;
}) {
  const { page, limit, nam, danh_hieu, quanNhanWhere } = params;
  const where: Record<string, unknown> = {};
  if (nam) where.nam = nam;
  if (danh_hieu) where.danh_hieu = danh_hieu;
  if (quanNhanWhere) where.QuanNhan = quanNhanWhere;

  const [awards, total] = await Promise.all([
    prisma.danhHieuHangNam.findMany({
      where,
      include: {
        QuanNhan: { include: { CoQuanDonVi: true, DonViTrucThuoc: true, ChucVu: true } },
      },
      orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.danhHieuHangNam.count({ where }),
  ]);

  return { awards, total };
}
