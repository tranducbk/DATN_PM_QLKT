'use client';

import { Card, Typography } from 'antd';
import Link from 'next/link';
import type { ReactNode } from 'react';

const { Text } = Typography;

interface StatCardColors {
  iconBg: string;
  iconShadow: string;
  iconColor: string;
}

export type StatCardColor = 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

const PALETTE: Record<StatCardColor, { dark: StatCardColors; light: StatCardColors }> = {
  blue: {
    dark: { iconBg: '#1e3a8a', iconShadow: '0 1px 3px rgba(59, 130, 246, 0.3)', iconColor: '#60a5fa' },
    light: { iconBg: '#e6f0ff', iconShadow: '0 1px 3px rgba(59, 130, 246, 0.2)', iconColor: '#2563eb' },
  },
  green: {
    dark: { iconBg: '#0b3d2e', iconShadow: '0 1px 3px rgba(16, 185, 129, 0.3)', iconColor: '#34d399' },
    light: { iconBg: '#e8f5e9', iconShadow: '0 1px 3px rgba(16, 185, 129, 0.2)', iconColor: '#059669' },
  },
  yellow: {
    dark: { iconBg: '#78350f', iconShadow: '0 1px 3px rgba(234, 179, 8, 0.3)', iconColor: '#fbbf24' },
    light: { iconBg: '#fef9c3', iconShadow: '0 1px 3px rgba(234, 179, 8, 0.2)', iconColor: '#d97706' },
  },
  purple: {
    dark: { iconBg: '#3b0764', iconShadow: '0 1px 3px rgba(139, 92, 246, 0.3)', iconColor: '#a78bfa' },
    light: { iconBg: '#f3e8ff', iconShadow: '0 1px 3px rgba(139, 92, 246, 0.2)', iconColor: '#7c3aed' },
  },
  orange: {
    dark: { iconBg: '#7c2d12', iconShadow: '0 1px 3px rgba(249, 115, 22, 0.3)', iconColor: '#fb923c' },
    light: { iconBg: '#ffedd5', iconShadow: '0 1px 3px rgba(249, 115, 22, 0.2)', iconColor: '#ea580c' },
  },
};

/**
 * Returns the dark + light palettes for a given color name, ready to spread
 * onto a StatCard via {...getStatCardPalette('blue')}.
 */
export function getStatCardPalette(color: StatCardColor): {
  darkColors: StatCardColors;
  lightColors: StatCardColors;
} {
  return { darkColors: PALETTE[color].dark, lightColors: PALETTE[color].light };
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  isDark: boolean;
  darkColors: StatCardColors;
  lightColors: StatCardColors;
  link?: string;
}

export function StatCard({
  icon,
  label,
  value,
  isDark,
  darkColors,
  lightColors,
  link,
}: StatCardProps) {
  const colors = isDark ? darkColors : lightColors;

  const card = (
    <Card
      hoverable
      className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
      style={{
        borderRadius: '10px',
        boxShadow: isDark ? '0 1px 6px rgba(0, 0, 0, 0.35)' : '0 1px 4px rgba(0, 0, 0, 0.06)',
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
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '26px', color: colors.iconColor, display: 'flex' }}>
            {icon}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
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

  if (link) return <Link href={link}>{card}</Link>;
  return card;
}
