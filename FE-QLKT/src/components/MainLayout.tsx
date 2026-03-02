'use client';

import { useState, useEffect, ReactNode } from 'react';
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
} from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  SettingOutlined,
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
import { useTheme } from './theme-provider';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';

const { Header, Sider, Content, Footer } = Layout;

interface MainLayoutProps {
  children: ReactNode;
  role?: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
}

export default function MainLayout({ children, role = 'ADMIN' }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userName, setUserName] = useState('User');
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [actualRole, setActualRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER'>(role);
  const [personnelId, setPersonnelId] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    // Kiểm tra kích thước màn hình
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Lấy role thực tế từ localStorage (ưu tiên hơn prop)
    const storedRole = localStorage.getItem('role');
    if (storedRole && ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'].includes(storedRole)) {
      setActualRole(storedRole as 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER');
    } else {
      setActualRole(role);
    }

    // Lấy tên người dùng từ localStorage
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        setUserName(userData.username || userData.name || userData.email || 'User');
        if (userData.quan_nhan_id) {
          setPersonnelId(userData.quan_nhan_id);
        }
      } catch (e) {
        setUserName('User');
        setPersonnelId(null);
      }
    }

    // Lấy số lượng thông báo chưa đọc
    loadNotificationCount();
  }, [role]);

  const loadNotificationCount = async () => {
    try {
      const response = await apiClient.getUnreadNotificationCount();
      if (response.success && response.data) {
        setNotificationCount(response.data.count || 0);
      }
    } catch (error) {
      console.error('Failed to load notification count:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      setNotificationLoading(true);
      // Load all notifications (both read and unread)
      const response = await apiClient.getNotifications({
        page: 1,
        limit: 20,
      });
      if (response.success && response.data) {
        setNotifications(response.data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleMarkAsRead = async (id: number, isRead: boolean, link?: string) => {
    try {
      // Only mark as read if not already read
      if (!isRead) {
        await apiClient.markNotificationAsRead(id);
        // Reload notifications and count
        loadNotifications();
        loadNotificationCount();
      }

      // Navigate to the link if provided
      if (link) {
        // For manager role, if link contains proposal detail, redirect to proposals list
        if (actualRole === 'MANAGER' && link.match(/\/manager\/proposals\/\d+/)) {
          router.push('/manager/proposals');
        }
        // For admin role, fix proposal detail URL to include /review
        else if (actualRole === 'ADMIN' && link.match(/\/admin\/proposals\/\d+$/)) {
          const proposalId = link.match(/\/admin\/proposals\/(\d+)$/)?.[1];
          if (proposalId) {
            router.push(`/admin/proposals/review/${proposalId}`);
          } else {
            router.push(link);
          }
        } else {
          router.push(link);
        }
      } else if (actualRole === 'MANAGER') {
        // Default to proposals page for managers
        router.push('/manager/proposals');
      } else if (actualRole === 'ADMIN') {
        // Default to proposals review page for admin
        router.push('/admin/proposals/review');
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      // Reload notifications and count
      loadNotifications();
      loadNotificationCount();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatNotificationTime = (dateString: string) => {
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
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    router.push('/login');
  };

  // Menu items dựa trên vai trò
  const getMenuItems = () => {
    const roleSlug = actualRole === 'SUPER_ADMIN' ? 'super-admin' : actualRole.toLowerCase();
    const baseItems = [
      {
        key: 'dashboard',
        icon: <DashboardOutlined />,
        label: <Link href={`/${roleSlug}/dashboard`}>Dashboard</Link>,
      },
    ];

    if (actualRole === 'SUPER_ADMIN') {
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

    if (actualRole === 'ADMIN') {
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

    if (actualRole === 'MANAGER') {
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
          key: 'system-logs',
          icon: <HistoryOutlined />,
          label: <Link href="/manager/system-logs">Nhật ký hệ thống</Link>,
        },
        {
          key: 'profile',
          icon: <SolutionOutlined />,
          label: (
            <Link
              href={
                personnelId
                  ? `/manager/personnel/${personnelId}`
                  : '/manager/dashboard'
              }
            >
              Hồ sơ của tôi
            </Link>
          ),
        },
        {
          key: 'profile-edit',
          icon: <UserOutlined />,
          label: <Link href="/manager/profile/edit">Thông tin cá nhân</Link>,
        },
      ];
    }

    if (actualRole === 'USER') {
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
      case 'SUPER_ADMIN':
        return '/super-admin/change-password';
      case 'ADMIN':
        return '/admin/change-password';
      case 'MANAGER':
        return '/manager/change-password';
      default:
        return '/user/change-password';
    }
  };

  // Xác định menu key nào nên active dựa vào pathname
  const getSelectedKey = () => {
    if (!pathname) return 'dashboard';

    // Xử lý route awards/bulk trước để ưu tiên (vì nó là sub-route của awards)
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

    // Xử lý cho SUPER_ADMIN
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

    // Xử lý cho MANAGER
    if (pathname.startsWith('/manager/profile/edit')) {
      return 'profile-edit';
    }
    // Xử lý /manager/personnel/[id] trước để ưu tiên (vì nó là sub-route của personnel)
    if (pathname.match(/^\/manager\/personnel\/[^/]+$/)) {
      return 'profile';
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

    // Xử lý cho USER
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

  const userMenuItems = [
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
      onClick: (e: any) => {
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

  const siderContent = (collapsed: boolean) => (
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
            {actualRole === 'SUPER_ADMIN' && 'Super Adminstrator'}
            {actualRole === 'ADMIN' && 'Quản trị viên'}
            {actualRole === 'MANAGER' && 'Quản lý'}
            {actualRole === 'USER' && 'Người dùng'}
          </p>
        )}
      </div>
      <Menu
        theme={theme === 'dark' ? 'dark' : 'light'}
        mode="inline"
        items={getMenuItems()}
        className="flex-1"
        selectedKeys={[getSelectedKey()]}
        style={{
          borderRight: 'none',
        }}
      />
    </div>
  );

  return (
    <ConfigProvider
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
        <Layout className="min-h-screen">
          {/* Desktop Sidebar */}
          {!isMobile && (
            <Sider
              collapsible
              collapsed={collapsed}
              onCollapse={setCollapsed}
              breakpoint="lg"
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
              {siderContent(collapsed)}
            </Sider>
          )}

          {/* Mobile Drawer */}
          {isMobile && (
            <Drawer
              title="Menu"
              placement="left"
              onClose={() => setMobileDrawerOpen(false)}
              open={mobileDrawerOpen}
              styles={{ body: { padding: 0 } }}
            >
              {siderContent(false)}
            </Drawer>
          )}

          <Layout style={{ marginLeft: isMobile ? 0 : collapsed ? 80 : 250 }}>
            {/* Header */}
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
                {/* Notification Bell */}
                <Dropdown
                  menu={{
                    items: notificationLoading
                      ? [
                          {
                            key: 'loading',
                            label: (
                              <div className="text-center py-12 px-6 min-w-[320px] max-w-[420px] text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg">
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
                              <div className="text-center py-12 px-6 min-w-[320px] max-w-[420px]">
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
                          // Header với nút "Đọc tất cả"
                          {
                            key: 'notification-header',
                            label: (
                              <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                  Thông báo
                                </h3>
                                {notifications.some(n => !n.is_read) && (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleMarkAllAsRead();
                                    }}
                                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors px-3 py-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/30"
                                  >
                                    Đọc tất cả
                                  </button>
                                )}
                              </div>
                            ),
                          },
                          {
                            type: 'divider' as const,
                          },
                          // Notification items
                          ...notifications.map(notif => ({
                            key: `notification-${notif.id}`,
                            label: (
                              <div
                                className={`max-w-xs cursor-pointer p-4 rounded-lg transition-all duration-200 mx-2 mb-2 ${
                                  notif.is_read
                                    ? 'bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
                                    : 'bg-blue-50 dark:bg-gray-700/80 hover:bg-blue-100 dark:hover:bg-gray-600 border-l-4 border-blue-500 dark:border-blue-400 shadow-sm'
                                }`}
                                onClick={() => {
                                  handleMarkAsRead(notif.id, notif.is_read, notif.link);
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  {!notif.is_read && (
                                    <div className="w-2.5 h-2.5 bg-blue-500 dark:bg-blue-300 rounded-full mt-1.5 flex-shrink-0 animate-pulse"></div>
                                  )}
                                  {notif.is_read && (
                                    <div className="w-2.5 h-2.5 mt-1.5 flex-shrink-0"></div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={`font-semibold text-sm mb-2 leading-snug ${
                                        notif.is_read
                                          ? 'text-gray-700 dark:text-gray-300'
                                          : 'text-gray-900 dark:text-white'
                                      }`}
                                    >
                                      {notif.title}
                                    </p>
                                    <p
                                      className={`text-sm mt-1.5 leading-relaxed ${
                                        notif.is_read
                                          ? 'text-gray-600 dark:text-gray-400'
                                          : 'text-gray-800 dark:text-gray-200'
                                      }`}
                                    >
                                      {notif.message}
                                    </p>
                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                                      <p
                                        className={`text-xs flex items-center gap-1.5 ${
                                          notif.is_read
                                            ? 'text-gray-400 dark:text-gray-500'
                                            : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                      >
                                        <span>{formatNotificationTime(notif.created_at)}</span>
                                      </p>
                                      {notif.is_read && (
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
                        ],
                  }}
                  placement="bottomRight"
                  trigger={['click']}
                  onOpenChange={open => {
                    if (open) {
                      loadNotifications();
                    }
                  }}
                  overlayStyle={{ maxWidth: '420px', marginTop: '-35px' }}
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

                {/* User Dropdown */}
                <Dropdown
                  menu={{ items: userMenuItems as any }}
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
                      className={`text-sm font-semibold ${
                        theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                      }`}
                    >
                      {userName}
                    </span>
                  </div>
                </Dropdown>
              </div>
            </Header>

            {/* Content */}
            <Content
              className={`${
                theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
              } min-h-[calc(100vh-64px-70px)]`}
            >
              {children}
            </Content>

            {/* Footer */}
            <Footer
              className={`text-center py-6 ${
                theme === 'dark'
                  ? 'bg-gray-800 border-t-2 border-blue-700 text-gray-300'
                  : 'bg-white border-t-2 border-blue-200'
              }`}
            >
              <p className="font-medium">© 2025 Học viện Khoa học Quân sự. All rights reserved.</p>
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
