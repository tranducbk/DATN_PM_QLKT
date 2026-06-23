import { prismaMock } from '../helpers/prismaMock';
import {
  AnnualRow,
  ScienceRow,
  buildPersonnelWithHistory,
  buildContiguousCSTDCS,
} from '../helpers/eligibilityFixtures';
import { makeUnit, makeUnitAnnualRecord } from '../helpers/fixtures';
import profileService from '../../src/services/profile.service';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import { DANH_HIEU_CA_NHAN_HANG_NAM, DANH_HIEU_DON_VI_HANG_NAM } from '../../src/constants/danhHieu.constants';
import { eligibilityReasons, unitEligibilityReasons } from '../helpers/errorMessages';

describe('Xét điều kiện BKBQP cá nhân: chu kỳ vẫn tiếp tục dù bỏ lỡ đợt đề nghị', () => {
  it('Xét điều kiện BKBQP: bỏ lỡ đợt ở mốc 2 năm, tới mốc chu kỳ tiếp theo (4 năm liên tục) vẫn đủ điều kiện', async () => {
    const personnelId = 'qn-bkbqp-miss-1';
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

  it('Xét điều kiện BKBQP: bỏ lỡ đợt rồi mới có 3 năm liên tục (lẻ năm, chưa tới mốc chu kỳ 2 năm) → chưa đủ điều kiện', async () => {
    const personnelId = 'qn-bkbqp-miss-2';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2022);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2023,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
  });

  it('Xét điều kiện BKBQP: bỏ lỡ 2 đợt liên tiếp, tới mốc 6 năm liên tục (đúng mốc chu kỳ 2 năm) → đủ điều kiện', async () => {
    const personnelId = 'qn-bkbqp-miss-3';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2025);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2026,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });

  it('Xét điều kiện BKBQP: đã nhận ở chu kỳ đầu (mốc 2 năm), tới chu kỳ kế (mốc 4 năm) không bỏ lỡ → đủ điều kiện', async () => {
    const personnelId = 'qn-bkbqp-cycle2';
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

    expect(result.eligible).toBe(true);
  });

  it('Xét điều kiện BKBQP: đã nhận ở chu kỳ đầu, bỏ lỡ chu kỳ giữa, tới mốc 6 năm liên tục → đủ điều kiện', async () => {
    const personnelId = 'qn-bkbqp-cycle3-miss';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023, {
      2019: { nhan_bkbqp: true },
    });
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

describe('Xét điều kiện CSTDTQ cá nhân: chu kỳ tiếp theo sau khi đã nhận', () => {
  it('Xét điều kiện CSTDTQ: đã nhận ở mốc 3 năm + thêm 3 năm CSTDCS với BKBQP mới → đủ điều kiện ở mốc 6 năm liên tục', async () => {
    const personnelId = 'qn-cstdtq-cycle2';
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
  });

  it('Xét điều kiện CSTDTQ: đã nhận năm 2020, chu kỳ kế không có BKBQP mới trong cửa sổ 3 năm gần nhất → chưa đủ điều kiện', async () => {
    const personnelId = 'qn-cstdtq-no-new-bkbqp';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2018, 2023, {
      2019: { nhan_bkbqp: true },
      2020: { nhan_cstdtq: true },
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
  });

  it('Xét điều kiện CSTDTQ: bỏ lỡ 2 lần liên tiếp, BKBQP rải đều → đủ điều kiện tại mốc 9 năm liên tục', async () => {
    const personnelId = 'qn-cstdtq-miss-twice';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2015, 2023, {
      2016: { nhan_bkbqp: true },
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
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

  it('Xét điều kiện CSTDTQ: bỏ lỡ 2 lần, không có BKBQP trong cửa sổ 3 năm gần nhất → chưa đủ điều kiện', async () => {
    const personnelId = 'qn-cstdtq-miss-no-recent-bkbqp';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2015, 2023, {
      2016: { nhan_bkbqp: true },
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
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(9, 0, 9));
  });

  it('Xét điều kiện CSTDTQ: 6 năm liên tục, đủ 3 BKBQP (bỏ lỡ CSTDTQ chu kỳ đầu) → đủ điều kiện ở mốc chu kỳ thứ 2', async () => {
    const personnelId = 'qn-cstdtq-cycle2-recover';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2022, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2023,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ
    );

    expect(result.eligible).toBe(true);
  });

  it('Xét điều kiện BKTTCP: 7 năm liên tục, đủ 3 BKBQP nhưng chưa nhận CSTDTQ lần nào → chưa đủ điều kiện (thiếu CSTDTQ)', async () => {
    const personnelId = 'qn-bkttcp-no-cstdtq';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2017, 2023, {
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(7, 3, 0, 7));
  });

  it('Xét điều kiện BKTTCP: 7 năm liên tục, đủ BKBQP nhưng chỉ 1 CSTDTQ (bỏ lỡ 1 đợt CSTDTQ) → chưa đủ điều kiện (thiếu 1 CSTDTQ)', async () => {
    const personnelId = 'qn-bkttcp-one-cstdtq';
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

  it('Xét điều kiện CSTDTQ: 4 năm liên tục (đang giữa chu kỳ, đã bỏ lỡ 1 lần) → chưa đủ điều kiện', async () => {
    const personnelId = 'qn-cstdtq-mid-cycle';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2023, {
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
    expect(result.reason).toBe(eligibilityReasons.cstdtqReason(4, 1, 4));
  });
});

describe('Xét điều kiện BKTTCP cá nhân: lặp lại mỗi 7 năm, khóa một lần sau khi nhận', () => {
  it('Xét điều kiện BKTTCP: bỏ lỡ ở mốc 7 năm, tiếp tục tới mốc 14 năm liên tục đủ cờ → đủ điều kiện ở chu kỳ thứ 2 (không cần đứt chuỗi)', async () => {
    const personnelId = 'qn-bkttcp-cycle2-no-break';
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

  it('Xét điều kiện BKTTCP: bỏ lỡ ở mốc 7 năm, mới tới 9 năm liên tục (chưa tới mốc chu kỳ 7 năm) → chưa đủ điều kiện', async () => {
    const personnelId = 'qn-bkttcp-mid-cycle2';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2014, 2022, {
      2015: { nhan_bkbqp: true },
      2017: { nhan_bkbqp: true, nhan_cstdtq: true },
      2019: { nhan_bkbqp: true },
      2020: { nhan_cstdtq: true },
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );

    const result = await profileService.checkAwardEligibility(
      personnelId,
      2023,
      DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(eligibilityReasons.bkttcpReason(9, 2, 2, 9));
  });

  it('Xét điều kiện BKTTCP: đã nhận ở mốc 7 năm + chuỗi tới mốc 14 năm đủ cờ → trả thông báo "chưa hỗ trợ" (chỉ xét một lần)', async () => {
    const personnelId = 'qn-bkttcp-already-received';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2010, 2023, {
      2011: { nhan_bkbqp: true },
      2013: { nhan_bkbqp: true },
      2015: { nhan_bkbqp: true },
      2016: { nhan_bkttcp: true },
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
    expect(result.reason).toBe(eligibilityReasons.bkttcpAlreadyReceived);
  });
});

describe('Xét điều kiện BKBQP đơn vị: chu kỳ vẫn tiếp tục dù bỏ lỡ đợt đề nghị', () => {
  function buildUnitDVQT(unitId: string, fromYear: number, toYear: number) {
    return Array.from({ length: toYear - fromYear + 1 }, (_, i) =>
      makeUnitAnnualRecord({
        unitId,
        unitKind: 'CQDV',
        nam: fromYear + i,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: `QD-DVQT-${fromYear + i}`,
      })
    );
  }

  it('Xét điều kiện BKBQP đơn vị: 2 năm ĐVQT liên tục → đủ điều kiện', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-unit-1' });
    const records = buildUnitDVQT(cqdv.id, 2022, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records.slice().reverse());

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpEligible);
  });

  it('Xét điều kiện BKBQP đơn vị: 3 năm ĐVQT (đã bỏ lỡ 1 đợt, lẻ năm chưa tới mốc chu kỳ 2 năm) → chưa đủ điều kiện', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-unit-2' });
    const records = buildUnitDVQT(cqdv.id, 2021, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records.slice().reverse());

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(false);
    expect(result.reason).toBe(unitEligibilityReasons.bkbqpReason(3));
  });

  it('Xét điều kiện BKBQP đơn vị: 4 năm ĐVQT (bỏ lỡ 1 đợt, tới mốc chu kỳ thứ 2) → đủ điều kiện', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkbqp-unit-3' });
    const records = buildUnitDVQT(cqdv.id, 2020, 2023);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records.slice().reverse());

    const result = await unitAnnualAwardService.checkUnitAwardEligibility(
      cqdv.id,
      2024,
      DANH_HIEU_DON_VI_HANG_NAM.BKBQP
    );

    expect(result.eligible).toBe(true);
  });
});

describe('Xét điều kiện BKTTCP đơn vị: lặp lại sau mỗi 7 năm', () => {
  function arrangeResolveUnit(unit: ReturnType<typeof makeUnit>): void {
    if (unit.kind === 'CQDV') {
      prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: unit.id });
      prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce(null);
    } else {
      prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);
      prismaMock.donViTrucThuoc.findUnique.mockResolvedValueOnce({ id: unit.id });
    }
  }

  function buildUnitDVQTWithFlags(
    unitId: string,
    fromYear: number,
    toYear: number,
    flags: Partial<Record<number, { nhan_bkbqp?: boolean; nhan_bkttcp?: boolean }>> = {}
  ) {
    return Array.from({ length: toYear - fromYear + 1 }, (_, i) => {
      const nam = fromYear + i;
      const f = flags[nam] ?? {};
      return makeUnitAnnualRecord({
        unitId,
        unitKind: 'CQDV',
        nam,
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: `QD-DVQT-${nam}`,
        nhan_bkbqp: f.nhan_bkbqp ?? false,
        so_quyet_dinh_bkbqp: f.nhan_bkbqp ? `QDBK-${nam}` : null,
        nhan_bkttcp: f.nhan_bkttcp ?? false,
        so_quyet_dinh_bkttcp: f.nhan_bkttcp ? `QDTT-${nam}` : null,
      });
    });
  }

  it('Xét điều kiện BKTTCP đơn vị (tính lại hồ sơ): nhận BKTTCP ở mốc 7 năm (2016) + chu kỳ 2 đủ BKBQP → đủ điều kiện nhận lần 2 tại mốc 14 năm (2023)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-cycle2' });
    const records = buildUnitDVQTWithFlags(cqdv.id, 2010, 2023, {
      2011: { nhan_bkbqp: true },
      2013: { nhan_bkbqp: true },
      2015: { nhan_bkbqp: true },
      2016: { nhan_bkttcp: true },
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(
      records.slice().sort((a, b) => b.nam - a.nam)
    );
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(14);
    expect(upsertArgs.update.du_dieu_kien_bkttcp).toBe(true);
  });

  it('Xét điều kiện BKTTCP đơn vị (tính lại hồ sơ): bỏ lỡ ở chu kỳ 1 (năm 2016 không nhận) + chu kỳ 2 đủ BKBQP → tới mốc 14 năm vẫn đủ điều kiện', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-miss-cycle1' });
    const records = buildUnitDVQTWithFlags(cqdv.id, 2010, 2023, {
      2011: { nhan_bkbqp: true },
      2013: { nhan_bkbqp: true },
      2015: { nhan_bkbqp: true },
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(
      records.slice().sort((a, b) => b.nam - a.nam)
    );
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(14);
    expect(upsertArgs.update.du_dieu_kien_bkttcp).toBe(true);
  });

  it('Xét điều kiện BKTTCP đơn vị (tính lại hồ sơ): 14 năm ĐVQT chưa từng nhận, 3 BKBQP dồn ở chu kỳ 1 nhưng chu kỳ 2 không có BKBQP → chưa đủ điều kiện (cửa sổ 7 năm gần nhất rỗng)', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-cycle1-only' });
    const records = buildUnitDVQTWithFlags(cqdv.id, 2010, 2023, {
      2011: { nhan_bkbqp: true },
      2013: { nhan_bkbqp: true },
      2015: { nhan_bkbqp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(
      records.slice().sort((a, b) => b.nam - a.nam)
    );
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(14);
    expect(upsertArgs.update.du_dieu_kien_bkttcp).toBe(false);
  });

  it('Xét điều kiện BKTTCP đơn vị (tính lại hồ sơ): 21 năm ĐVQT, đã nhận năm 2009 và 2016, chu kỳ 3 đủ BKBQP (2018/20/22) → đủ điều kiện nhận lần 3', async () => {
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-bkttcp-cycle3' });
    const records = buildUnitDVQTWithFlags(cqdv.id, 2003, 2023, {
      2009: { nhan_bkttcp: true },
      2016: { nhan_bkttcp: true },
      2018: { nhan_bkbqp: true },
      2020: { nhan_bkbqp: true },
      2022: { nhan_bkbqp: true },
    });
    arrangeResolveUnit(cqdv);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(records);
    prismaMock.danhHieuDonViHangNam.findMany.mockResolvedValueOnce(
      records.slice().sort((a, b) => b.nam - a.nam)
    );
    prismaMock.hoSoDonViHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await unitAnnualAwardService.recalculateAnnualUnit(cqdv.id, 2024);

    const upsertArgs = prismaMock.hoSoDonViHangNam.upsert.mock.calls[0][0];
    expect(upsertArgs.update.dvqt_lien_tuc).toBe(21);
    expect(upsertArgs.update.du_dieu_kien_bkttcp).toBe(true);
  });
});

describe('Xét điều kiện BKBQP cá nhân: tính lại hồ sơ và ghi nhận số đợt đã bỏ lỡ', () => {
  it('Xét điều kiện BKBQP (tính lại hồ sơ): 3 năm liên tục chưa nhận BKBQP (lẻ năm) → chưa đủ điều kiện', async () => {
    const personnelId = 'qn-bkbqp-recalc-missed';
    const danhHieu: AnnualRow[] = [];
    const nckh: ScienceRow[] = [];
    for (let y = 2021; y <= 2023; y++) {
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

    await profileService.recalculateAnnualProfile(personnelId, 2024);

    const args = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args.update.cstdcs_lien_tuc).toBe(3);
    expect(args.update.du_dieu_kien_bkbqp).toBe(false);
  });

  it('Xét điều kiện BKBQP (tính lại hồ sơ): 4 năm liên tục chưa nhận BKBQP (tới mốc chu kỳ thứ 2 sau khi bỏ lỡ 1 lần) → đủ điều kiện', async () => {
    const personnelId = 'qn-bkbqp-recalc-cycle2';
    const { danhHieu, nckh } = buildContiguousCSTDCS(2020, 2023);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(
      buildPersonnelWithHistory(personnelId, danhHieu, nckh)
    );
    prismaMock.hoSoHangNam.upsert.mockImplementationOnce(async (args: any) => args.create);

    await profileService.recalculateAnnualProfile(personnelId, 2024);

    const args = prismaMock.hoSoHangNam.upsert.mock.calls[0][0];
    expect(args.update.cstdcs_lien_tuc).toBe(4);
    expect(args.update.du_dieu_kien_bkbqp).toBe(true);
  });
});

describe('Xét điều kiện BKBQP cá nhân: nội dung lý do chưa đủ điều kiện', () => {
  it('Xét điều kiện BKBQP: khi chưa đủ số năm liên tục, lý do hiển thị đúng số năm CSTDCS liên tục', async () => {
    const personnelId = 'qn-bkbqp-reason';
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
});
