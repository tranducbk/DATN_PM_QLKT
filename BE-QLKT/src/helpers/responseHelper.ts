import { Response } from 'express';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  RESPONSE HELPER — chuẩn hoá format JSON trả về cho FE
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  TẤT CẢ API response THEO 1 SCHEMA:
 *      {
 *        success: boolean,   ← true cho 2xx, false cho 4xx/5xx
 *        message: string,    ← tiếng Việt, hiển thị trực tiếp được
 *        data?: any,         ← payload (nullable)
 *        pagination?: { total, page, limit, totalPages }  ← cho list
 *        warning?: string    ← non-fatal warning (vd: import có lỗi item)
 *      }
 *
 *  WHY chuẩn hoá:
 *  - FE chỉ cần check `response.success` → biết thành công hay không.
 *  - Message luôn ở `response.message` → axios interceptor extract dễ.
 *  - apiClient không cần map response từng endpoint khác nhau.
 *
 *  METHOD MAP TO HTTP STATUS:
 *      success(...)        → 200 OK (read, action thành công)
 *      created(...)        → 201 Created (vừa insert record mới)
 *      paginated(...)      → 200 OK + pagination metadata
 *      badRequest(msg)     → 400 (validate fail, business rule violation)
 *      unauthorized(msg)   → 401 (auth fail)
 *      forbidden(msg)      → 403 (auth OK nhưng không quyền)
 *      notFound(msg)       → 404 (record không tồn tại)
 *      conflict(msg)       → 409 (duplicate, optimistic lock)
 *      error(msg)          → 500 (server error, throw không catch được)
 *
 *  WARNING vs ERROR:
 *  - error: fail hoàn toàn → success=false, không có data.
 *  - warning: thành công CHÍNH NHƯNG có lỗi phụ (vd: import 100 record
 *    thành công, 5 record lỗi → success=true, data=100, warning='5 errors').
 *
 *  PAGINATION FORMAT (consistent):
 *      data:       array trực tiếp (KHÔNG nested vào data.items)
 *      pagination: { total, page, limit, totalPages } ở top level
 *  → FE table component dùng pagination này trực tiếp.
 *
 *  WHY KHÔNG dùng res.json() raw:
 *  - Anti-pattern AP-7 (xem BE-QLKT/CLAUDE.md).
 *  - Quên field nào → FE break.
 *  - Hardcode statusCode rải khắp controller → khó maintain.
 * ════════════════════════════════════════════════════════════════════════════
 */

interface SuccessOptions {
  data?: unknown;
  message?: string;
  statusCode?: number;
  warning?: unknown;
}

interface ErrorOptions {
  message?: string;
  statusCode?: number;
  details?: unknown;
}

interface PaginatedOptions {
  data: unknown;
  total: number;
  page: number | string;
  limit: number | string;
  message?: string;
  stats?: Record<string, unknown>;
}

const ResponseHelper = {
  /**
   * Sends a standard success response.
   * @param res - Express response instance
   * @param options - Response payload and metadata
   * @returns Express response with success payload
   */
  success(
    res: Response,
    { data = null, message = 'Thành công', statusCode = 200, warning }: SuccessOptions = {}
  ): Response {
    return res.status(statusCode).json({
      success: true,
      message,
      ...(data !== null && { data }),
      ...(warning && { warning }),
    });
  },

  /**
   * Sends a standard created response (HTTP 201).
   * @param res - Express response instance
   * @param options - Response payload and message
   * @returns Express response with created payload
   */
  created(
    res: Response,
    { data = null, message = 'Tạo mới thành công' }: SuccessOptions = {}
  ): Response {
    return this.success(res, { data, message, statusCode: 201 });
  },

  /**
   * Sends a standard error response.
   * @param res - Express response instance
   * @param options - Error message, status code, and details
   * @returns Express response with error payload
   */
  error(
    res: Response,
    { message = 'Lỗi hệ thống', statusCode = 500, details = null }: ErrorOptions = {}
  ): Response {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(details !== null && { details }),
    });
  },

  /**
   * Sends a bad request response (HTTP 400).
   * @param res - Express response instance
   * @param message - Error message to return
   * @returns Express response with bad request payload
   */
  badRequest(res: Response, message: string = 'Dữ liệu không hợp lệ'): Response {
    return this.error(res, { message, statusCode: 400 });
  },

  /**
   * Sends a forbidden response (HTTP 403).
   * @param res - Express response instance
   * @param message - Error message to return
   * @returns Express response with forbidden payload
   */
  forbidden(res: Response, message: string = 'Không có quyền thực hiện hành động này'): Response {
    return this.error(res, { message, statusCode: 403 });
  },

  /**
   * Sends a not found response (HTTP 404).
   * @param res - Express response instance
   * @param message - Error message to return
   * @returns Express response with not found payload
   */
  notFound(res: Response, message: string = 'Không tìm thấy tài nguyên'): Response {
    return this.error(res, { message, statusCode: 404 });
  },

  /**
   * Sends a paginated success response.
   * @param res - Express response instance
   * @param options - Paginated payload, page metadata, and optional stats
   * @returns Express response with paginated payload
   */
  paginated(
    res: Response,
    { data, total, page, limit, message = 'Lấy dữ liệu thành công', stats }: PaginatedOptions
  ): Response {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        total,
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
        totalPages: Math.ceil(total / Number(limit)),
      },
      ...(stats && { stats }),
    });
  },
};

export default ResponseHelper;
