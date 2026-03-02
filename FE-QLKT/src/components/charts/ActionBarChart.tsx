'use client';

import { Bar } from 'react-chartjs-2';
import { Card } from 'antd';
import { useTheme } from '@/components/theme-provider';

interface ActionBarChartProps {
  data: Array<{ action: string; count: number }>;
  title?: string;
  height?: number;
  maxLabelLength?: number;
  labelMapper?: (label: string) => string;
}

export function ActionBarChart({
  data,
  title = 'Top hành động phổ biến',
  height = 250,
  maxLabelLength = 20,
  labelMapper,
}: ActionBarChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const chartData = {
    labels:
      data.length > 0
        ? data
            .filter(item => item.action && item.action !== 'Chưa xác định')
            .map(item => {
              let action = item.action || '';
              if (labelMapper) {
                action = labelMapper(action);
              }
              if (action.length > maxLabelLength) {
                return action.substring(0, maxLabelLength) + '...';
              }
              return action;
            })
        : ['Chưa có dữ liệu'],
    datasets: [
      {
        label: 'Số lượng',
        data:
          data.length > 0
            ? data
                .filter(item => item.action && item.action !== 'Chưa xác định')
                .map(item => item.count)
            : [0],
        backgroundColor: 'rgba(147, 51, 234, 0.8)',
        borderColor: 'rgba(147, 51, 234, 1)',
        borderWidth: 2,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
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
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: textColor,
          stepSize: 1,
        },
        grid: {
          color: gridColor,
        },
      },
      x: {
        ticks: {
          color: textColor,
          maxRotation: 45,
        },
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <Card>
      <div style={{ height: `${height}px` }}>
        <Bar data={chartData} options={options} />
      </div>
    </Card>
  );
}
