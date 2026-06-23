import { prismaMock } from '../helpers/prismaMock';
import {
  AnnualRow,
  ScienceRow,
  buildPersonnelWithHistory,
  buildContiguousCSTDCS,
} from '../helpers/eligibilityFixtures';
import profileService from '../../src/services/profile.service';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { eligibilityReasons, suggestionMessages } from '../helpers/errorMessages';

describe('Xét điều kiện BKTTCP cá nhân: phối hợp số năm liên tục, các cờ BKBQP/CSTDTQ và NCKH', () => {
  it('Xét điều kiện BKTTCP: 7 năm CSTDCS + 3 BKBQP + 2 CSTDTQ + 7 năm NCKH → đủ điều kiện', async () => {
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

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.bkttcpEligible);
  });

  it('Xét điều kiện BKTTCP: 7 năm CSTDCS + 3 BKBQP + 2 CSTDTQ nhưng chỉ 6 năm NCKH (thiếu 1 năm NCKH) → chưa đủ điều kiện', async () => {
    const personnelId = 'qn-bkttcp-A2';
    const { danhHieu } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true, nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
      2023: { nhan_cstdtq: true },
    });
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

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(7, 3, 2, 6));
  });

  it('Xét điều kiện BKTTCP: 7 năm + chỉ 2 BKBQP + 2 CSTDTQ + 7 năm NCKH (thiếu 1 BKBQP) → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKTTCP: 7 năm + 3 BKBQP + chỉ 1 CSTDTQ + 7 năm NCKH (thiếu 1 CSTDTQ) → chưa đủ điều kiện', async () => {
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

  it('Xét điều kiện BKTTCP: 7 năm + 4 BKBQP + 2 CSTDTQ → chưa đủ điều kiện (chỉ xét một lần nên cần đúng 3 BKBQP, không phải từ 3 trở lên)', async () => {
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

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(7, 4, 2, 7));
  });

  it('Xét điều kiện BKTTCP: 7 năm + 3 BKBQP + 3 CSTDTQ → chưa đủ điều kiện (chỉ xét một lần nên cần đúng 2 CSTDTQ)', async () => {
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

describe('Xét điều kiện BKTTCP cá nhân: chu kỳ lặp lại mỗi 7 năm (chưa nhận thì đủ điều kiện tại bội số 7)', () => {
  it('Xét điều kiện BKTTCP: 14 năm CSTDCS đủ cờ trong cửa sổ 7 năm gần nhất, chưa từng nhận → đủ điều kiện ở mốc chu kỳ thứ 2', async () => {
    const personnelId = 'qn-bkttcp-cycle2';
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

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.bkttcpEligible);
  });

  it('Xét điều kiện BKTTCP: 14 năm CSTDCS nhưng thiếu cờ BKBQP/CSTDTQ trong cửa sổ 7 năm gần nhất → chưa đủ điều kiện', async () => {
    const personnelId = 'qn-bkttcp-cycle2-no-flags';
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(14, 0, 0, 14));
  });

  it('Xét điều kiện BKTTCP: 21 năm CSTDCS nhưng không có cờ BKBQP/CSTDTQ → chưa đủ điều kiện (không phải thông báo "chưa hỗ trợ")', async () => {
    const personnelId = 'qn-bkttcp-21y';
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(21, 0, 0, 21));
  });

  it('Xét điều kiện BKTTCP: 8 năm CSTDCS đủ cờ trong cửa sổ 7 năm gần nhất, chưa nhận → chưa đủ điều kiện (8 chưa phải mốc chu kỳ 7 năm)', async () => {
    const personnelId = 'qn-bkttcp-8y';
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(8, 3, 2, 8));
  });

  it('Xét điều kiện BKTTCP: 15 năm CSTDCS (chưa tới mốc chu kỳ 7 năm) → chưa đủ điều kiện', async () => {
    const personnelId = 'qn-bkttcp-15y';
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(15, 0, 0, 15));
  });

  it('Xét điều kiện BKTTCP: 20 năm CSTDCS (chưa tới mốc chu kỳ 7 năm) → chưa đủ điều kiện', async () => {
    const personnelId = 'qn-bkttcp-20y';
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(20, 0, 0, 20));
  });
});

describe('Xét điều kiện BKTTCP cá nhân: đã nhận một lần thì khóa với thông báo "chưa hỗ trợ danh hiệu cao hơn"', () => {
  it('Xét điều kiện BKTTCP: đã nhận năm 2010 + 7 năm CSTDCS mới đủ cờ → trả thông báo "chưa hỗ trợ" (chỉ xét một lần)', async () => {
    const personnelId = 'qn-bkttcp-received-7y';
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpAlreadyReceived);
  });

  it('Xét điều kiện BKTTCP: đã nhận + 14 năm CSTDCS → trả thông báo "chưa hỗ trợ" (chỉ xét một lần)', async () => {
    const personnelId = 'qn-bkttcp-received-14y';
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpAlreadyReceived);
  });

  it('Xét điều kiện BKTTCP (tính lại hồ sơ): đã nhận + chuỗi tiếp tục → gợi ý luôn là "chưa hỗ trợ"', async () => {
    const personnelId = 'qn-bkttcp-recalc-received';
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

  it('Xét điều kiện BKTTCP (tính lại hồ sơ): đã nhận + chuỗi mới đủ 7 năm và đủ cờ → gợi ý vẫn là "chưa hỗ trợ" (chỉ xét một lần)', async () => {
    const personnelId = 'qn-bkttcp-recalc-received-7y';
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
    expect(args.update.du_dieu_kien_bkttcp).toBe(false);
    expect(args.update.goi_y).toBe(suggestionMessages.personalUnsupported);
  });
});

describe('Xét điều kiện BKTTCP cá nhân: chuỗi mới sau khi chuỗi CSTDCS bị đứt', () => {
  it('Xét điều kiện BKTTCP: 5 năm CSTDCS → 1 năm CSTT làm đứt chuỗi → 7 năm CSTDCS mới đủ cờ → đủ điều kiện', async () => {
    const personnelId = 'qn-bkttcp-fresh';
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
});

describe('Xét điều kiện BKTTCP cá nhân: mốc biên khi chưa đủ 7 năm liên tục', () => {
  it('Xét điều kiện BKTTCP: chỉ 6 năm CSTDCS dù đủ cờ trong cửa sổ 7 năm gần nhất → chưa đủ điều kiện (chưa đủ 7 năm liên tục)', async () => {
    const personnelId = 'qn-bkttcp-6y';
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
});

describe('Xét điều kiện BKTTCP cá nhân: dư cờ BKBQP/CSTDTQ vẫn không đủ điều kiện', () => {
  it('Xét điều kiện BKTTCP: 13 năm + 6 BKBQP rải đều + 4 CSTDTQ → chưa đủ điều kiện (chỉ xét một lần nên cần đúng 3 BKBQP và 2 CSTDTQ)', async () => {
    const personnelId = 'qn-bkttcp-13y-extra';
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

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(13, 3, 3, 13));
  });
});
