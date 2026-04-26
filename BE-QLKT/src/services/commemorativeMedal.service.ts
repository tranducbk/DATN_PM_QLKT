import { prisma } from '../models';
import { calculateServiceMonths, formatServiceDuration } from '../helpers/serviceYearsHelper';
import ExcelJS from 'exceljs';
import { loadWorkbook, getAndValidateWorksheet } from '../helpers/excelImportHelper';

import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import * as notificationHelper from '../helpers/notification';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { ValidationError, NotFoundError } from '../middlewares/errorHandler';
import { parseHeaderMap, getHeaderCol, resolvePersonnelInfo, buildPendingKeys, sanitizeRowData, validatePersonnelNameMatch } from '../helpers/excelHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { buildTemplate, TemplateColumn, styleHeaderRow } from '../helpers/excelTemplateHelper';
import { IMPORT_TRANSACTION_TIMEOUT } from '../constants/excel.constants';
import { DANH_HIEU_MAP, KNC_YEARS_REQUIRED_NAM, KNC_YEARS_REQUIRED_NU } from '../constants/danhHieu.constants';
import { GENDER } from '../constants/gender.constants';

export interface CommemorativeMedalValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string | null;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  thang: number;
  so_quyet_dinh: string;
  ghi_chu: string | null;
  service_years: number;
  gioi_tinh: string;
  history: Array<{ nam: number; so_quyet_dinh: string | null }>;
}

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
      { header: 'Ngày sinh', key: 'ngay_sinh', width: 14 },
      { header: 'Cơ quan đơn vị', key: 'co_quan_don_vi', width: 20 },
      { header: 'Đơn vị trực thuộc', key: 'don_vi_truc_thuoc', width: 20 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Năm (*)', key: 'nam', width: 10 },
      { header: 'Tháng (*)', key: 'thang', width: 10, validationFormulae: '"1,2,3,4,5,6,7,8,9,10,11,12"' },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
    ];

    return buildTemplate({
      sheetName: 'KNC VSNXD QDNDVN',
      columns,
      personnelIds,
      repeatMap,
      loaiKhenThuong: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      editableColumnLetters: ['K'],
    });
  }

  /**
   * Previews KNC VSNXD import from Excel (validation only, no DB writes).
   * Returns valid rows with history and detailed validation errors.
   */
  async previewImport(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, { sheetName: 'KNC VSNXD QDNDVN' });

    // Header map
    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const thangCol = getHeaderCol(headerMap, ['thang', 'month', 'tháng']);
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

    const allPersonnelIds = new Set<string>();
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      if (idValue) {
        const pid = String(idValue).trim();
        if (pid) allPersonnelIds.add(pid);
      }
    }

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

    const pendingPersonnelIds = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_nien_han',
      (item) => item.personnel_id ? String(item.personnel_id) : null
    );

    const personnelMap = new Map(personnelList.map(p => [p.id, p]));
    const existingKncMap = new Map(existingKncList.map(k => [k.quan_nhan_id, k]));
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
      const namVal = row.getCell(namCol).value;
      const thangVal = thangCol ? row.getCell(thangCol).value : null;
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
      const so_quyet_dinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

      if (!idValue && !namVal) continue;

      total++;

      const missingFields = [];
      if (!idValue) missingFields.push('ID');
      if (!namVal) missingFields.push('Năm');
      if (!thangVal) missingFields.push('Tháng');
      if (missingFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          message: `Thiếu ${missingFields.join(', ')}`,
        });
        continue;
      }

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

      const nameMismatch = validatePersonnelNameMatch(ho_ten, personnel.ho_ten);
      if (nameMismatch) {
        errors.push({ row: rowNumber, ho_ten, nam: namVal, message: nameMismatch });
        continue;
      }

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

      const thang = parseInt(String(thangVal), 10);
      if (!Number.isInteger(thang) || thang < 1 || thang > 12) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          thang: thangVal,
          message: `Tháng "${thangVal}" không hợp lệ. Chỉ được nhập 1-12`,
        });
        continue;
      }

      // Decision number must exist in the system (not just non-empty)
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

      // KNC is a one-time award — reject if same person appears twice in file
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

      // KNC already awarded — lifetime limit reached
      const existingKnc = existingKncMap.get(personnel.id);
      if (existingKnc) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Quân nhân đã được tặng ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} (năm ${existingKnc.nam})`,
        });
        continue;
      }

      if (pendingPersonnelIds.has(personnelId)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Quân nhân đang có đề xuất ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} chờ duyệt`,
        });
        continue;
      }

      // Eligibility depends on gender and service start date
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
      const referenceDate = new Date(nam, thang, 0); // last day of selected month — eligibility reference date
      const serviceMonths = calculateServiceMonths(ngayNhapNgu, referenceDate);
      const isFemale = personnel.gioi_tinh === GENDER.FEMALE;
      const requiredYears = isFemale ? KNC_YEARS_REQUIRED_NU : KNC_YEARS_REQUIRED_NAM;

      const requiredMonths = requiredYears * 12;
      if (serviceMonths < requiredMonths) {
        const diff = requiredMonths - serviceMonths;
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          thang,
          message: `Chưa đủ điều kiện: ${isFemale ? 'Nữ' : 'Nam'} cần >= ${requiredYears} năm phục vụ, hiện ${formatServiceDuration(serviceMonths)}, còn thiếu ${formatServiceDuration(diff)}`,
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
        thang,
        so_quyet_dinh,
        ghi_chu,
        service_years: Math.floor(serviceMonths / 12),
        gioi_tinh: personnel.gioi_tinh ?? GENDER.MALE,
        history,
      });
    }

    return { total, valid, errors };
  }

  /**
   * Persists validated import rows into the database.
   */
  async confirmImport(validItems: CommemorativeMedalValidItem[], adminId: string) {
    const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

    // Parallel: check pending proposals + existing records
    const [pendingProposals, existingRecords] = await Promise.all([
      prisma.bangDeXuat.findMany({
        where: { loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN, status: PROPOSAL_STATUS.PENDING },
      }),
      prisma.kyNiemChuongVSNXDQDNDVN.findMany({
        where: { quan_nhan_id: { in: personnelIds } },
        select: { quan_nhan_id: true, nam: true },
      }),
    ]);

    const pendingPersonnelIds = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_nien_han',
      (item) => item.personnel_id ? String(item.personnel_id) : null
    );
    const pendingConflicts: string[] = [];
    for (const item of validItems) {
      if (pendingPersonnelIds.has(item.personnel_id)) {
        pendingConflicts.push(
          `${item.ho_ten}: đang có đề xuất ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} chờ duyệt`
        );
      }
    }
    if (pendingConflicts.length > 0) {
      throw new ValidationError(pendingConflicts.join('; '));
    }
    const existingSet = new Set(existingRecords.map(r => r.quan_nhan_id));

    const conflicts: string[] = [];
    for (const item of validItems) {
      if (existingSet.has(item.personnel_id)) {
        conflicts.push(`${item.ho_ten}: đã có ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} trên hệ thống`);
      }
    }
    if (conflicts.length > 0) {
      throw new ValidationError(conflicts.join('; '));
    }

    return await prisma.$transaction(
      async prismaTx => {
        const results = [];
        for (const item of validItems) {
          const result = await prismaTx.kyNiemChuongVSNXDQDNDVN.upsert({
            where: { quan_nhan_id: item.personnel_id },
            update: {
              nam: item.nam,
              thang: item.thang ?? 12,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
            create: {
              quan_nhan_id: item.personnel_id,
              nam: item.nam,
              thang: item.thang ?? 12,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
          });
          results.push(result);
        }
        return { imported: results.length, data: results };
      },
      { timeout: IMPORT_TRANSACTION_TIMEOUT }
    );
  }

  /**
   * Get all Commemorative Medals with filters and pagination
   */
  async getAll(filters: Record<string, unknown> = {}, page: number = 1, limit: number = 50) {
    const where: Record<string, unknown> = {};

    const quanNhanFilter: Record<string, unknown> = {};
    if (filters.ho_ten) {
      quanNhanFilter.ho_ten = { contains: filters.ho_ten, mode: 'insensitive' };
    }

    if (filters.don_vi_id) {
      if (filters.include_sub_units) {
        // include_sub_units: expand filter to all DVTT under the parent unit
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

    styleHeaderRow(worksheet);

    // Convert {years, months} object to total months
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
        } catch (error) {
   console.error('Failed to parse thoi_gian JSON when exporting commemorative medals:', error);
          return thoiGian;
        }
      }
      return '';
    };

    data.forEach((item, index) => {
      worksheet.addRow(sanitizeRowData({
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
      }));
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
   * @param {string} adminUsername - Admin username performing the deletion
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

    // Delete award only, proposals are kept for audit trail
    await prisma.kyNiemChuongVSNXDQDNDVN.delete({
      where: { id },
    });

    // KNC VSNXD does not affect annual/tenure/contribution profiles

    try {
      await notificationHelper.notifyOnAwardDeleted(
        award,
        personnel,
        PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
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
