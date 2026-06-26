'use client';

import Link from 'next/link';
import { Button, Card } from 'antd';
import type { ReactNode } from 'react';

export interface QuickAction {
  label: string;
  icon: ReactNode;
  /** Navigation target. Omit when the action runs `onClick` instead. */
  href?: string;
  onClick?: () => void;
}

interface QuickActionsProps {
  actions: QuickAction[];
  title?: string;
}

const ACTION_BUTTON_CLASS =
  'w-full h-full min-h-[84px] py-4 text-base font-medium whitespace-normal break-words ' +
  'transition-all duration-200 hover:-translate-y-1 hover:shadow-lg';

/**
 * Shared "Quick actions" button grid used by the dashboards of all four roles.
 * @param actions - Actions to render; each navigates via `href` or runs `onClick`
 * @param title - Card title, defaults to "Thao tác nhanh"
 * @returns Card containing the quick-action button grid
 */
export function QuickActions({ actions, title = 'Thao tác nhanh' }: QuickActionsProps) {
  return (
    <Card title={<span className="text-lg font-semibold">{title}</span>} className="shadow-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {actions.map(action => {
          const button = (
            <Button
              type="default"
              icon={action.icon}
              size="large"
              onClick={action.onClick}
              className={ACTION_BUTTON_CLASS}
            >
              {action.label}
            </Button>
          );

          return action.href ? (
            <Link key={action.label} href={action.href} className="block h-full">
              {button}
            </Link>
          ) : (
            <div key={action.label} className="h-full">
              {button}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
