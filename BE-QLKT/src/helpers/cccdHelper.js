/**
 * CCCD Helper - Utility Pattern
 *
 * Shared utility cho việc xử lý CCCD (Căn cước công dân).
 * Tách ra từ proposal.service.js và personnel.service.js để tránh code duplication.
 */

/**
 * Parse và chuẩn hóa CCCD
 * CCCD Việt Nam chuẩn là 12 số. Nếu bị mất số 0 đầu (do Excel), sẽ padding lại.
 *
 * @param {string|number} value - Giá trị CCCD cần parse
 * @returns {string} CCCD đã chuẩn hóa (12 ký tự)
 */
const parseCCCD = value => {
  if (!value) return '';

  let cccd = value.toString().trim();

  if (/^\d+$/.test(cccd) && cccd.length < 12) {
    cccd = cccd.padStart(12, '0');
  }

  return cccd;
};

module.exports = { parseCCCD };
