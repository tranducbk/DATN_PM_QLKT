/**
 * Bypass-FE attack scenarios — what happens if a malicious actor sends
 * data the frontend would never produce.
 *
 * Persona: bypass-FE attacker. Each test crafts a malformed proposal payload
 * (negative year, future year, invalid month, missing personnel, mixed groups,
 * type confusion on titleData) and pins the exact error or accepted shape
 * produced by the backend. Service-level behavior — not Joi route validation —
 * is the system under test.
 */

import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import {
  makePersonnel,
  makeAdmin,
  makeProposal,
  makeProposalItemCaNhan,
  makeUnit,
} from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import {
  MIXED_CA_NHAN_HANG_NAM_ERROR,
  MIXED_DON_VI_HANG_NAM_ERROR,
  PROPOSAL_ALREADY_APPROVED_ERROR,
  PROPOSAL_NOT_FOUND_ERROR,
  TAI_KHOAN_QUAN_NHAN_NOT_FOUND_ERROR,
  SUBMIT_INVALID_TITLE_DATA_ERROR,
  APPROVE_MISSING_MONTH_ERROR,
} from '../helpers/errorMessages';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ValidationError, NotFoundError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM, DANH_HIEU_DON_VI_HANG_NAM } from '../../src/constants/danhHieu.constants';

beforeEach(() => {
  resetPrismaMock();
  jest
    .spyOn(profileService, 'checkAwardEligibility')
    .mockResolvedValue({ eligible: true, reason: '' });
  prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
  prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-bypass-1';

interface CaNhanItem {
  personnel_id: string;
  danh_hieu: string;
}

function arrangeManager() {
  const account = makeAdmin({ id: ADMIN_ID });
  prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
    ...account,
    QuanNhan: {
      id: 'qn-mgr',
      ho_ten: 'Manager',
      co_quan_don_vi_id: 'cqdv-mgr',
      don_vi_truc_thuoc_id: null,
      CoQuanDonVi: { id: 'cqdv-mgr', ten_don_vi: 'CQDV M', ma_don_vi: 'M' },
      DonViTrucThuoc: null,
    },
  });
}

function callSubmitCaNhan(
  items: CaNhanItem[],
  nam: number,
  thang: number | null = null,
  type = PROPOSAL_TYPES.CA_NHAN_HANG_NAM
) {
  return proposalService.submitProposal(items, null, ADMIN_ID, type, nam, null, thang);
}

describe('Bypass FE — payload shape attacks', () => {
  it('titleData = null → ValidationError "Dữ liệu đề xuất không hợp lệ"', async () => {
    // Given: an attacker submits a JSON body with titleData explicitly null
    arrangeManager();

    // When + Then
    await expectError(
      proposalService.submitProposal(
        null as unknown as CaNhanItem[],
        null,        ADMIN_ID,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      ),
      ValidationError,
      SUBMIT_INVALID_TITLE_DATA_ERROR
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('titleData = "string" → ValidationError vì không phải mảng', async () => {
    // Given: titleData is a primitive string instead of an array
    arrangeManager();

    await expectError(
      proposalService.submitProposal(
        'not-an-array' as unknown as CaNhanItem[],
        null,        ADMIN_ID,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      ),
      ValidationError,
      SUBMIT_INVALID_TITLE_DATA_ERROR
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('userId không có QuanNhan → NotFoundError exact', async () => {
    // Given: account exists but has no linked personnel relation
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-orphan',
      username: 'orphan',
      role: 'ADMIN',
      quan_nhan_id: null,
      QuanNhan: null,
    });

    await expectError(
      proposalService.submitProposal(
        [{ personnel_id: 'qn-1', danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
        null,        'acc-orphan',
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      ),
      NotFoundError,
      TAI_KHOAN_QUAN_NHAN_NOT_FOUND_ERROR
    );
  });
});

describe('Bypass FE — year and month boundary attacks', () => {
  it('nam = -1 → service vẫn tạo proposal (KHÔNG validate phía service)', async () => {
    // Note: Joi validation lives at the route layer; the service does not guard `nam` range.
    // This test pins the current behavior — see "Rule mơ hồ phát hiện" in the audit report.
    arrangeManager();
    const target = makePersonnel({ id: 'qn-neg-year' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-neg',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: { ten_don_vi: 'CQDV M' },
      NguoiDeXuat: { id: ADMIN_ID, username: 'admin', QuanNhan: null },
    });

    await callSubmitCaNhan(
      [{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      -1
    );

    // The service stores nam = -1 unchanged — Joi at the route should have rejected it earlier.
    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.create.mock.calls[0][0].data.nam).toBe(-1);
  });

  it('nam = 9999 (tương lai) → service vẫn tạo proposal — pins behavior', async () => {
    // Pinned: service does not guard against far-future years.
    arrangeManager();
    const target = makePersonnel({ id: 'qn-9999' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-9999',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: { ten_don_vi: 'CQDV M' },
      NguoiDeXuat: { id: ADMIN_ID, username: 'admin', QuanNhan: null },
    });

    await callSubmitCaNhan(
      [{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      9999
    );

    expect(prismaMock.bangDeXuat.create.mock.calls[0][0].data.nam).toBe(9999);
  });

  it('thang = 0 cho HC_QKQT → reject với SUBMIT_MISSING_MONTH_ERROR', async () => {
    // HC_QKQT requires a month in [1, 12]; service rejects 0
    arrangeManager();
    const target = makePersonnel({
      id: 'qn-hc-thang0',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(target);

    await expectError(
      proposalService.submitProposal(
        [{ personnel_id: target.id, danh_hieu: PROPOSAL_TYPES.HC_QKQT }],
        null,        ADMIN_ID,
        PROPOSAL_TYPES.HC_QKQT,
        2024,
        null,
        0
      ),
      ValidationError,
      'Thiếu tháng đề xuất. Loại đề xuất này bắt buộc nhập tháng (1-12).'
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('thang = 13 cho HC_QKQT → reject', async () => {
    arrangeManager();
    const target = makePersonnel({
      id: 'qn-hc-thang13',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(target);

    await expectError(
      proposalService.submitProposal(
        [{ personnel_id: target.id, danh_hieu: PROPOSAL_TYPES.HC_QKQT }],
        null,        ADMIN_ID,
        PROPOSAL_TYPES.HC_QKQT,
        2024,
        null,
        13
      ),
      ValidationError,
      'Thiếu tháng đề xuất. Loại đề xuất này bắt buộc nhập tháng (1-12).'
    );
  });
});

describe('Bypass FE — invalid references', () => {
  it('personnel_id không tồn tại → service tạo proposal nhưng map.ho_ten = ""', async () => {
    // Service does NOT abort when personnel cannot be found; it stores empty ho_ten.
    // The route-layer guard normally rejects this, but the service is permissive.
    arrangeManager();
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-missing-qn',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: { ten_don_vi: 'CQDV M' },
      NguoiDeXuat: { id: ADMIN_ID, username: 'admin', QuanNhan: null },
    });

    await callSubmitCaNhan(
      [{ personnel_id: 'qn-ghost', danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      2024
    );

    // Service still creates the proposal — pins current behavior, see audit report.
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.data_danh_hieu[0].ho_ten).toBe('');
  });

  it('danh_hieu = "INVALID_AWARD" trong CA_NHAN_HANG_NAM → reject', async () => {
    arrangeManager();
    const target = makePersonnel({ id: 'qn-invalid-dh' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    await expectError(
      callSubmitCaNhan([{ personnel_id: target.id, danh_hieu: 'INVALID_AWARD' }], 2024),
      ValidationError,
      { startsWith: 'Phát hiện danh hiệu không hợp lệ trong dữ liệu đề xuất.\n' }
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

});

describe('Bypass FE — mixed group attacks (CA_NHAN_HANG_NAM)', () => {
  it('Cùng QN nhận CSTDCS và BKBQP → reject mixed-group exact', async () => {
    // Self-conflict: same personnel listed twice with incompatible award groups
    arrangeManager();
    const target = makePersonnel({ id: 'qn-self-conflict' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      callSubmitCaNhan(
        [
          { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
          { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP },
        ],
        2024
      ),
      ValidationError,
      MIXED_CA_NHAN_HANG_NAM_ERROR
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });
});

describe('Bypass FE — approve attacks', () => {
  it('approve proposalId không tồn tại → NotFoundError exact', async () => {
    // Given: lookup returns null
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(null);

    await expectError(
      proposalService.approveProposal('p-ghost', {}, ADMIN_ID, {}, {}, null),
      NotFoundError,
      PROPOSAL_NOT_FOUND_ERROR
    );
  });

  it('approve proposal đã APPROVED → ValidationError exact', async () => {
    // Given: proposal already approved
    const proposal = makeProposal({
      id: 'p-already',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.APPROVED,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      PROPOSAL_ALREADY_APPROVED_ERROR
    );
  });

  it('approve HC_QKQT proposal thiếu thang → ValidationError "Đề xuất thiếu tháng…"', async () => {
    // Given: proposal stored without thang — guard re-checks before transaction
    const proposal = makeProposal({
      id: 'p-no-thang',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: null,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [
        { personnel_id: 'qn-1', danh_hieu: PROPOSAL_TYPES.HC_QKQT, ho_ten: 'X' },
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      APPROVE_MISSING_MONTH_ERROR
    );
  });

  it('editedData mixed-group khi data_danh_hieu lưu sạch → vẫn block', async () => {
    // Given: stored data is clean but edited payload mixes CSTDCS with BKBQP
    const personnelA = makePersonnel({ id: 'qn-edit-A' });
    const personnelB = makePersonnel({ id: 'qn-edit-B' });
    const cleanItem = makeProposalItemCaNhan({
      personnel_id: personnelA.id,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });
    const proposal = makeProposal({
      id: 'p-edit-mixed',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      data_danh_hieu: [cleanItem],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnelA.id, ho_ten: personnelA.ho_ten },
      { id: personnelB.id, ho_ten: personnelB.ho_ten },
    ]);

    // editedData injects a BKBQP alongside the existing CSTDCS — must be blocked
    await expectError(
      proposalService.approveProposal(
        proposal.id,
        {
          data_danh_hieu: [
            cleanItem,
            makeProposalItemCaNhan({
              personnel_id: personnelB.id,
              danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
            }),
          ],
        },
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

  it('editedData mixed-group ĐVQT + BKBQP đơn vị → reject MIXED_DON_VI_HANG_NAM_ERROR', async () => {
    // Given: a DON_VI_HANG_NAM proposal where editedData mixes ĐVQT + BKBQP
    const cqdvA = makeUnit({ kind: 'CQDV', id: 'cqdv-edit-A' });
    const cqdvB = makeUnit({ kind: 'CQDV', id: 'cqdv-edit-B' });
    const proposal = makeProposal({
      id: 'p-edit-unit-mixed',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: ADMIN_ID,
      unit: cqdvA,
      data_danh_hieu: [
        {
          don_vi_id: cqdvA.id,
          don_vi_type: 'CO_QUAN_DON_VI',
          ten_don_vi: cqdvA.ten_don_vi,
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        },
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);

    await expectError(
      proposalService.approveProposal(
        proposal.id,
        {
          data_danh_hieu: [
            {
              don_vi_id: cqdvA.id,
              don_vi_type: 'CO_QUAN_DON_VI',
              ten_don_vi: cqdvA.ten_don_vi,
              danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
            },
            {
              don_vi_id: cqdvB.id,
              don_vi_type: 'CO_QUAN_DON_VI',
              ten_don_vi: cqdvB.ten_don_vi,
              danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
            },
          ],
        },
        ADMIN_ID,
        {},
        {},
        null
      ),
      ValidationError,
      MIXED_DON_VI_HANG_NAM_ERROR
    );
  });

});
