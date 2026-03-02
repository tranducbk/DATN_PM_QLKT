/**
 * Danh sách cấp bậc quân đội Việt Nam
 * Từ thấp đến cao
 */
export const MILITARY_RANKS = [
  'Binh nhì',
  'Binh nhất',
  'Hạ sĩ',
  'Trung sĩ',
  'Thượng sĩ',
  'Thiếu úy',
  'Trung úy',
  'Thượng úy',
  'Đại úy',
  'Thiếu tá',
  'Trung tá',
  'Thượng tá',
  'Đại tá',
  'Thiếu tướng',
  'Trung tướng',
  'Thượng tướng',
  'Đại tướng',
] as const;

export type MilitaryRank = (typeof MILITARY_RANKS)[number];
