import { prisma } from '../../models';
import ExcelJS from 'exceljs';
import { sanitizeRowData } from '../../helpers/excelHelper';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { DANH_HIEU_HCBVTQ } from '../../constants/danhHieu.constants';

/**
 * Lấy tất cả danh hiệu hằng năm (để Admin quản lý)
 * @param {Object} filters - Bộ lọc (don_vi_id, nam, danh_hieu)
 * @param {number} page - Trang
 * @param {number} limit - Số lượng mỗi trang
 * @returns {Promise<Object>} - Danh sách danh hiệu
 */
async function getAllAwards(
  filters: Record<string, unknown> = {},
  page: number = 1,
  limit: number = 50
) {
  try {
    const don_vi_id = filters.don_vi_id as string | undefined;
    const nam = filters.nam;
    const danh_hieu = filters.danh_hieu as string | undefined;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (nam) where.nam = parseInt(String(nam), 10);
    if (danh_hieu) where.danh_hieu = danh_hieu;

    const [awards, total] = await Promise.all([
      prisma.danhHieuHangNam.findMany({
        where,
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: {
                include: {
                  CoQuanDonVi: true,
                },
              },
              ChucVu: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: [{ nam: 'desc' }, { QuanNhan: { ho_ten: 'asc' } }],
      }),
      prisma.danhHieuHangNam.count({ where }),
    ]);

    let filteredAwards = awards;
    if (don_vi_id) {
      filteredAwards = awards.filter(
        a => (a.QuanNhan.co_quan_don_vi_id || a.QuanNhan.don_vi_truc_thuoc_id) === don_vi_id
      );
    }

    const awardsWithNCKH = await Promise.all(
      filteredAwards.map(async a => {
        const thanhTichList = await prisma.thanhTichKhoaHoc.findMany({
          where: {
            quan_nhan_id: a.QuanNhan.id,
            nam: a.nam,
          },
          select: {
            id: true,
            loai: true,
            mo_ta: true,
          },
        });
        return {
          id: a.id,
          cccd: a.QuanNhan.cccd,
          ho_ten: a.QuanNhan.ho_ten,
          don_vi: (a.QuanNhan.DonViTrucThuoc || a.QuanNhan.CoQuanDonVi)?.ten_don_vi || '-',
          chuc_vu: a.chuc_vu,
          cap_bac: a.cap_bac,
          nam: a.nam,
          danh_hieu: a.danh_hieu,
          nhan_bkbqp: a.nhan_bkbqp,
          so_quyet_dinh_bkbqp: a.so_quyet_dinh_bkbqp,
          nhan_cstdtq: a.nhan_cstdtq,
          so_quyet_dinh_cstdtq: a.so_quyet_dinh_cstdtq,
          nhan_bkttcp: a.nhan_bkttcp,
          so_quyet_dinh_bkttcp: a.so_quyet_dinh_bkttcp,
          thanh_tich_khoa_hoc: thanhTichList,
        };
      })
    );

    return {
      awards: awardsWithNCKH,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Xuất file Excel tổng hợp tất cả khen thưởng
 * @param {Object} filters - Bộ lọc
 * @returns {Promise<Buffer>} - Buffer của file Excel
 */
async function exportAllAwardsExcel(filters: Record<string, unknown> = {}) {
  try {
    const don_vi_id = filters.don_vi_id as string | undefined;
    const nam = filters.nam;
    const danh_hieu = filters.danh_hieu as string | undefined;
    const where: Record<string, unknown> = {};
    if (nam) where.nam = parseInt(String(nam), 10);
    if (danh_hieu) where.danh_hieu = danh_hieu;

    const awards = await prisma.danhHieuHangNam.findMany({
      where,
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: {
              include: {
                CoQuanDonVi: true,
              },
            },
            ChucVu: true,
          },
        },
      },
      orderBy: [{ nam: 'desc' }, { QuanNhan: { ho_ten: 'asc' } }],
    });

    let filteredAwards = awards;
    if (don_vi_id) {
      filteredAwards = awards.filter(
        a => (a.QuanNhan.co_quan_don_vi_id || a.QuanNhan.don_vi_truc_thuoc_id) === don_vi_id
      );
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh Sách Khen Thưởng');

    sheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
      { header: 'Đơn Vị', key: 'don_vi', width: 25 },
      { header: 'Chức Vụ', key: 'chuc_vu', width: 25 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Danh Hiệu', key: 'danh_hieu', width: 15 },
      { header: 'BKBQP', key: 'bkbqp', width: 10 },
      { header: 'Số QĐ BKBQP', key: 'so_qd_bkbqp', width: 20 },
      { header: 'CSTĐTQ', key: 'cstdtq', width: 10 },
      { header: 'Số QĐ CSTĐTQ', key: 'so_qd_cstdtq', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFD3D3D3' },
    };
    sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Format CCCD as Text to preserve leading zeros
    sheet.getColumn(2).numFmt = '@';

    filteredAwards.forEach((award, index) => {
      sheet.addRow(sanitizeRowData({
        stt: index + 1,
        cccd: award.QuanNhan.cccd,
        ho_ten: award.QuanNhan.ho_ten,
        don_vi: (award.QuanNhan.DonViTrucThuoc || award.QuanNhan.CoQuanDonVi)?.ten_don_vi ?? '-',
        chuc_vu: award.QuanNhan.ChucVu.ten_chuc_vu,
        nam: award.nam,
        danh_hieu: award.danh_hieu || '',
        bkbqp: award.nhan_bkbqp ? 'X' : '',
        so_qd_bkbqp: award.so_quyet_dinh_bkbqp || '',
        cstdtq: award.nhan_cstdtq ? 'X' : '',
        so_qd_cstdtq: award.so_quyet_dinh_cstdtq || '',
        bkttcp: award.nhan_bkttcp ? 'X' : '',
        so_qd_bkttcp: award.so_quyet_dinh_bkttcp || '',
      }));
    });

    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    throw error;
  }
}

async function getAwardsStatistics() {
  try {
    const decisionsByType = await prisma.fileQuyetDinh.groupBy({
      by: ['loai_khen_thuong'],
      where: {
        loai_khen_thuong: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
    });

    const proposalsByType = await prisma.bangDeXuat.groupBy({
      by: ['loai_de_xuat'],
      _count: {
        id: true,
      },
    });

    const [
      annualRewardCount,
      contributionMedalCount,
      tenureMedalCount,
      militaryFlagCount,
      commemorationMedalCount,
      scientificAchievementCount,
      unitAnnualRewardCount,
    ] = await Promise.all([
      prisma.danhHieuHangNam.count({
        where: { danh_hieu: { not: null, notIn: Object.values(DANH_HIEU_HCBVTQ) } },
      }),
      prisma.khenThuongHCBVTQ.count(),
      prisma.khenThuongHCCSVV.count(),
      prisma.huanChuongQuanKyQuyetThang.count(),
      prisma.kyNiemChuongVSNXDQDNDVN.count(),
      prisma.thanhTichKhoaHoc.count(),
      prisma.danhHieuDonViHangNam.count({
        where: { danh_hieu: { not: null } },
      }),
    ]);

    const decisionsMap = {};
    decisionsByType.forEach(item => {
      decisionsMap[item.loai_khen_thuong] = item._count.id;
    });

    const proposalsMap = {};
    proposalsByType.forEach(item => {
      proposalsMap[item.loai_de_xuat] = item._count.id;
    });

    const statistics = {
      CA_NHAN_HANG_NAM: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.CA_NHAN_HANG_NAM] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.CA_NHAN_HANG_NAM] || 0,
        danh_hieu: annualRewardCount,
      },
      DON_VI_HANG_NAM: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.DON_VI_HANG_NAM] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.DON_VI_HANG_NAM] || 0,
        don_vi: unitAnnualRewardCount,
      },
      NIEN_HAN: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.NIEN_HAN] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.NIEN_HAN] || 0,
        khen_thuong: tenureMedalCount,
      },
      HC_QKQT: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.HC_QKQT] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.HC_QKQT] || 0,
        khen_thuong: militaryFlagCount,
      },
      KNC_VSNXD_QDNDVN: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.KNC_VSNXD_QDNDVN] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.KNC_VSNXD_QDNDVN] || 0,
        khen_thuong: commemorationMedalCount,
      },
      CONG_HIEN: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.CONG_HIEN] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.CONG_HIEN] || 0,
        khen_thuong: contributionMedalCount,
      },
      DOT_XUAT: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.DOT_XUAT] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.DOT_XUAT] || 0,
      },
      NCKH: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.NCKH] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.NCKH] || 0,
        thanh_tich: scientificAchievementCount,
      },
    };

    return statistics;
  } catch (error) {
    throw error;
  }
}

export {
  getAllAwards,
  exportAllAwardsExcel,
  getAwardsStatistics,
};
