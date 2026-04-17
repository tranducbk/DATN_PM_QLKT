'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Button,
  Space,
  Breadcrumb,
  ConfigProvider,
  theme as antdTheme,
  Row,
  Col,
  Skeleton,
  Spin,
  message,
} from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  ApartmentOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/apiClient';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDateTime } from '@/lib/utils';
import { PROPOSAL_STATUS_LABELS, PROPOSAL_TYPE_LABELS } from '@/constants/proposal.constants';
import { ROLE_LABELS } from '@/constants/roles.constants';
import { THANH_TICH_KHOA_HOC_SHORT_LABELS } from '@/constants/danhHieu.constants';

const { Title } = Typography;

const chartLoading = () => (
  <div className="flex min-h-[220px] items-center justify-center py-6">
    <Spin size="large" />
  </div>
);

const ActionBarChart = dynamic(
  () => import('@/components/charts/ActionBarChart').then(m => ({ default: m.ActionBarChart })),
  { ssr: false, loading: chartLoading }
);
const ActivityLineChart = dynamic(
  () => import('@/components/charts/ActivityLineChart').then(m => ({ default: m.ActivityLineChart })),
  { ssr: false, loading: chartLoading }
);
const PieChart = dynamic(
  () => import('@/components/charts/PieChart').then(m => ({ default: m.PieChart })),
  { ssr: false, loading: chartLoading }
);

export default function AdminDashboard() {
  const { theme } = useTheme();
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('Admin');
  const [stats, setStats] = useState({
    totalPersonnel: 0,
    totalUnits: 0,
    totalPositions: 0,
    pendingApprovals: 0,
  });
  const [chartData, setChartData] = useState({
    scientificAchievementsByType: [],
    proposalsByType: [],
    proposalsByStatus: [],
    scientificAchievementsByMonth: [],
  });

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);

        // Priority: full name > username > role label
        if (user) {
          const name = (user.ho_ten || '').trim();
          const username = (user.username || '').trim();
          const role = (user.role || '').toUpperCase();
          setDisplayName(name || username || ROLE_LABELS[role] || 'Admin');
        }

        const statisticsRes = await apiClient.getAdminDashboardStatistics();

        if (statisticsRes.success && statisticsRes.data) {
          setStats({
            totalPersonnel: statisticsRes.data.totalPersonnel || 0,
            totalUnits: statisticsRes.data.totalUnits || 0,
            totalPositions: statisticsRes.data.totalPositions || 0,
            pendingApprovals: statisticsRes.data.pendingApprovals || 0,
          });

          setChartData({
            scientificAchievementsByType: statisticsRes.data.scientificAchievementsByType || [],
            proposalsByType: statisticsRes.data.proposalsByType || [],
            proposalsByStatus: statisticsRes.data.proposalsByStatus || [],
            scientificAchievementsByMonth: statisticsRes.data.scientificAchievementsByMonth || [],
          });
        }
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, 'Không tải được dữ liệu dashboard'));
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [authLoading, user]);

  const statCards = [
    {
      title: 'Tổng số Quân nhân',
      value: stats.totalPersonnel,
      icon: TeamOutlined,
      iconColor: theme === 'dark' ? 'text-blue-400' : 'text-blue-600',
      bgColor:
        theme === 'dark'
          ? 'bg-gradient-to-br from-blue-900/30 to-blue-800/20'
          : 'bg-gradient-to-br from-blue-50 to-blue-100',
      link: '/admin/personnel',
    },
    {
      title: 'Tổng số Đơn vị',
      value: stats.totalUnits,
      icon: ApartmentOutlined,
      iconColor: theme === 'dark' ? 'text-green-400' : 'text-green-600',
      bgColor:
        theme === 'dark'
          ? 'bg-gradient-to-br from-green-900/30 to-green-800/20'
          : 'bg-gradient-to-br from-green-50 to-green-100',
      link: '/admin/categories',
    },
    {
      title: 'Tổng số Chức vụ',
      value: stats.totalPositions,
      icon: FileTextOutlined,
      iconColor: theme === 'dark' ? 'text-purple-400' : 'text-purple-600',
      bgColor:
        theme === 'dark'
          ? 'bg-gradient-to-br from-purple-900/30 to-purple-800/20'
          : 'bg-gradient-to-br from-purple-50 to-purple-100',
      link: '/admin/positions',
    },
    {
      title: 'Đề xuất chờ duyệt',
      value: stats.pendingApprovals,
      icon: CheckCircleOutlined,
      iconColor: theme === 'dark' ? 'text-orange-400' : 'text-orange-600',
      bgColor:
        theme === 'dark'
          ? 'bg-gradient-to-br from-orange-900/30 to-orange-800/20'
          : 'bg-gradient-to-br from-orange-50 to-orange-100',
      link: '/admin/proposals/review',
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div className="space-y-8 p-6 animate-in fade-in duration-500">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { title: <Link href="/admin/dashboard"><HomeOutlined /></Link> },
            { title: 'Tổng quan' },
          ]}
        />

        {/* Header */}
        <div className="mb-2">
          <Title
            level={2}
            className="!mb-3 !text-4xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-purple-400"
          >
            Xin chào, {displayName}
          </Title>
          <p className={`text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Quản lý toàn bộ dữ liệu quân nhân và danh mục của hệ thống
          </p>
        </div>

        {/* Statistics Cards */}
        {loading ? (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="shadow-lg">
                  <Skeleton active paragraph={{ rows: 1 }} />
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              {[1, 2, 3].map(i => (
                <Card key={i} className="shadow-lg">
                  <Skeleton active paragraph={{ rows: 6 }} />
                </Card>
              ))}
            </div>
            <Skeleton active paragraph={{ rows: 4 }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Link key={index} href={stat.link}>
                  <Card className="shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1 overflow-hidden">
                    <div className="flex items-center justify-between p-1">
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium uppercase tracking-wide ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}
                        >
                          {stat.title}
                        </p>
                        <p
                          className={`text-4xl font-bold mt-2 ${
                            theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                          }`}
                        >
                          {stat.value.toLocaleString()}
                        </p>
                      </div>
                      <div
                        className={`w-14 h-14 rounded-2xl ${stat.bgColor} shadow-inner flex-shrink-0 flex items-center justify-center`}
                      >
                        <Icon className={stat.iconColor} style={{ fontSize: '28px' }} />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && (
          <>
            {/* Charts Section */}
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col xs={24} lg={8}>
                <PieChart
                  data={chartData.scientificAchievementsByType.map((item: any) => ({
                    label: THANH_TICH_KHOA_HOC_SHORT_LABELS[item.type] || item.type,
                    value: item.count,
                  }))}
                  title="Thành tích NCKH theo loại"
                  colors={['rgba(59, 130, 246, 0.8)', 'rgba(34, 197, 94, 0.8)']}
                />
              </Col>
              <Col xs={24} lg={8}>
                <PieChart
                  data={chartData.proposalsByType.map((item: any) => ({
                    label: PROPOSAL_TYPE_LABELS[item.type] || item.type,
                    value: item.count,
                  }))}
                  title="Đề xuất theo loại (7 ngày gần nhất)"
                />
              </Col>
              <Col xs={24} lg={8}>
                <ActionBarChart
                  data={chartData.proposalsByStatus.map((item: any) => ({
                    action: item.status,
                    count: item.count,
                  }))}
                  title="Đề xuất theo trạng thái"
                  labelMapper={(label: string) => PROPOSAL_STATUS_LABELS[label] || label}
                  color="rgba(249, 115, 22, 1)"
                />
              </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col xs={24} lg={12}>
                <ActivityLineChart
                  data={chartData.scientificAchievementsByMonth.map((item: any) => ({
                    date: item.month,
                    count: item.count,
                  }))}
                  title="Thành tích NCKH (6 tháng gần nhất)"
                  label="Số lượng thành tích"
                  color="rgba(34, 197, 94, 1)"
                />
              </Col>
              <Col xs={24} lg={12}>
                <ActionBarChart
                  data={chartData.proposalsByType.map((item: any) => ({
                    action: item.type,
                    count: item.count,
                  }))}
                  title="Đề xuất theo loại (7 ngày gần nhất)"
                  maxLabelLength={20}
                  labelMapper={(label: string) => PROPOSAL_TYPE_LABELS[label] || label}
                  color="rgba(59, 130, 246, 1)"
                />
              </Col>
            </Row>

            {/* Quick Actions */}
            <Card
              title={<span className="text-lg font-semibold">Thao tác nhanh</span>}
              className="shadow-lg"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/admin/personnel">
                  <Button
                    type="primary"
                    icon={<TeamOutlined />}
                    size="large"
                    className="w-full h-auto py-4 text-base font-medium hover:scale-105 transition-transform"
                  >
                    Quản lý Quân nhân
                  </Button>
                </Link>
                <Link href="/admin/categories">
                  <Button
                    icon={<ApartmentOutlined />}
                    size="large"
                    className="w-full h-auto py-4 text-base font-medium hover:scale-105 transition-transform"
                  >
                    Quản lý Cơ quan Đơn vị
                  </Button>
                </Link>
                <Link href="/admin/positions">
                  <Button
                    icon={<FileTextOutlined />}
                    size="large"
                    className="w-full h-auto py-4 text-base font-medium hover:scale-105 transition-transform"
                  >
                    Quản lý Chức vụ
                  </Button>
                </Link>
                <Link href="/admin/personnel/create">
                  <Button
                    icon={<PlusOutlined />}
                    size="large"
                    type="dashed"
                    className="w-full h-auto py-4 text-base font-medium hover:scale-105 transition-transform border-2 hover:border-blue-500"
                  >
                    Thêm Quân nhân
                  </Button>
                </Link>
              </div>
            </Card>

            {/* System Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                title={<span className="text-lg font-semibold">Thông tin hệ thống</span>}
                className="shadow-lg"
              >
                <div className="space-y-4">
                  <div
                    className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}
                  >
                    <p
                      className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                    >
                      Vai trò
                    </p>
                    <p
                      className={`text-lg font-semibold ${
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      }`}
                    >
                      Phòng Chính trị
                    </p>
                  </div>
                  <div
                    className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}
                  >
                    <p
                      className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                    >
                      Quyền hạn
                    </p>
                    <p
                      className={`text-base ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      Quản lý quân nhân, đơn vị, chức vụ, nhóm cống hiến
                    </p>
                  </div>
                </div>
              </Card>

              <Card
                title={<span className="text-lg font-semibold">Hoạt động gần đây</span>}
                className="shadow-lg"
              >
                <div className="space-y-4">
                  <div
                    className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}
                  >
                    <p
                      className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                    >
                      Thời gian truy cập
                    </p>
                    <p
                      className={`text-base font-medium ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      {formatDateTime(new Date())}
                    </p>
                  </div>
                  <div
                    className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}
                  >
                    <p
                      className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
                    >
                      Trạng thái hệ thống
                    </p>
                    <p className={`text-base font-medium text-green-600 dark:text-green-400`}>
                      Hoạt động bình thường
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </ConfigProvider>
  );
}
