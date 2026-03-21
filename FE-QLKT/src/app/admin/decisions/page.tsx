'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  InputNumber,
  Select,
  Tag,
  Typography,
  Breadcrumb,
  App,
  Popconfirm,
  Modal,
  Descriptions,
  DatePicker,
  Form,
  Upload,
} from 'antd';
import {
  HomeOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { previewFile } from '@/utils/filePreview';
import dayjs from 'dayjs';
import DecisionModal from '@/components/DecisionModal';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface Decision {
  id: string;
  so_quyet_dinh: string;
  nam: number;
  ngay_ky: string;
  nguoi_ky: string;
  file_path: string | null;
  loai_khen_thuong: string | null;
  ghi_chu: string | null;
  createdAt: string;
  updatedAt: string;
}

const loaiKhenThuongOptions = [
  { label: 'Cá nhân Hằng năm', value: 'CA_NHAN_HANG_NAM' },
  { label: 'Đơn vị Hằng năm', value: 'DON_VI_HANG_NAM' },
  { label: 'Huy chương Chiến sĩ vẻ vang', value: 'NIEN_HAN' },
  { label: 'Huân chương Bảo vệ Tổ quốc', value: 'CONG_HIEN' },
  { label: 'Đột xuất', value: 'DOT_XUAT' },
  { label: 'ĐTKH/SKKH', value: 'NCKH' },
];

export default function AdminDecisionsPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null);

  useEffect(() => {
    fetchDecisions();
  }, [pagination.current, pagination.pageSize, yearFilter, typeFilter, searchText]);

  const fetchDecisions = async (customPagination?: { current: number; pageSize: number }) => {
    try {
      // Chỉ set loading ban đầu, khi chuyển trang thì dùng tableLoading
      const paginationToUse = customPagination || pagination;
      if (decisions.length === 0 || paginationToUse.current === 1) {
        setLoading(true);
      } else {
        setTableLoading(true);
      }
      const params: any = {
        page: paginationToUse.current,
        limit: paginationToUse.pageSize,
      };
      if (yearFilter !== null && yearFilter !== undefined) {
        params.nam = yearFilter;
      }
      if (typeFilter !== 'ALL') {
        params.loai_khen_thuong = typeFilter;
      }
      if (searchText) {
        params.search = searchText;
      }

      const response = await apiClient.getDecisions(params);

      if (response.success) {
        // Backend trả về: { success: true, data: [...], pagination: {...} }
        // apiClient.getDecisions() đã parse và trả về: { success: true, data: [...], pagination: {...} }
        const decisions = Array.isArray(response.data) ? response.data : [];
        const paginationData = (response as any).pagination;

        setDecisions(decisions);
        setPagination({
          ...paginationToUse,
          total: paginationData?.total || decisions.length,
        });
      } else {
        // API returned unsuccessful response
        message.error(response.message || 'Lỗi khi tải danh sách quyết định');
      }
    } catch (error: any) {
      // Error handled by UI message
      message.error('Lỗi khi tải danh sách quyết định');
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await apiClient.deleteDecision(id);
      if (response.success) {
        message.success('Xóa quyết định thành công');
        fetchDecisions();
      } else {
        message.error(response.message || 'Lỗi khi xóa quyết định');
      }
    } catch (error: any) {
      message.error(error.message || 'Lỗi khi xóa quyết định');
    }
  };

  const handleViewDetail = (decision: Decision) => {
    setSelectedDecision(decision);
    setDetailModalVisible(true);
  };

  const handleEdit = (decision: Decision) => {
    setEditingDecision(decision);
    setDecisionModalVisible(true);
  };

  const handleAdd = () => {
    setEditingDecision(null);
    setDecisionModalVisible(true);
  };

  const handleModalSuccess = async () => {
    setDecisionModalVisible(false);
    setEditingDecision(null);
    // Reset về trang 1 và gọi API với pagination mới
    const newPagination = { ...pagination, current: 1 };
    setPagination(newPagination);
    // Gọi fetchDecisions với pagination mới để đảm bảo API được gọi với page=1
    await fetchDecisions(newPagination);
  };

  const handlePreviewFile = (filePath: string) => {
    previewFile(filePath);
  };

  const columns: ColumnsType<Decision> = [
    {
      title: 'STT',
      key: 'stt',
      width: 65,
      align: 'center',
      render: (_: any, __: any, index: number) =>
        (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    {
      title: 'Số quyết định',
      dataIndex: 'so_quyet_dinh',
      key: 'so_quyet_dinh',
      width: 200,
      align: 'center',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 90,
      align: 'center',
    },
    {
      title: 'Ngày ký',
      dataIndex: 'ngay_ky',
      key: 'ngay_ky',
      width: 120,
      align: 'center',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Người ký',
      dataIndex: 'nguoi_ky',
      key: 'nguoi_ky',
      width: 210,
      align: 'center',
    },
    {
      title: 'Loại khen thưởng',
      dataIndex: 'loai_khen_thuong',
      key: 'loai_khen_thuong',
      width: 150,
      align: 'center',
      render: (type: string | null) => {
        if (!type) return '-';
        const option = loaiKhenThuongOptions.find(opt => opt.value === type);
        return <Text>{option?.label || type}</Text>;
      },
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      key: 'ghi_chu',
      width: 200,
      align: 'center',
      render: (text: string | null) => {
        if (!text) return <Text type="secondary">-</Text>;
        return (
          <Text ellipsis={{ tooltip: text }} style={{ maxWidth: 200 }}>
            {text}
          </Text>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 200,
      fixed: 'right',
      align: 'center',
      render: (_: any, record: Decision) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
          <Space size="small" wrap style={{ justifyContent: 'center', width: '100%' }}>
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
              size="small"
              style={{ padding: '0 4px', minWidth: '60px' }}
            >
              Xem
            </Button>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
              style={{ padding: '0 4px', minWidth: '60px' }}
            >
              Sửa
            </Button>
          </Space>
          <Space size="small" wrap style={{ justifyContent: 'center', width: '100%' }}>
            <Popconfirm
              title="Xác nhận xóa"
              description="Bạn có chắc chắn muốn xóa quyết định này?"
              onConfirm={() => handleDelete(record.id)}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                size="small"
                style={{ padding: '0 4px', minWidth: '60px' }}
              >
                Xóa
              </Button>
            </Popconfirm>
            {record.file_path && (
              <Button
                type="link"
                icon={<FileTextOutlined />}
                onClick={() => handlePreviewFile(record.file_path!)}
                size="small"
                style={{ padding: '0 4px', minWidth: '60px' }}
              >
                Xem PDF
              </Button>
            )}
          </Space>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb
        items={[
          { title: <HomeOutlined />, href: '/admin/dashboard' },
          { title: 'Quản lý quyết định' },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Card>
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            Quản lý Quyết định Khen thưởng
          </Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Thêm quyết định
          </Button>
        </div>

        {/* Filters */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Tìm kiếm số quyết định, người ký..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <InputNumber
            placeholder="Nhập năm"
            value={yearFilter}
            onChange={value => setYearFilter(value || null)}
            style={{ width: 150 }}
            min={1900}
            max={2100}
            controls={false}
          />
          <Select
            placeholder="Chọn loại khen thưởng"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 200 }}
            allowClear
          >
            <Select.Option value="ALL">Tất cả loại</Select.Option>
            {loaiKhenThuongOptions.map(option => (
              <Select.Option key={option.value} value={option.value}>
                {option.label}
              </Select.Option>
            ))}
          </Select>
        </Space>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={decisions}
          rowKey="id"
          loading={loading || tableLoading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} quyết định`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => {
              setTableLoading(true);
              setPagination({
                ...pagination,
                current: page,
                pageSize: pageSize || pagination.pageSize,
              });
            },
            onShowSizeChange: (current, size) => {
              setTableLoading(true);
              setPagination({ ...pagination, current: 1, pageSize: size });
            },
          }}
          bordered
          locale={{
            emptyText: 'Không có quyết định nào',
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Chi tiết Quyết định"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>,
          selectedDecision?.file_path && (
            <Button
              key="preview"
              type="primary"
              icon={<EyeOutlined />}
              onClick={() => handlePreviewFile(selectedDecision!.file_path!)}
            >
              Xem file PDF
            </Button>
          ),
        ]}
        width={700}
        centered
        style={{ borderRadius: 8 }}
        styles={{ body: { borderRadius: 8 } }}
      >
        {selectedDecision && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Số quyết định">
              <Text strong>{selectedDecision.so_quyet_dinh}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Năm">{selectedDecision.nam}</Descriptions.Item>
            <Descriptions.Item label="Ngày ký">
              {dayjs(selectedDecision.ngay_ky).format('DD/MM/YYYY')}
            </Descriptions.Item>
            <Descriptions.Item label="Người ký">{selectedDecision.nguoi_ky}</Descriptions.Item>
            <Descriptions.Item label="Loại khen thưởng">
              {selectedDecision.loai_khen_thuong ? (
                <Tag color="blue">
                  {loaiKhenThuongOptions.find(
                    opt => opt.value === selectedDecision.loai_khen_thuong
                  )?.label || selectedDecision.loai_khen_thuong}
                </Tag>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú">{selectedDecision.ghi_chu || '-'}</Descriptions.Item>
            <Descriptions.Item label="File PDF">
              {selectedDecision.file_path ? (
                <Button
                  type="link"
                  icon={<FileTextOutlined />}
                  onClick={() => handlePreviewFile(selectedDecision!.file_path!)}
                >
                  {selectedDecision.file_path.split('/').pop()}
                </Button>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">
              {dayjs(selectedDecision.createdAt).format('DD/MM/YYYY HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày cập nhật">
              {dayjs(selectedDecision.updatedAt).format('DD/MM/YYYY HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Decision Modal for Add/Edit */}
      <DecisionModal
        visible={decisionModalVisible}
        onClose={() => {
          setDecisionModalVisible(false);
          setEditingDecision(null);
        }}
        onSuccess={handleModalSuccess}
        loaiKhenThuong={editingDecision?.loai_khen_thuong || undefined}
        initialDecision={
          editingDecision
            ? {
                id: editingDecision.id,
                so_quyet_dinh: editingDecision.so_quyet_dinh,
                nam: editingDecision.nam,
                ngay_ky: dayjs(editingDecision.ngay_ky),
                nguoi_ky: editingDecision.nguoi_ky,
                file_path: editingDecision.file_path,
                loai_khen_thuong: editingDecision.loai_khen_thuong || undefined,
                ghi_chu: editingDecision.ghi_chu || undefined,
              }
            : undefined
        }
      />
    </div>
  );
}
