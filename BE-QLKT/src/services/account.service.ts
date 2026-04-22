import bcrypt from 'bcrypt';
import { prisma } from '../models';
import { DEFAULT_PASSWORD } from '../configs';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import {
  AppError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../middlewares/errorHandler';
import type { Prisma } from '../generated/prisma';

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

interface CreateAccountData {
  personnel_id?: string | null;
  username: string;
  password: string;
  role: string;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  chuc_vu_id?: string | null;
}

interface UpdateAccountData {
  role?: string;
  password?: string;
}

interface FormattedAccount {
  id: string;
  username: string;
  role: string;
  quan_nhan_id: string | null;
  ho_ten: string | null;
  don_vi: string | null;
  cap_bac?: string | null;
  chuc_vu: string | null;
  createdAt?: Date;
}

interface PaginatedAccounts {
  accounts: FormattedAccount[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

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
      prisma.taiKhoan.findMany({
        skip,
        take: limitNum,
        where: whereClause,
        include: ACCOUNT_QUAN_NHAN_INCLUDE,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.taiKhoan.count({ where: whereClause }),
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

  async getAccountById(id: string): Promise<Record<string, unknown>> {
    const account = await prisma.taiKhoan.findUnique({
      where: { id },
      include: ACCOUNT_QUAN_NHAN_INCLUDE,
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
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

    const existingAccount = await prisma.taiKhoan.findUnique({
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
        prisma.quanNhan.findUnique({ where: { id: personnel_id }, select: { id: true } }),
        prisma.taiKhoan.findUnique({ where: { quan_nhan_id: personnel_id }, select: { id: true } }),
      ]);

      if (!personnel) {
        throw new NotFoundError('Quân nhân');
      }
      if (existingPersonnelAccount) {
        throw new ValidationError('Quân nhân này đã có tài khoản');
      }
    }

    if ((role === ROLES.MANAGER || role === ROLES.USER) && !personnel_id) {
      if (role === ROLES.MANAGER) {
        if (!co_quan_don_vi_id) {
          throw new ValidationError(
            'Tài khoản MANAGER phải có thông tin Cơ quan đơn vị. Vui lòng chọn Cơ quan đơn vị.'
          );
        }
        if (don_vi_truc_thuoc_id) {
          throw new ValidationError(
            'Tài khoản MANAGER chỉ được chọn Cơ quan đơn vị, không được chọn Đơn vị trực thuộc.'
          );
        }
      } else if (role === ROLES.USER) {
        if (!co_quan_don_vi_id || !don_vi_truc_thuoc_id) {
          throw new ValidationError(
            'Tài khoản USER phải có đầy đủ thông tin Cơ quan đơn vị và Đơn vị trực thuộc. Vui lòng chọn cả hai.'
          );
        }
      }

      if (!chuc_vu_id) {
        throw new ValidationError('Vui lòng chọn chức vụ');
      }

      const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
        co_quan_don_vi_id
          ? prisma.coQuanDonVi.findUnique({ where: { id: co_quan_don_vi_id }, select: { id: true } })
          : null,
        don_vi_truc_thuoc_id
          ? prisma.donViTrucThuoc.findUnique({
              where: { id: don_vi_truc_thuoc_id },
              select: { id: true, co_quan_don_vi_id: true },
            })
          : null,
      ]);

      if (co_quan_don_vi_id && !coQuanDonVi) {
        throw new NotFoundError('Cơ quan đơn vị');
      }
      if (don_vi_truc_thuoc_id) {
        if (!donViTrucThuoc) {
          throw new NotFoundError('Đơn vị trực thuộc');
        }
        if (co_quan_don_vi_id && donViTrucThuoc.co_quan_don_vi_id !== co_quan_don_vi_id) {
          throw new ValidationError('Đơn vị trực thuộc không thuộc cơ quan đơn vị đã chọn');
        }
      }

      const chucVu = await prisma.chucVu.findUnique({
        where: { id: chuc_vu_id },
        select: { he_so_chuc_vu: true, is_manager: true },
      });
      if (!chucVu) {
        throw new NotFoundError('Chức vụ');
      }

      if (role === ROLES.MANAGER && !chucVu.is_manager) {
        throw new ValidationError(
          'Tài khoản MANAGER phải có chức vụ là Chỉ huy. Vui lòng chọn chức vụ có quyền chỉ huy.'
        );
      }

      personnelDataForCreate = {
        cccd: null,
        ho_ten: username,
        ChucVu: { connect: { id: chuc_vu_id } },
        ngay_sinh: null,
        ngay_nhap_ngu: null,
        ...(co_quan_don_vi_id ? { CoQuanDonVi: { connect: { id: co_quan_don_vi_id } } } : {}),
        ...(don_vi_truc_thuoc_id
          ? { DonViTrucThuoc: { connect: { id: don_vi_truc_thuoc_id } } }
          : {}),
      } as Prisma.QuanNhanCreateInput;
      heSoChucVu = Number(chucVu?.he_so_chuc_vu) || 0;
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
        const newPersonnel = await prismaTx.quanNhan.create({
          data: {
            cccd: null,
            ho_ten: username,
            chuc_vu_id: chuc_vu_id!,
            ngay_sinh: null,
            ngay_nhap_ngu: null,
            co_quan_don_vi_id: co_quan_don_vi_id || null,
            don_vi_truc_thuoc_id: don_vi_truc_thuoc_id || null,
          },
        });
        finalPersonnelId = newPersonnel.id;

        await prismaTx.lichSuChucVu.create({
          data: {
            quan_nhan_id: newPersonnel.id,
            chuc_vu_id: chuc_vu_id!,
            he_so_chuc_vu: heSoChucVu,
            ngay_bat_dau: new Date(),
            ngay_ket_thuc: null,
            so_thang: null,
          },
        });

        // DVTT takes priority — only increment CQDV when no DVTT (avoid double-counting)
        if (don_vi_truc_thuoc_id) {
          await prismaTx.donViTrucThuoc.update({
            where: { id: don_vi_truc_thuoc_id },
            data: { so_luong: { increment: 1 } },
          });
        } else if (co_quan_don_vi_id) {
          await prismaTx.coQuanDonVi.update({
            where: { id: co_quan_don_vi_id },
            data: { so_luong: { increment: 1 } },
          });
        }
      }

      return prismaTx.taiKhoan.create({
        data: {
          quan_nhan_id: finalPersonnelId || null,
          username,
          password_hash: hashedPassword,
          role,
        },
        include: ACCOUNT_QUAN_NHAN_INCLUDE,
      });
    });

    return {
      id: newAccount.id,
      username: newAccount.username,
      role: newAccount.role,
      quan_nhan_id: newAccount.quan_nhan_id,
      ho_ten: newAccount.QuanNhan?.ho_ten || null,
      don_vi:
        (newAccount.QuanNhan?.DonViTrucThuoc || newAccount.QuanNhan?.CoQuanDonVi)?.ten_don_vi ||
        null,
      chuc_vu: newAccount.QuanNhan?.ChucVu?.ten_chuc_vu || null,
    };
  }

  async updateAccount(id: string, data: UpdateAccountData): Promise<FormattedAccount> {
    const { role, password } = data;

    const account = await prisma.taiKhoan.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    const updateData: Prisma.TaiKhoanUpdateInput = {};

    if (role) {
      updateData.role = role;
    }

    if (password) {
      this.validatePassword(password);
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password_hash = hashedPassword;
    }

    const updatedAccount = await prisma.taiKhoan.update({
      where: { id },
      data: updateData,
      include: ACCOUNT_QUAN_NHAN_INCLUDE,
    });

    return {
      id: updatedAccount.id,
      username: updatedAccount.username,
      role: updatedAccount.role,
      quan_nhan_id: updatedAccount.quan_nhan_id,
      ho_ten: updatedAccount.QuanNhan?.ho_ten || null,
      don_vi:
        (updatedAccount.QuanNhan?.DonViTrucThuoc || updatedAccount.QuanNhan?.CoQuanDonVi)
          ?.ten_don_vi || null,
      chuc_vu: updatedAccount.QuanNhan?.ChucVu?.ten_chuc_vu || null,
    };
  }

  async resetPassword(accountId: string): Promise<{ message: string }> {
    const account = await prisma.taiKhoan.findUnique({
      where: { id: accountId },
      select: { id: true },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    const defaultPassword = DEFAULT_PASSWORD;
    if (!defaultPassword) {
      throw new ValidationError('Mật khẩu mặc định chưa được cấu hình (DEFAULT_PASSWORD)');
    }
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await prisma.taiKhoan.update({
      where: { id: accountId },
      data: { password_hash: hashedPassword },
    });

    return { message: 'Đặt lại mật khẩu thành công. Mật khẩu mới là mật khẩu mặc định' };
  }

  async deleteAccount(
    id: string,
    forceDelete: boolean = false
  ): Promise<{ message: string; deletedProposals?: number }> {
    const account = await prisma.taiKhoan.findUnique({
      where: { id },
      include: {
        QuanNhan: true,
      },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    if (account.role === ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Không thể xóa tài khoản SUPER_ADMIN');
    }

    if (!account.QuanNhan) {
      await prisma.taiKhoan.delete({ where: { id } });
      return { message: 'Xóa tài khoản thành công' };
    }

    let deletedProposals = 0;

    const personnelId = account.QuanNhan.id;
    // DVTT takes priority — CQDV may be the parent unit
    const unitId = account.QuanNhan.don_vi_truc_thuoc_id || account.QuanNhan.co_quan_don_vi_id;
    const isCoQuanDonVi =
      !account.QuanNhan.don_vi_truc_thuoc_id && !!account.QuanNhan.co_quan_don_vi_id;

    const proposals = await prisma.bangDeXuat.findMany({
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

        if (updated) {
          const dataDanhHieu = proposal.data_danh_hieu as unknown[] | null;
          const dataNienHan = proposal.data_nien_han as unknown[] | null;
          const dataThanhTich = proposal.data_thanh_tich as unknown[] | null;

          const isEmpty =
            (!dataDanhHieu || dataDanhHieu.length === 0) &&
            (!dataNienHan || dataNienHan.length === 0) &&
            (!dataThanhTich || dataThanhTich.length === 0);

          if (isEmpty) {
            await prismaTx.bangDeXuat.delete({
              where: { id: proposal.id },
            });
            deletedProposals++;
          } else {
            await prismaTx.bangDeXuat.update({
              where: { id: proposal.id },
              data: {
                data_danh_hieu: (dataDanhHieu as Prisma.InputJsonValue) || [],
                data_nien_han: (dataNienHan as Prisma.InputJsonValue) || [],
              },
            });
          }
        }
      }

      await prismaTx.taiKhoan.delete({
        where: { id },
      });

      await prismaTx.quanNhan.delete({
        where: { id: personnelId },
      });

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
        } catch (error: unknown) {
          throw new AppError(
            `Không thể cập nhật số lượng quân nhân của đơn vị: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    });

    return {
      message: 'Xóa tài khoản và toàn bộ dữ liệu liên quan thành công',
      deletedProposals,
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
