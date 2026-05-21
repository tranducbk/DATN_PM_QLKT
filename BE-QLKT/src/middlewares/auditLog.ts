import { Request, Response, NextFunction } from 'express';
import { systemLogRepository } from '../repositories/systemLog.repository';

import type { AuditLogOptions } from '../types/api';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  AUDIT LOG MIDDLEWARE — ghi log mọi action quan trọng (compliance)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  KỸ THUẬT MONKEY-PATCH res.json:
 *  Wrap res.json để intercept response trước khi gửi client:
 *    1. Restore res.json về bản gốc (chống recursion).
 *    2. Check response.success === true → mới log (không log fail).
 *    3. Call original json để gửi response cho client.
 *    4. Fire-and-forget ghi log vào DB (không await → không làm chậm response).
 *
 *  WHY KHÔNG dùng res.on('finish')?
 *  - finish event chạy sau khi response đã gửi → không lấy được body data.
 *  - Cần body để extract resourceId (vd: id của record vừa tạo).
 *
 *  REDACT SENSITIVE FIELDS:
 *  Trước khi lưu DB, đệ quy redact các field nhạy cảm (password, cccd,
 *  refreshToken, ...). Audit log có thể bị SUPER_ADMIN đọc → tuyệt đối
 *  không lưu plain password ngay cả trong log.
 *
 *  FIRE-AND-FORGET:
 *  systemLogRepository.create() KHÔNG await → response không bị block bởi
 *  ghi log. Trade-off: nếu DB log fail thì silently mất 1 entry (chấp
 *  nhận được — log là phụ trợ, không thể block business operation).
 *
 *  RESOURCE ID EXTRACTION (multi-strategy):
 *  - getResourceId.fromParams('id')   → req.params.id (DELETE /x/:id)
 *  - getResourceId.fromResponse()      → response.data.id (POST tạo mới)
 *  - getResourceId.fromBody('xxx')     → req.body.xxx
 *  → Route definition chọn chiến lược phù hợp.
 *
 *  DESCRIPTION BUILDER:
 *  Mỗi domain có function build description tiếng Việt (xem helpers/auditLog/).
 *  Vd: 'Phê duyệt đề xuất khen thưởng cá nhân hàng năm năm 2024 cho 5 quân nhân'.
 *  Tốt hơn raw "APPROVE proposals" vì SUPER_ADMIN review log dễ hiểu.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
  } catch (error) {
   console.error('Failed to parse audit response payload:', error);
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

    const jsonWithAudit: Response['json'] = function (this: Response, data: unknown) {
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

              await systemLogRepository.create({
                nguoi_thuc_hien_id: user.id,
                actor_role: user.role,
                action,
                resource,
                tai_nguyen_id: resourceId ?? undefined,
                description,
                payload: payload ? JSON.stringify(payload) : undefined,
                ip_address: req.ip || req.socket.remoteAddress,
                user_agent: req.get('User-Agent'),
              });
            })
            .catch(error => {
              console.error('Failed to write audit log:', error);
            });
        }
      }

      return originalJson.call(this, data);
    };

    res.json = jsonWithAudit;

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
