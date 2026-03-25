/**
 * Kiểm tra trùng lặp khen thưởng — dùng chung cho proposal và award services.
 * Tách riêng để tránh circular dependency proposal ↔ award services.
 */
export { checkDuplicateAward, checkDuplicateUnitAward } from '../services/proposal/validation';
export type { DuplicateCheckResult } from '../services/proposal/validation';
