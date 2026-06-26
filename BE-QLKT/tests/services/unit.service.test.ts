import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { expectError } from '../helpers/errorAssert';
import unitService from '../../src/services/unit.service';
import {
  AppError,
  NotFoundError,
  ValidationError,
} from '../../src/middlewares/errorHandler';

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Đơn vị: tra cứu danh sách đơn vị', () => {
  it('Đơn vị: tra cứu dạng cây → trả về danh sách CQDV kèm các DVTT con', async () => {
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      {
        id: 'cqdv-1',
        ma_don_vi: 'A1',
        ten_don_vi: 'Cơ quan A',
        DonViTrucThuoc: [{ id: 'dvtt-1', ma_don_vi: 'A1.1' }],
        ChucVu: [],
      },
    ]);
    prismaMock.coQuanDonVi.count.mockResolvedValueOnce(1);

    const result = await unitService.getAllUnits({ hierarchy: true });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    const args = prismaMock.coQuanDonVi.findMany.mock.calls[0][0];
    expect(args.include).toMatchObject({ DonViTrucThuoc: { include: { ChucVu: true } } });
  });

  it('Đơn vị: tra cứu dạng phẳng → gộp CQDV và DVTT, sắp xếp theo mã đơn vị', async () => {
    prismaMock.coQuanDonVi.findMany.mockResolvedValueOnce([
      { id: 'cqdv-1', ten_don_vi: 'Cơ quan B', ma_don_vi: 'B1' },
    ]);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([
      { id: 'dvtt-1', ten_don_vi: 'Đơn vị A', ma_don_vi: 'A1', CoQuanDonVi: null, ChucVu: [] },
    ]);

    const result = await unitService.getAllUnits({ hierarchy: false });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].ma_don_vi).toBe('A1');
    expect(result.items[1].ma_don_vi).toBe('B1');
  });
});

describe('Đơn vị: tra cứu một đơn vị theo định danh', () => {
  it('Đơn vị: tra cứu một CQDV → trả về CQDV kèm các DVTT con', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: 'cqdv-1',
      ma_don_vi: 'A1',
      ten_don_vi: 'Cơ quan A',
      DonViTrucThuoc: [{ id: 'dvtt-1', ChucVu: [] }],
      ChucVu: [],
    });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);

    const result = await unitService.getUnitById('cqdv-1');

    expect(result?.id).toBe('cqdv-1');
  });

  it('Đơn vị: tra cứu đơn vị không tồn tại → bị chặn', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);

    await expectError(unitService.getUnitById('missing'), NotFoundError);
  });
});

describe('Đơn vị: tạo mới đơn vị', () => {
  it('Đơn vị: tạo với mã chưa trùng và không có đơn vị cha → tạo CQDV mới', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    prismaMock.coQuanDonVi.create.mockResolvedValueOnce({
      id: 'cqdv-new',
      ma_don_vi: 'NEW1',
      ten_don_vi: 'Cơ quan mới',
    });

    const result = await unitService.createUnit({
      ma_don_vi: 'NEW1',
      ten_don_vi: 'Cơ quan mới',
    });

    expect(result.id).toBe('cqdv-new');
    expect(prismaMock.coQuanDonVi.create).toHaveBeenCalled();
    expect(prismaMock.donViTrucThuoc.create).not.toHaveBeenCalled();
  });

  it('Đơn vị: tạo với mã đã trùng CQDV khác → bị chặn vì trùng mã (409)', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: 'cqdv-existing' });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);

    await expectError(
      unitService.createUnit({ ma_don_vi: 'DUP', ten_don_vi: 'Tên' }),
      AppError,
      /Mã đơn vị đã tồn tại/,
    );
  });

  it('Đơn vị: tạo với CQDV cha hợp lệ → tạo DVTT mới trực thuộc', async () => {
    prismaMock.coQuanDonVi.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'cqdv-parent' });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.create.mockResolvedValueOnce({
      id: 'dvtt-new',
      ma_don_vi: 'CHILD1',
      ten_don_vi: 'DVTT mới',
    });

    const result = await unitService.createUnit({
      ma_don_vi: 'CHILD1',
      ten_don_vi: 'DVTT mới',
      co_quan_don_vi_id: 'cqdv-parent',
    });

    expect(result.id).toBe('dvtt-new');
    expect(prismaMock.donViTrucThuoc.create).toHaveBeenCalled();
  });
});

describe('Đơn vị: cập nhật đơn vị', () => {
  it('Đơn vị: đổi mã CQDV thành mã trùng đơn vị khác → bị chặn vì trùng mã (409)', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: 'cqdv-1', ma_don_vi: 'OLD' });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    prismaMock.coQuanDonVi.findFirst.mockResolvedValueOnce({ id: 'cqdv-other' });
    prismaMock.donViTrucThuoc.findFirst.mockResolvedValueOnce(null);

    await expectError(
      unitService.updateUnit('cqdv-1', { ma_don_vi: 'TAKEN' }),
      AppError,
      /Mã đơn vị đã tồn tại/,
    );
  });

  it('Đơn vị: đổi tên DVTT → cập nhật tên vào lịch sử chức vụ của các chức vụ thuộc DVTT', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({ id: 'dvtt-1', ten_don_vi: 'Tên cũ' });
    prismaMock.donViTrucThuoc.update.mockResolvedValueOnce({ id: 'dvtt-1', ten_don_vi: 'Tên mới' });
    prismaMock.chucVu.findMany.mockResolvedValueOnce([{ id: 'cv-1' }, { id: 'cv-2' }]);
    prismaMock.lichSuChucVu.updateMany.mockResolvedValueOnce({ count: 4 });

    await unitService.updateUnit('dvtt-1', { ten_don_vi: 'Tên mới' });

    expect(prismaMock.lichSuChucVu.updateMany).toHaveBeenCalledWith({
      where: { chuc_vu_id: { in: ['cv-1', 'cv-2'] } },
      data: { ten_don_vi_truc_thuoc: 'Tên mới' },
    });
  });

  it('Đơn vị: đổi tên CQDV → cập nhật tên CQDV vào lịch sử của cả chức vụ trực tiếp lẫn chức vụ đơn vị con', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: 'cqdv-1', ten_don_vi: 'CQ cũ' });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    prismaMock.coQuanDonVi.update.mockResolvedValueOnce({ id: 'cqdv-1', ten_don_vi: 'CQ mới' });
    // 1st findMany = chức vụ trực tiếp của CQDV; 2nd = chức vụ của các đơn vị con
    prismaMock.chucVu.findMany
      .mockResolvedValueOnce([{ id: 'cv-direct' }])
      .mockResolvedValueOnce([{ id: 'cv-child' }]);
    prismaMock.lichSuChucVu.updateMany.mockResolvedValue({ count: 2 });

    await unitService.updateUnit('cqdv-1', { ten_don_vi: 'CQ mới' });

    expect(prismaMock.lichSuChucVu.updateMany).toHaveBeenCalledWith({
      where: { chuc_vu_id: { in: ['cv-direct', 'cv-child'] } },
      data: { ten_co_quan_don_vi: 'CQ mới' },
    });
  });
});

describe('Đơn vị: xoá đơn vị', () => {
  it('Đơn vị: xoá CQDV còn 2 DVTT con → bị chặn vì còn ràng buộc', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: 'cqdv-1',
      DonViTrucThuoc: [{ id: 'dvtt-1' }, { id: 'dvtt-2' }],
    });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);

    await expectError(
      unitService.deleteUnit('cqdv-1'),
      ValidationError,
      /còn 2 đơn vị trực thuộc/,
    );
    expect(prismaMock.coQuanDonVi.delete).not.toHaveBeenCalled();
  });

  it('Đơn vị: xoá CQDV còn 3 quân nhân → bị chặn vì còn ràng buộc', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: 'cqdv-1',
      DonViTrucThuoc: [],
    });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    prismaMock.quanNhan.count.mockResolvedValueOnce(3);
    prismaMock.chucVu.count.mockResolvedValueOnce(0);

    await expectError(
      unitService.deleteUnit('cqdv-1'),
      ValidationError,
      /còn 3 quân nhân/,
    );
  });

  it('Đơn vị: xoá CQDV không còn ràng buộc nào → xoá được, báo thành công', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: 'cqdv-1',
      DonViTrucThuoc: [],
    });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    prismaMock.quanNhan.count.mockResolvedValueOnce(0);
    prismaMock.chucVu.count.mockResolvedValueOnce(0);
    prismaMock.coQuanDonVi.delete.mockResolvedValueOnce({ id: 'cqdv-1' });

    const result = await unitService.deleteUnit('cqdv-1');

    expect(result.message).toContain('thành công');
    expect(prismaMock.coQuanDonVi.delete).toHaveBeenCalledWith({ where: { id: 'cqdv-1' } });
  });
});

describe('Đơn vị: tra cứu các DVTT trực thuộc một CQDV', () => {
  it('Đơn vị: tra cứu theo CQDV cha → chỉ lấy các DVTT trực thuộc đúng CQDV đó', async () => {
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([
      { id: 'dvtt-1', ten_don_vi: 'A', ma_don_vi: 'A1' },
    ]);

    const result = await unitService.getAllSubUnits('cqdv-parent');

    expect(result).toHaveLength(1);
    const args = prismaMock.donViTrucThuoc.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ co_quan_don_vi_id: 'cqdv-parent' });
  });

});
