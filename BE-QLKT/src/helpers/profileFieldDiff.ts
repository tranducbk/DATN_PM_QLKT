/** Vietnamese labels of the editable scalar personnel fields, used in audit logs and notifications. */
export const PERSONNEL_FIELD_LABELS = {
  ho_ten: 'Họ và tên',
  gioi_tinh: 'Giới tính',
  ngay_sinh: 'Ngày sinh',
  cccd: 'CCCD',
  cap_bac: 'Cấp bậc',
  ngay_nhap_ngu: 'Ngày nhập ngũ',
  ngay_xuat_ngu: 'Ngày xuất ngũ',
  que_quan_2_cap: 'Quê quán 2 cấp',
  que_quan_3_cap: 'Quê quán 3 cấp',
  tru_quan: 'Trú quán',
  cho_o_hien_nay: 'Chỗ ở hiện nay',
  ngay_vao_dang: 'Ngày vào Đảng',
  ngay_vao_dang_chinh_thuc: 'Ngày vào Đảng chính thức',
  so_the_dang_vien: 'Số thẻ Đảng viên',
  so_dien_thoai: 'Số điện thoại',
} as const;

type PersonnelFieldKey = keyof typeof PERSONNEL_FIELD_LABELS;
type PersonnelFieldValues = Partial<Record<PersonnelFieldKey, unknown>>;

// Fields whose value is sensitive — the log records that they changed, not the old/new values.
const VALUE_REDACTED_FIELDS = new Set<string>(['cccd']);

export interface PersonnelFieldChange {
  key: string;
  label: string;
  from: string;
  to: string;
}

function normalizeFieldValue(value: unknown): string {
  if (value == null) return '';
  // Date-only fields (ngay_sinh, ...) — display as DD-MM-YYYY in UTC to avoid a timezone day-shift.
  if (value instanceof Date) {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${value.getUTCFullYear()}`;
  }
  return String(value).trim();
}

/**
 * Returns the personnel fields whose value actually changed, with old and new values.
 * Only fields present in `after` are compared, since an update sends a subset.
 * @param before - Current stored record
 * @param after - Incoming update payload
 * @returns Changed fields with from/to values
 */
export function diffPersonnelChanges(
  before: PersonnelFieldValues | null,
  after: PersonnelFieldValues
): PersonnelFieldChange[] {
  const changes: PersonnelFieldChange[] = [];
  for (const key of Object.keys(PERSONNEL_FIELD_LABELS) as PersonnelFieldKey[]) {
    if (!(key in after)) continue;
    const from = normalizeFieldValue(before?.[key]);
    const to = normalizeFieldValue(after[key]);
    if (from !== to) changes.push({ key, label: PERSONNEL_FIELD_LABELS[key], from, to });
  }
  return changes;
}

/**
 * Formats changes as "Label: old → new" for an audit log description; sensitive fields show
 * only the label (no values).
 * @param changes - Field changes from diffPersonnelChanges
 * @returns Comma-separated change detail
 */
export function formatPersonnelChanges(changes: PersonnelFieldChange[]): string {
  return changes
    .map(change =>
      VALUE_REDACTED_FIELDS.has(change.key)
        ? change.label
        : `${change.label}: ${change.from || '(trống)'} → ${change.to || '(trống)'}`
    )
    .join(', ');
}
