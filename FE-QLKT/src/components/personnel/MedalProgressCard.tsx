'use client';

import type { ReactNode } from 'react';
import { Card, Progress, Tag, Typography } from 'antd';

const { Text } = Typography;

interface MedalProgressCardProps {
  title: string;
  isDark: boolean;
  hasReceived: boolean;
  receivedAt?: string;
  yearsOfService: number;
  yearsRequired: number;
  receivedStatusTag: ReactNode;
}

export function MedalProgressCard({
  title,
  isDark,
  hasReceived,
  receivedAt,
  yearsOfService,
  yearsRequired,
  receivedStatusTag,
}: MedalProgressCardProps) {
  if (hasReceived) {
    return (
      <Card
        size="small"
        className="h-full"
        style={{
          borderRadius: 10,
          borderColor: isDark ? '#1f2937' : '#f3f4f6',
          background: isDark ? '#0f172a' : '#fafafa',
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <Text strong style={{ fontSize: 15 }}>
            {title}
          </Text>
          {receivedStatusTag}
        </div>
        <Text type="secondary" className="text-xs block">
          {receivedAt || 'Chưa cập nhật thời gian nhận'}
        </Text>
      </Card>
    );
  }

  const percent = Math.min(100, Math.round((yearsOfService / yearsRequired) * 100));
  const isEligible = yearsOfService >= yearsRequired;

  return (
    <Card
      size="small"
      className="h-full"
      style={{
        borderRadius: 10,
        borderColor: isDark ? '#1f2937' : '#f3f4f6',
        background: isDark ? '#0f172a' : '#fafafa',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <Text strong style={{ fontSize: 15 }}>
          {title}
        </Text>
        {isEligible ? <Tag color="orange">Đủ điều kiện</Tag> : <Tag color="default">Chưa đủ</Tag>}
      </div>
      <Text className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
        {yearsOfService}/{yearsRequired} năm
      </Text>
      <div className="mt-2">
        <Progress
          percent={percent}
          size="small"
          strokeColor={isEligible ? '#faad14' : undefined}
          showInfo={false}
        />
      </div>
    </Card>
  );
}
