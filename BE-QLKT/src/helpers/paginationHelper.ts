/*
 * PAGINATION HELPER — guard chống "list all rows" DoS.
 *
 *  MAX_LIMIT = 100 là HARD CAP: dù FE gửi ?limit=999999, server vẫn cap
 *  về 100. Lý do:
 *    - Tránh response 100MB+ làm sập memory.
 *    - Tránh DB query block lâu (Prisma LIMIT 999999 trên bảng 1M row
 *      vẫn nhanh, nhưng serialize JSON về client mới là bottleneck).
 *    - FE cố tình hay vô tình gửi limit lớn (vd: export Excel) PHẢI
 *      dùng endpoint riêng (vd: /export) chứ không qua list API.
 *
 *  PHÒNG NGỪA NEGATIVE/NaN:
 *    - page < 1 → reset về 1 (Prisma không hỗ trợ offset âm).
 *    - limit < 1 → reset về DEFAULT (tránh OFFSET 0 LIMIT 0 = trả empty).
 *    - parseInt('abc') = NaN → fallback DEFAULT.
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Express query value shape used for pagination parsing. */
interface PaginationQuery {
  page?: string | string[] | undefined;
  limit?: string | string[] | undefined;
}

function normalizeQueryString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

interface PaginationResult {
  page: number;
  limit: number;
}

/**
 * Parses pagination values from request query.
 * @param query - Query object containing `page` and `limit`
 * @returns Normalized page and limit values
 */
function parsePagination(query: PaginationQuery | Record<string, unknown>): PaginationResult {
  let page =
    parseInt(normalizeQueryString((query as Record<string, unknown>).page), 10) || DEFAULT_PAGE;
  let limit =
    parseInt(normalizeQueryString((query as Record<string, unknown>).limit), 10) || DEFAULT_LIMIT;

  if (page < 1) page = DEFAULT_PAGE;
  if (limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return { page, limit };
}

/**
 * Normalizes a route param value to a single string.
 * @param p - Route param value
 * @returns First string value or undefined
 */
function normalizeParam(p: string | string[] | undefined): string | undefined {
  if (p == null) return undefined;
  return Array.isArray(p) ? p[0] : p;
}

export { parsePagination, normalizeParam, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT };
export type { PaginationQuery, PaginationResult };
