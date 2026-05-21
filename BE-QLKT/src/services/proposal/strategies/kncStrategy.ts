import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { DANH_HIEU_CA_NHAN_KHAC } from '../../../constants/danhHieu.constants';
import {
  batchEvaluateServiceYears,
  buildServiceYearsErrorMessage,
} from '../../eligibility/serviceYearsEligibility';
import { importSingleMedal } from './singleMedalImporter';
import type { Prisma } from '../../../generated/prisma';
import type { EditedProposalData, ProposalNienHanItem } from '../../../types/proposal';
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

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  KNC STRATEGY — Kỷ niệm chương Vì Sự nghiệp Xây dựng QĐNDVN
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  ĐIỀU KIỆN nhận:
 *    - Nam: ≥ 25 năm phục vụ.
 *    - Nữ: ≥ 20 năm phục vụ.
 *  → Khác HC_QKQT ở 1 điểm DUY NHẤT: ưu đãi 5 năm cho nữ giới.
 *
 *  TÍNH CHẤT:
 *    - LIFETIME — quân nhân chỉ nhận 1 lần (bảng kyNiemChuongVSNXDQDNDVN
 *      có unique index trên quan_nhan_id).
 *    - Duplicate check ở approve sẽ block nếu đã có record.
 *
 *  FLOW:
 *    Submit:   batchEvaluateServiceYears → check 25/20 năm theo gender →
 *              build payload data_nien_han với so_thang_phuc_vu.
 *    Approve:  reuse `singleMedalImporter` (template method) với
 *              decisionKey='KNC_VSNXD_QDNDVN' và callback upsert vào bảng
 *              kyNiemChuongVSNXDQDNDVN.
 *
 *  VÌ SAO DÙNG `data_nien_han` (KHÔNG phải `data_danh_hieu`):
 *  KNC + HC_QKQT + HCCSVV chia sẻ field này vì cùng cấu trúc dữ liệu
 *  (1 row = 1 personnel + 1 huân chương + năm/tháng nhận). Tiết kiệm
 *  cột DB và logic shared (xem `nienHanPayloadHelper`).
 * ════════════════════════════════════════════════════════════════════════════
 */
class KncStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.KNC_VSNXD_QDNDVN;

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
    const danhHieus = dataNienHan.map(i => i.danh_hieu).filter(Boolean) as string[];
    const invalidDanhHieus = danhHieus.filter(dh => dh !== PROPOSAL_TYPES.KNC_VSNXD_QDNDVN);
    if (invalidDanhHieus.length > 0) {
      errors.push(
        `Loại đề xuất "Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN" chỉ cho phép danh hiệu KNC_VSNXD_QDNDVN. ` +
          `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}.`
      );
      return { errors, payload: { data_nien_han: dataNienHan } };
    }

    const evalIds = dataNienHan.map(i => i.personnel_id).filter((id): id is string => Boolean(id));
    if (evalIds.length > 0) {
      const results = await batchEvaluateServiceYears(evalIds, PROPOSAL_TYPES.KNC_VSNXD_QDNDVN, new Date());
      const lines = results
        .map(r => buildServiceYearsErrorMessage(r, PROPOSAL_TYPES.KNC_VSNXD_QDNDVN))
        .filter((m): m is string => m !== null);
      if (lines.length > 0) {
        errors.push(
          `Một số quân nhân chưa đủ điều kiện để đề xuất Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN:\n${lines.join('\n')}`
        );
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
    editedData: EditedProposalData,
    ctx: ProposalApproveContext,
    _decisions: Record<string, string | null | undefined>,
    _pdfPaths: Record<string, string | null | undefined>,
    acc: ImportAccumulator,
    prismaTx: PrismaTx
  ): Promise<void> {
    const nienHanData = (editedData.data_nien_han ?? []) as ProposalNienHanItem[];
    await importSingleMedal(nienHanData, ctx, acc, prismaTx, {
      medalLabel: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
      logTag: 'KNC',
      decisionKey: DANH_HIEU_CA_NHAN_KHAC.KNC_VSNXD_QDNDVN,
      upsert: async (tx, quanNhanId, writeData) => {
        const data = writeData as unknown as Prisma.KyNiemChuongVSNXDQDNDVNUpdateInput;
        const existing = await tx.kyNiemChuongVSNXDQDNDVN.findUnique({
          where: { quan_nhan_id: quanNhanId },
        });
        if (existing) {
          await tx.kyNiemChuongVSNXDQDNDVN.update({
            where: { id: existing.id },
            data,
          });
        } else {
          await tx.kyNiemChuongVSNXDQDNDVN.create({
            data: { ...data, quan_nhan_id: quanNhanId } as Prisma.KyNiemChuongVSNXDQDNDVNUncheckedCreateInput,
          });
        }
      },
    });
  }

  buildSuccessMessage(acc: ImportAccumulator): string {
    return `Đã phê duyệt Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN cho ${acc.affectedPersonnelIds.size} quân nhân`;
  }
}

export const kncStrategy = new KncStrategy();
