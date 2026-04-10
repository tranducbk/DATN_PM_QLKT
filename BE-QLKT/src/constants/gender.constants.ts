export const GENDER = {
  MALE: 'NAM',
  FEMALE: 'NU',
} as const;

export type Gender = (typeof GENDER)[keyof typeof GENDER];
