import { KNC_TEMPLATE_COLUMNS } from '../../constants/awardExcel.constants';
import { resolveTemplateColumns } from '../../helpers/excel/excelHelper';
import { prisma } from '../../models';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { commemorativeMedalRepository } from '../../repositories/commemorativeMedal.repository';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import { calculateServiceMonths, formatServiceDuration } from '../../helpers/serviceYearsHelper';
import { loadWorkbook, getAndValidateWorksheet } from '../../helpers/excel/excelImportHelper';
import { parseHeaderMap, resolvePersonnelInfo, buildPendingKeys, validatePersonnelNameMatch } from '../../helpers/excel/excelHelper';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { ValidationError } from '../../middlewares/errorHandler';
import { IMPORT_TRANSACTION_TIMEOUT } from '../../constants/excel.constants';
import { DANH_HIEU_MAP, KNC_YEARS_REQUIRED_NAM, KNC_YEARS_REQUIRED_NU } from '../../constants/danhHieu.constants';
import { GENDER } from '../../constants/gender.constants';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import type { CommemorativeMedalValidItem } from './types';

/**
 * Xem trước (preview) việc nhập Excel cho Kỷ niệm chương — chỉ kiểm tra hợp lệ,
 * KHÔNG ghi DB. Trả về các dòng hợp lệ kèm lịch sử và danh sách lỗi chi tiết.
 *
 * Lưu ý: Kỷ niệm chương là một category gồm nhiều loại; hiện luồng import này
 * xử lý loại KNC_VSNXD_QDNDVN. Khi bổ sung loại KNC khác, nên dispatch theo từng
 * loại con qua registry thay vì hardcode một loại duy nhất.
 *
 * @param buffer - Buffer nội dung file Excel người dùng tải lên
 * @returns Object gồm `total` (số dòng đọc được), `valid` (dòng hợp lệ),
 *   `errors` (lỗi từng dòng để hiển thị cho người dùng)
 */
export async function previewImport(buffer: Buffer) {
  // Đọc workbook và lấy đúng sheet KNC theo tên — sai sheet sẽ báo lỗi ngay
  const workbook = await loadWorkbook(buffer);
  const worksheet = getAndValidateWorksheet(workbook, { sheetName: AWARD_EXCEL_SHEETS.KNC });

  const headerMap = parseHeaderMap(worksheet);


  // Map vị trí cột theo header thực tế (người dùng có thể đổi thứ tự cột)
  const cols = resolveTemplateColumns(headerMap, KNC_TEMPLATE_COLUMNS);
  const idCol = cols.id;
  const hoTenCol = cols.ho_ten;
  const namCol = cols.nam;
  const thangCol = cols.thang;
  const capBacCol = cols.cap_bac;
  const chucVuCol = cols.chuc_vu;
  const soQuyetDinhCol = cols.so_quyet_dinh;
  const ghiChuCol = cols.ghi_chu;

  // ID và Năm là cột tối thiểu để xác định quân nhân và mốc thời gian — thiếu thì bỏ cả file
  if (!idCol || !namCol) {
    throw new ValidationError(
      `Thiếu cột bắt buộc: ID, Năm. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
    );
  }

  const errors = [];
  const valid = [];
  let total = 0;
  const seenInFile = new Set();
  const currentYear = new Date().getFullYear();

  // Quét trước toàn bộ ID trong file để batch query một lần (tránh N+1 trong vòng lặp xử lý)
  const allPersonnelIds = new Set<string>();
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    if (idValue) {
      const pid = String(idValue).trim();
      if (pid) allPersonnelIds.add(pid);
    }
  }

  // Gom 4 nguồn dữ liệu cần đối chiếu trong 1 Promise.all (chạy song song, không tuần tự):
  // hồ sơ quân nhân, KNC đã trao, danh sách số quyết định hợp lệ, đề xuất KNC đang chờ duyệt
  const [personnelList, existingKncList, existingDecisions, pendingProposals] = await Promise.all([
    allPersonnelIds.size > 0
      ? quanNhanRepository.findManyRaw({
          where: { id: { in: [...allPersonnelIds] } },
          select: {
            id: true,
            ho_ten: true,
            gioi_tinh: true,
            ngay_nhap_ngu: true,
            cap_bac: true,
            ChucVu: { select: { ten_chuc_vu: true } },
          },
        })
      : Promise.resolve([]),
    allPersonnelIds.size > 0
      ? commemorativeMedalRepository.findManyRaw({
          where: { quan_nhan_id: { in: [...allPersonnelIds] } },
        })
      : Promise.resolve([]),
    decisionFileRepository.findManyRaw({
      select: { so_quyet_dinh: true },
    }),
    proposalRepository.findManyRaw({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        status: PROPOSAL_STATUS.PENDING,
      },
    }),
  ]);

  // Trích ID quân nhân đang vướng đề xuất KNC chờ duyệt — chặn import trùng đề xuất
  const pendingPersonnelIds = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_nien_han',
    item => (item.personnel_id ? String(item.personnel_id) : null)
  );

  // Chuyển kết quả batch sang Map/Set để tra cứu O(1) trong vòng lặp xử lý từng dòng
  const personnelMap = new Map(personnelList.map(p => [p.id, p]));
  const existingKncMap = new Map(existingKncList.map(k => [k.quan_nhan_id, k]));
  const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

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

    // Dòng vừa trống ID vừa trống Năm coi như dòng rỗng — bỏ qua, không tính vào total
    if (!idValue && !namVal) continue;

    total++;

    // Gom đủ các trường bắt buộc còn thiếu rồi báo 1 lần (đỡ phải sửa từng lần upload)
    const missingFields = [];
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
    // Mã trong file phải khớp một quân nhân thực tế trong hệ thống
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

    // Đối chiếu họ tên trong file với hồ sơ — chống nhập nhầm mã của quân nhân khác
    const nameMismatch = validatePersonnelNameMatch(ho_ten, personnel.ho_ten);
    if (nameMismatch) {
      errors.push({ row: rowNumber, ho_ten, nam: namVal, message: nameMismatch });
      continue;
    }

    // Năm phải là số nguyên và không vượt quá năm hiện tại (không trao cho tương lai)
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

    // Tháng dùng để tính mốc thâm niên phục vụ nên bắt buộc nằm trong 1-12
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

    // Số quyết định phải đã tồn tại trên hệ thống (không chỉ cần khác rỗng) — chống bịa số QĐ
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

    // Mỗi quân nhân chỉ được trao Kỷ niệm chương một lần — chặn trùng ngay trong cùng file
    if (seenInFile.has(personnel.id)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        message: `Trùng lặp trong file — quân nhân ${ho_ten ?? personnel.ho_ten} đã xuất hiện ở dòng trước`,
      });
      continue;
    }
    seenInFile.add(personnel.id);

    // Đã có KNC trong hệ thống thì không trao lại (Kỷ niệm chương trao một lần duy nhất)
    const existingKnc = existingKncMap.get(personnel.id);
    if (existingKnc) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        message: `Quân nhân đã được tặng ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} (năm ${existingKnc.nam})`,
      });
      continue;
    }

    // Đang có đề xuất chờ duyệt thì khoan import — tránh trao đúp khi đề xuất kia được duyệt
    if (pendingPersonnelIds.has(personnelId)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        message: `Quân nhân đang có đề xuất ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} chờ duyệt`,
      });
      continue;
    }

    // Điều kiện trao phụ thuộc thâm niên phục vụ — thiếu ngày nhập ngũ thì không tính được
    if (!personnel.ngay_nhap_ngu) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        message: 'Không có ngày nhập ngũ trong hồ sơ, không thể kiểm tra điều kiện',
      });
      continue;
    }

    // Từ chối thẳng nếu thiếu/sai giới tính: mặc định về Nam sẽ âm thầm áp ngưỡng năm cao hơn
    // và có thể loại oan quân nhân nữ vốn đủ điều kiện với ngưỡng thấp hơn.
    if (personnel.gioi_tinh !== GENDER.MALE && personnel.gioi_tinh !== GENDER.FEMALE) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        message: 'Chưa cập nhật thông tin giới tính',
      });
      continue;
    }

    // Mốc tính điều kiện = ngày cuối của tháng được chọn (new Date(nam, thang, 0));
    // ngưỡng năm phục vụ khác nhau theo giới tính (nữ thấp hơn nam)
    const ngayNhapNgu = new Date(personnel.ngay_nhap_ngu);
    const referenceDate = new Date(nam, thang, 0); // last day of selected month — eligibility reference date
    const serviceMonths = calculateServiceMonths(ngayNhapNgu, referenceDate);
    const isFemale = personnel.gioi_tinh === GENDER.FEMALE;
    const requiredYears = isFemale ? KNC_YEARS_REQUIRED_NU : KNC_YEARS_REQUIRED_NAM;

    // So sánh theo tháng (không làm tròn năm) để bắt chính xác trường hợp còn thiếu vài tháng
    const requiredMonths = requiredYears * 12;
    if (serviceMonths < requiredMonths) {
      const diff = requiredMonths - serviceMonths;
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        message: `Chưa đủ điều kiện: ${isFemale ? 'Nữ' : 'Nam'} cần >= ${requiredYears} năm phục vụ, hiện ${formatServiceDuration(serviceMonths)}, còn thiếu ${formatServiceDuration(diff)}`,
      });
      continue;
    }

    // Lịch sử lấy từ dữ liệu đã batch — tới đây existingKnc chắc chắn null (đã chặn ở trên),
    // nên history luôn rỗng. Giữ cấu trúc này để đồng nhất với các luồng import khác.
    const history = existingKnc
      ? [
          {
            nam: existingKnc.nam,
            so_quyet_dinh: existingKnc.so_quyet_dinh,
            ghi_chu: existingKnc.ghi_chu,
          },
        ]
      : [];

    // Lấy thông tin hiển thị ưu tiên giá trị trong file, thiếu thì bù từ hồ sơ hệ thống;
    // nếu cả hai đều thiếu thì coi như lỗi (không có dữ liệu để lưu)
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

    valid.push({
      row: rowNumber,
      personnel_id: personnel.id,
      ho_ten: hoTen,
      cap_bac: capBac,
      chuc_vu: chucVu,
      nam,
      thang,
      so_quyet_dinh,
      ghi_chu,
      service_years: Math.floor(serviceMonths / 12),
      gioi_tinh: personnel.gioi_tinh,
      history,
    });
  }

  return { total, valid, errors };
}

/**
 * Ghi xuống DB các dòng Kỷ niệm chương đã được preview xác nhận hợp lệ.
 *
 * Trước khi ghi, kiểm tra lại lần cuối (re-check) tình trạng trùng/đề xuất chờ duyệt
 * vì preview và confirm là 2 request tách rời — dữ liệu có thể thay đổi ở giữa.
 *
 * @param validItems - Danh sách dòng hợp lệ trả về từ previewImport
 * @param adminId - ID admin thực hiện (hiện chưa dùng, giữ cho audit về sau)
 * @returns Object gồm `imported` (số bản ghi đã ghi) và `data` (các bản ghi đã upsert)
 * @throws ValidationError - Khi phát hiện trùng KNC hoặc đề xuất chờ duyệt lúc xác nhận
 */
export async function confirmImport(validItems: CommemorativeMedalValidItem[], adminId: string) {
  void adminId;
  const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

  // Tải lại trạng thái mới nhất (đề xuất chờ duyệt + KNC đã có) để re-check chống race
  // giữa lúc preview và lúc confirm — chạy song song qua Promise.all
  const [pendingProposals, existingRecords] = await Promise.all([
    proposalRepository.findManyRaw({
      where: { loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN, status: PROPOSAL_STATUS.PENDING },
    }),
    commemorativeMedalRepository.findManyRaw({
      where: { quan_nhan_id: { in: personnelIds } },
      select: { quan_nhan_id: true, nam: true },
    }),
  ]);

  const pendingPersonnelIds = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_nien_han',
    item => (item.personnel_id ? String(item.personnel_id) : null)
  );
  // Nếu phát sinh đề xuất chờ duyệt sau preview thì hủy cả lô, gộp tên để admin xử lý 1 lần
  const pendingConflicts: string[] = [];
  for (const item of validItems) {
    if (pendingPersonnelIds.has(item.personnel_id)) {
      pendingConflicts.push(
        `${item.ho_ten}: đang có đề xuất ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} chờ duyệt`
      );
    }
  }
  if (pendingConflicts.length > 0) {
    throw new ValidationError(pendingConflicts.join('; '));
  }
  const existingSet = new Set(existingRecords.map(r => r.quan_nhan_id));

  // Chặn lần cuối những quân nhân vừa được trao KNC sau bước preview (trao một lần duy nhất)
  const conflicts: string[] = [];
  for (const item of validItems) {
    if (existingSet.has(item.personnel_id)) {
      conflicts.push(`${item.ho_ten}: đã có ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} trên hệ thống`);
    }
  }
  if (conflicts.length > 0) {
    throw new ValidationError(conflicts.join('; '));
  }

  // Ghi cả lô trong 1 transaction: hoặc thành công toàn bộ, hoặc rollback hết (đảm bảo atomic).
  // Dùng upsert theo quan_nhan_id để an toàn trước race ở phút chót, kèm timeout cho lô lớn.
  return await prisma.$transaction(
    async prismaTx => {
      const results = [];
      for (const item of validItems) {
        const result = await commemorativeMedalRepository.upsertRaw(
          {
            where: { quan_nhan_id: item.personnel_id },
            // Thiếu tháng thì mặc định tháng 12 (cuối năm) cho nhất quán mốc lưu trữ
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
