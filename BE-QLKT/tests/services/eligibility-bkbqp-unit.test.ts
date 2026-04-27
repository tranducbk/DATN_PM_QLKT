import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeUnit, makeUnitAnnualRecord } from '../helpers/fixtures';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { DANH_HIEU_DON_VI_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { unitEligibilityReasons } from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
});

interface UnitAnnualRow {
  nam: number;
  danh_hieu?: string | null;
  nhan_bkbqp?: boolean;
  nhan_bkttcp?: boolean;
}

function buildContiguousDVQT(
  unitId: string,
  unitKind: 'CQDV' | 'DVTT',
  fromYear: number,
  toYear: number,
  flags: Partial<Record<number, Pick<UnitAnnualRow, 'nhan_bkbqp' | 'nhan_bkttcp'>>> = {}
) {
  const rows = [] as ReturnType<typeof makeUnitAnnualRecord>[];
  for (let y = fromYear; y <= toYear; y++) {
    const yearFlags = flags[y] ?? {};
    const nhan_bkbqp = yearFlags.nhan_bkbqp ?? false;
    const nhan_bkttcp = yearFlags.nhan_bkttcp ?? false;
    rows.push(
      makeUnitAnnualRecord({
        unitId,
        unitKind,
        nam: y,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: `QD-DVQT-${y}`,
        nhan_bkbqp,
        so_quyet_dinh_bkbqp: nhan_bkbqp ? `QDBK-${y}` : null,
        nhan_bkttcp,
        so_quyet_dinh_bkttcp: nhan_bkttcp ? `QDTT-${y}` : null,
      })
    );
  }
  return rows;
}

function dvqtRecordsDesc(records: { nam: number; danh_hieu?: string | null }[]) {
  return records
    .filter(r => r.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVQT)
    .sort((a, b) => b.nam - a.nam);
}

describe('unitAnnualAward.service - BKBQP exhaustive boundaries (CQDV)', () => {
  it('1. 2y ĐVQT → eligible (boundary tối thiểu)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-ex-1' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2022, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpEligible);
  });

  it('2. 4y ĐVQT → eligible (chia 2)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-ex-2' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2020, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('3. 6y ĐVQT → eligible (chia 2)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-ex-3' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2018, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(2);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('4. 3y ĐVQT → fail (NOT mod 2)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-ex-4' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2021, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpReason(3));
  });

  it('5. 5y ĐVQT → fail (NOT mod 2)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-ex-5' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2019, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpReason(5));
  });

  it('6. 7y ĐVQT → fail BKBQP (NOT mod 2)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-ex-6' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2017, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpReason(7));
  });

  it('7. 0y ĐVQT (no records) → fail', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-ex-7' });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce([]);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpReason(0));
  });

  it('8. Đã nhận BKBQP đơn vị (trong streak) + 4y ĐVQT mới → eligible (chain cho phép nhiều BKBQP)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-ex-8' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2020, 2023, {
      2021: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(1);
    // Lookup claim BKBQP cuối — tìm 2021 (trong streak, post-claim effective = 2)
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce({ nam: 2021 });

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('9. Claim BKBQP đơn vị năm 2022 + 2y ĐVQT + eval 2024 → fail (effective 1 < cycle 2)', async () => {
    // Claim BKBQP cuối tại 2022, eval 2024 → effective = 2024-1-2022 = 1.
    // Dưới cycle → phải chờ thêm 1 năm.
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-ex-9' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2022, 2023, {
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(1);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce({ nam: 2022 });

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpReason(2));
  });

  it('10. Claim BKBQP đơn vị 2022 + 3y ĐVQT + eval 2025 → eligible (effective 2)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-ex-10' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2022, 2024, {
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(1);
    prismaMock.danhHieuDonViHangNam.findFirst.mockResolvedValueOnce({ nam: 2022 });

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2025,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpEligible);
  });
});

describe('unitAnnualAward.service - BKBQP DVTT variants', () => {
  it('DVTT: 4y ĐVQT → eligible', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-bkbqp-ex-1', parentId: 'cqdv-parent' });
    const records = buildContiguousDVQT(dvtt.id, 'DVTT', 2020, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      dvtt.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('DVTT: 3y ĐVQT → fail', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-bkbqp-ex-2', parentId: 'cqdv-parent' });
    const records = buildContiguousDVQT(dvtt.id, 'DVTT', 2021, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      dvtt.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpReason(3));
  });
});
