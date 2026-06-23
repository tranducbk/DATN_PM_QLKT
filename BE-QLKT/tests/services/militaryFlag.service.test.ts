import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import militaryFlagService from '../../src/services/militaryFlag.service';
import { ValidationError, NotFoundError } from '../../src/middlewares/errorHandler';

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('HC QKQT (Quân kỳ quyết thắng): danh sách', () => {
  it('HC QKQT (Quân kỳ quyết thắng): lấy danh sách không lọc → trả về danh sách kèm tổng số bản ghi', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([
      { id: 'hc-1', quan_nhan_id: 'qn-1', nam: 2024 },
    ]);
    prismaMock.huanChuongQuanKyQuyetThang.count.mockResolvedValueOnce(1);

    const result = await militaryFlagService.getAll({}, 1, 50);

    expect(result.data).toHaveLength(1);
    expect(result.pagination).toMatchObject({ page: 1, limit: 50, total: 1, totalPages: 1 });
    const findArgs = prismaMock.huanChuongQuanKyQuyetThang.findMany.mock.calls[0][0];
    expect(findArgs.where).toEqual({});
    expect(findArgs.orderBy).toEqual({ nam: 'desc' });
  });

  it('HC QKQT (Quân kỳ quyết thắng): lọc theo đơn vị (CQDV) không gồm đơn vị con → lấy quân nhân thuộc CQDV hoặc DVTT trực tiếp', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.huanChuongQuanKyQuyetThang.count.mockResolvedValueOnce(0);

    await militaryFlagService.getAll({ don_vi_id: 'cqdv-1' }, 1, 50);

    const findArgs = prismaMock.huanChuongQuanKyQuyetThang.findMany.mock.calls[0][0];
    expect(findArgs.where.QuanNhan.OR).toEqual([
      { co_quan_don_vi_id: 'cqdv-1' },
      { don_vi_truc_thuoc_id: 'cqdv-1' },
    ]);
    expect(prismaMock.donViTrucThuoc.findMany).not.toHaveBeenCalled();
  });

  it('HC QKQT (Quân kỳ quyết thắng): lọc theo đơn vị kèm gồm cả đơn vị con → lấy thêm các DVTT con và gộp vào điều kiện lọc', async () => {
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([
      { id: 'dvtt-a' },
      { id: 'dvtt-b' },
    ]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.huanChuongQuanKyQuyetThang.count.mockResolvedValueOnce(0);

    await militaryFlagService.getAll(
      { don_vi_id: 'cqdv-parent', include_sub_units: true },
      1,
      50,
    );

    expect(prismaMock.donViTrucThuoc.findMany).toHaveBeenCalledWith({
      where: { co_quan_don_vi_id: 'cqdv-parent' },
      select: { id: true },
    });
    const findArgs = prismaMock.huanChuongQuanKyQuyetThang.findMany.mock.calls[0][0];
    expect(findArgs.where.QuanNhan.OR).toEqual([
      { co_quan_don_vi_id: 'cqdv-parent' },
      { don_vi_truc_thuoc_id: { in: ['dvtt-a', 'dvtt-b'] } },
    ]);
  });

  it('HC QKQT (Quân kỳ quyết thắng): lọc theo họ tên và năm → tìm tên không phân biệt hoa thường, lọc đúng năm', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);
    prismaMock.huanChuongQuanKyQuyetThang.count.mockResolvedValueOnce(0);

    await militaryFlagService.getAll({ ho_ten: 'Nguyễn', nam: 2024 }, 2, 10);

    const findArgs = prismaMock.huanChuongQuanKyQuyetThang.findMany.mock.calls[0][0];
    expect(findArgs.where.QuanNhan.ho_ten).toEqual({ contains: 'Nguyễn', mode: 'insensitive' });
    expect(findArgs.where.nam).toBe(2024);
    expect(findArgs.skip).toBe(10);
    expect(findArgs.take).toBe(10);
  });
});

describe('HC QKQT (Quân kỳ quyết thắng): tra theo quân nhân', () => {
  it('HC QKQT (Quân kỳ quyết thắng): quân nhân đã có HC QKQT → trả về danh sách 1 phần tử', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findUnique.mockResolvedValueOnce({
      id: 'hc-1',
      quan_nhan_id: 'qn-1',
      nam: 2024,
    });

    const result = await militaryFlagService.getByPersonnelId('qn-1');

    expect(result).toHaveLength(1);
    expect(result[0].quan_nhan_id).toBe('qn-1');
    const findArgs = prismaMock.huanChuongQuanKyQuyetThang.findUnique.mock.calls[0][0];
    expect(findArgs.where).toEqual({ quan_nhan_id: 'qn-1' });
  });

  it('HC QKQT (Quân kỳ quyết thắng): quân nhân chưa có HC QKQT → trả về danh sách rỗng', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findUnique.mockResolvedValueOnce(null);

    const result = await militaryFlagService.getByPersonnelId('qn-2');

    expect(result).toEqual([]);
  });
});

describe('HC QKQT (Quân kỳ quyết thắng): thống kê', () => {
  it('HC QKQT (Quân kỳ quyết thắng): có dữ liệu → trả về tổng số và thống kê theo năm', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.groupBy.mockResolvedValueOnce([
      { nam: 2024, _count: { id: 3 } },
      { nam: 2023, _count: { id: 2 } },
    ]);
    prismaMock.huanChuongQuanKyQuyetThang.count.mockResolvedValueOnce(5);

    const result = await militaryFlagService.getStatistics();

    expect(result.total).toBe(5);
    expect(result.byYear).toHaveLength(2);
  });
});

describe('HC QKQT (Quân kỳ quyết thắng): lấy đơn vị của tài khoản / quân nhân', () => {
  it('HC QKQT (Quân kỳ quyết thắng): tra tài khoản theo id → trả về tài khoản kèm các mã đơn vị của quân nhân', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      QuanNhan: { co_quan_don_vi_id: 'cqdv-1', don_vi_truc_thuoc_id: null },
    });

    const result = await militaryFlagService.getUserWithUnit('acc-1');

    expect(result?.QuanNhan?.co_quan_don_vi_id).toBe('cqdv-1');
    const args = prismaMock.taiKhoan.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'acc-1' });
  });

  it('HC QKQT (Quân kỳ quyết thắng): tra quân nhân theo id → trả về các mã đơn vị của quân nhân', async () => {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({
      co_quan_don_vi_id: null,
      don_vi_truc_thuoc_id: 'dvtt-1',
    });

    const result = await militaryFlagService.getPersonnelById('qn-1');

    expect(result?.don_vi_truc_thuoc_id).toBe('dvtt-1');
  });
});

describe('HC QKQT (Quân kỳ quyết thắng): xóa khen thưởng', () => {
  it('HC QKQT (Quân kỳ quyết thắng): xóa bản ghi theo id hợp lệ → xóa thành công và trả về mã quân nhân', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({ unit: cqdv, id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.huanChuongQuanKyQuyetThang.findUnique.mockResolvedValueOnce({
      id: 'hc-1',
      quan_nhan_id: personnel.id,
      nam: 2024,
      QuanNhan: personnel,
    });
    prismaMock.huanChuongQuanKyQuyetThang.delete.mockResolvedValueOnce({ id: 'hc-1' });

    const result = await militaryFlagService.deleteAward('hc-1', 'admin_user');

    expect(result.personnelId).toBe(personnel.id);
    expect(result.message).toContain('Xóa khen thưởng Huy chương Quân kỳ quyết thắng thành công');
    expect(prismaMock.huanChuongQuanKyQuyetThang.delete).toHaveBeenCalledWith({
      where: { id: 'hc-1' },
    });
  });

  it('HC QKQT (Quân kỳ quyết thắng) bị chặn: xóa bản ghi không tồn tại → báo không tìm thấy và không xóa', async () => {
    prismaMock.huanChuongQuanKyQuyetThang.findUnique.mockResolvedValueOnce(null);

    await expectError(
      militaryFlagService.deleteAward('hc-missing'),
      NotFoundError,
    );
    expect(prismaMock.huanChuongQuanKyQuyetThang.delete).not.toHaveBeenCalled();
  });
});

describe('HC QKQT (Quân kỳ quyết thắng): nhập Excel (khen thưởng chỉ trao một lần)', () => {
  it('Nhập Excel HC QKQT bị chặn: quân nhân đã có HC QKQT (chỉ trao một lần) → báo "đã có Huy chương Quân kỳ quyết thắng" và không lưu', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([
      { quan_nhan_id: 'qn-1', nam: 2020 },
    ]);

    await expectError(
      militaryFlagService.confirmImport([
        {
          personnel_id: 'qn-1',
          ho_ten: 'Nguyễn Văn A',
          nam: 2024,
          thang: 12,
          so_quyet_dinh: 'QD-002',
        },
      ]),
      ValidationError,
      /đã có Huy chương Quân kỳ quyết thắng/,
    );
    expect(prismaMock.huanChuongQuanKyQuyetThang.upsert).not.toHaveBeenCalled();
  });

  it('Nhập Excel HC QKQT bị chặn: quân nhân đang có đề xuất HC QKQT chờ duyệt → báo "đang có đề xuất ... chờ duyệt" và không lưu', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      { id: 'prop-1', data_nien_han: [{ personnel_id: 'qn-1' }] },
    ]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([]);

    await expectError(
      militaryFlagService.confirmImport([
        {
          personnel_id: 'qn-1',
          ho_ten: 'Nguyễn Văn A',
          nam: 2024,
          thang: 12,
          so_quyet_dinh: 'QD-001',
        },
      ]),
      ValidationError,
      /chờ duyệt/,
    );
    expect(prismaMock.huanChuongQuanKyQuyetThang.upsert).not.toHaveBeenCalled();
  });
});
