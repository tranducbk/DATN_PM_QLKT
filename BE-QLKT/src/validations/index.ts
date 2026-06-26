/*
 * ════════════════════════════════════════════════════════════════════════════
 *  VALIDATIONS BARREL — schema validation cho request body
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  USAGE:
 *      router.post('/', validate(authValidation.login), authController.login);
 *
 *  MIDDLEWARE validate(schema):
 *  1. Parse req.body qua schema.
 *  2. Fail → throw ValidationError → errorHandler trả 400.
 *  3. Success → strip unknown fields → req.body chỉ còn field định nghĩa.
 *
 *  stripUnknown=true GIÁ TRỊ ATTT:
 *  - User gửi extra field (vd: {role: 'SUPER_ADMIN'}) → bị strip.
 *  - Chống mass assignment vulnerability.
 *
 *  BE-FE PARITY:
 *  Zod schema FE (lib/schemas.ts) PHẢI sync với BE. FE chỉ là UX,
 *  BE mới là truth source.
 * ════════════════════════════════════════════════════════════════════════════
 */

export * as authValidation from './auth.validation';
export * as accountValidation from './account.validation';
export * as personnelValidation from './personnel.validation';
export * as annualRewardValidation from './annualReward.validation';
export * as unitAnnualAwardValidation from './unitAnnualAward.validation';
export * as unitValidation from './unit.validation';
export * as positionValidation from './position.validation';
export * as scientificAchievementValidation from './scientificAchievement.validation';
export * as excelImportValidation from './excelImport.validation';
export * as awardBulkValidation from './awardBulk.validation';
