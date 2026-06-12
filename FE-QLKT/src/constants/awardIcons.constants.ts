/**
 * Maps award/title codes (DANH_HIEU_MAP keys) to their illustrated PNG icon
 * under public/Icon. Multi-rank medals (HCCSVV, HCBVTQ) share one icon; the rank
 * is conveyed by the award title text, not a distinct image.
 */
export const AWARD_ICONS: Record<string, string> = {
  CSTDCS: '/Icon/CSTDCS.png',
  CSTT: '/Icon/CSTT.png',
  BKBQP: '/Icon/BKBQP.png',
  CSTDTQ: '/Icon/CSTDTQ.png',
  BKTTCP: '/Icon/BKTTCP.png',

  ĐVTT: '/Icon/DVTT.png',
  ĐVQT: '/Icon/DVQT.png',

  HCCSVV_HANG_BA: '/Icon/HCCSVV.png',
  HCCSVV_HANG_NHI: '/Icon/HCCSVV.png',
  HCCSVV_HANG_NHAT: '/Icon/HCCSVV.png',

  HCBVTQ_HANG_BA: '/Icon/HCBVTQ.png',
  HCBVTQ_HANG_NHI: '/Icon/HCBVTQ.png',
  HCBVTQ_HANG_NHAT: '/Icon/HCBVTQ.png',

  HC_QKQT: '/Icon/HCQKQT.png',
  KNC_VSNXD_QDNDVN: '/Icon/KNC_VSNXD_QDNDVN.png',

  DTKH: '/Icon/NCKH.png',
  SKKH: '/Icon/NCKH.png',
};

/**
 * Resolves the PNG icon path for an award code.
 * @param code - Award/title code (a DANH_HIEU_MAP key)
 * @returns Icon path under public/Icon, or undefined when the code has no icon
 */
export function getAwardIcon(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return AWARD_ICONS[code];
}
