import { apiClient } from '@/lib/http/apiClient';
import type {
  AwardFilters,
  AwardTypeFetchParams,
  AwardTypeApiResult,
  AwardTypeDeleteResult,
} from './types';

export const INITIAL_FILTERS: AwardFilters = {
  nam: '',
  ho_ten: '',
  danh_hieu: '',
  de_tai: '',
};

export const AWARD_TYPE_CONFIG: Record<
  string,
  {
    fetch: (params: AwardTypeFetchParams) => Promise<AwardTypeApiResult>;
    delete: (id: string, awardType?: string) => Promise<AwardTypeDeleteResult>;
  }
> = {
  CNHN: { fetch: apiClient.getAnnualRewards, delete: apiClient.deleteAnnualReward },
  DVHN: { fetch: apiClient.getUnitAnnualAwards, delete: apiClient.deleteUnitAnnualAward },
  HCCSVV: { fetch: apiClient.getTenureMedals, delete: apiClient.deleteTenureMedal },
  HCBVTQ: { fetch: apiClient.getContributionMedals, delete: apiClient.deleteContributionMedal },
  KNC_VSNXD_QDNDVN: {
    fetch: apiClient.getCommemorationMedals,
    delete: apiClient.deleteCommemorationMedal,
  },
  HCQKQT: { fetch: apiClient.getMilitaryFlag, delete: apiClient.deleteMilitaryFlag },
  NCKH: {
    fetch: apiClient.getScientificAchievements,
    delete: apiClient.deleteScientificAchievement,
  },
};
