import { prismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeUnit, makeAdmin } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import {
  DANH_HIEU_CA_NHAN_KHAC,
  DANH_HIEU_HCCSVV,
} from '../../src/constants/danhHieu.constants';
import {
  SUBMIT_MISSING_MONTH_ERROR,
  HCQKQT_INVALID_DANH_HIEU_PREFIX,
  HCQKQT_SUBMIT_INELIGIBLE_PREFIX,
} from '../helpers/errorMessages';

afterEach(() => {
  jest.restoreAllMocks();
});

interface NienHanItem {
  personnel_id: string;
  danh_hieu: string;
}

function arrangeManager(unitKind: 'CQDV' | 'DVTT' = 'CQDV') {
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
}

function callSubmit(items: NienHanItem[], thang: number | null = 6, nam = 2024) {
  return proposalService.submitProposal(
    items,
    null,    'acc-mgr-1',
    PROPOSAL_TYPES.HC_QKQT,
    nam,
    null,
    thang
  );
}

describe('proposal.submit - HC_QKQT', () => {
  it('gửi thành công khi quân nhân đủ 25 năm phục vụ (CQDV)', async () => {
    // Cho trước: manager + 1 quân nhân 30 năm phục vụ (>= 25)
    arrangeManager('CQDV');
    const target = makePersonnel({
      id: 'qn-ok',
      ho_ten: 'Trần B',
      ngay_nhap_ngu: new Date('1994-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-hcqkqt-1',
      loai_de_xuat: PROPOSAL_TYPES.HC_QKQT,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: { ten_don_vi: 'CQDV' },
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    // Khi
    await callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_KHAC.HC_QKQT }]);

    // Kết quả
    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.loai_de_xuat).toBe(PROPOSAL_TYPES.HC_QKQT);
    expect(data.thang).toBe(6);
  });

  it('reject khi chưa đủ 25 năm phục vụ', async () => {
    arrangeManager('CQDV');
    const target = makePersonnel({
      id: 'qn-short',
      ho_ten: 'Phạm C',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_KHAC.HC_QKQT }]),
      ValidationError,
      { startsWith: HCQKQT_SUBMIT_INELIGIBLE_PREFIX }
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('reject khi thiếu ngay_nhap_ngu', async () => {
    arrangeManager('CQDV');
    const target = makePersonnel({ id: 'qn-no-nn', ho_ten: 'Lê D', ngay_nhap_ngu: null });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_KHAC.HC_QKQT }]),
      ValidationError,
      { startsWith: HCQKQT_SUBMIT_INELIGIBLE_PREFIX }
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('reject khi danh_hieu sai (vd HCCSVV_HANG_BA)', async () => {
    arrangeManager('CQDV');
    const target = makePersonnel({
      id: 'qn-wrong',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA }]),
      ValidationError,
      { startsWith: HCQKQT_INVALID_DANH_HIEU_PREFIX }
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('reject khi thiếu tháng', async () => {
    arrangeManager('CQDV');
    const target = makePersonnel({
      id: 'qn-no-thang',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmit([{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_KHAC.HC_QKQT }], null),
      ValidationError,
      SUBMIT_MISSING_MONTH_ERROR
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });
});
