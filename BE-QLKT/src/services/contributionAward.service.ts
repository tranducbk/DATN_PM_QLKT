import { prisma } from '../models';
import ExcelJS from 'exceljs';
import { checkDuplicateAward } from '../helpers/awardValidation';
import profileService from './profile.service';
import * as notificationHelper from '../helpers/notification';
import { getDanhHieuName } from '../constants/danhHieu.constants';
import { ROLES } from '../constants/roles.constants';
import { ValidationError } from '../middlewares/errorHandler';
import { parseHeaderMap, getHeaderCol } from '../helpers/excelHelper';

/** Rank order for HCBVTQ — higher index = higher rank */
const HCBVTQ_RANK_ORDER = {
  HCBVTQ_HANG_BA: 1,
  HCBVTQ_HANG_NHI: 2,
  HCBVTQ_HANG_NHAT: 3,
};

class ContributionAwardService {
  /**
   * Export template Excel for Contribution Awards (HCBVTQ) import
   * @param {string[]} personnelIds - Pre-fill with selected personnel
   * @param {string} userRole
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
    const worksheet = workbook.addWorksheet('HCBVTQ');

    // Định nghĩa các cột
    const columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Năm (*)', key: 'nam', width: 10 },
      { header: 'Danh hiệu (*)', key: 'danh_hieu', width: 25 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
    ];

    worksheet.columns = columns;

    // Style cho header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    // Pre-fill rows with personnel data
    personnelList.forEach((person, index) => {
      worksheet.addRow({
        stt: index + 1,
        id: person.id,
        ho_ten: person.ho_ten ?? '',
        cap_bac: person.cap_bac ?? '',
        chuc_vu: person.ChucVu ? person.ChucVu.ten_chuc_vu : '',
      });
    });

    // Light yellow background for readonly columns (STT, ID, Họ và tên)
    const readonlyColIndices = [1, 2, 3];
    const yellowFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
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

    // Data validation for Danh hiệu column (col 7) — dropdown
    const danhHieuColNumber = 7;
    for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
      worksheet.getRow(rowNum).getCell(danhHieuColNumber).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"HCBVTQ_HANG_BA,HCBVTQ_HANG_NHI,HCBVTQ_HANG_NHAT"'],
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
   * Preview import HCBVTQ từ Excel (chỉ validate, không ghi DB)
   * Trả về danh sách valid items kèm lịch sử, và danh sách lỗi
   */
  async previewImport(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet('HCBVTQ');

    if (!worksheet) {
      throw new ValidationError(
        'Không tìm thấy sheet "HCBVTQ" trong file Excel. Vui lòng dùng đúng file mẫu.'
      );
    }

    // Header map
    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu']);
    const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
    const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
    const soQuyetDinhCol = getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd']);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);

    if (!idCol || !namCol || !danhHieuCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
      );
    }

    const validDanhHieu = ['HCBVTQ_HANG_BA', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_NHAT'];
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
      const danh_hieu_raw = String(row.getCell(danhHieuCol).value ?? '').trim();
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
      const so_quyet_dinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

      if (!idValue && !namVal && !danh_hieu_raw) continue;

      // Dòng có ID nhưng không có danh hiệu → bỏ qua, báo lý do
      if (idValue && !danh_hieu_raw) {
        const skipName = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
        errors.push({
          row: rowNumber,
          ho_ten: skipName,
          nam: namVal,
          danh_hieu: '',
          message: 'Bỏ qua — không có danh hiệu nào được điền',
        });
        continue;
      }

      total++;

      // Validate required fields
      const missingFields = [];
      if (!idValue) missingFields.push('ID');
      if (!namVal) missingFields.push('Năm');
      if (!danh_hieu_raw) missingFields.push('Danh hiệu');
      if (missingFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
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
          danh_hieu: danh_hieu_raw,
          message: `ID không hợp lệ: ${idValue}`,
        });
        continue;
      }
      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
        select: { id: true, ho_ten: true, gioi_tinh: true, cap_bac: true },
      });
      if (!personnel) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
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
          danh_hieu: danh_hieu_raw,
          message: `Giá trị năm không hợp lệ: ${namVal}`,
        });
        continue;
      }
      if (nam < 1900 || nam > currentYear) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu: danh_hieu_raw,
          message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
        });
        continue;
      }

      // Validate danh_hieu
      const danhHieuUpper = danh_hieu_raw.toUpperCase();
      if (!validDanhHieu.includes(danhHieuUpper)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu: danh_hieu_raw,
          message: `Danh hiệu "${danh_hieu_raw}" không hợp lệ. Chỉ chấp nhận: ${validDanhHieu.join(', ')}`,
        });
        continue;
      }
      const danh_hieu = danhHieuUpper;

      // Validate số quyết định — bắt buộc + phải có trên hệ thống
      if (!so_quyet_dinh) {
        errors.push({ row: rowNumber, ho_ten, nam, danh_hieu, message: 'Thiếu số quyết định' });
        continue;
      }
      if (!validDecisionNumbers.has(so_quyet_dinh)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
        });
        continue;
      }

      // Check duplicate in file — HCBVTQ unique on quan_nhan_id (one per person)
      if (seenInFile.has(personnelId)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Trùng lặp trong file — mỗi quân nhân chỉ có 1 HCBVTQ`,
        });
        continue;
      }
      seenInFile.add(personnelId);

      // Check duplicate in DB — if person already has HCBVTQ, only allow higher rank
      const existingAward = await prisma.khenThuongCongHien.findUnique({
        where: { quan_nhan_id: personnelId },
      });

      let action = 'create';
      if (existingAward) {
        const existingRank = HCBVTQ_RANK_ORDER[existingAward.danh_hieu] ?? 0;
        const newRank = HCBVTQ_RANK_ORDER[danh_hieu] ?? 0;
        if (newRank <= existingRank) {
          errors.push({
            row: rowNumber,
            ho_ten,
            nam,
            danh_hieu,
            message: `Đã có ${getDanhHieuName(existingAward.danh_hieu)} — chỉ được nâng hạng cao hơn`,
          });
          continue;
        }
        action = 'upgrade';
      }

      // Check thời gian giữ chức vụ theo nhóm hệ số
      const positionHistories = await prisma.lichSuChucVu.findMany({
        where: { quan_nhan_id: personnelId },
        include: { ChucVu: { select: { he_so_chuc_vu: true } } },
      });

      const today = new Date();
      const getTotalMonths = group => {
        let total = 0;
        positionHistories.forEach(h => {
          const heSo = Number(h.ChucVu?.he_so_chuc_vu) || 0;
          let match = false;
          if (group === '0.7') match = heSo >= 0.7 && heSo < 0.8;
          else if (group === '0.8') match = heSo >= 0.8 && heSo < 0.9;
          else if (group === '0.9-1.0') match = heSo >= 0.9 && heSo <= 1.0;
          if (!match) return;

          let months = h.so_thang;
          if ((months === null || months === undefined) && h.ngay_bat_dau && !h.ngay_ket_thuc) {
            const start = new Date(h.ngay_bat_dau);
            months =
              (today.getFullYear() - start.getFullYear()) * 12 +
              today.getMonth() -
              start.getMonth();
            if (today.getDate() < start.getDate()) months--;
            months = Math.max(0, months);
          }
          if (months) total += Number(months);
        });
        return total;
      };

      const months0_7 = getTotalMonths('0.7');
      const months0_8 = getTotalMonths('0.8');
      const months0_9_1_0 = getTotalMonths('0.9-1.0');

      const isFemale = personnel.gioi_tinh === 'NU';
      const baseMonths = isFemale ? 80 : 120; // 10 năm nam, ~6.7 năm nữ

      let eligible = false;
      if (danh_hieu === 'HCBVTQ_HANG_NHAT') {
        eligible = months0_9_1_0 >= baseMonths;
      } else if (danh_hieu === 'HCBVTQ_HANG_NHI') {
        eligible = months0_8 + months0_9_1_0 >= baseMonths;
      } else if (danh_hieu === 'HCBVTQ_HANG_BA') {
        eligible = months0_7 + months0_8 + months0_9_1_0 >= baseMonths;
      }

      if (!eligible) {
        const totalDisplay = `nhóm 0.7: ${months0_7} tháng, nhóm 0.8: ${months0_8} tháng, nhóm 0.9-1.0: ${months0_9_1_0} tháng`;
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Chưa đủ thời gian giữ chức vụ cho ${getDanhHieuName(danh_hieu)} (cần ${baseMonths} tháng, hiện có: ${totalDisplay})`,
        });
        continue;
      }

      // Query existing award history
      const history = existingAward
        ? [
            {
              nam: existingAward.nam,
              danh_hieu: existingAward.danh_hieu,
              so_quyet_dinh: existingAward.so_quyet_dinh,
            },
          ]
        : [];

      valid.push({
        row: rowNumber,
        personnel_id: personnelId,
        ho_ten: ho_ten ?? personnel.ho_ten,
        cap_bac,
        chuc_vu,
        nam,
        danh_hieu,
        so_quyet_dinh,
        ghi_chu,
        action,
        history,
      });
    }

    return { total, valid, errors };
  }

  /**
   * Confirm import: lưu dữ liệu đã validate vào DB
   * Upsert on quan_nhan_id — if existing, only update if new rank is higher
   */
  async confirmImport(validItems, adminId) {
    return await prisma.$transaction(
      async tx => {
        const results = [];
        for (const item of validItems) {
          // Re-check rank to prevent stale data
          const existing = await tx.khenThuongCongHien.findUnique({
            where: { quan_nhan_id: item.personnel_id },
          });

          if (existing) {
            const existingRank = HCBVTQ_RANK_ORDER[existing.danh_hieu] ?? 0;
            const newRank = HCBVTQ_RANK_ORDER[item.danh_hieu] ?? 0;
            if (newRank <= existingRank) {
              // Skip — rank not higher, should not happen if preview was correct
              continue;
            }
          }

          const result = await tx.khenThuongCongHien.upsert({
            where: { quan_nhan_id: item.personnel_id },
            update: {
              danh_hieu: item.danh_hieu,
              nam: item.nam,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
            create: {
              quan_nhan_id: item.personnel_id,
              danh_hieu: item.danh_hieu,
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
   * Get all Contribution Awards with filters and pagination
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

    if (filters.danh_hieu) {
      where.danh_hieu = filters.danh_hieu;
    }

    const [data, total] = await Promise.all([
      prisma.khenThuongCongHien.findMany({
        where,
        include: {
          QuanNhan: {
            select: {
              id: true,
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
      prisma.khenThuongCongHien.count({ where }),
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
   * Export Contribution Awards to Excel
   */
  async exportToExcel(filters = {}) {
    const { data } = await this.getAll(filters, 1, 10000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('HCBVTQ');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Đơn vị', key: 'don_vi', width: 30 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Danh hiệu', key: 'danh_hieu', width: 25 },
      { header: 'TG nhóm 0.7 (tháng)', key: 'thoi_gian_nhom_0_7', width: 18 },
      { header: 'TG nhóm 0.8 (tháng)', key: 'thoi_gian_nhom_0_8', width: 18 },
      { header: 'TG nhóm 0.9-1.0 (tháng)', key: 'thoi_gian_nhom_0_9_1_0', width: 20 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFD3D3D3' },
    };

    // Helper function để convert thoi_gian từ object {years, months} sang số tháng
    const convertThoiGian = thoiGian => {
      if (!thoiGian) return '';
      if (typeof thoiGian === 'object') {
        const years = thoiGian.years ?? 0;
        const months = thoiGian.months ?? 0;
        return years * 12 + months;
      } else if (typeof thoiGian === 'number') {
        return thoiGian;
      } else if (typeof thoiGian === 'string') {
        try {
          const parsed = JSON.parse(thoiGian);
          const years = parsed.years ?? 0;
          const months = parsed.months ?? 0;
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
        id: item.QuanNhan?.id ?? '',
        cccd: item.QuanNhan?.cccd ?? '',
        ho_ten: item.QuanNhan?.ho_ten ?? '',
        cap_bac: item.cap_bac ?? '',
        chuc_vu: item.chuc_vu ?? '',
        don_vi:
          item.QuanNhan?.CoQuanDonVi?.ten_don_vi ?? item.QuanNhan?.DonViTrucThuoc?.ten_don_vi ?? '',
        nam: item.nam,
        danh_hieu: getDanhHieuName(item.danh_hieu),
        thoi_gian_nhom_0_7: convertThoiGian(item.thoi_gian_nhom_0_7),
        thoi_gian_nhom_0_8: convertThoiGian(item.thoi_gian_nhom_0_8),
        thoi_gian_nhom_0_9_1_0: convertThoiGian(item.thoi_gian_nhom_0_9_1_0),
        so_quyet_dinh: item.so_quyet_dinh ?? '',
        ghi_chu: item.ghi_chu ?? '',
      });
    });

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Get Contribution Awards statistics
   */
  async getStatistics() {
    const byRank = await prisma.khenThuongCongHien.groupBy({
      by: ['danh_hieu'],
      _count: { id: true },
    });

    const byYear = await prisma.khenThuongCongHien.groupBy({
      by: ['nam'],
      _count: { id: true },
      orderBy: { nam: 'desc' },
    });

    const total = await prisma.khenThuongCongHien.count();

    return {
      total,
      byRank,
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
   * Delete Contribution Award
   * @param {string} id - Award ID
   * @param {string} adminUsername - Username của admin thực hiện xóa
   * @returns {Promise<Object>}
   */
  async deleteAward(id, adminUsername = 'Admin') {
    const award = await prisma.khenThuongCongHien.findUnique({
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
    await prisma.khenThuongCongHien.delete({
      where: { id },
    });

    // Tự động cập nhật lại hồ sơ cống hiến (giống như khi thêm mới)
    try {
      await profileService.recalculateContributionProfile(personnelId);
    } catch (recalcError) {
      console.error('[Profile] Failed to recalculate contribution profile after HCBVTQ deletion:', recalcError);
    }

    // Gửi thông báo cho Manager và quân nhân
    try {
      await notificationHelper.notifyOnAwardDeleted(award, personnel, 'HCBVTQ', adminUsername);
    } catch (notifyError) {
      console.error('[Notification] Failed to notify on HCBVTQ award deletion:', notifyError);
    }

    return {
      message: 'Xóa khen thưởng HCBVTQ thành công',
      personnelId,
    };
  }
}

export default new ContributionAwardService();
