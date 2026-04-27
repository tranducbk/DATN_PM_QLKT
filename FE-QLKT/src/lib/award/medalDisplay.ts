import type { MedalData } from '@/lib/types/personnelList';

export const getReceivedMonthYearText = (medalData?: MedalData | null): string | undefined => {
  const firstRecord = medalData?.data?.[0];
  if (!firstRecord?.thang || !firstRecord?.nam) {
    return undefined;
  }

  return `Tháng ${firstRecord.thang}/${firstRecord.nam}`;
};
