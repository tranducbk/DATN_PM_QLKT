'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  Descriptions,
  Button,
  Typography,
  Breadcrumb,
  Tag,
  Alert,
  Space,
  message,
  Table,
  ConfigProvider,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import {
  HomeOutlined,
  ArrowLeftOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FilePdfOutlined,
  TrophyOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { formatDateTime } from '@/lib/utils';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import { downloadDecisionFile } from '@/utils/downloadDecisionFile';
import { previewFileWithApi } from '@/utils/filePreview';
import { useTheme } from '@/components/ThemeProvider';
import { getAntdTableThemeConfig } from '@/lib/antdTheme';
import {
  CONG_HIEN_HE_SO_GROUPS,
  CONG_HIEN_HE_SO_RANGES,
  DANH_HIEU_MAP,
  type CongHienHeSoGroup,
} from '@/constants/danhHieu.constants';
import {
  PROPOSAL_REVIEW_CARD_TITLES,
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_TYPES,
  isProposalType,
  getProposalTypeLabel,
  type ProposalType,
} from '@/constants/proposal.constants';
import styles from './proposal-detail.module.css';

const { Title, Text } = Typography;

interface DanhHieuItem {
  personnel_id: string;
  ho_ten: string;
  nam: number;
  thang?: number | null;
  danh_hieu: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  // Legacy scalar fields (kept for backward compatibility)
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string | null;
  file_quyet_dinh_bkbqp?: string | null;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string | null;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string | null;
  file_quyet_dinh_cstdtq?: string | null;
  thoi_gian_nhom_0_7?: {
    display?: string;
    years?: number;
    months?: number;
  } | null;
  thoi_gian_nhom_0_8?: {
    display?: string;
    years?: number;
    months?: number;
  } | null;
  thoi_gian_nhom_0_9_1_0?: {
    display?: string;
    years?: number;
    months?: number;
  } | null;
  co_quan_don_vi?: {
    id: string;
    ten_co_quan_don_vi: string;
    ma_co_quan_don_vi: string;
  } | null;
  don_vi_truc_thuoc?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    co_quan_don_vi?: {
      id: string;
      ten_don_vi_truc: string;
      ma_don_vi: string;
    } | null;
  } | null;
}

interface ThanhTichItem {
  personnel_id: string;
  ho_ten: string;
  nam: number;
  loai: string;
  mo_ta: string;
  status: string;
  so_quyet_dinh?: string | null;
  file_quyet_dinh?: string | null;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  co_quan_don_vi?: {
    id: string;
    ten_co_quan_don_vi: string;
    ma_co_quan_don_vi: string;
  } | null;
  don_vi_truc_thuoc?: {
    id: string;
    ten_don_vi: string;
    ma_don_vi: string;
    co_quan_don_vi?: {
      id: string;
      ten_don_vi_truc: string;
      ma_don_vi: string;
    } | null;
  } | null;
}

interface AttachedFile {
  filename: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

interface ReviewerAccount {
  id: string;
  username: string;
  ho_ten?: string;
}

interface PositionHistoryEntry {
  he_so_chuc_vu?: number;
  so_thang?: number | null;
}

interface DurationDisplay {
  display?: string;
  years?: number;
  months?: number;
}

const CONG_HIEN_GROUP_COLUMNS: Array<{
  key: CongHienHeSoGroup;
  title: string;
  dataField:
    | 'thoi_gian_nhom_0_7'
    | 'thoi_gian_nhom_0_8'
    | 'thoi_gian_nhom_0_9_1_0';
}> = [
  {
    key: CONG_HIEN_HE_SO_GROUPS.LEVEL_07,
    title: 'Tổng thời gian (0.7)',
    dataField: 'thoi_gian_nhom_0_7',
  },
  {
    key: CONG_HIEN_HE_SO_GROUPS.LEVEL_08,
    title: 'Tổng thời gian (0.8)',
    dataField: 'thoi_gian_nhom_0_8',
  },
  {
    key: CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10,
    title: 'Tổng thời gian (0.9-1.0)',
    dataField: 'thoi_gian_nhom_0_9_1_0',
  },
];

const getDurationDisplay = (value: unknown): string | null => {
  if (!value) return null;

  if (typeof value === 'object' && value !== null) {
    const display = (value as DurationDisplay).display;
    return typeof display === 'string' && display.trim() ? display : null;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as DurationDisplay;
      const display = parsed?.display;
      return typeof display === 'string' && display.trim() ? display : null;
    } catch {
      return null;
    }
  }

  return null;
};


interface ProposalDetail {
  id: string;
  loai_de_xuat: ProposalType;
  nam: number;
  thang?: number;
  don_vi: {
    id: string;
    ma_don_vi: string;
    ten_don_vi: string;
  };
  nguoi_de_xuat: {
    id: string;
    username: string;
    ho_ten: string;
  };
  status: string;
  data_danh_hieu: DanhHieuItem[];
  data_thanh_tich: ThanhTichItem[];
  data_nien_han?: DanhHieuItem[];
  data_cong_hien?: DanhHieuItem[];
  files_attached: AttachedFile[];
  nguoi_duyet: ReviewerAccount | null;
  ngay_duyet: string | null;
  ghi_chu: string | null;
  rejection_reason: string | null;
  createdAt: string;
  updatedAt: string;
}

const NIEN_HAN_STYLE_TYPES: ProposalType[] = [
  PROPOSAL_TYPES.NIEN_HAN,
  PROPOSAL_TYPES.HC_QKQT,
  PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
];

const DANH_HIEU_FALLBACK_TYPES: ProposalType[] = [
  PROPOSAL_TYPES.NCKH,
  PROPOSAL_TYPES.NIEN_HAN,
  PROPOSAL_TYPES.HC_QKQT,
  PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
  PROPOSAL_TYPES.CONG_HIEN,
];

export default function ManagerProposalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isDark } = useTheme();
  const proposalId = params?.id as string;
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [positionHistoriesMap, setPositionHistoriesMap] = useState<Record<string, PositionHistoryEntry[]>>({});

  useEffect(() => {
    if (proposalId) {
      fetchProposalDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch when proposalId changes
  }, [proposalId]);

  const fetchProposalDetail = async () => {
    if (!proposalId) return;
    try {
      setLoading(true);
      const response = await apiClient.getProposalById(proposalId);

      if (response.success) {
        setProposal(response.data);

        let personnelData: DanhHieuItem[] = [];

        if (response.data.data_danh_hieu) {
          const danhHieuData = Array.isArray(response.data.data_danh_hieu)
            ? response.data.data_danh_hieu
            : typeof response.data.data_danh_hieu === 'string'
              ? JSON.parse(response.data.data_danh_hieu)
              : [];
          personnelData = [...personnelData, ...danhHieuData];
        }

        if (response.data.data_nien_han) {
          const nienHanData = Array.isArray(response.data.data_nien_han)
            ? response.data.data_nien_han
            : typeof response.data.data_nien_han === 'string'
              ? JSON.parse(response.data.data_nien_han)
              : [];
          personnelData = [...personnelData, ...nienHanData];
        }

        if (response.data.data_cong_hien) {
          const congHienData = Array.isArray(response.data.data_cong_hien)
            ? response.data.data_cong_hien
            : typeof response.data.data_cong_hien === 'string'
              ? JSON.parse(response.data.data_cong_hien)
              : [];
          personnelData = [...personnelData, ...congHienData];
        }

        if (personnelData.length > 0) {
          // Position history is only needed for CONG_HIEN proposals
          if (response.data.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN) {
            await fetchPositionHistories(personnelData);
          }
        }
      } else {
        message.error(response.message || 'Không thể tải chi tiết đề xuất');
        router.replace('/manager/proposals');
      }
    } catch (error: unknown) {
      message.error('Không tìm thấy đề xuất hoặc bạn không có quyền truy cập');
      router.replace('/manager/proposals');
    } finally {
      setLoading(false);
    }
  };

  const fetchPositionHistories = async (danhHieuItems: DanhHieuItem[]) => {
    try {
      const historiesMap: Record<string, PositionHistoryEntry[]> = {};

      await Promise.all(
        danhHieuItems.map(async item => {
          if (item.personnel_id) {
            try {
              const res = await apiClient.getPositionHistory(item.personnel_id);
              if (res.success && res.data) {
                historiesMap[item.personnel_id] = res.data;
              }
            } catch (error) {
              // Ignore errors for individual personnel
              historiesMap[item.personnel_id] = [];
            }
          }
        })
      );

      setPositionHistoriesMap(historiesMap);
    } catch (error) {
      message.error(getApiErrorMessage(error));
    }
  };

  const calculateTotalTimeByGroup = (personnelId: string, group: CongHienHeSoGroup) => {
    const histories = positionHistoriesMap[personnelId] || [];
    let totalMonths = 0;

    histories.forEach((history: PositionHistoryEntry) => {
      const heSo = Number(history.he_so_chuc_vu) || 0;
      const range = CONG_HIEN_HE_SO_RANGES[group];
      const belongsToGroup = range
        ? heSo >= range.min && (range.includeMax ? heSo <= range.max : heSo < range.max)
        : false;

      if (belongsToGroup && history.so_thang !== null && history.so_thang !== undefined) {
        totalMonths += history.so_thang;
      }
    });

    const years = Math.floor(totalMonths / 12);
    const remainingMonths = totalMonths % 12;

    if (totalMonths === 0) return '-';
    if (years > 0 && remainingMonths > 0) {
      return `${years} năm ${remainingMonths} tháng`;
    } else if (years > 0) {
      return `${years} năm`;
    } else {
      return `${remainingMonths} tháng`;
    }
  };

  const renderContributionGroupDuration = (
    record: DanhHieuItem,
    group: CongHienHeSoGroup,
    dataField: 'thoi_gian_nhom_0_7' | 'thoi_gian_nhom_0_8' | 'thoi_gian_nhom_0_9_1_0'
  ) => {
    const display = getDurationDisplay(record[dataField]);
    if (display) {
      return <Text style={{ whiteSpace: 'nowrap' }}>{display}</Text>;
    }
    return (
      <Text style={{ whiteSpace: 'nowrap' }}>
        {calculateTotalTimeByGroup(record.personnel_id || '', group)}
      </Text>
    );
  };

  const handleOpenDecisionFile = async (soQuyetDinh: string) => {
    await downloadDecisionFile(soQuyetDinh);
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      [PROPOSAL_STATUS.PENDING]: {
        color: 'gold',
        icon: <ClockCircleOutlined />,
        text: PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.PENDING],
      },
      [PROPOSAL_STATUS.APPROVED]: {
        color: 'green',
        icon: <CheckCircleOutlined />,
        text: PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.APPROVED],
      },
      [PROPOSAL_STATUS.REJECTED]: {
        color: 'red',
        icon: <CloseCircleOutlined />,
        text: PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.REJECTED],
      },
    };

    const config = statusConfig[status] ?? {
      color: 'default',
      icon: undefined,
      text: status,
    };
    return (
      <Tag color={config.color} icon={config.icon} style={{ fontSize: 14, padding: '4px 12px' }}>
        {config.text}
      </Tag>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Card loading={true} />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="space-y-6 p-6">
        <Alert message="Không tìm thấy đề xuất" type="error" />
      </div>
    );
  }

  return (
    <ConfigProvider theme={getAntdTableThemeConfig(isDark)}>
      <div className="space-y-6 p-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <Breadcrumb.Item>
            <Link href="/manager/dashboard">
              <HomeOutlined />
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link href="/manager/proposals">Đề xuất khen thưởng</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>Chi tiết</Breadcrumb.Item>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/manager/proposals">
              <Button icon={<ArrowLeftOutlined />}>Quay lại</Button>
            </Link>
            <Title level={2} className="!mb-0">
              Chi tiết đề xuất {getProposalTypeLabel(proposal.loai_de_xuat)}
            </Title>
          </div>
        </div>

        {/* Status Alert */}
        {proposal.status === PROPOSAL_STATUS.REJECTED && proposal.ghi_chu && (
          <Alert
            message="Đề xuất bị từ chối"
            description={
              <div>
                <Text strong>Lý do từ chối: </Text>
                <Text>{proposal.ghi_chu}</Text>
                <br />
                <br />
                <Text type="secondary">
                  💡 Bạn có thể tải file Excel về, chỉnh sửa theo lý do từ chối, sau đó tạo đề xuất
                  mới.
                </Text>
              </div>
            }
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
          />
        )}

        {proposal.status === PROPOSAL_STATUS.APPROVED && (
          <Alert
            message="Đề xuất đã được phê duyệt"
            description={
              <div>
                <Text>Dữ liệu đã được nhập vào hệ thống và cập nhật hồ sơ quân nhân.</Text>
              </div>
            }
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
          />
        )}

        {proposal.status === PROPOSAL_STATUS.PENDING && (
          <Alert
            message="Đề xuất đang chờ duyệt"
            description="Đề xuất của bạn đang chờ Admin xem xét và phê duyệt."
            type="info"
            showIcon
            icon={<ClockCircleOutlined />}
          />
        )}

        {/* Proposal Info */}
        <Card title="Thông tin đề xuất" className="shadow-sm">
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Loại đề xuất" span={2}>
              <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
                {getProposalTypeLabel(proposal.loai_de_xuat)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Năm đề xuất">
              <Text strong>{proposal.nam}</Text>
              {[
                PROPOSAL_TYPES.NIEN_HAN,
                PROPOSAL_TYPES.HC_QKQT,
                PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
                PROPOSAL_TYPES.CONG_HIEN,
              ].includes(proposal.loai_de_xuat as any) &&
                proposal.thang && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  (Tháng {proposal.thang})
                </Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {getStatusTag(proposal.status)}
            </Descriptions.Item>
            <Descriptions.Item label="Đơn vị">
              {proposal.don_vi.ten_don_vi} ({proposal.don_vi.ma_don_vi})
            </Descriptions.Item>
            <Descriptions.Item label="Người đề xuất">
              {proposal.nguoi_de_xuat.ho_ten || proposal.nguoi_de_xuat.username}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày gửi">
              {formatDateTime(proposal.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Số lượng" span={2}>
              {proposal.loai_de_xuat === PROPOSAL_TYPES.NCKH && (
                <Tag color="magenta">{proposal.data_thanh_tich?.length || 0} đề tài/sáng kiến</Tag>
              )}
              {NIEN_HAN_STYLE_TYPES.includes(proposal.loai_de_xuat) && (
                <Tag color="blue">{proposal.data_nien_han?.length || 0} quân nhân</Tag>
              )}
              {proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN && (
                <Tag color="purple">{proposal.data_cong_hien?.length || 0} quân nhân</Tag>
              )}
              {!DANH_HIEU_FALLBACK_TYPES.includes(proposal.loai_de_xuat) && (
                <Tag color="blue">{proposal.data_danh_hieu?.length || 0} quân nhân</Tag>
              )}
            </Descriptions.Item>
            {proposal.nguoi_duyet && (
              <Descriptions.Item label="Người duyệt">
                {proposal.nguoi_duyet.ho_ten || proposal.nguoi_duyet.username}
              </Descriptions.Item>
            )}
            {proposal.ngay_duyet && (
              <Descriptions.Item label="Thời gian cập nhật">
                {(() => {
                  const date = new Date(proposal.ngay_duyet);
                  const hours = String(date.getHours()).padStart(2, '0');
                  const minutes = String(date.getMinutes()).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const year = date.getFullYear();
                  return `${hours}:${minutes} ${day}/${month}/${year}`;
                })()}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Ghi chú" span={2}>
              {proposal.ghi_chu ? (
                <Text>{proposal.ghi_chu}</Text>
              ) : (
                <Text type="secondary" style={{ fontStyle: 'italic', opacity: 0.6 }}>
                  Không có ghi chú
                </Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Attached Files */}
        <Card title="File đính kèm" className="shadow-sm">
          {proposal.files_attached && proposal.files_attached.length > 0 ? (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {proposal.files_attached.map((file, index) => (
                <div
                  key={index}
                  className={`${styles.fileItem} ${
                    isDark ? styles.fileItemDark : styles.fileItemLight
                  }`}
                >
                  <div className={styles.fileContent}>
                    <div className={styles.fileHeader}>
                      <FilePdfOutlined
                        className={isDark ? styles.fileIconDark : styles.fileIconLight}
                      />
                      <Text
                        strong
                        className={`break-all ${
                          isDark ? styles.fileNameDark : styles.fileNameLight
                        }`}
                      >
                        {(() => {
                          try {
                            if (file.originalName && typeof file.originalName === 'string') {
                              if (file.originalName.includes('%')) {
                                return decodeURIComponent(file.originalName);
                              }
                              return file.originalName;
                            }
                            return file.originalName || '-';
                          } catch (e) {
                            return file.originalName || '-';
                          }
                        })()}
                      </Text>
                    </div>
                    <Text
                      type="secondary"
                      className={`text-xs ${isDark ? styles.fileInfoDark : styles.fileInfoLight}`}
                    >
                      Kích thước: {(file.size / 1024).toFixed(2)} KB • Ngày tải lên:{' '}
                      {formatDateTime(file.uploadedAt)}
                    </Text>
                  </div>
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() => {
                      previewFileWithApi(
                        `/api/proposals/uploads/${file.filename}`,
                        file.originalName
                      );
                    }}
                    className={styles.downloadButton}
                  >
                    Xem file
                  </Button>
                </div>
              ))}
            </Space>
          ) : (
            <Text type="secondary">Không có file đính kèm</Text>
          )}
        </Card>

        {proposal.loai_de_xuat === PROPOSAL_TYPES.NCKH && (
          <Card
            className="shadow-sm"
            title={
              <span>
                <BookOutlined style={{ marginRight: 8 }} />
                {(isProposalType(proposal.loai_de_xuat)
                  ? PROPOSAL_REVIEW_CARD_TITLES[proposal.loai_de_xuat]
                  : getProposalTypeLabel(proposal.loai_de_xuat))}{' '}
                ({proposal.data_thanh_tich?.length || 0})
              </span>
            }
          >
            <Table
              dataSource={proposal.data_thanh_tich || []}
              rowKey={(_, index) => `tt_${index}`}
              pagination={false}
              columns={[
                {
                  title: 'STT',
                  key: 'index',
                  width: 60,
                  align: 'center',
                  render: (_, __, index) => index + 1,
                },
                {
                  title: 'Họ tên',
                  dataIndex: 'ho_ten',
                  key: 'ho_ten',
                  width: 250,
                  align: 'center',
                  render: (text: string, record: ThanhTichItem) => {
                    const coQuanDonVi = record.co_quan_don_vi?.ten_co_quan_don_vi;
                    const donViTrucThuoc = record.don_vi_truc_thuoc?.ten_don_vi;
                    const parts = [];
                    if (donViTrucThuoc) parts.push(donViTrucThuoc);
                    if (coQuanDonVi) parts.push(coQuanDonVi);
                    const unitInfo = parts.length > 0 ? parts.join(', ') : null;

                    return (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      >
                        <Text strong>{text || '-'}</Text>
                        {unitInfo && (
                          <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                            {unitInfo}
                          </Text>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: 'Cấp bậc / Chức vụ',
                  key: 'cap_bac_chuc_vu',
                  width: 180,
                  align: 'center',
                  render: (_: unknown, record: ThanhTichItem) => {
                    // Rank/position stored at proposal creation time (Step 3), not current personnel data
                    const capBac = record.cap_bac;
                    const chucVu = record.chuc_vu;

                    if (!capBac && !chucVu) {
                      return <span>-</span>;
                    }

                    return (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      >
                        {capBac && <Text strong>{capBac}</Text>}
                        {chucVu && (
                          <Text
                            type="secondary"
                            style={{ fontSize: '12px', marginTop: capBac ? '4px' : '0' }}
                          >
                            {chucVu}
                          </Text>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: 'Năm',
                  dataIndex: 'nam',
                  key: 'nam',
                  width: 100,
                  align: 'center',
                },
                {
                  title: 'Loại',
                  dataIndex: 'loai',
                  key: 'loai',
                  width: 150,
                  align: 'center',
                  render: text => (
                    <Tag color={text === 'DTKH' ? 'blue' : 'green'}>
                      {text === 'DTKH' ? 'ĐTKH' : 'SKKH'}
                    </Tag>
                  ),
                },
                {
                  title: 'Mô tả',
                  dataIndex: 'mo_ta',
                  key: 'mo_ta',
                  width: 300,
                  align: 'center',
                  render: text => <Text>{text || '-'}</Text>,
                },
                ...(proposal.status === PROPOSAL_STATUS.APPROVED
                  ? [
                      {
                        title: 'Số quyết định',
                        dataIndex: 'so_quyet_dinh',
                        key: 'so_quyet_dinh',
                        width: 180,
                        align: 'center' as const,
                        render: (text: string, record: ThanhTichItem) => {
                          if (!text || (typeof text === 'string' && text.trim() === '')) {
                            return <Text type="secondary">-</Text>;
                          }

                          return (
                            <a
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenDecisionFile(text);
                              }}
                              style={{
                                color: '#1890ff',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              {text}
                            </a>
                          );
                        },
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        )}

        {proposal.loai_de_xuat === PROPOSAL_TYPES.CONG_HIEN &&
          !!proposal.data_cong_hien?.length && (
          <Card
            className="shadow-sm"
            title={
              <span>
                <TrophyOutlined style={{ marginRight: 8 }} />
                {(isProposalType(proposal.loai_de_xuat)
                  ? PROPOSAL_REVIEW_CARD_TITLES[proposal.loai_de_xuat]
                  : getProposalTypeLabel(proposal.loai_de_xuat))}{' '}
                ({proposal.data_cong_hien?.length || 0})
              </span>
            }
          >
            <Table
              dataSource={proposal.data_cong_hien || []}
              rowKey={(_, index) => `ch_${index}`}
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: 'STT',
                  key: 'index',
                  width: 60,
                  align: 'center',
                  render: (_, __, index) => index + 1,
                },
                {
                  title: 'Họ và tên',
                  dataIndex: 'ho_ten',
                  key: 'ho_ten',
                  width: 250,
                  align: 'center',
                  render: (text: string, record: DanhHieuItem) => {
                    const coQuanDonVi = record.co_quan_don_vi?.ten_co_quan_don_vi;
                    const donViTrucThuoc = record.don_vi_truc_thuoc?.ten_don_vi;
                    const parts = [];
                    if (donViTrucThuoc) parts.push(donViTrucThuoc);
                    if (coQuanDonVi) parts.push(coQuanDonVi);
                    const unitInfo = parts.length > 0 ? parts.join(', ') : null;

                    return (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      >
                        <Text strong>{text || '-'}</Text>
                        {unitInfo && (
                          <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                            {unitInfo}
                          </Text>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: 'Cấp bậc / Chức vụ',
                  key: 'cap_bac_chuc_vu',
                  width: 180,
                  align: 'center',
                  render: (_: unknown, record: DanhHieuItem) => {
                    // Rank/position stored at proposal creation time (Step 3), not current personnel data
                    const capBac = record.cap_bac;
                    const chucVu = record.chuc_vu;

                    if (!capBac && !chucVu) {
                      return <span>-</span>;
                    }

                    return (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      >
                        {capBac && (
                          <Text strong style={{ marginBottom: chucVu ? '4px' : '0' }}>
                            {capBac}
                          </Text>
                        )}
                        {chucVu && (
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {chucVu}
                          </Text>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: 'Tháng',
                  key: 'thang',
                  width: 90,
                  align: 'center',
                  render: (_: unknown, record: DanhHieuItem) => record.thang ?? null,
                },
                {
                  title: 'Năm',
                  dataIndex: 'nam',
                  key: 'nam',
                  width: 100,
                  align: 'center',
                },
                {
                  title: 'Danh hiệu đề xuất',
                  dataIndex: 'danh_hieu',
                  key: 'danh_hieu',
                  width: 280,
                  align: 'center',
                  render: (text: string) => {
                    return text ? (
                      <Text style={{ whiteSpace: 'nowrap' }}>{DANH_HIEU_MAP[text] || text}</Text>
                    ) : (
                      <Text type="secondary">-</Text>
                    );
                  },
                },
                ...CONG_HIEN_GROUP_COLUMNS.map(groupColumn => ({
                  title: groupColumn.title,
                  key: `total_time_${groupColumn.key}`,
                  width: 150,
                  align: 'center' as const,
                  render: (_: unknown, record: DanhHieuItem) =>
                    renderContributionGroupDuration(record, groupColumn.key, groupColumn.dataField),
                })),
                ...(proposal.status === PROPOSAL_STATUS.APPROVED
                  ? [
                      {
                        title: 'Số quyết định',
                        dataIndex: 'so_quyet_dinh',
                        key: 'so_quyet_dinh',
                        width: 180,
                        align: 'center' as const,
                        render: (text: string, record: DanhHieuItem) => {
                          if (!text || (typeof text === 'string' && text.trim() === '')) {
                            return <Text type="secondary">-</Text>;
                          }

                          return (
                            <a
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenDecisionFile(text);
                              }}
                              style={{
                                color: '#1890ff',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              {text}
                            </a>
                          );
                        },
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        )}

        {proposal.loai_de_xuat !== PROPOSAL_TYPES.NCKH &&
          proposal.loai_de_xuat !== PROPOSAL_TYPES.CONG_HIEN &&
          !!proposal.data_danh_hieu?.length && (
          <Card
            className="shadow-sm"
            title={
              <span>
                <TrophyOutlined style={{ marginRight: 8 }} />
                {(isProposalType(proposal.loai_de_xuat)
                  ? PROPOSAL_REVIEW_CARD_TITLES[proposal.loai_de_xuat]
                  : getProposalTypeLabel(proposal.loai_de_xuat))}{' '}
                ({proposal.data_danh_hieu?.length || 0})
              </span>
            }
          >
            <Table
              dataSource={proposal.data_danh_hieu || []}
              rowKey={(_, index) => `dh_${index}`}
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: 'STT',
                  key: 'index',
                  width: 60,
                  align: 'center',
                  render: (_, __, index) => index + 1,
                },
                {
                  title:
                    proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM
                      ? 'Tên đơn vị'
                      : 'Họ và tên',
                  dataIndex:
                    proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM
                      ? 'ten_don_vi'
                      : 'ho_ten',
                  key:
                    proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM
                      ? 'ten_don_vi'
                      : 'ho_ten',
                  width: 250,
                  align: 'center',
                  render: (text: string, record: DanhHieuItem) => {
                    if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
                      // For units, show unit name
                      return (
                        <div
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                        >
                          <Text strong style={{ whiteSpace: 'nowrap' }}>
                            {text || '-'}
                          </Text>
                        </div>
                      );
                    } else {
                      // For personnel, show name and unit info
                      const coQuanDonVi = record.co_quan_don_vi?.ten_co_quan_don_vi;
                      const donViTrucThuoc = record.don_vi_truc_thuoc?.ten_don_vi;
                      const parts = [];
                      if (donViTrucThuoc) parts.push(donViTrucThuoc);
                      if (coQuanDonVi) parts.push(coQuanDonVi);
                      const unitInfo = parts.length > 0 ? parts.join(', ') : null;

                      return (
                        <div
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                        >
                          <Text strong style={{ whiteSpace: 'nowrap' }}>
                            {text || '-'}
                          </Text>
                          {unitInfo && (
                            <Text
                              type="secondary"
                              style={{ fontSize: '12px', marginTop: '4px', whiteSpace: 'nowrap' }}
                            >
                              {unitInfo}
                            </Text>
                          )}
                        </div>
                      );
                    }
                  },
                },
                {
                  title:
                    proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM
                      ? 'Mã đơn vị'
                      : 'Cấp bậc / Chức vụ',
                  key:
                    proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM
                      ? 'ma_don_vi'
                      : 'cap_bac_chuc_vu',
                  width: 180,
                  align: 'center',
                  render: (_: unknown, record: DanhHieuItem) => {
                    if (proposal.loai_de_xuat === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
                      // For units, show unit code
                      const unitRecord = record as DanhHieuItem & { ma_don_vi?: string };
                      return (
                        <Text strong style={{ whiteSpace: 'nowrap' }}>
                          {unitRecord.ma_don_vi || '-'}
                        </Text>
                      );
                    } else {
                      // For personnel, show rank and position
                      const capBac = record.cap_bac;
                      const chucVu = record.chuc_vu;

                      if (!capBac && !chucVu) {
                        return <span>-</span>;
                      }

                      return (
                        <div
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                        >
                          {capBac && (
                            <Text
                              strong
                              style={{ marginBottom: chucVu ? '4px' : '0', whiteSpace: 'nowrap' }}
                            >
                              {capBac}
                            </Text>
                          )}
                          {chucVu && (
                            <Text
                              type="secondary"
                              style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                            >
                              {chucVu}
                            </Text>
                          )}
                        </div>
                      );
                    }
                  },
                },
                {
                  title: 'Năm',
                  dataIndex: 'nam',
                  key: 'nam',
                  width: 100,
                  align: 'center',
                },
                {
                  title: 'Danh hiệu đề xuất',
                  dataIndex: 'danh_hieu',
                  key: 'danh_hieu',
                  width: 280,
                  align: 'center',
                  render: (text: string) => {
                    return text ? (
                      <Text style={{ whiteSpace: 'nowrap' }}>{DANH_HIEU_MAP[text] || text}</Text>
                    ) : (
                      <Text type="secondary">-</Text>
                    );
                  },
                },
                ...(proposal.status === PROPOSAL_STATUS.APPROVED
                  ? [
                      {
                        title: 'Số quyết định',
                        dataIndex: 'so_quyet_dinh',
                        key: 'so_quyet_dinh',
                        width: 180,
                        align: 'center' as const,
                        render: (text: string, record: DanhHieuItem) => {
                          const soQuyetDinh =
                            text || record.so_quyet_dinh_bkbqp || record.so_quyet_dinh_cstdtq;

                          if (
                            !soQuyetDinh ||
                            (typeof soQuyetDinh === 'string' && soQuyetDinh.trim() === '')
                          ) {
                            return <Text type="secondary">-</Text>;
                          }

                          return (
                            <a
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenDecisionFile(soQuyetDinh);
                              }}
                              style={{
                                color: '#52c41a',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              {soQuyetDinh}
                            </a>
                          );
                        },
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        )}

        {proposal.loai_de_xuat !== PROPOSAL_TYPES.NCKH &&
          proposal.loai_de_xuat !== PROPOSAL_TYPES.CONG_HIEN &&
          !proposal.data_danh_hieu?.length &&
          !!proposal.data_nien_han?.length && (
          <Card
            className="shadow-sm"
            title={
              <span>
                <ClockCircleOutlined style={{ marginRight: 8 }} />
                {getProposalTypeLabel(proposal.loai_de_xuat)} ({proposal.data_nien_han?.length || 0})
              </span>
            }
          >
            <Table
              dataSource={proposal.data_nien_han || []}
              rowKey={(_, index) => `nh_${index}`}
              pagination={false}
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: 'STT',
                  key: 'index',
                  width: 60,
                  align: 'center',
                  render: (_, __, index) => index + 1,
                },
                {
                  title: 'Họ và tên',
                  dataIndex: 'ho_ten',
                  key: 'ho_ten',
                  width: 250,
                  align: 'center',
                  render: (text: string, record: DanhHieuItem) => {
                    const coQuanDonVi = record.co_quan_don_vi?.ten_co_quan_don_vi;
                    const donViTrucThuoc = record.don_vi_truc_thuoc?.ten_don_vi;
                    const parts = [];
                    if (donViTrucThuoc) parts.push(donViTrucThuoc);
                    if (coQuanDonVi) parts.push(coQuanDonVi);
                    const unitInfo = parts.length > 0 ? parts.join(', ') : null;

                    return (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      >
                        <Text strong>{text || '-'}</Text>
                        {unitInfo && (
                          <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>
                            {unitInfo}
                          </Text>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: 'Cấp bậc / Chức vụ',
                  key: 'cap_bac_chuc_vu',
                  width: 180,
                  align: 'center',
                  render: (_: unknown, record: DanhHieuItem) => {
                    // Rank/position stored at proposal creation time (Step 3), not current personnel data
                    const capBac = record.cap_bac;
                    const chucVu = record.chuc_vu;

                    if (!capBac && !chucVu) {
                      return <span>-</span>;
                    }

                    return (
                      <div
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      >
                        {capBac && (
                          <Text strong style={{ marginBottom: chucVu ? '4px' : '0' }}>
                            {capBac}
                          </Text>
                        )}
                        {chucVu && (
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {chucVu}
                          </Text>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: 'Năm',
                  dataIndex: 'nam',
                  key: 'nam',
                  width: 70,
                  align: 'center',
                },
                {
                  title: 'Tháng',
                  dataIndex: 'thang',
                  key: 'thang',
                  width: 70,
                  align: 'center',
                  render: (val: number | null | undefined) => val ?? '',
                },
                {
                  title: 'Tổng thời gian',
                  dataIndex: 'thoi_gian',
                  key: 'thoi_gian',
                  width: 150,
                  align: 'center',
                  render: (thoiGian: unknown) => {
                    if (!thoiGian) return <Text type="secondary">-</Text>;
                    if (typeof thoiGian === 'string') {
                      try {
                        const parsed = JSON.parse(thoiGian) as DurationDisplay;
                        return (
                          <Text style={{ whiteSpace: 'nowrap' }}>{parsed.display || '-'}</Text>
                        );
                      } catch {
                        return <Text style={{ whiteSpace: 'nowrap' }}>{thoiGian}</Text>;
                      }
                    }
                    if (typeof thoiGian === 'object') {
                      const duration = thoiGian as DurationDisplay;
                      return (
                        <Text style={{ whiteSpace: 'nowrap' }}>
                          {duration.display ||
                            `${duration.years || 0} năm ${duration.months || 0} tháng`}
                        </Text>
                      );
                    }
                    return <Text style={{ whiteSpace: 'nowrap' }}>{String(thoiGian)}</Text>;
                  },
                },
                {
                  title: 'Danh hiệu đề xuất',
                  dataIndex: 'danh_hieu',
                  key: 'danh_hieu',
                  width: 180,
                  align: 'center',
                  render: (text: string) => {
                    return text ? (
                      <Text>{DANH_HIEU_MAP[text] || text}</Text>
                    ) : (
                      <Text type="secondary">-</Text>
                    );
                  },
                },
                ...(proposal.status === PROPOSAL_STATUS.APPROVED
                  ? [
                      {
                        title: 'Số quyết định',
                        dataIndex: 'so_quyet_dinh',
                        key: 'so_quyet_dinh',
                        width: 180,
                        align: 'center' as const,
                        render: (text: string, record: DanhHieuItem) => {
                          const soQuyetDinh =
                            text || record.so_quyet_dinh_bkbqp || record.so_quyet_dinh_cstdtq;

                          if (
                            !soQuyetDinh ||
                            (typeof soQuyetDinh === 'string' && soQuyetDinh.trim() === '')
                          ) {
                            return <Text type="secondary">-</Text>;
                          }

                          return (
                            <a
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenDecisionFile(soQuyetDinh);
                              }}
                              style={{
                                color: '#52c41a',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              {soQuyetDinh}
                            </a>
                          );
                        },
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        )}

        {proposal.status === PROPOSAL_STATUS.REJECTED && (
          <Card className="shadow-sm bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={4} className="!mb-0">
                Lý do từ chối đề xuất
              </Title>
              <Text>{proposal.rejection_reason || '-'}</Text>
            </Space>
          </Card>
        )}

        {/* Action Buttons */}
        {proposal.status === PROPOSAL_STATUS.REJECTED && (
          <Card className="shadow-sm bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={4} className="!mb-0">
                Hướng dẫn tạo đề xuất mới
              </Title>
              <Text>
                1. Nhấn nút &quot;Tạo đề xuất mới&quot; để tạo đề xuất mới
                <br />
                2. Điền thông tin đề xuất mới
                <br />
                3. Xem lại thông tin đề xuất mới
                <br />
                4. Nhấn nút &quot;Gửi đề xuất&quot; để gửi đề xuất mới
              </Text>
              <Link href="/manager/proposals/create">
                <Button type="primary" size="large">
                  Tạo đề xuất mới
                </Button>
              </Link>
            </Space>
          </Card>
        )}
      </div>
    </ConfigProvider>
  );
}
