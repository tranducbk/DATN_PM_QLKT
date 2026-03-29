import { prisma } from '../models';
import { checkDuplicateAward, checkDuplicateUnitAward } from '../helpers/awardValidation';
import annualRewardService from './annualReward.service';
import unitAnnualAwardService from './unitAnnualAward.service';
import scientificAchievementService from './scientificAchievement.service';
import * as notificationHelper from '../helpers/notification';
import { getLoaiDeXuatName } from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES, type ProposalType } from '../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { AppError, NotFoundError, ValidationError } from '../middlewares/errorHandler';
import { writeSystemLog } from '../helpers/systemLogHelper';
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
    ngayNhapNgu: Date | string,
    ngayXuatNgu: Date | string | null = null
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

  async checkDuplicateAwards(type: string, nam: number, titleData: TitleDataItem[]) {
    const duplicateErrors: string[] = [];
    if (!titleData || titleData.length === 0) return duplicateErrors;

    const personnelIds = titleData
      .map(item => item.personnel_id)
      .filter(Boolean)
      .filter((id, index, self) => self.indexOf(id) === index);

    const personnelMap: Record<string, string> = {};
    if (personnelIds.length > 0) {
      const personnelList = await prisma.quanNhan.findMany({
        where: { id: { in: personnelIds } },
        select: { id: true, ho_ten: true },
      });
      personnelList.forEach(p => {
        personnelMap[p.id] = p.ho_ten;
      });
    }

    const duplicateChecks = titleData
      .filter(item => item.personnel_id && item.danh_hieu)
      .map(async item => {
        const checkResult = await checkDuplicateAward(
          item.personnel_id,
          nam,
          item.danh_hieu,
          type,
          type === PROPOSAL_TYPES.CONG_HIEN ? null : PROPOSAL_STATUS.APPROVED
        );
        if (checkResult.exists) {
          return {
            personnelId: item.personnel_id,
            hoTen: personnelMap[item.personnel_id] || item.personnel_id,
            message: checkResult.message,
          };
        }
        return null;
      });

    const results = await Promise.all(duplicateChecks);
    results.forEach(result => {
      if (result) {
        duplicateErrors.push(`${result.hoTen}: ${result.message}`);
      }
    });

    return duplicateErrors;
  }

  async checkDuplicateUnitAwards(nam: number, titleData: TitleDataItem[]) {
    const duplicateErrors: string[] = [];
    if (!titleData || titleData.length === 0) return duplicateErrors;

    for (const item of titleData) {
      if (item.don_vi_id && item.danh_hieu) {
        const checkResult = await checkDuplicateUnitAward(
          item.don_vi_id,
          nam,
          item.danh_hieu,
          PROPOSAL_TYPES.DON_VI_HANG_NAM
        );
        if (checkResult.exists) {
          duplicateErrors.push(`Đơn vị ${item.don_vi_id}: ${checkResult.message}`);
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
      } catch {
        // Không throw error để không ảnh hưởng đến quá trình thêm khen thưởng
      }

      const typeName = getLoaiDeXuatName(type);
      writeSystemLog({
        action: 'IMPORT',
        resource: 'awards',
        description: `[Bulk khen thưởng] ${typeName} năm ${nam}: ${importedCount} thành công, ${errors.length} lỗi`,
      });

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
