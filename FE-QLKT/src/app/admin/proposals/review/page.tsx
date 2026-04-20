'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Tabs,
  Table,
  Button,
  Badge,
  Typography,
  Breadcrumb,
  Space,
  Spin,
  Empty,
  Select,
  Row,
  Col,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getApiErrorMessage } from '@/lib/apiError';

import {
  HomeOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  LoadingOutlined,
  UnorderedListOutlined,
  FilterOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_ANTD_TABLE_PAGINATION,
} from '@/lib/constants/pagination.constants';
import { formatDateTime } from '@/lib/utils';
import { message } from 'antd';
import {
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_TYPES,
  getProposalTypeLabel,
  getProposalStatusLabel,
  PROPOSAL_STATUS_BADGE_COLORS,
} from '@/constants/proposal.constants';

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
  const [activeTab, setActiveTab] = useState('all');
  const [yearFilter, setYearFilter] = useState<number | ''>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    proposals.forEach(proposal => {
      if (proposal.nam) {
        years.add(proposal.nam);
      }
    });
    return Array.from(years).sort((a, b) => b - a); // descending
  }, [proposals]);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    proposals.forEach(proposal => {
      if (proposal.loai_de_xuat) {
        types.add(proposal.loai_de_xuat);
      }
    });
    return Array.from(types);
  }, [proposals]);

  const filteredProposals = useMemo(() => {
    return proposals.filter(p => {
      // Filter theo tab
      const statusMatch =
        activeTab === 'all' ||
        (activeTab === 'pending' && p.status === PROPOSAL_STATUS.PENDING) ||
        (activeTab === 'approved' && p.status === PROPOSAL_STATUS.APPROVED) ||
        (activeTab === 'rejected' && p.status === PROPOSAL_STATUS.REJECTED);

      if (!statusMatch) return false;

      if (yearFilter !== '' && p.nam !== yearFilter) return false;

      if (typeFilter !== '' && p.loai_de_xuat !== typeFilter) return false;

      return true;
    });
  }, [proposals, activeTab, yearFilter, typeFilter]);

  const handleResetFilters = () => {
    setYearFilter('');
    setTypeFilter('');
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

  const getStatusBadge = (status: string) => (
    <Badge
      color={PROPOSAL_STATUS_BADGE_COLORS[status] || 'default'}
      text={getProposalStatusLabel(status)}
    />
  );

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
        let count = 0;
        switch (record.loai_de_xuat) {
          case PROPOSAL_TYPES.NCKH:
            count = record.so_thanh_tich ?? 0;
            break;
          case PROPOSAL_TYPES.NIEN_HAN:
          case PROPOSAL_TYPES.HC_QKQT:
          case PROPOSAL_TYPES.KNC_VSNXD_QDNDVN:
            count = record.so_nien_han ?? 0;
            break;
          case PROPOSAL_TYPES.CONG_HIEN:
            count = record.so_cong_hien ?? 0;
            break;
          default:
            count = record.so_danh_hieu ?? 0;
            break;
        }
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
        <div style={{ textAlign: 'center' }}>{getStatusBadge(status)}</div>
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
              {record.status === PROPOSAL_STATUS.PENDING ? 'Xem và Duyệt' : 'Xem Chi Tiết'}
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

  const tabItems = useMemo(() => {
    const statusCounts = proposals.reduce(
      (acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return [
      {
        key: 'all',
        label: (
          <span>
            <UnorderedListOutlined style={{ marginRight: 8 }} />
            Tất cả ({proposals.length})
          </span>
        ),
      },
      {
        key: 'pending',
        label: (
          <span>
            <ClockCircleOutlined style={{ marginRight: 8 }} />
            {PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.PENDING]} (
            {statusCounts[PROPOSAL_STATUS.PENDING] || 0})
          </span>
        ),
      },
      {
        key: 'approved',
        label: (
          <span>
            <CheckCircleOutlined style={{ marginRight: 8 }} />
            {PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.APPROVED]} (
            {statusCounts[PROPOSAL_STATUS.APPROVED] || 0})
          </span>
        ),
      },
      {
        key: 'rejected',
        label: (
          <span>
            <WarningOutlined style={{ marginRight: 8 }} />
            Đã từ chối ({statusCounts[PROPOSAL_STATUS.REJECTED] || 0})
          </span>
        ),
      },
    ];
  }, [proposals]);

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item href="/">
          <HomeOutlined />
        </Breadcrumb.Item>
        <Breadcrumb.Item>Duyệt Đề Xuất</Breadcrumb.Item>
      </Breadcrumb>

      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Duyệt Đề Xuất Khen Thưởng</Title>
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
                      ? "Nhấn 'Xem và Duyệt' để kiểm tra và phê duyệt đề xuất"
                      : activeTab === 'approved'
                        ? 'Danh sách các đề xuất đã được phê duyệt và import vào hệ thống'
                        : 'Danh sách các đề xuất đã bị từ chối'}
                </Paragraph>
              }
            >
              {/* Filter Section */}
              <Card
                size="small"
                style={{ marginBottom: 16 }}
                styles={{ body: { padding: '16px' } }}
              >
                <Row gutter={[16, 16]} align="bottom">
                  <Col xs={24} sm={12} md={6}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: 4,
                          fontSize: 12,
                        }}
                      >
                        <FilterOutlined /> Năm
                      </label>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="Tất cả các năm"
                        value={yearFilter || ''}
                        onChange={value => setYearFilter(value ? Number(value) : '')}
                        allowClear={yearFilter !== ''}
                        size="large"
                      >
                        <Select.Option value="">Tất cả các năm</Select.Option>
                        {availableYears.map(year => (
                          <Select.Option key={year} value={year}>
                            {year}
                          </Select.Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: 4,
                          fontSize: 12,
                        }}
                      >
                        <FilterOutlined /> Loại đề xuất
                      </label>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="Tất cả loại"
                        value={typeFilter || ''}
                        onChange={value => setTypeFilter(value || '')}
                        allowClear={typeFilter !== ''}
                        size="large"
                      >
                        <Select.Option value="">Tất cả các loại đề xuất</Select.Option>
                        {availableTypes.map(type => (
                          <Select.Option key={type} value={type}>
                            {getProposalTypeLabel(type)}
                          </Select.Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                  <Col xs={24} sm={24} md={4}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ height: '22px', marginBottom: '8px' }}></div>
                      <Button
                        onClick={handleResetFilters}
                        size="large"
                        style={{ width: '100%' }}
                        icon={null}
                      >
                        Xóa bộ lọc
                      </Button>
                    </div>
                  </Col>
                </Row>
                {(yearFilter !== '' || typeFilter !== '') && (
                  <div style={{ marginTop: 12 }}>
                    <Typography.Text type="secondary">
                      Đang hiển thị <strong>{filteredProposals.length}</strong> / {proposals.length}{' '}
                      đề xuất
                    </Typography.Text>
                  </div>
                )}
              </Card>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
                  <div style={{ marginTop: '12px' }}>
                    <Typography.Text type="secondary">Đang tải...</Typography.Text>
                  </div>
                </div>
              ) : filteredProposals.length === 0 ? (
                <Empty
                  description={
                    activeTab === 'all'
                      ? 'Chưa có đề xuất nào'
                      : activeTab === 'pending'
                        ? 'Chưa có đề xuất chờ phê duyệt'
                        : activeTab === 'approved'
                          ? 'Chưa có đề xuất nào được phê duyệt'
                          : 'Chưa có đề xuất nào bị từ chối'
                  }
                  style={{ padding: '48px 0' }}
                />
              ) : (
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
