import { PROPOSAL_STATUS, type ProposalStatus } from '../../constants/proposalStatus.constants';
import { adhocAwardRepository } from '../../repositories/adhocAward.repository';
import { commemorativeMedalRepository } from '../../repositories/commemorativeMedal.repository';
import { contributionMedalRepository } from '../../repositories/contributionMedal.repository';
import {
  danhHieuDonViHangNamRepository,
  danhHieuHangNamRepository,
} from '../../repositories/danhHieu.repository';
import { militaryFlagRepository } from '../../repositories/militaryFlag.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import { scientificAchievementRepository } from '../../repositories/scientificAchievement.repository';
import { tenureMedalRepository } from '../../repositories/tenureMedal.repository';
import { AWARD_LABELS } from '../../constants/awardLabels.constants';
import { AWARD_SLUGS } from '../../constants/awardSlugs.constants';

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
 * Đếm mọi tham chiếu tới một số quyết định trên 13 cột FK của các bảng khen
 * thưởng cộng với payload JSON của đề xuất.
 *
 * WHY: deleteDecision gọi hàm này TRƯỚC khi xóa để hiện cảnh báo thân thiện
 * cho admin, thay vì để DB ném lỗi ràng buộc khóa ngoại khó hiểu. Quyết định
 * đã bị nhiều bản ghi khen thưởng tham chiếu thì không được xóa.
 *
 * @param soQuyetDinh - Số quyết định cần tra cứu
 * @returns Số bản ghi theo từng cột + danh sách ID đề xuất chứa số quyết định
 */
export async function findDecisionUsages(soQuyetDinh: string): Promise<DecisionUsageSummary> {
  const filter = { so_quyet_dinh: soQuyetDinh };

  // Quét song song 13 cột FK trên nhiều bảng khen thưởng khác nhau: vì mỗi loại
  // khen thưởng lưu số quyết định ở bảng/cột riêng, phải đếm tất cả mới biết
  // quyết định còn được dùng ở đâu. Promise.all để tránh chờ tuần tự 13 query.
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
    scientificAchievementRepository.count(filter),
    // Danh hiệu cá nhân hằng năm lưu tới 4 số quyết định khác nhau trên cùng
    // một bản ghi (cột chính + BKBQP/CSTDTQ/BKTTCP của chuỗi danh hiệu), nên
    // phải đếm riêng từng cột để biết quyết định đang được loại nào tham chiếu.
    danhHieuHangNamRepository.count({ where: filter }),
    danhHieuHangNamRepository.count({ where: { so_quyet_dinh_bkbqp: soQuyetDinh } }),
    danhHieuHangNamRepository.count({ where: { so_quyet_dinh_cstdtq: soQuyetDinh } }),
    danhHieuHangNamRepository.count({ where: { so_quyet_dinh_bkttcp: soQuyetDinh } }),
    contributionMedalRepository.count(filter),
    militaryFlagRepository.count(filter),
    commemorativeMedalRepository.count(filter),
    tenureMedalRepository.count(filter),
    adhocAwardRepository.count(filter),
    // Danh hiệu đơn vị hằng năm chỉ có chuỗi BKBQP/BKTTCP (không có CSTDTQ),
    // nên chỉ đếm 3 cột thay vì 4 như danh hiệu cá nhân.
    danhHieuDonViHangNamRepository.count({ where: filter }),
    danhHieuDonViHangNamRepository.count({ where: { so_quyet_dinh_bkbqp: soQuyetDinh } }),
    danhHieuDonViHangNamRepository.count({ where: { so_quyet_dinh_bkttcp: soQuyetDinh } }),
  ]);

  // Ngoài bản ghi khen thưởng đã trao, số quyết định còn có thể nằm trong
  // payload JSON của đề xuất chưa hoàn tất → phải quét thêm để cảnh báo đầy đủ.
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
  // Gộp tổng tham chiếu từ cả 2 nguồn (bản ghi khen thưởng + đề xuất) để cờ
  // inUse chặn xóa khi quyết định còn bị bất kỳ chỗ nào dùng tới.
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

/**
 * Quét toàn bộ đề xuất và gom ID những đề xuất có payload JSON chứa số quyết
 * định, phân nhóm theo trạng thái duyệt.
 *
 * WHY: số quyết định trong đề xuất nằm rải trong cột JSON (mảng object) chứ
 * không phải cột phẳng có index, nên không lọc được bằng query DB thông thường.
 * Phải nạp tất cả rồi quét trong bộ nhớ. Chỉ select 5 cột cần thiết để giảm tải.
 *
 * @param soQuyetDinh - Số quyết định cần tra cứu trong payload đề xuất
 * @returns 3 nhóm danh sách ID đề xuất theo trạng thái PENDING/APPROVED/REJECTED
 */
async function findProposalsReferencingByStatus(
  soQuyetDinh: string
): Promise<DecisionUsageSummary['proposalsByStatus']> {
  const allProposals = await proposalRepository.findManyRaw({
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
    // Mỗi loại payload có cấu trúc khóa khác nhau: data_danh_hieu chứa cả 4
    // số quyết định của chuỗi danh hiệu (DANH_HIEU_KEYS), còn các payload khác
    // chỉ có 1 số quyết định (SINGLE_KEY). Dừng ngay khi tìm thấy ở bất kỳ cột.
    const referenced =
      jsonContainsSqd(row.data_danh_hieu, DANH_HIEU_KEYS, soQuyetDinh) ||
      jsonContainsSqd(row.data_thanh_tich, SINGLE_KEY, soQuyetDinh) ||
      jsonContainsSqd(row.data_nien_han, SINGLE_KEY, soQuyetDinh) ||
      jsonContainsSqd(row.data_cong_hien, SINGLE_KEY, soQuyetDinh);
    if (!referenced) continue;
    // Phân nhóm theo trạng thái để thông báo lỗi phân biệt được đề xuất đang
    // chờ duyệt (chặn xóa) với đề xuất đã duyệt/từ chối (chỉ là lịch sử).
    const status = row.status as ProposalStatus;
    if (status === PROPOSAL_STATUS.PENDING) buckets.PENDING.push(row.id);
    else if (status === PROPOSAL_STATUS.APPROVED) buckets.APPROVED.push(row.id);
    else if (status === PROPOSAL_STATUS.REJECTED) buckets.REJECTED.push(row.id);
  }

  return buckets;
}

// Kiểm tra payload JSON (kỳ vọng là mảng object) có item nào mang đúng số
// quyết định ở một trong các khóa cần xét hay không. Phòng thủ kiểu dữ liệu
// vì cột JSON có thể chứa giá trị không như mong đợi (null, object lẻ).
function jsonContainsSqd(raw: unknown, keys: readonly string[], soQuyetDinh: string): boolean {
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
 * Dựng thông báo tiếng Việt tóm tắt những nơi đang tham chiếu tới quyết định,
 * dùng làm nội dung ValidationError hiển thị cho admin khi xóa bị chặn.
 *
 * WHY: thay vì chỉ báo "không xóa được", liệt kê cụ thể loại khen thưởng và số
 * lượng bản ghi để admin biết phải xử lý gì trước. Dùng nhãn thân thiện từ
 * AWARD_LABELS, không lộ ID kỹ thuật.
 *
 * @param soQuyetDinh - Số quyết định bị chặn xóa
 * @param usage - Kết quả trả về từ findDecisionUsages
 * @returns Chuỗi nhiều dòng liệt kê các bảng bị ảnh hưởng và số đề xuất liên quan
 */
export function formatUsageError(soQuyetDinh: string, usage: DecisionUsageSummary): string {
  const lines: string[] = [`Không thể xóa quyết định "${soQuyetDinh}" vì đang được sử dụng:`];
  // Ghép từng số đếm với nhãn hiển thị tương ứng; các chuỗi danh hiệu con
  // (BKBQP/CSTDTQ/BKTTCP) dùng nhãn viết tắt cố định vì không có trong AWARD_LABELS.
  const labels: Array<[number, string]> = [
    [usage.awardCounts.thanhTichKhoaHoc, AWARD_LABELS[AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS]],
    [usage.awardCounts.danhHieuHangNamMain, `${AWARD_LABELS[AWARD_SLUGS.ANNUAL_REWARDS]} cá nhân`],
    [usage.awardCounts.danhHieuHangNamBkbqp, 'BKBQP cá nhân'],
    [usage.awardCounts.danhHieuHangNamCstdtq, 'CSTDTQ cá nhân'],
    [usage.awardCounts.danhHieuHangNamBkttcp, 'BKTTCP cá nhân'],
    [usage.awardCounts.contributionMedal, AWARD_LABELS[AWARD_SLUGS.CONTRIBUTION_MEDALS]],
    [usage.awardCounts.militaryFlag, AWARD_LABELS[AWARD_SLUGS.MILITARY_FLAG]],
    [usage.awardCounts.commemorativeMedal, AWARD_LABELS[AWARD_SLUGS.COMMEMORATIVE_MEDALS]],
    [usage.awardCounts.tenureMedal, AWARD_LABELS[AWARD_SLUGS.TENURE_MEDALS]],
    [usage.awardCounts.adhocAward, AWARD_LABELS[AWARD_SLUGS.ADHOC_AWARDS]],
    [usage.awardCounts.danhHieuDonViHangNamMain, AWARD_LABELS[AWARD_SLUGS.UNIT_ANNUAL_AWARDS]],
    [usage.awardCounts.danhHieuDonViHangNamBkbqp, 'BKBQP đơn vị'],
    [usage.awardCounts.danhHieuDonViHangNamBkttcp, 'BKTTCP đơn vị'],
  ];
  // Chỉ thêm dòng cho loại thực sự có tham chiếu (count > 0) để thông báo gọn,
  // không liệt kê các bảng không liên quan.
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
