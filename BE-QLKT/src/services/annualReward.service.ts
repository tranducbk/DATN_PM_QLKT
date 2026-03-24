import { prisma } from '../models';
import ExcelJS from 'exceljs';
import proposalService from './proposal';
import { checkDuplicateAward } from './proposal/validation';
import profileService from './profile.service';
import * as notificationHelper from '../helpers/notification';
import { formatDanhHieuList, getDanhHieuName } from '../constants/danhHieu.constants';
import { ROLES } from '../constants/roles';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { NotFoundError, ValidationError } from '../middlewares/errorHandler';
import { parseHeaderMap, getHeaderCol, parseBooleanValue } from '../helpers/excelHelper';
import type { DanhHieuHangNam, QuanNhan, Prisma } from '../generated/prisma';

interface CreateAnnualRewardData {
  personnel_id: string;
  nam: number;
  danh_hieu?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  ghi_chu?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
}

interface UpdateAnnualRewardData {
  nam?: number;
  danh_hieu?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  ghi_chu?: string | null;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
}

interface ImportResult {
  imported: number;
  total: number;
  errors: string[];
  selectedPersonnelIds: string[];
  titleData: Record<string, unknown>[];
}

interface PreviewError {
  row: number;
  ho_ten: string;
  nam: unknown;
  danh_hieu?: string;
  message: string;
}

interface PreviewValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  danh_hieu: string;
  so_quyet_dinh: string | null;
  ghi_chu: string | null;
  history: Record<string, unknown>[];
}

interface PreviewResult {
  total: number;
  valid: PreviewValidItem[];
  errors: PreviewError[];
}

interface ConfirmImportItem {
  personnel_id: string;
  nam: number;
  danh_hieu: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
}

interface CheckResult {
  personnel_id: string;
  has_reward: boolean;
  has_proposal: boolean;
  reward: Record<string, unknown> | null;
  proposal: Record<string, unknown> | null;
}

interface BulkCreateData {
  personnel_ids: string[];
  personnel_rewards_data?: {
    personnel_id: string;
    so_quyet_dinh?: string;
    cap_bac?: string;
    chuc_vu?: string;
  }[];
  nam: number;
  danh_hieu: string;
  ghi_chu?: string;
  so_quyet_dinh?: string;
  cap_bac?: string;
  chuc_vu?: string;
}

interface ExportFilters {
  nam?: number;
  danh_hieu?: string;
  don_vi_id?: string;
  personnel_ids?: string[];
}

interface StatisticsFilters {
  nam?: number;
  don_vi_id?: string;
}

class AnnualRewardService {
  async getAnnualRewards(personnelId: string): Promise<DanhHieuHangNam[]> {
    if (!personnelId) {
      throw new ValidationError('Thiếu thông tin quân nhân cần tra cứu.');
    }

    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnelId },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    const rewards = await prisma.danhHieuHangNam.findMany({
      where: { quan_nhan_id: personnelId },
      orderBy: {
        nam: 'desc',
      },
    });

    return rewards;
  }

  async createAnnualReward(data: CreateAnnualRewardData): Promise<DanhHieuHangNam> {
    const {
      personnel_id,
      nam,
      danh_hieu,
      cap_bac,
      chuc_vu,
      ghi_chu,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp,
      nhan_cstdtq,
      so_quyet_dinh_cstdtq,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp,
    } = data;

    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnel_id },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    const validDanhHieu = ['CSTDCS', 'CSTT'];
    if (danh_hieu && !validDanhHieu.includes(danh_hieu)) {
      throw new ValidationError(
        `Danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList(validDanhHieu)}. Để trống nghĩa là không đạt danh hiệu.`
      );
    }

    const existingReward = await prisma.danhHieuHangNam.findFirst({
      where: {
        quan_nhan_id: personnel_id,
        nam,
      },
    });

    if (existingReward) {
      throw new ValidationError(`Năm ${nam} đã có danh hiệu cho quân nhân này.`);
    }

    const newReward = await prisma.danhHieuHangNam.create({
      data: {
        quan_nhan_id: personnel_id,
        nam,
        danh_hieu,
        cap_bac: cap_bac || null,
        chuc_vu: chuc_vu || null,
        ghi_chu: ghi_chu || null,
        nhan_bkbqp: nhan_bkbqp || false,
        so_quyet_dinh_bkbqp: so_quyet_dinh_bkbqp || null,
        nhan_cstdtq: nhan_cstdtq || false,
        so_quyet_dinh_cstdtq: so_quyet_dinh_cstdtq || null,
        nhan_bkttcp: nhan_bkttcp || false,
        so_quyet_dinh_bkttcp: so_quyet_dinh_bkttcp || null,
      },
    });

    try {
      await profileService.recalculateAnnualProfile(personnel_id);
    } catch {
      // Không throw error
    }

    return newReward;
  }

  async updateAnnualReward(id: string, data: UpdateAnnualRewardData): Promise<DanhHieuHangNam> {
    const {
      nam,
      danh_hieu,
      cap_bac,
      chuc_vu,
      ghi_chu,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp,
      nhan_cstdtq,
      so_quyet_dinh_cstdtq,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp,
    } = data;

    const reward = await prisma.danhHieuHangNam.findUnique({
      where: { id },
    });

    if (!reward) {
      throw new NotFoundError('Danh hiệu hằng năm');
    }

    if (danh_hieu) {
      const validDanhHieu = ['CSTDCS', 'CSTT'];
      if (!validDanhHieu.includes(danh_hieu)) {
        throw new ValidationError(
          `Danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList(validDanhHieu)}. Để trống nghĩa là không đạt danh hiệu.`
        );
      }
    }

    const updatedReward = await prisma.danhHieuHangNam.update({
      where: { id },
      data: {
        nam: nam || reward.nam,
        danh_hieu: danh_hieu || reward.danh_hieu,
        cap_bac: cap_bac !== undefined ? cap_bac : reward.cap_bac,
        chuc_vu: chuc_vu !== undefined ? chuc_vu : reward.chuc_vu,
        ghi_chu: ghi_chu !== undefined ? ghi_chu : reward.ghi_chu,
        nhan_bkbqp: nhan_bkbqp !== undefined ? nhan_bkbqp : reward.nhan_bkbqp,
        so_quyet_dinh_bkbqp:
          so_quyet_dinh_bkbqp !== undefined ? so_quyet_dinh_bkbqp : reward.so_quyet_dinh_bkbqp,
        nhan_cstdtq: nhan_cstdtq !== undefined ? nhan_cstdtq : reward.nhan_cstdtq,
        so_quyet_dinh_cstdtq:
          so_quyet_dinh_cstdtq !== undefined ? so_quyet_dinh_cstdtq : reward.so_quyet_dinh_cstdtq,
        nhan_bkttcp: nhan_bkttcp !== undefined ? nhan_bkttcp : reward.nhan_bkttcp,
        so_quyet_dinh_bkttcp:
          so_quyet_dinh_bkttcp !== undefined ? so_quyet_dinh_bkttcp : reward.so_quyet_dinh_bkttcp,
      },
    });

    try {
      await profileService.recalculateAnnualProfile(reward.quan_nhan_id);
    } catch {
      // Không throw error
    }

    return updatedReward;
  }

  async deleteAnnualReward(
    id: string,
    adminUsername: string = 'Admin'
  ): Promise<{
    message: string;
    personnelId: string;
    personnel: QuanNhan | null;
    reward: DanhHieuHangNam;
  }> {
    const reward = await prisma.danhHieuHangNam.findUnique({
      where: { id },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
          },
        },
      },
    });

    if (!reward) {
      throw new NotFoundError('Danh hiệu hằng năm');
    }

    const personnelId = reward.quan_nhan_id;
    const personnel = reward.QuanNhan;

    await prisma.danhHieuHangNam.delete({
      where: { id },
    });

    try {
      await profileService.recalculateAnnualProfile(personnelId);
    } catch {
      // Không throw error
    }

    try {
      await notificationHelper.notifyOnAwardDeleted(
        reward,
        personnel,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        adminUsername
      );
    } catch {
      // Không throw error
    }

    return {
      message: 'Đã xóa danh hiệu hằng năm.',
      personnelId,
      personnel,
      reward,
    };
  }

  async importFromExcelBuffer(buffer: Buffer): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new ValidationError(
        'Không đọc được file Excel (file trống hoặc không đúng định dạng .xlsx).'
      );
    }

    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu']);
    const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
    const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);
    const bkbqpCol = getHeaderCol(headerMap, ['nhan_bkbqp', 'bkbqp']);
    const cstdtqCol = getHeaderCol(headerMap, ['nhan_cstdtq', 'cstdtq']);
    const bkttcpCol = getHeaderCol(headerMap, ['nhan_bkttcp', 'bkttcp']);

    if (!idCol || !namCol || !danhHieuCol) {
      throw new ValidationError(
        `File thiếu cột bắt buộc (cần có: mã quân nhân hoặc ID, Năm, Danh hiệu). Các cột đang có: ${Object.keys(headerMap).join(', ') || '(trống)'}.`
      );
    }

    if (worksheet.name === 'Khen thưởng đơn vị') {
      throw new ValidationError(
        'Sai loại file: đây là mẫu khen thưởng đơn vị. Vui lòng dùng mẫu danh hiệu cá nhân hằng năm.'
      );
    }

    const validDanhHieu = ['CSTDCS', 'CSTT'];
    const errors: string[] = [];
    const selectedPersonnelIds: string[] = [];
    const titleData: Record<string, unknown>[] = [];
    let total = 0;

    const rowsToProcess: {
      personnel: QuanNhan;
      nam: number;
      danh_hieu: string;
      cap_bac: string | null;
      chuc_vu: string | null;
      ghi_chu: string | null;
      ho_ten: string;
      nhan_bkbqp: boolean;
      nhan_cstdtq: boolean;
      nhan_bkttcp: boolean;
    }[] = [];
    const seenInFile = new Set<string>();
    const currentYear = new Date().getFullYear();

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value || '').trim() : '';
      const namVal = row.getCell(namCol).value;
      const danh_hieu_raw = String(row.getCell(danhHieuCol).value || '').trim();
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value || '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value || '').trim() : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : null;
      const nhan_bkbqp = bkbqpCol ? parseBooleanValue(row.getCell(bkbqpCol).value) : false;
      const nhan_cstdtq = cstdtqCol ? parseBooleanValue(row.getCell(cstdtqCol).value) : false;
      const nhan_bkttcp = bkttcpCol ? parseBooleanValue(row.getCell(bkttcpCol).value) : false;

      if (!idValue && !namVal && !danh_hieu_raw) continue;

      total++;

      const missingFields: string[] = [];
      if (!idValue) missingFields.push('mã quân nhân');
      if (!namVal) missingFields.push('năm');
      if (!danh_hieu_raw) missingFields.push('danh hiệu');
      if (missingFields.length > 0) {
        errors.push(`Dòng ${rowNumber}: Thiếu ${missingFields.join(', ')}`);
        continue;
      }

      const personnelId = String(idValue).trim();
      if (!personnelId) {
        errors.push(`Dòng ${rowNumber}: Mã quân nhân không hợp lệ.`);
        continue;
      }
      const personnel = await prisma.quanNhan.findUnique({ where: { id: personnelId } });
      if (!personnel) {
        errors.push(`Dòng ${rowNumber}: Không tìm thấy quân nhân (mã: ${personnelId}).`);
        continue;
      }

      const nam = parseInt(String(namVal));
      if (!Number.isInteger(nam)) {
        errors.push(`Dòng ${rowNumber}: Giá trị năm không hợp lệ`);
        continue;
      }

      if (nam < 1900 || nam > currentYear) {
        errors.push(`Dòng ${rowNumber}: Năm phải từ 1900 đến ${currentYear} (nhận được: ${nam})`);
        continue;
      }

      const danhHieuUpper = danh_hieu_raw.toUpperCase();
      if (!validDanhHieu.includes(danhHieuUpper)) {
        errors.push(
          `Dòng ${rowNumber}: Danh hiệu "${danh_hieu_raw}" không đúng. Chỉ được nhập: ${formatDanhHieuList(validDanhHieu)}`
        );
        continue;
      }
      const danh_hieu = danhHieuUpper;

      const fileKey = `${personnel.id}_${nam}`;
      if (seenInFile.has(fileKey)) {
        errors.push(
          `Dòng ${rowNumber}: Quân nhân "${ho_ten}" đã xuất hiện ở dòng trước cho năm ${nam} (trùng lặp trong file)`
        );
        continue;
      }
      seenInFile.add(fileKey);

      if (danh_hieu) {
        try {
          const duplicateCheck = await proposalService.checkDuplicateAward(
            personnel.id,
            nam,
            danh_hieu,
            PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
            PROPOSAL_STATUS.APPROVED
          );
          if (duplicateCheck.exists) {
            errors.push(
              `Dòng ${rowNumber}: ${ho_ten} đã có ${getDanhHieuName(danh_hieu)} năm ${nam} (đã được duyệt trước đó)`
            );
            continue;
          }
        } catch {
          // Bỏ qua lỗi check duplicate
        }
      }

      rowsToProcess.push({
        personnel,
        nam,
        danh_hieu,
        cap_bac,
        chuc_vu,
        ghi_chu,
        ho_ten,
        nhan_bkbqp,
        nhan_cstdtq,
        nhan_bkttcp,
      });
    }

    const { created, updated } = await prisma.$transaction(async tx => {
      const txCreated: string[] = [];
      const txUpdated: string[] = [];

      for (const rowData of rowsToProcess) {
        const {
          personnel,
          nam,
          danh_hieu,
          cap_bac,
          chuc_vu,
          ghi_chu,
          nhan_bkbqp,
          nhan_cstdtq,
          nhan_bkttcp,
        } = rowData;

        const existing = await tx.danhHieuHangNam.findFirst({
          where: { quan_nhan_id: personnel.id, nam },
        });

        if (!existing) {
          const createdReward = await tx.danhHieuHangNam.create({
            data: {
              quan_nhan_id: personnel.id,
              nam,
              danh_hieu,
              cap_bac: cap_bac || null,
              chuc_vu: chuc_vu || null,
              ghi_chu: ghi_chu || null,
              nhan_bkbqp: nhan_bkbqp || false,
              nhan_cstdtq: nhan_cstdtq || false,
              nhan_bkttcp: nhan_bkttcp || false,
            },
          });
          txCreated.push(createdReward.id);
        } else {
          await tx.danhHieuHangNam.update({
            where: { id: existing.id },
            data: {
              danh_hieu,
              cap_bac: cap_bac !== undefined ? cap_bac : existing.cap_bac,
              chuc_vu: chuc_vu !== undefined ? chuc_vu : existing.chuc_vu,
              ghi_chu: ghi_chu !== undefined ? ghi_chu : existing.ghi_chu,
              nhan_bkbqp: nhan_bkbqp !== undefined ? nhan_bkbqp : existing.nhan_bkbqp,
              nhan_cstdtq: nhan_cstdtq !== undefined ? nhan_cstdtq : existing.nhan_cstdtq,
              nhan_bkttcp: nhan_bkttcp !== undefined ? nhan_bkttcp : existing.nhan_bkttcp,
            },
          });
          txUpdated.push(existing.id);
        }

        if (!selectedPersonnelIds.includes(personnel.id)) {
          selectedPersonnelIds.push(personnel.id);
        }

        titleData.push({
          personnelId: personnel.id,
          quan_nhan_id: personnel.id,
          danh_hieu: danh_hieu,
          nam: nam,
          cap_bac: cap_bac || null,
          chuc_vu: chuc_vu || null,
          ghi_chu: ghi_chu || null,
          nhan_bkbqp: nhan_bkbqp || false,
          nhan_cstdtq: nhan_cstdtq || false,
          nhan_bkttcp: nhan_bkttcp || false,
          so_quyet_dinh: null,
        });
      }

      return { created: txCreated, updated: txUpdated };
    });

    for (const personnelId of selectedPersonnelIds) {
      try {
        await profileService.recalculateAnnualProfile(personnelId);
      } catch {
        // Không throw error
      }
    }

    const imported = created.length + updated.length;
    console.log(
      `[Import danh hiệu] Hoàn tất: ${imported}/${total} thành công, ${errors.length} lỗi`
    );
    if (errors.length > 0) {
      console.log(`[Import danh hiệu] Lỗi:`, errors.slice(0, 10).join(' | '));
    }

    return {
      imported,
      total,
      errors,
      selectedPersonnelIds,
      titleData,
    };
  }

  async previewImport(buffer: Buffer): Promise<PreviewResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new ValidationError(
        'Không đọc được file Excel (file trống hoặc không đúng định dạng .xlsx).'
      );
    }

    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu']);
    const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
    const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);
    const bkbqpCol = getHeaderCol(headerMap, ['nhan_bkbqp', 'bkbqp']);
    const cstdtqCol = getHeaderCol(headerMap, ['nhan_cstdtq', 'cstdtq']);
    const bkttcpCol = getHeaderCol(headerMap, ['nhan_bkttcp', 'bkttcp']);
    const soQuyetDinhCol = getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd']);

    if (!idCol || !namCol || !danhHieuCol) {
      throw new ValidationError(
        `File thiếu cột bắt buộc (cần có: mã quân nhân hoặc ID, Năm, Danh hiệu). Các cột đang có: ${Object.keys(headerMap).join(', ') || '(trống)'}.`
      );
    }

    if (worksheet.name === 'Khen thưởng đơn vị') {
      throw new ValidationError(
        'Sai loại file: đây là mẫu khen thưởng đơn vị. Vui lòng dùng mẫu danh hiệu cá nhân hằng năm.'
      );
    }

    const validDanhHieu = ['CSTDCS', 'CSTT'];
    const errors: PreviewError[] = [];
    const valid: PreviewValidItem[] = [];
    let total = 0;
    const seenInFile = new Set<string>();
    const currentYear = new Date().getFullYear();

    const existingDecisions = await prisma.fileQuyetDinh.findMany({
      select: { so_quyet_dinh: true },
    });
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value || '').trim() : '';
      const namVal = row.getCell(namCol).value;
      const danh_hieu_raw = String(row.getCell(danhHieuCol).value || '').trim();
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value || '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value || '').trim() : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : null;
      const so_quyet_dinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : null;

      const bkbqpRaw = bkbqpCol ? String(row.getCell(bkbqpCol).value ?? '').trim() : '';
      const cstdtqRaw = cstdtqCol ? String(row.getCell(cstdtqCol).value ?? '').trim() : '';
      const bkttcpRaw = bkttcpCol ? String(row.getCell(bkttcpCol).value ?? '').trim() : '';

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

      if (parseBooleanValue(bkbqpRaw)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
          message: `${getDanhHieuName('BKBQP')} không import qua Excel — vui lòng nhập trên màn hình.`,
        });
        continue;
      }
      if (parseBooleanValue(cstdtqRaw)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
          message: `${getDanhHieuName('CSTDTQ')} không import qua Excel — vui lòng nhập trên màn hình.`,
        });
        continue;
      }
      if (parseBooleanValue(bkttcpRaw)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
          message: `${getDanhHieuName('BKTTCP')} không import qua Excel — vui lòng nhập trên màn hình.`,
        });
        continue;
      }

      const missingFields: string[] = [];
      if (!idValue) missingFields.push('mã quân nhân');
      if (!namVal) missingFields.push('năm');
      if (!danh_hieu_raw) missingFields.push('danh hiệu');
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
          message: 'Mã quân nhân không hợp lệ.',
        });
        continue;
      }
      const personnel = await prisma.quanNhan.findUnique({ where: { id: personnelId } });
      if (!personnel) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
          message: `Không tìm thấy quân nhân (mã: ${personnelId}).`,
        });
        continue;
      }

      const nam = parseInt(String(namVal));
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
          message: `Danh hiệu "${danh_hieu_raw}" không đúng. Chỉ được nhập: ${formatDanhHieuList(validDanhHieu)}`,
        });
        continue;
      }
      const danh_hieu = danhHieuUpper;

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

      const fileKey = `${personnel.id}_${nam}`;
      if (seenInFile.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Trùng lặp trong file — cùng quân nhân, năm ${nam}`,
        });
        continue;
      }
      seenInFile.add(fileKey);

      const existingReward = await prisma.danhHieuHangNam.findFirst({
        where: { quan_nhan_id: personnel.id, nam },
      });
      if (existingReward && existingReward.danh_hieu) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Đã có ${getDanhHieuName(existingReward.danh_hieu)} (${existingReward.danh_hieu}) cho năm ${nam}.`,
        });
        continue;
      }

      const history = await prisma.danhHieuHangNam.findMany({
        where: { quan_nhan_id: personnel.id },
        orderBy: { nam: 'desc' },
        take: 5,
        select: {
          nam: true,
          danh_hieu: true,
          nhan_bkbqp: true,
          nhan_cstdtq: true,
          nhan_bkttcp: true,
          so_quyet_dinh: true,
        },
      });

      valid.push({
        row: rowNumber,
        personnel_id: personnel.id,
        ho_ten: ho_ten ?? personnel.ho_ten,
        cap_bac,
        chuc_vu,
        nam,
        danh_hieu,
        so_quyet_dinh,
        ghi_chu,
        history: history as unknown as Record<string, unknown>[],
      });
    }

    return { total, valid, errors };
  }

  async confirmImport(validItems: ConfirmImportItem[]): Promise<{ imported: number }> {
    return await prisma.$transaction(
      async tx => {
        const results: DanhHieuHangNam[] = [];
        for (const item of validItems) {
          const result = await tx.danhHieuHangNam.upsert({
            where: {
              quan_nhan_id_nam: {
                quan_nhan_id: item.personnel_id,
                nam: item.nam,
              },
            },
            update: {
              danh_hieu: item.danh_hieu,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
            create: {
              quan_nhan_id: item.personnel_id,
              nam: item.nam,
              danh_hieu: item.danh_hieu,
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

  async checkAnnualRewards(
    personnelIds: string[],
    nam: number | string,
    danhHieu: string
  ): Promise<{ results: CheckResult[]; summary: Record<string, number> }> {
    const results: CheckResult[] = [];

    for (const personnelId of personnelIds) {
      const personnelIdStr = String(personnelId);

      if (!personnelIdStr) {
        continue;
      }

      const result: CheckResult = {
        personnel_id: personnelId,
        has_reward: false,
        has_proposal: false,
        reward: null,
        proposal: null,
      };

      const existingReward = await prisma.danhHieuHangNam.findFirst({
        where: {
          quan_nhan_id: personnelIdStr,
          nam: parseInt(String(nam)),
        },
      });

      if (existingReward) {
        result.has_reward = true;
        result.reward = {
          id: existingReward.id,
          nam: existingReward.nam,
          danh_hieu: existingReward.danh_hieu,
          nhan_bkbqp: existingReward.nhan_bkbqp,
          nhan_cstdtq: existingReward.nhan_cstdtq,
          nhan_bkttcp: existingReward.nhan_bkttcp,
        };
      }

      const proposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
          nam: parseInt(String(nam)),
          status: {
            in: [PROPOSAL_STATUS.PENDING, PROPOSAL_STATUS.APPROVED],
          },
        },
        select: {
          id: true,
          nam: true,
          status: true,
          data_danh_hieu: true,
        },
      });

      for (const proposal of proposals) {
        if (proposal.data_danh_hieu) {
          const dataList = Array.isArray(proposal.data_danh_hieu)
            ? (proposal.data_danh_hieu as Record<string, unknown>[])
            : [];

          const found = dataList.some(
            item => String(item.personnel_id) === personnelIdStr && item.danh_hieu === danhHieu
          );

          if (found) {
            result.has_proposal = true;
            result.proposal = {
              id: proposal.id,
              nam: proposal.nam,
              status: proposal.status,
            };
            break;
          }
        }
      }

      results.push(result);
    }

    return {
      results,
      summary: {
        total: personnelIds.length,
        has_reward: results.filter(r => r.has_reward).length,
        has_proposal: results.filter(r => r.has_proposal).length,
        can_add: results.filter(r => !r.has_reward && !r.has_proposal).length,
      },
    };
  }

  async bulkCreateAnnualRewards(data: BulkCreateData): Promise<{
    success: number;
    skipped: number;
    errors: number;
    details: {
      created: DanhHieuHangNam[];
      skipped: { personnelId: string; reason: string }[];
      errors: { personnelId: string; error: string }[];
    };
  }> {
    const {
      personnel_ids,
      personnel_rewards_data,
      nam,
      danh_hieu,
      ghi_chu,
      so_quyet_dinh,
      cap_bac,
      chuc_vu,
    } = data;

    const validDanhHieu = ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'];
    if (!validDanhHieu.includes(danh_hieu)) {
      throw new ValidationError(
        `Danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList(validDanhHieu)}.`
      );
    }

    const errors: { personnelId: string; error: string }[] = [];
    const skipped: { personnelId: string; reason: string }[] = [];

    const personnelDataMap: Record<
      string,
      { so_quyet_dinh?: string; cap_bac?: string; chuc_vu?: string }
    > = {};
    if (personnel_rewards_data && Array.isArray(personnel_rewards_data)) {
      personnel_rewards_data.forEach(item => {
        if (item.personnel_id) {
          personnelDataMap[item.personnel_id] = item;
        }
      });
    }

    const created = await prisma.$transaction(async tx => {
      const txCreated: DanhHieuHangNam[] = [];

      for (const personnelId of personnel_ids) {
        const personnelIdStr = String(personnelId);

        if (!personnelIdStr) {
          errors.push({ personnelId, error: 'ID quân nhân không hợp lệ' });
          continue;
        }

        const personnelData = personnelDataMap[personnelIdStr] || {};
        const individualSoQuyetDinh = personnelData.so_quyet_dinh || so_quyet_dinh;
        const individualCapBac = personnelData.cap_bac || cap_bac;
        const individualChucVu = personnelData.chuc_vu || chuc_vu;

        const personnel = await tx.quanNhan.findUnique({
          where: { id: personnelIdStr },
        });

        if (!personnel) {
          errors.push({ personnelId, error: 'Quân nhân không tồn tại' });
          continue;
        }

        try {
          const duplicateResult = await checkDuplicateAward(
            personnelIdStr,
            parseInt(String(nam)),
            danh_hieu,
            PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
            PROPOSAL_STATUS.APPROVED
          );
          if (duplicateResult.exists) {
            errors.push({ personnelId, error: duplicateResult.message });
            continue;
          }
        } catch {
          // Log but don't block
        }

        const existingReward = await tx.danhHieuHangNam.findFirst({
          where: {
            quan_nhan_id: personnelIdStr,
            nam: parseInt(String(nam)),
          },
        });

        let finalDanhHieu: string | null = null;
        let nhanBKBQP = false;
        let nhanCSTDTQ = false;
        let nhanBKTTCP = false;

        if (danh_hieu === 'CSTDCS' || danh_hieu === 'CSTT') {
          finalDanhHieu = danh_hieu;
        } else if (danh_hieu === 'BKBQP') {
          nhanBKBQP = true;
        } else if (danh_hieu === 'CSTDTQ') {
          nhanCSTDTQ = true;
        } else if (danh_hieu === 'BKTTCP') {
          nhanBKTTCP = true;
        }

        let rewardRecord: DanhHieuHangNam;

        if (existingReward) {
          if (danh_hieu === 'BKBQP' || danh_hieu === 'CSTDTQ' || danh_hieu === 'BKTTCP') {
            const updateData: Prisma.DanhHieuHangNamUpdateInput = {};
            if (danh_hieu === 'BKBQP') {
              updateData.nhan_bkbqp = true;
            } else if (danh_hieu === 'CSTDTQ') {
              updateData.nhan_cstdtq = true;
            } else if (danh_hieu === 'BKTTCP') {
              updateData.nhan_bkttcp = true;
            }

            if (individualCapBac) updateData.cap_bac = individualCapBac;
            if (individualChucVu) updateData.chuc_vu = individualChucVu;
            if (individualSoQuyetDinh) updateData.so_quyet_dinh = individualSoQuyetDinh;
            if (ghi_chu) updateData.ghi_chu = ghi_chu;

            rewardRecord = await tx.danhHieuHangNam.update({
              where: { id: existingReward.id },
              data: updateData,
            });
          } else {
            skipped.push({ personnelId, reason: `Đã có danh hiệu cho năm ${nam}` });
            continue;
          }
        } else {
          rewardRecord = await tx.danhHieuHangNam.create({
            data: {
              quan_nhan_id: personnelIdStr,
              nam: parseInt(String(nam)),
              danh_hieu: finalDanhHieu,
              cap_bac: individualCapBac || null,
              chuc_vu: individualChucVu || null,
              so_quyet_dinh: individualSoQuyetDinh || null,
              ghi_chu: ghi_chu || null,
              nhan_bkbqp: nhanBKBQP,
              nhan_cstdtq: nhanCSTDTQ,
              nhan_bkttcp: nhanBKTTCP,
            },
          });
        }

        txCreated.push(rewardRecord);
      }

      return txCreated;
    });

    for (const rewardRecord of created) {
      try {
        await profileService.recalculateAnnualProfile(rewardRecord.quan_nhan_id);
      } catch {
        // Không throw error
      }
    }

    console.log(
      `[Bulk tạo danh hiệu] ${danh_hieu} năm ${nam}: ${created.length} thành công, ${skipped.length} bỏ qua, ${errors.length} lỗi`
    );

    return {
      success: created.length,
      skipped: skipped.length,
      errors: errors.length,
      details: {
        created,
        skipped,
        errors,
      },
    };
  }

  async exportTemplate(
    personnelIds: string[] = [],
    userRole: string = 'MANAGER'
  ): Promise<ExcelJS.Workbook> {
    const personnelList =
      personnelIds.length > 0
        ? await prisma.quanNhan.findMany({
            where: { id: { in: personnelIds } },
            include: { ChucVu: true },
          })
        : [];

    const existingDecisions = await prisma.fileQuyetDinh.findMany({
      select: { so_quyet_dinh: true },
      orderBy: { nam: 'desc' },
      take: 200,
    });
    const decisionNumbers = existingDecisions.map(d => d.so_quyet_dinh).filter(Boolean);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh hiệu hằng năm');

    const columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Năm (*)', key: 'nam', width: 10 },
      { header: 'Danh hiệu (*)', key: 'danh_hieu', width: 15 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
      { header: 'BKBQP (không điền)', key: 'nhan_bkbqp', width: 18 },
      { header: 'CSTDTQ (không điền)', key: 'nhan_cstdtq', width: 18 },
      { header: 'BKTTCP (không điền)', key: 'nhan_bkttcp', width: 18 },
    ];

    worksheet.columns = columns;

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

    personnelList.forEach((person, index) => {
      const rowData = {
        stt: index + 1,
        id: person.id,
        ho_ten: person.ho_ten || '',
        cap_bac: person.cap_bac || '',
        chuc_vu: person.ChucVu ? person.ChucVu.ten_chuc_vu : '',
      };
      worksheet.addRow(rowData);
    });

    const readonlyColIndices = [1, 2, 3];
    const yellowFill: ExcelJS.FillPattern = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFCC' },
    };
    const redFill: ExcelJS.FillPattern = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCCCC' },
    };
    const bkColIndices = [10, 11, 12];

    for (let rowNum = 1; rowNum <= Math.max(personnelList.length + 1, 2); rowNum++) {
      const row = worksheet.getRow(rowNum);
      if (rowNum >= 2) {
        readonlyColIndices.forEach(colIdx => {
          row.getCell(colIdx).fill = yellowFill;
        });
      }
      bkColIndices.forEach(colIdx => {
        row.getCell(colIdx).fill = redFill;
      });
    }

    const capBacOptions =
      'Binh nhì,Binh nhất,Hạ sĩ,Trung sĩ,Thượng sĩ,Thiếu úy,Trung úy,Thượng úy,Đại úy,Thiếu tá,Trung tá,Thượng tá,Đại tá,Thiếu tướng,Trung tướng,Thượng tướng,Đại tướng';
    const capBacSheet = workbook.addWorksheet('_CapBac', { state: 'veryHidden' });
    capBacOptions.split(',').forEach((cb, idx) => {
      capBacSheet.getCell(`A${idx + 1}`).value = cb;
    });
    const capBacCount = capBacOptions.split(',').length;
    for (let rowNum = 2; rowNum <= Math.max(personnelList.length + 1, 50); rowNum++) {
      worksheet.getRow(rowNum).getCell(4).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`_CapBac!$A$1:$A$${capBacCount}`],
      };
    }

    const danhHieuColNumber = 7;
    worksheet.getColumn(danhHieuColNumber).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"CSTT,CSTDCS"'] };
      }
    });

    if (decisionNumbers.length > 0) {
      const soQdKeys = ['so_quyet_dinh'];
      const decisionListStr = decisionNumbers.join(',');
      const maxRows = Math.max(personnelList.length + 1, 50);

      if (decisionListStr.length <= 250) {
        soQdKeys.forEach(key => {
          const colNumber = columns.findIndex(c => c.key === key) + 1;
          if (colNumber > 0) {
            for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
              worksheet.getRow(rowNum).getCell(colNumber).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`"${decisionListStr}"`],
              };
            }
          }
        });
      } else {
        const refSheet = workbook.addWorksheet('_QuyetDinh', { state: 'veryHidden' });
        decisionNumbers.forEach((sqd, idx) => {
          refSheet.getCell(`A${idx + 1}`).value = sqd;
        });
        soQdKeys.forEach(key => {
          const colNumber = columns.findIndex(c => c.key === key) + 1;
          if (colNumber > 0) {
            for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
              worksheet.getRow(rowNum).getCell(colNumber).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`_QuyetDinh!$A$1:$A$${decisionNumbers.length}`],
              };
            }
          }
        });
      }
    }

    return workbook;
  }

  async exportToExcel(filters: ExportFilters = {}): Promise<ExcelJS.Workbook> {
    const { nam, danh_hieu, don_vi_id, personnel_ids } = filters;

    const where: Prisma.DanhHieuHangNamWhereInput = {};
    if (nam) where.nam = nam;
    if (danh_hieu) where.danh_hieu = danh_hieu;
    if (personnel_ids && personnel_ids.length > 0) {
      where.quan_nhan_id = { in: personnel_ids };
    }

    const awards = await prisma.danhHieuHangNam.findMany({
      where,
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
          },
        },
      },
      orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
      take: 10000,
    });

    let filteredAwards = awards;
    if (don_vi_id) {
      filteredAwards = awards.filter(
        award =>
          award.QuanNhan?.co_quan_don_vi_id === don_vi_id ||
          award.QuanNhan?.don_vi_truc_thuoc_id === don_vi_id
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh hiệu hằng năm');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Danh hiệu', key: 'danh_hieu', width: 15 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
      { header: 'BKBQP', key: 'nhan_bkbqp', width: 10 },
      { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
      { header: 'CSTDTQ', key: 'nhan_cstdtq', width: 10 },
      { header: 'Số QĐ CSTDTQ', key: 'so_quyet_dinh_cstdtq', width: 20 },
      { header: 'BKTTCP', key: 'nhan_bkttcp', width: 10 },
      { header: 'Số QĐ BKTTCP', key: 'so_quyet_dinh_bkttcp', width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

    filteredAwards.forEach((award, index) => {
      worksheet.addRow({
        stt: index + 1,
        id: award.QuanNhan?.id ?? '',
        ho_ten: award.QuanNhan?.ho_ten ?? '',
        cap_bac: award.cap_bac ?? '',
        chuc_vu: award.chuc_vu ?? '',
        nam: award.nam,
        danh_hieu: award.danh_hieu ?? '',
        so_quyet_dinh: award.so_quyet_dinh ?? '',
        ghi_chu: award.ghi_chu ?? '',
        nhan_bkbqp: award.nhan_bkbqp ? 'Có' : '',
        so_quyet_dinh_bkbqp: award.so_quyet_dinh_bkbqp ?? '',
        nhan_cstdtq: award.nhan_cstdtq ? 'Có' : '',
        so_quyet_dinh_cstdtq: award.so_quyet_dinh_cstdtq ?? '',
        nhan_bkttcp: award.nhan_bkttcp ? 'Có' : '',
        so_quyet_dinh_bkttcp: award.so_quyet_dinh_bkttcp ?? '',
      });
    });

    return workbook;
  }

  async getStatistics(filters: StatisticsFilters = {}): Promise<{
    total: number;
    byDanhHieu: { danh_hieu: string | null; count: number }[];
    byNam: { nam: number; count: number }[];
  }> {
    const { nam, don_vi_id } = filters;

    const where: Prisma.DanhHieuHangNamWhereInput = {};
    if (nam) where.nam = nam;

    const awards = await prisma.danhHieuHangNam.findMany({
      where,
      include: {
        QuanNhan: {
          select: {
            co_quan_don_vi_id: true,
            don_vi_truc_thuoc_id: true,
          },
        },
      },
    });

    let filteredAwards = awards;
    if (don_vi_id) {
      filteredAwards = awards.filter(
        award =>
          award.QuanNhan?.co_quan_don_vi_id === don_vi_id ||
          award.QuanNhan?.don_vi_truc_thuoc_id === don_vi_id
      );
    }

    const byDanhHieu = filteredAwards.reduce(
      (acc, award) => {
        const key = award.danh_hieu;
        if (!acc[key ?? 'null']) {
          acc[key ?? 'null'] = { danh_hieu: key, count: 0 };
        }
        acc[key ?? 'null'].count++;
        return acc;
      },
      {} as Record<string, { danh_hieu: string | null; count: number }>
    );

    const byNam = filteredAwards.reduce(
      (acc, award) => {
        const key = award.nam;
        if (!acc[key]) {
          acc[key] = { nam: key, count: 0 };
        }
        acc[key].count++;
        return acc;
      },
      {} as Record<number, { nam: number; count: number }>
    );

    return {
      total: filteredAwards.length,
      byDanhHieu: Object.values(byDanhHieu),
      byNam: Object.values(byNam).sort((a, b) => b.nam - a.nam),
    };
  }
}

export default new AnnualRewardService();
