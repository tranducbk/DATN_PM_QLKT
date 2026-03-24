import { Request, Response } from 'express';
import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';

/** groupBy theo quân hàm — Prisma overload bị sai khi `where` có `cap_bac: { not: null }` (runtime đúng). */
async function groupQuanNhanByCapBac(
  where: Prisma.QuanNhanWhereInput
): Promise<{ cap_bac: string | null; _count: { id: number } }[]> {
  // @ts-expect-error Prisma groupBy generic overload không khớp với filter cap_bac (ghi chú JSDoc phía trên)
  return prisma.quanNhan.groupBy({
    by: ['cap_bac'],
    where,
    _count: { id: true },
  });
}

class DashboardController {
  getStatistics = catchAsync(async (_req: Request, res: Response) => {
    const roleDistribution = await prisma.taiKhoan.groupBy({
      by: ['role'],
      _count: {
        id: true,
      },
    });

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

    const activityByDate: Record<string, number> = {};
    dailyActivity.forEach((log: { created_at: Date }) => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      activityByDate[date] = (activityByDate[date] || 0) + 1;
    });

    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last7Days.push({
        date: dateStr,
        count: activityByDate[dateStr] || 0,
      });
    }

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

    const accountsByDate: Record<string, number> = {};
    newAccounts.forEach((account: { createdAt: Date }) => {
      const date = new Date(account.createdAt).toISOString().split('T')[0];
      accountsByDate[date] = (accountsByDate[date] || 0) + 1;
    });

    const last30Days: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last30Days.push({
        date: dateStr,
        count: accountsByDate[dateStr] || 0,
      });
    }

    return ResponseHelper.success(res, {
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
  });

  getAdminStatistics = catchAsync(async (_req: Request, res: Response) => {
    const scientificAchievementsByType = await prisma.thanhTichKhoaHoc.groupBy({
      by: ['loai'],
      where: {
        status: PROPOSAL_STATUS.APPROVED,
      },
      _count: {
        id: true,
      },
    });

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

    const proposalsByStatus = await prisma.bangDeXuat.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const scientificAchievements = await prisma.thanhTichKhoaHoc.findMany({
      where: {
        createdAt: {
          gte: sixMonthsAgo,
        },
        status: PROPOSAL_STATUS.APPROVED,
      },
      select: {
        createdAt: true,
      },
    });

    const achievementsByMonth: Record<string, number> = {};
    scientificAchievements.forEach((achievement: { createdAt: Date }) => {
      const date = new Date(achievement.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      achievementsByMonth[monthKey] = (achievementsByMonth[monthKey] || 0) + 1;
    });

    const last6Months: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      last6Months.push({
        month: monthKey,
        count: achievementsByMonth[monthKey] || 0,
      });
    }

    const totalPersonnel = await prisma.quanNhan.count();
    const totalUnits = await prisma.donViTrucThuoc.count();
    const totalPositions = await prisma.chucVu.count();
    const pendingApprovals = await prisma.bangDeXuat.count({
      where: { status: PROPOSAL_STATUS.PENDING },
    });

    return ResponseHelper.success(res, {
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
        totalPersonnel,
        totalUnits,
        totalPositions,
        pendingApprovals,
      },
    });
  });

  getManagerStatistics = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user!;
    let unitId: string | null = null;

    const userQuanNhanId = currentUser.quan_nhan_id;

    if (userQuanNhanId) {
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
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
    } else {
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
      return ResponseHelper.success(res, {
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

    const managerPersonnel = await prisma.quanNhan.findUnique({
      where: { id: userQuanNhanId || currentUser.quan_nhan_id! },
      select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
    });

    let personnelInUnit: { id: string }[] = [];
    const isCoQuanDonVi = managerPersonnel?.co_quan_don_vi_id === unitId;

    if (isCoQuanDonVi) {
      const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
        where: { co_quan_don_vi_id: unitId },
        select: { id: true },
      });
      const donViTrucThuocIdList = donViTrucThuocIds.map((d: { id: string }) => d.id);

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
      personnelInUnit = await prisma.quanNhan.findMany({
        where: { don_vi_truc_thuoc_id: unitId },
        select: { id: true },
      });
    }

    const personnelIds = personnelInUnit.map(p => p.id);

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

    const awardsByType: Record<string, number> = {};
    annualAwards.forEach((award: { danh_hieu: string | null }) => {
      if (award.danh_hieu) {
        awardsByType[award.danh_hieu] = (awardsByType[award.danh_hieu] || 0) + 1;
      }
    });

    const proposalsByStatus = await prisma.bangDeXuat.groupBy({
      by: ['status'],
      where: {
        nguoi_de_xuat_id: currentUser.id,
      },
      _count: {
        id: true,
      },
    });

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

    const awardsByMonth: Record<string, number> = {};
    recentAwards.forEach((award: { createdAt: Date }) => {
      const date = new Date(award.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      awardsByMonth[monthKey] = (awardsByMonth[monthKey] || 0) + 1;
    });

    const last6Months: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      last6Months.push({
        month: monthKey,
        count: awardsByMonth[monthKey] || 0,
      });
    }

    let personnelByRank: { cap_bac: string | null; _count: { id: number } }[] = [];
    if (isCoQuanDonVi) {
      const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
        where: { co_quan_don_vi_id: unitId },
        select: { id: true },
      });
      const donViTrucThuocIdList = donViTrucThuocIds.map((d: { id: string }) => d.id);

      personnelByRank = await groupQuanNhanByCapBac({
        OR: [
          { co_quan_don_vi_id: unitId },
          { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
        ],
        cap_bac: { not: null },
      });
    } else {
      personnelByRank = await groupQuanNhanByCapBac({
        don_vi_truc_thuoc_id: unitId,
        cap_bac: { not: null },
      });
    }

    const proposalsByType = await prisma.bangDeXuat.groupBy({
      by: ['loai_de_xuat'],
      where: {
        nguoi_de_xuat_id: currentUser.id,
      },
      _count: {
        id: true,
      },
    });

    const scientificAchievements =
      personnelIds.length > 0
        ? await prisma.thanhTichKhoaHoc.findMany({
            where: {
              quan_nhan_id: { in: personnelIds },
              createdAt: {
                gte: sixMonthsAgo,
              },
              status: PROPOSAL_STATUS.APPROVED,
            },
            select: {
              createdAt: true,
            },
          })
        : [];

    const achievementsByMonth: Record<string, number> = {};
    scientificAchievements.forEach((achievement: { createdAt: Date }) => {
      const date = new Date(achievement.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      achievementsByMonth[monthKey] = (achievementsByMonth[monthKey] || 0) + 1;
    });

    const last6MonthsScientific: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      last6MonthsScientific.push({
        month: monthKey,
        count: achievementsByMonth[monthKey] || 0,
      });
    }

    let personnelWithPositions: { chuc_vu_id: string | null }[] = [];
    if (isCoQuanDonVi) {
      const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
        where: { co_quan_don_vi_id: unitId },
        select: { id: true },
      });
      const donViTrucThuocIdList = donViTrucThuocIds.map((d: { id: string }) => d.id);

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
      personnelWithPositions = await prisma.quanNhan.findMany({
        where: {
          don_vi_truc_thuoc_id: unitId,
        },
        select: {
          chuc_vu_id: true,
        },
      });
    }

    const positionCounts: Record<string, number> = {};
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

    const positionMap: Record<string, string> = {};
    positions.forEach((pos: { id: string; ten_chuc_vu: string }) => {
      positionMap[pos.id] = pos.ten_chuc_vu;
    });

    const scientificAchievementsByType =
      personnelIds.length > 0
        ? await prisma.thanhTichKhoaHoc.groupBy({
            by: ['loai'],
            where: {
              quan_nhan_id: { in: personnelIds },
              status: PROPOSAL_STATUS.APPROVED,
            },
            _count: {
              id: true,
            },
          })
        : [];

    return ResponseHelper.success(res, {
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
  });
}

export default new DashboardController();
