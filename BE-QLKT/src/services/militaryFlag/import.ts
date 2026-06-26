import { HCQKQT_TEMPLATE_COLUMNS } from '../../constants/awardExcel.constants';
import { resolveTemplateColumns } from '../../helpers/excel/excelHelper';
import { prisma } from '../../models';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { militaryFlagRepository } from '../../repositories/militaryFlag.repository';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { loadWorkbook, getAndValidateWorksheet } from '../../helpers/excel/excelImportHelper';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { ValidationError } from '../../middlewares/errorHandler';
import { parseHeaderMap, resolvePersonnelInfo, buildPendingKeys, validatePersonnelNameMatch } from '../../helpers/excel/excelHelper';
import { IMPORT_TRANSACTION_TIMEOUT } from '../../constants/excel.constants';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import { HCQKQT_YEARS_REQUIRED } from '../../constants/danhHieu.constants';
import { calculateServiceMonths, formatServiceDuration } from '../../helpers/serviceYearsHelper';
import { PreviewError, PreviewValidItem, ConfirmImportItem } from './types';

/**
 * Đọc thử file Excel HC Quân kỳ quyết thắng, kiểm tra từng dòng và phân loại
 * hợp lệ / lỗi để hiển thị bản xem trước trước khi admin xác nhận import thật.
 * @param buffer - Nội dung file Excel người dùng tải lên (dạng Buffer)
 * @returns Đối tượng `{ total, valid, errors }` để FE hiển thị preview
 */
export async function previewImport(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, {
      sheetName: AWARD_EXCEL_SHEETS.HC_QKQT,
    });

    const headerMap = parseHeaderMap(worksheet);

    // Lấy vị trí cột từ chính config template export → import khớp đúng header đã
    // xuất, người dùng có thêm/bớt cột vẫn dò đúng theo tên (không index cứng).
    const cols = resolveTemplateColumns(headerMap, HCQKQT_TEMPLATE_COLUMNS);
    const idCol = cols.id;
    const hoTenCol = cols.ho_ten;
    const capBacCol = cols.cap_bac;
    const chucVuCol = cols.chuc_vu;
    const namCol = cols.nam;
    const thangCol = cols.thang;
    const soQuyetDinhCol = cols.so_quyet_dinh;
    const ghiChuCol = cols.ghi_chu;

    // ID và Năm là 2 cột không thể thiếu để định danh quân nhân và mốc trao.
    // Thiếu thì dừng sớm, kèm danh sách header tìm thấy để admin tự đối chiếu.
    if (!idCol || !namCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
      );
    }

    const errors: PreviewError[] = [];
    const valid: PreviewValidItem[] = [];
    let total = 0;
    // seenInFile: chặn 1 quân nhân xuất hiện 2 lần trong CÙNG file (HC_QKQT mỗi
    // người chỉ 1 record). currentYear: chặn nhập năm trao ở tương lai.
    const seenInFile = new Set<string>();
    const currentYear = new Date().getFullYear();

    // Quét trước toàn bộ ID để gom thành 1 tập rồi truy vấn 1 lần (tránh N+1
    // query trong vòng lặp validate bên dưới).
    const allPersonnelIds = new Set<string>();
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      if (idValue) {
        const pid = String(idValue).trim();
        if (pid) allPersonnelIds.add(pid);
      }
    }

    // Nạp song song 4 nguồn cần để validate: thông tin quân nhân, record HC_QKQT
    // đã có, số quyết định hợp lệ, và đề xuất HC_QKQT đang chờ duyệt.
    const [personnelList, existingAwardsList, existingDecisions, pendingProposals] =
      await Promise.all([
        allPersonnelIds.size > 0
          ? quanNhanRepository.findManyRaw({
              where: { id: { in: [...allPersonnelIds] } },
              select: {
                id: true,
                ho_ten: true,
                cap_bac: true,
                ngay_nhap_ngu: true,
                ChucVu: { select: { ten_chuc_vu: true } },
              },
            })
          : Promise.resolve([]),
        allPersonnelIds.size > 0
          ? militaryFlagRepository.findManyRaw({
              where: { quan_nhan_id: { in: [...allPersonnelIds] } },
            })
          : Promise.resolve([]),
        decisionFileRepository.findManyRaw({
          select: { so_quyet_dinh: true },
        }),
        proposalRepository.findManyRaw({
          where: {
            loai_de_xuat: PROPOSAL_TYPES.HC_QKQT,
            status: PROPOSAL_STATUS.PENDING,
          },
        }),
      ]);

    // Phẳng hoá đề xuất chờ duyệt thành tập personnel_id để check trùng O(1).
    const pendingPersonnelIds = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_nien_han',
      item => item.personnel_id as string
    );

    // Index hoá 3 nguồn về Map/Set để tra cứu O(1) cho mỗi dòng trong vòng lặp.
    const personnelMap = new Map(personnelList.map(p => [p.id, p]));
    const existingAwardsMap = new Map(existingAwardsList.map(a => [a.quan_nhan_id, a]));
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

    // Duyệt từng dòng dữ liệu (bắt đầu từ dòng 2 vì dòng 1 là header).
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
      const namVal = row.getCell(namCol).value;
      const thangVal = thangCol ? row.getCell(thangCol).value : null;
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
      const so_quyet_dinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

      // Dòng vừa trống ID vừa trống Năm coi là dòng rỗng → bỏ qua, không đếm
      // (tránh đếm nhầm các dòng kẻ thừa cuối file vào tổng số bản ghi).
      if (!idValue && !namVal) continue;

      total++;

      // Gom mọi field bắt buộc còn thiếu để báo 1 lần thay vì báo từng field.
      const missingFields: string[] = [];
      if (!idValue) missingFields.push('ID');
      if (!namVal) missingFields.push('Năm');
      if (!thangVal) missingFields.push('Tháng');
      if (missingFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
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
          message: `ID không hợp lệ: ${idValue}`,
        });
        continue;
      }
      // Tra trong Map đã nạp sẵn — ID không khớp quân nhân nào thì báo lỗi và
      // dùng message generic, không lộ mã ID kỹ thuật trong file ra cho user.
      const personnel = personnelMap.get(personnelId);
      if (!personnel) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          message: `Không tìm thấy quân nhân tương ứng với mã trong file.`,
        });
        continue;
      }

      // Đối chiếu tên trong file với tên DB — lệch tức admin nhiều khả năng gõ
      // nhầm ID của người khác; tên trong file chỉ để soát, không dùng để ghi.
      const nameMismatch = validatePersonnelNameMatch(ho_ten, personnel.ho_ten);
      if (nameMismatch) {
        errors.push({ row: rowNumber, ho_ten, nam: namVal, message: nameMismatch });
        continue;
      }

      // Năm phải là số nguyên và nằm trong [1900, năm hiện tại]: huân chương đã
      // trao nên không cho nhập năm tương lai; chặn ô gõ chữ hoặc năm vô lý.
      const nam = parseInt(String(namVal), 10);
      if (!Number.isInteger(nam)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          message: `Giá trị năm không hợp lệ: ${namVal}`,
        });
        continue;
      }
      if (nam < 1900 || nam > currentYear) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
        });
        continue;
      }

      // Tháng phải nguyên trong 1-12; dùng kèm năm để tính mốc thâm niên chuẩn.
      const thang = parseInt(String(thangVal), 10);
      if (!Number.isInteger(thang) || thang < 1 || thang > 12) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          thang: thangVal,
          message: `Tháng "${thangVal}" không hợp lệ. Chỉ được nhập 1-12`,
        });
        continue;
      }

      // Số quyết định bắt buộc và phải khớp một QĐ đã có trong hệ thống — không
      // cho gắn huân chương vào một số quyết định không tồn tại.
      if (!so_quyet_dinh) {
        errors.push({ row: rowNumber, ho_ten, nam, message: 'Thiếu số quyết định' });
        continue;
      }
      if (!validDecisionNumbers.has(so_quyet_dinh)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
        });
        continue;
      }

      // Chặn trùng NGAY TRONG file: HC_QKQT mỗi người chỉ 1 record nên 1 ID xuất
      // hiện 2 lần là lỗi. Chỉ add vào set sau khi đã qua mọi check phía trên.
      if (seenInFile.has(personnelId)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Trùng lặp trong file — quân nhân ${ho_ten ?? personnel.ho_ten} đã xuất hiện ở dòng trước`,
        });
        continue;
      }
      seenInFile.add(personnelId);

      // Chặn trùng với DB: đã có record HC_QKQT thì không trao lại lần nữa.
      const existingAward = existingAwardsMap.get(personnelId);
      if (existingAward) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Quân nhân đã có HC QKQT trên hệ thống (năm ${existingAward.nam})`,
        });
        continue;
      }

      // Chặn trùng với đề xuất đang chờ duyệt: tránh import đè lên luồng đang
      // chờ admin phê duyệt cho cùng quân nhân.
      if (pendingPersonnelIds.has(personnelId)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: 'Quân nhân đang có đề xuất HC Quân kỳ quyết thắng chờ duyệt',
        });
        continue;
      }

      // Kiểm tra đủ thâm niên phục vụ tới cuối tháng trao (refDate = ngày 0 của
      // tháng kế = ngày cuối tháng `thang`). Chỉ xét khi có ngày nhập ngũ; thiếu
      // tháng phục vụ thì báo còn thiếu bao lâu để admin biết rõ.
      if (personnel.ngay_nhap_ngu) {
        const refDate = new Date(nam, thang, 0);
        const serviceMonths = calculateServiceMonths(new Date(personnel.ngay_nhap_ngu), refDate);
        const requiredMonths = HCQKQT_YEARS_REQUIRED * 12;
        if (serviceMonths < requiredMonths) {
          const diff = requiredMonths - serviceMonths;
          errors.push({
            row: rowNumber,
            ho_ten,
            nam,
            thang,
            message: `Chưa đủ ${HCQKQT_YEARS_REQUIRED} năm phục vụ (hiện ${formatServiceDuration(serviceMonths)}, còn thiếu ${formatServiceDuration(diff)})`,
          });
          continue;
        }
      }

      // Tới đây existingAward chắc chắn null (đã chặn trùng DB ở trên) nên
      // history luôn rỗng; vẫn giữ cấu trúc này cho đồng nhất với các loại khác.
      const history = existingAward
        ? [{ nam: existingAward.nam, so_quyet_dinh: existingAward.so_quyet_dinh }]
        : [];

      // Lấy họ tên/cấp bậc/chức vụ ưu tiên giá trị trong file, trống thì fallback
      // DB; còn thiếu sau fallback mới báo lỗi (cả file lẫn hệ thống đều trống).
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
          message: `Thiếu ${missingInfoFields.join(', ')} (cả trong file và hệ thống)`,
        });
        continue;
      }

      // Dòng qua hết kiểm tra → đưa vào danh sách hợp lệ để chờ confirm import.
      valid.push({
        row: rowNumber,
        personnel_id: personnelId,
        ho_ten: hoTen,
        cap_bac: capBac,
        chuc_vu: chucVu,
        nam,
        thang,
        so_quyet_dinh,
        ghi_chu,
        history,
      });
    }

    return { total, valid, errors };
  }

/**
 * Ghi thật danh sách HC Quân kỳ quyết thắng đã được duyệt ở bước preview vào DB
 * trong một transaction, sau khi tái kiểm tra trùng để chống race condition.
 * @param validItems - Danh sách bản ghi hợp lệ lấy từ kết quả preview
 * @returns Đối tượng `{ imported, data }` cho biết số bản ghi đã ghi và dữ liệu
 * @throws ValidationError - Khi phát sinh đề xuất chờ duyệt hoặc record đã tồn tại
 */
export async function confirmImport(validItems: ConfirmImportItem[]) {
    const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

    // Tái kiểm tra song song ngay trước khi ghi: dữ liệu có thể đã đổi kể từ lúc
    // preview (admin khác vừa tạo đề xuất / vừa import) → chống ghi trùng.
    const [pendingProposals, existingRecords] = await Promise.all([
      proposalRepository.findManyRaw({
        where: { loai_de_xuat: PROPOSAL_TYPES.HC_QKQT, status: PROPOSAL_STATUS.PENDING },
      }),
      militaryFlagRepository.findManyRaw({
        where: { quan_nhan_id: { in: personnelIds } },
        select: { quan_nhan_id: true, nam: true },
      }),
    ]);

    const pendingPersonnelIds = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_nien_han',
      item => item.personnel_id as string
    );
    // Gom mọi xung đột "đang chờ duyệt" rồi báo 1 lần (theo tên) — dừng toàn bộ
    // import nếu có, để không ghi lệch với đề xuất đang treo.
    const pendingConflicts: string[] = [];
    for (const item of validItems) {
      if (pendingPersonnelIds.has(item.personnel_id)) {
        pendingConflicts.push(`${item.ho_ten}: đang có đề xuất HC Quân kỳ quyết thắng chờ duyệt`);
      }
    }
    if (pendingConflicts.length > 0) {
      throw new ValidationError(pendingConflicts.join('; '));
    }
    const existingSet = new Set(existingRecords.map(r => r.quan_nhan_id));

    // Tương tự, chặn các quân nhân vừa được tạo record HC_QKQT trong lúc preview.
    const conflicts: string[] = [];
    for (const item of validItems) {
      if (existingSet.has(item.personnel_id)) {
        conflicts.push(`${item.ho_ten}: đã có Huy chương Quân kỳ quyết thắng trên hệ thống`);
      }
    }
    if (conflicts.length > 0) {
      throw new ValidationError(conflicts.join('; '));
    }

    // Ghi trong 1 transaction → mọi dòng cùng thành công hoặc cùng rollback,
    // không để DB ở trạng thái import dở dang. Có timeout để tránh treo lâu.
    return await prisma.$transaction(
      async prismaTx => {
        const results = [];
        for (const item of validItems) {
          // upsert theo quan_nhan_id (mỗi người tối đa 1 record HC_QKQT): có sẵn
          // thì cập nhật, chưa có thì tạo mới. thang mặc định 12 khi file bỏ trống.
          const result = await militaryFlagRepository.upsertRaw(
            {
              where: { quan_nhan_id: item.personnel_id },
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
