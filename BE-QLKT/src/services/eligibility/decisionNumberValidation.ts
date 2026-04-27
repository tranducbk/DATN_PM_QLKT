import {
  getDanhHieuName,
  DANH_HIEU_CA_NHAN_HANG_NAM,
} from '../../constants/danhHieu.constants';

export interface DecisionNumberPayload {
  danh_hieu?: string | null;
  so_quyet_dinh?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
}

export interface DecisionNumberContext {
  entityType: 'personal' | 'unit';
  entityName: string;
}

function isBlank(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

/**
 * Formats missing decision-number message for one award code.
 * @param entityName - Personnel/unit display name
 * @param danhHieuCode - Award code
 * @returns Human-readable validation message
 */
export function missingDecisionNumberMessage(entityName: string, danhHieuCode: string): string {
  return `${entityName}: Thiếu số quyết định cho danh hiệu ${getDanhHieuName(danhHieuCode)}`;
}

/**
 * Validates that each selected award flag has a matching decision number.
 * @param payload - Award flags and decision numbers
 * @param context - Entity context for error prefixes
 * @returns Validation errors (empty if valid)
 */
export function validateDecisionNumbers(
  payload: DecisionNumberPayload,
  context: DecisionNumberContext
): string[] {
  const errors: string[] = [];
  const { entityType, entityName } = context;

  if (payload.danh_hieu && isBlank(payload.so_quyet_dinh)) {
    errors.push(missingDecisionNumberMessage(entityName, payload.danh_hieu));
  }

  if (payload.nhan_bkbqp && isBlank(payload.so_quyet_dinh_bkbqp)) {
    errors.push(missingDecisionNumberMessage(entityName, DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP));
  }

  if (entityType === 'personal' && payload.nhan_cstdtq && isBlank(payload.so_quyet_dinh_cstdtq)) {
    errors.push(missingDecisionNumberMessage(entityName, DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ));
  }

  if (payload.nhan_bkttcp && isBlank(payload.so_quyet_dinh_bkttcp)) {
    errors.push(missingDecisionNumberMessage(entityName, DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP));
  }

  return errors;
}
