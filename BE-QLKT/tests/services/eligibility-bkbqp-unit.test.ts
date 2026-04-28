import { prismaMock } from '../helpers/prismaMock';
import { makeUnit, makeUnitAnnualRecord } from '../helpers/fixtures';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { DANH_HIEU_DON_VI_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { unitEligibilityReasons } from '../helpers/errorMessages';

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
  it('2y ĐVQT → eligible (boundary tối thiểu)', async () => {
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

  it('4y ĐVQT → eligible (chia 2)', async () => {
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

  it('6y ĐVQT → eligible (chia 2)', async () => {
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

  it('3y ĐVQT → fail (NOT mod 2)', async () => {
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

  it('5y ĐVQT → fail (NOT mod 2)', async () => {
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

  it('7y ĐVQT → fail BKBQP (NOT mod 2)', async () => {
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

  it('0y ĐVQT (no records) → fail', async () => {
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

  it('Đã nhận BKBQP đơn vị (trong streak) + 4y ĐVQT mới → eligible (chain cho phép nhiều BKBQP)', async () => {
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

describe('unitAnnualAward.service - checkUnitAwardEligibility (BKBQP)', () => {
  it('CQDV: 2y ĐVQT liên tục → eligible BKBQP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-1' });
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
  });

  it('CQDV: 1y ĐVQT → fail BKBQP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-2' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2023, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpReason(1));
  });

  it('CQDV: 2y nhưng ĐVTT giữa → break, fail BKBQP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-3' });
    const dvqtOnly = [
      makeUnitAnnualRecord({
        unitId: cqdv.id,
        unitKind: 'CQDV',
        nam: 2022,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: 'QD-DVQT-2022',
      }),
    ];
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtOnly);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtOnly);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpReason(0));
  });

  it('DVTT: 2y ĐVQT → eligible (records keyed bằng don_vi_truc_thuoc_id)', async () => {
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-bkbqp-4', parentId: 'cqdv-parent' });
    const records = buildContiguousDVQT(dvtt.id, 'DVTT', 2022, 2023);
    expect(records[0].don_vi_truc_thuoc_id).toBe(dvtt.id);
    expect(records[0].co_quan_don_vi_id).toBeNull();

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

  it('streak gián đoạn: 5y ĐVQT → 1y ĐVTT → 2y ĐVQT → streak = 2, eligible BKBQP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-5' });
    const dvqtOnly = [
      makeUnitAnnualRecord({ unitId: cqdv.id, unitKind: 'CQDV', nam: 2025, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT, so_quyet_dinh: 'QD-DVQT-2025' }),
      makeUnitAnnualRecord({ unitId: cqdv.id, unitKind: 'CQDV', nam: 2024, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT, so_quyet_dinh: 'QD-DVQT-2024' }),
      makeUnitAnnualRecord({ unitId: cqdv.id, unitKind: 'CQDV', nam: 2022, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT, so_quyet_dinh: 'QD-DVQT-2022' }),
      makeUnitAnnualRecord({ unitId: cqdv.id, unitKind: 'CQDV', nam: 2021, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT, so_quyet_dinh: 'QD-DVQT-2021' }),
      makeUnitAnnualRecord({ unitId: cqdv.id, unitKind: 'CQDV', nam: 2020, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT, so_quyet_dinh: 'QD-DVQT-2020' }),
      makeUnitAnnualRecord({ unitId: cqdv.id, unitKind: 'CQDV', nam: 2019, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT, so_quyet_dinh: 'QD-DVQT-2019' }),
      makeUnitAnnualRecord({ unitId: cqdv.id, unitKind: 'CQDV', nam: 2018, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT, so_quyet_dinh: 'QD-DVQT-2018' }),
    ];
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtOnly);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtOnly);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2026,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('gap year: ĐVQT 2020-2021, missing 2022, ĐVQT 2023-2024 → streak = 2 từ 2023, eligible', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-6' });
    const dvqtOnly = [
      makeUnitAnnualRecord({ unitId: cqdv.id, unitKind: 'CQDV', nam: 2024, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT, so_quyet_dinh: 'QD-DVQT-2024' }),
      makeUnitAnnualRecord({ unitId: cqdv.id, unitKind: 'CQDV', nam: 2023, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT, so_quyet_dinh: 'QD-DVQT-2023' }),
      makeUnitAnnualRecord({ unitId: cqdv.id, unitKind: 'CQDV', nam: 2021, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT, so_quyet_dinh: 'QD-DVQT-2021' }),
      makeUnitAnnualRecord({ unitId: cqdv.id, unitKind: 'CQDV', nam: 2020, danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT, so_quyet_dinh: 'QD-DVQT-2020' }),
    ];
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtOnly);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtOnly);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2025,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('đã nhận BKBQP đơn vị năm trước trong streak → vẫn eligible nếu chuỗi tiếp tục đủ 2y', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-7' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2021, 2024, {
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(1);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2025,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });
});
