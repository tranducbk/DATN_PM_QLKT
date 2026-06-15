export const GENDER = {
  MALE: 'NAM',
  FEMALE: 'NU',
} as const;

/**
 * True when gioi_tinh is missing or not a recognized GENDER value.
 * @param value - Raw gioi_tinh value
 * @returns Whether the value is absent or invalid
 */
export function isMissingGender(value: string | null | undefined): boolean {
  return value !== GENDER.MALE && value !== GENDER.FEMALE;
}
