'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type LoadingSize = 'sm' | 'md' | 'lg';

interface LoadingStateProps {
  text?: string;
  size?: LoadingSize;
  className?: string;
  fullPage?: boolean;
}

const ICON_SIZE: Record<LoadingSize, string> = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
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
        'flex w-full flex-col items-center justify-center',
        fullPage ? 'min-h-screen' : 'min-h-[200px]',
        className
      )}
    >
      <Loader2
        className={cn(ICON_SIZE[size], 'animate-spin text-blue-500 dark:text-blue-400 mb-4')}
      />
      <p className="text-gray-600 dark:text-gray-400">{text}</p>
    </div>
  );
}
