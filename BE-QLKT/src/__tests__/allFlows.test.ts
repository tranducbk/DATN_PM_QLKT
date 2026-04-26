/**
 * Comprehensive tests for all flows: create, bulk, import, approve, eligibility.
 * Tests actual DB operations.
 */
import { prisma } from '../models';
import annualRewardService from '../services/annualReward.service';
import profileService from '../services/profile.service';
import { getDanhHieuName, DANH_HIEU_CA_NHAN_HANG_NAM } from '../constants/danhHieu.constants';

const P = 'test_allflows_';
let qnId: string;
let qn2Id: string;

beforeAll(async () => {
  const unit = await prisma.coQuanDonVi.create({
    data: { id: `${P}unit`, ma_don_vi: `${P}U`, ten_don_vi: 'Test' },
  });
  const cv = await prisma.chucVu.create({
    data: { id: `${P}cv`, ten_chuc_vu: 'Test', co_quan_don_vi_id: unit.id },
  });
  await prisma.$executeRawUnsafe(
    `INSERT INTO "QuanNhan" (id, ho_ten, co_quan_don_vi_id, chuc_vu_id, ngay_nhap_ngu, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    `${P}qn1`, 'QN Test 1', unit.id, cv.id, new Date('2005-01-01')
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "QuanNhan" (id, ho_ten, co_quan_don_vi_id, chuc_vu_id, ngay_nhap_ngu, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    `${P}qn2`, 'QN Test 2', unit.id, cv.id, new Date('2005-01-01')
  );
  qnId = `${P}qn1`;
  qn2Id = `${P}qn2`;
});

afterAll(async () => {
  await prisma.danhHieuHangNam.deleteMany({ where: { quan_nhan_id: { startsWith: P } } });
  await prisma.thanhTichKhoaHoc.deleteMany({ where: { quan_nhan_id: { startsWith: P } } });
  await prisma.hoSoHangNam.deleteMany({ where: { quan_nhan_id: { startsWith: P } } });
  await prisma.quanNhan.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.chucVu.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.coQuanDonVi.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.danhHieuHangNam.deleteMany({ where: { quan_nhan_id: { startsWith: P } } });
  await prisma.thanhTichKhoaHoc.deleteMany({ where: { quan_nhan_id: { startsWith: P } } });
  await prisma.hoSoHangNam.deleteMany({ where: { quan_nhan_id: { startsWith: P } } });
});

async function addCSTDCS(id: string, years: number[]) {
  for (const y of years) {
    await prisma.danhHieuHangNam.upsert({
      where: { quan_nhan_id_nam: { quan_nhan_id: id, nam: y } },
      create: { quan_nhan_id: id, nam: y, danh_hieu: 'CSTDCS' },
      update: { danh_hieu: 'CSTDCS' },
    });
  }
}

async function addNCKH(id: string, years: number[]) {
  for (const y of years) {
    await prisma.thanhTichKhoaHoc.create({
      data: { quan_nhan_id: id, nam: y, loai: 'SKKH', mo_ta: `NCKH ${y}` },
    });
  }
}

async function addBKBQP(id: string, year: number) {
  await prisma.danhHieuHangNam.update({
    where: { quan_nhan_id_nam: { quan_nhan_id: id, nam: year } },
    data: { nhan_bkbqp: true, so_quyet_dinh_bkbqp: `QDBK${year}` },
  });
}

async function addCSTDTQ(id: string, year: number) {
  await prisma.danhHieuHangNam.update({
    where: { quan_nhan_id_nam: { quan_nhan_id: id, nam: year } },
    data: { nhan_cstdtq: true, so_quyet_dinh_cstdtq: `QDTQ${year}` },
  });
}

async function getProfile(id: string, year: number) {
  const result = await profileService.recalculateAnnualProfile(id, year);
  return result.data;
}

describe('Bulk create — nhiều quân nhân cùng lúc', () => {
  it('bulk CSTDCS cho 2 QN: 1 thành công, 1 đã có → trả chi tiết', async () => {
    await addCSTDCS(qnId, [2020]);
    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [qnId, qn2Id],
      nam: 2020,
      danh_hieu: 'CSTDCS',
      so_quyet_dinh: 'QD1',
    });
    expect(result.success).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.details.errors[0].error).toContain('đã có');
  });

  it('bulk BKBQP cho QN chưa có CSTDCS → tạo record mới với danh_hieu null', async () => {
    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [qnId],
      nam: 2020,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QDBK',
    });
    expect(result.success).toBe(1);
    const record = await prisma.danhHieuHangNam.findFirst({ where: { quan_nhan_id: qnId, nam: 2020 } });
    expect(record!.danh_hieu).toBeNull();
    expect(record!.nhan_bkbqp).toBe(true);
    expect(record!.so_quyet_dinh_bkbqp).toBe('QDBK');
  });
});

describe('Ghi chú tách biệt per danh hiệu — đầy đủ', () => {
  it('CSTDCS ghi chú A → BKBQP ghi chú B → CSTDTQ ghi chú C → tất cả tách biệt', async () => {
    await annualRewardService.createAnnualReward({
      personnel_id: qnId, nam: 2020, danh_hieu: 'CSTDCS', ghi_chu: 'Ghi chú CSTDCS',
    });
    await annualRewardService.createAnnualReward({
      personnel_id: qnId, nam: 2020, nhan_bkbqp: true, so_quyet_dinh_bkbqp: 'QD1', ghi_chu: 'Ghi chú BKBQP',
    });
    await annualRewardService.createAnnualReward({
      personnel_id: qnId, nam: 2020, nhan_cstdtq: true, so_quyet_dinh_cstdtq: 'QD2', ghi_chu: 'Ghi chú CSTDTQ',
    });

    const record = await prisma.danhHieuHangNam.findFirst({ where: { quan_nhan_id: qnId, nam: 2020 } });
    expect(record!.ghi_chu).toBe('Ghi chú CSTDCS');
    expect(record!.ghi_chu_bkbqp).toBe('Ghi chú BKBQP');
    expect(record!.ghi_chu_cstdtq).toBe('Ghi chú CSTDTQ');
  });
});

describe('Số quyết định đúng field', () => {
  it('merge BKBQP + CSTDTQ + BKTTCP vào record CSTDCS → mỗi QĐ đúng field', async () => {
    await annualRewardService.createAnnualReward({
      personnel_id: qnId, nam: 2020, danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD_CS',
    });
    await annualRewardService.createAnnualReward({
      personnel_id: qnId, nam: 2020, nhan_bkbqp: true, so_quyet_dinh_bkbqp: 'QD_BK',
    });
    await annualRewardService.createAnnualReward({
      personnel_id: qnId, nam: 2020, nhan_cstdtq: true, so_quyet_dinh_cstdtq: 'QD_TQ',
    });
    await annualRewardService.createAnnualReward({
      personnel_id: qnId, nam: 2020, nhan_bkttcp: true, so_quyet_dinh_bkttcp: 'QD_TT',
    });

    const record = await prisma.danhHieuHangNam.findFirst({ where: { quan_nhan_id: qnId, nam: 2020 } });
    expect(record!.so_quyet_dinh).toBe('QD_CS');
    expect(record!.so_quyet_dinh_bkbqp).toBe('QD_BK');
    expect(record!.so_quyet_dinh_cstdtq).toBe('QD_TQ');
    expect(record!.so_quyet_dinh_bkttcp).toBe('QD_TT');
    expect(record!.danh_hieu).toBe('CSTDCS');
    expect(record!.nhan_bkbqp).toBe(true);
    expect(record!.nhan_cstdtq).toBe(true);
    expect(record!.nhan_bkttcp).toBe(true);
  });
});

describe('Eligibility — checkAwardEligibility khớp computeEligibilityFlags', () => {
  it('2 năm CSTDCS + NCKH → recalc eligible BKBQP = check eligible BKBQP', async () => {
    await addCSTDCS(qnId, [2023, 2024]);
    await addNCKH(qnId, [2023, 2024]);

    const profile = await getProfile(qnId, 2025);
    const check = await profileService.checkAwardEligibility(qnId, 2025, 'BKBQP');
    expect(profile.du_dieu_kien_bkbqp).toBe(true);
    expect(check.eligible).toBe(true);
  });

  it('7 năm đủ BKTTCP → cả 2 method đồng ý', async () => {
    await addCSTDCS(qnId, [2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addNCKH(qnId, [2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addBKBQP(qnId, 2020);
    await addBKBQP(qnId, 2022);
    await addBKBQP(qnId, 2024);
    await addCSTDTQ(qnId, 2021);
    await addCSTDTQ(qnId, 2024);

    const profile = await getProfile(qnId, 2025);
    const check = await profileService.checkAwardEligibility(qnId, 2025, 'BKTTCP');
    expect(profile.du_dieu_kien_bkttcp).toBe(true);
    expect(check.eligible).toBe(true);
  });

  it('14 năm → cả 2 method block BKTTCP + báo chưa hỗ trợ', async () => {
    const years = Array.from({ length: 14 }, (_, i) => 2011 + i);
    await addCSTDCS(qnId, years);
    await addNCKH(qnId, years);
    await addBKBQP(qnId, 2013);
    await addBKBQP(qnId, 2015);
    await addBKBQP(qnId, 2017);
    await addCSTDTQ(qnId, 2014);
    await addCSTDTQ(qnId, 2017);
    await prisma.danhHieuHangNam.update({
      where: { quan_nhan_id_nam: { quan_nhan_id: qnId, nam: 2018 } },
      data: { nhan_bkttcp: true },
    });

    const profile = await getProfile(qnId, 2025);
    const check = await profileService.checkAwardEligibility(qnId, 2025, 'BKTTCP');
    expect(profile.du_dieu_kien_bkttcp).toBe(false);
    expect(check.eligible).toBe(false);
    expect(check.reason).toContain('chưa hỗ trợ');
    expect(profile.goi_y).toContain('chưa hỗ trợ');
  });
});

describe('Edge cases khó', () => {
  it('CSTT không tính vào chuỗi CSTDCS', async () => {
    await prisma.danhHieuHangNam.create({ data: { quan_nhan_id: qnId, nam: 2023, danh_hieu: 'CSTT' } });
    await addCSTDCS(qnId, [2024]);
    await addNCKH(qnId, [2023, 2024]);

    const profile = await getProfile(qnId, 2025);
    expect(profile.cstdcs_lien_tuc).toBe(1);
  });

  it('2 QN cùng năm: 1 BKBQP eligible, 1 không (thiếu NCKH)', async () => {
    await addCSTDCS(qnId, [2023, 2024]);
    await addCSTDCS(qn2Id, [2023, 2024]);
    await addNCKH(qnId, [2023, 2024]);
    // qn2 thiếu NCKH

    const p1 = await getProfile(qnId, 2025);
    const p2 = await getProfile(qn2Id, 2025);
    expect(p1.du_dieu_kien_bkbqp).toBe(true);
    expect(p2.du_dieu_kien_bkbqp).toBe(false);
  });

  it('xóa CSTDCS giữa chuỗi 7 năm → BKTTCP mất', async () => {
    await addCSTDCS(qnId, [2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addNCKH(qnId, [2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addBKBQP(qnId, 2020);
    await addBKBQP(qnId, 2022);
    await addBKBQP(qnId, 2024);
    await addCSTDTQ(qnId, 2021);
    await addCSTDTQ(qnId, 2024);

    let p = await getProfile(qnId, 2025);
    expect(p.du_dieu_kien_bkttcp).toBe(true);

    // Xóa năm 2021
    await prisma.danhHieuHangNam.delete({
      where: { quan_nhan_id_nam: { quan_nhan_id: qnId, nam: 2021 } },
    });

    p = await getProfile(qnId, 2025);
    expect(p.cstdcs_lien_tuc).toBe(3);
    expect(p.du_dieu_kien_bkttcp).toBe(false);
  });

  it('cùng năm có CSTDCS + BKBQP + CSTDTQ + BKTTCP → 1 record duy nhất', async () => {
    await annualRewardService.createAnnualReward({ personnel_id: qnId, nam: 2020, danh_hieu: 'CSTDCS' });
    await annualRewardService.createAnnualReward({ personnel_id: qnId, nam: 2020, nhan_bkbqp: true });
    await annualRewardService.createAnnualReward({ personnel_id: qnId, nam: 2020, nhan_cstdtq: true });
    await annualRewardService.createAnnualReward({ personnel_id: qnId, nam: 2020, nhan_bkttcp: true });

    const count = await prisma.danhHieuHangNam.count({ where: { quan_nhan_id: qnId, nam: 2020 } });
    expect(count).toBe(1);
  });

  it('trùng BKBQP flag → lỗi, không duplicate', async () => {
    await annualRewardService.createAnnualReward({ personnel_id: qnId, nam: 2020, nhan_bkbqp: true });
    await expect(
      annualRewardService.createAnnualReward({ personnel_id: qnId, nam: 2020, nhan_bkbqp: true })
    ).rejects.toThrow();
  });

  it('chuỗi 7 năm nhưng thiếu NCKH năm 4 → BKTTCP fail dù đủ CSTDCS', async () => {
    await addCSTDCS(qnId, [2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    await addNCKH(qnId, [2018, 2019, 2020, 2022, 2023, 2024]); // thiếu 2021
    await addBKBQP(qnId, 2020);
    await addBKBQP(qnId, 2022);
    await addBKBQP(qnId, 2024);
    await addCSTDTQ(qnId, 2021);
    await addCSTDTQ(qnId, 2024);

    const p = await getProfile(qnId, 2025);
    expect(p.cstdcs_lien_tuc).toBe(7);
    expect(p.nckh_lien_tuc).toBe(3); // 2024, 2023, 2022 → break at 2021
    expect(p.du_dieu_kien_bkttcp).toBe(false);
  });

  it('recalculate với year khác → kết quả khác', async () => {
    await addCSTDCS(qnId, [2020, 2021, 2022, 2023, 2024]);
    await addNCKH(qnId, [2020, 2021, 2022, 2023, 2024]);

    const p2022 = await getProfile(qnId, 2022);
    expect(p2022.cstdcs_lien_tuc).toBe(2); // 2021, 2020

    const p2025 = await getProfile(qnId, 2025);
    expect(p2025.cstdcs_lien_tuc).toBe(5); // 2024→2020
  });

  it('goi_y hiện đúng tên từ constants', async () => {
    await addCSTDCS(qnId, [2023, 2024]);
    await addNCKH(qnId, [2023, 2024]);

    const p = await getProfile(qnId, 2025);
    const expectedLabel = getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP);
    expect(p.goi_y).toContain(expectedLabel);
  });
});
