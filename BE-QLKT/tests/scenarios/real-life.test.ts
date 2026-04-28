/**
 * Real-life award scenarios — assertions tied to exact production messages.
 *
 * Persona: chuyên gia khen thưởng quân đội. Each describe block walks through
 * a concrete operational case (gender boundary, lifetime award, chain rule)
 * and pins the exact reason string emitted by the service. Loose substring
 * matching is intentionally avoided so any wording drift fails the test.
 */

import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import {
  makePersonnel,
  makeAnnualRecord,
  makeThanhTichKhoaHoc,
  makeProposal,
  makeProposalItemCaNhan,
  makeAdmin,
} from '../helpers/fixtures';
import { expectError } from '../helpers/errorAssert';
import {
  eligibilityReasons,
  hcqkqtNotEnoughYears,
  kncNotEnoughYears,
} from '../helpers/errorMessages';

import profileService from '../../src/services/profile.service';
import proposalService from '../../src/services/proposal';
import { ValidationError } from '../../src/middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';

afterEach(() => {
  jest.restoreAllMocks();
});

const ADMIN_ID = 'acc-admin-real';

interface AnnualRow {
  nam: number;
  danh_hieu: string | null;
  so_quyet_dinh?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
}
interface ScienceRow {
  nam: number;
}

/** Builds personnel + history shape that profile.service consumes. */
function buildHistory(personnelId: string, dh: AnnualRow[], nckh: ScienceRow[]) {
  const base = makePersonnel({ id: personnelId });
  return {
    ...base,
    DanhHieuHangNam: dh.map(r => makeAnnualRecord({ personnelId, ...r })),
    ThanhTichKhoaHoc: nckh.map(r => makeThanhTichKhoaHoc({ personnelId, nam: r.nam })),
  };
}

/** Wires manager taiKhoan + personnel lookup for KNC submit calls. */
function arrangeKncSubmit(input: {
  managerId: string;
  target: ReturnType<typeof makePersonnel>;
  ngay_nhap_ngu: Date | null;
  ngay_xuat_ngu?: Date | null;
  gioi_tinh: 'NAM' | 'NU' | null;
}) {
  const account = makeAdmin({ id: input.managerId });
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
  prismaMock.quanNhan.findMany.mockResolvedValueOnce([
    {
      ...input.target,
      ngay_nhap_ngu: input.ngay_nhap_ngu,
      ngay_xuat_ngu: input.ngay_xuat_ngu ?? null,
    },
  ]);
  // checkDuplicateAward (KNC) — chưa có award, không có đề xuất pending
  prismaMock.kyNiemChuongVSNXDQDNDVN.findFirst.mockResolvedValueOnce(null);
  prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
  prismaMock.quanNhan.findMany.mockResolvedValueOnce([
    {
      ...input.target,
      gioi_tinh: input.gioi_tinh,
      ngay_nhap_ngu: input.ngay_nhap_ngu,
      ngay_xuat_ngu: input.ngay_xuat_ngu ?? null,
    },
  ]);
  prismaMock.bangDeXuat.create.mockResolvedValueOnce({
    id: 'p-knc',
    loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
    status: PROPOSAL_STATUS.PENDING,
    createdAt: new Date(),
    DonViTrucThuoc: null,
    CoQuanDonVi: { ten_don_vi: 'CQDV M' },
    NguoiDeXuat: { id: account.id, username: 'admin', QuanNhan: null },
  });
}

function callSubmitKnc(personnelId: string, managerId: string, nam = 2024, thang = 6) {
  return proposalService.submitProposal(
    [{ personnel_id: personnelId, danh_hieu: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN }],
    null,    managerId,
    PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
    nam,
    null,
    thang
  );
}

function callSubmitHcqkqt(personnelId: string, managerId: string, nam = 2024, thang = 6) {
  return proposalService.submitProposal(
    [{ personnel_id: personnelId, danh_hieu: PROPOSAL_TYPES.HC_QKQT }],
    null,    managerId,
    PROPOSAL_TYPES.HC_QKQT,
    nam,
    null,
    thang
  );
}

describe('Chuyên gia khen thưởng — KNC VSNXD QĐNDVN (gender boundary)', () => {
  it('QN nữ phục vụ đúng 20 năm → submit thành công', async () => {
    // Given: QN nữ nhập ngũ đúng 20 năm trước ngày đề xuất
    const target = makePersonnel({ id: 'qn-nu-20', ho_ten: 'Nguyễn Thị Hai' });
    const ngayNhapNgu = new Date('2004-06-30');
    arrangeKncSubmit({
      managerId: ADMIN_ID,
      target,
      ngay_nhap_ngu: ngayNhapNgu,
      gioi_tinh: 'NU',
    });

    // When + Then: 20 năm với nữ đạt KNC_YEARS_REQUIRED_NU
    await expect(callSubmitKnc(target.id, ADMIN_ID)).resolves.toMatchObject({
      message: 'Đã gửi đề xuất khen thưởng thành công',
    });
  });

  it('QN nữ 19 năm → submit reject với reason exact', async () => {
    // Given: QN nữ thiếu chút để đạt mốc 20 năm (xuat_ngu pin để ổn định)
    const target = makePersonnel({ id: 'qn-nu-19', ho_ten: 'Trần Thị Ba' });
    const ngayNhapNgu = new Date('2005-06-30');
    const ngayXuatNgu = new Date('2024-06-30');
    arrangeKncSubmit({
      managerId: ADMIN_ID,
      target,
      ngay_nhap_ngu: ngayNhapNgu,
      ngay_xuat_ngu: ngayXuatNgu,
      gioi_tinh: 'NU',
    });

    await expectError(
      callSubmitKnc(target.id, ADMIN_ID),
      ValidationError,
      `Một số quân nhân chưa đủ điều kiện để đề xuất Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN:\n${kncNotEnoughYears(target.ho_ten, 20, 228)}`
    );
    expect(prismaMock.bangDeXuat.create).not.toHaveBeenCalled();
  });

  it('QN nam phục vụ 24 năm → submit reject với reason exact (yêu cầu 25 năm)', async () => {
    // Given: QN nam thiếu mốc 25 năm
    const target = makePersonnel({ id: 'qn-nam-24', ho_ten: 'Lê Văn Bốn' });
    const ngayNhapNgu = new Date('2000-06-30');
    arrangeKncSubmit({
      managerId: ADMIN_ID,
      target,
      ngay_nhap_ngu: ngayNhapNgu,
      ngay_xuat_ngu: new Date('2024-06-30'),
      gioi_tinh: 'NAM',
    });

    // When + Then: nam 24 năm → không đủ điều kiện
    await expectError(
      callSubmitKnc(target.id, ADMIN_ID),
      ValidationError,
      `Một số quân nhân chưa đủ điều kiện để đề xuất Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN:\n${kncNotEnoughYears(target.ho_ten, 25, 288)}`
    );
  });

  it('QN nam phục vụ 25 năm → submit thành công', async () => {
    // Given: QN nam đạt mốc 25 năm
    const target = makePersonnel({ id: 'qn-nam-25', ho_ten: 'Phạm Văn Năm' });
    const ngayNhapNgu = new Date('1999-06-30');
    arrangeKncSubmit({
      managerId: ADMIN_ID,
      target,
      ngay_nhap_ngu: ngayNhapNgu,
      ngay_xuat_ngu: new Date('2024-06-30'),
      gioi_tinh: 'NAM',
    });

    await expect(callSubmitKnc(target.id, ADMIN_ID)).resolves.toMatchObject({
      message: 'Đã gửi đề xuất khen thưởng thành công',
    });
  });

  it('QN gioi_tinh = null → reject với "Chưa cập nhật thông tin giới tính"', async () => {
    // Given: QN thiếu giới tính — pre-validation KNC phải bắt được
    const target = makePersonnel({ id: 'qn-no-gender', ho_ten: 'Hoàng Văn Sáu' });
    const ngayNhapNgu = new Date('1995-01-01');
    arrangeKncSubmit({
      managerId: ADMIN_ID,
      target,
      ngay_nhap_ngu: ngayNhapNgu,
      gioi_tinh: null,
    });

    await expectError(
      callSubmitKnc(target.id, ADMIN_ID),
      ValidationError,
      `Một số quân nhân chưa đủ điều kiện để đề xuất Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN:\n${target.ho_ten}: Chưa cập nhật thông tin giới tính`
    );
  });

  it('QN có ngay_xuat_ngu sớm → tính tới ngày xuất ngũ, không phải refDate', async () => {
    // Given: QN nam xuất ngũ 2020 với 19 năm phục vụ — KHÔNG tính tới hôm nay
    const target = makePersonnel({ id: 'qn-xn', ho_ten: 'Đỗ Văn Bảy' });
    const ngayNhapNgu = new Date('2001-06-30');
    const ngayXuatNgu = new Date('2020-06-30');
    arrangeKncSubmit({
      managerId: ADMIN_ID,
      target,
      ngay_nhap_ngu: ngayNhapNgu,
      ngay_xuat_ngu: ngayXuatNgu,
      gioi_tinh: 'NAM',
    });

    await expectError(
      callSubmitKnc(target.id, ADMIN_ID),
      ValidationError,
      `Một số quân nhân chưa đủ điều kiện để đề xuất Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN:\n${kncNotEnoughYears(target.ho_ten, 25, 228)}`
    );
  });
});

describe('Chuyên gia khen thưởng — HCQKQT 25 năm boundary', () => {
  it('Submit fail khi 24 năm 11 tháng', async () => {
    // Given: QN nam thiếu chút để đạt mốc 25 năm
    const target = makePersonnel({ id: 'qn-hc-24-11', ho_ten: 'Nguyễn Văn Tám' });
    const account = makeAdmin({ id: 'acc-hc-1' });
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
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      {
        ...target,
        ngay_nhap_ngu: new Date('1999-07-01'),
        ngay_xuat_ngu: new Date('2024-06-01'),
      },
    ]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      {
        ...target,
        ngay_nhap_ngu: new Date('1999-07-01'),
        ngay_xuat_ngu: new Date('2024-06-01'),
      },
    ]);

    // When + Then: 24 năm 11 tháng < 25 năm
    await expectError(
      callSubmitHcqkqt(target.id, 'acc-hc-1'),
      ValidationError,
      `Một số quân nhân chưa đủ điều kiện để đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= 25 năm phục vụ):\n${hcqkqtNotEnoughYears(target.ho_ten, 299)}`
    );
  });

  it('Approve với QN 24 năm 11 tháng → reject với reason exact dùng formatServiceDuration', async () => {
    // Given: đề xuất HCQKQT bypass FE; approve phải re-validate điều kiện
    const target = makePersonnel({ id: 'qn-hc-approve' });
    const proposal = makeProposal({
      id: 'p-hcqkqt-fail',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: ADMIN_ID,
      data_nien_han: [
        {
          personnel_id: target.id,
          ho_ten: target.ho_ten,
          danh_hieu: PROPOSAL_TYPES.HC_QKQT,
        },
      ],
    });
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany
      .mockResolvedValueOnce([{ id: target.id, ho_ten: target.ho_ten }])
      .mockResolvedValueOnce([
        {
          id: target.id,
          ho_ten: target.ho_ten,
          ngay_nhap_ngu: new Date('1999-07-01'),
          ngay_xuat_ngu: new Date('2024-06-01'),
        },
      ]);
    // checkDuplicateAward(HC_QKQT) — chưa tồn tại
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce(null);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    // số tháng từ 1999-07 đến 2024-06 = (2024-1999)*12 + (5-6) = 299 → 24n 11t
    const expectedDuration = 299;
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      `Kiểm tra lại điều kiện trước khi phê duyệt thất bại:\n${hcqkqtNotEnoughYears(target.ho_ten, expectedDuration)}`
    );
    expect(prismaMock.huanChuongQuanKyQuyetThang.create).not.toHaveBeenCalled();
  });
});

describe('Chuyên gia khen thưởng — chuỗi BKBQP/CSTDTQ exact reasons', () => {
  it('CSTDCS năm 2022 + 2023 + NCKH đủ → eligible BKBQP với reason "Đủ điều kiện"', async () => {
    // Given: chuỗi CSTDCS liên tục 2 năm tối thiểu kèm NCKH đủ
    const personnelId = 'qn-real-bk-2y';
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildHistory(
        personnelId,
        [
          { nam: 2022, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2022' },
          { nam: 2023, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2023' },
        ],
        [{ nam: 2022 }, { nam: 2023 }]
      )
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.bkbqpEligible);
  });

  it('3y CSTDCS + 1 BKBQP TRONG streak → eligible CSTDTQ với reason exact', async () => {
    // Given: CSTDCS liên tục 3 năm, flag BKBQP ở năm thứ 2 của chuỗi
    const personnelId = 'qn-real-cs-3y';
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildHistory(
        personnelId,
        [
          { nam: 2021, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2021' },
          { nam: 2022, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2022', nhan_bkbqp: true, so_quyet_dinh_bkbqp: 'QDBK-2022' },
          { nam: 2023, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2023' },
        ],
        [{ nam: 2021 }, { nam: 2022 }, { nam: 2023 }]
      )
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.cstdtqEligible);
  });

  it('13 năm CSTDCS không "chưa hỗ trợ" — phải bám exact full reason', async () => {
    // Given: 13 năm CSTDCS liên tục (không flag chuỗi) — không chia hết 7 và không bằng 7
    const personnelId = 'qn-real-13y';
    const dh: AnnualRow[] = [];
    const nckh: ScienceRow[] = [];
    for (let y = 2011; y <= 2023; y++) {
      dh.push({ nam: y, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: `QD-CSTDCS-${y}` });
      nckh.push({ nam: y });
    }
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(buildHistory(personnelId, dh, nckh));

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    // Match chính xác — phát hiện mọi thay đổi câu chữ trong template reason
    expect(result.reason).toBe(eligibilityReasons.bkttcpMissedWindow(13));
  });
});

describe('Chuyên gia khen thưởng — duplicate one-time awards (HC_QKQT)', () => {
  it('QN đã có HC_QKQT → submit lại reject với message exact', async () => {
    // Given: đã có record HC_QKQT trong DB
    const target = makePersonnel({ id: 'qn-existing-hc' });
    const account = makeAdmin({ id: 'acc-hc-dup' });
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
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { ...target, ngay_nhap_ngu: new Date('1990-01-01'), ngay_xuat_ngu: null },
    ]);
    // Submit không gọi checkDuplicateAward cho HC_QKQT — nhưng approve có gọi.
    // Ta gọi approve để kiểm tra guard duplicate trọn đời.
    const proposal = makeProposal({
      id: 'p-hcqkqt-dup',
      loai: PROPOSAL_TYPES.HC_QKQT,
      nam: 2024,
      thang: 6,
      nguoi_de_xuat_id: account.id,
      data_nien_han: [
        { personnel_id: target.id, ho_ten: target.ho_ten, danh_hieu: PROPOSAL_TYPES.HC_QKQT },
      ],
    });
    resetPrismaMock();
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(proposal);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: target.id, ho_ten: target.ho_ten }]);
    prismaMock.huanChuongQuanKyQuyetThang.findFirst.mockResolvedValueOnce({
      id: 'hc-existing',
      quan_nhan_id: target.id,
      nam: 2018,
    });

    // When + Then
    await expectError(
      proposalService.approveProposal(proposal.id, {}, ADMIN_ID, {}, {}, null),
      ValidationError,
      `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${target.ho_ten}: Quân nhân đã có Huy chương Quân kỳ quyết thắng (năm 2018)`
    );
    expect(prismaMock.huanChuongQuanKyQuyetThang.create).not.toHaveBeenCalled();
  });
});
