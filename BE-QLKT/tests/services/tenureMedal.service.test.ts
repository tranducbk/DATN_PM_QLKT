import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import tenureMedalService from '../../src/services/tenureMedal.service';
import { ValidationError, NotFoundError, AppError } from '../../src/middlewares/errorHandler';
import { DANH_HIEU_HCCSVV } from '../../src/constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('tenureMedal.service - getAll', () => {
  it('Cho không có filter, Khi gọi getAll, Thì trả về data + pagination với where rỗng', async () => {
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { id: 'hccsvv-1', quan_nhan_id: 'qn-1', nam: 2024, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA },
    ]);
    prismaMock.khenThuongHCCSVV.count.mockResolvedValueOnce(1);

    const result = await tenureMedalService.getAll({}, 1, 50);

    expect(result.data).toHaveLength(1);
    expect(result.pagination).toMatchObject({ page: 1, limit: 50, total: 1, totalPages: 1 });
    const findArgs = prismaMock.khenThuongHCCSVV.findMany.mock.calls[0][0];
    expect(findArgs.where).toEqual({});
    expect(findArgs.orderBy).toEqual({ nam: 'desc' });
  });

  it('Cho filter don_vi_id (CQDV) không include sub units, Khi getAll, Thì where dùng OR cho CQDV và DVTT trực tiếp', async () => {
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.count.mockResolvedValueOnce(0);

    await tenureMedalService.getAll({ don_vi_id: 'cqdv-1' }, 1, 50);

    const findArgs = prismaMock.khenThuongHCCSVV.findMany.mock.calls[0][0];
    expect(findArgs.where.QuanNhan.OR).toEqual([
      { co_quan_don_vi_id: 'cqdv-1' },
      { don_vi_truc_thuoc_id: 'cqdv-1' },
    ]);
    expect(prismaMock.donViTrucThuoc.findMany).not.toHaveBeenCalled();
  });

  it('Cho filter ho_ten + danh_hieu + pagination, Khi getAll, Thì where có contains insensitive và skip/take đúng', async () => {
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.count.mockResolvedValueOnce(0);

    await tenureMedalService.getAll(
      { ho_ten: 'Trần', danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI },
      2,
      10,
    );

    const findArgs = prismaMock.khenThuongHCCSVV.findMany.mock.calls[0][0];
    expect(findArgs.where.QuanNhan.ho_ten).toEqual({ contains: 'Trần', mode: 'insensitive' });
    expect(findArgs.where.danh_hieu).toBe(DANH_HIEU_HCCSVV.HANG_NHI);
    expect(findArgs.skip).toBe(10);
    expect(findArgs.take).toBe(10);
  });
});

describe('tenureMedal.service - getStatistics', () => {
  it('Cho có data, Khi getStatistics, Thì trả về total + byRank + byYear', async () => {
    prismaMock.khenThuongHCCSVV.groupBy
      .mockResolvedValueOnce([
        { danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, _count: { id: 5 } },
        { danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI, _count: { id: 2 } },
      ])
      .mockResolvedValueOnce([
        { nam: 2024, _count: { id: 4 } },
        { nam: 2023, _count: { id: 3 } },
      ]);
    prismaMock.khenThuongHCCSVV.count.mockResolvedValueOnce(7);

    const result = await tenureMedalService.getStatistics();

    expect(result.total).toBe(7);
    expect(result.byRank).toHaveLength(2);
    expect(result.byYear).toHaveLength(2);
  });
});

describe('tenureMedal.service - confirmImport (per-rank duplicate)', () => {
  it('Cho personnel đã có HANG_BA, Khi confirmImport HANG_BA cùng người, Thì transaction upsert (không throw vì cùng rank)', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: 'qn-1', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2020 },
    ]);
    prismaMock.khenThuongHCCSVV.upsert.mockResolvedValueOnce({ id: 'hccsvv-1' });

    const result = await tenureMedalService.confirmImport(
      [
        {
          row: 2,
          personnel_id: 'qn-1',
          ho_ten: 'Nguyễn Văn A',
          cap_bac: null,
          chuc_vu: null,
          nam: 2020,
          thang: 12,
          danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
          so_quyet_dinh: 'QD-001',
          ghi_chu: null,
          history: [],
        },
      ],
      'admin-id',
    );

    expect(result.imported).toBe(1);
    expect(prismaMock.khenThuongHCCSVV.upsert).toHaveBeenCalledTimes(1);
  });

  it('Cho personnel đã có HANG_NHI, Khi confirmImport HANG_BA (rank thấp hơn), Thì throw ValidationError "hạng thấp hơn"', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: 'qn-1', danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI, nam: 2020 },
    ]);

    await expectError(
      tenureMedalService.confirmImport(
        [
          {
            row: 2,
            personnel_id: 'qn-1',
            ho_ten: 'Nguyễn Văn A',
            cap_bac: null,
            chuc_vu: null,
            nam: 2024,
            thang: 12,
            danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
            so_quyet_dinh: 'QD-001',
            ghi_chu: null,
            history: [],
          },
        ],
        'admin-id',
      ),
      ValidationError,
      /hạng thấp hơn/,
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });
});

describe('tenureMedal.service - confirmImport (pending proposal conflict)', () => {
  it('Cho personnel đang có đề xuất NIEN_HAN pending cùng danh hiệu, Khi confirmImport, Thì throw ValidationError "chờ duyệt"', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'prop-1',
        loai_de_xuat: PROPOSAL_TYPES.NIEN_HAN,
        status: PROPOSAL_STATUS.PENDING,
        data_nien_han: [
          { personnel_id: 'qn-1', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA },
        ],
      },
    ]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);

    await expectError(
      tenureMedalService.confirmImport(
        [
          {
            row: 2,
            personnel_id: 'qn-1',
            ho_ten: 'Nguyễn Văn A',
            cap_bac: null,
            chuc_vu: null,
            nam: 2024,
            thang: 12,
            danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
            so_quyet_dinh: 'QD-001',
            ghi_chu: null,
            history: [],
          },
        ],
        'admin-id',
      ),
      ValidationError,
      /chờ duyệt/,
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });
});

describe('tenureMedal.service - createDirect', () => {
  it('Cho personnel chưa có HCCSVV nào, Khi createDirect HANG_BA, Thì tạo record thành công', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({ unit: cqdv, id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.khenThuongHCCSVV.findUnique.mockResolvedValueOnce(null);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.create.mockResolvedValueOnce({
      id: 'hccsvv-new',
      quan_nhan_id: 'qn-1',
      danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
      nam: 2020,
    });

    const result = await tenureMedalService.createDirect(
      {
        quan_nhan_id: 'qn-1',
        danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
        nam: 2020,
        cap_bac: 'Đại uý',
        chuc_vu: 'Trợ lý',
        so_quyet_dinh: 'QD-001',
        ghi_chu: null,
      },
      'SuperAdmin',
    );

    expect(result.id).toBe('hccsvv-new');
    expect(prismaMock.khenThuongHCCSVV.create).toHaveBeenCalledTimes(1);
  });

  it('Cho danh hiệu không hợp lệ, Khi createDirect, Thì throw ValidationError "không hợp lệ"', async () => {
    await expectError(
      tenureMedalService.createDirect(
        {
          quan_nhan_id: 'qn-1',
          danh_hieu: 'INVALID_DANH_HIEU',
          nam: 2020,
        },
        'SuperAdmin',
      ),
      ValidationError,
      /không hợp lệ/,
    );
    expect(prismaMock.khenThuongHCCSVV.create).not.toHaveBeenCalled();
  });

  it('Cho personnel không tồn tại, Khi createDirect, Thì throw NotFoundError', async () => {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(null);

    await expectError(
      tenureMedalService.createDirect(
        {
          quan_nhan_id: 'qn-missing',
          danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
          nam: 2020,
        },
        'SuperAdmin',
      ),
      NotFoundError,
    );
    expect(prismaMock.khenThuongHCCSVV.create).not.toHaveBeenCalled();
  });

  it('Cho personnel đã có cùng danh hiệu, Khi createDirect, Thì throw AppError "đã có"', async () => {
    const personnel = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.khenThuongHCCSVV.findUnique.mockResolvedValueOnce({
      id: 'hccsvv-existing',
      quan_nhan_id: 'qn-1',
      danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
    });

    await expectError(
      tenureMedalService.createDirect(
        {
          quan_nhan_id: 'qn-1',
          danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
          nam: 2020,
        },
        'SuperAdmin',
      ),
      AppError,
      /đã có/,
    );
    expect(prismaMock.khenThuongHCCSVV.create).not.toHaveBeenCalled();
  });
});

describe('tenureMedal.service - deleteAward', () => {
  it('Cho id hợp lệ, Khi deleteAward, Thì xoá record và trả về personnelId + message', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({ unit: cqdv, id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.khenThuongHCCSVV.findUnique.mockResolvedValueOnce({
      id: 'hccsvv-1',
      quan_nhan_id: personnel.id,
      nam: 2020,
      danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
      QuanNhan: personnel,
    });
    prismaMock.khenThuongHCCSVV.delete.mockResolvedValueOnce({ id: 'hccsvv-1' });

    const result = await tenureMedalService.deleteAward('hccsvv-1', 'admin_user');

    expect(result.personnelId).toBe(personnel.id);
    expect(result.message).toContain('Xóa khen thưởng Huy chương Chiến sĩ vẻ vang thành công');
    expect(prismaMock.khenThuongHCCSVV.delete).toHaveBeenCalledWith({ where: { id: 'hccsvv-1' } });
  });

  it('Cho id không tồn tại, Khi deleteAward, Thì throw NotFoundError', async () => {
    prismaMock.khenThuongHCCSVV.findUnique.mockResolvedValueOnce(null);

    await expectError(
      tenureMedalService.deleteAward('hccsvv-missing', 'admin_user'),
      NotFoundError,
    );
    expect(prismaMock.khenThuongHCCSVV.delete).not.toHaveBeenCalled();
  });
});

describe('tenureMedal.service - getUserWithUnit', () => {
  it('Cho userId hợp lệ, Khi getUserWithUnit, Thì query taiKhoan kèm QuanNhan unit ids', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      QuanNhan: { co_quan_don_vi_id: 'cqdv-1', don_vi_truc_thuoc_id: null },
    });

    const result = await tenureMedalService.getUserWithUnit('acc-1');

    expect(result?.QuanNhan?.co_quan_don_vi_id).toBe('cqdv-1');
    const args = prismaMock.taiKhoan.findUnique.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'acc-1' });
  });
});
