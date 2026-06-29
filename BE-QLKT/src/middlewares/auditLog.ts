import { Request, Response, NextFunction } from 'express';
import { systemLogRepository } from '../repositories/systemLog.repository';
import { MAX_LOG_DESCRIPTION_LENGTH } from '../helpers/systemLogHelper';
import { getClientIp } from '../helpers/clientIp';

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
 *  Promise ghi log (systemLogRepository.create) KHÔNG được await trong luồng
 *  response → response không bị block bởi việc ghi log. Trade-off: nếu DB log
 *  fail thì silently mất 1 entry (chấp nhận được — log là phụ trợ, không thể
 *  block business operation).
 *
 *  RESOURCE ID EXTRACTION (multi-strategy):
 *  - getResourceId.fromParams('id')   → req.params.id (DELETE /x/:id)
 *  - getResourceId.fromResponse()      → response.data.id (POST tạo mới)
 *  → Route definition chọn chiến lược phù hợp.
 *
 *  DESCRIPTION BUILDER:
 *  Mỗi domain có function build description tiếng Việt (xem helpers/auditLog/),
 *  truyền vào qua options.getDescription. Description bị cắt còn tối đa
 *  MAX_LOG_DESCRIPTION_LENGTH ký tự trước khi lưu để không tràn cột DB.
 *  Vd: 'Phê duyệt đề xuất khen thưởng cá nhân hàng năm năm 2024 cho 5 quân nhân'.
 *  Tốt hơn raw "APPROVE proposals" vì SUPER_ADMIN review log dễ hiểu.
 * ════════════════════════════════════════════════════════════════════════════
 */

// Các field tuyệt đối không được lưu thẳng vào log (sẽ bị thay bằng [REDACTED]).
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'refreshToken',
  'cccd',
  'oldPassword',
  'newPassword',
  'confirmPassword',
];

const redactSensitiveFields = (obj: unknown): unknown => {
  if (!obj || typeof obj !== 'object') return obj; // primitive/null → giữ nguyên
  if (Array.isArray(obj)) return obj.map(redactSensitiveFields); // mảng → redact từng phần tử

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      redacted[key] = '[REDACTED]'; // field nhạy cảm → che giá trị
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveFields(value); // object lồng → đệ quy che tiếp
    } else {
      redacted[key] = value; // còn lại giữ nguyên
    }
  }
  return redacted;
};

const parseResponse = (responseData: unknown): Record<string, unknown> | null => {
  try {
    // Body response có thể là chuỗi JSON (đã stringify) hoặc object → đưa về object.
    return typeof responseData === 'string'
      ? (JSON.parse(responseData) as Record<string, unknown>)
      : (responseData as Record<string, unknown>);
  } catch (error) {
    console.error('[auditLog] parse response failed:', error); // JSON hỏng → bỏ qua, không chặn response
    return null;
  }
};

// Chỉ chấp nhận chuỗi không rỗng làm id (loại bỏ '', number, undefined...).
const getStringId = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

// Kiểm tra value là object thuần (không phải null, không phải mảng).
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const extractResourceId = (parsed: Record<string, unknown> | null): string | null => {
  if (!parsed) return null;

  // Response chuẩn dạng { data: { id } } → ưu tiên lấy data.id của record vừa tạo.
  const nestedData = parsed.data;
  if (isRecord(nestedData)) {
    const nestedId = getStringId(nestedData.id);
    if (nestedId) return nestedId;
  }

  return getStringId(parsed.id); // fallback: id nằm thẳng ở top-level
};

// Chỉ ghi log khi nghiệp vụ thành công (success === true), bỏ qua response lỗi.
const isSuccessResponse = (responseData: unknown): boolean => {
  const parsed = parseResponse(responseData);
  return parsed?.success === true;
};

/**
 * Creates middleware to capture audit logs for successful responses.
 * @param options - Audit metadata and payload resolvers
 * @returns Express middleware that writes audit logs asynchronously
 */
const auditLog = (options: AuditLogOptions = { action: '', resource: '' }) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json;

    const jsonWithAudit: Response['json'] = function (this: Response, data: unknown) {
      // Trả res.json về bản gốc để lần gọi tiếp không chạy lại wrapper (chống đệ quy).
      res.json = originalJson;

      // Ghi log bất đồng bộ, không chặn luồng trả response cho client.
      if (isSuccessResponse(data)) {
        const user = req.user;
        if (user) {
          // Mỗi route truyền cách lấy id/mô tả/payload riêng; chưa truyền thì dùng default.
          const {
            action,
            resource,
            getResourceId = () => null,
            getDescription = () => `${action} ${resource}`,
            getPayload = () => null,
          } = options;

          // getDescription có thể async (vd query thêm tên đơn vị) → bọc Promise.resolve.
          Promise.resolve(getDescription(req, res, data))
            .then(async description => {
              const resourceId = getResourceId(req, res, data); // id của tài nguyên bị tác động
              const payload = redactSensitiveFields(getPayload(req, res, data)); // dữ liệu kèm theo, đã che field nhạy cảm

              await systemLogRepository.create({
                nguoi_thuc_hien_id: user.id,
                actor_role: user.role,
                action,
                resource,
                tai_nguyen_id: resourceId ?? undefined,
                // Cắt bớt để không tràn giới hạn độ dài cột description trong DB.
                description: description.substring(0, MAX_LOG_DESCRIPTION_LENGTH),
                payload: payload ? JSON.stringify(payload) : undefined,
                ip_address: getClientIp(req),
                user_agent: req.get('User-Agent'),
              });
            })
            .catch(error => {
              // Ghi log thất bại không được ảnh hưởng response đã trả cho client → chỉ log console.
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

const getResourceId = {
  // Lấy id từ URL param, vd DELETE /proposals/:id → req.params.id.
  fromParams: (paramName: string) => (req: Request) => {
    const value = req.params?.[paramName];
    return (Array.isArray(value) ? value[0] : value) || null; // param có thể là mảng → lấy phần tử đầu
  },
  // Lấy id từ body response, vd POST tạo mới trả về record có id.
  fromResponse: () => (req: Request, res: Response, responseData: unknown) => {
    const data = parseResponse(responseData);
    return extractResourceId(data);
  },
};

export { auditLog, getResourceId };
