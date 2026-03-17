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
  Spin,
} from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useTheme } from '@/components/theme-provider';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import { formatDateTime } from '@/lib/utils';
import '@/lib/chart-config';
import { ActionBarChart, ActivityLineChart, PieChart } from '@/components/charts';

const { Title } = Typography;

export default function AdminDashboard() {
  const { theme } = useTheme();
  const { user } = useAuth();
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
    const fetchStats = async () => {
      try {
        setLoading(true);

        // Lấy tên hiển thị từ AuthContext (ưu tiên họ tên, rồi username, rồi vai trò)
        if (user) {
          const name = (user.ho_ten || '').trim();
          const username = (user.username || '').trim();
          const role = (user.role || '').toUpperCase();
          const roleDisplayMap: Record<string, string> = {
            SUPER_ADMIN: 'Super Admin',
            ADMIN: 'Quản trị viên',
            MANAGER: 'Trưởng phòng',
            USER: 'Người dùng',
          };
          setDisplayName(name || username || roleDisplayMap[role] || 'Admin');
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
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

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
            { title: <Link href="/admin/dashboard">Dashboard</Link> },
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
          <div className="flex justify-center items-center min-h-screen">
            <Spin size="large" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Link key={index} href={stat.link}>
                  <Card className="shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1 overflow-hidden">
                    <div className="flex items-center justify-between p-1">
                      <div className="flex-1">
                        <p
                          className={`text-sm mb-2 font-medium uppercase tracking-wide ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}
                        >
                          {stat.title}
                        </p>
                        <p
                          className={`text-4xl font-bold mb-1 ${
                            theme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                          }`}
                        >
                          {stat.value.toLocaleString()}
                        </p>
                      </div>
                      <div className={`p-4 rounded-2xl ${stat.bgColor} shadow-inner`}>
                        <Icon className={`h-8 w-8 ${stat.iconColor}`} />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Charts Section */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={8}>
            <PieChart
              data={chartData.scientificAchievementsByType.map((item: any) => ({
                label: item.type === 'DTKH' ? 'ĐTKH' : 'SKKH',
                value: item.count,
              }))}
              title="Thành tích khoa học theo loại"
              colors={['rgba(59, 130, 246, 0.8)', 'rgba(34, 197, 94, 0.8)']}
            />
          </Col>
          <Col xs={24} lg={8}>
            <PieChart
              data={chartData.proposalsByType.map((item: any) => ({
                label: (() => {
                  const proposalTypeMap: Record<string, string> = {
                    CA_NHAN_HANG_NAM: 'Cá nhân Hằng năm',
                    DON_VI_HANG_NAM: 'Đơn vị Hằng năm',
                    NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
                    CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
                    DOT_XUAT: 'Đột xuất',
                    NCKH: 'ĐTKH/SKKH',
                    HC_QKQT: 'Huy chương Quân kỳ',
                    KNC_VSNXD_QDNDVN: 'Kỷ niệm chương',
                  };
                  return proposalTypeMap[item.type] || item.type;
                })(),
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
              labelMapper={(label: string) => {
                const statusMap: Record<string, string> = {
                  PENDING: 'Đang chờ phê duyệt',
                  APPROVED: 'Đã phê duyệt',
                  REJECTED: 'Đã từ chối',
                };
                return statusMap[label] || label;
              }}
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
              title="Thành tích khoa học (6 tháng gần nhất)"
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
              labelMapper={(label: string) => {
                const proposalTypeMap: Record<string, string> = {
                  CA_NHAN_HANG_NAM: 'Cá nhân Hằng năm',
                  DON_VI_HANG_NAM: 'Đơn vị Hằng năm',
                  NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
                  CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
                  DOT_XUAT: 'Đột xuất',
                  NCKH: 'ĐTKH/SKKH',
                  HC_QKQT: 'Huy chương Quân kỳ quyết thắng',
                  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương VSNXD QĐNDVN',
                };
                return proposalTypeMap[label] || label;
              }}
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
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Vai trò
                </p>
                <p
                  className={`text-lg font-semibold ${
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  }`}
                >
                  Quản trị viên (Admin)
                </p>
              </div>
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Quyền hạn
                </p>
                <p className={`text-base ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Quản lý quân nhân, đơn vị, chức vụ, nhóm công hiến
                </p>
              </div>
            </div>
          </Card>

          <Card
            title={<span className="text-lg font-semibold">Hoạt động gần đây</span>}
            className="shadow-lg"
          >
            <div className="space-y-4">
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
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
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Trạng thái hệ thống
                </p>
                <p className={`text-base font-medium text-green-600 dark:text-green-400`}>
                  Hoạt động bình thường
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </ConfigProvider>
  );
}
