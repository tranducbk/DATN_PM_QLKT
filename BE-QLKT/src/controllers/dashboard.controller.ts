import { Request, Response } from 'express';
import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';

/** Generate array of date strings for the last N days */
function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (n - 1 - i));
    return date.toISOString().split('T')[0];
  });
}

/** Generate array of month strings (YYYY-MM) for the last N months */
function getLastNMonths(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (n - 1 - i));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

/** Build stats array from date strings and a count map */
function buildDateStats(dates: string[], countMap: Record<string, number>): { date: string; count: number }[] {
  return dates.map(date => ({ date, count: countMap[date] || 0 }));
}

/** Build stats array from month strings and a count map */
function buildMonthStats(months: string[], countMap: Record<string, number>): { month: string; count: number }[] {
  return months.map(month => ({ month, count: countMap[month] || 0 }));
}

/** Count records by date key (YYYY-MM-DD) */
function countByDate(records: { created_at?: Date; createdAt?: Date }[]): Record<string, number> {
  const countMap: Record<string, number> = {};
  records.forEach(record => {
    const dateValue = record.created_at || record.createdAt;
    if (dateValue) {
      const key = new Date(dateValue).toISOString().split('T')[0];
      countMap[key] = (countMap[key] || 0) + 1;
    }
  });
  return countMap;
}

/** Count records by month key (YYYY-MM) */
function countByMonth(records: { createdAt: Date }[]): Record<string, number> {
  const countMap: Record<string, number> = {};
  records.forEach(record => {
    const date = new Date(record.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    countMap[key] = (countMap[key] || 0) + 1;
  });
  return countMap;
}

/** Create a Date set to N days ago at midnight */
function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Create a Date set to the 1st of N months ago at midnight */
function monthsAgo(n: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - n);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

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
  getStatistics = catchAsync(async (req: Request, res: Response) => {
    const roleDistribution = await prisma.taiKhoan.groupBy({
      by: ['role'],
      _count: {
        id: true,
      },
    });

    const dailyActivity = await prisma.systemLog.findMany({
      where: {
        created_at: {
          gte: daysAgo(7),
        },
      },
      select: {
        created_at: true,
      },
    });

    const last7Days = buildDateStats(getLastNDays(7), countByDate(dailyActivity));

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

    const newAccounts = await prisma.taiKhoan.findMany({
      where: {
        createdAt: {
          gte: daysAgo(30),
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const last30Days = buildDateStats(getLastNDays(30), countByDate(newAccounts));

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

  getAdminStatistics = catchAsync(async (req: Request, res: Response) => {
    const scientificAchievementsByType = await prisma.thanhTichKhoaHoc.groupBy({
      by: ['loai'],
      where: {
        status: PROPOSAL_STATUS.APPROVED,
      },
      _count: {
        id: true,
      },
    });

    const proposalsByType = await prisma.bangDeXuat.groupBy({
      by: ['loai_de_xuat'],
      where: {
        createdAt: {
          gte: daysAgo(7),
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

    const scientificAchievements = await prisma.thanhTichKhoaHoc.findMany({
      where: {
        createdAt: {
          gte: monthsAgo(6),
        },
        status: PROPOSAL_STATUS.APPROVED,
      },
      select: {
        createdAt: true,
      },
    });

    const last6Months = buildMonthStats(getLastNMonths(6), countByMonth(scientificAchievements));

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

    const sixMonthsAgoDate = monthsAgo(6);

    const recentAwards =
      personnelIds.length > 0
        ? await prisma.danhHieuHangNam.findMany({
            where: {
              quan_nhan_id: { in: personnelIds },
              createdAt: {
                gte: sixMonthsAgoDate,
              },
            },
            select: {
              createdAt: true,
            },
          })
        : [];

    const monthKeys = getLastNMonths(6);
    const last6MonthsAwards = buildMonthStats(monthKeys, countByMonth(recentAwards));

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
                gte: sixMonthsAgoDate,
              },
              status: PROPOSAL_STATUS.APPROVED,
            },
            select: {
              createdAt: true,
            },
          })
        : [];

    const last6MonthsScientific = buildMonthStats(monthKeys, countByMonth(scientificAchievements));

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
        awardsByMonth: last6MonthsAwards,
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
