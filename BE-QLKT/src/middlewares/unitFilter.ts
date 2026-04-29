import { Request, Response, NextFunction } from 'express';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { donViTrucThuocRepository } from '../repositories/unit.repository';
import { ROLES } from '../constants/roles.constants';

interface UnitInfo {
  don_vi_id: string;
  isCoQuanDonVi: boolean;
}

const getUnitInfo = async (quanNhanId: string): Promise<UnitInfo | null> => {
  if (!quanNhanId) return null;

  const personnel = await quanNhanRepository.findUnitScope(quanNhanId);

  if (!personnel) return null;

  if (personnel.co_quan_don_vi_id) {
    return {
      don_vi_id: personnel.co_quan_don_vi_id,
      isCoQuanDonVi: true,
    };
  }

  if (personnel.don_vi_truc_thuoc_id) {
    return {
      don_vi_id: personnel.don_vi_truc_thuoc_id,
      isCoQuanDonVi: false,
    };
  }

  return null;
};

const getPersonnelInUnit = async (unitInfo: UnitInfo): Promise<Array<{ id: string }>> => {
  if (!unitInfo) return [];

  if (unitInfo.isCoQuanDonVi) {
    const donViTrucThuocIds = await donViTrucThuocRepository.findIdsByCoQuanDonViId(
      unitInfo.don_vi_id
    );
    const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);

    return quanNhanRepository.findManyRaw({
      where: {
        OR: [
          { co_quan_don_vi_id: unitInfo.don_vi_id },
          { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
        ],
      },
      select: { id: true },
    });
  }

  return quanNhanRepository.findManyRaw({
    where: { don_vi_truc_thuoc_id: unitInfo.don_vi_id },
    select: { id: true },
  });
};

/**
 * Attaches manager unit filter information to the request context.
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 * @returns Promise resolved when middleware completes
 */
const attachUnitFilter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userRole = req.user?.role;

    if (userRole !== ROLES.MANAGER) {
      req.unitFilter = null;
      return next();
    }

    const quanNhanId = req.user?.quan_nhan_id;
    if (!quanNhanId) {
      res.status(403).json({
        success: false,
        message: 'Không tìm thấy thông tin quân nhân của người dùng',
      });
      return;
    }

    const unitInfo = await getUnitInfo(quanNhanId);
    if (!unitInfo) {
      res.status(403).json({
        success: false,
        message: 'Không tìm thấy thông tin đơn vị của người dùng',
      });
      return;
    }

    req.unitFilter = unitInfo;
    next();
  } catch (error) {
    next(error);
  }
};

const attachUnitFilterWithPersonnel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userRole = req.user?.role;

    if (userRole !== ROLES.MANAGER) {
      req.unitFilter = null;
      return next();
    }

    const quanNhanId = req.user?.quan_nhan_id;
    if (!quanNhanId) {
      res.status(403).json({
        success: false,
        message: 'Không tìm thấy thông tin quân nhân của người dùng',
      });
      return;
    }

    const unitInfo = await getUnitInfo(quanNhanId);
    if (!unitInfo) {
      res.status(403).json({
        success: false,
        message: 'Không tìm thấy thông tin đơn vị của người dùng',
      });
      return;
    }

    const personnelInUnit = await getPersonnelInUnit(unitInfo);
    req.unitFilter = {
      ...unitInfo,
      personnelIds: personnelInUnit.map(p => p.id),
    };

    next();
  } catch (error) {
    next(error);
  }
};

export { attachUnitFilter, attachUnitFilterWithPersonnel, getUnitInfo, getPersonnelInUnit };
