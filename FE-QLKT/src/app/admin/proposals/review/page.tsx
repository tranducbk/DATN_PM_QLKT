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
import { format } from 'date-fns';
import { apiClient } from '@/lib/api-client';
import { message } from 'antd';

const { Title, Paragraph } = Typography;

interface Proposal {
  id: number;
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
  const [pageSize, setPageSize] = useState(10);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProposals({ page: 1, limit: 100 });

      if (response.success) {
        setProposals(response.data?.proposals || []);
      } else {
        message.error(response.message || 'Không thể tải danh sách đề xuất');
      }
    } catch (error: unknown) {
      message.error('Lỗi khi tải danh sách đề xuất');
      // Error handled by UI message
    } finally {
      setLoading(false);
    }
  };

  // Lấy danh sách các năm có trong dữ liệu
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    proposals.forEach(proposal => {
      if (proposal.nam) {
        years.add(proposal.nam);
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sắp xếp giảm dần
  }, [proposals]);

  // Lấy danh sách các loại đề xuất có trong dữ liệu
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    proposals.forEach(proposal => {
      if (proposal.loai_de_xuat) {
        types.add(proposal.loai_de_xuat);
      }
    });
    return Array.from(types);
  }, [proposals]);

  // Tối ưu filteredProposals với useMemo
  const filteredProposals = useMemo(() => {
    return proposals.filter(p => {
      // Filter theo tab
      const statusMatch =
        activeTab === 'all' ||
        (activeTab === 'pending' && p.status === 'PENDING') ||
        (activeTab === 'approved' && p.status === 'APPROVED') ||
        (activeTab === 'rejected' && p.status === 'REJECTED');

      if (!statusMatch) return false;

      // Filter theo năm
      if (yearFilter !== '' && p.nam !== yearFilter) return false;

      // Filter theo loại đề xuất
      if (typeFilter !== '' && p.loai_de_xuat !== typeFilter) return false;

      return true;
    });
  }, [proposals, activeTab, yearFilter, typeFilter]);

  const handleResetFilters = () => {
    setYearFilter('');
    setTypeFilter('');
  };

  const handleDeleteProposal = async (proposalId: number) => {
    try {
      setDeletingId(proposalId);
      const response = await apiClient.deleteProposal(proposalId.toString());

      if (response.success) {
        message.success(response.message || 'Đã xóa đề xuất thành công');
        // Refresh danh sách
        await fetchProposals();
      } else {
        message.error(response.message || 'Lỗi khi xóa đề xuất');
      }
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Lỗi khi xóa đề xuất'));
      // Error handled by UI message
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'PENDING') {
      return <Badge color="gold" text="Chờ duyệt" />;
    }
    if (status === 'APPROVED') {
      return <Badge color="green" text="Đã duyệt" />;
    }
    return <Badge color="red" text="Từ chối" />;
  };

  const getProposalTypeName = (loaiDeXuat?: string) => {
    const typeMap: Record<string, string> = {
      CA_NHAN_HANG_NAM: 'Cá nhân hằng năm',
      DON_VI_HANG_NAM: 'Đơn vị hằng năm',
      NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
      HC_QKQT: 'Huy chương Quân kỳ Quyết thắng',
      KNC_VSNXD_QDNDVN: 'Kỷ niệm chương VSNXD QĐNDVN',
      CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
      NCKH: 'Nghiên cứu khoa học',
      DOT_XUAT: 'Đột xuất',
    };
    return loaiDeXuat ? typeMap[loaiDeXuat] || loaiDeXuat : '-';
  };

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => (
        <div style={{ textAlign: 'center' }}>{index + 1}</div>
      ),
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
        <div style={{ textAlign: 'center' }}>{getProposalTypeName(loaiDeXuat)}</div>
      ),
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'center' as const,
      render: (date: string) => (
        <div style={{ textAlign: 'center' }}>{format(new Date(date), 'dd/MM/yyyy HH:mm')}</div>
      ),
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      align: 'center' as const,
      render: (text: string | number) => <div style={{ textAlign: 'center' }}>{text}</div>,
    },
    {
      title: 'Số lượng',
      key: 'so_luong',
      align: 'center' as const,
      width: 100,
      render: (_: any, record: Proposal) => {
        let count = 0;
        switch (record.loai_de_xuat) {
          case 'NCKH':
            count = record.so_thanh_tich ?? 0;
            break;
          case 'NIEN_HAN':
          case 'HC_QKQT':
          case 'KNC_VSNXD_QDNDVN':
            count = record.so_nien_han ?? 0;
            break;
          case 'CONG_HIEN':
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
      render: (_: any, record: Proposal) => (
        <div style={{ textAlign: 'center' }}>
          <Space>
            <Button
              type="default"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/admin/proposals/review/${record.id}`)}
            >
              {record.status === 'PENDING' ? 'Xem và Duyệt' : 'Xem Chi Tiết'}
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

  // Tối ưu tabItems với useMemo để tránh tính toán lại số lượng mỗi lần render
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
            Chờ duyệt ({statusCounts.PENDING || 0})
          </span>
        ),
      },
      {
        key: 'approved',
        label: (
          <span>
            <CheckCircleOutlined style={{ marginRight: 8 }} />
            Đã duyệt ({statusCounts.APPROVED || 0})
          </span>
        ),
      },
      {
        key: 'rejected',
        label: (
          <span>
            <WarningOutlined style={{ marginRight: 8 }} />
            Đã từ chối ({statusCounts.REJECTED || 0})
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
                <Paragraph style={{ margin: 0, color: '#666' }}>
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
              <Card size="small" style={{ marginBottom: 16 }} bodyStyle={{ padding: '16px' }}>
                <Row gutter={[16, 16]} align="bottom">
                  <Col xs={24} sm={12} md={6}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label
                        style={{
                          display: 'block',
                          marginBottom: 4,
                          fontSize: 12,
                          color: '#666',
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
                          color: '#666',
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
                            {getProposalTypeName(type)}
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
                  <div style={{ marginTop: '12px', color: '#666' }}>Đang tải...</div>
                </div>
              ) : filteredProposals.length === 0 ? (
                <Empty
                  image={<WarningOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                  description={
                    <div>
                      <div style={{ fontWeight: 500 }}>Không có đề xuất nào</div>
                      <div style={{ fontSize: '14px', marginTop: '4px' }}>
                        {activeTab === 'all'
                          ? 'Chưa có đề xuất nào'
                          : activeTab === 'pending'
                            ? 'Chưa có đề xuất chờ phê duyệt'
                            : activeTab === 'approved'
                              ? 'Chưa có đề xuất nào được phê duyệt'
                              : 'Chưa có đề xuất nào bị từ chối'}
                      </div>
                    </div>
                  }
                />
              ) : (
                <Table
                  columns={columns}
                  dataSource={filteredProposals}
                  rowKey="id"
                  pagination={{
                    pageSize: pageSize,
                    showTotal: total => `Tổng ${total} đề xuất`,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    onShowSizeChange: (current, size) => {
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
