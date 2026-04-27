/**
 * Authorization sneaky scenarios — pin who can do what across submit/view/delete.
 * Each test sets up an attacker persona (manager outside scope, admin acting on
 * another admin's proposals, etc.) and asserts whether the service accepts or
 * rejects the call. Behaviors that look permissive are pinned and tagged with
 * a TODO so business can decide on hardening.
 */

import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeAdmin, makePersonnel, makeProposal, makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import {
  PROPOSAL_VIEW_FORBIDDEN_OTHERS,
} from '../helpers/errorMessages';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ForbiddenError } from '../../src/middlewares/errorHandler';
import { ROLES } from '../../src/constants/roles.constants';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';

beforeEach(() => {
  resetPrismaMock();
  jest
    .spyOn(profileService, 'checkAwardEligibility')
    .mockResolvedValue({ eligible: true, reason: '' });
  prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
  prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const AUTH_SNEAKY_MANAGER_ID = 'acc-mgr-sneaky';
const AUTH_SNEAKY_ADMIN_OTHER_ID = 'acc-admin-other';

interface SneakyManagerFixture {
  cqdvA: ReturnType<typeof makeUnit>;
  cqdvB: ReturnType<typeof makeUnit>;
}

/** Builds a manager scoped to `cqdv-A`, with `cqdv-B` set up as an unrelated unit. */
function AUTH_SNEAKY_arrangeManagerCqdvA(): SneakyManagerFixture {
  const cqdvA = makeUnit({ kind: 'CQDV', id: 'cqdv-A-sneaky' });
  const cqdvB = makeUnit({ kind: 'CQDV', id: 'cqdv-B-sneaky' });
  prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
    ...makeAdmin({ id: AUTH_SNEAKY_MANAGER_ID, role: ROLES.MANAGER }),
    QuanNhan: {
      id: 'qn-mgr-sneaky',
      ho_ten: 'Manager Sneaky',
      co_quan_don_vi_id: cqdvA.id,
      don_vi_truc_thuoc_id: null,
      CoQuanDonVi: cqdvA.CoQuanDonVi,
      DonViTrucThuoc: null,
    },
  });
  return { cqdvA, cqdvB };
}

describe('Authorization sneaky — submit cross-unit personnel', () => {
  it('Manager CQDV-A submit cho QN thuộc CQDV-B → service vẫn tạo proposal (pinned: thiếu guard)', async () => {
    // Given: manager scoped to A, target personnel actually belongs to B
    const { cqdvA, cqdvB } = AUTH_SNEAKY_arrangeManagerCqdvA();
    const targetInOtherUnit = makePersonnel({
      unit: cqdvB,
      id: 'qn-in-B',
      ho_ten: 'QN Ngoài Đơn Vị',
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([targetInOtherUnit]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-cross-unit',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: cqdvA.CoQuanDonVi,
      NguoiDeXuat: { id: AUTH_SNEAKY_MANAGER_ID, username: 'mgr', QuanNhan: null },
    });

    // When
    await proposalService.submitProposal(
      [{ personnel_id: targetInOtherUnit.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      null,
      null,
      AUTH_SNEAKY_MANAGER_ID,
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      2024,
      null,
      null
    );

    // Then: proposal stored under manager's own unit (CQDV-A), not the target's unit.
    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.co_quan_don_vi_id).toBe(cqdvA.id);
    expect(data.nguoi_de_xuat_id).toBe(AUTH_SNEAKY_MANAGER_ID);
    // TODO: behavior is no cross-unit personnel guard — manager can list any QN id
    //   in titleData and the service accepts it. Consider rejecting items whose
    //   personnel unit does not match the manager's scope.
  });
});

describe('Authorization sneaky — body field overrides', () => {
  it('Token là MANAGER nhưng body có nguoi_de_xuat_id của ADMIN khác → service ignore body, dùng userId từ token', async () => {
    // Given: malicious manager passes someone else's account id as body field;
    // submitProposal signature does not accept a body.nguoi_de_xuat_id at all,
    // so the value is necessarily ignored. This test pins that exact contract.
    const { cqdvA } = AUTH_SNEAKY_arrangeManagerCqdvA();
    const target = makePersonnel({ unit: cqdvA, id: 'qn-token-test' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-token',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: cqdvA.CoQuanDonVi,
      NguoiDeXuat: { id: AUTH_SNEAKY_MANAGER_ID, username: 'mgr', QuanNhan: null },
    });

    // When: submit with manager userId — service signature has no body override.
    await proposalService.submitProposal(
      [{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      null,
      null,
      AUTH_SNEAKY_MANAGER_ID,
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      2024,
      null,
      null
    );

    // Then: nguoi_de_xuat_id always equals the token-provided userId.
    expect(prismaMock.bangDeXuat.create.mock.calls[0][0].data.nguoi_de_xuat_id).toBe(
      AUTH_SNEAKY_MANAGER_ID
    );
    expect(prismaMock.bangDeXuat.create.mock.calls[0][0].data.nguoi_de_xuat_id).not.toBe(
      AUTH_SNEAKY_ADMIN_OTHER_ID
    );
  });
});

describe('Authorization sneaky — getProposalById cross-DVTT', () => {
  it('Manager DVTT-A xem proposal của DVTT-B → ForbiddenError', async () => {
    // Given: proposal scoped to dvtt-B, manager scoped to dvtt-A
    const dvttA = makeUnit({ kind: 'DVTT', id: 'dvtt-A-sneaky' });
    const dvttB = makeUnit({ kind: 'DVTT', id: 'dvtt-B-sneaky' });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce({
      id: 'p-dvtt-cross',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      thang: null,
      data_danh_hieu: [],
      data_thanh_tich: [],
      data_nien_han: [],
      data_cong_hien: [],
      files_attached: [],
      ghi_chu: null,
      rejection_reason: null,
      ngay_duyet: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      co_quan_don_vi_id: null,
      don_vi_truc_thuoc_id: dvttB.id,
      CoQuanDonVi: null,
      DonViTrucThuoc: dvttB.DonViTrucThuoc,
      NguoiDeXuat: { id: 'acc-other', username: 'other', QuanNhan: null },
      NguoiDuyet: null,
    });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: AUTH_SNEAKY_MANAGER_ID,
      QuanNhan: {
        id: 'qn-mgr-dvtt',
        co_quan_don_vi_id: null,
        don_vi_truc_thuoc_id: dvttA.id,
        CoQuanDonVi: null,
        DonViTrucThuoc: dvttA.DonViTrucThuoc,
      },
    });

    await expectError(
      proposalService.getProposalById('p-dvtt-cross', AUTH_SNEAKY_MANAGER_ID, ROLES.MANAGER),
      ForbiddenError,
      PROPOSAL_VIEW_FORBIDDEN_OTHERS
    );
  });
});

describe('Authorization sneaky — delete by SUPER_ADMIN on another admin proposal', () => {
  it('SUPER_ADMIN xóa proposal PENDING của ADMIN khác → cho phép (chỉ MANAGER bị giới hạn owner)', async () => {
    // Given: proposal owned by ADMIN_OTHER, deleter is SUPER_ADMIN
    const proposal = makeProposal({
      id: 'p-super-delete',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: AUTH_SNEAKY_ADMIN_OTHER_ID,
      status: PROPOSAL_STATUS.PENDING,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.bangDeXuat.deleteMany.mockResolvedValueOnce({ count: 1 });

    // When
    const result = await proposalService.deleteProposal(
      proposal.id,
      'acc-super-1',
      ROLES.SUPER_ADMIN
    );

    // Then: deletion succeeds
    expect(prismaMock.bangDeXuat.deleteMany).toHaveBeenCalledTimes(1);
    expect(result.message).toBe('Đã xóa đề xuất thành công');
    // TODO: behavior is SUPER_ADMIN can delete any pending proposal — verify with
    //   business whether deletion across owners should be reserved or audited more strictly.
  });
});

describe('Authorization sneaky — manager DVTT submitting personnel of parent CQDV', () => {
  it('Manager DVTT-A submit cho QN thuộc CQDV cha → service vẫn tạo proposal, scope = DVTT-A', async () => {
    // Given: manager scoped to dvtt-A; target personnel actually sits under cqdv-parent (CQDV cha)
    const dvttA = makeUnit({ kind: 'DVTT', id: 'dvtt-A-parent', parentId: 'cqdv-parent' });
    const parentCqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-parent' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      ...makeAdmin({ id: AUTH_SNEAKY_MANAGER_ID, role: ROLES.MANAGER }),
      QuanNhan: {
        id: 'qn-mgr-dvtt-parent',
        ho_ten: 'Manager DVTT',
        co_quan_don_vi_id: null,
        don_vi_truc_thuoc_id: dvttA.id,
        CoQuanDonVi: null,
        DonViTrucThuoc: dvttA.DonViTrucThuoc,
      },
    });
    const targetInParent = makePersonnel({
      unit: parentCqdv,
      id: 'qn-in-parent',
      ho_ten: 'QN CQDV Cha',
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([targetInParent]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-parent-cross',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: dvttA.DonViTrucThuoc,
      CoQuanDonVi: null,
      NguoiDeXuat: { id: AUTH_SNEAKY_MANAGER_ID, username: 'mgr', QuanNhan: null },
    });

    // When
    await proposalService.submitProposal(
      [{ personnel_id: targetInParent.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      null,
      null,
      AUTH_SNEAKY_MANAGER_ID,
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      2024,
      null,
      null
    );

    // Then: proposal scoped to dvtt-A (manager's unit), not the parent CQDV.
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.don_vi_truc_thuoc_id).toBe(dvttA.id);
    expect(data.co_quan_don_vi_id).toBeNull();
    // TODO: behavior is identical to cross-unit case — DVTT manager can submit for parent
    //   CQDV personnel even though they don't manage that scope. Consider verifying that
    //   the personnel's unit chain matches the manager's scope.
  });
});
