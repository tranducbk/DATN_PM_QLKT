'use client';

import '@/lib/chartConfig';
import { Line } from 'react-chartjs-2';
import { Card } from 'antd';
import { useChartTheme, chartTitlePlugin } from './useChartTheme';

interface ActivityLineChartProps {
  data: Array<{ date: string; count: number }>;
  title?: string;
  label?: string;
  height?: number;
  color?: string;
}

function formatChartLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    // YYYY-MM-DD → DD/MM
    return `${parts[2]}/${parts[1]}`;
  }
  if (parts.length === 2) {
    // YYYY-MM → MM/YYYY
    return `${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function ActivityLineChart({
  data,
  title = 'Hoạt động hệ thống',
  label = 'Số lượng hoạt động',
  height = 250,
  color = 'rgba(59, 130, 246, 1)',
}: ActivityLineChartProps) {
  const { textColor, gridColor } = useChartTheme();

  const chartData = {
    labels: data.length > 0 ? data.map(item => formatChartLabel(item.date)) : ['Chưa có dữ liệu'],
    datasets: [
      {
        label: label,
        data: data.length > 0 ? data.map(item => item.count) : [0],
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
      title: chartTitlePlugin(title, textColor),
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
