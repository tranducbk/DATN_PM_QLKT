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

describe('Phê duyệt đề xuất đơn vị hằng năm', () => {
  it('Phê duyệt kèm quyết định: đề xuất ĐVQT (CQDV) → tạo khen thưởng đúng đơn vị, đề xuất chuyển APPROVED', async () => {
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
      nguoi_de_xuat_id: 'acc-submitter',
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

    // Then: create đúng don_vi (danh hiệu không còn cột status)
    expect(prismaMock.danhHieuDonViHangNam.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.danhHieuDonViHangNam.create.mock.calls[0][0];
    expect(createArgs.data.danh_hieu).toBe(DANH_HIEU_DON_VI_HANG_NAM.DVQT);
    expect(createArgs.data.co_quan_don_vi_id).toBe(cqdv.id);
    expect(createArgs.data.don_vi_truc_thuoc_id).toBeNull();

    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(
      PROPOSAL_STATUS.APPROVED
    );
  });

  it('Phê duyệt kèm quyết định: đề xuất BKBQP đơn vị (DVTT) → bản ghi đánh dấu nhan_bkbqp và gắn đúng đơn vị trực thuộc', async () => {
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
      nguoi_de_xuat_id: 'acc-submitter',
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
    expect(createArgs.data.don_vi_truc_thuoc_id).toBe(dvtt.id);
    expect(createArgs.data.CoQuanDonVi).toBeUndefined();
  });

  it('Phê duyệt bị chặn: đề xuất đơn vị đã được duyệt trước đó → báo đã phê duyệt', async () => {
    // Given: đề xuất đơn vị đã APPROVED
    const proposal = makeProposal({
      id: 'prop-uv-already',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      status: PROPOSAL_STATUS.APPROVED,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt bị chặn: đề xuất đơn vị không tồn tại → báo "Đề xuất không tồn tại"', async () => {
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(null);

    await expectError(
      proposalService.approveProposal('missing-uv', {}, ADMIN_ID, {}, {}, null),
      NotFoundError,
      'Đề xuất không tồn tại'
    );
  });

  it('Phê duyệt bị chặn: đề xuất đơn vị trộn ĐVQT với BKBQP (lách kiểm tra giao diện, gửi thẳng API) → buộc tách riêng', async () => {
    // Given: đề xuất đơn vị trộn ĐVQT (basic) + BKBQP (chain) — FE chặn, ở đây bypass
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-mixed' });
    const proposal = makeProposal({
      id: 'prop-uv-mixed-1',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt bị chặn: đề xuất đơn vị trộn ĐVTT với BKTTCP (lách kiểm tra giao diện, gửi thẳng API) → buộc tách riêng', async () => {
    // Given: ĐVTT (basic) + BKTTCP (chain) cùng 1 đề xuất
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-mixed-2' });
    const proposal = makeProposal({
      id: 'prop-uv-mixed-2',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt bị chặn: đề xuất đơn vị trộn ĐVQT với BKTTCP (lách kiểm tra giao diện, gửi thẳng API) → buộc tách riêng', async () => {
    // Given: một biến thể nhóm trộn khác
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-mixed-3' });
    const proposal = makeProposal({
      id: 'prop-uv-mixed-3',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt bị chặn: đơn vị đã có danh hiệu cùng năm trên hệ thống → báo trùng', async () => {
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
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt bị chặn: đang có đề xuất chờ duyệt trùng cùng đơn vị, cùng danh hiệu, cùng năm → báo trùng', async () => {
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
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt đơn vị hằng năm: bộ lọc chống trùng bỏ qua chính đề xuất đang duyệt → không tự báo trùng oan, vẫn duyệt được', async () => {
    // Bug đã fix: checkDuplicateUnitAward query PENDING proposals mà không exclude proposalId
    // hiện tại → đề xuất matches chính nó → ValidationError sai.
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-self-match' });
    const item = makeProposalItemDonVi({
      unitKind: 'CQDV',
      unitId: cqdv.id,
      ten_don_vi: cqdv.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-SELF-1',
    });
    const proposal = makeProposal({
      id: 'prop-self-match',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2026,
      nguoi_de_xuat_id: 'acc-submitter',
      unit: cqdv,
      data_danh_hieu: [item],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockReset();
    // Simulate real DB: chỉ có 1 proposal DON_VI_HANG_NAM PENDING năm này — chính là proposal đang duyệt.
    // Nếu where filter exclude proposalId thì findMany này không bao giờ được tham chiếu trong duplicate check.
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.danhHieuDonViHangNam.create.mockResolvedValueOnce(
      makeUnitAnnualRecord({
        unitId: cqdv.id,
        unitKind: 'CQDV',
        nam: 2026,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: 'QD-SELF-1',
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(
      proposal.id,
      {},
      ADMIN_ID,
      { so_quyet_dinh_don_vi_hang_nam: 'QD-SELF-1' },
      {},
      null
    );

    // Approve thành công, không throw duplicate error.
    expect(prismaMock.bangDeXuat.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.updateMany.mock.calls[0][0].data.status).toBe(
      PROPOSAL_STATUS.APPROVED
    );

    // Locks in fix: duplicate check phải pass where.id = { not: proposalId }.
    const duplicateCheckCall = prismaMock.bangDeXuat.findMany.mock.calls.find(
      ([args]) =>
        args?.where?.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM &&
        args?.where?.status === PROPOSAL_STATUS.PENDING
    );
    expect(duplicateCheckCall).toBeDefined();
    expect(duplicateCheckCall![0].where.id).toEqual({ not: proposal.id });
  });

  it('Phê duyệt bị chặn: đơn vị chưa đủ điều kiện BKBQP đơn vị (lách kiểm tra giao diện, gửi thẳng API) → từ chối', async () => {
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
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt bị chặn: đề xuất ĐVQT thiếu số quyết định → báo "Thiếu số quyết định"', async () => {
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
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt bị chặn: đề xuất BKBQP đơn vị thiếu số quyết định BKBQP → báo "Thiếu số quyết định"', async () => {
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
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt thông thường: đề xuất đơn vị đã có đủ số quyết định → tạo khen thưởng, đề xuất chuyển APPROVED', async () => {
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
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt bị chặn: đề xuất BKTTCP đơn vị thiếu số quyết định BKTTCP → báo "Thiếu số quyết định"', async () => {
    // Given: item BKTTCP đơn vị thiếu so_quyet_dinh_bkttcp
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
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt thông thường: đề xuất đơn vị chỉ có BKBQP → chỉ lưu đúng số quyết định BKBQP, không ghi nhầm sang ĐVQT/BKTTCP', async () => {
    // Given: item BKBQP đơn vị chỉ có so_quyet_dinh_bkbqp.
    // create.data KHÔNG được chứa so_quyet_dinh ĐVQT/ĐVTT lẫn so_quyet_dinh_bkttcp.
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
      nguoi_de_xuat_id: 'acc-submitter',
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

    // When: gọi duyệt
    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null);

    // Then: chỉ field BKBQP set; field ĐVQT-channel + BKTTCP giữ null/false
    expect(prismaMock.danhHieuDonViHangNam.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.danhHieuDonViHangNam.create.mock.calls[0][0];
    expect(createArgs.data.nhan_bkbqp).toBe(true);
    expect(createArgs.data.so_quyet_dinh_bkbqp).toBe('QD-BK-UV-ONLY');
    expect(createArgs.data.danh_hieu).toBeNull();
    expect(createArgs.data.so_quyet_dinh).toBeNull();
    expect(createArgs.data.nhan_bkttcp).toBe(false);
    expect(createArgs.data.so_quyet_dinh_bkttcp).toBeNull();
  });

  it('Phê duyệt bị chặn: đề xuất BKBQP đơn vị gắn nhầm số quyết định sang BKTTCP, thiếu số quyết định BKBQP → báo "Thiếu số quyết định"', async () => {
    // Given: item BKBQP đơn vị gắn nhầm field (so_quyet_dinh_bkttcp).
    // Thiếu so_quyet_dinh_bkbqp bắt buộc → validation phải reject.
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
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt bị chặn: đơn vị chưa đủ điều kiện BKTTCP đơn vị (lách kiểm tra giao diện, gửi thẳng API) → từ chối', async () => {
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
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Phê duyệt bị chặn: một dòng thiếu thông tin đơn vị → hủy toàn bộ và gộp lý do lỗi', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-msg-ok' });
    const proposal = makeProposal({
      id: 'prop-uv-partial-msg',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-submitter',
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
