'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tabs,
  Button,
  Tag,
  Space,
  Typography,
  Breadcrumb,
  Input,
  Select,
  message,
  Empty,
} from 'antd';
import {
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  SearchOutlined,
  FilterOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/apiClient';
import { getApiErrorMessage } from '@/lib/apiError';
import dayjs from 'dayjs';
import { formatDateTime } from '@/lib/utils';
import {
  PROPOSAL_STATUS,
  PROPOSAL_TYPES,
  PROPOSAL_TYPE_ADMIN_TAG,
  PROPOSAL_STATUS_ADMIN,
} from '@/constants/proposal.constants';
import { ProposalDetailModal } from './components/ProposalDetailModal';
import { RejectModal } from './components/RejectModal';
import { ApproveModal } from './components/ApproveModal';
import { DecisionModal } from '@/components/DecisionModal';
import { DEFAULT_ANTD_TABLE_PAGINATION } from '@/lib/constants/pagination.constants';

const { Title, Text } = Typography;

interface Proposal {
  id: string;
  loai_de_xuat: string;
  nam: number;
  status: string;
  createdAt: string;
  ngay_duyet?: string;
  rejection_reason?: string;
  nguoi_de_xuat?: string;
  don_vi?: string;
  NguoiDeXuat?: {
    QuanNhan?: {
      ho_ten: string;
    };
    username: string;
  };
  CoQuanDonVi?: {
    ten_don_vi: string;
  };
  DonViTrucThuoc?: {
    ten_don_vi: string;
  };
  data_danh_hieu?: Array<{ so_quyet_dinh?: string | null }>;
  data_thanh_tich?: Array<{ so_quyet_dinh?: string | null }>;
  data_nien_han?: Array<{ so_quyet_dinh?: string | null }>;
  data_cong_hien?: Array<{ so_quyet_dinh?: string | null }>;
  selected_personnel?: string[];
}

export default function AdminProposalsPage() {
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [activeTab, setActiveTab] = useState<string>(PROPOSAL_STATUS.PENDING);
  const [searchText, setSearchText] = useState('');
  const [yearFilter, setYearFilter] = useState<number | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modal states
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedDecision, setSelectedDecision] = useState<unknown>(null);
  const [extraordinaryRewardModalVisible, setExtraordinaryRewardModalVisible] = useState(false);

  useEffect(() => {
    fetchProposals();
  }, [activeTab]);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProposals({
        status: activeTab,
        page: 1,
        limit: 100,
      });

      if (response.success) {
        const payload = response.data as { proposals?: Proposal[] } | Proposal[] | undefined;
        const list = Array.isArray(payload) ? payload : payload?.proposals ?? [];
        setProposals(list);
      }
    } catch (error: unknown) {
      message.error('Lỗi khi tải danh sách đề xuất');
    } finally {
      setLoading(false);
    }
  };

  const filteredProposals = proposals.filter(p => {
    const searchLower = searchText.toLowerCase();
    const proposerLabel = (
      p.nguoi_de_xuat ||
      p.NguoiDeXuat?.QuanNhan?.ho_ten ||
      p.NguoiDeXuat?.username ||
      ''
    ).toLowerCase();
    const matchesSearch =
      searchText === '' ||
      proposerLabel.includes(searchLower) ||
      (p.NguoiDeXuat?.username?.toLowerCase().includes(searchLower) ?? false);

    const matchesYear = yearFilter === 'ALL' || p.nam === yearFilter;
    const matchesType = typeFilter === 'ALL' || p.loai_de_xuat === typeFilter;

    return matchesSearch && matchesYear && matchesType;
  });

  // Handle view detail
  const handleViewDetail = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setDetailModalVisible(true);
  };

  // Handle reject
  const handleReject = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setRejectModalVisible(true);
  };

  // Handle approve
  const handleApprove = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setApproveModalVisible(true);
  };

  // After reject/approve success
  const handleActionSuccess = () => {
    setDetailModalVisible(false);
    setRejectModalVisible(false);
    setApproveModalVisible(false);
    setSelectedProposal(null);
    fetchProposals();
  };

  const columns: ColumnsType<Proposal> = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Loại khen thưởng',
      dataIndex: 'loai_de_xuat',
      key: 'loai_de_xuat',
      width: 140,
      render: (type: string) => {
        const config = PROPOSAL_TYPE_ADMIN_TAG[type] ?? { label: type, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Người đề xuất',
      key: 'nguoi_de_xuat',
      width: 180,
      render: (_, record) => (
        <Text strong>
          {record.nguoi_de_xuat ||
            record.NguoiDeXuat?.QuanNhan?.ho_ten ||
            record.NguoiDeXuat?.username ||
            '-'}
        </Text>
      ),
    },
    {
      title: 'Đơn vị',
      key: 'don_vi',
      width: 160,
      render: (_, record) => (
        <Tag color="blue">
          {record.don_vi ||
            record.DonViTrucThuoc?.ten_don_vi ||
            record.CoQuanDonVi?.ten_don_vi ||
            '-'}
        </Tag>
      ),
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
      align: 'center',
    },
    {
      title: 'Số lượng',
      key: 'so_luong',
      width: 100,
      align: 'center',
      render: (_, record) => {
        let count = 0;
        switch (record.loai_de_xuat) {
          case PROPOSAL_TYPES.NCKH:
            count = record.data_thanh_tich?.length || 0;
            break;
          case PROPOSAL_TYPES.NIEN_HAN:
          case PROPOSAL_TYPES.HC_QKQT:
          case PROPOSAL_TYPES.KNC_VSNXD_QDNDVN:
            count = record.data_nien_han?.length || 0;
            break;
          case PROPOSAL_TYPES.CONG_HIEN:
            count = record.data_cong_hien?.length || 0;
            break;
          default:
            count = record.selected_personnel?.length || record.data_danh_hieu?.length || 0;
            break;
        }
        return <Tag color="cyan">{count}</Tag>;
      },
    },
    {
      title: 'Thời gian cập nhật',
      key: 'ngay_duyet',
      width: 160,
      render: (value, record: Proposal) => {
        const dateValue = record.ngay_duyet || record.createdAt;
        if (!dateValue) return '-';
        return formatDateTime(dateValue);
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status: string) => {
        const cfg = PROPOSAL_STATUS_ADMIN[status] ?? { tableTagText: status, tagColor: 'default' };
        const icon =
          status === PROPOSAL_STATUS.PENDING ? (
            <ClockCircleOutlined />
          ) : status === PROPOSAL_STATUS.APPROVED ? (
            <CheckCircleOutlined />
          ) : status === PROPOSAL_STATUS.REJECTED ? (
            <CloseCircleOutlined />
          ) : undefined;
        return (
          <Tag icon={icon} color={cfg.tagColor}>
            {cfg.tableTagText}
          </Tag>
        );
      },
    },
    {
      title: 'Số quyết định',
      key: 'so_quyet_dinh',
      width: 180,
      align: 'center',
      render: (_, record: Proposal) => {
        if (record.status !== PROPOSAL_STATUS.APPROVED) {
          return <Text type="secondary">-</Text>;
        }

        let soQuyetDinh: string | null = null;
        if (record.data_danh_hieu && record.data_danh_hieu.length > 0) {
          soQuyetDinh = record.data_danh_hieu[0]?.so_quyet_dinh || null;
        } else if (record.data_thanh_tich && record.data_thanh_tich.length > 0) {
          soQuyetDinh = record.data_thanh_tich[0]?.so_quyet_dinh || null;
        }

        return soQuyetDinh ? <Text code>{soQuyetDinh}</Text> : <Text type="secondary">-</Text>;
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 200,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            Xem
          </Button>
          {record.status === PROPOSAL_STATUS.PENDING && (
            <>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleReject(record)}
              >
                Từ chối
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record)}
                style={{ color: '#52c41a' }}
              >
                Phê duyệt
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  // Get unique years
  const years = Array.from(new Set(proposals.map(p => p.nam))).sort((a, b) => b - a);

  const tabItems = [
    {
      key: PROPOSAL_STATUS.PENDING,
      label: (
        <span>
          <ClockCircleOutlined />{' '}
          {PROPOSAL_STATUS_ADMIN[PROPOSAL_STATUS.PENDING].tabLabel} (
          {proposals.filter(p => p.status === PROPOSAL_STATUS.PENDING).length})
        </span>
      ),
    },
    {
      key: PROPOSAL_STATUS.APPROVED,
      label: (
        <span>
          <CheckCircleOutlined />{' '}
          {PROPOSAL_STATUS_ADMIN[PROPOSAL_STATUS.APPROVED].tabLabel} (
          {proposals.filter(p => p.status === PROPOSAL_STATUS.APPROVED).length})
        </span>
      ),
    },
    {
      key: PROPOSAL_STATUS.REJECTED,
      label: (
        <span>
          <CloseCircleOutlined />{' '}
          {PROPOSAL_STATUS_ADMIN[PROPOSAL_STATUS.REJECTED].tabLabel} (
          {proposals.filter(p => p.status === PROPOSAL_STATUS.REJECTED).length})
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Breadcrumb */}
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          {
            title: (
              <Link href="/admin/dashboard">
                <HomeOutlined />
              </Link>
            ),
          },
          {
            title: 'Quản lý Đề xuất Khen thưởng',
          },
        ]}
      />

      {/* Header */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <Title level={2}>Quản lý Đề xuất Khen thưởng</Title>
          <Text type="secondary">Xem, phê duyệt hoặc từ chối các đề xuất khen thưởng</Text>
        </div>
        <Button
          type="primary"
          icon={<TrophyOutlined />}
          size="large"
          onClick={() => setExtraordinaryRewardModalVisible(true)}
        >
          Thêm Đột xuất
        </Button>
      </div>

      <Card>
        {/* Filters */}
        <Space style={{ marginBottom: 16 }} size="middle" wrap>
          <Input
            placeholder="Tìm theo người đề xuất"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            value={yearFilter}
            onChange={setYearFilter}
            style={{ width: 150 }}
            placeholder="Lọc theo năm"
          >
            <Select.Option value="ALL">Tất cả năm</Select.Option>
            {years.map(year => (
              <Select.Option key={year} value={year}>
                Năm {year}
              </Select.Option>
            ))}
          </Select>
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 180 }}
            placeholder="Lọc theo loại"
          >
            <Select.Option value="ALL">Tất cả loại</Select.Option>
            {Object.entries(PROPOSAL_TYPE_ADMIN_TAG).map(([key, config]) => (
              <Select.Option key={key} value={key}>
                {config.label}
              </Select.Option>
            ))}
          </Select>
        </Space>

        {/* Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={key => {
            if (key === PROPOSAL_STATUS.PENDING || key === PROPOSAL_STATUS.APPROVED || key === PROPOSAL_STATUS.REJECTED) {
              setActiveTab(key);
            }
          }}
          items={tabItems}
          style={{ marginBottom: 16 }}
        />

        {/* Action buttons for selected proposals */}
        {selectedRowKeys.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button type="primary" onClick={() => setDecisionModalVisible(true)}>
                Thêm quyết định ({selectedRowKeys.length} đề xuất)
              </Button>
              <Button onClick={() => setSelectedRowKeys([])}>Bỏ chọn</Button>
            </Space>
          </div>
        )}

        {/* Table */}
        <Table
          columns={columns}
          dataSource={filteredProposals}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: record => ({
              disabled: record.status !== PROPOSAL_STATUS.APPROVED, // Only approved proposals can be selected
            }),
          }}
          pagination={{
            ...DEFAULT_ANTD_TABLE_PAGINATION,
            showTotal: total => `Tổng số ${total} đề xuất`,
          }}
          bordered
          scroll={{ x: 1400 }}
          locale={{
            emptyText: <Empty description="Không có đề xuất nào" />,
          }}
        />
      </Card>

      {/* Modals */}
      {selectedProposal && (
        <>
          <ProposalDetailModal
            visible={detailModalVisible}
            proposal={selectedProposal}
            onClose={() => setDetailModalVisible(false)}
            onReject={() => {
              setDetailModalVisible(false);
              handleReject(selectedProposal);
            }}
            onApprove={() => {
              setDetailModalVisible(false);
              handleApprove(selectedProposal);
            }}
          />
          <RejectModal
            visible={rejectModalVisible}
            proposal={selectedProposal}
            onClose={() => setRejectModalVisible(false)}
            onSuccess={handleActionSuccess}
          />
          <ApproveModal
            visible={approveModalVisible}
            proposal={selectedProposal}
            onClose={() => setApproveModalVisible(false)}
            onSuccess={handleActionSuccess}
          />
        </>
      )}

      {/* Decision Modal - Sử dụng lại modal đã có */}
      <DecisionModal
        visible={decisionModalVisible}
        onClose={() => {
          setDecisionModalVisible(false);
          setSelectedDecision(null);
        }}
        onSuccess={async (decision, isNewDecision) => {
          setSelectedDecision(decision);

          const selectedProposals = filteredProposals.filter(p => selectedRowKeys.includes(p.id));

          try {
            const uploadPromises = selectedProposals.map(async proposal => {
              const formData = new FormData();

              formData.append('so_quyet_dinh', decision.so_quyet_dinh);

              if (decision.ghi_chu) {
                formData.append('ghi_chu', decision.ghi_chu);
              }


              await apiClient.uploadDecision(proposal.id, formData);
            });

            await Promise.all(uploadPromises);
            message.success(
              `Đã thêm quyết định cho ${selectedProposals.length} đề xuất thành công`
            );
            setDecisionModalVisible(false);
            setSelectedRowKeys([]);
            setSelectedDecision(null);
            fetchProposals();
          } catch (error: unknown) {
            if (isAxiosError(error) && error.response?.status === 404) {
              message.warning(
                'API endpoint chưa được tạo. Quyết định đã được lưu nhưng chưa gắn vào đề xuất.'
              );
            } else {
              message.error(
                getApiErrorMessage(error, 'Lỗi khi upload quyết định cho đề xuất')
              );
            }
          }
        }}
        loaiKhenThuong={
          selectedRowKeys.length > 0
            ? filteredProposals.find(p => selectedRowKeys.includes(p.id))?.loai_de_xuat
            : undefined
        }
      />
    </div>
  );
}
