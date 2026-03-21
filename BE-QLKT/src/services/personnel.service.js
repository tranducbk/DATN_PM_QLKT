const { prisma } = require('../models');
const ExcelJS = require('exceljs');
const bcrypt = require('bcrypt');
const { parseCCCD } = require('../helpers/cccdHelper');
const { ROLES } = require('../constants/roles');
const { NotFoundError, ValidationError, ForbiddenError } = require('../middlewares/errorHandler');
const profileService = require('../services/profile.service');
const notificationHelper = require('../helpers/notification');

class PersonnelService {
  parseCCCD(value) {
    return parseCCCD(value);
  }

  /**
   * Lấy danh sách quân nhân (có phân trang)
   * Admin: lấy tất cả
   * Manager: lọc theo đơn vị của mình (bao gồm cả quân nhân thuộc đơn vị trực thuộc)
   */
  async getPersonnel(page = 1, limit = 10, userRole, userQuanNhanId, filters = {}) {
    const skip = (page - 1) * limit;
    const { search, unit_id } = filters;
    let whereCondition = {};
    const andConditions = [];

    // Nếu là MANAGER, chỉ lấy quân nhân trong đơn vị của mình
    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const manager = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (manager && manager.co_quan_don_vi_id) {
        // Lấy tất cả đơn vị trực thuộc của cơ quan đơn vị này
        const donViTrucThuocList = await prisma.donViTrucThuoc.findMany({
          where: { co_quan_don_vi_id: manager.co_quan_don_vi_id },
          select: { id: true },
        });

        const donViTrucThuocIds = donViTrucThuocList.map(dv => dv.id);

        // Filter: quân nhân thuộc cơ quan đơn vị HOẶC thuộc đơn vị trực thuộc của cơ quan đơn vị đó
        andConditions.push({
          OR: [
            { co_quan_don_vi_id: manager.co_quan_don_vi_id },
            ...(donViTrucThuocIds.length > 0
              ? [{ don_vi_truc_thuoc_id: { in: donViTrucThuocIds } }]
              : []),
          ],
        });
      }
    }

    // Filter theo unit_id nếu có (lọc theo cơ quan đơn vị hoặc đơn vị trực thuộc)
    if (unit_id) {
      // Lấy tất cả đơn vị trực thuộc của cơ quan đơn vị được filter
      const donViTrucThuocList = await prisma.donViTrucThuoc.findMany({
        where: { co_quan_don_vi_id: unit_id },
        select: { id: true },
      });
      const donViTrucThuocIds = donViTrucThuocList.map(dv => dv.id);

      // Quân nhân thuộc cơ quan đơn vị này HOẶC thuộc đơn vị trực thuộc của nó
      andConditions.push({
        OR: [
          { co_quan_don_vi_id: unit_id },
          ...(donViTrucThuocIds.length > 0
            ? [{ don_vi_truc_thuoc_id: { in: donViTrucThuocIds } }]
            : []),
        ],
      });
    }

    // Filter theo search (tìm theo họ tên hoặc CCCD)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      andConditions.push({
        OR: [
          { ho_ten: { contains: searchTerm, mode: 'insensitive' } },
          { cccd: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    // Kết hợp tất cả điều kiện
    if (andConditions.length > 0) {
      whereCondition = {
        AND: andConditions,
      };
    }

    const [personnel, total] = await Promise.all([
      prisma.quanNhan.findMany({
        where: whereCondition,
        skip,
        take: parseInt(limit),
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          ChucVu: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.quanNhan.count({ where: whereCondition }),
    ]);

    return {
      personnel,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lấy chi tiết 1 quân nhân
   */
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

    // Kiểm tra quyền truy cập
    // USER chỉ xem được thông tin của chính mình
    if (userRole === ROLES.USER && userQuanNhanId !== id) {
      throw new ForbiddenError('Bạn không có quyền xem thông tin này');
    }

    // MANAGER chỉ xem được quân nhân trong đơn vị của mình (bao gồm đơn vị trực thuộc)
    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const manager = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (manager && manager.co_quan_don_vi_id) {
        // Lấy tất cả đơn vị trực thuộc của cơ quan đơn vị này
        const donViTrucThuocList = await prisma.donViTrucThuoc.findMany({
          where: { co_quan_don_vi_id: manager.co_quan_don_vi_id },
          select: { id: true },
        });
        const donViTrucThuocIds = donViTrucThuocList.map(dv => dv.id);

        // Kiểm tra quân nhân có thuộc cơ quan đơn vị HOẶC đơn vị trực thuộc không
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

  /**
   * Thêm quân nhân mới - tự động tạo tài khoản
   */
  async createPersonnel(data) {
    const { cccd, unit_id, position_id, role = ROLES.USER } = data;

    // Kiểm tra CCCD đã tồn tại chưa
    const existingPersonnel = await prisma.quanNhan.findUnique({
      where: { cccd },
    });

    if (existingPersonnel) {
      throw new ValidationError('CCCD đã tồn tại trong hệ thống');
    }

    // Kiểm tra đơn vị có tồn tại không (có thể là CoQuanDonVi hoặc DonViTrucThuoc)
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({ where: { id: unit_id } }),
      prisma.donViTrucThuoc.findUnique({ where: { id: unit_id } }),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new NotFoundError('Đơn vị');
    }

    // Kiểm tra chức vụ có tồn tại không
    const position = await prisma.chucVu.findUnique({
      where: { id: position_id },
    });

    if (!position) {
      throw new NotFoundError('Chức vụ');
    }

    // Tạo username từ CCCD
    const username = cccd;

    // Kiểm tra username đã tồn tại chưa
    const existingAccount = await prisma.taiKhoan.findUnique({
      where: { username },
    });

    if (existingAccount) {
      throw new ValidationError('Username (CCCD) đã tồn tại trong hệ thống tài khoản');
    }

    // Xác định loại đơn vị và set đúng foreign key
    const isCoQuanDonVi = !!coQuanDonVi;
    const personnelData = {
      cccd,
      ho_ten: username, // Họ tên mặc định = username (CCCD)
      ngay_sinh: null,
      ngay_nhap_ngu: new Date(), // Ngày nhập ngũ mặc định = hôm nay
      chuc_vu_id: position_id,
    };

    if (isCoQuanDonVi) {
      personnelData.co_quan_don_vi_id = unit_id;
      personnelData.don_vi_truc_thuoc_id = null;
    } else {
      personnelData.co_quan_don_vi_id = null;
      personnelData.don_vi_truc_thuoc_id = unit_id;
    }

    // Hash password trước transaction (CPU-intensive, không cần trong transaction)
    const defaultPassword = process.env.DEFAULT_PASSWORD || '123456'; // Mật khẩu mặc định
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
    const result = await prisma.$transaction(async tx => {
      // Tạo quân nhân mới với họ tên mặc định = username (CCCD)
      const newPersonnel = await tx.quanNhan.create({
        data: personnelData,
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          ChucVu: true,
        },
      });

      // Lấy thông tin chức vụ để lưu hệ số chức vụ
      const chucVu = await tx.chucVu.findUnique({
        where: { id: position_id },
        select: { he_so_chuc_vu: true },
      });

      // Tạo LichSuChucVu cho chức vụ ban đầu
      const ngayBatDau = new Date();
      await tx.lichSuChucVu.create({
        data: {
          quan_nhan_id: newPersonnel.id,
          chuc_vu_id: position_id,
          he_so_chuc_vu: chucVu?.he_so_chuc_vu || 0,
          ngay_bat_dau: ngayBatDau, // Bắt đầu từ ngày tạo
          ngay_ket_thuc: null, // Chức vụ hiện tại
          so_thang: null, // Chưa kết thúc nên chưa tính được
        },
      });

      // Tự động tạo tài khoản
      const account = await tx.taiKhoan.create({
        data: {
          username,
          password_hash: hashedPassword,
          role: role,
          quan_nhan_id: newPersonnel.id,
        },
      });

      // Cập nhật số lượng quân nhân trong đơn vị
      if (isCoQuanDonVi) {
        await tx.coQuanDonVi.update({
          where: { id: unit_id },
          data: {
            so_luong: {
              increment: 1,
            },
          },
        });
      } else {
        await tx.donViTrucThuoc.update({
          where: { id: unit_id },
          data: {
            so_luong: {
              increment: 1,
            },
          },
        });
      }

      // Trả về kèm thông tin tài khoản
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
  async updatePersonnel(id, data, userRole, userQuanNhanId, adminUsername) {
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

    // Kiểm tra quân nhân có tồn tại không
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: String(id) },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // Kiểm tra quyền truy cập
    // USER chỉ sửa được thông tin của chính mình
    if (userRole === ROLES.USER) {
      if (userQuanNhanId !== id) {
        throw new ForbiddenError('Bạn không có quyền sửa thông tin của người khác');
      }

      // USER không được phép đổi unit_id và position_id
      if (unit_id || position_id) {
        throw new ForbiddenError('Bạn không có quyền thay đổi đơn vị hoặc chức vụ');
      }
    }

    // Kiểm tra quyền: MANAGER chỉ sửa được quân nhân trong đơn vị của mình
    if (userRole === ROLES.MANAGER && userQuanNhanId) {
      const manager = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      if (manager) {
        let hasPermission = false;

        // Trường hợp 1: Manager thuộc cơ quan đơn vị (co_quan_don_vi_id)
        if (manager.co_quan_don_vi_id && !manager.don_vi_truc_thuoc_id) {
          // Manager có thể sửa:
          // - Quân nhân trong cùng cơ quan đơn vị
          // - Quân nhân trong các đơn vị trực thuộc của cơ quan đơn vị đó
          if (personnel.co_quan_don_vi_id === manager.co_quan_don_vi_id) {
            hasPermission = true;
          } else if (personnel.don_vi_truc_thuoc_id) {
            // Kiểm tra xem đơn vị trực thuộc của quân nhân có thuộc cơ quan đơn vị của manager không
            const donViTrucThuoc = await prisma.donViTrucThuoc.findUnique({
              where: { id: personnel.don_vi_truc_thuoc_id },
              select: { co_quan_don_vi_id: true },
            });
            if (donViTrucThuoc && donViTrucThuoc.co_quan_don_vi_id === manager.co_quan_don_vi_id) {
              hasPermission = true;
            }
          }
        }
        // Trường hợp 2: Manager thuộc đơn vị trực thuộc (don_vi_truc_thuoc_id)
        else if (manager.don_vi_truc_thuoc_id) {
          // Manager có thể sửa:
          // - Quân nhân trong cùng đơn vị trực thuộc
          // - Quân nhân trong cùng cơ quan đơn vị cha (nếu có)
          if (personnel.don_vi_truc_thuoc_id === manager.don_vi_truc_thuoc_id) {
            hasPermission = true;
          } else if (personnel.co_quan_don_vi_id) {
            // Kiểm tra xem cơ quan đơn vị của quân nhân có trùng với cơ quan đơn vị cha của manager không
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

    // Kiểm tra CCCD mới nếu có thay đổi
    if (cccd && cccd !== personnel.cccd) {
      const existingPersonnel = await prisma.quanNhan.findUnique({
        where: { cccd },
      });

      if (existingPersonnel) {
        throw new ValidationError('CCCD đã tồn tại trong hệ thống');
      }
    }

    // Kiểm tra đơn vị mới nếu có
    const currentUnitId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
    if (unit_id && unit_id !== currentUnitId) {
      const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
        prisma.coQuanDonVi.findUnique({ where: { id: unit_id } }),
        prisma.donViTrucThuoc.findUnique({ where: { id: unit_id } }),
      ]);

      if (!coQuanDonVi && !donViTrucThuoc) {
        throw new NotFoundError('Đơn vị');
      }
    }

    // Kiểm tra chức vụ mới nếu có
    if (position_id && position_id !== personnel.chuc_vu_id) {
      const position = await prisma.chucVu.findUnique({
        where: { id: position_id },
      });

      if (!position) {
        throw new NotFoundError('Chức vụ');
      }
    }

    // Validate giới tính: bắt buộc khi cập nhật
    if (gioi_tinh !== undefined) {
      if (!gioi_tinh || (gioi_tinh !== 'NAM' && gioi_tinh !== 'NU')) {
        throw new ValidationError('Giới tính là bắt buộc và phải là NAM hoặc NU');
      }
    } else if (!personnel.gioi_tinh) {
      // Nếu chưa có giới tính và không được cung cấp trong lần cập nhật này
      throw new ValidationError('Giới tính là bắt buộc. Vui lòng cập nhật thông tin giới tính.');
    }

    // Chuẩn bị data update
    const updateData = {
      ho_ten: ho_ten !== undefined ? ho_ten : personnel.ho_ten,
      gioi_tinh: gioi_tinh !== undefined ? gioi_tinh : personnel.gioi_tinh,
      ngay_sinh:
        ngay_sinh !== undefined ? (ngay_sinh ? new Date(ngay_sinh) : null) : personnel.ngay_sinh,
      cccd: cccd !== undefined ? cccd : personnel.cccd,
      cap_bac: cap_bac !== undefined ? cap_bac : personnel.cap_bac,
      ngay_nhap_ngu:
        ngay_nhap_ngu !== undefined
          ? ngay_nhap_ngu
            ? new Date(ngay_nhap_ngu)
            : null
          : personnel.ngay_nhap_ngu,
      ngay_xuat_ngu:
        ngay_xuat_ngu !== undefined
          ? ngay_xuat_ngu
            ? new Date(ngay_xuat_ngu)
            : null
          : personnel.ngay_xuat_ngu,
      que_quan_2_cap: que_quan_2_cap !== undefined ? que_quan_2_cap : personnel.que_quan_2_cap,
      que_quan_3_cap: que_quan_3_cap !== undefined ? que_quan_3_cap : personnel.que_quan_3_cap,
      tru_quan: tru_quan !== undefined ? tru_quan : personnel.tru_quan,
      cho_o_hien_nay: cho_o_hien_nay !== undefined ? cho_o_hien_nay : personnel.cho_o_hien_nay,
      ngay_vao_dang:
        ngay_vao_dang !== undefined
          ? ngay_vao_dang
            ? new Date(ngay_vao_dang)
            : null
          : personnel.ngay_vao_dang,
      ngay_vao_dang_chinh_thuc:
        ngay_vao_dang_chinh_thuc !== undefined
          ? ngay_vao_dang_chinh_thuc
            ? new Date(ngay_vao_dang_chinh_thuc)
            : null
          : personnel.ngay_vao_dang_chinh_thuc,
      so_the_dang_vien:
        so_the_dang_vien !== undefined ? so_the_dang_vien : personnel.so_the_dang_vien,
      so_dien_thoai: so_dien_thoai !== undefined ? so_dien_thoai : personnel.so_dien_thoai,
      chuc_vu_id: position_id || personnel.chuc_vu_id,
    };

    // Xử lý đơn vị: ưu tiên co_quan_don_vi_id và don_vi_truc_thuoc_id từ frontend
    if (co_quan_don_vi_id !== undefined || don_vi_truc_thuoc_id !== undefined) {
      // Nếu có don_vi_truc_thuoc_id, tự động lấy co_quan_don_vi_id từ đơn vị cha
      if (don_vi_truc_thuoc_id) {
        const donViTrucThuoc = await prisma.donViTrucThuoc.findUnique({
          where: { id: don_vi_truc_thuoc_id },
          select: { co_quan_don_vi_id: true },
        });

        if (donViTrucThuoc) {
          // Tự động set co_quan_don_vi_id theo đơn vị cha của đơn vị trực thuộc
          updateData.co_quan_don_vi_id = donViTrucThuoc.co_quan_don_vi_id;
          updateData.don_vi_truc_thuoc_id = don_vi_truc_thuoc_id;
        } else {
          throw new NotFoundError('Đơn vị trực thuộc');
        }
      } else if (co_quan_don_vi_id) {
        // Chỉ có cơ quan đơn vị, không có đơn vị trực thuộc
        updateData.co_quan_don_vi_id = co_quan_don_vi_id;
        updateData.don_vi_truc_thuoc_id = null;
      } else {
        // don_vi_truc_thuoc_id = null, giữ hoặc cập nhật co_quan_don_vi_id
        updateData.co_quan_don_vi_id =
          co_quan_don_vi_id !== undefined ? co_quan_don_vi_id : personnel.co_quan_don_vi_id;
        updateData.don_vi_truc_thuoc_id = null;
      }
    } else if (unit_id && unit_id !== currentUnitId) {
      // Legacy: xử lý unit_id (tự động phát hiện loại đơn vị)
      const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
        prisma.coQuanDonVi.findUnique({ where: { id: unit_id } }),
        prisma.donViTrucThuoc.findUnique({
          where: { id: unit_id },
          select: { id: true, co_quan_don_vi_id: true },
        }),
      ]);

      if (coQuanDonVi) {
        updateData.co_quan_don_vi_id = unit_id;
        updateData.don_vi_truc_thuoc_id = null;
      } else if (donViTrucThuoc) {
        // Tự động set co_quan_don_vi_id theo đơn vị cha
        updateData.co_quan_don_vi_id = donViTrucThuoc.co_quan_don_vi_id;
        updateData.don_vi_truc_thuoc_id = unit_id;
      }
    } else {
      // Giữ nguyên đơn vị hiện tại
      updateData.co_quan_don_vi_id = personnel.co_quan_don_vi_id;
      updateData.don_vi_truc_thuoc_id = personnel.don_vi_truc_thuoc_id;
    }

    // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu cho tất cả writes
    const { updatedPersonnel, unitTransferInfo } = await prisma.$transaction(async tx => {
      // Cập nhật quân nhân
      const txUpdatedPersonnel = await tx.quanNhan.update({
        where: { id: String(id) },
        data: updateData,
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          ChucVu: true,
        },
      });

      // Nếu đổi chức vụ, cập nhật lịch sử chức vụ
      if (position_id && position_id !== personnel.chuc_vu_id) {
        const today = new Date();

        // 1. Đóng lịch sử chức vụ cũ và tính số tháng
        const oldHistories = await tx.lichSuChucVu.findMany({
          where: {
            quan_nhan_id: id,
            ngay_ket_thuc: null, // Chỉ đóng lịch sử đang active
          },
        });

        // Cập nhật từng lịch sử cũ với số tháng đã tính
        for (const oldHistory of oldHistories) {
          const ngayBatDauOld = new Date(oldHistory.ngay_bat_dau);
          let months = (today.getFullYear() - ngayBatDauOld.getFullYear()) * 12;
          months += today.getMonth() - ngayBatDauOld.getMonth();
          // Nếu ngày kết thúc < ngày bắt đầu trong tháng thì trừ 1 tháng
          if (today.getDate() < ngayBatDauOld.getDate()) {
            months--;
          }
          const soThangOld = Math.max(0, months);

          await tx.lichSuChucVu.update({
            where: { id: oldHistory.id },
            data: {
              ngay_ket_thuc: today,
              so_thang: soThangOld,
            },
          });
        }

        // 2. Lấy thông tin chức vụ mới để lưu hệ số chức vụ
        const newChucVu = await tx.chucVu.findUnique({
          where: { id: position_id },
          select: { he_so_chuc_vu: true },
        });

        // 3. Tạo lịch sử chức vụ mới
        await tx.lichSuChucVu.create({
          data: {
            quan_nhan_id: id,
            chuc_vu_id: position_id,
            he_so_chuc_vu: newChucVu?.he_so_chuc_vu || 0,
            ngay_bat_dau: today,
            ngay_ket_thuc: null, // Chức vụ hiện tại
            so_thang: null, // Chưa kết thúc nên chưa tính được
          },
        });
      }

      // Nếu đổi đơn vị, cập nhật số lượng quân nhân
      let txUnitTransferInfo = null;

      // Phát hiện chuyển đơn vị: so sánh đơn vị cũ và mới
      const oldCoQuanDonViId = personnel.co_quan_don_vi_id;
      const oldDonViTrucThuocId = personnel.don_vi_truc_thuoc_id;
      const newCoQuanDonViId = updateData.co_quan_don_vi_id;
      const newDonViTrucThuocId = updateData.don_vi_truc_thuoc_id;

      // Kiểm tra xem đơn vị có thay đổi không
      const coQuanDonViChanged = oldCoQuanDonViId !== newCoQuanDonViId;
      const donViTrucThuocChanged = oldDonViTrucThuocId !== newDonViTrucThuocId;
      const unitChanged = coQuanDonViChanged || donViTrucThuocChanged;

      if (unitChanged) {
        // Lấy thông tin đơn vị cũ và mới để gửi notification
        let oldUnitInfo = null;
        let newUnitInfo = null;

        // Xác định đơn vị cũ (ưu tiên đơn vị trực thuộc nếu có)
        const oldPrimaryUnitId = oldDonViTrucThuocId || oldCoQuanDonViId;
        if (oldPrimaryUnitId) {
          if (oldDonViTrucThuocId) {
            const oldDvtt = await tx.donViTrucThuoc.findUnique({
              where: { id: oldDonViTrucThuocId },
              select: { id: true, ten_don_vi: true },
            });
            if (oldDvtt) {
              oldUnitInfo = {
                id: oldDvtt.id,
                ten_don_vi: oldDvtt.ten_don_vi,
                isCoQuanDonVi: false,
              };
              // Giảm số lượng ở đơn vị trực thuộc cũ
              await tx.donViTrucThuoc.update({
                where: { id: oldDonViTrucThuocId },
                data: { so_luong: { decrement: 1 } },
              });
            }
          } else if (oldCoQuanDonViId) {
            const oldCqDv = await tx.coQuanDonVi.findUnique({
              where: { id: oldCoQuanDonViId },
              select: { id: true, ten_don_vi: true },
            });
            if (oldCqDv) {
              oldUnitInfo = { id: oldCqDv.id, ten_don_vi: oldCqDv.ten_don_vi, isCoQuanDonVi: true };
              // Giảm số lượng ở cơ quan đơn vị cũ
              await tx.coQuanDonVi.update({
                where: { id: oldCoQuanDonViId },
                data: { so_luong: { decrement: 1 } },
              });
            }
          }
        }

        // Xác định đơn vị mới (ưu tiên đơn vị trực thuộc nếu có)
        const newPrimaryUnitId = newDonViTrucThuocId || newCoQuanDonViId;
        if (newPrimaryUnitId) {
          if (newDonViTrucThuocId) {
            const newDvtt = await tx.donViTrucThuoc.findUnique({
              where: { id: newDonViTrucThuocId },
              select: { id: true, ten_don_vi: true },
            });
            if (newDvtt) {
              newUnitInfo = {
                id: newDvtt.id,
                ten_don_vi: newDvtt.ten_don_vi,
                isCoQuanDonVi: false,
              };
              // Tăng số lượng ở đơn vị trực thuộc mới
              await tx.donViTrucThuoc.update({
                where: { id: newDonViTrucThuocId },
                data: { so_luong: { increment: 1 } },
              });
            }
          } else if (newCoQuanDonViId) {
            const newCqDv = await tx.coQuanDonVi.findUnique({
              where: { id: newCoQuanDonViId },
              select: { id: true, ten_don_vi: true },
            });
            if (newCqDv) {
              newUnitInfo = { id: newCqDv.id, ten_don_vi: newCqDv.ten_don_vi, isCoQuanDonVi: true };
              // Tăng số lượng ở cơ quan đơn vị mới
              await tx.coQuanDonVi.update({
                where: { id: newCoQuanDonViId },
                data: { so_luong: { increment: 1 } },
              });
            }
          }
        }

        // Lưu thông tin chuyển đơn vị để trả về và gửi notification
        if (oldUnitInfo || newUnitInfo) {
          txUnitTransferInfo = {
            oldUnit: oldUnitInfo,
            newUnit: newUnitInfo,
          };
        }
      }

      return { updatedPersonnel: txUpdatedPersonnel, unitTransferInfo: txUnitTransferInfo };
    });

    // Tự động cập nhật lại hồ sơ sau khi update (ngoài transaction)
    try {
      await profileService.recalculateAnnualProfile(id);
    } catch (recalcError) {
      // Không throw error để không ảnh hưởng đến việc update personnel
    }

    // Gửi thông báo nếu có chuyển đơn vị (ngoài transaction)
    if (unitTransferInfo && adminUsername) {
      try {
        await notificationHelper.notifyOnPersonnelTransfer(
          updatedPersonnel,
          unitTransferInfo.oldUnit,
          unitTransferInfo.newUnit,
          adminUsername
        );
      } catch (notifError) {
        // Không throw error để không ảnh hưởng đến việc update personnel
      }
    }

    // Trả về kết quả với thông tin chuyển đơn vị (nếu có)
    return {
      ...updatedPersonnel,
      unitTransferInfo,
    };
  }

  /**
   * Xóa quân nhân và tất cả dữ liệu liên quan
   * Cascade delete: TaiKhoan, LichSuChucVu, ThanhTichKhoaHoc, DanhHieuHangNam,
   * KhenThuongCongHien, HuanChuongQuanKyQuyetThang, KyNiemChuongVSNXDQDNDVN,
   * KhenThuongHCCSVV, KhenThuongDotXuat, HoSoNienHan, HoSoCongHien, HoSoHangNam
   */
  async deletePersonnel(id, userRole, userQuanNhanId) {
    // Kiểm tra quân nhân có tồn tại không
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: String(id) },
      include: {
        TaiKhoan: true,
      },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // Chỉ ADMIN và SUPER_ADMIN mới được xóa quân nhân
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.SUPER_ADMIN) {
      throw new ForbiddenError('Chỉ Admin mới có quyền xóa quân nhân');
    }

    // Không cho phép tự xóa chính mình
    if (userQuanNhanId === id) {
      throw new ValidationError('Không thể xóa chính mình');
    }

    // Lưu lại đơn vị để cập nhật số lượng sau khi xóa
    const unitId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
    const isCoQuanDonVi = !!personnel.co_quan_don_vi_id;

    // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
    await prisma.$transaction(async tx => {
      // 1. Xóa tài khoản (TaiKhoan)
      if (personnel.TaiKhoan) {
        await tx.taiKhoan.delete({
          where: { id: personnel.TaiKhoan.id },
        });
      }

      // 2. Xóa lịch sử chức vụ (LichSuChucVu)
      await tx.lichSuChucVu.deleteMany({
        where: { quan_nhan_id: id },
      });

      // 3. Xóa thành tích khoa học (ThanhTichKhoaHoc)
      await tx.thanhTichKhoaHoc.deleteMany({
        where: { quan_nhan_id: id },
      });

      // 4. Xóa danh hiệu hằng năm (DanhHieuHangNam)
      await tx.danhHieuHangNam.deleteMany({
        where: { quan_nhan_id: id },
      });

      // 5. Xóa khen thưởng cống hiến (KhenThuongCongHien)
      await tx.khenThuongCongHien.deleteMany({
        where: { quan_nhan_id: id },
      });

      // 6. Xóa Huy chương quân kỳ Quyết thắng (HuanChuongQuanKyQuyetThang)
      await tx.huanChuongQuanKyQuyetThang.deleteMany({
        where: { quan_nhan_id: id },
      });

      // 7. Xóa Kỷ niệm chương VSNXD QĐNDVN (KyNiemChuongVSNXDQDNDVN)
      await tx.kyNiemChuongVSNXDQDNDVN.deleteMany({
        where: { quan_nhan_id: id },
      });

      // 8. Xóa Huy chương Chiến sĩ Vẻ vang (KhenThuongHCCSVV)
      await tx.khenThuongHCCSVV.deleteMany({
        where: { quan_nhan_id: id },
      });

      // 9. Xóa Khen thưởng đột xuất (KhenThuongDotXuat)
      await tx.khenThuongDotXuat.deleteMany({
        where: { quan_nhan_id: id },
      });

      // 10. Xóa Hồ sơ niên hạn (HoSoNienHan)
      await tx.hoSoNienHan.deleteMany({
        where: { quan_nhan_id: id },
      });

      // 11. Xóa Hồ sơ cống hiến (HoSoCongHien)
      await tx.hoSoCongHien.deleteMany({
        where: { quan_nhan_id: id },
      });

      // 12. Xóa Hồ sơ hằng năm (HoSoHangNam)
      await tx.hoSoHangNam.deleteMany({
        where: { quan_nhan_id: id },
      });

      // 13. Xóa quân nhân
      await tx.quanNhan.delete({
        where: { id: String(id) },
      });

      // 14. Giảm số lượng quân nhân trong đơn vị
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
      message: 'Xóa quân nhân và toàn bộ dữ liệu liên quan thành công',
      ho_ten: personnel.ho_ten,
      cccd: personnel.cccd,
    };
  }

  /**
   * Xuất toàn bộ dữ liệu ra Excel (sẽ implement sau)
   */
  async exportPersonnel() {
    const personnel = await prisma.quanNhan.findMany({
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
        ChucVu: true,
      },
      orderBy: [{ co_quan_don_vi_id: 'asc' }, { don_vi_truc_thuoc_id: 'asc' }, { ho_ten: 'asc' }],
    });

    // Tạo workbook Excel
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

    // Format cột CCCD thành Text (để giữ số 0 đầu tiên)
    worksheet.getColumn(1).numFmt = '@';

    personnel.forEach(p => {
      worksheet.addRow({
        cccd: p.cccd,
        ho_ten: p.ho_ten,
        ngay_sinh: p.ngay_sinh ? new Date(p.ngay_sinh).toISOString().slice(0, 10) : '',
        ngay_nhap_ngu: p.ngay_nhap_ngu ? new Date(p.ngay_nhap_ngu).toISOString().slice(0, 10) : '',
        ma_don_vi: (p.DonViTrucThuoc || p.CoQuanDonVi)?.ma_don_vi || '',
        ten_don_vi: (p.DonViTrucThuoc || p.CoQuanDonVi)?.ten_don_vi || '',
        ten_chuc_vu: p.ChucVu?.ten_chuc_vu || '',
        is_manager: p.ChucVu?.is_manager ? 'TRUE' : 'FALSE',
        he_so_chuc_vu: p.ChucVu?.he_so_chuc_vu || '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /**
   * Xuất file mẫu Excel để import quân nhân
   */
  async exportPersonnelSample() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Mẫu Quân nhân');

    // Định nghĩa các cột
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

    // Format cột CCCD thành Text (để giữ số 0 đầu tiên)
    worksheet.getColumn(1).numFmt = '@';

    // Thêm dữ liệu mẫu
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
      worksheet.addRow(row);
    });

    // Thêm ghi chú
    worksheet.addRow([]);
    worksheet.addRow(['Ghi chú:']);
    worksheet.addRow(['- Các cột có dấu * là bắt buộc']);
    worksheet.addRow(['- Mã đơn vị phải tồn tại trong hệ thống']);
    worksheet.addRow(['- Tên chức vụ phải tồn tại trong hệ thống']);
    worksheet.addRow(['- Ngày tháng định dạng: YYYY-MM-DD']);
    worksheet.addRow(['- Trạng thái: ACTIVE hoặc INACTIVE']);

    // Style cho ghi chú
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
   * Import quân nhân từ file Excel buffer
   * Hỗ trợ các cột: CCCD, Họ tên, Ngày sinh, Ngày nhập ngũ, Mã đơn vị, Tên chức vụ
   */
  async importFromExcelBuffer(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new ValidationError('File Excel không hợp lệ');
    }

    // Đọc header map
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

    const created = [];
    const updated = [];
    const errors = [];

    // Duyệt các dòng dữ liệu
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
        if (!cccd && !ho_ten && !ma_don_vi && !ten_chuc_vu) continue; // dòng trống
        errors.push({ row: rowNumber, error: 'Thiếu dữ liệu bắt buộc' });
        continue;
      }

      // Tìm đơn vị (có thể là CoQuanDonVi hoặc DonViTrucThuoc)
      const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
        prisma.coQuanDonVi.findUnique({ where: { ma_don_vi } }),
        prisma.donViTrucThuoc.findUnique({ where: { ma_don_vi } }),
      ]);

      const unit = coQuanDonVi || donViTrucThuoc;
      if (!unit) {
        errors.push({
          row: rowNumber,
          error: `Không tìm thấy đơn vị với mã ${ma_don_vi}`,
        });
        continue;
      }

      // Tìm chức vụ theo tên trong đơn vị
      const position = await prisma.chucVu.findFirst({
        where: {
          ten_chuc_vu,
          OR: [{ co_quan_don_vi_id: unit.id }, { don_vi_truc_thuoc_id: unit.id }],
        },
      });
      if (!position) {
        errors.push({
          row: rowNumber,
          error: `Không tìm thấy chức vụ '${ten_chuc_vu}' trong đơn vị ${ma_don_vi}`,
        });
        continue;
      }

      // Chuẩn hóa ngày
      const parseDate = val => {
        if (!val) return null;
        if (val instanceof Date) return val;
        if (typeof val === 'object' && val?.result) return new Date(val.result);
        const s = String(val).trim();
        if (!s) return null;
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      };

      const ngay_sinh = parseDate(ngay_sinhRaw);
      const ngay_nhap_ngu = parseDate(ngay_nhap_nguRaw);

      // Tạo hoặc cập nhật theo CCCD
      const existing = await prisma.quanNhan.findUnique({ where: { cccd } });
      const isCoQuanDonVi = !!coQuanDonVi;

      if (!existing) {
        const personnelData = {
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

        const newPersonnel = await prisma.quanNhan.create({
          data: personnelData,
        });

        // tăng số lượng đơn vị
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

        // Lấy thông tin chức vụ để lưu hệ số chức vụ
        const chucVuForHistory = await prisma.chucVu.findUnique({
          where: { id: position.id },
          select: { he_so_chuc_vu: true },
        });

        // Tạo LichSuChucVu cho chức vụ ban đầu
        const ngayBatDau = ngay_nhap_ngu || new Date();
        await prisma.lichSuChucVu.create({
          data: {
            quan_nhan_id: newPersonnel.id,
            chuc_vu_id: position.id,
            he_so_chuc_vu: chucVuForHistory?.he_so_chuc_vu || 0,
            ngay_bat_dau: ngayBatDau,
            ngay_ket_thuc: null, // Chức vụ hiện tại
            so_thang: null, // Chưa kết thúc nên chưa tính được
          },
        });

        created.push(newPersonnel.id);
      } else {
        // Kiểm tra nếu đổi đơn vị
        const oldUnitId = existing.co_quan_don_vi_id || existing.don_vi_truc_thuoc_id;
        const newUnitId = unit.id;
        const oldIsCoQuanDonVi = !!existing.co_quan_don_vi_id;

        const updateData = {
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

        // Nếu đổi đơn vị, cập nhật số lượng
        if (oldUnitId !== newUnitId) {
          // Giảm số lượng ở đơn vị cũ
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

          // Tăng số lượng ở đơn vị mới
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

        // Nếu đổi chức vụ, cập nhật lịch sử chức vụ
        if (position.id !== existing.chuc_vu_id) {
          const today = new Date();

          // 1. Đóng lịch sử chức vụ cũ và tính số tháng
          const oldHistoriesImport = await prisma.lichSuChucVu.findMany({
            where: {
              quan_nhan_id: existing.id,
              ngay_ket_thuc: null,
            },
          });

          // Cập nhật từng lịch sử cũ với số tháng đã tính
          for (const oldHistory of oldHistoriesImport) {
            const ngayBatDauOld = new Date(oldHistory.ngay_bat_dau);
            let months = (today.getFullYear() - ngayBatDauOld.getFullYear()) * 12;
            months += today.getMonth() - ngayBatDauOld.getMonth();
            // Nếu ngày kết thúc < ngày bắt đầu trong tháng thì trừ 1 tháng
            if (today.getDate() < ngayBatDauOld.getDate()) {
              months--;
            }
            const soThangOld = Math.max(0, months);

            await prisma.lichSuChucVu.update({
              where: { id: oldHistory.id },
              data: {
                ngay_ket_thuc: today,
                so_thang: soThangOld,
              },
            });
          }

          // 2. Lấy thông tin chức vụ mới để lưu hệ số chức vụ
          const newChucVuForImport = await prisma.chucVu.findUnique({
            where: { id: position.id },
            select: { he_so_chuc_vu: true },
          });

          // 3. Tạo lịch sử chức vụ mới
          await prisma.lichSuChucVu.create({
            data: {
              quan_nhan_id: existing.id,
              chuc_vu_id: position.id,
              he_so_chuc_vu: newChucVuForImport?.he_so_chuc_vu || 0,
              ngay_bat_dau: today,
              ngay_ket_thuc: null,
              so_thang: null, // Chưa kết thúc nên chưa tính được
            },
          });
        }

        updated.push(updatedPersonnel.id);
      }
    }

    console.log(
      `[Import quân nhân] Hoàn tất: ${created.length} tạo mới, ${updated.length} cập nhật, ${errors.length} lỗi`
    );

    return {
      createdCount: created.length,
      updatedCount: updated.length,
      errors,
    };
  }

  /**
   * Kiểm tra tính đủ điều kiện nhận danh hiệu cống hiến
   * Trả về danh sách các quân nhân không đủ điều kiện (đã nhận hoặc đang chờ duyệt)
   * @param {string[]} personnelIds - Danh sách ID quân nhân cần kiểm tra
   * @returns {Object} - { ineligiblePersonnel: Array<{ personnelId, reason, status }> }
   */
  async checkContributionEligibility(personnelIds) {
    const ineligiblePersonnel = [];

    // Kiểm tra từng quân nhân
    for (const personnelId of personnelIds) {
      // 1. Kiểm tra trong bảng KhenThuongCongHien (đã được approved)
      const existingAward = await prisma.khenThuongCongHien.findUnique({
        where: { quan_nhan_id: personnelId },
      });

      if (existingAward) {
        ineligiblePersonnel.push({
          personnelId,
          reason: 'Đã nhận Huân chương Bảo vệ Tổ quốc',
          status: 'APPROVED',
          awardYear: existingAward.nam,
          awardTitle: existingAward.danh_hieu,
        });
        continue;
      }

      // 2. Kiểm tra trong bảng BangDeXuat có đề xuất CONG_HIEN đang PENDING không
      const pendingProposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: 'CONG_HIEN',
          status: 'PENDING',
        },
        select: {
          id: true,
          data_cong_hien: true,
          nam: true,
        },
      });

      // Kiểm tra xem quân nhân có trong data_cong_hien của đề xuất nào không
      for (const proposal of pendingProposals) {
        if (proposal.data_cong_hien) {
          const congHienList = Array.isArray(proposal.data_cong_hien)
            ? proposal.data_cong_hien
            : [];

          const found = congHienList.some(item => item.personnel_id === personnelId);

          if (found) {
            ineligiblePersonnel.push({
              personnelId,
              reason: 'Đang chờ duyệt đề xuất Huân chương Bảo vệ Tổ quốc',
              status: 'PENDING',
              proposalId: proposal.id,
              proposalYear: proposal.nam,
            });
            break;
          }
        }
      }
    }

    return {
      ineligiblePersonnel,
      eligibleCount: personnelIds.length - ineligiblePersonnel.length,
      totalChecked: personnelIds.length,
    };
  }
}

module.exports = new PersonnelService();
