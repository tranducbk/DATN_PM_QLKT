import { prismaMock } from '../helpers/prismaMock';
import {
  cascadeRenameSoQuyetDinh,
  type CascadeRenameSummary,
} from '../../src/services/decision/cascadeRename';
import decisionService from '../../src/services/decision.service';
import { AppError, NotFoundError, ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
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

describe('cascadeRenameSoQuyetDinh — JSON columns trên BangDeXuat PENDING', () => {
  it('Cho data_danh_hieu chứa số cũ Khi cascade Thì update đúng row PENDING + replace tất cả cột chain', async () => {
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
      where: { status: PROPOSAL_STATUS.PENDING },
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

  it('Cho data_thanh_tich + data_nien_han + data_cong_hien chứa số cũ Khi cascade Thì update đủ 3 cột', async () => {
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

  it('Cho proposal PENDING không chứa số cũ Khi cascade Thì không gọi update', async () => {
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

  it('Cho data_danh_hieu là null Khi cascade Thì không crash + không update', async () => {
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

  it('Cho data_danh_hieu là object thay vì array Khi cascade Thì skip an toàn (không crash)', async () => {
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

  it('Cho 3 proposals PENDING (1 trúng + 2 trượt) Khi cascade Thì chỉ update 1 + đếm scanned=3, updated=1', async () => {
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

  it('Cho cascade Khi query proposals Thì filter status=PENDING (không quét APPROVED/REJECTED)', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([] as never);

    await cascadeRenameSoQuyetDinh(prismaMock as never, OLD_SQD, NEW_SQD);

    expect(prismaMock.bangDeXuat.findMany).toHaveBeenCalledWith({
      where: { status: PROPOSAL_STATUS.PENDING },
      select: {
        id: true,
        data_danh_hieu: true,
        data_thanh_tich: true,
        data_nien_han: true,
        data_cong_hien: true,
      },
    });
  });

  it('Cho cascade Khi không tìm thấy proposal PENDING Thì proposalsScanned=0, proposalsUpdated=0', async () => {
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([] as never);

    const summary = await cascadeRenameSoQuyetDinh(prismaMock as never, OLD_SQD, NEW_SQD);

    expect(summary.proposalsScanned).toBe(0);
    expect(summary.proposalsUpdated).toBe(0);
    expect(prismaMock.bangDeXuat.update).not.toHaveBeenCalled();
  });
});

describe('decisionService.updateDecision — tích hợp cascade rename', () => {
  it('Cho rename thành công Khi update Thì wrap trong $transaction + cascade JSON', async () => {
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

  it('Cho update không đổi số quyết định Khi update Thì cascade=null + KHÔNG quét proposals', async () => {
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

  it('Cho update nguyên ngày ký + người ký, không đụng số Khi update Thì cascade=null', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1', so_quyet_dinh: OLD_SQD }) as never
    );
    prismaMock.fileQuyetDinh.update.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1', so_quyet_dinh: OLD_SQD, nguoi_ky: 'Mới' }) as never
    );

    const result = await decisionService.updateDecision('qd-1', { nguoi_ky: 'Mới' });

    expect(result.cascade).toBeNull();
  });

  it('Cho số mới đã tồn tại ở row khác Khi update Thì throw 409 + KHÔNG mở transaction', async () => {
    prismaMock.fileQuyetDinh.findUnique
      .mockResolvedValueOnce(makeDecision({ id: 'qd-1', so_quyet_dinh: OLD_SQD }) as never)
      .mockResolvedValueOnce(makeDecision({ id: 'qd-2', so_quyet_dinh: NEW_SQD }) as never);

    await expect(
      decisionService.updateDecision('qd-1', { so_quyet_dinh: NEW_SQD })
    ).rejects.toBeInstanceOf(AppError);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.fileQuyetDinh.update).not.toHaveBeenCalled();
  });

  it('Cho id không tồn tại Khi update Thì throw NotFoundError', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(null);

    await expect(
      decisionService.updateDecision('qd-missing', { so_quyet_dinh: NEW_SQD })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('Cho số quyết định mới là chuỗi rỗng Khi update Thì throw ValidationError', async () => {
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(
      makeDecision({ id: 'qd-1' }) as never
    );

    await expect(
      decisionService.updateDecision('qd-1', { so_quyet_dinh: '   ' })
    ).rejects.toBeInstanceOf(ValidationError);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('Cho rename Khi service trim số mới Thì duplicate check + cascade dùng đúng giá trị đã trim', async () => {
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

  it('Cho rename + cascade JSON fail giữa chừng Khi update Thì lỗi nổi lên (transaction rollback)', async () => {
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

describe('CascadeRenameSummary shape', () => {
  it('Cho cascade chạy Khi đọc summary Thì có đúng các field proposalsScanned + proposalsUpdated', async () => {
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
