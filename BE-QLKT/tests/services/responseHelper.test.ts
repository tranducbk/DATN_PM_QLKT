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

describe('Phản hồi thành công (ResponseHelper.success)', () => {
  it('Không truyền tùy chọn → status 200, success=true, message="Thành công", bỏ key data khi data null', () => {
    const res = mockRes();
    ResponseHelper.success(res);
    expect(statusOf(res)).toBe(200);
    expect(bodyOf(res)).toEqual({ success: true, message: 'Thành công' });
    expect(bodyOf(res)).not.toHaveProperty('data');
  });

  it('Truyền data, warning và statusCode tùy chỉnh → trả đúng các trường đó', () => {
    const res = mockRes();
    ResponseHelper.success(res, { data: { id: 1 }, warning: 'w', statusCode: 207, message: 'ok' });
    expect(statusOf(res)).toBe(207);
    expect(bodyOf(res)).toEqual({ success: true, message: 'ok', data: { id: 1 }, warning: 'w' });
  });
});

describe('Phản hồi tạo mới (ResponseHelper.created)', () => {
  it('Tạo mới → status 201 với message mặc định "Tạo mới thành công"', () => {
    const res = mockRes();
    ResponseHelper.created(res, { data: { id: 9 } });
    expect(statusOf(res)).toBe(201);
    expect(bodyOf(res)).toEqual({ success: true, message: 'Tạo mới thành công', data: { id: 9 } });
  });
});

describe('Phản hồi lỗi (ResponseHelper.error)', () => {
  it('Không truyền tùy chọn → status 500, success=false, bỏ key details khi không có', () => {
    const res = mockRes();
    ResponseHelper.error(res);
    expect(statusOf(res)).toBe(500);
    expect(bodyOf(res)).toEqual({ success: false, message: 'Lỗi hệ thống' });
  });

  it('Truyền details → đính kèm details vào phản hồi', () => {
    const res = mockRes();
    ResponseHelper.error(res, { message: 'Sai', statusCode: 422, details: ['a'] });
    expect(statusOf(res)).toBe(422);
    expect(bodyOf(res)).toEqual({ success: false, message: 'Sai', details: ['a'] });
  });
});

describe('Các phản hồi lỗi rút gọn (badRequest/forbidden/notFound)', () => {
  it.each([
    ['badRequest', 400, 'Dữ liệu không hợp lệ'],
    ['forbidden', 403, 'Không có quyền thực hiện hành động này'],
    ['notFound', 404, 'Không tìm thấy tài nguyên'],
  ] as const)('%s → đúng status %i kèm message mặc định', (method, code, defaultMsg) => {
    const res = mockRes();
    ResponseHelper[method](res);
    expect(statusOf(res)).toBe(code);
    expect(bodyOf(res)).toEqual({ success: false, message: defaultMsg });
  });

  it('Truyền message tùy chỉnh cho badRequest → dùng đúng message đó', () => {
    const res = mockRes();
    ResponseHelper.badRequest(res, 'CCCD đã tồn tại');
    expect(bodyOf(res)).toEqual({ success: false, message: 'CCCD đã tồn tại' });
  });
});

describe('Phản hồi phân trang (ResponseHelper.paginated)', () => {
  it('page/limit dạng chuỗi → ép về số và tính totalPages = ceil(total/limit)', () => {
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

  it('Truyền stats → đính kèm stats và tính totalPages=0 khi total=0', () => {
    const res = mockRes();
    ResponseHelper.paginated(res, { data: [], total: 0, page: 1, limit: 10, stats: { x: 1 } });
    expect(bodyOf(res).stats).toEqual({ x: 1 });
    expect(bodyOf(res).pagination.totalPages).toBe(0);
  });
});
