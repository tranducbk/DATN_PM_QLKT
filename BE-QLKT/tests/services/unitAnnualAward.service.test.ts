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

describe('Trao khen thưởng hằng năm cho đơn vị: tạo (hoặc cập nhật) bản ghi', () => {
  it('Trao khen thưởng hằng năm: ĐVQT năm 2024 cho CQDV chưa có bản ghi → tạo mới, gắn đúng vào cơ quan đơn vị', async () => {
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

  it('Trao khen thưởng hằng năm: ĐVTT năm 2024 cho ĐVTT chưa có bản ghi → tạo mới, gắn đúng vào đơn vị trực thuộc', async () => {
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

  it('Trao khen thưởng hằng năm: đơn vị đã có ĐVQT, thêm BKBQP → cập nhật bản ghi cũ, không ghi đè danh hiệu cơ bản', async () => {
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

  it('Trao khen thưởng hằng năm: đơn vị thêm BKTTCP vào bản ghi có sẵn → cập nhật cờ và số quyết định BKTTCP', async () => {
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

  it('Trao khen thưởng hằng năm: đơn vị năm 2024 đã có BKBQP, trao BKBQP lần 2 → từ chối "đã có BKBQP"', async () => {
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
      'Đơn vị đã có Bằng khen của Bộ trưởng Bộ Quốc phòng năm 2024'
    );
    expect(prismaMock.danhHieuDonViHangNam.upsert).not.toHaveBeenCalled();
  });

  it('Trao khen thưởng hằng năm: đơn vị năm 2024 đã có ĐVQT, trao thêm ĐVTT → từ chối vì đã có danh hiệu năm đó', async () => {
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

  it('Trao khen thưởng hằng năm: đơn vị năm 2024 đã có BKTTCP, trao BKTTCP lần 2 → từ chối "đã có BKTTCP"', async () => {
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
      'Đơn vị đã có Bằng khen của Thủ tướng Chính phủ năm 2024'
    );
  });

  it('Trao khen thưởng hằng năm: trao cho đơn vị không tồn tại → báo "Đơn vị không tồn tại"', async () => {
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

describe('Trao khen thưởng hằng năm cho đơn vị: gỡ bỏ cả bản ghi', () => {
  it('Gỡ khen thưởng hằng năm: bản ghi đơn vị tồn tại → xóa thành công', async () => {
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
    expect(result).toMatchObject({ id: existing.id });
    expect(prismaMock.danhHieuDonViHangNam.delete).toHaveBeenCalledWith({
      where: { id: existing.id },
    });
  });

  it('Gỡ khen thưởng hằng năm: bản ghi đơn vị không tồn tại → báo không tìm thấy', async () => {
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(null);

    await expectError(
      unitAnnualAwardService.remove('missing-id'),
      NotFoundError,
      'Danh hiệu đơn vị hằng năm không tồn tại'
    );
    expect(prismaMock.danhHieuDonViHangNam.delete).not.toHaveBeenCalled();
  });
});

describe('Trao khen thưởng hằng năm cho đơn vị: bắt buộc có số quyết định', () => {
  it('Trao khen thưởng hằng năm: trao ĐVQT cho CQDV mà thiếu số quyết định → từ chối, không ghi DB', async () => {
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

  it('Trao khen thưởng hằng năm: trao ĐVTT cho ĐVTT mà thiếu số quyết định → từ chối', async () => {
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

  it('Trao khen thưởng hằng năm: trao BKBQP cho đơn vị mà thiếu số quyết định BKBQP → từ chối, không ghi DB', async () => {
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

  it('Trao khen thưởng hằng năm: trao BKTTCP cho đơn vị mà thiếu số quyết định BKTTCP → từ chối', async () => {
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

  it('Trao khen thưởng hằng năm: trao ĐVQT cho CQDV có đủ số quyết định → tạo khen thưởng thành công', async () => {
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

describe('Trao khen thưởng hằng năm cho đơn vị: gỡ bỏ từng danh hiệu trên bản ghi', () => {
  it('Gỡ khen thưởng hằng năm: bản ghi đơn vị có cả ĐVQT và BKBQP, gỡ ĐVQT → chỉ xóa ĐVQT, không xóa cả bản ghi', async () => {
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

  it('Gỡ khen thưởng hằng năm: bản ghi đơn vị trực thuộc còn BKBQP, gỡ ĐVTT → chỉ xóa danh hiệu cơ bản', async () => {
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

  it('Gỡ khen thưởng hằng năm: bản ghi đơn vị còn ĐVQT, gỡ BKBQP → chỉ xóa BKBQP', async () => {
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

  it('Gỡ khen thưởng hằng năm: bản ghi đơn vị còn BKBQP, gỡ BKTTCP → chỉ xóa BKTTCP', async () => {
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

  it('Gỡ khen thưởng hằng năm: ĐVQT là danh hiệu duy nhất trên bản ghi đơn vị, gỡ ĐVQT → xóa luôn cả bản ghi', async () => {
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

  it('Gỡ khen thưởng hằng năm: BKBQP là danh hiệu duy nhất trên bản ghi đơn vị, gỡ BKBQP → xóa luôn cả bản ghi', async () => {
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

  it('Gỡ khen thưởng hằng năm: bản ghi đơn vị chỉ có BKBQP, yêu cầu gỡ ĐVQT → từ chối vì bản ghi không có ĐVQT', async () => {
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

  it('Gỡ khen thưởng hằng năm: loại danh hiệu cần gỡ không hợp lệ → từ chối "loại danh hiệu không hợp lệ"', async () => {
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

  it('Gỡ khen thưởng hằng năm: bản ghi đơn vị không tồn tại → báo không tìm thấy', async () => {
    prismaMock.danhHieuDonViHangNam.findUnique.mockResolvedValueOnce(null);

    await expectError(
      unitAnnualAwardService.remove('not-exist', DANH_HIEU_DON_VI_HANG_NAM.DVQT),
      NotFoundError
    );
  });

  it('Gỡ khen thưởng hằng năm: không nêu loại danh hiệu cần gỡ → xóa luôn cả bản ghi đơn vị (tương thích cũ)', async () => {
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

  it('Gỡ khen thưởng hằng năm: sau khi gỡ một danh hiệu → tính lại hồ sơ của đơn vị đó', async () => {
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
