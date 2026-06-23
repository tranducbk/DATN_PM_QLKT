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
import { MIXED_CA_NHAN_HANG_NAM_ERROR } from '../helpers/errorMessages';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
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
const RECONCILE_REJECT_MSG =
  'Không thể phê duyệt: dữ liệu chỉnh sửa chứa quân nhân hoặc đơn vị không có trong đề xuất gốc.';

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
    nguoi_de_xuat_id: 'acc-submitter',
    unit: cqdv,
    data_danh_hieu: [submittedItem],
  });
  return { cqdv, submittedItem, proposal };
}

describe('Sửa dữ liệu sau khi gửi: tráo quân nhân lúc phê duyệt', () => {
  it('Sửa dữ liệu sau khi gửi: admin tráo quân nhân A thành quân nhân B lúc duyệt → từ chối vì B không có trong đề xuất gốc', async () => {
    // Given: submit với qn-A, admin gửi editedData với qn-B
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

    // Then: reconcile chặn — personnel_id qn-B không có trong đề xuất gốc (qn-A).
    await expectError(
      proposalService.approveProposal(
        proposal.id,
        { data_danh_hieu: [swappedItem] },
        ADMIN_ID,
        { so_quyet_dinh_cstdcs: 'QD-ORIG' },
        {},
        null
      ),
      ValidationError,
      RECONCILE_REJECT_MSG
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });
});

describe('Sửa dữ liệu sau khi gửi: ghi đè năm khen thưởng lúc phê duyệt', () => {
  it('Sửa dữ liệu sau khi gửi: admin sửa năm của dòng thành 2099 nhưng đề xuất gốc là 2024 → khen thưởng vẫn lưu theo năm 2024 gốc', async () => {
    // Given: proposal lưu nam=2024; editedData mang item.nam=2099
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

    // Then: upsert theo proposal.nam (2024), không phải item.nam (2099)
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.where.quan_nhan_id_nam.nam).toBe(2024);
    expect(upsertArgs.create.nam).toBe(2024);
  });
});

describe('Sửa dữ liệu sau khi gửi: nâng danh hiệu lên nhóm xung khắc lúc phê duyệt', () => {
  it('Sửa dữ liệu sau khi gửi: đề xuất gốc chỉ có CSTDCS, admin chèn thêm BKBQP cho cùng quân nhân → từ chối trộn nhóm', async () => {
    // Given: proposal lưu chỉ có CSTDCS; admin chèn thêm BKBQP cho cùng QN
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

describe('Sửa dữ liệu sau khi gửi: chèn thêm quân nhân lạ lúc phê duyệt', () => {
  it('Sửa dữ liệu sau khi gửi: admin chèn thêm quân nhân C ngoài đề xuất gốc lúc duyệt → từ chối (chống chèn dữ liệu lạ)', async () => {
    // Given: submit chỉ có qn-A; admin thêm qn-C; DB đã có qn-C CSTDCS năm 2024
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
      RECONCILE_REJECT_MSG
    );
    expect(prismaMock.danhHieuHangNam.upsert).not.toHaveBeenCalled();
  });
});

describe('Sửa dữ liệu sau khi gửi: gắn nhầm ô số quyết định lúc phê duyệt', () => {
  it('Sửa dữ liệu sau khi gửi: dòng BKBQP nhưng admin gắn số quyết định vào ô chung thay vì ô BKBQP → số gắn nhầm vẫn lưu vào số quyết định chuỗi, che mất số hợp lệ', async () => {
    // Given: item BKBQP nhưng số quyết định chuỗi bị đặt nhầm dưới so_quyet_dinh
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bk' });
    const personnel = makePersonnel({ unit: cqdv, id: 'qn-bk' });
    const proposal = makeProposal({
      id: 'prop-bk-edit',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-submitter',
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

    // When: admin cung cấp số quyết định chuỗi qua map `decisions` đúng quy chuẩn.
    await proposalService.approveProposal(
      proposal.id,
      { data_danh_hieu: [tampered] },
      ADMIN_ID,
      { so_quyet_dinh_bkbqp: 'QD-BK-LEGIT' },
      {},
      null
    );

    // Then: upsert.create ghi so_quyet_dinh_bkbqp = "QD-WRONG-FIELD" — số
    //   so_quyet_dinh top-level đặt nhầm bị lan thành số quyết định chuỗi,
    //   che mất decisions.so_quyet_dinh_bkbqp hợp lệ admin truyền.
    const upsertArgs = prismaMock.danhHieuHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.create.nhan_bkbqp).toBe(true);
    expect(upsertArgs.create.so_quyet_dinh_bkbqp).toBe('QD-WRONG-FIELD');
    // TODO: `resolveChain` fallback về item.so_quyet_dinh cho chain awards —
    //   editedData bị tampering có thể ghi đè số quyết định chuỗi do admin truyền.
    //   Cân nhắc giữ chain-decision lookup strict (chỉ qua mapping).
  });
});

describe('Sửa dữ liệu sau khi gửi: tráo đơn vị lúc phê duyệt', () => {
  it('Sửa dữ liệu sau khi gửi: admin tráo cơ quan đơn vị X sang Y lúc duyệt → từ chối vì Y không có trong đề xuất gốc', async () => {
    // Given: submit với cqdv-X; admin sửa editedData trỏ về cqdv-Y
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
      nguoi_de_xuat_id: 'acc-submitter',
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

    // Then: reconcile chặn — đơn vị cqdv-Y không có trong đề xuất gốc (cqdv-X).
    await expectError(
      proposalService.approveProposal(
        proposal.id,
        { data_danh_hieu: [tamperedItem] },
        ADMIN_ID,
        { so_quyet_dinh_don_vi_hang_nam: 'QD-DVQT' },
        {},
        null
      ),
      ValidationError,
      RECONCILE_REJECT_MSG
    );
    expect(prismaMock.danhHieuDonViHangNam.create).not.toHaveBeenCalled();
  });
});
