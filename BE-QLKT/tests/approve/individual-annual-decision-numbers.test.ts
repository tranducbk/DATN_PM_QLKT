import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import {
  makeProposal,
  makePersonnel,
  makeProposalItemCaNhan,
} from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM, getDanhHieuName } from '../../src/constants/danhHieu.constants';
import {
  APPROVE_MISSING_DECISION_PREFIX,
  missingDecisionNumberMessage,
} from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
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

const ADMIN_ID = 'acc-admin-1';

describe('approveProposal — CA_NHAN_HANG_NAM (decision number requirements)', () => {
  it('reject khi item CSTDCS thiếu so_quyet_dinh — gom errors trong message', async () => {
    const personnel = makePersonnel({ id: 'qn-no-qd', ho_ten: 'Quân Nhân Thiếu QĐ' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });
    const proposal = makeProposal({
      id: 'prop-no-qd',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: `${APPROVE_MISSING_DECISION_PREFIX}\n` }
    );
    expect(err.message).toBe(
      `${APPROVE_MISSING_DECISION_PREFIX}\n${missingDecisionNumberMessage(personnel.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS))}`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('reject mix item đủ + thiếu so_quyet_dinh — error chỉ list cái thiếu', async () => {
    const ok = makePersonnel({ id: 'qn-ok-qd', ho_ten: 'QN Đủ' });
    const missing = makePersonnel({ id: 'qn-mis-qd', ho_ten: 'QN Thiếu' });
    const itemOk = makeProposalItemCaNhan({
      personnel_id: ok.id,
      ho_ten: ok.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-1',
    });
    const itemMissing = makeProposalItemCaNhan({
      personnel_id: missing.id,
      ho_ten: missing.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });
    const proposal = makeProposal({
      id: 'prop-mix-qd',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [itemOk, itemMissing],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: ok.id, ho_ten: ok.ho_ten },
      { id: missing.id, ho_ten: missing.ho_ten },
    ]);
    // Mỗi item CSTDCS kích hoạt 2 lần check trùng (2x findFirst + 2x findMany).
    for (let i = 0; i < 4; i++) {
      prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
      prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    }

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: `${APPROVE_MISSING_DECISION_PREFIX}\n` }
    );
    expect(err.message).toBe(
      `${APPROVE_MISSING_DECISION_PREFIX}\n${missingDecisionNumberMessage(missing.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS))}`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });

  it('reject item BKBQP thiếu so_quyet_dinh_bkbqp', async () => {
    const personnel = makePersonnel({ id: 'qn-bkbqp-no-qd', ho_ten: 'QN BKBQP Thiếu' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
    });
    const proposal = makeProposal({
      id: 'prop-bkbqp-no-qd',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: `${APPROVE_MISSING_DECISION_PREFIX}\n` }
    );
    expect(err.message).toBe(
      `${APPROVE_MISSING_DECISION_PREFIX}\n${missingDecisionNumberMessage(personnel.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP))}`
    );
  });

  it('reject item CSTDTQ thiếu so_quyet_dinh_cstdtq', async () => {
    // Given: item CSTDTQ chain thiếu so_quyet_dinh_cstdtq
    const personnel = makePersonnel({ id: 'qn-cstdtq-no-qd', ho_ten: 'QN CSTDTQ Thiếu' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
    });
    const proposal = makeProposal({
      id: 'prop-cstdtq-no-qd',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    // When + Then: kiểm tra lỗi
    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: `${APPROVE_MISSING_DECISION_PREFIX}\n` }
    );
    expect(err.message).toBe(
      `${APPROVE_MISSING_DECISION_PREFIX}\n${missingDecisionNumberMessage(personnel.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ))}`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('reject item BKTTCP thiếu so_quyet_dinh_bkttcp', async () => {
    // Given: item BKTTCP chain thiếu so_quyet_dinh_bkttcp
    const personnel = makePersonnel({ id: 'qn-bkttcp-no-qd', ho_ten: 'QN BKTTCP Thiếu' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
    });
    const proposal = makeProposal({
      id: 'prop-bkttcp-no-qd-decision',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    // When + Then: kiểm tra lỗi
    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: `${APPROVE_MISSING_DECISION_PREFIX}\n` }
    );
    expect(err.message).toBe(
      `${APPROVE_MISSING_DECISION_PREFIX}\n${missingDecisionNumberMessage(personnel.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP))}`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('field swap — item BKBQP nhưng chỉ có so_quyet_dinh_cstdtq → reject thiếu so_quyet_dinh_bkbqp', async () => {
    // Given: item BKBQP gắn nhầm field quyết định (so_quyet_dinh_cstdtq).
    // Field bắt buộc (so_quyet_dinh_bkbqp) thiếu → phải reject.
    const personnel = makePersonnel({ id: 'qn-swap-bk', ho_ten: 'QN Swap BK' });
    const item = {
      ...makeProposalItemCaNhan({
        personnel_id: personnel.id,
        ho_ten: personnel.ho_ten,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      }),
      so_quyet_dinh_cstdtq: 'WRONG-FIELD-CSTDTQ',
    };
    const proposal = makeProposal({
      id: 'prop-swap-bk',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    // When + Then: kiểm tra lỗi
    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: `${APPROVE_MISSING_DECISION_PREFIX}\n` }
    );
    expect(err.message).toBe(
      `${APPROVE_MISSING_DECISION_PREFIX}\n${missingDecisionNumberMessage(personnel.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP))}`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('field swap — item CSTDCS nhưng chỉ có so_quyet_dinh_bkbqp → reject thiếu so_quyet_dinh', async () => {
    // Given: item CSTDCS gắn nhầm field quyết định (so_quyet_dinh_bkbqp)
    // và không có flag nhan_bkbqp. Thiếu so_quyet_dinh bắt buộc cho CSTDCS.
    const personnel = makePersonnel({ id: 'qn-swap-cs', ho_ten: 'QN Swap CS' });
    const item = {
      ...makeProposalItemCaNhan({
        personnel_id: personnel.id,
        ho_ten: personnel.ho_ten,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      }),
      so_quyet_dinh_bkbqp: 'WRONG-FIELD-BKBQP',
    };
    const proposal = makeProposal({
      id: 'prop-swap-cs',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    // When + Then: kiểm tra lỗi
    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: `${APPROVE_MISSING_DECISION_PREFIX}\n` }
    );
    expect(err.message).toBe(
      `${APPROVE_MISSING_DECISION_PREFIX}\n${missingDecisionNumberMessage(personnel.ho_ten, getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS))}`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });
});
