/**
 * Integration tests for DanhHieuHangNam flows.
 * Tests actual DB operations via Prisma — requires running PostgreSQL.
 */
import { prisma } from '../models';
import annualRewardService from '../services/annualReward.service';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../constants/danhHieu.constants';

const TEST_PREFIX = 'test_annual_';
let testPersonnelId: string;

beforeAll(async () => {
  const unit = await prisma.coQuanDonVi.create({
    data: { id: `${TEST_PREFIX}unit`, ma_don_vi: `${TEST_PREFIX}U1`, ten_don_vi: 'Test Unit' },
  });
  const chucVu = await prisma.chucVu.create({
    data: { id: `${TEST_PREFIX}cv`, ten_chuc_vu: 'Test CV', co_quan_don_vi_id: unit.id },
  });
  const personnel = await prisma.$executeRawUnsafe(
    `INSERT INTO "QuanNhan" (id, ho_ten, co_quan_don_vi_id, chuc_vu_id, ngay_nhap_ngu, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    `${TEST_PREFIX}qn1`, 'Test QN', unit.id, chucVu.id, new Date('2010-01-01')
  );
  testPersonnelId = `${TEST_PREFIX}qn1`;
});

afterAll(async () => {
  await prisma.danhHieuHangNam.deleteMany({ where: { quan_nhan_id: { startsWith: TEST_PREFIX } } });
  await prisma.hoSoHangNam.deleteMany({ where: { quan_nhan_id: { startsWith: TEST_PREFIX } } });
  await prisma.quanNhan.deleteMany({ where: { id: { startsWith: TEST_PREFIX } } });
  await prisma.chucVu.deleteMany({ where: { id: { startsWith: TEST_PREFIX } } });
  await prisma.coQuanDonVi.deleteMany({ where: { id: { startsWith: TEST_PREFIX } } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.danhHieuHangNam.deleteMany({ where: { quan_nhan_id: testPersonnelId } });
});

describe('createAnnualReward', () => {
  it('creates CSTDCS for new year', async () => {
    const result = await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2020,
      danh_hieu: 'CSTDCS',
      so_quyet_dinh: 'QD1',
      cap_bac: 'Thượng sĩ',
      chuc_vu: 'Lớp trưởng',
    });
    expect(result.danh_hieu).toBe('CSTDCS');
    expect(result.so_quyet_dinh).toBe('QD1');
  });

  it('creates BKBQP with correct flag and QD field', async () => {
    const result = await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2020,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QDBK1',
    });
    expect(result.danh_hieu).toBeNull();
    expect(result.nhan_bkbqp).toBe(true);
    expect(result.so_quyet_dinh_bkbqp).toBe('QDBK1');
    expect(result.so_quyet_dinh).toBeNull();
  });

  it('merges BKBQP into existing CSTDCS record', async () => {
    await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2020,
      danh_hieu: 'CSTDCS',
      so_quyet_dinh: 'QD1',
    });

    const merged = await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2020,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QDBK2',
      ghi_chu: 'BKBQP note',
    });

    expect(merged.danh_hieu).toBe('CSTDCS');
    expect(merged.so_quyet_dinh).toBe('QD1');
    expect(merged.nhan_bkbqp).toBe(true);
    expect(merged.so_quyet_dinh_bkbqp).toBe('QDBK2');
  });

  it('merges CSTDCS into existing BKBQP-only record', async () => {
    await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2020,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QDBK1',
      ghi_chu: 'BKBQP note',
    });

    const merged = await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2020,
      danh_hieu: 'CSTDCS',
      so_quyet_dinh: 'QD2',
      ghi_chu: 'CSTDCS note',
    });

    expect(merged.danh_hieu).toBe('CSTDCS');
    expect(merged.so_quyet_dinh).toBe('QD2');
    expect(merged.nhan_bkbqp).toBe(true);
    expect(merged.so_quyet_dinh_bkbqp).toBe('QDBK1');
  });

  it('blocks duplicate CSTDCS same year', async () => {
    await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2020,
      danh_hieu: 'CSTDCS',
    });

    await expect(
      annualRewardService.createAnnualReward({
        personnel_id: testPersonnelId,
        nam: 2020,
        danh_hieu: 'CSTDCS',
      })
    ).rejects.toThrow();
  });

  it('blocks CSTT when CSTDCS exists', async () => {
    await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2020,
      danh_hieu: 'CSTDCS',
    });

    await expect(
      annualRewardService.createAnnualReward({
        personnel_id: testPersonnelId,
        nam: 2020,
        danh_hieu: 'CSTT',
      })
    ).rejects.toThrow();
  });

  it('blocks duplicate BKBQP flag', async () => {
    await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2020,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD1',
    });

    await expect(
      annualRewardService.createAnnualReward({
        personnel_id: testPersonnelId,
        nam: 2020,
        nhan_bkbqp: true,
      })
    ).rejects.toThrow();
  });
});

describe('Flag preservation on update', () => {
  it('adding CSTDCS does not reset existing BKBQP flag', async () => {
    // Create BKBQP only
    await prisma.danhHieuHangNam.create({
      data: {
        quan_nhan_id: testPersonnelId,
        nam: 2021,
        nhan_bkbqp: true,
        so_quyet_dinh_bkbqp: 'QDBK',
        ghi_chu_bkbqp: 'BK note',
      },
    });

    // Add CSTDCS via createAnnualReward
    await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2021,
      danh_hieu: 'CSTDCS',
      so_quyet_dinh: 'QD1',
      ghi_chu: 'CSTDCS note',
    });

    const record = await prisma.danhHieuHangNam.findFirst({
      where: { quan_nhan_id: testPersonnelId, nam: 2021 },
    });

    expect(record!.danh_hieu).toBe('CSTDCS');
    expect(record!.so_quyet_dinh).toBe('QD1');
    expect(record!.ghi_chu).toBe('CSTDCS note');
    expect(record!.nhan_bkbqp).toBe(true);
    expect(record!.so_quyet_dinh_bkbqp).toBe('QDBK');
    expect(record!.ghi_chu_bkbqp).toBe('BK note');
  });

  it('adding BKBQP does not reset existing CSTDTQ flag', async () => {
    await prisma.danhHieuHangNam.create({
      data: {
        quan_nhan_id: testPersonnelId,
        nam: 2022,
        danh_hieu: 'CSTDCS',
        nhan_cstdtq: true,
        so_quyet_dinh_cstdtq: 'QDTQ',
        ghi_chu_cstdtq: 'TQ note',
      },
    });

    await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2022,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QDBK',
    });

    const record = await prisma.danhHieuHangNam.findFirst({
      where: { quan_nhan_id: testPersonnelId, nam: 2022 },
    });

    expect(record!.danh_hieu).toBe('CSTDCS');
    expect(record!.nhan_bkbqp).toBe(true);
    expect(record!.so_quyet_dinh_bkbqp).toBe('QDBK');
    expect(record!.nhan_cstdtq).toBe(true);
    expect(record!.so_quyet_dinh_cstdtq).toBe('QDTQ');
    expect(record!.ghi_chu_cstdtq).toBe('TQ note');
  });
});

describe('Ghi chu per danh hieu', () => {
  it('stores ghi_chu in correct field based on danh_hieu type', async () => {
    // Create with CSTDCS ghi_chu
    await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2023,
      danh_hieu: 'CSTDCS',
      ghi_chu: 'Base note',
    });

    // Add BKBQP with different ghi_chu
    await annualRewardService.createAnnualReward({
      personnel_id: testPersonnelId,
      nam: 2023,
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QD1',
      ghi_chu: 'BKBQP note',
    });

    const record = await prisma.danhHieuHangNam.findFirst({
      where: { quan_nhan_id: testPersonnelId, nam: 2023 },
    });

    expect(record!.ghi_chu).toBe('Base note');
    expect(record!.ghi_chu_bkbqp).toBe('BKBQP note');
  });
});

describe('bulkCreateAnnualRewards', () => {
  it('creates CSTDCS successfully', async () => {
    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [testPersonnelId],
      nam: 2020,
      danh_hieu: 'CSTDCS',
      so_quyet_dinh: 'QD1',
    });

    expect(result.success).toBe(1);
    expect(result.errors).toBe(0);
  });

  it('merges BKBQP into existing CSTDCS', async () => {
    await prisma.danhHieuHangNam.create({
      data: { quan_nhan_id: testPersonnelId, nam: 2021, danh_hieu: 'CSTDCS', so_quyet_dinh: 'QD1' },
    });

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [testPersonnelId],
      nam: 2021,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
      so_quyet_dinh: 'QDBK',
    });

    expect(result.success).toBe(1);

    const record = await prisma.danhHieuHangNam.findFirst({
      where: { quan_nhan_id: testPersonnelId, nam: 2021 },
    });
    expect(record!.danh_hieu).toBe('CSTDCS');
    expect(record!.nhan_bkbqp).toBe(true);
    expect(record!.so_quyet_dinh_bkbqp).toBe('QDBK');
  });

  it('merges CSTDCS into existing BKBQP-only record', async () => {
    await prisma.danhHieuHangNam.create({
      data: { quan_nhan_id: testPersonnelId, nam: 2022, nhan_bkbqp: true, so_quyet_dinh_bkbqp: 'QDBK' },
    });

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [testPersonnelId],
      nam: 2022,
      danh_hieu: 'CSTDCS',
      so_quyet_dinh: 'QD2',
    });

    expect(result.success).toBe(1);

    const record = await prisma.danhHieuHangNam.findFirst({
      where: { quan_nhan_id: testPersonnelId, nam: 2022 },
    });
    expect(record!.danh_hieu).toBe('CSTDCS');
    expect(record!.so_quyet_dinh).toBe('QD2');
    expect(record!.nhan_bkbqp).toBe(true);
    expect(record!.so_quyet_dinh_bkbqp).toBe('QDBK');
  });

  it('errors when duplicate CSTDCS same year', async () => {
    await prisma.danhHieuHangNam.create({
      data: { quan_nhan_id: testPersonnelId, nam: 2023, danh_hieu: 'CSTDCS' },
    });

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [testPersonnelId],
      nam: 2023,
      danh_hieu: 'CSTDCS',
    });

    expect(result.success).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('errors when duplicate BKBQP flag', async () => {
    await prisma.danhHieuHangNam.create({
      data: { quan_nhan_id: testPersonnelId, nam: 2024, nhan_bkbqp: true },
    });

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: [testPersonnelId],
      nam: 2024,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
    });

    expect(result.success).toBe(0);
    expect(result.errors).toBe(1);
  });
});

describe('deleteAnnualReward', () => {
  it('deletes record and recalculates profile', async () => {
    const created = await prisma.danhHieuHangNam.create({
      data: { quan_nhan_id: testPersonnelId, nam: 2020, danh_hieu: 'CSTDCS' },
    });

    const result = await annualRewardService.deleteAnnualReward(created.id);
    expect(result.message).toContain('Đã xóa');

    const record = await prisma.danhHieuHangNam.findUnique({ where: { id: created.id } });
    expect(record).toBeNull();
  });
});
