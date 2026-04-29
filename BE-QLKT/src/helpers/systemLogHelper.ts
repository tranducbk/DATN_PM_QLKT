import { systemLogRepository } from '../repositories/systemLog.repository';

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
    const actorId = userId && userId !== 'SYSTEM' ? userId : null;
    await systemLogRepository.create({
      nguoi_thuc_hien_id: actorId,
      actor_role: userRole || 'SYSTEM',
      action,
      resource,
      tai_nguyen_id: resourceId,
      description: description.substring(0, 500),
      payload: payload ? JSON.stringify(payload) : undefined,
    });
  } catch (e) {
    console.error('writeSystemLog failed:', e);
  }
}

export { writeSystemLog };
