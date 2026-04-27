import type { BangDeXuat, Prisma } from '../../../generated/prisma';
import type { ProposalType } from '../../../constants/proposalTypes.constants';
import type { EditedProposalData } from '../../../types/proposal';

export type DecisionInfo = { so_quyet_dinh?: string | null; file_pdf?: string | null };
export interface ApproveDecisionMappings {
  decisionMapping: Record<string, DecisionInfo>;
  specialDecisionMapping: Record<string, DecisionInfo>;
  pdfPaths: Record<string, string | undefined>;
}

export type PrismaTx = Prisma.TransactionClient;

export interface ProposalSubmitContext {
  userId: string;
  donViId: string | null;
  isCoQuanDonVi: boolean;
  nam: number;
  thang: number | null;
}

export interface ProposalApproveContext {
  proposalId: string;
  adminId: string;
  proposalYear: number;
  proposalMonth: number | null;
  proposalType: ProposalType;
  refDate: Date;
  ghiChu: string | null;
  personnelHoTenMap: Map<string, string>;
  /** Full loaded proposal — strategies that delegate to legacy import helpers need it. */
  proposal?: BangDeXuat;
  /** Built decision/PDF mappings — supplied by approve dispatcher. */
  mappings?: ApproveDecisionMappings;
}

export interface ImportAccumulator {
  errors: string[];
  affectedPersonnelIds: Set<string>;
  affectedUnitIds: Set<string>;
  importedDanhHieu: number;
  importedNienHan: number;
  importedThanhTich: number;
}

export interface SubmitPayload {
  data_danh_hieu?: unknown[] | null;
  data_thanh_tich?: unknown[] | null;
  data_nien_han?: unknown[] | null;
  data_cong_hien?: unknown[] | null;
}

export interface SubmitValidationResult {
  errors: string[];
  payload: SubmitPayload;
}

/**
 * Strategy abstraction for one proposal type. Encapsulates submit-time payload
 * shaping + validation, approve-time validation, and approve-time import-into-tx.
 *
 * To register a new proposal type:
 *   1. Implement this interface in `<type>Strategy.ts`
 *   2. Add an entry in `strategies/index.ts` REGISTRY
 *   3. Wire it into `submit.ts` + `approve.ts` dispatch sites
 */
export interface ProposalStrategy {
  readonly type: ProposalType;

  /**
   * Validate + build payload at submit time. Returns validation errors and
   * payload-shaped data ready for `BangDeXuat.create({ data: { ... } })`.
   * @param titleData - Raw items from the request body
   * @param ctx - Submitting user / unit / year / month context
   * @returns Aggregated validation errors and the typed payload
   */
  buildSubmitPayload(
    titleData: unknown[],
    ctx: ProposalSubmitContext
  ): Promise<SubmitValidationResult>;

  /**
   * Approve-time pre-transaction checks (status, month, duplicate, eligibility,
   * decision numbers). Returns aggregated errors. Must NOT modify DB state.
   * @param editedData - Approver-edited JSON payload
   * @param ctx - Approve-time context
   * @returns Aggregated error strings (empty when valid)
   */
  validateApprove(
    editedData: EditedProposalData,
    ctx: ProposalApproveContext
  ): Promise<string[]>;

  /**
   * Inside transaction: import items into target award table. Mutates `acc`
   * (errors + counters + affected ids).
   * @param editedData - Approver-edited JSON payload
   * @param ctx - Approve-time context
   * @param decisions - Decision number map keyed by `so_quyet_dinh_<type>`
   * @param pdfPaths - Decision PDF path map keyed by `file_pdf_<type>`
   * @param acc - Accumulator mutated in place
   * @param prismaTx - Active transaction client
   */
  importInTransaction(
    editedData: EditedProposalData,
    ctx: ProposalApproveContext,
    decisions: Record<string, string | null | undefined>,
    pdfPaths: Record<string, string | null | undefined>,
    acc: ImportAccumulator,
    prismaTx: PrismaTx
  ): Promise<void>;

  /**
   * Build success message after import.
   * @param acc - Populated accumulator
   * @returns Vietnamese summary message
   */
  buildSuccessMessage(acc: ImportAccumulator): string;
}
