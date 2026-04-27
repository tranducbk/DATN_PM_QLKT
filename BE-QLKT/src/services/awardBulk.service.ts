import { prisma } from '../models';
import { calculateServiceMonths, formatServiceDuration, buildCutoffDate } from '../helpers/serviceYearsHelper';
import annualRewardService from './annualReward.service';
import unitAnnualAwardService from './unitAnnualAward.service';
import scientificAchievementService from './scientificAchievement.service';
import * as notificationHelper from '../helpers/notification';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { buildBulkAwardSummaryMessage } from '../helpers/awardSummaryMessage';
import {
  getDanhHieuName,
  formatDanhHieuList,
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_CO_BAN,
  DANH_HIEU_DON_VI_BANG_KHEN,
  DANH_HIEU_HCCSVV,
  DANH_HIEU_HCBVTQ,
  DANH_HIEU_NCKH,
  LOAI_DE_XUAT_MAP,
} from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES, type ProposalType } from '../constants/proposalTypes.constants';
import {
  getProposalDataField,
  isOneTimeProposalType,
} from './proposal/proposalTypeConfig';
import {
  AWARD_TABLE_QUERIES,
  DUPLICATE_STRATEGY,
  SERVICE_YEAR_CHECKS,
  TYPES_WITH_PERSONNEL_DUP,
} from './awardBulk/dispatchTables';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { AppError, NotFoundError, ValidationError } from '../middlewares/errorHandler';
import { validateHCCSVVRankOrder } from '../helpers/awardValidation/tenureMedalRankOrder';
import { validateHCBVTQRankUpgrade } from '../helpers/awardValidation/contributionMedalRankUpgrade';
import { validateHCBVTQHighestRank, type PositionMonthsByGroup } from '../helpers/awardValidation/contributionMedalHighestRank';
import { CONG_HIEN_HE_SO_GROUPS } from '../constants/danhHieu.constants';
import {
  evaluateHCBVTQRank,
  requiredCongHienMonths,
} from './eligibility/hcbvtqEligibility';
import { aggregatePositionMonthsByGroup } from './eligibility/congHienMonthsAggregator';
import type { QuanNhan, Prisma } from '../generated/prisma';
import { GENDER } from '../constants/gender.constants';
import type { ContributionTimeAggregate, ServiceTimeJson } from '../types/proposal';

export interface TitleDataItem {
  personnel_id: string;
  danh_hieu: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  loai?: string;
  mo_ta?: string;
  don_vi_id?: string;
  thoi_gian_nhom_0_7?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_8?: ContributionTimeAggregate | null;
  thoi_gian_nhom_0_9_1_0?: ContributionTimeAggregate | null;
}

interface BulkCreateContext {
  type: string;
  nam: number;
  thang?: number | null;
  selectedPersonnel: string[];
  titleData: TitleDataItem[];
  ghiChu?: string | null;
  adminId: string;
  personnelMap: Map<string, QuanNhan>;
  errors: string[];
  createdRecords: unknown[];
  errorDetails: { personnelId: string; error: string }[];
  affectedPersonnelIds: Set<string>;
  affectedUnitIds: Set<string>;
  importedCount: { value: number };
}

type CreateHandler = (ctx: BulkCreateContext) => Promise<void>;

interface BulkCreateAwardsParams {
  type: string;
  nam: number;
  /** Decision month (1-12). Required for HCCSVV/HCQKQT/KNC/CONG_HIEN — DB schemas mark `thang` NOT NULL. */
  thang?: number | null;
  selectedPersonnel: string[];
  selectedUnits?: string[];
  titleData: TitleDataItem[];
  ghiChu?: string | null;
  attachedFiles?: unknown[];
  adminId: string;
}

class AwardBulkService {
  private getAwardTableQuery(type: string, personnelIds: string[], nam: number) {
    const queryFn = AWARD_TABLE_QUERIES[type as ProposalType];
    return queryFn ? queryFn(personnelIds, nam) : Promise.resolve([]);
  }

  private getProposalDataField(type: string): string {
    return getProposalDataField(type);
  }

  async checkDuplicateAwards(type: string, nam: number, titleData: TitleDataItem[]) {
    const duplicateErrors: string[] = [];
    if (!titleData || titleData.length === 0) return duplicateErrors;

    const items = titleData.filter(item => item.personnel_id && item.danh_hieu);
    const personnelIds = [...new Set(items.map(item => item.personnel_id))];
    if (personnelIds.length === 0) return duplicateErrors;

    // Batch query: personnel names + award table + pending proposals
    // Just query PENDING proposals — APPROVED awards are already in the award table
    const [personnelList, pendingProposals, existingAwardsRaw] = await Promise.all([
      prisma.quanNhan.findMany({
        where: { id: { in: personnelIds } },
        select: { id: true, ho_ten: true },
      }),
      prisma.bangDeXuat.findMany({
        where: { loai_de_xuat: type, nam, status: PROPOSAL_STATUS.PENDING },
      }),
      this.getAwardTableQuery(type, personnelIds, nam),
    ]);

    const personnelMap = new Map(personnelList.map(p => [p.id, p.ho_ten]));
    const existingAwards = existingAwardsRaw as Array<Record<string, unknown>>;
    const existingSet = new Set(existingAwards.map(a => `${a.quan_nhan_id}_${a.danh_hieu || ''}`));
    const existingByPersonnel = new Set(existingAwards.map(a => a.quan_nhan_id as string));

    const dataField = this.getProposalDataField(type);
    const pendingKeys = new Set<string>();
    const pendingByPersonnel = new Set<string>();
    for (const p of pendingProposals) {
      const data = ((p as Record<string, unknown>)[dataField] as Array<Record<string, unknown>>) || [];
      for (const d of data) {
        if (d.personnel_id) {
          pendingKeys.add(`${d.personnel_id}_${d.danh_hieu || ''}`);
          pendingByPersonnel.add(String(d.personnel_id));
        }
      }
    }

    const isOneTime = isOneTimeProposalType(type);
    const strategy = DUPLICATE_STRATEGY[type as ProposalType];

    for (const item of items) {
      const hoTen = personnelMap.get(item.personnel_id) || item.personnel_id;
      const key = `${item.personnel_id}_${item.danh_hieu}`;

      if (strategy) {
        const isDup =
          strategy.mode === 'pair'
            ? existingSet.has(key)
            : existingByPersonnel.has(item.personnel_id);
        if (isDup) {
          duplicateErrors.push(`${hoTen}: ${strategy.buildLabel(item.danh_hieu, nam)}`);
          continue;
        }
      }

      if (isOneTime ? pendingByPersonnel.has(item.personnel_id) : pendingKeys.has(key)) {
        duplicateErrors.push(`${hoTen}: đang có đề xuất chờ duyệt`);
      }
    }

    return duplicateErrors;
  }

  async checkDuplicateUnitAwards(nam: number, titleData: TitleDataItem[]) {
    const duplicateErrors: string[] = [];
    if (!titleData || titleData.length === 0) return duplicateErrors;

    const items = titleData.filter(item => item.don_vi_id && item.danh_hieu);
    const unitIds = [...new Set(items.map(item => item.don_vi_id!))];
    if (unitIds.length === 0) return duplicateErrors;

    // Batch query: existing awards + pending proposals
    const [existingAwards, pendingProposals] = await Promise.all([
      prisma.danhHieuDonViHangNam.findMany({
        where: {
          OR: [
            { co_quan_don_vi_id: { in: unitIds }, nam },
            { don_vi_truc_thuoc_id: { in: unitIds }, nam },
          ],
        },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true, danh_hieu: true, nhan_bkbqp: true, nhan_bkttcp: true },
      }),
      prisma.bangDeXuat.findMany({
        where: { loai_de_xuat: PROPOSAL_TYPES.DON_VI_HANG_NAM, nam, status: PROPOSAL_STATUS.PENDING },
      }),
    ]);

    const awardMap = new Map<string, typeof existingAwards[number]>();
    for (const a of existingAwards) {
      if (a.co_quan_don_vi_id) awardMap.set(a.co_quan_don_vi_id, a);
      if (a.don_vi_truc_thuoc_id) awardMap.set(a.don_vi_truc_thuoc_id, a);
    }

    const pendingKeys = new Set<string>();
    for (const p of pendingProposals) {
      const data = ((p as Record<string, unknown>).data_danh_hieu as Array<Record<string, unknown>>) || [];
      for (const d of data) {
        if (d.don_vi_id && d.danh_hieu) pendingKeys.add(`${d.don_vi_id}_${d.danh_hieu}`);
      }
    }

    for (const item of items) {
      const donViId = item.don_vi_id!;
      const danhHieu = item.danh_hieu;

      if (pendingKeys.has(`${donViId}_${danhHieu}`)) {
        duplicateErrors.push(`Đơn vị đã có đề xuất ${getDanhHieuName(danhHieu)} cho năm ${nam}`);
        continue;
      }

      const existing = awardMap.get(donViId);
      if (existing) {
        const isDv = DANH_HIEU_DON_VI_CO_BAN.has(danhHieu);
        const isBk = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);

        if (isDv && existing.danh_hieu) {
          duplicateErrors.push(
            existing.danh_hieu === danhHieu
              ? `Đơn vị đã có danh hiệu ${getDanhHieuName(danhHieu)} năm ${nam}`
              : `Đơn vị đã có ${getDanhHieuName(existing.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
          );
          continue;
        }
        if (isBk) {
          if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP && existing.nhan_bkbqp) {
            duplicateErrors.push(`Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam}`);
            continue;
          }
          if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP && existing.nhan_bkttcp) {
            duplicateErrors.push(`Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam}`);
            continue;
          }
        }
        if (isDv && (existing.nhan_bkbqp || existing.nhan_bkttcp)) {
          duplicateErrors.push(`Đơn vị đã có BK năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`);
          continue;
        }
        if (isBk && existing.danh_hieu && DANH_HIEU_DON_VI_CO_BAN.has(existing.danh_hieu)) {
          duplicateErrors.push(`Đơn vị đã có ${getDanhHieuName(existing.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`);
          continue;
        }
      }
    }

    return duplicateErrors;
  }

  async validatePersonnelConditions(type: string, selectedPersonnel: string[]) {
    if (!selectedPersonnel || selectedPersonnel.length === 0) return [];
    const checkFn = SERVICE_YEAR_CHECKS[type as ProposalType];
    return checkFn ? checkFn(selectedPersonnel) : [];
  }

  private throwValidationErrors(errors: string[], type: string, nam: number, adminId?: string): never {
    void writeSystemLog({
      userId: adminId,
      action: 'ERROR',
      resource: 'awards',
      description: `[Thêm khen thưởng đồng loạt] ${LOAI_DE_XUAT_MAP[type as keyof typeof LOAI_DE_XUAT_MAP] || type} năm ${nam} — Validation thất bại: ${errors.join('; ')}`,
    });
    throw new ValidationError(`Phát hiện lỗi validation:\n${errors.join('\n')}`);
  }

  async bulkCreateAwards({
    type,
    nam,
    thang,
    selectedPersonnel,
    selectedUnits,
    titleData,
    ghiChu,
    adminId,
  }: BulkCreateAwardsParams) {
    const errors: string[] = [];
      const createdRecords: unknown[] = [];
      const errorDetails: { personnelId: string; error: string }[] = [];
      const affectedPersonnelIds = new Set<string>();
      const affectedUnitIds = new Set<string>();
      let importedCount = 0;

      const duplicateErrors: string[] = [];

      if (TYPES_WITH_PERSONNEL_DUP.includes(type as ProposalType)) {
        const personnelDuplicates = await this.checkDuplicateAwards(type, nam, titleData);
        duplicateErrors.push(...personnelDuplicates);
      }

      if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        const unitDuplicates = await this.checkDuplicateUnitAwards(nam, titleData);
        duplicateErrors.push(...unitDuplicates);
      }

      if (duplicateErrors.length > 0) {
        throw new AppError(
          `Phát hiện khen thưởng trùng (cùng năm và cùng danh hiệu):\n${duplicateErrors.join('\n')}`,
          409
        );
      }

      const typesNeedingPersonnelValidation: ProposalType[] = [
        PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        PROPOSAL_TYPES.NIEN_HAN,
        PROPOSAL_TYPES.HC_QKQT,
      ];
      if (typesNeedingPersonnelValidation.includes(type as ProposalType)) {
        const validationErrors = await this.validatePersonnelConditions(type, selectedPersonnel);
        errors.push(...validationErrors);
      }

      if (type === PROPOSAL_TYPES.NCKH) {
        const validNCKHCodes = Object.keys(DANH_HIEU_NCKH);
        for (const item of titleData) {
          if (!item.loai || !validNCKHCodes.includes(item.loai)) {
            errors.push(
              `Thành tích khoa học phải có loại hợp lệ: ${validNCKHCodes.join(', ')} (quân nhân: ${item.personnel_id})`
            );
          }
          if (!item.mo_ta || item.mo_ta.trim() === '') {
            errors.push(`Thành tích khoa học phải có mô tả (quân nhân: ${item.personnel_id})`);
          }
        }
      }

      if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        const allowedDanhHieu = [...DANH_HIEU_DON_VI_CO_BAN, ...DANH_HIEU_DON_VI_BANG_KHEN];
        for (const item of titleData) {
          if (!item.danh_hieu || !allowedDanhHieu.includes(item.danh_hieu)) {
            errors.push(
              `Danh hiệu đơn vị không hợp lệ: ${item.danh_hieu}. Chỉ chấp nhận: ${formatDanhHieuList(allowedDanhHieu)}`
            );
          }
        }
      }

      if (type === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
        const allowedDanhHieu = Object.values(DANH_HIEU_CA_NHAN_HANG_NAM) as string[];
        for (const item of titleData) {
          if (!item.danh_hieu || !allowedDanhHieu.includes(item.danh_hieu)) {
            errors.push(
              `Danh hiệu không hợp lệ: ${item.danh_hieu}. Chỉ chấp nhận: ${formatDanhHieuList(allowedDanhHieu)}`
            );
          }
        }
      }

      if (errors.length > 0) {
        this.throwValidationErrors(errors, type, nam, adminId);
      }

      // Single batch for branches that only need basic personnel fields
      const personnelMap = new Map<string, QuanNhan>();
      if (
        type === PROPOSAL_TYPES.HC_QKQT ||
        type === PROPOSAL_TYPES.NIEN_HAN ||
        type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
      ) {
        const personnelIds = titleData.map(item => item.personnel_id as string).filter(Boolean);
        const personnel = await prisma.quanNhan.findMany({ where: { id: { in: personnelIds } } });
        for (const p of personnel) personnelMap.set(p.id, p);
      }

      const importedCountRef = { value: importedCount };
      const ctx: BulkCreateContext = {
        type,
        nam,
        thang,
        selectedPersonnel,
        titleData,
        ghiChu,
        adminId,
        personnelMap,
        errors,
        createdRecords,
        errorDetails,
        affectedPersonnelIds,
        affectedUnitIds,
        importedCount: importedCountRef,
      };

      const handler = this.createHandlers[type as ProposalType];
      if (!handler) {
        throw new ValidationError(
          `Loại khen thưởng "${type}" chưa được hỗ trợ trong chức năng thêm đồng loạt.`
        );
      }
      await handler(ctx);
      importedCount = importedCountRef.value;



      try {
        const admin = await prisma.taiKhoan.findUnique({
          where: { id: adminId },
          select: { username: true },
        });

        if (admin) {
          await notificationHelper.notifyOnBulkAwardAdded(
            Array.from(affectedPersonnelIds),
            selectedUnits || [],
            type,
            nam,
            titleData,
            admin.username
          );
        }
      } catch (e) {
        void writeSystemLog({
          action: 'ERROR',
          resource: 'award-bulk',
          description: `Lỗi gửi thông báo thêm khen thưởng đồng loạt: ${e}`,
        });
      }

    const affectedCount = affectedPersonnelIds.size;
    const affectedUnitCount =
      type === PROPOSAL_TYPES.DON_VI_HANG_NAM
        ? affectedUnitIds.size
        : 0;
    const message = buildBulkAwardSummaryMessage({
      type,
      importedCount,
      errorCount: errors.length,
      affectedPersonnelCount: affectedCount,
      affectedUnitCount,
    });

    if (errors.length > 0) {
      void writeSystemLog({
        userId: adminId,
        userRole: 'ADMIN',
        action: 'ERROR',
        resource: 'awards',
        description: `[Thêm khen thưởng đồng loạt] ${LOAI_DE_XUAT_MAP[type as keyof typeof LOAI_DE_XUAT_MAP] || type} năm ${nam}: ${importedCount} thành công, ${errors.length} lỗi. Chi tiết: ${errors.join('; ')}`,
      });
    }

    return {
      message,
      data: {
        importedCount,
        errorCount: errors.length,
        created: createdRecords.length > 0 ? createdRecords : undefined,
        errors: errorDetails.length > 0 ? errorDetails : undefined,
        affectedPersonnelIds: Array.from(affectedPersonnelIds),
      },
    };
  }

  private createHandlers: Partial<Record<ProposalType, CreateHandler>> = {
    [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: ctx => this.handleCaNhanHangNam(ctx),
    [PROPOSAL_TYPES.DON_VI_HANG_NAM]: ctx => this.handleDonViHangNam(ctx),
    [PROPOSAL_TYPES.NCKH]: ctx => this.handleNCKH(ctx),
    [PROPOSAL_TYPES.HC_QKQT]: ctx => this.handleHCQKQT(ctx),
    [PROPOSAL_TYPES.NIEN_HAN]: ctx => this.handleNienHan(ctx),
    [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: ctx => this.handleKNC(ctx),
    [PROPOSAL_TYPES.CONG_HIEN]: ctx => this.handleCongHien(ctx),
  };

  private async handleCaNhanHangNam(ctx: BulkCreateContext): Promise<void> {
    const { titleData, selectedPersonnel, nam, ghiChu } = ctx;
    const personnelRewardsData = titleData.map(item => ({
      personnel_id: item.personnel_id,
      so_quyet_dinh: item.so_quyet_dinh || null,
      cap_bac: item.cap_bac || null,
      chuc_vu: item.chuc_vu || null,
    }));

    const firstItem = titleData[0];
    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: selectedPersonnel,
      personnel_rewards_data: personnelRewardsData,
      nam,
      danh_hieu: firstItem.danh_hieu,
      ghi_chu: ghiChu,
    });

    ctx.importedCount.value = result.details.created.length;
    ctx.createdRecords.push(...result.details.created);
    if (result.details.errors.length > 0) {
      ctx.errorDetails.push(...result.details.errors);
      ctx.errors.push(...result.details.errors.map(e => e.error));
    }
    selectedPersonnel.forEach(id => ctx.affectedPersonnelIds.add(id));
  }

  private async handleDonViHangNam(ctx: BulkCreateContext): Promise<void> {
    const { titleData, nam, ghiChu, adminId } = ctx;
    for (const item of titleData) {
      try {
        const record = await unitAnnualAwardService.upsert({
          don_vi_id: item.don_vi_id,
          nam,
          danh_hieu: item.danh_hieu,
          so_quyet_dinh: item.so_quyet_dinh || null,
          ghi_chu: ghiChu || null,
          nguoi_tao_id: adminId,
        });
        ctx.createdRecords.push(record);
        ctx.importedCount.value++;
        if (item.don_vi_id) {
          ctx.affectedUnitIds.add(item.don_vi_id);
        }
      } catch (error) {
        const unitMsg = `Lỗi khi thêm khen thưởng cho đơn vị ${item.don_vi_id}: ${(error as Error).message}`;
        console.error('[bulkCreateAwards]', unitMsg, error);
        ctx.errors.push(unitMsg);
        ctx.errorDetails.push({ personnelId: item.don_vi_id || '', error: unitMsg });
      }
    }
  }

  private async handleNCKH(ctx: BulkCreateContext): Promise<void> {
    const { titleData, nam, ghiChu } = ctx;
    for (const item of titleData) {
      try {
        const record = await scientificAchievementService.createAchievement({
          personnel_id: item.personnel_id,
          nam,
          loai: item.loai,
          mo_ta: item.mo_ta,
          cap_bac: item.cap_bac || null,
          chuc_vu: item.chuc_vu || null,
          so_quyet_dinh: item.so_quyet_dinh || null,
          ghi_chu: ghiChu || null,
        });
        ctx.createdRecords.push(record);
        ctx.importedCount.value++;
        ctx.affectedPersonnelIds.add(item.personnel_id);
      } catch (error) {
        const nckhMsg = `Lỗi khi thêm thành tích cho quân nhân ${item.personnel_id}: ${(error as Error).message}`;
        console.error('[bulkCreateAwards]', nckhMsg, error);
        ctx.errors.push(nckhMsg);
        ctx.errorDetails.push({ personnelId: item.personnel_id || '', error: nckhMsg });
      }
    }
  }

  private async handleHCQKQT(ctx: BulkCreateContext): Promise<void> {
    const { titleData, personnelMap, nam, ghiChu, thang } = ctx;
    await prisma.$transaction(async prismaTx => {
      const result = await this.bulkUpsertMedalAward(
        prismaTx.huanChuongQuanKyQuyetThang,
        personnelId => ({ quan_nhan_id: personnelId }),
        titleData,
        personnelMap,
        nam,
        ghiChu,
        undefined,
        thang
      );
      ctx.importedCount.value += result.importedCount;
      result.affectedPersonnelIds.forEach(id => ctx.affectedPersonnelIds.add(id));
    });
  }

  private async handleKNC(ctx: BulkCreateContext): Promise<void> {
    const { titleData, personnelMap, nam, ghiChu, thang } = ctx;
    await prisma.$transaction(async prismaTx => {
      const result = await this.bulkUpsertMedalAward(
        prismaTx.kyNiemChuongVSNXDQDNDVN,
        personnelId => ({ quan_nhan_id: personnelId }),
        titleData,
        personnelMap,
        nam,
        ghiChu,
        undefined,
        thang
      );
      ctx.importedCount.value += result.importedCount;
      result.affectedPersonnelIds.forEach(id => ctx.affectedPersonnelIds.add(id));
    });
  }

  private async handleNienHan(ctx: BulkCreateContext): Promise<void> {
    const { titleData, personnelMap, nam, thang, ghiChu, type, adminId, errors } = ctx;
    const allowedDanhHieus: string[] = Object.values(DANH_HIEU_HCCSVV);
    for (const item of titleData) {
      if (!item.danh_hieu) {
        errors.push(`Huy chương CSVV thiếu danh_hieu cho quân nhân ${item.personnel_id}`);
      } else if (!allowedDanhHieus.includes(item.danh_hieu)) {
        errors.push(
          `Danh hiệu "${item.danh_hieu}" không hợp lệ. Chỉ cho phép: ${formatDanhHieuList(allowedDanhHieus)}`
        );
      }
    }
    if (errors.length > 0) {
      this.throwValidationErrors(errors, type, nam, adminId);
    }

    const nienHanPersonnelIds = titleData.map(item => item.personnel_id).filter(Boolean);
    const existingHCCSVV = await prisma.khenThuongHCCSVV.findMany({
      where: { quan_nhan_id: { in: nienHanPersonnelIds } },
      select: { quan_nhan_id: true, danh_hieu: true, nam: true },
    });
    const hccsvvByPersonnel = new Map<string, { danh_hieu: string; nam: number }[]>();
    for (const r of existingHCCSVV) {
      const list = hccsvvByPersonnel.get(r.quan_nhan_id) || [];
      list.push({ danh_hieu: r.danh_hieu, nam: r.nam });
      hccsvvByPersonnel.set(r.quan_nhan_id, list);
    }
    for (const item of titleData) {
      const existing = hccsvvByPersonnel.get(item.personnel_id) || [];
      const orderError = validateHCCSVVRankOrder(item.danh_hieu, nam, existing);
      if (orderError) {
        const qn = personnelMap.get(item.personnel_id);
        const name = qn?.ho_ten || item.personnel_id;
        errors.push(`${name}: ${orderError}`);
      }
    }
    if (errors.length > 0) {
      this.throwValidationErrors(errors, type, nam, adminId);
    }

    await prisma.$transaction(async prismaTx => {
      const result = await this.bulkUpsertMedalAward(
        prismaTx.khenThuongHCCSVV,
        (personnelId, danhHieu) => ({
          quan_nhan_id_danh_hieu: { quan_nhan_id: personnelId, danh_hieu: danhHieu },
        }),
        titleData,
        personnelMap,
        nam,
        ghiChu,
        item => ({ danh_hieu: item.danh_hieu }),
        thang
      );
      ctx.importedCount.value += result.importedCount;
      result.affectedPersonnelIds.forEach(id => ctx.affectedPersonnelIds.add(id));
    });
  }

  private async handleCongHien(ctx: BulkCreateContext): Promise<void> {
    const { titleData, nam, thang, ghiChu, type, adminId, errors } = ctx;
    const allowedDanhHieus: string[] = Object.values(DANH_HIEU_HCBVTQ);
    for (const item of titleData) {
      if (!item.danh_hieu) {
        errors.push(`HC BVTQ thiếu danh_hieu cho quân nhân ${item.personnel_id}`);
      } else if (!allowedDanhHieus.includes(item.danh_hieu)) {
        errors.push(
          `Danh hiệu "${item.danh_hieu}" không hợp lệ. Chỉ cho phép: ${formatDanhHieuList(allowedDanhHieus)}`
        );
      }
    }
    if (errors.length > 0) {
      this.throwValidationErrors(errors, type, nam, adminId);
    }

    const congHienPersonnelIds = titleData.map(item => item.personnel_id).filter(Boolean);

    const [congHienPersonnel, allPositionHistories] = await Promise.all([
      prisma.quanNhan.findMany({
        where: { id: { in: congHienPersonnelIds } },
        select: { id: true, ho_ten: true, gioi_tinh: true },
      }),
      prisma.lichSuChucVu.findMany({
        where: { quan_nhan_id: { in: congHienPersonnelIds } },
        select: {
          quan_nhan_id: true,
          he_so_chuc_vu: true,
          so_thang: true,
          ngay_bat_dau: true,
          ngay_ket_thuc: true,
        },
      }),
    ]);

    const personnelGenderMap = new Map<string, { gioi_tinh: string | null; ho_ten: string }>();
    for (const p of congHienPersonnel) {
      personnelGenderMap.set(p.id, { gioi_tinh: p.gioi_tinh, ho_ten: p.ho_ten });
    }

    const historiesByPersonnel = new Map<string, typeof allPositionHistories>();
    for (const h of allPositionHistories) {
      const list = historiesByPersonnel.get(h.quan_nhan_id) ?? [];
      list.push(h);
      historiesByPersonnel.set(h.quan_nhan_id, list);
    }

    // Cap recalculated months at the proposal cutoff date so admin bulk respects
    // the same eligibility window as submit/approve (drift unification — see Phase 5b).
    const cutoffDate = buildCutoffDate(nam, thang ?? null);
    const monthsByPersonnel = new Map<string, PositionMonthsByGroup>();
    for (const [personnelId, histories] of historiesByPersonnel) {
      monthsByPersonnel.set(personnelId, aggregatePositionMonthsByGroup(histories, cutoffDate));
    }

    const getTotalMonthsByGroup = (personnelId: string, group: string) => {
      const months = monthsByPersonnel.get(personnelId);
      if (!months) return 0;
      return months[group as keyof PositionMonthsByGroup] ?? 0;
    };

    const eligibleTitleData: TitleDataItem[] = [];
    for (const item of titleData) {
      if (!item.danh_hieu || !item.personnel_id) {
        eligibleTitleData.push(item);
        continue;
      }

      const info = personnelGenderMap.get(item.personnel_id);
      const hoTen = (info && info.ho_ten) || item.personnel_id;
      const gioiTinh = info && info.gioi_tinh;

      const months: PositionMonthsByGroup = {
        [CONG_HIEN_HE_SO_GROUPS.LEVEL_07]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_07),
        [CONG_HIEN_HE_SO_GROUPS.LEVEL_08]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_08),
        [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10),
      };
      const result = evaluateHCBVTQRank(item.danh_hieu, months, gioiTinh);

      if (!result.rank) {
        eligibleTitleData.push(item);
        continue;
      }

      if (!result.eligible) {
        const totalYearsText = formatServiceDuration(result.totalMonths);
        const requiredYearsText = formatServiceDuration(result.requiredMonths);
        const genderText = gioiTinh === GENDER.FEMALE ? ' (Nữ giảm 1/3 thời gian)' : '';

        errors.push(
          `Quân nhân "${hoTen}" không đủ điều kiện Huân chương Bảo vệ Tổ quốc ${result.rankName}. ` +
            `Yêu cầu: ít nhất ${requiredYearsText}${genderText}. Hiện tại: ${totalYearsText}.`
        );
        continue;
      }

      eligibleTitleData.push(item);
    }

    // Defensive guard: even if checkDuplicateAwards already blocked existing HCBVTQ
    // owners, re-query and refuse downgrades/dupes here so the upsert below cannot
    // silently overwrite a higher rank (e.g. HANG_NHAT -> HANG_BA).
    const hcbvtqPersonnelIds = eligibleTitleData
      .map(it => it.personnel_id)
      .filter(Boolean);
    if (hcbvtqPersonnelIds.length > 0) {
      const existingHCBVTQ = await prisma.khenThuongHCBVTQ.findMany({
        where: { quan_nhan_id: { in: hcbvtqPersonnelIds } },
        select: { quan_nhan_id: true, danh_hieu: true },
      });
      const existingRankMap = new Map(
        existingHCBVTQ.map(r => [r.quan_nhan_id, r.danh_hieu])
      );
      const guardedTitleData: TitleDataItem[] = [];
      for (const item of eligibleTitleData) {
        const existingRank = existingRankMap.get(item.personnel_id);
        const rankError = validateHCBVTQRankUpgrade(existingRank, item.danh_hieu);
        if (rankError) {
          const info = personnelGenderMap.get(item.personnel_id);
          const hoTen = (info && info.ho_ten) || item.personnel_id;
          errors.push(`Quân nhân "${hoTen}": ${rankError}`);
          continue;
        }
        guardedTitleData.push(item);
      }
      eligibleTitleData.length = 0;
      eligibleTitleData.push(...guardedTitleData);
    }

    // Reject proposals lower than the highest rank the personnel qualifies for.
    const highestRankFiltered: TitleDataItem[] = [];
    for (const item of eligibleTitleData) {
      if (!item.danh_hieu || !item.personnel_id) {
        highestRankFiltered.push(item);
        continue;
      }
      const months: PositionMonthsByGroup = {
        [CONG_HIEN_HE_SO_GROUPS.LEVEL_07]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_07),
        [CONG_HIEN_HE_SO_GROUPS.LEVEL_08]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_08),
        [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: getTotalMonthsByGroup(item.personnel_id, CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10),
      };
      const info = personnelGenderMap.get(item.personnel_id);
      const requiredMonths = requiredCongHienMonths(info?.gioi_tinh ?? null);
      const downgradeError = validateHCBVTQHighestRank(item.danh_hieu, months, requiredMonths);
      if (downgradeError) {
        const hoTen = (info && info.ho_ten) || item.personnel_id;
        errors.push(`Quân nhân "${hoTen}": ${downgradeError}`);
        continue;
      }
      highestRankFiltered.push(item);
    }
    eligibleTitleData.length = 0;
    eligibleTitleData.push(...highestRankFiltered);

    if (eligibleTitleData.length === 0 && errors.length > 0) {
      this.throwValidationErrors(errors, type, nam, adminId);
    }

    await prisma.$transaction(async prismaTx => {
      for (const item of eligibleTitleData) {
        await prismaTx.khenThuongHCBVTQ.upsert({
          where: { quan_nhan_id: item.personnel_id },
          create: {
            quan_nhan_id: item.personnel_id,
            danh_hieu: item.danh_hieu,
            nam,
            thang: thang as number,
            cap_bac: item.cap_bac || null,
            chuc_vu: item.chuc_vu || null,
            ghi_chu: ghiChu || null,
            so_quyet_dinh: item.so_quyet_dinh || null,
            thoi_gian_nhom_0_7: item.thoi_gian_nhom_0_7 || undefined,
            thoi_gian_nhom_0_8: item.thoi_gian_nhom_0_8 || undefined,
            thoi_gian_nhom_0_9_1_0: item.thoi_gian_nhom_0_9_1_0 || undefined,
          } as Prisma.KhenThuongHCBVTQUncheckedCreateInput,
          update: {
            danh_hieu: item.danh_hieu,
            nam,
            thang: thang as number,
            cap_bac: item.cap_bac || null,
            chuc_vu: item.chuc_vu || null,
            ghi_chu: ghiChu || null,
            so_quyet_dinh: item.so_quyet_dinh || null,
            thoi_gian_nhom_0_7: item.thoi_gian_nhom_0_7
              ? (item.thoi_gian_nhom_0_7 as unknown as Prisma.InputJsonValue)
              : null,
            thoi_gian_nhom_0_8: item.thoi_gian_nhom_0_8
              ? (item.thoi_gian_nhom_0_8 as unknown as Prisma.InputJsonValue)
              : null,
            thoi_gian_nhom_0_9_1_0: item.thoi_gian_nhom_0_9_1_0
              ? (item.thoi_gian_nhom_0_9_1_0 as unknown as Prisma.InputJsonValue)
              : null,
          },
        });

        ctx.importedCount.value++;
        ctx.affectedPersonnelIds.add(item.personnel_id);
      }
    });
  }

  /** Upsert medal awards in a single transaction for one-time or keyed-by-danh-hieu medal types. */
  private async bulkUpsertMedalAward(
    // Prisma's per-model upsert args differ by table — caller passes a concrete delegate; loose typing here keeps the helper generic.
    model: { upsert: (args: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown> },
    buildWhere: (personnelId: string, danhHieu: string) => Record<string, unknown>,
    titleData: TitleDataItem[],
    personnelMap: Map<string, QuanNhan>,
    nam: number,
    ghiChu: string | null | undefined,
    extraDataBuilder?: (item: TitleDataItem) => Record<string, unknown>,
    thang?: number | null
  ): Promise<{ importedCount: number; affectedPersonnelIds: Set<string> }> {
    const importedCount = { value: 0 };
    const affectedPersonnelIds = new Set<string>();

    for (const item of titleData) {
      const quanNhan = personnelMap.get(item.personnel_id);

      if (!quanNhan) {
        throw new NotFoundError(`Quân nhân (ID: ${item.personnel_id})`);
      }

      const thoiGian = this.calculateThoiGian(quanNhan);
      const where = buildWhere(item.personnel_id, item.danh_hieu);
      const extraData = extraDataBuilder ? extraDataBuilder(item) : {};

      const baseData: Record<string, unknown> = {
        quan_nhan_id: item.personnel_id,
        nam,
        cap_bac: item.cap_bac || null,
        chuc_vu: item.chuc_vu || null,
        ghi_chu: ghiChu || null,
        so_quyet_dinh: item.so_quyet_dinh || null,
        thoi_gian: thoiGian,
        ...extraData,
      };
      if (thang != null) baseData.thang = thang;

      await model.upsert({
        where,
        create: baseData,
        update: baseData,
      });

      importedCount.value++;
      affectedPersonnelIds.add(item.personnel_id);
    }

    return { importedCount: importedCount.value, affectedPersonnelIds };
  }

  calculateThoiGian(quanNhan: QuanNhan): ServiceTimeJson | null {
    if (!quanNhan.ngay_nhap_ngu) return null;

    const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
    const ngayKetThuc = quanNhan.ngay_xuat_ngu ? new Date(quanNhan.ngay_xuat_ngu) : new Date();

    const months = calculateServiceMonths(ngayNhapNgu, ngayKetThuc);

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return {
      total_months: months,
      years,
      months: remainingMonths,
      display: months === 0 ? '-' : formatServiceDuration(months),
    };
  }
}

export default new AwardBulkService();
