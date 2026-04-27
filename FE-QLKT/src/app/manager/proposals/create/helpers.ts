import { PROPOSAL_TYPES, type ProposalType } from '@/constants/proposal.constants';
import type { TitleDataItem } from '@/lib/types/proposal';

export const getProposalReferenceEndDate = (nam: number, thang: number): Date => {
  if (Number.isInteger(thang) && thang >= 1 && thang <= 12) {
    return new Date(nam, thang, 0);
  }
  return new Date(nam, 11, 31);
};

export const canProceedToNextStep = (
  currentStep: number,
  proposalType: ProposalType,
  selectedPersonnelIds: string[],
  selectedUnitIds: string[],
  titleData: TitleDataItem[]
): boolean => {
  switch (currentStep) {
    case 0:
      return true;
    case 1:
      if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        return selectedUnitIds.length > 0;
      }
      return selectedPersonnelIds.length > 0;
    case 2: {
      const expectedLength =
        proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM
          ? selectedUnitIds.length
          : selectedPersonnelIds.length;
      if (titleData.length !== expectedLength) return false;

      if (proposalType === PROPOSAL_TYPES.NCKH) {
        return titleData.every(d => d.loai && d.mo_ta && d.cap_bac && d.chuc_vu);
      }

      if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        return titleData.every(d => d.danh_hieu);
      }

      return titleData.every(d => d.danh_hieu && d.cap_bac?.trim() && d.chuc_vu?.trim());
    }
    case 3:
      return true;
    default:
      return false;
  }
};
