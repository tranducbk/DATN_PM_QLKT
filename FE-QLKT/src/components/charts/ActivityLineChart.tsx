'use client';

import { Line } from 'react-chartjs-2';
import { Card } from 'antd';
import { useTheme } from '@/components/theme-provider';

interface ActivityLineChartProps {
  data: Array<{ date: string; count: number }>;
  title?: string;
  label?: string;
  height?: number;
  color?: string;
}

export function ActivityLineChart({
  data,
  title = 'Hoạt động hệ thống',
  label = 'Số lượng hoạt động',
  height = 250,
  color = 'rgba(59, 130, 246, 1)',
}: ActivityLineChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const chartData = {
    labels:
      data.length > 0
        ? data.map(item => {
            // Handle both date format (YYYY-MM-DD) and month format (YYYY-MM)
            if (item.date.includes('-') && item.date.split('-').length === 3) {
              const date = new Date(item.date);
              return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            } else if (item.date.includes('-') && item.date.split('-').length === 2) {
              // Month format: YYYY-MM
              const [year, month] = item.date.split('-');
              return `${month}/${year}`;
            }
            return item.date;
          })
        : [],
    datasets: [
      {
        label: label,
        data: data.length > 0 ? data.map(item => item.count) : [],
        borderColor: color,
        backgroundColor: color.replace('1)', '0.1)'),
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: textColor,
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
        },
        grid: {
          color: gridColor,
        },
      },
    },
  };

  return (
    <Card>
      <div style={{ height: `${height}px` }}>
        <Line data={chartData} options={options} />
      </div>
    </Card>
  );
}

