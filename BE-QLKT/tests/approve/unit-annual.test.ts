import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import {
  makeProposal,
  makeUnit,
  makeProposalItemDonVi,
  makeUnitAnnualRecord,
} from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { ValidationError, NotFoundError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
  getDanhHieuName,
} from '../../src/constants/danhHieu.constants';
import {
  APPROVE_MISSING_DECISION_PREFIX,
  missingDecisionNumberMessage,
} from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
  jest
    .spyOn(unitAnnualAwardService, 'recalculateAnnualUnit')
    .mockResolvedValue(undefined as unknown as never);
  // Stub chain-eligibility mặc định — override theo từng test khi cần bypass.
  jest
    .spyOn(unitAnnualAwardService, 'checkUnitAwardEligibility')
    .mockResolvedValue({ eligible: true, reason: '' });
  // Stub check trùng mặc định: không có gì pending trong DB.
  prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-admin-2';

describe('approveProposal — DON_VI_HANG_NAM', () => {
  it('duyệt thành công với ĐVQT (CQDV) → upsert đúng don_vi và status APPROVED', async () => {
    // Given: đề xuất đơn vị hằng năm PENDING với 1 item ĐVQT cho CQDV
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-uv-1' });
    const item = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: cqdv.id,
      ten_don_vi: cqdv.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT-1',
    });
    const proposal = makeProposal({
      id: 'prop-uv-1',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.danhHieuDonViHangNam.create.mockResolvedValueOnce(
      makeUnitAnnualRecord({
        unitId: cqdv.id,
        unitKind: 'CQDV',
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: 'QD-DVQT-1',
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: gọi duyệt
    await proposalService.approveProposal(
      proposal.id,
      {},
      ADMIN_ID,
      { so_quyet_dinh_don_vi_hang_nam: 'QD-DVQT-1' },
      {},
      null
    );

    // Then: create đúng don_vi và status APPROVED
    expect(prismaMock.danhHieuDonViHangNam.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.danhHieuDonViHangNam.create.mock.calls[0][0];
    expect(createArgs.data.danh_hieu).toBe(DANH_HIEU_DON_VI_HANG_NAM.DVQT);
    expect(createArgs.data.CoQuanDonVi).toEqual({ connect: { id: cqdv.id } });
    expect(createArgs.data.DonViTrucThuoc).toBeUndefined();
    expect(createArgs.data.status).toBe(PROPOSAL_STATUS.APPROVED);

    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(
      PROPOSAL_STATUS.APPROVED
    );
  });

  it('duyệt thành công với BKBQP (DVTT) → create set nhan_bkbqp và DonViTrucThuoc connect', async () => {
    // Given: đề xuất DVTT mang flag BKBQP đơn vị (không có DV title)
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-uv-1', parentId: 'cqdv-parent-uv' });
    const item = makeProposalItemDonVi({
      unitKind: 'DVTT',
      unitId: dvtt.id,
      ten_don_vi: dvtt.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QD-BK-1',
    });
    const proposal = makeProposal({
      id: 'prop-uv-2',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: dvtt,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.danhHieuDonViHangNam.create.mockResolvedValueOnce(
      makeUnitAnnualRecord({
        unitId: dvtt.id,
        unitKind: 'DVTT',
        nam: 2024,
        nhan_bkbqp: true,
        so_quyet_dinh_bkbqp: 'QD-BK-1',
      })
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

    // Then: create set nhan_bkbqp và DonViTrucThuoc connect đúng
    const createArgs = prismaMock.danhHieuDonViHangNam.create.mock.calls[0][0];
    expect(createArgs.data.nhan_bkbqp).toBe(true);
    expect(createArgs.data.danh_hieu).toBeNull();
    expect(createArgs.data.DonViTrucThuoc).toEqual({ connect: { id: dvtt.id } });
    expect(createArgs.data.CoQuanDonVi).toBeUndefined();
  });

  it('reject khi proposal đã APPROVED', async () => {
    // Given: đề xuất đơn vị đã APPROVED
    const proposal = makeProposal({
      id: 'prop-uv-already',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
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
    expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('throw NotFoundError khi proposal không tồn tại', async () => {
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(null);

    await expectError(
      proposalService.approveProposal('missing-uv', {}, ADMIN_ID, {}, {}, null),
      NotFoundError,
      'Đề xuất không tồn tại'
    );
  });

  it('bypass FE — reject mixed group ĐVQT + BKBQP cùng đề xuất', async () => {
    // Given: đề xuất đơn vị trộn ĐVQT (basic) + BKBQP (chain) — FE chặn, ở đây bypass
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-mixed' });
    const proposal = makeProposal({
      id: 'prop-uv-mixed-1',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [
        makeProposalItemDonVi({
          unitKind: 'CQDV',
          unitId: cqdv.id,
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        }),
        makeProposalItemDonVi({
          unitKind: 'CQDV',
          unitId: cqdv.id,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
        }),
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);

    // When + Then: kiểm tra lỗi
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      'Không thể đề xuất ĐVQT/ĐVTT cùng với BKBQP/BKTTCP trong một đề xuất. Vui lòng tách thành các đề xuất riêng: một đề xuất cho ĐVQT/ĐVTT, và một đề xuất riêng cho BKBQP/BKTTCP.'
    );
    expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuDonViHangNam.update).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('bypass FE — reject mixed group ĐVTT + BKTTCP cùng đề xuất', async () => {
    // Given: ĐVTT (basic) + BKTTCP (chain) cùng 1 đề xuất
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-mixed-2' });
    const proposal = makeProposal({
      id: 'prop-uv-mixed-2',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [
        makeProposalItemDonVi({
          unitKind: 'CQDV',
          unitId: cqdv.id,
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT,
        }),
        makeProposalItemDonVi({
          unitKind: 'CQDV',
          unitId: cqdv.id,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
        }),
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);

    // When + Then: kiểm tra lỗi
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      'Không thể đề xuất ĐVQT/ĐVTT cùng với BKBQP/BKTTCP trong một đề xuất. Vui lòng tách thành các đề xuất riêng: một đề xuất cho ĐVQT/ĐVTT, và một đề xuất riêng cho BKBQP/BKTTCP.'
    );
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('bypass FE — reject mixed group ĐVQT + BKTTCP cùng đề xuất', async () => {
    // Given: một biến thể nhóm trộn khác
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-mixed-3' });
    const proposal = makeProposal({
      id: 'prop-uv-mixed-3',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [
        makeProposalItemDonVi({
          unitKind: 'CQDV',
          unitId: cqdv.id,
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        }),
        makeProposalItemDonVi({
          unitKind: 'CQDV',
          unitId: cqdv.id,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
        }),
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);

    // When + Then: kiểm tra lỗi
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      'Không thể đề xuất ĐVQT/ĐVTT cùng với BKBQP/BKTTCP trong một đề xuất. Vui lòng tách thành các đề xuất riêng: một đề xuất cho ĐVQT/ĐVTT, và một đề xuất riêng cho BKBQP/BKTTCP.'
    );
    expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('đơn vị đã có record cùng năm → reject duplicate (Fix #2)', async () => {
    // Given: đơn vị đã có record cùng năm trong DB
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-existing' });
    const item = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: cqdv.id,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
    });
    const proposal = makeProposal({
      id: 'prop-uv-existing',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });
    const existing = makeUnitAnnualRecord({
      unitId: cqdv.id,
      unitKind: 'CQDV',
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT-2024',
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(existing);

    // When + Then: check trùng reject trước khi vào transaction
    const dupErr = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n' }
    );
    expect(dupErr.message).toBe(
      'Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n' +
        `Đơn vị ${cqdv.id}: Đơn vị đã có danh hiệu Đơn vị quyết thắng năm 2024 trên hệ thống`
    );
    expect(prismaMock.danhHieuDonViHangNam.update).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('reject pending conflict cùng đơn vị/danh hiệu/năm (Fix #2)', async () => {
    // Given: đã có 1 đề xuất PENDING khác cùng đơn vị/năm/danh_hieu
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-pending-conflict' });
    const item = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: cqdv.id,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
    });
    const proposal = makeProposal({
      id: 'prop-uv-pending',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockReset();
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'pending-uv-conflict',
        loai_de_xuat: PROPOSAL_TYPES.DON_VI_HANG_NAM,
        nam: 2024,
        status: PROPOSAL_STATUS.PENDING,
        data_danh_hieu: [
          {
            don_vi_id: cqdv.id,
            don_vi_type: 'CO_QUAN_DON_VI',
            danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
          },
        ],
      },
    ]);

    const pendingErr = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n' }
    );
    expect(pendingErr.message).toBe(
      'Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n' +
        `Đơn vị ${cqdv.id}: Đơn vị đã có đề xuất danh hiệu Đơn vị quyết thắng cho năm 2024`
    );
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('bypass FE — reject khi đơn vị chưa đủ ĐK BKBQP đơn vị', async () => {
    // Given: item BKBQP nhưng eligibility đơn vị trả false
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-not-elig-bk' });
    const item = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: cqdv.id,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
    });
    const proposal = makeProposal({
      id: 'prop-uv-not-elig-bk',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);
    (unitAnnualAwardService.checkUnitAwardEligibility as jest.Mock).mockReset();
    (unitAnnualAwardService.checkUnitAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKBQP đơn vị',
    });

    const eligErr = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    expect(eligErr.message).toBe(
      `Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\nĐơn vị ${cqdv.id}: Chưa đủ điều kiện BKBQP đơn vị`
    );
    expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('reject khi item ĐVQT thiếu so_quyet_dinh', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-no-qd' });
    const item = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: cqdv.id,
      ten_don_vi: cqdv.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
    });
    const proposal = makeProposal({
      id: 'prop-uv-no-qd',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: `${APPROVE_MISSING_DECISION_PREFIX}\n` }
    );
    expect(err.message).toBe(
      `${APPROVE_MISSING_DECISION_PREFIX}\n${missingDecisionNumberMessage(cqdv.ten_don_vi, getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.DVQT))}`
    );
    expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('reject khi item BKBQP đơn vị thiếu so_quyet_dinh_bkbqp', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-no-qd' });
    const item = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: cqdv.id,
      ten_don_vi: cqdv.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
    });
    const proposal = makeProposal({
      id: 'prop-uv-bkbqp-no-qd',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);

    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: `${APPROVE_MISSING_DECISION_PREFIX}\n` }
    );
    expect(err.message).toBe(
      `${APPROVE_MISSING_DECISION_PREFIX}\n${missingDecisionNumberMessage(cqdv.ten_don_vi, getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKBQP))}`
    );
  });

  it('approve thành công đơn vị đầy đủ so_quyet_dinh', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-ok-qd' });
    const item = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: cqdv.id,
      ten_don_vi: cqdv.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-OK-UV',
    });
    const proposal = makeProposal({
      id: 'prop-uv-ok-qd',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.danhHieuDonViHangNam.create.mockResolvedValueOnce(
      makeUnitAnnualRecord({
        unitId: cqdv.id,
        unitKind: 'CQDV',
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: 'QD-OK-UV',
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    expect(prismaMock.danhHieuDonViHangNam.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
  });

  it('reject khi item BKTTCP đơn vị thiếu so_quyet_dinh_bkttcp', async () => {
    // Given: BKTTCP unit chain item without so_quyet_dinh_bkttcp
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-no-qd' });
    const item = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: cqdv.id,
      ten_don_vi: cqdv.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
    });
    const proposal = makeProposal({
      id: 'prop-uv-bkttcp-no-qd',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);

    // When + Then: kiểm tra lỗi
    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: `${APPROVE_MISSING_DECISION_PREFIX}\n` }
    );
    expect(err.message).toBe(
      `${APPROVE_MISSING_DECISION_PREFIX}\n${missingDecisionNumberMessage(cqdv.ten_don_vi, getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKTTCP))}`
    );
    expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('field isolation — item BKBQP đơn vị only, so_quyet_dinh (ĐVQT) không bị contaminate', async () => {
    // Given: unit BKBQP item with only so_quyet_dinh_bkbqp.
    // create.data must NOT contain ĐVQT/ĐVTT so_quyet_dinh nor so_quyet_dinh_bkttcp.
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-iso-bk' });
    const item = {
      ...makeProposalItemDonVi({
        unitKind: 'CQDV',
        unitId: cqdv.id,
        ten_don_vi: cqdv.ten_don_vi,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
      }),
      so_quyet_dinh_bkbqp: 'QD-BK-UV-ONLY',
    };
    const proposal = makeProposal({
      id: 'prop-uv-iso-bk',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.danhHieuDonViHangNam.create.mockResolvedValueOnce(
      makeUnitAnnualRecord({
        unitId: cqdv.id,
        unitKind: 'CQDV',
        nam: 2024,
        nhan_bkbqp: true,
        so_quyet_dinh_bkbqp: 'QD-BK-UV-ONLY',
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When
    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then: only BKBQP fields populated; ĐVQT-channel + BKTTCP fields stay null/false
    expect(prismaMock.danhHieuDonViHangNam.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.danhHieuDonViHangNam.create.mock.calls[0][0];
    expect(createArgs.data.nhan_bkbqp).toBe(true);
    expect(createArgs.data.so_quyet_dinh_bkbqp).toBe('QD-BK-UV-ONLY');
    expect(createArgs.data.danh_hieu).toBeNull();
    expect(createArgs.data.so_quyet_dinh).toBeNull();
    expect(createArgs.data.nhan_bkttcp).toBe(false);
    expect(createArgs.data.so_quyet_dinh_bkttcp).toBeNull();
  });

  it('field swap đơn vị — item BKBQP với so_quyet_dinh_bkttcp (nhầm field) → reject', async () => {
    // Given: unit BKBQP item carries WRONG decision field (so_quyet_dinh_bkttcp).
    // Required so_quyet_dinh_bkbqp missing → validation must reject.
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-swap-bk' });
    const item = {
      ...makeProposalItemDonVi({
        unitKind: 'CQDV',
        unitId: cqdv.id,
        ten_don_vi: cqdv.ten_don_vi,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
      }),
      so_quyet_dinh_bkttcp: 'WRONG-FIELD-BKTTCP',
    };
    const proposal = makeProposal({
      id: 'prop-uv-swap-bk',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);

    // When + Then: kiểm tra lỗi
    const err = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: `${APPROVE_MISSING_DECISION_PREFIX}\n` }
    );
    expect(err.message).toBe(
      `${APPROVE_MISSING_DECISION_PREFIX}\n${missingDecisionNumberMessage(cqdv.ten_don_vi, getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKBQP))}`
    );
    expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
    expect(prismaMock.danhHieuDonViHangNam.update).not.toHaveBeenCalled();
    expect(prismaMock.bangDeXuat.updateMany).not.toHaveBeenCalled();
  });

  it('bypass FE — reject khi đơn vị chưa đủ ĐK BKTTCP đơn vị', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-not-elig-bkttcp' });
    const item = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: cqdv.id,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
    });
    const proposal = makeProposal({
      id: 'prop-uv-not-elig-bkttcp',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [item],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);
    (unitAnnualAwardService.checkUnitAwardEligibility as jest.Mock).mockReset();
    (unitAnnualAwardService.checkUnitAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKTTCP đơn vị',
    });

    const eligErrBkttcp = await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      { startsWith: 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n' }
    );
    expect(eligErrBkttcp.message).toBe(
      `Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\nĐơn vị ${cqdv.id}: Chưa đủ điều kiện BKTTCP đơn vị`
    );
    expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
  });

  it('approve transaction rollback: missing unit info aggregates into ValidationError', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-msg-ok' });
    const proposal = makeProposal({
      id: 'prop-uv-partial-msg',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [
        makeProposalItemDonVi({
          unitKind: 'CQDV',
          unitId: cqdv.id,
          ten_don_vi: cqdv.ten_don_vi,
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
          so_quyet_dinh: 'QD-MSG-OK',
        }),
        {
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
          ten_don_vi: 'Đơn vị lỗi',
          so_quyet_dinh: 'QD-MSG-FAIL',
        },
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.danhHieuDonViHangNam.create.mockResolvedValueOnce(
      makeUnitAnnualRecord({
        unitId: cqdv.id,
        unitKind: 'CQDV',
        nam: 2024,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: 'QD-MSG-OK',
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    const error = await expectError(
      proposalService.approveProposal(
        proposal.id,
        {},
        ADMIN_ID,
        { so_quyet_dinh_don_vi_hang_nam: 'QD-MSG-DEFAULT' },
        {},
        null
      ),
      ValidationError,
      { startsWith: 'Không thể phê duyệt đề xuất do có 1 lỗi khi thêm khen thưởng:' }
    );
    expect(error.message).toContain('Thiếu thông tin đơn vị khi lưu danh hiệu');
  });
});
