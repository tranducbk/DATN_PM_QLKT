import { prisma } from '../models';
import annualRewardService from './annualReward.service';
import unitAnnualAwardService from './unitAnnualAward.service';
import scientificAchievementService from './scientificAchievement.service';
import * as notificationHelper from '../helpers/notification';
import { getDanhHieuName, DANH_HIEU_CA_NHAN_HANG_NAM, UNIT_DV_TITLES, UNIT_BK_TITLES } from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES, type ProposalType } from '../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { AppError, NotFoundError, ValidationError } from '../middlewares/errorHandler';
import type { QuanNhan } from '../generated/prisma';

interface ServiceYears {
  years: number;
  months: number;
  totalMonths: number;
}

interface TitleDataItem {
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

    const startDate = new Date(ngayNhapNgu);
    const endDate = ngayXuatNgu ? new Date(ngayXuatNgu) : new Date();

    let months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
    months += endDate.getMonth() - startDate.getMonth();
    if (endDate.getDate() < startDate.getDate()) {
      months--;
    }
    months = Math.max(0, months);

    return {
      years: Math.floor(months / 12),
      months: months % 12,
      totalMonths: months,
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
        return prisma.khenThuongCongHien.findMany({ where: { quan_nhan_id: { in: personnelIds } }, select: { quan_nhan_id: true, danh_hieu: true } });
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
          const label = type === PROPOSAL_TYPES.HC_QKQT ? 'Huy chương Quân kỳ quyết thắng'
            : type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN ? 'Kỷ niệm chương VSNXD QĐNDVN'
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
        const isDv = UNIT_DV_TITLES.has(danhHieu);
        const isBk = UNIT_BK_TITLES.has(danhHieu);

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
        if (isBk && existing.danh_hieu && UNIT_DV_TITLES.has(existing.danh_hieu)) {
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
        if (!quanNhan.gioi_tinh || (quanNhan.gioi_tinh !== 'NAM' && quanNhan.gioi_tinh !== 'NU')) {
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
          if (serviceTime && serviceTime.years < 25) {
            errors.push(
              `Quân nhân "${quanNhan.ho_ten}" chưa đủ 25 năm phục vụ (hiện tại: ${serviceTime.years} năm)`
            );
          }
        }
      }
    }

    return errors;
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
    try {
      const errors: string[] = [];
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
        for (const item of titleData) {
          if (!item.loai || !['DTKH', 'SKKH'].includes(item.loai)) {
            errors.push(
              `Thành tích khoa học phải có loại là "DTKH" hoặc "SKKH" (quân nhân: ${item.personnel_id})`
            );
          }
          if (!item.mo_ta || item.mo_ta.trim() === '') {
            errors.push(`Thành tích khoa học phải có mô tả (quân nhân: ${item.personnel_id})`);
          }
        }
      }

      if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        const validDanhHieus = ['ĐVQT', 'ĐVTT', 'BKBQP', 'BKTTCP'];
        for (const item of titleData) {
          if (!item.danh_hieu || !validDanhHieus.includes(item.danh_hieu)) {
            errors.push(
              `Danh hiệu đơn vị không hợp lệ: ${
                item.danh_hieu
              }. Chỉ chấp nhận: ${validDanhHieus.join(', ')}`
            );
          }
        }
      }

      if (type === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
        const validDanhHieus = ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'];
        for (const item of titleData) {
          if (!item.danh_hieu || !validDanhHieus.includes(item.danh_hieu)) {
            errors.push(
              `Danh hiệu không hợp lệ: ${item.danh_hieu}. Chỉ chấp nhận: ${validDanhHieus.join(
                ', '
              )}`
            );
          }
        }
      }

      if (errors.length > 0) {
        throw new ValidationError(`Phát hiện lỗi validation:\n${errors.join('\n')}`);
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

        importedCount = result.details.created.length || selectedPersonnel.length;
        selectedPersonnel.forEach(id => affectedPersonnelIds.add(id));
      } else if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        for (const item of titleData) {
          try {
            await unitAnnualAwardService.upsert({
              don_vi_id: item.don_vi_id,
              nam: nam,
              danh_hieu: item.danh_hieu,
              so_quyet_dinh: item.so_quyet_dinh || null,
              ghi_chu: ghiChu || null,
              nguoi_tao_id: adminId,
            });
            importedCount++;
          } catch (error) {
            errors.push(
              `Lỗi khi thêm khen thưởng cho đơn vị ${item.don_vi_id}: ${(error as Error).message}`
            );
          }
        }
      } else if (type === PROPOSAL_TYPES.NCKH) {
        for (const item of titleData) {
          try {
            await scientificAchievementService.createAchievement({
              personnel_id: item.personnel_id,
              nam: nam,
              loai: item.loai,
              mo_ta: item.mo_ta,
              cap_bac: item.cap_bac || null,
              chuc_vu: item.chuc_vu || null,
              so_quyet_dinh: item.so_quyet_dinh || null,
              ghi_chu: ghiChu || null,
            });
            importedCount++;
            affectedPersonnelIds.add(item.personnel_id);
          } catch (error) {
            errors.push(
              `Lỗi khi thêm thành tích cho quân nhân ${item.personnel_id}: ${(error as Error).message}`
            );
          }
        }
      } else if (type === PROPOSAL_TYPES.HC_QKQT) {
        await prisma.$transaction(async tx => {
          for (const item of titleData) {
            const quanNhan = await tx.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              throw new NotFoundError(`Quân nhân (ID: ${item.personnel_id})`);
            }

            const thoiGian = this.calculateThoiGian(quanNhan);

            await tx.huanChuongQuanKyQuyetThang.upsert({
              where: { quan_nhan_id: item.personnel_id },
              create: {
                quan_nhan_id: item.personnel_id,
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
              update: {
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
            });

            importedCount++;
            affectedPersonnelIds.add(item.personnel_id);
          }
        });
      } else if (type === PROPOSAL_TYPES.NIEN_HAN) {
        const allowedDanhHieus = ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'];
        for (const item of titleData) {
          if (!item.danh_hieu) {
            errors.push(`Huy chương CSVV thiếu danh_hieu cho quân nhân ${item.personnel_id}`);
          } else if (!allowedDanhHieus.includes(item.danh_hieu)) {
            errors.push(
              `Danh hiệu "${item.danh_hieu}" không hợp lệ. Chỉ cho phép: ${allowedDanhHieus.join(', ')}`
            );
          }
        }
        if (errors.length > 0) {
          throw new ValidationError(`Phát hiện lỗi validation:\n${errors.join('\n')}`);
        }

        await prisma.$transaction(async tx => {
          for (const item of titleData) {
            const quanNhan = await tx.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              throw new NotFoundError(`Quân nhân (ID: ${item.personnel_id})`);
            }

            const thoiGian = this.calculateThoiGian(quanNhan);

            await tx.khenThuongHCCSVV.upsert({
              where: {
                quan_nhan_id_danh_hieu: {
                  quan_nhan_id: item.personnel_id,
                  danh_hieu: item.danh_hieu,
                },
              },
              create: {
                quan_nhan_id: item.personnel_id,
                danh_hieu: item.danh_hieu,
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
              update: {
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
            });

            importedCount++;
            affectedPersonnelIds.add(item.personnel_id);
          }
        });
      } else if (type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
        await prisma.$transaction(async tx => {
          for (const item of titleData) {
            const quanNhan = await tx.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              throw new NotFoundError(`Quân nhân (ID: ${item.personnel_id})`);
            }

            const thoiGian = this.calculateThoiGian(quanNhan);

            await tx.kyNiemChuongVSNXDQDNDVN.upsert({
              where: { quan_nhan_id: item.personnel_id },
              create: {
                quan_nhan_id: item.personnel_id,
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
              update: {
                nam: nam,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: ghiChu || null,
                so_quyet_dinh: item.so_quyet_dinh || null,
                thoi_gian: thoiGian,
              },
            });

            importedCount++;
            affectedPersonnelIds.add(item.personnel_id);
          }
        });
      } else if (type === PROPOSAL_TYPES.CONG_HIEN) {
        const allowedDanhHieus = ['HCBVTQ_HANG_BA', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_NHAT'];
        for (const item of titleData) {
          if (!item.danh_hieu) {
            errors.push(`HC BVTQ thiếu danh_hieu cho quân nhân ${item.personnel_id}`);
          } else if (!allowedDanhHieus.includes(item.danh_hieu)) {
            errors.push(
              `Danh hiệu "${item.danh_hieu}" không hợp lệ. Chỉ cho phép: ${allowedDanhHieus.join(', ')}`
            );
          }
        }
        if (errors.length > 0) {
          throw new ValidationError(`Phát hiện lỗi validation:\n${errors.join('\n')}`);
        }

        const baseRequiredMonths = 10 * 12;
        const femaleRequiredMonths = Math.round(baseRequiredMonths * (2 / 3));

        const congHienPersonnelIds = titleData.map(item => item.personnel_id).filter(Boolean);
        const positionHistoriesMap: Record<
          string,
          {
            he_so_chuc_vu: number;
            so_thang: number | null;
            ngay_bat_dau: Date;
            ngay_ket_thuc: Date | null;
          }[]
        > = {};
        const personnelGenderMap: Record<string, { gioi_tinh: string | null; ho_ten: string }> = {};

        for (const personnelId of congHienPersonnelIds) {
          try {
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: personnelId },
              select: { id: true, ho_ten: true, gioi_tinh: true },
            });

            if (quanNhan) {
              personnelGenderMap[personnelId] = {
                gioi_tinh: quanNhan.gioi_tinh,
                ho_ten: quanNhan.ho_ten,
              };
            }

            const histories = await prisma.lichSuChucVu.findMany({
              where: { quan_nhan_id: personnelId },
              select: {
                he_so_chuc_vu: true,
                so_thang: true,
                ngay_bat_dau: true,
                ngay_ket_thuc: true,
              },
            });

            const today = new Date();
            const updatedHistories = histories.map(item => {
              if (item.so_thang === null || item.so_thang === undefined) {
                if (item.ngay_bat_dau && !item.ngay_ket_thuc) {
                  const ngayBatDau = new Date(item.ngay_bat_dau);
                  let months = (today.getFullYear() - ngayBatDau.getFullYear()) * 12;
                  months += today.getMonth() - ngayBatDau.getMonth();
                  if (today.getDate() < ngayBatDau.getDate()) {
                    months--;
                  }
                  return {
                    ...item,
                    he_so_chuc_vu: Number(item.he_so_chuc_vu),
                    so_thang: Math.max(0, months),
                  };
                }
              }
              return { ...item, he_so_chuc_vu: Number(item.he_so_chuc_vu) };
            });

            positionHistoriesMap[personnelId] = updatedHistories;
          } catch {
            positionHistoriesMap[personnelId] = [];
          }
        }

        const getTotalMonthsByGroup = (personnelId: string, group: string) => {
          const histories = positionHistoriesMap[personnelId] || [];
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
          const info = personnelGenderMap[personnelId];
          return info && info.gioi_tinh === 'NU' ? femaleRequiredMonths : baseRequiredMonths;
        };

        const checkEligibleForRank = (personnelId: string, rank: string) => {
          const months0_9_1_0 = getTotalMonthsByGroup(personnelId, '0.9-1.0');
          const months0_8 = getTotalMonthsByGroup(personnelId, '0.8');
          const months0_7 = getTotalMonthsByGroup(personnelId, '0.7');
          const requiredMonths = getRequiredMonths(personnelId);

          if (rank === 'HANG_NHAT') {
            return months0_9_1_0 >= requiredMonths;
          } else if (rank === 'HANG_NHI') {
            return months0_8 + months0_9_1_0 >= requiredMonths;
          } else if (rank === 'HANG_BA') {
            return months0_7 + months0_8 + months0_9_1_0 >= requiredMonths;
          }
          return false;
        };

        const eligibleTitleData: TitleDataItem[] = [];
        for (const item of titleData) {
          if (!item.danh_hieu || !item.personnel_id) {
            eligibleTitleData.push(item);
            continue;
          }

          const info = personnelGenderMap[item.personnel_id];
          const hoTen = (info && info.ho_ten) || item.personnel_id;
          const gioiTinh = info && info.gioi_tinh;
          const requiredMonths = getRequiredMonths(item.personnel_id);

          let eligible = false;
          let rankName = '';

          if (item.danh_hieu === 'HCBVTQ_HANG_NHAT') {
            eligible = checkEligibleForRank(item.personnel_id, 'HANG_NHAT');
            rankName = 'Hạng Nhất';
          } else if (item.danh_hieu === 'HCBVTQ_HANG_NHI') {
            eligible = checkEligibleForRank(item.personnel_id, 'HANG_NHI');
            rankName = 'Hạng Nhì';
          } else if (item.danh_hieu === 'HCBVTQ_HANG_BA') {
            eligible = checkEligibleForRank(item.personnel_id, 'HANG_BA');
            rankName = 'Hạng Ba';
          }

          if (!eligible) {
            const months0_9_1_0 = getTotalMonthsByGroup(item.personnel_id, '0.9-1.0');
            const months0_8 = getTotalMonthsByGroup(item.personnel_id, '0.8');
            const months0_7 = getTotalMonthsByGroup(item.personnel_id, '0.7');

            let totalMonths = 0;
            if (item.danh_hieu === 'HCBVTQ_HANG_NHAT') {
              totalMonths = months0_9_1_0;
            } else if (item.danh_hieu === 'HCBVTQ_HANG_NHI') {
              totalMonths = months0_8 + months0_9_1_0;
            } else if (item.danh_hieu === 'HCBVTQ_HANG_BA') {
              totalMonths = months0_7 + months0_8 + months0_9_1_0;
            }

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

            const genderText = gioiTinh === 'NU' ? ' (Nu giam 1/3 thoi gian)' : '';

            errors.push(
              `Quan nhan "${hoTen}" khong du dieu kien Huan chuong Bao ve To quoc ${rankName}. ` +
                `Yeu cau: it nhat ${requiredYearsText}${genderText}. Hien tai: ${totalYearsText}.`
            );
            continue;
          }

          eligibleTitleData.push(item);
        }

        if (eligibleTitleData.length === 0 && errors.length > 0) {
          throw new ValidationError(`Phát hiện lỗi validation:\n${errors.join('\n')}`);
        }

        await prisma.$transaction(async tx => {
          for (const item of eligibleTitleData) {
            await tx.khenThuongCongHien.upsert({
              where: { quan_nhan_id: item.personnel_id },
              create: {
                quan_nhan_id: item.personnel_id,
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

      if (errors.length > 0 && importedCount === 0) {
        throw new AppError(`Thêm khen thưởng thất bại:\n${errors.join('\n')}`, 500);
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
        console.error('awardBulk notification failed:', e);
      }

      return {
        message:
          importedCount > 0
            ? `Đã thêm thành công ${importedCount} ${
                type === PROPOSAL_TYPES.DON_VI_HANG_NAM ? 'đơn vị' : 'quân nhân'
              }${errors.length > 0 ? `, ${errors.length} lỗi` : ''}`
            : 'Thêm khen thưởng thành công!',
        data: {
          importedCount,
          errorCount: errors.length,
          errors: errors.length > 0 ? errors : undefined,
          affectedPersonnelIds: Array.from(affectedPersonnelIds),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  calculateThoiGian(quanNhan: QuanNhan): Record<string, any> | null {
    if (!quanNhan.ngay_nhap_ngu) return null;

    const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
    const ngayKetThuc = quanNhan.ngay_xuat_ngu ? new Date(quanNhan.ngay_xuat_ngu) : new Date();

    let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
    months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
    if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
      months--;
    }
    months = Math.max(0, months);

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
