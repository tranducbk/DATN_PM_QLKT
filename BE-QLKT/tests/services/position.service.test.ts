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

describe('Chức vụ: tra cứu danh sách chức vụ', () => {
  it('Chức vụ: không lọc theo đơn vị → trả về tất cả chức vụ', async () => {
    prismaMock.chucVu.findMany.mockResolvedValueOnce([{ id: CV_ID, ten_chuc_vu: 'Trợ lý' }]);

    const result = await positionService.getPositions();

    expect(result).toHaveLength(1);
    const args = prismaMock.chucVu.findMany.mock.calls[0][0];
    expect(args.where).toEqual({});
  });

  it('Chức vụ: lọc theo CQDV kèm đơn vị con → gom luôn chức vụ của các DVTT trực thuộc', async () => {
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

  it('Chức vụ: lọc theo đơn vị không tồn tại → báo "Đơn vị không tồn tại"', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);

    await expectError(
      positionService.getPositions('missing', true),
      NotFoundError,
      'Đơn vị không tồn tại'
    );
  });
});

describe('Chức vụ: tạo mới chức vụ', () => {
  it('Chức vụ: tạo trong CQDV với tên chưa trùng → tạo được, giữ quyền manager, gắn vào CQDV', async () => {
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

  it('Chức vụ: tạo trong DVTT → ép bỏ quyền manager (chỉ CQDV mới được làm manager)', async () => {
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

  it('Chức vụ: tạo tên đã có sẵn trong cùng đơn vị → bị chặn, báo trùng tên (409)', async () => {
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

  it('Chức vụ: tạo cho đơn vị không tồn tại → báo "Đơn vị không tồn tại"', async () => {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);

    await expectError(
      positionService.createPosition({ unit_id: 'missing', ten_chuc_vu: 'X' }),
      NotFoundError,
      'Đơn vị không tồn tại'
    );
  });
});

describe('Chức vụ: cập nhật chức vụ', () => {
  it('Chức vụ: cập nhật mà không thay đổi gì → bị chặn, báo "Không có thay đổi nào để cập nhật"', async () => {
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

  it('Chức vụ: cập nhật chức vụ không tồn tại → báo "Chức vụ không tồn tại"', async () => {
    prismaMock.chucVu.findUnique.mockResolvedValueOnce(null);

    await expectError(
      positionService.updatePosition('missing', { ten_chuc_vu: 'X' }),
      NotFoundError,
      'Chức vụ không tồn tại'
    );
  });

  it('Chức vụ: đổi hệ số chức vụ → cập nhật hệ số vào dòng lịch sử đang mở (chưa kết thúc)', async () => {
    prismaMock.chucVu.findUnique.mockResolvedValueOnce({
      id: CV_ID,
      ten_chuc_vu: 'Trợ lý',
      is_manager: false,
      he_so_chuc_vu: 0.5,
      co_quan_don_vi_id: CQDV_ID,
      don_vi_truc_thuoc_id: null,
    });
    prismaMock.chucVu.update.mockResolvedValueOnce({ id: CV_ID });
    prismaMock.lichSuChucVu.updateMany.mockResolvedValue({ count: 1 });

    await positionService.updatePosition(CV_ID, { he_so_chuc_vu: 0.7 });

    expect(prismaMock.lichSuChucVu.updateMany).toHaveBeenCalledWith({
      where: { chuc_vu_id: CV_ID, ngay_ket_thuc: null },
      data: { he_so_chuc_vu: 0.7 },
    });
  });

  it('Chức vụ: đổi tên chức vụ → cập nhật tên vào mọi dòng lịch sử, không động vào hệ số', async () => {
    prismaMock.chucVu.findUnique.mockResolvedValueOnce({
      id: CV_ID,
      ten_chuc_vu: 'Trợ lý',
      is_manager: false,
      he_so_chuc_vu: 0.5,
      co_quan_don_vi_id: CQDV_ID,
      don_vi_truc_thuoc_id: null,
    });
    prismaMock.chucVu.update.mockResolvedValueOnce({ id: CV_ID });
    prismaMock.lichSuChucVu.updateMany.mockResolvedValue({ count: 3 });

    await positionService.updatePosition(CV_ID, { ten_chuc_vu: 'Trưởng ban' });

    expect(prismaMock.lichSuChucVu.updateMany).toHaveBeenCalledWith({
      where: { chuc_vu_id: CV_ID },
      data: { ten_chuc_vu: 'Trưởng ban' },
    });
    expect(prismaMock.lichSuChucVu.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ he_so_chuc_vu: expect.anything() }),
      })
    );
  });
});

describe('Chức vụ: xoá chức vụ', () => {
  it('Chức vụ: xoá chức vụ không còn quân nhân giữ → xoá được, báo thành công', async () => {
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

  it('Chức vụ: xoá chức vụ còn 3 quân nhân giữ → bị chặn vì còn ràng buộc (409), không xoá', async () => {
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

  it('Chức vụ: xoá chức vụ của DVTT → chụp (snapshot) tên mới nhất vào lịch sử trước khi xoá', async () => {
    prismaMock.chucVu.findUnique.mockResolvedValueOnce({
      id: CV_ID,
      ten_chuc_vu: 'Trợ lý',
      CoQuanDonVi: null,
      DonViTrucThuoc: { ten_don_vi: 'Ban A', CoQuanDonVi: { ten_don_vi: 'Phòng X' } },
    });
    prismaMock.quanNhan.count.mockResolvedValueOnce(0);
    prismaMock.lichSuChucVu.updateMany.mockResolvedValueOnce({ count: 2 });
    prismaMock.chucVu.delete.mockResolvedValueOnce({ id: CV_ID });

    await positionService.deletePosition(CV_ID);

    expect(prismaMock.lichSuChucVu.updateMany).toHaveBeenCalledWith({
      where: { chuc_vu_id: CV_ID },
      data: { ten_chuc_vu: 'Trợ lý', ten_co_quan_don_vi: 'Phòng X', ten_don_vi_truc_thuoc: 'Ban A' },
    });
    const freezeOrder = prismaMock.lichSuChucVu.updateMany.mock.invocationCallOrder[0];
    const deleteOrder = prismaMock.chucVu.delete.mock.invocationCallOrder[0];
    expect(freezeOrder).toBeLessThan(deleteOrder);
  });
});
