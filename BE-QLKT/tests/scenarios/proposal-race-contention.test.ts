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

describe('Proposal race conditions — direct contention on same proposal', () => {
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
});
