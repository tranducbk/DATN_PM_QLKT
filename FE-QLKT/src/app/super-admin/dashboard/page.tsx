'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Breadcrumb,
  Typography,
  ConfigProvider,
  theme as antdTheme,
  Row,
  Col,
  Spin,
} from 'antd';
import {
  UserOutlined,
  SafetyOutlined,
  SettingOutlined,
  FundOutlined,
  BankOutlined,
  FileTextOutlined,
  RiseOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { getActionLabel } from '@/components/system-logs/constants';
import { ROLE_LABELS } from '@/constants/roles.constants';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  ChartTitle,
  Tooltip,
  Legend,
  Filler
);

const { Title, Text } = Typography;

export default function SuperAdminDashboard() {
  const { theme } = useTheme();
  const { user } = useAuth();
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
  }, []);

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

  // Chart options với dark mode support
  const isDark = theme === 'dark';
  const textColor = isDark ? '#e5e7eb' : '#374151';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  // Doughnut chart - Phân bố vai trò
  const roleChartData = {
    labels:
      chartData.roleDistribution.length > 0
        ? chartData.roleDistribution.map(
            (item: any) => ROLE_LABELS[item.role] || item.role
          )
        : ['Chưa có dữ liệu'],
    datasets: [
      {
        label: 'Số lượng',
        data:
          chartData.roleDistribution.length > 0
            ? chartData.roleDistribution.map((item: any) => item.count)
            : [0],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
        ],
        borderColor: [
          'rgba(239, 68, 68, 1)',
          'rgba(249, 115, 22, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(34, 197, 94, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const roleChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: textColor,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: 'Phân bố vai trò',
        color: textColor,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 10,
        },
      },
    },
  };

  // Line chart - Hoạt động hệ thống theo ngày
  const activityChartData = {
    labels:
      chartData.dailyActivity.length > 0
        ? chartData.dailyActivity.map((item: any) => {
            const date = new Date(item.date);
            return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
          })
        : [],
    datasets: [
      {
        label: 'Số lượng hoạt động',
        data:
          chartData.dailyActivity.length > 0
            ? chartData.dailyActivity.map((item: any) => item.count)
            : [],
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const activityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: textColor,
        },
      },
      title: {
        display: true,
        text: 'Hoạt động hệ thống (7 ngày gần nhất)',
        color: textColor,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 10,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: textColor,
          stepSize: 1,
        },
        grid: {
          color: gridColor,
        },
      },
      x: {
        ticks: {
          color: textColor,
        },
        grid: {
          color: gridColor,
        },
      },
    },
  };

  // Bar chart - Logs theo hành động
  // Mapping action sang tiếng Việt

  const logsChartData = {
    labels:
      chartData.logsByAction.length > 0
        ? chartData.logsByAction.map((item: any) => {
            // Map action sang tiếng Việt
            const label = getActionLabel(item.action?.toUpperCase() || '');
            return label.length > 20 ? label.substring(0, 20) + '...' : label;
          })
        : ['Chưa có dữ liệu'],
    datasets: [
      {
        label: 'Số lượng',
        data:
          chartData.logsByAction.length > 0
            ? chartData.logsByAction.map((item: any) => item.count)
            : [0],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        borderRadius: 4,
        maxBarThickness: 60,
      },
    ],
  };

  const logsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Top 10 hành động phổ biến',
        color: textColor,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 10,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Số lượng',
          color: textColor,
          font: {
            size: 14,
            weight: 'bold' as const,
          },
        },
        ticks: {
          color: textColor,
          stepSize: 1,
        },
        grid: {
          color: gridColor,
        },
      },
      x: {
        title: {
          display: true,
          text: 'Hành động',
          color: textColor,
          font: {
            size: 14,
            weight: 'bold' as const,
          },
        },
        ticks: {
          color: textColor,
          maxRotation: 45,
          minRotation: 45,
        },
        grid: {
          display: false,
        },
      },
    },
  };

  // Area chart - Tài khoản mới theo thời gian
  const accountsChartData = {
    labels:
      chartData.newAccountsByDate.length > 0
        ? chartData.newAccountsByDate.map((item: any) => {
            const date = new Date(item.date);
            return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
          })
        : [],
    datasets: [
      {
        label: 'Tài khoản mới',
        data:
          chartData.newAccountsByDate.length > 0
            ? chartData.newAccountsByDate.map((item: any) => item.count)
            : [],
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: 'rgba(34, 197, 94, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const accountsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: textColor,
        },
      },
      title: {
        display: true,
        text: 'Tài khoản mới (30 ngày gần nhất)',
        color: textColor,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          bottom: 10,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: textColor,
          stepSize: 1,
        },
        grid: {
          color: gridColor,
        },
      },
      x: {
        ticks: {
          color: textColor,
        },
        grid: {
          color: gridColor,
        },
      },
    },
  };

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
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card>
              <div style={{ height: '250px' }}>
                <Doughnut data={roleChartData} options={roleChartOptions} />
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card>
              <div style={{ height: '250px' }}>
                <Line data={activityChartData} options={activityChartOptions} />
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card>
              <div style={{ height: '250px' }}>
                <Bar data={logsChartData} options={logsChartOptions} />
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card>
              <div style={{ height: '250px' }}>
                <Line data={accountsChartData} options={accountsChartOptions} />
              </div>
            </Card>
          </Col>
        </Row>

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
