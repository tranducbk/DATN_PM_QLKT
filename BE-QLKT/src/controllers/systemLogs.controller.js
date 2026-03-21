const { prisma } = require('../models');
const { ROLES } = require('../constants/roles');

class SystemLogsController {
  /**
   * GET /api/system-logs
   * Lấy danh sách nhật ký hệ thống với phân quyền
   */
  async getLogs(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        action,
        resource,
        startDate,
        endDate,
        actorRole,
      } = req.query;
      const currentUser = req.user;

      // Phân quyền xem log theo cấp bậc
      const roleHierarchy = {
        USER: 1,
        MANAGER: 2,
        ADMIN: 3,
        SUPER_ADMIN: 4,
      };

      const currentUserLevel = roleHierarchy[currentUser.role] || 0;
      const allowedRoles = Object.keys(roleHierarchy).filter(
        role => roleHierarchy[role] <= currentUserLevel
      );

      const skip = (page - 1) * limit;
      const where = {};

      // Phân quyền xem log theo cấp bậc:
      // - MANAGER: xem được USER và MANAGER (trong đơn vị của mình)
      // - ADMIN: xem được USER, MANAGER, ADMIN
      // - SUPER_ADMIN: xem được tất cả (USER, MANAGER, ADMIN, SUPER_ADMIN)
      if (currentUser.role === ROLES.MANAGER) {
        // MANAGER chỉ xem được USER và MANAGER trong đơn vị của mình
        where.actor_role = { in: ['USER', 'MANAGER'] };

        // Filter theo đơn vị của Manager
        if (currentUser.quan_nhan_id) {
          const managerPersonnel = await prisma.quanNhan.findUnique({
            where: { id: currentUser.quan_nhan_id },
            select: {
              co_quan_don_vi_id: true,
              don_vi_truc_thuoc_id: true,
            },
          });

          if (managerPersonnel) {
            // Lấy danh sách quân nhân trong đơn vị của Manager
            let personnelInUnit = [];

            if (managerPersonnel.co_quan_don_vi_id) {
              // Manager thuộc cơ quan đơn vị - lấy tất cả quân nhân trong cơ quan đơn vị và các đơn vị trực thuộc
              const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
                where: { co_quan_don_vi_id: managerPersonnel.co_quan_don_vi_id },
                select: { id: true },
              });
              const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);

              personnelInUnit = await prisma.quanNhan.findMany({
                where: {
                  OR: [
                    { co_quan_don_vi_id: managerPersonnel.co_quan_don_vi_id },
                    { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
                  ],
                },
                select: { id: true },
              });
            } else if (managerPersonnel.don_vi_truc_thuoc_id) {
              // Manager thuộc đơn vị trực thuộc - chỉ lấy quân nhân trong đơn vị đó
              personnelInUnit = await prisma.quanNhan.findMany({
                where: { don_vi_truc_thuoc_id: managerPersonnel.don_vi_truc_thuoc_id },
                select: { id: true },
              });
            }

            // Lấy danh sách tài khoản của các quân nhân trong đơn vị
            const personnelIds = personnelInUnit.map(p => p.id);
            if (personnelIds.length > 0) {
              const accountsInUnit = await prisma.taiKhoan.findMany({
                where: {
                  quan_nhan_id: { in: personnelIds },
                },
                select: { id: true },
              });
              const accountIds = accountsInUnit.map(a => a.id);

              if (accountIds.length > 0) {
                where.nguoi_thuc_hien_id = { in: accountIds };
              } else {
                // Không có tài khoản nào trong đơn vị, trả về rỗng
                where.nguoi_thuc_hien_id = { in: [] };
              }
            } else {
              // Không có quân nhân nào trong đơn vị, trả về rỗng
              where.nguoi_thuc_hien_id = { in: [] };
            }
          }
        }
      } else if (currentUser.role === ROLES.ADMIN) {
        // ADMIN xem được USER, MANAGER, ADMIN
        where.actor_role = { in: ['USER', 'MANAGER', 'ADMIN'] };
      } else if (currentUser.role === ROLES.SUPER_ADMIN) {
        // SUPER_ADMIN xem được tất cả
        if (actorRole && allowedRoles.includes(actorRole)) {
          where.actor_role = actorRole;
        } else {
          where.actor_role = { in: allowedRoles };
        }
      } else {
        // USER không được xem log
        return res.status(403).json({
          success: false,
          message: 'Không có quyền xem nhật ký hệ thống',
        });
      }

      // Nếu có filter actorRole và role đó được phép xem, override previous filter
      if (actorRole && allowedRoles.includes(actorRole)) {
        where.actor_role = actorRole;
      }

      // Tìm kiếm theo mô tả
      if (search) {
        where.description = {
          contains: search,
          mode: 'insensitive',
        };
      }

      // Lọc theo hành động
      if (action) {
        where.action = action;
      }

      // Lọc theo tài nguyên
      if (resource) {
        where.resource = resource;
      }

      // Lọc theo thời gian
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) {
          where.created_at.gte = new Date(startDate);
        }
        if (endDate) {
          where.created_at.lte = new Date(endDate);
        }
      }

      const [logs, total] = await Promise.all([
        prisma.systemLog.findMany({
          skip: parseInt(skip),
          take: parseInt(limit),
          where,
          include: {
            NguoiThucHien: {
              select: {
                id: true,
                username: true,
                role: true,
                QuanNhan: {
                  select: {
                    ho_ten: true,
                  },
                },
              },
            },
          },
          orderBy: {
            created_at: 'desc',
          },
        }),
        prisma.systemLog.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        message: 'Lấy nhật ký hệ thống thành công',
        data: {
          logs,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
      });
    }
  }

  /**
   * GET /api/system-logs/actions
   * Lấy danh sách các hành động có thể lọc
   */
  async getActions(req, res) {
    try {
      const actions = await prisma.systemLog.findMany({
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' },
      });

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách hành động thành công',
        data: actions.map(item => item.action),
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
      });
    }
  }

  /**
   * GET /api/system-logs/resources
   * Lấy danh sách các tài nguyên có thể lọc
   */
  async getResources(req, res) {
    try {
      const resources = await prisma.systemLog.findMany({
        select: { resource: true },
        distinct: ['resource'],
        orderBy: { resource: 'asc' },
      });

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách tài nguyên thành công',
        data: resources.map(item => item.resource),
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
      });
    }
  }
  /**
   * DELETE /api/system-logs
   * Xoá nhật ký hệ thống (yêu cầu DevZone bật allow_delete_logs)
   */
  async deleteLogs(req, res) {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách ID không hợp lệ',
        });
      }

      const result = await prisma.systemLog.deleteMany({
        where: { id: { in: ids } },
      });

      return res.status(200).json({
        success: true,
        message: `Đã xoá ${result.count} nhật ký`,
        data: { deleted: result.count },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
      });
    }
  }

  async deleteAllLogs(req, res) {
    try {
      const count = await prisma.systemLog.count();
      await prisma.systemLog.deleteMany({});

      // Ghi log hành động xoá (sau khi xoá xong, log này sẽ là bản ghi duy nhất)
      await prisma.systemLog.create({
        data: {
          nguoi_thuc_hien_id: req.user.id,
          actor_role: req.user.role,
          action: 'DELETE',
          resource: 'system-logs',
          description: `Xoá toàn bộ ${count} nhật ký hệ thống`,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Đã xoá toàn bộ ${count} nhật ký`,
        data: { deleted: count },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
      });
    }
  }
}

module.exports = new SystemLogsController();
