import { danhHieuHangNamRepository, danhHieuDonViHangNamRepository } from '../../repositories/danhHieu.repository';
import { contributionMedalRepository } from '../../repositories/contributionMedal.repository';
import { tenureMedalRepository } from '../../repositories/tenureMedal.repository';
import { militaryFlagRepository } from '../../repositories/militaryFlag.repository';
import { commemorativeMedalRepository } from '../../repositories/commemorativeMedal.repository';
import { scientificAchievementRepository } from '../../repositories/scientificAchievement.repository';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import type { Prisma } from '../../generated/prisma';
import ExcelJS from 'exceljs';

const danhHieuWithPersonnelInclude = {
  QuanNhan: {
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: { include: { CoQuanDonVi: true } },
      ChucVu: true,
    },
  },
} satisfies Prisma.DanhHieuHangNamInclude;

type DanhHieuHangNamWithPersonnel = Prisma.DanhHieuHangNamGetPayload<{
  include: typeof danhHieuWithPersonnelInclude;
}>;
import { sanitizeRowData } from '../../helpers/excel/excelHelper';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { DANH_HIEU_HCBVTQ } from '../../constants/danhHieu.constants';
import {
  AWARD_EXCEL_SHEETS,
  EXCEL_HEADER_FILL_COLOR,
  PROPOSAL_AWARDS_EXPORT_COLUMNS,
} from '../../constants/awardExcel.constants';

/**
 * Returns annual-award data for admin oversight with filterable pagination.
 * @param {Object} filters - Filters (don_vi_id, nam, danh_hieu)
 * @param {number} page - Page number
 * @param {number} limit - Page size
 * @returns {Promise<Object>} Award list payload
 */
async function getAllAwards(
  filters: Record<string, unknown> = {},
  page: number = 1,
  limit: number = 50
) {
  const don_vi_id = filters.don_vi_id as string | undefined;
  const nam = filters.nam;
  const danh_hieu = filters.danh_hieu as string | undefined;
  const skip = (page - 1) * limit;

  const where: Prisma.DanhHieuHangNamWhereInput = {};
  if (nam) where.nam = parseInt(String(nam), 10);
  if (danh_hieu) where.danh_hieu = danh_hieu;

  const [awards, total] = await Promise.all([
    danhHieuHangNamRepository.findMany({
      where,
      include: danhHieuWithPersonnelInclude,
      skip,
      take: limit,
      orderBy: [{ nam: 'desc' }, { QuanNhan: { ho_ten: 'asc' } }],
    }) as Promise<DanhHieuHangNamWithPersonnel[]>,
    danhHieuHangNamRepository.count({ where }),
  ]);

  let filteredAwards = awards;
  if (don_vi_id) {
    filteredAwards = awards.filter(
      a => (a.QuanNhan.co_quan_don_vi_id || a.QuanNhan.don_vi_truc_thuoc_id) === don_vi_id
    );
  }

  const awardsWithNCKH = await Promise.all(
    filteredAwards.map(async a => {
      const thanhTichList = await scientificAchievementRepository.findManyRaw({
        where: {
          quan_nhan_id: a.QuanNhan.id,
          nam: a.nam,
        },
        select: {
          id: true,
          loai: true,
          mo_ta: true,
        },
      });
      return {
        id: a.id,
        cccd: a.QuanNhan.cccd,
        ho_ten: a.QuanNhan.ho_ten,
        don_vi: (a.QuanNhan.DonViTrucThuoc || a.QuanNhan.CoQuanDonVi)?.ten_don_vi || '-',
        chuc_vu: a.chuc_vu,
        cap_bac: a.cap_bac,
        nam: a.nam,
        danh_hieu: a.danh_hieu,
        nhan_bkbqp: a.nhan_bkbqp,
        so_quyet_dinh_bkbqp: a.so_quyet_dinh_bkbqp,
        nhan_cstdtq: a.nhan_cstdtq,
        so_quyet_dinh_cstdtq: a.so_quyet_dinh_cstdtq,
        nhan_bkttcp: a.nhan_bkttcp,
        so_quyet_dinh_bkttcp: a.so_quyet_dinh_bkttcp,
        thanh_tich_khoa_hoc: thanhTichList,
      };
    })
  );

  return {
    awards: awardsWithNCKH,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Produces a consolidated award export for reporting and offline review.
 * @param {Object} filters - Export filters
 * @returns {Promise<Buffer>} Excel workbook buffer
 */
async function exportAllAwardsExcel(filters: Record<string, unknown> = {}) {
  const don_vi_id = filters.don_vi_id as string | undefined;
  const nam = filters.nam;
  const danh_hieu = filters.danh_hieu as string | undefined;
  const where: Prisma.DanhHieuHangNamWhereInput = {};
  if (nam) where.nam = parseInt(String(nam), 10);
  if (danh_hieu) where.danh_hieu = danh_hieu;

  const awards = (await danhHieuHangNamRepository.findMany({
    where,
    include: danhHieuWithPersonnelInclude,
    orderBy: [{ nam: 'desc' }, { QuanNhan: { ho_ten: 'asc' } }],
  })) as DanhHieuHangNamWithPersonnel[];

  let filteredAwards = awards;
  if (don_vi_id) {
    filteredAwards = awards.filter(
      a => (a.QuanNhan.co_quan_don_vi_id || a.QuanNhan.don_vi_truc_thuoc_id) === don_vi_id
    );
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.PROPOSAL_AWARDS);

  sheet.columns = [...PROPOSAL_AWARDS_EXPORT_COLUMNS];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: EXCEL_HEADER_FILL_COLOR },
  };
  sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // Format CCCD as Text to preserve leading zeros
  sheet.getColumn(2).numFmt = '@';

  filteredAwards.forEach((award, index) => {
    sheet.addRow(sanitizeRowData({
      stt: index + 1,
      cccd: award.QuanNhan.cccd,
      ho_ten: award.QuanNhan.ho_ten,
      don_vi: (award.QuanNhan.DonViTrucThuoc || award.QuanNhan.CoQuanDonVi)?.ten_don_vi ?? '-',
      chuc_vu: award.QuanNhan.ChucVu.ten_chuc_vu,
      nam: award.nam,
      danh_hieu: award.danh_hieu || '',
      bkbqp: award.nhan_bkbqp ? 'X' : '',
      so_qd_bkbqp: award.so_quyet_dinh_bkbqp || '',
      cstdtq: award.nhan_cstdtq ? 'X' : '',
      so_qd_cstdtq: award.so_quyet_dinh_cstdtq || '',
      bkttcp: award.nhan_bkttcp ? 'X' : '',
      so_qd_bkttcp: award.so_quyet_dinh_bkttcp || '',
    }));
  });

  return await workbook.xlsx.writeBuffer();
}

async function getAwardsStatistics() {
  const decisionsByType = await decisionFileRepository.groupByLoaiKhenThuong();
  const proposalsByType = await proposalRepository.groupByLoaiDeXuat();

  const [
    annualRewardCount,
    contributionMedalCount,
    tenureMedalCount,
    militaryFlagCount,
    commemorationMedalCount,
    scientificAchievementCount,
    unitAnnualRewardCount,
  ] = await Promise.all([
    danhHieuHangNamRepository.count({
      where: { danh_hieu: { not: null, notIn: Object.values(DANH_HIEU_HCBVTQ) } },
    }),
    contributionMedalRepository.count({}),
    tenureMedalRepository.count({}),
    militaryFlagRepository.count({}),
    commemorativeMedalRepository.count({}),
    scientificAchievementRepository.count({}),
    danhHieuDonViHangNamRepository.count({
      where: { danh_hieu: { not: null } },
    }),
  ]);

  const decisionsMap = {};
  decisionsByType.forEach(item => {
    decisionsMap[item.loai_khen_thuong] = item._count.id;
  });

  const proposalsMap = {};
  proposalsByType.forEach(item => {
    proposalsMap[item.loai_de_xuat] = item._count.id;
  });

  const statistics = {
    CA_NHAN_HANG_NAM: {
      quyet_dinh: decisionsMap[PROPOSAL_TYPES.CA_NHAN_HANG_NAM] || 0,
      de_xuat: proposalsMap[PROPOSAL_TYPES.CA_NHAN_HANG_NAM] || 0,
      danh_hieu: annualRewardCount,
    },
    DON_VI_HANG_NAM: {
      quyet_dinh: decisionsMap[PROPOSAL_TYPES.DON_VI_HANG_NAM] || 0,
      de_xuat: proposalsMap[PROPOSAL_TYPES.DON_VI_HANG_NAM] || 0,
      don_vi: unitAnnualRewardCount,
    },
    NIEN_HAN: {
      quyet_dinh: decisionsMap[PROPOSAL_TYPES.NIEN_HAN] || 0,
      de_xuat: proposalsMap[PROPOSAL_TYPES.NIEN_HAN] || 0,
      khen_thuong: tenureMedalCount,
    },
    HC_QKQT: {
      quyet_dinh: decisionsMap[PROPOSAL_TYPES.HC_QKQT] || 0,
      de_xuat: proposalsMap[PROPOSAL_TYPES.HC_QKQT] || 0,
      khen_thuong: militaryFlagCount,
    },
    KNC_VSNXD_QDNDVN: {
      quyet_dinh: decisionsMap[PROPOSAL_TYPES.KNC_VSNXD_QDNDVN] || 0,
      de_xuat: proposalsMap[PROPOSAL_TYPES.KNC_VSNXD_QDNDVN] || 0,
      khen_thuong: commemorationMedalCount,
    },
    CONG_HIEN: {
      quyet_dinh: decisionsMap[PROPOSAL_TYPES.CONG_HIEN] || 0,
      de_xuat: proposalsMap[PROPOSAL_TYPES.CONG_HIEN] || 0,
      khen_thuong: contributionMedalCount,
    },
    DOT_XUAT: {
      quyet_dinh: decisionsMap[PROPOSAL_TYPES.DOT_XUAT] || 0,
      de_xuat: proposalsMap[PROPOSAL_TYPES.DOT_XUAT] || 0,
    },
    NCKH: {
      quyet_dinh: decisionsMap[PROPOSAL_TYPES.NCKH] || 0,
      de_xuat: proposalsMap[PROPOSAL_TYPES.NCKH] || 0,
      thanh_tich: scientificAchievementCount,
    },
  };

  return statistics;
}

export {
  getAllAwards,
  exportAllAwardsExcel,
  getAwardsStatistics,
};
