import { prismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeUnit, makeAdmin } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import {
  DANH_HIEU_DAC_BIET,
  DANH_HIEU_HCCSVV,
} from '../../src/constants/danhHieu.constants';
import {
  SUBMIT_MISSING_MONTH_ERROR,
  NIEN_HAN_INVALID_DANH_HIEU_PREFIX,
} from '../helpers/errorMessages';

afterEach(() => {
  jest.restoreAllMocks();
});

interface NienHanItem {
  personnel_id: string;
  danh_hieu: string;
  so_quyet_dinh?: string | null;
}

function arrangeManagerWithUnit(unitKind: 'CQDV' | 'DVTT' = 'CQDV') {
  const unit = makeUnit({ kind: unitKind, id: unitKind === 'CQDV' ? 'cqdv-mgr' : 'dvtt-mgr' });
  const managerQn = makePersonnel({ unit, id: 'qn-manager', ho_ten: 'Manager A' });
  const account = makeAdmin({ id: 'acc-mgr-1', quanNhan: managerQn });
  prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
    ...account,
    QuanNhan: {
      ...managerQn,
      CoQuanDonVi: unit.kind === 'CQDV' ? unit.CoQuanDonVi : null,
      DonViTrucThuoc:
        unit.kind === 'DVTT'
          ? { ...unit.DonViTrucThuoc!, CoQuanDonVi: unit.DonViTrucThuoc!.CoQuanDonVi }
          : null,
    },
  });
  return { unit, account };
}

function callSubmit(items: NienHanItem[], thang: number | null = 6, nam = 2024) {
  return proposalService.submitProposal(
    items,
    null,    'acc-mgr-1',
    PROPOSAL_TYPES.NIEN_HAN,
    nam,
    null,
    thang
  );
}

describe('Gửi đề xuất Huy chương Chiến sĩ vẻ vang (HCCSVV) theo niên hạn', () => {
  it('Gửi đề xuất: HCCSVV hạng Ba cho quân nhân đủ niên hạn (manager thuộc cơ quan đơn vị) → tạo đề xuất', async () => {
    // Cho trước: 1 manager + 1 quân nhân đã 12 năm phục vụ
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({
      id: 'qn-1',
      ho_ten: 'Nguyễn A',
      ngay_nhap_ngu: new Date('2012-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-nh-1',
      loai_de_xuat: PROPOSAL_TYPES.NIEN_HAN,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: { ten_don_vi: 'Đơn vị manager' },
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    // Khi
    await callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA }]);

    // Kết quả: proposal tạo với payload NIEN_HAN + giữ nguyên thang
    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.loai_de_xuat).toBe(PROPOSAL_TYPES.NIEN_HAN);
    expect(data.thang).toBe(6);
    expect(Array.isArray(data.data_nien_han)).toBe(true);
    expect(data.data_nien_han[0]).toMatchObject({
      personnel_id: target.id,
      danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
      nam: 2024,
      thang: 6,
    });
  });

  it('Gửi đề xuất: manager thuộc đơn vị trực thuộc (ĐVTT) → đề xuất gắn đúng đơn vị trực thuộc', async () => {
    arrangeManagerWithUnit('DVTT');
    const target = makePersonnel({ id: 'qn-2', ngay_nhap_ngu: new Date('2010-01-01') });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2018 },
    ]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-nh-dvtt',
      loai_de_xuat: PROPOSAL_TYPES.NIEN_HAN,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: { ten_don_vi: 'DVTT' },
      CoQuanDonVi: null,
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    await callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI }]);

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.don_vi_truc_thuoc_id).toBe('dvtt-mgr');
    expect(data.co_quan_don_vi_id).toBe(null);
  });

  it('Gửi đề xuất bị chặn: chưa nhập tháng đề xuất → báo thiếu tháng', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({ id: 'qn-no-thang' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA }], null),
      ValidationError,
      SUBMIT_MISSING_MONTH_ERROR
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('Gửi đề xuất bị chặn: chọn nhầm danh hiệu (HC QKQT thay vì HCCSVV) → báo danh hiệu không hợp lệ', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({ id: 'qn-wrong' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_DAC_BIET.HC_QKQT }]),
      ValidationError,
      { startsWith: NIEN_HAN_INVALID_DANH_HIEU_PREFIX }
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('Gửi đề xuất bị chặn: đề nghị HCCSVV hạng Nhì khi quân nhân chưa có hạng Ba → buộc nhận hạng Ba trước', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({
      id: 'qn-rk-1',
      ho_ten: 'Trần Rank A',
      ngay_nhap_ngu: new Date('2005-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI }]),
      ValidationError,
      /Phải nhận Huy chương Chiến sĩ vẻ vang hạng Ba trước khi nhận Huy chương Chiến sĩ vẻ vang hạng Nhì/
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('Gửi đề xuất bị chặn: đề nghị HCCSVV hạng Nhì cùng năm với hạng Ba → buộc đề nghị ở năm sau', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({
      id: 'qn-rk-2',
      ho_ten: 'Trần Rank B',
      ngay_nhap_ngu: new Date('2005-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2024 },
    ]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI }], 6, 2024),
      ValidationError,
      /phải sau năm nhận Huy chương Chiến sĩ vẻ vang hạng Ba/
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('Gửi đề xuất: đề nghị HCCSVV hạng Nhì khi đã có hạng Ba từ năm trước → tạo đề xuất', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({
      id: 'qn-rk-3',
      ho_ten: 'Trần Rank C',
      ngay_nhap_ngu: new Date('2005-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2020 },
    ]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-rk-3',
      loai_de_xuat: PROPOSAL_TYPES.NIEN_HAN,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: { ten_don_vi: 'Đơn vị manager' },
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    await callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI }], 6, 2024);

    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
  });

  it('Gửi đề xuất bị chặn: đề nghị HCCSVV hạng Nhất khi chưa có hạng Nhì → buộc nhận hạng Nhì trước', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({
      id: 'qn-rk-4',
      ho_ten: 'Trần Rank D',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2010 },
    ]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHAT }], 6, 2024),
      ValidationError,
      /Phải nhận Huy chương Chiến sĩ vẻ vang hạng Nhì trước khi nhận Huy chương Chiến sĩ vẻ vang hạng Nhất/
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('Gửi đề xuất: đề nghị HCCSVV hạng Nhất khi đã có đủ hạng Ba rồi hạng Nhì theo thứ tự → tạo đề xuất', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({
      id: 'qn-rk-5',
      ho_ten: 'Trần Rank E',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA, nam: 2010 },
      { quan_nhan_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI, nam: 2018 },
    ]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-rk-5',
      loai_de_xuat: PROPOSAL_TYPES.NIEN_HAN,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: { ten_don_vi: 'Đơn vị manager' },
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    await callSubmit(
      [{ personnel_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_NHAT }],
      6,
      2025
    );

    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
  });
});
