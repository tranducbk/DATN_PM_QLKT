import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { AnnualRow, ScienceRow, buildPersonnelWithHistory } from '../helpers/eligibilityFixtures';
import profileService from '../../src/services/profile.service';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { eligibilityReasons, suggestionMessages } from '../helpers/errorMessages';

describe('profile.service - checkAwardEligibility (BKBQP)', () => {
  it('2 năm CSTDCS liên tục + NCKH đủ → eligible BKBQP', async () => {
    // Cho: personnel đạt CSTDCS năm 2022 + 2023 với NCKH match mỗi năm
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

    // Khi
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    // Thì
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
    // Cho: 2022 CSTDCS, 2023 CSTT (non-CSTDCS) — streak reset, năm cuối là CSTT.
    // Streak kết 2023 = 0 (năm cuối là CSTT). Với year=2024, ending year=2023.
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
    // Cho: NCKH chỉ có 2022 — streak NCKH kết 2022 (1 năm), streak CSTDCS = 2
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
    // Cho: BKBQP tại 2017/2019/2021, CSTDTQ tại 2020/2023, CSTDCS 2017-2023
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
    // Cho: 14 năm CSTDCS liên tục (2010-2023) — streak > 7 và chia hết 7
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
    // Cho: 2 năm CSTDCS (2022, 2023) + NCKH match
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

    // Khi
    const result = await profileService.recalculateAnnualProfile(personnelId, 2024);

    // Thì
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
    // Cho: 7 năm CSTDCS với CSTT giữa (năm 2020) — streak reset tại 2020
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
    // Streak chỉ 3 (2021-2023), nên BKTTCP phải false
    expect(upsertArgs.update.cstdcs_lien_tuc).toBe(3);
    expect(upsertArgs.update.du_dieu_kien_bkttcp).toBe(false);
  });

  it('recalculate cho year khác → kết quả khác (2022 vs 2024)', async () => {
    // Cho: cùng data — evaluate cho 2022 (streak kết tại 2021)
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
    // Năm 2022 → streak kết 2021 = 2 năm (2020, 2021)
    expect(args2022.update.cstdcs_lien_tuc).toBe(2);

    // Khi: re-evaluate cho 2024 — streak kết 2023 = 4 năm
    resetPrismaMock();
    const personnel2024 = buildPersonnelWithHistory(personnelId, danhHieuRows, thanhTichRows);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(personnel2024);
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await profileService.recalculateAnnualProfile(personnelId, 2024);
    const args2024 = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args2024.update.cstdcs_lien_tuc).toBe(4);
  });

  it('đã nhận BKTTCP + streak > 7 + chia hết 7 → goi_y "chưa hỗ trợ"', async () => {
    // Cho: 14 năm CSTDCS với cờ BKTTCP ở năm mới nhất
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
