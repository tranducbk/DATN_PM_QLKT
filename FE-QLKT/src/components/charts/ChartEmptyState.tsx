'use client';

import { Empty } from 'antd';

interface ChartEmptyStateProps {
  title: string;
  height: number;
  textColor: string;
}

/** Shared "no data" placeholder for chart cards — mirrors chart.js's title styling so
 * the empty state doesn't visually jump when data later arrives. */
export function ChartEmptyState({ title, height, textColor }: ChartEmptyStateProps) {
  return (
    <div style={{ height: `${height}px`, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          color: textColor,
          fontSize: 16,
          fontWeight: 'bold',
          textAlign: 'center',
          paddingBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="Chưa có dữ liệu" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    </div>
  );
}
