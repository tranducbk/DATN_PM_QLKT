import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeUnit, makeAdmin } from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';

import proposalService from '../../src/services/proposal';
import profileService from '../../src/services/profile.service';
import { ValidationError, NotFoundError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';

beforeEach(() => {
  resetPrismaMock();
  // Default duplicate-check stubs: nothing exists in DB and no pending proposals.
  prismaMock.danhHieuHangNam.findFirst.mockResolvedValue(null);
  prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
  // Default chain-eligibility stub — overridden per-test for bypass scenarios.
  jest
    .spyOn(profileService, 'checkAwardEligibility')
    .mockResolvedValue({ eligible: true, reason: '' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

interface CaNhanItem {
  personnel_id: string;
  danh_hieu: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
}

function arrangeManagerWithUnit(unitKind: 'CQDV' | 'DVTT' = 'CQDV') {
  const unit = makeUnit({ kind: unitKind, id: unitKind === 'CQDV' ? 'cqdv-mgr' : 'dvtt-mgr' });
  const managerQn = makePersonnel({ unit, id: 'qn-manager', ho_ten: 'Manager A' });
  const account = makeAdmin({ id: 'acc-mgr-1', quanNhan: managerQn });
  prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
    ...account,
    QuanNhan: {
      ...managerQn,
      CoQuanDonVi: unit.kind === 'CQDV' ? unit.CoQuanDonVi : null,
      DonViTrucThuoc:
        unit.kind === 'DVTT'
          ? { ...unit.DonViTrucThuoc!, CoQuanDonVi: unit.DonViTrucThuoc!.CoQuanDonVi }
          : null,
    },
  });
  return { unit, managerQn, account };
}

function arrangePersonnelLookup(personnel: ReturnType<typeof makePersonnel>[]) {
  prismaMock.quanNhan.findMany.mockResolvedValueOnce(personnel);
}

function callSubmitCaNhan(items: CaNhanItem[], userId = 'acc-mgr-1', nam = 2024) {
  return proposalService.submitProposal(
    items,
    null,    userId,
    PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
    nam,
    null,
    null
  );
}

describe('proposal.submit - CA_NHAN_HANG_NAM', () => {
  it('gửi thành công với 1 item CSTDCS', async () => {
    // Given: a manager with a CQDV unit and one personnel target for CSTDCS
    const { account } = arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({ id: 'qn-T1', ho_ten: 'Nguyễn Văn A' });
    arrangePersonnelLookup([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'prop-1',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: { ten_don_vi: 'Đơn vị manager' },
      NguoiDeXuat: { id: account.id, username: account.username, QuanNhan: { id: 'qn-manager', ho_ten: 'Manager A' } },
    });

    // When
    await callSubmitCaNhan([
      { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
    ]);

    // Then
    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.loai_de_xuat).toBe(PROPOSAL_TYPES.CA_NHAN_HANG_NAM);
    expect(data.nam).toBe(2024);
    expect(data.status).toBe(PROPOSAL_STATUS.PENDING);
    expect(Array.isArray(data.data_danh_hieu)).toBe(true);
    expect(data.data_danh_hieu[0]).toMatchObject({
      personnel_id: target.id,
      ho_ten: 'Nguyễn Văn A',
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      nhan_bkbqp: false,
      nhan_cstdtq: false,
      nhan_bkttcp: false,
    });
  });

  it('gửi thành công BKBQP → auto-set `nhan_bkbqp: true`', async () => {
    // Given
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({ id: 'qn-BK' });
    arrangePersonnelLookup([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'prop-2',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: null,
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    // When
    await callSubmitCaNhan([
      { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP },
    ]);

    // Then: auto-set flags follow danh_hieu
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.data_danh_hieu[0]).toMatchObject({
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      nhan_bkbqp: true,
      nhan_cstdtq: false,
      nhan_bkttcp: false,
    });
  });

  it('gửi thành công CSTDTQ → auto-set `nhan_cstdtq: true`', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({ id: 'qn-CSTDTQ' });
    arrangePersonnelLookup([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: null,
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    await callSubmitCaNhan([
      { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ },
    ]);

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.data_danh_hieu[0]).toMatchObject({
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
      nhan_bkbqp: false,
      nhan_cstdtq: true,
      nhan_bkttcp: false,
    });
  });

  it('gửi thành công BKTTCP → auto-set `nhan_bkttcp: true`', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({ id: 'qn-BKTTCP' });
    arrangePersonnelLookup([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: null,
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    await callSubmitCaNhan([
      { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP },
    ]);

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.data_danh_hieu[0]).toMatchObject({
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
      nhan_bkbqp: false,
      nhan_cstdtq: false,
      nhan_bkttcp: true,
    });
  });

  it('bypass FE — reject mixed CSTDCS + BKBQP trong cùng đề xuất', async () => {
    // Given: two items, one base CSTDCS and one chain BKBQP
    arrangeManagerWithUnit('CQDV');
    const a = makePersonnel({ id: 'qn-A' });
    const b = makePersonnel({ id: 'qn-B' });
    arrangePersonnelLookup([a, b]);

    // When + Then
    await expectError(
      callSubmitCaNhan([
        { personnel_id: a.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
        { personnel_id: b.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP },
      ]),
      ValidationError,
      'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ/BKTTCP trong một đề xuất. Vui lòng tách thành các đề xuất riêng: một đề xuất cho CSTDCS/CSTT, và một đề xuất riêng cho BKBQP/CSTDTQ/BKTTCP.'
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('bypass FE — reject mixed CSTT + CSTDTQ trong cùng đề xuất', async () => {
    arrangeManagerWithUnit('CQDV');
    const a = makePersonnel({ id: 'qn-X' });
    const b = makePersonnel({ id: 'qn-Y' });
    arrangePersonnelLookup([a, b]);

    await expectError(
      callSubmitCaNhan([
        { personnel_id: a.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT },
        { personnel_id: b.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ },
      ]),
      ValidationError,
      'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ/BKTTCP trong một đề xuất. Vui lòng tách thành các đề xuất riêng: một đề xuất cho CSTDCS/CSTT, và một đề xuất riêng cho BKBQP/CSTDTQ/BKTTCP.'
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('bypass FE — duplicate cùng personnel + cùng danh_hieu ngay trong payload → reject', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({ id: 'qn-dup-in-payload' });
    arrangePersonnelLookup([target]);
    await expectError(
      callSubmitCaNhan(
        [
          { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
          { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
        ],
        'acc-mgr-1',
        2024
      ),
      ValidationError,
      { startsWith: 'Phát hiện dữ liệu bị lặp ngay trong payload đề xuất.\n' }
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('throw NotFoundError khi tài khoản không có QuanNhan', async () => {
    // Given: account exists but missing QuanNhan relation
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-no-qn',
      username: 'orphan',
      role: 'ADMIN',
      quan_nhan_id: null,
      QuanNhan: null,
    });

    await expectError(
      callSubmitCaNhan(
        [{ personnel_id: 'qn-1', danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
        'acc-no-qn'
      ),
      NotFoundError,
      'Thông tin quân nhân của tài khoản này không tồn tại'
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('reject khi `titleData` không phải mảng', async () => {
    arrangeManagerWithUnit('CQDV');

    await expectError(
      proposalService.submitProposal(
        // simulate a bypass-FE payload that is not an array
        null as unknown as CaNhanItem[],
        null,        'acc-mgr-1',
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        2024,
        null,
        null
      ),
      ValidationError,
      'Dữ liệu đề xuất không hợp lệ'
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('CQDV variant — proposal lưu `co_quan_don_vi_id`, `don_vi_truc_thuoc_id: null`', async () => {
    // Given: manager belongs to a CQDV unit
    const unit = makeUnit({ kind: 'CQDV', id: 'cqdv-77' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-cqdv',
      username: 'admin',
      role: 'ADMIN',
      QuanNhan: {
        id: 'qn-mgr-cqdv',
        ho_ten: 'Mgr',
        co_quan_don_vi_id: unit.id,
        don_vi_truc_thuoc_id: null,
        CoQuanDonVi: unit.CoQuanDonVi,
        DonViTrucThuoc: null,
      },
    });
    const target = makePersonnel({ id: 'qn-CQDV' });
    arrangePersonnelLookup([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-cqdv',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: unit.CoQuanDonVi,
      NguoiDeXuat: { id: 'acc-cqdv', username: 'admin', QuanNhan: null },
    });

    // When
    await callSubmitCaNhan(
      [{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      'acc-cqdv'
    );

    // Then: proposal row attaches co_quan_don_vi_id only
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.co_quan_don_vi_id).toBe(unit.id);
    expect(data.don_vi_truc_thuoc_id).toBeNull();
  });

  it('DVTT variant — proposal lưu `don_vi_truc_thuoc_id`, `co_quan_don_vi_id: null`', async () => {
    // Given: manager belongs to a DVTT unit
    const unit = makeUnit({ kind: 'DVTT', id: 'dvtt-99', parentId: 'cqdv-parent-99' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-dvtt',
      username: 'admin',
      role: 'ADMIN',
      QuanNhan: {
        id: 'qn-mgr-dvtt',
        ho_ten: 'Mgr',
        co_quan_don_vi_id: null,
        don_vi_truc_thuoc_id: unit.id,
        CoQuanDonVi: null,
        DonViTrucThuoc: unit.DonViTrucThuoc,
      },
    });
    const target = makePersonnel({ id: 'qn-DVTT-target', unitKind: 'DVTT' });
    arrangePersonnelLookup([target]);
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-dvtt',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: unit.DonViTrucThuoc,
      CoQuanDonVi: null,
      NguoiDeXuat: { id: 'acc-dvtt', username: 'admin', QuanNhan: null },
    });

    await callSubmitCaNhan(
      [{ personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }],
      'acc-dvtt'
    );

    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.don_vi_truc_thuoc_id).toBe(unit.id);
    expect(data.co_quan_don_vi_id).toBeNull();
  });

  it('titleData rỗng → vẫn tạo proposal với `data_danh_hieu: []`', async () => {
    // Empty array passes the `Array.isArray` guard and skips the personnel lookup branch
    arrangeManagerWithUnit('CQDV');
    prismaMock.bangDeXuat.create.mockResolvedValueOnce({
      id: 'p-empty',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: PROPOSAL_STATUS.PENDING,
      createdAt: new Date(),
      DonViTrucThuoc: null,
      CoQuanDonVi: null,
      NguoiDeXuat: { id: 'acc-mgr-1', username: 'admin', QuanNhan: null },
    });

    await callSubmitCaNhan([]);

    expect(prismaMock.bangDeXuat.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.bangDeXuat.create.mock.calls[0][0].data;
    expect(data.data_danh_hieu).toEqual([]);
    // CA_NHAN_HANG_NAM is not in PROPOSAL_TYPES_REQUIRING_MONTH, so thang stays null
    expect(data.thang).toBeNull();
  });

  // CA_NHAN_HANG_NAM is not in PROPOSAL_TYPES_REQUIRING_MONTH (NIEN_HAN, HC_QKQT,
  // KNC_VSNXD_QDNDVN, CONG_HIEN), so the missing-month branch never fires for this type.

  it('bypass FE — reject duplicate khi đã có danh hiệu cùng năm trong DB', async () => {
    // Given: an existing CSTDCS award for this personnel/year already in DB
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({ id: 'qn-dup', ho_ten: 'Trần Văn Dup' });
    arrangePersonnelLookup([target]);
    prismaMock.danhHieuHangNam.findFirst.mockReset();
    prismaMock.danhHieuHangNam.findFirst.mockResolvedValueOnce({
      id: 'existing-1',
      quan_nhan_id: target.id,
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    });

    // When + Then
    const dupErr = await expectError(
      callSubmitCaNhan([
        { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
      ]),
      ValidationError,
      { startsWith: 'Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n' }
    );
    expect(dupErr.message).toBe(
      `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${target.ho_ten}: Quân nhân đã có danh hiệu Chiến sĩ thi đua cơ sở năm 2024 trên hệ thống`
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('bypass FE — reject khi quân nhân chưa đủ ĐK BKBQP', async () => {
    // Given: eligibility check returns ineligible for BKBQP chain
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({ id: 'qn-not-elig-bk', ho_ten: 'Nguyễn Chưa Đủ' });
    arrangePersonnelLookup([target]);
    (profileService.checkAwardEligibility as jest.Mock).mockReset();
    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKBQP: cần 2 năm CSTDCS liên tục',
    });

    // When + Then
    const eligErr = await expectError(
      callSubmitCaNhan([
        { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP },
      ]),
      ValidationError,
      { startsWith: 'Một số quân nhân chưa đủ điều kiện:\n' }
    );
    expect(eligErr.message).toBe(
      `Một số quân nhân chưa đủ điều kiện:\n${target.ho_ten}: Chưa đủ điều kiện BKBQP: cần 2 năm CSTDCS liên tục`
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('bypass FE — reject khi quân nhân chưa đủ ĐK CSTDTQ', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({ id: 'qn-not-elig-cs', ho_ten: 'Lê Chưa Đủ' });
    arrangePersonnelLookup([target]);
    (profileService.checkAwardEligibility as jest.Mock).mockReset();
    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện CSTDTQ: cần 3 năm CSTDCS liên tục',
    });

    const eligCsErr = await expectError(
      callSubmitCaNhan([
        { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ },
      ]),
      ValidationError,
      { startsWith: 'Một số quân nhân chưa đủ điều kiện:\n' }
    );
    expect(eligCsErr.message).toBe(
      `Một số quân nhân chưa đủ điều kiện:\n${target.ho_ten}: Chưa đủ điều kiện CSTDTQ: cần 3 năm CSTDCS liên tục`
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('bypass FE — reject khi quân nhân chưa đủ ĐK BKTTCP', async () => {
    arrangeManagerWithUnit('CQDV');
    const target = makePersonnel({ id: 'qn-not-elig-bkttcp', ho_ten: 'Phạm Chưa Đủ' });
    arrangePersonnelLookup([target]);
    (profileService.checkAwardEligibility as jest.Mock).mockReset();
    (profileService.checkAwardEligibility as jest.Mock).mockResolvedValueOnce({
      eligible: false,
      reason: 'Chưa đủ điều kiện BKTTCP: cần 7 năm CSTDCS',
    });

    const eligBkttcpErr = await expectError(
      callSubmitCaNhan([
        { personnel_id: target.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP },
      ]),
      ValidationError,
      { startsWith: 'Một số quân nhân chưa đủ điều kiện:\n' }
    );
    expect(eligBkttcpErr.message).toBe(
      `Một số quân nhân chưa đủ điều kiện:\n${target.ho_ten}: Chưa đủ điều kiện BKTTCP: cần 7 năm CSTDCS`
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });
});
