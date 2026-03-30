import { prisma } from '../models';
import ExcelJS from 'exceljs';
import { loadWorkbook, getAndValidateWorksheet } from '../helpers/excelImportHelper';
import { checkDuplicateAward } from '../helpers/awardValidation';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import * as notificationHelper from '../helpers/notification';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { ValidationError, NotFoundError } from '../middlewares/errorHandler';
import { parseHeaderMap, getHeaderCol, resolvePersonnelInfo } from '../helpers/excelHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { buildTemplate, TemplateColumn } from '../helpers/excelTemplateHelper';

class CommemorativeMedalService {
  /**
   * Export template Excel for Commemorative Medal (KNC VSNXD) import
   * Pre-filled with selected personnel
   */
  async exportTemplate(personnelIds: string[] = [], repeatMap: Record<string, number> = {}) {
    const columns: TemplateColumn[] = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Năm (*)', key: 'nam', width: 10 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
    ];

    return buildTemplate({
      sheetName: 'KNC VSNXD QDNDVN',
      columns,
      personnelIds,
      repeatMap,
      loaiKhenThuong: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      editableColumnLetters: ['G'],
    });
  }

  /**
   * Preview import KNC VSNXD từ Excel (chỉ validate, không ghi DB)
   * Trả về danh sách valid items kèm lịch sử, và danh sách lỗi
   */
  async previewImport(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, { sheetName: 'KNC VSNXD QDNDVN' });

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

    // --- First pass: collect all personnel IDs from worksheet ---
    const allPersonnelIds = new Set<string>();
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      if (idValue) {
        const pid = String(idValue).trim();
        if (pid) allPersonnelIds.add(pid);
      }
    }

    // --- Batch queries: personnel, existing KNC, decisions, pending proposals ---
    const [personnelList, existingKncList, existingDecisions, pendingProposals] = await Promise.all([
      allPersonnelIds.size > 0
        ? prisma.quanNhan.findMany({
            where: { id: { in: [...allPersonnelIds] } },
            select: { id: true, ho_ten: true, gioi_tinh: true, ngay_nhap_ngu: true, cap_bac: true, ChucVu: { select: { ten_chuc_vu: true } } },
          })
        : Promise.resolve([]),
      allPersonnelIds.size > 0
        ? prisma.kyNiemChuongVSNXDQDNDVN.findMany({
            where: { quan_nhan_id: { in: [...allPersonnelIds] } },
          })
        : Promise.resolve([]),
      prisma.fileQuyetDinh.findMany({
        select: { so_quyet_dinh: true },
      }),
      prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
          status: PROPOSAL_STATUS.PENDING,
        },
      }),
    ]);

    const pendingPersonnelIds = new Set<string>();
    for (const proposal of pendingProposals) {
      const data = (proposal.data_nien_han as Array<Record<string, unknown>>) || [];
      for (const item of data) {
        if (item.personnel_id) pendingPersonnelIds.add(item.personnel_id as string);
      }
    }

    const personnelMap = new Map(personnelList.map(p => [p.id, p]));
    const existingKncMap = new Map(existingKncList.map(k => [k.quan_nhan_id, k]));
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
      const personnel = personnelMap.get(personnelId);
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
      const existingKnc = existingKncMap.get(personnel.id);
      if (existingKnc) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Quân nhân đã được tặng KNC VSNXD năm ${existingKnc.nam}`,
        });
        continue;
      }

      // Check pending proposal
      if (pendingPersonnelIds.has(personnelId)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: 'Quân nhân đang có đề xuất Kỷ niệm chương chờ duyệt',
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
      const isFemale = personnel.gioi_tinh === 'NU';
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

      // History from batched data — existingKnc is already checked as null here,
      // so history is always empty (person has no KNC yet). Keep the structure for consistency.
      const history = existingKnc
        ? [
            {
              nam: existingKnc.nam,
              so_quyet_dinh: existingKnc.so_quyet_dinh,
              ghi_chu: existingKnc.ghi_chu,
            },
          ]
        : [];

      const { hoTen, capBac, chucVu, missingFields: missingInfoFields } = resolvePersonnelInfo(
        { ho_ten, cap_bac, chuc_vu },
        personnel
      );
      if (missingInfoFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten: hoTen,
          nam,
          message: `Thiếu ${missingInfoFields.join(', ')} (cả trong file và hệ thống)`,
        });
        continue;
      }

      valid.push({
        row: rowNumber,
        personnel_id: personnel.id,
        ho_ten: hoTen,
        cap_bac: capBac,
        chuc_vu: chucVu,
        nam,
        so_quyet_dinh,
        ghi_chu,
        service_years: Math.floor(serviceYears),
        gioi_tinh: personnel.gioi_tinh ?? 'NAM',
        history,
      });
    }

    return { total, valid, errors };
  }

  /**
   * Confirm import: lưu dữ liệu đã validate vào DB
   */
  async confirmImport(validItems: any[], adminId: string) {
    const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

    // Check pending proposals before proceeding
    const pendingProposals = await prisma.bangDeXuat.findMany({
      where: { loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN, status: PROPOSAL_STATUS.PENDING },
    });
    const pendingPersonnelIds = new Set<string>();
    for (const p of pendingProposals) {
      const data = (p.data_nien_han as Array<Record<string, unknown>>) || [];
      for (const item of data) {
        if (item.personnel_id) pendingPersonnelIds.add(item.personnel_id as string);
      }
    }
    const pendingConflicts: string[] = [];
    for (const item of validItems) {
      if (pendingPersonnelIds.has(item.personnel_id)) {
        pendingConflicts.push(`${item.ho_ten}: đang có đề xuất Kỷ niệm chương chờ duyệt`);
      }
    }
    if (pendingConflicts.length > 0) {
      throw new ValidationError(pendingConflicts.join('; '));
    }

    // Check existing records to prevent silent overwrites
    const existingRecords = await prisma.kyNiemChuongVSNXDQDNDVN.findMany({
      where: { quan_nhan_id: { in: personnelIds } },
      select: { quan_nhan_id: true, nam: true },
    });
    const existingSet = new Set(existingRecords.map(r => r.quan_nhan_id));

    const conflicts: string[] = [];
    for (const item of validItems) {
      if (existingSet.has(item.personnel_id)) {
        conflicts.push(
          `${item.ho_ten}: đã có Kỷ niệm chương VSNXD QĐNDVN trên hệ thống`
        );
      }
    }
    if (conflicts.length > 0) {
      throw new ValidationError(conflicts.join('; '));
    }

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
  async importFromExcel(excelBuffer: Buffer, adminId: string) {
    const workbook = await loadWorkbook(excelBuffer);
    const worksheet = workbook.getWorksheet('KNC VSNXD QDNDVN');

    if (!worksheet) {
      throw new ValidationError('Không tìm thấy sheet "KNC VSNXD QDNDVN" trong file Excel');
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

    // Batch query: collect all unique ho_ten values, then query once
    const allHoTen = new Set<string>();
    for (const { row } of rows) {
      const ho_ten = row.getCell(1).value?.toString().trim();
      if (ho_ten) allHoTen.add(ho_ten);
    }
    const allPersonnel =
      allHoTen.size > 0
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
        const cap_bac = row.getCell(4).value?.toString() ?? null;
        const chuc_vu = row.getCell(5).value?.toString() ?? null;
        const ghi_chu = row.getCell(6).value?.toString() ?? null;
        const so_quyet_dinh = row.getCell(7).value?.toString() ?? null;

        if (!ho_ten || !nam) {
          results.errors.push(`Dòng ${rowNumber}: Thiếu thông tin bắt buộc`);
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
  async getAll(filters: Record<string, unknown> = {}, page: number = 1, limit: number = 50) {
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
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { nam: 'desc' },
      }),
      prisma.kyNiemChuongVSNXDQDNDVN.count({ where }),
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
   * Export Commemorative Medals to Excel
   */
  async exportToExcel(filters: Record<string, any> = {}) {
    const { data } = await this.getAll(filters, 1, 10000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('KNC VSNXD QDNDVN');

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
   * Get Commemorative Medal by personnel ID
   */
  async getByPersonnelId(personnelId: string) {
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
  async getPersonnelById(personnelId: string) {
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
  async deleteAward(id: string, adminUsername: string = 'Admin') {
    const award = await prisma.kyNiemChuongVSNXDQDNDVN.findUnique({
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
    await prisma.kyNiemChuongVSNXDQDNDVN.delete({
      where: { id },
    });

    // KNC VSNXD không ảnh hưởng đến hồ sơ hằng năm, niên hạn hay cống hiến
    // Không cần recalculate

    // Gửi thông báo cho Manager và quân nhân
    try {
      await notificationHelper.notifyOnAwardDeleted(
        award,
        personnel,
        'KNC_VSNXD_QDNDVN',
        adminUsername
      );
    } catch (notifyError) {
      writeSystemLog({
        action: 'ERROR',
        resource: 'commemorative-medals',
        resourceId: id,
        description: `Lỗi gửi thông báo xóa khen thưởng KNC VSNXD: ${notifyError}`,
      });
    }

    return {
      message: 'Xóa khen thưởng KNC VSNXD thành công',
      personnelId,
    };
  }
}

export default new CommemorativeMedalService();
