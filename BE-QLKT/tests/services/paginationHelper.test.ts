import {
  parsePagination,
  normalizeParam,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from '../../src/helpers/paginationHelper';

describe('Chuẩn hóa tham số phân trang (parsePagination)', () => {
  it('Không truyền tham số → dùng giá trị mặc định cho page và limit', () => {
    expect(parsePagination({})).toEqual({ page: DEFAULT_PAGE, limit: DEFAULT_LIMIT });
  });

  it('page/limit dạng chuỗi số → ép về kiểu số', () => {
    expect(parsePagination({ page: '2', limit: '50' })).toEqual({ page: 2, limit: 50 });
  });

  it('limit vượt giới hạn tối đa → kẹp về MAX_LIMIT', () => {
    expect(parsePagination({ limit: '200' }).limit).toBe(MAX_LIMIT);
  });

  it.each([
    ['page âm', { page: '-5' }, 'page', DEFAULT_PAGE],
    ['limit âm', { limit: '-3' }, 'limit', DEFAULT_LIMIT],
    ['page không phải số', { page: 'abc' }, 'page', DEFAULT_PAGE],
    ['limit không phải số', { limit: 'xyz' }, 'limit', DEFAULT_LIMIT],
  ] as const)('Giá trị không hợp lệ (%s) → trả về giá trị mặc định', (_label, query, field, expected) => {
    expect(parsePagination(query)[field as 'page' | 'limit']).toBe(expected);
  });

  it('Tham số bị lặp key (giá trị là mảng) → lấy phần tử đầu tiên', () => {
    expect(parsePagination({ page: ['3', '9'] }).page).toBe(3);
  });

  it('page/limit đã là số nguyên → giữ nguyên đúng giá trị', () => {
    expect(parsePagination({ page: 5, limit: 30 } as Record<string, unknown>)).toEqual({
      page: 5,
      limit: 30,
    });
  });
});

describe('Lấy giá trị đơn từ tham số (normalizeParam)', () => {
  it('Giá trị undefined → trả undefined', () => {
    expect(normalizeParam(undefined)).toBeUndefined();
  });

  it('Giá trị là chuỗi → giữ nguyên chuỗi', () => {
    expect(normalizeParam('abc')).toBe('abc');
  });

  it('Giá trị là mảng → lấy phần tử đầu tiên', () => {
    expect(normalizeParam(['a', 'b'])).toBe('a');
  });
});
