'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Tabs,
  Table,
  Button,
  Typography,
  Breadcrumb,
  Space,
  message,
  Tooltip,
  Empty,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getApiErrorMessage } from '@/lib/apiError';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_ANTD_TABLE_PAGINATION,
} from '@/constants/pagination.constants';
import { formatDateTime } from '@/lib/utils';

import { HomeOutlined, EyeOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { apiClient } from '@/lib/apiClient';
import {
  PROPOSAL_STATUS,
  PROPOSAL_TYPES,
  getProposalTypeLabel,
  type ProposalType,
} from '@/constants/proposal.constants';
import { ProposalListFilterBar } from '@/components/proposals/ProposalListFilterBar';
import { ProposalStatusTag } from '@/components/proposals/ProposalStatusTag';
import { useProposalListFilters } from '@/hooks/useProposalListFilters';
import { buildProposalListTabItems } from '@/lib/proposalListTabs';

const { Title, Text } = Typography;

interface Proposal {
  id: string;
  loai_de_xuat: ProposalType;
  nam: number;
  don_vi: string;
  nguoi_de_xuat: string;
  status: string;
  so_danh_hieu: number;
  so_thanh_tich: number;
  so_nien_han: number;
  so_cong_hien: number;
  nguoi_duyet: string | null;
  ngay_duyet: string | null;
  ly_do: string | null;
  ghi_chu: string | null;
  createdAt: string;
  file_excel_path?: string;
  data_danh_hieu?: Array<{ so_quyet_dinh?: string | null }>;
  data_thanh_tich?: Array<{ so_quyet_dinh?: string | null }>;
}

export default function ManagerProposalsPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const {
    activeTab,
    setActiveTab,
    yearFilter,
    setYearFilter,
    typeFilter,
    setTypeFilter,
    resetFilters,
    availableYears,
    availableTypes,
    filteredProposals,
  } = useProposalListFilters(proposals);

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProposals({ limit: 100 });

      if (response.success) {
        setProposals(response.data ?? []);
      } else {
        message.error(response.message || 'Không thể tải danh sách đề xuất');
      }
    } catch (error: unknown) {
      message.error('Lỗi khi tải danh sách đề xuất');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProposal = async (proposalId: string) => {
    try {
      setDeletingId(proposalId);
      const response = await apiClient.deleteProposal(proposalId);

      if (response.success) {
        message.success(response.message || 'Đã xóa đề xuất thành công');
        await fetchProposals();
      } else {
        message.error(response.message || 'Lỗi khi xóa đề xuất');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Lỗi khi xóa đề xuất'));
    } finally {
      setDeletingId(null);
    }
  };

  const columns: ColumnsType<Proposal> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: ( value, record, index) => <Text strong>{index + 1}</Text>,
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      align: 'center' as const,
      render: (date: string) => {
        const d = new Date(date);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${hours}:${minutes} ${day}/${month}/${year}`;
      },
    },
    {
      title: 'Loại đề xuất',
      dataIndex: 'loai_de_xuat',
      key: 'loai_de_xuat',
      width: 180,
      align: 'center' as const,
      render: (type: string) => getProposalTypeLabel(type),
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
      align: 'center' as const,
      render: (nam: number) => <Text strong>{nam}</Text>,
    },
    {
      title: 'Số lượng',
      key: 'so_luong',
      align: 'center' as const,
      width: 120,
      render: (value, record) => {
        const countTooltipMap: Record<string, { count: number; tooltip: string }> = {
          [PROPOSAL_TYPES.NCKH]: { count: record.so_thanh_tich ?? 0, tooltip: 'Số đề tài/sáng kiến khoa học' },
          [PROPOSAL_TYPES.NIEN_HAN]: { count: record.so_nien_han ?? 0, tooltip: 'Số quân nhân đề xuất huy chương chiến sĩ vẻ vang' },
          [PROPOSAL_TYPES.HC_QKQT]: { count: record.so_nien_han ?? 0, tooltip: 'Số quân nhân đề xuất huy chương chiến sĩ vẻ vang' },
          [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: { count: record.so_nien_han ?? 0, tooltip: 'Số quân nhân đề xuất huy chương chiến sĩ vẻ vang' },
          [PROPOSAL_TYPES.CONG_HIEN]: { count: record.so_cong_hien ?? 0, tooltip: 'Số quân nhân đề xuất Huân chương Bảo vệ Tổ quốc' },
          [PROPOSAL_TYPES.DON_VI_HANG_NAM]: { count: record.so_danh_hieu ?? 0, tooltip: 'Số đơn vị đề xuất' },
        };
        const { count, tooltip } = countTooltipMap[record.loai_de_xuat] ?? { count: record.so_danh_hieu ?? 0, tooltip: 'Số quân nhân đề xuất' };

        return (
          <Tooltip title={tooltip}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{count}</span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center' as const,
      render: (status: string) => <ProposalStatusTag status={status} variant="manager" />,
    },
    {
      title: 'Thời gian cập nhật',
      key: 'ngay_duyet',
      width: 180,
      align: 'center' as const,
      render: (value, record) => {
        const dateValue = record.ngay_duyet || record.createdAt;
        if (!dateValue) return <Text type="secondary">-</Text>;

        return formatDateTime(dateValue);
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      align: 'center' as const,
      width: 260,
      render: (value, record) => (
        <Space>
          <Button
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/manager/proposals/${record.id}`)}
            size="small"
          >
            Chi tiết
          </Button>
          {record.status === PROPOSAL_STATUS.PENDING && (
            <Popconfirm
              title="Xóa đề xuất"
              description="Bạn có chắc chắn muốn xóa đề xuất này? Hành động này không thể hoàn tác."
              onConfirm={() => handleDeleteProposal(record.id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={deletingId === record.id}
                size="small"
              >
                Xóa
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = useMemo(
    () => buildProposalListTabItems(proposals, 'manager'),
    [proposals]
  );

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <Breadcrumb.Item>
          <Link href="/manager/dashboard">
            <HomeOutlined />
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>Đề xuất khen thưởng</Breadcrumb.Item>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <Title level={2} className="!mb-0">
          Đề xuất khen thưởng
        </Title>
        <Link href="/manager/proposals/create">
          <Button type="primary" icon={<PlusOutlined />} size="large">
            Tạo đề xuất mới
          </Button>
        </Link>
      </div>

      {/* Info Card */}
      <Card className="shadow-sm bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <Space direction="vertical" size="small">
          <Text strong>📋 Hướng dẫn:</Text>
          <Text>• Tại đây bạn có thể theo dõi trạng thái các đề xuất đã gửi</Text>
          <Text>
            • Nếu đề xuất bị{' '}
            <Text type="danger" strong>
              từ chối
            </Text>
            , bạn có thể xem lý do từ chối tại mục chi tiết đề xuất
          </Text>
        </Space>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

        <ProposalListFilterBar
          availableYears={availableYears}
          availableTypes={availableTypes}
          yearFilter={yearFilter}
          onYearChange={setYearFilter}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          onReset={resetFilters}
          filteredCount={filteredProposals.length}
          totalCount={proposals.length}
        />

        <Table
          columns={columns}
          dataSource={filteredProposals}
          rowKey="id"
          loading={loading}
          pagination={{
            ...DEFAULT_ANTD_TABLE_PAGINATION,
            pageSize,
            showTotal: total => `Tổng ${total} đề xuất`,
            onShowSizeChange: (_current, size) => {
              setPageSize(size);
            },
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  activeTab === 'all'
                    ? 'Chưa có đề xuất nào'
                    : activeTab === 'pending'
                      ? 'Không có đề xuất chờ duyệt'
                      : activeTab === 'approved'
                        ? 'Không có đề xuất đã duyệt'
                        : 'Không có đề xuất bị từ chối'
                }
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}
