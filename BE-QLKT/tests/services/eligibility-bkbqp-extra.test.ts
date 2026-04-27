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

describe('profile.service - BKBQP exhaustive boundaries', () => {
  it('1. 2y CSTDCS + 2 NCKH → eligible (boundary tối thiểu)', async () => {
    const personnelId = 'qn-bkbqp-ex-1';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2022, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.bkbqpEligible);
  });

  it('2. 4y CSTDCS + 4 NCKH → eligible (chia 2)', async () => {
    const personnelId = 'qn-bkbqp-ex-2';
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

  it('3. 6y CSTDCS + 6 NCKH → eligible (chia 2)', async () => {
    const personnelId = 'qn-bkbqp-ex-3';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023);
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

  it('4. 3y CSTDCS + NCKH đủ → fail (NOT mod 2)', async () => {
    const personnelId = 'qn-bkbqp-ex-4';
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

  it('5. 5y CSTDCS + NCKH đủ → fail (NOT mod 2)', async () => {
    const personnelId = 'qn-bkbqp-ex-5';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2019, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkbqpReason(5, 5));
  });

  it('6. 7y CSTDCS + NCKH đủ → fail BKBQP (NOT mod 2)', async () => {
    const personnelId = 'qn-bkbqp-ex-6';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkbqpReason(7, 7));
  });

  it('7. 1y CSTDCS + 1 NCKH → fail (streak < 2)', async () => {
    const personnelId = 'qn-bkbqp-ex-7';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2023, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkbqpReason(1, 1));
  });

  it('8. 2y CSTDCS + chỉ 1 NCKH → fail (NCKH thiếu)', async () => {
    const personnelId = 'qn-bkbqp-ex-8';
    const { danhHieu } = buildContiguousCSTDCS(2022, 2023);
    const nckh: ScienceRow[] = [{ nam: 2023 }];
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkbqpReason(2, 1));
  });

  it('9. Đã nhận BKBQP năm trước (trong streak) + 4y CSTDCS mới → eligible (chain cho phép nhiều BKBQP)', async () => {
    // Given: 4y contiguous CSTDCS, BKBQP at year 2 in streak
    const personnelId = 'qn-bkbqp-ex-9';
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

    // 4 % 2 == 0, NCKH 4 >= 4 → eligible (lifetime not blocked)
    expect(result.eligible).toBe(true);
  });

  it('10. Claim BKBQP 2022 + 2y CSTDCS + eval 2024 → eligible (effective streak 2024-1-2022 = 1? thực ra 2)', async () => {
    // Claim 2022, evalYear 2024 → effective = 2024-1-2022 = 1. Effective < cycle (2) → fail.
    // This test pins the post-claim BKBQP rule: must wait at least 2 years after the prior claim.
    const personnelId = 'qn-bkbqp-ex-10';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2022, 2023, {
      2022: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkbqpReason(2, 2));
  });

  it('11. Claim BKBQP 2022 + 3y CSTDCS + eval 2025 → eligible (effective streak 2025-1-2022 = 2)', async () => {
    // Post-claim cycle hits: 2025-1-2022 = 2 = cycleYears. Eligible for next BKBQP.
    const personnelId = 'qn-bkbqp-ex-11';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2022, 2024, {
      2022: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2025,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.bkbqpEligible);
  });

  it('12. Claim BKBQP 2022 + 2024 (2 lần) + 5y CSTDCS + eval 2027 → eligible (effective 2 sau claim cuối)', async () => {
    // Two prior BKBQP claims; latest at 2024 resets cycle counter. evalYear 2027 →
    // effective = 2027-1-2024 = 2 = cycleYears.
    const personnelId = 'qn-bkbqp-ex-12';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2022, 2026, {
      2022: { nhan_bkbqp: true },
      2024: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2027,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });
});
