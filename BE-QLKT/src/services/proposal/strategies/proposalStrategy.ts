import type { BangDeXuat, Prisma } from '../../../generated/prisma';
import type { ProposalType } from '../../../constants/proposalTypes.constants';
import type { EditedProposalData } from '../../../types/proposal';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  STRATEGY PATTERN — 1 interface, 7 implementation cho 7 loại đề xuất
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  WHY STRATEGY PATTERN (vì sao không dùng if/else)?
 *
 *  Trước refactor: `approve.ts` có chuỗi if/else dài ~2000 dòng dispatch
 *  theo `loai_de_xuat`, mỗi nhánh inline logic riêng. Vấn đề:
 *    ① Khó thêm loại mới — phải sửa nhiều chỗ.
 *    ② Test khó — phải mock toàn bộ dispatcher.
 *    ③ Vi phạm Open/Closed Principle — mỗi lần thay đổi 1 loại đều phải
 *       sửa file chính.
 *
 *  Sau refactor: mỗi loại = 1 file `<type>Strategy.ts` implement interface
 *  `ProposalStrategy`. Dispatcher chỉ làm 1 việc: `getStrategy(type).X(...)`.
 *
 *  ⚠️ IMPLEMENTS ≠ EXTENDS (điểm hay nhầm):
 *    • `implements` (ở đây): interface KHÔNG có code, chỉ là HỢP ĐỒNG (danh sách
 *      method bắt buộc). Mỗi `class XxxStrategy implements ProposalStrategy` phải
 *      TỰ VIẾT ĐẦY ĐỦ cả 4 method — không có code "cha" nào chảy xuống để dùng lại.
 *    • `extends` (kế thừa class): con nhận CODE của cha + override 1 phần. KHÔNG
 *      dùng ở đây vì 7 loại logic khác hẳn, không có "hành vi cha" chung.
 *    • Trùng logic → tách HELPER gọi chung (composition), KHÔNG kế thừa. Vd
 *      HcqkqtStrategy + KncStrategy đều gọi `importSingleMedal(...)`.
 *
 *  CÁCH HOẠT ĐỘNG:
 *    ┌─────────────────────┐    type    ┌─────────────────────┐
 *    │  proposalService    │ ─────────► │  REGISTRY (index)   │
 *    └─────────────────────┘            └─────────────────────┘
 *              │                                  │
 *              │ strategy.method(...)             │ returns
 *              ▼                                  ▼
 *    ┌─────────────────────┐            ┌─────────────────────┐
 *    │  ProposalStrategy   │ ◄──────────│  <type>Strategy.ts  │
 *    │  (interface)        │  implement │  (implementation)   │
 *    └─────────────────────┘            └─────────────────────┘
 *
 *  4 METHOD CHÍNH (xem bên dưới):
 *    1. buildSubmitPayload — chuẩn hoá data khi Manager nộp đề xuất.
 *    2. validateApprove    — pre-flight check trước khi Admin duyệt.
 *    3. importInTransaction— ghi vào bảng đích (DanhHieuHangNam, ...).
 *    4. buildSuccessMessage— message hiển thị sau khi duyệt thành công.
 *
 *  REGISTRY (`strategies/index.ts`): map ProposalType → instance singleton.
 *  Dispatcher gọi `getStrategy(type)` để lấy instance đúng — không if/else.
 * ════════════════════════════════════════════════════════════════════════════
 */

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

interface SubmitPayload {
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
}
