import { Response } from 'express';

interface SuccessOptions {
  data?: unknown;
  message?: string;
  statusCode?: number;
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
    { data = null, message = 'Thành công', statusCode = 200 }: SuccessOptions = {}
  ): Response {
    return res.status(statusCode).json({
      success: true,
      message,
      ...(data !== null && { data }),
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
