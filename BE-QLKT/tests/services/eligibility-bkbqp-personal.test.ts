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

describe('profile.service - BKBQP exhaustive boundaries', () => {
  it('2y CSTDCS + 2 NCKH → eligible (boundary tối thiểu)', async () => {
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

  it('4y CSTDCS + 4 NCKH → eligible (chia 2)', async () => {
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

  it('6y CSTDCS + 6 NCKH → eligible (chia 2)', async () => {
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

  it('3y CSTDCS + NCKH đủ → fail (NOT mod 2)', async () => {
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

  it('5y CSTDCS + NCKH đủ → fail (NOT mod 2)', async () => {
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

  it('7y CSTDCS + NCKH đủ → fail BKBQP (NOT mod 2)', async () => {
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

  it('1y CSTDCS + 1 NCKH → fail (streak < 2)', async () => {
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

  it('2y CSTDCS + chỉ 1 NCKH → fail (NCKH thiếu)', async () => {
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

  it('Đã nhận BKBQP năm trước (trong streak) + 4y CSTDCS mới → eligible (chain cho phép nhiều BKBQP)', async () => {
    // Cho: 4y CSTDCS liên tục, BKBQP tại năm 2 trong streak
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

    // 4 % 2 == 0, NCKH 4 >= 4 → eligible (lifetime không chặn)
    expect(result.eligible).toBe(true);
  });
});

describe('profile.service - BKBQP edge cases', () => {
  it('streak gián đoạn rồi tiếp tục: 5y CSTDCS → 1y CSTT → 3y CSTDCS, recalc 2027 → streak = 3', async () => {
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

    await profileService.recalculateAnnualProfile(personnelId, 2027);

    const args = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args.update.cstdcs_lien_tuc).toBe(3);
    expect(args.update.du_dieu_kien_bkbqp).toBe(false);
  });

  it('gap year giữa chuỗi (thiếu record năm 2022) → streak chỉ tính 2y mới nhất', async () => {
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

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2025,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('thiếu NCKH năm GIỮA streak (CSTDCS 2020-2025, thiếu NCKH 2022) → BKBQP fail', async () => {
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

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2026,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkbqpReason(6, 3));
  });

  it('NCKH 2 loại mix DTKH + SKKH trong 2y CSTDCS → vẫn eligible BKBQP', async () => {
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
        [{ nam: 2022 }, { nam: 2023 }]
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

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2026,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('boundary streak = exactly 2 → eligible (không off-by-one)', async () => {
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
