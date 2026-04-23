import { Worksheet, CellValue } from 'exceljs';

/** Removes Vietnamese accents and returns ASCII text. */
function removeVietnameseAccents(str: string): string {
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
 * Finds a header column by trying multiple key variations.
 * @param headerMap - Header map from parseHeaderMap
 * @param variations - Candidate header keys (e.g. ['ho_ten', 'hoten'])
 * @returns 1-based column number, or null when not found
 */
function getHeaderCol(headerMap: Record<string, number>, variations: string[]): number | null {
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
  const hoTen = row.ho_ten || personnel.ho_ten;
  const capBac = row.cap_bac || personnel.cap_bac || null;
  const chucVu = row.chuc_vu || personnel.ChucVu?.ten_chuc_vu || null;

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
  const result = {} as Record<string, unknown>;
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (typeof value === 'string' && /^[=+\-@|\t\r]/.test(value)) {
      result[key] = `'${value}`;
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export { removeVietnameseAccents, parseHeaderMap, getHeaderCol, parseBooleanValue, resolvePersonnelInfo, buildPendingKeys, sanitizeRowData };
