import { prisma } from '../../models';
import { getDanhHieuName } from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import type { Prisma } from '../../generated/prisma';

export interface DuplicateCheckResult {
  exists: boolean;
  message?: string;
  status?: string;
}

export async function checkDuplicateAward(
  personnelId: string,
  nam: number,
  danhHieu: string,
  proposalType: string,
  status: string | null = null,
  excludeProposalId: string | null = null
): Promise<DuplicateCheckResult> {
  try {
    if (proposalType === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
      const proposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
          nam: parseInt(String(nam)),
          status: status ? status : { not: PROPOSAL_STATUS.REJECTED },
          ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
        },
      });

      const existing = proposals.find(p => {
        const dataDanhHieu = (p.data_danh_hieu as Prisma.JsonArray) || [];
        return (dataDanhHieu as Array<Record<string, unknown>>).some(
          item => item.personnel_id === personnelId && item.danh_hieu === danhHieu
        );
      });

      if (existing) {
        return {
          exists: true,
          message: `Quân nhân đã có đề xuất danh hiệu ${getDanhHieuName(danhHieu)} cho năm ${nam}`,
          status: existing.status,
        };
      }
    }

    if (proposalType === PROPOSAL_TYPES.NIEN_HAN && danhHieu?.startsWith('HCCSVV_')) {
      const actualAward = await prisma.khenThuongHCCSVV.findFirst({
        where: {
          quan_nhan_id: personnelId,
          danh_hieu: danhHieu,
        },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có ${getDanhHieuName(danhHieu)} (năm ${actualAward.nam || nam})`,
        };
      }

      const pendingProposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.NIEN_HAN,
          nam: parseInt(String(nam)),
          status: PROPOSAL_STATUS.PENDING,
          ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
        },
      });
      const pendingExisting = pendingProposals.find(p => {
        const dataNienHan = (p.data_nien_han as Prisma.JsonArray) || [];
        return (dataNienHan as Array<Record<string, unknown>>).some(
          item => item.personnel_id === personnelId && item.danh_hieu === danhHieu
        );
      });
      if (pendingExisting) {
        return {
          exists: true,
          message: `Quân nhân đang có đề xuất ${getDanhHieuName(danhHieu)} chờ duyệt (năm ${pendingExisting.nam})`,
        };
      }
    }

    if (proposalType === PROPOSAL_TYPES.HC_QKQT) {
      const actualAward = await prisma.huanChuongQuanKyQuyetThang.findFirst({
        where: { quan_nhan_id: personnelId },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có Huy chương Quân kỳ quyết thắng (năm ${actualAward.nam || nam})`,
        };
      }

      const pendingProposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.HC_QKQT,
          nam: parseInt(String(nam)),
          status: PROPOSAL_STATUS.PENDING,
          ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
        },
      });
      const pendingExisting = pendingProposals.find(p => {
        const dataNienHan = (p.data_nien_han as Prisma.JsonArray) || [];
        return (dataNienHan as Array<Record<string, unknown>>).some(
          (item: Record<string, unknown>) => item.personnel_id === personnelId
        );
      });
      if (pendingExisting) {
        return {
          exists: true,
          message: `Quân nhân đang có đề xuất Huy chương Quân kỳ quyết thắng chờ duyệt (năm ${pendingExisting.nam})`,
        };
      }
    }

    if (proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
      const actualAward = await prisma.kyNiemChuongVSNXDQDNDVN.findFirst({
        where: { quan_nhan_id: personnelId },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN (năm ${actualAward.nam || nam})`,
        };
      }

      const pendingProposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
          nam: parseInt(String(nam)),
          status: PROPOSAL_STATUS.PENDING,
          ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
        },
      });
      const pendingExisting = pendingProposals.find(p => {
        const dataNienHan = (p.data_nien_han as Prisma.JsonArray) || [];
        return (dataNienHan as Array<Record<string, unknown>>).some(
          (item: Record<string, unknown>) => item.personnel_id === personnelId
        );
      });
      if (pendingExisting) {
        return {
          exists: true,
          message: `Quân nhân đang có đề xuất Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN chờ duyệt (năm ${pendingExisting.nam})`,
        };
      }
    }

    if (proposalType === PROPOSAL_TYPES.CONG_HIEN) {
      const actualAward = await prisma.khenThuongCongHien.findFirst({
        where: { quan_nhan_id: personnelId },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có ${getDanhHieuName(actualAward.danh_hieu || danhHieu)} (năm ${actualAward.nam || nam})`,
        };
      }

      const pendingProposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.CONG_HIEN,
          nam: parseInt(String(nam)),
          status: PROPOSAL_STATUS.PENDING,
          ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
        },
      });
      const pendingExisting = pendingProposals.find(p => {
        const dataCongHien = (p.data_cong_hien as Prisma.JsonArray) || [];
        return (dataCongHien as Array<Record<string, unknown>>).some(
          (item: Record<string, unknown>) => item.personnel_id === personnelId
        );
      });
      if (pendingExisting) {
        const dataCongHien =
          (pendingExisting.data_cong_hien as Array<Record<string, unknown>>) || [];
        const congHienItem = dataCongHien.find(
          (item: Record<string, unknown>) => item.personnel_id === personnelId
        );
        const pendingDanhHieu = (congHienItem?.danh_hieu as string) || danhHieu;
        return {
          exists: true,
          message: `Quân nhân đang có đề xuất ${getDanhHieuName(pendingDanhHieu)} chờ duyệt (năm ${pendingExisting.nam})`,
        };
      }
    }

    return { exists: false };
  } catch (error) {
    throw error;
  }
}

export async function checkDuplicateUnitAward(
  donViId: string,
  nam: number,
  danhHieu: string,
  proposalType: string
): Promise<DuplicateCheckResult> {
  try {
    if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      const proposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.DON_VI_HANG_NAM,
          nam: parseInt(String(nam)),
          status: { not: PROPOSAL_STATUS.REJECTED },
        },
      });

      const existing = proposals.find(p => {
        const dataDanhHieu = (p.data_danh_hieu as Prisma.JsonArray) || [];
        return (dataDanhHieu as Array<Record<string, unknown>>).some(
          item => item.don_vi_id === donViId && item.danh_hieu === danhHieu
        );
      });

      if (existing) {
        return {
          exists: true,
          message: `Đơn vị đã có đề xuất danh hiệu ${getDanhHieuName(danhHieu)} cho năm ${nam}`,
          status: existing.status,
        };
      }
    }

    return { exists: false };
  } catch (error) {
    throw error;
  }
}
