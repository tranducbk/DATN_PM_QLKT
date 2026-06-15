import { Worksheet, CellValue } from 'exceljs';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  EXCEL HELPER — tiện ích PURE dùng chung cho cả import lẫn export
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Đặc điểm: TẤT CẢ hàm ở đây đều pure (không đụng DB / không I/O). Service
 *  fetch dữ liệu rồi truyền vào — giữ helper test được độc lập (đúng rule AP-3).
 *
 *  Gom 3 nhóm việc nhỏ hay lặp khi làm Excel:
 *   1. Đọc HEADER linh hoạt: file người dùng tự sửa → tên cột lệch dấu/khoảng
 *      trắng. parseHeaderMap + getHeaderCol chuẩn hoá về key ASCII để khớp.
 *   2. Ép kiểu CELL về primitive an toàn: parseBooleanValue cho cột cờ.
 *   3. BẢO MẬT: sanitizeRowData chống formula-injection khi GHI dữ liệu user
 *      ra file; validatePersonnelNameMatch chống gán nhầm ID ↔ tên.
 * ════════════════════════════════════════════════════════════════════════════
 */

/** Removes Vietnamese accents and returns ASCII text. */
function removeVietnameseAccents(str: string): string {
  // NFD tách ký tự gốc khỏi dấu (vd "ế" → "e" + "◌́"); regex [̀-ͯ]
  // dùng cú pháp [A-B] = "ký tự nằm trong dải mã từ A đến B", ở đây là toàn bộ
  // dấu kết hợp U+0300..U+036F → xoá sạch. đ/Đ là chữ riêng, không nằm trong dải
  // đó nên NFD không tách được dấu → phải thay tay bằng 2 .replace cuối.
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Parses row 1 headers into a normalized key -> column number map.
 * @param worksheet - Worksheet to parse
 * @returns Header key to 1-based column number map
 */
function parseHeaderMap(worksheet: Worksheet): Record<string, number> {
  // Đọc dòng 1 (header) → trả map { ho_va_ten: 2, nam: 5, ... } để hàm khác
  // tra cột theo TÊN thay vì index cứng — file thêm/bớt cột vẫn map đúng.
  const headerRow = worksheet.getRow(1);
  const headerMap: Record<string, number> = {};

  headerRow.eachCell((cell, colNumber) => {
    // Chuẩn hoá từng header: "Họ và tên " → "ho_va_ten". Bỏ dấu → snake_case →
    // bỏ ký tự lạ → gộp/cắt gạch dưới thừa. Nhờ vậy gõ hoa/thường/thừa space
    // vẫn ra cùng key.
    const rawValue = String(cell.value ?? '')
      .trim()
      .toLowerCase();
    const key = removeVietnameseAccents(rawValue)
      .replace(/\s+/g, '_') // \s+ = cụm khoảng trắng (1 hoặc nhiều) → "_": "ho va ten" thành "ho_va_ten"
      .replace(/[^a-z0-9_]/g, '') // [^...] = KHÔNG phải chữ/số/"_" → xoá ký tự lạ như ( ) . / %
      .replace(/_+/g, '_') // _+ = nhiều "_" liền nhau → gộp lại còn 1: "ho__ten" thành "ho_ten"
      .replace(/^_|_$/g, ''); // ^_ = "_" ở đầu chuỗi, _$ = "_" ở cuối → cắt "_" thừa 2 rìa
    if (key) headerMap[key] = colNumber;
  });

  return headerMap;
}

/**
 * Finds a header column by trying multiple key variations.
 * @param headerMap - Header map from parseHeaderMap
 * @param variations - Candidate header keys (e.g. ['ho_ten', 'hoten'])
 * @returns 1-based column number, or null when not found
 */
function getHeaderCol(headerMap: Record<string, number>, variations: string[]): number | null {
  // Một cột có thể được người dùng đặt nhiều cách: ['ho_ten','hoten','ten'].
  // Thử lần lượt, trúng biến thể nào trả luôn cột đó; không trúng → null để
  // caller tự quyết (báo thiếu cột bắt buộc, hoặc bỏ qua cột tuỳ chọn).
  for (const v of variations) {
    if (headerMap[v]) return headerMap[v];
  }
  return null;
}

/**
 * Parses an Excel cell value to boolean.
 * @param value - Raw Excel cell value
 * @returns True when value represents an affirmative flag
 */
function parseBooleanValue(value: CellValue | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  // Cột cờ trong Excel người dùng gõ tự do — chấp nhận nhiều cách viết "đồng ý".
  const strVal = String(value).trim().toLowerCase();
  return ['có', 'co', 'true', '1', 'x'].includes(strVal);
}

/**
 * Resolves personnel display data from Excel row and DB fallback.
 * @param row - Excel row values (ho_ten, cap_bac, chuc_vu)
 * @param personnel - Personnel record from database
 * @returns Resolved values and missing field names
 */
function resolvePersonnelInfo(
  row: { ho_ten?: string | null; cap_bac?: string | null; chuc_vu?: string | null },
  personnel: { ho_ten: string; cap_bac?: string | null; ChucVu?: { ten_chuc_vu: string } | null }
): { hoTen: string | null; capBac: string | null; chucVu: string | null; missingFields: string[] } {
  // Ưu tiên giá trị trong FILE; trống thì fallback về DB. Lý do: file là dữ
  // liệu mới nhất admin gõ; nhưng nếu admin bỏ trống ô thì dùng cái DB đang có
  // thay vì báo thiếu — đỡ phải nhập lại thông tin đã có sẵn.
  const hoTen = row.ho_ten || personnel.ho_ten;
  const capBac = row.cap_bac || personnel.cap_bac || null;
  const chucVu = row.chuc_vu || personnel.ChucVu?.ten_chuc_vu || null;

  // Sau khi fallback mà VẪN trống → đây mới là thiếu thật, gom tên field để báo.
  const missingFields: string[] = [];
  if (!hoTen) missingFields.push('Họ tên');
  if (!capBac) missingFields.push('Cấp bậc');
  if (!chucVu) missingFields.push('Chức vụ');

  return { hoTen, capBac, chucVu, missingFields };
}

/**
 * Builds a key set from pending proposals for fast duplicate checks.
 * @param proposals - Pending proposals from bangDeXuat
 * @param dataField - JSON data field name (for example: data_danh_hieu)
 * @param keyBuilder - Callback to build a key from each proposal item
 * @returns Set of keys for O(1) lookup
 */
function buildPendingKeys(
  proposals: Array<Record<string, unknown>>,
  dataField: string,
  keyBuilder: (item: Record<string, unknown>, proposal: Record<string, unknown>) => string | null
): Set<string> {
  // Đề xuất đang chờ duyệt lưu danh sách trong cột JSON (vd data_danh_hieu).
  // Duyệt 1 lần, "phẳng hoá" mọi item thành key (vd `${personnel_id}_${nam}`)
  // bỏ vào Set → check trùng sau này là O(1) thay vì lồng 2 vòng for O(n²).
  const keys = new Set<string>();
  for (const proposal of proposals) {
    const data = (proposal[dataField] as Array<Record<string, unknown>>) || [];
    for (const item of data) {
      const key = keyBuilder(item, proposal);
      if (key) keys.add(key);
    }
  }
  return keys;
}

/**
 * Escapes string values that start with formula-trigger characters (=, +, -, @, |, \t, \r).
 * Prevents CSV/Excel formula injection when user data is written to spreadsheet cells.
 * @param row - Row data object to sanitize
 * @returns New object with all string values escaped
 */
function sanitizeRowData<T extends Record<string, unknown>>(row: T): T {
  // BẢO MẬT — Formula injection: nếu giá trị user nhập bắt đầu bằng = + - @ | ...
  // Excel sẽ coi cả ô là CÔNG THỨC khi mở file (vd `=HYPERLINK(...)`,
  // `=cmd|'/c calc'`). Thêm dấu nháy ' ở đầu → Excel hiển thị as-text, không
  // thực thi. Chỉ xử lý string; số/Date để nguyên. Trả object MỚI (không mutate).
  const result = {} as Record<string, unknown>;
  for (const key of Object.keys(row)) {
    const value = row[key];
    // /^[...]/ → ^ neo đầu chuỗi, [...] = nhóm ký tự đầu nguy hiểm: = + - @ |
    // \t (tab) \r (xuống dòng). \- phải escape để không bị hiểu là dải "từ-đến".
    // .test(value) trả true/false (khác .replace), true = ký tự đầu khớp nhóm này.
    if (typeof value === 'string' && /^[=+\-@|\t\r]/.test(value)) {
      result[key] = `'${value}`;
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Validates that the name in the Excel row matches the personnel record in DB.
 * @param excelName - Name from the Excel file
 * @param dbName - Name from the database
 * @returns Error message if mismatch, null if OK or no name provided
 */
function validatePersonnelNameMatch(excelName: string | null | undefined, dbName: string): string | null {
  // Cột tên trong file chỉ để ĐỐI CHIẾU, không phải nguồn ghi. Nếu admin để
  // trống thì bỏ qua (đã có ID là đủ định danh).
  if (!excelName || !excelName.trim()) return null;
  // So khớp "mềm": bỏ hoa/thường + gộp khoảng trắng thừa, tránh báo sai chỉ vì
  // gõ 2 dấu cách. Lệch thật → cảnh báo admin gõ nhầm ID của người khác.
  // .replace(/\s+/g, ' ') = gộp mọi cụm khoảng trắng về ĐÚNG 1 dấu cách (khác chỗ
  // header gộp về "_"): "Nguyễn  Văn   A" → "nguyễn văn a" trước khi đem so sánh.
  const normalizedExcel = excelName.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedDb = dbName.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalizedExcel !== normalizedDb) {
    return `Tên "${excelName.trim()}" không khớp với tên trong hệ thống "${dbName}". Vui lòng kiểm tra lại ID.`;
  }
  return null;
}

export { removeVietnameseAccents, parseHeaderMap, getHeaderCol, parseBooleanValue, resolvePersonnelInfo, buildPendingKeys, sanitizeRowData, validatePersonnelNameMatch };
