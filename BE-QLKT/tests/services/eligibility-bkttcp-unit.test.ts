import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makeUnit, makeUnitAnnualRecord } from '../helpers/fixtures';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { DANH_HIEU_DON_VI_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { unitEligibilityReasons, suggestionMessages } from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
});

interface UnitAnnualRow {
  nam: number;
  danh_hieu?: string | null;
  nhan_bkbqp?: boolean;
  nhan_bkttcp?: boolean;
}

function arrangeResolveUnit(unit: ReturnType<typeof makeUnit>): void {
  if (unit.kind === 'CQDV') {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: unit.id });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
  } else {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({ id: unit.id });
  }
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

/** Counts BKBQP flags within [year-streak..year-1]. */
function countBKBQPInWindow(
  records: { nam: number; nhan_bkbqp?: boolean }[],
  year: number,
  streak: number
): number {
  const startYear = year - streak;
  const endYear = year - 1;
  return records.filter(r => r.nhan_bkbqp === true && r.nam >= startYear && r.nam <= endYear).length;
}

describe('unitAnnualAward.service - BKTTCP exhaustive (streak vs BKBQP)', () => {
  it('A1. CQDV: 7y ĐVQT + 3 BKBQP trong streak → eligible BKTTCP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-A1' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(3);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpEligible);
  });

  it('A3. 7y ĐVQT + 2 BKBQP → fail (thiếu 1 BKBQP)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-A3' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(2);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpReason(7, 2));
  });

  it('A5. 7y ĐVQT + 4 BKBQP → fail (rule strict bkbqpLienTuc === 3)', async () => {
    // Code at unitAnnualAward.service.ts:252 uses === 3 strict
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-A5' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2017, 2023, {
      2017: { nhan_bkbqp: true },
      2019: { nhan_bkbqp: true },
      2021: { nhan_bkbqp: true },
      2023: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(4);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpReason(7, 4));
  });
});

describe('unitAnnualAward.service - BKTTCP streak length boundary (dvqtLienTuc strict === 7)', () => {
  it('B1. 6y ĐVQT + 3 BKBQP → fail (dvqt < 7)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-B1' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2018, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(3);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpReason(6, 3));
  });

  it('B3. 8y ĐVQT với 3 BKBQP trong 7y cuối → fail (dvqt !== 7) - VẠCH TRẦN strict', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-B3' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2016, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    // countBKBQPInStreak counts all BKBQP within streak window (8 years here)
    const bkbqpCount = countBKBQPInWindow(records, 2024, 8);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(bkbqpCount);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpMissedWindow(8));
  });

  it('B4. 13y ĐVQT với BKBQP đủ trong 7y cuối → fail (vẫn không qua, không "chưa hỗ trợ")', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-B4-13' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2011, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    const bkbqpCount = countBKBQPInWindow(records, 2024, 13);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(bkbqpCount);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).not.toMatch(/chưa hỗ trợ/);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpMissedWindow(13));
  });

  it('B5. 14y ĐVQT với BKBQP đủ → "chưa hỗ trợ" (overflow precedes count check)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-B5' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2010, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(3);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpUnsupported);
  });

  it('B6. 21y ĐVQT (mod 7) → "chưa hỗ trợ"', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-B6' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2003, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpUnsupported);
  });

  it('B8. 15y ĐVQT (NOT mod 7) → fail "Chưa đủ điều kiện..."', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-B8-15' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2009, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).not.toMatch(/chưa hỗ trợ/);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpMissedWindow(15));
  });
});

describe('unitAnnualAward.service - BKTTCP đã nhận (lifetime block check)', () => {
  it('C1. Đã nhận BKTTCP + streak 7y mới + 3 BKBQP → block "khen thưởng một lần duy nhất"', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-C1' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true, nhan_bkttcp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(3);
    // Lifetime block prisma.count for any nhan_bkttcp = true row
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(1);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpLifetimeBlocked);
  });

  it('C2. Đã nhận BKTTCP + 14y ĐVQT → reason kết hợp "Đã có ... chưa hỗ trợ cao hơn"', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-C2' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2010, 2023, {
      2016: { nhan_bkttcp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(1);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpLifetimeBlockedAndUnsupported);
  });

  it('C4. Đã nhận BKTTCP + 7y ĐVQT mới + 3 BKBQP → block "khen thưởng một lần duy nhất"', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-C4' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true, nhan_bkttcp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(3);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(1);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpLifetimeBlocked);
  });

  it('C5. Đã nhận BKTTCP + 21y ĐVQT → reason kết hợp lifetime + overflow', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-C5' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2003, 2023, {
      2009: { nhan_bkttcp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(1);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpLifetimeBlockedAndUnsupported);
  });

  it('C6. CHƯA nhận BKTTCP đơn vị + 14y ĐVQT → "chưa hỗ trợ" KHÔNG có "Đã có"', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-C6' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2010, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpUnsupported);
    expect(result.reason).not.toMatch(/Đã có/);
  });

  it('C3. Recalc với hasReceivedBKTTCP + streak 21y → goi_y "chưa hỗ trợ"', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-C3' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2003, 2023, {
      2009: { nhan_bkttcp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(21);
    expect(upsertArgs.update.du_dieu_kien_bk_thu_tuong).toBe(false);
    expect(upsertArgs.update.goi_y).toBe(suggestionMessages.unitUnsupported);
  });
});

describe('unitAnnualAward.service - BKTTCP DVTT variants', () => {
  it('DVTT: 7y ĐVQT + 3 BKBQP → eligible BKTTCP (streak riêng với CQDV cha)', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-bkttcp-A1', parentId: 'cqdv-parent' });
    const records = buildContiguousDVQT(dvtt.id, 'DVTT', 2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(3);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      dvtt.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(true);
  });

  it('DVTT: 14y ĐVQT → "chưa hỗ trợ"', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-bkttcp-B5', parentId: 'cqdv-parent' });
    const records = buildContiguousDVQT(dvtt.id, 'DVTT', 2010, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      dvtt.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpUnsupported);
  });
});

describe('unitAnnualAward.service - BKTTCP break-then-fresh streak', () => {
  it('E1. 5y ĐVQT → 1y ĐVTT (break) → 7y ĐVQT + 3 BKBQP trong 7y mới → eligible', async () => {
    // Streak collapses at the ĐVTT row. calculateContinuousYears walks DVQT-only records
    // backwards from currentYear and stops at the year-2017 boundary, returning streak = 7.
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-E1' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(3);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpEligible);
  });
});

describe('unitAnnualAward.service - BKTTCP countBKBQPInStreak edges', () => {
  it('D2. 13y ĐVQT + 6 BKBQP cụm đầu (2011-2016, không có cái nào trong 7y cuối) → fail với 0 BKBQP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-D2' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2011, 2023, {
      2011: { nhan_bkbqp: true },
      2012: { nhan_bkbqp: true },
      2013: { nhan_bkbqp: true },
      2014: { nhan_bkbqp: true },
      2015: { nhan_bkbqp: true },
      2016: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    // streak = 13 → start year = 2011, all 6 BKBQP fall within window — count returns 6
    const bkbqpCount = countBKBQPInWindow(records, 2024, 13);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(bkbqpCount);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    // streak overshoots cycle (13 > 7, not multiple) → missed window message.
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpMissedWindow(13));
  });
});
