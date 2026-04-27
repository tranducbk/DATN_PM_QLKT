import { prisma } from '../../../models';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { DANH_HIEU_HCCSVV } from '../../../constants/danhHieu.constants';
import { validateHCCSVVRankOrder } from '../../../helpers/hccsvvRankOrderValidation';
import type { EditedProposalData } from '../../../types/proposal';
import type {
  ProposalStrategy,
  ProposalSubmitContext,
  ProposalApproveContext,
  ImportAccumulator,
  PrismaTx,
  SubmitValidationResult,
} from './proposalStrategy';
import {
  loadNienHanPersonnelMap,
  buildNienHanPayloadItem,
  type NienHanInputItem,
} from './nienHanPayloadHelper';

class NienHanStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.NIEN_HAN;

  async buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult> {
    const items = (titleData ?? []) as NienHanInputItem[];
    const personnelIds = items
      .map(i => i.personnel_id)
      .filter((id): id is string => Boolean(id));
    const personnelMap = await loadNienHanPersonnelMap(personnelIds);

    const dataNienHan = items.map(item =>
      buildNienHanPayloadItem(
        item,
        item.personnel_id ? personnelMap.get(item.personnel_id) : undefined,
        ctx.nam,
        ctx.thang
      )
    );

    const errors: string[] = [];
    const allowedDanhHieus = Object.values(DANH_HIEU_HCCSVV) as string[];
    const danhHieus = dataNienHan.map(i => i.danh_hieu).filter(Boolean) as string[];
    const invalidDanhHieus = danhHieus.filter(dh => !allowedDanhHieus.includes(dh));
    if (invalidDanhHieus.length > 0) {
      errors.push(
        `Loại đề xuất "Huy chương Chiến sĩ vẻ vang" chỉ cho phép các hạng HCCSVV. ` +
          `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}. ` +
          `Vui lòng sử dụng loại đề xuất riêng cho HC_QKQT hoặc KNC_VSNXD_QDNDVN.`
      );
    }

    if (errors.length === 0) {
      const evalIds = dataNienHan
        .map(i => i.personnel_id)
        .filter((id): id is string => Boolean(id));
      if (evalIds.length > 0) {
        const existingHCCSVV = await prisma.khenThuongHCCSVV.findMany({
          where: { quan_nhan_id: { in: evalIds } },
          select: { quan_nhan_id: true, danh_hieu: true, nam: true },
        });
        const hccsvvByPersonnel = new Map<string, { danh_hieu: string; nam: number }[]>();
        for (const r of existingHCCSVV) {
          const list = hccsvvByPersonnel.get(r.quan_nhan_id) || [];
          list.push({ danh_hieu: r.danh_hieu, nam: r.nam });
          hccsvvByPersonnel.set(r.quan_nhan_id, list);
        }
        const rankOrderErrors: string[] = [];
        for (const item of dataNienHan) {
          if (!item.personnel_id || !item.danh_hieu) continue;
          const existing = hccsvvByPersonnel.get(item.personnel_id) || [];
          const orderError = validateHCCSVVRankOrder(item.danh_hieu, ctx.nam, existing);
          if (orderError) {
            const personnel = personnelMap.get(item.personnel_id);
            const hoTen = personnel?.ho_ten || item.personnel_id;
            rankOrderErrors.push(`${hoTen}: ${orderError}`);
          }
        }
        if (rankOrderErrors.length > 0) {
          errors.push(
            `Một số quân nhân chưa đủ điều kiện theo thứ tự hạng HCCSVV:\n${rankOrderErrors.join('\n')}`
          );
        }
      }
    }

    return { errors, payload: { data_nien_han: dataNienHan } };
  }

  /** See HcQkqtStrategy — approve flow lives in approve.ts pipeline. */
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
    return `Đã phê duyệt Huy chương Chiến sĩ vẻ vang cho ${acc.affectedPersonnelIds.size} quân nhân`;
  }
}

export const nienHanStrategy = new NienHanStrategy();
