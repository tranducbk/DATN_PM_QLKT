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

describe('Xét điều kiện CSTDTQ cá nhân: các tình huống biên của chuỗi và cửa sổ đếm BKBQP', () => {
  it('Xét điều kiện CSTDTQ: BKBQP cũ từ năm 2015 nằm ngoài chuỗi + 3 năm CSTDCS mới (2024-2026) → chưa đủ điều kiện (BKBQP cũ không được tính trong cửa sổ 3 năm gần nhất)', async () => {
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

  it('Xét điều kiện CSTDTQ: 3 năm CSTDCS nhưng 0 BKBQP trong cửa sổ 3 năm gần nhất → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện CSTDTQ: có năm CSTT xen giữa chuỗi làm đứt chuỗi → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện CSTDTQ: đã nhận CSTDTQ năm 2020 + 6 năm CSTDCS liên tục + BKBQP năm 2022 → đủ điều kiện (cửa sổ 3 năm gần nhất bắt được BKBQP)', async () => {
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

describe('Xét điều kiện CSTDTQ cá nhân: quy tắc cửa sổ 3 năm gần nhất và mốc chu kỳ 3 năm', () => {
  it('Xét điều kiện CSTDTQ: 3 năm CSTDCS liên tục + 1 BKBQP trong cửa sổ 3 năm gần nhất (mốc biên tối thiểu) → đủ điều kiện', async () => {
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

  it('Xét điều kiện CSTDTQ: 6 năm CSTDCS liên tục + 1 BKBQP trong cửa sổ 3 năm gần nhất (đúng mốc chu kỳ 3 năm) → đủ điều kiện', async () => {
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

  it('Xét điều kiện CSTDTQ: 9 năm CSTDCS liên tục + 1 BKBQP trong cửa sổ 3 năm gần nhất (đúng mốc chu kỳ 3 năm) → đủ điều kiện', async () => {
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

  it('Xét điều kiện CSTDTQ: 5 năm CSTDCS liên tục (chưa tới mốc chu kỳ 3 năm) → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện CSTDTQ: 4 năm CSTDCS liên tục (chưa tới mốc chu kỳ 3 năm) → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện CSTDTQ: 6 năm CSTDCS nhưng BKBQP chỉ ở năm đầu (2018, ngoài cửa sổ 2021-2023) → chưa đủ điều kiện (0 BKBQP trong cửa sổ gần nhất)', async () => {
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

  it('Xét điều kiện CSTDTQ: 3 năm CSTDCS + 1 BKBQP nhưng chỉ 2 năm NCKH → chưa đủ điều kiện (thiếu NCKH)', async () => {
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

  it('Xét điều kiện CSTDTQ: đã nhận CSTDTQ ở mốc 3 năm (năm 2020) + tiếp tục tới 6 năm liên tục, 1 BKBQP năm 2023 → đủ điều kiện (không trừ lại theo lần đã nhận)', async () => {
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

  it('Xét điều kiện CSTDTQ: 6 năm CSTDCS liên tục + 2 BKBQP trong cửa sổ 3 năm gần nhất → đủ điều kiện', async () => {
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
