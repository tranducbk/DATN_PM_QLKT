import { prisma } from '../models';
import ExcelJS from 'exceljs';
import * as notificationHelper from '../helpers/notification';
import { safeRecalculateAnnualProfile } from '../helpers/profileRecalcHelper';
import { resolveAnnualRewardImportContext } from '../helpers/annualRewardImportHelper';
import {
  formatDanhHieuList,
  getDanhHieuName,
  resolveDanhHieuCode,
  buildDanhHieuExcelOptions,
  DANH_HIEU_CA_NHAN_CO_BAN,
  DANH_HIEU_CA_NHAN_BANG_KHEN,
  DANH_HIEU_CA_NHAN_HANG_NAM,
} from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { NotFoundError, ValidationError } from '../middlewares/errorHandler';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { validateDecisionNumbers } from './eligibility/decisionNumberValidation';
import profileService from './profile.service';
import {
  collectPendingProposalPersonnelIdsForAward,
  isPersonalChainAward,
} from './eligibility/annualBulkValidation';
import {
  parseBooleanValue,
  resolvePersonnelInfo,
  buildPendingKeys,
  sanitizeRowData,
  validatePersonnelNameMatch,
} from '../helpers/excelHelper';
import type { DanhHieuHangNam, QuanNhan, Prisma } from '../generated/prisma';
import { buildTemplate, TemplateColumn, styleHeaderRow } from '../helpers/excelTemplateHelper';
import { IMPORT_TRANSACTION_TIMEOUT, EXPORT_FETCH_LIMIT } from '../constants/excel.constants';
import { PERSONAL_ANNUAL_TEMPLATE_COLUMNS } from '../constants/annualExcel.constants';
import { AWARD_EXCEL_SHEETS } from '../constants/awardExcel.constants';

interface CreateAnnualRewardData {
  personnel_id: string;
  nam: number;
  danh_hieu?: string | null;
  so_quyet_dinh?: string | null;
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
  ho_ten: string;
  nam: number;
  danh_hieu: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  so_quyet_dinh_bkbqp?: string | null;
  so_quyet_dinh_cstdtq?: string | null;
  so_quyet_dinh_bkttcp?: string | null;
  nhan_bkbqp?: boolean;
  nhan_cstdtq?: boolean;
  nhan_bkttcp?: boolean;
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

    const validDanhHieu = DANH_HIEU_CA_NHAN_CO_BAN;
    if (danh_hieu && !validDanhHieu.has(danh_hieu)) {
      throw new ValidationError(
        `Danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList([...validDanhHieu])}. Để trống nghĩa là không đạt danh hiệu.`
      );
    }

    const existingReward = await prisma.danhHieuHangNam.findFirst({
      where: { quan_nhan_id: personnel_id, nam },
    });

    if (existingReward) {
      const isCoBan = danh_hieu && DANH_HIEU_CA_NHAN_CO_BAN.has(danh_hieu);

      // Block: existing has same base title, or adding base title when one already exists
      if (isCoBan && existingReward.danh_hieu) {
        throw new ValidationError(`Năm ${nam} đã có ${getDanhHieuName(existingReward.danh_hieu)}.`);
      }
      // Block: adding same flag that already exists
      if (nhan_bkbqp && existingReward.nhan_bkbqp) {
        throw new ValidationError(`Năm ${nam} đã có Bằng khen Bộ Quốc phòng.`);
      }
      if (nhan_cstdtq && existingReward.nhan_cstdtq) {
        throw new ValidationError(`Năm ${nam} đã có Chiến sĩ thi đua toàn quân.`);
      }
      if (nhan_bkttcp && existingReward.nhan_bkttcp) {
        throw new ValidationError(`Năm ${nam} đã có Bằng khen Thủ tướng Chính phủ.`);
      }

      const mergeDecisionErrors = validateDecisionNumbers(
        {
          danh_hieu: isCoBan ? danh_hieu : null,
          so_quyet_dinh: isCoBan ? data.so_quyet_dinh : null,
          nhan_bkbqp,
          so_quyet_dinh_bkbqp,
          nhan_cstdtq,
          so_quyet_dinh_cstdtq,
          nhan_bkttcp,
          so_quyet_dinh_bkttcp,
        },
        { entityType: 'personal', entityName: personnel.ho_ten }
      );
      if (mergeDecisionErrors.length > 0) {
        throw new ValidationError(mergeDecisionErrors.join('\n'));
      }

      // Allow: merge into existing record
      const updateData: Record<string, unknown> = {};
      if (isCoBan) {
        updateData.danh_hieu = danh_hieu;
        if (data.so_quyet_dinh) updateData.so_quyet_dinh = data.so_quyet_dinh;
      }
      if (nhan_bkbqp) {
        updateData.nhan_bkbqp = true;
        if (so_quyet_dinh_bkbqp) updateData.so_quyet_dinh_bkbqp = so_quyet_dinh_bkbqp;
        if (ghi_chu) updateData.ghi_chu_bkbqp = ghi_chu;
      } else if (nhan_cstdtq) {
        updateData.nhan_cstdtq = true;
        if (so_quyet_dinh_cstdtq) updateData.so_quyet_dinh_cstdtq = so_quyet_dinh_cstdtq;
        if (ghi_chu) updateData.ghi_chu_cstdtq = ghi_chu;
      } else if (nhan_bkttcp) {
        updateData.nhan_bkttcp = true;
        if (so_quyet_dinh_bkttcp) updateData.so_quyet_dinh_bkttcp = so_quyet_dinh_bkttcp;
        if (ghi_chu) updateData.ghi_chu_bkttcp = ghi_chu;
      } else if (ghi_chu) {
        updateData.ghi_chu = ghi_chu;
      }
      if (cap_bac) updateData.cap_bac = cap_bac;
      if (chuc_vu) updateData.chuc_vu = chuc_vu;

      const updated = await prisma.danhHieuHangNam.update({
        where: { id: existingReward.id },
        data: updateData,
      });
      await safeRecalculateAnnualProfile(personnel_id);
      return updated;
    }

    const createDecisionErrors = validateDecisionNumbers(
      {
        danh_hieu,
        so_quyet_dinh: data.so_quyet_dinh,
        nhan_bkbqp,
        so_quyet_dinh_bkbqp,
        nhan_cstdtq,
        so_quyet_dinh_cstdtq,
        nhan_bkttcp,
        so_quyet_dinh_bkttcp,
      },
      { entityType: 'personal', entityName: personnel.ho_ten }
    );
    if (createDecisionErrors.length > 0) {
      throw new ValidationError(createDecisionErrors.join('\n'));
    }

    const newReward = await prisma.danhHieuHangNam.create({
      data: {
        quan_nhan_id: personnel_id,
        nam,
        danh_hieu,
        so_quyet_dinh: data.so_quyet_dinh || null,
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

    await safeRecalculateAnnualProfile(personnel_id);

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
      const validDanhHieu = DANH_HIEU_CA_NHAN_CO_BAN;
      if (!validDanhHieu.has(danh_hieu)) {
        throw new ValidationError(
          `Danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList([...validDanhHieu])}. Để trống nghĩa là không đạt danh hiệu.`
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

    await safeRecalculateAnnualProfile(reward.quan_nhan_id);

    return updatedReward;
  }

  async deleteAnnualReward(
    id: string,
    adminUsername: string = 'Admin',
    awardType?: string | null
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

    // Awards page renders one row per year with multiple awards. Granular
    // delete clears only the requested award + its decision number + note;
    // the row is removed entirely when no awards remain.
    if (awardType) {
      const validTypes = new Set<string>([
        ...DANH_HIEU_CA_NHAN_CO_BAN,
        ...DANH_HIEU_CA_NHAN_BANG_KHEN,
      ]);
      if (!validTypes.has(awardType)) {
        throw new ValidationError(
          `Loại danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList([...validTypes])}.`
        );
      }

      const updateData: Prisma.DanhHieuHangNamUpdateInput = {};
      const isBaseAward = DANH_HIEU_CA_NHAN_CO_BAN.has(awardType);

      if (isBaseAward) {
        if (reward.danh_hieu !== awardType) {
          throw new ValidationError(
            `Bản ghi không có ${getDanhHieuName(awardType)}`
          );
        }
        updateData.danh_hieu = null;
        updateData.so_quyet_dinh = null;
        updateData.ghi_chu = null;
      } else if (awardType === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP) {
        if (!reward.nhan_bkbqp) {
          throw new ValidationError(
            `Bản ghi không có ${getDanhHieuName(awardType)}`
          );
        }
        updateData.nhan_bkbqp = false;
        updateData.so_quyet_dinh_bkbqp = null;
        updateData.ghi_chu_bkbqp = null;
      } else if (awardType === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ) {
        if (!reward.nhan_cstdtq) {
          throw new ValidationError(
            `Bản ghi không có ${getDanhHieuName(awardType)}`
          );
        }
        updateData.nhan_cstdtq = false;
        updateData.so_quyet_dinh_cstdtq = null;
        updateData.ghi_chu_cstdtq = null;
      } else if (awardType === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP) {
        if (!reward.nhan_bkttcp) {
          throw new ValidationError(
            `Bản ghi không có ${getDanhHieuName(awardType)}`
          );
        }
        updateData.nhan_bkttcp = false;
        updateData.so_quyet_dinh_bkttcp = null;
        updateData.ghi_chu_bkttcp = null;
      }

      const remainingDanhHieu = isBaseAward ? null : reward.danh_hieu;
      const remainingBkbqp =
        awardType === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP ? false : reward.nhan_bkbqp;
      const remainingCstdtq =
        awardType === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ ? false : reward.nhan_cstdtq;
      const remainingBkttcp =
        awardType === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP ? false : reward.nhan_bkttcp;
      const isEmpty =
        !remainingDanhHieu && !remainingBkbqp && !remainingCstdtq && !remainingBkttcp;

      if (isEmpty) {
        await prisma.danhHieuHangNam.delete({ where: { id } });
      } else {
        await prisma.danhHieuHangNam.update({ where: { id }, data: updateData });
      }

      await safeRecalculateAnnualProfile(personnelId);

      try {
        await notificationHelper.notifyOnAwardDeleted(
          reward,
          personnel,
          PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
          adminUsername
        );
      } catch (e) {
        void writeSystemLog({
          action: 'ERROR',
          resource: 'annual-rewards',
          description: `Lỗi gửi thông báo xóa khen thưởng hằng năm: ${e}`,
        });
      }

      return {
        message: `Đã xóa ${getDanhHieuName(awardType)}.`,
        personnelId,
        personnel,
        reward,
      };
    }

    await prisma.danhHieuHangNam.delete({
      where: { id },
    });

    await safeRecalculateAnnualProfile(personnelId);

    try {
      await notificationHelper.notifyOnAwardDeleted(
        reward,
        personnel,
        PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        adminUsername
      );
    } catch (e) {
      writeSystemLog({
        action: 'ERROR',
        resource: 'annual-rewards',
        description: `Lỗi gửi thông báo xóa khen thưởng hằng năm: ${e}`,
      });
    }

    return {
      message: 'Đã xóa danh hiệu hằng năm.',
      personnelId,
      personnel,
      reward,
    };
  }

  async importFromExcelBuffer(buffer: Buffer): Promise<ImportResult> {
    const { worksheet, columns, batchMaps, allYears, currentYear, validDanhHieu } =
      await resolveAnnualRewardImportContext(buffer);
    const {
      idCol,
      hoTenCol,
      namCol,
      danhHieuCol,
      capBacCol,
      chucVuCol,
      ghiChuCol,
      bkbqpCol,
      cstdtqCol,
      bkttcpCol,
    } = columns;
    const { personnelMap: personnelById, existingAwardKeys, existingRewardByKey } = batchMaps;

    const pendingProposals = await prisma.bangDeXuat.findMany({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
        nam: { in: [...allYears] },
        status: PROPOSAL_STATUS.PENDING,
      },
    });
    const proposalsByYear = new Map<number, typeof pendingProposals>();
    for (const proposal of pendingProposals) {
      if (proposal.nam == null) continue;
      const list = proposalsByYear.get(proposal.nam) ?? [];
      list.push(proposal);
      proposalsByYear.set(proposal.nam, list);
    }

    const errors: string[] = [];
    const selectedPersonnelIdSet = new Set<string>();
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
      const personnel = personnelById.get(personnelId);
      if (!personnel) {
        errors.push(`Dòng ${rowNumber}: Không tìm thấy quân nhân với ID ${personnelId}`);
        continue;
      }

      const nam = parseInt(String(namVal), 10);
      if (!Number.isInteger(nam)) {
        errors.push(`Dòng ${rowNumber}: Giá trị năm không hợp lệ`);
        continue;
      }

      if (nam < 1900 || nam > currentYear) {
        errors.push(`Dòng ${rowNumber}: Năm phải từ 1900 đến ${currentYear} (nhận được: ${nam})`);
        continue;
      }

      const resolvedDanhHieu = resolveDanhHieuCode(danh_hieu_raw);
      if (!validDanhHieu.has(resolvedDanhHieu)) {
        errors.push(
          `Dòng ${rowNumber}: Danh hiệu "${danh_hieu_raw}" không đúng. Chỉ được nhập: ${formatDanhHieuList([...validDanhHieu])}`
        );
        continue;
      }
      const danh_hieu = resolvedDanhHieu;

      const fileKey = `${personnel.id}_${nam}`;
      if (seenInFile.has(fileKey)) {
        errors.push(
          `Dòng ${rowNumber}: Quân nhân "${ho_ten}" đã xuất hiện ở dòng trước cho năm ${nam} (trùng lặp trong file)`
        );
        continue;
      }
      seenInFile.add(fileKey);

      if (danh_hieu) {
        if (existingAwardKeys.has(`${personnel.id}_${nam}_${danh_hieu}`)) {
          errors.push(
            `Dòng ${rowNumber}: ${ho_ten} đã có ${getDanhHieuName(danh_hieu)} năm ${nam} (đã được duyệt trước đó)`
          );
          continue;
        }
        const proposalsForYear = proposalsByYear.get(nam) ?? [];
        const hasPendingProposal = proposalsForYear.some(p => {
          const dataDanhHieu = (p.data_danh_hieu as Array<Record<string, unknown>>) ?? [];
          return dataDanhHieu.some(
            item => item.personnel_id === personnel.id && item.danh_hieu === danh_hieu
          );
        });
        if (hasPendingProposal) {
          errors.push(
            `Dòng ${rowNumber}: ${ho_ten} đã có ${getDanhHieuName(danh_hieu)} năm ${nam} (đã được duyệt trước đó)`
          );
          continue;
        }
      }

      const {
        hoTen,
        capBac,
        chucVu,
        missingFields: missingInfoFields,
      } = resolvePersonnelInfo({ ho_ten, cap_bac, chuc_vu }, personnel);
      if (missingInfoFields.length > 0) {
        errors.push(
          `Dòng ${rowNumber}: Thiếu ${missingInfoFields.join(', ')} (cả trong file và hệ thống)`
        );
        continue;
      }

      rowsToProcess.push({
        personnel,
        nam,
        danh_hieu,
        cap_bac: capBac,
        chuc_vu: chucVu,
        ghi_chu,
        ho_ten: hoTen,
        nhan_bkbqp,
        nhan_cstdtq,
        nhan_bkttcp,
      });
    }

    const { created, updated } = await prisma.$transaction(
      async prismaTx => {
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

          const existing = existingRewardByKey.get(`${personnel.id}_${nam}`) ?? null;

          if (!existing) {
            const createdReward = await prismaTx.danhHieuHangNam.create({
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
            await prismaTx.danhHieuHangNam.update({
              where: { id: existing.id },
              data: {
                danh_hieu,
                cap_bac: cap_bac !== undefined ? cap_bac : existing.cap_bac,
                chuc_vu: chuc_vu !== undefined ? chuc_vu : existing.chuc_vu,
                ghi_chu: ghi_chu !== undefined ? ghi_chu : existing.ghi_chu,
                nhan_bkbqp: nhan_bkbqp || existing.nhan_bkbqp,
                nhan_cstdtq: nhan_cstdtq || existing.nhan_cstdtq,
                nhan_bkttcp: nhan_bkttcp || existing.nhan_bkttcp,
              },
            });
            txUpdated.push(existing.id);
          }

          selectedPersonnelIdSet.add(personnel.id);

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
      },
      { timeout: IMPORT_TRANSACTION_TIMEOUT }
    );

    const selectedPersonnelIds = [...selectedPersonnelIdSet];

    for (const personnelId of selectedPersonnelIds) {
      await safeRecalculateAnnualProfile(personnelId);
    }

    const imported = created.length + updated.length;
    writeSystemLog({
      action: 'IMPORT',
      resource: 'annual-rewards',
      description: `[Import danh hiệu] Hoàn tất: ${imported}/${total} thành công, ${errors.length} lỗi`,
      payload: errors.length > 0 ? { errors: errors.slice(0, 10) } : null,
    });

    return {
      imported,
      total,
      errors,
      selectedPersonnelIds,
      titleData,
    };
  }

  async previewImport(buffer: Buffer): Promise<PreviewResult> {
    const { worksheet, columns, batchMaps, allYears, currentYear, validDanhHieu } =
      await resolveAnnualRewardImportContext(buffer);
    const {
      idCol,
      hoTenCol,
      namCol,
      danhHieuCol,
      capBacCol,
      chucVuCol,
      ghiChuCol,
      bkbqpCol,
      cstdtqCol,
      bkttcpCol,
      soQuyetDinhCol,
    } = columns;
    const { personnelMap, existingRewardByKey: rewardByKey, rewardsByPersonnel } = batchMaps;

    // Preview checks against PENDING proposals + existing decisions
    const [pendingProposals, existingDecisions] = await Promise.all([
      prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
          status: PROPOSAL_STATUS.PENDING,
          nam: { in: [...allYears] },
        },
      }),
      prisma.fileQuyetDinh.findMany({ select: { so_quyet_dinh: true } }),
    ]);

    const pendingKeys = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_danh_hieu',
      (item, proposal) => (item.personnel_id ? `${item.personnel_id}_${proposal.nam}` : null)
    );
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

    const errors: PreviewError[] = [];
    const valid: PreviewValidItem[] = [];
    let total = 0;
    const seenInFile = new Set<string>();

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
          message: `${getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP)} không import qua Excel — vui lòng nhập trên màn hình.`,
        });
        continue;
      }
      if (parseBooleanValue(cstdtqRaw)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
          message: `${getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ)} không import qua Excel — vui lòng nhập trên màn hình.`,
        });
        continue;
      }
      if (parseBooleanValue(bkttcpRaw)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
          message: `${getDanhHieuName(DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP)} không import qua Excel — vui lòng nhập trên màn hình.`,
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

      const nameMismatch = validatePersonnelNameMatch(ho_ten, personnel.ho_ten);
      if (nameMismatch) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
          message: nameMismatch,
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

      const resolvedDanhHieu = resolveDanhHieuCode(danh_hieu_raw);
      if (!validDanhHieu.has(resolvedDanhHieu)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu: danh_hieu_raw,
          message: `Danh hiệu "${danh_hieu_raw}" không đúng. Chỉ được nhập: ${formatDanhHieuList([...validDanhHieu])}`,
        });
        continue;
      }
      const danh_hieu = resolvedDanhHieu;

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

      // Check duplicate in DB (using pre-fetched Map)
      const existingReward = rewardByKey.get(`${personnel.id}_${nam}`);
      if (existingReward && existingReward.danh_hieu === danh_hieu) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Đã có ${getDanhHieuName(danh_hieu)} cho năm ${nam}.`,
        });
        continue;
      }

      if (pendingKeys.has(`${personnel.id}_${nam}`)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Quân nhân đang có đề xuất khen thưởng năm ${nam} chờ duyệt`,
        });
        continue;
      }

      // Build history from pre-fetched data (last 5 records sorted by nam desc)
      const allRecords = rewardsByPersonnel.get(personnel.id) || [];
      const history = [...allRecords]
        .sort((a, b) => b.nam - a.nam)
        .slice(0, 5)
        .map(r => ({
          nam: r.nam,
          danh_hieu: r.danh_hieu,
          nhan_bkbqp: r.nhan_bkbqp,
          nhan_cstdtq: r.nhan_cstdtq,
          nhan_bkttcp: r.nhan_bkttcp,
          so_quyet_dinh: r.so_quyet_dinh,
        }));

      const {
        hoTen,
        capBac,
        chucVu,
        missingFields: missingInfoFields,
      } = resolvePersonnelInfo({ ho_ten, cap_bac, chuc_vu }, personnel);
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
        personnel_id: personnel.id,
        ho_ten: hoTen,
        cap_bac: capBac,
        chuc_vu: chucVu,
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
    const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];
    const uniqueYears = [...new Set(validItems.map(item => item.nam))];

    const [pendingProposals, existingRecords, personnelList] = await Promise.all([
      prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
          status: PROPOSAL_STATUS.PENDING,
          nam: { in: uniqueYears },
        },
      }),
      prisma.danhHieuHangNam.findMany({
        where: {
          quan_nhan_id: { in: personnelIds },
          nam: { in: uniqueYears },
        },
        select: { quan_nhan_id: true, nam: true, danh_hieu: true, nhan_bkbqp: true, nhan_cstdtq: true, nhan_bkttcp: true },
      }),
      prisma.quanNhan.findMany({
        where: { id: { in: personnelIds } },
        select: { id: true, ho_ten: true },
      }),
    ]);
    const hoTenMap = new Map(personnelList.map(p => [p.id, p.ho_ten]));

    const pendingKeys = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_danh_hieu',
      (item, proposal) => (item.personnel_id ? `${item.personnel_id}_${proposal.nam}` : null)
    );
    const pendingConflicts: string[] = [];
    for (const item of validItems) {
      if (pendingKeys.has(`${item.personnel_id}_${item.nam}`)) {
        pendingConflicts.push(`${hoTenMap.get(item.personnel_id) || item.ho_ten || item.personnel_id} năm ${item.nam}: đang có đề xuất chờ duyệt`);
      }
    }
    if (pendingConflicts.length > 0) {
      throw new ValidationError(pendingConflicts.join('; '));
    }
    const existingMap = new Map(existingRecords.map(r => [`${r.quan_nhan_id}|${r.nam}`, r]));

    const conflicts: string[] = [];
    for (const item of validItems) {
      const existing = existingMap.get(`${item.personnel_id}|${item.nam}`);
      if (!existing) continue;
      // Only conflict when existing has a different base title (CSTDCS vs CSTT)
      if (existing.danh_hieu && existing.danh_hieu !== item.danh_hieu) {
        const hoTen = hoTenMap.get(item.personnel_id) || item.ho_ten || item.personnel_id;
        conflicts.push(
          `${hoTen} năm ${item.nam}: đã có ${getDanhHieuName(existing.danh_hieu)}, không thể ghi đè bằng ${getDanhHieuName(item.danh_hieu)}`
        );
      }
    }
    if (conflicts.length > 0) {
      throw new ValidationError(conflicts.join('; '));
    }

    const decisionErrors: string[] = [];
    for (const item of validItems) {
      const isBangKhen = DANH_HIEU_CA_NHAN_BANG_KHEN.has(item.danh_hieu);
      const nhanBKBQP = item.nhan_bkbqp || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP;
      const nhanCSTDTQ = item.nhan_cstdtq || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ;
      const nhanBKTTCP = item.nhan_bkttcp || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;
      const sharedDecision = item.so_quyet_dinh ?? null;
      const errs = validateDecisionNumbers(
        {
          danh_hieu: isBangKhen ? null : item.danh_hieu,
          so_quyet_dinh: isBangKhen ? null : sharedDecision,
          nhan_bkbqp: nhanBKBQP,
          so_quyet_dinh_bkbqp: item.so_quyet_dinh_bkbqp || sharedDecision,
          nhan_cstdtq: nhanCSTDTQ,
          so_quyet_dinh_cstdtq: item.so_quyet_dinh_cstdtq || sharedDecision,
          nhan_bkttcp: nhanBKTTCP,
          so_quyet_dinh_bkttcp: item.so_quyet_dinh_bkttcp || sharedDecision,
        },
        {
          entityType: 'personal',
          entityName: hoTenMap.get(item.personnel_id) || item.ho_ten || item.personnel_id,
        }
      );
      decisionErrors.push(...errs);
    }
    if (decisionErrors.length > 0) {
      throw new ValidationError(decisionErrors.join('\n'));
    }

    return await prisma.$transaction(
      async prismaTx => {
        const results: DanhHieuHangNam[] = [];
        for (const item of validItems) {
          const isBangKhen = DANH_HIEU_CA_NHAN_BANG_KHEN.has(item.danh_hieu);
          const nhanBKBQP = item.nhan_bkbqp || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP;
          const nhanCSTDTQ =
            item.nhan_cstdtq || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ;
          const nhanBKTTCP =
            item.nhan_bkttcp || item.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;
          const finalDanhHieu = isBangKhen ? null : item.danh_hieu;

          const sharedData = {
            cap_bac: item.cap_bac ?? null,
            chuc_vu: item.chuc_vu ?? null,
            ghi_chu: isBangKhen ? undefined : (item.ghi_chu ?? null),
            so_quyet_dinh: isBangKhen ? undefined : (item.so_quyet_dinh ?? null),
            ...(nhanBKBQP && {
              nhan_bkbqp: true,
              so_quyet_dinh_bkbqp: item.so_quyet_dinh_bkbqp || item.so_quyet_dinh || null,
              ...(item.ghi_chu && { ghi_chu_bkbqp: item.ghi_chu }),
            }),
            ...(nhanCSTDTQ && {
              nhan_cstdtq: true,
              so_quyet_dinh_cstdtq: item.so_quyet_dinh_cstdtq || item.so_quyet_dinh || null,
              ...(item.ghi_chu && { ghi_chu_cstdtq: item.ghi_chu }),
            }),
            ...(nhanBKTTCP && {
              nhan_bkttcp: true,
              so_quyet_dinh_bkttcp: item.so_quyet_dinh_bkttcp || item.so_quyet_dinh || null,
              ...(item.ghi_chu && { ghi_chu_bkttcp: item.ghi_chu }),
            }),
          };

          const result = await prismaTx.danhHieuHangNam.upsert({
            where: {
              quan_nhan_id_nam: {
                quan_nhan_id: item.personnel_id,
                nam: item.nam,
              },
            },
            update: {
              danh_hieu: finalDanhHieu,
              ...sharedData,
            },
            create: {
              quan_nhan_id: item.personnel_id,
              nam: item.nam,
              danh_hieu: finalDanhHieu,
              ...sharedData,
            },
          });
          results.push(result);
        }
        return { imported: results.length, data: results };
      },
      { timeout: IMPORT_TRANSACTION_TIMEOUT }
    );
  }

  async checkAnnualRewards(
    personnelIds: string[],
    nam: number,
    danhHieu: string
  ): Promise<{ results: CheckResult[]; summary: Record<string, number> }> {
    const [existingRewards, proposals] = await Promise.all([
      prisma.danhHieuHangNam.findMany({ where: { quan_nhan_id: { in: personnelIds }, nam } }),
      prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
          nam,
          status: { in: [PROPOSAL_STATUS.PENDING, PROPOSAL_STATUS.APPROVED] },
        },
        select: { id: true, nam: true, status: true, data_danh_hieu: true },
      }),
    ]);
    const rewardByPersonnel = new Map(existingRewards.map(r => [r.quan_nhan_id, r] as const));
    const proposalsByPersonnel = new Map<string, typeof proposals>();
    for (const p of proposals) {
      const data = (p.data_danh_hieu as Array<Record<string, unknown>>) ?? [];
      for (const item of data) {
        const pid = item.personnel_id as string;
        if (!pid) continue;
        const list = proposalsByPersonnel.get(pid) ?? [];
        list.push(p);
        proposalsByPersonnel.set(pid, list);
      }
    }

    const results: CheckResult[] = [];

    for (const personnelId of personnelIds) {
      if (!personnelId) continue;

      const result: CheckResult = {
        personnel_id: personnelId,
        has_reward: false,
        has_proposal: false,
        reward: null,
        proposal: null,
      };

      const existingReward = rewardByPersonnel.get(personnelId) ?? null;
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

      const personnelProposals = proposalsByPersonnel.get(personnelId) ?? [];
      for (const proposal of personnelProposals) {
        if (proposal.data_danh_hieu) {
          const dataList = Array.isArray(proposal.data_danh_hieu)
            ? (proposal.data_danh_hieu as Record<string, unknown>[])
            : [];

          const found = dataList.some(
            item => String(item.personnel_id) === personnelId && item.danh_hieu === danhHieu
          );

          if (found) {
            // APPROVED proposal: only block if award actually exists in DB
            if (proposal.status === PROPOSAL_STATUS.APPROVED && !result.has_reward) {
              continue;
            }
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
    errors: number;
    details: {
      created: DanhHieuHangNam[];
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

    const allowedDanhHieu = Object.values(DANH_HIEU_CA_NHAN_HANG_NAM) as string[];
    if (!allowedDanhHieu.includes(danh_hieu)) {
      throw new ValidationError(
        `Danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList(allowedDanhHieu)}.`
      );
    }

    const errors: { personnelId: string; error: string }[] = [];

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

    const personnelIds = personnel_ids.map(id => String(id)).filter(Boolean);
    const namInt = nam;

    const [allPersonnel, existingRewards, pendingProposals] = await Promise.all([
      prisma.quanNhan.findMany({ where: { id: { in: personnelIds } } }),
      prisma.danhHieuHangNam.findMany({
        where: { quan_nhan_id: { in: personnelIds }, nam: namInt },
      }),
      prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
          nam: namInt,
          status: PROPOSAL_STATUS.PENDING,
        },
      }),
    ]);

    const personnelMap = new Map(allPersonnel.map(p => [p.id, p] as const));
    const existingRewardMap = new Map(existingRewards.map(r => [r.quan_nhan_id, r] as const));
    const existingAwardSet = new Set(
      existingRewards
        .filter(r => {
          if (r.danh_hieu === danh_hieu) return true;
          if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP && r.nhan_bkbqp) return true;
          if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ && r.nhan_cstdtq) return true;
          if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP && r.nhan_bkttcp) return true;
          return false;
        })
        .map(r => r.quan_nhan_id)
    );
    const pendingProposalPersonnelSet = collectPendingProposalPersonnelIdsForAward(
      pendingProposals as Array<{ data_danh_hieu: unknown }>,
      danh_hieu
    );

    const eligibilityMap = new Map<string, { eligible: boolean; reason: string }>();
    if (isPersonalChainAward(danh_hieu)) {
      const eligibilityResults = await Promise.all(
        personnelIds.map(async personnelId => ({
          personnelId,
          result: await profileService.checkAwardEligibility(personnelId, namInt, danh_hieu),
        }))
      );
      for (const { personnelId, result } of eligibilityResults) {
        eligibilityMap.set(personnelId, result);
      }
    }

    const created = await prisma.$transaction(async prismaTx => {
      const txCreated: DanhHieuHangNam[] = [];

      for (const personnelId of personnelIds) {
        const personnelData = personnelDataMap[personnelId] || {};
        const individualSoQuyetDinh = personnelData.so_quyet_dinh || so_quyet_dinh;
        const individualCapBac = personnelData.cap_bac || cap_bac;
        const individualChucVu = personnelData.chuc_vu || chuc_vu;

        const personnel = personnelMap.get(personnelId);

        if (!personnel) {
          errors.push({ personnelId, error: 'Quân nhân không tồn tại' });
          continue;
        }

        if (existingAwardSet.has(personnelId)) {
          errors.push({
            personnelId,
            error: `Quân nhân đã có danh hiệu ${getDanhHieuName(danh_hieu)} năm ${namInt} trên hệ thống`,
          });
          continue;
        }
        if (pendingProposalPersonnelSet.has(personnelId)) {
          errors.push({
            personnelId,
            error: `Quân nhân đã có đề xuất danh hiệu ${getDanhHieuName(danh_hieu)} cho năm ${namInt}`,
          });
          continue;
        }

        if (isPersonalChainAward(danh_hieu)) {
          const eligibility = eligibilityMap.get(personnelId) || {
            eligible: false,
            reason: 'Không xác định được điều kiện khen thưởng',
          };
          if (!eligibility.eligible) {
            errors.push({
              personnelId,
              error: eligibility.reason,
            });
            continue;
          }
        }

        const isCoBanRow = DANH_HIEU_CA_NHAN_CO_BAN.has(danh_hieu);
        const isBkbqpRow = danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP;
        const isCstdtqRow = danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ;
        const isBkttcpRow = danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;
        const decisionErrors = validateDecisionNumbers(
          {
            danh_hieu: isCoBanRow ? danh_hieu : null,
            so_quyet_dinh: isCoBanRow ? individualSoQuyetDinh : null,
            nhan_bkbqp: isBkbqpRow,
            so_quyet_dinh_bkbqp: isBkbqpRow ? individualSoQuyetDinh : null,
            nhan_cstdtq: isCstdtqRow,
            so_quyet_dinh_cstdtq: isCstdtqRow ? individualSoQuyetDinh : null,
            nhan_bkttcp: isBkttcpRow,
            so_quyet_dinh_bkttcp: isBkttcpRow ? individualSoQuyetDinh : null,
          },
          { entityType: 'personal', entityName: personnel.ho_ten }
        );
        if (decisionErrors.length > 0) {
          errors.push({ personnelId, error: decisionErrors.join('\n') });
          continue;
        }

        const existingReward = existingRewardMap.get(personnelId) ?? null;

        let finalDanhHieu: string | null = null;
        let nhanBKBQP = false;
        let nhanCSTDTQ = false;
        let nhanBKTTCP = false;

        if (DANH_HIEU_CA_NHAN_CO_BAN.has(danh_hieu)) {
          finalDanhHieu = danh_hieu;
        } else if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP) {
          nhanBKBQP = true;
        } else if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ) {
          nhanCSTDTQ = true;
        } else if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP) {
          nhanBKTTCP = true;
        }

        let rewardRecord: DanhHieuHangNam;

        if (existingReward) {
          const isBangKhen = DANH_HIEU_CA_NHAN_BANG_KHEN.has(danh_hieu);
          const isCoBan = DANH_HIEU_CA_NHAN_CO_BAN.has(danh_hieu);
          const canUpdate = isBangKhen || (isCoBan && !existingReward.danh_hieu);

          if (!canUpdate) {
            errors.push({ personnelId, error: `Đã có danh hiệu ${getDanhHieuName(existingReward.danh_hieu || danh_hieu)} cho năm ${nam}` });
            continue;
          }

          const updateData: Prisma.DanhHieuHangNamUpdateInput = {};
          if (isBangKhen) {
            if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP) {
              updateData.nhan_bkbqp = true;
              if (individualSoQuyetDinh) updateData.so_quyet_dinh_bkbqp = individualSoQuyetDinh;
            } else if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ) {
              updateData.nhan_cstdtq = true;
              if (individualSoQuyetDinh) updateData.so_quyet_dinh_cstdtq = individualSoQuyetDinh;
            } else if (danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP) {
              updateData.nhan_bkttcp = true;
              if (individualSoQuyetDinh) updateData.so_quyet_dinh_bkttcp = individualSoQuyetDinh;
            }
          } else {
            updateData.danh_hieu = danh_hieu;
            if (individualSoQuyetDinh) updateData.so_quyet_dinh = individualSoQuyetDinh;
          }

          if (individualCapBac) updateData.cap_bac = individualCapBac;
          if (individualChucVu) updateData.chuc_vu = individualChucVu;
          if (ghi_chu) {
            if (nhanBKBQP) updateData.ghi_chu_bkbqp = ghi_chu;
            else if (nhanCSTDTQ) updateData.ghi_chu_cstdtq = ghi_chu;
            else if (nhanBKTTCP) updateData.ghi_chu_bkttcp = ghi_chu;
            else updateData.ghi_chu = ghi_chu;
          }

          rewardRecord = await prismaTx.danhHieuHangNam.update({
            where: { id: existingReward.id },
            data: updateData,
          });
        } else {
          const createData: Prisma.DanhHieuHangNamCreateInput = {
            QuanNhan: { connect: { id: personnelId } },
            nam: namInt,
            danh_hieu: finalDanhHieu,
            cap_bac: individualCapBac || null,
            chuc_vu: individualChucVu || null,
            ghi_chu: nhanBKBQP || nhanCSTDTQ || nhanBKTTCP ? null : (ghi_chu || null),
            nhan_bkbqp: nhanBKBQP,
            nhan_cstdtq: nhanCSTDTQ,
            nhan_bkttcp: nhanBKTTCP,
            ...(nhanBKBQP && ghi_chu && { ghi_chu_bkbqp: ghi_chu }),
            ...(nhanCSTDTQ && ghi_chu && { ghi_chu_cstdtq: ghi_chu }),
            ...(nhanBKTTCP && ghi_chu && { ghi_chu_bkttcp: ghi_chu }),
          };

          if (nhanBKBQP) {
            createData.so_quyet_dinh_bkbqp = individualSoQuyetDinh || null;
          } else if (nhanCSTDTQ) {
            createData.so_quyet_dinh_cstdtq = individualSoQuyetDinh || null;
          } else if (nhanBKTTCP) {
            createData.so_quyet_dinh_bkttcp = individualSoQuyetDinh || null;
          } else {
            createData.so_quyet_dinh = individualSoQuyetDinh || null;
          }

          rewardRecord = await prismaTx.danhHieuHangNam.create({
            data: createData,
          });
        }

        txCreated.push(rewardRecord);
      }

      return txCreated;
    });

    for (const rewardRecord of created) {
      await safeRecalculateAnnualProfile(rewardRecord.quan_nhan_id);
    }


    return {
      success: created.length,
      errors: errors.length,
      details: {
        created,
        errors,
      },
    };
  }

  async exportTemplate(
    personnelIds: string[] = [],
    repeatMap: Record<string, number> = {}
  ): Promise<ExcelJS.Workbook> {
    const columns: TemplateColumn[] = [...PERSONAL_ANNUAL_TEMPLATE_COLUMNS];

    return buildTemplate({
      sheetName: AWARD_EXCEL_SHEETS.ANNUAL_PERSONAL,
      columns,
      personnelIds,
      repeatMap,
      loaiKhenThuong: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      danhHieuOptions: buildDanhHieuExcelOptions([
        DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
        DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
      ]),
      editableColumnLetters: ['J', 'K'],
    });
  }

  async exportToExcel(filters: ExportFilters = {}): Promise<ExcelJS.Workbook> {
    const { nam, danh_hieu, don_vi_id, personnel_ids } = filters;

    const where: Prisma.DanhHieuHangNamWhereInput = {};
    if (nam) where.nam = nam;
    if (danh_hieu) where.danh_hieu = danh_hieu;
    if (personnel_ids && personnel_ids.length > 0) {
      where.quan_nhan_id = { in: personnel_ids };
    }
    if (don_vi_id) {
      where.QuanNhan = {
        OR: [{ co_quan_don_vi_id: don_vi_id }, { don_vi_truc_thuoc_id: don_vi_id }],
      };
    }

    const filteredAwards = await prisma.danhHieuHangNam.findMany({
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
      take: EXPORT_FETCH_LIMIT,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.ANNUAL_PERSONAL);

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

    styleHeaderRow(worksheet);

    filteredAwards.forEach((award, index) => {
      worksheet.addRow(
        sanitizeRowData({
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
        })
      );
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

  /**
   * Checks if a personnel has already received or has a pending HC_QKQT award.
   * @param personnelId - Personnel ID
   * @returns Check result with alreadyReceived flag and reason
   */
  async checkAlreadyReceivedHCQKQT(personnelId: string) {
    const existingAward = await prisma.huanChuongQuanKyQuyetThang.findUnique({
      where: { quan_nhan_id: personnelId },
    });
    if (existingAward) return { alreadyReceived: true, reason: 'Đã nhận', award: existingAward };

    const pendingProposal = await prisma.bangDeXuat.findFirst({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.HC_QKQT,
        status: PROPOSAL_STATUS.PENDING,
        data_nien_han: { array_contains: [{ personnel_id: personnelId }] },
      },
    });
    if (pendingProposal)
      return { alreadyReceived: true, reason: 'Đang chờ duyệt', proposal: pendingProposal };

    return { alreadyReceived: false, reason: null };
  }

  /**
   * Checks if a personnel has already received or has a pending KNC_VSNXD_QDNDVN award.
   * @param personnelId - Personnel ID
   * @returns Check result with alreadyReceived flag and reason
   */
  async checkAlreadyReceivedKNCVSNXDQDNDVN(personnelId: string) {
    const existingAward = await prisma.kyNiemChuongVSNXDQDNDVN.findUnique({
      where: { quan_nhan_id: personnelId },
    });
    if (existingAward) return { alreadyReceived: true, reason: 'Đã nhận', award: existingAward };

    const pendingProposal = await prisma.bangDeXuat.findFirst({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        status: PROPOSAL_STATUS.PENDING,
        data_nien_han: { array_contains: [{ personnel_id: personnelId }] },
      },
    });
    if (pendingProposal)
      return { alreadyReceived: true, reason: 'Đang chờ duyệt', proposal: pendingProposal };

    return { alreadyReceived: false, reason: null };
  }

  /**
   * Returns paginated list of annual awards with optional filters.
   * @param params - Filter and pagination params
   * @returns Awards list and total count
   */
  async getAnnualRewardsList(params: {
    page: number;
    limit: number;
    nam?: number;
    danh_hieu?: string;
    quanNhanWhere?: Record<string, unknown> | null;
  }) {
    const { page, limit, nam, danh_hieu, quanNhanWhere } = params;
    const where: Record<string, unknown> = {};
    if (nam) where.nam = nam;
    if (danh_hieu) where.danh_hieu = danh_hieu;
    if (quanNhanWhere) where.QuanNhan = quanNhanWhere;

    const [awards, total] = await Promise.all([
      prisma.danhHieuHangNam.findMany({
        where,
        include: {
          QuanNhan: { include: { CoQuanDonVi: true, DonViTrucThuoc: true, ChucVu: true } },
        },
        orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.danhHieuHangNam.count({ where }),
    ]);

    return { awards, total };
  }
}

export default new AnnualRewardService();
