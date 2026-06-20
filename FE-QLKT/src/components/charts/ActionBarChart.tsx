'use client';

import '@/lib/chartConfig';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions, TooltipItem } from 'chart.js';
import { Card } from 'antd';
import { useChartTheme, chartTitlePlugin } from './useChartTheme';
import { getHorizontalBarHeight } from './barChartHeight';

interface ActionBarChartProps {
  data: Array<{ action: string; count: number }>;
  title?: string;
  height?: number;
  maxLabelLength?: number;
  labelMapper?: (label: string) => string;
  color?: string;
  /** Horizontal bars — labels on the left so long category names stay readable. */
  horizontal?: boolean;
}

export function ActionBarChart({
  data,
  title = 'Top hành động phổ biến',
  height = 250,
  maxLabelLength = 20,
  labelMapper,
  color = 'rgba(147, 51, 234, 1)',
  horizontal = false,
}: ActionBarChartProps) {
  const { textColor, gridColor } = useChartTheme();

  const filteredData = data.filter(item => item.action && item.action !== 'Chưa xác định');

  // Full labels for the tooltip. The horizontal layout shows them in full (left axis has
  // room); the vertical layout truncates so rotated labels still fit under the bars.
  const fullLabels =
    filteredData.length > 0
      ? filteredData.map(item => (labelMapper ? labelMapper(item.action) : item.action))
      : ['Chưa có dữ liệu'];

  const chartData = {
    labels: horizontal
      ? fullLabels
      : fullLabels.map(label =>
          label.length > maxLabelLength ? label.substring(0, maxLabelLength) + '…' : label
        ),
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

  const valueAxis = {
    beginAtZero: true,
    ticks: { color: textColor, stepSize: 1, precision: 0 },
    grid: { color: gridColor },
  };
  const categoryAxis = {
    ticks: {
      color: textColor,
      autoSkip: false,
      ...(horizontal ? {} : { maxRotation: 45 }),
    },
    grid: { display: false },
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: chartTitlePlugin(title, textColor),
      tooltip: {
        callbacks: {
          // Show the full (untruncated) label on hover.
          title: (items: TooltipItem<'bar'>[]) => fullLabels[items[0]?.dataIndex] ?? '',
        },
      },
    },
    scales: horizontal ? { x: valueAxis, y: categoryAxis } : { y: valueAxis, x: categoryAxis },
  };

  // Horizontal bars need vertical room per category so they don't get cramped.
  const resolvedHeight = horizontal ? getHorizontalBarHeight(filteredData.length, height) : height;

  return (
    <Card className="h-full">
      <div style={{ height: `${resolvedHeight}px` }}>
        <Bar data={chartData} options={options} />
      </div>
    </Card>
  );
}
