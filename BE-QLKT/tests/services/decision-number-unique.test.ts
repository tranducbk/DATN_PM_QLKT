import { prismaMock } from '../helpers/prismaMock';
import decisionService from '../../src/services/decision.service';
import { AppError, NotFoundError, ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';

interface DecisionRowFixture {
  id: string;
  so_quyet_dinh: string;
  nam: number;
  ngay_ky: Date;
  nguoi_ky: string;
  file_path: string | null;
  loai_khen_thuong: string | null;
  ghi_chu: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const LOAI_KHEN_THUONG_CA_NHAN = PROPOSAL_TYPES.CA_NHAN_HANG_NAM;

/** Stub findMany on bangDeXuat so the cascade rename's pending-proposal scan is a no-op. */
function mockCascadeRenameNoOp(): void {
  prismaMock.bangDeXuat.findMany.mockResolvedValue([] as never);
}

function makeDecision(overrides: Partial<DecisionRowFixture> = {}): DecisionRowFixture {
  return {
    id: overrides.id ?? 'qd-1',
    so_quyet_dinh: overrides.so_quyet_dinh ?? '123/QĐ-BQP',
    nam: overrides.nam ?? 2025,
    ngay_ky: overrides.ngay_ky ?? new Date('2025-03-15'),
    nguoi_ky: overrides.nguoi_ky ?? 'Đại tá Trần Văn B',
    file_path: overrides.file_path ?? null,
    loai_khen_thuong: overrides.loai_khen_thuong ?? LOAI_KHEN_THUONG_CA_NHAN,
    ghi_chu: overrides.ghi_chu ?? null,
    createdAt: overrides.createdAt ?? new Date('2025-03-15T00:00:00Z'),
    updatedAt: overrides.updatedAt ?? new Date('2025-03-15T00:00:00Z'),
  };
}

describe('decision.service - createDecision', () => {
  it('Cho số quyết định mới Khi tạo Thì lưu thành công', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(null);
    const created = makeDecision({ id: 'qd-new', so_quyet_dinh: '999/QĐ-BQP' });
    prismaMock.fileQuyetDinh.create.mockResolvedValueOnce(created as never);

    const result = await decisionService.createDecision({
      so_quyet_dinh: '999/QĐ-BQP',
      nam: 2025,
      ngay_ky: new Date('2025-04-01'),
      nguoi_ky: 'Đại tá Nguyễn Văn A',
      loai_khen_thuong: LOAI_KHEN_THUONG_CA_NHAN,
    });

    expect(prismaMock.fileQuyetDinh.findUnique).toHaveBeenCalledWith({
      where: { so_quyet_dinh: '999/QĐ-BQP' },
    });
    expect(prismaMock.fileQuyetDinh.create).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('qd-new');
  });

  it('Cho số quyết định đã tồn tại Khi tạo Thì throw AppError 409', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(makeDecision() as never);

    await expect(
      decisionService.createDecision({
        so_quyet_dinh: '123/QĐ-BQP',
        nam: 2025,
        ngay_ky: new Date('2025-03-15'),
        nguoi_ky: 'Đại tá Trần Văn B',
        loai_khen_thuong: LOAI_KHEN_THUONG_CA_NHAN,
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(prismaMock.fileQuyetDinh.create).not.toHaveBeenCalled();
  });

  it('Cho số quyết định trùng năm khác Khi tạo Thì vẫn reject (unique global, không scope theo năm)', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(
      makeDecision({ nam: 2024 }) as never
    );

    await expect(
      decisionService.createDecision({
        so_quyet_dinh: '123/QĐ-BQP',
        nam: 2025,
        ngay_ky: new Date('2025-03-15'),
        nguoi_ky: 'Đại tá Trần Văn B',
        loai_khen_thuong: LOAI_KHEN_THUONG_CA_NHAN,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('decision.service - updateDecision', () => {
  it('Cho id tồn tại + số mới chưa dùng Khi update Thì lưu thành công', async () => {
    const existing = makeDecision({ id: 'qd-1', so_quyet_dinh: '123/QĐ-BQP' });
    prismaMock.fileQuyetDinh.findUnique
      .mockResolvedValueOnce(existing as never)
      .mockResolvedValueOnce(null);
    const updated = makeDecision({ id: 'qd-1', so_quyet_dinh: '456/QĐ-BQP' });
    prismaMock.fileQuyetDinh.update.mockResolvedValueOnce(updated as never);
    mockCascadeRenameNoOp();

    const result = await decisionService.updateDecision('qd-1', {
      so_quyet_dinh: '456/QĐ-BQP',
    });

    expect(prismaMock.fileQuyetDinh.findUnique).toHaveBeenNthCalledWith(2, {
      where: { so_quyet_dinh: '456/QĐ-BQP' },
    });
    expect(result.so_quyet_dinh).toBe('456/QĐ-BQP');
  });

  it('Cho id tồn tại + giữ nguyên số Khi update Thì không check duplicate', async () => {
    const existing = makeDecision({ id: 'qd-1', so_quyet_dinh: '123/QĐ-BQP' });
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(existing as never);
    prismaMock.fileQuyetDinh.update.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1', nguoi_ky: 'Đại tá Mới' }) as never
    );

    await decisionService.updateDecision('qd-1', {
      so_quyet_dinh: '123/QĐ-BQP',
      nguoi_ky: 'Đại tá Mới',
    });

    expect(prismaMock.fileQuyetDinh.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.fileQuyetDinh.update).toHaveBeenCalledTimes(1);
  });

  it('Cho số mới đã thuộc row khác Khi update Thì throw AppError 409', async () => {
    const existing = makeDecision({ id: 'qd-1', so_quyet_dinh: '123/QĐ-BQP' });
    const conflict = makeDecision({ id: 'qd-2', so_quyet_dinh: '456/QĐ-BQP' });
    prismaMock.fileQuyetDinh.findUnique
      .mockResolvedValueOnce(existing as never)
      .mockResolvedValueOnce(conflict as never);

    await expect(
      decisionService.updateDecision('qd-1', { so_quyet_dinh: '456/QĐ-BQP' })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.fileQuyetDinh.update).not.toHaveBeenCalled();
  });

  it('Cho id không tồn tại Khi update Thì throw NotFoundError', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(null);

    await expect(
      decisionService.updateDecision('qd-missing', { nguoi_ky: 'Ai đó' })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('decision.service - getDecisionBySoQuyetDinh', () => {
  it('Cho số tồn tại Khi tra cứu Thì trả về row', async () => {
    const row = makeDecision({ so_quyet_dinh: '123/QĐ-BQP' });
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(row as never);

    const result = await decisionService.getDecisionBySoQuyetDinh('123/QĐ-BQP');

    expect(result).not.toBeNull();
    expect(result?.so_quyet_dinh).toBe('123/QĐ-BQP');
  });

  it('Cho số không tồn tại Khi tra cứu Thì trả về null (không throw)', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(null);

    const result = await decisionService.getDecisionBySoQuyetDinh('999/QĐ-BQP');

    expect(result).toBeNull();
  });
});

describe('decision.service - deleteDecision', () => {
  function mockNoAwardLinks(): void {
    const zero = 0;
    prismaMock.thanhTichKhoaHoc.count.mockResolvedValueOnce(zero as never);
    prismaMock.danhHieuHangNam.count
      .mockResolvedValueOnce(zero as never)
      .mockResolvedValueOnce(zero as never)
      .mockResolvedValueOnce(zero as never)
      .mockResolvedValueOnce(zero as never);
    prismaMock.khenThuongHCBVTQ.count.mockResolvedValueOnce(zero as never);
    prismaMock.huanChuongQuanKyQuyetThang.count.mockResolvedValueOnce(zero as never);
    prismaMock.kyNiemChuongVSNXDQDNDVN.count.mockResolvedValueOnce(zero as never);
    prismaMock.khenThuongHCCSVV.count.mockResolvedValueOnce(zero as never);
    prismaMock.khenThuongDotXuat.count.mockResolvedValueOnce(zero as never);
    prismaMock.danhHieuDonViHangNam.count
      .mockResolvedValueOnce(zero as never)
      .mockResolvedValueOnce(zero as never)
      .mockResolvedValueOnce(zero as never);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([] as never);
  }

  it('Cho decision không liên kết award nào Khi xoá Thì gọi delete', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(makeDecision() as never);
    mockNoAwardLinks();
    prismaMock.fileQuyetDinh.delete.mockResolvedValueOnce(makeDecision() as never);

    const result = await decisionService.deleteDecision('qd-1');

    expect(prismaMock.fileQuyetDinh.delete).toHaveBeenCalledWith({ where: { id: 'qd-1' } });
    expect(result.message).toMatch(/thành công/i);
  });

  it('Cho decision đang được dùng trong DanhHieuHangNam Khi xoá Thì throw ValidationError', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(makeDecision() as never);
    prismaMock.thanhTichKhoaHoc.count.mockResolvedValueOnce(0 as never);
    prismaMock.danhHieuHangNam.count
      .mockResolvedValueOnce(2 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongHCBVTQ.count.mockResolvedValueOnce(0 as never);
    prismaMock.huanChuongQuanKyQuyetThang.count.mockResolvedValueOnce(0 as never);
    prismaMock.kyNiemChuongVSNXDQDNDVN.count.mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongHCCSVV.count.mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongDotXuat.count.mockResolvedValueOnce(0 as never);
    prismaMock.danhHieuDonViHangNam.count
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([] as never);

    await expect(decisionService.deleteDecision('qd-1')).rejects.toBeInstanceOf(ValidationError);

    expect(prismaMock.fileQuyetDinh.delete).not.toHaveBeenCalled();
  });

  it('Cho decision đang được dùng ở chain BKBQP cá nhân Khi xoá Thì throw ValidationError', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(makeDecision() as never);
    prismaMock.thanhTichKhoaHoc.count.mockResolvedValueOnce(0 as never);
    prismaMock.danhHieuHangNam.count
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(3 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongHCBVTQ.count.mockResolvedValueOnce(0 as never);
    prismaMock.huanChuongQuanKyQuyetThang.count.mockResolvedValueOnce(0 as never);
    prismaMock.kyNiemChuongVSNXDQDNDVN.count.mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongHCCSVV.count.mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongDotXuat.count.mockResolvedValueOnce(0 as never);
    prismaMock.danhHieuDonViHangNam.count
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([] as never);

    await expect(decisionService.deleteDecision('qd-1')).rejects.toMatchObject({
      message: expect.stringContaining('BKBQP cá nhân: 3 bản ghi'),
    });
  });

  it('Cho decision đang được tham chiếu trong proposal PENDING Khi xoá Thì throw ValidationError + liệt kê đề xuất', async () => {
    const decision = makeDecision({ so_quyet_dinh: '123/QĐ-BQP' });
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(decision as never);
    prismaMock.thanhTichKhoaHoc.count.mockResolvedValueOnce(0 as never);
    prismaMock.danhHieuHangNam.count
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongHCBVTQ.count.mockResolvedValueOnce(0 as never);
    prismaMock.huanChuongQuanKyQuyetThang.count.mockResolvedValueOnce(0 as never);
    prismaMock.kyNiemChuongVSNXDQDNDVN.count.mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongHCCSVV.count.mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongDotXuat.count.mockResolvedValueOnce(0 as never);
    prismaMock.danhHieuDonViHangNam.count
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'bdx-pending',
        status: 'PENDING',
        data_danh_hieu: [{ personnel_id: 'p1', so_quyet_dinh: '123/QĐ-BQP' }],
        data_thanh_tich: null,
        data_nien_han: null,
        data_cong_hien: null,
      },
    ] as never);

    await expect(decisionService.deleteDecision('qd-1')).rejects.toMatchObject({
      message: expect.stringContaining('Đề xuất đang chờ duyệt: 1'),
    });

    expect(prismaMock.fileQuyetDinh.delete).not.toHaveBeenCalled();
  });

  it('Cho decision đang được tham chiếu trong proposal APPROVED + REJECTED Khi xoá Thì throw + liệt kê đủ 2 status', async () => {
    const decision = makeDecision({ so_quyet_dinh: '123/QĐ-BQP' });
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(decision as never);
    prismaMock.thanhTichKhoaHoc.count.mockResolvedValueOnce(0 as never);
    prismaMock.danhHieuHangNam.count
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongHCBVTQ.count.mockResolvedValueOnce(0 as never);
    prismaMock.huanChuongQuanKyQuyetThang.count.mockResolvedValueOnce(0 as never);
    prismaMock.kyNiemChuongVSNXDQDNDVN.count.mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongHCCSVV.count.mockResolvedValueOnce(0 as never);
    prismaMock.khenThuongDotXuat.count.mockResolvedValueOnce(0 as never);
    prismaMock.danhHieuDonViHangNam.count
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(0 as never);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'bdx-approved',
        status: 'APPROVED',
        data_thanh_tich: [{ personnel_id: 'p2', so_quyet_dinh: '123/QĐ-BQP' }],
        data_danh_hieu: null,
        data_nien_han: null,
        data_cong_hien: null,
      },
      {
        id: 'bdx-rejected',
        status: 'REJECTED',
        data_nien_han: [{ personnel_id: 'p3', so_quyet_dinh: '123/QĐ-BQP' }],
        data_danh_hieu: null,
        data_thanh_tich: null,
        data_cong_hien: null,
      },
    ] as never);

    const errorPromise = decisionService.deleteDecision('qd-1');
    await expect(errorPromise).rejects.toBeInstanceOf(ValidationError);
    await expect(errorPromise).rejects.toMatchObject({
      message: expect.stringContaining('Đề xuất đã duyệt (lịch sử): 1'),
    });
    await expect(errorPromise).rejects.toMatchObject({
      message: expect.stringContaining('Đề xuất bị từ chối (lịch sử): 1'),
    });

    expect(prismaMock.fileQuyetDinh.delete).not.toHaveBeenCalled();
  });

  it('Cho id không tồn tại Khi xoá Thì throw NotFoundError', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(null);

    await expect(decisionService.deleteDecision('qd-missing')).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
