import type { BangDeXuat, TaiKhoan, Prisma } from '../../../generated/prisma';
import type { ProposalType } from '../../../constants/proposalTypes.constants';

/** Proposal ID (bang_de_xuat.id). */
export type ProposalId = BangDeXuat['id'];
/** Admin account ID (tai_khoan.id). */
export type AdminAccountId = TaiKhoan['id'];

/** Loaded proposal with relational includes used across the approve pipeline. */
export type LoadedProposal = BangDeXuat & {
  CoQuanDonVi: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
  DonViTrucThuoc: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    CoQuanDonVi: { id: string; ten_don_vi: string; ma_don_vi: string } | null;
  } | null;
  NguoiDeXuat: {
    id: string;
    username: string;
    role: string;
    QuanNhan: { id: string; ho_ten: string | null } | null;
  } | null;
  NguoiDuyet: {
    id: string;
    username: string;
    role: string;
    QuanNhan: { id: string; ho_ten: string | null } | null;
  } | null;
};

/** Prisma transactional client used inside `prisma.$transaction(async tx => ...)`. */
export type PrismaTx = Prisma.TransactionClient;

/** Map a decision metadata key to its resolved decision number + pdf path. */
export type DecisionInfo = { so_quyet_dinh?: string | null; file_pdf?: string | null };

export type DecisionInputMap = Record<string, string | null | undefined>;

export type UploadedDecisionFile = {
  buffer: Buffer;
  originalname: string;
};

export interface ProposalContext {
  proposal: LoadedProposal;
  proposalId: ProposalId;
  adminId: AdminAccountId;
  proposalYear: number;
  proposalType: ProposalType;
  refDate: Date;
  ghiChu: string | null;
  personnelHoTenMap: Map<string, string>;
}

export interface ImportAccumulator {
  importedDanhHieu: number;
  importedThanhTich: number;
  importedNienHan: number;
  errors: string[];
  affectedPersonnelIds: Set<string>;
  affectedUnitIds: Set<string>;
}

export interface DecisionMappings {
  decisionMapping: Record<string, DecisionInfo>;
  specialDecisionMapping: Record<string, DecisionInfo>;
  pdfPaths: Record<string, string | undefined>;
}
