import { prismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeUnit, makeAdmin } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_DAC_BIET } from '../../src/constants/danhHieu.constants';
import {
  SUBMIT_MISSING_MONTH_ERROR,
  KNC_INVALID_DANH_HIEU_PREFIX,
  KNC_SUBMIT_INELIGIBLE_PREFIX,
} from '../helpers/errorMessages';

afterEach(() => {
  jest.restoreAllMocks();
});

interface NienHanItem {
  personnel_id: string;
  danh_hieu: string;
}

function arrangeManager() {
  const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-mgr' });
  const managerQn = makePersonnel({ unit, id: 'qn-manager', ho_ten: 'Manager A' });
  const account = makeAdmin({ id: 'acc-mgr-1', quanNhan: managerQn });
  prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
    ...account,
    QuanNhan: { ...managerQn, CoQuanDonVi: unit.CoQuanDonVi, DonViTrucThuoc: null },
  });
}

function callSubmit(items: NienHanItem[], thang: number | null = 6, nam = 2024) {
  return proposalService.submitProposal(
    items,
    null,    'acc-mgr-1',
    PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
    nam,
    null,
    thang
  );
}

describe('Gửi đề xuất Kỷ niệm chương (KNC) Vì sự nghiệp xây dựng QĐND Việt Nam', () => {
  it('Gửi đề xuất: quân nhân nam đủ 25 năm phục vụ → tạo đề xuất KNC', async () => {
    arrangeManager();
    const target = makePersonnel({
      id: 'qn-male',
      ho_ten: 'Nam A',
      gioi_tinh: 'NAM',
      ngay_nhap_ngu: new Date('1994-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-knc-1',
      loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: { ten_don_vi: 'CQDV' },
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    await callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN }]);

    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
  });

  it('Gửi đề xuất: quân nhân nữ đủ 20 năm phục vụ → tạo đề xuất KNC', async () => {
    arrangeManager();
    const target = makePersonnel({
      id: 'qn-female',
      ho_ten: 'Nữ B',
      gioi_tinh: 'NU',
      ngay_nhap_ngu: new Date('2000-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-knc-2',
      loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: null,
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    await callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN }]);
    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
  });

  it('Gửi đề xuất bị chặn: quân nhân nam chưa đủ 25 năm phục vụ → chưa đủ điều kiện KNC', async () => {
    arrangeManager();
    const target = makePersonnel({
      id: 'qn-male-short',
      ho_ten: 'Nam C',
      gioi_tinh: 'NAM',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN }]),
      ValidationError,
      { startsWith: KNC_SUBMIT_INELIGIBLE_PREFIX }
    );
  });

  it('Gửi đề xuất bị chặn: quân nhân nữ chưa đủ 20 năm phục vụ → chưa đủ điều kiện KNC', async () => {
    arrangeManager();
    const target = makePersonnel({
      id: 'qn-female-short',
      ho_ten: 'Nữ D',
      gioi_tinh: 'NU',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN }]),
      ValidationError,
      { startsWith: KNC_SUBMIT_INELIGIBLE_PREFIX }
    );
  });

  it('Gửi đề xuất bị chặn: quân nhân thiếu giới tính → không xác định được mốc năm, chưa đủ điều kiện KNC', async () => {
    arrangeManager();
    const target = {
      ...makePersonnel({
        id: 'qn-no-gender',
        ho_ten: 'No Gender',
        ngay_nhap_ngu: new Date('1990-01-01'),
      }),
      gioi_tinh: null,
    };
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN }]),
      ValidationError,
      { startsWith: KNC_SUBMIT_INELIGIBLE_PREFIX }
    );
  });

  it('Gửi đề xuất bị chặn: chọn nhầm danh hiệu (không phải KNC) → báo danh hiệu không hợp lệ', async () => {
    arrangeManager();
    const target = makePersonnel({ id: 'qn-x' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_DAC_BIET.HC_QKQT }]),
      ValidationError,
      { startsWith: KNC_INVALID_DANH_HIEU_PREFIX }
    );
  });

  it('Gửi đề xuất bị chặn: chưa nhập tháng đề xuất → báo thiếu tháng', async () => {
    arrangeManager();
    const target = makePersonnel({
      id: 'qn-no-thang',
      gioi_tinh: 'NAM',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_DAC_BIET.KNC_VSNXD_QDNDVN }], null),
      ValidationError,
      SUBMIT_MISSING_MONTH_ERROR
    );
  });
});
