import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';

export const ANTD_FONT_FAMILY = 'var(--font-roboto), system-ui, sans-serif';

const PALETTE = {
  dark: {
    container: '#1f2937',
    body: '#111827',
    elevated: '#1f2937',
    text: '#f3f4f6',
    textHeading: '#f9fafb',
    border: '#4b5563',
    borderSecondary: '#374151',
    placeholder: '#9ca3af',
    hover: '#374151',
  },
  light: {
    container: '#ffffff',
    body: '#f9fafb',
    elevated: '#ffffff',
    text: '#111827',
    textHeading: '#111827',
    border: '#d1d5db',
    borderSecondary: '#e5e7eb',
    placeholder: '#6b7280',
    hover: '#f3f4f6',
  },
} as const;

/**
 * Builds the single root Ant Design theme applied app-wide via ThemeProvider.
 * Centralizes color tokens and per-component overrides so dark mode renders from
 * tokens instead of `.dark .ant-*` CSS overrides.
 * @param isDark - Whether dark mode is enabled
 * @returns Ant Design theme configuration for the whole app
 */
export function getRootAntdThemeConfig(isDark: boolean): ThemeConfig {
  const c = isDark ? PALETTE.dark : PALETTE.light;
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      fontFamily: ANTD_FONT_FAMILY,
      borderRadius: 8,
      colorBgContainer: c.container,
      colorBgElevated: c.elevated,
      colorText: c.text,
      colorBorder: c.border,
      colorBorderSecondary: c.borderSecondary,
      colorTextPlaceholder: c.placeholder,
    },
    components: {
      Layout: {
        headerBg: c.container,
        bodyBg: c.body,
        footerBg: c.container,
        siderBg: c.container,
      },
      Menu: {
        darkItemBg: PALETTE.dark.container,
        darkSubMenuItemBg: PALETTE.dark.container,
      },
      Dropdown: {
        colorBgElevated: c.elevated,
        controlItemBgHover: c.hover,
      },
      Drawer: {
        colorBgElevated: c.elevated,
      },
      Select: {
        colorBgElevated: c.elevated,
        optionActiveBg: isDark ? c.hover : undefined,
        optionSelectedBg: isDark ? '#2563eb' : undefined,
        optionSelectedColor: isDark ? '#ffffff' : undefined,
      },
      Table: {
        rowHoverBg: isDark ? '#374151' : '#f9fafb',
        colorBgContainer: isDark ? c.body : c.container,
        colorText: c.text,
        colorTextHeading: c.textHeading,
        headerBg: isDark ? c.container : '#f9fafb',
        headerColor: isDark ? c.textHeading : '#374151',
        colorBorderSecondary: c.borderSecondary,
      },
      Card: {
        colorBgContainer: isDark ? c.body : c.container,
      },
      Modal: {
        contentBg: c.container,
        headerBg: c.container,
        titleColor: c.text,
        borderRadiusLG: 16,
      },
      Input: {
        colorBgContainer: c.container,
      },
      Button: {
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
      },
      Popover: {
        colorBgElevated: c.elevated,
      },
      Tooltip: {
        colorBgSpotlight: isDark ? c.elevated : undefined,
      },
    },
  };
}

/**
 * Builds Ant Design global theme config for light/dark mode.
 * @param isDark - Whether dark mode is enabled
 * @returns Ant Design theme configuration
 */
export function getAntdThemeConfig(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      fontFamily: ANTD_FONT_FAMILY,
      borderRadius: 8,
    },
  };
}

/**
 * Builds the MainLayout-scoped theme config (Layout/Menu/Dropdown/Drawer overrides).
 * @param isDark - Whether dark mode is enabled
 * @returns Ant Design theme configuration for the app shell
 */
export function getAntdLayoutThemeConfig(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorBgContainer: isDark ? '#1f2937' : '#ffffff',
      colorText: isDark ? '#f3f4f6' : '#111827',
      colorBorder: isDark ? '#4b5563' : '#d1d5db',
      colorTextPlaceholder: isDark ? '#9ca3af' : '#6b7280',
      borderRadius: 8,
    },
    components: {
      Layout: {
        headerBg: isDark ? '#1f2937' : '#ffffff',
        bodyBg: isDark ? '#111827' : '#f9fafb',
        footerBg: isDark ? '#1f2937' : '#ffffff',
        siderBg: isDark ? '#1f2937' : '#ffffff',
      },
      Menu: {
        darkItemBg: '#1f2937',
        darkSubMenuItemBg: '#1f2937',
      },
      Dropdown: {
        colorBgElevated: isDark ? '#1f2937' : '#ffffff',
        controlItemBgHover: isDark ? '#374151' : '#f3f4f6',
      },
      Drawer: {
        colorBgElevated: isDark ? '#1f2937' : '#ffffff',
      },
    },
  };
}

/**
 * Builds Ant Design table-focused theme overrides for light/dark mode.
 * @param isDark - Whether dark mode is enabled
 * @returns Ant Design theme configuration with table overrides
 */
export function getAntdTableThemeConfig(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      fontFamily: ANTD_FONT_FAMILY,
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
