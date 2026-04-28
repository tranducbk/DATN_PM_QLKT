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

describe('profile.service - BKTTCP exhaustive (streak vs flags vs NCKH)', () => {
  it('7y CSTDCS + 3 BKBQP + 2 CSTDTQ + 7 NCKH → eligible', async () => {
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

  it('7y CSTDCS + 3 BKBQP + 2 CSTDTQ nhưng thiếu 1 NCKH (6 NCKH) → fail', async () => {
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

  it('7y + 2 BKBQP + 2 CSTDTQ + 7 NCKH (thiếu 1 BKBQP) → fail', async () => {
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

  it('7y + 3 BKBQP + 1 CSTDTQ + 7 NCKH (thiếu 1 CSTDTQ) → fail', async () => {
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

  it('7y + 4 BKBQP + 2 CSTDTQ → fail (lifetime cần đúng 3 BKBQP, không phải >=3)', async () => {
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

  it('7y + 3 BKBQP + 3 CSTDTQ → fail (lifetime cần đúng 2 CSTDTQ)', async () => {
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

describe('profile.service - BKTTCP repeatable cycle (chưa nhận → eligible tại bội số 7)', () => {
  it('14y CSTDCS với flags ĐỦ HẾT trong 7y cuối, chưa nhận BKTTCP → eligible chu kỳ 2', async () => {
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

  it('14y CSTDCS với flags KHÔNG đủ trong 7y cuối, chưa nhận → fail insufficient', async () => {
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

  it('21y CSTDCS không có flags → fail insufficient (không phải "chưa hỗ trợ")', async () => {
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

  it('8y CSTDCS với flags đủ trong 7y cuối, chưa nhận → fail insufficient (8 không bội 7)', async () => {
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

  it('15y CSTDCS (không bội 7) → fail insufficient', async () => {
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

  it('20y CSTDCS (không bội 7) → fail insufficient', async () => {
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

describe('profile.service - BKTTCP đã nhận → "chưa hỗ trợ cao hơn"', () => {
  it('Đã nhận BKTTCP năm 2010 + 7y CSTDCS mới + đủ flags → "chưa hỗ trợ"', async () => {
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

  it('Đã nhận BKTTCP + 14y CSTDCS → "chưa hỗ trợ"', async () => {
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

  it('Recalc đã nhận BKTTCP + chuỗi tiếp tục → goi_y luôn "chưa hỗ trợ"', async () => {
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

  it('Recalc đã nhận BKTTCP + chuỗi mới đủ 7y với flags → goi_y vẫn "chưa hỗ trợ" (lifetime block)', async () => {
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

describe('profile.service - BKTTCP fresh chain after CSTDCS break', () => {
  it('5y CSTDCS → 1 CSTT (đứt) → 7y CSTDCS mới + đủ flags → eligible BKTTCP', async () => {
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

describe('profile.service - BKTTCP boundary edges (streak < 7)', () => {
  it('6y CSTDCS + flags đủ trong 7y cuối → fail (streak < 7)', async () => {
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

describe('profile.service - BKTTCP edge cases (extra flags)', () => {
  it('13y + 6 BKBQP rải đều + 4 CSTDTQ → fail (lifetime cần đúng 3 BKBQP / 2 CSTDTQ)', async () => {
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
