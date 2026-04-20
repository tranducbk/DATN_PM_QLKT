import { prisma } from '../models';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import ExcelJS from 'exceljs';
import { loadWorkbook, getAndValidateWorksheet } from '../helpers/excelImportHelper';
import * as notificationHelper from '../helpers/notification';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { ValidationError, NotFoundError } from '../middlewares/errorHandler';
import { parseHeaderMap, getHeaderCol, resolvePersonnelInfo, buildPendingKeys, sanitizeRowData } from '../helpers/excelHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { buildTemplate, TemplateColumn } from '../helpers/excelTemplateHelper';
import { IMPORT_TRANSACTION_TIMEOUT } from '../constants/excel.constants';
import { HCQKQT_YEARS_REQUIRED } from '../constants/danhHieu.constants';

interface PreviewError {
  row: number;
  ho_ten: string;
  nam: number | unknown;
  message: string;
}

interface PreviewValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  so_quyet_dinh: string | null;
  ghi_chu: string | null;
  history: {
    nam: number;
    so_quyet_dinh: string | null;
  }[];
}

export interface ConfirmImportItem {
  personnel_id: string;
  ho_ten: string;
  nam: number;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
}

interface MilitaryFlagFilters {
  ho_ten?: string;
  don_vi_id?: string;
  include_sub_units?: boolean;
  nam?: number;
}

class MilitaryFlagService {
  async previewImport(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, { sheetName: 'HC QKQT' });

    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
    const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const soQuyetDinhCol = getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd']);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);

    if (!idCol || !namCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
      );
    }

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

    const [personnelList, existingAwardsList, existingDecisions, pendingProposals] = await Promise.all([
      allPersonnelIds.size > 0
        ? prisma.quanNhan.findMany({
            where: { id: { in: [...allPersonnelIds] } },
            select: { id: true, ho_ten: true, cap_bac: true, ngay_nhap_ngu: true, ChucVu: { select: { ten_chuc_vu: true } } },
          })
        : Promise.resolve([]),
      allPersonnelIds.size > 0
        ? prisma.huanChuongQuanKyQuyetThang.findMany({
            where: { quan_nhan_id: { in: [...allPersonnelIds] } },
          })
        : Promise.resolve([]),
      prisma.fileQuyetDinh.findMany({
        select: { so_quyet_dinh: true },
      }),
      prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.HC_QKQT,
          status: PROPOSAL_STATUS.PENDING,
        },
      }),
    ]);

    const pendingPersonnelIds = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_nien_han',
      (item) => item.personnel_id as string
    );

    const personnelMap = new Map(personnelList.map(p => [p.id, p]));
    const existingAwardsMap = new Map(existingAwardsList.map(a => [a.quan_nhan_id, a]));
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

      if (!idValue && !namVal) continue;

      total++;

      const missingFields: string[] = [];
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

      if (seenInFile.has(personnelId)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Trùng lặp trong file — quân nhân ${ho_ten ?? personnel.ho_ten} đã xuất hiện ở dòng trước`,
        });
        continue;
      }
      seenInFile.add(personnelId);

      const existingAward = existingAwardsMap.get(personnelId);
      if (existingAward) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Quân nhân đã có HC QKQT trên hệ thống (năm ${existingAward.nam})`,
        });
        continue;
      }

      if (pendingPersonnelIds.has(personnelId)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: 'Quân nhân đang có đề xuất HC Quân kỳ quyết thắng chờ duyệt',
        });
        continue;
      }

      if (personnel.ngay_nhap_ngu) {
        const nhapNguDate = new Date(personnel.ngay_nhap_ngu);
        const yearsServed = nam - nhapNguDate.getFullYear();
        if (yearsServed < HCQKQT_YEARS_REQUIRED) {
          errors.push({
            row: rowNumber,
            ho_ten,
            nam,
            message: `Chưa đủ ${HCQKQT_YEARS_REQUIRED} năm phục vụ (mới ${yearsServed} năm, nhập ngũ ${nhapNguDate.getFullYear()})`,
          });
          continue;
        }
      }

      // History from batched data — existingAward is already checked as null/undefined here,
      // so history is always empty (person has no HC QKQT yet). Keep the structure for consistency.
      const history = existingAward
        ? [{ nam: existingAward.nam, so_quyet_dinh: existingAward.so_quyet_dinh }]
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
        personnel_id: personnelId,
        ho_ten: hoTen,
        cap_bac: capBac,
        chuc_vu: chucVu,
        nam,
        so_quyet_dinh,
        ghi_chu,
        history,
      });
    }

    return { total, valid, errors };
  }

  async confirmImport(validItems: ConfirmImportItem[]) {
    const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

    // Parallel: check pending proposals + existing records
    const [pendingProposals, existingRecords] = await Promise.all([
      prisma.bangDeXuat.findMany({
        where: { loai_de_xuat: PROPOSAL_TYPES.HC_QKQT, status: PROPOSAL_STATUS.PENDING },
      }),
      prisma.huanChuongQuanKyQuyetThang.findMany({
        where: { quan_nhan_id: { in: personnelIds } },
        select: { quan_nhan_id: true, nam: true },
      }),
    ]);

    const pendingPersonnelIds = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_nien_han',
      (item) => item.personnel_id as string
    );
    const pendingConflicts: string[] = [];
    for (const item of validItems) {
      if (pendingPersonnelIds.has(item.personnel_id)) {
        pendingConflicts.push(`${item.ho_ten}: đang có đề xuất HC Quân kỳ quyết thắng chờ duyệt`);
      }
    }
    if (pendingConflicts.length > 0) {
      throw new ValidationError(pendingConflicts.join('; '));
    }
    const existingSet = new Set(existingRecords.map(r => r.quan_nhan_id));

    const conflicts: string[] = [];
    for (const item of validItems) {
      if (existingSet.has(item.personnel_id)) {
        conflicts.push(
          `${item.ho_ten}: đã có Huy chương Quân kỳ quyết thắng trên hệ thống`
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
          const result = await tx.huanChuongQuanKyQuyetThang.upsert({
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
      { timeout: IMPORT_TRANSACTION_TIMEOUT }
    );
  }

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
      sheetName: 'HC QKQT',
      columns,
      personnelIds,
      repeatMap,
      loaiKhenThuong: PROPOSAL_TYPES.HC_QKQT,
      editableColumnLetters: ['G'],
    });
  }

  async getAll(
    filters: MilitaryFlagFilters = {},
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
      prisma.huanChuongQuanKyQuyetThang.findMany({
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
      prisma.huanChuongQuanKyQuyetThang.count({ where }),
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

  async exportToExcel(filters: MilitaryFlagFilters = {}) {
    const { data } = await this.getAll(filters, 1, 10000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('HCQKQT');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
      { header: 'Đơn vị', key: 'don_vi', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    data.forEach((item, index) => {
      worksheet.addRow(sanitizeRowData({
        stt: index + 1,
        id: item.quan_nhan_id,
        ho_ten: item.QuanNhan?.ho_ten ?? '',
        cap_bac: item.cap_bac ?? '',
        chuc_vu: item.chuc_vu ?? '',
        nam: item.nam,
        so_quyet_dinh: item.so_quyet_dinh ?? '',
        ghi_chu: item.ghi_chu ?? '',
        don_vi:
          item.QuanNhan?.CoQuanDonVi?.ten_don_vi ?? item.QuanNhan?.DonViTrucThuoc?.ten_don_vi ?? '',
      }));
    });

    return await workbook.xlsx.writeBuffer();
  }

  async getStatistics() {
    const byYear = await prisma.huanChuongQuanKyQuyetThang.groupBy({
      by: ['nam'],
      _count: { id: true },
      orderBy: { nam: 'desc' },
    });

    const total = await prisma.huanChuongQuanKyQuyetThang.count();

    return {
      total,
      byYear,
    };
  }

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

  async getByPersonnelId(personnelId: string) {
    const result = await prisma.huanChuongQuanKyQuyetThang.findUnique({
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

  async getPersonnelById(personnelId: string) {
    return await prisma.quanNhan.findUnique({
      where: { id: personnelId },
      select: {
        co_quan_don_vi_id: true,
        don_vi_truc_thuoc_id: true,
      },
    });
  }

  async deleteAward(id: string, adminUsername = 'Admin') {
    const award = await prisma.huanChuongQuanKyQuyetThang.findUnique({
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

    await prisma.huanChuongQuanKyQuyetThang.delete({
      where: { id },
    });

    try {
      await notificationHelper.notifyOnAwardDeleted(award, personnel, 'HCQKQT', adminUsername);
    } catch (error) {
      writeSystemLog({
        action: 'ERROR',
        resource: 'military-flag',
        resourceId: id,
        description: `Lỗi gửi thông báo xóa khen thưởng HCQKQT: ${error}`,
      });
    }

    return {
      message: 'Xóa khen thưởng HCQKQT thành công',
      personnelId,
    };
  }
}

export default new MilitaryFlagService();
