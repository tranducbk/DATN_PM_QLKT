import type { Prisma } from '../generated/prisma';
import { danhHieuHangNamRepository } from '../repositories/danhHieu.repository';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../repositories/unit.repository';
import { positionRepository } from '../repositories/position.repository';
import { accountRepository } from '../repositories/account.repository';
import { systemLogRepository } from '../repositories/systemLog.repository';
import { scientificAchievementRepository } from '../repositories/scientificAchievement.repository';
import { proposalRepository } from '../repositories/proposal.repository';
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

function buildStats(keys: string[], countMap: Record<string, number>, label: string) {
  return keys.map(key => ({ [label]: key, count: countMap[key] || 0 }));
}

function countRecords<T>(records: T[], toKey: (record: T) => string | null | undefined): Record<string, number> {
  const countMap: Record<string, number> = {};
  for (const record of records) {
    const key = toKey(record);
    if (key) countMap[key] = (countMap[key] || 0) + 1;
  }
  return countMap;
}

function countByDate(records: { createdAt?: Date }[]): Record<string, number> {
  return countRecords(records, r =>
    r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : null
  );
}

function countByMonth(records: { createdAt: Date }[]): Record<string, number> {
  return countRecords(records, r => {
    const d = new Date(r.createdAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
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

type ManagerPersonnel = { don_vi_truc_thuoc_id: string | null; co_quan_don_vi_id: string | null };

class DashboardService {
  /**
   * Returns general statistics for SUPER_ADMIN.
   * @returns Statistics data
   */
  async getStatistics() {
    const [
      roleDistribution,
      dailyActivity,
      logsByAction,
      newAccounts,
      totalAccounts,
      totalPersonnel,
      coQuanCount,
      donViCount,
      totalLogs,
    ] = await Promise.all([
      accountRepository.groupByRole(),
      systemLogRepository.findManyRaw({ where: { createdAt: { gte: daysAgo(7) } }, select: { createdAt: true } }),
      systemLogRepository.groupByActionTop(10),
      accountRepository.findManyRaw({ where: { createdAt: { gte: daysAgo(30) } }, select: { createdAt: true }, orderBy: { createdAt: 'asc' } }),
      accountRepository.count({}),
      quanNhanRepository.count({}),
      coQuanDonViRepository.count(),
      donViTrucThuocRepository.count(),
      systemLogRepository.count({}),
    ]);

    return {
      totalAccounts,
      totalPersonnel,
      totalUnits: coQuanCount + donViCount,
      totalLogs,
      roleDistribution: roleDistribution.map(item => ({ role: item.role, count: item._count.id })),
      dailyActivity: buildStats(getLastNDays(7), countByDate(dailyActivity), 'date'),
      logsByAction: logsByAction.map(item => ({ action: item.action, count: item._count.id })),
      newAccountsByDate: buildStats(getLastNDays(30), countByDate(newAccounts), 'date'),
    };
  }

  /**
   * Returns statistics for ADMIN role.
   * @returns Admin statistics data
   */
  async getAdminStatistics() {
    const [
      scientificAchievementsByType,
      proposalsByType,
      proposalsByStatus,
      scientificAchievements,
      totalPersonnel,
      totalUnits,
      totalPositions,
      pendingApprovals,
    ] = await Promise.all([
      scientificAchievementRepository.groupByLoai(),
      proposalRepository.groupByLoaiDeXuat({ createdAt: { gte: daysAgo(7) } }),
      proposalRepository.groupByStatus(),
      scientificAchievementRepository.findManyRaw({ where: { createdAt: { gte: monthsAgo(6) } }, select: { createdAt: true } }),
      quanNhanRepository.count({}),
      donViTrucThuocRepository.count(),
      positionRepository.count({}),
      proposalRepository.count({ status: PROPOSAL_STATUS.PENDING }),
    ]);

    return {
      scientificAchievementsByType: scientificAchievementsByType.map(item => ({ type: item.loai, count: item._count.id })),
      proposalsByType: proposalsByType.map(item => ({ type: item.loai_de_xuat, count: item._count.id })),
      proposalsByStatus: proposalsByStatus.map(item => ({ status: item.status, count: item._count.id })),
      scientificAchievementsByMonth: buildStats(getLastNMonths(6), countByMonth(scientificAchievements), 'month'),
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
    let managerPersonnel: ManagerPersonnel | null = null;

    if (quanNhanId) {
      managerPersonnel = await quanNhanRepository.findUnitScope(quanNhanId);
    } else {
      const account = await accountRepository.findUniqueRaw({
        where: { id: userId },
        select: { quan_nhan_id: true },
      });
      if (account?.quan_nhan_id) {
        managerPersonnel = await quanNhanRepository.findUnitScope(account.quan_nhan_id);
      }
    }

    const empty = {
      awardsByType: [], proposalsByType: [], proposalsByStatus: [],
      awardsByMonth: [], personnelByRank: [], scientificAchievementsByMonth: [],
      scientificAchievementsByType: [], personnelByPosition: [],
    };

    // DVTT takes priority — CQDV may be the parent unit (avoid double-counting)
    const unitId = managerPersonnel?.don_vi_truc_thuoc_id ?? managerPersonnel?.co_quan_don_vi_id ?? null;
    if (!unitId) return empty;

    const isCoQuanDonVi = !managerPersonnel?.don_vi_truc_thuoc_id && !!managerPersonnel?.co_quan_don_vi_id;

    let personnelInUnit: { id: string }[] = [];
    let donViTrucThuocIdList: string[] = [];

    if (isCoQuanDonVi) {
      const subUnits = await donViTrucThuocRepository.findIdsByCoQuanDonViId(unitId);
      donViTrucThuocIdList = subUnits.map(d => d.id);
      personnelInUnit = await quanNhanRepository.findManyRaw({
        where: { OR: [{ co_quan_don_vi_id: unitId }, { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } }] },
        select: { id: true },
      });
    } else {
      personnelInUnit = await quanNhanRepository.findManyRaw({
        where: { don_vi_truc_thuoc_id: unitId },
        select: { id: true },
      });
    }

    const personnelIds = personnelInUnit.map(p => p.id);
    const sixMonthsAgoDate = monthsAgo(6);
    const monthKeys = getLastNMonths(6);

    const unitFilter: Prisma.QuanNhanWhereInput = isCoQuanDonVi
      ? { OR: [{ co_quan_don_vi_id: unitId }, { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } }] }
      : { don_vi_truc_thuoc_id: unitId };

    const [annualAwards, recentAwards, personnelByRank, proposalsByStatus, proposalsByType, scientificAchievements, scientificAchievementsByType, personnelWithPositions] =
      await Promise.all([
        personnelIds.length > 0
          ? danhHieuHangNamRepository.findMany({ where: { quan_nhan_id: { in: personnelIds } }, select: { danh_hieu: true } })
          : [],
        personnelIds.length > 0
          ? danhHieuHangNamRepository.findMany({ where: { quan_nhan_id: { in: personnelIds }, createdAt: { gte: sixMonthsAgoDate } }, select: { createdAt: true } })
          : [],
        quanNhanRepository.groupByCapBac({ ...unitFilter, cap_bac: { not: null } }),
        proposalRepository.groupByStatus({ nguoi_de_xuat_id: userId }),
        proposalRepository.groupByLoaiDeXuat({ nguoi_de_xuat_id: userId }),
        personnelIds.length > 0
          ? scientificAchievementRepository.findManyRaw({ where: { quan_nhan_id: { in: personnelIds }, createdAt: { gte: sixMonthsAgoDate } }, select: { createdAt: true } })
          : [],
        personnelIds.length > 0
          ? scientificAchievementRepository.groupByLoai({ quan_nhan_id: { in: personnelIds } })
          : [],
        quanNhanRepository.findManyRaw({ where: unitFilter, select: { chuc_vu_id: true } }),
      ]);

    const awardsByType: Record<string, number> = {};
    annualAwards.forEach(award => {
      if (award.danh_hieu) awardsByType[award.danh_hieu] = (awardsByType[award.danh_hieu] || 0) + 1;
    });

    const positionCounts: Record<string, number> = {};
    personnelWithPositions.forEach(p => {
      if (p.chuc_vu_id) positionCounts[p.chuc_vu_id] = (positionCounts[p.chuc_vu_id] || 0) + 1;
    });

    const positionIds = Object.keys(positionCounts);
    const positions = await positionRepository.findManyRaw({ where: { id: { in: positionIds } }, select: { id: true, ten_chuc_vu: true } });
    const positionMap: Record<string, string> = {};
    positions.forEach(pos => { positionMap[pos.id] = pos.ten_chuc_vu; });

    return {
      awardsByType: Object.entries(awardsByType).map(([type, count]) => ({ type, count })),
      proposalsByType: proposalsByType.map(item => ({ type: item.loai_de_xuat, count: item._count.id })),
      proposalsByStatus: proposalsByStatus.map(item => ({ status: item.status, count: item._count.id })),
      awardsByMonth: buildStats(monthKeys, countByMonth(recentAwards), 'month'),
      personnelByRank: personnelByRank.filter(item => item.cap_bac).map(item => ({ rank: item.cap_bac, count: item._count.id })),
      scientificAchievementsByMonth: buildStats(monthKeys, countByMonth(scientificAchievements), 'month'),
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
