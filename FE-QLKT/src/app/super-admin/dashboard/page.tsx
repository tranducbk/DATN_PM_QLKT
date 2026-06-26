'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { StatCard, getStatCardPalette, type StatCardColor } from '@/components/dashboard/StatCard';
import { QuickActions, type QuickAction } from '@/components/dashboard/QuickActions';
import dynamic from 'next/dynamic';
import { Card, Tag, Timeline, Typography, ConfigProvider, theme as antdTheme, message } from 'antd';
import {
  UserOutlined,
  UserAddOutlined,
  ApartmentOutlined,
  SafetyOutlined,
  SettingOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/http/apiClient';
import { getApiErrorMessage } from '@/lib/http/apiError';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingState } from '@/components/shared/LoadingState';
import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/constants/roles.constants';
import { formatDateTime } from '@/lib/utils';

const SuperAdminDashboardCharts = dynamic(
  () =>
    import('@/components/super-admin/SuperAdminDashboardCharts').then(
      mod => mod.SuperAdminDashboardCharts
    ),
  {
    ssr: false,
    loading: () => <LoadingState size="md" className="min-h-[520px]" text="Đang tải biểu đồ..." />,
  }
);

const { Title, Text } = Typography;

export default function SuperAdminDashboard() {
  const { theme } = useTheme();
  const { user, isLoading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState('Super Admin');
  const [stats, setStats] = useState({
    totalAccounts: 0,
    totalPersonnel: 0,
    totalUnits: 0,
    totalLogs: 0,
    recentActivity: 0,
    newAccounts30d: 0,
  });
  const [chartData, setChartData] = useState({
    roleDistribution: [],
    dailyActivity: [],
    logsByAction: [],
    newAccountsByDate: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        if (user) {
          const name = (user.ho_ten || '').trim();
          const role = (user.role || '').toUpperCase();
          setDisplayName(name || ROLE_LABELS[role]);
        }
        const statisticsRes = await apiClient.getDashboardStatistics();

        if (statisticsRes.success && statisticsRes.data) {
          const data = statisticsRes.data;
          const dailyActivity: Array<{ date: string; count: number }> = data.dailyActivity || [];
          const newAccountsByDate: Array<{ date: string; count: number }> =
            data.newAccountsByDate || [];
          const recentActivity = dailyActivity.reduce((sum, item) => sum + (item.count || 0), 0);
          const newAccounts30d = newAccountsByDate.reduce(
            (sum, item) => sum + (item.count || 0),
            0
          );
          setStats({
            totalAccounts: data.totalAccounts || 0,
            totalPersonnel: data.totalPersonnel || 0,
            totalUnits: data.totalUnits || 0,
            totalLogs: data.totalLogs || 0,
            recentActivity,
            newAccounts30d,
          });
          setChartData({
            roleDistribution: data.roleDistribution || [],
            dailyActivity: data.dailyActivity || [],
            logsByAction: data.logsByAction || [],
            newAccountsByDate: data.newAccountsByDate || [],
          });
        }
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, 'Không tải được dữ liệu dashboard'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, user]);

  const statCards: Array<{
    title: string;
    value: ReactNode;
    icon: ReactNode;
    color: StatCardColor;
    link: string;
  }> = [
    {
      title: 'Tổng tài khoản',
      value: stats.totalAccounts,
      icon: <UserOutlined />,
      color: 'blue',
      link: '/super-admin/accounts',
    },
    {
      title: 'Tài khoản mới (30 ngày)',
      value: stats.newAccounts30d,
      icon: <UserAddOutlined />,
      color: 'green',
      link: '/super-admin/accounts',
    },
    {
      title: 'Hoạt động (7 ngày)',
      value: stats.recentActivity,
      icon: <ClockCircleOutlined />,
      color: 'orange',
      link: '/super-admin/system-logs',
    },
    {
      title: 'Nhật ký hệ thống',
      value: stats.totalLogs,
      icon: <FileTextOutlined />,
      color: 'purple',
      link: '/super-admin/system-logs',
    },
  ];

  const quickActions: QuickAction[] = [
    {
      href: '/super-admin/accounts',
      icon: <UserOutlined />,
      label: 'Quản lý tài khoản',
    },
    { href: '/super-admin/accounts/create', icon: <UserAddOutlined />, label: 'Tạo tài khoản mới' },
    { href: '/super-admin/system-logs', icon: <FileTextOutlined />, label: 'Nhật ký hệ thống' },
    {
      href: '/super-admin/categories',
      icon: <ApartmentOutlined />,
      label: 'Quản lý cơ quan đơn vị',
    },
  ];

  if (loading) {
    return <LoadingState fullPage text="Đang tải thống kê..." />;
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div style={{ padding: '24px' }}>
        <PageBreadcrumb items={[{ title: 'Tổng quan' }]} />

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <Title
            level={2}
            className="!mb-3 !text-4xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-purple-400"
          >
            Xin chào, {displayName}
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: '4px', fontSize: 16 }}>
            Bảng điều khiển hệ thống · Toàn quyền quản trị
          </Text>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
            alignItems: 'stretch',
          }}
        >
          {statCards.map((stat, index) => {
            const isNumber = typeof stat.value === 'number';
            const displayValue =
              loading && isNumber
                ? '...'
                : isNumber
                  ? (stat.value as number).toLocaleString()
                  : stat.value;
            return (
              <StatCard
                key={index}
                icon={stat.icon}
                label={stat.title}
                value={displayValue}
                isDark={theme === 'dark'}
                {...getStatCardPalette(stat.color)}
                link={stat.link}
              />
            );
          })}
        </div>

        {/* Charts Section */}
        <SuperAdminDashboardCharts chartData={chartData} theme={theme} />

        {/* Quick Actions */}
        <QuickActions actions={quickActions} />

        {/* System Info */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
          <Card
            style={{
              borderRadius: 10,
              boxShadow:
                theme === 'dark' ? '0 1px 6px rgba(0,0,0,0.35)' : '0 1px 4px rgba(0,0,0,0.06)',
            }}
            styles={{ body: { padding: '0 20px' } }}
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SafetyOutlined style={{ color: '#3b82f6' }} />
                <span style={{ fontWeight: 600 }}>Thông tin hệ thống</span>
              </span>
            }
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 0',
                  borderBottom: `1px solid ${theme === 'dark' ? '#374151' : '#f3f4f6'}`,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: theme === 'dark' ? 'rgba(139,92,246,0.2)' : '#f3e8ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <UserOutlined
                    style={{ color: theme === 'dark' ? '#a78bfa' : '#7c3aed', fontSize: 15 }}
                  />
                </div>
                <div>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Vai trò
                  </Text>
                  <Tag color="purple" style={{ fontSize: 13, padding: '2px 10px', margin: 0 }}>
                    {ROLE_LABELS[user?.role?.toUpperCase() || ''] || displayName}
                  </Tag>
                </div>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 0' }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: theme === 'dark' ? 'rgba(16,185,129,0.15)' : '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <SettingOutlined
                    style={{ color: theme === 'dark' ? '#34d399' : '#16a34a', fontSize: 15 }}
                  />
                </div>
                <div>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Quyền hạn
                  </Text>
                  <Text style={{ fontSize: 13 }}>
                    Toàn quyền quản lý tài khoản, nhật ký hệ thống và cấu hình
                  </Text>
                </div>
              </div>
            </div>
          </Card>

          <Card
            style={{
              borderRadius: 10,
              boxShadow:
                theme === 'dark' ? '0 1px 6px rgba(0,0,0,0.35)' : '0 1px 4px rgba(0,0,0,0.06)',
            }}
            styles={{ body: { padding: '20px' } }}
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClockCircleOutlined style={{ color: '#10b981' }} />
                <span style={{ fontWeight: 600 }}>Hoạt động gần đây</span>
              </span>
            }
          >
            <Timeline
              items={[
                {
                  color: 'blue',
                  children: (
                    <div>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
                      >
                        <ClockCircleOutlined style={{ fontSize: 12, color: '#6b7280' }} />
                        <Text
                          type="secondary"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          Thời gian đăng nhập
                        </Text>
                      </div>
                      <Text strong style={{ fontSize: 13 }}>
                        {formatDateTime(new Date())}
                      </Text>
                    </div>
                  ),
                },
                {
                  color: 'green',
                  children: (
                    <div>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
                      >
                        <CheckCircleOutlined style={{ fontSize: 12, color: '#6b7280' }} />
                        <Text
                          type="secondary"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          Trạng thái hệ thống
                        </Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#22c55e',
                            boxShadow: '0 0 0 3px rgba(34,197,94,0.2)',
                          }}
                        />
                        <Text style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>
                          Hoạt động bình thường
                        </Text>
                      </div>
                    </div>
                  ),
                },
                {
                  color: 'gray',
                  children: (
                    <div>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
                      >
                        <UserOutlined style={{ fontSize: 12, color: '#6b7280' }} />
                        <Text
                          type="secondary"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          Phiên làm việc
                        </Text>
                      </div>
                      <Text style={{ fontSize: 13 }}>{user?.username || displayName}</Text>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </ConfigProvider>
  );
}
