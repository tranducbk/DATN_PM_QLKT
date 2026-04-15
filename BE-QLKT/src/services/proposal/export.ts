import { promises as fs } from 'fs';
import { prisma } from '../../models';
import ExcelJS from 'exceljs';
import path from 'path';
import { NotFoundError } from '../../middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';

/**
 * Xuất file mẫu Excel cho Manager
 * @param {number} userId - ID của tài khoản Manager
 * @param {string} type - Loại đề xuất: 'HANG_NAM' hoặc 'NIEN_HAN'
 * @returns {Promise<Buffer>} - Buffer của file Excel
 */
async function exportTemplate(userId, type = 'HANG_NAM') {
  try {
    const user = await prisma.taiKhoan.findUnique({
      where: { id: userId },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: {
              include: {
                CoQuanDonVi: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.QuanNhan) {
      throw new NotFoundError('Thông tin quân nhân của tài khoản này');
    }

    const donViId = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;

    const quanNhanList = await prisma.quanNhan.findMany({
      where: {
        OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
      },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
        ChucVu: true,
      },
      orderBy: { ho_ten: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();

    if (
      type === PROPOSAL_TYPES.NIEN_HAN ||
      type === PROPOSAL_TYPES.HC_QKQT ||
      type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
    ) {
      return await exportTemplateNienHan(workbook, quanNhanList);
    }

    const sheetQuanNhan = workbook.addWorksheet('QuanNhan');

    sheetQuanNhan.columns = [
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
      { header: 'Mã Đơn Vị', key: 'ma_don_vi', width: 15 },
      { header: 'Tên Chức Vụ', key: 'ten_chuc_vu', width: 25 },
    ];

    sheetQuanNhan.getRow(1).font = { bold: true };
    sheetQuanNhan.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };
    sheetQuanNhan.getRow(1).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    // Format CCCD as Text to preserve leading zeros
    sheetQuanNhan.getColumn(1).numFmt = '@';

    quanNhanList.forEach(qn => {
      sheetQuanNhan.addRow({
        cccd: qn.cccd,
        ho_ten: qn.ho_ten,
        ma_don_vi: (qn.DonViTrucThuoc || qn.CoQuanDonVi)?.ma_don_vi || '',
        ten_chuc_vu: qn.ChucVu.ten_chuc_vu,
      });
    });

    const sheetDanhHieu = workbook.addWorksheet('DanhHieuHangNam');

    sheetDanhHieu.columns = [
      { header: 'CCCD (Bắt buộc)', key: 'cccd', width: 15 },
      { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
      { header: 'Năm (Bắt buộc)', key: 'nam', width: 12 },
      { header: 'CSTDCS (Đánh X)', key: 'cstdcs', width: 18 },
      { header: 'CSTT (Đánh X)', key: 'cstt', width: 15 },
      { header: 'BKBQP (Đánh X)', key: 'bkbqp', width: 18 },
      { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
      { header: 'CSTDTQ (Đánh X)', key: 'cstdtq', width: 18 },
      { header: 'Số QĐ CSTDTQ', key: 'so_quyet_dinh_cstdtq', width: 20 },
    ];

    sheetDanhHieu.getRow(1).font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    sheetDanhHieu.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' },
    };
    sheetDanhHieu.getRow(1).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    // Format CCCD as Text to preserve leading zeros
    sheetDanhHieu.getColumn(1).numFmt = '@';

    sheetDanhHieu.addRow({
      cccd: 'Ví dụ: 001234567890',
      ho_ten: 'Nguyễn Văn A',
      nam: 2024,
      cstdcs: 'X',
      cstt: '',
      bkbqp: 'X',
      so_quyet_dinh_bkbqp: '123/QĐ-BQP',
      cstdtq: '',
      so_quyet_dinh_cstdtq: '',
    });

    const sheetThanhTich = workbook.addWorksheet('ThanhTichKhoaHoc');

    sheetThanhTich.columns = [
      { header: 'CCCD (Bắt buộc)', key: 'cccd', width: 15 },
      { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
      { header: 'Năm (Bắt buộc)', key: 'nam', width: 12 },
      { header: 'Loại (ĐTKH/SKKH)', key: 'loai', width: 18 },
      { header: 'Mô tả (Bắt buộc)', key: 'mo_ta', width: 40 },
      { header: 'Trạng thái (APPROVED/PENDING)', key: 'status', width: 25 },
    ];

    sheetThanhTich.getRow(1).font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    sheetThanhTich.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFC000' },
    };
    sheetThanhTich.getRow(1).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    // Format CCCD as Text to preserve leading zeros
    sheetThanhTich.getColumn(1).numFmt = '@';

    sheetThanhTich.addRow({
      cccd: 'Ví dụ: 001234567890',
      ho_ten: 'Nguyễn Văn A',
      nam: 2024,
      loai: 'NCKH',
      mo_ta: 'Nghiên cứu về trí tuệ nhân tạo trong quân sự',
      status: PROPOSAL_STATUS.APPROVED,
    });

    // Column D: restrict `loai` to the approved science-achievement codes.
    sheetThanhTich.getColumn(4).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"NCKH,SKKH"'],
          showErrorMessage: true,
          errorStyle: 'error',
          errorTitle: 'Giá trị không hợp lệ',
          error: 'Vui lòng chọn NCKH hoặc SKKH',
        };
      }
    });

    // Column F: restrict import status to APPROVED / PENDING.
    sheetThanhTich.getColumn(6).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"APPROVED,PENDING"'],
          showErrorMessage: true,
          errorStyle: 'error',
          errorTitle: 'Giá trị không hợp lệ',
          error: 'Vui lòng chọn APPROVED hoặc PENDING',
        };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    throw error;
  }
}

/**
 * Xuất file mẫu Excel cho Đề xuất Niên hạn
 * @param {ExcelJS.Workbook} workbook - Workbook
 * @param {Array} quanNhanList - Danh sách quân nhân
 * @returns {Promise<Buffer>} - Buffer của file Excel
 */
async function exportTemplateNienHan(workbook, quanNhanList) {
  const sheetQuanNhan = workbook.addWorksheet('QuanNhan');

  sheetQuanNhan.columns = [
    { header: 'CCCD', key: 'cccd', width: 15 },
    { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
    { header: 'Ngày nhập ngũ', key: 'ngay_nhap_ngu', width: 15 },
    { header: 'Mã Đơn Vị', key: 'ma_don_vi', width: 15 },
    { header: 'Tên Chức Vụ', key: 'ten_chuc_vu', width: 25 },
  ];

  sheetQuanNhan.getRow(1).font = { bold: true };
  sheetQuanNhan.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' },
  };
  sheetQuanNhan.getRow(1).alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };
  sheetQuanNhan.getColumn(1).numFmt = '@';

  quanNhanList.forEach(qn => {
    sheetQuanNhan.addRow({
      cccd: qn.cccd,
      ho_ten: qn.ho_ten,
      ngay_nhap_ngu: qn.ngay_nhap_ngu ? new Date(qn.ngay_nhap_ngu).toLocaleDateString('vi-VN') : '',
      ma_don_vi: qn.DonVi.ma_don_vi,
      ten_chuc_vu: qn.ChucVu.ten_chuc_vu,
    });
  });

  const sheetNienHan = workbook.addWorksheet('NienHan');

  sheetNienHan.columns = [
    { header: 'CCCD (Bắt buộc)', key: 'cccd', width: 15 },
    { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
    { header: 'HCCSVV Hạng Ba (X)', key: 'hccsvv_hang_ba', width: 20 },
    { header: 'HCCSVV Hạng Nhì (X)', key: 'hccsvv_hang_nhi', width: 20 },
    { header: 'HCCSVV Hạng Nhất (X)', key: 'hccsvv_hang_nhat', width: 20 },
    { header: 'HCBVTQ Hạng Ba (X)', key: 'hcbvtq_hang_ba', width: 20 },
    { header: 'HCBVTQ Hạng Nhì (X)', key: 'hcbvtq_hang_nhi', width: 20 },
    { header: 'HCBVTQ Hạng Nhất (X)', key: 'hcbvtq_hang_nhat', width: 20 },
  ];

  sheetNienHan.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheetNienHan.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFED7D31' },
  };
  sheetNienHan.getRow(1).alignment = {
    horizontal: 'center',
    vertical: 'middle',
  };
  sheetNienHan.getColumn(1).numFmt = '@';

  sheetNienHan.addRow({
    cccd: 'Ví dụ: 001234567890',
    ho_ten: 'Nguyễn Văn A',
    hccsvv_hang_ba: 'X',
    hccsvv_hang_nhi: '',
    hccsvv_hang_nhat: '',
    hcbvtq_hang_ba: '',
    hcbvtq_hang_nhi: '',
    hcbvtq_hang_nhat: '',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Lấy file PDF của đề xuất
 * @param {string} filename - Tên file PDF
 * @returns {Promise<Object>} - Đường dẫn file
 */
async function getPdfFile(filename) {
  try {
    // Try storage/proposals first (proposal attachments)
    const storagePath = path.join(__dirname, '..', '..', '..', 'storage', 'proposals');
    let filePath = path.join(storagePath, filename);

    try {
      await fs.access(filePath);
      return {
        filePath,
        filename,
      };
    } catch {
      // Fall back to uploads/decisions when file not found at primary path
      const decisionsPath = path.join(__dirname, '..', '..', '..', 'uploads', 'decisions');
      filePath = path.join(decisionsPath, filename);

      try {
        await fs.access(filePath);
        return {
          filePath,
          filename,
        };
      } catch {
        throw new NotFoundError('File PDF');
      }
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Xuất file Excel đề xuất đã được gửi (để Admin download)
 * @param {number} proposalId - ID của đề xuất
 * @returns {Promise<Buffer>} - Buffer của file Excel
 */
async function downloadProposalExcel(proposalId) {
  try {
    const proposal = await prisma.bangDeXuat.findUnique({
      where: { id: proposalId },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: true,
          },
        },
        NguoiDeXuat: {
          include: { QuanNhan: true },
        },
      },
    });

    if (!proposal) {
      throw new NotFoundError('Đề xuất');
    }

    const workbook = new ExcelJS.Workbook();

    const sheetDanhHieu = workbook.addWorksheet('DanhHieuHangNam');
    sheetDanhHieu.columns = [
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
      { header: 'Năm', key: 'nam', width: 12 },
      { header: 'Danh hiệu', key: 'danh_hieu', width: 15 },
      { header: 'BKBQP', key: 'nhan_bkbqp', width: 10 },
      { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
      { header: 'CSTDTQ', key: 'nhan_cstdtq', width: 10 },
      { header: 'Số QĐ CSTDTQ', key: 'so_quyet_dinh_cstdtq', width: 20 },
      { header: 'BKTTCP', key: 'nhan_bkttcp', width: 10 },
      { header: 'Số QĐ BKTTCP', key: 'so_quyet_dinh_bkttcp', width: 20 },
    ];

    sheetDanhHieu.getRow(1).font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    sheetDanhHieu.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' },
    };

    // Format CCCD as Text to preserve leading zeros
    sheetDanhHieu.getColumn(1).numFmt = '@';

    const danhHieuData = Array.isArray(proposal.data_danh_hieu)
      ? (proposal.data_danh_hieu as Array<Record<string, unknown>>)
      : [];
    danhHieuData.forEach(item => {
      sheetDanhHieu.addRow({
        cccd: item.cccd,
        ho_ten: item.ho_ten,
        nam: item.nam,
        danh_hieu: item.danh_hieu,
        nhan_bkbqp: item.nhan_bkbqp ? 'X' : '',
        so_quyet_dinh_bkbqp: item.so_quyet_dinh_bkbqp || '',
        nhan_cstdtq: item.nhan_cstdtq ? 'X' : '',
        so_quyet_dinh_cstdtq: item.so_quyet_dinh_cstdtq || '',
        nhan_bkttcp: item.nhan_bkttcp ? 'X' : '',
        so_quyet_dinh_bkttcp: item.so_quyet_dinh_bkttcp || '',
      });
    });

    const sheetThanhTich = workbook.addWorksheet('ThanhTichKhoaHoc');
    sheetThanhTich.columns = [
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
      { header: 'Năm', key: 'nam', width: 12 },
      { header: 'Loại', key: 'loai', width: 10 },
      { header: 'Mô tả', key: 'mo_ta', width: 50 },
      { header: 'Trạng thái', key: 'status', width: 15 },
    ];

    sheetThanhTich.getRow(1).font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    sheetThanhTich.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFED7D31' },
    };

    // Format CCCD as Text to preserve leading zeros
    sheetThanhTich.getColumn(1).numFmt = '@';

    const thanhTichData = Array.isArray(proposal.data_thanh_tich)
      ? (proposal.data_thanh_tich as Array<Record<string, unknown>>)
      : [];
    thanhTichData.forEach(item => {
      sheetThanhTich.addRow({
        cccd: item.cccd,
        ho_ten: item.ho_ten,
        nam: item.nam,
        loai: item.loai,
        mo_ta: item.mo_ta,
        status: item.status,
      });
    });

    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    throw error;
  }
}

export { exportTemplate, exportTemplateNienHan, downloadProposalExcel, getPdfFile };
