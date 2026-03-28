'use client';

import { Doughnut } from 'react-chartjs-2';
import { Card } from 'antd';
import { useChartTheme, chartTitlePlugin } from './useChartTheme';
import { ROLE_LABELS } from '@/constants/roles.constants';

interface RoleDistributionChartProps {
  data: Array<{ role: string; count: number }>;
  height?: number;
}

export function RoleDistributionChart({ data, height = 250 }: RoleDistributionChartProps) {
  const { textColor } = useChartTheme();

  const chartData = {
    labels:
      data.length > 0
        ? data.map(item => ROLE_LABELS[item.role] || item.role)
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
      title: chartTitlePlugin('Phân bố vai trò', textColor),
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
