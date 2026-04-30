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
import { getApiErrorMessage } from '@/lib/apiError';
import {
  ArrowLeftOutlined,
  EditOutlined,
  UserOutlined,
  TeamOutlined,
  TrophyOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  SafetyOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { MedalProgressCard } from '@/components/personnel/MedalProgressCard';
import { getAntdThemeConfig } from '@/lib/antdTheme';
import { apiClient } from '@/lib/apiClient';
import { formatDate } from '@/lib/utils';
import { getReceivedMonthYearText } from '@/lib/award/medalDisplay';
import styles from './personnel-detail.module.css';
import { ROLES, getRoleInfo } from '@/constants/roles.constants';
import type {
  PersonnelDetail,
  ServiceProfile,
  AnnualProfile,
  ContributionProfile,
  MedalData,
} from '@/lib/types/personnelList';
import { useAuth } from '@/contexts/AuthContext';
import {
  ELIGIBILITY_STATUS,
  ELIGIBILITY_STATUS_MAP,
} from '@/constants/eligibilityStatus.constants';
import {
  DANH_HIEU_MAP,
  AWARD_TAB_LABELS,
  HCQKQT_YEARS_REQUIRED,
  KNC_YEARS_REQUIRED_NAM,
  KNC_YEARS_REQUIRED_NU,
} from '@/constants/danhHieu.constants';

interface PersonnelDetailViewProps {
  role: 'admin' | 'manager';
}

const { Title, Text } = Typography;

export function PersonnelDetailView({ role }: PersonnelDetailViewProps) {
  const { isDark } = useTheme();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const personnelId = params?.id as string;
  const activeTab = searchParams?.get('tab') || '1';
  const { user } = useAuth();
  const basePath = `/${role}`;

  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<PersonnelDetail | null>(null);
  const [serviceProfile, setServiceProfile] = useState<ServiceProfile | null>(null);
  const [annualProfile, setAnnualProfile] = useState<AnnualProfile | null>(null);
  const [contributionProfile, setContributionProfile] = useState<ContributionProfile | null>(null);
  const [militaryFlag, setMilitaryFlag] = useState<MedalData | null>(null);
  const [commemorationMedals, setCommemorationMedals] = useState<MedalData | null>(null);

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
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, 'Lỗi khi lấy thông tin'));
      } finally {
        setLoading(false);
      }
    };

    if (personnelId) {
      fetchData();
    }
  }, [personnelId]);

  const getStatusTag = (status: string | undefined) => {
    const s =
      ELIGIBILITY_STATUS_MAP[status ?? ''] || ELIGIBILITY_STATUS_MAP[ELIGIBILITY_STATUS.CHUA_DU];
    return <Tag color={s.color}>{s.label}</Tag>;
  };

  const calculateYearsOfService = (ngayNhapNgu: string) => {
    if (!ngayNhapNgu) return 0;
    const now = new Date();
    const nhapNgu = new Date(ngayNhapNgu);
    const months =
      (now.getFullYear() - nhapNgu.getFullYear()) * 12 + now.getMonth() - nhapNgu.getMonth();
    return Math.floor(Math.max(0, months) / 12);
  };

  const convertMonthsToYearsAndMonths = (totalMonths: number) => {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return { years, months };
  };

  const canEdit =
    role === 'admin' ||
    user?.quan_nhan_id === personnelId ||
    personnel?.TaiKhoan?.role === ROLES.USER;

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
          <Link href={`${basePath}/personnel`}>
            <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
          </Link>
        </div>
      </ConfigProvider>
    );
  }

  const usernameValue =
    role === 'admin' ? (
      <Link href="/admin/accounts" className="text-blue-500 hover:underline">
        {personnel.TaiKhoan!.username}
      </Link>
    ) : (
      personnel.TaiKhoan!.username
    );

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
                  { label: 'Username', value: usernameValue },
                  {
                    label: 'Vai trò',
                    value: (
                      <Tag color={getRoleInfo(personnel.TaiKhoan.role).color}>
                        {getRoleInfo(personnel.TaiKhoan.role).label}
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
          {serviceProfile && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <SafetyOutlined /> Hồ sơ khen thưởng niên hạn
                </span>
              }
              size="small"
            >
              <div className="mb-6">
                <Text strong className="text-base">
                  {AWARD_TAB_LABELS.HCCSVV}
                </Text>
                <Divider className="my-3" />
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="hạng Ba"
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
                        title="hạng Nhì"
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
                        title="hạng Nhất"
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
                {serviceProfile.goi_y && (
                  <>
                    <Divider className="my-4" />
                    <Card size="small" className="bg-blue-50 dark:bg-gray-800">
                      <Text strong>💡 Gợi ý: </Text>
                      <Text>{serviceProfile.goi_y}</Text>
                    </Card>
                  </>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <MedalProgressCard
                      title={DANH_HIEU_MAP.HC_QKQT}
                      isDark={isDark}
                      hasReceived={!!militaryFlag?.hasReceived}
                      receivedAt={getReceivedMonthYearText(militaryFlag)}
                      yearsRequired={HCQKQT_YEARS_REQUIRED}
                      yearsOfService={calculateYearsOfService(personnel.ngay_nhap_ngu)}
                      receivedStatusTag={getStatusTag(ELIGIBILITY_STATUS.DA_NHAN)}
                    />
                  </Col>
                  <Col xs={24} md={12}>
                    <MedalProgressCard
                      title={DANH_HIEU_MAP.KNC_VSNXD_QDNDVN}
                      isDark={isDark}
                      hasReceived={!!commemorationMedals?.hasReceived}
                      receivedAt={getReceivedMonthYearText(commemorationMedals)}
                      yearsRequired={
                        personnel.gioi_tinh === 'NAM'
                          ? KNC_YEARS_REQUIRED_NAM
                          : KNC_YEARS_REQUIRED_NU
                      }
                      yearsOfService={calculateYearsOfService(personnel.ngay_nhap_ngu)}
                      receivedStatusTag={getStatusTag(ELIGIBILITY_STATUS.DA_NHAN)}
                    />
                  </Col>
                </Row>
              </div>
            </Card>
          )}

          {contributionProfile && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <SafetyOutlined /> Hồ sơ cống hiến
                </span>
              }
              size="small"
            >
              <Text strong className="text-base">
                {DANH_HIEU_MAP.HCBVTQ_HANG_NHAT.replace(' hạng Nhất', '')}
              </Text>
              <Divider className="my-3" />
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Card size="small" className="h-full">
                    <Statistic
                      title="Tháng tích lũy 0.7"
                      value={(() => {
                        const { years, months } = convertMonthsToYearsAndMonths(
                          contributionProfile?.months_07 || 0
                        );
                        return `${years} năm ${months} tháng`;
                      })()}
                      valueRender={node => (
                        <span className="text-green-700 dark:text-emerald-300">{node}</span>
                      )}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" className="h-full">
                    <Statistic
                      title="Tháng tích lũy 0.8"
                      value={(() => {
                        const { years, months } = convertMonthsToYearsAndMonths(
                          contributionProfile?.months_08 || 0
                        );
                        return `${years} năm ${months} tháng`;
                      })()}
                      valueRender={node => (
                        <span className="text-green-700 dark:text-emerald-300">{node}</span>
                      )}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" className="h-full">
                    <Statistic
                      title="Tháng tích lũy 0.9-1.0"
                      value={(() => {
                        const { years, months } = convertMonthsToYearsAndMonths(
                          contributionProfile?.months_0910 || 0
                        );
                        return `${years} năm ${months} tháng`;
                      })()}
                      valueRender={node => (
                        <span className="text-green-700 dark:text-emerald-300">{node}</span>
                      )}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" className="h-full">
                    <Statistic
                      title="hạng Ba"
                      value={0}
                      valueStyle={{ fontSize: '14px' }}
                      valueRender={() => getStatusTag(contributionProfile?.hcbvtq_hang_ba_status)}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" className="h-full">
                    <Statistic
                      title="hạng Nhì"
                      value={0}
                      valueStyle={{ fontSize: '14px' }}
                      valueRender={() => getStatusTag(contributionProfile?.hcbvtq_hang_nhi_status)}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" className="h-full">
                    <Statistic
                      title="hạng Nhất"
                      value={0}
                      valueStyle={{ fontSize: '14px' }}
                      valueRender={() =>
                        getStatusTag(contributionProfile?.hcbvtq_hang_nhat_status)
                      }
                    />
                  </Card>
                </Col>
              </Row>
            </Card>
          )}

          {annualProfile && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <TrophyOutlined /> Hồ sơ Hằng năm
                </span>
              }
              size="small"
            >
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
                        valueRender={node => (
                          <span className="text-blue-500 dark:text-blue-400">{node}</span>
                        )}
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
                        value={
                          Array.isArray(annualProfile.tong_nckh)
                            ? annualProfile.tong_nckh.length
                            : annualProfile.tong_nckh || 0
                        }
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                </Row>
              </div>

              <div>
                <Text strong className="text-base">
                  Điều kiện khen thưởng
                </Text>
                <Divider className="my-3" />
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                    <Card size="small">
                      <Statistic
                        title="Chiến sĩ thi đua Toàn quân"
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
                        title="Bằng khen của Thủ tướng Chính phủ"
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
              <Link href={`${basePath}/personnel/${personnelId}/position-history`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  styles={{
                    body: {
                      padding: '24px',
                      minHeight: '120px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
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
              <Link href={`${basePath}/personnel/${personnelId}/annual-rewards`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  styles={{
                    body: {
                      padding: '24px',
                      minHeight: '120px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
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
              <Link href={`${basePath}/personnel/${personnelId}/scientific-achievements`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  styles={{
                    body: {
                      padding: '24px',
                      minHeight: '120px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <ExperimentOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      Thành tích Nghiên cứu khoa học
                    </Text>
                  </div>
                </Card>
              </Link>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <Link href={`${basePath}/personnel/${personnelId}/tenure-medals`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  styles={{
                    body: {
                      padding: '24px',
                      minHeight: '120px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <SafetyOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      {AWARD_TAB_LABELS.HCCSVV}
                    </Text>
                  </div>
                </Card>
              </Link>
            </Col>
            <Col xs={24} md={6}>
              <Link href={`${basePath}/personnel/${personnelId}/military-flag`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  styles={{
                    body: {
                      padding: '24px',
                      minHeight: '120px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <TrophyOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      {AWARD_TAB_LABELS.HCQKQT}
                    </Text>
                  </div>
                </Card>
              </Link>
            </Col>
            <Col xs={24} md={6}>
              <Link href={`${basePath}/personnel/${personnelId}/commemoration-medals`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  styles={{
                    body: {
                      padding: '24px',
                      minHeight: '120px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <TrophyOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      {DANH_HIEU_MAP.KNC_VSNXD_QDNDVN}
                    </Text>
                  </div>
                </Card>
              </Link>
            </Col>
            <Col xs={24} md={6}>
              <Link href={`${basePath}/personnel/${personnelId}/contribution-medals`}>
                <Card
                  hoverable
                  className="text-center h-full"
                  styles={{
                    body: {
                      padding: '24px',
                      minHeight: '120px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  }}
                >
                  <div className="flex flex-col items-center gap-2">
                    <TrophyOutlined style={{ fontSize: '32px' }} />
                    <Text strong style={{ fontSize: '16px' }}>
                      {AWARD_TAB_LABELS.HCBVTQ}
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
        <Breadcrumb
          items={[
            {
              title: (
                <Link href={`${basePath}/dashboard`}>
                  <HomeOutlined />
                </Link>
              ),
            },
            { title: <Link href={`${basePath}/personnel`}>Quân nhân</Link> },
            { title: personnel.ho_ten },
          ]}
        />

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
              <Link href={`${basePath}/personnel`}>
                <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
              </Link>
              {canEdit && (
                <Link href={`${basePath}/personnel/${personnelId}/edit`}>
                  <Button type="primary" icon={<EditOutlined />}>
                    Chỉnh sửa
                  </Button>
                </Link>
              )}
            </Space>
          </div>
        </Card>

        <Card className="shadow-sm">
          <Tabs
            activeKey={activeTab}
            onChange={key => {
              router.push(`${basePath}/personnel/${personnelId}?tab=${key}`);
            }}
            className={`${styles.personnelTabs} ${isDark ? styles.dark : styles.light}`}
            items={tabItems}
            tabBarGutter={32}
            centered
            tabBarStyle={{ marginBottom: 24 }}
            moreIcon={null}
          />
        </Card>
      </div>
    </ConfigProvider>
  );
}
