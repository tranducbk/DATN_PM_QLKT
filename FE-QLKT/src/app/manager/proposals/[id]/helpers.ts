import {
  CONG_HIEN_HE_SO_GROUPS,
  CONG_HIEN_HE_SO_RANGES,
  type CongHienHeSoGroup,
} from '@/constants/danhHieu.constants';
import { PROPOSAL_TYPES, type ProposalType } from '@/constants/proposal.constants';
import type { DurationDisplay, PositionHistoryEntry } from './types';

export const CONG_HIEN_GROUP_COLUMNS: Array<{
  key: CongHienHeSoGroup;
  title: string;
  dataField: 'thoi_gian_nhom_0_7' | 'thoi_gian_nhom_0_8' | 'thoi_gian_nhom_0_9_1_0';
}> = [
  {
    key: CONG_HIEN_HE_SO_GROUPS.LEVEL_07,
    title: 'Tổng thời gian (0.7)',
    dataField: 'thoi_gian_nhom_0_7',
  },
  {
    key: CONG_HIEN_HE_SO_GROUPS.LEVEL_08,
    title: 'Tổng thời gian (0.8)',
    dataField: 'thoi_gian_nhom_0_8',
  },
  {
    key: CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10,
    title: 'Tổng thời gian (0.9-1.0)',
    dataField: 'thoi_gian_nhom_0_9_1_0',
  },
];

export const NIEN_HAN_STYLE_TYPES: ProposalType[] = [
  PROPOSAL_TYPES.NIEN_HAN,
  PROPOSAL_TYPES.HC_QKQT,
  PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
];

export const DANH_HIEU_FALLBACK_TYPES: ProposalType[] = [
  PROPOSAL_TYPES.NCKH,
  PROPOSAL_TYPES.NIEN_HAN,
  PROPOSAL_TYPES.HC_QKQT,
  PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
  PROPOSAL_TYPES.CONG_HIEN,
];

export const getDurationDisplay = (value: unknown): string | null => {
  if (!value) return null;

  if (typeof value === 'object' && value !== null) {
    const display = (value as DurationDisplay).display;
    return typeof display === 'string' && display.trim() ? display : null;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as DurationDisplay;
      const display = parsed?.display;
      return typeof display === 'string' && display.trim() ? display : null;
    } catch {
      return null;
    }
  }

  return null;
};

export const calculateTotalTimeByGroup = (
  histories: PositionHistoryEntry[],
  group: CongHienHeSoGroup
): string => {
  let totalMonths = 0;

  histories.forEach((history: PositionHistoryEntry) => {
    const heSo = Number(history.he_so_chuc_vu) || 0;
    const range = CONG_HIEN_HE_SO_RANGES[group];
    const belongsToGroup = range
      ? heSo >= range.min && (range.includeMax ? heSo <= range.max : heSo < range.max)
      : false;

    if (belongsToGroup && history.so_thang !== null && history.so_thang !== undefined) {
      totalMonths += history.so_thang;
    }
  });

  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  if (totalMonths === 0) return '-';
  if (years > 0 && remainingMonths > 0) {
    return `${years} năm ${remainingMonths} tháng`;
  } else if (years > 0) {
    return `${years} năm`;
  } else {
    return `${remainingMonths} tháng`;
  }
};
