import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeAnnualRecord, makeThanhTichKhoaHoc } from '../helpers/fixtures';
import profileService from '../../src/services/profile.service';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { eligibilityReasons } from '../helpers/errorMessages';

beforeEach(() => {
  resetPrismaMock();
});

interface AnnualRow {
  nam: number;
  danh_hieu: string | null;
  so_quyet_dinh?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
}

interface ScienceRow {
  nam: number;
}

function buildPersonnelWithHistory(
  personnelId: string,
  danhHieuRows: AnnualRow[],
  thanhTichRows: ScienceRow[]
) {
  const base = makePersonnel({ id: personnelId });
  return {
    ...base,
    DanhHieuHangNam: danhHieuRows.map(r =>
      makeAnnualRecord({
        personnelId,
        nam: r.nam,
        danh_hieu: r.danh_hieu,
        so_quyet_dinh: r.so_quyet_dinh,
        nhan_bkbqp: r.nhan_bkbqp,
        so_quyet_dinh_bkbqp: r.so_quyet_dinh_bkbqp,
        nhan_cstdtq: r.nhan_cstdtq,
        so_quyet_dinh_cstdtq: r.so_quyet_dinh_cstdtq,
        nhan_bkttcp: r.nhan_bkttcp,
        so_quyet_dinh_bkttcp: r.so_quyet_dinh_bkttcp,
      })
    ),
    ThanhTichKhoaHoc: thanhTichRows.map(r => makeThanhTichKhoaHoc({ personnelId, nam: r.nam })),
  };
}

function buildContiguousCSTDCS(
  fromYear: number,
  toYear: number,
  flags: Partial<Record<number, Pick<AnnualRow, 'nhan_bkbqp' | 'nhan_cstdtq' | 'nhan_bkttcp'>>> = {}
): { danhHieu: AnnualRow[]; nckh: ScienceRow[] } {
  const danhHieu: AnnualRow[] = [];
  const nckh: ScienceRow[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    const yearFlags = flags[y] ?? {};
    const nhan_bkbqp = yearFlags.nhan_bkbqp ?? false;
    const nhan_cstdtq = yearFlags.nhan_cstdtq ?? false;
    const nhan_bkttcp = yearFlags.nhan_bkttcp ?? false;
    danhHieu.push({
      nam: y,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: `QD-CSTDCS-${y}`,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp: nhan_bkbqp ? `QDBK-${y}` : null,
      nhan_cstdtq,
      so_quyet_dinh_cstdtq: nhan_cstdtq ? `QDTQ-${y}` : null,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp: nhan_bkttcp ? `QDTT-${y}` : null,
    });
    nckh.push({ nam: y });
  }
  return { danhHieu, nckh };
}

describe('profile.service - CSTDTQ exhaustive boundaries', () => {
  it('1. 3y CSTDCS + 1 BKBQP + 3 NCKH → eligible (boundary tối thiểu)', async () => {
    const personnelId = 'qn-cstdtq-ex-1';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2021, 2023, {
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
    expect(result.reason).toBe(eligibilityReasons.cstdtqEligible);
  });

  it('2. 6y CSTDCS + 2 BKBQP + 6 NCKH → missed window (streak 6 > 3, strict cycle)', async () => {
    // Strict-cycle rule: CSTDTQ must hit boundary streak === 3 exactly. Continuous overshoot
    // means operator already passed the year-3 review and must wait for the next chain.
    const personnelId = 'qn-cstdtq-ex-2';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023, {
      2019: { nhan_bkbqp: true },
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
    expect(result.reason).toBe(eligibilityReasons.cstdtqMissedWindow(6));
  });

  it('3. 9y CSTDCS + 3 BKBQP + 9 NCKH → missed window (streak 9 > 3, strict cycle)', async () => {
    const personnelId = 'qn-cstdtq-ex-3';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2015, 2023, {
      2016: { nhan_bkbqp: true },
      2019: { nhan_bkbqp: true },
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

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.cstdtqMissedWindow(9));
  });

  it('4. 4y CSTDCS + 2 BKBQP + 4 NCKH → missed window (4 > 3, NOT mod 3)', async () => {
    const personnelId = 'qn-cstdtq-ex-4';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2023, {
      2021: { nhan_bkbqp: true },
      2023: { nhan_bkbqp: true },
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
    expect(result.reason).toBe(eligibilityReasons.cstdtqMissedWindow(4));
  });

  it('5. 5y CSTDCS + 2 BKBQP + 5 NCKH → missed window (5 > 3, NOT mod 3)', async () => {
    const personnelId = 'qn-cstdtq-ex-5';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2019, 2023, {
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

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.cstdtqMissedWindow(5));
  });

  it('6. 7y CSTDCS + 3 BKBQP + 7 NCKH → missed window CSTDTQ (7 > 3, NOT mod 3)', async () => {
    const personnelId = 'qn-cstdtq-ex-6';
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
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.cstdtqMissedWindow(7));
  });

  it('7. 8y CSTDCS + 4 BKBQP → missed window (8 > 3, NOT mod 3)', async () => {
    const personnelId = 'qn-cstdtq-ex-7';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2016, 2023, {
      2017: { nhan_bkbqp: true },
      2019: { nhan_bkbqp: true },
      2021: { nhan_bkbqp: true },
      2023: { nhan_bkbqp: true },
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
    expect(result.reason).toBe(eligibilityReasons.cstdtqMissedWindow(8));
  });

  it('8. 3y CSTDCS + 0 BKBQP → fail (no BKBQP in streak)', async () => {
    const personnelId = 'qn-cstdtq-ex-8';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2021, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(3, 0, 3));
  });

  it('9. 2y CSTDCS + 1 BKBQP → fail (streak < 3)', async () => {
    const personnelId = 'qn-cstdtq-ex-9';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2022, 2023, {
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

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(2, 1, 2));
  });

  it('10. 3y CSTDCS + 1 BKBQP nhưng NCKH chỉ có 2y → fail (NCKH thiếu)', async () => {
    const personnelId = 'qn-cstdtq-ex-10';
    const { danhHieu } = buildContiguousCSTDCS(2021, 2023, {
      2022: { nhan_bkbqp: true },
    });
    const nckh: ScienceRow[] = [{ nam: 2022 }, { nam: 2023 }];
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(3, 1, 2));
  });

  it('11b. 9y CSTDCS + 3 BKBQP đầu chuỗi → missed window (streak 9 > 3 dominates count check)', async () => {
    // Streak overshoots cycle boundary — missed-window reason fires regardless of whether
    // BKBQP scattering would have satisfied the current 3y window in the old non-strict rule.
    const personnelId = 'qn-cstdtq-ex-11b';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2015, 2023, {
      2016: { nhan_bkbqp: true },
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
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
    expect(result.reason).toBe(eligibilityReasons.cstdtqMissedWindow(9));
  });

  it('12. Đã nhận CSTDTQ năm 2020 (trong streak) + 6y CSTDCS + BKBQP 2022 → eligible (effective streak = 3 sau claim)', async () => {
    // Last CSTDTQ claim resets the cycle counter. Effective streak = (2024-1) - 2020 = 3,
    // which lands exactly on the next CSTDTQ boundary; BKBQP 2022 covers the cycle window.
    const personnelId = 'qn-cstdtq-ex-11';
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
    expect(result.reason).toBe(eligibilityReasons.cstdtqEligible);
  });

  it('13. 3y CSTDCS + 1 CSTT + 3y CSTDCS (streak reset to 3 sau break) + BKBQP trong 3y cuối → eligible', async () => {
    // Break (CSTT) restarts streak — fresh 3y chain qualifies for CSTDTQ when BKBQP lands inside.
    const personnelId = 'qn-cstdtq-ex-13';
    const danhHieu: AnnualRow[] = [];
    const nckh: ScienceRow[] = [];
    for (let y = 2017; y <= 2019; y++) {
      danhHieu.push({
        nam: y,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: `QD-CSTDCS-${y}`,
      });
      nckh.push({ nam: y });
    }
    danhHieu.push({
      nam: 2020,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      so_quyet_dinh: 'QD-CSTT-2020',
    });
    nckh.push({ nam: 2020 });
    danhHieu.push({
      nam: 2021,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2021',
    });
    danhHieu.push({
      nam: 2022,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2022',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QDBK-2022',
    });
    danhHieu.push({
      nam: 2023,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2023',
    });
    nckh.push({ nam: 2021 }, { nam: 2022 }, { nam: 2023 });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.cstdtqEligible);
  });

  it('15. Claim CSTDTQ 2020 + claim 2023 + BKBQP 2024 + 7y CSTDCS → eligible (effective streak 3 sau claim 2023, BKBQP trong cycle window 2024-2026 evalYear 2027)', async () => {
    // Two prior claims: latest at 2023 resets the cycle counter. evalYear 2027 → effective
    // streak = 2027-1-2023 = 3. BKBQP 2024 lands inside the 3y cycle window 2024-2026.
    const personnelId = 'qn-cstdtq-ex-15';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2026, {
      2020: { nhan_cstdtq: true },
      2023: { nhan_cstdtq: true },
      2024: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2027,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.cstdtqEligible);
  });

  it('16. Claim CSTDTQ 2021 + 4y CSTDCS + BKBQP 2022 → eligible năm 2025 (effective streak 3)', async () => {
    // evalYear 2025, claim 2021, effective = 2025-1-2021 = 3 → boundary hit; BKBQP 2022
    // covers cycle window 2022-2024.
    const personnelId = 'qn-cstdtq-ex-16';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2021, 2024, {
      2021: { nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2025,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(true);
  });

  it('17. Claim CSTDTQ 2021 + BKBQP 2022 + eval 2024 → fail (effective streak chỉ 2)', async () => {
    // Cycle counter restarted by claim 2021 — effective = 2024-1-2021 = 2 < cycle 3.
    // Prior claim suppresses the missed-window message; surfaces regular insufficient reason.
    const personnelId = 'qn-cstdtq-ex-17';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2021, 2023, {
      2021: { nhan_cstdtq: true },
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

    expect(result.eligible).toBe(false);
    expect(result.reason).not.toMatch(/Đã bỏ lỡ/);
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(3, 1, 3));
  });

  it('14b. 5y CSTDCS continuous → 1 CSTT → 3y CSTDCS + BKBQP trong streak → eligible (streak resets to 3)', async () => {
    const personnelId = 'qn-cstdtq-ex-14';
    const danhHieu: AnnualRow[] = [];
    const nckh: ScienceRow[] = [];
    for (let y = 2015; y <= 2019; y++) {
      danhHieu.push({
        nam: y,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: `QD-CSTDCS-${y}`,
      });
      nckh.push({ nam: y });
    }
    danhHieu.push({
      nam: 2020,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      so_quyet_dinh: 'QD-CSTT-2020',
    });
    nckh.push({ nam: 2020 });
    danhHieu.push({
      nam: 2021,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2021',
      nhan_bkbqp: true,
      so_quyet_dinh_bkbqp: 'QDBK-2021',
    });
    danhHieu.push({
      nam: 2022,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2022',
    });
    danhHieu.push({
      nam: 2023,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      so_quyet_dinh: 'QD-CSTDCS-2023',
    });
    nckh.push({ nam: 2021 }, { nam: 2022 }, { nam: 2023 });
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
});
