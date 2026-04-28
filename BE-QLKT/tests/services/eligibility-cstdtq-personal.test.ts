import { prismaMock } from '../helpers/prismaMock';
import {
  AnnualRow,
  ScienceRow,
  buildPersonnelWithHistory,
  buildContiguousCSTDCS,
} from '../helpers/eligibilityFixtures';
import profileService from '../../src/services/profile.service';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { eligibilityReasons } from '../helpers/errorMessages';

describe('profile.service - CSTDTQ edge cases', () => {
  it('BKBQP NGOÀI streak (năm xa 2015) + 3y CSTDCS mới (2024-2026) → fail (BKBQP không count cho window 3y)', async () => {
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

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2027,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(3, 0, 3));
  });

  it('3y CSTDCS + 0 BKBQP trong window → fail CSTDTQ', async () => {
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

  it('đã nhận CSTDTQ năm 2020 + 6y continuous + BKBQP 2022 → eligible (window 3y bắt được BKBQP)', async () => {
    const personnelId = 'qn-edge-cstdtq-4';
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

describe('profile.service - CSTDTQ rule mới (window 3y, mod 3)', () => {
  it('streak 3 + 1 BKBQP trong window 3y → eligible (boundary tối thiểu)', async () => {
    const personnelId = 'qn-cstdtq-rule-1';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2021, 2023, {
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

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.cstdtqEligible);
  });

  it('streak 6 + 1 BKBQP trong 3y cuối → eligible (multiple cycles, mod 3 = 0)', async () => {
    const personnelId = 'qn-cstdtq-rule-2';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023, {
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

  it('streak 9 + 1 BKBQP trong 3y cuối → eligible', async () => {
    const personnelId = 'qn-cstdtq-rule-3';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2015, 2023, {
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

    expect(result.eligible).toBe(true);
  });

  it('streak 5 (NOT mod 3) → fail', async () => {
    const personnelId = 'qn-cstdtq-rule-4';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2019, 2023, {
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
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(5, 1, 5));
  });

  it('streak 4 (NOT mod 3) → fail', async () => {
    const personnelId = 'qn-cstdtq-rule-5';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2023, {
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
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(4, 1, 4));
  });

  it('streak 6 + BKBQP chỉ tại năm đầu (2018, ngoài window 2021-2023) → fail (0 BKBQP trong window)', async () => {
    const personnelId = 'qn-cstdtq-rule-6';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023, {
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
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(6, 0, 6));
  });

  it('streak 3 + 1 BKBQP nhưng NCKH chỉ 2 năm → fail (NCKH thiếu)', async () => {
    const personnelId = 'qn-cstdtq-rule-7';
    const { danhHieu } = buildContiguousCSTDCS(2021, 2023, {
      2023: { nhan_bkbqp: true },
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

  it('đã có CSTDTQ tại streak=3 (năm 2020) + tiếp tục đến streak=6, 1 BKBQP tại 2023 → eligible (no post-claim deduction)', async () => {
    const personnelId = 'qn-cstdtq-rule-8';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023, {
      2020: { nhan_cstdtq: true },
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

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.cstdtqEligible);
  });

  it('streak 6 + 2 BKBQP trải đều trong window 3y → eligible', async () => {
    const personnelId = 'qn-cstdtq-rule-9';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023, {
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

    expect(result.eligible).toBe(true);
  });
});
