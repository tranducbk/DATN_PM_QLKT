import ExcelJS from 'exceljs';
import type { DanhHieuHangNam, QuanNhan } from '../generated/prisma';
import {
  getAnnualRewards,
  createAnnualReward,
  updateAnnualReward,
  deleteAnnualReward,
  checkAnnualRewards,
  bulkCreateAnnualRewards,
  getStatistics,
  checkAlreadyReceivedHCQKQT,
  checkAlreadyReceivedKNCVSNXDQDNDVN,
  getAnnualRewardsList,
} from './annualReward/crud';
import {
  importFromExcelBuffer,
  previewImport,
  confirmImport,
} from './annualReward/import';
import { exportTemplate, exportToExcel } from './annualReward/excel';
import type {
  CreateAnnualRewardData,
  UpdateAnnualRewardData,
  ImportResult,
  PreviewResult,
  ConfirmImportItem,
  CheckResult,
  BulkCreateData,
  ExportFilters,
  StatisticsFilters,
} from './annualReward/types';

class AnnualRewardService {
  async getAnnualRewards(personnelId: string): Promise<DanhHieuHangNam[]> {
    return getAnnualRewards(personnelId);
  }

  async createAnnualReward(data: CreateAnnualRewardData): Promise<DanhHieuHangNam> {
    return createAnnualReward(data);
  }

  async updateAnnualReward(id: string, data: UpdateAnnualRewardData): Promise<DanhHieuHangNam> {
    return updateAnnualReward(id, data);
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
    return deleteAnnualReward(id, adminUsername, awardType);
  }

  async importFromExcelBuffer(buffer: Buffer): Promise<ImportResult> {
    return importFromExcelBuffer(buffer);
  }

  async previewImport(buffer: Buffer): Promise<PreviewResult> {
    return previewImport(buffer);
  }

  async confirmImport(validItems: ConfirmImportItem[]): Promise<{ imported: number }> {
    return confirmImport(validItems);
  }

  async checkAnnualRewards(
    personnelIds: string[],
    nam: number,
    danhHieu: string
  ): Promise<{ results: CheckResult[]; summary: Record<string, number> }> {
    return checkAnnualRewards(personnelIds, nam, danhHieu);
  }

  async bulkCreateAnnualRewards(data: BulkCreateData): Promise<{
    success: number;
    errors: number;
    details: {
      created: DanhHieuHangNam[];
      errors: { personnelId: string; error: string }[];
    };
  }> {
    return bulkCreateAnnualRewards(data);
  }

  async exportTemplate(
    personnelIds: string[] = [],
    repeatMap: Record<string, number> = {}
  ): Promise<ExcelJS.Workbook> {
    return exportTemplate(personnelIds, repeatMap);
  }

  async exportToExcel(filters: ExportFilters = {}): Promise<ExcelJS.Workbook> {
    return exportToExcel(filters);
  }

  async getStatistics(filters: StatisticsFilters = {}): Promise<{
    total: number;
    byDanhHieu: { danh_hieu: string | null; count: number }[];
    byNam: { nam: number; count: number }[];
  }> {
    return getStatistics(filters);
  }

  async checkAlreadyReceivedHCQKQT(personnelId: string) {
    return checkAlreadyReceivedHCQKQT(personnelId);
  }

  async checkAlreadyReceivedKNCVSNXDQDNDVN(personnelId: string) {
    return checkAlreadyReceivedKNCVSNXDQDNDVN(personnelId);
  }

  async getAnnualRewardsList(params: {
    page: number;
    limit: number;
    nam?: number;
    danh_hieu?: string;
    quanNhanWhere?: Record<string, unknown> | null;
  }) {
    return getAnnualRewardsList(params);
  }
}

export default new AnnualRewardService();
