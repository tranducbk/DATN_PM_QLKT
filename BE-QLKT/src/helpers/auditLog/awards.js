/**
 * Award-related audit log descriptions
 * Includes: annual-rewards, adhoc-awards, awards (bulk)
 */

const { FALLBACK, parseResponseData } = require('./constants');
const { getDanhHieuName } = require('../../constants/danhHieu.constants');

const annualRewards = {
  CREATE: async (req, res, responseData) => {
    const danhHieu = req.body?.danh_hieu || '';
    const nam = req.body?.nam || '';
    const personnelId = req.body?.personnel_id || req.body?.quan_nhan_id || null;

    // Lấy tên danh hiệu từ helper
    const danhHieuName = getDanhHieuName(danhHieu);

    // Lấy tên quân nhân nếu có
    let hoTen = '';
    if (personnelId) {
      try {
        const { prisma } = require('../../models');
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
    const danhHieuName = getDanhHieuName(danhHieu);

    // Lấy thông tin từ response hoặc query từ DB
    let hoTen = '';
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const reward = data?.data || data;
      if (reward?.QuanNhan?.ho_ten) {
        hoTen = reward.QuanNhan.ho_ten;
      } else if (rewardId) {
        const { prisma } = require('../../models');
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
        const { prisma } = require('../../models');
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
};

const adhocAwards = {
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
        const { prisma } = require('../../models');

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
      } catch (error) {}
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
        const { prisma } = require('../../models');
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
        const { prisma } = require('../../models');
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
};

const awards = {
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
      return 'Thêm khen thưởng đồng loạt';
    }
  },
};

module.exports = {
  'annual-rewards': annualRewards,
  'adhoc-awards': adhocAwards,
  awards,
};
