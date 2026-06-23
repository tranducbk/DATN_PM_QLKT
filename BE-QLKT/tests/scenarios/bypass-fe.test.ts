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
import { ROLES } from '../../src/constants/roles.constants';
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

describe('Lách kiểm tra giao diện (gửi thẳng API): tấn công vào hình dạng dữ liệu gửi lên', () => {
  it('Lách kiểm tra giao diện (gửi thẳng API): danh sách danh hiệu = null → từ chối "Dữ liệu đề xuất không hợp lệ"', async () => {
    // Given: attacker submit JSON body với titleData = null tường minh
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

  it('Lách kiểm tra giao diện (gửi thẳng API): danh sách danh hiệu là chuỗi thay vì mảng → từ chối "Dữ liệu đề xuất không hợp lệ"', async () => {
    // Given: titleData là string nguyên thủy thay vì mảng
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

  it('Lách kiểm tra giao diện (gửi thẳng API): tài khoản người gửi không gắn quân nhân → báo "Không tìm thấy thông tin quân nhân"', async () => {
    // Given: tài khoản tồn tại nhưng không gắn QuanNhan
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-orphan',
      username: 'orphan',
      role: ROLES.ADMIN,
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

describe('Lách kiểm tra giao diện (gửi thẳng API): tấn công vào mốc biên năm và tháng', () => {
  it('Lách kiểm tra giao diện (gửi thẳng API): năm = -1 → tầng nghiệp vụ vẫn tạo đề xuất (chỉ chặn ở tầng giao diện)', async () => {
    // Note: Zod validation ở route layer; service không guard range `nam`.
    // Test này pin behavior hiện tại — xem "Rule mơ hồ phát hiện" trong audit report.
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

    // Service lưu nam = -1 nguyên xi — Joi ở route lẽ ra đã reject từ sớm.
    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bangDeXuat.create.mock.calls[0][0].data.nam).toBe(-1);
  });

  it('Lách kiểm tra giao diện (gửi thẳng API): năm = 9999 (tương lai xa) → tầng nghiệp vụ vẫn tạo đề xuất (chỉ chặn ở tầng giao diện)', async () => {
    // Pinned: service không guard năm tương lai xa.
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

  it('Lách kiểm tra giao diện (gửi thẳng API): HC QKQT với tháng = 0 → từ chối "Thiếu tháng đề xuất"', async () => {
    // HC_QKQT yêu cầu tháng [1, 12]; service reject 0
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

  it('Lách kiểm tra giao diện (gửi thẳng API): HC QKQT với tháng = 13 (ngoài 1-12) → từ chối "Thiếu tháng đề xuất"', async () => {
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

describe('Lách kiểm tra giao diện (gửi thẳng API): tham chiếu quân nhân/danh hiệu không hợp lệ', () => {
  it('Lách kiểm tra giao diện (gửi thẳng API): quân nhân không tồn tại → tầng nghiệp vụ vẫn tạo đề xuất nhưng họ tên để rỗng', async () => {
    // Service KHÔNG abort khi không tìm thấy QN; lưu ho_ten rỗng.
    // Guard ở route layer thường reject, nhưng service permissive.
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

    // Service vẫn tạo proposal — pin behavior hiện tại, xem audit report.
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.data_danh_hieu[0].ho_ten).toBe('');
  });

  it('Lách kiểm tra giao diện (gửi thẳng API): đề xuất cá nhân hằng năm với danh hiệu không có thật → từ chối "danh hiệu không hợp lệ"', async () => {
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

describe('Lách kiểm tra giao diện (gửi thẳng API): trộn nhóm danh hiệu xung khắc trong đề xuất cá nhân hằng năm', () => {
  it('Lách kiểm tra giao diện (gửi thẳng API): cùng quân nhân vừa CSTDCS vừa BKBQP (hai nhóm xung khắc) → từ chối', async () => {
    // Tự conflict: cùng QN xuất hiện 2 lần với 2 nhóm danh hiệu xung khắc
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

describe('Lách kiểm tra giao diện (gửi thẳng API): tấn công khi phê duyệt', () => {
  it('Phê duyệt bị chặn: duyệt một đề xuất không tồn tại → báo "Không tìm thấy đề xuất"', async () => {
    // Given: lookup trả null
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(null);

    await expectError(
      proposalService.approveProposal('p-ghost', {}, ADMIN_ID, {}, {}, null),
      NotFoundError,
      PROPOSAL_NOT_FOUND_ERROR
    );
  });

  it('Phê duyệt bị chặn: duyệt lại một đề xuất đã được phê duyệt trước đó → từ chối', async () => {
    // Given: proposal đã approved
    const proposal = makeProposal({
      id: 'p-already',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.APPROVED,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-submitter',
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);

    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      PROPOSAL_ALREADY_APPROVED_ERROR
    );
  });

  it('Phê duyệt bị chặn: duyệt đề xuất HC QKQT bị thiếu tháng → từ chối "Đề xuất thiếu tháng"', async () => {
    // Given: proposal lưu thiếu thang — guard re-check trước transaction
    const proposal = makeProposal({
      id: 'p-no-thang',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: null,
      nguoi_de_xuat_id: 'acc-submitter',
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

  it('Sửa dữ liệu sau khi gửi: đề xuất gốc sạch nhưng admin chèn thêm BKBQP cạnh CSTDCS lúc duyệt → vẫn bị chặn trộn nhóm', async () => {
    // Given: data lưu sạch nhưng editedData trộn CSTDCS với BKBQP
    const personnelA = makePersonnel({ id: 'qn-edit-A' });
    const cleanItem = makeProposalItemCaNhan({
      personnel_id: personnelA.id,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });
    const proposal = makeProposal({
      id: 'p-edit-mixed',
      loai: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-submitter',
      data_danh_hieu: [cleanItem],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnelA.id, ho_ten: personnelA.ho_ten },
    ]);

    // editedData chèn BKBQP cạnh CSTDCS đã có (cùng QN trong đề xuất gốc) — phải bị block
    await expectError(
      proposalService.approveProposal(
        proposal.id,
        {
          data_danh_hieu: [
            cleanItem,
            makeProposalItemCaNhan({
              personnel_id: personnelA.id,
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

  it('Sửa dữ liệu sau khi gửi: admin trộn ĐVQT + BKBQP đơn vị lúc duyệt đề xuất đơn vị hằng năm → từ chối trộn nhóm', async () => {
    // Given: proposal DON_VI_HANG_NAM có editedData trộn ĐVQT + BKBQP
    const cqdvA = makeUnit({ kind: 'CQDV', id: 'cqdv-edit-A' });
    const proposal = makeProposal({
      id: 'p-edit-unit-mixed',
      loai: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      nguoi_de_xuat_id: 'acc-submitter',
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
              don_vi_id: cqdvA.id,
              don_vi_type: 'CO_QUAN_DON_VI',
              ten_don_vi: cqdvA.ten_don_vi,
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
