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
  message,
  Tag,
  Tooltip,
  Empty,
  Popconfirm,
  Select,
  Row,
  Col,
} from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import {
  HomeOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { format } from 'date-fns';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { PROPOSAL_STATUS, PROPOSAL_TYPES } from '@/constants/proposal.constants';

const { Title, Text } = Typography;

interface Proposal {
  id: number;
  loai_de_xuat:
    | 'CA_NHAN_HANG_NAM'
    | 'DON_VI_HANG_NAM'
    | 'NIEN_HAN'
    | 'HC_QKQT'
    | 'KNC_VSNXD_QDNDVN'
    | 'CONG_HIEN'
    | 'DOT_XUAT'
    | 'NCKH';
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
  const [activeTab, setActiveTab] = useState('all');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [yearFilter, setYearFilter] = useState<number | ''>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProposals({ limit: 100 });

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

  const handleDownloadExcel = async (proposalId: number) => {
    try {
      setDownloadingId(proposalId);
      const blob = await apiClient.downloadProposalExcel(proposalId.toString());

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `de-xuat-${proposalId}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('Tải file thành công');
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Lỗi khi tải file'));
      // Error handled by UI message
    } finally {
      setDownloadingId(null);
    }
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
        (activeTab === 'pending' && p.status === PROPOSAL_STATUS.PENDING) ||
        (activeTab === 'approved' && p.status === PROPOSAL_STATUS.APPROVED) ||
        (activeTab === 'rejected' && p.status === PROPOSAL_STATUS.REJECTED);

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

  const getProposalTypeTag = (type: string) => {
    const typeConfig = {
      CA_NHAN_HANG_NAM: { color: 'blue', text: 'Cá nhân hằng năm' },
      DON_VI_HANG_NAM: { color: 'purple', text: 'Đơn vị hằng năm' },
      NIEN_HAN: { color: 'cyan', text: 'Huy chương Chiến sĩ vẻ vang' },
      HC_QKQT: { color: 'gold', text: 'HC Quân kỳ quyết thắng' },
      KNC_VSNXD_QDNDVN: { color: 'lime', text: 'KNC VSNXD QĐNDVN' },
      CONG_HIEN: { color: 'geekblue', text: 'Huân chương Bảo vệ Tổ quốc' },
      DOT_XUAT: { color: 'orange', text: 'Đột xuất' },
      NCKH: { color: 'magenta', text: 'Nghiên cứu khoa học' },
    };

    const config = typeConfig[type as keyof typeof typeConfig];
    return config ? <Tag color={config.color}>{config.text}</Tag> : <Tag>{type}</Tag>;
  };

  const getProposalTypeName = (type: string) => {
    const typeConfig = {
      CA_NHAN_HANG_NAM: 'Cá nhân hằng năm',
      DON_VI_HANG_NAM: 'Đơn vị hằng năm',
      NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
      HC_QKQT: 'HC Quân kỳ quyết thắng',
      KNC_VSNXD_QDNDVN: 'KNC VSNXD QĐNDVN',
      CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
      DOT_XUAT: 'Đột xuất',
      NCKH: 'Nghiên cứu khoa học',
    };
    return typeConfig[type as keyof typeof typeConfig] || type;
  };

  const getStatusTag = (status: string) => {
    const statusConfig = {
      [PROPOSAL_STATUS.PENDING]: { color: 'gold', icon: <ClockCircleOutlined />, text: 'Chờ duyệt' },
      [PROPOSAL_STATUS.APPROVED]: { color: 'green', icon: <CheckCircleOutlined />, text: 'Đã duyệt' },
      [PROPOSAL_STATUS.REJECTED]: { color: 'red', icon: <CloseCircleOutlined />, text: 'Từ chối' },
    };

    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => <Text strong>{index + 1}</Text>,
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
      render: (type: string) => getProposalTypeTag(type),
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
      render: (_: any, record: Proposal) => {
        let count = 0;
        let tooltip = '';

        switch (record.loai_de_xuat) {
          case PROPOSAL_TYPES.NCKH:
            count = record.so_thanh_tich ?? 0;
            tooltip = 'Số đề tài/sáng kiến khoa học';
            break;
          case PROPOSAL_TYPES.NIEN_HAN:
          case PROPOSAL_TYPES.HC_QKQT:
          case PROPOSAL_TYPES.KNC_VSNXD_QDNDVN:
            count = record.so_nien_han ?? 0;
            tooltip = 'Số quân nhân đề xuất huy chương chiến sĩ vẻ vang';
            break;
          case PROPOSAL_TYPES.CONG_HIEN:
            count = record.so_cong_hien ?? 0;
            tooltip = 'Số quân nhân đề xuất huân chương bảo vệ tổ quốc';
            break;
          case PROPOSAL_TYPES.DON_VI_HANG_NAM:
            count = record.so_danh_hieu ?? 0;
            tooltip = 'Số đơn vị đề xuất';
            break;
          case PROPOSAL_TYPES.CA_NHAN_HANG_NAM:
          default:
            count = record.so_danh_hieu ?? 0;
            tooltip = 'Số quân nhân đề xuất';
            break;
        }

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
      render: (status: string) => getStatusTag(status),
    },
    {
      title: 'Thời gian cập nhật',
      key: 'ngay_duyet',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: Proposal) => {
        // Hiển thị thời gian cập nhật khi đã duyệt hoặc từ chối
        if ((record.status !== PROPOSAL_STATUS.APPROVED && record.status !== PROPOSAL_STATUS.REJECTED) || !record.ngay_duyet) {
          return <Text type="secondary">-</Text>;
        }

        // Format: giờ đứng trước ngày (HH:mm dd/MM/yyyy)
        const date = new Date(record.ngay_duyet);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${hours}:${minutes} ${day}/${month}/${year}`;
      },
    },
    {
      title: 'Hành động',
      key: 'action',
      align: 'center' as const,
      width: 260,
      render: (_: any, record: Proposal) => (
        <Space>
          {/* Tạm thời ẩn chức năng tải file Excel */}
          {/* <Tooltip title="Tải file Excel">
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadExcel(record.id)}
              loading={downloadingId === record.id}
              size="small"
            >
              Tải file
            </Button>
          </Tooltip> */}
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
            <HomeOutlined /> Tất cả ({proposals.length})
          </span>
        ),
      },
      {
        key: 'pending',
        label: (
          <span>
            <ClockCircleOutlined /> Chờ duyệt ({statusCounts[PROPOSAL_STATUS.PENDING] || 0})
          </span>
        ),
      },
      {
        key: 'approved',
        label: (
          <span>
            <CheckCircleOutlined /> Đã duyệt ({statusCounts[PROPOSAL_STATUS.APPROVED] || 0})
          </span>
        ),
      },
      {
        key: 'rejected',
        label: (
          <span>
            <CloseCircleOutlined /> Từ chối ({statusCounts[PROPOSAL_STATUS.REJECTED] || 0})
          </span>
        ),
      },
    ];
  }, [proposals]);

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
                Đang hiển thị <strong>{filteredProposals.length}</strong> / {proposals.length} đề
                xuất
              </Typography.Text>
            </div>
          )}
        </Card>

        <Table
          columns={columns}
          dataSource={filteredProposals}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: pageSize,
            showTotal: total => `Tổng ${total} đề xuất`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onShowSizeChange: (current, size) => {
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
