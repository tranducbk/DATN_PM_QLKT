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

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  ACCOUNT SERVICE — quản lý tài khoản (ATTT critical)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Nghiệp vụ phụ trợ đã tách file riêng: gán đơn vị/chức vụ →
 *  account/unitAssignment.ts, format response → account/helpers.ts, type →
 *  account/types.ts. File này giữ orchestration + các điểm ATTT.
 *
 *  ATTT POINTS QUAN TRỌNG:
 *
 *  ① BCRYPT HASH với cost factor = 10:
 *     - bcrypt.hash(password, 10) → 2^10 = 1024 iteration.
 *     - Trade-off: 10 đủ chậm (≈100ms) để chống brute force, đủ nhanh
 *       để không block server khi nhiều user login đồng thời.
 *     - 2026 best practice là 12+ → có thể tăng khi server mạnh hơn.
 *     - LƯU Ý: bcrypt tự sinh salt → mỗi hash khác nhau dù cùng password
 *       → ngăn rainbow table attack.
 *
 *  ② STORE password_hash (KHÔNG password plain):
 *     - DB schema field tên `password_hash` để rõ ý đồ (không bao giờ
 *       chứa plain text).
 *     - Compare qua bcrypt.compare (constant-time) → KHÔNG dùng `===`
 *       (vulnerable to timing attack).
 *
 *  ③ password_hash EXCLUDED khỏi mọi response:
 *     - getAccounts / getAccountById / formatAccount đều không trả
 *       password_hash. Chỉ login flow mới đọc field này để compare.
 *
 *  ④ DEFAULT_PASSWORD khi admin tạo tài khoản mới:
 *     - Không truyền password → dùng DEFAULT_PASSWORD (configs).
 *     - User nên đổi sau khi đăng nhập lần đầu.
 *
 *  ⑤ validatePassword RULE:
 *     - Tối thiểu 8 ký tự + bắt buộc có chữ hoa, chữ thường và chữ số.
 *
 *  ⑥ ROLE HIERARCHY:
 *     - getAccounts: excludeSuperAdmin=true → ADMIN không thấy SUPER_ADMIN
 *       trong list (chống enumerate role cao hơn).
 *     - getAccountById: caller không phải SUPER_ADMIN → cấm xem tài khoản
 *       SUPER_ADMIN (mirror list exclusion).
 *     - deleteAccount: canManageRole chỉ cho xóa tài khoản cấp thấp hơn.
 *
 *  ⑦ INVALIDATE SESSION khi đổi VAI TRÒ:
 *     - updateAccount đổi role → set refreshToken = null + emit 'force_logout'
 *       → buộc đăng nhập lại để nhận token mang role mới (tránh dùng quyền cũ).
 *
 *  QUAN HỆ với QuanNhan:
 *  - 1 TaiKhoan = 1 QuanNhan (1-1, nullable nếu là tài khoản admin
 *    không phải quân nhân).
 *  - quan_nhan_id = NULL → tài khoản hệ thống (SUPER_ADMIN, ADMIN).
 *  - quan_nhan_id != NULL → tài khoản quân nhân (MANAGER, USER).
 * ════════════════════════════════════════════════════════════════════════════
 */
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

    // Lọc theo vai trò; chấp nhận nhiều role cách nhau bởi dấu phẩy (vd "ADMIN,MANAGER")
    let roleFilter: Prisma.TaiKhoanWhereInput = {};
    if (role) {
      const roles = String(role)
        .split(',')
        .map(r => r.trim());
      roleFilter = roles.length > 1 ? { role: { in: roles } } : { role: roles[0] };
    }

    // Ẩn tài khoản SUPER_ADMIN khỏi danh sách khi người gọi không đủ cấp (phân quyền)
    const excludeFilter: Prisma.TaiKhoanWhereInput = excludeSuperAdmin
      ? { role: { not: ROLES.SUPER_ADMIN } }
      : {};

    // Gộp 3 điều kiện bằng AND: (ô tìm kiếm) + (lọc role) + (ẩn SUPER_ADMIN)
    const whereClause: Prisma.TaiKhoanWhereInput = {
      AND: [
        search
          ? {
              // Tìm theo username HOẶC họ tên quân nhân, không phân biệt hoa/thường
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

    // Chạy song song: lấy 1 trang dữ liệu + đếm tổng số bản ghi (phục vụ phân trang)
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

    // Rút gọn mỗi bản ghi về các field cần cho danh sách (KHÔNG kèm password_hash)
    const formattedAccounts: FormattedAccount[] = accounts.map(account => {
      const quanNhan = account.QuanNhan;
      // Ưu tiên đơn vị trực thuộc; không có thì lấy cơ quan đơn vị (đơn vị cha)
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
    // Lấy tài khoản kèm hồ sơ quân nhân, đơn vị (CQDV + ĐVTT) và chức vụ
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

    // Chỉ trả về các field cho phép (whitelist) — tuyệt đối không lộ password_hash
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

    // Chặn trùng username (chỉ cần biết có tồn tại hay không nên select mỗi id)
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

    // Gắn tài khoản vào quân nhân có sẵn: kiểm tra song song quân nhân tồn tại
    // và chưa bị gắn tài khoản khác (mỗi quân nhân chỉ được 1 tài khoản)
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

    // Tài khoản MANAGER/USER nhưng chưa gắn quân nhân → tự dựng hồ sơ quân nhân mới
    // (helper validate đơn vị + chức vụ); trả null nếu là tài khoản admin
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

    // Không nhập password → dùng mật khẩu mặc định; chỉ validate khi admin tự nhập
    const finalPassword = password || DEFAULT_PASSWORD;
    if (!finalPassword) {
      throw new ValidationError('Mật khẩu mặc định chưa được cấu hình (DEFAULT_PASSWORD)');
    }
    if (password) {
      this.validatePassword(password);
    }

    // Băm mật khẩu trước khi lưu (xem điểm ① trong header)
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // ─── TRANSACTION: tạo tài khoản + (nếu MANAGER/USER chưa gắn quân nhân) tự sinh hồ sơ ───
    // Một bộ thao tác phải đi cùng nhau, gói trong 1 transaction để không lệch
    // dữ liệu (vd có TaiKhoan nhưng thiếu QuanNhan, hoặc so_luong đếm sai khi 1
    // bước fail). Bất kỳ throw nào → Prisma ROLLBACK toàn bộ.
    // SQL minh hoạ (nhánh có personnelDataForCreate):
    //   INSERT INTO "QuanNhan"     (cccd, ho_ten, chuc_vu_id, ...) VALUES (NULL, $username, ...);
    //     -- cccd=NULL: tạo trước, CCCD điền sau khi cập nhật hồ sơ
    //   INSERT INTO "LichSuChucVu" (quan_nhan_id, chuc_vu_id, he_so_chuc_vu, ngay_bat_dau)
    //     VALUES ($qnId, $chucVu, $heSo, NOW());          -- mốc giữ chức hiện tại
    //   UPDATE "DonViTrucThuoc" SET so_luong = so_luong + 1 WHERE id = $dvtt;
    //     -- hoặc "CoQuanDonVi" nếu không có ĐVTT (ưu tiên ĐVTT, tránh đếm 2 lần)
    //   INSERT INTO "TaiKhoan"     (quan_nhan_id, username, password_hash, role) VALUES (...);
    const newAccount = await prisma.$transaction(async prismaTx => {
      if (personnelDataForCreate) {
        // Tạo hồ sơ quân nhân tối thiểu (CCCD/ngày sinh điền sau khi cập nhật hồ sơ)
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

        // Mở mốc giữ chức vụ hiện tại (ngay_ket_thuc = null) để tính thâm niên về sau
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

      // Tạo tài khoản, gắn với quân nhân vừa tạo (hoặc null nếu là tài khoản admin)
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

    // Lấy role + đơn vị/chức vụ hiện tại để so sánh với dữ liệu cập nhật
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

    // effectiveRole = role sau cập nhật (giữ role cũ nếu lần này không đổi)
    const effectiveRole = role ?? account.role;
    const roleChanging = !!role && role !== account.role;
    // Có gửi kèm thông tin đơn vị/chức vụ mới hay không
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
      // Validate + chuẩn hóa đơn vị/chức vụ mới (MANAGER bỏ ĐVTT, USER cần đủ cả 2)
      resolvedUnit = await resolveUnitReassignment({
        effectiveRole,
        co_quan_don_vi_id,
        don_vi_truc_thuoc_id,
        chuc_vu_id,
      });
    }

    // Chỉ cập nhật field nào được gửi lên (partial update)
    const updateData: Prisma.TaiKhoanUncheckedUpdateInput = {};
    if (role) {
      updateData.role = role;
    }
    if (password) {
      // Đổi mật khẩu → validate rồi băm lại trước khi lưu
      this.validatePassword(password);
      updateData.password_hash = await bcrypt.hash(password, 10);
    }
    if (roleChanging) {
      // Role change alters privileges and the role-based UI; invalidate the session so the user
      // re-authenticates with the new role instead of running on a stale one.
      updateData.refreshToken = null;
      updateData.prevRefreshToken = null;
    }

    // Cùng 1 transaction: cập nhật quân nhân + xoay lịch sử chức vụ + đếm lại đơn vị + cập nhật tài khoản
    const updatedAccount = await prisma.$transaction(async tx => {
      if (resolvedUnit && account.QuanNhan) {
        const qn = account.QuanNhan;
        const positionChanged = qn.chuc_vu_id !== resolvedUnit.chuc_vu_id;

        // Cập nhật đơn vị + chức vụ mới cho quân nhân
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
        // Đơn vị "chính" = ĐVTT nếu có, ngược lại là CQDV (ưu tiên ĐVTT, tránh đếm trùng)
        const oldPrimaryUnitId = qn.don_vi_truc_thuoc_id || qn.co_quan_don_vi_id;
        const newPrimaryUnitId =
          resolvedUnit.don_vi_truc_thuoc_id || resolvedUnit.co_quan_don_vi_id;
        // Chỉ điều chỉnh so_luong khi thực sự chuyển sang đơn vị khác
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

    // Đổi đơn vị/chức vụ ảnh hưởng điều kiện khen thưởng → tính lại hồ sơ hằng năm.
    // Lỗi recalc chỉ ghi log, không chặn việc cập nhật tài khoản (best-effort)
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

    // Đổi vai trò → quyền hạn thay đổi, nhưng JWT cũ vẫn còn hiệu lực tới khi hết
    // hạn. Đẩy 'force_logout' qua socket buộc session cũ đăng nhập lại để nhận
    // token mang role mới (tránh dùng quyền cũ sau khi đã bị đổi).
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
    // Lấy tài khoản kèm hồ sơ quân nhân (cần để dọn dữ liệu liên quan khi xóa)
    const account = await accountRepository.findUniqueRaw({
      where: { id },
      include: {
        QuanNhan: true,
      },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    // Phân quyền: chỉ xóa được tài khoản có cấp thấp hơn người thực hiện
    if (!canManageRole(actorRole, account.role)) {
      throw new ForbiddenError('Bạn chỉ có thể xóa tài khoản có cấp thấp hơn mình.');
    }

    // Tài khoản admin (không gắn quân nhân) → xóa thẳng, không có dữ liệu phụ thuộc
    if (!account.QuanNhan) {
      await accountRepository.delete(id);
      return { message: 'Xóa tài khoản thành công', username: account.username, ho_ten: null };
    }

    let deletedProposals = 0;

    const personnelId = account.QuanNhan.id;
    // DVTT takes priority — CQDV may be the parent unit
    const unitId = account.QuanNhan.don_vi_truc_thuoc_id || account.QuanNhan.co_quan_don_vi_id;
    // Đơn vị chính là CQDV chỉ khi không có ĐVTT → quyết định bảng nào sẽ giảm so_luong
    const isCoQuanDonVi =
      !account.QuanNhan.don_vi_truc_thuoc_id && !!account.QuanNhan.co_quan_don_vi_id;

    // Tìm mọi đề xuất có chứa quân nhân này trong cột JSON data_danh_hieu HOẶC data_nien_han
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
        ],
      },
    });

    // Đề xuất đang chờ duyệt → chặn xóa để không mất đề xuất, trừ khi ép xóa (forceDelete)
    const pendingProposals = proposals.filter(p => p.status === PROPOSAL_STATUS.PENDING);

    if (pendingProposals.length > 0 && !forceDelete) {
      throw new ValidationError(
        `Không thể xóa tài khoản này vì quân nhân đang có ${pendingProposals.length} đề xuất chờ duyệt. ` +
          `Hãy xử lý các đề xuất trước hoặc sử dụng force delete.`
      );
    }

    await prisma.$transaction(async prismaTx => {
      // Gỡ quân nhân khỏi từng đề xuất: lọc bỏ các dòng mang personnel_id của quân nhân này
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

        if (updated) {
          const dataDanhHieu = proposal.data_danh_hieu as unknown[] | null;
          const dataNienHan = proposal.data_nien_han as unknown[] | null;
          const dataThanhTich = proposal.data_thanh_tich as unknown[] | null;

          // Sau khi gỡ, nếu đề xuất không còn dòng nào → xóa hẳn; còn dòng → lưu lại bản đã lọc
          const isEmpty =
            (!dataDanhHieu || dataDanhHieu.length === 0) &&
            (!dataNienHan || dataNienHan.length === 0) &&
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
              },
              prismaTx
            );
          }
        }
      }

      // Xóa tài khoản và hồ sơ quân nhân
      await accountRepository.delete(id, prismaTx);

      await quanNhanRepository.delete(personnelId, prismaTx);

      // Giảm số lượng (so_luong) của đơn vị chính: CQDV hay ĐVTT tùy isCoQuanDonVi
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
