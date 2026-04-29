import { AppError, NotFoundError, ValidationError } from '../middlewares/errorHandler';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../repositories/unit.repository';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { positionRepository } from '../repositories/position.repository';

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
  async getAllUnits(options: { hierarchy?: boolean; page?: number; limit?: number } = {}) {
    const { hierarchy = false, page = 1, limit = 20 } = options;

    if (hierarchy) {
      const [items, total] = await Promise.all([
        coQuanDonViRepository.findManyHierarchyPaginated({
          skip: (page - 1) * limit,
          take: limit,
        }),
        coQuanDonViRepository.count(),
      ]);
      return { items, total };
    } else {
      const [cqdv, dvtt] = await Promise.all([
        coQuanDonViRepository.findAllLight(),
        donViTrucThuocRepository.findAllWithParentLight(),
      ]);
      const items = [...cqdv, ...dvtt].sort((a, b) =>
        a.ma_don_vi.localeCompare(b.ma_don_vi)
      );
      return { items, total: items.length };
    }
  }

  async getAllSubUnits(coQuanDonViId?: string) {
    return donViTrucThuocRepository.findManySubUnits(coQuanDonViId);
  }

  async getManagerUnits(userQuanNhanId: string) {
    const manager = await quanNhanRepository.findUnitScope(userQuanNhanId);

    if (!manager) {
      throw new NotFoundError('Thông tin quân nhân');
    }

    const units: Record<string, unknown>[] = [];

    if (manager.co_quan_don_vi_id) {
      const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
        coQuanDonViRepository.findLightById(manager.co_quan_don_vi_id),
        donViTrucThuocRepository.findManyByParent(manager.co_quan_don_vi_id),
      ]);

      if (coQuanDonVi) units.push(coQuanDonVi);
      units.push(...donViTrucThuoc);
    } else if (manager.don_vi_truc_thuoc_id) {
      const donViTrucThuoc = await donViTrucThuocRepository.findDeepById(
        manager.don_vi_truc_thuoc_id
      );

      if (donViTrucThuoc) {
        units.push(donViTrucThuoc);
      }
    }

    return units;
  }

  async createUnit(data: CreateUnitData) {
    const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = data;

    const [existingCoQuanDonVi, existingDonViTrucThuoc] = await Promise.all([
      coQuanDonViRepository.findByMaDonVi(ma_don_vi),
      donViTrucThuocRepository.findByMaDonVi(ma_don_vi),
    ]);

    if (existingCoQuanDonVi || existingDonViTrucThuoc) {
      throw new AppError('Mã đơn vị đã tồn tại', 409);
    }

    if (co_quan_don_vi_id) {
      const parentUnit = await coQuanDonViRepository.findIdById(co_quan_don_vi_id);

      if (!parentUnit) {
        throw new NotFoundError('Cơ quan đơn vị');
      }

      return donViTrucThuocRepository.create({
        co_quan_don_vi_id,
        ma_don_vi,
        ten_don_vi,
        so_luong: 0,
      });
    } else {
      return coQuanDonViRepository.create({ ma_don_vi, ten_don_vi, so_luong: 0 });
    }
  }

  async updateUnit(id: string, data: UpdateUnitData) {
    const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = data;

    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      coQuanDonViRepository.findById(id),
      donViTrucThuocRepository.findById(id),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new NotFoundError('Cơ quan đơn vị hoặc đơn vị trực thuộc');
    }

    if (donViTrucThuoc) {
      const updateData: Record<string, unknown> = {};
      if (ma_don_vi) {
        const [existingDonVi, existingCoQuan] = await Promise.all([
          donViTrucThuocRepository.findOtherByMaDonVi(ma_don_vi, id),
          coQuanDonViRepository.findFirstByMaDonVi(ma_don_vi),
        ]);
        if (existingDonVi || existingCoQuan) {
          throw new AppError('Mã đơn vị đã tồn tại', 409);
        }
        updateData.ma_don_vi = ma_don_vi;
      }
      if (ten_don_vi) updateData.ten_don_vi = ten_don_vi;
      if (co_quan_don_vi_id !== undefined) {
        const parentUnit = await coQuanDonViRepository.findIdById(co_quan_don_vi_id);

        if (!parentUnit) {
          throw new NotFoundError('Cơ quan đơn vị');
        }

        updateData.co_quan_don_vi_id = co_quan_don_vi_id;
      }

      return donViTrucThuocRepository.update(id, updateData);
    } else {
      const updateData: Record<string, unknown> = {};
      if (ma_don_vi) {
        const [existingCoQuan, existingDonVi] = await Promise.all([
          coQuanDonViRepository.findOtherByMaDonVi(ma_don_vi, id),
          donViTrucThuocRepository.findFirstByMaDonVi(ma_don_vi),
        ]);
        if (existingCoQuan || existingDonVi) {
          throw new AppError('Mã đơn vị đã tồn tại', 409);
        }
        updateData.ma_don_vi = ma_don_vi;
      }
      if (ten_don_vi) updateData.ten_don_vi = ten_don_vi;

      return coQuanDonViRepository.update(id, updateData);
    }
  }

  async isDescendant(ancestorId: string, descendantId: string): Promise<boolean> {
    try {
      if (ancestorId === descendantId) return true;

      const descendant = await donViTrucThuocRepository.findById(descendantId);

      if (!descendant) return false;

      return descendant.co_quan_don_vi_id === ancestorId;
    } catch (error) {
      console.error('Failed to resolve unit hierarchy relation:', error);
      return false;
    }
  }

  async deleteUnit(id: string) {
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      coQuanDonViRepository.findWithChildren(id),
      donViTrucThuocRepository.findById(id),
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

      const [personnelCount, positionCount] = await Promise.all([
        quanNhanRepository.count({ co_quan_don_vi_id: id }),
        positionRepository.count({ co_quan_don_vi_id: id }),
      ]);

      if (personnelCount > 0) {
        throw new ValidationError(`Không thể xóa cơ quan đơn vị vì còn ${personnelCount} quân nhân`);
      }
      if (positionCount > 0) {
        throw new ValidationError(`Không thể xóa cơ quan đơn vị vì còn ${positionCount} chức vụ`);
      }

      await coQuanDonViRepository.delete(id);
    } else {
      const [personnelCount, positionCount] = await Promise.all([
        quanNhanRepository.count({ don_vi_truc_thuoc_id: id }),
        positionRepository.count({ don_vi_truc_thuoc_id: id }),
      ]);

      if (personnelCount > 0) {
        throw new ValidationError(`Không thể xóa đơn vị trực thuộc vì còn ${personnelCount} quân nhân`);
      }
      if (positionCount > 0) {
        throw new ValidationError(`Không thể xóa đơn vị trực thuộc vì còn ${positionCount} chức vụ`);
      }

      await donViTrucThuocRepository.delete(id);
    }

    return { message: 'Xóa cơ quan đơn vị/đơn vị trực thuộc thành công' };
  }

  async getUnitById(id: string) {
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      coQuanDonViRepository.findDeepById(id),
      donViTrucThuocRepository.findDeepById(id),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new NotFoundError('Cơ quan đơn vị hoặc đơn vị trực thuộc');
    }

    return coQuanDonVi || donViTrucThuoc;
  }

  /**
   * Recalculates `so_luong` for all units from current personnel assignments.
   * @returns Number of updated units
   */
  async recalculatePersonnelCount() {
    const [coQuanDonViList, donViTrucThuocList, cqdvCounts, dvttCounts] = await Promise.all([
      coQuanDonViRepository.findAllForRecalc(),
      donViTrucThuocRepository.findAllForRecalc(),
      quanNhanRepository.groupByCoQuanDonViForRecalc(),
      quanNhanRepository.groupByDonViTrucThuocForRecalc(),
    ]);

    const cqdvCountMap = new Map(cqdvCounts.map(c => [c.co_quan_don_vi_id!, c._count]));
    const dvttCountMap = new Map(dvttCounts.map(c => [c.don_vi_truc_thuoc_id!, c._count]));

    const cqdvToUpdate = coQuanDonViList.filter(u => u.so_luong !== (cqdvCountMap.get(u.id) ?? 0));
    const dvttToUpdate = donViTrucThuocList.filter(u => u.so_luong !== (dvttCountMap.get(u.id) ?? 0));
    const updated = cqdvToUpdate.length + dvttToUpdate.length;

    if (updated > 0) {
      await Promise.all([
        ...cqdvToUpdate.map(u =>
          coQuanDonViRepository.updateSoLuong(u.id, cqdvCountMap.get(u.id) ?? 0)
        ),
        ...dvttToUpdate.map(u =>
          donViTrucThuocRepository.updateSoLuong(u.id, dvttCountMap.get(u.id) ?? 0)
        ),
      ]);
    }

    return updated;
  }
}

export default new UnitService();
