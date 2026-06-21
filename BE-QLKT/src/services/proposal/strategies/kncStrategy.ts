import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { DANH_HIEU_DAC_BIET, getDanhHieuName } from '../../../constants/danhHieu.constants';
import {
  batchEvaluateServiceYears,
  buildServiceYearsErrorMessage,
} from '../../eligibility/serviceYearsEligibility';
import { importSingleMedal } from './singleMedalImporter';
import { commemorativeMedalRepository } from '../../../repositories/commemorativeMedal.repository';
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
  loadPersonnelWithUnitsMap,
  buildNienHanPayloadItem,
  type NienHanInputItem,
} from './nienHanPayloadHelper';

const KNC_LABEL = getDanhHieuName(PROPOSAL_TYPES.KNC_VSNXD_QDNDVN);

class KncStrategy implements ProposalStrategy {
  readonly type = PROPOSAL_TYPES.KNC_VSNXD_QDNDVN;

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
    const invalidDanhHieus = danhHieus.filter(dh => dh !== PROPOSAL_TYPES.KNC_VSNXD_QDNDVN);
    if (invalidDanhHieus.length > 0) {
      errors.push(
        `Loại đề xuất "${KNC_LABEL}" chỉ cho phép danh hiệu KNC_VSNXD_QDNDVN. ` +
          `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}.`
      );
      return { errors, payload: { data_nien_han: dataNienHan } };
    }

    const evalIds = dataNienHan.map(i => i.personnel_id).filter((id): id is string => Boolean(id));
    if (evalIds.length > 0) {
      const results = await batchEvaluateServiceYears(
        evalIds,
        PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        new Date()
      );
      const lines = results
        .map(r => buildServiceYearsErrorMessage(r, PROPOSAL_TYPES.KNC_VSNXD_QDNDVN))
        .filter((m): m is string => m !== null);
      if (lines.length > 0) {
        errors.push(
          `Một số quân nhân chưa đủ điều kiện để đề xuất ${KNC_LABEL}:\n${lines.join('\n')}`
        );
      }
    }

    return { errors, payload: { data_nien_han: dataNienHan } };
  }

  /** See HcQkqtStrategy — approve flow lives in approve.ts pipeline. */
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
      medalLabel: KNC_LABEL,
      logTag: 'KNC',
      decisionKey: DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN,
      upsert: async (tx, personnelId, writeData) => {
        const data = writeData as unknown as Prisma.KyNiemChuongVSNXDQDNDVNUncheckedUpdateInput;
        const existing = await commemorativeMedalRepository.findUniqueRaw(
          { where: { quan_nhan_id: personnelId } },
          tx
        );
        if (existing) {
          await commemorativeMedalRepository.update(existing.id, data, tx);
        } else {
          await commemorativeMedalRepository.create(
            {
              ...data,
              quan_nhan_id: personnelId,
            } as Prisma.KyNiemChuongVSNXDQDNDVNUncheckedCreateInput,
            tx
          );
        }
      },
    });
  }

}

export const kncStrategy = new KncStrategy();
