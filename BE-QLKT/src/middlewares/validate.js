/**
 * Middleware validate request bằng Joi schema
 * @param {import('joi').ObjectSchema} schema - Joi schema
 * @param {'body' | 'query' | 'params'} source - Nguồn dữ liệu cần validate
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false, // Trả về tất cả lỗi, không dừng ở lỗi đầu tiên
      stripUnknown: true, // Loại bỏ các field không có trong schema
    });

    if (error) {
      const messages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: messages,
      });
    }

    // Gán lại giá trị đã được validate và clean
    req[source] = value;
    next();
  };
};

module.exports = { validate };
