'use client';

import { Card, Typography } from 'antd';
import type { ReactNode } from 'react';

const { Text } = Typography;

interface StatCardColors {
  iconBg: string;
  iconShadow: string;
  iconColor: string;
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  isDark: boolean;
  darkColors: StatCardColors;
  lightColors: StatCardColors;
}

export function StatCard({ icon, label, value, isDark, darkColors, lightColors }: StatCardProps) {
  const colors = isDark ? darkColors : lightColors;

  return (
    <Card
      hoverable
      style={{
        borderRadius: '10px',
        boxShadow: isDark
          ? '0 1px 6px rgba(0, 0, 0, 0.35)'
          : '0 1px 4px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.3s ease',
      }}
      styles={{ body: { padding: '20px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: colors.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: colors.iconShadow,
          }}
        >
          <span style={{ fontSize: '26px', color: colors.iconColor, display: 'flex' }}>
            {icon}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <Text
            type="secondary"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              display: 'block',
              marginBottom: '4px',
              color: isDark ? '#cbd5e1' : '#475569',
            }}
          >
            {label}
          </Text>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: isDark ? '#e5e7eb' : '#0f172a',
              lineHeight: '1.1',
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}
