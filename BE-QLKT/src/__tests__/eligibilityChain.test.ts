/**
 * Test eligibility chain calculation for BKBQP / CSTDTQ / BKTTCP.
 * Uses actual profile.service calculation against DB.
 */
import { prisma } from '../models';
import profileService from '../services/profile.service';
import { getDanhHieuName, DANH_HIEU_CA_NHAN_HANG_NAM } from '../constants/danhHieu.constants';

const TEN_BKBQP = getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP);
const TEN_CSTDTQ = getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ);
const TEN_BKTTCP = getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP);

const TEST_PREFIX = 'test_elig_';
let qnId: string;

beforeAll(async () => {
  const unit = await prisma.coQuanDonVi.create({
    data: { id: `${TEST_PREFIX}unit`, ma_don_vi: `${TEST_PREFIX}U`, ten_don_vi: 'Test' },
  });
  const cv = await prisma.chucVu.create({
    data: { id: `${TEST_PREFIX}cv`, ten_chuc_vu: 'Test', co_quan_don_vi_id: unit.id },
  });
  await prisma.$executeRawUnsafe(
    `INSERT INTO "QuanNhan" (id, ho_ten, co_quan_don_vi_id, chuc_vu_id, ngay_nhap_ngu, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    `${TEST_PREFIX}qn`, 'Test Elig', unit.id, cv.id, new Date('2005-01-01')
  );
  qnId = `${TEST_PREFIX}qn`;
});

afterAll(async () => {
  await prisma.danhHieuHangNam.deleteMany({ where: { quan_nhan_id: qnId } });
  await prisma.thanhTichKhoaHoc.deleteMany({ where: { quan_nhan_id: qnId } });
  await prisma.hoSoHangNam.deleteMany({ where: { quan_nhan_id: qnId } });
  await prisma.quanNhan.deleteMany({ where: { id: qnId } });
  await prisma.chucVu.deleteMany({ where: { id: { startsWith: TEST_PREFIX } } });
  await prisma.coQuanDonVi.deleteMany({ where: { id: { startsWith: TEST_PREFIX } } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.danhHieuHangNam.deleteMany({ where: { quan_nhan_id: qnId } });
  await prisma.thanhTichKhoaHoc.deleteMany({ where: { quan_nhan_id: qnId } });
  await prisma.hoSoHangNam.deleteMany({ where: { quan_nhan_id: qnId } });
});

/** Helper: create CSTDCS for multiple years */
async function addCSTDCS(years: number[]) {
  for (const y of years) {
    await prisma.danhHieuHangNam.upsert({
      where: { quan_nhan_id_nam: { quan_nhan_id: qnId, nam: y } },
      create: { quan_nhan_id: qnId, nam: y, danh_hieu: 'CSTDCS' },
      update: { danh_hieu: 'CSTDCS' },
    });
  }
}

/** Helper: add BKBQP flag to existing year */
async function addBKBQP(year: number) {
  await prisma.danhHieuHangNam.update({
    where: { quan_nhan_id_nam: { quan_nhan_id: qnId, nam: year } },
    data: { nhan_bkbqp: true, so_quyet_dinh_bkbqp: `QDBK${year}` },
  });
}

/** Helper: add CSTDTQ flag to existing year */
async function addCSTDTQ(year: number) {
  await prisma.danhHieuHangNam.update({
    where: { quan_nhan_id_nam: { quan_nhan_id: qnId, nam: year } },
    data: { nhan_cstdtq: true, so_quyet_dinh_cstdtq: `QDTQ${year}` },
  });
}

/** Helper: add NCKH for multiple years */
async function addNCKH(years: number[]) {
  for (const y of years) {
    await prisma.thanhTichKhoaHoc.create({
      data: { quan_nhan_id: qnId, nam: y, loai: 'SKKH', mo_ta: `NCKH ${y}` },
    });
  }
}

/** Helper: recalculate and get profile */
async function getProfile(year: number) {
  const result = await profileService.recalculateAnnualProfile(qnId, year);
  return result.data;
}

describe('BKBQP eligibility', () => {
  it('1 năm CSTDCS → không eligible', async () => {
    await addCSTDCS([2024]);
    await addNCKH([2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(1);
    expect(p.du_dieu_kien_bkbqp).toBe(false);
  });

  it('2 năm CSTDCS liên tục + 2 NCKH → eligible', async () => {
    await addCSTDCS([2023, 2024]);
    await addNCKH([2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(2);
    expect(p.du_dieu_kien_bkbqp).toBe(true);
  });

  it('2 năm CSTDCS nhưng chỉ 1 NCKH → không eligible', async () => {
    await addCSTDCS([2023, 2024]);
    await addNCKH([2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(2);
    expect(p.nckh_lien_tuc).toBe(1);
    expect(p.du_dieu_kien_bkbqp).toBe(false);
  });

  it('3 năm CSTDCS (3%2≠0) → không eligible BKBQP', async () => {
    await addCSTDCS([2022, 2023, 2024]);
    await addNCKH([2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(3);
    expect(p.du_dieu_kien_bkbqp).toBe(false);
  });

  it('4 năm CSTDCS (4%2=0) → eligible BKBQP lần 2', async () => {
    await addCSTDCS([2021, 2022, 2023, 2024]);
    await addNCKH([2021, 2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(4);
    expect(p.du_dieu_kien_bkbqp).toBe(true);
  });

  it('2 năm CSTDCS gián đoạn (2022, 2024) → liên tục = 1', async () => {
    await addCSTDCS([2022, 2024]);
    await addNCKH([2022, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(1);
    expect(p.du_dieu_kien_bkbqp).toBe(false);
  });
});

describe('CSTDTQ eligibility', () => {
  it('3 năm CSTDCS + 1 BKBQP (ở year-1) + 3 NCKH → eligible', async () => {
    await addCSTDCS([2022, 2023, 2024]);
    await addBKBQP(2024);
    await addNCKH([2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(3);
    expect(p.bkbqp_lien_tuc).toBe(1);
    expect(p.du_dieu_kien_cstdtq).toBe(true);
  });

  it('3 năm CSTDCS nhưng 0 BKBQP → không eligible CSTDTQ', async () => {
    await addCSTDCS([2022, 2023, 2024]);
    await addNCKH([2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(3);
    expect(p.bkbqp_lien_tuc).toBe(0);
    expect(p.du_dieu_kien_cstdtq).toBe(false);
  });

  it('6 năm CSTDCS (namTrongChuKy=6) → eligible BKBQP + CSTDTQ', async () => {
    await addCSTDCS([2019, 2020, 2021, 2022, 2023, 2024]);
    // bkbqp cadence từ 2024 bước 2: 2024, 2022, 2020
    await addBKBQP(2024);
    await addBKBQP(2022);
    await addBKBQP(2020);
    await addNCKH([2019, 2020, 2021, 2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(6);
    expect(p.bkbqp_lien_tuc).toBe(3);
    expect(p.du_dieu_kien_bkbqp).toBe(true);
    expect(p.du_dieu_kien_cstdtq).toBe(true);
  });

  it('5 năm CSTDCS (5%3≠0) → không eligible CSTDTQ', async () => {
    await addCSTDCS([2020, 2021, 2022, 2023, 2024]);
    await addBKBQP(2021);
    await addNCKH([2020, 2021, 2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(5);
    expect(p.du_dieu_kien_cstdtq).toBe(false);
  });
});

describe('BKTTCP eligibility', () => {
  it('7 năm CSTDCS + 3 BKBQP (cadence 2) + 2 CSTDTQ (cadence 3) + 7 NCKH → eligible', async () => {
    await addCSTDCS([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    // BKBQP: năm 2, 4, 6 → cadence 2 năm: 2024, 2022, 2020
    await addBKBQP(2020);
    await addBKBQP(2022);
    await addBKBQP(2024);
    // CSTDTQ: năm 3, 6 → cadence 3 năm: 2024, 2021
    await addCSTDTQ(2021);
    await addCSTDTQ(2024);
    await addNCKH([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(7);
    expect(p.bkbqp_lien_tuc).toBe(3);
    expect(p.cstdtq_lien_tuc).toBe(2);
    expect(p.du_dieu_kien_bkttcp).toBe(true);
  });

  it('7 năm CSTDCS nhưng chỉ 2 BKBQP → không eligible BKTTCP', async () => {
    await addCSTDCS([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addBKBQP(2022);
    await addBKBQP(2024);
    await addCSTDTQ(2021);
    await addCSTDTQ(2024);
    await addNCKH([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(7);
    expect(p.bkbqp_lien_tuc).toBe(2);
    expect(p.du_dieu_kien_bkttcp).toBe(false);
  });

  it('7 năm CSTDCS + 3 BKBQP nhưng chỉ 1 CSTDTQ → không eligible', async () => {
    await addCSTDCS([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addBKBQP(2020);
    await addBKBQP(2022);
    await addBKBQP(2024);
    await addCSTDTQ(2024);
    await addNCKH([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdtq_lien_tuc).toBe(1);
    expect(p.du_dieu_kien_bkttcp).toBe(false);
  });
});

describe('Năm thứ 8+ (tiếp tục liên tục)', () => {
  it('8 năm CSTDCS (8%2=0) → eligible BKBQP lần 4', async () => {
    await addCSTDCS([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addBKBQP(2024);
    await addBKBQP(2022);
    await addBKBQP(2020);
    await addNCKH([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(8);
    expect(p.du_dieu_kien_bkbqp).toBe(true);
    expect(p.du_dieu_kien_cstdtq).toBe(false);
    expect(p.du_dieu_kien_bkttcp).toBe(false);
  });

  it('9 năm CSTDCS (9%3=0) + BKBQP → eligible CSTDTQ lần 3', async () => {
    await addCSTDCS([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addBKBQP(2024);
    await addNCKH([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(9);
    expect(p.du_dieu_kien_bkbqp).toBe(false);
    expect(p.du_dieu_kien_cstdtq).toBe(true);
  });

  it('10 năm CSTDCS (10%2=0) → eligible BKBQP lần 5', async () => {
    await addCSTDCS([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addNCKH([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(10);
    expect(p.du_dieu_kien_bkbqp).toBe(true);
    expect(p.du_dieu_kien_cstdtq).toBe(false);
  });

  it('14 năm CSTDCS (chuỗi 2 mốc 7) → BKTTCP block, BKBQP vẫn eligible', async () => {
    const years = Array.from({ length: 14 }, (_, i) => 2011 + i);
    await addCSTDCS(years);
    await addBKBQP(2024);
    await addBKBQP(2022);
    await addBKBQP(2020);
    await addCSTDTQ(2024);
    await addCSTDTQ(2021);
    await addNCKH(years);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(14);
    expect(p.du_dieu_kien_bkttcp).toBe(false);
    expect(p.du_dieu_kien_bkbqp).toBe(true);
  });

  it('nhập năm 15 (cstdcs=14) + đã nhận BKTTCP → goi_y báo chưa hỗ trợ', async () => {
    const years = Array.from({ length: 14 }, (_, i) => 2011 + i);
    await addCSTDCS(years);
    await addNCKH(years);
    // BKBQP lần 1-3
    await addBKBQP(2013);
    await addBKBQP(2015);
    await addBKBQP(2017);
    // CSTDTQ lần 1-2
    await addCSTDTQ(2014);
    await addCSTDTQ(2017);
    // BKTTCP đã nhận ở năm 8 (2018)
    await prisma.danhHieuHangNam.update({
      where: { quan_nhan_id_nam: { quan_nhan_id: qnId, nam: 2018 } },
      data: { nhan_bkttcp: true },
    });

    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(14);
    expect(p.du_dieu_kien_bkttcp).toBe(false);
    expect(p.goi_y).toContain('chưa hỗ trợ');
    expect(p.goi_y).toContain(TEN_BKTTCP);
  });

  it('nhập năm 9 sau BKTTCP → eligible BKBQP bình thường, không báo chưa hỗ trợ', async () => {
    await addCSTDCS([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addNCKH([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addBKBQP(2019);
    await addBKBQP(2021);
    await addBKBQP(2023);
    await addCSTDTQ(2020);
    await addCSTDTQ(2023);
    await prisma.danhHieuHangNam.update({
      where: { quan_nhan_id_nam: { quan_nhan_id: qnId, nam: 2024 } },
      data: { nhan_bkttcp: true },
    });

    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(8);
    expect(p.du_dieu_kien_bkbqp).toBe(true);
    expect(p.du_dieu_kien_bkttcp).toBe(false);
    // Năm 9: chỉ eligible BKBQP bình thường
    expect(p.goi_y).toContain(TEN_BKBQP);
    expect(p.goi_y).not.toContain('chưa hỗ trợ');
  });
});

describe('Gián đoạn reset chuỗi', () => {
  it('CSTDCS 2020-2022 rồi gián đoạn 2023, tiếp 2024 → liên tục = 1', async () => {
    await addCSTDCS([2020, 2021, 2022, 2024]);
    await addNCKH([2020, 2021, 2022, 2024]);
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(1);
    expect(p.du_dieu_kien_bkbqp).toBe(false);
  });

  it('BKBQP đếm tổng trong chuỗi CSTDCS', async () => {
    await addCSTDCS([2019, 2020, 2021, 2022, 2023, 2024]);
    await addBKBQP(2020);
    await addBKBQP(2024);
    await addNCKH([2019, 2020, 2021, 2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.bkbqp_lien_tuc).toBe(2);
  });

  it('Xóa CSTDCS giữa chuỗi → recalculate giảm', async () => {
    await addCSTDCS([2022, 2023, 2024]);
    await addNCKH([2022, 2023, 2024]);
    let p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(3);

    // Xóa năm 2023
    await prisma.danhHieuHangNam.delete({
      where: { quan_nhan_id_nam: { quan_nhan_id: qnId, nam: 2023 } },
    });
    p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(1);
  });
});

describe('NCKH liên tục', () => {
  it('NCKH mỗi năm liên tục → nckh_lien_tuc đúng', async () => {
    await addNCKH([2022, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.nckh_lien_tuc).toBe(3);
  });

  it('NCKH gián đoạn → reset', async () => {
    await addNCKH([2022, 2024]);
    const p = await getProfile(2025);
    expect(p.nckh_lien_tuc).toBe(1);
  });

  it('Nhiều NCKH cùng năm → chỉ đếm 1', async () => {
    await addNCKH([2024, 2024, 2024]);
    const p = await getProfile(2025);
    expect(p.nckh_lien_tuc).toBe(1);
  });
});

describe('NCKH edge cases', () => {
  it('2 NCKH cùng năm chỉ đếm 1', async () => {
    await addCSTDCS([2023, 2024]);
    await addNCKH([2023, 2023, 2024]);
    const p = await getProfile(2025);
    expect(p.nckh_lien_tuc).toBe(2);
    expect(p.du_dieu_kien_bkbqp).toBe(true);
  });

  it('NCKH năm đề xuất (year) không đếm — chỉ đếm year-1 trở về trước', async () => {
    await addCSTDCS([2023, 2024]);
    await addNCKH([2023, 2025]);
    // recalc 2025: check NCKH từ 2024 ngược
    // 2024: không có NCKH → nckh_lien_tuc = 0
    const p = await getProfile(2025);
    expect(p.nckh_lien_tuc).toBe(0);
    expect(p.du_dieu_kien_bkbqp).toBe(false);
  });

  it('NCKH năm đề xuất đếm cho năm sau', async () => {
    await addCSTDCS([2023, 2024, 2025]);
    await addNCKH([2023, 2024, 2025]);
    // recalc 2026: check từ 2025 ngược
    const p = await getProfile(2026);
    expect(p.nckh_lien_tuc).toBe(3);
    expect(p.cstdcs_lien_tuc).toBe(3);
  });
});

describe('Trễ đề xuất BKBQP', () => {
  it('năm 3 eligible BKBQP nhưng không đề xuất, năm 5 mới đề xuất', async () => {
    // CSTDCS 5 năm liên tục, NCKH mỗi năm
    await addCSTDCS([2020, 2021, 2022, 2023, 2024]);
    await addNCKH([2020, 2021, 2022, 2023, 2024]);
    // Không đề xuất BKBQP ở năm 3 (2022), đến năm 5 (2024) mới nhận
    await addBKBQP(2024);

    // Năm 3 (recalc 2023): cstdcs=3, eligible CSTDTQ nhưng bkbqp=0 → fail
    const p3 = await getProfile(2023);
    expect(p3.cstdcs_lien_tuc).toBe(3);
    expect(p3.du_dieu_kien_cstdtq).toBe(false);

    // Năm 4 (recalc 2024): cstdcs=4, eligible BKBQP nhưng BKBQP chưa nhận
    const p4 = await getProfile(2024);
    expect(p4.cstdcs_lien_tuc).toBe(4);
    expect(p4.du_dieu_kien_bkbqp).toBe(true);

    // Năm 5 (recalc 2025): cstdcs=5, BKBQP đã nhận ở năm 2024
    const p5 = await getProfile(2025);
    expect(p5.cstdcs_lien_tuc).toBe(5);
    expect(p5.bkbqp_lien_tuc).toBe(1);
    // 5%2≠0 → BKBQP không eligible
    expect(p5.du_dieu_kien_bkbqp).toBe(false);
    // 5%3≠0 → CSTDTQ không eligible
    expect(p5.du_dieu_kien_cstdtq).toBe(false);
  });

  it('trễ BKBQP → CSTDTQ cũng bị trễ', async () => {
    await addCSTDCS([2019, 2020, 2021, 2022, 2023, 2024]);
    await addNCKH([2019, 2020, 2021, 2022, 2023, 2024]);
    // BKBQP nhận trễ ở năm 5 (2023) thay vì năm 3
    await addBKBQP(2023);

    // Năm 6 (recalc 2025): cstdcs=6, 6%3=0, bkbqp=1 → CSTDTQ eligible
    const p6 = await getProfile(2025);
    expect(p6.cstdcs_lien_tuc).toBe(6);
    expect(p6.bkbqp_lien_tuc).toBe(1);
    expect(p6.du_dieu_kien_cstdtq).toBe(true);
    expect(p6.du_dieu_kien_bkbqp).toBe(true);
  });

  it('năm 5 lỡ BKBQP lần 2, năm 6 mới đề xuất → BKTTCP fail do thiếu 1 BKBQP', async () => {
    await addCSTDCS([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addNCKH([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    // BKBQP lần 1 đúng hẹn (năm 3 = 2020)
    await addBKBQP(2020);
    // CSTDTQ lần 1 đúng hẹn (năm 4 = 2021)
    await addCSTDTQ(2021);
    // BKBQP lần 2 trễ: năm 5 (2022) không đề xuất, năm 6 (2023) mới đề xuất
    await addBKBQP(2023);
    // Năm 7 eligible BKBQP+CSTDTQ nhưng không đề xuất (chỉ có 2 BKBQP)
    // → BKTTCP fail
    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(7);
    expect(p.du_dieu_kien_bkttcp).toBe(false);
  });

  it('không đề xuất BKBQP → BKTTCP thiếu BKBQP', async () => {
    await addCSTDCS([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addNCKH([2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    // Chỉ nhận 2 BKBQP thay vì 3
    await addBKBQP(2020);
    await addBKBQP(2022);
    await addCSTDTQ(2021);
    await addCSTDTQ(2024);

    const p = await getProfile(2025);
    expect(p.cstdcs_lien_tuc).toBe(7);
    // bkbqpTrong7Nam = 2, cần 3 → BKTTCP fail
    expect(p.du_dieu_kien_bkttcp).toBe(false);
  });
});
