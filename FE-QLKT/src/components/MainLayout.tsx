'use client';

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useSocket, SocketConnectionStatus } from '@/hooks/useSocket';
import { useMobile } from '@/hooks/useMobile';
import {
  Layout,
  Menu,
  Dropdown,
  Avatar,
  Button,
  Drawer,
  Switch,
  ConfigProvider,
  App,
  theme as antdTheme,
  Spin,
  Modal,
  Empty,
  message,
} from 'antd';
import type { MenuProps } from 'antd';
import type { MenuInfo } from 'rc-menu/lib/interface';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined,
  CloseOutlined,
  BulbOutlined,
  BulbFilled,
  UserOutlined,
  LockOutlined,
  BellOutlined,
  ApartmentOutlined,
  TrophyOutlined,
  FileSyncOutlined,
  FileDoneOutlined,
  ContainerOutlined,
  HistoryOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from './ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import type { NotificationItem } from '@/lib/api/notifications';
import { formatDate } from '@/lib/utils';
import type { UserRole } from '@/lib/types';
import { FETCH_ALL_LIMIT } from '@/lib/constants/pagination.constants';
import { ROLES, getRoleInfo } from '@/constants/roles.constants';
import { getApiErrorMessage, logApiError } from '@/lib/apiError';

const { Header, Sider, Content, Footer } = Layout;

interface MainLayoutProps {
  children: ReactNode;
  role?: UserRole;
}

type SocketNotificationPayload = {
  title?: string;
  message?: string;
};

/**
 * Component hiển thị toast khi có thông báo mới qua socket.
 * Phải đặt bên trong <App> để dùng được App.useApp().
 */
function NotificationToast({ notification }: { notification: SocketNotificationPayload | null }) {
  const { notification: antNotification } = App.useApp();

  useEffect(() => {
    if (!notification) return;
    antNotification.info({
      message: notification.title || 'Thông báo mới',
      description: notification.message,
      placement: 'bottomRight',
      duration: 5,
    });
  }, [notification]);

  return null;
}

/**
 * Component lắng nghe lỗi API toàn cục và hiển thị thông báo.
 * Phải đặt bên trong <App> để dùng được App.useApp().
 */
function ApiErrorHandler() {
  const { message } = App.useApp();

  useEffect(() => {
    const handler = (e: CustomEvent<{ message: string; status: number }>) => {
      const { status: statusCode } = e.detail;
      if (statusCode >= 500) {
        message.error(e.detail.message || 'Lỗi máy chủ. Vui lòng thử lại sau.');
      } else if (statusCode === 403) {
        message.warning('Bạn không có quyền thực hiện thao tác này.');
      } else if (statusCode === 400) {
        message.warning(e.detail.message || 'Dữ liệu không hợp lệ.');
      }
    };

    window.addEventListener('apiError', handler as EventListener);
    return () => window.removeEventListener('apiError', handler as EventListener);
  }, [message]);

  return null;
}

/**
 * Component hiển thị toast khi trạng thái kết nối socket thay đổi.
 * Phải đặt bên trong <App> để dùng được App.useApp().
 */
function ConnectionStatusToast({ status }: { status: SocketConnectionStatus }) {
  const { message } = App.useApp();
  const prevStatusRef = useRef<SocketConnectionStatus | null>(null);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === null) return; // skip initial mount
    if (status === 'disconnected' && prev !== 'disconnected') {
      message.warning('Mất kết nối máy chủ. Đang thử kết nối lại...');
    } else if (status === 'connected' && prev !== 'connected') {
      message.success('Đã kết nối lại máy chủ.');
    }
  }, [status, message]);

  return null;
}

function formatNotificationTime(dateString: string | undefined | null): string {
  if (dateString == null || dateString === '') return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return formatDate(date);
}

export function MainLayout({ children, role = ROLES.ADMIN }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isMobile = useMobile(1024);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [latestNotification, setLatestNotification] = useState<SocketNotificationPayload | null>(
    null
  );
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { user, logout: authLogout } = useAuth();

  const actualRole = (user?.role ?? role) as UserRole;
  const userName = user?.username || 'User';
  const personnelId = user?.quan_nhan_id ?? null;
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('accessToken');
    }
    return null;
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('accessToken');
      setAccessToken(token);
    } else {
      setAccessToken(null);
    }
  }, [user]);

  const handleNewNotification = useCallback((notification: unknown) => {
    setNotificationCount(prev => prev + 1);
    const row: NotificationItem =
      notification && typeof notification === 'object'
        ? (notification as NotificationItem)
        : { message: String(notification), created_at: new Date().toISOString() };
    setNotifications(prev => [row, ...prev]);
    setLatestNotification(row as SocketNotificationPayload);
  }, []);

  const handleForceLogout = useCallback(
    (data: { message: string }) => {
      Modal.warning({
        title: 'Phiên đăng nhập đã kết thúc',
        content: data.message || 'Tài khoản của bạn đã được đăng nhập ở nơi khác.',
        okText: 'Đăng nhập lại',
        onOk: () => {
          authLogout();
        },
      });
    },
    [authLogout]
  );

  const { connectionStatus } = useSocket(
    accessToken,
    handleNewNotification,
    undefined,
    handleForceLogout
  );

  const loadNotificationCount = useCallback(async () => {
    try {
      const response = await apiClient.getUnreadNotificationCount();
      if (response.success && response.data) {
        setNotificationCount(response.data.count || 0);
      }
    } catch (error: unknown) {
      logApiError(error, 'Tải số thông báo chưa đọc');
    }
  }, []);

  useEffect(() => {
    loadNotificationCount();
  }, [loadNotificationCount]);

  const loadNotifications = useCallback(async () => {
    try {
      setNotificationLoading(true);
      const response = await apiClient.getNotifications({
        page: 1,
        limit: FETCH_ALL_LIMIT,
      });
      if (response.success && response.data) {
        const list = (response.data.notifications || []) as NotificationItem[];
        setNotifications(list);
      }
    } catch (error: unknown) {
      logApiError(error, 'Tải danh sách thông báo');
    } finally {
      setNotificationLoading(false);
    }
  }, []);

  const handleMarkAsRead = async (id: string, isRead: boolean, link?: string | null) => {
    try {
      if (!isRead) {
        await apiClient.markNotificationAsRead(id);
        loadNotifications();
        loadNotificationCount();
      }

      if (link) {
        router.push(link);
      } else if (actualRole === ROLES.MANAGER) {
        router.push('/manager/proposals');
      } else if (actualRole === ROLES.ADMIN) {
        router.push('/admin/proposals/review');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Không thể cập nhật trạng thái thông báo'));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      loadNotifications();
      loadNotificationCount();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Không thể đánh dấu đã đọc'));
    }
  };

  const handleDeleteAllNotifications = async () => {
    try {
      await apiClient.deleteAllNotifications();
      setNotifications([]);
      setNotificationCount(0);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Không thể xóa thông báo'));
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    authLogout();
    window.location.href = '/login';
  };

  const getMenuItems = () => {
    const roleSlug = actualRole === ROLES.SUPER_ADMIN ? 'super-admin' : actualRole.toLowerCase();
    const baseItems = [
      {
        key: 'dashboard',
        icon: <DashboardOutlined />,
        label: <Link href={`/${roleSlug}/dashboard`}>Dashboard</Link>,
      },
    ];

    if (actualRole === ROLES.SUPER_ADMIN) {
      return [
        ...baseItems,
        {
          key: 'accounts',
          icon: <TeamOutlined />,
          label: <Link href="/super-admin/accounts">Quản lý Tài khoản</Link>,
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

    if (actualRole === ROLES.ADMIN) {
      return [
        ...baseItems,
        {
          key: 'accounts',
          icon: <UserOutlined />,
          label: <Link href="/admin/accounts">Quản lý Tài khoản</Link>,
        },
        {
          key: 'personnel',
          icon: <TeamOutlined />,
          label: <Link href="/admin/personnel">Quản lý Quân nhân</Link>,
        },
        {
          key: 'categories',
          icon: <ApartmentOutlined />,
          label: <Link href="/admin/categories">Quản lý Cơ quan Đơn vị</Link>,
        },
        {
          key: 'proposals',
          icon: <FileSyncOutlined />,
          label: <Link href="/admin/proposals/review">Duyệt Đề xuất</Link>,
        },
        {
          key: 'decisions',
          icon: <FileTextOutlined />,
          label: <Link href="/admin/decisions">Quản lý Quyết định</Link>,
        },
        {
          key: 'awards',
          icon: <FileDoneOutlined />,
          label: <Link href="/admin/awards">Quản lý Khen Thưởng</Link>,
        },
        {
          key: 'bulk-awards',
          icon: <TrophyOutlined />,
          label: <Link href="/admin/awards/bulk/create">Thêm khen thưởng</Link>,
        },
        {
          key: 'adhoc-awards',
          icon: <ContainerOutlined />,
          label: <Link href="/admin/adhoc-awards">Khen thưởng Đột xuất</Link>,
        },
        {
          key: 'system-logs',
          icon: <HistoryOutlined />,
          label: <Link href="/admin/system-logs">Nhật ký hệ thống</Link>,
        },
      ];
    }

    if (actualRole === ROLES.MANAGER) {
      return [
        ...baseItems,
        {
          key: 'personnel',
          icon: <TeamOutlined />,
          label: <Link href="/manager/personnel">Quân nhân Đơn vị</Link>,
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

    if (actualRole === ROLES.USER) {
      return [
        ...baseItems,
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

    return baseItems;
  };

  const getChangePasswordPath = () => {
    switch (actualRole) {
      case ROLES.SUPER_ADMIN:
        return '/super-admin/change-password';
      case ROLES.ADMIN:
        return '/admin/change-password';
      case ROLES.MANAGER:
        return '/manager/change-password';
      default:
        return '/user/change-password';
    }
  };

  const getSelectedKey = () => {
    if (!pathname) return 'dashboard';

    // Check awards/bulk before awards (sub-route takes priority)
    if (pathname.startsWith('/admin/awards/bulk')) {
      return 'bulk-awards';
    }
    if (pathname.startsWith('/admin/awards')) {
      return 'awards';
    }
    if (pathname.startsWith('/admin/adhoc-awards')) {
      return 'adhoc-awards';
    }
    if (pathname.startsWith('/admin/personnel')) {
      return 'personnel';
    }
    if (pathname.startsWith('/admin/categories')) {
      return 'categories';
    }
    if (pathname.startsWith('/admin/proposals')) {
      return 'proposals';
    }
    if (pathname.startsWith('/admin/decisions')) {
      return 'decisions';
    }
    if (pathname.startsWith('/admin/accounts')) {
      return 'accounts';
    }
    if (pathname.startsWith('/admin/system-logs')) {
      return 'system-logs';
    }
    if (pathname.startsWith('/admin/dashboard') || pathname === '/admin') {
      return 'dashboard';
    }

    if (pathname.startsWith('/super-admin/accounts')) {
      return 'accounts';
    }
    if (pathname.startsWith('/super-admin/add-awards')) {
      return 'add-awards';
    }
    if (pathname.startsWith('/super-admin/system-logs')) {
      return 'system-logs';
    }
    if (pathname.startsWith('/super-admin/dashboard') || pathname === '/super-admin') {
      return 'dashboard';
    }

    if (pathname.startsWith('/manager/profile/edit')) {
      return 'profile-edit';
    }
    // /manager/personnel/[id] — own profile vs unit personnel
    const managerPersonnelMatch = pathname.match(/^\/manager\/personnel\/([^/]+)/);
    if (managerPersonnelMatch) {
      const viewingId = managerPersonnelMatch[1];
      return viewingId === String(personnelId) ? 'profile' : 'personnel';
    }
    if (pathname.startsWith('/manager/personnel')) {
      return 'personnel';
    }
    if (pathname.startsWith('/manager/proposals')) {
      return 'proposals-list';
    }
    if (pathname.startsWith('/manager/awards')) {
      return 'awards';
    }
    if (pathname.startsWith('/manager/units')) {
      return 'units';
    }
    if (pathname.startsWith('/manager/adhoc-awards')) {
      return 'adhoc-awards';
    }
    if (pathname.startsWith('/manager/system-logs')) {
      return 'system-logs';
    }
    if (pathname.startsWith('/manager/dashboard') || pathname === '/manager') {
      return 'dashboard';
    }

    if (pathname.startsWith('/user/profile/edit')) {
      return 'profile-edit';
    }
    if (pathname.startsWith('/user/profile')) {
      return 'profile';
    }
    if (pathname.startsWith('/user/dashboard') || pathname === '/user') {
      return 'dashboard';
    }

    return 'dashboard';
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'change-password',
      label: 'Đổi mật khẩu',
      icon: <LockOutlined />,
      onClick: () => {
        router.push(getChangePasswordPath());
      },
    },
    {
      type: 'divider',
    },
    {
      key: 'theme-toggle',
      label: (
        <div className="flex items-center justify-between gap-3 w-full">
          <span className="flex items-center gap-2">
            {theme === 'dark' ? <BulbFilled /> : <BulbOutlined />}
            {theme === 'dark' ? 'Chế độ tối' : 'Chế độ sáng'}
          </span>
          <Switch checked={theme === 'dark'} onChange={toggle} size="small" />
        </div>
      ),
      onClick: (e: MenuInfo) => {
        e.domEvent.stopPropagation();
      },
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Đăng xuất',
      icon: <LogoutOutlined />,
      onClick: handleLogout,
      danger: true,
    },
  ];

  const siderContent = () => (
    <div className="h-full flex flex-col">
      <div
        className={`p-5 text-center border-b-2 transition-all ${
          theme === 'dark'
            ? 'border-blue-700 bg-gradient-to-b from-gray-800 to-gray-900'
            : 'border-blue-200 bg-gradient-to-b from-blue-50 to-white'
        }`}
      >
        <h1
          className={`font-bold tracking-wider transition-all ${
            collapsed ? 'text-lg' : 'text-2xl'
          } ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}
        >
          QLKT
        </h1>
        {!collapsed && (
          <p
            className={`text-xs mt-2 font-medium uppercase tracking-wide ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            {getRoleInfo(actualRole).label}
          </p>
        )}
      </div>
      <Menu
        theme={theme === 'dark' ? 'dark' : 'light'}
        mode="inline"
        items={getMenuItems()}
        className="flex-1"
        selectedKeys={[getSelectedKey()]}
        onClick={() => {
          if (isMobile) setMobileDrawerOpen(false);
        }}
        style={{
          borderRight: 'none',
        }}
      />
    </div>
  );

  return (
    <ConfigProvider
      renderEmpty={() => <Empty description="Không có dữ liệu" />}
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorBgContainer: theme === 'dark' ? '#1f2937' : '#ffffff',
          colorText: theme === 'dark' ? '#f3f4f6' : '#111827',
          colorBorder: theme === 'dark' ? '#4b5563' : '#d1d5db',
          colorTextPlaceholder: theme === 'dark' ? '#9ca3af' : '#6b7280',
          borderRadius: 8,
        },
        components: {
          Layout: {
            headerBg: theme === 'dark' ? '#1f2937' : '#ffffff',
            bodyBg: theme === 'dark' ? '#111827' : '#f9fafb',
            footerBg: theme === 'dark' ? '#1f2937' : '#ffffff',
            siderBg: theme === 'dark' ? '#1f2937' : '#ffffff',
          },
          Menu: {
            darkItemBg: '#1f2937',
            darkSubMenuItemBg: '#1f2937',
          },
          Dropdown: {
            colorBgElevated: theme === 'dark' ? '#1f2937' : '#ffffff',
            controlItemBgHover: theme === 'dark' ? '#374151' : '#f3f4f6',
          },
          Drawer: {
            colorBgElevated: theme === 'dark' ? '#1f2937' : '#ffffff',
          },
        },
      }}
    >
      <App>
        {isLoggingOut && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/90 backdrop-blur-sm transition-opacity duration-300">
            <Spin size="large" />
            <p className="mt-4 text-base font-medium text-gray-600 dark:text-gray-300">
              Đang đăng xuất...
            </p>
          </div>
        )}
        <ApiErrorHandler />
        <NotificationToast notification={latestNotification} />
        <ConnectionStatusToast status={connectionStatus} />
        <Layout className="min-h-screen">
          {!isMobile && (
            <Sider
              collapsible
              collapsed={collapsed}
              onCollapse={setCollapsed}
              collapsedWidth={80}
              width={250}
              className={theme === 'dark' ? 'bg-gray-800' : 'bg-white'}
              style={{
                overflow: 'auto',
                height: '100vh',
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
              }}
            >
              {siderContent()}
            </Sider>
          )}

          <Drawer
            title="Menu"
            placement="left"
            onClose={() => setMobileDrawerOpen(false)}
            open={isMobile && mobileDrawerOpen}
            styles={{ body: { padding: 0 } }}
          >
            {siderContent()}
          </Drawer>

          <Layout
            className="min-w-0 flex-1"
            style={{ marginLeft: isMobile ? 0 : collapsed ? 80 : 250, transition: 'margin-left 0.2s ease' }}
          >
            <Header
              className={`shadow-sm px-4 flex items-center justify-between ${
                theme === 'dark' ? 'bg-gray-800 border-b border-gray-700' : 'bg-white'
              }`}
              style={{ position: 'sticky', top: 0, zIndex: 10 }}
            >
              <div className="flex items-center gap-4">
                {isMobile && (
                  <Button
                    type="text"
                    icon={mobileDrawerOpen ? <CloseOutlined /> : <MenuOutlined />}
                    onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
                    className={theme === 'dark' ? 'text-gray-300' : ''}
                  />
                )}
                {!isMobile && (
                  <Button
                    type="text"
                    icon={<MenuOutlined />}
                    onClick={() => setCollapsed(!collapsed)}
                    className={theme === 'dark' ? 'text-gray-300' : ''}
                  />
                )}
              </div>

              <div className="flex items-center gap-4">
                <Dropdown
                  menu={{
                    items: notificationLoading
                      ? [
                          {
                            key: 'loading',
                            label: (
                              <div className="text-center py-12 px-6 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg">
                                <Spin size="large" className="mb-3" />
                                <div className="text-sm font-medium">Đang tải thông báo...</div>
                              </div>
                            ),
                          },
                        ]
                      : notifications.length === 0
                        ? [
                            {
                              key: 'empty',
                              label: (
                                <div className="text-center py-12 px-6">
                                  <div className="flex flex-col items-center justify-center">
                                    <BellOutlined className="text-4xl text-gray-300 dark:text-gray-600 mb-4" />
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                                      Không có thông báo
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                      Các thông báo mới sẽ xuất hiện ở đây
                                    </p>
                                  </div>
                                </div>
                              ),
                            },
                          ]
                        : [
                            {
                              key: 'notification-header',
                              label: (
                                <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
                                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                    Thông báo
                                  </h3>
                                  {notifications.length > 0 && (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleDeleteAllNotifications();
                                      }}
                                      className="text-sm font-medium text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors px-3 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/30"
                                    >
                                      Xoá tất cả
                                    </button>
                                  )}
                                </div>
                              ),
                            },
                            {
                              type: 'divider' as const,
                            },
                            ...notifications.map(notification => ({
                              key: `notification-${notification.id}`,
                              label: (
                                <div
                                  className={`cursor-pointer p-4 rounded-lg transition-all duration-200 mx-2 mb-2 ${
                                    notification.is_read
                                      ? 'bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
                                      : 'bg-blue-50 dark:bg-gray-700/80 hover:bg-blue-100 dark:hover:bg-gray-600 border-l-4 border-blue-500 dark:border-blue-400 shadow-sm'
                                  }`}
                                  onClick={() => {
                                    if (notification.id != null) {
                                      handleMarkAsRead(
                                        notification.id,
                                        Boolean(notification.is_read),
                                        notification.link
                                      );
                                    }
                                  }}
                                >
                                  <div className="flex items-start gap-3">
                                    {!notification.is_read && (
                                      <div className="w-2.5 h-2.5 bg-blue-500 dark:bg-blue-300 rounded-full mt-1.5 flex-shrink-0 animate-pulse"></div>
                                    )}
                                    {notification.is_read && (
                                      <div className="w-2.5 h-2.5 mt-1.5 flex-shrink-0"></div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={`font-semibold text-sm mb-2 leading-snug ${
                                          notification.is_read
                                            ? 'text-gray-700 dark:text-gray-300'
                                            : 'text-gray-900 dark:text-white'
                                        }`}
                                      >
                                        {notification.title}
                                      </p>
                                      <p
                                        className={`text-sm mt-1.5 leading-relaxed ${
                                          notification.is_read
                                            ? 'text-gray-600 dark:text-gray-400'
                                            : 'text-gray-800 dark:text-gray-200'
                                        }`}
                                      >
                                        {notification.message}
                                      </p>
                                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                                        <p
                                          className={`text-xs flex items-center gap-1.5 ${
                                            notification.is_read
                                              ? 'text-gray-400 dark:text-gray-500'
                                              : 'text-gray-500 dark:text-gray-400'
                                          }`}
                                        >
                                          <span>
                                            {formatNotificationTime(notification.created_at)}
                                          </span>
                                        </p>
                                        {notification.is_read && (
                                          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded">
                                            Đã đọc
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ),
                            })),
                            ...(notifications.some(n => !n.is_read)
                              ? [
                                  { type: 'divider' as const },
                                  {
                                    key: 'notification-footer',
                                    label: (
                                      <div className="text-center py-2">
                                        <button
                                          onClick={e => {
                                            e.stopPropagation();
                                            handleMarkAllAsRead();
                                          }}
                                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-4 py-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                        >
                                          Đọc tất cả
                                        </button>
                                      </div>
                                    ),
                                  },
                                ]
                              : []),
                          ],
                  }}
                  placement="bottomRight"
                  trigger={['click']}
                  placement="bottomRight"
                  onOpenChange={open => {
                    if (open) {
                      loadNotifications();
                      loadNotificationCount();
                    }
                  }}
                  overlayStyle={{ width: isMobile ? undefined : '420px', marginTop: '-35px' }}
                  overlayClassName="notification-dropdown"
                >
                  <div className="relative cursor-pointer group inline-block p-2 -m-2 rounded-lg">
                    <BellOutlined className="text-xl text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                    {notificationCount > 0 && (
                      <span className="absolute top-2 -right-1 bg-red-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-lg animate-pulse border-2 border-white dark:border-gray-800">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                  </div>
                </Dropdown>

                <Dropdown
                  menu={{ items: userMenuItems }}
                  placement="bottomRight"
                  trigger={['click']}
                >
                  <div
                    className={`flex items-center gap-3 cursor-pointer group px-3 rounded-lg transition-colors ${
                      theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-blue-50/50'
                    }`}
                  >
                    <Avatar
                      size="large"
                      style={{
                        backgroundColor: '#1890ff',
                        boxShadow: '0 2px 8px rgba(24, 144, 255, 0.3)',
                      }}
                    >
                      {userName.charAt(0).toUpperCase()}
                    </Avatar>
                    <span
                      className={`hidden sm:block text-sm font-semibold ${
                        theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                      }`}
                    >
                      {userName}
                    </span>
                  </div>
                </Dropdown>
              </div>
            </Header>

            <Content
              className={`${
                theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
              } min-h-[calc(100vh-64px-70px)] min-w-0 max-w-full`}
            >
              {children}
            </Content>

            <Footer
              className={`text-center py-6 ${
                theme === 'dark'
                  ? 'bg-gray-800 border-t-2 border-blue-700 text-gray-300'
                  : 'bg-white border-t-2 border-blue-200'
              }`}
            >
              <p className="font-medium">© 2026 Học viện Khoa học Quân sự. All rights reserved.</p>
              <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                Hệ thống Quản lý Khen thưởng
              </p>
            </Footer>
          </Layout>
        </Layout>
      </App>
    </ConfigProvider>
  );
}
