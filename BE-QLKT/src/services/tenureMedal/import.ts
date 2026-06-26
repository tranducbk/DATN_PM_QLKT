import { HCCSVV_TEMPLATE_COLUMNS } from '../../constants/awardExcel.constants';
import { resolveTemplateColumns } from '../../helpers/excel/excelHelper';
import { prisma } from '../../models';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { tenureMedalRepository } from '../../repositories/tenureMedal.repository';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import { loadWorkbook, getAndValidateWorksheet } from '../../helpers/excel/excelImportHelper';
import {
  parseHeaderMap,
  resolvePersonnelInfo,
  buildPendingKeys,
  validatePersonnelNameMatch,
} from '../../helpers/excel/excelHelper';
import {
  getDanhHieuName,
  formatDanhHieuList,
  resolveDanhHieuCode,
  DANH_HIEU_HCCSVV,
  HCCSVV_YEARS_HANG_BA,
  HCCSVV_YEARS_HANG_NHI,
  HCCSVV_YEARS_HANG_NHAT,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import { IMPORT_TRANSACTION_TIMEOUT } from '../../constants/excel.constants';
import { ValidationError } from '../../middlewares/errorHandler';
import { validateHCCSVVRankOrder } from '../../helpers/awardValidation/tenureMedalRankOrder';
import { calculateServiceMonths, formatServiceDuration } from '../../helpers/serviceYearsHelper';
import type { HccsvvValidItem } from './types';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  HCCSVV (niên hạn) IMPORT — preview (validate) + confirm (ghi DB)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Cùng khung 2-bước. Đặc thù HCCSVV: 3 hạng Ba → Nhì → Nhất nhận tuần tự theo
 *  niên hạn, KHÔNG nhảy bậc/trùng → confirm sort theo hạng rồi check orderConflicts.
 *  previewImport auto-pick sheet (loại trừ sheet kỹ thuật) nhưng vẫn chặn nhầm
 *  file cá nhân (ANNUAL_PERSONAL) ngay sau khi đọc.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Xem trước (preview) import HCCSVV: kiểm tra dữ liệu Excel mà chưa ghi vào DB.
 * @param buffer - Buffer nội dung file Excel thô
 * @returns Kết quả validate gồm danh sách dòng hợp lệ, lỗi và tổng số dòng xét
 */
export async function previewImport(buffer: Buffer) {
  const workbook = await loadWorkbook(buffer);
  // Tự chọn sheet dữ liệu, bỏ 2 sheet kỹ thuật (_CapBac/_QuyetDinh) chỉ nuôi dropdown.
  const worksheet = getAndValidateWorksheet(workbook, {
    excludeSheetNames: ['_CapBac', '_QuyetDinh'],
  });

  // Chặn nhầm file ngay từ tên sheet: file hằng năm cá nhân/đơn vị có cấu trúc khác
  // hẳn HCCSVV → nếu cho chạy tiếp sẽ báo lỗi cột rối, khó hiểu cho người dùng.
  if (worksheet.name === AWARD_EXCEL_SHEETS.ANNUAL_PERSONAL) {
    throw new ValidationError(
      'File Excel không đúng loại. Đây là file danh hiệu hằng năm, không phải HCCSVV.'
    );
  }
  if (worksheet.name === AWARD_EXCEL_SHEETS.ANNUAL_UNIT) {
    throw new ValidationError(
      'File Excel không đúng loại. Đây là file khen thưởng đơn vị, không phải HCCSVV.'
    );
  }

  // Dò vị trí cột theo tên tiêu đề (không cố định index): người dùng có thể chèn/đổi
  // thứ tự cột trong template → ánh xạ tiêu đề → chỉ số cột thực tế.
  const headerMap = parseHeaderMap(worksheet);

  const cols = resolveTemplateColumns(headerMap, HCCSVV_TEMPLATE_COLUMNS);
  const idCol = cols.id;
  const hoTenCol = cols.ho_ten;
  const capBacCol = cols.cap_bac;
  const chucVuCol = cols.chuc_vu;
  const namCol = cols.nam;
  const thangCol = cols.thang;
  const danhHieuCol = cols.danh_hieu;
  const soQuyetDinhCol = cols.so_quyet_dinh;
  const ghiChuCol = cols.ghi_chu;

  // ID, Năm, Danh hiệu là tối thiểu để định danh + xét niên hạn; thiếu thì dừng sớm,
  // liệt kê các tiêu đề tìm được để người dùng đối chiếu sai tên cột.
  if (!idCol || !namCol || !danhHieuCol) {
    throw new ValidationError(
      `Thiếu cột bắt buộc: ID, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
    );
  }

  const validDanhHieu: string[] = Object.values(DANH_HIEU_HCCSVV);
  const errors = [];
  const valid: HccsvvValidItem[] = [];
  let total = 0;
  const seenInFile = new Set();
  const currentYear = new Date().getFullYear();

  // Nạp sẵn toàn bộ số quyết định đã tồn tại để check O(1) trong vòng lặp: số QĐ phải
  // có thật trên hệ thống chứ không chỉ khác rỗng (tránh nhập bừa số không có file QĐ).
  const existingDecisions = await decisionFileRepository.findManyRaw({
    select: { so_quyet_dinh: true },
  });
  const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

  // Thứ tự hạng: hạng Nhì cần đã có hạng Ba; hạng Nhất cần đã có hạng Nhì.
  const hierarchyPrerequisite = {
    [DANH_HIEU_HCCSVV.HANG_NHI]: DANH_HIEU_HCCSVV.HANG_BA,
    [DANH_HIEU_HCCSVV.HANG_NHAT]: DANH_HIEU_HCCSVV.HANG_NHI,
  };

  // Quét trước toàn bộ ID quân nhân trong file để batch query 1 lần (tránh N+1 query
  // trong vòng lặp validate bên dưới).
  const allPersonnelIds = new Set<string>();
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    if (idValue) {
      const id = String(idValue).trim();
      if (id) allPersonnelIds.add(id);
    }
  }

  // Lấy 3 nguồn song song (Promise.all) thay vì tuần tự: hồ sơ quân nhân, HCCSVV đã
  // có trên DB, và đề xuất niên hạn đang chờ duyệt — đều cần cho các check phía dưới.
  const [personnelList, existingHCCSVVRecords, pendingProposals] = await Promise.all([
    quanNhanRepository.findManyRaw({
      where: { id: { in: [...allPersonnelIds] } },
      include: { ChucVu: { select: { ten_chuc_vu: true } } },
    }),
    tenureMedalRepository.findManyRaw({
      where: { quan_nhan_id: { in: [...allPersonnelIds] } },
      select: { quan_nhan_id: true, danh_hieu: true, nam: true, so_quyet_dinh: true },
    }),
    proposalRepository.findManyRaw({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.NIEN_HAN,
        status: PROPOSAL_STATUS.PENDING,
      },
    }),
  ]);

  // Gom key "quân nhân + danh hiệu" của các đề xuất đang chờ → chặn import trùng với
  // việc đang nằm chờ duyệt (tránh trao 2 lần cùng 1 hạng).
  const pendingKeys = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_nien_han',
    item => (item.personnel_id && item.danh_hieu ? `${item.personnel_id}_${item.danh_hieu}` : null)
  );

  // Index hoá kết quả batch thành Map để tra cứu O(1) trong vòng lặp:
  //  - personnelMap: ID → hồ sơ quân nhân
  //  - hccsvvByKey: "quân nhân_danh hiệu" → bản ghi (check đã có đúng hạng đó chưa)
  //  - hccsvvByPersonnel: ID → list tất cả hạng đã có (dùng cho check thứ tự + lịch sử)
  const personnelMap = new Map(personnelList.map(p => [p.id, p]));
  const hccsvvByKey = new Map(
    existingHCCSVVRecords.map(r => [`${r.quan_nhan_id}_${r.danh_hieu}`, r])
  );
  const hccsvvByPersonnel = new Map<string, typeof existingHCCSVVRecords>();
  for (const r of existingHCCSVVRecords) {
    const list = hccsvvByPersonnel.get(r.quan_nhan_id) || [];
    list.push(r);
    hccsvvByPersonnel.set(r.quan_nhan_id, list);
  }

  // Duyệt từ dòng 2 (bỏ dòng tiêu đề) — mỗi dòng là 1 đề nghị trao 1 hạng HCCSVV.
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
    const namVal = row.getCell(namCol).value;
    const thangVal = thangCol ? row.getCell(thangCol).value : null;
    const danh_hieu_raw = String(row.getCell(danhHieuCol).value ?? '').trim();
    const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
    const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
    const so_quyet_dinh = soQuyetDinhCol
      ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
      : null;
    const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

    // Dòng trống hoàn toàn (không ID, năm, danh hiệu) → bỏ qua lặng lẽ, không tính lỗi.
    if (!idValue && !namVal && !danh_hieu_raw) continue;

    // Có ID nhưng quên điền danh hiệu → coi như dòng rỗng có chủ đích, ghi nhận bỏ qua.
    if (idValue && !danh_hieu_raw) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        thang: thangVal,
        danh_hieu: '',
        message: 'Bỏ qua — không có danh hiệu nào được điền',
      });
      continue;
    }

    // Chỉ đếm total cho dòng thực sự định trao 1 hạng — total này khớp số dòng được xét.
    total++;

    // Gom tất cả trường thiếu vào 1 thông báo thay vì báo lỗi rời rạc từng trường.
    const missingFields = [];
    if (!idValue) missingFields.push('ID');
    if (!namVal) missingFields.push('Năm');
    if (!thangVal) missingFields.push('Tháng');
    if (!danh_hieu_raw) missingFields.push('Danh hiệu');
    if (missingFields.length > 0) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: `Thiếu ${missingFields.join(', ')}`,
      });
      continue;
    }

    // Đối chiếu ID file với hồ sơ trong hệ thống: ID rỗng sau trim hoặc không khớp
    // quân nhân nào đều phải dừng — không thể trao danh hiệu cho người không tồn tại.
    const personnelId = String(idValue).trim();
    if (!personnelId) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
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
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: `Không tìm thấy quân nhân tương ứng với mã trong file.`,
      });
      continue;
    }

    // Tên trong file phải khớp tên trong hệ thống: cùng ID nhưng lệch tên thường là gõ
    // nhầm ID hoặc lẫn người → cảnh báo để tránh trao nhầm đối tượng.
    const nameMismatch = validatePersonnelNameMatch(ho_ten, personnel.ho_ten);
    if (nameMismatch) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: nameMismatch,
      });
      continue;
    }

    // Năm phải là số nguyên và không vượt quá năm hiện tại: niên hạn tính theo mốc trao
    // thật, không cho nhập năm tương lai (chưa đến thời điểm xét).
    const nam = parseInt(String(namVal), 10);
    if (!Number.isInteger(nam)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        thang: thangVal,
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
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
      });
      continue;
    }

    // Tháng giới hạn 1-12: dùng kết hợp với năm để tính mốc tham chiếu niên hạn bên dưới.
    const thang = parseInt(String(thangVal), 10);
    if (!Number.isInteger(thang) || thang < 1 || thang > 12) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: `Tháng "${thangVal}" không hợp lệ. Chỉ được nhập 1-12`,
      });
      continue;
    }

    // Chuẩn hoá tên danh hiệu người dùng gõ (vd "Hạng ba" → mã chuẩn) rồi mới đối chiếu
    // tập hợp lệ: cho phép nhập linh hoạt nhưng vẫn quy về 3 hạng chuẩn của HCCSVV.
    const resolvedDanhHieu = resolveDanhHieuCode(danh_hieu_raw);
    if (!validDanhHieu.includes(resolvedDanhHieu)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu: danh_hieu_raw,
        message: `Danh hiệu "${danh_hieu_raw}" không tồn tại. Chỉ chấp nhận: ${formatDanhHieuList(validDanhHieu)}`,
      });
      continue;
    }
    const danh_hieu = resolvedDanhHieu;

    // Số quyết định phải tồn tại trên hệ thống (không chỉ khác rỗng): mọi danh hiệu
    // trao đều phải gắn với 1 QĐ có thật để truy nguồn về sau.
    if (!so_quyet_dinh) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu,
        message: 'Thiếu số quyết định',
      });
      continue;
    }
    if (!validDecisionNumbers.has(so_quyet_dinh)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu,
        message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
      });
      continue;
    }

    // Chống trùng NỘI BỘ file: cùng quân nhân + cùng hạng xuất hiện 2 dòng → giữ dòng
    // đầu, báo lỗi dòng sau (tránh ghi đè không kiểm soát trong cùng 1 lần import).
    const fileKey = `${personnelId}_${danh_hieu}`;
    if (seenInFile.has(fileKey)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu,
        message: `Trùng lặp trong file — cùng quân nhân, danh hiệu ${danh_hieu}`,
      });
      continue;
    }
    seenInFile.add(fileKey);

    // Chống trùng với DB: quân nhân đã được trao đúng hạng này rồi → không trao lại.
    const existingRecord = hccsvvByKey.get(`${personnelId}_${danh_hieu}`);
    if (existingRecord) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu,
        message: `Đã có ${getDanhHieuName(danh_hieu)} trên hệ thống`,
      });
      continue;
    }

    // Chống trùng với đề xuất đang chờ duyệt: tránh trao tay khi đã có đề nghị cùng hạng
    // đang nằm trong hàng đợi phê duyệt.
    if (pendingKeys.has(`${personnelId}_${danh_hieu}`)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu,
        message: `Quân nhân đang có đề xuất ${getDanhHieuName(danh_hieu)} chờ duyệt`,
      });
      continue;
    }

    // Ràng buộc thứ tự hạng: muốn trao hạng cao phải đã có hạng liền dưới. Hạng tiên
    // quyết có thể nằm sẵn trong DB hoặc đang được nhập ở dòng trước trong cùng lô này
    // → phải xét cả hai nguồn, không chỉ DB.
    const prerequisite = hierarchyPrerequisite[danh_hieu];
    if (prerequisite) {
      const hasPrerequisiteInDb = hccsvvByKey.has(`${personnelId}_${prerequisite}`);
      const hasPrerequisiteInFile = valid.some(
        v => v.personnel_id === personnelId && v.danh_hieu === prerequisite
      );
      if (!hasPrerequisiteInDb && !hasPrerequisiteInFile) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          thang,
          danh_hieu,
          message: `Chưa có ${getDanhHieuName(prerequisite)}. Phải có hạng Ba trước hạng Nhì, hạng Nhì trước hạng Nhất`,
        });
        continue;
      }
    }

    // Gộp bản ghi DB + các dòng đã hợp lệ trước đó trong lô để kiểm tra năm trao tăng
    // dần theo hạng: hạng cao không được trao ở năm sớm hơn hạng thấp đã có.
    const existingForOrder = (hccsvvByPersonnel.get(personnelId) || []).map(r => ({
      danh_hieu: r.danh_hieu,
      nam: r.nam,
    }));
    for (const v of valid) {
      if (v.personnel_id === personnelId) {
        existingForOrder.push({ danh_hieu: v.danh_hieu, nam: v.nam });
      }
    }
    const orderError = validateHCCSVVRankOrder(danh_hieu, nam, existingForOrder);
    if (orderError) {
      errors.push({ row: rowNumber, ho_ten, nam, thang, danh_hieu, message: orderError });
      continue;
    }

    // Tính niên hạn theo NGÀY NHẬP NGŨ: mốc tham chiếu là cuối tháng trao (new Date với
    // day=0 → ngày cuối tháng trước thang+1). Nếu đã xuất ngũ thì chốt tại ngày xuất ngũ,
    // ngược lại tính đến mốc trao. Không có ngày nhập ngũ → bỏ qua check (=null).
    const refDate = new Date(nam, thang, 0);
    const serviceTotalMonths = personnel.ngay_nhap_ngu
      ? calculateServiceMonths(
          personnel.ngay_nhap_ngu as Date,
          (personnel.ngay_xuat_ngu as Date | null) ?? refDate
        )
      : null;

    // Đối chiếu số tháng phục vụ với ngưỡng năm yêu cầu của từng hạng (Ba/Nhì/Nhất):
    // chưa đủ niên hạn thì báo còn thiếu bao lâu cho người dùng biết.
    if (serviceTotalMonths !== null) {
      const yearsRequired: Record<string, number> = {
        [DANH_HIEU_HCCSVV.HANG_BA]: HCCSVV_YEARS_HANG_BA,
        [DANH_HIEU_HCCSVV.HANG_NHI]: HCCSVV_YEARS_HANG_NHI,
        [DANH_HIEU_HCCSVV.HANG_NHAT]: HCCSVV_YEARS_HANG_NHAT,
      };
      const required = yearsRequired[danh_hieu];
      if (required && serviceTotalMonths < required * 12) {
        const diff = required * 12 - serviceTotalMonths;
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          thang,
          danh_hieu,
          message: `Chưa đủ thời gian phục vụ cho ${getDanhHieuName(danh_hieu)} (yêu cầu ${required} năm, còn thiếu ${formatServiceDuration(diff)})`,
        });
        continue;
      }
    }

    // Đính kèm 5 danh hiệu gần nhất (mới → cũ) để FE hiển thị bối cảnh khi xác nhận
    // import — giúp người duyệt thấy lịch sử trao thưởng của quân nhân.
    const allRecords = hccsvvByPersonnel.get(personnelId) || [];
    const history = [...allRecords]
      .sort((a, b) => b.nam - a.nam)
      .slice(0, 5)
      .map(r => ({ nam: r.nam, danh_hieu: r.danh_hieu, so_quyet_dinh: r.so_quyet_dinh }));

    // Bù thông tin còn thiếu trong file từ hồ sơ hệ thống (cấp bậc, chức vụ): file ưu
    // tiên, hệ thống làm fallback. Vẫn thiếu ở cả 2 nguồn → báo lỗi để bổ sung.
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
        thang,
        danh_hieu,
        message: `Thiếu ${missingInfoFields.join(', ')} (cả trong file và hệ thống)`,
      });
      continue;
    }

    // Định dạng tổng thời gian phục vụ thành chuỗi dễ đọc (vd "15 năm 3 tháng") để hiển
    // thị; null khi không có ngày nhập ngũ.
    const tong_thoi_gian =
      serviceTotalMonths !== null ? formatServiceDuration(serviceTotalMonths) : null;

    // Dòng vượt qua mọi check → đẩy vào danh sách hợp lệ, đồng thời làm dữ liệu nền cho
    // các dòng sau (check thứ tự hạng + tiên quyết trong cùng lô).
    valid.push({
      row: rowNumber,
      personnel_id: personnelId,
      ho_ten: hoTen,
      cap_bac: capBac,
      chuc_vu: chucVu,
      nam,
      thang,
      tong_thoi_gian,
      danh_hieu,
      so_quyet_dinh,
      ghi_chu,
      history,
    });
  }

  return { total, valid, errors };
}

/**
 * Ghi các dòng HCCSVV đã được validate vào DB trong một transaction nguyên tử.
 * @param validItems - Danh sách dòng đã hợp lệ trả về từ previewImport
 * @returns Số bản ghi đã import và dữ liệu các bản ghi đó
 * @throws ValidationError - Khi phát hiện trùng đề xuất chờ, hạ hạng, hoặc sai thứ tự hạng
 */
export async function confirmImport(validItems: HccsvvValidItem[]) {
  // Gán trọng số cho 3 hạng để so sánh cao/thấp: chặn trao hạng thấp hơn hạng đang có.
  const HCCSVV_RANK: Record<string, number> = {
    [DANH_HIEU_HCCSVV.HANG_BA]: 1,
    [DANH_HIEU_HCCSVV.HANG_NHI]: 2,
    [DANH_HIEU_HCCSVV.HANG_NHAT]: 3,
  };

  const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

  // Re-fetch tại bước confirm vì DB có thể đã đổi sau preview (đề xuất mới, bản ghi mới):
  // tránh ghi đè dựa trên ảnh chụp cũ. Lấy song song đề xuất chờ + bản ghi HCCSVV hiện có.
  const [pendingProposals, existingRecords] = await Promise.all([
    proposalRepository.findManyRaw({
      where: { loai_de_xuat: PROPOSAL_TYPES.NIEN_HAN, status: PROPOSAL_STATUS.PENDING },
    }),
    tenureMedalRepository.findManyRaw({
      where: { quan_nhan_id: { in: personnelIds } },
      select: { quan_nhan_id: true, danh_hieu: true, nam: true },
    }),
  ]);

  // Tái kiểm tra trùng đề xuất chờ duyệt (đề xuất có thể mới phát sinh giữa preview và
  // confirm) → có trùng thì chặn toàn bộ lô để giữ tính nguyên tử.
  const pendingKeys = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_nien_han',
    item => (item.personnel_id && item.danh_hieu ? `${item.personnel_id}_${item.danh_hieu}` : null)
  );
  const pendingConflicts: string[] = [];
  for (const item of validItems) {
    if (pendingKeys.has(`${item.personnel_id}_${item.danh_hieu}`)) {
      pendingConflicts.push(
        `${item.ho_ten}: đang có đề xuất ${getDanhHieuName(item.danh_hieu)} chờ duyệt`
      );
    }
  }
  if (pendingConflicts.length > 0) {
    throw new ValidationError(pendingConflicts.join('; '));
  }

  // Lập bản đồ hạng cao nhất mỗi quân nhân đang có trên DB để so sánh chống hạ hạng.
  const highestRankMap = new Map<string, { danh_hieu: string; rank: number }>();
  for (const r of existingRecords) {
    const rank = HCCSVV_RANK[r.danh_hieu] || 0;
    const current = highestRankMap.get(r.quan_nhan_id);
    if (!current || rank > current.rank) {
      highestRankMap.set(r.quan_nhan_id, { danh_hieu: r.danh_hieu, rank });
    }
  }

  // Chặn hạ hạng: không cho import hạng thấp hơn hoặc bằng hạng cao nhất đã có (trừ khi
  // chính là hạng đó — trường hợp đó đã bị chặn trùng ở bước trên).
  const conflicts: string[] = [];
  for (const item of validItems) {
    const highest = highestRankMap.get(item.personnel_id);
    if (highest) {
      const importRank = HCCSVV_RANK[item.danh_hieu] || 0;
      if (importRank <= highest.rank && item.danh_hieu !== highest.danh_hieu) {
        conflicts.push(
          `${item.ho_ten}: đã có ${getDanhHieuName(highest.danh_hieu)}, không thể import ${getDanhHieuName(item.danh_hieu)} (hạng thấp hơn)`
        );
      }
    }
  }
  if (conflicts.length > 0) {
    throw new ValidationError(conflicts.join('; '));
  }

  // Index bản ghi DB theo quân nhân để làm nền cho check thứ tự năm trao bên dưới.
  const existingByPersonnel = new Map<string, { danh_hieu: string; nam: number }[]>();
  for (const r of existingRecords) {
    const list = existingByPersonnel.get(r.quan_nhan_id) || [];
    list.push({ danh_hieu: r.danh_hieu, nam: r.nam });
    existingByPersonnel.set(r.quan_nhan_id, list);
  }
  // Order check tuần tự: sort theo năm rồi duyệt, mỗi người tích luỹ dần các hạng
  // đã có (DB + các dòng trước trong cùng lô) → validateHCCSVVRankOrder đảm bảo
  // nhận đúng thứ tự Ba→Nhì→Nhất, không nhảy bậc. Phải gộp cả batchList vì trong
  // 1 file có thể nhập nhiều hạng cho cùng người — xét lẫn nhau, không chỉ với DB.
  const orderConflicts: string[] = [];
  const sortedItems = [...validItems].sort((a, b) => a.nam - b.nam);
  const accumulated = new Map<string, { danh_hieu: string; nam: number }[]>();
  for (const item of sortedItems) {
    const dbList = existingByPersonnel.get(item.personnel_id) || [];
    const batchList = accumulated.get(item.personnel_id) || [];
    const orderError = validateHCCSVVRankOrder(item.danh_hieu, item.nam, [...dbList, ...batchList]);
    if (orderError) {
      orderConflicts.push(`${item.ho_ten}: ${orderError}`);
    } else {
      batchList.push({ danh_hieu: item.danh_hieu, nam: item.nam });
      accumulated.set(item.personnel_id, batchList);
    }
  }
  if (orderConflicts.length > 0) {
    throw new ValidationError(orderConflicts.join('; '));
  }

  // ─── TRANSACTION CONFIRM: UPSERT HCCSVV theo lô ───
  // Khoá UPSERT = (quan_nhan_id, danh_hieu): mỗi người mỗi hạng (Ba/Nhì/Nhất) 1 dòng,
  // import lại cùng hạng → UPDATE (không tạo trùng). SQL minh hoạ:
  //   INSERT INTO "KhenThuongHCCSVV" (quan_nhan_id, danh_hieu, nam, thang, ...)
  //     VALUES (...)
  //     ON CONFLICT (quan_nhan_id, danh_hieu) DO UPDATE SET nam = $nam, so_quyet_dinh = ...;
  // Bọc transaction → cả file import nguyên tử (lỗi giữa chừng rollback hết).
  return await prisma.$transaction(
    async prismaTx => {
      const results = [];
      for (const item of validItems) {
        const result = await tenureMedalRepository.upsertRaw(
          {
            where: {
              quan_nhan_id_danh_hieu: {
                quan_nhan_id: item.personnel_id,
                danh_hieu: item.danh_hieu,
              },
            },
            update: {
              nam: item.nam,
              thang: item.thang ?? 12,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
            create: {
              quan_nhan_id: item.personnel_id,
              danh_hieu: item.danh_hieu,
              nam: item.nam,
              thang: item.thang ?? 12,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
          },
          prismaTx
        );
        results.push(result);
      }
      return { imported: results.length, data: results };
    },
    { timeout: IMPORT_TRANSACTION_TIMEOUT }
  );
}
