import { prisma } from '../models';
import type { Prisma } from '../generated/prisma';

class PositionService {
  async getPositions(unitId?: string, includeChildren: boolean = false) {
    if (includeChildren && unitId) {
      const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
        prisma.coQuanDonVi.findUnique({ where: { id: unitId } }),
        prisma.donViTrucThuoc.findUnique({ where: { id: unitId } }),
      ]);

      if (!coQuanDonVi && !donViTrucThuoc) {
        throw new Error('Đơn vị không tồn tại');
      }

      const unitIds: string[] = [unitId];

      if (coQuanDonVi) {
        const childUnits = await prisma.donViTrucThuoc.findMany({
          where: { co_quan_don_vi_id: unitId },
          select: { id: true },
        });
        childUnits.forEach(child => unitIds.push(child.id));
      }

      const positions = await prisma.chucVu.findMany({
        where: {
          OR: [{ co_quan_don_vi_id: { in: unitIds } }, { don_vi_truc_thuoc_id: { in: unitIds } }],
        },
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
        },
        orderBy: [
          { CoQuanDonVi: { ma_don_vi: 'asc' } },
          { DonViTrucThuoc: { ma_don_vi: 'asc' } },
          { id: 'asc' },
        ],
      });

      return positions;
    } else {
      const whereClause = unitId
        ? {
            OR: [{ co_quan_don_vi_id: unitId }, { don_vi_truc_thuoc_id: unitId }],
          }
        : {};

      const positions = await prisma.chucVu.findMany({
        where: whereClause,
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
        },
        orderBy: [
          { CoQuanDonVi: { ma_don_vi: 'asc' } },
          { DonViTrucThuoc: { ma_don_vi: 'asc' } },
          { id: 'asc' },
        ],
      });

      return positions;
    }
  }

  async createPosition(data: {
    unit_id: string;
    ten_chuc_vu: string;
    is_manager?: boolean;
    he_so_chuc_vu?: number;
  }) {
    const { unit_id, ten_chuc_vu, is_manager, he_so_chuc_vu } = data;

    const unitIdString = typeof unit_id === 'string' ? unit_id : String(unit_id);

    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({ where: { id: unitIdString } }),
      prisma.donViTrucThuoc.findUnique({ where: { id: unitIdString } }),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new Error('Đơn vị không tồn tại');
    }

    const isCoQuanDonVi = !!coQuanDonVi;

    const existingPosition = await prisma.chucVu.findFirst({
      where: isCoQuanDonVi
        ? {
            co_quan_don_vi_id: unitIdString,
            ten_chuc_vu,
          }
        : {
            don_vi_truc_thuoc_id: unitIdString,
            ten_chuc_vu,
          },
    });

    if (existingPosition) {
      throw new Error('Tên chức vụ đã tồn tại trong đơn vị này');
    }

    const createData: Prisma.ChucVuUncheckedCreateInput = {
      ten_chuc_vu,
      is_manager: isCoQuanDonVi ? is_manager || false : false,
      he_so_chuc_vu: he_so_chuc_vu ?? 0,
      ...(isCoQuanDonVi
        ? { co_quan_don_vi_id: unitIdString, don_vi_truc_thuoc_id: null }
        : { co_quan_don_vi_id: null, don_vi_truc_thuoc_id: unitIdString }),
    };

    const newPosition = await prisma.chucVu.create({
      data: createData,
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
      },
    });

    return newPosition;
  }

  async updatePosition(
    id: string,
    data: { ten_chuc_vu?: string; is_manager?: boolean; he_so_chuc_vu?: number }
  ) {
    const { ten_chuc_vu, is_manager, he_so_chuc_vu } = data;

    const position = await prisma.chucVu.findUnique({
      where: { id },
    });

    if (!position) {
      throw new Error('Chức vụ không tồn tại');
    }

    const isDonViTrucThuoc = !!position.don_vi_truc_thuoc_id;

    const updatedPosition = await prisma.chucVu.update({
      where: { id },
      data: {
        ten_chuc_vu: ten_chuc_vu || position.ten_chuc_vu,
        is_manager: isDonViTrucThuoc
          ? false
          : is_manager !== undefined
            ? is_manager
            : position.is_manager,
        he_so_chuc_vu: he_so_chuc_vu !== undefined ? he_so_chuc_vu : position.he_so_chuc_vu,
      },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
      },
    });

    return updatedPosition;
  }

  async deletePosition(id: string) {
    const position = await prisma.chucVu.findUnique({
      where: { id },
      include: {
        CoQuanDonVi: { select: { ten_don_vi: true } },
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: { select: { ten_don_vi: true } },
          },
        },
      },
    });

    if (!position) {
      throw new Error('Chức vụ không tồn tại');
    }

    const personnelCount = await prisma.quanNhan.count({
      where: { chuc_vu_id: id },
    });

    if (personnelCount > 0) {
      throw new Error(
        `Không thể xóa chức vụ vì còn ${personnelCount} quân nhân đang giữ chức vụ này`
      );
    }

    await prisma.chucVu.delete({
      where: { id },
    });

    return {
      message: 'Xóa chức vụ thành công',
      ten_chuc_vu: position.ten_chuc_vu,
      CoQuanDonVi: position.CoQuanDonVi,
      DonViTrucThuoc: position.DonViTrucThuoc,
    };
  }
}

export default new PositionService();
