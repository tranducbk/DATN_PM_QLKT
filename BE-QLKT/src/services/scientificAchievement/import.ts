import { NCKH_TEMPLATE_COLUMNS } from '../../constants/awardExcel.constants';
import { resolveTemplateColumns } from '../../helpers/excel/excelHelper';
import { prisma } from '../../models';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { scientificAchievementRepository } from '../../repositories/scientificAchievement.repository';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';
import { loadWorkbook, getAndValidateWorksheet } from '../../helpers/excel/excelImportHelper';
import { DANH_HIEU_NCKH, resolveNckhCode } from '../../constants/danhHieu.constants';
import { ValidationError } from '../../middlewares/errorHandler';
import { parseHeaderMap, resolvePersonnelInfo, validatePersonnelNameMatch } from '../../helpers/excel/excelHelper';
import { IMPORT_TRANSACTION_TIMEOUT } from '../../constants/excel.constants';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import { PreviewError, PreviewValidItem, ConfirmImportItem } from './types';

/**
 * Đọc thử file Excel NCKH, kiểm tra từng dòng nhưng CHƯA ghi DB (bước preview).
 * Tách dòng hợp lệ và dòng lỗi để admin xem trước rồi mới xác nhận import.
 * @param buffer - Nội dung file Excel người dùng tải lên (dạng Buffer)
 * @returns Tổng số dòng xét, danh sách dòng hợp lệ và danh sách dòng lỗi
 * @throws ValidationError - Khi sheet sai/quá lớn hoặc thiếu cột bắt buộc
 */
export async function previewImport(buffer: Buffer) {
    // Nạp toàn bộ workbook vào RAM rồi lấy đúng sheet NCKH theo tên; helper tự
    // chặn file quá lớn / sai sheet (fail fast trước khi vào vòng lặp parse).
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, { sheetName: AWARD_EXCEL_SHEETS.NCKH });

    const headerMap = parseHeaderMap(worksheet);


    // Dò vị trí cột theo header config (cùng nguồn dùng để dựng template export)
    // → đổi tên cột chỉ sửa 1 chỗ; cột vắng mặt trong file trả null.
    const cols = resolveTemplateColumns(headerMap, NCKH_TEMPLATE_COLUMNS);
    const idCol = cols.id;
    const hoTenCol = cols.ho_ten;
    const capBacCol = cols.cap_bac;
    const chucVuCol = cols.chuc_vu;
    const namCol = cols.nam;
    const loaiCol = cols.loai;
    const moTaCol = cols.mo_ta;
    const soQuyetDinhCol = cols.so_quyet_dinh;
    const ghiChuCol = cols.ghi_chu;

    // Thiếu 1 trong 4 cột nòng cốt → throw để chặn CẢ file: không thể đọc dòng nào
    // có ý nghĩa nếu thiếu định danh/năm/loại/mô tả (khác lỗi từng dòng ở dưới).
    if (!idCol || !namCol || !loaiCol || !moTaCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm, Loại, Mô tả. Tìm thấy headers: ${Object.keys(headerMap).join(
          ', '
        )}`
      );
    }

    const errors: PreviewError[] = [];
    const valid: PreviewValidItem[] = [];
    let total = 0;
    // seenInFile: chặn 2 dòng trùng nhau NGAY TRONG cùng 1 file (khác trùng với DB).
    const seenInFile = new Set<string>();
    const currentYear = new Date().getFullYear();

    // Lượt 1 — quét toàn bộ chỉ để gom mọi mã quân nhân; nhờ vậy lượt 2 query DB
    // 1 lần duy nhất theo danh sách id thay vì query trong vòng lặp (tránh N+1).
    const allPersonnelIds = new Set<string>();
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      if (idValue) {
        const pid = String(idValue).trim();
        if (pid) allPersonnelIds.add(pid);
      }
    }

    // Nạp song song 3 nguồn cần để validate (Promise.all): hồ sơ quân nhân, các
    // thành tích đã có trong DB (để chặn trùng + dựng lịch sử), và toàn bộ số QĐ
    // hợp lệ. Bỏ 2 query đầu khi file rỗng id để khỏi gọi DB vô ích.
    const [personnelList, existingAchievementsList, existingDecisions] = await Promise.all([
      allPersonnelIds.size > 0
        ? quanNhanRepository.findManyRaw({
            where: { id: { in: [...allPersonnelIds] } },
            select: { id: true, ho_ten: true, cap_bac: true, ChucVu: { select: { ten_chuc_vu: true } } },
          })
        : Promise.resolve([]),
      allPersonnelIds.size > 0
        ? scientificAchievementRepository.findManyRaw({
            where: { quan_nhan_id: { in: [...allPersonnelIds] } },
            select: { quan_nhan_id: true, nam: true, loai: true, mo_ta: true, so_quyet_dinh: true },
          })
        : Promise.resolve([]),
      decisionFileRepository.findManyRaw({
        select: { so_quyet_dinh: true },
      }),
    ]);

    // Tra cứu quân nhân theo id trong O(1) khi duyệt từng dòng (thay vì .find()).
    const personnelMap = new Map(personnelList.map(p => [p.id, p]));
    // Gom thành tích cũ theo từng quân nhân để dựng "lịch sử" hiển thị ở preview.
    const achievementsByPersonnel = new Map<string, typeof existingAchievementsList>();
    for (const a of existingAchievementsList) {
      const list = achievementsByPersonnel.get(a.quan_nhan_id) || [];
      list.push(a);
      achievementsByPersonnel.set(a.quan_nhan_id, list);
    }
    // Khoá tổng hợp (id_năm_loại_mô tả) để check 1 dòng đã tồn tại trong DB chưa.
    const existingAchievementKeys = new Set(
      existingAchievementsList.map(a => `${a.quan_nhan_id}_${a.nam}_${a.loai}_${a.mo_ta}`)
    );
    // Tập số QĐ hợp lệ — NCKH bắt buộc gắn với 1 quyết định đã có trên hệ thống.
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));
    // Lượt 2 — validate thực sự từng dòng (từ dòng 2 vì dòng 1 là header).
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
      const namVal = row.getCell(namCol).value;
      const loai_raw = loaiCol ? String(row.getCell(loaiCol).value ?? '').trim() : '';
      const mo_ta = moTaCol ? String(row.getCell(moTaCol).value ?? '').trim() : '';
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
      const so_quyet_dinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

      // Dòng trống hoàn toàn (không id/năm/loại) → bỏ qua im lặng, không tính lỗi.
      if (!idValue && !namVal && !loai_raw) continue;

      // Có id nhưng quên điền loại → coi là dòng bỏ trống có chủ ý, báo bỏ qua
      // chứ không liệt vào danh sách lỗi "thiếu trường" gây rối.
      if (idValue && !loai_raw) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: '',
          message: 'Bỏ qua — không có loại thành tích nào được điền',
        });
        continue;
      }

      // Từ đây là dòng "có ý định nhập" → tính vào tổng để báo cáo số xử lý.
      total++;

      // Gom mọi trường bắt buộc còn trống để báo 1 lần thay vì báo lẻ từng cái.
      const missingFields: string[] = [];
      if (!idValue) missingFields.push('ID');
      if (!namVal) missingFields.push('Năm');
      if (!loai_raw) missingFields.push('Loại');
      if (!mo_ta) missingFields.push('Mô tả');
      if (missingFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: loai_raw,
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
          loai: loai_raw,
          message: `ID không hợp lệ: ${idValue}`,
        });
        continue;
      }
      // Tra trong Map đã nạp sẵn; không thấy nghĩa là id không tồn tại trên hệ thống.
      const personnel = personnelMap.get(personnelId);
      if (!personnel) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: loai_raw,
          message: `Không tìm thấy quân nhân tương ứng với mã trong file.`,
        });
        continue;
      }

      // Đối chiếu tên trong file với tên DB (so khớp mềm) để bắt lỗi gõ nhầm id
      // của người khác; tên file để trống thì bỏ qua vì id đã đủ định danh.
      const nameMismatch = validatePersonnelNameMatch(ho_ten, personnel.ho_ten);
      if (nameMismatch) {
        errors.push({ row: rowNumber, ho_ten, nam: namVal, loai: loai_raw, message: nameMismatch });
        continue;
      }

      // Năm phải là số nguyên và không vượt năm hiện tại (không nhập NCKH tương lai).
      const nam = parseInt(String(namVal));
      if (!Number.isInteger(nam)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: loai_raw,
          message: `Giá trị năm không hợp lệ: ${namVal}`,
        });
        continue;
      }
      if (nam < 1900 || nam > currentYear) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai: loai_raw,
          message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
        });
        continue;
      }

      // Người dùng gõ tên loại tự do → chuẩn hoá về mã NCKH chuẩn (DTKH/SKKH...).
      // Không khớp mã nào → loại không hợp lệ, liệt kê các mã chấp nhận để sửa.
      const loai = resolveNckhCode(loai_raw);
      if (!loai) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai: loai_raw,
          message: `Loại "${loai_raw}" không hợp lệ. Chỉ chấp nhận: ${Object.values(DANH_HIEU_NCKH).join(', ')}`,
        });
        continue;
      }

      // Số QĐ bắt buộc và phải khớp 1 quyết định đã lưu — tránh gắn NCKH vào QĐ ma.
      if (!so_quyet_dinh) {
        errors.push({ row: rowNumber, ho_ten, nam, loai, message: 'Thiếu số quyết định' });
        continue;
      }
      if (!validDecisionNumbers.has(so_quyet_dinh)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai,
          message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
        });
        continue;
      }

      // 1 quân nhân có thể có NHIỀU NCKH/năm nên không chặn theo (id, năm); chỉ
      // coi là trùng khi giống CẢ loại + mô tả. Chặn 2 lớp: trùng trong file...
      const fileKey = `${personnel.id}_${nam}_${loai}_${mo_ta}`;
      if (seenInFile.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai,
          message: `Trùng lặp trong file — cùng quân nhân, năm ${nam}, loại ${loai}, mô tả "${mo_ta}"`,
        });
        continue;
      }
      seenInFile.add(fileKey);

      // ...và trùng với thành tích đã tồn tại trong DB (tránh nhập lại 2 lần).
      if (existingAchievementKeys.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai,
          message: 'Thành tích khoa học đã tồn tại',
        });
        continue;
      }

      // Đính kèm 5 thành tích gần nhất (mới → cũ) để admin có ngữ cảnh ngay ở
      // bảng preview, đỡ phải mở hồ sơ riêng đối chiếu trước khi xác nhận.
      const allRecords = achievementsByPersonnel.get(personnel.id) || [];
      const history = [...allRecords]
        .sort((a, b) => b.nam - a.nam)
        .slice(0, 5)
        .map(r => ({
          nam: r.nam,
          loai: r.loai,
          mo_ta: r.mo_ta,
          so_quyet_dinh: r.so_quyet_dinh,
        }));

      // Lấy họ tên/cấp bậc/chức vụ ưu tiên giá trị file, trống thì fallback DB;
      // nếu cả 2 nguồn đều thiếu mới báo lỗi (không bắt nhập lại cái đã có).
      const { hoTen, capBac, chucVu, missingFields: missingInfoFields } = resolvePersonnelInfo(
        { ho_ten, cap_bac, chuc_vu },
        personnel
      );
      if (missingInfoFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten: hoTen,
          nam,
          message: `Thiếu ${missingInfoFields.join(', ')} (cả trong file và hệ thống)`,
        });
        continue;
      }

      // Qua hết các chốt validate → dòng sạch, đẩy vào danh sách chờ xác nhận ghi.
      valid.push({
        row: rowNumber,
        personnel_id: personnel.id,
        ho_ten: hoTen,
        cap_bac: capBac,
        chuc_vu: chucVu,
        nam,
        loai,
        mo_ta,
        so_quyet_dinh,
        ghi_chu,
        history,
      });
    }

    return { total, valid, errors };
  }

/**
 * Ghi các dòng NCKH đã được preview duyệt sạch vào DB trong 1 transaction.
 * Recalc hồ sơ hằng năm KHÔNG làm ở đây mà do service bao ngoài đảm nhiệm.
 * @param validItems - Danh sách dòng hợp lệ lấy từ kết quả previewImport
 * @param adminId - Id admin thực hiện (phục vụ audit ở tầng gọi)
 * @returns Số bản ghi đã ghi và mảng bản ghi vừa tạo
 */
export async function confirmImport(validItems: ConfirmImportItem[], adminId: string) {
    // Bọc toàn bộ trong 1 transaction: ghi tất-cả-hoặc-không, lỗi giữa chừng thì
    // rollback sạch để DB không dính nửa file. timeout nới rộng cho file đông dòng.
    return await prisma.$transaction(
      async prismaTx => {
        const results = [];
        for (const item of validItems) {
          // Chuẩn hoá lại loại lần nữa phòng item lọt từ nguồn khác preview;
          // dữ liệu ở đây đã sạch nên chỉ insert thẳng, không validate lại.
          const result = await scientificAchievementRepository.create(
            {
              quan_nhan_id: item.personnel_id,
              nam: item.nam,
              loai: resolveNckhCode(item.loai) ?? item.loai,
              mo_ta: item.mo_ta,
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
