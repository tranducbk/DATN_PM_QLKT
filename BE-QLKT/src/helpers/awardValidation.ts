/**
 * Re-exports shared duplicate checks for proposal and award services.
 * Separated to avoid circular dependencies between proposal and award services.
 */
export { checkDuplicateAward, checkDuplicateUnitAward } from '../services/proposal/validation';
export type { DuplicateCheckResult } from '../services/proposal/validation';
