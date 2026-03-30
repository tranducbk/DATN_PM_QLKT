import { Worksheet, CellValue } from 'exceljs';

/** Bỏ dấu tiếng Việt để normalize header thành key ASCII. */
function removeVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Parse header row (row 1) thành map: normalized key -> column number (1-based).
 * @param worksheet - Worksheet cần parse
 * @returns Map từ header key đến số cột
 */
function parseHeaderMap(worksheet: Worksheet): Record<string, number> {
  const headerRow = worksheet.getRow(1);
  const headerMap: Record<string, number> = {};

  headerRow.eachCell((cell, colNumber) => {
    const rawValue = String(cell.value ?? '')
      .trim()
      .toLowerCase();
    const key = removeVietnameseAccents(rawValue)
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    if (key) headerMap[key] = colNumber;
  });

  return headerMap;
}

/**
 * Tìm column number cho header theo danh sách tên biến thể.
 * @param headerMap - Map từ parseHeaderMap
 * @param variations - Các tên header có thể (e.g. ['ho_ten', 'hoten'])
 * @returns Column number (1-based), hoặc null nếu không tìm thấy
 */
function getHeaderCol(headerMap: Record<string, number>, variations: string[]): number | null {
  for (const v of variations) {
    if (headerMap[v]) return headerMap[v];
  }
  return null;
}

/**
 * Parse giá trị ô Excel thành boolean ('có', 'true', '1', 'x' -> true).
 * @param value - Giá trị từ ô Excel
 * @returns true nếu giá trị biểu thị "có/đúng"
 */
function parseBooleanValue(value: CellValue | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const strVal = String(value).trim().toLowerCase();
  return ['có', 'co', 'true', '1', 'x'].includes(strVal);
}

/**
 * Resolve thông tin quân nhân từ file Excel và DB, kiểm tra thiếu thông tin.
 * @param row - Dữ liệu từ dòng Excel (ho_ten, cap_bac, chuc_vu)
 * @param personnel - Dữ liệu quân nhân từ DB
 * @returns Object chứa resolved values và danh sách field thiếu
 */
function resolvePersonnelInfo(
  row: { ho_ten?: string | null; cap_bac?: string | null; chuc_vu?: string | null },
  personnel: { ho_ten: string; cap_bac?: string | null; ChucVu?: { ten_chuc_vu: string } | null }
): { hoTen: string | null; capBac: string | null; chucVu: string | null; missingFields: string[] } {
  const hoTen = row.ho_ten || personnel.ho_ten;
  const capBac = row.cap_bac || personnel.cap_bac || null;
  const chucVu = row.chuc_vu || personnel.ChucVu?.ten_chuc_vu || null;

  const missingFields: string[] = [];
  if (!hoTen) missingFields.push('Họ tên');
  if (!capBac) missingFields.push('Cấp bậc');
  if (!chucVu) missingFields.push('Chức vụ');

  return { hoTen, capBac, chucVu, missingFields };
}

export { removeVietnameseAccents, parseHeaderMap, getHeaderCol, parseBooleanValue, resolvePersonnelInfo };
