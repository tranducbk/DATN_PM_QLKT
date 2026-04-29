import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../repositories/unit.repository';
import { positionRepository } from '../repositories/position.repository';
import type { Prisma } from '../generated/prisma';
import { NotFoundError, AppError, ValidationError } from '../middlewares/errorHandler';

const positionInclude = {
  CoQuanDonVi: true,
  DonViTrucThuoc: { include: { CoQuanDonVi: true } },
} as const;

class PositionService {
  async getPositions(unitId?: string, includeChildren: boolean = false) {
    const unitIds: string[] = unitId ? [unitId] : [];

    if (includeChildren && unitId) {
      const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
        coQuanDonViRepository.findIdById(unitId),
        donViTrucThuocRepository.findIdById(unitId),
      ]);

      if (!coQuanDonVi && !donViTrucThuoc) {
        throw new NotFoundError('Đơn vị');
      }

      if (coQuanDonVi) {
        const childUnits = await donViTrucThuocRepository.findIdsByCoQuanDonViId(unitId);
        unitIds.push(...childUnits.map(c => c.id));
      }
    }

    const where = unitIds.length
      ? { OR: [{ co_quan_don_vi_id: { in: unitIds } }, { don_vi_truc_thuoc_id: { in: unitIds } }] }
      : {};

    return positionRepository.findManyRaw({
      where,
      include: positionInclude,
      orderBy: [
        { CoQuanDonVi: { ma_don_vi: 'asc' } },
        { DonViTrucThuoc: { ma_don_vi: 'asc' } },
        { id: 'asc' },
      ],
    });
  }

  async createPosition(data: {
    unit_id: string;
    ten_chuc_vu: string;
    is_manager?: boolean;
    he_so_chuc_vu?: number;
  }) {
    const { unit_id, ten_chuc_vu, is_manager, he_so_chuc_vu } = data;

    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      coQuanDonViRepository.findIdById(unit_id),
      donViTrucThuocRepository.findIdById(unit_id),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new NotFoundError('Đơn vị');
    }

    const isCoQuanDonVi = !!coQuanDonVi;

    const existingPosition = await positionRepository.findFirstRaw({
      where: {
        ten_chuc_vu,
        ...(isCoQuanDonVi ? { co_quan_don_vi_id: unit_id } : { don_vi_truc_thuoc_id: unit_id }),
      },
    });

    if (existingPosition) {
      throw new AppError('Tên chức vụ đã tồn tại trong đơn vị này', 409);
    }

    const createData: Prisma.ChucVuUncheckedCreateInput = {
      ten_chuc_vu,
      is_manager: isCoQuanDonVi ? is_manager || false : false,
      he_so_chuc_vu: he_so_chuc_vu ?? 0,
      ...(isCoQuanDonVi
        ? { co_quan_don_vi_id: unit_id, don_vi_truc_thuoc_id: null }
        : { co_quan_don_vi_id: null, don_vi_truc_thuoc_id: unit_id }),
    };

    return positionRepository.createRaw({ data: createData, include: positionInclude });
  }

  async updatePosition(
    id: string,
    data: { ten_chuc_vu?: string; is_manager?: boolean; he_so_chuc_vu?: number }
  ) {
    const { ten_chuc_vu, is_manager, he_so_chuc_vu } = data;

    const position = await positionRepository.findUniqueRaw({
      where: { id },
    });

    if (!position) {
      throw new NotFoundError('Chức vụ');
    }

    const isDonViTrucThuoc = !!position.don_vi_truc_thuoc_id;

    const newTenChucVu = ten_chuc_vu || position.ten_chuc_vu;
    const newIsManager = isDonViTrucThuoc
      ? false
      : is_manager !== undefined
        ? is_manager
        : position.is_manager;
    const newHeSoChucVu = he_so_chuc_vu !== undefined ? he_so_chuc_vu : position.he_so_chuc_vu;

    if (
      newTenChucVu === position.ten_chuc_vu &&
      newIsManager === position.is_manager &&
      Number(newHeSoChucVu) === Number(position.he_so_chuc_vu)
    ) {
      throw new ValidationError('Không có thay đổi nào để cập nhật');
    }

    return positionRepository.updateRaw({
      where: { id },
      data: { ten_chuc_vu: newTenChucVu, is_manager: newIsManager, he_so_chuc_vu: newHeSoChucVu },
      include: positionInclude,
    });
  }

  async deletePosition(id: string) {
    const [position, personnelCount] = await Promise.all([
      positionRepository.findUniqueRaw({
        where: { id },
        include: {
          CoQuanDonVi: { select: { ten_don_vi: true } },
          DonViTrucThuoc: { include: { CoQuanDonVi: { select: { ten_don_vi: true } } } },
        },
      }),
      quanNhanRepository.count({ chuc_vu_id: id }),
    ]);

    if (!position) {
      throw new NotFoundError('Chức vụ');
    }

    if (personnelCount > 0) {
      throw new AppError(
        `Không thể xóa chức vụ vì còn ${personnelCount} quân nhân đang giữ chức vụ này`,
        409
      );
    }

    await positionRepository.delete(id);

    return {
      message: 'Xóa chức vụ thành công',
      ten_chuc_vu: position.ten_chuc_vu,
      CoQuanDonVi: position.CoQuanDonVi,
      DonViTrucThuoc: position.DonViTrucThuoc,
    };
  }
}

export default new PositionService();
