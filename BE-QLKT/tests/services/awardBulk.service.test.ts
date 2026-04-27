import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import awardBulkService from '../../src/services/awardBulk.service';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_HCCSVV,
  DANH_HIEU_HCBVTQ,
  getDanhHieuName,
} from '../../src/constants/danhHieu.constants';
import {
  hcbvtqBulkDowngradeBlocked,
  hcbvtqBulkDuplicateBlocked,
  HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT,
} from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('awardBulk.service - checkDuplicateAwards (cá nhân)', () => {
  it('detect trùng APPROVED record cùng năm + cùng danh hiệu (CA_NHAN_HANG_NAM)', async () => {
    // Cho: đã có CSTDCS cho personnel A năm 2024
    const personnelA = { id: 'qn-A', ho_ten: 'Nguyễn Văn A' };
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnelA]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([
      { quan_nhan_id: personnelA.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
    ]);

    // Khi
    const errors = await awardBulkService.checkDuplicateAwards(
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      2024,
      [{ personnel_id: personnelA.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }]
    );

    // Thì: error tham chiếu record đã có bằng họ tên đầy đủ
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Nguyễn Văn A: Chiến sĩ thi đua cơ sở năm 2024 đã có trên hệ thống');
  });

  it('detect pending proposal cùng năm + cùng danh hiệu (CA_NHAN_HANG_NAM)', async () => {
    const personnelA = { id: 'qn-A', ho_ten: 'Trần Thị B' };
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnelA]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'p-1',
        data_danh_hieu: [
          { personnel_id: personnelA.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
        ],
      },
    ]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);

    const errors = await awardBulkService.checkDuplicateAwards(
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      2024,
      [{ personnel_id: personnelA.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }]
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Trần Thị B: đang có đề xuất chờ duyệt');
  });

  it('không trùng → trả mảng rỗng', async () => {
    const personnelA = { id: 'qn-A', ho_ten: 'A' };
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnelA]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]);

    const errors = await awardBulkService.checkDuplicateAwards(
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      2024,
      [{ personnel_id: personnelA.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS }]
    );

    expect(errors).toEqual([]);
  });

  it('one-time HC_QKQT — match theo personnel, không quan tâm danh_hieu', async () => {
    // Cho: personnel đã có record HC_QKQT bất kỳ
    const personnelA = { id: 'qn-A', ho_ten: 'Phạm C' };
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnelA]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.huanChuongQuanKyQuyetThang.findMany.mockResolvedValueOnce([
      { quan_nhan_id: personnelA.id },
    ]);

    // Khi: request HC_QKQT cho cùng personnel (danh_hieu có thể rỗng)
    const errors = await awardBulkService.checkDuplicateAwards(
      PROPOSAL_TYPES.HC_QKQT,
      2024,
      [{ personnel_id: personnelA.id, danh_hieu: 'HC_QKQT' }]
    );

    // Thì: bị chặn vì personnel đã có huân chương
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Phạm C: đã có Huy chương Quân kỳ quyết thắng trên hệ thống');
  });

  it('one-time KNC_VSNXD_QDNDVN — match theo personnel', async () => {
    const personnelA = { id: 'qn-A', ho_ten: 'Lê D' };
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnelA]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.kyNiemChuongVSNXDQDNDVN.findMany.mockResolvedValueOnce([
      { quan_nhan_id: personnelA.id },
    ]);

    const errors = await awardBulkService.checkDuplicateAwards(
      PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      2024,
      [{ personnel_id: personnelA.id, danh_hieu: 'KNC_VSNXD_QDNDVN' }]
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Lê D: đã có Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN trên hệ thống');
  });

  it('one-time CONG_HIEN (HCBVTQ) — match theo personnel', async () => {
    const personnelA = { id: 'qn-A', ho_ten: 'Hoàng E' };
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnelA]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([
      { quan_nhan_id: personnelA.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA },
    ]);

    // Even when the request asks for a higher rank, the lifetime guard fires
    const errors = await awardBulkService.checkDuplicateAwards(
      PROPOSAL_TYPES.CONG_HIEN,
      2024,
      [{ personnel_id: personnelA.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT }]
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(
      'Hoàng E: đã có Huân chương Bảo vệ Tổ quốc hạng Nhất trên hệ thống'
    );
  });

  it('mix 1 trùng + 1 không trùng → trả đúng 1 lỗi', async () => {
    // Given: personnel B has the existing record, A is clear
    const personnelA = { id: 'qn-A', ho_ten: 'A' };
    const personnelB = { id: 'qn-B', ho_ten: 'B' };
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnelA, personnelB]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([
      { quan_nhan_id: personnelB.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
    ]);

    const errors = await awardBulkService.checkDuplicateAwards(
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      2024,
      [
        { personnel_id: personnelA.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
        { personnel_id: personnelB.id, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
      ]
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('B: Chiến sĩ thi đua cơ sở năm 2024 đã có trên hệ thống');
  });

  it('NIEN_HAN — detect existing HCCSVV cùng danh_hieu', async () => {
    const personnelA = { id: 'qn-A', ho_ten: 'A' };
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([personnelA]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCCSVV.findMany.mockResolvedValueOnce([
      { quan_nhan_id: personnelA.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA },
    ]);

    const errors = await awardBulkService.checkDuplicateAwards(
      PROPOSAL_TYPES.NIEN_HAN,
      2024,
      [{ personnel_id: personnelA.id, danh_hieu: DANH_HIEU_HCCSVV.HANG_BA }]
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('A: đã có Huy chương Chiến sĩ vẻ vang hạng Ba trên hệ thống');
  });
});

describe('awardBulk.service - checkDuplicateUnitAwards', () => {
  it('detect existing ĐVQT (CQDV) cùng năm', async () => {
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([
      {
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: null,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        nhan_bkbqp: false,
        nhan_bkttcp: false,
      },
    ]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const errors = await awardBulkService.checkDuplicateUnitAwards(2024, [
      { personnel_id: '', don_vi_id: 'cqdv-1', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT },
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Đơn vị đã có danh hiệu Đơn vị quyết thắng năm 2024');
  });

  it('mutual exclusion: ĐVQT đã có → reject thêm ĐVTT cùng năm', async () => {
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([
      {
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: null,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        nhan_bkbqp: false,
        nhan_bkttcp: false,
      },
    ]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const errors = await awardBulkService.checkDuplicateUnitAwards(2024, [
      { personnel_id: '', don_vi_id: 'cqdv-1', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVTT },
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(
      'Đơn vị đã có Đơn vị quyết thắng năm 2024, không thể thêm Đơn vị tiên tiến'
    );
  });

  it('pending proposal conflict → reject', async () => {
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      {
        id: 'p-1',
        data_danh_hieu: [
          { don_vi_id: 'cqdv-1', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT },
        ],
      },
    ]);

    const errors = await awardBulkService.checkDuplicateUnitAwards(2024, [
      { personnel_id: '', don_vi_id: 'cqdv-1', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT },
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe('Đơn vị đã có đề xuất Đơn vị quyết thắng cho năm 2024');
  });

  it('phân biệt CQDV vs DVTT — record DVTT không trùng với request CQDV', async () => {
    // Given: existing DVTT record only — request targets CQDV with different id
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([
      {
        co_quan_don_vi_id: null,
        don_vi_truc_thuoc_id: 'dvtt-99',
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        nhan_bkbqp: false,
        nhan_bkttcp: false,
      },
    ]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    // When: request for cqdv-1 with no matching record
    const errors = await awardBulkService.checkDuplicateUnitAwards(2024, [
      { personnel_id: '', don_vi_id: 'cqdv-1', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT },
    ]);

    // Then: no error — different unit ids do not collide
    expect(errors).toEqual([]);
  });

  it('reject thêm BKBQP khi đơn vị đã có BKBQP', async () => {
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([
      {
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: null,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        nhan_bkbqp: true,
        nhan_bkttcp: false,
      },
    ]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);

    const errors = await awardBulkService.checkDuplicateUnitAwards(2024, [
      { personnel_id: '', don_vi_id: 'cqdv-1', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP },
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(
      'Đơn vị đã có Bằng khen của Bộ trưởng Bộ Quốc phòng năm 2024'
    );
  });
});

describe('awardBulk.service - bulkCreateAwards CONG_HIEN — rank upgrade guard', () => {
  const HCBVTQ_BULK_ADMIN_ID = 'acc-admin-bulk-hcbvtq';

  /**
   * Stages mocks for the path that runs BEFORE the rank-upgrade guard:
   * `checkDuplicateAwards` (3 mocks) and the CONG_HIEN block setup
   * (`quanNhan.findMany` + `lichSuChucVu.findMany`).
   */
  function HCBVTQ_BULK_stagePreGuardMocks(
    personnel: { id: string; ho_ten: string },
    options: { he_so?: number; so_thang?: number } = {}
  ) {
    const heSo = options.he_so ?? 1.0;
    const soThang = options.so_thang ?? 240;
    // checkDuplicateAwards — empty so the lifetime guard does not preempt the test
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);

    // CONG_HIEN eligibility setup — caller controls hệ số/tháng to pin highest qualifying rank
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: personnel.id,
        he_so_chuc_vu: heSo,
        so_thang: soThang,
        ngay_bat_dau: new Date('2000-01-01'),
        ngay_ket_thuc: new Date('2020-01-01'),
      },
    ]);
  }

  function HCBVTQ_BULK_buildItem(personnelId: string, danhHieu: string) {
    return {
      personnel_id: personnelId,
      danh_hieu: danhHieu,
      cap_bac: 'Đại uý',
      chuc_vu: 'Trợ lý',
      so_quyet_dinh: 'QD-BULK-1',
    };
  }

  function HCBVTQ_BULK_callBulk(personnelIds: string[], items: Array<{ personnel_id: string; danh_hieu: string }>) {
    return awardBulkService.bulkCreateAwards({
      type: PROPOSAL_TYPES.CONG_HIEN,
      nam: 2024,
      thang: 6,
      selectedPersonnel: personnelIds,
      titleData: items as any,
      ghiChu: null,
      adminId: HCBVTQ_BULK_ADMIN_ID,
    });
  }

  it('upgrade HANG_BA → HANG_NHI: ghi đè hợp lệ, không lỗi', async () => {
    const qn = { id: 'qn-bulk-A', ho_ten: 'Nguyễn Văn A' };
    HCBVTQ_BULK_stagePreGuardMocks(qn, { he_so: 0.8, so_thang: 130 });
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([
      { quan_nhan_id: qn.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA },
    ]);
    prismaMock.khenThuongHCBVTQ.upsert.mockResolvedValueOnce({ id: 'kt-1' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ username: 'admin' });

    const result = await HCBVTQ_BULK_callBulk(
      [qn.id],
      [HCBVTQ_BULK_buildItem(qn.id, DANH_HIEU_HCBVTQ.HANG_NHI)]
    );

    expect(result.data.importedCount).toBe(1);
    expect(result.data.errorCount).toBe(0);
    expect(prismaMock.khenThuongHCBVTQ.upsert).toHaveBeenCalledTimes(1);
  });

  it('upgrade HANG_NHI → HANG_NHAT: hợp lệ', async () => {
    const qn = { id: 'qn-bulk-B', ho_ten: 'Trần Thị B' };
    HCBVTQ_BULK_stagePreGuardMocks(qn);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([
      { quan_nhan_id: qn.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI },
    ]);
    prismaMock.khenThuongHCBVTQ.upsert.mockResolvedValueOnce({ id: 'kt-2' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ username: 'admin' });

    const result = await HCBVTQ_BULK_callBulk(
      [qn.id],
      [HCBVTQ_BULK_buildItem(qn.id, DANH_HIEU_HCBVTQ.HANG_NHAT)]
    );

    expect(result.data.importedCount).toBe(1);
    expect(result.data.errorCount).toBe(0);
  });

  it('downgrade HANG_NHI → HANG_BA: chặn, không upsert', async () => {
    const qn = { id: 'qn-bulk-C', ho_ten: 'Phạm C' };
    HCBVTQ_BULK_stagePreGuardMocks(qn);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([
      { quan_nhan_id: qn.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI },
    ]);

    await expect(
      HCBVTQ_BULK_callBulk(
        [qn.id],
        [HCBVTQ_BULK_buildItem(qn.id, DANH_HIEU_HCBVTQ.HANG_BA)]
      )
    ).rejects.toThrow(
      hcbvtqBulkDowngradeBlocked(
        qn.ho_ten,
        getDanhHieuName(DANH_HIEU_HCBVTQ.HANG_NHI),
        getDanhHieuName(DANH_HIEU_HCBVTQ.HANG_BA)
      )
    );
    expect(prismaMock.khenThuongHCBVTQ.upsert).not.toHaveBeenCalled();
  });

  it('downgrade HANG_NHAT → HANG_BA: chặn', async () => {
    const qn = { id: 'qn-bulk-D', ho_ten: 'Lê D' };
    HCBVTQ_BULK_stagePreGuardMocks(qn);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([
      { quan_nhan_id: qn.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT },
    ]);

    await expect(
      HCBVTQ_BULK_callBulk(
        [qn.id],
        [HCBVTQ_BULK_buildItem(qn.id, DANH_HIEU_HCBVTQ.HANG_BA)]
      )
    ).rejects.toThrow(
      hcbvtqBulkDowngradeBlocked(
        qn.ho_ten,
        getDanhHieuName(DANH_HIEU_HCBVTQ.HANG_NHAT),
        getDanhHieuName(DANH_HIEU_HCBVTQ.HANG_BA)
      )
    );
    expect(prismaMock.khenThuongHCBVTQ.upsert).not.toHaveBeenCalled();
  });

  it('cùng hạng HANG_NHI → HANG_NHI: chặn "thêm trùng"', async () => {
    const qn = { id: 'qn-bulk-E', ho_ten: 'Hoàng E' };
    HCBVTQ_BULK_stagePreGuardMocks(qn);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([
      { quan_nhan_id: qn.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHI },
    ]);

    await expect(
      HCBVTQ_BULK_callBulk(
        [qn.id],
        [HCBVTQ_BULK_buildItem(qn.id, DANH_HIEU_HCBVTQ.HANG_NHI)]
      )
    ).rejects.toThrow(
      hcbvtqBulkDuplicateBlocked(
        qn.ho_ten,
        getDanhHieuName(DANH_HIEU_HCBVTQ.HANG_NHI),
        getDanhHieuName(DANH_HIEU_HCBVTQ.HANG_NHI)
      )
    );
    expect(prismaMock.khenThuongHCBVTQ.upsert).not.toHaveBeenCalled();
  });

  it('chưa có HCBVTQ + HANG_NHAT: tạo mới hợp lệ', async () => {
    const qn = { id: 'qn-bulk-F', ho_ten: 'Vũ F' };
    HCBVTQ_BULK_stagePreGuardMocks(qn);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCBVTQ.upsert.mockResolvedValueOnce({ id: 'kt-3' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ username: 'admin' });

    const result = await HCBVTQ_BULK_callBulk(
      [qn.id],
      [HCBVTQ_BULK_buildItem(qn.id, DANH_HIEU_HCBVTQ.HANG_NHAT)]
    );

    expect(result.data.importedCount).toBe(1);
    expect(result.data.errorCount).toBe(0);
  });

  it('mix 1 upgrade hợp lệ + 1 downgrade: upgrade thành công, downgrade ghi vào errors', async () => {
    const qnA = { id: 'qn-bulk-G1', ho_ten: 'Quân Nhân G1' };
    const qnB = { id: 'qn-bulk-G2', ho_ten: 'Quân Nhân G2' };

    // checkDuplicateAwards mocks (existingAwards must be empty so lifetime guard skips)
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: qnA.id, ho_ten: qnA.ho_ten },
      { id: qnB.id, ho_ten: qnB.ho_ten },
    ]);
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);

    // CONG_HIEN eligibility setup
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([
      { id: qnA.id, ho_ten: qnA.ho_ten, gioi_tinh: 'NAM' },
      { id: qnB.id, ho_ten: qnB.ho_ten, gioi_tinh: 'NAM' },
    ]);
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
      {
        quan_nhan_id: qnA.id,
        he_so_chuc_vu: 0.8,
        so_thang: 130,
        ngay_bat_dau: new Date('2000-01-01'),
        ngay_ket_thuc: new Date('2020-01-01'),
      },
      {
        quan_nhan_id: qnB.id,
        he_so_chuc_vu: 1.0,
        so_thang: 240,
        ngay_bat_dau: new Date('2000-01-01'),
        ngay_ket_thuc: new Date('2020-01-01'),
      },
    ]);

    // Rank guard query — A has HANG_BA (upgrade to NHI), B has HANG_NHAT (downgrade attempt)
    prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([
      { quan_nhan_id: qnA.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_BA },
      { quan_nhan_id: qnB.id, danh_hieu: DANH_HIEU_HCBVTQ.HANG_NHAT },
    ]);
    prismaMock.khenThuongHCBVTQ.upsert.mockResolvedValueOnce({ id: 'kt-A' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ username: 'admin' });

    const result = await HCBVTQ_BULK_callBulk(
      [qnA.id, qnB.id],
      [
        HCBVTQ_BULK_buildItem(qnA.id, DANH_HIEU_HCBVTQ.HANG_NHI),
        HCBVTQ_BULK_buildItem(qnB.id, DANH_HIEU_HCBVTQ.HANG_BA),
      ]
    );

    expect(result.data.importedCount).toBe(1);
    expect(result.data.errorCount).toBe(1);
    expect(prismaMock.khenThuongHCBVTQ.upsert).toHaveBeenCalledTimes(1);
  });

  describe('highest qualifying rank guard', () => {
    function HCBVTQ_BULK_HIGHEST_stage(
      personnel: { id: string; ho_ten: string },
      heSo: number,
      soThang: number
    ) {
      prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: personnel.id, ho_ten: personnel.ho_ten }]);
      prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
      prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);
      prismaMock.quanNhan.findMany.mockResolvedValueOnce([
        { id: personnel.id, ho_ten: personnel.ho_ten, gioi_tinh: 'NAM' },
      ]);
      prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([
        {
          quan_nhan_id: personnel.id,
          he_so_chuc_vu: heSo,
          so_thang: soThang,
          ngay_bat_dau: new Date('2000-01-01'),
          ngay_ket_thuc: new Date('2020-01-01'),
        },
      ]);
      prismaMock.khenThuongHCBVTQ.findMany.mockResolvedValueOnce([]);
    }

    it('QN đủ ĐK HANG_NHAT (m_0910 = 200) + admin bulk HANG_BA → reject', async () => {
      const qn = { id: 'qn-highest-1', ho_ten: 'Test Highest 1' };
      HCBVTQ_BULK_HIGHEST_stage(qn, 1.0, 200);

      await expect(
        HCBVTQ_BULK_callBulk(
          [qn.id],
          [HCBVTQ_BULK_buildItem(qn.id, DANH_HIEU_HCBVTQ.HANG_BA)]
        )
      ).rejects.toThrow(HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT);
      expect(prismaMock.khenThuongHCBVTQ.upsert).not.toHaveBeenCalled();
    });

    it('QN đủ ĐK HANG_NHAT + admin bulk HANG_NHI → reject', async () => {
      const qn = { id: 'qn-highest-2', ho_ten: 'Test Highest 2' };
      HCBVTQ_BULK_HIGHEST_stage(qn, 1.0, 200);

      await expect(
        HCBVTQ_BULK_callBulk(
          [qn.id],
          [HCBVTQ_BULK_buildItem(qn.id, DANH_HIEU_HCBVTQ.HANG_NHI)]
        )
      ).rejects.toThrow(HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT);
      expect(prismaMock.khenThuongHCBVTQ.upsert).not.toHaveBeenCalled();
    });

    it('QN đủ ĐK HANG_NHAT + admin bulk HANG_NHAT → success', async () => {
      const qn = { id: 'qn-highest-3', ho_ten: 'Test Highest 3' };
      HCBVTQ_BULK_HIGHEST_stage(qn, 1.0, 200);
      prismaMock.khenThuongHCBVTQ.upsert.mockResolvedValueOnce({ id: 'kt-h-3' });
      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ username: 'admin' });

      const result = await HCBVTQ_BULK_callBulk(
        [qn.id],
        [HCBVTQ_BULK_buildItem(qn.id, DANH_HIEU_HCBVTQ.HANG_NHAT)]
      );

      expect(result.data.importedCount).toBe(1);
      expect(result.data.errorCount).toBe(0);
    });

    it('QN đủ ĐK HANG_BA only (m_07 = 200) + admin bulk HANG_BA → success', async () => {
      const qn = { id: 'qn-highest-4', ho_ten: 'Test Highest 4' };
      HCBVTQ_BULK_HIGHEST_stage(qn, 0.7, 200);
      prismaMock.khenThuongHCBVTQ.upsert.mockResolvedValueOnce({ id: 'kt-h-4' });
      prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ username: 'admin' });

      const result = await HCBVTQ_BULK_callBulk(
        [qn.id],
        [HCBVTQ_BULK_buildItem(qn.id, DANH_HIEU_HCBVTQ.HANG_BA)]
      );

      expect(result.data.importedCount).toBe(1);
      expect(result.data.errorCount).toBe(0);
    });
  });
});

describe('awardBulk.service - success message', () => {
  it('DON_VI_HANG_NAM partial success chỉ đếm đơn vị thêm thành công', async () => {
    jest.spyOn(awardBulkService, 'checkDuplicateUnitAwards').mockResolvedValueOnce([]);
    jest.spyOn(unitAnnualAwardService, 'upsert')
      .mockResolvedValueOnce({ id: 'unit-award-1' } as never)
      .mockRejectedValueOnce(new Error('Lỗi giả lập'));
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(null);

    const result = await awardBulkService.bulkCreateAwards({
      type: PROPOSAL_TYPES.DON_VI_HANG_NAM,
      nam: 2024,
      selectedUnits: ['dv-1', 'dv-2'],
      selectedPersonnel: [],
      titleData: [
        { personnel_id: '', don_vi_id: 'dv-1', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT },
        { personnel_id: '', don_vi_id: 'dv-2', danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT },
      ] as any,
      ghiChu: null,
      adminId: 'admin-msg-1',
    });

    expect(result.data.importedCount).toBe(1);
    expect(result.data.errorCount).toBe(1);
    expect(result.message).toBe('Đã thêm thành công 1 danh hiệu cho 1 đơn vị, 1 lỗi');
  });
});
