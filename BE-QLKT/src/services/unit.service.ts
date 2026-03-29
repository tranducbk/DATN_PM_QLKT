import { prisma } from '../models';
import { AppError, NotFoundError, ValidationError } from '../middlewares/errorHandler';

interface CreateUnitData {
  ma_don_vi: string;
  ten_don_vi: string;
  co_quan_don_vi_id?: string;
}

interface UpdateUnitData {
  ma_don_vi?: string;
  ten_don_vi?: string;
  co_quan_don_vi_id?: string;
}

class UnitService {
  async getAllUnits(includeHierarchy = false) {
    if (includeHierarchy) {
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

  async getAllSubUnits(coQuanDonViId?: string) {
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

  async getManagerUnits(userQuanNhanId: string) {
    const manager = await prisma.quanNhan.findUnique({
      where: { id: userQuanNhanId },
      select: {
        co_quan_don_vi_id: true,
        don_vi_truc_thuoc_id: true,
      },
    });

    if (!manager) {
      throw new NotFoundError('Thông tin quân nhân');
    }

    const units: Record<string, unknown>[] = [];

    if (manager.co_quan_don_vi_id) {
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

  async createUnit(data: CreateUnitData) {
    const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = data;

    const [existingCoQuanDonVi, existingDonViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({ where: { ma_don_vi } }),
      prisma.donViTrucThuoc.findUnique({ where: { ma_don_vi } }),
    ]);

    if (existingCoQuanDonVi || existingDonViTrucThuoc) {
      throw new AppError('Mã đơn vị đã tồn tại', 409);
    }

    if (co_quan_don_vi_id) {
      const parentUnit = await prisma.coQuanDonVi.findUnique({
        where: { id: co_quan_don_vi_id },
      });

      if (!parentUnit) {
        throw new NotFoundError('Cơ quan đơn vị');
      }

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

      await prisma.donViTrucThuoc.count({
        where: { co_quan_don_vi_id },
      });

      return newUnit;
    } else {
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

  async updateUnit(id: string, data: UpdateUnitData) {
    const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = data;

    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({ where: { id } }),
      prisma.donViTrucThuoc.findUnique({ where: { id } }),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new NotFoundError('Cơ quan đơn vị hoặc đơn vị trực thuộc');
    }

    if (donViTrucThuoc) {
      const updateData: Record<string, unknown> = {};
      if (ma_don_vi) {
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
          throw new AppError('Mã đơn vị đã tồn tại', 409);
        }
        updateData.ma_don_vi = ma_don_vi;
      }
      if (ten_don_vi) updateData.ten_don_vi = ten_don_vi;
      if (co_quan_don_vi_id !== undefined) {
        const parentUnit = await prisma.coQuanDonVi.findUnique({
          where: { id: co_quan_don_vi_id },
        });

        if (!parentUnit) {
          throw new NotFoundError('Cơ quan đơn vị');
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
      const updateData: Record<string, unknown> = {};
      if (ma_don_vi) {
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
          throw new AppError('Mã đơn vị đã tồn tại', 409);
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

  async isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
    try {
      if (ancestorId === descendantId) return true;

      const descendant = await prisma.donViTrucThuoc.findUnique({
        where: { id: descendantId },
      });

      if (!descendant) return false;

      return descendant.co_quan_don_vi_id === ancestorId;
    } catch {
      return false;
    }
  }

  async deleteUnit(id: string) {
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
      throw new NotFoundError('Cơ quan đơn vị hoặc đơn vị trực thuộc');
    }

    if (coQuanDonVi) {
      if (coQuanDonVi.DonViTrucThuoc && coQuanDonVi.DonViTrucThuoc.length > 0) {
        throw new ValidationError(
          `Không thể xóa cơ quan đơn vị vì còn ${coQuanDonVi.DonViTrucThuoc.length} đơn vị trực thuộc`
        );
      }

      const personnelCount = await prisma.quanNhan.count({
        where: { co_quan_don_vi_id: id },
      });

      if (personnelCount > 0) {
        throw new ValidationError(`Không thể xóa cơ quan đơn vị vì còn ${personnelCount} quân nhân`);
      }

      const positionCount = await prisma.chucVu.count({
        where: { co_quan_don_vi_id: id },
      });

      if (positionCount > 0) {
        throw new ValidationError(`Không thể xóa cơ quan đơn vị vì còn ${positionCount} chức vụ`);
      }

      await prisma.coQuanDonVi.delete({
        where: { id },
      });
    } else {
      const personnelCount = await prisma.quanNhan.count({
        where: { don_vi_truc_thuoc_id: id },
      });

      if (personnelCount > 0) {
        throw new ValidationError(`Không thể xóa đơn vị trực thuộc vì còn ${personnelCount} quân nhân`);
      }

      const positionCount = await prisma.chucVu.count({
        where: { don_vi_truc_thuoc_id: id },
      });

      if (positionCount > 0) {
        throw new ValidationError(`Không thể xóa đơn vị trực thuộc vì còn ${positionCount} chức vụ`);
      }

      await prisma.donViTrucThuoc.delete({
        where: { id },
      });
    }

    return { message: 'Xóa cơ quan đơn vị/đơn vị trực thuộc thành công' };
  }

  async getUnitById(id: string) {
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
      throw new NotFoundError('Cơ quan đơn vị hoặc đơn vị trực thuộc');
    }

    return coQuanDonVi || donViTrucThuoc;
  }
}

export default new UnitService();
