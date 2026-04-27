import { prisma } from '../../../models';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_DON_VI_BANG_KHEN,
} from '../../../constants/danhHieu.constants';
import unitAnnualAwardService from '../../unitAnnualAward.service';
import {
  checkDuplicateUnitAward,
  collectDuplicateDonViPayload,
  findInvalidDanhHieu,
  DUPLICATE_IN_PAYLOAD_ERROR,
  INVALID_DANH_HIEU_ERROR,
  MIXED_DON_VI_HANG_NAM_ERROR,
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

interface DonViInputItem {
  don_vi_id?: string;
  don_vi_type?: string;
  danh_hieu?: string;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
}

interface DonViPayloadItem {
  don_vi_id?: string;
  don_vi_type?: string;
  ten_don_vi: string;
  ma_don_vi: string;
  nam: number;
  danh_hieu?: string;
  co_quan_don_vi_cha: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
  so_quyet_dinh: string | null;
  file_quyet_dinh: string | null;
  nhan_bkbqp: boolean;
  nhan_bkttcp: boolean;
}

async function buildDonViPayload(
  items: DonViInputItem[],
  nam: number
): Promise<DonViPayloadItem[]> {
  return Promise.all(
    items.map(async item => {
      let donViInfo: { id: string; ten_don_vi: string; ma_don_vi: string } | null = null;
      let coQuanDonViCha: { id: string; ten_don_vi: string; ma_don_vi: string } | null = null;

      if (item.don_vi_type === 'CO_QUAN_DON_VI' && item.don_vi_id) {
        const donVi = await prisma.coQuanDonVi.findUnique({
          where: { id: item.don_vi_id },
          select: { id: true, ten_don_vi: true, ma_don_vi: true },
        });
        donViInfo = donVi;
      } else if (item.don_vi_type === 'DON_VI_TRUC_THUOC' && item.don_vi_id) {
        const donVi = await prisma.donViTrucThuoc.findUnique({
          where: { id: item.don_vi_id },
          include: {
            CoQuanDonVi: {
              select: { id: true, ten_don_vi: true, ma_don_vi: true },
            },
          },
        });
        if (donVi) {
          donViInfo = { id: donVi.id, ten_don_vi: donVi.ten_don_vi, ma_don_vi: donVi.ma_don_vi };
          coQuanDonViCha = donVi.CoQuanDonVi;
        }
      }

      return {
        don_vi_id: item.don_vi_id,
        don_vi_type: item.don_vi_type,
        ten_don_vi: donViInfo?.ten_don_vi || '',
        ma_don_vi: donViInfo?.ma_don_vi || '',
        nam,
        danh_hieu: item.danh_hieu,
        co_quan_don_vi_cha: coQuanDonViCha,
        so_quyet_dinh: item.so_quyet_dinh || null,
        file_quyet_dinh: item.file_quyet_dinh || null,
        nhan_bkbqp: item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
        nhan_bkttcp: item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
      };
    })
  );
}

class DonViHangNamStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.DON_VI_HANG_NAM;

  async buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult> {
    const items = (titleData ?? []) as DonViInputItem[];
    const dataDanhHieu = await buildDonViPayload(items, ctx.nam);

    if (dataDanhHieu.length === 0) {
      return { errors: [], payload: { data_danh_hieu: dataDanhHieu } };
    }

    const errors: string[] = [];
    const selectedDanhHieu = dataDanhHieu.map(i => i.danh_hieu).filter(Boolean) as string[];
    const validDonViDanhHieu = new Set<string>(Object.values(DANH_HIEU_DON_VI_HANG_NAM));
    const invalidDanhHieu = findInvalidDanhHieu(selectedDanhHieu, validDonViDanhHieu);
    if (invalidDanhHieu.length > 0) {
      errors.push(`${INVALID_DANH_HIEU_ERROR}\n${invalidDanhHieu.join(', ')}`);
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const duplicatePayloadItems = collectDuplicateDonViPayload(dataDanhHieu);
    if (duplicatePayloadItems.length > 0) {
      errors.push(`${DUPLICATE_IN_PAYLOAD_ERROR}\n${duplicatePayloadItems.join('\n')}`);
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const hasDanhHieuDonVi = selectedDanhHieu.some(dh =>
      ([DANH_HIEU_DON_VI_HANG_NAM.DVQT, DANH_HIEU_DON_VI_HANG_NAM.DVTT] as string[]).includes(dh)
    );
    const hasBangKhenDonVi = selectedDanhHieu.some(dh =>
      ([DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP, DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP] as string[]).includes(dh)
    );
    if (hasDanhHieuDonVi && hasBangKhenDonVi) {
      errors.push(MIXED_DON_VI_HANG_NAM_ERROR);
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const duplicateUnitErrors: string[] = [];
    for (const item of dataDanhHieu) {
      if (!item.don_vi_id || !item.danh_hieu) continue;
      const result = await checkDuplicateUnitAward(item.don_vi_id, ctx.nam, item.danh_hieu, this.type);
      if (result.exists) {
        const tenDonVi = item.ten_don_vi || item.don_vi_id;
        duplicateUnitErrors.push(`${tenDonVi}: ${result.message}`);
      }
    }
    if (duplicateUnitErrors.length > 0) {
      errors.push(
        `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${duplicateUnitErrors.join('\n')}`
      );
      return { errors, payload: { data_danh_hieu: dataDanhHieu } };
    }

    const unitEligibilityErrors: string[] = [];
    for (const item of dataDanhHieu) {
      if (!item.don_vi_id || !item.danh_hieu) continue;
      if (!DANH_HIEU_DON_VI_BANG_KHEN.has(item.danh_hieu)) continue;
      const eligibility = await unitAnnualAwardService.checkUnitAwardEligibility(
        item.don_vi_id,
        ctx.nam,
        item.danh_hieu
      );
      if (!eligibility.eligible) {
        const tenDonVi = item.ten_don_vi || item.don_vi_id;
        unitEligibilityErrors.push(`${tenDonVi}: ${eligibility.reason}`);
      }
    }
    if (unitEligibilityErrors.length > 0) {
      errors.push(`Một số đơn vị chưa đủ điều kiện:\n${unitEligibilityErrors.join('\n')}`);
    }

    return { errors, payload: { data_danh_hieu: dataDanhHieu } };
  }

  /** Approve flow still owned by legacy approve.ts pipeline. */
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
    return `Đã phê duyệt danh hiệu đơn vị hằng năm cho ${acc.affectedUnitIds.size} đơn vị`;
  }
}

export const donViHangNamStrategy = new DonViHangNamStrategy();
