import { prisma } from '../../../models';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../../constants/proposalStatus.constants';
import { ValidationError } from '../../../middlewares/errorHandler';
import { nienHanStrategy } from '../strategies/nienHanStrategy';
import { hcQkqtStrategy } from '../strategies/hcQkqtStrategy';
import { kncStrategy } from '../strategies/kncStrategy';
import { nckhStrategy } from '../strategies/nckhStrategy';
import { donViHangNamStrategy } from '../strategies/donViHangNamStrategy';
import { congHienStrategy } from '../strategies/congHienStrategy';
import { caNhanHangNamStrategy } from '../strategies/caNhanHangNamStrategy';
import type {
  ProposalApproveContext,
  ImportAccumulator as StrategyImportAccumulator,
  ApproveDecisionMappings,
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

const PROPOSAL_APPROVE_TX_TIMEOUT_MS = 60000;

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

      if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        await donViHangNamStrategy.importInTransaction(
          { data_danh_hieu: danhHieuData } as EditedProposalData,
          approveCtx,
          decisions,
          pdfPaths,
          acc as StrategyImportAccumulator,
          prismaTx
        );
      } else if (proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN) {
        await congHienStrategy.importInTransaction(
          { data_cong_hien: congHienData } as EditedProposalData,
          approveCtx,
          decisions,
          pdfPaths,
          acc as StrategyImportAccumulator,
          prismaTx
        );
      } else {
        await caNhanHangNamStrategy.importInTransaction(
          { data_danh_hieu: danhHieuData } as EditedProposalData,
          approveCtx,
          decisions,
          pdfPaths,
          acc as StrategyImportAccumulator,
          prismaTx
        );
      }

      if (
        proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN &&
        nienHanData &&
        nienHanData.length > 0
      ) {
        await nienHanStrategy.importInTransaction(
          { data_nien_han: nienHanData } as EditedProposalData,
          approveCtx,
          decisions,
          pdfPaths,
          acc as StrategyImportAccumulator,
          prismaTx
        );
      }
      if (
        proposal.loai_de_xuat === PROPOSAL_TYPES.HC_QKQT &&
        nienHanData &&
        nienHanData.length > 0
      ) {
        await hcQkqtStrategy.importInTransaction(
          { data_nien_han: nienHanData } as EditedProposalData,
          approveCtx,
          decisions,
          pdfPaths,
          acc as StrategyImportAccumulator,
          prismaTx
        );
      }
      if (
        proposal.loai_de_xuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN &&
        nienHanData &&
        nienHanData.length > 0
      ) {
        await kncStrategy.importInTransaction(
          { data_nien_han: nienHanData } as EditedProposalData,
          approveCtx,
          decisions,
          pdfPaths,
          acc as StrategyImportAccumulator,
          prismaTx
        );
      }

      await nckhStrategy.importInTransaction(
        { data_thanh_tich: thanhTichData } as EditedProposalData,
        approveCtx,
        decisions,
        pdfPaths,
        acc as StrategyImportAccumulator,
        prismaTx
      );

      if (acc.errors.length > 0) {
        throw new ValidationError(
          `Không thể phê duyệt đề xuất do có ${acc.errors.length} lỗi khi thêm khen thưởng:\n${acc.errors.join('\n')}`
        );
      }

      const updateResult = await prismaTx.bangDeXuat.updateMany({
        where: { id: proposalId, status: PROPOSAL_STATUS.PENDING },
        data: updateData,
      });
      if (updateResult.count === 0) {
        throw new ValidationError(
          'Đề xuất đã bị thay đổi bởi người khác. Vui lòng tải lại trang và thử lại.'
        );
      }
    },
    { timeout: PROPOSAL_APPROVE_TX_TIMEOUT_MS }
  );
}
