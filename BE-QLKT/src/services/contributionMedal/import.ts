import { HCBVTQ_TEMPLATE_COLUMNS } from '../../constants/awardExcel.constants';
import { resolveTemplateColumns } from '../../helpers/excel/excelHelper';
import { prisma } from '../../models';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { contributionMedalRepository } from '../../repositories/contributionMedal.repository';
import { positionHistoryRepository } from '../../repositories/positionHistory.repository';
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
  DANH_HIEU_HCBVTQ,
  CONTRIBUTION_BASE_REQUIRED_MONTHS,
  CONTRIBUTION_FEMALE_REQUIRED_MONTHS,
  CONTRIBUTION_COEFFICIENT_GROUPS,
} from '../../constants/danhHieu.constants';
import { ValidationError } from '../../middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { GENDER } from '../../constants/gender.constants';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import { IMPORT_TRANSACTION_TIMEOUT } from '../../constants/excel.constants';
import { validateHCBVTQHighestRank } from '../../helpers/awardValidation/contributionMedalHighestRank';
import { evaluateHCBVTQRank } from '../eligibility/hcbvtqEligibility';
import { aggregatePositionMonthsByGroup } from '../eligibility/contributionMonthsAggregator';
import { buildCutoffDate } from '../../helpers/serviceYearsHelper';
import type { ContributionAwardValidItem } from './types';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  HCBVTQ (cống hiến) IMPORT — preview (validate) + confirm (ghi DB)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Cùng khung 2-bước như annualReward, NHƯNG đặc thù HCBVTQ:
 *   • 3 hạng Ba → Nhì → Nhất, nhận theo thứ tự, KHÔNG được nhảy/hạ bậc → confirm
 *     có downgrade check (xem block downgradeErrors).
 *   • Điều kiện dựa trên THỜI GIAN CỐNG HIẾN (cần lịch sử chức vụ) → preview phải
 *     query position history để tính, không chỉ đọc file.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Previews HCBVTQ import from Excel (validation only, no DB writes).
 * @param buffer - Raw Excel file buffer
 * @returns Valid rows with history and detailed validation errors
 */
export async function previewImport(buffer: Buffer) {
  const workbook = await loadWorkbook(buffer);
  // sheetName cố định (không auto-pick) → ép admin dùng đúng mẫu HCBVTQ, tránh
  // nhầm sheet loại khác.
  const worksheet = getAndValidateWorksheet(workbook, {
    sheetName: AWARD_EXCEL_SHEETS.HCBVTQ,
  });

  const headerMap = parseHeaderMap(worksheet);

  const cols = resolveTemplateColumns(headerMap, HCBVTQ_TEMPLATE_COLUMNS);
  const idCol = cols.id;
  const hoTenCol = cols.ho_ten;
  const namCol = cols.nam;
  const danhHieuCol = cols.danh_hieu;
  const capBacCol = cols.cap_bac;
  const chucVuCol = cols.chuc_vu;
  const thangCol = cols.thang;
  const soQuyetDinhCol = cols.so_quyet_dinh;
  const ghiChuCol = cols.ghi_chu;

  if (!idCol || !namCol || !danhHieuCol) {
    throw new ValidationError(
      `Thiếu cột bắt buộc: ID, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
    );
  }

  const validDanhHieu: string[] = Object.values(DANH_HIEU_HCBVTQ);
  const errors = [];
  const valid = [];
  let total = 0;
  const seenInFile = new Set();
  const currentYear = new Date().getFullYear();

  // Quét trước toàn bộ mã quân nhân trong file để batch-query (tránh N+1 trong loop chính).
  const allPersonnelIds = new Set<string>();
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    if (idValue) {
      const pid = String(idValue).trim();
      if (pid) allPersonnelIds.add(pid);
    }
  }

  // 5 nguồn dữ liệu chạy song song: hồ sơ quân nhân, HCBVTQ đã có, lịch sử chức vụ
  // (để tính thời gian cống hiến), số QĐ hợp lệ, và đề xuất cống hiến đang chờ duyệt.
  const [
    personnelList,
    existingAwardsList,
    allPositionHistories,
    existingDecisions,
    pendingProposals,
  ] = await Promise.all([
    allPersonnelIds.size > 0
      ? quanNhanRepository.findManyRaw({
          where: { id: { in: [...allPersonnelIds] } },
          select: {
            id: true,
            ho_ten: true,
            gioi_tinh: true,
            cap_bac: true,
            ChucVu: { select: { ten_chuc_vu: true } },
          },
        })
      : Promise.resolve([]),
    allPersonnelIds.size > 0
      ? contributionMedalRepository.findManyRaw({
          where: { quan_nhan_id: { in: [...allPersonnelIds] } },
        })
      : Promise.resolve([]),
    allPersonnelIds.size > 0
      ? positionHistoryRepository.findManyRaw({
          where: { quan_nhan_id: { in: [...allPersonnelIds] } },
          include: { ChucVu: { select: { he_so_chuc_vu: true } } },
        })
      : Promise.resolve([]),
    decisionFileRepository.findManyRaw({
      select: { so_quyet_dinh: true },
    }),
    proposalRepository.findManyRaw({
      where: { loai_de_xuat: PROPOSAL_TYPES.CONG_HIEN, status: PROPOSAL_STATUS.PENDING },
    }),
  ]);

  const personnelMap = new Map(personnelList.map(p => [p.id, p]));
  const existingAwardsMap = new Map(existingAwardsList.map(a => [a.quan_nhan_id, a]));
  // Gom lịch sử chức vụ theo quân nhân để tra nhanh khi tính thời gian giữ chức.
  const positionHistoriesMap = new Map<string, typeof allPositionHistories>();
  for (const h of allPositionHistories) {
    const list = positionHistoriesMap.get(h.quan_nhan_id) ?? [];
    list.push(h);
    positionHistoriesMap.set(h.quan_nhan_id, list);
  }
  const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

  // Tập id quân nhân đang có đề xuất HCBVTQ (cống hiến) chờ duyệt.
  const pendingPersonnelIds = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_cong_hien',
    item => (item.personnel_id ? String(item.personnel_id) : null)
  );

  // Duyệt từng dòng: validate tuần tự; lỗi gom vào errors (số dòng + lý do) và bỏ qua dòng.
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
    const namVal = row.getCell(namCol).value;
    const danh_hieu_raw = String(row.getCell(danhHieuCol).value ?? '').trim();
    const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
    const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
    const so_quyet_dinh = soQuyetDinhCol
      ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
      : null;
    const thangVal = thangCol ? row.getCell(thangCol).value : null;
    const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

    // Dòng trống hoàn toàn → bỏ qua.
    if (!idValue && !namVal && !danh_hieu_raw) continue;

    // Có mã nhưng bỏ trống danh hiệu → coi như dòng để trống cố ý, báo "bỏ qua".
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

    const missingFields = [];
    if (!idValue) missingFields.push('ID');
    if (!namVal) missingFields.push('Năm');
    if (!danh_hieu_raw) missingFields.push('Danh hiệu');
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
        danh_hieu: danh_hieu_raw,
        message: `Không tìm thấy quân nhân tương ứng với mã trong file.`,
      });
      continue;
    }

    // Họ tên trong file phải khớp hồ sơ (chống dán nhầm mã của người khác).
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

    // Năm phải là số nguyên và nằm trong [1900, năm hiện tại].
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

    // HCBVTQ tính theo mốc tháng/năm nhận → bắt buộc có tháng hợp lệ (1-12).
    const thang = thangVal ? parseInt(String(thangVal), 10) : null;
    if (!thang || thang < 1 || thang > 12) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu: danh_hieu_raw,
        message: `Tháng nhận không hợp lệ (cần 1-12, nhận được: ${thangVal ?? 'trống'})`,
      });
      continue;
    }

    // Danh hiệu phải thuộc HCBVTQ (3 hạng Ba/Nhì/Nhất).
    const resolvedDanhHieu = resolveDanhHieuCode(danh_hieu_raw);
    if (!validDanhHieu.includes(resolvedDanhHieu)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu: danh_hieu_raw,
        message: `Danh hiệu "${danh_hieu_raw}" không hợp lệ. Chỉ chấp nhận: ${formatDanhHieuList(validDanhHieu)}`,
      });
      continue;
    }
    const danh_hieu = resolvedDanhHieu;

    // Số quyết định bắt buộc + phải tồn tại trên hệ thống.
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

    // HC BVTQ is a one-time lifetime award — reject if same person appears twice
    if (seenInFile.has(personnelId)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu,
        message: `Trùng lặp trong file — mỗi quân nhân chỉ có 1 HCBVTQ`,
      });
      continue;
    }
    seenInFile.add(personnelId);

    // Đang có đề xuất cống hiến chờ duyệt → chặn để tránh trao trùng.
    if (pendingPersonnelIds.has(personnelId)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu,
        message: 'Quân nhân đang có đề xuất HC Bảo vệ Tổ quốc chờ duyệt',
      });
      continue;
    }

    // HC BVTQ can only be awarded once per lifetime
    const existingAward = existingAwardsMap.get(personnelId);
    if (existingAward) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu,
        message: `Đã có ${getDanhHieuName(existingAward.danh_hieu)} trên hệ thống`,
      });
      continue;
    }

    // Điều kiện HCBVTQ = tổng thời gian giữ chức vụ ở từng nhóm hệ số (0.7 / 0.8 /
    // 0.9-1.0), tính đến mốc tháng/năm nhận. evaluateHCBVTQRank chấm đủ ĐK theo hạng
    // + giới tính (nữ có ngưỡng riêng) và trả về số tháng yêu cầu.
    const positionHistories = positionHistoriesMap.get(personnelId) ?? [];
    const monthsByGroup = aggregatePositionMonthsByGroup(
      positionHistories,
      buildCutoffDate(nam, thang)
    );
    const months0_7 = monthsByGroup[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07];
    const months0_8 = monthsByGroup[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08];
    const months0_9_1_0 = monthsByGroup[CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10];

    const eligibility = evaluateHCBVTQRank(danh_hieu, monthsByGroup, personnel.gioi_tinh);
    const baseMonths = eligibility.requiredMonths;

    if (!eligibility.eligible) {
      const totalDisplay = `nhóm 0.7: ${months0_7} tháng, nhóm 0.8: ${months0_8} tháng, nhóm 0.9-1.0: ${months0_9_1_0} tháng`;
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu,
        message: `Chưa đủ thời gian giữ chức vụ cho ${getDanhHieuName(danh_hieu)} (cần ${baseMonths} tháng, hiện có: ${totalDisplay})`,
      });
      continue;
    }

    // Phải nhận đúng hạng CAO NHẤT mà thời gian cống hiến cho phép → chặn nếu chọn
    // hạng thấp hơn mức đủ điều kiện.
    const downgradeError = validateHCBVTQHighestRank(danh_hieu, monthsByGroup, baseMonths);
    if (downgradeError) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        danh_hieu,
        message: downgradeError,
      });
      continue;
    }

    // HCBVTQ chỉ nhận 1 lần/đời nên không có lịch sử trước đó để hiển thị.
    const history: { nam: number; danh_hieu: string; so_quyet_dinh: string | null }[] = [];

    // Tên/cấp bậc/chức vụ: ưu tiên giá trị trong file, thiếu thì lấy từ hồ sơ.
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

    // Dòng hợp lệ → đưa vào danh sách valid cho FE xem trước.
    valid.push({
      row: rowNumber,
      personnel_id: personnelId,
      ho_ten: hoTen,
      cap_bac: capBac,
      chuc_vu: chucVu,
      nam,
      thang,
      danh_hieu,
      so_quyet_dinh,
      ghi_chu,
      history,
    });
  }

  return { total, valid, errors };
}

/**
 * Persists validated import rows into the database.
 * HCBVTQ is one-time-per-lifetime — block if person already has any record.
 * @param validItems - Pre-validated items from previewImport
 * @returns Count and data of imported records
 */
export async function confirmImport(validItems: ContributionAwardValidItem[]) {
  const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

  // RE-VALIDATE trước khi ghi (không tin dữ liệu preview): tải lại đề xuất chờ duyệt
  // + HCBVTQ đã có để chặn trao trùng nếu DB đã đổi giữa lúc preview và confirm.
  const [pendingProposals, existingRecords] = await Promise.all([
    proposalRepository.findManyRaw({
      where: { loai_de_xuat: PROPOSAL_TYPES.CONG_HIEN, status: PROPOSAL_STATUS.PENDING },
    }),
    contributionMedalRepository.findManyRaw({
      where: { quan_nhan_id: { in: personnelIds } },
      select: { quan_nhan_id: true, danh_hieu: true },
    }),
  ]);

  // Quân nhân đang có đề xuất cống hiến chờ duyệt → gom xung đột rồi throw chặn cả lô.
  const pendingPersonnelIds = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_cong_hien',
    item => (item.personnel_id ? String(item.personnel_id) : null)
  );
  const pendingConflicts: string[] = [];
  for (const item of validItems) {
    if (pendingPersonnelIds.has(item.personnel_id)) {
      pendingConflicts.push(`${item.ho_ten}: đang có đề xuất HC Bảo vệ Tổ quốc chờ duyệt`);
    }
  }
  if (pendingConflicts.length > 0) {
    throw new ValidationError(pendingConflicts.join('; '));
  }
  const existingMap = new Map(existingRecords.map(r => [r.quan_nhan_id, r]));

  // HCBVTQ là huân chương 1 lần/đời → đã có bản ghi thì chặn, không trao lần 2.
  const conflicts: string[] = [];
  for (const item of validItems) {
    const existing = existingMap.get(item.personnel_id);
    if (existing) {
      conflicts.push(`${item.ho_ten}: đã có ${getDanhHieuName(existing.danh_hieu)} trên hệ thống`);
    }
  }
  if (conflicts.length > 0) {
    throw new ValidationError(conflicts.join('; '));
  }

  // Tải lại giới tính + lịch sử chức vụ để chấm lại downgrade ngay tại confirm
  // (không tin số tháng đã tính ở preview).
  const [personnelInfos, positionRows] = await Promise.all([
    quanNhanRepository.findManyRaw({
      where: { id: { in: personnelIds } },
      select: { id: true, gioi_tinh: true },
    }),
    positionHistoryRepository.findManyRaw({
      where: { quan_nhan_id: { in: personnelIds } },
      include: { ChucVu: { select: { he_so_chuc_vu: true } } },
    }),
  ]);
  const genderMap = new Map(personnelInfos.map(p => [p.id, p.gioi_tinh]));
  const positionsMap = new Map<string, typeof positionRows>();
  for (const h of positionRows) {
    const list = positionsMap.get(h.quan_nhan_id) ?? [];
    list.push(h);
    positionsMap.set(h.quan_nhan_id, list);
  }
  // Downgrade check: HCBVTQ xét theo thời gian giữ chức vụ ở từng nhóm hệ số
  // (LEVEL_07/08/09_10). Tính tổng tháng mỗi nhóm rồi đối chiếu ngưỡng yêu cầu
  // (nữ có ngưỡng riêng) → chặn nhập hạng cao hơn mức thời gian cho phép.
  const downgradeErrors: string[] = [];
  for (const item of validItems) {
    const histories = positionsMap.get(item.personnel_id) ?? [];
    const months = aggregatePositionMonthsByGroup(histories, buildCutoffDate(item.nam, item.thang));
    const isFemale = genderMap.get(item.personnel_id) === GENDER.FEMALE;
    const requiredMonths = isFemale
      ? CONTRIBUTION_FEMALE_REQUIRED_MONTHS
      : CONTRIBUTION_BASE_REQUIRED_MONTHS;
    const downgradeError = validateHCBVTQHighestRank(item.danh_hieu, months, requiredMonths);
    if (downgradeError) {
      downgradeErrors.push(`${item.ho_ten}: ${downgradeError}`);
    }
  }
  if (downgradeErrors.length > 0) {
    throw new ValidationError(downgradeErrors.join('; '));
  }

  // ─── TRANSACTION CONFIRM: INSERT HCBVTQ theo lô ───
  // validItems đã qua validation (chặn trùng + chặn HẠ hạng — xem validateHCBVTQHighestRank),
  // nên ở đây chỉ INSERT từng dòng trong 1 transaction → cả lô nguyên tử.
  // SQL minh hoạ:
  //   INSERT INTO "KhenThuongHCBVTQ" (quan_nhan_id, danh_hieu, nam, thang, cap_bac, so_quyet_dinh, ...)
  //     VALUES (...);
  return await prisma.$transaction(
    async prismaTx => {
      const results = [];
      for (const item of validItems) {
        const result = await contributionMedalRepository.create(
          {
            quan_nhan_id: item.personnel_id,
            danh_hieu: item.danh_hieu,
            nam: item.nam,
            thang: item.thang,
            cap_bac: item.cap_bac ?? null,
            chuc_vu: item.chuc_vu ?? null,
            so_quyet_dinh: item.so_quyet_dinh ?? null,
            ghi_chu: item.ghi_chu ?? null,
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
