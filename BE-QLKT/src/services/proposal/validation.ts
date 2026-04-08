import { prisma } from '../../models';
import { getDanhHieuName, DANH_HIEU_CA_NHAN_HANG_NAM, UNIT_DV_TITLES, UNIT_BK_TITLES } from '../../constants/danhHieu.constants';
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
    if (proposalType === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
      const actualAward = await prisma.danhHieuHangNam.findFirst({
        where: { quan_nhan_id: personnelId, nam, danh_hieu: danhHieu },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có danh hiệu ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`,
        };
      }

      const proposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
          nam,
          status: status ? status : PROPOSAL_STATUS.PENDING,
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
          nam,
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
          nam,
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
          nam,
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
          nam,
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
}

export async function checkDuplicateUnitAward(
  donViId: string,
  nam: number,
  danhHieu: string,
  proposalType: string
): Promise<DuplicateCheckResult> {
    if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      const proposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.DON_VI_HANG_NAM,
          nam,
          status: PROPOSAL_STATUS.PENDING,
        },
      });

      // Proposal JSON data_danh_hieu stores don_vi_id which maps to either co_quan_don_vi_id
      // or don_vi_truc_thuoc_id depending on the unit type. The don_vi_id field is set consistently
      // during proposal creation, so matching on it here is sufficient.
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

      const existingAward = await prisma.danhHieuDonViHangNam.findFirst({
        where: {
          OR: [
            { co_quan_don_vi_id: donViId, nam },
            { don_vi_truc_thuoc_id: donViId, nam },
          ],
        },
        select: { danh_hieu: true, nhan_bkbqp: true, nhan_bkttcp: true },
      });

      if (existingAward) {
        const isDv = UNIT_DV_TITLES.has(danhHieu);
        const isBk = UNIT_BK_TITLES.has(danhHieu);

        // Check ĐVQT/ĐVTT
        if (isDv && existingAward.danh_hieu) {
          if (existingAward.danh_hieu === danhHieu) {
            return {
              exists: true,
              message: `Đơn vị đã có danh hiệu ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`,
            };
          }
          return {
            exists: true,
            message: `Đơn vị đã có danh hiệu ${getDanhHieuName(existingAward.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`,
          };
        }

        // Check BKBQP/BKTTCP
        if (isBk) {
          if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP && existingAward.nhan_bkbqp) {
            return {
              exists: true,
              message: `Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`,
            };
          }
          if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP && existingAward.nhan_bkttcp) {
            return {
              exists: true,
              message: `Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`,
            };
          }
        }

        // ĐVQT/ĐVTT and BKBQP/BKTTCP cannot be mixed in the same proposal
        if (isDv && (existingAward.nhan_bkbqp || existingAward.nhan_bkttcp)) {
          const existingBk = existingAward.nhan_bkbqp ? 'BKBQP' : 'BKTTCP';
          return {
            exists: true,
            message: `Đơn vị đã có ${getDanhHieuName(existingBk)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`,
          };
        }
        if (isBk && existingAward.danh_hieu && UNIT_DV_TITLES.has(existingAward.danh_hieu)) {
          return {
            exists: true,
            message: `Đơn vị đã có danh hiệu ${getDanhHieuName(existingAward.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`,
          };
        }
      }
    }

    return { exists: false };
}
