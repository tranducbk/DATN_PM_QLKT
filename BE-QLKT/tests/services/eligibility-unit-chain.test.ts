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

/** Stubs the two findUnique lookups used by `resolveUnit`. */
function arrangeResolveUnit(unit: ReturnType<typeof makeUnit>): void {
  if (unit.kind === 'CQDV') {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: unit.id });
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
  } else {
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
    prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({ id: unit.id });
  }
}

/** Builds a contiguous DVQT sequence for years [from, to] inclusive. */
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

/** Filters DVQT-only records sorted desc by year, used by `calculateContinuousYears`. */
function dvqtRecordsDesc(records: { nam: number; danh_hieu?: string | null }[]) {
  return records
    .filter(r => r.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.DVQT)
    .sort((a, b) => b.nam - a.nam);
}

describe('unitAnnualAward.service - checkUnitAwardEligibility (BKBQP)', () => {
  it('CQDV: 2y ĐVQT liên tục → eligible BKBQP', async () => {
    // Cho: CQDV có records DVQT cho 2022-2023
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-1' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2022, 2023);
    // findMany của calculateContinuousYears (DVQT-only, desc)
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    // countBKBQPInStreak gọi lại calculateContinuousYears bên trong
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    // Khi
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    // Thì
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
    // Cho: 2022 DVQT, 2023 DVTT — calculateContinuousYears chỉ trả row DVQT
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
    // Cả 2 findMany đã filter chỉ DVQT — row DVTT bị loại
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtOnly);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtOnly);
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    // Khi: streak kết 2023 — record 2022 không tại currentYear=2023, streak = 0
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
    // Verify records có don_vi_truc_thuoc_id (không phải co_quan_don_vi_id)
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
    // Cho: 2018-2022 DVQT, 2023 DVTT, 2024-2025 DVQT — calculateContinuousYears DVQT-only thấy gap
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

    // Khi: target year 2026 → streak kết 2025, duyệt 2024 (match), 2023 (DVTT gap → break)
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2026,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    // Thì: streak = 2 (2024-2025), 2%2==0 → eligible
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
    // Cho: BKBQP năm 2022, 4y liên tục 2021-2024
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-7' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2021, 2024, {
      2022: { nhan_bkbqp: true },
    });
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(1);

    // Khi: streak = 4, 4%2==0 → eligible (chain cho phép nhiều BKBQP)
    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2025,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });
});

describe('unitAnnualAward.service - checkUnitAwardEligibility (BKTTCP)', () => {
  it('7y ĐVQT + 3 BKBQP trong streak → eligible BKTTCP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-1' });
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
  });

  it('7y ĐVQT + 2 BKBQP → fail (thiếu 1 BKBQP)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-2' });
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

  it('14y mod 7 == 0 → "chưa hỗ trợ"', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-3' });
    const records = buildContiguousDVQT(cqdv.id, 'CQDV', 2010, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(7);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpUnsupported);
  });

  it('đã nhận BKTTCP đơn vị + streak 7y mới → lifetime block "khen thưởng một lần duy nhất"', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-4' });
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

  it('CQDV vs DVTT: eligibility tính riêng — DVTT có streak riêng', async () => {
    // DVTT: 2y DVQT liên tục keyed bằng don_vi_truc_thuoc_id
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-bkttcp-5', parentId: 'cqdv-parent' });
    const records = buildContiguousDVQT(dvtt.id, 'DVTT', 2022, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(0);

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      dvtt.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
    );

    // Thì: 2y < 7y, fail BKTTCP (streak riêng với CQDV cha)
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkttcpReason(2, 0));
  });
});

describe('unitAnnualAward.service - recalculateAnnualUnit (chain flags)', () => {
  it('lifetime block: 14y ĐVQT + đã nhận BKTTCP → goi_y "chưa hỗ trợ"', async () => {
    // Cho: 14y liên tục, cờ BKTTCP đặt giữa
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
    // (1) findMany approved-records — full list với status APPROVED
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    // (2) findMany của calculateTotalDVQT
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    // (3) findMany của calculateContinuousYears — DVQT-only desc
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(dvqtRecordsDesc(records));
    // (4) count của countBKBQPInStreak
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(7);
    // (5) upsert hoSoDonViHangNam
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    // Khi
    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    // Thì: streak 14, cờ BKTTCP kích hoạt → message "chưa hỗ trợ"
    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(14);
    expect(upsertArgs.update.du_dieu_kien_bk_thu_tuong).toBe(false);
    expect(upsertArgs.update.goi_y).toBe(suggestionMessages.unitUnsupported);
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
    prismaMock.danhHieuDonViHangNam.count.mockResolvedValueOnce(3);
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(7);
    expect(upsertArgs.update.du_dieu_kien_bk_tong_cuc).toBe(false); // 7 % 2 != 0
    expect(upsertArgs.update.du_dieu_kien_bk_thu_tuong).toBe(true);
    expect(upsertArgs.update.goi_y).toBe(suggestionMessages.unitEligibleBkttcp);
  });
});
