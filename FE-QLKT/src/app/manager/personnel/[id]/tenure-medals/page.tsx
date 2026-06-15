'use client';

import { apiClient } from '@/lib/http/apiClient';
import { FETCH_ALL_LIMIT } from '@/constants/pagination.constants';
import { AWARD_TAB_LABELS, getRankLabel } from '@/constants/danhHieu.constants';
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';
import {
  AwardHistoryPage,
  type AwardHistoryRow,
  type RawAwardRecord,
  nameColumn,
  timeColumn,
  capBacColumn,
  chucVuColumn,
  decisionColumn,
  ghiChuColumn,
  statusColumn,
} from '@/components/personnel/AwardHistoryPage';

async function fetchTenureRows(personnelId: string): Promise<AwardHistoryRow[]> {
  const res = await apiClient.getTenureMedals({ limit: FETCH_ALL_LIMIT });
  if (!res.success || !res.data) return [];
  return (res.data as RawAwardRecord[])
    .filter(award => award.quan_nhan_id === personnelId || award.QuanNhan?.id === personnelId)
    .map(award => ({
      id: award.id,
      name: AWARD_TAB_LABELS.HCCSVV,
      nam: award.nam,
      cap_bac: award.cap_bac,
      chuc_vu: award.chuc_vu,
      so_quyet_dinh: award.so_quyet_dinh,
      ghi_chu: award.ghi_chu,
      rank: getRankLabel(award.danh_hieu || ''),
      status: ELIGIBILITY_STATUS.DA_NHAN,
    }));
}

export default function ManagerTenureMedalsPage() {
  return (
    <AwardHistoryPage
      basePath="/manager"
      awardLabel={AWARD_TAB_LABELS.HCCSVV}
      fetchRows={fetchTenureRows}
      buildColumns={helpers => [
        nameColumn,
        timeColumn('Tháng/Năm'),
        capBacColumn,
        chucVuColumn,
        decisionColumn(helpers.openDecisionFile),
        ghiChuColumn,
        statusColumn(helpers.renderStatusTag),
      ]}
    />
  );
}
