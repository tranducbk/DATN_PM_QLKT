import type { RecalculateResult } from './types';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { writeSystemLog } from '../../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../../constants/auditActions.constants';
import { RESOURCE_SLUGS } from '../../constants/resourceSlugs.constants';
import { logMessages } from '../../constants/logMessages.constants';
import { NotFoundError } from '../../middlewares/errorHandler';
import { recalculateAnnualProfile } from './annual';
import { recalculateTenureProfile } from './tenure';
import { recalculateContributionProfile } from './contribution';

/**
 * Recalculates all three profile types (annual, tenure, contribution) for one personnel.
 * @param personnelId - Personnel ID
 * @returns The personnel's name for the caller's success message
 * @throws NotFoundError - When the personnel does not exist
 */
export async function recalculateFullProfile(
  personnelId: string
): Promise<{ ho_ten: string | null }> {
  const personnel = await quanNhanRepository.findUniqueRaw({
    where: { id: personnelId },
    select: { id: true, ho_ten: true },
  });

  if (!personnel) {
    throw new NotFoundError('Quân nhân');
  }

  await Promise.all([
    recalculateAnnualProfile(personnelId),
    recalculateTenureProfile(personnelId),
    recalculateContributionProfile(personnelId),
  ]);

  return { ho_ten: personnel.ho_ten };
}

/**
 * Batch job: recalculates all three profile types for every personnel (best-effort per row).
 * @returns Aggregate counts and per-personnel error list
 */
export async function recalculateAllFullProfiles(): Promise<RecalculateResult> {
  const allPersonnel = await quanNhanRepository.findManyRaw({
    select: { id: true, ho_ten: true },
  });

  let successCount = 0;
  const errors: Array<{ personnelId: string; hoTen: string; error: string }> = [];

  for (const personnel of allPersonnel) {
    try {
      await Promise.all([
        recalculateAnnualProfile(personnel.id),
        recalculateTenureProfile(personnel.id),
        recalculateContributionProfile(personnel.id),
      ]);
      successCount++;
    } catch (error) {
      errors.push({
        personnelId: personnel.id,
        hoTen: personnel.ho_ten,
        error: error.message,
      });
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: RESOURCE_SLUGS.PROFILES,
        resourceId: personnel.id,
        description: logMessages.recalcPersonnelError(
          `${personnel.ho_ten} (${personnel.id})`,
          error.message
        ),
      });
    }
  }

  return {
    message: `Tính toán hoàn tất. Thành công: ${successCount}, Lỗi: ${errors.length}`,
    success: successCount,
    errors,
  };
}
