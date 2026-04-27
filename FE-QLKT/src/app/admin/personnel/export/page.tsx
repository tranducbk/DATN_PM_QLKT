'use client';

import { useState } from 'react';
import { Card, Button, Typography, Space, Alert, Breadcrumb, message } from 'antd';
import { getApiErrorMessage } from '@/lib/apiError';

import {
  DownloadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  LeftOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/apiClient';
import Link from 'next/link';

const { Title, Paragraph, Text } = Typography;

export default function PersonnelExportPage() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const blob = await apiClient.exportPersonnel();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quan_nhan_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('Xuất dữ liệu quân nhân thành công');
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi xuất dữ liệu'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Breadcrumb */}
      <Breadcrumb style={{ marginBottom: 24 }}>
        <Breadcrumb.Item>
          <Link href="/admin/dashboard">
            <HomeOutlined />
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link href="/admin/personnel">Quân nhân</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>Xuất dữ liệu</Breadcrumb.Item>
      </Breadcrumb>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space style={{ marginBottom: 8 }}>
          <Link href="/admin/personnel">
            <Button icon={<LeftOutlined />}>Quay lại</Button>
          </Link>
        </Space>
        <Title level={2} style={{ marginTop: 8, marginBottom: 8 }}>
          Xuất dữ liệu Quân nhân
        </Title>
        <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 0 }}>
          Xuất toàn bộ dữ liệu quân nhân ra file Excel
        </Paragraph>
      </div>

      <div>
        {/* Export All Data */}
        <Card
          title={
            <Space>
              <FileExcelOutlined />
              <span>Xuất toàn bộ dữ liệu</span>
            </Space>
          }
          style={{ height: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              icon={<CheckCircleOutlined />}
              message={
                <div>
                  <Text strong>Bao gồm:</Text>
                  <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                    <li>Thông tin cá nhân (CCCD, Họ tên, Ngày sinh)</li>
                    <li>Thông tin quân sự (Ngày nhập ngũ, Chức vụ, Đơn vị)</li>
                    <li>Trạng thái hoạt động</li>
                  </ul>
                </div>
              }
              type="info"
              showIcon
            />
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              loading={loading}
              block
              size="large"
            >
              {loading ? 'Đang xuất...' : 'Xuất dữ liệu'}
            </Button>
          </Space>
          <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 16, marginBottom: 0 }}>
            Xuất tất cả dữ liệu quân nhân hiện có trong hệ thống
          </Paragraph>
        </Card>

      </div>
    </div>
  );
}
