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
  nhan_bkbqp?: boolean;
  nhan_cstdtq?: boolean;
  nhan_bkttcp?: boolean;
  so_quyet_dinh?: string | null;
  so_quyet_dinh_bkbqp?: string | null;
  so_quyet_dinh_cstdtq?: string | null;
  so_quyet_dinh_bkttcp?: string | null;
}

interface ScienceRow {
  nam: number;
  loai?: 'DTKH' | 'SKKH';
  mo_ta?: string;
  so_quyet_dinh?: string | null;
}

/** Builds a fixture-shaped result for `prisma.quanNhan.findUnique` with award + science includes. */
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
        nhan_bkbqp: r.nhan_bkbqp,
        nhan_cstdtq: r.nhan_cstdtq,
        nhan_bkttcp: r.nhan_bkttcp,
        so_quyet_dinh: r.so_quyet_dinh,
        so_quyet_dinh_bkbqp: r.so_quyet_dinh_bkbqp,
        so_quyet_dinh_cstdtq: r.so_quyet_dinh_cstdtq,
        so_quyet_dinh_bkttcp: r.so_quyet_dinh_bkttcp,
      })
    ),
    ThanhTichKhoaHoc: thanhTichRows.map(r =>
      makeThanhTichKhoaHoc({
        personnelId,
        nam: r.nam,
        loai: r.loai,
        mo_ta: r.mo_ta,
        so_quyet_dinh: r.so_quyet_dinh,
      })
    ),
  };
}

describe('profile.service - checkAwardEligibility (BKBQP)', () => {
  it('2 năm CSTDCS liên tục + NCKH đủ → eligible BKBQP', async () => {
    // Given: personnel achieved CSTDCS in 2022 + 2023 with matching NCKH each year
    const personnelId = 'qn-elig-1';
    const personnel = buildPersonnelWithHistory(
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
      [{ nam: 2022 }, { nam: 2023 }]
    );
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);

    // When
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    // Then
    expect(result.eligible).toBe(true);
  });

  it('1 năm CSTDCS → KHÔNG eligible BKBQP', async () => {
    const personnelId = 'qn-elig-2';
    const personnel = buildPersonnelWithHistory(
      personnelId,
      [
        {
          nam: 2023,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2023',
        },
      ],
      [{ nam: 2023 }]
    );
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkbqpReason(1, 1));
  });

  it('CSTT giữa chuỗi → break streak CSTDCS, BKBQP fail', async () => {
    // Given: 2022 CSTDCS, 2023 CSTT (non-CSTDCS) — streak resets so only 2023... but CSTT is not CSTDCS
    // Streak ending 2023 = 0 (last year is CSTT). With year=2024, ending year=2023.
    const personnelId = 'qn-elig-3';
    const personnel = buildPersonnelWithHistory(
      personnelId,
      [
        {
          nam: 2022,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2022',
        },
        { nam: 2023, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT, so_quyet_dinh: 'QD-CSTT-2023' },
      ],
      [{ nam: 2022 }, { nam: 2023 }]
    );
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
  });

  it('2 năm CSTDCS nhưng thiếu NCKH năm cuối → BKBQP fail', async () => {
    // Given: NCKH only in 2022 — streak NCKH ends at 2022 (one year), CSTDCS streak = 2
    const personnelId = 'qn-elig-4';
    const personnel = buildPersonnelWithHistory(
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
      [{ nam: 2022 }]
    );
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkbqpReason(2, 0));
  });
});

describe('profile.service - checkAwardEligibility (CSTDTQ + BKTTCP)', () => {
  it('3 năm CSTDCS + 1 BKBQP + NCKH đủ → eligible CSTDTQ', async () => {
    const personnelId = 'qn-cstdtq';
    const personnel = buildPersonnelWithHistory(
      personnelId,
      [
        {
          nam: 2021,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2021',
        },
        {
          nam: 2022,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2022',
          nhan_bkbqp: true,
          so_quyet_dinh_bkbqp: 'QDBK-2022',
        },
        {
          nam: 2023,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2023',
        },
      ],
      [{ nam: 2021 }, { nam: 2022 }, { nam: 2023 }]
    );
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(true);
  });

  it('7 năm CSTDCS + 3 BKBQP + 2 CSTDTQ + NCKH đủ → eligible BKTTCP', async () => {
    // Given: BKBQP at 2017/2019/2021, CSTDTQ at 2020/2023, all CSTDCS 2017-2023
    const personnelId = 'qn-bkttcp';
    const personnel = buildPersonnelWithHistory(
      personnelId,
      [
        {
          nam: 2017,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2017',
          nhan_bkbqp: true,
          so_quyet_dinh_bkbqp: 'QDBK-2017',
        },
        {
          nam: 2018,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2018',
        },
        {
          nam: 2019,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2019',
          nhan_bkbqp: true,
          so_quyet_dinh_bkbqp: 'QDBK-2019',
        },
        {
          nam: 2020,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2020',
          nhan_cstdtq: true,
          so_quyet_dinh_cstdtq: 'QDTQ-2020',
        },
        {
          nam: 2021,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2021',
          nhan_bkbqp: true,
          so_quyet_dinh_bkbqp: 'QDBK-2021',
        },
        {
          nam: 2022,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2022',
        },
        {
          nam: 2023,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2023',
          nhan_cstdtq: true,
          so_quyet_dinh_cstdtq: 'QDTQ-2023',
        },
      ],
      [
        { nam: 2017 },
        { nam: 2018 },
        { nam: 2019 },
        { nam: 2020 },
        { nam: 2021 },
        { nam: 2022 },
        { nam: 2023 },
      ]
    );
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(true);
  });

  it('14 năm CSTDCS liên tục → "chưa hỗ trợ" BKTTCP', async () => {
    // Given: 14 consecutive CSTDCS years (2010-2023) — streak > 7 and divisible by 7
    const personnelId = 'qn-overflow';
    const danhHieuRows: AnnualRow[] = [];
    const thanhTichRows: ScienceRow[] = [];
    for (let y = 2010; y <= 2023; y++) {
      danhHieuRows.push({
        nam: y,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: `QD-CSTDCS-${y}`,
      });
      thanhTichRows.push({ nam: y });
    }
    const personnel = buildPersonnelWithHistory(personnelId, danhHieuRows, thanhTichRows);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpUnsupported);
  });
});

describe('profile.service - recalculateAnnualProfile', () => {
  it('upsert đúng tong_cstdcs, cstdcs_lien_tuc, du_dieu_kien_bkbqp khi đủ điều kiện', async () => {
    // Given: 2 CSTDCS years (2022, 2023) + matching NCKH
    const personnelId = 'qn-recalc-1';
    const personnel = buildPersonnelWithHistory(
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
      [{ nam: 2022 }, { nam: 2023 }]
    );
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => ({
      quan_nhan_id: personnelId,
      ...args.create,
    }));

    // When
    const result = await profileService.recalculateAnnualProfile(personnelId, 2024);

    // Then
    expect(result.success).toBe(true);
    const upsertArgs = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update).toMatchObject({
      tong_cstdcs: 2,
      cstdcs_lien_tuc: 2,
      du_dieu_kien_bkbqp: true,
      du_dieu_kien_cstdtq: false,
      du_dieu_kien_bkttcp: false,
    });
    expect(upsertArgs.update.goi_y).toBe(suggestionMessages.personalEligibleBkbqp);
  });

  it('CSTDCS bị break giữa chuỗi → không đủ điều kiện BKTTCP', async () => {
    // Given: 7 CSTDCS years but with CSTT in middle (year 2020) — streak resets at 2020
    const personnelId = 'qn-broken';
    const personnel = buildPersonnelWithHistory(
      personnelId,
      [
        {
          nam: 2017,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2017',
          nhan_bkbqp: true,
          so_quyet_dinh_bkbqp: 'QDBK-2017',
        },
        {
          nam: 2018,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2018',
        },
        {
          nam: 2019,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2019',
          nhan_bkbqp: true,
          so_quyet_dinh_bkbqp: 'QDBK-2019',
        },
        { nam: 2020, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT, so_quyet_dinh: 'QD-CSTT-2020' },
        {
          nam: 2021,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2021',
          nhan_bkbqp: true,
          so_quyet_dinh_bkbqp: 'QDBK-2021',
        },
        {
          nam: 2022,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2022',
        },
        {
          nam: 2023,
          danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
          so_quyet_dinh: 'QD-CSTDCS-2023',
          nhan_cstdtq: true,
          so_quyet_dinh_cstdtq: 'QDTQ-2023',
        },
      ],
      [
        { nam: 2017 },
        { nam: 2018 },
        { nam: 2019 },
        { nam: 2020 },
        { nam: 2021 },
        { nam: 2022 },
        { nam: 2023 },
      ]
    );
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => ({
      quan_nhan_id: personnelId,
      ...args.create,
    }));

    await profileService.recalculateAnnualProfile(personnelId, 2024);

    const upsertArgs = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    // Streak only 3 (2021-2023), so BKTTCP must be false
    expect(upsertArgs.update.cstdcs_lien_tuc).toBe(3);
    expect(upsertArgs.update.du_dieu_kien_bkttcp).toBe(false);
  });

  it('recalculate cho year khác → kết quả khác (2022 vs 2024)', async () => {
    // Given: same data — evaluate for 2022 (streak ends at 2021)
    const personnelId = 'qn-year-shift';
    const danhHieuRows: AnnualRow[] = [
      { nam: 2020, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2020' },
      { nam: 2021, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2021' },
      { nam: 2022, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2022' },
      { nam: 2023, danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, so_quyet_dinh: 'QD-CSTDCS-2023' },
    ];
    const thanhTichRows: ScienceRow[] = [
      { nam: 2020 },
      { nam: 2021 },
      { nam: 2022 },
      { nam: 2023 },
    ];
    const personnel2022 = buildPersonnelWithHistory(
      personnelId,
      danhHieuRows.filter(r => r.nam <= 2022),
      thanhTichRows.filter(r => r.nam <= 2022)
    );
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel2022);
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await profileService.recalculateAnnualProfile(personnelId, 2022);
    const args2022 = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    // Year 2022 → streak ending 2021 = 2 years (2020, 2021)
    expect(args2022.update.cstdcs_lien_tuc).toBe(2);

    // When: re-evaluate for 2024 — streak ending 2023 = 4 years
    resetPrismaMock();
    const personnel2024 = buildPersonnelWithHistory(personnelId, danhHieuRows, thanhTichRows);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel2024);
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await profileService.recalculateAnnualProfile(personnelId, 2024);
    const args2024 = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args2024.update.cstdcs_lien_tuc).toBe(4);
  });

  it('đã nhận BKTTCP + streak > 7 + chia hết 7 → goi_y "chưa hỗ trợ"', async () => {
    // Given: 14 CSTDCS years with BKTTCP flag in latest year
    const personnelId = 'qn-after-bkttcp';
    const danhHieuRows: AnnualRow[] = [];
    const thanhTichRows: ScienceRow[] = [];
    for (let y = 2010; y <= 2023; y++) {
      const isBkttcpYear = y === 2016;
      danhHieuRows.push({
        nam: y,
        danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
        so_quyet_dinh: `QD-CSTDCS-${y}`,
        nhan_bkttcp: isBkttcpYear,
        so_quyet_dinh_bkttcp: isBkttcpYear ? `QDTT-${y}` : null,
      });
      thanhTichRows.push({ nam: y });
    }
    const personnel = buildPersonnelWithHistory(personnelId, danhHieuRows, thanhTichRows);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel);
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await profileService.recalculateAnnualProfile(personnelId, 2024);
    const args = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args.update.goi_y).toBe(suggestionMessages.personalUnsupported);
  });
});
