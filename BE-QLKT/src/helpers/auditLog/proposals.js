/**
 * Proposal audit log descriptions
 */

const { FALLBACK } = require('./constants');
const { getLoaiDeXuatName } = require('../../constants/danhHieu.constants');

const proposals = {
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
          const { prisma } = require('../../models');
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
        } catch (dbError) {}
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
    } catch (e) {}
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
        const { prisma } = require('../../models');
        proposal = await prisma.bangDeXuat.findUnique({
          where: { id: proposalId },
          include: {
            NguoiDeXuat: {
              include: { QuanNhan: true },
            },
          },
        });
      } catch (error) {}
    }

    if (proposal) {
      const typeName = getLoaiDeXuatName(proposal.loai_de_xuat);

      const nguoiDeXuat =
        proposal.NguoiDeXuat?.QuanNhan?.ho_ten ||
        proposal.NguoiDeXuat?.username ||
        FALLBACK.UNKNOWN;
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
        const { prisma } = require('../../models');
        proposal = await prisma.bangDeXuat.findUnique({
          where: { id: proposalId },
          include: {
            NguoiDeXuat: {
              include: { QuanNhan: true },
            },
          },
        });
      } catch (error) {}
    }

    if (proposal) {
      const typeName = getLoaiDeXuatName(proposal.loai_de_xuat);
      const nguoiDeXuat =
        proposal.NguoiDeXuat?.QuanNhan?.ho_ten ||
        proposal.NguoiDeXuat?.username ||
        FALLBACK.UNKNOWN;
      const nam = proposal.nam || FALLBACK.UNKNOWN;

      return `Xóa đề xuất ${typeName} (năm ${nam}) do ${nguoiDeXuat} đề xuất`;
    }

    return `Xóa đề xuất (không xác định được thông tin)`;
  },
};

module.exports = { proposals };
