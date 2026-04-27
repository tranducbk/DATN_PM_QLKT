import * as crud from './unitAnnualAward/crud';
import * as eligibility from './unitAnnualAward/eligibility';
import * as excel from './unitAnnualAward/excel';
import * as importHelpers from './unitAnnualAward/import';
import type { UnitAnnualAwardValidItem } from './unitAnnualAward/types';

class UnitAnnualAwardService {
  calculateContinuousYears(donViId, year) {
    return eligibility.calculateContinuousYears(donViId, year);
  }
  countBKBQPInStreak(donViId, year, dvqtStreak?: number) {
    return eligibility.countBKBQPInStreak(donViId, year, dvqtStreak);
  }
  calculateTotalDVQT(donViId, year) {
    return eligibility.calculateTotalDVQT(donViId, year);
  }
  buildSuggestion(
    dvqtLienTuc: number,
    du_dieu_kien_bk_tong_cuc: boolean,
    du_dieu_kien_bk_thu_tuong: boolean,
    hasReceivedBKTTCP: boolean
  ) {
    return eligibility.buildSuggestion(
      dvqtLienTuc,
      du_dieu_kien_bk_tong_cuc,
      du_dieu_kien_bk_thu_tuong,
      hasReceivedBKTTCP
    );
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

  propose(args) {
    return crud.propose(args, this);
  }
  approve(id, args) {
    return crud.approve(id, args, this);
  }
  reject(id, args) {
    return crud.reject(id, args, this);
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
    return importHelpers.previewImport(buffer, this);
  }
  confirmImport(validItems: UnitAnnualAwardValidItem[], adminId: string) {
    return importHelpers.confirmImport(validItems, adminId);
  }
  importFromExcel(buffer: Buffer, adminId: string) {
    return importHelpers.importFromExcel(buffer, adminId, this);
  }
}

export default new UnitAnnualAwardService();
