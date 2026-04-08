import { prisma } from '../models';
import ExcelJS from 'exceljs';
import { loadWorkbook, getAndValidateWorksheet } from '../helpers/excelImportHelper';
import { checkDuplicateAward } from '../helpers/awardValidation';
import profileService from './profile.service';
import * as notificationHelper from '../helpers/notification';
import { getDanhHieuName } from '../constants/danhHieu.constants';
import { ROLES } from '../constants/roles.constants';
import { ValidationError, NotFoundError } from '../middlewares/errorHandler';
import { parseHeaderMap, getHeaderCol, resolvePersonnelInfo, buildPendingKeys } from '../helpers/excelHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { buildTemplate, TemplateColumn } from '../helpers/excelTemplateHelper';
import { IMPORT_TRANSACTION_TIMEOUT } from '../constants/excel.constants';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';

interface ContributionAwardValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string | null;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  danh_hieu: string;
  so_quyet_dinh: string;
  ghi_chu: string | null;
  history: Array<{ nam: number; danh_hieu: string; so_quyet_dinh: string | null }>;
}

class ContributionAwardService {
  /**
   * Export template Excel for Contribution Awards (HCBVTQ) import
   * @param {string[]} personnelIds - Pre-fill with selected personnel
   * @param {string} userRole
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
      sheetName: 'HCBVTQ',
      columns,
      personnelIds,
      repeatMap,
      loaiKhenThuong: PROPOSAL_TYPES.CONG_HIEN,
      danhHieuOptions: '"HCBVTQ_HANG_BA,HCBVTQ_HANG_NHI,HCBVTQ_HANG_NHAT"',
      editableColumnLetters: ['G', 'H'],
    });
  }

  /**
   * Preview import HCBVTQ từ Excel (chỉ validate, không ghi DB)
   * Trả về danh sách valid items kèm lịch sử, và danh sách lỗi
   */
  async previewImport(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, { sheetName: 'HCBVTQ' });

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

    const allPersonnelIds = new Set<string>();
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      if (idValue) {
        const pid = String(idValue).trim();
        if (pid) allPersonnelIds.add(pid);
      }
    }

    const [personnelList, existingAwardsList, allPositionHistories, existingDecisions, pendingProposals] =
      await Promise.all([
        allPersonnelIds.size > 0
          ? prisma.quanNhan.findMany({
              where: { id: { in: [...allPersonnelIds] } },
              select: { id: true, ho_ten: true, gioi_tinh: true, cap_bac: true, ChucVu: { select: { ten_chuc_vu: true } } },
            })
          : Promise.resolve([]),
        allPersonnelIds.size > 0
          ? prisma.khenThuongCongHien.findMany({
              where: { quan_nhan_id: { in: [...allPersonnelIds] } },
            })
          : Promise.resolve([]),
        allPersonnelIds.size > 0
          ? prisma.lichSuChucVu.findMany({
              where: { quan_nhan_id: { in: [...allPersonnelIds] } },
              include: { ChucVu: { select: { he_so_chuc_vu: true } } },
            })
          : Promise.resolve([]),
        prisma.fileQuyetDinh.findMany({
          select: { so_quyet_dinh: true },
        }),
        prisma.bangDeXuat.findMany({
          where: { loai_de_xuat: PROPOSAL_TYPES.CONG_HIEN, status: PROPOSAL_STATUS.PENDING },
        }),
      ]);

    const personnelMap = new Map(personnelList.map(p => [p.id, p]));
    const existingAwardsMap = new Map(existingAwardsList.map(a => [a.quan_nhan_id, a]));
    const positionHistoriesMap = new Map<string, typeof allPositionHistories>();
    for (const h of allPositionHistories) {
      const list = positionHistoriesMap.get(h.quan_nhan_id) ?? [];
      list.push(h);
      positionHistoriesMap.set(h.quan_nhan_id, list);
    }
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

    const pendingPersonnelIds = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_cong_hien',
      (item) => item.personnel_id ? String(item.personnel_id) : null
    );

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

      // Decision number must exist in the system (not just non-empty)
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

      // HC BVTQ is a one-time lifetime award — reject if same person appears twice
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

      if (pendingPersonnelIds.has(personnelId)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: 'Quân nhân đang có đề xuất HC Bảo vệ Tổ quốc chờ duyệt',
        });
        continue;
      }

      // HC BVTQ can only be awarded once per lifetime
      const existingAward = existingAwardsMap.get(personnelId);
      if (existingAward) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Đã có ${getDanhHieuName(existingAward.danh_hieu)} trên hệ thống`,
        });
        continue;
      }

      // Eligibility: minimum position tenure per salary-band group
      const positionHistories = positionHistoriesMap.get(personnelId) ?? [];

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
      // 120 months (10 yrs) for male, 80 months (~6.7 yrs) for female
      const baseMonths = isFemale ? 80 : 120;

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

      const history: { nam: number; danh_hieu: string; so_quyet_dinh: string | null }[] = [];

      const { hoTen, capBac, chucVu, missingFields: missingInfoFields } = resolvePersonnelInfo(
        { ho_ten, cap_bac, chuc_vu },
        personnel
      );
      if (missingInfoFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten: hoTen,
          nam,
          danh_hieu,
          message: `Thiếu ${missingInfoFields.join(', ')} (cả trong file và hệ thống)`,
        });
        continue;
      }

      valid.push({
        row: rowNumber,
        personnel_id: personnelId,
        ho_ten: hoTen,
        cap_bac: capBac,
        chuc_vu: chucVu,
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
   * HCBVTQ is one-time-per-lifetime — block if person already has any record
   */
  async confirmImport(validItems: ContributionAwardValidItem[], adminId: string) {
    const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

    // Parallel: check pending proposals + existing records
    const [pendingProposals, existingRecords] = await Promise.all([
      prisma.bangDeXuat.findMany({
        where: { loai_de_xuat: PROPOSAL_TYPES.CONG_HIEN, status: PROPOSAL_STATUS.PENDING },
      }),
      prisma.khenThuongCongHien.findMany({
        where: { quan_nhan_id: { in: personnelIds } },
        select: { quan_nhan_id: true, danh_hieu: true },
      }),
    ]);

    const pendingPersonnelIds = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_cong_hien',
      (item) => item.personnel_id ? String(item.personnel_id) : null
    );
    const pendingConflicts: string[] = [];
    for (const item of validItems) {
      if (pendingPersonnelIds.has(item.personnel_id)) {
        pendingConflicts.push(`${item.ho_ten}: đang có đề xuất HC Bảo vệ Tổ quốc chờ duyệt`);
      }
    }
    if (pendingConflicts.length > 0) {
      throw new ValidationError(pendingConflicts.join('; '));
    }
    const existingMap = new Map(existingRecords.map(r => [r.quan_nhan_id, r]));

    const conflicts: string[] = [];
    for (const item of validItems) {
      const existing = existingMap.get(item.personnel_id);
      if (existing) {
        conflicts.push(
          `${item.ho_ten}: đã có ${getDanhHieuName(existing.danh_hieu)} trên hệ thống`
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
          const result = await tx.khenThuongCongHien.create({
            data: {
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
      { timeout: IMPORT_TRANSACTION_TIMEOUT }
    );
  }

  /**
   * Get all Contribution Awards with filters and pagination
   */
  async getAll(
    filters: Record<string, unknown> = {},
    page: number = 1,
    limit: number = 50
  ) {
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
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { nam: 'desc' },
      }),
      prisma.khenThuongCongHien.count({ where }),
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
   * Export Contribution Awards to Excel
   */
  async exportToExcel(filters: Record<string, any> = {}) {
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

    // Convert {years, months} object to total months
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
   * Delete Contribution Award
   * @param {string} id - Award ID
   * @param {string} adminUsername - Username của admin thực hiện xóa
   * @returns {Promise<Object>}
   */
  async deleteAward(id: string, adminUsername: string = 'Admin') {
    const award = await prisma.khenThuongCongHien.findUnique({
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
    await prisma.khenThuongCongHien.delete({
      where: { id },
    });

    try {
      await profileService.recalculateContributionProfile(personnelId);
    } catch (recalcError) {
      writeSystemLog({
        action: 'ERROR',
        resource: 'contribution-awards',
        resourceId: id,
        description: `Lỗi tính lại hồ sơ cống hiến sau khi xóa HCBVTQ: ${recalcError}`,
      });
    }

    try {
      await notificationHelper.notifyOnAwardDeleted(award, personnel, 'HCBVTQ', adminUsername);
    } catch (notifyError) {
      writeSystemLog({
        action: 'ERROR',
        resource: 'contribution-awards',
        resourceId: id,
        description: `Lỗi gửi thông báo xóa khen thưởng HCBVTQ: ${notifyError}`,
      });
    }

    return {
      message: 'Xóa khen thưởng HCBVTQ thành công',
      personnelId,
    };
  }
}

export default new ContributionAwardService();
