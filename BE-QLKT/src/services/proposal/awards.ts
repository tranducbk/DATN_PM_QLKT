import { prisma } from '../../models';
import ExcelJS from 'exceljs';
import profileService from '../profile.service';
import { ValidationError } from '../../middlewares/errorHandler';
import { applyThinBordersToGrid } from '../../helpers/excelTemplateHelper';
import { parseCCCD, calculateContinuousCSTDCS } from './helpers';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { DANH_HIEU_HCBVTQ } from '../../constants/danhHieu.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';

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
      sheet.addRow({
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
      });
    });

    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    throw error;
  }
}

/**
 * Xuất file mẫu Excel để import khen thưởng
 * @returns {Promise<Buffer>} - Buffer của file Excel mẫu
 */
async function exportAwardsTemplate() {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('KhenThuong');

    sheet.columns = [
      { header: 'CCCD (Bắt buộc)', key: 'cccd', width: 15 },
      { header: 'Năm (Bắt buộc)', key: 'nam', width: 12 },
      { header: 'Danh Hiệu (CSTDCS/CSTT)', key: 'danh_hieu', width: 20 },
      { header: 'BKBQP (Đánh X)', key: 'nhan_bkbqp', width: 15 },
      { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
      { header: 'CSTĐTQ (Đánh X)', key: 'nhan_cstdtq', width: 15 },
      { header: 'Số QĐ CSTĐTQ', key: 'so_quyet_dinh_cstdtq', width: 20 },
      { header: 'BKTTCP (Đánh X)', key: 'nhan_bkttcp', width: 15 },
      { header: 'Số QĐ BKTTCP', key: 'so_quyet_dinh_bkttcp', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' },
    };
    sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Format CCCD as Text to preserve leading zeros
    sheet.getColumn(1).numFmt = '@';

    sheet.addRow({
      cccd: '001234567890',
      nam: 2024,
      danh_hieu: 'CSTDCS',
      nhan_bkbqp: 'X',
      so_quyet_dinh_bkbqp: '123/QĐ-BQP',
      nhan_cstdtq: '',
      so_quyet_dinh_cstdtq: '',
      nhan_bkttcp: 'X',
      so_quyet_dinh_bkttcp: '456/QĐ-BQP',
    });

    const colCount = sheet.columns?.length ?? 9;
    applyThinBordersToGrid(sheet, 2, colCount);

    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    throw error;
  }
}

/**
 * Import khen thưởng từ file Excel
 * @param {Buffer} excelBuffer - Buffer của file Excel
 * @returns {Promise<Object>} - Kết quả import
 */
async function importAwards(excelBuffer, adminId) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer);

    const sheet = workbook.getWorksheet('KhenThuong');
    if (!sheet) {
      throw new ValidationError('Không tìm thấy sheet "KhenThuong" trong file Excel');
    }

    const awards = [];
    const errors = [];
    const importedUnitsMap = new Map();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const cccd = parseCCCD(row.getCell(1).value);
      const nam = parseInt(String(row.getCell(2).value), 10);
      const danh_hieu = row.getCell(3).value?.toString().trim() || null;
      const nhan_bkbqp = row.getCell(4).value?.toString().toUpperCase() === 'X';
      const so_quyet_dinh_bkbqp = row.getCell(5).value?.toString().trim() || null;
      const nhan_cstdtq = row.getCell(6).value?.toString().toUpperCase() === 'X';
      const so_quyet_dinh_cstdtq = row.getCell(7).value?.toString().trim() || null;
      const nhan_bkttcp = row.getCell(8).value?.toString().toUpperCase() === 'X';
      const so_quyet_dinh_bkttcp = row.getCell(9).value?.toString().trim() || null;

      if (!cccd || !nam) {
        errors.push(`Row ${rowNumber}: CCCD và Năm là bắt buộc`);
        return;
      }

      awards.push({
        cccd,
        nam,
        danh_hieu,
        nhan_bkbqp,
        so_quyet_dinh_bkbqp,
        nhan_cstdtq,
        so_quyet_dinh_cstdtq,
        nhan_bkttcp,
        so_quyet_dinh_bkttcp,
      });
    });

    if (errors.length > 0) {
      throw new ValidationError(`Lỗi validate dữ liệu: ${errors.join(', ')}`);
    }

    let imported = 0;
    const importErrors = [];
    const importWarnings = [];
    const affectedPersonnelIds = new Set();

    for (const award of awards) {
      try {
        const quanNhan = await prisma.quanNhan.findUnique({
          where: { cccd: award.cccd },
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: {
              include: {
                CoQuanDonVi: true,
              },
            },
            DanhHieuHangNam: {
              orderBy: { nam: 'asc' },
            },
            ThanhTichKhoaHoc: true,
          },
        });

        if (!quanNhan) {
          importErrors.push(`CCCD ${award.cccd}: Không tìm thấy quân nhân`);
          continue;
        }

        // Soft validation: warn when import rows imply medals without prerequisite streaks / NCKH.
        const cstdcsLienTuc = calculateContinuousCSTDCS(quanNhan.DanhHieuHangNam, award.nam);
        const nckhCount = quanNhan.ThanhTichKhoaHoc.length;

        if (award.nhan_bkbqp && cstdcsLienTuc < 2) {
          importWarnings.push(
            `CCCD ${
              award.cccd
            }: Đề xuất BKBQP nhưng chỉ có ${cstdcsLienTuc}/2 năm CSTDCS liên tục. Thiếu ${
              2 - cstdcsLienTuc
            } năm.`
          );
        }

        if (award.nhan_cstdtq) {
          if (cstdcsLienTuc < 3) {
            importWarnings.push(
              `CCCD ${
                award.cccd
              }: Đề xuất CSTDTQ nhưng chỉ có ${cstdcsLienTuc}/3 năm CSTDCS liên tục. Thiếu ${
                3 - cstdcsLienTuc
              } năm.`
            );
          } else if (nckhCount === 0) {
            importWarnings.push(
              `CCCD ${award.cccd}: Đề xuất CSTDTQ nhưng chưa có ĐTKH/SKKH được duyệt.`
            );
          }
        }

        if (award.nhan_bkttcp) {
          if (cstdcsLienTuc < 7) {
            importWarnings.push(
              `CCCD ${
                award.cccd
              }: Đề xuất BKTTCP nhưng chỉ có ${cstdcsLienTuc}/7 năm CSTDCS liên tục. Thiếu ${
                7 - cstdcsLienTuc
              } năm.`
            );
          } else if (nckhCount === 0) {
            importWarnings.push(
              `CCCD ${award.cccd}: Đề xuất BKTTCP nhưng chưa có ĐTKH/SKKH được duyệt.`
            );
          }
        }

        await prisma.danhHieuHangNam.upsert({
          where: {
            quan_nhan_id_nam: {
              quan_nhan_id: quanNhan.id,
              nam: award.nam,
            },
          },
          update: {
            danh_hieu: award.danh_hieu,
            nhan_bkbqp: award.nhan_bkbqp,
            so_quyet_dinh_bkbqp: award.so_quyet_dinh_bkbqp,
            nhan_cstdtq: award.nhan_cstdtq,
            so_quyet_dinh_cstdtq: award.so_quyet_dinh_cstdtq,
            nhan_bkttcp: award.nhan_bkttcp,
            so_quyet_dinh_bkttcp: award.so_quyet_dinh_bkttcp,
          },
          create: {
            quan_nhan_id: quanNhan.id,
            nam: award.nam,
            danh_hieu: award.danh_hieu,
            nhan_bkbqp: award.nhan_bkbqp,
            so_quyet_dinh_bkbqp: award.so_quyet_dinh_bkbqp,
            nhan_cstdtq: award.nhan_cstdtq,
            so_quyet_dinh_cstdtq: award.so_quyet_dinh_cstdtq,
            nhan_bkttcp: award.nhan_bkttcp,
            so_quyet_dinh_bkttcp: award.so_quyet_dinh_bkttcp,
          },
        });

        const primaryUnitId = quanNhan.co_quan_don_vi_id || quanNhan.don_vi_truc_thuoc_id;
        const unitKey = `${primaryUnitId}_${award.nam}`;
        if (!importedUnitsMap.has(unitKey)) {
          importedUnitsMap.set(unitKey, {
            don_vi_id: primaryUnitId,
            don_vi_name: (quanNhan.DonViTrucThuoc || quanNhan.CoQuanDonVi)?.ten_don_vi ?? '-',
            nam: award.nam,
            award_type: 'Danh hiệu',
          });
        }

        imported++;
        affectedPersonnelIds.add(quanNhan.id);
      } catch (error) {
        importErrors.push(`CCCD ${award.cccd}: ${error.message}`);
      }
    }

    // Re-run annual eligibility for every personnel touched by the import.
    let recalculateSuccess = 0;
    let recalculateErrors = 0;

    for (const personnelId of affectedPersonnelIds) {
      try {
        await profileService.recalculateAnnualProfile(personnelId);
        recalculateSuccess++;
      } catch (e) {
        recalculateErrors++;
        console.error(`recalculateAnnualProfile failed for personnelId=${personnelId}:`, e);
      }
    }

    return {
      message:
        importWarnings.length > 0
          ? `Đã thêm thành công thành công ${imported} bản ghi nhưng có ${importWarnings.length} cảnh báo về điều kiện khen thưởng.`
          : 'Đã thêm khen thưởng thành công',
      importedUnits: Array.from(importedUnitsMap.values()),
      result: {
        total: awards.length,
        imported,
        failed: awards.length - imported,
        errors: importErrors.length > 0 ? importErrors : null,
        warnings: importWarnings.length > 0 ? importWarnings : null,
        recalculated_profiles: recalculateSuccess,
        recalculate_errors: recalculateErrors,
      },
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Thống kê khen thưởng theo loại
 * @returns {Promise<Object>} - Thống kê theo từng loại khen thưởng
 */
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

    const danhHieuHangNamCount = await prisma.danhHieuHangNam.count({
      where: {
        danh_hieu: {
          not: null,
          notIn: Object.values(DANH_HIEU_HCBVTQ),
        },
      },
    });

    const congHienCount = await prisma.khenThuongCongHien.count();

    const hccsvvCount = await prisma.khenThuongHCCSVV.count();

    const hcQuanCongCount = await prisma.huanChuongQuanKyQuyetThang.count();

    const hcVSNXDCount = await prisma.kyNiemChuongVSNXDQDNDVN.count();

    const thanhTichKhoaHocCount = await prisma.thanhTichKhoaHoc.count();

    const donViHangNamCount = await prisma.danhHieuDonViHangNam.count({
      where: {
        danh_hieu: {
          not: null,
        },
      },
    });

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
        danh_hieu: danhHieuHangNamCount,
      },
      DON_VI_HANG_NAM: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.DON_VI_HANG_NAM] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.DON_VI_HANG_NAM] || 0,
        don_vi: donViHangNamCount,
      },
      NIEN_HAN: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.NIEN_HAN] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.NIEN_HAN] || 0,
        khen_thuong: hccsvvCount,
      },
      HC_QKQT: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.HC_QKQT] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.HC_QKQT] || 0,
        khen_thuong: hcQuanCongCount,
      },
      KNC_VSNXD_QDNDVN: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.KNC_VSNXD_QDNDVN] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.KNC_VSNXD_QDNDVN] || 0,
        khen_thuong: hcVSNXDCount,
      },
      CONG_HIEN: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.CONG_HIEN] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.CONG_HIEN] || 0,
        khen_thuong: congHienCount,
      },
      DOT_XUAT: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.DOT_XUAT] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.DOT_XUAT] || 0,
      },
      NCKH: {
        quyet_dinh: decisionsMap[PROPOSAL_TYPES.NCKH] || 0,
        de_xuat: proposalsMap[PROPOSAL_TYPES.NCKH] || 0,
        thanh_tich: thanhTichKhoaHocCount,
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
  exportAwardsTemplate,
  importAwards,
  getAwardsStatistics,
};
