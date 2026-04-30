import type { Prisma } from '../../../generated/prisma';
import { danhHieuDonViHangNamRepository } from '../../../repositories/danhHieu.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../../../repositories/unit.repository';
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
import { PROPOSAL_STATUS } from '../../../constants/proposalStatus.constants';
import type { EditedProposalData, ProposalDanhHieuItem } from '../../../types/proposal';
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
        const donVi = await coQuanDonViRepository.findUniqueRaw({
          where: { id: item.don_vi_id },
          select: { id: true, ten_don_vi: true, ma_don_vi: true },
        });
        donViInfo = donVi;
      } else if (item.don_vi_type === 'DON_VI_TRUC_THUOC' && item.don_vi_id) {
        const donVi = await donViTrucThuocRepository.findUniqueRaw({
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
    editedData: EditedProposalData,
    ctx: ProposalApproveContext,
    _decisions: Record<string, string | null | undefined>,
    _pdfPaths: Record<string, string | null | undefined>,
    acc: ImportAccumulator,
    prismaTx: PrismaTx
  ): Promise<void> {
    const danhHieuData = (editedData.data_danh_hieu ?? []) as ProposalDanhHieuItem[];
    const decisionMapping = ctx.mappings?.decisionMapping ?? {};
    const specialDecisionMapping = ctx.mappings?.specialDecisionMapping ?? {};
    const adminId = ctx.adminId;

    for (const item of danhHieuData) {
      try {
        if (!item.don_vi_id || !item.don_vi_type) {
          acc.errors.push('Thiếu thông tin đơn vị khi lưu danh hiệu.');
          continue;
        }
        const coQuanDonViId = item.don_vi_type === 'CO_QUAN_DON_VI' ? item.don_vi_id : null;
        const donViTrucThuocId = item.don_vi_type === 'DON_VI_TRUC_THUOC' ? item.don_vi_id : null;
        const namValue =
          typeof item.nam === 'string' ? parseInt(item.nam, 10) : (item.nam as number);
        if (!item.danh_hieu || item.danh_hieu.trim() === '') continue;

        const decisionInfo = decisionMapping[item.danh_hieu] || {};
        const soQuyetDinh = item.so_quyet_dinh || decisionInfo.so_quyet_dinh || null;

        const isBkbqp = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP || !!item.nhan_bkbqp;
        const isBkttcp =
          item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP || !!item.nhan_bkttcp;
        const soQuyetDinhBKBQP =
          item.so_quyet_dinh_bkbqp ||
          (isBkbqp ? (specialDecisionMapping.BKBQP?.so_quyet_dinh ?? null) : null);
        const soQuyetDinhBKTTCP =
          item.so_quyet_dinh_bkttcp ||
          (isBkttcp ? (specialDecisionMapping.BKTTCP?.so_quyet_dinh ?? null) : null);

        const whereCondition = {
          nam: namValue,
          OR: [
            ...(coQuanDonViId ? [{ co_quan_don_vi_id: coQuanDonViId }] : []),
            ...(donViTrucThuocId ? [{ don_vi_truc_thuoc_id: donViTrucThuocId }] : []),
          ],
        };

        const existingAward = await danhHieuDonViHangNamRepository.findFirst({
          where: whereCondition,
        }, prismaTx);
        const data: Record<string, unknown> = {};
        if (
          item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVQT ||
          item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVTT
        ) {
          data.danh_hieu = item.danh_hieu;
          data.so_quyet_dinh = soQuyetDinh;
        }
        if (isBkbqp) {
          data.nhan_bkbqp = true;
          data.so_quyet_dinh_bkbqp = soQuyetDinhBKBQP;
        }
        if (isBkttcp) {
          data.nhan_bkttcp = true;
          data.so_quyet_dinh_bkttcp = soQuyetDinhBKTTCP;
        }
        data.status = PROPOSAL_STATUS.APPROVED;
        data.nguoi_duyet_id = adminId;
        data.ngay_duyet = new Date();
        data.ghi_chu = item.ghi_chu || null;

        if (existingAward) {
          await danhHieuDonViHangNamRepository.updateRaw({
            where: { id: existingAward.id },
            data,
          }, prismaTx);
        } else {
          const isMainAward =
            item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVQT ||
            item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVTT;
          const createData: Prisma.DanhHieuDonViHangNamUncheckedCreateInput = {
            co_quan_don_vi_id: coQuanDonViId ?? null,
            don_vi_truc_thuoc_id: donViTrucThuocId ?? null,
            nam: namValue,
            danh_hieu: isMainAward ? item.danh_hieu : null,
            so_quyet_dinh: isMainAward ? soQuyetDinh : null,
            nhan_bkbqp: isBkbqp,
            so_quyet_dinh_bkbqp: isBkbqp ? soQuyetDinhBKBQP : null,
            nhan_bkttcp: isBkttcp,
            so_quyet_dinh_bkttcp: isBkttcp ? soQuyetDinhBKTTCP : null,
            status: PROPOSAL_STATUS.APPROVED,
            nguoi_tao_id: adminId,
            nguoi_duyet_id: adminId,
            ngay_duyet: new Date(),
            ghi_chu: item.ghi_chu || null,
          };
          await danhHieuDonViHangNamRepository.createRaw({ data: createData }, prismaTx);
        }
        acc.importedDanhHieu++;
        acc.affectedUnitIds.add(item.don_vi_id);
      } catch (error) {
        console.error('[approveProposal] unit award error:', {
          don_vi_id: item.don_vi_id,
          error,
        });
        const tenDonVi = item.ten_don_vi ? ` cho đơn vị "${item.ten_don_vi}"` : '';
        acc.errors.push(`Có lỗi xảy ra khi lưu danh hiệu đơn vị${tenDonVi}, vui lòng thử lại.`);
      }
    }
  }

  buildSuccessMessage(acc: ImportAccumulator): string {
    return `Đã phê duyệt danh hiệu đơn vị hằng năm cho ${acc.affectedUnitIds.size} đơn vị`;
  }
}

export const donViHangNamStrategy = new DonViHangNamStrategy();
