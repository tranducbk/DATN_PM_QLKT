// Facade gom toàn bộ proposal service về 1 instance duy nhất. Mỗi method chỉ
// uỷ quyền sang module con (helpers/core/submit/approve/...) đã tách theo concern.
// Mục đích: caller (controller) chỉ phụ thuộc 1 entry point ổn định, còn logic
// được chia nhỏ theo từng file để tránh service phình to (> 800 LOC).
import * as helpers from './helpers';
import * as core from './core';
import * as submit from './submit';
import * as approve from './approve';
import * as exportModule from './export';
import * as awards from './awards';
import * as validation from './validation';
import type { ProposalType } from '../../constants/proposalTypes.constants';
import type { DuplicateCheckResult } from './validation';
import type { SubmitTitleDataItem, SubmitAttachedFile } from './submit';
import type { EditedProposalData } from '../../types/proposal';

// Hình dạng file upload do multer cung cấp khi admin đính kèm PDF quyết định
// hoặc tệp bổ sung lúc duyệt. Khai báo tại đây để khỏi phụ thuộc kiểu của multer.
interface MulterFile {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
  fieldname: string;
}

class ProposalService {
  // Nhóm helper parse Excel: gói lại helper thuần (pure) để controller gọi qua
  // facade thống nhất, đồng thời ép kiểu cell của exceljs ngay tại ranh giới này.
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
  parseDanhHieuRow(row: import('exceljs').Row) {
    return helpers.parseDanhHieuRow(row);
  }
  parseThanhTichRow(row: import('exceljs').Row) {
    return helpers.parseThanhTichRow(row);
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

  // Nhóm CRUD đề xuất: đọc/xoá đề xuất luôn nhận cả userRole để module core
  // tự áp scope theo vai trò (User chỉ thấy của mình, Manager thấy theo đơn vị).
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

  // Nộp đề xuất: truyền nguyên `type` xuống module submit để bên trong dispatch
  // theo strategy registry dựng payload đúng từng loại danh hiệu. `thang` nullable
  // vì chỉ danh hiệu đột xuất/theo tháng mới có, còn hằng năm chỉ cần `nam`.
  async submitProposal(
    titleData: SubmitTitleDataItem[],
    attachedFiles: SubmitAttachedFile[] | null,
    userId: string,
    type: ProposalType,
    nam: number,
    ghiChu: string | null,
    thang: number | null
  ) {
    return submit.submitProposal(titleData, attachedFiles, userId, type, nam, ghiChu, thang);
  }

  // Duyệt đề xuất: `decisions` map danh hiệu -> số quyết định, `pdfFiles` map
  // file PDF kèm theo. Số quyết định chỉ được nhập lúc duyệt nên không nằm trong
  // payload nộp ban đầu. Toàn bộ flow import vào sổ khen thưởng nằm ở module approve.
  async approveProposal(
    proposalId: string,
    editedData: EditedProposalData,
    adminId: string,
    decisions: Record<string, string | null>,
    pdfFiles: Record<string, MulterFile>,
    ghiChu: string | null,
    adminAttachedFiles: MulterFile[] = []
  ) {
    return approve.approveProposal(
      proposalId,
      editedData,
      adminId,
      decisions,
      pdfFiles,
      ghiChu,
      adminAttachedFiles
    );
  }
  async rejectProposal(proposalId: string, lyDo: string, adminId: string) {
    return approve.rejectProposal(proposalId, lyDo, adminId);
  }

  // Lấy file PDF quyết định đã lưu để trả về cho FE tải xuống/xem lại.
  async getPdfFile(filename: string) {
    return exportModule.getPdfFile(filename);
  }

  // Nhóm tra cứu/thống kê khen thưởng đã trao: đọc từ sổ khen thưởng (khác với
  // bảng đề xuất), dùng cho màn hình danh sách + xuất Excel + dashboard.
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

  async getAwardsStatistics() {
    return awards.getAwardsStatistics();
  }

  // Nhóm kiểm tra trùng khen thưởng: chặn đề xuất 1 danh hiệu 2 lần cùng năm.
  // `excludeProposalId` để khi sửa đề xuất không tự coi chính nó là bản trùng.
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
    // Chạy song song bằng Promise.all để FE preview import nhiều dòng cùng lúc
    // không phải chờ tuần tự từng dòng; thứ tự kết quả giữ khớp với input.
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
    // Bản dành cho khen thưởng đơn vị: cùng cách chạy song song như bản cá nhân,
    // chỉ khác khoá định danh là don_vi_id thay vì personnel_id.
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

// Export singleton: cả ứng dụng dùng chung một instance proposal service.
export default new ProposalService();
