'use client';

import { apiClient } from '@/lib/http/apiClient';
import { AWARD_TAB_LABELS } from '@/constants/danhHieu.constants';
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';
import {
  AwardHistoryPage,
  type AwardHistoryRow,
  type ReceivedAwardResponse,
  timeColumn,
  capBacColumn,
  chucVuColumn,
  decisionColumn,
  ghiChuColumn,
  statusColumn,
} from '@/components/personnel/AwardHistoryPage';

async function fetchMilitaryFlagRows(personnelId: string): Promise<AwardHistoryRow[]> {
  const res = await apiClient.getMilitaryFlagByPersonnel(personnelId);
  const payload = res.data as ReceivedAwardResponse | undefined;
  if (!res.success || !payload?.hasReceived || !payload.data) return [];
  return payload.data.map(item => ({
    id: item.id,
    nam: item.nam,
    cap_bac: item.cap_bac,
    chuc_vu: item.chuc_vu,
    so_quyet_dinh: item.so_quyet_dinh,
    ghi_chu: item.ghi_chu,
    status: ELIGIBILITY_STATUS.DA_NHAN,
  }));
}

export default function AdminMilitaryFlagPage() {
  return (
    <AwardHistoryPage
      basePath="/admin"
      awardLabel={AWARD_TAB_LABELS.HCQKQT}
      fetchRows={fetchMilitaryFlagRows}
      buildColumns={helpers => [
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
