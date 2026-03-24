import { Request, Response, NextFunction } from 'express';
import { prisma } from '../models';
import type { AuditLogOptions } from '../types/api';

const SENSITIVE_FIELDS: string[] = [
  'password',
  'password_hash',
  'refreshToken',
  'cccd',
  'oldPassword',
  'newPassword',
  'confirmPassword',
];

const redactSensitiveFields = (obj: unknown): unknown => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitiveFields);

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveFields(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
};

const auditLog = (options: AuditLogOptions = { action: '', resource: '' }) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.send;
    let responseData: unknown = null;

    res.send = function (this: Response, data: unknown) {
      responseData = data;
      return originalSend.call(this, data);
    } as Response['send'];

    try {
      await next();
    } catch (error) {
      throw error;
    } finally {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const user = req.user;
          if (!user) return;

          const {
            action,
            resource,
            getResourceId = () => null,
            getDescription = () => `${action} ${resource}`,
            getPayload = () => null,
          } = options;

          const resourceId = getResourceId(req, res, responseData);
          const descriptionPromise = getDescription(req, res, responseData);
          const description =
            descriptionPromise instanceof Promise ? await descriptionPromise : descriptionPromise;
          const rawPayload = getPayload(req, res, responseData);
          const payload = redactSensitiveFields(rawPayload);

          const ipAddress = req.ip || req.socket.remoteAddress;
          const userAgent = req.get('User-Agent');

          await prisma.systemLog.create({
            data: {
              nguoi_thuc_hien_id: user.id,
              actor_role: user.role,
              action,
              resource,
              tai_nguyen_id: resourceId ?? undefined,
              description,
              payload: payload ? JSON.stringify(payload) : undefined,
              ip_address: ipAddress,
              user_agent: userAgent,
            },
          });
        } catch (_logError) {
          // Không throw error để không ảnh hưởng đến response chính
        }
      }
    }
  };
};

interface DescriptionHelpers {
  create: (resource: string, data: Record<string, string | undefined>) => string;
  update: (resource: string, data: Record<string, string | undefined>) => string;
  delete: (resource: string, data: Record<string, string | undefined>) => string;
  login: (data?: unknown) => string;
  logout: (data?: unknown) => string;
  resetPassword: (data?: Record<string, string | undefined>) => string;
}

const createDescription: DescriptionHelpers = {
  create: (resource, data) =>
    `Tạo mới ${resource}: ${
      data?.username ||
      data?.ho_ten ||
      data?.ten_don_vi ||
      data?.ten_chuc_vu ||
      data?.ten_nhom_cong_hien ||
      'N/A'
    }`,
  update: (resource, data) =>
    `Cập nhật ${resource}: ${
      data?.username ||
      data?.ho_ten ||
      data?.ten_don_vi ||
      data?.ten_chuc_vu ||
      data?.ten_nhom_cong_hien ||
      'N/A'
    }`,
  delete: (resource, data) =>
    `Xóa ${resource}: ${
      data?.username ||
      data?.ho_ten ||
      data?.ten_don_vi ||
      data?.ten_chuc_vu ||
      data?.ten_nhom_cong_hien ||
      'N/A'
    }`,
  login: () => `Đăng nhập hệ thống`,
  logout: () => `Đăng xuất khỏi hệ thống`,
  resetPassword: data => `Đặt lại mật khẩu cho tài khoản: ${data?.username || 'N/A'}`,
};

interface ResourceIdHelpers {
  fromParams: (paramName: string) => (req: Request) => string | null;
  fromResponse: (
    key?: string
  ) => (req: Request, res: Response, responseData: unknown) => string | null;
}

const getResourceId: ResourceIdHelpers = {
  fromParams: (paramName: string) => (req: Request) => {
    const value = req.params?.[paramName];
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
  },
  fromResponse: (_key?: string) => (_req: Request, _res: Response, responseData: unknown) => {
    try {
      const data =
        typeof responseData === 'string'
          ? (JSON.parse(responseData) as Record<string, unknown>)
          : (responseData as Record<string, unknown>);
      return (
        ((data?.data as Record<string, unknown>)?.id as string) || (data?.id as string) || null
      );
    } catch {
      return null;
    }
  },
};

export { auditLog, createDescription, getResourceId };
