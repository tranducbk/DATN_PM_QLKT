import { prisma } from '../../models';
import { PROPOSAL_STATUS, type ProposalStatus } from '../../constants/proposalStatus.constants';

export interface DecisionUsageSummary {
  inUse: boolean;
  awardCounts: {
    thanhTichKhoaHoc: number;
    danhHieuHangNamMain: number;
    danhHieuHangNamBkbqp: number;
    danhHieuHangNamCstdtq: number;
    danhHieuHangNamBkttcp: number;
    contributionMedal: number;
    militaryFlag: number;
    commemorativeMedal: number;
    tenureMedal: number;
    adhocAward: number;
    danhHieuDonViHangNamMain: number;
    danhHieuDonViHangNamBkbqp: number;
    danhHieuDonViHangNamBkttcp: number;
  };
  proposalsByStatus: {
    PENDING: string[];
    APPROVED: string[];
    REJECTED: string[];
  };
}

const DANH_HIEU_KEYS = [
  'so_quyet_dinh',
  'so_quyet_dinh_bkbqp',
  'so_quyet_dinh_cstdtq',
  'so_quyet_dinh_bkttcp',
] as const;

const SINGLE_KEY = ['so_quyet_dinh'] as const;

/**
 * Counts every reference to a so_quyet_dinh across 13 award FK columns + JSON proposal payloads.
 * Used by deleteDecision to surface friendly errors before the DB FK constraint kicks in.
 * @param soQuyetDinh - so_quyet_dinh value to look up
 * @returns Per-column counts + list of pending proposal IDs containing the value
 */
export async function findDecisionUsages(
  soQuyetDinh: string
): Promise<DecisionUsageSummary> {
  const filter = { so_quyet_dinh: soQuyetDinh };

  const [
    thanhTichKhoaHoc,
    danhHieuHangNamMain,
    danhHieuHangNamBkbqp,
    danhHieuHangNamCstdtq,
    danhHieuHangNamBkttcp,
    contributionMedal,
    militaryFlag,
    commemorativeMedal,
    tenureMedal,
    adhocAward,
    danhHieuDonViHangNamMain,
    danhHieuDonViHangNamBkbqp,
    danhHieuDonViHangNamBkttcp,
  ] = await Promise.all([
    prisma.thanhTichKhoaHoc.count({ where: filter }),
    prisma.danhHieuHangNam.count({ where: filter }),
    prisma.danhHieuHangNam.count({ where: { so_quyet_dinh_bkbqp: soQuyetDinh } }),
    prisma.danhHieuHangNam.count({ where: { so_quyet_dinh_cstdtq: soQuyetDinh } }),
    prisma.danhHieuHangNam.count({ where: { so_quyet_dinh_bkttcp: soQuyetDinh } }),
    prisma.khenThuongHCBVTQ.count({ where: filter }),
    prisma.huanChuongQuanKyQuyetThang.count({ where: filter }),
    prisma.kyNiemChuongVSNXDQDNDVN.count({ where: filter }),
    prisma.khenThuongHCCSVV.count({ where: filter }),
    prisma.khenThuongDotXuat.count({ where: filter }),
    prisma.danhHieuDonViHangNam.count({ where: filter }),
    prisma.danhHieuDonViHangNam.count({ where: { so_quyet_dinh_bkbqp: soQuyetDinh } }),
    prisma.danhHieuDonViHangNam.count({ where: { so_quyet_dinh_bkttcp: soQuyetDinh } }),
  ]);

  const proposalsByStatus = await findProposalsReferencingByStatus(soQuyetDinh);

  const awardCounts = {
    thanhTichKhoaHoc,
    danhHieuHangNamMain,
    danhHieuHangNamBkbqp,
    danhHieuHangNamCstdtq,
    danhHieuHangNamBkttcp,
    contributionMedal,
    militaryFlag,
    commemorativeMedal,
    tenureMedal,
    adhocAward,
    danhHieuDonViHangNamMain,
    danhHieuDonViHangNamBkbqp,
    danhHieuDonViHangNamBkttcp,
  };
  const totalAwardRefs = Object.values(awardCounts).reduce((acc, n) => acc + n, 0);
  const totalProposalRefs =
    proposalsByStatus.PENDING.length +
    proposalsByStatus.APPROVED.length +
    proposalsByStatus.REJECTED.length;

  return {
    inUse: totalAwardRefs > 0 || totalProposalRefs > 0,
    awardCounts,
    proposalsByStatus,
  };
}

async function findProposalsReferencingByStatus(
  soQuyetDinh: string
): Promise<DecisionUsageSummary['proposalsByStatus']> {
  const allProposals = await prisma.bangDeXuat.findMany({
    select: {
      id: true,
      status: true,
      data_danh_hieu: true,
      data_thanh_tich: true,
      data_nien_han: true,
      data_cong_hien: true,
    },
  });

  const buckets: DecisionUsageSummary['proposalsByStatus'] = {
    PENDING: [],
    APPROVED: [],
    REJECTED: [],
  };

  for (const row of allProposals) {
    const referenced =
      jsonContainsSqd(row.data_danh_hieu, DANH_HIEU_KEYS, soQuyetDinh) ||
      jsonContainsSqd(row.data_thanh_tich, SINGLE_KEY, soQuyetDinh) ||
      jsonContainsSqd(row.data_nien_han, SINGLE_KEY, soQuyetDinh) ||
      jsonContainsSqd(row.data_cong_hien, SINGLE_KEY, soQuyetDinh);
    if (!referenced) continue;
    const status = row.status as ProposalStatus;
    if (status === PROPOSAL_STATUS.PENDING) buckets.PENDING.push(row.id);
    else if (status === PROPOSAL_STATUS.APPROVED) buckets.APPROVED.push(row.id);
    else if (status === PROPOSAL_STATUS.REJECTED) buckets.REJECTED.push(row.id);
  }

  return buckets;
}

function jsonContainsSqd(
  raw: unknown,
  keys: readonly string[],
  soQuyetDinh: string
): boolean {
  if (!Array.isArray(raw)) return false;
  for (const item of raw as Array<Record<string, unknown>>) {
    if (!item || typeof item !== 'object') continue;
    for (const key of keys) {
      if (item[key] === soQuyetDinh) return true;
    }
  }
  return false;
}

/**
 * Builds a Vietnamese-friendly summary of where a decision is referenced,
 * suitable for surfacing in a ValidationError message to admins.
 * @param soQuyetDinh - so_quyet_dinh value
 * @param usage - Result of findDecisionUsages
 * @returns Multiline message listing affected tables + proposal IDs
 */
export function formatUsageError(
  soQuyetDinh: string,
  usage: DecisionUsageSummary
): string {
  const lines: string[] = [
    `Không thể xóa quyết định "${soQuyetDinh}" vì đang được sử dụng:`,
  ];
  const labels: Array<[number, string]> = [
    [usage.awardCounts.thanhTichKhoaHoc, 'Thành tích khoa học'],
    [usage.awardCounts.danhHieuHangNamMain, 'Danh hiệu hằng năm cá nhân'],
    [usage.awardCounts.danhHieuHangNamBkbqp, 'BKBQP cá nhân'],
    [usage.awardCounts.danhHieuHangNamCstdtq, 'CSTDTQ cá nhân'],
    [usage.awardCounts.danhHieuHangNamBkttcp, 'BKTTCP cá nhân'],
    [usage.awardCounts.contributionMedal, 'Huân chương Bảo vệ Tổ quốc'],
    [usage.awardCounts.militaryFlag, 'Huy chương Quân kỳ quyết thắng'],
    [usage.awardCounts.commemorativeMedal, 'Kỷ niệm chương'],
    [usage.awardCounts.tenureMedal, 'Huy chương Chiến sĩ vẻ vang'],
    [usage.awardCounts.adhocAward, 'Khen thưởng đột xuất'],
    [usage.awardCounts.danhHieuDonViHangNamMain, 'Danh hiệu hằng năm đơn vị'],
    [usage.awardCounts.danhHieuDonViHangNamBkbqp, 'BKBQP đơn vị'],
    [usage.awardCounts.danhHieuDonViHangNamBkttcp, 'BKTTCP đơn vị'],
  ];
  for (const [count, label] of labels) {
    if (count > 0) lines.push(`- ${label}: ${count} bản ghi`);
  }
  const pendingCount = usage.proposalsByStatus.PENDING.length;
  const approvedCount = usage.proposalsByStatus.APPROVED.length;
  const rejectedCount = usage.proposalsByStatus.REJECTED.length;
  if (pendingCount > 0) {
    lines.push(`- Đề xuất đang chờ duyệt: ${pendingCount}`);
  }
  if (approvedCount > 0) {
    lines.push(`- Đề xuất đã duyệt (lịch sử): ${approvedCount}`);
  }
  if (rejectedCount > 0) {
    lines.push(`- Đề xuất bị từ chối (lịch sử): ${rejectedCount}`);
  }
  return lines.join('\n');
}
