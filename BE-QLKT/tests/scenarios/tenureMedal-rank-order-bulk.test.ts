import { prismaMock } from '../helpers/prismaMock';
import { makePersonnel } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import awardBulkService from '../../src/services/awardBulk.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { DANH_HIEU_HCCSVV } from '../../src/constants/danhHieu.constants';

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-admin-rank';

interface ArrangeOptions {
  personnel: ReturnType<typeof makePersonnel>[];
  existingHCCSVV?: Array<{ quan_nhan_id: string; danh_hieu: string; nam: number }>;
}

function arrangeNienHanBulk({ personnel, existingHCCSVV = [] }: ArrangeOptions) {
  // checkDuplicateAwards: quanNhan.findMany + bangDeXuat.findMany + khenThuongHCCSVV.findMany
  prismaMock.quanNhan.findMany.mockResolvedValueOnce(
    personnel.map(p => ({ id: p.id, ho_ten: p.ho_ten }))
  );
  prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
  prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce(
    existingHCCSVV.map(r => ({ quan_nhan_id: r.quan_nhan_id, danh_hieu: r.danh_hieu }))
  );

  // validatePersonnelConditions: quanNhan.findMany (full select)
  prismaMock.quanNhan.findMany.mockResolvedValueOnce(personnel);

  // Lấy personnelMap (nhánh HC_QKQT/NIEN_HAN/KNC)
  prismaMock.quanNhan.findMany.mockResolvedValueOnce(personnel);

  // Query rank-order (mới)
  prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce(
    existingHCCSVV.map(r => ({ quan_nhan_id: r.quan_nhan_id, danh_hieu: r.danh_hieu, nam: r.nam }))
  );
}

describe('Trao thưởng hàng loạt HCCSVV: kiểm tra thứ tự hạng', () => {
  it('Phê duyệt bị chặn: trao HCCSVV hạng Nhì khi quân nhân chưa có hạng Ba → từ chối "Phải nhận hạng Ba"', async () => {
    const p = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn A',
      ngay_nhap_ngu: new Date('2005-01-01'),
    });
    arrangeNienHanBulk({ personnel: [p] });

    await expectError(
      awardBulkService.bulkCreateAwards({
        type: PROPOSAL_TYPES.NIEN_HAN,
        nam: 2024,
        thang: 6,
        selectedPersonnel: [p.id],
        titleData: [{ personnel_id: p.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI }],
        adminId: ADMIN_ID,
      }),
      ValidationError,
      /Phải nhận Huy chương Chiến sĩ vẻ vang hạng Ba/
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });

  it('Phê duyệt bị chặn: trao HCCSVV hạng Nhì cùng năm với hạng Ba → từ chối vì hạng Nhì phải sau năm nhận hạng Ba', async () => {
    const p = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn B',
      ngay_nhap_ngu: new Date('2005-01-01'),
    });
    arrangeNienHanBulk({
      personnel: [p],
      existingHCCSVV: [{ quan_nhan_id: p.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2024 }],
    });

    await expectError(
      awardBulkService.bulkCreateAwards({
        type: PROPOSAL_TYPES.NIEN_HAN,
        nam: 2024,
        thang: 6,
        selectedPersonnel: [p.id],
        titleData: [{ personnel_id: p.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI }],
        adminId: ADMIN_ID,
      }),
      ValidationError,
      /phải sau năm nhận Huy chương Chiến sĩ vẻ vang hạng Ba/
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });

  it('Phê duyệt thông thường: trao HCCSVV hạng Nhì khi đã có hạng Ba từ năm trước → thành công', async () => {
    const p = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn C',
      ngay_nhap_ngu: new Date('2000-01-01'),
    });
    arrangeNienHanBulk({
      personnel: [p],
      existingHCCSVV: [{ quan_nhan_id: p.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2017 }],
    });
    prismaMock.khenThuongHCCSVV.upsert.mockResolvedValueOnce({ id: 'hccsvv-1' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ username: 'admin' });

    const result = await awardBulkService.bulkCreateAwards({
      type: PROPOSAL_TYPES.NIEN_HAN,
      nam: 2024,
      thang: 6,
      selectedPersonnel: [p.id],
      titleData: [{ personnel_id: p.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI }],
      adminId: ADMIN_ID,
    });

    expect(result.data.importedCount).toBe(1);
    expect(prismaMock.khenThuongHCCSVV.upsert).toHaveBeenCalledTimes(1);
  });

  it('Phê duyệt bị chặn: trao HCCSVV hàng loạt cho 2 quân nhân, 1 hợp lệ + 1 sai thứ tự hạng → một dòng lỗi thì hủy toàn bộ và gộp lý do', async () => {
    const a = makePersonnel({
      id: 'qn-A',
      ho_ten: 'Người A',
      ngay_nhap_ngu: new Date('2000-01-01'),
    });
    const b = makePersonnel({
      id: 'qn-B',
      ho_ten: 'Người B',
      ngay_nhap_ngu: new Date('2000-01-01'),
    });
    arrangeNienHanBulk({
      personnel: [a, b],
      existingHCCSVV: [{ quan_nhan_id: a.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2017 }],
    });

    await expectError(
      awardBulkService.bulkCreateAwards({
        type: PROPOSAL_TYPES.NIEN_HAN,
        nam: 2024,
        thang: 6,
        selectedPersonnel: [a.id, b.id],
        titleData: [
          { personnel_id: a.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI },
          { personnel_id: b.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI },
        ],
        adminId: ADMIN_ID,
      }),
      ValidationError,
      /Người B/
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });

  it('Phê duyệt bị chặn: trao HCCSVV hạng Nhất khi mới có hạng Ba, thiếu hạng Nhì → từ chối "Phải nhận hạng Nhì"', async () => {
    const p = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn D',
      ngay_nhap_ngu: new Date('1995-01-01'),
    });
    arrangeNienHanBulk({
      personnel: [p],
      existingHCCSVV: [{ quan_nhan_id: p.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2010 }],
    });

    await expectError(
      awardBulkService.bulkCreateAwards({
        type: PROPOSAL_TYPES.NIEN_HAN,
        nam: 2024,
        thang: 6,
        selectedPersonnel: [p.id],
        titleData: [{ personnel_id: p.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHAT }],
        adminId: ADMIN_ID,
      }),
      ValidationError,
      /Phải nhận Huy chương Chiến sĩ vẻ vang hạng Nhì/
    );
    expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
  });

  it('Phê duyệt thông thường: trao HCCSVV hạng Nhất khi đã có đủ hạng Ba rồi hạng Nhì theo đúng thứ tự → thành công', async () => {
    const p = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn E',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    arrangeNienHanBulk({
      personnel: [p],
      existingHCCSVV: [
        { quan_nhan_id: p.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2005 },
        { quan_nhan_id: p.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI, nam: 2015 },
      ],
    });
    prismaMock.khenThuongHCCSVV.upsert.mockResolvedValueOnce({ id: 'hccsvv-x' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ username: 'admin' });

    const result = await awardBulkService.bulkCreateAwards({
      type: PROPOSAL_TYPES.NIEN_HAN,
      nam: 2025,
      thang: 6,
      selectedPersonnel: [p.id],
      titleData: [{ personnel_id: p.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHAT }],
      adminId: ADMIN_ID,
    });

    expect(result.data.importedCount).toBe(1);
    expect(prismaMock.khenThuongHCCSVV.upsert).toHaveBeenCalledTimes(1);
  });
});
