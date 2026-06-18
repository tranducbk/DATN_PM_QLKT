import * as crud from './unitAnnualAward/crud';
import * as eligibility from './unitAnnualAward/eligibility';
import * as excel from './unitAnnualAward/excel';
import * as importHelpers from './unitAnnualAward/import';
import type { UnitAnnualAwardValidItem } from './unitAnnualAward/types';

class UnitAnnualAwardService {
  calculateContinuousYears(donViId, year) {
    return eligibility.calculateContinuousYears(donViId, year);
  }
  calculateTotalDVQT(donViId, year) {
    return eligibility.calculateTotalDVQT(donViId, year);
  }
  buildSuggestion(du_dieu_kien_bkbqp: boolean, du_dieu_kien_bkttcp: boolean) {
    return eligibility.buildSuggestion(du_dieu_kien_bkbqp, du_dieu_kien_bkttcp);
  }
  checkUnitAwardEligibility(donViId, year, danhHieu) {
    return eligibility.checkUnitAwardEligibility(donViId, year, danhHieu);
  }
  recalculateAnnualUnit(donViId, year = null) {
    return eligibility.recalculateAnnualUnit(donViId, year);
  }
  recalculate(args) {
    return eligibility.recalculate(args);
  }

  list(args?) {
    return crud.list(args, this);
  }
  getSubUnits(coQuanDonViId) {
    return crud.getSubUnits(coQuanDonViId);
  }
  getById(id, userRole, userQuanNhanId) {
    return crud.getById(id, userRole, userQuanNhanId, this);
  }
  upsert(args) {
    return crud.upsert(args, this);
  }
  remove(id: string, awardType?: string | null) {
    return crud.remove(id, awardType, this);
  }
  getAnnualUnit(donViId, year) {
    return crud.getAnnualUnit(donViId, year);
  }
  getUnitAnnualAwards(donViId: string, userRole?: string, userQuanNhanId?: string | null) {
    return crud.getUnitAnnualAwards(donViId, userRole, userQuanNhanId);
  }

  exportTemplate(unitIds?: string[], repeatMap?: Record<string, number>) {
    return excel.exportTemplate(unitIds, repeatMap);
  }
  exportToExcel(filters, userRole, userQuanNhanId) {
    return excel.exportToExcel(filters, userRole, userQuanNhanId);
  }
  getStatistics(filters, userRole, userQuanNhanId) {
    return excel.getStatistics(filters, userRole, userQuanNhanId);
  }

  previewImport(buffer: Buffer) {
    return importHelpers.previewImport(buffer);
  }
  confirmImport(validItems: UnitAnnualAwardValidItem[], adminId: string) {
    return importHelpers.confirmImport(validItems, adminId);
  }
}

export default new UnitAnnualAwardService();
