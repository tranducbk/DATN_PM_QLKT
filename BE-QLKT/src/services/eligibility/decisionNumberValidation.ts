import {
  getDanhHieuName,
  DANH_HIEU_CA_NHAN_HANG_NAM,
} from '../../constants/danhHieu.constants';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  DECISION NUMBER VALIDATION — kiểm tra mỗi danh hiệu phải có số QĐ
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  BUSINESS RULE:
 *  Mọi khen thưởng PHẢI có số quyết định (so_quyet_dinh) — đây là căn cứ
 *  pháp lý + truy xuất hồ sơ giấy. Nếu thiếu → không cho phép approve.
 *
 *  4 FIELD CẦN VALIDATE TRONG 1 ROW DanhHieuHangNam:
 *  - so_quyet_dinh        ← khi danh_hieu được set (CSTT/CSTDCS, ...)
 *  - so_quyet_dinh_bkbqp  ← khi nhan_bkbqp = true
 *  - so_quyet_dinh_cstdtq ← khi nhan_cstdtq = true (chỉ cá nhân)
 *  - so_quyet_dinh_bkttcp ← khi nhan_bkttcp = true
 *
 *  ĐẶC THÙ: 1 row có thể có 1-4 danh hiệu cùng năm (vd: CSTDCS năm 2024
 *  kèm nhan_bkbqp=true). Mỗi danh hiệu cần SỐ QĐ RIÊNG — vì quyết định
 *  cấp BKBQP do BQP ký, quyết định CSTDCS do đơn vị ký → khác nhau.
 *
 *  PATTERN PER-FIELD CHECK:
 *  Loop từng field flag → nếu flag=true mà số QĐ blank → push lỗi với
 *  tên danh hiệu cụ thể (giúp UI hiển thị "Thiếu số QĐ cho CSTDCS").
 *
 *  WHY tách helper (không inline trong strategy):
 *  - Cá nhân và đơn vị đều cần check → DRY (entityType phân biệt CSTDTQ).
 *  - Test unit dễ (pure function, no DB).
 *  - Message tiếng Việt consistent qua getDanhHieuName.
 * ════════════════════════════════════════════════════════════════════════════
 */

interface DecisionNumberPayload {
  danh_hieu?: string | null;
  so_quyet_dinh?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
}

interface DecisionNumberContext {
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

  // Danh hiệu chính (CSTDCS/CSTT/ĐVQT...) được set mà bỏ trống số QĐ → lỗi.
  if (payload.danh_hieu && isBlank(payload.so_quyet_dinh)) {
    errors.push(missingDecisionNumberMessage(entityName, payload.danh_hieu));
  }

  // Mỗi flag bằng khen cần số QĐ RIÊNG (do cấp khác ký), kiểm tra độc lập.
  if (payload.nhan_bkbqp && isBlank(payload.so_quyet_dinh_bkbqp)) {
    errors.push(missingDecisionNumberMessage(entityName, DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP));
  }

  // CSTDTQ chỉ tồn tại ở cá nhân → đơn vị (entityType='unit') bỏ qua check này.
  if (entityType === 'personal' && payload.nhan_cstdtq && isBlank(payload.so_quyet_dinh_cstdtq)) {
    errors.push(missingDecisionNumberMessage(entityName, DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ));
  }

  if (payload.nhan_bkttcp && isBlank(payload.so_quyet_dinh_bkttcp)) {
    errors.push(missingDecisionNumberMessage(entityName, DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP));
  }

  return errors;
}
