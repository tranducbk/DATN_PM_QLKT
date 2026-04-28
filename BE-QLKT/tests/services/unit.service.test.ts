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

describe('unit.service - getAllUnits', () => {
  it('Cho hierarchy=true, Khi getAllUnits, Thì trả về danh sách CQDV kèm DVTT con', async () => {
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

  it('Cho hierarchy=false, Khi getAllUnits, Thì trả về danh sách phẳng CQDV + DVTT đã sort theo ma_don_vi', async () => {
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

describe('unit.service - getUnitById', () => {
  it('Cho id của CQDV, Khi getUnitById, Thì trả về CQDV kèm DVTT con', async () => {
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

  it('Cho id không tồn tại, Khi getUnitById, Thì throw NotFoundError', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);

    await expectError(unitService.getUnitById('missing'), NotFoundError);
  });
});

describe('unit.service - createUnit', () => {
  it('Cho ma_don_vi chưa tồn tại và không có parent, Khi createUnit, Thì tạo CQDV mới', async () => {
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

  it('Cho ma_don_vi đã tồn tại trong CQDV, Khi createUnit, Thì throw AppError 409', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: 'cqdv-existing' });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);

    await expectError(
      unitService.createUnit({ ma_don_vi: 'DUP', ten_don_vi: 'Tên' }),
      AppError,
      /Mã đơn vị đã tồn tại/,
    );
  });

  it('Cho có co_quan_don_vi_id parent hợp lệ, Khi createUnit, Thì tạo DVTT mới', async () => {
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

describe('unit.service - updateUnit', () => {
  it('Cho rename ma_don_vi của CQDV trùng đơn vị khác, Khi updateUnit, Thì throw AppError 409', async () => {
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
});

describe('unit.service - deleteUnit', () => {
  it('Cho CQDV còn DVTT con, Khi deleteUnit, Thì throw ValidationError', async () => {
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

  it('Cho CQDV còn quân nhân, Khi deleteUnit, Thì throw ValidationError', async () => {
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

  it('Cho CQDV không có ràng buộc, Khi deleteUnit, Thì xoá thành công', async () => {
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

describe('unit.service - getAllSubUnits', () => {
  it('Cho coQuanDonViId, Khi getAllSubUnits, Thì query DVTT theo parent', async () => {
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([
      { id: 'dvtt-1', ten_don_vi: 'A', ma_don_vi: 'A1' },
    ]);

    const result = await unitService.getAllSubUnits('cqdv-parent');

    expect(result).toHaveLength(1);
    const args = prismaMock.donViTrucThuoc.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ co_quan_don_vi_id: 'cqdv-parent' });
  });

});
