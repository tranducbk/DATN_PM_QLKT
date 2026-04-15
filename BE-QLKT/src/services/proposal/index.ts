import * as helpers from './helpers';
import * as core from './core';
import * as submit from './submit';
import * as approve from './approve';
import * as exportModule from './export';
import * as awards from './awards';
import * as validation from './validation';
import type { Prisma } from '../../generated/prisma';
import type { ProposalType } from '../../constants/proposalTypes.constants';
import type { DuplicateCheckResult } from './validation';
import type { SubmitTitleDataItem, SubmitAttachedFile } from './submit';

interface MulterFile {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
  fieldname: string;
}

class ProposalService {
  sanitizeFilename(filename: string) {
    return helpers.sanitizeFilename(filename);
  }
  parseCCCD(value: unknown) {
    return helpers.parseCCCD(value as import('exceljs').CellValue);
  }
  parseCellToString(cell: unknown) {
    return helpers.parseCellToString(cell as { value?: import('exceljs').CellValue });
  }
  parseCellToInt(cell: unknown) {
    return helpers.parseCellToInt(cell as { value?: import('exceljs').CellValue });
  }
  isCellChecked(cell: unknown) {
    return helpers.isCellChecked(cell as { value?: import('exceljs').CellValue });
  }
  isSampleRow(text: string | null) {
    return helpers.isSampleRow(text);
  }
  logSheetInfo(sheet: import('exceljs').Worksheet, sheetName: string) {
    return helpers.logSheetInfo(sheet, sheetName);
  }
  parseDanhHieuRow(row: import('exceljs').Row, rowNumber: number) {
    return helpers.parseDanhHieuRow(row, rowNumber);
  }
  parseThanhTichRow(row: import('exceljs').Row, rowNumber: number) {
    return helpers.parseThanhTichRow(row, rowNumber);
  }
  parseDanhHieuSheet(sheet: import('exceljs').Worksheet) {
    return helpers.parseDanhHieuSheet(sheet);
  }
  parseThanhTichSheet(sheet: import('exceljs').Worksheet) {
    return helpers.parseThanhTichSheet(sheet);
  }
  calculateContinuousCSTDCS(
    danhHieuList: Array<{ nam: number; danh_hieu: string | null }>,
    currentYear: number
  ) {
    return helpers.calculateContinuousCSTDCS(danhHieuList, currentYear);
  }

  async getUserWithUnit(userId: string) {
    return core.getUserWithUnit(userId);
  }
  async getProposals(
    userId: string,
    userRole: string,
    page: number,
    limit: number
  ) {
    return core.getProposals(userId, userRole, page, limit);
  }
  async getProposalById(proposalId: string, userId: string, userRole: string) {
    return core.getProposalById(proposalId, userId, userRole);
  }
  async deleteProposal(proposalId: string, userId: string, userRole: string) {
    return core.deleteProposal(proposalId, userId, userRole);
  }

  async submitProposal(
    titleData: SubmitTitleDataItem[],
    attachedFiles: SubmitAttachedFile[] | null,
    soQuyetDinh: string | null,
    userId: string,
    type: ProposalType,
    nam: number,
    ghiChu: string | null
  ) {
    return submit.submitProposal(titleData, attachedFiles, soQuyetDinh, userId, type, nam, ghiChu);
  }

  async approveProposal(
    proposalId: string,
    editedData: Record<string, unknown>,
    adminId: string,
    decisions: Record<string, string | null>,
    pdfFiles: Record<string, MulterFile>,
    ghiChu: string | null
  ) {
    return approve.approveProposal(proposalId, editedData, adminId, decisions, pdfFiles, ghiChu);
  }
  async rejectProposal(proposalId: string, lyDo: string, adminId: string) {
    return approve.rejectProposal(proposalId, lyDo, adminId);
  }

  async exportTemplate(userId: string, type: string) {
    return exportModule.exportTemplate(userId, type);
  }
  async exportTemplateNienHan(workbook: import('exceljs').Workbook, quanNhanList: unknown[]) {
    return exportModule.exportTemplateNienHan(workbook, quanNhanList);
  }
  async downloadProposalExcel(proposalId: string) {
    return exportModule.downloadProposalExcel(proposalId);
  }
  async getPdfFile(filename: string) {
    return exportModule.getPdfFile(filename);
  }

  async getAllAwards(
    filters: Record<string, unknown>,
    page: number,
    limit: number
  ) {
    return awards.getAllAwards(filters, page, limit);
  }

  async exportAllAwardsExcel(filters: Record<string, unknown>) {
    return awards.exportAllAwardsExcel(filters);
  }
  async exportAwardsTemplate() {
    return awards.exportAwardsTemplate();
  }
  async importAwards(excelBuffer: Buffer, adminId: string) {
    return awards.importAwards(excelBuffer, adminId);
  }
  async getAwardsStatistics() {
    return awards.getAwardsStatistics();
  }

  async checkDuplicateAward(
    personnelId: string,
    nam: number,
    danhHieu: string,
    proposalType: string,
    status?: string | null,
    excludeProposalId?: string | null
  ): Promise<DuplicateCheckResult> {
    return validation.checkDuplicateAward(
      personnelId,
      nam,
      danhHieu,
      proposalType,
      status ?? null,
      excludeProposalId ?? null
    );
  }
  async checkDuplicateUnitAward(
    donViId: string,
    nam: number,
    danhHieu: string,
    proposalType: string
  ): Promise<DuplicateCheckResult> {
    return validation.checkDuplicateUnitAward(donViId, nam, danhHieu, proposalType);
  }

  /**
   * Batch-checks a list of personnel items for duplicate awards/proposals in parallel.
   * @param items - Array of items to check
   * @returns Array of results in the same order as input
   */
  async checkDuplicateBatch(
    items: Array<{ personnel_id: string; nam: number; danh_hieu: string; proposal_type: string }>
  ): Promise<Array<{ personnel_id: string; danh_hieu: string; exists: boolean; message?: string }>> {
    return Promise.all(
      items.map(async item => {
        const result = await validation.checkDuplicateAward(
          item.personnel_id,
          item.nam,
          item.danh_hieu,
          item.proposal_type
        );
        return { personnel_id: item.personnel_id, danh_hieu: item.danh_hieu, exists: result.exists, message: result.message };
      })
    );
  }

  /**
   * Batch-checks a list of unit items for duplicate awards/proposals in parallel.
   * @param items - Array of items to check
   * @returns Array of results in the same order as input
   */
  async checkDuplicateUnitBatch(
    items: Array<{ don_vi_id: string; nam: number; danh_hieu: string; proposal_type: string }>
  ): Promise<Array<{ don_vi_id: string; danh_hieu: string; exists: boolean; message?: string }>> {
    return Promise.all(
      items.map(async item => {
        const result = await validation.checkDuplicateUnitAward(
          item.don_vi_id,
          item.nam,
          item.danh_hieu,
          item.proposal_type
        );
        return { don_vi_id: item.don_vi_id, danh_hieu: item.danh_hieu, exists: result.exists, message: result.message };
      })
    );
  }
}

export default new ProposalService();
