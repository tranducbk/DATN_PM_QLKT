import bcrypt from 'bcrypt';
import { prisma } from '../models';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../repositories/unit.repository';
import { accountRepository } from '../repositories/account.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import { positionHistoryRepository } from '../repositories/positionHistory.repository';
import { DEFAULT_PASSWORD } from '../configs';
import { ROLES, canManageRole } from '../constants/roles.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import {
  AppError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../middlewares/errorHandler';
import type { Prisma } from '../generated/prisma';
import profileService from './profile.service';
import { adjustUnitCount } from './personnel/unitCount';
import { rotatePositionHistory } from './personnel/positionHistory';
import {
  resolvePersonnelDataForCreate,
  resolveUnitReassignment,
} from './account/unitAssignment';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';
import { RESOURCE_SLUGS } from '../constants/resourceSlugs.constants';
import { emitToUser } from '../utils/socketService';
import type {
  CreateAccountData,
  UpdateAccountData,
  FormattedAccount,
  PaginatedAccounts,
} from './account/types';
import { formatAccount } from './account/helpers';

const ACCOUNT_QUAN_NHAN_INCLUDE = {
  QuanNhan: {
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: {
        include: {
          CoQuanDonVi: true,
        },
      },
      ChucVu: true,
    },
  },
} as const;

class AccountService {
  async getAccounts(
    page: number | string = 1,
    limit: number | string = 10,
    search: string = '',
    role?: string,
    excludeSuperAdmin: boolean = false
  ): Promise<PaginatedAccounts> {
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    let roleFilter: Prisma.TaiKhoanWhereInput = {};
    if (role) {
      const roles = String(role)
        .split(',')
        .map(r => r.trim());
      roleFilter = roles.length > 1 ? { role: { in: roles } } : { role: roles[0] };
    }

    const excludeFilter: Prisma.TaiKhoanWhereInput = excludeSuperAdmin
      ? { role: { not: ROLES.SUPER_ADMIN } }
      : {};

    const whereClause: Prisma.TaiKhoanWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { username: { contains: String(search), mode: 'insensitive' } },
                { QuanNhan: { ho_ten: { contains: String(search), mode: 'insensitive' } } },
              ],
            }
          : {},
        roleFilter,
        excludeFilter,
      ],
    };

    const [accounts, total] = await Promise.all([
      accountRepository.findManyRaw({
        skip,
        take: limitNum,
        where: whereClause,
        include: ACCOUNT_QUAN_NHAN_INCLUDE,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      accountRepository.count(whereClause),
    ]);

    const formattedAccounts: FormattedAccount[] = accounts.map(account => {
      const quanNhan = account.QuanNhan;
      const donVi = quanNhan?.DonViTrucThuoc || quanNhan?.CoQuanDonVi;
      return {
        id: account.id,
        username: account.username,
        role: account.role,
        quan_nhan_id: account.quan_nhan_id,
        ho_ten: quanNhan?.ho_ten || null,
        don_vi: donVi?.ten_don_vi || null,
        cap_bac: quanNhan?.cap_bac || null,
        chuc_vu: quanNhan?.ChucVu?.ten_chuc_vu || null,
        createdAt: account.createdAt,
      };
    });

    return {
      accounts: formattedAccounts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async getAccountById(id: string, callerRole?: string): Promise<Record<string, unknown>> {
    const account = await accountRepository.findUniqueRaw({
      where: { id },
      include: ACCOUNT_QUAN_NHAN_INCLUDE,
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    // Non-SUPER_ADMIN callers must not read a SUPER_ADMIN account (mirrors the list exclusion).
    if (callerRole && callerRole !== ROLES.SUPER_ADMIN && account.role === ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Không có quyền xem tài khoản này');
    }

    return {
      id: account.id,
      username: account.username,
      role: account.role,
      quan_nhan_id: account.quan_nhan_id,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      QuanNhan: account.QuanNhan
        ? {
            id: account.QuanNhan.id,
            ho_ten: account.QuanNhan.ho_ten,
            cccd: account.QuanNhan.cccd,
            gioi_tinh: account.QuanNhan.gioi_tinh,
            ngay_sinh: account.QuanNhan.ngay_sinh,
            que_quan_2_cap: account.QuanNhan.que_quan_2_cap,
            que_quan_3_cap: account.QuanNhan.que_quan_3_cap,
            tru_quan: account.QuanNhan.tru_quan,
            cho_o_hien_nay: account.QuanNhan.cho_o_hien_nay,
            ngay_nhap_ngu: account.QuanNhan.ngay_nhap_ngu,
            ngay_xuat_ngu: account.QuanNhan.ngay_xuat_ngu,
            ngay_vao_dang: account.QuanNhan.ngay_vao_dang,
            ngay_vao_dang_chinh_thuc: account.QuanNhan.ngay_vao_dang_chinh_thuc,
            so_the_dang_vien: account.QuanNhan.so_the_dang_vien,
            so_dien_thoai: account.QuanNhan.so_dien_thoai,
            CoQuanDonVi: account.QuanNhan.CoQuanDonVi
              ? {
                  id: account.QuanNhan.CoQuanDonVi.id,
                  ma_don_vi: account.QuanNhan.CoQuanDonVi.ma_don_vi,
                  ten_don_vi: account.QuanNhan.CoQuanDonVi.ten_don_vi,
                }
              : null,
            DonViTrucThuoc: account.QuanNhan.DonViTrucThuoc
              ? {
                  id: account.QuanNhan.DonViTrucThuoc.id,
                  ma_don_vi: account.QuanNhan.DonViTrucThuoc.ma_don_vi,
                  ten_don_vi: account.QuanNhan.DonViTrucThuoc.ten_don_vi,
                  CoQuanDonVi: account.QuanNhan.DonViTrucThuoc.CoQuanDonVi
                    ? {
                        id: account.QuanNhan.DonViTrucThuoc.CoQuanDonVi.id,
                        ma_don_vi: account.QuanNhan.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                        ten_don_vi: account.QuanNhan.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                      }
                    : null,
                }
              : null,
            ChucVu: account.QuanNhan.ChucVu
              ? {
                  id: account.QuanNhan.ChucVu.id,
                  ten_chuc_vu: account.QuanNhan.ChucVu.ten_chuc_vu,
                }
              : null,
          }
        : null,
    };
  }

  async createAccount(data: CreateAccountData): Promise<FormattedAccount> {
    const {
      personnel_id,
      username,
      password,
      role,
      co_quan_don_vi_id,
      don_vi_truc_thuoc_id,
      chuc_vu_id,
    } = data;

    const existingAccount = await accountRepository.findUniqueRaw({
      where: { username },
      select: { id: true },
    });

    if (existingAccount) {
      throw new ValidationError('Tên đăng nhập đã tồn tại');
    }

    let finalPersonnelId: string | null = personnel_id || null;
    let personnelDataForCreate: Prisma.QuanNhanCreateInput | null = null;
    let heSoChucVu = 0;

    if (personnel_id) {
      const [personnel, existingPersonnelAccount] = await Promise.all([
        quanNhanRepository.findIdById(personnel_id),
        accountRepository.findUniqueRaw({
          where: { quan_nhan_id: personnel_id },
          select: { id: true },
        }),
      ]);

      if (!personnel) {
        throw new NotFoundError('Quân nhân');
      }
      if (existingPersonnelAccount) {
        throw new ValidationError('Quân nhân này đã có tài khoản');
      }
    }

    const unitData = await resolvePersonnelDataForCreate({
      role,
      username,
      personnel_id,
      co_quan_don_vi_id,
      don_vi_truc_thuoc_id,
      chuc_vu_id,
    });
    if (unitData) {
      personnelDataForCreate = unitData.personnelDataForCreate;
      heSoChucVu = unitData.heSoChucVu;
    }

    const finalPassword = password || DEFAULT_PASSWORD;
    if (!finalPassword) {
      throw new ValidationError('Mật khẩu mặc định chưa được cấu hình (DEFAULT_PASSWORD)');
    }
    if (password) {
      this.validatePassword(password);
    }

    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const newAccount = await prisma.$transaction(async prismaTx => {
      if (personnelDataForCreate) {
        const newPersonnel = await quanNhanRepository.create(
          {
            cccd: null,
            ho_ten: username,
            chuc_vu_id: chuc_vu_id!,
            ngay_sinh: null,
            ngay_nhap_ngu: null,
            co_quan_don_vi_id: co_quan_don_vi_id || null,
            don_vi_truc_thuoc_id: don_vi_truc_thuoc_id || null,
          },
          prismaTx
        );
        finalPersonnelId = newPersonnel.id;

        await positionHistoryRepository.create(
          {
            quan_nhan_id: newPersonnel.id,
            chuc_vu_id: chuc_vu_id!,
            he_so_chuc_vu: heSoChucVu,
            ngay_bat_dau: new Date(),
            ngay_ket_thuc: null,
            so_thang: null,
          },
          prismaTx
        );

        // DVTT takes priority — only increment CQDV when no DVTT (avoid double-counting)
        if (don_vi_truc_thuoc_id) {
          await donViTrucThuocRepository.incrementSoLuong(don_vi_truc_thuoc_id, prismaTx);
        } else if (co_quan_don_vi_id) {
          await coQuanDonViRepository.incrementSoLuong(co_quan_don_vi_id, prismaTx);
        }
      }

      return accountRepository.createRaw(
        {
          data: {
            quan_nhan_id: finalPersonnelId || null,
            username,
            password_hash: hashedPassword,
            role,
          },
          include: ACCOUNT_QUAN_NHAN_INCLUDE,
        },
        prismaTx
      );
    });

    return formatAccount(newAccount);
  }

  async updateAccount(id: string, data: UpdateAccountData): Promise<FormattedAccount> {
    const { role, password, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id } = data;

    const account = await accountRepository.findUniqueRaw({
      where: { id },
      select: {
        id: true,
        role: true,
        quan_nhan_id: true,
        QuanNhan: {
          select: {
            id: true,
            chuc_vu_id: true,
            co_quan_don_vi_id: true,
            don_vi_truc_thuoc_id: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    const effectiveRole = role ?? account.role;
    const roleChanging = !!role && role !== account.role;
    const unitFieldsProvided =
      co_quan_don_vi_id !== undefined ||
      don_vi_truc_thuoc_id !== undefined ||
      chuc_vu_id !== undefined;

    // Roles split into two non-bridgeable groups: personnel accounts (MANAGER/USER, tied to a
    // quan_nhan) and admin accounts (SUPER_ADMIN/ADMIN, no quan_nhan). Crossing groups is
    // meaningless and error-prone, so a role change may only stay within its own group.
    if (roleChanging) {
      const targetIsSoldierRole = role === ROLES.MANAGER || role === ROLES.USER;
      const accountIsSoldier = !!account.quan_nhan_id;
      if (accountIsSoldier && !targetIsSoldierRole) {
        throw new ValidationError(
          'Tài khoản gắn với quân nhân chỉ có thể đổi giữa Chỉ huy đơn vị và Người dùng.'
        );
      }
      if (!accountIsSoldier && targetIsSoldierRole) {
        throw new ValidationError(
          'Tài khoản quản trị chỉ có thể đổi giữa Quản trị viên và Cán bộ Phòng Chính trị.'
        );
      }
    }

    // Reassign the linked personnel's unit + position when the (new) role is unit-scoped and the
    // role is changing or new unit/position values were supplied. ADMIN/SUPER_ADMIN carry no unit,
    // so their personnel is left untouched.
    const reassignUnit =
      (effectiveRole === ROLES.MANAGER || effectiveRole === ROLES.USER) &&
      !!account.QuanNhan &&
      (roleChanging || unitFieldsProvided);

    let resolvedUnit: {
      chuc_vu_id: string;
      co_quan_don_vi_id: string;
      don_vi_truc_thuoc_id: string | null;
    } | null = null;

    if (reassignUnit) {
      resolvedUnit = await resolveUnitReassignment({
        effectiveRole,
        co_quan_don_vi_id,
        don_vi_truc_thuoc_id,
        chuc_vu_id,
      });
    }

    const updateData: Prisma.TaiKhoanUncheckedUpdateInput = {};
    if (role) {
      updateData.role = role;
    }
    if (password) {
      this.validatePassword(password);
      updateData.password_hash = await bcrypt.hash(password, 10);
    }
    if (roleChanging) {
      // Role change alters privileges and the role-based UI; invalidate the session so the user
      // re-authenticates with the new role instead of running on a stale one.
      updateData.refreshToken = null;
      updateData.prevRefreshToken = null;
    }

    const updatedAccount = await prisma.$transaction(async tx => {
      if (resolvedUnit && account.QuanNhan) {
        const qn = account.QuanNhan;
        const positionChanged = qn.chuc_vu_id !== resolvedUnit.chuc_vu_id;

        await quanNhanRepository.update(
          qn.id,
          {
            chuc_vu_id: resolvedUnit.chuc_vu_id,
            co_quan_don_vi_id: resolvedUnit.co_quan_don_vi_id,
            don_vi_truc_thuoc_id: resolvedUnit.don_vi_truc_thuoc_id,
          },
          tx
        );

        // Position change: rotate history (close open period, open new) so contribution months stay accurate.
        if (positionChanged) {
          await rotatePositionHistory(tx, qn.id, resolvedUnit.chuc_vu_id, new Date());
        }

        // Unit move: keep so_luong counters correct (decrement old, increment new).
        const oldPrimaryUnitId = qn.don_vi_truc_thuoc_id || qn.co_quan_don_vi_id;
        const newPrimaryUnitId =
          resolvedUnit.don_vi_truc_thuoc_id || resolvedUnit.co_quan_don_vi_id;
        if (oldPrimaryUnitId !== newPrimaryUnitId) {
          if (oldPrimaryUnitId) {
            await adjustUnitCount(tx, oldPrimaryUnitId, !qn.don_vi_truc_thuoc_id, 'decrement');
          }
          if (newPrimaryUnitId) {
            await adjustUnitCount(
              tx,
              newPrimaryUnitId,
              !resolvedUnit.don_vi_truc_thuoc_id,
              'increment'
            );
          }
        }
      }
      return accountRepository.updateRaw(
        { where: { id }, data: updateData, include: ACCOUNT_QUAN_NHAN_INCLUDE },
        tx
      );
    });

    if (resolvedUnit && account.quan_nhan_id) {
      try {
        await profileService.recalculateAnnualProfile(account.quan_nhan_id);
      } catch (recalcError) {
        void writeSystemLog({
          action: AUDIT_ACTIONS.ERROR,
          resource: RESOURCE_SLUGS.PERSONNEL,
          description: logMessages.recalcPersonnelError(account.quan_nhan_id, recalcError),
        });
      }
    }

    if (roleChanging) {
      emitToUser(id, 'force_logout', {
        message: 'Vai trò tài khoản của bạn vừa được thay đổi. Vui lòng đăng nhập lại.',
      });
    }

    return formatAccount(updatedAccount);
  }

  async resetPassword(accountId: string, callerRole?: string): Promise<{ message: string }> {
    const account = await accountRepository.findUniqueRaw({
      where: { id: accountId },
      select: { id: true, role: true },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    // ADMIN must not reset passwords of ADMIN/SUPER_ADMIN accounts (privilege escalation).
    if (
      callerRole === ROLES.ADMIN &&
      account.role !== ROLES.MANAGER &&
      account.role !== ROLES.USER
    ) {
      throw new ForbiddenError('Không có quyền đặt lại mật khẩu cho tài khoản này');
    }

    const defaultPassword = DEFAULT_PASSWORD;
    if (!defaultPassword) {
      throw new ValidationError('Mật khẩu mặc định chưa được cấu hình (DEFAULT_PASSWORD)');
    }
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await accountRepository.update(accountId, { password_hash: hashedPassword });

    return { message: 'Đặt lại mật khẩu thành công. Mật khẩu mới là mật khẩu mặc định' };
  }

  async deleteAccount(
    id: string,
    forceDelete: boolean = false,
    actorRole?: string
  ): Promise<{
    message: string;
    deletedProposals?: number;
    username?: string;
    ho_ten?: string | null;
  }> {
    const account = await accountRepository.findUniqueRaw({
      where: { id },
      include: {
        QuanNhan: true,
      },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    if (!canManageRole(actorRole, account.role)) {
      throw new ForbiddenError('Bạn chỉ có thể xóa tài khoản có cấp thấp hơn mình.');
    }

    if (!account.QuanNhan) {
      await accountRepository.delete(id);
      return { message: 'Xóa tài khoản thành công', username: account.username, ho_ten: null };
    }

    let deletedProposals = 0;

    const personnelId = account.QuanNhan.id;
    // DVTT takes priority — CQDV may be the parent unit
    const unitId = account.QuanNhan.don_vi_truc_thuoc_id || account.QuanNhan.co_quan_don_vi_id;
    const isCoQuanDonVi =
      !account.QuanNhan.don_vi_truc_thuoc_id && !!account.QuanNhan.co_quan_don_vi_id;

    const proposals = await proposalRepository.findManyRaw({
      where: {
        OR: [
          {
            data_danh_hieu: {
              path: ['$[*].personnel_id'],
              array_contains: personnelId,
            },
          },
          {
            data_nien_han: {
              path: ['$[*].personnel_id'],
              array_contains: personnelId,
            },
          },
          {
            data_cong_hien: {
              path: ['$[*].personnel_id'],
              array_contains: personnelId,
            },
          },
        ],
      },
    });

    const pendingProposals = proposals.filter(p => p.status === PROPOSAL_STATUS.PENDING);

    if (pendingProposals.length > 0 && !forceDelete) {
      throw new ValidationError(
        `Không thể xóa tài khoản này vì quân nhân đang có ${pendingProposals.length} đề xuất chờ duyệt. ` +
          `Hãy xử lý các đề xuất trước hoặc sử dụng force delete.`
      );
    }

    await prisma.$transaction(async prismaTx => {
      for (const proposal of proposals) {
        let updated = false;

        if (proposal.data_danh_hieu && Array.isArray(proposal.data_danh_hieu)) {
          const filtered = (proposal.data_danh_hieu as Record<string, unknown>[]).filter(
            item => item.personnel_id !== personnelId
          );
          if (filtered.length !== (proposal.data_danh_hieu as unknown[]).length) {
            (proposal as Record<string, unknown>).data_danh_hieu = filtered;
            updated = true;
          }
        }

        if (proposal.data_nien_han && Array.isArray(proposal.data_nien_han)) {
          const filtered = (proposal.data_nien_han as Record<string, unknown>[]).filter(
            item => item.personnel_id !== personnelId
          );
          if (filtered.length !== (proposal.data_nien_han as unknown[]).length) {
            (proposal as Record<string, unknown>).data_nien_han = filtered;
            updated = true;
          }
        }

        if (proposal.data_cong_hien && Array.isArray(proposal.data_cong_hien)) {
          const filtered = (proposal.data_cong_hien as Record<string, unknown>[]).filter(
            item => item.personnel_id !== personnelId
          );
          if (filtered.length !== (proposal.data_cong_hien as unknown[]).length) {
            (proposal as Record<string, unknown>).data_cong_hien = filtered;
            updated = true;
          }
        }

        if (updated) {
          const dataDanhHieu = proposal.data_danh_hieu as unknown[] | null;
          const dataNienHan = proposal.data_nien_han as unknown[] | null;
          const dataCongHien = proposal.data_cong_hien as unknown[] | null;
          const dataThanhTich = proposal.data_thanh_tich as unknown[] | null;

          const isEmpty =
            (!dataDanhHieu || dataDanhHieu.length === 0) &&
            (!dataNienHan || dataNienHan.length === 0) &&
            (!dataCongHien || dataCongHien.length === 0) &&
            (!dataThanhTich || dataThanhTich.length === 0);

          if (isEmpty) {
            await proposalRepository.delete(proposal.id, prismaTx);
            deletedProposals++;
          } else {
            await proposalRepository.update(
              proposal.id,
              {
                data_danh_hieu: (dataDanhHieu as Prisma.InputJsonValue) || [],
                data_nien_han: (dataNienHan as Prisma.InputJsonValue) || [],
                data_cong_hien: (dataCongHien as Prisma.InputJsonValue) || [],
              },
              prismaTx
            );
          }
        }
      }

      await accountRepository.delete(id, prismaTx);

      await quanNhanRepository.delete(personnelId, prismaTx);

      if (unitId) {
        try {
          if (isCoQuanDonVi) {
            await coQuanDonViRepository.decrementSoLuong(unitId, prismaTx);
          } else {
            await donViTrucThuocRepository.decrementSoLuong(unitId, prismaTx);
          }
        } catch (error) {
          console.error('[deleteAccount] decrement unit count failed', { unitId, error });
          throw new AppError(
            'Không thể cập nhật số lượng quân nhân của đơn vị, vui lòng thử lại.',
            500
          );
        }
      }
    });

    return {
      message: 'Xóa tài khoản và toàn bộ dữ liệu liên quan thành công',
      deletedProposals,
      username: account.username,
      ho_ten: account.QuanNhan.ho_ten,
    };
  }

  validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new ValidationError('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (!/[A-Z]/.test(password)) {
      throw new ValidationError('Mật khẩu phải chứa ít nhất 1 chữ hoa');
    }
    if (!/[a-z]/.test(password)) {
      throw new ValidationError('Mật khẩu phải chứa ít nhất 1 chữ thường');
    }
    if (!/[0-9]/.test(password)) {
      throw new ValidationError('Mật khẩu phải chứa ít nhất 1 chữ số');
    }
  }
}

export default new AccountService();
