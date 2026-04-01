'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Card,
  Breadcrumb,
  Typography,
  ConfigProvider,
  theme as antdTheme,
  Spin,
} from 'antd';
import {
  UserOutlined,
  SafetyOutlined,
  SettingOutlined,
  FundOutlined,
  BankOutlined,
  FileTextOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/constants/roles.constants';

const SuperAdminDashboardCharts = dynamic(
  () => import('@/components/super-admin/SuperAdminDashboardCharts'),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[520px] items-center justify-center py-8">
        <Spin size="large" />
      </div>
    ),
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

        // Lấy tên hiển thị từ AuthContext (ưu tiên họ tên, rồi username, rồi vai trò)
        if (user) {
          const name = (user.ho_ten || '').trim();
          const username = (user.username || '').trim();
          const role = (user.role || '').toUpperCase();
          setDisplayName(name || username || ROLE_LABELS[role] || 'Super Admin');
        }
        const statisticsRes = await apiClient.getDashboardStatistics();

        if (statisticsRes.success && statisticsRes.data) {
          const data = statisticsRes.data;
          setStats({
            totalAccounts: data.totalAccounts || 0,
            totalPersonnel: data.totalPersonnel || 0,
            totalUnits: data.totalUnits || 0,
            totalLogs: data.totalLogs || 0,
            recentActivity: 0,
          });
          setChartData({
            roleDistribution: data.roleDistribution || [],
            dailyActivity: data.dailyActivity || [],
            logsByAction: data.logsByAction || [],
            newAccountsByDate: data.newAccountsByDate || [],
          });
        }
      } catch (error) {
        // Error handled by UI
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, user]);

  const statCards = [
    {
      title: 'Tổng tài khoản',
      value: stats.totalAccounts,
      icon: UserOutlined,
      bgColor: theme === 'dark' ? 'rgba(14, 165, 233, 0.2)' : '#e0f2fe',
      iconColor: theme === 'dark' ? '#38bdf8' : '#0284c7',
      link: '/super-admin/accounts',
    },
    {
      title: 'Quản lý tài khoản',
      value: 'Xem',
      icon: SafetyOutlined,
      bgColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
      iconColor: theme === 'dark' ? '#4ade80' : '#16a34a',
      link: '/super-admin/accounts',
    },
    {
      title: 'Nhật ký hệ thống',
      value: stats.totalLogs,
      icon: FileTextOutlined,
      bgColor: theme === 'dark' ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff',
      iconColor: theme === 'dark' ? '#c084fc' : '#9333ea',
      link: '/super-admin/system-logs',
    },
    {
      title: 'Tạo tài khoản mới',
      value: '+',
      icon: FundOutlined,
      bgColor: theme === 'dark' ? 'rgba(249, 115, 22, 0.2)' : '#fed7aa',
      iconColor: theme === 'dark' ? '#fb923c' : '#ea580c',
      link: '/super-admin/accounts/create',
    },
  ];

  const quickActions = [
    {
      title: 'Quản lý tài khoản',
      description: 'Xem danh sách và quản lý tài khoản người dùng',
      icon: UserOutlined,
      iconColor: theme === 'dark' ? '#38bdf8' : '#0284c7',
      bgColor: theme === 'dark' ? 'rgba(14, 165, 233, 0.2)' : '#e0f2fe',
      link: '/super-admin/accounts',
    },
    {
      title: 'Tạo tài khoản mới',
      description: 'Thêm tài khoản và quân nhân mới vào hệ thống',
      icon: SafetyOutlined,
      iconColor: theme === 'dark' ? '#4ade80' : '#16a34a',
      bgColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
      link: '/super-admin/accounts/create',
    },
    {
      title: 'Nhật ký hệ thống',
      description: 'Xem lịch sử hoạt động và thay đổi trong hệ thống',
      icon: FileTextOutlined,
      iconColor: theme === 'dark' ? '#c084fc' : '#9333ea',
      bgColor: theme === 'dark' ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff',
      link: '/super-admin/system-logs',
    },
    {
      title: 'Cài đặt hệ thống',
      description: 'Quản lý cấu hình và thiết lập hệ thống',
      icon: BankOutlined,
      iconColor: theme === 'dark' ? '#fb923c' : '#ea580c',
      bgColor: theme === 'dark' ? 'rgba(249, 115, 22, 0.2)' : '#fed7aa',
      link: '/super-admin/dashboard',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div style={{ padding: '24px' }}>
        {/* Breadcrumb */}
        <Breadcrumb style={{ marginBottom: '24px' }}>
          <Breadcrumb.Item>Dashboard</Breadcrumb.Item>
        </Breadcrumb>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <Title level={1} style={{ margin: 0 }}>
            Xin chào, Quản trị viên cấp cao
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: '4px' }}>
            Bảng điều khiển hệ thống
          </Text>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {statCards.map((stat, index) => {
            const IconComponent = stat.icon;
            const isNumber = typeof stat.value === 'number';
            return (
              <Link key={index} href={stat.link}>
                <Card hoverable style={{ cursor: 'pointer' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <Text
                        type="secondary"
                        style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}
                      >
                        {stat.title}
                      </Text>
                      <div style={{ fontSize: '28px', fontWeight: 'bold' }}>
                        {loading && isNumber ? '...' : stat.value}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '12px',
                        backgroundColor: stat.bgColor,
                        borderRadius: '8px',
                      }}
                    >
                      <IconComponent style={{ fontSize: '24px', color: stat.iconColor }} />
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#6b7280',
                      fontSize: '14px',
                    }}
                  >
                    <ArrowRightOutlined style={{ fontSize: '16px' }} />
                    <span>Truy cập</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Charts Section */}
        <SuperAdminDashboardCharts chartData={chartData} theme={theme} />

        {/* Quick Actions */}
        <div>
          <Title level={2} style={{ marginBottom: '16px' }}>
            Thao tác nhanh
          </Title>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {quickActions.map((action, index) => {
              const IconComponent = action.icon;
              return (
                <Link key={index} href={action.link}>
                  <Card hoverable style={{ cursor: 'pointer', height: '100%' }}>
                    <div
                      style={{
                        padding: '12px',
                        backgroundColor: action.bgColor,
                        borderRadius: '8px',
                        width: 'fit-content',
                        marginBottom: '16px',
                      }}
                    >
                      <IconComponent style={{ fontSize: '24px', color: action.iconColor }} />
                    </div>
                    <Title level={4} style={{ marginBottom: '8px' }}>
                      {action.title}
                    </Title>
                    <Text
                      type="secondary"
                      style={{ fontSize: '14px', display: 'block', marginBottom: '16px' }}
                    >
                      {action.description}
                    </Text>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#0284c7',
                        fontSize: '14px',
                      }}
                    >
                      <span>Truy cập</span>
                      <ArrowRightOutlined style={{ fontSize: '16px' }} />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* System Info */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '24px' }}>
            <div style={{ padding: '8px', backgroundColor: '#dcfce7', borderRadius: '8px' }}>
              <SettingOutlined style={{ fontSize: '20px', color: '#16a34a' }} />
            </div>
            <div>
              <Title level={4} style={{ marginBottom: '8px' }}>
                Quyền quản trị Super Admin
              </Title>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                Bạn có toàn quyền quản lý hệ thống, bao gồm tài khoản, quân nhân, đơn vị và xem nhật
                ký hoạt động. Vui lòng sử dụng các quyền này một cách cẩn thận và có trách nhiệm.
              </Text>
            </div>
          </div>
        </Card>
      </div>
    </ConfigProvider>
  );
}
