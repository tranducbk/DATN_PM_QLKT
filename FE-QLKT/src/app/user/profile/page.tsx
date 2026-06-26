'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Table,
  Typography,
  Tag,
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
  UserOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/http/apiClient';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/constants/pagination.constants';
import { formatDate } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { LoadingState } from '@/components/shared/LoadingState';
import { PageBreadcrumb } from '@/components/shared/PageBreadcrumb';
import { MedalProgressCard } from '@/components/personnel/MedalProgressCard';
import { AnnualTitleTimeline } from '@/components/profile/AnnualTitleTimeline';
import { downloadDecisionFile } from '@/lib/file/downloadDecisionFile';
import { useAuth } from '@/contexts/AuthContext';
import {
  ELIGIBILITY_STATUS,
  getEligibilityStatusMeta,
} from '@/constants/eligibilityStatus.constants';
import { GENDER } from '@/constants/gender.constants';
import type {
  PersonnelDetail,
  ServiceProfile,
  AnnualProfile,
  ContributionProfile,
  MedalData,
} from '@/lib/types/personnelList';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_MAP,
  HCQKQT_YEARS_REQUIRED,
  KNC_YEARS_REQUIRED_NAM,
  KNC_YEARS_REQUIRED_NU,
} from '@/constants/danhHieu.constants';
import { getReceivedMonthYearText } from '@/lib/award/medalDisplay';
import type {
  AnnualRewardRow,
  ScientificAchievementRow,
  PositionHistoryRow,
  AdhocAwardRow,
} from './types';
import { calculateYearsOfService, formatYearsAndMonths } from './helpers';
import { makeScientificColumns, makePositionHistoryColumns, makeAdhocColumns } from './columns';

const { Title, Text } = Typography;

export default function UserProfilePage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [, setPersonnelId] = useState<string | null>(null);
  const [personnelInfo, setPersonnelInfo] = useState<PersonnelDetail | null>(null);
  const [annualRewards, setAnnualRewards] = useState<AnnualRewardRow[]>([]);
  const [scientificAchievements, setScientificAchievements] = useState<ScientificAchievementRow[]>(
    []
  );
  const [positionHistory, setPositionHistory] = useState<PositionHistoryRow[]>([]);
  const [adhocAwards, setAdhocAwards] = useState<AdhocAwardRow[]>([]);
  const [serviceProfile, setServiceProfile] = useState<ServiceProfile | null>(null);
  const [annualProfile, setAnnualProfile] = useState<AnnualProfile | null>(null);
  const [contributionProfile, setContributionProfile] = useState<ContributionProfile | null>(null);
  const [militaryFlag, setMilitaryFlag] = useState<MedalData | null>(null);
  const [commemorationMedals, setCommemorationMedals] = useState<MedalData | null>(null);

  const getStatusTag = (status: string | undefined) => {
    const s = getEligibilityStatusMeta(status);
    return <Tag color={s.color}>{s.label}</Tag>;
  };

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
          apiClient.getTenureProfile(user.quan_nhan_id),
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
  }, [user?.quan_nhan_id]);

  const scientificColumns = makeScientificColumns(handleOpenDecisionFile);
  const positionHistoryColumns = makePositionHistoryColumns();
  const adhocColumns = makeAdhocColumns(handleOpenDecisionFile);

  if (loading) {
    return <LoadingState fullPage text="Đang tải hồ sơ..." />;
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
          {/* Tenure-medal award profile */}
          {(serviceProfile || militaryFlag || commemorationMedals) && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <SafetyOutlined /> Hồ sơ khen thưởng niên hạn
                </span>
              }
              size="small"
            >
              {serviceProfile && (
                <div className="mb-6">
                  <Text strong className="text-base">
                    Huy chương Chiến sĩ vẻ vang
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
                        <InfoCircleOutlined className="text-blue-500 mr-1.5" />
                        <Text strong>Gợi ý: </Text>
                        <Text>{serviceProfile.goi_y}</Text>
                      </Card>
                    </>
                  )}
                </div>
              )}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <MedalProgressCard
                      title={DANH_HIEU_MAP.HC_QKQT}
                      isDark={isDark}
                      hasReceived={!!militaryFlag?.hasReceived}
                      receivedAt={getReceivedMonthYearText(militaryFlag)}
                      yearsRequired={HCQKQT_YEARS_REQUIRED}
                      yearsOfService={calculateYearsOfService(personnelInfo.ngay_nhap_ngu)}
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
                        personnelInfo.gioi_tinh === GENDER.MALE
                          ? KNC_YEARS_REQUIRED_NAM
                          : KNC_YEARS_REQUIRED_NU
                      }
                      yearsOfService={calculateYearsOfService(personnelInfo.ngay_nhap_ngu)}
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
                Huân chương Bảo vệ Tổ quốc
              </Text>
              <Divider className="my-3" />
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Card size="small" className="h-full">
                    <Statistic
                      title="Tháng tích lũy 0.7"
                      value={formatYearsAndMonths(contributionProfile?.months_07)}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" className="h-full">
                    <Statistic
                      title="Tháng tích lũy 0.8"
                      value={formatYearsAndMonths(contributionProfile?.months_08)}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" className="h-full">
                    <Statistic
                      title="Tháng tích lũy 0.9-1.0"
                      value={formatYearsAndMonths(contributionProfile?.months_0910)}
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
                      valueRender={() => getStatusTag(contributionProfile?.hcbvtq_hang_nhat_status)}
                    />
                  </Card>
                </Col>
              </Row>
            </Card>
          )}

          {/* Annual profile */}
          {annualProfile && (
            <Card
              title={
                <span className="flex items-center gap-2">
                  <TrophyOutlined /> Hồ sơ Hằng năm
                </span>
              }
              size="small"
            >
              {/* Statistics */}
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
                      />
                    </Card>
                  </Col>
                  <Col xs={24} md={8}>
                    <Card size="small">
                      <Statistic
                        title="CSTDCS liên tục"
                        value={annualProfile.cstdcs_lien_tuc || 0}
                        suffix="năm"
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
                      />
                    </Card>
                  </Col>
                </Row>
              </div>

              {/* Eligibility */}
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
                        title={DANH_HIEU_MAP[DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP]}
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
                        title={DANH_HIEU_MAP[DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP]}
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
                    <InfoCircleOutlined className="text-blue-500 mr-1.5" />
                    <Text strong>Gợi ý: </Text>
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
        <AnnualTitleTimeline
          rewards={annualRewards}
          isDark={isDark}
          onOpenDecision={handleOpenDecisionFile}
        />
      ),
    },
    {
      key: '3',
      label: 'Thành tích Nghiên cứu khoa học',
      children: (
        <div className="space-y-4">
          <Table
            dataSource={scientificAchievements}
            columns={scientificColumns}
            rowKey="id"
            pagination={{
              ...DEFAULT_ANTD_TABLE_PAGINATION,
              showTotal: total => `Tổng ${total} bản ghi`,
            }}
            scroll={{ x: 'max-content' }}
            size="middle"
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span className="text-gray-500 dark:text-gray-400">
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
          <Table
            dataSource={positionHistory}
            columns={positionHistoryColumns}
            rowKey="id"
            pagination={{
              ...DEFAULT_ANTD_TABLE_PAGINATION,
              showTotal: total => `Tổng ${total} bản ghi`,
            }}
            scroll={{ x: 'max-content' }}
            size="middle"
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span className="text-gray-500 dark:text-gray-400">
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
          <Table
            dataSource={adhocAwards}
            columns={adhocColumns}
            rowKey="id"
            pagination={{
              ...DEFAULT_ANTD_TABLE_PAGINATION,
              showTotal: total => `Tổng ${total} bản ghi`,
            }}
            scroll={{ x: 'max-content' }}
            size="middle"
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span className="text-gray-500 dark:text-gray-400">
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
        <PageBreadcrumb items={[{ title: 'Hồ sơ của tôi' }]} />

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
