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

describe('Số quyết định: tạo mới quyết định', () => {
  it('Số quyết định: tạo quyết định với số chưa dùng → lưu thành công', async () => {
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

  it('Số quyết định: tạo quyết định với số đã tồn tại → chặn trùng số quyết định', async () => {
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

  it('Số quyết định: số trùng nhưng năm khác → vẫn chặn trùng số quyết định (số là duy nhất toàn hệ thống, không theo năm)', async () => {
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

describe('Số quyết định: cập nhật quyết định', () => {
  it('Số quyết định: đổi sang số mới chưa dùng → lưu thành công', async () => {
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

  it('Số quyết định: cập nhật mà giữ nguyên số → không kiểm tra trùng', async () => {
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

  it('Số quyết định: đổi sang số đã thuộc quyết định khác → chặn trùng số quyết định', async () => {
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

  it('Số quyết định: cập nhật quyết định không tồn tại → báo không tìm thấy', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(null);

    await expect(
      decisionService.updateDecision('qd-missing', { nguoi_ky: 'Ai đó' })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('Số quyết định: tra cứu theo số quyết định', () => {
  it('Số quyết định: số tồn tại → tra cứu trả về quyết định', async () => {
    const row = makeDecision({ so_quyet_dinh: '123/QĐ-BQP' });
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(row as never);

    const result = await decisionService.getDecisionBySoQuyetDinh('123/QĐ-BQP');

    expect(result).not.toBeNull();
    expect(result?.so_quyet_dinh).toBe('123/QĐ-BQP');
  });

  it('Số quyết định: số không tồn tại → tra cứu trả về rỗng, không báo lỗi', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(null);

    const result = await decisionService.getDecisionBySoQuyetDinh('999/QĐ-BQP');

    expect(result).toBeNull();
  });
});

describe('Số quyết định: xóa quyết định', () => {
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

  it('Số quyết định: quyết định không gắn với khen thưởng nào → xóa thành công', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(makeDecision() as never);
    mockNoAwardLinks();
    prismaMock.fileQuyetDinh.delete.mockResolvedValueOnce(makeDecision() as never);

    const result = await decisionService.deleteDecision('qd-1');

    expect(prismaMock.fileQuyetDinh.delete).toHaveBeenCalledWith({ where: { id: 'qd-1' } });
    expect(result.message).toMatch(/thành công/i);
  });

  it('Số quyết định: quyết định đang gắn với danh hiệu hằng năm → chặn xóa', async () => {
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

  it('Số quyết định: quyết định đang gắn với BKBQP cá nhân → chặn xóa, nêu rõ số bản ghi liên quan', async () => {
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

  it('Số quyết định: quyết định đang được dùng trong đề xuất chờ duyệt → chặn xóa và liệt kê đề xuất', async () => {
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

  it('Số quyết định: quyết định đang được dùng trong đề xuất đã duyệt và bị từ chối → chặn xóa và liệt kê đủ cả hai trạng thái', async () => {
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

  it('Số quyết định: xóa quyết định không tồn tại → báo không tìm thấy', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(null);

    await expect(decisionService.deleteDecision('qd-missing')).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
