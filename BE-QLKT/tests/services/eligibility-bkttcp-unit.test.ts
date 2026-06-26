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

describe('Xét điều kiện BKTTCP đơn vị: chu kỳ lặp lại sau mỗi 7 năm', () => {
  it('Xét điều kiện BKTTCP đơn vị (CQDV): 7 năm ĐVQT + 3 BKBQP trong chuỗi → đủ điều kiện', async () => {
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

  it('Xét điều kiện BKTTCP đơn vị: 7 năm ĐVQT + chỉ 2 BKBQP (thiếu 1 BKBQP) → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKTTCP đơn vị: 7 năm ĐVQT + 4 BKBQP → đủ điều kiện (từ 3 BKBQP trở lên là đạt, đơn vị không giới hạn một lần)', async () => {
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

describe('Xét điều kiện BKTTCP đơn vị: mốc số năm liên tục (chỉ đạt tại mốc chu kỳ 7 năm)', () => {
  it('Xét điều kiện BKTTCP đơn vị: chỉ 6 năm ĐVQT + 3 BKBQP → chưa đủ điều kiện (chưa đủ 7 năm liên tục)', async () => {
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

  it('Xét điều kiện BKTTCP đơn vị: 8 năm ĐVQT (chưa tới mốc chu kỳ 7 năm) + 3 BKBQP → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKTTCP đơn vị: 13 năm ĐVQT (chưa tới mốc chu kỳ 7 năm) → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKTTCP đơn vị: 14 năm ĐVQT (đúng mốc chu kỳ 7 năm) + 3 BKBQP trong cửa sổ 7 năm gần nhất → đủ điều kiện (mốc chu kỳ thứ 2)', async () => {
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

  it('Xét điều kiện BKTTCP đơn vị: 21 năm ĐVQT (đúng mốc chu kỳ 7 năm) nhưng 0 BKBQP trong cửa sổ 7 năm gần nhất → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKTTCP đơn vị: 15 năm ĐVQT (chưa tới mốc chu kỳ 7 năm) → chưa đủ điều kiện', async () => {
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

describe('Xét điều kiện BKTTCP đơn vị: đã nhận trước đó vẫn được nhận lại (không giới hạn một lần)', () => {
  it('Xét điều kiện BKTTCP đơn vị: đã nhận BKTTCP cũ + chuỗi 7 năm mới + 3 BKBQP → đủ điều kiện (không khóa một lần)', async () => {
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

  it('Xét điều kiện BKTTCP đơn vị: đã nhận năm 2016 + 14 năm ĐVQT (mốc chu kỳ thứ 2) + 3 BKBQP trong cửa sổ 7 năm gần nhất → đủ điều kiện', async () => {
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

describe('Xét điều kiện BKTTCP đơn vị: trường hợp đơn vị trực thuộc (DVTT)', () => {
  it('Xét điều kiện BKTTCP đơn vị (DVTT): 7 năm ĐVQT + 3 BKBQP → đủ điều kiện (chuỗi tính riêng, độc lập với CQDV cha)', async () => {
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

  it('Xét điều kiện BKTTCP đơn vị (DVTT): 14 năm ĐVQT (đúng mốc chu kỳ 7 năm) nhưng 0 BKBQP trong cửa sổ 7 năm gần nhất → chưa đủ điều kiện', async () => {
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

describe('Xét điều kiện BKTTCP đơn vị: chuỗi mới sau khi chuỗi ĐVQT bị đứt', () => {
  it('Xét điều kiện BKTTCP đơn vị: 5 năm ĐVQT → 1 năm không đạt ĐVQT làm đứt chuỗi → 7 năm ĐVQT mới + 3 BKBQP trong chuỗi mới → đủ điều kiện', async () => {
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

describe('Xét điều kiện BKTTCP đơn vị: biên của cửa sổ đếm BKBQP', () => {
  it('Xét điều kiện BKTTCP đơn vị: 13 năm ĐVQT + 6 BKBQP dồn cụm đầu (không có cái nào trong cửa sổ 7 năm gần nhất) → chưa đủ điều kiện', async () => {
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

describe('Xét điều kiện chuỗi danh hiệu đơn vị: tính lại hồ sơ và cập nhật các cờ điều kiện', () => {
  it('Xét điều kiện BKTTCP đơn vị (tính lại hồ sơ): 14 năm ĐVQT + đã nhận BKTTCP 2016 + 3 BKBQP trong chu kỳ 2 (2017-2023) → đủ điều kiện', async () => {
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
    expect(upsertArgs.update.du_dieu_kien_bkttcp).toBe(true);
    expect(upsertArgs.update.goi_y).toBe(suggestionMessages.unitEligibleBkttcp);
  });

  it('Xét điều kiện BKBQP đơn vị (tính lại hồ sơ): 7 năm ĐVQT nhưng BKBQP lệch mốc chu kỳ (2022) → chưa đủ điều kiện BKBQP (đếm số năm liên tục thô, không reset theo lần nhận)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-recalc-bkbqp-offcycle' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2018, 2024, {
      2022: { nhan_bkbqp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2025);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(7);
    expect(upsertArgs.update.du_dieu_kien_bkbqp).toBe(false);
  });

  it('Xét điều kiện BKBQP đơn vị: cùng dữ liệu thì kết quả tính lại hồ sơ phải khớp kết quả kiểm tra qua API (hai đường không được lệch)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-recalc-api-consistency' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2018, 2024, {
      2022: { nhan_bkbqp: true },
    });

    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);
    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2025);
    const recalcEligible =
      prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0].update.du_dieu_kien_bkbqp;

    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);
    const apiResult = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2025,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(recalcEligible).toBe(apiResult.eligible);
    expect(recalcEligible).toBe(false);
  });

  it('Xét điều kiện BKTTCP đơn vị (tính lại hồ sơ): 21 năm ĐVQT + đã nhận BKTTCP 2009 + 0 BKBQP trong chu kỳ hiện tại → chưa đủ điều kiện', async () => {
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
    expect(upsertArgs.update.du_dieu_kien_bkttcp).toBe(false);
    expect(upsertArgs.update.goi_y).toBe(suggestionMessages.unitNotEligible);
  });

  it('Xét điều kiện BKTTCP đơn vị (tính lại hồ sơ): 7 năm ĐVQT + 3 BKBQP → cập nhật đủ điều kiện BKTTCP', async () => {
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
    expect(upsertArgs.update.du_dieu_kien_bkbqp).toBe(false);
    expect(upsertArgs.update.du_dieu_kien_bkttcp).toBe(true);
    expect(upsertArgs.update.goi_y).toBe(suggestionMessages.unitEligibleBkttcp);
  });
});
