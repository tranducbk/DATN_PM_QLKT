'use client';

import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Typography,
  Spin,
  Alert,
  Statistic,
  Descriptions,
  Progress,
  Badge,
  Avatar,
  Divider,
  ConfigProvider,
  theme as antdTheme,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import {
  FileTextOutlined,
  LockOutlined,
  UserOutlined,
  TrophyOutlined,
  StarOutlined,
  CalendarOutlined,
  TeamOutlined,
  SafetyOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  HeartOutlined,
  ReloadOutlined,
  BulbOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import '@/lib/chartConfig';
import { PieChart } from '@/components/charts';
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';

const { Title, Text, Paragraph } = Typography;

export default function UserDashboard() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('Quân nhân');
  const [personnelInfo, setPersonnelInfo] = useState<any>(null);
  const [annualProfile, setAnnualProfile] = useState<any>(null);
  const [serviceProfile, setServiceProfile] = useState<any>(null);
  const [contributionProfile, setContributionProfile] = useState<any>(null);
  const [annualRewards, setAnnualRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setLoading(true);
        setError('');

        if (user) {
          const name = (user.ho_ten || '').trim();
          const username = (user.username || '').trim();
          setDisplayName(name || username || 'Người dùng');
        }

        if (!user?.quan_nhan_id) {
          setError('Không tìm thấy thông tin quân nhân.');
          return;
        }

        // Lấy thông tin cá nhân
        const personnelRes = await apiClient.getPersonnelById(user.quan_nhan_id);
        if (personnelRes.success) {
          setPersonnelInfo(personnelRes.data);
        }

        const current_year = new Date().getFullYear();

        // Lấy hồ sơ hằng năm
        const annualRes = await apiClient.getAnnualProfile(user.quan_nhan_id, current_year);
        if (annualRes.success) {
          setAnnualProfile(annualRes.data);
        }

        // Lấy hồ sơ niên hạn
        const serviceRes = await apiClient.getServiceProfile(user.quan_nhan_id);
        if (serviceRes.success) {
          setServiceProfile(serviceRes.data);
        }

        const contributionRes = await apiClient.getContributionProfile(user.quan_nhan_id);
        if (contributionRes.success) {
          setContributionProfile(contributionRes.data);
        }

        // Lấy danh sách danh hiệu đã nhận
        const rewardsRes = await apiClient.getAnnualRewardsByPersonnel(user.quan_nhan_id);
        if (rewardsRes.success) {
          setAnnualRewards(rewardsRes.data || []);
        }
      } catch (err: unknown) {
        // Error handled by UI
        setError(getApiErrorMessage(err, 'Không thể tải hồ sơ. Vui lòng thử lại.'));
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  // Calculate service years
  const calculateServiceYears = () => {
    if (!personnelInfo?.ngay_nhap_ngu) return 0;
    const startDate = new Date(personnelInfo.ngay_nhap_ngu);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - startDate.getTime());
    const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
    return diffYears;
  };

  // Calculate total service months
  const calculateServiceMonths = () => {
    if (!personnelInfo?.ngay_nhap_ngu) return 0;
    const startDate = new Date(personnelInfo.ngay_nhap_ngu);
    const endDate = personnelInfo?.ngay_xuat_ngu
      ? new Date(personnelInfo.ngay_xuat_ngu)
      : new Date();

    let months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
    months += endDate.getMonth() - startDate.getMonth();
    if (endDate.getDate() < startDate.getDate()) {
      months--;
    }
    return Math.max(0, months);
  };

  const serviceYears = calculateServiceYears();
  const serviceMonths = calculateServiceMonths();

  // Calculate progress for medals
  const getProgressData = (status: string, current: number, target: number) => {
    if (status === ELIGIBILITY_STATUS.DA_NHAN) return { percent: 100, color: '#52c41a' };
    if (status === ELIGIBILITY_STATUS.DU_DIEU_KIEN) return { percent: 100, color: '#1890ff' };
    const percent = Math.min((current / target) * 100, 100);
    return { percent, color: '#faad14' };
  };

  if (loading) {
    return (
      <ConfigProvider
        theme={{
          algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        }}
      >
        <div
          className={`flex items-center justify-center min-h-screen ${
            theme === 'dark'
              ? 'bg-gradient-to-br from-gray-900 to-gray-800'
              : 'bg-gradient-to-br from-blue-50 to-indigo-50'
          }`}
        >
          <Space direction="vertical" align="center" size="large">
            <Spin size="large" />
            <Text type="secondary">Đang tải thông tin...</Text>
          </Space>
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <div
        className={`min-h-screen ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
            : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'
        }`}
      >
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Hero Header with Avatar */}
          <Card
            style={{
              borderRadius: '12px',
              boxShadow:
                theme === 'dark'
                  ? '0 4px 16px rgba(0, 0, 0, 0.4)'
                  : '0 4px 16px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              border: 'none',
            }}
            styles={{ body: { padding: 0 } }}
          >
            <div
              style={{
                background:
                  theme === 'dark'
                    ? 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)'
                    : 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                padding: '32px',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                <Avatar
                  size={80}
                  icon={<UserOutlined />}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#2563eb',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    border: '3px solid rgba(255, 255, 255, 0.3)',
                  }}
                />
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <Title
                    level={2}
                    style={{
                      margin: 0,
                      marginBottom: '12px',
                      color: '#ffffff',
                      fontSize: '28px',
                    }}
                  >
                    Xin chào, {personnelInfo?.ho_ten || displayName}!
                  </Title>
                  <Space size="large" wrap style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                    <Space>
                      <TeamOutlined />
                      <span>
                        {personnelInfo?.DonViTrucThuoc?.ten_don_vi ||
                          personnelInfo?.CoQuanDonVi?.ten_don_vi ||
                          'N/A'}
                      </span>
                    </Space>
                    <Space>
                      <SafetyOutlined />
                      <span>{personnelInfo?.ChucVu?.ten_chuc_vu || 'N/A'}</span>
                    </Space>
                    <Space>
                      <CalendarOutlined />
                      <span>{serviceYears} năm phục vụ</span>
                    </Space>
                  </Space>
                </div>
              </div>
            </div>
          </Card>

          {error && <Alert message={error} type="error" showIcon className="shadow-sm" />}

          {/* Statistics Overview */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <Card
              hoverable
              style={{
                borderRadius: '10px',
                boxShadow:
                  theme === 'dark'
                    ? '0 1px 6px rgba(0, 0, 0, 0.35)'
                    : '0 1px 4px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.3s ease',
              }}
              styles={{ body: { padding: '20px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    background: theme === 'dark' ? '#1e3a8a' : '#e6f0ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow:
                      theme === 'dark'
                        ? '0 1px 3px rgba(59, 130, 246, 0.3)'
                        : '0 1px 3px rgba(59, 130, 246, 0.2)',
                  }}
                >
                  <TrophyOutlined
                    style={{
                      fontSize: '26px',
                      color: theme === 'dark' ? '#60a5fa' : '#2563eb',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      display: 'block',
                      marginBottom: '4px',
                      color: theme === 'dark' ? '#cbd5e1' : '#475569',
                    }}
                  >
                    Tổng CSTDCS
                  </Text>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: 'bold',
                      color: theme === 'dark' ? '#e5e7eb' : '#0f172a',
                      lineHeight: '1.1',
                    }}
                  >
                    {annualProfile?.tong_cstdcs || 0}
                  </div>
                </div>
              </div>
            </Card>

            <Card
              hoverable
              style={{
                borderRadius: '10px',
                boxShadow:
                  theme === 'dark'
                    ? '0 1px 6px rgba(0, 0, 0, 0.35)'
                    : '0 1px 4px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.3s ease',
              }}
              styles={{ body: { padding: '20px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    background: theme === 'dark' ? '#0b3d2e' : '#e8f5e9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow:
                      theme === 'dark'
                        ? '0 1px 3px rgba(16, 185, 129, 0.3)'
                        : '0 1px 3px rgba(16, 185, 129, 0.2)',
                  }}
                >
                  <ExperimentOutlined
                    style={{
                      fontSize: '26px',
                      color: theme === 'dark' ? '#34d399' : '#059669',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      display: 'block',
                      marginBottom: '4px',
                      color: theme === 'dark' ? '#cbd5e1' : '#475569',
                    }}
                  >
                    Tổng NCKH
                  </Text>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: 'bold',
                      color: theme === 'dark' ? '#e5e7eb' : '#0f172a',
                      lineHeight: '1.1',
                    }}
                  >
                    {Array.isArray(annualProfile?.tong_nckh)
                      ? annualProfile.tong_nckh.length
                      : annualProfile?.tong_nckh || 0}
                  </div>
                </div>
              </div>
            </Card>

            <Card
              hoverable
              style={{
                borderRadius: '10px',
                boxShadow:
                  theme === 'dark'
                    ? '0 1px 6px rgba(0, 0, 0, 0.35)'
                    : '0 1px 4px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.3s ease',
              }}
              styles={{ body: { padding: '20px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    background: theme === 'dark' ? '#78350f' : '#fef9c3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow:
                      theme === 'dark'
                        ? '0 1px 3px rgba(234, 179, 8, 0.3)'
                        : '0 1px 3px rgba(234, 179, 8, 0.2)',
                  }}
                >
                  <TrophyOutlined
                    style={{
                      fontSize: '26px',
                      color: theme === 'dark' ? '#fbbf24' : '#d97706',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      display: 'block',
                      marginBottom: '4px',
                      color: theme === 'dark' ? '#cbd5e1' : '#475569',
                    }}
                  >
                    CSTDCS liên tục
                  </Text>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: 'bold',
                      color: theme === 'dark' ? '#e5e7eb' : '#0f172a',
                      lineHeight: '1.1',
                    }}
                  >
                    {annualProfile?.cstdcs_lien_tuc || 0}{' '}
                    <span
                      style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: theme === 'dark' ? '#e5e7eb' : '#0f172a',
                        marginLeft: '4px',
                      }}
                    >
                      năm
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              hoverable
              style={{
                borderRadius: '10px',
                boxShadow:
                  theme === 'dark'
                    ? '0 1px 6px rgba(0, 0, 0, 0.35)'
                    : '0 1px 4px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.3s ease',
              }}
              styles={{ body: { padding: '20px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    background: theme === 'dark' ? '#3b0764' : '#f3e8ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow:
                      theme === 'dark'
                        ? '0 1px 3px rgba(139, 92, 246, 0.3)'
                        : '0 1px 3px rgba(139, 92, 246, 0.2)',
                  }}
                >
                  <ClockCircleOutlined
                    style={{
                      fontSize: '26px',
                      color: theme === 'dark' ? '#a78bfa' : '#7c3aed',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Text
                    type="secondary"
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      display: 'block',
                      marginBottom: '4px',
                      color: theme === 'dark' ? '#cbd5e1' : '#475569',
                    }}
                  >
                    Tháng cống hiến
                  </Text>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: theme === 'dark' ? '#e5e7eb' : '#0f172a',
                      lineHeight: '1.2',
                    }}
                  >
                    {serviceMonths} tháng
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Personal Info Card */}
          {personnelInfo && (
            <Card
              title={
                <Space>
                  <UserOutlined className="text-blue-600" />
                  <span className="font-semibold">Thông tin cá nhân</span>
                </Space>
              }
              className="shadow-md border-0"
            >
              <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="middle">
                <Descriptions.Item label="Họ tên" labelStyle={{ fontWeight: 500 }}>
                  <Text strong>{personnelInfo.ho_ten || 'Chưa có dữ liệu'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="CCCD" labelStyle={{ fontWeight: 500 }}>
                  {personnelInfo.cccd || 'Chưa có dữ liệu'}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày sinh" labelStyle={{ fontWeight: 500 }}>
                  {personnelInfo.ngay_sinh
                    ? formatDate(personnelInfo.ngay_sinh)
                    : 'Chưa có dữ liệu'}
                </Descriptions.Item>
                <Descriptions.Item label="Giới tính" labelStyle={{ fontWeight: 500 }}>
                  {personnelInfo.gioi_tinh === 'NAM'
                    ? 'Nam'
                    : personnelInfo.gioi_tinh === 'NU'
                      ? 'Nữ'
                      : 'Chưa có dữ liệu'}
                </Descriptions.Item>
                <Descriptions.Item label="Đơn vị" labelStyle={{ fontWeight: 500 }}>
                  {personnelInfo.DonViTrucThuoc?.ten_don_vi ||
                    personnelInfo.CoQuanDonVi?.ten_don_vi ||
                    'Chưa có dữ liệu'}
                </Descriptions.Item>
                <Descriptions.Item label="Cấp bậc" labelStyle={{ fontWeight: 500 }}>
                  {personnelInfo.cap_bac || 'Chưa có dữ liệu'}
                </Descriptions.Item>
                <Descriptions.Item label="Chức vụ" labelStyle={{ fontWeight: 500 }}>
                  {personnelInfo.ChucVu?.ten_chuc_vu || 'Chưa có dữ liệu'}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày nhập ngũ" labelStyle={{ fontWeight: 500 }}>
                  {personnelInfo.ngay_nhap_ngu
                    ? formatDate(personnelInfo.ngay_nhap_ngu)
                    : 'Chưa có dữ liệu'}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày xuất ngũ" labelStyle={{ fontWeight: 500 }}>
                  {personnelInfo.ngay_xuat_ngu
                    ? formatDate(personnelInfo.ngay_xuat_ngu)
                    : 'Chưa có dữ liệu'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {/* Profile Cards */}
          <Row gutter={[16, 16]}>
            {/* Annual Profile Card */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <TrophyOutlined className="text-blue-600" />
                    <span className="font-semibold">Hồ sơ Khen thưởng Hằng năm</span>
                  </Space>
                }
                className="shadow-md border-0 h-full"
              >
                {annualProfile ? (
                  <Space direction="vertical" className="w-full" size="large">
                    {annualProfile.goi_y && (
                      <Alert
                        message={<span className="font-semibold">Đề xuất khen thưởng</span>}
                        description={annualProfile.goi_y}
                        type="info"
                        showIcon
                        icon={<BulbOutlined />}
                        className={
                          theme === 'dark'
                            ? 'border-blue-700 bg-blue-900/30'
                            : 'border-blue-200 bg-blue-50'
                        }
                      />
                    )}

                    <Divider orientation="left" className="!my-4">
                      <Text strong className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                        Tổng các danh hiệu đã nhận
                      </Text>
                    </Divider>

                    {/* Biểu đồ tổng các danh hiệu đã nhận */}
                    {(() => {
                      // Tính toán số lượng từng loại danh hiệu
                      const danhHieuCounts: Record<string, number> = {
                        CSTDCS: 0,
                        CSTT: 0,
                        BKBQP: 0,
                        CSTDTQ: 0,
                      };

                      annualRewards.forEach((reward: any) => {
                        const danhHieu = reward.danh_hieu;
                        if (danhHieu && danhHieuCounts.hasOwnProperty(danhHieu)) {
                          danhHieuCounts[danhHieu]++;
                        }
                      });

                      // Tính tổng NCKH
                      const tongNCKH = Array.isArray(annualProfile?.tong_nckh)
                        ? annualProfile.tong_nckh.length
                        : annualProfile?.tong_nckh || 0;

                      const chartData = [
                        {
                          label: 'Chiến sĩ thi đua cơ sở',
                          value: danhHieuCounts.CSTDCS,
                        },
                        {
                          label: 'Chiến sĩ tiên tiến',
                          value: danhHieuCounts.CSTT,
                        },
                        {
                          label: 'Bằng khen của Bộ trưởng Bộ Quốc phòng',
                          value: danhHieuCounts.BKBQP,
                        },
                        {
                          label: 'Chiến sĩ thi đua toàn quân',
                          value: danhHieuCounts.CSTDTQ,
                        },
                        {
                          label: 'Thành tích khoa học',
                          value: tongNCKH,
                        },
                      ].filter(item => item.value > 0);

                      const total = chartData.reduce((sum, item) => sum + item.value, 0);

                      if (total === 0) {
                        return (
                          <Alert
                            message="Chưa có danh hiệu nào"
                            description="Bạn chưa nhận được danh hiệu nào. Hãy tiếp tục phấn đấu!"
                            type="info"
                            showIcon
                          />
                        );
                      }

                      return (
                        <div>
                          <PieChart
                            data={chartData}
                            title="Tổng các danh hiệu đã nhận"
                            height={280}
                            colors={[
                              'rgba(59, 130, 246, 0.8)',
                              'rgba(34, 197, 94, 0.8)',
                              'rgba(249, 115, 22, 0.8)',
                              'rgba(147, 51, 234, 0.8)',
                              'rgba(236, 72, 153, 0.8)',
                            ]}
                          />
                          <div className="mt-4 text-center">
                            <Text type="secondary" className="text-sm">
                              Tổng số danh hiệu/thành tích đã nhận: <Text strong>{total}</Text>
                            </Text>
                          </div>
                        </div>
                      );
                    })()}
                  </Space>
                ) : (
                  <Alert message="Chưa có dữ liệu hồ sơ hằng năm" type="warning" showIcon />
                )}
              </Card>
            </Col>

            {/* Service Profile Card */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <SafetyOutlined className="text-purple-600" />
                    <span className="font-semibold">Hồ sơ Huy chương Chiến sĩ vẻ vang</span>
                  </Space>
                }
                className="shadow-md border-0 h-full"
              >
                {serviceProfile ? (
                  <Space direction="vertical" className="w-full" size="large">
                    {serviceProfile.goi_y && (
                      <Alert
                        message={<span className="font-semibold">Đề xuất khen thưởng</span>}
                        description={serviceProfile.goi_y}
                        type="success"
                        showIcon
                        icon={<CheckCircleOutlined />}
                        className={
                          theme === 'dark'
                            ? 'border-green-700 bg-green-900/30'
                            : 'border-green-200 bg-green-50'
                        }
                      />
                    )}

                    <Divider orientation="left" className="!my-4">
                      <Text strong className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                        Huy chương Chiến sĩ Vẻ vang
                      </Text>
                    </Divider>

                    {/* HCCSVV - Hạng Ba */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Text strong>Hạng Ba (120 tháng)</Text>
                        <Badge
                          status={
                            serviceProfile.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN
                              ? 'success'
                              : serviceProfile.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                ? 'processing'
                                : 'default'
                          }
                          text={
                            serviceProfile.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN
                              ? 'Đã nhận'
                              : serviceProfile.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                ? 'Đủ điều kiện'
                                : 'Chưa đủ'
                          }
                        />
                      </div>
                      <Progress
                        {...getProgressData(
                          serviceProfile.hccsvv_hang_ba_status,
                          serviceMonths,
                          120
                        )}
                        format={() => `${serviceMonths}/120 tháng`}
                      />
                    </div>

                    {/* HCCSVV - Hạng Nhì */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Text strong>Hạng Nhì (180 tháng)</Text>
                        <Badge
                          status={
                            serviceProfile.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN
                              ? 'success'
                              : serviceProfile.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                ? 'processing'
                                : 'default'
                          }
                          text={
                            serviceProfile.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN
                              ? 'Đã nhận'
                              : serviceProfile.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                ? 'Đủ điều kiện'
                                : 'Chưa đủ'
                          }
                        />
                      </div>
                      <Progress
                        {...getProgressData(
                          serviceProfile.hccsvv_hang_nhi_status,
                          serviceMonths,
                          180
                        )}
                        format={() => `${serviceMonths}/180 tháng`}
                      />
                    </div>

                    {/* HCCSVV - Hạng Nhất */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Text strong>Hạng Nhất (240 tháng)</Text>
                        <Badge
                          status={
                            serviceProfile.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN
                              ? 'success'
                              : serviceProfile.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                ? 'processing'
                                : 'default'
                          }
                          text={
                            serviceProfile.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN
                              ? 'Đã nhận'
                              : serviceProfile.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                ? 'Đủ điều kiện'
                                : 'Chưa đủ'
                          }
                        />
                      </div>
                      <Progress
                        {...getProgressData(
                          serviceProfile.hccsvv_hang_nhat_status,
                          serviceMonths,
                          240
                        )}
                        format={() => `${serviceMonths}/240 tháng`}
                      />
                    </div>
                  </Space>
                ) : (
                  <Alert
                    message="Chưa có dữ liệu hồ sơ huy chương chiến sĩ vẻ vang"
                    type="warning"
                    showIcon
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* Contribution Profile Card */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} lg={24}>
              <Card
                title={
                  <Space>
                    <TrophyOutlined className="text-orange-600" />
                    <span className="font-semibold">Hồ sơ Huân chương Bảo vệ Tổ quốc</span>
                  </Space>
                }
                className="shadow-md border-0 h-full"
              >
                {contributionProfile ? (
                  <Space direction="vertical" className="w-full" size="large">
                    {contributionProfile.goi_y && (
                      <Alert
                        message={<span className="font-semibold">Đề xuất khen thưởng</span>}
                        description={contributionProfile.goi_y}
                        type="info"
                        showIcon
                        icon={<BulbOutlined />}
                        className={
                          theme === 'dark'
                            ? 'border-blue-700 bg-blue-900/30'
                            : 'border-blue-200 bg-blue-50'
                        }
                      />
                    )}

                    <Divider orientation="left" className="!my-4">
                      <Text strong className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                        Huân chương Bảo vệ Tổ quốc
                      </Text>
                    </Divider>

                    {(() => {
                      // Tính target tháng theo giới tính: Nam 120 tháng, Nữ 80 tháng (2/3)
                      const isFemale = personnelInfo?.gioi_tinh === 'NU';
                      const targetMonths = isFemale ? 80 : 120;

                      // Tính tổng tháng theo từng hạng
                      const hangBaMonths =
                        (contributionProfile.months_07 || 0) +
                        (contributionProfile.months_08 || 0) +
                        (contributionProfile.months_0910 || 0);
                      const hangNhiMonths =
                        (contributionProfile.months_08 || 0) +
                        (contributionProfile.months_0910 || 0);
                      const hangNhatMonths = contributionProfile.months_0910 || 0;

                      return (
                        <>
                          {/* HCBVTQ - Hạng Ba */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <Text strong>Hạng Ba ({targetMonths} tháng)</Text>
                              <Badge
                                status={
                                  contributionProfile.hcbvtq_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN
                                    ? 'success'
                                    : contributionProfile.hcbvtq_hang_ba_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                      ? 'processing'
                                      : 'default'
                                }
                                text={
                                  contributionProfile.hcbvtq_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN
                                    ? 'Đã nhận'
                                    : contributionProfile.hcbvtq_hang_ba_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                      ? 'Đủ điều kiện'
                                      : 'Chưa đủ'
                                }
                              />
                            </div>
                            <Progress
                              {...getProgressData(
                                contributionProfile.hcbvtq_hang_ba_status,
                                hangBaMonths,
                                targetMonths
                              )}
                              format={() => `${hangBaMonths}/${targetMonths} tháng`}
                            />
                            <Text type="secondary" className="text-xs">
                              Tổng tháng cống hiến từ nhóm có hệ số chức vụ từ 0.7 đến 1.0
                            </Text>
                          </div>

                          {/* HCBVTQ - Hạng Nhì */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <Text strong>Hạng Nhì ({targetMonths} tháng)</Text>
                              <Badge
                                status={
                                  contributionProfile.hcbvtq_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN
                                    ? 'success'
                                    : contributionProfile.hcbvtq_hang_nhi_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                      ? 'processing'
                                      : 'default'
                                }
                                text={
                                  contributionProfile.hcbvtq_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN
                                    ? 'Đã nhận'
                                    : contributionProfile.hcbvtq_hang_nhi_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                      ? 'Đủ điều kiện'
                                      : 'Chưa đủ'
                                }
                              />
                            </div>
                            <Progress
                              {...getProgressData(
                                contributionProfile.hcbvtq_hang_nhi_status,
                                hangNhiMonths,
                                targetMonths
                              )}
                              format={() => `${hangNhiMonths}/${targetMonths} tháng`}
                            />
                            <Text type="secondary" className="text-xs">
                              Tổng tháng cống hiến từ nhóm có hệ số chức vụ từ 0.8 đến 1.0
                            </Text>
                          </div>

                          {/* HCBVTQ - Hạng Nhất */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <Text strong>Hạng Nhất ({targetMonths} tháng)</Text>
                              <Badge
                                status={
                                  contributionProfile.hcbvtq_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN
                                    ? 'success'
                                    : contributionProfile.hcbvtq_hang_nhat_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                      ? 'processing'
                                      : 'default'
                                }
                                text={
                                  contributionProfile.hcbvtq_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN
                                    ? 'Đã nhận'
                                    : contributionProfile.hcbvtq_hang_nhat_status === ELIGIBILITY_STATUS.DU_DIEU_KIEN
                                      ? 'Đủ điều kiện'
                                      : 'Chưa đủ'
                                }
                              />
                            </div>
                            <Progress
                              {...getProgressData(
                                contributionProfile.hcbvtq_hang_nhat_status,
                                hangNhatMonths,
                                targetMonths
                              )}
                              format={() => `${hangNhatMonths}/${targetMonths} tháng`}
                            />
                            <Text type="secondary" className="text-xs">
                              Tổng tháng cống hiến từ nhóm có hệ số chức vụ từ 0.9 đến 1.0
                            </Text>
                          </div>
                        </>
                      );
                    })()}
                  </Space>
                ) : (
                  <Alert
                    message="Chưa có dữ liệu hồ sơ huân chương bảo vệ tổ quốc"
                    type="warning"
                    showIcon
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* Quick Actions */}
          <Card
            title={
              <Space>
                <RocketOutlined className="text-blue-600" />
                <span className="font-semibold">Thao tác nhanh</span>
              </Space>
            }
            className="shadow-md border-0"
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
                <Link href="/user/profile" className="block">
                  <Card
                    hoverable
                    className={`text-center h-full ${
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-blue-900/40 to-blue-800/40 border-blue-700'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
                    }`}
                  >
                    <FileTextOutlined className="text-4xl text-blue-600 mb-3" />
                    <Title level={5} className="!mb-1">
                      Lịch sử chi tiết
                    </Title>
                    <Text type="secondary" className="text-sm">
                      Xem đầy đủ thông tin hồ sơ
                    </Text>
                  </Card>
                </Link>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Link href="/user/change-password" className="block">
                  <Card
                    hoverable
                    className={`text-center h-full ${
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-purple-900/40 to-purple-800/40 border-purple-700'
                        : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'
                    }`}
                  >
                    <LockOutlined className="text-4xl text-purple-600 mb-3" />
                    <Title level={5} className="!mb-1">
                      Đổi mật khẩu
                    </Title>
                    <Text type="secondary" className="text-sm">
                      Cập nhật mật khẩu bảo mật
                    </Text>
                  </Card>
                </Link>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card
                  hoverable
                  className={`text-center h-full cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-green-900/40 to-green-800/40 border-green-700'
                      : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                  }`}
                  onClick={() => window.location.reload()}
                >
                  <ReloadOutlined className="text-4xl text-green-600 mb-3" />
                  <Title level={5} className="!mb-1">
                    Làm mới dữ liệu
                  </Title>
                  <Text type="secondary" className="text-sm">
                    Cập nhật thông tin mới nhất
                  </Text>
                </Card>
              </Col>
            </Row>
          </Card>

          {/* Footer Info */}
          <div className="text-center py-6">
            <Text type="secondary" className="text-sm">
              Dữ liệu được cập nhật lần cuối: {formatDateTime(new Date())}
            </Text>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}
