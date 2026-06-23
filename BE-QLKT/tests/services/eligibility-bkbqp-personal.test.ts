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

describe('Xét điều kiện BKBQP cá nhân: rà soát các mốc số năm liên tục', () => {
  it('Xét điều kiện BKBQP: đúng 2 năm CSTDCS + 2 năm NCKH (mốc biên tối thiểu) → đủ điều kiện', async () => {
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

  it('Xét điều kiện BKBQP: 4 năm CSTDCS + 4 năm NCKH (đúng mốc chu kỳ 2 năm) → đủ điều kiện', async () => {
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

  it('Xét điều kiện BKBQP: 6 năm CSTDCS + 6 năm NCKH (đúng mốc chu kỳ 2 năm) → đủ điều kiện', async () => {
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

  it('Xét điều kiện BKBQP: 3 năm CSTDCS liên tục + đủ NCKH (lẻ năm, chưa tới mốc chu kỳ 2 năm) → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKBQP: 5 năm CSTDCS liên tục + đủ NCKH (lẻ năm, chưa tới mốc chu kỳ 2 năm) → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKBQP: 7 năm CSTDCS liên tục + đủ NCKH (lẻ năm, chưa tới mốc chu kỳ 2 năm) → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKBQP: chỉ 1 năm CSTDCS + 1 năm NCKH (chưa đủ 2 năm liên tục) → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKBQP: 2 năm CSTDCS nhưng chỉ 1 năm NCKH (thiếu NCKH) → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKBQP: đã nhận BKBQP một năm trong chuỗi + 4 năm CSTDCS liên tục → vẫn đủ điều kiện (chuỗi danh hiệu cho nhận lại)', async () => {
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

describe('Xét điều kiện BKBQP cá nhân: các tình huống biên của chuỗi danh hiệu', () => {
  it('Xét điều kiện BKBQP: chuỗi đứt giữa chừng (5 năm CSTDCS → 1 năm CSTT → 3 năm CSTDCS), tính lại năm 2027 → số năm liên tục đếm lại còn 3', async () => {
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

  it('Xét điều kiện BKBQP: thiếu dữ liệu năm 2022 giữa chuỗi → chỉ đếm 2 năm liên tục gần nhất → đủ điều kiện', async () => {
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

  it('Xét điều kiện BKBQP: 6 năm CSTDCS liên tục nhưng thiếu NCKH năm 2022 giữa chuỗi → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKBQP: 2 năm CSTDCS có đủ NCKH mỗi năm → đủ điều kiện', async () => {
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

  it('Xét điều kiện BKBQP: đã có BKBQP cũ từ năm 2015 + 2 năm CSTDCS mới (2024-2025) → vẫn đủ điều kiện nhận lại', async () => {
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

  it('Xét điều kiện BKBQP: đúng tại mốc biên 2 năm liên tục → đủ điều kiện (không lệch 1 năm)', async () => {
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
