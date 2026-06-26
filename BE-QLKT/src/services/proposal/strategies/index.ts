import { PROPOSAL_TYPES, type ProposalType } from '../../../constants/proposalTypes.constants';
import type { ProposalStrategy } from './proposalStrategy';
// Mỗi import dưới đây là 1 concrete Strategy (1 loại đề xuất) — gom vào REGISTRY bên dưới.
import { nckhStrategy } from './nckhStrategy';
import { hcqkqtStrategy } from './hcqkqtStrategy';
import { kncStrategy } from './kncStrategy';
import { hccsvvStrategy } from './hccsvvStrategy';
import { donViHangNamStrategy } from './donViHangNamStrategy';
import { caNhanHangNamStrategy } from './caNhanHangNamStrategy';
import { hcbvtqStrategy } from './hcbvtqStrategy';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  REGISTRY — bảng tra cứu ProposalType → Strategy instance            ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Đây là TRUNG TÂM DISPATCH duy nhất. Khi cần thêm loại đề xuất mới: ║
 * ║    1. Tạo file `<type>Strategy.ts` implement ProposalStrategy       ║
 * ║    2. Add entry tại đây (key = ProposalType)                         ║
 * ║    3. KHÔNG cần sửa approve.ts / submit.ts (dispatcher đã generic)  ║
 * ║                                                                      ║
 * ║  Pattern này = Strategy + Registry + Singleton (mỗi strategy export ║
 * ║  1 instance cố định, không tạo mới mỗi lần gọi → lightweight).      ║
 * ║                                                                      ║
 * ║  DOT_XUAT = null vì khen thưởng đột xuất KHÔNG đi qua quy trình     ║
 * ║  duyệt (Admin tạo trực tiếp qua `adhocAward.service`, ghi thẳng vào║
 * ║  bảng KhenThuongDotXuat — không có giai đoạn PENDING).              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
const REGISTRY: Record<ProposalType, ProposalStrategy | null> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: caNhanHangNamStrategy,
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: donViHangNamStrategy,
  [PROPOSAL_TYPES.NIEN_HAN]: hccsvvStrategy,       // Huân chương chiến sĩ vẻ vang
  [PROPOSAL_TYPES.HC_QKQT]: hcqkqtStrategy,        // Huân chương Quân kỳ Quyết thắng
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: kncStrategy,  // Kỷ niệm chương VSNXD QĐNDVN
  [PROPOSAL_TYPES.CONG_HIEN]: hcbvtqStrategy,      // Huân chương Bảo vệ Tổ quốc
  [PROPOSAL_TYPES.NCKH]: nckhStrategy,             // Nghiên cứu khoa học
  [PROPOSAL_TYPES.DOT_XUAT]: null,                 // Không qua approval flow
};

/**
 * Returns the strategy for a proposal type, or null if not yet migrated.
 * @param type - PROPOSAL_TYPES value
 * @returns Strategy instance or null
 */
export function getProposalStrategy(type: ProposalType): ProposalStrategy | null {
  // Dispatch trung tâm: caller gọi getProposalStrategy(type)?.method(...) thay vì if/else theo loại.
  return REGISTRY[type] ?? null;
}

export type { ProposalStrategy } from './proposalStrategy';
