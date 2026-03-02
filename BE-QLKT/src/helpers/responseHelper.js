/**
 * Response Helper - Factory Pattern
 *
 * Chuẩn hóa format response cho toàn bộ API.
 * Đảm bảo tất cả response đều có cùng cấu trúc:
 * { success: boolean, message: string, data?: any }
 */

const ResponseHelper = {
  /**
   * Response thành công
   * @param {Object} res - Express response object
   * @param {Object} options - { data, message, statusCode }
   */
  success(res, { data = null, message = 'Thành công', statusCode = 200 } = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      ...(data !== null && { data }),
    });
  },

  /**
   * Response tạo mới thành công (201)
   */
  created(res, { data = null, message = 'Tạo mới thành công' } = {}) {
    return this.success(res, { data, message, statusCode: 201 });
  },

  /**
   * Response lỗi
   * @param {Object} res - Express response object
   * @param {Object} options - { message, statusCode, details }
   */
  error(res, { message = 'Lỗi hệ thống', statusCode = 500, details = null } = {}) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(details !== null && { details }),
    });
  },

  /**
   * Response lỗi validation (400)
   */
  badRequest(res, message = 'Dữ liệu không hợp lệ') {
    return this.error(res, { message, statusCode: 400 });
  },

  /**
   * Response không có quyền (403)
   */
  forbidden(res, message = 'Không có quyền thực hiện hành động này') {
    return this.error(res, { message, statusCode: 403 });
  },

  /**
   * Response không tìm thấy (404)
   */
  notFound(res, message = 'Không tìm thấy tài nguyên') {
    return this.error(res, { message, statusCode: 404 });
  },

  /**
   * Response với pagination
   * @param {Object} res - Express response object
   * @param {Object} options - { data, total, page, limit, message }
   */
  paginated(res, { data, total, page, limit, message = 'Lấy dữ liệu thành công' }) {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  },
};

module.exports = ResponseHelper;
