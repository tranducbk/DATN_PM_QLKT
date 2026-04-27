import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeUnit, makeAdmin } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import {
  SUBMIT_MISSING_MONTH_ERROR,
  KNC_INVALID_DANH_HIEU_PREFIX,
  KNC_SUBMIT_INELIGIBLE_PREFIX,
} from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
});

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
    null,
    null,
    'acc-mgr-1',
    PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
    nam,
    null,
    thang
  );
}

describe('proposal.submit - KNC_VSNXD_QDNDVN', () => {
  it('gửi thành công nam ≥25 năm', async () => {
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

    await callSubmit([{ personnel_id: target.id, danh_hieu: 'KNC_VSNXD_QDNDVN' }]);

    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
  });

  it('gửi thành công nữ ≥20 năm', async () => {
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

    await callSubmit([{ personnel_id: target.id, danh_hieu: 'KNC_VSNXD_QDNDVN' }]);
    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
  });

  it('reject nam <25 năm', async () => {
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
      callSubmit([{ personnel_id: target.id, danh_hieu: 'KNC_VSNXD_QDNDVN' }]),
      ValidationError,
      { startsWith: KNC_SUBMIT_INELIGIBLE_PREFIX }
    );
  });

  it('reject nữ <20 năm', async () => {
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
      callSubmit([{ personnel_id: target.id, danh_hieu: 'KNC_VSNXD_QDNDVN' }]),
      ValidationError,
      { startsWith: KNC_SUBMIT_INELIGIBLE_PREFIX }
    );
  });

  it('reject khi thiếu giới tính', async () => {
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
      callSubmit([{ personnel_id: target.id, danh_hieu: 'KNC_VSNXD_QDNDVN' }]),
      ValidationError,
      { startsWith: KNC_SUBMIT_INELIGIBLE_PREFIX }
    );
  });

  it('reject khi danh_hieu sai', async () => {
    arrangeManager();
    const target = makePersonnel({ id: 'qn-x' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: 'HC_QKQT' }]),
      ValidationError,
      { startsWith: KNC_INVALID_DANH_HIEU_PREFIX }
    );
  });

  it('reject khi thiếu tháng', async () => {
    arrangeManager();
    const target = makePersonnel({
      id: 'qn-no-thang',
      gioi_tinh: 'NAM',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: 'KNC_VSNXD_QDNDVN' }], null),
      ValidationError,
      SUBMIT_MISSING_MONTH_ERROR
    );
  });
});
