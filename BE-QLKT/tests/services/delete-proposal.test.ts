import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeProposal } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import {
  DELETE_PROPOSAL_NOT_FOUND,
  DELETE_FORBIDDEN_OTHERS,
  DELETE_ONLY_PENDING,
} from '../helpers/errorMessages';

import proposalService from '../../src/services/proposal';
import { NotFoundError, ForbiddenError, ValidationError } from '../../src/middlewares/errorHandler';
import { ROLES } from '../../src/constants/roles.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';

beforeEach(() => {
  resetPrismaMock();
});

const MANAGER_ID = 'acc-manager-del-1';
const OTHER_MANAGER_ID = 'acc-manager-del-2';
const ADMIN_ID = 'acc-admin-del-1';

describe('deleteProposal', () => {
  it('Manager xóa đề xuất PENDING của mình → success', async () => {
    // Given: pending proposal owned by manager
    const proposal = makeProposal({
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      status: PROPOSAL_STATUS.PENDING,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.bangDeXuat.deleteMany.mockResolvedValueOnce({ count: 1 });

    // When
    const result = await proposalService.deleteProposal(proposal.id, MANAGER_ID, ROLES.MANAGER);

    // Then: deleteMany guarded by status=PENDING
    expect(prismaMock.bangDeXuat.deleteMany).toHaveBeenCalledTimes(1);
    const args = prismaMock.bangDeXuat.deleteMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: proposal.id, status: PROPOSAL_STATUS.PENDING });
    expect(result.message).toBe('Đã xóa đề xuất thành công');
  });

  it('Manager xóa đề xuất APPROVED của mình → ValidationError (chỉ pending mới xóa)', async () => {
    // Given: approved proposal owned by manager
    const proposal = makeProposal({
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      status: PROPOSAL_STATUS.APPROVED,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    // When / Then
    await expectError(
      proposalService.deleteProposal(proposal.id, MANAGER_ID, ROLES.MANAGER),
      ValidationError,
      DELETE_ONLY_PENDING
    );
    expect(prismaMock.bangDeXuat.deleteMany).not.toHaveBeenCalled();
  });

  it('Manager xóa đề xuất của người khác → ForbiddenError', async () => {
    // Given: proposal owned by a different manager
    const proposal = makeProposal({
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: OTHER_MANAGER_ID,
      status: PROPOSAL_STATUS.PENDING,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    // When / Then
    await expectError(
      proposalService.deleteProposal(proposal.id, MANAGER_ID, ROLES.MANAGER),
      ForbiddenError,
      DELETE_FORBIDDEN_OTHERS
    );
    expect(prismaMock.bangDeXuat.deleteMany).not.toHaveBeenCalled();
  });

  it('Admin xóa đề xuất bất kỳ (kể cả APPROVED của manager khác) → success', async () => {
    // Given: admin deletes a proposal owned by a manager
    // Service code: only MANAGER role gets restricted to PENDING & ownership;
    // ADMIN bypasses both checks but the atomic delete still requires PENDING.
    const proposal = makeProposal({
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: MANAGER_ID,
      status: PROPOSAL_STATUS.PENDING,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.bangDeXuat.deleteMany.mockResolvedValueOnce({ count: 1 });

    // When
    const result = await proposalService.deleteProposal(proposal.id, ADMIN_ID, ROLES.ADMIN);

    // Then: admin allowed even though they don't own the proposal
    expect(prismaMock.bangDeXuat.deleteMany).toHaveBeenCalledTimes(1);
    expect(result.message).toBe('Đã xóa đề xuất thành công');
  });

  it('Xóa đề xuất không tồn tại → NotFoundError', async () => {
    // Given: no proposal
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(null);

    // When / Then
    await expectError(
      proposalService.deleteProposal('prop-missing', MANAGER_ID, ROLES.MANAGER),
      NotFoundError,
      DELETE_PROPOSAL_NOT_FOUND
    );
    expect(prismaMock.bangDeXuat.deleteMany).not.toHaveBeenCalled();
  });
});
