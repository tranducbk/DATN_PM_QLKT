import { Request, Response, NextFunction } from 'express';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { donViTrucThuocRepository } from '../repositories/unit.repository';
import { ROLES } from '../constants/roles.constants';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  UNIT FILTER MIDDLEWARE — row-level security cho MANAGER role
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  VẤN ĐỀ:
 *  MANAGER (chỉ huy đơn vị) chỉ được xem/thao tác data của ĐƠN VỊ MÌNH:
 *    - Danh sách quân nhân trong đơn vị.
 *    - Đề xuất do unit mình nộp.
 *    - Khen thưởng của unit mình.
 *  KHÔNG được leak data của unit khác (compliance + nội bộ).
 *
 *  GIẢI PHÁP:
 *  Middleware attach `req.unitFilter` chứa thông tin đơn vị của manager.
 *  Service sau khi nhận filter sẽ append vào WHERE clause của Prisma:
 *      where: { ..., quan_nhan_id: { in: [...allowedPersonnelIds] } }
 *  hoặc
 *      where: { ..., co_quan_don_vi_id: managerUnitId }
 *
 *  PHÂN CẤP ĐƠN VỊ:
 *  - CoQuanDonVi (CQDV): đơn vị "mẹ" (vd: "Học viện").
 *  - DonViTrucThuoc (DVTT): đơn vị con trực thuộc (vd: "Hệ 1").
 *  - Quan hệ: 1 CQDV có N DVTT.
 *
 *  RULE QUYỀN XEM:
 *  - Manager của CQDV → xem ĐƯỢC tất cả DVTT con + chính CQDV.
 *  - Manager của DVTT → CHỈ xem DVTT đó (không xem CQDV mẹ).
 *
 *  Vì vậy `getPersonnelInUnit` có 2 nhánh:
 *  - isCoQuanDonVi=true  → query: WHERE co_quan_don_vi_id=X OR don_vi_truc_thuoc_id IN (children of X)
 *  - isCoQuanDonVi=false → query: WHERE don_vi_truc_thuoc_id=X
 *
 *  PERFORMANCE:
 *  - Middleware chạy mỗi request → có 2 query DB (lấy unitInfo + danh sách
 *    personnel trong unit). Với manager có nhiều DVTT, query 2 hơi nặng.
 *  - Tối ưu: cache theo session (5 phút) nếu cần. Hiện chưa cache vì
 *    số manager ít + đơn vị ít thay đổi.
 *
 *  ROLE OTHER THAN MANAGER:
 *  - SUPER_ADMIN, ADMIN: xem tất cả → req.unitFilter = null (không filter).
 *  - USER (quân nhân): chỉ xem CHÍNH MÌNH → filter ở service riêng, không
 *    qua middleware này.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
