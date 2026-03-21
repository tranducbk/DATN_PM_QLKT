/**
 * Helper chung cho xử lý Excel — dùng chung giữa các service import
 */

/**
 * Bỏ dấu tiếng Việt
 */
function removeVietnameseAccents(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Parse header row của worksheet thành map { normalizedKey: colNumber }
 */
function parseHeaderMap(worksheet) {
  const headerRow = worksheet.getRow(1);
  const headerMap = {};

  headerRow.eachCell((cell, colNumber) => {
    const rawValue = String(cell.value ?? '')
      .trim()
      .toLowerCase();
    const key = removeVietnameseAccents(rawValue)
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    if (key) headerMap[key] = colNumber;
  });

  return headerMap;
}

/**
 * Tìm cột theo nhiều tên khác nhau
 * @param {Object} headerMap - Map từ parseHeaderMap
 * @param {string[]} variations - Các tên có thể của cột
 * @returns {number|null} Số cột hoặc null
 */
function getHeaderCol(headerMap, variations) {
  for (const v of variations) {
    if (headerMap[v]) return headerMap[v];
  }
  return null;
}

/**
 * Parse giá trị boolean từ Excel (Có, có, true, 1, x → true)
 */
function parseBooleanValue(value) {
  if (value === null || value === undefined) return false;
  const strVal = String(value).trim().toLowerCase();
  return ['có', 'co', 'true', '1', 'x'].includes(strVal);
}

module.exports = {
  removeVietnameseAccents,
  parseHeaderMap,
  getHeaderCol,
  parseBooleanValue,
};
