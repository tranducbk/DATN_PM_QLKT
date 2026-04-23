import { prisma } from '../models';
import ExcelJS from 'exceljs';
import { loadWorkbook, getAndValidateWorksheet } from '../helpers/excelImportHelper';
import profileService from './profile.service';
import * as notificationHelper from '../helpers/notification';
import { resolveDanhHieuCode, buildDanhHieuExcelOptions, DANH_HIEU_NCKH } from '../constants/danhHieu.constants';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { NotFoundError, ValidationError } from '../middlewares/errorHandler';
import { buildTemplate, TemplateColumn } from '../helpers/excelTemplateHelper';
import { parseHeaderMap, getHeaderCol, resolvePersonnelInfo, sanitizeRowData } from '../helpers/excelHelper';
import { IMPORT_TRANSACTION_TIMEOUT } from '../constants/excel.constants';
import { VALID_NCKH } from './proposal/helpers';

interface CreateAchievementData {
  personnel_id: string;
  nam: number;
  loai: string;
  mo_ta: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
}

interface UpdateAchievementData {
  nam?: number;
  loai?: string;
  mo_ta?: string;
  cap_bac?: string;
  chuc_vu?: string;
  ghi_chu?: string;
}

interface ExportFilters {
  nam?: number;
  loai?: string;
  don_vi_id?: string;
}

interface PreviewError {
  row: number;
  ho_ten: string;
  nam: number | unknown;
  loai?: string;
  message: string;
}

interface PreviewValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  loai: string;
  mo_ta: string;
  so_quyet_dinh: string | null;
  ghi_chu: string | null;
  history: {
    nam: number;
    loai: string;
    mo_ta: string;
    so_quyet_dinh: string | null;
  }[];
}

export interface ConfirmImportItem {
  personnel_id: string;
  nam: number;
  loai: string;
  mo_ta: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
}

class ScientificAchievementService {
  async getAchievements(personnelId: string) {
    if (!personnelId) {
      throw new ValidationError('personnel_id là bắt buộc');
    }

    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnelId },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    const achievements = await prisma.thanhTichKhoaHoc.findMany({
      where: { quan_nhan_id: personnelId },
      orderBy: { nam: 'desc' },
    });

    return achievements;
  }

  async createAchievement(data: CreateAchievementData) {
    const { personnel_id, nam, loai, mo_ta, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu } = data;

    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnel_id },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    const validLoai = VALID_NCKH as readonly string[];
    if (!validLoai.includes(loai)) {
      throw new ValidationError('Loại thành tích không hợp lệ. Loại hợp lệ: ' + validLoai.join(', '));
    }

    const newAchievement = await prisma.thanhTichKhoaHoc.create({
      data: {
        quan_nhan_id: personnel_id,
        nam,
        loai,
        mo_ta,
        cap_bac: cap_bac || null,
        chuc_vu: chuc_vu || null,
        so_quyet_dinh: so_quyet_dinh || null,
        ghi_chu: ghi_chu || null,
      },
    });

    try {
      await profileService.recalculateAnnualProfile(personnel_id);
    } catch (e) {
      console.error('recalculateAnnualProfile failed:', e);
    }

    return newAchievement;
  }

  async updateAchievement(id: string, data: UpdateAchievementData) {
    const { nam, loai, mo_ta, cap_bac, chuc_vu, ghi_chu } = data;

    const achievement = await prisma.thanhTichKhoaHoc.findUnique({
      where: { id },
    });

    if (!achievement) {
      throw new NotFoundError('Thành tích');
    }

    if (loai) {
      const validLoai = VALID_NCKH as readonly string[];
      if (!validLoai.includes(loai)) {
        throw new ValidationError('Loại thành tích không hợp lệ');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (nam !== undefined) updateData.nam = nam;
    if (loai !== undefined) updateData.loai = loai;
    if (mo_ta !== undefined) updateData.mo_ta = mo_ta;
    if (cap_bac !== undefined) updateData.cap_bac = cap_bac;
    if (chuc_vu !== undefined) updateData.chuc_vu = chuc_vu;
    if (ghi_chu !== undefined) updateData.ghi_chu = ghi_chu;

    const updatedAchievement = await prisma.thanhTichKhoaHoc.update({
      where: { id },
      data: updateData,
    });

    try {
      await profileService.recalculateAnnualProfile(achievement.quan_nhan_id);
    } catch (e) {
      console.error('recalculateAnnualProfile failed:', e);
    }

    return updatedAchievement;
  }

  async deleteAchievement(id: string, adminUsername = 'Admin') {
    const achievement = await prisma.thanhTichKhoaHoc.findUnique({
      where: { id },
      include: {
        QuanNhan: true,
      },
    });

    if (!achievement) {
      throw new NotFoundError('Thành tích');
    }

    const personnelId = achievement.quan_nhan_id;
    const personnel = achievement.QuanNhan;

    await prisma.thanhTichKhoaHoc.delete({
      where: { id },
    });

    try {
      await profileService.recalculateAnnualProfile(personnelId);
    } catch (error) {
      writeSystemLog({ action: 'ERROR', resource: 'scientific-achievements', description: `Lỗi tính lại hồ sơ hằng năm sau khi xóa thành tích NCKH: ${error}` });
    }

    try {
      await notificationHelper.notifyOnAwardDeleted(
        achievement,
        personnel,
        PROPOSAL_TYPES.NCKH,
        adminUsername
      );
    } catch (error) {
      writeSystemLog({ action: 'ERROR', resource: 'scientific-achievements', description: `Lỗi gửi thông báo xóa thành tích NCKH: ${error}` });
    }

    return {
      message: 'Xóa thành tích thành công',
      personnelId,
    };
  }

  async exportToExcel(filters: ExportFilters = {}) {
    const { nam, loai, don_vi_id } = filters;

    const where: Record<string, unknown> = {};
    if (nam) where.nam = nam;
    if (loai) where.loai = loai;
    if (don_vi_id) {
      where.QuanNhan = {
        OR: [{ co_quan_don_vi_id: don_vi_id }, { don_vi_truc_thuoc_id: don_vi_id }],
      };
    }

    const achievements = await prisma.thanhTichKhoaHoc.findMany({
      where,
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
            ChucVu: true,
          },
        },
      },
      orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
      take: 10000,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('NCKH');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Đơn vị', key: 'don_vi', width: 30 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Loại', key: 'loai', width: 15 },
      { header: 'Mô tả', key: 'mo_ta', width: 40 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    achievements.forEach((achievement, index) => {
      const quanNhan = achievement.QuanNhan;
      const donVi = quanNhan?.DonViTrucThuoc?.ten_don_vi ?? quanNhan?.CoQuanDonVi?.ten_don_vi ?? '';

      worksheet.addRow(sanitizeRowData({
        stt: index + 1,
        id: quanNhan?.id ?? '',
        ho_ten: quanNhan?.ho_ten ?? '',
        cap_bac: achievement.cap_bac ?? quanNhan?.cap_bac ?? '',
        chuc_vu: achievement.chuc_vu ?? quanNhan?.ChucVu?.ten_chuc_vu ?? '',
        don_vi: donVi,
        nam: achievement.nam,
        loai: achievement.loai ?? '',
        mo_ta: achievement.mo_ta ?? '',
        so_quyet_dinh: achievement.so_quyet_dinh ?? '',
        ghi_chu: achievement.ghi_chu ?? '',
      }));
    });

    return workbook;
  }

  async generateTemplate(personnelIds: string[] = [], repeatMap: Record<string, number> = {}) {
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
      { header: 'Loại (*)', key: 'loai', width: 20, validationFormulae: buildDanhHieuExcelOptions(Object.values(DANH_HIEU_NCKH)) },
      { header: 'Mô tả (*)', key: 'mo_ta', width: 40 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
    ];

    return buildTemplate({
      sheetName: 'NCKH',
      columns,
      personnelIds,
      repeatMap,
      loaiKhenThuong: PROPOSAL_TYPES.NCKH,
    });
  }

  async previewImport(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, { sheetName: 'NCKH' });

    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
    const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const loaiCol = getHeaderCol(headerMap, ['loai', 'loại']);
    const moTaCol = getHeaderCol(headerMap, ['mo_ta', 'mota', 'mo_t']);
    const soQuyetDinhCol = getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd']);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);

    if (!idCol || !namCol || !loaiCol || !moTaCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm, Loại, Mô tả. Tìm thấy headers: ${Object.keys(headerMap).join(
          ', '
        )}`
      );
    }

    const validLoai = VALID_NCKH as readonly string[];
    const errors: PreviewError[] = [];
    const valid: PreviewValidItem[] = [];
    let total = 0;
    const seenInFile = new Set<string>();
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

    const [personnelList, existingAchievementsList, existingDecisions] = await Promise.all([
      allPersonnelIds.size > 0
        ? prisma.quanNhan.findMany({
            where: { id: { in: [...allPersonnelIds] } },
            select: { id: true, ho_ten: true, cap_bac: true, ChucVu: { select: { ten_chuc_vu: true } } },
          })
        : Promise.resolve([]),
      allPersonnelIds.size > 0
        ? prisma.thanhTichKhoaHoc.findMany({
            where: { quan_nhan_id: { in: [...allPersonnelIds] } },
            select: { quan_nhan_id: true, nam: true, loai: true, mo_ta: true, so_quyet_dinh: true },
          })
        : Promise.resolve([]),
      prisma.fileQuyetDinh.findMany({
        select: { so_quyet_dinh: true },
      }),
    ]);

    const personnelMap = new Map(personnelList.map(p => [p.id, p]));
    // Map<personnelId, records[]> for history
    const achievementsByPersonnel = new Map<string, typeof existingAchievementsList>();
    for (const a of existingAchievementsList) {
      const list = achievementsByPersonnel.get(a.quan_nhan_id) || [];
      list.push(a);
      achievementsByPersonnel.set(a.quan_nhan_id, list);
    }
    // Set<key> for duplicate-in-DB check
    const existingAchievementKeys = new Set(
      existingAchievementsList.map(a => `${a.quan_nhan_id}_${a.nam}_${a.loai}_${a.mo_ta}`)
    );
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
      const namVal = row.getCell(namCol).value;
      const loai_raw = loaiCol ? String(row.getCell(loaiCol).value ?? '').trim() : '';
      const mo_ta = moTaCol ? String(row.getCell(moTaCol).value ?? '').trim() : '';
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
      const so_quyet_dinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

      if (!idValue && !namVal && !loai_raw) continue;

      if (idValue && !loai_raw) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: '',
          message: 'Bỏ qua — không có loại thành tích nào được điền',
        });
        continue;
      }

      total++;

      const missingFields: string[] = [];
      if (!idValue) missingFields.push('ID');
      if (!namVal) missingFields.push('Năm');
      if (!loai_raw) missingFields.push('Loại');
      if (!mo_ta) missingFields.push('Mô tả');
      if (missingFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: loai_raw,
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
          loai: loai_raw,
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
          loai: loai_raw,
          message: `Không tìm thấy quân nhân với ID ${personnelId}`,
        });
        continue;
      }

      const nam = parseInt(String(namVal));
      if (!Number.isInteger(nam)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: loai_raw,
          message: `Giá trị năm không hợp lệ: ${namVal}`,
        });
        continue;
      }
      if (nam < 1900 || nam > currentYear) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai: loai_raw,
          message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
        });
        continue;
      }

      const resolvedLoai = resolveDanhHieuCode(loai_raw);
      if (!validLoai.includes(resolvedLoai)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai: loai_raw,
          message: `Loại "${loai_raw}" không hợp lệ. Chỉ chấp nhận: ${validLoai.join(', ')}`,
        });
        continue;
      }
      const loai = resolvedLoai;

      if (!so_quyet_dinh) {
        errors.push({ row: rowNumber, ho_ten, nam, loai, message: 'Thiếu số quyết định' });
        continue;
      }
      if (!validDecisionNumbers.has(so_quyet_dinh)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai,
          message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
        });
        continue;
      }

      const fileKey = `${personnel.id}_${nam}_${loai}_${mo_ta}`;
      if (seenInFile.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai,
          message: `Trùng lặp trong file — cùng quân nhân, năm ${nam}, loại ${loai}, mô tả "${mo_ta}"`,
        });
        continue;
      }
      seenInFile.add(fileKey);

      if (existingAchievementKeys.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai,
          message: 'Thành tích khoa học đã tồn tại',
        });
        continue;
      }

      const allRecords = achievementsByPersonnel.get(personnel.id) || [];
      const history = [...allRecords]
        .sort((a, b) => b.nam - a.nam)
        .slice(0, 5)
        .map(r => ({
          nam: r.nam,
          loai: r.loai,
          mo_ta: r.mo_ta,
          so_quyet_dinh: r.so_quyet_dinh,
        }));

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
        loai,
        mo_ta,
        so_quyet_dinh,
        ghi_chu,
        history,
      });
    }

    return { total, valid, errors };
  }

  async confirmImport(validItems: ConfirmImportItem[], adminId: string) {
    return await prisma.$transaction(
      async prismaTx => {
        const results = [];
        for (const item of validItems) {
          const result = await prismaTx.thanhTichKhoaHoc.create({
            data: {
              quan_nhan_id: item.personnel_id,
              nam: item.nam,
              loai: item.loai,
              mo_ta: item.mo_ta,
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
      { timeout: IMPORT_TRANSACTION_TIMEOUT }
    );
  }

  /**
   * Returns paginated list of scientific achievements with optional filters.
   * @param params - Filter and pagination params
   * @returns Achievements list and total count
   */
  async getAchievementsList(params: {
    page: number;
    limit: number;
    nam?: string;
    loai?: string;
    quanNhanWhere?: Record<string, unknown> | null;
  }) {
    const { page, limit, nam, loai, quanNhanWhere } = params;
    const where: Record<string, unknown> = {};
    if (nam) where.nam = parseInt(nam);
    if (loai) where.loai = loai;
    if (quanNhanWhere) where.QuanNhan = quanNhanWhere;

    const [achievements, total] = await Promise.all([
      prisma.thanhTichKhoaHoc.findMany({
        where,
        include: { QuanNhan: { include: { CoQuanDonVi: true, DonViTrucThuoc: true, ChucVu: true } } },
        orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.thanhTichKhoaHoc.count({ where }),
    ]);

    return { achievements, total };
  }
}

export default new ScientificAchievementService();
