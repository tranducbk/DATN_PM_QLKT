/** Parse CCCD — pad 0 nếu thiếu đủ 12 ký tự */
export function parseCCCD(value: string): string {
  const cccd = value.trim();
  if (/^\d+$/.test(cccd) && cccd.length < 12) {
    return cccd.padStart(12, '0');
  }
  return cccd;
}
