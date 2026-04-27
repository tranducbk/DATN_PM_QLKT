import { prisma } from '../../../models';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_CA_NHAN_CO_BAN,
  DANH_HIEU_CA_NHAN_BANG_KHEN,
} from '../../../constants/danhHieu.constants';
import profileService from '../../profile.service';
import { collectPersonnelDuplicateErrors } from '../../eligibility/personnelDuplicateCheck';
import {
  collectDuplicateCaNhanPayload,
  findInvalidDanhHieu,
  DUPLICATE_IN_PAYLOAD_ERROR,
  INVALID_DANH_HIEU_ERROR,
  MIXED_CA_NHAN_HANG_NAM_ERROR,
} from '../validation';
import type { EditedProposalData } from '../../../types/proposal';
import type {
  ProposalStrategy,
  ProposalSubmitContext,
  ProposalApproveContext,
  ImportAccumulator,
  PrismaTx,
  SubmitValidationResult,
} from './proposalStrategy';

interface CaNhanInputItem {
  personnel_id?: string;
  danh_hieu?: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
}

interface CaNhanPersonnelRow {
  id: string;
  ho_ten: string | null;
  don_vi_truc_thuoc_id: string | null;
  CoQuanDonVi: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
  DonViTrucThuoc:
    | {
        id: string;
        ten_don_vi: string;
        ma_don_vi: string;
        CoQuanDonVi: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
      }
    | null;
}

async function loadPersonnelMap(personnelIds: string[]): Promise<Map<string, CaNhanPersonnelRow>> {
  if (personnelIds.length === 0) return new Map();
  const rows = await prisma.quanNhan.findMany({
    where: { id: { in: personnelIds } },
    select: {
      id: true,
      ho_ten: true,
      don_vi_truc_thuoc_id: true,
      CoQuanDonVi: { select: { id: true, ten_don_vi: true, ma_don_vi: true } },
      DonViTrucThuoc: {
        select: {
          id: true,
          ten_don_vi: true,
          ma_don_vi: true,
          CoQuanDonVi: { select: { id: true, ten_don_vi: true, ma_don_vi: true } },
        },
      },
    },
  });
  return new Map(rows.map(r => [r.id, r as CaNhanPersonnelRow]));
}

class CaNhanHangNamStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.CA_NHAN_HANG_NAM;

  async buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult> {
    const items = (titleData ?? []) as CaNhanInputItem[];
    const personnelIds = items
      .map(i => i.personnel_id)
      .filter((id): id is string => Boolean(id));
    const personnelMap = await loadPersonnelMap(personnelIds);

    const dataDanhHieu = items.map(item => {
      const personnel = item.personnel_id ? personnelMap.get(item.personnel_id) : undefined;
      const personnelCoQuanDonVi = personnel?.CoQuanDonVi;
      const personnelDonViTrucThuoc = personnel?.DonViTrucThuoc;

      const coQuanDonVi = personnelCoQuanDonVi
        ? {
            id: personnelCoQuanDonVi.id,
            ten_co_quan_don_vi: personnelCoQuanDonVi.ten_don_vi,
            ma_co_quan_don_vi: personnelCoQuanDonVi.ma_don_vi,
          }
        : null;

      const donViTrucThuoc =
        personnel?.don_vi_truc_thuoc_id && personnelDonViTrucThuoc
          ? {
              id: personnelDonViTrucThuoc.id,
              ten_don_vi: personnelDonViTrucThuoc.ten_don_vi,
              ma_don_vi: personnelDonViTrucThuoc.ma_don_vi,
              co_quan_don_vi: personnelDonViTrucThuoc.CoQuanDonVi
                ? {
                    id: personnelDonViTrucThuoc.CoQuanDonVi.id,
                    ten_don_vi_truc: personnelDonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                    ma_don_vi: personnelDonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                  }
                : null,
            }
          : null;

      return {
        personnel_id: item.personnel_id,
        ho_ten: personnel?.ho_ten || '',
        nam: ctx.nam,
        danh_hieu: item.danh_hieu,
        cap_bac: item.cap_bac || null,
        chuc_vu: item.chuc_vu || null,
        co_quan_don_vi: coQuanDonVi,
        don_vi_truc_thuoc: donViTrucThuoc,
        nhan_bkbqp: item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
        nhan_cstdtq: item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
        nhan_bkttcp: item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
      };
    });

    if (dataDanhHieu.length === 0) {
      return { errors: [], payload: { data_danh_hieu: dataDanhHieu } };
    }

    const errors: string[] = [];
    const selectedDanhHieu = dataDanhHieu.map(i => i.danh_hieu).filter(Boolean) as string[];
    const validCaNhanDanhHieu = new Set<string>(Object.values(DANH_HIEU_CA_NHAN_HANG_NAM));
    const invalidDanhHieu = findInvalidDanhHieu(selectedDanhHieu, validCaNhanDanhHieu);
    if (invalidDanhHieu.length > 0) {
      errors.push(`${INVALID_DANH_HIEU_ERROR}\n${invalidDanhHieu.join(', ')}`);
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const duplicatePayloadItems = collectDuplicateCaNhanPayload(
      dataDanhHieu,
      personnelId => personnelMap.get(personnelId)?.ho_ten || personnelId
    );
    if (duplicatePayloadItems.length > 0) {
      errors.push(`${DUPLICATE_IN_PAYLOAD_ERROR}\n${duplicatePayloadItems.join('\n')}`);
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const hasChinh = selectedDanhHieu.some(dh => DANH_HIEU_CA_NHAN_CO_BAN.has(dh));
    const hasNhomChuoi = selectedDanhHieu.some(dh =>
      (
        [
          DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
          DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
          DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
        ] as string[]
      ).includes(dh)
    );
    if (hasChinh && hasNhomChuoi) {
      errors.push(MIXED_CA_NHAN_HANG_NAM_ERROR);
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const hoTenMap = new Map<string, string>(
      Array.from(personnelMap.entries()).map(([id, p]) => [id, p.ho_ten || id])
    );
    const duplicateErrors = await collectPersonnelDuplicateErrors(
      dataDanhHieu,
      ctx.nam,
      this.type,
      { hoTenMap }
    );
    if (duplicateErrors.length > 0) {
      errors.push(
        `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${duplicateErrors.join('\n')}`
      );
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const eligibilityErrors: string[] = [];
    for (const item of dataDanhHieu) {
      if (!item.personnel_id || !item.danh_hieu) continue;
      if (!DANH_HIEU_CA_NHAN_BANG_KHEN.has(item.danh_hieu)) continue;
      const eligibility = await profileService.checkAwardEligibility(
        item.personnel_id,
        ctx.nam,
        item.danh_hieu
      );
      if (!eligibility.eligible) {
        const hoTen = personnelMap.get(item.personnel_id)?.ho_ten || item.personnel_id;
        eligibilityErrors.push(`${hoTen}: ${eligibility.reason}`);
      }
    }
    if (eligibilityErrors.length > 0) {
      errors.push(`Một số quân nhân chưa đủ điều kiện:\n${eligibilityErrors.join('\n')}`);
    }

    return { errors, payload: { data_danh_hieu: dataDanhHieu } };
  }

  async validateApprove(
    _editedData: EditedProposalData,
    _ctx: ProposalApproveContext
  ): Promise<string[]> {
    return [];
  }

  async importInTransaction(
    _editedData: EditedProposalData,
    _ctx: ProposalApproveContext,
    _decisions: Record<string, string | null | undefined>,
    _pdfPaths: Record<string, string | null | undefined>,
    _acc: ImportAccumulator,
    _prismaTx: PrismaTx
  ): Promise<void> {
    // No-op: legacy approve.ts owns import.
  }

  buildSuccessMessage(acc: ImportAccumulator): string {
    return `Đã phê duyệt danh hiệu cá nhân hằng năm cho ${acc.affectedPersonnelIds.size} quân nhân`;
  }
}

export const caNhanHangNamStrategy = new CaNhanHangNamStrategy();
