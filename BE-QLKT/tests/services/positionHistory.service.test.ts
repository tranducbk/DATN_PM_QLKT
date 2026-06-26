import { prismaMock } from '../helpers/prismaMock';
import { expectError } from '../helpers/errorAssert';
import {
  POSITION_HISTORY_PERSONNEL_ID_REQUIRED,
  POSITION_HISTORY_PERSONNEL_ID_REQUIRED_CREATE,
  POSITION_HISTORY_CHUC_VU_ID_REQUIRED,
  POSITION_HISTORY_NGAY_BAT_DAU_REQUIRED,
  POSITION_HISTORY_DATE_ORDER_INVALID,
  POSITION_HISTORY_PERSONNEL_NOT_FOUND,
  POSITION_HISTORY_CHUC_VU_NOT_FOUND,
  POSITION_HISTORY_NOT_FOUND,
  positionHistoryOverlapCreateMessage,
  positionHistoryOverlapUpdateMessage,
} from '../helpers/errorMessages';

import positionHistoryService from '../../src/services/positionHistory.service';
import {
  AppError,
  NotFoundError,
  ValidationError,
} from '../../src/middlewares/errorHandler';

const PERSONNEL_ID = 'qn-pos-1';
const CHUC_VU_ID = 'cv-1';
const CHUC_VU_ID_2 = 'cv-2';

function makePersonnelStub(id = PERSONNEL_ID) {
  return { id, ho_ten: 'QN Test' };
}

function makePositionStub(heSo = 0.5) {
  return { he_so_chuc_vu: heSo };
}

describe('Lịch sử chức vụ: thêm dòng lịch sử', () => {
  it('Lịch sử chức vụ: thêm dòng có chức vụ và ngày bắt đầu → chụp (snapshot) hệ số chức vụ, tính số tháng', async () => {
    // Cho: personnel & position tồn tại, chưa có lịch sử
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(makePersonnelStub());
    prismaMock.chucVu.findUnique.mockResolvedValueOnce(makePositionStub(0.7));
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([]);
    const created = {
      id: 'lscv-1',
      quan_nhan_id: PERSONNEL_ID,
      chuc_vu_id: CHUC_VU_ID,
      he_so_chuc_vu: 0.7,
      ngay_bat_dau: new Date('2023-01-01'),
      ngay_ket_thuc: new Date('2023-12-31'),
      so_thang: 11,
    };
    prismaMock.lichSuChucVu.create.mockResolvedValueOnce(created);

    // Khi
    const result = await positionHistoryService.createPositionHistory({
      personnel_id: PERSONNEL_ID,
      chuc_vu_id: CHUC_VU_ID,
      ngay_bat_dau: '2023-01-01',
      ngay_ket_thuc: '2023-12-31',
    });

    // Thì: snapshot he_so_chuc_vu = 0.7 (từ ChucVu), so_thang được tính
    expect(prismaMock.lichSuChucVu.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.lichSuChucVu.create.mock.calls[0][0];
    expect(createArgs.data.he_so_chuc_vu).toBe(0.7);
    expect(createArgs.data.so_thang).toBe(11);
    expect(result).toEqual(created);
  });

  it('Lịch sử chức vụ: người dùng tự nhập hệ số chức vụ → lưu đúng hệ số nhập tay, bỏ qua hệ số mặc định của chức vụ', async () => {
    // Cho: caller truyền he_so_chuc_vu tùy chỉnh (vd: bản ghi lịch sử)
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(makePersonnelStub());
    prismaMock.chucVu.findUnique.mockResolvedValueOnce(makePositionStub(0.5));
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([]);
    prismaMock.lichSuChucVu.create.mockResolvedValueOnce({ id: 'lscv-x' });

    // Khi
    await positionHistoryService.createPositionHistory({
      personnel_id: PERSONNEL_ID,
      chuc_vu_id: CHUC_VU_ID,
      ngay_bat_dau: '2022-06-15',
      ngay_ket_thuc: '2023-06-15',
      he_so_chuc_vu: 0.9,
    });

    // Thì: lưu nguyên giá trị, bỏ qua ChucVu.he_so_chuc_vu
    const createArgs = prismaMock.lichSuChucVu.create.mock.calls[0][0];
    expect(createArgs.data.he_so_chuc_vu).toBe(0.9);
  });

  it('Lịch sử chức vụ: thêm dòng có ngày kết thúc trước ngày bắt đầu → bị chặn, không lưu', async () => {
    // Khi / Thì: validate trước khi gọi DB
    await expectError(
      positionHistoryService.createPositionHistory({
        personnel_id: PERSONNEL_ID,
        chuc_vu_id: CHUC_VU_ID,
        ngay_bat_dau: '2024-06-01',
        ngay_ket_thuc: '2024-01-01',
      }),
      ValidationError,
      POSITION_HISTORY_DATE_ORDER_INVALID
    );
    expect(prismaMock.lichSuChucVu.create).not.toHaveBeenCalled();
  });

  it('Lịch sử chức vụ: thêm dòng thiếu quân nhân → bị chặn', async () => {
    await expectError(
      positionHistoryService.createPositionHistory({
        personnel_id: '',
        chuc_vu_id: CHUC_VU_ID,
        ngay_bat_dau: '2024-01-01',
      }),
      ValidationError,
      POSITION_HISTORY_PERSONNEL_ID_REQUIRED_CREATE
    );
  });

  it('Lịch sử chức vụ: thêm dòng thiếu chức vụ → bị chặn', async () => {
    await expectError(
      positionHistoryService.createPositionHistory({
        personnel_id: PERSONNEL_ID,
        chuc_vu_id: '',
        ngay_bat_dau: '2024-01-01',
      }),
      ValidationError,
      POSITION_HISTORY_CHUC_VU_ID_REQUIRED
    );
  });

  it('Lịch sử chức vụ: thêm dòng thiếu ngày bắt đầu → bị chặn', async () => {
    await expectError(
      positionHistoryService.createPositionHistory({
        personnel_id: PERSONNEL_ID,
        chuc_vu_id: CHUC_VU_ID,
        ngay_bat_dau: '',
      }),
      ValidationError,
      POSITION_HISTORY_NGAY_BAT_DAU_REQUIRED
    );
  });

  it('Lịch sử chức vụ: thêm dòng cho quân nhân không tồn tại → bị chặn', async () => {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(null);

    await expectError(
      positionHistoryService.createPositionHistory({
        personnel_id: 'qn-missing',
        chuc_vu_id: CHUC_VU_ID,
        ngay_bat_dau: '2024-01-01',
      }),
      NotFoundError,
      POSITION_HISTORY_PERSONNEL_NOT_FOUND
    );
  });

  it('Lịch sử chức vụ: thêm dòng với chức vụ không tồn tại → bị chặn', async () => {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(makePersonnelStub());
    prismaMock.chucVu.findUnique.mockResolvedValueOnce(null);

    await expectError(
      positionHistoryService.createPositionHistory({
        personnel_id: PERSONNEL_ID,
        chuc_vu_id: 'cv-missing',
        ngay_bat_dau: '2024-01-01',
      }),
      NotFoundError,
      POSITION_HISTORY_CHUC_VU_NOT_FOUND
    );
  });

  it('Lịch sử chức vụ: thêm dòng chồng lấn thời gian với dòng đã có của cùng quân nhân → bị chặn (409), không lưu', async () => {
    // Cho: bản ghi đã đóng 2023-01-01 → 2023-12-31
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(makePersonnelStub());
    prismaMock.chucVu.findUnique.mockResolvedValueOnce(makePositionStub(0.5));
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        id: 'lscv-existing',
        ngay_bat_dau: new Date('2023-01-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);

    // Khi / Thì: khoảng mới 2023-06-01 → 2024-06-01 bị overlap
    await expectError(
      positionHistoryService.createPositionHistory({
        personnel_id: PERSONNEL_ID,
        chuc_vu_id: CHUC_VU_ID_2,
        ngay_bat_dau: '2023-06-01',
        ngay_ket_thuc: '2024-06-01',
      }),
      AppError,
      positionHistoryOverlapCreateMessage('01/01/2023', '31/12/2023')
    );
    expect(prismaMock.lichSuChucVu.create).not.toHaveBeenCalled();
  });

  it('Lịch sử chức vụ: thêm dòng không chồng lấn thời gian (bắt đầu sau khi dòng cũ kết thúc) → lưu được', async () => {
    // Cho: bản ghi đã đóng 2022-01-01 → 2022-12-31
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(makePersonnelStub());
    prismaMock.chucVu.findUnique.mockResolvedValueOnce(makePositionStub(0.5));
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        id: 'lscv-old',
        ngay_bat_dau: new Date('2022-01-01'),
        ngay_ket_thuc: new Date('2022-12-31'),
      },
    ]);
    prismaMock.lichSuChucVu.create.mockResolvedValueOnce({ id: 'lscv-new' });

    // Khi: khoảng mới bắt đầu sau khi khoảng cũ kết thúc
    await positionHistoryService.createPositionHistory({
      personnel_id: PERSONNEL_ID,
      chuc_vu_id: CHUC_VU_ID_2,
      ngay_bat_dau: '2023-01-15',
      ngay_ket_thuc: '2023-12-31',
    });

    // Thì
    expect(prismaMock.lichSuChucVu.create).toHaveBeenCalledTimes(1);
  });
});

describe('Lịch sử chức vụ: sửa dòng lịch sử', () => {
  it('Lịch sử chức vụ: sửa ngày kết thúc → tự tính lại số tháng (15/1 → 15/12 = 11 tháng)', async () => {
    // Cho: bản ghi đã đóng tồn tại
    const existing = {
      id: 'lscv-1',
      quan_nhan_id: PERSONNEL_ID,
      chuc_vu_id: CHUC_VU_ID,
      he_so_chuc_vu: 0.5,
      ngay_bat_dau: new Date('2023-01-15'),
      ngay_ket_thuc: new Date('2023-06-15'),
      so_thang: 5,
    };
    prismaMock.lichSuChucVu.findUnique.mockResolvedValueOnce(existing);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([]);
    prismaMock.lichSuChucVu.update.mockResolvedValueOnce({ ...existing, so_thang: 11 });

    // Khi: gia hạn ngày kết thúc đến 2023-12-15
    const result = await positionHistoryService.updatePositionHistory(existing.id, {
      ngay_ket_thuc: '2023-12-15',
    });

    // Thì: so_thang tính lại (15/1 → 15/12 = 11 tháng theo ngày)
    const updateArgs = prismaMock.lichSuChucVu.update.mock.calls[0][0];
    expect(updateArgs.data.so_thang).toBe(11);
    expect(result.warning).toBeNull();
  });

  it('Lịch sử chức vụ: kết thúc thiếu đúng 1 ngày (14 chưa tới mốc ngày 15) → số tháng giảm 1, không làm tròn lên', async () => {
    const existing = {
      id: 'lscv-day-edge',
      quan_nhan_id: PERSONNEL_ID,
      chuc_vu_id: CHUC_VU_ID,
      he_so_chuc_vu: 0.5,
      ngay_bat_dau: new Date('2023-01-15'),
      ngay_ket_thuc: new Date('2023-06-15'),
      so_thang: 5,
    };
    prismaMock.lichSuChucVu.findUnique.mockResolvedValueOnce(existing);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([]);
    prismaMock.lichSuChucVu.update.mockResolvedValueOnce({ ...existing, so_thang: 10 });

    // Khi: kết thúc 2023-12-14 — thiếu đúng 1 ngày so với mốc ngày 15
    await positionHistoryService.updatePositionHistory(existing.id, {
      ngay_ket_thuc: '2023-12-14',
    });

    // Thì: 15/1 → 14/12 = 10 tháng (không phải 11), vì ngày kết thúc < ngày bắt đầu
    const updateArgs = prismaMock.lichSuChucVu.update.mock.calls[0][0];
    expect(updateArgs.data.so_thang).toBe(10);
  });

  it('Lịch sử chức vụ: sửa ngày bắt đầu thành sau ngày kết thúc → bị chặn, không lưu', async () => {
    // Cho: bản ghi đã đóng tồn tại
    prismaMock.lichSuChucVu.findUnique.mockResolvedValueOnce({
      id: 'lscv-1',
      quan_nhan_id: PERSONNEL_ID,
      chuc_vu_id: CHUC_VU_ID,
      he_so_chuc_vu: 0.5,
      ngay_bat_dau: new Date('2023-01-01'),
      ngay_ket_thuc: new Date('2023-06-01'),
      so_thang: 5,
    });

    // Khi: dời ngay_bat_dau sang sau ngay_ket_thuc
    await expectError(
      positionHistoryService.updatePositionHistory('lscv-1', {
        ngay_bat_dau: '2023-12-01',
      }),
      ValidationError,
      POSITION_HISTORY_DATE_ORDER_INVALID
    );
    expect(prismaMock.lichSuChucVu.update).not.toHaveBeenCalled();
  });

  it('Lịch sử chức vụ: sửa khoảng thời gian gây chồng lấn với dòng khác → bị chặn (409)', async () => {
    // Cho: bản ghi target + bản ghi anh em
    prismaMock.lichSuChucVu.findUnique.mockResolvedValueOnce({
      id: 'lscv-1',
      quan_nhan_id: PERSONNEL_ID,
      chuc_vu_id: CHUC_VU_ID,
      he_so_chuc_vu: 0.5,
      ngay_bat_dau: new Date('2023-01-01'),
      ngay_ket_thuc: new Date('2023-06-01'),
      so_thang: 5,
    });
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        id: 'lscv-sibling',
        ngay_bat_dau: new Date('2023-08-01'),
        ngay_ket_thuc: new Date('2023-12-31'),
      },
    ]);

    // Khi: gia hạn ngày kết thúc target vào khoảng anh em
    await expectError(
      positionHistoryService.updatePositionHistory('lscv-1', {
        ngay_ket_thuc: '2023-09-01',
      }),
      AppError,
      positionHistoryOverlapUpdateMessage('01/08/2023', '31/12/2023')
    );
  });

  it('Lịch sử chức vụ: sửa dòng không tồn tại → bị chặn', async () => {
    prismaMock.lichSuChucVu.findUnique.mockResolvedValueOnce(null);

    await expectError(
      positionHistoryService.updatePositionHistory('lscv-missing', {
        ngay_ket_thuc: '2024-01-01',
      }),
      NotFoundError,
      POSITION_HISTORY_NOT_FOUND
    );
  });
});

describe('Lịch sử chức vụ: xoá dòng lịch sử', () => {
  it('Lịch sử chức vụ: xoá dòng đã đóng → trả về quân nhân để tính lại tổng số tháng', async () => {
    // Cho: bản ghi tồn tại
    const existing = {
      id: 'lscv-1',
      quan_nhan_id: PERSONNEL_ID,
      chuc_vu_id: CHUC_VU_ID,
      he_so_chuc_vu: 0.5,
      ngay_bat_dau: new Date('2023-01-01'),
      ngay_ket_thuc: new Date('2023-06-01'),
      so_thang: 5,
    };
    prismaMock.lichSuChucVu.findUnique.mockResolvedValueOnce(existing);
    prismaMock.lichSuChucVu.delete.mockResolvedValueOnce(existing);

    // Khi
    const result = await positionHistoryService.deletePositionHistory(existing.id);

    // Thì: trả về personnel id để caller trigger tính lại total-months
    expect(prismaMock.lichSuChucVu.delete).toHaveBeenCalledWith({ where: { id: existing.id } });
    expect(result.quan_nhan_id).toBe(PERSONNEL_ID);
    expect(result.message).toBe('Xóa lịch sử chức vụ thành công');
  });

  it('Lịch sử chức vụ: xoá dòng không tồn tại → bị chặn', async () => {
    prismaMock.lichSuChucVu.findUnique.mockResolvedValueOnce(null);

    await expectError(
      positionHistoryService.deletePositionHistory('lscv-missing'),
      NotFoundError,
      POSITION_HISTORY_NOT_FOUND
    );
    expect(prismaMock.lichSuChucVu.delete).not.toHaveBeenCalled();
  });

  it('Lịch sử chức vụ: xoá dòng chức vụ hiện tại (chưa kết thúc) → bị chặn, không xoá', async () => {
    const current = {
      id: 'lscv-current',
      quan_nhan_id: PERSONNEL_ID,
      chuc_vu_id: CHUC_VU_ID,
      he_so_chuc_vu: 0.7,
      ngay_bat_dau: new Date('2024-01-01'),
      ngay_ket_thuc: null,
      so_thang: null,
    };
    prismaMock.lichSuChucVu.findUnique.mockResolvedValueOnce(current);

    await expectError(
      positionHistoryService.deletePositionHistory(current.id),
      ValidationError,
      /chức vụ hiện tại/
    );
    expect(prismaMock.lichSuChucVu.delete).not.toHaveBeenCalled();
  });
});

describe('Lịch sử chức vụ: tra cứu lịch sử của quân nhân', () => {
  it('Lịch sử chức vụ: tra cứu thiếu quân nhân → bị chặn', async () => {
    await expectError(
      positionHistoryService.getPositionHistory(''),
      ValidationError,
      POSITION_HISTORY_PERSONNEL_ID_REQUIRED
    );
  });

  it('Lịch sử chức vụ: tra cứu của quân nhân không tồn tại → bị chặn', async () => {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(null);

    await expectError(
      positionHistoryService.getPositionHistory('qn-missing'),
      NotFoundError,
      POSITION_HISTORY_PERSONNEL_NOT_FOUND
    );
  });

  it('Lịch sử chức vụ: tra cứu → sắp xếp mới nhất trước, tính lại số tháng cho dòng đang mở', async () => {
    // Cho: 2 bản ghi — 1 đã đóng, 1 đang mở (không có ngay_ket_thuc)
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(makePersonnelStub());
    const openStart = new Date();
    openStart.setMonth(openStart.getMonth() - 5);
    openStart.setDate(1);
    const records = [
      {
        id: 'lscv-open',
        quan_nhan_id: PERSONNEL_ID,
        chuc_vu_id: CHUC_VU_ID_2,
        ngay_bat_dau: openStart,
        ngay_ket_thuc: null,
        so_thang: null,
      },
      {
        id: 'lscv-closed',
        quan_nhan_id: PERSONNEL_ID,
        chuc_vu_id: CHUC_VU_ID,
        ngay_bat_dau: new Date('2020-01-01'),
        ngay_ket_thuc: new Date('2021-01-01'),
        so_thang: 12,
      },
    ];
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce(records);

    // Khi
    const result = await positionHistoryService.getPositionHistory(PERSONNEL_ID);

    // Thì: orderBy ngay_bat_dau DESC, tie-break đưa bản ghi đang mở (ngay_ket_thuc null) lên đầu;
    // bản ghi mở được tính lại so_thang
    const findArgs = prismaMock.lichSuChucVu.findMany.mock.calls[0][0];
    expect(findArgs.orderBy).toEqual([
      { ngay_bat_dau: 'desc' },
      { ngay_ket_thuc: { sort: 'desc', nulls: 'first' } },
    ]);
    expect(result).toHaveLength(2);
    const openRecord = result.find(r => r.id === 'lscv-open');
    expect(openRecord?.so_thang).toBeGreaterThanOrEqual(4);
    expect(openRecord?.so_thang).toBeLessThanOrEqual(6);
    const closedRecord = result.find(r => r.id === 'lscv-closed');
    expect(closedRecord?.so_thang).toBe(12);
  });

  it('Lịch sử chức vụ: hiển thị tên hiện hành khi chức vụ còn, dùng tên đã chụp (snapshot) khi chức vụ đã xoá', async () => {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(makePersonnelStub());
    const records = [
      {
        id: 'lscv-live',
        quan_nhan_id: PERSONNEL_ID,
        chuc_vu_id: CHUC_VU_ID,
        ten_chuc_vu: 'Tên cũ trong snapshot',
        ten_don_vi_truc_thuoc: 'ĐV cũ trong snapshot',
        ten_co_quan_don_vi: null,
        ngay_bat_dau: new Date('2022-01-01'),
        ngay_ket_thuc: new Date('2023-01-01'),
        so_thang: 12,
        ChucVu: {
          ten_chuc_vu: 'Trưởng ban (live)',
          CoQuanDonVi: null,
          DonViTrucThuoc: {
            ten_don_vi: 'Ban A (live)',
            CoQuanDonVi: { ten_don_vi: 'Phòng X (live)' },
          },
        },
      },
      {
        id: 'lscv-deleted',
        quan_nhan_id: PERSONNEL_ID,
        chuc_vu_id: null,
        ten_chuc_vu: 'Trợ lý (snapshot)',
        ten_don_vi_truc_thuoc: 'Ban B (snapshot)',
        ten_co_quan_don_vi: 'Phòng Y (snapshot)',
        ngay_bat_dau: new Date('2019-01-01'),
        ngay_ket_thuc: new Date('2020-01-01'),
        so_thang: 12,
        ChucVu: null,
      },
    ];
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce(records);

    const result = await positionHistoryService.getPositionHistory(PERSONNEL_ID);

    const liveRow = result.find(r => r.id === 'lscv-live');
    expect(liveRow?.ten_chuc_vu).toBe('Trưởng ban (live)');
    expect(liveRow?.ten_don_vi_truc_thuoc).toBe('Ban A (live)');
    expect(liveRow?.ten_co_quan_don_vi).toBe('Phòng X (live)');

    const deletedRow = result.find(r => r.id === 'lscv-deleted');
    expect(deletedRow?.ten_chuc_vu).toBe('Trợ lý (snapshot)');
    expect(deletedRow?.ten_don_vi_truc_thuoc).toBe('Ban B (snapshot)');
    expect(deletedRow?.ten_co_quan_don_vi).toBe('Phòng Y (snapshot)');
  });
});
