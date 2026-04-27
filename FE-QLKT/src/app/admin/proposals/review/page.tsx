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
  Spin,
  Empty,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getApiErrorMessage } from '@/lib/apiError';

import { HomeOutlined, EyeOutlined, LoadingOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_ANTD_TABLE_PAGINATION,
} from '@/constants/pagination.constants';
import { formatDateTime } from '@/lib/utils';
import { message } from 'antd';
import { PROPOSAL_STATUS, PROPOSAL_TYPES, getProposalTypeLabel } from '@/constants/proposal.constants';
import { ProposalListFilterBar } from '@/components/proposals/ProposalListFilterBar';
import { ProposalStatusTag } from '@/components/proposals/ProposalStatusTag';
import { useProposalListFilters } from '@/hooks/useProposalListFilters';
import { buildProposalListTabItems } from '@/lib/proposalListTabs';

const { Title, Paragraph } = Typography;

interface Proposal {
  id: string;
  don_vi: string;
  nguoi_de_xuat: string;
  status: string;
  so_danh_hieu: number;
  so_thanh_tich: number;
  so_nien_han: number;
  so_cong_hien: number;
  nguoi_duyet: string | null;
  ngay_duyet: string | null;
  ghi_chu: string | null;
  createdAt: string;
  loai_de_xuat?: string;
  nam?: number;
}

export default function ProposalReviewPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      const response = await apiClient.getProposals({ page: 1, limit: 100 });

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
      render: ( value, record, index) => <div style={{ textAlign: 'center' }}>{index + 1}</div>,
    },
    {
      title: 'Đơn vị',
      dataIndex: 'don_vi',
      key: 'don_vi',
      align: 'center' as const,
      render: (text: string) => <div style={{ textAlign: 'center' }}>{text}</div>,
    },
    {
      title: 'Người đề xuất',
      dataIndex: 'nguoi_de_xuat',
      key: 'nguoi_de_xuat',
      align: 'center' as const,
      render: (text: string) => <div style={{ textAlign: 'center' }}>{text}</div>,
    },
    {
      title: 'Loại đề xuất',
      dataIndex: 'loai_de_xuat',
      key: 'loai_de_xuat',
      align: 'center' as const,
      render: (loaiDeXuat: string) => (
        <div style={{ textAlign: 'center' }}>{getProposalTypeLabel(loaiDeXuat)}</div>
      ),
    },
    {
      title: 'Thời gian cập nhật',
      key: 'ngay_duyet',
      align: 'center' as const,
      render: (value, record) => {
        const dateValue = record.ngay_duyet || record.createdAt;
        if (!dateValue) return '-';
        return <div style={{ textAlign: 'center' }}>{formatDateTime(dateValue)}</div>;
      },
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      align: 'center' as const,
      render: (text: number) => <div style={{ textAlign: 'center' }}>{text}</div>,
    },
    {
      title: 'Số lượng',
      key: 'so_luong',
      align: 'center' as const,
      width: 100,
      render: (value, record) => {
        const countFieldMap: Record<string, keyof Proposal> = {
          [PROPOSAL_TYPES.NCKH]: 'so_thanh_tich',
          [PROPOSAL_TYPES.NIEN_HAN]: 'so_nien_han',
          [PROPOSAL_TYPES.HC_QKQT]: 'so_nien_han',
          [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: 'so_nien_han',
          [PROPOSAL_TYPES.CONG_HIEN]: 'so_cong_hien',
        };
        const proposalType = record.loai_de_xuat ?? '';
        const countField = countFieldMap[proposalType];
        const count = (countField ? record[countField] : record.so_danh_hieu) ?? 0;
        return (
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{count}</span>
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      align: 'center' as const,
      render: (status: string) => (
        <div style={{ textAlign: 'center' }}>
          <ProposalStatusTag status={status} variant="adminReview" />
        </div>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      align: 'center' as const,
      width: 200,
      render: (value, record) => (
        <div style={{ textAlign: 'center' }}>
          <Space>
            <Button
              type="default"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/admin/proposals/review/${record.id}`)}
            >
              {record.status === PROPOSAL_STATUS.PENDING ? 'Xem và duyệt' : 'Xem chi tiết'}
            </Button>
            <Popconfirm
              title="Xóa đề xuất"
              description="Bạn có chắc chắn muốn xóa đề xuất này? Hành động này không thể hoàn tác."
              onConfirm={() => handleDeleteProposal(record.id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />} loading={deletingId === record.id}>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        </div>
      ),
    },
  ];

  const tabItems = useMemo(
    () => buildProposalListTabItems(proposals, 'adminReview'),
    [proposals]
  );

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item href="/">
          <HomeOutlined />
        </Breadcrumb.Item>
        <Breadcrumb.Item>Duyệt đề xuất</Breadcrumb.Item>
      </Breadcrumb>

      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Duyệt đề xuất khen thưởng</Title>
        <Paragraph>Xem và phê duyệt các đề xuất khen thưởng từ các đơn vị</Paragraph>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems.map(item => ({
          ...item,
          children: (
            <Card
              title={
                activeTab === 'all'
                  ? 'Tất cả đề xuất'
                  : activeTab === 'pending'
                    ? 'Đề xuất đang chờ phê duyệt'
                    : activeTab === 'approved'
                      ? 'Đề xuất đã được phê duyệt'
                      : 'Đề xuất đã bị từ chối'
              }
              extra={
                <Paragraph type="secondary" style={{ margin: 0 }}>
                  {activeTab === 'all'
                    ? 'Danh sách tất cả các đề xuất'
                    : activeTab === 'pending'
                      ? "Nhấn 'Xem và duyệt' để kiểm tra và phê duyệt đề xuất"
                      : activeTab === 'approved'
                        ? 'Danh sách các đề xuất đã được phê duyệt và nhập vào hệ thống'
                        : 'Danh sách các đề xuất đã bị từ chối'}
                </Paragraph>
              }
            >
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

              {loading && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
                  <div style={{ marginTop: '12px' }}>
                    <Typography.Text type="secondary">Đang tải...</Typography.Text>
                  </div>
                </div>
              )}
              {!loading && filteredProposals.length === 0 && (
                <Empty
                  description={
                    {
                      all: 'Chưa có đề xuất nào',
                      pending: 'Chưa có đề xuất chờ phê duyệt',
                      approved: 'Chưa có đề xuất nào được phê duyệt',
                      rejected: 'Chưa có đề xuất nào bị từ chối',
                    }[activeTab] ?? 'Chưa có đề xuất nào'
                  }
                  style={{ padding: '48px 0' }}
                />
              )}
              {!loading && filteredProposals.length > 0 && (
                <Table
                  columns={columns}
                  dataSource={filteredProposals}
                  rowKey="id"
                  pagination={{
                    ...DEFAULT_ANTD_TABLE_PAGINATION,
                    pageSize,
                    showTotal: total => `Tổng ${total} đề xuất`,
                    onShowSizeChange: (_current, size) => {
                      setPageSize(size);
                    },
                  }}
                />
              )}
            </Card>
          ),
        }))}
      />
    </div>
  );
}
