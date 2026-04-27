import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeAdmin, makePersonnel, makeProposal, makeProposalItemDonVi, makeUnit } from '../helpers/fixtures';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { ROLES } from '../../src/constants/roles.constants';
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

describe('Proposal race conditions', () => {
  it('Manager xóa đúng lúc Admin duyệt cùng proposal -> approve fail với "đã bị thay đổi"', async () => {
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-1' });
    const proposal = makeProposal({
      id: 'prop-race-approve-delete',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      unit,
      data_danh_hieu: [],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
    prismaMock.bangDeXuat.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 0 });

    const [deleteResult, approveResult] = await Promise.allSettled([
      proposalService.deleteProposal(proposal.id, MANAGER_ID, ROLES.MANAGER),
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
    ]);

    expect(deleteResult.status).toBe('fulfilled');
    expect(approveResult.status).toBe('rejected');
    if (approveResult.status === 'rejected') {
      expect(approveResult.reason).toBeInstanceOf(ValidationError);
      expect(approveResult.reason.message).toContain('Đề xuất đã bị thay đổi bởi người khác');
    }
  });

  it('Manager và Admin cùng lúc xóa 1 proposal -> chỉ 1 bên thành công', async () => {
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-2' });
    const proposal = makeProposal({
      id: 'prop-race-double-delete',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      unit,
      data_danh_hieu: [],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
    prismaMock.bangDeXuat.deleteMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.allSettled([
      proposalService.deleteProposal(proposal.id, MANAGER_ID, ROLES.MANAGER),
      proposalService.deleteProposal(proposal.id, ADMIN_ID, ROLES.ADMIN),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(prismaMock.bangDeXuat.deleteMany).toHaveBeenCalledTimes(2);

    const loser = rejected[0];
    if (loser.status === 'rejected') {
      expect(loser.reason).toBeInstanceOf(ValidationError);
      expect(loser.reason.message).toContain('Đề xuất đã bị thay đổi bởi người khác');
    }
  });

  it('Approve vẫn success khi recalc đơn vị fail do dữ liệu vừa bị xóa', async () => {
    const submittedUnit = makeUnit({ kind: 'CQDV', id: 'cqdv-submitted' });
    const deletedUnitId = 'cqdv-deleted-during-recalc';

    const submittedItem = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: submittedUnit.id,
      ten_don_vi: submittedUnit.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
      so_quyet_dinh: 'QD-DVTT-01',
    });
    const editedItem = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: deletedUnitId,
      ten_don_vi: 'Đơn vị đã bị xóa',
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
      so_quyet_dinh: 'QD-DVTT-01',
    });
    const proposal = makeProposal({
      id: 'prop-race-recalc',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      unit: submittedUnit,
      data_danh_hieu: [submittedItem],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValue(null);
    prismaMock.danhHieuDonViHangNam.create.mockResolvedValueOnce({
      id: 'dv-award-new',
      co_quan_don_vi_id: deletedUnitId,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
    });
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    jest
      .spyOn(unitAnnualAwardService, 'recalculateAnnualUnit')
      .mockRejectedValueOnce(new Error('Unit not found during recalc'));

    const result = await proposalService.approveProposal(
      proposal.id,
      { data_danh_hieu: [editedItem] },
      ADMIN_ID,
      { so_quyet_dinh_don_vi_hang_nam: 'QD-DVTT-01' },
      {},
      null
    );

    expect(result.message).toContain('Phê duyệt');
    expect(result.result.imported_danh_hieu).toBe(1);
    expect(result.result.recalculated_profiles).toBe(0);
    expect(result.result.recalculate_errors).toBe(1);
  });

  it('Hai admin duyệt/từ chối cùng lúc 1 proposal -> chỉ 1 thao tác thành công', async () => {
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-approve-reject' });
    const proposal = makeProposal({
      id: 'prop-race-approve-reject',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      unit,
      data_danh_hieu: [],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
    prismaMock.bangDeXuat.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.allSettled([
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      proposalService.rejectProposal(proposal.id, 'Race reject', 'acc-admin-race-2'),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(2);

    const loser = rejected[0];
    if (loser.status === 'rejected') {
      expect(loser.reason).toBeInstanceOf(ValidationError);
      expect(loser.reason.message).toContain('Đề xuất đã bị thay đổi bởi người khác');
    }
  });

  it('Hai manager submit cùng payload cùng lúc -> hiện tại cả hai đều tạo proposal', async () => {
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-submit' });
    const managerQn = makePersonnel({ id: 'qn-manager-race-submit', unit, ho_ten: 'Manager Race' });
    const account = makeAdmin({ id: MANAGER_ID, quanNhan: managerQn });
    const target = makePersonnel({ id: 'qn-target-race-submit', ho_ten: 'QN Submit Race' });

    prismaMock.taiKhoan.findUnique.mockResolvedValue({
      ...account,
      QuanNhan: {
        ...managerQn,
        CoQuanDonVi: unit.kind === 'CQDV' ? unit.CoQuanDonVi : null,
        DonViTrucThuoc: null,
      },
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.bangDeXuat.create
      .mockResolvedValueOnce({
        id: 'prop-race-submit-1',
        loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        status: PROPOSAL_STATUS.PENDING,
        createdAt: new Date(),
        DonViTrucThuoc: null,
        CoQuanDonVi: { ten_don_vi: unit.ten_don_vi },
        NguoiDeXuat: { id: account.id, username: account.username, QuanNhan: { id: managerQn.id, ho_ten: managerQn.ho_ten } },
      })
      .mockResolvedValueOnce({
        id: 'prop-race-submit-2',
        loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        status: PROPOSAL_STATUS.PENDING,
        createdAt: new Date(),
        DonViTrucThuoc: null,
        CoQuanDonVi: { ten_don_vi: unit.ten_don_vi },
        NguoiDeXuat: { id: account.id, username: account.username, QuanNhan: { id: managerQn.id, ho_ten: managerQn.ho_ten } },
      });

    const results = await Promise.allSettled([
      proposalService.submitProposal(
        [{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
        null,        MANAGER_ID,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      ),
      proposalService.submitProposal(
        [{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
        null,        MANAGER_ID,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      ),
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('fulfilled');
    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(2);
  });

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

  it('Admin xóa CSTDCS giữa lúc manager submit BKBQP → reject với reason cụ thể', async () => {
    // Race: manager fetch profile thấy 2 năm CSTDCS (đủ BKBQP),
    // admin xóa 1 CSTDCS, manager bấm submit. Submit tính lại eligibility.
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-delete' });
    const target = makePersonnel({ id: 'qn-race-delete', ho_ten: 'QN Bị Xóa', unit });
    const managerQn = makePersonnel({ id: 'qn-mgr-delete', ho_ten: 'Manager', unit });

    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: MANAGER_ID,
      username: 'manager',
      role: ROLES.MANAGER,
      QuanNhan: {
        ...managerQn,
        CoQuanDonVi: unit.CoQuanDonVi,
        DonViTrucThuoc: null,
      },
    });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

    // Override mock eligibility mặc định với reason fail mà profileService
    // sẽ trả về sau khi xóa: BKBQP cần 2 năm CSTDCS nhưng chỉ còn 1.
    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValue({
      eligible: false,
      reason:
        'Chưa đủ điều kiện Bằng khen của Bộ trưởng Bộ Quốc phòng.\n' +
        'Yêu cầu: 2 năm CSTDCS liên tục, NCKH mỗi năm.\n' +
        'Hiện có: 1 năm CSTDCS, 2 năm NCKH.',
    });

    await expect(
      proposalService.submitProposal(
        [{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP }],
        null,        MANAGER_ID,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      )
    ).rejects.toThrow(ValidationError);

    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('Admin xóa CSTDCS giữa lúc proposal BKBQP pending → approve fail với recheck', async () => {
    // Race: proposal PENDING có BKBQP item, admin xóa CSTDCS,
    // rồi admin approve. approveProposal tính lại eligibility theo state mới.
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-race-approve-delete' });
    const target = makePersonnel({ id: 'qn-race-approve-delete', ho_ten: 'QN Pending', unit });
    const proposal = makeProposal({
      id: 'prop-race-delete-approve',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      unit,
      data_danh_hieu: [
        { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP },
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValue([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValue({
      eligible: false,
      reason:
        'Chưa đủ điều kiện Bằng khen của Bộ trưởng Bộ Quốc phòng.\n' +
        'Yêu cầu: 2 năm CSTDCS liên tục, NCKH mỗi năm.\n' +
        'Hiện có: 1 năm CSTDCS, 2 năm NCKH.',
    });

    await expect(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
    ).rejects.toThrow(/Kiểm tra lại điều kiện trước khi phê duyệt thất bại/);

    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  describe('Group 1: Admin xóa reward giữa pending → submit/approve fail', () => {
    it('DON_VI_HANG_NAM: admin xóa ĐVQT năm trước giữa lúc submit BKBQP đơn vị → reject', async () => {
      // Given: manager submit BKBQP đơn vị nhưng admin vừa xóa ĐVQT 2y trước
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g1-bkbqp-submit' });
      const managerQn = makePersonnel({ id: 'qn-mgr-g1-bkbqp', unit, ho_ten: 'Manager G1' });

      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
        id: MANAGER_ID,
        username: 'manager',
        role: ROLES.MANAGER,
        QuanNhan: { ...managerQn, CoQuanDonVi: unit.CoQuanDonVi, DonViTrucThuoc: null },
      });
      prismaMock.coQuanDonVi.findUnique.mockResolvedValue({
        id: unit.id,
        ten_don_vi: unit.ten_don_vi,
        ma_don_vi: 'CQDV-001',
      });
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
      prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValue(null);

      jest
        .spyOn(unitAnnualAwardService, 'checkUnitAwardEligibility')
        .mockResolvedValue({
          eligible: false,
          reason: 'Chưa đủ 2 năm ĐVQT liên tục để nhận BKBQP',
        });

      // When + Then
      await expect(
        proposalService.submitProposal(
          [
            {
              personnel_id: '',
              don_vi_id: unit.id,
              don_vi_type: 'CO_QUAN_DON_VI',
              danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
            },
          ],
          null,          MANAGER_ID,
          PROPOSAL_TYPES.DON_VI_HANG_NAM,
          2024,
          null,
          null
        )
      ).rejects.toThrow(/Chưa đủ 2 năm ĐVQT liên tục/);

      expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
    });

    it('DON_VI_HANG_NAM: admin xóa ĐVQT giữa lúc proposal BKBQP đơn vị pending → approve fail', async () => {
      // Given: BKBQP đơn vị pending, admin xóa ĐVQT history → approve recheck fails
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g1-bkbqp-approve' });
      const item = makeProposalItemDonVi({
        unitKind: 'CQDV',
        unitId: unit.id,
        ten_don_vi: unit.ten_don_vi,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
        so_quyet_dinh: 'QD-BKBQP-G1',
      });
      const proposal = makeProposal({
        id: 'prop-g1-bkbqp-approve',
        loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_danh_hieu: [item],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
      prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValue(null);

      jest
        .spyOn(unitAnnualAwardService, 'checkUnitAwardEligibility')
        .mockResolvedValue({
          eligible: false,
          reason: 'Chưa đủ 2 năm ĐVQT liên tục để nhận BKBQP',
        });

      // When + Then
      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Kiểm tra lại điều kiện trước khi phê duyệt thất bại/);

      expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
      expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
    });

    it('CA_NHAN_HANG_NAM CSTDTQ: admin xóa BKBQP giữa pending → approve fail', async () => {
      // Given: CSTDTQ pending nhưng admin xóa 1 BKBQP cần thiết → recheck fail
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g1-cstdtq' });
      const target = makePersonnel({ id: 'qn-g1-cstdtq', ho_ten: 'QN CSTDTQ Race', unit });
      const proposal = makeProposal({
        id: 'prop-g1-cstdtq',
        loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_danh_hieu: [
          { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
      prismaMock.danhHieuHangNam.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      (profileService.checkAwardEligibility as jest.Mock).mockResolvedValue({
        eligible: false,
        reason:
          'Chưa đủ điều kiện CSTDTQ. Yêu cầu: 3 năm CSTDCS + 1 BKBQP. Hiện có: 3 CSTDCS + 0 BKBQP.',
      });

      // When + Then
      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Kiểm tra lại điều kiện trước khi phê duyệt thất bại/);

      expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    });

    it('CA_NHAN_HANG_NAM BKTTCP: admin xóa CSTDTQ trong 7y window giữa pending → approve fail', async () => {
      // Given: BKTTCP yêu cầu 3 BKBQP + 2 CSTDTQ trong 7y, admin xóa 1 CSTDTQ
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g1-bkttcp' });
      const target = makePersonnel({ id: 'qn-g1-bkttcp', ho_ten: 'QN BKTTCP Race', unit });
      const proposal = makeProposal({
        id: 'prop-g1-bkttcp',
        loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_danh_hieu: [
          { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
      prismaMock.danhHieuHangNam.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      (profileService.checkAwardEligibility as jest.Mock).mockResolvedValue({
        eligible: false,
        reason:
          'Chưa đủ điều kiện BKTTCP. Yêu cầu: 7y + 3 BKBQP + 2 CSTDTQ. Hiện có: 3 BKBQP + 1 CSTDTQ.',
      });

      // When + Then
      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Kiểm tra lại điều kiện trước khi phê duyệt thất bại/);

      expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Group 2: Admin xóa LichSuChucVu giữa CONG_HIEN flow', () => {
    it('CONG_HIEN submit: admin xóa LichSuChucVu → recompute thiếu tháng → reject', async () => {
      // Given: manager submit HCBVTQ HANG_NHI nhưng admin vừa xóa hết lịch sử chức vụ
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g2-ch-submit' });
      const managerQn = makePersonnel({ id: 'qn-mgr-g2', unit, ho_ten: 'Manager G2' });
      const target = makePersonnel({
        id: 'qn-g2-ch-submit',
        ho_ten: 'QN CH Submit',
        unit,
        gioi_tinh: 'NAM',
      });

      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
        id: MANAGER_ID,
        username: 'manager',
        role: ROLES.MANAGER,
        QuanNhan: { ...managerQn, CoQuanDonVi: unit.CoQuanDonVi, DonViTrucThuoc: null },
      });
      prismaMock.quanNhan.findMany.mockResolvedValue([
        { id: target.id, ho_ten: target.ho_ten, gioi_tinh: 'NAM', CoQuanDonVi: null, DonViTrucThuoc: null },
      ]);
      prismaMock.lichSuChucVu.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      // When + Then
      await expect(
        proposalService.submitProposal(
          [
            {
              personnel_id: target.id,
              danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
              cap_bac: 'Đại úy',
              chuc_vu: 'Trợ lý',
            },
          ],
          null,          MANAGER_ID,
          PROPOSAL_TYPES.CONG_HIEN,
          2024,
          null,
          6
        )
      ).rejects.toThrow(/không đủ điều kiện đề xuất Huân chương Bảo vệ Tổ quốc/);

      expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
    });

    it('CONG_HIEN approve: admin xóa LichSuChucVu giữa pending → approve recompute fail', async () => {
      // Given: HANG_NHAT pending (cần >=120 tháng nhóm 0.9-1.0), admin xóa lịch sử
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g2-ch-approve' });
      const target = makePersonnel({ id: 'qn-g2-ch-approve', ho_ten: 'QN CH Approve', unit, gioi_tinh: 'NAM' });
      const proposal = makeProposal({
        id: 'prop-g2-ch-approve',
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
            danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT,
            cap_bac: 'Đại úy',
            chuc_vu: 'Trợ lý',
            nam_nhan: 2024,
            thang_nhan: 6,
            so_quyet_dinh: 'QD-CH-G2',
            thoi_gian_nhom_0_7: { total_months: 0, years: 0, months: 0, display: '-' },
            thoi_gian_nhom_0_8: { total_months: 0, years: 0, months: 0, display: '-' },
            thoi_gian_nhom_0_9_1_0: { total_months: 130, years: 10, months: 10, display: '10 năm 10 tháng' },
          },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([
        { id: target.id, ho_ten: target.ho_ten, gioi_tinh: 'NAM' },
      ]);
      prismaMock.lichSuChucVu.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      // When + Then
      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Kiểm tra lại điều kiện trước khi phê duyệt thất bại/);

      expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
      expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('Group 3: Admin sửa ngày nhập ngũ → HC_QKQT/KNC fail', () => {
    it('HC_QKQT submit: admin sửa ngay_nhap_ngu thành 2002 (chỉ 22y) → reject', async () => {
      // Given: HC_QKQT cần >=25y phục vụ
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g3-qkqt-submit' });
      const managerQn = makePersonnel({ id: 'qn-mgr-g3-qkqt', unit, ho_ten: 'Manager G3' });
      const target = makePersonnel({
        id: 'qn-g3-qkqt-submit',
        ho_ten: 'QN QKQT Submit',
        unit,
        ngay_nhap_ngu: new Date('2002-01-01'),
      });

      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
        id: MANAGER_ID,
        username: 'manager',
        role: ROLES.MANAGER,
        QuanNhan: { ...managerQn, CoQuanDonVi: unit.CoQuanDonVi, DonViTrucThuoc: null },
      });
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          gioi_tinh: 'NAM',
          ngay_nhap_ngu: target.ngay_nhap_ngu,
          ngay_xuat_ngu: null,
          CoQuanDonVi: null,
          DonViTrucThuoc: null,
        },
      ]);

      // When + Then
      await expect(
        proposalService.submitProposal(
          [{ personnel_id: target.id, danh_hieu: PROPOSAL_TYPES.HC_QKQT }],
          null,          MANAGER_ID,
          PROPOSAL_TYPES.HC_QKQT,
          2024,
          null,
          6
        )
      ).rejects.toThrow(/Chưa đủ 25 năm phục vụ/);

      expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
    });

    it('HC_QKQT approve: admin sửa ngay_nhap_ngu giữa pending → approve recheck fail', async () => {
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g3-qkqt-approve' });
      const target = makePersonnel({
        id: 'qn-g3-qkqt-approve',
        ho_ten: 'QN QKQT Approve',
        unit,
        ngay_nhap_ngu: new Date('2002-01-01'),
      });
      const proposal = makeProposal({
        id: 'prop-g3-qkqt-approve',
        loai: PROPOSAL_TYPES.HC_QKQT,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        thang: 6,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_nien_han: [
          {
            personnel_id: target.id,
            danh_hieu: PROPOSAL_TYPES.HC_QKQT,
            nam_nhan: 2024,
            thang_nhan: 6,
            so_quyet_dinh: 'QD-QKQT-G3',
          },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          gioi_tinh: 'NAM',
          ngay_nhap_ngu: target.ngay_nhap_ngu,
          ngay_xuat_ngu: null,
        },
      ]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
      prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValue(null);

      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Chưa đủ 25 năm phục vụ/);

      expect(prismaMock.huanChuongQuanKyQuyetThang.create).not.toHaveBeenCalled();
      expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
    });

    it('KNC submit: admin sửa ngay_nhap_ngu của QN nữ thành 2005 (chỉ 19y) → reject', async () => {
      // Given: KNC nữ cần 20y, admin sửa ngày nhập ngũ thành 2005-06-01 → 19y < 20y
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g3-knc-submit' });
      const managerQn = makePersonnel({ id: 'qn-mgr-g3-knc', unit, ho_ten: 'Manager G3 KNC' });
      const target = makePersonnel({
        id: 'qn-g3-knc-submit',
        ho_ten: 'QN KNC Submit',
        unit,
        gioi_tinh: 'NU',
        ngay_nhap_ngu: new Date('2008-06-01'),
      });

      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
        id: MANAGER_ID,
        username: 'manager',
        role: ROLES.MANAGER,
        QuanNhan: { ...managerQn, CoQuanDonVi: unit.CoQuanDonVi, DonViTrucThuoc: null },
      });
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          gioi_tinh: 'NU',
          ngay_nhap_ngu: target.ngay_nhap_ngu,
          ngay_xuat_ngu: null,
          CoQuanDonVi: null,
          DonViTrucThuoc: null,
        },
      ]);

      await expect(
        proposalService.submitProposal(
          [{ personnel_id: target.id, danh_hieu: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN }],
          null,          MANAGER_ID,
          PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
          2024,
          null,
          6
        )
      ).rejects.toThrow(/Chưa đủ 20 năm phục vụ/);

      expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
    });

    it('KNC approve: admin sửa ngay_nhap_ngu giữa pending → approve recheck fail', async () => {
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g3-knc-approve' });
      const target = makePersonnel({
        id: 'qn-g3-knc-approve',
        ho_ten: 'QN KNC Approve',
        unit,
        gioi_tinh: 'NAM',
        ngay_nhap_ngu: new Date('2005-06-01'),
      });
      const proposal = makeProposal({
        id: 'prop-g3-knc-approve',
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
            so_quyet_dinh: 'QD-KNC-G3',
          },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          gioi_tinh: 'NAM',
          ngay_nhap_ngu: target.ngay_nhap_ngu,
          ngay_xuat_ngu: null,
        },
      ]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
      prismaMock.kyNiemChuongVSNXDQDNDVN.findFirst.mockResolvedValue(null);

      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Chưa đủ 25 năm phục vụ/);

      expect(prismaMock.kyNiemChuongVSNXDQDNDVN.create).not.toHaveBeenCalled();
      expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
    });

    it('KNC: admin set gioi_tinh = null giữa pending → approve reject "Chưa cập nhật giới tính"', async () => {
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g3-knc-gender' });
      const target = makePersonnel({
        id: 'qn-g3-knc-gender',
        ho_ten: 'QN KNC No Gender',
        unit,
        ngay_nhap_ngu: new Date('1990-01-01'),
      });
      const proposal = makeProposal({
        id: 'prop-g3-knc-gender',
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
            so_quyet_dinh: 'QD-KNC-GENDER',
          },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          gioi_tinh: null,
          ngay_nhap_ngu: target.ngay_nhap_ngu,
          ngay_xuat_ngu: null,
        },
      ]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Chưa cập nhật thông tin giới tính/);

      expect(prismaMock.kyNiemChuongVSNXDQDNDVN.create).not.toHaveBeenCalled();
    });
  });

  describe('Group 4: NIEN_HAN — admin xóa HCCSVV rank thấp', () => {
    it('NIEN_HAN submit: admin xóa HANG_BA năm trước giữa lúc submit HANG_NHI → reject', async () => {
      // Given: HANG_NHI yêu cầu đã nhận HANG_BA, admin xóa HANG_BA → rank order check fail
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g4-nh-submit' });
      const managerQn = makePersonnel({ id: 'qn-mgr-g4', unit, ho_ten: 'Manager G4' });
      const target = makePersonnel({ id: 'qn-g4-nh-submit', ho_ten: 'QN NH Submit', unit });

      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
        id: MANAGER_ID,
        username: 'manager',
        role: ROLES.MANAGER,
        QuanNhan: { ...managerQn, CoQuanDonVi: unit.CoQuanDonVi, DonViTrucThuoc: null },
      });
      prismaMock.quanNhan.findMany.mockResolvedValue([
        { id: target.id, ho_ten: target.ho_ten, CoQuanDonVi: null, DonViTrucThuoc: null },
      ]);
      prismaMock.khenThuongHCCSVV.findMany.mockResolvedValue([]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

      await expect(
        proposalService.submitProposal(
          [
            {
              personnel_id: target.id,
              danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI,
            },
          ],
          null,          MANAGER_ID,
          PROPOSAL_TYPES.NIEN_HAN,
          2024,
          null,
          6
        )
      ).rejects.toThrow(/HCCSVV/);

      expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
    });

    it('NIEN_HAN approve: admin xóa HANG_BA giữa proposal HANG_NHI pending → import error → reject', async () => {
      // Given: HANG_NHI pending, admin xóa HANG_BA → import loop ghi acc.errors → throw cuối tx
      const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-g4-nh-approve' });
      const target = makePersonnel({
        id: 'qn-g4-nh-approve',
        ho_ten: 'QN NH Approve',
        unit,
        ngay_nhap_ngu: new Date('2010-01-01'),
      });
      const proposal = makeProposal({
        id: 'prop-g4-nh-approve',
        loai: PROPOSAL_TYPES.NIEN_HAN,
        status: PROPOSAL_STATUS.PENDING,
        nam: 2024,
        thang: 6,
        nguoi_de_xuat_id: MANAGER_ID,
        unit,
        data_nien_han: [
          {
            personnel_id: target.id,
            danh_hieu: DANH_HIEU_HCCSVV.HANG_NHI,
            nam_nhan: 2024,
            thang_nhan: 6,
            so_quyet_dinh: 'QD-NH-G4',
          },
        ],
      });

      prismaMock.bangDeXuat.findUnique.mockResolvedValue(proposal);
      prismaMock.quanNhan.findMany.mockResolvedValue([{ id: target.id, ho_ten: target.ho_ten }]);
      prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
      prismaMock.khenThuongHCCSVV.findMany.mockResolvedValue([]);
      prismaMock.taiKhoan.findUnique.mockResolvedValue({
        id: ADMIN_ID,
        username: 'admin',
        QuanNhan: { ho_ten: 'Admin' },
      });
      prismaMock.quanNhan.findUnique.mockResolvedValue(target);

      await expect(
        proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null)
      ).rejects.toThrow(/Không thể phê duyệt đề xuất do có/);

      expect(prismaMock.khenThuongHCCSVV.upsert).not.toHaveBeenCalled();
    });
  });
});
