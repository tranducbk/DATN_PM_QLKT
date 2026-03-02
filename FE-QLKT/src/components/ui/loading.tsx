// @ts-nocheck
'use client';

import { Spin } from 'antd';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'small' | 'default' | 'large';
  className?: string;
}

export function Loading({
  message = 'Đang tải...',
  fullScreen = false,
  size = 'large',
  className = '',
}: LoadingProps) {
  const { theme } = useTheme();

  const content = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="mb-4">
        {size === 'small' ? (
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
        ) : size === 'large' ? (
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400" />
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        )}
      </div>
      {message && (
        <p
          className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}
        >
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return <div className="flex items-center justify-center py-12">{content}</div>;
}

// Component sử dụng Ant Design Spin (tùy chọn)
export function LoadingSpin({
  message = 'Đang tải...',
  fullScreen = false,
  size = 'large',
}: LoadingProps) {
  const { theme } = useTheme();

  const spin = (
    <div className="flex flex-col items-center justify-center gap-4">
      <Spin size={size} />
      {message && (
        <p
          className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}
        >
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900 backdrop-blur-sm">
        {spin}
      </div>
    );
  }

  return <div className="flex items-center justify-center py-12">{spin}</div>;
}

// Component inline nhỏ cho các phần tử nhỏ
export function LoadingInline({
  message,
  size = 'small',
}: {
  message?: string;
  size?: 'small' | 'default';
}) {
  const { theme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <Loader2
        className={`animate-spin text-blue-600 dark:text-blue-400 ${
          size === 'small' ? 'h-4 w-4' : 'h-5 w-5'
        }`}
      />
      {message && (
        <span className={`text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
          {message}
        </span>
      )}
    </div>
  );
}
