import { prisma } from '../../models';
import { promises as fs } from 'fs';
import {
  calculateServiceMonths,
  formatServiceDuration,
  buildCutoffDate,
} from '../../helpers/serviceYearsHelper';
import path from 'path';
import type { BangDeXuat, TaiKhoan, Prisma } from '../../generated/prisma';
import {
  PROPOSAL_TYPES,
  requiresProposalMonth,
  type ProposalType,
} from '../../constants/proposalTypes.constants';
import profileService from '../profile.service';
import unitAnnualAwardService from '../unitAnnualAward.service';
import {
  CONG_HIEN_HE_SO_GROUPS,
  getDanhHieuName,
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_CA_NHAN_CO_BAN,
  DANH_HIEU_CA_NHAN_BANG_KHEN,
  DANH_HIEU_CA_NHAN_KHAC,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_DON_VI_BANG_KHEN,
  DANH_HIEU_HCCSVV,
  DANH_HIEU_HCBVTQ,
  resolveNckhCode,
} from '../../constants/danhHieu.constants';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { validateHCCSVVRankOrder } from '../../helpers/hccsvvRankOrderValidation';
import { validateHCBVTQHighestRank } from '../../helpers/hcbvtqHighestRankValidation';
import { buildApproveSummaryMessage } from '../../helpers/awardSummaryMessage';
import { sanitizeFilename } from './helpers';
import {
  checkDuplicateAward,
  checkDuplicateUnitAward,
  collectDuplicateCaNhanPayload,
  collectDuplicateDonViPayload,
  DUPLICATE_IN_PAYLOAD_ERROR,
  findInvalidDanhHieu,
  INVALID_DANH_HIEU_ERROR,
  MIXED_CA_NHAN_HANG_NAM_ERROR,
  MIXED_DON_VI_HANG_NAM_ERROR,
} from './validation';
import { validateDecisionNumbers } from '../eligibility/decisionNumberValidation';
import { collectPersonnelDuplicateErrors } from '../eligibility/personnelDuplicateCheck';
import type { PositionMonthsByGroup } from '../eligibility/congHienMonthsAggregator';
import {
  evaluateHCBVTQRank,
  getMonthsByGroup,
  loadHCBVTQEvaluationContext,
  requiredCongHienMonths,
} from '../eligibility/hcbvtqEligibility';
import {
  batchEvaluateServiceYears,
  buildServiceYearsErrorMessage,
} from '../eligibility/serviceYearsEligibility';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { ELIGIBILITY_STATUS } from '../../constants/eligibilityStatus.constants';
import { writeSystemLog } from '../../helpers/systemLogHelper';
import { GENDER } from '../../constants/gender.constants';

/** Converts optional proposal JSON fields to an object array. */
function asJsonObjectArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

/** Proposal ID (bang_de_xuat.id). */
type ProposalId = BangDeXuat['id'];
/** Admin account ID (tai_khoan.id). */
type AdminAccountId = TaiKhoan['id'];

/**
 * Edited payload mapped to BangDeXuat JSON columns.
 * Elements are business JSON objects and are not strictly typed at DB level.
 */
export type EditedProposalPayload = {
  data_danh_hieu?: any[] | null;
  data_thanh_tich?: any[] | null;
  data_nien_han?: any[] | null;
  data_cong_hien?: any[] | null;
};

type DecisionInputMap = Record<string, string | null | undefined>;
type UploadedDecisionFile = {
  buffer: Buffer;
  originalname: string;
};

const PROPOSAL_APPROVE_TX_TIMEOUT_MS = 60000;

/** Loaded proposal with relational includes used across the approve pipeline. */
type LoadedProposal = NonNullable<
  Awaited<ReturnType<typeof loadApproveProposal>>
>;

/** Prisma transactional client used inside `prisma.$transaction(async tx => ...)`. */
type PrismaTx = Prisma.TransactionClient;

/** Map a decision metadata key to its resolved decision number + pdf path. */
type DecisionInfo = { so_quyet_dinh?: string | null; file_pdf?: string | null };

interface ProposalContext {
  proposal: LoadedProposal;
  proposalId: ProposalId;
  adminId: AdminAccountId;
  proposalYear: number;
  proposalType: ProposalType;
  refDate: Date;
  ghiChu: string | null;
  personnelHoTenMap: Map<string, string>;
}

interface ImportAccumulator {
  importedDanhHieu: number;
  importedThanhTich: number;
  importedNienHan: number;
  errors: string[];
  affectedPersonnelIds: Set<string>;
  affectedUnitIds: Set<string>;
}

interface DecisionMappings {
  decisionMapping: Record<string, DecisionInfo>;
  specialDecisionMapping: Record<string, DecisionInfo>;
  pdfPaths: Record<string, string | undefined>;
}

/** Loads the proposal with all relations required by the approve pipeline. */
async function loadApproveProposal(proposalId: ProposalId) {
  return prisma.bangDeXuat.findUnique({
    where: { id: proposalId },
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: { include: { CoQuanDonVi: true } },
      NguoiDeXuat: {
        select: { id: true, username: true, role: true, QuanNhan: { select: { id: true, ho_ten: true } } },
      },
      NguoiDuyet: {
        select: { id: true, username: true, role: true, QuanNhan: { select: { id: true, ho_ten: true } } },
      },
    },
  });
}

/** Throws if the proposal is already approved. */
function validateApproveStatus(proposal: LoadedProposal): void {
  if (proposal.status === PROPOSAL_STATUS.APPROVED) {
    throw new ValidationError('Đề xuất này đã được phê duyệt trước đó');
  }
}

/** Throws if proposal type requires a month and the stored month is missing/invalid. */
function validateApproveMonth(proposal: LoadedProposal): void {
  if (
    requiresProposalMonth(proposal.loai_de_xuat as ProposalType) &&
    (proposal.thang == null || proposal.thang < 1 || proposal.thang > 12)
  ) {
    throw new ValidationError(
      'Đề xuất thiếu tháng. HCCSVV/HCQKQT/KNC bắt buộc có tháng (1-12) trước khi phê duyệt.'
    );
  }
}

/** Builds a personnel id -> ho_ten map for items referenced in the proposal payload. */
async function buildPersonnelHoTenMap(
  danhHieuData: any[],
  nienHanData: any[],
  thanhTichData: any[]
): Promise<Map<string, string>> {
  const allItemPersonnelIds = [
    ...(danhHieuData ?? []).map((i: { personnel_id?: string }) => i.personnel_id),
    ...(nienHanData ?? []).map((i: { personnel_id?: string }) => i.personnel_id),
    ...(thanhTichData ?? []).map((i: { personnel_id?: string }) => i.personnel_id),
  ].filter((id): id is string => Boolean(id));

  const personnelHoTenList =
    allItemPersonnelIds.length > 0
      ? await prisma.quanNhan.findMany({
          where: { id: { in: allItemPersonnelIds } },
          select: { id: true, ho_ten: true },
        })
      : [];
  return new Map(personnelHoTenList.map(p => [p.id, p.ho_ten]));
}

/** Collects "duplicate award" errors for personal annual proposals. */
async function collectCaNhanHangNamDuplicates(
  ctx: ProposalContext,
  danhHieuData: any[]
): Promise<string[]> {
  const errors: string[] = [];
  const { proposalId, proposalYear, proposalType, personnelHoTenMap } = ctx;

  const selectedDanhHieu = danhHieuData.map(item => item.danh_hieu).filter(Boolean);
  const validCaNhanDanhHieu = new Set<string>(Object.values(DANH_HIEU_CA_NHAN_HANG_NAM));
  const invalidDanhHieu = findInvalidDanhHieu(selectedDanhHieu, validCaNhanDanhHieu);
  if (invalidDanhHieu.length > 0) {
    throw new ValidationError(`${INVALID_DANH_HIEU_ERROR}\n${invalidDanhHieu.join(', ')}`);
  }
  const duplicatePayloadItems = collectDuplicateCaNhanPayload(
    danhHieuData,
    personnelId => personnelHoTenMap.get(personnelId) || personnelId
  );
  if (duplicatePayloadItems.length > 0) {
    throw new ValidationError(
      `${DUPLICATE_IN_PAYLOAD_ERROR}\n${duplicatePayloadItems.join('\n')}`
    );
  }
  const hasChinh = selectedDanhHieu.some(danhHieu => DANH_HIEU_CA_NHAN_CO_BAN.has(danhHieu));
  const hasNhomChuoi = selectedDanhHieu.some(danhHieu =>
    [
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
    ].includes(danhHieu)
  );
  if (hasChinh && hasNhomChuoi) {
    throw new ValidationError(MIXED_CA_NHAN_HANG_NAM_ERROR);
  }

  const validItems = danhHieuData.filter(item => item.personnel_id && item.danh_hieu);
  const promises = await Promise.all(
    validItems.flatMap(item => {
      const hoTen = personnelHoTenMap.get(item.personnel_id) || item.personnel_id;
      const isMutuallyExclusive =
        item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTT ||
        item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS;
      const opposite =
        item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTT
          ? DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS
          : DANH_HIEU_CA_NHAN_HANG_NAM.CSTT;
      return [
        checkDuplicateAward(
          item.personnel_id,
          proposalYear,
          item.danh_hieu,
          proposalType,
          PROPOSAL_STATUS.APPROVED,
          proposalId
        ).then(r => (r.exists ? `${hoTen}: ${r.message}` : null)),
        ...(isMutuallyExclusive
          ? [
              checkDuplicateAward(
                item.personnel_id,
                proposalYear,
                opposite,
                proposalType,
                PROPOSAL_STATUS.APPROVED,
                proposalId
              ).then(r => (r.exists ? `${hoTen}: ${r.message}` : null)),
            ]
          : []),
      ];
    })
  );
  promises.filter(Boolean).forEach(err => errors.push(err as string));
  return errors;
}

/** Collects "duplicate award" errors for unit annual proposals. */
async function collectDonViHangNamDuplicates(
  ctx: ProposalContext,
  danhHieuData: any[]
): Promise<string[]> {
  const errors: string[] = [];
  const { proposalYear, proposalType } = ctx;

  const selectedDanhHieu = danhHieuData.map(item => item.danh_hieu).filter(Boolean);
  const validDonViDanhHieu = new Set<string>(Object.values(DANH_HIEU_DON_VI_HANG_NAM));
  const invalidDanhHieu = findInvalidDanhHieu(selectedDanhHieu, validDonViDanhHieu);
  if (invalidDanhHieu.length > 0) {
    throw new ValidationError(`${INVALID_DANH_HIEU_ERROR}\n${invalidDanhHieu.join(', ')}`);
  }
  const duplicatePayloadItems = collectDuplicateDonViPayload(danhHieuData);
  if (duplicatePayloadItems.length > 0) {
    throw new ValidationError(
      `${DUPLICATE_IN_PAYLOAD_ERROR}\n${duplicatePayloadItems.join('\n')}`
    );
  }
  const hasDanhHieuDonVi = selectedDanhHieu.some(danhHieu =>
    [DANH_HIEU_DON_VI_HANG_NAM.DVQT, DANH_HIEU_DON_VI_HANG_NAM.DVTT].includes(danhHieu)
  );
  const hasBangKhenDonVi = selectedDanhHieu.some(danhHieu =>
    [DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP, DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP].includes(danhHieu)
  );
  if (hasDanhHieuDonVi && hasBangKhenDonVi) {
    throw new ValidationError(MIXED_DON_VI_HANG_NAM_ERROR);
  }

  const validUnitItems = danhHieuData.filter(item => item.don_vi_id && item.danh_hieu);
  const unitDuplicateErrors = await Promise.all(
    validUnitItems.map(item =>
      checkDuplicateUnitAward(item.don_vi_id, proposalYear, item.danh_hieu, proposalType).then(r =>
        r.exists ? `${item.ten_don_vi || item.don_vi_id}: ${r.message}` : null
      )
    )
  );
  unitDuplicateErrors.filter(Boolean).forEach(err => errors.push(err as string));
  return errors;
}

/** Collects NCKH duplicates by (personnel_id, nam, mo_ta) key. */
async function collectNckhDuplicates(
  ctx: ProposalContext,
  thanhTichData: any[]
): Promise<string[]> {
  const errors: string[] = [];
  const validItems = thanhTichData.filter(item => item.personnel_id && item.nam && item.mo_ta);
  if (validItems.length === 0) return errors;

  const nckhPersonnelIds = [...new Set(validItems.map(item => item.personnel_id))];
  const existingNckh = await prisma.thanhTichKhoaHoc.findMany({
    where: { quan_nhan_id: { in: nckhPersonnelIds } },
    select: { quan_nhan_id: true, nam: true, mo_ta: true },
  });
  const existingKeys = new Set(existingNckh.map(r => `${r.quan_nhan_id}_${r.nam}_${r.mo_ta}`));
  for (const item of validItems) {
    const key = `${item.personnel_id}_${item.nam}_${item.mo_ta}`;
    if (existingKeys.has(key)) {
      const hoTen = ctx.personnelHoTenMap.get(item.personnel_id) || item.personnel_id;
      errors.push(`${hoTen}: Thành tích "${item.mo_ta}" năm ${item.nam} đã tồn tại`);
    }
  }
  return errors;
}

/**
 * Runs duplicate detection across all proposal types and throws if any are found.
 * @param ctx - Proposal context
 * @param danhHieuData - Edited danh_hieu items
 * @param nienHanData - Edited nien_han items
 * @param thanhTichData - Edited thanh_tich items
 */
async function runDuplicateChecks(
  ctx: ProposalContext,
  danhHieuData: any[],
  nienHanData: any[],
  thanhTichData: any[]
): Promise<void> {
  const { proposalId, proposalYear, proposalType, personnelHoTenMap } = ctx;
  const duplicateErrors: string[] = [];

  if (proposalType === PROPOSAL_TYPES.CA_NHAN_HANG_NAM && danhHieuData && danhHieuData.length > 0) {
    duplicateErrors.push(...(await collectCaNhanHangNamDuplicates(ctx, danhHieuData)));
  }

  if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM && danhHieuData && danhHieuData.length > 0) {
    duplicateErrors.push(...(await collectDonViHangNamDuplicates(ctx, danhHieuData)));
  }

  if (
    (proposalType === PROPOSAL_TYPES.NIEN_HAN ||
      proposalType === PROPOSAL_TYPES.HC_QKQT ||
      proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) &&
    nienHanData &&
    nienHanData.length > 0
  ) {
    const errors = await collectPersonnelDuplicateErrors(nienHanData, proposalYear, proposalType, {
      status: PROPOSAL_STATUS.APPROVED,
      excludeProposalId: proposalId,
      hoTenMap: personnelHoTenMap,
    });
    duplicateErrors.push(...errors);
  }

  if (proposalType === PROPOSAL_TYPES.CONG_HIEN && nienHanData && nienHanData.length > 0) {
    const errors = await collectPersonnelDuplicateErrors(nienHanData, proposalYear, proposalType, {
      status: null,
      excludeProposalId: proposalId,
      hoTenMap: personnelHoTenMap,
    });
    duplicateErrors.push(...errors);
  }

  if (proposalType === PROPOSAL_TYPES.NCKH && thanhTichData && thanhTichData.length > 0) {
    duplicateErrors.push(...(await collectNckhDuplicates(ctx, thanhTichData)));
  }

  if (duplicateErrors.length > 0) {
    throw new ValidationError(
      `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${duplicateErrors.join('\n')}`
    );
  }
}

/** Collects HC_QKQT eligibility errors (>= 25 years of service). */
async function collectHCQKQTEligibilityErrors(
  ctx: ProposalContext,
  nienHanData: any[]
): Promise<string[]> {
  const personnelIds = nienHanData.map(item => item.personnel_id).filter(Boolean);
  const results = await batchEvaluateServiceYears(personnelIds, 'HC_QKQT', ctx.refDate);
  return results
    .map(r => buildServiceYearsErrorMessage(r, 'HC_QKQT'))
    .filter((m): m is string => m !== null);
}

/** Collects KNC VSNXD QDNDVN eligibility errors (gender-aware service length). */
async function collectKNCEligibilityErrors(
  ctx: ProposalContext,
  nienHanData: any[]
): Promise<string[]> {
  const personnelIds = nienHanData.map(item => item.personnel_id).filter(Boolean);
  const results = await batchEvaluateServiceYears(personnelIds, 'KNC_VSNXD_QDNDVN', ctx.refDate);
  return results
    .map(r => buildServiceYearsErrorMessage(r, 'KNC_VSNXD_QDNDVN'))
    .filter((m): m is string => m !== null);
}

/** Collects HC BVTQ contribution eligibility errors (rank vs accumulated months). */
async function collectCongHienEligibilityErrors(
  ctx: ProposalContext,
  congHienData: any[]
): Promise<string[]> {
  const errors: string[] = [];
  const personnelIds = congHienData.map(item => item.personnel_id).filter(Boolean);
  const cutoffDate = buildCutoffDate(ctx.proposal.nam, ctx.proposal.thang);
  const evalCtx = await loadHCBVTQEvaluationContext(personnelIds, cutoffDate);

  for (const item of congHienData) {
    if (!item.danh_hieu || !item.personnel_id) continue;
    const hoTen = evalCtx.hoTenByPersonnel.get(item.personnel_id) || item.personnel_id;
    const gioiTinh = evalCtx.genderByPersonnel.get(item.personnel_id) ?? null;
    const requiredMonths = requiredCongHienMonths(gioiTinh);
    const months: PositionMonthsByGroup = {
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_07]: getMonthsByGroup(
        evalCtx,
        item.personnel_id,
        CONG_HIEN_HE_SO_GROUPS.LEVEL_07
      ),
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_08]: getMonthsByGroup(
        evalCtx,
        item.personnel_id,
        CONG_HIEN_HE_SO_GROUPS.LEVEL_08
      ),
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: getMonthsByGroup(
        evalCtx,
        item.personnel_id,
        CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10
      ),
    };

    const downgradeError = validateHCBVTQHighestRank(item.danh_hieu, months, requiredMonths);
    if (downgradeError) {
      errors.push(`${hoTen}: ${downgradeError}`);
      continue;
    }

    const result = evaluateHCBVTQRank(item.danh_hieu, months, gioiTinh);
    if (!result.rank) continue;
    if (!result.eligible) {
      const totalYearsText = formatServiceDuration(result.totalMonths);
      const requiredYearsText = formatServiceDuration(result.requiredMonths);
      const genderText = gioiTinh === GENDER.FEMALE ? ' (Nữ giảm 1/3 thời gian)' : '';
      errors.push(
        `${hoTen}: Không đủ điều kiện Huân chương Bảo vệ Tổ quốc ${result.rankName}. ` +
          `Yêu cầu: ${requiredYearsText}${genderText}. Hiện tại: ${totalYearsText}.`
      );
    }
  }
  return errors;
}

/** Collects chain-award eligibility errors for personal annual proposals. */
async function collectCaNhanChainEligibilityErrors(
  ctx: ProposalContext,
  danhHieuData: any[]
): Promise<string[]> {
  const errors: string[] = [];
  for (const item of danhHieuData) {
    if (!item.personnel_id || !item.danh_hieu) continue;
    if (!DANH_HIEU_CA_NHAN_BANG_KHEN.has(item.danh_hieu)) continue;
    const eligibility = await profileService.checkAwardEligibility(
      item.personnel_id,
      ctx.proposalYear,
      item.danh_hieu
    );
    if (!eligibility.eligible) {
      const hoTen = ctx.personnelHoTenMap.get(item.personnel_id) || item.personnel_id;
      errors.push(`${hoTen}: ${eligibility.reason}`);
    }
  }
  return errors;
}

/** Collects chain-award eligibility errors for unit annual proposals. */
async function collectDonViChainEligibilityErrors(
  ctx: ProposalContext,
  danhHieuData: any[]
): Promise<string[]> {
  const errors: string[] = [];
  for (const item of danhHieuData) {
    if (!item.don_vi_id || !item.danh_hieu) continue;
    if (!DANH_HIEU_DON_VI_BANG_KHEN.has(item.danh_hieu)) continue;
    const eligibility = await unitAnnualAwardService.checkUnitAwardEligibility(
      item.don_vi_id,
      ctx.proposalYear,
      item.danh_hieu
    );
    if (!eligibility.eligible) {
      const tenDonVi = item.ten_don_vi || item.don_vi_id;
      errors.push(`${tenDonVi}: ${eligibility.reason}`);
    }
  }
  return errors;
}

/**
 * Re-runs eligibility rules across all proposal types and throws on failure.
 * @param ctx - Proposal context
 * @param danhHieuData - Edited danh_hieu items
 * @param nienHanData - Edited nien_han items
 * @param congHienData - Edited cong_hien items
 */
async function runEligibilityChecks(
  ctx: ProposalContext,
  danhHieuData: any[],
  nienHanData: any[],
  congHienData: any[]
): Promise<void> {
  const { proposalType } = ctx;
  const errors: string[] = [];

  if (proposalType === PROPOSAL_TYPES.HC_QKQT && nienHanData && nienHanData.length > 0) {
    errors.push(...(await collectHCQKQTEligibilityErrors(ctx, nienHanData)));
  }
  if (proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN && nienHanData && nienHanData.length > 0) {
    errors.push(...(await collectKNCEligibilityErrors(ctx, nienHanData)));
  }
  if (proposalType === PROPOSAL_TYPES.CONG_HIEN && congHienData && congHienData.length > 0) {
    errors.push(...(await collectCongHienEligibilityErrors(ctx, congHienData)));
  }
  if (proposalType === PROPOSAL_TYPES.CA_NHAN_HANG_NAM && danhHieuData && danhHieuData.length > 0) {
    errors.push(...(await collectCaNhanChainEligibilityErrors(ctx, danhHieuData)));
  }
  if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM && danhHieuData && danhHieuData.length > 0) {
    errors.push(...(await collectDonViChainEligibilityErrors(ctx, danhHieuData)));
  }

  if (errors.length > 0) {
    throw new ValidationError(
      `Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n${errors.join('\n')}`
    );
  }
}

/**
 * Validates required decision numbers per saved flag/danh_hieu and throws if any are missing.
 * @param ctx - Proposal context
 * @param danhHieuData - Edited danh_hieu items
 * @param decisions - Top-level decision number map
 */
function runDecisionNumberChecks(
  ctx: ProposalContext,
  danhHieuData: any[],
  decisions: DecisionInputMap
): void {
  const { proposalType, personnelHoTenMap } = ctx;
  const decisionErrors: string[] = [];

  if (proposalType === PROPOSAL_TYPES.CA_NHAN_HANG_NAM && danhHieuData && danhHieuData.length > 0) {
    for (const item of danhHieuData) {
      if (!item.personnel_id || !item.danh_hieu) continue;
      const isBkbqp = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP || item.nhan_bkbqp;
      const isCstdtq = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ || item.nhan_cstdtq;
      const isBkttcp = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP || item.nhan_bkttcp;
      const isCoBan = DANH_HIEU_CA_NHAN_CO_BAN.has(item.danh_hieu);
      const sqdCoBan =
        item.so_quyet_dinh ||
        (item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS ? decisions.so_quyet_dinh_cstdcs : null) ||
        (item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTT ? decisions.so_quyet_dinh_cstt : null);
      const sqdBkbqp = item.so_quyet_dinh_bkbqp || decisions.so_quyet_dinh_bkbqp || item.so_quyet_dinh;
      const sqdCstdtq = item.so_quyet_dinh_cstdtq || decisions.so_quyet_dinh_cstdtq || item.so_quyet_dinh;
      const sqdBkttcp = item.so_quyet_dinh_bkttcp || decisions.so_quyet_dinh_bkttcp || item.so_quyet_dinh;
      const hoTen = personnelHoTenMap.get(item.personnel_id) || item.ho_ten || item.personnel_id;

      const errs = validateDecisionNumbers(
        {
          danh_hieu: isCoBan ? item.danh_hieu : null,
          so_quyet_dinh: isCoBan ? sqdCoBan : null,
          nhan_bkbqp: !!isBkbqp,
          so_quyet_dinh_bkbqp: isBkbqp ? sqdBkbqp : null,
          nhan_cstdtq: !!isCstdtq,
          so_quyet_dinh_cstdtq: isCstdtq ? sqdCstdtq : null,
          nhan_bkttcp: !!isBkttcp,
          so_quyet_dinh_bkttcp: isBkttcp ? sqdBkttcp : null,
        },
        { entityType: 'personal', entityName: hoTen }
      );
      decisionErrors.push(...errs);
    }
  }

  if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM && danhHieuData && danhHieuData.length > 0) {
    for (const item of danhHieuData) {
      if (!item.don_vi_id || !item.danh_hieu) continue;
      const isBkbqp = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP || item.nhan_bkbqp;
      const isBkttcp = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP || item.nhan_bkttcp;
      const isCoBan =
        item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVQT ||
        item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVTT;
      const sqdCoBan = item.so_quyet_dinh || decisions.so_quyet_dinh_don_vi_hang_nam;
      const sqdBkbqp = item.so_quyet_dinh_bkbqp || decisions.so_quyet_dinh_bkbqp || item.so_quyet_dinh;
      const sqdBkttcp = item.so_quyet_dinh_bkttcp || decisions.so_quyet_dinh_bkttcp || item.so_quyet_dinh;
      const tenDonVi = item.ten_don_vi || item.don_vi_id;

      const errs = validateDecisionNumbers(
        {
          danh_hieu: isCoBan ? item.danh_hieu : null,
          so_quyet_dinh: isCoBan ? sqdCoBan : null,
          nhan_bkbqp: !!isBkbqp,
          so_quyet_dinh_bkbqp: isBkbqp ? sqdBkbqp : null,
          nhan_bkttcp: !!isBkttcp,
          so_quyet_dinh_bkttcp: isBkttcp ? sqdBkttcp : null,
        },
        { entityType: 'unit', entityName: tenDonVi }
      );
      decisionErrors.push(...errs);
    }
  }

  if (decisionErrors.length > 0) {
    throw new ValidationError(
      `Thiếu số quyết định trước khi phê duyệt:\n${decisionErrors.join('\n')}`
    );
  }
}

/**
 * Persists uploaded decision PDFs and returns a key -> file path map.
 * Re-uses existing file paths when a decision number already has a stored PDF.
 */
async function persistDecisionPdfs(
  decisions: DecisionInputMap,
  pdfFiles: Record<string, UploadedDecisionFile | undefined>
): Promise<Record<string, string | undefined>> {
  const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'decisions');
  await fs.mkdir(uploadsDir, { recursive: true });
  const pdfPaths: Record<string, string | undefined> = {};

  const getUniqueFilename = async (originalName: string | Buffer | undefined) => {
    let processedName: string = (originalName as string) || 'file';
    try {
      if (Buffer.isBuffer(processedName)) {
        processedName = (processedName as Buffer).toString('utf8');
      } else if (typeof processedName === 'string') {
        processedName = Buffer.from(processedName, 'latin1').toString('utf8');
      }
    } catch {
      processedName = 'file';
    }
    const sanitized = sanitizeFilename(processedName);
    const ext = path.extname(sanitized);
    const baseName = path.basename(sanitized, ext);
    let filename = sanitized;
    let counter = 1;
    while (
      await fs
        .access(path.join(uploadsDir, filename))
        .then(() => true)
        .catch(() => false)
    ) {
      filename = `${baseName}(${counter})${ext}`;
      counter++;
    }
    return filename;
  };

  const getFilePathFromDB = async (soQuyetDinh: string | null | undefined) => {
    if (!soQuyetDinh) return null;
    try {
      const decision = await prisma.fileQuyetDinh.findUnique({
        where: { so_quyet_dinh: soQuyetDinh },
        select: { file_path: true },
      });
      return decision?.file_path || null;
    } catch (error) {
      console.error('ProposalApprove.getFilePathFromDB failed', { soQuyetDinh, error });
      return null;
    }
  };

  const pdfFileToDecisionMap: Record<string, string | null | undefined> = {
    file_pdf_ca_nhan_hang_nam: decisions.so_quyet_dinh_ca_nhan_hang_nam,
    file_pdf_don_vi_hang_nam: decisions.so_quyet_dinh_don_vi_hang_nam,
    file_pdf_nien_han: decisions.so_quyet_dinh_nien_han,
    file_pdf_cong_hien: decisions.so_quyet_dinh_cong_hien,
    file_pdf_dot_xuat: decisions.so_quyet_dinh_dot_xuat,
    file_pdf_nckh: decisions.so_quyet_dinh_nckh,
  };

  for (const [key, file] of Object.entries(pdfFiles)) {
    if (file && file.buffer) {
      const soQuyetDinh = pdfFileToDecisionMap[key];
      const existingFilePath = await getFilePathFromDB(soQuyetDinh);
      if (existingFilePath) {
        pdfPaths[key] = existingFilePath;
      } else {
        const filename = await getUniqueFilename(file.originalname);
        const filepath = path.join(uploadsDir, filename);
        await fs.writeFile(filepath, file.buffer);
        pdfPaths[key] = `uploads/decisions/${filename}`;
      }
    }
  }

  return pdfPaths;
}

/** Builds award/title -> decision metadata maps used during DB import. */
function buildDecisionMappings(
  decisions: DecisionInputMap,
  pdfPaths: Record<string, string | undefined>
): { decisionMapping: Record<string, DecisionInfo>; specialDecisionMapping: Record<string, DecisionInfo> } {
  const decisionMapping: Record<string, DecisionInfo> = {
    [DANH_HIEU_CA_NHAN_HANG_NAM.CSTT]: {
      so_quyet_dinh: decisions.so_quyet_dinh_cstt,
      file_pdf: pdfPaths.file_pdf_ca_nhan_hang_nam,
    },
    [DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS]: {
      so_quyet_dinh: decisions.so_quyet_dinh_cstdcs,
      file_pdf: pdfPaths.file_pdf_ca_nhan_hang_nam,
    },
    [DANH_HIEU_DON_VI_HANG_NAM.DVQT]: {
      so_quyet_dinh: decisions.so_quyet_dinh_don_vi_hang_nam,
      file_pdf: pdfPaths.file_pdf_don_vi_hang_nam,
    },
    [DANH_HIEU_DON_VI_HANG_NAM.DVTT]: {
      so_quyet_dinh: decisions.so_quyet_dinh_don_vi_hang_nam,
      file_pdf: pdfPaths.file_pdf_don_vi_hang_nam,
    },
    [DANH_HIEU_HCCSVV.HANG_BA]: {
      so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
      file_pdf: pdfPaths.file_pdf_nien_han,
    },
    [DANH_HIEU_HCCSVV.HANG_NHI]: {
      so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
      file_pdf: pdfPaths.file_pdf_nien_han,
    },
    [DANH_HIEU_HCCSVV.HANG_NHAT]: {
      so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
      file_pdf: pdfPaths.file_pdf_nien_han,
    },
    [DANH_HIEU_CA_NHAN_KHAC.HC_QKQT]: {
      so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
      file_pdf: pdfPaths.file_pdf_nien_han,
    },
    [DANH_HIEU_CA_NHAN_KHAC.KNC_VSNXD_QDNDVN]: {
      so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
      file_pdf: pdfPaths.file_pdf_nien_han,
    },
  };

  const specialDecisionMapping: Record<string, DecisionInfo> = {
    [DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP]: {
      so_quyet_dinh: decisions.so_quyet_dinh_bkbqp,
      file_pdf: pdfPaths.file_pdf_ca_nhan_hang_nam,
    },
    [DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ]: {
      so_quyet_dinh: decisions.so_quyet_dinh_cstdtq,
      file_pdf: pdfPaths.file_pdf_ca_nhan_hang_nam,
    },
    [DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP]: {
      so_quyet_dinh: decisions.so_quyet_dinh_bkttcp,
      file_pdf: pdfPaths.file_pdf_ca_nhan_hang_nam,
    },
  };

  return { decisionMapping, specialDecisionMapping };
}

/** Imports DON_VI_HANG_NAM (unit annual) titles into DanhHieuDonViHangNam. */
async function importDonViHangNam(
  ctx: ProposalContext,
  danhHieuData: any[],
  mappings: DecisionMappings,
  tx: PrismaTx,
  acc: ImportAccumulator
): Promise<void> {
  const { adminId } = ctx;
  const { decisionMapping, specialDecisionMapping } = mappings;
  for (const item of danhHieuData) {
    try {
      if (!item.don_vi_id || !item.don_vi_type) {
        acc.errors.push(`Thiếu thông tin đơn vị trong dữ liệu: ${JSON.stringify(item)}`);
        continue;
      }
      const coQuanDonViId = item.don_vi_type === 'CO_QUAN_DON_VI' ? item.don_vi_id : null;
      const donViTrucThuocId = item.don_vi_type === 'DON_VI_TRUC_THUOC' ? item.don_vi_id : null;
      const namValue = typeof item.nam === 'string' ? parseInt(item.nam, 10) : item.nam;
      if (!item.danh_hieu || item.danh_hieu.trim() === '') continue;

      const decisionInfo = decisionMapping[item.danh_hieu] || {};
      const soQuyetDinh = item.so_quyet_dinh || decisionInfo.so_quyet_dinh || null;

      const isBkbqp = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP || item.nhan_bkbqp;
      const isBkttcp = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP || item.nhan_bkttcp;
      // Do not fall back to item.so_quyet_dinh — that field belongs to DVQT/DVTT,
      // mixing it into BKBQP/BKTTCP would persist the wrong decision number.
      const soQuyetDinhBKBQP =
        item.so_quyet_dinh_bkbqp ||
        (isBkbqp ? (specialDecisionMapping.BKBQP?.so_quyet_dinh ?? null) : null);
      const soQuyetDinhBKTTCP =
        item.so_quyet_dinh_bkttcp ||
        (isBkttcp ? (specialDecisionMapping.BKTTCP?.so_quyet_dinh ?? null) : null);

      const whereCondition = {
        nam: namValue,
        OR: [
          ...(coQuanDonViId ? [{ co_quan_don_vi_id: coQuanDonViId }] : []),
          ...(donViTrucThuocId ? [{ don_vi_truc_thuoc_id: donViTrucThuocId }] : []),
        ],
      };

      const existingAward = await tx.danhHieuDonViHangNam.findFirst({ where: whereCondition });
      const data: Record<string, unknown> = {};
      if (
        item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVQT ||
        item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVTT
      ) {
        data.danh_hieu = item.danh_hieu;
        data.so_quyet_dinh = soQuyetDinh;
      }
      if (isBkbqp) {
        data.nhan_bkbqp = true;
        data.so_quyet_dinh_bkbqp = soQuyetDinhBKBQP;
      }
      if (isBkttcp) {
        data.nhan_bkttcp = true;
        data.so_quyet_dinh_bkttcp = soQuyetDinhBKTTCP;
      }
      data.status = PROPOSAL_STATUS.APPROVED;
      data.nguoi_duyet_id = adminId;
      data.ngay_duyet = new Date();
      data.ghi_chu = item.ghi_chu || null;

      if (existingAward) {
        await tx.danhHieuDonViHangNam.update({ where: { id: existingAward.id }, data });
      } else {
        await tx.danhHieuDonViHangNam.create({
          data: {
            ...(coQuanDonViId && { CoQuanDonVi: { connect: { id: coQuanDonViId } } }),
            ...(donViTrucThuocId && { DonViTrucThuoc: { connect: { id: donViTrucThuocId } } }),
            nam: namValue,
            danh_hieu:
              item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVQT ||
              item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVTT
                ? item.danh_hieu
                : null,
            so_quyet_dinh:
              item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVQT ||
              item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVTT
                ? soQuyetDinh
                : null,
            nhan_bkbqp: isBkbqp,
            so_quyet_dinh_bkbqp: soQuyetDinhBKBQP,
            nhan_bkttcp: isBkttcp,
            so_quyet_dinh_bkttcp: soQuyetDinhBKTTCP,
            status: PROPOSAL_STATUS.APPROVED,
            nguoi_tao_id: adminId,
            nguoi_duyet_id: adminId,
            ngay_duyet: new Date(),
            ghi_chu: item.ghi_chu || null,
          },
        });
      }
      acc.importedDanhHieu++;
      acc.affectedUnitIds.add(item.don_vi_id);
    } catch (error) {
      console.error('[approveProposal] unit award error:', error);
      acc.errors.push(
        `Lỗi import khen thưởng đơn vị ${item.ten_don_vi || item.don_vi_id}: ${(error as Error).message}`
      );
    }
  }
}

/** Imports CONG_HIEN proposals into KhenThuongHCBVTQ + HoSoCongHien profile. */
async function importCongHien(
  ctx: ProposalContext,
  congHienData: any[],
  decisions: DecisionInputMap,
  tx: PrismaTx,
  acc: ImportAccumulator
): Promise<void> {
  const { proposal } = ctx;
  for (const item of congHienData) {
    try {
      if (!item.personnel_id) {
        acc.errors.push(`Thiếu personnel_id trong dữ liệu danh hiệu: ${JSON.stringify(item)}`);
        continue;
      }
      const quanNhan = await tx.quanNhan.findUnique({ where: { id: item.personnel_id } });
      if (!quanNhan) {
        acc.errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
        continue;
      }

      const soQuyetDinhDanhHieu = item.so_quyet_dinh || decisions.so_quyet_dinh_cong_hien || null;
      const namNhan = item.nam_nhan;
      const thangNhan = item.thang_nhan;
      const proposalYear = proposal.nam;
      const proposalMonth = proposal.thang;

      if (!namNhan || !thangNhan || thangNhan < 1 || thangNhan > 12) {
        acc.errors.push(
          `Quân nhân ${quanNhan.ho_ten || quanNhan.id} thiếu tháng/năm nhận Huân chương Bảo vệ Tổ quốc`
        );
        continue;
      }
      if (
        namNhan < proposalYear ||
        (proposalMonth != null && namNhan === proposalYear && thangNhan < proposalMonth)
      ) {
        acc.errors.push(
          `Quân nhân ${quanNhan.ho_ten || quanNhan.id}: tháng/năm nhận (${thangNhan}/${namNhan}) không được trước tháng/năm đề xuất (${proposalMonth || '--'}/${proposalYear})`
        );
        continue;
      }
      const namQuyetDinh = item.nam_quyet_dinh;
      const thangQuyetDinh = item.thang_quyet_dinh;
      if (
        namQuyetDinh &&
        (namNhan < namQuyetDinh ||
          (thangQuyetDinh && namNhan === namQuyetDinh && thangNhan < thangQuyetDinh))
      ) {
        acc.errors.push(
          `Quân nhân ${quanNhan.ho_ten || quanNhan.id}: tháng/năm nhận (${thangNhan}/${namNhan}) không được trước tháng/năm quyết định (${thangQuyetDinh || '--'}/${namQuyetDinh})`
        );
        continue;
      }

      const thoiGianNhom0_7 = item.thoi_gian_nhom_0_7 || null;
      const thoiGianNhom0_8 = item.thoi_gian_nhom_0_8 || null;
      const thoiGianNhom0_9_1_0 = item.thoi_gian_nhom_0_9_1_0 || null;

      const existingCongHien = await tx.khenThuongHCBVTQ.findUnique({
        where: { quan_nhan_id: quanNhan.id },
      });

      if (existingCongHien) {
        const rankOrder: Record<string, number> = {
          [DANH_HIEU_HCBVTQ.HANG_BA]: 1,
          [DANH_HIEU_HCBVTQ.HANG_NHI]: 2,
          [DANH_HIEU_HCBVTQ.HANG_NHAT]: 3,
        };
        const existingRank = rankOrder[existingCongHien.danh_hieu] || 0;
        const newRank = rankOrder[item.danh_hieu] || 0;
        if (newRank > existingRank) {
          await tx.khenThuongHCBVTQ.update({
            where: { id: existingCongHien.id },
            data: {
              danh_hieu: item.danh_hieu,
              nam: namNhan,
              thang: thangNhan,
              cap_bac: item.cap_bac || null,
              chuc_vu: item.chuc_vu || null,
              ghi_chu: item.ghi_chu || null,
              so_quyet_dinh: soQuyetDinhDanhHieu,
              thoi_gian_nhom_0_7: thoiGianNhom0_7,
              thoi_gian_nhom_0_8: thoiGianNhom0_8,
              thoi_gian_nhom_0_9_1_0: thoiGianNhom0_9_1_0,
            },
          });
          acc.importedDanhHieu++;
          acc.affectedPersonnelIds.add(quanNhan.id);
        } else {
          const existingDanhHieuName = getDanhHieuName(existingCongHien.danh_hieu);
          const newDanhHieuName = getDanhHieuName(item.danh_hieu);
          acc.errors.push(
            `Quân nhân "${quanNhan.ho_ten}" đã có Huân chương Bảo vệ Tổ quốc "${existingDanhHieuName}" (năm ${existingCongHien.nam}). ` +
              `Không thể lưu danh hiệu "${newDanhHieuName}" vì hạng thấp hơn hoặc bằng.`
          );
          continue;
        }
      } else {
        await tx.khenThuongHCBVTQ.create({
          data: {
            quan_nhan_id: quanNhan.id,
            danh_hieu: item.danh_hieu,
            nam: namNhan,
            thang: thangNhan,
            cap_bac: item.cap_bac || null,
            chuc_vu: item.chuc_vu || null,
            ghi_chu: item.ghi_chu || null,
            so_quyet_dinh: soQuyetDinhDanhHieu,
            thoi_gian_nhom_0_7: thoiGianNhom0_7,
            thoi_gian_nhom_0_8: thoiGianNhom0_8,
            thoi_gian_nhom_0_9_1_0: thoiGianNhom0_9_1_0,
          },
        });
        acc.importedDanhHieu++;
        acc.affectedPersonnelIds.add(quanNhan.id);
      }

      const ngayNhan = new Date(Date.UTC(namNhan, thangNhan - 1, 1));
      const HCBVTQ_FIELDS: Record<string, { status: string; ngay: string }> = {
        [DANH_HIEU_HCBVTQ.HANG_BA]: { status: 'hcbvtq_hang_ba_status', ngay: 'hcbvtq_hang_ba_ngay' },
        [DANH_HIEU_HCBVTQ.HANG_NHI]: { status: 'hcbvtq_hang_nhi_status', ngay: 'hcbvtq_hang_nhi_ngay' },
        [DANH_HIEU_HCBVTQ.HANG_NHAT]: {
          status: 'hcbvtq_hang_nhat_status',
          ngay: 'hcbvtq_hang_nhat_ngay',
        },
      };
      const profileFields = HCBVTQ_FIELDS[item.danh_hieu];
      if (profileFields) {
        const profileUpdate = {
          [profileFields.status]: ELIGIBILITY_STATUS.DA_NHAN,
          [profileFields.ngay]: ngayNhan,
        };
        await tx.hoSoCongHien.upsert({
          where: { quan_nhan_id: quanNhan.id },
          update: profileUpdate,
          create: { quan_nhan_id: quanNhan.id, hcbvtq_total_months: 0, ...profileUpdate },
        });
      }
    } catch (error) {
      console.error('[approveProposal] HCBVTQ error:', error);
      acc.errors.push(
        `Lỗi import Huân chương Bảo vệ Tổ quốc personnel_id ${item.personnel_id || ' '}: ${(error as Error).message}`
      );
    }
  }
}

/** Imports CA_NHAN_HANG_NAM / DOT_XUAT proposals into DanhHieuHangNam. */
async function importCaNhanOrDotXuat(
  ctx: ProposalContext,
  danhHieuData: any[],
  mappings: DecisionMappings,
  tx: PrismaTx,
  acc: ImportAccumulator
): Promise<void> {
  const { proposal, ghiChu } = ctx;
  const { decisionMapping, specialDecisionMapping } = mappings;
  for (const item of danhHieuData) {
    try {
      if (!item.personnel_id) {
        acc.errors.push(`Thiếu personnel_id trong dữ liệu danh hiệu: ${JSON.stringify(item)}`);
        continue;
      }
      const quanNhan = await tx.quanNhan.findUnique({ where: { id: item.personnel_id } });
      if (!quanNhan) {
        acc.errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
        continue;
      }

      const namNhan = proposal.nam;
      const danhHieuDecision = decisionMapping[item.danh_hieu] || {};
      const soQuyetDinhDanhHieu = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;

      const isBkbqp = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP;
      const isCstdtq = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ;
      const isBkttcp = item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;

      const resolveChain = (
        isMatch: boolean,
        flagKey: string,
        qdKey: string,
        fileKey: string,
        mappingKey: string
      ) => {
        const itemRecord = item as Record<string, unknown>;
        let nhan = (itemRecord[flagKey] as boolean | undefined) || isMatch;
        let soQD = (itemRecord[qdKey] as string | null | undefined) || (isMatch ? item.so_quyet_dinh : null);
        let filePdf = (itemRecord[fileKey] as string | null | undefined) || (isMatch ? item.file_quyet_dinh : null);
        if (soQD || filePdf) nhan = true;
        const mapping = specialDecisionMapping[mappingKey] || {};
        if (nhan) {
          soQD = soQD || mapping.so_quyet_dinh;
          filePdf = filePdf || mapping.file_pdf;
        }
        return { nhan, soQD, filePdf };
      };

      const bkbqp = resolveChain(isBkbqp, 'nhan_bkbqp', 'so_quyet_dinh_bkbqp', 'file_quyet_dinh_bkbqp', 'BKBQP');
      const cstdtq = resolveChain(isCstdtq, 'nhan_cstdtq', 'so_quyet_dinh_cstdtq', 'file_quyet_dinh_cstdtq', 'CSTDTQ');
      const bkttcp = resolveChain(isBkttcp, 'nhan_bkttcp', 'so_quyet_dinh_bkttcp', 'file_quyet_dinh_bkttcp', 'BKTTCP');

      const data: Record<string, unknown> = {};
      data.cap_bac = item.cap_bac || null;
      data.chuc_vu = item.chuc_vu || null;
      const note = item.ghi_chu || ghiChu;

      if (
        item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTT ||
        item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS
      ) {
        data.danh_hieu = item.danh_hieu;
        data.so_quyet_dinh = soQuyetDinhDanhHieu;
        if (note) data.ghi_chu = note;
      }
      // Use resolved chain values (bkbqp/cstdtq/bkttcp.nhan) so mixed items
      // like CSTDCS + nhan_bkbqp persist the BKBQP flag instead of dropping it.
      if (bkbqp.nhan) {
        data.nhan_bkbqp = true;
        data.so_quyet_dinh_bkbqp = bkbqp.soQD;
        if (note) data.ghi_chu_bkbqp = note;
      }
      if (cstdtq.nhan) {
        data.nhan_cstdtq = true;
        data.so_quyet_dinh_cstdtq = cstdtq.soQD;
        if (note) data.ghi_chu_cstdtq = note;
      }
      if (bkttcp.nhan) {
        data.nhan_bkttcp = true;
        data.so_quyet_dinh_bkttcp = bkttcp.soQD;
        if (note) data.ghi_chu_bkttcp = note;
      }

      await tx.danhHieuHangNam.upsert({
        where: { quan_nhan_id_nam: { quan_nhan_id: quanNhan.id, nam: namNhan } },
        update: { ...data },
        create: { quan_nhan_id: quanNhan.id, nam: namNhan, ...data },
      });

      acc.importedDanhHieu++;
      acc.affectedPersonnelIds.add(quanNhan.id);
    } catch (error) {
      console.error('[approveProposal] danh hieu error:', error);
      acc.errors.push(
        `Lỗi import danh hiệu personnel_id ${item.personnel_id || 'N/A'}: ${(error as Error).message}`
      );
    }
  }
}

/** Imports NIEN_HAN (HCCSVV) proposals into KhenThuongHCCSVV + HoSoNienHan profile. */
async function importNienHan(
  ctx: ProposalContext,
  nienHanData: any[],
  mappings: DecisionMappings,
  tx: PrismaTx,
  acc: ImportAccumulator
): Promise<void> {
  const { proposal } = ctx;
  const { decisionMapping } = mappings;
  const nienHanIds = nienHanData.map((it: { personnel_id?: string }) => it.personnel_id).filter(Boolean);
  const existingHCCSVVForOrder = await tx.khenThuongHCCSVV.findMany({
    where: { quan_nhan_id: { in: nienHanIds } },
    select: { quan_nhan_id: true, danh_hieu: true, nam: true },
  });
  const hccsvvByPersonnelForOrder = new Map<string, { danh_hieu: string; nam: number }[]>();
  for (const r of existingHCCSVVForOrder) {
    const list = hccsvvByPersonnelForOrder.get(r.quan_nhan_id) || [];
    list.push({ danh_hieu: r.danh_hieu, nam: r.nam });
    hccsvvByPersonnelForOrder.set(r.quan_nhan_id, list);
  }

  for (const item of nienHanData) {
    try {
      if (!item.personnel_id) {
        acc.errors.push(`Huy chương Chiến sĩ vẻ vang thiếu personnel_id: ${JSON.stringify(item)}`);
        continue;
      }
      const quanNhan = await tx.quanNhan.findUnique({ where: { id: item.personnel_id } });
      if (!quanNhan) {
        acc.errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
        continue;
      }
      if (!item.danh_hieu) {
        acc.errors.push(`Huy chương Chiến sĩ vẻ vang thiếu danh_hieu cho quân nhân ${quanNhan.id}`);
        continue;
      }

      const allowedDanhHieus = Object.values(DANH_HIEU_HCCSVV);
      if (!allowedDanhHieus.includes(item.danh_hieu)) continue;

      const danhHieuDecision = decisionMapping[item.danh_hieu] || {};
      const soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
      const namNhan = item.nam_nhan;
      const thangNhan = item.thang_nhan;
      if (!namNhan || !thangNhan || thangNhan < 1 || thangNhan > 12) {
        acc.errors.push(`Quân nhân ${quanNhan.ho_ten || quanNhan.id} thiếu tháng/năm nhận huy chương`);
        continue;
      }
      if (namNhan < proposal.nam || (namNhan === proposal.nam && thangNhan < proposal.thang)) {
        acc.errors.push(
          `Quân nhân ${quanNhan.ho_ten || quanNhan.id}: tháng/năm nhận (${thangNhan}/${namNhan}) không được trước tháng/năm đề xuất (${proposal.thang}/${proposal.nam})`
        );
        continue;
      }
      if (item.nam_quyet_dinh && namNhan < item.nam_quyet_dinh) {
        acc.errors.push(
          `Quân nhân ${quanNhan.ho_ten || quanNhan.id}: năm nhận (${namNhan}) không được trước năm quyết định (${item.nam_quyet_dinh})`
        );
        continue;
      }

      const orderError = validateHCCSVVRankOrder(
        item.danh_hieu,
        namNhan,
        hccsvvByPersonnelForOrder.get(quanNhan.id) || []
      );
      if (orderError) {
        acc.errors.push(`Quân nhân ${quanNhan.ho_ten || quanNhan.id}: ${orderError}`);
        continue;
      }

      let thoiGian = null;
      if (quanNhan.ngay_nhap_ngu) {
        const ngayKetThuc = quanNhan.ngay_xuat_ngu
          ? new Date(quanNhan.ngay_xuat_ngu)
          : new Date(namNhan, thangNhan, 0);
        const months = calculateServiceMonths(new Date(quanNhan.ngay_nhap_ngu), ngayKetThuc);
        thoiGian = {
          total_months: months,
          years: Math.floor(months / 12),
          months: months % 12,
          display: formatServiceDuration(months),
        };
      }

      const awardData = {
        nam: namNhan,
        thang: thangNhan,
        cap_bac: item.cap_bac || null,
        chuc_vu: item.chuc_vu || null,
        ghi_chu: item.ghi_chu || null,
        so_quyet_dinh: soQuyetDinh,
        thoi_gian: thoiGian,
      };

      await tx.khenThuongHCCSVV.upsert({
        where: { quan_nhan_id_danh_hieu: { quan_nhan_id: quanNhan.id, danh_hieu: item.danh_hieu } },
        update: awardData,
        create: { quan_nhan_id: quanNhan.id, danh_hieu: item.danh_hieu, ...awardData },
      });

      const ngayNhan = new Date(Date.UTC(namNhan, thangNhan - 1, 1));
      const PROFILE_FIELDS: Record<string, { status: string; ngay: string }> = {
        [DANH_HIEU_HCCSVV.HANG_BA]: { status: 'hccsvv_hang_ba_status', ngay: 'hccsvv_hang_ba_ngay' },
        [DANH_HIEU_HCCSVV.HANG_NHI]: { status: 'hccsvv_hang_nhi_status', ngay: 'hccsvv_hang_nhi_ngay' },
        [DANH_HIEU_HCCSVV.HANG_NHAT]: { status: 'hccsvv_hang_nhat_status', ngay: 'hccsvv_hang_nhat_ngay' },
      };
      const fields = PROFILE_FIELDS[item.danh_hieu];
      const profileUpdate = {
        [fields.status]: ELIGIBILITY_STATUS.DA_NHAN,
        [fields.ngay]: ngayNhan,
      };
      await tx.hoSoNienHan.upsert({
        where: { quan_nhan_id: quanNhan.id },
        update: profileUpdate,
        create: { quan_nhan_id: quanNhan.id, ...profileUpdate },
      });

      acc.importedNienHan++;
      acc.affectedPersonnelIds.add(quanNhan.id);
    } catch (error) {
      console.error('[approveProposal] HCCSVV error:', error);
      acc.errors.push(
        `Lỗi import Huy chương Chiến sĩ vẻ vang personnel_id ${item.personnel_id || 'N/A'}: ${(error as Error).message}`
      );
    }
  }
}

/** Imports HC_QKQT proposals into HuanChuongQuanKyQuyetThang. */
async function importHCQKQT(
  ctx: ProposalContext,
  nienHanData: any[],
  mappings: DecisionMappings,
  tx: PrismaTx,
  acc: ImportAccumulator
): Promise<void> {
  const { proposal } = ctx;
  const { decisionMapping } = mappings;
  for (const item of nienHanData) {
    try {
      if (!item.personnel_id) {
        acc.errors.push(`HC_QKQT thiếu personnel_id: ${JSON.stringify(item)}`);
        continue;
      }
      const quanNhan = await tx.quanNhan.findUnique({ where: { id: item.personnel_id } });
      if (!quanNhan) {
        acc.errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
        continue;
      }

      const danhHieuDecision = (decisionMapping[DANH_HIEU_CA_NHAN_KHAC.HC_QKQT] || {}) as DecisionInfo;
      const soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
      const namNhan = item.nam_nhan;
      const thangNhan = item.thang_nhan;

      if (!namNhan || !thangNhan || thangNhan < 1 || thangNhan > 12) {
        acc.errors.push(
          `Quân nhân ${quanNhan.ho_ten || quanNhan.id} thiếu tháng/năm nhận Huân chương Quân kỳ quyết thắng`
        );
        continue;
      }
      if (namNhan < proposal.nam || (namNhan === proposal.nam && thangNhan < proposal.thang)) {
        acc.errors.push(
          `Quân nhân ${quanNhan.ho_ten || quanNhan.id}: tháng/năm nhận (${thangNhan}/${namNhan}) không được trước tháng/năm đề xuất (${proposal.thang}/${proposal.nam})`
        );
        continue;
      }
      if (item.nam_quyet_dinh && namNhan < item.nam_quyet_dinh) {
        acc.errors.push(
          `Quân nhân ${quanNhan.ho_ten || quanNhan.id}: năm nhận (${namNhan}) không được trước năm quyết định (${item.nam_quyet_dinh})`
        );
        continue;
      }

      let thoiGian = null;
      if (quanNhan.ngay_nhap_ngu) {
        const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
        const ngayKetThuc = quanNhan.ngay_xuat_ngu
          ? new Date(quanNhan.ngay_xuat_ngu)
          : new Date(namNhan, thangNhan, 0);
        const months = calculateServiceMonths(ngayNhapNgu, ngayKetThuc);
        thoiGian = {
          total_months: months,
          years: Math.floor(months / 12),
          months: months % 12,
          display: formatServiceDuration(months),
        };
      }

      const existingHC_QKQT = await tx.huanChuongQuanKyQuyetThang.findUnique({
        where: { quan_nhan_id: quanNhan.id },
      });

      const writeData = {
        nam: namNhan,
        thang: thangNhan,
        cap_bac: item.cap_bac || null,
        chuc_vu: item.chuc_vu || null,
        ghi_chu: item.ghi_chu || null,
        so_quyet_dinh: soQuyetDinh,
        thoi_gian: thoiGian,
      };

      if (existingHC_QKQT) {
        await tx.huanChuongQuanKyQuyetThang.update({
          where: { id: existingHC_QKQT.id },
          data: writeData,
        });
      } else {
        await tx.huanChuongQuanKyQuyetThang.create({
          data: { quan_nhan_id: quanNhan.id, ...writeData },
        });
      }
      acc.importedNienHan++;
      acc.affectedPersonnelIds.add(quanNhan.id);
    } catch (error) {
      console.error('[approveProposal] HC_QKQT error:', error);
      acc.errors.push(
        `Lỗi import HC_QKQT personnel_id ${item.personnel_id || 'N/A'}: ${(error as Error).message}`
      );
    }
  }
}

/** Imports KNC_VSNXD_QDNDVN proposals into KyNiemChuongVSNXDQDNDVN. */
async function importKNC(
  ctx: ProposalContext,
  nienHanData: any[],
  mappings: DecisionMappings,
  tx: PrismaTx,
  acc: ImportAccumulator
): Promise<void> {
  const { proposal } = ctx;
  const { decisionMapping } = mappings;
  for (const item of nienHanData) {
    try {
      if (!item.personnel_id) {
        acc.errors.push(`KNC_VSNXD_QDNDVN thiếu personnel_id: ${JSON.stringify(item)}`);
        continue;
      }
      const quanNhan = await tx.quanNhan.findUnique({ where: { id: item.personnel_id } });
      if (!quanNhan) {
        acc.errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
        continue;
      }

      const danhHieuDecision = (decisionMapping[DANH_HIEU_CA_NHAN_KHAC.KNC_VSNXD_QDNDVN] || {}) as DecisionInfo;
      const soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
      const namNhan = item.nam_nhan;
      const thangNhan = item.thang_nhan;

      if (!namNhan || !thangNhan || thangNhan < 1 || thangNhan > 12) {
        acc.errors.push(
          `Quân nhân ${quanNhan.ho_ten || quanNhan.id} thiếu tháng/năm nhận Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN`
        );
        continue;
      }
      if (namNhan < proposal.nam || (namNhan === proposal.nam && thangNhan < proposal.thang)) {
        acc.errors.push(
          `Quân nhân ${quanNhan.ho_ten || quanNhan.id}: tháng/năm nhận (${thangNhan}/${namNhan}) không được trước tháng/năm đề xuất (${proposal.thang}/${proposal.nam})`
        );
        continue;
      }
      if (item.nam_quyet_dinh && namNhan < item.nam_quyet_dinh) {
        acc.errors.push(
          `Quân nhân ${quanNhan.ho_ten || quanNhan.id}: năm nhận (${namNhan}) không được trước năm quyết định (${item.nam_quyet_dinh})`
        );
        continue;
      }

      let thoiGian = null;
      if (quanNhan.ngay_nhap_ngu) {
        const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
        const ngayKetThuc = quanNhan.ngay_xuat_ngu
          ? new Date(quanNhan.ngay_xuat_ngu)
          : new Date(namNhan, thangNhan, 0);
        const months = calculateServiceMonths(ngayNhapNgu, ngayKetThuc);
        thoiGian = {
          total_months: months,
          years: Math.floor(months / 12),
          months: months % 12,
          display: formatServiceDuration(months),
        };
      }

      const existingKNC = await tx.kyNiemChuongVSNXDQDNDVN.findUnique({
        where: { quan_nhan_id: quanNhan.id },
      });

      const writeData = {
        nam: namNhan,
        thang: thangNhan,
        cap_bac: item.cap_bac || null,
        chuc_vu: item.chuc_vu || null,
        ghi_chu: item.ghi_chu || null,
        so_quyet_dinh: soQuyetDinh,
        thoi_gian: thoiGian,
      };

      if (existingKNC) {
        await tx.kyNiemChuongVSNXDQDNDVN.update({ where: { id: existingKNC.id }, data: writeData });
      } else {
        await tx.kyNiemChuongVSNXDQDNDVN.create({
          data: { quan_nhan_id: quanNhan.id, ...writeData },
        });
      }
      acc.importedNienHan++;
      acc.affectedPersonnelIds.add(quanNhan.id);
    } catch (error) {
      console.error('[approveProposal] KNC error:', error);
      acc.errors.push(
        `Lỗi import KNC_VSNXD_QDNDVN personnel_id ${item.personnel_id || 'N/A'}: ${(error as Error).message}`
      );
    }
  }
}

/** Imports scientific achievements (NCKH) into ThanhTichKhoaHoc. */
async function importNckh(
  thanhTichData: any[],
  tx: PrismaTx,
  acc: ImportAccumulator
): Promise<void> {
  for (const item of thanhTichData) {
    try {
      if (!item.personnel_id) {
        acc.errors.push(`Thành tích thiếu personnel_id: ${JSON.stringify(item)}`);
        continue;
      }
      const quanNhan = await tx.quanNhan.findUnique({ where: { id: item.personnel_id } });
      if (!quanNhan) {
        acc.errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
        continue;
      }
      if (!item.nam) {
        acc.errors.push(`Thành tích thiếu năm cho quân nhân ${quanNhan.id}`);
        continue;
      }
      const loaiCode = resolveNckhCode(item.loai);
      if (!item.loai || !loaiCode) {
        acc.errors.push(`Thành tích có loại không hợp lệ cho quân nhân ${quanNhan.id}: ${item.loai}`);
        continue;
      }
      if (!item.mo_ta || item.mo_ta.trim() === '') {
        acc.errors.push(`Thành tích thiếu mô tả cho quân nhân ${quanNhan.id}`);
        continue;
      }
      const soQuyetDinhThanhTich = item.so_quyet_dinh || null;
      await tx.thanhTichKhoaHoc.create({
        data: {
          quan_nhan_id: quanNhan.id,
          nam: parseInt(item.nam, 10),
          loai: loaiCode,
          mo_ta: item.mo_ta.trim(),
          chuc_vu: item.chuc_vu || null,
          cap_bac: item.cap_bac || null,
          ghi_chu: item.ghi_chu || null,
          so_quyet_dinh: soQuyetDinhThanhTich,
        },
      });
      acc.importedThanhTich++;
      acc.affectedPersonnelIds.add(quanNhan.id);
    } catch (error) {
      console.error('[approveProposal] NCKH error:', error);
      acc.errors.push(`Lỗi nhập thành tích: ${(error as Error).message}`);
    }
  }
}

/** Resolves which `pdfPaths` key matches a decision number for the current proposal type. */
function resolveDecisionFilePath(
  proposalType: ProposalType,
  soQuyetDinh: string,
  decisions: DecisionInputMap,
  pdfPaths: Record<string, string | undefined>,
  thanhTichData: any[]
): string | null | undefined {
  if (
    proposalType === PROPOSAL_TYPES.CA_NHAN_HANG_NAM &&
    decisions.so_quyet_dinh_ca_nhan_hang_nam === soQuyetDinh
  ) {
    return pdfPaths.file_pdf_ca_nhan_hang_nam;
  }
  if (
    proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM &&
    decisions.so_quyet_dinh_don_vi_hang_nam === soQuyetDinh
  ) {
    return pdfPaths.file_pdf_don_vi_hang_nam;
  }
  if (proposalType === PROPOSAL_TYPES.NIEN_HAN && decisions.so_quyet_dinh_nien_han === soQuyetDinh) {
    return pdfPaths.file_pdf_nien_han;
  }
  if (
    proposalType === PROPOSAL_TYPES.CONG_HIEN &&
    decisions.so_quyet_dinh_cong_hien === soQuyetDinh
  ) {
    return pdfPaths.file_pdf_cong_hien;
  }
  if (proposalType === PROPOSAL_TYPES.DOT_XUAT && decisions.so_quyet_dinh_dot_xuat === soQuyetDinh) {
    return pdfPaths.file_pdf_dot_xuat;
  }
  if (proposalType === PROPOSAL_TYPES.NCKH) {
    const matchingThanhTich = thanhTichData.find(t => t.so_quyet_dinh === soQuyetDinh);
    if (
      (matchingThanhTich || decisions.so_quyet_dinh_nckh === soQuyetDinh) &&
      pdfPaths.file_pdf_nckh
    ) {
      return pdfPaths.file_pdf_nckh;
    }
  }
  return null;
}

/** Synchronizes used decision numbers + paths into the FileQuyetDinh registry. */
async function syncDecisionFiles(
  ctx: ProposalContext,
  danhHieuData: any[],
  thanhTichData: any[],
  decisions: DecisionInputMap,
  pdfPaths: Record<string, string | undefined>,
  tx: PrismaTx
): Promise<void> {
  const { proposal, proposalId, adminId } = ctx;
  const decisionsToSync = new Set<string>();

  for (const item of danhHieuData) {
    if (item.so_quyet_dinh) decisionsToSync.add(item.so_quyet_dinh);
    if (item.so_quyet_dinh_bkbqp) decisionsToSync.add(item.so_quyet_dinh_bkbqp);
    if (item.so_quyet_dinh_cstdtq) decisionsToSync.add(item.so_quyet_dinh_cstdtq);
  }
  for (const item of thanhTichData) {
    if (item.so_quyet_dinh) decisionsToSync.add(item.so_quyet_dinh);
  }

  if (decisions.so_quyet_dinh_ca_nhan_hang_nam)
    decisionsToSync.add(decisions.so_quyet_dinh_ca_nhan_hang_nam);
  if (decisions.so_quyet_dinh_don_vi_hang_nam)
    decisionsToSync.add(decisions.so_quyet_dinh_don_vi_hang_nam);
  if (decisions.so_quyet_dinh_nien_han) decisionsToSync.add(decisions.so_quyet_dinh_nien_han);
  if (decisions.so_quyet_dinh_cong_hien) decisionsToSync.add(decisions.so_quyet_dinh_cong_hien);
  if (decisions.so_quyet_dinh_dot_xuat) decisionsToSync.add(decisions.so_quyet_dinh_dot_xuat);
  if (decisions.so_quyet_dinh_nckh) decisionsToSync.add(decisions.so_quyet_dinh_nckh);

  const adminInfo = await tx.taiKhoan.findUnique({
    where: { id: adminId },
    include: { QuanNhan: { select: { ho_ten: true } } },
  });
  const ngayKy = new Date();
  const nguoiKy =
    (adminInfo as { QuanNhan?: { ho_ten?: string | null }; username?: string })?.QuanNhan?.ho_ten ||
    adminInfo?.username ||
    'Chưa cập nhật';

  const proposalType = proposal.loai_de_xuat as ProposalType;

  for (const soQuyetDinh of decisionsToSync) {
    if (!soQuyetDinh) continue;
    try {
      const existing = await tx.fileQuyetDinh.findUnique({ where: { so_quyet_dinh: soQuyetDinh } });

      if (!existing) {
        let filePath: string | null | undefined = resolveDecisionFilePath(
          proposalType,
          soQuyetDinh,
          decisions,
          pdfPaths,
          thanhTichData
        );

        if (!filePath) {
          const matchingDanhHieu = danhHieuData.find(
            d =>
              d.so_quyet_dinh === soQuyetDinh ||
              d.so_quyet_dinh_bkbqp === soQuyetDinh ||
              d.so_quyet_dinh_cstdtq === soQuyetDinh ||
              d.so_quyet_dinh_bkttcp === soQuyetDinh
          );
          if (matchingDanhHieu) {
            filePath =
              matchingDanhHieu.file_quyet_dinh ||
              matchingDanhHieu.file_quyet_dinh_bkbqp ||
              matchingDanhHieu.file_quyet_dinh_cstdtq ||
              matchingDanhHieu.file_quyet_dinh_bkttcp ||
              null;
          }
          if (!filePath) {
            const matchingThanhTich = thanhTichData.find(t => t.so_quyet_dinh === soQuyetDinh);
            if (matchingThanhTich && matchingThanhTich.file_quyet_dinh) {
              filePath = matchingThanhTich.file_quyet_dinh;
            }
          }
        }

        const loaiKhenThuong = proposal.loai_de_xuat || PROPOSAL_TYPES.CA_NHAN_HANG_NAM;
        await tx.fileQuyetDinh.create({
          data: {
            so_quyet_dinh: soQuyetDinh,
            nam: proposal.nam,
            ngay_ky: ngayKy,
            nguoi_ky: nguoiKy,
            file_path: filePath,
            loai_khen_thuong: loaiKhenThuong,
            ghi_chu: `Tự động đồng bộ từ đề xuất ${proposalId}`,
          },
        });
      } else if (!existing.file_path) {
        const filePath = resolveDecisionFilePath(
          proposalType,
          soQuyetDinh,
          decisions,
          pdfPaths,
          thanhTichData
        );
        if (filePath) {
          await tx.fileQuyetDinh.update({
            where: { so_quyet_dinh: soQuyetDinh },
            data: { file_path: filePath },
          });
        }
      }
    } catch (error) {
      void writeSystemLog({
        action: 'ERROR',
        resource: 'proposals',
        description: 'ProposalApprove.syncDecisionFiles failed',
        payload: { proposalId, soQuyetDinh, error },
      });
    }
  }
}

/**
 * Recalculates downstream profile state for personnel/units affected by approval.
 * @param proposal - Loaded proposal
 * @param acc - Import accumulator (read-only here)
 * @returns Recalculation success/failure counts
 */
async function recalculateAffectedProfiles(
  proposal: LoadedProposal,
  acc: ImportAccumulator
): Promise<{ success: number; errors: number }> {
  if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
    const results = await Promise.allSettled(
      Array.from(acc.affectedUnitIds).map(donViId =>
        unitAnnualAwardService.recalculateAnnualUnit(donViId, proposal.nam)
      )
    );
    let success = 0;
    let errors = 0;
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        success++;
      } else {
        errors++;
        const donViId = Array.from(acc.affectedUnitIds)[idx];
        console.error('ProposalApprove.recalculateAnnualUnit failed', { donViId, error: r.reason });
      }
    });
    return { success, errors };
  }

  const recalcOne = (personnelId: string): Promise<unknown> => {
    if (proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN) {
      return profileService.recalculateTenureProfile(personnelId);
    }
    if (proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN) {
      return profileService.recalculateContributionProfile(personnelId);
    }
    if (
      proposal.loai_de_xuat !== PROPOSAL_TYPES.HC_QKQT &&
      proposal.loai_de_xuat !== PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
    ) {
      return profileService.recalculateAnnualProfile(personnelId);
    }
    return Promise.resolve();
  };

  const personnelIds = Array.from(acc.affectedPersonnelIds);
  const results = await Promise.allSettled(personnelIds.map(recalcOne));
  let success = 0;
  let errors = 0;
  results.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      success++;
    } else {
      errors++;
      console.error('ProposalApprove.recalculateProfile failed', {
        personnelId: personnelIds[idx],
        error: r.reason,
      });
    }
  });
  return { success, errors };
}

/**
 * Runs all per-type imports inside a single transaction and finalizes proposal status.
 */
async function runImportTransaction(
  ctx: ProposalContext,
  danhHieuData: any[],
  thanhTichData: any[],
  nienHanData: any[],
  congHienData: any[],
  decisions: DecisionInputMap,
  mappings: DecisionMappings,
  pdfPaths: Record<string, string | undefined>,
  updateData: Record<string, unknown>,
  acc: ImportAccumulator
): Promise<void> {
  const { proposal, proposalId } = ctx;

  await prisma.$transaction(
    async prismaTx => {
      if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        await importDonViHangNam(ctx, danhHieuData, mappings, prismaTx, acc);
      } else if (proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN) {
        await importCongHien(ctx, congHienData, decisions, prismaTx, acc);
      } else {
        await importCaNhanOrDotXuat(ctx, danhHieuData, mappings, prismaTx, acc);
      }

      if (
        proposal.loai_de_xuat === PROPOSAL_TYPES.NIEN_HAN &&
        nienHanData &&
        nienHanData.length > 0
      ) {
        await importNienHan(ctx, nienHanData, mappings, prismaTx, acc);
      }
      if (
        proposal.loai_de_xuat === PROPOSAL_TYPES.HC_QKQT &&
        nienHanData &&
        nienHanData.length > 0
      ) {
        await importHCQKQT(ctx, nienHanData, mappings, prismaTx, acc);
      }
      if (
        proposal.loai_de_xuat === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN &&
        nienHanData &&
        nienHanData.length > 0
      ) {
        await importKNC(ctx, nienHanData, mappings, prismaTx, acc);
      }

      await importNckh(thanhTichData, prismaTx, acc);

      await syncDecisionFiles(ctx, danhHieuData, thanhTichData, decisions, pdfPaths, prismaTx);

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

/** Logs aggregated import errors to the system log (best-effort, fire-and-forget). */
function logImportErrors(
  proposal: LoadedProposal,
  adminId: AdminAccountId,
  proposalId: ProposalId,
  errors: string[]
): void {
  if (errors.length === 0) return;
  void writeSystemLog({
    userId: adminId,
    action: 'ERROR',
    resource: 'proposals',
    resourceId: proposalId,
    description: `[Phê duyệt đề xuất] ${proposal.loai_de_xuat} năm ${proposal.nam}: ${errors.length} lỗi. Chi tiết: ${errors.join('; ')}`,
  });
}

/** Builds the success response payload returned by approveProposal. */
function buildApproveResponse(
  proposal: LoadedProposal,
  danhHieuData: any[],
  thanhTichData: any[],
  nienHanData: any[],
  congHienData: any[],
  acc: ImportAccumulator,
  recalc: { success: number; errors: number }
) {
  const affectedPersonnelCount = acc.affectedPersonnelIds.size;
  const affectedUnitCount =
    proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM ? acc.affectedUnitIds.size : 0;

  const successMessage = buildApproveSummaryMessage({
    proposalType: proposal.loai_de_xuat,
    importedDanhHieu: acc.importedDanhHieu,
    importedThanhTich: acc.importedThanhTich,
    importedNienHan: acc.importedNienHan,
    errorCount: acc.errors.length,
    affectedPersonnelCount,
    affectedUnitCount,
  });

  return {
    message: successMessage,
    proposal: proposal,
    affectedPersonnelIds: Array.from(acc.affectedPersonnelIds),
    result: {
      don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
      nguoi_de_xuat: proposal.NguoiDeXuat.QuanNhan?.ho_ten || proposal.NguoiDeXuat.username,
      imported_danh_hieu: acc.importedDanhHieu,
      imported_thanh_tich: acc.importedThanhTich,
      imported_nien_han: acc.importedNienHan,
      total_danh_hieu: danhHieuData.length,
      total_thanh_tich: thanhTichData.length,
      total_nien_han: nienHanData.length,
      data_danh_hieu: danhHieuData,
      data_thanh_tich: thanhTichData,
      data_nien_han: nienHanData,
      data_cong_hien: congHienData,
      errors: acc.errors.length > 0 ? acc.errors : null,
      recalculated_profiles: recalc.success,
      recalculate_errors: recalc.errors,
    },
  };
}

/**
 * Approves a proposal and imports its data into the main tables.
 * @param proposalId - Proposal ID
 * @param editedData - Edited JSON arrays for proposal data fields
 * @param adminId - Approver account ID
 */
async function approveProposal(
  proposalId: ProposalId,
  editedData: EditedProposalPayload,
  adminId: AdminAccountId,
  decisions: DecisionInputMap = {},
  pdfFiles: Record<string, UploadedDecisionFile | undefined> = {},
  ghiChu: string | null = null
) {
  const proposal = await loadApproveProposal(proposalId);
  if (!proposal) throw new NotFoundError('Đề xuất');
  validateApproveStatus(proposal);
  validateApproveMonth(proposal);

  const danhHieuData = asJsonObjectArray(editedData.data_danh_hieu ?? proposal.data_danh_hieu);
  const thanhTichData = asJsonObjectArray(editedData.data_thanh_tich ?? proposal.data_thanh_tich);
  const nienHanData = asJsonObjectArray(editedData.data_nien_han ?? proposal.data_nien_han);
  const congHienData = asJsonObjectArray(editedData.data_cong_hien ?? proposal.data_cong_hien);

  const personnelHoTenMap = await buildPersonnelHoTenMap(danhHieuData, nienHanData, thanhTichData);

  const ctx: ProposalContext = {
    proposal,
    proposalId,
    adminId,
    proposalYear: proposal.nam,
    proposalType: proposal.loai_de_xuat as ProposalType,
    refDate: new Date(proposal.nam, proposal.thang as number, 0),
    ghiChu,
    personnelHoTenMap,
  };

  await runDuplicateChecks(ctx, danhHieuData, nienHanData, thanhTichData);
  await runEligibilityChecks(ctx, danhHieuData, nienHanData, congHienData);
  runDecisionNumberChecks(ctx, danhHieuData, decisions);

  const pdfPaths = await persistDecisionPdfs(decisions, pdfFiles);
  const { decisionMapping, specialDecisionMapping } = buildDecisionMappings(decisions, pdfPaths);
  const mappings: DecisionMappings = { decisionMapping, specialDecisionMapping, pdfPaths };

  const updateData: Record<string, unknown> = {
    status: PROPOSAL_STATUS.APPROVED,
    nguoi_duyet_id: adminId,
    ngay_duyet: new Date(),
    data_danh_hieu: danhHieuData,
    data_thanh_tich: thanhTichData,
    data_nien_han: nienHanData,
    data_cong_hien: congHienData,
    ...(ghiChu ? { ghi_chu: ghiChu } : {}),
  };

  const acc: ImportAccumulator = {
    importedDanhHieu: 0,
    importedThanhTich: 0,
    importedNienHan: 0,
    errors: [],
    affectedPersonnelIds: new Set<string>(),
    affectedUnitIds: new Set<string>(),
  };

  await runImportTransaction(
    ctx,
    danhHieuData,
    thanhTichData,
    nienHanData,
    congHienData,
    decisions,
    mappings,
    pdfPaths,
    updateData,
    acc
  );

  const recalc = await recalculateAffectedProfiles(proposal, acc);
  logImportErrors(proposal, adminId, proposalId, acc.errors);
  return buildApproveResponse(proposal, danhHieuData, thanhTichData, nienHanData, congHienData, acc, recalc);
}

/**
 * Rejects a proposal with a reason.
 * @param proposalId - `bang_de_xuat.id`
 * @param lyDo - Rejection reason
 * @param adminId - Admin account id (`tai_khoan.id`)
 */
async function rejectProposal(proposalId: ProposalId, lyDo: string, adminId: AdminAccountId) {
  const proposal = await prisma.bangDeXuat.findUnique({
    where: { id: proposalId },
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: { include: { CoQuanDonVi: true } },
      NguoiDeXuat: {
        select: { id: true, username: true, role: true, QuanNhan: { select: { id: true, ho_ten: true } } },
      },
    },
  });

  if (!proposal) throw new NotFoundError('Đề xuất');
  if (proposal.status === PROPOSAL_STATUS.APPROVED) {
    throw new ValidationError('Không thể từ chối đề xuất đã được phê duyệt');
  }
  if (proposal.status === PROPOSAL_STATUS.REJECTED) {
    throw new ValidationError('Đề xuất này đã bị từ chối trước đó');
  }

  const updateResult = await prisma.bangDeXuat.updateMany({
    where: { id: proposalId, status: PROPOSAL_STATUS.PENDING },
    data: {
      status: PROPOSAL_STATUS.REJECTED,
      nguoi_duyet_id: adminId,
      ngay_duyet: new Date(),
      rejection_reason: lyDo,
    },
  });

  if (updateResult.count === 0) {
    throw new ValidationError(
      'Đề xuất đã bị thay đổi bởi người khác. Vui lòng tải lại trang và thử lại.'
    );
  }

  return {
    message: 'Từ chối đề xuất thành công',
    proposal: proposal,
    result: {
      don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
      nguoi_de_xuat: proposal.NguoiDeXuat.QuanNhan?.ho_ten || proposal.NguoiDeXuat.username,
      ly_do: lyDo,
    },
  };
}

export { approveProposal, rejectProposal };
