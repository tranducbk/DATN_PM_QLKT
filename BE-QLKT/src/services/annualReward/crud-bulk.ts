import { prisma } from '../../models';
import { danhHieuHangNamRepository } from '../../repositories/danhHieu.repository';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
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
import { ValidationError } from '../../middlewares/errorHandler';
import { validateDecisionNumbers } from '../eligibility/decisionNumberValidation';
import profileService from '../profile.service';
import {
  collectPendingProposalPersonnelIdsForAward,
  isPersonalChainAward,
} from '../eligibility/annualBulkValidation';
import type { DanhHieuHangNam, Prisma } from '../../generated/prisma';
import type { BulkCreateData } from './types';

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
    quanNhanRepository.findManyByIds(personnelIds),
    danhHieuHangNamRepository.findMany({
      where: { quan_nhan_id: { in: personnelIds }, nam: namInt },
    }),
    proposalRepository.findManyRaw({
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

        const updateData: Prisma.DanhHieuHangNamUncheckedUpdateInput = {};
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

        rewardRecord = await danhHieuHangNamRepository.updateRaw({
          where: { id: existingReward.id },
          data: updateData,
        }, prismaTx);
      } else {
        const createData: Prisma.DanhHieuHangNamUncheckedCreateInput = {
          quan_nhan_id: personnelId,
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

        rewardRecord = await danhHieuHangNamRepository.createRaw({
          data: createData,
        }, prismaTx);
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

