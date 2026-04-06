/**
 * Normalizes a CCCD value to 12 digits by left-padding zeros when needed.
 * @param value - Raw CCCD input
 * @returns Normalized CCCD string
 */
export function parseCCCD(value: string): string {
  const cccd = value.trim();
  if (/^\d+$/.test(cccd) && cccd.length < 12) {
    return cccd.padStart(12, '0');
  }
  return cccd;
}
