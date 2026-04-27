import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';
import ExcelJS from 'exceljs';
import { loadWorkbook, getAndValidateWorksheet } from '../helpers/excel/excelImportHelper';

import {
  getDanhHieuName,
  formatDanhHieuList,
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_DON_VI_CO_BAN,
  DANH_HIEU_DON_VI_BANG_KHEN,
} from '../constants/danhHieu.constants';
import { UNIT_CHAIN_AWARDS, findChainAwardConfig } from '../constants/chainAwards.constants';
import { checkChainEligibility, type FlagsInWindow } from './eligibility/chainEligibility';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import {
  parseHeaderMap,
  getHeaderCol,
  parseBooleanValue,
  sanitizeRowData,
} from '../helpers/excel/excelHelper';
import { NotFoundError, ValidationError, ForbiddenError } from '../middlewares/errorHandler';
import { resolveUnit, buildUnitIdFields } from '../helpers/unitHelper';
import { validateDecisionNumbers } from './eligibility/decisionNumberValidation';
import { applyThinBordersToGrid, styleHeaderRow } from '../helpers/excel/excelTemplateHelper';
import {
  IMPORT_TRANSACTION_TIMEOUT,
  EXCEL_INLINE_VALIDATION_MAX_LENGTH,
  MIN_TEMPLATE_ROWS,
  EXPORT_FETCH_LIMIT,
} from '../constants/excel.constants';
import {
  AWARD_EXCEL_SHEETS,
  UNIT_ANNUAL_DANH_HIEU_VALIDATION_FORMULA,
  UNIT_ANNUAL_TEMPLATE_COLUMNS,
} from '../constants/awardExcel.constants';

interface UnitAnnualAwardValidItem {
  row: number;
  unit_id: string;
  is_co_quan_don_vi: boolean;
  ma_don_vi: string;
  ten_don_vi: string;
  nam: number;
  danh_hieu: string;
  so_quyet_dinh: string;
  ghi_chu: string | null;
  history: Array<{
    nam: number;
    danh_hieu: string;
    nhan_bkbqp: boolean;
    nhan_bkttcp: boolean;
    so_quyet_dinh: string | null;
  }>;
}

/** Inline duplicate check using pre-fetched maps — replaces per-row checkDuplicateUnitAward calls. */
function checkUnitDuplicate(
  unitId: string,
  nam: number,
  danhHieu: string,
  existingAwardByUnitYear: Map<
    string,
    { danh_hieu: string | null; nhan_bkbqp: boolean; nhan_bkttcp: boolean }
  >,
  proposalsByYear: Map<number, Array<{ data_danh_hieu: any }>>
): void {
  const proposalsForYear = proposalsByYear.get(nam) ?? [];
  const hasPendingProposal = proposalsForYear.some(p => {
    const data = (p.data_danh_hieu as Array<Record<string, unknown>>) ?? [];
    return data.some(item => item.don_vi_id === unitId && item.danh_hieu === danhHieu);
  });
  if (hasPendingProposal) {
    throw new ValidationError(
      `Đơn vị đã có đề xuất danh hiệu ${getDanhHieuName(danhHieu)} cho năm ${nam}`
    );
  }

  const existingAward = existingAwardByUnitYear.get(`${unitId}_${nam}`);
  if (!existingAward) return;

  const isDv = DANH_HIEU_DON_VI_CO_BAN.has(danhHieu);
  const isBk = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);

  if (isDv && existingAward.danh_hieu) {
    if (existingAward.danh_hieu === danhHieu) {
      throw new ValidationError(
        `Đơn vị đã có danh hiệu ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
      );
    }
    throw new ValidationError(
      `Đơn vị đã có danh hiệu ${getDanhHieuName(existingAward.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
    );
  }

  if (isBk) {
    if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP && existingAward.nhan_bkbqp) {
      throw new ValidationError(
        `Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
      );
    }
    if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP && existingAward.nhan_bkttcp) {
      throw new ValidationError(
        `Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
      );
    }
  }

  if (isDv && (existingAward.nhan_bkbqp || existingAward.nhan_bkttcp)) {
    const existingBk = existingAward.nhan_bkbqp
      ? DANH_HIEU_DON_VI_HANG_NAM.BKBQP
      : DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
    throw new ValidationError(
      `Đơn vị đã có ${getDanhHieuName(existingBk)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
    );
  }

  if (isBk && existingAward.danh_hieu && DANH_HIEU_DON_VI_CO_BAN.has(existingAward.danh_hieu)) {
    throw new ValidationError(
      `Đơn vị đã có danh hiệu ${getDanhHieuName(existingAward.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
    );
  }
}

class UnitAnnualAwardService {
  /**
   * Calculates consecutive years a unit achieved DVQT.
   * A year counts when DanhHieuDonViHangNam has `danh_hieu = "DVQT"` for that year.
   */
  async calculateContinuousYears(donViId, year) {
    // Check awarded records (danh hieu) in DanhHieuDonViHangNam table
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

  /**
   * Đếm tổng số lần nhận BKBQP trong chuỗi ĐVQT liên tục.
   */
  async countBKBQPInStreak(donViId, year, dvqtStreak?: number) {
    const streak = dvqtStreak ?? await this.calculateContinuousYears(donViId, year);
    const startYear = (year - 1) - streak + 1;
    const count = await prisma.danhHieuDonViHangNam.count({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        nam: { gte: startYear, lte: year - 1 },
        nhan_bkbqp: true,
      },
    });
    return count;
  }

  /**
   * Calculates total times a unit achieved DVQT.
   */
  async calculateTotalDVQT(donViId, year) {
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

    // JSON payload keeps DVQT/DVTT in danh_hieu; BKBQP/BKTTCP use booleans.
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

  buildSuggestion(dvqtLienTuc: number, du_dieu_kien_bk_tong_cuc: boolean, du_dieu_kien_bk_thu_tuong: boolean, hasReceivedBKTTCP: boolean) {
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

  /**
   * Validates chain-award eligibility for a unit.
   * @param {string} donViId - Unit ID
   * @param {number} year - Target year
   * @param {string} danhHieu - BKBQP or BKTTCP
   * @returns {Object} { eligible: boolean, reason: string }
   */
  async checkUnitAwardEligibility(donViId, year, danhHieu) {
    if (!DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu)) {
      return { eligible: true, reason: '' };
    }

    const config = findChainAwardConfig(UNIT_CHAIN_AWARDS, danhHieu);
    if (!config) return { eligible: true, reason: '' };

    const dvqtLienTuc = await this.calculateContinuousYears(donViId, year);
    // Count BKBQP within the cycle window (e.g. last 7y for BKTTCP) so that flags from
    // earlier cycles do not retro-claim into the current one.
    const bkbqpInCycle = await this.countBKBQPInStreak(donViId, year, config.cycleYears);

    const flagsInWindow: FlagsInWindow = {};
    config.requiredFlags.forEach(f => {
      flagsInWindow[f.code] = bkbqpInCycle;
    });

    // Lifetime block: scan only when needed to keep non-lifetime checks at the original 2 queries.
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

    const lastClaim = await prisma.danhHieuDonViHangNam.findFirst({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        [config.flagColumn]: true,
        nam: { lt: year },
      },
      orderBy: { nam: 'desc' },
      select: { nam: true },
    });

    return checkChainEligibility(
      config,
      { streakLength: dvqtLienTuc, nckhStreak: 0, lastClaimYear: lastClaim?.nam ?? null },
      hasReceived,
      flagsInWindow,
      year
    );
  }

  /** Manager proposal flow (PENDING): creates DanhHieuDonViHangNam records. */
  async propose({ don_vi_id, nam, danh_hieu, ghi_chu, nguoi_tao_id }) {
    const year = Number(nam);
    const unitId = don_vi_id;

    const { isCoQuanDonVi } = await resolveUnit(unitId);

    const record = await prisma.danhHieuDonViHangNam.upsert({
      where: isCoQuanDonVi
        ? { unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: unitId, nam: year } }
        : { unique_don_vi_truc_thuoc_nam_dh: { don_vi_truc_thuoc_id: unitId, nam: year } },
      update: {
        danh_hieu: danh_hieu || null,
        ghi_chu: ghi_chu || null,
        status: PROPOSAL_STATUS.PENDING,
      },
      create: {
        ...buildUnitIdFields(unitId, isCoQuanDonVi),
        nam: year,
        danh_hieu: danh_hieu || null,
        ghi_chu: ghi_chu || null,
        nguoi_tao_id: nguoi_tao_id,
        status: PROPOSAL_STATUS.PENDING,
      },
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    });

    await this.recalculateAnnualUnit(unitId, year);

    return record;
  }

  /** Admin approval flow for unit awards. */
  async approve(
    id,
    {
      so_quyet_dinh,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp,
      file_quyet_dinh_bkbqp,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp,
      file_quyet_dinh_bkttcp,
      nguoi_duyet_id,
    }
  ) {
    const updateData: Record<string, any> = {
      status: PROPOSAL_STATUS.APPROVED,
      nguoi_duyet_id: nguoi_duyet_id,
      ngay_duyet: new Date(),
      so_quyet_dinh: so_quyet_dinh || null,
    };

    if (nhan_bkbqp !== undefined) {
      updateData.nhan_bkbqp = nhan_bkbqp;
    }
    if (so_quyet_dinh_bkbqp !== undefined) {
      updateData.so_quyet_dinh_bkbqp = so_quyet_dinh_bkbqp || null;
    }
    if (file_quyet_dinh_bkbqp !== undefined) {
      updateData.file_quyet_dinh_bkbqp = file_quyet_dinh_bkbqp || null;
    }

    if (nhan_bkttcp !== undefined) {
      updateData.nhan_bkttcp = nhan_bkttcp;
    }
    if (so_quyet_dinh_bkttcp !== undefined) {
      updateData.so_quyet_dinh_bkttcp = so_quyet_dinh_bkttcp || null;
    }
    if (file_quyet_dinh_bkttcp !== undefined) {
      updateData.file_quyet_dinh_bkttcp = file_quyet_dinh_bkttcp || null;
    }

    // Update DanhHieuDonViHangNam status to APPROVED
    const updatedDanhHieu = await prisma.danhHieuDonViHangNam.update({
      where: { id: String(id) },
      data: updateData,
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    });

    const donViId = updatedDanhHieu.co_quan_don_vi_id || updatedDanhHieu.don_vi_truc_thuoc_id;
    await this.recalculateAnnualUnit(donViId, updatedDanhHieu.nam);

    return updatedDanhHieu;
  }

  /** Admin rejection flow for unit awards. */
  async reject(
    id: string,
    { ghi_chu, nguoi_duyet_id }: { ghi_chu: string; nguoi_duyet_id: string }
  ) {
    const rejectedDanhHieu = await prisma.danhHieuDonViHangNam.update({
      where: { id: String(id) },
      data: {
        status: PROPOSAL_STATUS.REJECTED,
        ghi_chu: ghi_chu ?? null,
        nguoi_duyet_id: nguoi_duyet_id,
        ngay_duyet: new Date(),
      },
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    });

    const donViId = rejectedDanhHieu.co_quan_don_vi_id || rejectedDanhHieu.don_vi_truc_thuoc_id;
    await this.recalculateAnnualUnit(donViId, rejectedDanhHieu.nam);

    return rejectedDanhHieu;
  }

  async list({
    page = 1,
    limit = 10,
    year,
    donViId,
    danhHieu,
    status,
    userRole,
    userQuanNhanId,
  }: Record<string, any> = {}) {
    const where: Record<string, any> = {};
    if (year) where.nam = Number(year);
    if (danhHieu) where.danh_hieu = danhHieu;
    where.status = status != null && status !== '' ? status : PROPOSAL_STATUS.APPROVED;

    let allowedUnitIds: string[] | null = null;
    if ((userRole === ROLES.USER || userRole === ROLES.MANAGER) && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (user) {
        if (userRole === ROLES.MANAGER && user.co_quan_don_vi_id) {
          const subUnitIds = await this.getSubUnits(user.co_quan_don_vi_id);
          allowedUnitIds = [user.co_quan_don_vi_id, ...subUnitIds];
          where.OR = [
            { co_quan_don_vi_id: user.co_quan_don_vi_id },
            { don_vi_truc_thuoc_id: { in: subUnitIds } },
          ];
        } else if (userRole === ROLES.MANAGER && user.don_vi_truc_thuoc_id) {
          allowedUnitIds = [user.don_vi_truc_thuoc_id];
          where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
        } else if (userRole === ROLES.USER && user.don_vi_truc_thuoc_id) {
          allowedUnitIds = [user.don_vi_truc_thuoc_id];
          where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
        }
      } else {
        return {
          data: [],
          pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
        };
      }
    }

    if (donViId) {
      // Unit-scoped roles (MANAGER/USER) can only filter within their allowed unit
      if (allowedUnitIds && !allowedUnitIds.includes(donViId)) {
        // donViId outside allowed scope — keep scoping, ignore the filter
      } else {
        where.OR = [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }];
      }
    }

    const [total, awards] = await Promise.all([
      prisma.danhHieuDonViHangNam.count({ where }),
      prisma.danhHieuDonViHangNam.findMany({
        where,
        orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: { CoQuanDonVi: true, DonViTrucThuoc: true },
      }),
    ]);

    return {
      data: awards,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getSubUnits(coQuanDonViId) {
    const subUnits = await prisma.donViTrucThuoc.findMany({
      where: { co_quan_don_vi_id: coQuanDonViId },
      select: { id: true },
    });
    return subUnits.map(u => u.id);
  }

  async getById(id: string, userRole: string, userQuanNhanId: string) {
    const record = await prisma.danhHieuDonViHangNam.findUnique({
      where: { id: String(id) },
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    });

    if (!record) return null;

    if ((userRole === ROLES.USER || userRole === ROLES.MANAGER) && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (!user) return null;

      const recordDonViId = record.co_quan_don_vi_id || record.don_vi_truc_thuoc_id;

      if (userRole === ROLES.MANAGER) {
        // Manager: verify unit belongs to their own co_quan_don_vi
        if (
          user.co_quan_don_vi_id !== record.co_quan_don_vi_id &&
          user.co_quan_don_vi_id !== recordDonViId
        ) {
          return null;
        }
      } else if (userRole === ROLES.USER) {
        // User: can only view their own DVTT
        if (user.don_vi_truc_thuoc_id !== recordDonViId) {
          return null;
        }
      }
    }

    return record;
  }

  /**
   * Upserts DanhHieuDonViHangNam and synchronizes HoSoDonViHangNam.
   * @param {Object} params - Input payload
   * @param {string} params.don_vi_id - Unit ID (CoQuanDonVi or DonViTrucThuoc)
   * @param {number} params.nam - Year
   * @param {string} params.danh_hieu - Award code
   * @param {string} [params.so_quyet_dinh] - Decision number
   * @param {string} [params.ghi_chu] - Note
   * @param {string} params.nguoi_tao_id - Creator ID
   * @returns {Promise<Object>} Upserted record
   */
  async upsert({
    don_vi_id,
    nam,
    danh_hieu,
    so_quyet_dinh,
    ghi_chu,
    nguoi_tao_id,
  }: {
    don_vi_id: string;
    nam: number | string;
    danh_hieu?: string | null;
    so_quyet_dinh?: string | null;
    ghi_chu?: string | null;
    nguoi_tao_id: string;
  }) {
    const year = Number(nam);
    const unitId = don_vi_id;

    const { isCoQuanDonVi } = await resolveUnit(unitId);

    if (danh_hieu) {
      const existing = await prisma.danhHieuDonViHangNam.findFirst({
        where: {
          OR: [
            { co_quan_don_vi_id: unitId, nam: year },
            { don_vi_truc_thuoc_id: unitId, nam: year },
          ],
        },
        select: { danh_hieu: true, nhan_bkbqp: true, nhan_bkttcp: true },
      });

      if (existing) {
        const isDv = DANH_HIEU_DON_VI_CO_BAN.has(danh_hieu);
        const isBkbqp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
        const isBkttcp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;

        if (isDv && existing.danh_hieu) {
          throw new ValidationError(
            `Đơn vị đã có danh hiệu ${getDanhHieuName(existing.danh_hieu)} năm ${year}`
          );
        }
        if (isBkbqp && existing.nhan_bkbqp) {
          throw new ValidationError(`Đơn vị đã có Bằng khen Bộ Quốc phòng năm ${year}`);
        }
        if (isBkttcp && existing.nhan_bkttcp) {
          throw new ValidationError(`Đơn vị đã có Bằng khen Thủ tướng Chính phủ năm ${year}`);
        }
      }
    }

    const whereCondition = isCoQuanDonVi
      ? { unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: unitId, nam: year } }
      : { unique_don_vi_truc_thuoc_nam_dh: { don_vi_truc_thuoc_id: unitId, nam: year } };

    const isBk = DANH_HIEU_DON_VI_BANG_KHEN.has(danh_hieu || '');
    const isBkbqp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
    const isBkttcp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;

    if (danh_hieu) {
      const decisionErrors = validateDecisionNumbers(
        {
          danh_hieu: isBk ? null : danh_hieu,
          so_quyet_dinh: isBk ? null : so_quyet_dinh,
          nhan_bkbqp: isBkbqp,
          so_quyet_dinh_bkbqp: isBkbqp ? so_quyet_dinh : null,
          nhan_bkttcp: isBkttcp,
          so_quyet_dinh_bkttcp: isBkttcp ? so_quyet_dinh : null,
        },
        { entityType: 'unit', entityName: unitId }
      );
      if (decisionErrors.length > 0) {
        throw new ValidationError(decisionErrors.join('\n'));
      }
    }

    const updateData: Record<string, unknown> = {};
    if (isBk) {
      if (isBkbqp) {
        updateData.nhan_bkbqp = true;
        if (so_quyet_dinh) updateData.so_quyet_dinh_bkbqp = so_quyet_dinh;
        if (ghi_chu) updateData.ghi_chu_bkbqp = ghi_chu;
      }
      if (isBkttcp) {
        updateData.nhan_bkttcp = true;
        if (so_quyet_dinh) updateData.so_quyet_dinh_bkttcp = so_quyet_dinh;
        if (ghi_chu) updateData.ghi_chu_bkttcp = ghi_chu;
      }
    } else {
      updateData.danh_hieu = danh_hieu || null;
      if (so_quyet_dinh) updateData.so_quyet_dinh = so_quyet_dinh;
      if (ghi_chu) updateData.ghi_chu = ghi_chu;
    }

    const record = await prisma.danhHieuDonViHangNam.upsert({
      where: whereCondition,
      update: updateData,
      create: {
        ...buildUnitIdFields(unitId, isCoQuanDonVi),
        nam: year,
        danh_hieu: isBk ? null : (danh_hieu || null),
        so_quyet_dinh: isBk ? null : (so_quyet_dinh || null),
        ghi_chu: isBk ? null : (ghi_chu || null),
        nhan_bkbqp: isBkbqp,
        ...(isBkbqp && so_quyet_dinh && { so_quyet_dinh_bkbqp: so_quyet_dinh }),
        ...(isBkbqp && ghi_chu && { ghi_chu_bkbqp: ghi_chu }),
        nhan_bkttcp: isBkttcp,
        ...(isBkttcp && so_quyet_dinh && { so_quyet_dinh_bkttcp: so_quyet_dinh }),
        ...(isBkttcp && ghi_chu && { ghi_chu_bkttcp: ghi_chu }),
        nguoi_tao_id: nguoi_tao_id,
        status: PROPOSAL_STATUS.APPROVED,
      },
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    });

    await this.recalculateAnnualUnit(unitId, year);

    return record;
  }

  /**
   * Recalculates by unit and year, or for all records.
   */
  async recalculate({ don_vi_id, nam }) {
    if (don_vi_id && nam) {
      await this.recalculateAnnualUnit(don_vi_id, Number(nam));
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
        await this.recalculateAnnualUnit(don_vi_id, r.nam);
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
        await this.recalculateAnnualUnit(unitId, year);
        count++;
      }
    }

    return count;
  }

  async remove(id: string, awardType?: string | null) {
    const danhHieu = await prisma.danhHieuDonViHangNam.findUnique({
      where: { id: String(id) },
    });

    if (!danhHieu) {
      throw new NotFoundError('Danh hiệu đơn vị hằng năm');
    }

    const donViId = danhHieu.co_quan_don_vi_id || danhHieu.don_vi_truc_thuoc_id;

    // Awards page renders one row per year with multiple awards. Granular
    // delete clears only the requested award + its decision number + note;
    // the row is removed entirely when no awards remain.
    if (awardType) {
      const validTypes = new Set<string>([
        ...DANH_HIEU_DON_VI_CO_BAN,
        ...DANH_HIEU_DON_VI_BANG_KHEN,
      ]);
      if (!validTypes.has(awardType)) {
        throw new ValidationError(
          `Loại danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList([...validTypes])}.`
        );
      }

      const updateData: Prisma.DanhHieuDonViHangNamUpdateInput = {};
      const isBaseAward = DANH_HIEU_DON_VI_CO_BAN.has(awardType);

      if (isBaseAward) {
        if (danhHieu.danh_hieu !== awardType) {
          throw new ValidationError(`Bản ghi không có ${getDanhHieuName(awardType)}`);
        }
        updateData.danh_hieu = null;
        updateData.so_quyet_dinh = null;
        updateData.ghi_chu = null;
      } else if (awardType === DANH_HIEU_DON_VI_HANG_NAM.BKBQP) {
        if (!danhHieu.nhan_bkbqp) {
          throw new ValidationError(`Bản ghi không có ${getDanhHieuName(awardType)}`);
        }
        updateData.nhan_bkbqp = false;
        updateData.so_quyet_dinh_bkbqp = null;
        updateData.ghi_chu_bkbqp = null;
      } else if (awardType === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP) {
        if (!danhHieu.nhan_bkttcp) {
          throw new ValidationError(`Bản ghi không có ${getDanhHieuName(awardType)}`);
        }
        updateData.nhan_bkttcp = false;
        updateData.so_quyet_dinh_bkttcp = null;
        updateData.ghi_chu_bkttcp = null;
      }

      const remainingDanhHieu = isBaseAward ? null : danhHieu.danh_hieu;
      const remainingBkbqp =
        awardType === DANH_HIEU_DON_VI_HANG_NAM.BKBQP ? false : danhHieu.nhan_bkbqp;
      const remainingBkttcp =
        awardType === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP ? false : danhHieu.nhan_bkttcp;
      const isEmpty = !remainingDanhHieu && !remainingBkbqp && !remainingBkttcp;

      if (isEmpty) {
        await prisma.danhHieuDonViHangNam.delete({ where: { id: String(id) } });
      } else {
        await prisma.danhHieuDonViHangNam.update({
          where: { id: String(id) },
          data: updateData,
        });
      }

      await this.recalculateAnnualUnit(donViId, danhHieu.nam);
      return true;
    }

    await prisma.danhHieuDonViHangNam.delete({ where: { id: String(id) } });

    await this.recalculateAnnualUnit(donViId, danhHieu.nam);

    return true;
  }

  /**
   * Returns annual suggestion profile for a unit (similar to getAnnualProfile).
   */
  async getAnnualUnit(donViId, year) {
    const { isCoQuanDonVi } = await resolveUnit(donViId);

    let profile = await prisma.hoSoDonViHangNam.findFirst({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        nam: year,
      },
      orderBy: { nam: 'desc' },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: true,
      },
    });

    if (!profile) {
      const currentYear = new Date().getFullYear();
      profile = await prisma.hoSoDonViHangNam.create({
        data: {
          ...buildUnitIdFields(donViId, isCoQuanDonVi),
          nam: currentYear,
          tong_dvqt: 0,
          tong_dvqt_json: [],
          dvqt_lien_tuc: 0,
          du_dieu_kien_bk_tong_cuc: false,
          du_dieu_kien_bk_thu_tuong: false,
          goi_y: 'Chưa có dữ liệu để tính toán. Vui lòng nhập danh hiệu đơn vị.',
        },
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: true,
        },
      });
    }

    return profile;
  }

  /**
   * Recalculates annual profile for a unit (similar to recalculateAnnualProfile).
   */
  async recalculateAnnualUnit(donViId, year = null) {
    const { isCoQuanDonVi } = await resolveUnit(donViId);
    const targetYear = year || new Date().getFullYear();

    const [danhHieuList, dvqtResult, dvqtLienTuc] = await Promise.all([
      prisma.danhHieuDonViHangNam.findMany({
        where: {
          OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
          nam: { lte: targetYear },
          status: PROPOSAL_STATUS.APPROVED,
        },
        orderBy: { nam: 'asc' },
      }),
      this.calculateTotalDVQT(donViId, targetYear),
      this.calculateContinuousYears(donViId, targetYear),
    ]);

    // Recalculate BKBQP within ĐVQT streak
    const bkbqpInStreak = await this.countBKBQPInStreak(donViId, targetYear, dvqtLienTuc);

    // BKBQP: cứ 2 năm ĐVQT liên tục
    const du_dieu_kien_bk_tong_cuc = dvqtLienTuc >= 2 && dvqtLienTuc % 2 === 0;
    // BKTTCP: đúng 7 năm ĐVQT + 3 BKBQP (chỉ lần 1)
    const du_dieu_kien_bk_thu_tuong =
      dvqtLienTuc === 7 && bkbqpInStreak === 3;

    const hasReceivedBKTTCP = danhHieuList.some(dh => dh.nhan_bkttcp === true);
    const goi_y = this.buildSuggestion(dvqtLienTuc, du_dieu_kien_bk_tong_cuc, du_dieu_kien_bk_thu_tuong, hasReceivedBKTTCP);

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

  /**
   * Returns annual award history for one unit from DanhHieuDonViHangNam.
   */
  async getUnitAnnualAwards(
    donViId: string,
    userRole: string = ROLES.ADMIN,
    userQuanNhanId: string | null = null
  ) {
    if (!donViId) throw new ValidationError('don_vi_id là bắt buộc');

    const donVi =
      (await prisma.coQuanDonVi.findUnique({ where: { id: donViId } })) ||
      (await prisma.donViTrucThuoc.findUnique({ where: { id: donViId } }));

    if (!donVi) throw new NotFoundError('Đơn vị');

    if (userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN) {
    } else if ((userRole === ROLES.MANAGER || userRole === ROLES.USER) && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (!user) throw new NotFoundError('Thông tin người dùng');

      if (userRole === ROLES.MANAGER) {
        // Manager can view all units under their co_quan_don_vi
        const targetCoQuanId =
          'co_quan_don_vi_id' in donVi && donVi.co_quan_don_vi_id
            ? donVi.co_quan_don_vi_id
            : donVi.id;
        if (!user.co_quan_don_vi_id || user.co_quan_don_vi_id !== targetCoQuanId) {
          throw new ForbiddenError('Không có quyền xem lịch sử khen thưởng của đơn vị này');
        }
      } else if (userRole === ROLES.USER) {
        // User can only view their own DVTT
        if (!user.don_vi_truc_thuoc_id || user.don_vi_truc_thuoc_id !== donViId) {
          throw new ForbiddenError('Không có quyền xem lịch sử khen thưởng của đơn vị này');
        }
      }
    } else {
      throw new ForbiddenError('Không có quyền truy cập');
    }

    const danhHieuRecords = await prisma.danhHieuDonViHangNam.findMany({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        status: PROPOSAL_STATUS.APPROVED,
      },
      orderBy: { nam: 'desc' },
    });

    return danhHieuRecords;
  }

  /**
   * Exports an Excel template for import.
   */
  /**
   * Previews import by parsing and validating Excel rows without DB writes.
   */
  async previewImport(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, {
      excludeSheetNames: ['_CapBac', '_QuyetDinh'],
    });

    // Header map
    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'unit_id']);
    const maDonViCol = getHeaderCol(headerMap, ['ma_don_vi', 'ma_donvi', 'ma', 'madonvi']);
    const tenDonViCol = getHeaderCol(headerMap, ['ten_don_vi', 'ten_donvi', 'ten', 'tendonvi']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu', 'danhieu']);
    const soQuyetDinhCol = getHeaderCol(headerMap, [
      'so_quyet_dinh',
      'soquyetdinh',
      'so_qd',
      'soqd',
    ]);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch', 'ghich']);
    const bkbqpCol = getHeaderCol(headerMap, ['bkbqp', 'nhan_bkbqp', 'bkbqp_khong_dien']);
    const bkttcpCol = getHeaderCol(headerMap, ['bkttcp', 'nhan_bkttcp', 'bkttcp_khong_dien']);

    if (!maDonViCol || !namCol || !danhHieuCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: Mã đơn vị, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
      );
    }

    // Verify file type by sheet name
    if (worksheet.name === AWARD_EXCEL_SHEETS.ANNUAL_PERSONAL) {
      throw new ValidationError(
        'File Excel không đúng loại. Đây là file khen thưởng cá nhân, không phải đơn vị hằng năm.'
      );
    }

    const validDanhHieu = Object.values(DANH_HIEU_DON_VI_HANG_NAM) as string[];
    const errors = [];
    const valid = [];
    let total = 0;
    const seenInFile = new Set();
    const currentYear = new Date().getFullYear();

    const existingDecisions = await prisma.fileQuyetDinh.findMany({
      select: { so_quyet_dinh: true },
    });
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

    const allMaDonVi = new Set<string>();
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const maDonViVal = maDonViCol ? String(row.getCell(maDonViCol).value || '').trim() : '';
      if (maDonViVal) allMaDonVi.add(maDonViVal);
    }

    const [coQuanDonViList, donViTrucThuocList] = await Promise.all([
      prisma.coQuanDonVi.findMany({
        where: { ma_don_vi: { in: [...allMaDonVi] } },
      }),
      prisma.donViTrucThuoc.findMany({
        where: { ma_don_vi: { in: [...allMaDonVi] } },
      }),
    ]);

    // Build lookup Maps by ma_don_vi
    const coQuanDonViMap = new Map(coQuanDonViList.map(u => [u.ma_don_vi, u]));
    const donViTrucThuocMap = new Map(donViTrucThuocList.map(u => [u.ma_don_vi, u]));

    // Collect all unit IDs for batch querying awards
    const allUnitIds = new Set<string>();
    for (const u of coQuanDonViList) allUnitIds.add(u.id);
    for (const u of donViTrucThuocList) allUnitIds.add(u.id);

    // Batch query existing unit awards for duplicate checking and history
    const existingUnitAwards = await prisma.danhHieuDonViHangNam.findMany({
      where: {
        OR: [
          { co_quan_don_vi_id: { in: [...allUnitIds] } },
          { don_vi_truc_thuoc_id: { in: [...allUnitIds] } },
        ],
      },
      select: {
        co_quan_don_vi_id: true,
        don_vi_truc_thuoc_id: true,
        nam: true,
        danh_hieu: true,
        nhan_bkbqp: true,
        nhan_bkttcp: true,
        so_quyet_dinh: true,
      },
    });

    // Map<unitId, records[]> for history and duplicate checking
    const awardsByUnit = new Map<string, typeof existingUnitAwards>();
    for (const r of existingUnitAwards) {
      const unitId = r.co_quan_don_vi_id || r.don_vi_truc_thuoc_id;
      if (!unitId) continue;
      const list = awardsByUnit.get(unitId) || [];
      list.push(r);
      awardsByUnit.set(unitId, list);
    }

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const maDonVi = maDonViCol ? String(row.getCell(maDonViCol).value || '').trim() : '';
      const tenDonVi = tenDonViCol ? String(row.getCell(tenDonViCol).value || '').trim() : '';
      const namVal = namCol ? row.getCell(namCol).value : null;
      const danhHieuRaw = danhHieuCol ? String(row.getCell(danhHieuCol).value || '').trim() : '';
      const soQuyetDinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : '';
      const ghiChu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : '';
      const bkbqpRaw = bkbqpCol ? String(row.getCell(bkbqpCol).value ?? '').trim() : '';
      const bkttcpRaw = bkttcpCol ? String(row.getCell(bkttcpCol).value ?? '').trim() : '';

      if (!maDonVi && !namVal && !danhHieuRaw && !idValue) continue;

      if (idValue && !danhHieuRaw) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam: namVal,
          danh_hieu: '',
          message: 'Bỏ qua — không có danh hiệu nào được điền',
        });
        continue;
      }

      total++;

      // BKBQP/BKTTCP cannot be imported via Excel — use the admin UI
      if (parseBooleanValue(bkbqpRaw)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam: namVal,
          danh_hieu: danhHieuRaw,
          message: 'BKBQP không được nhập qua Excel. Vui lòng chỉ thêm trên giao diện.',
        });
        continue;
      }
      if (parseBooleanValue(bkttcpRaw)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam: namVal,
          danh_hieu: danhHieuRaw,
          message: 'BKTTCP không được nhập qua Excel. Vui lòng chỉ thêm trên giao diện.',
        });
        continue;
      }

      const missingFields = [];
      if (!maDonVi) missingFields.push('Mã đơn vị');
      if (!namVal) missingFields.push('Năm');
      if (!danhHieuRaw) missingFields.push('Danh hiệu');
      if (missingFields.length > 0) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam: namVal,
          danh_hieu: danhHieuRaw,
          message: `Thiếu ${missingFields.join(', ')}`,
        });
        continue;
      }

      const nam = parseInt(String(namVal), 10);
      if (!Number.isInteger(nam)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam: namVal,
          danh_hieu: danhHieuRaw,
          message: `Giá trị năm không hợp lệ: ${namVal}`,
        });
        continue;
      }
      if (nam < 1900 || nam > currentYear) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieuRaw,
          message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
        });
        continue;
      }

      const danhHieu = danhHieuRaw.toUpperCase();
      if (!validDanhHieu.includes(danhHieu)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieuRaw,
          message: `Danh hiệu "${danhHieuRaw}" không hợp lệ. Chỉ chấp nhận: ${formatDanhHieuList(validDanhHieu)}`,
        });
        continue;
      }

      // Decision number must exist in the system (not just non-empty)
      if (!soQuyetDinh) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieu,
          message: 'Thiếu số quyết định',
        });
        continue;
      }
      if (!validDecisionNumbers.has(soQuyetDinh)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieu,
          message: `Số quyết định "${soQuyetDinh}" không tồn tại trên hệ thống`,
        });
        continue;
      }

      const donVi = coQuanDonViMap.get(maDonVi);
      const isCoQuanDonVi = !!donVi;
      const donViTrucThuoc = donVi ? null : donViTrucThuocMap.get(maDonVi);

      if (!donVi && !donViTrucThuoc) {
        errors.push({
          row: rowNumber,
          ten_don_vi: tenDonVi,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieu,
          message: `Không tìm thấy đơn vị với mã ${maDonVi}`,
        });
        continue;
      }

      const unitId = isCoQuanDonVi ? donVi.id : donViTrucThuoc.id;
      const unitName = isCoQuanDonVi ? donVi.ten_don_vi : donViTrucThuoc.ten_don_vi;

      const fileKey = `${unitId}_${nam}`;
      if (seenInFile.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ten_don_vi: unitName,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieu,
          message: `Trùng lặp trong file — cùng đơn vị, năm ${nam}`,
        });
        continue;
      }
      seenInFile.add(fileKey);

      const unitAwards = awardsByUnit.get(unitId) || [];
      const existingAward = unitAwards.find(a => a.nam === nam);
      if (existingAward && existingAward.danh_hieu) {
        errors.push({
          row: rowNumber,
          ten_don_vi: unitName,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieu,
          message: `Đã có danh hiệu ${existingAward.danh_hieu} năm ${nam} trên hệ thống`,
        });
        continue;
      }

      // Check chain eligibility for BKTTCP
      // NOTE: Left as per-row query because checkUnitAwardEligibility depends on
      // per-row computed values (unitId, nam) and has complex internal logic
      if (danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP) {
        const eligibility = await this.checkUnitAwardEligibility(
          unitId,
          nam,
          DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
        );
        if (!eligibility.eligible) {
          errors.push({
            row: rowNumber,
            ten_don_vi: unitName,
            ma_don_vi: maDonVi,
            nam,
            danh_hieu: danhHieu,
            message: eligibility.reason,
          });
          continue;
        }
      }

      const history = [...unitAwards]
        .sort((a, b) => b.nam - a.nam)
        .slice(0, 5)
        .map(r => ({
          nam: r.nam,
          danh_hieu: r.danh_hieu,
          nhan_bkbqp: r.nhan_bkbqp,
          nhan_bkttcp: r.nhan_bkttcp,
          so_quyet_dinh: r.so_quyet_dinh,
        }));

      valid.push({
        row: rowNumber,
        unit_id: unitId,
        is_co_quan_don_vi: isCoQuanDonVi,
        ma_don_vi: maDonVi,
        ten_don_vi: unitName,
        nam,
        danh_hieu: danhHieu,
        so_quyet_dinh: soQuyetDinh,
        ghi_chu: ghiChu || null,
        history,
      });
    }

    return { total, valid, errors };
  }

  /**
   * Persists validated import rows into the database.
   */
  async confirmImport(validItems: UnitAnnualAwardValidItem[], adminId: string) {
    // Batch query to check duplicates — avoids N+1
    const uniqueUnitIds = [...new Set(validItems.map(item => item.unit_id))];
    const uniqueYears = [...new Set(validItems.map(item => item.nam))];

    const [existingAwards, existingProposals] = await Promise.all([
      prisma.danhHieuDonViHangNam.findMany({
        where: {
          OR: [
            { co_quan_don_vi_id: { in: uniqueUnitIds }, nam: { in: uniqueYears } },
            { don_vi_truc_thuoc_id: { in: uniqueUnitIds }, nam: { in: uniqueYears } },
          ],
        },
        select: {
          co_quan_don_vi_id: true,
          don_vi_truc_thuoc_id: true,
          nam: true,
          danh_hieu: true,
          nhan_bkbqp: true,
          nhan_bkttcp: true,
        },
      }),
      prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.DON_VI_HANG_NAM,
          nam: { in: uniqueYears },
          status: PROPOSAL_STATUS.PENDING,
        },
      }),
    ]);

    const awardMap = new Map<string, (typeof existingAwards)[number]>();
    for (const award of existingAwards) {
      const unitId = award.co_quan_don_vi_id || award.don_vi_truc_thuoc_id;
      if (unitId) awardMap.set(`${unitId}|${award.nam}`, award);
    }

    const duplicateErrors: string[] = [];
    for (const item of validItems) {
      const { unit_id: donViId, nam, danh_hieu: danhHieu } = item;

      const existingProposal = existingProposals.find(p => {
        const dataDanhHieu = (p.data_danh_hieu as Prisma.JsonArray) || [];
        return (dataDanhHieu as Array<Record<string, unknown>>).some(
          d => d.don_vi_id === donViId && d.danh_hieu === danhHieu
        );
      });
      if (existingProposal) {
        duplicateErrors.push(
          `Đơn vị đã có đề xuất danh hiệu ${getDanhHieuName(danhHieu)} cho năm ${nam}`
        );
        continue;
      }

      const existingAward = awardMap.get(`${donViId}|${nam}`);
      if (existingAward) {
        const isDv = DANH_HIEU_DON_VI_CO_BAN.has(danhHieu);
        const isBk = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);

        if (isDv && existingAward.danh_hieu) {
          if (existingAward.danh_hieu === danhHieu) {
            duplicateErrors.push(
              `Đơn vị đã có danh hiệu ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
            );
            continue;
          }
          duplicateErrors.push(
            `Đơn vị đã có danh hiệu ${getDanhHieuName(existingAward.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
          );
          continue;
        }

        if (isBk) {
          if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP && existingAward.nhan_bkbqp) {
            duplicateErrors.push(
              `Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
            );
            continue;
          }
          if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP && existingAward.nhan_bkttcp) {
            duplicateErrors.push(
              `Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
            );
            continue;
          }
        }

        if (isDv && (existingAward.nhan_bkbqp || existingAward.nhan_bkttcp)) {
          const existingBk = existingAward.nhan_bkbqp
            ? DANH_HIEU_DON_VI_HANG_NAM.BKBQP
            : DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
          duplicateErrors.push(
            `Đơn vị đã có ${getDanhHieuName(existingBk)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
          );
          continue;
        }
        if (
          isBk &&
          existingAward.danh_hieu &&
          DANH_HIEU_DON_VI_CO_BAN.has(existingAward.danh_hieu)
        ) {
          duplicateErrors.push(
            `Đơn vị đã có danh hiệu ${getDanhHieuName(existingAward.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
          );
          continue;
        }
      }
    }
    if (duplicateErrors.length > 0) {
      throw new ValidationError(duplicateErrors.join('; '));
    }

    const decisionErrors: string[] = [];
    for (const item of validItems) {
      const isBkBqp = item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
      const isBkTtcp = item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
      const errs = validateDecisionNumbers(
        {
          danh_hieu: isBkBqp || isBkTtcp ? null : item.danh_hieu,
          so_quyet_dinh: isBkBqp || isBkTtcp ? null : item.so_quyet_dinh,
          nhan_bkbqp: isBkBqp,
          so_quyet_dinh_bkbqp: isBkBqp ? item.so_quyet_dinh : null,
          nhan_bkttcp: isBkTtcp,
          so_quyet_dinh_bkttcp: isBkTtcp ? item.so_quyet_dinh : null,
        },
        { entityType: 'unit', entityName: item.ten_don_vi || item.unit_id }
      );
      decisionErrors.push(...errs);
    }
    if (decisionErrors.length > 0) {
      throw new ValidationError(decisionErrors.join('\n'));
    }

    return await prisma.$transaction(
      async prismaTx => {
        const results = [];
        for (const item of validItems) {
          const upsertWhere = item.is_co_quan_don_vi
            ? {
                unique_co_quan_don_vi_nam_dh: {
                  co_quan_don_vi_id: item.unit_id,
                  nam: item.nam,
                },
              }
            : {
                unique_don_vi_truc_thuoc_nam_dh: {
                  don_vi_truc_thuoc_id: item.unit_id,
                  nam: item.nam,
                },
              };

          const isBkBqp = item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
          const isBkTtcp = item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
          const isBk = isBkBqp || isBkTtcp;
          const finalDanhHieu = isBk ? null : item.danh_hieu;

          const sharedData: Record<string, any> = {
            ghi_chu: isBk ? undefined : (item.ghi_chu ?? null),
            so_quyet_dinh: isBk ? undefined : (item.so_quyet_dinh ?? null),
            ...(isBkBqp && {
              nhan_bkbqp: true,
              so_quyet_dinh_bkbqp: item.so_quyet_dinh ?? null,
              ...(item.ghi_chu && { ghi_chu_bkbqp: item.ghi_chu }),
            }),
            ...(isBkTtcp && {
              nhan_bkttcp: true,
              so_quyet_dinh_bkttcp: item.so_quyet_dinh ?? null,
              ...(item.ghi_chu && { ghi_chu_bkttcp: item.ghi_chu }),
            }),
          };

          const createData: Record<string, any> = {
            nam: item.nam,
            danh_hieu: finalDanhHieu,
            status: PROPOSAL_STATUS.APPROVED,
            nguoi_tao_id: adminId,
            ...sharedData,
          };

          if (item.is_co_quan_don_vi) {
            createData.co_quan_don_vi_id = item.unit_id;
          } else {
            createData.don_vi_truc_thuoc_id = item.unit_id;
          }

          const result = await prismaTx.danhHieuDonViHangNam.upsert({
            where: upsertWhere,
            update: {
              danh_hieu: finalDanhHieu,
              ...sharedData,
            },
            create: createData as Prisma.DanhHieuDonViHangNamUncheckedCreateInput,
          });
          results.push(result);
        }
        return { imported: results.length, data: results };
      },
      { timeout: IMPORT_TRANSACTION_TIMEOUT }
    );
  }

  async exportTemplate(
    unitIds: string[] = [],
    repeatMap: Record<string, number> = {}
  ) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.ANNUAL_UNIT);

    // Define columns
    const columns = [...UNIT_ANNUAL_TEMPLATE_COLUMNS];

    worksheet.columns = columns;

    const headerRowObj = worksheet.getRow(1);
    headerRowObj.font = { bold: true };
    headerRowObj.fill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFD3D3D3' },
    };

    // Readonly yellow background: STT, ID, unit code, unit name (cols 1-4)
    const readonlyFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFFFFFCC' },
    };
    for (let col = 1; col <= 4; col++) {
      headerRowObj.getCell(col).fill = readonlyFill;
    }

    const danhHieuValidation = {
      type: 'list' as const,
      allowBlank: true,
      formulae: [UNIT_ANNUAL_DANH_HIEU_VALIDATION_FORMULA],
    };

    const existingDecisions = await prisma.fileQuyetDinh.findMany({
      where: { loai_khen_thuong: PROPOSAL_TYPES.DON_VI_HANG_NAM },
      select: { so_quyet_dinh: true },
      orderBy: { nam: 'desc' },
    });
    const decisionList = existingDecisions.map(d => d.so_quyet_dinh).filter(Boolean);
    let soQdValidation = null;
    if (decisionList.length > 0) {
      const formulaStr = decisionList.join(',');
      if (formulaStr.length < EXCEL_INLINE_VALIDATION_MAX_LENGTH) {
        soQdValidation = {
          type: 'list' as const,
          allowBlank: true,
          formulae: [`"${formulaStr}"`],
        };
      } else {
        const refSheet = workbook.addWorksheet('_QuyetDinh', { state: 'veryHidden' });
        decisionList.forEach((sqd, idx) => {
          refSheet.getCell(`A${idx + 1}`).value = sqd;
        });
        soQdValidation = {
          type: 'list' as const,
          allowBlank: true,
          formulae: [`_QuyetDinh!$A$1:$A$${decisionList.length}`],
        };
      }
    }

    // Pre-fill rows if unitIds provided
    if (unitIds && unitIds.length > 0) {
      const coQuanDonVis = await prisma.coQuanDonVi.findMany({
        where: { id: { in: unitIds } },
      });
      const donViTrucThuocs = await prisma.donViTrucThuoc.findMany({
        where: { id: { in: unitIds } },
      });

      const unitMap = new Map();
      coQuanDonVis.forEach(u => unitMap.set(u.id, { ...u, unitType: 'cqDv' }));
      donViTrucThuocs.forEach(u => unitMap.set(u.id, { ...u, unitType: 'dvtt' }));

      let stt = 1;
      for (const uid of unitIds) {
        const unit = unitMap.get(uid);
        if (!unit) continue;

        const rowCount = repeatMap[uid] || 1;
        for (let r = 0; r < rowCount; r++) {
          const dataRow = worksheet.addRow(
            sanitizeRowData({
              stt,
              id: unit.id,
              ma_don_vi: unit.ma_don_vi || '',
              ten_don_vi: unit.ten_don_vi || '',
              nam: '',
              danh_hieu: '',
              so_quyet_dinh: '',
              ghi_chu: '',
            })
          );

          // Readonly yellow background: STT, ID, unit code, unit name
          for (let col = 1; col <= 4; col++) {
            dataRow.getCell(col).fill = readonlyFill;
          }

          stt++;
        }
      }
    } else {
      // Add sample row
      worksheet.addRow(
        sanitizeRowData({
          stt: 1,
          id: '',
          ma_don_vi: 'DV001',
          ten_don_vi: 'Đơn vị mẫu',
          nam: new Date().getFullYear(),
          danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
          so_quyet_dinh: '',
          ghi_chu: '',
        })
      );
    }

    // Apply data validations to data rows
    const totalPrefillRows = unitIds.reduce((sum, uid) => sum + (repeatMap[uid] || 1), 0);
    const maxRows = Math.max(totalPrefillRows + 1, MIN_TEMPLATE_ROWS);
    for (let r = 2; r <= maxRows; r++) {
      worksheet.getCell(`F${r}`).dataValidation = danhHieuValidation;
      if (soQdValidation) {
        worksheet.getCell(`G${r}`).dataValidation = soQdValidation;
      }
    }

    // Conditional formatting: yellow when cell has value
    const editableColumns = ['F', 'G'];
    editableColumns.forEach(col => {
      worksheet.addConditionalFormatting({
        ref: `${col}2:${col}${maxRows}`,
        rules: [
          {
            type: 'expression',
            formulae: [`LEN(TRIM(${col}2))>0`],
            style: {
              fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } },
            },
            priority: 1,
          },
        ],
      });
    });

    applyThinBordersToGrid(worksheet, maxRows, columns.length);

    return workbook;
  }

  /**
   * Imports unit awards from Excel.
   */
  async importFromExcel(buffer: Buffer, adminId: string) {
    const workbook = await loadWorkbook(buffer);

    // Try to find worksheet by name first, fallback to first worksheet
    let worksheet = workbook.getWorksheet(AWARD_EXCEL_SHEETS.ANNUAL_UNIT);
    if (!worksheet) {
      worksheet = workbook.worksheets[0];
    }

    if (!worksheet) {
      throw new ValidationError('File Excel không hợp lệ hoặc không tìm thấy sheet dữ liệu');
    }

    // Header map
    const headerMap = parseHeaderMap(worksheet);

    const maDonViCol = getHeaderCol(headerMap, ['ma_don_vi', 'ma_donvi', 'ma', 'madonvi']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year', 'năm']);
    const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu', 'danhieu']);
    const soQuyetDinhCol = getHeaderCol(headerMap, [
      'so_quyet_dinh',
      'soquyetdinh',
      'so_qd',
      'soqd',
    ]);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch', 'ghich']);
    const bkbqpCol = getHeaderCol(headerMap, ['nhan_bkbqp', 'bkbqp']);
    const soQdBkbqpCol = getHeaderCol(headerMap, [
      'so_quyet_dinh_bkbqp',
      'so_qd_bkbqp',
      'soqdbkbqp',
    ]);

    if (!maDonViCol || !namCol || !danhHieuCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: Mã đơn vị, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(
          headerMap
        ).join(', ')}`
      );
    }

    // Verify file type by sheet name
    const hoTenCheck = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten']);
    const capBacCheck = getHeaderCol(headerMap, ['cap_bac', 'capbac']);
    if (hoTenCheck || capBacCheck) {
      throw new ValidationError(
        'File Excel không đúng loại. Đây là file khen thưởng cá nhân, không phải đơn vị hằng năm.'
      );
    }

    const errors = [];
    const imported = [];
    let total = 0;
    const selectedUnitIds = [];

    // Pre-pass: collect all unit codes and years for batch queries
    const allMaDonVi = new Set<string>();
    const allYears = new Set<number>();
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const maDonVi = maDonViCol ? String(row.getCell(maDonViCol).value || '').trim() : '';
      const namVal = namCol ? row.getCell(namCol).value : null;
      if (maDonVi) allMaDonVi.add(maDonVi);
      const parsedNam = parseInt(String(namVal), 10);
      if (!isNaN(parsedNam)) allYears.add(parsedNam);
    }

    const [coQuanDonViList, donViTrucThuocList] = await Promise.all([
      prisma.coQuanDonVi.findMany({ where: { ma_don_vi: { in: [...allMaDonVi] } } }),
      prisma.donViTrucThuoc.findMany({ where: { ma_don_vi: { in: [...allMaDonVi] } } }),
    ]);
    const coQuanDonViByMa = new Map(coQuanDonViList.map(u => [u.ma_don_vi, u] as const));
    const donViTrucThuocByMa = new Map(donViTrucThuocList.map(u => [u.ma_don_vi, u] as const));

    const allCQDVIds = coQuanDonViList.map(u => u.id);
    const allDVTTIds = donViTrucThuocList.map(u => u.id);
    const [existingAwardList, pendingProposalList] = await Promise.all([
      prisma.danhHieuDonViHangNam.findMany({
        where: {
          AND: [
            {
              OR: [
                { co_quan_don_vi_id: { in: allCQDVIds } },
                { don_vi_truc_thuoc_id: { in: allDVTTIds } },
              ],
            },
            { nam: { in: [...allYears] } },
          ],
        },
        select: {
          co_quan_don_vi_id: true,
          don_vi_truc_thuoc_id: true,
          nam: true,
          danh_hieu: true,
          nhan_bkbqp: true,
          nhan_bkttcp: true,
        },
      }),
      prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.DON_VI_HANG_NAM,
          nam: { in: [...allYears] },
          status: PROPOSAL_STATUS.PENDING,
        },
      }),
    ]);

    const existingAwardByUnitYear = new Map<string, (typeof existingAwardList)[number]>();
    for (const award of existingAwardList) {
      if (award.co_quan_don_vi_id)
        existingAwardByUnitYear.set(`${award.co_quan_don_vi_id}_${award.nam}`, award);
      if (award.don_vi_truc_thuoc_id)
        existingAwardByUnitYear.set(`${award.don_vi_truc_thuoc_id}_${award.nam}`, award);
    }
    const proposalsByYear = new Map<number, typeof pendingProposalList>();
    for (const proposal of pendingProposalList) {
      if (proposal.nam == null) continue;
      const list = proposalsByYear.get(proposal.nam) ?? [];
      list.push(proposal);
      proposalsByYear.set(proposal.nam, list);
    }

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const maDonVi = maDonViCol ? String(row.getCell(maDonViCol).value || '').trim() : '';
      const namVal = namCol ? row.getCell(namCol).value : null;
      const danhHieu = danhHieuCol ? String(row.getCell(danhHieuCol).value || '').trim() : '';
      const soQuyetDinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value || '').trim()
        : '';
      const ghiChu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : '';
      const bkbqpRaw = bkbqpCol ? String(row.getCell(bkbqpCol).value || '').trim() : '';
      const nhanBkbqp = ['có', 'co', 'true', '1', 'x'].includes(bkbqpRaw.toLowerCase());
      const soQdBkbqp = soQdBkbqpCol ? String(row.getCell(soQdBkbqpCol).value || '').trim() : '';

      if (!maDonVi && !namVal && !danhHieu) continue;

      total++;

      try {
        if (!maDonVi || !namVal || !danhHieu) {
          throw new ValidationError(
            `Thiếu thông tin bắt buộc: Mã đơn vị=${maDonVi}, Năm=${namVal}, Danh hiệu=${danhHieu}`
          );
        }

        const nam = parseInt(String(namVal), 10);
        if (!Number.isInteger(nam)) {
          throw new ValidationError(`Giá trị năm không hợp lệ: ${namVal}`);
        }

        if (!(Object.values(DANH_HIEU_DON_VI_HANG_NAM) as string[]).includes(danhHieu)) {
          throw new ValidationError(
            `Danh hiệu không hợp lệ: ${danhHieu}. Danh hiệu hợp lệ: ${Object.values(DANH_HIEU_DON_VI_HANG_NAM).join(', ')}`
          );
        }

        // Verify award chain requirement
        const checkDanhHieu =
          danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP ? DANH_HIEU_DON_VI_HANG_NAM.BKTTCP : null;
        const checkBkbqp = bkbqpRaw ? 'BKBQP' : null;

        const donVi = coQuanDonViByMa.get(maDonVi) ?? null;

        if (!donVi) {
          const donViTrucThuoc = donViTrucThuocByMa.get(maDonVi) ?? null;

          if (!donViTrucThuoc) {
            throw new NotFoundError(`đơn vị với mã ${maDonVi}`);
          }

          if (checkDanhHieu) {
            const eligibility = await this.checkUnitAwardEligibility(
              donViTrucThuoc.id,
              nam,
              checkDanhHieu
            );
            if (!eligibility.eligible) throw new ValidationError(eligibility.reason);
          }
          if (checkBkbqp) {
            const eligibility = await this.checkUnitAwardEligibility(
              donViTrucThuoc.id,
              nam,
              DANH_HIEU_DON_VI_HANG_NAM.BKBQP
            );
            if (!eligibility.eligible) throw new ValidationError(eligibility.reason);
          }

          checkUnitDuplicate(
            donViTrucThuoc.id,
            nam,
            danhHieu,
            existingAwardByUnitYear,
            proposalsByYear
          );

          const isBkDvtt = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);
          const finalDhDvtt = isBkDvtt ? null : danhHieu;
          const dvttIsBkbqp = danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP || nhanBkbqp;
          const dvttIsBkttcp = danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
          const dvttSoQdBkbqp = dvttIsBkbqp ? (soQdBkbqp || soQuyetDinh || null) : null;
          const dvttSoQdBkttcp = dvttIsBkttcp ? (soQuyetDinh || null) : null;

          const award = await prisma.danhHieuDonViHangNam.upsert({
            where: {
              unique_don_vi_truc_thuoc_nam_dh: {
                don_vi_truc_thuoc_id: donViTrucThuoc.id,
                nam,
              },
            },
            create: {
              don_vi_truc_thuoc_id: donViTrucThuoc.id,
              nam,
              danh_hieu: finalDhDvtt,
              so_quyet_dinh: isBkDvtt ? null : (soQuyetDinh || null),
              ghi_chu: isBkDvtt ? null : (ghiChu || null),
              nhan_bkbqp: dvttIsBkbqp,
              so_quyet_dinh_bkbqp: dvttSoQdBkbqp,
              ...(dvttIsBkbqp && ghiChu && { ghi_chu_bkbqp: ghiChu }),
              nhan_bkttcp: dvttIsBkttcp,
              so_quyet_dinh_bkttcp: dvttSoQdBkttcp,
              ...(dvttIsBkttcp && ghiChu && { ghi_chu_bkttcp: ghiChu }),
              status: PROPOSAL_STATUS.APPROVED,
              nguoi_tao_id: adminId,
            },
            update: {
              ...(isBkDvtt ? {} : { danh_hieu: finalDhDvtt, so_quyet_dinh: soQuyetDinh || null }),
              ...(isBkDvtt ? {} : (ghiChu ? { ghi_chu: ghiChu } : {})),
              ...(dvttIsBkbqp && { nhan_bkbqp: true, so_quyet_dinh_bkbqp: dvttSoQdBkbqp, ...(ghiChu && { ghi_chu_bkbqp: ghiChu }) }),
              ...(dvttIsBkttcp && { nhan_bkttcp: true, so_quyet_dinh_bkttcp: dvttSoQdBkttcp, ...(ghiChu && { ghi_chu_bkttcp: ghiChu }) }),
            },
          });
          imported.push(award);
          if (!selectedUnitIds.includes(donViTrucThuoc.id)) {
            selectedUnitIds.push(donViTrucThuoc.id);
          }
        } else {
          if (checkDanhHieu) {
            const eligibility = await this.checkUnitAwardEligibility(donVi.id, nam, checkDanhHieu);
            if (!eligibility.eligible) throw new ValidationError(eligibility.reason);
          }
          if (checkBkbqp) {
            const eligibility = await this.checkUnitAwardEligibility(
              donVi.id,
              nam,
              DANH_HIEU_DON_VI_HANG_NAM.BKBQP
            );
            if (!eligibility.eligible) throw new ValidationError(eligibility.reason);
          }

          checkUnitDuplicate(donVi.id, nam, danhHieu, existingAwardByUnitYear, proposalsByYear);

          const isBkCqdv = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);
          const finalDhCqdv = isBkCqdv ? null : danhHieu;
          const cqdvIsBkbqp = danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP || nhanBkbqp;
          const cqdvIsBkttcp = danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
          const cqdvSoQdBkbqp = cqdvIsBkbqp ? (soQdBkbqp || soQuyetDinh || null) : null;
          const cqdvSoQdBkttcp = cqdvIsBkttcp ? (soQuyetDinh || null) : null;

          const award = await prisma.danhHieuDonViHangNam.upsert({
            where: {
              unique_co_quan_don_vi_nam_dh: {
                co_quan_don_vi_id: donVi.id,
                nam,
              },
            },
            create: {
              co_quan_don_vi_id: donVi.id,
              nam,
              danh_hieu: finalDhCqdv,
              so_quyet_dinh: isBkCqdv ? null : (soQuyetDinh || null),
              ghi_chu: isBkCqdv ? null : (ghiChu || null),
              nhan_bkbqp: cqdvIsBkbqp,
              so_quyet_dinh_bkbqp: cqdvSoQdBkbqp,
              ...(cqdvIsBkbqp && ghiChu && { ghi_chu_bkbqp: ghiChu }),
              nhan_bkttcp: cqdvIsBkttcp,
              so_quyet_dinh_bkttcp: cqdvSoQdBkttcp,
              ...(cqdvIsBkttcp && ghiChu && { ghi_chu_bkttcp: ghiChu }),
              status: PROPOSAL_STATUS.APPROVED,
              nguoi_tao_id: adminId,
            },
            update: {
              ...(isBkCqdv ? {} : { danh_hieu: finalDhCqdv, so_quyet_dinh: soQuyetDinh || null }),
              ...(isBkCqdv ? {} : (ghiChu ? { ghi_chu: ghiChu } : {})),
              ...(cqdvIsBkbqp && { nhan_bkbqp: true, so_quyet_dinh_bkbqp: cqdvSoQdBkbqp, ...(ghiChu && { ghi_chu_bkbqp: ghiChu }) }),
              ...(cqdvIsBkttcp && { nhan_bkttcp: true, so_quyet_dinh_bkttcp: cqdvSoQdBkttcp, ...(ghiChu && { ghi_chu_bkttcp: ghiChu }) }),
            },
          });
          imported.push(award);
          if (!selectedUnitIds.includes(donVi.id)) {
            selectedUnitIds.push(donVi.id);
          }
        }
      } catch (error) {
        errors.push(`Dòng ${i}: ${error.message}`);
      }
    }

    return {
      total,
      imported: imported.length,
      errors,
      selectedUnitIds,
    };
  }

  /**
   * Exports unit award list to Excel.
   */
  async exportToExcel(filters: Record<string, any> = {}, userRole: string, userQuanNhanId: string) {
    const { nam, danh_hieu } = filters;

    const where: Record<string, any> = { status: PROPOSAL_STATUS.APPROVED };
    if (nam) where.nam = nam;
    if (danh_hieu) where.danh_hieu = danh_hieu;

    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (user?.co_quan_don_vi_id) {
        where.co_quan_don_vi_id = user.co_quan_don_vi_id;
      } else if (user?.don_vi_truc_thuoc_id) {
        where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
      }
    }

    const awards = await prisma.danhHieuDonViHangNam.findMany({
      where,
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: true,
      },
      orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
      take: EXPORT_FETCH_LIMIT,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.ANNUAL_UNIT);

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Mã đơn vị', key: 'ma_don_vi', width: 15 },
      { header: 'Tên đơn vị', key: 'ten_don_vi', width: 30 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Danh hiệu', key: 'danh_hieu', width: 20 },
      { header: 'Số QĐ danh hiệu', key: 'so_quyet_dinh', width: 20 },
      { header: 'BKBQP', key: 'nhan_bkbqp', width: 10 },
      { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
      { header: 'BKTTCP', key: 'nhan_bkttcp', width: 10 },
      { header: 'Số QĐ BKTTCP', key: 'so_quyet_dinh_bkttcp', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
    ];

    styleHeaderRow(worksheet);

    awards.forEach((award, index) => {
      const donVi = award.CoQuanDonVi || award.DonViTrucThuoc;
      worksheet.addRow(
        sanitizeRowData({
          stt: index + 1,
          ma_don_vi: donVi?.ma_don_vi || '',
          ten_don_vi: donVi?.ten_don_vi || '',
          nam: award.nam,
          danh_hieu: getDanhHieuName(award.danh_hieu),
          so_quyet_dinh: award.so_quyet_dinh || '',
          nhan_bkbqp: award.nhan_bkbqp ? 'Có' : '',
          so_quyet_dinh_bkbqp: award.so_quyet_dinh_bkbqp || '',
          nhan_bkttcp: award.nhan_bkttcp ? 'Có' : '',
          so_quyet_dinh_bkttcp: award.so_quyet_dinh_bkttcp || '',
          ghi_chu: award.ghi_chu || '',
        })
      );
    });

    return workbook;
  }

  /**
   * Returns unit award statistics.
   */
  async getStatistics(filters: Record<string, any> = {}, userRole: string, userQuanNhanId: string) {
    const { nam } = filters;

    const where: Record<string, any> = { status: PROPOSAL_STATUS.APPROVED };
    if (nam) where.nam = nam;

    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const user = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (user?.co_quan_don_vi_id) {
        where.co_quan_don_vi_id = user.co_quan_don_vi_id;
      } else if (user?.don_vi_truc_thuoc_id) {
        where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
      }
    }

    const awards = await prisma.danhHieuDonViHangNam.findMany({
      where,
    });

    const byDanhHieu = awards.reduce((acc, award) => {
      const key = award.danh_hieu;
      if (!acc[key]) {
        acc[key] = { danh_hieu: key, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});

    const byNam = awards.reduce((acc, award) => {
      const key = award.nam;
      if (!acc[key]) {
        acc[key] = { nam: key, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});

    return {
      total: awards.length,
      byDanhHieu: Object.values(byDanhHieu),
      byNam: Object.values(byNam).sort(
        (a, b) => (b as { nam: number }).nam - (a as { nam: number }).nam
      ),
    };
  }
}

export default new UnitAnnualAwardService();
