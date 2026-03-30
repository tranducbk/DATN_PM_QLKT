import { prisma } from '../models';
import ExcelJS from 'exceljs';
import { loadWorkbook, getAndValidateWorksheet } from '../helpers/excelImportHelper';
import { checkDuplicateAward } from '../helpers/awardValidation';
import profileService from './profile.service';
import * as notificationHelper from '../helpers/notification';
import { getDanhHieuName } from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { parseHeaderMap, getHeaderCol } from '../helpers/excelHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { ValidationError, NotFoundError, AppError } from '../middlewares/errorHandler';
import { buildTemplate, TemplateColumn } from '../helpers/excelTemplateHelper';

class HCCSVVService {
  /**
   * Export template Excel for HCCSVV import
   */
  async exportTemplate(personnelIds: string[] = [], repeatMap: Record<string, number> = {}) {
    const columns: TemplateColumn[] = [
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

    return buildTemplate({
      sheetName: 'HCCSVV',
      columns,
      personnelIds,
      repeatMap,
      danhHieuOptions: '"HCCSVV_HANG_BA,HCCSVV_HANG_NHI,HCCSVV_HANG_NHAT"',
      editableColumnLetters: ['G', 'H'],
    });
  }

  /**
   * Preview import: validate Excel data without saving to DB
   */
  async previewImport(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, {
      excludeSheetNames: ['_CapBac', '_QuyetDinh'],
    });

    // Verify sheet name is not for other award types
    if (worksheet.name === 'Danh hiệu hằng năm') {
      throw new ValidationError(
        'File Excel không đúng loại. Đây là file danh hiệu hằng năm, không phải HCCSVV.'
      );
    }
    if (worksheet.name === 'Khen thưởng đơn vị') {
      throw new ValidationError(
        'File Excel không đúng loại. Đây là file khen thưởng đơn vị, không phải HCCSVV.'
      );
    }

    // Header map
    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
    const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu']);
    const soQuyetDinhCol = getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd']);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);

    if (!idCol || !namCol || !danhHieuCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
      );
    }

    const validDanhHieu = ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'];
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

    // HCCSVV hierarchy map: danh hiệu -> prerequisite
    const hierarchyPrerequisite = {
      HCCSVV_HANG_NHI: 'HCCSVV_HANG_BA',
      HCCSVV_HANG_NHAT: 'HCCSVV_HANG_NHI',
    };

    // --- First pass: collect all personnel IDs from valid rows ---
    const allPersonnelIds = new Set<string>();
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      if (idValue) {
        const id = String(idValue).trim();
        if (id) allPersonnelIds.add(id);
      }
    }

    // --- Batch queries ---
    const [personnelList, existingHCCSVVRecords] = await Promise.all([
      prisma.quanNhan.findMany({
        where: { id: { in: [...allPersonnelIds] } },
      }),
      prisma.khenThuongHCCSVV.findMany({
        where: { quan_nhan_id: { in: [...allPersonnelIds] } },
        select: { quan_nhan_id: true, danh_hieu: true, nam: true, so_quyet_dinh: true },
      }),
    ]);

    // Build lookup Maps
    const personnelMap = new Map(personnelList.map(p => [p.id, p]));
    // Map<personnelId_danhHieu, record> for duplicate checking
    const hccsvvByKey = new Map(
      existingHCCSVVRecords.map(r => [`${r.quan_nhan_id}_${r.danh_hieu}`, r])
    );
    // Map<personnelId, records[]> for history
    const hccsvvByPersonnel = new Map<string, typeof existingHCCSVVRecords>();
    for (const r of existingHCCSVVRecords) {
      const list = hccsvvByPersonnel.get(r.quan_nhan_id) || [];
      list.push(r);
      hccsvvByPersonnel.set(r.quan_nhan_id, list);
    }

    // --- Second pass: validate rows using Maps ---
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

      // Dòng có ID nhưng không có danh hiệu -> bỏ qua
      if (idValue && !danh_hieu_raw) {
        errors.push({
          row: rowNumber,
          ho_ten,
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
      const personnel = personnelMap.get(personnelId);
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
          message: `Danh hiệu "${danh_hieu_raw}" không tồn tại. Chỉ chấp nhận: ${validDanhHieu.join(', ')}`,
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

      // Check duplicate in file
      const fileKey = `${personnelId}_${danh_hieu}`;
      if (seenInFile.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Trùng lặp trong file — cùng quân nhân, danh hiệu ${danh_hieu}`,
        });
        continue;
      }
      seenInFile.add(fileKey);

      // Check duplicate in DB (using pre-fetched Map)
      const existingRecord = hccsvvByKey.get(`${personnelId}_${danh_hieu}`);
      if (existingRecord) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Đã có ${getDanhHieuName(danh_hieu)} trên hệ thống`,
        });
        continue;
      }

      // Check HCCSVV hierarchy: must have prerequisite before higher rank
      const prerequisite = hierarchyPrerequisite[danh_hieu];
      if (prerequisite) {
        // Check if prerequisite exists in DB (using pre-fetched Map)
        const hasPrerequisiteInDb = hccsvvByKey.has(`${personnelId}_${prerequisite}`);
        // Also check if prerequisite is in current valid items (being imported in same batch)
        const hasPrerequisiteInFile = valid.some(
          v => v.personnel_id === personnelId && v.danh_hieu === prerequisite
        );
        if (!hasPrerequisiteInDb && !hasPrerequisiteInFile) {
          errors.push({
            row: rowNumber,
            ho_ten,
            nam,
            danh_hieu,
            message: `Chưa có ${getDanhHieuName(prerequisite)}. Phải có Hạng Ba trước Hạng Nhì, Hạng Nhì trước Hạng Nhất`,
          });
          continue;
        }
      }

      // Build history from pre-fetched data (last 5 records sorted by nam desc)
      const allRecords = hccsvvByPersonnel.get(personnelId) || [];
      const history = [...allRecords]
        .sort((a, b) => b.nam - a.nam)
        .slice(0, 5)
        .map(r => ({ nam: r.nam, danh_hieu: r.danh_hieu, so_quyet_dinh: r.so_quyet_dinh }));

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
        history,
      });
    }

    return { total, valid, errors };
  }

  /**
   * Confirm import: lưu dữ liệu đã validate vào DB
   */
  async confirmImport(validItems: any[], adminId: string) {
    return await prisma.$transaction(
      async tx => {
        const results = [];
        for (const item of validItems) {
          const result = await tx.khenThuongHCCSVV.upsert({
            where: {
              quan_nhan_id_danh_hieu: {
                quan_nhan_id: item.personnel_id,
                danh_hieu: item.danh_hieu,
              },
            },
            update: {
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
   * Import HCCSVV from Excel
   */
  async importFromExcel(excelBuffer: Buffer, adminId: string) {
    const workbook = await loadWorkbook(excelBuffer);
    const worksheet = workbook.getWorksheet('HCCSVV');

    if (!worksheet) {
      throw new ValidationError('Không tìm thấy sheet "HCCSVV" trong file Excel');
    }

    const results = {
      success: 0,
      failed: 0,
      total: 0,
      imported: 0,
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

    // Batch query: collect all unique ho_ten values, then query once
    const allHoTen = new Set<string>();
    for (const { row } of rows) {
      const ho_ten = row.getCell(1).value?.toString().trim();
      if (ho_ten) allHoTen.add(ho_ten);
    }
    const allPersonnel = allHoTen.size > 0
      ? await prisma.quanNhan.findMany({ where: { ho_ten: { in: [...allHoTen] } } })
      : [];
    const personnelByName = new Map<string, typeof allPersonnel>();
    for (const p of allPersonnel) {
      const list = personnelByName.get(p.ho_ten) ?? [];
      list.push(p);
      personnelByName.set(p.ho_ten, list);
    }

    for (const { row, rowNumber } of rows) {
      try {
        const ho_ten = row.getCell(1).value?.toString().trim();
        const ngay_sinh_raw = row.getCell(2).value;
        const nam = parseInt(row.getCell(3).value);
        const cap_bac = row.getCell(4).value?.toString().trim();
        const chuc_vu = row.getCell(5).value?.toString().trim();
        const danh_hieu = row.getCell(6).value?.toString().trim();
        const ghi_chu = row.getCell(7).value?.toString().trim();
        const so_quyet_dinh = row.getCell(8).value?.toString().trim();

        if (!ho_ten || !nam || !danh_hieu) {
          results.errors.push(`Dòng ${rowNumber}: Thiếu thông tin bắt buộc`);
          results.failed++;
          continue;
        }

        // Validate danh_hieu
        const validDanhHieu = ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'];
        if (!validDanhHieu.includes(danh_hieu)) {
          results.errors.push(
            `Dòng ${rowNumber}: Danh hiệu không hợp lệ. Chỉ chấp nhận: ${validDanhHieu.join(', ')}`
          );
          results.failed++;
          continue;
        }

        // Tìm quân nhân theo tên (from pre-fetched batch)
        const personnelList = personnelByName.get(ho_ten) ?? [];
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
            danh_hieu,
            PROPOSAL_TYPES.NIEN_HAN,
            PROPOSAL_STATUS.APPROVED
          );
          if (duplicateCheck.exists) {
            results.errors.push(
              `Dòng ${rowNumber}: ${duplicateCheck.message} (Quân nhân: ${ho_ten}, Năm: ${nam}, Danh hiệu: ${danh_hieu})`
            );
            results.failed++;
            continue;
          }
        } catch (checkError) {
          // Continue processing but log the error
        }

        // Check if already exists
        const existing = await prisma.khenThuongHCCSVV.findUnique({
          where: {
            quan_nhan_id_danh_hieu: {
              quan_nhan_id: personnel.id,
              danh_hieu: danh_hieu,
            },
          },
        });

        if (existing) {
          results.errors.push(
            `Dòng ${rowNumber}: Quân nhân ${personnel.ho_ten} đã có ${getDanhHieuName(danh_hieu)}`
          );
          results.failed++;
          continue;
        }

        const createdRecord = await prisma.khenThuongHCCSVV.create({
          data: {
            quan_nhan_id: personnel.id,
            danh_hieu,
            nam,
            cap_bac: cap_bac,
            chuc_vu: chuc_vu,
            ghi_chu: ghi_chu,
            so_quyet_dinh: so_quyet_dinh,
          },
        });

        results.success++;
        results.imported++;
        results.total++;
        results.selectedPersonnelIds.push(personnel.id);
        results.titleData.push({
          personnelId: personnel.id,
          quan_nhan_id: personnel.id,
          danh_hieu,
          nam,
          cap_bac: cap_bac,
          chuc_vu: chuc_vu,
          ghi_chu: ghi_chu,
          so_quyet_dinh: so_quyet_dinh,
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
   * Get all HCCSVV with filters and pagination
   */
  async getAll(
    filters: Record<string, unknown> = {},
    page: number = 1,
    limit: number = 50
  ) {
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
      prisma.khenThuongHCCSVV.findMany({
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
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { nam: 'desc' },
      }),
      prisma.khenThuongHCCSVV.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: page,
        limit: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Export HCCSVV to Excel
   */
  async exportToExcel(filters: Record<string, any> = {}) {
    const { data } = await this.getAll(filters, 1, 10000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('HCCSVV');

    worksheet.columns = [
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

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    data.forEach((item, index) => {
      worksheet.addRow({
        stt: index + 1,
        id: item.quan_nhan_id,
        ho_ten: item.QuanNhan?.ho_ten ?? '',
        cap_bac: item.cap_bac ?? '',
        chuc_vu: item.chuc_vu ?? '',
        nam: item.nam,
        danh_hieu: item.danh_hieu,
        so_quyet_dinh: item.so_quyet_dinh ?? '',
        ghi_chu: item.ghi_chu ?? '',
      });
    });

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Get HCCSVV statistics
   */
  async getStatistics() {
    const byRank = await prisma.khenThuongHCCSVV.groupBy({
      by: ['danh_hieu'],
      _count: { id: true },
    });

    const byYear = await prisma.khenThuongHCCSVV.groupBy({
      by: ['nam'],
      _count: { id: true },
      orderBy: { nam: 'desc' },
    });

    const total = await prisma.khenThuongHCCSVV.count();

    return {
      total,
      byRank,
      byYear,
    };
  }

  /**
   * Get user with unit info (helper method)
   */
  async getUserWithUnit(userId: string) {
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
   * Create HCCSVV award directly (without checking eligibility)
   * Used by Super Admin to add past awards
   * @param {Object} data - Award data
   * @param {string} adminUsername - Username of admin creating the award
   * @returns {Promise<Object>}
   */
  async createDirect(data, adminUsername = 'SuperAdmin') {
    const { quan_nhan_id, danh_hieu, nam, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu } = data;

    // Validate danh_hieu
    const validDanhHieu = ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'];
    if (!validDanhHieu.includes(danh_hieu)) {
      throw new ValidationError(`Danh hiệu không hợp lệ. Chỉ chấp nhận: ${validDanhHieu.join(', ')}`);
    }

    // Check if personnel exists
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: quan_nhan_id },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // Check if already exists (unique constraint: quan_nhan_id + danh_hieu)
    const existing = await prisma.khenThuongHCCSVV.findUnique({
      where: {
        quan_nhan_id_danh_hieu: {
          quan_nhan_id: quan_nhan_id,
          danh_hieu: danh_hieu,
        },
      },
    });

    if (existing) {
      throw new AppError(`Quân nhân ${personnel.ho_ten} đã có ${getDanhHieuName(danh_hieu)}`, 409);
    }

    // Create the award
    const createdRecord = await prisma.khenThuongHCCSVV.create({
      data: {
        quan_nhan_id,
        danh_hieu,
        nam,
        cap_bac: cap_bac ?? personnel.cap_bac,
        chuc_vu: chuc_vu,
        so_quyet_dinh: so_quyet_dinh,
        ghi_chu: ghi_chu,
      },
      include: {
        QuanNhan: {
          select: {
            ho_ten: true,
            cccd: true,
            CoQuanDonVi: { select: { ten_don_vi: true } },
            DonViTrucThuoc: { select: { ten_don_vi: true } },
          },
        },
      },
    });

    // Recalculate tenure profile
    try {
      await profileService.recalculateTenureProfile(quan_nhan_id);
    } catch (recalcError) {
      writeSystemLog({
        action: 'ERROR',
        resource: 'hccsvv',
        description: `Lỗi tính lại hồ sơ niên hạn sau khi thêm HCCSVV: ${recalcError}`,
      });
    }

    return createdRecord;
  }

  /**
   * Delete HCCSVV award
   * @param {string} id - Award ID
   * @param {string} adminUsername - Username của admin thực hiện xóa
   * @returns {Promise<Object>}
   */
  async deleteAward(id: string, adminUsername: string = 'Admin') {
    const award = await prisma.khenThuongHCCSVV.findUnique({
      where: { id },
      include: {
        QuanNhan: true,
      },
    });

    if (!award) {
      throw new NotFoundError('Bản ghi khen thưởng');
    }

    const personnelId = award.quan_nhan_id;
    const personnel = award.QuanNhan;

    // Xóa bản ghi (không xóa đề xuất - proposal)
    await prisma.khenThuongHCCSVV.delete({
      where: { id },
    });

    // Tự động cập nhật lại hồ sơ niên hạn (giống như khi thêm mới)
    try {
      await profileService.recalculateTenureProfile(personnelId);
    } catch (recalcError) {
      writeSystemLog({
        action: 'ERROR',
        resource: 'hccsvv',
        resourceId: id,
        description: `Lỗi tính lại hồ sơ niên hạn sau khi xóa HCCSVV: ${recalcError}`,
      });
    }

    // Gửi thông báo cho Manager và quân nhân
    try {
      await notificationHelper.notifyOnAwardDeleted(award, personnel, 'HCCSVV', adminUsername);
    } catch (notifyError) {
      writeSystemLog({
        action: 'ERROR',
        resource: 'hccsvv',
        resourceId: id,
        description: `Lỗi gửi thông báo xóa khen thưởng HCCSVV: ${notifyError}`,
      });
    }

    return {
      message: 'Xóa khen thưởng HCCSVV thành công',
      personnelId,
    };
  }
}

export default new HCCSVVService();
