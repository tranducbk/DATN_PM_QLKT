import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeProposal, makeProposalItemDonVi, makeUnit } from '../helpers/fixtures';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_HCBVTQ,
  DANH_HIEU_HCCSVV,
  DANH_HIEU_DON_VI_HANG_NAM,
} from '../../src/constants/danhHieu.constants';

const ADMIN_ID = 'acc-admin-race';
const MANAGER_ID = 'acc-manager-race';

beforeEach(() => {
  resetPrismaMock();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest
    .spyOn(profileService, 'recalculateAnnualProfile')
    .mockResolvedValue(undefined as unknown as never);
  jest
    .spyOn(profileService, 'checkAwardEligibility')
    .mockResolvedValue({ eligible: true, reason: '' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Proposal race conditions — parallel approvals across proposals', () => {
  it('Hai proposal CA_NHAN_HANG_NAM từ 2 manager duyệt song song -> chỉ 1 request chốt trạng thái', async () => {
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-ca-nhan' });
    const target = makePersonnel({ id: 'qn-race-ca-nhan', ho_ten: 'QN Race CN', unit });
    const item = {
      personnel_id: target.id,
      ho_ten: target.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-RACE',
      nhan_bkbqp: false,
      nhan_cstdtq: false,
      nhan_bkttcp: false,
    };
    const proposalA = makeProposal({
      id: 'prop-race-cn-a',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-manager-a',
      unit,
      data_danh_hieu: [item],
    });
    const proposalB = makeProposal({
      id: 'prop-race-cn-b',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-manager-b',
      unit,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockImplementation(async args => {
      const id = args?.where?.id;
      if (id === proposalA.id) return proposalA;
      if (id === proposalB.id) return proposalB;
      return null;
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.quanNhan.findUnique.mockResolvedValue(target);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValue({
      id: 'annual-race-upsert',
      quan_nhan_id: target.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });
    prismaMock.bangDeXuat.updateMany.mockImplementation(async args => ({
      count: args?.where?.id === proposalA.id ? 1 : 0,
    }));

    const results = await Promise.allSettled([
      proposalService.approveProposal(
        proposalA.id,
        {},
        ADMIN_ID,
        { so_quyet_dinh_cstdcs: 'QD-CSTDCS-RACE-A' },
        {},
        null
      ),
      proposalService.approveProposal(
        proposalB.id,
        {},
        'acc-admin-race-2',
        { so_quyet_dinh_cstdcs: 'QD-CSTDCS-RACE-B' },
        {},
        null
      ),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled.length + rejected.length).toBe(2);
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(prismaMock.danhHieuHangNam.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(2);
  });

  it('Hai proposal DON_VI_HANG_NAM từ 2 manager duyệt song song -> chỉ 1 request chốt trạng thái', async () => {
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-don-vi' });
    const item = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: unit.id,
      ten_don_vi: unit.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT-RACE',
    });
    const proposalA = makeProposal({
      id: 'prop-race-dv-a',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-manager-dv-a',
      unit,
      data_danh_hieu: [item],
    });
    const proposalB = makeProposal({
      id: 'prop-race-dv-b',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-manager-dv-b',
      unit,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockImplementation(async args => {
      const id = args?.where?.id;
      if (id === proposalA.id) return proposalA;
      if (id === proposalB.id) return proposalB;
      return null;
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValue(null);
    prismaMock.danhHieuDonViHangNam.create.mockResolvedValue({
      id: 'unit-annual-race-create',
      co_quan_don_vi_id: unit.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
    });
    prismaMock.bangDeXuat.updateMany.mockImplementation(async args => ({
      count: args?.where?.id === proposalA.id ? 1 : 0,
    }));

    const results = await Promise.allSettled([
      proposalService.approveProposal(
        proposalA.id,
        {},
        ADMIN_ID,
        { so_quyet_dinh_don_vi_hang_nam: 'QD-DVQT-RACE-A' },
        {},
        null
      ),
      proposalService.approveProposal(
        proposalB.id,
        {},
        'acc-admin-race-2',
        { so_quyet_dinh_don_vi_hang_nam: 'QD-DVQT-RACE-B' },
        {},
        null
      ),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled.length + rejected.length).toBe(2);
    expect(fulfilled.length).toBe(0);
    expect(rejected.length).toBe(2);
    expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();

    for (const failure of rejected) {
      if (failure.status === 'rejected') {
        expect(failure.reason).toBeTruthy();
      }
    }
  });

  it('Hai proposal DON_VI_HANG_NAM (DVTT) duyệt song song -> chỉ 1 request chốt trạng thái', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-race-don-vi', parentId: 'cqdv-race-parent' });
    const item = makeProposalItemDonVi({
      unitKind: 'DVTT',
      unitId: dvtt.id,
      ten_don_vi: dvtt.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
      so_quyet_dinh: 'QD-DVTT-RACE',
    });
    const proposalA = makeProposal({
      id: 'prop-race-dvtt-a',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-manager-dvtt-a',
      unit: dvtt,
      data_danh_hieu: [item],
    });
    const proposalB = makeProposal({
      id: 'prop-race-dvtt-b',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-manager-dvtt-b',
      unit: dvtt,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockImplementation(async args => {
      const id = args?.where?.id;
      if (id === proposalA.id) return proposalA;
      if (id === proposalB.id) return proposalB;
      return null;
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValue(null);
    prismaMock.danhHieuDonViHangNam.create.mockResolvedValue({
      id: 'unit-annual-race-dvtt-create',
      don_vi_truc_thuoc_id: dvtt.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
    });
    prismaMock.bangDeXuat.updateMany.mockImplementation(async args => ({
      count: args?.where?.id === proposalA.id ? 1 : 0,
    }));

    const results = await Promise.allSettled([
      proposalService.approveProposal(
        proposalA.id,
        {},
        ADMIN_ID,
        { so_quyet_dinh_don_vi_hang_nam: 'QD-DVTT-RACE-A' },
        {},
        null
      ),
      proposalService.approveProposal(
        proposalB.id,
        {},
        'acc-admin-race-2',
        { so_quyet_dinh_don_vi_hang_nam: 'QD-DVTT-RACE-B' },
        {},
        null
      ),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled.length + rejected.length).toBe(2);
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(prismaMock.danhHieuDonViHangNam.create).toHaveBeenCalled();
    const firstCreateArgs = prismaMock.danhHieuDonViHangNam.create.mock.calls[0][0];
    expect(firstCreateArgs.data.DonViTrucThuoc).toEqual({ connect: { id: dvtt.id } });
  });

  it('Hai proposal NCKH từ 2 manager duyệt song song -> hiện tại cả hai đều approve', async () => {
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-nckh' });
    const target = makePersonnel({ id: 'qn-race-nckh', ho_ten: 'QN Race NCKH', unit });
    const item = {
      personnel_id: target.id,
      nam: 2024,
      loai: 'DTKH',
      mo_ta: 'Đề tài race',
    };
    const proposalA = makeProposal({
      id: 'prop-race-nckh-a',
      loai: PROPOSAL_TYPES.NCKH,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-manager-nckh-a',
      unit,
      data_thanh_tich: [item],
    });
    const proposalB = makeProposal({
      id: 'prop-race-nckh-b',
      loai: PROPOSAL_TYPES.NCKH,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-manager-nckh-b',
      unit,
      data_thanh_tich: [item],
    });

    prismaMock.bangDeXuat.findUnique
      .mockResolvedValueOnce(proposalA)
      .mockResolvedValueOnce(proposalB);
    prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValue([]);
    prismaMock.taiKhoan.findUnique.mockResolvedValue({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValue(target);
    prismaMock.thanhTichKhoaHoc.create.mockResolvedValue({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValue({ count: 1 });

    const results = await Promise.allSettled([
      proposalService.approveProposal(proposalA.id, {}, ADMIN_ID, {}, {}, null),
      proposalService.approveProposal(proposalB.id, {}, 'acc-admin-race-2', {}, {}, null),
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('fulfilled');
    expect(prismaMock.thanhTichKhoaHoc.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(2);
  });

  it('DON_VI_HANG_NAM (DVTT): 1 admin duyệt và 1 admin từ chối cùng lúc -> chỉ 1 bên thành công', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-race-approve-reject', parentId: 'cqdv-parent-race' });
    const item = makeProposalItemDonVi({
      unitKind: 'DVTT',
      unitId: dvtt.id,
      ten_don_vi: dvtt.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
      so_quyet_dinh: 'QD-DVTT-APPROVE-REJECT',
    });
    const proposal = makeProposal({
      id: 'prop-race-dvtt-approve-reject',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      unit: dvtt,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValue([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValue(null);
    prismaMock.danhHieuDonViHangNam.create.mockResolvedValue({
      id: 'dvtt-award-created',
      don_vi_truc_thuoc_id: dvtt.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
    });
    prismaMock.bangDeXuat.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.allSettled([
      proposalService.approveProposal(
        proposal.id,
        {},
        ADMIN_ID,
        { so_quyet_dinh_don_vi_hang_nam: 'QD-DVTT-APPROVE' },
        {},
        null
      ),
      proposalService.rejectProposal(proposal.id, 'Reject in race', 'acc-admin-race-2'),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
  });

  it('NIEN_HAN: 1 admin duyệt và 1 admin từ chối cùng lúc -> chỉ 1 bên thành công', async () => {
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-nh' });
    const target = makePersonnel({
      id: 'qn-race-nh',
      ho_ten: 'QN Race NH',
      unit,
      ngay_nhap_ngu: new Date('2010-01-01'),
    });
    const proposal = makeProposal({
      id: 'prop-race-nh-approve-reject',
      loai: PROPOSAL_TYPES.NIEN_HAN,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: MANAGER_ID,
      unit,
      data_nien_han: [
        {
          personnel_id: target.id,
          danh_hieu: DANH_HIEU_HCCSVV.HANG_BA,
          nam_nhan: 2024,
          thang_nhan: 6,
          so_quyet_dinh: 'QD-NH-RACE',
        },
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.taiKhoan.findUnique.mockResolvedValue({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValue([]);
    prismaMock.quanNhan.findUnique.mockResolvedValue(target);
    prismaMock.khenThuongHCCSVV.upsert.mockResolvedValue({});
    prismaMock.hoSoNienHan.upsert.mockResolvedValue({});
    prismaMock.bangDeXuat.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.allSettled([
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      proposalService.rejectProposal(proposal.id, 'Reject NH race', 'acc-admin-race-2'),
    ]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('CONG_HIEN: 1 admin duyệt và 1 admin từ chối cùng lúc -> chỉ 1 bên thành công', async () => {
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-ch' });
    const target = makePersonnel({
      id: 'qn-race-ch',
      ho_ten: 'QN Race CH',
      unit,
      gioi_tinh: 'NAM',
    });
    const proposal = makeProposal({
      id: 'prop-race-ch-approve-reject',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: MANAGER_ID,
      unit,
      data_cong_hien: [
        {
          personnel_id: target.id,
          ho_ten: target.ho_ten,
          danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
          cap_bac: 'Đại úy',
          chuc_vu: 'Trợ lý',
          nam_nhan: 2024,
          thang_nhan: 6,
          so_quyet_dinh: 'QD-CH-RACE',
          thoi_gian_nhom_0_7: { total_months: 0, years: 0, months: 0, display: '-' },
          thoi_gian_nhom_0_8: { total_months: 60, years: 5, months: 0, display: '5 năm' },
          thoi_gian_nhom_0_9_1_0: { total_months: 60, years: 5, months: 0, display: '5 năm' },
        },
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValue([
      { id: target.id, ho_ten: target.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValue([
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.8,
        so_thang: 72,
        ngay_bat_dau: new Date('2012-01-01'),
        ngay_ket_thuc: new Date('2018-01-01'),
      },
      {
        quan_nhan_id: target.id,
        he_so_chuc_vu: 0.9,
        so_thang: 72,
        ngay_bat_dau: new Date('2018-01-01'),
        ngay_ket_thuc: new Date('2024-01-01'),
      },
    ]);
    prismaMock.quanNhan.findUnique.mockResolvedValue(target);
    prismaMock.khenThuongHCBVTQ.findUnique.mockResolvedValue(null);
    prismaMock.khenThuongHCBVTQ.create.mockResolvedValue({});
    prismaMock.hoSoCongHien.upsert.mockResolvedValue({});
    prismaMock.bangDeXuat.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.allSettled([
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      proposalService.rejectProposal(proposal.id, 'Reject CH race', 'acc-admin-race-2'),
    ]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('KNC: 1 admin duyệt và 1 admin từ chối cùng lúc -> chỉ 1 bên thành công', async () => {
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-knc' });
    const target = makePersonnel({
      id: 'qn-race-knc',
      ho_ten: 'QN Race KNC',
      unit,
      gioi_tinh: 'NAM',
      ngay_nhap_ngu: new Date('1994-01-01'),
    });
    const proposal = makeProposal({
      id: 'prop-race-knc-approve-reject',
      loai: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: MANAGER_ID,
      unit,
      data_nien_han: [
        {
          personnel_id: target.id,
          danh_hieu: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
          nam_nhan: 2024,
          thang_nhan: 6,
          so_quyet_dinh: 'QD-KNC-RACE',
        },
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.taiKhoan.findUnique.mockResolvedValue({
      id: ADMIN_ID,
      username: 'admin',
      QuanNhan: { ho_ten: 'Admin' },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValue(target);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findUnique.mockResolvedValue(null);
    prismaMock.kyNiemChuongVSNXDQDNDVN.create.mockResolvedValue({});
    prismaMock.bangDeXuat.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.allSettled([
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      proposalService.rejectProposal(proposal.id, 'Reject KNC race', 'acc-admin-race-2'),
    ]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});
