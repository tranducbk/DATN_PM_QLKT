import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeUnit, makeUnitAnnualRecord } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import { missingDecisionNumberMessage } from '../helpers/errorMessages';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { NotFoundError, ValidationError } from '../../src/middlewares/errorHandler';
import { DANH_HIEU_DON_VI_HANG_NAM, getDanhHieuName } from '../../src/constants/danhHieu.constants';

beforeEach(() => {
  resetPrismaMock();
  // Skip side-effect recalc — chỉ test DB writes upsert/remove.
  jest
    .spyOn(unitAnnualAwardService, 'recalculateAnnualUnit')
    .mockResolvedValue(undefined as unknown as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Stubs the two `resolveUnit` lookups based on unit kind. */
function arrangeResolveUnit(unit: ReturnType<typeof makeUnit>): void {
  if (unit.kind === 'CQDV') {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: unit.id });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
  } else {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({ id: unit.id });
  }
}

describe('unitAnnualAward.service - upsert', () => {
  it('tạo mới khi chưa có record (CQDV)', async () => {
    // Cho: 1 CQDV chưa có record unit-annual
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);
    const created = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DV-1',
    });
    prismaMock.danhHieuDonViHangNam.upsert.mockResolvedValueOnce(created);

    // Khi
    await unitAnnualAwardService.upsert({
      don_vi_id: cqdv.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DV-1',
      nguoi_tao_id: 'admin-1',
    });

    // Thì: upsert gọi với CQDV foreign key set, DVTT FK null
    expect(prismaMock.danhHieuDonViHangNam.upsert).toHaveBeenCalledTimes(1);
    const args = prismaMock.danhHieuDonViHangNam.upsert.mock.calls[0][0];
    expect(args.create).toMatchObject({
      co_quan_don_vi_id: cqdv.id,
      don_vi_truc_thuoc_id: null,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DV-1',
    });
    expect(args.where).toEqual({
      unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: cqdv.id, nam: 2024 },
    });
  });

  it('tạo mới khi chưa có record (DVTT)', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-1', parentId: 'cqdv-parent' });
    arrangeResolveUnit(dvtt);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.danhHieuDonViHangNam.upsert.mockResolvedValueOnce(
      makeUnitAnnualRecord({
        unitId: dvtt.id,
        unitKind: 'DVTT',
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
        so_quyet_dinh: 'QD-DVTT-1',
      })
    );

    await unitAnnualAwardService.upsert({
      don_vi_id: dvtt.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
      so_quyet_dinh: 'QD-DVTT-1',
      nguoi_tao_id: 'admin-1',
    });

    const args = prismaMock.danhHieuDonViHangNam.upsert.mock.calls[0][0];
    expect(args.create).toMatchObject({
      co_quan_don_vi_id: null,
      don_vi_truc_thuoc_id: dvtt.id,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
    });
    expect(args.where).toEqual({
      unique_don_vi_truc_thuoc_nam_dh: { don_vi_truc_thuoc_id: dvtt.id, nam: 2024 },
    });
  });

  it('merge cờ BKBQP vào record ĐVQT đã có', async () => {
    // Cho: record DVQT đã có, chưa có cờ BKBQP
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-2' });
    arrangeResolveUnit(cqdv);
    const existing = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT-2024',
    });
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(existing);
    prismaMock.danhHieuDonViHangNam.upsert.mockResolvedValueOnce({
      ...existing,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BK-1',
    });

    await unitAnnualAwardService.upsert({
      don_vi_id: cqdv.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QD-BK-1',
      ghi_chu: 'note-bkbqp',
      nguoi_tao_id: 'admin-1',
    });

    const args = prismaMock.danhHieuDonViHangNam.upsert.mock.calls[0][0];
    expect(args.update).toMatchObject({
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BK-1',
      ghi_chu_bkbqp: 'note-bkbqp',
    });
    // Merge BKBQP không được ghi đè field danh_hieu cơ bản
    expect(args.update.danh_hieu).toBeUndefined();
  });

  it('merge cờ BKTTCP vào record có sẵn', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-3' });
    arrangeResolveUnit(cqdv);
    const existing = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT-2024',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QDBK-2024',
    });
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(existing);
    prismaMock.danhHieuDonViHangNam.upsert.mockResolvedValueOnce({
      ...existing,
      nhan_bkttcp: true,
      so_quyet_dinh_bkttcp: 'QD-BKTTCP',
    });

    await unitAnnualAwardService.upsert({
      don_vi_id: cqdv.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
      so_quyet_dinh: 'QD-BKTTCP',
      nguoi_tao_id: 'admin-1',
    });

    const args = prismaMock.danhHieuDonViHangNam.upsert.mock.calls[0][0];
    expect(args.update).toMatchObject({
      nhan_bkttcp: true,
      so_quyet_dinh_bkttcp: 'QD-BKTTCP',
    });
  });

  it('reject thêm cờ BKBQP lần 2', async () => {
    // Cho: record đã bật cờ BKBQP
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-4' });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce({
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      nhan_bkbqp: true,
      nhan_bkttcp: false,
    });

    // Khi + Thì
    await expectError(
      unitAnnualAwardService.upsert({
        don_vi_id: cqdv.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
        nguoi_tao_id: 'admin-1',
      }),
      ValidationError,
      'Đơn vị đã có Bằng khen Bộ Quốc phòng năm 2024'
    );
    expect(prismaMock.danhHieuDonViHangNam.upsert).not.toHaveBeenCalled();
  });

  it('reject thêm danh hiệu cơ bản khi đã có (ĐVQT rồi → ĐVTT)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-5' });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce({
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      nhan_bkbqp: false,
      nhan_bkttcp: false,
    });

    await expectError(
      unitAnnualAwardService.upsert({
        don_vi_id: cqdv.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
        nguoi_tao_id: 'admin-1',
      }),
      ValidationError,
      'Đơn vị đã có danh hiệu Đơn vị quyết thắng năm 2024'
    );
  });

  it('reject thêm cờ BKTTCP lần 2', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-6' });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce({
      danh_hieu: null,
      nhan_bkbqp: false,
      nhan_bkttcp: true,
    });

    await expectError(
      unitAnnualAwardService.upsert({
        don_vi_id: cqdv.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
        nguoi_tao_id: 'admin-1',
      }),
      ValidationError,
      'Đơn vị đã có Bằng khen Thủ tướng Chính phủ năm 2024'
    );
  });

  it('NotFoundError khi đơn vị không tồn tại', async () => {
    // Cho: không có CQDV/DVTT nào match id
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);

    await expectError(
      unitAnnualAwardService.upsert({
        don_vi_id: 'missing-unit',
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        nguoi_tao_id: 'admin-1',
      }),
      NotFoundError,
      'Đơn vị không tồn tại'
    );
  });
});

describe('unitAnnualAward.service - remove', () => {
  it('xoá thành công khi record tồn tại', async () => {
    const existing = makeUnitAnnualRecord({
      unitId: 'cqdv-7',
      unitKind: 'CQDV',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT-2024',
    });
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(existing);
    prismaMock.danhHieuDonViHangNam.delete.mockResolvedValueOnce(existing);

    const result = await unitAnnualAwardService.remove(existing.id);
    expect(result).toBe(true);
    expect(prismaMock.danhHieuDonViHangNam.delete).toHaveBeenCalledWith({
      where: { id: existing.id },
    });
  });

  it('NotFoundError khi record không tồn tại', async () => {
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(null);

    await expectError(
      unitAnnualAwardService.remove('missing-id'),
      NotFoundError,
      'Danh hiệu đơn vị hằng năm không tồn tại'
    );
    expect(prismaMock.danhHieuDonViHangNam.delete).not.toHaveBeenCalled();
  });
});

describe('unitAnnualAward.service - decision-number validation', () => {
  it('upsert ĐVQT (CQDV) thiếu so_quyet_dinh → reject', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-dec-1' });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);

    await expectError(
      unitAnnualAwardService.upsert({
        don_vi_id: cqdv.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        nguoi_tao_id: 'admin-1',
      }),
      ValidationError,
      missingDecisionNumberMessage(cqdv.id, getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.DVQT))
    );
    expect(prismaMock.danhHieuDonViHangNam.upsert).not.toHaveBeenCalled();
  });

  it('upsert ĐVTT (DVTT) thiếu so_quyet_dinh → reject', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-dec-1', parentId: 'cqdv-parent-x' });
    arrangeResolveUnit(dvtt);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);

    await expectError(
      unitAnnualAwardService.upsert({
        don_vi_id: dvtt.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
        nguoi_tao_id: 'admin-1',
      }),
      ValidationError,
      missingDecisionNumberMessage(dvtt.id, getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.DVTT))
    );
  });

  it('upsert BKBQP đơn vị thiếu so_quyet_dinh_bkbqp → reject', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-dec-2' });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce({
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      nhan_bkbqp: false,
      nhan_bkttcp: false,
    });

    await expectError(
      unitAnnualAwardService.upsert({
        don_vi_id: cqdv.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
        nguoi_tao_id: 'admin-1',
      }),
      ValidationError,
      missingDecisionNumberMessage(cqdv.id, getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKBQP))
    );
    expect(prismaMock.danhHieuDonViHangNam.upsert).not.toHaveBeenCalled();
  });

  it('upsert BKTTCP đơn vị thiếu so_quyet_dinh_bkttcp → reject', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-dec-3' });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce({
      danh_hieu: null,
      nhan_bkbqp: false,
      nhan_bkttcp: false,
    });

    await expectError(
      unitAnnualAwardService.upsert({
        don_vi_id: cqdv.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
        nguoi_tao_id: 'admin-1',
      }),
      ValidationError,
      missingDecisionNumberMessage(cqdv.id, getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKTTCP))
    );
  });

  it('upsert ĐVQT (CQDV) đầy đủ so_quyet_dinh → success', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-dec-ok' });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.danhHieuDonViHangNam.upsert.mockResolvedValueOnce(
      makeUnitAnnualRecord({
        unitId: cqdv.id,
        unitKind: 'CQDV',
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: 'QD-OK-DV',
      })
    );

    await unitAnnualAwardService.upsert({
      don_vi_id: cqdv.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-OK-DV',
      nguoi_tao_id: 'admin-1',
    });

    expect(prismaMock.danhHieuDonViHangNam.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('unitAnnualAward.service - remove (granular)', () => {
  it('xóa ĐVQT khi record còn BKBQP → clear danh_hieu/so_quyet_dinh/ghi_chu', async () => {
    // Cho: record unit-annual giữ cả DVQT và BKBQP
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-del-1' });
    const record = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT',
      ghi_chu: 'note',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
      ghi_chu_bkbqp: 'note BKBQP',
    });
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(record);
    prismaMock.danhHieuDonViHangNam.update.mockResolvedValueOnce(record);

    // Khi: chỉ xóa DVQT
    await unitAnnualAwardService.remove(record.id, DANH_HIEU_DON_VI_HANG_NAM.DVQT);

    // Thì: chỉ field danh hiệu chính bị clear, không delete row
    expect(prismaMock.danhHieuDonViHangNam.delete).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuDonViHangNam.update).toHaveBeenCalledTimes(1);
    const args = prismaMock.danhHieuDonViHangNam.update.mock.calls[0][0];
    expect(args.data).toEqual({
      danh_hieu: null,
      so_quyet_dinh: null,
      ghi_chu: null,
    });
  });

  it('xóa ĐVTT khi record còn BKBQP → clear base award (DVTT path)', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-del-1', parentId: 'cqdv-x' });
    const record = makeUnitAnnualRecord({
      unitId: dvtt.id,
      unitKind: 'DVTT',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
      so_quyet_dinh: 'QD-DVTT',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
    });
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(record);
    prismaMock.danhHieuDonViHangNam.update.mockResolvedValueOnce(record);

    await unitAnnualAwardService.remove(record.id, DANH_HIEU_DON_VI_HANG_NAM.DVTT);

    expect(prismaMock.danhHieuDonViHangNam.delete).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuDonViHangNam.update.mock.calls[0][0].data).toEqual({
      danh_hieu: null,
      so_quyet_dinh: null,
      ghi_chu: null,
    });
  });

  it('xóa BKBQP khi record còn ĐVQT → clear cờ BKBQP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-del-2' });
    const record = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
      ghi_chu_bkbqp: 'note',
    });
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(record);
    prismaMock.danhHieuDonViHangNam.update.mockResolvedValueOnce(record);

    await unitAnnualAwardService.remove(record.id, DANH_HIEU_DON_VI_HANG_NAM.BKBQP);

    expect(prismaMock.danhHieuDonViHangNam.delete).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuDonViHangNam.update.mock.calls[0][0].data).toEqual({
      nhan_bkbqp: false,
      so_quyet_dinh_bkbqp: null,
      ghi_chu_bkbqp: null,
    });
  });

  it('xóa BKTTCP khi record còn BKBQP → clear cờ BKTTCP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-del-3' });
    const record = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
      nhan_bkttcp: true,
      so_quyet_dinh_bkttcp: 'QD-BKTTCP',
      ghi_chu_bkttcp: 'note BKTTCP',
    });
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(record);
    prismaMock.danhHieuDonViHangNam.update.mockResolvedValueOnce(record);

    await unitAnnualAwardService.remove(record.id, DANH_HIEU_DON_VI_HANG_NAM.BKTTCP);

    expect(prismaMock.danhHieuDonViHangNam.delete).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuDonViHangNam.update.mock.calls[0][0].data).toEqual({
      nhan_bkttcp: false,
      so_quyet_dinh_bkttcp: null,
      ghi_chu_bkttcp: null,
    });
  });

  it('xóa ĐVQT khi đó là danh hiệu duy nhất → xóa cả row', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-del-4' });
    const record = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT',
    });
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(record);
    prismaMock.danhHieuDonViHangNam.delete.mockResolvedValueOnce(record);

    await unitAnnualAwardService.remove(record.id, DANH_HIEU_DON_VI_HANG_NAM.DVQT);

    expect(prismaMock.danhHieuDonViHangNam.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.danhHieuDonViHangNam.update).not.toHaveBeenCalled();
  });

  it('xóa BKBQP khi đó là danh hiệu duy nhất → xóa cả row', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-del-5' });
    const record = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
    });
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(record);
    prismaMock.danhHieuDonViHangNam.delete.mockResolvedValueOnce(record);

    await unitAnnualAwardService.remove(record.id, DANH_HIEU_DON_VI_HANG_NAM.BKBQP);

    expect(prismaMock.danhHieuDonViHangNam.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.danhHieuDonViHangNam.update).not.toHaveBeenCalled();
  });

  it('xóa ĐVQT khi record không có ĐVQT (chỉ có BKBQP) → ValidationError', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-del-6' });
    const record = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
    });
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(record);

    await expectError(
      unitAnnualAwardService.remove(record.id, DANH_HIEU_DON_VI_HANG_NAM.DVQT),
      ValidationError,
      `Bản ghi không có ${getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.DVQT)}`
    );
    expect(prismaMock.danhHieuDonViHangNam.delete).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuDonViHangNam.update).not.toHaveBeenCalled();
  });

  it('xóa với awardType không hợp lệ → ValidationError', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-del-7' });
    const record = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT',
    });
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(record);

    await expectError(
      unitAnnualAwardService.remove(record.id, 'INVALID'),
      ValidationError,
      { startsWith: 'Loại danh hiệu không hợp lệ' }
    );
  });

  it('xóa record không tồn tại → NotFoundError', async () => {
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(null);

    await expectError(
      unitAnnualAwardService.remove('not-exist', DANH_HIEU_DON_VI_HANG_NAM.DVQT),
      NotFoundError
    );
  });

  it('xóa không truyền awardType → backward compat, xóa cả row', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-del-8' });
    const record = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
    });
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(record);
    prismaMock.danhHieuDonViHangNam.delete.mockResolvedValueOnce(record);

    await unitAnnualAwardService.remove(record.id);

    expect(prismaMock.danhHieuDonViHangNam.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.danhHieuDonViHangNam.update).not.toHaveBeenCalled();
  });

  it('gọi recalc unit sau khi xóa granular', async () => {
    const recalcSpy = jest.spyOn(unitAnnualAwardService, 'recalculateAnnualUnit');
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-del-9' });
    const record = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BKBQP',
    });
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(record);
    prismaMock.danhHieuDonViHangNam.update.mockResolvedValueOnce(record);

    await unitAnnualAwardService.remove(record.id, DANH_HIEU_DON_VI_HANG_NAM.DVQT);

    expect(recalcSpy).toHaveBeenCalledWith(cqdv.id, 2024);
  });
});
