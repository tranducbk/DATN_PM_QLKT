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
    // Cho: chuỗi liên tục 7 năm với 3 BKBQP và 2 CSTDTQ trong đó
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

    // Khi
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    // Thì
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(eligibilityReasons.bkttcpEligible);
  });

  it('A2. 7y CSTDCS + 3 BKBQP + 2 CSTDTQ nhưng thiếu 1 NCKH (6 NCKH) → fail với reason exact', async () => {
    // Cho: đủ flag nhưng NCKH gap năm 2018 (NCKH chỉ tính liên tục từ year-1 ngược lại)
    const personnelId = 'qn-bkttcp-A2';
    const { danhHieu } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true, nhan_cstdtq: true },
      2022: { nhan_bkbqp: true },
      2023: { nhan_cstdtq: true },
    });
    // NCKH chỉ từ 2018-2023 (6 năm liên tục từ 2023 ngược lại)
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

    // Khi
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    // Thì
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
    // Code tại profile.service.ts:590 dùng === 3 strict equality
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

    // 4 BKBQP fail check strict === 3
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
    // Cho: 8y liên tục, flags đặt trong window 7 năm 2017-2023
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
    // Case 13y trong audit — code reject vì cstdcs_lien_tuc !== 7
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
    // Cho: 14y liên tục, message BKTTCP ưu tiên hơn check thiếu flag
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
    // Cho: BKTTCP năm 2010 (gap), rồi chuỗi 7y mới 2017-2023
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

    // Lifetime block kích hoạt trước check insufficient/eligible.
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
    // Lifetime block kích hoạt bất kể chuỗi mới có đủ tiêu chí BKTTCP hay không.
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
    // Cho: BKTTCP năm 2010 rồi gap, chuỗi 7y mới 2017-2023 đủ flag
    // Rule chốt: recalc đánh giá du_dieu_kien_bkttcp trước; nếu true, goi_y = eligible
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
    // Break (CSTT) reset streak — chuỗi 7y mới qualify dù có năm trước đó.
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
    // Cho: 13y CSTDCS liên tục từ 2011-2023; BKBQP tại 2011/2013/2015/2017/2019/2021,
    // CSTDTQ tại 2014/2017/2020/2023.
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

    // Khi: range 2017-2023 chứa BKBQP tại 2017/2019/2021 = 3, CSTDTQ tại 2017/2020/2023 = 3
    const result = await profileService.checkAwardEligibility(
      personnelId,
      2024,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    // Thì: streak vượt cycle (13 > 7, không phải bội số) → message missed window.
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpMissedWindow(13));
  });
});
