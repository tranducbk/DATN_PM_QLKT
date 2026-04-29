import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { danhHieuHangNamRepository } from '../repositories/danhHieu.repository';
import { contributionMedalRepository } from '../repositories/contributionMedal.repository';
import { accountRepository } from '../repositories/account.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import { positionRepository } from '../repositories/position.repository';
import { positionHistoryRepository } from '../repositories/positionHistory.repository';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../repositories/unit.repository';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import ExcelJS from 'exceljs';
import bcrypt from 'bcrypt';
import { parseCCCD } from '../helpers/cccdHelper';
import { ROLES } from '../constants/roles.constants';
import { GENDER } from '../constants/gender.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  AppError,
} from '../middlewares/errorHandler';
import profileService from './profile.service';
import * as notificationHelper from '../helpers/notification';
import { buildUnitWhereFilter } from '../helpers/controllerHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { DEFAULT_PASSWORD } from '../configs';
import { sanitizeRowData } from '../helpers/excel/excelHelper';
import { calculateTenureMonthsWithDayPrecision } from '../helpers/serviceYearsHelper';
import { PERSONNEL_EXPORT_COLUMNS } from '../constants/awardExcel.constants';

type DateInput = Date | null;

type AdjustTx = Prisma.TransactionClient | typeof prisma;

/** Increments or decrements the personnel count on a unit (CoQuanDonVi or DonViTrucThuoc). */
async function adjustUnitCount(
  tx: AdjustTx,
  unitId: string,
  isCoQuanDonVi: boolean,
  direction: 'increment' | 'decrement'
) {
  const repo = isCoQuanDonVi ? coQuanDonViRepository : donViTrucThuocRepository;
  if (direction === 'increment') {
    await repo.incrementSoLuong(unitId, tx);
  } else {
    await repo.decrementSoLuong(unitId, tx);
  }
}

interface UpdatePersonnelInput {
  unit_id?: string;
  position_id?: string;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  ho_ten?: string;
  gioi_tinh?: string | null;
  ngay_sinh?: DateInput;
  cccd?: string;
  cap_bac?: string | null;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
  que_quan_2_cap?: string | null;
  que_quan_3_cap?: string | null;
  tru_quan?: string | null;
  cho_o_hien_nay?: string | null;
  ngay_vao_dang?: DateInput;
  ngay_vao_dang_chinh_thuc?: DateInput;
  so_the_dang_vien?: string | null;
  so_dien_thoai?: string | null;
}

class PersonnelService {
  parseCCCD(value) {
    return parseCCCD(value);
  }

  /**
   * Returns a paginated personnel list.
   * Admin can view all records.
   * Manager can only view records in their allowed units.
   */
  async getPersonnel(
    page = 1,
    limit = 10,
    userRole,
    userQuanNhanId,
    filters: Record<string, unknown> = {}
  ) {
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;
    const search = typeof filters.search === 'string' ? filters.search : undefined;
    const unit_id = typeof filters.unit_id === 'string' ? filters.unit_id : undefined;
    let whereCondition: Prisma.QuanNhanWhereInput = {};
    const andConditions = [];

    // Manager can only query personnel inside their unit scope.
    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const manager = await quanNhanRepository.findUnitScope(userQuanNhanId);

      if (manager) {
        const unitFilter = await buildUnitWhereFilter(manager);
        if (unitFilter) andConditions.push(unitFilter);
      }
    }

    // Optional unit filter (parent unit or child unit).
    if (unit_id) {
      const unitFilter = await buildUnitWhereFilter({ co_quan_don_vi_id: unit_id });
      if (unitFilter) andConditions.push(unitFilter);
    }

    // Optional keyword search by name or CCCD.
    if (search && search.trim()) {
      const searchTerm = search.trim();
      andConditions.push({
        OR: [
          { ho_ten: { contains: searchTerm, mode: 'insensitive' } },
          { cccd: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    // Combine all filters with AND conditions.
    if (andConditions.length > 0) {
      whereCondition = {
        AND: andConditions,
      };
    }

    const [personnel, total] = await Promise.all([
      quanNhanRepository.findMany({ where: whereCondition, skip, take: limitNum }),
      quanNhanRepository.count(whereCondition),
    ]);

    return {
      personnel,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /** Returns one personnel record by id. */
  async getPersonnelById(id, userRole, userQuanNhanId) {
    const personnel = await quanNhanRepository.findByIdForDetail(String(id));

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // USER can only view their own profile.
    if (userRole === ROLES.USER && userQuanNhanId !== id) {
      throw new ForbiddenError('Bạn không có quyền xem thông tin này');
    }

    // MANAGER can only view personnel in their unit scope.
    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const manager = await quanNhanRepository.findUnitScope(userQuanNhanId);

      if (manager && manager.co_quan_don_vi_id) {
        // Load all child units of manager's parent unit.
        const donViTrucThuocList = await donViTrucThuocRepository.findIdsByCoQuanDonViId(
          manager.co_quan_don_vi_id
        );
        const donViTrucThuocIds = donViTrucThuocList.map(dv => dv.id);

        // Allow if personnel belongs to parent unit or any child unit.
        const isInCoQuanDonVi = personnel.co_quan_don_vi_id === manager.co_quan_don_vi_id;
        const isInDonViTrucThuoc =
          personnel.don_vi_truc_thuoc_id &&
          donViTrucThuocIds.includes(personnel.don_vi_truc_thuoc_id);

        if (!isInCoQuanDonVi && !isInDonViTrucThuoc) {
          throw new ForbiddenError('Bạn không có quyền xem thông tin quân nhân ngoài đơn vị');
        }
      }
    }

    return personnel;
  }

  /** Creates a new personnel and auto-creates its account. */
  async createPersonnel(data) {
    const { cccd, unit_id, position_id, role = ROLES.USER } = data;

    const existingPersonnel = await quanNhanRepository.findIdByCccd(cccd);

    if (existingPersonnel) {
      throw new ValidationError('CCCD đã tồn tại trong hệ thống');
    }

    // Unit can be either CoQuanDonVi or DonViTrucThuoc.
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      coQuanDonViRepository.findById(unit_id),
      donViTrucThuocRepository.findById(unit_id),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new NotFoundError('Đơn vị');
    }

    const position = await positionRepository.findUniqueRaw({
      where: { id: position_id },
      select: { id: true },
    });

    if (!position) {
      throw new NotFoundError('Chức vụ');
    }

    const username = cccd;

    const existingAccount = await accountRepository.findUniqueRaw({
      where: { username },
      select: { id: true },
    });

    if (existingAccount) {
      throw new ValidationError('Username (CCCD) đã tồn tại trong hệ thống tài khoản');
    }

    // Set unit foreign keys based on unit type.
    const isCoQuanDonVi = !!coQuanDonVi;
    let personnelData: Prisma.QuanNhanUncheckedCreateInput = {
      cccd,
      ho_ten: username,
      ngay_sinh: null,
      ngay_nhap_ngu: new Date(),
      chuc_vu_id: position_id,
    };

    if (isCoQuanDonVi) {
      personnelData.co_quan_don_vi_id = unit_id;
      personnelData.don_vi_truc_thuoc_id = null;
    } else {
      personnelData.co_quan_don_vi_id = null;
      personnelData.don_vi_truc_thuoc_id = unit_id;
    }

    // Hash password outside transaction to reduce lock duration.
    const defaultPassword = DEFAULT_PASSWORD || 'Hvkhqs@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Wrap all writes in one transaction for consistency.
    const result = await prisma.$transaction(async prismaTx => {
      const newPersonnel = await quanNhanRepository.create(personnelData, prismaTx);

      // Load position coefficient for initial history row.
      const chucVu = await positionRepository.findUniqueRaw({
        where: { id: position_id },
        select: { he_so_chuc_vu: true },
      }, prismaTx);

      // Create initial LichSuChucVu record.
      const ngayBatDau = new Date();
      await positionHistoryRepository.create(
        {
          quan_nhan_id: newPersonnel.id,
          chuc_vu_id: position_id,
          he_so_chuc_vu: Number(chucVu?.he_so_chuc_vu ?? 0),
          ngay_bat_dau: ngayBatDau,
          ngay_ket_thuc: null,
          so_thang: null,
        },
        prismaTx
      );

      // Create linked account.
      const account = await prismaTx.taiKhoan.create({
        data: {
          username,
          password_hash: hashedPassword,
          role: role,
          quan_nhan_id: newPersonnel.id,
        },
      });

      await adjustUnitCount(prismaTx, unit_id, isCoQuanDonVi, 'increment');

      // Return personnel with account data.
      return {
        ...newPersonnel,
        TaiKhoan: {
          id: account.id,
          username: account.username,
          role: account.role,
        },
      };
    });

    return result;
  }

  /** Updates personnel data, including unit and position reassignment. */
  async updatePersonnel(
    id: string,
    data: UpdatePersonnelInput,
    userRole: string,
    userQuanNhanId: string,
    adminUsername: string
  ) {
    const {
      unit_id,
      position_id,
      co_quan_don_vi_id,
      don_vi_truc_thuoc_id,
      ho_ten,
      gioi_tinh,
      ngay_sinh,
      cccd,
      cap_bac,
      ngay_nhap_ngu,
      ngay_xuat_ngu,
      que_quan_2_cap,
      que_quan_3_cap,
      tru_quan,
      cho_o_hien_nay,
      ngay_vao_dang,
      ngay_vao_dang_chinh_thuc,
      so_the_dang_vien,
      so_dien_thoai,
    } = data;
    const unitId = unit_id;
    const positionId = position_id;
    const coQuanDonViId = co_quan_don_vi_id ?? undefined;
    const donViTrucThuocId = don_vi_truc_thuoc_id ?? undefined;
    const cccdValue = cccd;

    const personnel = await quanNhanRepository.findByIdWithAccountRole(String(id));

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    if (userRole === ROLES.MANAGER && userQuanNhanId !== id) {
      const targetRole = personnel.TaiKhoan?.role;
      if (targetRole === ROLES.MANAGER) {
        throw new ForbiddenError('Bạn không có quyền sửa thông tin của quản lý khác');
      }
    }

    // USER can only edit their own profile.
    if (userRole === ROLES.USER) {
      if (userQuanNhanId !== id) {
        throw new ForbiddenError('Bạn không có quyền sửa thông tin của người khác');
      }

      // USER cannot change unit_id or position_id.
      if (unitId || positionId) {
        throw new ForbiddenError('Bạn không có quyền thay đổi đơn vị hoặc chức vụ');
      }
    }

    // MANAGER can only edit personnel in their unit scope.
    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const manager = await quanNhanRepository.findUnitScope(userQuanNhanId);

      if (manager) {
        let hasPermission = false;

        // Case 1: manager belongs to a parent unit.
        if (manager.co_quan_don_vi_id && !manager.don_vi_truc_thuoc_id) {
          if (personnel.co_quan_don_vi_id === manager.co_quan_don_vi_id) {
            hasPermission = true;
          } else if (personnel.don_vi_truc_thuoc_id) {
            // Check if personnel child unit belongs to manager parent unit.
            const donViTrucThuoc = await donViTrucThuocRepository.findCoQuanDonViIdById(
              personnel.don_vi_truc_thuoc_id
            );
            if (donViTrucThuoc && donViTrucThuoc.co_quan_don_vi_id === manager.co_quan_don_vi_id) {
              hasPermission = true;
            }
          }
        }
        // Case 2: manager belongs to a child unit.
        else if (manager.don_vi_truc_thuoc_id) {
          if (personnel.don_vi_truc_thuoc_id === manager.don_vi_truc_thuoc_id) {
            hasPermission = true;
          } else if (personnel.co_quan_don_vi_id) {
            // Check if personnel parent unit matches manager parent unit.
            const managerDonViTrucThuoc = await donViTrucThuocRepository.findCoQuanDonViIdById(
              manager.don_vi_truc_thuoc_id
            );
            if (
              managerDonViTrucThuoc &&
              personnel.co_quan_don_vi_id === managerDonViTrucThuoc.co_quan_don_vi_id
            ) {
              hasPermission = true;
            }
          }
        }

        if (!hasPermission) {
          throw new ForbiddenError('Bạn không có quyền sửa thông tin quân nhân ngoài đơn vị');
        }
      }
    }

    // Re-check CCCD uniqueness when changed.
    if (cccdValue && cccdValue !== personnel.cccd) {
      const existingPersonnel = await quanNhanRepository.findIdByCccd(cccdValue);

      if (existingPersonnel) {
        throw new ValidationError('CCCD đã tồn tại trong hệ thống');
      }
    }

    const currentUnitId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
    if (unitId && unitId !== currentUnitId) {
      const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
        coQuanDonViRepository.findIdById(unitId),
        donViTrucThuocRepository.findIdById(unitId),
      ]);

      if (!coQuanDonVi && !donViTrucThuoc) {
        throw new NotFoundError('Đơn vị');
      }
    }

    if (positionId && positionId !== personnel.chuc_vu_id) {
      const position = await positionRepository.findUniqueRaw({
        where: { id: positionId },
        select: { id: true },
      });

      if (!position) {
        throw new NotFoundError('Chức vụ');
      }
    }

    // Gender is required on update.
    if (gioi_tinh !== undefined) {
      if (!gioi_tinh || (gioi_tinh !== GENDER.MALE && gioi_tinh !== GENDER.FEMALE)) {
        throw new ValidationError('Giới tính là bắt buộc và phải là NAM hoặc NU');
      }
    } else if (!personnel.gioi_tinh) {
      throw new ValidationError('Giới tính là bắt buộc. Vui lòng cập nhật thông tin giới tính.');
    }

    // Prepare update payload — only include fields that were explicitly provided.
    const updateData: Prisma.QuanNhanUncheckedUpdateInput = {
      ...(ho_ten !== undefined && { ho_ten }),
      ...(gioi_tinh !== undefined && { gioi_tinh }),
      ...(ngay_sinh !== undefined && { ngay_sinh }),
      ...(cccd !== undefined && { cccd: cccdValue }),
      ...(cap_bac !== undefined && { cap_bac }),
      ...(ngay_nhap_ngu !== undefined && { ngay_nhap_ngu }),
      ...(ngay_xuat_ngu !== undefined && { ngay_xuat_ngu }),
      ...(que_quan_2_cap !== undefined && { que_quan_2_cap }),
      ...(que_quan_3_cap !== undefined && { que_quan_3_cap }),
      ...(tru_quan !== undefined && { tru_quan }),
      ...(cho_o_hien_nay !== undefined && { cho_o_hien_nay }),
      ...(ngay_vao_dang !== undefined && { ngay_vao_dang }),
      ...(ngay_vao_dang_chinh_thuc !== undefined && { ngay_vao_dang_chinh_thuc }),
      ...(so_the_dang_vien !== undefined && { so_the_dang_vien }),
      ...(so_dien_thoai !== undefined && { so_dien_thoai }),
      chuc_vu_id: positionId || personnel.chuc_vu_id,
    };

    // Unit assignment priority: explicit ids from frontend first.
    if (co_quan_don_vi_id !== undefined || don_vi_truc_thuoc_id !== undefined) {
      // Auto-fill parent unit when child unit is provided.
      if (donViTrucThuocId) {
        const donViTrucThuoc = await donViTrucThuocRepository.findCoQuanDonViIdById(donViTrucThuocId);

        if (donViTrucThuoc) {
          updateData.co_quan_don_vi_id = donViTrucThuoc.co_quan_don_vi_id;
          updateData.don_vi_truc_thuoc_id = donViTrucThuocId;
        } else {
          throw new NotFoundError('Đơn vị trực thuộc');
        }
      } else if (coQuanDonViId) {
        updateData.co_quan_don_vi_id = coQuanDonViId;
        updateData.don_vi_truc_thuoc_id = null;
      } else {
        updateData.co_quan_don_vi_id =
          coQuanDonViId !== undefined ? coQuanDonViId : personnel.co_quan_don_vi_id;
        updateData.don_vi_truc_thuoc_id = null;
      }
    } else if (unitId && unitId !== currentUnitId) {
      const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
        coQuanDonViRepository.findById(unitId),
        donViTrucThuocRepository.findIdAndParentById(unitId),
      ]);

      if (coQuanDonVi) {
        updateData.co_quan_don_vi_id = unitId;
        updateData.don_vi_truc_thuoc_id = null;
      } else if (donViTrucThuoc) {
        updateData.co_quan_don_vi_id = donViTrucThuoc.co_quan_don_vi_id;
        updateData.don_vi_truc_thuoc_id = unitId;
      }
    } else {
      // Keep current unit mapping.
      updateData.co_quan_don_vi_id = personnel.co_quan_don_vi_id;
      updateData.don_vi_truc_thuoc_id = personnel.don_vi_truc_thuoc_id;
    }

    // Use transaction to keep all writes consistent.
    const { updatedPersonnel, unitTransferInfo } = await prisma.$transaction(async prismaTx => {
      const txUpdatedPersonnel = await quanNhanRepository.update(String(id), updateData, prismaTx);

      // If position changed, close old history and create new history row.
      if (positionId && positionId !== personnel.chuc_vu_id) {
        const today = new Date();

        const oldHistories = await prismaTx.lichSuChucVu.findMany({
          where: {
            quan_nhan_id: id,
            ngay_ket_thuc: null,
          },
        });

        for (const oldHistory of oldHistories) {
          const ngayBatDauOld = new Date(oldHistory.ngay_bat_dau);
          const soThangOld = calculateTenureMonthsWithDayPrecision(ngayBatDauOld, today);

          await prismaTx.lichSuChucVu.update({
            where: { id: oldHistory.id },
            data: {
              ngay_ket_thuc: today,
              so_thang: soThangOld,
            },
          });
        }

        const newChucVu = await prismaTx.chucVu.findUnique({
          where: { id: positionId },
          select: { he_so_chuc_vu: true },
        });

        await prismaTx.lichSuChucVu.create({
          data: {
            quan_nhan_id: id,
            chuc_vu_id: positionId,
            he_so_chuc_vu: Number(newChucVu?.he_so_chuc_vu ?? 0),
            ngay_bat_dau: today,
            ngay_ket_thuc: null,
            so_thang: null,
          },
        });
      }

      let txUnitTransferInfo = null;

      const oldCoQuanDonViId = personnel.co_quan_don_vi_id;
      const oldDonViTrucThuocId = personnel.don_vi_truc_thuoc_id;
      const newCoQuanDonViId = updateData.co_quan_don_vi_id as string | null | undefined;
      const newDonViTrucThuocId = updateData.don_vi_truc_thuoc_id as string | null | undefined;

      const coQuanDonViChanged = oldCoQuanDonViId !== newCoQuanDonViId;
      const donViTrucThuocChanged = oldDonViTrucThuocId !== newDonViTrucThuocId;
      const unitChanged = coQuanDonViChanged || donViTrucThuocChanged;

      if (unitChanged) {
        let oldUnitInfo = null;
        let newUnitInfo = null;

        // DVTT takes priority over CQDV when determining effective unit
        const oldPrimaryUnitId = oldDonViTrucThuocId || oldCoQuanDonViId;
        const oldIsCqdv = !oldDonViTrucThuocId && !!oldCoQuanDonViId;
        if (oldPrimaryUnitId) {
          const oldUnit = oldIsCqdv
            ? await coQuanDonViRepository.findNameById(oldPrimaryUnitId, prismaTx)
            : await donViTrucThuocRepository.findNameById(oldPrimaryUnitId, prismaTx);
          if (oldUnit) {
            oldUnitInfo = { id: oldUnit.id, ten_don_vi: oldUnit.ten_don_vi, isCoQuanDonVi: oldIsCqdv };
            await adjustUnitCount(prismaTx, oldPrimaryUnitId, oldIsCqdv, 'decrement');
          }
        }

        const newPrimaryUnitId = newDonViTrucThuocId || newCoQuanDonViId;
        const newIsCqdv = !newDonViTrucThuocId && !!newCoQuanDonViId;
        if (newPrimaryUnitId) {
          const newUnit = newIsCqdv
            ? await coQuanDonViRepository.findNameById(newPrimaryUnitId, prismaTx)
            : await donViTrucThuocRepository.findNameById(newPrimaryUnitId, prismaTx);
          if (newUnit) {
            newUnitInfo = { id: newUnit.id, ten_don_vi: newUnit.ten_don_vi, isCoQuanDonVi: newIsCqdv };
            await adjustUnitCount(prismaTx, newPrimaryUnitId, newIsCqdv, 'increment');
          }
        }

        // Keep transfer info for response and notification.
        if (oldUnitInfo || newUnitInfo) {
          txUnitTransferInfo = {
            oldUnit: oldUnitInfo,
            newUnit: newUnitInfo,
          };
        }
      }

      return { updatedPersonnel: txUpdatedPersonnel, unitTransferInfo: txUnitTransferInfo };
    });

    // Recalculate profile outside transaction.
    try {
      await profileService.recalculateAnnualProfile(id);
    } catch (recalcError) {
      void writeSystemLog({ action: 'ERROR', resource: 'personnel', description: `Lỗi tính lại hồ sơ hằng năm quân nhân ${id}: ${recalcError}` });
    }

    // Send transfer notification outside transaction.
    if (unitTransferInfo && adminUsername) {
      try {
        await notificationHelper.notifyOnPersonnelTransfer(
          updatedPersonnel,
          unitTransferInfo.oldUnit,
          unitTransferInfo.newUnit,
          adminUsername
        );
      } catch (notifError) {
        void writeSystemLog({ action: 'ERROR', resource: 'personnel', description: `Lỗi gửi thông báo chuyển đơn vị quân nhân ${id}: ${notifError}` });
      }
    }

    // Return updated data with transfer details.
    return {
      ...updatedPersonnel,
      unitTransferInfo,
    };
  }

  /**
   * Deletes personnel and all related records through cascade constraints.
   * Cascade covers accounts, histories, awards, and annual profile snapshots.
   */
  async deletePersonnel(id, userRole, userQuanNhanId) {
    const personnel = await quanNhanRepository.findByIdWithAccount(String(id));

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // Only ADMIN and SUPER_ADMIN can delete personnel.
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Chỉ Admin mới có quyền xóa quân nhân');
    }

    // Prevent self-delete.
    if (userQuanNhanId === id) {
      throw new ValidationError('Không thể xóa chính mình');
    }

    // Keep unit id to adjust personnel count after delete.
    const unitId = personnel.don_vi_truc_thuoc_id || personnel.co_quan_don_vi_id;
    const isCoQuanDonVi = !personnel.don_vi_truc_thuoc_id && !!personnel.co_quan_don_vi_id;

    // Use transaction for full cascade delete.
    await prisma.$transaction(async prismaTx => {
      // Delete linked account.
      if (personnel.TaiKhoan) {
        await prismaTx.taiKhoan.delete({
          where: { id: personnel.TaiKhoan.id },
        });
      }

      // Delete position history.
      await prismaTx.lichSuChucVu.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete scientific achievements.
      await prismaTx.thanhTichKhoaHoc.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete annual titles.
      await danhHieuHangNamRepository.deleteManyByPersonnelId(id, prismaTx);

      // Delete contribution awards.
      await prismaTx.khenThuongHCBVTQ.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete HC_QKQT awards.
      await prismaTx.huanChuongQuanKyQuyetThang.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete KNC_VSNXD_QDNDVN awards.
      await prismaTx.kyNiemChuongVSNXDQDNDVN.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete HCCSVV awards.
      await prismaTx.khenThuongHCCSVV.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete ad-hoc awards.
      await prismaTx.khenThuongDotXuat.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete tenure profiles.
      await prismaTx.hoSoNienHan.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete contribution profiles.
      await prismaTx.hoSoCongHien.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete annual profiles.
      await prismaTx.hoSoHangNam.deleteMany({
        where: { quan_nhan_id: id },
      });

      // Delete personnel row.
      await quanNhanRepository.delete(String(id), prismaTx);

      if (unitId) {
        try {
          await adjustUnitCount(prismaTx, unitId, isCoQuanDonVi, 'decrement');
        } catch (error) {
          throw new AppError(
            `Không thể cập nhật số lượng quân nhân của đơn vị: ${error.message}`,
            500
          );
        }
      }
    });

    return {
      message: 'Xóa quân nhân và toàn bộ dữ liệu liên quan thành công',
      ho_ten: personnel.ho_ten,
      cccd: personnel.cccd,
    };
  }

  /**
   * Exports all personnel data to an Excel buffer.
   * @returns Excel workbook buffer.
   */
  async exportPersonnel() {
    const personnel = await quanNhanRepository.findAllForExport();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('QuanNhan');

    worksheet.columns = [...PERSONNEL_EXPORT_COLUMNS];

    // Keep CCCD as text to preserve leading zeros.
    worksheet.getColumn(1).numFmt = '@';

    personnel.forEach(p => {
      worksheet.addRow(
        sanitizeRowData({
          cccd: p.cccd,
          ho_ten: p.ho_ten,
          ngay_sinh: p.ngay_sinh ? new Date(p.ngay_sinh).toISOString().slice(0, 10) : '',
          ngay_nhap_ngu: p.ngay_nhap_ngu
            ? new Date(p.ngay_nhap_ngu).toISOString().slice(0, 10)
            : '',
          ma_don_vi: (p.DonViTrucThuoc || p.CoQuanDonVi)?.ma_don_vi || '',
          ten_don_vi: (p.DonViTrucThuoc || p.CoQuanDonVi)?.ten_don_vi || '',
          ten_chuc_vu: p.ChucVu?.ten_chuc_vu || '',
          is_manager: p.ChucVu?.is_manager ? 'TRUE' : 'FALSE',
          he_so_chuc_vu: p.ChucVu?.he_so_chuc_vu || '',
        })
      );
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /**
   * Checks contribution-award eligibility.
   * Returns personnel already awarded or currently pending approval.
   * @param personnelIds - Personnel ids to validate.
   * @returns Ineligible personnel with reason and status.
   */
  async checkContributionEligibility(personnelIds: string[]) {
    const ineligiblePersonnel = [];

    const [existingAwards, pendingProposals] = await Promise.all([
      contributionMedalRepository.findManyRaw({
        where: { quan_nhan_id: { in: personnelIds } },
      }),
      proposalRepository.findManyRaw({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.CONG_HIEN,
          status: PROPOSAL_STATUS.PENDING,
        },
        select: {
          id: true,
          data_cong_hien: true,
          nam: true,
        },
      }),
    ]);

    const awardByPersonnelId = new Map(existingAwards.map(a => [a.quan_nhan_id, a]));

    // Build a map: personnelId -> first pending proposal that contains them.
    const pendingByPersonnelId = new Map<string, { id: string; nam: number }>();
    for (const proposal of pendingProposals) {
      if (!proposal.data_cong_hien) continue;
      const congHienList = Array.isArray(proposal.data_cong_hien)
        ? (proposal.data_cong_hien as Array<Record<string, unknown>>)
        : [];
      for (const item of congHienList) {
        const pid = item.personnel_id as string | undefined;
        if (pid && !pendingByPersonnelId.has(pid)) {
          pendingByPersonnelId.set(pid, { id: proposal.id, nam: proposal.nam });
        }
      }
    }

    for (const personnelId of personnelIds) {
      const existingAward = awardByPersonnelId.get(personnelId);
      if (existingAward) {
        ineligiblePersonnel.push({
          personnelId,
          reason: 'Đã nhận Huân chương Bảo vệ Tổ quốc',
          status: PROPOSAL_STATUS.APPROVED,
          awardYear: existingAward.nam,
          awardTitle: existingAward.danh_hieu,
        });
        continue;
      }

      const pendingProposal = pendingByPersonnelId.get(personnelId);
      if (pendingProposal) {
        ineligiblePersonnel.push({
          personnelId,
          reason: 'Đang chờ duyệt đề xuất Huân chương Bảo vệ Tổ quốc',
          status: PROPOSAL_STATUS.PENDING,
          proposalId: pendingProposal.id,
          proposalYear: pendingProposal.nam,
        });
      }
    }

    return {
      ineligiblePersonnel,
      eligibleCount: personnelIds.length - ineligiblePersonnel.length,
      totalChecked: personnelIds.length,
    };
  }
}

export default new PersonnelService();
