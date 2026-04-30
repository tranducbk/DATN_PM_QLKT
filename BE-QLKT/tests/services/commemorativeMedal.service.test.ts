import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import commemorativeMedalService from '../../src/services/commemorativeMedal.service';
import { ValidationError, NotFoundError } from '../../src/middlewares/errorHandler';
import { DANH_HIEU_MAP } from '../../src/constants/danhHieu.constants';

const KNC_LABEL = DANH_HIEU_MAP.KNC_VSNXD_QDNDVN;

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('commemorativeMedal.service - getAll', () => {
  it('Cho không có filter, Khi gọi getAll, Thì where rỗng và orderBy nam desc', async () => {
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([
      { id: 'knc-1', quan_nhan_id: 'qn-1', nam: 2024 },
    ]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.count.mockResolvedValueOnce(1);

    const result = await commemorativeMedalService.getAll({}, 1, 50);

    expect(result.data).toHaveLength(1);
    expect(result.pagination).toMatchObject({ page: 1, limit: 50, total: 1, totalPages: 1 });
    const findArgs = prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mock.calls[0][0];
    expect(findArgs.where).toEqual({});
    expect(findArgs.orderBy).toEqual({ nam: 'desc' });
  });

  it('Cho filter don_vi_id (CQDV) không include sub units, Khi getAll, Thì where dùng OR cho CQDV và DVTT trực tiếp', async () => {
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.count.mockResolvedValueOnce(0);

    await commemorativeMedalService.getAll({ don_vi_id: 'cqdv-1' }, 1, 50);

    const findArgs = prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mock.calls[0][0];
    expect(findArgs.where.QuanNhan.OR).toEqual([
      { co_quan_don_vi_id: 'cqdv-1' },
      { don_vi_truc_thuoc_id: 'cqdv-1' },
    ]);
    expect(prismaMock.donViTrucThuoc.findMany).not.toHaveBeenCalled();
  });

  it('Cho filter ho_ten + pagination, Khi getAll, Thì where có contains insensitive và skip/take đúng', async () => {
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.count.mockResolvedValueOnce(0);

    await commemorativeMedalService.getAll({ ho_ten: 'Trần' }, 3, 20);

    const findArgs = prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mock.calls[0][0];
    expect(findArgs.where.QuanNhan.ho_ten).toEqual({ contains: 'Trần', mode: 'insensitive' });
    expect(findArgs.skip).toBe(40);
    expect(findArgs.take).toBe(20);
  });
});

describe('commemorativeMedal.service - getByPersonnelId', () => {
  it('Cho personnel có KNC, Khi getByPersonnelId, Thì trả về mảng 1 phần tử', async () => {
    prismaMock.kyNiemChuongVSNXDQDNDVN.findUnique.mockResolvedValueOnce({
      id: 'knc-1',
      quan_nhan_id: 'qn-1',
      nam: 2024,
    });

    const result = await commemorativeMedalService.getByPersonnelId('qn-1');

    expect(result).toHaveLength(1);
    expect(result[0].quan_nhan_id).toBe('qn-1');
    const findArgs = prismaMock.kyNiemChuongVSNXDQDNDVN.findUnique.mock.calls[0][0];
    expect(findArgs.where).toEqual({ quan_nhan_id: 'qn-1' });
  });

  it('Cho personnel chưa có KNC, Khi getByPersonnelId, Thì trả về mảng rỗng', async () => {
    prismaMock.kyNiemChuongVSNXDQDNDVN.findUnique.mockResolvedValueOnce(null);

    const result = await commemorativeMedalService.getByPersonnelId('qn-2');

    expect(result).toEqual([]);
  });
});

describe('commemorativeMedal.service - getStatistics', () => {
  it('Cho có data, Khi getStatistics, Thì trả về total và byYear groupBy nam desc', async () => {
    prismaMock.kyNiemChuongVSNXDQDNDVN.groupBy.mockResolvedValueOnce([
      { nam: 2024, _count: { id: 4 } },
      { nam: 2023, _count: { id: 1 } },
    ]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.count.mockResolvedValueOnce(5);

    const result = await commemorativeMedalService.getStatistics();

    expect(result.total).toBe(5);
    expect(result.byYear).toHaveLength(2);
    const groupArgs = prismaMock.kyNiemChuongVSNXDQDNDVN.groupBy.mock.calls[0][0];
    expect(groupArgs.by).toEqual(['nam']);
    expect(groupArgs.orderBy).toEqual({ nam: 'desc' });
  });
});

describe('commemorativeMedal.service - getUserWithUnit / getPersonnelById', () => {
  it('Cho personnelId, Khi getPersonnelById, Thì trả về unit ids của quân nhân', async () => {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({
      co_quan_don_vi_id: null,
      don_vi_truc_thuoc_id: 'dvtt-1',
    });

    const result = await commemorativeMedalService.getPersonnelById('qn-1');

    expect(result?.don_vi_truc_thuoc_id).toBe('dvtt-1');
  });
});

describe('commemorativeMedal.service - confirmImport (lifetime conflict)', () => {
  it('Cho personnel chưa có KNC và không pending, Khi confirmImport, Thì upsert thành công', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.upsert.mockResolvedValueOnce({
      id: 'knc-new',
      quan_nhan_id: 'qn-1',
      nam: 2024,
    });

    const result = await commemorativeMedalService.confirmImport(
      [
        {
          row: 2,
          personnel_id: 'qn-1',
          ho_ten: 'Nguyễn Văn A',
          cap_bac: 'Đại uý',
          chuc_vu: 'Trợ lý',
          nam: 2024,
          thang: 12,
          so_quyet_dinh: 'QD-001',
          ghi_chu: null,
          service_years: 25,
          gioi_tinh: 'NAM',
          history: [],
        },
      ],
      'admin-1',
    );

    expect(result.imported).toBe(1);
    expect(prismaMock.kyNiemChuongVSNXDQDNDVN.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.kyNiemChuongVSNXDQDNDVN.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({ quan_nhan_id: 'qn-1' });
  });

  it('Cho personnel đã có KNC, Khi confirmImport, Thì throw ValidationError "đã có Kỷ niệm chương..."', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([
      { quan_nhan_id: 'qn-1', nam: 2020 },
    ]);

    await expectError(
      commemorativeMedalService.confirmImport(
        [
          {
            row: 2,
            personnel_id: 'qn-1',
            ho_ten: 'Nguyễn Văn A',
            cap_bac: null,
            chuc_vu: null,
            nam: 2024,
            thang: 12,
            so_quyet_dinh: 'QD-002',
            ghi_chu: null,
            service_years: 25,
            gioi_tinh: 'NAM',
            history: [],
          },
        ],
        'admin-1',
      ),
      ValidationError,
      new RegExp(`đã có ${KNC_LABEL}`),
    );
    expect(prismaMock.kyNiemChuongVSNXDQDNDVN.upsert).not.toHaveBeenCalled();
  });

  it('Cho personnel đang có đề xuất KNC pending, Khi confirmImport, Thì throw ValidationError "đang có đề xuất ... chờ duyệt"', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      { id: 'prop-1', data_nien_han: [{ personnel_id: 'qn-1' }] },
    ]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([]);

    await expectError(
      commemorativeMedalService.confirmImport(
        [
          {
            row: 2,
            personnel_id: 'qn-1',
            ho_ten: 'Nguyễn Văn A',
            cap_bac: null,
            chuc_vu: null,
            nam: 2024,
            thang: 12,
            so_quyet_dinh: 'QD-001',
            ghi_chu: null,
            service_years: 25,
            gioi_tinh: 'NAM',
            history: [],
          },
        ],
        'admin-1',
      ),
      ValidationError,
      /chờ duyệt/,
    );
    expect(prismaMock.kyNiemChuongVSNXDQDNDVN.upsert).not.toHaveBeenCalled();
  });
});

describe('commemorativeMedal.service - deleteAward', () => {
  it('Cho id hợp lệ, Khi deleteAward, Thì xoá record và trả về personnelId', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({ unit: cqdv, id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    prismaMock.kyNiemChuongVSNXDQDNDVN.findUnique.mockResolvedValueOnce({
      id: 'knc-1',
      quan_nhan_id: personnel.id,
      nam: 2024,
      QuanNhan: personnel,
    });
    prismaMock.kyNiemChuongVSNXDQDNDVN.delete.mockResolvedValueOnce({ id: 'knc-1' });

    const result = await commemorativeMedalService.deleteAward('knc-1', 'admin_user');

    expect(result.personnelId).toBe(personnel.id);
    expect(result.message).toContain('Xóa khen thưởng Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN thành công');
    expect(prismaMock.kyNiemChuongVSNXDQDNDVN.delete).toHaveBeenCalledWith({
      where: { id: 'knc-1' },
    });
  });

  it('Cho id không tồn tại, Khi deleteAward, Thì throw NotFoundError', async () => {
    prismaMock.kyNiemChuongVSNXDQDNDVN.findUnique.mockResolvedValueOnce(null);

    await expectError(
      commemorativeMedalService.deleteAward('knc-missing'),
      NotFoundError,
    );
    expect(prismaMock.kyNiemChuongVSNXDQDNDVN.delete).not.toHaveBeenCalled();
  });
});
