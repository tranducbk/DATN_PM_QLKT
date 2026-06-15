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

async function fetchCommemorationRows(personnelId: string): Promise<AwardHistoryRow[]> {
  const res = await apiClient.getCommemorationMedalsByPersonnel(personnelId);
  const payload = res.data as ReceivedAwardResponse | undefined;
  if (!res.success || !payload?.hasReceived || !payload.data) return [];
  return payload.data.map(medal => ({
    id: medal.id,
    nam: medal.nam,
    cap_bac: medal.cap_bac,
    chuc_vu: medal.chuc_vu,
    so_quyet_dinh: medal.so_quyet_dinh,
    ghi_chu: medal.ghi_chu,
    status: ELIGIBILITY_STATUS.DA_NHAN,
  }));
}

export default function ManagerCommemorationMedalsPage() {
  return (
    <AwardHistoryPage
      basePath="/manager"
      awardLabel={AWARD_TAB_LABELS.KNC_VSNXD_QDNDVN}
      fetchRows={fetchCommemorationRows}
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
