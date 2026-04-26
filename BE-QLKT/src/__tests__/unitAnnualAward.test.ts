/**
 * Tests for DanhHieuDonViHangNam (unit annual awards).
 */
import { prisma } from '../models';
import unitAnnualAwardService from '../services/unitAnnualAward.service';
import { getDanhHieuName, DANH_HIEU_DON_VI_HANG_NAM } from '../constants/danhHieu.constants';

const P = 'test_unit_award_';
let unitId: string;
let adminId: string;

beforeAll(async () => {
  const unit = await prisma.coQuanDonVi.create({
    data: { id: `${P}unit`, ma_don_vi: `${P}U`, ten_don_vi: 'Đơn vị Test' },
  });
  unitId = unit.id;

  // Create admin account for nguoi_tao_id
  const admin = await prisma.taiKhoan.create({
    data: { id: `${P}admin`, username: `${P}admin`, password_hash: 'x', role: 'ADMIN' },
  });
  adminId = admin.id;
});

afterAll(async () => {
  await prisma.danhHieuDonViHangNam.deleteMany({ where: { co_quan_don_vi_id: unitId } });
  await prisma.hoSoDonViHangNam.deleteMany({ where: { co_quan_don_vi_id: unitId } });
  await prisma.taiKhoan.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.coQuanDonVi.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.danhHieuDonViHangNam.deleteMany({ where: { co_quan_don_vi_id: unitId } });
  await prisma.hoSoDonViHangNam.deleteMany({ where: { co_quan_don_vi_id: unitId } });
});

async function addDVQT(year: number) {
  await prisma.danhHieuDonViHangNam.upsert({
    where: { unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: unitId, nam: year } },
    create: { co_quan_don_vi_id: unitId, nam: year, danh_hieu: 'ĐVQT', status: 'APPROVED', nguoi_tao_id: adminId },
    update: { danh_hieu: 'ĐVQT' },
  });
}

async function addUnitBKBQP(year: number) {
  await prisma.danhHieuDonViHangNam.update({
    where: { unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: unitId, nam: year } },
    data: { nhan_bkbqp: true, so_quyet_dinh_bkbqp: `QDBK${year}` },
  });
}

describe('Đơn vị — ĐVQT liên tục', () => {
  it('1 năm ĐVQT → liên tục = 1', async () => {
    await addDVQT(2024);
    const streak = await unitAnnualAwardService.calculateContinuousYears(unitId, 2025);
    expect(streak).toBe(1);
  });

  it('3 năm ĐVQT liên tục → liên tục = 3', async () => {
    await addDVQT(2022);
    await addDVQT(2023);
    await addDVQT(2024);
    const streak = await unitAnnualAwardService.calculateContinuousYears(unitId, 2025);
    expect(streak).toBe(3);
  });

  it('ĐVQT gián đoạn → reset', async () => {
    await addDVQT(2021);
    await addDVQT(2022);
    // 2023 thiếu
    await addDVQT(2024);
    const streak = await unitAnnualAwardService.calculateContinuousYears(unitId, 2025);
    expect(streak).toBe(1);
  });

  it('ĐVTT không tính vào chuỗi ĐVQT', async () => {
    await addDVQT(2022);
    await prisma.danhHieuDonViHangNam.create({
      data: { co_quan_don_vi_id: unitId, nam: 2023, danh_hieu: 'ĐVTT', status: 'APPROVED', nguoi_tao_id: adminId },
    });
    await addDVQT(2024);
    const streak = await unitAnnualAwardService.calculateContinuousYears(unitId, 2025);
    expect(streak).toBe(1);
  });
});

describe('Đơn vị — BKBQP eligibility', () => {
  it('2 năm ĐVQT → eligible BKBQP', async () => {
    await addDVQT(2023);
    await addDVQT(2024);
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(unitId, 2025, DANH_HIEU_DON_VI_HANG_NAM.BKBQP);
    expect(result.eligible).toBe(true);
  });

  it('1 năm ĐVQT → không eligible', async () => {
    await addDVQT(2024);
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(unitId, 2025, DANH_HIEU_DON_VI_HANG_NAM.BKBQP);
    expect(result.eligible).toBe(false);
  });

  it('3 năm ĐVQT (3%2≠0) → không eligible', async () => {
    await addDVQT(2022);
    await addDVQT(2023);
    await addDVQT(2024);
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(unitId, 2025, DANH_HIEU_DON_VI_HANG_NAM.BKBQP);
    expect(result.eligible).toBe(false);
  });

  it('4 năm ĐVQT (4%2=0) → eligible BKBQP lần 2', async () => {
    await addDVQT(2021);
    await addDVQT(2022);
    await addDVQT(2023);
    await addDVQT(2024);
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(unitId, 2025, DANH_HIEU_DON_VI_HANG_NAM.BKBQP);
    expect(result.eligible).toBe(true);
  });

  it('8 năm ĐVQT (8%2=0) → eligible BKBQP tiếp', async () => {
    for (let y = 2017; y <= 2024; y++) await addDVQT(y);
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(unitId, 2025, DANH_HIEU_DON_VI_HANG_NAM.BKBQP);
    expect(result.eligible).toBe(true);
  });
});

describe('Đơn vị — BKTTCP eligibility', () => {
  it('7 năm ĐVQT + 3 BKBQP → eligible', async () => {
    for (let y = 2018; y <= 2024; y++) await addDVQT(y);
    await addUnitBKBQP(2020);
    await addUnitBKBQP(2022);
    await addUnitBKBQP(2024);
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(unitId, 2025, DANH_HIEU_DON_VI_HANG_NAM.BKTTCP);
    expect(result.eligible).toBe(true);
  });

  it('7 năm ĐVQT + 2 BKBQP → không eligible (thiếu 1 BKBQP)', async () => {
    for (let y = 2018; y <= 2024; y++) await addDVQT(y);
    await addUnitBKBQP(2022);
    await addUnitBKBQP(2024);
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(unitId, 2025, DANH_HIEU_DON_VI_HANG_NAM.BKTTCP);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('2 lần BKBQP');
  });

  it('6 năm ĐVQT (< 7) → không eligible', async () => {
    for (let y = 2019; y <= 2024; y++) await addDVQT(y);
    await addUnitBKBQP(2021);
    await addUnitBKBQP(2023);
    await addUnitBKBQP(2024);
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(unitId, 2025, DANH_HIEU_DON_VI_HANG_NAM.BKTTCP);
    expect(result.eligible).toBe(false);
  });

  it('14 năm → BKTTCP lần 2 chưa hỗ trợ', async () => {
    for (let y = 2011; y <= 2024; y++) await addDVQT(y);
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(unitId, 2025, DANH_HIEU_DON_VI_HANG_NAM.BKTTCP);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('chưa hỗ trợ');
  });

  it('8 năm đề xuất BKTTCP → chưa đủ (8 !== 7)', async () => {
    for (let y = 2017; y <= 2024; y++) await addDVQT(y);
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(unitId, 2025, DANH_HIEU_DON_VI_HANG_NAM.BKTTCP);
    expect(result.eligible).toBe(false);
    expect(result.reason).not.toContain('chưa hỗ trợ');
  });
});

describe('Đơn vị — Flag + ghi chú tách biệt', () => {
  it('ĐVQT + BKBQP cùng năm → ghi chú riêng', async () => {
    await unitAnnualAwardService.upsert({
      don_vi_id: unitId, nam: 2024, danh_hieu: 'ĐVQT',
      so_quyet_dinh: 'QD1', ghi_chu: 'Ghi chú ĐVQT', nguoi_tao_id: adminId,
    });
    await unitAnnualAwardService.upsert({
      don_vi_id: unitId, nam: 2024, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QDBK', ghi_chu: 'Ghi chú BKBQP', nguoi_tao_id: adminId,
    });

    const record = await prisma.danhHieuDonViHangNam.findFirst({ where: { co_quan_don_vi_id: unitId, nam: 2024 } });
    expect(record!.danh_hieu).toBe('ĐVQT');
    expect(record!.ghi_chu).toBe('Ghi chú ĐVQT');
    expect(record!.nhan_bkbqp).toBe(true);
    expect(record!.ghi_chu_bkbqp).toBe('Ghi chú BKBQP');
    expect(record!.so_quyet_dinh).toBe('QD1');
    expect(record!.so_quyet_dinh_bkbqp).toBe('QDBK');
  });

  it('thêm ĐVQT vào record chỉ có BKBQP → không ghi đè flag', async () => {
    // Tạo BKBQP trước
    await prisma.danhHieuDonViHangNam.create({
      data: {
        co_quan_don_vi_id: unitId, nam: 2023,
        nhan_bkbqp: true, so_quyet_dinh_bkbqp: 'QDBK', ghi_chu_bkbqp: 'BK note',
        status: 'APPROVED', nguoi_tao_id: adminId,
      },
    });
    // Thêm ĐVQT
    await unitAnnualAwardService.upsert({
      don_vi_id: unitId, nam: 2023, danh_hieu: 'ĐVQT',
      so_quyet_dinh: 'QD1', ghi_chu: 'DV note', nguoi_tao_id: adminId,
    });

    const record = await prisma.danhHieuDonViHangNam.findFirst({ where: { co_quan_don_vi_id: unitId, nam: 2023 } });
    expect(record!.danh_hieu).toBe('ĐVQT');
    expect(record!.nhan_bkbqp).toBe(true);
    expect(record!.so_quyet_dinh_bkbqp).toBe('QDBK');
    expect(record!.ghi_chu_bkbqp).toBe('BK note');
    expect(record!.ghi_chu).toBe('DV note');
  });

  it('thêm BKBQP vào record có ĐVQT → không ghi đè danh_hieu', async () => {
    await addDVQT(2022);
    await unitAnnualAwardService.upsert({
      don_vi_id: unitId, nam: 2022, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QDBK', nguoi_tao_id: adminId,
    });

    const record = await prisma.danhHieuDonViHangNam.findFirst({ where: { co_quan_don_vi_id: unitId, nam: 2022 } });
    expect(record!.danh_hieu).toBe('ĐVQT');
    expect(record!.nhan_bkbqp).toBe(true);
  });
});

describe('Đơn vị — Conflict/trùng', () => {
  it('trùng ĐVQT cùng năm → lỗi', async () => {
    await addDVQT(2024);
    await expect(
      unitAnnualAwardService.upsert({
        don_vi_id: unitId, nam: 2024, danh_hieu: 'ĐVQT', nguoi_tao_id: adminId,
      })
    ).rejects.toThrow();
  });

  it('trùng BKBQP flag → lỗi', async () => {
    await addDVQT(2024);
    await addUnitBKBQP(2024);
    await expect(
      unitAnnualAwardService.upsert({
        don_vi_id: unitId, nam: 2024, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.BKBQP, nguoi_tao_id: adminId,
      })
    ).rejects.toThrow();
  });

  it('ĐVTT khi đã có ĐVQT → lỗi xung đột', async () => {
    await addDVQT(2024);
    await expect(
      unitAnnualAwardService.upsert({
        don_vi_id: unitId, nam: 2024, danh_hieu: 'ĐVTT', nguoi_tao_id: adminId,
      })
    ).rejects.toThrow();
  });
});

describe('Đơn vị — Gợi ý (goi_y)', () => {
  it('2 năm ĐVQT → gợi ý eligible BKBQP', async () => {
    await addDVQT(2023);
    await addDVQT(2024);
    const profile = await unitAnnualAwardService.recalculateAnnualUnit(unitId, 2025);
    expect(profile.du_dieu_kien_bk_tong_cuc).toBe(true);
    expect(profile.goi_y).toContain(getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKBQP));
  });

  it('7 năm + 3 BKBQP → gợi ý eligible BKTTCP', async () => {
    for (let y = 2018; y <= 2024; y++) await addDVQT(y);
    await addUnitBKBQP(2020);
    await addUnitBKBQP(2022);
    await addUnitBKBQP(2024);
    const profile = await unitAnnualAwardService.recalculateAnnualUnit(unitId, 2025);
    expect(profile.du_dieu_kien_bk_thu_tuong).toBe(true);
    expect(profile.goi_y).toContain(getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKTTCP));
  });

  it('14 năm + đã nhận BKTTCP → gợi ý chưa hỗ trợ', async () => {
    for (let y = 2011; y <= 2024; y++) await addDVQT(y);
    await prisma.danhHieuDonViHangNam.update({
      where: { unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: unitId, nam: 2018 } },
      data: { nhan_bkttcp: true },
    });
    const profile = await unitAnnualAwardService.recalculateAnnualUnit(unitId, 2025);
    expect(profile.du_dieu_kien_bk_thu_tuong).toBe(false);
    expect(profile.goi_y).toContain('chưa hỗ trợ');
  });

  it('9 năm sau BKTTCP → gợi ý BKBQP bình thường, không báo chưa hỗ trợ', async () => {
    for (let y = 2016; y <= 2024; y++) await addDVQT(y);
    await prisma.danhHieuDonViHangNam.update({
      where: { unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: unitId, nam: 2020 } },
      data: { nhan_bkttcp: true },
    });
    const profile = await unitAnnualAwardService.recalculateAnnualUnit(unitId, 2025);
    // 9 năm, 9%2≠0 → BKBQP không eligible
    // nhưng goi_y không báo "chưa hỗ trợ" (chỉ ở mốc 14)
    expect(profile.goi_y).not.toContain('chưa hỗ trợ');
  });
});
