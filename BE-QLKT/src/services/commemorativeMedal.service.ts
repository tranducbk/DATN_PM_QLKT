import { prisma } from '../models';
import ExcelJS from 'exceljs';
import { checkDuplicateAward } from '../helpers/awardValidation';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import * as notificationHelper from '../helpers/notification';
import { ROLES } from '../constants/roles';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { ValidationError } from '../middlewares/errorHandler';
import { parseHeaderMap, getHeaderCol } from '../helpers/excelHelper';

class CommemorativeMedalService {
  /**
   * Export template Excel for Commemorative Medal (KNC VSNXD) import
   * Pre-filled with selected personnel
   */
  async exportTemplate(personnelIds: string[] = [], userRole: string = ROLES.MANAGER) {
    // Query personnel by IDs
    const personnelList =
      personnelIds.length > 0
        ? await prisma.quanNhan.findMany({
            where: { id: { in: personnelIds } },
            include: { ChucVu: true },
          })
        : [];

    // Query danh sách số quyết định hiện có để tạo dropdown
    const existingDecisions = await prisma.fileQuyetDinh.findMany({
      select: { so_quyet_dinh: true },
      orderBy: { nam: 'desc' },
      take: 200,
    });
    const decisionNumbers = existingDecisions.map(d => d.so_quyet_dinh).filter(Boolean);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('KNC VSNXD');

    // Định nghĩa các cột — KNC chỉ có 1 loại, không cần cột danh_hieu
    const columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Năm (*)', key: 'nam', width: 10 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
    ];

    worksheet.columns = columns;

    // Style cho header row: bold + gray background
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    // Pre-fill rows with personnel data
    personnelList.forEach((person, index) => {
      const rowData = {
        stt: index + 1,
        id: person.id,
        ho_ten: person.ho_ten ?? '',
        cap_bac: person.cap_bac ?? '',
        chuc_vu: person.ChucVu ? person.ChucVu.ten_chuc_vu : '',
      };
      worksheet.addRow(rowData);
    });

    // Light yellow background for readonly columns (STT, ID, Họ và tên)
    const readonlyColIndices = [1, 2, 3];
    const yellowFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFCC' },
    };

    for (let rowNum = 2; rowNum <= Math.max(personnelList.length + 1, 2); rowNum++) {
      const row = worksheet.getRow(rowNum);
      readonlyColIndices.forEach(colIdx => {
        row.getCell(colIdx).fill = yellowFill;
      });
    }

    // Data validation for Cấp bậc column (col 4) — dropdown
    const capBacOptions =
      'Binh nhì,Binh nhất,Hạ sĩ,Trung sĩ,Thượng sĩ,Thiếu úy,Trung úy,Thượng úy,Đại úy,Thiếu tá,Trung tá,Thượng tá,Đại tá,Thiếu tướng,Trung tướng,Thượng tướng,Đại tướng';
    const capBacSheet = workbook.addWorksheet('_CapBac', { state: 'veryHidden' });
    capBacOptions.split(',').forEach((cb, idx) => {
      capBacSheet.getCell(`A${idx + 1}`).value = cb;
    });
    const capBacCount = capBacOptions.split(',').length;
    const maxRows = Math.max(personnelList.length + 1, 50);
    for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
      worksheet.getRow(rowNum).getCell(4).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`_CapBac!$A$1:$A$${capBacCount}`],
      };
    }

    // Data validation cho cột số quyết định — dropdown từ DB
    if (decisionNumbers.length > 0) {
      const soQdColNumber = columns.findIndex(c => c.key === 'so_quyet_dinh') + 1;
      const decisionListStr = decisionNumbers.join(',');

      if (decisionListStr.length <= 250) {
        for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
          worksheet.getRow(rowNum).getCell(soQdColNumber).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${decisionListStr}"`],
          };
        }
      } else {
        const refSheet = workbook.addWorksheet('_QuyetDinh', { state: 'veryHidden' });
        decisionNumbers.forEach((sqd, idx) => {
          refSheet.getCell(`A${idx + 1}`).value = sqd;
        });
        for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
          worksheet.getRow(rowNum).getCell(soQdColNumber).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`_QuyetDinh!$A$1:$A$${decisionNumbers.length}`],
          };
        }
      }
    }

    return workbook;
  }

  /**
   * Preview import KNC VSNXD từ Excel (chỉ validate, không ghi DB)
   * Trả về danh sách valid items kèm lịch sử, và danh sách lỗi
   */
  async previewImport(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // Verify sheet name
    const worksheet = workbook.getWorksheet('KNC VSNXD');
    if (!worksheet) {
      throw new ValidationError(
        'Không tìm thấy sheet "KNC VSNXD" trong file Excel. Vui lòng sử dụng đúng file mẫu.'
      );
    }

    // Header map
    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
    const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
    const soQuyetDinhCol = getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd']);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);

    if (!idCol || !namCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
      );
    }

    const errors = [];
    const valid = [];
    let total = 0;
    const seenInFile = new Set();
    const currentYear = new Date().getFullYear();

    // Query danh sách số quyết định hợp lệ trên hệ thống
    const existingDecisions = await prisma.fileQuyetDinh.findMany({
      select: { so_quyet_dinh: true },
    });
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
      const namVal = row.getCell(namCol).value;
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
      const so_quyet_dinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

      // Skip empty rows
      if (!idValue && !namVal) continue;

      total++;

      // Validate required fields
      const missingFields = [];
      if (!idValue) missingFields.push('ID');
      if (!namVal) missingFields.push('Năm');
      if (missingFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          message: `Thiếu ${missingFields.join(', ')}`,
        });
        continue;
      }

      // Validate personnel ID
      const personnelId = String(idValue).trim();
      if (!personnelId) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          message: `ID không hợp lệ: ${idValue}`,
        });
        continue;
      }
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
        select: { id: true, ho_ten: true, gioi_tinh: true, ngay_nhap_ngu: true, cap_bac: true },
      });
      if (!personnel) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          message: `Không tìm thấy quân nhân với ID ${personnelId}`,
        });
        continue;
      }

      // Validate year
      const nam = parseInt(String(namVal), 10);
      if (!Number.isInteger(nam)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          message: `Giá trị năm không hợp lệ: ${namVal}`,
        });
        continue;
      }
      if (nam < 1900 || nam > currentYear) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
        });
        continue;
      }

      // Validate số quyết định — bắt buộc + phải có trên hệ thống
      if (!so_quyet_dinh) {
        errors.push({ row: rowNumber, ho_ten, nam, message: 'Thiếu số quyết định' });
        continue;
      }
      if (!validDecisionNumbers.has(so_quyet_dinh)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
        });
        continue;
      }

      // Check duplicate in file — one-per-person
      if (seenInFile.has(personnel.id)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Trùng lặp trong file — quân nhân ${ho_ten ?? personnel.ho_ten} đã xuất hiện ở dòng trước`,
        });
        continue;
      }
      seenInFile.add(personnel.id);

      // Check duplicate in DB — quân nhân đã có KNC
      const existingKnc = await prisma.kyNiemChuongVSNXDQDNDVN.findUnique({
        where: { quan_nhan_id: personnel.id },
      });
      if (existingKnc) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Quân nhân đã được tặng KNC VSNXD năm ${existingKnc.nam}`,
        });
        continue;
      }

      // Check eligibility: gioi_tinh + ngay_nhap_ngu
      if (!personnel.ngay_nhap_ngu) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: 'Không có ngày nhập ngũ trong hồ sơ, không thể kiểm tra điều kiện',
        });
        continue;
      }

      const ngayNhapNgu = new Date(personnel.ngay_nhap_ngu);
      const referenceDate = new Date(nam, 11, 31); // cuối năm được xét
      const serviceYears =
        (referenceDate.getTime() - ngayNhapNgu.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      const isFemale = personnel.gioi_tinh === 'Nữ';
      const requiredYears = isFemale ? 20 : 25;

      if (serviceYears < requiredYears) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Chưa đủ điều kiện: ${isFemale ? 'Nữ' : 'Nam'} cần >= ${requiredYears} năm phục vụ, hiện ${Math.floor(serviceYears)} năm`,
        });
        continue;
      }

      // Query existing award history
      const history = await prisma.kyNiemChuongVSNXDQDNDVN.findMany({
        where: { quan_nhan_id: personnel.id },
        orderBy: { nam: 'desc' },
        take: 5,
        select: { nam: true, so_quyet_dinh: true, ghi_chu: true },
      });

      valid.push({
        row: rowNumber,
        personnel_id: personnel.id,
        ho_ten: ho_ten ?? personnel.ho_ten,
        cap_bac: cap_bac ?? personnel.cap_bac ?? null,
        chuc_vu,
        nam,
        so_quyet_dinh,
        ghi_chu,
        service_years: Math.floor(serviceYears),
        gioi_tinh: personnel.gioi_tinh ?? 'Nam',
        history,
      });
    }

    return { total, valid, errors };
  }

  /**
   * Confirm import: lưu dữ liệu đã validate vào DB
   */
  async confirmImport(validItems, adminId) {
    return await prisma.$transaction(
      async tx => {
        const results = [];
        for (const item of validItems) {
          const result = await tx.kyNiemChuongVSNXDQDNDVN.upsert({
            where: { quan_nhan_id: item.personnel_id },
            update: {
              nam: item.nam,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
            create: {
              quan_nhan_id: item.personnel_id,
              nam: item.nam,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
          });
          results.push(result);
        }
        return { imported: results.length };
      },
      { timeout: 30000 }
    );
  }

  /**
   * Import Commemorative Medals from Excel (legacy — direct import without preview)
   */
  async importFromExcel(excelBuffer, adminId) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer);
    const worksheet = workbook.getWorksheet('KNC VSNXD') ?? workbook.getWorksheet('KNC_VSNXD');

    if (!worksheet) {
      throw new Error('Không tìm thấy sheet "KNC VSNXD" trong file Excel');
    }

    const results = {
      success: 0,
      total: 0,
      imported: 0,
      failed: 0,
      errors: [],
      selectedPersonnelIds: [],
      titleData: [],
    };

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        rows.push({ row, rowNumber });
      }
    });

    for (const { row, rowNumber } of rows) {
      try {
        const ho_ten = row.getCell(1).value?.toString().trim();
        const ngay_sinh_raw = row.getCell(2).value;
        const nam = parseInt(row.getCell(3).value);
        const cap_bac = row.getCell(4).value?.toString() ?? null;
        const chuc_vu = row.getCell(5).value?.toString() ?? null;
        const ghi_chu = row.getCell(6).value?.toString() ?? null;
        const so_quyet_dinh = row.getCell(7).value?.toString() ?? null;

        if (!ho_ten || !nam) {
          results.errors.push(`Dòng ${rowNumber}: Thiếu thông tin bắt buộc`);
          results.failed++;
          continue;
        }

        // Tìm quân nhân theo tên
        const personnelList = await prisma.quanNhan.findMany({ where: { ho_ten } });
        if (personnelList.length === 0) {
          results.errors.push(`Dòng ${rowNumber}: Không tìm thấy quân nhân với tên ${ho_ten}`);
          results.failed++;
          continue;
        }

        let personnel;
        if (personnelList.length === 1) {
          personnel = personnelList[0];
        } else {
          if (!ngay_sinh_raw) {
            results.errors.push(
              `Dòng ${rowNumber}: Có ${personnelList.length} người trùng tên "${ho_ten}". Vui lòng cung cấp ngày sinh`
            );
            results.failed++;
            continue;
          }

          let ngay_sinh;
          if (ngay_sinh_raw instanceof Date) {
            ngay_sinh = ngay_sinh_raw;
          } else {
            const dateStr = String(ngay_sinh_raw).trim();
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              ngay_sinh = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else {
              results.errors.push(`Dòng ${rowNumber}: Ngày sinh không đúng định dạng (DD/MM/YYYY)`);
              results.failed++;
              continue;
            }
          }

          personnel = personnelList.find(p => {
            if (!p.ngay_sinh) return false;
            const pDate = new Date(p.ngay_sinh);
            return (
              pDate.getDate() === ngay_sinh.getDate() &&
              pDate.getMonth() === ngay_sinh.getMonth() &&
              pDate.getFullYear() === ngay_sinh.getFullYear()
            );
          });

          if (!personnel) {
            results.errors.push(
              `Dòng ${rowNumber}: Không tìm thấy quân nhân tên "${ho_ten}" với ngày sinh đã cung cấp`
            );
            results.failed++;
            continue;
          }
        }

        // Check for duplicate awards in proposals
        try {
          const duplicateCheck = await checkDuplicateAward(
            personnel.id,
            nam,
            'KNC_VSNXD_QDNDVN',
            PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
            PROPOSAL_STATUS.APPROVED
          );
          if (duplicateCheck.exists) {
            results.errors.push(
              `Dòng ${rowNumber}: ${duplicateCheck.message} (Quân nhân: ${ho_ten}, Năm: ${nam})`
            );
            results.failed++;
            continue;
          }
        } catch (checkError) {
          // Continue processing but log the error
        }

        // Upsert (mỗi quân nhân chỉ có 1 bản ghi)
        const upsertedRecord = await prisma.kyNiemChuongVSNXDQDNDVN.upsert({
          where: { quan_nhan_id: personnel.id },
          create: {
            quan_nhan_id: personnel.id,
            nam,
            cap_bac: cap_bac ?? null,
            chuc_vu: chuc_vu ?? null,
            ghi_chu: ghi_chu ?? null,
            so_quyet_dinh: so_quyet_dinh ?? null,
          },
          update: {
            nam,
            cap_bac: cap_bac ?? null,
            chuc_vu: chuc_vu ?? null,
            ghi_chu: ghi_chu ?? null,
            so_quyet_dinh: so_quyet_dinh ?? null,
          },
        });

        results.success++;
        results.imported++;
        results.total++;
        results.selectedPersonnelIds.push(personnel.id);
        results.titleData.push({
          personnelId: personnel.id,
          quan_nhan_id: personnel.id,
          danh_hieu: 'KNC_VSNXD_QDNDVN',
          nam: upsertedRecord.nam,
          cap_bac: upsertedRecord.cap_bac,
          chuc_vu: upsertedRecord.chuc_vu,
          ghi_chu: upsertedRecord.ghi_chu,
          so_quyet_dinh: upsertedRecord.so_quyet_dinh,
        });
      } catch (error) {
        results.errors.push(`Dòng ${rowNumber}: ${error.message}`);
        results.failed++;
        results.total++;
      }
    }

    return results;
  }

  /**
   * Get all Commemorative Medals with filters and pagination
   */
  async getAll(
    filters: Record<string, unknown> = {},
    page: string | number = 1,
    limit: string | number = 50
  ) {
    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);
    const where: Record<string, unknown> = {};

    // Filter theo họ tên
    const quanNhanFilter: Record<string, unknown> = {};
    if (filters.ho_ten) {
      quanNhanFilter.ho_ten = { contains: filters.ho_ten, mode: 'insensitive' };
    }

    if (filters.don_vi_id) {
      if (filters.include_sub_units) {
        // Nếu có flag include_sub_units, lấy tất cả đơn vị trực thuộc của cơ quan đơn vị
        const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
          where: { co_quan_don_vi_id: filters.don_vi_id },
          select: { id: true },
        });
        const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);
        where.QuanNhan = {
          ...quanNhanFilter,
          OR: [
            { co_quan_don_vi_id: filters.don_vi_id },
            { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
          ],
        };
      } else {
        where.QuanNhan = {
          ...quanNhanFilter,
          OR: [
            { co_quan_don_vi_id: filters.don_vi_id },
            { don_vi_truc_thuoc_id: filters.don_vi_id },
          ],
        };
      }
    } else if (Object.keys(quanNhanFilter).length > 0) {
      // Nếu không có filter don_vi_id nhưng có filter ho_ten
      where.QuanNhan = quanNhanFilter;
    }

    if (filters.nam) {
      where.nam = parseInt(String(filters.nam), 10);
    }

    const [data, total] = await Promise.all([
      prisma.kyNiemChuongVSNXDQDNDVN.findMany({
        where,
        include: {
          QuanNhan: {
            select: {
              cccd: true,
              ho_ten: true,
              cap_bac: true,
              ngay_sinh: true,
              CoQuanDonVi: { select: { ten_don_vi: true } },
              DonViTrucThuoc: { select: { ten_don_vi: true } },
            },
          },
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { nam: 'desc' },
      }),
      prisma.kyNiemChuongVSNXDQDNDVN.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Export Commemorative Medals to Excel
   */
  async exportToExcel(filters = {}) {
    const { data } = await this.getAll(filters, 1, 10000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('KNC VSNXD');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Họ tên', key: 'ho_ten', width: 25 },
      { header: 'Đơn vị', key: 'don_vi', width: 30 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 30 },
      { header: 'Thời gian (tháng)', key: 'thoi_gian', width: 18 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    // Helper function để convert thoi_gian từ object {years, months} sang số tháng
    const convertThoiGian = thoiGian => {
      if (!thoiGian) return '';
      if (typeof thoiGian === 'object') {
        const years = thoiGian.years || 0;
        const months = thoiGian.months || 0;
        return years * 12 + months;
      } else if (typeof thoiGian === 'number') {
        return thoiGian;
      } else if (typeof thoiGian === 'string') {
        try {
          const parsed = JSON.parse(thoiGian);
          const years = parsed.years || 0;
          const months = parsed.months || 0;
          return years * 12 + months;
        } catch {
          return thoiGian;
        }
      }
      return '';
    };

    data.forEach((item, index) => {
      worksheet.addRow({
        stt: index + 1,
        cccd: item.QuanNhan.cccd,
        ho_ten: item.QuanNhan.ho_ten,
        don_vi:
          item.QuanNhan.CoQuanDonVi?.ten_don_vi ?? item.QuanNhan.DonViTrucThuoc?.ten_don_vi ?? '',
        nam: item.nam,
        cap_bac: item.cap_bac,
        chuc_vu: item.chuc_vu,
        thoi_gian: convertThoiGian(item.thoi_gian),
        so_quyet_dinh: item.so_quyet_dinh,
        ghi_chu: item.ghi_chu ?? '',
      });
    });

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Get Commemorative Medals statistics
   */
  async getStatistics() {
    const byYear = await prisma.kyNiemChuongVSNXDQDNDVN.groupBy({
      by: ['nam'],
      _count: { id: true },
      orderBy: { nam: 'desc' },
    });

    const total = await prisma.kyNiemChuongVSNXDQDNDVN.count();

    return {
      total,
      byYear,
    };
  }

  /**
   * Get user with unit info (helper method)
   */
  async getUserWithUnit(userId) {
    return await prisma.taiKhoan.findUnique({
      where: { id: userId },
      include: {
        QuanNhan: {
          select: {
            co_quan_don_vi_id: true,
            don_vi_truc_thuoc_id: true,
          },
        },
      },
    });
  }

  /**
   * Get Commemorative Medal by personnel ID
   */
  async getByPersonnelId(personnelId) {
    const result = await prisma.kyNiemChuongVSNXDQDNDVN.findUnique({
      where: { quan_nhan_id: personnelId },
      include: {
        QuanNhan: {
          select: {
            cccd: true,
            ho_ten: true,
            cap_bac: true,
            ngay_sinh: true,
            CoQuanDonVi: { select: { ten_don_vi: true } },
            DonViTrucThuoc: { select: { ten_don_vi: true } },
          },
        },
      },
    });
    return result ? [result] : [];
  }

  /**
   * Get personnel by ID (helper method)
   */
  async getPersonnelById(personnelId) {
    return await prisma.quanNhan.findUnique({
      where: { id: personnelId },
      select: {
        co_quan_don_vi_id: true,
        don_vi_truc_thuoc_id: true,
      },
    });
  }

  /**
   * Delete Commemorative Medal
   * @param {string} id - Award ID
   * @param {string} adminUsername - Username của admin thực hiện xóa
   * @returns {Promise<Object>}
   */
  async deleteAward(id, adminUsername = 'Admin') {
    const award = await prisma.kyNiemChuongVSNXDQDNDVN.findUnique({
      where: { id },
      include: {
        QuanNhan: true,
      },
    });

    if (!award) {
      throw new Error('Bản ghi khen thưởng không tồn tại');
    }

    const personnelId = award.quan_nhan_id;
    const personnel = award.QuanNhan;

    // Xóa bản ghi (không xóa đề xuất - proposal)
    await prisma.kyNiemChuongVSNXDQDNDVN.delete({
      where: { id },
    });

    // KNC VSNXD không ảnh hưởng đến hồ sơ hằng năm, niên hạn hay cống hiến
    // Không cần recalculate

    // Gửi thông báo cho Manager và quân nhân
    try {
      await notificationHelper.notifyOnAwardDeleted(award, personnel, 'KNC_VSNXD', adminUsername);
    } catch (notifyError) {}

    return {
      message: 'Xóa khen thưởng KNC VSNXD thành công',
      personnelId,
    };
  }
}

export default new CommemorativeMedalService();
