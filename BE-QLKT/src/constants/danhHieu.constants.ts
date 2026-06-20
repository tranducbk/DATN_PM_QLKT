import type { ProposalType } from './proposalTypes.constants';

/**
 * SYNC NOTICE — Core danh hieu codes are shared with `FE-QLKT/src/constants/danhHieu.constants.ts`.
 *
 * The following exports MUST stay value-identical between BE and FE:
 *   - DANH_HIEU_CA_NHAN_HANG_NAM, DANH_HIEU_DON_VI_HANG_NAM (key set; FE may omit BE-only unit aliases)
 *   - DANH_HIEU_HCCSVV, DANH_HIEU_HCBVTQ
 *   - DANH_HIEU_DAC_BIET
 *   - DANH_HIEU_MAP (display labels; full list)
 *   - CONTRIBUTION_COEFFICIENT_GROUPS, CONTRIBUTION_COEFFICIENT_RANGES
 *
 * Side-only exports (intentionally not shared):
 *   - BE-only: DANH_HIEU_NCKH (uses Vietnamese labels as values for Excel parsing),
 *              NCKH_LABEL_TO_CODE, resolveNckhCode, buildDanhHieuExcelOptions,
 *              resolveDanhHieuCode, HCBVTQ_RANK_KEYS, formatDanhHieuList
 *   - FE-only: THANH_TICH_KHOA_HOC (codes-as-values for FE enum-style),
 *              THANH_TICH_KHOA_HOC_SHORT_LABELS / FULL_LABELS,
 *              AWARD_TAB_LABELS, AWARD_TYPE_MAP, LOAI_KHEN_THUONG_OPTIONS,
 *              DANH_HIEU_OPTIONS, CONTRIBUTION_BASE_REQUIRED_MONTHS
 *
 * When adding a NEW shared code (e.g. a new tier), update BOTH files in the same commit.
 */

export const DANH_HIEU_CA_NHAN_HANG_NAM = {
  CSTDCS: 'CSTDCS',
  CSTT: 'CSTT',
  BKBQP: 'BKBQP',
  CSTDTQ: 'CSTDTQ',
  BKTTCP: 'BKTTCP',
} as const;

export const DANH_HIEU_DON_VI_HANG_NAM = {
  DVQT: 'ĐVQT',
  DVTT: 'ĐVTT',
  BKBQP: 'BKBQP',
  BKTTCP: 'BKTTCP',
} as const;

export const DANH_HIEU_HCCSVV = {
  HANG_BA: 'HCCSVV_HANG_BA',
  HANG_NHI: 'HCCSVV_HANG_NHI',
  HANG_NHAT: 'HCCSVV_HANG_NHAT',
} as const;

export const DANH_HIEU_HCBVTQ = {
  HANG_BA: 'HCBVTQ_HANG_BA',
  HANG_NHI: 'HCBVTQ_HANG_NHI',
  HANG_NHAT: 'HCBVTQ_HANG_NHAT',
} as const;

export const CONTRIBUTION_COEFFICIENT_GROUPS = {
  LEVEL_07: '0.7',
  LEVEL_08: '0.8',
  LEVEL_09_10: '0.9-1.0',
} as const;

export type ContributionCoefficientGroup =
  (typeof CONTRIBUTION_COEFFICIENT_GROUPS)[keyof typeof CONTRIBUTION_COEFFICIENT_GROUPS];

export const CONTRIBUTION_COEFFICIENT_RANGES: Record<
  ContributionCoefficientGroup,
  { min: number; max: number; includeMax: boolean }
> = {
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]: { min: 0.7, max: 0.8, includeMax: false },
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]: { min: 0.8, max: 0.9, includeMax: false },
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: { min: 0.9, max: 1.0, includeMax: true },
};

export const HCBVTQ_RANK_KEYS = {
  HANG_BA: 'HANG_BA',
  HANG_NHI: 'HANG_NHI',
  HANG_NHAT: 'HANG_NHAT',
} as const;

export type HcbvtqRankKey = (typeof HCBVTQ_RANK_KEYS)[keyof typeof HCBVTQ_RANK_KEYS];

// Coefficient groups ordered low to high. A new higher tier appends here and counts
// toward every rank automatically — no rule code changes needed.
export const CONTRIBUTION_COEFFICIENT_GROUP_ORDER = [
  CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07,
  CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08,
  CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10,
] as const;

// Highest to lowest — used when scanning for the highest rank a personnel qualifies for.
export const HCBVTQ_RANKS_HIGH_TO_LOW = [
  HCBVTQ_RANK_KEYS.HANG_NHAT,
  HCBVTQ_RANK_KEYS.HANG_NHI,
  HCBVTQ_RANK_KEYS.HANG_BA,
] as const;

// Lowest coefficient group counted toward each rank; a rank accumulates from its floor up.
export const HCBVTQ_RANK_MIN_GROUP: Record<HcbvtqRankKey, ContributionCoefficientGroup> = {
  [HCBVTQ_RANK_KEYS.HANG_BA]: CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07,
  [HCBVTQ_RANK_KEYS.HANG_NHI]: CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08,
  [HCBVTQ_RANK_KEYS.HANG_NHAT]: CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10,
};

/**
 * Sums qualifying months for an HCBVTQ rank: every coefficient group at or above the
 * rank's floor. Single source for the group-to-rank rule shared by eligibility,
 * profile recalc, import preview and the highest-rank guard.
 * @param months - Months per coefficient group (partial allowed; missing groups count as 0)
 * @param rank - HCBVTQ rank key
 * @returns Cumulative qualifying months for the rank
 */
export function cumulativeMonthsForHcbvtqRank(
  months: Partial<Record<ContributionCoefficientGroup, number>>,
  rank: HcbvtqRankKey
): number {
  const floor = HCBVTQ_RANK_MIN_GROUP[rank];
  const floorIndex = CONTRIBUTION_COEFFICIENT_GROUP_ORDER.indexOf(floor);
  if (floorIndex < 0) return 0;
  return CONTRIBUTION_COEFFICIENT_GROUP_ORDER.slice(floorIndex).reduce(
    (sum, group) => sum + (months[group] ?? 0),
    0
  );
}

export const DANH_HIEU_DAC_BIET = {
  HC_QKQT: 'HC_QKQT',
  KNC_VSNXD_QDNDVN: 'KNC_VSNXD_QDNDVN',
} as const;

export const DANH_HIEU_NCKH = {
  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
} as const;

/** Maps full label back to DB code. */
export const NCKH_LABEL_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(DANH_HIEU_NCKH).map(([code, label]) => [label, code])
);

/**
 * Resolves a NCKH loai value (code or full label) to its DB code.
 * @param input - 'DTKH', 'SKKH', 'Đề tài khoa học', or 'Sáng kiến khoa học'
 * @returns DB code ('DTKH' | 'SKKH') or null if invalid
 */
export function resolveNckhCode(input: string): string | null {
  if (input in DANH_HIEU_NCKH) return input;
  return NCKH_LABEL_TO_CODE[input] ?? null;
}

export const DANH_HIEU_MAP: Record<string, string> = {
  CSTDCS: 'Chiến sĩ thi đua cơ sở',
  CSTT: 'Chiến sĩ tiên tiến',
  CSTDTQ: 'Chiến sĩ thi đua toàn quân',

  ĐVQT: 'Đơn vị quyết thắng',
  ĐVTT: 'Đơn vị tiên tiến',

  BKBQP: 'Bằng khen của Bộ trưởng Bộ Quốc phòng',
  BKTTCP: 'Bằng khen của Thủ tướng Chính phủ',

  HCCSVV_HANG_BA: 'Huy chương Chiến sĩ vẻ vang hạng Ba',
  HCCSVV_HANG_NHI: 'Huy chương Chiến sĩ vẻ vang hạng Nhì',
  HCCSVV_HANG_NHAT: 'Huy chương Chiến sĩ vẻ vang hạng Nhất',

  HCBVTQ_HANG_BA: 'Huân chương Bảo vệ Tổ quốc hạng Ba',
  HCBVTQ_HANG_NHI: 'Huân chương Bảo vệ Tổ quốc hạng Nhì',
  HCBVTQ_HANG_NHAT: 'Huân chương Bảo vệ Tổ quốc hạng Nhất',

  HC_QKQT: 'Huy chương Quân kỳ quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',

  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
};

// Compiler enforces that all ProposalType keys are covered — missing key = type error.
export const LOAI_DE_XUAT_MAP: Record<ProposalType, string> = {
  CA_NHAN_HANG_NAM: 'Cá nhân hằng năm',
  DON_VI_HANG_NAM: 'Đơn vị hằng năm',
  NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
  CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
  DOT_XUAT: 'Khen thưởng đột xuất',
  HC_QKQT: 'Huy chương Quân kỳ quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
  NCKH: 'Thành tích Nghiên cứu khoa học',
};

export const DANH_HIEU_SHORT_MAP: Record<string, string> = {
  CSTDCS: 'Chiến sĩ thi đua cơ sở',
  CSTT: 'Chiến sĩ tiên tiến',
  HCCSVV_HANG_BA: 'HCCSVV hạng Ba',
  HCCSVV_HANG_NHI: 'HCCSVV hạng Nhì',
  HCCSVV_HANG_NHAT: 'HCCSVV hạng Nhất',
  HCBVTQ_HANG_BA: 'HCBVTQ hạng Ba',
  HCBVTQ_HANG_NHI: 'HCBVTQ hạng Nhì',
  HCBVTQ_HANG_NHAT: 'HCBVTQ hạng Nhất',
  HC_QKQT: 'HC quân kỳ quyết thắng',
  KNC_VSNXD_QDNDVN: 'KNC vì sự nghiệp xây dựng QĐNDVN',
  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
};

function normalizeDanhHieuInput(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

/** Reverse map: label (full or short) -> code. Used by Excel import parsing. */
const LABEL_TO_CODE: Record<string, string> = {};
for (const map of [DANH_HIEU_MAP, DANH_HIEU_SHORT_MAP]) {
  for (const [code, label] of Object.entries(map)) {
    LABEL_TO_CODE[normalizeDanhHieuInput(label).toLowerCase()] = code;
  }
}

/**
 * Resolves a danh_hieu input (code, short label, or full label) to its canonical code.
 * @param input - Raw value from Excel
 * @returns Canonical code, or the original input if not found
 */
export function resolveDanhHieuCode(input: string): string {
  const val = normalizeDanhHieuInput(input);
  if (DANH_HIEU_MAP[val] || DANH_HIEU_SHORT_MAP[val]) return val;
  const upper = val.toUpperCase();
  if (DANH_HIEU_MAP[upper] || DANH_HIEU_SHORT_MAP[upper]) return upper;
  return LABEL_TO_CODE[val.toLowerCase()] ?? val;
}

type DanhHieuExcelOptionStyle = 'short' | 'full' | 'code';

/**
 * Builds Excel list validation formula from danh hieu codes.
 * @param codes - Danh hieu codes in desired order
 * @param style - Label style shown in Excel dropdown
 * @returns Excel formula string, e.g. `"A,B,C"`
 */
export function buildDanhHieuExcelOptions(
  codes: readonly string[],
  style: DanhHieuExcelOptionStyle = 'short'
): string {
  const labels = codes.map(code => {
    if (style === 'code') return code;
    if (style === 'full') return DANH_HIEU_MAP[code] || code;
    return DANH_HIEU_SHORT_MAP[code] || DANH_HIEU_MAP[code] || code;
  });
  return `"${labels.join(',')}"`;
}

/** Display fallback for a danh hieu / proposal type code that is null or empty. */
export const UNKNOWN_LABEL = 'Chưa xác định';

/**
 * Returns the display label for danh_hieu.
 * @param danhHieu - Raw code from persistence or UI
 * @returns Display label, UNKNOWN_LABEL when empty, or the original code when unmapped
 */
export function getDanhHieuName(danhHieu: string | null | undefined): string {
  if (!danhHieu) return UNKNOWN_LABEL;
  return DANH_HIEU_MAP[danhHieu] ?? danhHieu;
}

/**
 * Builds display text in the format "Label (CODE)".
 * @param codes - Codes cited in the message
 * @returns Single-line comma-separated list
 */
export function formatDanhHieuList(codes: readonly string[]): string {
  return codes.map(c => getDanhHieuName(c)).join(', ');
}

/**
 * Returns the display label for proposal type.
 * @param loaiDeXuat - Proposal type key
 * @returns Display string or literal fallback
 */
export function getLoaiDeXuatName(loaiDeXuat: string | null | undefined): string {
  if (!loaiDeXuat) return UNKNOWN_LABEL;
  return LOAI_DE_XUAT_MAP[loaiDeXuat as ProposalType] ?? loaiDeXuat;
}

/** Years of service required for each HCCSVV rank. */
export const HCCSVV_YEARS_HANG_BA = 10;
export const HCCSVV_YEARS_HANG_NHI = 15;
export const HCCSVV_YEARS_HANG_NHAT = 20;

/** Minimum years of service for HCQKQT. */
export const HCQKQT_YEARS_REQUIRED = 25;

/** Minimum years of service for KNC VSNXD QDNDVN by gender. */
export const KNC_YEARS_REQUIRED_NAM = 25;
export const KNC_YEARS_REQUIRED_NU = 20;

/** Minimum service months for HCBVTQ baseline (male). */
export const CONTRIBUTION_BASE_REQUIRED_MONTHS = 120; // 10 years
/** Female requirement = 2/3 of male baseline. */
export const CONTRIBUTION_FEMALE_REQUIRED_MONTHS = Math.round(
  CONTRIBUTION_BASE_REQUIRED_MONTHS * (2 / 3)
);

/** CSTDCS and CSTT are stored in the danh_hieu column. */
export const DANH_HIEU_CA_NHAN_CO_BAN = new Set<string>([
  DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
  DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
]);
/** BKBQP, CSTDTQ, and BKTTCP are stored as boolean flags, not in danh_hieu. */
export const DANH_HIEU_CA_NHAN_BANG_KHEN = new Set<string>([
  DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
  DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
  DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
]);

/** DVQT and DVTT are stored in the danh_hieu column. */
export const DANH_HIEU_DON_VI_CO_BAN = new Set<string>([
  DANH_HIEU_DON_VI_HANG_NAM.DVQT,
  DANH_HIEU_DON_VI_HANG_NAM.DVTT,
]);
/** BKBQP and BKTTCP are stored as boolean flags, not in danh_hieu. */
export const DANH_HIEU_DON_VI_BANG_KHEN = new Set<string>([
  DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
  DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
]);

/**
 * Resolves danh_hieu code from record — handles chain awards where danh_hieu is null.
 * @param record - Record with danh_hieu and nhan_* flags
 * @returns Danh hieu code or null
 */
export function resolveDanhHieuFromRecord(record: {
  danh_hieu?: string | null;
  nhan_bkbqp?: boolean;
  nhan_cstdtq?: boolean;
  nhan_bkttcp?: boolean;
}): string | null {
  if (record.danh_hieu) return record.danh_hieu;
  if (record.nhan_bkbqp) return DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP;
  if (record.nhan_cstdtq) return DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ;
  if (record.nhan_bkttcp) return DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;
  return null;
}
