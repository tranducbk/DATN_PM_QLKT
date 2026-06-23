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

describe('Kỷ niệm chương (KNC): danh sách', () => {
  it('Kỷ niệm chương (KNC): lấy danh sách không lọc → trả về toàn bộ, sắp xếp năm giảm dần', async () => {
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

  it('Kỷ niệm chương (KNC): lọc theo đơn vị (CQDV) không gồm đơn vị con → lấy quân nhân thuộc CQDV hoặc DVTT trực tiếp', async () => {
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

  it('Kỷ niệm chương (KNC): lọc theo họ tên kèm phân trang → tìm tên không phân biệt hoa thường, lấy đúng trang', async () => {
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.count.mockResolvedValueOnce(0);

    await commemorativeMedalService.getAll({ ho_ten: 'Trần' }, 3, 20);

    const findArgs = prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mock.calls[0][0];
    expect(findArgs.where.QuanNhan.ho_ten).toEqual({ contains: 'Trần', mode: 'insensitive' });
    expect(findArgs.skip).toBe(40);
    expect(findArgs.take).toBe(20);
  });
});

describe('Kỷ niệm chương (KNC): tra theo quân nhân', () => {
  it('Kỷ niệm chương (KNC): quân nhân đã có KNC → trả về danh sách 1 phần tử', async () => {
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

  it('Kỷ niệm chương (KNC): quân nhân chưa có KNC → trả về danh sách rỗng', async () => {
    prismaMock.kyNiemChuongVSNXDQDNDVN.findUnique.mockResolvedValueOnce(null);

    const result = await commemorativeMedalService.getByPersonnelId('qn-2');

    expect(result).toEqual([]);
  });
});

describe('Kỷ niệm chương (KNC): thống kê', () => {
  it('Kỷ niệm chương (KNC): có dữ liệu → trả về tổng số và thống kê theo năm (giảm dần)', async () => {
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

describe('Kỷ niệm chương (KNC): lấy đơn vị của quân nhân', () => {
  it('Kỷ niệm chương (KNC): tra quân nhân theo id → trả về các mã đơn vị của quân nhân', async () => {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({
      co_quan_don_vi_id: null,
      don_vi_truc_thuoc_id: 'dvtt-1',
    });

    const result = await commemorativeMedalService.getPersonnelById('qn-1');

    expect(result?.don_vi_truc_thuoc_id).toBe('dvtt-1');
  });
});

describe('Kỷ niệm chương (KNC): nhập Excel (khen thưởng chỉ trao một lần)', () => {
  it('Nhập Excel KNC: quân nhân chưa có KNC và không có đề xuất chờ duyệt → tạo (hoặc cập nhật) bản ghi thành công', async () => {
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

  it('Nhập Excel KNC bị chặn: quân nhân đã có KNC (chỉ trao một lần) → báo "đã có Kỷ niệm chương..." và không lưu', async () => {
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

  it('Nhập Excel KNC bị chặn: quân nhân đang có đề xuất KNC chờ duyệt → báo "đang có đề xuất ... chờ duyệt" và không lưu', async () => {
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

describe('Kỷ niệm chương (KNC): xóa khen thưởng', () => {
  it('Kỷ niệm chương (KNC): xóa bản ghi theo id hợp lệ → xóa thành công và trả về mã quân nhân', async () => {
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

  it('Kỷ niệm chương (KNC) bị chặn: xóa bản ghi không tồn tại → báo không tìm thấy và không xóa', async () => {
    prismaMock.kyNiemChuongVSNXDQDNDVN.findUnique.mockResolvedValueOnce(null);

    await expectError(
      commemorativeMedalService.deleteAward('knc-missing'),
      NotFoundError,
    );
    expect(prismaMock.kyNiemChuongVSNXDQDNDVN.delete).not.toHaveBeenCalled();
  });
});
