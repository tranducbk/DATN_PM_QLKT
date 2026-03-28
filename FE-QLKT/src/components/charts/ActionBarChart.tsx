'use client';

import { Bar } from 'react-chartjs-2';
import { Card } from 'antd';
import { useChartTheme, chartTitlePlugin } from './useChartTheme';

interface ActionBarChartProps {
  data: Array<{ action: string; count: number }>;
  title?: string;
  height?: number;
  maxLabelLength?: number;
  labelMapper?: (label: string) => string;
  color?: string;
}

export function ActionBarChart({
  data,
  title = 'Top hành động phổ biến',
  height = 250,
  maxLabelLength = 20,
  labelMapper,
  color = 'rgba(147, 51, 234, 1)',
}: ActionBarChartProps) {
  const { textColor, gridColor } = useChartTheme();

  const filteredData = data.filter(item => item.action && item.action !== 'Chưa xác định');

  const chartData = {
    labels:
      filteredData.length > 0
        ? filteredData.map(item => {
            let action = labelMapper ? labelMapper(item.action) : item.action;
            if (action.length > maxLabelLength) {
              return action.substring(0, maxLabelLength) + '...';
            }
            return action;
          })
        : ['Chưa có dữ liệu'],
    datasets: [
      {
        label: 'Số lượng',
        data: filteredData.length > 0 ? filteredData.map(item => item.count) : [0],
        backgroundColor: color.replace('1)', '0.8)'),
        borderColor: color,
        borderWidth: 2,
        borderRadius: 4,
        maxBarThickness: 60,
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
