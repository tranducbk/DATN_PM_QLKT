import { prisma } from '../models';

interface WriteSystemLogParams {
  userId?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  description: string;
  payload?: Record<string, unknown> | null;
}

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
    // userId 'SYSTEM' hoặc undefined thì set null (không có FK)
    const actorId = userId && userId !== 'SYSTEM' ? userId : null;
    await prisma.systemLog.create({
      data: {
        nguoi_thuc_hien_id: actorId,
        actor_role: userRole || 'SYSTEM',
        action,
        resource,
        tai_nguyen_id: resourceId,
        description: description.substring(0, 500),
        payload: payload ? JSON.stringify(payload) : undefined,
      },
    });
  } catch {
    // Không throw để không ảnh hưởng nghiệp vụ
  }
}

export { writeSystemLog };
