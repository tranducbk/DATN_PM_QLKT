import * as notificationHelper from '../helpers/notification';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { accountRepository } from '../repositories/account.repository';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';

/**
 * Loads an account's linked personnel unit ids for unit-scope checks.
 * Shared by medal services' getUserWithUnit.
 * @param userId - Account id
 * @returns Account with nested QuanNhan unit ids, or null when not found
 */
export async function getAccountUnitScope(userId: string) {
  return accountRepository.findUniqueRaw({
    where: { id: userId },
    include: {
      QuanNhan: {
        select: {
          co_quan_don_vi_id: true,
          don_vi_truc_thuoc_id: true,
        },
      },
    },
  });
}

interface DeletableAward {
  danh_hieu?: string | null;
  loai?: string | null;
  nam?: number | string | null;
}

interface DeletablePersonnel {
  id: string;
  ho_ten?: string | null;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
}

interface FinalizeMedalDeletionParams<TAward extends DeletableAward> {
  id: string;
  award: TAward;
  personnel: DeletablePersonnel;
  personnelId: string;
  adminUsername: string;
  awardLabel: string;
  resourceSlug: string;
  proposalType: string;
  deleteFn: () => Promise<unknown>;
  recalcProfile?: (personnelId: string) => Promise<unknown>;
}

/**
 * Shared tail of every medal deleteAward: deletes the record, best-effort recalcs the
 * profile (when applicable), notifies on deletion, and returns the standard response.
 * The caller fetches + null-checks the award so its concrete type flows through TAward.
 * @param params - Award context + delete/recalc callbacks + display metadata
 * @returns Standard deletion result `{ message, personnelId, award }`
 */
export async function finalizeMedalAwardDeletion<TAward extends DeletableAward>(
  params: FinalizeMedalDeletionParams<TAward>
): Promise<{ message: string; personnelId: string; award: TAward }> {
  const {
    id,
    award,
    personnel,
    personnelId,
    adminUsername,
    awardLabel,
    resourceSlug,
    proposalType,
    deleteFn,
    recalcProfile,
  } = params;

  // Delete award only, proposals are kept for audit trail.
  await deleteFn();

  if (recalcProfile) {
    try {
      await recalcProfile(personnelId);
    } catch (recalcError) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: resourceSlug,
        resourceId: id,
        description: logMessages.recalcError('xóa', awardLabel, recalcError),
      });
    }
  }

  try {
    await notificationHelper.notifyOnAwardDeleted(award, personnel, proposalType, adminUsername);
  } catch (notifyError) {
    void writeSystemLog({
      action: AUDIT_ACTIONS.ERROR,
      resource: resourceSlug,
      resourceId: id,
      description: logMessages.notifyError('xóa', awardLabel, notifyError),
    });
  }

  return { message: `Xóa khen thưởng ${awardLabel} thành công`, personnelId, award };
}
