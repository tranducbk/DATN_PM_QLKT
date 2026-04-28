import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import {
  makeProposal,
  makePersonnel,
  makeProposalItemCaNhan,
  makeAnnualRecord,
} from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ValidationError, NotFoundError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';

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

describe('approveProposal — CA_NHAN_HANG_NAM (validation + eligibility errors)', () => {
  it('reject khi proposal đã APPROVED', async () => {
    // Given: đề xuất đã APPROVED
    const proposal = makeProposal({
      id: 'prop-already',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.APPROVED,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    // When + Then: kiểm tra lỗi
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      'Đề xuất này đã được phê duyệt trước đó'
    );
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });

  it('throw NotFoundError khi proposalId không tồn tại', async () => {
    // Given: lookup trả null
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(null);

    // When + Then: kiểm tra lỗi
    await expectError(
      proposalService.approveProposal('missing-id', {}, ADMIN_ID, {}, {}, null),
      NotFoundError,
      'Đề xuất không tồn tại'
    );
  });

  it('bypass FE — reject mixed group CSTDCS + BKBQP cùng đề xuất', async () => {
    // Given: đề xuất trộn CSTDCS với BKBQP — FE chặn, ở đây bypass
    const personnelA = makePersonnel({ id: 'qn-A' });
    const personnelB = makePersonnel({ id: 'qn-B' });
    const proposal = makeProposal({
      id: 'prop-mixed-1',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [
        makeProposalItemCaNhan({ personnel_id: personnelA.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }),
        makeProposalItemCaNhan({ personnel_id: personnelB.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP }),
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnelA.id, ho_ten: personnelA.ho_ten },
      { id: personnelB.id, ho_ten: personnelB.ho_ten },
    ]);

    // When + Then: trộn CSTDCS + BKBQP phải bị reject với thông báo nhóm trộn
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ/BKTTCP trong một đề xuất. Vui lòng tách thành các đề xuất riêng: một đề xuất cho CSTDCS/CSTT, và một đề xuất riêng cho BKBQP/CSTDTQ/BKTTCP.'
    );
    // Trạng thái đề xuất phải giữ nguyên (không update APPROVED)
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });

  it('bypass FE — reject mixed group CSTT + CSTDTQ cùng đề xuất', async () => {
    // Given: đề xuất trộn CSTT (basic) với CSTDTQ (chain)
    const personnelA = makePersonnel({ id: 'qn-A2' });
    const personnelB = makePersonnel({ id: 'qn-B2' });
    const proposal = makeProposal({
      id: 'prop-mixed-2',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [
        makeProposalItemCaNhan({ personnel_id: personnelA.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT }),
        makeProposalItemCaNhan({ personnel_id: personnelB.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ }),
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnelA.id, ho_ten: personnelA.ho_ten },
      { id: personnelB.id, ho_ten: personnelB.ho_ten },
    ]);

    // When + Then: kiểm tra lỗi
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ/BKTTCP trong một đề xuất. Vui lòng tách thành các đề xuất riêng: một đề xuất cho CSTDCS/CSTT, và một đề xuất riêng cho BKBQP/CSTDTQ/BKTTCP.'
    );
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('bypass FE — reject mixed group CSTT + BKTTCP cùng đề xuất', async () => {
    // Given: đề xuất trộn CSTT với BKTTCP
    const personnelA = makePersonnel({ id: 'qn-A3' });
    const personnelB = makePersonnel({ id: 'qn-B3' });
    const proposal = makeProposal({
      id: 'prop-mixed-3',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [
        makeProposalItemCaNhan({ personnel_id: personnelA.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT }),
        makeProposalItemCaNhan({ personnel_id: personnelB.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP }),
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnelA.id, ho_ten: personnelA.ho_ten },
      { id: personnelB.id, ho_ten: personnelB.ho_ten },
    ]);

    // When + Then: kiểm tra lỗi
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ/BKTTCP trong một đề xuất. Vui lòng tách thành các đề xuất riêng: một đề xuất cho CSTDCS/CSTT, và một đề xuất riêng cho BKBQP/CSTDTQ/BKTTCP.'
    );
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('reject duplicate cùng năm + cùng danh hiệu — message ghép `${hoTen}: ...`', async () => {
    // Given: trong DB đã có CSTDCS của quân nhân/năm này
    const personnel = makePersonnel({ id: 'qn-dup', ho_ten: 'Trần Văn B' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });
    const proposal = makeProposal({
      id: 'prop-dup-1',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    // checkDuplicateAward(CSTDCS) → đã tồn tại
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      })
    );
    // checkDuplicateAward(CSTT đối diện) → không có award + không có pending
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    // When + Then: message phải đúng prefix + hoTen + mô tả trùng
    const error = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n' }
    );
    expect(error.message).toBe(
      `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${personnel.ho_ten}: Quân nhân đã có danh hiệu Chiến sĩ thi đua cơ sở năm 2024 trên hệ thống`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('reject mutual exclusive CSTDCS khi đã có CSTT cùng năm', async () => {
    // Given: đề xuất CSTDCS nhưng quân nhân đã có CSTT đối diện cùng năm
    const personnel = makePersonnel({ id: 'qn-mx', ho_ten: 'Lê Thị C' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });
    const proposal = makeProposal({
      id: 'prop-mx-1',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    // checkDuplicateAward(CSTDCS) — chưa có
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    // checkDuplicateAward(CSTT đối diện) — đã có
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      })
    );

    // When + Then: kiểm tra lỗi
    const error = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n' }
    );
    expect(error.message).toBe(
      `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${personnel.ho_ten}: Quân nhân đã có danh hiệu Chiến sĩ tiên tiến năm 2024 trên hệ thống`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });

  it('bypass FE — reject khi chưa đủ ĐK BKBQP cá nhân', async () => {
    // Given: item BKBQP nhưng eligibility trả false
    const personnel = makePersonnel({ id: 'qn-bk-not-elig', ho_ten: 'Nguyễn Chưa Đủ' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
    });
    const proposal = makeProposal({
      id: 'prop-bk-not-elig',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    (profileService.checkAwardEligibility as jest.Mock).mockReset();
    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKBQP: cần 2 năm CSTDCS',
    });

    // When + Then: kiểm tra lỗi
    const eligErr = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    expect(eligErr.message).toBe(
      `Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n${personnel.ho_ten}: Chưa đủ điều kiện BKBQP: cần 2 năm CSTDCS`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('bypass FE — reject khi chưa đủ ĐK CSTDTQ cá nhân', async () => {
    const personnel = makePersonnel({ id: 'qn-cs-not-elig', ho_ten: 'Lê Chưa Đủ' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
    });
    const proposal = makeProposal({
      id: 'prop-cs-not-elig',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    (profileService.checkAwardEligibility as jest.Mock).mockReset();
    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện CSTDTQ',
    });

    const eligCsErr = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    expect(eligCsErr.message).toBe(
      `Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n${personnel.ho_ten}: Chưa đủ điều kiện CSTDTQ`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });

  it('bypass FE — reject khi chưa đủ ĐK BKTTCP cá nhân', async () => {
    const personnel = makePersonnel({ id: 'qn-bkttcp-not-elig', ho_ten: 'Phạm Chưa Đủ' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
    });
    const proposal = makeProposal({
      id: 'prop-bkttcp-not-elig',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    (profileService.checkAwardEligibility as jest.Mock).mockReset();
    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKTTCP',
    });

    const eligBkttcpErr = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    expect(eligBkttcpErr.message).toBe(
      `Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n${personnel.ho_ten}: Chưa đủ điều kiện BKTTCP`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });

  it('bypass FE — reject BKBQP khi thiếu NCKH liên tục', async () => {
    const personnel = makePersonnel({ id: 'qn-nckh-bkbqp', ho_ten: 'QN Thiếu NCKH BKBQP' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QD-BK-NCKH',
    });
    const proposal = makeProposal({
      id: 'prop-nckh-bkbqp',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    (profileService.checkAwardEligibility as jest.Mock).mockReset();
    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKBQP do thiếu NCKH liên tục',
    });

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    expect(err.message).toBe(
      `Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n${personnel.ho_ten}: Chưa đủ điều kiện BKBQP do thiếu NCKH liên tục`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('bypass FE — reject CSTDTQ khi thiếu NCKH liên tục', async () => {
    const personnel = makePersonnel({ id: 'qn-nckh-cstdtq', ho_ten: 'QN Thiếu NCKH CSTDTQ' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
      so_quyet_dinh: 'QD-TQ-NCKH',
    });
    const proposal = makeProposal({
      id: 'prop-nckh-cstdtq',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    (profileService.checkAwardEligibility as jest.Mock).mockReset();
    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện CSTDTQ do thiếu NCKH liên tục',
    });

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    expect(err.message).toBe(
      `Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n${personnel.ho_ten}: Chưa đủ điều kiện CSTDTQ do thiếu NCKH liên tục`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('bypass FE — reject BKTTCP khi thiếu NCKH liên tục', async () => {
    const personnel = makePersonnel({ id: 'qn-nckh-bkttcp', ho_ten: 'QN Thiếu NCKH BKTTCP' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
      so_quyet_dinh: 'QD-TTCP-NCKH',
    });
    const proposal = makeProposal({
      id: 'prop-nckh-bkttcp',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    (profileService.checkAwardEligibility as jest.Mock).mockReset();
    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKTTCP do thiếu NCKH liên tục',
    });

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    expect(err.message).toBe(
      `Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n${personnel.ho_ten}: Chưa đủ điều kiện BKTTCP do thiếu NCKH liên tục`
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('bypass FE — editedData danh_hieu rác trong approve CA_NHAN_HANG_NAM → reject', async () => {
    const personnel = makePersonnel({ id: 'qn-approve-invalid-dh', ho_ten: 'QN Invalid Approve' });
    const proposal = makeProposal({
      id: 'p-approve-invalid-dh',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [
        makeProposalItemCaNhan({
          personnel_id: personnel.id,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        }),
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    await expectError(
      proposalService.approveProposal(
        proposal.id,
        {
          data_danh_hieu: [
            { personnel_id: personnel.id, ho_ten: personnel.ho_ten, danh_hieu: 'INVALID_AWARD' },
          ],
        },
        ADMIN_ID,
        {},
        {},
        null
      ),
      ValidationError,
      { startsWith: 'Phát hiện danh hiệu không hợp lệ trong dữ liệu đề xuất.\n' }
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });
});
