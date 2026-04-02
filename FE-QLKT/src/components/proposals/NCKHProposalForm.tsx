'use client';

import { useState } from 'react';
import {
  Table,
  Button,
  Form,
  Input,
  Select,
  InputNumber,
  Space,
  Modal,
  message,
  Popconfirm,
  Tag,
  Alert,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_COLORS,
  getProposalStatusLabel,
} from '@/constants/proposal.constants';

interface NCKHRecord {
  key: string;
  personnel_name: string;
  cccd: string;
  nam: number;
  loai: 'DTKH' | 'SKKH';
  mo_ta: string;
  status: typeof PROPOSAL_STATUS.APPROVED | typeof PROPOSAL_STATUS.PENDING;
}

interface NCKHProposalFormProps {
  onDataChange?: (data: NCKHRecord[]) => void;
  initialData?: NCKHRecord[];
}

export function NCKHProposalForm({
  onDataChange,
  initialData = [],
}: NCKHProposalFormProps) {
  const [form] = Form.useForm();
  const [dataSource, setDataSource] = useState<NCKHRecord[]>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NCKHRecord | null>(null);

  // Thêm hoặc sửa record
  const handleSave = () => {
    form.validateFields().then(values => {
      const newRecord: NCKHRecord = {
        key: editingRecord?.key || Date.now().toString(),
        ...values,
      };

      let newData: NCKHRecord[];
      if (editingRecord) {
        newData = dataSource.map(item => (item.key === editingRecord.key ? newRecord : item));
        message.success('Cập nhật thành công!');
      } else {
        newData = [...dataSource, newRecord];
        message.success('Thêm mới thành công!');
      }

      setDataSource(newData);
      onDataChange?.(newData);
      handleCloseModal();
    });
  };

  // Xóa record
  const handleDelete = (key: string) => {
    const newData = dataSource.filter(item => item.key !== key);
    setDataSource(newData);
    onDataChange?.(newData);
    message.success('Xóa thành công!');
  };

  // Mở modal thêm mới
  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      nam: new Date().getFullYear(),
      loai: 'DTKH',
      status: PROPOSAL_STATUS.APPROVED,
    });
    setIsModalOpen(true);
  };

  // Mở modal chỉnh sửa
  const handleEdit = (record: NCKHRecord) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setIsModalOpen(true);
  };

  // Đóng modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const columns: ColumnsType<NCKHRecord> = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Họ và tên',
      dataIndex: 'personnel_name',
      key: 'personnel_name',
      width: 180,
    },
    {
      title: 'CCCD',
      dataIndex: 'cccd',
      key: 'cccd',
      width: 120,
    },
    {
      title: 'Năm',
      dataIndex: 'nam',
      key: 'nam',
      width: 80,
      align: 'center',
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      key: 'loai',
      width: 100,
      align: 'center',
      render: (loai: string) => (
        <Tag color={loai === 'DTKH' ? 'blue' : 'green'}>
          {loai === 'DTKH' ? 'Đề tài KH' : 'Sáng kiến KH'}
        </Tag>
      ),
    },
    {
      title: 'Mô tả đề tài',
      dataIndex: 'mo_ta',
      key: 'mo_ta',
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status: string) => (
        <Tag
          color={
            status === PROPOSAL_STATUS.APPROVED
              ? PROPOSAL_STATUS_COLORS[PROPOSAL_STATUS.APPROVED]
              : PROPOSAL_STATUS_COLORS[PROPOSAL_STATUS.PENDING]
          }
        >
          {getProposalStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xác nhận xóa?"
            description="Bạn có chắc muốn xóa thành tích này?"
            onConfirm={() => handleDelete(record.key)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message="Hướng dẫn"
        description="Nhập danh sách quân nhân có thành tích ĐTKH/SKKH trong năm. Mỗi dòng là một thành tích cần đề xuất khen thưởng."
        type="info"
        showIcon
        icon={<ExperimentOutlined />}
        style={{ marginBottom: 16 }}
      />

      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
          Thêm thành tích ĐTKH/SKKH
        </Button>
        <span style={{ marginLeft: 16, color: '#8c8c8c' }}>
          Tổng số: <strong>{dataSource.length}</strong> thành tích
        </span>
      </div>

      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        bordered
        scroll={{ x: 1200 }}
        locale={{
          emptyText: <Empty description='Chưa có dữ liệu. Nhấn "Thêm thành tích ĐTKH/SKKH" để bắt đầu.' />,
        }}
      />

      {/* Modal thêm/sửa */}
      <Modal
        title={
          <Space>
            <ExperimentOutlined style={{ color: '#1890ff' }} />
            {editingRecord ? 'Chỉnh sửa thành tích' : 'Thêm thành tích ĐTKH/SKKH'}
          </Space>
        }
        open={isModalOpen}
        onCancel={handleCloseModal}
        width={700}
        footer={[
          <Button key="cancel" onClick={handleCloseModal}>
            Hủy
          </Button>,
          <Button key="submit" type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            Lưu
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 20 }} size="large">
          <Form.Item
            label="Họ và tên quân nhân"
            name="personnel_name"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên!' }]}
          >
            <Input placeholder="Nhập họ và tên đầy đủ" size="large" />
          </Form.Item>

          <Form.Item
            label="Số CCCD"
            name="cccd"
            rules={[
              { required: true, message: 'Vui lòng nhập CCCD!' },
              { pattern: /^[0-9]{9,12}$/, message: 'CCCD phải là số từ 9-12 chữ số!' },
            ]}
          >
            <Input placeholder="Nhập số CCCD" size="large" maxLength={12} />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              label="Năm thực hiện"
              name="nam"
              rules={[{ required: true, message: 'Vui lòng nhập năm!' }]}
            >
              <InputNumber
                placeholder="2024"
                size="large"
                style={{ width: '100%' }}
                min={2000}
                max={2100}
              />
            </Form.Item>

            <Form.Item
              label="Loại thành tích"
              name="loai"
              rules={[{ required: true, message: 'Vui lòng chọn loại!' }]}
            >
              <Select
                placeholder="Chọn loại"
                size="large"
                popupMatchSelectWidth={false}
                styles={{ popup: { root: { minWidth: 'max-content' } } }}
              >
                <Select.Option value="DTKH">Đề tài Khoa học (ĐTKH)</Select.Option>
                <Select.Option value="SKKH">Sáng kiến Khoa học (SKKH)</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            label="Mô tả đề tài / Nội dung thành tích"
            name="mo_ta"
            rules={[{ required: true, message: 'Vui lòng nhập mô tả!' }]}
          >
            <Input.TextArea
              placeholder="Ví dụ: Nghiên cứu ứng dụng AI trong quản lý hồ sơ quân nhân..."
              rows={4}
              size="large"
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="Trạng thái phê duyệt"
            name="status"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái!' }]}
          >
            <Select placeholder="Chọn trạng thái" size="large">
              <Select.Option value={PROPOSAL_STATUS.APPROVED}>
                {getProposalStatusLabel(PROPOSAL_STATUS.APPROVED)}
              </Select.Option>
              <Select.Option value={PROPOSAL_STATUS.PENDING}>
                {getProposalStatusLabel(PROPOSAL_STATUS.PENDING)}
              </Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
