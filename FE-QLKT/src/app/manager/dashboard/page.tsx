'use client';

import { useState, useEffect, type ReactNode } from 'react';
import {
  Card,
  Typography,
  Button,
  Space,
  Tag,
  Timeline,
  Breadcrumb,
  ConfigProvider,
  theme as antdTheme,
  Row,
  Col,
  Skeleton,
  Spin,
} from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  TrophyOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  HomeOutlined,
  UserOutlined,
  SafetyOutlined,
  SafetyCertificateOutlined,
  ExperimentOutlined,
  ClockCircleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTheme } from '@/components/ThemeProvider';
import {
  StatCard,
  getStatCardPalette,
  type StatCardColor,
} from '@/components/dashboard/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/apiClient';
import { formatDateTime } from '@/lib/utils';
import {
  isProposalType,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_TYPE_LABELS,
} from '@/constants/proposal.constants';
import { ROLE_LABELS, ROLE_COLORS } from '@/constants/roles.constants';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_MAP,
  THANH_TICH_KHOA_HOC_SHORT_LABELS,
} from '@/constants/danhHieu.constants';

const { Title, Text } = Typography;

interface CountByKey {
  count: number;
}
interface AwardByType extends CountByKey { type: string; }
interface ProposalByStatus extends CountByKey { status: string; }
interface ProposalByType extends CountByKey { type: string; }
interface AchievementByType extends CountByKey { type: string; }
interface AwardByMonth extends CountByKey { month: string; }
interface AchievementByMonth extends CountByKey { month: string; }
interface PersonnelByRank extends CountByKey { rank: string; }
interface PersonnelByPosition extends CountByKey { positionName: string; }

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
  () =>
    import('@/components/charts/ActivityLineChart').then(m => ({ default: m.ActivityLineChart })),
  { ssr: false, loading: chartLoading }
);
const PieChart = dynamic(
  () => import('@/components/charts/PieChart').then(m => ({ default: m.PieChart })),
  { ssr: false, loading: chartLoading }
);

export default function ManagerDashboard() {
  const { theme } = useTheme();
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('Trưởng phòng');
  const [stats, setStats] = useState({
    totalPersonnel: 0,
    totalCSTDCS: 0,
    totalNCKH: 0,
    totalAwards: 0,
    pendingProposals: 0,
  });
  const [chartData, setChartData] = useState({
    awardsByType: [],
    proposalsByType: [],
    proposalsByStatus: [],
    awardsByMonth: [],
    personnelByRank: [],
    scientificAchievementsByMonth: [],
    scientificAchievementsByType: [],
    personnelByPosition: [],
  });

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);

        if (user) {
          const name = (user.ho_ten || '').trim();
          const role = (user.role || '').toUpperCase();
          setDisplayName(name || ROLE_LABELS[role]);
        }
        const statisticsRes = await apiClient.getManagerDashboardStatistics();

        if (statisticsRes.success && statisticsRes.data) {
          const totalPersonnel = statisticsRes.data.totalPersonnel || 0;

          const totalCSTDCS =
            statisticsRes.data.awardsByType.find(
              (a: { type: string; count: number }) =>
                a.type === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS
            )?.count || 0;
          const totalNCKH =
            statisticsRes.data.scientificAchievementsByType.reduce(
              (sum: number, a: { count: number }) => sum + a.count,
              0
            ) || 0;
          const totalAwards = statisticsRes.data.awardsByType.reduce(
            (sum: number, a: { count: number }) => sum + a.count,
            0
          );
          const pendingProposals =
            statisticsRes.data.proposalsByStatus?.find(
              (p: { status: string; count: number }) => p.status === 'PENDING'
            )?.count || 0;
          setStats({
            totalPersonnel,
            totalCSTDCS,
            totalNCKH,
            totalAwards,
            pendingProposals,
          });
          setChartData({
            awardsByType: statisticsRes.data.awardsByType || [],
            proposalsByType: statisticsRes.data.proposalsByType || [],
            proposalsByStatus: statisticsRes.data.proposalsByStatus || [],
            awardsByMonth: statisticsRes.data.awardsByMonth || [],
            personnelByRank: statisticsRes.data.personnelByRank || [],
            scientificAchievementsByMonth: statisticsRes.data.scientificAchievementsByMonth || [],
            scientificAchievementsByType: statisticsRes.data.scientificAchievementsByType || [],
            personnelByPosition: statisticsRes.data.personnelByPosition || [],
          });
        } else {
          // Statistics API returned unsuccessful response
        }
      } catch (error) {
        // Error handled by fallback values
        setStats({
          totalPersonnel: 0,
          totalCSTDCS: 0,
          totalNCKH: 0,
          totalAwards: 0,
          pendingProposals: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [authLoading, user]);

  const statCards: Array<{
    title: string;
    value: number;
    icon: ReactNode;
    color: StatCardColor;
    link: string;
  }> = [
    {
      title: 'Quân số Đơn vị',
      value: stats.totalPersonnel,
      icon: <TeamOutlined />,
      color: 'blue',
      link: '/manager/personnel',
    },
    {
      title: 'Tổng CSTDCS',
      value: stats.totalCSTDCS,
      icon: <SafetyCertificateOutlined />,
      color: 'green',
      link: '/manager/awards',
    },
    {
      title: 'Tổng NCKH',
      value: stats.totalNCKH,
      icon: <ExperimentOutlined />,
      color: 'yellow',
      link: '/manager/awards',
    },
    {
      title: 'Khen thưởng',
      value: stats.totalAwards,
      icon: <TrophyOutlined />,
      color: 'purple',
      link: '/manager/awards',
    },
    {
      title: 'Đề xuất chờ duyệt',
      value: stats.pendingProposals,
      icon: <ClockCircleOutlined />,
      color: 'orange',
      link: '/manager/proposals',
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
            {
              title: (
                <Link href="/manager/dashboard">
                  <HomeOutlined />
                </Link>
              ),
            },
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
            Quản lý quân nhân và thành tích của đơn vị
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {statCards.map((stat, index) => (
              <StatCard
                key={index}
                icon={stat.icon}
                label={stat.title}
                value={stat.value.toLocaleString()}
                isDark={theme === 'dark'}
                {...getStatCardPalette(stat.color)}
                link={stat.link}
              />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* Charts Section */}
            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col xs={24} lg={8}>
                <PieChart
                  data={chartData.awardsByType.map((item: AwardByType) => ({
                    label: DANH_HIEU_MAP[item.type] || item.type,
                    value: item.count,
                  }))}
                  title="Khen thưởng theo loại"
                />
              </Col>
              <Col xs={24} lg={8}>
                <PieChart
                  data={chartData.proposalsByStatus.map((item: ProposalByStatus) => ({
                    label: PROPOSAL_STATUS_LABELS[item.status] || item.status,
                    value: item.count,
                  }))}
                  title="Đề xuất theo trạng thái"
                  colors={[
                    'rgba(255, 193, 7, 0.8)',
                    'rgba(40, 167, 69, 0.8)',
                    'rgba(220, 53, 69, 0.8)',
                  ]}
                />
              </Col>
              <Col xs={24} lg={8}>
                <ActionBarChart
                  data={chartData.proposalsByType.map((item: ProposalByType) => ({
                    action: item.type,
                    count: item.count,
                  }))}
                  title="Đề xuất theo loại"
                  maxLabelLength={15}
                  labelMapper={(label: string) =>
                    isProposalType(label) ? PROPOSAL_TYPE_LABELS[label] : label
                  }
                  color="rgba(59, 130, 246, 1)"
                />
              </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col xs={24} lg={8}>
                <PieChart
                  data={chartData.scientificAchievementsByType.map((item: AchievementByType) => ({
                    label: THANH_TICH_KHOA_HOC_SHORT_LABELS[item.type] || item.type,
                    value: item.count,
                  }))}
                  title="Thành tích Nghiên cứu khoa học theo loại"
                  colors={['rgba(59, 130, 246, 0.8)', 'rgba(34, 197, 94, 0.8)']}
                />
              </Col>
              <Col xs={24} lg={8}>
                <ActivityLineChart
                  data={chartData.awardsByMonth.map((item: AwardByMonth) => ({
                    date: item.month,
                    count: item.count,
                  }))}
                  title="Khen thưởng theo tháng (6 tháng gần nhất)"
                  label="Số lượng khen thưởng"
                  color="rgba(147, 51, 234, 1)"
                />
              </Col>
              <Col xs={24} lg={8}>
                <ActivityLineChart
                  data={chartData.scientificAchievementsByMonth.map((item: AchievementByMonth) => ({
                    date: item.month,
                    count: item.count,
                  }))}
                  title="Thành tích Nghiên cứu khoa học (6 tháng gần nhất)"
                  label="Số lượng thành tích"
                  color="rgba(34, 197, 94, 1)"
                />
              </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
              <Col xs={24} lg={12}>
                <ActionBarChart
                  data={chartData.personnelByRank.map((item: PersonnelByRank) => ({
                    action: item.rank,
                    count: item.count,
                  }))}
                  title="Quân nhân theo cấp bậc"
                  maxLabelLength={15}
                  color="rgba(234, 179, 8, 1)"
                />
              </Col>
              <Col xs={24} lg={12}>
                <ActionBarChart
                  data={chartData.personnelByPosition.map((item: PersonnelByPosition) => ({
                    action: item.positionName,
                    count: item.count,
                  }))}
                  title="Quân nhân theo chức vụ"
                  maxLabelLength={20}
                  color="rgba(239, 68, 68, 1)"
                />
              </Col>
            </Row>

            {/* Quick Actions */}
            <Card
              title={<span className="text-lg font-semibold">Thao tác nhanh</span>}
              className="shadow-lg"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                {[
                  {
                    href: '/manager/personnel',
                    icon: <TeamOutlined />,
                    label: 'Xem danh sách Quân nhân',
                    primary: true,
                  },
                  {
                    href: '/manager/proposals/create',
                    icon: <PlusOutlined />,
                    label: 'Tạo đề xuất',
                  },
                  {
                    href: '/manager/proposals',
                    icon: <FileTextOutlined />,
                    label: 'Quản lý đề xuất',
                  },
                  {
                    href: '/manager/awards',
                    icon: <TrophyOutlined />,
                    label: 'Khen thưởng đơn vị',
                  },
                ].map(({ href, icon, label, primary }) => (
                  <Link key={href} href={href} className="block h-full">
                    <Button
                      type={primary ? 'primary' : 'default'}
                      icon={icon}
                      size="large"
                      className="w-full h-full min-h-[84px] py-4 text-base font-medium whitespace-normal break-words transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                    >
                      {label}
                    </Button>
                  </Link>
                ))}
              </div>
            </Card>

            {/* System Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                title={
                  <Space>
                    <SafetyOutlined style={{ color: '#3b82f6' }} />
                    <span className="font-semibold">Thông tin hệ thống</span>
                  </Space>
                }
                className="shadow-lg"
                styles={{ body: { padding: '0 20px' } }}
              >
                <div>
                  <div
                    className={`flex items-center gap-4 py-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${theme === 'dark' ? 'bg-blue-900/40' : 'bg-blue-50'}`}
                    >
                      <UserOutlined
                        style={{ color: theme === 'dark' ? '#60a5fa' : '#2563eb', fontSize: 15 }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-medium uppercase tracking-wide mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                      >
                        Vai trò
                      </p>
                      <Tag
                        color={ROLE_COLORS[user?.role || ''] || 'blue'}
                        style={{ fontSize: 13, padding: '2px 10px', margin: 0 }}
                      >
                        {ROLE_LABELS[user?.role?.toUpperCase() || ''] || displayName}
                      </Tag>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 py-4">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${theme === 'dark' ? 'bg-purple-900/40' : 'bg-purple-50'}`}
                    >
                      <LockOutlined
                        style={{ color: theme === 'dark' ? '#a78bfa' : '#7c3aed', fontSize: 15 }}
                      />
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-xs font-medium uppercase tracking-wide mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                      >
                        Quyền hạn
                      </p>
                      <p
                        className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                      >
                        Tạo và theo dõi đề xuất khen thưởng · Quản lý quân nhân và khen thưởng trong
                        đơn vị
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card
                title={
                  <Space>
                    <ClockCircleOutlined style={{ color: '#10b981' }} />
                    <span className="font-semibold">Hoạt động gần đây</span>
                  </Space>
                }
                className="shadow-lg"
                styles={{ body: { padding: '20px' } }}
              >
                <Timeline
                  items={[
                    {
                      color: 'blue',
                      children: (
                        <div>
                          <div
                            className={`flex items-center gap-1.5 mb-1 text-xs font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                          >
                            <ClockCircleOutlined style={{ fontSize: 12 }} />
                            Thời gian đăng nhập
                          </div>
                          <p
                            className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}
                          >
                            {formatDateTime(new Date())}
                          </p>
                        </div>
                      ),
                    },
                    {
                      color: 'green',
                      children: (
                        <div>
                          <div
                            className={`flex items-center gap-1.5 mb-1 text-xs font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                          >
                            <CheckCircleOutlined style={{ fontSize: 12 }} />
                            Trạng thái hệ thống
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2 h-2 rounded-full bg-green-500"
                              style={{ boxShadow: '0 0 0 3px rgba(16,185,129,0.2)' }}
                            />
                            <span className="text-sm font-semibold text-green-500">
                              Hoạt động bình thường
                            </span>
                          </div>
                        </div>
                      ),
                    },
                    {
                      color: 'gray',
                      children: (
                        <div>
                          <div
                            className={`flex items-center gap-1.5 mb-1 text-xs font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                          >
                            <UserOutlined style={{ fontSize: 12 }} />
                            Phiên làm việc
                          </div>
                          <p
                            className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                          >
                            {user?.username || displayName}
                          </p>
                        </div>
                      ),
                    },
                  ]}
                />
              </Card>
            </div>
          </>
        )}
      </div>
    </ConfigProvider>
  );
}
