import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeProposal } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import {
  REJECT_PROPOSAL_NOT_FOUND,
  REJECT_ALREADY_APPROVED,
  REJECT_ALREADY_REJECTED,
} from '../helpers/errorMessages';

import proposalService from '../../src/services/proposal';
import { NotFoundError, ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';

beforeEach(() => {
  resetPrismaMock();
});

const ADMIN_ID = 'acc-admin-reject-1';
const MANAGER_ID = 'acc-manager-reject-1';

describe('rejectProposal', () => {
  it('từ chối đề xuất PENDING thành công, lưu lý do và người duyệt', async () => {
    // Given: đề xuất đang PENDING
    const proposal = makeProposal({
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      status: PROPOSAL_STATUS.PENDING,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: admin từ chối kèm lý do
    const reason = 'Hồ sơ chưa đầy đủ minh chứng';
    const result = await proposalService.rejectProposal(proposal.id, reason, ADMIN_ID);

    // Then: updateMany nhận REJECTED + rejection_reason + nguoi_duyet_id
    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
    const updateArgs = prismaMock.bangDeXuat.updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: proposal.id, status: PROPOSAL_STATUS.PENDING });
    expect(updateArgs.data.status).toBe(PROPOSAL_STATUS.REJECTED);
    expect(updateArgs.data.rejection_reason).toBe(reason);
    expect(updateArgs.data.nguoi_duyet_id).toBe(ADMIN_ID);
    expect(updateArgs.data.ngay_duyet).toBeInstanceOf(Date);
    expect(result.message).toBe('Từ chối đề xuất thành công');
    expect(result.result.ly_do).toBe(reason);
  });

  it('từ chối đề xuất đã APPROVED → ValidationError', async () => {
    // Given: đề xuất đã APPROVED
    const proposal = makeProposal({
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      status: PROPOSAL_STATUS.APPROVED,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    // When / Then: kiểm tra lỗi
    await expectError(
      proposalService.rejectProposal(proposal.id, 'Lý do', ADMIN_ID),
      ValidationError,
      REJECT_ALREADY_APPROVED
    );
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('từ chối đề xuất không tồn tại → NotFoundError', async () => {
    // Given: không có đề xuất nào trong DB
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(null);

    // When / Then: kiểm tra lỗi
    await expectError(
      proposalService.rejectProposal('prop-missing', 'Lý do bất kỳ', ADMIN_ID),
      NotFoundError,
      REJECT_PROPOSAL_NOT_FOUND
    );
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('từ chối đề xuất đã REJECTED trước đó → ValidationError', async () => {
    // Given: đề xuất đã từng bị REJECTED trước đó
    const proposal = makeProposal({
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      status: PROPOSAL_STATUS.REJECTED,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    // When / Then: kiểm tra lỗi
    await expectError(
      proposalService.rejectProposal(proposal.id, 'Lý do', ADMIN_ID),
      ValidationError,
      REJECT_ALREADY_REJECTED
    );
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('từ chối với lý do dài (> 200 ký tự) lưu nguyên vẹn vào rejection_reason', async () => {
    // Given: đề xuất PENDING và lý do dài
    const proposal = makeProposal({
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      status: PROPOSAL_STATUS.PENDING,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    const longReason =
      'Đơn vị chưa đáp ứng tiêu chí đánh giá theo Thông tư mới của Bộ Quốc phòng. ' +
      'Cần bổ sung minh chứng cụ thể về thành tích huấn luyện, công tác Đảng-công tác chính trị, ' +
      'và kết quả đánh giá nội bộ năm 2024 trước khi xem xét lại.';

    // When: gọi từ chối
    const result = await proposalService.rejectProposal(proposal.id, longReason, ADMIN_ID);

    // Then: lý do được lưu nguyên vẹn
    const updateArgs = prismaMock.bangDeXuat.updateMany.mock.calls[0][0];
    expect(updateArgs.data.rejection_reason).toBe(longReason);
    expect(result.result.ly_do).toBe(longReason);
  });
});
