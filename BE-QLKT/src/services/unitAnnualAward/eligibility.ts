import { prisma } from '../../models';
import {
  getDanhHieuName,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_DON_VI_CO_BAN,
  DANH_HIEU_DON_VI_BANG_KHEN,
} from '../../constants/danhHieu.constants';
import { UNIT_CHAIN_AWARDS, findChainAwardConfig } from '../../constants/chainAwards.constants';
import { checkChainEligibility, type FlagsInWindow } from '../eligibility/chainEligibility';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { resolveUnit, buildUnitIdFields } from '../../helpers/unitHelper';

export async function calculateContinuousYears(donViId: string, year: number) {
  year = Number(year);
  const records = await prisma.danhHieuDonViHangNam.findMany({
    where: {
      OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
      nam: { lte: year - 1 },
      danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
    },
    orderBy: { nam: 'desc' },
    select: { nam: true, danh_hieu: true },
  });

  let continuous = 0;
  let current = year - 1;
  for (const r of records) {
    if (r.nam !== current) break;
    continuous += 1;
    current -= 1;
  }
  return continuous;
}

export async function countBKBQPInStreak(donViId: string, year: number, dvqtStreak?: number) {
  year = Number(year);
  const streak = dvqtStreak ?? (await calculateContinuousYears(donViId, year));
  const startYear = year - 1 - streak + 1;
  const count = await prisma.danhHieuDonViHangNam.count({
    where: {
      OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
      nam: { gte: startYear, lte: year - 1 },
      nhan_bkbqp: true,
    },
  });
  return count;
}

export async function calculateTotalDVQT(donViId: string, year: number) {
  year = Number(year);
  const records = await prisma.danhHieuDonViHangNam.findMany({
    where: {
      OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
      nam: { lte: year },
      status: PROPOSAL_STATUS.APPROVED,
      danh_hieu: { not: null },
    },
    select: {
      nam: true,
      danh_hieu: true,
      so_quyet_dinh: true,
      nhan_bkbqp: true,
      nhan_bkttcp: true,
      so_quyet_dinh_bkbqp: true,
      so_quyet_dinh_bkttcp: true,
    },
  });

  const validRecords = records.filter(
    r => r.danh_hieu && DANH_HIEU_DON_VI_CO_BAN.has(r.danh_hieu)
  );
  return {
    total: validRecords.length,
    details: validRecords.map(r => ({
      nam: r.nam,
      danh_hieu: r.danh_hieu,
      so_quyet_dinh: r.so_quyet_dinh || null,
      nhan_bkbqp: r.nhan_bkbqp || false,
      nhan_bkttcp: r.nhan_bkttcp || false,
      so_quyet_dinh_bkbqp: r.so_quyet_dinh_bkbqp || null,
      so_quyet_dinh_bkttcp: r.so_quyet_dinh_bkttcp || null,
    })),
  };
}

export function buildSuggestion(
  dvqtLienTuc: number,
  du_dieu_kien_bk_tong_cuc: boolean,
  du_dieu_kien_bk_thu_tuong: boolean,
  hasReceivedBKTTCP: boolean
) {
  const tenBKBQP = getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKBQP);
  const tenBKTTCP = getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKTTCP);

  if (du_dieu_kien_bk_thu_tuong) {
    return `Đã đủ điều kiện đề nghị xét ${tenBKTTCP}.`;
  }
  if (hasReceivedBKTTCP && dvqtLienTuc % 7 === 0 && dvqtLienTuc > 7) {
    return `Phần mềm chưa hỗ trợ khen thưởng cao hơn ${tenBKTTCP}, sẽ phát triển trong thời gian tới.`;
  }
  if (du_dieu_kien_bk_tong_cuc) {
    return `Đã đủ điều kiện đề nghị xét ${tenBKBQP}.`;
  }
  return `Chưa đủ điều kiện đề nghị xét ${tenBKBQP}.`;
}

export async function checkUnitAwardEligibility(donViId: string, year: number, danhHieu: string) {
  year = Number(year);
  if (!DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu)) {
    return { eligible: true, reason: '' };
  }

  const config = findChainAwardConfig(UNIT_CHAIN_AWARDS, danhHieu);
  if (!config) return { eligible: true, reason: '' };

  const dvqtLienTuc = await calculateContinuousYears(donViId, year);
  const bkbqpInCycle = await countBKBQPInStreak(donViId, year, config.cycleYears);

  const flagsInWindow: FlagsInWindow = {};
  config.requiredFlags.forEach(f => {
    flagsInWindow[f.code] = bkbqpInCycle;
  });

  let hasReceived = false;
  if (config.isLifetime) {
    const lifetimeCount = await prisma.danhHieuDonViHangNam.count({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        [config.flagColumn]: true,
      },
    });
    hasReceived = lifetimeCount > 0;
  }

  return checkChainEligibility(
    config,
    { streakLength: dvqtLienTuc, nckhStreak: 0 },
    hasReceived,
    flagsInWindow
  );
}

export async function recalculateAnnualUnit(donViId: string, year: number | null = null) {
  const { isCoQuanDonVi } = await resolveUnit(donViId);
  const targetYear = year ? Number(year) : new Date().getFullYear();

  const [danhHieuList, dvqtResult, dvqtLienTuc] = await Promise.all([
    prisma.danhHieuDonViHangNam.findMany({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        nam: { lte: targetYear },
        status: PROPOSAL_STATUS.APPROVED,
      },
      orderBy: { nam: 'asc' },
    }),
    calculateTotalDVQT(donViId, targetYear),
    calculateContinuousYears(donViId, targetYear),
  ]);

  const bkbqpInStreak = await countBKBQPInStreak(donViId, targetYear, dvqtLienTuc);

  const du_dieu_kien_bk_tong_cuc = dvqtLienTuc >= 2 && dvqtLienTuc % 2 === 0;
  const du_dieu_kien_bk_thu_tuong = dvqtLienTuc === 7 && bkbqpInStreak === 3;

  const hasReceivedBKTTCP = danhHieuList.some(dh => dh.nhan_bkttcp === true);
  const goi_y = buildSuggestion(
    dvqtLienTuc,
    du_dieu_kien_bk_tong_cuc,
    du_dieu_kien_bk_thu_tuong,
    hasReceivedBKTTCP
  );

  const whereCondition = isCoQuanDonVi
    ? { unique_co_quan_don_vi_nam: { co_quan_don_vi_id: donViId, nam: targetYear } }
    : { unique_don_vi_truc_thuoc_nam: { don_vi_truc_thuoc_id: donViId, nam: targetYear } };

  const hoSoData = {
    tong_dvqt: dvqtResult.total,
    tong_dvqt_json: dvqtResult.details,
    dvqt_lien_tuc: dvqtLienTuc,
    du_dieu_kien_bk_tong_cuc,
    du_dieu_kien_bk_thu_tuong,
    goi_y,
  };

  const hoSo = await prisma.hoSoDonViHangNam.upsert({
    where: whereCondition,
    update: hoSoData,
    create: {
      ...hoSoData,
      ...buildUnitIdFields(donViId, isCoQuanDonVi),
      nam: targetYear,
    },
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: true,
    },
  });

  return hoSo;
}

export async function recalculate({ don_vi_id, nam }) {
  if (don_vi_id && nam) {
    await recalculateAnnualUnit(don_vi_id, Number(nam));
    return 1;
  }

  if (don_vi_id) {
    const records = await prisma.hoSoDonViHangNam.findMany({
      where: {
        OR: [{ co_quan_don_vi_id: don_vi_id }, { don_vi_truc_thuoc_id: don_vi_id }],
      },
      select: { nam: true },
      distinct: ['nam'],
    });

    for (const r of records) {
      await recalculateAnnualUnit(don_vi_id, r.nam);
    }

    return records.length;
  }

  const records = await prisma.hoSoDonViHangNam.findMany({
    select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true, nam: true },
  });

  const uniqueUnits = new Map();
  for (const r of records) {
    const unitId = r.co_quan_don_vi_id || r.don_vi_truc_thuoc_id;
    if (!uniqueUnits.has(unitId)) {
      uniqueUnits.set(unitId, new Set());
    }
    uniqueUnits.get(unitId).add(r.nam);
  }

  let count = 0;
  for (const [unitId, years] of uniqueUnits) {
    for (const year of years) {
      await recalculateAnnualUnit(unitId, year);
      count++;
    }
  }

  return count;
}
