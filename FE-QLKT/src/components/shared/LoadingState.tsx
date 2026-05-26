'use client';

import { Spin } from 'antd';
import { cn } from '@/lib/utils';

type LoadingSize = 'sm' | 'md' | 'lg';

interface LoadingStateProps {
  text?: string;
  size?: LoadingSize;
  className?: string;
  fullPage?: boolean;
}

const SPIN_SIZE: Record<LoadingSize, 'small' | 'default' | 'large'> = {
  sm: 'small',
  md: 'default',
  lg: 'large',
};

export function LoadingState({
  text = 'Đang tải...',
  size = 'md',
  className,
  fullPage = false,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-4',
        fullPage ? 'min-h-screen' : 'min-h-[200px]',
        className
      )}
    >
      <Spin size={SPIN_SIZE[size]} />
      <p className="text-gray-600 dark:text-gray-400">{text}</p>
    </div>
  );
}
