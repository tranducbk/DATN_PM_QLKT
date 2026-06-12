'use client';

import { Empty } from 'antd';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  description?: ReactNode;
  compact?: boolean;
  className?: string;
}

/**
 * Consistent empty-state placeholder for list and table views.
 * @param description - User-facing empty message (Vietnamese)
 * @param compact - Tighter vertical spacing for nested/inline contexts
 * @param className - Extra Tailwind classes merged over the default spacing
 * @returns Centered AntD Empty with standard padding
 */
export function EmptyState({
  description = 'Không có dữ liệu',
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn('flex w-full items-center justify-center', compact ? 'py-4' : 'py-12', className)}
    >
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
    </div>
  );
}
