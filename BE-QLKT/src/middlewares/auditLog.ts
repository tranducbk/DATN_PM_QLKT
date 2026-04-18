import { Request, Response, NextFunction } from 'express';
import { prisma } from '../models';

import type { AuditLogOptions } from '../types/api';

const SENSITIVE_FIELDS = ['password', 'password_hash', 'refreshToken', 'cccd', 'oldPassword', 'newPassword', 'confirmPassword'];

const DISPLAY_NAME_FIELDS = ['username', 'ho_ten', 'ten_don_vi', 'ten_chuc_vu'];

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

const parseResponse = (responseData: unknown): Record<string, unknown> | null => {
  try {
    return typeof responseData === 'string' ? JSON.parse(responseData) as Record<string, unknown> : responseData as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getStringId = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const extractResourceId = (parsed: Record<string, unknown> | null): string | null => {
  if (!parsed) return null;

  const nestedData = parsed.data;
  if (isRecord(nestedData)) {
    const nestedId = getStringId(nestedData.id);
    if (nestedId) return nestedId;
  }

  return getStringId(parsed.id);
};

const isSuccessResponse = (responseData: unknown): boolean => {
  const parsed = parseResponse(responseData);
  return parsed?.success === true;
};

const getDisplayName = (data: Record<string, string | undefined>): string =>
  DISPLAY_NAME_FIELDS.map(f => data?.[f]).find(Boolean) || 'N/A';

/**
 * Creates middleware to capture audit logs for successful responses.
 * @param options - Audit metadata and payload resolvers
 * @returns Express middleware that writes audit logs asynchronously
 */
const auditLog = (options: AuditLogOptions = { action: '', resource: '' }) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json;

    res.json = function (this: Response, data: unknown) {
      // Restore the original method to prevent recursive calls.
      res.json = originalJson;

      // Write logs asynchronously without blocking the main response.
      if (isSuccessResponse(data)) {
        const user = req.user;
        if (user) {
          const {
            action,
            resource,
            getResourceId = () => null,
            getDescription = () => `${action} ${resource}`,
            getPayload = () => null,
          } = options;

          Promise.resolve(getDescription(req, res, data))
            .then(async description => {
              const resourceId = getResourceId(req, res, data);
              const payload = redactSensitiveFields(getPayload(req, res, data));

              await prisma.systemLog.create({
                data: {
                  nguoi_thuc_hien_id: user.id,
                  actor_role: user.role,
                  action,
                  resource,
                  tai_nguyen_id: resourceId ?? undefined,
                  description,
                  payload: payload ? JSON.stringify(payload) : undefined,
                  ip_address: req.ip || req.socket.remoteAddress,
                  user_agent: req.get('User-Agent'),
                },
              });
            })
            .catch(() => {
              // Swallow logging errors to keep response behavior unchanged.
            });
        }
      }

      return originalJson.call(this, data);
    } as Response['json'];

    next();
  };
};

const createDescription = {
  create: (resource: string, data: Record<string, string | undefined>) =>
    `Tạo mới ${resource}: ${getDisplayName(data)}`,
  update: (resource: string, data: Record<string, string | undefined>) =>
    `Cập nhật ${resource}: ${getDisplayName(data)}`,
  delete: (resource: string, data: Record<string, string | undefined>) =>
    `Xóa ${resource}: ${getDisplayName(data)}`,
  login: () => 'Đăng nhập hệ thống',
  logout: () => 'Đăng xuất khỏi hệ thống',
  resetPassword: (data?: Record<string, string | undefined>) =>
    `Đặt lại mật khẩu cho tài khoản: ${data?.username || 'N/A'}`,
};

const getResourceId = {
  fromParams: (paramName: string) => (req: Request) => {
    const value = req.params?.[paramName];
    return Array.isArray(value) ? value[0] || null : value || null;
  },
  fromResponse: () => (req: Request, res: Response, responseData: unknown) => {
    const data = parseResponse(responseData);
    return extractResourceId(data);
  },
};

export { auditLog, createDescription, getResourceId };
