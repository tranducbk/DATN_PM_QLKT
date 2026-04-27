/**
 * One-time award race scenarios — pin behavior when two approve flows attempt to
 * persist the same once-only award (HC_QKQT, HCBVTQ) for the same personnel,
 * or when a personal/unit BKTTCP coexist on different models.
 *
 * The Prisma `$transaction` mock in `prismaMock` is non-isolating: both inner
 * callbacks observe the same in-memory mock state. We exploit that to simulate
 * two admins reading PENDING simultaneously, then both reaching the write step.
 */

import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import {
  makePersonnel,
  makeProposal,
  makeUnit,
  makeProposalItemCaNhan,
} from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import {
  congHienLowerOrEqualBlocked,
  hcqkqtAlreadyAwardedMessage,
} from '../helpers/errorMessages';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import {
  DANH_HIEU_HCBVTQ,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_CA_NHAN_HANG_NAM,
  getDanhHieuName,
} from '../../src/constants/danhHieu.constants';

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

const ADMIN_ID_1 = 'acc-admin-race-1';
const ADMIN_ID_2 = 'acc-admin-race-2';

interface OnetimeHcqkqtItem {
  personnel_id: string;
  ho_ten: string;
  danh_hieu: string;
  nam_nhan: number;
  thang_nhan: number;
  so_quyet_dinh: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
}

/** Builds the minimal HC_QKQT data_nien_han item used by approve.ts. */
function ONETIME_RACE_buildHcqkqtItem(personnelId: string, hoTen: string): OnetimeHcqkqtItem {
  return {
    personnel_id: personnelId,
    ho_ten: hoTen,
    danh_hieu: PROPOSAL_TYPES.HC_QKQT,
    nam_nhan: 2024,
    thang_nhan: 6,
    so_quyet_dinh: 'QD-HCQKQT-1',
    cap_bac: 'Đại tá',
    chuc_vu: 'Chỉ huy',
  };
}

describe('One-time race — HC_QKQT parallel approve', () => {
  it('Hai proposal HC_QKQT cùng QN approve song song khi DB trống → cả hai đều reach create (pinned: thiếu unique guard ở approve)', async () => {
    // Given: same personnel, two pending HC_QKQT proposals from different years/admins.
    const personnel = makePersonnel({
      id: 'qn-race-hcqkqt',
      ho_ten: 'Race HCQKQT',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    const buildProposal = (id: string, nam: number, thang: number) =>
      makeProposal({
        id,
        loai: PROPOSAL_TYPES.HC_QKQT,
        status: PROPOSAL_STATUS.PENDING,
        nam,
        thang,
        nguoi_de_xuat_id: ADMIN_ID_1,
        data_nien_han: [
          {
            ...ONETIME_RACE_buildHcqkqtItem(personnel.id, personnel.ho_ten),
            nam_nhan: nam,
            thang_nhan: thang,
          },
        ],
      });
    const propA = buildProposal('p-race-A', 2024, 6);
    const propB = buildProposal('p-race-B', 2024, 7);

    prismaMock.bangDeXuat.findUnique
      .mockResolvedValueOnce(propA)
      .mockResolvedValueOnce(propB);
    prismaMock.quanNhan.findMany.mockResolvedValue([
      { id: personnel.id, ho_ten: personnel.ho_ten },
    ]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.quanNhan.findMany.mockResolvedValue([
      {
        id: personnel.id,
        ho_ten: personnel.ho_ten,
        ngay_nhap_ngu: personnel.ngay_nhap_ngu,
        ngay_xuat_ngu: null,
      },
    ]);
    prismaMock.quanNhan.findUnique.mockResolvedValue(personnel);
    prismaMock.huanChuongQuanKyQuyetThang.findUnique.mockResolvedValue(null);
    prismaMock.huanChuongQuanKyQuyetThang.create.mockResolvedValue({
      id: 'kt-hcqkqt-race',
      quan_nhan_id: personnel.id,
    });
    prismaMock.bangDeXuat.updateMany.mockResolvedValue({ count: 1 });

    // When: both approves run in parallel
    const results = await Promise.allSettled([
      proposalService.approveProposal(
        propA.id,
        {},
        ADMIN_ID_1,
        { so_quyet_dinh_nien_han: 'QD-A' },
        {},
        null
      ),
      proposalService.approveProposal(
        propB.id,
        {},
        ADMIN_ID_2,
        { so_quyet_dinh_nien_han: 'QD-B' },
        {},
        null
      ),
    ]);

    // Then: both transactions reach create — no in-process serialization
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('fulfilled');
    expect(prismaMock.huanChuongQuanKyQuyetThang.create).toHaveBeenCalledTimes(2);
    // TODO: behavior is approve-side relies solely on the optimistic
    //   findUnique-then-create pattern. The DB unique on quan_nhan_id is the only
    //   real safeguard — consider adding an explicit `findFirst` outside the tx
    //   and surfacing the duplicate to the second admin instead of letting Prisma
    //   throw a P2002 from create.
  });

  it('Approve-time HC_QKQT khi DB đã có award → checkDuplicateAward block với hcqkqtAlreadyAwardedMessage', async () => {
    // Given: pending HC_QKQT proposal but DB already has an HC_QKQT row for the same personnel
    const personnel = makePersonnel({
      id: 'qn-hcqkqt-already',
      ho_ten: 'Đã nhận HCQKQT',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    const proposal = makeProposal({
      id: 'p-hcqkqt-dup',
      loai: PROPOSAL_TYPES.HC_QKQT,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID_1,
      data_nien_han: [
        { ...ONETIME_RACE_buildHcqkqtItem(personnel.id, personnel.ho_ten), nam_nhan: 2024, thang_nhan: 6 },
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten },
    ]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce({
      id: 'kt-old',
      quan_nhan_id: personnel.id,
      nam: 2020,
    });
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID_1, {}, {}, null),
      ValidationError,
      {
        startsWith: `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${personnel.ho_ten}: ${hcqkqtAlreadyAwardedMessage(2020)}`,
      }
    );
    expect(prismaMock.huanChuongQuanKyQuyetThang.create).not.toHaveBeenCalled();
  });
});

describe('One-time race — CONG_HIEN upgrade vs duplicate', () => {
  it('QN đã có HCBVTQ_HANG_BA → approve HCBVTQ_HANG_NHI: upgrade qua update (không create mới)', async () => {
    // Given: existing HCBVTQ_HANG_BA in DB, new proposal asks for HANG_NHI
    const personnel = makePersonnel({
      id: 'qn-upgrade',
      ho_ten: 'Upgrade CH',
      gioi_tinh: 'NAM',
    });
    const proposal = makeProposal({
      id: 'p-upgrade',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID_1,
      data_cong_hien: [
        {
          personnel_id: personnel.id,
          ho_ten: personnel.ho_ten,
          danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
          nam_nhan: 2024,
          thang_nhan: 6,
          so_quyet_dinh: 'QD-UP',
          thoi_gian_nhom_0_7: { total_months: 0, years: 0, months: 0, display: '-' },
          thoi_gian_nhom_0_8: { total_months: 60, years: 5, months: 0, display: '5 năm' },
          thoi_gian_nhom_0_9_1_0: { total_months: 60, years: 5, months: 0, display: '5 năm' },
        },
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten },
    ]);
    prismaMock.khenThuongHCBVTQ.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: personnel.id,
        he_so_chuc_vu: 0.8,
        so_thang: 72,
        ngay_bat_dau: new Date('2012-01-01'),
        ngay_ket_thuc: new Date('2018-01-01'),
      },
      {
        quan_nhan_id: personnel.id,
        he_so_chuc_vu: 0.9,
        so_thang: 72,
        ngay_bat_dau: new Date('2018-01-01'),
        ngay_ket_thuc: new Date('2024-01-01'),
      },
    ]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.khenThuongHCBVTQ.findUnique.mockResolvedValueOnce({
      id: 'kt-existing-ba',
      quan_nhan_id: personnel.id,
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
      nam: 2020,
    });
    prismaMock.khenThuongHCBVTQ.update.mockResolvedValueOnce({
      id: 'kt-existing-ba',
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
    });
    prismaMock.hoSoCongHien.upsert.mockResolvedValueOnce({});
    prismaMock.bangDeXuat.updateMany.mockResolvedValueOnce({ count: 1 });

    await proposalService.approveProposal(proposal.id, {}, ADMIN_ID_1, {}, {}, null);

    expect(prismaMock.khenThuongHCBVTQ.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
    const updateArgs = prismaMock.khenThuongHCBVTQ.update.mock.calls[0][0];
    expect(updateArgs.data.danh_hieu).toBe(DANH_HIEU_HCBVTQ.HANG_NHI);
  });

  it('QN đã có HCBVTQ_HANG_NHI → approve HCBVTQ_HANG_BA: reject với "thấp hơn hoặc bằng"', async () => {
    // Given: downgrade attempt — should be rejected without DB write
    const personnel = makePersonnel({
      id: 'qn-downgrade',
      ho_ten: 'Downgrade CH',
      gioi_tinh: 'NAM',
    });
    const proposal = makeProposal({
      id: 'p-downgrade',
      loai: PROPOSAL_TYPES.CONG_HIEN,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID_1,
      data_cong_hien: [
        {
          personnel_id: personnel.id,
          ho_ten: personnel.ho_ten,
          danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA,
          nam_nhan: 2024,
          thang_nhan: 6,
          so_quyet_dinh: 'QD-DN',
          thoi_gian_nhom_0_7: { total_months: 60, years: 5, months: 0, display: '5 năm' },
          thoi_gian_nhom_0_8: { total_months: 60, years: 5, months: 0, display: '5 năm' },
          thoi_gian_nhom_0_9_1_0: { total_months: 60, years: 5, months: 0, display: '5 năm' },
        },
      ],
    });

    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten },
    ]);
    prismaMock.khenThuongHCBVTQ.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: personnel.id,
        he_so_chuc_vu: 0.7,
        so_thang: 60,
        ngay_bat_dau: new Date('2014-01-01'),
        ngay_ket_thuc: new Date('2019-01-01'),
      },
      {
        quan_nhan_id: personnel.id,
        he_so_chuc_vu: 0.8,
        so_thang: 60,
        ngay_bat_dau: new Date('2019-01-01'),
        ngay_ket_thuc: new Date('2024-01-01'),
      },
    ]);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.khenThuongHCBVTQ.findUnique.mockResolvedValueOnce({
      id: 'kt-existing-nhi',
      quan_nhan_id: personnel.id,
      danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI,
      nam: 2022,
    });

    // When/Then: downgrade collected into errors[] inside tx → rollback throws ValidationError
    const expectedMessage = congHienLowerOrEqualBlocked(
      personnel.ho_ten,
      getDanhHieuName(DANH_HIEU_HCBVTQ.HANG_NHI),
      2022,
      getDanhHieuName(DANH_HIEU_HCBVTQ.HANG_BA)
    );
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID_1, {}, {}, null),
      ValidationError,
      { startsWith: 'Không thể phê duyệt đề xuất do có 1 lỗi khi thêm khen thưởng:\n' + expectedMessage }
    );
    expect(prismaMock.khenThuongHCBVTQ.update).not.toHaveBeenCalled();
    expect(prismaMock.khenThuongHCBVTQ.create).not.toHaveBeenCalled();
  });
});

