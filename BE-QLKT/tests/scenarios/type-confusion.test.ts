/**
 * Type-confusion scenarios.
 *
 * Pin the service's behavior when callers send strings instead of numbers,
 * zero-padded months, lowercased award codes, untrimmed personnel IDs, or
 * empty strings instead of nulls. Each test exposes whether the service
 * coerces, trims, or treats the value as opaque. TODO: align all numeric
 * coercion at the service entry to avoid leaking these inconsistencies.
 */

import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeAdmin, makeAnnualRecord } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import {
  TYPE_CONFUSION_MISSING_MONTH,
  TYPE_CONFUSION_INVALID_DANH_HIEU_PREFIX,
  duplicateActualAnnualMessage,
  DUPLICATE_PREFIX,
} from '../helpers/errorMessages';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  getDanhHieuName,
} from '../../src/constants/danhHieu.constants';

beforeEach(() => {
  resetPrismaMock();
  jest
    .spyOn(profileService, 'checkAwardEligibility')
    .mockResolvedValue({ eligible: true, reason: '' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-type-admin';

function arrangeManager() {
  prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
    ...makeAdmin({ id: ADMIN_ID }),
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

function arrangeProposalCreate(id: string) {
  prismaMock.bangDeXuat.create.mockResolvedValueOnce({
    id,
    loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
    status: PROPOSAL_STATUS.PENDING,
    createdAt: new Date(),
    DonViTrucThuoc: null,
    CoQuanDonVi: { ten_don_vi: 'CQDV M' },
    NguoiDeXuat: { id: ADMIN_ID, username: 'admin', QuanNhan: null },
  });
}

describe('Type confusion — numeric vs string nam/thang', () => {
  it('nam = "2024" (string) → service parseInt, lưu number 2024', async () => {
    // Pin: submitProposal gọi parseInt(String(nam), 10) trước khi lưu
    arrangeManager();
    const target = makePersonnel({ id: 'qn-str-nam' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    arrangeProposalCreate('p-str-nam');

    await proposalService.submitProposal(
      [{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      null,      ADMIN_ID,
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      '2024' as unknown as number,
      null,
      null
    );

    expect(prismaMock.bangDeXuat.create.mock.calls[0][0].data.nam).toBe(2024);
  });

  it('thang = "06" (zero-padded string) cho HC_QKQT → service parseInt, lưu 6', async () => {
    arrangeManager();
    const target = makePersonnel({
      id: 'qn-zero-thang',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { ...target, ngay_xuat_ngu: null },
    ]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ ...target, ngay_xuat_ngu: null }]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-zero-thang',
      loai_de_xuat: PROPOSAL_TYPES.HC_QKQT,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: { ten_don_vi: 'CQDV M' },
      NguoiDeXuat: { id: ADMIN_ID, username: 'admin', QuanNhan: null },
    });

    await proposalService.submitProposal(
      [{ personnel_id: target.id, danh_hieu: PROPOSAL_TYPES.HC_QKQT }],
      null,      ADMIN_ID,
      PROPOSAL_TYPES.HC_QKQT,
      2024,
      null,
      '06' as unknown as number
    );

    expect(prismaMock.bangDeXuat.create.mock.calls[0][0].data.thang).toBe(6);
  });

  it('thang = "abc" (parseInt → NaN) cho HC_QKQT → service KHÔNG bắt NaN ở guard, fail muộn ở step khác', async () => {
    // Pin: `parsedMonth = parseInt('abc', 10)` ra NaN. Guard
    // `parsedMonth == null || parsedMonth < 1 || parsedMonth > 12` đánh giá false với NaN
    // (mọi so sánh NaN đều false), nên nhánh SUBMIT_MISSING_MONTH bị skip.
    // Flow rơi vào lookup eligibility HC_QKQT và surface lỗi khác.
    // TODO: thay `< 1 || > 12` bằng `!Number.isInteger(parsedMonth) || ...` để bắt NaN.
    arrangeManager();
    const target = makePersonnel({
      id: 'qn-bad-thang',
      ngay_nhap_ngu: new Date('1990-01-01'),
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);

    await expectError(
      proposalService.submitProposal(
        [{ personnel_id: target.id, danh_hieu: PROPOSAL_TYPES.HC_QKQT }],
        null,        ADMIN_ID,
        PROPOSAL_TYPES.HC_QKQT,
        2024,
        null,
        'abc' as unknown as number
      ),
      ValidationError,
      // Flow tới eligibility HC_QKQT — quanNhan.findUnique → null → "Không tìm thấy quân nhân"
      'Một số quân nhân chưa đủ điều kiện để đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= 25 năm phục vụ):\nqn-bad-thang: Không tìm thấy quân nhân'
    );
  });
});

describe('Type confusion — danh_hieu casing & duplicate detection', () => {
  it('danh_hieu = "cstdcs" (lowercase) trong CA_NHAN_HANG_NAM → reject INVALID_DANH_HIEU', async () => {
    // Pin: service so sánh exact code "CSTDCS" — chữ thường bị reject.
    // Excel import dùng resolveDanhHieuCode case-insensitive, nhưng proposal
    // submit KHÔNG normalize — route phải pre-validate.
    // TODO: Zod route enforce uppercase; normalize ở service sẽ kín kẽ hơn.
    arrangeManager();
    const target = makePersonnel({ id: 'qn-lower-dh' });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([target]);

    await expectError(
      proposalService.submitProposal(
        [{ personnel_id: target.id, danh_hieu: 'cstdcs' }],
        null,        ADMIN_ID,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      ),
      ValidationError,
      { startsWith: TYPE_CONFUSION_INVALID_DANH_HIEU_PREFIX }
    );
  });

  it('Duplicate check approve dùng exact code matching — "CSTDCS" vs "CSTDCS" (cùng case) → bắt', async () => {
    // Pin: input đúng case thì duplicate detection trên DanhHieuHangNam lưu sẵn hoạt động.
    const target = makePersonnel({ id: 'qn-dup-exact' });
    const existing = makeAnnualRecord({
      personnelId: target.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-EXIST',
    });
    const proposal = {
      id: 'p-dup-exact',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      nam: 2024,
      thang: null,
      data_danh_hieu: [
        {
          personnel_id: target.id,
          ho_ten: target.ho_ten,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        },
      ],
      data_thanh_tich: null,
      data_nien_han: null,
      data_cong_hien: null,
      nguoi_de_xuat_id: ADMIN_ID,
      CoQuanDonVi: { ten_don_vi: 'CQDV M' },
      DonViTrucThuoc: null,
      NguoiDeXuat: { id: ADMIN_ID, username: 'admin', QuanNhan: null },
    };
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: target.id, ho_ten: target.ho_ten },
    ]);
    // Approve CSTDCS cũng probe CSTT (loại trừ nhau) — cả 2 lookup đều trả existing.
    prismaMock.danhHieuHangNam.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing);
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      `${DUPLICATE_PREFIX}\n${target.ho_ten}: ${duplicateActualAnnualMessage(
        getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS),
        2024
      )}\n${target.ho_ten}: ${duplicateActualAnnualMessage(
        getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTT),
        2024
      )}`
    );
  });
});

describe('Type confusion — whitespace & empty string', () => {
  it('personnel_id = " qn-1 " (có space) → service KHÔNG trim, treat as ID khác', async () => {
    // Pin: submitProposal pass personnel_id nguyên xi vào `findMany({ id: { in: [...] }})`.
    // Mock không trả row nào cho giá trị đã trim vì ta chỉ set up qn-1.
    // TODO: trim personnel_id tại entry service để tránh lookup "không tìm thấy" thầm lặng.
    arrangeManager();
    prismaMock.quanNhan.findMany.mockResolvedValue([]); // " qn-1 " không match
    prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
    arrangeProposalCreate('p-space');

    await proposalService.submitProposal(
      [{ personnel_id: ' qn-1 ', danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      null,      ADMIN_ID,
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      2024,
      null,
      null
    );

    // Service lưu ID chưa trim và ho_ten = "" (vì personnelMap không match)
    const stored = prismaMock.bangDeXuat.create.mock.calls[0][0].data
      .data_danh_hieu as Array<{ personnel_id: string; ho_ten: string }>;
    expect(stored[0].personnel_id).toBe(' qn-1 ');
    expect(stored[0].ho_ten).toBe('');
  });

  it('personnel_id rỗng "" → service skip lookup nhưng vẫn lưu vào data_danh_hieu', async () => {
    // Pin: personnel_id rỗng bị filter khỏi findMany nhưng item proposal vẫn được lưu
    arrangeManager();
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    arrangeProposalCreate('p-empty');

    await proposalService.submitProposal(
      [{ personnel_id: '', danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      null,      ADMIN_ID,
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      2024,
      null,
      null
    );

    const stored = prismaMock.bangDeXuat.create.mock.calls[0][0].data
      .data_danh_hieu as Array<{ personnel_id: string; ho_ten: string }>;
    expect(stored[0].personnel_id).toBe('');
    expect(stored[0].ho_ten).toBe('');
  });
});
