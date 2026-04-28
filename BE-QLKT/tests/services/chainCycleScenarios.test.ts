import { prismaMock } from '../helpers/prismaMock';
import {
  AnnualRow,
  ScienceRow,
  buildPersonnelWithHistory,
  buildContiguousCSTDCS,
} from '../helpers/eligibilityFixtures';
import { makeUnit, makeUnitAnnualRecord } from '../helpers/fixtures';
import profileService from '../../src/services/profile.service';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { DANH_HIEU_CA_NHAN_HANG_NAM, DANH_HIEU_DON_VI_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { eligibilityReasons, unitEligibilityReasons } from '../helpers/errorMessages';

describe('Chain cycle scenarios - personal BKBQP (lỡ đợt N lần)', () => {
  it('lỡ 1 đợt năm 3 → chu kỳ 2 năm 5 vẫn eligible', async () => {
    const personnelId = 'qn-bkbqp-miss-1';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('lỡ 1 đợt → tại năm chu kỳ 2 đang còn 1 năm → not eligible', async () => {
    const personnelId = 'qn-bkbqp-miss-2';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2022);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2023,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
  });

  it('lỡ 2 đợt liên tiếp → đến năm 7 (streak=6) eligible cho cặp 5-6', async () => {
    const personnelId = 'qn-bkbqp-miss-3';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2025);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2026,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('đã nhận BKBQP cặp 1-2, đến cặp 3-4 chưa lỡ → eligible', async () => {
    const personnelId = 'qn-bkbqp-cycle2';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2023, {
      2021: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('đã nhận BKBQP cặp 1-2, lỡ cặp 3-4, đến cặp 5-6 đủ → eligible', async () => {
    const personnelId = 'qn-bkbqp-cycle3-miss';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023, {
      2019: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });
});

describe('Chain cycle scenarios - personal CSTDTQ (chu kỳ tiếp theo sau khi nhận)', () => {
  it('CSTDTQ tại năm 3 cuối cycle 1 + tiếp 3y CSTDCS với BKBQP mới → eligible CSTDTQ năm 7', async () => {
    const personnelId = 'qn-cstdtq-cycle2';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023, {
      2019: { nhan_bkbqp: true },
      2020: { nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(true);
  });

  it('CSTDTQ năm 2020, chu kỳ 2 năm 4-6 không có BKBQP mới → not eligible CSTDTQ năm 7', async () => {
    const personnelId = 'qn-cstdtq-no-new-bkbqp';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023, {
      2019: { nhan_bkbqp: true },
      2020: { nhan_cstdtq: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(false);
  });

  it('lỡ CSTDTQ 2 lần liên tiếp, BKBQP rải đều → eligible CSTDTQ chu kỳ 3 (năm 10, streak=9)', async () => {
    const personnelId = 'qn-cstdtq-miss-twice';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2015, 2023, {
      2016: { nhan_bkbqp: true },
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(true);
  });

  it('lỡ CSTDTQ 2 lần, BKBQP không nhận trong cửa sổ 3 năm cuối → not eligible CSTDTQ', async () => {
    const personnelId = 'qn-cstdtq-miss-no-recent-bkbqp';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2015, 2023, {
      2016: { nhan_bkbqp: true },
      2018: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(9, 0, 9));
  });

  it('streak=6, BKBQP đầy đủ 3 lần (lỡ CSTDTQ chu kỳ 1 năm 4) → eligible CSTDTQ chu kỳ 2 năm 7', async () => {
    const personnelId = 'qn-cstdtq-cycle2-recover';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2022, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2023,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(true);
  });

  it('streak=7, BKBQP đủ 3 lần nhưng CSTDTQ chưa nhận lần nào → BKTTCP fail (thiếu CSTDTQ)', async () => {
    const personnelId = 'qn-bkttcp-no-cstdtq';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(7, 3, 0, 7));
  });

  it('streak=7, BKBQP đủ + CSTDTQ chỉ 1 (lỡ 1 đợt CSTDTQ) → BKTTCP fail vì thiếu 1 CSTDTQ', async () => {
    const personnelId = 'qn-bkttcp-one-cstdtq';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true, nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(7, 3, 1, 7));
  });

  it('streak=4 (giữa chu kỳ, đã lỡ 1 lần) → not eligible CSTDTQ', async () => {
    const personnelId = 'qn-cstdtq-mid-cycle';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2023, {
      2021: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(4, 1, 4));
  });
});

describe('Chain cycle scenarios - personal BKTTCP (repeatable mỗi 7 năm, lifetime block sau khi nhận)', () => {
  it('Lỡ BKTTCP năm 8 → tiếp tục đến năm 14 (streak=14) flags đủ → eligible chu kỳ 2 (không cần đứt chuỗi)', async () => {
    const personnelId = 'qn-bkttcp-cycle2-no-break';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2010, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true, nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
      2023: { nhan_cstdtq: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.bkttcpEligible);
  });

  it('Lỡ BKTTCP năm 8, đến năm 10 (streak=9, không bội 7) → fail insufficient', async () => {
    const personnelId = 'qn-bkttcp-mid-cycle2';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2014, 2022, {
      2015: { nhan_bkbqp: true },
      2017: { nhan_bkbqp: true, nhan_cstdtq: true },
      2019: { nhan_bkbqp: true },
      2020: { nhan_cstdtq: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2023,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(9, 2, 2, 9));
  });

  it('Đã nhận BKTTCP năm 7 + chuỗi đến năm 14 đủ flags → "chưa hỗ trợ" (lifetime block)', async () => {
    const personnelId = 'qn-bkttcp-already-received';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2010, 2023, {
      2011: { nhan_bkbqp: true },
      2013: { nhan_bkbqp: true },
      2015: { nhan_bkbqp: true },
      2016: { nhan_bkttcp: true },
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true, nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
      2023: { nhan_cstdtq: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpAlreadyReceived);
  });
});

describe('Chain cycle scenarios - unit BKBQP (lỡ đợt)', () => {
  function buildUnitDVQT(unitId: string, fromYear: number, toYear: number) {
    return Array.from({ length: toYear - fromYear + 1 }, (_, i) =>
      makeUnitAnnualRecord({
        unitId,
        unitKind: 'CQDV',
        nam: fromYear + i,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: `QD-DVQT-${fromYear + i}`,
      })
    );
  }

  it('2y ĐVQT → eligible BKBQP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-unit-1' });
    const records = buildUnitDVQT(cqdv.id, 2022, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records.slice().reverse());

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpEligible);
  });

  it('3y ĐVQT (lỡ 1 đợt) → not eligible BKBQP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-unit-2' });
    const records = buildUnitDVQT(cqdv.id, 2021, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records.slice().reverse());

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpReason(3));
  });

  it('4y ĐVQT (lỡ 1 đợt → đỉnh chu kỳ 2) → eligible BKBQP', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-unit-3' });
    const records = buildUnitDVQT(cqdv.id, 2020, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records.slice().reverse());

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });
});

describe('Chain cycle scenarios - unit BKTTCP (lặp lại sau mỗi 7 năm)', () => {
  function arrangeResolveUnit(unit: ReturnType<typeof makeUnit>): void {
    if (unit.kind === 'CQDV') {
      prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: unit.id });
      prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    } else {
      prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
      prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({ id: unit.id });
    }
  }

  function buildUnitDVQTWithFlags(
    unitId: string,
    fromYear: number,
    toYear: number,
    flags: Partial<Record<number, { nhan_bkbqp?: boolean; nhan_bkttcp?: boolean }>> = {}
  ) {
    return Array.from({ length: toYear - fromYear + 1 }, (_, i) => {
      const nam = fromYear + i;
      const f = flags[nam] ?? {};
      return makeUnitAnnualRecord({
        unitId,
        unitKind: 'CQDV',
        nam,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: `QD-DVQT-${nam}`,
        nhan_bkbqp: f.nhan_bkbqp ?? false,
        so_quyet_dinh_bkbqp: f.nhan_bkbqp ? `QDBK-${nam}` : null,
        nhan_bkttcp: f.nhan_bkttcp ?? false,
        so_quyet_dinh_bkttcp: f.nhan_bkttcp ? `QDTT-${nam}` : null,
      });
    });
  }

  it('Chu kỳ 1 nhận BKTTCP năm 7 (2016) + chu kỳ 2 đủ BKBQP → recalc năm 14 (2023) eligible BKTTCP lần 2', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-cycle2' });
    const records = buildUnitDVQTWithFlags(cqdv.id, 2010, 2023, {
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
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(
      records.slice().sort((a, b) => b.nam - a.nam)
    );
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(14);
    expect(upsertArgs.update.du_dieu_kien_bk_thu_tuong).toBe(true);
  });

  it('Lỡ BKTTCP chu kỳ 1 (năm 2016 không nhận) + chu kỳ 2 đủ BKBQP → recalc năm 14 vẫn eligible', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-miss-cycle1' });
    const records = buildUnitDVQTWithFlags(cqdv.id, 2010, 2023, {
      2011: { nhan_bkbqp: true },
      2013: { nhan_bkbqp: true },
      2015: { nhan_bkbqp: true },
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(
      records.slice().sort((a, b) => b.nam - a.nam)
    );
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(14);
    expect(upsertArgs.update.du_dieu_kien_bk_thu_tuong).toBe(true);
  });

  it('14y ĐVQT chưa từng nhận BKTTCP, 3 BKBQP cụm chu kỳ 1 (năm 2/4/6) + chu kỳ 2 không có BKBQP → not eligible (cửa sổ 7y trượt)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-cycle1-only' });
    const records = buildUnitDVQTWithFlags(cqdv.id, 2010, 2023, {
      2011: { nhan_bkbqp: true },
      2013: { nhan_bkbqp: true },
      2015: { nhan_bkbqp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(
      records.slice().sort((a, b) => b.nam - a.nam)
    );
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(14);
    expect(upsertArgs.update.du_dieu_kien_bk_thu_tuong).toBe(false);
  });

  it('21y ĐVQT, đã nhận BKTTCP năm 2009 + 2016, chu kỳ 3 đủ BKBQP (2018/20/22) → eligible BKTTCP lần 3', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-cycle3' });
    const records = buildUnitDVQTWithFlags(cqdv.id, 2003, 2023, {
      2009: { nhan_bkttcp: true },
      2016: { nhan_bkttcp: true },
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(
      records.slice().sort((a, b) => b.nam - a.nam)
    );
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(21);
    expect(upsertArgs.update.du_dieu_kien_bk_thu_tuong).toBe(true);
  });
});

describe('Chain cycle scenarios - personal BKBQP recalc + missed counts', () => {
  it('streak=3 chưa nhận BKBQP → recalc lưu chainContext.missedBkbqp=1', async () => {
    const personnelId = 'qn-bkbqp-recalc-missed';
    const danhHieu: AnnualRow[] = [];
    const nckh: ScienceRow[] = [];
    for (let y = 2021; y <= 2023; y++) {
      danhHieu.push({
        nam: y,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: `QD-CSTDCS-${y}`,
      });
      nckh.push({ nam: y });
    }
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await profileService.recalculateAnnualProfile(personnelId, 2024);

    const args = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args.update.cstdcs_lien_tuc).toBe(3);
    expect(args.update.du_dieu_kien_bkbqp).toBe(false);
  });

  it('streak=4 chưa nhận BKBQP (đỉnh chu kỳ 2 sau khi lỡ 1) → eligible', async () => {
    const personnelId = 'qn-bkbqp-recalc-cycle2';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await profileService.recalculateAnnualProfile(personnelId, 2024);

    const args = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args.update.cstdcs_lien_tuc).toBe(4);
    expect(args.update.du_dieu_kien_bkbqp).toBe(true);
  });
});

describe('Chain cycle scenarios - eligibilityReasons untouched cho personal', () => {
  it('Personal BKBQP insufficient streak vẫn dùng cstdcs_lien_tuc trong reason', async () => {
    const personnelId = 'qn-bkbqp-reason';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2021, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkbqpReason(3, 3));
  });
});
