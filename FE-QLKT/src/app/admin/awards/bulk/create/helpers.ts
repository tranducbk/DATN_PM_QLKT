import { PROPOSAL_TYPES } from '@/constants/proposal.constants';
import type { TitleDataItem, DecisionDataMap } from '@/lib/types/proposal';
import type { AwardType } from './types';

interface CanProceedArgs {
  currentStep: number;
  awardType: AwardType;
  selectedPersonnelIds: string[];
  selectedUnitIds: string[];
  titleData: TitleDataItem[];
  decisionDataMap: DecisionDataMap;
}

export function canProceedToNextStep({
  currentStep,
  awardType,
  selectedPersonnelIds,
  selectedUnitIds,
  titleData,
  decisionDataMap,
}: CanProceedArgs): boolean {
  switch (currentStep) {
    case 0:
      return true;
    case 1:
      if (awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        return selectedUnitIds.length > 0;
      }
      return selectedPersonnelIds.length > 0;
    case 2: {
      const expectedLength =
        awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM
          ? selectedUnitIds.length
          : selectedPersonnelIds.length;
      if (titleData.length !== expectedLength) return false;

      if (awardType === PROPOSAL_TYPES.NCKH) {
        return titleData.every(d => d.loai && d.mo_ta && d.cap_bac && d.chuc_vu);
      }

      if (awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        return titleData.every(d => d.danh_hieu);
      }

      return titleData.every(d => d.danh_hieu && d.cap_bac?.trim() && d.chuc_vu?.trim());
    }
    case 3:
      return true;
    case 4: {
      const ids =
        awardType === PROPOSAL_TYPES.DON_VI_HANG_NAM ? selectedUnitIds : selectedPersonnelIds;
      return ids.every(id => decisionDataMap[id]?.so_quyet_dinh?.trim());
    }
    default:
      return false;
  }
}

export function buildTitleDataWithDecisions(
  titleData: TitleDataItem[],
  decisionDataMap: DecisionDataMap
): Array<TitleDataItem & { so_quyet_dinh: string | null }> {
  return titleData.map(item => {
    const personnelId = item.personnel_id || item.don_vi_id;
    const decisionInfo = personnelId ? decisionDataMap[personnelId] : undefined;
    return {
      ...item,
      so_quyet_dinh: decisionInfo?.so_quyet_dinh || null,
    };
  });
}

export function hasMissingDecision(
  ids: string[],
  decisionDataMap: DecisionDataMap
): boolean {
  return ids.some(id => !decisionDataMap[id]?.so_quyet_dinh?.trim());
}
