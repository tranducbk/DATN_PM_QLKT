const helpers = require('./helpers');
const core = require('./core');
const submit = require('./submit');
const approve = require('./approve');
const exportModule = require('./export');
const awards = require('./awards');
const validation = require('./validation');

/**
 * ProposalService class that delegates to domain-specific modules.
 * Maintains backward compatibility with the original monolithic class API.
 */
class ProposalService {
  // === Helpers (exposed as instance methods for backward compat) ===
  sanitizeFilename(filename) {
    return helpers.sanitizeFilename(filename);
  }
  parseCCCD(value) {
    return helpers.parseCCCD(value);
  }
  parseCellToString(cell) {
    return helpers.parseCellToString(cell);
  }
  parseCellToInt(cell) {
    return helpers.parseCellToInt(cell);
  }
  isCellChecked(cell) {
    return helpers.isCellChecked(cell);
  }
  isSampleRow(text) {
    return helpers.isSampleRow(text);
  }
  logSheetInfo(sheet, sheetName) {
    return helpers.logSheetInfo(sheet, sheetName);
  }
  parseDanhHieuRow(row, rowNumber) {
    return helpers.parseDanhHieuRow(row, rowNumber);
  }
  parseThanhTichRow(row, rowNumber) {
    return helpers.parseThanhTichRow(row, rowNumber);
  }
  parseDanhHieuSheet(sheet) {
    return helpers.parseDanhHieuSheet(sheet);
  }
  parseThanhTichSheet(sheet) {
    return helpers.parseThanhTichSheet(sheet);
  }
  calculateContinuousCSTDCS(danhHieuList, currentYear) {
    return helpers.calculateContinuousCSTDCS(danhHieuList, currentYear);
  }

  // === Core CRUD ===
  async getUserWithUnit(userId) {
    return core.getUserWithUnit(userId);
  }
  async getProposals(userId, userRole, page, limit) {
    return core.getProposals(userId, userRole, page, limit);
  }
  async getProposalById(proposalId, userId, userRole) {
    return core.getProposalById(proposalId, userId, userRole);
  }
  async deleteProposal(proposalId, userId, userRole) {
    return core.deleteProposal(proposalId, userId, userRole);
  }

  // === Submission ===
  async submitProposal(titleData, attachedFiles, soQuyetDinh, userId, type, nam, ghiChu) {
    return submit.submitProposal(titleData, attachedFiles, soQuyetDinh, userId, type, nam, ghiChu);
  }

  // === Approval ===
  async approveProposal(proposalId, editedData, adminId, decisions, pdfFiles, ghiChu) {
    return approve.approveProposal(proposalId, editedData, adminId, decisions, pdfFiles, ghiChu);
  }
  async rejectProposal(proposalId, lyDo, adminId) {
    return approve.rejectProposal(proposalId, lyDo, adminId);
  }

  // === Export ===
  async exportTemplate(userId, type) {
    return exportModule.exportTemplate(userId, type);
  }
  async exportTemplateNienHan(workbook, quanNhanList) {
    return exportModule.exportTemplateNienHan(workbook, quanNhanList);
  }
  async downloadProposalExcel(proposalId) {
    return exportModule.downloadProposalExcel(proposalId);
  }
  async getPdfFile(filename) {
    return exportModule.getPdfFile(filename);
  }

  // === Awards management ===
  async getAllAwards(filters, page, limit) {
    return awards.getAllAwards(filters, page, limit);
  }
  async exportAllAwardsExcel(filters) {
    return awards.exportAllAwardsExcel(filters);
  }
  async exportAwardsTemplate() {
    return awards.exportAwardsTemplate();
  }
  async importAwards(excelBuffer, adminId) {
    return awards.importAwards(excelBuffer, adminId);
  }
  async getAwardsStatistics() {
    return awards.getAwardsStatistics();
  }

  // === Validation ===
  async checkDuplicateAward(personnelId, nam, danhHieu, proposalType, status, excludeProposalId) {
    return validation.checkDuplicateAward(
      personnelId,
      nam,
      danhHieu,
      proposalType,
      status,
      excludeProposalId
    );
  }
  async checkDuplicateUnitAward(donViId, nam, danhHieu, proposalType) {
    return validation.checkDuplicateUnitAward(donViId, nam, danhHieu, proposalType);
  }
}

module.exports = new ProposalService();
