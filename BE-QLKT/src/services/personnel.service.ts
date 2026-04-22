import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import ExcelJS from 'exceljs';
import { loadWorkbook, getAndValidateWorksheet } from '../helpers/excelImportHelper';
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
import { sanitizeRowData } from '../helpers/excelHelper';
import { calculateTenureMonthsWithDayPrecision } from '../helpers/serviceYearsHelper';

type DateInput = Date | null;

const personnelInclude = {
  CoQuanDonVi: true,
  DonViTrucThuoc: { include: { CoQuanDonVi: true } },
  ChucVu: true,
} as const;

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
      const manager = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

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
      prisma.quanNhan.findMany({
        where: whereCondition,
        skip,
        take: limitNum,
        include: personnelInclude,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quanNhan.count({ where: whereCondition }),
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
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: String(id) },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
        ChucVu: true,
        TaiKhoan: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // USER can only view their own profile.
    if (userRole === ROLES.USER && userQuanNhanId !== id) {
      throw new ForbiddenError('Bạn không có quyền xem thông tin này');
    }

    // MANAGER can only view personnel in their unit scope.
    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const manager = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (manager && manager.co_quan_don_vi_id) {
        // Load all child units of manager's parent unit.
        const donViTrucThuocList = await prisma.donViTrucThuoc.findMany({
          where: { co_quan_don_vi_id: manager.co_quan_don_vi_id },
          select: { id: true },
        });
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

    const existingPersonnel = await prisma.quanNhan.findUnique({
      where: { cccd },
      select: { id: true },
    });

    if (existingPersonnel) {
      throw new ValidationError('CCCD đã tồn tại trong hệ thống');
    }

    // Unit can be either CoQuanDonVi or DonViTrucThuoc.
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({ where: { id: unit_id } }),
      prisma.donViTrucThuoc.findUnique({ where: { id: unit_id } }),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new NotFoundError('Đơn vị');
    }

    const position = await prisma.chucVu.findUnique({
      where: { id: position_id },
      select: { id: true },
    });

    if (!position) {
      throw new NotFoundError('Chức vụ');
    }

    const username = cccd;

    const existingAccount = await prisma.taiKhoan.findUnique({
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
      const newPersonnel = await prismaTx.quanNhan.create({
        data: personnelData,
        include: personnelInclude,
      });

      // Load position coefficient for initial history row.
      const chucVu = await prismaTx.chucVu.findUnique({
        where: { id: position_id },
        select: { he_so_chuc_vu: true },
      });

      // Create initial LichSuChucVu record.
      const ngayBatDau = new Date();
      await prismaTx.lichSuChucVu.create({
        data: {
          quan_nhan_id: newPersonnel.id,
          chuc_vu_id: position_id,
          he_so_chuc_vu: Number(chucVu?.he_so_chuc_vu ?? 0),
          ngay_bat_dau: ngayBatDau,
          ngay_ket_thuc: null,
          so_thang: null, // null = ongoing, calculated when position ends
        },
      });

      // Create linked account.
      const account = await prismaTx.taiKhoan.create({
        data: {
          username,
          password_hash: hashedPassword,
          role: role,
          quan_nhan_id: newPersonnel.id,
        },
      });

      // Update unit personnel count.
      if (isCoQuanDonVi) {
        await prismaTx.coQuanDonVi.update({
          where: { id: unit_id },
          data: { so_luong: { increment: 1 } },
        });
      } else {
        await prismaTx.donViTrucThuoc.update({
          where: { id: unit_id },
          data: { so_luong: { increment: 1 } },
        });
      }

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

  /**
   * Cập nhật quân nhân (chuyển đơn vị, chức vụ)
   */
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

    const personnel = await prisma.quanNhan.findUnique({
      where: { id: String(id) },
      include: { TaiKhoan: { select: { role: true } } },
    });

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
      const manager = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (manager) {
        let hasPermission = false;

        // Case 1: manager belongs to a parent unit.
        if (manager.co_quan_don_vi_id && !manager.don_vi_truc_thuoc_id) {
          if (personnel.co_quan_don_vi_id === manager.co_quan_don_vi_id) {
            hasPermission = true;
          } else if (personnel.don_vi_truc_thuoc_id) {
            // Check if personnel child unit belongs to manager parent unit.
            const donViTrucThuoc = await prisma.donViTrucThuoc.findUnique({
              where: { id: personnel.don_vi_truc_thuoc_id },
              select: { co_quan_don_vi_id: true },
            });
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
            const managerDonViTrucThuoc = await prisma.donViTrucThuoc.findUnique({
              where: { id: manager.don_vi_truc_thuoc_id },
              select: { co_quan_don_vi_id: true },
            });
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
      const existingPersonnel = await prisma.quanNhan.findUnique({
        where: { cccd: cccdValue },
        select: { id: true },
      });

      if (existingPersonnel) {
        throw new ValidationError('CCCD đã tồn tại trong hệ thống');
      }
    }

    const currentUnitId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
    if (unitId && unitId !== currentUnitId) {
      const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
        prisma.coQuanDonVi.findUnique({ where: { id: unitId }, select: { id: true } }),
        prisma.donViTrucThuoc.findUnique({ where: { id: unitId }, select: { id: true } }),
      ]);

      if (!coQuanDonVi && !donViTrucThuoc) {
        throw new NotFoundError('Đơn vị');
      }
    }

    if (positionId && positionId !== personnel.chuc_vu_id) {
      const position = await prisma.chucVu.findUnique({
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
        const donViTrucThuoc = await prisma.donViTrucThuoc.findUnique({
          where: { id: donViTrucThuocId },
          select: { co_quan_don_vi_id: true },
        });

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
        prisma.coQuanDonVi.findUnique({ where: { id: unitId } }),
        prisma.donViTrucThuoc.findUnique({
          where: { id: unitId },
          select: { id: true, co_quan_don_vi_id: true },
        }),
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
      const txUpdatedPersonnel = await prismaTx.quanNhan.update({
        where: { id: String(id) },
        data: updateData,
        include: personnelInclude,
      });

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

        // Resolve old primary unit (child unit first).
        const oldPrimaryUnitId = oldDonViTrucThuocId || oldCoQuanDonViId;
        if (oldPrimaryUnitId) {
          if (oldDonViTrucThuocId) {
            const oldDvtt = await prismaTx.donViTrucThuoc.findUnique({
              where: { id: oldDonViTrucThuocId },
              select: { id: true, ten_don_vi: true },
            });
            if (oldDvtt) {
              oldUnitInfo = {
                id: oldDvtt.id,
                ten_don_vi: oldDvtt.ten_don_vi,
                isCoQuanDonVi: false,
              };
              await prismaTx.donViTrucThuoc.update({
                where: { id: oldDonViTrucThuocId },
                data: { so_luong: { decrement: 1 } },
              });
            }
          } else if (oldCoQuanDonViId) {
            const oldCqDv = await prismaTx.coQuanDonVi.findUnique({
              where: { id: oldCoQuanDonViId },
              select: { id: true, ten_don_vi: true },
            });
            if (oldCqDv) {
              oldUnitInfo = { id: oldCqDv.id, ten_don_vi: oldCqDv.ten_don_vi, isCoQuanDonVi: true };
              await prismaTx.coQuanDonVi.update({
                where: { id: oldCoQuanDonViId },
                data: { so_luong: { decrement: 1 } },
              });
            }
          }
        }

        // Resolve new primary unit (child unit first).
        const newPrimaryUnitId = newDonViTrucThuocId || newCoQuanDonViId;
        if (newPrimaryUnitId) {
          if (newDonViTrucThuocId) {
            const newDvtt = await prismaTx.donViTrucThuoc.findUnique({
              where: { id: newDonViTrucThuocId },
              select: { id: true, ten_don_vi: true },
            });
            if (newDvtt) {
              newUnitInfo = {
                id: newDvtt.id,
                ten_don_vi: newDvtt.ten_don_vi,
                isCoQuanDonVi: false,
              };
              await prismaTx.donViTrucThuoc.update({
                where: { id: newDonViTrucThuocId },
                data: { so_luong: { increment: 1 } },
              });
            }
          } else if (newCoQuanDonViId) {
            const newCqDv = await prismaTx.coQuanDonVi.findUnique({
              where: { id: newCoQuanDonViId },
              select: { id: true, ten_don_vi: true },
            });
            if (newCqDv) {
              newUnitInfo = { id: newCqDv.id, ten_don_vi: newCqDv.ten_don_vi, isCoQuanDonVi: true };
              await prismaTx.coQuanDonVi.update({
                where: { id: newCoQuanDonViId },
                data: { so_luong: { increment: 1 } },
              });
            }
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
      console.error('[personnel] recalculateAnnualProfile error:', recalcError);
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
        console.error('[personnel] notifyOnPersonnelTransfer error:', notifError);
      }
    }

    // Return updated data with transfer details.
    return {
      ...updatedPersonnel,
      unitTransferInfo,
    };
  }

  /**
   * Xóa quân nhân và tất cả dữ liệu liên quan
   * Cascade delete: TaiKhoan, LichSuChucVu, ThanhTichKhoaHoc, DanhHieuHangNam,
   * KhenThuongHCBVTQ, HuanChuongQuanKyQuyetThang, KyNiemChuongVSNXDQDNDVN,
   * KhenThuongHCCSVV, KhenThuongDotXuat, HoSoNienHan, HoSoCongHien, HoSoHangNam
   */
  async deletePersonnel(id, userRole, userQuanNhanId) {
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: String(id) },
      include: {
        TaiKhoan: true,
      },
    });

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
      await prismaTx.danhHieuHangNam.deleteMany({
        where: { quan_nhan_id: id },
      });

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
      await prismaTx.quanNhan.delete({
        where: { id: String(id) },
      });

      // Decrement unit personnel count.
      if (unitId) {
        try {
          if (isCoQuanDonVi) {
            await prismaTx.coQuanDonVi.update({
              where: { id: unitId },
              data: { so_luong: { decrement: 1 } },
            });
          } else {
            await prismaTx.donViTrucThuoc.update({
              where: { id: unitId },
              data: { so_luong: { decrement: 1 } },
            });
          }
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
    const personnel = await prisma.quanNhan.findMany({
      include: personnelInclude,
      orderBy: [{ co_quan_don_vi_id: 'asc' }, { don_vi_truc_thuoc_id: 'asc' }, { ho_ten: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('QuanNhan');

    worksheet.columns = [
      { header: 'CCCD', key: 'cccd', width: 18 },
      { header: 'Họ tên', key: 'ho_ten', width: 28 },
      { header: 'Ngày sinh (YYYY-MM-DD)', key: 'ngay_sinh', width: 20 },
      {
        header: 'Ngày nhập ngũ (YYYY-MM-DD)',
        key: 'ngay_nhap_ngu',
        width: 24,
      },
      { header: 'Mã đơn vị', key: 'ma_don_vi', width: 14 },
      { header: 'Tên đơn vị', key: 'ten_don_vi', width: 24 },
      { header: 'Tên chức vụ', key: 'ten_chuc_vu', width: 22 },
      { header: 'Là chỉ huy (is_manager)', key: 'is_manager', width: 16 },
      { header: 'Hệ số chức vụ', key: 'he_so_chuc_vu', width: 15 },
    ];

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

  /** Exports an Excel template for personnel import. */
  async exportPersonnelSample() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Mẫu Quân nhân');

    // Template columns.
    const columns = [
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Họ tên', key: 'ho_ten', width: 25 },
      { header: 'Ngày sinh', key: 'ngay_sinh', width: 15 },
      { header: 'Ngày nhập ngũ', key: 'ngay_nhap_ngu', width: 15 },
      { header: 'Mã đơn vị', key: 'ma_don_vi', width: 15 },
      { header: 'Tên chức vụ', key: 'ten_chuc_vu', width: 20 },
      { header: 'Trạng thái', key: 'trang_thai', width: 15 },
    ];

    worksheet.columns = columns;

    // Style cho header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' },
    };

    // Keep CCCD as text to preserve leading zeros.
    worksheet.getColumn(1).numFmt = '@';

    // Sample rows.
    const sampleData = [
      {
        cccd: '123456789012',
        ho_ten: 'Nguyễn Văn A',
        ngay_sinh: '1990-01-15',
        ngay_nhap_ngu: '2010-03-01',
        ma_don_vi: 'DV001',
        ten_chuc_vu: 'Thiếu úy',
        trang_thai: 'ACTIVE',
      },
      {
        cccd: '123456789013',
        ho_ten: 'Trần Thị B',
        ngay_sinh: '1992-05-20',
        ngay_nhap_ngu: '2012-07-15',
        ma_don_vi: 'DV002',
        ten_chuc_vu: 'Trung úy',
        trang_thai: 'ACTIVE',
      },
    ];

    sampleData.forEach(row => {
      worksheet.addRow(sanitizeRowData(row));
    });

    // Usage notes.
    worksheet.addRow([]);
    worksheet.addRow(['Ghi chú:']);
    worksheet.addRow(['- Các cột có dấu * là bắt buộc']);
    worksheet.addRow(['- Mã đơn vị phải tồn tại trong hệ thống']);
    worksheet.addRow(['- Tên chức vụ phải tồn tại trong hệ thống']);
    worksheet.addRow(['- Ngày tháng định dạng: YYYY-MM-DD']);
    worksheet.addRow(['- Trạng thái: ACTIVE hoặc INACTIVE']);

    // Notes style.
    for (let i = sampleData.length + 3; i <= worksheet.rowCount; i++) {
      worksheet.getRow(i).font = {
        italic: true,
        color: { argb: 'FF666666' },
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /**
   * Imports personnel from an Excel buffer.
   * Supported columns: CCCD, name, birth date, enlistment date, unit code, position.
   * @param buffer - Excel file buffer.
   * @returns Import summary with created/updated counts and per-row errors.
   */
  async importFromExcelBuffer(buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook);

    // Read header map.
    const headerRow = worksheet.getRow(1);
    const headerMap = {};
    headerRow.eachCell((cell, colNumber) => {
      const key = String(cell.value || '')
        .trim()
        .toLowerCase();
      if (key) headerMap[key] = colNumber;
    });

    const requiredHeaders = ['cccd', 'họ tên', 'mã đơn vị', 'tên chức vụ'];
    for (const h of requiredHeaders) {
      if (!headerMap[h]) {
        throw new ValidationError(`Thiếu cột bắt buộc: ${h}`);
      }
    }

    /** Normalize diverse cell value types to Date or null. */
    const parseDate = val => {
      if (!val) return null;
      if (val instanceof Date) return val;
      if (typeof val === 'object' && val?.result) return new Date(val.result);
      const s = String(val).trim();
      if (!s) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };

    // Pre-pass: collect unique unit codes and CCCDs from all data rows.
    const allMaDonVi = new Set<string>();
    const allCccds = new Set<string>();

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const cccd = this.parseCCCD(row.getCell(headerMap['cccd']).value);
      const maDonVi = String(row.getCell(headerMap['mã đơn vị']).value || '').trim();
      if (cccd) allCccds.add(cccd);
      if (maDonVi) allMaDonVi.add(maDonVi);
    }

    const maDonViList = [...allMaDonVi];
    const cccdList = [...allCccds];

    // Batch 1: fetch units and existing personnel in parallel.
    const [coQuanDonViRows, donViTrucThuocRows, existingPersonnelRows] = await Promise.all([
      prisma.coQuanDonVi.findMany({ where: { ma_don_vi: { in: maDonViList } } }),
      prisma.donViTrucThuoc.findMany({ where: { ma_don_vi: { in: maDonViList } } }),
      prisma.quanNhan.findMany({ where: { cccd: { in: cccdList } } }),
    ]);

    const coQuanDonViByCode = new Map(coQuanDonViRows.map(u => [u.ma_don_vi, u] as const));
    const donViTrucThuocByCode = new Map(donViTrucThuocRows.map(u => [u.ma_don_vi, u] as const));
    const existingPersonnelByCccd = new Map(existingPersonnelRows.map(p => [p.cccd, p] as const));

    // Collect all resolved unit IDs so positions can be batch-fetched per unit.
    const allUnitIds = new Set<string>();
    for (const maDonVi of maDonViList) {
      const unit = coQuanDonViByCode.get(maDonVi) || donViTrucThuocByCode.get(maDonVi);
      if (unit) allUnitIds.add(unit.id);
    }

    const existingPersonnelIds = existingPersonnelRows.map(p => p.id);

    // Batch 2: fetch positions for all resolved units and open position histories for existing personnel.
    const [chucVuRows, openHistoryRows] = await Promise.all([
      prisma.chucVu.findMany({
        where: {
          OR: [
            { co_quan_don_vi_id: { in: [...allUnitIds] } },
            { don_vi_truc_thuoc_id: { in: [...allUnitIds] } },
          ],
        },
      }),
      prisma.lichSuChucVu.findMany({
        where: {
          quan_nhan_id: { in: existingPersonnelIds },
          ngay_ket_thuc: null,
        },
      }),
    ]);

    // Composite key: unitId_ten_chuc_vu -> position record.
    const chucVuByUnitAndName = new Map(
      chucVuRows.flatMap(cv => {
        const keys: [string, typeof cv][] = [];
        if (cv.co_quan_don_vi_id) keys.push([`${cv.co_quan_don_vi_id}_${cv.ten_chuc_vu}`, cv]);
        if (cv.don_vi_truc_thuoc_id)
          keys.push([`${cv.don_vi_truc_thuoc_id}_${cv.ten_chuc_vu}`, cv]);
        return keys;
      })
    );

    // Position coefficient lookup by position id (populated from the same batch).
    const chucVuById = new Map(chucVuRows.map(cv => [cv.id, cv] as const));

    // Open histories grouped by personnel id.
    const openHistoriesByPersonnelId = new Map<string, typeof openHistoryRows>();
    for (const history of openHistoryRows) {
      const list = openHistoriesByPersonnelId.get(history.quan_nhan_id) ?? [];
      list.push(history);
      openHistoriesByPersonnelId.set(history.quan_nhan_id, list);
    }

    const created = [];
    const updated = [];
    const errors = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const cccd = this.parseCCCD(row.getCell(headerMap['cccd']).value);
      const ho_ten = String(row.getCell(headerMap['họ tên']).value || '').trim();
      const ma_don_vi = String(row.getCell(headerMap['mã đơn vị']).value || '').trim();
      const ten_chuc_vu = String(row.getCell(headerMap['tên chức vụ']).value || '').trim();
      const ngay_sinhRaw = headerMap['ngày sinh']
        ? row.getCell(headerMap['ngày sinh']).value
        : null;
      const ngay_nhap_nguRaw = headerMap['ngày nhập ngũ']
        ? row.getCell(headerMap['ngày nhập ngũ']).value
        : null;

      if (!cccd || !ho_ten || !ma_don_vi || !ten_chuc_vu) {
        if (!cccd && !ho_ten && !ma_don_vi && !ten_chuc_vu) continue;
        errors.push({ row: rowNumber, error: 'Thiếu dữ liệu bắt buộc' });
        continue;
      }

      // Resolve unit from pre-fetched maps (DVTT takes priority on read — CQDV is parent).
      const coQuanDonVi = coQuanDonViByCode.get(ma_don_vi);
      const donViTrucThuoc = donViTrucThuocByCode.get(ma_don_vi);
      const unit = coQuanDonVi || donViTrucThuoc;
      if (!unit) {
        errors.push({ row: rowNumber, error: `Không tìm thấy đơn vị với mã ${ma_don_vi}` });
        continue;
      }

      const position = chucVuByUnitAndName.get(`${unit.id}_${ten_chuc_vu}`);
      if (!position) {
        errors.push({
          row: rowNumber,
          error: `Không tìm thấy chức vụ '${ten_chuc_vu}' trong đơn vị ${ma_don_vi}`,
        });
        continue;
      }

      const ngay_sinh = parseDate(ngay_sinhRaw);
      const ngay_nhap_ngu = parseDate(ngay_nhap_nguRaw);

      const existing = existingPersonnelByCccd.get(cccd);
      const isCoQuanDonVi = !!coQuanDonVi;

      if (!existing) {
        let personnelData: Prisma.QuanNhanUncheckedCreateInput = {
          cccd,
          ho_ten,
          ngay_sinh,
          ngay_nhap_ngu,
          chuc_vu_id: position.id,
        };

        if (isCoQuanDonVi) {
          personnelData.co_quan_don_vi_id = unit.id;
          personnelData.don_vi_truc_thuoc_id = null;
        } else {
          personnelData.co_quan_don_vi_id = null;
          personnelData.don_vi_truc_thuoc_id = unit.id;
        }

        const newPersonnel = await prisma.quanNhan.create({ data: personnelData });

        if (isCoQuanDonVi) {
          await prisma.coQuanDonVi.update({
            where: { id: unit.id },
            data: { so_luong: { increment: 1 } },
          });
        } else {
          await prisma.donViTrucThuoc.update({
            where: { id: unit.id },
            data: { so_luong: { increment: 1 } },
          });
        }

        const ngayBatDau = ngay_nhap_ngu || new Date();
        await prisma.lichSuChucVu.create({
          data: {
            quan_nhan_id: newPersonnel.id,
            chuc_vu_id: position.id,
            he_so_chuc_vu: Number(chucVuById.get(position.id)?.he_so_chuc_vu ?? 0),
            ngay_bat_dau: ngayBatDau,
            ngay_ket_thuc: null,
            so_thang: null,
          },
        });

        created.push(newPersonnel.id);
      } else {
        // DVTT takes priority when determining the effective unit id.
        const oldUnitId = existing.don_vi_truc_thuoc_id || existing.co_quan_don_vi_id;
        const newUnitId = unit.id;
        const oldIsCoQuanDonVi = !existing.don_vi_truc_thuoc_id && !!existing.co_quan_don_vi_id;

        const updateData: Prisma.QuanNhanUncheckedUpdateInput = {
          ho_ten,
          ngay_sinh: ngay_sinh ?? existing.ngay_sinh,
          ngay_nhap_ngu: ngay_nhap_ngu ?? existing.ngay_nhap_ngu,
          chuc_vu_id: position.id,
        };

        if (isCoQuanDonVi) {
          updateData.co_quan_don_vi_id = unit.id;
          updateData.don_vi_truc_thuoc_id = null;
        } else {
          updateData.co_quan_don_vi_id = null;
          updateData.don_vi_truc_thuoc_id = unit.id;
        }

        const updatedPersonnel = await prisma.quanNhan.update({
          where: { id: existing.id },
          data: updateData,
        });

        if (oldUnitId !== newUnitId) {
          if (oldUnitId) {
            if (oldIsCoQuanDonVi) {
              await prisma.coQuanDonVi.update({
                where: { id: oldUnitId },
                data: { so_luong: { decrement: 1 } },
              });
            } else {
              await prisma.donViTrucThuoc.update({
                where: { id: oldUnitId },
                data: { so_luong: { decrement: 1 } },
              });
            }
          }

          if (isCoQuanDonVi) {
            await prisma.coQuanDonVi.update({
              where: { id: newUnitId },
              data: { so_luong: { increment: 1 } },
            });
          } else {
            await prisma.donViTrucThuoc.update({
              where: { id: newUnitId },
              data: { so_luong: { increment: 1 } },
            });
          }
        }

        if (position.id !== existing.chuc_vu_id) {
          const today = new Date();
          const openHistories = openHistoriesByPersonnelId.get(existing.id) ?? [];

          for (const oldHistory of openHistories) {
            const ngayBatDauOld = new Date(oldHistory.ngay_bat_dau);
            const soThangOld = calculateTenureMonthsWithDayPrecision(ngayBatDauOld, today);

            await prisma.lichSuChucVu.update({
              where: { id: oldHistory.id },
              data: { ngay_ket_thuc: today, so_thang: soThangOld },
            });
          }

          await prisma.lichSuChucVu.create({
            data: {
              quan_nhan_id: existing.id,
              chuc_vu_id: position.id,
              he_so_chuc_vu: Number(chucVuById.get(position.id)?.he_so_chuc_vu ?? 0),
              ngay_bat_dau: today,
              ngay_ket_thuc: null,
              so_thang: null,
            },
          });
        }

        updated.push(updatedPersonnel.id);
      }
    }

    writeSystemLog({
      action: 'IMPORT',
      resource: 'personnel',
      description: `[Import quân nhân] Hoàn tất: ${created.length} tạo mới, ${updated.length} cập nhật, ${errors.length} lỗi`,
    });

    return {
      createdCount: created.length,
      updatedCount: updated.length,
      errors,
    };
  }

  /**
   * Checks contribution-award eligibility.
   * Returns personnel already awarded or currently pending approval.
   * @param personnelIds - Personnel ids to validate.
   * @returns Ineligible personnel with reason and status.
   */
  async checkContributionEligibility(personnelIds) {
    const ineligiblePersonnel = [];

    const [existingAwards, pendingProposals] = await Promise.all([
      prisma.khenThuongHCBVTQ.findMany({
        where: { quan_nhan_id: { in: personnelIds } },
      }),
      prisma.bangDeXuat.findMany({
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
