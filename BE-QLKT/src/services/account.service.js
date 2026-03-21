const bcrypt = require('bcrypt');
const { prisma } = require('../models');
const { ROLES } = require('../constants/roles');
const {
  AppError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} = require('../middlewares/errorHandler');

class AccountService {
  /**
   * Lấy danh sách tài khoản (có phân trang)
   */
  async getAccounts(page = 1, limit = 10, search = '', role, excludeSuperAdmin = false) {
    const skip = (page - 1) * limit;

    // Hỗ trợ lọc nhiều role (ví dụ: "MANAGER,USER")
    let roleFilter = {};
    if (role) {
      const roles = String(role)
        .split(',')
        .map(r => r.trim());
      roleFilter = roles.length > 1 ? { role: { in: roles } } : { role: roles[0] };
    }

    // Exclude SUPER_ADMIN nếu được yêu cầu
    const excludeFilter = excludeSuperAdmin ? { role: { not: ROLES.SUPER_ADMIN } } : {};

    const whereClause = {
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
        take: parseInt(limit),
        where: whereClause,
        include: {
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
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.taiKhoan.count({ where: whereClause }),
    ]);

    // Format dữ liệu trả về
    const formattedAccounts = accounts.map(account => {
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
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lấy chi tiết tài khoản theo id
   */
  async getAccountById(id) {
    const account = await prisma.taiKhoan.findUnique({
      where: { id },
      include: {
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
      },
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

  /**
   * Tạo tài khoản mới
   */
  async createAccount(data) {
    const {
      personnel_id,
      username,
      password,
      role,
      co_quan_don_vi_id,
      don_vi_truc_thuoc_id,
      chuc_vu_id,
    } = data;

    // Kiểm tra username đã tồn tại chưa
    const existingAccount = await prisma.taiKhoan.findUnique({
      where: { username },
    });

    if (existingAccount) {
      throw new ValidationError('Tên đăng nhập đã tồn tại');
    }

    let finalPersonnelId = personnel_id || null;
    let personnelDataForCreate = null;
    let heSoChucVu = 0;

    // Nếu có personnel_id, kiểm tra quân nhân có tồn tại không
    if (personnel_id) {
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnel_id },
      });

      if (!personnel) {
        throw new NotFoundError('Quân nhân');
      }

      // Kiểm tra quân nhân đã có tài khoản chưa
      const existingPersonnelAccount = await prisma.taiKhoan.findUnique({
        where: { quan_nhan_id: personnel_id },
      });

      if (existingPersonnelAccount) {
        throw new ValidationError('Quân nhân này đã có tài khoản');
      }
    }

    // Tự động tạo QuanNhan cho MANAGER/USER
    if ((role === ROLES.MANAGER || role === ROLES.USER) && !personnel_id) {
      if (role === ROLES.MANAGER) {
        // MANAGER: Bắt buộc có co_quan_don_vi_id, KHÔNG có don_vi_truc_thuoc_id
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
        // USER: Bắt buộc có CẢ HAI co_quan_don_vi_id VÀ don_vi_truc_thuoc_id
        if (!co_quan_don_vi_id || !don_vi_truc_thuoc_id) {
          throw new ValidationError(
            'Tài khoản USER phải có đầy đủ thông tin Cơ quan đơn vị và Đơn vị trực thuộc. Vui lòng chọn cả hai.'
          );
        }
      }

      // Kiểm tra chuc_vu_id
      if (!chuc_vu_id) {
        throw new ValidationError('Vui lòng chọn chức vụ');
      }

      // Kiểm tra cơ quan đơn vị có tồn tại không
      if (co_quan_don_vi_id) {
        const coQuanDonVi = await prisma.coQuanDonVi.findUnique({
          where: { id: co_quan_don_vi_id },
        });
        if (!coQuanDonVi) {
          throw new NotFoundError('Cơ quan đơn vị');
        }
      }

      // Kiểm tra đơn vị trực thuộc có tồn tại và thuộc đúng cơ quan đơn vị không
      if (don_vi_truc_thuoc_id) {
        const donViTrucThuoc = await prisma.donViTrucThuoc.findUnique({
          where: { id: don_vi_truc_thuoc_id },
        });
        if (!donViTrucThuoc) {
          throw new NotFoundError('Đơn vị trực thuộc');
        }
        // Validate đơn vị trực thuộc phải thuộc cơ quan đơn vị đã chọn
        if (co_quan_don_vi_id && donViTrucThuoc.co_quan_don_vi_id !== co_quan_don_vi_id) {
          throw new ValidationError('Đơn vị trực thuộc không thuộc cơ quan đơn vị đã chọn');
        }
      }

      // Kiểm tra chức vụ có tồn tại không
      const chucVu = await prisma.chucVu.findUnique({
        where: { id: chuc_vu_id },
        select: { he_so_chuc_vu: true },
      });
      if (!chucVu) {
        throw new NotFoundError('Chức vụ');
      }

      // Lưu thông tin cần thiết cho transaction
      personnelDataForCreate = {
        cccd: null,
        ho_ten: username,
        chuc_vu_id,
        ngay_sinh: null,
        ngay_nhap_ngu: null,
        co_quan_don_vi_id: co_quan_don_vi_id || null,
        don_vi_truc_thuoc_id: don_vi_truc_thuoc_id || null,
      };
      heSoChucVu = chucVu?.he_so_chuc_vu || 0;
    }

    // Validate mật khẩu
    this.validatePassword(password);

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    const newAccount = await prisma.$transaction(async tx => {
      // Tạo QuanNhan nếu cần
      if (personnelDataForCreate) {
        const newPersonnel = await tx.quanNhan.create({
          data: personnelDataForCreate,
        });
        finalPersonnelId = newPersonnel.id;

        // Tạo LichSuChucVu cho chức vụ ban đầu
        await tx.lichSuChucVu.create({
          data: {
            quan_nhan_id: newPersonnel.id,
            chuc_vu_id: chuc_vu_id,
            he_so_chuc_vu: heSoChucVu,
            ngay_bat_dau: new Date(),
            ngay_ket_thuc: null,
            so_thang: null,
          },
        });

        // Cập nhật số lượng cho Cơ quan đơn vị
        if (co_quan_don_vi_id) {
          await tx.coQuanDonVi.update({
            where: { id: co_quan_don_vi_id },
            data: { so_luong: { increment: 1 } },
          });
        }

        // Cập nhật số lượng cho Đơn vị trực thuộc
        if (don_vi_truc_thuoc_id) {
          await tx.donViTrucThuoc.update({
            where: { id: don_vi_truc_thuoc_id },
            data: { so_luong: { increment: 1 } },
          });
        }
      }

      // Tạo tài khoản
      return tx.taiKhoan.create({
        data: {
          quan_nhan_id: finalPersonnelId || null,
          username,
          password_hash: hashedPassword,
          role,
        },
        include: {
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
        },
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

  /**
   * Cập nhật tài khoản (đổi vai trò)
   */
  async updateAccount(id, data) {
    const { role, password } = data;

    // Kiểm tra tài khoản có tồn tại không
    const account = await prisma.taiKhoan.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    // Chuẩn bị data để cập nhật
    const updateData = {};

    // Cập nhật vai trò nếu có
    if (role) {
      updateData.role = role;
    }

    // Cập nhật mật khẩu nếu có
    if (password) {
      this.validatePassword(password);
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password_hash = hashedPassword;
    }

    // Cập nhật tài khoản
    const updatedAccount = await prisma.taiKhoan.update({
      where: { id },
      data: updateData,
      include: {
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
      },
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

  /**
   * Đặt lại mật khẩu cho tài khoản (mật khẩu mặc định: 123456)
   */
  async resetPassword(accountId) {
    // Kiểm tra tài khoản có tồn tại không
    const account = await prisma.taiKhoan.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    // Mật khẩu mặc định
    const defaultPassword = process.env.DEFAULT_PASSWORD || '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Cập nhật mật khẩu
    await prisma.taiKhoan.update({
      where: { id: accountId },
      data: { password_hash: hashedPassword },
    });

    return { message: 'Đặt lại mật khẩu thành công. Mật khẩu mới là mật khẩu mặc định' };
  }

  /**
   * Xóa tài khoản và toàn bộ dữ liệu liên quan (bao gồm cả quân nhân nếu có)
   * @param {string} id - ID tài khoản
   * @param {boolean} forceDelete - Bắt buộc xóa ngay cả khi có đề xuất PENDING
   */
  async deleteAccount(id, forceDelete = false) {
    // Kiểm tra tài khoản có tồn tại không
    const account = await prisma.taiKhoan.findUnique({
      where: { id },
      include: {
        QuanNhan: true,
      },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    // Không cho phép xóa SUPER_ADMIN
    if (account.role === ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Không thể xóa tài khoản SUPER_ADMIN');
    }

    let deletedProposals = 0;

    // Nếu có QuanNhan liên kết, xóa toàn bộ dữ liệu liên quan
    if (account.QuanNhan) {
      const personnelId = account.QuanNhan.id;
      const unitId = account.QuanNhan.co_quan_don_vi_id || account.QuanNhan.don_vi_truc_thuoc_id;
      const isCoQuanDonVi = !!account.QuanNhan.co_quan_don_vi_id;

      // Kiểm tra đề xuất chứa quân nhân này
      const proposals = await prisma.bangDeXuat.findMany({
        where: {
          OR: [
            {
              data_danh_hieu: {
                path: '$[*].personnel_id',
                array_contains: personnelId,
              },
            },
            {
              data_nien_han: {
                path: '$[*].personnel_id',
                array_contains: personnelId,
              },
            },
          ],
        },
      });

      // Tìm đề xuất PENDING chứa quân nhân
      const pendingProposals = proposals.filter(p => p.status === 'PENDING');

      if (pendingProposals.length > 0 && !forceDelete) {
        throw new ValidationError(
          `Không thể xóa tài khoản này vì quân nhân đang có ${pendingProposals.length} đề xuất chờ duyệt. ` +
            `Hãy xử lý các đề xuất trước hoặc sử dụng force delete.`
        );
      }

      // Sử dụng transaction để đảm bảo data integrity
      await prisma.$transaction(async tx => {
        // 1. Xóa quân nhân khỏi tất cả đề xuất
        for (const proposal of proposals) {
          let updated = false;

          // Xử lý data_danh_hieu
          if (proposal.data_danh_hieu && Array.isArray(proposal.data_danh_hieu)) {
            const filtered = proposal.data_danh_hieu.filter(
              item => item.personnel_id !== personnelId
            );
            if (filtered.length !== proposal.data_danh_hieu.length) {
              proposal.data_danh_hieu = filtered;
              updated = true;
            }
          }

          // Xử lý data_nien_han
          if (proposal.data_nien_han && Array.isArray(proposal.data_nien_han)) {
            const filtered = proposal.data_nien_han.filter(
              item => item.personnel_id !== personnelId
            );
            if (filtered.length !== proposal.data_nien_han.length) {
              proposal.data_nien_han = filtered;
              updated = true;
            }
          }

          // Cập nhật hoặc xóa đề xuất
          if (updated) {
            const isEmpty =
              (!proposal.data_danh_hieu || proposal.data_danh_hieu.length === 0) &&
              (!proposal.data_nien_han || proposal.data_nien_han.length === 0) &&
              (!proposal.data_thanh_tich || proposal.data_thanh_tich.length === 0);

            if (isEmpty) {
              await tx.bangDeXuat.delete({
                where: { id: proposal.id },
              });
              deletedProposals++;
            } else {
              await tx.bangDeXuat.update({
                where: { id: proposal.id },
                data: {
                  data_danh_hieu: proposal.data_danh_hieu || [],
                  data_nien_han: proposal.data_nien_han || [],
                },
              });
            }
          }
        }

        // 2. Xóa tài khoản (Prisma sẽ tự động cascade xóa: SystemLog, ThongBao)
        await tx.taiKhoan.delete({
          where: { id },
        });

        // 3. Xóa quân nhân (Prisma sẽ tự động cascade xóa:
        //    LichSuChucVu, ThanhTichKhoaHoc, DanhHieuHangNam,
        //    HoSoNienHan, HoSoHangNam)
        await tx.quanNhan.delete({
          where: { id: personnelId },
        });

        // 4. Giảm số lượng quân nhân trong đơn vị
        if (unitId) {
          try {
            if (isCoQuanDonVi) {
              await tx.coQuanDonVi.update({
                where: { id: unitId },
                data: {
                  so_luong: {
                    decrement: 1,
                  },
                },
              });
            } else {
              await tx.donViTrucThuoc.update({
                where: { id: unitId },
                data: {
                  so_luong: {
                    decrement: 1,
                  },
                },
              });
            }
          } catch (error) {
            throw new Error(`Không thể cập nhật số lượng quân nhân của đơn vị: ${error.message}`);
          }
        } else {
        }
      });

      return {
        message: 'Xóa tài khoản và toàn bộ dữ liệu liên quan thành công',
        deletedProposals,
      };
    } else {
      // Chỉ xóa tài khoản (không có quân nhân liên kết)
      await prisma.taiKhoan.delete({
        where: { id },
      });

      return { message: 'Xóa tài khoản thành công' };
    }
  }

  /**
   * Validate độ mạnh mật khẩu
   */
  validatePassword(password) {
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

module.exports = new AccountService();
