import { prismaMock } from '../helpers/prismaMock';
import { makeProposal, makePersonnel, makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_CA_NHAN_KHAC } from '../../src/constants/danhHieu.constants';
import { APPROVE_MISSING_MONTH_ERROR, KNC_MISSING_GENDER } from '../helpers/errorMessages';

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-admin-1';

function buildItem(personnelId: string, override: Record<string, unknown> = {}) {
  return {
    personnel_id: personnelId,
    danh_hieu: DANH_HIEU_CA_NHAN_KHAC.KNC_VSNXD_QDNDVN,
    nam_nhan: 2024,
    thang_nhan: 6,
    so_quyet_dinh: 'QD-KNC-1',
    ...override,
  };
}

describe('approveProposal — KNC_VSNXD_QDNDVN', () => {
  it('duyệt thành công nam đủ 25 năm', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({
      unit: cqdv,
      id: 'qn-male',
      ho_ten: 'Nam A',
      gioi_tinh: 'NAM',
      ngay_nhap_ngu: new Date('1994-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-knc-1',
      loai: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_nien_han: [buildItem(personnel.id)],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnel]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findUnique.mockResolvedValueOnce(null);
    prismaMock.kyNiemChuongVSNXDQDNDVN.create.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    expect(prismaMock.kyNiemChuongVSNXDQDNDVN.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(PROPOSAL_STATUS.APPROVED);
  });

  it('duyệt thành công nữ đủ 20 năm', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-2' });
    const personnel = makePersonnel({
      unit: cqdv,
      id: 'qn-female',
      ho_ten: 'Nữ B',
      gioi_tinh: 'NU',
      ngay_nhap_ngu: new Date('2000-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-knc-2',
      loai: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_nien_han: [buildItem(personnel.id)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnel]);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findUnique.mockResolvedValueOnce(null);
    prismaMock.kyNiemChuongVSNXDQDNDVN.create.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);
    expect(prismaMock.kyNiemChuongVSNXDQDNDVN.create).toHaveBeenCalledTimes(1);
  });

  it('reject nam <25 năm', async () => {
    const personnel = makePersonnel({
      id: 'qn-male-short',
      ho_ten: 'Nam C',
      gioi_tinh: 'NAM',
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-knc-short',
      loai: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [buildItem(personnel.id)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnel]);

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    expect(err.message).toContain('KNC VSNXD QĐNDVN');
    expect(err.message).toContain(personnel.ho_ten);
  });

  it('reject thiếu giới tính', async () => {
    const personnel = {
      ...makePersonnel({
        id: 'qn-no-gender',
        ho_ten: 'No Gender',
        ngay_nhap_ngu: new Date('1990-01-01'),
      }),
      gioi_tinh: null,
    };
    const proposal = makeProposal({
      id: 'p-knc-no-gender',
      loai: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [buildItem(personnel.id)],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnel]);

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    expect(err.message).toContain(KNC_MISSING_GENDER(personnel.ho_ten));
  });

  it('reject khi proposal thiếu tháng', async () => {
    const proposal = makeProposal({
      id: 'p-knc-no-thang',
      loai: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      nam: 2024,
      thang: null,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      APPROVE_MISSING_MONTH_ERROR
    );
  });
});
