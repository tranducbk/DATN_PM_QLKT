import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import {
  makeProposal,
  makePersonnel,
  makeUnit,
  makeProposalItemCaNhan,
  makeAnnualRecord,
} from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ValidationError, NotFoundError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM, getDanhHieuName } from '../../src/constants/danhHieu.constants';
import {
  APPROVE_MISSING_DECISION_PREFIX,
  missingDecisionNumberMessage,
} from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
  // Recalc helper gọi prisma trực tiếp qua profile.service; stub theo từng test.
  jest
    .spyOn(profileService, 'recalculateAnnualProfile')
    .mockResolvedValue(undefined as unknown as never);
  // Stub chain-eligibility mặc định — override theo từng test khi cần bypass.
  jest
    .spyOn(profileService, 'checkAwardEligibility')
    .mockResolvedValue({ eligible: true, reason: '' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-admin-1';

describe('approveProposal — CA_NHAN_HANG_NAM', () => {
  it('duyệt thành công với CSTDCS (CQDV) → status APPROVED + upsert đúng dữ liệu', async () => {
    // Given: đề xuất CA_NHAN_HANG_NAM có 1 item CSTDCS, không trùng
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-1' });
    const personnel = makePersonnel({ unit: cqdv, id: 'qn-1', ho_ten: 'Nguyễn Văn A' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-1',
    });
    const proposal = makeProposal({
      id: 'prop-1',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    // CSTDCS kích hoạt check loại trừ → 2 findFirst + 2 findMany
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    const result = await proposalService.approveProposal(
      proposal.id,
      {},
      ADMIN_ID,
      { so_quyet_dinh_cstdcs: 'QD-CSTDCS-1' },
      {},
      null
    );

    // Then: upsert tạo bản ghi CSTDCS + bangDeXuat chuyển sang APPROVED
    expect(prismaMock.danhHieuHangNam.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.where.quan_nhan_id_nam).toEqual({
      quan_nhan_id: personnel.id,
      nam: 2024,
    });
    expect(upsertArgs.create).toMatchObject({
      quan_nhan_id: personnel.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-1',
    });

    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
    const updateArgs = prismaMock.bangDeXuat.updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: proposal.id, status: PROPOSAL_STATUS.PENDING });
    expect(updateArgs.data.status).toBe(PROPOSAL_STATUS.APPROVED);
    expect(updateArgs.data.nguoi_duyet_id).toBe(ADMIN_ID);

    expect(result.affectedPersonnelIds).toContain(personnel.id);
  });

  it('duyệt thành công với BKBQP (DVTT) → upsert set nhan_bkbqp: true', async () => {
    // Given: đề xuất chỉ chứa 1 item BKBQP chain từ đơn vị DVTT
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-1', parentId: 'cqdv-parent' });
    const personnel = makePersonnel({ unit: dvtt, id: 'qn-2' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QD-BK-1',
    });
    const proposal = makeProposal({
      id: 'prop-2',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: dvtt,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({ personnelId: personnel.id, nam: 2024, nhan_bkbqp: true })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    await proposalService.approveProposal(
      proposal.id,
      {},
      ADMIN_ID,
      { so_quyet_dinh_bkbqp: 'QD-BK-1' },
      {},
      null
    );

    // Then: payload upsert phản ánh flag BKBQP — danh_hieu vẫn để trống
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.create.nhan_bkbqp).toBe(true);
    expect(upsertArgs.create.so_quyet_dinh_bkbqp).toBe('QD-BK-1');
    expect(upsertArgs.create.danh_hieu).toBeUndefined();
  });

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

  it('duyệt thành công CSTT (DVTT variant) — verify don_vi_truc_thuoc_id resolved', async () => {
    // Given: đề xuất từ DVTT chỉ có 1 item CSTT
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-2', parentId: 'cqdv-parent-2' });
    const personnel = makePersonnel({ unit: dvtt, id: 'qn-cstt' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      so_quyet_dinh: 'QD-CSTT-DVTT',
    });
    const proposal = makeProposal({
      id: 'prop-dvtt-1',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: dvtt,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    // CSTT cũng kích hoạt check loại trừ → 2 findFirst, 2 findMany
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then: bangDeXuat chuyển APPROVED và upsert CSTT
    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(PROPOSAL_STATUS.APPROVED);
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.create.danh_hieu).toBe(DANH_HIEU_CA_NHAN_HANG_NAM.CSTT);
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

  it('approve thành công khi đầy đủ so_quyet_dinh (top-level decisions map)', async () => {
    const personnel = makePersonnel({ id: 'qn-full-qd', ho_ten: 'QN Đầy Đủ' });
    const item = makeProposalItemCaNhan({
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });
    const proposal = makeProposal({
      id: 'prop-full-qd',
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
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-FROM-MAP',
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(
      proposal.id,
      {},
      ADMIN_ID,
      { so_quyet_dinh_cstdcs: 'QD-FROM-MAP' },
      {},
      null
    );

    expect(prismaMock.danhHieuHangNam.upsert).toHaveBeenCalledTimes(1);
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

  it('item CSTDCS kèm flag BKBQP — upsert lưu cả CSTDCS lẫn BKBQP', async () => {
    // Validation và upsert giờ thống nhất dùng resolved chain values, nên mixed item
    // (CSTDCS + nhan_bkbqp) persist được cả hai field — không drop BKBQP nữa.
    const personnel = makePersonnel({ id: 'qn-combo-ok', ho_ten: 'QN Combo Đủ' });
    const item = {
      ...makeProposalItemCaNhan({
        personnel_id: personnel.id,
        ho_ten: personnel.ho_ten,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-CS-COMBO',
      }),
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD-BK-COMBO',
    };
    const proposal = makeProposal({
      id: 'prop-combo-ok',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    // CSTDCS kích hoạt check loại trừ → 2 findFirst + 2 findMany
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-CS-COMBO',
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then: upsert mang cả dữ liệu CSTDCS và flag/QD BKBQP
    expect(prismaMock.danhHieuHangNam.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.create.danh_hieu).toBe(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS);
    expect(upsertArgs.create.so_quyet_dinh).toBe('QD-CS-COMBO');
    expect(upsertArgs.create.nhan_bkbqp).toBe(true);
    expect(upsertArgs.create.so_quyet_dinh_bkbqp).toBe('QD-BK-COMBO');
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(PROPOSAL_STATUS.APPROVED);
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

  it('field isolation — item BKBQP-only chỉ lưu so_quyet_dinh_bkbqp, các field khác không bị contaminate', async () => {
    // Given: item BKBQP chỉ có so_quyet_dinh_bkbqp. Sau approve, upsert.create
    // KHÔNG được mang so_quyet_dinh / so_quyet_dinh_cstdtq / so_quyet_dinh_bkttcp.
    const personnel = makePersonnel({ id: 'qn-iso-bk', ho_ten: 'QN Iso BK' });
    const item = {
      ...makeProposalItemCaNhan({
        personnel_id: personnel.id,
        ho_ten: personnel.ho_ten,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      }),
      so_quyet_dinh_bkbqp: 'QD-BK-ONLY',
    };
    const proposal = makeProposal({
      id: 'prop-iso-bk',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: personnel.id,
        nam: 2024,
        nhan_bkbqp: true,
        so_quyet_dinh_bkbqp: 'QD-BK-ONLY',
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then: chỉ field BKBQP được set; các so_quyet_dinh_* khác giữ nguyên
    expect(prismaMock.danhHieuHangNam.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.create.nhan_bkbqp).toBe(true);
    expect(upsertArgs.create.so_quyet_dinh_bkbqp).toBe('QD-BK-ONLY');
    expect(upsertArgs.create.danh_hieu).toBeUndefined();
    expect(upsertArgs.create.so_quyet_dinh).toBeUndefined();
    expect(upsertArgs.create.so_quyet_dinh_cstdtq).toBeUndefined();
    expect(upsertArgs.create.so_quyet_dinh_bkttcp).toBeUndefined();
    expect(upsertArgs.create.nhan_cstdtq).toBeUndefined();
    expect(upsertArgs.create.nhan_bkttcp).toBeUndefined();
  });

  it('edge case: data_danh_hieu rỗng → bỏ qua mixed-group check, vẫn approve', async () => {
    // Given: đề xuất CA_NHAN_HANG_NAM rỗng — không có item để import
    const proposal = makeProposal({
      id: 'prop-empty',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    const result = await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then: không upsert, không check trùng, nhưng bangDeXuat vẫn chuyển APPROVED
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(PROPOSAL_STATUS.APPROVED);
    expect(result.affectedPersonnelIds).toEqual([]);
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

  it('approve transaction rollback: missing personnel aggregates into ValidationError', async () => {
    const personnel = makePersonnel({ id: 'qn-msg-ok', ho_ten: 'QN Message OK' });
    const proposal = makeProposal({
      id: 'prop-msg-ca-nhan',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [
        makeProposalItemCaNhan({
          personnel_id: personnel.id,
          ho_ten: personnel.ho_ten,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
        }),
        makeProposalItemCaNhan({
          personnel_id: 'qn-missing-msg',
          ho_ten: 'QN Missing',
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
        }),
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten },
      { id: 'qn-missing-msg', ho_ten: 'QN Missing' },
    ]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.quanNhan.findUnique
      .mockResolvedValueOnce(personnel)
      .mockResolvedValueOnce(null);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({ personnelId: personnel.id, nam: 2024, nhan_bkbqp: true })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    const error = await expectError(
      proposalService.approveProposal(
        proposal.id,
        {},
        ADMIN_ID,
        { so_quyet_dinh_bkbqp: 'QD-BKBQP-MSG' },
        {},
        null
      ),
      ValidationError,
      { startsWith: 'Không thể phê duyệt đề xuất do có 1 lỗi khi thêm khen thưởng:' }
    );
    expect(error.message).toContain('Không tìm thấy thông tin quân nhân khi lưu danh hiệu');
  });
});
