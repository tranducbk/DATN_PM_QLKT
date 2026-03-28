'use client';

import { useTheme } from '@/components/ThemeProvider';

export function useChartTheme() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return {
    textColor: isDark ? '#e5e7eb' : '#374151',
    gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    isDark,
  };
}

export function chartTitlePlugin(title: string, textColor: string) {
  return {
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
  };
}
