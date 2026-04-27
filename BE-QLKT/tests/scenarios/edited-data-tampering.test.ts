/**
 * Sneaky `editedData` tampering scenarios — pin behavior of `approveProposal`
 * when an admin POSTs an `editedData` payload that diverges from the stored
 * submission. The service prefers `editedData.*` over `proposal.data_*`
 * (see approve.ts: `editedData.data_danh_hieu ?? proposal.data_danh_hieu`),
 * so a malicious admin can rewrite items at approve time. Each test asserts
 * exactly which guards survive that rewrite and which do not.
 *
 * Persona: rogue admin who tries to bend the proposal between submit and approve.
 */

import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import {
  makePersonnel,
  makeProposal,
  makeProposalItemCaNhan,
  makeUnit,
  makeAnnualRecord,
} from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import {
  MIXED_CA_NHAN_HANG_NAM_ERROR,
  duplicateActualAnnualMessage,
} from '../helpers/errorMessages';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
  getDanhHieuName,
} from '../../src/constants/danhHieu.constants';

beforeEach(() => {
  resetPrismaMock();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
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

const ADMIN_ID = 'acc-admin-edit-1';

/** Builds a clean CSTDCS proposal owned by `ADMIN_ID`. */
function EDITED_buildAnnualProposal(personnelId: string, ho_ten = 'QN A') {
  const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-edit' });
  const submittedItem = makeProposalItemCaNhan({
    personnel_id: personnelId,
    ho_ten,
    danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    so_quyet_dinh: 'QD-ORIG',
  });
  const proposal = makeProposal({
    id: 'prop-edit-1',
    loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
    status: PROPOSAL_STATUS.PENDING,
    nam: 2024,
    nguoi_de_xuat_id: ADMIN_ID,
    unit: cqdv,
    data_danh_hieu: [submittedItem],
  });
  return { cqdv, submittedItem, proposal };
}

describe('editedData tampering — personnel_id swap', () => {
  it('Đổi personnel_id từ qn-A sang qn-B → service dùng editedData, ghi DB cho qn-B (lỗ hổng)', async () => {
    // Given: submitted with qn-A, admin sends editedData with qn-B
    const { proposal } = EDITED_buildAnnualProposal('qn-A', 'Nguyễn A');
    const swappedItem = makeProposalItemCaNhan({
      personnel_id: 'qn-B',
      ho_ten: 'Trần B',
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-ORIG',
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: 'qn-B', ho_ten: 'Trần B' }]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      makePersonnel({ id: 'qn-B', ho_ten: 'Trần B' })
    );
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({
        personnelId: 'qn-B',
        nam: 2024,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When
    await proposalService.approveProposal(
      proposal.id,
      { data_danh_hieu: [swappedItem] },
      ADMIN_ID,
      { so_quyet_dinh_cstdcs: 'QD-ORIG' },
      {},
      null
    );

    // Then: DB write goes to qn-B — pinned vulnerability
    expect(prismaMock.danhHieuHangNam.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.where.quan_nhan_id_nam).toEqual({ quan_nhan_id: 'qn-B', nam: 2024 });
    // TODO: behavior is admin-tampering — service trusts editedData.personnel_id; consider
    //   rejecting items whose personnel_id is not in the originally submitted payload.
  });
});

describe('editedData tampering — nam override', () => {
  it('editedData nam=2099 trên item nhưng proposal.nam=2024 → service vẫn dùng proposal.nam', async () => {
    // Given: stored proposal.nam=2024; editedData carries item.nam=2099
    const { proposal, submittedItem } = EDITED_buildAnnualProposal('qn-nam-override');
    const tamperedItem = { ...submittedItem, nam: 2099 };

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: 'qn-nam-override', ho_ten: submittedItem.ho_ten },
    ]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      makePersonnel({ id: 'qn-nam-override' })
    );
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({ personnelId: 'qn-nam-override', nam: 2024 })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When
    await proposalService.approveProposal(
      proposal.id,
      { data_danh_hieu: [tamperedItem] },
      ADMIN_ID,
      { so_quyet_dinh_cstdcs: 'QD-ORIG' },
      {},
      null
    );

    // Then: upsert keyed by proposal.nam (2024), not item.nam (2099)
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.where.quan_nhan_id_nam.nam).toBe(2024);
    expect(upsertArgs.create.nam).toBe(2024);
  });
});

describe('editedData tampering — danh_hieu group escalation', () => {
  it('editedData thêm BKBQP cùng item CSTDCS đã có → block với MIXED_CA_NHAN_HANG_NAM_ERROR', async () => {
    // Given: stored proposal has only CSTDCS; admin injects a BKBQP for the same person
    const { proposal, submittedItem } = EDITED_buildAnnualProposal('qn-mix');
    const escalatedBkbqp = makeProposalItemCaNhan({
      personnel_id: 'qn-mix',
      ho_ten: submittedItem.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: 'qn-mix', ho_ten: submittedItem.ho_ten },
    ]);

    await expectError(
      proposalService.approveProposal(
        proposal.id,
        { data_danh_hieu: [submittedItem, escalatedBkbqp] },
        ADMIN_ID,
        {},
        {},
        null
      ),
      ValidationError,
      MIXED_CA_NHAN_HANG_NAM_ERROR
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });
});

describe('editedData tampering — extra item injection', () => {
  it('editedData thêm 1 item mới (qn-C CSTDCS) ngoài submit data → duplicate check VẪN chạy cho item mới', async () => {
    // Given: submitted has only qn-A; admin appends qn-C; DB already has qn-C CSTDCS for 2024
    const { proposal, submittedItem } = EDITED_buildAnnualProposal('qn-A');
    const injectedItem = makeProposalItemCaNhan({
      personnel_id: 'qn-C',
      ho_ten: 'Phạm C',
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: 'qn-A', ho_ten: submittedItem.ho_ten },
      { id: 'qn-C', ho_ten: 'Phạm C' },
    ]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce({
      id: 'existing-c',
      quan_nhan_id: 'qn-C',
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    await expectError(
      proposalService.approveProposal(
        proposal.id,
        { data_danh_hieu: [submittedItem, injectedItem] },
        ADMIN_ID,
        {},
        {},
        null
      ),
      ValidationError,
      {
        startsWith:
          'Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\nPhạm C: ' +
          duplicateActualAnnualMessage(
            getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS),
            2024
          ),
      }
    );
  });
});

describe('editedData tampering — wrong decision field key', () => {
  it('Item BKBQP nhưng admin set so_quyet_dinh thay vì so_quyet_dinh_bkbqp → vẫn ghi DB (so_quyet_dinh_bkbqp = null)', async () => {
    // Given: BKBQP item where the chain decision number is mis-keyed under so_quyet_dinh
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bk' });
    const personnel = makePersonnel({ unit: cqdv, id: 'qn-bk' });
    const proposal = makeProposal({
      id: 'prop-bk-edit',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdv,
      data_danh_hieu: [
        makeProposalItemCaNhan({
          personnel_id: personnel.id,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
        }),
      ],
    });
    const tampered = {
      personnel_id: personnel.id,
      ho_ten: personnel.ho_ten,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QD-WRONG-FIELD',
      so_quyet_dinh_bkbqp: null,
      nhan_bkbqp: true,
    };

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten },
    ]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.danhHieuHangNam.upsert.mockResolvedValueOnce(
      makeAnnualRecord({ personnelId: personnel.id, nam: 2024, nhan_bkbqp: true })
    );
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When: admin supplies the chain decision via the legitimate `decisions` map.
    await proposalService.approveProposal(
      proposal.id,
      { data_danh_hieu: [tampered] },
      ADMIN_ID,
      { so_quyet_dinh_bkbqp: 'QD-BK-LEGIT' },
      {},
      null
    );

    // Then: upsert.create writes so_quyet_dinh_bkbqp = "QD-WRONG-FIELD" — the
    //   misplaced top-level so_quyet_dinh is propagated as the chain decision number,
    //   shadowing the legitimate decisions.so_quyet_dinh_bkbqp passed by the admin.
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.create.nhan_bkbqp).toBe(true);
    expect(upsertArgs.create.so_quyet_dinh_bkbqp).toBe('QD-WRONG-FIELD');
    // TODO: behavior is `resolveChain` falls back to item.so_quyet_dinh for chain
    //   awards — a tampered editedData item can override the admin-supplied chain
    //   decision number. Consider keeping chain-decision lookup strict (mapping only).
  });
});

describe('editedData tampering — DON_VI item swap', () => {
  it('Đổi co_quan_don_vi_id trong DON_VI item → write theo editedData (lỗ hổng)', async () => {
    // Given: submitted with cqdv-X; admin rewrites editedData to point at cqdv-Y
    const cqdvX = makeUnit({ kind: 'CQDV', id: 'cqdv-X' });
    const cqdvY = makeUnit({ kind: 'CQDV', id: 'cqdv-Y' });
    const submittedItem = {
      don_vi_id: cqdvX.id,
      don_vi_type: 'CO_QUAN_DON_VI',
      ten_don_vi: cqdvX.ten_don_vi,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
      so_quyet_dinh: 'QD-DVQT',
    };
    const tamperedItem = { ...submittedItem, don_vi_id: cqdvY.id, ten_don_vi: cqdvY.ten_don_vi };
    const proposal = makeProposal({
      id: 'prop-dv-edit',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdvX,
      data_danh_hieu: [submittedItem],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.danhHieuDonViHangNam.create.mockResolvedValueOnce({
      id: 'dh-dv-1',
      co_quan_don_vi_id: cqdvY.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
    });
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    // When
    await proposalService.approveProposal(
      proposal.id,
      { data_danh_hieu: [tamperedItem] },
      ADMIN_ID,
      { so_quyet_dinh_don_vi_hang_nam: 'QD-DVQT' },
      {},
      null
    );

    // Then: DB write targets cqdv-Y, not cqdv-X — pinned vulnerability
    const createArgs = prismaMock.danhHieuDonViHangNam.create.mock.calls[0][0];
    expect(createArgs.data.CoQuanDonVi.connect.id).toBe(cqdvY.id);
    // TODO: behavior is unit swap accepted — verify with business whether approve.ts should
    //   reject editedData unit ids that diverge from the proposal's stored unit scope.
  });
});
