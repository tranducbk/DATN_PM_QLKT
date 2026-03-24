const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Giá trị query Express (string | mảng | ParsedQs) — chỉ chuẩn hóa khi là string/mảng string */
interface PaginationQuery {
  page?: string | string[] | undefined;
  limit?: string | string[] | undefined;
}

function normalizeQueryString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

interface PaginationResult {
  page: number;
  limit: number;
}

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

/** req.params.id có thể là string | string[] */
function normalizeParam(p: string | string[] | undefined): string | undefined {
  if (p == null) return undefined;
  return Array.isArray(p) ? p[0] : p;
}

export { parsePagination, normalizeParam, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT };
export type { PaginationQuery, PaginationResult };
