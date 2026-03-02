'use client';

import { useState } from 'react';
import { Modal, Form, Input, message, Alert } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';
import axiosInstance from '@/utils/axiosInstance';

const { TextArea } = Input;

interface Proposal {
  id: string;
  loai_de_xuat: string;
  NguoiDeXuat?: {
    QuanNhan?: {
      ho_ten: string;
    };
    username: string;
  };
}

interface RejectModalProps {
  visible: boolean;
  proposal: Proposal;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RejectModal({ visible, proposal, onClose, onSuccess }: RejectModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await axiosInstance.post(`/api/proposals/${proposal.id}/reject`, {
        rejection_reason: values.rejection_reason,
      });

      if (response.data.success) {
        message.success('Đã từ chối đề xuất thành công!');
        form.resetFields();
        onSuccess();
      } else {
        throw new Error(response.data.message || 'Từ chối thất bại');
      }
    } catch (error: any) {
      message.error(error.message || 'Lỗi khi từ chối đề xuất');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={
        <span>
          <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
          Từ chối đề xuất khen thưởng
        </span>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Xác nhận từ chối"
      cancelText="Hủy"
      okButtonProps={{ danger: true }}
      width={600}
    >
      <Alert
        message="Cảnh báo"
        description="Hành động này không thể hoàn tác. Đề xuất sẽ được chuyển sang trạng thái 'Từ chối' và người đề xuất sẽ nhận được thông báo."
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <div style={{ marginBottom: 16 }}>
        <strong>Người đề xuất:</strong>{' '}
        {proposal.NguoiDeXuat?.QuanNhan?.ho_ten || proposal.NguoiDeXuat?.username || '-'}
      </div>

      <Form form={form} layout="vertical">
        <Form.Item
          label="Lý do từ chối"
          name="rejection_reason"
          rules={[
            { required: true, message: 'Vui lòng nhập lý do từ chối!' },
            { min: 10, message: 'Lý do phải có ít nhất 10 ký tự!' },
          ]}
        >
          <TextArea
            rows={6}
            placeholder="Nhập lý do cụ thể tại sao đề xuất này bị từ chối..."
            maxLength={1000}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
