import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import {
  HCQKQT_YEARS_REQUIRED,
  DANH_HIEU_DAC_BIET,
} from '../../../constants/danhHieu.constants';
import {
  batchEvaluateServiceYears,
  buildServiceYearsErrorMessage,
} from '../../eligibility/serviceYearsEligibility';
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
import { importSingleMedal } from './singleMedalImporter';
import {
  loadNienHanPersonnelMap,
  buildNienHanPayloadItem,
  type NienHanInputItem,
} from './nienHanPayloadHelper';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  HC_QKQT STRATEGY — Huân chương Quân kỳ Quyết Thắng
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  ĐIỀU KIỆN nhận:
 *    - Sĩ quan, quân nhân chuyên nghiệp đã phục vụ ≥ 25 năm.
 *    - KHÔNG phân biệt nam/nữ (khác KNC).
 *
 *  TÍNH CHẤT:
 *    - LIFETIME — quân nhân chỉ nhận 1 lần (bảng huanChuongQuanKyQuyetThang
 *      có unique trên quan_nhan_id).
 *
 *  KIẾN TRÚC chia sẻ với KNC:
 *    - Cùng dùng `serviceYearsEligibility` để check số năm.
 *    - Cùng dùng `singleMedalImporter` template để import.
 *    - 90% logic identical → DRY thông qua shared helpers.
 *
 *  KHÁC BIỆT DUY NHẤT vs KNC:
 *    - Bảng đích: huanChuongQuanKyQuyetThang (vs kyNiemChuongVSNXDQDNDVN).
 *    - Ngưỡng: 25 năm cố định (vs 25/20 theo gender).
 *    - Validate: KHÔNG cần check gender (skip MISSING_GENDER).
 *
 *  FE PAYLOAD: dùng `data_nien_han` chung — strategy phân biệt qua field
 *  `loai_de_xuat` ở proposal cha.
 * ════════════════════════════════════════════════════════════════════════════
 */
class HcqkqtStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.HC_QKQT;

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
    const invalidDanhHieus = danhHieus.filter(dh => dh !== PROPOSAL_TYPES.HC_QKQT);
    if (invalidDanhHieus.length > 0) {
      errors.push(
        `Loại đề xuất "Huy chương Quân kỳ quyết thắng" chỉ cho phép danh hiệu HC_QKQT. ` +
          `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}.`
      );
      return { errors, payload: { data_nien_han: dataNienHan } };
    }

    const evalIds = dataNienHan.map(i => i.personnel_id).filter((id): id is string => Boolean(id));
    if (evalIds.length > 0) {
      const results = await batchEvaluateServiceYears(evalIds, PROPOSAL_TYPES.HC_QKQT, new Date());
      const lines = results
        .map(r => buildServiceYearsErrorMessage(r, PROPOSAL_TYPES.HC_QKQT))
        .filter((m): m is string => m !== null);
      if (lines.length > 0) {
        errors.push(
          `Một số quân nhân chưa đủ điều kiện để đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= ${HCQKQT_YEARS_REQUIRED} năm phục vụ):\n${lines.join('\n')}`
        );
      }
    }

    return { errors, payload: { data_nien_han: dataNienHan } };
  }

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
      medalLabel: 'Huân chương Quân kỳ quyết thắng',
      logTag: 'HC_QKQT',
      decisionKey: DANH_HIEU_DAC_BIET.HC_QKQT,
      upsert: async (tx, quanNhanId, writeData) => {
        const data = writeData as unknown as Prisma.HuanChuongQuanKyQuyetThangUpdateInput;
        const existing = await tx.huanChuongQuanKyQuyetThang.findUnique({
          where: { quan_nhan_id: quanNhanId },
        });
        if (existing) {
          await tx.huanChuongQuanKyQuyetThang.update({
            where: { id: existing.id },
            data,
          });
        } else {
          await tx.huanChuongQuanKyQuyetThang.create({
            data: { ...data, quan_nhan_id: quanNhanId } as Prisma.HuanChuongQuanKyQuyetThangUncheckedCreateInput,
          });
        }
      },
    });
  }

  buildSuccessMessage(acc: ImportAccumulator): string {
    return `Đã phê duyệt Huy chương Quân kỳ quyết thắng cho ${acc.affectedPersonnelIds.size} quân nhân`;
  }
}

export const hcqkqtStrategy = new HcqkqtStrategy();
