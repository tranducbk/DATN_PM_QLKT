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

  created(
    res: Response,
    { data = null, message = 'Tạo mới thành công' }: SuccessOptions = {}
  ): Response {
    return this.success(res, { data, message, statusCode: 201 });
  },

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

  badRequest(res: Response, message: string = 'Dữ liệu không hợp lệ'): Response {
    return this.error(res, { message, statusCode: 400 });
  },

  forbidden(res: Response, message: string = 'Không có quyền thực hiện hành động này'): Response {
    return this.error(res, { message, statusCode: 403 });
  },

  notFound(res: Response, message: string = 'Không tìm thấy tài nguyên'): Response {
    return this.error(res, { message, statusCode: 404 });
  },

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
