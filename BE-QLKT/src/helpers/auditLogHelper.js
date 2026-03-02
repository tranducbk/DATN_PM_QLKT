/**
 * Helper functions để tạo mô tả log cho các resource khác nhau
 * Logic này được tách ra khỏi router để dễ maintain và test
 */

const { formatDate } = require('./datetimeHelper');
const { getDanhHieuName, getLoaiDeXuatName } = require('../constants/danhHieu.constants');

// ==================== Constants ====================

/**
 * Fallback messages thống nhất cho toàn bộ hệ thống log
 */
const FALLBACK = {
  UNKNOWN: 'Chưa xác định',
  NO_NAME: 'Chưa có tên',
  NO_UNIT: 'Chưa có đơn vị',
  NO_POSITION: 'Chưa có chức vụ',
  NO_FILE: 'Không có file',
};

/**
 * Mapping vai trò sang tiếng Việt
 */
const ROLE_NAMES = {
  USER: 'Người dùng',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị viên',
  SUPER_ADMIN: 'Quản trị viên cấp cao',
};

/**
 * Mapping loại thành tích khoa học sang tiếng Việt
 */
const ACHIEVEMENT_TYPE_NAMES = {
  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
  NCKH: 'Nghiên cứu khoa học',
};

// ==================== Helper Functions ====================

/**
 * Parse responseData (có thể là string JSON hoặc object)
 */
const parseResponseData = responseData => {
  try {
    return typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
  } catch {
    return null;
  }
};

/**
 * Lấy tên đơn vị từ ChucVu object
 */
const getUnitNameFromChucVu = chucVu => {
  if (!chucVu) return '';
  if (chucVu.CoQuanDonVi?.ten_don_vi) {
    return chucVu.CoQuanDonVi.ten_don_vi;
  }
  if (chucVu.DonViTrucThuoc?.ten_don_vi) {
    const tenDonVi = chucVu.DonViTrucThuoc.ten_don_vi;
    if (chucVu.DonViTrucThuoc.CoQuanDonVi?.ten_don_vi) {
      return `${tenDonVi} (${chucVu.DonViTrucThuoc.CoQuanDonVi.ten_don_vi})`;
    }
    return tenDonVi;
  }
  return '';
};

/**
 * Query và lấy tên đơn vị từ unitId
 */
const getUnitNameFromUnitId = async (unitId, prisma) => {
  if (!unitId) return '';
  try {
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({
        where: { id: unitId },
        select: { ten_don_vi: true },
      }),
      prisma.donViTrucThuoc.findUnique({
        where: { id: unitId },
        include: {
          CoQuanDonVi: { select: { ten_don_vi: true } },
        },
      }),
    ]);

    if (coQuanDonVi?.ten_don_vi) {
      return coQuanDonVi.ten_don_vi;
    }
    if (donViTrucThuoc?.ten_don_vi) {
      const tenDonVi = donViTrucThuoc.ten_don_vi;
      if (donViTrucThuoc.CoQuanDonVi?.ten_don_vi) {
        return `${tenDonVi} (${donViTrucThuoc.CoQuanDonVi.ten_don_vi})`;
      }
      return tenDonVi;
    }
    return '';
  } catch {
    return '';
  }
};

/**
 * Query tên quân nhân từ personnelId
 */
const queryPersonnelName = async (personnelId, prisma) => {
  if (!personnelId) return '';
  try {
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnelId },
      select: { ho_ten: true },
    });
    return personnel?.ho_ten || '';
  } catch {
    return '';
  }
};

/**
 * Query thông tin chức vụ (tên và đơn vị) từ chucVuId
 */
const queryPositionInfo = async (chucVuId, prisma) => {
  if (!chucVuId) return { tenChucVu: '', tenDonVi: '' };
  try {
    const chucVu = await prisma.chucVu.findUnique({
      where: { id: chucVuId },
      include: {
        CoQuanDonVi: { select: { ten_don_vi: true } },
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: { select: { ten_don_vi: true } },
          },
        },
      },
    });
    if (!chucVu) return { tenChucVu: '', tenDonVi: '' };
    return {
      tenChucVu: chucVu.ten_chuc_vu || '',
      tenDonVi: getUnitNameFromChucVu(chucVu),
    };
  } catch {
    return { tenChucVu: '', tenDonVi: '' };
  }
};

/**
 * Helper để truy vấn database trong log description
 * Sử dụng singleton PrismaClient thay vì tạo instance mới mỗi lần
 */
const withPrisma = async callback => {
  const { prisma } = require('../models');
  try {
    return await callback(prisma);
  } catch (error) {
    console.error('Error querying database for log description:', error);
    return null;
  }
};

/**
 * Format date range cho log description
 */
const formatDateRange = (ngayBatDau, ngayKetThuc) => {
  if (!ngayBatDau && ngayKetThuc === undefined) return '';
  if (ngayBatDau) {
    const formattedStart = formatDate(ngayBatDau);
    if (ngayKetThuc !== undefined) {
      if (ngayKetThuc) {
        const formattedEnd = formatDate(ngayKetThuc);
        return ` (Từ: ${formattedStart} đến: ${formattedEnd})`;
      }
      return ` (Từ: ${formattedStart} - Chưa kết thúc)`;
    }
    return ` (Từ: ${formattedStart})`;
  }
  if (ngayKetThuc !== undefined) {
    if (ngayKetThuc) {
      const formattedEnd = formatDate(ngayKetThuc);
      return ` (Đến: ${formattedEnd})`;
    }
    return ' (Chưa kết thúc)';
  }
  return '';
};

const createLogDescription = {
  /**
   * Tạo mô tả cho proposals actions
   */
  proposals: {
    CREATE: (req, res, responseData) => {
      const proposalType = req.body?.loai_de_xuat || req.body?.type || '';
      const typeName = getLoaiDeXuatName(proposalType);

      // Lấy thông tin từ response nếu có
      let soLuong = 0;
      let nam = '';
      let donVi = '';

      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const proposal = data?.data?.proposal || data?.proposal || data?.data || data;

        if (proposal) {
          soLuong =
            proposal.so_personnel ||
            (Array.isArray(proposal.data_danh_hieu) ? proposal.data_danh_hieu.length : 0) ||
            (Array.isArray(proposal.data_nien_han) ? proposal.data_nien_han.length : 0) ||
            (Array.isArray(proposal.data_cong_hien) ? proposal.data_cong_hien.length : 0) ||
            (Array.isArray(proposal.data_thanh_tich) ? proposal.data_thanh_tich.length : 0) ||
            0;
          nam = proposal.nam || req.body?.nam || '';
          donVi = proposal.don_vi || '';
        }
      } catch (e) {
        // Ignore parse error
      }

      // Nếu không có từ response, thử lấy từ request body
      if (soLuong === 0) {
        const titleData = req.body?.title_data;
        if (titleData) {
          try {
            const parsed = typeof titleData === 'string' ? JSON.parse(titleData) : titleData;
            soLuong = Array.isArray(parsed) ? parsed.length : 0;
          } catch (e) {
            // Ignore parse error
          }
        }
        nam = req.body?.nam || '';
      }

      // Tạo mô tả chi tiết
      let description = `Tạo đề xuất khen thưởng: ${typeName}`;

      if (soLuong > 0) {
        const unitText = proposalType === 'DON_VI_HANG_NAM' ? 'đơn vị' : 'quân nhân';
        description += ` (${soLuong} ${unitText}`;
        if (nam) {
          description += `, năm ${nam}`;
        }
        description += ')';
      } else if (nam) {
        description += ` (năm ${nam})`;
      }

      if (donVi) {
        description += ` - ${donVi}`;
      }

      return description;
    },
    APPROVE: async (req, res, responseData) => {
      const proposalId = req.params?.id || 'Chưa có dữ liệu';
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const result = data?.data?.result || data?.result || {};

        // Lấy proposal từ response hoặc từ database
        let proposal = data?.data?.proposal || data?.proposal;

        // Nếu không có trong response, lấy từ database
        if (!proposal && proposalId && proposalId !== 'Chưa có dữ liệu') {
          try {
            const { prisma } = require('../models');
            proposal = await prisma.bangDeXuat.findUnique({
              where: { id: proposalId },
              include: {
                NguoiDeXuat: {
                  include: {
                    QuanNhan: true,
                  },
                },
                DonViTrucThuoc: true,
                CoQuanDonVi: true,
              },
            });
          } catch (dbError) {
            console.error('Error fetching proposal from database:', dbError);
          }
        }

        // Fallback: thử lấy từ data nếu không có proposal
        if (!proposal) {
          proposal = data?.data || data;
        }

        if (
          proposal &&
          (proposal.loai_de_xuat || proposal.type || proposalId !== 'Chưa có dữ liệu')
        ) {
          const loaiDeXuat = proposal.loai_de_xuat || proposal.type;
          const typeName = getLoaiDeXuatName(loaiDeXuat);

          // Lấy năm
          const nam = proposal.nam || result.nam || '';

          // Lấy người đề xuất
          let nguoiDeXuat = 'Chưa có dữ liệu';
          if (proposal.NguoiDeXuat) {
            nguoiDeXuat =
              proposal.NguoiDeXuat.QuanNhan?.ho_ten ||
              proposal.NguoiDeXuat.username ||
              'Chưa có dữ liệu';
          } else if (result.nguoi_de_xuat) {
            nguoiDeXuat = result.nguoi_de_xuat;
          }

          // Lấy số lượng tùy theo loại đề xuất
          let soLuong = 0;
          let donViText = '';

          if (loaiDeXuat === 'CA_NHAN_HANG_NAM') {
            soLuong = result.total_danh_hieu || 0;
            donViText = soLuong > 0 ? `${soLuong} quân nhân` : '';
          } else if (loaiDeXuat === 'DON_VI_HANG_NAM') {
            // Đếm số đơn vị từ editedData hoặc result
            const editedData = req.body?.data_danh_hieu
              ? typeof req.body.data_danh_hieu === 'string'
                ? JSON.parse(req.body.data_danh_hieu)
                : req.body.data_danh_hieu
              : [];
            const uniqueUnits = new Set();
            if (Array.isArray(editedData)) {
              editedData.forEach(item => {
                if (item.don_vi_id) {
                  uniqueUnits.add(item.don_vi_id);
                }
              });
            }
            soLuong = uniqueUnits.size || result.total_danh_hieu || 0;
            donViText = soLuong > 0 ? `${soLuong} đơn vị` : '';
          } else if (loaiDeXuat === 'NCKH') {
            soLuong = result.total_thanh_tich || 0;
            donViText = soLuong > 0 ? `${soLuong} đề tài` : '';
          } else if (loaiDeXuat === 'NIEN_HAN') {
            soLuong = result.total_nien_han || 0;
            donViText = soLuong > 0 ? `${soLuong} quân nhân` : '';
          } else if (loaiDeXuat === 'CONG_HIEN') {
            // Đếm từ editedData
            const editedData = req.body?.data_cong_hien
              ? typeof req.body.data_cong_hien === 'string'
                ? JSON.parse(req.body.data_cong_hien)
                : req.body.data_cong_hien
              : [];
            soLuong = Array.isArray(editedData) ? editedData.length : 0;
            donViText = soLuong > 0 ? `${soLuong} quân nhân` : '';
          } else if (loaiDeXuat === 'HC_QKQT' || loaiDeXuat === 'KNC_VSNXD_QDNDVN') {
            // Đếm từ editedData
            const editedData = req.body?.data_danh_hieu
              ? typeof req.body.data_danh_hieu === 'string'
                ? JSON.parse(req.body.data_danh_hieu)
                : req.body.data_danh_hieu
              : [];
            soLuong = Array.isArray(editedData) ? editedData.length : 0;
            donViText = soLuong > 0 ? `${soLuong} quân nhân` : '';
          }

          // Tạo mô tả chi tiết
          let description = `Phê duyệt đề xuất ${typeName}`;

          if (nam) {
            description += ` năm ${nam}`;
          }

          if (nguoiDeXuat && nguoiDeXuat !== 'Chưa có dữ liệu') {
            description += ` do ${nguoiDeXuat} đề xuất`;
          }

          if (donViText) {
            description += ` (${donViText})`;
          }

          return description;
        }
      } catch (e) {
        console.error('Error creating APPROVE description:', e);
      }
      return `Phê duyệt đề xuất: ${proposalId}`;
    },
    REJECT: async (req, res, responseData) => {
      const proposalId = req.params?.id || null;
      const reason = req.body?.ghi_chu || req.body?.ly_do_tu_choi || req.body?.ly_do || '';

      // Lấy thông tin proposal từ responseData hoặc query từ DB
      let proposal = null;
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        proposal = data?.data?.proposal || data?.proposal || data?.data;
      } catch (e) {
        // Ignore parse error
      }

      // Nếu không có trong response, query từ DB
      if (!proposal && proposalId) {
        try {
          const { prisma } = require('../models');
          proposal = await prisma.bangDeXuat.findUnique({
            where: { id: proposalId },
            include: {
              NguoiDeXuat: {
                include: { QuanNhan: true },
              },
            },
          });
        } catch (error) {
          console.error('Error fetching proposal for reject log:', error);
        }
      }

      if (proposal) {
        const typeName = getLoaiDeXuatName(proposal.loai_de_xuat);

        const nguoiDeXuat =
          proposal.NguoiDeXuat?.QuanNhan?.ho_ten || proposal.NguoiDeXuat?.username || FALLBACK.UNKNOWN;
        const nam = proposal.nam || FALLBACK.UNKNOWN;

        // Đếm số lượng
        let soLuong = 0;
        let loaiSoLuong = '';

        if (proposal.loai_de_xuat === 'DON_VI_HANG_NAM') {
          const dataDanhHieu = Array.isArray(proposal.data_danh_hieu)
            ? proposal.data_danh_hieu
            : typeof proposal.data_danh_hieu === 'string'
            ? JSON.parse(proposal.data_danh_hieu)
            : [];
          soLuong = dataDanhHieu.length;
          loaiSoLuong = 'đơn vị';
        } else if (proposal.loai_de_xuat === 'NCKH') {
          const dataThanhTich = Array.isArray(proposal.data_thanh_tich)
            ? proposal.data_thanh_tich
            : typeof proposal.data_thanh_tich === 'string'
            ? JSON.parse(proposal.data_thanh_tich)
            : [];
          soLuong = dataThanhTich.length;
          loaiSoLuong = 'đề tài';
        } else if (proposal.loai_de_xuat === 'CONG_HIEN') {
          const dataCongHien = Array.isArray(proposal.data_cong_hien)
            ? proposal.data_cong_hien
            : typeof proposal.data_cong_hien === 'string'
            ? JSON.parse(proposal.data_cong_hien)
            : [];
          soLuong = dataCongHien.length;
          loaiSoLuong = 'đồng chí';
        } else if (
          proposal.loai_de_xuat === 'NIEN_HAN' ||
          proposal.loai_de_xuat === 'HC_QKQT' ||
          proposal.loai_de_xuat === 'KNC_VSNXD_QDNDVN'
        ) {
          const dataNienHan = Array.isArray(proposal.data_nien_han)
            ? proposal.data_nien_han
            : typeof proposal.data_nien_han === 'string'
            ? JSON.parse(proposal.data_nien_han)
            : [];
          soLuong = dataNienHan.length;
          loaiSoLuong = 'đồng chí';
        } else {
          // CA_NHAN_HANG_NAM
          const dataDanhHieu = Array.isArray(proposal.data_danh_hieu)
            ? proposal.data_danh_hieu
            : typeof proposal.data_danh_hieu === 'string'
            ? JSON.parse(proposal.data_danh_hieu)
            : [];
          soLuong = dataDanhHieu.length;
          loaiSoLuong = 'đồng chí';
        }

        const soLuongText = soLuong > 0 ? `gồm ${soLuong} ${loaiSoLuong}` : '';
        const reasonText = reason ? ` - Lý do: ${reason}` : '';

        return `Từ chối đề xuất ${typeName} (năm ${nam}) do ${nguoiDeXuat} đề xuất ${soLuongText}${reasonText}`;
      }

      // Fallback nếu không lấy được thông tin
      return `Từ chối đề xuất (không xác định được thông tin)${reason ? ` - Lý do: ${reason}` : ''}`;
    },
    DELETE: async (req, res, responseData) => {
      const proposalId = req.params?.id || null;

      // Lấy thông tin proposal từ responseData hoặc query từ DB
      let proposal = null;
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        proposal = data?.data?.proposal || data?.proposal || data?.data;
      } catch (e) {
        // Ignore parse error
      }

      // Nếu không có trong response, query từ DB
      if (!proposal && proposalId) {
        try {
          const { prisma } = require('../models');
          proposal = await prisma.bangDeXuat.findUnique({
            where: { id: proposalId },
            include: {
              NguoiDeXuat: {
                include: { QuanNhan: true },
              },
            },
          });
        } catch (error) {
          console.error('Error fetching proposal for delete log:', error);
        }
      }

      if (proposal) {
        const typeName = getLoaiDeXuatName(proposal.loai_de_xuat);
        const nguoiDeXuat =
          proposal.NguoiDeXuat?.QuanNhan?.ho_ten || proposal.NguoiDeXuat?.username || FALLBACK.UNKNOWN;
        const nam = proposal.nam || FALLBACK.UNKNOWN;

        return `Xóa đề xuất ${typeName} (năm ${nam}) do ${nguoiDeXuat} đề xuất`;
      }

      return `Xóa đề xuất (không xác định được thông tin)`;
    },
  },

  /**
   * Tạo mô tả cho annual-reward actions
   */
  'annual-rewards': {
    CREATE: async (req, res, responseData) => {
      const danhHieu = req.body?.danh_hieu || '';
      const nam = req.body?.nam || '';
      const personnelId = req.body?.personnel_id || req.body?.quan_nhan_id || null;

      // Lấy tên danh hiệu từ helper
      const { getDanhHieuName } = require('../constants/danhHieu.constants');
      const danhHieuName = getDanhHieuName(danhHieu);

      // Lấy tên quân nhân nếu có
      let hoTen = '';
      if (personnelId) {
        try {
          const { prisma } = require('../models');
          const personnel = await prisma.quanNhan.findUnique({
            where: { id: personnelId },
            select: { ho_ten: true },
          });
          hoTen = personnel?.ho_ten || '';
        } catch (error) {
          // Ignore error
        }
      }

      // Lấy từ response nếu có
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const reward = data?.data || data;
        if (reward?.QuanNhan?.ho_ten) {
          hoTen = reward.QuanNhan.ho_ten;
        }
      } catch (e) {
        // Ignore parse error
      }

      const danhHieuDisplay = danhHieuName || FALLBACK.UNKNOWN;
      const namDisplay = nam || FALLBACK.UNKNOWN;
      return `Tạo danh hiệu hằng năm: ${danhHieuDisplay}${
        hoTen ? ` cho quân nhân ${hoTen}` : ''
      } - Năm ${namDisplay}`;
    },
    UPDATE: async (req, res, responseData) => {
      const danhHieu = req.body?.danh_hieu || '';
      const nam = req.body?.nam || '';
      const rewardId = req.params?.id || null;

      // Lấy tên danh hiệu từ helper
      const { getDanhHieuName } = require('../constants/danhHieu.constants');
      const danhHieuName = getDanhHieuName(danhHieu);

      // Lấy thông tin từ response hoặc query từ DB
      let hoTen = '';
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const reward = data?.data || data;
        if (reward?.QuanNhan?.ho_ten) {
          hoTen = reward.QuanNhan.ho_ten;
        } else if (rewardId) {
          const { prisma } = require('../models');
          const rewardRecord = await prisma.danhHieuHangNam.findUnique({
            where: { id: rewardId },
            include: { QuanNhan: { select: { ho_ten: true } } },
          });
          hoTen = rewardRecord?.QuanNhan?.ho_ten || '';
        }
      } catch (e) {
        // Ignore parse error
      }

      const danhHieuDisplay = danhHieuName || FALLBACK.UNKNOWN;
      const namDisplay = nam || FALLBACK.UNKNOWN;
      return `Cập nhật danh hiệu hằng năm: ${danhHieuDisplay}${
        hoTen ? ` cho quân nhân ${hoTen}` : ''
      } - Năm ${namDisplay}`;
    },
    DELETE: async (req, res, responseData) => {
      const rewardId = req.params?.id || null;

      // Lấy thông tin từ response hoặc query từ DB
      let hoTen = '';
      let danhHieu = '';
      let nam = '';

      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const reward = data?.data || data;
        if (reward?.QuanNhan?.ho_ten) {
          hoTen = reward.QuanNhan.ho_ten;
        }
        if (reward?.danh_hieu) {
          danhHieu = reward.danh_hieu;
        }
        if (reward?.nam) {
          nam = reward.nam;
        }
      } catch (e) {
        // Ignore parse error
      }

      // Query từ DB nếu thiếu thông tin
      if ((!hoTen || !danhHieu) && rewardId) {
        try {
          const { prisma } = require('../models');
          const rewardRecord = await prisma.danhHieuHangNam.findUnique({
            where: { id: rewardId },
            include: { QuanNhan: { select: { ho_ten: true } } },
          });
          if (rewardRecord) {
            hoTen = rewardRecord.QuanNhan?.ho_ten || hoTen;
            danhHieu = rewardRecord.danh_hieu || danhHieu;
            nam = rewardRecord.nam || nam;
          }
        } catch (error) {
          // Ignore error
        }
      }

      const { getDanhHieuName } = require('../constants/danhHieu.constants');
      const danhHieuName = getDanhHieuName(danhHieu);

      if (hoTen && danhHieu) {
        return `Xóa danh hiệu hằng năm: ${danhHieuName} của quân nhân ${hoTen}${
          nam ? ` (năm ${nam})` : ''
        }`;
      }

      return `Xóa danh hiệu hằng năm (không xác định được thông tin)`;
    },
    BULK: (req, res, responseData) => {
      const danhHieu = req.body?.danh_hieu || '';
      const nam = req.body?.nam || '';
      let personnelCount = 0;
      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // Lấy số lượng từ request body
      try {
        const personnelIds =
          typeof req.body?.personnel_ids === 'string'
            ? JSON.parse(req.body.personnel_ids)
            : req.body?.personnel_ids;
        personnelCount = Array.isArray(personnelIds) ? personnelIds.length : 0;
      } catch (e) {
        // Ignore parse error
      }

      // Lấy số lượng thành công từ response
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const result = data?.data || data;
        successCount = result?.success || result?.successCount || 0;
        skippedCount = result?.skipped || 0;
        errorCount = result?.errors || 0;
      } catch (e) {
        // Ignore parse error
      }

      // Map danh hiệu sang tiếng Việt
      const { getDanhHieuName } = require('../constants/danhHieu.constants');
      const danhHieuName = getDanhHieuName(danhHieu) || FALLBACK.UNKNOWN;
      const namDisplay = nam || FALLBACK.UNKNOWN;

      let description = `Thêm đồng loạt danh hiệu hằng năm: ${danhHieuName} - Năm ${namDisplay}`;

      if (successCount > 0 || personnelCount > 0) {
        const parts = [];
        if (successCount > 0) {
          parts.push(`${successCount} thành công`);
        }
        if (skippedCount > 0) {
          parts.push(`${skippedCount} bỏ qua`);
        }
        if (errorCount > 0) {
          parts.push(`${errorCount} lỗi`);
        }
        if (parts.length > 0) {
          description += ` (${parts.join(', ')}`;
          if (personnelCount > 0) {
            description += ` / ${personnelCount} quân nhân`;
          }
          description += ')';
        } else if (personnelCount > 0) {
          description += ` (${personnelCount} quân nhân)`;
        }
      }

      return description;
    },
    IMPORT: (req, res, responseData) => {
      const fileName = req.file?.originalname || FALLBACK.NO_FILE;
      let successCount = 0;
      let failCount = 0;

      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const result = data?.data || data;
        successCount = result?.success || result?.successCount || result?.total || 0;
        failCount = result?.failed || result?.failCount || 0;

        if (successCount > 0 || failCount > 0) {
          return `Import danh hiệu hằng năm từ file: ${fileName} (${successCount} thành công${
            failCount > 0 ? `, ${failCount} thất bại` : ''
          })`;
        }
      } catch (e) {
        // Ignore parse error
      }

      return `Import danh hiệu hằng năm từ file: ${fileName}`;
    },
  },

  /**
   * Tạo mô tả cho position-history actions
   */
  'position-history': {
    CREATE: async (req, res, responseData) => {
      const personnelId = req.params?.personnelId || req.body?.personnel_id || null;
      const chucVuId = req.body?.chuc_vu_id || null;

      // Parse response data
      const parsedData = parseResponseData(responseData);
      const history = parsedData?.data || parsedData;

      // Lấy thông tin từ response
      let hoTen = history?.QuanNhan?.ho_ten || '';
      let tenChucVu = history?.ChucVu?.ten_chuc_vu || '';
      let tenDonVi = getUnitNameFromChucVu(history?.ChucVu);
      let ngayBatDau = history?.ngay_bat_dau || req.body?.ngay_bat_dau || '';
      let ngayKetThuc = history?.ngay_ket_thuc || req.body?.ngay_ket_thuc || '';

      // Query database nếu thiếu thông tin
      if ((!hoTen && personnelId) || (!tenChucVu && chucVuId)) {
        await withPrisma(async prisma => {
          if (!hoTen && personnelId) {
            hoTen = await queryPersonnelName(personnelId, prisma);
          }
          if (!tenChucVu && chucVuId) {
            const positionInfo = await queryPositionInfo(chucVuId, prisma);
            tenChucVu = positionInfo.tenChucVu;
            if (!tenDonVi) {
              tenDonVi = positionInfo.tenDonVi;
            }
          }
        });
      }

      // Tạo mô tả
      let description = 'Tạo lịch sử chức vụ';
      if (hoTen) {
        description += ` cho quân nhân: ${hoTen}`;
      }

      if (tenChucVu) {
        description += ` - Chức vụ: ${tenChucVu}`;
        if (tenDonVi) {
          description += ` (${tenDonVi})`;
        }
      }

      description += formatDateRange(ngayBatDau, ngayKetThuc);

      return description;
    },
    UPDATE: async (req, res, responseData) => {
      const historyId = req.params?.id || null;
      const chucVuId = req.body?.chuc_vu_id || null;

      // Parse response data
      const parsedData = parseResponseData(responseData);
      const history = parsedData?.data || parsedData;

      // Lấy thông tin từ response
      let hoTen = history?.QuanNhan?.ho_ten || '';
      let personnelId = history?.quan_nhan_id || null;
      let tenChucVu = history?.ChucVu?.ten_chuc_vu || '';
      let tenDonVi = getUnitNameFromChucVu(history?.ChucVu);
      let ngayBatDau = history?.ngay_bat_dau || req.body?.ngay_bat_dau || '';
      let ngayKetThuc =
        history?.ngay_ket_thuc !== undefined
          ? history.ngay_ket_thuc
          : req.body?.ngay_ket_thuc !== undefined
          ? req.body.ngay_ket_thuc
          : undefined;

      // Query database nếu thiếu thông tin
      if ((!hoTen || !tenChucVu) && historyId) {
        await withPrisma(async prisma => {
          // Query lịch sử chức vụ để lấy personnelId và chucVuId
          const historyRecord = await prisma.lichSuChucVu.findUnique({
            where: { id: historyId },
            select: {
              quan_nhan_id: true,
              chuc_vu_id: true,
            },
          });

          if (historyRecord) {
            if (!personnelId) {
              personnelId = historyRecord.quan_nhan_id;
            }
            const finalChucVuId = chucVuId || historyRecord.chuc_vu_id;

            if (!hoTen && personnelId) {
              hoTen = await queryPersonnelName(personnelId, prisma);
            }

            if (!tenChucVu && finalChucVuId) {
              const positionInfo = await queryPositionInfo(finalChucVuId, prisma);
              tenChucVu = positionInfo.tenChucVu;
              if (!tenDonVi) {
                tenDonVi = positionInfo.tenDonVi;
              }
            }
          }
        });
      }

      // Tạo mô tả
      let description = 'Cập nhật lịch sử chức vụ';
      if (hoTen) {
        description += ` cho quân nhân: ${hoTen}`;
      }

      if (tenChucVu) {
        description += ` - Chức vụ: ${tenChucVu}`;
        if (tenDonVi) {
          description += ` (${tenDonVi})`;
        }
      }

      description += formatDateRange(ngayBatDau, ngayKetThuc);

      return description;
    },
    DELETE: async (req, res, responseData) => {
      const historyId = req.params?.id || null;

      // Parse response data (service trả về thông tin trước khi xóa)
      const parsedData = parseResponseData(responseData);
      const result = parsedData?.data || parsedData;

      // Lấy thông tin từ response
      let hoTen = result?.QuanNhan?.ho_ten || '';
      let tenChucVu = result?.ChucVu?.ten_chuc_vu || '';
      let tenDonVi = getUnitNameFromChucVu(result?.ChucVu);

      // Query database nếu thiếu thông tin
      if ((!hoTen || !tenChucVu) && historyId) {
        await withPrisma(async prisma => {
          const history = await prisma.lichSuChucVu.findUnique({
            where: { id: historyId },
            include: {
              QuanNhan: { select: { ho_ten: true } },
              ChucVu: {
                include: {
                  CoQuanDonVi: { select: { ten_don_vi: true } },
                  DonViTrucThuoc: {
                    include: {
                      CoQuanDonVi: { select: { ten_don_vi: true } },
                    },
                  },
                },
              },
            },
          });

          if (history) {
            if (!hoTen && history.QuanNhan?.ho_ten) {
              hoTen = history.QuanNhan.ho_ten;
            }
            if (!tenChucVu && history.ChucVu?.ten_chuc_vu) {
              tenChucVu = history.ChucVu.ten_chuc_vu;
            }
            if (!tenDonVi) {
              tenDonVi = getUnitNameFromChucVu(history.ChucVu);
            }
          }
        });
      }

      // Tạo mô tả
      let description = 'Xóa lịch sử chức vụ';
      if (hoTen) {
        description += ` của quân nhân: ${hoTen}`;
      }

      if (tenChucVu) {
        description += ` - Chức vụ: ${tenChucVu}`;
        if (tenDonVi) {
          description += ` (${tenDonVi})`;
        }
      }

      if (!hoTen && !tenChucVu) {
        description += ` (không xác định được thông tin)`;
      }

      return description;
    },
  },

  /**
   * Tạo mô tả cho accounts actions
   */
  accounts: {
    CREATE: (req, res, responseData) => {
      const username = req.body?.username || FALLBACK.UNKNOWN;
      const role = req.body?.role || '';
      const roleName = ROLE_NAMES[role] || role;

      // Lấy họ tên từ response nếu có
      let hoTen = '';
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        hoTen = data?.data?.QuanNhan?.ho_ten || data?.data?.ho_ten || '';
      } catch (e) {
        // Ignore
      }

      let description = `Tạo tài khoản: ${username}`;
      if (hoTen && hoTen !== username) {
        description = `Tạo tài khoản cho ${hoTen} (${username})`;
      }
      if (roleName) {
        description += ` - Vai trò: ${roleName}`;
      }
      return description;
    },
    UPDATE: async (req, res, responseData) => {
      const accountId = req.params?.id;
      const role = req.body?.role || '';
      const hasPassword = !!req.body?.password;
      const roleName = ROLE_NAMES[role] || role;

      // Lấy thông tin từ response hoặc query từ DB
      let username = req.body?.username || '';
      let hoTen = '';

      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        username = data?.data?.username || username;
        hoTen = data?.data?.QuanNhan?.ho_ten || '';
      } catch (e) {
        // Ignore
      }

      // Query từ DB nếu thiếu thông tin
      if ((!username || !hoTen) && accountId) {
        try {
          const { prisma } = require('../models');
          const account = await prisma.taiKhoan.findUnique({
            where: { id: accountId },
            select: {
              username: true,
              QuanNhan: { select: { ho_ten: true } },
            },
          });
          if (account) {
            username = username || account.username;
            hoTen = hoTen || account.QuanNhan?.ho_ten || '';
          }
        } catch (error) {
          // Ignore
        }
      }

      // Tạo mô tả
      let displayName = hoTen && hoTen !== username ? `${hoTen} (${username})` : username || FALLBACK.UNKNOWN;
      let description = `Cập nhật tài khoản: ${displayName}`;

      const changes = [];
      if (roleName) {
        changes.push(`vai trò: ${roleName}`);
      }
      if (hasPassword) {
        changes.push('đặt lại mật khẩu');
      }
      if (changes.length > 0) {
        description += ` - ${changes.join(', ')}`;
      }

      return description;
    },
    DELETE: async (req, res, responseData) => {
      const accountId = req.params?.id;
      let username = '';
      let hoTen = '';

      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        username = data?.data?.username || '';
        hoTen = data?.data?.QuanNhan?.ho_ten || data?.data?.ho_ten || '';
      } catch (e) {
        // Ignore
      }

      // Query từ DB nếu thiếu thông tin
      if ((!username || !hoTen) && accountId) {
        try {
          const { prisma } = require('../models');
          const account = await prisma.taiKhoan.findUnique({
            where: { id: accountId },
            select: {
              username: true,
              QuanNhan: { select: { ho_ten: true } },
            },
          });
          if (account) {
            username = username || account.username;
            hoTen = hoTen || account.QuanNhan?.ho_ten || '';
          }
        } catch (error) {
          // Ignore
        }
      }

      // Tạo mô tả
      if (hoTen && username) {
        return `Xóa tài khoản: ${hoTen} (${username})`;
      } else if (username) {
        return `Xóa tài khoản: ${username}`;
      }
      return `Xóa tài khoản (không xác định được thông tin)`;
    },
    RESET_PASSWORD: async (req, res, responseData) => {
      const accountId = req.body?.account_id;

      // Nếu có account_id, query username từ DB
      if (accountId) {
        try {
          const { prisma } = require('../models');
          const account = await prisma.taiKhoan.findUnique({
            where: { id: accountId },
            select: {
              username: true,
              QuanNhan: { select: { ho_ten: true } },
            },
          });

          if (account) {
            const displayName = account.QuanNhan?.ho_ten || account.username;
            return `Đặt lại mật khẩu cho tài khoản: ${displayName} (${account.username})`;
          }
        } catch (error) {
          console.error('Error fetching account for reset password log:', error);
        }
      }

      // Fallback nếu không query được
      const username = req.body?.username || FALLBACK.UNKNOWN;
      return `Đặt lại mật khẩu cho tài khoản: ${username}`;
    },
  },

  /**
   * Tạo mô tả cho personnel actions
   */
  personnel: {
    CREATE: (req, res, responseData) => {
      const cccd = req.body?.cccd || '';

      // Lấy họ tên từ response (service có thể set ho_ten = cccd khi tạo mới)
      let hoTen = req.body?.ho_ten || '';
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        hoTen = data?.data?.ho_ten || data?.data?.QuanNhan?.ho_ten || hoTen;
      } catch (e) {
        // Ignore
      }

      // Nếu họ tên = cccd hoặc không có, chỉ hiển thị cccd
      if (!hoTen || hoTen === cccd) {
        return `Tạo quân nhân mới với CCCD: ${cccd || FALLBACK.UNKNOWN}`;
      }

      return `Tạo quân nhân: ${hoTen}${cccd ? ` (CCCD: ${cccd})` : ''}`;
    },
    UPDATE: (req, res, responseData) => {
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const personnel = data?.data || data;
        const hoTen = personnel?.ho_ten || req.body?.ho_ten || FALLBACK.NO_NAME;

        // Kiểm tra xem có chuyển đơn vị không
        if (personnel?.unitTransferInfo) {
          const { oldUnit, newUnit } = personnel.unitTransferInfo;
          const oldUnitName = oldUnit?.ten_don_vi || FALLBACK.NO_UNIT;
          const newUnitName = newUnit?.ten_don_vi || FALLBACK.NO_UNIT;
          return `Chuyển đơn vị quân nhân: ${hoTen} từ "${oldUnitName}" sang "${newUnitName}"`;
        }

        return `Cập nhật thông tin quân nhân: ${hoTen}`;
      } catch (e) {
        const hoTen = req.body?.ho_ten || FALLBACK.NO_NAME;
        return `Cập nhật thông tin quân nhân: ${hoTen}`;
      }
    },
    DELETE: async (req, res, responseData) => {
      const personnelId = req.params?.id;
      let hoTen = '';

      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        hoTen = data?.data?.ho_ten || '';
      } catch (e) {
        // Ignore
      }

      // Query từ DB nếu thiếu thông tin
      if (!hoTen && personnelId) {
        try {
          const { prisma } = require('../models');
          const personnel = await prisma.quanNhan.findUnique({
            where: { id: personnelId },
            select: { ho_ten: true },
          });
          hoTen = personnel?.ho_ten || '';
        } catch (error) {
          // Ignore
        }
      }

      if (hoTen) {
        return `Xóa quân nhân: ${hoTen}`;
      }
      return `Xóa quân nhân (không xác định được thông tin)`;
    },
    IMPORT: (req, res, responseData) => {
      const fileName = req.file?.originalname || FALLBACK.NO_FILE;
      let successCount = 0;
      let failCount = 0;

      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const result = data?.data || data;
        successCount = result?.success || result?.successCount || result?.total || 0;
        failCount = result?.failed || result?.failCount || 0;

        if (successCount > 0 || failCount > 0) {
          return `Import quân nhân từ file: ${fileName} (${successCount} thành công${
            failCount > 0 ? `, ${failCount} thất bại` : ''
          })`;
        }
      } catch (e) {
        // Ignore parse error
      }

      return `Import quân nhân từ file: ${fileName}`;
    },
    EXPORT: (req, res, responseData) => {
      return `Xuất dữ liệu quân nhân ra Excel`;
    },
  },

  /**
   * Tạo mô tả cho units actions
   */
  units: {
    CREATE: (req, res, responseData) => {
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const unit = data?.data || data;
        if (unit?.ten_don_vi) {
          return `Tạo đơn vị trực thuộc: ${unit.ten_don_vi}`;
        }
        if (unit?.ten_co_quan_don_vi) {
          return `Tạo cơ quan đơn vị: ${unit.ten_co_quan_don_vi}`;
        }
      } catch (e) {
        // Ignore parse error
      }
      // Kiểm tra từ request body để phân biệt
      if (req.body?.ten_don_vi) {
        return `Tạo đơn vị trực thuộc: ${req.body.ten_don_vi}`;
      }
      if (req.body?.ten_co_quan_don_vi) {
        return `Tạo cơ quan đơn vị: ${req.body.ten_co_quan_don_vi}`;
      }
      return `Tạo đơn vị: ${req.body?.ten_don_vi || req.body?.ten_co_quan_don_vi || FALLBACK.UNKNOWN}`;
    },
    UPDATE: (req, res, responseData) => {
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const unit = data?.data || data;
        if (unit?.ten_don_vi) {
          return `Cập nhật đơn vị trực thuộc: ${unit.ten_don_vi}`;
        }
        if (unit?.ten_co_quan_don_vi) {
          return `Cập nhật cơ quan đơn vị: ${unit.ten_co_quan_don_vi}`;
        }
      } catch (e) {
        // Ignore parse error
      }
      // Kiểm tra từ request body để phân biệt
      if (req.body?.ten_don_vi) {
        return `Cập nhật đơn vị trực thuộc: ${req.body.ten_don_vi}`;
      }
      if (req.body?.ten_co_quan_don_vi) {
        return `Cập nhật cơ quan đơn vị: ${req.body.ten_co_quan_don_vi}`;
      }
      return `Cập nhật đơn vị: ${req.body?.ten_don_vi || req.body?.ten_co_quan_don_vi || FALLBACK.UNKNOWN}`;
    },
    DELETE: (req, res, responseData) => {
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const unit = data?.data || data;
        if (unit?.ten_don_vi) {
          return `Xóa đơn vị trực thuộc: ${unit.ten_don_vi}`;
        }
        if (unit?.ten_co_quan_don_vi) {
          return `Xóa cơ quan đơn vị: ${unit.ten_co_quan_don_vi}`;
        }
      } catch (e) {
        // Ignore parse error
      }
      return `Xóa đơn vị (không xác định được thông tin)`;
    },
  },

  /**
   * Tạo mô tả cho positions actions
   */
  positions: {
    CREATE: async (req, res, responseData) => {
      const tenChucVu = req.body?.ten_chuc_vu || FALLBACK.NO_POSITION;
      const unitId = req.body?.unit_id || null;
      const ngayHienTai = formatDate(new Date());

      // Parse response data
      const parsedData = parseResponseData(responseData);
      const position = parsedData?.data || parsedData;

      // Lấy thông tin từ response
      let finalTenChucVu = position?.ten_chuc_vu || tenChucVu;
      let tenDonVi = getUnitNameFromChucVu(position);

      // Query database nếu thiếu thông tin đơn vị
      if (!tenDonVi && unitId) {
        await withPrisma(async prisma => {
          tenDonVi = await getUnitNameFromUnitId(unitId, prisma);
        });
      }

      let description = `Tạo chức vụ: ${finalTenChucVu}`;
      if (tenDonVi) {
        description += ` (${tenDonVi})`;
      }
      if (ngayHienTai) {
        description += ` - Ngày: ${ngayHienTai}`;
      }
      return description;
    },
    UPDATE: async (req, res, responseData) => {
      const positionId = req.params?.id;
      const tenChucVu = req.body?.ten_chuc_vu || null;
      const ngayHienTai = formatDate(new Date());

      // Parse response data
      const parsedData = parseResponseData(responseData);
      const position = parsedData?.data || parsedData;

      // Lấy thông tin từ response
      let finalTenChucVu = position?.ten_chuc_vu || tenChucVu;
      let tenDonVi = getUnitNameFromChucVu(position);

      // Query database nếu thiếu thông tin
      if ((!finalTenChucVu || !tenDonVi) && positionId) {
        await withPrisma(async prisma => {
          const positionInfo = await queryPositionInfo(positionId, prisma);
          if (!finalTenChucVu) {
            finalTenChucVu = positionInfo.tenChucVu || FALLBACK.NO_POSITION;
          }
          if (!tenDonVi) {
            tenDonVi = positionInfo.tenDonVi;
          }
        });
      }

      let description = `Cập nhật chức vụ: ${finalTenChucVu || FALLBACK.NO_POSITION}`;
      if (tenDonVi) {
        description += ` (${tenDonVi})`;
      }
      if (ngayHienTai) {
        description += ` - Ngày: ${ngayHienTai}`;
      }
      return description;
    },
    DELETE: async (req, res, responseData) => {
      const positionId = req.params?.id;
      const ngayHienTai = formatDate(new Date());

      // Parse response data (service trả về thông tin trước khi xóa)
      const parsedData = parseResponseData(responseData);
      const position = parsedData?.data || parsedData;

      // Lấy thông tin từ response
      let tenChucVu = position?.ten_chuc_vu || '';
      let tenDonVi = getUnitNameFromChucVu(position);

      // Query database nếu thiếu thông tin
      if ((!tenChucVu || !tenDonVi) && positionId) {
        await withPrisma(async prisma => {
          const positionInfo = await queryPositionInfo(positionId, prisma);
          if (!tenChucVu) {
            tenChucVu = positionInfo.tenChucVu;
          }
          if (!tenDonVi) {
            tenDonVi = positionInfo.tenDonVi;
          }
        });
      }

      let description = 'Xóa chức vụ';
      if (tenChucVu) {
        description += `: ${tenChucVu}`;
        if (tenDonVi) {
          description += ` (${tenDonVi})`;
        }
      } else {
        description += ` (không xác định được thông tin)`;
      }
      if (ngayHienTai) {
        description += ` - Ngày: ${ngayHienTai}`;
      }

      return description;
    },
  },

  /**
   * Tạo mô tả cho decisions actions
   */
  decisions: {
    CREATE: (req, res, responseData) => {
      const soQuyetDinh = req.body?.so_quyet_dinh || FALLBACK.UNKNOWN;
      const loaiQuyetDinh = req.body?.loai_quyet_dinh || '';
      const loaiNames = {
        DANH_HIEU_HANG_NAM: 'Danh hiệu hằng năm',
        DANH_HIEU_NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
        CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
        BKBQP: 'Bằng khen Bộ Quốc phòng',
        CSTDTQ: 'Chiến sĩ thi đua toàn quốc',
      };
      const loaiName = loaiNames[loaiQuyetDinh] || loaiQuyetDinh || '';
      return `Tạo quyết định: ${soQuyetDinh}${loaiName ? ` (${loaiName})` : ''}`;
    },
    UPDATE: (req, res, responseData) => {
      const soQuyetDinh = req.body?.so_quyet_dinh || FALLBACK.UNKNOWN;
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const decision = data?.data || data;
        if (decision?.so_quyet_dinh) {
          return `Cập nhật quyết định: ${decision.so_quyet_dinh}`;
        }
      } catch (e) {
        // Ignore parse error
      }
      return `Cập nhật quyết định: ${soQuyetDinh}`;
    },
    DELETE: (req, res, responseData) => {
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const decision = data?.data || data;
        if (decision?.so_quyet_dinh) {
          return `Xóa quyết định: ${decision.so_quyet_dinh}`;
        }
      } catch (e) {
        // Ignore parse error
      }
      return `Xóa quyết định (không xác định được thông tin)`;
    },
  },

  /**
   * Tạo mô tả cho scientific-achievements actions
   */
  'scientific-achievements': {
    CREATE: async (req, res, responseData) => {
      const loai = req.body?.loai || '';
      const moTa = req.body?.mo_ta || '';
      const nam = req.body?.nam || '';
      const personnelId = req.body?.personnel_id || req.body?.quan_nhan_id || null;

      const loaiName = ACHIEVEMENT_TYPE_NAMES[loai] || loai || FALLBACK.UNKNOWN;

      // Lấy tên quân nhân nếu có
      let hoTen = '';
      if (personnelId) {
        try {
          const { prisma } = require('../models');
          const personnel = await prisma.quanNhan.findUnique({
            where: { id: personnelId },
            select: { ho_ten: true },
          });
          hoTen = personnel?.ho_ten || '';
        } catch (error) {
          // Ignore error
        }
      }

      // Lấy từ response nếu có
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const achievement = data?.data || data;
        if (achievement?.QuanNhan?.ho_ten) {
          hoTen = achievement.QuanNhan.ho_ten;
        }
      } catch (e) {
        // Ignore parse error
      }

      return `Tạo thành tích khoa học: ${loaiName}${hoTen ? ` cho quân nhân ${hoTen}` : ''}${
        moTa ? ` - ${moTa}` : ''
      }${nam ? ` (Năm ${nam})` : ''}`;
    },
    UPDATE: async (req, res, responseData) => {
      const loai = req.body?.loai || '';
      const moTa = req.body?.mo_ta || '';
      const nam = req.body?.nam || '';
      const achievementId = req.params?.id || null;

      const loaiName = ACHIEVEMENT_TYPE_NAMES[loai] || loai || FALLBACK.UNKNOWN;

      // Lấy thông tin từ response hoặc query từ DB
      let hoTen = '';
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const achievement = data?.data || data;
        if (achievement?.QuanNhan?.ho_ten) {
          hoTen = achievement.QuanNhan.ho_ten;
        } else if (achievementId) {
          const { prisma } = require('../models');
          const achievementRecord = await prisma.thanhTichKhoaHoc.findUnique({
            where: { id: achievementId },
            include: { QuanNhan: { select: { ho_ten: true } } },
          });
          hoTen = achievementRecord?.QuanNhan?.ho_ten || '';
        }
      } catch (e) {
        // Ignore parse error
      }

      return `Cập nhật thành tích khoa học: ${loaiName}${hoTen ? ` cho quân nhân ${hoTen}` : ''}${
        moTa ? ` - ${moTa}` : ''
      }${nam ? ` (Năm ${nam})` : ''}`;
    },
    DELETE: async (req, res, responseData) => {
      const achievementId = req.params?.id || null;

      // Lấy thông tin từ response hoặc query từ DB
      let hoTen = '';
      let loai = '';
      let moTa = '';

      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const achievement = data?.data || data;
        if (achievement?.QuanNhan?.ho_ten) {
          hoTen = achievement.QuanNhan.ho_ten;
        }
        if (achievement?.loai) {
          loai = achievement.loai;
        }
        if (achievement?.mo_ta) {
          moTa = achievement.mo_ta;
        }
      } catch (e) {
        // Ignore parse error
      }

      // Query từ DB nếu thiếu thông tin
      if ((!hoTen || !loai) && achievementId) {
        try {
          const { prisma } = require('../models');
          const achievementRecord = await prisma.thanhTichKhoaHoc.findUnique({
            where: { id: achievementId },
            include: { QuanNhan: { select: { ho_ten: true } } },
          });
          if (achievementRecord) {
            hoTen = achievementRecord.QuanNhan?.ho_ten || hoTen;
            loai = achievementRecord.loai || loai;
            moTa = achievementRecord.mo_ta || moTa;
          }
        } catch (error) {
          // Ignore error
        }
      }

      const loaiName = ACHIEVEMENT_TYPE_NAMES[loai] || loai || FALLBACK.UNKNOWN;

      if (hoTen && loai) {
        return `Xóa thành tích khoa học: ${loaiName}${
          moTa ? ` - ${moTa}` : ''
        } của quân nhân ${hoTen}`;
      }

      return `Xóa thành tích khoa học (không xác định được thông tin)`;
    },
  },

  /**
   * Tạo mô tả cho auth actions
   */
  auth: {
    LOGIN: (req, res, responseData) => {
      const username = req.body?.username || FALLBACK.UNKNOWN;
      return `Đăng nhập hệ thống: ${username}`;
    },
    LOGOUT: (req, res, responseData) => {
      return `Đăng xuất khỏi hệ thống`;
    },
    CHANGE_PASSWORD: (req, res, responseData) => {
      return `Đổi mật khẩu tài khoản`;
    },
  },

  /**
   * Tạo mô tả cho adhoc-awards actions
   */
  'adhoc-awards': {
    CREATE: async (req, res, responseData) => {
      const type = req.body?.type === 'CA_NHAN' ? 'cá nhân' : 'tập thể';
      const awardForm = req.body?.awardForm || FALLBACK.UNKNOWN;
      const year = req.body?.year || '';
      const personnelId = req.body?.personnelId || null;
      const unitId = req.body?.unitId || null;
      const unitType = req.body?.unitType || null;

      // Lấy thông tin từ response
      let hoTen = '';
      let tenDonVi = '';

      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const award = data?.data || data;

        if (award?.QuanNhan?.ho_ten) {
          hoTen = award.QuanNhan.ho_ten;
        } else if (award?.CoQuanDonVi) {
          // CoQuanDonVi có thể có ten_don_vi hoặc ten_co_quan_don_vi tùy cách map
          tenDonVi = award.CoQuanDonVi.ten_don_vi || award.CoQuanDonVi.ten_co_quan_don_vi || '';
        } else if (award?.DonViTrucThuoc?.ten_don_vi) {
          tenDonVi = award.DonViTrucThuoc.ten_don_vi;
        }
      } catch (e) {
        // Ignore parse error
      }

      // Nếu không có từ response, query từ DB
      if (!hoTen && !tenDonVi) {
        try {
          const { prisma } = require('../models');

          if (type === 'cá nhân' && personnelId) {
            const personnel = await prisma.quanNhan.findUnique({
              where: { id: personnelId },
              select: { ho_ten: true },
            });
            hoTen = personnel?.ho_ten || '';
          } else if (type === 'tập thể' && unitId && unitType) {
            if (unitType === 'CO_QUAN_DON_VI') {
              const unit = await prisma.coQuanDonVi.findUnique({
                where: { id: unitId },
                select: { ten_don_vi: true },
              });
              tenDonVi = unit?.ten_don_vi || '';
            } else if (unitType === 'DON_VI_TRUC_THUOC') {
              const unit = await prisma.donViTrucThuoc.findUnique({
                where: { id: unitId },
                select: { ten_don_vi: true },
              });
              tenDonVi = unit?.ten_don_vi || '';
            }
          }
        } catch (error) {
          console.error('Error fetching adhoc award info for log:', error);
        }
      }

      let description = `Tạo khen thưởng đột xuất ${type}: ${awardForm}`;

      if (hoTen) {
        description += ` cho quân nhân ${hoTen}`;
      } else if (tenDonVi) {
        description += ` cho đơn vị ${tenDonVi}`;
      }

      if (year) {
        description += ` (năm ${year})`;
      }

      return description;
    },
    UPDATE: async (req, res, responseData) => {
      const awardId = req.params?.id || null;
      let awardForm = req.body?.awardForm || FALLBACK.UNKNOWN;
      let hoTen = '';
      let tenDonVi = '';

      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const award = data?.data || data;

        if (award?.hinh_thuc_khen_thuong) {
          awardForm = award.hinh_thuc_khen_thuong;
        }

        if (award?.QuanNhan?.ho_ten) {
          hoTen = award.QuanNhan.ho_ten;
        } else if (award?.CoQuanDonVi) {
          // CoQuanDonVi có thể có ten_don_vi hoặc ten_co_quan_don_vi tùy cách map
          tenDonVi = award.CoQuanDonVi.ten_don_vi || award.CoQuanDonVi.ten_co_quan_don_vi || '';
        } else if (award?.DonViTrucThuoc?.ten_don_vi) {
          tenDonVi = award.DonViTrucThuoc.ten_don_vi;
        }
      } catch (e) {
        // Ignore parse error
      }

      // Query từ DB nếu thiếu thông tin
      if (!hoTen && !tenDonVi && awardId) {
        try {
          const { prisma } = require('../models');
          const award = await prisma.khenThuongDotXuat.findUnique({
            where: { id: awardId },
            include: {
              QuanNhan: { select: { ho_ten: true } },
              CoQuanDonVi: { select: { ten_don_vi: true } },
              DonViTrucThuoc: { select: { ten_don_vi: true } },
            },
          });

          if (award) {
            if (award.QuanNhan?.ho_ten) {
              hoTen = award.QuanNhan.ho_ten;
            } else if (award.CoQuanDonVi?.ten_don_vi) {
              tenDonVi = award.CoQuanDonVi.ten_don_vi;
            } else if (award.DonViTrucThuoc?.ten_don_vi) {
              tenDonVi = award.DonViTrucThuoc.ten_don_vi;
            }
          }
        } catch (error) {
          // Ignore error
        }
      }

      let description = `Cập nhật khen thưởng đột xuất: ${awardForm}`;

      if (hoTen) {
        description += ` cho quân nhân ${hoTen}`;
      } else if (tenDonVi) {
        description += ` cho đơn vị ${tenDonVi}`;
      }

      return description;
    },
    DELETE: async (req, res, responseData) => {
      const awardId = req.params?.id || null;
      let awardForm = FALLBACK.UNKNOWN;
      let hoTen = '';
      let tenDonVi = '';

      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const award = data?.data || data;

        if (award?.hinh_thuc_khen_thuong) {
          awardForm = award.hinh_thuc_khen_thuong;
        }

        if (award?.QuanNhan?.ho_ten) {
          hoTen = award.QuanNhan.ho_ten;
        } else if (award?.CoQuanDonVi) {
          // CoQuanDonVi có thể có ten_don_vi hoặc ten_co_quan_don_vi tùy cách map
          tenDonVi = award.CoQuanDonVi.ten_don_vi || award.CoQuanDonVi.ten_co_quan_don_vi || '';
        } else if (award?.DonViTrucThuoc?.ten_don_vi) {
          tenDonVi = award.DonViTrucThuoc.ten_don_vi;
        }
      } catch (e) {
        // Ignore parse error
      }

      // Query từ DB nếu thiếu thông tin
      if (!hoTen && !tenDonVi && awardId) {
        try {
          const { prisma } = require('../models');
          const award = await prisma.khenThuongDotXuat.findUnique({
            where: { id: awardId },
            include: {
              QuanNhan: { select: { ho_ten: true } },
              CoQuanDonVi: { select: { ten_don_vi: true } },
              DonViTrucThuoc: { select: { ten_don_vi: true } },
            },
          });

          if (award) {
            awardForm = award.hinh_thuc_khen_thuong || awardForm;
            if (award.QuanNhan?.ho_ten) {
              hoTen = award.QuanNhan.ho_ten;
            } else if (award.CoQuanDonVi?.ten_don_vi) {
              tenDonVi = award.CoQuanDonVi.ten_don_vi;
            } else if (award.DonViTrucThuoc?.ten_don_vi) {
              tenDonVi = award.DonViTrucThuoc.ten_don_vi;
            }
          }
        } catch (error) {
          // Ignore error
        }
      }

      let description = `Xóa khen thưởng đột xuất: ${awardForm}`;

      if (hoTen) {
        description += ` của quân nhân ${hoTen}`;
      } else if (tenDonVi) {
        description += ` của đơn vị ${tenDonVi}`;
      }

      return description;
    },
  },
  awards: {
    BULK: async (req, res, responseData) => {
      try {
        const data = parseResponseData(responseData);
        const result = data?.data || data || {};

        // Lấy thông tin từ request body
        const type = req.body?.type || '';
        const nam = req.body?.nam || '';
        const selectedPersonnel = req.body?.selected_personnel || [];
        const selectedUnits = req.body?.selected_units || [];
        const titleData = req.body?.title_data || [];

        // Parse JSON strings nếu cần
        let parsedSelectedPersonnel = selectedPersonnel;
        let parsedSelectedUnits = selectedUnits;
        let parsedTitleData = titleData;

        if (typeof selectedPersonnel === 'string') {
          try {
            parsedSelectedPersonnel = JSON.parse(selectedPersonnel);
          } catch (e) {
            // Ignore
          }
        }

        if (typeof selectedUnits === 'string') {
          try {
            parsedSelectedUnits = JSON.parse(selectedUnits);
          } catch (e) {
            // Ignore
          }
        }

        if (typeof titleData === 'string') {
          try {
            parsedTitleData = JSON.parse(titleData);
          } catch (e) {
            // Ignore
          }
        }

        // Map loại khen thưởng sang tên tiếng Việt (bổ sung thêm cho bulk awards)
        const bulkTypeNames = {
          CA_NHAN_HANG_NAM: 'Danh hiệu cá nhân hằng năm',
          DON_VI_HANG_NAM: 'Danh hiệu đơn vị hằng năm',
          NCKH: 'Thành tích khoa học (ĐTKH/SKKH)',
          NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
          HC_QKQT: 'Huy chương Quân kỳ Quyết thắng',
          KNC_VSNXD_QDNDVN: 'Kỷ niệm chương VSNXD QĐNDVN',
          CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
        };

        const typeName = bulkTypeNames[type] || type || 'Khen thưởng';

        // Lấy số lượng từ result hoặc từ request
        const importedCount = result?.importedCount || 0;
        const errorCount = result?.errorCount || 0;
        const affectedPersonnelIds = result?.affectedPersonnelIds || [];

        // Đếm số lượng thực tế
        let soLuong = 0;
        let donViText = '';
        let danhHieuText = '';

        if (type === 'DON_VI_HANG_NAM') {
          soLuong = Array.isArray(parsedSelectedUnits) ? parsedSelectedUnits.length : 0;
          donViText = soLuong > 0 ? `${soLuong} đơn vị` : '';

          // Lấy danh hiệu từ titleData
          if (Array.isArray(parsedTitleData) && parsedTitleData.length > 0) {
            const danhHieus = new Set();
            parsedTitleData.forEach(item => {
              if (item.danh_hieu) {
                danhHieus.add(getDanhHieuName(item.danh_hieu));
              }
            });
            if (danhHieus.size > 0) {
              danhHieuText = Array.from(danhHieus).join(', ');
            }
          }
        } else {
          soLuong = Array.isArray(parsedSelectedPersonnel)
            ? parsedSelectedPersonnel.length
            : Array.isArray(affectedPersonnelIds)
              ? affectedPersonnelIds.length
              : importedCount || 0;
          donViText = soLuong > 0 ? `${soLuong} quân nhân` : '';

          // Lấy danh hiệu từ titleData
          if (Array.isArray(parsedTitleData) && parsedTitleData.length > 0) {
            if (type === 'NCKH') {
              const loais = new Set();
              parsedTitleData.forEach(item => {
                if (item.loai) {
                  loais.add(getDanhHieuName(item.loai));
                }
              });
              if (loais.size > 0) {
                danhHieuText = Array.from(loais).join(', ');
              }
            } else if (type === 'HC_QKQT' || type === 'KNC_VSNXD_QDNDVN') {
              // Với HC_QKQT và KNC_VSNXD_QDNDVN, không cần thêm danhHieuText
              // vì typeName đã là tên tiếng Việt đầy đủ rồi
              danhHieuText = '';
            } else {
              const danhHieus = new Set();
              parsedTitleData.forEach(item => {
                if (item.danh_hieu) {
                  danhHieus.add(getDanhHieuName(item.danh_hieu));
                }
              });
              if (danhHieus.size > 0) {
                danhHieuText = Array.from(danhHieus).join(', ');
              }
            }
          }
        }

        // Tạo mô tả chi tiết
        let description = `Thêm khen thưởng đồng loạt: ${typeName}`;

        if (nam) {
          description += ` năm ${nam}`;
        }

        if (danhHieuText) {
          description += ` - ${danhHieuText}`;
        }

        if (donViText) {
          description += ` (${donViText})`;
        }

        if (importedCount > 0) {
          description += ` - Thành công: ${importedCount}`;
        }

        if (errorCount > 0) {
          description += `, Lỗi: ${errorCount}`;
        }

        return description;
      } catch (error) {
        console.error('Error creating BULK awards description:', error);
        return 'Thêm khen thưởng đồng loạt';
      }
    },
  },
};

/**
 * Get log description helper
 * @param {string} resource - Resource name (proposals, annual-rewards, etc.)
 * @param {string} action - Action name (CREATE, UPDATE, DELETE, etc.)
 * @returns {Function} Function to create description
 */
const getLogDescription = (resource, action) => {
  const resourceHelper = createLogDescription[resource];
  if (!resourceHelper) {
    return (req, res, responseData) => `${action} ${resource}`;
  }

  const actionHelper = resourceHelper[action];
  if (!actionHelper) {
    return (req, res, responseData) => `${action} ${resource}`;
  }

  return actionHelper;
};

/**
 * Get resource ID from request
 */
const getResourceId = {
  fromParams:
    (paramName = 'id') =>
    req => {
      return req.params?.[paramName] || null;
    },
  fromResponse: () => (req, res, responseData) => {
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      return data?.data?.id || data?.id || null;
    } catch {
      return null;
    }
  },
  fromBody:
    (fieldName = 'id') =>
    req => {
      return req.body?.[fieldName] || null;
    },
};

module.exports = {
  getLogDescription,
  getResourceId,
  createLogDescription,
};
