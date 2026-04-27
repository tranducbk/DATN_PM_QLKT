import { prisma } from '../../../models';
import { buildCutoffDate, formatServiceDuration } from '../../../helpers/serviceYearsHelper';
import { PROPOSAL_TYPES } from '../../../constants/proposalTypes.constants';
import {
  CONG_HIEN_HE_SO_GROUPS,
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_CA_NHAN_CO_BAN,
  DANH_HIEU_CA_NHAN_BANG_KHEN,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_DON_VI_BANG_KHEN,
} from '../../../constants/danhHieu.constants';
import { ValidationError } from '../../../middlewares/errorHandler';
import { validateHCBVTQHighestRank } from '../../../helpers/awardValidation/contributionMedalHighestRank';
import profileService from '../../profile.service';
import unitAnnualAwardService from '../../unitAnnualAward.service';
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
} from '../validation';
import { validateDecisionNumbers } from '../../eligibility/decisionNumberValidation';
import { collectPersonnelDuplicateErrors } from '../../eligibility/personnelDuplicateCheck';
import type { PositionMonthsByGroup } from '../../eligibility/congHienMonthsAggregator';
import {
  evaluateHCBVTQRank,
  getMonthsByGroup,
  loadHCBVTQEvaluationContext,
  requiredCongHienMonths,
} from '../../eligibility/hcbvtqEligibility';
import {
  batchEvaluateServiceYears,
  buildServiceYearsErrorMessage,
} from '../../eligibility/serviceYearsEligibility';
import { PROPOSAL_STATUS } from '../../../constants/proposalStatus.constants';
import { GENDER } from '../../../constants/gender.constants';
import type {
  ProposalDanhHieuItem,
  ProposalThanhTichItem,
  ProposalNienHanItem,
  ProposalCongHienItem,
} from '../../../types/proposal';
import type { ProposalContext, DecisionInputMap } from './types';

/** Collects "duplicate award" errors for personal annual proposals. */
async function collectCaNhanHangNamDuplicates(
  ctx: ProposalContext,
  danhHieuData: ProposalDanhHieuItem[]
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
  const chuoiSet: ReadonlySet<string> = new Set([
    DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
    DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
    DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
  ]);
  const hasNhomChuoi = selectedDanhHieu.some(danhHieu => chuoiSet.has(danhHieu));
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
  danhHieuData: ProposalDanhHieuItem[]
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
  const donViSet: ReadonlySet<string> = new Set([
    DANH_HIEU_DON_VI_HANG_NAM.DVQT,
    DANH_HIEU_DON_VI_HANG_NAM.DVTT,
  ]);
  const bangKhenDonViSet: ReadonlySet<string> = new Set([
    DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
    DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
  ]);
  const hasDanhHieuDonVi = selectedDanhHieu.some(danhHieu => donViSet.has(danhHieu));
  const hasBangKhenDonVi = selectedDanhHieu.some(danhHieu => bangKhenDonViSet.has(danhHieu));
  if (hasDanhHieuDonVi && hasBangKhenDonVi) {
    throw new ValidationError(MIXED_DON_VI_HANG_NAM_ERROR);
  }

  const validUnitItems = danhHieuData.filter(item => item.don_vi_id && item.danh_hieu);
  const unitDuplicateErrors = await Promise.all(
    validUnitItems.map(item =>
      checkDuplicateUnitAward(item.don_vi_id, proposalYear, item.danh_hieu, proposalType).then(r =>
        r.exists ? `${item.ten_don_vi || 'Một đơn vị'}: ${r.message}` : null
      )
    )
  );
  unitDuplicateErrors.filter(Boolean).forEach(err => errors.push(err as string));
  return errors;
}

/** Collects NCKH duplicates by (personnel_id, nam, mo_ta) key. */
async function collectNckhDuplicates(
  ctx: ProposalContext,
  thanhTichData: ProposalThanhTichItem[]
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
export async function runDuplicateChecks(
  ctx: ProposalContext,
  danhHieuData: ProposalDanhHieuItem[],
  nienHanData: ProposalNienHanItem[],
  thanhTichData: ProposalThanhTichItem[]
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
  nienHanData: ProposalNienHanItem[]
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
  nienHanData: ProposalNienHanItem[]
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
  congHienData: ProposalCongHienItem[]
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
  danhHieuData: ProposalDanhHieuItem[]
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
  danhHieuData: ProposalDanhHieuItem[]
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
export async function runEligibilityChecks(
  ctx: ProposalContext,
  danhHieuData: ProposalDanhHieuItem[],
  nienHanData: ProposalNienHanItem[],
  congHienData: ProposalCongHienItem[]
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
export function runDecisionNumberChecks(
  ctx: ProposalContext,
  danhHieuData: ProposalDanhHieuItem[],
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
