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

describe('HCCSVV (niên hạn): danh sách', () => {
  it('HCCSVV (niên hạn): lấy danh sách không lọc → trả về toàn bộ, sắp xếp năm giảm dần', async () => {
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

  it('HCCSVV (niên hạn): lọc theo đơn vị (CQDV) không gồm đơn vị con → lấy quân nhân thuộc CQDV hoặc DVTT trực tiếp', async () => {
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

  it('HCCSVV (niên hạn): lọc theo họ tên và hạng kèm phân trang → tìm tên không phân biệt hoa thường, lọc đúng hạng và đúng trang', async () => {
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

describe('HCCSVV (niên hạn): thống kê', () => {
  it('HCCSVV (niên hạn): có dữ liệu → trả về tổng số kèm thống kê theo hạng và theo năm', async () => {
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

describe('HCCSVV (niên hạn): nhập Excel (chống trùng theo từng hạng)', () => {
  it('Nhập Excel HCCSVV: quân nhân đã có hạng Ba, nhập lại đúng hạng Ba → tạo (hoặc cập nhật) bản ghi (cùng hạng nên không báo lỗi)', async () => {
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
    );

    expect(result.imported).toBe(1);
    expect(prismaMock.khenThuongHCCSVV.upsert).toHaveBeenCalledTimes(1);
  });

  it('Nhập Excel HCCSVV bị chặn: quân nhân đã có hạng Nhì, nhập hạng Ba (hạng thấp hơn) → báo "hạng thấp hơn" và không lưu', async () => {
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
      ),
      ValidationError,
      /hạng thấp hơn/,
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });
});

describe('HCCSVV (niên hạn): nhập Excel (đang có đề xuất chờ duyệt trùng)', () => {
  it('Nhập Excel HCCSVV bị chặn: quân nhân đang có đề xuất niên hạn cùng hạng chờ duyệt → báo "chờ duyệt" và không lưu', async () => {
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
      ),
      ValidationError,
      /chờ duyệt/,
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });
});

describe('HCCSVV (niên hạn): xóa khen thưởng', () => {
  it('HCCSVV (niên hạn): xóa bản ghi theo id hợp lệ → xóa thành công và trả về mã quân nhân kèm thông báo', async () => {
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

  it('HCCSVV (niên hạn) bị chặn: xóa bản ghi không tồn tại → báo không tìm thấy và không xóa', async () => {
    prismaMock.khenThuongHCCSVV.findUnique.mockResolvedValueOnce(null);

    await expectError(
      tenureMedalService.deleteAward('hccsvv-missing', 'admin_user'),
      NotFoundError,
    );
    expect(prismaMock.khenThuongHCCSVV.delete).not.toHaveBeenCalled();
  });
});

describe('HCCSVV (niên hạn): lấy đơn vị của tài khoản', () => {
  it('HCCSVV (niên hạn): tra tài khoản theo id hợp lệ → trả về tài khoản kèm các mã đơn vị của quân nhân', async () => {
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
