const { prisma } = require('../models');

/**
 * Helper để lấy file path từ số quyết định
 * Luôn query từ DB để đảm bảo lấy file path mới nhất
 * @param {string} soQuyetDinh - Số quyết định
 * @returns {Promise<string|null>} - File path hoặc null nếu không tìm thấy
 */
async function getDecisionFilePath(soQuyetDinh) {
  if (!soQuyetDinh || soQuyetDinh.trim() === '') {
    return null;
  }

  try {
    const decision = await prisma.fileQuyetDinh.findUnique({
      where: { so_quyet_dinh: soQuyetDinh.trim() },
      select: { file_path: true },
    });

    return decision?.file_path || null;
  } catch (error) {
    console.error(`Error getting file path for decision ${soQuyetDinh}:`, error);
    return null;
  }
}

/**
 * Helper để lấy thông tin file quyết định đầy đủ từ số quyết định
 * @param {string} soQuyetDinh - Số quyết định
 * @returns {Promise<Object|null>} - Thông tin quyết định hoặc null
 */
async function getDecisionInfo(soQuyetDinh) {
  if (!soQuyetDinh || soQuyetDinh.trim() === '') {
    return null;
  }

  try {
    const decision = await prisma.fileQuyetDinh.findUnique({
      where: { so_quyet_dinh: soQuyetDinh.trim() },
    });

    return decision;
  } catch (error) {
    console.error(`Error getting decision info for ${soQuyetDinh}:`, error);
    return null;
  }
}

module.exports = {
  getDecisionFilePath,
  getDecisionInfo,
};


