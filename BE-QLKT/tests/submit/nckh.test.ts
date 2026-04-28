import { prismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeUnit, makeAdmin } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import { NotFoundError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { ROLES } from '../../src/constants/roles.constants';

afterEach(() => {
  jest.restoreAllMocks();
});

interface NckhItem {
  personnel_id: string;
  loai: string;
  mo_ta: string;
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

function callSubmit(items: NckhItem[], userId = 'acc-mgr-1', nam = 2024) {
  return proposalService.submitProposal(
    items,
    null,    userId,
    PROPOSAL_TYPES.NCKH,
    nam,
    null,
    null
  );
}

describe('proposal.submit - NCKH', () => {
  it('gửi thành công 1 item DTKH (CQDV)', async () => {
    arrangeManager('CQDV');
    const target = makePersonnel({ id: 'qn-1', ho_ten: 'Nguyễn A' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-nckh-1',
      loai_de_xuat: PROPOSAL_TYPES.NCKH,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: { ten_don_vi: 'CQDV' },
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    await callSubmit([{ personnel_id: target.id, loai: 'DTKH', mo_ta: 'Đề tài AI' }]);

    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.loai_de_xuat).toBe(PROPOSAL_TYPES.NCKH);
    expect(data.thang).toBe(null);
    expect(Array.isArray(data.data_thanh_tich)).toBe(true);
    expect(data.data_thanh_tich[0]).toMatchObject({
      personnel_id: target.id,
      ho_ten: 'Nguyễn A',
      loai: 'DTKH',
      mo_ta: 'Đề tài AI',
      nam: 2024,
    });
  });

  it('gửi thành công nhiều items khác mo_ta cùng quân nhân (cho phép trùng)', async () => {
    arrangeManager('CQDV');
    const target = makePersonnel({ id: 'qn-multi', ho_ten: 'B' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-nckh-2',
      loai_de_xuat: PROPOSAL_TYPES.NCKH,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: null,
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    await callSubmit([
      { personnel_id: target.id, loai: 'DTKH', mo_ta: 'Đề tài 1' },
      { personnel_id: target.id, loai: 'SKKH', mo_ta: 'Sáng kiến 1' },
    ]);

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.data_thanh_tich).toHaveLength(2);
  });

  it('gửi thành công với DVTT — proposal lưu don_vi_truc_thuoc_id', async () => {
    arrangeManager('DVTT');
    const target = makePersonnel({ id: 'qn-dvtt' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-nckh-dvtt',
      loai_de_xuat: PROPOSAL_TYPES.NCKH,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: { ten_don_vi: 'DVTT' },
      CoQuanDonVi: null,
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    await callSubmit([{ personnel_id: target.id, loai: 'SKKH', mo_ta: 'Sáng kiến X' }]);

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.don_vi_truc_thuoc_id).toBe('dvtt-mgr');
    expect(data.co_quan_don_vi_id).toBe(null);
  });

  it('throw NotFoundError khi tài khoản không có QuanNhan', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-no-qn',
      username: 'orphan',
      role: ROLES.ADMIN,
      quan_nhan_id: null,
      QuanNhan: null,
    });

    await expectError(
      callSubmit(
        [{ personnel_id: 'qn-x', loai: 'DTKH', mo_ta: 'Test' }],
        'acc-no-qn'
      ),
      NotFoundError,
      'Thông tin quân nhân của tài khoản này không tồn tại'
    );
  });
});
