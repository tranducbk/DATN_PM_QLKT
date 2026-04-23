import profileService from '../services/profile.service';
import { writeSystemLog } from './systemLogHelper';

/**
 * Recalculates the annual profile for a personnel, swallowing errors to avoid
 * interrupting the main business flow. Errors are logged to system_logs.
 * @param personnelId - The personnel ID to recalculate
 * @param resource - The resource name for the system log entry
 */
export async function safeRecalculateAnnualProfile(
  personnelId: string,
  resource = 'annual-rewards'
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
