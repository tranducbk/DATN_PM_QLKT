import profileService from '../services/profile.service';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { writeSystemLog } from './systemLogHelper';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  PROFILE RECALC HELPER — fire-and-forget recalc với log lỗi
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  TẠI SAO CẦN SAFE WRAPPER?
 *  Profile recalc là HẬU NGHIỆP VỤ — chạy SAU khi insert/update award.
 *  Recalc fail KHÔNG được rollback hành động chính (insert award), vì:
 *    - User đã ghi data thành công, không công bằng nếu rollback chỉ vì
 *      profile recalc fail.
 *    - Profile có thể recalc lại sau qua cron job hoặc DevZone.
 *    - Recalc là phụ trợ (build gợi ý hiển thị), không phải nguồn truth.
 *
 *  PATTERN:
 *      // Trong service business:
 *      await prisma.danhHieuHangNam.create(...);  // ← chính, throw được
 *      await safeRecalculateAnnualProfile(qnId);  // ← phụ, không throw
 *
 *  ERROR HANDLING:
 *  - Catch silent → KHÔNG re-throw.
 *  - Log vào system_logs với action='ERROR', resource='annual-rewards'
 *    để SUPER_ADMIN review sau (DevZone có UI lọc theo action=ERROR).
 *  - Fire-and-forget writeSystemLog với `void` để không await log (log
 *    fail càng không được block).
 *
 *  ALTERNATIVE đã loại trừ:
 *  - Queue job (BullMQ/Redis): overkill cho scale hiện tại, thêm
 *    dependency, deploy phức tạp.
 *  - Cron retry: đã có DevZone /dev-zone/recalculate-all để super-admin
 *    trigger manual khi cần.
 *
 *  KHI NÀO KHÔNG dùng helper này (tức là throw bình thường):
 *  - Recalc trong DevZone (admin gọi trực tiếp, muốn biết kết quả).
 *  - Recalc trong test fixture (muốn assert đúng kết quả).
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Recalculates the annual profile for a personnel, swallowing errors to avoid
 * interrupting the main business flow. Errors are logged to system_logs.
 * @param personnelId - The personnel ID to recalculate
 * @param resource - The resource name for the system log entry
 */
export async function safeRecalculateAnnualProfile(
  personnelId: string,
  resource: string = AWARD_SLUGS.ANNUAL_REWARDS
): Promise<void> {
  try {
    await profileService.recalculateAnnualProfile(personnelId);
  } catch (e) {
    void writeSystemLog({
      action: 'ERROR',
      resource,
      description: `Lỗi tính lại hồ sơ hằng năm: ${e}`,
    });
  }
}
