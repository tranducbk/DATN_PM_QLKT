import { z } from 'zod';

export interface ChainSqdPair {
  flag: string;
  sqd: string;
  label: string;
}

export const PERSONAL_CHAIN_SQD_PAIRS: ChainSqdPair[] = [
  { flag: 'nhan_bkbqp', sqd: 'so_quyet_dinh_bkbqp', label: 'BKBQP' },
  { flag: 'nhan_cstdtq', sqd: 'so_quyet_dinh_cstdtq', label: 'CSTDTQ' },
  { flag: 'nhan_bkttcp', sqd: 'so_quyet_dinh_bkttcp', label: 'BKTTCP' },
];

export const UNIT_CHAIN_SQD_PAIRS: ChainSqdPair[] = [
  { flag: 'nhan_bkbqp', sqd: 'so_quyet_dinh_bkbqp', label: 'BKBQP' },
  { flag: 'nhan_bkttcp', sqd: 'so_quyet_dinh_bkttcp', label: 'BKTTCP' },
];

/**
 * Adds a Zod issue for every chain pair where the flag is true but the matching
 * so_quyet_dinh_* field is empty/missing.
 * @param value - The object containing chain flag + sqd fields
 * @param ctx - Zod refinement context
 * @param pairs - Chain definition (personal=3 pairs, unit=2 pairs)
 * @param pathPrefix - Optional path prefix for error reporting (e.g., ['title_data', 0])
 */
export function addChainSqdIssues(
  value: Record<string, unknown>,
  ctx: z.RefinementCtx,
  pairs: ChainSqdPair[],
  pathPrefix: (string | number)[] = []
): void {
  for (const { flag, sqd, label } of pairs) {
    if (!value[flag]) continue;
    const sqdValue = (value[sqd] as string | null | undefined) ?? '';
    if (typeof sqdValue !== 'string' || sqdValue.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...pathPrefix, sqd],
        message: `Số quyết định ${label} là bắt buộc khi đánh dấu đã nhận ${label}`,
      });
    }
  }
}
