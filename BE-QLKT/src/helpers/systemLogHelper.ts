import { systemLogRepository } from '../repositories/systemLog.repository';
import { SYSTEM_ACTOR } from '../constants/roles.constants';

/** Max stored length of a log description — column is capped, both write paths share this. */
export const MAX_LOG_DESCRIPTION_LENGTH = 500;

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  SYSTEM LOG HELPER — writeSystemLog (audit trail entry point)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  WRAPPER quanh systemLogRepository.create để:
 *  - Default field defaults (userRole, action).
 *  - Sanitize payload (loại bỏ field nhạy cảm trước khi serialize).
 *  - Catch lỗi silent — log fail KHÔNG được throw làm crash app.
 *
 *  USAGE PATTERN — FIRE-AND-FORGET:
 *      void writeSystemLog({ userId, action: 'CREATE', resource: 'x', ... });
 *  Dùng `void` để TypeScript không warn về promise floating, nhưng vẫn
 *  KHÔNG await → không block.
 *
 *  ALWAYS LOG (operations ghi DB):
 *  - CREATE, UPDATE, DELETE, APPROVE, REJECT, IMPORT, EXPORT, BACKUP.
 *
 *  KHÔNG LOG (read-only):
 *  - GET requests → quá nhiều, tốn dung lượng, không có giá trị audit.
 *
 *  AUDIT MIDDLEWARE TỰ GỌI:
 *  Middleware `auditLog` đã tự call writeSystemLog sau response success.
 *  Service chỉ gọi trực tiếp khi:
 *  - Catch lỗi cần log (action='ERROR').
 *  - Fire-and-forget log từ background job.
 * ════════════════════════════════════════════════════════════════════════════
 */

interface WriteSystemLogParams {
  userId?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  description: string;
  payload?: Record<string, unknown> | null;
}

/**
 * Writes a system log entry without interrupting main business flow.
 * @param params - System log payload
 * @returns Promise resolved after best-effort write
 */
async function writeSystemLog({
  userId,
  userRole,
  action,
  resource,
  resourceId = null,
  description,
  payload = null,
}: WriteSystemLogParams): Promise<void> {
  try {
    // Use null actor ID for system-level logs without a foreign key.
    const actorId = userId && userId !== SYSTEM_ACTOR ? userId : null;
    await systemLogRepository.create({
      nguoi_thuc_hien_id: actorId,
      actor_role: userRole || SYSTEM_ACTOR,
      action,
      resource,
      tai_nguyen_id: resourceId,
      description: description.substring(0, MAX_LOG_DESCRIPTION_LENGTH),
      payload: payload ? JSON.stringify(payload) : undefined,
    });
  } catch (e) {
    console.error('writeSystemLog failed:', e);
  }
}

export { writeSystemLog };
