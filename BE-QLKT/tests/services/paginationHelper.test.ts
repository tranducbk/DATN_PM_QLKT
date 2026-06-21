import {
  parsePagination,
  normalizeParam,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../src/helpers/paginationHelper';

describe('parsePagination', () => {
  it('query rỗng → dùng mặc định', () => {
    expect(parsePagination({})).toEqual({ page: DEFAULT_PAGE, limit: DEFAULT_LIMIT });
  });

  it('giá trị hợp lệ dạng chuỗi → ép sang số', () => {
    expect(parsePagination({ page: '2', limit: '50' })).toEqual({ page: 2, limit: 50 });
  });

  it('limit vượt trần → kẹp về MAX_LIMIT', () => {
    expect(parsePagination({ limit: '200' }).limit).toBe(MAX_LIMIT);
  });

  it.each([
    ['page âm', { page: '-5' }, 'page', DEFAULT_PAGE],
    ['limit âm', { limit: '-3' }, 'limit', DEFAULT_LIMIT],
    ['page không phải số', { page: 'abc' }, 'page', DEFAULT_PAGE],
    ['limit không phải số', { limit: 'xyz' }, 'limit', DEFAULT_LIMIT],
  ] as const)('%s → fallback mặc định', (_label, query, field, expected) => {
    expect(parsePagination(query)[field as 'page' | 'limit']).toBe(expected);
  });

  it('giá trị mảng (query trùng key) → lấy phần tử đầu', () => {
    expect(parsePagination({ page: ['3', '9'] }).page).toBe(3);
  });

  it('giá trị số nguyên thuần → chuẩn hoá đúng', () => {
    expect(parsePagination({ page: 5, limit: 30 } as Record<string, unknown>)).toEqual({
      page: 5,
      limit: 30,
    });
  });
});

describe('normalizeParam', () => {
  it('undefined → undefined', () => {
    expect(normalizeParam(undefined)).toBeUndefined();
  });

  it('chuỗi → giữ nguyên', () => {
    expect(normalizeParam('abc')).toBe('abc');
  });

  it('mảng → phần tử đầu', () => {
    expect(normalizeParam(['a', 'b'])).toBe('a');
  });
});
