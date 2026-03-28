import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';

export function getAntdThemeConfig(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  };
}

export function getAntdTableThemeConfig(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorBgContainer: isDark ? '#1f2937' : '#ffffff',
      colorText: isDark ? '#f3f4f6' : '#111827',
      colorBorder: isDark ? '#4b5563' : '#d1d5db',
    },
    components: {
      Table: {
        rowHoverBg: isDark ? '#374151' : '#f9fafb',
        colorBgContainer: isDark ? '#111827' : '#ffffff',
        colorText: isDark ? '#f3f4f6' : '#111827',
        colorTextHeading: isDark ? '#f9fafb' : '#111827',
        colorBorderSecondary: isDark ? '#374151' : '#e5e7eb',
      },
    },
  };
}
