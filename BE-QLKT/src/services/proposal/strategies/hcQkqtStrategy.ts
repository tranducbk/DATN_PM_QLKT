import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { HCQKQT_YEARS_REQUIRED } from '../../../constants/danhHieu.constants';
import {
  batchEvaluateServiceYears,
  buildServiceYearsErrorMessage,
} from '../../eligibility/serviceYearsEligibility';
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

class HcQkqtStrategy implements ProposalStrategy {
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
      const results = await batchEvaluateServiceYears(evalIds, 'HC_QKQT', new Date());
      const lines = results
        .map(r => buildServiceYearsErrorMessage(r, 'HC_QKQT'))
        .filter((m): m is string => m !== null);
      if (lines.length > 0) {
        errors.push(
          `Một số quân nhân chưa đủ điều kiện để đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= ${HCQKQT_YEARS_REQUIRED} năm phục vụ):\n${lines.join('\n')}`
        );
      }
    }

    return { errors, payload: { data_nien_han: dataNienHan } };
  }

  /**
   * Approve-time validation lives in approve.ts pipeline (runDuplicateChecks +
   * runEligibilityChecks + runDecisionNumberChecks). Strategy returns [] so
   * the dispatcher can be added later without behavior change.
   */
  async validateApprove(
    _editedData: EditedProposalData,
    _ctx: ProposalApproveContext
  ): Promise<string[]> {
    return [];
  }

  /** Approve-time import still routed through legacy `importHCQKQT` in approve.ts. */
  async importInTransaction(
    _editedData: EditedProposalData,
    _ctx: ProposalApproveContext,
    _decisions: Record<string, string | null | undefined>,
    _pdfPaths: Record<string, string | null | undefined>,
    _acc: ImportAccumulator,
    _prismaTx: PrismaTx
  ): Promise<void> {
    // No-op: legacy approve.ts owns import. Future PR will move logic here.
  }

  buildSuccessMessage(acc: ImportAccumulator): string {
    return `Đã phê duyệt Huy chương Quân kỳ quyết thắng cho ${acc.affectedPersonnelIds.size} quân nhân`;
  }
}

export const hcQkqtStrategy = new HcQkqtStrategy();
