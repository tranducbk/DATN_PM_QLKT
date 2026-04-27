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
  loai?: 'DTKH' | 'SKKH';
}

/** Builds a Quan Nhan row with DanhHieuHangNam + ThanhTichKhoaHoc relations preloaded. */
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
    ThanhTichKhoaHoc: thanhTichRows.map(r =>
      makeThanhTichKhoaHoc({ personnelId, nam: r.nam, loai: r.loai })
    ),
  };
}

/** Generates a contiguous CSTDCS sequence with matching NCKH each year. */
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

describe('profile.service - BKBQP edge cases', () => {
  it('streak gián đoạn rồi tiếp tục: 5y CSTDCS → 1y CSTT → 3y CSTDCS, recalc 2027 → streak = 3', async () => {
    // Given: 5y CSTDCS (2018-2022), 1y CSTT (2023), 3y CSTDCS (2024-2026)
    const personnelId = 'qn-edge-bkbqp-1';
    const danhHieu: AnnualRow[] = [];
    const nckh: ScienceRow[] = [];
    for (let y = 2018; y <= 2022; y++) {
      danhHieu.push({
        nam: y,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: `QD-CSTDCS-${y}`,
      });
      nckh.push({ nam: y });
    }
    danhHieu.push({
      nam: 2023,
      danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      so_quyet_dinh: 'QD-CSTT-2023',
    });
    nckh.push({ nam: 2023 });
    for (let y = 2024; y <= 2026; y++) {
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

    // When: recalc for 2027 — streak ending 2026 only counts 2024-2026
    await profileService.recalculateAnnualProfile(personnelId, 2027);

    // Then: streak = 3, BKBQP not eligible (3 is not even), CSTDTQ requires BKBQP in streak
    const args = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args.update.cstdcs_lien_tuc).toBe(3);
    expect(args.update.du_dieu_kien_bkbqp).toBe(false);
  });

  it('gap year giữa chuỗi (thiếu record năm 2022) → streak chỉ tính 2y mới nhất', async () => {
    // Given: CSTDCS 2020-2021, missing 2022, CSTDCS 2023-2024
    const personnelId = 'qn-edge-bkbqp-2';
    const danhHieu: AnnualRow[] = [
      { nam: 2020, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2020' },
      { nam: 2021, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2021' },
      { nam: 2023, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2023' },
      { nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2024' },
    ];
    const nckh: ScienceRow[] = [{ nam: 2020 }, { nam: 2021 }, { nam: 2023 }, { nam: 2024 }];
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    // When: gap at 2022 forces streak reset; streak from 2025 viewpoint = 2023-2024
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2025,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    // Then: 2y CSTDCS (2023-2024) + matching NCKH → eligible BKBQP
    expect(result.eligible).toBe(true);
  });

  it('thiếu NCKH năm GIỮA streak (CSTDCS 2020-2025, thiếu NCKH 2022) → BKBQP fail', async () => {
    // Given: 6y CSTDCS but NCKH gap at 2022 — NCKH streak ends at 2023 (3 years)
    const personnelId = 'qn-edge-bkbqp-3';
    const danhHieu: AnnualRow[] = [];
    for (let y = 2020; y <= 2025; y++) {
      danhHieu.push({
        nam: y,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: `QD-CSTDCS-${y}`,
      });
    }
    const nckh: ScienceRow[] = [
      { nam: 2020 },
      { nam: 2021 },
      { nam: 2023 },
      { nam: 2024 },
      { nam: 2025 },
    ];
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    // When
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2026,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    // Then: NCKH streak (3) < CSTDCS streak (6), so fail
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkbqpReason(6, 3));
  });

  it('NCKH 2 loại mix DTKH + SKKH trong 2y CSTDCS → vẫn eligible BKBQP', async () => {
    // Given: 2y CSTDCS, năm 1 DTKH, năm 2 SKKH (cả 2 loại đều count trong NCKH list)
    const personnelId = 'qn-edge-bkbqp-4';
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(
        personnelId,
        [
          {
            nam: 2022,
            danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
            so_quyet_dinh: 'QD-CSTDCS-2022',
          },
          {
            nam: 2023,
            danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
            so_quyet_dinh: 'QD-CSTDCS-2023',
          },
        ],
        [
          { nam: 2022, loai: 'DTKH' },
          { nam: 2023, loai: 'SKKH' },
        ]
      )
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('đã có BKBQP cũ năm xa (2015) + 2y CSTDCS mới (2024-2025) → vẫn eligible BKBQP lần nữa', async () => {
    // Given: BKBQP at 2015 then CSTDCS gap, restart streak 2024-2025
    const personnelId = 'qn-edge-bkbqp-5';
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(
        personnelId,
        [
          {
            nam: 2015,
            danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
            so_quyet_dinh: 'QD-CSTDCS-2015',
            nhan_bkbqp: true,
            so_quyet_dinh_bkbqp: 'QDBK-2015',
          },
          {
            nam: 2024,
            danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
            so_quyet_dinh: 'QD-CSTDCS-2024',
          },
          {
            nam: 2025,
            danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
            so_quyet_dinh: 'QD-CSTDCS-2025',
          },
        ],
        [{ nam: 2015 }, { nam: 2024 }, { nam: 2025 }]
      )
    );

    // When: streak ending 2025 only sees 2024-2025 (gap at 2016-2023)
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2026,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    // Then: rule allows multiple BKBQP — eligible again on each completed 2y streak
    expect(result.eligible).toBe(true);
  });

  it('boundary streak = exactly 2 → eligible (không off-by-one)', async () => {
    // Given: minimal contiguous chain
    const personnelId = 'qn-edge-bkbqp-6';
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
  });
});

describe('profile.service - CSTDTQ edge cases', () => {
  it('BKBQP NGOÀI streak (năm xa 2015) + 3y CSTDCS mới (2024-2026) → fail (BKBQP không count cho streak hiện tại)', async () => {
    // Given: BKBQP at 2015 then gap, 3y CSTDCS 2024-2026
    const personnelId = 'qn-edge-cstdtq-1';
    const danhHieu: AnnualRow[] = [
      {
        nam: 2015,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: 'QD-CSTDCS-2015',
        nhan_bkbqp: true,
        so_quyet_dinh_bkbqp: 'QDBK-2015',
      },
      { nam: 2024, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2024' },
      { nam: 2025, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2025' },
      { nam: 2026, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2026' },
    ];
    const nckh: ScienceRow[] = [{ nam: 2015 }, { nam: 2024 }, { nam: 2025 }, { nam: 2026 }];
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    // When: streak length = 3 (2024-2026); countBKBQPInStreak counts 2024-2026 → 0
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2027,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    // Then: BKBQP older than streak does NOT count for CSTDTQ chain
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(3, 0, 3));
  });

  it('3y CSTDCS + 0 BKBQP trong streak → fail CSTDTQ', async () => {
    const personnelId = 'qn-edge-cstdtq-2';
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

  it('3y có CSTT giữa chuỗi → break streak, fail CSTDTQ', async () => {
    // Given: CSTDCS 2021, CSTT 2022, CSTDCS 2023 — streak ending 2023 = 1
    const personnelId = 'qn-edge-cstdtq-3';
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(
        personnelId,
        [
          {
            nam: 2021,
            danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
            so_quyet_dinh: 'QD-CSTDCS-2021',
          },
          { nam: 2022, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT, so_quyet_dinh: 'QD-CSTT-2022' },
          {
            nam: 2023,
            danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
            so_quyet_dinh: 'QD-CSTDCS-2023',
          },
        ],
        [{ nam: 2021 }, { nam: 2022 }, { nam: 2023 }]
      )
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(false);
  });

  it('6y CSTDCS continuous → missed window (strict cycle: streak > 3 disqualifies)', async () => {
    // Strict-cycle rule: continuous 6y means operator passed the year-3 review window.
    // Even with 2 BKBQP scattered in, eligibility waits until next chain reset.
    const personnelId = 'qn-edge-cstdtq-4';
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

  it('đã nhận CSTDTQ năm 2020 trong streak + 6y continuous + BKBQP 2022 → eligible (effective streak reset to 3)', async () => {
    // Prior CSTDTQ claim resets the cycle counter. Years 2021-2023 form the next 3y CSTDTQ
    // cycle, with BKBQP 2022 covering the prerequisite — eligible despite raw streak = 6.
    const personnelId = 'qn-edge-cstdtq-5';
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
});

describe('profile.service - BKTTCP edge cases', () => {
  it('7y + 2 BKBQP + 2 CSTDTQ (thiếu 1 BKBQP) → fail', async () => {
    // Given: 7y contiguous, only 2 BKBQP in 7y window
    const personnelId = 'qn-edge-bkttcp-1';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_cstdtq: true },
      2021: { nhan_bkbqp: true },
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

  it('7y + 3 BKBQP + 1 CSTDTQ (thiếu 1 CSTDTQ) → fail', async () => {
    const personnelId = 'qn-edge-bkttcp-2';
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

  it('7y CSTDCS + NCKH đầy đủ + 0 BKBQP → fail', async () => {
    const personnelId = 'qn-edge-bkttcp-3';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(7, 0, 0, 7));
  });

  it('đã nhận BKTTCP + streak 14y (chia hết 7) → recalc các năm sau "chưa hỗ trợ"', async () => {
    // Given: 14y CSTDCS contiguous, BKTTCP set in middle (2016)
    const personnelId = 'qn-edge-bkttcp-4';
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
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await profileService.recalculateAnnualProfile(personnelId, 2024);

    const args = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args.update.cstdcs_lien_tuc).toBe(14);
    expect(args.update.goi_y).toBe(suggestionMessages.personalUnsupported);
    // BKTTCP eligibility flag must be false because cstdcs_lien_tuc !== 7
    expect(args.update.du_dieu_kien_bkttcp).toBe(false);
  });

  it('14y mod 7 == 0 → checkAwardEligibility và recalc đồng bộ trả "chưa hỗ trợ"', async () => {
    // Given: 14y contiguous CSTDCS without BKTTCP flag
    const personnelId = 'qn-edge-bkttcp-5';
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

  it('21y mod 7 == 0 → "chưa hỗ trợ"', async () => {
    const personnelId = 'qn-edge-bkttcp-6';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2003, 2023);
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

  it('8y CSTDCS (không chia hết 7) → KHÔNG hiện "chưa hỗ trợ", fail vì cstdcs !== 7', async () => {
    // Given: 8y contiguous CSTDCS, no BKTTCP yet
    const personnelId = 'qn-edge-bkttcp-7';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2016, 2023, {
      2017: { nhan_bkbqp: true },
      2019: { nhan_bkbqp: true, nhan_cstdtq: true },
      2021: { nhan_bkbqp: true },
      2022: { nhan_cstdtq: true },
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
    // Exact reason format proves regression detection beyond loose substring
    expect(result.reason).toBe(eligibilityReasons.bkttcpMissedWindow(8));
  });

  it('13y CSTDCS (không chia hết 7) → KHÔNG hiện "chưa hỗ trợ"', async () => {
    const personnelId = 'qn-edge-bkttcp-8';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2011, 2023);
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
});
