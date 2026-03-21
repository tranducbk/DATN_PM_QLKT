const { prisma } = require('../../models');
const { getDanhHieuName } = require('../../constants/danhHieu.constants');

/**
 * Kiểm tra xem quân nhân đã có đề xuất cùng năm và cùng danh hiệu chưa
 * @param {string} personnelId - ID quân nhân
 * @param {number} nam - Năm đề xuất
 * @param {string} danhHieu - Danh hiệu đề xuất
 * @param {string} proposalType - Loại đề xuất
 * @returns {Promise<Object>} - { exists: boolean, message?: string }
 */
async function checkDuplicateAward(
  personnelId,
  nam,
  danhHieu,
  proposalType,
  status = null,
  excludeProposalId = null
) {
  try {
    // CA_NHAN_HANG_NAM: Kiểm tra trong BangDeXuat
    if (proposalType === 'CA_NHAN_HANG_NAM') {
      const proposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: 'CA_NHAN_HANG_NAM',
          nam: parseInt(nam),
          status: status ? status : { not: 'REJECTED' },
          ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
        },
      });

      // tìm trong data_danh_hieu của từng proposal
      const existing = proposals.find(p => {
        const dataDanhHieu = p.data_danh_hieu || [];
        return dataDanhHieu.some(
          item => item.personnel_id === personnelId && item.danh_hieu === danhHieu
        );
      });

      if (existing) {
        return {
          exists: true,
          message: `Quân nhân đã có đề xuất danh hiệu ${getDanhHieuName(danhHieu)} cho năm ${nam}`,
          status: existing.status,
        };
      }
    }

    // NIEN_HAN với HCCSVV: Kiểm tra bảng danh hiệu thực tế + đề xuất PENDING
    if (proposalType === 'NIEN_HAN' && danhHieu?.startsWith('HCCSVV_')) {
      // Kiểm tra bản ghi khen thưởng thực tế trong bảng danh hiệu
      const actualAward = await prisma.khenThuongHCCSVV.findFirst({
        where: {
          quan_nhan_id: personnelId,
          danh_hieu: danhHieu,
        },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có ${getDanhHieuName(danhHieu)} (năm ${actualAward.nam || nam})`,
        };
      }

      // Kiểm tra đề xuất PENDING (đang chờ duyệt) để tránh trùng lặp
      const pendingProposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: 'NIEN_HAN',
          nam: parseInt(nam),
          status: 'PENDING',
          ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
        },
      });
      const pendingExisting = pendingProposals.find(p => {
        const dataNienHan = p.data_nien_han || [];
        return dataNienHan.some(
          item => item.personnel_id === personnelId && item.danh_hieu === danhHieu
        );
      });
      if (pendingExisting) {
        return {
          exists: true,
          message: `Quân nhân đang có đề xuất ${getDanhHieuName(danhHieu)} chờ duyệt (năm ${pendingExisting.nam})`,
        };
      }
    }

    // HC_QKQT: Kiểm tra bảng danh hiệu thực tế + đề xuất PENDING
    if (proposalType === 'HC_QKQT') {
      const actualAward = await prisma.huanChuongQuanKyQuyetThang.findFirst({
        where: { quan_nhan_id: personnelId },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có Huy chương Quân kỳ quyết thắng (năm ${actualAward.nam || nam})`,
        };
      }

      const pendingProposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: 'HC_QKQT',
          nam: parseInt(nam),
          status: 'PENDING',
          ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
        },
      });
      const pendingExisting = pendingProposals.find(p => {
        const dataNienHan = p.data_nien_han || [];
        return dataNienHan.some(item => item.personnel_id === personnelId);
      });
      if (pendingExisting) {
        return {
          exists: true,
          message: `Quân nhân đang có đề xuất Huy chương Quân kỳ quyết thắng chờ duyệt (năm ${pendingExisting.nam})`,
        };
      }
    }

    // KNC_VSNXD_QDNDVN: Kiểm tra bảng danh hiệu thực tế + đề xuất PENDING
    if (proposalType === 'KNC_VSNXD_QDNDVN') {
      const actualAward = await prisma.kyNiemChuongVSNXDQDNDVN.findFirst({
        where: { quan_nhan_id: personnelId },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN (năm ${actualAward.nam || nam})`,
        };
      }

      const pendingProposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: 'KNC_VSNXD_QDNDVN',
          nam: parseInt(nam),
          status: 'PENDING',
          ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
        },
      });
      const pendingExisting = pendingProposals.find(p => {
        const dataNienHan = p.data_nien_han || [];
        return dataNienHan.some(item => item.personnel_id === personnelId);
      });
      if (pendingExisting) {
        return {
          exists: true,
          message: `Quân nhân đang có đề xuất Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN chờ duyệt (năm ${pendingExisting.nam})`,
        };
      }
    }

    // CONG_HIEN: Kiểm tra bảng danh hiệu thực tế + đề xuất PENDING
    if (proposalType === 'CONG_HIEN') {
      const actualAward = await prisma.khenThuongCongHien.findFirst({
        where: { quan_nhan_id: personnelId },
      });
      if (actualAward) {
        return {
          exists: true,
          message: `Quân nhân đã có ${getDanhHieuName(actualAward.danh_hieu || danhHieu)} (năm ${actualAward.nam || nam})`,
        };
      }

      const pendingProposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: 'CONG_HIEN',
          nam: parseInt(nam),
          status: 'PENDING',
          ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
        },
      });
      const pendingExisting = pendingProposals.find(p => {
        const dataCongHien = p.data_cong_hien || [];
        return dataCongHien.some(item => item.personnel_id === personnelId);
      });
      if (pendingExisting) {
        const dataCongHien = pendingExisting.data_cong_hien || [];
        const congHienItem = dataCongHien.find(item => item.personnel_id === personnelId);
        const pendingDanhHieu = congHienItem?.danh_hieu || danhHieu;
        return {
          exists: true,
          message: `Quân nhân đang có đề xuất ${getDanhHieuName(pendingDanhHieu)} chờ duyệt (năm ${pendingExisting.nam})`,
        };
      }
    }

    return { exists: false };
  } catch (error) {
    throw error;
  }
}

/**
 * Kiểm tra xem đơn vị đã có đề xuất trùng với năm và danh hiệu chưa
 * @param {string} donViId - ID đơn vị
 * @param {number} nam - Năm
 * @param {string} danhHieu - Danh hiệu (ĐVQT, ĐVTT, BKBQP, BKTTCP)
 * @param {string} proposalType - Loại đề xuất (DON_VI_HANG_NAM)
 * @returns {Promise<Object>} - { exists: boolean, message?: string }
 */
async function checkDuplicateUnitAward(donViId, nam, danhHieu, proposalType) {
  try {
    // DON_VI_HANG_NAM: Kiểm tra trong BangDeXuat
    if (proposalType === 'DON_VI_HANG_NAM') {
      const proposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: 'DON_VI_HANG_NAM',
          nam: parseInt(nam),
          status: { not: 'REJECTED' },
        },
      });

      // Tìm trong data_danh_hieu của từng proposal
      const existing = proposals.find(p => {
        const dataDanhHieu = p.data_danh_hieu || [];
        return dataDanhHieu.some(item => item.don_vi_id === donViId && item.danh_hieu === danhHieu);
      });

      if (existing) {
        return {
          exists: true,
          message: `Đơn vị đã có đề xuất danh hiệu ${getDanhHieuName(danhHieu)} cho năm ${nam}`,
          status: existing.status,
        };
      }
    }

    return { exists: false };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  checkDuplicateAward,
  checkDuplicateUnitAward,
};
