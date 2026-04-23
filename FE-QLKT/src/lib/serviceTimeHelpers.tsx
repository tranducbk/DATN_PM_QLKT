import { Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DateInput } from '@/lib/types';
import type { ContributionProfile } from '@/lib/types/personnelList';
import { apiClient } from '@/lib/apiClient';

const { Text } = Typography;

type ServiceTimeSummary = {
  years: number;
  months: number;
  totalMonths: number;
};

type ServiceTimeRow = {
  id: string;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
};

type ContributionMonthField = 'months_07' | 'months_08' | 'months_0910';

export function calcServiceTime(
  ngayNhapNgu: DateInput,
  ngayXuatNgu: DateInput,
  refNam: number,
  refThang: number
): ServiceTimeSummary | null {
  if (!ngayNhapNgu) return null;
  try {
    const startDate = typeof ngayNhapNgu === 'string' ? new Date(ngayNhapNgu) : ngayNhapNgu;
    const endDate = ngayXuatNgu
      ? typeof ngayXuatNgu === 'string' ? new Date(ngayXuatNgu) : ngayXuatNgu
      : new Date(refNam, refThang, 0);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
    const total = Math.max(0, (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth());
    return { years: Math.floor(total / 12), months: total % 12, totalMonths: total };
  } catch { return null; }
}

export function formatMonths(totalMonths: number): string {
  if (!totalMonths || totalMonths <= 0) return '-';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years} năm ${months} tháng`;
  if (years > 0) return `${years} năm`;
  return `${months} tháng`;
}

export function renderServiceTime(record: ServiceTimeRow, refNam: number, refThang: number) {
  const result = calcServiceTime(record.ngay_nhap_ngu, record.ngay_xuat_ngu, refNam, refThang);
  if (!result) return <Text type="secondary">-</Text>;
  if (result.years > 0 && result.months > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Text strong>{result.years} năm</Text>
        <Text type="secondary" style={{ fontSize: '12px', lineHeight: '1.2' }}>{result.months} tháng</Text>
      </div>
    );
  }
  if (result.years > 0) return <Text strong>{result.years} năm</Text>;
  if (result.totalMonths > 0) return <Text strong>{result.totalMonths} tháng</Text>;
  return <Text type="secondary">0 tháng</Text>;
}

export function calculateServiceMonthsWithToday(
  ngayNhapNgu: DateInput,
  ngayXuatNgu: DateInput
): number {
  if (!ngayNhapNgu) return 0;
  const now = new Date();
  const refNam = now.getFullYear();
  const refThang = now.getMonth() + 1;
  return calcServiceTime(ngayNhapNgu, ngayXuatNgu, refNam, refThang)?.totalMonths ?? 0;
}

export function makeContributionColumns(
  profiles: Record<string, ContributionProfile>
): ColumnsType<ServiceTimeRow> {
  const renderGroup = (id: string, field: ContributionMonthField) =>
    formatMonths(profiles[id]?.[field] || 0);
  return [
    {
      title: 'Thời gian (0.7)',
      key: 'time_07',
      width: 130,
      align: 'center' as const,
      render: (_, record) => renderGroup(record.id, 'months_07'),
    },
    {
      title: 'Thời gian (0.8)',
      key: 'time_08',
      width: 130,
      align: 'center' as const,
      render: (_, record) => renderGroup(record.id, 'months_08'),
    },
    {
      title: 'Thời gian (0.9-1.0)',
      key: 'time_0910',
      width: 140,
      align: 'center' as const,
      render: (_, record) => renderGroup(record.id, 'months_0910'),
    },
  ];
}

export async function fetchContributionProfiles(personnelIds: string[]): Promise<Record<string, ContributionProfile>> {
  const profiles: Record<string, ContributionProfile> = {};
  await Promise.all(
    personnelIds.map(async id => {
      try {
        const res = await apiClient.getContributionProfile(id);
        if (res.success && res.data) profiles[id] = res.data;
      } catch {
      }
    })
  );
  return profiles;
}
