/**
 * Authorization sneaky scenarios — pin ai làm được gì trên submit/view/delete.
 * Mỗi test dựng 1 persona kẻ tấn công (manager ngoài scope, admin thao tác
 * trên proposal của admin khác, ...) và assert service chấp nhận hay reject.
 * Hành vi nhìn có vẻ permissive được pin lại và gắn TODO để business cân
 * nhắc hardening.
 */

import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeAdmin, makePersonnel, makeProposal, makeUnit } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import {
  PROPOSAL_VIEW_FORBIDDEN_OTHERS,
} from '../helpers/errorMessages';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ForbiddenError, ValidationError } from '../../src/middlewares/errorHandler';
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
const PERSONNEL_OUT_OF_SCOPE_MSG =
  'Không thể đề xuất khen thưởng cho quân nhân ngoài đơn vị quản lý của bạn.';

interface SneakyManagerFixture {
  cqdvA: ReturnType<typeof makeUnit>;
  cqdvB: ReturnType<typeof makeUnit>;
}

/** Dựng manager scope `cqdv-A`, với `cqdv-B` là đơn vị không liên quan. */
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

describe('Bảo mật: chặn lách quyền khi đề xuất cho quân nhân ngoài đơn vị', () => {
  it('Bảo mật: chặn lách quyền — MANAGER thuộc CQDV-A đề xuất cho quân nhân của CQDV-B → bị chặn', async () => {
    // Cho trước: manager scope A, quân nhân target thực ra thuộc B
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

    // Thì: guard chặn — manager không được đề xuất cho quân nhân ngoài đơn vị quản lý.
    await expectError(
      proposalService.submitProposal(
        [{ personnel_id: targetInOtherUnit.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
        null,
        AUTH_SNEAKY_MANAGER_ID,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      ),
      ValidationError,
      PERSONNEL_OUT_OF_SCOPE_MSG
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });
});

describe('Bảo mật: chặn lách quyền bằng cách giả mạo người đề xuất trong dữ liệu gửi lên', () => {
  it('Bảo mật: chặn lách quyền — MANAGER nhét người đề xuất là ADMIN khác vào payload → hệ thống vẫn ghi nhận người đề xuất theo phiên đăng nhập', async () => {
    // Cho trước: manager xấu pass id account người khác qua body;
    // signature submitProposal không nhận body.nguoi_de_xuat_id nên giá trị
    // chắc chắn bị ignore. Test này pin chính xác contract đó.
    const { cqdvA } = AUTH_SNEAKY_arrangeManagerCqdvA();
    const target = makePersonnel({ unit: cqdvA, id: 'qn-token-test' });
    prismaMock.quanNhan.findMany.mockResolvedValue([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-token',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: cqdvA.CoQuanDonVi,
      NguoiDeXuat: { id: AUTH_SNEAKY_MANAGER_ID, username: 'mgr', QuanNhan: null },
    });

    // Khi: submit với userId của manager — signature service không có body override.
    await proposalService.submitProposal(
      [{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      null,      AUTH_SNEAKY_MANAGER_ID,
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      2024,
      null,
      null
    );

    // Kết quả: nguoi_de_xuat_id luôn bằng userId từ token.
    expect(prismaMock.bangDeXuat.create.mock.calls[0][0].data.nguoi_de_xuat_id).toBe(
      AUTH_SNEAKY_MANAGER_ID
    );
    expect(prismaMock.bangDeXuat.create.mock.calls[0][0].data.nguoi_de_xuat_id).not.toBe(
      AUTH_SNEAKY_ADMIN_OTHER_ID
    );
  });
});

describe('Bảo mật: chặn lách quyền xem đề xuất của DVTT khác', () => {
  it('Bảo mật: chặn lách quyền — MANAGER thuộc DVTT-A mở chi tiết đề xuất của DVTT-B → bị chặn', async () => {
    // Cho trước: proposal scope dvtt-B, manager scope dvtt-A
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

describe('Bảo mật: SUPER_ADMIN xóa đề xuất do người khác tạo', () => {
  it('Phân quyền: SUPER_ADMIN xóa đề xuất chờ duyệt của ADMIN khác → cho phép (chỉ MANAGER mới bị giới hạn theo người tạo)', async () => {
    // Cho trước: proposal thuộc ADMIN_OTHER, người xóa là SUPER_ADMIN
    const proposal = makeProposal({
      id: 'p-super-delete',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: AUTH_SNEAKY_ADMIN_OTHER_ID,
      status: PROPOSAL_STATUS.PENDING,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.bangDeXuat.deleteMany.mockResolvedValueOnce({ count: 1 });

    // Khi
    const result = await proposalService.deleteProposal(
      proposal.id,
      'acc-super-1',
      ROLES.SUPER_ADMIN
    );

    // Kết quả: xóa thành công
    expect(prismaMock.bangDeXuat.deleteMany).toHaveBeenCalledTimes(1);
    expect(result.message).toBe('Đã xóa đề xuất thành công');
    // TODO: hiện SUPER_ADMIN có thể xóa bất kỳ proposal pending nào — cần xác
    //   nhận với business xem việc xóa qua owner khác có cần giới hạn hoặc audit kỹ hơn.
  });
});

describe('Bảo mật: chặn lách quyền khi MANAGER cấp DVTT đề xuất cho quân nhân thuộc CQDV cha', () => {
  it('Bảo mật: chặn lách quyền — MANAGER thuộc DVTT-A đề xuất cho quân nhân của CQDV cha → bị chặn (ngoài phạm vi DVTT)', async () => {
    // Cho trước: manager scope dvtt-A; quân nhân target thực ra thuộc cqdv-parent (CQDV cha)
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

    // Thì: guard chặn — quân nhân thuộc CQDV cha nằm ngoài scope DVTT-A của manager.
    await expectError(
      proposalService.submitProposal(
        [{ personnel_id: targetInParent.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
        null,
        AUTH_SNEAKY_MANAGER_ID,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      ),
      ValidationError,
      PERSONNEL_OUT_OF_SCOPE_MSG
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });
});
