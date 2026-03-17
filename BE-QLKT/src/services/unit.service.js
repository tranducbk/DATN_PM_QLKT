const { prisma } = require('../models');

class UnitService {
  /**
   * Lấy tất cả cơ quan đơn vị và đơn vị trực thuộc (có thể lấy theo cấu trúc cây)
   */
  async getAllUnits(includeHierarchy = false) {
    if (includeHierarchy) {
      // Lấy đơn vị theo cấu trúc cây: chỉ lấy cơ quan đơn vị và các đơn vị trực thuộc
      const coQuanDonVi = await prisma.coQuanDonVi.findMany({
        include: {
          DonViTrucThuoc: {
            include: {
              ChucVu: true,
            },
          },
          ChucVu: true,
        },
        orderBy: {
          ma_don_vi: 'asc',
        },
      });

      return coQuanDonVi;
    } else {
      // Lấy tất cả đơn vị phẳng (cả cơ quan đơn vị và đơn vị trực thuộc)
      const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
        prisma.coQuanDonVi.findMany({
          include: {
            ChucVu: true,
          },
          orderBy: {
            ma_don_vi: 'asc',
          },
        }),
        prisma.donViTrucThuoc.findMany({
          include: {
            CoQuanDonVi: true,
            ChucVu: true,
          },
          orderBy: {
            ma_don_vi: 'asc',
          },
        }),
      ]);

      return [...coQuanDonVi, ...donViTrucThuoc];
    }
  }

  /**
   * Lấy tất cả đơn vị trực thuộc
   * @param {string} coQuanDonViId - UUID cơ quan đơn vị (optional)
   */
  async getAllSubUnits(coQuanDonViId) {
    const whereClause = coQuanDonViId ? { co_quan_don_vi_id: coQuanDonViId } : {};

    const donViTrucThuoc = await prisma.donViTrucThuoc.findMany({
      where: whereClause,
      include: {
        CoQuanDonVi: true,
        ChucVu: true,
      },
      orderBy: {
        ma_don_vi: 'asc',
      },
    });

    return donViTrucThuoc;
  }

  /**
   * Lấy đơn vị của Manager và các đơn vị con
   * @param {string} userQuanNhanId - ID của quân nhân (Manager)
   * @returns {Promise<Array>} - Mảng gồm đơn vị cha và các đơn vị con
   */
  async getManagerUnits(userQuanNhanId) {
    // Lấy thông tin quân nhân của Manager
    const manager = await prisma.quanNhan.findUnique({
      where: { id: userQuanNhanId },
      select: {
        co_quan_don_vi_id: true,
        don_vi_truc_thuoc_id: true,
      },
    });

    if (!manager) {
      throw new Error('Không tìm thấy thông tin quân nhân');
    }

    const units = [];

    // Manager thuộc cơ quan đơn vị
    if (manager.co_quan_don_vi_id) {
      // Lấy cơ quan đơn vị của Manager
      const coQuanDonVi = await prisma.coQuanDonVi.findUnique({
        where: { id: manager.co_quan_don_vi_id },
        select: {
          id: true,
          ten_don_vi: true,
          ma_don_vi: true,
        },
      });

      if (coQuanDonVi) {
        units.push(coQuanDonVi);
      }

      // Lấy tất cả đơn vị trực thuộc của cơ quan đơn vị này
      const donViTrucThuoc = await prisma.donViTrucThuoc.findMany({
        where: { co_quan_don_vi_id: manager.co_quan_don_vi_id },
        include: {
          CoQuanDonVi: {
            select: {
              id: true,
              ten_don_vi: true,
              ma_don_vi: true,
            },
          },
        },
        orderBy: {
          ma_don_vi: 'asc',
        },
      });

      units.push(...donViTrucThuoc);
    } else if (manager.don_vi_truc_thuoc_id) {
      // Manager thuộc đơn vị trực thuộc (ít gặp, nhưng xử lý để đầy đủ)
      const donViTrucThuoc = await prisma.donViTrucThuoc.findUnique({
        where: { id: manager.don_vi_truc_thuoc_id },
        include: {
          CoQuanDonVi: {
            select: {
              id: true,
              ten_don_vi: true,
              ma_don_vi: true,
            },
          },
        },
      });

      if (donViTrucThuoc) {
        units.push(donViTrucThuoc);
      }
    }

    return units;
  }

  /**
   * Tạo cơ quan đơn vị mới hoặc đơn vị trực thuộc (nếu có co_quan_don_vi_id)
   */
  async createUnit(data) {
    const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = data;

    // Kiểm tra mã đơn vị đã tồn tại chưa (kiểm tra cả 2 bảng)
    const [existingCoQuanDonVi, existingDonViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({ where: { ma_don_vi } }),
      prisma.donViTrucThuoc.findUnique({ where: { ma_don_vi } }),
    ]);

    if (existingCoQuanDonVi || existingDonViTrucThuoc) {
      throw new Error('Mã đơn vị đã tồn tại');
    }

    // Nếu có co_quan_don_vi_id, tạo đơn vị trực thuộc
    if (co_quan_don_vi_id) {
      // Kiểm tra cơ quan đơn vị có tồn tại không
      const parentUnit = await prisma.coQuanDonVi.findUnique({
        where: { id: co_quan_don_vi_id },
      });

      if (!parentUnit) {
        throw new Error('Cơ quan đơn vị không tồn tại');
      }

      // Tạo đơn vị trực thuộc
      const newUnit = await prisma.donViTrucThuoc.create({
        data: {
          co_quan_don_vi_id,
          ma_don_vi,
          ten_don_vi,
          so_luong: 0,
        },
        include: {
          CoQuanDonVi: true,
          ChucVu: true,
        },
      });

      const donViTrucThuocCount = await prisma.donViTrucThuoc.count({
        where: { co_quan_don_vi_id },
      });

      return newUnit;
    } else {
      // Tạo cơ quan đơn vị
      const newUnit = await prisma.coQuanDonVi.create({
        data: {
          ma_don_vi,
          ten_don_vi,
          so_luong: 0,
        },
        include: {
          DonViTrucThuoc: true,
          ChucVu: true,
        },
      });

      return newUnit;
    }
  }

  /**
   * Sửa cơ quan đơn vị hoặc đơn vị trực thuộc (mã, tên, co_quan_don_vi_id)
   */
  async updateUnit(id, data) {
    const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = data;

    // Kiểm tra cơ quan đơn vị hoặc đơn vị trực thuộc có tồn tại không (kiểm tra cả 2 bảng)
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({ where: { id } }),
      prisma.donViTrucThuoc.findUnique({ where: { id } }),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new Error('Cơ quan đơn vị hoặc đơn vị trực thuộc không tồn tại');
    }

    // Nếu là đơn vị trực thuộc
    if (donViTrucThuoc) {
      const updateData = {};
      if (ma_don_vi) {
        // Kiểm tra mã đơn vị có bị trùng không (kiểm tra cả 2 bảng, trừ chính nó)
        const [existingDonVi, existingCoQuan] = await Promise.all([
          prisma.donViTrucThuoc.findFirst({
            where: {
              ma_don_vi: ma_don_vi,
              id: { not: id },
            },
          }),
          prisma.coQuanDonVi.findFirst({
            where: {
              ma_don_vi: ma_don_vi,
            },
          }),
        ]);
        if (existingDonVi || existingCoQuan) {
          throw new Error('Mã đơn vị đã tồn tại');
        }
        updateData.ma_don_vi = ma_don_vi;
      }
      if (ten_don_vi) updateData.ten_don_vi = ten_don_vi;
      if (co_quan_don_vi_id !== undefined) {
        // Kiểm tra cơ quan đơn vị có tồn tại không
        const parentUnit = await prisma.coQuanDonVi.findUnique({
          where: { id: co_quan_don_vi_id },
        });

        if (!parentUnit) {
          throw new Error('Cơ quan đơn vị không tồn tại');
        }

        updateData.co_quan_don_vi_id = co_quan_don_vi_id;
      }

      const updatedUnit = await prisma.donViTrucThuoc.update({
        where: { id },
        data: updateData,
        include: {
          CoQuanDonVi: true,
          ChucVu: true,
        },
      });

      return updatedUnit;
    } else {
      // Nếu là cơ quan đơn vị
      const updateData = {};
      if (ma_don_vi) {
        // Kiểm tra mã đơn vị có bị trùng không (kiểm tra cả 2 bảng, trừ chính nó)
        const [existingCoQuan, existingDonVi] = await Promise.all([
          prisma.coQuanDonVi.findFirst({
            where: {
              ma_don_vi: ma_don_vi,
              id: { not: id },
            },
          }),
          prisma.donViTrucThuoc.findFirst({
            where: {
              ma_don_vi: ma_don_vi,
            },
          }),
        ]);
        if (existingCoQuan || existingDonVi) {
          throw new Error('Mã đơn vị đã tồn tại');
        }
        updateData.ma_don_vi = ma_don_vi;
      }
      if (ten_don_vi) updateData.ten_don_vi = ten_don_vi;

      const updatedUnit = await prisma.coQuanDonVi.update({
        where: { id },
        data: updateData,
        include: {
          DonViTrucThuoc: {
            include: {
              ChucVu: true,
            },
          },
          ChucVu: true,
        },
      });

      return updatedUnit;
    }
  }

  /**
   * Kiểm tra xem đơn vị có phải là con cháu của đơn vị khác không (để tránh vòng lặp)
   * Không cần thiết nữa vì chỉ có 2 cấp: cơ quan đơn vị và đơn vị trực thuộc
   */
  async isDescendant(ancestorId, descendantId) {
    try {
      if (ancestorId === descendantId) return true;

      // Kiểm tra xem descendant có phải là đơn vị trực thuộc của ancestor không
      const descendant = await prisma.donViTrucThuoc.findUnique({
        where: { id: descendantId },
      });

      if (!descendant) return false;

      return descendant.co_quan_don_vi_id === ancestorId;
    } catch (error) {
      return false;
    }
  }

  /**
   * Xóa cơ quan đơn vị hoặc đơn vị trực thuộc (nếu không còn quân nhân và không có đơn vị trực thuộc)
   * @param {string} id - UUID của cơ quan đơn vị hoặc đơn vị trực thuộc
   */
  async deleteUnit(id) {
    // Kiểm tra cơ quan đơn vị hoặc đơn vị trực thuộc có tồn tại không (kiểm tra cả 2 bảng)
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({
        where: { id },
        include: {
          DonViTrucThuoc: true,
        },
      }),
      prisma.donViTrucThuoc.findUnique({
        where: { id },
      }),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new Error('Cơ quan đơn vị hoặc đơn vị trực thuộc không tồn tại');
    }

    // Nếu là cơ quan đơn vị
    if (coQuanDonVi) {
      // Kiểm tra có đơn vị trực thuộc không
      if (coQuanDonVi.DonViTrucThuoc && coQuanDonVi.DonViTrucThuoc.length > 0) {
        throw new Error(
          `Không thể xóa cơ quan đơn vị vì còn ${coQuanDonVi.DonViTrucThuoc.length} đơn vị trực thuộc`
        );
      }

      // Kiểm tra có quân nhân không
      const personnelCount = await prisma.quanNhan.count({
        where: { co_quan_don_vi_id: id },
      });

      if (personnelCount > 0) {
        throw new Error(`Không thể xóa cơ quan đơn vị vì còn ${personnelCount} quân nhân`);
      }

      // Kiểm tra có chức vụ không
      const positionCount = await prisma.chucVu.count({
        where: { co_quan_don_vi_id: id },
      });

      if (positionCount > 0) {
        throw new Error(`Không thể xóa cơ quan đơn vị vì còn ${positionCount} chức vụ`);
      }

      // Xóa cơ quan đơn vị
      await prisma.coQuanDonVi.delete({
        where: { id },
      });
    } else {
      // Nếu là đơn vị trực thuộc
      // Kiểm tra có quân nhân không
      const personnelCount = await prisma.quanNhan.count({
        where: { don_vi_truc_thuoc_id: id },
      });

      if (personnelCount > 0) {
        throw new Error(`Không thể xóa đơn vị trực thuộc vì còn ${personnelCount} quân nhân`);
      }

      // Kiểm tra có chức vụ không
      const positionCount = await prisma.chucVu.count({
        where: { don_vi_truc_thuoc_id: id },
      });

      if (positionCount > 0) {
        throw new Error(`Không thể xóa đơn vị trực thuộc vì còn ${positionCount} chức vụ`);
      }

      // Xóa đơn vị trực thuộc
      await prisma.donViTrucThuoc.delete({
        where: { id },
      });
    }

    return { message: 'Xóa cơ quan đơn vị/đơn vị trực thuộc thành công' };
  }

  /**
   * Lấy cơ quan đơn vị hoặc đơn vị trực thuộc theo ID với cấu trúc cây đầy đủ
   * @param {string} id - UUID của cơ quan đơn vị hoặc đơn vị trực thuộc
   */
  async getUnitById(id) {
    // Kiểm tra cả 2 bảng
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({
        where: { id },
        include: {
          DonViTrucThuoc: {
            include: {
              ChucVu: {
                include: {
                  CoQuanDonVi: true,
                  DonViTrucThuoc: {
                    include: {
                      CoQuanDonVi: true,
                    },
                  },
                },
              },
            },
          },
          ChucVu: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: {
                include: {
                  CoQuanDonVi: true,
                },
              },
            },
          },
        },
      }),
      prisma.donViTrucThuoc.findUnique({
        where: { id },
        include: {
          CoQuanDonVi: {
            select: {
              id: true,
              ma_don_vi: true,
              ten_don_vi: true,
              so_luong: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          ChucVu: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: {
                include: {
                  CoQuanDonVi: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new Error('Cơ quan đơn vị hoặc đơn vị trực thuộc không tồn tại');
    }

    return coQuanDonVi || donViTrucThuoc;
  }
}

module.exports = new UnitService();
