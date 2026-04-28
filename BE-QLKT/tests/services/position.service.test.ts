import { prismaMock } from '../helpers/prismaMock';
import { expectError } from '../helpers/errorAssert';

import positionService from '../../src/services/position.service';
import {
  AppError,
  NotFoundError,
  ValidationError,
} from '../../src/middlewares/errorHandler';

const CQDV_ID = 'cqdv-1';
const DVTT_ID = 'dvtt-1';
const CV_ID = 'cv-1';

describe('position.service - getPositions', () => {
  it('Cho không có unitId → Khi getPositions → Thì trả về tất cả chức vụ (where rỗng)', async () => {
    prismaMock.chucVu.findMany.mockResolvedValueOnce([{ id: CV_ID, ten_chuc_vu: 'Trợ lý' }]);

    const result = await positionService.getPositions();

    expect(result).toHaveLength(1);
    const args = prismaMock.chucVu.findMany.mock.calls[0][0];
    expect(args.where).toEqual({});
  });

  it('Cho unitId là CQDV và includeChildren=true → Khi getPositions → Thì gom luôn DVTT con', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: CQDV_ID });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([{ id: 'dvtt-a' }, { id: 'dvtt-b' }]);
    prismaMock.chucVu.findMany.mockResolvedValueOnce([]);

    await positionService.getPositions(CQDV_ID, true);

    const args = prismaMock.chucVu.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      OR: [
        { co_quan_don_vi_id: { in: [CQDV_ID, 'dvtt-a', 'dvtt-b'] } },
        { don_vi_truc_thuoc_id: { in: [CQDV_ID, 'dvtt-a', 'dvtt-b'] } },
      ],
    });
  });

  it('Cho unitId không tồn tại với includeChildren → Khi getPositions → Thì throw NotFoundError', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);

    await expectError(
      positionService.getPositions('missing', true),
      NotFoundError,
      'Đơn vị không tồn tại'
    );
  });
});

describe('position.service - createPosition', () => {
  it('Cho CQDV và tên chưa trùng → Khi createPosition → Thì tạo với is_manager flag và link CQDV', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: CQDV_ID });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    prismaMock.chucVu.findFirst.mockResolvedValueOnce(null);
    prismaMock.chucVu.create.mockResolvedValueOnce({ id: CV_ID, ten_chuc_vu: 'Trưởng phòng' });

    await positionService.createPosition({
      unit_id: CQDV_ID,
      ten_chuc_vu: 'Trưởng phòng',
      is_manager: true,
      he_so_chuc_vu: 0.7,
    });

    const args = prismaMock.chucVu.create.mock.calls[0][0];
    expect(args.data).toMatchObject({
      ten_chuc_vu: 'Trưởng phòng',
      is_manager: true,
      he_so_chuc_vu: 0.7,
      co_quan_don_vi_id: CQDV_ID,
      don_vi_truc_thuoc_id: null,
    });
  });

  it('Cho DVTT → Khi createPosition → Thì ép is_manager=false (chỉ CQDV mới được manager)', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({ id: DVTT_ID });
    prismaMock.chucVu.findFirst.mockResolvedValueOnce(null);
    prismaMock.chucVu.create.mockResolvedValueOnce({ id: CV_ID });

    await positionService.createPosition({
      unit_id: DVTT_ID,
      ten_chuc_vu: 'Nhân viên',
      is_manager: true,
      he_so_chuc_vu: 0.3,
    });

    const args = prismaMock.chucVu.create.mock.calls[0][0];
    expect(args.data.is_manager).toBe(false);
    expect(args.data.don_vi_truc_thuoc_id).toBe(DVTT_ID);
    expect(args.data.co_quan_don_vi_id).toBeNull();
  });

  it('Cho tên đã tồn tại trong cùng đơn vị → Khi createPosition → Thì throw AppError 409', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: CQDV_ID });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    prismaMock.chucVu.findFirst.mockResolvedValueOnce({ id: 'existing' });

    const err = await expectError(
      positionService.createPosition({ unit_id: CQDV_ID, ten_chuc_vu: 'Trợ lý' }),
      AppError,
      'Tên chức vụ đã tồn tại trong đơn vị này'
    );
    expect(err.statusCode).toBe(409);
  });

  it('Cho unit_id không tồn tại → Khi createPosition → Thì throw NotFoundError', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);

    await expectError(
      positionService.createPosition({ unit_id: 'missing', ten_chuc_vu: 'X' }),
      NotFoundError,
      'Đơn vị không tồn tại'
    );
  });
});

describe('position.service - updatePosition', () => {
  it('Cho không có thay đổi → Khi updatePosition → Thì throw ValidationError', async () => {
    prismaMock.chucVu.findUnique.mockResolvedValueOnce({
      id: CV_ID,
      ten_chuc_vu: 'Trợ lý',
      is_manager: false,
      he_so_chuc_vu: 0.5,
      co_quan_don_vi_id: CQDV_ID,
      don_vi_truc_thuoc_id: null,
    });

    await expectError(
      positionService.updatePosition(CV_ID, {
        ten_chuc_vu: 'Trợ lý',
        is_manager: false,
        he_so_chuc_vu: 0.5,
      }),
      ValidationError,
      'Không có thay đổi nào để cập nhật'
    );
  });

  it('Cho id không tồn tại → Khi updatePosition → Thì throw NotFoundError', async () => {
    prismaMock.chucVu.findUnique.mockResolvedValueOnce(null);

    await expectError(
      positionService.updatePosition('missing', { ten_chuc_vu: 'X' }),
      NotFoundError,
      'Chức vụ không tồn tại'
    );
  });
});

describe('position.service - deletePosition', () => {
  it('Cho chức vụ không có quân nhân → Khi deletePosition → Thì xoá và trả message thành công', async () => {
    prismaMock.chucVu.findUnique.mockResolvedValueOnce({
      id: CV_ID,
      ten_chuc_vu: 'Trợ lý',
      CoQuanDonVi: { ten_don_vi: 'Cục A' },
      DonViTrucThuoc: null,
    });
    prismaMock.quanNhan.count.mockResolvedValueOnce(0);
    prismaMock.chucVu.delete.mockResolvedValueOnce({ id: CV_ID });

    const result = await positionService.deletePosition(CV_ID);

    expect(prismaMock.chucVu.delete).toHaveBeenCalledWith({ where: { id: CV_ID } });
    expect(result.message).toBe('Xóa chức vụ thành công');
    expect(result.ten_chuc_vu).toBe('Trợ lý');
  });

  it('Cho chức vụ còn quân nhân giữ → Khi deletePosition → Thì throw AppError 409 và không gọi delete', async () => {
    prismaMock.chucVu.findUnique.mockResolvedValueOnce({
      id: CV_ID,
      ten_chuc_vu: 'Trợ lý',
      CoQuanDonVi: { ten_don_vi: 'Cục A' },
      DonViTrucThuoc: null,
    });
    prismaMock.quanNhan.count.mockResolvedValueOnce(3);

    const err = await expectError(
      positionService.deletePosition(CV_ID),
      AppError,
      'Không thể xóa chức vụ vì còn 3 quân nhân đang giữ chức vụ này'
    );
    expect(err.statusCode).toBe(409);
    expect(prismaMock.chucVu.delete).not.toHaveBeenCalled();
  });
});
