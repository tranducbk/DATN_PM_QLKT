import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { makePersonnel, makeAnnualRecord, makeThanhTichKhoaHoc } from '../helpers/fixtures';
import profileService from '../../src/services/profile.service';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { eligibilityReasons, suggestionMessages } from '../helpers/errorMessages';

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

describe('profile.service - BKTTCP exhaustive (streak vs flags vs NCKH)', () => {
  it('A1. 7y CSTDCS + 3 BKBQP + 2 CSTDTQ + 7 NCKH → eligible', async () => {
    // Given: full 7-year contiguous chain with 3 BKBQP and 2 CSTDTQ flags inside
    const personnelId = 'qn-bkttcp-A1';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true, nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
      2023: { nhan_cstdtq: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    // When
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    // Then
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.bkttcpEligible);
  });

  it('A2. 7y CSTDCS + 3 BKBQP + 2 CSTDTQ nhưng thiếu 1 NCKH (6 NCKH) → fail với reason exact', async () => {
    // Given: full flags but NCKH gap at 2018 (drops NCKH streak — but recall NCKH only counts contiguous from year-1 backwards)
    const personnelId = 'qn-bkttcp-A2';
    const { danhHieu } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true, nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
      2023: { nhan_cstdtq: true },
    });
    // NCKH for 2018-2023 only (6 years contiguous from 2023 backwards)
    const nckh: ScienceRow[] = [
      { nam: 2018 },
      { nam: 2019 },
      { nam: 2020 },
      { nam: 2021 },
      { nam: 2022 },
      { nam: 2023 },
    ];
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    // When
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    // Then
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(7, 3, 2, 6));
  });

  it('A3. 7y + 2 BKBQP + 2 CSTDTQ + 7 NCKH (thiếu 1 BKBQP) → fail', async () => {
    const personnelId = 'qn-bkttcp-A3';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_cstdtq: true },
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(7, 2, 2, 7));
  });

  it('A4. 7y + 3 BKBQP + 1 CSTDTQ + 7 NCKH (thiếu 1 CSTDTQ) → fail', async () => {
    const personnelId = 'qn-bkttcp-A4';
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

  it('A5. 7y + 4 BKBQP + 2 CSTDTQ → fail (rule strict bkbqpIn7Years === 3, không phải >=3)', async () => {
    // Code at profile.service.ts:590 uses === 3 strict equality
    const personnelId = 'qn-bkttcp-A5';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2023, {
      2017: { nhan_bkbqp: true },
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

    // 4 BKBQP fails strict === 3 check
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(7, 4, 2, 7));
  });

  it('A6. 7y + 3 BKBQP + 3 CSTDTQ → fail (cstdtqIn7Years === 2 strict)', async () => {
    const personnelId = 'qn-bkttcp-A6';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2023, {
      2017: { nhan_cstdtq: true },
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(7, 3, 3, 7));
  });
});

describe('profile.service - BKTTCP streak length boundary (cstdcs_lien_tuc strict === 7)', () => {
  it('B1. 6y CSTDCS + 3 BKBQP + 2 CSTDTQ + 6 NCKH → fail (cstdcs < 7)', async () => {
    const personnelId = 'qn-bkttcp-B1';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023, {
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(6, 3, 2, 6));
  });

  it('B3. 8y CSTDCS với flags đủ trong 7y cuối → fail (cstdcs !== 7) - VẠCH TRẦN strict equality', async () => {
    // Given: 8y contiguous, flags placed in 7-year window 2017-2023
    const personnelId = 'qn-bkttcp-B3';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2016, 2023, {
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpMissedWindow(8));
  });

  it('B4. 9y CSTDCS với flags đủ trong 7y cuối → fail', async () => {
    const personnelId = 'qn-bkttcp-B4-9';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2015, 2023, {
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpMissedWindow(9));
  });

  it('B4b. 13y CSTDCS với flags đủ trong 7y cuối → fail (vẫn không qua dù 13 < 14)', async () => {
    // 13y user case mentioned in audit — code rejects because cstdcs_lien_tuc !== 7
    const personnelId = 'qn-bkttcp-B4-13';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2011, 2023, {
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
    expect(result.reason).not.toMatch(/chưa hỗ trợ/);
    expect(result.reason).toBe(eligibilityReasons.bkttcpMissedWindow(13));
  });

  it('B5. 14y CSTDCS với flags ĐỦ HẾT → "chưa hỗ trợ" (overflow precedes flags check)', async () => {
    // Given: 14y contiguous, BKTTCP message takes priority over insufficient flags
    const personnelId = 'qn-bkttcp-B5';
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

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpUnsupported);
  });

  it('B6. 14y với flags KHÔNG đủ → vẫn "chưa hỗ trợ" (overflow check precedes count)', async () => {
    const personnelId = 'qn-bkttcp-B6';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2010, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpUnsupported);
  });

  it('B7. 28y CSTDCS → "chưa hỗ trợ"', async () => {
    const personnelId = 'qn-bkttcp-B7';
    const { danhHieu, nckh } = buildContiguousCSTDCS(1996, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpUnsupported);
  });

  it('B8. 15y CSTDCS (NOT mod 7) → fail với "Chưa đủ điều kiện..."', async () => {
    const personnelId = 'qn-bkttcp-B8-15';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2009, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).not.toMatch(/chưa hỗ trợ/);
    expect(result.reason).toBe(eligibilityReasons.bkttcpMissedWindow(15));
  });

  it('B9. 20y CSTDCS (NOT mod 7) → fail "Chưa đủ điều kiện..."', async () => {
    const personnelId = 'qn-bkttcp-B8-20';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2004, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).not.toMatch(/chưa hỗ trợ/);
    expect(result.reason).toBe(eligibilityReasons.bkttcpMissedWindow(20));
  });
});

describe('profile.service - BKTTCP đã nhận (lifetime block behavior)', () => {
  it('C1. Đã nhận BKTTCP + 7y CSTDCS mới + đủ flags → block "khen thưởng một lần duy nhất"', async () => {
    // Given: BKTTCP at 2010 (gap), then fresh 7y chain 2017-2023
    const personnelId = 'qn-bkttcp-C1';
    const danhHieu: AnnualRow[] = [
      {
        nam: 2010,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-CSTDCS-2010',
        nhan_bkttcp: true,
        so_quyet_dinh_bkttcp: 'QDTT-2010',
      },
    ];
    const { danhHieu: chain, nckh: nckhChain } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true, nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
      2023: { nhan_cstdtq: true },
    });
    danhHieu.push(...chain);
    const nckh: ScienceRow[] = [{ nam: 2010 }, ...nckhChain];
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    // Lifetime block fires before insufficient/eligible checks.
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpLifetimeBlocked);
  });

  it('C2. Đã nhận BKTTCP + 14y CSTDCS → reason kết hợp "Đã có ... chưa hỗ trợ cao hơn"', async () => {
    const personnelId = 'qn-bkttcp-C2';
    const danhHieu: AnnualRow[] = [];
    const nckh: ScienceRow[] = [];
    for (let y = 2010; y <= 2023; y++) {
      const isBkttcpYear = y === 2016;
      danhHieu.push({
        nam: y,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: `QD-CSTDCS-${y}`,
        nhan_bkttcp: isBkttcpYear,
        so_quyet_dinh_bkttcp: isBkttcpYear ? `QDTT-${y}` : null,
      });
      nckh.push({ nam: y });
    }
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpLifetimeBlockedAndUnsupported);
  });

  it('C3. Recalc với hasReceivedBKTTCP + streak chia 7 và > 7 → goi_y "chưa hỗ trợ"', async () => {
    const personnelId = 'qn-bkttcp-C3';
    const danhHieu: AnnualRow[] = [];
    const nckh: ScienceRow[] = [];
    for (let y = 2003; y <= 2023; y++) {
      const isBkttcpYear = y === 2009;
      danhHieu.push({
        nam: y,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: `QD-CSTDCS-${y}`,
        nhan_bkttcp: isBkttcpYear,
        so_quyet_dinh_bkttcp: isBkttcpYear ? `QDTT-${y}` : null,
      });
      nckh.push({ nam: y });
    }
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await profileService.recalculateAnnualProfile(personnelId, 2024);

    const args = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args.update.cstdcs_lien_tuc).toBe(21);
    expect(args.update.goi_y).toBe(suggestionMessages.personalUnsupported);
    expect(args.update.du_dieu_kien_bkttcp).toBe(false);
  });

  it('C5. Đã nhận BKTTCP + 7y CSTDCS mới + flags ĐỦ + NCKH đủ → block "khen thưởng một lần duy nhất"', async () => {
    // Lifetime block fires regardless of whether the new chain meets BKTTCP criteria.
    const personnelId = 'qn-bkttcp-C5';
    const danhHieu: AnnualRow[] = [
      {
        nam: 2010,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-CSTDCS-2010',
        nhan_bkttcp: true,
        so_quyet_dinh_bkttcp: 'QDTT-2010',
      },
    ];
    const { danhHieu: chain, nckh: nckhChain } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true, nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
      2023: { nhan_cstdtq: true },
    });
    danhHieu.push(...chain);
    const nckh: ScienceRow[] = [{ nam: 2010 }, ...nckhChain];
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpLifetimeBlocked);
  });

  it('C6. Đã nhận BKTTCP + 21y CSTDCS → reason kết hợp lifetime + overflow', async () => {
    const personnelId = 'qn-bkttcp-C6';
    const danhHieu: AnnualRow[] = [];
    const nckh: ScienceRow[] = [];
    for (let y = 2003; y <= 2023; y++) {
      const isBkttcpYear = y === 2009;
      danhHieu.push({
        nam: y,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: `QD-CSTDCS-${y}`,
        nhan_bkttcp: isBkttcpYear,
        so_quyet_dinh_bkttcp: isBkttcpYear ? `QDTT-${y}` : null,
      });
      nckh.push({ nam: y });
    }
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpLifetimeBlockedAndUnsupported);
  });

  it('C7. CHƯA nhận BKTTCP + 14y CSTDCS → reason "chưa hỗ trợ" KHÔNG có "Đã có"', async () => {
    const personnelId = 'qn-bkttcp-C7';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2010, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpUnsupported);
    expect(result.reason).not.toMatch(/Đã có/);
  });

  it('C4. Recalc với hasReceivedBKTTCP + streak === 7 mới (lúc đầu chuỗi mới) → eligible flag', async () => {
    // Given: BKTTCP at 2010 then gap, fresh 7y 2017-2023 with full flags
    // Rule pinned: recalc evaluates du_dieu_kien_bkttcp first; if true, goi_y = eligible
    const personnelId = 'qn-bkttcp-C4';
    const danhHieu: AnnualRow[] = [
      {
        nam: 2010,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-CSTDCS-2010',
        nhan_bkttcp: true,
        so_quyet_dinh_bkttcp: 'QDTT-2010',
      },
    ];
    const { danhHieu: chain, nckh: nckhChain } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true, nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
      2023: { nhan_cstdtq: true },
    });
    danhHieu.push(...chain);
    const nckh: ScienceRow[] = [{ nam: 2010 }, ...nckhChain];
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await profileService.recalculateAnnualProfile(personnelId, 2024);

    const args = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args.update.cstdcs_lien_tuc).toBe(7);
    expect(args.update.du_dieu_kien_bkttcp).toBe(true);
    expect(args.update.goi_y).toBe(suggestionMessages.personalEligibleBkttcp);
  });
});

describe('profile.service - BKTTCP countFlagInRange edges', () => {
  it('E1. 5y CSTDCS continuous → 1 CSTT → 7y CSTDCS + đủ flags trong 7y mới → eligible BKTTCP', async () => {
    // Break (CSTT) resets the streak — fresh 7y chain qualifies even though earlier years exist.
    const personnelId = 'qn-bkttcp-E1';
    const danhHieu: AnnualRow[] = [];
    const nckh: ScienceRow[] = [];
    for (let y = 2011; y <= 2015; y++) {
      danhHieu.push({
        nam: y,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: `QD-CSTDCS-${y}`,
      });
      nckh.push({ nam: y });
    }
    danhHieu.push({
      nam: 2016,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      so_quyet_dinh: 'QD-CSTT-2016',
    });
    nckh.push({ nam: 2016 });
    const { danhHieu: chain, nckh: nckhChain } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true, nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
      2023: { nhan_cstdtq: true },
    });
    danhHieu.push(...chain);
    nckh.push(...nckhChain);
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

  it('D1. 13y CSTDCS + 6 BKBQP rải đều (cứ 2y) + 4 CSTDTQ → fail (chỉ 3 BKBQP/2 CSTDTQ trong 7y window, nhưng cstdcs !== 7)', async () => {
    // Given: 13y CSTDCS contiguous from 2011-2023; BKBQP at 2011/2013/2015/2017/2019/2021,
    // CSTDTQ at 2014/2017/2020/2023.
    const personnelId = 'qn-bkttcp-D1';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2011, 2023, {
      2011: { nhan_bkbqp: true },
      2013: { nhan_bkbqp: true },
      2014: { nhan_cstdtq: true },
      2015: { nhan_bkbqp: true },
      2017: { nhan_bkbqp: true, nhan_cstdtq: true },
      2019: { nhan_bkbqp: true },
      2020: { nhan_cstdtq: true },
      2021: { nhan_bkbqp: true },
      2023: { nhan_cstdtq: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    // When: range 2017-2023 contains BKBQP at 2017/2019/2021 = 3, CSTDTQ at 2017/2020/2023 = 3
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    // Then: streak overshoots cycle (13 > 7, not multiple) → missed window message.
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpMissedWindow(13));
  });
});
