import { prismaMock } from '../helpers/prismaMock';
import {
  cascadeRenameSoQuyetDinh,
  type CascadeRenameSummary,
} from '../../src/services/decision/cascadeRename';
import decisionService from '../../src/services/decision.service';
import { AppError, NotFoundError, ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';

const OLD_SQD = '111/QĐ-BQP';
const NEW_SQD = '222/QĐ-BQP';

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

function makeDecision(overrides: Partial<DecisionRowFixture> = {}): DecisionRowFixture {
  return {
    id: overrides.id ?? 'qd-1',
    so_quyet_dinh: overrides.so_quyet_dinh ?? OLD_SQD,
    nam: overrides.nam ?? 2025,
    ngay_ky: overrides.ngay_ky ?? new Date('2025-03-15'),
    nguoi_ky: overrides.nguoi_ky ?? 'Đại tá A',
    file_path: overrides.file_path ?? null,
    loai_khen_thuong: overrides.loai_khen_thuong ?? PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
    ghi_chu: overrides.ghi_chu ?? null,
    createdAt: overrides.createdAt ?? new Date('2025-03-15T00:00:00Z'),
    updatedAt: overrides.updatedAt ?? new Date('2025-03-15T00:00:00Z'),
  };
}

describe('Đổi quyết định: cập nhật lan tỏa số quyết định trong các đề xuất (mọi trạng thái)', () => {
  it('Đổi quyết định: đề xuất chứa số cũ ở các danh hiệu chuỗi → cập nhật lan tỏa sang số mới ở tất cả ô số quyết định trùng', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'bdx-1',
        data_danh_hieu: [
          { personnel_id: 'p1', so_quyet_dinh: OLD_SQD, danh_hieu: 'CSTDCS' },
          { personnel_id: 'p2', so_quyet_dinh_bkbqp: OLD_SQD },
          { personnel_id: 'p3', so_quyet_dinh_cstdtq: OLD_SQD, so_quyet_dinh_bkttcp: OLD_SQD },
          { personnel_id: 'p4', so_quyet_dinh: 'OTHER/QĐ' },
        ],
        data_thanh_tich: null,
        data_nien_han: null,
        data_cong_hien: null,
      },
    ] as never);
    prismaMock.bangDeXuat.update.mockResolvedValueOnce({ id: 'bdx-1' } as never);

    const summary = await cascadeRenameSoQuyetDinh(prismaMock as never, OLD_SQD, NEW_SQD);

    expect(prismaMock.bangDeXuat.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        data_danh_hieu: true,
        data_thanh_tich: true,
        data_nien_han: true,
        data_cong_hien: true,
      },
    });
    expect(prismaMock.bangDeXuat.update).toHaveBeenCalledTimes(1);
    const updateArg = prismaMock.bangDeXuat.update.mock.calls[0][0] as {
      where: { id: string };
      data: { data_danh_hieu: unknown[] };
    };
    expect(updateArg.where).toEqual({ id: 'bdx-1' });
    const items = updateArg.data.data_danh_hieu;
    expect(items[0]).toMatchObject({ personnel_id: 'p1', so_quyet_dinh: NEW_SQD });
    expect(items[1]).toMatchObject({ personnel_id: 'p2', so_quyet_dinh_bkbqp: NEW_SQD });
    expect(items[2]).toMatchObject({
      personnel_id: 'p3',
      so_quyet_dinh_cstdtq: NEW_SQD,
      so_quyet_dinh_bkttcp: NEW_SQD,
    });
    expect(items[3]).toMatchObject({ personnel_id: 'p4', so_quyet_dinh: 'OTHER/QĐ' });
    expect(summary.proposalsScanned).toBe(1);
    expect(summary.proposalsUpdated).toBe(1);
  });

  it('Đổi quyết định: số cũ nằm ở dữ liệu NCKH, niên hạn và cống hiến → cập nhật lan tỏa đủ cả 3 nhóm', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'bdx-2',
        data_danh_hieu: null,
        data_thanh_tich: [{ personnel_id: 'p1', so_quyet_dinh: OLD_SQD }],
        data_nien_han: [{ personnel_id: 'p2', so_quyet_dinh: OLD_SQD }],
        data_cong_hien: [{ personnel_id: 'p3', so_quyet_dinh: OLD_SQD }],
      },
    ] as never);
    prismaMock.bangDeXuat.update.mockResolvedValueOnce({ id: 'bdx-2' } as never);

    await cascadeRenameSoQuyetDinh(prismaMock as never, OLD_SQD, NEW_SQD);

    const updateArg = prismaMock.bangDeXuat.update.mock.calls[0][0] as {
      data: {
        data_thanh_tich?: unknown[];
        data_nien_han?: unknown[];
        data_cong_hien?: unknown[];
        data_danh_hieu?: unknown[];
      };
    };
    expect(updateArg.data.data_thanh_tich).toEqual([
      { personnel_id: 'p1', so_quyet_dinh: NEW_SQD },
    ]);
    expect(updateArg.data.data_nien_han).toEqual([
      { personnel_id: 'p2', so_quyet_dinh: NEW_SQD },
    ]);
    expect(updateArg.data.data_cong_hien).toEqual([
      { personnel_id: 'p3', so_quyet_dinh: NEW_SQD },
    ]);
    expect(updateArg.data.data_danh_hieu).toBeUndefined();
  });

  it('Đổi quyết định: đề xuất không chứa số cũ → không cập nhật gì', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'bdx-3',
        data_danh_hieu: [{ personnel_id: 'p1', so_quyet_dinh: 'OTHER/QĐ' }],
        data_thanh_tich: null,
        data_nien_han: null,
        data_cong_hien: null,
      },
    ] as never);

    const summary = await cascadeRenameSoQuyetDinh(prismaMock as never, OLD_SQD, NEW_SQD);

    expect(prismaMock.bangDeXuat.update).not.toHaveBeenCalled();
    expect(summary.proposalsScanned).toBe(1);
    expect(summary.proposalsUpdated).toBe(0);
  });

  it('Đổi quyết định: đề xuất không có dữ liệu danh hiệu → không lỗi và không cập nhật', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'bdx-4',
        data_danh_hieu: null,
        data_thanh_tich: null,
        data_nien_han: null,
        data_cong_hien: null,
      },
    ] as never);

    const summary = await cascadeRenameSoQuyetDinh(prismaMock as never, OLD_SQD, NEW_SQD);

    expect(prismaMock.bangDeXuat.update).not.toHaveBeenCalled();
    expect(summary.proposalsUpdated).toBe(0);
  });

  it('Đổi quyết định: dữ liệu danh hiệu sai định dạng (không phải danh sách) → bỏ qua an toàn, không lỗi', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'bdx-5',
        data_danh_hieu: { unexpected: 'shape' },
        data_thanh_tich: null,
        data_nien_han: null,
        data_cong_hien: null,
      },
    ] as never);

    const summary = await cascadeRenameSoQuyetDinh(prismaMock as never, OLD_SQD, NEW_SQD);

    expect(prismaMock.bangDeXuat.update).not.toHaveBeenCalled();
    expect(summary.proposalsUpdated).toBe(0);
  });

  it('Đổi quyết định: trong 3 đề xuất chỉ 1 chứa số cũ → chỉ cập nhật 1, đã quét 3, đã cập nhật 1', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'bdx-hit',
        data_danh_hieu: [{ personnel_id: 'p1', so_quyet_dinh: OLD_SQD }],
        data_thanh_tich: null,
        data_nien_han: null,
        data_cong_hien: null,
      },
      {
        id: 'bdx-miss-1',
        data_danh_hieu: [{ personnel_id: 'p2', so_quyet_dinh: 'OTHER/QĐ' }],
        data_thanh_tich: null,
        data_nien_han: null,
        data_cong_hien: null,
      },
      {
        id: 'bdx-miss-2',
        data_danh_hieu: null,
        data_thanh_tich: null,
        data_nien_han: null,
        data_cong_hien: null,
      },
    ] as never);
    prismaMock.bangDeXuat.update.mockResolvedValueOnce({ id: 'bdx-hit' } as never);

    const summary = await cascadeRenameSoQuyetDinh(prismaMock as never, OLD_SQD, NEW_SQD);

    expect(prismaMock.bangDeXuat.update).toHaveBeenCalledTimes(1);
    expect((prismaMock.bangDeXuat.update.mock.calls[0][0] as { where: { id: string } }).where).toEqual({
      id: 'bdx-hit',
    });
    expect(summary.proposalsScanned).toBe(3);
    expect(summary.proposalsUpdated).toBe(1);
  });

  it('Đổi quyết định: khi quét đề xuất → quét mọi trạng thái, không chỉ riêng đề xuất chờ duyệt', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([] as never);

    await cascadeRenameSoQuyetDinh(prismaMock as never, OLD_SQD, NEW_SQD);

    const findManyArg = prismaMock.bangDeXuat.findMany.mock.calls[0][0] as {
      where?: unknown;
      select: unknown;
    };
    expect(findManyArg.where).toBeUndefined();
    expect(findManyArg.select).toEqual({
      id: true,
      data_danh_hieu: true,
      data_thanh_tich: true,
      data_nien_han: true,
      data_cong_hien: true,
    });
  });

  it('Đổi quyết định: cả đề xuất đã duyệt và bị từ chối nếu chứa số cũ → đều được cập nhật lan tỏa', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'bdx-approved',
        data_danh_hieu: [{ personnel_id: 'p1', so_quyet_dinh: OLD_SQD }],
        data_thanh_tich: null,
        data_nien_han: null,
        data_cong_hien: null,
      },
      {
        id: 'bdx-rejected',
        data_danh_hieu: [{ personnel_id: 'p2', so_quyet_dinh: OLD_SQD }],
        data_thanh_tich: null,
        data_nien_han: null,
        data_cong_hien: null,
      },
    ] as never);
    prismaMock.bangDeXuat.update.mockResolvedValue({ id: 'bdx-x' } as never);

    const summary = await cascadeRenameSoQuyetDinh(prismaMock as never, OLD_SQD, NEW_SQD);

    expect(prismaMock.bangDeXuat.update).toHaveBeenCalledTimes(2);
    expect(summary.proposalsScanned).toBe(2);
    expect(summary.proposalsUpdated).toBe(2);
  });

  it('Đổi quyết định: không có đề xuất nào → đã quét 0, đã cập nhật 0', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([] as never);

    const summary = await cascadeRenameSoQuyetDinh(prismaMock as never, OLD_SQD, NEW_SQD);

    expect(summary.proposalsScanned).toBe(0);
    expect(summary.proposalsUpdated).toBe(0);
    expect(prismaMock.bangDeXuat.update).not.toHaveBeenCalled();
  });
});

describe('Đổi quyết định: cập nhật số quyết định kèm lan tỏa sang đề xuất', () => {
  it('Đổi quyết định: đổi số thành công → chạy trong cùng một giao dịch và cập nhật lan tỏa sang đề xuất', async () => {
    prismaMock.fileQuyetDinh.findUnique
      .mockResolvedValueOnce(makeDecision({ id: 'qd-1', so_quyet_dinh: OLD_SQD }) as never)
      .mockResolvedValueOnce(null);
    prismaMock.fileQuyetDinh.update.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1', so_quyet_dinh: NEW_SQD }) as never
    );
    prismaMock.bangDeXuat.findMany.mockResolvedValue([] as never);

    const result = await decisionService.updateDecision('qd-1', { so_quyet_dinh: NEW_SQD });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(result.so_quyet_dinh).toBe(NEW_SQD);
    expect(result.cascade).not.toBeNull();
    expect(result.cascade?.proposalsScanned).toBe(0);
    expect(result.cascade?.proposalsUpdated).toBe(0);
  });

  it('Đổi quyết định: cập nhật mà giữ nguyên số quyết định → không lan tỏa và không quét đề xuất', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1', so_quyet_dinh: OLD_SQD }) as never
    );
    prismaMock.fileQuyetDinh.update.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1', so_quyet_dinh: OLD_SQD, nguoi_ky: 'Đại tá Mới' }) as never
    );

    const result = await decisionService.updateDecision('qd-1', {
      so_quyet_dinh: OLD_SQD,
      nguoi_ky: 'Đại tá Mới',
    });

    expect(result.cascade).toBeNull();
    expect(prismaMock.bangDeXuat.findMany).not.toHaveBeenCalled();
  });

  it('Đổi quyết định: chỉ sửa người ký, không đụng số quyết định → không lan tỏa', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1', so_quyet_dinh: OLD_SQD }) as never
    );
    prismaMock.fileQuyetDinh.update.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1', so_quyet_dinh: OLD_SQD, nguoi_ky: 'Mới' }) as never
    );

    const result = await decisionService.updateDecision('qd-1', { nguoi_ky: 'Mới' });

    expect(result.cascade).toBeNull();
  });

  it('Đổi quyết định: số mới đã thuộc quyết định khác → báo trùng và không mở giao dịch', async () => {
    prismaMock.fileQuyetDinh.findUnique
      .mockResolvedValueOnce(makeDecision({ id: 'qd-1', so_quyet_dinh: OLD_SQD }) as never)
      .mockResolvedValueOnce(makeDecision({ id: 'qd-2', so_quyet_dinh: NEW_SQD }) as never);

    await expect(
      decisionService.updateDecision('qd-1', { so_quyet_dinh: NEW_SQD })
    ).rejects.toBeInstanceOf(AppError);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.fileQuyetDinh.update).not.toHaveBeenCalled();
  });

  it('Đổi quyết định: cập nhật quyết định không tồn tại → báo không tìm thấy', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(null);

    await expect(
      decisionService.updateDecision('qd-missing', { so_quyet_dinh: NEW_SQD })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('Đổi quyết định: số quyết định mới để trống → từ chối', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1' }) as never
    );

    await expect(
      decisionService.updateDecision('qd-1', { so_quyet_dinh: '   ' })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('Đổi quyết định: số mới có khoảng trắng thừa → cắt khoảng trắng rồi mới kiểm tra trùng và lan tỏa theo giá trị đã cắt', async () => {
    const newWithSpace = `  ${NEW_SQD}  `;
    prismaMock.fileQuyetDinh.findUnique
      .mockResolvedValueOnce(makeDecision({ id: 'qd-1', so_quyet_dinh: OLD_SQD }) as never)
      .mockResolvedValueOnce(null);
    prismaMock.fileQuyetDinh.update.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1', so_quyet_dinh: NEW_SQD }) as never
    );
    prismaMock.bangDeXuat.findMany.mockResolvedValue([] as never);

    await decisionService.updateDecision('qd-1', { so_quyet_dinh: newWithSpace });

    expect(prismaMock.fileQuyetDinh.findUnique).toHaveBeenNthCalledWith(2, {
      where: { so_quyet_dinh: NEW_SQD },
    });
  });

  it('Đổi quyết định: lan tỏa sang đề xuất gặp lỗi giữa chừng → cả thao tác bị hủy theo giao dịch', async () => {
    prismaMock.fileQuyetDinh.findUnique
      .mockResolvedValueOnce(makeDecision({ id: 'qd-1', so_quyet_dinh: OLD_SQD }) as never)
      .mockResolvedValueOnce(null);
    prismaMock.fileQuyetDinh.update.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1', so_quyet_dinh: NEW_SQD }) as never
    );
    prismaMock.bangDeXuat.findMany.mockRejectedValueOnce(new Error('boom'));

    await expect(
      decisionService.updateDecision('qd-1', { so_quyet_dinh: NEW_SQD })
    ).rejects.toThrow('boom');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('Đổi quyết định: bản tóm tắt kết quả lan tỏa', () => {
  it('Đổi quyết định: bản tóm tắt sau lan tỏa chỉ gồm số đề xuất đã quét và số đề xuất đã cập nhật', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([] as never);

    const summary: CascadeRenameSummary = await cascadeRenameSoQuyetDinh(
      prismaMock as never,
      OLD_SQD,
      NEW_SQD
    );

    expect(Object.keys(summary).sort()).toEqual(
      ['proposalsScanned', 'proposalsUpdated'].sort()
    );
  });
});
