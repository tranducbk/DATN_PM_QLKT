'use client';

import { type ReactNode } from 'react';
import { Breadcrumb } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleSlug } from '@/lib/navigation';
import { ROLES } from '@/constants/roles.constants';

export interface BreadcrumbItem {
  title: ReactNode;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * Standard page breadcrumb: a Home icon linking to the current role's dashboard,
 * followed by the given crumbs. Single source for breadcrumb API, home target, and styling.
 * @param items - Crumbs after Home; pass `href` to make a crumb a link
 * @returns Breadcrumb element
 */
export function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  const { user } = useAuth();
  const dashboardHref = `/${getRoleSlug(user?.role ?? ROLES.USER)}/dashboard`;

  return (
    <Breadcrumb
      style={{ marginBottom: 16 }}
      items={[
        {
          title: (
            <Link href={dashboardHref} aria-label="Trang chủ">
              <HomeOutlined />
            </Link>
          ),
        },
        ...items.map(item => ({
          title: item.href ? <Link href={item.href}>{item.title}</Link> : item.title,
        })),
      ]}
    />
  );
}
