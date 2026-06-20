'use client';

import '@/lib/chartConfig';
import { useRef, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import type { ChartOptions, Chart as ChartJS } from 'chart.js';
import { Card } from 'antd';
import { useChartTheme, chartTitlePlugin } from './useChartTheme';

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
  const { textColor } = useChartTheme();
  const chartRef = useRef<ChartJS<'pie'>>(null);
  const [hidden, setHidden] = useState<Record<number, boolean>>({});

  const filteredData = data.filter(item => item.value > 0);
  const hasData = filteredData.length > 0;

  // Cycle colors so >colors.length categories still get a slice color, and keep the
  // HTML legend below in sync with the pie slices.
  const sliceColors = (hasData ? filteredData : [{ label: '', value: 0 }]).map(
    (_, i) => colors[i % colors.length]
  );

  // Toggle a slice's visibility (restores the click-to-hide behaviour of the native
  // Chart.js legend, which we replaced with an HTML legend to avoid clipping).
  const toggleSlice = (index: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.toggleDataVisibility(index);
    chart.update();
    setHidden(prev => ({ ...prev, [index]: !chart.getDataVisibility(index) }));
  };

  const chartData = {
    labels: hasData ? filteredData.map(item => item.label) : ['Chưa có dữ liệu'],
    datasets: [
      {
        label: 'Số lượng',
        data: hasData ? filteredData.map(item => item.value) : [0],
        backgroundColor: sliceColors,
        borderColor: sliceColors.map(c => c.replace('0.8', '1')),
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
    plugins: {
      // Legend is rendered as HTML below so it never gets clipped by the fixed-height
      // canvas (Chart.js does not wrap/scroll a tall bottom legend).
      legend: { display: false },
      title: chartTitlePlugin(title, textColor),
      tooltip: { enabled: true },
    },
  };

  return (
    <Card className="h-full">
      <div style={{ height: `${height}px` }}>
        <Pie ref={chartRef} data={chartData} options={options} />
      </div>
      {hasData && (
        <ul className="mt-3 flex list-none flex-col gap-1 p-0">
          {filteredData.map((item, i) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={() => toggleSlice(i)}
                className="flex w-full items-center gap-2 text-left text-xs"
                aria-pressed={hidden[i] ? 'true' : 'false'}
              >
                <span
                  className="inline-block h-3.5 w-3.5 flex-shrink-0 rounded-sm"
                  style={{
                    backgroundColor: hidden[i] ? 'transparent' : sliceColors[i],
                    boxShadow: hidden[i] ? `inset 0 0 0 2px ${sliceColors[i]}` : 'none',
                  }}
                />
                <span
                  style={{
                    color: textColor,
                    textDecoration: hidden[i] ? 'line-through' : 'none',
                    opacity: hidden[i] ? 0.5 : 1,
                  }}
                >
                  {item.label}: {item.value}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
