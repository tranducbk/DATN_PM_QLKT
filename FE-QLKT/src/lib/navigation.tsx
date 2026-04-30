import Link from 'next/link';
import {
  ApartmentOutlined,
  ContainerOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  FileSyncOutlined,
  FileTextOutlined,
  HistoryOutlined,
  SolutionOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { ROLES } from '@/constants/roles.constants';
import type { UserRole } from '@/lib/types/common';

const ROUTE_KEY_MAP: ReadonlyArray<readonly [string, string]> = [
  ['/admin/awards/bulk', 'bulk-awards'],
  ['/admin/awards', 'awards'],
  ['/admin/adhoc-awards', 'adhoc-awards'],
  ['/admin/personnel', 'personnel'],
  ['/admin/categories', 'categories'],
  ['/admin/proposals', 'proposals'],
  ['/admin/decisions', 'decisions'],
  ['/admin/accounts', 'accounts'],
  ['/admin/system-logs', 'system-logs'],
  ['/super-admin/accounts', 'accounts'],
  ['/super-admin/add-awards', 'add-awards'],
  ['/super-admin/system-logs', 'system-logs'],
  ['/manager/profile/edit', 'profile-edit'],
  ['/manager/proposals', 'proposals-list'],
  ['/manager/awards', 'awards'],
  ['/manager/units', 'units'],
  ['/manager/adhoc-awards', 'adhoc-awards'],
  ['/manager/system-logs', 'system-logs'],
  ['/manager/personnel', 'personnel'],
  ['/user/profile/edit', 'profile-edit'],
  ['/user/profile', 'profile'],
];

/**
 * @param role - Active role for the current user
 * @returns URL slug used to compose role-prefixed paths
 */
export function getRoleSlug(role: UserRole): string {
  return role === ROLES.SUPER_ADMIN ? 'super-admin' : (role || 'user').toLowerCase();
}

/**
 * @param role - Active role
 * @param personnelId - Linked personnel id (manager-only profile shortcut)
 * @returns Menu items for the sidebar
 */
export function getMenuItemsByRole(
  role: UserRole,
  personnelId: string | null
): MenuProps['items'] {
  const roleSlug = getRoleSlug(role);
  const dashboardItem = {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: <Link href={`/${roleSlug}/dashboard`}>Dashboard</Link>,
  };

  if (role === ROLES.SUPER_ADMIN) {
    return [
      dashboardItem,
      {
        key: 'accounts',
        icon: <TeamOutlined />,
        label: <Link href="/super-admin/accounts">Quản lý tài khoản</Link>,
      },
      {
        key: 'add-awards',
        icon: <TrophyOutlined />,
        label: <Link href="/super-admin/add-awards">Thêm khen thưởng</Link>,
      },
      {
        key: 'system-logs',
        icon: <FileTextOutlined />,
        label: <Link href="/super-admin/system-logs">Nhật ký hệ thống</Link>,
      },
    ];
  }

  if (role === ROLES.ADMIN) {
    return [
      dashboardItem,
      {
        key: 'accounts',
        icon: <UserOutlined />,
        label: <Link href="/admin/accounts">Quản lý tài khoản</Link>,
      },
      {
        key: 'personnel',
        icon: <TeamOutlined />,
        label: <Link href="/admin/personnel">Quản lý quân nhân</Link>,
      },
      {
        key: 'categories',
        icon: <ApartmentOutlined />,
        label: <Link href="/admin/categories">Quản lý cơ quan đơn vị</Link>,
      },
      {
        key: 'proposals',
        icon: <FileSyncOutlined />,
        label: <Link href="/admin/proposals/review">Duyệt đề xuất</Link>,
      },
      {
        key: 'decisions',
        icon: <FileTextOutlined />,
        label: <Link href="/admin/decisions">Quản lý quyết định</Link>,
      },
      {
        key: 'awards',
        icon: <FileDoneOutlined />,
        label: <Link href="/admin/awards">Quản lý khen thưởng</Link>,
      },
      {
        key: 'bulk-awards',
        icon: <TrophyOutlined />,
        label: <Link href="/admin/awards/bulk/create">Thêm khen thưởng</Link>,
      },
      {
        key: 'adhoc-awards',
        icon: <ContainerOutlined />,
        label: <Link href="/admin/adhoc-awards">Khen thưởng đột xuất</Link>,
      },
      {
        key: 'system-logs',
        icon: <HistoryOutlined />,
        label: <Link href="/admin/system-logs">Nhật ký hệ thống</Link>,
      },
    ];
  }

  if (role === ROLES.MANAGER) {
    return [
      dashboardItem,
      {
        key: 'personnel',
        icon: <TeamOutlined />,
        label: <Link href="/manager/personnel">Quân nhân đơn vị</Link>,
      },
      {
        key: 'proposals-list',
        icon: <FileSyncOutlined />,
        label: <Link href="/manager/proposals">Đề xuất của tôi</Link>,
      },
      {
        key: 'awards',
        icon: <FileTextOutlined />,
        label: <Link href="/manager/awards">Khen thưởng quân nhân</Link>,
      },
      {
        key: 'units',
        icon: <ApartmentOutlined />,
        label: <Link href="/manager/units">Khen thưởng đơn vị</Link>,
      },
      {
        key: 'adhoc-awards',
        icon: <TrophyOutlined />,
        label: <Link href="/manager/adhoc-awards">Khen thưởng đột xuất</Link>,
      },
      {
        key: 'profile',
        icon: <SolutionOutlined />,
        label: (
          <Link href={personnelId ? `/manager/personnel/${personnelId}` : '/manager/dashboard'}>
            Hồ sơ của tôi
          </Link>
        ),
      },
      {
        key: 'profile-edit',
        icon: <UserOutlined />,
        label: <Link href="/manager/profile/edit">Thông tin cá nhân</Link>,
      },
      {
        key: 'system-logs',
        icon: <HistoryOutlined />,
        label: <Link href="/manager/system-logs">Nhật ký hệ thống</Link>,
      },
    ];
  }

  if (role === ROLES.USER) {
    return [
      dashboardItem,
      {
        key: 'profile',
        icon: <SolutionOutlined />,
        label: <Link href="/user/profile">Hồ sơ của tôi</Link>,
      },
      {
        key: 'profile-edit',
        icon: <UserOutlined />,
        label: <Link href="/user/profile/edit">Thông tin cá nhân</Link>,
      },
    ];
  }

  return [dashboardItem];
}

/**
 * @param pathname - Current URL pathname
 * @param personnelId - Linked personnel id (manager-only)
 * @returns Menu key matching the current route, or 'dashboard' as default
 */
export function getSelectedMenuKey(
  pathname: string | null,
  personnelId: string | null
): string {
  if (!pathname) return 'dashboard';

  const managerPersonnelMatch = pathname.match(/^\/manager\/personnel\/([^/]+)/);
  if (managerPersonnelMatch) {
    return managerPersonnelMatch[1] === String(personnelId) ? 'profile' : 'personnel';
  }

  const match = ROUTE_KEY_MAP.find(([prefix]) => pathname.startsWith(prefix));
  if (match) return match[1];

  if (pathname.match(/^\/(admin|super-admin|manager|user)(\/dashboard)?$/)) {
    return 'dashboard';
  }

  return 'dashboard';
}
