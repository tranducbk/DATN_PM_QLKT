import { Worksheet, CellValue } from 'exceljs';

function removeVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

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

function getHeaderCol(headerMap: Record<string, number>, variations: string[]): number | null {
  for (const v of variations) {
    if (headerMap[v]) return headerMap[v];
  }
  return null;
}

function parseBooleanValue(value: CellValue | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const strVal = String(value).trim().toLowerCase();
  return ['có', 'co', 'true', '1', 'x'].includes(strVal);
}

export { removeVietnameseAccents, parseHeaderMap, getHeaderCol, parseBooleanValue };
