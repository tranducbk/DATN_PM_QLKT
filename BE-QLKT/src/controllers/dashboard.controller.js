const { prisma } = require('../models');

class DashboardController {
  /**
   * GET /api/dashboard/statistics
   * Lấy dữ liệu thống kê cho dashboard
   */
  async getStatistics(req, res) {
    try {
      const currentUser = req.user;

      // 1. Phân bố vai trò
      const roleDistribution = await prisma.taiKhoan.groupBy({
        by: ['role'],
        _count: {
          id: true,
        },
      });

      // 2. Hoạt động hệ thống theo ngày (7 ngày gần nhất)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const dailyActivity = await prisma.systemLog.findMany({
        where: {
          created_at: {
            gte: sevenDaysAgo,
          },
        },
        select: {
          created_at: true,
        },
      });

      // Nhóm theo ngày
      const activityByDate = {};
      dailyActivity.forEach(log => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        activityByDate[date] = (activityByDate[date] || 0) + 1;
      });

      // Tạo mảng 7 ngày gần nhất
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push({
          date: dateStr,
          count: activityByDate[dateStr] || 0,
        });
      }

      // 3. Số lượng logs theo loại hành động (top 10)
      const logsByAction = await prisma.systemLog.groupBy({
        by: ['action'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      });

      // 4. Số lượng tài khoản mới theo thời gian (30 ngày gần nhất)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      const newAccounts = await prisma.taiKhoan.findMany({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
        select: {
          createdAt: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Nhóm theo ngày
      const accountsByDate = {};
      newAccounts.forEach(account => {
        const date = new Date(account.createdAt).toISOString().split('T')[0];
        accountsByDate[date] = (accountsByDate[date] || 0) + 1;
      });

      // Tạo mảng 30 ngày gần nhất
      const last30Days = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last30Days.push({
          date: dateStr,
          count: accountsByDate[dateStr] || 0,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Lấy thống kê thành công',
        data: {
          roleDistribution: roleDistribution.map(item => ({
            role: item.role,
            count: item._count.id,
          })),
          dailyActivity: last7Days,
          logsByAction: logsByAction.map(item => ({
            action: item.action,
            count: item._count.id,
          })),
          newAccountsByDate: last30Days,
        },
      });
    } catch (error) {
      console.error('Get dashboard statistics error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy thống kê',
      });
    }
  }

  /**
   * GET /api/dashboard/statistics/admin
   * Lấy dữ liệu thống kê cho dashboard Admin
   */
  async getAdminStatistics(req, res) {
    try {
      // 1. Thành tích khoa học theo loại (NCKH vs SKKH)
      const scientificAchievementsByType = await prisma.thanhTichKhoaHoc.groupBy({
        by: ['loai'],
        where: {
          status: 'APPROVED',
        },
        _count: {
          id: true,
        },
      });

      // 2. Đề xuất theo loại (7 ngày gần nhất)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const proposalsByType = await prisma.bangDeXuat.groupBy({
        by: ['loai_de_xuat'],
        where: {
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        _count: {
          id: true,
        },
      });

      // 3. Đề xuất theo trạng thái
      const proposalsByStatus = await prisma.bangDeXuat.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
      });

      // 4. Thành tích khoa học theo tháng (6 tháng gần nhất)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const scientificAchievements = await prisma.thanhTichKhoaHoc.findMany({
        where: {
          createdAt: {
            gte: sixMonthsAgo,
          },
          status: 'APPROVED',
        },
        select: {
          createdAt: true,
        },
      });

      // Nhóm theo tháng
      const achievementsByMonth = {};
      scientificAchievements.forEach(achievement => {
        const date = new Date(achievement.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        achievementsByMonth[monthKey] = (achievementsByMonth[monthKey] || 0) + 1;
      });

      // Tạo mảng 6 tháng gần nhất
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        last6Months.push({
          month: monthKey,
          count: achievementsByMonth[monthKey] || 0,
        });
      }

      // 5. Total personnel
      const totalPersonnel = await prisma.quanNhan.count();

      // 6. Total units
      const totalUnits = await prisma.donViTrucThuoc.count();

      // 7. Total positions
      const totalPositions = await prisma.chucVu.count();

      // 8. Total proposals
      const pendingApprovals = await prisma.bangDeXuat.count({
        where: { status: 'PENDING' }
      });

      return res.status(200).json({
        success: true,
        message: 'Lấy thống kê Admin thành công',
        data: {
          scientificAchievementsByType: scientificAchievementsByType.map(item => ({
            type: item.loai,
            count: item._count.id,
          })),
          proposalsByType: proposalsByType.map(item => ({
            type: item.loai_de_xuat,
            count: item._count.id,
          })),
          proposalsByStatus: proposalsByStatus.map(item => ({
            status: item.status,
            count: item._count.id,
          })),
          scientificAchievementsByMonth: last6Months,
          totalPersonnel: totalPersonnel,
          totalUnits: totalUnits,
          totalPositions: totalPositions,
          pendingApprovals: pendingApprovals,
        },
      });
    } catch (error) {
      console.error('Get admin statistics error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy thống kê Admin',
      });
    }
  }

  /**
   * GET /api/dashboard/statistics/manager
   * Lấy dữ liệu thống kê cho dashboard Manager
   */
  async getManagerStatistics(req, res) {
    try {
      const currentUser = req.user;
      let unitId = null;

      // Lấy đơn vị của manager - ưu tiên quan_nhan_id từ req.user, fallback về account
      const userQuanNhanId = currentUser.quan_nhan_id;

      if (userQuanNhanId) {
        const personnel = await prisma.quanNhan.findUnique({
          where: { id: userQuanNhanId },
          select: {
            don_vi_truc_thuoc_id: true,
            co_quan_don_vi_id: true,
          },
        });


        // Manager có thể thuộc co_quan_don_vi_id hoặc don_vi_truc_thuoc_id
        // Nếu có co_quan_don_vi_id, lấy tất cả quân nhân trong cơ quan đơn vị đó
        // Nếu có don_vi_truc_thuoc_id, lấy quân nhân trong đơn vị trực thuộc đó
        if (personnel?.co_quan_don_vi_id) {
          // Manager thuộc cơ quan đơn vị - lấy tất cả quân nhân trong cơ quan đơn vị và các đơn vị trực thuộc
          unitId = personnel.co_quan_don_vi_id;
        } else if (personnel?.don_vi_truc_thuoc_id) {
          // Manager thuộc đơn vị trực thuộc
          unitId = personnel.don_vi_truc_thuoc_id;
        }
      } else {
        // Fallback: lấy từ account nếu req.user không có quan_nhan_id
        const account = await prisma.taiKhoan.findUnique({
          where: { id: currentUser.id },
          select: { quan_nhan_id: true },
        });


        if (account?.quan_nhan_id) {
          const personnel = await prisma.quanNhan.findUnique({
            where: { id: account.quan_nhan_id },
            select: {
              don_vi_truc_thuoc_id: true,
              co_quan_don_vi_id: true,
            },
          });

          if (personnel?.co_quan_don_vi_id) {
            unitId = personnel.co_quan_don_vi_id;
          } else if (personnel?.don_vi_truc_thuoc_id) {
            unitId = personnel.don_vi_truc_thuoc_id;
          }
        }
      }

      if (!unitId) {
        return res.status(200).json({
          success: true,
          message: 'Lấy thống kê Manager thành công',
          data: {
            awardsByType: [],
            proposalsByType: [],
            proposalsByStatus: [],
            awardsByMonth: [],
            personnelByRank: [],
            scientificAchievementsByMonth: [],
            scientificAchievementsByType: [],
            personnelByPosition: [],
          },
        });
      }

      // 1. Khen thưởng theo loại (trong đơn vị)
      // Lấy lại thông tin manager để xác định loại đơn vị
      const managerPersonnel = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId || currentUser.quan_nhan_id },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });

      let personnelInUnit = [];
      const isCoQuanDonVi = managerPersonnel?.co_quan_don_vi_id === unitId;

      if (isCoQuanDonVi) {
        // Manager thuộc cơ quan đơn vị - lấy tất cả quân nhân trong cơ quan đơn vị và các đơn vị trực thuộc
        const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
          where: { co_quan_don_vi_id: unitId },
          select: { id: true },
        });
        const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);

        personnelInUnit = await prisma.quanNhan.findMany({
          where: {
            OR: [
              { co_quan_don_vi_id: unitId },
              { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
            ],
          },
          select: { id: true },
        });
      } else {
        // Manager thuộc đơn vị trực thuộc - chỉ lấy quân nhân trong đơn vị đó
        personnelInUnit = await prisma.quanNhan.findMany({
          where: { don_vi_truc_thuoc_id: unitId },
          select: { id: true },
        });
      }

      const personnelIds = personnelInUnit.map(p => p.id);


      // Lấy danh hiệu hằng năm
      const annualAwards =
        personnelIds.length > 0
          ? await prisma.danhHieuHangNam.findMany({
              where: {
                quan_nhan_id: { in: personnelIds },
              },
              select: {
                danh_hieu: true,
              },
            })
          : [];


      const awardsByType = {};
      annualAwards.forEach(award => {
        if (award.danh_hieu) {
          awardsByType[award.danh_hieu] = (awardsByType[award.danh_hieu] || 0) + 1;
        }
      });

      // 2. Đề xuất theo trạng thái (của đơn vị)
      const proposalsByStatus = await prisma.bangDeXuat.groupBy({
        by: ['status'],
        where: {
          nguoi_de_xuat_id: currentUser.id,
        },
        _count: {
          id: true,
        },
      });

      // 3. Khen thưởng theo tháng (6 tháng gần nhất)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const recentAwards =
        personnelIds.length > 0
          ? await prisma.danhHieuHangNam.findMany({
              where: {
                quan_nhan_id: { in: personnelIds },
                createdAt: {
                  gte: sixMonthsAgo,
                },
              },
              select: {
                createdAt: true,
              },
            })
          : [];

      // Nhóm theo tháng
      const awardsByMonth = {};
      recentAwards.forEach(award => {
        const date = new Date(award.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        awardsByMonth[monthKey] = (awardsByMonth[monthKey] || 0) + 1;
      });

      // Tạo mảng 6 tháng gần nhất
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        last6Months.push({
          month: monthKey,
          count: awardsByMonth[monthKey] || 0,
        });
      }

      // 4. Quân nhân theo cấp bậc
      let personnelByRank = [];
      if (isCoQuanDonVi) {
        // Manager thuộc cơ quan đơn vị
        const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
          where: { co_quan_don_vi_id: unitId },
          select: { id: true },
        });
        const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);

        personnelByRank = await prisma.quanNhan.groupBy({
          by: ['cap_bac'],
          where: {
            OR: [
              { co_quan_don_vi_id: unitId },
              { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
            ],
            cap_bac: { not: null },
          },
          _count: {
            id: true,
          },
        });
      } else {
        // Manager thuộc đơn vị trực thuộc
        personnelByRank = await prisma.quanNhan.groupBy({
          by: ['cap_bac'],
          where: {
            don_vi_truc_thuoc_id: unitId,
            cap_bac: { not: null },
          },
          _count: {
            id: true,
          },
        });
      }

      // 5. Đề xuất theo loại (của manager)
      const proposalsByType = await prisma.bangDeXuat.groupBy({
        by: ['loai_de_xuat'],
        where: {
          nguoi_de_xuat_id: currentUser.id,
        },
        _count: {
          id: true,
        },
      });

      // 6. Thành tích khoa học theo tháng (6 tháng gần nhất)
      // Nếu không có personnelIds, vẫn tạo mảng rỗng để tránh lỗi
      const scientificAchievements =
        personnelIds.length > 0
          ? await prisma.thanhTichKhoaHoc.findMany({
              where: {
                quan_nhan_id: { in: personnelIds },
                createdAt: {
                  gte: sixMonthsAgo,
                },
                status: 'APPROVED',
              },
              select: {
                createdAt: true,
              },
            })
          : [];

      // Nhóm theo tháng
      const achievementsByMonth = {};
      scientificAchievements.forEach(achievement => {
        const date = new Date(achievement.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        achievementsByMonth[monthKey] = (achievementsByMonth[monthKey] || 0) + 1;
      });

      // Tạo mảng 6 tháng gần nhất cho thành tích khoa học
      const last6MonthsScientific = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        last6MonthsScientific.push({
          month: monthKey,
          count: achievementsByMonth[monthKey] || 0,
        });
      }

      // 7. Quân nhân theo chức vụ
      let personnelWithPositions = [];
      if (isCoQuanDonVi) {
        // Manager thuộc cơ quan đơn vị
        const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
          where: { co_quan_don_vi_id: unitId },
          select: { id: true },
        });
        const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);

        personnelWithPositions = await prisma.quanNhan.findMany({
          where: {
            OR: [
              { co_quan_don_vi_id: unitId },
              { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
            ],
          },
          select: {
            chuc_vu_id: true,
          },
        });
      } else {
        // Manager thuộc đơn vị trực thuộc
        personnelWithPositions = await prisma.quanNhan.findMany({
          where: {
            don_vi_truc_thuoc_id: unitId,
          },
          select: {
            chuc_vu_id: true,
          },
        });
      }

      const positionCounts = {};
      personnelWithPositions.forEach(p => {
        if (p.chuc_vu_id) {
          positionCounts[p.chuc_vu_id] = (positionCounts[p.chuc_vu_id] || 0) + 1;
        }
      });

      const positionIds = Object.keys(positionCounts);
      const positions = await prisma.chucVu.findMany({
        where: {
          id: { in: positionIds },
        },
        select: {
          id: true,
          ten_chuc_vu: true,
        },
      });

      const positionMap = {};
      positions.forEach(pos => {
        positionMap[pos.id] = pos.ten_chuc_vu;
      });

      // 8. Thành tích khoa học theo loại (tổng hợp, không chỉ 6 tháng)
      const scientificAchievementsByType =
        personnelIds.length > 0
          ? await prisma.thanhTichKhoaHoc.groupBy({
              by: ['loai'],
              where: {
                quan_nhan_id: { in: personnelIds },
                status: 'APPROVED',
              },
              _count: {
                id: true,
              },
            })
          : [];

      return res.status(200).json({
        success: true,
        message: 'Lấy thống kê Manager thành công',
        data: {
          awardsByType: Object.entries(awardsByType).map(([type, count]) => ({
            type,
            count,
          })),
          proposalsByType: proposalsByType.map(item => ({
            type: item.loai_de_xuat,
            count: item._count.id,
          })),
          proposalsByStatus: proposalsByStatus.map(item => ({
            status: item.status,
            count: item._count.id,
          })),
          awardsByMonth: last6Months,
          personnelByRank: personnelByRank
            .filter(item => item.cap_bac)
            .map(item => ({
              rank: item.cap_bac,
              count: item._count.id,
            })),
          scientificAchievementsByMonth: last6MonthsScientific,
          scientificAchievementsByType: scientificAchievementsByType.map(item => ({
            type: item.loai,
            count: item._count.id,
          })),
          personnelByPosition: Object.entries(positionCounts).map(([positionId, count]) => ({
            positionId,
            positionName: positionMap[positionId] || 'Chưa xác định',
            count,
          })),
          totalPersonnel: personnelIds.length,
        },
      });
    } catch (error) {
      console.error('Get manager statistics error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy thống kê Manager',
      });
    }
  }
}

module.exports = new DashboardController();
