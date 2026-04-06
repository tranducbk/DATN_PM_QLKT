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
