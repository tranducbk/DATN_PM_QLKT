'use client';

import { Doughnut } from 'react-chartjs-2';
import { Card } from 'antd';
import { useTheme } from '@/components/theme-provider';

interface RoleDistributionChartProps {
  data: Array<{ role: string; count: number }>;
  height?: number;
}

export function RoleDistributionChart({ data, height = 250 }: RoleDistributionChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';

  const roleMap: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    MANAGER: 'Quản lý',
    USER: 'Người dùng',
  };

  const chartData = {
    labels:
      data.length > 0
        ? data.map(item => roleMap[item.role] || item.role)
        : ['Chưa có dữ liệu'],
    datasets: [
      {
        label: 'Số lượng',
        data: data.length > 0 ? data.map(item => item.count) : [0],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
        ],
        borderColor: [
          'rgba(239, 68, 68, 1)',
          'rgba(249, 115, 22, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(34, 197, 94, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: textColor,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: 'Phân bố vai trò',
        color: textColor,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 10,
        },
      },
    },
  };

  return (
    <Card>
      <div style={{ height: `${height}px` }}>
        <Doughnut data={chartData} options={options} />
      </div>
    </Card>
  );
}

