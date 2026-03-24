'use client';

import { Pie } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { Card } from 'antd';
import { useTheme } from '@/components/theme-provider';

interface PieChartProps {
  data: Array<{ label: string; value: number }>;
  title?: string;
  height?: number;
  colors?: string[];
}

export function PieChart({
  data,
  title = 'Phân bố dữ liệu',
  height = 250,
  colors = [
    'rgba(239, 68, 68, 0.8)',
    'rgba(249, 115, 22, 0.8)',
    'rgba(59, 130, 246, 0.8)',
    'rgba(34, 197, 94, 0.8)',
    'rgba(147, 51, 234, 0.8)',
    'rgba(236, 72, 153, 0.8)',
  ],
}: PieChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';

  const chartData = {
    labels:
      data.length > 0
        ? data.filter(item => item.value > 0).map(item => item.label)
        : ['Chưa có dữ liệu'],
    datasets: [
      {
        label: 'Số lượng',
        data: data.length > 0 ? data.filter(item => item.value > 0).map(item => item.value) : [0],
        backgroundColor: colors.slice(0, data.length),
        borderColor: colors.slice(0, data.length).map(c => c.replace('0.8', '1')),
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1500,
      easing: 'easeOutQuart' as const,
    },
    transitions: {
      show: {
        animation: {
          duration: 500,
        },
      },
      hide: {
        animation: {
          duration: 500,
        },
      },
    },
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
        text: title,
        color: textColor,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 10,
        },
      },
      tooltip: {
        enabled: true,
      },
    },
  };

  return (
    <Card>
      <div style={{ height: `${height}px` }}>
        <Pie data={chartData} options={options} />
      </div>
    </Card>
  );
}
