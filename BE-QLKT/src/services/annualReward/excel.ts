import { danhHieuHangNamRepository } from '../../repositories/danhHieu.repository';
import ExcelJS from 'exceljs';
import {
  buildDanhHieuExcelOptions,
  DANH_HIEU_CA_NHAN_HANG_NAM,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { sanitizeRowData } from '../../helpers/excel/excelHelper';
import type { Prisma } from '../../generated/prisma';
import { buildTemplate, TemplateColumn, styleHeaderRow } from '../../helpers/excel/excelTemplateHelper';
import { fetchTemplateData } from '../excel/templateData.service';
import { EXPORT_FETCH_LIMIT } from '../../constants/excel.constants';
import {
  ANNUAL_PERSONAL_EXPORT_COLUMNS,
  AWARD_EXCEL_SHEETS,
  PERSONAL_ANNUAL_TEMPLATE_COLUMNS,
} from '../../constants/awardExcel.constants';
import type { ExportFilters } from './types';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  ANNUAL REWARD — EXCEL EXPORT (2 đường ra file .xlsx khác mục đích)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  ① exportTemplate(): "Tải FILE MẪU để điền".
 *     - Sheet trống phần danh hiệu, nhưng prefill sẵn quân nhân (ID/tên/đơn vị)
 *       + dropdown (cấp bậc, danh hiệu, số QĐ) để admin chỉ việc chọn.
 *     - Mục đích: admin điền xong → upload lại qua đường IMPORT.
 *
 *  ② exportToExcel(): "Xuất DỮ LIỆU đã có ra file".
 *     - Đọc DanhHieuHangNam theo filter (năm/danh hiệu/đơn vị) → ghi từng dòng.
 *     - Mục đích: báo cáo/lưu trữ, KHÔNG nhằm để import lại.
 *
 *  Cả 2 đều CHỈ dựng object Workbook trong RAM rồi return. Việc biến Workbook →
 *  bytes (writeBuffer) + set header HTTP nằm ở CONTROLLER, không phải ở đây —
 *  giữ service thuần "business + dữ liệu", không dính tầng HTTP.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Builds the blank-but-prefilled import template for personal annual rewards.
 * @param personnelIds - Pre-selected personnel to prefill (empty = blank manual template)
 * @param repeatMap - Per-person row counts (e.g. one row per year)
 * @returns Workbook ready to stream as the .xlsx template
 */
export async function exportTemplate(
  personnelIds: string[] = [],
  repeatMap: Record<string, number> = {}
): Promise<ExcelJS.Workbook> {
  // Cấu hình cột là HẰNG SỐ tập trung (PERSONAL_ANNUAL_TEMPLATE_COLUMNS) — copy
  // ra mảng mới để buildTemplate không vô tình mutate hằng số gốc.
  const columns: TemplateColumn[] = [...PERSONAL_ANNUAL_TEMPLATE_COLUMNS];

  // Pre-fetch ngoài buildTemplate (helper phải pure, không query DB — rule AP-3).
  // Trả về: personnelList để prefill + decisionNumbers để đổ vào dropdown số QĐ.
  const { personnelList, decisionNumbers } = await fetchTemplateData({
    personnelIds,
    loaiKhenThuong: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
  });

  return buildTemplate({
    sheetName: AWARD_EXCEL_SHEETS.ANNUAL_PERSONAL,
    columns,
    personnelList,
    decisionNumbers,
    repeatMap,
    // Dropdown cột "danh hiệu" chỉ cho chọn 2 danh hiệu nền (CSTT/CSTDCS) — các
    // cờ chuỗi BKBQP/CSTDTQ/BKTTCP cố ý KHÔNG cho import qua Excel (cần nhập tay).
    danhHieuOptions: buildDanhHieuExcelOptions([
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    ]),
    // 'J', 'K' = 2 cột admin được điền (vd Danh hiệu, Số QĐ) → bật highlight khi
    // có nội dung. Chữ cái là toạ độ cột kiểu Excel (A=1, B=2, ..., J=10, K=11).
    editableColumnLetters: ['J', 'K'],
  });
}

/**
 * Exports existing personal annual reward records to an Excel report.
 * @param filters - Optional year / title / unit / personnel filters
 * @returns Workbook with one row per matching reward record
 */
export async function exportToExcel(filters: ExportFilters = {}): Promise<ExcelJS.Workbook> {
  const { nam, danh_hieu, don_vi_id, personnel_ids } = filters;

  // Build `where` TĂNG DẦN: chỉ thêm điều kiện khi filter có giá trị → filter
  // rỗng thì where = {} (lấy tất cả). Vd filters = { nam: 2025, don_vi_id: 'x' }
  // sẽ thành: WHERE nam = 2025 AND (co_quan_don_vi_id = 'x' OR don_vi_truc_thuoc_id = 'x').
  const where: Prisma.DanhHieuHangNamWhereInput = {};
  if (nam) where.nam = nam;
  if (danh_hieu) where.danh_hieu = danh_hieu;
  if (personnel_ids && personnel_ids.length > 0) {
    where.quan_nhan_id = { in: personnel_ids };
  }
  if (don_vi_id) {
    // Quân nhân có thể gắn đơn vị qua CQDV hoặc DVTT → OR cả 2 để không sót ai.
    where.QuanNhan = {
      OR: [{ co_quan_don_vi_id: don_vi_id }, { don_vi_truc_thuoc_id: don_vi_id }],
    };
  }

  const filteredAwards = (await danhHieuHangNamRepository.findMany({
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
  })) as Prisma.DanhHieuHangNamGetPayload<{
    include: { QuanNhan: { include: { CoQuanDonVi: true; DonViTrucThuoc: true } } };
  }>[];

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.ANNUAL_PERSONAL);

  // Gán cột export (khác cột template: có thêm cờ chuỗi, không có dropdown). `key`
  // của mỗi cột chính là key dùng trong object addRow bên dưới để khớp đúng ô.
  worksheet.columns = [...ANNUAL_PERSONAL_EXPORT_COLUMNS];

  styleHeaderRow(worksheet);

  // Mỗi record DB → 1 dòng. addRow nhận object keyed theo column.key (không theo
  // thứ tự thuộc tính). sanitizeRowData bọc ngoài để chống formula-injection:
  // vd ghi_chu = "=1+1" sẽ được đổi thành "'=1+1" → Excel hiển thị as-text.
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
