import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import {
  HCQKQT_YEARS_REQUIRED,
  DANH_HIEU_DAC_BIET,
  getDanhHieuName,
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
import { militaryFlagRepository } from '../../../repositories/militaryFlag.repository';
import {
  loadPersonnelWithUnitsMap,
  buildNienHanPayloadItem,
  type NienHanInputItem,
} from './nienHanPayloadHelper';

class HcqkqtStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.HC_QKQT;

  async buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult> {
    const items = (titleData ?? []) as NienHanInputItem[];
    const personnelIds = items.map(i => i.personnel_id).filter((id): id is string => Boolean(id));
    const personnelMap = await loadPersonnelWithUnitsMap(personnelIds);

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
      medalLabel: getDanhHieuName(DANH_HIEU_DAC_BIET.HC_QKQT),
      logTag: 'HC_QKQT',
      decisionKey: DANH_HIEU_DAC_BIET.HC_QKQT,
      upsert: async (tx, personnelId, writeData) => {
        const data = writeData as unknown as Prisma.HuanChuongQuanKyQuyetThangUncheckedUpdateInput;
        const existing = await militaryFlagRepository.findUniqueRaw(
          { where: { quan_nhan_id: personnelId } },
          tx
        );
        if (existing) {
          await militaryFlagRepository.update(existing.id, data, tx);
        } else {
          await militaryFlagRepository.create(
            {
              ...data,
              quan_nhan_id: personnelId,
            } as Prisma.HuanChuongQuanKyQuyetThangUncheckedCreateInput,
            tx
          );
        }
      },
    });
  }

  buildSuccessMessage(acc: ImportAccumulator): string {
    return `Đã phê duyệt Huy chương Quân kỳ quyết thắng cho ${acc.affectedPersonnelIds.size} quân nhân`;
  }
}

export const hcqkqtStrategy = new HcqkqtStrategy();
