import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';

function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (n - 1 - i));
    return date.toISOString().split('T')[0];
  });
}

function getLastNMonths(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (n - 1 - i));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

function buildDateStats(dates: string[], countMap: Record<string, number>): { date: string; count: number }[] {
  return dates.map(date => ({ date, count: countMap[date] || 0 }));
}

function buildMonthStats(months: string[], countMap: Record<string, number>): { month: string; count: number }[] {
  return months.map(month => ({ month, count: countMap[month] || 0 }));
}

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

function countByMonth(records: { createdAt: Date }[]): Record<string, number> {
  const countMap: Record<string, number> = {};
  records.forEach(record => {
    const date = new Date(record.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    countMap[key] = (countMap[key] || 0) + 1;
  });
  return countMap;
}

function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  date.setHours(0, 0, 0, 0);
  return date;
}

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
  // @ts-expect-error Prisma groupBy overload does not match the cap_bac filter
  return prisma.quanNhan.groupBy({ by: ['cap_bac'], where, _count: { id: true } });
}

class DashboardService {
  /**
   * Returns general statistics for SUPER_ADMIN.
   * @returns Statistics data
   */
  async getStatistics() {
    const roleDistribution = await prisma.taiKhoan.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    const dailyActivity = await prisma.systemLog.findMany({
      where: { created_at: { gte: daysAgo(7) } },
      select: { created_at: true },
    });

    const last7Days = buildDateStats(getLastNDays(7), countByDate(dailyActivity));

    const logsByAction = await prisma.systemLog.groupBy({
      by: ['action'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const newAccounts = await prisma.taiKhoan.findMany({
      where: { createdAt: { gte: daysAgo(30) } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const last30Days = buildDateStats(getLastNDays(30), countByDate(newAccounts));

    const [totalAccounts, totalPersonnel, totalUnits, totalLogs] = await Promise.all([
      prisma.taiKhoan.count(),
      prisma.quanNhan.count(),
      prisma.coQuanDonVi.count().then(async coQuan => {
        const donVi = await prisma.donViTrucThuoc.count();
        return coQuan + donVi;
      }),
      prisma.systemLog.count(),
    ]);

    return {
      totalAccounts,
      totalPersonnel,
      totalUnits,
      totalLogs,
      roleDistribution: roleDistribution.map(item => ({ role: item.role, count: item._count.id })),
      dailyActivity: last7Days,
      logsByAction: logsByAction.map(item => ({ action: item.action, count: item._count.id })),
      newAccountsByDate: last30Days,
    };
  }

  /**
   * Returns statistics for ADMIN role.
   * @returns Admin statistics data
   */
  async getAdminStatistics() {
    const scientificAchievementsByType = await prisma.thanhTichKhoaHoc.groupBy({
      by: ['loai'],
      _count: { id: true },
    });

    const proposalsByType = await prisma.bangDeXuat.groupBy({
      by: ['loai_de_xuat'],
      where: { createdAt: { gte: daysAgo(7) } },
      _count: { id: true },
    });

    const proposalsByStatus = await prisma.bangDeXuat.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const scientificAchievements = await prisma.thanhTichKhoaHoc.findMany({
      where: { createdAt: { gte: monthsAgo(6) } },
      select: { createdAt: true },
    });

    const last6Months = buildMonthStats(getLastNMonths(6), countByMonth(scientificAchievements));

    const totalPersonnel = await prisma.quanNhan.count();
    const totalUnits = await prisma.donViTrucThuoc.count();
    const totalPositions = await prisma.chucVu.count();
    const pendingApprovals = await prisma.bangDeXuat.count({
      where: { status: PROPOSAL_STATUS.PENDING },
    });

    return {
      scientificAchievementsByType: scientificAchievementsByType.map(item => ({ type: item.loai, count: item._count.id })),
      proposalsByType: proposalsByType.map(item => ({ type: item.loai_de_xuat, count: item._count.id })),
      proposalsByStatus: proposalsByStatus.map(item => ({ status: item.status, count: item._count.id })),
      scientificAchievementsByMonth: last6Months,
      totalPersonnel,
      totalUnits,
      totalPositions,
      pendingApprovals,
    };
  }

  /**
   * Returns statistics for MANAGER role scoped to their unit.
   * @param userId - Account ID of the manager
   * @param quanNhanId - Personnel ID of the manager
   * @returns Manager statistics data
   */
  async getManagerStatistics(userId: string, quanNhanId: string | undefined) {
    let unitId: string | null = null;

    if (quanNhanId) {
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: quanNhanId },
        select: { don_vi_truc_thuoc_id: true, co_quan_don_vi_id: true },
      });
      unitId = personnel?.co_quan_don_vi_id ?? personnel?.don_vi_truc_thuoc_id ?? null;
    } else {
      const account = await prisma.taiKhoan.findUnique({
        where: { id: userId },
        select: { quan_nhan_id: true },
      });
      if (account?.quan_nhan_id) {
        const personnel = await prisma.quanNhan.findUnique({
          where: { id: account.quan_nhan_id },
          select: { don_vi_truc_thuoc_id: true, co_quan_don_vi_id: true },
        });
        unitId = personnel?.co_quan_don_vi_id ?? personnel?.don_vi_truc_thuoc_id ?? null;
      }
    }

    const empty = {
      awardsByType: [], proposalsByType: [], proposalsByStatus: [],
      awardsByMonth: [], personnelByRank: [], scientificAchievementsByMonth: [],
      scientificAchievementsByType: [], personnelByPosition: [],
    };

    if (!unitId) return empty;

    const managerPersonnel = await prisma.quanNhan.findUnique({
      where: { id: quanNhanId || '' },
      select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
    });

    const isCoQuanDonVi = managerPersonnel?.co_quan_don_vi_id === unitId;

    let personnelInUnit: { id: string }[] = [];
    let donViTrucThuocIdList: string[] = [];

    if (isCoQuanDonVi) {
      const subUnits = await prisma.donViTrucThuoc.findMany({
        where: { co_quan_don_vi_id: unitId },
        select: { id: true },
      });
      donViTrucThuocIdList = subUnits.map(d => d.id);
      personnelInUnit = await prisma.quanNhan.findMany({
        where: { OR: [{ co_quan_don_vi_id: unitId }, { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } }] },
        select: { id: true },
      });
    } else {
      personnelInUnit = await prisma.quanNhan.findMany({
        where: { don_vi_truc_thuoc_id: unitId },
        select: { id: true },
      });
    }

    const personnelIds = personnelInUnit.map(p => p.id);
    const sixMonthsAgoDate = monthsAgo(6);
    const monthKeys = getLastNMonths(6);

    const [annualAwards, recentAwards, personnelByRank, proposalsByStatus, proposalsByType, scientificAchievements, scientificAchievementsByType, personnelWithPositions] =
      await Promise.all([
        personnelIds.length > 0
          ? prisma.danhHieuHangNam.findMany({ where: { quan_nhan_id: { in: personnelIds } }, select: { danh_hieu: true } })
          : [],
        personnelIds.length > 0
          ? prisma.danhHieuHangNam.findMany({ where: { quan_nhan_id: { in: personnelIds }, createdAt: { gte: sixMonthsAgoDate } }, select: { createdAt: true } })
          : [],
        groupQuanNhanByCapBac(
          isCoQuanDonVi
            ? { OR: [{ co_quan_don_vi_id: unitId }, { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } }], cap_bac: { not: null } }
            : { don_vi_truc_thuoc_id: unitId, cap_bac: { not: null } }
        ),
        prisma.bangDeXuat.groupBy({ by: ['status'], where: { nguoi_de_xuat_id: userId }, _count: { id: true } }),
        prisma.bangDeXuat.groupBy({ by: ['loai_de_xuat'], where: { nguoi_de_xuat_id: userId }, _count: { id: true } }),
        personnelIds.length > 0
          ? prisma.thanhTichKhoaHoc.findMany({ where: { quan_nhan_id: { in: personnelIds }, createdAt: { gte: sixMonthsAgoDate } }, select: { createdAt: true } })
          : [],
        personnelIds.length > 0
          ? prisma.thanhTichKhoaHoc.groupBy({ by: ['loai'], where: { quan_nhan_id: { in: personnelIds } }, _count: { id: true } })
          : [],
        isCoQuanDonVi
          ? prisma.quanNhan.findMany({ where: { OR: [{ co_quan_don_vi_id: unitId }, { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } }] }, select: { chuc_vu_id: true } })
          : prisma.quanNhan.findMany({ where: { don_vi_truc_thuoc_id: unitId }, select: { chuc_vu_id: true } }),
      ]);

    const awardsByType: Record<string, number> = {};
    annualAwards.forEach((award: { danh_hieu: string | null }) => {
      if (award.danh_hieu) awardsByType[award.danh_hieu] = (awardsByType[award.danh_hieu] || 0) + 1;
    });

    const positionCounts: Record<string, number> = {};
    personnelWithPositions.forEach(p => {
      if (p.chuc_vu_id) positionCounts[p.chuc_vu_id] = (positionCounts[p.chuc_vu_id] || 0) + 1;
    });

    const positionIds = Object.keys(positionCounts);
    const positions = await prisma.chucVu.findMany({ where: { id: { in: positionIds } }, select: { id: true, ten_chuc_vu: true } });
    const positionMap: Record<string, string> = {};
    positions.forEach(pos => { positionMap[pos.id] = pos.ten_chuc_vu; });

    return {
      awardsByType: Object.entries(awardsByType).map(([type, count]) => ({ type, count })),
      proposalsByType: proposalsByType.map(item => ({ type: item.loai_de_xuat, count: item._count.id })),
      proposalsByStatus: proposalsByStatus.map(item => ({ status: item.status, count: item._count.id })),
      awardsByMonth: buildMonthStats(monthKeys, countByMonth(recentAwards)),
      personnelByRank: personnelByRank.filter(item => item.cap_bac).map(item => ({ rank: item.cap_bac, count: item._count.id })),
      scientificAchievementsByMonth: buildMonthStats(monthKeys, countByMonth(scientificAchievements)),
      scientificAchievementsByType: scientificAchievementsByType.map(item => ({ type: item.loai, count: item._count.id })),
      personnelByPosition: Object.entries(positionCounts).map(([positionId, count]) => ({
        positionId,
        positionName: positionMap[positionId] || 'Chưa xác định',
        count,
      })),
      totalPersonnel: personnelIds.length,
    };
  }
}

export default new DashboardService();
