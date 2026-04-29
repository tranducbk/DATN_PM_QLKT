import { prisma } from '../../models';
import { danhHieuHangNamRepository, danhHieuDonViHangNamRepository } from '../../repositories/danhHieu.repository';
import { tenureMedalRepository } from '../../repositories/tenureMedal.repository';
import { militaryFlagRepository } from '../../repositories/militaryFlag.repository';
import { commemorativeMedalRepository } from '../../repositories/commemorativeMedal.repository';
import { contributionMedalRepository } from '../../repositories/contributionMedal.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import { getDanhHieuName, DANH_HIEU_CA_NHAN_HANG_NAM, DANH_HIEU_CA_NHAN_BANG_KHEN, DANH_HIEU_DON_VI_CO_BAN, DANH_HIEU_DON_VI_BANG_KHEN } from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import type { Prisma } from '../../generated/prisma';

export interface DuplicateCheckResult {
  exists: boolean;
  message?: string;
  status?: string;
}

export interface PayloadCaNhanDanhHieuItem {
  personnel_id?: string;
  danh_hieu?: string;
}

export interface PayloadDonViDanhHieuItem {
  don_vi_id?: string;
  don_vi_type?: string;
  ten_don_vi?: string;
  danh_hieu?: string;
}

export const INVALID_DANH_HIEU_ERROR = 'Phát hiện danh hiệu không hợp lệ trong dữ liệu đề xuất.';
export const DUPLICATE_IN_PAYLOAD_ERROR = 'Phát hiện dữ liệu bị lặp ngay trong payload đề xuất.';
export const MIXED_CA_NHAN_HANG_NAM_ERROR =
  'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ/BKTTCP trong một đề xuất. ' +
  'Vui lòng tách thành các đề xuất riêng: một đề xuất cho CSTDCS/CSTT, và một đề xuất riêng cho BKBQP/CSTDTQ/BKTTCP.';
export const MIXED_DON_VI_HANG_NAM_ERROR =
  'Không thể đề xuất ĐVQT/ĐVTT cùng với BKBQP/BKTTCP trong một đề xuất. ' +
  'Vui lòng tách thành các đề xuất riêng: một đề xuất cho ĐVQT/ĐVTT, và một đề xuất riêng cho BKBQP/BKTTCP.';

/**
 * Returns invalid award codes compared to an allowed set.
 */
export function findInvalidDanhHieu(
  selectedDanhHieu: string[],
  validDanhHieu: Set<string>
): string[] {
  return selectedDanhHieu.filter(danhHieu => !validDanhHieu.has(danhHieu));
}

/**
 * Detects duplicate personnel-award pairs within one payload.
 */
export function collectDuplicateCaNhanPayload(
  items: PayloadCaNhanDanhHieuItem[],
  resolveName: (personnelId: string) => string
): string[] {
  const payloadKeys = new Set<string>();
  const duplicatePayloadItems: string[] = [];
  for (const item of items) {
    if (!item.personnel_id || !item.danh_hieu) continue;
    const payloadKey = `${item.personnel_id}::${item.danh_hieu}`;
    if (payloadKeys.has(payloadKey)) {
      const hoTen = resolveName(item.personnel_id);
      duplicatePayloadItems.push(`${hoTen}: ${item.danh_hieu}`);
    }
    payloadKeys.add(payloadKey);
  }
  return duplicatePayloadItems;
}

/**
 * Detects duplicate unit-award pairs within one payload.
 */
export function collectDuplicateDonViPayload(
  items: PayloadDonViDanhHieuItem[]
): string[] {
  const payloadKeys = new Set<string>();
  const duplicatePayloadItems: string[] = [];
  for (const item of items) {
    if (!item.don_vi_id || !item.danh_hieu) continue;
    const payloadKey = `${item.don_vi_type || 'UNKNOWN'}::${item.don_vi_id}::${item.danh_hieu}`;
    if (payloadKeys.has(payloadKey)) {
      const tenDonVi = item.ten_don_vi || item.don_vi_id;
      duplicatePayloadItems.push(`${tenDonVi}: ${item.danh_hieu}`);
    }
    payloadKeys.add(payloadKey);
  }
  return duplicatePayloadItems;
}

/**
 * Checks duplicate awards in stored records and pending proposals.
 * @param personnelId - Personnel ID
 * @param nam - Fiscal or calendar year depending on proposal type
 * @param danhHieu - Award code being checked
 * @param proposalType - Proposal type
 * @param status - When set, narrows pending lookups; defaults to pending-only paths inside
 * @param excludeProposalId - Exclude current record during edit flows
 * @returns exists=true with conflict message when a duplicate is found
 */
export async function checkDuplicateAward(
  personnelId: string,
  nam: number,
  danhHieu: string,
  proposalType: string,
  status: string | null = null,
  excludeProposalId: string | null = null
): Promise<DuplicateCheckResult> {
    if (proposalType === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
      const isBangKhen = DANH_HIEU_CA_NHAN_BANG_KHEN.has(danhHieu);
      const whereClause = isBangKhen
        ? {
            quan_nhan_id: personnelId,
            nam,
            ...(danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP && { nhan_bkbqp: true }),
            ...(danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ && { nhan_cstdtq: true }),
            ...(danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP && { nhan_bkttcp: true }),
          }
        : { quan_nhan_id: personnelId, nam, danh_hieu: danhHieu };
      const actualAward = await danhHieuHangNamRepository.findFirst({ where: whereClause });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có danh hiệu ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`,
        };
      }

      const proposals = await proposalRepository.findManyRaw({
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
      const actualAward = await tenureMedalRepository.findFirstRaw({
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

      const pendingProposals = await proposalRepository.findManyRaw({
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
      const actualAward = await militaryFlagRepository.findFirstRaw({
        where: { quan_nhan_id: personnelId },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có Huy chương Quân kỳ quyết thắng (năm ${actualAward.nam || nam})`,
        };
      }

      const pendingProposals = await proposalRepository.findManyRaw({
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
      const actualAward = await commemorativeMedalRepository.findFirstRaw({
        where: { quan_nhan_id: personnelId },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN (năm ${actualAward.nam || nam})`,
        };
      }

      const pendingProposals = await proposalRepository.findManyRaw({
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
          message: `Quân nhân đang có đề xuất Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN chờ duyệt (năm ${pendingExisting.nam})`,
        };
      }
    }

    if (proposalType === PROPOSAL_TYPES.CONG_HIEN) {
      const actualAward = await contributionMedalRepository.findFirstRaw({
        where: { quan_nhan_id: personnelId },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có ${getDanhHieuName(actualAward.danh_hieu || danhHieu)} (năm ${actualAward.nam || nam})`,
        };
      }

      const pendingProposals = await proposalRepository.findManyRaw({
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

/**
 * Unit annual flow: checks pending proposals first, then stored unit awards.
 * @param donViId - Unit ID used in proposal data
 * @param nam - Award year under review
 * @param danhHieu - Proposed unit-award code
 * @param proposalType - Expected unit annual proposal type
 * @returns exists=true when a pending proposal or stored award blocks insert
 */
export async function checkDuplicateUnitAward(
  donViId: string,
  nam: number,
  danhHieu: string,
  proposalType: string
): Promise<DuplicateCheckResult> {
    if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      const proposals = await proposalRepository.findManyRaw({
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

      const existingAward = await danhHieuDonViHangNamRepository.findFirst({
        where: {
          OR: [
            { co_quan_don_vi_id: donViId, nam },
            { don_vi_truc_thuoc_id: donViId, nam },
          ],
        },
        select: { danh_hieu: true, nhan_bkbqp: true, nhan_bkttcp: true },
      });

      if (existingAward) {
        const isDv = DANH_HIEU_DON_VI_CO_BAN.has(danhHieu);
        const isBk = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);

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

        // Unit DV title vs unit BK flags are mutually exclusive for a single year row.
        if (isDv && (existingAward.nhan_bkbqp || existingAward.nhan_bkttcp)) {
          const existingBk = existingAward.nhan_bkbqp ? DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP : DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;
          return {
            exists: true,
            message: `Đơn vị đã có ${getDanhHieuName(existingBk)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`,
          };
        }
        if (isBk && existingAward.danh_hieu && DANH_HIEU_DON_VI_CO_BAN.has(existingAward.danh_hieu)) {
          return {
            exists: true,
            message: `Đơn vị đã có danh hiệu ${getDanhHieuName(existingAward.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`,
          };
        }
      }
    }

    return { exists: false };
}
