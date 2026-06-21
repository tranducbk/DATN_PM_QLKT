import { prismaMock } from '../helpers/prismaMock';
import proposalService from '../../src/services/proposal';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { expectError } from '../helpers/errorAssert';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';

const SELF_APPROVAL_MSG = 'Không thể tự phê duyệt đề xuất do chính mình tạo.';
const APPROVER = 'acc-admin-sod';

function mockPendingProposal(nguoiDeXuatId: string | null): void {
  prismaMock.bangDeXuat.findUnique.mockResolvedValue({
    id: 'p-sod-1',
    status: PROPOSAL_STATUS.PENDING,
    loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
    nam: 2024,
    thang: null,
    nguoi_de_xuat_id: nguoiDeXuatId,
    data_danh_hieu: [],
    data_thanh_tich: [],
    data_nien_han: [],
    data_cong_hien: [],
  });
}

async function selfApprovalMessageFrom(approverId: string): Promise<string> {
  try {
    await proposalService.approveProposal('p-sod-1', {}, approverId, {}, {}, null);
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

describe('approveProposal — tách quyền (chống tự phê duyệt)', () => {
  it('người duyệt CHÍNH LÀ người đề xuất → reject ngay', async () => {
    mockPendingProposal(APPROVER);
    await expectError(
      proposalService.approveProposal('p-sod-1', {}, APPROVER, {}, {}, null),
      ValidationError,
      SELF_APPROVAL_MSG
    );
  });

  it('người duyệt KHÁC người đề xuất → không bị guard SoD chặn', async () => {
    mockPendingProposal('acc-manager-khac');
    expect(await selfApprovalMessageFrom(APPROVER)).not.toBe(SELF_APPROVAL_MSG);
  });

  it('người đề xuất đã bị xoá (nguoi_de_xuat_id null) → không coi là tự duyệt', async () => {
    mockPendingProposal(null);
    expect(await selfApprovalMessageFrom(APPROVER)).not.toBe(SELF_APPROVAL_MSG);
  });
});
