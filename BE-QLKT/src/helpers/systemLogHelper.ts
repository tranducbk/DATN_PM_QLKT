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
    await prisma.systemLog.create({
      data: {
        nguoi_thuc_hien_id: userId || 'SYSTEM',
        actor_role: userRole || 'SYSTEM',
        action,
        resource,
        tai_nguyen_id: resourceId,
        description: description.substring(0, 500),
        payload: payload ? JSON.stringify(payload) : undefined,
      },
    });
  } catch {
    // Khong throw - log loi khong duoc anh huong nghiep vu
  }
}

export { writeSystemLog };
