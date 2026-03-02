/**
 * Helper functions cho xử lý datetime
 */

/**
 * Format date thành chuỗi DD-MM-YYYY (định dạng Việt Nam)
 * @param {Date|string} dateStr - Date object hoặc date string
 * @returns {string} - Chuỗi date format DD-MM-YYYY hoặc chuỗi rỗng nếu không hợp lệ
 */
const formatDate = dateStr => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    // Kiểm tra xem date có hợp lệ không
    if (isNaN(date.getTime())) {
      return '';
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return '';
  }
};

module.exports = {
  formatDate,
};
