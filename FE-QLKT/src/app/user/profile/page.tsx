'use client';

import { useState, useEffect, ReactNode } from 'react';
import {
  Card,
  Tabs,
  Table,
  Typography,
  Tag,
  Breadcrumb,
  Spin,
  Alert,
  message,
  ConfigProvider,
  Row,
  Col,
  Statistic,
  Divider,
  Empty,
} from 'antd';
import { getAntdThemeConfig } from '@/lib/antdTheme';
import {
  TrophyOutlined,
  StarOutlined,
  UserOutlined,
  SafetyOutlined,
  CrownOutlined,
  FireOutlined,
  FileTextOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/lib/constants/pagination.constants';
import { calculateDuration, formatDate } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { downloadDecisionFile } from '@/utils/downloadDecisionFile';
import { useAuth } from '@/contexts/AuthContext';
import { PROPOSAL_STATUS, getProposalStatusLabel } from '@/constants/proposal.constants';
import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';

const { Title, Text } = Typography;

export default function UserProfilePage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [personnelId, setPersonnelId] = useState<string | null>(null);
  const [personnelInfo, setPersonnelInfo] = useState<any>(null);
  const [annualRewards, setAnnualRewards] = useState<any[]>([]);
  const [scientificAchievements, setScientificAchievements] = useState<any[]>([]);
  const [positionHistory, setPositionHistory] = useState<any[]>([]);
  const [adhocAwards, setAdhocAwards] = useState<any[]>([]);
  const [serviceProfile, setServiceProfile] = useState<any>(null);
  const [annualProfile, setAnnualProfile] = useState<any>(null);
  const [contributionProfile, setContributionProfile] = useState<any>(null);
  const [militaryFlag, setMilitaryFlag] = useState<any>(null);
  const [commemorationMedals, setCommemorationMedals] = useState<any>(null);

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

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      DA_NHAN: { label: 'Đã nhận', color: 'green' },
      DU_DIEU_KIEN: { label: 'Đủ điều kiện', color: 'orange' },
      CHUA_DU: { label: 'Chưa đủ', color: 'default' },
    };
    const s = statusMap[status] || statusMap.CHUA_DU;
    return <Tag color={s.color}>{s.label}</Tag>;
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

  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        if (!user?.quan_nhan_id) {
          message.error('Không tìm thấy thông tin quân nhân.');
          return;
        }

        setPersonnelId(user.quan_nhan_id);
        const currentYear = new Date().getFullYear();

        const [
          personnelRes,
          annualRes,
          scientificRes,
          positionRes,
          adhocRes,
          serviceRes,
          annualProfileRes,
          contributionRes,
          militaryRes,
          commRes,
        ] = await Promise.all([
          apiClient.getPersonnelById(user.quan_nhan_id),
          apiClient.getAnnualRewardsByPersonnel(user.quan_nhan_id),
          apiClient.getPersonnelScientificAchievements(user.quan_nhan_id),
          apiClient.getPositionHistory(user.quan_nhan_id),
          apiClient.getAdhocAwardsByPersonnel(user.quan_nhan_id),
          apiClient.getServiceProfile(user.quan_nhan_id),
          apiClient.getAnnualProfile(user.quan_nhan_id, currentYear),
          apiClient.getContributionProfile(user.quan_nhan_id),
          apiClient.getMilitaryFlagByPersonnel(user.quan_nhan_id),
          apiClient.getCommemorationMedalsByPersonnel(user.quan_nhan_id),
        ]);

        if (personnelRes.success) {
          setPersonnelInfo(personnelRes.data);
        }

        if (annualRes.success) {
          setAnnualRewards(annualRes.data || []);
        }

        if (scientificRes.success) {
          setScientificAchievements(scientificRes.data || []);
        }

        if (positionRes.success) {
          setPositionHistory(positionRes.data || []);
        }

        if (adhocRes.success) {
          setAdhocAwards(adhocRes.data || []);
        }

        if (serviceRes.success) {
          setServiceProfile(serviceRes.data);
        }

        if (annualProfileRes.success) {
          setAnnualProfile(annualProfileRes.data);
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
        message.error('Không thể tải dữ liệu hồ sơ');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const annualRewardsColumns = [
    {
      title: 'STT',
      key: 'index',
      width: 80,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 100,
      align: 'center' as const,
      sorter: (a: any, b: any) => a.nam - b.nam,
    },
    {
      title: 'Danh hiệu',
      dataIndex: 'danh_hieu',
      key: 'danh_hieu',
      width: 300,
      align: 'center' as const,
      render: (text: string, record: any) => {
        if (!text) return '-';

        const decisions: ReactNode[] = [];

        if (record.so_quyet_dinh_bkbqp && record.so_quyet_dinh_bkbqp.trim() !== '') {
          decisions.push(
            <div key="bkbqp" style={{ marginTop: '8px', fontSize: '13px', textAlign: 'center' }}>
              <Text type="secondary">Bằng khen BQP:</Text>{' '}
              <a
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenDecisionFile(record.so_quyet_dinh_bkbqp);
                }}
                style={{
                  color: '#52c41a',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {record.so_quyet_dinh_bkbqp}
              </a>
            </div>
          );
        }

        if (record.so_quyet_dinh_cstdtq && record.so_quyet_dinh_cstdtq.trim() !== '') {
          decisions.push(
            <div key="cstdtq" style={{ marginTop: '8px', fontSize: '13px', textAlign: 'center' }}>
              <Text type="secondary">CSTĐ Toàn quân:</Text>{' '}
              <a
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenDecisionFile(record.so_quyet_dinh_cstdtq);
                }}
                style={{
                  color: '#52c41a',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {record.so_quyet_dinh_cstdtq}
              </a>
            </div>
          );
        }

        if (record.so_quyet_dinh_bkttcp && record.so_quyet_dinh_bkttcp.trim() !== '') {
          decisions.push(
            <div key="bkttcp" style={{ marginTop: '8px', fontSize: '13px', textAlign: 'center' }}>
              <Text type="secondary">BKTTCP:</Text>{' '}
              <a
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenDecisionFile(record.so_quyet_dinh_bkttcp);
                }}
                style={{
                  color: '#52c41a',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {record.so_quyet_dinh_bkttcp}
              </a>
            </div>
          );
        }

        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 500 }}>{text}</div>
            {decisions.length > 0 && <div>{decisions}</div>}
          </div>
        );
      },
    },
  ];

  const scientificColumns = [
    {
      title: 'STT',
      key: 'index',
      width: 80,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 100,
      align: 'center' as const,
      sorter: (a: any, b: any) => a.nam - b.nam,
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      key: 'loai',
      width: 120,
      align: 'center' as const,
      render: (text: string) => text || '-',
    },
    {
      title: 'Mô tả',
      dataIndex: 'mo_ta',
      key: 'mo_ta',
      minWidth: 200,
      align: 'center' as const,
      ellipsis: {
        showTitle: false,
      },
      render: (text: string) => (
        <span title={text} style={{ display: 'block', maxWidth: '100%' }}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 150,
      align: 'center' as const,
      render: (text: string, record: any) => {
        if (!text || text.trim() === '') return '-';
        return (
          <a
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              handleOpenDecisionFile(text);
            }}
            style={{
              color: '#52c41a',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {text}
          </a>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center' as const,
      render: (text: string) => {
        const label = getProposalStatusLabel(text);
        if (text === PROPOSAL_STATUS.APPROVED) {
          return <span style={{ color: '#52c41a' }}>{label}</span>;
        }
        if (text === PROPOSAL_STATUS.REJECTED) {
          return <span style={{ color: '#ff4d4f' }}>{label}</span>;
        }
        return <span style={{ color: '#faad14' }}>{label}</span>;
      },
    },
  ];

  const positionHistoryColumns = [
    {
      title: 'STT',
      key: 'index',
      width: 80,
      align: 'center' as const,
      fixed: 'left' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Chức vụ',
      dataIndex: 'ChucVu',
      key: 'ChucVu',
      width: 200,
      align: 'center' as const,
      render: (chucVu: any) => chucVu?.ten_chuc_vu || 'N/A',
    },
    {
      title: 'Hệ số chức vụ',
      dataIndex: 'ChucVu',
      key: 'he_so_chuc_vu',
      width: 130,
      align: 'center' as const,
      render: (chucVu: any) => chucVu?.he_so_chuc_vu || 'N/A',
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'ngay_bat_dau',
      key: 'ngay_bat_dau',
      width: 130,
      align: 'center' as const,
      render: (date: string) => (date ? formatDate(date) : 'N/A'),
    },
    {
      title: 'Ngày kết thúc',
      dataIndex: 'ngay_ket_thuc',
      key: 'ngay_ket_thuc',
      width: 130,
      align: 'center' as const,
      render: (date: string) => (date ? formatDate(date) : 'Hiện tại'),
    },
    {
      title: 'Thời gian',
      key: 'duration',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: any) => {
        if (!record.ngay_bat_dau) return '-';
        return calculateDuration(record.ngay_bat_dau, record.ngay_ket_thuc);
      },
    },
  ];

  const adhocColumns = [
    {
      title: 'STT',
      key: 'index',
      width: 80,
      align: 'center' as const,
      fixed: 'left' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Hình thức khen thưởng',
      dataIndex: 'hinh_thuc_khen_thuong',
      key: 'hinh_thuc_khen_thuong',
      width: 200,
      align: 'center' as const,
      ellipsis: {
        showTitle: false,
      },
      render: (text: string) => (
        <span title={text} style={{ display: 'block', maxWidth: '100%' }}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 100,
      align: 'center' as const,
      sorter: (a: any, b: any) => a.nam - b.nam,
    },
    {
      title: 'Cấp bậc',
      dataIndex: 'cap_bac',
      key: 'cap_bac',
      width: 120,
      align: 'center' as const,
      render: (text: string) => text || '-',
    },
    {
      title: 'Chức vụ',
      dataIndex: 'chuc_vu',
      key: 'chuc_vu',
      width: 150,
      align: 'center' as const,
      ellipsis: {
        showTitle: false,
      },
      render: (text: string) => (
        <span title={text} style={{ display: 'block', maxWidth: '100%' }}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 180,
      align: 'center' as const,
      render: (text: string, record: any) => {
        if (!text || text.trim() === '') return '-';

        return (
          <a
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              handleOpenDecisionFile(text);
            }}
            style={{
              color: '#52c41a',
              fontWeight: 500,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            {text}
          </a>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!personnelInfo) {
    return (
      <ConfigProvider theme={getAntdThemeConfig(isDark)}>
        <div className="space-y-4 p-6">
          <Title level={2}>Không tìm thấy thông tin</Title>
          <Alert message="Không thể tải thông tin cá nhân" type="error" />
        </div>
      </ConfigProvider>
    );
  }

  const tabItems = [
    {
      key: '1',
      label: 'Hồ sơ khen thưởng',
      children: (
        <div className="space-y-6">
          {/* Hồ sơ khen thưởng niên hạn */}
          {serviceProfile && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <SafetyOutlined /> Hồ sơ khen thưởng niên hạn
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
                            contributionProfile?.months_07 || 0
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
                            contributionProfile?.months_08 || 0
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
                            contributionProfile?.months_0910 || 0
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
                        valueRender={() => getStatusTag(contributionProfile?.hcbvtq_hang_ba_status)}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Hạng Nhì"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() =>
                          getStatusTag(contributionProfile?.hcbvtq_hang_nhi_status)
                        }
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
                          getStatusTag(contributionProfile?.hcbvtq_hang_nhat_status)
                        }
                      />
                    </Card>
                  </Col>
                </Row>
              </div>
              {/* HC Quân kỳ Quyết thắng */}
              <div className="mb-6">
                <Text strong className="text-base">
                  Huy chương Quân kỳ Quyết thắng
                </Text>
                <Divider className="my-3" />
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={24}>
                    <Card size="small" className="h-full">
                      <Statistic
                        title="Huy chương Quân kỳ Quyết thắng"
                        value={0}
                        valueStyle={{ fontSize: '14px' }}
                        valueRender={() => {
                          const hasReceived = militaryFlag && militaryFlag.hasReceived;
                          if (hasReceived) {
                            return getStatusTag(ELIGIBILITY_STATUS.DA_NHAN);
                          } else {
                            const yearsRequired = 25;
                            const yearsOfService = calculateYearsOfService(
                              personnelInfo.ngay_nhap_ngu
                            );
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
                            return getStatusTag(ELIGIBILITY_STATUS.DA_NHAN);
                          } else {
                            const yearsRequired = personnelInfo.gioi_tinh === 'NAM' ? 25 : 20;
                            const yearsOfService = calculateYearsOfService(
                              personnelInfo.ngay_nhap_ngu
                            );
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
                        value={
                          Array.isArray(annualProfile.tong_nckh)
                            ? annualProfile.tong_nckh.length
                            : annualProfile.tong_nckh || 0
                        }
                        suffix=""
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
                        title="Bằng khen của Bộ trưởng Bộ Quốc phòng"
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
                        title="BK Thủ tướng Chính phủ"
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
      key: '2',
      label: 'Danh hiệu cá nhân hằng năm',
      children: (
        <div className="space-y-4">
          {annualRewards.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                  Chưa có dữ liệu danh hiệu hằng năm
                </span>
              }
              style={{ padding: '60px 0' }}
            />
          ) : (
            <div className="space-y-5">
              {/* Summary Stats */}
              <Row gutter={[16, 16]} className="mb-6" style={{ display: 'flex', flexWrap: 'wrap' }}>
                <Col
                  xs={24}
                  sm={12}
                  style={{ flex: '1 1 20%', minWidth: 0 }}
                  className="summary-stat-col"
                >
                  <Card
                    size="small"
                    className="text-center"
                    style={{
                      background: isDark
                        ? 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)'
                        : 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
                      border: 'none',
                    }}
                  >
                    <Statistic
                      title={
                        <span style={{ color: isDark ? '#93c5fd' : '#1e40af' }}>Tổng số năm</span>
                      }
                      value={
                        Object.keys(
                          annualRewards.reduce((acc: Record<number, any[]>, r: any) => {
                            if (!acc[r.nam]) acc[r.nam] = [];
                            acc[r.nam].push(r);
                            return acc;
                          }, {})
                        ).length
                      }
                      valueStyle={{ color: isDark ? '#60a5fa' : '#2563eb', fontWeight: 700 }}
                    />
                  </Card>
                </Col>
                <Col
                  xs={24}
                  sm={12}
                  style={{ flex: '1 1 20%', minWidth: 0 }}
                  className="summary-stat-col"
                >
                  <Card
                    size="small"
                    className="text-center"
                    style={{
                      background: isDark
                        ? 'linear-gradient(135deg, #134e4a 0%, #1e293b 100%)'
                        : 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)',
                      border: 'none',
                    }}
                  >
                    <Statistic
                      title={
                        <span style={{ color: isDark ? '#6ee7b7' : '#047857' }}>CSTĐ Cơ sở</span>
                      }
                      value={annualRewards.filter((r: any) => r.danh_hieu === 'CSTDCS').length}
                      valueStyle={{ color: isDark ? '#34d399' : '#059669', fontWeight: 700 }}
                    />
                  </Card>
                </Col>
                <Col
                  xs={24}
                  sm={12}
                  style={{ flex: '1 1 20%', minWidth: 0 }}
                  className="summary-stat-col"
                >
                  <Card
                    size="small"
                    className="text-center"
                    style={{
                      background: isDark
                        ? 'linear-gradient(135deg, #713f12 0%, #1e293b 100%)'
                        : 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
                      border: 'none',
                    }}
                  >
                    <Statistic
                      title={
                        <span style={{ color: isDark ? '#fcd34d' : '#b45309' }}>
                          Bằng khen của Bộ trưởng BQP
                        </span>
                      }
                      value={annualRewards.filter((r: any) => r.nhan_bkbqp).length}
                      valueStyle={{ color: isDark ? '#fbbf24' : '#d97706', fontWeight: 700 }}
                    />
                  </Card>
                </Col>
                <Col
                  xs={24}
                  sm={12}
                  style={{ flex: '1 1 20%', minWidth: 0 }}
                  className="summary-stat-col"
                >
                  <Card
                    size="small"
                    className="text-center"
                    style={{
                      background: isDark
                        ? 'linear-gradient(135deg, #7c2d12 0%, #1e293b 100%)'
                        : 'linear-gradient(135deg, #fed7aa 0%, #fff7ed 100%)',
                      border: 'none',
                    }}
                  >
                    <Statistic
                      title={
                        <span style={{ color: isDark ? '#fb923c' : '#c2410c' }}>
                          CSTĐ Toàn quân
                        </span>
                      }
                      value={annualRewards.filter((r: any) => r.nhan_cstdtq).length}
                      valueStyle={{ color: isDark ? '#fb923c' : '#ea580c', fontWeight: 700 }}
                    />
                  </Card>
                </Col>
                <Col
                  xs={24}
                  sm={12}
                  style={{ flex: '1 1 20%', minWidth: 0 }}
                  className="summary-stat-col"
                >
                  <Card
                    size="small"
                    className="text-center"
                    style={{
                      background: isDark
                        ? 'linear-gradient(135deg, #78350f 0%, #1e293b 100%)'
                        : 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
                      border: 'none',
                    }}
                  >
                    <Statistic
                      title={
                        <span style={{ color: isDark ? '#fcd34d' : '#b45309' }}>
                          BK của Thủ tướng Chính phủ
                        </span>
                      }
                      value={annualRewards.filter((r: any) => r.nhan_bkttcp).length}
                      valueStyle={{ color: isDark ? '#fbbf24' : '#d97706', fontWeight: 700 }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* Timeline View */}
              <div className="relative">
                {/* Timeline line */}
                <div
                  className="absolute left-6 top-0 bottom-0 w-0.5"
                  style={{
                    backgroundColor: isDark ? '#374151' : '#e5e7eb',
                    marginLeft: '7px',
                  }}
                />

                {Object.entries(
                  annualRewards.reduce((acc: Record<number, any[]>, reward: any) => {
                    const year = reward.nam;
                    if (!acc[year]) {
                      acc[year] = [];
                    }
                    acc[year].push(reward);
                    return acc;
                  }, {})
                )
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([year, rewards]: [string, any[]]) => (
                    <div key={year} className="relative pl-16 pb-6">
                      {/* Year marker */}
                      <div
                        className="absolute left-0 flex items-center justify-center w-14 h-14 rounded-full shadow-lg"
                        style={{
                          background: isDark
                            ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          top: '0px',
                        }}
                      >
                        <span className="text-white font-bold text-lg">{year}</span>
                      </div>

                      {/* Year content card */}
                      <Card
                        size="small"
                        className="shadow-md hover:shadow-lg transition-shadow duration-300"
                        style={{
                          borderRadius: '12px',
                          border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                          background: isDark ? '#1f2937' : '#ffffff',
                        }}
                      >
                        <div className="space-y-4">
                          {rewards.flatMap((reward: any) => {
                            const items: ReactNode[] = [];

                            if (reward.danh_hieu) {
                              const danhHieuConfig = {
                                CSTDCS: {
                                  text: 'Chiến sĩ thi đua cơ sở',
                                  icon: <StarOutlined />,
                                  color: isDark ? '#34d399' : '#059669',
                                  bgColor: isDark
                                    ? 'rgba(52, 211, 153, 0.1)'
                                    : 'rgba(5, 150, 105, 0.1)',
                                  borderColor: isDark ? '#10b981' : '#059669',
                                },
                                CSTT: {
                                  text: 'Chiến sĩ tiên tiến',
                                  icon: <FireOutlined />,
                                  color: isDark ? '#60a5fa' : '#2563eb',
                                  bgColor: isDark
                                    ? 'rgba(96, 165, 250, 0.1)'
                                    : 'rgba(37, 99, 235, 0.1)',
                                  borderColor: isDark ? '#3b82f6' : '#2563eb',
                                },
                              };

                              const config = danhHieuConfig[
                                reward.danh_hieu as keyof typeof danhHieuConfig
                              ] || {
                                text: reward.danh_hieu,
                                icon: <TrophyOutlined />,
                                color: isDark ? '#9ca3af' : '#6b7280',
                                bgColor: isDark
                                  ? 'rgba(156, 163, 175, 0.1)'
                                  : 'rgba(107, 114, 128, 0.1)',
                                borderColor: isDark ? '#6b7280' : '#9ca3af',
                              };

                              items.push(
                                <div
                                  key={`${reward.id}-danh-hieu`}
                                  className="flex items-start gap-3 p-3 rounded-lg transition-all hover:scale-[1.01]"
                                  style={{
                                    background: config.bgColor,
                                    border: `1px solid ${config.borderColor}`,
                                  }}
                                >
                                  <div
                                    className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
                                    style={{
                                      backgroundColor: config.color,
                                      color: '#fff',
                                    }}
                                  >
                                    {config.icon}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className="font-semibold text-base"
                                      style={{ color: config.color }}
                                    >
                                      {config.text}
                                    </div>
                                    {reward.so_quyet_dinh && reward.so_quyet_dinh.trim() !== '' && (
                                      <div
                                        className="flex items-center gap-1.5 mt-1"
                                        style={{
                                          color: isDark ? '#9ca3af' : '#6b7280',
                                          fontSize: '13px',
                                        }}
                                      >
                                        <FileTextOutlined style={{ fontSize: '12px' }} />
                                        <span>Số QĐ: </span>
                                        <a
                                          onClick={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleOpenDecisionFile(reward.so_quyet_dinh);
                                          }}
                                          className="hover:underline"
                                          style={{ color: '#52c41a', cursor: 'pointer' }}
                                        >
                                          {reward.so_quyet_dinh}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                                                if (
                              reward.nhan_bkbqp &&
                              reward.so_quyet_dinh_bkbqp &&
                              reward.so_quyet_dinh_bkbqp.trim() !== ''
                            ) {
                              items.push(
                                <div
                                  key={`${reward.id}-bkbqp`}
                                  className="flex items-start gap-3 p-3 rounded-lg transition-all hover:scale-[1.01]"
                                  style={{
                                    background: isDark
                                      ? 'rgba(251, 191, 36, 0.1)'
                                      : 'rgba(217, 119, 6, 0.1)',
                                    border: `1px solid ${isDark ? '#f59e0b' : '#d97706'}`,
                                  }}
                                >
                                  <div
                                    className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
                                    style={{
                                      backgroundColor: isDark ? '#f59e0b' : '#d97706',
                                      color: '#fff',
                                    }}
                                  >
                                    <CrownOutlined />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className="font-semibold text-base"
                                      style={{ color: isDark ? '#fbbf24' : '#b45309' }}
                                    >
                                      Bằng khen của Bộ trưởng Bộ Quốc phòng
                                    </div>
                                    <div
                                      className="flex items-center gap-1.5 mt-1"
                                      style={{
                                        color: isDark ? '#9ca3af' : '#6b7280',
                                        fontSize: '13px',
                                      }}
                                    >
                                      <FileTextOutlined style={{ fontSize: '12px' }} />
                                      <span>Số QĐ: </span>
                                      <a
                                        onClick={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleOpenDecisionFile(reward.so_quyet_dinh_bkbqp);
                                        }}
                                        className="hover:underline"
                                        style={{ color: '#52c41a', cursor: 'pointer' }}
                                      >
                                        {reward.so_quyet_dinh_bkbqp}
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                                                if (
                              reward.nhan_cstdtq &&
                              reward.so_quyet_dinh_cstdtq &&
                              reward.so_quyet_dinh_cstdtq.trim() !== ''
                            ) {
                              items.push(
                                <div
                                  key={`${reward.id}-cstdtq`}
                                  className="flex items-start gap-3 p-3 rounded-lg transition-all hover:scale-[1.01]"
                                  style={{
                                    background: isDark
                                      ? 'rgba(251, 146, 60, 0.1)'
                                      : 'rgba(234, 88, 12, 0.1)',
                                    border: `1px solid ${isDark ? '#fb923c' : '#ea580c'}`,
                                  }}
                                >
                                  <div
                                    className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
                                    style={{
                                      backgroundColor: isDark ? '#fb923c' : '#ea580c',
                                      color: '#fff',
                                    }}
                                  >
                                    <TrophyOutlined />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className="font-semibold text-base"
                                      style={{ color: isDark ? '#fb923c' : '#c2410c' }}
                                    >
                                      Chiến sĩ thi đua Toàn quân
                                    </div>
                                    <div
                                      className="flex items-center gap-1.5 mt-1"
                                      style={{
                                        color: isDark ? '#9ca3af' : '#6b7280',
                                        fontSize: '13px',
                                      }}
                                    >
                                      <FileTextOutlined style={{ fontSize: '12px' }} />
                                      <span>Số QĐ: </span>
                                      <a
                                        onClick={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleOpenDecisionFile(reward.so_quyet_dinh_cstdtq);
                                        }}
                                        className="hover:underline"
                                        style={{ color: '#52c41a', cursor: 'pointer' }}
                                      >
                                        {reward.so_quyet_dinh_cstdtq}
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                                                if (
                              reward.nhan_bkttcp &&
                              reward.so_quyet_dinh_bkttcp &&
                              reward.so_quyet_dinh_bkttcp.trim() !== ''
                            ) {
                              items.push(
                                <div
                                  key={`${reward.id}-bkttcp`}
                                  className="flex items-start gap-3 p-3 rounded-lg transition-all hover:scale-[1.01]"
                                  style={{
                                    background: isDark
                                      ? 'rgba(251, 191, 36, 0.1)'
                                      : 'rgba(217, 119, 6, 0.1)',
                                    border: `1px solid ${isDark ? '#f59e0b' : '#d97706'}`,
                                  }}
                                >
                                  <div
                                    className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
                                    style={{
                                      backgroundColor: isDark ? '#f59e0b' : '#d97706',
                                      color: '#fff',
                                    }}
                                  >
                                    <CrownOutlined />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div
                                      className="font-semibold text-base"
                                      style={{ color: isDark ? '#fbbf24' : '#b45309' }}
                                    >
                                      Bằng khen của Thủ tướng Chính phủ
                                    </div>
                                    <div
                                      className="flex items-center gap-1.5 mt-1"
                                      style={{
                                        color: isDark ? '#9ca3af' : '#6b7280',
                                        fontSize: '13px',
                                      }}
                                    >
                                      <FileTextOutlined style={{ fontSize: '12px' }} />
                                      <span>Số QĐ: </span>
                                      <a
                                        onClick={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleOpenDecisionFile(reward.so_quyet_dinh_bkttcp);
                                        }}
                                        className="hover:underline"
                                        style={{ color: '#52c41a', cursor: 'pointer' }}
                                      >
                                        {reward.so_quyet_dinh_bkttcp}
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return items;
                          })}
                        </div>
                      </Card>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: '3',
      label: 'Thành tích khoa học',
      children: (
        <div className="space-y-4">
          <div className="mb-4">
            <Text strong>Tổng số: {scientificAchievements.length}</Text>
          </div>
          <Table
            dataSource={scientificAchievements}
            columns={scientificColumns}
            rowKey="id"
            pagination={{
              ...DEFAULT_ANTD_TABLE_PAGINATION,
              showTotal: total => `Tổng ${total} bản ghi`,
            }}
            scroll={{ x: 'max-content' }}
            bordered
            size="middle"
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                      Chưa có thành tích khoa học nào
                    </span>
                  }
                  style={{ padding: '40px 0' }}
                />
              ),
            }}
          />
        </div>
      ),
    },
    {
      key: '4',
      label: 'Lịch sử chức vụ',
      children: (
        <div className="space-y-4">
          <div className="mb-4">
            <Text strong>Tổng số: {positionHistory.length}</Text>
          </div>
          <Table
            dataSource={positionHistory}
            columns={positionHistoryColumns}
            rowKey="id"
            pagination={{
              ...DEFAULT_ANTD_TABLE_PAGINATION,
              showTotal: total => `Tổng ${total} bản ghi`,
            }}
            scroll={{ x: 'max-content' }}
            bordered
            size="middle"
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                      Chưa có lịch sử chức vụ nào
                    </span>
                  }
                  style={{ padding: '40px 0' }}
                />
              ),
            }}
          />
        </div>
      ),
    },
    {
      key: '5',
      label: 'Khen thưởng đột xuất',
      children: (
        <div className="space-y-4">
          <div className="mb-4">
            <Text strong>Tổng số: {adhocAwards.length}</Text>
          </div>
          <Table
            dataSource={adhocAwards}
            columns={adhocColumns}
            rowKey="id"
            pagination={{
              ...DEFAULT_ANTD_TABLE_PAGINATION,
              showTotal: total => `Tổng ${total} bản ghi`,
            }}
            scroll={{ x: 'max-content' }}
            bordered
            size="middle"
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                      Chưa có khen thưởng đột xuất nào
                    </span>
                  }
                  style={{ padding: '40px 0' }}
                />
              ),
            }}
          />
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
            {
              title: (
                <Link href="/user/dashboard">
                  <HomeOutlined />
                </Link>
              ),
            },
            { title: 'Hồ sơ của tôi' },
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
                  {personnelInfo.ho_ten}
                </Title>
                <div>
                  <Text type="secondary">{personnelInfo.cccd}</Text>
                </div>
                <div>
                  <Text type="secondary">{personnelInfo.ChucVu?.ten_chuc_vu || '-'}</Text>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Main Content Tabs */}
        <Card className="shadow-sm">
          <Tabs
            defaultActiveKey="1"
            items={tabItems}
            tabBarGutter={32}
            centered
            tabBarStyle={{ marginBottom: 24 }}
          />
        </Card>
      </div>
    </ConfigProvider>
  );
}
