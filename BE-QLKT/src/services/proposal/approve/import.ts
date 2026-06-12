import { prisma } from '../../../models';
import { proposalRepository } from '../../../repositories/proposal.repository';
import { PROPOSAL_TYPES, type ProposalType } from '../../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../../constants/proposalStatus.constants';
import { ValidationError } from '../../../middlewares/errorHandler';
import { hccsvvStrategy } from '../strategies/hccsvvStrategy';
import { hcqkqtStrategy } from '../strategies/hcqkqtStrategy';
import { kncStrategy } from '../strategies/kncStrategy';
import { nckhStrategy } from '../strategies/nckhStrategy';
import { donViHangNamStrategy } from '../strategies/donViHangNamStrategy';
import { hcbvtqStrategy } from '../strategies/hcbvtqStrategy';
import { caNhanHangNamStrategy } from '../strategies/caNhanHangNamStrategy';
import type {
  ProposalApproveContext,
  ImportAccumulator as StrategyImportAccumulator,
  ApproveDecisionMappings,
  ProposalStrategy,
} from '../strategies/proposalStrategy';
import { syncDecisionFiles } from './decisionMappings';
import type {
  DecisionInputMap,
  DecisionMappings,
  ImportAccumulator,
  ProposalContext,
} from './types';
import type {
  ProposalDanhHieuItem,
  ProposalThanhTichItem,
  ProposalNienHanItem,
  ProposalCongHienItem,
  EditedProposalData,
} from '../../../types/proposal';

// Approve transaction covers per-personnel writes + profile recalc + audit + decision sync.
// 60s was too tight for end-of-year batches (~300+ personnel). Bumped to 180s; if a single
// approve ever needs more, split the proposal rather than raising further.
const PROPOSAL_APPROVE_TX_TIMEOUT_MS = 180000;

// Tenure-family proposals import their medal rows (data_nien_han) via a dedicated strategy
// on top of the primary danh-hieu import. Other types have no entry here.
const NIEN_HAN_MEDAL_STRATEGY: Partial<Record<ProposalType, ProposalStrategy>> = {
  [PROPOSAL_TYPES.NIEN_HAN]: hccsvvStrategy,
  [PROPOSAL_TYPES.HC_QKQT]: hcqkqtStrategy,
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: kncStrategy,
};

/**
 * Runs all per-type imports inside a single transaction and finalizes proposal status.
 */
export async function runImportTransaction(
  ctx: ProposalContext,
  danhHieuData: ProposalDanhHieuItem[],
  thanhTichData: ProposalThanhTichItem[],
  nienHanData: ProposalNienHanItem[],
  congHienData: ProposalCongHienItem[],
  decisions: DecisionInputMap,
  mappings: DecisionMappings,
  pdfPaths: Record<string, string | undefined>,
  updateData: Record<string, unknown>,
  acc: ImportAccumulator
): Promise<void> {
  const { proposal, proposalId } = ctx;

  await prisma.$transaction(
    async prismaTx => {
      const approveCtx: ProposalApproveContext = {
        proposalId: ctx.proposalId,
        adminId: ctx.adminId,
        proposalYear: ctx.proposalYear,
        proposalMonth: proposal.thang ?? null,
        proposalType: ctx.proposalType,
        refDate: ctx.refDate,
        ghiChu: ctx.ghiChu,
        personnelHoTenMap: ctx.personnelHoTenMap,
        proposal,
        mappings: {
          decisionMapping: mappings.decisionMapping,
          specialDecisionMapping: mappings.specialDecisionMapping,
          pdfPaths,
        } as ApproveDecisionMappings,
      };

      // FileQuyetDinh rows must exist before award rows can reference them via hard FK.
      await syncDecisionFiles(ctx, danhHieuData, thanhTichData, decisions, pdfPaths, prismaTx);

      const runStrategyImport = (strategy: ProposalStrategy, editedData: EditedProposalData) =>
        strategy.importInTransaction(
          editedData,
          approveCtx,
          decisions,
          pdfPaths,
          acc as StrategyImportAccumulator,
          prismaTx
        );

      // Primary danh-hieu/cong-hien import is selected by proposal type.
      if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        await runStrategyImport(donViHangNamStrategy, {
          data_danh_hieu: danhHieuData,
        } as EditedProposalData);
      } else if (proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN) {
        await runStrategyImport(hcbvtqStrategy, {
          data_cong_hien: congHienData,
        } as EditedProposalData);
      } else {
        await runStrategyImport(caNhanHangNamStrategy, {
          data_danh_hieu: danhHieuData,
        } as EditedProposalData);
      }

      // Tenure-family proposals additionally import their medal rows from data_nien_han.
      const medalStrategy = NIEN_HAN_MEDAL_STRATEGY[proposal.loai_de_xuat as ProposalType];
      if (medalStrategy && nienHanData && nienHanData.length > 0) {
        await runStrategyImport(medalStrategy, { data_nien_han: nienHanData } as EditedProposalData);
      }

      // NCKH achievements may accompany any proposal type.
      await runStrategyImport(nckhStrategy, {
        data_thanh_tich: thanhTichData,
      } as EditedProposalData);

      if (acc.errors.length > 0) {
        throw new ValidationError(
          `Không thể phê duyệt đề xuất do có ${acc.errors.length} lỗi khi thêm khen thưởng:\n${acc.errors.join('\n')}`
        );
      }

      const updateResult = await proposalRepository.updateMany(
        { id: proposalId, status: PROPOSAL_STATUS.PENDING },
        updateData,
        prismaTx
      );
      if (updateResult.count === 0) {
        throw new ValidationError(
          'Đề xuất đã bị thay đổi bởi người khác. Vui lòng tải lại trang và thử lại.'
        );
      }
    },
    { timeout: PROPOSAL_APPROVE_TX_TIMEOUT_MS }
  );
}
