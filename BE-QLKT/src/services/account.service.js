const bcrypt = require('bcrypt');
const { prisma } = require('../models');

class AccountService {
  /**
   * Lấy danh sách tài khoản (có phân trang)
   */
  async getAccounts(page = 1, limit = 10, search = '', role, excludeSuperAdmin = false) {
    try {
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
      const excludeFilter = excludeSuperAdmin ? { role: { not: 'SUPER_ADMIN' } } : {};

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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy chi tiết tài khoản theo id
   */
  async getAccountById(id) {
    try {
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
        throw new Error('Tài khoản không tồn tại');
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo tài khoản mới
   */
  async createAccount(data) {
    try {
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
        throw new Error('Tên đăng nhập đã tồn tại');
      }

      let finalPersonnelId = personnel_id || null;

      // Nếu có personnel_id, kiểm tra quân nhân có tồn tại không
      if (personnel_id) {
        const personnel = await prisma.quanNhan.findUnique({
          where: { id: personnel_id },
        });

        if (!personnel) {
          throw new Error('Quân nhân không tồn tại');
        }

        // Kiểm tra quân nhân đã có tài khoản chưa
        const existingPersonnelAccount = await prisma.taiKhoan.findUnique({
          where: { quan_nhan_id: personnel_id },
        });

        if (existingPersonnelAccount) {
          throw new Error('Quân nhân này đã có tài khoản');
        }
      }

      // Tự động tạo QuanNhan cho MANAGER/USER
      if ((role === 'MANAGER' || role === 'USER') && !personnel_id) {
        // ==================== VALIDATION THEO ROLE ====================
        if (role === 'MANAGER') {
          // MANAGER: Bắt buộc có co_quan_don_vi_id, KHÔNG có don_vi_truc_thuoc_id
          if (!co_quan_don_vi_id) {
            throw new Error(
              'Tài khoản MANAGER phải có thông tin Cơ quan đơn vị. Vui lòng chọn Cơ quan đơn vị.'
            );
          }
          if (don_vi_truc_thuoc_id) {
            throw new Error(
              'Tài khoản MANAGER chỉ được chọn Cơ quan đơn vị, không được chọn Đơn vị trực thuộc.'
            );
          }
        } else if (role === 'USER') {
          // USER: Bắt buộc có CẢ HAI co_quan_don_vi_id VÀ don_vi_truc_thuoc_id
          if (!co_quan_don_vi_id || !don_vi_truc_thuoc_id) {
            throw new Error(
              'Tài khoản USER phải có đầy đủ thông tin Cơ quan đơn vị và Đơn vị trực thuộc. Vui lòng chọn cả hai.'
            );
          }
        }

        // Kiểm tra chuc_vu_id
        if (!chuc_vu_id) {
          throw new Error('Vui lòng chọn chức vụ');
        }

        // ==================== VALIDATION DATABASE ====================
        // Kiểm tra cơ quan đơn vị có tồn tại không
        if (co_quan_don_vi_id) {
          const coQuanDonVi = await prisma.coQuanDonVi.findUnique({
            where: { id: co_quan_don_vi_id },
          });
          if (!coQuanDonVi) {
            throw new Error('Cơ quan đơn vị không tồn tại');
          }
        }

        // Kiểm tra đơn vị trực thuộc có tồn tại và thuộc đúng cơ quan đơn vị không
        if (don_vi_truc_thuoc_id) {
          const donViTrucThuoc = await prisma.donViTrucThuoc.findUnique({
            where: { id: don_vi_truc_thuoc_id },
          });
          if (!donViTrucThuoc) {
            throw new Error('Đơn vị trực thuộc không tồn tại');
          }
          // Validate đơn vị trực thuộc phải thuộc cơ quan đơn vị đã chọn
          if (co_quan_don_vi_id && donViTrucThuoc.co_quan_don_vi_id !== co_quan_don_vi_id) {
            throw new Error('Đơn vị trực thuộc không thuộc cơ quan đơn vị đã chọn');
          }
        }

        // Kiểm tra chức vụ có tồn tại không
        const chucVu = await prisma.chucVu.findUnique({
          where: { id: chuc_vu_id },
          select: { he_so_chuc_vu: true },
        });
        if (!chucVu) {
          throw new Error('Chức vụ không tồn tại');
        }

        // ==================== TẠO QUÂN NHÂN ====================
        const personnelData = {
          cccd: null, // CCCD có thể null, người dùng sẽ cập nhật sau
          ho_ten: username, // Dùng username làm họ tên mặc định
          chuc_vu_id,
          ngay_sinh: null,
          ngay_nhap_ngu: null,
          co_quan_don_vi_id: co_quan_don_vi_id || null,
          don_vi_truc_thuoc_id: don_vi_truc_thuoc_id || null,
        };

        // Tạo QuanNhan mới với thông tin tối thiểu
        const newPersonnel = await prisma.quanNhan.create({
          data: personnelData,
        });

        finalPersonnelId = newPersonnel.id;

        // Tạo LichSuChucVu cho chức vụ ban đầu
        const ngayBatDau = new Date();
        await prisma.lichSuChucVu.create({
          data: {
            quan_nhan_id: newPersonnel.id,
            chuc_vu_id: chuc_vu_id,
            he_so_chuc_vu: chucVu?.he_so_chuc_vu || 0,
            ngay_bat_dau: ngayBatDau,
            ngay_ket_thuc: null,
            so_thang: null, // Chưa kết thúc nên chưa tính được
          },
        });

        // ==================== CẬP NHẬT SỐ LƯỢNG QUÂN NHÂN ====================
        // Cập nhật số lượng cho Cơ quan đơn vị (nếu có)
        if (co_quan_don_vi_id) {
          try {
            await prisma.coQuanDonVi.update({
              where: { id: co_quan_don_vi_id },
              data: {
                so_luong: {
                  increment: 1,
                },
              },
            });
            console.log(`Đã tăng số lượng quân nhân của Cơ quan đơn vị ID: ${co_quan_don_vi_id}`);
          } catch (error) {
            console.error(
              `Lỗi khi cập nhật số lượng quân nhân cho Cơ quan đơn vị ID: ${co_quan_don_vi_id}`,
              error
            );
            throw new Error(
              `Không thể cập nhật số lượng quân nhân của cơ quan đơn vị: ${error.message}`
            );
          }
        }

        // Cập nhật số lượng cho Đơn vị trực thuộc (nếu có)
        if (don_vi_truc_thuoc_id) {
          try {
            await prisma.donViTrucThuoc.update({
              where: { id: don_vi_truc_thuoc_id },
              data: {
                so_luong: {
                  increment: 1,
                },
              },
            });
            console.log(
              `Đã tăng số lượng quân nhân của Đơn vị trực thuộc ID: ${don_vi_truc_thuoc_id}`
            );
          } catch (error) {
            console.error(
              `Lỗi khi cập nhật số lượng quân nhân cho Đơn vị trực thuộc ID: ${don_vi_truc_thuoc_id}`,
              error
            );
            throw new Error(
              `Không thể cập nhật số lượng quân nhân của đơn vị trực thuộc: ${error.message}`
            );
          }
        }
      }

      // Mã hóa mật khẩu
      const hashedPassword = await bcrypt.hash(password, 10);

      // Tạo tài khoản
      const newAccount = await prisma.taiKhoan.create({
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cập nhật tài khoản (đổi vai trò)
   */
  async updateAccount(id, data) {
    try {
      const { role, password } = data;

      // Kiểm tra tài khoản có tồn tại không
      const account = await prisma.taiKhoan.findUnique({
        where: { id },
      });

      if (!account) {
        throw new Error('Tài khoản không tồn tại');
      }

      // Chuẩn bị data để cập nhật
      const updateData = {};

      // Cập nhật vai trò nếu có
      if (role) {
        updateData.role = role;
      }

      // Cập nhật mật khẩu nếu có
      if (password) {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Đặt lại mật khẩu cho tài khoản (mật khẩu mặc định: 123456)
   */
  async resetPassword(accountId) {
    try {
      // Kiểm tra tài khoản có tồn tại không
      const account = await prisma.taiKhoan.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new Error('Tài khoản không tồn tại');
      }

      // Mật khẩu mặc định
      const defaultPassword = '123456';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      // Cập nhật mật khẩu
      await prisma.taiKhoan.update({
        where: { id: accountId },
        data: { password_hash: hashedPassword },
      });

      return { message: 'Đặt lại mật khẩu thành công. Mật khẩu mới: 123456' };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa tài khoản và toàn bộ dữ liệu liên quan (bao gồm cả quân nhân nếu có)
   * @param {string} id - ID tài khoản
   * @param {boolean} forceDelete - Bắt buộc xóa ngay cả khi có đề xuất PENDING
   */
  async deleteAccount(id, forceDelete = false) {
    try {
      // Kiểm tra tài khoản có tồn tại không
      const account = await prisma.taiKhoan.findUnique({
        where: { id },
        include: {
          QuanNhan: true,
        },
      });

      if (!account) {
        throw new Error('Tài khoản không tồn tại');
      }

      // Không cho phép xóa SUPER_ADMIN
      if (account.role === 'SUPER_ADMIN') {
        throw new Error('Không thể xóa tài khoản SUPER_ADMIN');
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
          throw new Error(
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
                console.log(`Đã giảm số lượng quân nhân của Cơ quan đơn vị ID: ${unitId}`);
              } else {
                await tx.donViTrucThuoc.update({
                  where: { id: unitId },
                  data: {
                    so_luong: {
                      decrement: 1,
                    },
                  },
                });
                console.log(`Đã giảm số lượng quân nhân của Đơn vị trực thuộc ID: ${unitId}`);
              }
            } catch (error) {
              console.error(`Lỗi khi cập nhật số lượng quân nhân cho đơn vị ID: ${unitId}`, error);
              throw new Error(`Không thể cập nhật số lượng quân nhân của đơn vị: ${error.message}`);
            }
          } else {
            console.warn(`Quân nhân ID: ${personnelId} không có đơn vị`);
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
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AccountService();
