/**
 * Unit Filter Middleware
 * Pattern: Middleware Pattern - tách logic phân quyền đơn vị ra khỏi controller
 *
 * MANAGER chỉ được truy cập dữ liệu trong đơn vị của mình.
 * Middleware này tự động gắn thông tin đơn vị vào req để controller sử dụng.
 *
 * Sau khi middleware chạy, req sẽ có thêm:
 * - req.unitFilter.don_vi_id: ID đơn vị (co_quan_don_vi hoặc don_vi_truc_thuoc)
 * - req.unitFilter.isCoQuanDonVi: true nếu manager thuộc cơ quan đơn vị
 * - req.unitFilter.personnelIds: danh sách ID quân nhân trong đơn vị (nếu cần)
 */

const { prisma } = require('../models');
const { ROLES } = require('../constants/roles');

/**
 * Lấy thông tin đơn vị của user hiện tại
 */
const getUnitInfo = async quanNhanId => {
  if (!quanNhanId) return null;

  const personnel = await prisma.quanNhan.findUnique({
    where: { id: quanNhanId },
    select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
  });

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

/**
 * Lấy danh sách quân nhân trong đơn vị
 */
const getPersonnelInUnit = async unitInfo => {
  if (!unitInfo) return [];

  if (unitInfo.isCoQuanDonVi) {
    const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
      where: { co_quan_don_vi_id: unitInfo.don_vi_id },
      select: { id: true },
    });
    const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);

    return prisma.quanNhan.findMany({
      where: {
        OR: [
          { co_quan_don_vi_id: unitInfo.don_vi_id },
          { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
        ],
      },
      select: { id: true },
    });
  }

  return prisma.quanNhan.findMany({
    where: { don_vi_truc_thuoc_id: unitInfo.don_vi_id },
    select: { id: true },
  });
};

/**
 * Middleware: Gắn unit filter cho MANAGER
 * Sử dụng: router.get('/path', verifyToken, attachUnitFilter, controller.method)
 *
 * Sau khi middleware chạy:
 * - ADMIN/SUPER_ADMIN: req.unitFilter = null (không lọc)
 * - MANAGER: req.unitFilter = { don_vi_id, isCoQuanDonVi }
 */
const attachUnitFilter = async (req, res, next) => {
  try {
    const userRole = req.user?.role;

    // ADMIN và SUPER_ADMIN không cần filter
    if (userRole !== ROLES.MANAGER) {
      req.unitFilter = null;
      return next();
    }

    const quanNhanId = req.user?.quan_nhan_id;
    if (!quanNhanId) {
      return res.status(403).json({
        success: false,
        message: 'Không tìm thấy thông tin quân nhân của người dùng',
      });
    }

    const unitInfo = await getUnitInfo(quanNhanId);
    if (!unitInfo) {
      return res.status(403).json({
        success: false,
        message: 'Không tìm thấy thông tin đơn vị của người dùng',
      });
    }

    req.unitFilter = unitInfo;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Gắn unit filter kèm danh sách quân nhân
 * Sử dụng khi cần filter theo personnel IDs
 */
const attachUnitFilterWithPersonnel = async (req, res, next) => {
  try {
    const userRole = req.user?.role;

    if (userRole !== ROLES.MANAGER) {
      req.unitFilter = null;
      return next();
    }

    const quanNhanId = req.user?.quan_nhan_id;
    if (!quanNhanId) {
      return res.status(403).json({
        success: false,
        message: 'Không tìm thấy thông tin quân nhân của người dùng',
      });
    }

    const unitInfo = await getUnitInfo(quanNhanId);
    if (!unitInfo) {
      return res.status(403).json({
        success: false,
        message: 'Không tìm thấy thông tin đơn vị của người dùng',
      });
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

module.exports = {
  attachUnitFilter,
  attachUnitFilterWithPersonnel,
  getUnitInfo,
  getPersonnelInUnit,
};
