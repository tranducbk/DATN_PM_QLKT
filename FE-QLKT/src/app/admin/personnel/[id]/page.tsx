'use client';

import { useState, useEffect, ReactNode } from 'react';
import {
  Card,
  Typography,
  Button,
  Space,
  Breadcrumb,
  ConfigProvider,
  Tag,
  message,
  Tabs,
  Row,
  Col,
  Statistic,
  Divider,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  UserOutlined,
  TeamOutlined,
  TrophyOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useTheme } from '@/components/theme-provider';
import { getAntdThemeConfig } from '@/lib/antd-theme';
import { apiClient } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import styles from './personnel-detail.module.css';

const { Title, Text } = Typography;

export default function PersonnelDetailPage() {
  const { isDark } = useTheme();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const personnelId = params?.id as string;
  const activeTab = searchParams?.get('tab') || '1';
  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<any>(null);
  const [serviceProfile, setServiceProfile] = useState<any>(null);
  const [annualProfile, setAnnualProfile] = useState<any>(null);
  const [contributionProfile, setContributionProfile] = useState<any>(null);
  const [militaryFlag, setMilitaryFlag] = useState<any>(null);
  const [commemorationMedals, setCommemorationMedals] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const current_year = new Date().getFullYear();
      try {
        setLoading(true);
        const [personnelRes, serviceRes, annualRes, contributionRes, militaryRes, commRes] =
          await Promise.all([
            apiClient.getPersonnelById(personnelId),
            apiClient.getServiceProfile(personnelId),
            apiClient.getAnnualProfile(personnelId, current_year),
            apiClient.getContributionProfile(personnelId),
            apiClient.getMilitaryFlagByPersonnel(personnelId),
            apiClient.getCommemorationMedalsByPersonnel(personnelId),
          ]);

        if (personnelRes.success) {
          setPersonnel(personnelRes.data);
        } else {
          message.error(personnelRes.message || 'Lỗi khi lấy thông tin quân nhân');
        }

        if (serviceRes.success) {
          setServiceProfile(serviceRes.data);
        }

        if (annualRes.success) {
          setAnnualProfile(annualRes.data);
        }

        if (contributionRes.success) {
          setContributionProfile(contributionRes.data);
        }

        if (militaryRes.success) {
          setMilitaryFlag(militaryRes.data);
        }

        if (commRes.success) {
          setCommemorationMedals(commRes.data);
        }
      } catch (error: any) {
        message.error(error.message || 'Lỗi khi lấy thông tin');
      } finally {
        setLoading(false);
      }
    };

    if (personnelId) {
      fetchData();
    }
  }, [personnelId]);

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      DA_NHAN: { label: 'Đã nhận', color: 'green' },
      DU_DIEU_KIEN: { label: 'Đủ điều kiện', color: 'orange' },
      CHUA_DU: { label: 'Chưa đủ', color: 'default' },
    };
    const s = statusMap[status] || statusMap.CHUA_DU;
    return <Tag color={s.color}>{s.label}</Tag>;
  };

  const getAccountRoleLabel = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Super Admin', color: 'purple' };
      case 'ADMIN':
        return { label: 'Admin', color: 'red' };
      case 'MANAGER':
        return { label: 'Quản lý', color: 'blue' };
      case 'USER':
        return { label: 'Người dùng', color: 'green' };
      default:
        return { label: role || '-', color: 'default' };
    }
  };

  const calculateYearsOfService = (ngayNhapNgu: string) => {
    if (!ngayNhapNgu) return 0;
    const now = new Date();
    const nhapNgu = new Date(ngayNhapNgu);
    return Math.floor((now.getTime() - nhapNgu.getTime()) / (1000 * 60 * 60 * 24 * 365));
  };

  const convertMonthsToYearsAndMonths = (totalMonths: number) => {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return { years, months };
  };

  const InfoGrid = ({ items }: { items: Array<{ label: string; value?: ReactNode }> }) => (
    <div className="overflow-x-auto">
      <table
        className={`min-w-full rounded-lg border ${
          isDark ? 'border-gray-700 bg-gray-900/60' : 'border-gray-200 bg-white'
        }`}
      >
        <tbody>
          {items.map(item => (
            <tr
              key={item.label}
              className={`border-b last:border-b-0 ${
                isDark ? 'border-gray-800' : 'border-gray-100'
              }`}
            >
              <td
                className={`px-4 py-3 text-sm font-semibold w-48 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {item.label}
              </td>
              <td
                className={`px-4 py-3 text-base break-words ${
                  isDark ? 'text-gray-200' : 'text-gray-800'
                }`}
              >
                {item.value ?? '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!personnel) {
    return (
      <ConfigProvider theme={getAntdThemeConfig(isDark)}>
        <div className="space-y-4 p-6">
          <Title level={2}>Không tìm thấy quân nhân</Title>
          <Link href="/admin/personnel">
            <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
          </Link>
        </div>
      </ConfigProvider>
    );
  }

  const tabItems = [
    {
      key: '1',
      label: (
        <span>
          <UserOutlined /> Thông tin cơ bản
        </span>
      ),
      children: (
        <div className="space-y-4">
          {/* Personnel Information Card */}
          <Card title="Thông tin cá nhân" className="shadow-sm overflow-hidden">
            <InfoGrid
              items={[
                { label: 'Họ và tên', value: personnel.ho_ten || '-' },
                {
                  label: 'Giới tính',
                  value:
                    personnel.gioi_tinh === 'NAM'
                      ? 'Nam'
                      : personnel.gioi_tinh === 'NU'
                        ? 'Nữ'
                        : '-',
                },
                { label: 'CCCD', value: personnel.cccd || '-' },
                { label: 'Số điện thoại', value: personnel.so_dien_thoai || '-' },
                { label: 'Ngày sinh', value: formatDate(personnel.ngay_sinh) },
                { label: 'Ngày nhập ngũ', value: formatDate(personnel.ngay_nhap_ngu) },
                { label: 'Ngày xuất ngũ', value: formatDate(personnel.ngay_xuat_ngu) },
              ]}
            />
          </Card>

          <Card title="Địa chỉ & Thông tin Đảng" className="shadow-sm overflow-hidden">
            <InfoGrid
              items={[
                { label: 'Quê quán 2 cấp', value: personnel.que_quan_2_cap || '-' },
                { label: 'Quê quán 3 cấp', value: personnel.que_quan_3_cap || '-' },
                { label: 'Trú quán hiện nay', value: personnel.tru_quan || '-' },
                { label: 'Chỗ ở hiện nay', value: personnel.cho_o_hien_nay || '-' },
                { label: 'Ngày vào Đảng', value: formatDate(personnel.ngay_vao_dang) },
                {
                  label: 'Ngày vào Đảng chính thức',
                  value: formatDate(personnel.ngay_vao_dang_chinh_thuc),
                },
                { label: 'Số thẻ Đảng viên', value: personnel.so_the_dang_vien || '-' },
              ]}
            />
          </Card>

          <Card title="Đơn vị & Chức vụ" className="shadow-sm overflow-hidden">
            <InfoGrid
              items={[
                {
                  label: 'Cơ quan đơn vị',
                  value:
                    personnel.DonViTrucThuoc?.CoQuanDonVi?.ten_don_vi ||
                    personnel.CoQuanDonVi?.ten_don_vi ||
                    '-',
                },
                {
                  label: 'Đơn vị trực thuộc',
                  value: personnel.DonViTrucThuoc?.ten_don_vi || '-',
                },
                { label: 'Cấp bậc', value: personnel.cap_bac || '-' },
                { label: 'Chức vụ', value: personnel.ChucVu?.ten_chuc_vu || '-' },
                {
                  label: 'Hệ số chức vụ',
                  value: personnel.ChucVu?.he_so_chuc_vu
                    ? Number(personnel.ChucVu.he_so_chuc_vu).toFixed(2)
                    : '-',
                },
              ]}
            />
          </Card>

          {personnel.TaiKhoan && (
            <Card title="Tài khoản liên kết" className="shadow-sm overflow-hidden">
              <InfoGrid
                items={[
                  {
                    label: 'Username',
                    value: (
                      <Link href={`/admin/accounts`} className="text-blue-500 hover:underline">
                        {personnel.TaiKhoan.username}
                      </Link>
                    ),
                  },
                  {
                    label: 'Vai trò',
                    value: (
                      <Tag color={getAccountRoleLabel(personnel.TaiKhoan.role).color}>
                        {getAccountRoleLabel(personnel.TaiKhoan.role).label}
                      </Tag>
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </div>
      ),
    },
    {
      key: '2',
      label: (
        <span>
          <TrophyOutlined /> Hồ sơ khen thưởng
        </span>
      ),
      children: (
        <div className="space-y-6">
          {/* Hồ sơ Niên hạn */}
          {serviceProfile && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <SafetyOutlined /> Hồ sơ Niên hạn
                </span>
              }
              size="small"
            >
              {/* Huy chương chiến sĩ Vẻ vang */}
              <div className="mb-6">
                <Text strong className="text-base">
                  Huy chương Chiến sĩ Vẻ vang
                </Text>
                <Divider className="my-3" />
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Hạng Ba"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() => getStatusTag(serviceProfile.hccsvv_hang_ba_status)}
                      />
                      {serviceProfile.hccsvv_hang_ba_ngay && (
                        <Text type="secondary" className="text-xs">
                          {formatDate(serviceProfile.hccsvv_hang_ba_ngay)}
                        </Text>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Hạng Nhì"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() => getStatusTag(serviceProfile.hccsvv_hang_nhi_status)}
                      />
                      {serviceProfile.hccsvv_hang_nhi_ngay && (
                        <Text type="secondary" className="text-xs">
                          {formatDate(serviceProfile.hccsvv_hang_nhi_ngay)}
                        </Text>
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Hạng Nhất"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() => getStatusTag(serviceProfile.hccsvv_hang_nhat_status)}
                      />
                      {serviceProfile.hccsvv_hang_nhat_ngay && (
                        <Text type="secondary" className="text-xs">
                          {formatDate(serviceProfile.hccsvv_hang_nhat_ngay)}
                        </Text>
                      )}
                    </Card>
                  </Col>
                </Row>
              </div>

              {/* HC Bảo vệ Tổ quốc */}
              <div className="mb-6">
                <Text strong className="text-base">
                  Huân chương Bảo vệ Tổ quốc
                </Text>
                <Divider className="my-3" />
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Tháng tích lũy 0.7"
                        value={(() => {
                          const { years, months } = convertMonthsToYearsAndMonths(
                            contributionProfile.months_07 || 0
                          );
                          return `${years} năm ${months} tháng`;
                        })()}
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Tháng tích lũy 0.8"
                        value={(() => {
                          const { years, months } = convertMonthsToYearsAndMonths(
                            contributionProfile.months_08 || 0
                          );
                          return `${years} năm ${months} tháng`;
                        })()}
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Tháng tích lũy 0.9-1.0"
                        value={(() => {
                          const { years, months } = convertMonthsToYearsAndMonths(
                            contributionProfile.months_0910 || 0
                          );
                          return `${years} năm ${months} tháng`;
                        })()}
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Hạng Ba"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() => getStatusTag(contributionProfile.hcbvtq_hang_ba_status)}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Hạng Nhì"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() => getStatusTag(contributionProfile.hcbvtq_hang_nhi_status)}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Hạng Nhất"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() =>
                          getStatusTag(contributionProfile.hcbvtq_hang_nhat_status)
                        }
                      />
                    </Card>
                  </Col>
                </Row>
              </div>

              {/* HC Quân kỳ Quyết thắng */}
              <div className="mb-6">
                <Text strong className="text-base">
                  Huy chương quân kỳ Quyết thắng
                </Text>
                <Divider className="my-3" />
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={24}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Huy chương quân kỳ Quyết thắng"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() => {
                          const hasReceived = militaryFlag && militaryFlag.hasReceived;
                          if (hasReceived) {
                            return getStatusTag('DA_NHAN');
                          } else {
                            const yearsRequired = 25;
                            const yearsOfService = calculateYearsOfService(personnel.ngay_nhap_ngu);
                            const eligible = yearsOfService >= yearsRequired;
                            return (
                              <div>
                                <Text>HC QKQT {yearsRequired} năm</Text>
                                {eligible ? (
                                  <Tag color="orange" style={{ marginLeft: 8 }}>
                                    Đủ điều kiện
                                  </Tag>
                                ) : (
                                  <Tag color="default" style={{ marginLeft: 8 }}>
                                    Chưa đủ ({yearsOfService}/{yearsRequired} năm)
                                  </Tag>
                                )}
                              </div>
                            );
                          }
                        }}
                      />
                      {militaryFlag &&
                        militaryFlag.hasReceived &&
                        militaryFlag.data &&
                        militaryFlag.data.length > 0 &&
                        militaryFlag.data[0].ngay_cap && (
                          <Text type="secondary" className="text-xs">
                            {formatDate(militaryFlag.data[0].ngay_cap)}
                          </Text>
                        )}
                    </Card>
                  </Col>
                </Row>
              </div>

              {/* Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN */}
              <div>
                <Text strong className="text-base">
                  Kỷ niệm chương Vì sự nghiệp xây dựng Quân đội Nhân dân Việt Nam
                </Text>
                <Divider className="my-3" />
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={24}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() => {
                          const hasReceived =
                            commemorationMedals && commemorationMedals.hasReceived;
                          if (hasReceived) {
                            return getStatusTag('DA_NHAN');
                          } else {
                            const yearsRequired = personnel.gioi_tinh === 'NAM' ? 25 : 20;
                            const yearsOfService = calculateYearsOfService(personnel.ngay_nhap_ngu);
                            const eligible = yearsOfService >= yearsRequired;
                            return (
                              <div>
                                <Text>KNC VSNXD QDNDVN {yearsRequired} năm</Text>
                                {eligible ? (
                                  <Tag color="orange" style={{ marginLeft: 8 }}>
                                    Đủ điều kiện
                                  </Tag>
                                ) : (
                                  <Tag color="default" style={{ marginLeft: 8 }}>
                                    Chưa đủ ({yearsOfService}/{yearsRequired} năm)
                                  </Tag>
                                )}
                              </div>
                            );
                          }
                        }}
                      />
                      {commemorationMedals &&
                        commemorationMedals.hasReceived &&
                        commemorationMedals.data &&
                        commemorationMedals.data.length > 0 &&
                        commemorationMedals.data[0].ngay_cap && (
                          <Text type="secondary" className="text-xs">
                            {formatDate(commemorationMedals.data[0].ngay_cap)}
                          </Text>
                        )}
                    </Card>
                  </Col>
                </Row>
              </div>
            </Card>
          )}

          {/* Hồ sơ Hằng năm */}
          {annualProfile && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <TrophyOutlined /> Hồ sơ Hằng năm
                </span>
              }
              size="small"
            >
              {/* Thống kê */}
              <div className="mb-6">
                <Text strong className="text-base">
                  Thống kê
                </Text>
                <Divider className="my-3" />
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                    <Card size="small">
                      <Statistic
                        title="Tổng CSTDCS"
                        value={
                          Array.isArray(annualProfile.tong_cstdcs)
                            ? annualProfile.tong_cstdcs.length
                            : annualProfile.tong_cstdcs || 0
                        }
                        suffix="năm"
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small">
                      <Statistic
                        title="CSTDCS liên tục"
                        value={annualProfile.cstdcs_lien_tuc || 0}
                        suffix="năm"
                        valueStyle={{ color: '#13c2c2' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small">
                      <Statistic
                        title="Tổng ĐTKH/SKKH"
                        value={annualProfile.tong_nckh || 0}
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                </Row>
              </div>

              {/* Điều kiện */}
              <div>
                <Text strong className="text-base">
                  Điều kiện khen thưởng
                </Text>
                <Divider className="my-3" />
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                    <Card size="small">
                      <Statistic
                        title="Bằng khen BQP"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() => (
                          <Tag color={annualProfile.du_dieu_kien_bkbqp ? 'green' : 'default'}>
                            {annualProfile.du_dieu_kien_bkbqp ? 'Đủ điều kiện' : 'Chưa đủ'}
                          </Tag>
                        )}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small">
                      <Statistic
                        title="CSTD Toàn quân"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() => (
                          <Tag color={annualProfile.du_dieu_kien_cstdtq ? 'green' : 'default'}>
                            {annualProfile.du_dieu_kien_cstdtq ? 'Đủ điều kiện' : 'Chưa đủ'}
                          </Tag>
                        )}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small">
                      <Statistic
                        title="BK thủ tướng chính phủ"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() => (
                          <Tag color={annualProfile.du_dieu_kien_bkttcp ? 'gold' : 'default'}>
                            {annualProfile.du_dieu_kien_bkttcp ? 'Đủ điều kiện' : 'Chưa đủ'}
                          </Tag>
                        )}
                      />
                    </Card>
                  </Col>
                </Row>
              </div>

              {annualProfile.goi_y && (
                <>
                  <Divider className="my-4" />
                  <Card size="small" className="bg-blue-50 dark:bg-gray-800">
                    <Text strong>💡 Gợi ý: </Text>
                    <Text style={{ whiteSpace: 'pre-wrap' }}>{annualProfile.goi_y}</Text>
                  </Card>
                </>
              )}
            </Card>
          )}
        </div>
      ),
    },
    {
      key: '3',
      label: (
        <span>
          <TeamOutlined /> Quản lý chi tiết
        </span>
      ),
      children: (
        <div className="space-y-4">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Link href={`/admin/personnel/${personnelId}/position-history`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  bodyStyle={{
                    padding: '24px',
                    minHeight: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <HistoryOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      Lịch sử chức vụ
                    </Text>
                  </div>
                </Card>
              </Link>
            </Col>
            <Col xs={24} md={8}>
              <Link href={`/admin/personnel/${personnelId}/annual-rewards`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  bodyStyle={{
                    padding: '24px',
                    minHeight: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <TrophyOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      Danh hiệu hằng năm
                    </Text>
                  </div>
                </Card>
              </Link>
            </Col>
            <Col xs={24} md={8}>
              <Link href={`/admin/personnel/${personnelId}/scientific-achievements`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  bodyStyle={{
                    padding: '24px',
                    minHeight: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <ExperimentOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      Thành tích khoa học
                    </Text>
                  </div>
                </Card>
              </Link>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <Link href={`/admin/personnel/${personnelId}/service-rewards`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  bodyStyle={{
                    padding: '24px',
                    minHeight: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <SafetyOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      Huy chương Chiến sĩ vẻ vang
                    </Text>
                  </div>
                </Card>
              </Link>
            </Col>
            <Col xs={24} md={6}>
              <Link href={`/admin/personnel/${personnelId}/military-flag`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  bodyStyle={{
                    padding: '24px',
                    minHeight: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <TrophyOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      Huy chương QKQT
                    </Text>
                  </div>
                </Card>
              </Link>
            </Col>
            <Col xs={24} md={6}>
              <Link href={`/admin/personnel/${personnelId}/commemoration-medals`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  bodyStyle={{
                    padding: '24px',
                    minHeight: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <TrophyOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      Kỷ niệm chương VSNXD QĐNDVN
                    </Text>
                  </div>
                </Card>
              </Link>
            </Col>
            <Col xs={24} md={6}>
              <Link href={`/admin/personnel/${personnelId}/contribution-awards`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  bodyStyle={{
                    padding: '24px',
                    minHeight: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <TrophyOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      Huân chương Bảo vệ Tổ quốc
                    </Text>
                  </div>
                </Card>
              </Link>
            </Col>
          </Row>
        </div>
      ),
    },
  ];

  return (
    <ConfigProvider theme={getAntdThemeConfig(isDark)}>
      <div className="p-6 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { title: <Link href="/admin/dashboard">Dashboard</Link> },
            { title: <Link href="/admin/personnel">Quân nhân</Link> },
            { title: personnel.ho_ten },
          ]}
        />

        {/* Header Card */}
        <Card className="shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <UserOutlined className="text-3xl text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <Title level={3} className="!mb-1">
                  {personnel.ho_ten}
                </Title>
                <div>
                  <Text type="secondary">{personnel.cccd}</Text>
                </div>
                <div>
                  <Text type="secondary">{personnel.ChucVu?.ten_chuc_vu || '-'}</Text>
                </div>
              </div>
            </div>
            <Space>
              <Link href="/admin/personnel">
                <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
              </Link>
              <Link href={`/admin/personnel/${personnelId}/edit`}>
                <Button type="primary" icon={<EditOutlined />}>
                  Chỉnh sửa
                </Button>
              </Link>
            </Space>
          </div>
        </Card>

        {/* Main Content Tabs */}
        <Card className="shadow-sm">
          <Tabs
            activeKey={activeTab}
            onChange={key => {
              router.push(`/admin/personnel/${personnelId}?tab=${key}`);
            }}
            className={`${styles.personnelTabs} ${isDark ? styles.dark : styles.light}`}
            items={tabItems}
            tabBarGutter={32}
            centered
            tabBarStyle={{ marginBottom: 24 }}
            moreIcon={null}
            renderTabBar={(props, DefaultTabBar) => <DefaultTabBar {...props} />}
          />
        </Card>
      </div>
    </ConfigProvider>
  );
}
