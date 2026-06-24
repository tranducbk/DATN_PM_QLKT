/**
 * Converts a stored "ward, district, province" address string into the
 * [province, district, ward] path array used by VietnamAddressCascader.
 * @param addressString - Stored address ("ward, district, province") or null
 * @returns Cascader path array, or undefined when absent/malformed
 */
export const parseAddressToArray = (addressString: string | null): string[] | undefined => {
  if (!addressString) return undefined;
  const slots = addressString
    .split(',')
    .map(part => part.trim())
    .map(part => (part === 'undefined' ? '' : part));
  // Stored bottom-up "ward, district, province" → province is the last slot. Build the
  // top-down path [province, district, ward], stopping at the first missing level since a
  // cascader path cannot skip a level (e.g. empty district → keep only the province).
  const path: string[] = [];
  for (const part of [...slots].reverse()) {
    if (!part) break;
    path.push(part);
  }
  return path.length > 0 ? path : undefined;
};

/**
 * Converts a [province, district, ward] cascader value into the stored
 * "ward, district, province" address string.
 * @param addressArray - Cascader path array
 * @returns Stored address string, or empty string when malformed
 */
export const formatAddressToString = (addressArray: string[]): string => {
  if (!addressArray || addressArray.length === 0) return '';
  // Cascader path [province, district, ward?] → stored "ward, district, province"
  return [...addressArray].reverse().filter(Boolean).join(', ');
};
