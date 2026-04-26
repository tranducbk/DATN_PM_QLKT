import { prisma } from '../models';
import { calculateServiceMonths, calculateTenureMonthsWithDayPrecision } from '../helpers/serviceYearsHelper';
import annualRewardService from './annualReward.service';
import unitAnnualAwardService from './unitAnnualAward.service';
import scientificAchievementService from './scientificAchievement.service';
import * as notificationHelper from '../helpers/notification';
import { writeSystemLog } from '../helpers/systemLogHelper';
import {
  getDanhHieuName,
  formatDanhHieuList,
  DANH_HIEU_MAP,
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_CO_BAN,
  DANH_HIEU_DON_VI_BANG_KHEN,
  DANH_HIEU_HCCSVV,
  DANH_HIEU_HCBVTQ,
  CONG_HIEN_BASE_REQUIRED_MONTHS,
  CONG_HIEN_FEMALE_REQUIRED_MONTHS,
  HCQKQT_YEARS_REQUIRED,
  DANH_HIEU_NCKH,
  LOAI_DE_XUAT_MAP,
} from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES, type ProposalType } from '../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { AppError, NotFoundError, ValidationError } from '../middlewares/errorHandler';
import type { QuanNhan, Prisma } from '../generated/prisma';
import { GENDER } from '../constants/gender.constants';

interface ServiceYears {
  years: number;
  months: number;
  totalMonths: number;
}

export interface TitleDataItem {
  personnel_id: string;
  danh_hieu: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  loai?: string;
  mo_ta?: string;
  don_vi_id?: string;
  thoi_gian_nhom_0_7?: Record<string, any> | null;
  thoi_gian_nhom_0_8?: Record<string, any> | null;
  thoi_gian_nhom_0_9_1_0?: Record<string, any> | null;
}

interface BulkCreateAwardsParams {
  type: string;
  nam: number;
  selectedPersonnel: string[];
  selectedUnits?: string[];
  titleData: TitleDataItem[];
  ghiChu?: string | null;
  attachedFiles?: unknown[];
  adminId: string;
}

class AwardBulkService {
  calculateServiceYears(
    ngayNhapNgu: Date,
    ngayXuatNgu: Date | null = null
  ): ServiceYears | null {
    if (!ngayNhapNgu) return null;
    const totalMonths = calculateServiceMonths(ngayNhapNgu, ngayXuatNgu);
    return {
      years: Math.floor(totalMonths / 12),
      months: totalMonths % 12,
      totalMonths,
    };
  }

  /** Query award table by proposal type. */
  private getAwardTableQuery(type: string, personnelIds: string[], nam: number) {
    switch (type) {
      case PROPOSAL_TYPES.CA_NHAN_HANG_NAM:
        return prisma.danhHieuHangNam.findMany({ where: { quan_nhan_id: { in: personnelIds }, nam }, select: { quan_nhan_id: true, danh_hieu: true } });
      case PROPOSAL_TYPES.NIEN_HAN:
        return prisma.khenThuongHCCSVV.findMany({ where: { quan_nhan_id: { in: personnelIds } }, select: { quan_nhan_id: true, danh_hieu: true } });
      case PROPOSAL_TYPES.HC_QKQT:
        return prisma.huanChuongQuanKyQuyetThang.findMany({ where: { quan_nhan_id: { in: personnelIds } }, select: { quan_nhan_id: true } });
      case PROPOSAL_TYPES.KNC_VSNXD_QDNDVN:
        return prisma.kyNiemChuongVSNXDQDNDVN.findMany({ where: { quan_nhan_id: { in: personnelIds } }, select: { quan_nhan_id: true } });
      case PROPOSAL_TYPES.CONG_HIEN:
        return prisma.khenThuongHCBVTQ.findMany({ where: { quan_nhan_id: { in: personnelIds } }, select: { quan_nhan_id: true, danh_hieu: true } });
      default:
        return Promise.resolve([]);
    }
  }

  /** Get the proposal data field name for duplicate checking. */
  private getProposalDataField(type: string): string {
    if (type === PROPOSAL_TYPES.CA_NHAN_HANG_NAM || type === PROPOSAL_TYPES.DON_VI_HANG_NAM) return 'data_danh_hieu';
    if (type === PROPOSAL_TYPES.CONG_HIEN) return 'data_cong_hien';
    return 'data_nien_han';
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

    const isOneTime = type === PROPOSAL_TYPES.HC_QKQT || type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN || type === PROPOSAL_TYPES.CONG_HIEN;

    for (const item of items) {
      const hoTen = personnelMap.get(item.personnel_id) || item.personnel_id;
      const key = `${item.personnel_id}_${item.danh_hieu}`;

        if (type === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
        if (existingSet.has(key)) {
          duplicateErrors.push(`${hoTen}: ${getDanhHieuName(item.danh_hieu)} năm ${nam} đã có trên hệ thống`);
          continue;
        }
      } else if (type === PROPOSAL_TYPES.NIEN_HAN) {
        if (existingSet.has(key)) {
          duplicateErrors.push(`${hoTen}: đã có ${getDanhHieuName(item.danh_hieu)} trên hệ thống`);
          continue;
        }
      } else {
        if (existingByPersonnel.has(item.personnel_id)) {
          const label =
            type === PROPOSAL_TYPES.HC_QKQT
              ? DANH_HIEU_MAP.HC_QKQT
              : type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
                ? DANH_HIEU_MAP.KNC_VSNXD_QDNDVN
                : getDanhHieuName(item.danh_hieu);
          duplicateErrors.push(`${hoTen}: đã có ${label} trên hệ thống`);
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
    const errors: string[] = [];
    if (!selectedPersonnel || selectedPersonnel.length === 0) return errors;

    const personnelList = await prisma.quanNhan.findMany({
      where: { id: { in: selectedPersonnel } },
      select: {
        id: true,
        ho_ten: true,
        gioi_tinh: true,
        ngay_nhap_ngu: true,
        ngay_xuat_ngu: true,
      },
    });

    const personnelMap: Record<
      string,
      {
        id: string;
        ho_ten: string;
        gioi_tinh: string | null;
        ngay_nhap_ngu: Date | null;
        ngay_xuat_ngu: Date | null;
      }
    > = {};
    personnelList.forEach(p => {
      personnelMap[p.id] = p;
    });

    for (const personnelId of selectedPersonnel) {
      const quanNhan = personnelMap[personnelId];

      if (!quanNhan) {
        errors.push(`Không tìm thấy quân nhân với ID: ${personnelId}`);
        continue;
      }

      if (type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
        if (!quanNhan.gioi_tinh || (quanNhan.gioi_tinh !== GENDER.MALE && quanNhan.gioi_tinh !== GENDER.FEMALE)) {
          errors.push(`Quân nhân "${quanNhan.ho_ten}" chưa cập nhật giới tính`);
        }
        if (!quanNhan.ngay_nhap_ngu) {
          errors.push(`Quân nhân "${quanNhan.ho_ten}" chưa cập nhật ngày nhập ngũ`);
        }
      }

      if (type === PROPOSAL_TYPES.NIEN_HAN) {
        if (!quanNhan.ngay_nhap_ngu) {
          errors.push(`Quân nhân "${quanNhan.ho_ten}" chưa cập nhật ngày nhập ngũ`);
        }
      }

      if (type === PROPOSAL_TYPES.HC_QKQT) {
        if (!quanNhan.ngay_nhap_ngu) {
          errors.push(`Quân nhân "${quanNhan.ho_ten}" chưa cập nhật ngày nhập ngũ`);
        } else {
          const serviceTime = this.calculateServiceYears(
            quanNhan.ngay_nhap_ngu,
            quanNhan.ngay_xuat_ngu
          );
          if (serviceTime && serviceTime.years < HCQKQT_YEARS_REQUIRED) {
            errors.push(
              `Quân nhân "${quanNhan.ho_ten}" chưa đủ ${HCQKQT_YEARS_REQUIRED} năm phục vụ (hiện tại: ${serviceTime.years} năm)`
            );
          }
        }
      }
    }

    return errors;
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
      let importedCount = 0;

      const duplicateErrors: string[] = [];

      const typesWithPersonnelDup: ProposalType[] = [
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        PROPOSAL_TYPES.NIEN_HAN,
        PROPOSAL_TYPES.HC_QKQT,
        PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        PROPOSAL_TYPES.CONG_HIEN,
      ];
      if (typesWithPersonnelDup.includes(type as ProposalType)) {
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

      if (type === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
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
          nam: nam,
          danh_hieu: firstItem.danh_hieu,
          ghi_chu: ghiChu,
        });

        importedCount = result.details.created.length;
        createdRecords.push(...result.details.created);
        if (result.details.errors.length > 0) {
          errorDetails.push(...result.details.errors);
          errors.push(...result.details.errors.map(e => e.error));
        }
        selectedPersonnel.forEach(id => affectedPersonnelIds.add(id));
      } else if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        for (const item of titleData) {
          try {
            const record = await unitAnnualAwardService.upsert({
              don_vi_id: item.don_vi_id,
              nam: nam,
              danh_hieu: item.danh_hieu,
              so_quyet_dinh: item.so_quyet_dinh || null,
              ghi_chu: ghiChu || null,
              nguoi_tao_id: adminId,
            });
            createdRecords.push(record);
            importedCount++;
          } catch (error) {
            const unitMsg = `Lỗi khi thêm khen thưởng cho đơn vị ${item.don_vi_id}: ${(error as Error).message}`;
            console.error('[bulkCreateAwards]', unitMsg, error);
            errors.push(unitMsg);
            errorDetails.push({ personnelId: item.don_vi_id || '', error: unitMsg });
          }
        }
      } else if (type === PROPOSAL_TYPES.NCKH) {
        for (const item of titleData) {
          try {
            const record = await scientificAchievementService.createAchievement({
              personnel_id: item.personnel_id,
              nam: nam,
              loai: item.loai,
              mo_ta: item.mo_ta,
              cap_bac: item.cap_bac || null,
              chuc_vu: item.chuc_vu || null,
              so_quyet_dinh: item.so_quyet_dinh || null,
              ghi_chu: ghiChu || null,
            });
            createdRecords.push(record);
            importedCount++;
            affectedPersonnelIds.add(item.personnel_id);
          } catch (error) {
            const nckhMsg = `Lỗi khi thêm thành tích cho quân nhân ${item.personnel_id}: ${(error as Error).message}`;
            console.error('[bulkCreateAwards]', nckhMsg, error);
            errors.push(nckhMsg);
            errorDetails.push({ personnelId: item.personnel_id || '', error: nckhMsg });
          }
        }
      } else if (type === PROPOSAL_TYPES.HC_QKQT) {
        await prisma.$transaction(async prismaTx => {
          const result = await this.bulkUpsertMedalAward(
            prismaTx.huanChuongQuanKyQuyetThang,
            (personnelId) => ({ quan_nhan_id: personnelId }),
            titleData,
            personnelMap,
            nam,
            ghiChu
          );
          importedCount += result.importedCount;
          result.affectedPersonnelIds.forEach(id => affectedPersonnelIds.add(id));
        });
      } else if (type === PROPOSAL_TYPES.NIEN_HAN) {
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
            (item) => ({ danh_hieu: item.danh_hieu })
          );
          importedCount += result.importedCount;
          result.affectedPersonnelIds.forEach(id => affectedPersonnelIds.add(id));
        });
      } else if (type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
        await prisma.$transaction(async prismaTx => {
          const result = await this.bulkUpsertMedalAward(
            prismaTx.kyNiemChuongVSNXDQDNDVN,
            (personnelId) => ({ quan_nhan_id: personnelId }),
            titleData,
            personnelMap,
            nam,
            ghiChu
          );
          importedCount += result.importedCount;
          result.affectedPersonnelIds.forEach(id => affectedPersonnelIds.add(id));
        });
      } else if (type === PROPOSAL_TYPES.CONG_HIEN) {
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

        const baseRequiredMonths = CONG_HIEN_BASE_REQUIRED_MONTHS;
        const femaleRequiredMonths = CONG_HIEN_FEMALE_REQUIRED_MONTHS;

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

        type PositionEntry = { he_so_chuc_vu: number; so_thang: number | null; ngay_bat_dau: Date; ngay_ket_thuc: Date | null };
        const positionHistoriesMap = new Map<string, PositionEntry[]>();
        const today = new Date();
        for (const h of allPositionHistories) {
          let entry: PositionEntry;
          if ((h.so_thang === null || h.so_thang === undefined) && h.ngay_bat_dau && !h.ngay_ket_thuc) {
            const ngayBatDau = new Date(h.ngay_bat_dau);
            entry = {
              he_so_chuc_vu: Number(h.he_so_chuc_vu),
              so_thang: calculateTenureMonthsWithDayPrecision(ngayBatDau, today),
              ngay_bat_dau: h.ngay_bat_dau,
              ngay_ket_thuc: h.ngay_ket_thuc,
            };
          } else {
            entry = { he_so_chuc_vu: Number(h.he_so_chuc_vu), so_thang: h.so_thang, ngay_bat_dau: h.ngay_bat_dau, ngay_ket_thuc: h.ngay_ket_thuc };
          }
          const list = positionHistoriesMap.get(h.quan_nhan_id) ?? [];
          list.push(entry);
          positionHistoriesMap.set(h.quan_nhan_id, list);
        }

        const getTotalMonthsByGroup = (personnelId: string, group: string) => {
          const histories = positionHistoriesMap.get(personnelId) ?? [];
          let totalMonths = 0;
          histories.forEach(history => {
            const heSo = Number(history.he_so_chuc_vu) || 0;
            let belongsToGroup = false;
            if (group === '0.7') {
              belongsToGroup = heSo >= 0.7 && heSo < 0.8;
            } else if (group === '0.8') {
              belongsToGroup = heSo >= 0.8 && heSo < 0.9;
            } else if (group === '0.9-1.0') {
              belongsToGroup = heSo >= 0.9 && heSo <= 1.0;
            }
            if (belongsToGroup && history.so_thang !== null && history.so_thang !== undefined) {
              totalMonths += Number(history.so_thang);
            }
          });
          return totalMonths;
        };

        const getRequiredMonths = (personnelId: string) => {
          const info = personnelGenderMap.get(personnelId);
          return info && info.gioi_tinh === GENDER.FEMALE ? femaleRequiredMonths : baseRequiredMonths;
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
          const requiredMonths = getRequiredMonths(item.personnel_id);

          // Compute once per person — used in both eligibility check and error message
          const months0_9_1_0 = getTotalMonthsByGroup(item.personnel_id, '0.9-1.0');
          const months0_8 = getTotalMonthsByGroup(item.personnel_id, '0.8');
          const months0_7 = getTotalMonthsByGroup(item.personnel_id, '0.7');

          let eligible = false;
          let rankName = '';
          let totalMonths = 0;

          if (item.danh_hieu === DANH_HIEU_HCBVTQ.HANG_NHAT) {
            totalMonths = months0_9_1_0;
            eligible = totalMonths >= requiredMonths;
            rankName = 'Hạng Nhất';
          } else if (item.danh_hieu === DANH_HIEU_HCBVTQ.HANG_NHI) {
            totalMonths = months0_8 + months0_9_1_0;
            eligible = totalMonths >= requiredMonths;
            rankName = 'Hạng Nhì';
          } else if (item.danh_hieu === DANH_HIEU_HCBVTQ.HANG_BA) {
            totalMonths = months0_7 + months0_8 + months0_9_1_0;
            eligible = totalMonths >= requiredMonths;
            rankName = 'Hạng Ba';
          }

          if (!eligible) {

            const totalYears = Math.floor(totalMonths / 12);
            const remainingMonths = totalMonths % 12;
            const totalYearsText =
              totalYears > 0 && remainingMonths > 0
                ? `${totalYears} nam ${remainingMonths} thang`
                : totalYears > 0
                  ? `${totalYears} nam`
                  : `${remainingMonths} thang`;

            const requiredYears = Math.floor(requiredMonths / 12);
            const requiredRemainingMonths = requiredMonths % 12;
            const requiredYearsText =
              requiredYears > 0 && requiredRemainingMonths > 0
                ? `${requiredYears} nam ${requiredRemainingMonths} thang`
                : requiredYears > 0
                  ? `${requiredYears} nam`
                  : `${requiredRemainingMonths} thang`;

            const genderText = gioiTinh === GENDER.FEMALE ? ' (Nu giam 1/3 thoi gian)' : '';

            errors.push(
              `Quan nhan "${hoTen}" khong du dieu kien Huan chuong Bao ve To quoc ${rankName}. ` +
                `Yeu cau: it nhat ${requiredYearsText}${genderText}. Hien tai: ${totalYearsText}.`
            );
            continue;
          }

          eligibleTitleData.push(item);
        }

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
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian_nhom_0_7: item.thoi_gian_nhom_0_7 || null,
                thoi_gian_nhom_0_8: item.thoi_gian_nhom_0_8 || null,
                thoi_gian_nhom_0_9_1_0: item.thoi_gian_nhom_0_9_1_0 || null,
              },
            });

            importedCount++;
            affectedPersonnelIds.add(item.personnel_id);
          }
        });
      } else {
        throw new ValidationError(
          `Loại khen thưởng "${type}" chưa được hỗ trợ trong chức năng thêm đồng loạt.`
        );
      }


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
        writeSystemLog({
          action: 'ERROR',
          resource: 'award-bulk',
          description: `Lỗi gửi thông báo thêm khen thưởng đồng loạt: ${e}`,
        });
      }

    const unit = type === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'đơn vị' : 'quân nhân';
    let message: string;
    if (importedCount > 0 && errors.length > 0) {
      message = `Đã thêm thành công ${importedCount} ${unit}, ${errors.length} lỗi`;
    } else if (importedCount > 0) {
      message = `Đã thêm thành công ${importedCount} ${unit}`;
    } else if (errors.length > 0) {
      message = `Thêm khen thưởng thất bại: ${errors.length} lỗi`;
    } else {
      message = importedCount > 0 ? 'Thêm khen thưởng thành công!' : 'Không có dữ liệu nào được thêm';
    }

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

  /** Upsert medal awards in a single transaction for one-time or keyed-by-danh-hieu medal types. */
  private async bulkUpsertMedalAward(
    model: { upsert: (args: any) => Promise<any> },
    buildWhere: (personnelId: string, danhHieu: string) => Record<string, any>,
    titleData: TitleDataItem[],
    personnelMap: Map<string, QuanNhan>,
    nam: number,
    ghiChu: string | null | undefined,
    extraDataBuilder?: (item: TitleDataItem) => Record<string, any>
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

      const baseData = {
        quan_nhan_id: item.personnel_id,
        nam,
        cap_bac: item.cap_bac || null,
        chuc_vu: item.chuc_vu || null,
        ghi_chu: ghiChu || null,
        so_quyet_dinh: item.so_quyet_dinh || null,
        thoi_gian: thoiGian,
        ...extraData,
      };

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

  calculateThoiGian(quanNhan: QuanNhan): Record<string, any> | null {
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
      display:
        months === 0
          ? '-'
          : years > 0 && remainingMonths > 0
            ? `${years} năm ${remainingMonths} tháng`
            : years > 0
              ? `${years} năm`
              : `${remainingMonths} tháng`,
    };
  }
}

export default new AwardBulkService();
