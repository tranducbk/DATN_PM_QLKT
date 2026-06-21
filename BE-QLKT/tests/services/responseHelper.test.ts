import type { Response } from 'express';
import ResponseHelper from '../../src/helpers/responseHelper';

type CapturedRes = Response & { status: jest.Mock; json: jest.Mock };

function mockRes(): CapturedRes {
  const res = {} as CapturedRes;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const bodyOf = (res: CapturedRes) => res.json.mock.calls[0][0];
const statusOf = (res: CapturedRes) => res.status.mock.calls[0][0];

describe('ResponseHelper.success', () => {
  it('mặc định: 200, success=true, message="Thành công", không kèm key data khi null', () => {
    const res = mockRes();
    ResponseHelper.success(res);
    expect(statusOf(res)).toBe(200);
    expect(bodyOf(res)).toEqual({ success: true, message: 'Thành công' });
    expect(bodyOf(res)).not.toHaveProperty('data');
  });

  it('kèm data + warning + statusCode tuỳ chỉnh', () => {
    const res = mockRes();
    ResponseHelper.success(res, { data: { id: 1 }, warning: 'w', statusCode: 207, message: 'ok' });
    expect(statusOf(res)).toBe(207);
    expect(bodyOf(res)).toEqual({ success: true, message: 'ok', data: { id: 1 }, warning: 'w' });
  });
});

describe('ResponseHelper.created', () => {
  it('201 với message mặc định "Tạo mới thành công"', () => {
    const res = mockRes();
    ResponseHelper.created(res, { data: { id: 9 } });
    expect(statusOf(res)).toBe(201);
    expect(bodyOf(res)).toEqual({ success: true, message: 'Tạo mới thành công', data: { id: 9 } });
  });
});

describe('ResponseHelper.error', () => {
  it('mặc định: 500, success=false, không kèm details khi null', () => {
    const res = mockRes();
    ResponseHelper.error(res);
    expect(statusOf(res)).toBe(500);
    expect(bodyOf(res)).toEqual({ success: false, message: 'Lỗi hệ thống' });
  });

  it('kèm details khi truyền vào', () => {
    const res = mockRes();
    ResponseHelper.error(res, { message: 'Sai', statusCode: 422, details: ['a'] });
    expect(statusOf(res)).toBe(422);
    expect(bodyOf(res)).toEqual({ success: false, message: 'Sai', details: ['a'] });
  });
});

describe('ResponseHelper shortcuts', () => {
  it.each([
    ['badRequest', 400, 'Dữ liệu không hợp lệ'],
    ['forbidden', 403, 'Không có quyền thực hiện hành động này'],
    ['notFound', 404, 'Không tìm thấy tài nguyên'],
  ] as const)('%s → status %i + message mặc định', (method, code, defaultMsg) => {
    const res = mockRes();
    ResponseHelper[method](res);
    expect(statusOf(res)).toBe(code);
    expect(bodyOf(res)).toEqual({ success: false, message: defaultMsg });
  });

  it('badRequest dùng message tuỳ chỉnh khi truyền', () => {
    const res = mockRes();
    ResponseHelper.badRequest(res, 'CCCD đã tồn tại');
    expect(bodyOf(res)).toEqual({ success: false, message: 'CCCD đã tồn tại' });
  });
});

describe('ResponseHelper.paginated', () => {
  it('ép kiểu page/limit chuỗi sang số và tính totalPages = ceil(total/limit)', () => {
    const res = mockRes();
    ResponseHelper.paginated(res, { data: [1, 2], total: 25, page: '2', limit: '10' });
    expect(statusOf(res)).toBe(200);
    expect(bodyOf(res)).toEqual({
      success: true,
      message: 'Lấy dữ liệu thành công',
      data: [1, 2],
      pagination: { total: 25, page: 2, limit: 10, totalPages: 3 },
    });
  });

  it('kèm stats khi truyền vào', () => {
    const res = mockRes();
    ResponseHelper.paginated(res, { data: [], total: 0, page: 1, limit: 10, stats: { x: 1 } });
    expect(bodyOf(res).stats).toEqual({ x: 1 });
    expect(bodyOf(res).pagination.totalPages).toBe(0);
  });
});
