import { prismaMock } from '../helpers/prismaMock';
import { makeUnit, makeUnitAnnualRecord } from '../helpers/fixtures';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { DANH_HIEU_DON_VI_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { unitEligibilityReasons, suggestionMessages } from '../helpers/errorMessages';

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

/** Counts BKBQP flags within the last `streak` years from `year-1` (matches checkUnitAwardEligibility window). */
function countBKBQPInWindow(
  records: { nam: number; nhan_bkbqp?: boolean }[],
  year: number,
  streak: number
): number {
  const startYear = year - streak;
  const endYear = year - 1;
  return records.filter(r => r.nhan_bkbqp === true && r.nam >= startYear && r.nam <= endYear).length;
}

describe('unitAnnualAward.service - BKTTCP eligibility (lặp lại sau 7 năm)', () => {
  it('CQDV: 7y ĐVQT + 3 BKBQP trong streak → eligible', async () => {
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

  it('7y ĐVQT + 2 BKBQP → fail (thiếu 1 BKBQP)', async () => {
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

  it('7y ĐVQT + 4 BKBQP → eligible (>=3 BKBQP đủ rồi)', async () => {
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

    expect(result.eligible).toBe(true);
  });
});

describe('unitAnnualAward.service - BKTTCP streak length boundary (chấp nhận bội số 7)', () => {
  it('6y ĐVQT + 3 BKBQP → fail (streak < 7)', async () => {
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

  it('8y ĐVQT (không bội 7) + 3 BKBQP → fail "Chưa đủ điều kiện..."', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-B3' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2016, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    const bkbqpCount = countBKBQPInWindow(records, 2024, 7);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(bkbqpCount);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpReason(8, bkbqpCount));
  });

  it('13y ĐVQT (không bội 7) → fail insufficient', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-B4-13' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2011, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    const bkbqpCount = countBKBQPInWindow(records, 2024, 7);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(bkbqpCount);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpReason(13, bkbqpCount));
  });

  it('14y ĐVQT (bội 7) + 3 BKBQP trong 7y cuối → eligible (chu kỳ 2)', async () => {
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

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpEligible);
  });

  it('21y ĐVQT (bội 7) + 0 BKBQP trong 7y cuối → fail insufficient', async () => {
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
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpReason(21, 0));
  });

  it('15y ĐVQT (không bội 7) → fail insufficient', async () => {
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
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpReason(15, 0));
  });
});

describe('unitAnnualAward.service - BKTTCP đã nhận trước (cho phép nhận lại)', () => {
  it('Đã nhận BKTTCP cũ + chuỗi 7y mới + 3 BKBQP → eligible (không lifetime block)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-C1' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true, nhan_bkttcp: true },
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
  });

  it('Đã nhận BKTTCP năm 2016 + 14y ĐVQT (chu kỳ 2) + 3 BKBQP trong 7y cuối → eligible', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-C2' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2010, 2023, {
      2016: { nhan_bkttcp: true },
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

  it('DVTT: 14y ĐVQT (bội 7) + 0 BKBQP trong 7y cuối → fail insufficient', async () => {
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
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpReason(14, 0));
  });
});

describe('unitAnnualAward.service - BKTTCP break-then-fresh streak', () => {
  it('5y ĐVQT → 1y ĐVTT (break) → 7y ĐVQT + 3 BKBQP trong 7y mới → eligible', async () => {
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

describe('unitAnnualAward.service - BKTTCP BKBQP window edges', () => {
  it('13y ĐVQT + 6 BKBQP cụm đầu (không có cái nào trong 7y cuối) → fail (insufficient streak chu kỳ)', async () => {
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
    const bkbqpCount = countBKBQPInWindow(records, 2024, 7);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(bkbqpCount);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpReason(13, bkbqpCount));
  });
});

describe('unitAnnualAward.service - recalculateAnnualUnit (chain flags)', () => {
  it('14y ĐVQT + đã nhận BKTTCP 2016 + 3 BKBQP trong cycle 2 (2017-2023) → eligible BKTTCP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-recalc-1' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2010, 2023, {
      2011: { nhan_bkbqp: true },
      2013: { nhan_bkbqp: true },
      2015: { nhan_bkbqp: true },
      2016: { nhan_bkttcp: true },
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(14);
    expect(upsertArgs.update.du_dieu_kien_bk_thu_tuong).toBe(true);
    expect(upsertArgs.update.goi_y).toBe(suggestionMessages.unitEligibleBkttcp);
  });

  it('21y ĐVQT + đã nhận BKTTCP 2009 + 0 BKBQP trong cycle hiện tại → not eligible BKTTCP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-C3' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2003, 2023, {
      2009: { nhan_bkttcp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(21);
    expect(upsertArgs.update.du_dieu_kien_bk_thu_tuong).toBe(false);
    expect(upsertArgs.update.goi_y).toBe(suggestionMessages.unitNotEligible);
  });

  it('7y ĐVQT + 3 BKBQP → recalc set du_dieu_kien_bk_thu_tuong = true', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-recalc-2' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(7);
    expect(upsertArgs.update.du_dieu_kien_bk_tong_cuc).toBe(false);
    expect(upsertArgs.update.du_dieu_kien_bk_thu_tuong).toBe(true);
    expect(upsertArgs.update.goi_y).toBe(suggestionMessages.unitEligibleBkttcp);
  });
});
